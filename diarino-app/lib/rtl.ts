import { Platform, I18nManager } from "react-native";

// ↔ إصلاح "الأيقونات الجانبية (إعجاب/مشاركة/مفضلة) بتظهر يمين بدل شمال
// فى العربي، بس على أندرويد/آيفون/الـ APK — شغّالة صح على الويب": باغ
// معروف فى React Native نفسها (خاصية I18nManager.doLeftAndRightSwapInRTL
// الافتراضية) — أي عنصر position:"absolute" وعليه left أو right حرفيًا
// بيتقلب تلقائيًا (left↔right) على المنصات الأصلية لما I18nManager.isRTL
// شغالة (زي ما بيحصل هنا لما اللغة عربي، شوف useLanguage.ts). التقليب ده
// خاصية Yoga (محرك التخطيط بتاع React Native نفسه) ومالوش أي علاقة بـ
// CSS الحقيقي، فـ react-native-web (اللي بيرندر CSS حقيقي فى المتصفح)
// مبيعملوش خالص — CSS مفيهوش تقليب تلقائي لـ left/right الحرفيين مع
// direction:rtl أصلاً (ده بالظبط سبب وجود خصائص CSS منطقية زي
// inset-inline-start فى المعيار). النتيجة: نفس كود isAr ? left : right
// كان بيدّي نتيجة مختلفة فعليًا بين المنصتين.
//
// الحل: physicalSide() بتحسب مقدّمًا أنهي property حرفي (left/right)
// لازم يتكتب فعليًا فى الكود عشان الناتج المرئي النهائي — بعد أي تقليب
// تلقائي محتمل من Yoga على المنصات الأصلية — يطابق الجهة المطلوبة فعلاً
// على المنصتين مع بعض.
export function physicalSide(wantLeftVisually: boolean): "left" | "right" {
  const nativeWillAutoSwap = Platform.OS !== "web" && I18nManager.isRTL;
  const useLeftProp = wantLeftVisually !== nativeWillAutoSwap; // XOR
  return useLeftProp ? "left" : "right";
}
