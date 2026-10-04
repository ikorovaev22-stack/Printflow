import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS. Used only to deliver notifications after an action has already passed RLS
// under the user's own session. Returns null when the key is not configured (notifications are then off).
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
