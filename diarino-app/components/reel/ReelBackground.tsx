import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";

// ↔ REEL_BG_CLASSES + the .reel-bg-N gradient definitions in app-viewer.html.
// Each is a 135deg 3-stop gradient; LinearGradient approximates 135deg with
// start (0,0) -> end (1,1).
const REEL_BG_GRADIENTS: [string, string, string][] = [
  ["#667eea", "#764ba2", "#f093fb"],
  ["#f093fb", "#f5576c", "#ff9a9e"],
  ["#4facfe", "#00f2fe", "#43e97b"],
  ["#fa709a", "#fee140", "#ffecd2"],
  ["#30cfd0", "#330867", "#a8edea"],
  ["#ff9a9e", "#fad0c4", "#ffd1ff"],
];

// ↔ iconForType() — same path data as the SVG_* constants in app-viewer.html.
function TypeIcon({ type }: { type: string }) {
  const common = { width: "45%" as const, height: "45%" as const, viewBox: "0 0 24 24", fill: "white" as const };
  switch (type) {
    case "فيلا":
      return <Svg {...common}><Path d="M3 21h18M5 21V11l7-6 7 6v10M9 21v-7h6v7" /></Svg>;
    case "بنتهاوس":
      return <Svg {...common}><Path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 10h6M9 13h6" /></Svg>;
    case "تاون هاوس":
      return <Svg {...common}><Path d="M3 21h18M4 21V10l4-3 4 3v11M12 21V10l4-3 4 3v11M7 21v-4h2v4M15 21v-4h2v4" /></Svg>;
    case "تجاري":
      return <Svg {...common}><Path d="M3 9.5L4 4h16l1 5.5M4 9.5v10h16v-10" /></Svg>;
    case "إداري":
      return <Svg {...common}><Path d="M3 21h18M5 21V5h14v16M9 9h2M13 9h2M9 13h2M13 13h2" /></Svg>;
    case "طبي":
      return <Svg {...common}><Path d="M3 21h18M5 21V5h14v16M10 9h4v2h-4zM11 8v6h2V8z" /></Svg>;
    case "أرض":
      return <Svg {...common}><Path d="M3 21h18M3 21l6-12 4 6 3-5 5 11" /></Svg>;
    default: // شقة and fallback ↔ SVG_BUILDING
      return <Svg {...common}><Path d="M4 21V8l8-5 8 5v13h-5v-6H9v6z" /></Svg>;
  }
}

export function ReelBackground({ index, type }: { index: number; type: string }) {
  const [c1, c2, c3] = REEL_BG_GRADIENTS[index % REEL_BG_GRADIENTS.length];
  return (
    <View style={StyleSheet.absoluteFill}>
      {/* ↔ تزيين بصري بس (خلفية العقارات اللي مفيهاش فيديو/صور) — مفروض
          محدش يلمسها أصلاً، وpointerEvents="none" صريحة هنا وقاية من نفس
          فئة الباغ اللي ظهرت مع VideoView وLinearGradient التانية فوق فى
          ReelInfoOverlay.tsx: سطح رندر أصلي زي ده ممكن يبلع اللمس حتى لو
          متعرّف قبل الـ Pressable بتاع "اضغط للإيقاف/التشغيل" فى ترتيب
          الـ JSX (يعني المفروض يبقى تحته). */}
      <LinearGradient
        colors={[c1, c2, c3]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.iconWrap}>
        <TypeIcon type={type} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // .reel-bg-icon { opacity: 0.18 }
  iconWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", opacity: 0.18 },
});
