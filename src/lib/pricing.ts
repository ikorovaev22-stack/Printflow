// Print price calculator: pure functions shared by the browser (instant recalculation) and the server (the
// price of a request is recalculated from the stored price list, never taken from the client).
// No React, no database, no path aliases: scripts and unit tests import this file directly.
// Money is whole rubles: every line is rounded on its own and the total is the sum of the lines.

// ── Catalog: fixed options; the price list sets their prices and can switch them off ────────────────

export const CARD_SIZES = { "90x50": "90×50 мм", "85x55": "85×55 мм" } as const;
export const CARD_QUANTITIES = [50, 100, 200, 500, 1000, 2000] as const;
export const CARD_PAPERS = { coated300: "Мелованная 300 г/м²", designer: "Дизайнерская", plastic: "Пластик" } as const;
export const CARD_SIDES = { "4+0": "Односторонняя (4+0)", "4+4": "Двусторонняя (4+4)" } as const;
export const LAMINATIONS = { none: "Без ламинации", matte: "Матовая", gloss: "Глянцевая" } as const;
export const BANNER_MATERIALS = {
  frontlit440: "Фронтлит 440 г",
  frontlit510: "Фронтлит 510 г",
  blackout: "Блэкаут",
  mesh: "Баннерная сетка",
} as const;
export const GROMMET_STEPS = [30, 50] as const;
export const POCKETS = { none: "Без карманов", "top-bottom": "Сверху и снизу", "left-right": "Слева и справа" } as const;
export const PRODUCTS = { cards: "Визитки", banners: "Баннеры" } as const;

export type Product = keyof typeof PRODUCTS;
export type CardSize = keyof typeof CARD_SIZES;
export type CardQty = (typeof CARD_QUANTITIES)[number];
export type CardPaper = keyof typeof CARD_PAPERS;
export type CardSides = keyof typeof CARD_SIDES;
export type Lamination = keyof typeof LAMINATIONS;
export type BannerMaterial = keyof typeof BANNER_MATERIALS;
export type GrommetStep = (typeof GROMMET_STEPS)[number];
export type Pockets = keyof typeof POCKETS;

// ── Price list (stored per company in price_lists.config) ───────────────────────────────────────────

type Toggle<T> = T & { enabled: boolean };

export type CardsPrices = {
  enabled: boolean;
  // Price of one card at each run, single-sided on the base paper (the coefficient 1). Falls as the run grows.
  tiers: Record<`${CardQty}`, number>;
  sizes: Record<CardSize, Toggle<{ coef: number }>>;
  papers: Record<CardPaper, Toggle<{ coef: number }>>;
  duplexCoef: number;
  // Per card, with a minimum charge per order
  lamination: { matte: number; gloss: number; min: number };
  corners: { perPiece: number; min: number };
  urgentPct: number;
};

export type BannersPrices = {
  enabled: boolean;
  materials: Record<BannerMaterial, Toggle<{ perM2: number }>>;
  // Smaller banners are billed as this area, m²
  minArea: number;
  width: { min: number; max: number };
  height: { min: number; max: number };
  grommetPrice: number;
  hemPerM: number;
  pocketPerM: number;
  urgentPct: number;
};

export type PriceList = { cards: CardsPrices; banners: BannersPrices };

// Moscow market prices, autumn 2026: a working starting point for a new print shop
export const DEFAULT_PRICE_LIST: PriceList = {
  cards: {
    enabled: true,
    tiers: { "50": 12, "100": 7, "200": 4.5, "500": 2.4, "1000": 1.6, "2000": 1.2 },
    sizes: { "90x50": { coef: 1, enabled: true }, "85x55": { coef: 1, enabled: true } },
    papers: {
      coated300: { coef: 1, enabled: true },
      designer: { coef: 2.2, enabled: true },
      plastic: { coef: 6, enabled: true },
    },
    duplexCoef: 1.5,
    lamination: { matte: 0.8, gloss: 0.8, min: 300 },
    corners: { perPiece: 0.3, min: 200 },
    urgentPct: 50,
  },
  banners: {
    enabled: true,
    materials: {
      frontlit440: { perM2: 420, enabled: true },
      frontlit510: { perM2: 520, enabled: true },
      blackout: { perM2: 780, enabled: true },
      mesh: { perM2: 620, enabled: true },
    },
    minArea: 1,
    width: { min: 0.3, max: 5 },
    height: { min: 0.3, max: 20 },
    grommetPrice: 15,
    hemPerM: 60,
    pocketPerM: 120,
    urgentPct: 30,
  },
};

// ── Input ───────────────────────────────────────────────────────────────────────────────────────────

export type CardsInput = {
  product: "cards";
  size: CardSize;
  qty: CardQty;
  paper: CardPaper;
  sides: CardSides;
  lamination: Lamination;
  corners: boolean;
  urgent: boolean;
};

export type BannersInput = {
  product: "banners";
  // Meters, multiples of 0.1
  width: number;
  height: number;
  material: BannerMaterial;
  grommets: GrommetStep | null;
  hem: boolean;
  pockets: Pockets;
  urgent: boolean;
};

export type CalcInput = CardsInput | BannersInput;

export type QuoteLine = { label: string; amount: number };
export type Quote = { product: Product; title: string; lines: QuoteLine[]; total: number };

const has = <T extends object>(obj: T, key: unknown): key is keyof T =>
  typeof key === "string" && Object.prototype.hasOwnProperty.call(obj, key);
const firstEnabled = <K extends string>(items: Record<K, { enabled: boolean }>) =>
  (Object.keys(items) as K[]).find((k) => items[k].enabled);

export const isEnabled = (prices: PriceList) => prices.cards.enabled || prices.banners.enabled;
export const laminable = (paper: CardPaper) => paper !== "plastic";

// Dimensions are entered with a 0.1 m step; the calculation itself works in whole centimeters
export const roundDim = (m: number) => Math.round(m * 10) / 10;

export function defaultInput(product: Product, prices: PriceList): CalcInput {
  if (product === "cards") {
    const c = prices.cards;
    return {
      product,
      size: firstEnabled(c.sizes) ?? "90x50",
      qty: 100,
      paper: firstEnabled(c.papers) ?? "coated300",
      sides: "4+0",
      lamination: "none",
      corners: false,
      urgent: false,
    };
  }
  const b = prices.banners;
  return {
    product,
    width: roundDim(Math.min(Math.max(3, b.width.min), b.width.max)),
    height: roundDim(Math.min(Math.max(1, b.height.min), b.height.max)),
    material: firstEnabled(b.materials) ?? "frontlit440",
    grommets: 50,
    hem: true,
    pockets: "none",
    urgent: false,
  };
}

// Untrusted input (request body, URL) → a valid input for this price list, or null. Every option must exist
// and be switched on; banner sizes are rounded to 0.1 m and must fit the limits.
export function normalizeInput(raw: unknown, prices: PriceList): CalcInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const bool = (v: unknown) => v === true;
  if (r.product === "cards") {
    const c = prices.cards;
    const qty = Number(r.qty);
    if (!c.enabled) return null;
    if (!has(c.sizes, r.size) || !c.sizes[r.size].enabled) return null;
    if (!has(c.papers, r.paper) || !c.papers[r.paper].enabled) return null;
    if (!CARD_QUANTITIES.includes(qty as CardQty)) return null;
    if (!has(CARD_SIDES, r.sides) || !has(LAMINATIONS, r.lamination)) return null;
    if (r.lamination !== "none" && !laminable(r.paper)) return null;
    return {
      product: "cards",
      size: r.size,
      qty: qty as CardQty,
      paper: r.paper,
      sides: r.sides,
      lamination: r.lamination,
      corners: bool(r.corners),
      urgent: bool(r.urgent),
    };
  }
  if (r.product === "banners") {
    const b = prices.banners;
    if (!b.enabled) return null;
    const width = roundDim(Number(r.width));
    const height = roundDim(Number(r.height));
    if (!Number.isFinite(width) || width < b.width.min || width > b.width.max) return null;
    if (!Number.isFinite(height) || height < b.height.min || height > b.height.max) return null;
    if (!has(b.materials, r.material) || !b.materials[r.material].enabled) return null;
    const grommets = r.grommets === null || r.grommets === undefined ? null : Number(r.grommets);
    if (grommets !== null && !GROMMET_STEPS.includes(grommets as GrommetStep)) return null;
    if (!has(POCKETS, r.pockets)) return null;
    return {
      product: "banners",
      width,
      height,
      material: r.material,
      grommets: grommets as GrommetStep | null,
      hem: bool(r.hem),
      pockets: r.pockets,
      urgent: bool(r.urgent),
    };
  }
  return null;
}

// ── Calculation ─────────────────────────────────────────────────────────────────────────────────────

const rub = (n: number) => Math.round(n);
const num = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);

// Grommets go into the corners and at most `step` apart along every edge
export function grommetCount(widthM: number, heightM: number, stepCm: number) {
  const w = Math.round(widthM * 100);
  const h = Math.round(heightM * 100);
  const perWidth = Math.ceil(w / stepCm) + 1;
  const perHeight = Math.ceil(h / stepCm) + 1;
  return 2 * (perWidth + perHeight) - 4;
}

function withUrgency(lines: QuoteLine[], urgent: boolean, pct: number) {
  if (urgent && pct > 0) {
    const base = lines.reduce((s, l) => s + l.amount, 0);
    lines.push({ label: `Срочность +${num(pct)}%`, amount: rub((base * pct) / 100) });
  }
  return lines;
}

export function quote(input: CalcInput, prices: PriceList): Quote {
  const lines: QuoteLine[] = [];
  let title: string;

  if (input.product === "cards") {
    const c = prices.cards;
    const perPiece = c.tiers[`${input.qty}`];
    const coef = c.papers[input.paper].coef * c.sizes[input.size].coef * (input.sides === "4+4" ? c.duplexCoef : 1);
    lines.push({
      label: `Печать ${num(input.qty)} шт., ${CARD_PAPERS[input.paper].toLowerCase()}, ${input.sides}`,
      amount: rub(perPiece * input.qty * coef),
    });
    if (input.lamination !== "none") {
      lines.push({
        label: `Ламинация ${LAMINATIONS[input.lamination].toLowerCase()}`,
        amount: rub(Math.max(c.lamination[input.lamination] * input.qty, c.lamination.min)),
      });
    }
    if (input.corners) {
      lines.push({ label: "Скругление углов", amount: rub(Math.max(c.corners.perPiece * input.qty, c.corners.min)) });
    }
    withUrgency(lines, input.urgent, c.urgentPct);
    title = `Визитки ${CARD_SIZES[input.size]}, ${num(input.qty)} шт.`;
  } else {
    const b = prices.banners;
    const w = Math.round(input.width * 100);
    const h = Math.round(input.height * 100);
    const area = (w * h) / 10_000;
    const billed = Math.max(area, b.minArea);
    lines.push({
      label: `${BANNER_MATERIALS[input.material]}, ${num(area)} м²${billed > area ? ` (считаем ${num(billed)} м²)` : ""}`,
      amount: rub(billed * b.materials[input.material].perM2),
    });
    if (input.grommets) {
      const count = grommetCount(input.width, input.height, input.grommets);
      lines.push({ label: `Люверсы через ${input.grommets} см, ${count} шт.`, amount: rub(count * b.grommetPrice) });
    }
    if (input.hem) {
      const perimeter = (2 * (w + h)) / 100;
      lines.push({ label: `Проклейка края, ${num(perimeter)} м`, amount: rub(perimeter * b.hemPerM) });
    }
    if (input.pockets !== "none") {
      const length = (2 * (input.pockets === "top-bottom" ? w : h)) / 100;
      lines.push({ label: `Карманы ${POCKETS[input.pockets].toLowerCase()}, ${num(length)} м`, amount: rub(length * b.pocketPerM) });
    }
    withUrgency(lines, input.urgent, b.urgentPct);
    title = `Баннер ${num(input.width)}×${num(input.height)} м, ${BANNER_MATERIALS[input.material].toLowerCase()}`;
  }

  return { product: input.product, title, lines, total: lines.reduce((s, l) => s + l.amount, 0) };
}

// ── URL state: the calculator keeps its options in the query string (shareable, survives sign-in) ──

export function inputToSearch(input: CalcInput): string {
  const p = new URLSearchParams({ p: input.product });
  if (input.product === "cards") {
    p.set("size", input.size);
    p.set("qty", String(input.qty));
    p.set("paper", input.paper);
    p.set("sides", input.sides);
    p.set("lam", input.lamination);
    if (input.corners) p.set("corners", "1");
  } else {
    p.set("w", String(input.width));
    p.set("h", String(input.height));
    p.set("mat", input.material);
    p.set("grommets", input.grommets ? String(input.grommets) : "0");
    if (input.hem) p.set("hem", "1");
    p.set("pockets", input.pockets);
  }
  if (input.urgent) p.set("urgent", "1");
  return p.toString();
}

// Missing or invalid parameters fall back to the product defaults
export function inputFromSearch(search: Record<string, string | string[] | undefined>, prices: PriceList): CalcInput {
  const get = (k: string) => {
    const v = search[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const wanted = get("p") === "banners" ? "banners" : "cards";
  const product: Product = prices[wanted].enabled ? wanted : wanted === "cards" ? "banners" : "cards";
  const base = defaultInput(product, prices);
  if (get("p") !== product) return base;
  const raw =
    product === "cards"
      ? {
          product,
          size: get("size") ?? (base as CardsInput).size,
          qty: get("qty") ?? (base as CardsInput).qty,
          paper: get("paper") ?? (base as CardsInput).paper,
          sides: get("sides") ?? "4+0",
          lamination: get("lam") ?? "none",
          corners: get("corners") === "1",
          urgent: get("urgent") === "1",
        }
      : {
          product,
          width: get("w") ?? (base as BannersInput).width,
          height: get("h") ?? (base as BannersInput).height,
          material: get("mat") ?? (base as BannersInput).material,
          grommets: get("grommets") === "0" ? null : (get("grommets") ?? 50),
          hem: get("hem") === "1",
          pockets: get("pockets") ?? "none",
          urgent: get("urgent") === "1",
        };
  return normalizeInput(raw, prices) ?? base;
}

// ── Price list validation (admin form and every read from the database) ─────────────────────────────

export type ParseResult = { ok: true; value: PriceList } | { ok: false; error: string };

export function parsePriceList(raw: unknown): ParseResult {
  const errors: string[] = [];
  const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const number = (v: unknown, label: string, min: number, max: number) => {
    const n = typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : v;
    if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max) {
      errors.push(`${label}: число от ${num(min)} до ${num(max)}`);
      return min;
    }
    return n;
  };
  const toggle = (v: unknown) => obj(v).enabled !== false;
  const MAX = 1_000_000;

  const rc = obj(obj(raw).cards);
  const rt = obj(rc.tiers);
  const tiers = Object.fromEntries(
    CARD_QUANTITIES.map((q) => [`${q}`, number(rt[`${q}`], `Визитки, ${q} шт., цена за штуку`, 0.01, MAX)]),
  ) as CardsPrices["tiers"];
  CARD_QUANTITIES.slice(1).forEach((q, i) => {
    const prev = CARD_QUANTITIES[i];
    if (tiers[`${q}`] > tiers[`${prev}`]) errors.push(`Визитки: цена за штуку на ${q} шт. выше, чем на ${prev} шт.`);
  });
  const coefs = <K extends string>(src: unknown, labels: Record<K, string>, what: string) =>
    Object.fromEntries(
      (Object.keys(labels) as K[]).map((k) => [k, { coef: number(obj(obj(src)[k]).coef, `${what} «${labels[k]}»: коэффициент`, 0.01, 100), enabled: toggle(obj(src)[k]) }]),
    ) as Record<K, Toggle<{ coef: number }>>;
  const lam = obj(rc.lamination);
  const corners = obj(rc.corners);
  const cards: CardsPrices = {
    enabled: rc.enabled !== false,
    tiers,
    sizes: coefs(rc.sizes, CARD_SIZES, "Размер"),
    papers: coefs(rc.papers, CARD_PAPERS, "Бумага"),
    duplexCoef: number(rc.duplexCoef, "Двусторонняя печать: коэффициент", 1, 10),
    lamination: {
      matte: number(lam.matte, "Ламинация матовая, за штуку", 0, MAX),
      gloss: number(lam.gloss, "Ламинация глянцевая, за штуку", 0, MAX),
      min: number(lam.min, "Ламинация, минимум за заказ", 0, MAX),
    },
    corners: {
      perPiece: number(corners.perPiece, "Скругление углов, за штуку", 0, MAX),
      min: number(corners.min, "Скругление углов, минимум за заказ", 0, MAX),
    },
    urgentPct: number(rc.urgentPct, "Визитки, наценка за срочность, %", 0, 300),
  };
  if (cards.enabled && !firstEnabled(cards.sizes)) errors.push("Визитки: включите хотя бы один размер");
  if (cards.enabled && !firstEnabled(cards.papers)) errors.push("Визитки: включите хотя бы одну бумагу");

  const rb = obj(obj(raw).banners);
  const rm = obj(rb.materials);
  const range = (v: unknown, label: string) => {
    const r = obj(v);
    const min = number(r.min, `${label}, от`, 0.1, 100);
    const max = number(r.max, `${label}, до`, 0.1, 100);
    if (min > max) errors.push(`${label}: «от» больше, чем «до»`);
    return { min: roundDim(min), max: roundDim(max) };
  };
  const banners: BannersPrices = {
    enabled: rb.enabled !== false,
    materials: Object.fromEntries(
      (Object.keys(BANNER_MATERIALS) as BannerMaterial[]).map((k) => [
        k,
        { perM2: number(obj(rm[k]).perM2, `${BANNER_MATERIALS[k]}, за м²`, 0, MAX), enabled: toggle(rm[k]) },
      ]),
    ) as BannersPrices["materials"],
    minArea: number(rb.minArea, "Баннеры, минимальная площадь, м²", 0, 100),
    width: range(rb.width, "Ширина баннера, м"),
    height: range(rb.height, "Высота баннера, м"),
    grommetPrice: number(rb.grommetPrice, "Люверс, за штуку", 0, MAX),
    hemPerM: number(rb.hemPerM, "Проклейка края, за метр", 0, MAX),
    pocketPerM: number(rb.pocketPerM, "Карманы, за метр", 0, MAX),
    urgentPct: number(rb.urgentPct, "Баннеры, наценка за срочность, %", 0, 300),
  };
  if (banners.enabled && !firstEnabled(banners.materials)) errors.push("Баннеры: включите хотя бы один материал");

  return errors.length ? { ok: false, error: errors[0] } : { ok: true, value: { cards, banners } };
}
