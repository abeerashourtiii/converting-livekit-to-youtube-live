import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useCurrentUser } from "./useCurrentUser";

// ↔ powers the "الحساب عام/خاص" row in the account settings dropdown and
// the privacy gate on app/seller/[id].tsx.
// ↔ the seller page's own privacy check — is the profile being VIEWED
// public, regardless of who's viewing it.
export function useIsProfilePublic(sellerId: string | undefined) {
  return useQuery({
    queryKey: ["profilePublic", sellerId],
    queryFn: async (): Promise<boolean> => {
      // ↔ profiles_public, not profiles — deliberately. Querying is_public
      // itself against the now-restricted `profiles` table would be
      // self-defeating: RLS blocks a stranger's row entirely once
      // is_public=false (20260825000000_profile_privacy_rls.sql), so
      // .maybeSingle() would come back null for exactly the accounts
      // this hook exists to detect as private, and `data?.is_public ??
      // true` would then read that "no row" as "public" — silently
      // failing OPEN for every private account, the opposite of the
      // intent. is_public itself isn't sensitive (knowing WHETHER an
      // account is private isn't the same kind of leak as phone/bio
      // would be), so profiles_public exposes it unconditionally and
      // this hook can read it honestly regardless of the target
      // account's privacy setting.
      const { data, error } = await supabase.from("profiles_public").select("is_public").eq("id", sellerId!).maybeSingle();
      if (error) throw error;
      return data?.is_public ?? true;
    },
    enabled: !!sellerId,
    staleTime: 30_000,
  });
}

export function useAccountPrivacy() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const queryKey = ["accountPrivacy", user?.id];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.from("profiles").select("is_public").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data?.is_public ?? true;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const toggle = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const next = !(query.data ?? true);
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, is_public: next }, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return { isPublic: query.data ?? true, togglePrivacy: () => toggle.mutate() };
}
