import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ASSETS } from "../db";

const DIR = join(ASSETS, "music");
mkdirSync(DIR, { recursive: true });

const QUERIES = [
  "lofi ambient",
  "ambient piano",
  "warm acoustic guitar instrumental",
  "cinematic soft piano",
  "minimal electronic beat",
  "hopeful strings",
  "dreamy synth pad",
  "upbeat ukulele instrumental",
  "tense cinematic pulse",
  "soft jazz trio",
];

async function search(q: string) {
  const url =
    "https://archive.org/advancedsearch.php?q=" +
    encodeURIComponent(`(${q}) AND mediatype:(audio) AND licenseurl:(*creativecommons*)`) +
    "&fl%5B%5D=identifier&rows=8&page=1&output=json";
  const r = await fetch(url);
  const j: any = await r.json();
  return (j?.response?.docs ?? []) as { identifier: string }[];
}

async function pick(id: string) {
  const r = await fetch(`https://archive.org/metadata/${id}`);
  const j: any = await r.json();
  const files: any[] = (j?.files ?? []).filter((f) => /\.mp3$/i.test(f.name));
  const sized = files
    .filter((f) => Number(f.size ?? 0) > 1_500_000 && Number(f.size ?? 0) < 12_000_000)
    .sort((a, b) => Number(a.size) - Number(b.size));
  const f = sized[0];
  return f ? `https://archive.org/download/${id}/${encodeURIComponent(f.name)}` : null;
}

if (readdirSync(DIR).filter((f) => /\.mp3$/i.test(f)).length >= 10) {
  console.log("músicas já existem");
  process.exit(0);
}

let n = 0;
for (const q of QUERIES) {
  const docs = await search(q).catch(() => []);
  for (const d of docs) {
    if (n >= 10) break;
    const url = await pick(d.identifier).catch(() => null);
    if (!url) continue;
    const res = await fetch(url).catch(() => null);
    if (!res?.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 800_000) continue;
    const out = join(DIR, `${q.replace(/\s+/g, "-")}-${n}.mp3`);
    if (existsSync(out)) continue;
    writeFileSync(out, buf);
    console.log("↓", q, "→", out.split("/").pop());
    n++;
  }
  if (n >= 10) break;
}
console.log("total:", n);
