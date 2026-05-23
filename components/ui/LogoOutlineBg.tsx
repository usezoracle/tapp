"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function LogoOutlineBg() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 hidden items-end justify-between transition-all xl:flex pointer-events-none z-0">
      <Image
        width={1000}
        height={1000}
        src={
          resolvedTheme === "dark"
            ? "/logo-outline-group-left-dark.svg"
            : "/logo-outline-group-left-light.svg"
        }
        alt=""
        tabIndex={-1}
        className="h-auto w-auto opacity-40 dark:opacity-20"
        priority
      />
      <Image
        width={1000}
        height={1000}
        src={
          resolvedTheme === "dark"
            ? "/logo-outline-group-right-dark.svg"
            : "/logo-outline-group-right-light.svg"
        }
        alt=""
        tabIndex={-1}
        className="h-auto w-auto opacity-40 dark:opacity-20"
        priority
      />
    </div>
  );
}
