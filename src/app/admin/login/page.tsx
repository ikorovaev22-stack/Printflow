import { AuthForm } from "@/components/auth-form";
import { Halftone } from "@/components/client/halftone";

export default function AdminLoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <Halftone className="-top-20 -right-20 size-[28rem]" />
        <Halftone className="-bottom-32 -left-24 size-96" />
        <p className="relative text-lg font-semibold">PrintFlow</p>
        <div className="relative max-w-md">
          <h2 className="text-5xl leading-[1.05] font-bold tracking-tight">Заказы, сроки и чат — в одном окне</h2>
          <p className="mt-4 text-lg text-white/60">Клиенты видят статус сами, а вы тратите меньше времени на звонки.</p>
        </div>
      </section>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="mb-1 text-sm text-muted-foreground lg:hidden">PrintFlow</p>
          <h1 className="text-[32px] leading-tight font-bold tracking-tight">Вход для сотрудников</h1>
          <p className="mt-1 mb-8 text-muted-foreground">Панель управления типографией</p>
          <AuthForm mode="login" />
        </div>
      </div>
    </main>
  );
}
