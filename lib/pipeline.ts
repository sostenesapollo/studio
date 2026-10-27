import { readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ASSETS, FILES, db, type Brand, type Video } from "../db";
import { assemble, makeThumb, probeDuration } from "./media";
import { renderOverlay } from "./overlay";
import { buildScript, makeCaptions } from "./script";
import { CHAR_COST, synthesize, voiceEnabled } from "./voice";
import { logSpend } from "./credits";
import { pickTemplate, type TemplateId } from "./templates";
import { buildCues } from "./sfx";
import type { Lang } from "./writer";

function brollPool(brand: string, format?: string, lang: Lang = "pt"): { clips: string[]; demo: string[] } {
  const stock: string[] = [];
  const demo: string[] = [];

  for (const sub of ["stock", "broll"]) {
    const dir = join(ASSETS, sub, brand);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (/\.(mp4|mov|webm)$/i.test(f)) stock.push(join(dir, f));
  }

  // Telas do produto por idioma (assets/demo/<marca>/<lang>/) para a UI gravada
  // não ficar num idioma diferente da narração. Cai no diretório flat se faltar.
  const demoBase = join(ASSETS, "demo", brand);
  const langDir = join(demoBase, lang);
  const ddir = existsSync(langDir) ? langDir : demoBase;
  if (existsSync(ddir)) for (const f of readdirSync(ddir)) if (/\.(mp4|webm|mov|png|jpe?g)$/i.test(f)) demo.push(join(ddir, f));

  if (format === "demo" && demo.length) return { clips: demo, demo };
  return { clips: stock, demo };
}

const MOODS: Record<string, string[]> = {
  giftsqr: ["upbeat", "electronic", "chill", "funk", "lofi", "hip-hop"],
  tradubook: ["acoustic", "cinematic", "ambient", "inspiring", "chill", "lofi"],
};

function moodOf(path: string): string {
  const base = path.split("/").pop() ?? "";
  const m = /^mk-([a-z-]+)-/.exec(base);
  if (m) return m[1];
  if (/acoustic|guitar/.test(base)) return "acoustic";
  if (/piano|ambient/.test(base)) return "ambient";
  return "other";
}

/** Escolhe trilha evitando as últimas usadas e priorizando o mood da marca. */
export function pickMusic(brand: string, seed: number): string | undefined {
  const dir = join(ASSETS, "music");
  if (!existsSync(dir)) return undefined;
  const all = readdirSync(dir)
    .filter((f) => /\.(mp3|m4a|wav)$/i.test(f))
    .map((f) => join(dir, f));
  if (!all.length) return undefined;

  const recent = new Set(
    (db.query("SELECT path FROM music_use ORDER BY id DESC LIMIT 8").all() as { path: string }[]).map((r) => r.path),
  );

  const preferred = all.filter((p) => MOODS[brand]?.includes(moodOf(p)));
  const tier = (pool: string[]) => pool.filter((p) => !recent.has(p));

  let candidates = tier(preferred);
  if (!candidates.length) candidates = tier(all);
  if (!candidates.length) candidates = preferred.length ? preferred : all;

  const pick = candidates[Math.abs(seed * 13) % candidates.length];
  return pick;
}

export type GenerateOpts = {
  brand: Brand;
  format: "faceless" | "demo" | "avatar";
  angle?: string;
  template?: TemplateId;
  seed?: number;
  particle?: string;
  grade?: string;
  hook?: string;
  durationSec?: number;
  /** idioma da legenda, dublagem, título e descrição */
  lang?: Lang;
};

/** textos que ficam queimados no vídeo (mock do produto, rótulos do split) */
const I18N = {
  pt: {
    splitTopFile: "o arquivo",
    splitTopGift: "o presente",
    splitBottomBook: "o livro pronto",
    splitBottomGift: "ela abre assim",
    bookChapter: "capítulo iv · traduzido",
    bookTitle: "O retrato de Dorian Gray",
    bookLines: [
      "A sala estava cheia do perfume das rosas, e o som do piano vinha de outro quarto.",
      "Ele fechou o livro devagar, como quem guarda uma promessa.",
      "Do lado de fora, a cidade continuava indiferente ao que acabara de acontecer.",
    ],
    compareFrom:
      "The room was full of the smell of roses, and the sound of the piano came from another room. He closed the book slowly, as if keeping a promise.",
    compareTo: "A sala estava cheia do perfume das rosas, e o som do piano vinha de outro quarto. Ele fechou o livro devagar, como quem guarda uma promessa.",
    phoneName: "Pra você, Bia",
    phoneDays: "23 dias 11:04:59",
  },
  en: {
    splitTopFile: "the file",
    splitTopGift: "the gift",
    splitBottomBook: "the book",
    splitBottomGift: "she opens it",
    bookChapter: "chapter iv · translated",
    bookTitle: "The Picture of Dorian Gray",
    bookLines: [
      "The room was full of the smell of roses, and the sound of the piano came from another room.",
      "He closed the book slowly, as if keeping a promise.",
      "Outside, the city went on, indifferent to what had just happened.",
    ],
    compareFrom:
      "La habitación estaba llena del perfume de las rosas, y el sonido del piano venía de otro cuarto. Cerró el libro despacio, como quien guarda una promesa.",
    compareTo: "The room was full of the smell of roses, and the sound of the piano came from another room. He closed the book slowly, as if keeping a promise.",
    phoneName: "For you, Bia",
    phoneDays: "23 days 11:04:59",
  },
} as const;

export async function generateVideo(o: GenerateOpts): Promise<Video> {
  const seed = o.seed ?? Math.floor(Math.random() * 1e9);
  const lang: Lang = o.lang === "en" ? "en" : "pt";
  const t = I18N[lang];
  const script = await buildScript(o.brand.slug, o.format, seed, o.angle as any, lang);
  if (o.hook) script.hook = o.hook;

  const template = pickTemplate(
    seed,
    o.template ? [o.template] : (["natural", "natural", "editorial", "premium", "bold", "letterbox"] as TemplateId[]),
  );
  script.template = template.id;
  const particle = o.particle ?? template.particle;
  const grade = (o.grade ?? template.grade) as any;

  /* ---------- voz ---------- */
  let voicePath: string | undefined;
  let voiceDur = 0;
  if (voiceEnabled()) {
    try {
      const v = await synthesize(script.voiceover, o.brand.voice_id, seed, lang);
      voicePath = v.path;
      voiceDur = v.duration;
      logSpend({
        provider: "elevenlabs",
        model: "eleven_multilingual_v2",
        units: v.chars,
        cost: +(v.chars * CHAR_COST).toFixed(4),
      });
    } catch (e) {
      console.warn("voz indisponível:", String(e).slice(0, 180));
    }
  }

  const duration =
    o.durationSec ??
    (voiceDur ? Math.min(Math.max(Math.ceil(voiceDur + 3.0), 18), 28) : template.duration);

  /* ---------- b-roll ---------- */
  const { clips, demo } = brollPool(o.brand.slug, o.format, lang);
  if (!clips.length) throw new Error("sem b-roll em assets/stock — roda scripts/fetch-pexels.ts");
  const rotated = clips.map((_, k) => clips[(k + seed) % clips.length]);

  const splitTop = template.split ? (demo.length ? demo : rotated.slice().reverse()) : undefined;

  const track = pickMusic(o.brand.slug, seed);

  /* ---------- render ---------- */
  const stamp = new Date().toISOString().slice(0, 10);
  const dir = join(FILES, o.brand.slug, stamp);
  mkdirSync(dir, { recursive: true });
  const base = `v${Date.now().toString().slice(-5)}-${template.id}-${o.format}`;
  const out = join(dir, `${base}.mp4`);
  const framesDir = join(ASSETS, "overlay", base);

  const frames = Math.round(duration * 30);
  const captions = voiceDur
    ? makeCaptions(script.voiceover, 0.15, 0.1 + voiceDur)
    : makeCaptions(script.voiceover, 0.2, duration - 3.0);

  const splitLabels = template.split
    ? {
        top: o.brand.slug === "tradubook" ? t.splitTopFile : t.splitTopGift,
        bottom: o.brand.slug === "tradubook" ? t.splitBottomBook : t.splitBottomGift,
      }
    : null;

  const overlay = await renderOverlay(
    {
      hook: script.hook,
      kicker: script.kicker,
      cta: script.cta,
      accent: o.brand.accent,
      brand: o.brand.name,
      captions,
      closing: script.closing,
      template,
      particle,
      split: splitLabels,
      mock:
        !(script.angle?.includes("objecao") ?? false) && seed % 10 >= 7
          ? null
          : o.brand.slug === "tradubook"
            ? script.angle?.includes("objecao") || seed % 3 === 0
              ? {
                  mode: "compare",
                  lang,
                  en: t.compareFrom,
                  pt: t.compareTo,
                }
              : {
                  mode: "book",
                  lang,
                  chapter: t.bookChapter,
                  title: t.bookTitle,
                  lines: [...t.bookLines],
                }
            : { mode: "phone", lang, name: t.phoneName, days: t.phoneDays },
      durationInFrames: frames,
      showProgress: true,
    } as any,
    framesDir,
  );

  await assemble({
    clips: rotated,
    splitTop,
    split: Boolean(template.split),
    overlayPattern: join(overlay.dir, overlay.pattern),
    overlayFps: 30,
    out,
    duration,
    music: track,
    voice: voicePath,
    grade,
    musicVolume: template.musicVolume,
    musicStart: (seed % 47) + 3,
    sfx: buildCues({
      duration,
      segs: Math.max(2, Math.round(duration / 4.2)),
      seed,
      hasMock: Boolean(script.angle?.includes("objecao") ?? false) || seed % 10 < 7,
      hasCta: Boolean(script.cta),
    }),
    seed,
    transition: template.transition,
  });

  const thumb = join(FILES, "thumbs", `${base}.jpg`);
  await makeThumb(out, thumb);
  const realDur = await probeDuration(out);

  const project = {
    brand: o.brand.slug,
    format: o.format,
    template: template.id,
    trigger: script.trigger,
    angle: script.angle,
    script,
    clips: rotated.slice(0, 5),
    splitTop: splitTop?.slice(0, 3) ?? null,
    music: track,
    voice: voicePath ?? null,
    captions,
    duration: realDur,
    seed,
    lang,
    caption: script.caption,
    hashtags: script.hashtags,
  };
  writeFileSync(out.replace(/\.mp4$/, ".json"), JSON.stringify(project, null, 2));

  const r = db
    .query(
      "INSERT INTO videos (brand_id, title, hook, format, status, file_path, thumb_path, duration, project, caption, hashtags, lang) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *",
    )
    .get(
      o.brand.id,
      script.hook,
      script.hook,
      `${template.id}/${o.format}`,
      "new",
      out,
      thumb,
      realDur,
      JSON.stringify(project),
      script.caption,
      script.hashtags.join(" "),
      lang,
    ) as Video;

  if (track) db.query("INSERT INTO music_use (path, video_id) VALUES (?, ?)").run(track, r.id);
  logSpend({ provider: "local", model: `remotion+ffmpeg/${template.id}`, videoId: r.id, cost: 0 });
  return r;
}

export const PARTICLE_PRESETS = ["gold-dust", "bokeh", "light-leak", "grain", "sparkle", "none"] as const;
