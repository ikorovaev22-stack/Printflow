import { MessageCircle } from "lucide-react";
import { Chat } from "@/components/chat";
import { CompanyLogo } from "@/components/company-logo";
import { requireClient } from "@/lib/auth";
import type { Message } from "@/lib/types";

export const metadata = { title: "Чат" };

export default async function ChatScreen({ params }: PageProps<"/c/[slug]/chat">) {
  const { slug } = await params;
  const { supabase, profile, company } = await requireClient(slug);
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("client_id", profile.id)
    .order("created_at")
    .returns<Message[]>();

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col pb-[calc(58px+env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-3 border-b bg-background/90 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur">
        <CompanyLogo company={company} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{company.name}</p>
          <p className="truncate text-xs text-muted-foreground">{company.work_hours || "Ответим в рабочее время"}</p>
        </div>
      </header>
      <Chat
        companyId={company.id}
        clientId={profile.id}
        meId={profile.id}
        side="client"
        initialMessages={data ?? []}
        empty={
          <div className="m-auto flex flex-col items-center gap-3 px-8 text-center text-muted-foreground">
            <MessageCircle className="size-12 opacity-40" />
            <p>Напишите нам — спросите о сроках, макете или доставке</p>
          </div>
        }
      />
    </main>
  );
}
