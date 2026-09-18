import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Share } from "react-native";
import Svg, { Path } from "react-native-svg";
import { usePropertyDetail } from "../../../lib/hooks/useProperties";
import { fmtPrice } from "../../../lib/types";
import { ReelCard } from "../../../components/reel/ReelCard";
import { useFollows } from "../../../lib/hooks/useFollows";
import { useFavorites } from "../../../lib/hooks/useFavorites";
import { useLikes } from "../../../lib/hooks/useLikes";
import { useCompareSelection } from "../../../lib/hooks/useCompareSelection";
import { showToast } from "../../../components/shared/Toast";
import { ReportModal } from "../../../components/shared/ReportModal";
import { useLanguage } from "../../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../../lib/hooks/useThemeColors";

// ↔ إصلاح "الضغط على عقار فى صفحة البحث كان بيودّي لصفحة التفاصيل
// العادية (تمرير + وصف + أزرار تواصل) بدل تجربة الريل الكاملة (فيديو
// بشاشة كاملة + الأيقونات الجانبية زي اللايك/المشاركة/المتابعة + شريط
// الـ seek) اللي موجودة فى تبويب الريلز": بدل ما نغيّر شاشة
// app/property/[id].tsx نفسها (مستخدمة فى أكتر من 15 مكان فى التطبيق
// كصفحة تفاصيل عادية — تغييرها كان هيكسر كل الاستخدامات التانية دي)،
// عملنا شاشة جديدة منفصلة هنا بتعرض نفس مكوّن <ReelCard> المستخدم
// بالظبط فى تبويب الريلز (app/(tabs)/index.tsx) لعقار واحد بس — نفس
// الشكل والتفاعل بالظبط، من غير ما نلمس أي استخدام قديم لصفحة التفاصيل
// العادية فى باقي الشاشات. ReelCard نفسه بيحدد ارتفاعه الكامل لوحده
// (useReelHeight) فمحتاجينش أي FlatList أو حاوية بارتفاع محسوب يدويًا.
export default function PropertyReelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const { data: property, isLoading } = usePropertyDetail(id);

  const { followedIds, toggleFollow } = useFollows();
  const { favoriteProperties, toggleFavoriteProperty } = useFavorites();
  const { likedIds, toggleLike } = useLikes();
  const compareSelection = useCompareSelection();

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  if (isLoading) {
    return (
      <View style={styles.notFound}>
        <ActivityIndicator size="large" color="#22A652" />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>{t("هذا العقار لم يعد متاحًا")}</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>{t("رجوع")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ReelCard
        property={property}
        index={0}
        isActive
        isNearActive
        isFollowing={followedIds.has(property.seller.id)}
        isFavorite={favoriteProperties.has(property.id)}
        isLiked={likedIds.has(property.id)}
        isComparing={compareSelection.isSelected(property.id)}
        detailsOpen={detailsOpen}
        onCloseDetails={() => setDetailsOpen(false)}
        onOpenDetails={() => setDetailsOpen(true)}
        onOpenSeller={(sellerId) => router.push(`/seller/${sellerId}`)}
        onToggleFollow={(sellerId) => toggleFollow(sellerId)}
        onToggleFavorite={(propertyId) => toggleFavoriteProperty(propertyId)}
        onToggleLike={(propertyId) => toggleLike(propertyId)}
        onToggleCompare={(propertyId) => {
          const result = compareSelection.toggle(propertyId);
          if (result === "full") showToast(t(`تقدر تقارن حتى ${compareSelection.max} عقارات بس`));
        }}
        onShare={(p) => Share.share({ message: `${p.title} — ${fmtPrice(p.price)} ج.م\nhttps://diarino.app/property/${p.id}` })}
        onReport={() => setReportVisible(true)}
      />

      <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
          <Path d="M6 6l12 12M18 6L6 18" />
        </Svg>
      </Pressable>

      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        quickMode
        targetType="property"
        targetId={property.id}
        targetTitle={property.title}
      />
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000" },
    notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: themeColors.background },
    notFoundText: { fontSize: 14, fontWeight: "800", color: themeColors.textMuted },
    backBtn: { backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 24 },
    backBtnText: { color: "white", fontWeight: "900" },
    // ↔ zIndex 60: أعلى من أي عنصر داخلي فى ReelCard (أعلى قيمة عندهم 50
    // فى ReelCard.tsx نفسه) عشان زرار الإغلاق يفضل ظاهر فوق كل حاجة.
    closeBtn: {
      position: "absolute", top: 50, left: 14, width: 32, height: 32, borderRadius: 16,
      backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", zIndex: 60,
    },
  });
}
