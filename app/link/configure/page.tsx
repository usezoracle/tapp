"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Screen } from "@/components/ui/Screen";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/auth";
import { useLinkStore } from "@/lib/cardLinkStore";
import { formatNgn } from "@/lib/utils";

/**
 * Step 2 of 4 — Configure limits + PIN + funding.
 *
 * The user just claimed the card at /link?token=… (Act 1) and is
 * being walked through funding it. Defaults match the locked v1
 * thresholds from `tapp-card-spec.md`: per-tap ₦2k, step-up ₦15k,
 * daily ₦40k. USDC funding default = $25 (~₦40k at ~1600 NGN/USD).
 *
 * Submitting persists the choices in zustand and routes to /link/write
 * for the NFC tap.
 */
export default function LinkConfigurePage() {
  return (
    <Suspense fallback={<Screen centered />}>
      <Body />
    </Suspense>
  );
}

const DEFAULTS = {
  dailyNGN:    40_000,
  perTapNGN:   2_000,
  stepUpNGN:   15_000,
  fundingUSDC: 25,
};

function Body() {
  const router = useRouter();
  const params = useSearchParams();
  const cardId = params.get("card");
  const { hydrated, session } = useSession();
  const setCardId = useLinkStore((s) => s.setCardId);
  const setLimits = useLinkStore((s) => s.setLimits);

  const [daily, setDaily] = useState(DEFAULTS.dailyNGN);
  const [perTap, setPerTap] = useState(DEFAULTS.perTapNGN);
  const [stepUp, setStepUp] = useState(DEFAULTS.stepUpNGN);
  const [funding, setFunding] = useState(DEFAULTS.fundingUSDC);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Redirect if missing context.
  useEffect(() => {
    if (!cardId) router.replace("/dashboard");
    if (hydrated && !session) router.replace(`/sign-in?next=/link/configure?card=${cardId ?? ""}`);
    if (cardId) setCardId(cardId);
  }, [cardId, hydrated, session, router, setCardId]);

  function submit() {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError("PIN must be 4 digits.");
      return;
    }
    if (pin !== pinConfirm) {
      setError("PINs don't match.");
      return;
    }
    if (perTap > stepUp || stepUp > daily) {
      setError("Limits must satisfy: per-tap ≤ step-up ≤ daily.");
      return;
    }
    // Convert NGN → kobo (subunit). USDC funding stored as cents for
    // server-side display consistency; actual on-chain amount is
    // computed at PTB build time.
    setLimits({
      daily:   daily * 100,
      perTap:  perTap * 100,
      stepUp:  stepUp * 100,
      funding: Math.round(funding * 100),
      pin,
    });
    router.push(`/link/write?card=${cardId}`);
  }

  return (
    <Screen>
      <div className="space-y-8 pb-12">
        <header className="space-y-2">
          <Logo />
          <h1 className="text-2xl font-semibold text-ink mt-4">
            Set your limits
          </h1>
          <p className="text-sm text-muted-text">
            Step 2 of 4 — set how much your card can spend.
          </p>
        </header>

        <LimitField
          label="Daily limit"
          help="Max total spend per UTC day"
          value={daily}
          onChange={setDaily}
          min={5_000}
          max={200_000}
          step={5_000}
        />
        <LimitField
          label="Per-tap limit"
          help="Taps below this need no PIN"
          value={perTap}
          onChange={setPerTap}
          min={500}
          max={5_000}
          step={500}
        />
        <LimitField
          label="Step-up threshold"
          help="Above this needs a biometric on your phone"
          value={stepUp}
          onChange={setStepUp}
          min={5_000}
          max={50_000}
          step={1_000}
        />

        <USDCField
          label="Fund with"
          help="USDC to load onto the card now (can top up later)"
          value={funding}
          onChange={setFunding}
        />

        <PinField label="Choose a 4-digit PIN" value={pin} onChange={setPin} />
        <PinField label="Confirm PIN" value={pinConfirm} onChange={setPinConfirm} />

        {error ? (
          <p className="text-sm text-danger text-center" role="alert">
            {error}
          </p>
        ) : null}

        <Button onClick={submit}>Continue — tap your card</Button>
      </div>
    </Screen>
  );
}

function LimitField({
  label,
  help,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  help: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <label className="text-sm font-medium text-ink">{label}</label>
        <span className="text-sm font-semibold text-ink tabular-nums">
          {formatNgn(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-green"
      />
      <p className="text-xs text-muted-subtle">{help}</p>
    </div>
  );
}

function USDCField({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <label className="text-sm font-medium text-ink">{label}</label>
        <span className="text-sm font-semibold text-ink tabular-nums">${value}</span>
      </div>
      <input
        type="range"
        min={5}
        max={200}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-green"
      />
      <p className="text-xs text-muted-subtle">{help}</p>
    </div>
  );
}

function PinField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-ink">{label}</label>
      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className="w-full h-14 rounded-xl border border-line-muted px-4 text-2xl tracking-[0.6em] text-center bg-surface focus:outline-none focus:border-brand-green"
      />
    </div>
  );
}
