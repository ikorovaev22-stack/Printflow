// Reads a public web page for the knowledge base. The server never connects to a private, loopback or link-local
// address: every address a host name resolves to is checked at connect time (no DNS rebinding), redirects too.
// Node-only (no "server-only" marker so unit tests can import the address check).
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

export class PageError extends Error {}

const v4 = (ip: string) => ip.split(".").map(Number);

function publicV4(ip: string) {
  const [a, b, c] = v4(ip);
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

export function isPublicAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return publicV4(ip);
  if (!net.isIPv6(ip)) return false;
  const s = ip.toLowerCase();
  // IPv4-mapped and NAT64 addresses carry an IPv4 address at the end
  const tail = s.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (tail) return publicV4(tail);
  // Global unicast only (2000::/3), minus documentation (2001:db8::/32) and tunnels that wrap IPv4 (6to4, Teredo)
  return /^[23]/.test(s) && !/^2001:0?db8:|^2002:|^2001:(0:|:)/.test(s);
}

export function parsePublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new PageError("Неверный адрес страницы");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new PageError("Адрес должен начинаться с https://");
  if (url.username || url.password) throw new PageError("Адрес не должен содержать логин и пароль");
  if (url.port && url.port !== "80" && url.port !== "443") throw new PageError("Нестандартный порт не поддерживается");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) ? !isPublicAddress(host) : !host.includes(".") || /\.(local|internal|localhost)$/i.test(host)) {
    throw new PageError("Это не публичный адрес в интернете");
  }
  url.hash = "";
  return url;
}

// dns.lookup with every resolved address checked; called by the socket right before it connects
const lookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, family: options.family, hints: options.hints }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address))) {
      return callback(new PageError("Сайт ведёт на внутренний адрес"), "", 4);
    }
    if (options.all) (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
};

type Raw = { status: number; location?: string; type: string; body: Buffer };

function get(url: URL, maxBytes: number, timeoutMs: number): Promise<Raw> {
  return new Promise((resolve, reject) => {
    const req = (url.protocol === "https:" ? https : http).get(
      url,
      {
        lookup,
        timeout: timeoutMs,
        headers: { "user-agent": "Mozilla/5.0 (compatible; PrintFlowBot/1.0)", accept: "text/html,text/plain;q=0.9", "accept-language": "ru" },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const type = String(res.headers["content-type"] ?? "");
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location, type, body: Buffer.alloc(0) });
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) req.destroy(new PageError("Страница слишком большая"));
          else chunks.push(chunk);
        });
        res.on("end", () => resolve({ status, type, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new PageError("Сайт не ответил вовремя")));
    req.on("error", (e) => reject(e instanceof PageError ? e : new PageError("Не удалось открыть страницу")));
  });
}

// Russian sites still use windows-1251: charset from the header, else from <meta>, else UTF-8
function decode(body: Buffer, type: string) {
  const head = body.subarray(0, 4096).toString("latin1");
  const charset = (type.match(/charset=["']?([\w-]+)/i)?.[1] ?? head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? "utf-8").toLowerCase();
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

export async function fetchPublicPage(raw: string, { maxBytes = 3_000_000, timeoutMs = 10_000 } = {}): Promise<{ url: string; html: string }> {
  let url = parsePublicUrl(raw);
  for (let hop = 0; hop <= 3; hop++) {
    const res = await get(url, maxBytes, timeoutMs);
    if (res.location && res.status >= 300 && res.status < 400) {
      url = parsePublicUrl(new URL(res.location, url).toString());
      continue;
    }
    if (res.status !== 200) throw new PageError(`Сайт ответил кодом ${res.status}`);
    if (res.type && !/text\/html|application\/xhtml|text\/plain/i.test(res.type)) throw new PageError("По адресу не веб-страница");
    return { url: url.toString(), html: decode(res.body, res.type) };
  }
  throw new PageError("Слишком много перенаправлений");
}
