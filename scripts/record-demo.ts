/**
 * Grava a demonstração real do produto (tela do site no celular) para o formato "demo".
 * Saída: assets/demo/<marca>/web-<timestamp>.webm → convertido em mp4 1080x1920.
 */
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ASSETS } from "../db";
import { run } from "../lib/media";
import { getChromium } from "./lib/browser";

const chromium = await getChromium();

const ALVOS = [
  // /br não é locale do giftsqr (404) — usar /pt-BR.
  { brand: "giftsqr", url: "https://giftsqr.com/pt-BR?utm_source=studio-demo", scrolls: 3 },
  { brand: "tradubook", url: "https://tradubook.com/?utm_source=studio-demo", scrolls: 3 },
];

const only = process.argv[2];

for (const alvo of ALVOS) {
  if (only && alvo.brand !== only) continue;
  const dir = join(ASSETS, "demo", alvo.brand);
  mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 720, height: 1280 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    recordVideo: { dir, size: { width: 720, height: 1280 } },
  });
  const page = await ctx.newPage();
  const res = await page
    .goto(alvo.url, { waitUntil: "domcontentloaded", timeout: 45000 })
    .catch((e: unknown) => {
      throw new Error(`${alvo.brand}: falha ao abrir ${alvo.url} — ${String(e).slice(0, 120)}`);
    });
  const status = res?.status() ?? 0;
  if (status >= 400) {
    await ctx.close();
    throw new Error(`${alvo.brand}: ${alvo.url} respondeu ${status} — gravação abortada`);
  }
  await page.waitForTimeout(2500);
  for (let i = 0; i < alvo.scrolls; i++) {
    await page.mouse.wheel(0, 620);
    await page.waitForTimeout(1600);
  }
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(1200);

  const video = page.video();
  await page.close();
  const raw = join(dir, `raw-${Date.now()}.webm`);
  await video!.saveAs(raw);
  await ctx.close();
  await browser.close();
  const webmPath = raw;

  const stamp = Date.now();
  const out = join(dir, `web-${stamp}.mp4`);
  const r = await run("ffmpeg", [
    "-y",
    "-i",
    webmPath,
    "-vf",
    "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30",
    "-c:v",
    "libx264",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-an",
    out,
  ]);
  console.log(r.code === 0 ? `demo ok: ${out.split("/").pop()}` : `falhou: ${r.stderr.slice(-200)}`);
}

for (const a of ALVOS) {
  const d = join(ASSETS, "demo", a.brand);
  try { console.log(a.brand, readdirSync(d).filter((f) => f.endsWith(".mp4")).length, "clipes"); } catch {}
}
