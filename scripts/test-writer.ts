import { buildScript } from "../lib/script";
const brand = process.argv[2] ?? "tradubook";
for (let i = 0; i < 5; i++) {
  const s = await buildScript(brand, "faceless", Date.now() + i * 7919);
  console.log(`\n[${s.angle}] HOOK: ${s.hook}\nCTA: ${s.cta ?? "—"}\nVO: ${s.voiceover}\n`);
}
