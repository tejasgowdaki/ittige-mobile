import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "stockinsight.sessionToken";
const COMPANY_KEY = "stockinsight.companyId";

let memoryToken: string | null = null;

export function getSessionToken() {
  return memoryToken;
}

export async function loadSessionToken() {
  memoryToken = await SecureStore.getItemAsync(SESSION_KEY);
  return memoryToken;
}

export async function saveSessionToken(token: string) {
  memoryToken = token;
  await SecureStore.setItemAsync(SESSION_KEY, token);
}

export async function clearSessionToken() {
  memoryToken = null;
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function loadCompanyId() {
  return SecureStore.getItemAsync(COMPANY_KEY);
}

export async function saveCompanyId(companyId: string) {
  await SecureStore.setItemAsync(COMPANY_KEY, companyId);
}

const recentKey = (companyId: string) => `stockinsight.recent.${companyId}`;

export async function readRecentProjectIds(companyId: string): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(recentKey(companyId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string").slice(0, 3);
  } catch {
    return [];
  }
}

export async function touchRecentProject(companyId: string, projectId: string) {
  const next = [
    projectId,
    ...(await readRecentProjectIds(companyId)).filter((id) => id !== projectId),
  ].slice(0, 3);
  await SecureStore.setItemAsync(recentKey(companyId), JSON.stringify(next));
}
