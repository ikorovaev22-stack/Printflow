import { redirect } from "next/navigation";
import { Store } from "lucide-react";
import { Landing } from "@/components/landing";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getDefaultCompany } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";

export default async function Home() {
  if (DEMO_MODE) return <Landing />;
  const company = await getDefaultCompany();
  if (company) redirect(`/c/${company.slug}`);
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Store />
          </EmptyMedia>
          <EmptyTitle>Типография ещё не создана</EmptyTitle>
          <EmptyDescription>
            Выполните <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">npm run create-company</code> — инструкция в README.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  );
}
