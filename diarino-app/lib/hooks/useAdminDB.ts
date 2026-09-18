import { useSyncExternalStore } from "react";
import { supabase } from "../supabase";
import { MediaItem } from "../types";
import {
  AdminReel, AdminLive, AdminReport, AdminUser, AdminFeature, CityStat, ReelStatus, LiveStatus,
} from "../../data/mock-admin";

// ↔ replaces the local-only mock DB (seedAdminDB() + AsyncStorage
// persistence) with the real tables added in
// 20260801000000_admin_backend.sql. Same useSyncExternalStore +
// module-level store shape as before (so every admin screen that already
// calls `useAdminDB()` and the standalone setters keeps working
// unchanged) — only the fetch/mutate implementations underneath are new.

type AdminAnalyticsData = {
  totalViews: number;
  totalWaClicks: number;
  listingsThisMonth: number;
  conversionRate: string;
  dailyListings: number[]; // last 7 days, oldest first
  dailySignups: number[]; // last 7 days, oldest first
  typeDistribution: { label: string; value: number }[];
};

type AdminDB = {
  reels: AdminReel[]; lives: AdminLive[]; reports: AdminReport[];
  users: AdminUser[]; features: AdminFeature[]; cityStats: CityStat[]; analytics: AdminAnalyticsData;
};

const EMPTY_ANALYTICS: AdminAnalyticsData = {
  totalViews: 0, totalWaClicks: 0, listingsThisMonth: 0, conversionRate: "0.0%",
  dailyListings: [0, 0, 0, 0, 0, 0, 0], dailySignups: [0, 0, 0, 0, 0, 0, 0], typeDistribution: [],
};

const EMPTY_DB: AdminDB = { reels: [], lives: [], reports: [], users: [], features: [], cityStats: [], analytics: EMPTY_ANALYTICS };

let db: AdminDB = EMPTY_DB;
let snapshot = db;
let loaded = false;
let sellerAgg = new Map<string, { reels: number; views: number }>();
const listeners = new Set<() => void>();

function syncSnapshot() {
  snapshot = db;
}
function emit() {
  syncSnapshot();
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot() {
  return snapshot;
}

export function isAdminDBLoaded() {
  return loaded;
}

// Deterministic pseudo-color per row (mock data used a random palette
// index; a hash keeps the same id always rendering the same color instead
// of reshuffling on every refetch).
const COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#0ea5e9", "#8b5cf6", "#ef4444", "#14b8a6"];
function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

// ---------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------

type PropertyRow = {
  id: string; title: string; type: string; province: string; price: number; views: number; likes: number;
  wa_clicks: number; moderation_status: ReelStatus; created_at: string; seller_id: string;
  media: MediaItem[]; cover_image: string | null; share_platforms: string[] | null;
  profiles: { full_name: string | null } | null;
};

// Last 7 calendar days (oldest first), used to bucket created_at
// timestamps into a real daily count instead of a hardcoded array.
function last7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

async function fetchReelsAndCityStats(): Promise<{ reels: AdminReel[]; cityStats: CityStat[]; analyticsBase: Pick<AdminAnalyticsData, "totalViews" | "totalWaClicks" | "listingsThisMonth" | "conversionRate" | "dailyListings" | "typeDistribution"> }> {
  const { data, error } = await supabase
    .from("properties")
    .select("id, title, type, province, price, views, likes, wa_clicks, moderation_status, created_at, seller_id, media, cover_image, share_platforms, profiles!properties_seller_profile_fkey(full_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data as unknown as PropertyRow[]) ?? [];

  const reels: AdminReel[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    owner: r.profiles?.full_name || "مستخدم ديارينو",
    views: r.views ?? 0,
    likes: r.likes ?? 0,
    wa: r.wa_clicks ?? 0,
    status: r.moderation_status,
    color: colorFor(r.id),
    price: `${Number(r.price).toLocaleString("ar-EG")} ر.س`,
    date: r.created_at.slice(0, 10),
    videoUrl: r.media?.find((m) => m.type === "video")?.url ?? null,
    coverUrl: r.cover_image ?? r.media?.find((m) => m.type === "image")?.url ?? null,
    sharePlatforms: r.share_platforms || [],
  }));

  const byCity = new Map<string, { ads: number; views: number; wa: number }>();
  const bySeller = new Map<string, { reels: number; views: number }>();
  const byType = new Map<string, number>();
  const days = last7Days();
  const dailyListingsMap = new Map(days.map((d) => [d, 0]));
  let totalViews = 0, totalWaClicks = 0, listingsThisMonth = 0;
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  for (const r of rows) {
    const c = byCity.get(r.province) || { ads: 0, views: 0, wa: 0 };
    c.ads += 1; c.views += r.views ?? 0; c.wa += r.wa_clicks ?? 0;
    byCity.set(r.province, c);

    const u = bySeller.get(r.seller_id) || { reels: 0, views: 0 };
    u.reels += 1; u.views += r.views ?? 0;
    bySeller.set(r.seller_id, u);

    totalViews += r.views ?? 0;
    totalWaClicks += r.wa_clicks ?? 0;
    byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
    const createdDay = r.created_at.slice(0, 10);
    if (createdDay >= monthStart) listingsThisMonth += 1;
    if (dailyListingsMap.has(createdDay)) dailyListingsMap.set(createdDay, (dailyListingsMap.get(createdDay) ?? 0) + 1);
  }
  sellerAgg = bySeller;

  const cityStats: CityStat[] = Array.from(byCity.entries())
    .map(([city, s]) => ({
      city, ads: s.ads, views: s.views, wa: s.wa,
      rate: s.views > 0 ? ((s.wa / s.views) * 100).toFixed(1) + "%" : "0.0%",
    }))
    .sort((a, b) => b.ads - a.ads);

  return {
    reels, cityStats,
    analyticsBase: {
      totalViews, totalWaClicks, listingsThisMonth,
      conversionRate: totalViews > 0 ? ((totalWaClicks / totalViews) * 100).toFixed(1) + "%" : "0.0%",
      dailyListings: days.map((d) => dailyListingsMap.get(d) ?? 0),
      typeDistribution: Array.from(byType.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    },
  };
}

type LiveRow = {
  id: string; title: string | null; duration_sec: number | null; status: "live" | "ended";
  viewer_peak: number; moderation_status: LiveStatus; created_at: string;
  recording_url: string | null; recording_status: "none" | "recording" | "processing" | "ready" | "failed";
  profiles: { full_name: string | null } | null;
};

// ↔ إصلاح فجوة إدارية حقيقية: الاستعلام كان بيجيب اللايفات المنتهية بس
// (status = 'ended')، يعني أي بث مباشر لسه شغال فعليًا (status = 'live')
// كان غير مرئي للأدمن خالص — مش يقدر يشوفه ولا يقدر يحذفه. دلوقتي بنجيب
// الاثنين مع بعض، وbroadcastStatus بيوضّح فى الواجهة أيهما لسه على الهواء.
//
// ↔ recording_url/recording_status: عمودين موجودين فى lives من زمان
// (20260720000000_add_recording_columns.sql) وRLS بالفعل بتسمح للأدمن
// يقراهم (20260822000000_rls_audit_fixes.sql: "... or
// public.admin_has_permission('lives')") — بس الاستعلام هنا مكانش أصلاً
// بيطلبهم من قاعدة البيانات، فمكانش فيه أي طريقة الأدمن يشوف بيها
// التسجيل حتى لو كان جاهز فعلاً. دلوقتي بيتجابوا وبينضموا للنتيجة.
async function fetchLives(): Promise<AdminLive[]> {
  const { data, error } = await supabase
    .from("lives")
    .select("id, title, duration_sec, status, viewer_peak, moderation_status, created_at, recording_url, recording_status, profiles!lives_host_profile_fkey(full_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data as unknown as LiveRow[]) ?? []).map((l) => ({
    id: l.id,
    title: l.title || "بث مباشر",
    host: l.profiles?.full_name || "مستخدم ديارينو",
    duration: `${Math.max(1, Math.round((l.duration_sec ?? 0) / 60))} دقيقة`,
    views: l.viewer_peak ?? 0,
    status: l.moderation_status,
    broadcastStatus: l.status,
    color: colorFor(l.id),
    date: l.created_at.slice(0, 10),
    recordingUrl: l.recording_url,
    recordingStatus: l.recording_status ?? "none",
  }));
}

type ReportRow = {
  id: string; target_type: string; target_id: string; target_title: string; target_color: string;
  reason: string; created_at: string;
  profiles: { full_name: string | null } | null;
};

async function fetchReports(): Promise<AdminReport[]> {
  const { data, error } = await supabase
    .from("reports")
    .select("id, target_type, target_id, target_title, target_color, reason, created_at, profiles!reports_reporter_profile_fkey(full_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  // Several reports on the same content collapse into one row with a
  // count, same shape the mock data used ("count = N بلاغ").
  const grouped = new Map<string, AdminReport>();
  for (const r of (data as unknown as ReportRow[]) ?? []) {
    const key = `${r.target_type}:${r.target_id}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(key, {
        id: r.id,
        target: r.target_title,
        targetId: r.target_id,
        targetColor: r.target_color,
        reason: r.reason,
        reporter: r.profiles?.full_name || "مستخدم",
        count: 1,
        date: r.created_at.slice(0, 10),
        targetType: r.target_type,
      });
    }
  }
  return Array.from(grouped.values());
}

type ProfileRow = { id: string; full_name: string | null };
type PermRow = {
  user_id: string; active: boolean; publish_reels: boolean; live: boolean; paid_ads: boolean; direct_wa: boolean;
};

async function fetchUsers(): Promise<AdminUser[]> {
  const [{ data: profiles, error: pErr }, { data: perms, error: permErr }] = await Promise.all([
    supabase.from("profiles").select("id, full_name"),
    supabase.from("user_permissions").select("user_id, active, publish_reels, live, paid_ads, direct_wa"),
  ]);
  if (pErr) throw pErr;
  if (permErr) throw permErr;

  const permByUser = new Map((perms as unknown as PermRow[] ?? []).map((p) => [p.user_id, p]));

  return ((profiles as unknown as ProfileRow[]) ?? []).map((p) => {
    const perm = permByUser.get(p.id);
    const agg = sellerAgg.get(p.id) || { reels: 0, views: 0 };
    return {
      id: p.id,
      name: p.full_name || "مستخدم ديارينو",
      reels: agg.reels,
      views: agg.views,
      active: perm?.active ?? true,
      perms: {
        publishReels: perm?.publish_reels ?? true,
        live: perm?.live ?? true,
        paidAds: perm?.paid_ads ?? true,
        directWa: perm?.direct_wa ?? true,
      },
    };
  });
}

type FeatureRow = { key: string; name: string; description: string; enabled: boolean };

async function fetchFeatures(): Promise<AdminFeature[]> {
  const { data, error } = await supabase.from("feature_flags").select("key, name, description, enabled").order("key");
  if (error) throw error;
  return ((data as unknown as FeatureRow[]) ?? []).map((f) => ({
    key: f.key, name: f.name, desc: f.description, on: f.enabled,
  }));
}

async function fetchDailySignups(): Promise<number[]> {
  const days = last7Days();
  const { data, error } = await supabase.from("profiles").select("created_at").gte("created_at", days[0]);
  if (error) throw error;
  const map = new Map(days.map((d) => [d, 0]));
  for (const row of (data ?? []) as { created_at: string }[]) {
    const day = row.created_at.slice(0, 10);
    if (map.has(day)) map.set(day, (map.get(day) ?? 0) + 1);
  }
  return days.map((d) => map.get(d) ?? 0);
}

async function refetchAll() {
  try {
    // Runs first (not in the Promise.all below) because it populates the
    // module-level sellerAgg map that fetchUsers() reads from.
    const { reels, cityStats, analyticsBase } = await fetchReelsAndCityStats();
    const [lives, reports, users, features, dailySignups] = await Promise.all([
      fetchLives(), fetchReports(), fetchUsers(), fetchFeatures(), fetchDailySignups(),
    ]);
    db = { reels, lives, reports, users, features, cityStats, analytics: { ...analyticsBase, dailySignups } };
  } catch (err) {
    console.warn("Failed to load admin dashboard data:", err);
  } finally {
    loaded = true;
    emit();
  }
}

refetchAll();

// ↔ called from signOut() (lib/hooks/useAuth.ts) — db/sellerAgg are
// module-level, not React Query, so they survive a sign-out on their own
// otherwise (see lib/queryClient.ts's header comment for the full
// reasoning). Resetting to EMPTY_DB rather than leaving stale admin data
// resident in memory for whoever uses the app next on this device.
export function resetAdminDB() {
  db = EMPTY_DB;
  loaded = false;
  sellerAgg = new Map();
  emit();
}

// ---------------------------------------------------------------------
// Mutations — same function signatures as the old mock-DB version, now
// backed by real writes + a full refetch so every admin screen (and every
// admin viewing at once) stays in sync.
// ---------------------------------------------------------------------

// ↔ setReel()
export async function setReelStatus(id: string, status: ReelStatus) {
  const { error } = await supabase.from("properties").update({ moderation_status: status }).eq("id", id);
  if (error) { console.warn("setReelStatus failed:", error); return; }
  await refetchAll();
}
// ↔ delReel()
export async function deleteReel(id: string) {
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) { console.warn("deleteReel failed:", error); return; }
  await refetchAll();
}
// ↔ setLive()
export async function setLiveStatus(id: string, status: LiveStatus) {
  const { error } = await supabase.from("lives").update({ moderation_status: status }).eq("id", id);
  if (error) { console.warn("setLiveStatus failed:", error); return; }
  await refetchAll();
}
// ↔ delLive()
export async function deleteLive(id: string) {
  const { error } = await supabase.from("lives").delete().eq("id", id);
  if (error) { console.warn("deleteLive failed:", error); return; }
  await refetchAll();
}
// ↔ "حذف المحتوى" in the support center's reports tab, for a
// target_type = 'request' report — requests never had an admin delete
// path before 20260815000000_support_center.sql added one.
export async function deleteRequest(id: string) {
  const { error } = await supabase.from("requests").delete().eq("id", id);
  if (error) { console.warn("deleteRequest failed:", error); return; }
}
// ↔ the reports page's implicit "resolve" action (dismiss after action taken)
export async function resolveReport(id: string) {
  const { error } = await supabase.from("reports").delete().eq("id", id);
  if (error) { console.warn("resolveReport failed:", error); return; }
  await refetchAll();
}
export async function toggleUserActive(id: string) {
  const current = db.users.find((u) => u.id === id);
  const { error } = await supabase
    .from("user_permissions")
    .upsert({ user_id: id, active: !(current?.active ?? true) }, { onConflict: "user_id" });
  if (error) { console.warn("toggleUserActive failed:", error); return; }
  await refetchAll();
}
export async function toggleUserPerm(id: string, perm: keyof AdminUser["perms"]) {
  const current = db.users.find((u) => u.id === id);
  const newValue = !(current?.perms[perm] ?? true);

  const payload: {
    user_id: string;
    publish_reels?: boolean;
    live?: boolean;
    paid_ads?: boolean;
    direct_wa?: boolean;
  } = { user_id: id };

  if (perm === "publishReels") payload.publish_reels = newValue;
  if (perm === "live") payload.live = newValue;
  if (perm === "paidAds") payload.paid_ads = newValue;
  if (perm === "directWa") payload.direct_wa = newValue;

  const { error } = await supabase
    .from("user_permissions")
    .upsert(payload, { onConflict: "user_id" });

  if (error) { console.warn("toggleUserPerm failed:", error); return; }
  await refetchAll();
}
export async function toggleFeature(key: string) {
  const current = db.features.find((f) => f.key === key);
  const { error } = await supabase.from("feature_flags").update({ enabled: !(current?.on ?? true) }).eq("key", key);
  if (error) { console.warn("toggleFeature failed:", error); return; }
  await refetchAll();
}

export function useAdminDB() {
  return useSyncExternalStore(subscribe, getSnapshot);
}