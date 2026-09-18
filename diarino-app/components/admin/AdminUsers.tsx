import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminDB, toggleUserActive, toggleUserPerm } from "../../lib/hooks/useAdminDB";
import { AdminUser } from "../../data/mock-admin";
import { useIsAdmin } from "../../lib/hooks/useIsAdmin";
import { supabase } from "../../lib/supabase";
import { logAndGetSafeMessage } from "../../lib/errors";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

const PERM_LABELS: { key: keyof AdminUser["perms"]; label: string }[] = [
  { key: "publishReels", label: "نشر ريلز" },
  { key: "live", label: "بث مباشر" },
  { key: "paidAds", label: "إعلانات مدفوعة" },
  { key: "directWa", label: "واتساب مباشر" },
];

// ↔ "تغيير الدور بين مشرف/مستخدم" — this is the second, more discoverable
// entry point for that (the first being searching a user by name in the
// "المشرفون" super-admin tab). Both call the same user_roles insert/delete.
function useAdminIds() {
  return useQuery({
    queryKey: ["adminUserIds"],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (error) throw error;
      return new Set((data ?? []).map((r: { user_id: string }) => r.user_id));
    },
    staleTime: 15_000,
  });
}

function useRoleToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => {
      if (makeAdmin) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin", full_access: true, permissions: [] });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminUserIds"] }); qc.invalidateQueries({ queryKey: ["adminList"] }); },
    onError: (err: unknown) =>
      Alert.alert("تعذر تغيير الدور", logAndGetSafeMessage("roleMutation failed", err, "برجاء المحاولة مرة أخرى.")),
  });
}

export function AdminUsers() {
  const db = useAdminDB();
  const [query, setQuery] = useState("");
  const { isSuperAdmin } = useIsAdmin();
  const { data: adminIds } = useAdminIds();
  const roleToggle = useRoleToggle();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  const rows = useMemo(() => db.users.filter((u) => !query || u.name.includes(query)), [db.users, query]);

  return (
    <View style={{ gap: 12 }}>
      <TextInput style={styles.search} value={query} onChangeText={setQuery} placeholder="🔍 ابحث عن مستخدم..." placeholderTextColor={themeColors.textSubtle} />

      {rows.map((u) => {
        const isAdmin = adminIds?.has(u.id) ?? false;
        return (
          <View key={u.id} style={styles.card}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{u.name} {isAdmin ? "🛡️" : ""}</Text>
                <Text style={styles.sub}>{u.reels} ريلز · {u.views.toLocaleString("ar-EG")} مشاهدة</Text>
              </View>
              <Toggle value={u.active} onPress={() => toggleUserActive(u.id)} />
            </View>
            <View style={styles.permsGrid}>
              {PERM_LABELS.map((p) => (
                <View key={p.key} style={styles.permRow}>
                  <Text style={styles.permLabel}>{p.label}</Text>
                  <Toggle value={u.perms[p.key]} onPress={() => toggleUserPerm(u.id, p.key)} small />
                </View>
              ))}
            </View>
            {isSuperAdmin && (
              <Pressable
                style={[styles.roleBtn, isAdmin && styles.roleBtnRevoke]}
                onPress={() => Alert.alert(
                  isAdmin ? "إلغاء صلاحية الأدمن؟" : "منح صلاحية أدمن كاملة؟",
                  u.name,
                  [
                    { text: "إلغاء", style: "cancel" },
                    { text: "تأكيد", onPress: () => roleToggle.mutate({ userId: u.id, makeAdmin: !isAdmin }) },
                  ]
                )}
              >
                <Text style={[styles.roleBtnText, isAdmin && styles.roleBtnRevokeText]}>
                  {isAdmin ? "إلغاء صلاحية الأدمن" : "ترقية إلى أدمن"}
                </Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

function Toggle({ value, onPress, small }: { value: boolean; onPress: () => void; small?: boolean }) {
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <Pressable
      style={[small ? styles.toggleSmall : styles.toggle, value && styles.toggleOn]}
      onPress={onPress}
    >
      <View style={[small ? styles.toggleThumbSmall : styles.toggleThumb, value && (small ? styles.toggleThumbOnSmall : styles.toggleThumbOn)]} />
    </Pressable>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    search: { backgroundColor: themeColors.surface, borderWidth: 1, borderColor: themeColors.border, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, fontSize: 13, color: themeColors.text },
    card: { backgroundColor: themeColors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: themeColors.border },
    header: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    name: { fontSize: 13.5, fontWeight: "900", color: themeColors.text },
    sub: { fontSize: 11, color: themeColors.textSubtle, marginTop: 2 },
    permsGrid: { gap: 8, borderTopWidth: 1, borderTopColor: themeColors.border, paddingTop: 10 },
    permRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    permLabel: { fontSize: 12, color: themeColors.textMuted, fontWeight: "700" },
    toggle: { width: 44, height: 24, borderRadius: 999, backgroundColor: themeColors.isDark ? "#3f3f46" : "#cbd5e1", padding: 2, justifyContent: "center" },
    toggleOn: { backgroundColor: "#10b981" },
    toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "white", alignSelf: "flex-start" },
    toggleThumbOn: { alignSelf: "flex-end" },
    toggleSmall: { width: 36, height: 20, borderRadius: 999, backgroundColor: themeColors.isDark ? "#3f3f46" : "#cbd5e1", padding: 2, justifyContent: "center" },
    toggleThumbSmall: { width: 16, height: 16, borderRadius: 8, backgroundColor: "white", alignSelf: "flex-start" },
    toggleThumbOnSmall: { alignSelf: "flex-end" },
    roleBtn: { marginTop: 10, backgroundColor: themeColors.isDark ? "rgba(99,102,241,0.18)" : "#eef2ff", borderRadius: 999, paddingVertical: 9, alignItems: "center" },
    roleBtnText: { color: "#6366f1", fontWeight: "900", fontSize: 11.5 },
    roleBtnRevoke: { backgroundColor: themeColors.isDark ? "rgba(239,68,68,0.15)" : "#FEF2F2" },
    roleBtnRevokeText: { color: "#991B1B" },
  });
}
