import Svg, { Path, Circle, Rect } from "react-native-svg";

// Each icon is a 1:1 port of the inline <svg> markup from the bottom-nav
// buttons in app-viewer.html (lines 766-770) — same viewBox, same paths,
// so the tab bar reads identically to the web version.

type IconProps = { color: string; size: number };

export function ReelsIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M3 11l9-7 9 7" />
      <Path d="M5 10v10h14V10" />
      <Path d="M9 21v-6h6v6" />
    </Svg>
  );
}

export function SearchIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx={11} cy={11} r={7} />
      <Path d="M21 21l-4.3-4.3" />
    </Svg>
  );
}

export function MenuIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Rect x={3} y={3} width={7} height={7} rx={1.5} />
      <Rect x={14} y={3} width={7} height={7} rx={1.5} />
      <Rect x={3} y={14} width={7} height={7} rx={1.5} />
      <Rect x={14} y={14} width={7} height={7} rx={1.5} />
    </Svg>
  );
}

export function RequestsIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <Rect x={9} y={3} width={6} height={4} rx={1} />
      <Path d="M9 12h6M9 16h6" />
    </Svg>
  );
}

// ↔ the floating bottom-bar's search button — a magnifying glass with a
// small sparkle accent, matching the raised circular "search" button in
// the new floating tab bar design.
export function SearchSparkleIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx={10.5} cy={10.5} r={6.5} />
      <Path d="M19.5 19.5l-4.3-4.3" />
      <Path d="M19 2.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" fill={color} stroke="none" />
    </Svg>
  );
}

export function AccountIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </Svg>
  );
}
