"use client";

import { useTheme } from "next-themes";
import { useState, useEffect, type ReactElement } from "react";
import { PiSun, PiMoon } from "react-icons/pi";

type IconButtonProps = {
  icon: ReactElement;
  onClick: () => void;
  isActive: boolean;
};

const IconButton = ({ icon, onClick, isActive }: IconButtonProps) => (
  <button
    type="button"
    className={`flex cursor-pointer items-center justify-center rounded-full border p-1.5 transition-all ${
      isActive ? "border-gray-300 dark:border-white/20" : "border-transparent"
    }`}
    onClick={onClick}
    title={`Switch to ${isActive ? "dark" : "light"} mode`}
  >
    {icon}
  </button>
);

export function ThemeSwitch() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-[38px] w-[74px]" aria-hidden />;
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-full border border-gray-300 p-1.5 transition-all dark:border-white/20">
      <IconButton
        icon={<PiSun className="h-auto w-4 text-gray-400 dark:text-white/50" />}
        onClick={() => setTheme("light")}
        isActive={resolvedTheme === "light"}
      />
      <IconButton
        icon={<PiMoon className="h-auto w-4 text-gray-400 dark:text-white/50" />}
        onClick={() => setTheme("dark")}
        isActive={resolvedTheme === "dark"}
      />
    </div>
  );
}
