"use client";

import { motion } from "motion/react";
import { Monitor, Moon, Sun } from "lucide-react";
import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Follows the device setting by default; people can pin light or dark. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}

const noop = () => () => {};
/** True only after hydration, so the stored theme never causes a mismatch. */
function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

const OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const current = mounted ? (theme ?? "system") : "system";

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("flex rounded-full bg-white p-1 ring-1 ring-black/5", compact ? "flex-col gap-1" : "w-full")}
    >
      {OPTIONS.map((option) => {
        const on = current === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={option.label}
            title={option.label}
            onClick={() => setTheme(option.value)}
            className={cn(
              "relative flex items-center justify-center gap-1.5 rounded-full text-[13px] font-medium",
              compact ? "size-9" : "h-9 flex-1",
            )}
          >
            {on && (
              <motion.span
                layoutId={compact ? "theme-compact" : "theme-full"}
                className="absolute inset-0 rounded-full bg-ink"
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
              />
            )}
            <Icon className={cn("relative size-4", on ? "text-on-ink-accent" : "text-black/55")} />
            {!compact && <span className={cn("relative", on ? "text-white" : "text-black/60")}>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
