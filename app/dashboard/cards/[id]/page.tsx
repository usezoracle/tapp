import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Screen } from "@/components/ui/Screen";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

/**
 * Per-card view. PoC scope = success page after a claim, showing
 * the card ID and a placeholder for the upcoming top-up / activity
 * surface. The full screen (balance, limits, recent debits, top-up,
 * resync, revoke) lands when the post-PoC card endpoints ship — see
 * `docs/linking-flow.md` for the eventual spec.
 *
 * In Next 16, dynamic params arrive as `Promise<{ id }>` and must
 * be awaited (deprecation noted in the upgrade guide).
 */
export default async function CardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Screen>
      <header className="flex items-center justify-between mb-10">
        <Logo />
        <Link
          href="/dashboard"
          className="text-sm text-muted-text hover:text-ink"
        >
          Dashboard
        </Link>
      </header>

      <div className="flex flex-col items-center text-center gap-6">
        <CheckCircle2 size={56} className="text-success" strokeWidth={1.6} />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-ink">Card linked</h1>
          <p className="text-muted-text">
            You can now use this card at any Tapp Merchant.
          </p>
        </div>

        <div className="w-full rounded-2xl border border-line-divider bg-surface-soft p-5 text-left">
          <p className="text-xs uppercase tracking-wider text-muted-subtle mb-1">
            Card ID
          </p>
          <p className="text-sm font-mono text-ink break-all">{id}</p>
        </div>

        <div className="w-full rounded-2xl border border-line-divider bg-surface p-5 text-left space-y-2">
          <h2 className="font-semibold text-ink">What&apos;s next</h2>
          <p className="text-sm text-muted-text">
            Top-up, daily limits, and tap history will appear here once the
            funding flow ships. For PoC: this confirms the card-to-account
            binding worked end-to-end.
          </p>
        </div>

        <Link href="/dashboard" className="w-full">
          <Button variant="secondary">Back to dashboard</Button>
        </Link>
      </div>
    </Screen>
  );
}
