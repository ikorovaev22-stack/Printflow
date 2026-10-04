"use client";

import { usePathname } from "next/navigation";

export function ChatShell({ list, children }: { list: React.ReactNode; children: React.ReactNode }) {
  const open = usePathname() !== "/admin/chat";
  return (
    <div
      data-open={open}
      className="group grid h-[calc(100dvh-5rem)] grid-cols-1 overflow-hidden rounded-card bg-card md:h-[calc(100dvh-4rem)] md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr]"
    >
      <aside className="flex min-h-0 flex-col border-r group-data-[open=true]:hidden md:group-data-[open=true]:flex">{list}</aside>
      <section className="hidden min-h-0 flex-col bg-muted/30 group-data-[open=true]:flex md:flex">{children}</section>
    </div>
  );
}
