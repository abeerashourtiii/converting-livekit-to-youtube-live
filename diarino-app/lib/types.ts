// Field names match the mock `properties` array in app-viewer.html
// (line ~1252) so later screens (search/details/account) can reuse this
// without renaming. Fields unused by the reels feed are still included
// since search/details will need them next.

export type Seller = {
  id: string;
  name: string;
  initial: string;
  verified: boolean;
  listings: number;
  followers: number;
  bio: string;
  // ↔ الميزة الدولية لإدخال رقم الهاتف — E.164 كامل (مثل +201012345678)،
  // مش صيغة محلية. راجع lib/phone.ts للتحقق/التنسيق و
  // docs/PHONE_FEATURE_INTEGRATION_NOTES.md لتفاصيل الانتقال من الصيغة
  // المحلية المصرية القديمة.
  phone: string;
};

export type MediaItem = {
  type: "video" | "image";
  url: string;
};

export type Purpose = "sale" | "rent";

export type Property = {
  id: string;
  purpose: Purpose;
  type: string; // شقة / فيلا / بنتهاوس / تاون هاوس / تجاري / إداري / طبي / أرض
  title: string;
  shortTitle?: string;
  province: string;
  location: string;
  lat?: number;
  lng?: number;
  price: number;
  area: number;
  rooms: number;
  baths: number;
  reception: number;
  floor?: number;
  payment?: "cash" | "installment";
  negotiable?: boolean;
  finishType?: string;
  status?: "ready" | "building";
  deliveryDate?: string;
  features: string[];
  description: string;
  likes: number;
  saves: number;
  views: number;
  chats: number;
  createdAt: number;
  media: MediaItem[];
  coverImage: string | null;
  music: string | null;
  // ↔ الترجمة النصية (Captions) فى قايمة خيارات الريل — نص جاهز مُخزَّن
  // مسبقًا (مش مُترجَم تلقائيًا من التطبيق)، شوف الكومنت فى
  // supabase/migrations/20260904000000_reel_captions.sql. غالبية
  // الإعلانات لسه من غيرهم لحد ما يتضاف مصدر تفريغ صوتي/ترجمة حقيقي.
  captionsAr?: string | null;
  captionsEn?: string | null;
  likedByMe?: boolean;
  pinned?: boolean;
  pinnedAt?: number;
  // ↔ "وسّع انتشار إعلانك" — platforms the owner asked to also have this
  // listing reposted to (youtube/facebook/tiktok/instagram), reviewed
  // alongside the reel itself in the admin reels screen.
  sharePlatforms?: string[];
  seller: Seller;
};

export type ReelMode = "video" | "slideshow" | "none";

// ↔ getReelMode() in app-viewer.html
export function getReelMode(p: Property): ReelMode {
  if (!p.media || p.media.length === 0) return "none";
  const hasVideo = p.media.some((m) => m.type === "video");
  const hasImage = p.media.some((m) => m.type === "image");
  if (hasVideo) return "video";
  if (hasImage) return "slideshow";
  return "none";
}

// ↔ fmtPrice() in app-viewer.html
export function fmtPrice(n: number): string {
  return (n || 0).toLocaleString("en-US");
}

// ↔ AUDIT FIX (تاريخي): كان بيتحقق بس من الصيغة المحلية المصرية.
// @deprecated استُبدلت بالكامل بـ validateAndFormatPhone() في lib/phone.ts
// (تدعم كل الدول عبر libphonenumber-js). موجودة هنا بس علشان مفيش أي كود
// حالي بيستخدمها بعد الآن (صفر مستدعين — تم التأكد بفحص شامل)، فمحتفظ بيها
// كمرجع تاريخي بدل حذفها نهائيًا، تحسبًا لأي اعتماد خارجي مش ظاهر ليا.
export function isValidEgyptPhone(phone: string): boolean {
  return /^01[0125]\d{8}$/.test(phone.replace(/[\s-]/g, ""));
}
