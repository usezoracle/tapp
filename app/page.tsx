"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth";
import { Screen } from "@/components/ui/Screen";

/**
 * Root `/` — just a router.
 * • Signed-in → /wallet
 * • Not signed-in → /sign-in
 */
export default function RootPage() {
  const router = useRouter();
  const { hydrated, session } = useSession();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(session ? "/wallet" : "/sign-in");
  }, [hydrated, session, router]);

  return <Screen centered />;
}
