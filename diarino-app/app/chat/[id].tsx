import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  View, Text, Pressable, FlatList, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import Svg, { Path, Circle } from "react-native-svg";
import { useChatList, useChatMessages, useSendMessage, useMarkChatRead } from "../../lib/hooks/useChatsDB";
import { usePropertyById } from "../../lib/hooks/useProperties";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";
import { uploadToCloudinary, cldThumbnail } from "../../lib/cloudinary";
import { useLogMedia } from "../../lib/hooks/useMedia";
import { fmtPrice } from "../../lib/types";
import { ReelBackground } from "../../components/reel/ReelBackground";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";
import { openExternalUrl } from "../../lib/linking";
import { phoneToWaMeDigits } from "../../lib/phone";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MAX_IMAGES = 10; // ↔ maxImages in handleChatImageUpload()

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const { user } = useCurrentUser();
  const logMedia = useLogMedia();
  const { data: chats = [] } = useChatList(user?.id);
  const chatSummary = chats.find((c) => c.id === id);
  const { data: messages = [] } = useChatMessages(id, user?.id);
  const sendMessage = useSendMessage();
  const markRead = useMarkChatRead();

  const [draft, setDraft] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (id && user?.id) markRead.mutate({ chatId: id, currentUserId: user.id });
  }, [id, user?.id]);

  const property = usePropertyById(chatSummary?.propertyId ?? undefined);

  if (!chatSummary) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>{t("هذه المحادثة غير متاحة")}</Text>
        <Pressable style={styles.backChip} onPress={() => router.back()}>
          <Text style={styles.backChipText}>{t("رجوع")}</Text>
        </Pressable>
      </View>
    );
  }

  async function pickImages() {
    const available = MAX_IMAGES - pendingImages.length;
    if (available <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: available,
      quality: 0.8,
    });
    if (!result.canceled) {
      setPendingImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_IMAGES));
    }
  }

  function removePendingImage(idx: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== idx));
  }

  // Local device URIs (file://...) only exist on the sender's phone — they
  // have to actually go up to Storage so the other participant can load
  // them too. Now that the "chat-images" bucket actually exists (see the
  // storage migration), the upload path MUST start with the uploader's own
  // user id — that's what the bucket's RLS policies check ownership against.
  async function uploadPendingImages(): Promise<string[]> {
    if (!user) return [];
    const urls: string[] = [];
    for (const uri of pendingImages) {
      const result = await uploadToCloudinary(uri, "image");
      logMedia.mutate({ ownerId: user.id, type: "image", context: "chat", contextId: id, result });
      urls.push(result.url);
    }
    return urls;
  }

  async function send() {
    if (!draft.trim() && pendingImages.length === 0) return;
    if (!user) return;
    setUploading(true);
    try {
      const uploadedUrls = pendingImages.length > 0 ? await uploadPendingImages() : [];
      await sendMessage.mutateAsync({ chatId: id, senderId: user.id, text: draft.trim(), images: uploadedUrls });
      setDraft("");
      setPendingImages([]);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch {
      // Best-effort: leave the draft/images in place so the user can retry.
    } finally {
      setUploading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => router.back()} hitSlop={8}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <Path d="M5 12h14M12 5l7 7-7 7" />
          </Svg>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerName}>{t(chatSummary.partnerName)}</Text>
        </View>
        <Pressable
          style={styles.headerBtn}
          onPress={() => router.push(`/seller/${chatSummary.partnerId}`)}
          hitSlop={8}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <Circle cx={12} cy={8} r={4} /><Path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
          </Svg>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => `${id}-${i}`}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        ListHeaderComponent={
          property ? (
            <Pressable style={styles.propertyCard} onPress={() => router.push(`/property/${property.id}`)}>
              <View style={styles.propertyCover}><ReelBackground index={0} type={property.type} /></View>
              <View style={{ padding: 10 }}>
                <Text style={styles.propertyTitle} numberOfLines={1}>{t(property.shortTitle || property.title)}</Text>
                <Text style={styles.propertyPrice}>
                  {fmtPrice(property.price)} {t("ج.م")} {property.purpose === "rent" ? t("/ شهر") : ""}
                </Text>
              </View>
            </Pressable>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.from === "me" ? styles.bubbleSent : styles.bubbleReceived]}>
            {!!item.whatsapp && (
              // ↔ الميزة الدولية لإدخال رقم الهاتف: item.whatsapp بقى E.164
              // مضمون الصحة دلوقتي (بعد MakeOfferModal.tsx)، فبقى ممكن نخليه
              // رابط واتساب فعلي بدل نص عرض بس زي ما كان قبل كده.
              <Pressable onPress={() => openExternalUrl(`https://wa.me/${phoneToWaMeDigits(item.whatsapp!)}`, t("تعذر فتح واتساب"))}>
                <Text style={[styles.bubbleWhatsapp, item.from === "me" && styles.bubbleTextSent]}>
                  📱 {t("واتساب")}: {item.whatsapp}
                </Text>
              </Pressable>
            )}
            {!!item.text && (
              <Text style={[styles.bubbleText, item.from === "me" && styles.bubbleTextSent]}>{item.text}</Text>
            )}
            {item.images && item.images.length > 0 && (
              <View style={styles.imgGrid}>
                {item.images.slice(0, 4).map((uri: string, i: number) => (
                  <Image key={i} source={{ uri: cldThumbnail(uri) }} style={styles.imgCell} contentFit="cover" transition={150} />
                ))}
              </View>
            )}
            <Text style={[styles.bubbleTime, item.from === "me" && styles.bubbleTimeSent]}>{item.time}</Text>
          </View>
        )}
      />

      {pendingImages.length > 0 && (
        <View style={styles.pendingRow}>
          {pendingImages.map((uri, idx) => (
            <View key={idx} style={styles.pendingWrap}>
              <Image source={{ uri }} style={styles.pendingImg} contentFit="cover" />
              <Pressable style={styles.pendingRemove} onPress={() => removePendingImage(idx)}>
                <Text style={styles.pendingRemoveText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.inputArea, { paddingBottom: Math.max(10, insets.bottom + 6) }]}>
        <Pressable style={styles.attachBtn} onPress={pickImages} hitSlop={6}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#22A652" strokeWidth={2}>
            <Path d="M21.44 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3 3 0 014.24 4.24l-9.2 9.19a1 1 0 01-1.41-1.41l8.49-8.48" />
          </Svg>
        </Pressable>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={t("اكتب رسالتك ...")}
          placeholderTextColor={themeColors.textSubtle}
          multiline
        />
        <Pressable style={styles.sendBtn} onPress={send} hitSlop={6} disabled={uploading}>
          {uploading ? <ActivityIndicator color="white" size="small" /> : (
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="white"><Path d="M2 21l21-9L2 3v7l15 2-15 2z" /></Svg>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: themeColors.background },
    notFoundText: { fontSize: 14, fontWeight: "800", color: themeColors.textMuted },
    backChip: { backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 24 },
    backChipText: { color: "white", fontWeight: "900" },
    header: {
      paddingTop: 50, paddingBottom: 12, paddingHorizontal: 14, backgroundColor: "#22A652",
      flexDirection: "row", alignItems: "center", gap: 10,
    },
    headerBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    headerName: { color: "white", fontWeight: "900", fontSize: 13.5 },
    propertyCard: { backgroundColor: themeColors.card, borderRadius: 12, overflow: "hidden", marginBottom: 6 },
    propertyCover: { height: 90 },
    propertyTitle: { fontSize: 12, fontWeight: "900", color: themeColors.text },
    propertyPrice: { fontSize: 12, fontWeight: "900", color: "#22A652", marginTop: 3 },
    bubble: { maxWidth: "78%", borderRadius: 14, padding: 10 },
    bubbleReceived: { backgroundColor: themeColors.card, alignSelf: "flex-start", borderBottomLeftRadius: 2 },
    bubbleSent: { backgroundColor: "#22A652", alignSelf: "flex-end", borderBottomRightRadius: 2 },
    bubbleText: { fontSize: 13, color: themeColors.text, lineHeight: 19 },
    bubbleWhatsapp: { fontSize: 10, color: themeColors.textSubtle, opacity: 0.8, marginBottom: 4 },
    bubbleTextSent: { color: "white" },
    bubbleTime: { fontSize: 9.5, color: themeColors.textSubtle, marginTop: 4, alignSelf: "flex-end" },
    bubbleTimeSent: { color: "rgba(255,255,255,0.75)" },
    imgGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
    imgCell: { width: 80, height: 80, borderRadius: 8 },
    pendingRow: { flexDirection: "row", gap: 8, padding: 10, backgroundColor: themeColors.card },
    pendingWrap: { position: "relative" },
    pendingImg: { width: 52, height: 52, borderRadius: 8 },
    pendingRemove: { position: "absolute", top: -5, right: -5, width: 18, height: 18, borderRadius: 9, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" },
    pendingRemoveText: { color: "white", fontSize: 11, fontWeight: "900", marginTop: -1 },
    inputArea: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10, backgroundColor: themeColors.card, borderTopWidth: 1, borderTopColor: themeColors.border },
    attachBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ecfdf5" },
    input: { flex: 1, backgroundColor: themeColors.surface, borderRadius: 18, paddingVertical: 9, paddingHorizontal: 14, fontSize: 13, maxHeight: 100, color: themeColors.text },
    sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#22A652", alignItems: "center", justifyContent: "center" },
  });
}
