"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { requestOrder } from "@/app/actions/calculator";
import { Halftone } from "@/components/client/halftone";
import { Screen, SectionTitle } from "@/components/client/screen";
import { FloatingBar } from "@/components/client/tab-bar";
import { QuoteLines } from "@/components/quote-lines";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatRub } from "@/lib/format";
import {
  BANNER_MATERIALS,
  CARD_PAPERS,
  CARD_QUANTITIES,
  CARD_SIDES,
  CARD_SIZES,
  GROMMET_STEPS,
  LAMINATIONS,
  POCKETS,
  PRODUCTS,
  defaultInput,
  inputToSearch,
  laminable,
  quote,
  roundDim,
  type BannersInput,
  type CalcInput,
  type CardsInput,
  type PriceList,
  type Product,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

type Props = { slug: string; prices: PriceList; initial: CalcInput; signedIn: boolean };

export function Calculator({ slug, prices, initial, signedIn }: Props) {
  const router = useRouter();
  const [product, setProduct] = useState<Product>(initial.product);
  const [cards, setCards] = useState(() => (initial.product === "cards" ? initial : (defaultInput("cards", prices) as CardsInput)));
  const [banners, setBanners] = useState(() =>
    initial.product === "banners" ? initial : (defaultInput("banners", prices) as BannersInput),
  );
  // Banner sizes as typed (may be half-typed or out of range); the input keeps the last valid value
  const [dims, setDims] = useState({ width: num(banners.width), height: num(banners.height) });
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const input: CalcInput = product === "cards" ? cards : banners;
  const q = useMemo(() => quote(input, prices), [input, prices]);
  const search = inputToSearch(input);
  const dimOk = (k: Dim) => {
    const v = parseDim(dims[k]);
    return v !== null && v >= prices.banners[k].min && v <= prices.banners[k].max;
  };
  const hasErrors = product === "banners" && (!dimOk("width") || !dimOk("height"));
  const loginHref = `/c/${slug}/login?next=${encodeURIComponent(`/c/${slug}/calculator?${search}`)}`;

  // Options live in the URL: the page can be shared and survives signing in
  useEffect(() => {
    window.history.replaceState(null, "", `?${search}`);
  }, [search]);

  const products = (Object.keys(PRODUCTS) as Product[]).filter((p) => prices[p].enabled);
  const setCard = (patch: Partial<CardsInput>) => setCards((c) => ({ ...c, ...patch }));
  const setBanner = (patch: Partial<BannersInput>) => setBanners((b) => ({ ...b, ...patch }));

  function typeDim(k: Dim, text: string) {
    setDims((d) => ({ ...d, [k]: text }));
    const v = parseDim(text);
    if (v !== null && v >= prices.banners[k].min && v <= prices.banners[k].max) setBanner({ [k]: v });
  }
  function stepDim(k: Dim, delta: number) {
    const { min, max } = prices.banners[k];
    const v = roundDim(Math.min(max, Math.max(min, (dimOk(k) ? parseDim(dims[k])! : banners[k]) + delta)));
    setDims((d) => ({ ...d, [k]: num(v) }));
    setBanner({ [k]: v });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await requestOrder(slug, { input, comment });
      if (res?.login) router.push(loginHref);
      else if (res?.error) setError(res.error);
    });
  }

  return (
    <Screen back={signedIn ? `/c/${slug}` : `/c/${slug}/login`} title="Расчёт стоимости" eyebrow="Цена сразу, без звонков" className="pb-[calc(8rem+env(safe-area-inset-bottom))]">
      {products.length > 1 && (
        <Choice
          label="Что печатаем"
          value={product}
          onChange={setProduct}
          options={products.map((p) => ({ value: p, label: PRODUCTS[p] }))}
          className="mb-2"
          plain
        />
      )}

      {product === "cards" ? (
        <div className="flex flex-col gap-2">
          <Group title="Размер">
            <Choice
              label="Размер"
              value={cards.size}
              onChange={(size) => setCard({ size })}
              options={keys(CARD_SIZES).filter((k) => prices.cards.sizes[k].enabled).map((k) => ({ value: k, label: CARD_SIZES[k] }))}
            />
          </Group>
          <Group title="Тираж, шт.">
            <Choice
              label="Тираж"
              value={cards.qty}
              onChange={(qty) => setCard({ qty })}
              options={CARD_QUANTITIES.map((n) => ({ value: n, label: new Intl.NumberFormat("ru-RU").format(n) }))}
            />
          </Group>
          <Group title="Бумага">
            <Choice
              label="Бумага"
              value={cards.paper}
              onChange={(paper) => setCard({ paper, ...(!laminable(paper) && { lamination: "none" }) })}
              options={keys(CARD_PAPERS).filter((k) => prices.cards.papers[k].enabled).map((k) => ({ value: k, label: CARD_PAPERS[k] }))}
            />
          </Group>
          <Group title="Печать">
            <Choice label="Печать" value={cards.sides} onChange={(sides) => setCard({ sides })} options={keys(CARD_SIDES).map((k) => ({ value: k, label: CARD_SIDES[k] }))} />
          </Group>
          <Group title="Ламинация" hint={laminable(cards.paper) ? undefined : "Пластик не ламинируют"}>
            <Choice
              label="Ламинация"
              value={cards.lamination}
              onChange={(lamination) => setCard({ lamination })}
              options={keys(LAMINATIONS).map((k) => ({ value: k, label: LAMINATIONS[k], disabled: k !== "none" && !laminable(cards.paper) }))}
            />
          </Group>
          <Group>
            <Toggle label="Скругление углов" checked={cards.corners} onChange={(corners) => setCard({ corners })} />
            <Toggle label={`Срочно, +${prices.cards.urgentPct}%`} checked={cards.urgent} onChange={(urgent) => setCard({ urgent })} />
          </Group>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Group title="Размер, м">
            <div className="grid grid-cols-2 gap-3">
              {(["width", "height"] as const).map((k) => (
                <Dimension
                  key={k}
                  label={k === "width" ? "Ширина" : "Высота"}
                  text={dims[k]}
                  ok={dimOk(k)}
                  value={banners[k]}
                  limits={prices.banners[k]}
                  onText={(t) => typeDim(k, t)}
                  onStep={(d) => stepDim(k, d)}
                  onBlur={() => dimOk(k) && setDims((d) => ({ ...d, [k]: num(banners[k]) }))}
                />
              ))}
            </div>
            {prices.banners.minArea > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">Минимум к расчёту — {num(prices.banners.minArea)} м²</p>
            )}
          </Group>
          <Group title="Материал">
            <Choice
              label="Материал"
              value={banners.material}
              onChange={(material) => setBanner({ material })}
              options={keys(BANNER_MATERIALS).filter((k) => prices.banners.materials[k].enabled).map((k) => ({ value: k, label: BANNER_MATERIALS[k] }))}
            />
          </Group>
          <Group title="Люверсы" hint="По периметру, в углах обязательно">
            <Choice
              label="Люверсы"
              value={banners.grommets ?? 0}
              onChange={(step) => setBanner({ grommets: step === 0 ? null : step })}
              options={[{ value: 0 as const, label: "Без люверсов" }, ...GROMMET_STEPS.map((s) => ({ value: s, label: `Через ${s} см` }))]}
            />
          </Group>
          <Group title="Карманы" hint="Для крепления на трубу или трос">
            <Choice label="Карманы" value={banners.pockets} onChange={(pockets) => setBanner({ pockets })} options={keys(POCKETS).map((k) => ({ value: k, label: POCKETS[k] }))} />
          </Group>
          <Group>
            <Toggle label="Проклейка края" checked={banners.hem} onChange={(hem) => setBanner({ hem })} />
            <Toggle label={`Срочно, +${prices.banners.urgentPct}%`} checked={banners.urgent} onChange={(urgent) => setBanner({ urgent })} />
          </Group>
        </div>
      )}

      <section aria-label="Итог расчёта" className="relative mt-8 overflow-hidden rounded-card bg-hero p-6 text-hero-foreground">
        <Halftone />
        <p className="relative text-sm text-white/60">{q.title}</p>
        <p className="relative mt-2 text-[40px] leading-none font-bold tracking-tight tabular-nums" aria-live="polite" aria-atomic>
          {formatRub(q.total)}
        </p>
        <p className="relative mt-3 text-sm text-white/60">Цена предварительная: менеджер подтвердит её после проверки макета</p>
      </section>
      <Accordion type="single" collapsible className="mt-2 rounded-card bg-card px-5">
        <AccordionItem value="lines">
          <AccordionTrigger className="py-4 text-base font-semibold hover:no-underline">Из чего складывается цена</AccordionTrigger>
          <AccordionContent>
            <QuoteLines lines={q.lines} total={q.total} className="pb-4" />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {signedIn && (
        <>
          <SectionTitle>Комментарий</SectionTitle>
          <Textarea
            aria-label="Комментарий для менеджера"
            placeholder="Пожелания по заказу, когда нужен — необязательно"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            rows={3}
            className="rounded-tile bg-card"
          />
        </>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-tile bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <FloatingBar className="gap-3 pl-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Предварительно</p>
          <p className="truncate text-lg font-semibold tabular-nums">{formatRub(q.total)}</p>
        </div>
        {signedIn ? (
          <Button size="lg" onClick={submit} disabled={pending || hasErrors}>
            {pending ? "Оформляем…" : "Оформить заказ"}
          </Button>
        ) : (
          <Button asChild size="lg">
            <Link href={loginHref}>Войти и оформить</Link>
          </Button>
        )}
      </FloatingBar>
    </Screen>
  );
}

type Dim = "width" | "height";
const keys = <T extends object>(o: T) => Object.keys(o) as (keyof T & string)[];
const num = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1, useGrouping: false }).format(n);
// "2,5" or "2.5" → 2.5 (rounded to the 0.1 m step); anything else → null
const parseDim = (text: string) => {
  const v = Number(text.replace(",", ".").trim());
  return text.trim() !== "" && Number.isFinite(v) ? roundDim(v) : null;
};

function Group({ title, hint, children }: { title?: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card bg-card p-4">
      {title && <h2 className="mb-3 text-sm font-medium text-muted-foreground">{title}</h2>}
      {children}
      {hint && <p className="mt-3 text-sm text-muted-foreground">{hint}</p>}
    </section>
  );
}

// Pills over native radio buttons: arrow keys and screen readers work as with any radio group
function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
  plain,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  className?: string;
  // On the screen background (product switch) rather than inside a white card
  plain?: boolean;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => (
        <label key={o.value} className={cn("relative", o.disabled && "opacity-40")}>
          <input
            type="radio"
            name={name}
            className="peer sr-only"
            checked={o.value === value}
            disabled={o.disabled}
            onChange={() => onChange(o.value)}
          />
          <span
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-medium transition-colors peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:cursor-not-allowed active:scale-97 motion-reduce:active:scale-100",
              plain ? "h-11 bg-card px-5 text-muted-foreground" : "bg-muted text-foreground",
            )}
          >
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-1">
      <Label htmlFor={id} className="text-[15px] font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// Meters with a 0.1 step: typed with a comma or a dot, or changed with the − and + buttons
function Dimension({
  label,
  text,
  ok,
  value,
  limits,
  onText,
  onStep,
  onBlur,
}: {
  label: string;
  text: string;
  ok: boolean;
  value: number;
  limits: { min: number; max: number };
  onText: (text: string) => void;
  onStep: (delta: number) => void;
  onBlur: () => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-1.5">
        <Button type="button" variant="secondary" size="icon-lg" aria-label={`${label}: меньше на 0,1 м`} onClick={() => onStep(-0.1)} disabled={ok && value <= limits.min}>
          <Minus />
        </Button>
        <Input
          id={id}
          inputMode="decimal"
          value={text}
          onChange={(e) => onText(e.target.value)}
          onBlur={onBlur}
          aria-invalid={!ok}
          aria-describedby={`${id}-hint`}
          className="h-12 min-w-0 rounded-tile text-center text-lg tabular-nums"
        />
        <Button type="button" variant="secondary" size="icon-lg" aria-label={`${label}: больше на 0,1 м`} onClick={() => onStep(0.1)} disabled={ok && value >= limits.max}>
          <Plus />
        </Button>
      </div>
      <p id={`${id}-hint`} className={cn("text-xs", ok ? "text-muted-foreground" : "text-destructive")}>
        от {num(limits.min)} до {num(limits.max)}
      </p>
    </div>
  );
}
