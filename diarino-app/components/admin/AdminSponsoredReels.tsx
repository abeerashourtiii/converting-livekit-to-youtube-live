import { useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, FlatList, Alert, Switch } from "react-native";
import { useAllSponsoredReels, useSponsoredReelMutations } from "../../lib/hooks/useSponsoredReels";
import { useAdminDB } from "../../lib/hooks/useAdminDB";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

const GENDERS: { key: "all" | "male" | "female"; label: string }[] = [
  { key: "all", label: "الكل" }, { key: "male", label: "ذكور" }, { key: "female", label: "إناث" },
];

// ↔ full management of featured reel ads: which listing is promoted, as
// an intro reel (shown first on a fresh app entry) or a featured reel
// inserted periodically while browsing, a reach goal, and targeting
// (age range / gender). IMPORTANT — stated to the admin here too, not
// just in the migration comment: age/gender targeting isn't enforced,
// since the app collects no age/gender data on users to match against.
// Reach itself IS real (increments on every actual impression).
export function AdminSponsoredReels() {
  const { data: sponsored = [] } = useAllSponsoredReels();
  const { create, toggleActive, remove } = useSponsoredReelMutations();
  const db = useAdminDB(); // reuse the already-fetched reels list to pick a listing by title
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placement, setPlacement] = useState<"intro" | "in_feed">("in_feed");
  const [reachGoal, setReachGoal] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [gender, setGender] = useState<"all" | "male" | "female">("all");

  const matches = query.trim().length >= 2 ? db.reels.filter((r) => r.title.includes(query.trim())).slice(0, 6) : [];
  const selected = db.reels.find((r) => r.id === selectedId);

  function addSponsored() {
    if (!selectedId) return;
    create.mutate({
      propertyId: selectedId, placement,
      reachGoal: reachGoal ? Number(reachGoal) : undefined,
      ageMin: ageMin ? Number(ageMin) : undefined,
      ageMax: ageMax ? Number(ageMax) : undefined,
      genderTarget: gender,
    });
    setSelectedId(null); setQuery(""); setReachGoal(""); setAgeMin(""); setAgeMax(""); setGender("all"); setPlacement("in_feed");
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>ترويج ريل جديد</Text>
        <TextInput style={styles.input} placeholder="ابحث عن الإعلان بالعنوان..." placeholderTextColor={themeColors.textSubtle} value={query} onChangeText={(v) => { setQuery(v); setSelectedId(null); }} />
        {!selected && matches.map((m) => (
          <Pressable key={m.id} style={styles.searchResultRow} onPress={() => { setSelectedId(m.id); setQuery(m.title); }}>
            <Text style={styles.searchResultText} numberOfLines={1}>{m.title}</Text>
          </Pressable>
        ))}

        {selected && (
          <View style={{ marginTop: 10, gap: 10 }}>
            <View style={styles.placementRow}>
              <Pressable style={[styles.placementBtn, placement === "intro" && styles.placementBtnActive]} onPress={() => setPlacement("intro")}>
                <Text style={[styles.placementBtnText, placement === "intro" && styles.placementBtnTextActive]}>ريل افتتاحي</Text>
              </Pressable>
              <Pressable style={[styles.placementBtn, placement === "in_feed" && styles.placementBtnActive]} onPress={() => setPlacement("in_feed")}>
                <Text style={[styles.placementBtnText, placement === "in_feed" && styles.placementBtnTextActive]}>مميز أثناء التصفح</Text>
              </Pressable>
            </View>

            <TextInput style={styles.input} placeholder="هدف الوصول (reach) — عدد المشاهدين" placeholderTextColor={themeColors.textSubtle} keyboardType="number-pad" value={reachGoal} onChangeText={setReachGoal} />

            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="أقل عمر" placeholderTextColor={themeColors.textSubtle} keyboardType="number-pad" value={ageMin} onChangeText={setAgeMin} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="أكبر عمر" placeholderTextColor={themeColors.textSubtle} keyboardType="number-pad" value={ageMax} onChangeText={setAgeMax} />
            </View>
            <Text style={styles.disclaimer}>
              ⚠️ استهداف العمر/النوع غير مُفعّل فعليًا — التطبيق لا يجمع بيانات عمر أو نوع للمستخدمين حاليًا، فهذا الحقل للتسجيل فقط.
            </Text>

            <View style={styles.placementRow}>
              {GENDERS.map((g) => (
                <Pressable key={g.key} style={[styles.placementBtn, gender === g.key && styles.placementBtnActive]} onPress={() => setGender(g.key)}>
                  <Text style={[styles.placementBtnText, gender === g.key && styles.placementBtnTextActive]}>{g.label}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.addBtn} onPress={addSponsored} disabled={create.isPending}>
              <Text style={styles.addBtnText}>{create.isPending ? "جاري الترويج..." : "ترويج هذا الريل"}</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>الريلز المميزة الحالية ({sponsored.length})</Text>
        <FlatList
          data={sponsored}
          keyExtractor={(s) => s.id}
          scrollEnabled={false}
          ListEmptyComponent={<Text style={styles.emptyText}>لا توجد ريلز مروّجة حاليًا</Text>}
          renderItem={({ item }) => {
            const reel = db.reels.find((r) => r.id === item.propertyId);
            return (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{reel?.title || "إعلان محذوف"}</Text>
                  <Text style={styles.rowMeta}>
                    {item.placement === "intro" ? "افتتاحي" : "مميز أثناء التصفح"} ·
                    الوصول: {item.currentReach}{item.reachGoal ? ` / ${item.reachGoal}` : ""}
                  </Text>
                </View>
                <Switch value={item.active} onValueChange={(v) => toggleActive.mutate({ id: item.id, active: v })} />
                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => Alert.alert("إلغاء الترويج؟", "", [
                    { text: "إلغاء", style: "cancel" },
                    { text: "حذف", style: "destructive", onPress: () => remove.mutate(item.id) },
                  ])}
                >
                  <Text style={styles.deleteBtnText}>حذف</Text>
                </Pressable>
              </View>
            );
          }}
        />
      </View>
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    card: { backgroundColor: themeColors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: themeColors.border },
    cardTitle: { fontSize: 13, fontWeight: "900", color: themeColors.text, marginBottom: 10 },
    input: { borderWidth: 1, borderColor: themeColors.border, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, fontSize: 12.5, marginBottom: 8, color: themeColors.text },
    searchResultRow: { paddingVertical: 8, paddingHorizontal: 10, backgroundColor: themeColors.surface, borderRadius: 8, marginBottom: 4 },
    searchResultText: { fontSize: 12.5, fontWeight: "700", color: themeColors.textMuted },
    placementRow: { flexDirection: "row", gap: 8 },
    placementBtn: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 8, backgroundColor: themeColors.surface },
    placementBtnActive: { backgroundColor: "#6366f1" },
    placementBtnText: { fontSize: 11.5, fontWeight: "800", color: themeColors.textSubtle },
    placementBtnTextActive: { color: "white" },
    disclaimer: { fontSize: 10.5, color: themeColors.isDark ? "#FBBF24" : "#b45309", backgroundColor: themeColors.isDark ? "rgba(180,83,9,0.18)" : "#fffbeb", borderRadius: 8, padding: 8, lineHeight: 15 },
    addBtn: { backgroundColor: "#6366f1", borderRadius: 999, paddingVertical: 11, alignItems: "center" },
    addBtnText: { color: "white", fontWeight: "900", fontSize: 12.5 },
    emptyText: { textAlign: "center", color: themeColors.textSubtle, fontSize: 12, paddingVertical: 16 },
    row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: themeColors.border },
    rowTitle: { fontSize: 12.5, fontWeight: "800", color: themeColors.text },
    rowMeta: { fontSize: 10.5, color: themeColors.textSubtle, marginTop: 2 },
    deleteBtn: { backgroundColor: themeColors.isDark ? "rgba(239,68,68,0.15)" : "#FEF2F2", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
    deleteBtnText: { color: "#991B1B", fontWeight: "900", fontSize: 11 },
  });
}
