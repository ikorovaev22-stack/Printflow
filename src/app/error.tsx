"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
      <p className="text-muted-foreground">Проверьте подключение к интернету и попробуйте ещё раз.</p>
      <Button onClick={reset}>Повторить</Button>
    </main>
  );
}
