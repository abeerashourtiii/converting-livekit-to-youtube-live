// ↔ الميزة الدولية لإدخال رقم الهاتف — التحقق والتنسيق.
// المكتبة الوحيدة المُضافة: libphonenumber-js (الأخف بين الخيارات
// المقترحة بالمواصفة، ~145KB، بدون أي تبعية UI مربوطة بيها).
import { parsePhoneNumberFromString, AsYouType, CountryCode } from "libphonenumber-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";
import { findCountry } from "./countries";

const LAST_COUNTRY_KEY = "diarino:phoneCountry";
// ↔ نفس الدولة اللي كانت مدعومة حصريًا قبل هذه الميزة (isValidEgyptPhone
// الأصلية) — أنسب افتراضي لما اكتشاف الدولة من الجهاز يفشل.
const DEFAULT_COUNTRY = "EG";

export type PhoneValidationResult =
  | { valid: true; e164: string }
  | { valid: false; reason: string };

// ↔ localNumber هنا هو الرقم المحلي زي ما كتبه المستخدم (ممكن يكون فيه
// مسافات/شرطات من التنسيق أثناء الكتابة) — من غير كود الدولة، لأن كود
// الدولة بييجي من الدولة المختارة في الـ picker مش من نص الحقل.
export function validateAndFormatPhone(localNumber: string, countryIso2: string): PhoneValidationResult {
  const digitsOnly = localNumber.replace(/[^\d]/g, "");
  if (!digitsOnly) return { valid: false, reason: "من فضلك أدخل رقم الهاتف" };
  try {
    const parsed = parsePhoneNumberFromString(digitsOnly, countryIso2 as CountryCode);
    if (!parsed || !parsed.isValid()) {
      return { valid: false, reason: "رقم الهاتف غير صحيح لهذه الدولة" };
    }
    return { valid: true, e164: parsed.number }; // بصيغة E.164 جاهزة، مثل +201012345678
  } catch {
    return { valid: false, reason: "رقم الهاتف غير صحيح" };
  }
}

// ↔ تنسيق تلقائي أثناء الكتابة (مثل: 123 456 7890) — يُستخدم داخل
// components/shared/PhoneInput.tsx على كل ضغطة زر.
export function formatAsYouType(input: string, countryIso2: string): string {
  const formatter = new AsYouType(countryIso2 as CountryCode);
  return formatter.input(input);
}

// ↔ عكس العملية — لعرض رقم محفوظ بصيغة E.164 مرة تانية في الحقل بصيغته
// المحلية المألوفة (مثلًا عند تعديل إعلان قديم).
export function splitE164(e164: string): { countryIso2: string; localNumber: string } | null {
  try {
    const parsed = parsePhoneNumberFromString(e164);
    if (!parsed || !parsed.country) return null;
    return { countryIso2: parsed.country, localNumber: parsed.formatNational().replace(/[^\d]/g, "") };
  } catch {
    return null;
  }
}

export async function getLastSelectedCountry(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(LAST_COUNTRY_KEY);
    if (saved && findCountry(saved)) return saved;
  } catch {
    // AsyncStorage نادرًا ما يفشل، لكن لو حصل، وقوع لاكتشاف الدولة أفضل
    // من كسر الشاشة كلها.
  }
  return detectDeviceCountry();
}

export async function saveLastSelectedCountry(iso2: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_COUNTRY_KEY, iso2);
  } catch {
    // تجاهل — تذكّر آخر اختيار تحسين وليس شرطًا للعمل.
  }
}

// ↔ اكتشاف أفضل-جهد من locale الجهاز، بدون إضافة expo-localization كتبعية
// منفصلة لأجل هذه النقطة بس. NativeModules.SettingsManager (iOS) و
// I18nManager.localeIdentifier (Android) موجودين أصلًا في react-native
// نفسها. لو أي حاجة فشلت أو رجّعت قيمة مش متوقعة، بيرجع لمصر كافتراضي.
function detectDeviceCountry(): string {
  try {
    const localeTag: string | undefined =
      Platform.OS === "ios"
        ? NativeModules.SettingsManager?.settings?.AppleLocale ||
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
        : NativeModules.I18nManager?.localeIdentifier;
    const region = typeof localeTag === "string" ? localeTag.split(/[-_]/)[1] : undefined;
    if (region && findCountry(region.toUpperCase())) return region.toUpperCase();
  } catch {
    // الوصول لـ NativeModules ممكن يتصرف بشكل مختلف بين Expo Go
    // ونسخة dev build — أهم حاجة إن الخطأ ده مايكسرش شاشة اختيار الدولة.
  }
  return DEFAULT_COUNTRY;
}

// ↔ يحوّل رقم مخزّن بصيغة E.164 لصيغته المحلية المقروءة للعرض (مثلًا في
// شاشة تعديل الإعلان أو ملف البائع)، بدل عرض +201012345680 خام.
export function formatPhoneForDisplay(e164: string): string {
  try {
    const parsed = parsePhoneNumberFromString(e164);
    return parsed ? parsed.formatNational() : e164;
  } catch {
    return e164;
  }
}

// ↔ wa.me محتاج أرقام دولية كاملة بدون علامة + (عكس tel: اللي بيقبلها).
// راجع docs/PHONE_FEATURE_INTEGRATION_NOTES.md — ده بالظبط الباغ اللي
// كان موجود قبل هذه الميزة (wa.me كان بيستخدم رقم محلي بدون كود دولة
// أصلًا)؛ استخدام الدالة دي مع قيمة E.164 حقيقية هو الإصلاح.
export function phoneToWaMeDigits(e164: string): string {
  return e164.replace(/^\+/, "");
}
