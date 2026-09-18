import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../lib/hooks/useLanguage";

export type LiveComment = { id: string; name: string; text: string };

// ↔ .live-comment / .live-comment-input. Shows the last 4 comments
// (slice(-4), same as renderLiveReel) and a rounded input with a send icon.
type Props = {
  comments: LiveComment[];
  onSend: (text: string) => void;
  disabled?: boolean;
  disabledMessage?: string;
};

// ↔ إصلاح "خانة كتابة التعليق بتتداخل مع شريط مهام الموبايل": كانت
// bottom:16 رقم ثابت مايراعيش نظام الجوال (شريط الإيماءات على أندرويد،
// أو خط الـ Home Indicator على آيفون) — على الأجهزة اللي شريط النظام
// بتاعها بياخد مساحة حقيقية من الشاشة، الخانة كانت بترسم تحته/جواه
// بالظبط. الحل: نضيف مسافة أمان ديناميكية (insets.bottom) فوق الـ 16
// الأصلية بدل ما تكون ثابتة — على الويب insets.bottom بترجع 0 (مفيش
// شريط نظام أصلًا)، فالسلوك هناك يفضل زي ما هو بالظبط.

export function LiveCommentsOverlay({ comments, onSend, disabled, disabledMessage }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState("");

  function submit() {
    if (disabled) return;
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  }

  const visible = comments.slice(-4);

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
      <View style={styles.feed} pointerEvents="none">
        {visible.map((c) => (
          <View key={c.id} style={styles.bubble}>
            <Text style={styles.bubbleText}>
              <Text style={styles.bubbleName}>{c.name} </Text>
              {c.text}
            </Text>
          </View>
        ))}
      </View>
      {disabled ? (
        <View style={styles.blockedRow}>
          <Text style={styles.blockedText}>{disabledMessage || t("تم حظرك من الدردشة")}</Text>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t("اكتب تعليق ...")}
            placeholderTextColor="rgba(255,255,255,0.7)"
            onSubmitEditing={submit}
            returnKeyType="send"
            maxLength={200}
          />
          <Pressable style={styles.sendBtn} onPress={submit} hitSlop={8}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="white">
              <Path d="M2 21l21-9L2 3v7l15 2-15 2z" />
            </Svg>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 70, gap: 8 },
  feed: { gap: 6, marginBottom: 4 },
  bubble: { backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, alignSelf: "flex-start", maxWidth: "100%" },
  bubbleText: { color: "white", fontSize: 11.5 },
  bubbleName: { color: "#4ade80", fontWeight: "900" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
    color: "white", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, fontSize: 12,
  },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#22A652", alignItems: "center", justifyContent: "center" },
  blockedRow: { backgroundColor: "rgba(239,68,68,0.25)", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 },
  blockedText: { color: "white", fontSize: 12, fontWeight: "800", textAlign: "center" },
});
