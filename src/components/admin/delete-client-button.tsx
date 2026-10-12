"use client";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteClient } from "@/app/actions/clients";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DeleteClientButton({ id, name, orders }: { id: string; name: string; orders: number }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-destructive">
          <Trash2 /> Удалить
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить клиента «{name}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Удалятся аккаунт, {orders ? `все заказы (${orders}) с файлами` : "файлы"} и переписка. Клиент не сможет войти, но может
            зарегистрироваться заново. Действие нельзя отменить.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              deleteClient(id)
                .then((res) => res?.error && toast.error(res.error))
                .catch(() => toast.error("Не удалось удалить клиента"))
            }
            variant="destructive"
          >
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
