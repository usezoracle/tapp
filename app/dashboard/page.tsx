"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Screen } from "@/components/ui/Screen";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/auth";

/**
 * Cardholder dashboard. v1 = single card per user, so this is mostly
 * a router shim that redirects into the user's one card. When v2
 * lifts the 1:1 constraint, render the card carousel here.
 *
 * PoC scope: just show an empty-state with a "tap your card" prompt
 * until we wire `GET /v1/cards/me`.
 */
export default function DashboardPage() {
  const router = useRouter();
  const { hydrated, session, clear } = useSession();

  useEffect(() => {
    if (hydrated && !session) router.replace("/sign-in?next=/dashboard");
  }, [hydrated, session, router]);

  if (!hydrated || !session) return <Screen />;

  return (
    <Screen>
      <header className="flex items-center justify-between mb-10">
        <Logo />
        <Button variant="ghost" fullWidth={false} onClick={clear}>
          Sign out
        </Button>
      </header>

      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-ink">Hi there</h1>
          <p className="text-muted-text text-sm break-all">{session.email}</p>
        </div>

        <div className="rounded-2xl border border-line-divider bg-surface-soft p-6 space-y-3">
          <h2 className="font-semibold text-ink">No card linked yet</h2>
          <p className="text-sm text-muted-text">
            Tap a Zoracle card on the back of your phone to link it to your
            account.
          </p>
        </div>
      </div>
    </Screen>
  );
}
