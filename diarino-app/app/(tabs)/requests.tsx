import { memo, useCallback, useMemo, useState } from "react";
import { router } from "expo-router";
import { View, Text, Pressable, FlatList, StyleSheet, Alert, ActivityIndicator } from "react-native";
import Svg, { Path } from "react-native-svg";
import { PropertyRequest } from "../../data/mock-requests";
import { fmtPrice } from "../../lib/types";
import { PageTopBar } from "../../components/shared/PageTopBar";
import { RequestFilterModal, RequestFilters, DEFAULT_REQUEST_FILTERS } from "../../components/requests/RequestFilterModal";
import { MakeOfferModal } from "../../components/requests/MakeOfferModal";
import { NotificationsDropdown } from "../../components/notifications/NotificationsDropdown";
import { useNotifications } from "../../lib/hooks/useNotifications";
import { useFavorites } from "../../lib/hooks/useFavorites";
import { usePaginatedRequests, useIncrementRequestOffers, RequestPageFilters } from "../../lib/hooks/useRequests";
import { openOrCreateRequestChat, useSendMessage } from "../../lib/hooks/useChatsDB";
import { useChatOnRequestsMap } from "../../lib/hooks/useContentSettings";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";
import { ActionSheet } from "../../components/shared/ActionSheet";
import { ReportModal } from "../../components/shared/ReportModal";

// ↔ perf audit fix #2 (applied here per audit follow-up) — extracted +
// memoized card, id/item-parameterized callbacks, same pattern as
// app/(tabs)/index.tsx's ReelCard.
type RequestCardProps = {
  item: PropertyRequest;
  isFavorite: boolean;
  chatEnabled: boolean;
  onToggleFavorite: (requestId: string) => void;
  onReport: (item: PropertyRequest) => void;
  onMakeOffer: (item: PropertyRequest) => void;
};

const RequestCard = memo(function RequestCard({ item, isFavorite, chatEnabled, onToggleFavorite, onReport, onMakeOffer }: RequestCardProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <Pressable
      style={styles.card}
      onLongPress={() => onReport(item)}
      delayLongPress={500}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>{t(item.type)} {item.purpose === "sale" ? t("للبيع") : t("للإيجار")}</Text>
        <Text style={styles.cardPrice}>{t("حتى")} {item.priceMax ? fmtPrice(item.priceMax) : "—"} {t("ج.م")} {item.purpose === "rent" ? t("/ شهر") : ""}</Text>
      </View>
      <Text style={styles.cardLoc}>📍 {t(item.province)} · {t(item.location)}</Text>
      <View style={styles.specsRow}>
        {item.rooms !== "-" && !!item.rooms && <Text style={styles.spec}>🛏 {item.rooms}</Text>}
        {item.baths !== "-" && !!item.baths && <Text style={styles.spec}>🛁 {item.baths}</Text>}
        {!!item.area && <Text style={styles.spec}>📐 {item.area} {t("م²")}</Text>}
      </View>
      <View style={styles.descRow}>
        <Text style={styles.desc}>{t(item.description)}</Text>
        <Pressable onPress={() => onToggleFavorite(item.id)} hitSlop={6}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill={isFavorite ? "#FBBF24" : "none"} stroke={isFavorite ? "#FBBF24" : "#9ca3af"} strokeWidth={2}>
            <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </Svg>
        </Pressable>
      </View>
      {chatEnabled ? (
        <Pressable style={styles.offerBtn} onPress={() => onMakeOffer(item)}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </Svg>
          <Text style={styles.offerBtnText}>{t("تقديم عرض")}</Text>
        </Pressable>
      ) : (
        <Text style={styles.offersClosedText}>{t("صاحب الطلب مغلق للدردشة حاليًا")}</Text>
      )}
      <Text style={styles.offersCount}>{item.offers || 0} {t("عروض")}</Text>
    </Pressable>
  );
});

// ↔ page-requests / renderRequests() in app-viewer.html.
export default function RequestsScreen() {
  const { user } = useCurrentUser();
  const [filters, setFilters] = useState<RequestFilters>(DEFAULT_REQUEST_FILTERS);

  // ↔ real pagination (agreed plan) — filtering now happens server-side
  // via usePaginatedRequests, page size 20; useRequests() (the capped-at-300
  // list) is no longer used here on purpose.
  const pageFilters: RequestPageFilters = useMemo(() => ({
    province: filters.province || undefined,
    location: filters.location || undefined,
    type: filters.type,
    purpose: filters.purpose,
  }), [filters]);
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = usePaginatedRequests(pageFilters);
  const filtered = useMemo(() => data?.pages.flat() ?? [], [data]);

  const incrementOffers = useIncrementRequestOffers();
  const sendMessage = useSendMessage();
  const { favoriteRequests, toggleFavoriteRequest } = useFavorites();
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [offerRequest, setOfferRequest] = useState<PropertyRequest | null>(null);
  // ↔ long-press on a request card → quick "الإبلاغ عن المحتوى" (reason
  // only, no link) that lands in the admin support center's "الإبلاغات" tab.
  const [reportSheetRequest, setReportSheetRequest] = useState<PropertyRequest | null>(null);
  const [reportModalRequest, setReportModalRequest] = useState<PropertyRequest | null>(null);

  const [notifMenuVisible, setNotifMenuVisible] = useState(false);
  const notifications = useNotifications();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  const { data: chatOnRequestsMap } = useChatOnRequestsMap(filtered.map((r) => r.requesterId));

  // ↔ perf audit fix #2 — stable callbacks + extracted renderItem.
  const handleToggleFavoriteRequest = useCallback((requestId: string) => toggleFavoriteRequest(requestId), [toggleFavoriteRequest]);
  const handleReportRequest = useCallback((item: PropertyRequest) => setReportSheetRequest(item), []);
  const handleMakeOffer = useCallback((item: PropertyRequest) => setOfferRequest(item), []);
  const renderItem = useCallback(
    ({ item }: { item: PropertyRequest }) => (
      <RequestCard
        item={item}
        isFavorite={favoriteRequests.has(item.id)}
        chatEnabled={chatOnRequestsMap?.get(item.requesterId) ?? true}
        onToggleFavorite={handleToggleFavoriteRequest}
        onReport={handleReportRequest}
        onMakeOffer={handleMakeOffer}
      />
    ),
    [favoriteRequests, chatOnRequestsMap, handleToggleFavoriteRequest, handleReportRequest, handleMakeOffer]
  );

  // ↔ submitOffer()
  async function submitOffer(message: string, price: string, whatsapp: string) {
    if (!offerRequest || !user) return;
    const r = offerRequest;

    if (r.requesterId === user.id) {
      Alert.alert(t("لا يمكنك تقديم عرض على طلبك الخاص"));
      setOfferRequest(null);
      return;
    }

    try {
      incrementOffers.mutate(r.id);
      const chatId = await openOrCreateRequestChat(user.id, r.requesterId, r.id);
      const fullMsg = message + (price ? `\nالسعر: ${fmtPrice(Number(price))} ج.م` : "");
      await sendMessage.mutateAsync({
        chatId, senderId: user.id,
        text: `بخصوص طلبك (${r.type} - ${r.location}):\n${fullMsg}`,
        whatsapp,
      });
      setOfferRequest(null);
      router.push(`/chat/${chatId}`);
    } catch {
      Alert.alert(t("تعذر إرسال العرض"), t("حاول مرة أخرى."));
    }
  }

  return (
    <View style={styles.container}>
      <PageTopBar
        title="الطلبات"
        notifBadgeCount={notifications.totalUnread}
        onOpenNotifications={() => setNotifMenuVisible(true)}
      />

      <View style={styles.filterBar}>
        <Pressable style={styles.filterPill} onPress={() => setFilterModalVisible(true)}>
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <Path d="M4 6h16M7 12h10M10 18h4" />
          </Svg>
          <Text style={styles.filterPillText}>{t("تصفية")}</Text>
        </Pressable>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 120 }}
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color="#22A652" style={{ marginVertical: 16 }} /> : null}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color="#22A652" style={{ marginTop: 60 }} />
          ) : (
            <View style={styles.empty}><Text style={styles.emptyText}>{t("لا توجد طلبات")}</Text></View>
          )
        }
        renderItem={renderItem}
      />

      <RequestFilterModal
        visible={filterModalVisible}
        value={filters}
        onApply={setFilters}
        onClose={() => setFilterModalVisible(false)}
      />

      <MakeOfferModal
        visible={!!offerRequest}
        request={offerRequest}
        onClose={() => setOfferRequest(null)}
        onSubmit={submitOffer}
      />

      <ActionSheet
        visible={!!reportSheetRequest}
        onClose={() => setReportSheetRequest(null)}
        items={[
          {
            key: "report",
            label: t("الإبلاغ عن هذا الطلب"),
            danger: true,
            icon: (props) => <Svg {...props}><Path d="M4 22V4" /><Path d="M4 4h13l-2 4 2 4H4" /></Svg>,
            onPress: () => setReportModalRequest(reportSheetRequest),
          },
        ]}
      />
      <ReportModal
        visible={!!reportModalRequest}
        onClose={() => setReportModalRequest(null)}
        quickMode
        targetType="request"
        targetId={reportModalRequest?.id ?? ""}
        targetTitle={reportModalRequest ? `${reportModalRequest.type} - ${reportModalRequest.location}` : ""}
      />

      <NotificationsDropdown
        visible={notifMenuVisible}
        onClose={() => setNotifMenuVisible(false)}
        activeCat={notifications.activeCat}
        onSwitchCat={notifications.setActiveCat}
        filter={notifications.filter}
        onSetFilter={notifications.setFilter}
        badges={notifications.badges}
        items={notifications.visibleItems}
        onMarkAllRead={notifications.markAllRead}
        onItemPress={(index) => {
          const item = notifications.visibleItems[index];
          notifications.markItemRead(notifications.activeCat, index);
          setNotifMenuVisible(false);
          if (!item?.action) return;
          const a = item.action;
          if (a.type === "seller") router.push(`/seller/${a.id}`);
          else if (a.type === "property") router.push(`/property/${a.id}`);
          else if (a.type === "reel") router.push(`/property/${a.propertyId}`);
          else if (a.type === "chat") router.push(`/chat/${a.id}`);
        }}
      />
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    filterBar: { paddingHorizontal: 14, paddingTop: 12 },
    filterPill: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 6, backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
    filterPillText: { color: "white", fontSize: 12, fontWeight: "900" },
    empty: { alignItems: "center", paddingTop: 60 },
    emptyText: { color: themeColors.textSubtle, fontSize: 13, fontWeight: "800" },
    card: { backgroundColor: themeColors.card, borderRadius: 16, padding: 14 },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    cardTitle: { fontSize: 13, fontWeight: "900", color: themeColors.text },
    cardPrice: { fontSize: 12, fontWeight: "900", color: "#22A652" },
    cardLoc: { fontSize: 11.5, color: themeColors.textSubtle, marginBottom: 8 },
    specsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
    spec: { fontSize: 10.5, fontWeight: "800", color: themeColors.textMuted, backgroundColor: themeColors.surface, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 },
    descRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 12 },
    desc: { flex: 1, fontSize: 12, color: themeColors.textMuted, lineHeight: 18 },
    offerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#22A652", borderRadius: 12, paddingVertical: 11 },
    offerBtnText: { color: "white", fontWeight: "900", fontSize: 12.5 },
    offersClosedText: { textAlign: "center", fontSize: 11, color: themeColors.textSubtle, fontWeight: "700", paddingVertical: 10 },
    offersCount: { textAlign: "center", fontSize: 10.5, color: themeColors.textSubtle, marginTop: 8 },
  });
}
