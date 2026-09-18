import { ImageSourcePropType } from "react-native";
import { Image } from "expo-image";
import Svg, { Path, Circle, Rect } from "react-native-svg";

// Real cropped photos/illustrations from the approved reference design
// (AI-generated, not anyone's copyrighted property — see chat) — used
// instead of the plain vector icons for these specific menu cards.
// Aspect ratio is preserved from the original crop so sizing stays
// faithful to the reference proportions; MenuCardIcon derives width from
// a target height using this ratio.
const MENU_CARD_IMAGES: Record<string, ImageSourcePropType> = {
  search_building: require("../assets/menu-icons/search_building.png"),
  plus: require("../assets/menu-icons/publish.png"),
  chat: require("../assets/menu-icons/request.png"),
  scale: require("../assets/menu-icons/lawyer.png"),
  live_signal: require("../assets/menu-icons/live.png"),
  building: require("../assets/menu-icons/repoo.png"),
  crane_truck: require("../assets/menu-icons/crane.png"),
  settings: require("../assets/menu-icons/settings.png"),
  plumbing_electric: require("../assets/menu-icons/plumbing.png"),
};

const MENU_CARD_IMAGE_ASPECT: Record<string, number> = {
  search_building: 385 / 225,
  plus: 185 / 160,
  chat: 185 / 160,
  scale: 135 / 120,
  live_signal: 1,
  building: 80 / 65,
  crane_truck: 157 / 70,
  settings: 146 / 111,
  plumbing_electric: 171 / 95,
};

// ↔ "إدارة الحساب" card — explicitly a plain green human silhouette, not
// a photo (per the person's instruction), so this one key always renders
// as a solid-fill vector shape regardless of card color.
function GreenPersonIcon({ height }: { height: number }) {
  return (
    <Svg width={height} height={height} viewBox="0 0 24 24">
      <Circle cx={12} cy={8} r={4.2} fill="#22A652" />
      <Path d="M4 20.5c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="#22A652" />
    </Svg>
  );
}

// ↔ the menu page's per-card icon — a real image for the keys that have
// one (see MENU_CARD_IMAGES above), the green silhouette for the account
// card, or the plain vector icon (MenuIcon below) as a fallback for any
// other admin-chosen key.
export function MenuCardIcon({ iconKey, height = 56, color = "white" }: { iconKey: string; height?: number; color?: string }) {
  if (iconKey === "account_circle") return <GreenPersonIcon height={height} />;
  const source = MENU_CARD_IMAGES[iconKey];
  if (source) {
    const aspect = MENU_CARD_IMAGE_ASPECT[iconKey] ?? 1;
    // ↔ #2: expo-image (بدل Image الأساسي من react-native) بيدّي تحجيم
    // بجودة أعلى (GPU-accelerated resampling) + كاش على الديسك، فالأيقونة
    // بتظهر أوضح من غير أي تغيير فى الملفات نفسها — نفس مكوّن الصور
    // المستخدم فى باقي الشاشة (menu.tsx وReelCard.tsx).
    return (
      <Image
        source={source}
        style={{ height, width: height * aspect, borderRadius: 8 }}
        contentFit="contain"
        cachePolicy="memory-disk"
      />
    );
  }
  return <MenuIcon iconKey={iconKey} size={height} color={color} />;
}

// ↔ raw source for cards that need full-bleed placement (cover-fit,
// no padding/contain-box) instead of the fixed-aspect icon box above —
// the tall "ابحث عن عقار" hero photo and the round "اطلع اللايف" button.
export function menuCardImageSource(iconKey: string): ImageSourcePropType | null {
  return MENU_CARD_IMAGES[iconKey] ?? null;
}

// ↔ backs the menu page's fully admin-manageable cards (public.menu_items).
// Since letting an admin type raw SVG path data would be both unsafe and
// impractical on a phone keyboard, icons are chosen from this curated set
// by key instead — still real customization (color/text/order/action are
// all free-form), just not arbitrary vector art.
export type MenuIconKey =
  | "search_building" | "plus" | "chat" | "scale" | "building" | "crane_truck"
  | "star" | "gift" | "home" | "heart" | "phone" | "tag" | "camera" | "briefcase"
  | "map_pin" | "users" | "megaphone" | "question"
  | "settings" | "account_circle" | "live_signal" | "plumbing_electric";

export const ICON_KEYS: MenuIconKey[] = [
  "search_building", "plus", "chat", "scale", "building", "crane_truck",
  "star", "gift", "home", "heart", "phone", "tag", "camera", "briefcase",
  "map_pin", "users", "megaphone", "question",
  "settings", "account_circle", "live_signal", "plumbing_electric",
];

export function MenuIcon({ iconKey, size = 32, color = "white" }: { iconKey: string; size?: number; color?: string }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none" as const, stroke: color, strokeWidth: 1.7 };
  switch (iconKey as MenuIconKey) {
    case "search_building":
      return (
        <Svg {...p}>
          <Path d="M6 22V4a1 1 0 011-1h10a1 1 0 011 1v18" strokeLinejoin="round" />
          <Path d="M2 22h20" strokeLinecap="round" />
          <Path d="M9 6h1.5M13.5 6H15M9 10h1.5M13.5 10H15M9 14h1.5M13.5 14H15" strokeLinecap="round" />
          <Path d="M10 22v-4a1 1 0 011-1h2a1 1 0 011 1v4" />
        </Svg>
      );
    case "plus":
      return <Svg {...p}><Path d="M12 5v14M5 12h14" /></Svg>;
    case "chat":
      return <Svg {...p}><Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></Svg>;
    case "scale":
      return (
        <Svg {...p}>
          <Path d="M12 2v20M7.5 22h9" strokeLinecap="round" />
          <Path d="M4 6h16" strokeLinecap="round" />
          <Path d="M4 6l-2.6 5.2a2.8 2.8 0 005.2 0L4 6z" strokeLinejoin="round" />
          <Path d="M20 6l-2.6 5.2a2.8 2.8 0 005.2 0L20 6z" strokeLinejoin="round" />
          <Circle cx={12} cy={2.4} r={1} fill={color} stroke="none" />
        </Svg>
      );
    case "building":
      return <Svg {...p}><Path d="M3 21h18M5 21V8l7-4 7 4v13" /></Svg>;
    case "crane_truck":
      return (
        <Svg {...p}>
          <Path d="M2 16V10a1 1 0 011-1h6v7" strokeLinejoin="round" />
          <Path d="M9 12h4.5l3 3.5V16" strokeLinejoin="round" />
          <Path d="M2 16h1.5M17 16h1.5" strokeLinecap="round" />
          <Circle cx={6} cy={18} r={1.6} />
          <Circle cx={15.5} cy={18} r={1.6} />
          <Path d="M8 9V3.5h8" strokeLinecap="round" />
          <Path d="M16 3.5v3" strokeLinecap="round" />
        </Svg>
      );
    case "star":
      return <Svg {...p}><Path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8l-6.2 3.2 1.2-6.8-5-4.9 6.9-1z" /></Svg>;
    case "gift":
      return <Svg {...p}><Rect x={3} y={8} width={18} height={13} rx={1} /><Path d="M3 12h18M12 8v13M12 8c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3M12 8c1.7 0 3-1.3 3-3s-1.3-3-3-3" /></Svg>;
    case "home":
      return <Svg {...p}><Path d="M3 11l9-8 9 8" /><Path d="M5 10v10h14V10" /></Svg>;
    case "heart":
      return <Svg {...p}><Path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" /></Svg>;
    case "phone":
      return <Svg {...p}><Path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3.1-8.7A2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .3 2 .7 3a2 2 0 01-.5 2.1L7.9 10.3a16 16 0 006 6l1.5-1.4a2 2 0 012.1-.5c1 .4 2 .6 3 .7a2 2 0 011.7 2z" /></Svg>;
    case "tag":
      return <Svg {...p}><Path d="M20.6 12l-8.6 8.6L2 10.6V2h8.6z" /><Circle cx={7} cy={7} r={1.5} fill={color} stroke="none" /></Svg>;
    case "camera":
      return <Svg {...p}><Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><Circle cx={12} cy={13} r={4} /></Svg>;
    case "briefcase":
      return <Svg {...p}><Rect x={2} y={7} width={20} height={14} rx={2} /><Path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></Svg>;
    case "map_pin":
      return <Svg {...p}><Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><Circle cx={12} cy={10} r={3} /></Svg>;
    case "users":
      return <Svg {...p}><Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><Circle cx={9} cy={7} r={4} /><Path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8" /></Svg>;
    case "megaphone":
      return <Svg {...p}><Path d="M3 11v3a1 1 0 001 1h2l4 5V6L6 11H4a1 1 0 00-1 1z" /><Path d="M15 8a4 4 0 010 7M18 5a8 8 0 010 13" /></Svg>;
    case "settings":
      return (
        <Svg {...p}>
          <Circle cx={12} cy={12} r={3} />
          <Path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6V21a2 2 0 11-4 0v-.2a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.6-1H3a2 2 0 110-4h.2a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.6V3a2 2 0 114 0v.2a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.6 1H21a2 2 0 110 4h-.2a1.7 1.7 0 00-1.6 1z" strokeLinejoin="round" />
        </Svg>
      );
    case "account_circle":
      return (
        <Svg {...p}>
          <Circle cx={12} cy={12} r={10} />
          <Circle cx={12} cy={10} r={3.2} />
          <Path d="M5.5 19a6.8 6.8 0 0113 0" />
        </Svg>
      );
    case "live_signal":
      return (
        <Svg {...p}>
          <Circle cx={5.5} cy={18.5} r={1.8} fill={color} stroke="none" />
          <Path d="M5 13a6.5 6.5 0 016.5 6.5M5 8a11.5 11.5 0 0111.5 11.5" strokeLinecap="round" />
        </Svg>
      );
    case "plumbing_electric":
      return (
        <Svg {...p}>
          <Path d="M3 6l4-3 3 3-4 4" strokeLinejoin="round" />
          <Path d="M6 7l9 9" />
          <Path d="M13 21l3-6h-2l3-6-6 7h2z" strokeLinejoin="round" fill={color} />
        </Svg>
      );
    case "question":
    default:
      return <Svg {...p}><Circle cx={12} cy={12} r={10} /><Path d="M9.5 9a2.5 2.5 0 015 .5c0 1.7-2.5 2-2.5 3.5M12 17h.01" /></Svg>;
  }
}
