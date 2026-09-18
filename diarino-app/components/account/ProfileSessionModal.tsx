import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { signOut } from "../../lib/hooks/useAuth";
import { cldOptimized } from "../../lib/cloudinary";
import { router } from "expo-router";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

// ↔ the profile row at the top of the account settings dropdown (avatar +
// username) — tapping it opens this, showing the real Google account
// info Supabase already has from the OAuth sign-in (lib/hooks/useAuth.ts),
// plus sign-out. "Session management" here is scoped to what Supabase's
// client SDK actually exposes (this device's current session) — listing
// every active session/device needs the admin API, not available client-side.

type Props = { visible: boolean; onClose: () => void };

export function ProfileSessionModal({ visible, onClose }: Props) {
  const { user } = useCurrentUser();
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  if (!visible) return null;

  const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string; picture?: string; email_verified?: boolean };
  const name = meta.full_name || meta.name || user?.email || t("مستخدم ديارينو");
  const avatarUrl = meta.avatar_url || meta.picture;
  const provider = user?.app_metadata?.provider === "google" ? "Google" : (user?.app_metadata?.provider ?? "—");
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US") : "—";
  // ↔ Supabase sets email_confirmed_at once the provider verifies the
  // email — Google's own "email_verified" claim (in user_metadata) is
  // the more direct signal for a Google sign-in specifically, checked
  // first, with email_confirmed_at as a fallback for any other provider.
  const isVerified = meta.email_verified ?? !!user?.email_confirmed_at;

  async function handleLogout() {
    onClose();
    await signOut();
    router.replace("/");
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.card}>
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={themeColors.textSubtle} strokeWidth={2}>
            <Path d="M18 6L6 18M6 6l12 12" />
          </Svg>
        </Pressable>

        <View style={styles.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: cldOptimized(avatarUrl, "w_200,h_200,c_fill,q_auto,f_auto") }} style={styles.avatarImg} contentFit="cover" transition={150} />
          ) : (
            <Text style={styles.avatarInitial}>{name.charAt(0)}</Text>
          )}
        </View>
        <Text style={styles.name}>{name}</Text>
        {!!user?.email && <Text style={styles.email}>{user.email}</Text>}
        <View style={[styles.verifyBadge, isVerified ? styles.verifyBadgeOk : styles.verifyBadgeWarn]}>
          <Text style={styles.verifyBadgeText}>
            {isVerified ? `✓ ${t("الحساب موثّق")}` : `⚠️ ${t("الحساب غير موثّق")}`}
          </Text>
        </View>
        {!isVerified && (
          <Text style={styles.verifyWarning}>
            {t("حساب Google الخاص بك غير موثّق. بعض ميزات التطبيق قد لا تعمل بشكل كامل إلى أن يتم توثيق بريدك الإلكتروني.")}
          </Text>
        )}

        <View style={styles.infoBox}>
          <InfoRow label={t("طريقة تسجيل الدخول")} value={provider} />
          <InfoRow label={t("عضو منذ")} value={memberSince} />
        </View>

        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth={2}>
            <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><Path d="M16 17l5-5-5-5M21 12H9" />
          </Svg>
          <Text style={styles.logoutBtnText}>{t("تسجيل خروج")}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    card: {
      position: "absolute", top: 90, left: 16, right: 16,
      backgroundColor: themeColors.card, borderRadius: 16, padding: 20, alignItems: "center",
      shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10,
      borderWidth: 1, borderColor: themeColors.border,
    },
    closeBtn: { position: "absolute", top: 12, right: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: themeColors.surface, alignItems: "center", justifyContent: "center" },
    avatarWrap: { width: 68, height: 68, borderRadius: 34, backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ecfdf5", alignItems: "center", justifyContent: "center", overflow: "hidden", marginTop: 8 },
    avatarImg: { width: 68, height: 68, borderRadius: 34 },
    avatarInitial: { fontSize: 26, fontWeight: "900", color: "#22A652" },
    name: { fontSize: 15, fontWeight: "900", color: themeColors.text, marginTop: 10 },
    email: { fontSize: 12, color: themeColors.textSubtle, marginTop: 2 },
    verifyBadge: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, marginTop: 8 },
    verifyBadgeOk: { backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ecfdf5" },
    verifyBadgeWarn: { backgroundColor: themeColors.isDark ? "rgba(180,83,9,0.22)" : "#fffbeb" },
    verifyBadgeText: { fontSize: 11, fontWeight: "900", color: themeColors.text },
    verifyWarning: { fontSize: 10.5, color: themeColors.isDark ? "#FBBF24" : "#b45309", textAlign: "center", marginTop: 8, lineHeight: 16, paddingHorizontal: 8 },
    infoBox: { width: "100%", marginTop: 16, gap: 10 },
    infoRow: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: themeColors.border, paddingBottom: 8 },
    infoLabel: { fontSize: 12, color: themeColors.textSubtle, fontWeight: "700" },
    infoValue: { fontSize: 12, color: themeColors.text, fontWeight: "800" },
    logoutBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, backgroundColor: themeColors.isDark ? "rgba(153,27,27,0.22)" : "#FEF2F2", borderRadius: 999, paddingVertical: 11, paddingHorizontal: 22 },
    logoutBtnText: { color: "#991B1B", fontWeight: "900", fontSize: 13 },
  });
}
