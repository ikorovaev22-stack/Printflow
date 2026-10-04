"use client";

import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WifiOff />
          </EmptyMedia>
          <EmptyTitle>Что-то пошло не так</EmptyTitle>
          <EmptyDescription>Проверьте подключение к интернету и попробуйте ещё раз.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="lg" onClick={reset}>
            Повторить
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
