import "server-only";
import { headers } from "next/headers";

// In-memory sliding window. Fully effective on a single server (Docker); on serverless platforms it limits
// per warm instance, and Supabase Auth's own rate limits stay in place behind it.
const hits = new Map<string, number[]>();

export async function clientIp() {
  const h = await headers();
  // x-real-ip is set by the proxy (Caddy, Vercel) and cannot be supplied by the client
  return h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  const allowed = recent.length < limit;
  if (allowed) recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  }
  return allowed;
}
