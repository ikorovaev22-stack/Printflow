"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, updatePassword } from "@/app/actions/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Notice({ state }: { state: { error?: string; message?: string } | undefined }) {
  if (state?.error)
    return (
      <p role="alert" className="rounded-tile bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {state.error}
      </p>
    );
  if (state?.message)
    return (
      <p role="status" className="rounded-tile bg-muted px-4 py-3 text-sm">
        {state.message}
      </p>
    );
  return null;
}

export function ForgotPasswordForm({ backHref }: { backHref: string }) {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} required className="h-12" />
      </div>
      <Notice state={state} />
      <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
        {pending ? "Отправляем…" : "Прислать ссылку"}
      </Button>
      <Button asChild size="lg" variant="outline" className="w-full">
        <Link href={backHref}>Вернуться ко входу</Link>
      </Button>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Новый пароль</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required className="h-12" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">Повторите пароль</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={72} required className="h-12" />
      </div>
      <Notice state={state} />
      <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
        {pending ? "Сохраняем…" : "Сохранить пароль"}
      </Button>
    </form>
  );
}
