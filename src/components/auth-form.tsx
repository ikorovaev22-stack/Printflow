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
          <Field name="full_name" label="Имя и фамилия" autoComplete="name" required />
          <Field name="phone" label="Телефон" type="tel" autoComplete="tel" placeholder="+7" />
        </>
      )}
      <Field name="email" label="Email" type="email" autoComplete="email" required />
      <Field
        name="password"
        label="Пароль"
        type="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        required
      />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.message && <p className="text-sm text-muted-foreground">{state.message}</p>}
      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
        {pending ? "Подождите…" : mode === "login" ? "Войти" : "Зарегистрироваться"}
      </Button>
      {slug && (
        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
          <Link href={`/c/${slug}/${mode === "login" ? "register" : "login"}`} className="font-medium text-primary">
            {mode === "login" ? "Зарегистрироваться" : "Войти"}
          </Link>
        </p>
      )}
    </form>
  );
}

function Field({ name, label, ...props }: { name: string; label: string } & React.ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} className="h-11" {...props} />
    </div>
  );
}
