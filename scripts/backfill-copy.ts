/**
 * Preenche título/descrição/hashtags dos vídeos que já existiam antes da coluna
 * caption existir. Usa o hook + narração que estão no project JSON.
 *
 *   bun run scripts/backfill-copy.ts [--dry]
 */
import { db } from "../db";
import { getKeys } from "../lib/keys";
import { defaultCaption, defaultHashtags } from "../lib/script";
import { logSpend } from "../lib/credits";
import type { Lang } from "../lib/writer";

const DRY = process.argv.includes("--dry");
const MODEL = "google/gemini-2.5-flash";

type Row = {
  id: number;
  brand: string;
  lang: string | null;
  hook: string | null;
  title: string;
  caption: string | null;
  project: string | null;
};

const rows = db
  .query(
    `SELECT v.id, b.slug AS brand, v.lang, v.hook, v.title, v.caption, v.project
     FROM videos v JOIN brands b ON b.id = v.brand_id
     WHERE v.caption IS NULL OR v.caption = ''
     ORDER BY v.id DESC`,
  )
  .all() as Row[];

if (!rows.length) {
  console.log("nada pra preencher");
  process.exit(0);
}

const key = getKeys().openrouter;
if (!key) {
  console.log("sem chave OpenRouter — usando as descrições locais de reserva");
}

function normalizeTag(raw: string): string | null {
  const t = String(raw)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return t.length >= 3 && t.length <= 24 ? t : null;
}

function localFallback(row: Row, lang: Lang) {
  return {
    caption: defaultCaption(row.brand, lang, row.id),
    hashtags: defaultHashtags(row.brand, lang, row.id),
  };
}

async function writeCopy(row: Row, lang: Lang): Promise<{ caption: string; hashtags: string[] } | null> {
  if (!key) return null;
  const script = (() => {
    try {
      return JSON.parse(row.project ?? "{}")?.script ?? {};
    } catch {
      return {};
    }
  })();
  const voiceover = String(script.voiceover ?? "").slice(0, 700);
  const hook = String(row.hook ?? script.hook ?? row.title);

  const pt = lang === "pt";
  const text = pt
    ? `Escreva a legenda/descrição do post pra este vídeo curto (TikTok/Reels). Produto: ${row.brand}.
Gancho (primeiro segundo): "${hook}"
Narração: "${voiceover}"

Regras: 1 ou 2 frases, até 180 caracteres, português brasileiro falado, primeira pessoa ou descrição direta do que aparece no vídeo, dizendo em linguagem simples o que a pessoa vê e o que ela leva dali. Tom de pessoa comum, NUNCA de anúncio: proibido imperativo de venda ("crie", "tenha", "chega de", "transforme", "descubra", "aproveite"), superlativo ("o único", "o melhor"), comparação com outros produtos, emoji, preço, promessa. A primeira frase tem que se apoiar numa cena concreta do vídeo (o que a pessoa fez ou vê), não em elogio ao produto. Sem hashtag. Não repita o gancho palavra por palavra.
Depois, 8 a 10 hashtags minúsculas sem "#", sem acento: 2 do produto, 4 do nicho, 2 a 4 amplas. Nada de fyp/viral/paravoce.
Responda JSON: {"caption":"...","hashtags":["..."]}`
    : `Write the post caption for this short video (TikTok/Reels). Product: ${row.brand}.
Hook (first second): "${hook}"
Voiceover: "${voiceover}"

Rules: 1 or 2 sentences, max 180 characters, natural spoken English, first person or a straight description of what is on screen, in plain words saying what happens in the video and what the viewer takes from it. Regular person tone, NEVER ad tone: no sales imperatives ("get", "create", "stop", "transform", "discover", "don't miss"), no superlatives ("the only", "the best"), no comparison to other products, no emoji, no price, no promise. The first sentence must lean on a concrete scene from the video (what the person did or sees), not on praise for the product. No hashtag. Do not repeat the hook word for word.
Then 8 to 10 lowercase hashtags without "#": 2 for the product, 4 for the niche, 2 to 4 broad. No fyp/viral/foryou.
Reply JSON: {"caption":"...","hashtags":["..."]}`;

  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: pt ? "Você escreve legendas de conteúdo orgânico. Responde só JSON válido." : "You write organic social captions. Reply with valid JSON only." },
        { role: "user", content: text },
      ],
      temperature: 0.9,
      max_tokens: 400,
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`);
  const j: any = await r.json();
  logSpend({ provider: "openrouter", model: MODEL, units: (j?.usage?.total_tokens ?? 0) || 0, cost: 0.0002 });
  const raw = String(j?.choices?.[0]?.message?.content ?? "").replace(/```json|```/g, "");
  const s = raw.indexOf("{");
  const e = raw.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("sem JSON");
  const out = JSON.parse(raw.slice(s, e + 1));
  const caption = String(out.caption ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
  const hashtags = [...new Set((Array.isArray(out.hashtags) ? out.hashtags : []).map((t: string) => normalizeTag(t)).filter(Boolean))] as string[];
  if (caption.length < 25 || hashtags.length < 5) throw new Error("resposta fraca");
  return { caption, hashtags: hashtags.slice(0, 10) };
}

let ok = 0;
let local = 0;
for (const row of rows) {
  const lang: Lang = row.lang === "en" ? "en" : "pt";
  let copy = null as { caption: string; hashtags: string[] } | null;
  try {
    copy = await writeCopy(row, lang);
  } catch (err) {
    console.log(`#${row.id} LLM falhou (${String(err).slice(0, 90)}) — usando reserva local`);
  }
  if (!copy) {
    copy = localFallback(row, lang);
    local++;
  } else {
    ok++;
  }
  if (!DRY) {
    db.query("UPDATE videos SET caption=?, hashtags=?, lang=COALESCE(lang, ?) WHERE id=?").run(
      copy.caption,
      copy.hashtags.join(" "),
      lang,
      row.id,
    );
  }
  console.log(`#${row.id} ${lang} ${DRY ? "(dry) " : ""}${copy.caption.slice(0, 70)}…`);
}

console.log(`\n${ok} pela IA · ${local} pela reserva local · ${rows.length} total${DRY ? " (nada gravado)" : ""}`);
