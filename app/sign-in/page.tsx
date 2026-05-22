"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Screen } from "@/components/ui/Screen";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { signInWithGoogle, useSession } from "@/lib/auth";

/**
 * Sign-in entry point. Currently a Google-only OAuth stub (see
 * `lib/auth.ts`). Real zkLogin pipeline lands when the Mysten SDK
 * deps are added — the API surface here stays the same.
 *
 * Honors a `next=…` search param so the claim flow can route back
 * to itself after a successful sign-in (`/link?token=…` → sign-in →
 * `/link?token=…`).
 */
export default function SignInPage() {
  // `useSearchParams` triggers a CSR bail-out; wrap the reader in
  // Suspense so the static shell can still prerender.
  return (
    <Suspense fallback={<Screen centered />}>
      <SignInBody />
    </Suspense>
  );
}

function SignInBody() {
  const router = useRouter();
  const params = useSearchParams();
  const nextHref = params.get("next") ?? "/dashboard";
  const { hydrated, session, refresh } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hydrated && session) {
    router.replace(nextHref);
    return null;
  }

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      refresh();
      router.replace(nextHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setLoading(false);
    }
  }

  return (
    <Screen centered>
      <div className="flex flex-col items-center gap-8 text-center">
        <Logo />
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold text-ink">Welcome</h1>
          <p className="text-muted-text">
            Sign in with Google to get started.
          </p>
        </div>
        <Button onClick={handleSignIn} loading={loading}>
          Continue with Google
        </Button>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <p className="text-xs text-muted-subtle">
          By signing in you agree to the{" "}
          <a href="/terms" className="underline">
            terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="underline">
            privacy policy
          </a>
          .
        </p>
      </div>
    </Screen>
  );
}
