import { View, Text, StyleSheet } from "react-native";

const LABELS: Record<string, string> = { pending: "قيد المراجعة", approved: "منشورة", rejected: "مرفوضة" };
const COLORS: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "#fef3c7", fg: "#92400e" },
  approved: { bg: "#dcfce7", fg: "#166534" },
  rejected: { bg: "#fee2e2", fg: "#991b1b" },
};

export function StatusChip({ status }: { status: string }) {
  const c = COLORS[status] || COLORS.pending;
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{LABELS[status] || status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: "flex-start", paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 },
  text: { fontSize: 10.5, fontWeight: "800" },
});
