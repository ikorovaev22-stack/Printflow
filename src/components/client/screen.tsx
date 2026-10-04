import { BackLink } from "@/components/client/back-link";
import { cn } from "@/lib/utils";

// Mobile screen frame: top bar (back or leading + actions), two-tone title, content above the floating bottom bar
export function Screen({
  title,
  eyebrow,
  back,
  leading,
  action,
  children,
  className,
}: {
  title?: string;
  eyebrow?: React.ReactNode;
  back?: string;
  leading?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const top = back ? <BackLink href={back} /> : leading;
  return (
    <main
      className={cn(
        "mx-auto max-w-md px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-[calc(7rem+env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {(top || action) && (
        <div className="mb-6 flex min-h-12 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">{top}</div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
      )}
      {title && (
        <header className="mb-6">
          {eyebrow && <p className="text-lg text-muted-foreground">{eyebrow}</p>}
          <h1 className="text-[32px] leading-[1.1] font-bold tracking-tight">{title}</h1>
        </header>
      )}
      {children}
    </main>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mt-8 mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}
