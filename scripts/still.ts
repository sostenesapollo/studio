import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { join } from "node:path";
import { ROOT } from "../db";

const props: any = {
  hook: "Tradução oficial: 8 meses. Isso: uma tarde.",
  kicker: "1 upload, 1 livro",
  cta: "Testa grátis em tradubook.com",
  accent: "#c8a24a",
  brand: "tradubook",
  captions: [
    { text: "Você manda o PDF", from: 40, to: 80 },
    { text: "ou o EPUB,", from: 82, to: 120 },
  ],
  particle: "none",
  template: {
    font: "Georgia, serif",
    hookWeight: 700,
    hookSize: 64,
    hookCase: "none",
    captionStyle: "serif",
    layout: "top-left",
    particle: "none",
    grade: "film",
    musicVolume: 0.12,
    ctaStyle: "bare",
  },
  mock: {
    mode: "book",
    chapter: "capítulo iv · traduzido",
    title: "O retrato de Dorian Gray",
    lines: ["A sala estava cheia do perfume das rosas, e o som do piano vinha de outro quarto.", "Ele fechou o livro devagar."],
  },
  durationInFrames: 600,
  showProgress: true,
};

const serveUrl = await bundle({ entryPoint: join(ROOT, "renderer", "index.ts") });
const composition = await selectComposition({ serveUrl, id: "Overlay", inputProps: props });
const out = "/tmp/still.png";
await renderStill({ composition, serveUrl, inputProps: props, output: out, frame: 120, imageFormat: "png" } as any);
console.log("ok", out);
