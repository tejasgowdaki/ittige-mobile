export const PERMISSIONS = {
  COMPANY_SETTINGS_WRITE: "company.settings.write",
  USERS_MANAGE: "users.manage",
  ROLES_CUSTOMIZE: "roles.customize",
  ACTIVITY_READ: "activity.read",
  CLIENTS_MANAGE: "clients.manage",
  PROJECTS_ALL: "projects.all",
  PROJECTS_MANAGE: "projects.manage",
  PROJECTS_USERS_MANAGE: "projects.users.manage",
  GODOWNS_CREATE: "godowns.create",
  GODOWNS_READ: "godowns.read",
  GODOWNS_UPDATE: "godowns.update",
  GODOWNS_DELETE: "godowns.delete",
  GODOWNS_ASSIGN: "godowns.assign",
  MATERIALS_MANAGE: "materials.manage",
  STOCK_READ: "stock.read",
  RECEIPTS_CREATE: "receipts.create",
  TRANSFERS_CREATE: "transfers.create",
  TRANSFERS_APPROVE: "transfers.approve",
  TRANSFERS_DISPATCH: "transfers.dispatch",
  TRANSFERS_RECEIVE: "transfers.receive",
  USAGE_CREATE: "usage.create",
  DISCARDS_CREATE: "discards.create",
  DISCARDS_APPROVE: "discards.approve",
  REQUESTS_CREATE: "requests.create",
  REQUESTS_APPROVE: "requests.approve",
  REQUESTS_FULFILL: "requests.fulfill",
  SCHEDULE_MANAGE: "schedule.manage",
  ALERTS_MANAGE: "alerts.manage",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const AUDIT_MODULES = [
  "projects",
  "spaces",
  "progress",
  "stock",
  "team",
  "settings",
  "media",
  "requests",
] as const;

export type AuditModule = (typeof AUDIT_MODULES)[number];

export const ACTIVITY_FILTER_MODULES = [
  "projects",
  "progress",
  "stock",
  "team",
  "settings",
] as const;

export type ActivityFilterModule = (typeof ACTIVITY_FILTER_MODULES)[number];

export function formatAuditModule(module: string) {
  if (module === "spaces") {
    return "Projects";
  }
  return module.charAt(0).toUpperCase() + module.slice(1);
}

export const AUDIT_MODULE_LABELS: Record<ActivityFilterModule, string> = {
  projects: "Projects",
  progress: "Progress",
  stock: "Stock",
  team: "Team",
  settings: "Settings",
};

export const AUDIT_MODULE_PERMISSIONS: Record<
  ActivityFilterModule,
  readonly PermissionCode[] | "member"
> = {
  projects: [PERMISSIONS.PROJECTS_MANAGE, PERMISSIONS.CLIENTS_MANAGE],
  progress: "member",
  stock: [
    PERMISSIONS.STOCK_READ,
    PERMISSIONS.GODOWNS_READ,
    PERMISSIONS.GODOWNS_CREATE,
    PERMISSIONS.GODOWNS_UPDATE,
    PERMISSIONS.GODOWNS_DELETE,
    PERMISSIONS.GODOWNS_ASSIGN,
    PERMISSIONS.MATERIALS_MANAGE,
    PERMISSIONS.RECEIPTS_CREATE,
    PERMISSIONS.TRANSFERS_CREATE,
    PERMISSIONS.TRANSFERS_APPROVE,
    PERMISSIONS.TRANSFERS_DISPATCH,
    PERMISSIONS.TRANSFERS_RECEIVE,
    PERMISSIONS.USAGE_CREATE,
    PERMISSIONS.DISCARDS_CREATE,
    PERMISSIONS.DISCARDS_APPROVE,
  ],
  team: [PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_CUSTOMIZE],
  settings: [PERMISSIONS.COMPANY_SETTINGS_WRITE],
};

export function activityFilterModulesForPermissions(
  permissions: Iterable<string>,
): ActivityFilterModule[] {
  const allowed = new Set(permissions);
  return ACTIVITY_FILTER_MODULES.filter((module) => {
    const required = AUDIT_MODULE_PERMISSIONS[module];
    if (required === "member") {
      return true;
    }
    return required.some((code) => allowed.has(code));
  });
}

export function expandActivityFilterModules(
  filters: readonly ActivityFilterModule[],
): AuditModule[] {
  const modules = new Set<AuditModule>();
  for (const filter of filters) {
    if (filter === "projects") {
      modules.add("projects");
      modules.add("spaces");
    } else {
      modules.add(filter);
    }
  }
  return [...modules];
}

export const ROLE_SLUGS = [
  "ADMIN",
  "PROJECT_MANAGER",
  "PROJECT_SUPERVISOR",
  "STORE_MANAGER",
] as const;

export type SystemRoleSlug = (typeof ROLE_SLUGS)[number];
export type RoleSlug = string;

export function formatRoleLabel(slug: string) {
  return slug
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function slugifyRoleName(name: string) {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || "CUSTOM_ROLE";
}

export const PROJECT_ROLE_SLUGS = ["PROJECT_MANAGER", "PROJECT_SUPERVISOR"] as const;

export type ProjectRoleSlug = (typeof PROJECT_ROLE_SLUGS)[number];

export const ASSIGNABLE_ROLE_SLUGS = [
  "PROJECT_MANAGER",
  "PROJECT_SUPERVISOR",
  "STORE_MANAGER",
] as const;

export type AssignableRoleSlug = (typeof ASSIGNABLE_ROLE_SLUGS)[number];

export type PermissionDef = {
  code: PermissionCode;
  name: string;
  group: string;
};

export const PERMISSION_CATALOG: PermissionDef[] = [
  { code: PERMISSIONS.CLIENTS_MANAGE, name: "Manage clients", group: "projects" },
  { code: PERMISSIONS.PROJECTS_MANAGE, name: "Manage projects", group: "projects" },
  { code: PERMISSIONS.GODOWNS_CREATE, name: "Create godowns", group: "stock" },
  { code: PERMISSIONS.GODOWNS_READ, name: "View godowns", group: "stock" },
  { code: PERMISSIONS.GODOWNS_UPDATE, name: "Edit godowns", group: "stock" },
  { code: PERMISSIONS.GODOWNS_DELETE, name: "Delete godowns", group: "stock" },
  { code: PERMISSIONS.GODOWNS_ASSIGN, name: "Assign store managers", group: "stock" },
  { code: PERMISSIONS.MATERIALS_MANAGE, name: "Manage material catalog", group: "stock" },
  { code: PERMISSIONS.STOCK_READ, name: "View stock", group: "stock" },
  { code: PERMISSIONS.RECEIPTS_CREATE, name: "Record stock receipts", group: "stock" },
  { code: PERMISSIONS.TRANSFERS_CREATE, name: "Create transfers", group: "stock" },
  { code: PERMISSIONS.TRANSFERS_APPROVE, name: "Approve transfers", group: "stock" },
  { code: PERMISSIONS.TRANSFERS_DISPATCH, name: "Dispatch transfers", group: "stock" },
  { code: PERMISSIONS.TRANSFERS_RECEIVE, name: "Receive transfers", group: "stock" },
  { code: PERMISSIONS.USAGE_CREATE, name: "Log material usage", group: "stock" },
  { code: PERMISSIONS.DISCARDS_CREATE, name: "Request discards", group: "stock" },
  { code: PERMISSIONS.DISCARDS_APPROVE, name: "Approve discards", group: "stock" },
  { code: PERMISSIONS.REQUESTS_CREATE, name: "Raise material requests", group: "requests" },
  { code: PERMISSIONS.REQUESTS_APPROVE, name: "Approve material requests", group: "requests" },
  { code: PERMISSIONS.REQUESTS_FULFILL, name: "Fulfill material requests", group: "requests" },
  { code: PERMISSIONS.SCHEDULE_MANAGE, name: "Manage project schedules", group: "schedule" },
  { code: PERMISSIONS.ALERTS_MANAGE, name: "Manage schedule alerts", group: "schedule" },
];

export type RolePermissionBundle = {
  id: string;
  name: string;
  codes: PermissionCode[];
};

export type RolePermissionUiGroup = {
  id: string;
  label: string;
  bundles: RolePermissionBundle[];
};

export const HIDDEN_PERMISSION_GROUPS = ["requests", "schedule"] as const;

export const ROLE_PERMISSION_UI: RolePermissionUiGroup[] = [
  {
    id: "projects",
    label: "Projects",
    bundles: [
      {
        id: "manage_clients",
        name: "Manage clients",
        codes: [PERMISSIONS.CLIENTS_MANAGE],
      },
      {
        id: "manage_projects",
        name: "Manage projects",
        codes: [PERMISSIONS.PROJECTS_MANAGE],
      },
    ],
  },
  {
    id: "stock",
    label: "Stock",
    bundles: [
      {
        id: "manage_godowns",
        name: "Manage godowns",
        codes: [
          PERMISSIONS.GODOWNS_CREATE,
          PERMISSIONS.GODOWNS_READ,
          PERMISSIONS.GODOWNS_UPDATE,
          PERMISSIONS.GODOWNS_DELETE,
          PERMISSIONS.GODOWNS_ASSIGN,
        ],
      },
      {
        id: "manage_balances",
        name: "Manage balances",
        codes: [
          PERMISSIONS.STOCK_READ,
          PERMISSIONS.MATERIALS_MANAGE,
          PERMISSIONS.RECEIPTS_CREATE,
          PERMISSIONS.USAGE_CREATE,
          PERMISSIONS.DISCARDS_CREATE,
          PERMISSIONS.DISCARDS_APPROVE,
        ],
      },
      {
        id: "manage_transfers",
        name: "Manage transfers",
        codes: [
          PERMISSIONS.STOCK_READ,
          PERMISSIONS.TRANSFERS_CREATE,
          PERMISSIONS.TRANSFERS_APPROVE,
          PERMISSIONS.TRANSFERS_DISPATCH,
          PERMISSIONS.TRANSFERS_RECEIVE,
        ],
      },
    ],
  },
];

export function codesForEnabledBundles(enabledBundleIds: string[]): PermissionCode[] {
  const codes = new Set<PermissionCode>();
  for (const group of ROLE_PERMISSION_UI) {
    for (const bundle of group.bundles) {
      if (enabledBundleIds.includes(bundle.id)) {
        for (const code of bundle.codes) {
          codes.add(code);
        }
      }
    }
  }
  return [...codes];
}

export function isBundleFullyAllowed(
  bundle: RolePermissionBundle,
  allowedByCode: Map<string, boolean> | Record<string, boolean>,
) {
  const getAllowed =
    allowedByCode instanceof Map
      ? (code: string) => Boolean(allowedByCode.get(code))
      : (code: string) => Boolean(allowedByCode[code]);
  return bundle.codes.every((code) => getAllowed(code));
}

export function isBundlePartiallyAllowed(
  bundle: RolePermissionBundle,
  allowedByCode: Map<string, boolean> | Record<string, boolean>,
) {
  const getAllowed =
    allowedByCode instanceof Map
      ? (code: string) => Boolean(allowedByCode.get(code))
      : (code: string) => Boolean(allowedByCode[code]);
  const allowedCount = bundle.codes.filter((code) => getAllowed(code)).length;
  return allowedCount > 0 && allowedCount < bundle.codes.length;
}

export const ADMIN_ONLY_PERMISSIONS: PermissionCode[] = [
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.ROLES_CUSTOMIZE,
  PERMISSIONS.COMPANY_SETTINGS_WRITE,
  PERMISSIONS.ACTIVITY_READ,
  PERMISSIONS.PROJECTS_ALL,
  PERMISSIONS.PROJECTS_USERS_MANAGE,
];

const ALL_CODES = [
  ...ADMIN_ONLY_PERMISSIONS,
  ...PERMISSION_CATALOG.map((item) => item.code),
];

const PROJECT_MANAGER_CODES: PermissionCode[] = [
  PERMISSIONS.CLIENTS_MANAGE,
  PERMISSIONS.PROJECTS_MANAGE,
  PERMISSIONS.GODOWNS_READ,
  PERMISSIONS.STOCK_READ,
];

const PROJECT_SUPERVISOR_CODES: PermissionCode[] = [
  PERMISSIONS.STOCK_READ,
  PERMISSIONS.TRANSFERS_RECEIVE,
  PERMISSIONS.USAGE_CREATE,
];

const STORE_MANAGER_CODES: PermissionCode[] = [
  PERMISSIONS.GODOWNS_CREATE,
  PERMISSIONS.GODOWNS_READ,
  PERMISSIONS.GODOWNS_UPDATE,
  PERMISSIONS.GODOWNS_DELETE,
  PERMISSIONS.GODOWNS_ASSIGN,
  PERMISSIONS.MATERIALS_MANAGE,
  PERMISSIONS.STOCK_READ,
  PERMISSIONS.RECEIPTS_CREATE,
  PERMISSIONS.USAGE_CREATE,
  PERMISSIONS.DISCARDS_CREATE,
  PERMISSIONS.DISCARDS_APPROVE,
  PERMISSIONS.TRANSFERS_CREATE,
  PERMISSIONS.TRANSFERS_APPROVE,
  PERMISSIONS.TRANSFERS_DISPATCH,
  PERMISSIONS.TRANSFERS_RECEIVE,
];

export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRoleSlug, PermissionCode[]> = {
  ADMIN: ALL_CODES,
  PROJECT_MANAGER: PROJECT_MANAGER_CODES,
  PROJECT_SUPERVISOR: PROJECT_SUPERVISOR_CODES,
  STORE_MANAGER: STORE_MANAGER_CODES,
};

export function isIndianMobile(phone: string): boolean {
  return /^\+91[6-9]\d{9}$/.test(phone);
}

export type AreaUnitCode = "SQ_FT" | "SQ_M";

export function areaUnitSymbol(unit: string): "sqft" | "sqm" {
  return unit === "SQ_M" ? "sqm" : "sqft";
}

export function areaUnitLabel(unit: string): string {
  return unit === "SQ_M" ? "Square meter (sqm)" : "Square foot (sqft)";
}

const SQ_M_TO_SQ_FT = 10.76391041671;

export function convertArea(value: number, from: string, to: string): number {
  if (!Number.isFinite(value) || from === to) {
    return value;
  }
  if (from === "SQ_M" && to === "SQ_FT") {
    return value * SQ_M_TO_SQ_FT;
  }
  if (from === "SQ_FT" && to === "SQ_M") {
    return value / SQ_M_TO_SQ_FT;
  }
  return value;
}

export function formatAreaValue(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_00_00_000) {
    return `${sign}${trimShortNumber(abs / 1_00_00_000)}Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}${trimShortNumber(abs / 1_00_000)}L`;
  }
  if (abs >= 1_000) {
    return `${sign}${trimShortNumber(abs / 1_000)}K`;
  }
  if (abs >= 100) {
    return `${sign}${Math.round(abs).toLocaleString("en-IN")}`;
  }
  return `${sign}${abs.toLocaleString("en-IN", { maximumFractionDigits: 1 })}`;
}

function trimShortNumber(value: number): string {
  const fixed = value.toFixed(2);
  return fixed.replace(/\.?0+$/, "");
}

export const PROJECT_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_HOLD", label: "Inactive" },
  { value: "COMPLETED", label: "Completed" },
] as const;

export type ProjectStatusOption = (typeof PROJECT_STATUS_OPTIONS)[number]["value"];

export function toEditableProjectStatus(status: string): ProjectStatusOption {
  if (status === "COMPLETED") {
    return "COMPLETED";
  }
  if (status === "ACTIVE" || status === "PLANNING") {
    return "ACTIVE";
  }
  return "ON_HOLD";
}

export function formatProjectStatus(status: string): string {
  if (status === "ON_HOLD" || status === "CANCELLED") {
    return "Inactive";
  }
  if (status === "COMPLETED") {
    return "Completed";
  }
  if (status === "PLANNING") {
    return "Planning";
  }
  return "Active";
}

export const SPACE_TYPES = ["BEDROOM", "LIVING_HALL", "KITCHEN", "BATHROOM", "OTHER"] as const;

export type SpaceTypeCode = (typeof SPACE_TYPES)[number];

export function formatFloorLabel(floor: number): string {
  if (floor === 0) {
    return "Ground";
  }
  if (floor < 0) {
    return `B${Math.abs(floor)}`;
  }
  return `Floor ${floor}`;
}

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  let value = trimmed.replace(/[^\d+]/g, "");
  if (value.startsWith("00")) {
    value = `+${value.slice(2)}`;
  }
  if (!value.startsWith("+")) {
    if (/^[6-9]\d{9}$/.test(value)) {
      value = `+91${value}`;
    } else if (/^91[6-9]\d{9}$/.test(value)) {
      value = `+${value}`;
    } else {
      return null;
    }
  }
  if (isIndianMobile(value)) {
    return value;
  }
  return null;
}

export function formatPhoneDisplay(phone: string): string {
  const raw = phone.trim();
  const normalized = normalizePhone(raw);
  const e164 = normalized ?? (/^\+91\d{10}$/.test(raw) ? raw : null);
  if (e164?.startsWith("+91") && e164.length === 13) {
    const local = e164.slice(3);
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  if (raw.startsWith("+")) {
    return raw;
  }
  return phone;
}

export function computeProjectCompletion(
  spaces: { area: number; completionPercent: number }[],
): number {
  const totalArea = spaces.reduce((sum, space) => sum + space.area, 0);
  if (totalArea <= 0) {
    return 0;
  }
  const weighted = spaces.reduce(
    (sum, space) => sum + space.area * space.completionPercent,
    0,
  );
  return weighted / totalArea;
}
