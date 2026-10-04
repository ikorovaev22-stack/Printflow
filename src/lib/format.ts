// Dates render in the company's time zone, passed explicitly so the server (UTC on most hosts)
// and the browser produce identical text
export const DEFAULT_TIME_ZONE = "Europe/Moscow";

const OPTIONS = {
  date: { day: "numeric", month: "long" },
  short: { day: "numeric", month: "short" },
  time: { hour: "2-digit", minute: "2-digit" },
  dateTime: { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
  hour: { hour: "numeric", hourCycle: "h23" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

const formatters = new Map<string, Intl.DateTimeFormat>();
function fmt(kind: keyof typeof OPTIONS | "iso", timeZone: string) {
  const key = `${kind}:${timeZone}`;
  let f = formatters.get(key);
  if (!f) {
    f =
      kind === "iso"
        ? new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone })
        : new Intl.DateTimeFormat("ru-RU", { ...OPTIONS[kind], timeZone });
    formatters.set(key, f);
  }
  return f;
}

// Plain dates (YYYY-MM-DD) are calendar days: pin them to noon UTC so any zone shows the same day
const parse = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00Z` : d);

export const formatDate = (d: string | null, tz = DEFAULT_TIME_ZONE) => (d ? fmt("date", tz).format(parse(d)) : "—");
export const formatDateShort = (d: string | null, tz = DEFAULT_TIME_ZONE) => (d ? fmt("short", tz).format(parse(d)) : "—");
export const formatDateTime = (d: string, tz = DEFAULT_TIME_ZONE) => fmt("dateTime", tz).format(parse(d));
export const formatTime = (d: string, tz = DEFAULT_TIME_ZONE) => fmt("time", tz).format(parse(d));
export const todayISO = (tz = DEFAULT_TIME_ZONE) => fmt("iso", tz).format(new Date());

export function formatChatTime(d: string, tz = DEFAULT_TIME_ZONE) {
  const dt = parse(d);
  return fmt("iso", tz).format(dt) === todayISO(tz) ? fmt("time", tz).format(dt) : fmt("short", tz).format(dt);
}

export function greeting(tz = DEFAULT_TIME_ZONE) {
  const h = Number(fmt("hour", tz).format(new Date()));
  return h < 5 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер";
}

export const isTimeZone = (tz: string) => {
  try {
    return Intl.supportedValuesOf("timeZone").includes(tz) || tz === "UTC";
  } catch {
    return false;
  }
};

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`;
}
