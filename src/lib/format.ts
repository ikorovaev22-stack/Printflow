// Fixed time zone: server (UTC on Vercel) and browser must render identical text
const timeZone = "Europe/Moscow";
const date = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone });
const dateShort = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone });
const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone });
const isoDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone });

// Plain dates (YYYY-MM-DD) are calendar days: pin them to noon UTC so any zone shows the same day
const parse = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00Z` : d);

export const formatDate = (d: string | null) => (d ? date.format(parse(d)) : "—");
export const formatDateShort = (d: string | null) => (d ? dateShort.format(parse(d)) : "—");
export const formatTime = (d: string) => time.format(parse(d));
export const todayISO = () => isoDay.format(new Date());

export function formatChatTime(d: string) {
  const dt = parse(d);
  return isoDay.format(dt) === todayISO() ? time.format(dt) : dateShort.format(dt);
}

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
