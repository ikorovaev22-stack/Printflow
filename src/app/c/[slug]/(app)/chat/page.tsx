import { Clock, MessageCircle, Phone } from "lucide-react";
import { Chat } from "@/components/chat";
import { CompanyLogo } from "@/components/company-logo";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
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
  const phone = company.phone?.replace(/[^\d+]/g, "");

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col pb-[calc(4.5rem+max(env(safe-area-inset-bottom),0.75rem))]">
      <header className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-3">
        <CompanyLogo company={company} className="size-12 rounded-full" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{company.name}</h1>
          <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
            <Clock aria-hidden className="size-3.5 shrink-0" />
            {company.work_hours || "Ответим в рабочее время"}
          </p>
        </div>
        {phone && (
          <Button asChild variant="surface" size="icon-lg">
            <a href={`tel:${phone}`} aria-label="Позвонить">
              <Phone />
            </a>
          </Button>
        )}
      </header>
      <Chat
        clientId={profile.id}
        side="client"
        initialMessages={data ?? []}
        empty={
          <Empty className="m-auto">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageCircle />
              </EmptyMedia>
              <EmptyTitle>Напишите нам</EmptyTitle>
              <EmptyDescription>Спросите о сроках, макете или доставке — менеджер ответит здесь.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      />
    </main>
  );
}
