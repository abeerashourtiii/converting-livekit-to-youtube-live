import { useRef, type ComponentProps } from "react";
import { Modal, View, Text, Pressable, StyleSheet, Animated, PanResponder } from "react-native";
import Svg from "react-native-svg";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

// ↔ react-native-svg's own exported `SvgProps` type resolves to a
// different (and incompatible) declaration file depending on whether
// tsc is resolving the native or the web build of the package — deriving
// the prop type straight from the `Svg` component itself instead sidesteps
// that entirely and stays correct on both platforms.
export type ActionSheetIconProps = ComponentProps<typeof Svg>;

export type ActionSheetItem = {
  key: string;
  label: string;
  icon?: (props: ActionSheetIconProps) => React.ReactElement;
  danger?: boolean;
  disabled?: boolean;
  onPress?: () => void;
};

type Props = {
  visible: boolean;
  title?: string;
  items: ActionSheetItem[];
  onClose: () => void;
};

const DISMISS_THRESHOLD = 90;

export function ActionSheet({ visible, title, items, onClose }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && g.dy > 0,
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD) {
          Animated.timing(translateY, { toValue: 500, duration: 200, useNativeDriver: true }).start(() => {
            translateY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
        <View style={styles.handle} />
        {!!title && <Text style={styles.title} numberOfLines={1}>{title}</Text>}
        {items.map((item) => (
          <Pressable
            key={item.key}
            style={styles.item}
            disabled={item.disabled}
            onPress={() => { onClose(); item.onPress?.(); }}
          >
            {item.icon?.({ width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: item.danger ? "#991B1B" : themeColors.text, strokeWidth: 2 })}
            <Text style={[styles.itemText, item.danger && styles.itemTextDanger, item.disabled && styles.itemTextDisabled]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
        <Pressable style={styles.cancelItem} onPress={onClose}>
          <Text style={styles.cancelItemText}>{t("إلغاء")}</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
    sheet: {
      position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: themeColors.card,
      borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24, paddingTop: 6,
    },
    handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: themeColors.border, alignSelf: "center", marginVertical: 10 },
    title: { paddingHorizontal: 18, paddingBottom: 10, fontSize: 12.5, fontWeight: "900", color: themeColors.textSubtle, textAlign: "center" },
    item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 20 },
    itemText: { fontSize: 13.5, fontWeight: "900", color: themeColors.text },
    itemTextDanger: { color: "#991B1B" },
    itemTextDisabled: { opacity: 0.5 },
    cancelItem: { paddingVertical: 14, alignItems: "center" },
    cancelItemText: { fontSize: 13.5, fontWeight: "900", color: themeColors.textSubtle },
  });
}
