import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ASSETS, db } from "../db";
import { probeDuration } from "../lib/media";

type Q = { brand: string; q: string; tags: string };

const QUERIES: Q[] = [
  { brand: "giftsqr", q: "birthday celebration home movie", tags: "celebration,vintage" },
  { brand: "giftsqr", q: "children playing gifts", tags: "family,vintage" },
  { brand: "tradubook", q: "library books reading", tags: "library,books" },
  { brand: "tradubook", q: "typewriter typing office", tags: "typewriter,vintage" },
  { brand: "tradubook", q: "old books library shelves", tags: "books,shelves" },
  { brand: "giftsqr", q: "couple walking city 1950", tags: "couple,vintage" },
];

async function search(q: string, rows = 12) {
  const url =
    "https://archive.org/advancedsearch.php?q=" +
    encodeURIComponent(`(${q}) AND mediatype:(movies) AND collection:(prelinger OR americana OR classic_tv)`) +
    `&fl%5B%5D=identifier&fl%5B%5D=title&rows=${rows}&page=1&output=json`;
  const r = await fetch(url);
  const j: any = await r.json();
  return (j?.response?.docs ?? []) as { identifier: string; title: string }[];
}

async function pickFile(id: string): Promise<{ url: string; name: string } | null> {
  const r = await fetch(`https://archive.org/metadata/${id}`);
  const j: any = await r.json();
  const files: any[] = j?.files ?? [];
  const candidates = files.filter((f) => /\.(mp4|mpeg4|ogv)$/i.test(f.name));
  if (!candidates.length) return null;
  const sized = candidates
    .filter((f) => Number(f.size ?? 0) > 1_000_000 && Number(f.size ?? 0) < 60_000_000)
    .sort((a, b) => Number(a.size) - Number(b.size));
  const f = sized[0] ?? candidates[0];
  return { url: `https://archive.org/download/${id}/${encodeURIComponent(f.name)}`, name: f.name };
}

const only = process.argv[2];
let added = 0;

for (const { brand, q, tags } of QUERIES) {
  if (only && !tags.includes(only) && !q.includes(only)) continue;
  const dir = join(ASSETS, "broll", brand);
  mkdirSync(dir, { recursive: true });
  const docs = await search(q).catch(() => []);
  for (const d of docs.slice(0, 4)) {
    const out = join(dir, `${d.identifier}.mp4`);
    if (existsSync(out)) continue;
    const f = await pickFile(d.identifier).catch(() => null);
    if (!f) continue;
    process.stdout.write(`↓ ${d.identifier} (${f.name})\n`);
    const res = await fetch(f.url).catch(() => null);
    if (!res || !res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 400_000) continue;
    writeFileSync(out, buf);
    const dur = await probeDuration(out);
    db.query("INSERT INTO broll (path, source, license, tags, duration) VALUES (?,?,?,?,?)").run(
      out,
      `https://archive.org/details/${d.identifier}`,
      "Public domain (Internet Archive / Prelinger)",
      `${tags},${brand}`,
      dur,
    );
    added++;
    if (added >= 6) break;
  }
  if (added >= 6) break;
}

console.log(`\nbroll baixados: ${added}`);
