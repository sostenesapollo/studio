import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const CANDIDATES = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];
function resolveBin(name: string): string {
  for (const dir of CANDIDATES) {
    const p = `${dir}/${name}`;
    if (existsSync(p)) return p;
  }
  return name;
}

export const FFMPEG = resolveBin("ffmpeg");
export const FFPROBE = resolveBin("ffprobe");

export function run(cmd: string, args: string[], cwd?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d.toString()));
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

export async function probeDuration(file: string): Promise<number> {
  const r = await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
  return Number(r.stdout.trim()) || 0;
}

export async function makeThumb(video: string, out: string) {
  await run(FFMPEG, ["-y", "-ss", "1.2", "-i", video, "-frames:v", "1", "-vf", "scale=420:-1", out]);
}

export type AssembleInput = {
  clips: string[];
  splitTop?: string[];
  overlayPattern: string;
  overlayFps: number;
  out: string;
  duration: number;
  music?: string;
  musicStart?: number;
  voice?: string;
  musicVolume?: number;
  seed?: number;
  grade?: "neutral" | "warm" | "film";
  transition?: string;
  split?: boolean;
};

const GRADE = {
  warm: "colortemperature=temperature=5100,eq=contrast=1.06:brightness=0.012:saturation=1.08",
  film: "eq=contrast=1.1:saturation=0.93,curves=preset=medium_contrast,vignette=PI/5",
  neutral: "eq=contrast=1.03:saturation=1.02",
};

const isStill = (p: string) => /\.(png|jpe?g|webp)$/i.test(p);

export async function assemble(i: AssembleInput): Promise<string> {
  const segs = Math.max(2, Math.round(i.duration / 4.2));
  const per = i.duration / segs;
  const trans = i.transition ?? "fade";
  const transDur = 0.32;
  const clips = i.clips.length ? i.clips : [];
  if (!clips.length) throw new Error("sem clipes de b-roll");

  const pickClip = (list: string[], k: number) => list[(k + (i.seed ?? 0)) % list.length];

  const args: string[] = ["-y"];
  const order: { main: string; top?: string; startMain: number; startTop: number }[] = [];

  for (let k = 0; k < segs; k++) {
    const main = pickClip(clips, k);
    const mDur = isStill(main) ? per + 1 : await probeDuration(main);
    const mMax = Math.max(mDur - per - 0.3, 0);
    const mStart = mMax > 0.5 ? Number(((((i.seed ?? 0) * 0.37 + k * 1.7) % 1) * mMax).toFixed(2)) : 0;

    let top: string | undefined;
    let tStart = 0;
    if (i.split && i.splitTop?.length) {
      top = pickClip(i.splitTop, k);
      const tDur = isStill(top) ? per + 1 : await probeDuration(top);
      const tMax = Math.max(tDur - per - 0.3, 0);
      tStart = tMax > 0.5 ? Number(((((i.seed ?? 0) * 0.53 + k * 2.3) % 1) * tMax).toFixed(2)) : 0;
    }
    order.push({ main, top, startMain: mStart, startTop: tStart });
  }

  for (const o of order) {
    if (o.top) {
      if (isStill(o.top)) args.push("-loop", "1", "-t", String(per + 0.2), "-i", o.top);
      else args.push("-ss", String(o.startTop), "-t", String(per + 0.2), "-i", o.top);
    }
    if (isStill(o.main)) args.push("-loop", "1", "-t", String(per + 0.2), "-i", o.main);
    else args.push("-ss", String(o.startMain), "-t", String(per + 0.2), "-i", o.main);
  }

  const inputsPerSeg = i.split && i.splitTop?.length ? 2 : 1;
  const overlayIdx = segs * inputsPerSeg;
  args.push("-framerate", String(i.overlayFps), "-i", i.overlayPattern);

  let musicIdx: number | null = null;
  if (i.music) {
    musicIdx = overlayIdx + 1;
    args.push("-stream_loop", "-1", "-ss", String(Math.max(0, Math.round(i.musicStart ?? 0))), "-i", i.music);
  }
  let voiceIdx: number | null = null;
  if (i.voice) {
    voiceIdx = overlayIdx + (i.music ? 2 : 1);
    args.push("-i", i.voice);
  }

  const parts: string[] = [];
  const stillFrames = Math.max(Math.round(per * 30), 30);
  const norm = (inputIdx: number, idx: number, label: string, w: number, h: number, which: "main" | "top" = "main") => {
    const src = order[idx];
    const still = isStill(which === "main" ? src.main : src.top!);
    if (still) {
      parts.push(
        `[${inputIdx}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,` +
          `zoompan=z='min(zoom+0.0007,1.14)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${stillFrames}:s=${w}x${h}:fps=30,` +
          `trim=duration=${per.toFixed(3)},setpts=PTS-STARTPTS[${label}]`,
      );
    } else {
      parts.push(
        `[${inputIdx}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30,` +
          `trim=duration=${per.toFixed(3)},setpts=PTS-STARTPTS[${label}]`,
      );
    }
  };

  for (let k = 0; k < segs; k++) {
    if (inputsPerSeg === 2) {
      const topIdx = k * 2;
      const botIdx = k * 2 + 1;
      norm(topIdx, k, `t${k}`, 1080, 700, "top");
      norm(botIdx, k, `b${k}`, 1080, 1220, "main");
      parts.push(`[t${k}][b${k}]vstack=inputs=2,drawbox=x=0:y=698:w=1080:h=4:color=${"black"}@0.9:t=fill,format=yuv420p,setsar=1[s${k}]`);
    } else {
      norm(k, k, `s${k}`, 1080, 1920);
    }
  }

  // transições em cadeia
  let prev = "[s0]";
  let cum = per;
  for (let k = 1; k < segs; k++) {
    const offset = Math.max(cum - transDur, 0);
    const out = k === segs - 1 ? "[xs]" : `[x${k}]`;
    parts.push(`${prev}[s${k}]xfade=transition=${trans}:duration=${transDur}:offset=${offset.toFixed(3)}${out}`);
    prev = out;
    cum = offset + per;
  }
  const cutLabel = segs === 1 ? "[s0]" : "[xs]";

  parts.push(`${cutLabel}${GRADE[i.grade ?? "neutral"]},format=yuv420p[base]`);
  parts.push(`[base][${overlayIdx}:v]overlay=0:0:format=auto[vid]`);

  if (voiceIdx !== null && musicIdx !== null) {
    parts.push(`[${musicIdx}:a]volume=${i.musicVolume ?? 0.14},afade=t=out:st=${Math.max(i.duration - 1.4, 0)}:d=1.4[bed]`);
    parts.push(`[${voiceIdx}:a]volume=1.0[vo]`);
    parts.push(`[vo][bed]amix=inputs=2:duration=longest:normalize=0[aout]`);
    args.push("-filter_complex", parts.join(";"), "-map", "[vid]", "-map", "[aout]");
  } else if (voiceIdx !== null) {
    parts.push(`[${voiceIdx}:a]volume=1.0[vo]`);
    args.push("-filter_complex", parts.join(";"), "-map", "[vid]", "-map", "[vo]");
  } else if (musicIdx !== null) {
    parts.push(`[${musicIdx}:a]volume=${i.musicVolume ?? 0.24},afade=t=in:st=0:d=0.8,afade=t=out:st=${Math.max(i.duration - 1.4, 0)}:d=1.4[mus]`);
    args.push("-filter_complex", parts.join(";"), "-map", "[vid]", "-map", "[mus]", "-shortest");
  } else {
    args.push("-filter_complex", parts.join(";"), "-map", "[vid]");
  }

  args.push(
    "-t",
    String(i.duration),
    "-c:v",
    "libx264",
    "-preset",
    "faster",
    "-crf",
    "21",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-movflags",
    "+faststart",
    ...(voiceIdx !== null || musicIdx !== null ? ["-c:a", "aac", "-b:a", "192k"] : ["-an"]),
    i.out,
  );

  const r = await run(FFMPEG, args);
  if (r.code !== 0) throw new Error(`ffmpeg falhou: ${r.stderr.split("\n").slice(-6).join(" | ").slice(0, 800)}`);
  return i.out;
}
