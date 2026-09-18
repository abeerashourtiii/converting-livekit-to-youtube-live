import { useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, FlatList, Alert, Switch, ScrollView, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useAllMenuItems, useMenuItemMutations, MenuItem, MenuImageSize, MenuImageFit, MenuTextLayout, MenuImageSide, MenuTextVAlign, MenuTextHAlign } from "../../lib/hooks/useMenuItems";
import { MenuIcon, ICON_KEYS, MenuIconKey } from "../../lib/menuIconRegistry";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";
import { useLogMedia } from "../../lib/hooks/useMedia";
import { uploadToCloudinary, cldThumbnail } from "../../lib/cloudinary";

// ↔ بعد إضافة صورة خارجية للأيقونة، الأدمن طلب ألوان تانية غير الـ10
// الأساسية — بدل ما نضيف باقة تانية ثابتة بس (نفس القيد)، ضفنا باقة
// أوسع (24 لون بدل 10) + حقل كود Hex حر عشان أي لون يتاح فعلاً من غير
// حدود، مش مجموعة تانية محدودة. حقل الـ Hex شغال بنفس الطريقة بالظبط
// على أندرويد/آيفون/الويب لأنه TextInput عادي — مفيش أي مكتبة color-
// picker جديدة محتاجة بناء native منفصل لكل منصة.
const COLOR_PRESETS = [
  "#1e293b", "#22A652", "#0ea5e9", "#722F37", "#ef4444", "#334155", "#7c2d12", "#F59E0B", "#6366f1", "#ec4899",
  "#0f172a", "#134e4a", "#166534", "#065f46", "#0891b2", "#1d4ed8", "#4338ca", "#7e22ce", "#9d174d", "#be123c",
  "#c2410c", "#a16207", "#4d7c0f", "#57534e",
];

// ↔ "#RGB" أو "#RRGGBB" — بيسمح بكتابة الكود وهو ناقص لسه (لحد ما
// يخلّص الكتابة) من غير ما يرفض كل حرف يكتبه الأدمن أول بأول.
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function normalizeHexInput(raw: string): string {
  let v = raw.trim();
  if (!v.startsWith("#")) v = "#" + v;
  return v.slice(0, 7);
}

const IMAGE_SIZE_OPTIONS: { key: MenuImageSize; label: string }[] = [
  { key: "small", label: "صغيرة" },
  { key: "medium", label: "متوسطة" },
  { key: "large", label: "كبيرة" },
  { key: "full", label: "تملأ الكارت" },
];

const IMAGE_FIT_OPTIONS: { key: MenuImageFit; label: string }[] = [
  { key: "contain", label: "كاملة بدون قص" },
  { key: "cover", label: "تملأ الإطار (قص)" },
];

const TEXT_LAYOUT_OPTIONS: { key: MenuTextLayout; label: string }[] = [
  { key: "below", label: "الصورة فوق، النص تحت" },
  { key: "above", label: "النص فوق، الصورة تحت" },
  { key: "beside", label: "الصورة بجانب النص" },
  { key: "overlay", label: "النص فوق الصورة" },
  { key: "hidden", label: "صورة فقط بدون نص" },
];

const IMAGE_SIDE_OPTIONS: { key: MenuImageSide; label: string }[] = [
  { key: "right", label: "الصورة يمين النص" },
  { key: "left", label: "الصورة شمال النص" },
];

const TEXT_VALIGN_OPTIONS: { key: MenuTextVAlign; label: string }[] = [
  { key: "top", label: "أعلى" },
  { key: "middle", label: "فى المنتصف" },
  { key: "bottom", label: "أسفل" },
];

const TEXT_HALIGN_OPTIONS: { key: MenuTextHAlign; label: string }[] = [
  { key: "right", label: "يمين" },
  { key: "center", label: "فى المنتصف" },
  { key: "left", label: "شمال" },
];

const FONT_SIZE_PRESETS = [12, 13, 14, 15, 16, 18, 20, 22, 24];

// ↔ full management of the menu page's icon cards — color, title/
// subtitle, size, icon, position (reorder via up/down — drag-and-drop
// isn't reliable enough on mobile to trust for something that reorders a
// live page), and add/delete. Every card on app/(tabs)/menu.tsx (other
// than the live-now banner and ad carousel, which are dynamic widgets,
// not static icons) is a row here.
export function AdminMenuItems() {
  const { data: items = [] } = useAllMenuItems();
  const { create, update, remove, reorder, moveToPosition } = useMenuItemMutations();
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [hexDraft, setHexDraft] = useState(COLOR_PRESETS[0]);
  const [iconKey, setIconKey] = useState<MenuIconKey>("star");
  const [size, setSize] = useState<"full" | "half" | "tall" | "round">("half");
  const [actionType, setActionType] = useState<"whatsapp" | "route" | "url">("whatsapp");
  const [actionValue, setActionValue] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageSize, setImageSize] = useState<MenuImageSize>("medium");
  const [imageFit, setImageFit] = useState<MenuImageFit>("contain");
  const [textLayout, setTextLayout] = useState<MenuTextLayout>("below");
  const [imageSide, setImageSide] = useState<MenuImageSide>("right");
  const [fontSize, setFontSize] = useState<number | null>(null);
  const [fontBold, setFontBold] = useState(false);
  const [fontColor, setFontColor] = useState<string | null>(null);
  const [fontColorHexDraft, setFontColorHexDraft] = useState("");
  const [textVAlign, setTextVAlign] = useState<MenuTextVAlign>("middle");
  const [textHAlign, setTextHAlign] = useState<MenuTextHAlign>("center");
  const [positionDraft, setPositionDraft] = useState("");
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const { user } = useCurrentUser();
  const logMedia = useLogMedia();

  function resetForm() {
    setEditingId(null); setTitle(""); setSubtitle(""); applyColor(COLOR_PRESETS[0]);
    setIconKey("star"); setSize("half"); setActionType("whatsapp"); setActionValue(""); setCtaLabel("");
    setImageUrl(null); setImageSize("medium"); setImageFit("contain"); setTextLayout("below");
    setImageSide("right"); setFontSize(null); setFontBold(false); setFontColor(null); setFontColorHexDraft("");
    setTextVAlign("middle"); setTextHAlign("center"); setPositionDraft("");
  }

  // ↔ بيحدّث color (اللون المطبَّق فعليًا على الكارت) وhexDraft (النص
  // فى حقل الكتابة) مع بعض دايمًا، عشان الاتنين يفضلوا متزامنين سواء
  // اللون اتغيّر من ضغطة على لون جاهز أو من كتابة كود يدوي.
  function applyColor(hex: string) {
    setColor(hex);
    setHexDraft(hex);
  }

  function startEdit(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setEditingId(id); setTitle(item.title); setSubtitle(item.subtitle ?? "");
    applyColor(item.color); setIconKey(item.iconKey as MenuIconKey); setSize(item.size);
    setActionType(item.actionType); setActionValue(item.actionValue); setCtaLabel(item.ctaLabel ?? "");
    setImageUrl(item.imageUrl); setImageSize(item.imageSize); setImageFit(item.imageFit); setTextLayout(item.textLayout);
    setImageSide(item.imageSide); setFontSize(item.fontSize); setFontBold(item.fontBold);
    setFontColor(item.fontColor); setFontColorHexDraft(item.fontColor ?? "");
    setTextVAlign(item.textVAlign); setTextHAlign(item.textHAlign);
    const currentPosition = items.findIndex((i) => i.id === id) + 1;
    setPositionDraft(String(currentPosition));
  }

  // ↔ استبدال الأيقونة الجاهزة (icon_key) بصورة خارجية بالكامل — نفس
  // آلية الرفع الحقيقي على Cloudinary المستخدمة فى AdminAdBanners
  // ولوحة تعديل الحساب، مش رابط بيتلصق يدويًا. بيشتغل بنفس الطريقة على
  // أندرويد/آيفون (مكتبة الصور) والويب (نافذة اختيار ملف المتصفح) لأن
  // expo-image-picker وexpo-image بيدعموا الويب أصلاً.
  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });
    if (result.canceled) return;
    setUploadingImage(true);
    try {
      const uploadResult = await uploadToCloudinary(result.assets[0].uri, "image");
      if (user?.id) logMedia.mutate({ ownerId: user.id, type: "image", context: "other", result: uploadResult });
      setImageUrl(uploadResult.url);
    } catch {
      Alert.alert("تعذر رفع الصورة", "حاول مرة أخرى.");
    } finally {
      setUploadingImage(false);
    }
  }

  function submitForm() {
    if (!title.trim()) {
      Alert.alert("تنبيه", "لازم تكتب عنوان للأيقونة الأول.");
      return;
    }
    if (!actionValue.trim()) {
      Alert.alert(
        "تنبيه",
        actionType === "whatsapp"
          ? "لازم تكتب نص رسالة الواتساب."
          : actionType === "route"
            ? "لازم تكتب مسار الصفحة، مثال: /(tabs)/search"
            : "لازم تكتب الرابط الخارجي."
      );
      return;
    }
    const payload = {
      title: title.trim(), subtitle: subtitle.trim() || null, color, iconKey, size,
      actionType, actionValue: actionValue.trim(), ctaLabel: ctaLabel.trim() || null,
      imageUrl, imageSize, imageFit, textLayout,
      imageSide, fontSize, fontBold, fontColor, textVAlign, textHAlign,
    };
    // ↔ كانت resetForm() بتتنفذ فورًا بعد mutate() من غير انتظار نتيجة
    // العملية ولا معالجة خطأ — لو الإضافة فشلت (صلاحيات، شبكة...) الفورم
    // كان بيتصفّر وكأن كل حاجة تمام، والأيقونة الجديدة مكانتش بتظهر من
    // غير أي رسالة توضح السبب، فكان حاسس إن الزر "مش شغال". دلوقتي
    // بنستخدم mutateAsync وبنصفّر الفورم بس لو العملية نجحت فعلاً، وبنورّي
    // رسالة خطأ واضحة لو فشلت.
    const parsedPosition = parseInt(positionDraft, 10);
    const wantsExplicitPosition = !Number.isNaN(parsedPosition) && parsedPosition > 0;

    async function run() {
      if (editingId) {
        await update.mutateAsync({ id: editingId, patch: payload });
        if (wantsExplicitPosition) {
          await moveToPosition.mutateAsync({ id: editingId, items, position: parsedPosition });
        }
      } else {
        const newId = await create.mutateAsync({ ...payload, sortOrder: items.length });
        if (wantsExplicitPosition) {
          // ↔ العنصر الجديد لسه مش موجود جوه items (لسه ما اتحدّثتش من
          // السيرفر)، فبنضيفه يدويًا لنسخة مؤقتة من القايمة (بأي قيم —
          // مش هتتحفظ، غرضها بس ترتيب الأماكن) عشان moveToPosition يقدر
          // يحسب مكانه الصح وسط الباقيين.
          const withNewItem: MenuItem[] = [
            ...items,
            {
              id: newId,
              active: true,
              sortOrder: items.length,
              title: payload.title,
              subtitle: payload.subtitle,
              color: payload.color,
              iconKey: payload.iconKey,
              size: payload.size,
              actionType: payload.actionType,
              actionValue: payload.actionValue,
              ctaLabel: payload.ctaLabel,
              imageUrl: payload.imageUrl,
              imageSize: payload.imageSize,
              imageFit: payload.imageFit,
              textLayout: payload.textLayout,
              imageSide: payload.imageSide,
              fontSize: payload.fontSize,
              fontBold: payload.fontBold,
              fontColor: payload.fontColor,
              textVAlign: payload.textVAlign,
              textHAlign: payload.textHAlign,
            },
          ];
          await moveToPosition.mutateAsync({ id: newId, items: withNewItem, position: parsedPosition });
        }
      }
    }

    run()
      .then(() => resetForm())
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "حصل خطأ غير متوقع، حاول تاني.";
        Alert.alert("تعذّرت العملية", message);
      });
  }

  function moveItem(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    reorder.mutate({
      a: { id: items[index].id, sortOrder: items[index].sortOrder },
      b: { id: items[target].id, sortOrder: items[target].sortOrder },
    });
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{editingId ? "تعديل أيقونة" : "إضافة أيقونة جديدة"}</Text>

        <TextInput style={styles.input} placeholder="العنوان" placeholderTextColor={themeColors.textSubtle} value={title} onChangeText={setTitle} />
        <TextInput style={styles.input} placeholder="الوصف الفرعي (اختياري)" placeholderTextColor={themeColors.textSubtle} value={subtitle} onChangeText={setSubtitle} />

        <Text style={styles.label}>اللون</Text>
        <View style={styles.colorRow}>
          {COLOR_PRESETS.map((c) => (
            <Pressable key={c} style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorSwatchActive]} onPress={() => applyColor(c)} />
          ))}
        </View>

        <Text style={styles.label}>أو لون مخصّص (كود Hex)</Text>
        <View style={styles.hexRow}>
          <View style={[styles.hexPreview, { backgroundColor: HEX_COLOR_RE.test(hexDraft) ? hexDraft : color }]} />
          <TextInput
            style={[styles.input, styles.hexInput, !HEX_COLOR_RE.test(hexDraft) && styles.hexInputInvalid]}
            placeholder="#22A652"
            placeholderTextColor={themeColors.textSubtle}
            value={hexDraft}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={7}
            onChangeText={(text) => {
              const normalized = normalizeHexInput(text);
              setHexDraft(normalized);
              // ↔ بيطبّق اللون على الكارت أول ما الكود يبقى صحيح ومكتمل
              // (6 خانات hex)، من غير ما ينتظر ضغطة تأكيد — لكن من غير ما
              // يرفض أو يصحّح الكتابة وهي لسه ناقصة.
              if (HEX_COLOR_RE.test(normalized)) setColor(normalized);
            }}
          />
        </View>
        {!HEX_COLOR_RE.test(hexDraft) && (
          <Text style={styles.hint}>اكتب كود لون كامل بالصيغة #RRGGBB، مثال: #22A652</Text>
        )}

        <Text style={styles.label}>الأيقونة الجاهزة (تُستخدم لو مفيش صورة خارجية تحت)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {ICON_KEYS.map((k) => (
            <Pressable key={k} style={[styles.iconSwatch, iconKey === k && !imageUrl && styles.iconSwatchActive]} onPress={() => setIconKey(k)}>
              <MenuIcon iconKey={k} size={22} color={iconKey === k && !imageUrl ? "#22A652" : themeColors.textSubtle} />
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>أو استبدال الأيقونة بالكامل بصورة خارجية</Text>
        <Pressable style={styles.imagePicker} onPress={pickImage} disabled={uploadingImage}>
          {uploadingImage ? (
            <ActivityIndicator color="#6366f1" />
          ) : imageUrl ? (
            <Image source={{ uri: cldThumbnail(imageUrl) }} style={styles.imagePreview} contentFit="cover" />
          ) : (
            <Text style={styles.imagePickerText}>اختر صورة من الجهاز</Text>
          )}
        </Pressable>
        {!!imageUrl && (
          <Pressable style={styles.removeImageBtn} onPress={() => setImageUrl(null)} disabled={uploadingImage}>
            <Text style={styles.removeImageBtnText}>إزالة الصورة والرجوع للأيقونة الجاهزة</Text>
          </Pressable>
        )}

        {!!imageUrl && (
          <>
            <Text style={styles.label}>حجم الصورة داخل الأيقونة</Text>
            <View style={styles.placementRow}>
              {IMAGE_SIZE_OPTIONS.map((opt) => (
                <Pressable key={opt.key} style={[styles.placementBtn, imageSize === opt.key && styles.placementBtnActive]} onPress={() => setImageSize(opt.key)}>
                  <Text style={[styles.placementBtnText, imageSize === opt.key && styles.placementBtnTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>تنسيق الصورة جوه إطارها</Text>
            <View style={styles.placementRow}>
              {IMAGE_FIT_OPTIONS.map((opt) => (
                <Pressable key={opt.key} style={[styles.placementBtn, imageFit === opt.key && styles.placementBtnActive]} onPress={() => setImageFit(opt.key)}>
                  <Text style={[styles.placementBtnText, imageFit === opt.key && styles.placementBtnTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>مكان النص بالنسبة للصورة</Text>
            <View style={styles.placementRow}>
              {TEXT_LAYOUT_OPTIONS.slice(0, 3).map((opt) => (
                <Pressable key={opt.key} style={[styles.placementBtn, textLayout === opt.key && styles.placementBtnActive]} onPress={() => setTextLayout(opt.key)}>
                  <Text style={[styles.placementBtnText, textLayout === opt.key && styles.placementBtnTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.placementRow}>
              {TEXT_LAYOUT_OPTIONS.slice(3).map((opt) => (
                <Pressable key={opt.key} style={[styles.placementBtn, textLayout === opt.key && styles.placementBtnActive]} onPress={() => setTextLayout(opt.key)}>
                  <Text style={[styles.placementBtnText, textLayout === opt.key && styles.placementBtnTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>

            {textLayout === "beside" && (
              <>
                <Text style={styles.label}>وضع الصورة بجانب النص</Text>
                <View style={styles.placementRow}>
                  {IMAGE_SIDE_OPTIONS.map((opt) => (
                    <Pressable key={opt.key} style={[styles.placementBtn, imageSide === opt.key && styles.placementBtnActive]} onPress={() => setImageSide(opt.key)}>
                      <Text style={[styles.placementBtnText, imageSide === opt.key && styles.placementBtnTextActive]}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {(textLayout === "overlay" || textLayout === "beside") && (
              <>
                <Text style={styles.label}>مكان النص جوه الكارت — رأسيًا</Text>
                <View style={styles.placementRow}>
                  {TEXT_VALIGN_OPTIONS.map((opt) => (
                    <Pressable key={opt.key} style={[styles.placementBtn, textVAlign === opt.key && styles.placementBtnActive]} onPress={() => setTextVAlign(opt.key)}>
                      <Text style={[styles.placementBtnText, textVAlign === opt.key && styles.placementBtnTextActive]}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.label}>مكان النص جوه الكارت — أفقيًا</Text>
                <View style={styles.placementRow}>
                  {TEXT_HALIGN_OPTIONS.map((opt) => (
                    <Pressable key={opt.key} style={[styles.placementBtn, textHAlign === opt.key && styles.placementBtnActive]} onPress={() => setTextHAlign(opt.key)}>
                      <Text style={[styles.placementBtnText, textHAlign === opt.key && styles.placementBtnTextActive]}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        <Text style={styles.label}>شكل خط العنوان</Text>
        <Text style={styles.hint}>حجم الخط</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
          <Pressable style={[styles.fontSizeChip, fontSize === null && styles.placementBtnActive]} onPress={() => setFontSize(null)}>
            <Text style={[styles.placementBtnText, fontSize === null && styles.placementBtnTextActive]}>تلقائي</Text>
          </Pressable>
          {FONT_SIZE_PRESETS.map((s) => (
            <Pressable key={s} style={[styles.fontSizeChip, fontSize === s && styles.placementBtnActive]} onPress={() => setFontSize(s)}>
              <Text style={[styles.placementBtnText, fontSize === s && styles.placementBtnTextActive]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.boldRow}>
          <Text style={styles.label}>خط عريض (Bold) إضافي</Text>
          <Switch value={fontBold} onValueChange={setFontBold} />
        </View>

        <Text style={styles.hint}>لون الخط (فاضي = تباين تلقائي حسب لون الكارت)</Text>
        <View style={styles.colorRow}>
          <Pressable
            style={[styles.autoColorSwatch, fontColor === null && styles.colorSwatchActive]}
            onPress={() => { setFontColor(null); setFontColorHexDraft(""); }}
          >
            <Text style={styles.autoColorSwatchText}>تلقائي</Text>
          </Pressable>
          {COLOR_PRESETS.slice(0, 10).map((c) => (
            <Pressable
              key={c}
              style={[styles.colorSwatch, { backgroundColor: c }, fontColor === c && styles.colorSwatchActive]}
              onPress={() => { setFontColor(c); setFontColorHexDraft(c); }}
            />
          ))}
        </View>
        <View style={styles.hexRow}>
          <View style={[styles.hexPreview, { backgroundColor: HEX_COLOR_RE.test(fontColorHexDraft) ? fontColorHexDraft : (fontColor ?? themeColors.surface) }]} />
          <TextInput
            style={[styles.input, styles.hexInput, !!fontColorHexDraft && !HEX_COLOR_RE.test(fontColorHexDraft) && styles.hexInputInvalid]}
            placeholder="اتركه فاضي للتلقائي، أو #FFFFFF"
            placeholderTextColor={themeColors.textSubtle}
            value={fontColorHexDraft}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={7}
            onChangeText={(text) => {
              if (!text) { setFontColorHexDraft(""); setFontColor(null); return; }
              const normalized = normalizeHexInput(text);
              setFontColorHexDraft(normalized);
              if (HEX_COLOR_RE.test(normalized)) setFontColor(normalized);
            }}
          />
        </View>

        <Text style={styles.label}>حجم الكارت نفسه فى الصفحة</Text>
        <View style={styles.placementRow}>
          <Pressable style={[styles.placementBtn, size === "full" && styles.placementBtnActive]} onPress={() => setSize("full")}>
            <Text style={[styles.placementBtnText, size === "full" && styles.placementBtnTextActive]}>عرض كامل</Text>
          </Pressable>
          <Pressable style={[styles.placementBtn, size === "half" && styles.placementBtnActive]} onPress={() => setSize("half")}>
            <Text style={[styles.placementBtnText, size === "half" && styles.placementBtnTextActive]}>نصف</Text>
          </Pressable>
        </View>
        <View style={styles.placementRow}>
          <Pressable style={[styles.placementBtn, size === "tall" && styles.placementBtnActive]} onPress={() => setSize("tall")}>
            <Text style={[styles.placementBtnText, size === "tall" && styles.placementBtnTextActive]}>طويلة (+ نصفين بجانبها)</Text>
          </Pressable>
          <Pressable style={[styles.placementBtn, size === "round" && styles.placementBtnActive]} onPress={() => setSize("round")}>
            <Text style={[styles.placementBtnText, size === "round" && styles.placementBtnTextActive]}>دائرية صغيرة (+ نصف بجانبها)</Text>
          </Pressable>
        </View>
        {size === "tall" && (
          <Text style={styles.hint}>لازم تتبعها بطاقتين "نصف" في الترتيب عشان يظهروا مكدّسين بجانبها.</Text>
        )}
        {size === "round" && (
          <Text style={styles.hint}>لازم تتبعها بطاقة "نصف" واحدة في الترتيب عشان تظهر بجانبها.</Text>
        )}

        <Text style={styles.label}>نص الزر الجانبي (اختياري، للبطاقات الكاملة فقط — مثال: اطلب الآن)</Text>
        <TextInput style={styles.input} placeholder="اطلب الآن" placeholderTextColor={themeColors.textSubtle} value={ctaLabel} onChangeText={setCtaLabel} />

        <Text style={styles.label}>عند الضغط</Text>
        <View style={styles.placementRow}>
          <Pressable style={[styles.placementBtn, actionType === "whatsapp" && styles.placementBtnActive]} onPress={() => setActionType("whatsapp")}>
            <Text style={[styles.placementBtnText, actionType === "whatsapp" && styles.placementBtnTextActive]}>واتساب</Text>
          </Pressable>
          <Pressable style={[styles.placementBtn, actionType === "route" && styles.placementBtnActive]} onPress={() => setActionType("route")}>
            <Text style={[styles.placementBtnText, actionType === "route" && styles.placementBtnTextActive]}>صفحة داخل التطبيق</Text>
          </Pressable>
          <Pressable style={[styles.placementBtn, actionType === "url" && styles.placementBtnActive]} onPress={() => setActionType("url")}>
            <Text style={[styles.placementBtnText, actionType === "url" && styles.placementBtnTextActive]}>رابط خارجي</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.input}
          placeholder={actionType === "whatsapp" ? "نص رسالة واتساب" : actionType === "route" ? "مسار الصفحة، مثال: /(tabs)/search" : "https://..."}
          placeholderTextColor={themeColors.textSubtle}
          value={actionValue}
          onChangeText={setActionValue}
        />

        <Text style={styles.label}>ترتيب الأيقونة فى الصفحة (اختياري)</Text>
        <Text style={styles.hint}>
          رقم من 1 لـ {editingId ? items.length : items.length + 1} — سيبه فاضي عشان {editingId ? "الأيقونة تفضل فى مكانها الحالي" : "الأيقونة الجديدة تتحط آخر القائمة"}.
        </Text>
        <TextInput
          style={styles.input}
          placeholder={`مثال: 1 (يخليها أول أيقونة)`}
          placeholderTextColor={themeColors.textSubtle}
          value={positionDraft}
          onChangeText={(t) => setPositionDraft(t.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
        />

        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          {editingId && (
            <Pressable style={[styles.addBtn, { flex: 1, backgroundColor: themeColors.surface }]} onPress={resetForm}>
              <Text style={[styles.addBtnText, { color: themeColors.textMuted }]}>إلغاء</Text>
            </Pressable>
          )}
          <Pressable style={[styles.addBtn, { flex: 1 }]} onPress={submitForm}>
            <Text style={styles.addBtnText}>{editingId ? "حفظ التعديل" : "إضافة الأيقونة"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>أيقونات صفحة القائمة ({items.length})</Text>
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          scrollEnabled={false}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <Text style={styles.positionBadge}>{index + 1}</Text>
              {item.imageUrl ? (
                <Image source={{ uri: cldThumbnail(item.imageUrl) }} style={styles.iconPreview} contentFit="cover" />
              ) : (
                <View style={[styles.iconPreview, { backgroundColor: item.color }]}>
                  <MenuIcon iconKey={item.iconKey} size={18} color="white" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.rowMeta}>
                  {item.size === "full" ? "عرض كامل" : item.size === "tall" ? "طويلة" : item.size === "round" ? "دائرية" : "نصف"} · {item.actionType}
                  {item.imageUrl ? " · صورة خارجية" : ""}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 4 }}>
                <Pressable style={styles.moveBtn} onPress={() => moveItem(index, -1)} disabled={index === 0}>
                  <Text style={styles.moveBtnText}>↑</Text>
                </Pressable>
                <Pressable style={styles.moveBtn} onPress={() => moveItem(index, 1)} disabled={index === items.length - 1}>
                  <Text style={styles.moveBtnText}>↓</Text>
                </Pressable>
              </View>
              <Switch value={item.active} onValueChange={(v) => update.mutate({ id: item.id, patch: { active: v } })} />
              <Pressable style={styles.editBtn} onPress={() => startEdit(item.id)}>
                <Text style={styles.editBtnText}>تعديل</Text>
              </Pressable>
              <Pressable
                style={styles.deleteBtn}
                onPress={() => Alert.alert("حذف الأيقونة؟", item.title, [
                  { text: "إلغاء", style: "cancel" },
                  { text: "حذف", style: "destructive", onPress: () => remove.mutate(item.id) },
                ])}
              >
                <Text style={styles.deleteBtnText}>حذف</Text>
              </Pressable>
            </View>
          )}
        />
      </View>
    </View>
  );
}

// ↔ COLOR_PRESETS فوق دي مش ألوان واجهة themeable — دي بيانات (لوحة
// ألوان الأدمن بيختار منها لون كارت فى صفحة القائمة نفسها، شوف
// lib/menuIconRegistry.tsx) فبتفضل ثابتة عمدًا.
function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    card: { backgroundColor: themeColors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: themeColors.border },
    cardTitle: { fontSize: 13, fontWeight: "900", color: themeColors.text, marginBottom: 10 },
    input: { borderWidth: 1, borderColor: themeColors.border, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, fontSize: 12.5, marginBottom: 8, color: themeColors.text },
    label: { fontSize: 11.5, fontWeight: "800", color: themeColors.textSubtle, marginBottom: 6, marginTop: 2 },
    hint: { fontSize: 10.5, color: themeColors.textSubtle, marginBottom: 8, marginTop: -4 },
    colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
    colorSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "transparent" },
    colorSwatchActive: { borderColor: themeColors.text },
    autoColorSwatch: {
      height: 28, paddingHorizontal: 10, borderRadius: 14, borderWidth: 2, borderColor: "transparent",
      backgroundColor: themeColors.surface, alignItems: "center", justifyContent: "center",
    },
    autoColorSwatchText: { fontSize: 10.5, fontWeight: "800", color: themeColors.textSubtle },
    fontSizeChip: {
      minWidth: 44, alignItems: "center", paddingVertical: 8, paddingHorizontal: 10,
      borderRadius: 8, backgroundColor: themeColors.surface,
    },
    boldRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    hexRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
    hexPreview: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: themeColors.border },
    hexInput: { flex: 1, marginBottom: 0 },
    hexInputInvalid: { borderColor: "#ef4444" },
    iconSwatch: { width: 40, height: 40, borderRadius: 10, backgroundColor: themeColors.surface, alignItems: "center", justifyContent: "center", marginBottom: 10 },
    iconSwatchActive: { backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ecfdf5", borderWidth: 1.5, borderColor: "#22A652" },
    imagePicker: {
      height: 90, borderRadius: 10, borderWidth: 1, borderColor: themeColors.border, borderStyle: "dashed",
      alignItems: "center", justifyContent: "center", marginBottom: 8, overflow: "hidden", backgroundColor: themeColors.surface,
    },
    imagePickerText: { fontSize: 12, fontWeight: "700", color: themeColors.textSubtle },
    imagePreview: { width: "100%", height: "100%" },
    removeImageBtn: { alignSelf: "flex-start", marginBottom: 10 },
    removeImageBtnText: { color: "#991B1B", fontWeight: "800", fontSize: 11 },
    placementRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
    placementBtn: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 8, backgroundColor: themeColors.surface },
    placementBtnActive: { backgroundColor: "#6366f1" },
    placementBtnText: { fontSize: 11, fontWeight: "800", color: themeColors.textSubtle },
    placementBtnTextActive: { color: "white" },
    addBtn: { backgroundColor: "#6366f1", borderRadius: 999, paddingVertical: 11, alignItems: "center" },
    addBtnText: { color: "white", fontWeight: "900", fontSize: 12.5 },
    row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: themeColors.border },
    positionBadge: {
      minWidth: 18, textAlign: "center", fontSize: 10.5, fontWeight: "900",
      color: themeColors.textSubtle, backgroundColor: themeColors.surface, borderRadius: 999, paddingVertical: 2,
    },
    iconPreview: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    rowTitle: { fontSize: 12, fontWeight: "800", color: themeColors.text },
    rowMeta: { fontSize: 10, color: themeColors.textSubtle, marginTop: 1 },
    moveBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: themeColors.surface, alignItems: "center", justifyContent: "center" },
    moveBtnText: { fontSize: 12, fontWeight: "900", color: themeColors.textMuted },
    editBtn: { backgroundColor: themeColors.isDark ? "rgba(99,102,241,0.18)" : "#eef2ff", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
    editBtnText: { color: "#6366f1", fontWeight: "900", fontSize: 10.5 },
    deleteBtn: { backgroundColor: themeColors.isDark ? "rgba(239,68,68,0.15)" : "#FEF2F2", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
    deleteBtnText: { color: "#991B1B", fontWeight: "900", fontSize: 10.5 },
  });
}
