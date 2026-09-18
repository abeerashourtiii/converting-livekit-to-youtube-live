import { useCallback, useEffect, useState } from "react";
import { Modal, View, Pressable, StyleSheet, Share } from "react-native";
import { router } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Property, fmtPrice } from "../../lib/types";
import { ReelCard } from "../reel/ReelCard";
import { ReelOptionsSheet } from "../reel/ReelOptionsSheet";
import { ReportModal } from "../shared/ReportModal";
import { useFollows } from "../../lib/hooks/useFollows";
import { useFavorites } from "../../lib/hooks/useFavorites";
import { useLikes } from "../../lib/hooks/useLikes";
import { useCompareSelection } from "../../lib/hooks/useCompareSelection";
import { useIncrementSponsoredReach } from "../../lib/hooks/useSponsoredReels";
import { showToast } from "../shared/Toast";
import { useLanguage } from "../../lib/hooks/useLanguage";

type Props = {
  property: Property | null;
  sponsoredReelId?: string;
  onClose: () => void;
};

// ↔ بند 7 — نفس تجربة الريلز بالظبط (الفيديو/الأيقونات الجانبية/لوحة
// التفاصيل المتصغّرة/قائمة الضغط المطول) لإعلان ممول واحد يتفتح من أي
// مكان تاني غير شاشة الريلز (هنا: أيقونة/كارت الإعلان فى صفحة البحث)،
// من غير ما نعيد بناء كل ده من الصفر — ReelCard هو نفسه المستخدم فى
// app/(tabs)/index.tsx، وبنسيب فيه نفس الـ hooks الحقيقية (متابعة/مفضلة/
// إعجاب/مقارنة/إبلاغ) عشان أي إجراء هنا ينعكس فى كل الشاشات التانية.
export function SponsoredAdReelModal({ property, sponsoredReelId, onClose }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { followedIds, toggleFollow } = useFollows();
  const { favoriteProperties, toggleFavoriteProperty } = useFavorites();
  const { likedIds, toggleLike } = useLikes();
  const compareSelection = useCompareSelection();
  const incrementReach = useIncrementSponsoredReach();

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const visible = !!property;

  useEffect(() => {
    if (visible && sponsoredReelId) incrementReach.mutate(sponsoredReelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sponsoredReelId]);

  const handleOpenDetails = useCallback(() => setDetailsOpen(true), []);
  const handleCloseDetails = useCallback(() => setDetailsOpen(false), []);
  const handleOpenSeller = useCallback((sellerId: string) => { onClose(); router.push(`/seller/${sellerId}`); }, [onClose]);
  const handleToggleCompare = useCallback(
    (propertyId: string) => {
      const result = compareSelection.toggle(propertyId);
      if (result === "full") showToast(t(`تقدر تقارن حتى ${compareSelection.max} عقارات بس`));
    },
    [compareSelection, t]
  );
  const handleShare = useCallback((p: Property) => {
    Share.share({ message: `${p.title} — ${fmtPrice(p.price)} ج.م\nhttps://diarino.app/property/${p.id}` });
  }, []);

  if (!visible || !property) return null;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
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
          onCloseDetails={handleCloseDetails}
          onOpenDetails={handleOpenDetails}
          onOpenSeller={handleOpenSeller}
          onToggleFollow={(sellerId) => toggleFollow(sellerId)}
          onToggleFavorite={(propertyId) => toggleFavoriteProperty(propertyId)}
          onToggleLike={(propertyId) => toggleLike(propertyId)}
          onToggleCompare={handleToggleCompare}
          onShare={handleShare}
          onReport={() => setReportSheetOpen(true)}
        />
        {!detailsOpen && (
          <Pressable style={[styles.closeBtn, { top: insets.top + 10 }]} onPress={onClose} hitSlop={10}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
              <Path d="M18 6L6 18M6 6l12 12" />
            </Svg>
          </Pressable>
        )}
      </View>

      <ReelOptionsSheet
        visible={reportSheetOpen}
        onClose={() => setReportSheetOpen(false)}
        onOpenReport={() => setReportModalOpen(true)}
        hasMusic={!!property.music}
      />
      <ReportModal
        visible={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        quickMode
        targetType="property"
        targetId={property.id}
        targetTitle={property.title}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  closeBtn: {
    position: "absolute", left: 14, width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", zIndex: 50,
  },
});
