import { BackLink } from "@/components/client/back-link";

export function Screen({
  title,
  back,
  action,
  children,
}: {
  title: string;
  back?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-28">
      {back && <BackLink href={back} />}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">{title}</h1>
        {action}
      </div>
      {children}
    </main>
  );
}
