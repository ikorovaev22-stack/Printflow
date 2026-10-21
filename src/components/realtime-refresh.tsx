"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function RealtimeRefresh({ table, filter }: { table: string; filter: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    // Unmounted before the session arrived (a quick remount): subscribing now would reuse the next mount's channel
    let stopped = false;
    supabase.auth.getSession().then(({ data }) => {
      if (stopped) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`${table}:${filter}`)
        .on("postgres_changes", { event: "*", schema: "public", table, filter }, () => router.refresh())
        .subscribe();
    });
    return () => {
      stopped = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [table, filter, router]);
  return null;
}
