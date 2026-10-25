/**
 * Baixa trilhas do Mixkit (licença livre comercial) por mood.
 * assets/music/mk-<mood>-<id>.mp3
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ASSETS } from "../db";

const DIR = join(ASSETS, "music");
mkdirSync(DIR, { recursive: true });

const TAGS = [
  "upbeat",
  "chill",
  "cinematic",
  "hip-hop",
  "electronic",
  "acoustic",
  "inspiring",
  "ambient",
  "funk",
  "lofi",
];

const PER_TAG = Number(process.argv[2] ?? 3);

async function page(tag: string): Promise<string[]> {
  const r = await fetch(`https://mixkit.co/free-stock-music/tag/${tag}/`, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
  });
  if (!r.ok) return [];
  const html = await r.text();
  const ids = new Set<string>();
  for (const m of html.matchAll(/assets\.mixkit\.co\/music\/(\d+)\/\1\.mp3/g)) ids.add(m[1]);
  return [...ids];
}

let total = 0;
for (const tag of TAGS) {
  const ids = await page(tag).catch(() => [] as string[]);
  let n = 0;
  for (const id of ids) {
    if (n >= PER_TAG) break;
    const out = join(DIR, `mk-${tag}-${id}.mp3`);
    if (existsSync(out)) {
      n++;
      continue;
    }
    const res = await fetch(`https://assets.mixkit.co/music/${id}/${id}.mp3`, { headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null);
    if (!res?.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 300_000) continue;
    writeFileSync(out, buf);
    console.log("↓", tag, id, Math.round(buf.byteLength / 1024) + "kb");
    n++;
    total++;
  }
}

console.log("total:", total, "| arquivos:", readdirSync(DIR).filter((f) => /\.(mp3|m4a|wav)$/i.test(f)).length);
