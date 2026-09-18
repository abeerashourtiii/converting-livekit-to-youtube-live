import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Linking, FlatList, NativeSyntheticEvent, NativeScrollEvent, Dimensions } from "react-native";
import { Image } from "expo-image";
import { AdBanner } from "../../lib/hooks/useAdBanners";
import { useAdCarouselSettings } from "../../lib/hooks/useAdCarouselSettings";
import { useLogAdContact } from "../../lib/hooks/useAdContacts";
import { cldOptimized } from "../../lib/cloudinary";
import { waLink } from "../../lib/whatsapp";
import { showToast } from "../shared/Toast";

// ↔ the "مساحة إعلانية" card — real, admin-managed banners that either
// auto-rotate (sliding right, with an admin-configurable duration) or
// only advance when the person swipes, per
// components/admin/AdminAdBanners.tsx's rotation-mode setting.
export function AdBannerCarousel({ banners }: { banners: AdBanner[] }) {
  const { data: settings } = useAdCarouselSettings();
  const isManual = settings?.rotationMode === "manual";

  if (isManual) return <ManualCarousel banners={banners} />;
  return <AutoCarousel banners={banners} durationMs={settings?.durationMs ?? 4000} />;
}

// ↔ every tap that actually opens a link or WhatsApp chat counts as the
// person "contacting" that ad — logged into public.ad_contacts
// (20260815000000_support_center.sql) so the admin support center's
// "الإعلانات" tab can show which ads people engaged with.
function useOpenBanner() {
  const logContact = useLogAdContact();
  return (banner: AdBanner) => {
    if (!banner.linkUrl && !banner.whatsappMessage) return;
    logContact.mutate(banner);
    if (banner.linkUrl) Linking.openURL(banner.linkUrl).catch(() => showToast("تعذر فتح الرابط"));
    else if (banner.whatsappMessage) Linking.openURL(waLink(banner.whatsappMessage)).catch(() => showToast("تعذر فتح واتساب"));
  };
}

function BannerContent({ banner }: { banner: AdBanner }) {
  return (
    <>
      {banner.imageUrl ? (
        <Image source={{ uri: cldOptimized(banner.imageUrl) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallbackBg]} />
      )}
      <View style={styles.textOverlay}>
        <Text style={styles.title} numberOfLines={1}>{banner.title}</Text>
      </View>
    </>
  );
}

function AutoCarousel({ banners, durationMs }: { banners: AdBanner[]; durationMs: number }) {
  const [index, setIndex] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;
  const openBanner = useOpenBanner();

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      Animated.timing(slide, { toValue: 1, duration: 380, useNativeDriver: true }).start(() => {
        setIndex((i) => (i + 1) % banners.length);
        slide.setValue(-1);
        Animated.timing(slide, { toValue: 0, duration: 380, useNativeDriver: true }).start();
      });
    }, durationMs);
    return () => clearInterval(timer);
  }, [banners.length, slide, durationMs]);

  if (banners.length === 0) return null;
  const banner = banners[index];

  const translateX = slide.interpolate({ inputRange: [-1, 0, 1], outputRange: [-40, 0, 40] });
  const opacity = slide.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] });

  return (
    <Pressable onPress={() => openBanner(banner)} style={styles.wrap}>
      <Animated.View style={[styles.inner, { transform: [{ translateX }], opacity }]}>
        <BannerContent banner={banner} />
      </Animated.View>
      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((b, i) => (
            <View key={b.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </Pressable>
  );
}

// ↔ rotation_mode = 'manual' — no timer at all, purely swipe-driven,
// paged horizontally like a standard carousel.
function ManualCarousel({ banners }: { banners: AdBanner[] }) {
  const [index, setIndex] = useState(0);
  const width = Dimensions.get("window").width - 28; // matches the screen's 14px horizontal padding on each side
  const openBanner = useOpenBanner();

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(i);
  }

  if (banners.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <FlatList
        data={banners}
        keyExtractor={(b) => b.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        renderItem={({ item }) => (
          <Pressable onPress={() => openBanner(item)} style={[styles.inner, { width }]}>
            <BannerContent banner={item} />
          </Pressable>
        )}
      />
      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((b, i) => (
            <View key={b.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ↔ الطلب: مضاعفة ارتفاع المساحة الإعلانية عشان تبقى مناسبة لرؤية
  // الإعلان بوضوح (كانت 90 بكسل — صغيرة جدًا لعرض صورة إعلان بتفاصيل
  // واضحة). القيمة رقم ثابت واحد بيتحكم فى العرض على أندرويد/آيفون/الويب
  // وبناء الـ APK كلهم مع بعض، مفيش أي كود خاص بمنصة معينة هنا.
  wrap: { height: 180, borderRadius: 16, overflow: "hidden", backgroundColor: "#111827" },
  inner: { flex: 1, justifyContent: "flex-end" },
  fallbackBg: { backgroundColor: "#312e81" },
  textOverlay: { padding: 12, backgroundColor: "rgba(0,0,0,0.35)" },
  title: { color: "white", fontWeight: "900", fontSize: 13 },
  dots: { position: "absolute", top: 8, right: 8, flexDirection: "row", gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { backgroundColor: "white" },
});
