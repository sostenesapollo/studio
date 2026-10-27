import { readFileSync, readdirSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { db } from "../db";
import { getKeys } from "./keys";
import { run } from "./media";

const TMP = "/tmp/studio-refs";

export const QUERIES: Record<string, string[]> = {
  tradubook: [
    "i finally finished this book after years",
    "why i stopped reading classics",
    "reading a book in another language",
    "book that changed how i read",
    "i lied about reading this book",
    "translated book before it existed in english",
  ],
  giftsqr: [
    "the gift she still talks about",
    "gift i made instead of buying",
    "cheap gift that felt expensive",
    "surprise my girlfriend with this",
    "gift that is not a mug",
    "i made this in 5 minutes",
  ],
};

type Raw = {
  id: string;
  url: string;
  title: string;
  author: string;
  views: number;
  likes: number;
  comments: number;
  duration: number;
  published: string;
};

/** views por dia desde a publicação: melhor sinal que view absoluto em vídeo recente */
export function velocity(row: any): number {
  const views = Number(row.views ?? 0);
  if (!views) return 0;
  const d = String(row.published_at ?? row.published ?? "");
  let days = 365;
  if (/^\d{8}$/.test(d)) {
    const y = +d.slice(0, 4);
    const m = +d.slice(4, 6) - 1;
    const day = +d.slice(6, 8);
    days = Math.max(1, (Date.now() - new Date(y, m, day).getTime()) / 86400000);
  }
  return views / days;
}

function parsePrint(out: string): Raw[] {
  const rows: Raw[] = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const p = line.split("\t");
    if (p.length < 9) continue;
    rows.push({
      id: p[0],
      url: p[1],
      title: p[2],
      author: p[3],
      views: Number(p[4] || 0),
      likes: Number(p[5] || 0),
      comments: Number(p[6] || 0),
      duration: Number(p[7] || 0),
      published: p[8] ?? "",
    });
  }
  return rows;
}

export async function addByUrl(brand: string, url: string): Promise<{ ok: boolean; reason?: string }> {
  const exists = db.query("SELECT id FROM refs WHERE url=?").get(url);
  if (exists) return { ok: false, reason: "já existe" };
  const r = await run("yt-dlp", ["--no-warnings", "--skip-download", "--print", PRINT, url]);
  const rows = parsePrint(r.stdout);
  const v = rows[0];
  if (!v) return { ok: false, reason: (r.stderr || "não consegui ler esse link").slice(0, 160) };
  db.query(
    "INSERT INTO refs (brand, source, url, title, author, views, likes, comments, duration, published_at, query) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
  ).run(brand, /tiktok/i.test(url) ? "tiktok" : "youtube", url, v.title, v.author, v.views, v.likes, v.comments, v.duration, v.published, "manual");
  return { ok: true };
}

const PRINT = "%(id)s\t%(webpage_url)s\t%(title)s\t%(uploader)s\t%(view_count)s\t%(like_count)s\t%(comment_count)s\t%(duration)s\t%(upload_date)s";

export async function collect(brand: string, per = 6): Promise<{ added: number; skipped: number }> {
  const queries = QUERIES[brand] ?? QUERIES.tradubook;
  let added = 0;
  let skipped = 0;

  for (const q of queries) {
    const r = await run("yt-dlp", [
      "--no-warnings",
      "--skip-download",
      "-I",
      `1:${per}`,
      "--print",
      PRINT,
      `ytsearch${per * 2}:${q}`,
    ]);
    const rows = parsePrint(r.stdout);
    const shorts = rows
      .filter((x) => x.duration >= 12 && x.duration <= 120)
      .sort((a, b) => velocity(b) - velocity(a))
      .slice(0, per);

    for (const v of shorts) {
      if (!v.url) continue;
      const exists = db.query("SELECT id FROM refs WHERE url=?").get(v.url);
      if (exists) {
        skipped++;
        continue;
      }
      db.query(
        "INSERT INTO refs (brand, source, url, title, author, views, likes, comments, duration, published_at, query) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      ).run(brand, "youtube", v.url, v.title, v.author, v.views, v.likes, v.comments, v.duration, v.published, q);
      added++;
    }
  }
  return { added, skipped };
}

function vttToText(vtt: string): string {
  const lines = vtt.split("\n");
  const out: string[] = [];
  for (const l of lines) {
    if (!l || l.startsWith("WEBVTT") || l.includes("-->") || /^\d+$/.test(l.trim())) continue;
    const clean = l.replace(/<[^>]+>/g, "").trim();
    if (!clean) continue;
    if (out[out.length - 1] !== clean) out.push(clean);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

export function videoId(url: string): string {
  const m = /[?&]v=([\w-]+)/.exec(url) || /\/shorts\/([\w-]+)/.exec(url) || /\/video\/(\d+)/.exec(url);
  return m ? m[1] : (url.split("/").filter(Boolean).pop() ?? "x");
}

export async function transcript(url: string, id: string): Promise<string | null> {
  mkdirSync(TMP, { recursive: true });
  rmSync(join(TMP, `${id}.vtt`), { force: true });
  await run("yt-dlp", [
    "--skip-download",
    "--write-auto-subs",
    "--write-subs",
    "--sub-langs",
    "pt.*,pt-BR,en.*",
    "--sub-format",
    "vtt",
    "-o",
    join(TMP, "%(id)s.%(ext)s"),
    url,
  ]);
  const file = readdirSync(TMP).find((f) => f.startsWith(id) && f.endsWith(".vtt"));
  if (!file) return null;
  const text = vttToText(readFileSync(join(TMP, file), "utf8"));
  return text.length > 80 ? text.slice(0, 4000) : null;
}

const ANALISE = `Você analisa por que um vídeo curto performou e extrai o padrão reutilizável.
Responda SOMENTE JSON:
{"hook":"a fala exata dos primeiros 3 segundos","hook_type":"pergunta|afirmação polêmica|confissão|demonstração|antes-depois|dado|história|outro","first_frame":"o que aparece na tela no primeiro segundo","beats":["beat 1","beat 2","beat 3","beat 4"],"tone":"descrição do tom em 6 palavras","cta":"como termina","why":"por que prende atenção, em 1 frase","reusable":"padrão adaptável para outro produto, em 1 frase","energy":"calmo|conversa|acelerado"}`;

export async function analyze(id: number): Promise<boolean> {
  const row = db.query("SELECT * FROM refs WHERE id=?").get(id) as any;
  if (!row) return false;
  const key = getKeys().openrouter;
  if (!key) return false;

  let text = row.transcript as string | null;
  if (!text) {
    for (let tent = 0; tent < 2 && !text; tent++) {
      if (tent > 0) await Bun.sleep(4500);
      text = await transcript(row.url, videoId(row.url));
    }
    if (text) db.query("UPDATE refs SET transcript=? WHERE id=?").run(text, id);
  }

  // sem transcrição: analisa pelo título (menos preciso, mas ainda útil)
  const fonteTitulo = !text;

  const prompt = `${ANALISE}

VÍDEO: ${row.title}
AUTOR: ${row.author}
VIEWS: ${row.views} | LIKES: ${row.likes} | COMENTÁRIOS: ${row.comments} | DURAÇÃO: ${Math.round(row.duration)}s
${fonteTitulo ? `SEM TRANSCRIÇÃO — analise pelo título e pelo que esse tipo de vídeo costuma fazer: "${row.title}"` : `TRANSCRIÇÃO: ${(text ?? "").slice(0, 2600)}`}`;

  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat-v3.1",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 600,
    }),
  });
  if (!r.ok) return false;
  const j: any = await r.json();
  const raw = j?.choices?.[0]?.message?.content ?? "";
  const s = raw.indexOf("{");
  const e = raw.lastIndexOf("}");
  if (s < 0 || e < 0) return false;
  try {
    const recipe = JSON.parse(raw.slice(s, e + 1));
    db.query("UPDATE refs SET recipe=?, status='analyzed' WHERE id=?").run(JSON.stringify(recipe), id);
    return true;
  } catch {
    return false;
  }
}

/** métrica única: engajamento por view (curtida + comentário) */
export function engagement(row: any): number {
  if (!row.views) return 0;
  return Number((((row.likes ?? 0) + (row.comments ?? 0) * 3) / row.views) * 100);
}
