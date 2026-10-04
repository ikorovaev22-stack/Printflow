"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({ mode, slug }: { mode: "login" | "register"; slug?: string }) {
  const [state, action, pending] = useActionState(mode === "login" ? signIn : signUp, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      {slug && <input type="hidden" name="slug" value={slug} />}
      {mode === "register" && (
        <>
          <Field name="full_name" label="Имя и фамилия" autoComplete="name" maxLength={120} required />
          <Field name="phone" label="Телефон" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7" maxLength={40} />
        </>
      )}
      <Field name="email" label="Email" type="email" inputMode="email" autoComplete="email" maxLength={254} required />
      <Field
        name="password"
        label="Пароль"
        type="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        minLength={mode === "register" ? 8 : undefined}
        maxLength={72}
        required
      />
      {state?.error && (
        <p role="alert" className="rounded-tile bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" className="rounded-tile bg-muted px-4 py-3 text-sm">
          {state.message}
        </p>
      )}
      <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
        {pending ? "Подождите…" : mode === "login" ? "Войти" : "Создать аккаунт"}
      </Button>
      {slug && (
        <>
          <p className="text-center text-sm text-muted-foreground">{mode === "login" ? "Впервые здесь?" : "Уже есть аккаунт?"}</p>
          <Button asChild size="lg" variant="outline" className="w-full">
            <Link href={`/c/${slug}/${mode === "login" ? "register" : "login"}`}>
              {mode === "login" ? "Зарегистрироваться" : "Войти"}
            </Link>
          </Button>
        </>
      )}
    </form>
  );
}

function Field({ name, label, ...props }: { name: string; label: string } & React.ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} className="h-12" {...props} />
    </div>
  );
}
