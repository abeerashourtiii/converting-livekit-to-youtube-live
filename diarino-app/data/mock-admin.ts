export type ReelStatus = "pending" | "approved" | "rejected";
export type LiveStatus = "pending" | "approved";

export type AdminReel = {
  id: string; title: string; owner: string; views: number; likes: number; wa: number;
  status: ReelStatus; color: string; price: string; date: string;
  videoUrl: string | null; coverUrl: string | null; sharePlatforms: string[];
};
export type AdminLive = {
  id: string; title: string; host: string; duration: string; views: number;
  status: LiveStatus; color: string; date: string;
  // ↔ حالة البث الفعلية (live/ended) من عمود lives.status نفسه — مختلفة
  // عن status فوق (اللي هو moderation_status: pending/approved). لايف
  // "مباشر الآن" لسه شغال فعليًا، و"منتهي" يبقى تسجيل بعد ما خلص.
  broadcastStatus: "live" | "ended";
  // ↔ رابط التسجيل الفعلي (Egress → Cloudinary/Storage) وحالته —
  // كانا موجودين فى عمود lives.recording_url/recording_status من زمان
  // (20260720000000_add_recording_columns.sql) لكن لوحة تحكم الأدمن
  // (AdminLives.tsx) كانت أصلاً مش بتجيبهم من قاعدة البيانات، فمكانش
  // فيه أي طريقة يشوف بيها الأدمن التسجيل حتى لو جاهز.
  recordingUrl: string | null;
  recordingStatus: "none" | "recording" | "processing" | "ready" | "failed";
};
export type AdminReport = {
  id: string; target: string; targetId: string; targetColor: string;
  reason: string; reporter: string; count: number; date: string; targetType: string;
};
export type AdminUser = {
  id: string; name: string; reels: number; views: number; active: boolean;
  perms: { publishReels: boolean; live: boolean; paidAds: boolean; directWa: boolean };
};
export type AdminFeature = { key: string; name: string; desc: string; on: boolean };
export type CityStat = { city: string; ads: number; views: number; wa: number; rate: string };

// ↔ seed() in admin-viewer.html — same generation logic/ranges.
export function seedAdminDB() {
  const covers = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#0ea5e9", "#8b5cf6", "#ef4444", "#14b8a6"];
  const cities = ["الرياض", "جدة", "الدمام", "مكة", "المدينة", "الخبر", "أبها", "تبوك"];
  const owners = ["أحمد الفهد", "سارة القحطاني", "خالد العتيبي", "نورة السالم", "فهد الحربي", "ريم الشمري", "عبدالله الغامدي", "مها الزهراني"];
  const types = ["شقة", "فيلا", "دور", "أرض", "استراحة", "مكتب"];

  const reels: AdminReel[] = Array.from({ length: 24 }, (_, i) => ({
    id: "r" + (i + 1),
    title: types[i % types.length] + " في " + cities[i % cities.length] + " - " + (3 + (i % 5)) + " غرف",
    owner: owners[i % owners.length],
    views: Math.floor(500 + Math.random() * 45000),
    likes: Math.floor(20 + Math.random() * 3000),
    wa: Math.floor(5 + Math.random() * 450),
    status: (["pending", "approved", "approved", "approved", "rejected"] as ReelStatus[])[i % 5],
    color: covers[i % covers.length],
    price: (200 + Math.floor(Math.random() * 1800)) + ",000 ر.س",
    date: new Date(Date.now() - i * 86400000 * Math.floor(1 + Math.random() * 3)).toISOString().slice(0, 10),
    videoUrl: null,
    coverUrl: null,
    sharePlatforms: [],
  }));

  const lives: AdminLive[] = Array.from({ length: 8 }, (_, i) => ({
    id: "l" + (i + 1),
    title: "جولة مباشرة - " + cities[i % cities.length],
    host: owners[(i + 2) % owners.length],
    duration: (15 + Math.floor(Math.random() * 60)) + " دقيقة",
    views: Math.floor(1000 + Math.random() * 20000),
    status: i % 4 === 0 ? "pending" : "approved",
    // ↔ بيانات وهمية للتطوير المحلي فقط (غير مستخدمة فى الإنتاج، اللي
    // بيقرا من useAdminDB.ts الحقيقي) — أغلب العناصر "ended" (تسجيل)
    // وواحد بس "live" (جاري الآن) عشان شارة "مباشر الآن" فى AdminLives.tsx
    // يكون فيه حاجة تجربها وهي شغالة محليًا.
    broadcastStatus: i === 0 ? "live" : "ended",
    color: covers[(i + 3) % covers.length],
    date: new Date(Date.now() - i * 86400000 * 2).toISOString().slice(0, 10),
    // ↔ بيانات وهمية للتطوير المحلي: أغلب التسجيلات "جاهزة" (ready) —
    // من غير رابط فيديو حقيقي (مفيش تسجيلات فعلية محليًا)، بس كده زرار
    // "مشاهدة التسجيل" فى AdminLives.tsx بيظهر ويتفعل صح فى التطوير،
    // وواحد "processing" عشان تتفحص حالة "لسه بيتجهز" برضه.
    recordingUrl: null,
    recordingStatus: i === 0 ? "none" : i === 1 ? "processing" : "ready",
  }));

  const reasons = ["محتوى مضلل", "سعر غير حقيقي", "صور غير مطابقة", "إساءة", "تكرار نشر", "معلومات كاذبة"];
  const reports: AdminReport[] = Array.from({ length: 10 }, (_, i) => ({
    id: "rp" + (i + 1),
    target: reels[i % reels.length].title,
    targetId: reels[i % reels.length].id,
    targetColor: reels[i % reels.length].color,
    reason: reasons[i % reasons.length],
    reporter: owners[(i + 4) % owners.length],
    count: 1 + Math.floor(Math.random() * 8),
    date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
    targetType: "property",
  }));

  const users: AdminUser[] = owners.map((n, i) => ({
    id: "u" + (i + 1), name: n,
    reels: Math.floor(3 + Math.random() * 25),
    views: Math.floor(2000 + Math.random() * 80000),
    active: i !== 5,
    perms: { publishReels: true, live: i !== 3, paidAds: i % 2 === 0, directWa: true },
  }));

  const features: AdminFeature[] = [
    { key: "reels", name: "الريلز العقارية", desc: "تفعيل عرض الريلز في الصفحة الرئيسية", on: true },
    { key: "live", name: "البث المباشر", desc: "السماح للمستخدمين ببث مباشر", on: true },
    { key: "stories", name: "القصص اليومية", desc: "ميزة القصص لمدة 24 ساعة", on: true },
    { key: "ads", name: "الإعلانات المدفوعة", desc: "شراء ترويج للإعلانات", on: true },
    { key: "wa", name: "زر واتساب المباشر", desc: "تواصل مباشر مع صاحب العقار", on: true },
    { key: "comments", name: "التعليقات", desc: "السماح بالتعليق على الريلز", on: true },
    { key: "saved", name: "المحفوظات", desc: "حفظ الإعلانات المفضلة", on: true },
    { key: "ai", name: "المساعد الذكي", desc: "اقتراحات AI للعقارات المناسبة", on: false },
  ];

  const cityStats: CityStat[] = cities.map((c) => {
    const ads = Math.floor(50 + Math.random() * 400);
    const views = Math.floor(5000 + Math.random() * 80000);
    const wa = Math.floor(80 + Math.random() * 1200);
    return { city: c, ads, views, wa, rate: ((wa / views) * 100).toFixed(1) + "%" };
  });

  return { reels, lives, reports, users, features, cityStats };
}
