import { Suspense } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Screen } from "@/components/ui/Screen";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

/**
 * Status fallback for cards the redirect resolver decided weren't
 * usable (`revoked`, `locked`, or other states with no claim or
 * dashboard view). Rails redirects here with `?status=…` so the copy
 * matches what actually happened.
 */
export default function CardsUnavailablePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <Suspense fallback={<Screen />}>
      <Body searchParamsPromise={searchParams} />
    </Suspense>
  );
}

async function Body({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ status?: string }>;
}) {
  const { status } = await searchParamsPromise;
  const copy = messageFor(status);
  return (
    <Screen centered>
      <div className="flex flex-col items-center text-center gap-8">
        <Logo />
        <AlertCircle size={56} className="text-muted-subtle" strokeWidth={1.5} />
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-ink">{copy.title}</h1>
          <p className="text-muted-text">{copy.body}</p>
        </div>
        <Link href="/dashboard" className="w-full">
          <Button variant="secondary">Open dashboard</Button>
        </Link>
      </div>
    </Screen>
  );
}

function messageFor(status: string | undefined) {
  switch (status) {
    case "revoked":
      return {
        title: "Card revoked",
        body:
          "This card was revoked by its owner and can no longer be used. Talk to support if you think this is a mistake.",
      };
    case "locked":
      return {
        title: "Card locked",
        body:
          "Too many failed PIN attempts. The card is locked for 24 hours. Contact support if you need it sooner.",
      };
    default:
      return {
        title: "Card unavailable",
        body: "This card can't be used right now. Contact support for help.",
      };
  }
}
