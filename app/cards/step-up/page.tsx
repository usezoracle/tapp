"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PiFingerprintBold, PiCheckCircleFill } from "react-icons/pi";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { InputError } from "@/components/ui/InputError";
import { StatusChip } from "@/components/ui/StatusChip";
import {
  AnimatedComponent,
  slideInOut,
} from "@/components/ui/AnimatedComponents";

/**
 * Step-up biometric confirm for a large debit the merchant initiated
 * via QR (`/cards/step-up?token=…`). Real impl will call
 * `navigator.credentials.get(...)` for a WebAuthn assertion and POST
 * it to Rails to lift the per-tap cap once. v1 stubs the WebAuthn
 * round-trip so the UX is testable without a registered authenticator.
 */
export default function StepUpPage() {
  return (
    <Suspense fallback={<Screen centered />}>
      <Body />
    </Suspense>
  );
}

function Body() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [phase, setPhase] = useState<"ready" | "checking" | "done" | "error">("ready");
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setError(null);
    setPhase("checking");
    try {
      // TODO: replace with real WebAuthn assertion.
      // const cred = await navigator.credentials.get({ publicKey: ... });
      // await cardsApi.stepUpConfirm(token, cred);
      await new Promise((r) => setTimeout(r, 900));
      if (!token) throw new Error("Missing step-up token.");
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Biometric check failed");
      setPhase("error");
    }
  }

  if (phase === "done") {
    return (
      <Screen centered>
        <AnimatedComponent
          variant={slideInOut}
          className="flex flex-col items-center gap-6 text-center"
        >
          <StatusChip tone="success" icon={<PiCheckCircleFill />}>
            Approved
          </StatusChip>
          <p className="text-sm text-gray-500 dark:text-white/50">
            You can return to the merchant — they&apos;ll see the green light.
          </p>
          <Link href="/wallet" className="w-full">
            <Button>Back to wallet</Button>
          </Link>
        </AnimatedComponent>
      </Screen>
    );
  }

  return (
    <Screen centered>
      <AnimatedComponent
        variant={slideInOut}
        className="flex flex-col items-center gap-6 text-center"
      >
        <PiFingerprintBold className="text-5xl text-blue-600 dark:text-blue-500" />
        <div className="space-y-2">
          <h1 className="text-xl font-medium text-neutral-900 dark:text-white">
            Confirm a large debit
          </h1>
          <p className="max-w-xs text-sm text-gray-500 dark:text-white/50">
            The merchant requested a biometric check before this payment can
            go through. Use Face ID or Touch ID on this device to approve.
          </p>
        </div>
        {error ? <InputError message={error} /> : null}
        <Button onClick={go} loading={phase === "checking"}>
          Use Face ID / Touch ID
        </Button>
        <Link
          href="/wallet"
          className="text-sm text-gray-500 hover:text-neutral-900 dark:text-white/50 dark:hover:text-white"
        >
          Cancel
        </Link>
      </AnimatedComponent>
    </Screen>
  );
}
