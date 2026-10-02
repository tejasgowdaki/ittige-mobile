import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ClientApiError, type MeResponse } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { loadCompanyId, saveCompanyId } from "@/lib/session-store";

type CompanyContextValue = {
  me: MeResponse | null;
  loading: boolean;
  error: string | null;
  companyId: string | null;
  companyName: string | null;
  setCompanyId: (id: string) => void;
  refresh: () => Promise<void>;
  createCompany: (name: string) => Promise<void>;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

function resolveCompanyId(me: MeResponse | null, preferred: string | null) {
  if (!me) return null;
  const match = preferred ? me.companies.find((company) => company.id === preferred) : null;
  return match?.id ?? me.companies[0]?.id ?? null;
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiFetch<MeResponse>("/api/v1/me"),
    staleTime: 30_000,
  });
  const [companyId, setCompanyIdState] = useState<string | null>(null);
  const [storedReady, setStoredReady] = useState(false);

  useEffect(() => {
    void loadCompanyId().finally(() => setStoredReady(true));
  }, []);

  useEffect(() => {
    if (meQuery.error instanceof ClientApiError && meQuery.error.status === 401) {
      void signOut();
    }
  }, [meQuery.error, signOut]);

  useEffect(() => {
    if (!meQuery.data || !storedReady) return;
    void loadCompanyId().then((stored) => {
      const next = resolveCompanyId(meQuery.data, stored);
      setCompanyIdState(next);
      if (next) void saveCompanyId(next);
    });
  }, [meQuery.data, storedReady]);

  const setCompanyId = useCallback((id: string) => {
    setCompanyIdState(id);
    void saveCompanyId(id);
  }, []);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.me });
  }, [queryClient]);

  const createCompany = useCallback(
    async (name: string) => {
      const company = await apiFetch<{ id: string; name: string }>("/api/v1/companies", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      setCompanyId(company.id);
    },
    [queryClient, setCompanyId],
  );

  const me = meQuery.data ?? null;
  const companyName = me?.companies.find((company) => company.id === companyId)?.name ?? null;
  const loading = meQuery.isPending || (meQuery.isFetching && !me) || !storedReady;
  const error = meQuery.error
    ? meQuery.error instanceof Error
      ? meQuery.error.message
      : "Failed to load profile"
    : null;

  return (
    <CompanyContext.Provider
      value={{ me, loading, error, companyId, companyName, setCompanyId, refresh, createCompany }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const value = useContext(CompanyContext);
  if (!value) throw new Error("useCompany must be used within CompanyProvider");
  return value;
}

export function useCompanyGate() {
  const { me, loading, error } = useCompany();
  return {
    loading,
    error,
    needsOnboarding: !loading && me !== null && me.companies.length === 0,
  };
}
