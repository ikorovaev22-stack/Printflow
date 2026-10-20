"use client";

import { useTransition } from "react";
import { CircleCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { closeChat, reopenChat } from "@/app/actions/messages";
import { Button } from "@/components/ui/button";

// Moves the dialog between the "Активные" and "Завершённые" folders
export function ChatStatusButton({ clientId, closed }: { clientId: string; closed: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={closed ? "ghost" : "outline"}
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await (closed ? reopenChat(clientId) : closeChat(clientId));
          if (res.error) toast.error(res.error);
          else toast.success(closed ? "Чат снова в активных" : "Чат завершён — он в папке «Завершённые»");
        })
      }
    >
      {closed ? <RotateCcw /> : <CircleCheck />}
      <span className="max-md:sr-only">{closed ? "Вернуть в активные" : "Завершить чат"}</span>
    </Button>
  );
}
