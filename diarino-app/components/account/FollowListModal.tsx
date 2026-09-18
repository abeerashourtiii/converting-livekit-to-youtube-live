import { useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet, FlatList, Animated } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";
import { useFollows, useFollowersList, useFollowingList, FollowListItem } from "../../lib/hooks/useFollows";
import { cldThumbnail } from "../../lib/cloudinary";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";
import { useDragToClose } from "../../lib/hooks/useDragToClose";

type Props = { visible: boolean; onClose: () => void; initialTab?: "followers" | "following" };

export function FollowListModal({ visible, onClose, initialTab = "followers" }: Props) {
  const { t } = useLanguage();
  const { user } = useCurrentUser();
  const [tab, setTab] = useState<"followers" | "following">(initialTab);
  const { data: followers, isLoading: loadingFollowers } = useFollowersList();
  const { data: following, isLoading: loadingFollowing } = useFollowingList();
  const { followedIds, toggleFollow, notifyIds, toggleNotify } = useFollows();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const { translateY, backdropOpacity, panHandlers, onScroll } = useDragToClose(onClose);
  if (!visible) return null;

  const list = tab === "followers" ? followers : following;
  const loading = tab === "followers" ? loadingFollowers : loadingFollowing;

  function openProfile(id: string) {
    onClose();
    router.push(`/seller/${id}`);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...panHandlers}>
        <View style={styles.handle} />
        <View style={styles.tabsRow}>
          <Pressable style={[styles.tabBtn, tab === "followers" && styles.tabBtnActive]} onPress={() => setTab("followers")}>
            <Text style={[styles.tabBtnText, tab === "followers" && styles.tabBtnTextActive]}>{t("المتابعون")}</Text>
          </Pressable>
          <Pressable style={[styles.tabBtn, tab === "following" && styles.tabBtnActive]} onPress={() => setTab("following")}>
            <Text style={[styles.tabBtnText, tab === "following" && styles.tabBtnTextActive]}>{t("الذين تتابعهم")}</Text>
          </Pressable>
        </View>

        <FlatList
          data={list ?? []}
          keyExtractor={(item) => item.id}
          style={{ maxHeight: 420 }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.emptyText}>
                {tab === "followers" ? t("لا يوجد متابعون حتى الآن") : t("لسه مابتتابعش حد")}
              </Text>
            ) : null
          }
          renderItem={({ item }: { item: FollowListItem }) => {
            const isFollowingThem = followedIds.has(item.id);
            const isNotifying = notifyIds.has(item.id);
            return (
              <View style={styles.row}>
                <Pressable style={styles.rowMain} onPress={() => openProfile(item.id)}>
                  <View style={styles.avatarWrap}>
                    {item.avatarUrl ? (
                      <Image source={{ uri: cldThumbnail(item.avatarUrl) }} style={styles.avatarImg} contentFit="cover" transition={150} />
                    ) : (
                      <Text style={styles.avatarInitial}>{item.name.charAt(0)}</Text>
                    )}
                  </View>
                  <Text style={styles.name} numberOfLines={1}>{t(item.name)}</Text>
                </Pressable>

                {tab === "following" && item.id !== user?.id && (
                  <Pressable style={styles.bellBtn} onPress={() => toggleNotify(item.id)}>
                    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={isNotifying ? "#22A652" : themeColors.textSubtle} strokeWidth={2}>
                      <Path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
                    </Svg>
                  </Pressable>
                )}

                {item.id !== user?.id && (
                  <Pressable
                    style={[styles.followBtn, isFollowingThem && styles.followBtnActive]}
                    onPress={() => toggleFollow(item.id)}
                  >
                    <Text style={[styles.followBtnText, isFollowingThem && styles.followBtnTextActive]}>
                      {isFollowingThem ? t("متابَع") : t("متابعة")}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          }}
        />
      </Animated.View>
    </Modal>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
    sheet: {
      position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "75%",
      backgroundColor: themeColors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8, paddingBottom: 24,
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: themeColors.border, alignSelf: "center", marginBottom: 10 },
    tabsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
    tabBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, backgroundColor: themeColors.surface },
    tabBtnActive: { backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ecfdf5" },
    tabBtnText: { fontSize: 12.5, fontWeight: "800", color: themeColors.textSubtle },
    tabBtnTextActive: { color: "#22A652" },
    emptyText: { textAlign: "center", color: themeColors.textSubtle, fontSize: 12.5, paddingVertical: 30 },
    row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 16 },
    rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
    avatarWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ecfdf5", alignItems: "center", justifyContent: "center", overflow: "hidden" },
    avatarImg: { width: 40, height: 40, borderRadius: 20 },
    avatarInitial: { fontSize: 15, fontWeight: "900", color: "#22A652" },
    name: { fontSize: 13, fontWeight: "800", color: themeColors.text, flexShrink: 1 },
    bellBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: themeColors.surface },
    followBtn: { backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
    followBtnActive: { backgroundColor: themeColors.surface },
    followBtnText: { color: "white", fontSize: 11.5, fontWeight: "900" },
    followBtnTextActive: { color: themeColors.textMuted },
  });
}
