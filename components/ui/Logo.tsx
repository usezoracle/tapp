import { cn } from "@/lib/utils";

/**
 * Wordmark for the Tapp PWA — text-based, no brand logo SVG (kept
 * intentional per user direction: icons-only from svg-list, not the
 * wordmark logo).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-ink-true font-semibold tracking-[0.16em]",
        className,
      )}
    >
      <span
        aria-hidden
        className="inline-block w-2.5 h-2.5 rounded-full bg-brand-green"
      />
      ZORACLE
    </span>
  );
}
