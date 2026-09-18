import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useCurrentUser } from "./useCurrentUser";
import { Database } from "../../src/types/supabase";

// ↔ بند 4 — مصدر واحد لبيانات البروفايل (avatar_url/full_name/username/
// first_name/last_name/birth_date/gender/nationality/residence/phone_*)
// تستخدمه شاشة الإعدادات (قسم البروفايل فوق تسجيل الخروج) وشاشة تعديل
// بيانات الحساب (app/edit-profile.tsx) الجديدة، عشان صورة/بيانات
// البروفايل تكون نفسها بالظبط فى المكانين، مش نسختين منفصلتين.

export type Profile = {
  id: string;
  fullName: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  birthDate: string | null; // YYYY-MM-DD
  gender: "male" | "female" | null;
  nationality: string | null;
  residence: string | null;
  phoneE164: string | null;
  phoneCountryCode: string | null;
  phoneCountryName: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  birth_date: string | null;
  gender: "male" | "female" | null;
  nationality: string | null;
  residence: string | null;
  phone_e164: string | null;
  phone_country_code: string | null;
  phone_country_name: string | null;
};

function rowToProfile(r: ProfileRow): Profile {
  return {
    id: r.id,
    fullName: r.full_name,
    username: r.username,
    firstName: r.first_name,
    lastName: r.last_name,
    avatarUrl: r.avatar_url,
    birthDate: r.birth_date,
    gender: r.gender,
    nationality: r.nationality,
    residence: r.residence,
    phoneE164: r.phone_e164,
    phoneCountryCode: r.phone_country_code,
    phoneCountryName: r.phone_country_name,
  };
}

const SELECT_COLUMNS =
  "id, full_name, username, first_name, last_name, avatar_url, birth_date, gender, nationality, residence, phone_e164, phone_country_code, phone_country_name";

export function useProfile() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const queryKey = ["profile", user?.id] as const;

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<Profile | null> => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select(SELECT_COLUMNS)
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToProfile(data as unknown as ProfileRow) : null;
    },
    enabled: !!user?.id,
    staleTime: 10_000,
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<{
      fullName: string; username: string; firstName: string; lastName: string; avatarUrl: string;
      birthDate: string; gender: "male" | "female"; nationality: string; residence: string;
      phoneE164: string; phoneCountryCode: string; phoneCountryName: string;
    }>) => {
      if (!user?.id) throw new Error("لا يوجد مستخدم مسجّل دخول");

      // ↔ إصلاح: كانت طلبات الحفظ بترجع 401 ثم 42501 (RLS) لما تجديد
      // الجلسة يفشل فى الخلفية (races/rate-limit على /auth/v1/token) —
      // الواجهة كانت بتحاول تحفظ بجلسة فعليًا منتهية من غير ما تعرف،
      // فيوصل خطأ Postgres تقني غير مفهوم للمستخدم. بنتأكد هنا الأول
      // إن فيه جلسة صالحة فعليًا (getSession بيحاول يجدد لو منتهية)
      // قبل أي محاولة كتابة، ونديله رسالة عربية واضحة بدل الخطأ التقني.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session || sessionData.session.user.id !== user.id) {
        throw new Error("انتهت صلاحية الجلسة، برجاء تسجيل الخروج ثم الدخول مرة أخرى.");
      }

      const row: {
        full_name?: string; username?: string; first_name?: string; last_name?: string; avatar_url?: string;
        birth_date?: string; gender?: string; nationality?: string; residence?: string;
        phone_e164?: string; phone_country_code?: string; phone_country_name?: string;
      } = {};
      if (patch.fullName !== undefined) row.full_name = patch.fullName;
      if (patch.username !== undefined) row.username = patch.username;
      if (patch.firstName !== undefined) row.first_name = patch.firstName;
      if (patch.lastName !== undefined) row.last_name = patch.lastName;
      if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
      if (patch.birthDate !== undefined) row.birth_date = patch.birthDate;
      if (patch.gender !== undefined) row.gender = patch.gender;
      if (patch.nationality !== undefined) row.nationality = patch.nationality;
      if (patch.residence !== undefined) row.residence = patch.residence;
      if (patch.phoneE164 !== undefined) row.phone_e164 = patch.phoneE164;
      if (patch.phoneCountryCode !== undefined) row.phone_country_code = patch.phoneCountryCode;
      if (patch.phoneCountryName !== undefined) row.phone_country_name = patch.phoneCountryName;

      const { data, error } = await supabase
        .from("profiles")
        .upsert(
          { id: user.id, ...row } as unknown as Database["public"]["Tables"]["profiles"]["Insert"],
          { onConflict: "id" },
        )
        .select("id")
        .single();
      if (error) {
        // ↔ لو حتى بعد التأكد من الجلسة اتضح إن RLS رافض الكتابة (42501)
        // أو الـ JWT مرفوض من PostgREST نفسه (401)، غالبًا الجلسة
        // اتقطعت فعليًا فى نفس اللحظة — رسالة واضحة بدل كود Postgres خام.
        if (error.code === "42501" || (error as { status?: number }).status === 401) {
          throw new Error("انتهت صلاحية الجلسة، برجاء تسجيل الخروج ثم الدخول مرة أخرى.");
        }
        throw error;
      }
      if (!data) throw new Error("Profile row was not saved");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  return { profile: query.data ?? null, isLoading: query.isLoading, update };
}
