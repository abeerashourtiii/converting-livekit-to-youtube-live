import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import * as Location from "expo-location";
import Svg, { Path } from "react-native-svg";
import { FormLabel, FormError, FormInput, ChipRow, MultiChipRow, HelpBox } from "../../components/publish/FormControls";
import { ProvinceAutocomplete } from "../../components/publish/ProvinceAutocomplete";
import { SocialShareSection } from "../../components/publish/SocialShareSection";
import { PhoneInput, PhoneInputValue } from "../../components/shared/PhoneInput";
import { SocialPlatform } from "../../lib/hooks/useSocialShareLinks";
import { MediaItem, Purpose } from "../../lib/types";
import { usePropertyById, useCreateProperty, useUpdateProperty } from "../../lib/hooks/useProperties";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { supabase } from "../../lib/supabase";
import { uploadToCloudinary } from "../../lib/cloudinary";
import { validateAndFormatPhone, splitE164 } from "../../lib/phone";
import { findCountry } from "../../lib/countries";
import { useLogMedia } from "../../lib/hooks/useMedia";
import { useDraftById, useDraftMutations } from "../../lib/hooks/useDrafts";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";
import { signOut } from "../../lib/hooks/useAuth";

const TYPES = ["شقة", "فيلا", "بنتهاوس", "تاون هاوس", "تجاري", "إداري", "طبي", "أرض"];
const FINISH_TYPES = ["بدون تشطيب", "نصف تشطيب", "تشطيب كامل", "لوكس", "سوبر لوكس", "الترا لوكس"];
const FEATURES = [
  "حديقة", "جراج", "أمن وحراسة", "مطبخ مجهز", "مصعد", "حمام سباحة", "تراس",
  "مفروش", "مكيف", "خط أرضي", "عداد كهرباء", "عداد مياه", "عداد غاز طبيعي",
];
const MUSIC_OPTIONS = [
  { key: "Uplifting Corporate", note: "🎵", desc: "موسيقى حماسية" },
  { key: "Chill Lounge", note: "🎶", desc: "هادئة وعصرية" },
  { key: "Acoustic Morning", note: "🎸", desc: "جيتار هادئ" },
  { key: "Oriental Vibes", note: "🪕", desc: "شرقية خفيفة" },
  { key: "Modern Beat", note: "🥁", desc: "إيقاع عصري" },
];
const MAX_VIDEO_SEC = 5 * 60;

export default function CreateListingScreen() {
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const { editId, draftId } = useLocalSearchParams<{ editId?: string; draftId?: string }>();
  const editingAd = usePropertyById(editId);
  const { data: draft } = useDraftById(draftId);
  const { save: saveDraft, remove: removeDraft } = useDraftMutations();
  const createProperty = useCreateProperty();
  const updateProperty = useUpdateProperty();
  const logMedia = useLogMedia();
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  // معرف المسودة الحالي (يتحدث إذا قمنا بحفظ مسودة جديدة أثناء التتواجد بالشاشة)
  const [currentDraftId, setCurrentDraftId] = useState<string | undefined>(draftId);

  const [purpose, setPurpose] = useState<Purpose | "">("");
  const [type, setType] = useState("");
  const [province, setProvince] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [area, setArea] = useState("");
  const [rooms, setRooms] = useState("");
  const [baths, setBaths] = useState("");
  const [reception, setReception] = useState("");
  const [floor, setFloor] = useState("");
  const [payment, setPayment] = useState<"cash" | "installment" | "">("");
  const [negotiable, setNegotiable] = useState<"yes" | "no" | "">("");
  const [features, setFeatures] = useState<Set<string>>(new Set());
  const [finishType, setFinishType] = useState("");
  const [finishTypeOpen, setFinishTypeOpen] = useState(false);
  const [status, setStatus] = useState<"ready" | "building" | "">("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [shortTitle, setShortTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoItem, setVideoItem] = useState<MediaItem | null>(null);
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null);
  const [coverItem, setCoverItem] = useState<MediaItem | null>(null);
  const [music, setMusic] = useState("");
  const [phone, setPhone] = useState<PhoneInputValue>({ countryIso2: "", localNumber: "" });
  const [sharePlatforms, setSharePlatforms] = useState<Set<SocialPlatform>>(new Set());
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null);

  // تحميل بيانات الإعلان عند التعديل
  useEffect(() => {
    if (!editingAd) return;
    setPurpose(editingAd.purpose);
    setType(editingAd.type);
    setProvince(editingAd.province);
    setLocation(editingAd.location);
    setPrice(String(editingAd.price));
    setArea(String(editingAd.area));
    setRooms(String(editingAd.rooms));
    setBaths(String(editingAd.baths));
    setReception(String(editingAd.reception));
    setFeatures(new Set(editingAd.features));
    setFinishType(editingAd.finishType || "");
    setStatus(editingAd.status || "");
    setDeliveryDate(editingAd.deliveryDate || "");
    setFloor(editingAd.floor != null ? String(editingAd.floor) : "");
    setPayment(editingAd.payment || "");
    setNegotiable(editingAd.negotiable === undefined ? "" : editingAd.negotiable ? "yes" : "no");
    setShortTitle(editingAd.shortTitle || editingAd.title);
    setDescription(editingAd.description);
    setVideoItem(editingAd.media.find((m) => m.type === "video") ?? null);
    setCoverItem(editingAd.media.find((m) => m.type === "image") ?? null);
    setMusic(editingAd.music || "");
    const split = editingAd.seller.phone ? splitE164(editingAd.seller.phone) : null;
    setPhone(split ? { countryIso2: split.countryIso2, localNumber: split.localNumber } : { countryIso2: "", localNumber: "" });
    setSharePlatforms(new Set((editingAd.sharePlatforms || []) as SocialPlatform[]));
  }, [editingAd?.id]);

  // تحميل بيانات المسودة
  useEffect(() => {
    if (!draft) return;
    const d = draft.data as Record<string, any>;
    if (d.purpose !== undefined) setPurpose(d.purpose);
    if (d.type !== undefined) setType(d.type);
    if (d.province !== undefined) setProvince(d.province);
    if (d.location !== undefined) setLocation(d.location);
    if (d.price !== undefined) setPrice(d.price);
    if (d.area !== undefined) setArea(d.area);
    if (d.rooms !== undefined) setRooms(d.rooms);
    if (d.baths !== undefined) setBaths(d.baths);
    if (d.reception !== undefined) setReception(d.reception);
    if (d.floor !== undefined) setFloor(d.floor);
    if (d.payment !== undefined) setPayment(d.payment);
    if (d.negotiable !== undefined) setNegotiable(d.negotiable);
    if (d.features && Array.isArray(d.features)) setFeatures(new Set(d.features));
    if (d.finishType !== undefined) setFinishType(d.finishType);
    if (d.status !== undefined) setStatus(d.status);
    if (d.deliveryDate !== undefined) setDeliveryDate(d.deliveryDate);
    if (d.shortTitle !== undefined) setShortTitle(d.shortTitle);
    if (d.description !== undefined) setDescription(d.description);
    if (d.videoItem !== undefined) setVideoItem(d.videoItem);
    if (d.coverItem !== undefined) setCoverItem(d.coverItem);
    if (d.music !== undefined) setMusic(d.music);
    if (d.phone !== undefined) setPhone(d.phone);
    if (d.sharePlatforms && Array.isArray(d.sharePlatforms)) setSharePlatforms(new Set(d.sharePlatforms));
    setCurrentDraftId(draft.id);
  }, [draft?.id]);

  function currentFormAsDraftData() {
    return {
      purpose, type, province, location, price, area, rooms, baths, reception, floor,
      payment, negotiable, features: Array.from(features), finishType, status, deliveryDate,
      shortTitle, description, videoItem, coverItem, music, phone, sharePlatforms: Array.from(sharePlatforms),
    };
  }

  async function handleSaveDraft() {
    setSavingDraft(true);
    try {
      const savedId = await saveDraft.mutateAsync({
        id: currentDraftId,
        draftType: "listing",
        title: shortTitle.trim() || null,
        data: currentFormAsDraftData(),
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

  function onShortTitleChange(v: string) {
    const words = v.split(/\s+/).filter(Boolean);
    if (words.length > 7) return;
    setShortTitle(v);
  }

  function toggleSharePlatform(platform: SocialPlatform) {
    setSharePlatforms((prev) => {
      const next = new Set(prev);
      next.has(platform) ? next.delete(platform) : next.add(platform);
      return next;
    });
  }

  async function pickVideo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.duration && asset.duration / 1000 > MAX_VIDEO_SEC) {
      Alert.alert(t("الفيديو طويل جدًا"), t("الحد الأقصى لمدة الفيديو ٥ دقائق."));
      return;
    }
    setVideoItem({ type: "video", url: asset.uri });
    setVideoDurationMs(asset.duration ?? null);
  }

  async function pickCoverImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setCoverItem({ type: "image", url: result.assets[0].uri });
  }

  async function generateCoverFromVideo(videoUri: string): Promise<MediaItem | null> {
    try {
      const duration = videoDurationMs && videoDurationMs > 0 ? videoDurationMs : 6000;
      const randomTimeMs = Math.floor(duration * 0.1 + Math.random() * duration * 0.7);
      const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: randomTimeMs, quality: 0.8 });
      return { type: "image", url: uri };
    } catch (err) {
      console.warn("Failed to generate a cover frame from the video:", err);
      return null;
    }
  }

  async function uploadLocalMedia(sellerId: string, items: MediaItem[]): Promise<MediaItem[]> {
    const uploaded: MediaItem[] = [];
    for (const item of items) {
      if (/^https?:\/\//.test(item.url)) {
        uploaded.push(item);
        continue;
      }
      const result = await uploadToCloudinary(item.url, item.type);
      logMedia.mutate({ ownerId: sellerId, type: item.type, context: "property", result });
      uploaded.push({ type: item.type, url: result.url });
    }
    return uploaded;
  }

  const FIELD_LABELS: Record<string, string> = {
    purpose: "الغرض (بيع/إيجار)", type: "نوع العقار", province: "المحافظة", location: "المنطقة",
    price: "السعر", area: "المساحة", rooms: "عدد الغرف", baths: "عدد الحمامات", reception: "الريسبشن",
    floor: "الدور", payment: "طريقة الدفع", negotiable: "قابل للتفاوض", status: "حالة العقار",
    shortTitle: "العنوان المختصر", description: "الوصف", media: "فيديو العقار", music: "موسيقى الإعلان", phone: "رقم الهاتف",
  };

  function validate(): boolean {
    const errs = new Set<string>();
    if (!purpose) errs.add("purpose");
    if (!type) errs.add("type");
    if (!province) errs.add("province");
    if (!location.trim()) errs.add("location");
    if (!price || isNaN(Number(price)) || Number(price) <= 0) errs.add("price");
    if (!area || isNaN(Number(area)) || Number(area) <= 0) errs.add("area");
    if (rooms === "" || isNaN(Number(rooms))) errs.add("rooms");
    if (baths === "" || isNaN(Number(baths))) errs.add("baths");
    if (reception === "" || isNaN(Number(reception))) errs.add("reception");
    if (floor === "" || isNaN(Number(floor))) errs.add("floor");
    if (!payment) errs.add("payment");
    if (!negotiable) errs.add("negotiable");
    if (!status) errs.add("status");
    if (!shortTitle.trim()) errs.add("shortTitle");
    if (!description.trim()) errs.add("description");
    if (!videoItem) errs.add("media");
    if (!phone.countryIso2 || !validateAndFormatPhone(phone.localNumber, phone.countryIso2).valid) errs.add("phone");
    setErrors(errs);
    if (errs.size > 0) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      const missing = Array.from(errs).map((k) => FIELD_LABELS[k] || k).join("، ");
      Alert.alert(t("أكمل البيانات الناقصة"), missing);
    }
    return errs.size === 0;
  }

  async function submit() {
    if (!validate() || !videoItem) return;
    if (!user) return;

    setSubmitting(true);
    try {
      const cover = coverItem ?? (await generateCoverFromVideo(videoItem.url));
      const rawMedia: MediaItem[] = [
        videoItem,
        ...(cover ? [cover] : []),
      ];
      const uploadedMedia = await uploadLocalMedia(user.id, rawMedia);

      let lat: number | undefined;
      let lng: number | undefined;
      try {
        let perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted && perm.canAskAgain) {
          perm = await Location.requestForegroundPermissionsAsync();
        }
        if (perm.granted) {
          const results = await Location.geocodeAsync(`${location.trim()}, ${province}, مصر`);
          if (results[0]) {
            lat = results[0].latitude;
            lng = results[0].longitude;
          }
        }
      } catch (err) {
        console.warn("Failed to geocode listing address:", err);
      }

      const adFields = {
        purpose: purpose as Purpose,
        type,
        title: shortTitle.trim(),
        shortTitle: shortTitle.trim(),
        province,
        location: location.trim(),
        lat, lng,
        price: Number(price),
        area: Number(area),
        rooms: Number(rooms),
        baths: Number(baths),
        reception: Number(reception),
        floor: Number(floor),
        payment: payment as "cash" | "installment",
        negotiable: negotiable === "yes",
        finishType: finishType.trim() || undefined,
        status: status as "ready" | "building",
        deliveryDate: status === "building" ? deliveryDate.trim() || undefined : undefined,
        features: Array.from(features),
        description: description.trim(),
        media: uploadedMedia,
        coverImage: uploadedMedia.find((m) => m.type === "image")?.url ?? null,
        music: music || null,
        sharePlatforms: Array.from(sharePlatforms),
      };

      if (phone.localNumber.trim() && phone.countryIso2) {
        const result = validateAndFormatPhone(phone.localNumber, phone.countryIso2);
        if (result.valid) {
          const country = findCountry(phone.countryIso2);
          const { error } = await supabase.from("profiles").upsert({
            id: user.id,
            phone_e164: result.e164,
            phone_country_code: country?.callingCode ?? null,
            phone_country_name: country?.nameAr ?? null,
          }, { onConflict: "id" });
          if (error) throw error;
        }
      }

      if (editingAd) {
        await updateProperty.mutateAsync({ id: editingAd.id, patch: adFields });
      } else {
        await createProperty.mutateAsync({ ...adFields, sellerId: user.id });
      }

      // حذف المسودة إن وجدت فور النجاح في النشر
      if (currentDraftId) {
        removeDraft.mutate(currentDraftId);
      }

      router.replace("/(tabs)/account?tab=ads");
    } catch (err) {
      Alert.alert(t("تعذر نشر الإعلان"), t("حاول مرة أخرى."));
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
          <Text style={styles.headerTitle}>{t("انشر عقارك")}</Text>
          <View style={{ width: 34 }} />
        </View>
        <View style={styles.authRequiredBox}>
          <Text style={styles.authRequiredTitle}>{t("يجب تسجيل الدخول لنشر إعلان")}</Text>
          <Text style={styles.authRequiredSubtitle}>{t("سجّل الدخول من أجل مشاركة الإعلان مع المشترين والبائعين.")}</Text>
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
        <Text style={styles.headerTitle}>{editingAd ? t("تعديل الإعلان") : t("انشر عقارك")}</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <HelpBox title="🎥 وسائط الإعلان">
          الفيديو مطلوب لعرض إعلانك في الريلز. يمكنك إضافة صورة واحدة لتكون الواجهة في صفحة البحث.
        </HelpBox>

        <FormLabel text="الغرض من الإعلان" required />
        <ChipRow options={["sale", "rent"]} value={purpose} onChange={setPurpose} labels={{ sale: "للبيع", rent: "للإيجار" }} />
        <FormError text="من فضلك اختر الغرض" show={errors.has("purpose")} />

        <FormLabel text="نوع العقار" required />
        <ChipRow options={TYPES} value={type} onChange={setType} />
        <FormError text="من فضلك اختر نوع العقار" show={errors.has("type")} />

        <FormLabel text="المحافظة" required />
        <ProvinceAutocomplete value={province} onChange={setProvince} error={errors.has("province")} />
        <FormError text="من فضلك اختر المحافظة" show={errors.has("province")} />

        <FormLabel text="المنطقة / الحي / الكمبوند" required />
        <FormInput value={location} onChangeText={setLocation} placeholder="مثال: الشيخ زايد، كمبوند بالم هيلز ..." error={errors.has("location")} />
        <FormError text="من فضلك أدخل المنطقة" show={errors.has("location")} />

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <FormLabel text="السعر (ج.م)" required />
            <FormInput value={price} onChangeText={setPrice} placeholder="3500000" keyboardType="number-pad" error={errors.has("price")} />
            <FormError text="من فضلك أدخل السعر" show={errors.has("price")} />
          </View>
          <View style={{ flex: 1 }}>
            <FormLabel text="المساحة (م²)" required />
            <FormInput value={area} onChangeText={setArea} placeholder="180" keyboardType="number-pad" error={errors.has("area")} />
            <FormError text="من فضلك أدخل المساحة" show={errors.has("area")} />
          </View>
        </View>

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <FormLabel text="عدد الغرف" required />
            <FormInput value={rooms} onChangeText={setRooms} placeholder="3" keyboardType="number-pad" error={errors.has("rooms")} />
          </View>
          <View style={{ flex: 1 }}>
            <FormLabel text="عدد الحمامات" required />
            <FormInput value={baths} onChangeText={setBaths} placeholder="2" keyboardType="number-pad" error={errors.has("baths")} />
          </View>
        </View>

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <FormLabel text="الريسبشن" required />
            <FormInput value={reception} onChangeText={setReception} placeholder="2" keyboardType="number-pad" error={errors.has("reception")} />
          </View>
          <View style={{ flex: 1 }}>
            <FormLabel text="رقم الطابق" required />
            <FormInput value={floor} onChangeText={setFloor} placeholder="3" keyboardType="number-pad" error={errors.has("floor")} />
          </View>
        </View>
        <Text style={styles.hint}>💡 رقم الطابق (0 = أرضي)</Text>

        <FormLabel text="طريقة الدفع" required />
        <ChipRow options={["cash", "installment"]} value={payment} onChange={setPayment} labels={{ cash: "كاش", installment: "قسط" }} />
        <FormError text="من فضلك اختر طريقة الدفع" show={errors.has("payment")} />

        <FormLabel text="السعر قابل للتفاوض" required />
        <ChipRow options={["yes", "no"]} value={negotiable} onChange={setNegotiable} labels={{ yes: "نعم", no: "لا" }} />
        <FormError text="من فضلك اختر" show={errors.has("negotiable")} />

        <FormLabel text="الكماليات والمرافق" />
        <MultiChipRow
          options={FEATURES.map((f) => ({ key: f, label: f }))}
          values={features}
          onToggle={(k) => setFeatures((prev) => { const next = new Set(prev); next.has(k) ? next.delete(k) : next.add(k); return next; })}
        />

        <FormLabel text="نوع التشطيب" optional />
        <Pressable
          style={styles.finishSelector}
          onPress={() => setFinishTypeOpen((open) => !open)}
        >
          <Text style={finishType ? styles.finishSelectorText : styles.finishSelectorPlaceholder}>
            {finishType || t("اختر نوع التشطيب")}
          </Text>
        </Pressable>
        {finishTypeOpen && (
          <View style={styles.finishOptions}>
            {FINISH_TYPES.map((option) => (
              <Pressable
                key={option}
                style={[styles.finishOption, finishType === option && styles.finishOptionActive]}
                onPress={() => { setFinishType(option); setFinishTypeOpen(false); }}
              >
                <Text style={finishType === option ? styles.finishOptionActiveText : styles.finishOptionText}>
                  {t(option)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <FormLabel text="حالة العقار" required />
        <ChipRow options={["ready", "building"]} value={status} onChange={setStatus} labels={{ ready: "جاهز للتسليم", building: "قيد الإنشاء" }} />
        <FormError text="من فضلك اختر حالة العقار" show={errors.has("status")} />

        {status === "building" && (
          <>
            <FormLabel text="تاريخ التسليم المتوقع" optional />
            <FormInput value={deliveryDate} onChangeText={setDeliveryDate} placeholder="2027-06-30" />
          </>
        )}

        <FormLabel text="عنوان الإعلان (بحد أقصى 7 كلمات)" required />
        <FormInput value={shortTitle} onChangeText={onShortTitleChange} placeholder="مثال: شقة فاخرة بموقع مميز" maxLength={80} error={errors.has("shortTitle")} />
        <FormError text="أدخل عنوان مختصر (حتى 7 كلمات)" show={errors.has("shortTitle")} />

        <FormLabel text="الوصف" required />
        <FormInput value={description} onChangeText={setDescription} placeholder="اكتب وصف تفصيلي ..." multiline numberOfLines={4} style={{ minHeight: 90, textAlignVertical: "top" }} error={errors.has("description")} />
        <FormError text="من فضلك أدخل الوصف" show={errors.has("description")} />

        <SocialShareSection selected={sharePlatforms} onToggle={toggleSharePlatform} />

        <FormLabel text="فيديو العقار (مطلوب، حتى ٥ دقائق)" required />
        <View style={styles.mediaGrid}>
          {videoItem ? (
            <View style={styles.mediaCell}>
              <View style={[StyleSheet.absoluteFill, styles.videoCell]}>
                <Text style={styles.videoCellText}>🎬</Text>
              </View>
              <Pressable style={styles.mediaRemove} onPress={() => { setVideoItem(null); setVideoDurationMs(null); }}>
                <Text style={styles.mediaRemoveText}>×</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.mediaAdd} onPress={pickVideo}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#22A652" strokeWidth={2}><Path d="M12 5v14M5 12h14" /></Svg>
            </Pressable>
          )}
        </View>
        <FormError text="يجب رفع فيديو للإعلان (بحد أقصى ٥ دقائق)" show={errors.has("media")} />

        <FormLabel text="صورة الغلاف (اختياري)" />
        <HelpBox title="صورة الغلاف (اختياري)">
          لو ماخترتش صورة، هناخد لقطة عشوائية من الفيديو كغلاف للإعلان تلقائيًا.
        </HelpBox>
        <View style={styles.mediaGrid}>
          {coverItem ? (
            <View style={styles.mediaCell}>
              <Image source={{ uri: coverItem.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              <Pressable style={styles.mediaRemove} onPress={() => setCoverItem(null)}>
                <Text style={styles.mediaRemoveText}>×</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.mediaAdd} onPress={pickCoverImage}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#22A652" strokeWidth={2}><Path d="M12 5v14M5 12h14" /></Svg>
            </Pressable>
          )}
        </View>

        <FormLabel text="موسيقى الإعلان" optional />
        <View style={{ gap: 8 }}>
          {MUSIC_OPTIONS.map((m) => (
            <Pressable
              key={m.key}
              style={[styles.musicItem, music === m.key && styles.musicItemActive]}
              onPress={() => setMusic(m.key)}
            >
              <Text style={styles.musicNote}>{m.note}</Text>
              <Text style={styles.musicText}>{m.key} — {t(m.desc)}</Text>
            </Pressable>
          ))}
        </View>

        <FormLabel text="رقم التواصل (واتساب)" required />
        <PhoneInput value={phone} onChange={setPhone} error={errors.has("phone")} />
        <FormError text="من فضلك أدخل رقم صحيح" show={errors.has("phone")} />
      </ScrollView>

      <View style={styles.submitBar}>
        {!editingAd && (
          <Pressable style={[styles.draftBtn, savingDraft && styles.submitBtnDisabled]} onPress={handleSaveDraft} disabled={savingDraft}>
            {savingDraft ? <ActivityIndicator color="#22A652" size="small" /> : <Text style={styles.draftBtnText}>{t("حفظ كمسودة")}</Text>}
          </Pressable>
        )}
        <Pressable style={[styles.submitBtn, { flex: 1 }, submitting && styles.submitBtnDisabled]} onPress={submit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>{editingAd ? t("حفظ") : t("نشر الإعلان")}</Text>
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
    authRequiredBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    authRequiredTitle: { fontSize: 16, fontWeight: "900", color: themeColors.text, marginBottom: 8, textAlign: "center" },
    authRequiredSubtitle: { fontSize: 13, color: themeColors.textSubtle, textAlign: "center", marginBottom: 20 },
    authRequiredBtn: { backgroundColor: "#22A652", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    authRequiredBtnText: { color: "white", fontWeight: "700", fontSize: 14 },
    row2: { flexDirection: "row", gap: 12 },
    hint: { fontSize: 10.5, color: themeColors.textSubtle, marginTop: 4 },
    mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    mediaCell: { width: 84, height: 84, borderRadius: 10, overflow: "hidden", backgroundColor: themeColors.surface },
    videoCell: { alignItems: "center", justifyContent: "center", backgroundColor: "#111827" },
    videoCellText: { fontSize: 22 },
    mediaRemove: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
    mediaRemoveText: { color: "white", fontSize: 13, fontWeight: "900", marginTop: -1 },
    mediaAdd: { width: 84, height: 84, borderRadius: 10, borderWidth: 1.5, borderColor: "#22A652", borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
    musicItem: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: themeColors.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: themeColors.border },
    musicItemActive: { borderColor: "#22A652", backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ECFDF5" },
    musicNote: { fontSize: 16 },
    musicText: { fontSize: 12.5, fontWeight: "700", color: themeColors.textMuted },
    finishSelector: { backgroundColor: themeColors.surface, borderWidth: 1, borderColor: themeColors.border, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
    finishSelectorText: { fontSize: 13.5, color: themeColors.text },
    finishSelectorPlaceholder: { fontSize: 13.5, color: themeColors.textSubtle },
    finishOptions: { backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.border, borderRadius: 10, marginTop: 4, overflow: "hidden" },
    finishOption: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: themeColors.border },
    finishOptionActive: { backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ECFDF5" },
    finishOptionText: { fontSize: 13, color: themeColors.textMuted, fontWeight: "700" },
    finishOptionActiveText: { fontSize: 13, color: themeColors.isDark ? "#6EE7B7" : "#047857", fontWeight: "800" },
    submitBar: { flexDirection: "row", gap: 10, padding: 14, paddingBottom: 26, borderTopWidth: 1, borderTopColor: themeColors.border, backgroundColor: themeColors.background },
    submitBtn: { backgroundColor: "#22A652", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    submitBtnDisabled: { backgroundColor: "#8fcaa6" },
    submitBtnText: { color: "white", fontWeight: "900", fontSize: 14 },
    draftBtn: { flex: 1, borderWidth: 1.5, borderColor: "#22A652", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    draftBtnText: { color: "#22A652", fontWeight: "900", fontSize: 13 },
  });
}