import { useMemo } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View, Text, Pressable, ScrollView, StyleSheet, Share } from "react-native";
import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import { usePropertiesByIds } from "../lib/hooks/useProperties";
import { fmtPrice, Property } from "../lib/types";
import { useCompareSelection } from "../lib/hooks/useCompareSelection";
import { useLanguage } from "../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../lib/hooks/useThemeColors";
import { cldThumbnail } from "../lib/cloudinary";

const ROW_HEIGHT = 44;
const COLUMN_WIDTH = 150;
const LABEL_WIDTH = 110;

type Row = { key: string; label: string; get: (p: Property) => string };

const ROWS: Row[] = [
  { key: "purpose", label: "الغرض", get: (p) => (p.purpose === "sale" ? "بيع" : "إيجار") },
  { key: "type", label: "النوع", get: (p) => p.type },
  { key: "price", label: "السعر", get: (p) => `${fmtPrice(p.price)} ج.م` },
  { key: "area", label: "المساحة", get: (p) => `${p.area} م²` },
  { key: "rooms", label: "الغرف", get: (p) => String(p.rooms ?? "-") },
  { key: "baths", label: "الحمامات", get: (p) => String(p.baths ?? "-") },
  { key: "reception", label: "الريسبشن", get: (p) => String(p.reception ?? "-") },
  { key: "floor", label: "الدور", get: (p) => (p.floor != null ? String(p.floor) : "-") },
  { key: "finishType", label: "التشطيب", get: (p) => p.finishType || "-" },
  { key: "payment", label: "طريقة الدفع", get: (p) => (p.payment === "installment" ? "تقسيط" : "كاش") },
  { key: "status", label: "الحالة", get: (p) => (p.status === "ready" ? "جاهز" : p.status === "building" ? "تحت الإنشاء" : "-") },
  { key: "location", label: "الموقع", get: (p) => `${p.province} - ${p.location}` },
  { key: "features", label: "الخدمات", get: (p) => (p.features?.length ? `${p.features.length} خدمة` : "-") },
  { key: "views", label: "المشاهدات", get: (p) => p.views.toLocaleString("ar-EG") },
  { key: "likes", label: "الإعجابات", get: (p) => p.likes.toLocaleString("ar-EG") },
];

// ↔ "مقارنة العقارات جنبًا إلى جنب" — reads the ids from the query string
// (?ids=a,b,c, either from CompareBar's "قارن الآن" or a shared link) and
// renders them as a real comparison table: a frozen label column on the
// left + a horizontally-scrollable column per property, both wrapped in
// one vertical ScrollView so the whole table scrolls together if it runs
// past the screen height. usePropertiesByIds is the same bounded
// by-id fetch built for the reels feed's sponsored-reel lookup — reused
// here instead of needing a new query.
export default function CompareScreen() {
  const { ids: idsParam } = useLocalSearchParams<{ ids?: string }>();
  const { t } = useLanguage();
  const { toggle } = useCompareSelection();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  const ids = useMemo(() => (idsParam ? idsParam.split(",").filter(Boolean) : []), [idsParam]);
  const { data: properties, isLoading } = usePropertiesByIds(ids);

  // ↔ keep the comparison in the order the person picked them, not
  // whatever order the DB happens to return.
  const ordered = useMemo(() => {
    if (!properties) return [];
    const byId = new Map(properties.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is Property => !!p);
  }, [properties, ids]);

  function removeFromCompare(propertyId: string) {
    toggle(propertyId); // already selected, so this removes it
    const remaining = ids.filter((id) => id !== propertyId);
    if (remaining.length === 0) { router.back(); return; }
    router.setParams({ ids: remaining.join(",") });
  }

  function shareComparison() {
    Share.share({ message: `قارن العقارات دي على ديارينو:\nhttps://diarino.app/compare?ids=${ids.join(",")}` });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()} hitSlop={8}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={themeColors.text} strokeWidth={2}>
            <Path d="M18 6L6 18M6 6l12 12" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>{t("مقارنة العقارات")}</Text>
        <Pressable style={styles.iconBtn} onPress={shareComparison} hitSlop={8}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={themeColors.text} strokeWidth={2}>
            <Path d="M4 12v6a2 2 0 002 2h12a2 2 0 002-2v-6M16 6l-4-4-4 4M12 2v14" />
          </Svg>
        </Pressable>
      </View>

      {isLoading ? (
        <Text style={styles.empty}>{t("جاري التحميل...")}</Text>
      ) : ordered.length === 0 ? (
        <Text style={styles.empty}>{t("مفيش عقارات للمقارنة")}</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ flexDirection: "row" }}>
            {/* frozen label column */}
            <View style={{ width: LABEL_WIDTH }}>
              <View style={[styles.cell, styles.cornerCell, { height: 140 }]} />
              {ROWS.map((r) => (
                <View key={r.key} style={[styles.cell, styles.labelCell]}>
                  <Text style={styles.labelText}>{t(r.label)}</Text>
                </View>
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row" }}>
                {ordered.map((p) => (
                  <View key={p.id} style={{ width: COLUMN_WIDTH }}>
                    <Pressable
                      style={[styles.cell, styles.headerCell, { height: 140 }]}
                      onPress={() => router.push(`/property/${p.id}`)}
                    >
                      <Pressable style={styles.removeBtn} onPress={() => removeFromCompare(p.id)} hitSlop={6}>
                        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
                          <Path d="M18 6L6 18M6 6l12 12" />
                        </Svg>
                      </Pressable>
                      {p.coverImage ? (
                        <Image source={{ uri: cldThumbnail(p.coverImage) }} style={styles.thumb} contentFit="cover" transition={150} />
                      ) : (
                        <View style={[styles.thumb, { backgroundColor: themeColors.surface }]} />
                      )}
                      <Text style={styles.propTitle} numberOfLines={2}>{p.shortTitle || p.title}</Text>
                    </Pressable>
                    {ROWS.map((r) => (
                      <View key={r.key} style={[styles.cell, styles.valueCell]}>
                        <Text style={styles.valueText} numberOfLines={1}>{t(r.get(p))}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingTop: 54, paddingBottom: 14,
      borderBottomWidth: 1, borderBottomColor: themeColors.border,
    },
    iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: themeColors.surface, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 15, fontWeight: "900", color: themeColors.text },
    empty: { textAlign: "center", color: themeColors.textSubtle, marginTop: 60, fontSize: 13 },
    cell: { height: ROW_HEIGHT, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: themeColors.border },
    cornerCell: { backgroundColor: themeColors.background },
    labelCell: { paddingHorizontal: 10, backgroundColor: themeColors.surface },
    labelText: { fontSize: 11.5, color: themeColors.textSubtle, fontWeight: "700" },
    headerCell: { alignItems: "center", paddingTop: 8, paddingHorizontal: 8, gap: 6, borderRightWidth: 1, borderRightColor: themeColors.border },
    thumb: { width: 64, height: 64, borderRadius: 10 },
    propTitle: { fontSize: 11, fontWeight: "800", color: themeColors.text, textAlign: "center" },
    removeBtn: {
      position: "absolute", top: 4, left: 4, width: 20, height: 20, borderRadius: 10,
      backgroundColor: "rgba(17,24,39,0.6)", alignItems: "center", justifyContent: "center", zIndex: 1,
    },
    valueCell: { alignItems: "center", borderRightWidth: 1, borderRightColor: themeColors.border },
    valueText: { fontSize: 12, color: themeColors.text, fontWeight: "700" },
  });
}
