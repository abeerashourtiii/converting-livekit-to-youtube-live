import { useState } from "react";
import { Modal, View, Text, TextInput, Pressable, StyleSheet, Animated } from "react-native";
import { PropertyRequest } from "../../data/mock-requests";
import { fmtPrice } from "../../lib/types";
import { PhoneInput, PhoneInputValue } from "../shared/PhoneInput";
import { validateAndFormatPhone } from "../../lib/phone";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";
import { useDragToClose } from "../../lib/hooks/useDragToClose";

type Props = {
  visible: boolean;
  request: PropertyRequest | null;
  onClose: () => void;
  onSubmit: (message: string, price: string, whatsapp: string) => void;
};

export function MakeOfferModal({ visible, request, onClose, onSubmit }: Props) {
  const { t } = useLanguage();
  const [message, setMessage] = useState("");
  const [price, setPrice] = useState("");
  const [whatsapp, setWhatsapp] = useState<PhoneInputValue>({ countryIso2: "", localNumber: "" });
  const [whatsappError, setWhatsappError] = useState(false);
  const [messageError, setMessageError] = useState(false);
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const { translateY, backdropOpacity, panHandlers } = useDragToClose(() => { reset(); onClose(); });

  function reset() {
    setMessage(""); setPrice(""); setWhatsapp({ countryIso2: "", localNumber: "" }); setWhatsappError(false); setMessageError(false);
  }

  function submit() {
    // ↔ submitOffer() validation: message required, whatsapp required &
    // valid per the selected country (كانت مصر بس قبل الميزة الدولية).
    if (!message.trim()) { setMessageError(true); return; }
    const result = whatsapp.countryIso2 ? validateAndFormatPhone(whatsapp.localNumber, whatsapp.countryIso2) : { valid: false as const, reason: "" };
    if (!result.valid) { setWhatsappError(true); return; }
    onSubmit(message.trim(), price.trim(), result.e164);
    reset();
  }

  if (!request) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { reset(); onClose(); }} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...panHandlers}>
        <View style={styles.dragHandle} />
        <Text style={styles.title}>{t("تقديم عرض")}</Text>
        <Text style={styles.summary}>
          <Text style={{ fontWeight: "900" }}>{t(request.type)} {request.purpose === "sale" ? t("للبيع") : t("للإيجار")}</Text>
          {" · "}{request.province} · {request.location}{"\n"}طلب من: {request.requesterName}
        </Text>

        <Text style={styles.label}>{t("رسالتك")}</Text>
        <TextInput
          style={[styles.textarea, messageError && styles.inputError]}
          value={message}
          onChangeText={(v) => { setMessage(v); setMessageError(false); }}
          placeholder={t("اكتب تفاصيل العرض...")}
          placeholderTextColor={themeColors.textSubtle}
          multiline
          numberOfLines={4}
        />
        {messageError && <Text style={styles.errorText}>{t("اكتب رسالتك")}</Text>}

        <Text style={styles.label}>{t("السعر المقترح")} {t("(اختياري)")}</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          placeholder="3800000"
          placeholderTextColor={themeColors.textSubtle}
          keyboardType="number-pad"
        />
        {!!price && <Text style={styles.pricePreview}>{fmtPrice(Number(price) || 0)} ج.م</Text>}

        <Text style={styles.label}>{t("رقم واتساب للتواصل")}</Text>
        <PhoneInput
          value={whatsapp}
          onChange={(v) => { setWhatsapp(v); setWhatsappError(false); }}
          error={whatsappError}
        />
        {whatsappError && <Text style={styles.errorText}>{t("ادخل رقم واتساب صحيح")}</Text>}

        <Pressable style={styles.submitBtn} onPress={submit}>
          <Text style={styles.submitBtnText}>{t("إرسال العرض")}</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: themeColors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 30 },
    dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: themeColors.border, alignSelf: "center", marginBottom: 12 },
    title: { fontSize: 15, fontWeight: "900", color: themeColors.text, marginBottom: 8 },
    summary: { fontSize: 12, color: themeColors.textSubtle, lineHeight: 19, marginBottom: 16 },
    label: { fontSize: 11.5, fontWeight: "800", color: themeColors.textMuted, marginBottom: 6, marginTop: 10 },
    input: { backgroundColor: themeColors.surface, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12, fontSize: 13, color: themeColors.text },
    textarea: { backgroundColor: themeColors.surface, borderRadius: 10, padding: 12, fontSize: 13, color: themeColors.text, minHeight: 90, textAlignVertical: "top" },
    inputError: { borderWidth: 1.5, borderColor: "#ef4444" },
    errorText: { color: "#ef4444", fontSize: 11, marginTop: 4 },
    pricePreview: { color: "#22A652", fontSize: 11, fontWeight: "800", marginTop: 4 },
    submitBtn: { marginTop: 18, backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 14, alignItems: "center" },
    submitBtnText: { color: "white", fontWeight: "900", fontSize: 14 },
  });
}
