import { useMemo, useRef, useState } from "react";
import {
  Modal, View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  Animated, PanResponder,
} from "react-native";
import { PROVINCES, regionsForProvince } from "../../data/locations";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

// ↔ modal-reel-filter / reelFilterBox / setupFilterSwipeDismiss() /
// renderRlfProvinceChips() / renderRlfRegionChips() in app-viewer.html.
// Drag-down-to-dismiss threshold (110px) and spring-back match the original.

export type ReelFilter = { provinces: string[]; regions: string[] };

type Props = {
  visible: boolean;
  value: ReelFilter;
  onApply: (filter: ReelFilter) => void;
  onClose: () => void;
};

const DISMISS_THRESHOLD = 110;

export function ReelFilterModal({ visible, value, onApply, onClose }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const [provinces, setProvinces] = useState<string[]>(value.provinces);
  const [regions, setRegions] = useState<string[]>(value.regions);
  const [query, setQuery] = useState("");

  const translateY = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      // ↔ إصلاح "السحب-للإغلاق مش شغّال فى كل منطقة داخل اللوحة": كان
      // onMoveShouldSetPanResponder بس (مرحلة "bubble" العادية)، وده
      // معناه إن أي عنصر تفاعلي جوه اللوحة (خانة البحث، شريط تمرير
      // المناطق الأفقي) بياخد فرصته ياخد اللمسة لنفسه الأول، فالسحب
      // كان بيشتغل بس فى المناطق الفاضية (زي العنوان أو المسافات
      // بين الصفوف)، مش فى أي منطقة فعليًا. الحل: نستخدم مرحلة
      // "capture" كمان (بتتنفّذ قبل أي عنصر جواها ياخد اللمسة لنفسه)،
      // بس بشرط إن الحركة تبقى عمودية لأسفل بوضوح (|dy| أكبر من |dx|)
      // عشان السحب الأفقي لشرائح المناطق يفضل شغّال طبيعي 100%.
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 6 && g.dy > 0 && Math.abs(g.dy) > Math.abs(g.dx),
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && g.dy > 0,
      onPanResponderMove: (_, g) => {
        if (g.dy < 0) return;
        translateY.setValue(g.dy);
        backdropOpacity.setValue(Math.max(0, 1 - g.dy / 500));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD) {
          Animated.timing(translateY, { toValue: 600, duration: 220, useNativeDriver: true }).start(() => {
            resetSheet();
            onClose();
          });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
          Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  function resetSheet() {
    translateY.setValue(0);
    backdropOpacity.setValue(1);
  }

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    return PROVINCES.filter((p) => p.includes(query.trim()) && !provinces.includes(p)).slice(0, 6);
  }, [query, provinces]);

  function addProvince(pv: string) {
    if (!provinces.includes(pv)) setProvinces((prev) => [...prev, pv]);
    setQuery("");
  }
  function removeProvince(pv: string) {
    setProvinces((prev) => prev.filter((p) => p !== pv));
  }

  // ↔ renderRlfRegionChips() — region chips only show when exactly one province is selected
  const availableRegions = provinces.length === 1 ? regionsForProvince(provinces[0]) : [];

  function toggleRegion(r: string) {
    setRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  function reset() {
    setProvinces([]);
    setRegions([]);
    onApply({ provinces: [], regions: [] });
    onClose();
  }

  function apply() {
    onApply({ provinces, regions: provinces.length === 1 ? regions : [] });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
        <View style={styles.dragHandle} />
        <Text style={styles.title}>{t("فلترة الريلز حسب المحافظة")}</Text>

        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={t("ابحث عن محافظة...")}
          placeholderTextColor={themeColors.textSubtle}
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

        <View style={styles.chipsRow}>
          {provinces.map((pv) => (
            <Pressable key={pv} style={styles.chipActive} onPress={() => removeProvince(pv)}>
              <Text style={styles.chipActiveText}>{t(pv)} ×</Text>
            </Pressable>
          ))}
        </View>

        {availableRegions.length > 0 && (
          <>
            <Text style={styles.subtitle}>{t("المناطق")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={styles.chipsRow}>
                <Pressable
                  style={regions.length === 0 ? styles.chipActive : styles.chip}
                  onPress={() => setRegions([])}
                >
                  <Text style={regions.length === 0 ? styles.chipActiveText : styles.chipText}>{t("الكل")}</Text>
                </Pressable>
                {availableRegions.map((r) => (
                  <Pressable
                    key={r}
                    style={regions.includes(r) ? styles.chipActive : styles.chip}
                    onPress={() => toggleRegion(r)}
                  >
                    <Text style={regions.includes(r) ? styles.chipActiveText : styles.chipText}>{t(r)}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </>
        )}

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

// ↔ قاعدة تثيم الوسائط: القائمة دي Sheet كامل بخلفية عتمة خاصة بيه —
// مش مرسومة على الفيديو مباشرة — فتتبع الثيم بأمان.
function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: {
      position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: themeColors.card,
      borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 28, maxHeight: "75%",
    },
    dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: themeColors.border, alignSelf: "center", marginBottom: 14 },
    title: { fontSize: 15, fontWeight: "900", color: themeColors.text, marginBottom: 12 },
    subtitle: { fontSize: 12, fontWeight: "800", color: themeColors.textSubtle, marginBottom: 8, marginTop: 4 },
    input: { backgroundColor: themeColors.surface, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 13, color: themeColors.text },
    suggestionBox: { backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.border, borderRadius: 10, marginTop: 4, overflow: "hidden" },
    suggestionRow: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: themeColors.border },
    suggestionText: { fontSize: 13, color: themeColors.textMuted, fontWeight: "700" },
    chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
    chip: { backgroundColor: themeColors.surface, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
    chipText: { fontSize: 11.5, fontWeight: "800", color: themeColors.textMuted },
    chipActive: { backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
    chipActiveText: { fontSize: 11.5, fontWeight: "800", color: "white" },
    actionsRow: { flexDirection: "row", gap: 10, marginTop: 20 },
    resetBtn: { flex: 1, borderRadius: 999, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: themeColors.border },
    resetBtnText: { fontSize: 13, fontWeight: "900", color: themeColors.textMuted },
    applyBtn: { flex: 1, borderRadius: 999, paddingVertical: 13, alignItems: "center", backgroundColor: "#22A652" },
    applyBtnText: { fontSize: 13, fontWeight: "900", color: "white" },
  });
}
