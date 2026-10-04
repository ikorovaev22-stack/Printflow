const date = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const dateShort = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

const parse = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00` : d);

export const formatDate = (d: string | null) => (d ? date.format(parse(d)) : "—");
export const formatDateShort = (d: string | null) => (d ? dateShort.format(parse(d)) : "—");
export const formatTime = (d: string) => time.format(parse(d));

export function formatChatTime(d: string) {
  const dt = parse(d);
  return dt.toDateString() === new Date().toDateString() ? time.format(dt) : dateShort.format(dt);
}

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
