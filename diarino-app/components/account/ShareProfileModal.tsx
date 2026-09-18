import { Modal, View, Text, Pressable, StyleSheet, Linking, Share, Animated } from "react-native";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import * as Clipboard from "expo-clipboard";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { showToast } from "../shared/Toast";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";
import { useDragToClose } from "../../lib/hooks/useDragToClose";

type Props = { visible: boolean; onClose: () => void };

// ↔ "مشاركة البروفايل" row in app/settings.tsx. Builds one canonical
// profile link (https://diarino.app/seller/<id>) and offers a grid of
// named destinations instead of only the OS's generic share sheet —
// WhatsApp / Messenger / Facebook / Instagram / X / Telegram / TikTok /
// Bluetooth / copy-link, per the settings spec.
//
// Not every platform has a public "share this link with this caption" URL
// scheme: Instagram and TikTok don't accept arbitrary link+text via a URL
// (no equivalent of wa.me/t.me/twitter-intent for feed posts), and
// Bluetooth has no cross-platform JS API in Expo without a native module.
// For those three, the link is copied to the clipboard and the app (or its
// website as a fallback) is opened, with a toast telling the user to paste
// it — same pattern real apps use for this gap, rather than pretending a
// direct share exists where it doesn't.

function buildLink(userId: string) {
  return `https://diarino.app/seller/${userId}`;
}

export function ShareProfileModal({ visible, onClose }: Props) {
  const { t } = useLanguage();
  const { user } = useCurrentUser();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const { translateY, backdropOpacity, panHandlers } = useDragToClose(onClose);
  if (!visible || !user) return null;

  const link = buildLink(user.id);
  const caption = t("شوف بروفايلي على ديارينو");
  const fullMessage = `${caption}: ${link}`;

  async function copyLink(toastMsg?: string) {
    await Clipboard.setStringAsync(link);
    showToast(toastMsg ?? t("تم نسخ الرابط"));
  }

  async function openOrCopyFallback(url: string, toastMsg: string) {
    try {
      await Linking.openURL(url);
    } catch {
      await copyLink(toastMsg);
    }
  }

  async function copyThenTryOpen(appUrl: string, pasteToastMsg: string) {
    await copyLink(pasteToastMsg);
    Linking.openURL(appUrl).catch(() => {
      /* app likely not installed — link is already copied, toast already shown above */
    });
  }

  const platforms: {
    key: string;
    label: string;
    color: string;
    icon: (props: { color: string }) => React.ReactElement;
    onPress: () => void;
  }[] = [
    {
      key: "whatsapp",
      label: t("واتساب"),
      color: "#25D366",
      icon: WhatsappIcon,
      onPress: () => openOrCopyFallback(`https://wa.me/?text=${encodeURIComponent(fullMessage)}`, t("تعذر فتح واتساب، تم نسخ الرابط")),
    },
    {
      key: "messenger",
      label: t("ماسنجر"),
      color: "#00B2FF",
      icon: MessengerIcon,
      onPress: async () => {
        await copyThenTryOpen("fb-messenger://", t("تم نسخ الرابط، افتح ماسنجر والصقه في المحادثة"));
      },
    },
    {
      key: "facebook",
      label: t("فيسبوك"),
      color: "#1877F2",
      icon: FacebookIcon,
      onPress: () => openOrCopyFallback(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, t("تعذر فتح فيسبوك، تم نسخ الرابط")),
    },
    {
      key: "instagram",
      label: t("انستجرام"),
      color: "#C13584",
      icon: InstagramIcon,
      onPress: async () => {
        await copyThenTryOpen("instagram://app", t("تم نسخ الرابط، افتح انستجرام والصقه في القصة أو الرسائل"));
      },
    },
    {
      key: "x",
      label: t("X"),
      color: "#111827",
      icon: XIcon,
      onPress: () => openOrCopyFallback(`https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}&url=${encodeURIComponent(link)}`, t("تعذر فتح X، تم نسخ الرابط")),
    },
    {
      key: "telegram",
      label: t("تليجرام"),
      color: "#229ED9",
      icon: TelegramIcon,
      onPress: () => openOrCopyFallback(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(caption)}`, t("تعذر فتح تليجرام، تم نسخ الرابط")),
    },
    {
      key: "tiktok",
      label: t("تيك توك"),
      color: "#000000",
      icon: TikTokIcon,
      onPress: async () => {
        await copyThenTryOpen("tiktok://", t("تم نسخ الرابط، افتح تيك توك والصقه في البايو أو الرسائل"));
      },
    },
    {
      key: "bluetooth",
      label: t("بلوتوث"),
      color: "#2196F3",
      icon: BluetoothIcon,
      // ↔ Expo has no direct Bluetooth-transfer API; the OS share sheet is
      // the closest equivalent (Android lists nearby/Bluetooth targets
      // there when available).
      onPress: () => { Share.share({ message: fullMessage }).catch(() => {}); },
    },
    {
      key: "copy",
      label: t("نسخ الرابط"),
      color: "#6b7280",
      icon: LinkIcon,
      onPress: () => copyLink(),
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...panHandlers}>
        <View style={styles.handle} />
        <Text style={styles.title}>{t("مشاركة البروفايل")}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{link}</Text>

        <View style={styles.grid}>
          {platforms.map((p) => (
            <Pressable key={p.key} style={styles.cell} onPress={() => { p.onPress(); }}>
              <View style={[styles.iconCircle, { backgroundColor: p.color }]}>
                <p.icon color="white" />
              </View>
              <Text style={styles.cellLabel} numberOfLines={1}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>{t("إلغاء")}</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

function WhatsappIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </Svg>
  );
}
function MessengerIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M2 12C2 6.5 6.5 3 12 3s10 3.5 10 9-4.5 9-10 9c-1 0-2-.15-2.9-.4L5 22l1.3-4C4.2 16.5 2 14.5 2 12z" strokeLinejoin="round" />
      <Path d="M8 13l3-3.5L13.5 12 16 8.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function FacebookIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M15 8h2V4h-2a4 4 0 00-4 4v2H9v4h2v8h4v-8h2.5l.5-4H15V8z" strokeLinejoin="round" />
    </Svg>
  );
}
function InstagramIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Rect x={3} y={3} width={18} height={18} rx={5} />
      <Circle cx={12} cy={12} r={4} />
      <Circle cx={17.2} cy={6.8} r={0.6} fill={color} stroke="none" />
    </Svg>
  );
}
function XIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2}>
      <Path d="M4 4l16 16M20 4L4 20" strokeLinecap="round" />
    </Svg>
  );
}
function TelegramIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M22 3L2 11l6 2.5M22 3l-4 18-8-6.5M22 3L8 13.5v6" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
function TikTokIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M15 3v11a3.5 3.5 0 11-3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 3a5 5 0 005 5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function BluetoothIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M7 7l10 10-5 5V2l5 5L7 17" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function LinkIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M10 14a5 5 0 007.5.5l2-2a5 5 0 00-7-7l-1.2 1.2" strokeLinecap="round" />
      <Path d="M14 10a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7l1.2-1.2" strokeLinecap="round" />
    </Svg>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
    sheet: {
      position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: themeColors.card,
      borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24, paddingTop: 6, paddingHorizontal: 18,
    },
    handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: themeColors.border, alignSelf: "center", marginVertical: 10 },
    title: { fontSize: 14.5, fontWeight: "900", color: themeColors.text, textAlign: "center" },
    subtitle: { fontSize: 11.5, color: themeColors.textSubtle, textAlign: "center", marginTop: 4, marginBottom: 6 },
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 10 },
    cell: { width: "23%", alignItems: "center", gap: 6, marginBottom: 16 },
    iconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
    cellLabel: { fontSize: 10.5, fontWeight: "700", color: themeColors.textMuted, textAlign: "center" },
    cancelBtn: { paddingVertical: 12, alignItems: "center", borderTopWidth: 1, borderTopColor: themeColors.border, marginTop: 4 },
    cancelBtnText: { fontSize: 13.5, fontWeight: "900", color: themeColors.textSubtle },
  });
}
