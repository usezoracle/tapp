"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Screen } from "@/components/ui/Screen";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { IconContactlessCard, IconSuccessBadge } from "@/lib/icons";
import { useSession } from "@/lib/auth";
import { cardsApi, ApiError } from "@/lib/api";

/**
 * Claim a freshly-tapped card. The activation URL pasted on the card
 * (`https://api.zoracle.com/c/<token>`) redirects through Rails to
 * `/link?token=<token>` — this page picks up from there.
 *
 * Behaviour:
 *   - No `token` query param → "Tap a card to get started" empty state.
 *   - `token` present + signed out → render sign-in CTA with `next=`
 *     pointing back to this URL.
 *   - `token` present + signed in → call `POST /v1/cards/link/claim`
 *     and route to `/dashboard/cards/:id`.
 */
export default function LinkPage() {
  return (
    <Suspense fallback={<Screen centered><div /></Screen>}>
      <LinkPageBody />
    </Suspense>
  );
}

function LinkPageBody() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const { hydrated, session } = useSession();

  if (!token) return <NoTokenState />;
  if (!hydrated) return <LoadingState />;
  if (!session) return <SignInState token={token} />;
  // After claim → configure step (Act 2 of the linking flow).
  return (
    <ClaimingState
      token={token}
      jwt={session.jwt}
      onDone={(id) => router.replace(`/link/configure?card=${id}`)}
    />
  );
}

// -----------------------------------------------------------------------------

function NoTokenState() {
  return (
    <Screen centered>
      <div className="flex flex-col items-center gap-8 text-center">
        <Logo />
        <Icon xml={IconContactlessCard} width={56} height={78} className="opacity-50" />
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-ink">No card detected</h1>
          <p className="text-muted-text">
            Tap a Zoracle card on the back of your phone to get started.
          </p>
        </div>
      </div>
    </Screen>
  );
}

function LoadingState() {
  return (
    <Screen centered>
      <div className="flex justify-center">
        <div
          aria-hidden
          className="w-8 h-8 rounded-full border-2 border-line-muted border-t-brand-green animate-spin"
        />
      </div>
    </Screen>
  );
}

function SignInState({ token }: { token: string }) {
  const nextHref = `/link?token=${encodeURIComponent(token)}`;
  return (
    <Screen centered>
      <div className="flex flex-col items-center gap-8 text-center">
        <Logo />
        <div className="w-20 h-20 rounded-full bg-brand-green/15 flex items-center justify-center">
          <Icon xml={IconContactlessCard} width={36} height={50} />
        </div>
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-ink">
            You tapped a new card
          </h1>
          <p className="text-muted-text">
            Sign in with Google to claim it as yours.
          </p>
        </div>
        <a href={`/sign-in?next=${encodeURIComponent(nextHref)}`} className="w-full">
          <Button>Continue with Google</Button>
        </a>
        <p className="text-xs text-muted-subtle inline-flex items-center gap-1">
          <ShieldCheck size={14} />
          This link only works once. No one else can claim it after you.
        </p>
      </div>
    </Screen>
  );
}

function ClaimingState({
  token,
  jwt,
  onDone,
}: {
  token: string;
  jwt: string;
  onDone: (cardId: string) => void;
}) {
  const [status, setStatus] = useState<"claiming" | "error" | "already-yours">("claiming");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function go() {
      try {
        const res = await cardsApi.claim(token, jwt);
        if (cancelled) return;
        onDone(res.card_id);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "card_already_claimed_by_you") {
          setStatus("already-yours");
          return;
        }
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not claim this card");
      }
    }
    void go();
    return () => {
      cancelled = true;
    };
  }, [token, jwt, onDone]);

  if (status === "claiming") {
    return (
      <Screen centered>
        <div className="flex flex-col items-center gap-6 text-center">
          <div
            aria-hidden
            className="w-10 h-10 rounded-full border-2 border-line-muted border-t-brand-green animate-spin"
          />
          <p className="text-muted-text">Claiming your card…</p>
        </div>
      </Screen>
    );
  }

  if (status === "already-yours") {
    return (
      <Screen centered>
        <div className="flex flex-col items-center gap-6 text-center">
          <Icon xml={IconSuccessBadge} size={84} />
          <p className="text-ink">This card is already linked to your account.</p>
          <a href="/dashboard" className="w-full">
            <Button variant="secondary">Open dashboard</Button>
          </a>
        </div>
      </Screen>
    );
  }

  return (
    <Screen centered>
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-xl font-semibold text-danger">Couldn&apos;t claim this card</h1>
        <p className="text-muted-text">{error}</p>
        <a href="/dashboard" className="w-full">
          <Button variant="secondary">Open dashboard</Button>
        </a>
      </div>
    </Screen>
  );
}
