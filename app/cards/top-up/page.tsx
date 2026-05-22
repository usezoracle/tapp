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
 * Top-up: cardholder picks an amount, server returns the PTB
 * skeleton, PWA zkLogin-signs it (or stubs in demo mode).
 */
export default function TopUpPage() {
  const router = useRouter();
  const { hydrated, session } = useSession();
  const [amount, setAmount] = useState(25); // USDC
  const [phase, setPhase] = useState<"ready" | "signing" | "done" | "error">("ready");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !session) router.replace("/sign-in?next=/cards/top-up");
  }, [hydrated, session, router]);

  async function go() {
    if (!session) return;
    setError(null);
    setPhase("signing");
    try {
      // Cents → server expects an integer "subunit". For USDC 6-decimals
      // the on-chain math happens at PTB build time; here we just send
      // the amount in cents (10^-2) for display + record-keeping.
      const skeleton = await cardsApi.topUp(Math.round(amount * 100), session.jwt);
      // Demo mode: skip the actual sign. Real path TODO:
      // dynamically import @/lib/zklogin, build tx from skeleton, sign + submit.
      console.info("Top-up PTB skeleton (sign + submit):", skeleton);
      setPhase("done");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.message}${err.code ? ` (${err.code})` : ""}`
          : err instanceof Error
            ? err.message
            : "Top-up failed";
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
            <div className="w-24 h-24 rounded-full bg-success-bg flex items-center justify-center">
              <span className="text-4xl">✓</span>
            </div>
            <p className="text-ink">Top-up signed. Your balance will update once the tx confirms.</p>
            <Link href="/dashboard">
              <Button>Back to dashboard</Button>
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-ink">Top up your card</h1>
            <div className="space-y-2 w-full">
              <div className="flex justify-between items-baseline">
                <label className="text-sm font-medium text-ink">Amount</label>
                <span className="text-sm font-semibold text-ink tabular-nums">${amount}</span>
              </div>
              <input
                type="range"
                min={5}
                max={500}
                step={5}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full accent-brand-green"
              />
              <p className="text-xs text-muted-subtle">
                USDC added to your on-chain spending cap. Sign with Google to confirm.
              </p>
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button onClick={go} loading={phase === "signing"}>
              Sign &amp; top up
            </Button>
            <Link href="/dashboard" className="text-sm text-muted-text">
              Cancel
            </Link>
          </>
        )}
      </div>
    </Screen>
  );
}
