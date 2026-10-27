import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ASSETS } from "../db";

const DIR = join(ASSETS, "sfx");
export type Cue = { path: string; at: number; gain: number };

function bank(tipo: string): string[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((f) => f.startsWith(`${tipo}-`) && f.endsWith(".mp3"))
    .map((f) => join(DIR, f));
}

/**
 * Sound design discreto: entra, transiciona, prova, fecha.
 * Nunca um efeito por frase — e nada por cima da fala.
 */
export function buildCues(opts: {
  duration: number;
  segs: number;
  seed: number;
  hasMock: boolean;
  hasCta: boolean;
}): Cue[] {
  const cues: Cue[] = [];
  const pick = (tipo: string, k: number) => {
    const b = bank(tipo);
    return b.length ? b[Math.abs(opts.seed + k * 31) % b.length] : null;
  };

  const add = (tipo: string, at: number, gain: number, k = 0) => {
    const p = pick(tipo, k);
    if (p) cues.push({ path: p, at: Math.max(0, at), gain });
  };

  // abertura: o hook aparece com um pop curto
  add("pop", 0.12, 0.22, 1);

  // transições de plano
  const per = opts.duration / Math.max(opts.segs, 1);
  for (let k = 1; k < opts.segs; k++) {
    add("whoosh", k * (per - 0.32), 0.13, k);
  }

  // prova visual (mock)
  if (opts.hasMock) add("paper", 1.15, 0.17, 2);

  // fechamento
  if (opts.hasCta) {
    add("ui", opts.duration - 2.35, 0.2, 3);
  }
  add("riser", opts.duration - 2.6, 0.09, 4);

  return cues;
}
