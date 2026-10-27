import { db } from "../db";
import { engagement } from "./refs";

/**
 * Swipe file: padrões extraídos de vídeos que performaram (majoritariamente em inglês).
 * Serve para dar ritmo/estrutura — nunca para copiar conteúdo.
 */
export function swipeBrief(brand: string, limit = 4): string {
  const rows = db
    .query("SELECT * FROM refs WHERE brand=? AND status='analyzed' AND recipe IS NOT NULL ORDER BY views DESC LIMIT 40")
    .all(brand) as any[];
  if (!rows.length) return "";

  const scored = rows
    .map((r) => {
      let recipe: any = {};
      try {
        recipe = JSON.parse(r.recipe);
      } catch {}
      return { ...r, recipe, eng: engagement(r) };
    })
    .sort((a, b) => b.eng * 0.6 + Math.log10(Math.max(b.views, 1)) - (a.eng * 0.6 + Math.log10(Math.max(a.views, 1))))
    .slice(0, limit);

  const lines = scored.map((r, i) => {
    const rec = r.recipe;
    return `${i + 1}. (${Math.round(r.eng)}% eng, ${r.views} views, ${Math.round(r.duration)}s)
   hook original: "${rec.hook ?? r.title}"
   tipo de hook: ${rec.hook_type ?? "?"} · energia: ${rec.energy ?? "?"}
   primeiro frame: ${rec.first_frame ?? "?"}
   beats: ${(rec.beats ?? []).join(" → ")}
   tom: ${rec.tone ?? "?"} · fim: ${rec.cta ?? "?"}
   por que funciona: ${rec.why ?? "?"}
   padrão adaptável: ${rec.reusable ?? "?"}`;
  });

  return `PADRÕES DE VÍDEOS QUE PERFORMARAM (referências em inglês — adapte a ESTRUTURA e o RITMO para português, nunca traduza nem copie a fala):
${lines.join("\n")}`;
}
