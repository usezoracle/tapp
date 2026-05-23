"use client";

import { cn } from "@/lib/utils";
import { CountUp } from "./CountUp";
import { formatUsdc, formatNgnFromUsdc } from "@/lib/wallet";

interface BalanceHeroProps {
  usdcSubunit: number;
  ngnRate: number;
  label?: string;
  className?: string;
}

const formatUsdcFromFloat = (n: number) => formatUsdc(Math.round(n * 1_000_000));

export function BalanceHero({
  usdcSubunit,
  ngnRate,
  label = "Balance",
  className,
}: BalanceHeroProps) {
  const usdcFloat = usdcSubunit / 1_000_000;
  return (
    <div className={cn("grid gap-1", className)}>
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-white/30">
        {label}
      </p>
      <p className="font-medium tabular-nums text-neutral-900 dark:text-white">
        <CountUp
          value={usdcFloat}
          format={formatUsdcFromFloat}
          threshold={1}
          rollKey={`bal-${Math.round(usdcFloat)}`}
          className="text-4xl"
        />{" "}
        <span className="text-lg text-gray-500 dark:text-white/50">USDC</span>
      </p>
      <p className="text-sm text-gray-500 dark:text-white/50">
        ≈ {formatNgnFromUsdc(usdcSubunit, ngnRate)}
      </p>
    </div>
  );
}
