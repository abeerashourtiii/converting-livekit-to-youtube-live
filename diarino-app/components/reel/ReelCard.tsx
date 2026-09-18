import { useEffect, useRef, useState, memo } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Easing, ScrollView, BackHandler, PanResponder, PanResponderGestureState } from "react-native";
import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import { Property, getReelMode } from "../../lib/types";
import { ReelBackground } from "./ReelBackground";
import { ReelInfoOverlay } from "./ReelInfoOverlay";
import { ReelActionRail } from "./ReelActionRail";
import { ReelSeekBar } from "./ReelSeekBar";
import { ReelVideoPlayer, ReelVideoPlayerHandle } from "./ReelVideoPlayer";
import { startReelMusic, stopReelMusic, setReelMusicMuted } from "../../lib/musicPlayer";
import { cldOptimized, cldVideoThumbnail } from "../../lib/cloudinary";
import { PropertyDetailsContent } from "../property/PropertyDetailsContent";
import { PropertyCtaBar } from "../property/PropertyCtaBar";
import { ReelCaptionsOverlay } from "./ReelCaptionsOverlay";
import { useReelHeight, useReelControlsBottomOffset } from "../../lib/uiConstants";
import { useReelPreferences } from "../../lib/hooks/useReelPreferences";
import { useThemeColors } from "../../lib/hooks/useThemeColors";
import { physicalSide } from "../../lib/rtl";

const BASE_SLIDE_MS = 4000; // ↔ currentReelSpeed default in app-viewer.html
// ↔ زرار إغلاق لوحة التفاصيل مثبَّت فعليًا فى أعلى يسار الشاشة (بطلب
// صريح)، بغض النظر عن لغة الواجهة — نفس أسلوب physicalSide()/
// ReelActionRail: حساب أنهي خاصية حرفية (left/right) لازم نكتبها عشان
// النتيجة النهائية، بعد قلب Yoga التلقائي المحتمل على الموبايل، تفضل
// شمال دايمًا وثابت على كل المنصات.
const CLOSE_BTN_SIDE_STYLE = physicalSide(true) === "left" ? { left: 14 } : { right: 14 };
const LONG_PRESS_MS = 500; // ↔ setTimeout(..., 500) in startLongPress()

// ↔ #1/#3: ارتفاع الريل بعد ما يتصغّر لفوق وقت فتح لوحة التفاصيل — نفس
// فكرة الـ mini-player بتاع الـ Shorts فى يوتيوب لما تفتح الكومنتات.
const MINI_MEDIA_HEIGHT = 220;
const SHEET_ANIM_MS = 280;

type Props = {
  property: Property;
  index: number;
  isActive: boolean; // this reel is the one currently in view (drives autoplay)
  // ↔ perf audit fix #1: index === activeIndex ± 1. Real <Video>/audio
  // playback only ever needs to exist for isActive; isNearActive exists
  // solely to decide whether a *video-mode* card mounts a real <Video>
  // player at all (vs. a static poster) — so the adjacent card is ready
  // to play instantly the moment a swipe lands on it, without every
  // other mounted card in the FlatList's window also paying for a live
  // decoder it will never use.
  isNearActive: boolean;
  isFollowing: boolean;
  isFavorite: boolean;
  isLiked: boolean;
  isComparing: boolean;
  // ↔ #2/#3: تفاصيل العقار بقت لوحة (bottom sheet) تفتح جوه شاشة الريلز
  // نفسها بدل ما تعمل navigation لصفحة تانية — عشان الريل يفضل شغال
  // ومسموع أثناء عرضها (نفس اليوتيوب شورتس). detailsOpen بييجي من الشاشة
  // الأب (فيه بس للكارت النشط فعليًا)، وonCloseDetails بيقفلها.
  detailsOpen: boolean;
  onCloseDetails: () => void;
  // ↔ perf audit fix #2: id/property-parameterized instead of pre-bound
  // no-arg closures. This is what lets the parent (app/(tabs)/index.tsx)
  // hand every card the exact same useCallback-memoized function
  // reference, which is required for React.memo below to actually skip
  // re-rendering cards whose own data hasn't changed.
  onOpenDetails: (propertyId: string) => void;
  onOpenSeller: (sellerId: string) => void;
  onToggleFollow: (sellerId: string) => void;
  onToggleFavorite: (propertyId: string) => void;
  onToggleLike: (propertyId: string) => void;
  onShare: (property: Property) => void;
  onToggleCompare: (propertyId: string) => void;
  onReport?: (property: Property) => void;
  // ↔ #4 (قايمة خيارات الريل — تمرير تلقائي): بينادَى لما الريل النشط
  // يخلص (فيديو وصل للنهاية، أو السلايدشو خلّص دورة كاملة) وautoAdvance
  // مفعّل — الشاشة الأب (app/(tabs)/index.tsx) هي اللي بتقرر تتنقل لأي
  // ريل (السحب للريل اللي بعده)، نفس فكرة onOpenDetails/onOpenSeller.
  onFinished?: () => void;
};

export const ReelCard = memo(function ReelCard({
  property, index, isActive, isNearActive, isFollowing, isFavorite, isLiked, isComparing,
  detailsOpen, onCloseDetails,
  onOpenDetails, onOpenSeller, onToggleFollow, onToggleFavorite, onToggleLike, onShare, onToggleCompare, onReport,
  onFinished,
}: Props) {
  const reelHeight = useReelHeight();
  // ↔ #1/#2: الكارت بقى fullscreen كامل (useReelHeight بترجع ارتفاع الشاشة
  // بالكامل دلوقتي)، فلوحة التفاصيل (bottom sheet) لازم تاخد باله من مساحة
  // شريط المهام العائم فى آخرها بدل ما محتواها (PropertyCtaBar تحديدًا)
  // يوصل لآخر حافة فى الشاشة ويتغطّى بيه.
  const controlsBottomOffset = useReelControlsBottomOffset();
  const mode = getReelMode(property);
  const videoRef = useRef<ReelVideoPlayerHandle>(null);
  // ↔ #4 (قايمة خيارات الريل): تمرير تلقائي/كتم صوت الخلفية مُتحكَّم فيهم
  // من هنا — نفس المخزن اللي ReelOptionsSheet.tsx بيقرا ويكتب فيه.
  const { autoAdvance, musicMuted } = useReelPreferences();
  // ↔ قاعدة تثيم الوسائط: لوحة تفاصيل العقار (sheet تحت) بخلفية عتمة
  // كاملة خاصة بيها، مش مرسومة على الفيديو — فتتبع الثيم. باقي ستايلات
  // الملف ده (الأيقونات/فلاش التشغيل/شريط الـ seek..) فضلت ثابتة عمدًا.
  const themeColors = useThemeColors();

  // ↔ toggleReelPause() — tap top/bottom half of the reel to pause/resume.
  const [paused, setPaused] = useState(false);
  // ↔ إصلاح باغ #2: حالة الأيقونة اللي بتفلاش عند كل تبديل (تشغيل/إيقاف)
  // — مستقلة عن `paused` نفسها، عشان تفضل تظهر لحظة الضغط حتى لو
  // `paused` اتغيّرت فورًا بعدها.
  const [tapFeedback, setTapFeedback] = useState<"play" | "pause" | null>(null);
  const tapFeedbackOpacity = useRef(new Animated.Value(0)).current;

  // ↔ isLongPressing / currentReelSpeed — long-press anywhere (not on a
  // button or the seek bar) doubles playback speed while held.
  const [speed, setSpeed] = useState<1 | 2>(1);

  // ---- video state ----
  const [videoPosMs, setVideoPosMs] = useState(0);
  const [videoDurMs, setVideoDurMs] = useState(0);
  const video = mode === "video" ? property.media.find((m) => m.type === "video") : undefined;

  // ↔ ترقية expo-av → expo-video: ReelVideoPlayer (تحت) بقى هو المسؤول
  // عن تشغيل/إيقاف/سرعة/كتم الفيديو داخليًا (بيقرا الـ props دي مباشرة)
  // — الـ effect القديم اللي كان بينده setStatusAsync يدويًا اتشال، لأن
  // expo-video بيدير الحالة دي من جوّه العنصر نفسه رد فعل على الـ props.
  // finishedRef/إعادة الموضع لصفر بعد didJustFinish بقت جوه
  // ReelVideoPlayer.tsx نفسه (نفس المنطق، مكانه اتغيّر بس).

  function onVideoPosition(currentSec: number, durationSec: number) {
    setVideoPosMs(currentSec * 1000);
    setVideoDurMs(durationSec * 1000);
  }

  function onVideoFinished() {
    onFinished?.();
  }

  function seekVideo(pct: number) {
    videoRef.current?.seekToPct(pct);
  }

  // ---- slideshow state ↔ startSlideshow()/updateSlideshowSeek() ----
  const images = mode === "slideshow" ? property.media.filter((m) => m.type === "image") : [];
  const [slideIdx, setSlideIdx] = useState(0);
  const [slideElapsedMs, setSlideElapsedMs] = useState(0);
  const slideTotalMs = images.length * BASE_SLIDE_MS;

  useEffect(() => {
    if (mode !== "slideshow" || images.length < 2 || !isActive || paused) return;
    const tickMs = 100;
    const interval = BASE_SLIDE_MS / speed;
    const id = setInterval(() => {
      setSlideElapsedMs((prev) => {
        const next = (prev + tickMs * speed) % (interval * images.length);
        // ↔ #4 (تمرير تلقائي): الـ % فوق بيخلي next يلف لصفر تانى كل ما
        // يوصل لآخر الدورة — لو next أصغر من prev كده يبقى فعلاً لف
        // (خلّص دورة كاملة)، فده اللحظة المناسبة لتفعيل onFinished لو
        // autoAdvance شغال.
        if (next < prev && autoAdvance) onFinished?.();
        setSlideIdx(Math.floor(next / interval) % images.length);
        return next;
      });
    }, tickMs);
    return () => clearInterval(id);
  }, [mode, images.length, isActive, paused, speed, autoAdvance, onFinished]);

  function seekSlideshow(pct: number) {
    const total = BASE_SLIDE_MS * images.length;
    const elapsed = pct * total;
    setSlideElapsedMs(elapsed);
    setSlideIdx(Math.min(images.length - 1, Math.floor(elapsed / BASE_SLIDE_MS)));
  }

  // ↔ maybePlayReelMusicFor() — only plays when there's no video (mode
  // 'none' or 'slideshow') and the property has a `music` track set, and
  // stops the moment this reel isn't the active/playing one, same as the
  // pause-tied start/stop in the original's toggleReelPause().
  useEffect(() => {
    const shouldPlay = mode !== "video" && !!property.music && isActive && !paused;
    if (shouldPlay) {
      startReelMusic(property.id, property.music);
      // ↔ #4 (كتم صوت الخلفية): بيحدّث مستوى صوت الموسيقى الشغالة فورًا
      // مع أي تغيير فى musicMuted، من غير ما يوقف ويشغّل الموسيقى تانى.
      setReelMusicMuted(musicMuted);
    } else {
      stopReelMusic();
    }
    return () => {
      stopReelMusic();
    };
  }, [mode, property.music, property.id, isActive, paused, musicMuted]);

  function togglePause() {
    setPaused((prev) => {
      const next = !prev;
      // ↔ إصلاح باغ #2: أيقونة تشغيل/إيقاف واضحة بتظهر لمدة قصيرة عند كل
      // تبديل (سواء وقف أو شغّل) وبعدين تختفي تدريجيًا — بدل ما كانت
      // أيقونة الإيقاف بس هي اللي بتفضل ظاهرة طول ما الفيديو واقف.
      setTapFeedback(next ? "pause" : "play");
      tapFeedbackOpacity.stopAnimation();
      tapFeedbackOpacity.setValue(1);
      Animated.timing(tapFeedbackOpacity, {
        toValue: 0, duration: 300, delay: 450, easing: Easing.out(Easing.ease), useNativeDriver: true,
      }).start();
      return next;
    });
  }

  // ---- #1/#2/#3: لوحة تفاصيل العقار المصغّرة ----
  // ↔ detailsMounted يفضل true أثناء أنيميشن الإغلاق كمان (مش بس وهي
  // مفتوحة) عشان اللوحة تتحرك للأسفل وتختفي بالتدريج بدل ما تختفي فجأة،
  // وبعدين يتشال المكوّن فعليًا لما الأنيميشن يخلص (مفيش استعلامات شغالة
  // فى الخلفية من غير داعٍ وهي مقفولة).
  const [detailsMounted, setDetailsMounted] = useState(false);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (detailsOpen) {
      setDetailsMounted(true);
      Animated.timing(sheetAnim, {
        toValue: 1, duration: SHEET_ANIM_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(sheetAnim, {
        toValue: 0, duration: SHEET_ANIM_MS, easing: Easing.in(Easing.cubic), useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) setDetailsMounted(false);
      });
    }
  }, [detailsOpen, sheetAnim]);

  // ↔ زرار الرجوع فى أندرويد وهو فاتح اللوحة يقفلها بدل ما يسيب شاشة
  // الريلز بالكامل — متوقّع من أي "sheet" بيتفتح فوق شاشة قائمة.
  useEffect(() => {
    if (!isActive) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (detailsOpen) {
        onCloseDetails();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [isActive, detailsOpen, onCloseDetails]);

  const mediaHeight = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [reelHeight, MINI_MEDIA_HEIGHT] });
  const sheetHeight = Math.max(reelHeight - MINI_MEDIA_HEIGHT - controlsBottomOffset, 0);
  const sheetTranslateY = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight, 0] });
  const mediaOverlayOpacity = sheetAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0, 0] });
  const miniHandleOpacity = sheetAnim;

  // ↔ #2 (صفحة تفاصيل العقار): سحب اللوحة لأسفل لازم يقفلها ويرجّع الريل
  // fullscreen كامل تانى (الوصف/الكماليات والمرافق/المخطط تختفي، بالظبط
  // زي الضغط على زرار الإغلاق). السحب هنا معلّق على شريط المسكة
  // (sheetGrabRow) بس، مش على المحتوى كله، عشان اسكرول التفاصيل يفضل
  // شغال طبيعي من غير ما يتعارض مع جيستشر السحب.
  const dragStartValue = useRef(1);
  // ↔ إصلاح "زرار إغلاق لوحة التفاصيل مش شغّال": onStartShouldSetPanResponder
  // كانت راجعة true دايمًا — يعني بمجرد ما إصبعك يلمس أي حتة جوه شريط
  // المسكة (sheetGrabRow)، الـ PanResponder بتاعه كان بياخد الاستجابة
  // فورًا لنفسه قبل ما زرار الإغلاق (Pressable) اللي جواه ياخد فرصته
  // يستقبل الضغطة، فـ onPress بتاعه ماكانش بيتنفّذ خالص. الحل: نسيب
  // onStartShouldSetPanResponder ترجع false (مفيش داعي ليها أصلًا، لأن
  // onMoveShouldSetPanResponder تحت شايلة نفس الشغل: بتاخد الاستجابة بس
  // لما فيه سحب فعلي لأسفل)، فالضغطة العادية (من غير سحب) تعدّي عادي
  // للزرار.
  function handleSheetDragGrant() {
    sheetAnim.stopAnimation((value) => { dragStartValue.current = value; });
  }
  function handleSheetDragMove(_evt: unknown, gesture: PanResponderGestureState) {
    if (gesture.dy <= 0 || sheetHeight <= 0) return;
    const draggedPct = Math.min(1, gesture.dy / sheetHeight);
    sheetAnim.setValue(Math.max(0, dragStartValue.current - draggedPct));
  }
  function handleSheetDragRelease(_evt: unknown, gesture: PanResponderGestureState) {
    const shouldClose = gesture.dy > sheetHeight * 0.25 || gesture.vy > 0.8;
    if (shouldClose) {
      onCloseDetails();
    } else {
      Animated.timing(sheetAnim, {
        toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }).start();
    }
  }
  function handleSheetDragTerminate() {
    Animated.timing(sheetAnim, {
      toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }

  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dy) > 4 && gesture.dy > 0,
      onPanResponderGrant: handleSheetDragGrant,
      onPanResponderMove: handleSheetDragMove,
      onPanResponderRelease: handleSheetDragRelease,
      onPanResponderTerminate: handleSheetDragTerminate,
    })
  ).current;

  // ↔ طلب "قفل اللوحة بالسحب لأسفل من فوق المحتوى نفسه، مش بس من شريط
  // المسكة": بنتتبّع موضع تمرير محتوى الوصف (contentScrollY)، وبنستخدم
  // onMoveShouldSetPanResponderCapture (مرحلة "capture"، بتتنفّذ قبل ما
  // الـ ScrollView الأصلية تاخد اللمسة لنفسها) عشان نتحكّم بس لما يكونوا
  // الشرطين الاتنين متحققين مع بعض: (1) المستخدم واصل لقمة المحتوى فعليًا
  // (contentScrollY <= 0)، و(2) بيسحب لأسفل فعلًا (مش بيمرر لفوق أو
  // بيلمس بس). فى أي حالة تانية (لسه بيمرّر جوه المحتوى، أو بيدوس على
  // زرار/رابط جوه الوصف) بترجع false فورًا، فالـ ScrollView والعناصر
  // اللي جواها تفضل شغالة عادي 100% من غير أي تعارض.
  const contentScrollY = useRef(0);
  const contentPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_evt, gesture) =>
        contentScrollY.current <= 0 && gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: handleSheetDragGrant,
      onPanResponderMove: handleSheetDragMove,
      onPanResponderRelease: handleSheetDragRelease,
      onPanResponderTerminate: handleSheetDragTerminate,
    })
  ).current;

  return (
    <View style={{ height: reelHeight, backgroundColor: "#000" }}>
      <Animated.View style={{ height: mediaHeight, width: "100%", overflow: "hidden", backgroundColor: "#000" }}>
        {mode === "video" && video && isNearActive ? (
          <ReelVideoPlayer
            ref={videoRef}
            uri={video.url}
            isActive={isActive}
            paused={paused}
            speed={speed}
            // ↔ #4 (تمرير تلقائي): لما autoAdvance مفعّل، الفيديو مبيلفّش
            // تانى من نفسه — بيوصل لنهايته فعليًا (playToEnd جوه
            // ReelVideoPlayer.tsx) عشان الشاشة الأب تقدر تنتقل للريل اللي
            // بعده. لما يبقى معطّل، بيرجع لسلوك اللف اللانهائي الأصلي.
            autoAdvance={autoAdvance}
            // ↔ #4 (كتم صوت الخلفية): بيضيف تفضيل الكتم اليدوي فوق شرط
            // "مش الريل النشط" الموجود أصلاً (isActive) بدل ما يستبدله.
            muted={!isActive || musicMuted}
            onPosition={onVideoPosition}
            onFinished={onVideoFinished}
          />
        ) : mode === "video" && video ? (
          // ↔ perf audit fix #1: cards outside the active±1 window show a
          // static Cloudinary-derived poster frame instead of a live
          // <Video> player, so the FlatList's rendered window never has
          // more than 2-3 real video decoders allocated at once.
          <Image source={{ uri: cldVideoThumbnail(video.url) }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : mode === "slideshow" && images.length > 0 ? (
          // ↔ #3: "من غير ما يقتصّه" — contentFit يتغيّر لـ contain وهو
          // مصغّر عشان الصورة تبان كاملة جوه المساحة الصغيرة، بدل ما
          // تتقصّ حواف زي وضع العرض العادي (cover).
          <Image source={{ uri: cldOptimized(images[slideIdx].url) }} style={StyleSheet.absoluteFill} contentFit={detailsMounted ? "contain" : "cover"} />
        ) : (
          <ReelBackground index={index} type={property.type} />
        )}

        {/* ↔ .reel-pause-indicator — إصلاح باغ #2: فلاش قصير عند كل تبديل
            (تشغيل أو إيقاف) بدل ما تفضل أيقونة الإيقاف ظاهرة باستمرار. */}
        {tapFeedback && !detailsMounted && (
          <Animated.View style={[styles.pauseIndicator, { opacity: tapFeedbackOpacity }]} pointerEvents="none">
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="white">
              {tapFeedback === "pause" ? <Path d="M6 4h4v16H6zM14 4h4v16h-4z" /> : <Path d="M8 5v14l11-7z" />}
            </Svg>
          </Animated.View>
        )}

        {/* ↔ .long-press-indicator */}
        {speed === 2 && !detailsMounted && (
          <View style={styles.longPressIndicator} pointerEvents="none">
            <Text style={styles.longPressText}>⚡ 2X</Text>
          </View>
        )}

        {!detailsMounted && (
          // ↔ .reel-tap-top / .reel-tap-bottom + startLongPress/endLongPress
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={togglePause}
            onLongPress={() => setSpeed(2)}
            delayLongPress={LONG_PRESS_MS}
            onPressOut={() => setSpeed(1)}
          />
        )}

        <Animated.View style={[StyleSheet.absoluteFill, { opacity: mediaOverlayOpacity }]} pointerEvents={detailsMounted ? "none" : "box-none"}>
          <ReelInfoOverlay
            property={property}
            onOpenDetails={() => onOpenDetails(property.id)}
            onReport={onReport ? () => onReport(property) : undefined}
          />

          <ReelCaptionsOverlay property={property} isActive={isActive} />

          {mode === "video" && (
            <ReelSeekBar
              currentSec={videoPosMs / 1000}
              durationSec={videoDurMs / 1000}
              isPlaying={isActive && !paused}
              onTogglePlay={togglePause}
              onSeek={seekVideo}
            />
          )}
          {mode === "slideshow" && images.length > 1 && (
            <ReelSeekBar
              currentSec={slideElapsedMs / 1000}
              durationSec={slideTotalMs / 1000}
              isPlaying={isActive && !paused}
              onTogglePlay={togglePause}
              onSeek={seekSlideshow}
            />
          )}

          <ReelActionRail
            seller={property.seller}
            likes={property.likes}
            liked={isLiked}
            saved={isFavorite}
            following={isFollowing}
            comparing={isComparing}
            onOpenSeller={() => onOpenSeller(property.seller.id)}
            onToggleFollow={() => onToggleFollow(property.seller.id)}
            onToggleLike={() => onToggleLike(property.id)}
            onShare={() => onShare(property)}
            onToggleSave={() => onToggleFavorite(property.id)}
            onToggleCompare={() => onToggleCompare(property.id)}
          />
        </Animated.View>

        {/* ↔ mini-player: الضغط على الريل المصغّر يرجّعه كامل الشاشة تاني
            (زي الضغط على الـ mini-player بتاع يوتيوب شورتس عشان يتكبّر) */}
        {detailsMounted && (
          <Pressable style={StyleSheet.absoluteFill} onPress={onCloseDetails}>
            <Animated.View style={[styles.miniHandleWrap, { opacity: miniHandleOpacity }]} pointerEvents="none">
              <View style={styles.miniHandle} />
            </Animated.View>
          </Pressable>
        )}
      </Animated.View>

      {detailsMounted && (
        <Animated.View
          style={[styles.sheet, { height: sheetHeight, backgroundColor: themeColors.card, transform: [{ translateY: sheetTranslateY }] }]}
        >
          <View style={styles.sheetGrabRow} {...sheetPanResponder.panHandlers}>
            <View style={[styles.sheetGrabHandle, { backgroundColor: themeColors.border }]} />
            <Pressable style={[styles.sheetCloseBtn, { backgroundColor: themeColors.surface }]} onPress={onCloseDetails} hitSlop={10}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={themeColors.textSubtle} strokeWidth={2.5}>
                <Path d="M6 6l12 12M18 6L6 18" />
              </Svg>
            </Pressable>
          </View>
          <View style={{ flex: 1 }} {...contentPanResponder.panHandlers}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
              onScroll={(e) => { contentScrollY.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
            >
              <PropertyDetailsContent property={property} />
            </ScrollView>
          </View>
          <PropertyCtaBar property={property} />
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  pauseIndicator: {
    position: "absolute", top: "50%", left: "50%", marginTop: -20, marginLeft: -20, opacity: 0.85,
  },
  longPressIndicator: {
    position: "absolute", top: "50%", left: "50%", marginTop: -16, marginLeft: -34,
    backgroundColor: "rgba(0,0,0,0.7)", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, zIndex: 50,
  },
  longPressText: { color: "white", fontSize: 12, fontWeight: "900" },
  miniHandleWrap: { position: "absolute", top: 6, left: 0, right: 0, alignItems: "center" },
  miniHandle: { width: 36, height: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.6)" },
  sheet: {
    backgroundColor: "white", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
  },
  sheetGrabRow: { alignItems: "center", paddingTop: 8, paddingBottom: 4, minHeight: 44 },
  sheetGrabHandle: { width: 36, height: 4, borderRadius: 999, backgroundColor: "#e5e7eb" },
  sheetCloseBtn: {
    position: "absolute", top: 8, ...CLOSE_BTN_SIDE_STYLE, width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center", zIndex: 5, elevation: 5,
  },
});
