import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase";

export type AuditLogEntry = {
  id: string;
  actorName: string | null;
  action: string;
  targetTable: string;
  targetId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
};

type AuditLogRow = {
  id: string;
  actor_name: string | null;
  action: string;
  target_table: string;
  target_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
};

export function useAdminAuditLog() {
  return useQuery({
    queryKey: ["adminAuditLog"],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("id, actor_name, action, target_table, target_id, before, after, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return ((data as unknown as AuditLogRow[]) ?? []).map((r) => ({
        id: r.id,
        actorName: r.actor_name,
        action: r.action,
        targetTable: r.target_table,
        targetId: r.target_id,
        before: r.before,
        after: r.after,
        createdAt: r.created_at,
      }));
    },
    staleTime: 15_000,
  });
}

export type ActivityLogEntry = {
  id: string;
  userName: string | null;
  activityType: "login" | "role_change";
  details: Record<string, unknown> | null;
  createdAt: string;
};

type ActivityLogRow = {
  id: string;
  user_name: string | null;
  activity_type: "login" | "role_change";
  details: Record<string, unknown> | null;
  created_at: string;
};

export function useUserActivityLog() {
  return useQuery({
    queryKey: ["userActivityLog"],
    queryFn: async (): Promise<ActivityLogEntry[]> => {
      const { data, error } = await supabase
        .from("user_activity_log")
        .select("id, user_name, activity_type, details, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return ((data as unknown as ActivityLogRow[]) ?? []).map((r) => ({
        id: r.id,
        userName: r.user_name,
        activityType: r.activity_type,
        details: r.details,
        createdAt: r.created_at,
      }));
    },
    staleTime: 15_000,
  });
}