import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator, Modal, FlatList, Platform } from "react-native";
import { Image } from "expo-image";
import Svg, { Path, Circle } from "react-native-svg";
import * as ImagePicker from "expo-image-picker";
import { useLanguage } from "../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../lib/hooks/useThemeColors";
import { useCurrentUser } from "../lib/hooks/useCurrentUser";
import { useProfile } from "../lib/hooks/useProfile";
import { useLogMedia } from "../lib/hooks/useMedia";
import { uploadToCloudinary, cldOptimized } from "../lib/cloudinary";
import { FormLabel, FormInput, ChipRow } from "../components/publish/FormControls";
import { ProvinceAutocomplete } from "../components/publish/ProvinceAutocomplete";
import { PhoneInput, PhoneInputValue } from "../components/shared/PhoneInput";
import { validateAndFormatPhone, splitE164 } from "../lib/phone";
import { findCountry } from "../lib/countries";
import { CountryPickerModal } from "../components/shared/CountryPickerModal";
import { COUNTRIES } from "../lib/countries";
import { logAndGetSafeMessage } from "../lib/errors";
import { signOut } from "../lib/hooks/useAuth";

export default function EditProfileScreen() {
  const { t, language } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const { user, loading: userLoading } = useCurrentUser();
  const { profile, isLoading, update } = useProfile();
  const logMedia = useLogMedia();

  useEffect(() => {
    if (userLoading) return;
    if (!user || user.is_anonymous) {
      signOut().finally(() => router.replace("/"));
    }
  }, [user, userLoading]);

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [datePickerField, setDatePickerField] = useState<"day" | "month" | "year" | null>(null);
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [nationalityCode, setNationalityCode] = useState("");
  const [nationalityPickerVisible, setNationalityPickerVisible] = useState(false);
  const [residence, setResidence] = useState("");
  const [phone, setPhone] = useState<PhoneInputValue>({ countryIso2: "", localNumber: "" });
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || !profile) return;
    setAvatarUri(profile.avatarUrl);
    setFirstName(profile.firstName ?? "");
    setLastName(profile.lastName ?? "");
    if (profile.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(profile.birthDate)) {
      const [y, m, d] = profile.birthDate.split("-");
      setBirthYear(y);
      setBirthMonth(m);
      setBirthDay(d);
    }
    setGender(profile.gender ?? "");
    setNationalityCode(profile.nationality ?? "");
    setResidence(profile.residence ?? "");
    if (profile.phoneE164) {
      const split = splitE164(profile.phoneE164);
      setPhone({
        countryIso2: split?.countryIso2 ?? (profile.phoneCountryCode ? (findCountry(profile.phoneCountryCode)?.code ?? "") : ""),
        localNumber: split?.localNumber ?? "",
      });
    } else {
      setPhone({ countryIso2: "", localNumber: "" });
    }
    setHydrated(true);
  }, [profile, hydrated]);

  const nationalityCountry = COUNTRIES.find((c) => c.code === nationalityCode);

  const MONTH_NAMES_AR = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 100 }, (_, i) => String(currentYear - 13 - i)),
    [currentYear]
  );
  const monthOptions = useMemo(
    () => MONTH_NAMES_AR.map((name, i) => ({ value: String(i + 1).padStart(2, "0"), label: name })),
    []
  );
  const dayOptions = useMemo(() => {
    const monthNum = birthMonth ? parseInt(birthMonth, 10) : 0;
    const yearNum = birthYear ? parseInt(birthYear, 10) : 0;
    const daysInMonth = monthNum && yearNum ? new Date(yearNum, monthNum, 0).getDate() : 31;
    return Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0"));
  }, [birthMonth, birthYear]);

  function deriveUsername(first: string, last: string, userId: string): string | undefined {
    const base = `${first}${last}`
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\u0600-\u06FF]/g, "");
    if (!base) return undefined;
    const suffix = userId.replace(/-/g, "").slice(-4);
    return `${base}${suffix}`;
  }

  async function pickAvatar() {
    if (!user?.id) return;

    if (Platform.OS !== "web") {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(t("الصلاحية مطلوبة"), t("يرجى إعطاء صلاحية الوصول للصور لاختيار صورة البروفايل."));
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;
    const uri = result.assets[0].uri;
    try {
      const uploadResult = await uploadToCloudinary(uri, "image");
      logMedia.mutate({ ownerId: user.id, type: "image", context: "avatar", result: uploadResult });
      setAvatarUri(uploadResult.url);
      await update.mutateAsync({ avatarUrl: uploadResult.url });
    } catch {
      Alert.alert(t("تعذر رفع الصورة"), t("حاول مرة أخرى."));
    }
  }

  async function handleSave() {
    if (!user || user.is_anonymous) {
      Alert.alert(t("تسجيل الدخول مطلوب"), t("سجّل الدخول أولاً لتعديل بيانات حسابك."));
      await signOut();
      router.replace("/");
      return;
    }
    let phonePatch: Partial<{ phoneE164: string; phoneCountryCode: string; phoneCountryName: string }> = {};
    if (phone.localNumber.trim()) {
      const country = findCountry(phone.countryIso2);
      const result = validateAndFormatPhone(phone.localNumber, phone.countryIso2);
      if (!result.valid) {
        Alert.alert(t("رقم الهاتف غير صحيح"), t("تأكد من كتابة رقم الهاتف بشكل صحيح."));
        return;
      }
      phonePatch = { phoneE164: result.e164, phoneCountryCode: country?.callingCode ?? undefined, phoneCountryName: country?.nameAr ?? undefined };
    }

    const filledDateParts = [birthDay, birthMonth, birthYear].filter(Boolean).length;
    if (filledDateParts > 0 && filledDateParts < 3) {
      Alert.alert(t("تاريخ الميلاد غير مكتمل"), t("اختر اليوم والشهر والسنة الثلاثة، أو اتركهم فارغين."));
      return;
    }
    const composedBirthDate = filledDateParts === 3 ? `${birthYear}-${birthMonth}-${birthDay}` : undefined;
    setSaving(true);

    try {
      const basePayload = {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        fullName: [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || undefined,
        birthDate: composedBirthDate,
        gender: gender || undefined,
        nationality: nationalityCode || undefined,
        residence: residence.trim() || undefined,
        ...phonePatch,
      };
      const derivedUsername = deriveUsername(firstName.trim(), lastName.trim(), user.id);

      try {
        await update.mutateAsync({ ...basePayload, username: derivedUsername });
      } catch (e: unknown) {
        const errorWithCode = e as { message?: string; code?: string };
        const isUsernameConflict = errorWithCode.code === "23505" || errorWithCode.message?.includes("duplicate");
        if (isUsernameConflict && derivedUsername) {
          await update.mutateAsync({ ...basePayload, username: `${derivedUsername}${Math.floor(Math.random() * 90 + 10)}` });
        } else {
          throw e;
        }
      }
      router.back();
    } catch (e: unknown) {
      const msg = logAndGetSafeMessage("EditProfile.save", e, t("تعذر حفظ البيانات، تحقق من تسجيل الدخول وحاول مرة أخرى"));
      Alert.alert(t("خطأ"), msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={themeColors.text} strokeWidth={2}>
            <Path d="M18 6L6 18M6 6l12 12" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>{t("تعديل بيانات الحساب")}</Text>
        <Pressable onPress={handleSave} disabled={saving} hitSlop={8}>
          {saving ? <ActivityIndicator color="#22A652" /> : <Text style={styles.saveText}>{t("حفظ")}</Text>}
        </Pressable>
      </View>

      {isLoading && !hydrated ? (
        <View style={styles.loadingWrap}><ActivityIndicator color="#22A652" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Pressable style={styles.avatarWrap} onPress={pickAvatar}>
            {avatarUri ? (
              <Image source={{ uri: cldOptimized(avatarUri, "w_300,h_300,c_fill,q_auto,f_auto") }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="#22A652" strokeWidth={2}>
                <Circle cx={12} cy={8} r={4} /><Path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
              </Svg>
            )}
            <View style={styles.avatarEditBadge}>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                <Path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </Svg>
            </View>
          </Pressable>

          <FormLabel text={t("الاسم الأول")} optional />
          <FormInput value={firstName} onChangeText={setFirstName} placeholder={t("الاسم الأول")} />

          <FormLabel text={t("الاسم الثاني")} optional />
          <FormInput value={lastName} onChangeText={setLastName} placeholder={t("الاسم الثاني")} />

          <FormLabel text={t("تاريخ الميلاد")} optional />
          <View style={styles.dateRow}>
            <Pressable style={[styles.selectBox, styles.dateBox]} onPress={() => setDatePickerField("day")}>
              <Text style={birthDay ? styles.selectText : styles.selectPlaceholder}>{birthDay || t("يوم")}</Text>
            </Pressable>
            <Pressable style={[styles.selectBox, styles.dateBox]} onPress={() => setDatePickerField("month")}>
              <Text style={birthMonth ? styles.selectText : styles.selectPlaceholder} numberOfLines={1}>
                {birthMonth ? monthOptions.find((m) => m.value === birthMonth)?.label : t("شهر")}
              </Text>
            </Pressable>
            <Pressable style={[styles.selectBox, styles.dateBox]} onPress={() => setDatePickerField("year")}>
              <Text style={birthYear ? styles.selectText : styles.selectPlaceholder}>{birthYear || t("سنة")}</Text>
            </Pressable>
          </View>

          <FormLabel text={t("الجنس")} optional />
          <ChipRow options={["male", "female"]} value={gender} onChange={setGender} labels={{ male: "ذكر", female: "أنثى" }} />

          <FormLabel text={t("الجنسية")} optional />
          <Pressable style={styles.selectBox} onPress={() => setNationalityPickerVisible(true)}>
            <Text style={nationalityCountry ? styles.selectText : styles.selectPlaceholder}>
              {nationalityCountry ? (language === "ar" ? nationalityCountry.nameAr : nationalityCountry.nameEn) : t("اختر الجنسية")}
            </Text>
          </Pressable>

          <FormLabel text={t("الإقامة")} optional />
          <ProvinceAutocomplete value={residence} onChange={setResidence} />

          <FormLabel text={t("رقم الهاتف")} optional />
          <PhoneInput value={phone} onChange={setPhone} />

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <CountryPickerModal
        visible={nationalityPickerVisible}
        selectedCode={nationalityCode}
        onSelect={(c) => { setNationalityCode(c.code); setNationalityPickerVisible(false); }}
        onClose={() => setNationalityPickerVisible(false)}
      />

      <Modal visible={datePickerField !== null} transparent animationType="fade" onRequestClose={() => setDatePickerField(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDatePickerField(null)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>
              {datePickerField === "day" ? t("اليوم") : datePickerField === "month" ? t("الشهر") : t("السنة")}
            </Text>
            <FlatList
              data={datePickerField === "day" ? dayOptions : datePickerField === "month" ? monthOptions.map((m) => m.value) : yearOptions}
              keyExtractor={(v) => v}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => {
                const label = datePickerField === "month" ? monthOptions.find((m) => m.value === item)?.label : item;
                return (
                  <Pressable
                    style={styles.modalOption}
                    onPress={() => {
                      if (datePickerField === "day") setBirthDay(item);
                      else if (datePickerField === "month") setBirthMonth(item);
                      else if (datePickerField === "year") setBirthYear(item);
                      setDatePickerField(null);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{label}</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingTop: Platform.OS === "ios" ? 58 : Platform.OS === "android" ? 42 : 20,
      paddingBottom: 14,
      backgroundColor: themeColors.background,
    },
    closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: themeColors.surface, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 15, fontWeight: "900", color: themeColors.text },
    saveText: { fontSize: 14, fontWeight: "900", color: "#22A652" },
    loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
    scroll: { padding: 16, paddingBottom: 40 },
    avatarWrap: {
      width: 96, height: 96, borderRadius: 48, backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ecfdf5",
      alignItems: "center", justifyContent: "center", overflow: "hidden", alignSelf: "center", marginBottom: 24, position: "relative",
    },
    avatarEditBadge: { position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: "#111827", borderWidth: 2, borderColor: themeColors.background, alignItems: "center", justifyContent: "center" },
    selectBox: { backgroundColor: themeColors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 14 },
    selectText: { fontSize: 13.5, fontWeight: "700", color: themeColors.text },
    selectPlaceholder: { fontSize: 13.5, fontWeight: "700", color: themeColors.textSubtle },
    dateRow: { flexDirection: "row", gap: 8 },
    dateBox: { flex: 1, alignItems: "center" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    modalSheet: { backgroundColor: themeColors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 24, maxHeight: "60%" },
    modalTitle: { fontSize: 14, fontWeight: "900", color: themeColors.text, textAlign: "center", marginBottom: 8 },
    modalOption: { paddingVertical: 13, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border },
    modalOptionText: { fontSize: 14, fontWeight: "700", color: themeColors.text, textAlign: "center" },
  });
}