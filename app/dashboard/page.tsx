"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "@/components/ui/Screen";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { IconContactlessCard } from "@/lib/icons";
import { useSession } from "@/lib/auth";
import { cardsApi, ApiError } from "@/lib/api";

/**
 * Cardholder dashboard.
 *
 * v1 = one card per user. We hit /v1/cards/me; if it 404s, show the
 * "no card linked" empty state. If the card exists, redirect to the
 * per-card view at /dashboard/cards/[id] — that's where the live
 * surface lives.
 */
export default function DashboardPage() {
  const router = useRouter();
  const { hydrated, session, clear } = useSession();

  useEffect(() => {
    if (hydrated && !session) router.replace("/sign-in?next=/dashboard");
  }, [hydrated, session, router]);

  const cardQuery = useQuery({
    queryKey: ["cards", "me"],
    queryFn: () => cardsApi.me(session!.jwt),
    enabled: !!session,
    retry: false, // 404 = expected for unlinked users
  });

  // Once we have a card, slide into the per-card view.
  useEffect(() => {
    if (cardQuery.data) {
      router.replace(`/dashboard/cards/${cardQuery.data.id}`);
    }
  }, [cardQuery.data, router]);

  if (!hydrated || !session) return <Screen />;

  const isNoCardYet =
    cardQuery.isError &&
    cardQuery.error instanceof ApiError &&
    cardQuery.error.code === "card_not_linked";

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

        {cardQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <div
              aria-hidden
              className="w-8 h-8 rounded-full border-2 border-line-muted border-t-brand-green animate-spin"
            />
          </div>
        ) : isNoCardYet ? (
          <div className="rounded-2xl border border-line-divider bg-surface-soft p-6 space-y-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-brand-green/15 flex items-center justify-center">
              <Icon xml={IconContactlessCard} width={32} height={44} />
            </div>
            <h2 className="font-semibold text-ink">No card linked yet</h2>
            <p className="text-sm text-muted-text">
              Tap a Zoracle card on the back of your phone to link it to your
              account.
            </p>
          </div>
        ) : cardQuery.isError ? (
          <div className="rounded-2xl border border-danger-bg bg-danger-bg/40 p-6 text-center space-y-3">
            <p className="text-sm text-danger">
              Couldn&apos;t load your card. Try again in a moment.
            </p>
            <Link href="/dashboard">
              <Button variant="secondary" fullWidth={false}>
                Retry
              </Button>
            </Link>
          </div>
        ) : null}
      </div>
    </Screen>
  );
}
