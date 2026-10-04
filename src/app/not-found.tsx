import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-6xl font-bold text-muted-foreground/40">404</p>
      <h1 className="text-xl font-semibold">Страница не найдена</h1>
      <p className="text-muted-foreground">Возможно, ссылка устарела или заказ был удалён.</p>
      <Button asChild variant="outline">
        <Link href="/">На главную</Link>
      </Button>
    </main>
  );
}
