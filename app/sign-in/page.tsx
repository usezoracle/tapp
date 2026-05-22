"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Screen } from "@/components/ui/Screen";
import { Logo } from "@/components/ui/Logo";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { useSession } from "@/lib/auth";

/**
 * Sign-in entry point — Google OAuth.
 *
 * Honors a `next=…` search param so the claim flow can route back
 * to itself after a successful sign-in (`/link?token=…` → sign-in
 * → `/link?token=…`).
 */
export default function SignInPage() {
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

  if (hydrated && session) {
    router.replace(nextHref);
    return null;
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
        <GoogleSignInButton
          onSuccess={() => {
            refresh();
            router.replace(nextHref);
          }}
        />
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
