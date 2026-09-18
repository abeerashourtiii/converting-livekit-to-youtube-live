import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Link } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { Property, fmtPrice } from "../../lib/types";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";
import { PropertyLocationMap } from "./PropertyLocationMap";

// ↔ استخرجت من app/property/[id].tsx الأصلية عشان تتستخدم مرتين: فى
// الصفحة الكاملة (نفس مكانها زي ما كانت)، وفى لوحة التفاصيل المصغّرة
// اللي بتنفتح من الريلز (components/reel/ReelDetailsSheet.tsx) — بدل ما
// نكرر نفس الكود مرتين. مفيهاش الغلاف/CTA bar لأن دول مختلفين شكلًا بين
// السياقين (الصفحة الكاملة عندها cover بارتفاع ثابت، واللوحة المصغّرة
// بيبقى الريل نفسه هو "الغلاف" اللي فوقها).
export function PropertyDetailsContent({ property }: { property: Property }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"desc" | "amenities" | "plan">("desc");
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  return (
    <View style={styles.content}>
      <View style={styles.row}>
        <View style={[styles.purposeTag, { backgroundColor: property.purpose === "sale" ? "#22A652" : "#F4673F" }]}>
          <Text style={styles.purposeTagText}>{property.purpose === "sale" ? t("للبيع") : t("للإيجار")}</Text>
        </View>
        <Text style={styles.typeText}>{t(property.type)}</Text>
      </View>

      <Text style={styles.title}>{t(property.title)}</Text>
      <Text style={styles.location}>📍 {t(property.location)}، {t(property.province)}</Text>
      <Text style={styles.price}>
        {fmtPrice(property.price)} ج.م {property.purpose === "rent" ? "/ شهر" : ""}
      </Text>

      <View style={styles.specsGrid}>
        {!!property.rooms && <Spec icon="🛏" label={`${property.rooms} غرف`} />}
        {!!property.baths && <Spec icon="🛁" label={`${property.baths} حمام`} />}
        {!!property.reception && <Spec icon="🛋" label={`${property.reception} ريسبشن`} />}
        <Spec icon="📐" label={`${property.area} م²`} />
      </View>

      <View style={styles.tabsRow}>
        <TabBtn
          active={activeTab === "desc"}
          label="الوصف"
          icon={<DescIcon active={activeTab === "desc"} />}
          onPress={() => setActiveTab("desc")}
        />
        <TabBtn
          active={activeTab === "amenities"}
          label="المرافق والكماليات"
          icon={<AmenitiesIcon active={activeTab === "amenities"} />}
          onPress={() => setActiveTab("amenities")}
        />
        <TabBtn
          active={activeTab === "plan"}
          label="المخطط"
          icon={<PlanIcon active={activeTab === "plan"} />}
          onPress={() => setActiveTab("plan")}
        />
      </View>

      <View style={styles.tabContent}>
        {activeTab === "desc" && (
          <>
            <Text style={styles.description}>
              {property.description ? t(property.description) : t("لا يوجد وصف مضاف لهذا العقار")}
            </Text>
            {/* ↔ #2: "اضافة امكانية معرفة الموقع الجغرافى اسفل الوصف" */}
            <PropertyLocationMap
              lat={property.lat}
              lng={property.lng}
              address={`${t(property.location)}، ${t(property.province)}`}
            />
          </>
        )}
        {activeTab === "amenities" && (
          property.features.length > 0 ? (
            <View style={styles.featuresRow}>
              {property.features.map((f) => (
                <View key={f} style={styles.featureChip}><Text style={styles.featureChipText}>{t(f)}</Text></View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyTabText}>{t("لا توجد مرافق أو كماليات مضافة لهذا العقار")}</Text>
          )
        )}
        {activeTab === "plan" && (
          // ↔ no floor-plan field exists on Property yet (no
          // migration/upload path for one) — an honest empty state
          // rather than a fake placeholder blueprint image.
          <Text style={styles.emptyTabText}>{t("لا يوجد مخطط متاح لهذا العقار حاليًا")}</Text>
        )}
      </View>

      <Link href={`/seller/${property.seller.id}`} asChild>
        <Pressable style={styles.sellerCard}>
          <View style={styles.sellerAvatar}><Text style={styles.sellerAvatarText}>{property.seller.initial}</Text></View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={styles.sellerName}>{t(property.seller.name)}</Text>
              {property.seller.verified && <Text style={{ color: "#22A652" }}>✓</Text>}
            </View>
            <Text style={styles.sellerMeta}>{property.seller.listings} إعلان · {property.seller.followers} متابع</Text>
          </View>
          <Text style={styles.sellerArrow}>‹</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function Spec({ icon, label }: { icon: string; label: string }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <View style={styles.specItem}>
      <Text style={styles.specIcon}>{icon}</Text>
      <Text style={styles.specLabel}>{t(label)}</Text>
    </View>
  );
}

function TabBtn({ active, label, icon, onPress }: { active: boolean; label: string; icon: React.ReactNode; onPress: () => void }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <Pressable style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress}>
      {icon}
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]} numberOfLines={1}>{t(label)}</Text>
    </Pressable>
  );
}

function DescIcon({ active }: { active: boolean }) {
  const c = active ? "#22A652" : "#6b7280";
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2}>
      <Path d="M6 2h9l5 5v15a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z" strokeLinejoin="round" />
      <Path d="M15 2v5h5" strokeLinejoin="round" />
      <Path d="M8 13h8M8 17h5" strokeLinecap="round" />
    </Svg>
  );
}

function AmenitiesIcon({ active }: { active: boolean }) {
  const c = active ? "#22A652" : "#6b7280";
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2}>
      <Path d="M4 6h2M9 6h11" strokeLinecap="round" />
      <Path d="M4 12h2M9 12h11" strokeLinecap="round" />
      <Path d="M4 18h2M9 18h11" strokeLinecap="round" />
    </Svg>
  );
}

function PlanIcon({ active }: { active: boolean }) {
  const c = active ? "#22A652" : "#6b7280";
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2}>
      <Path d="M3 3h18v18H3z" strokeLinejoin="round" />
      <Path d="M3 10h11M14 10v11M14 15h7" />
    </Svg>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    content: { padding: 18 },
    row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    purposeTag: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
    purposeTagText: { color: "white", fontSize: 10, fontWeight: "900" },
    typeText: { fontSize: 12, fontWeight: "800", color: themeColors.textSubtle },
    title: { fontSize: 18, fontWeight: "900", color: themeColors.text, marginBottom: 6 },
    location: { fontSize: 13, color: themeColors.textSubtle, marginBottom: 8 },
    price: { fontSize: 22, fontWeight: "900", color: "#22A652", marginBottom: 16 },
    specsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
    specItem: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: themeColors.surface, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
    specIcon: { fontSize: 14 },
    specLabel: { fontSize: 12, fontWeight: "800", color: themeColors.textMuted },
    featuresRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    featureChip: { backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ecfdf5", borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11 },
    featureChipText: { fontSize: 11, fontWeight: "800", color: themeColors.isDark ? "#4ADE80" : "#047857" },
    tabsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
    tabBtn: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 12, backgroundColor: themeColors.surface, borderWidth: 1, borderColor: themeColors.border },
    tabBtnActive: { backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ecfdf5", borderColor: "#22A652" },
    tabBtnText: { fontSize: 10, fontWeight: "800", color: themeColors.textSubtle, textAlign: "center" },
    tabBtnTextActive: { color: "#22A652" },
    tabContent: { marginBottom: 20, minHeight: 40 },
    emptyTabText: { fontSize: 12.5, color: themeColors.textSubtle, textAlign: "center", paddingVertical: 16 },
    description: { fontSize: 13, color: themeColors.textMuted, lineHeight: 21 },
    sellerCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: themeColors.surface, borderRadius: 14, padding: 14 },
    sellerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#22A652", alignItems: "center", justifyContent: "center" },
    sellerAvatarText: { color: "white", fontWeight: "900", fontSize: 17 },
    sellerName: { fontSize: 13.5, fontWeight: "900", color: themeColors.text },
    sellerMeta: { fontSize: 11, color: themeColors.textSubtle, marginTop: 2 },
    sellerArrow: { fontSize: 20, color: themeColors.textSubtle },
  });
}
