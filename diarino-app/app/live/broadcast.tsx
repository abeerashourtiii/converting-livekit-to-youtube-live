import { useMemo, useState, useEffect, useRef } from "react";
import { router } from "expo-router";
import { View, Text, TextInput, Pressable, StyleSheet, Modal, FlatList, Alert, Platform } from "react-native";
import * as Clipboard from "expo-clipboard";
import Svg, { Path } from "react-native-svg";
import { PermissionGate } from "../../components/live/PermissionGate";
import { LiveCommentsOverlay } from "../../components/live/LiveCommentsOverlay";
import { FloatingHeartLayer } from "../../components/live/FloatingHeart";
import { YouTubeCameraBroadcaster, type YouTubeCameraBroadcasterRef } from "../../lib/youtube-platform";
import { useLiveChat, useLiveViewerPresence, type LiveViewer } from "../../lib/hooks/useYouTubeLive";
import {
  createYouTubeBroadcast,
  endYouTubeBroadcast,
  connectYouTubeAccount,
  isYouTubeConnected,
  fetchBroadcastInfoForRoom,
  subscribeToQueuedBroadcast,
  cancelQueuedBroadcast,
  YouTubeNotConnectedError,
  type YouTubeBroadcastInfo,
  type QueuedBroadcastStatus,
} from "../../lib/youtube";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";
import { useFinalizeSavedLive } from "../../lib/hooks/useMyContent";
import { logAndGetSafeMessage } from "../../lib/errors";

// ↔ عمليات الحفظ فى الخلفية بعد إنهاء البث (إنهاء liveBroadcast على
// يوتيوب + تحديث سجل "البث المحفوظ") لها حد زمني أقصى، بنفس فلسفة
// النسخة القديمة (LiveKit): قطع الاتصال والخروج من الشاشة يحصل فورًا،
// والحفظ فى الخلفية بيكمل بسقف زمني بدون ما يعلّق المستخدم.
const HOUSEKEEPING_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

const MAX_TITLE_WORDS = 5;

export default function BroadcastScreen() {
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  if (user?.is_anonymous) {
    return (
      <View style={styles.setupContainer}>
        <Text style={styles.setupTitle}>{t("بث مباشر")}</Text>
        <Text style={styles.anonBlockedText}>
          {t("يجب تسجيل الدخول بحساب Google لبدء بث مباشر")}
        </Text>
        <Pressable style={styles.leaveSetupBtn} onPress={() => router.back()}>
          <Text style={styles.leaveSetupBtnText}>{t("رجوع")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <PermissionGate>
      <BroadcastFlow />
    </PermissionGate>
  );
}

function BroadcastFlow() {
  const { user, displayName } = useCurrentUser();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState<"setup" | "connecting" | "starting" | "queued" | "live">("setup");
  const [startError, setStartError] = useState<Error | null>(null);
  const [initialFacingMode, setInitialFacingMode] = useState<"user" | "environment">("user");
  const [ytConnected, setYtConnected] = useState<boolean | null>(null);
  const [broadcastInfo, setBroadcastInfo] = useState<YouTubeBroadcastInfo | null>(null);
  const [queueId, setQueueId] = useState<string | null>(null);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [isCancellingQueue, setIsCancellingQueue] = useState(false);

  const roomName = useMemo(() => `live_${user?.id ?? "anon"}_${Date.now()}`, [user?.id]);
  const wordCount = title.trim().length ? title.trim().split(/\s+/).length : 0;
  const titleValid = wordCount > 0 && wordCount <= MAX_TITLE_WORDS;

  useEffect(() => {
    isYouTubeConnected().then(setYtConnected);
  }, []);

  // ↔ بمجرد ما طلب بث مُنتظر (queued) يتحول حالته لـ 'completed' على
  // السيرفر (youtube-process-queue خلّص إنشاء البث فعليًا)، نجيب بيانات
  // الغرفة الحقيقية وننتقل مباشرة لشاشة البث الحي — من غير ما المستخدم
  // يحتاج يعمل أي حاجة. لو فشل نهائيًا (بعد كل المحاولات)، نرجّعه للإعداد
  // مع رسالة الخطأ.
  useEffect(() => {
    if (!queueId) return;
    const unsubscribe = subscribeToQueuedBroadcast(queueId, async (status: QueuedBroadcastStatus, lastError) => {
      if (status === "completed") {
        try {
          const info = await fetchBroadcastInfoForRoom(roomName);
          setBroadcastInfo(info);
          setQueueId(null);
          setPhase("live");
        } catch (err) {
          setStartError(err instanceof Error ? err : new Error(String(err)));
          setQueueId(null);
          setPhase("setup");
        }
      } else if (status === "failed") {
        setQueueId(null);
        setPhase("setup");
        Alert.alert(t("تعذر بدء البث"), lastError || t("فشلت كل محاولات إعادة المحاولة. جرّب مرة أخرى لاحقًا."));
      }
    });
    return () => {
      unsubscribe();
    };
  }, [queueId, roomName]);

  async function connectYouTube() {
    setPhase("connecting");
    try {
      await connectYouTubeAccount();
      setYtConnected(true);
    } catch (err) {
      Alert.alert(t("تعذر ربط الحساب"), err instanceof Error ? err.message : t("حاول مرة أخرى."));
    } finally {
      setPhase("setup");
    }
  }

  async function startBroadcast() {
    setPhase("starting");
    setStartError(null);
    try {
      const result = await createYouTubeBroadcast(roomName, title.trim());
      if (result.queued) {
        setQueueId(result.queueId);
        setQueueMessage(result.message);
        setPhase("queued");
        return;
      }
      setBroadcastInfo(result);
      setPhase("live");
    } catch (err: unknown) {
      if (err instanceof YouTubeNotConnectedError) {
        setYtConnected(false);
        setPhase("setup");
        Alert.alert(t("الحساب غير مربوط"), t("اربط حساب يوتيوب أولًا لبدء البث."));
        return;
      }
      const safeMessage = err instanceof Error ? err.message : String(err);
      setStartError(new Error(safeMessage));
      setPhase("setup");
      Alert.alert(t("خطأ في بدء البث"), safeMessage || t("تعذر إنشاء بث يوتيوب."));
    }
  }

  async function cancelQueue() {
    if (!queueId) return;
    setIsCancellingQueue(true);
    try {
      await cancelQueuedBroadcast(queueId);
      setQueueId(null);
      setPhase("setup");
    } catch (err) {
      Alert.alert(t("تعذر الإلغاء"), err instanceof Error ? err.message : t("حاول مرة أخرى."));
    } finally {
      setIsCancellingQueue(false);
    }
  }

  if (phase === "queued") {
    return (
      <View style={styles.setupContainer}>
        <Text style={styles.setupTitle}>{t("طلبك فى قائمة الانتظار")}</Text>
        <Text style={styles.anonBlockedText}>
          {queueMessage || t("انتهت حصة يوتيوب اليومية. سيبدأ بثك تلقائيًا فور توفر الحصة.")}
        </Text>
        <Pressable
          style={[styles.leaveSetupBtn, isCancellingQueue && { opacity: 0.6 }]}
          disabled={isCancellingQueue}
          onPress={cancelQueue}
        >
          <Text style={styles.leaveSetupBtnText}>{isCancellingQueue ? t("جارٍ الإلغاء...") : t("إلغاء الطلب")}</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "setup" || phase === "connecting" || phase === "starting") {
    return (
      <View style={styles.setupContainer}>
        <Pressable
          style={styles.closeSetupBtn}
          onPress={() => router.back()}
          disabled={phase !== "setup"}
          hitSlop={10}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={themeColors.text} strokeWidth={2.5}>
            <Path d="M6 6l12 12M18 6L6 18" />
          </Svg>
        </Pressable>

        <Text style={styles.setupTitle}>{t("بث مباشر عبر يوتيوب")}</Text>

        {ytConnected === false && (
          <View style={styles.ytConnectBox}>
            <Text style={styles.ytConnectText}>
              {t("اربط حساب يوتيوب أولًا (بصلاحية إدارة البث المباشر) قبل ما تقدر تبدأ.")}
            </Text>
            <Pressable
              style={styles.ytConnectBtn}
              disabled={phase === "connecting"}
              onPress={connectYouTube}
            >
              <Text style={styles.ytConnectBtnText}>
                {phase === "connecting" ? t("جارٍ الربط...") : t("ربط حساب يوتيوب")}
              </Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.setupLabel}>{t("عنوان اللايف")} (٥ {t("كلمات")} كحد أقصى)</Text>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder={t("فيلا مميزة بالتجمع الخامس")}
          placeholderTextColor={themeColors.textSubtle}
          maxLength={80}
          editable={phase === "setup"}
        />
        <Text style={[styles.wordCount, !titleValid && wordCount > 0 && styles.wordCountError]}>
          {wordCount}/{MAX_TITLE_WORDS} {t("كلمات")}
        </Text>

        {Platform.OS !== "web" && (
          <>
            <Text style={styles.setupLabel}>{t("اختر الكاميرا")}</Text>
            <View style={styles.cameraChoiceRow}>
              <Pressable
                style={[styles.cameraChoiceBtn, initialFacingMode === "user" && styles.cameraChoiceBtnActive]}
                disabled={phase === "starting"}
                onPress={() => setInitialFacingMode("user")}
              >
                <Text style={[styles.cameraChoiceText, initialFacingMode === "user" && styles.cameraChoiceTextActive]}>
                  {t("الأمامية")}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.cameraChoiceBtn, initialFacingMode === "environment" && styles.cameraChoiceBtnActive]}
                disabled={phase === "starting"}
                onPress={() => setInitialFacingMode("environment")}
              >
                <Text style={[styles.cameraChoiceText, initialFacingMode === "environment" && styles.cameraChoiceTextActive]}>
                  {t("الخلفية")}
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {Platform.OS === "web" && (
          <Text style={styles.webNotice}>
            {t("البث بالكاميرا مباشرة من المتصفح غير متاح. بعد الضغط على \"ابدأ البث\" هيتولّد لك مفتاح بث تستخدمه فى برنامج مثل OBS.")}
          </Text>
        )}

        {startError && <Text style={styles.wordCountError}>{startError.message}</Text>}
        <Pressable
          style={[styles.goLiveBtn, (!titleValid || phase === "starting" || ytConnected !== true) && styles.goLiveBtnDisabled]}
          disabled={!titleValid || phase === "starting" || ytConnected !== true}
          onPress={startBroadcast}
        >
          <Text style={styles.goLiveBtnText}>{phase === "starting" ? t("جارٍ البدء...") : t("ابدأ البث")}</Text>
        </Pressable>
      </View>
    );
  }

  if (!broadcastInfo) return null;

  return (
    <BroadcasterLiveView
      title={title}
      displayName={displayName}
      userId={user?.id ?? "me"}
      roomName={roomName}
      initialFacingMode={initialFacingMode}
      broadcastInfo={broadcastInfo}
      onEnd={() => router.back()}
    />
  );
}

function BroadcasterLiveView({
  title, displayName, userId, roomName, initialFacingMode, broadcastInfo, onEnd,
}: {
  title: string;
  displayName: string;
  userId: string;
  roomName: string;
  initialFacingMode: "user" | "environment";
  broadcastInfo: YouTubeBroadcastInfo;
  onEnd: () => void;
}) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const broadcasterRef = useRef<YouTubeCameraBroadcasterRef>(null);

  const { comments, burstId, sendComment } = useLiveChat(roomName, userId, displayName);
  const { viewers, blockViewer } = useLiveViewerPresence(roomName, userId, displayName, true);

  const startedAtRef = useRef(Date.now());
  const [isMuted, setIsMuted] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [viewersModalVisible, setViewersModalVisible] = useState(false);
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const finalizeSavedLive = useFinalizeSavedLive();

  // ↔ بدء التغذية (RTMP) بمجرد ظهور شاشة البث — على الويب، النسخة الموجودة
  // فى lib/youtube-platform.web.tsx بترفض start() فورًا برسالة توضيحية
  // بدل ما تحاول توهم بتغذية غير موجودة أصلًا.
  useEffect(() => {
    if (Platform.OS === "web") return;
    broadcasterRef.current?.start(broadcastInfo.rtmpUrl);
    return () => {
      broadcasterRef.current?.stop();
    };
  }, [broadcastInfo.rtmpUrl]);

  function toggleMic() {
    const next = !isMuted;
    setIsMuted(next);
    broadcasterRef.current?.setMicMuted(next);
  }

  function flipCamera() {
    broadcasterRef.current?.switchCamera();
  }

  async function copyStreamKey() {
    try {
      await Clipboard.setStringAsync(broadcastInfo.streamName);
      Alert.alert(t("تم النسخ"), t("تم نسخ مفتاح البث."));
    } catch {
      // ignore
    }
  }

  // ↔ نفس فلسفة النسخة القديمة: قطع أي مصدر شغّال (هنا: إيقاف RTMP)
  // ومغادرة الشاشة فورًا، وعمليات الحفظ فى الخلفية (إنهاء البث على
  // يوتيوب + تحديث سجل "البث المحفوظ") بسقف زمني ومن غير ما توقف خروج
  // المستخدم من الشاشة.
  async function endLive() {
    if (isEnding) return;
    setIsEnding(true);

    const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000);

    try {
      broadcasterRef.current?.stop();
    } catch (err) {
      console.warn("Error stopping RTMP broadcaster:", err);
    }
    onEnd();

    withTimeout(endYouTubeBroadcast(roomName, durationSec), HOUSEKEEPING_TIMEOUT_MS, "endYouTubeBroadcast").catch((err) =>
      console.warn("Failed to end YouTube broadcast cleanly:", err)
    );

    withTimeout(
      finalizeSavedLive.mutateAsync({ roomName, viewerPeak: viewers.length }),
      HOUSEKEEPING_TIMEOUT_MS,
      "finalizeSavedLive"
    ).catch((err) => console.warn("Error finalizing saved live:", err));
  }

  function confirmBlock(viewer: LiveViewer) {
    Alert.alert(
      t("حظر من الدردشة"),
      // ↔ صياغة متعمدة: يوتيوب لا يوفر أي طريقة لفصل مشاهد معيّن عن
      // مشاهدة الفيديو نفسه، فالإجراء هنا مقصور على منعه من الكتابة فى
      // الدردشة فقط، وليس "طردًا" فعليًا من البث كما كان مع LiveKit.
      `${t("هل تريد منع")} ${viewer.name} ${t("من الكتابة فى الدردشة؟ (سيظل يمكنه مشاهدة البث)")}`,
      [
        { text: t("إلغاء"), style: "cancel" },
        {
          text: t("حظر"),
          style: "destructive",
          onPress: async () => {
            setBlockingId(viewer.id);
            try {
              await blockViewer(viewer.id);
            } catch (err) {
              Alert.alert(t("تعذّر الحظر"), logAndGetSafeMessage("blockViewer failed", err, t("برجاء المحاولة مرة أخرى.")));
            } finally {
              setBlockingId(null);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.liveContainer}>
      <YouTubeCameraBroadcaster
        ref={broadcasterRef}
        style={styles.video}
        initialFacingMode={initialFacingMode}
        onConnectionFailed={(err) => Alert.alert(t("خطأ فى البث"), err.message)}
      />

      <View style={styles.liveTopBar}>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.livePillText}>{t("مباشر على يوتيوب")}</Text>
        </View>
        <Pressable style={styles.viewerPill} onPress={() => setViewersModalVisible(true)}>
          <Text style={styles.viewerPillText}>👁 {viewers.length}</Text>
        </Pressable>
        <Pressable style={[styles.endBtn, isEnding && { opacity: 0.6 }]} onPress={endLive} disabled={isEnding}>
          <Text style={styles.endBtnText}>{isEnding ? t("جارٍ الإنهاء...") : t("إنهاء البث")}</Text>
        </Pressable>
      </View>

      <View style={styles.titlePill}>
        <Text style={styles.titlePillText}>📢 {title}</Text>
      </View>

      {Platform.OS === "web" && (
        <View style={styles.obsPanel}>
          <Text style={styles.obsPanelText}>{t("افتح OBS وأضف الرابط والمفتاح دول كوجهة بث (RTMP):")}</Text>
          <Text style={styles.obsPanelMono} selectable numberOfLines={1}>{broadcastInfo.ingestionAddress}</Text>
          <Text style={styles.obsPanelMono} selectable numberOfLines={1}>{broadcastInfo.streamName}</Text>
          <Pressable style={styles.obsCopyBtn} onPress={copyStreamKey}>
            <Text style={styles.obsCopyBtnText}>{t("نسخ المفتاح")}</Text>
          </Pressable>
        </View>
      )}

      {Platform.OS !== "web" && (
        <View style={styles.controlsRow}>
          <Pressable style={styles.controlBtn} onPress={toggleMic}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              {isMuted ? (
                <Path d="M1 1l22 22M12 1a3 3 0 013 3v6M19 10v2a7 7 0 01-11 5.6M5 10v2a7 7 0 001.5 4.4M12 19v4M8 23h8" />
              ) : (
                <Path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
              )}
            </Svg>
          </Pressable>
          <Pressable style={styles.controlBtn} onPress={flipCamera}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <Path d="M23 4v6h-6M1 20v-6h6" />
              <Path d="M3.5 9a9 9 0 0114.5-3.5L23 10M1 14l5 5a9 9 0 0014.5-3.5" />
            </Svg>
          </Pressable>
        </View>
      )}

      <LiveCommentsOverlay comments={comments} onSend={sendComment} />
      <FloatingHeartLayer burstId={burstId} />

      <Modal
        visible={viewersModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setViewersModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setViewersModalVisible(false)}>
          <Pressable style={styles.viewersSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.viewersSheetHeader}>
              <Text style={styles.viewersSheetTitle}>
                {t("المشاهدون")} ({viewers.length})
              </Text>
              <Pressable onPress={() => setViewersModalVisible(false)} hitSlop={8}>
                <Text style={styles.viewersSheetClose}>{t("إغلاق")}</Text>
              </Pressable>
            </View>
            <FlatList
              data={viewers}
              keyExtractor={(p: LiveViewer) => p.id}
              style={{ maxHeight: 360 }}
              ListEmptyComponent={
                <Text style={styles.noViewersText}>{t("لا يوجد مشاهدون حاليًا")}</Text>
              }
              renderItem={({ item }: { item: LiveViewer }) => (
                <View style={styles.viewerRow}>
                  <View style={styles.viewerRowAvatar}>
                    <Text style={styles.viewerRowAvatarText}>{(item.name || "?").charAt(0)}</Text>
                  </View>
                  <Text style={styles.viewerRowName} numberOfLines={1}>{item.name || t("زائر")}</Text>
                  <Pressable
                    style={styles.kickBtn}
                    disabled={blockingId === item.id}
                    onPress={() => confirmBlock(item)}
                  >
                    <Text style={styles.kickBtnText}>
                      {blockingId === item.id ? t("جارٍ الحظر...") : t("حظر")}
                    </Text>
                  </Pressable>
                </View>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    setupContainer: { flex: 1, backgroundColor: themeColors.background, padding: 24, justifyContent: "center", gap: 10 },
    closeSetupBtn: {
      position: "absolute", top: Platform.OS === "ios" ? 54 : 24, left: 20, zIndex: 10,
      width: 32, height: 32, borderRadius: 16, backgroundColor: themeColors.surface,
      borderWidth: 1, borderColor: themeColors.border, alignItems: "center", justifyContent: "center",
    },
    setupTitle: { color: themeColors.text, fontSize: 20, fontWeight: "900", marginBottom: 12, textAlign: "center" },
    anonBlockedText: { color: themeColors.textMuted, fontSize: 14, fontWeight: "600", textAlign: "center", lineHeight: 21, marginBottom: 8 },
    leaveSetupBtn: { backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 12, alignItems: "center" },
    leaveSetupBtnText: { color: "white", fontWeight: "900", fontSize: 15 },
    setupLabel: { color: themeColors.textSubtle, fontSize: 13, fontWeight: "700" },
    titleInput: {
      backgroundColor: themeColors.surface, color: themeColors.text, borderRadius: 12, padding: 14, fontSize: 15,
      borderWidth: 1, borderColor: themeColors.border,
    },
    wordCount: { color: themeColors.textSubtle, fontSize: 12, textAlign: "right" },
    wordCountError: { color: "#ef4444" },
    cameraChoiceRow: { flexDirection: "row", gap: 10 },
    cameraChoiceBtn: {
      flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center",
      backgroundColor: themeColors.surface, borderWidth: 1, borderColor: themeColors.border,
    },
    cameraChoiceBtnActive: { backgroundColor: "#22A652", borderColor: "#22A652" },
    cameraChoiceText: { color: themeColors.text, fontSize: 13, fontWeight: "800" },
    cameraChoiceTextActive: { color: "white" },
    webNotice: { color: themeColors.textSubtle, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 4 },
    ytConnectBox: {
      backgroundColor: themeColors.surface, borderRadius: 14, padding: 14, gap: 10,
      borderWidth: 1, borderColor: themeColors.border, marginBottom: 6,
    },
    ytConnectText: { color: themeColors.textSubtle, fontSize: 13, lineHeight: 19, textAlign: "center" },
    ytConnectBtn: { backgroundColor: "#FF0000", borderRadius: 999, paddingVertical: 10, alignItems: "center" },
    ytConnectBtnText: { color: "white", fontWeight: "900", fontSize: 14 },
    goLiveBtn: { marginTop: 16, backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 14, alignItems: "center" },
    goLiveBtnDisabled: { backgroundColor: themeColors.isDark ? "#3f3f46" : "#374151" },
    goLiveBtnText: { color: "white", fontWeight: "900", fontSize: 15 },

    liveContainer: { flex: 1, backgroundColor: "#000" },
    video: { flex: 1 },
    liveTopBar: { position: "absolute", top: Platform.OS === "ios" ? 50 : 30, left: 14, right: 14, flexDirection: "row", alignItems: "center", gap: 8 },
    livePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#ef4444", borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "white" },
    livePillText: { color: "white", fontSize: 11, fontWeight: "900" },
    viewerPill: { backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
    viewerPillText: { color: "white", fontSize: 11, fontWeight: "800" },
    endBtn: { marginLeft: "auto", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
    endBtnText: { color: "white", fontSize: 12, fontWeight: "900" },
    titlePill: {
      position: "absolute", top: Platform.OS === "ios" ? 92 : 72, left: 14,
      backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12,
    },
    titlePillText: { color: "white", fontSize: 13, fontWeight: "900" },
    controlsRow: { position: "absolute", right: 14, bottom: 140, gap: 14, alignItems: "center" },
    controlBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },

    obsPanel: {
      position: "absolute", bottom: 100, left: 14, right: 14, backgroundColor: "rgba(0,0,0,0.7)",
      borderRadius: 14, padding: 14, gap: 6,
    },
    obsPanelText: { color: "white", fontSize: 12, fontWeight: "700" },
    obsPanelMono: { color: "#22A652", fontSize: 12, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
    obsCopyBtn: { alignSelf: "flex-start", marginTop: 4, backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
    obsCopyBtnText: { color: "white", fontWeight: "900", fontSize: 12 },

    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    viewersSheet: { backgroundColor: themeColors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 28 },
    viewersSheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    viewersSheetTitle: { color: themeColors.text, fontSize: 15, fontWeight: "900" },
    viewersSheetClose: { color: themeColors.textSubtle, fontSize: 13, fontWeight: "700" },
    noViewersText: { color: themeColors.textSubtle, fontSize: 13, textAlign: "center", paddingVertical: 24 },
    viewerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: themeColors.border },
    viewerRowAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#22A652", alignItems: "center", justifyContent: "center" },
    viewerRowAvatarText: { color: "white", fontWeight: "900", fontSize: 13 },
    viewerRowName: { flex: 1, color: themeColors.text, fontSize: 13, fontWeight: "700" },
    kickBtn: { backgroundColor: themeColors.isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.1)", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: "rgba(239,68,68,0.4)" },
    kickBtnText: { color: "#ef4444", fontSize: 12, fontWeight: "900" },
  });
}
