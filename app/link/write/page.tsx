"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Screen } from "@/components/ui/Screen";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { IconContactlessCard } from "@/lib/icons";
import {
  deriveLinkingProofs,
  newCardPassword,
  newRotationToken,
  randomBytes,
  uidHash,
} from "@/lib/cardCrypto";
import { packCardPayload, readCardPayload, webNfcSupported, writeCardPayload } from "@/lib/webnfc";
import { useLinkStore } from "@/lib/cardLinkStore";

/**
 * Step 3 of 4 — Web NFC write of K (the on-card secret) and the
 * initial rotation token. We generate K + the rotation token here,
 * compute the linking_proof and pin_verifier from K + the chosen PIN,
 * then write `K || token` to the card sector.
 *
 * On success we navigate to /link/sign where the cardholder zkLogin-
 * signs the create_cap PTB to fund the on-chain cap object.
 */
export default function LinkWritePage() {
  return (
    <Suspense fallback={<Screen centered />}>
      <Body />
    </Suspense>
  );
}

type Phase = "ready" | "writing" | "done" | "error";

function Body() {
  const router = useRouter();
  const params = useSearchParams();
  const cardId = params.get("card");

  const pin = useLinkStore((s) => s.pin);
  const setCryptoMaterial = useLinkStore((s) => s.setCryptoMaterial);
  const setCardUidHash = useLinkStore((s) => s.setCardUidHash);

  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState<string | null>(null);

  // Bounce back if state is missing — e.g. user landed here directly.
  useEffect(() => {
    if (!cardId || !pin) router.replace("/dashboard");
  }, [cardId, pin, router]);

  async function startWrite() {
    if (!pin) return;
    setError(null);
    setPhase("writing");

    try {
      if (!webNfcSupported()) {
        throw new Error(
          "Web NFC isn't available — open this page in Chrome on Android.",
        );
      }

      // Generate K, the rotation token, the card password, and the
      // HMAC derivatives the server will commit to.
      const K = randomBytes(32);
      const rotationToken = newRotationToken();
      const cardPassword = newCardPassword();
      const { linkingProof, pinVerifier } = deriveLinkingProofs(K, pin);
      const payload = packCardPayload(K, rotationToken);

      await writeCardPayload(payload);

      // After write, read the UID back so we can hash it. Web NFC's
      // write() doesn't expose the serial directly, so we do a quick
      // read on the next tap. UX-wise it's the same tap action.
      // TODO: combine read+write into one tap via NDEFReader.scan()
      // followed by .write() with the same signal — Chromium supports
      // this in recent versions.
      const { uid } = await readCardPayload();
      const cardUidHash = uidHash(uid);

      setCryptoMaterial({ K, linkingProof, pinVerifier, cardPassword, rotationToken });
      setCardUidHash(cardUidHash);
      setPhase("done");
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Could not write to card");
    }
  }

  function next() {
    router.push(`/link/sign?card=${cardId}`);
  }

  return (
    <Screen centered>
      <div className="flex flex-col items-center text-center gap-8">
        <Logo />
        {phase === "ready" ? (
          <ReadyState onStart={startWrite} />
        ) : phase === "writing" ? (
          <WritingState />
        ) : phase === "done" ? (
          <DoneState onNext={next} />
        ) : (
          <ErrorState message={error} onRetry={startWrite} />
        )}
      </div>
    </Screen>
  );
}

function ReadyState({ onStart }: { onStart: () => void }) {
  return (
    <>
      <div className="w-24 h-24 rounded-full bg-brand-green/15 items-center justify-center flex">
        <Icon xml={IconContactlessCard} width={44} height={62} />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-ink">Tap your card</h1>
        <p className="text-muted-text">
          Place the card against the back of your phone. We&apos;ll set it up in
          a single tap.
        </p>
      </div>
      <Button onClick={onStart}>Start</Button>
    </>
  );
}

function WritingState() {
  return (
    <>
      <div
        aria-hidden
        className="w-10 h-10 rounded-full border-2 border-line-muted border-t-brand-green animate-spin"
      />
      <p className="text-muted-text">Writing to your card — keep it on the phone…</p>
    </>
  );
}

function DoneState({ onNext }: { onNext: () => void }) {
  return (
    <>
      <div className="w-24 h-24 rounded-full bg-success-bg flex items-center justify-center">
        <span className="text-4xl">✓</span>
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-ink">Card configured</h1>
        <p className="text-muted-text">
          Last step: confirm with Google to fund the card on-chain.
        </p>
      </div>
      <Button onClick={onNext}>Continue</Button>
    </>
  );
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <>
      <p className="text-danger text-center">{message ?? "Something went wrong"}</p>
      <Button onClick={onRetry}>Try again</Button>
    </>
  );
}
