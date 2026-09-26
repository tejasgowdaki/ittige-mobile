import { File } from "expo-file-system";
import { getSessionToken } from "@/lib/session-store";

export type MeResponse = {
  id: string;
  email: string | null;
  name: string;
  phone: string;
  companies: {
    id: string;
    name: string;
    companyRole: string;
    roleName: string;
    allProjects: boolean;
    permissions: string[];
  }[];
  projectAssignments: {
    projectId: string;
    projectName: string;
    projectCode: string;
    companyId: string;
    roleSlug: string;
    roleName: string;
  }[];
  godownAssignments: {
    godownId: string;
    godownName: string;
    companyId: string;
  }[];
};

export class ClientApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function apiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  return configured || "http://localhost:3000";
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { companyId?: string | null } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (options.companyId) {
    headers.set("X-Company-Id", options.companyId);
  }
  const token = getSessionToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const payload = (await response.json()) as { error?: string };
      message = payload.error ?? message;
    } catch {
      message = response.statusText || message;
    }
    throw new ClientApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function uploadMedia(input: {
  companyId: string;
  ownerType: string;
  ownerId: string;
  uri: string;
  name?: string;
  mimeType?: string;
}) {
  const form = new FormData();
  form.append("ownerType", input.ownerType);
  form.append("ownerId", input.ownerId);
  form.append("file", new File(input.uri));
  await apiFetch("/api/v1/media", {
    method: "POST",
    companyId: input.companyId,
    body: form,
  });
}
