"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Screen } from "@/components/ui/Screen";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/auth";
import { cardsApi, type CardSummary } from "@/lib/api";
import { formatNgn } from "@/lib/utils";

/**
 * Per-card dashboard. v1 = 1:1 user↔card, so the `id` param is
 * informational — we resolve the user's card via `/v1/cards/me`. The
 * URL keeps the id for stable shareability + future multi-card.
 *
 * Surfaces:
 *   - Status pill + balance / limits
 *   - "Needs resync" banner that deep-links to /cards/resync
 *   - Top-up / revoke CTAs
 */
export default function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { hydrated, session } = useSession();

  useEffect(() => {
    if (hydrated && !session) router.replace(`/sign-in?next=/dashboard/cards/${id}`);
  }, [hydrated, session, router, id]);

  const cardQuery = useQuery({
    queryKey: ["cards", "me"],
    queryFn: () => cardsApi.me(session!.jwt),
    enabled: !!session,
  });

  return (
    <Screen>
      <header className="flex items-center justify-between mb-8">
        <Logo />
        <Link href="/dashboard" className="text-sm text-muted-text hover:text-ink">
          Dashboard
        </Link>
      </header>

      {!hydrated || !session ? null : cardQuery.isLoading ? (
        <CardLoading />
      ) : cardQuery.isError ? (
        <CardError message={cardQuery.error instanceof Error ? cardQuery.error.message : "Failed to load card"} />
      ) : cardQuery.data ? (
        <CardView card={cardQuery.data} cardIdFromUrl={id} />
      ) : null}
    </Screen>
  );
}

function CardLoading() {
  return (
    <div className="flex justify-center py-20">
      <div
        aria-hidden
        className="w-8 h-8 rounded-full border-2 border-line-muted border-t-brand-green animate-spin"
      />
    </div>
  );
}

function CardError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-4 py-12">
      <p className="text-danger">{message}</p>
      <Link href="/dashboard">
        <Button variant="secondary">Back</Button>
      </Link>
    </div>
  );
}

function CardView({ card, cardIdFromUrl }: { card: CardSummary; cardIdFromUrl: string }) {
  const idMatch = card.id === cardIdFromUrl;

  return (
    <div className="space-y-6">
      {!idMatch ? (
        <p className="text-xs text-muted-subtle">
          Showing your current card. The link you opened was for a different
          card.
        </p>
      ) : null}

      {/* Status hero */}
      <div className="rounded-2xl bg-surface-soft border border-line-divider p-6 space-y-4">
        <div className="flex items-center gap-3">
          <StatusBadge status={card.status} />
          <span className="text-xs text-muted-subtle font-mono break-all">
            {card.id.slice(0, 8)}…
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-subtle uppercase tracking-wider">
            Today&apos;s spend
          </p>
          <p className="text-3xl font-semibold text-ink tabular-nums">
            {formatNgn(card.spent_today_subunit / 100)}{" "}
            <span className="text-base text-muted-text font-normal">
              / {formatNgn(card.daily_limit_subunit / 100)}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Stat
            label="Per-tap limit"
            value={formatNgn(card.per_tap_limit_subunit / 100)}
          />
          <Stat
            label="Step-up above"
            value={formatNgn(card.step_up_threshold_subunit / 100)}
          />
        </div>
      </div>

      {card.needs_resync ? (
        <div className="rounded-2xl bg-warning-bg border border-warning p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-warning shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <p className="text-sm font-medium text-ink">Card needs to resync</p>
            <p className="text-xs text-muted-text">
              The last tap didn&apos;t finish writing. Run resync to bring your
              card back in sync.
            </p>
            <Link href="/cards/resync">
              <Button variant="secondary" fullWidth={false}>
                Resync now
              </Button>
            </Link>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <Link href="/cards/top-up">
          <Button>Top up</Button>
        </Link>
        <Link href="/cards/revoke">
          <Button variant="secondary">Revoke card</Button>
        </Link>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: CardSummary["status"] }) {
  const styles: Record<CardSummary["status"], string> = {
    issued:  "bg-surface-subtle text-muted-text",
    claimed: "bg-surface-subtle text-muted-text",
    live:    "bg-success-bg text-success",
    revoked: "bg-danger-bg text-danger",
    locked:  "bg-warning-bg text-warning",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status]}`}
    >
      {status === "live" ? <CheckCircle2 size={12} /> : null}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <p className="text-[10px] text-muted-subtle uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm font-semibold text-ink tabular-nums">{value}</p>
    </div>
  );
}
