import { useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, ActivityIndicator } from "react-native";
import { useAdminDB, toggleFeature } from "../../lib/hooks/useAdminDB";
import { useSocialShareLinks, useUpdateSocialShareLink, SocialPlatform } from "../../lib/hooks/useSocialShareLinks";
import { showToast } from "../shared/Toast";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  youtube: "YouTube", facebook: "Facebook", tiktok: "TikTok", instagram: "Instagram",
};

export function AdminFeatures() {
  const db = useAdminDB();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.card}>
        <Text style={styles.title}>الميزات العامة للمنصة</Text>
        <Text style={styles.subtitle}>تفعيل أو تعطيل الميزات لكل المستخدمين</Text>

        <View style={{ marginTop: 14, gap: 4 }}>
          {db.features.map((f) => (
            <View key={f.key} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{f.name}</Text>
                <Text style={styles.desc}>{f.desc}</Text>
              </View>
              <Pressable style={[styles.toggle, f.on && styles.toggleOn]} onPress={() => toggleFeature(f.key)}>
                <View style={[styles.thumb, f.on && styles.thumbOn]} />
              </Pressable>
            </View>
          ))}
        </View>
      </View>

      <SocialLinksCard />
    </View>
  );
}

// ↔ the four "من هنا" destination links in "وسّع انتشار إعلانك"
// (components/publish/SocialShareSection.tsx) — public.social_share_links,
// seeded empty by 20260816000000_social_share.sql until filled in here.
function SocialLinksCard() {
  const { data: links, isLoading } = useSocialShareLinks();
  const updateLink = useUpdateSocialShareLink();
  const [drafts, setDrafts] = useState<Partial<Record<SocialPlatform, string>>>({});
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  function valueFor(platform: SocialPlatform): string {
    return drafts[platform] ?? links?.[platform] ?? "";
  }

  async function save(platform: SocialPlatform) {
    const url = valueFor(platform);
    try {
      await updateLink.mutateAsync({ platform, url });
      showToast("✓ تم حفظ الرابط");
    } catch {
      showToast("تعذر حفظ الرابط، حاول مرة أخرى");
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>روابط منصات المشاركة</Text>
      <Text style={styles.subtitle}>
        الروابط اللي بتفتح لما مستخدم يضغط على أيقونة المنصة في "وسّع انتشار إعلانك" — قناة/صفحة/حساب Diarino على كل منصة
      </Text>

      {isLoading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 16 }} />
      ) : (
        <View style={{ marginTop: 14, gap: 12 }}>
          {(Object.keys(PLATFORM_LABELS) as SocialPlatform[]).map((platform) => (
            <View key={platform} style={{ gap: 6 }}>
              <Text style={styles.name}>{PLATFORM_LABELS[platform]}</Text>
              <View style={styles.linkRow}>
                <TextInput
                  style={styles.linkInput}
                  value={valueFor(platform)}
                  onChangeText={(v) => setDrafts((prev) => ({ ...prev, [platform]: v }))}
                  placeholder="https://..."
                  placeholderTextColor={themeColors.textSubtle}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <Pressable style={styles.saveBtn} onPress={() => save(platform)} disabled={updateLink.isPending}>
                  <Text style={styles.saveBtnText}>حفظ</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    card: { backgroundColor: themeColors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: themeColors.border },
    title: { fontSize: 15, fontWeight: "900", color: themeColors.text },
    subtitle: { fontSize: 12, color: themeColors.textSubtle, marginTop: 2 },
    row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: themeColors.border },
    name: { fontSize: 13, fontWeight: "800", color: themeColors.text },
    desc: { fontSize: 11, color: themeColors.textSubtle, marginTop: 2 },
    toggle: { width: 44, height: 24, borderRadius: 999, backgroundColor: themeColors.isDark ? "#3f3f46" : "#cbd5e1", padding: 2, justifyContent: "center" },
    toggleOn: { backgroundColor: "#10b981" },
    thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "white", alignSelf: "flex-start" },
    thumbOn: { alignSelf: "flex-end" },
    linkRow: { flexDirection: "row", gap: 8 },
    linkInput: { flex: 1, backgroundColor: themeColors.surface, borderWidth: 1, borderColor: themeColors.border, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, fontSize: 12.5, color: themeColors.text, textAlign: "left" },
    saveBtn: { backgroundColor: themeColors.isDark ? "#334155" : "#0f172a", borderRadius: 10, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
    saveBtnText: { color: "white", fontSize: 12, fontWeight: "800" },
  });
}
