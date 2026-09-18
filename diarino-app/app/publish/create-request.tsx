import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import Svg, { Path } from "react-native-svg";
import { FormLabel, FormError, FormInput, ChipRow, HelpBox } from "../../components/publish/FormControls";
import { ProvinceAutocomplete } from "../../components/publish/ProvinceAutocomplete";
import { useCreateRequest } from "../../lib/hooks/useRequests";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useDraftById, useDraftMutations } from "../../lib/hooks/useDrafts";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";
import { signOut } from "../../lib/hooks/useAuth";

const TYPES = ["شقة", "فيلا", "بنتهاوس", "تاون هاوس", "تجاري", "إداري", "طبي", "أرض"];

const FIELD_LABELS: Record<string, string> = {
  purpose: "الغرض (بيع/إيجار)", type: "نوع العقار", province: "المحافظة", location: "المنطقة",
  description: "الوصف", name: "الاسم",
};

export default function CreateRequestScreen() {
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const { draftId } = useLocalSearchParams<{ draftId?: string }>();
  const { data: draft } = useDraftById(draftId);
  const { save: saveDraft, remove: removeDraft } = useDraftMutations();
  const createRequest = useCreateRequest();

  // معرف المسودة الحالي (يتحدث تلقائيًا فور الحفظ الأول)
  const [currentDraftId, setCurrentDraftId] = useState<string | undefined>(draftId);

  const [purpose, setPurpose] = useState<"sale" | "rent" | "">("");
  const [type, setType] = useState("");
  const [province, setProvince] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [area, setArea] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  // تحميل بيانات المسودة عند فتح الشاشة
  useEffect(() => {
    if (!draft) return;
    const d = draft.data as Record<string, unknown>;
    if (d.purpose !== undefined) setPurpose(d.purpose as "sale" | "rent" | "");
    if (d.type !== undefined) setType(d.type as string);
    if (d.province !== undefined) setProvince(d.province as string);
    if (d.location !== undefined) setLocation(d.location as string);
    if (d.description !== undefined) setDescription(d.description as string);
    if (d.price !== undefined) setPrice(d.price as string);
    if (d.area !== undefined) setArea(d.area as string);
    if (d.name !== undefined) setName(d.name as string);
    setCurrentDraftId(draft.id);
  }, [draft?.id]);

  function validate(): boolean {
    const errs = new Set<string>();
    if (!purpose) errs.add("purpose");
    if (!type) errs.add("type");
    if (!province) errs.add("province");
    if (!location.trim()) errs.add("location");
    if (!description.trim()) errs.add("description");
    if (!name.trim()) errs.add("name");
    setErrors(errs);
    if (errs.size > 0) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      const missing = Array.from(errs).map((k) => FIELD_LABELS[k] || k).join("، ");
      Alert.alert(t("أكمل البيانات الناقصة"), missing);
    }
    return errs.size === 0;
  }

  async function handleSaveDraft() {
    setSavingDraft(true);
    try {
      const savedId = await saveDraft.mutateAsync({
        id: currentDraftId,
        draftType: "request",
        title: description.trim().slice(0, 40) || null,
        data: { purpose, type, province, location, description, price, area, name },
      });
      setCurrentDraftId(savedId);
      Alert.alert(t("تم الحفظ"), t("اتحفظت المسودة، تقدر تكمل تعديلها في أي وقت من صفحة حسابي."));
      router.back();
    } catch (err) {
      Alert.alert(t("حدث خطأ"), t("تعذر حفظ المسودة، حاول مرة أخرى."));
    } finally {
      setSavingDraft(false);
    }
  }

  async function submit() {
    if (!validate()) return;
    if (!user) return;

    setSubmitting(true);
    try {
      await createRequest.mutateAsync({
        purpose: purpose as "sale" | "rent",
        type,
        province,
        location: location.trim(),
        priceMax: price ? Number(price) : 0,
        area: area || "",
        rooms: "",
        baths: "",
        description: description.trim(),
        requesterName: name.trim(),
        requesterId: user.id,
      });

      if (currentDraftId) {
        removeDraft.mutate(currentDraftId);
      }

      router.replace("/(tabs)/account?tab=requests");
    } catch (err) {
      Alert.alert(t("تعذر نشر الطلب"), t("حاول مرة أخرى."));
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={themeColors.text} strokeWidth={2}><Path d="M18 6L6 18M6 6l12 12" /></Svg>
          </Pressable>
          <Text style={styles.headerTitle}>{t("اطلب عقارك")}</Text>
          <View style={{ width: 34 }} />
        </View>
        <View style={styles.authRequiredBox}>
          <Text style={styles.authRequiredTitle}>{t("يجب تسجيل الدخول لنشر طلب")}</Text>
          <Text style={styles.authRequiredSubtitle}>{t("سجّل الدخول من أجل إتمام النشر ومشاركة طلبك مع البائعين.")}</Text>
          <Pressable style={styles.authRequiredBtn} onPress={async () => { await signOut(); router.replace("/"); }}>
            <Text style={styles.authRequiredBtnText}>{t("تسجيل الدخول")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={themeColors.text} strokeWidth={2}><Path d="M18 6L6 18M6 6l12 12" /></Svg>
        </Pressable>
        <Text style={styles.headerTitle}>{t("اطلب عقارك")}</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <HelpBox title="كيف تعمل صفحة الطلبات؟">
          اكتب وصف ما تبحث عنه، وسيتواصل معك البائعون بعروضهم عبر الشات.
        </HelpBox>

        <FormLabel text="الغرض" required />
        <ChipRow options={["sale", "rent"]} value={purpose} onChange={setPurpose} labels={{ sale: "أريد الشراء", rent: "أريد الإيجار" }} />
        <FormError text="من فضلك اختر الغرض" show={errors.has("purpose")} />

        <FormLabel text="نوع العقار" required />
        <ChipRow options={TYPES} value={type} onChange={setType} />
        <FormError text="من فضلك اختر نوع العقار" show={errors.has("type")} />

        <FormLabel text="المحافظة" required />
        <ProvinceAutocomplete value={province} onChange={setProvince} error={errors.has("province")} />
        <FormError text="من فضلك اختر المحافظة" show={errors.has("province")} />

        <FormLabel text="المنطقة / الكمبوند" required />
        <FormInput value={location} onChangeText={setLocation} placeholder="مثال: الحي 16، كمبوند ..." error={errors.has("location")} />
        <FormError text="من فضلك أدخل المنطقة" show={errors.has("location")} />

        <FormLabel text="الوصف" required />
        <FormInput value={description} onChangeText={setDescription} placeholder="اكتب تفاصيل ما تبحث عنه ..." multiline numberOfLines={4} style={{ minHeight: 90, textAlignVertical: "top" }} error={errors.has("description")} />
        <FormError text="من فضلك أدخل الوصف" show={errors.has("description")} />

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <FormLabel text="السعر حتى (ج.م)" optional />
            <FormInput value={price} onChangeText={setPrice} placeholder="4000000" keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <FormLabel text="المساحة (م²)" optional />
            <FormInput value={area} onChangeText={setArea} placeholder="150" keyboardType="number-pad" />
          </View>
        </View>

        <FormLabel text="اسمك" required />
        <FormInput value={name} onChangeText={setName} placeholder="مثال: محمود علي" error={errors.has("name")} />
        <FormError text="من فضلك أدخل اسمك" show={errors.has("name")} />
      </ScrollView>

      <View style={styles.submitBar}>
        <Pressable style={[styles.draftBtn, (savingDraft || submitting) && styles.submitBtnDisabled]} onPress={handleSaveDraft} disabled={savingDraft || submitting}>
          {savingDraft ? <ActivityIndicator color="#4338CA" size="small" /> : <Text style={styles.draftBtnText}>{t("حفظ كمسودة")}</Text>}
        </Pressable>
        <Pressable style={[styles.submitBtn, { flex: 1 }, (submitting || savingDraft) && styles.submitBtnDisabled]} onPress={submit} disabled={submitting || savingDraft}>
          {submitting ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>{t("نشر الطلب")}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    header: { paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: themeColors.border },
    closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: themeColors.surface, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 14, fontWeight: "900", color: themeColors.text },
    row2: { flexDirection: "row", gap: 12 },
    submitBar: { flexDirection: "row", gap: 10, padding: 14, paddingBottom: 26, borderTopWidth: 1, borderTopColor: themeColors.border, backgroundColor: themeColors.background },
    submitBtn: { backgroundColor: "#4338CA", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    submitBtnText: { color: "white", fontWeight: "900", fontSize: 14 },
    submitBtnDisabled: { backgroundColor: "#A5B4FC" },
    draftBtn: { flex: 1, borderWidth: 1.5, borderColor: "#4338CA", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    draftBtnText: { color: "#4338CA", fontWeight: "900", fontSize: 13 },
    authRequiredBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    authRequiredTitle: { fontSize: 18, fontWeight: "900", color: themeColors.text, textAlign: "center", marginBottom: 8 },
    authRequiredSubtitle: { fontSize: 14, color: themeColors.textSubtle, textAlign: "center", marginBottom: 24 },
    authRequiredBtn: { backgroundColor: "#22A652", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
    authRequiredBtnText: { color: "white", fontSize: 14, fontWeight: "900" },
  });
}