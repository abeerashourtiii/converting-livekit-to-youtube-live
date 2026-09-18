import { useState } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { useLanguage } from "../lib/hooks/useLanguage";
import { useAccountPrivacy } from "../lib/hooks/useAccountPrivacy";
import { useContentSettings } from "../lib/hooks/useContentSettings";
import { useThemeColors, ThemeColors } from "../lib/hooks/useThemeColors";
import { usePiPPreference } from "../lib/hooks/usePiPPreference";
import { signOut } from "../lib/hooks/useAuth";
import { useCurrentUser } from "../lib/hooks/useCurrentUser";
import { useProfile } from "../lib/hooks/useProfile";
import { useLogSupportContact } from "../lib/hooks/useSupportMessages";
import { waLink } from "../lib/whatsapp";
import { openExternalUrl } from "../lib/linking";
import { cldThumbnail } from "../lib/cloudinary";
import { Image } from "expo-image";
import { ThemeSelectorModal } from "../components/account/ThemeSelectorModal";
import { LanguageSelectorModal } from "../components/account/LanguageSelectorModal";
import { ContentSettingsModal } from "../components/account/ContentSettingsModal";
import { ComplaintsSuggestionsModal } from "../components/account/ComplaintsSuggestionsModal";
import { ShareProfileModal } from "../components/account/ShareProfileModal";
import { PictureInPictureModal } from "../components/shared/PictureInPictureModal";
import { useIsAdmin } from "../lib/hooks/useIsAdmin";

// New dedicated settings screen — reached from the menu page's "الإعدادات"
// card. Pulls together the app-level settings that used to live only in
// the AccountDropdown (language, theme, content & notification settings,
// account privacy, complaints, contact us, logout), so there's a proper
// standalone settings destination instead of a dropdown-only one. The
// account-menu icon that used to open AccountDropdown from every main page
// has been removed — this settings screen (via the menu page's dedicated
// card) is now the only entry point for these settings.
export default function SettingsScreen() {
  const { language, t } = useLanguage();
  const { isPublic, togglePrivacy } = useAccountPrivacy();
  // ↔ #2 (إعدادات القائمة): كانت "الإشعارات" هنا useState محلي بس، مش
  // متصلة بحاجة فعليًا — تفعيلها أو إلغاؤها ماكانش بيأثر على أي حاجة
  // حقيقية. دلوقتي بقت مرآة لمفتاح رئيسي على نفس الـ 4 أعمدة الحقيقية
  // (notify_likes/saves/follows/chat) اللي إعدادات المحتوى والإشعارات
  // بتستخدمها فعليًا وبيتفعّل عليها فحص فى الـ triggers نفسها على
  // Supabase (شوف 20260806000000_user_content_settings.sql) — تفعيلها/
  // إلغاؤها من هنا بيفعّل/يلغي الأربعة مرة واحدة.
  const { settings: contentSettings, toggleSetting } = useContentSettings();
  const notificationsOn = contentSettings.notifyLikes && contentSettings.notifySaves
    && contentSettings.notifyFollows && contentSettings.notifyChat;
  const themeColors = useThemeColors();
  const { preference: pipPreference } = usePiPPreference();
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  // ↔ #7: بدل التبديل المباشر (toggleLanguage) بفتح قايمة اختيار صريحة
  // فيها اللغتين مع علامة صح جوار اللغة الحالية.
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [contentSettingsVisible, setContentSettingsVisible] = useState(false);
  const [complaintsVisible, setComplaintsVisible] = useState(false);
  const [shareProfileVisible, setShareProfileVisible] = useState(false);
  const [pipModalVisible, setPipModalVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const logSupportContact = useLogSupportContact();
  const { user } = useCurrentUser();
  const { profile } = useProfile();
  const { isAdmin, checking: checkingAdmin } = useIsAdmin();
  const isGuest = !!user?.is_anonymous;

  function goToProfile() {
    if (isGuest) { goToLogin(); return; }
    router.push("/edit-profile");
  }

  function toggleAllNotifications() {
    const keys: Array<"notifyLikes" | "notifySaves" | "notifyFollows" | "notifyChat"> = [
      "notifyLikes", "notifySaves", "notifyFollows", "notifyChat",
    ];
    // ↔ كل واحدة من دول لازم تتقلب لنفس القيمة الجديدة (عكس notificationsOn
    // الحالية)، مش toggle مستقل — فبنفلتر بس على المفاتيح اللي لسه مش
    // متطابقة مع الهدف، عشان نتجنب نداءات upsert من غير داعٍ.
    const target = !notificationsOn;
    keys.forEach((key) => {
      if (contentSettings[key] !== target) toggleSetting(key);
    });
  }

  const styles = createStyles(themeColors);

  async function performLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
      router.replace("/");
    } finally {
      setLoggingOut(false);
    }
  }

  function confirmLogout() {
    // ↔ بند 3: فى وضع الضيف مفيش حساب حقيقي نسجّل خروج منه — الزر بيتحول
    // لـ "تسجيل الدخول" (goToLogin تحته) فمفروض الدالة دي مبتتناداش أصلاً
    // فى وضع الضيف، بس بنتأكد هنا كمان كحماية إضافية.
    if (isGuest) { goToLogin(); return; }
    if (Platform.OS === "web") {
      if (window.confirm(t("هل تريد تسجيل الخروج من حسابك؟"))) void performLogout();
      return;
    }
    Alert.alert(t("تسجيل الخروج"), t("هل تريد تسجيل الخروج من حسابك؟"), [
      { text: t("إلغاء"), style: "cancel" },
      { text: t("تسجيل خروج"), style: "destructive", onPress: () => void performLogout() },
    ]);
  }

  function goToLogin() {
    void performLogout();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth={2}>
            <Path d="M18 6L6 18M6 6l12 12" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>{t("الإعدادات")}</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Section title={t("عام")} themeColors={themeColors}>
          {/* ↔ #7: بيفتح قايمة اختيار صريحة (العربية / English) بعلامة صح
              جوار اللغة الحالية، بدل التبديل المباشر (toggle) للغة التانية. */}
          <Row
            icon={<GlobeIcon />}
            label={language === "ar" ? "العربية" : "English"}
            onPress={() => setLanguageModalVisible(true)}
          />
          <Row icon={<ThemeIcon />} label={t("العرض")} onPress={() => setThemeModalVisible(true)} badge={t("قيد التحسين")} />
          <Row
            icon={<BellIcon />}
            label={t("الإشعارات")}
            toggle={notificationsOn}
            onPress={toggleAllNotifications}
          />
          <Row
            icon={<SlidersIcon />}
            label={t("إعدادات المحتوى والإشعارات")}
            onPress={() => setContentSettingsVisible(true)}
          />
        </Section>

        <Section title={t("الحساب")} themeColors={themeColors}>
          <Row icon={<ShareIcon />} label={t("مشاركة البروفايل")} onPress={() => setShareProfileVisible(true)} />
          <Row icon={<BellIcon />} label={t("تنبيهاتي المحفوظة")} onPress={() => router.push("/saved-alerts")} />
          {!checkingAdmin && isAdmin && (
            <Row icon={<AdminIcon />} label={t("لوحة تحكم الأدمن")} onPress={() => router.push("/admin")} />
          )}
        </Section>

        <Section title={t("الخصوصية")} themeColors={themeColors}>
          <Row icon={<LockIcon />} label={t("الحساب العام")} toggle={isPublic} onPress={togglePrivacy} />
        </Section>

        {/* ↔ #3: "عرض التطبيق فوق التطبيقات الأخرى" — تفعيل/ليس الآن،
            نفس المودال المشترك مع قايمة خيارات الريل بالضغط المطول. */}
        <Section title={t("التشغيل")} themeColors={themeColors}>
          <Row
            icon={<PipIcon />}
            label={t("عرض التطبيق فوق التطبيقات الأخرى")}
            toggle={pipPreference === "enabled"}
            onPress={() => setPipModalVisible(true)}
          />
        </Section>

        <Section title={t("الدعم")} themeColors={themeColors}>
          <Row
            icon={<MailIcon />}
            label={t("تواصل معنا")}
            onPress={() => {
              // ↔ logs into public.support_messages (20260815000000_support_center.sql)
              // so the admin support center's "التواصل معنا" tab shows who
              // asked for support and when, right before WhatsApp opens.
              logSupportContact.mutate();
              openExternalUrl(waLink("مرحباً"));
            }}
          />
          <Row icon={<FlagIcon />} label={t("الشكاوى والمقترحات")} onPress={() => setComplaintsVisible(true)} />
        </Section>

        <Section title="" themeColors={themeColors}>
          <Pressable style={styles.profileRow} onPress={goToProfile}>
            <View style={styles.profileAvatarWrap}>
              {profile?.avatarUrl ? (
                <Image source={{ uri: cldThumbnail(profile.avatarUrl) }} style={styles.profileAvatarImg} contentFit="cover" transition={150} />
              ) : (
                <ProfileIcon />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName} numberOfLines={1}>
                {isGuest ? t("ضيف") : (profile?.fullName || user?.email || t("حسابي"))}
              </Text>
              {!isGuest && !!user?.email && (
                <Text style={styles.profileEmail} numberOfLines={1}>{user.email}</Text>
              )}
            </View>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={themeColors.textSubtle} strokeWidth={2}>
              <Path d={language === "ar" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
            </Svg>
          </Pressable>
          <Row
            icon={<LogoutIcon />}
            label={isGuest ? t("تسجيل الدخول") : t("تسجيل خروج")}
            danger={!isGuest}
            onPress={isGuest ? goToLogin : confirmLogout}
            disabled={loggingOut}
          />
        </Section>
      </ScrollView>

      <LanguageSelectorModal visible={languageModalVisible} onClose={() => setLanguageModalVisible(false)} />
      <ThemeSelectorModal visible={themeModalVisible} onClose={() => setThemeModalVisible(false)} />
      <ContentSettingsModal visible={contentSettingsVisible} onClose={() => setContentSettingsVisible(false)} />
      <ComplaintsSuggestionsModal visible={complaintsVisible} onClose={() => setComplaintsVisible(false)} />
      <ShareProfileModal visible={shareProfileVisible} onClose={() => setShareProfileVisible(false)} />
      <PictureInPictureModal visible={pipModalVisible} onClose={() => setPipModalVisible(false)} />
    </View>
  );
}

function Section({ title, children, themeColors }: { title: string; children: React.ReactNode; themeColors: ThemeColors }) {
  return (
    <View style={{ gap: 8 }}>
      {!!title && <Text style={[sectionTitleStyle, { color: themeColors.textMuted }]}>{title}</Text>}
      <View style={[sectionCardStyle, { backgroundColor: themeColors.card }]}>{children}</View>
    </View>
  );
}

function Row({
  icon, label, onPress, toggle, danger, badge, disabled,
}: {
  icon: React.ReactNode; label: string; onPress: () => void; toggle?: boolean; danger?: boolean; badge?: string; disabled?: boolean;
}) {
  const themeColors = useThemeColors();
  return (
    <Pressable style={[rowStyle, { borderTopColor: themeColors.border }, disabled && { opacity: 0.55 }]} onPress={onPress} disabled={disabled}>
      {icon}
      <Text style={[rowTextStyle, { color: danger ? "#991B1B" : themeColors.textMuted }]}>{label}</Text>
      {/* ↔ قرار #1: الوضع الداكن مطبَّق فعليًا بس على شاشات محدودة
          (settings/menu/PageTopBar المشترك) — العلامة دي بتوضح للمستخدم
          إن التغطية الكاملة لسه شغالة عليها، بدل ما يفاجئه إن شاشات
          تانية مش بتتغيّر لونها. تفاصيل الشاشات المتبقية فى
          docs/deferred-tasks.md. */}
      {!!badge && (
        <View style={pendingBadgeStyle}>
          <Text style={pendingBadgeTextStyle}>{badge}</Text>
        </View>
      )}
      {toggle !== undefined && (
        <View style={[styles_toggle, toggle && styles_toggleOn]}>
          <View style={[styles_toggleThumb, toggle && styles_toggleThumbOn]} />
        </View>
      )}
    </Pressable>
  );
}

const iconProps = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none" as const, stroke: "#6b7280", strokeWidth: 2 };
function GlobeIcon() { return <Svg {...iconProps}><Circle cx={12} cy={12} r={10} /><Path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></Svg>; }
function ThemeIcon() { return <Svg {...iconProps}><Circle cx={12} cy={12} r={4} /><Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>; }
function LockIcon() { return <Svg {...iconProps}><Path d="M5 11h14v10H5z" /><Path d="M8 11V7a4 4 0 018 0v4" /></Svg>; }
function SlidersIcon() { return <Svg {...iconProps}><Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" /><Path d="M1 14h6M9 8h6M17 16h6" /></Svg>; }
function MailIcon() { return <Svg {...iconProps}><Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></Svg>; }
function FlagIcon() { return <Svg {...iconProps}><Path d="M4 22V4" /><Path d="M4 4h13l-2 4 2 4H4" /></Svg>; }
function BellIcon() { return <Svg {...iconProps}><Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" /></Svg>; }
function ShareIcon() { return <Svg {...iconProps}><Circle cx={18} cy={5} r={2.5} /><Circle cx={6} cy={12} r={2.5} /><Circle cx={18} cy={19} r={2.5} /><Path d="M8.3 10.7l7.4-4.4M8.3 13.3l7.4 4.4" /></Svg>; }
function LogoutIcon() { return <Svg {...iconProps} stroke="#991B1B"><Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><Path d="M16 17l5-5-5-5M21 12H9" /></Svg>; }
function ProfileIcon() { return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#22A652" strokeWidth={2}><Circle cx={12} cy={8} r={4} /><Path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></Svg>; }
function PipIcon() { return <Svg {...iconProps}><Rect x={3} y={3} width={18} height={14} rx={2} /><Rect x={12} y={11} width={7} height={5} rx={1} /></Svg>; }
function AdminIcon() { return <Svg {...iconProps}><Path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" /><Path d="M9 12l2 2 4-4" /></Svg>; }

// ↔ الأجزاء اللي محتاجة تتلوّن مع الثيم (خلفية الشاشة/الهيدر/الكروت)
// بتتبنى ديناميكيًا من useThemeColors() جوه createStyles()، والأجزاء
// الثابتة (المسافات/الأحجام) لسه StyleSheet.create() عادي زي الأول.
const rowStyle = { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, paddingVertical: 14, paddingHorizontal: 14, borderTopWidth: 1 };
const rowTextStyle = { fontSize: 13.5, fontWeight: "700" as const, flex: 1 };
const sectionTitleStyle = { fontSize: 12.5, fontWeight: "900" as const, marginLeft: 4 };
const sectionCardStyle = { borderRadius: 16, overflow: "hidden" as const };
const staticToggleStyles = StyleSheet.create({
  toggle: { width: 36, height: 20, borderRadius: 999, backgroundColor: "#e5e7eb", padding: 2, justifyContent: "center" },
  toggleOn: { backgroundColor: "#22A652" },
  toggleThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: "white", alignSelf: "flex-start" },
  toggleThumbOn: { alignSelf: "flex-end" },
});
const styles_toggle = staticToggleStyles.toggle;
const styles_toggleOn = staticToggleStyles.toggleOn;
const styles_toggleThumb = staticToggleStyles.toggleThumb;
const styles_toggleThumbOn = staticToggleStyles.toggleThumbOn;
const pendingBadgeStyle = { backgroundColor: "#FEF3C7", borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 };
const pendingBadgeTextStyle = { fontSize: 10.5, fontWeight: "900" as const, color: "#92400E" };

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 14, paddingTop: 54, paddingBottom: 14, backgroundColor: themeColors.background,
    },
    closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: themeColors.surface, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 16, fontWeight: "900", color: themeColors.text },
    scroll: { padding: 14, paddingBottom: 110, gap: 16 },
    profileRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: themeColors.card, borderRadius: 14, padding: 12, marginBottom: 10,
    },
    profileAvatarWrap: {
      width: 48, height: 48, borderRadius: 24, overflow: "hidden",
      backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ecfdf5",
      alignItems: "center", justifyContent: "center",
    },
    profileAvatarImg: { width: 48, height: 48, borderRadius: 24 },
    profileName: { fontSize: 14, fontWeight: "900", color: themeColors.text },
    profileEmail: { fontSize: 12, fontWeight: "600", color: themeColors.textSubtle, marginTop: 2 },
  });
}
