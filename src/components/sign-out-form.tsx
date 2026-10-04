"use client";

import { signOut } from "@/app/actions/auth";
import { disablePush } from "@/lib/push-client";

// Releases this device's push subscription first, so the next person signing in here doesn't get our notifications
export function SignOutForm({ slug, className, children }: { slug?: string; className?: string; children: React.ReactNode }) {
  return (
    <form
      className={className}
      action={async (fd) => {
        await disablePush();
        await signOut(fd);
      }}
    >
      {slug && <input type="hidden" name="slug" value={slug} />}
      {children}
    </form>
  );
}
