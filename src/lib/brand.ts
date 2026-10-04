import type { CSSProperties } from "react";

function isLight(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
}

export function brandStyle(color: string): CSSProperties {
  return {
    "--brand": color,
    "--primary": color,
    "--primary-foreground": isLight(color) ? "#0a0a0a" : "#ffffff",
    "--ring": color,
  } as CSSProperties;
}
