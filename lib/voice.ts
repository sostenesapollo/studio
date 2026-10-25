import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ASSETS } from "../db";
import { getKeys } from "./keys";
import { FFMPEG, probeDuration, run } from "./media";
import type { Lang } from "./writer";

const VOICES = join(ASSETS, "voices");
mkdirSync(VOICES, { recursive: true });

/** Aproximação de custo do plano Starter (~US$5 / 30k chars). */
export const CHAR_COST = 0.00017;

export function voiceEnabled() {
  return Boolean(getKeys().elevenlabs);
}

/** id da voz padrão por idioma (usado se a conta não tiver voz daquele idioma) */
const DEFAULT_VOICE: Record<Lang, string> = {
  pt: "21m00Tcm4TlvDq8ikWAM", // Rachel fala português no eleven_multilingual_v2
  en: "21m00Tcm4TlvDq8ikWAM",
};

function matchesLang(labels: string, name: string, lang: Lang): boolean {
  if (lang === "pt") {
    return labels.includes('"language":"pt') || labels.includes("portugu") || /portugu/i.test(name);
  }
  return (
    labels.includes('"language":"en') ||
    /english|american|british|australian|irish|canadian/.test(labels) ||
    /english|american|british|australian/.test(name)
  );
}

const cachePath = (lang: Lang) => join(VOICES, `${lang}-voices.json`);

async function voicesFor(key: string, lang: Lang): Promise<string[]> {
  const cache = cachePath(lang);
  try {
    const raw = await Bun.file(cache).text();
    const list = JSON.parse(raw);
    if (Array.isArray(list) && list.length) return list;
  } catch {}
  const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } });
  if (!r.ok) throw new Error(`elevenlabs voices HTTP ${r.status}`);
  const j: any = await r.json();
  const all: any[] = j?.voices ?? [];
  const matched = all.filter((v) => matchesLang(JSON.stringify(v.labels ?? {}).toLowerCase(), String(v.name ?? "").toLowerCase(), lang));
  const ids = (matched.length ? matched : all).map((v) => v.voice_id).filter(Boolean);
  await Bun.write(cache, JSON.stringify(ids, null, 2));
  return ids;
}

async function pickVoice(key: string, prefer: string | null | undefined, seed: number | undefined, lang: Lang): Promise<string> {
  // a voz fixa da marca é PT-BR: só vale quando o vídeo é em português
  if (prefer && lang === "pt") return prefer;
  const ids = await voicesFor(key, lang);
  if (!ids.length) return DEFAULT_VOICE[lang];
  return ids[Math.abs(seed ?? 0) % ids.length];
}

export type VoiceResult = { path: string; duration: number; chars: number };

export async function synthesize(text: string, voiceId?: string | null, seed?: number, lang: Lang = "pt"): Promise<VoiceResult> {
  const key = getKeys().elevenlabs;
  if (!key) throw new Error("sem chave ElevenLabs — cole na aba Créditos");
  const id = await pickVoice(key, voiceId, seed, lang);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.42, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`elevenlabs TTS HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const raw = join(VOICES, `raw-${Date.now()}.mp3`);
  await Bun.write(raw, buf);
  const path = raw.replace("raw-", "vo-");
  // normaliza loudness e remove silêncio das pontas
  await run(FFMPEG, [
    "-y",
    "-i",
    raw,
    "-af",
    "atempo=1.12,silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=11",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    path.replace(/\.mp3$/, ".m4a"),
  ]);
  const out = existsSync(path.replace(/\.mp3$/, ".m4a")) ? path.replace(/\.mp3$/, ".m4a") : raw;
  return { path: out, duration: await probeDuration(out), chars: text.length };
}
