import { useMemo, useRef, useState } from "react";
import {
  Modal, View, Text, TextInput, Pressable, ScrollView, StyleSheet, Animated, PanResponder, NativeSyntheticEvent, NativeScrollEvent,
} from "react-native";
import { PROVINCES } from "../../data/locations";
import { RegionAutocompleteField } from "./RegionAutocompleteField";
import { useProvinceSuggestions, useRecordProvinceSearchAttempt } from "../../lib/hooks/useKnownProvinces";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

// ↔ modal-search-filter / state.searchFilters / renderSfProvinceChips() /
// renderSfRegionChips() in app-viewer.html.
// Deferred: geo-radius search (useGeo/userLat/userLng/geoRadiusKm) — needs
// its own location-permission gate, same pattern as PermissionGate for
// camera/mic, kept out of this pass on purpose rather than half-built.

export type SearchFilters = {
  purpose: "all" | "sale" | "rent";
  type: string;
  provinces: string[];
  regions: string[];
  priceMin: number;
  priceMax: number;
  areaMin: number;
  areaMax: number;
  minRooms: number;
};

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  purpose: "all", type: "all", provinces: [], regions: [],
  priceMin: 0, priceMax: Infinity, areaMin: 0, areaMax: Infinity, minRooms: 0,
};

const TYPES = ["all", "شقة", "فيلا", "بنتهاوس", "تاون هاوس", "تجاري", "إداري", "طبي", "أرض"];
const DISMISS_THRESHOLD = 110;

type Props = {
  visible: boolean;
  value: SearchFilters;
  onApply: (f: SearchFilters) => void;
  onClose: () => void;
};

export function SearchFilterModal({ visible, value, onApply, onClose }: Props) {
  const { t, language } = useLanguage();
  const [draft, setDraft] = useState<SearchFilters>(value);
  const [provinceQuery, setProvinceQuery] = useState("");
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  // ↔ "من"/"إلى" (خانات السعر والمساحة) عمدًا مش داخلين فى I18N_DICT
  // العام: هما حروف جر قصيرة جدًا وبيتكرروا كـ substring جوه جمل تانية
  // كتير فى التطبيق (زي "من فضلك")، فلو اتحطوا فى القاموس العام هيبوّظوا
  // ترجمة جمل تانية معاهم بالغلط. بديل مباشر وآمن هنا بس.
  const fromLabel = language === "en" ? "From" : "من";
  const toLabel = language === "en" ? "To" : "إلى";

  const translateY = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(1)).current;
  // ↔ #2: السحب لأسفل بيقفل المودال أصلًا (PanResponder تحت)، لكنه كان
  // مربوط على الـ Animated.View كله اللي فيه الـ ScrollView جواه — من
  // غير تتبّع موضع السكرول، أي سحبة لأسفل جوه المحتوى (حتى وأنت بتسكرول
  // عادي وسط القائمة) كانت ممكن تتنازع مع سكرول الـ ScrollView. دلوقتي
  // بيتفعّل بس لما السكرول يكون فى الأعلى تمامًا (scrollY <= 0) — تمامًا
  // زي سلوك أي bottom sheet قياسي (آي أو إس مثلاً): تقدر تسكرول عادي جوه
  // القائمة، وأول ما توصل لآخر نقطة فوق وتكمل تسحب لتحت تقفل الصفحة.
  const scrollYRef = useRef(0);
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
  };

  const panResponder = useRef(
    PanResponder.create({
      // ↔ إصلاح "السحب-للإغلاق مش شغّال فى كل منطقة داخل اللوحة": نفس
      // الإصلاح المطبَّق فعليًا فى ReelFilterModal.tsx — onMoveShouldSetPanResponder
      // لوحدها (مرحلة "bubble") كانت بتسيب أي عنصر تفاعلي جوه اللوحة
      // (خانات السعر/المساحة، شرائح الفلاتر) ياخد اللمسة لنفسه الأول.
      // إضافة مرحلة "capture" بتضمن إن السحب العمودي الواضح لأسفل (وإحنا
      // فى قمة المحتوى فعلًا) ياخد الأولوية من أي مكان.
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        scrollYRef.current <= 0 && g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onMoveShouldSetPanResponder: (_, g) => scrollYRef.current <= 0 && g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy < 0) return;
        translateY.setValue(g.dy);
        backdropOpacity.setValue(Math.max(0, 1 - g.dy / 500));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD) {
          Animated.timing(translateY, { toValue: 700, duration: 220, useNativeDriver: true }).start(() => {
            translateY.setValue(0);
            backdropOpacity.setValue(1);
            onClose();
          });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
          Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const rawSuggestions = useProvinceSuggestions(provinceQuery, t);
  const suggestions = useMemo(
    () => rawSuggestions.filter((p) => !draft.provinces.includes(p)),
    [rawSuggestions, draft.provinces]
  );
  const recordProvinceAttempt = useRecordProvinceSearchAttempt();
  // ↔ #3: لو مفيش أي اقتراح مطابق (لا من data/locations.ts ولا من
  // known_provinces) وفيه نص متكتوب فعلًا، بيظهر خيار "إضافة" — بيضيفها
  // كفلتر فورًا (سيتم البحث فى كل الأحوال، شوف fetchPropertiesPage) وفى
  // نفس الوقت بيسجّل محاولة بحث؛ أول ما توصل 3 محاولات (من أي مستخدم)
  // هتتحفظ كخيار دائم لكل الناس فى المرات الجاية.
  const showAddCustom = provinceQuery.trim().length > 0 && suggestions.length === 0 && !draft.provinces.includes(provinceQuery.trim());

  function addProvince(name: string) {
    const trimmed = name.trim();
    if (!trimmed || draft.provinces.includes(trimmed)) return;
    setDraft((d) => ({ ...d, provinces: [...d.provinces, trimmed] }));
    if (!PROVINCES.includes(trimmed)) recordProvinceAttempt.mutate(trimmed);
    setProvinceQuery("");
  }

  function reset() {
    setDraft(DEFAULT_SEARCH_FILTERS);
    onApply(DEFAULT_SEARCH_FILTERS);
    onClose();
  }
  function apply() {
    onApply(draft);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
        <View style={styles.dragHandle} />
        <ScrollView showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16}>
          <Text style={styles.section}>{t("الغرض")}</Text>
          <View style={styles.chipsRow}>
            {(["all", "sale", "rent"] as const).map((p) => (
              <Pressable
                key={p}
                style={draft.purpose === p ? styles.chipActive : styles.chip}
                onPress={() => setDraft((d) => ({ ...d, purpose: p }))}
              >
                <Text style={draft.purpose === p ? styles.chipActiveText : styles.chipText}>
                  {p === "all" ? t("الكل") : p === "sale" ? t("بيع") : t("إيجار")}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.section}>{t("نوع العقار")}</Text>
          <View style={styles.chipsRow}>
            {TYPES.map((ty) => (
              <Pressable
                key={ty}
                style={draft.type === ty ? styles.chipActive : styles.chip}
                onPress={() => setDraft((d) => ({ ...d, type: ty }))}
              >
                <Text style={draft.type === ty ? styles.chipActiveText : styles.chipText}>{ty === "all" ? t("الكل") : t(ty)}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.section}>{t("المحافظة")}</Text>
          <TextInput
            style={styles.input}
            value={provinceQuery}
            onChangeText={setProvinceQuery}
            onSubmitEditing={() => { if (showAddCustom) addProvince(provinceQuery); }}
            placeholder={t("ابحث عن محافظة...")}
            placeholderTextColor={themeColors.textSubtle}
            returnKeyType="done"
          />
          {suggestions.length > 0 && (
            <View style={styles.suggestionBox}>
              {suggestions.map((s) => (
                <Pressable key={s} style={styles.suggestionRow} onPress={() => addProvince(s)}>
                  <Text style={styles.suggestionText}>{t(s)}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {showAddCustom && (
            // ↔ #3: مفيش اقتراح مطابق — تقدر تضيف المحافظة اللي كتبتها
            // كما هي، وهيتم البحث عنها فورًا (حتى لو لسه ماوصلتش لعتبة
            // الحفظ الدائم فى قائمة الاقتراحات).
            <View style={styles.suggestionBox}>
              <Pressable style={styles.suggestionRow} onPress={() => addProvince(provinceQuery)}>
                <Text style={styles.suggestionTextNew}>{t("إضافة")} "{provinceQuery.trim()}"</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.chipsRow}>
            {draft.provinces.map((pv) => (
              <Pressable
                key={pv}
                style={styles.chipActive}
                onPress={() => setDraft((d) => ({ ...d, provinces: d.provinces.filter((x) => x !== pv) }))}
              >
                <Text style={styles.chipActiveText}>{t(pv)} ×</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.section}>{t("المنطقة")}</Text>
          <RegionAutocompleteField
            province={draft.provinces.length === 1 ? draft.provinces[0] : undefined}
            selected={draft.regions}
            onChange={(next) => setDraft((d) => ({ ...d, regions: next }))}
          />

          <Text style={styles.section}>{t("السعر (ج.م)")}</Text>
          <View style={styles.rangeRow}>
            <TextInput
              style={styles.rangeInput}
              keyboardType="number-pad"
              placeholder={fromLabel}
              placeholderTextColor={themeColors.textSubtle}
              value={draft.priceMin ? String(draft.priceMin) : ""}
              onChangeText={(v) => setDraft((d) => ({ ...d, priceMin: Number(v) || 0 }))}
            />
            <Text style={styles.rangeDash}>—</Text>
            <TextInput
              style={styles.rangeInput}
              keyboardType="number-pad"
              placeholder={toLabel}
              placeholderTextColor={themeColors.textSubtle}
              value={Number.isFinite(draft.priceMax) ? String(draft.priceMax) : ""}
              onChangeText={(v) => setDraft((d) => ({ ...d, priceMax: v ? Number(v) : Infinity }))}
            />
          </View>

          <Text style={styles.section}>{t("المساحة (م²)")}</Text>
          <View style={styles.rangeRow}>
            <TextInput
              style={styles.rangeInput}
              keyboardType="number-pad"
              placeholder={fromLabel}
              placeholderTextColor={themeColors.textSubtle}
              value={draft.areaMin ? String(draft.areaMin) : ""}
              onChangeText={(v) => setDraft((d) => ({ ...d, areaMin: Number(v) || 0 }))}
            />
            <Text style={styles.rangeDash}>—</Text>
            <TextInput
              style={styles.rangeInput}
              keyboardType="number-pad"
              placeholder={toLabel}
              placeholderTextColor={themeColors.textSubtle}
              value={Number.isFinite(draft.areaMax) ? String(draft.areaMax) : ""}
              onChangeText={(v) => setDraft((d) => ({ ...d, areaMax: v ? Number(v) : Infinity }))}
            />
          </View>

          <Text style={styles.section}>{t("الحد الأدنى للغرف")}</Text>
          <View style={styles.chipsRow}>
            {[0, 1, 2, 3, 4].map((n) => (
              <Pressable
                key={n}
                style={draft.minRooms === n ? styles.chipActive : styles.chip}
                onPress={() => setDraft((d) => ({ ...d, minRooms: n }))}
              >
                <Text style={draft.minRooms === n ? styles.chipActiveText : styles.chipText}>{n === 0 ? t("أي عدد") : `${n}+`}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={styles.actionsRow}>
          <Pressable style={styles.resetBtn} onPress={reset}>
            <Text style={styles.resetBtnText}>{t("إعادة تعيين")}</Text>
          </Pressable>
          <Pressable style={styles.applyBtn} onPress={apply}>
            <Text style={styles.applyBtnText}>{t("تطبيق")}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: {
      position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: themeColors.card,
      borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 24, maxHeight: "85%",
    },
    dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: themeColors.border, alignSelf: "center", marginBottom: 10 },
    section: { fontSize: 12, fontWeight: "900", color: themeColors.textMuted, marginTop: 14, marginBottom: 8 },
    input: { backgroundColor: themeColors.surface, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 13, color: themeColors.text },
    suggestionBox: { backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.border, borderRadius: 10, marginTop: 4, overflow: "hidden" },
    suggestionRow: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: themeColors.border },
    suggestionText: { fontSize: 13, color: themeColors.textMuted, fontWeight: "700" },
    suggestionTextNew: { fontSize: 13, color: "#22A652", fontWeight: "900" },
    chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { backgroundColor: themeColors.surface, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
    chipText: { fontSize: 11.5, fontWeight: "800", color: themeColors.textMuted },
    chipActive: { backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
    chipActiveText: { fontSize: 11.5, fontWeight: "800", color: "white" },
    rangeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    rangeInput: { flex: 1, backgroundColor: themeColors.surface, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 13, color: themeColors.text, textAlign: "center" },
    rangeDash: { color: themeColors.textSubtle },
    actionsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
    resetBtn: { flex: 1, borderRadius: 999, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: themeColors.border },
    resetBtnText: { fontSize: 13, fontWeight: "900", color: themeColors.textMuted },
    applyBtn: { flex: 1, borderRadius: 999, paddingVertical: 13, alignItems: "center", backgroundColor: "#22A652" },
    applyBtnText: { fontSize: 13, fontWeight: "900", color: "white" },
  });
}
