import { db } from "../db";

/**
 * Resumo do que foi aprovado/reprovado, para alimentar o prompt do gerador.
 * Curtas e barato: no máximo ~1200 caracteres.
 */
export function learningBrief(brand: string): string {
  const up = db
    .query(
      `SELECT v.hook, v.project, v.feedback_note FROM videos v JOIN brands b ON b.id=v.brand_id
       WHERE v.rating='up' AND b.slug=? ORDER BY v.id DESC LIMIT 6`,
    )
    .all(brand) as any[];

  const down = db
    .query(
      `SELECT v.hook, v.project, v.feedback_note FROM videos v JOIN brands b ON b.id=v.brand_id
       WHERE v.rating='down' AND b.slug=? ORDER BY v.id DESC LIMIT 6`,
    )
    .all(brand) as any[];

  if (!up.length && !down.length) return "Ainda sem feedback do usuário.";

  const meta = (v: any) => {
    try {
      const p = JSON.parse(v.project ?? "{}");
      return [p.angle, p.template].filter(Boolean).join("/");
    } catch {
      return "";
    }
  };

  const lines: string[] = [];
  if (up.length) {
    lines.push("APROVADOS (o usuário gostou — siga este tom e ângulo):");
    for (const v of up) lines.push(`- "${v.hook}" [${meta(v)}]`);
  }
  if (down.length) {
    lines.push("REPROVADOS (não repita este tipo de gancho nem o motivo abaixo):");
    for (const v of down) {
      const note = (v.feedback_note ?? "").trim().slice(0, 140);
      lines.push(`- "${v.hook}" [${meta(v)}]${note ? ` — motivo: ${note}` : ""}`);
    }
  }
  return lines.join("\n").slice(0, 1600);
}

export function feedbackStats() {
  return db
    .query(
      `SELECT b.slug AS brand, COUNT(*) AS total,
              SUM(CASE WHEN v.rating='up' THEN 1 ELSE 0 END) AS up,
              SUM(CASE WHEN v.rating='down' THEN 1 ELSE 0 END) AS down
       FROM videos v JOIN brands b ON b.id=v.brand_id GROUP BY b.slug`,
    )
    .all();
}
