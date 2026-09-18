-- supabase/migrations/20260901000000_property_contact_phone.sql
--
-- BUG FIX: app/property/[id].tsx's "تواصل عبر واتساب" / call buttons
-- read property.seller.phone, which came from embedding
-- profiles!properties_seller_profile_fkey(*) directly. After
-- 20260825000000_profile_privacy_rls.sql tightened public.profiles'
-- SELECT policy (own row / is_public=true / chat partner / staff only),
-- that embed silently lost phone_e164 for the vast majority of sellers —
-- anyone who isn't is_public and hasn't already chatted with the viewer
-- — even though profiles.show_whatsapp / show_call_button (added by
-- 20260806000000_user_content_settings.sql) exist specifically so a
-- seller can opt in to being called/WhatsApp'd about their *public
-- listings*. Those two toggles were only ever wired up as UI-visibility
-- switches (see useSellerContentSettings) with no actual path left to
-- read the phone number itself once the RLS tightened — publishing a
-- property and turning show_whatsapp/show_call_button on is a clear,
-- narrow, per-listing form of consent to being contacted, distinct from
-- (and not something that should require) the account-wide is_public
-- flag. This function is that missing path: it hands back a phone
-- number only for a real property row, and only when the seller has
-- opted in via one of those two toggles — nothing else about
-- public.profiles' access rules changes.
create or replace function public.get_property_contact_phone(p_property_id uuid)
returns text
language sql
stable
security definer set search_path = public
as $$
  select p.phone_e164
  from public.properties prop
  join public.profiles p on p.id = prop.seller_id
  where prop.id = p_property_id
    and (p.show_whatsapp = true or p.show_call_button = true)
  limit 1;
$$;

revoke all on function public.get_property_contact_phone(uuid) from public;
grant execute on function public.get_property_contact_phone(uuid) to authenticated;
