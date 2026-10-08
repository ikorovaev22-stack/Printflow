import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  CARD_QUANTITIES,
  DEFAULT_PRICE_LIST,
  grommetCount,
  inputFromSearch,
  inputToSearch,
  normalizeInput,
  parsePriceList,
  quote,
  type BannersInput,
  type CardsInput,
  type PriceList,
} from "../src/lib/pricing";

const P = DEFAULT_PRICE_LIST;
const clone = (): PriceList => structuredClone(P);
const cards = (o: Partial<CardsInput> = {}): CardsInput => ({
  product: "cards", size: "90x50", qty: 100, paper: "coated300", sides: "4+0", lamination: "none", corners: false, urgent: false, ...o,
});
const banner = (o: Partial<BannersInput> = {}): BannersInput => ({
  product: "banners", width: 3, height: 1, material: "frontlit440", grommets: null, hem: false, pockets: "none", urgent: false, ...o,
});
const amounts = (q: ReturnType<typeof quote>) => q.lines.map((l) => l.amount);

describe("business cards", () => {
  test("run tiers: the total follows the tier price, the price per card falls as the run grows", () => {
    const totals = CARD_QUANTITIES.map((qty) => quote(cards({ qty }), P).total);
    assert.deepEqual(totals, [600, 700, 900, 1200, 1600, 2400]);
    const perCard = CARD_QUANTITIES.map((qty, i) => totals[i] / qty);
    perCard.slice(1).forEach((p, i) => assert.ok(p < perCard[i], `${CARD_QUANTITIES[i + 1]} шт. cheaper per card`));
  });

  test("paper, 4+4 and size coefficients multiply the print line", () => {
    assert.equal(quote(cards({ qty: 500, sides: "4+4" }), P).total, 1800);
    assert.equal(quote(cards({ qty: 1000, paper: "designer" }), P).total, 3520);
    const p = clone();
    p.cards.sizes["85x55"].coef = 1.1;
    assert.equal(quote(cards({ size: "85x55" }), p).total, 770);
  });

  test("lamination and rounded corners have a minimum charge", () => {
    assert.deepEqual(amounts(quote(cards({ qty: 500, sides: "4+4", lamination: "matte" }), P)), [1800, 400]);
    assert.deepEqual(amounts(quote(cards({ qty: 50, lamination: "gloss" }), P)), [600, 300]);
    assert.deepEqual(amounts(quote(cards({ qty: 100, corners: true }), P)), [700, 200]);
    assert.deepEqual(amounts(quote(cards({ qty: 2000, corners: true }), P)), [2400, 600]);
  });

  test("urgency adds a percentage of all other lines", () => {
    const q = quote(cards({ qty: 500, sides: "4+4", lamination: "matte", urgent: true }), P);
    assert.deepEqual(amounts(q), [1800, 400, 1100]);
    assert.equal(q.lines.at(-1)!.label, "Срочность +50%");
    assert.equal(q.total, 3300);
  });

  test("every line is rounded to rubles and the total is their sum", () => {
    const p = clone();
    p.cards.tiers["50"] = 0.333;
    const q = quote(cards({ qty: 50, urgent: true }), p);
    assert.deepEqual(amounts(q), [17, 9]); // 16.65 → 17; 50% of 17 = 8.5 → 9
    assert.equal(q.total, 26);
    assert.equal(q.title, "Визитки 90×50 мм, 50 шт.");
  });
});

describe("banners", () => {
  test("small banners are billed at the minimum area", () => {
    const q = quote(banner({ width: 0.5, height: 0.5 }), P);
    assert.deepEqual(amounts(q), [420]);
    assert.match(q.lines[0].label, /0,25 м² \(считаем 1 м²\)/);
    assert.equal(quote(banner({ width: 1.1, height: 0.7 }), P).total, 420); // 0.77 m² < 1
    assert.equal(quote(banner({ width: 1.5, height: 1.1 }), P).total, 693); // 1.65 m² × 420
  });

  test("grommets: corners plus every step along each edge, counted once per corner", () => {
    assert.equal(grommetCount(1, 1, 50), 8);
    assert.equal(grommetCount(3, 1, 50), 16);
    assert.equal(grommetCount(3, 1, 30), 28);
    assert.equal(grommetCount(1.2, 0.7, 30), 14);
    assert.equal(grommetCount(0.3, 0.3, 50), 4);
    // Whole centimeters: in floating point 0.7 / 0.35 is 2.0000000000000004, which would add a grommet per edge (12)
    assert.equal(grommetCount(0.7, 0.7, 35 as never), 8);
  });

  test("hem along the perimeter, pockets along two sides, urgency on top", () => {
    const q = quote(banner({ grommets: 50, hem: true }), P);
    assert.deepEqual(amounts(q), [1260, 240, 480]);
    assert.equal(q.total, 1980);
    assert.equal(quote(banner({ pockets: "top-bottom" }), P).total, 1260 + 720);
    assert.equal(quote(banner({ pockets: "left-right" }), P).total, 1260 + 240);
    const urgent = quote(banner({ grommets: 50, hem: true, urgent: true }), P);
    assert.deepEqual(amounts(urgent), [1260, 240, 480, 594]);
    assert.equal(urgent.title, "Баннер 3×1 м, фронтлит 440 г");
  });
});

describe("input validation", () => {
  test("accepts valid input and rounds banner sizes to 0.1 m", () => {
    assert.deepEqual(normalizeInput(cards({ qty: 500 }), P), cards({ qty: 500 }));
    const b = normalizeInput({ ...banner(), width: "2.34", height: 1.05 }, P) as BannersInput;
    assert.equal(b.width, 2.3);
    assert.equal(b.height, 1.1);
  });

  test("rejects unknown options, runs outside the list, sizes outside the limits", () => {
    for (const bad of [
      cards({ qty: 300 as never }),
      cards({ paper: "gold" as never }),
      cards({ paper: "plastic", lamination: "matte" }),
      banner({ width: 6 }),
      banner({ height: 0.1 }),
      banner({ width: Number.NaN }),
      banner({ grommets: 40 as never }),
      banner({ material: "vinyl" as never }),
      { product: "flyers" },
      null,
    ]) {
      assert.equal(normalizeInput(bad, P), null, JSON.stringify(bad));
    }
  });

  test("options switched off in the price list are rejected", () => {
    const p = clone();
    p.cards.papers.plastic.enabled = false;
    p.banners.enabled = false;
    assert.equal(normalizeInput(cards({ paper: "plastic" }), p), null);
    assert.equal(normalizeInput(banner(), p), null);
  });

  test("the query string round-trips; broken parameters fall back to defaults", () => {
    for (const input of [cards({ qty: 2000, sides: "4+4", lamination: "gloss", corners: true, urgent: true }), banner({ width: 2.5, grommets: 30, hem: true, pockets: "left-right" })]) {
      const search = Object.fromEntries(new URLSearchParams(inputToSearch(input)));
      assert.deepEqual(inputFromSearch(search, P), input);
    }
    assert.equal((inputFromSearch({ p: "banners", w: "99" }, P) as BannersInput).width, 3);
    assert.equal(inputFromSearch({}, P).product, "cards");
  });
});

describe("price list validation", () => {
  test("the default price list is valid", () => {
    assert.deepEqual(parsePriceList(P), { ok: true, value: P });
  });

  test("numbers typed as text are accepted", () => {
    const raw = clone() as unknown as { banners: { hemPerM: unknown } };
    raw.banners.hemPerM = "75,5";
    const r = parsePriceList(raw);
    assert.ok(r.ok);
    assert.equal(r.ok && r.value.banners.hemPerM, 75.5);
  });

  test("negative prices, a run that gets dearer per card and empty option sets are rejected", () => {
    const negative = clone();
    negative.banners.materials.mesh.perM2 = -1;
    assert.match((parsePriceList(negative) as { error: string }).error, /Баннерная сетка, за м²/);

    const tiers = clone();
    tiers.cards.tiers["1000"] = 3;
    assert.match((parsePriceList(tiers) as { error: string }).error, /1000 шт\. выше, чем на 500 шт\./);

    const empty = clone();
    for (const m of Object.values(empty.banners.materials)) m.enabled = false;
    assert.match((parsePriceList(empty) as { error: string }).error, /хотя бы один материал/);

    const range = clone();
    range.banners.width = { min: 4, max: 2 };
    assert.equal(parsePriceList(range).ok, false);
    assert.equal(parsePriceList("nonsense").ok, false);
  });
});
