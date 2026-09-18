import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEventListener } from "expo";
import { usePiPPreference } from "../../lib/hooks/usePiPPreference";

export type ReelVideoPlayerHandle = { seekToPct: (pct: number) => void };

type Props = {
  uri: string;
  isActive: boolean;
  paused: boolean;
  speed: 1 | 2;
  autoAdvance: boolean;
  muted: boolean;
  onPosition: (currentSec: number, durationSec: number) => void;
  onFinished: () => void;
};

// ↔ ترقية expo-av → expo-video (طلب المستخدم — الميزة 2: PiP). العنصر ده
// بيحل محل <Video> بتاعت expo-av فى ReelCard.tsx بالظبط بنفس السلوك
// (كتم/تمرير تلقائي/سرعة 2x/تتبع الموضع/اكتشاف الانتهاء)، زائد PiP حقيقي
// عبر allowsPictureInPicture — أول مرة الخاصية دي بقت شغالة فعليًا فى
// التطبيق (كانت قبل كده مجرد تفضيل متخزّن بدون تشغيل فعلي، شوف
// usePiPPreference.ts).
//
// ↔ ليه فى كومبوننت منفصل: useVideoPlayer() هوك، ومينفعش يتنده شرطيًا
// جوه ReelCard (اللي بس بيعمل mount لعنصر الفيديو الحقيقي لما
// isNearActive تكون true). عزل الهوك هنا جوه كومبوننت بيتعمله mount/
// unmount بالكامل حسب isNearActive بيحل المشكلة من غير ما يخالف قواعد
// الـ Hooks.
export const ReelVideoPlayer = forwardRef<ReelVideoPlayerHandle, Props>(function ReelVideoPlayer(
  { uri, isActive, paused, speed, autoAdvance, muted, onPosition, onFinished },
  ref
) {
  const { preference: pipPreference } = usePiPPreference();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = !autoAdvance;
    // ↔ مهم: timeUpdateEventInterval بيبقى 0 افتراضيًا فى expo-video (يعني
    // event الـ "timeUpdate" مش بيتبعت خالص من غير ما نحدده صراحةً) —
    // بدونها شريط الـ seek كان هيفضل واقف على 0:00 طول الوقت، من غير أي
    // خطأ ظاهر فى الكونسول يوضح السبب.
    p.timeUpdateEventInterval = 0.25;
  });

  // ↔ نفس الـ workaround اللي كان موجود مع expo-av: لما الفيديو يوصل
  // لآخره من غير loop (autoAdvance مفعّل)، الـ player بيفضل واقف عند آخر
  // فريم ومبيرجعش لأول تلقائيًا — فلو المستخدم رجع لنفس الريل ده تانى،
  // finishedRef بيسجّل إننا محتاجين نرجّع currentTime لصفر قبل ما نشغّله.
  const finishedRef = useRef(false);

  // ↔ إصلاح "توقف شريط الـ seek عند إعادة الريل تلقائيًا": باغ موثّق فى
  // expo-video نفسها (expo/expo#34700 على أندرويد، #37299 على آيفون) —
  // عند لحظة اللف التلقائي (loop)، player.duration وplayer.currentTime
  // ممكن يترجعوا قيمة غلط لحظيًا (duration بيبقى 0 مثلاً) قبل ما يستقروا
  // تانى. من غير الحماية دي، onPosition(currentSec, 0) كانت بتتبعت لحظة
  // اللف، فـ ReelSeekBar بيحسب النسبة (currentSec/duration) بقيمة duration
  // صفر ويجمّد الشريط. الحل: بنحتفظ بآخر duration صحيحة (أكبر من صفر)
  // اتسجلت فعلاً، وبنفضل نبعتها حتى لو الحدث الحالي رجع قيمة فاسدة مؤقتًا.
  const lastGoodDurationRef = useRef(0);

  useEffect(() => { player.loop = !autoAdvance; }, [player, autoAdvance]);
  useEffect(() => { player.muted = muted; }, [player, muted]);
  useEffect(() => { player.playbackRate = speed; }, [player, speed]);

  useEffect(() => {
    const shouldPlay = isActive && !paused;
    if (shouldPlay) {
      if (finishedRef.current) {
        finishedRef.current = false;
        player.currentTime = 0;
      }
      player.play();
    } else {
      player.pause();
    }
  }, [player, isActive, paused]);

  useEventListener(player, "playToEnd", () => {
    if (autoAdvance) finishedRef.current = true;
    onFinished();
  });

  useEventListener(player, "timeUpdate", (payload) => {
    if (player.duration > 0) lastGoodDurationRef.current = player.duration;
    onPosition(payload.currentTime, lastGoodDurationRef.current);
  });

  useImperativeHandle(ref, () => ({
    seekToPct(pct: number) {
      if (!player.duration) return;
      player.currentTime = pct * player.duration;
      // ↔ إصلاح "الريل مش بيستأنف التشغيل بسلاسة من نقطة إفلات كرة
      // الـ seek": بعض تطبيقات الفيديو الأصلية اللي وراء expo-video
      // (خصوصًا الويب، وأحيانًا أثناء إعادة التخزين المؤقت (buffering)
      // على أندرويد/آيفون) بترجع لحالة "متوقف" فور ما نضبط currentTime،
      // حتى لو كان الفيديو شغّال فعلًا قبل السحب — فبنطلب التشغيل
      // صراحةً تاني فورًا بعد السحب لو المفروض يكون شغّال وقتها، عشان
      // الريل يستأنف فعليًا من نفس النقطة اللي المستخدم أفلت عندها،
      // بنفس السلوك على أندرويد وiOS والـ APK والويب.
      if (isActive && !paused) player.play();
    },
  }), [player, isActive, paused]);

  return (
    <VideoView
      player={player as unknown as ComponentProps<typeof VideoView>["player"]}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
      // ↔ إصلاح "إيقاف/استمرار الريل شغّال على الويب بس، مش شغّال على
      // الـ APK/أندرويد/آيفون": باغ موثّق فى expo-video (expo/expo#30275،
      // #34630) — الـ VideoView الأصلية (SurfaceView على أندرويد) بتفضل
      // دايمًا فوق فى ترتيب استقبال اللمس على المنصات الأصلية بغض النظر
      // عن ترتيب الـ JSX، حتى لو الـ Pressable الشفاف بتاع "اضغط للإيقاف/
      // التشغيل" فى ReelCard.tsx متعرّف بعدها فى الكود (يعني المفروض يبقى
      // فوقها). ده اللي كان بيمنع الضغطة توصل للـ Pressable على المنصات
      // الأصلية بس — الويب (react-native-web) بيرندر VideoView كعنصر DOM
      // عادي محترم لترتيب العناصر، عشان كده كانت شغالة هناك بس.
      // pointerEvents="none" هنا بيمنع VideoView من إنها تاخد أي لمسة
      // أصلاً (مش محتاجينها؛ nativeControls أصلاً false)، فاللمس كله
      // بيوصل للـ Pressable اللي فوقها زي المفروض على كل المنصات.
      pointerEvents="none"
      // ↔ الميزة 2 (PiP): مفعّلة بس لو المستخدم وافق صراحةً من مودال
      // "عرض التطبيق فوق التطبيقات الأخرى" (شوف PictureInPictureModal.tsx)
      // — مش مفعّلة بشكل افتراضي لكل الفيديوهات.
      allowsPictureInPicture={pipPreference === "enabled"}
      startsPictureInPictureAutomatically={pipPreference === "enabled" && isActive}
    />
  );
});
