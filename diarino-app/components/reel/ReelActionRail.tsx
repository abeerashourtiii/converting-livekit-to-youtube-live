import { View, Text, Pressable, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { Seller } from "../../lib/types";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useReelControlsBottomOffset } from "../../lib/uiConstants";
import { physicalSide } from "../../lib/rtl";

// ↔ .reel-side-actions. Side is now explicitly tied to the selected app
// language (not the device's forced RTL flag): profile/like/share/save sit
// on the LEFT in Arabic and the RIGHT in English, mirrored by
// ReelInfoOverlay's price/details block doing the opposite on the same
// screen. Buttons top-to-bottom: seller avatar+follow, like, share, save,
// compare.
//
// ↔ #6: شُرط البحث الجانبي (اللي كان فوق أيقونة البروفايل) اتحذف نهائيًا —
// عدسة البحث الوحيدة فى التطبيق دلوقتي هي اللي فى شريط المهام العائم
// (_floating-tab-bar.tsx)، عشان مايبقاش فيه عدستين بحث فى نفس الشاشة.

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill={filled ? "#ef4444" : "none"} stroke="white" strokeWidth={2}>
      <Path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" />
    </Svg>
  );
}

function ShareIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
      <Circle cx={18} cy={5} r={3} />
      <Circle cx={6} cy={12} r={3} />
      <Circle cx={18} cy={19} r={3} />
      <Path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </Svg>
  );
}

function SaveIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill={filled ? "#FBBF24" : "none"} stroke={filled ? "#FBBF24" : "white"} strokeWidth={2}>
      <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </Svg>
  );
}

// ↔ "قارن العقارات" — overlapping-cards glyph, filled green while this
// property is in the compare basket (lib/hooks/useCompareSelection.ts).
function CompareIcon({ active }: { active: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={active ? "#22A652" : "white"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 8a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" />
      <Path d="M8 6V4a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
    </Svg>
  );
}

function FollowGlyph({ following }: { following: boolean }) {
  return following ? (
    <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
      <Path d="M5 12l5 5L20 7" />
    </Svg>
  ) : (
    <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

// ↔ getSellerAvatarHtml() — for now only the "not me" branch (gradient +
// initial); the "me with custom avatar" branch comes back once account/
// profile photo upload is ported.
function SellerAvatar({ seller, size = 38 }: { seller: Seller; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: "white", fontWeight: "900", fontSize: Math.floor(size * 0.45) }}>{seller.initial}</Text>
    </View>
  );
}

type Props = {
  seller: Seller;
  likes: number;
  liked: boolean;
  saved: boolean;
  following: boolean;
  comparing: boolean;
  onOpenSeller: () => void;
  onToggleFollow: () => void;
  onToggleLike: () => void;
  onShare: () => void;
  onToggleSave: () => void;
  onToggleCompare: () => void;
};

export function ReelActionRail({
  seller, likes, liked, saved, following, comparing,
  onOpenSeller, onToggleFollow, onToggleLike, onShare, onToggleSave, onToggleCompare,
}: Props) {
  const { language } = useLanguage();
  const isAr = language !== "en";
  // ↔ إصلاح "شغّالة يمين/شمال صح على الويب بس، مش على أندرويد/آيفون" —
  // شوف شرح physicalSide() فى lib/rtl.ts. عايزين الأيقونات تظهر فعليًا
  // على الشمال فى العربي، فـ wantLeftVisually = isAr بالظبط.
  const railSide = physicalSide(isAr);
  // ↔ #2/#3: bottom offset إضافي عشان الأيقونات الجانبية تقف فوق شريط
  // المهام العائم دايمًا، حتى بعد ما الكارت بقى fullscreen كامل.
  const bottomOffset = useReelControlsBottomOffset();
  return (
    <View style={[styles.rail, railSide === "left" ? styles.railLeft : styles.railRight, { bottom: 80 + bottomOffset }]}>
      <Pressable style={styles.actionBtn} onPress={onOpenSeller} hitSlop={8}>
        <View style={{ position: "relative" }}>
          <SellerAvatar seller={seller} />
          <Pressable
            style={[styles.followBadge, following && styles.followBadgeActive]}
            onPress={onToggleFollow}
            hitSlop={8}
          >
            <FollowGlyph following={following} />
          </Pressable>
        </View>
      </Pressable>

      <Pressable style={styles.actionBtn} onPress={onToggleLike} hitSlop={8}>
        <HeartIcon filled={liked} />
        <Text style={styles.actionLabel}>{likes}</Text>
      </Pressable>

      <Pressable style={styles.actionBtn} onPress={onShare} hitSlop={8}>
        <ShareIcon />
      </Pressable>

      <Pressable style={styles.actionBtn} onPress={onToggleSave} hitSlop={8}>
        <SaveIcon filled={saved} />
      </Pressable>

      <Pressable style={styles.actionBtn} onPress={onToggleCompare} hitSlop={8}>
        <CompareIcon active={comparing} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // .reel-side-actions
  rail: {
    position: "absolute",
    alignItems: "center",
    gap: 16,
    zIndex: 45,
  },
  railLeft: { left: 10 },
  railRight: { right: 10 },
  actionBtn: { alignItems: "center", gap: 3 },
  actionLabel: {
    color: "white",
    fontSize: 11,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  avatar: {
    backgroundColor: "#22A652", // gradient(#22A652,#1E9449) approximated as flat — swap to expo-linear-gradient if needed
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  followBadge: {
    position: "absolute",
    bottom: -6,
    left: "50%",
    marginLeft: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#22A652",
    borderWidth: 2,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  followBadgeActive: { backgroundColor: "#3b82f6" },
});
