import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View, Text, Pressable, StyleSheet, Share, useWindowDimensions } from "react-native";
import YoutubePlayer from "react-native-youtube-iframe";
import Svg, { Path } from "react-native-svg";
import { LiveCommentsOverlay } from "../../components/live/LiveCommentsOverlay";
import { FloatingHeartLayer } from "../../components/live/FloatingHeart";
import { ReportModal } from "../../components/shared/ReportModal";
import { useLiveByRoomName, useLiveChat, useLiveViewerPresence } from "../../lib/hooks/useYouTubeLive";
import { useFollows } from "../../lib/hooks/useFollows";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

export default function LiveViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, displayName } = useCurrentUser();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const { height } = useWindowDimensions();

  const [consentGiven, setConsentGiven] = useState(false);
  const { data: liveMeta, isLoading, error } = useLiveByRoomName(consentGiven ? id : "");

  if (!consentGiven) {
    return (
      <View style={styles.center}>
        <View style={styles.consentCard}>
          <Text style={styles.consentText}>
            {t("⚠️ هذا البث يتم تسجيله على يوتيوب. بانضمامك أنت توافق على التسجيل.")}
          </Text>
          <Pressable style={styles.consentAgreeBtn} onPress={() => setConsentGiven(true)}>
            <Text style={styles.consentAgreeBtnText}>{t("موافق")}</Text>
          </Pressable>
          <Pressable style={styles.consentBackBtn} onPress={() => router.back()}>
            <Text style={styles.consentBackBtnText}>{t("رجوع")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (error || (!isLoading && !liveMeta)) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t("هذا البث غير متاح حاليًا")}</Text>
        <Pressable style={styles.leaveBtn} onPress={() => router.back()}>
          <Text style={styles.leaveBtnText}>{t("رجوع")}</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading || !liveMeta) return <View style={styles.center} />;

  if (liveMeta.status === "ended") {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t("انتهى هذا البث")}</Text>
        <Pressable style={styles.leaveBtn} onPress={() => router.back()}>
          <Text style={styles.leaveBtnText}>{t("رجوع")}</Text>
        </Pressable>
      </View>
    );
  }

  if (!liveMeta.youtubeVideoId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t("في انتظار بدء البث...")}</Text>
        <Pressable style={styles.leaveBtn} onPress={() => router.back()}>
          <Text style={styles.leaveBtnText}>{t("رجوع")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ViewerLiveView
      roomName={id}
      liveId={liveMeta.id}
      videoId={liveMeta.youtubeVideoId}
      title={liveMeta.title ?? ""}
      sellerId={liveMeta.hostId}
      sellerName={liveMeta.hostName || t("البائع")}
      userId={user?.id}
      displayName={displayName}
      playerHeight={height}
    />
  );
}

function ViewerLiveView({
  roomName, liveId, videoId, title, sellerId, sellerName, userId, displayName, playerHeight,
}: {
  roomName: string;
  liveId: string;
  videoId: string;
  title: string;
  sellerId?: string;
  sellerName: string;
  userId?: string;
  displayName: string;
  playerHeight: number;
}) {
  const { t } = useLanguage();
  const styles = liveStyles;
  const { width } = useWindowDimensions();
  const [reportVisible, setReportVisible] = useState(false);

  const { comments, burstId, sendComment, sendLike } = useLiveChat(roomName, userId, displayName);
  const { viewers, amIBlocked } = useLiveViewerPresence(roomName, userId, displayName, false);
  const { followedIds, toggleFollow } = useFollows();
  const isFollowing = !!sellerId && followedIds.has(sellerId);

  async function onShare() {
    try {
      await Share.share({
        message: t("شاهد البث المباشر على ديارينو") + (title ? `: ${title}` : "") + ` — ${sellerName}`,
      });
    } catch (err) {
      console.warn("Failed to open share sheet:", err);
    }
  }

  return (
    <View style={styles.container}>
      <YoutubePlayer
        height={playerHeight}
        width={width}
        play
        videoId={videoId}
        webViewStyle={styles.video}
        initialPlayerParams={{ controls: false, rel: false }}
      />

      <View style={styles.topBar}>
        <View style={styles.broadcasterChip}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{sellerName.charAt(0)}</Text>
          </View>
          <Text style={styles.broadcasterName}>{t(sellerName)}</Text>
          {!!sellerId && (
            <Pressable
              style={[styles.followBtn, isFollowing && styles.followBtnActive]}
              onPress={() => toggleFollow(sellerId)}
            >
              <Text style={styles.followBtnText}>{isFollowing ? t("متابَع ✓") : t("متابعة")}</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.viewerPill}>
          <Text style={styles.viewerPillText}>👁 {viewers.length}</Text>
        </View>
        <View style={styles.recPill}>
          <Text style={styles.recPillText}>▶ YouTube</Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
            <Path d="M6 6l12 12M18 6L6 18" />
          </Svg>
        </Pressable>
      </View>

      {!!title && (
        <View style={styles.titlePill}>
          <Text style={styles.titlePillText}>📢 {t(title)}</Text>
        </View>
      )}

      <View style={styles.sideActions}>
        <Pressable style={styles.actionBtn} onPress={sendLike} hitSlop={8}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <Path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" />
          </Svg>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onShare} hitSlop={8}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <Path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v14" />
          </Svg>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={() => setReportVisible(true)} hitSlop={8}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <Path d="M4 22V4" /><Path d="M4 4h13l-2 4 2 4H4" />
          </Svg>
        </Pressable>
      </View>

      <LiveCommentsOverlay
        comments={comments}
        onSend={sendComment}
        disabled={amIBlocked}
        disabledMessage={t("تم حظرك من الدردشة بواسطة المذيع")}
      />
      <FloatingHeartLayer burstId={burstId} />
      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        targetType="live"
        targetId={liveId}
        targetTitle={title || "بث مباشر"}
      />
    </View>
  );
}

const liveStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  recPill: { backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  recPillText: { color: "#ef4444", fontSize: 10, fontWeight: "900" },
  video: { backgroundColor: "#000" },
  topBar: { position: "absolute", top: 50, left: 14, right: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  broadcasterChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 999, paddingVertical: 4, paddingHorizontal: 6 },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#22A652", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "white", fontWeight: "900", fontSize: 12 },
  broadcasterName: { color: "white", fontSize: 12, fontWeight: "800" },
  followBtn: { backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 },
  followBtnActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  followBtnText: { color: "white", fontSize: 10, fontWeight: "900" },
  viewerPill: { marginLeft: "auto", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  viewerPillText: { color: "white", fontSize: 11, fontWeight: "800" },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  titlePill: { position: "absolute", top: 92, left: 14, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  titlePillText: { color: "white", fontSize: 13, fontWeight: "900" },
  sideActions: { position: "absolute", right: 12, bottom: 150, gap: 18, alignItems: "center" },
  actionBtn: { alignItems: "center", justifyContent: "center" },
});

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, backgroundColor: themeColors.background, alignItems: "center", justifyContent: "center", gap: 16 },
    errorText: { color: themeColors.text, fontSize: 15, fontWeight: "800" },
    leaveBtn: { backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 24 },
    leaveBtnText: { color: "white", fontWeight: "900" },
    consentCard: { width: "88%", maxWidth: 340, backgroundColor: themeColors.card, borderRadius: 20, padding: 24, alignItems: "center", gap: 14, borderWidth: 1, borderColor: themeColors.border },
    consentText: { color: themeColors.text, fontSize: 15, fontWeight: "700", textAlign: "center", lineHeight: 22 },
    consentAgreeBtn: { backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 12, alignSelf: "stretch", alignItems: "center", marginTop: 4 },
    consentAgreeBtnText: { color: "white", fontWeight: "900", fontSize: 15 },
    consentBackBtn: { paddingVertical: 8, alignSelf: "stretch", alignItems: "center" },
    consentBackBtnText: { color: themeColors.textSubtle, fontWeight: "700", fontSize: 13 },
  });
}
