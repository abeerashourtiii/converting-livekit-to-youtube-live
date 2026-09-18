import { View, Pressable, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { Property } from "../../lib/types";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";
import { useSellerContentSettings } from "../../lib/hooks/useContentSettings";
import { useSellerContactPhone } from "../../lib/hooks/useProperties";
import { openOrCreateChat } from "../../lib/hooks/useChatsDB";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors } from "../../lib/hooks/useThemeColors";
import { supabase } from "../../lib/supabase";
import { openExternalUrl } from "../../lib/linking";
import { phoneToWaMeDigits } from "../../lib/phone";

// ↔ استخرجت من app/property/[id].tsx — نفس المنطق بالضبط، لكن رقم
// الهاتف بقى بييجي من useSellerContactPhone (الدالة الآمنة الجديدة)
// بدل property.seller.phone اللي بقى فاضي دايمًا دلوقتي (شوف الكومنت
// فوق SELECT_DETAIL فى lib/hooks/useProperties.ts).
export function PropertyCtaBar({ property }: { property: Property }) {
  const { t } = useLanguage();
  const { user } = useCurrentUser();
  const { data: sellerSettings } = useSellerContentSettings(property.seller.id);
  const { data: contactPhone } = useSellerContactPhone(property.id);
  const themeColors = useThemeColors();

  function openWhatsapp() {
    if (!contactPhone) return;
    openExternalUrl(
      `https://wa.me/${phoneToWaMeDigits(contactPhone)}?text=${encodeURIComponent(`مهتم بعقارك: ${property.title}`)}`,
      t("تعذر فتح واتساب")
    );
    // Fire-and-forget: feeds the admin dashboard's "تحويلات واتساب" stat.
    supabase.rpc("increment_wa_clicks", { property_id: property.id }).then(({ error }) => {
      if (error) console.warn("Failed to record WhatsApp click:", error);
    });
  }

  async function openChat() {
    if (!user) return;
    // ↔ demo/seed listings (merged in from data/mock-properties.ts) have
    // a placeholder seller id that isn't a real auth user.
    const isRealSeller = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(property.seller.id);
    if (!isRealSeller) {
      Alert.alert(t("هذا إعلان تجريبي"), t("لا يمكن بدء محادثة مع هذا الإعلان."));
      return;
    }
    const chatId = await openOrCreateChat(user.id, property.seller.id, property.id);
    router.push(`/chat/${chatId}`);
  }

  return (
    <View style={[styles.ctaBar, { backgroundColor: themeColors.card, borderTopColor: themeColors.border }]}>
      {(sellerSettings?.chatOnProperties ?? true) && (
        <Pressable style={styles.chatBtn} onPress={openChat}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#22A652" strokeWidth={2}>
            <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </Svg>
        </Pressable>
      )}
      {/* ↔ أيقونة الواتساب بقت جنب أيقونة الشات مباشرة (بدل زرار عريض
          منفصل بنص "تواصل عبر واتساب")، بنفس حجم وشكل زرار الشات — لسه
          بتتفعّل/تتخفي بنفس شرط الإعدادات (showWhatsapp) زي الأول. */}
      {(sellerSettings?.showWhatsapp ?? true) && !!contactPhone && (
        <Pressable style={styles.whatsappIconBtn} onPress={openWhatsapp}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="white">
            <Path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2.05 22l5.42-1.32a9.85 9.85 0 004.57 1.14h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.13c-.24.68-1.4 1.3-1.93 1.35-.5.05-1.13.07-1.82-.12a17.7 17.7 0 01-1.67-.61c-2.93-1.26-4.85-4.2-5-4.4-.15-.2-1.2-1.6-1.2-3.05s.76-2.16 1.03-2.46c.27-.3.6-.37.8-.37h.57c.19 0 .43-.03.66.51.24.55.83 1.9.9 2.05.07.14.12.31.02.5-.1.2-.15.31-.3.48l-.42.5c-.15.14-.3.3-.13.6.17.3.75 1.24 1.6 2 1.1.98 2.03 1.29 2.32 1.44.3.15.47.13.65-.07.17-.2.73-.85.93-1.14.2-.3.4-.24.66-.14.27.1 1.7.8 1.99.95.3.14.49.21.56.33.07.13.07.72-.17 1.4z" />
          </Svg>
        </Pressable>
      )}
      {(sellerSettings?.showCallButton ?? true) && !!contactPhone && (
        <Pressable style={styles.chatBtn} onPress={() => openExternalUrl(`tel:${contactPhone}`, t("تعذر إجراء الاتصال"))}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#22A652" strokeWidth={2}>
            <Path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3.1-8.7A2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .3 2 .7 3a2 2 0 01-.5 2.1L7.9 10.3a16 16 0 006 6l1.5-1.4a2 2 0 012.1-.5c1 .4 2 .6 3 .7a2 2 0 011.7 2z" />
          </Svg>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ctaBar: {
    flexDirection: "row", gap: 10, padding: 14, paddingBottom: 28,
    borderTopWidth: 1,
  },
  chatBtn: { width: 48, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: "#22A652", alignItems: "center", justifyContent: "center" },
  whatsappIconBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#25D366", alignItems: "center", justifyContent: "center" },
});
