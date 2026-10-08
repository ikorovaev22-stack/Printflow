import Link from "next/link";
import { Calculator, ChevronRight } from "lucide-react";

// Entry to the calculator from the orders screen: a secondary card, the tab bar stays with four sections
export function CalculatorCard({ slug }: { slug: string }) {
  return (
    <Link
      href={`/c/${slug}/calculator`}
      className="mb-5 flex items-center gap-4 rounded-card bg-card p-4 transition-transform active:scale-98 motion-reduce:active:scale-100"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-tile bg-muted">
        <Calculator className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Рассчитать стоимость</span>
        <span className="block text-sm text-muted-foreground">Визитки и баннеры — цена сразу</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

// Under the sign-in form: prices are open to guests
export function GuestCalculatorLink({ slug }: { slug: string }) {
  return (
    <Link
      href={`/c/${slug}/calculator`}
      className="mt-6 flex min-h-11 items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <Calculator className="size-4" />
      Рассчитать стоимость без входа
    </Link>
  );
}
