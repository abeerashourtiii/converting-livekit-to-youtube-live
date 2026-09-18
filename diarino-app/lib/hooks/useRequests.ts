import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { PropertyRequest } from "../../data/mock-requests";

// ↔ replaces data/mock-requests.ts + the myRequests half of useMyContent.ts.

type RequestRow = {
  id: string; requester_id: string; purpose: "sale" | "rent"; type: string; province: string; location: string;
  price_max: number | null; area: string | null; rooms: string | null; baths: string | null;
  description: string; requester_name: string; offers_count: number; created_at: string;
};

function rowToRequest(row: RequestRow): PropertyRequest {
  return {
    id: row.id,
    purpose: row.purpose,
    type: row.type,
    province: row.province,
    location: row.location,
    priceMax: row.price_max ?? 0,
    area: row.area ?? "",
    rooms: row.rooms ?? "",
    baths: row.baths ?? "",
    description: row.description,
    requesterName: row.requester_name,
    requesterId: row.requester_id,
    offers: row.offers_count,
    createdAt: new Date(row.created_at).getTime(),
  };
}

async function fetchRequests(): Promise<PropertyRequest[]> {
  // ↔ AUDIT FIX: same unbounded-query cap as useProperties.ts — see that
  // file's comment for why a cap (not full pagination) is the safe fix here.
  const { data, error } = await supabase.from("requests")
    .select("id, requester_id, purpose, type, province, location, price_max, area, rooms, baths, description, requester_name, offers_count, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data as RequestRow[]).map(rowToRequest);
}

export function useRequests() {
  return useQuery({ queryKey: ["requests"], queryFn: fetchRequests, staleTime: 15_000 });
}

export function useMyRequests(requesterId: string | undefined) {
  const { data } = useRequests();
  return (data ?? []).filter((r) => r.requesterId === requesterId);
}

// ---------------------------------------------------------------------
// Real pagination for the requests tab — same plan/agreement as
// useProperties.ts's usePaginatedProperties: offset-based, page size 20,
// filtering moved server-side. useRequests() above is untouched.
// ---------------------------------------------------------------------
const REQUESTS_PAGE_SIZE = 20;

export type RequestPageFilters = { province?: string; location?: string; type?: string; purpose?: "all" | "sale" | "rent" };

async function fetchRequestsPage(filters: RequestPageFilters, pageParam: number): Promise<PropertyRequest[]> {
  let q = supabase.from("requests")
    .select("id, requester_id, purpose, type, province, location, price_max, area, rooms, baths, description, requester_name, offers_count, created_at")
    .order("created_at", { ascending: false });

  if (filters.province) q = q.eq("province", filters.province);
  if (filters.location) q = q.ilike("location", `%${filters.location.replace(/[%_,.]/g, "")}%`);
  if (filters.type && filters.type !== "all") q = q.eq("type", filters.type);
  if (filters.purpose && filters.purpose !== "all") q = q.eq("purpose", filters.purpose);

  const from = pageParam * REQUESTS_PAGE_SIZE;
  const { data, error } = await q.range(from, from + REQUESTS_PAGE_SIZE - 1);
  if (error) throw error;
  return (data as RequestRow[]).map(rowToRequest);
}

export function usePaginatedRequests(filters: RequestPageFilters) {
  return useInfiniteQuery({
    queryKey: ["requests", "paginated", filters],
    queryFn: ({ pageParam }) => fetchRequestsPage(filters, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.length < REQUESTS_PAGE_SIZE ? undefined : allPages.length),
    staleTime: 15_000,
  });
}

export type CreateRequestInput = Omit<PropertyRequest, "id" | "createdAt" | "offers" | "requesterId"> & {
  requesterId: string;
};

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRequestInput) => {
      const { error } = await supabase.from("requests").insert({
        requester_id: input.requesterId,
        purpose: input.purpose, type: input.type, province: input.province, location: input.location,
        price_max: input.priceMax || null, area: input.area || null, rooms: input.rooms || null, baths: input.baths || null,
        description: input.description, requester_name: input.requesterName,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests"] }),
  });
}

export function useDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests"] }),
  });
}

// ↔ the offers++ side of submitOffer() — atomic via the increment_request_offers RPC.
export function useIncrementRequestOffers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc("increment_request_offers", { request_id: requestId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests"] }),
  });
}
