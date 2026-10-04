"use client";

import { useSyncExternalStore } from "react";
import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}

const OPTIONS = [
  { value: "system", label: "Как в системе", icon: Monitor },
  { value: "light", label: "Светлая", icon: Sun },
  { value: "dark", label: "Тёмная", icon: Moon },
] as const;

// The stored theme is only known in the browser
const useMounted = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

// Profile card: three-way segmented control
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  return (
    <div className="flex items-center gap-4 rounded-card bg-card p-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted">
        <Moon className="size-5" />
      </span>
      <span className="min-w-0 flex-1 font-medium">Тема</span>
      <ToggleGroup
        type="single"
        value={mounted ? theme : undefined}
        onValueChange={(v) => v && setTheme(v)}
        aria-label="Тема оформления"
        className="rounded-full bg-muted p-1"
      >
        {OPTIONS.map((o) => (
          <ToggleGroupItem
            key={o.value}
            value={o.value}
            aria-label={o.label}
            title={o.label}
            className="size-9 rounded-full text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground"
          >
            <o.icon className="size-4" />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

// Admin sidebar: one button cycling system → light → dark
export function ThemeButton({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const i = Math.max(0, OPTIONS.findIndex((o) => o.value === (mounted ? theme : "system")));
  const current = OPTIONS[i];
  const next = OPTIONS[(i + 1) % OPTIONS.length];
  return (
    <button
      type="button"
      onClick={() => setTheme(next.value)}
      aria-label={`Тема: ${current.label}. Переключить на «${next.label}»`}
      title={`Тема: ${current.label}`}
      className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground", className)}
    >
      <current.icon className="size-4" />
    </button>
  );
}
