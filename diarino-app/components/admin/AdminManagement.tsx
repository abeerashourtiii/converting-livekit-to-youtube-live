import { useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, FlatList, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { AdminSection } from "../../lib/hooks/useIsAdmin";
import { logAndGetSafeMessage } from "../../lib/errors";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

// ↔ replaces "grant admin manually via the Supabase dashboard" — the
// super admin (the account that registered first, see
// 20260807000000_super_admin_system.sql) can grant/revoke admin access
// right here, either full access or limited to specific sections. The
// super admin row itself is protected at the DB trigger level, so there's
// nothing to accidentally break by deleting it from this screen either.

const SECTIONS: { key: AdminSection; label: string }[] = [
  { key: "reels", label: "الريلز" },
  { key: "lives", label: "البث المسجل" },
  { key: "reports", label: "الدعم" },
  { key: "users", label: "المستخدمون" },
  { key: "features", label: "الميزات العامة" },
  { key: "ads", label: "المساحة الإعلانية" },
  { key: "sponsoredReels", label: "الريلز المميزة" },
  { key: "auditLog", label: "سجل تدقيق الأدمن" },
  { key: "userActivity", label: "سجل نشاط المستخدمين" },
  { key: "menuItems", label: "أيقونات صفحة القائمة" },
];

type AdminRow = {
  user_id: string; is_super_admin: boolean; full_access: boolean; permissions: AdminSection[];
  profiles: { full_name: string | null } | null;
};

async function fetchAdmins(): Promise<AdminRow[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, is_super_admin, full_access, permissions, profiles!user_roles_user_id_profile_fkey(full_name)")
    .eq("role", "admin");
  if (error) throw error;
  return (data ?? []) as unknown as AdminRow[];
}

export function AdminManagement() {
  const qc = useQueryClient();
  const { data: admins = [] } = useQuery({ queryKey: ["adminList"], queryFn: fetchAdmins });
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; full_name: string | null }[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ id: string; full_name: string | null } | null>(null);
  const [grantFullAccess, setGrantFullAccess] = useState(true);
  const [grantSections, setGrantSections] = useState<Set<AdminSection>>(new Set());
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  const grantMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) return;
      const { error } = await supabase.from("user_roles").insert({
        user_id: selectedUser.id, role: "admin",
        full_access: grantFullAccess,
        permissions: grantFullAccess ? [] : Array.from(grantSections),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminList"] });
      setSelectedUser(null); setSearch(""); setSearchResults([]); setGrantSections(new Set()); setGrantFullAccess(true);
    },
    onError: (err: unknown) =>
      Alert.alert("تعذر منح الصلاحية", logAndGetSafeMessage("grantMutation failed", err, "برجاء المحاولة مرة أخرى.")),
  });

  const revokeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminList"] }),
    onError: (err: unknown) =>
      Alert.alert("لا يمكن إزالة هذا المشرف", logAndGetSafeMessage("revokeMutation failed", err, "برجاء المحاولة مرة أخرى.")),
  });

  async function runSearch(q: string) {
    setSearch(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    const { data } = await supabase.from("profiles").select("id, full_name").ilike("full_name", `%${q}%`).limit(8);
    setSearchResults((data ?? []) as { id: string; full_name: string | null }[]);
  }

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>منح صلاحية مشرف جديد</Text>
        <TextInput
          style={styles.input}
          placeholder="ابحث بالاسم..."
          placeholderTextColor={themeColors.textSubtle}
          value={search}
          onChangeText={runSearch}
        />
        {searchResults.map((u) => (
          <Pressable key={u.id} style={styles.searchResultRow} onPress={() => { setSelectedUser(u); setSearchResults([]); setSearch(u.full_name || ""); }}>
            <Text style={styles.searchResultText}>{u.full_name || "مستخدم بدون اسم"}</Text>
          </Pressable>
        ))}

        {selectedUser && (
          <View style={{ marginTop: 12, gap: 10 }}>
            <Pressable style={styles.accessToggleRow} onPress={() => setGrantFullAccess((v) => !v)}>
              <View style={[styles.checkbox, grantFullAccess && styles.checkboxOn]} />
              <Text style={styles.accessToggleText}>صلاحيات شاملة (كل الأقسام)</Text>
            </Pressable>
            {!grantFullAccess && (
              <View style={{ gap: 6, paddingRight: 8 }}>
                {SECTIONS.map((s) => (
                  <Pressable
                    key={s.key}
                    style={styles.accessToggleRow}
                    onPress={() => setGrantSections((prev) => {
                      const next = new Set(prev);
                      next.has(s.key) ? next.delete(s.key) : next.add(s.key);
                      return next;
                    })}
                  >
                    <View style={[styles.checkbox, grantSections.has(s.key) && styles.checkboxOn]} />
                    <Text style={styles.accessToggleText}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Pressable style={styles.grantBtn} onPress={() => grantMutation.mutate()} disabled={grantMutation.isPending}>
              <Text style={styles.grantBtnText}>{grantMutation.isPending ? "جاري المنح..." : "منح صلاحية المشرف"}</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>المشرفون الحاليون</Text>
        <FlatList
          data={admins}
          keyExtractor={(a) => a.user_id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.adminRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminName}>
                  {item.profiles?.full_name || "مستخدم"} {item.is_super_admin ? "👑 سوبر أدمن" : ""}
                </Text>
                <Text style={styles.adminPerms}>
                  {item.is_super_admin || item.full_access ? "صلاحيات شاملة" : (item.permissions.length ? item.permissions.join("، ") : "بدون صلاحيات محددة")}
                </Text>
              </View>
              {!item.is_super_admin && (
                <Pressable
                  style={styles.revokeBtn}
                  onPress={() => Alert.alert("إزالة صلاحية المشرف؟", "", [
                    { text: "إلغاء", style: "cancel" },
                    { text: "إزالة", style: "destructive", onPress: () => revokeMutation.mutate(item.user_id) },
                  ])}
                >
                  <Text style={styles.revokeBtnText}>إزالة</Text>
                </Pressable>
              )}
            </View>
          )}
        />
      </View>
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    card: { backgroundColor: themeColors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: themeColors.border },
    cardTitle: { fontSize: 13, fontWeight: "900", color: themeColors.text, marginBottom: 10 },
    input: { borderWidth: 1, borderColor: themeColors.border, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, fontSize: 12.5, color: themeColors.text },
    searchResultRow: { paddingVertical: 8, paddingHorizontal: 10, backgroundColor: themeColors.surface, borderRadius: 8, marginTop: 6 },
    searchResultText: { fontSize: 12.5, fontWeight: "700", color: themeColors.textMuted },
    accessToggleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 2, borderColor: themeColors.isDark ? "#52525b" : "#cbd5e1" },
    checkboxOn: { backgroundColor: "#6366f1", borderColor: "#6366f1" },
    accessToggleText: { fontSize: 12, fontWeight: "700", color: themeColors.textMuted },
    grantBtn: { backgroundColor: "#6366f1", borderRadius: 999, paddingVertical: 11, alignItems: "center", marginTop: 4 },
    grantBtnText: { color: "white", fontWeight: "900", fontSize: 12.5 },
    adminRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: themeColors.border },
    adminName: { fontSize: 12.5, fontWeight: "800", color: themeColors.text },
    adminPerms: { fontSize: 11, color: themeColors.textSubtle, marginTop: 2 },
    revokeBtn: { backgroundColor: themeColors.isDark ? "rgba(239,68,68,0.15)" : "#FEF2F2", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
    revokeBtnText: { color: "#991B1B", fontWeight: "900", fontSize: 11 },
  });
}
