import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { SITE_URL } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

// Email links (sign-up confirmation, password recovery) land here on our own domain;
// see supabase/templates/*.html
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = SITE_URL || request.nextUrl.origin;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(type === "recovery" ? "/auth/reset" : safePath(params.get("next"), origin), origin));
  }
  return NextResponse.redirect(new URL("/auth/error", origin));
}

// Only paths on this site: "next" may be a full URL (emailRedirectTo) or a path
function safePath(next: string | null, origin: string) {
  if (!next) return "/";
  try {
    const url = new URL(next, origin);
    return url.origin === new URL(origin).origin ? `${url.pathname}${url.search}` : "/";
  } catch {
    return "/";
  }
}
