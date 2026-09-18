import { useRef } from "react";
import { Animated, PanResponder, NativeSyntheticEvent, NativeScrollEvent } from "react-native";

// ↔ #8 (إغلاق الصفحات المنسدلة بسحب المحتوى): منطق مشترك لكل الـ Sheets
// (الفلتر/قائمة الضغط المطول/تقديم عرض/الإبلاغ/مشاركة البروفايل/متابعين...)
// بدل ما كل مكوّن يكرر نفس PanResponder بنفسه.
//
// لو الشيت فيه ScrollView/FlatList داخلي، مرّر `scrollYRef` (أو استخدم
// `onScroll` المرجوعة) عشان السحب لأسفل يقفل بس لما يكون السكرول فى
// الأعلى تمامًا (scrollY <= 0) — بالظبط زي سلوك أي bottom sheet قياسي:
// تقدر تسكرول عادي جوه المحتوى، وأول ما توصل لآخر نقطة فوق وتكمل تسحب
// لتحت تقفل الشيت. لو الشيت مفهوش سكرول داخلي أصلاً، سيبه بدون آرجيومنتس
// وهيتفعّل على كل المحتوى مباشرة.
export function useDragToClose(onClose: () => void, opts?: { dismissThreshold?: number; flingDistance?: number }) {
  const dismissThreshold = opts?.dismissThreshold ?? 110;
  const flingDistance = opts?.flingDistance ?? 700;

  const translateY = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(1)).current;
  const scrollYRef = useRef(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        scrollYRef.current <= 0 && g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy < 0) return;
        translateY.setValue(g.dy);
        backdropOpacity.setValue(Math.max(0, 1 - g.dy / 500));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > dismissThreshold) {
          Animated.timing(translateY, { toValue: flingDistance, duration: 220, useNativeDriver: true }).start(() => {
            translateY.setValue(0);
            backdropOpacity.setValue(1);
            onClose();
          });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
          Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return {
    translateY,
    backdropOpacity,
    panHandlers: panResponder.panHandlers,
    onScroll,
  };
}
