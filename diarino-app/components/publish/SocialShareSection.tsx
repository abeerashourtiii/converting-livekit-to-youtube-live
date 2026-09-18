import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { SocialPlatform, useSocialShareLinks } from "../../lib/hooks/useSocialShareLinks";
import { showToast } from "../shared/Toast";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

// ↔ "وسّع انتشار إعلانك" — sits right above the video-upload field in
// app/publish/create-listing.tsx. Each row: a checkbox that toggles
// whether this listing gets requested for repost on that platform (goes
// into public.properties.share_platforms, reviewed by admins in the reels
// screen), and a platform icon that's a live link out to Diarino's own
// channel/page/account there (public.social_share_links —
// 20260816000000_social_share.sql, empty until the project owner supplies
// the real URLs).
const PLATFORMS: { key: SocialPlatform; name: string; desc: string; bg: string }[] = [
  { key: "youtube", name: "YouTube", desc: "شاهد إعلانك بعد نشره على قناة Diarino على YouTube.", bg: "#FF0000" },
  { key: "facebook", name: "Facebook", desc: "شاهد إعلانك بعد نشره على صفحة Diarino على Facebook.", bg: "#1877F2" },
  { key: "tiktok", name: "TikTok", desc: "شاهد إعلانك بعد نشره على حساب Diarino على TikTok.", bg: "#111827" },
  { key: "instagram", name: "Instagram", desc: "شاهد إعلانك بعد نشره على حساب Diarino على Instagram.", bg: "#E1306C" },
];

export function SocialShareSection({
  selected, onToggle,
}: { selected: Set<SocialPlatform>; onToggle: (p: SocialPlatform) => void }) {
  const { t } = useLanguage();
  const { data: links } = useSocialShareLinks();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  function openChannel(platform: SocialPlatform) {
    const url = links?.[platform];
    if (url) Linking.openURL(url).catch(() => showToast(t("تعذر فتح الرابط")));
    else showToast(t("🔗 هيتوفر الرابط قريبًا"));
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("وسّع انتشار إعلانك")}</Text>
      <Text style={styles.subtitle}>{t("انشر إعلانك على منصات Diarino المختلفة لزيادة فرص وصوله إلى المزيد من المهتمين بعقارك")}</Text>

      <View style={{ gap: 10, marginTop: 14 }}>
        {PLATFORMS.map((p) => {
          const isSelected = selected.has(p.key);
          return (
            <View key={p.key} style={styles.row}>
              <Pressable
                style={[styles.checkbox, isSelected && styles.checkboxOn]}
                onPress={() => onToggle(p.key)}
                hitSlop={6}
              >
                {isSelected && (
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M20 6L9 17l-5-5" />
                  </Svg>
                )}
              </Pressable>

              <Pressable style={[styles.iconBox, { backgroundColor: p.bg }]} onPress={() => openChannel(p.key)}>
                <PlatformIcon platform={p.key} />
              </Pressable>

              <View style={{ flex: 1 }}>
                <Text style={styles.platformName}>{p.name}</Text>
                <Text style={styles.platformDesc}>
                  {t(p.desc)}{" "}
                  <Text style={styles.link} onPress={() => openChannel(p.key)}>{t("من هنا")}</Text>
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <Text style={styles.note}>
        📌 {t("ملاحظة: بعد مراجعة واعتماد إعلانك، سيتم نشره على المنصات التي اخترتها وفقًا لسياسة النشر الخاصة بـ Diarino.")}
      </Text>
    </View>
  );
}

// Simplified, single-tone glyphs (this codebase's GoogleIcon in
// app/index.tsx follows the same placeholder-icon approach) rather than
// the real trademarked logos.
function PlatformIcon({ platform }: { platform: SocialPlatform }) {
  if (platform === "youtube") {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="white">
        <Path d="M9 8l7 4-7 4V8z" />
      </Svg>
    );
  }
  if (platform === "facebook") {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 8h-2a2 2 0 00-2 2v2H9v3h2v6h3v-6h2.2l.8-3H14v-1.5c0-.6.4-1 .9-1H16V8z" fill="white" stroke="none" />
      </Svg>
    );
  }
  if (platform === "tiktok") {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 4v9.5a3 3 0 11-2.5-2.96" />
        <Path d="M15 4c.3 2 1.8 3.6 4 4" />
      </Svg>
    );
  }
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8}>
      <Rect x={4} y={4} width={16} height={16} rx={4.5} />
      <Circle cx={12} cy={12} r={4} />
      <Circle cx={17} cy={7} r={0.8} fill="white" stroke="none" />
    </Svg>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    card: { backgroundColor: themeColors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: themeColors.border, marginTop: 16 },
    title: { fontSize: 13.5, fontWeight: "900", color: themeColors.text },
    subtitle: { fontSize: 11.5, color: themeColors.textSubtle, marginTop: 4, lineHeight: 17 },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    checkbox: {
      width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: themeColors.border,
      alignItems: "center", justifyContent: "center", backgroundColor: themeColors.card,
    },
    checkboxOn: { backgroundColor: "#22A652", borderColor: "#22A652" },
    iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    platformName: { fontSize: 12.5, fontWeight: "800", color: themeColors.text },
    platformDesc: { fontSize: 11, color: themeColors.textSubtle, marginTop: 2, lineHeight: 16 },
    link: { color: "#22A652", fontWeight: "800" },
    note: { fontSize: 10.5, color: themeColors.textSubtle, marginTop: 12, lineHeight: 16 },
  });
}
