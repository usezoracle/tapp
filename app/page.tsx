import Link from "next/link";
import { Screen } from "@/components/ui/Screen";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

/**
 * PWA landing. Most visits to the PWA actually land deeper (claim
 * flow, order checkout, dashboard) — this route is mostly a fallback
 * for users who type the domain directly or installed the app and
 * tap the home-screen icon without context.
 */
export default function HomePage() {
  return (
    <Screen centered>
      <div className="flex flex-col items-center gap-8 text-center">
        <Logo />
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold text-ink">Tap, pay, done.</h1>
          <p className="text-muted-text">
            Sign in to manage your Tapp Card, top up your balance, or check a
            recent payment.
          </p>
        </div>
        <Link href="/sign-in" className="w-full">
          <Button>Sign in with Google</Button>
        </Link>
      </div>
    </Screen>
  );
}
