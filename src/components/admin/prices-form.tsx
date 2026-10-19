"use client";

import { useActionState, useEffect, useId, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { savePriceList } from "@/app/actions/calculator";
import { QuoteLines } from "@/components/quote-lines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatRub } from "@/lib/format";
import {
  BANNER_MATERIALS,
  CARD_PAPERS,
  CARD_QUANTITIES,
  CARD_SIZES,
  ITEM_LIMITS,
  defaultInput,
  parsePriceList,
  quote,
  type BannersInput,
  type CardsInput,
  type PriceList,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

// Examples in the preview: typical orders, so the owner sees what clients will be quoted
const CARD_SAMPLE: CardsInput = {
  product: "cards", size: "90x50", qty: 500, paper: "coated300", sides: "4+4", lamination: "matte", corners: false, urgent: false,
};
const BANNER_SAMPLE: BannersInput = {
  product: "banners", width: 3, height: 1, material: "frontlit440", grommets: 50, hem: true, pockets: "none", urgent: false,
};

type Path = (string | number)[];
// The form edits a copy of the price list in which numbers may be half-typed text ("1,"); parsePriceList reads both
type Draft = Record<string, unknown>;

function setIn(obj: Draft | unknown[], path: Path, value: unknown): Draft {
  const [head, ...rest] = path;
  const child = ((obj as Draft)[head] ?? {}) as Draft;
  const next = rest.length ? setIn(child, rest, value) : value;
  if (Array.isArray(obj)) return Object.assign([...obj], { [head]: next }) as unknown as Draft;
  return { ...obj, [head]: next };
}
function getIn(obj: Draft, path: Path): unknown {
  return path.reduce<unknown>((o, k) => (o as Draft | undefined)?.[k], obj);
}

export function PricesForm({ initial, isNew }: { initial: PriceList; isNew: boolean }) {
  const [state, action, pending] = useActionState(savePriceList, undefined);
  const [draft, setDraft] = useState<Draft>(() => structuredClone(initial) as unknown as Draft);
  const parsed = useMemo(() => parsePriceList(draft), [draft]);

  useEffect(() => {
    if (state?.message) toast.success(state.message);
    if (state?.error) toast.error(state.error);
  }, [state]);

  const field = (path: Path) => ({
    value: getIn(draft, path),
    onChange: (v: unknown) => setDraft((d) => setIn(d, path, v)),
  });
  const update: Update = (path, fn) => setDraft((d) => setIn(d, path, fn(getIn(d, path))));
  const items = rows(draft.items);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
      <form action={action} className="flex flex-col gap-6">
        <input type="hidden" name="config" value={JSON.stringify(draft)} />
        {isNew && (
          <p className="rounded-card bg-lime p-5 text-lime-foreground">
            Цены ещё не сохранены — ниже рыночные цены по образцу. Проверьте их и сохраните: после этого калькулятор появится у клиентов.
          </p>
        )}

        <Section title="Визитки" toggle={field(["cards", "enabled"])}>
          <Block title="Цена за штуку" hint="Односторонняя печать на базовой бумаге (коэффициент 1). С ростом тиража цена за штуку не должна расти.">
            <div className="grid grid-cols-3 gap-3 2xl:grid-cols-6">
              {CARD_QUANTITIES.map((q) => (
                <NumberField key={q} label={`${new Intl.NumberFormat("ru-RU").format(q)} шт.`} suffix="₽" {...field(["cards", "tiers", `${q}`])} />
              ))}
            </div>
          </Block>
          <Block title="Размер" hint="Коэффициент к цене печати">
            {Object.entries(CARD_SIZES).map(([k, label]) => (
              <OptionRow key={k} label={label} toggle={field(["cards", "sizes", k, "enabled"])}>
                <NumberField label="Коэффициент" hideLabel {...field(["cards", "sizes", k, "coef"])} suffix="×" />
              </OptionRow>
            ))}
          </Block>
          <Block title="Бумага" hint="Коэффициент к цене печати">
            {Object.entries(CARD_PAPERS).map(([k, label]) => (
              <OptionRow key={k} label={label} toggle={field(["cards", "papers", k, "enabled"])}>
                <NumberField label="Коэффициент" hideLabel {...field(["cards", "papers", k, "coef"])} suffix="×" />
              </OptionRow>
            ))}
          </Block>
          <Block title="Печать, ламинация, углы, срочность">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <NumberField label="Двусторонняя (4+4), коэффициент" suffix="×" {...field(["cards", "duplexCoef"])} />
              <NumberField label="Ламинация матовая, за штуку" suffix="₽" {...field(["cards", "lamination", "matte"])} />
              <NumberField label="Ламинация глянцевая, за штуку" suffix="₽" {...field(["cards", "lamination", "gloss"])} />
              <NumberField label="Ламинация, минимум за заказ" suffix="₽" {...field(["cards", "lamination", "min"])} />
              <NumberField label="Скругление углов, за штуку" suffix="₽" {...field(["cards", "corners", "perPiece"])} />
              <NumberField label="Скругление углов, минимум" suffix="₽" {...field(["cards", "corners", "min"])} />
              <NumberField label="Наценка за срочность" suffix="%" {...field(["cards", "urgentPct"])} />
            </div>
          </Block>
        </Section>

        <Section title="Баннеры" toggle={field(["banners", "enabled"])}>
          <Block title="Материалы" hint="Цена печати за квадратный метр">
            {Object.entries(BANNER_MATERIALS).map(([k, label]) => (
              <OptionRow key={k} label={label} toggle={field(["banners", "materials", k, "enabled"])}>
                <NumberField label="За м²" hideLabel suffix="₽/м²" {...field(["banners", "materials", k, "perM2"])} />
              </OptionRow>
            ))}
          </Block>
          <Block title="Размеры и обработка">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <NumberField label="Минимальная площадь к расчёту" suffix="м²" {...field(["banners", "minArea"])} />
              <NumberField label="Ширина от" suffix="м" {...field(["banners", "width", "min"])} />
              <NumberField label="Ширина до" suffix="м" {...field(["banners", "width", "max"])} />
              <NumberField label="Высота от" suffix="м" {...field(["banners", "height", "min"])} />
              <NumberField label="Высота до" suffix="м" {...field(["banners", "height", "max"])} />
              <NumberField label="Люверс, за штуку" suffix="₽" {...field(["banners", "grommetPrice"])} />
              <NumberField label="Проклейка края, за метр" suffix="₽" {...field(["banners", "hemPerM"])} />
              <NumberField label="Карманы, за метр" suffix="₽" {...field(["banners", "pocketPerM"])} />
              <NumberField label="Наценка за срочность" suffix="%" {...field(["banners", "urgentPct"])} />
            </div>
          </Block>
        </Section>

        <div className="pt-4">
          <h2 className="text-lg font-semibold">Свои позиции</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Листовки, сертификаты, бирки — всё, что считается по тиражу. У клиентов позиция появится в калькуляторе рядом с визитками и баннерами.
          </p>
        </div>
        {items.map((item, i) => (
          <ItemSection key={String(item.id)} index={i} count={items.length} item={item} field={field} update={update} />
        ))}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="self-start"
          disabled={items.length >= ITEM_LIMITS.items}
          onClick={() => update(["items"], (v) => [...rows(v), blankItem()])}
        >
          <Plus data-icon="inline-start" /> Добавить позицию
        </Button>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending || !parsed.ok}>
            {pending ? "Сохранение…" : "Сохранить цены"}
          </Button>
          {!parsed.ok && (
            <p role="alert" className="text-sm text-destructive">
              {parsed.error}
            </p>
          )}
        </div>
      </form>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-6">
        <section className="rounded-card bg-card p-6">
          <h2 className="font-semibold">Пример расчёта</h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">Так клиент увидит цену в калькуляторе</p>
          {parsed.ok ? (
            <div className="flex flex-col gap-6">
              {[
                CARD_SAMPLE,
                BANNER_SAMPLE,
                ...parsed.value.items.filter((i) => i.enabled).map((i) => defaultInput(`item:${i.id}`, parsed.value)),
              ].map((sample) => {
                const q = quote(sample, parsed.value);
                return (
                  <div key={sample.product === "item" ? `item:${sample.item}` : sample.product}>
                    <p className="mb-3 font-medium">{q.title}</p>
                    <QuoteLines lines={q.lines} total={q.total} className="text-sm" />
                  </div>
                );
              })}
              <div>
                <p className="mb-3 font-medium">Визитки 4+0 по тиражам</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {CARD_QUANTITIES.map((qty) => (
                    <div key={qty} className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{new Intl.NumberFormat("ru-RU").format(qty)} шт.</dt>
                      <dd className="tabular-nums">{formatRub(quote({ ...CARD_SAMPLE, qty, sides: "4+0", lamination: "none" }, parsed.value).total)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Исправьте ошибку в ценах, чтобы увидеть расчёт</p>
          )}
        </section>
      </aside>
    </div>
  );
}

type Bound = { value: unknown; onChange: (v: unknown) => void };
type Update = (path: Path, fn: (value: unknown) => unknown) => void;

const rows = (v: unknown) => (Array.isArray(v) ? v : []) as Draft[];
// Ids keep the calculator's links and saved requests stable while names change (pricing.ts: [a-z0-9]{1,16})
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
const blankChoice = () => ({ id: newId(), name: "", coef: 1 });
const blankItem = () => ({ id: newId(), name: "", enabled: true, tiers: [{ qty: 100, price: "" }], options: [], extras: [], urgentPct: 0 });

// One own item: runs with prices, options with variants, extras, urgency
function ItemSection({ index, count, item, field, update }: { index: number; count: number; item: Draft; field: (path: Path) => Bound; update: Update }) {
  const id = useId();
  const base: Path = ["items", index];
  const name = String(item.name ?? "");
  const on = item.enabled !== false;
  const tiers = rows(item.tiers);
  const options = rows(item.options);
  const extras = rows(item.extras);
  const L = ITEM_LIMITS;
  const add = (path: Path, row: Draft) => update(path, (v) => [...rows(v), row]);
  const remove = (path: Path, i: number) => update(path, (v) => rows(v).filter((_, j) => j !== i));
  const move = (dir: -1 | 1) =>
    update(["items"], (v) => {
      const list = [...rows(v)];
      [list[index], list[index + dir]] = [list[index + dir], list[index]];
      return list;
    });

  return (
    <section aria-label={name || "Новая позиция"} className="flex flex-col gap-6 rounded-card bg-card p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Input
          aria-label="Название позиции"
          placeholder="Название, например «Листовки А5»"
          value={name}
          onChange={(e) => field([...base, "name"]).onChange(e.target.value)}
          maxLength={L.name}
          className="h-11 min-w-56 flex-1 text-lg font-semibold"
        />
        <div className="flex items-center gap-3">
          <Label htmlFor={id} className="font-normal text-muted-foreground">
            {on ? "Показываем клиентам" : "Скрыто от клиентов"}
          </Label>
          <Switch id={id} checked={on} onCheckedChange={(v) => field([...base, "enabled"]).onChange(v)} />
        </div>
        <div className="flex">
          <Button type="button" variant="ghost" size="icon" aria-label="Переместить выше" disabled={index === 0} onClick={() => move(-1)}>
            <ArrowUp />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Переместить ниже" disabled={index === count - 1} onClick={() => move(1)}>
            <ArrowDown />
          </Button>
          <RemoveButton label={`Удалить позицию${name ? ` «${name}»` : ""}`} onClick={() => remove(["items"], index)} />
        </div>
      </div>

      <div className={cn("flex flex-col gap-6", !on && "opacity-50")}>
        <Block title="Тиражи" hint="Цена всего тиража, когда в каждом параметре выбран вариант с коэффициентом 1. Клиент выбирает один из этих тиражей.">
          {tiers.map((_, t) => (
            <Row key={t} cols="grid-cols-2 sm:grid-cols-[10rem_12rem]" onRemove={tiers.length > 1 ? () => remove([...base, "tiers"], t) : undefined} what="тираж">
              <NumberField label="Тираж" hideLabel={t > 0} suffix="шт." {...field([...base, "tiers", t, "qty"])} />
              <NumberField label="Цена тиража" hideLabel={t > 0} suffix="₽" {...field([...base, "tiers", t, "price"])} />
            </Row>
          ))}
          <AddButton disabled={tiers.length >= L.tiers} onClick={() => add([...base, "tiers"], { qty: "", price: "" })}>
            Добавить тираж
          </AddButton>
        </Block>

        <Block
          title="Параметры"
          hint="Клиент выбирает один вариант в каждом параметре — например, бумагу или цветность. Коэффициент умножает цену тиража; первый вариант выбран по умолчанию."
        >
          {options.map((o, k) => {
            const op: Path = [...base, "options", k];
            const choices = rows(o.choices);
            return (
              <div key={String(o.id)} className="flex flex-col gap-3 rounded-tile border p-4">
                <div className="flex items-center gap-2">
                  <TextField label="Название параметра" hideLabel placeholder="Параметр, например «Бумага»" maxLength={40} {...field([...op, "name"])} />
                  <RemoveButton label="Удалить параметр" onClick={() => remove([...base, "options"], k)} />
                </div>
                {choices.map((c, j) => (
                  <Row key={String(c.id)} cols="sm:grid-cols-[1fr_10rem]" onRemove={choices.length > 1 ? () => remove([...op, "choices"], j) : undefined} what="вариант">
                    <TextField label="Вариант" hideLabel={j > 0} placeholder="Мелованная 130 г/м²" maxLength={L.name} {...field([...op, "choices", j, "name"])} />
                    <NumberField label="Коэффициент" hideLabel={j > 0} suffix="×" {...field([...op, "choices", j, "coef"])} />
                  </Row>
                ))}
                <AddButton disabled={choices.length >= L.choices} onClick={() => add([...op, "choices"], blankChoice())}>
                  Добавить вариант
                </AddButton>
              </div>
            );
          })}
          <AddButton
            disabled={options.length >= L.options}
            onClick={() => add([...base, "options"], { id: newId(), name: "", choices: [blankChoice(), blankChoice()] })}
          >
            Добавить параметр
          </AddButton>
        </Block>

        <Block title="Доп. услуги" hint="Клиент включает их переключателем. Цена за штуку, но не меньше минимума за заказ; фиксированная цена — 0 за штуку и сумма в минимуме.">
          {extras.map((e, j) => (
            <Row key={String(e.id)} cols="sm:grid-cols-[1fr_9rem_9rem]" onRemove={() => remove([...base, "extras"], j)} what="услугу">
              <TextField label="Услуга" hideLabel={j > 0} placeholder="Скругление углов" maxLength={L.name} {...field([...base, "extras", j, "name"])} />
              <NumberField label="За штуку" hideLabel={j > 0} suffix="₽" {...field([...base, "extras", j, "perPiece"])} />
              <NumberField label="Минимум за заказ" hideLabel={j > 0} suffix="₽" {...field([...base, "extras", j, "min"])} />
            </Row>
          ))}
          <AddButton disabled={extras.length >= L.extras} onClick={() => add([...base, "extras"], { id: newId(), name: "", perPiece: 0, min: 0 })}>
            Добавить услугу
          </AddButton>
        </Block>

        <div className="w-full sm:w-56">
          <NumberField label="Наценка за срочность" suffix="%" {...field([...base, "urgentPct"])} />
        </div>
      </div>
    </section>
  );
}

// Fields side by side with a remove button at the end; the first row carries the labels
function Row({ cols, onRemove, what, children }: { cols: string; onRemove?: () => void; what: string; children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-2">
      <div className={cn("grid min-w-0 flex-1 gap-3", cols)}>{children}</div>
      {onRemove ? <RemoveButton label={`Удалить ${what}`} onClick={onRemove} /> : <span aria-hidden className="size-9 shrink-0" />}
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={onClick} className="shrink-0 text-muted-foreground hover:text-destructive">
      <Trash2 />
    </Button>
  );
}

function AddButton({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="self-start" disabled={disabled} onClick={onClick}>
      <Plus data-icon="inline-start" /> {children}
    </Button>
  );
}

function TextField({ label, hideLabel, placeholder, maxLength, value, onChange }: { label: string; hideLabel?: boolean; placeholder?: string; maxLength?: number } & Bound) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Label htmlFor={id} className={cn("text-sm font-normal text-muted-foreground", hideLabel && "sr-only")}>
        {label}
      </Label>
      <Input id={id} value={String(value ?? "")} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Section({ title, toggle, children }: { title: string; toggle: Bound; children: React.ReactNode }) {
  const id = useId();
  const on = toggle.value !== false;
  return (
    <section className="flex flex-col gap-6 rounded-card bg-card p-6 md:p-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex items-center gap-3">
          <Label htmlFor={id} className="font-normal text-muted-foreground">
            {on ? "Показываем клиентам" : "Скрыто от клиентов"}
          </Label>
          <Switch id={id} checked={on} onCheckedChange={(v) => toggle.onChange(v)} />
        </div>
      </div>
      <div className={cn("flex flex-col gap-6", !on && "opacity-50")}>{children}</div>
    </section>
  );
}

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-medium">{title}</h3>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function OptionRow({ label, toggle, children }: { label: string; toggle: Bound; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-center gap-4 border-b pb-3 last:border-b-0 last:pb-0">
      <Switch id={id} checked={toggle.value !== false} onCheckedChange={(v) => toggle.onChange(v)} aria-label={`${label}: показывать клиентам`} />
      <Label htmlFor={id} className="min-w-0 flex-1 font-normal">
        {label}
      </Label>
      <div className="w-40 shrink-0">{children}</div>
    </div>
  );
}

function NumberField({ label, hideLabel, suffix, value, onChange }: { label: string; hideLabel?: boolean; suffix?: string } & Bound) {
  const id = useId();
  const text = typeof value === "number" ? String(value).replace(".", ",") : String(value ?? "");
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className={cn("text-sm font-normal text-muted-foreground", hideLabel && "sr-only")}>
        {label}
      </Label>
      <div className="relative">
        <Input id={id} inputMode="decimal" value={text} onChange={(e) => onChange(e.target.value)} className={cn("tabular-nums", suffix && (suffix.length > 1 ? "pr-14" : "pr-8"))} />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}
