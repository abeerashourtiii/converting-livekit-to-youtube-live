import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, FlatList, Alert, Switch, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useAllAdBanners, useAdBannerMutations } from "../../lib/hooks/useAdBanners";
import { useAdCarouselSettings, useUpdateAdCarouselSettings } from "../../lib/hooks/useAdCarouselSettings";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";
import { useLogMedia } from "../../lib/hooks/useMedia";
import { uploadToCloudinary, cldThumbnail } from "../../lib/cloudinary";

// ↔ full control over the "مساحة إعلانية" card on the menu page: add a
// banner with a run duration (start/end date), delete it, or add several
// that auto-rotate (components/menu/AdBannerCarousel.tsx cycles through
// every banner returned by useActiveAdBanners()).
export function AdminAdBanners() {
  const { data: banners = [] } = useAllAdBanners();
  const { create, toggleActive, remove } = useAdBannerMutations();
  const { data: rotationSettings } = useAdCarouselSettings();
  const updateRotation = useUpdateAdCarouselSettings();
  const [durationInput, setDurationInput] = useState("4");
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const { user } = useCurrentUser();
  const logMedia = useLogMedia();

  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [days, setDays] = useState("7");

  useEffect(() => {
    if (rotationSettings) setDurationInput(String(Math.round(rotationSettings.durationMs / 1000)));
  }, [rotationSettings?.durationMs]);

  // ↔ بند 7 (صورة الإعلان مش بتظهر): كانت الطريقة الوحيدة هى لصق رابط
  // صورة يدويًا (عرضة للأخطاء — روابط مش مباشرة، محتاجة صلاحيات، إلخ)،
  // بدل رفع حقيقي زي كل صور التطبيق التانية (الأفاتار/الوسائط). دلوقتي
  // بيرفع فعليًا على Cloudinary زي useAccount's pickAvatar بالظبط.
  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
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

  function addBanner() {
    if (!title.trim()) return;
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + (Number(days) || 7));
    create.mutate({
      title: title.trim(),
      imageUrl: imageUrl.trim() || undefined,
      linkUrl: linkUrl.trim() || undefined,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      sortOrder: banners.length,
    });
    setTitle(""); setImageUrl(""); setLinkUrl(""); setDays("7");
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>طريقة عرض الإعلانات</Text>
        <View style={styles.durationRow}>
          <Pressable
            style={[styles.rotationBtn, rotationSettings?.rotationMode === "auto" && styles.rotationBtnActive]}
            onPress={() => updateRotation.mutate({ rotationMode: "auto" })}
          >
            <Text style={[styles.rotationBtnText, rotationSettings?.rotationMode === "auto" && styles.rotationBtnTextActive]}>تلقائي (ينتقل لليمين)</Text>
          </Pressable>
          <Pressable
            style={[styles.rotationBtn, rotationSettings?.rotationMode === "manual" && styles.rotationBtnActive]}
            onPress={() => updateRotation.mutate({ rotationMode: "manual" })}
          >
            <Text style={[styles.rotationBtnText, rotationSettings?.rotationMode === "manual" && styles.rotationBtnTextActive]}>يدوي (بالسحب فقط)</Text>
          </Pressable>
        </View>
        {rotationSettings?.rotationMode !== "manual" && (
          <View style={styles.durationRow}>
            <Text style={styles.durationLabel}>مدة عرض كل إعلان (ثواني):</Text>
            <TextInput
              style={styles.durationInput}
              keyboardType="number-pad"
              value={durationInput}
              onChangeText={setDurationInput}
              onBlur={() => {
                const secs = Number(durationInput) || 4;
                updateRotation.mutate({ durationMs: secs * 1000 });
              }}
            />
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>إضافة إعلان جديد</Text>
        <TextInput style={styles.input} placeholder="عنوان الإعلان" placeholderTextColor={themeColors.textSubtle} value={title} onChangeText={setTitle} />
        <Pressable style={styles.imagePicker} onPress={pickImage} disabled={uploadingImage}>
          {uploadingImage ? (
            <ActivityIndicator color="#f59e0b" />
          ) : imageUrl ? (
            <Image source={{ uri: cldThumbnail(imageUrl) }} style={styles.imagePreview} contentFit="cover" />
          ) : (
            <Text style={styles.imagePickerText}>اختر صورة الإعلان</Text>
          )}
        </Pressable>
        <TextInput style={styles.input} placeholder="الرابط عند الضغط (اختياري)" placeholderTextColor={themeColors.textSubtle} value={linkUrl} onChangeText={setLinkUrl} />
        <View style={styles.durationRow}>
          <Text style={styles.durationLabel}>مدة العرض (أيام):</Text>
          <TextInput style={styles.durationInput} keyboardType="number-pad" value={days} onChangeText={setDays} />
        </View>
        <Pressable style={styles.addBtn} onPress={addBanner} disabled={create.isPending}>
          <Text style={styles.addBtnText}>{create.isPending ? "جاري الإضافة..." : "إضافة الإعلان"}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>الإعلانات الحالية ({banners.length})</Text>
        <FlatList
          data={banners}
          keyExtractor={(b) => b.id}
          scrollEnabled={false}
          ListEmptyComponent={<Text style={styles.emptyText}>لا توجد إعلانات مضافة</Text>}
          renderItem={({ item }) => {
            const expired = item.endDate ? item.endDate < new Date().toISOString().slice(0, 10) : false;
            return (
              <View style={styles.bannerRow}>
                {item.imageUrl ? (
                  <Image source={{ uri: cldThumbnail(item.imageUrl) }} style={styles.bannerThumb} contentFit="cover" />
                ) : (
                  <View style={[styles.bannerThumb, styles.bannerThumbEmpty]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.bannerDates}>
                    {item.startDate} → {item.endDate || "بلا نهاية"} {expired ? "· منتهي" : ""}
                  </Text>
                </View>
                <Switch value={item.active} onValueChange={(v) => toggleActive.mutate({ id: item.id, active: v })} />
                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => Alert.alert("حذف الإعلان؟", "", [
                    { text: "إلغاء", style: "cancel" },
                    { text: "حذف", style: "destructive", onPress: () => remove.mutate(item.id) },
                  ])}
                >
                  <Text style={styles.deleteBtnText}>حذف</Text>
                </Pressable>
              </View>
            );
          }}
        />
      </View>
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    card: { backgroundColor: themeColors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: themeColors.border },
    cardTitle: { fontSize: 13, fontWeight: "900", color: themeColors.text, marginBottom: 10 },
    input: { borderWidth: 1, borderColor: themeColors.border, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, fontSize: 12.5, marginBottom: 8, color: themeColors.text },
    imagePicker: {
      height: 90, borderRadius: 10, borderWidth: 1, borderColor: themeColors.border, borderStyle: "dashed",
      alignItems: "center", justifyContent: "center", marginBottom: 8, overflow: "hidden", backgroundColor: themeColors.surface,
    },
    imagePickerText: { fontSize: 12, fontWeight: "700", color: themeColors.textSubtle },
    imagePreview: { width: "100%", height: "100%" },
    durationRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    durationLabel: { fontSize: 12, color: themeColors.textSubtle, fontWeight: "700" },
    rotationBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, backgroundColor: themeColors.surface },
    rotationBtnActive: { backgroundColor: "#f59e0b" },
    rotationBtnText: { fontSize: 11.5, fontWeight: "800", color: themeColors.textSubtle },
    rotationBtnTextActive: { color: "white" },
    durationInput: { borderWidth: 1, borderColor: themeColors.border, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, fontSize: 12.5, width: 60, textAlign: "center", color: themeColors.text },
    addBtn: { backgroundColor: "#f59e0b", borderRadius: 999, paddingVertical: 11, alignItems: "center" },
    addBtnText: { color: "white", fontWeight: "900", fontSize: 12.5 },
    emptyText: { textAlign: "center", color: themeColors.textSubtle, fontSize: 12, paddingVertical: 16 },
    bannerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: themeColors.border },
    bannerThumb: { width: 44, height: 44, borderRadius: 8 },
    bannerThumbEmpty: { backgroundColor: themeColors.surface },
    bannerTitle: { fontSize: 12.5, fontWeight: "800", color: themeColors.text },
    bannerDates: { fontSize: 10.5, color: themeColors.textSubtle, marginTop: 2 },
    deleteBtn: { backgroundColor: themeColors.isDark ? "rgba(239,68,68,0.15)" : "#FEF2F2", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
    deleteBtnText: { color: "#991B1B", fontWeight: "900", fontSize: 11 },
  });
}
