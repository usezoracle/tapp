"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Screen } from "@/components/ui/Screen";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/auth";
import { cardsApi, ApiError } from "@/lib/api";
import { hexToBytes } from "@/lib/cardCrypto";
import {
  packCardPayload,
  readCardPayload,
  webNfcSupported,
  writeCardPayload,
} from "@/lib/webnfc";

/**
 * Torn-write recovery. Fetches the server's canonical token + a
 * one-shot resync_nonce, asks the cardholder to tap, writes the
 * payload, then POSTs /me/resync/complete to clear the
 * needs_resync flag.
 *
 * iOS: Web NFC isn't supported. We surface the admin-recovery escape
 * hatch copy.
 */
export default function ResyncPage() {
  const router = useRouter();
  const { hydrated, session } = useSession();
  const [phase, setPhase] = useState<"ready" | "fetching" | "writing" | "done" | "error">("ready");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !session) router.replace("/sign-in?next=/cards/resync");
  }, [hydrated, session, router]);

  async function go() {
    if (!session) return;
    setError(null);
    setPhase("fetching");
    try {
      if (!webNfcSupported()) {
        throw new Error(
          "iOS Safari can't write to NFC cards. Borrow an Android phone, or contact support for a remote recovery.",
        );
      }
      const payload = await cardsApi.resync(session.jwt);
      const tokenBytes = hexToBytes(payload.current_token_ct);
      // The card payload is `K || token`. To preserve K on resync we
      // need it from the card — read first, splice in the server's
      // token, write back.
      setPhase("writing");
      const { payload: existing } = await readCardPayload();
      if (existing.length !== 64) {
        throw new Error("Card payload looks wrong — needs re-linking.");
      }
      const K = existing.slice(0, 32);
      const newPayload = packCardPayload(K, tokenBytes);
      await writeCardPayload(newPayload);
      await cardsApi.resyncComplete(payload.resync_nonce, session.jwt);
      setPhase("done");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.message}${err.code ? ` (${err.code})` : ""}`
          : err instanceof Error
            ? err.message
            : "Resync failed";
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
            <p className="text-ink">Card is back in sync. Try tapping at a merchant again.</p>
            <Link href="/dashboard">
              <Button>Done</Button>
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-ink">Resync your card</h1>
            <p className="text-muted-text">
              Tap your card to your phone — we&apos;ll write the canonical token back
              and bring it in sync. ~3 seconds.
            </p>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button
              onClick={go}
              loading={phase === "fetching" || phase === "writing"}
            >
              Start resync
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
