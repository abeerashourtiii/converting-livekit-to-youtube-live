import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ↔ يعكس بالظبط قيم app/(tabs)/_floating-tab-bar.tsx: `bottom: insets.bottom + 14`
// و`styles.pill`/`styles.searchCircle`'s `height: 32`. أي شاشة عندها محتوى
// عائم (position: absolute) قريب من أسفل الشاشة ولازم مايتغطّاش بشريط
// المهام العائم لازم تستخدم FLOATING_TAB_BAR_CLEARANCE بدل رقم ثابت
// عشوائي، عشان لو الشريط اتغيّر مقاسه فى مكان واحد يفضل الحساب هنا صح.
export const FLOATING_TAB_BAR_MARGIN = 14;
export const FLOATING_TAB_BAR_HEIGHT = 32;
export const FLOATING_TAB_BAR_CLEARANCE = FLOATING_TAB_BAR_MARGIN + FLOATING_TAB_BAR_HEIGHT;

// ↔ #2 (صفحة الريلز): الفجوة الصغيرة بين شريط الـ seek وأعلى شريط المهام
// العائم — بدونها الشريطين بيبانوا ملزّقين فى بعض من غير أي هامش.
export const REEL_SEEK_BAR_GAP = 8;

// ↔ إصلاح: كل كارت ريل لازم ياخد ارتفاع الشاشة الكامل بالظبط (fullscreen
// حقيقي زي تيك توك/ريلز) — مش ارتفاع مُنقّص. قبل كده كان useReelHeight()
// بينقص مساحة شريط المهام العائم من ارتفاع الكارت نفسه، فكان الـ FlatList
// (اللي بياخد كل مساحة الشاشة flex:1) بيسيب فراغ فاضي أسفل كل كارت بمقدار
// المساحة المنقوصة دي، والكارت اللي بعده كان يظهر جزء منه جوه الفراغ ده —
// يعني عند التنقل بين الريلز كان بيبان جزء من الريل التانى (فوق/تحت) جوه
// نفس الشاشة، والأيقونات بتاعته بتتداخل مع أيقونات الريل النشط. الحل:
// الكارت نفسه (وبالتالي عنصر الـ FlatList) بياخد ارتفاع الشاشة بالكامل —
// كده مفيش أي جزء من ريل تانى يبان أبدًا. عشان نسيب مساحة لشريط المهام
// العائم فوق الريل، العناصر التفاعلية السفلية بس (شريط الـ seek/أيقونات
// الجانب/كارت الوصف) هي اللي بتاخد padding/bottom إضافي — مش الكارت كله.
export function useReelHeight(): number {
  const { height } = useWindowDimensions();
  return height;
}

// ↔ المسافة اللي لازم تتحط bottom offset بيها لأي عنصر تفاعلي عائم جوه
// كارت الريل (شريط الـ seek بشكل مباشر) عشان يوقف فوق شريط المهام العائم
// بالظبط بمسافة REEL_SEEK_BAR_GAP، من غير ما يتغطّى أو يتلزّق بيه — ده
// اللي بيحقق الترتيب المطلوب من تحت لفوق: شريط المهام بتاع الهاتف، بعدين
// شريط المهام بتاع التطبيق، بعدين شريط الـ seek.
export function useReelControlsBottomOffset(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + FLOATING_TAB_BAR_CLEARANCE + REEL_SEEK_BAR_GAP;
}
