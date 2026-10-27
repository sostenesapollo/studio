/**
 * Baixa efeitos sonoros do Mixkit (licença livre comercial).
 * assets/sfx/<tipo>-<id>.mp3
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ASSETS } from "../db";

const DIR = join(ASSETS, "sfx");
mkdirSync(DIR, { recursive: true });

const ALVOS = [
  { tipo: "whoosh", url: "https://mixkit.co/free-sound-effects/whoosh/" },
  { tipo: "pop", url: "https://mixkit.co/free-sound-effects/pop/" },
  { tipo: "click", url: "https://mixkit.co/free-sound-effects/click/" },
  { tipo: "transition", url: "https://mixkit.co/free-sound-effects/transition/" },
  { tipo: "paper", url: "https://mixkit.co/free-sound-effects/page-turn/" },
  { tipo: "riser", url: "https://mixkit.co/free-sound-effects/riser/" },
  { tipo: "ui", url: "https://mixkit.co/free-sound-effects/interface/" },
];

const PER = Number(process.argv[2] ?? 3);

for (const { tipo, url } of ALVOS) {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" } }).catch(() => null);
  if (!r?.ok) {
    console.log("falhou página:", tipo);
    continue;
  }
  const html = await r.text();
  const ids = new Set<string>();
  for (const m of html.matchAll(/assets\.mixkit\.co\/active_storage\/sfx\/(\d+)\/\1-(?:preview|original)\.mp3/g)) ids.add(m[1]);
  let n = 0;
  for (const id of ids) {
    if (n >= PER) break;
    const out = join(DIR, `${tipo}-${id}.mp3`);
    if (existsSync(out)) {
      n++;
      continue;
    }
    const res = await fetch(`https://assets.mixkit.co/active_storage/sfx/${id}/${id}-preview.mp3`, { headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null);
    if (!res?.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 4000) continue;
    writeFileSync(out, buf);
    console.log("↓", tipo, id, Math.round(buf.byteLength / 1024) + "kb");
    n++;
  }
}

console.log("arquivos:", readdirSync(DIR).filter((f) => f.endsWith(".mp3")).length);
