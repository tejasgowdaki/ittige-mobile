export const queryKeys = {
  me: ["me"] as const,
  projects: (companyId: string) => ["projects", companyId] as const,
  project: (companyId: string, projectId: string) =>
    ["project", companyId, projectId] as const,
  projectSchedule: (companyId: string, projectId: string) =>
    ["project-schedule", companyId, projectId] as const,
  clients: (companyId: string) => ["clients", companyId] as const,
  materials: (companyId: string) => ["materials", companyId] as const,
  godowns: (companyId: string) => ["godowns", companyId] as const,
  stock: (companyId: string) => ["stock", companyId] as const,
  stockMovements: (
    companyId: string,
    filters: { from?: string; to?: string; locationId?: string; materialId?: string } = {},
  ) => ["stock-movements", companyId, filters] as const,
  transfers: (companyId: string) => ["transfers", companyId] as const,
  materialRequests: (companyId: string) => ["material-requests", companyId] as const,
  siteLog: (companyId: string) => ["site-log", companyId] as const,
  workTypes: (companyId: string) => ["work-types", companyId] as const,
  laborTypes: (companyId: string) => ["labor-types", companyId] as const,
  scheduleAlerts: (companyId: string, status = "OPEN") =>
    ["schedule-alerts", companyId, status] as const,
  members: (companyId: string) => ["members", companyId] as const,
  roles: (companyId: string) => ["roles", companyId] as const,
  settings: (companyId: string) => ["settings", companyId] as const,
  activity: (
    companyId: string,
    filters: {
      module?: string;
      actorId?: string;
      from?: string;
      to?: string;
    } = {},
  ) => ["activity", companyId, filters] as const,
};
