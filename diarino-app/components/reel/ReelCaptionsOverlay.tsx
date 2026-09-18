import { View, Text, StyleSheet } from "react-native";
import { Property } from "../../lib/types";
import { useReelPreferences } from "../../lib/hooks/useReelPreferences";

type Props = { property: Property; isActive: boolean };

// ↔ #4 (قايمة خيارات الريل — الترجمة النصية): بيعرض نص جاهز مُخزَّن
// مسبقًا (property.captionsAr/captionsEn) باللغة اللي المستخدم اختارها.
//
// ⚠️ صريح: ده مش محرك ترجمة تلقائية حقيقي — لو الريل معندوش نص باللغة
// المطلوبة بس عنده باللغة التانية، بيعرض المتاح بدل ما يختفي فجأة (أوضح
// من مفيش حاجة خالص)، ولو معندوش أي نص خالص بيسكت من غير ما يخترع نص
// ومن غير أي toast لكل ريل (تنبيه واحد عام عند تفعيل الخاصية نفسها من
// ReelOptionsSheet.tsx كافٍ — toast لكل ريل هيبقى إزعاج فعلي دلوقتي لأن
// أغلب الإعلانات لسه من غير نص). قرار #3: ترجمة تلقائية AR↔EN حقيقية
// محتاجة تكامل مع خدمة خارجية — شوف docs/deferred-tasks.md.
export function ReelCaptionsOverlay({ property, isActive }: Props) {
  const { captionsEnabled, captionsLanguage } = useReelPreferences();

  // ↔ الخاصية متوقّفة مؤقتًا بالكامل (قرار "قريبًا سيتم تفعيل الخاصية"
  // فى ReelOptionsSheet.tsx) — لو حد عنده captionsEnabled=true محفوظة من
  // قبل، بره ده بيمنعها تظهر برضه لحد ما الخاصية تبقى جاهزة فعليًا.
  // شيل السطر ده وقتها للرجوع للسلوك العادي.
  if (true) return null;

  const text = captionsLanguage === "ar"
    ? (property.captionsAr || property.captionsEn || null)
    : (property.captionsEn || property.captionsAr || null);

  if (!captionsEnabled || !isActive || !text) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.bubble}>
        <Text style={styles.text} numberOfLines={3}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 24, right: 24, bottom: "32%", alignItems: "center" },
  bubble: { backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  text: { color: "white", fontSize: 13.5, fontWeight: "700", textAlign: "center", lineHeight: 19 },
});
