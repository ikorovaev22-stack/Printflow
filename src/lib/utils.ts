import { createCn } from "cn/config"

// Design tokens from globals.css (rounded-tile, rounded-card, shadow-float) must merge like built-in scales
export const cn = createCn({
  extend: { theme: { radius: ["tile", "card"], shadow: ["float"] } },
})

// Where to go after signing in: only a page of the same print shop's client app, never another site or section
export function safeNext(slug: string, next: unknown): string | null {
  if (typeof next !== "string" || !next.startsWith(`/c/${slug}/`)) return null;
  if (next.includes("//") || next.includes("..") || !/^[\w\-./?=&%+,]*$/.test(next)) return null;
  return next;
}
