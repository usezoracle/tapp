"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Screen } from "@/components/ui/Screen";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/auth";
import { useLinkStore } from "@/lib/cardLinkStore";
import { bytesToHex } from "@/lib/cardCrypto";
import { cardsApi, ApiError } from "@/lib/api";

/**
 * Step 4 of 4 — zkLogin signs the on-chain `create_cap` PTB and
 * POSTs `/v1/cards/link/complete` so the server can persist all the
 * verifier bytes the merchant flow needs later.
 *
 * Demo mode: when `NEXT_PUBLIC_DEMO_LINK=1` is set we skip the actual
 * Sui call (which needs a deployed Gateway + testnet USDC) and submit
 * with a stub digest so end-to-end UI flow can be exercised without
 * on-chain infra.
 *
 * Production path: dynamically imports `lib/zklogin` and executes the
 * PTB. The Mysten prover + salt service URLs come from env.
 */
export default function LinkSignPage() {
  return (
    <Suspense fallback={<Screen centered />}>
      <Body />
    </Suspense>
  );
}

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_LINK === "1";

function Body() {
  const router = useRouter();
  const params = useSearchParams();
  const cardId = params.get("card");
  const { hydrated, session } = useSession();
  const link = useLinkStore();

  const [phase, setPhase] = useState<"ready" | "signing" | "submitting" | "done" | "error">("ready");
  const [error, setError] = useState<string | null>(null);

  // Sanity: every piece of state set in the previous steps must be present.
  useEffect(() => {
    if (!cardId) router.replace("/dashboard");
    if (hydrated && !session) {
      router.replace(`/sign-in?next=/link/sign?card=${cardId ?? ""}`);
    }
    if (
      !link.K ||
      !link.linkingProof ||
      !link.pinVerifier ||
      !link.cardPassword ||
      !link.rotationToken ||
      !link.cardUidHash
    ) {
      router.replace(`/link/configure?card=${cardId ?? ""}`);
    }
  }, [cardId, hydrated, session, link, router]);

  async function go() {
    if (!session) return;
    setError(null);
    setPhase("signing");

    try {
      let capObjectId: string;
      let coinType: string;
      let txDigest: string;

      if (DEMO_MODE) {
        // Skip the Sui round-trip. PoC: useful when the deployed
        // Gateway + testnet USDC + Mysten prover aren't configured.
        capObjectId = "0xdemo_cap_" + (cardId ?? "").slice(0, 8);
        coinType = "0xdemo::usdc::USDC";
        txDigest = "demo-" + Date.now().toString(36);
      } else {
        // Real path. Dynamic import keeps the heavy Sui SDK out of the
        // demo-mode bundle.
        const zk = await import("@/lib/zklogin");
        const { Transaction } = await import("@mysten/sui/transactions");
        const packageId = process.env.NEXT_PUBLIC_TAPP_PACKAGE_ID;
        if (!packageId) {
          throw new Error(
            "NEXT_PUBLIC_TAPP_PACKAGE_ID not set — deploy the Move package or use NEXT_PUBLIC_DEMO_LINK=1.",
          );
        }
        const result = await zk.executeZkLoginTx((tx: InstanceType<typeof Transaction>) => {
          tx.moveCall({
            target: `${packageId}::tapp_card::create_cap`,
            typeArguments: [
              process.env.NEXT_PUBLIC_USDC_COIN_TYPE ??
                "0x2::coin::Coin<0x2::sui::SUI>",
            ],
            arguments: [
              // funding coin — caller's wallet selects via Mysten's
              // coinWithBalance helper; left as a TODO since real
              // amount derivation needs Coin<T> picking logic.
              tx.gas, // PLACEHOLDER — replace with coinWithBalance(client, USDC, fundingSubunit)
              tx.pure.u64(BigInt(link.dailyLimitSubunit)),
              tx.pure.u64(BigInt(link.perTapLimitSubunit)),
              tx.pure.vector("u8", Array.from(link.cardUidHash!)),
            ],
          });
        });
        // Parse created CardSpendingCap from effects.
        const created =
          (result.effects as { created?: { reference: { objectId: string } }[] })?.created ?? [];
        const cap = created[0];
        if (!cap) throw new Error("create_cap effects missing — check Move call args");
        capObjectId = cap.reference.objectId;
        coinType =
          process.env.NEXT_PUBLIC_USDC_COIN_TYPE ?? "unknown";
        txDigest = result.digest;
      }

      link.setChainResult({ capObjectId, coinType, txDigest });

      setPhase("submitting");
      await cardsApi.linkComplete(
        {
          card_uid_hash:             bytesToHex(link.cardUidHash!),
          cap_object_id:             capObjectId,
          coin_type:                 coinType,
          linking_proof:             bytesToHex(link.linkingProof!),
          pin_verifier:              bytesToHex(link.pinVerifier!),
          card_password:             bytesToHex(link.cardPassword!),
          current_token_ct:          bytesToHex(link.rotationToken!),
          tx_digest:                 txDigest,
          daily_limit_subunit:       link.dailyLimitSubunit,
          per_tap_limit_subunit:     link.perTapLimitSubunit,
          step_up_threshold_subunit: link.stepUpThresholdSubunit,
        },
        session.jwt,
      );

      // All sensitive state wiped on reset.
      link.reset();
      setPhase("done");
      router.replace(`/dashboard/cards/${cardId}`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.message}${err.code ? ` (${err.code})` : ""}`
          : err instanceof Error
            ? err.message
            : "Linking failed";
      setError(msg);
      setPhase("error");
    }
  }

  return (
    <Screen centered>
      <div className="flex flex-col items-center text-center gap-8">
        <Logo />

        {phase === "ready" ? (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-ink">
                Confirm and fund your card
              </h1>
              <p className="text-muted-text">
                Step 4 of 4 — Sign with Google to publish your spending cap
                on-chain.
                {DEMO_MODE ? " (demo mode — no Sui call)" : ""}
              </p>
            </div>
            <Button onClick={go}>Sign &amp; finish</Button>
          </>
        ) : phase === "signing" ? (
          <>
            <div
              aria-hidden
              className="w-10 h-10 rounded-full border-2 border-line-muted border-t-brand-green animate-spin"
            />
            <p className="text-muted-text">Signing on Sui…</p>
          </>
        ) : phase === "submitting" ? (
          <>
            <div
              aria-hidden
              className="w-10 h-10 rounded-full border-2 border-line-muted border-t-brand-green animate-spin"
            />
            <p className="text-muted-text">Finalizing with Zoracle…</p>
          </>
        ) : phase === "done" ? (
          <p className="text-success">Done — taking you to your card.</p>
        ) : (
          <>
            <p className="text-danger">{error}</p>
            <Button onClick={go} variant="secondary">
              Try again
            </Button>
          </>
        )}
      </div>
    </Screen>
  );
}
