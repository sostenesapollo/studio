import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ASSETS, db } from "../db";
import { probeDuration } from "../lib/media";

const QUERIES: { brand: string; q: string; tags: string }[] = [
  { brand: "giftsqr", q: "gift", tags: "gift" },
  { brand: "giftsqr", q: "birthday", tags: "birthday" },
  { brand: "giftsqr", q: "couple", tags: "couple" },
  { brand: "giftsqr", q: "phone", tags: "phone" },
  { brand: "tradubook", q: "book", tags: "book" },
  { brand: "tradubook", q: "library", tags: "library" },
  { brand: "tradubook", q: "reading", tags: "reading" },
  { brand: "tradubook", q: "paper", tags: "paper" },
];

async function page(q: string): Promise<string[]> {
  const r = await fetch(`https://mixkit.co/free-stock-video/${q}/`, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
  });
  if (!r.ok) return [];
  const html = await r.text();
  const ids = new Set<string>();
  for (const m of html.matchAll(/assets\.mixkit\.co\/videos\/(\d+)\/\1-(1080|720)\.mp4/g)) {
    ids.add(`${m[1]}-${m[2]}`);
  }
  return [...ids];
}

const MAX_PER_QUERY = 3;
let total = 0;

for (const { brand, q, tags } of QUERIES) {
  const dir = join(ASSETS, "stock", brand);
  mkdirSync(dir, { recursive: true });
  const found = await page(q).catch(() => [] as string[]);
  let n = 0;
  for (const f of found) {
    if (n >= MAX_PER_QUERY) break;
    const id = f.split("-")[0];
    const out = join(dir, `${q}-${id}.mp4`);
    if (existsSync(out)) {
      n++;
      continue;
    }
    const url = `https://assets.mixkit.co/videos/${id}/${f}.mp4`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null);
    if (!res?.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 500_000) continue;
    writeFileSync(out, buf);
    const dur = await probeDuration(out);
    db.query("INSERT INTO broll (path, source, license, tags, duration) VALUES (?,?,?,?,?)").run(
      out,
      `https://mixkit.co/free-stock-video/${q}/`,
      "Mixkit Free License",
      `${tags},${brand},stock`,
      dur,
    );
    console.log("↓", brand, out.split("/").pop(), Math.round(dur) + "s");
    n++;
    total++;
  }
}

console.log("total:", total);
