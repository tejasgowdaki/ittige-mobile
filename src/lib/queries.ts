"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { useCompany } from "@/lib/company-context";
import { queryKeys } from "@/lib/query-keys";

export type ProjectListItem = {
  id: string;
  name: string;
  code: string;
  status: string;
  addressLine?: string | null;
  areaUnit?: string;
  totalArea?: string | number;
  completionPercent: string | number;
  client: { id?: string; name: string };
  stockLocation?: { id: string } | null;
};

export type ClientItem = { id: string; name: string };
export type WorkTypeItem = { id: string; name: string };
export type LaborTypeItem = { id: string; name: string };
export type MaterialItem = { id: string; name: string; uom: string };
export type GodownItem = {
  id: string;
  name: string;
  stockLocation: { id: string } | null;
};

function enabledFor(companyId: string | null | undefined, enabled = true) {
  return Boolean(companyId) && enabled;
}

export function useProjectsQuery(enabled = true) {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: queryKeys.projects(companyId ?? ""),
    queryFn: () =>
      apiFetch<{ projects: ProjectListItem[] }>("/api/v1/projects", { companyId }).then(
        (payload) => payload.projects,
      ),
    enabled: enabledFor(companyId, enabled),
  });
}

export function useClientsQuery(enabled = true) {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: queryKeys.clients(companyId ?? ""),
    queryFn: () =>
      apiFetch<{ clients: ClientItem[] }>("/api/v1/clients", { companyId }).then(
        (payload) => payload.clients,
      ),
    enabled: enabledFor(companyId, enabled),
  });
}

export function useWorkTypesQuery(enabled = true) {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: queryKeys.workTypes(companyId ?? ""),
    queryFn: () =>
      apiFetch<{ workTypes: WorkTypeItem[] }>("/api/v1/work-types", { companyId }).then(
        (payload) => payload.workTypes,
      ),
    enabled: enabledFor(companyId, enabled),
  });
}

export function useLaborTypesQuery(enabled = true) {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: queryKeys.laborTypes(companyId ?? ""),
    queryFn: () =>
      apiFetch<{ laborTypes: LaborTypeItem[] }>("/api/v1/labor-types", { companyId }).then(
        (payload) => payload.laborTypes,
      ),
    enabled: enabledFor(companyId, enabled),
  });
}

export function useMaterialsQuery(enabled = true) {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: queryKeys.materials(companyId ?? ""),
    queryFn: () =>
      apiFetch<{ materials: MaterialItem[] }>("/api/v1/materials", { companyId }).then(
        (payload) => payload.materials,
      ),
    enabled: enabledFor(companyId, enabled),
  });
}

export function useGodownsQuery(enabled = true) {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: queryKeys.godowns(companyId ?? ""),
    queryFn: () =>
      apiFetch<{ godowns: GodownItem[] }>("/api/v1/godowns", { companyId }).then(
        (payload) => payload.godowns,
      ),
    enabled: enabledFor(companyId, enabled),
  });
}

export function useStockQuery<T = unknown>(enabled = true) {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: queryKeys.stock(companyId ?? ""),
    queryFn: () =>
      apiFetch<{ balances: T[] }>("/api/v1/stock", { companyId }).then(
        (payload) => payload.balances,
      ),
    enabled: enabledFor(companyId, enabled),
  });
}

export function useStockMovementsQuery<T = unknown>(
  filters: { from?: string; to?: string; locationId?: string; materialId?: string } = {},
  enabled = true,
) {
  const { companyId } = useCompany();
  const params = new URLSearchParams({ view: "movements" });
  if (filters.from) {
    params.set("from", filters.from);
  }
  if (filters.to) {
    params.set("to", filters.to);
  }
  if (filters.locationId) {
    params.set("locationId", filters.locationId);
  }
  if (filters.materialId) {
    params.set("materialId", filters.materialId);
  }
  return useQuery({
    queryKey: queryKeys.stockMovements(companyId ?? "", filters),
    queryFn: () =>
      apiFetch<{ movements: T[] }>(`/api/v1/stock?${params.toString()}`, { companyId }).then(
        (payload) => payload.movements,
      ),
    enabled: enabledFor(companyId, enabled),
  });
}

export function useTransfersQuery<T = unknown>(enabled = true) {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: queryKeys.transfers(companyId ?? ""),
    queryFn: () =>
      apiFetch<{ transfers: T[] }>("/api/v1/transfers", { companyId }).then(
        (payload) => payload.transfers,
      ),
    enabled: enabledFor(companyId, enabled),
  });
}

export function useMaterialRequestsQuery<T = unknown>(enabled = true) {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: queryKeys.materialRequests(companyId ?? ""),
    queryFn: () =>
      apiFetch<{ requests: T[] }>("/api/v1/material-requests", { companyId }).then(
        (payload) => payload.requests,
      ),
    enabled: enabledFor(companyId, enabled),
  });
}

export function useSiteLogQuery<T = unknown>(
  filters: { projectId?: string; kind?: string; from?: string; to?: string } = {},
  enabled = true,
) {
  const { companyId } = useCompany();
  const params = new URLSearchParams();
  if (filters.projectId) {
    params.set("projectId", filters.projectId);
  }
  if (filters.kind) {
    params.set("kind", filters.kind);
  }
  if (filters.from) {
    params.set("from", filters.from);
  }
  if (filters.to) {
    params.set("to", filters.to);
  }
  const qs = params.toString();
  return useQuery({
    queryKey: [...queryKeys.siteLog(companyId ?? ""), filters] as const,
    queryFn: () =>
      apiFetch<{ entries: T[] }>(`/api/v1/site-log${qs ? `?${qs}` : ""}`, { companyId }).then(
        (payload) => payload.entries,
      ),
    enabled: enabledFor(companyId, enabled),
  });
}

export function useScheduleAlertsQuery<T = unknown>(status = "OPEN", enabled = true) {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: queryKeys.scheduleAlerts(companyId ?? "", status),
    queryFn: () =>
      apiFetch<{ alerts: T[] }>(`/api/v1/schedule-alerts?status=${status}`, {
        companyId,
      })
        .then((payload) => payload.alerts)
        .catch(() => [] as T[]),
    enabled: enabledFor(companyId, enabled),
  });
}

export function useProjectQuery<T = unknown>(projectId: string | undefined, enabled = true) {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: queryKeys.project(companyId ?? "", projectId ?? ""),
    queryFn: () => apiFetch<T>(`/api/v1/projects/${projectId}`, { companyId }),
    enabled: enabledFor(companyId, enabled && Boolean(projectId)),
  });
}

export function useProjectScheduleQuery<T = unknown>(
  projectId: string | undefined,
  enabled = true,
) {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: queryKeys.projectSchedule(companyId ?? "", projectId ?? ""),
    queryFn: () =>
      apiFetch<T>(`/api/v1/projects/${projectId}/schedule`, { companyId }).catch(
        () => null as T | null,
      ),
    enabled: enabledFor(companyId, enabled && Boolean(projectId)),
  });
}

export function useMembersQuery<TMembership = unknown, TInvite = unknown>(enabled = true) {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: queryKeys.members(companyId ?? ""),
    queryFn: () =>
      apiFetch<{ memberships: TMembership[]; invites: TInvite[] }>("/api/v1/members", {
        companyId,
      }),
    enabled: enabledFor(companyId, enabled),
  });
}

export function useRolesQuery<T = unknown>(enabled = true) {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: queryKeys.roles(companyId ?? ""),
    queryFn: () =>
      apiFetch<{ roles: T[] }>("/api/v1/roles", { companyId }).then((payload) => payload.roles),
    enabled: enabledFor(companyId, enabled),
  });
}

export function useSettingsQuery<T = unknown>(enabled = true) {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: queryKeys.settings(companyId ?? ""),
    queryFn: () => apiFetch<T>("/api/v1/settings", { companyId }),
    enabled: enabledFor(companyId, enabled),
  });
}

export function useActivityQuery<T = unknown>(
  filters: {
    modules?: string[];
    actorIds?: string[];
    from?: string;
    to?: string;
  } = {},
  enabled = true,
) {
  const { companyId } = useCompany();
  const params = new URLSearchParams();
  if (filters.modules && filters.modules.length > 0) {
    params.set("module", filters.modules.join(","));
  }
  if (filters.actorIds && filters.actorIds.length > 0) {
    params.set("actorId", filters.actorIds.join(","));
  }
  if (filters.from) {
    params.set("from", filters.from);
  }
  if (filters.to) {
    params.set("to", filters.to);
  }
  const query = params.toString();
  const keyFilters = {
    module: filters.modules?.join(",") || undefined,
    actorId: filters.actorIds?.join(",") || undefined,
    from: filters.from,
    to: filters.to,
  };
  return useQuery({
    queryKey: queryKeys.activity(companyId ?? "", keyFilters),
    queryFn: () =>
      apiFetch<{ events: T[]; nextCursor: string | null }>(
        `/api/v1/activity${query ? `?${query}` : ""}`,
        { companyId },
      ),
    enabled: enabledFor(companyId, enabled),
  });
}

export function useCompanyMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (variables: TVariables, companyId: string) => Promise<TData>,
  invalidateKeys: (companyId: string) => readonly unknown[][],
) {
  const { companyId } = useCompany();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      if (!companyId) {
        throw new Error("Company not loaded");
      }
      return mutationFn(variables, companyId);
    },
    onSuccess: async () => {
      if (!companyId) {
        return;
      }
      await Promise.all(
        invalidateKeys(companyId).map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
    },
  });
}
