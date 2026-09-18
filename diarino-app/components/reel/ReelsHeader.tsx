import { View, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

// ↔ reelsHeaderHtml() in app-viewer.html.
// Deferred for now: the LIVE pill button (only shows when there are active
// broadcasts) and the camera-switch button (only shown while broadcasting) —
// both belong to the live-streaming pass, not the base reel feed.
type Props = {
  onOpenFilter: () => void;
  onOpenNotifications: () => void;
  notifBadgeCount?: number;
};

// ↔ The account-menu icon (three stacked lines) used to sit here and open
// AccountDropdown. Removed per product decision: settings now live solely
// behind the dedicated "الإعدادات" card on the menu page (routes to
// /settings), so this header only needs the filter and notifications icons.
export function ReelsHeader({ onOpenFilter, onOpenNotifications, notifBadgeCount = 0 }: Props) {
  return (
    <SafeAreaView style={styles.header} edges={["top"]}>
      <View />
      <View style={styles.rightGroup}>
        <IconBtn onPress={onOpenFilter}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" color="white" strokeWidth={2}>
            <Path d="M22 3H2l8 9.46V19l4 2v-8.54z" />
          </Svg>
        </IconBtn>
        <IconBtn onPress={onOpenNotifications}>
          <View>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
            </Svg>
            {notifBadgeCount > 0 && <View style={styles.notifBadge} />}
          </View>
        </IconBtn>
      </View>
    </SafeAreaView>
  );
}

function IconBtn({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable style={styles.iconBtn} onPress={onPress} hitSlop={6}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  rightGroup: { flexDirection: "row", gap: 8 },
  notifBadge: {
    position: "absolute", top: -1, right: -1, width: 9, height: 9, borderRadius: 4.5,
    backgroundColor: "#ef4444", borderWidth: 2, borderColor: "rgba(0,0,0,0.35)",
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
});
