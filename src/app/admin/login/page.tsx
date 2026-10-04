import { AuthForm } from "@/components/auth-form";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-6">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium text-muted-foreground">PrintFlow</p>
          <h1 className="text-2xl font-semibold tracking-tight">Вход для сотрудников</h1>
        </div>
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
