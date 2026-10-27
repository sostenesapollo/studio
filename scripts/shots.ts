/**
 * Captura telas reais do produto (mobile 540x960 @2x) para o formato "demo".
 * Gera 4 enquadramentos por marca/idioma em assets/demo/<marca>/<lang>/shot-N.png
 *
 * Aborta se a página responder 4xx/5xx: já aconteceu de gravar a página 404 do
 * giftsqr (/br não é locale) e o vídeo sair com "404 This page could not be found".
 */
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ASSETS } from "../db";
import { getChromium } from "./lib/browser";

const chromium = await getChromium();

const ALVOS = [
  { brand: "giftsqr", lang: "pt", url: "https://giftsqr.com/pt-BR", accept: "pt-BR,pt;q=0.9" },
  { brand: "giftsqr", lang: "en", url: "https://giftsqr.com/en", accept: "en-US,en;q=0.9" },
  { brand: "tradubook", lang: "pt", url: "https://tradubook.com/", accept: "pt-BR,pt;q=0.9" },
];

const only = process.argv[2];
const langOnly = process.argv[3];

for (const alvo of ALVOS) {
  if (only && alvo.brand !== only) continue;
  if (langOnly && alvo.lang !== langOnly) continue;
  const dir = join(ASSETS, "demo", alvo.brand, alvo.lang);
  mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 540, height: 960 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: alvo.accept.split(",")[0],
    extraHTTPHeaders: { "Accept-Language": alvo.accept },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await ctx.newPage();
  const res = await page
    .goto(alvo.url, { waitUntil: "networkidle", timeout: 45000 })
    .catch((e: unknown) => {
      throw new Error(`${alvo.brand}/${alvo.lang}: falha ao abrir ${alvo.url} — ${String(e).slice(0, 120)}`);
    });
  const status = res?.status() ?? 0;
  if (status >= 400) {
    throw new Error(`${alvo.brand}/${alvo.lang}: ${alvo.url} respondeu ${status} — screenshot abortado`);
  }
  await page.waitForTimeout(2500);

  const shots = [0, 640, 1500, 2400];
  for (let i = 0; i < shots.length; i++) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as any }), shots[i]);
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(dir, `shot-${i + 1}.png`) });
  }
  // Sobe o diretório do idioma na listagem do git também (assets versionado).
  await browser.close();
  console.log(`${alvo.brand}/${alvo.lang} → ${readdirSync(dir).length} telas`);
}
