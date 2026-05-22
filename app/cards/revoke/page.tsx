"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Screen } from "@/components/ui/Screen";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/auth";
import { cardsApi, ApiError } from "@/lib/api";

/**
 * Revoke = on-chain `set_revoked(true)`. After it confirms, no
 * subsequent merchant debit can succeed (Move aborts on the revoked
 * flag). The cardholder can re-enable with `set_revoked(false)`
 * later — destruction (full balance reclaim) is a separate flow.
 */
export default function RevokePage() {
  const router = useRouter();
  const { hydrated, session } = useSession();
  const [phase, setPhase] = useState<"confirm" | "signing" | "done" | "error">("confirm");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !session) router.replace("/sign-in?next=/cards/revoke");
  }, [hydrated, session, router]);

  async function go() {
    if (!session) return;
    setError(null);
    setPhase("signing");
    try {
      const skeleton = await cardsApi.revoke(session.jwt);
      // Demo mode for v1 — see top-up page note about wiring the real
      // zkLogin sign + submit.
      console.info("Revoke PTB skeleton (sign + submit):", skeleton);
      setPhase("done");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.message}${err.code ? ` (${err.code})` : ""}`
          : err instanceof Error
            ? err.message
            : "Revoke failed";
      setError(msg);
      setPhase("error");
    }
  }

  return (
    <Screen centered>
      <div className="flex flex-col items-center text-center gap-8 w-full">
        <Logo />
        {phase === "done" ? (
          <>
            <p className="text-ink">Card revoked. No more taps will be charged.</p>
            <Link href="/dashboard">
              <Button>Back to dashboard</Button>
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-danger">Revoke this card?</h1>
            <p className="text-muted-text">
              Once revoked, merchants can&apos;t debit it. You can re-enable it
              from the dashboard, or destroy it later to reclaim the balance.
            </p>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button variant="danger" onClick={go} loading={phase === "signing"}>
              Revoke
            </Button>
            <Link href="/dashboard" className="text-sm text-muted-text">
              Keep card active
            </Link>
          </>
        )}
      </div>
    </Screen>
  );
}
