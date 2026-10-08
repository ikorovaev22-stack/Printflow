import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS. Used only after an action has been checked under the user's own session: to deliver
// notifications, and to record a calculator request once the server has recalculated its price (clients cannot insert
// orders themselves, otherwise they could set any price). Returns null when the key is not configured.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
