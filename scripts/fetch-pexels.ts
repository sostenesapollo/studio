/**
 * Baixa B-roll vertical 1080p+ do Pexels por tema (licença Pexels: uso comercial livre).
 * assets/stock/<marca>/px-<id>.mp4
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ASSETS, db } from "../db";
import { getKeys } from "../lib/keys";
import { probeDuration } from "../lib/media";

const KEY = getKeys().pexels;
if (!KEY) {
  console.error("sem chave Pexels (~/.config/vsl/pexels)");
  process.exit(1);
}

const PLAN: { brand: string; queries: string[] }[] = [
  {
    brand: "giftsqr",
    queries: [
      "couple surprise gift",
      "woman happy phone",
      "birthday celebration",
      "handing gift box",
      "unboxing present",
      "couple laughing home",
      "person using smartphone night",
      "romantic dinner",
      "flower bouquet hands",
      "confetti celebration",
      "friends party toast",
      "girl smiling phone screen",
    ],
  },
  {
    brand: "tradubook",
    queries: [
      "reading book coffee",
      "old library shelves",
      "book pages turning",
      "stack of books",
      "person reading window",
      "typewriter typing",
      "library aisle walking",
      "hand writing notebook",
      "bookshelf cozy",
      "laptop desk night",
      "coffee book morning",
      "bookstore browsing",
    ],
  },
];

const perQuery = Number(process.argv[2] ?? 2);

async function search(q: string) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&size=medium&per_page=6`;
  const r = await fetch(url, { headers: { Authorization: KEY! } });
  if (!r.ok) return [];
  const j: any = await r.json();
  return (j?.videos ?? []) as any[];
}

function bestFile(v: any): string | null {
  const files = (v.video_files ?? []).filter((f: any) => f.width && f.height && f.height >= f.width);
  const sorted = files.sort((a: any, b: any) => Math.abs(a.width - 1080) - Math.abs(b.width - 1080));
  return sorted[0]?.link ?? null;
}

let total = 0;
for (const { brand, queries } of PLAN) {
  const dir = join(ASSETS, "stock", brand);
  mkdirSync(dir, { recursive: true });
  for (const q of queries) {
    const vids = await search(q).catch(() => []);
    let n = 0;
    for (const v of vids) {
      if (n >= perQuery) break;
      const out = join(dir, `px-${v.id}.mp4`);
      if (existsSync(out)) {
        n++;
        continue;
      }
      const link = bestFile(v);
      if (!link) continue;
      const res = await fetch(link).catch(() => null);
      if (!res?.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength < 400_000) continue;
      writeFileSync(out, buf);
      const dur = await probeDuration(out);
      db.query("INSERT INTO broll (path, source, license, tags, duration) VALUES (?,?,?,?,?)").run(
        out,
        `https://www.pexels.com/video/${v.id}/`,
        "Pexels License",
        `${q},${brand},pexels`,
        dur,
      );
      console.log("↓", brand, q, out.split("/").pop(), Math.round(dur) + "s");
      n++;
      total++;
    }
  }
}
console.log("total:", total);
for (const { brand } of PLAN) {
  const d = join(ASSETS, "stock", brand);
  console.log(brand, readdirSync(d).filter((f) => f.startsWith("px-")).length, "clipes Pexels");
}
