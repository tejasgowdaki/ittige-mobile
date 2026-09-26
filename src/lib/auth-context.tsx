import { signOut as firebaseSignOut } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api-client";
import { getFirebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase";
import { clearSessionToken, loadSessionToken, saveSessionToken } from "@/lib/session-store";

type AuthContextValue = {
  ready: boolean;
  signedIn: boolean;
  establishSession: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void loadSessionToken().then((token) => {
      setSignedIn(Boolean(token));
      setReady(true);
    });
  }, []);

  const establishSession = useCallback(async (idToken: string) => {
    const payload = await apiFetch<{ sessionToken: string }>("/api/v1/auth/session", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    if (!payload.sessionToken) {
      throw new Error("Could not create session");
    }
    await saveSessionToken(payload.sessionToken);
    setSignedIn(true);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiFetch("/api/v1/auth/session", { method: "DELETE" });
    } catch {
      // Local sign-out still proceeds if the token is already invalid.
    }
    if (isFirebaseClientConfigured()) {
      try {
        await firebaseSignOut(getFirebaseAuth());
      } catch {
        // Firebase may not have a current user when the session came from storage.
      }
    }
    await clearSessionToken();
    setSignedIn(false);
  }, []);

  return (
    <AuthContext.Provider value={{ ready, signedIn, establishSession, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
