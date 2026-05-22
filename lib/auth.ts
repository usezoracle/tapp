"use client";

/**
 * Auth for the Tapp PWA.
 *
 * Cardholder sign-in goes through Google OAuth: the PWA gets a Google
 * ID token via @react-oauth/google, POSTs it to Rails
 * `/v1/auth/google`, which verifies against Google's JWKS, finds or
 * creates the User, and returns a Rails JWT pair.
 *
 * v1.x lift: stack the Mysten zkLogin proof on top of the Google ID
 * token before exchanging — same surface here, the swap happens in
 * `signInWithGoogleCredential` below.
 */

import { useCallback, useEffect, useState } from "react";

export interface Session {
  jwt: string;
  refreshJwt: string;
  email: string;
  scope: string;
  /**
   * Sui address derived from zkLogin. Empty string until the real
   * Mysten flow is wired (currently we only run the Google OAuth half
   * of the eventual zkLogin pipeline).
   */
  suiAddress: string;
}

const STORAGE_KEY = "tapp.session.v1";
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

interface GoogleAuthResponse {
  access_token: string;
  refresh_token: string;
  email: string;
  scope: string;
  is_new_user: boolean;
}

interface RailsEnvelope<T> {
  status: "success" | "error";
  message: string;
  data?: T;
}

/**
 * Exchange a Google ID-token credential for a Rails session JWT. Call
 * this from a Google Sign-In success handler (see
 * `components/GoogleSignInButton.tsx`).
 */
export async function signInWithGoogleCredential(
  idToken: string,
): Promise<Session> {
  const res = await fetch(`${API_BASE}/v1/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  const body = (await res.json()) as RailsEnvelope<GoogleAuthResponse>;
  if (!res.ok || body.status !== "success" || !body.data) {
    throw new Error(body.message || `Google sign-in failed (${res.status})`);
  }

  const session: Session = {
    jwt: body.data.access_token,
    refreshJwt: body.data.refresh_token,
    email: body.data.email,
    scope: body.data.scope,
    suiAddress: "", // TODO(zklogin): derive from Google ID token + zkLogin proof
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
 * hydrates from localStorage in an effect.
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
