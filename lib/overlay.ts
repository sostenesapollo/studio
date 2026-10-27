import { bundle } from "@remotion/bundler";
import { renderFrames, selectComposition } from "@remotion/renderer";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../db";

let cachedServeUrl: string | null = null;

async function getServeUrl(): Promise<string> {
  if (cachedServeUrl) return cachedServeUrl;
  cachedServeUrl = await bundle({
    entryPoint: join(ROOT, "renderer", "index.ts"),
    publicDir: join(ROOT, "public"),
    onProgress: () => {},
  });
  return cachedServeUrl;
}

export type OverlayInput = {
  hook: string;
  kicker?: string;
  cta?: string;
  accent: string;
  brand: string;
  captions: { text: string; from: number; to: number }[];
  particle: string;
  durationInFrames: number;
  showProgress?: boolean;
};

export async function renderOverlay(input: OverlayInput, outDir: string): Promise<{ dir: string; pattern: string; frames: number }> {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const serveUrl = await getServeUrl();
  const composition = await selectComposition({
    serveUrl,
    id: "Overlay",
    inputProps: input as any,
  });
  await renderFrames({
    composition,
    serveUrl,
    inputProps: input as any,
    outputDir: outDir,
    imageFormat: "png",
    onStart: () => {},
    onFrameUpdate: () => {},
    concurrency: 8,
  } as any);
  const files = readdirSync(outDir).filter((f) => f.endsWith(".png")).sort();
  if (!files.length) throw new Error("overlay sem frames");
  const m = /^(.*?)(\d+)(\.png)$/.exec(files[0]);
  if (!m) throw new Error(`padrão de frames inesperado: ${files[0]}`);
  const pad = m[2].length;
  return { dir: outDir, pattern: `${m[1]}%0${pad}d${m[3]}`, frames: files.length };
}
