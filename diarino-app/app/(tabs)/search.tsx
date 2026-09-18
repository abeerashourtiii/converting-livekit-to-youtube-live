import { memo, useCallback, useMemo, useState } from "react";
import { router } from "expo-router";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { usePaginatedProperties, usePropertiesInRadius, usePropertiesInBounds, PropertyPageFilters } from "../../lib/hooks/useProperties";
import { useDebouncedValue } from "../../lib/hooks/useDebouncedValue";
import { useCompareSelection } from "../../lib/hooks/useCompareSelection";
import { showToast } from "../../components/shared/Toast";
import { fmtPrice, Property } from "../../lib/types";
import { ReelBackground } from "../../components/reel/ReelBackground";
import { PageTopBar } from "../../components/shared/PageTopBar";
import { SearchFilterModal, SearchFilters, DEFAULT_SEARCH_FILTERS } from "../../components/search/SearchFilterModal";
import { SaveAlertModal } from "../../components/search/SaveAlertModal";
import { useSavedSearchAlerts } from "../../lib/hooks/useSavedSearchAlerts";
import { GeoSearchModal, GeoPoint } from "../../components/search/GeoSearchModal";
// ↔ IMPORTANT: no ".native" suffix — an explicit ".native" import forces
// Metro to bundle PropertiesMapView.native.tsx into the WEB build too,
// which used to pull react-native-maps into the web bundle and break it.
// The extensionless import lets Metro resolve the right platform file
// (.native.tsx on Android/iOS, .web.tsx on web) automatically.
import { PropertiesMapView } from "../../components/search/PropertiesMapView";
import { NotificationsDropdown } from "../../components/notifications/NotificationsDropdown";
import { useNotifications } from "../../lib/hooks/useNotifications";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";
import { LatLng, boundingBox, pointInPolygon } from "../../lib/geo";
import { useActiveSponsoredReels } from "../../lib/hooks/useSponsoredReels";
import { usePropertiesByIds } from "../../lib/hooks/useProperties";
import { useActiveAdBanners } from "../../lib/hooks/useAdBanners";
import { AdBannerCarousel } from "../../components/menu/AdBannerCarousel";
import { SponsoredAdReelModal } from "../../components/search/SponsoredAdReelModal";
import { cldThumbnail, cardThumbnailUrl } from "../../lib/cloudinary";
import { Image } from "expo-image";

type SearchResultCardProps = {
  item: Property;
  index: number;
  isComparing: boolean;
  onOpenDetails: (propertyId: string) => void;
  onToggleCompare: (propertyId: string) => void;
};

const SearchResultCard = memo(function SearchResultCard({ item, index, isComparing, onOpenDetails, onToggleCompare }: SearchResultCardProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const thumbnailUrl = cardThumbnailUrl(item);
  return (
    <Pressable style={styles.card} onPress={() => onOpenDetails(item.id)}>
      <View style={styles.cardMedia}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={150} />
        ) : (
          <ReelBackground index={index} type={item.type} />
        )}
        <View style={[styles.purposeBadge, { backgroundColor: item.purpose === "sale" ? "#22A652" : "#F4673F" }]}>
          <Text style={styles.purposeBadgeText}>{item.purpose === "sale" ? t("بيع") : t("إيجار")}</Text>
        </View>
        <Pressable
          style={[styles.compareBadge, isComparing && styles.compareBadgeActive]}
          onPress={(e) => {
            e.stopPropagation();
            onToggleCompare(item.id);
          }}
          hitSlop={6}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={isComparing ? "white" : "#111827"} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M4 8a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" />
            <Path d="M8 6V4a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
          </Svg>
        </Pressable>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardType}>{t(item.type)}</Text>
        <Text style={styles.cardPrice}>{fmtPrice(item.price)} {t("ج.م")} {item.purpose === "rent" ? t("/ شهر") : ""}</Text>
        <Text style={styles.cardLocation} numberOfLines={1}>📍 {t(item.province)} · {t(item.location)}</Text>
        <View style={styles.cardMetaRow}>
          {!!item.rooms && <Text style={styles.cardMeta}>🛏 {item.rooms}</Text>}
          <Text style={styles.cardMeta}>📐 {item.area} {t("م²")}</Text>
        </View>
      </View>
    </Pressable>
  );
});

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_SEARCH_FILTERS);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const { createAlert } = useSavedSearchAlerts();
  const [geoModalVisible, setGeoModalVisible] = useState(false);
  const [geoPoint, setGeoPoint] = useState<GeoPoint>(null);
  const [notifMenuVisible, setNotifMenuVisible] = useState(false);
  const notifications = useNotifications();
  const { t } = useLanguage();
  const compareSelection = useCompareSelection();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [drawMode, setDrawMode] = useState(false);
  const [drawnPoints, setDrawnPoints] = useState<LatLng[]>([]);
  const [appliedPolygon, setAppliedPolygon] = useState<LatLng[] | null>(null);

  // ↔ بند 7 (الإعلانات الممولة من صفحة البحث): نفس المصدرين المستخدمين
  // فى شاشة الريلز (app/(tabs)/index.tsx) — بانرات الأدمن العادية
  // (ad_banners) + الريلز الممولة (sponsored_reels)، عشان صفحة البحث
  // تعرض نفس الإعلانات الحقيقية مش نسخة تانية منفصلة.
  const { data: adBanners } = useActiveAdBanners();
  const { data: sponsoredReels } = useActiveSponsoredReels();
  const sponsorPropertyIds = useMemo(
    () => [...new Set((sponsoredReels ?? []).map((s) => s.propertyId))],
    [sponsoredReels]
  );
  const { data: sponsorProperties } = usePropertiesByIds(sponsorPropertyIds);
  const featuredSponsor = useMemo(() => {
    const reel = sponsoredReels?.[0];
    if (!reel) return null;
    const property = sponsorProperties?.find((p) => p.id === reel.propertyId);
    if (!property) return null;
    return { reelId: reel.id, property };
  }, [sponsoredReels, sponsorProperties]);
  const [openSponsoredAd, setOpenSponsoredAd] = useState<{ reelId: string; property: Property } | null>(null);

  const debouncedQuery = useDebouncedValue(query, 400);
  const pageFilters: PropertyPageFilters = useMemo(() => ({
    purpose: filters.purpose,
    type: filters.type,
    provinces: filters.provinces,
    regions: filters.regions,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    areaMin: filters.areaMin,
    areaMax: filters.areaMax,
    minRooms: filters.minRooms,
    query: debouncedQuery,
  }), [filters, debouncedQuery]);

  const normalQuery = usePaginatedProperties(pageFilters);
  const radiusQuery = usePropertiesInRadius(pageFilters, geoPoint);
  const polygonBounds = useMemo(() => (appliedPolygon ? boundingBox(appliedPolygon) : null), [appliedPolygon]);
  const { data: boundsProperties, isLoading: isLoadingBounds } = usePropertiesInBounds(polygonBounds, { purpose: filters.purpose, type: filters.type });

  const polygonResults = useMemo(() => {
    if (!appliedPolygon || !boundsProperties) return [];
    return boundsProperties.filter((p) => p.lat != null && p.lng != null && pointInPolygon({ lat: p.lat, lng: p.lng }, appliedPolygon));
  }, [boundsProperties, appliedPolygon]);

  const isLoading = appliedPolygon ? isLoadingBounds : geoPoint ? radiusQuery.isLoading : normalQuery.isLoading;
  const isFetchingNextPage = geoPoint ? radiusQuery.isFetchingNextPage : normalQuery.isFetchingNextPage;
  const hasNextPage = appliedPolygon ? false : geoPoint ? radiusQuery.hasNextPage : normalQuery.hasNextPage;
  const fetchNextPage = geoPoint ? radiusQuery.fetchNextPage : normalQuery.fetchNextPage;

  const results: Property[] = useMemo(() => {
    if (appliedPolygon) return polygonResults;
    if (geoPoint) return radiusQuery.data?.pages.flat() ?? [];
    return normalQuery.data?.pages.flat() ?? [];
  }, [appliedPolygon, polygonResults, geoPoint, radiusQuery.data, normalQuery.data]);

  const mapRegion = useMemo(() => {
    if (geoPoint) return { latitude: geoPoint.lat, longitude: geoPoint.lng, latitudeDelta: (geoPoint.radiusKm / 80) || 0.2, longitudeDelta: (geoPoint.radiusKm / 80) || 0.2 };
    const withCoords = results.find((p) => p.lat != null && p.lng != null);
    return withCoords
      ? { latitude: withCoords.lat!, longitude: withCoords.lng!, latitudeDelta: 0.3, longitudeDelta: 0.3 }
      : { latitude: 30.0444, longitude: 31.2357, latitudeDelta: 3, longitudeDelta: 3 };
  }, [geoPoint, results]);

  function toggleDrawMode() {
    if (drawMode) {
      if (drawnPoints.length >= 3) {
        setAppliedPolygon(drawnPoints);
        setGeoPoint(null);
      } else {
        showToast(t("ارسم ٣ نقاط على الأقل لتحديد منطقة"));
        return;
      }
    } else {
      setAppliedPolygon(null);
      setDrawnPoints([]);
      setViewMode("map");
    }
    setDrawMode((v) => !v);
  }

  function clearPolygon() {
    setAppliedPolygon(null);
    setDrawnPoints([]);
  }

  const activeFilterCount =
    (filters.purpose !== "all" ? 1 : 0) +
    (filters.type !== "all" ? 1 : 0) +
    filters.provinces.length +
    (filters.minRooms > 0 ? 1 : 0) +
    (filters.priceMin > 0 || Number.isFinite(filters.priceMax) ? 1 : 0) +
    (filters.areaMin > 0 || Number.isFinite(filters.areaMax) ? 1 : 0);

  const handleOpenDetails = useCallback((propertyId: string) => router.push(`/property/${propertyId}/reel`), []);
  const handleToggleCompare = useCallback(
    (propertyId: string) => {
      const result = compareSelection.toggle(propertyId);
      if (result === "full") showToast(t(`تقدر تقارن حتى ${compareSelection.max} عقارات بس`));
    },
    [compareSelection, t]
  );
  const renderItem = useCallback(
    ({ item, index }: { item: Property; index: number }) => (
      <SearchResultCard
        item={item}
        index={index}
        isComparing={compareSelection.isSelected(item.id)}
        onOpenDetails={handleOpenDetails}
        onToggleCompare={handleToggleCompare}
      />
    ),
    [compareSelection, handleOpenDetails, handleToggleCompare]
  );

  return (
    <View style={styles.container}>
      <PageTopBar
        title="البحث"
        notifBadgeCount={notifications.totalUnread}
        onOpenNotifications={() => setNotifMenuVisible(true)}
      />

      <View style={styles.searchBar}>
        <View style={styles.inputWrap}>
          <View style={styles.inputIcon}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2}>
              <Circle cx={11} cy={11} r={7} /><Path d="M21 21l-4.3-4.3" />
            </Svg>
          </View>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={t("ابحث بالمنطقة، نوع العقار ...")}
            placeholderTextColor={themeColors.textSubtle}
          />
        </View>
        <Pressable
          style={[styles.geoBtn, geoPoint && styles.geoBtnActive]}
          onPress={() => setGeoModalVisible(true)}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={geoPoint ? "white" : "#22A652"} strokeWidth={2}>
            <Circle cx={12} cy={12} r={3} /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </Svg>
        </Pressable>
        <Pressable style={styles.filterBtn} onPress={() => setFilterModalVisible(true)}>
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <Path d="M4 6h16M7 12h10M10 18h4" />
          </Svg>
          <Text style={styles.filterBtnText}>{t("فلترة")}</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterCountBadge}><Text style={styles.filterCountText}>{activeFilterCount}</Text></View>
          )}
        </Pressable>
        <Pressable style={styles.alertBtn} onPress={() => setAlertModalVisible(true)}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#22A652" strokeWidth={2}>
            <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
          </Svg>
        </Pressable>
        <Pressable
          style={[styles.mapToggleBtn, viewMode === "map" && styles.mapToggleBtnActive]}
          onPress={() => setViewMode((v) => (v === "list" ? "map" : "list"))}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={viewMode === "map" ? "white" : "#22A652"} strokeWidth={2}>
            <Path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" /><Path d="M8 2v16M16 6v16" />
          </Svg>
        </Pressable>
      </View>

      {viewMode === "map" && (
        <View style={styles.mapToolbar}>
          <Pressable style={[styles.drawBtn, drawMode && styles.drawBtnActive]} onPress={toggleDrawMode}>
            <Text style={[styles.drawBtnText, drawMode && styles.drawBtnTextActive]}>
              {drawMode ? t(`تم الرسم (${drawnPoints.length} نقطة)`) : t("ارسم منطقة اهتمام")}
            </Text>
          </Pressable>
          {appliedPolygon && (
            <Pressable style={styles.drawClearBtn} onPress={clearPolygon}>
              <Text style={styles.drawClearBtnText}>{t("مسح المنطقة")}</Text>
            </Pressable>
          )}
        </View>
      )}

      {geoPoint && !appliedPolygon && (
        <View style={styles.geoIndicatorRow}>
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#22A652" strokeWidth={2}>
            <Circle cx={12} cy={12} r={3} /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </Svg>
          <Text style={styles.geoIndicatorText}>
            {t("البحث ضمن")} {geoPoint.radiusKm} {t("كم")} {t("من النقطة المحددة")}
          </Text>
          <Pressable onPress={() => setGeoPoint(null)} hitSlop={6}>
            <Text style={styles.geoIndicatorClear}>✕</Text>
          </Pressable>
        </View>
      )}
      {appliedPolygon && (
        <View style={styles.geoIndicatorRow}>
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#22A652" strokeWidth={2}>
            <Path d="M3 3l7 3 4-2 7 4v13l-7-4-4 2-7-3z" />
          </Svg>
          <Text style={styles.geoIndicatorText}>
            {t("البحث ضمن المنطقة المرسومة")} · {results.length} {t("نتيجة")}
          </Text>
          {/* ↔ إصلاح "مفيش طريقة توصل بيها للعقارات جوه المنطقة المرسومة":
              قبل كده بعد إنهاء الرسم كانت الشاشة بتفضل فى وضع الخريطة من
              غير أي زرار يوديك لعرض النتائج — فعليًا مفيش طريقة توصل بيها
              للعقارات. زرار "عرض النتائج" ده بيحوّل لوضع القائمة (نفس
              الاستخدام العادي المُجرَّب والشغّال، بيسمح بالدخول لأي عقار
              عادي)، وبيظهر بس والشاشة لسه فى وضع الخريطة (مفيش داعي له
              فى وضع القائمة أصلًا). */}
          {viewMode === "map" && results.length > 0 && (
            <Pressable style={styles.viewResultsBtn} onPress={() => setViewMode("list")} hitSlop={6}>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}>
                <Path d="M4 6h16M4 12h16M4 18h7" />
              </Svg>
              <Text style={styles.viewResultsBtnText}>{t("عرض النتائج")}</Text>
            </Pressable>
          )}
          <Pressable onPress={clearPolygon} hitSlop={6}>
            <Text style={styles.geoIndicatorClear}>✕</Text>
          </Pressable>
        </View>
      )}

      {viewMode === "map" ? (
        <PropertiesMapView
          properties={results}
          initialRegion={mapRegion}
          drawMode={drawMode}
          polygonPoints={drawMode ? drawnPoints : appliedPolygon ?? undefined}
          onMapPress={(point: LatLng) => setDrawnPoints((prev) => [...prev, point])}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10, paddingHorizontal: 14 }}
          contentContainerStyle={{ gap: 10, paddingTop: 10, paddingBottom: 110 }}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            (adBanners && adBanners.length > 0) || featuredSponsor ? (
              <View style={{ gap: 10, paddingHorizontal: 14, marginBottom: 4 }}>
                {adBanners && adBanners.length > 0 && <AdBannerCarousel banners={adBanners} />}
                {featuredSponsor && (
                  <Pressable
                    style={styles.sponsoredCard}
                    onPress={() => setOpenSponsoredAd(featuredSponsor)}
                  >
                    <Image
                      source={{ uri: cldThumbnail(featuredSponsor.property.coverImage ?? "") }}
                      style={styles.sponsoredCardImg}
                      contentFit="cover"
                      transition={150}
                    />
                    <View style={styles.sponsoredCardOverlay}>
                      <Text style={styles.sponsoredBadge}>{t("إعلان ممول")}</Text>
                      <Text style={styles.sponsoredCardTitle} numberOfLines={1}>{featuredSponsor.property.title}</Text>
                    </View>
                  </Pressable>
                )}
              </View>
            ) : null
          }
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color="#22A652" style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            isLoading ? (
              <ActivityIndicator color="#22A652" style={{ marginTop: 60 }} />
            ) : (
              <View style={styles.empty}>
                <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={1.5}>
                  <Circle cx={11} cy={11} r={7} /><Path d="M21 21l-4.3-4.3" />
                </Svg>
                <Text style={styles.emptyText}>{t("لا توجد نتائج")}</Text>
              </View>
            )
          }
          renderItem={renderItem}
        />
      )}

      <SearchFilterModal
        visible={filterModalVisible}
        value={filters}
        onApply={setFilters}
        onClose={() => setFilterModalVisible(false)}
      />

      <SaveAlertModal
        visible={alertModalVisible}
        onClose={() => setAlertModalVisible(false)}
        filters={filters}
        onSave={(finishType) => createAlert({
          province: filters.provinces.length === 1 ? filters.provinces[0] : null,
          type: filters.type,
          priceMax: filters.priceMax,
          finishType,
        })}
      />

      <GeoSearchModal
        visible={geoModalVisible}
        value={geoPoint}
        onApply={setGeoPoint}
        onClose={() => setGeoModalVisible(false)}
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

      <SponsoredAdReelModal
        property={openSponsoredAd?.property ?? null}
        sponsoredReelId={openSponsoredAd?.reelId}
        onClose={() => setOpenSponsoredAd(null)}
      />
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    sponsoredCard: { height: 90, borderRadius: 14, overflow: "hidden", backgroundColor: themeColors.surface },
    sponsoredCardImg: { ...StyleSheet.absoluteFillObject },
    sponsoredCardOverlay: {
      position: "absolute", left: 0, right: 0, bottom: 0, padding: 10,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    sponsoredBadge: {
      alignSelf: "flex-start", backgroundColor: "#22A652", color: "white", fontSize: 10, fontWeight: "900",
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginBottom: 4, overflow: "hidden",
    },
    sponsoredCardTitle: { color: "white", fontSize: 13, fontWeight: "800" },
    searchBar: { flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
    inputWrap: { flex: 1, position: "relative", justifyContent: "center" },
    inputIcon: { position: "absolute", left: 12, zIndex: 1 },
    input: { backgroundColor: themeColors.surface, borderRadius: 12, paddingVertical: 10, paddingLeft: 34, paddingRight: 12, fontSize: 13, color: themeColors.text },
    filterBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#22A652", borderRadius: 12, paddingHorizontal: 14, position: "relative" },
    filterBtnText: { color: "white", fontSize: 12, fontWeight: "900" },
    alertBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ecfdf5", alignItems: "center", justifyContent: "center" },
    mapToggleBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ECFDF5", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#22A652" },
    mapToggleBtnActive: { backgroundColor: "#22A652" },
    mapToolbar: { flexDirection: "row", gap: 8, paddingHorizontal: 14, marginBottom: 8 },
    drawBtn: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 10, backgroundColor: themeColors.card, borderWidth: 1, borderColor: "#22A652" },
    drawBtnActive: { backgroundColor: "#22A652" },
    drawBtnText: { fontSize: 12, fontWeight: "800", color: "#22A652" },
    drawBtnTextActive: { color: "white" },
    drawClearBtn: { alignItems: "center", justifyContent: "center", paddingHorizontal: 14, borderRadius: 10, backgroundColor: themeColors.isDark ? "rgba(239,68,68,0.15)" : "#fef2f2" },
    drawClearBtnText: { fontSize: 12, fontWeight: "800", color: "#ef4444" },
    geoBtn: { width: 40, alignItems: "center", justifyContent: "center", backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ECFDF5", borderRadius: 12, borderWidth: 1, borderColor: "#22A652" },
    geoBtnActive: { backgroundColor: "#22A652" },
    geoIndicatorRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ECFDF5", marginHorizontal: 14, marginBottom: 8, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 },
    geoIndicatorText: { flex: 1, fontSize: 11, fontWeight: "800", color: themeColors.isDark ? "#6EE7B7" : "#065F46" },
    geoIndicatorClear: { color: themeColors.isDark ? "#6EE7B7" : "#065F46", fontSize: 13, fontWeight: "900" },
    viewResultsBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
    viewResultsBtnText: { color: "white", fontSize: 10.5, fontWeight: "900" },
    filterCountBadge: { position: "absolute", top: -6, right: -6, backgroundColor: "#ef4444", borderRadius: 999, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: themeColors.background },
    filterCountText: { color: "white", fontSize: 9.5, fontWeight: "900" },
    empty: { alignItems: "center", paddingTop: 70, gap: 10 },
    emptyText: { fontSize: 14, fontWeight: "900", color: themeColors.textMuted },
    card: { flex: 1, backgroundColor: themeColors.card, borderRadius: 14, overflow: "hidden" },
    cardMedia: { height: 120, position: "relative" },
    purposeBadge: { position: "absolute", top: 8, right: 8, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 },
    compareBadge: {
      position: "absolute", top: 8, left: 8, width: 26, height: 26, borderRadius: 8,
      backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center",
    },
    compareBadgeActive: { backgroundColor: "#22A652" },
    purposeBadgeText: { color: "white", fontSize: 9.5, fontWeight: "900" },
    cardInfo: { padding: 10 },
    cardType: { fontSize: 10.5, fontWeight: "800", color: themeColors.textSubtle, marginBottom: 3 },
    cardPrice: { fontSize: 13.5, fontWeight: "900", color: "#22A652", marginBottom: 4 },
    cardLocation: { fontSize: 10.5, color: themeColors.textSubtle, marginBottom: 6 },
    cardMetaRow: { flexDirection: "row", gap: 8 },
    cardMeta: { fontSize: 10, fontWeight: "800", color: themeColors.textMuted },
  });
}