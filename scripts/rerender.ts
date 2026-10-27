/**
 * Re-monta um vídeo já renderizado usando o .json do projeto ao lado do mp4.
 * Não regera voz nem overlay (nada pago): reaproveita os frames de
 * assets/overlay/<base> e refaz só o assemble do ffmpeg com os clipes atuais
 * (útil quando um screenshot/asset de fundo estava errado).
 *
 * uso: bun run scripts/rerender.ts <id-do-video>
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ASSETS, db, type Video } from "../db";
import { assemble, makeThumb, probeDuration } from "../lib/media";
import { buildCues } from "../lib/sfx";
import { TEMPLATES, type TemplateId } from "../lib/templates";

const id = Number(process.argv[2]);
if (!id) throw new Error("informe o id do vídeo: bun run scripts/rerender.ts 34");

const video = db.query("SELECT * FROM videos WHERE id = ?").get(id) as Video | null;
if (!video?.file_path) throw new Error(`vídeo ${id} não encontrado`);

const project = JSON.parse(video.project ?? "{}");
const out = video.file_path;
const base = out.split("/").pop()!.replace(/\.mp4$/, "");
const framesDir = join(ASSETS, "overlay", base);

const template = TEMPLATES[project.template as TemplateId];
if (!template) throw new Error(`template desconhecido: ${project.template}`);

const frames = readdirSync(framesDir).filter((f) => f.endsWith(".png")).sort();
const m = frames.length ? /^(.*?)(\d+)(\.png)$/.exec(frames[0]) : null;
if (!m || !existsSync(join(framesDir, frames[0]))) {
  throw new Error(`frames do overlay indisponíveis: ${framesDir}`);
}
const pad = m[2].length;

console.log(`re-montando v${id} — ${base} (${frames.length} frames de overlay)`);

await assemble({
  clips: project.clips,
  splitTop: project.splitTop ?? undefined,
  split: Boolean(project.splitTop?.length),
  overlayPattern: join(framesDir, `${m[1]}%0${pad}d${m[3]}`),
  overlayFps: 30,
  out,
  duration: project.duration,
  music: project.music ?? undefined,
  voice: project.voice ?? undefined,
  grade: template.grade,
  musicVolume: template.musicVolume,
  musicStart: (project.seed % 47) + 3,
  sfx: buildCues({
    duration: project.duration,
    segs: Math.max(2, Math.round(project.duration / 4.2)),
    seed: project.seed,
    hasMock: true,
    hasCta: Boolean(project.script?.cta),
  }),
  seed: project.seed,
  transition: template.transition,
});

const thumb = video.thumb_path ?? join(out, "..", `${base}.jpg`);
await makeThumb(out, thumb);
const dur = await probeDuration(out);
db.query("UPDATE videos SET duration = ?, thumb_path = ? WHERE id = ?").run(dur, thumb, id);
console.log(`ok → ${out} (${dur.toFixed(2)}s)`);
