import { View, Text, StyleSheet } from "react-native";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

export function SimpleBarChart({ values, labels, color = "#6366f1" }: { values: number[]; labels?: string[]; color?: string }) {
  const max = Math.max(...values, 1);
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <View>
      <View style={styles.row}>
        {values.map((v, i) => (
          <View key={i} style={styles.barWrap}>
            <View style={[styles.bar, { height: `${(v / max) * 100}%`, backgroundColor: color }]} />
          </View>
        ))}
      </View>
      {labels && (
        <View style={styles.labelsRow}>
          {labels.map((l, i) => (
            <Text key={i} style={styles.label} numberOfLines={1}>{l}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 140, borderBottomWidth: 1, borderBottomColor: themeColors.border, paddingBottom: 4 },
    barWrap: { flex: 1, height: "100%", justifyContent: "flex-end" },
    bar: { borderRadius: 6, minHeight: 4 },
    labelsRow: { flexDirection: "row", gap: 8, marginTop: 6 },
    label: { flex: 1, textAlign: "center", fontSize: 9.5, color: themeColors.textSubtle, fontWeight: "700" },
  });
}
