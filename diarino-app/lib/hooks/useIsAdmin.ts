import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useCurrentUser } from "./useCurrentUser";

// ↔ checkAdmin(uid) — queries user_roles for an 'admin' row matching the
// current user. Granting used to be a manual/server-side-only action;
// 20260807000000_super_admin_system.sql replaces that with a real
// in-app super-admin system, so this now also reads is_super_admin/
// full_access/permissions for gating individual admin sections.
export type AdminSection =
  | "reels"
  | "lives"
  | "reports"
  | "users"
  | "features"
  | "ads"
  | "sponsoredReels"
  | "auditLog"
  | "userActivity"
  | "menuItems";

type UserRoleRow = {
  role: string;
  is_super_admin: boolean | null;
  full_access: boolean | null;
  permissions: AdminSection[] | null;
};

export function useIsAdmin() {
  const { user, loading: userLoading } = useCurrentUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [fullAccess, setFullAccess] = useState(false);
  const [permissions, setPermissions] = useState<AdminSection[]>([]);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setFullAccess(false);
      setPermissions([]);
      setChecking(false);
      return;
    }

    let isMounted = true;
    setChecking(true);

    async function fetchAdminStatus(userId: string) {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role, is_super_admin, full_access, permissions")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();

        if (error) throw error;

        if (isMounted) {
          const roleData = data as UserRoleRow | null;
          setIsAdmin(!!roleData);
          setIsSuperAdmin(!!roleData?.is_super_admin);
          setFullAccess(roleData?.full_access ?? false);
          setPermissions(roleData?.permissions ?? []);
          setChecking(false);
        }
      } catch (err: unknown) {
        // ↔ React Query / data audit finding: without this, a network
        // failure here left `checking` stuck at `true` forever — the admin
        // gate screen would just spin indefinitely instead of correctly
        // denying access. Failing to isAdmin=false is the safe default:
        // whatever went wrong, the caller couldn't be confirmed as an
        // admin, so treat them as not one.
        console.warn("Failed to check admin status:", err);
        if (isMounted) {
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setFullAccess(false);
          setPermissions([]);
          setChecking(false);
        }
      }
    }

    fetchAdminStatus(user.id);

    return () => {
      isMounted = false;
    };
  }, [user, userLoading]);

  function canAccess(section: AdminSection): boolean {
    if (isSuperAdmin || fullAccess) return true;
    return permissions.includes(section);
  }

  return {
    isAdmin,
    isSuperAdmin,
    fullAccess,
    permissions,
    canAccess,
    checking: checking || userLoading,
  };
}