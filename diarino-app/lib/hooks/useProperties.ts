import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { Property, MediaItem, Purpose } from "../types";
import { properties as demoProperties } from "../../data/mock-properties";
import { PROVINCES } from "../../data/locations";
import { Database, Json } from "../../src/types/supabase";

type ProfileRowPublic = { id: string; full_name: string | null; avatar_url: string | null; verified: boolean };

type PropertyRowBase = {
  id: string; seller_id: string; purpose: Purpose; type: string; title: string; short_title: string | null;
  province: string; location: string; lat: number | null; lng: number | null; price: number; area: number;
  rooms: number; baths: number; reception: number; floor: number | null; payment: string | null;
  negotiable: boolean | null; finish_type: string | null; status: string | null; delivery_date: string | null;
  features: string[]; description: string; media: MediaItem[]; cover_image: string | null; music: string | null;
  captions_ar: string | null; captions_en: string | null;
  pinned: boolean; pinned_at: string | null; likes: number; saves: number; views: number; chats: number;
  created_at: string; share_platforms: string[] | null;
};
type PropertyRow = PropertyRowBase & { profiles: ProfileRowPublic | null };

// ↔ profile هنا دايمًا من profiles_public دلوقتي (سواء الكارت أو صفحة
// التفاصيل) — من غير phone_e164/bio عن قصد (PII)، شوف الكومنت فوق
// SELECT_DETAIL. رقم الهاتف بييجي بشكل منفصل عبر useSellerContactPhone.
function rowToProperty(row: PropertyRow): Property {
  const profile = row.profiles;
  return {
    id: row.id,
    purpose: row.purpose,
    type: row.type,
    title: row.title,
    shortTitle: row.short_title ?? undefined,
    province: row.province,
    location: row.location,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    price: Number(row.price),
    area: Number(row.area),
    rooms: row.rooms,
    baths: row.baths,
    reception: row.reception,
    floor: row.floor ?? undefined,
    payment: (row.payment as "cash" | "installment") ?? undefined,
    negotiable: row.negotiable ?? undefined,
    finishType: row.finish_type ?? undefined,
    status: (row.status as "ready" | "building") ?? undefined,
    deliveryDate: row.delivery_date ?? undefined,
    features: row.features || [],
    description: row.description || "",
    media: row.media || [],
    coverImage: row.cover_image,
    music: row.music,
    captionsAr: row.captions_ar,
    captionsEn: row.captions_en,
    pinned: row.pinned,
    pinnedAt: row.pinned_at ? new Date(row.pinned_at).getTime() : undefined,
    sharePlatforms: row.share_platforms || [],
    likes: row.likes, saves: row.saves, views: row.views, chats: row.chats,
    createdAt: new Date(row.created_at).getTime(),
    seller: {
      id: row.seller_id,
      name: profile?.full_name || "مستخدم ديارينو",
      initial: (profile?.full_name || "د").charAt(0),
      verified: profile?.verified || false,
      listings: 0,
      followers: 0,
      // ↔ لا bio ولا phone_e164 فى profiles_public عن قصد (PII، شوف
      // الكومنت فوق SELECT_DETAIL) — رقم الهاتف الفعلى بييجي منفصل عبر
      // useSellerContactPhone عند الحاجة له فعليًا (شريط CTA).
      bio: "",
      phone: "",
    },
  };
}

const SELECT = "*, profiles_public!seller_id(id, full_name, avatar_url, verified)";
// ↔ BUG FIX (الشاشة البيضاء فى تفاصيل العقار): كانت هذه تقرأ من
// public.profiles مباشرة (الجدول الحقيقى المقيّد بسياسة RLS بعد
// 20260825000000_profile_privacy_rls.sql — لا يظهر إلا لصاحب الحساب
// نفسه، أو لو is_public=true، أو لطرف محادثة معه، أو للأدمن). أى زائر
// يفتح تفاصيل عقار لبائع عادى (وهو الغالبية) كانت بيانات profiles
// المرتبطة (الاسم، التوثيق...) ترجع محجوبة. كل نقاط القراءة الأخرى فى
// المشروع كانت اتصلحت لاستخدام profiles_public!fkey (الفيو العام الآمن)
// فى نفس الميجريشن، وهذه النقطة فقط كانت ناقصة. رقم الهاتف نفسه (PII)
// مش موجود أصلًا فى profiles_public عن قصد — بيتجاب دلوقتي بشكل منفصل
// وآمن عبر get_property_contact_phone() (شوف useSellerContactPhone تحت
// وميجريشن 20260901000000_property_contact_phone.sql).
const SELECT_DETAIL = "*, profiles_public!seller_id(id, full_name, avatar_url, verified)";

async function fetchProperties(): Promise<Property[]> {
  const { data, error } = await supabase.from("properties").select(SELECT).order("created_at", { ascending: false }).limit(300);
  if (error) throw error;
  return (data as unknown as PropertyRow[]).map(rowToProperty);
}

async function fetchPropertiesBySeller(sellerId: string): Promise<Property[]> {
  const { data, error } = await supabase.from("properties").select(SELECT).eq("seller_id", sellerId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as PropertyRow[]).map(rowToProperty);
}

async function fetchPropertyDetail(id: string): Promise<Property | null> {
  const { data, error } = await supabase.from("properties").select(SELECT_DETAIL).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToProperty(data as unknown as PropertyRow);
}

const PAGE_SIZE = 20;

export type PropertyPageFilters = {
  purpose?: Purpose | "all";
  type?: string;
  provinces?: string[];
  regions?: string[];
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  minRooms?: number;
  query?: string;
};

async function fetchPropertiesPage(filters: PropertyPageFilters, pageParam: number): Promise<Property[]> {
  let q = supabase.from("properties").select(SELECT).order("created_at", { ascending: false });

  if (filters.purpose && filters.purpose !== "all") q = q.eq("purpose", filters.purpose);
  if (filters.type && filters.type !== "all") q = q.eq("type", filters.type);
  if (filters.provinces?.length) {
    const known = filters.provinces.filter((p) => PROVINCES.includes(p));
    const custom = filters.provinces.filter((p) => !PROVINCES.includes(p));
    if (custom.length) {
      // ↔ #3: محافظة "مخصّصة" اتضافت من مودال الفلتر (لسه ماوصلتش لعتبة
      // الـ 3 محاولات أو الاسم مش مطابق حرفيًا لأي قيمة مخزّنة فى العمود)
      // — .in() المطابقة الحرفية مش هتلاقيها أبدًا. بنستخدم ilike بدل
      // كده على province/location عشان "سيتم البحث فى كل الأحوال عن
      // المنطقة المطلوبة" يتحقق فعليًا، مهما كان الاسم المخزّن مطابق
      // بالظبط ولا لأ.
      const orParts: string[] = [];
      if (known.length) orParts.push(`province.in.(${known.join(",")})`);
      for (const c of custom) {
        const safe = c.replace(/[%_,.()]/g, "").trim();
        if (!safe) continue;
        orParts.push(`province.ilike.%${safe}%`, `location.ilike.%${safe}%`);
      }
      if (orParts.length) q = q.or(orParts.join(","));
    } else {
      q = q.in("province", known);
    }
  }
  if (filters.regions?.length) q = q.in("location", filters.regions);
  if (filters.priceMin) q = q.gte("price", filters.priceMin);
  if (filters.priceMax != null && Number.isFinite(filters.priceMax)) q = q.lte("price", filters.priceMax);
  if (filters.areaMin) q = q.gte("area", filters.areaMin);
  if (filters.areaMax != null && Number.isFinite(filters.areaMax)) q = q.lte("area", filters.areaMax);
  if (filters.minRooms) q = q.gte("rooms", filters.minRooms);
  if (filters.query?.trim()) {
    const safe = filters.query.trim().replace(/[%_,.]/g, "");
    if (safe) {
      const like = `%${safe}%`;
      q = q.or(`title.ilike.${like},location.ilike.${like},type.ilike.${like},description.ilike.${like},province.ilike.${like}`);
    }
  }

  const from = pageParam * PAGE_SIZE;
  const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return (data as unknown as PropertyRow[]).map(rowToProperty);
}

export function usePaginatedProperties(filters: PropertyPageFilters) {
  return useInfiniteQuery({
    queryKey: ["properties", "paginated", filters],
    queryFn: ({ pageParam }) => fetchPropertiesPage(filters, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.length < PAGE_SIZE ? undefined : allPages.length),
    staleTime: 15_000,
  });
}

export function usePropertiesByIds(ids: string[]) {
  const key = [...ids].sort().join(",");
  return useQuery({
    queryKey: ["properties", "byIds", key],
    queryFn: async (): Promise<Property[]> => {
      if (!ids.length) return [];
      const { data, error } = await supabase.from("properties").select(SELECT).in("id", ids);
      if (error) throw error;
      return (data as unknown as PropertyRow[]).map(rowToProperty);
    },
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
}

async function fetchPropertiesPreservingOrder(ids: string[]): Promise<Property[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("properties").select(SELECT).in("id", ids);
  if (error) throw error;
  const byId = new Map((data as unknown as PropertyRow[]).map((r) => [r.id, rowToProperty(r)]));
  return ids.map((id) => byId.get(id)).filter((p): p is Property => !!p);
}

export type GeoFilters = Omit<PropertyPageFilters, "provinces" | "regions"> & {
  provinces?: string[]; regions?: string[];
};

function geoFilterArgs(filters: GeoFilters) {
  return {
    p_purpose: filters.purpose && filters.purpose !== "all" ? filters.purpose : undefined,
    p_type: filters.type && filters.type !== "all" ? filters.type : undefined,
    p_provinces: filters.provinces?.length ? filters.provinces : undefined,
    p_regions: filters.regions?.length ? filters.regions : undefined,
    p_price_min: filters.priceMin || undefined,
    p_price_max: filters.priceMax != null && Number.isFinite(filters.priceMax) ? filters.priceMax : undefined,
    p_area_min: filters.areaMin || undefined,
    p_area_max: filters.areaMax != null && Number.isFinite(filters.areaMax) ? filters.areaMax : undefined,
    p_min_rooms: filters.minRooms || undefined,
    p_query: filters.query?.trim() ? filters.query.trim().replace(/[%_,.]/g, "") : undefined,
  };
}

export function usePropertiesInRadius(filters: GeoFilters, center: { lat: number; lng: number; radiusKm: number } | null) {
  return useInfiniteQuery({
    queryKey: ["properties", "radius", center, filters],
    queryFn: async ({ pageParam }): Promise<Property[]> => {
      if (!center) return [];
      const { data, error } = await supabase.rpc("properties_in_radius", {
        center_lat: center.lat, center_lng: center.lng, radius_km: center.radiusKm,
        ...geoFilterArgs(filters),
        p_limit: PAGE_SIZE, p_offset: (pageParam as number) * PAGE_SIZE,
      });
      if (error) throw error;
      const ids = (data as { id: string }[]).map((r) => r.id);
      return fetchPropertiesPreservingOrder(ids);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.length < PAGE_SIZE ? undefined : allPages.length),
    enabled: !!center,
    staleTime: 15_000,
  });
}

export function usePropertiesInBounds(
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null,
  filters: Pick<GeoFilters, "purpose" | "type">
) {
  return useQuery({
    queryKey: ["properties", "bounds", bounds, filters],
    queryFn: async (): Promise<Property[]> => {
      if (!bounds) return [];
      const { data, error } = await supabase.rpc("properties_in_bounds", {
        min_lat: bounds.minLat, max_lat: bounds.maxLat, min_lng: bounds.minLng, max_lng: bounds.maxLng,
        p_purpose: filters.purpose && filters.purpose !== "all" ? filters.purpose : undefined,
        p_type: filters.type && filters.type !== "all" ? filters.type : undefined,
        p_limit: 500,
      });
      if (error) throw error;
      const ids = (data as { id: string }[]).map((r) => r.id);
      return fetchPropertiesPreservingOrder(ids);
    },
    enabled: !!bounds,
    staleTime: 15_000,
  });
}

export function useProperties() {
  const query = useQuery({ queryKey: ["properties"], queryFn: fetchProperties, staleTime: 30_000 });
  const all = [...(query.data ?? []), ...demoProperties];
  return { ...query, properties: all };
}

export function usePropertyById(id: string | undefined) {
  const { properties } = useProperties();
  return properties.find((p) => p.id === id);
}

export function usePropertyDetail(id: string | undefined) {
  const query = useQuery({
    queryKey: ["properties", "detail", id],
    queryFn: () => fetchPropertyDetail(id!),
    enabled: !!id,
    staleTime: 15_000,
  });
  const demoFallback = query.data == null && !query.isLoading ? demoProperties.find((p) => p.id === id) : undefined;
  return { ...query, data: query.data ?? demoFallback ?? undefined };
}

// ↔ يستدعى get_property_contact_phone() (SECURITY DEFINER) بدل قراءة
// profiles.phone_e164 مباشرة، عشان يفضل بيرجع رقم البائع لأى زائر يشوف
// إعلانه — طالما فعّل show_whatsapp أو show_call_button — من غير ما
// نضطر نفتح سياسة RLS العامة لجدول profiles نفسه. يترجع null لو الرقم
// مش متاح (البائع قافل الزرين، أو مفيش رقم مسجل أصلًا) فتختفي الأزرار
// المرتبطة تلقائيًا (نفس سلوك property.seller.phone الفاضي قبل كده).
export function useSellerContactPhone(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["properties", "contactPhone", propertyId],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc("get_property_contact_phone", { p_property_id: propertyId! });
      if (error) throw error;
      return (data as string | null) ?? null;
    },
    enabled: !!propertyId,
    staleTime: 60_000,
  });
}

export function useMyProperties(sellerId: string | undefined) {
  return useQuery({
    queryKey: ["properties", "bySeller", sellerId],
    queryFn: () => fetchPropertiesBySeller(sellerId!),
    enabled: !!sellerId,
    staleTime: 10_000,
  });
}

export type CreatePropertyInput = Omit<Property, "id" | "createdAt" | "likes" | "saves" | "views" | "chats" | "seller" | "pinned" | "pinnedAt"> & {
  sellerId: string;
};

export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePropertyInput) => {
      const payload: Database["public"]["Tables"]["properties"]["Insert"] = {
        seller_id: input.sellerId,
        purpose: input.purpose,
        type: input.type,
        title: input.title,
        short_title: input.shortTitle,
        province: input.province,
        location: input.location,
        lat: input.lat,
        lng: input.lng,
        price: input.price,
        area: input.area,
        rooms: input.rooms,
        baths: input.baths,
        reception: input.reception,
        floor: input.floor,
        payment: input.payment,
        negotiable: input.negotiable,
        finish_type: input.finishType,
        status: input.status,
        delivery_date: input.deliveryDate,
        features: input.features,
        description: input.description,
        // ↔ #3: نفس منطق useDrafts.ts — MediaItem[] مش Json نوعيًا رغم إنها
        // JSON-safe فعليًا وقت التشغيل، فالتحويل مضبوط على الحقل ده بس.
        media: input.media as unknown as Json,
        cover_image: input.coverImage,
        music: input.music,
        share_platforms: input.sharePlatforms || [],
      };
      // ↔ payload معرّف فوق بنوع Insert بالظبط، فمفيش داعي لـ as any هنا.
      const { data, error } = await supabase.from("properties").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}

export function useUpdateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CreatePropertyInput> }) => {
      // ↔ #3: كان Record<string, unknown> (نوع عام تمامًا) ثم as any وقت
      // الإرسال — استبدلته بنوع Update الحقيقى من قاعدة البيانات، فـ TS
      // بقى يتأكد فعليًا إن كل حقل بيتحط صح (اسم العمود ونوعه) من غير
      // الحاجة لـ any خالص.
      const row: Database["public"]["Tables"]["properties"]["Update"] = {};
      if (patch.purpose !== undefined) row.purpose = patch.purpose;
      if (patch.type !== undefined) row.type = patch.type;
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.shortTitle !== undefined) row.short_title = patch.shortTitle;
      if (patch.province !== undefined) row.province = patch.province;
      if (patch.location !== undefined) row.location = patch.location;
      if (patch.price !== undefined) row.price = patch.price;
      if (patch.area !== undefined) row.area = patch.area;
      if (patch.rooms !== undefined) row.rooms = patch.rooms;
      if (patch.baths !== undefined) row.baths = patch.baths;
      if (patch.reception !== undefined) row.reception = patch.reception;
      if (patch.floor !== undefined) row.floor = patch.floor;
      if (patch.payment !== undefined) row.payment = patch.payment;
      if (patch.negotiable !== undefined) row.negotiable = patch.negotiable;
      if (patch.finishType !== undefined) row.finish_type = patch.finishType;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.deliveryDate !== undefined) row.delivery_date = patch.deliveryDate;
      if (patch.features !== undefined) row.features = patch.features;
      if (patch.description !== undefined) row.description = patch.description;
      if (patch.media !== undefined) row.media = patch.media as unknown as Json;
      if (patch.coverImage !== undefined) row.cover_image = patch.coverImage;
      if (patch.music !== undefined) row.music = patch.music;
      if (patch.sharePlatforms !== undefined) row.share_platforms = patch.sharePlatforms;
      row.updated_at = new Date().toISOString();

      const { error } = await supabase.from("properties").update(row).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["properties"] }),
  });
}

export function useDeleteProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["properties"] }),
  });
}

export function useTogglePinProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase.from("properties").update({ pinned, pinned_at: pinned ? new Date().toISOString() : null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["properties"] }),
  });
}