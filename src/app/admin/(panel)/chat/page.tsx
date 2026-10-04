import { MessagesSquare } from "lucide-react";

export default function ChatIndex() {
  return (
    <div className="m-auto flex flex-col items-center gap-3 text-muted-foreground">
      <MessagesSquare className="size-12 opacity-40" />
      <p>Выберите диалог слева</p>
    </div>
  );
}
