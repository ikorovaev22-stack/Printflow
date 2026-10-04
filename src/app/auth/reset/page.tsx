import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Welcome } from "@/components/client/welcome";
import { NewPasswordForm } from "@/components/password-forms";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Новый пароль" };

// Reached from the recovery email via /auth/confirm, which signs the user in
export default async function ResetPage() {
  const session = await getSession();
  if (!session) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRound />
            </EmptyMedia>
            <EmptyTitle>Ссылка устарела</EmptyTitle>
            <EmptyDescription>Запросите новую ссылку для смены пароля.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild size="lg">
              <Link href="/auth/forgot">Запросить ссылку</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </main>
    );
  }
  return (
    <Welcome company={session.company} title="Новый пароль" subtitle="Не короче 8 символов">
      <NewPasswordForm />
    </Welcome>
  );
}
