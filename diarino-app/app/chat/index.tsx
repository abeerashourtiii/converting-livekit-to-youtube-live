import { useCallback, memo } from "react";
import { router, Link } from "expo-router";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useChatList, ChatSummary } from "../../lib/hooks/useChatsDB";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

// ↔ perf audit fix #2 — extracted + memoized row so FlatList's
// virtualization doesn't re-render every row on unrelated screen state
// changes. No per-item callback props here (Link resolves its own href),
// so this is purely the memo + extracted-renderItem half of the pattern.
const ChatListRow = memo(function ChatListRow({ item }: { item: ChatSummary }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <Link href={`/chat/${item.id}`} asChild>
      <Pressable style={styles.row}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{item.partnerInitial}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{t(item.partnerName)}</Text>
          <Text style={styles.lastMsg} numberOfLines={1}>{item.lastMessage}</Text>
        </View>
        {item.unread > 0 && (
          <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>{item.unread}</Text></View>
        )}
      </Pressable>
    </Link>
  );
});

export default function ChatListScreen() {
  const { user } = useCurrentUser();
  const { data: chats = [] } = useChatList(user?.id);
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  const renderItem = useCallback(({ item }: { item: ChatSummary }) => <ChatListRow item={item} />, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={themeColors.text} strokeWidth={2}>
            <Path d="M5 12h14M12 5l7 7-7 7" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>{t("المحادثات")}</Text>
        <View style={{ width: 34 }} />
      </View>

      <FlatList
        data={chats}
        keyExtractor={(c) => c.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t("لا توجد محادثات")}</Text>
          </View>
        }
        renderItem={renderItem}
      />
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    header: {
      paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      borderBottomWidth: 1, borderBottomColor: themeColors.border, backgroundColor: themeColors.background,
    },
    backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: themeColors.surface, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 14, fontWeight: "900", color: themeColors.text },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#22A652", alignItems: "center", justifyContent: "center" },
    avatarText: { color: "white", fontWeight: "900", fontSize: 18 },
    name: { fontSize: 13, fontWeight: "900", color: themeColors.text, marginBottom: 3 },
    lastMsg: { fontSize: 12, color: themeColors.textSubtle },
    unreadBadge: { backgroundColor: "#22A652", borderRadius: 999, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
    unreadBadgeText: { color: "white", fontSize: 10.5, fontWeight: "900" },
    empty: { alignItems: "center", paddingTop: 60 },
    emptyText: { color: themeColors.textSubtle, fontSize: 13 },
  });
}
