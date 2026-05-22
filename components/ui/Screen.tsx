import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ScreenProps {
  children?: ReactNode;
  className?: string;
  /** Vertically center the content (true) vs top-aligned (false). */
  centered?: boolean;
}

/**
 * Page-level container. Caps width on tablets/desktop so the PWA
 * doesn't stretch awkwardly when "Add to Home Screen" sits next to a
 * larger Chrome window.
 */
export function Screen({ children, className, centered = false }: ScreenProps) {
  return (
    <main
      className={cn(
        "flex-1 flex flex-col w-full mx-auto",
        "max-w-md px-5 py-6 sm:py-10",
        centered && "justify-center",
        className,
      )}
    >
      {children}
    </main>
  );
}
