/**
 * Captura telas reais do produto (mobile 540x960 @2x) para o formato "demo".
 * Gera 3 enquadramentos por marca em assets/demo/<marca>/shot-N.png
 */
import { chromium } from "/Users/sostenesapollo/dev/pwtest/node_modules/playwright-core/index.js";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ASSETS } from "../db";

const ALVOS = [
  { brand: "giftsqr", url: "https://giftsqr.com/br" },
  { brand: "tradubook", url: "https://tradubook.com/" },
];

const only = process.argv[2];

for (const alvo of ALVOS) {
  if (only && alvo.brand !== only) continue;
  const dir = join(ASSETS, "demo", alvo.brand);
  mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 540, height: 960 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "pt-BR",
    extraHTTPHeaders: { "Accept-Language": "pt-BR,pt;q=0.9" },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await ctx.newPage();
  await page.goto(alvo.url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const shots = [0, 640, 1500, 2400];
  for (let i = 0; i < shots.length; i++) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as any }), shots[i]);
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(dir, `shot-${i + 1}.png`) });
  }
  await browser.close();
  console.log(alvo.brand, "→", shots.length, "telas");
}
