import { useState } from "react";
import { router } from "expo-router";
import { Alert } from "react-native";
import { Path } from "react-native-svg";
import { ActionSheet, ActionSheetItem } from "../shared/ActionSheet";
import { ConfirmModal } from "../shared/ConfirmModal";
import { Property } from "../../lib/types";
import { useDeleteProperty, useTogglePinProperty } from "../../lib/hooks/useProperties";
import { useLanguage } from "../../lib/hooks/useLanguage";

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000; // ↔ EDIT_WINDOW_MS / canEdit()
const MAX_PINNED = 3;

function canEditAd(createdAt: number): boolean {
  return Date.now() - createdAt < EDIT_WINDOW_MS;
}

type Props = { visible: boolean; ad: Property | null; pinnedCount: number; onClose: () => void };

export function AdActionSheet({ visible, ad, pinnedCount, onClose }: Props) {
  const { t } = useLanguage();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteProperty = useDeleteProperty();
  const togglePin = useTogglePinProperty();
  if (!ad) return null;

  const editable = canEditAd(ad.createdAt);

  const items: ActionSheetItem[] = [
    {
      key: "edit",
      label: editable ? t("تعديل الإعلان") : t("تعديل غير متاح (انتهت المدة)"),
      disabled: !editable,
      icon: (p) => <Path {...p} d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4z" />,
      onPress: () => editable && router.push({ pathname: "/publish/create-listing", params: { editId: ad.id } }),
    },
    {
      key: "pin",
      label: ad.pinned ? t("إلغاء التثبيت") : t("تثبيت في أعلى صفحة المعلن"),
      icon: (p) => <Path {...p} d="M12 17v5M9 10.76V6a2 2 0 012-2h2a2 2 0 012 2v4.76a2 2 0 00.4 1.2L18 15H6l2.6-3.04a2 2 0 00.4-1.2z" />,
      onPress: () => {
        if (!ad.pinned && pinnedCount >= MAX_PINNED) {
          Alert.alert(t("الحد الأقصى ٣ إعلانات مثبتة"));
          return;
        }
        togglePin.mutate({ id: ad.id, pinned: !ad.pinned });
      },
    },
    {
      key: "delete",
      label: t("حذف الإعلان"),
      danger: true,
      icon: (p) => <Path {...p} d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />,
      onPress: () => setConfirmDelete(true),
    },
  ];

  return (
    <>
      <ActionSheet visible={visible} title={t(ad.shortTitle || ad.title)} items={items} onClose={onClose} />
      <ConfirmModal
        visible={confirmDelete}
        title={t("حذف الإعلان")}
        text={`${t("هل أنت متأكد من حذف")} "${t(ad.shortTitle || ad.title)}"؟ ${t("لا يمكن التراجع عن هذا الإجراء.")}`}
        confirmLabel={t("حذف")}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { deleteProperty.mutate(ad.id); setConfirmDelete(false); }}
      />
    </>
  );
}
