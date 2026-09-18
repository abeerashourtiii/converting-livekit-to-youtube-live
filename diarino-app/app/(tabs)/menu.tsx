import { useState } from "react";
import { router, Href } from "expo-router";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  I18nManager,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { PageTopBar } from "../../components/shared/PageTopBar";
import { NotificationsDropdown } from "../../components/notifications/NotificationsDropdown";
import { useNotifications } from "../../lib/hooks/useNotifications";
import { useActiveLives } from "../../lib/hooks/useActiveLives";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { waLink } from "../../lib/whatsapp";
import { openExternalUrl } from "../../lib/linking";
import { useActiveAdBanners } from "../../lib/hooks/useAdBanners";
import { AdBannerCarousel } from "../../components/menu/AdBannerCarousel";
import { useActiveMenuItems, MenuItem, MenuImageSize } from "../../lib/hooks/useMenuItems";
import { MenuCardIcon, menuCardImageSource } from "../../lib/menuIconRegistry";
import { cldOptimized } from "../../lib/cloudinary";
import { useThemeColors } from "../../lib/hooks/useThemeColors";

// ↔ image_size ("حجم الصورة داخل الأيقونة" فى لوحة الأدمن) لكارت من نوع
// "below"/"cta" (صورة صغيرة فوق النص): نسبة الحجم بالنسبة لـ iconBoxHeight
// الافتراضي لكل مكان فى الصفحة. لكارت من نوع "above"/"overlay"/"hidden"
// (صورة كبيرة/خلفية كاملة): مسافة الحشو حوالين الصورة — full = حافة
// لحافة زي القديم بالظبط، الأحجام الأصغر بتدي شكل "صورة مؤطّرة" جوه الكارت.
const MEDIA_SIZE_SCALE: Record<MenuImageSize, number> = { small: 0.65, medium: 1, large: 1.45, full: 1.9 };
const MEDIA_PAD: Record<MenuImageSize, number> = { full: 0, large: 6, medium: 14, small: 24 };

// ↔ إصلاح "الأدمن بيقدر يختار صورة بجانب النص (يمين/شمال) ومكان النص
// رأسيًا/أفقيًا وحجم/سُمك/لون الخط من لوحة التحكم — بس كل ده كان بيتحفظ
// فى قاعدة البيانات من غير ما يظهر أي أثر فعلي على صفحة القائمة
// الحقيقية خالص": الفورم فى AdminMenuItems.tsx كانت بتجمع وتحفظ الحقول
// دي (image_side, font_size, font_bold, font_color, text_valign,
// text_halign) صح 100%، لكن دالة العرض هنا (Card) ماكانتش بتقراها
// خالص — وحتى تصنيف "beside" (صورة بجانب النص) مكانش ليه حالة عرض
// مستقلة أصلًا، فكان بيقع تلقائيًا لحالة "below" الافتراضية (صورة فوق،
// نص تحت) من غير أي تحذير. الإصلاح ده بيوصّل كل الحقول دي لعرض حقيقي.
//
// FIXED_ROW: "يمين"/"شمال" هنا اختيار تصميم من الأدمن لمحتوى الكارت
// نفسه (زي اختيار لون الكارت)، مش سلوك واجهة لازم يتبدّل مع لغة
// التطبيق — فبنثبّت اتجاه الصف فعليًا بغض النظر عن I18nManager.isRTL،
// بنفس الأسلوب المستخدم فعلًا فى ReelSeekBar (FIXED_ROW_DIRECTION).
const FIXED_ROW = I18nManager.isRTL ? "row-reverse" : "row";

function vAlignToJustify(v: MenuItem["textVAlign"]): "flex-start" | "center" | "flex-end" {
  return v === "top" ? "flex-start" : v === "bottom" ? "flex-end" : "center";
}

type Row =
  | { type: "full"; item: MenuItem }
  | { type: "pair"; items: [MenuItem, MenuItem] }
  | { type: "tallPair"; tall: MenuItem; stack: [MenuItem, MenuItem] }
  | { type: "roundPair"; round: MenuItem; wide: MenuItem };

function buildRows(menuItems: MenuItem[]): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < menuItems.length; i++) {
    const item = menuItems[i];
    if (item.size === "tall") {
      const a = menuItems[i + 1];
      const b = menuItems[i + 2];
      if (a?.size === "half" && b?.size === "half") {
        rows.push({ type: "tallPair", tall: item, stack: [a, b] });
        i += 2;
        continue;
      }
      rows.push({ type: "full", item });
      continue;
    }
    if (item.size === "round") {
      const a = menuItems[i + 1];
      if (a?.size === "half") {
        rows.push({ type: "roundPair", round: item, wide: a });
        i += 1;
        continue;
      }
      rows.push({ type: "full", item });
      continue;
    }
    if (item.size === "full") {
      rows.push({ type: "full", item });
      continue;
    }
    const next = menuItems[i + 1];
    if (next && next.size === "half") {
      rows.push({ type: "pair", items: [item, next] });
      i++;
    } else {
      rows.push({ type: "full", item });
    }
  }
  return rows;
}

function textColorFor(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return "white";
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1f2937" : "#ffffff";
}

export default function MenuScreen() {
  const { t } = useLanguage();
  const [notifMenuVisible, setNotifMenuVisible] = useState(false);
  const notifications = useNotifications();
  const { user } = useCurrentUser();
  const { data: activeLives } = useActiveLives();
  const { data: adBanners } = useActiveAdBanners();
  const { data: menuItems = [] } = useActiveMenuItems();
  const themeColors = useThemeColors();

  function runAction(item: MenuItem) {
    if (item.actionType === "route" && item.actionValue === "/live/broadcast" && user?.is_anonymous) {
      Alert.alert(t("يجب تسجيل الدخول بحساب Google لبدء بث مباشر"), t("المتابعة كضيف لا تتيح بدء بث مباشر."));
      return;
    }
    if (item.actionType === "route") {
      try {
        router.push(item.actionValue as Href);
      } catch (err: unknown) {
        console.warn("Menu item navigation failed:", item.actionValue, err);
        Alert.alert(t("تعذر فتح هذا القسم"), t("حدث خطأ غير متوقع، برجاء المحاولة لاحقًا."));
      }
    } else if (item.actionType === "whatsapp") {
      openExternalUrl(waLink(item.actionValue));
    } else if (item.actionType === "url") {
      openExternalUrl(item.actionValue);
    }
  }

  const rows = buildRows(menuItems);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <PageTopBar
        title={t("القائمة")}
        notifBadgeCount={notifications.totalUnread}
        onOpenNotifications={() => setNotifMenuVisible(true)}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* البانر الإعلاني */}
        {adBanners && adBanners.length > 0 ? (
          <AdBannerCarousel banners={adBanners} />
        ) : (
          <StaticCard
            color="#F59E0B"
            minHeight={180}
            title="مساحة اعلانية — اعرض هنا"
            onPress={() => openExternalUrl(waLink("مرحباً، أرغب في حجز مساحة إعلانية داخل تطبيق ديارينو"))}
          />
        )}

        {/* عناصر القائمة الديناميكية */}
        {rows.map((row) => {
          if (row.type === "full") {
            return <Card key={row.item.id} item={row.item} iconBoxHeight={46} onPress={() => runAction(row.item)} />;
          }
          if (row.type === "pair") {
            return (
              <View key={row.items.map((r) => r.id).join("-")} style={styles.row}>
                {row.items.map((item) => (
                  <Card key={item.id} item={item} flex iconBoxHeight={56} onPress={() => runAction(item)} />
                ))}
              </View>
            );
          }
          if (row.type === "tallPair") {
            return (
              <View key={row.tall.id + "-tall"} style={styles.row}>
                <Card item={row.tall} flex minHeight={214} iconBoxHeight={90} onPress={() => runAction(row.tall)} />
                <View style={styles.stackCol}>
                  {row.stack.map((item) => (
                    <Card key={item.id} item={item} flex iconBoxHeight={44} onPress={() => runAction(item)} />
                  ))}
                </View>
              </View>
            );
          }
          return (
            <View key={row.round.id + "-round"} style={styles.row}>
              <Card item={row.round} shape="circle" iconBoxHeight={26} onPress={() => runAction(row.round)} />
              <Card item={row.wide} flex iconBoxHeight={52} onPress={() => runAction(row.wide)} />
            </View>
          );
        })}

        {!!activeLives?.length && (
          <Pressable
            style={styles.liveNowBanner}
            onPress={() => router.push(`/live/${activeLives[0].roomName}` as Href)}
          >
            <View style={styles.liveNowDot} />
            <Text style={styles.liveNowText} numberOfLines={1}>
              {activeLives[0].hostName || t("أحد المعلنين")} {t("يبث مباشرة الآن")}
              {activeLives.length > 1 ? ` +${activeLives.length - 1}` : ""}
            </Text>
            <Text style={styles.liveNowJoin}>{t("مشاهدة")}</Text>
          </Pressable>
        )}
      </ScrollView>

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
          if (a.type === "seller") router.push(`/seller/${a.id}` as Href);
          else if (a.type === "property") router.push(`/property/${a.id}` as Href);
          else if (a.type === "reel") router.push(`/property/${a.propertyId}` as Href);
          else if (a.type === "chat") router.push(`/chat/${a.id}` as Href);
        }}
      />
    </View>
  );
}

// ↔ كارت "مساحة إعلانية" الثابت اللي بيظهر لما مفيش أي إعلان مضاف —
// مش صف حقيقي من public.menu_items، فمفيهوش أيقونة/صورة أصلاً (زي ما
// كان بالظبط قبل التوحيد تحت)، عشان كده فضل مكوّن منفصل بسيط. minHeight
// بتتبعت صراحةً عشان تفضل بنفس ارتفاع AdBannerCarousel (180) — لو مفيش
// إعلان مضاف لسه، المساحة تفضل بنفس حجم ما لو كان فيه إعلان فعلي، من
// غير ما تقفز فجأة لما الأدمن يضيف أول إعلان.
function StaticCard({ color, title, minHeight, onPress }: { color: string; title: string; minHeight?: number; onPress: () => void }) {
  const { t } = useLanguage();
  const textColor = textColorFor(color);
  return (
    <Pressable
      style={[styles.card, { backgroundColor: color, alignItems: "center", justifyContent: "center" }, minHeight ? { minHeight } : null]}
      onPress={onPress}
    >
      <Text style={[styles.cardTitle, { color: textColor }, styles.cardTitleSmall]}>{t(title)}</Text>
    </Pressable>
  );
}

// ↔ الكارت الموحّد لكل صفوف menu_items (نصف/كامل/طويلة/دائرية) —
// بيقرر شكل الصورة/الأيقونة والنص جوّاه حسب حقول الأدمن الجديدة
// (image_url/image_size/image_fit/text_layout) بدل ما تكون المعاملة
// مربوطة بـ size الكارت نفسه زي قبل كده. أي كارت من غير صورة مخصّصة
// (imageUrl فاضي) وbelow/medium/contain (كلهم افتراضيين) بيتصرف بالظبط
// زي الأيقونة الجاهزة القديمة — صفر تغيير بصري للكروت اللي محدش عدّلها.
function Card({
  item, onPress, flex, small, shape = "rect", minHeight, iconBoxHeight = 56,
}: {
  item: MenuItem; onPress: () => void; flex?: boolean; small?: boolean;
  shape?: "rect" | "circle"; minHeight?: number; iconBoxHeight?: number;
}) {
  const { t } = useLanguage();
  const textColor = textColorFor(item.color);
  const subtitleColor = textColor === "#ffffff" ? "rgba(255,255,255,0.85)" : "rgba(31,41,55,0.75)";
  // ↔ "شكل خط العنوان" فى الأدمن (حجم/سُمك/لون مخصّص) — لأول مرة بيتطبّق
  // فعليًا هنا. undefined (مش null) للحقول المتروكة "تلقائي" عشان
  // تفضل وارثة نفس الحجم/الوزن الافتراضي من styles.cardTitle زي الأول.
  const titleFontStyle = {
    fontSize: item.fontSize ?? undefined,
    fontWeight: item.fontBold ? ("900" as const) : undefined,
    ...(item.fontColor ? { color: item.fontColor } : {}),
  };

  const isCustomImage = !!item.imageUrl;
  const legacyImage = menuCardImageSource(item.iconKey); // بند من الأيقونات المضمّنة القديمة (search_building.png إلخ)
  const customSource = isCustomImage ? { uri: cldOptimized(item.imageUrl as string, "w_800,q_auto,f_auto") } : null;
  const bgSource = customSource ?? legacyImage; // أي "صورة" — مرفوعة أو مضمّنة — تصلح كخلفية كاملة للكارت

  function smallMedia(height: number) {
    if (customSource) {
      return (
        <Image
          source={customSource}
          style={{ height, width: item.imageSize === "full" ? "100%" : height, borderRadius: 8 }}
          contentFit={item.imageFit}
          transition={150}
        />
      );
    }
    // الأيقونة الجاهزة (icon_key) — مش خاضعة لـ image_size/image_fit،
    // زي بالظبط قبل الميزة دي، لأنها مش صورة مرفوعة أصلاً.
    return <MenuCardIcon iconKey={item.iconKey} height={height} color={textColor} />;
  }

  // كارت بزرار CTA جانبي (بند "لوازم السباكة والكهرباء" مثلاً): دايمًا
  // معاملة "صورة/أيقونة جنب النص" بغض النظر عن text_layout المختار —
  // overlay/hidden مالهومش معنى مع شكل صف جنبي زي ده.
  if (item.ctaLabel) {
    const mediaHeight = iconBoxHeight * (MEDIA_SIZE_SCALE[item.imageSize] ?? 1);
    return (
      <Pressable style={[styles.card, styles.ctaCard, { backgroundColor: item.color }, flex && { flex: 1 }]} onPress={onPress}>
        {smallMedia(mediaHeight)}
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.cardTitle, { color: textColor }, titleFontStyle]}>{t(item.title)}</Text>
          {!!item.subtitle && <Text style={[styles.cardSubtitle, { color: subtitleColor }]}>{t(item.subtitle)}</Text>}
        </View>
        <View style={styles.ctaPill}>
          <Text style={styles.ctaPillText}>{t(item.ctaLabel)}</Text>
        </View>
      </Pressable>
    );
  }

  // overlay/hidden من غير أي صورة (لا مرفوعة ولا مضمّنة) مالهومش معنى
  // بصري — رجوع آمن لمعاملة "below" بدل كارت فاضي.
  const layout = (item.textLayout === "overlay" || item.textLayout === "hidden") && !bgSource ? "below" : item.textLayout;
  const containerBase = [
    styles.card,
    shape === "circle" && styles.roundCard,
    { backgroundColor: item.color },
    flex && { flex: 1 },
    minHeight ? { minHeight } : null,
  ];

  if (layout === "hidden") {
    const pad = MEDIA_PAD[item.imageSize] ?? 14;
    return (
      <Pressable style={[...containerBase, { padding: 0, overflow: "hidden" }]} onPress={onPress}>
        <Image
          source={bgSource!}
          style={{ position: "absolute", top: pad, left: pad, right: pad, bottom: pad, borderRadius: shape === "circle" ? 999 : 12 }}
          contentFit={item.imageFit}
          transition={150}
        />
      </Pressable>
    );
  }

  if (layout === "overlay") {
    const pad = MEDIA_PAD[item.imageSize] ?? 14;
    // ↔ التدرّج اللوني كان مثبَّت دايمًا "غامق تحت" لأن النص كان دايمًا
    // فى الأسفل قبل الإصلاح ده. دلوقتي النص ممكن يكون فوق أو فى النص،
    // فلازم التدرّج يغمّق الحتة اللي النص واقف فيها فعليًا عشان يفضل
    // مقروء بوضوح فوق أي صورة.
    const gradient =
      item.textVAlign === "top"
        ? { colors: ["rgba(0,0,0,0.75)", "transparent"] as const, locations: [0, 0.65] as const }
        : item.textVAlign === "middle"
          ? { colors: ["rgba(0,0,0,0.45)", "rgba(0,0,0,0.45)"] as const, locations: [0, 1] as const }
          : { colors: ["transparent", "rgba(0,0,0,0.75)"] as const, locations: [0.35, 1] as const };
    return (
      <Pressable
        style={[...containerBase, { padding: 0, overflow: "hidden", justifyContent: vAlignToJustify(item.textVAlign) }]}
        onPress={onPress}
      >
        <Image
          source={bgSource!}
          style={{ position: "absolute", top: pad, left: pad, right: pad, bottom: pad, borderRadius: 12 }}
          contentFit={item.imageFit}
          transition={150}
        />
        <LinearGradient
          colors={gradient.colors}
          locations={gradient.locations}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={styles.overlayTextBox}>
          <Text style={[styles.cardTitle, { color: "#ffffff", textAlign: item.textHAlign }, titleFontStyle]}>{t(item.title)}</Text>
          {!!item.subtitle && (
            <Text style={[styles.cardSubtitle, { color: "rgba(255,255,255,0.85)", textAlign: item.textHAlign }]}>
              {t(item.subtitle)}
            </Text>
          )}
        </View>
      </Pressable>
    );
  }

  if (layout === "above") {
    return (
      <Pressable style={[...containerBase, { paddingTop: 18, paddingBottom: 12, overflow: "hidden", justifyContent: "flex-start" }]} onPress={onPress}>
        <Text style={[styles.cardTitle, { color: textColor }, titleFontStyle]}>{t(item.title)}</Text>
        {!!item.subtitle && <Text style={[styles.cardSubtitle, { color: subtitleColor }]}>{t(item.subtitle)}</Text>}
        {!!bgSource && <Image source={bgSource} style={styles.aboveImage} contentFit={item.imageFit} transition={150} />}
      </Pressable>
    );
  }

  // ↔ فرع "beside" (الصورة بجانب النص) كان ناقص بالكامل قبل الإصلاح ده
  // — أي كارت مُختار له اللي أوت ده كان بيقع تلقائيًا لحالة "below"
  // الافتراضية من غير أي تحذير، فاختيار الأدمن كان بيتجاهَل تمامًا.
  if (layout === "beside") {
    const mediaHeight = iconBoxHeight * (MEDIA_SIZE_SCALE[item.imageSize] ?? 1);
    const textBlock = (
      <View key="text" style={[styles.besideTextBlock, { justifyContent: vAlignToJustify(item.textVAlign) }]}>
        <Text style={[styles.cardTitle, { color: textColor, textAlign: item.textHAlign }, titleFontStyle]}>{t(item.title)}</Text>
        {!!item.subtitle && (
          <Text style={[styles.cardSubtitle, { color: subtitleColor, textAlign: item.textHAlign }]}>{t(item.subtitle)}</Text>
        )}
      </View>
    );
    const mediaBlock = <View key="media">{smallMedia(mediaHeight)}</View>;
    return (
      <Pressable style={[...containerBase, styles.besideCard, { flexDirection: FIXED_ROW }]} onPress={onPress}>
        {item.imageSide === "left" ? [mediaBlock, textBlock] : [textBlock, mediaBlock]}
      </Pressable>
    );
  }

  // layout === "below" (الافتراضي) — صورة/أيقونة فوق، النص تحتها.
  const mediaHeight = iconBoxHeight * (MEDIA_SIZE_SCALE[item.imageSize] ?? 1);
  return (
    <Pressable style={[...containerBase, small && styles.cardSmall]} onPress={onPress}>
      {smallMedia(mediaHeight)}
      <View style={{ marginTop: 8 }}>
        <Text
          style={[
            styles.cardTitle,
            { color: textColor },
            (small || shape === "circle") && styles.cardTitleSmall,
            shape === "circle" && styles.roundCardTitle,
            titleFontStyle,
          ]}
          numberOfLines={shape === "circle" ? 1 : undefined}
        >
          {t(item.title)}
        </Text>
        {!!item.subtitle && <Text style={[styles.cardSubtitle, { color: subtitleColor }]}>{t(item.subtitle)}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 14, gap: 12, paddingBottom: 110 },
  row: { flexDirection: "row", gap: 10 },
  card: { borderRadius: 16, padding: 16, minHeight: 100, justifyContent: "center" },
  cardSmall: { minHeight: 64, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontWeight: "900", fontSize: 15 },
  cardTitleSmall: { fontSize: 13, textAlign: "center" },
  cardSubtitle: { fontSize: 11.5, marginTop: 3 },
  ctaCard: { flexDirection: "row", alignItems: "center", minHeight: 88 },
  ctaPill: { backgroundColor: "#F2B23D", borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 },
  ctaPillText: { color: "#1f2937", fontWeight: "900", fontSize: 12.5 },
  // ↔ استخدام لـ text_layout === "above" (زي كارت "ابحث عن عقار" الطويل
  // الأصلي بالظبط) — النص فى الأعلى بترتيب flex عادي، والصورة بعده بتاخد
  // الباقي من المساحة (flex:1).
  aboveImage: { flex: 1, width: "100%", borderRadius: 12, marginTop: 10 },
  stackCol: { flex: 1, gap: 10 },
  roundCard: {
    width: 108, height: 108, borderRadius: 54, alignItems: "center", justifyContent: "center", gap: 6, overflow: "hidden",
  },
  roundCardTitle: { fontSize: 11.5, fontWeight: "900" },
  // ↔ استخدام لـ text_layout === "overlay" — صندوق النص فوق الصورة
  // (بعد التدرّج الغامق من LinearGradient) بدل النص جوه صندوق الكارت
  // العادي، عشان يبان واضح فوق أي صورة.
  overlayTextBox: { padding: 14 },
  besideCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  besideTextBlock: { flex: 1, gap: 2 },
  liveNowBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#111827", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 4,
  },
  liveNowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" },
  liveNowText: { flex: 1, color: "white", fontSize: 12, fontWeight: "800" },
  liveNowJoin: { color: "#22A652", fontSize: 12, fontWeight: "900" },
});