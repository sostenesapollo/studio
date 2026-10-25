import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ASSETS } from "../db";
import { getKeys } from "./keys";
import { FFMPEG, probeDuration, run } from "./media";

const VOICES = join(ASSETS, "voices");
mkdirSync(VOICES, { recursive: true });

/** Aproximação de custo do plano Starter (~US$5 / 30k chars). */
export const CHAR_COST = 0.00017;

export function voiceEnabled() {
  return Boolean(getKeys().elevenlabs);
}

const CACHE = join(VOICES, "pt-voices.json");

async function ptVoices(key: string): Promise<string[]> {
  try {
    const raw = await Bun.file(CACHE).text();
    const list = JSON.parse(raw);
    if (Array.isArray(list) && list.length) return list;
  } catch {}
  const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } });
  if (!r.ok) throw new Error(`elevenlabs voices HTTP ${r.status}`);
  const j: any = await r.json();
  const all: any[] = j?.voices ?? [];
  const pt = all.filter((v) => {
    const labels = JSON.stringify(v.labels ?? {}).toLowerCase();
    return labels.includes('"language":"pt') || labels.includes("portugu") || /portugu/i.test(v.name ?? "");
  });
  const ids = (pt.length ? pt : all).map((v) => v.voice_id).filter(Boolean);
  await Bun.write(CACHE, JSON.stringify(ids, null, 2));
  return ids;
}

async function pickVoice(key: string, prefer?: string | null, seed?: number): Promise<string> {
  if (prefer) return prefer;
  const ids = await ptVoices(key);
  if (!ids.length) return "21m00Tcm4TlvDq8ikWAM";
  return ids[Math.abs(seed ?? 0) % ids.length];
}

export type VoiceResult = { path: string; duration: number; chars: number };

export async function synthesize(text: string, voiceId?: string | null, seed?: number): Promise<VoiceResult> {
  const key = getKeys().elevenlabs;
  if (!key) throw new Error("sem chave ElevenLabs — cole na aba Créditos");
  const id = await pickVoice(key, voiceId, seed);
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
