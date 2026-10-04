import Link from "next/link";
import { MailX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export const metadata = { title: "Ссылка недействительна" };

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MailX />
          </EmptyMedia>
          <EmptyTitle>Ссылка недействительна</EmptyTitle>
          <EmptyDescription>Возможно, она устарела или уже использована. Запросите письмо ещё раз.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild size="lg">
            <Link href="/">На главную</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
