import { memo, useCallback, useMemo, useState } from "react";
import { router, useLocalSearchParams, Link } from "expo-router";
import { View, Text, ScrollView, Pressable, StyleSheet, FlatList, Alert } from "react-native";
import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import { useMyProperties } from "../../lib/hooks/useProperties";
import { properties as demoProperties } from "../../data/mock-properties";
import { fmtPrice, Property } from "../../lib/types";
import { ReelBackground } from "../../components/reel/ReelBackground";
import { cardThumbnailUrl } from "../../lib/cloudinary";
import { openOrCreateChat } from "../../lib/hooks/useChatsDB";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useFollows, useFollowerCount } from "../../lib/hooks/useFollows";
import { usePublicLivesForSeller } from "../../lib/hooks/useMyContent";
import { useLikes } from "../../lib/hooks/useLikes";
import { useFavorites } from "../../lib/hooks/useFavorites";
import { useIsProfilePublic } from "../../lib/hooks/useAccountPrivacy";
import { ActionSheet } from "../../components/shared/ActionSheet";
import { ReportModal } from "../../components/shared/ReportModal";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

// ↔ perf audit fix #2 (applied here per audit follow-up) — extracted +
// memoized card, id/item-parameterized callbacks, same pattern as
// app/(tabs)/index.tsx's ReelCard.
type SellerPropertyCardProps = {
  item: Property;
  isLiked: boolean;
  isFavorite: boolean;
  onToggleLike: (propertyId: string) => void;
  onToggleFavorite: (propertyId: string) => void;
  onReport: (item: Property) => void;
};

const SellerPropertyCard = memo(function SellerPropertyCard({ item, isLiked, isFavorite, onToggleLike, onToggleFavorite, onReport }: SellerPropertyCardProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const thumbnailUrl = cardThumbnailUrl(item);
  return (
    <Link href={`/property/${item.id}/reel`} asChild>
      <Pressable
        style={styles.card}
        onLongPress={() => onReport(item)}
        delayLongPress={500}
      >
        <View style={styles.cardMedia}>
          {thumbnailUrl ? (
            <Image source={{ uri: thumbnailUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={150} />
          ) : (
            <ReelBackground index={0} type={item.type} />
          )}
          <View style={styles.cardActions}>
            <Pressable
              style={styles.cardActionBtn}
              onPress={(e) => { e.stopPropagation(); onToggleLike(item.id); }}
              hitSlop={6}
            >
              <Svg width={13} height={13} viewBox="0 0 24 24" fill={isLiked ? "#ef4444" : "none"} stroke={isLiked ? "#ef4444" : "white"} strokeWidth={2}>
                <Path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" />
              </Svg>
            </Pressable>
            <Pressable
              style={styles.cardActionBtn}
              onPress={(e) => { e.stopPropagation(); onToggleFavorite(item.id); }}
              hitSlop={6}
            >
              <Svg width={13} height={13} viewBox="0 0 24 24" fill={isFavorite ? "#22A652" : "none"} stroke={isFavorite ? "#22A652" : "white"} strokeWidth={2}>
                <Path d="M19 21l-7-4-7 4V5a2 2 0 012-2h10a2 2 0 012 2z" />
              </Svg>
            </Pressable>
          </View>
        </View>
        <Text style={styles.cardPrice}>{fmtPrice(item.price)} {t("ج.م")}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>{t(item.shortTitle || item.title)}</Text>
      </Pressable>
    </Link>
  );
});

// ↔ #screen-seller in app-viewer.html.
export default function SellerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const { user } = useCurrentUser();
  const { followedIds, toggleFollow, notifyIds, toggleNotify } = useFollows();
  const following = followedIds.has(id ?? "");
  const isNotifying = notifyIds.has(id ?? "");
  const { data: followerCount } = useFollowerCount(id);
  const { data: publicLives } = usePublicLivesForSeller(id);
  const { likedIds, toggleLike } = useLikes();
  const { favoriteProperties, toggleFavoriteProperty } = useFavorites();
  const { data: isProfilePublic } = useIsProfilePublic(id);
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  // ↔ audit-plan fix: this used to pull the full unbounded useProperties()
  // list and filter client-side. useMyProperties(id) already existed and
  // is server-filtered (`eq("seller_id", id)`) — a seller's own listing
  // count is naturally small, so no pagination is needed here at all,
  // just the correct query. Demo sellers (data/mock-properties.ts) are
  // still merged in separately since they're never real DB rows —
  // exactly what useProperties() did before, just without needing every
  // real listing in the whole app to do it.
  const { data: myListings } = useMyProperties(id);
  const sellerListings = useMemo(
    () => [...(myListings ?? []), ...demoProperties.filter((p) => p.seller.id === id)],
    [myListings, id]
  );
  const seller = sellerListings[0]?.seller;

  // ↔ long-press on a recorded-live card below → quick "الإبلاغ عن هذا
  // اللايف" (reason only, no link), same pattern as the reel feed's
  // long-press report.
  const [reportSheetLive, setReportSheetLive] = useState<{ id: string; title: string } | null>(null);
  const [reportModalLive, setReportModalLive] = useState<{ id: string; title: string } | null>(null);
  // ↔ same for a reel/listing card in the grid below.
  const [reportSheetProperty, setReportSheetProperty] = useState<{ id: string; title: string } | null>(null);
  const [reportModalProperty, setReportModalProperty] = useState<{ id: string; title: string } | null>(null);

  // ↔ perf audit fix #2 — stable callbacks + extracted renderItem.
  const handleToggleLikeProperty = useCallback((propertyId: string) => toggleLike(propertyId), [toggleLike]);
  const handleToggleFavoriteProperty = useCallback((propertyId: string) => toggleFavoriteProperty(propertyId), [toggleFavoriteProperty]);
  const handleReportProperty = useCallback(
    (item: Property) => setReportSheetProperty({ id: item.id, title: item.shortTitle || item.title }),
    []
  );
  const renderItem = useCallback(
    ({ item }: { item: Property }) => (
      <SellerPropertyCard
        item={item}
        isLiked={likedIds.has(item.id)}
        isFavorite={favoriteProperties.has(item.id)}
        onToggleLike={handleToggleLikeProperty}
        onToggleFavorite={handleToggleFavoriteProperty}
        onReport={handleReportProperty}
      />
    ),
    [likedIds, favoriteProperties, handleToggleLikeProperty, handleToggleFavoriteProperty, handleReportProperty]
  );

  if (!seller) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>{t("هذا البائع غير متاح")}</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>{t("رجوع")}</Text>
        </Pressable>
      </View>
    );
  }

  // ↔ "الحساب العام" toggle in the settings menu — hide everything except
  // a plain notice from anyone other than the account's own owner.
  if (isProfilePublic === false && user?.id !== id) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>{t("هذا الحساب خاص")}</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>{t("رجوع")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={themeColors.textMuted} strokeWidth={2.5}>
            <Path d="M6 6l12 12M18 6L6 18" />
          </Svg>
        </Pressable>
      </View>

      <FlatList
        data={sellerListings}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 14 }}
        contentContainerStyle={{ gap: 10, paddingBottom: 30 }}
        ListHeaderComponent={
          <View style={styles.profileBlock}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{seller.initial}</Text></View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text style={styles.name}>{t(seller.name)}</Text>
              {seller.verified && <Text style={{ color: "#22A652", fontSize: 15 }}>✓</Text>}
            </View>
            <Text style={styles.bio}>{t(seller.bio)}</Text>

            <View style={styles.statsRow}>
              <Stat label="إعلان" value={seller.listings} />
              <Stat label="متابع" value={followerCount ?? seller.followers} />
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.followBtn, following && styles.followBtnActive]}
                onPress={() => toggleFollow(id!)}
              >
                <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
                  {following ? t("متابَع ✓") : t("متابعة")}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.bellBtn, isNotifying && styles.bellBtnActive]}
                onPress={() => toggleNotify(id!)}
              >
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={isNotifying ? "#22A652" : themeColors.textMuted} strokeWidth={2}>
                  {isNotifying ? (
                    <Path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
                  ) : (
                    <Path d="M18 8a6 6 0 00-9.33-5M6.26 6.26A5.98 5.98 0 006 8c0 7-3 9-3 9h13M18 8c0 3.5 1 5.8 1.8 7.2M13.73 21a2 2 0 01-3.46 0M1 1l22 22" />
                  )}
                </Svg>
              </Pressable>
              {sellerListings[0] && (
                <Pressable
                  style={styles.chatIconBtn}
                  onPress={async () => {
                    if (!user) return;
                    const isRealSeller = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seller.id);
                    if (!isRealSeller) {
                      Alert.alert(t("هذا حساب تجريبي"), t("لا يمكن بدء محادثة مع هذا الحساب."));
                      return;
                    }
                    const chatId = await openOrCreateChat(user.id, seller.id, sellerListings[0].id);
                    router.push(`/chat/${chatId}`);
                  }}
                >
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#22A652" strokeWidth={2}>
                    <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </Svg>
                </Pressable>
              )}
            </View>

            {!!publicLives?.length && (
              <View style={{ width: "100%", marginTop: 22 }}>
                <Text style={styles.sectionTitle}>{t("بثوث مباشرة")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {publicLives.map((live) => (
                    <Pressable
                      key={live.id}
                      style={styles.liveCard}
                      onPress={() => router.push(`/live/replay/${live.id}`)}
                      onLongPress={() => setReportSheetLive({ id: live.id, title: live.title || "بث مباشر" })}
                      delayLongPress={500}
                    >
                      <View style={styles.liveCardMedia}>
                        {live.pinned && <View style={styles.livePinBadge}><Text style={styles.livePinBadgeText}>📌</Text></View>}
                        <Text style={styles.liveCardPlay}>▶</Text>
                      </View>
                      <Text style={styles.liveCardTitle} numberOfLines={1}>{t(live.title || "بث مباشر")}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={styles.sectionTitle}>{t("إعلاناتي")} — {t(seller.name)}</Text>
          </View>
        }
        renderItem={renderItem}
      />

      <ActionSheet
        visible={!!reportSheetLive}
        onClose={() => setReportSheetLive(null)}
        items={[
          {
            key: "report",
            label: t("الإبلاغ عن هذا اللايف"),
            danger: true,
            icon: (props) => <Svg {...props}><Path d="M4 22V4" /><Path d="M4 4h13l-2 4 2 4H4" /></Svg>,
            onPress: () => setReportModalLive(reportSheetLive),
          },
        ]}
      />
      <ReportModal
        visible={!!reportModalLive}
        onClose={() => setReportModalLive(null)}
        quickMode
        targetType="live"
        targetId={reportModalLive?.id ?? ""}
        targetTitle={reportModalLive?.title ?? ""}
      />

      <ActionSheet
        visible={!!reportSheetProperty}
        onClose={() => setReportSheetProperty(null)}
        items={[
          {
            key: "report",
            label: t("الإبلاغ عن هذا الريل"),
            danger: true,
            icon: (props) => <Svg {...props}><Path d="M4 22V4" /><Path d="M4 4h13l-2 4 2 4H4" /></Svg>,
            onPress: () => setReportModalProperty(reportSheetProperty),
          },
        ]}
      />
      <ReportModal
        visible={!!reportModalProperty}
        onClose={() => setReportModalProperty(null)}
        quickMode
        targetType="property"
        targetId={reportModalProperty?.id ?? ""}
        targetTitle={reportModalProperty?.title ?? ""}
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{t(label)}</Text>
    </View>
  );
}

// ↔ قاعدة تثيم الوسائط: cardMedia (ReelBackground) وliveCardMedia
// أسطح وسائط (صورة/فيديو تمهيدي) — أيقوناتهم المتراكبة (اللايك/الحفظ/
// أيقونة التشغيل) فضلوا بيضا ثابتة + خلفية عتمة سودة عمدًا، مش تابعين
// للثيم، حسب نفس القاعدة المطبّقة على الريلز.
function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: themeColors.background },
    notFoundText: { fontSize: 14, fontWeight: "800", color: themeColors.textMuted },
    backBtn: { backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 24 },
    backBtnText: { color: "white", fontWeight: "900" },
    header: { paddingTop: 50, paddingHorizontal: 14, paddingBottom: 6 },
    closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: themeColors.surface },
    profileBlock: { alignItems: "center", paddingHorizontal: 20, paddingBottom: 16 },
    avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#22A652", alignItems: "center", justifyContent: "center", marginBottom: 10 },
    avatarText: { color: "white", fontWeight: "900", fontSize: 28 },
    name: { fontSize: 16, fontWeight: "900", color: themeColors.text },
    bio: { fontSize: 12.5, color: themeColors.textSubtle, marginTop: 4, textAlign: "center" },
    statsRow: { flexDirection: "row", gap: 28, marginTop: 14 },
    stat: { alignItems: "center" },
    statValue: { fontSize: 15, fontWeight: "900", color: themeColors.text },
    statLabel: { fontSize: 11, color: themeColors.textSubtle, marginTop: 2 },
    actionsRow: { flexDirection: "row", gap: 10, marginTop: 16, width: "100%" },
    followBtn: { flex: 1, backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 11, alignItems: "center" },
    followBtnActive: { backgroundColor: themeColors.surface },
    followBtnText: { color: "white", fontWeight: "900", fontSize: 13 },
    followBtnTextActive: { color: themeColors.textMuted },
    bellBtn: {
      width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: themeColors.border,
      alignItems: "center", justifyContent: "center", backgroundColor: themeColors.card,
    },
    bellBtnActive: { borderColor: "#22A652", backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ecfdf5" },
    chatIconBtn: { width: 44, height: 44, borderRadius: 999, borderWidth: 1.5, borderColor: "#22A652", alignItems: "center", justifyContent: "center" },
    sectionTitle: { alignSelf: "flex-start", fontSize: 13, fontWeight: "900", color: themeColors.text, marginTop: 22, marginBottom: 4 },
    liveCard: { width: 100 },
    liveCardMedia: { width: 100, height: 130, borderRadius: 12, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
    liveCardPlay: { color: "white", fontSize: 20 },
    livePinBadge: { position: "absolute", top: 6, right: 6 },
    livePinBadgeText: { fontSize: 13 },
    liveCardTitle: { fontSize: 11, color: themeColors.textSubtle, marginTop: 4, width: 100 },
    card: { flex: 1, backgroundColor: themeColors.surface, borderRadius: 12, overflow: "hidden", marginBottom: 4 },
    cardMedia: { height: 110, position: "relative" },
    cardActions: { position: "absolute", top: 6, left: 6, flexDirection: "row", gap: 6 },
    cardActionBtn: {
      width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center", justifyContent: "center",
    },
    cardPrice: { fontSize: 13, fontWeight: "900", color: "#22A652", marginTop: 6, marginHorizontal: 8 },
    cardTitle: { fontSize: 11, color: themeColors.textSubtle, marginHorizontal: 8, marginBottom: 8, marginTop: 2 },
  });
}
