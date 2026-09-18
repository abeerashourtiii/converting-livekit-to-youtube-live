import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  View, Text, Pressable, ScrollView, StyleSheet, TextInput, Modal, Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import { useMyProperties, useProperties } from "../../lib/hooks/useProperties";
import { useMyRequests, useRequests, useDeleteRequest } from "../../lib/hooks/useRequests";
import { fmtPrice } from "../../lib/types";
import { ReelBackground } from "../../components/reel/ReelBackground";
import { PageTopBar } from "../../components/shared/PageTopBar";
import { NotificationsDropdown } from "../../components/notifications/NotificationsDropdown";
import { useNotifications } from "../../lib/hooks/useNotifications";
import { useFavorites } from "../../lib/hooks/useFavorites";
import { useMyContent } from "../../lib/hooks/useMyContent";
import { useSyncProcessingRecordings } from "../../lib/hooks/useLiveRecordingStatus";
import { AdActionSheet } from "../../components/account/AdActionSheet";
import { LiveActionSheet } from "../../components/account/LiveActionSheet";
import { Property } from "../../lib/types";
import { SavedLive } from "../../data/saved-live-types";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";
import { supabase } from "../../lib/supabase";
import { uploadToCloudinary, cldOptimized } from "../../lib/cloudinary";
import { useLogMedia } from "../../lib/hooks/useMedia";
import { useDrafts, useDraftMutations } from "../../lib/hooks/useDrafts";

type AccountTab = "ads" | "requests" | "lives" | "favorites" | "drafts";

export default function AccountScreen() {
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const { displayName, user } = useCurrentUser();
  const logMedia = useLogMedia();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  useSyncProcessingRecordings();
  const [activeTab, setActiveTab] = useState<AccountTab>("ads");

  useEffect(() => {
    if (tabParam && ["ads", "requests", "lives", "favorites", "drafts"].includes(tabParam)) {
      setActiveTab(tabParam as AccountTab);
    }
  }, [tabParam]);

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [bioModalVisible, setBioModalVisible] = useState(false);
  const [bioDraft, setBioDraft] = useState("");

  const [notifMenuVisible, setNotifMenuVisible] = useState(false);
  const notifications = useNotifications();

  const { favoriteProperties, favoriteRequests, totalCount, toggleFavoriteProperty, toggleFavoriteRequest } = useFavorites();
  const { savedLives } = useMyContent();
  const myRequests = useMyRequests(user?.id);
  const { data: allRequests = [] } = useRequests();
  const { data: allProperties = [] } = useProperties();
  const deleteRequest = useDeleteRequest();
  const { data: myAds = [] } = useMyProperties(user?.id);
  const { data: listingDrafts = [] } = useDrafts("listing");
  const { data: requestDrafts = [] } = useDrafts("request");
  
  const drafts = useMemo(() => {
    return [...listingDrafts, ...requestDrafts].sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [listingDrafts, requestDrafts]);

  const { remove: removeDraft } = useDraftMutations();
  const [adSheetTarget, setAdSheetTarget] = useState<Property | null>(null);
  const [liveSheetTarget, setLiveSheetTarget] = useState<SavedLive | null>(null);

  const favProps = useMemo(() => allProperties.filter((p) => favoriteProperties.has(p.id)), [allProperties, favoriteProperties]);
  const favReqs = useMemo(() => allRequests.filter((r) => favoriteRequests.has(r.id)), [allRequests, favoriteRequests]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.avatar_url) setAvatarUri(data.avatar_url);
    });
  }, [user?.id]);

  async function pickAvatar() {
    if (!user?.id) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    const uri = result.assets[0].uri;
    try {
      const uploadResult = await uploadToCloudinary(uri, "image");
      logMedia.mutate({ ownerId: user.id, type: "image", context: "avatar", result: uploadResult });
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_url: uploadResult.url }, { onConflict: "id" });
      if (error) throw error;
      setAvatarUri(uploadResult.url);
    } catch {
      Alert.alert(t("تعذر رفع الصورة"), t("حاول مرة أخرى."));
    }
  }

  function saveBio() {
    setBio(bioDraft.trim());
    setBioModalVisible(false);
  }

  const handleOpenLiveReplay = (live: SavedLive) => {
    if (live.recordingUrl || live.recordingStatus === "ready" || !live.recordingStatus) {
      router.push({
        pathname: "/live/replay/[id]",
        params: { id: live.id }
      });
    } else {
      setLiveSheetTarget(live);
    }
  };

  return (
    <View style={styles.container}>
      <PageTopBar
        title="حسابي"
        notifBadgeCount={notifications.totalUnread}
        onOpenNotifications={() => setNotifMenuVisible(true)}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.profileHeader}>
          <Pressable style={styles.avatar} onPress={pickAvatar}>
            {avatarUri ? (
              <Image source={{ uri: cldOptimized(avatarUri, "w_300,h_300,c_fill,q_auto,f_auto") }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Text style={styles.avatarText}>{displayName.charAt(0)}</Text>
            )}
            <View style={styles.avatarEditBadge}>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              </Svg>
            </View>
          </Pressable>
          <Text style={styles.username}>{displayName}</Text>
          <Text style={styles.handle}>@user_diarino</Text>
        </View>

        <Pressable style={styles.bioBox} onPress={() => { setBioDraft(bio); setBioModalVisible(true); }}>
          <Text style={styles.bioText}>{bio || t("اضغط لإضافة نبذة عنك ...")}</Text>
        </Pressable>

        <View style={styles.tabs}>
          <TabBtn active={activeTab === "ads"} label="إعلاناتي" count={myAds.length} onPress={() => setActiveTab("ads")} icon={AdsIcon} />
          <TabBtn active={activeTab === "requests"} label="طلباتي" count={myRequests.length} onPress={() => setActiveTab("requests")} icon={RequestsIcon} />
          <TabBtn active={activeTab === "lives"} label="لايفات" count={savedLives.length} onPress={() => setActiveTab("lives")} icon={LivesIcon} />
          <TabBtn active={activeTab === "favorites"} label="المفضلة" count={totalCount} onPress={() => setActiveTab("favorites")} icon={FavIcon} />
          <TabBtn active={activeTab === "drafts"} label="المسودات" count={drafts.length} onPress={() => setActiveTab("drafts")} icon={DraftsIcon} />
        </View>

        <View style={styles.content}>
          {activeTab === "ads" && (
            myAds.length === 0 ? (
              <EmptyState
                icon={<Svg width={56} height={56} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={1.5}><Rect x={3} y={3} width={18} height={18} rx={2} /><Path d="M3 9h18M9 21V9" /></Svg>}
                title="لا توجد إعلانات"
                subtitle="للنشر: انتقل إلى صفحة القائمة"
                actionLabel="اذهب للقائمة"
                onAction={() => router.push("/(tabs)/menu")}
              />
            ) : (
              <View style={styles.myAdsGrid}>
                {myAds.map((ad) => (
                  <Pressable
                    key={ad.id}
                    style={styles.myAdCell}
                    onPress={() => router.push(`/property/${ad.id}`)}
                    onLongPress={() => setAdSheetTarget(ad)}
                  >
                    <ReelBackground index={0} type={ad.type} />
                    {ad.pinned && (
                      <View style={styles.pinnedBadge}>
                        <Svg width={10} height={10} viewBox="0 0 24 24" fill="white"><Path d="M12 17v5M9 10.76V6a2 2 0 012-2h2a2 2 0 012 2v4.76a2 2 0 00.4 1.2L18 15H6l2.6-3.04a2 2 0 00.4-1.2z" /></Svg>
                      </View>
                    )}
                    <View style={[styles.adPurposeBadge, { backgroundColor: ad.purpose === "sale" ? "#22A652" : "#F4673F" }]}>
                      <Text style={styles.adPurposeBadgeText}>{ad.purpose === "sale" ? t("بيع") : t("إيجار")}</Text>
                    </View>
                    <View style={styles.adPriceTag}><Text style={styles.adPriceTagText}>{fmtPrice(ad.price)} {t("ج.م")}</Text></View>
                    <Pressable
                      style={styles.adMoreBtn}
                      onPress={(e) => { e.stopPropagation(); setAdSheetTarget(ad); }}
                      hitSlop={6}
                    >
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="white">
                        <Circle cx={12} cy={5} r={1.8} /><Circle cx={12} cy={12} r={1.8} /><Circle cx={12} cy={19} r={1.8} />
                      </Svg>
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            )
          )}

          {activeTab === "requests" && (
            myRequests.length === 0 ? (
              <EmptyState
                icon={<Svg width={56} height={56} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={1.5}><Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><Rect x={9} y={3} width={6} height={4} rx={1} /></Svg>}
                title="لا توجد طلبات"
              />
            ) : (
              <View>
                {myRequests.map((r) => (
                  <View key={r.id} style={styles.favCard}>
                    <View style={styles.favCardTop}>
                      <Text style={styles.favCardTitle}>{t(r.type)} {r.purpose === "sale" ? t("للبيع") : t("للإيجار")}</Text>
                      <Text style={styles.favCardPrice}>{t("حتى")} {r.priceMax ? fmtPrice(r.priceMax) : "—"} {t("ج.م")}</Text>
                    </View>
                    <Text style={styles.favCardLoc}>📍 {r.province} · {r.location}</Text>
                    <Pressable style={styles.removeBtn} onPress={() => deleteRequest.mutate(r.id)}>
                      <Text style={styles.removeBtnText}>🗑️ {t("حذف")}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )
          )}

          {activeTab === "lives" && (
            savedLives.length === 0 ? (
              <EmptyState
                icon={<Svg width={56} height={56} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={1.5}><Rect x={2} y={7} width={20} height={14} rx={2} /><Path d="M8 2l4 4 4-4" /></Svg>}
                title="لا توجد لايفات محفوظة"
                subtitle="ابدأ لايف من صفحة القائمة"
                actionLabel="بدء بث مباشر"
                onAction={() => {
                  if (user?.is_anonymous) {
                    Alert.alert(t("يجب تسجيل الدخول بحساب Google لبدء بث مباشر"), t("المتابعة كضيف لا تتيح بدء بث مباشر."));
                    return;
                  }
                  router.push("/live/broadcast");
                }}
              />
            ) : (
              <View style={styles.myAdsGrid}>
                {savedLives.map((live) => (
                  <Pressable
                    key={live.id}
                    style={styles.myAdCell}
                    onPress={() => handleOpenLiveReplay(live)}
                    onLongPress={() => setLiveSheetTarget(live)}
                  >
                    {live.posterUrl ? (
                      <Image source={{ uri: cldOptimized(live.posterUrl) }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#111827", alignItems: "center", justifyContent: "center" }]}>
                        <Text style={{ fontSize: 26 }}>🎬</Text>
                      </View>
                    )}
                    {live.recordingStatus === "processing" && (
                      <View style={styles.processingBadge}><Text style={styles.processingBadgeText}>{t("جارٍ المعالجة")}</Text></View>
                    )}
                    {live.recordingStatus === "failed" && (
                      <View style={styles.failedBadge}><Text style={styles.processingBadgeText}>{t("فشل التسجيل")}</Text></View>
                    )}
                    {(live.recordingStatus === "ready" || !!live.recordingUrl) && (
                      <View style={styles.playIconWrap}>
                        <Svg width={22} height={22} viewBox="0 0 24 24" fill="white"><Path d="M8 5v14l11-7z" /></Svg>
                      </View>
                    )}
                    {live.pinned && (
                      <View style={styles.pinnedBadge}>
                        <Svg width={10} height={10} viewBox="0 0 24 24" fill="white"><Path d="M12 17v5M9 10.76V6a2 2 0 012-2h2a2 2 0 012 2v4.76a2 2 0 00.4 1.2L18 15H6l2.6-3.04a2 2 0 00.4-1.2z" /></Svg>
                      </View>
                    )}
                    {live.publishedPublic && (
                      <View style={styles.publicBadge}>
                        <Text style={styles.publicBadgeText}>{t("عام")}</Text>
                      </View>
                    )}
                    <View style={styles.adPriceTag}>
                      <Text style={styles.adPriceTagText} numberOfLines={1}>{t(live.title)}</Text>
                    </View>
                    <Pressable
                      style={styles.adMoreBtn}
                      onPress={(e) => { e.stopPropagation(); setLiveSheetTarget(live); }}
                      hitSlop={6}
                    >
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="white">
                        <Circle cx={12} cy={5} r={1.8} /><Circle cx={12} cy={12} r={1.8} /><Circle cx={12} cy={19} r={1.8} />
                      </Svg>
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            )
          )}

          {activeTab === "favorites" && (
            favProps.length === 0 && favReqs.length === 0 ? (
              <EmptyState
                icon={<Svg width={56} height={56} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={1.5}><Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></Svg>}
                title="لا توجد عناصر في المفضلة"
              />
            ) : (
              <View>
                {favProps.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>🏠 {t("إعلان")} ({favProps.length})</Text>
                    {favProps.map((p) => (
                      <Pressable key={p.id} style={styles.favCard} onPress={() => router.push(`/property/${p.id}`)}>
                        <View style={styles.favCardTop}>
                          <Text style={styles.favCardTitle} numberOfLines={1}>{p.shortTitle || p.title}</Text>
                          <Text style={styles.favCardPrice}>{fmtPrice(p.price)} ج.م {p.purpose === "rent" ? "/ شهر" : ""}</Text>
                        </View>
                        <Text style={styles.favCardLoc}>📍 {p.province} · {p.location}</Text>
                        <Pressable style={styles.removeBtn} onPress={() => toggleFavoriteProperty(p.id)}>
                          <Text style={styles.removeBtnText}>⭐ {t("إزالة من المفضلة")}</Text>
                        </Pressable>
                      </Pressable>
                    ))}
                  </>
                )}
                {favReqs.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: 16 }]}>📋 {t("الطلبات")} ({favReqs.length})</Text>
                    {favReqs.map((r) => (
                      <View key={r.id} style={styles.favCard}>
                        <View style={styles.favCardTop}>
                          <Text style={styles.favCardTitle}>{t(r.type)} {r.purpose === "sale" ? t("للبيع") : t("للإيجار")}</Text>
                          <Text style={styles.favCardPrice}>{t("حتى")} {r.priceMax ? fmtPrice(r.priceMax) : "—"} {t("ج.م")}</Text>
                        </View>
                        <Text style={styles.favCardLoc}>📍 {r.province} · {r.location}</Text>
                        <Pressable style={styles.removeBtn} onPress={() => toggleFavoriteRequest(r.id)}>
                          <Text style={styles.removeBtnText}>⭐ {t("إزالة من المفضلة")}</Text>
                        </Pressable>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )
          )}

          {activeTab === "drafts" && (
            drafts.length === 0 ? (
              <EmptyState
                icon={<Svg width={56} height={56} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={1.5}><Path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></Svg>}
                title="لا توجد مسودات"
                subtitle="لو بدأت إعلان أو طلب ومكملتوش، احفظه كمسودة عشان ترجعله بعدين"
              />
            ) : (
              <View>
                {drafts.map((d) => (
                  <View key={d.id} style={styles.favCard}>
                    <View style={styles.favCardTop}>
                      <Text style={styles.favCardTitle} numberOfLines={1}>
                        {d.title || (d.draftType === "listing" ? t("مسودة إعلان") : t("مسودة طلب"))}
                      </Text>
                      <Text style={styles.favCardPrice}>{d.draftType === "listing" ? t("إعلان") : t("طلب")}</Text>
                    </View>
                    <Text style={styles.favCardLoc}>
                      {t("آخر تعديل")}: {new Date(d.updatedAt).toLocaleDateString("ar-EG")}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      <Pressable
                        style={[styles.removeBtn, { flex: 1, backgroundColor: "#ecfdf5" }]}
                        onPress={() => router.push({
                          pathname: d.draftType === "listing" ? "/publish/create-listing" : "/publish/create-request",
                          params: { draftId: d.id }
                        })}
                      >
                        <Text style={[styles.removeBtnText, { color: "#22A652" }]}>✏️ {t("استكمال التحرير")}</Text>
                      </Pressable>
                      <Pressable style={styles.removeBtn} onPress={() => removeDraft.mutate(d.id)}>
                        <Text style={styles.removeBtnText}>🗑️ {t("حذف")}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )
          )}
        </View>
      </ScrollView>

      <Modal visible={bioModalVisible} transparent animationType="fade" onRequestClose={() => setBioModalVisible(false)}>
        <Pressable style={styles.bioBackdrop} onPress={() => setBioModalVisible(false)} />
        <View style={styles.bioModal}>
          <Text style={styles.bioModalTitle}>{t("نبذة عنك")}</Text>
          <TextInput
            style={styles.bioInput}
            value={bioDraft}
            onChangeText={setBioDraft}
            placeholder={t("اكتب نبذة قصيرة...")}
            placeholderTextColor={themeColors.textSubtle}
            multiline
            maxLength={150}
          />
          <Pressable style={styles.bioSaveBtn} onPress={saveBio}>
            <Text style={styles.bioSaveBtnText}>{t("حفظ")}</Text>
          </Pressable>
        </View>
      </Modal>

      <NotificationsDropdown
        visible={notifMenuVisible}
        onClose={() => setNotifMenuVisible(false)}
        activeCat={notifications.activeCat}
        onSwitchCat={notifications.setActiveCat}
        filter={notifications.filter}
        onSetFilter={notifications.setFilter}
        badges={notifications.badges}
        items={notifications.visibleItems}
        onMarkAllRead={notifications.markAllRead}
        onItemPress={(index) => {
          const item = notifications.visibleItems[index];
          notifications.markItemRead(notifications.activeCat, index);
          setNotifMenuVisible(false);
          if (!item?.action) return;
          const a = item.action;
          if (a.type === "seller") router.push(`/seller/${a.id}`);
          else if (a.type === "property") router.push(`/property/${a.id}`);
          else if (a.type === "reel") router.push(`/property/${a.propertyId}`);
          else if (a.type === "chat") router.push(`/chat/${a.id}`);
        }}
      />

      <AdActionSheet
        visible={!!adSheetTarget}
        ad={adSheetTarget}
        pinnedCount={myAds.filter((a) => a.pinned).length}
        onClose={() => setAdSheetTarget(null)}
      />
      <LiveActionSheet visible={!!liveSheetTarget} live={liveSheetTarget} onClose={() => setLiveSheetTarget(null)} />
    </View>
  );
}

function AdsIcon({ color }: { color: string }) {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}><Rect x={3} y={3} width={18} height={18} rx={2} /><Path d="M3 9h18M9 21V9" /></Svg>;
}
function RequestsIcon({ color }: { color: string }) {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}><Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><Rect x={9} y={3} width={6} height={4} rx={1} /></Svg>;
}
function LivesIcon({ color }: { color: string }) {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}><Rect x={2} y={7} width={20} height={14} rx={2} /><Path d="M8 2l4 4 4-4" /></Svg>;
}
function FavIcon({ color }: { color: string }) {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}><Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></Svg>;
}
function DraftsIcon({ color }: { color: string }) {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}><Path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></Svg>;
}

function TabBtn({
  active, label, count, icon: Icon, onPress,
}: { active: boolean; label: string; count: number; icon: (props: { color: string }) => React.ReactElement; onPress: () => void }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Icon color={active ? "#22A652" : themeColors.textSubtle} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t(label)}</Text>
      <Text style={[styles.tabCount, active && styles.tabCountActive]}>{count}</Text>
    </Pressable>
  );
}

function EmptyState({ icon, title, subtitle, actionLabel, onAction }: { icon: React.ReactNode; title: string; subtitle?: string; actionLabel?: string; onAction?: () => void }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <View style={styles.emptyState}>
      {icon}
      <Text style={styles.emptyTitle}>{t(title)}</Text>
      {!!subtitle && <Text style={styles.emptySubtitle}>{t(subtitle)}</Text>}
      {!!actionLabel && (
        <Pressable style={styles.emptyActionBtn} onPress={onAction}>
          <Text style={styles.emptyActionBtnText}>{t(actionLabel)}</Text>
        </Pressable>
      )}
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    profileHeader: { alignItems: "center", paddingTop: 24, paddingBottom: 12 },
    avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: "#22A652", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" },
    avatarText: { color: "white", fontWeight: "900", fontSize: 30 },
    avatarEditBadge: { position: "absolute", bottom: 2, right: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: "#111827", borderWidth: 2, borderColor: themeColors.background, alignItems: "center", justifyContent: "center" },
    username: { fontSize: 15, fontWeight: "900", color: themeColors.text, marginTop: 10 },
    handle: { fontSize: 12, color: themeColors.textSubtle, marginTop: 2 },
    bioBox: { paddingHorizontal: 24, paddingBottom: 16, alignItems: "center" },
    bioText: { fontSize: 12.5, color: themeColors.textSubtle, textAlign: "center" },
    tabs: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: themeColors.border },
    tab: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 12 },
    tabActive: { borderBottomWidth: 3, borderBottomColor: "#22A652" },
    tabLabel: { fontSize: 11, fontWeight: "900", color: themeColors.textSubtle },
    tabLabelActive: { color: "#22A652" },
    tabCount: { fontSize: 10, backgroundColor: themeColors.surface, color: themeColors.textSubtle, paddingVertical: 1, paddingHorizontal: 8, borderRadius: 999, overflow: "hidden" },
    tabCountActive: { backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.22)" : "#E8F7EE", color: "#22A652" },
    content: { padding: 16, minHeight: 300 },
    emptyState: { alignItems: "center", paddingTop: 50, gap: 10 },
    emptyTitle: { fontSize: 14, fontWeight: "900", color: themeColors.textMuted },
    emptySubtitle: { fontSize: 12, color: themeColors.textSubtle, textAlign: "center", paddingHorizontal: 20 },
    emptyActionBtn: { marginTop: 10, backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20 },
    emptyActionBtnText: { color: "white", fontWeight: "900", fontSize: 12.5 },
    sectionLabel: { fontSize: 12, fontWeight: "900", color: themeColors.textSubtle, marginBottom: 8 },
    myAdsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    myAdCell: { flexBasis: "31%", aspectRatio: 0.8, borderRadius: 10, overflow: "hidden", backgroundColor: themeColors.surface },
    adPurposeBadge: { position: "absolute", top: 6, right: 6, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 6 },
    adPurposeBadgeText: { color: "white", fontSize: 8.5, fontWeight: "900" },
    adPriceTag: { position: "absolute", bottom: 6, left: 6, right: 6, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 6, paddingVertical: 3, paddingHorizontal: 6 },
    adPriceTagText: { color: "white", fontSize: 9.5, fontWeight: "900", textAlign: "center" },
    adMoreBtn: { position: "absolute", top: 6, left: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
    pinnedBadge: { position: "absolute", bottom: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: "#22A652", alignItems: "center", justifyContent: "center" },
    publicBadge: { position: "absolute", top: 6, right: 6, backgroundColor: "#3b82f6", borderRadius: 999, paddingVertical: 2, paddingHorizontal: 6 },
    publicBadgeText: { color: "white", fontSize: 8.5, fontWeight: "900" },
    processingBadge: { position: "absolute", top: 6, left: 6, backgroundColor: "rgba(217,119,6,0.9)", borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6 },
    failedBadge: { position: "absolute", top: 6, left: 6, backgroundColor: "rgba(239,68,68,0.9)", borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6 },
    processingBadgeText: { color: "white", fontSize: 8, fontWeight: "900" },
    playIconWrap: { position: "absolute", top: "50%", left: "50%", marginTop: -14, marginLeft: -14, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
    favCard: { backgroundColor: themeColors.card, borderRadius: 14, padding: 14, marginBottom: 12 },
    favCardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    favCardTitle: { flex: 1, fontSize: 13, fontWeight: "900", color: themeColors.text },
    favCardPrice: { fontSize: 12.5, fontWeight: "900", color: "#22A652" },
    favCardLoc: { fontSize: 11.5, color: themeColors.textSubtle, marginBottom: 10 },
    removeBtn: { backgroundColor: themeColors.isDark ? "rgba(239,68,68,0.18)" : "#FEE2E2", borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
    removeBtnText: { color: themeColors.isDark ? "#FCA5A5" : "#991B1B", fontSize: 11.5, fontWeight: "900" },
    bioBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
    bioModal: { position: "absolute", left: 20, right: 20, top: "35%", backgroundColor: themeColors.card, borderRadius: 16, padding: 18 },
    bioModalTitle: { fontSize: 14, fontWeight: "900", color: themeColors.text, marginBottom: 10 },
    bioInput: { backgroundColor: themeColors.surface, borderRadius: 10, padding: 12, fontSize: 13, color: themeColors.text, minHeight: 80, textAlignVertical: "top" },
    bioSaveBtn: { marginTop: 14, backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 12, alignItems: "center" },
    bioSaveBtnText: { color: "white", fontWeight: "900", fontSize: 13 },
  });
}