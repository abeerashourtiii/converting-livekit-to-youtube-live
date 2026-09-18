import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

export type DonutSlice = { label: string; value: number; color: string };

const SIZE = 160;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function SimpleDonutChart({ slices }: { slices: DonutSlice[] }) {
  const total = slices.reduce((a, b) => a + b.value, 0) || 1;
  let offsetSoFar = 0;
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  return (
    <View style={styles.container}>
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={themeColors.surface} strokeWidth={STROKE} fill="none" />
          {slices.map((s, i) => {
            const length = (s.value / total) * CIRCUMFERENCE;
            const dashoffset = -offsetSoFar;
            offsetSoFar += length;
            return (
              <Circle
                key={i}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke={s.color}
                strokeWidth={STROKE}
                fill="none"
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                strokeDashoffset={dashoffset}
                strokeLinecap="butt"
                rotation={-90}
                origin={`${SIZE / 2}, ${SIZE / 2}`}
              />
            );
          })}
        </Svg>
        <View style={styles.centerLabel}>
          <Text style={styles.centerLabelText}>100%</Text>
        </View>
      </View>

      <View style={styles.legend}>
        {slices.map((s, i) => (
          <View key={i} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel}>{s.label}</Text>
            <Text style={styles.legendValue}>{s.value}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    container: { alignItems: "center", gap: 16 },
    centerLabel: {
      position: "absolute", top: STROKE, left: STROKE, right: STROKE, bottom: STROKE,
      borderRadius: 999, backgroundColor: themeColors.card, alignItems: "center", justifyContent: "center",
    },
    centerLabelText: { fontSize: 16, fontWeight: "900", color: themeColors.text },
    legend: { width: "100%", gap: 8 },
    legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    legendLabel: { flex: 1, fontSize: 12.5, color: themeColors.textMuted, fontWeight: "700" },
    legendValue: { fontSize: 12.5, fontWeight: "900", color: themeColors.text },
  });
}
