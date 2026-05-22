"use client";

/**
 * Auth scaffold for the Tapp PWA.
 *
 * v1 will use Google OAuth → zkLogin (Mysten reference flow) to derive
 * a Sui address and a Rails JWT. For the PoC scope (claim-only) we
 * keep the surface here as a thin facade so swapping the stub for the
 * real zkLogin pipeline is a one-file change.
 *
 * Until the real flow is wired:
 *   - `signInWithGoogle()` mocks success after a short delay
 *   - `getSession()` returns the mocked session from localStorage
 *   - `signOut()` clears it
 *
 * Replace each function body when the real OAuth + zkLogin lands.
 */

import { useCallback, useEffect, useState } from "react";

export interface Session {
  jwt: string;
  email: string;
  suiAddress: string;
}

const STORAGE_KEY = "tapp.session.v1";

export async function signInWithGoogle(): Promise<Session> {
  // TODO(zklogin): real flow — Google OAuth → ID token → zkLogin proof
  // → Sui address → exchange for Rails JWT via POST /v1/auth/google.
  await new Promise((r) => setTimeout(r, 600));
  const session: Session = {
    jwt: "stub-jwt-not-real",
    email: "you@zoracle.test",
    suiAddress: "0xtest_stub_zkloginAddr_0000000000000000000000",
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
  return session;
}

export function signOut(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/**
 * Reactive session hook. SSR-safe — returns `null` on the server and
 * hydrates from localStorage in an effect (so first paint isn't
 * tagged with the wrong auth state).
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSession(readSession());
    setHydrated(true);
  }, []);

  const refresh = useCallback(() => setSession(readSession()), []);

  const clear = useCallback(() => {
    signOut();
    setSession(null);
  }, []);

  return { session, hydrated, refresh, clear };
}
