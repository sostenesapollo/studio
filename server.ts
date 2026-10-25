import { existsSync, readdirSync } from "node:fs";
import { mkdir, rename } from "node:fs/promises";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { db, FILES, ROOT, getSetting, setSetting, type Brand, type Video } from "./db";
import { getCredits, spendSummary, logSpend } from "./lib/credits";
import { keySet, setKey } from "./lib/keys";
import { generateVideo, type GenerateOpts } from "./lib/pipeline";
import { learningBrief } from "./lib/learning";
import { run } from "./lib/media";

const PORT = Number(process.env.PORT ?? 4599);
const UI = join(ROOT, "ui", "dist");

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

function notify(title: string, message: string) {
  if (getSetting("notify") === "0") return;
  Bun.spawn([
    "osascript",
    "-e",
    `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)} sound name "Glass"`,
  ]);
}

/* ---------------- fila ---------------- */

db.query("UPDATE jobs SET status='error', message='interrompido no restart' WHERE status='running'").run();

let running = false;

function enqueue(opts: GenerateOpts, count: number) {
  for (let i = 0; i < count; i++) {
    db.query("INSERT INTO jobs (brand_id, kind, payload, status) VALUES (?,?,?,?)").run(
      opts.brand.id,
      "generate",
      JSON.stringify({ ...opts, seed: (opts.seed ?? Date.now()) + i * 7919 }),
      "queued",
    );
  }
  tick();
}

async function tick() {
  if (running) return;
  const job = db.query("SELECT * FROM jobs WHERE status = 'queued' ORDER BY id LIMIT 1").get() as any;
  if (!job) return;
  running = true;
  db.query("UPDATE jobs SET status='running', updated_at=datetime('now') WHERE id=?").run(job.id);
  try {
    const payload = JSON.parse(job.payload);
    const brand = db.query("SELECT * FROM brands WHERE id = ?").get(payload.brand.id) as Brand;
    const v = await generateVideo({ ...payload, brand });
    db.query("UPDATE jobs SET status='done', message=?, updated_at=datetime('now') WHERE id=?").run(v.title, job.id);
    notify("Studio — vídeo pronto", `${brand.name}: ${v.hook}`);
  } catch (e: any) {
    db.query("UPDATE jobs SET status='error', message=?, updated_at=datetime('now') WHERE id=?").run(
      String(e?.message ?? e).slice(0, 500),
      job.id,
    );
    notify("Studio — falhou", String(e?.message ?? e).slice(0, 120));
  } finally {
    running = false;
    setTimeout(tick, 200);
  }
}

/* ---------------- roteador ---------------- */

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p.startsWith("/api/")) {
      try {
        return await api(req, url, p);
      } catch (e: any) {
        return json({ error: String(e?.message ?? e) }, { status: 500 });
      }
    }

    const file = join(UI, p === "/" ? "index.html" : p);
    if (existsSync(file) && !file.endsWith("/")) return new Response(Bun.file(file));
    const index = join(UI, "index.html");
    if (existsSync(index)) return new Response(Bun.file(index));
    return new Response("Studio: build a UI com `bun run build`", { status: 200 });
  },
});

async function api(req: Request, url: URL, p: string): Promise<Response> {
  const method = req.method;

  if (p === "/api/health") return json({ ok: true, port: PORT });

  if (p === "/api/summary") {
    const news = db
      .query("SELECT v.id, v.title, v.thumb_path, v.file_path, v.duration, v.format, v.created_at, b.name AS brand, b.accent FROM videos v JOIN brands b ON b.id=v.brand_id WHERE v.status='new' ORDER BY v.id DESC")
      .all();
    const counts = {
      new: (db.query("SELECT COUNT(*) c FROM videos WHERE status='new'").get() as any).c,
      seen: (db.query("SELECT COUNT(*) c FROM videos WHERE status='seen'").get() as any).c,
      posted: (db.query("SELECT COUNT(*) c FROM videos WHERE status='posted'").get() as any).c,
      queued: (db.query("SELECT COUNT(*) c FROM jobs WHERE status IN ('queued','running')").get() as any).c,
    };
    const credits = await getCredits();
    return json({ counts, news: news.slice(0, 6), alerts: credits.alerts, rendering: running });
  }

  if (p === "/api/brands") {
    if (method === "POST") {
      const b = await req.json();
      const r = db
        .query("INSERT INTO brands (slug, name, accent, niche, cta, links) VALUES (?,?,?,?,?,?) RETURNING *")
        .get(b.slug, b.name, b.accent ?? "#c8a24a", b.niche ?? null, b.cta ?? null, JSON.stringify(b.links ?? {}));
      return json(r);
    }
    return json(db.query("SELECT * FROM brands ORDER BY id").all());
  }

  if (p.startsWith("/api/brands/")) {
    const id = Number(p.split("/")[3]);
    if (method === "PATCH") {
      const b = await req.json();
      db.query("UPDATE brands SET name=COALESCE(?,name), accent=COALESCE(?,accent), cta=COALESCE(?,cta), voice_id=COALESCE(?,voice_id), niche=COALESCE(?,niche) WHERE id=?").run(
        b.name ?? null,
        b.accent ?? null,
        b.cta ?? null,
        b.voice_id ?? null,
        b.niche ?? null,
        id,
      );
      return json(db.query("SELECT * FROM brands WHERE id=?").get(id));
    }
  }

  if (p === "/api/videos") {
    const brand = url.searchParams.get("brand");
    const status = url.searchParams.get("status");
    const rating = url.searchParams.get("rating");
    const where: string[] = [];
    const args: any[] = [];
    if (brand) {
      where.push("b.slug = ?");
      args.push(brand);
    }
    if (status && status !== "all") {
      where.push("v.status = ?");
      args.push(status);
    }
    if (rating && rating !== "all") {
      where.push("v.rating = ?");
      args.push(rating);
    }
    const sql = `SELECT v.*, b.name AS brand, b.accent, b.slug AS brand_slug FROM videos v JOIN brands b ON b.id=v.brand_id ${
      where.length ? "WHERE " + where.join(" AND ") + " " : ""
    } ORDER BY v.id DESC LIMIT 200`;
    return json(db.query(sql).all(...args));
  }

  if (p.startsWith("/api/videos/")) {
    const [, , , idStr, action] = p.split("/");
    const id = Number(idStr);
    const v = db.query("SELECT * FROM videos WHERE id=?").get(id) as Video | null;
    if (!v) return json({ error: "not found" }, { status: 404 });

    if (!action && method === "DELETE") {
      // vão para o ~/.Trash (prefixo com timestamp) em vez de sumir do disco
      const trash = join(homedir(), ".Trash");
      await mkdir(trash, { recursive: true }).catch(() => {});
      for (const f of [v.file_path, v.thumb_path]) {
        if (!f || !existsSync(f)) continue;
        const dest = join(trash, `${Date.now()}-${basename(f)}`);
        try {
          await rename(f, dest);
        } catch {
          await run("rm", ["-f", f]);
        }
      }
      db.query("DELETE FROM videos WHERE id=?").run(id);
      return json({ ok: true });
    }
    if (action === "seen") {
      db.query("UPDATE videos SET status = CASE WHEN status='new' THEN 'seen' ELSE status END, seen_at=datetime('now') WHERE id=?").run(id);
      return json({ ok: true });
    }
    if (action === "posted") {
      const b = await req.json().catch(() => ({}) as any);
      db.query("UPDATE videos SET status='posted', posted_at=datetime('now'), network=? WHERE id=?").run(b.network ?? null, id);
      return json({ ok: true });
    }
    if (action === "feedback") {
      const b = (await req.json().catch(() => ({}))) as any;
      const rating = b.rating === "up" || b.rating === "down" ? b.rating : null;
      db.query("UPDATE videos SET rating=?, feedback_note=COALESCE(?, feedback_note), rated_at=datetime('now') WHERE id=?").run(
        rating,
        b.note ?? null,
        id,
      );
      return json({ ok: true });
    }
    if (action === "unpost") {
      db.query("UPDATE videos SET status='seen', posted_at=NULL WHERE id=?").run(id);
      return json({ ok: true });
    }
    if (action === "file" && v.file_path) {
      const f = Bun.file(v.file_path);
      const size = f.size;
      const range = req.headers.get("range");
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        const start = Number(m?.[1] || 0);
        const end = m?.[2] ? Number(m[2]) : size - 1;
        return new Response(f.slice(start, end + 1), {
          status: 206,
          headers: {
            "Content-Type": "video/mp4",
            "Accept-Ranges": "bytes",
            "Content-Range": `bytes ${start}-${end}/${size}`,
            "Content-Length": String(end - start + 1),
          },
        });
      }
      return new Response(f, { headers: { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Content-Length": String(size) } });
    }
    if (action === "thumb" && v.thumb_path && existsSync(v.thumb_path)) return new Response(Bun.file(v.thumb_path));
    if (action === "rerender" && method === "POST") {
      const b = (await req.json().catch(() => ({}))) as any;
      const brand = db.query("SELECT * FROM brands WHERE id=?").get(v.brand_id) as Brand;
      const proj = JSON.parse(v.project ?? "{}");
      enqueue(
        {
          brand,
          format: (b.format ?? v.format) as any,
          template: b.template ?? proj.template,
          seed: b.seed ?? proj.seed,
          hook: b.hook ?? proj.script?.hook,
          particle: b.particle ?? proj.script?.particle,
          grade: b.grade ?? proj.script?.grade,
          durationSec: b.durationSec ?? proj.duration,
        },
        1,
      );
      return json({ ok: true });
    }
    if (action === "project") return json(JSON.parse(v.project ?? "{}"));
  }

  if (p === "/api/generate" && method === "POST") {
    const b = await req.json();
    const brand = db.query("SELECT * FROM brands WHERE slug=?").get(b.brand) as Brand | null;
    if (!brand) return json({ error: "marca não encontrada" }, { status: 400 });
    const count = Math.min(Math.max(Number(b.count ?? 1), 1), 6);
    enqueue(
      {
        brand,
        format: b.format ?? "faceless",
        template: b.template ?? undefined,
        angle: b.angle ?? undefined,
        particle: b.particle,
        grade: b.grade,
        hook: b.hook,
        durationSec: b.durationSec,
      },
      count,
    );
    return json({ ok: true, queued: count });
  }

  if (p === "/api/jobs") {
    return json(db.query("SELECT * FROM jobs ORDER BY id DESC LIMIT 30").all());
  }

  if (p === "/api/learning") {
    const row = db
      .query("SELECT COUNT(*) c, SUM(CASE WHEN rating='up' THEN 1 ELSE 0 END) u, SUM(CASE WHEN rating='down' THEN 1 ELSE 0 END) d FROM videos")
      .get() as any;
    return json({ totals: row, brief: learningBrief(url.searchParams.get("brand") ?? "giftsqr") });
  }

  if (p === "/api/credits") return json(await getCredits());
  if (p === "/api/spend") return json(spendSummary());

  if (p === "/api/keys") {
    if (method === "POST") {
      const b = await req.json();
      setKey(b.provider, b.key ?? "");
      return json({ ok: true, providers: { kie: keySet("kie"), elevenlabs: keySet("elevenlabs") } });
    }
    return json({
      openrouter: keySet("openrouter"),
      magmarouter: keySet("magmarouter"),
      kie: keySet("kie"),
      elevenlabs: keySet("elevenlabs"),
    });
  }

  if (p === "/api/settings") {
    if (method === "POST") {
      const b = await req.json();
      for (const [k, v] of Object.entries(b)) setSetting(k, String(v));
      return json({ ok: true });
    }
    return json({
      low_balance_threshold: getSetting("low_balance_threshold"),
      monthly_budget: getSetting("monthly_budget"),
      notify: getSetting("notify"),
    });
  }

  if (p === "/api/spend" && method === "POST") {
    const b = await req.json();
    logSpend({ provider: b.provider ?? "manual", cost: Number(b.cost ?? 0), note: b.note });
    return json({ ok: true });
  }

  if (p === "/api/open") {
    const b = (await req.json().catch(() => ({}))) as any;
    if (b.path && existsSync(b.path)) Bun.spawn(["open", "-R", b.path]);
    return json({ ok: true });
  }

  if (p === "/api/stats") {
    const total = (db.query("SELECT COUNT(*) c FROM videos").get() as any).c;
    const disk = readdirSync(FILES).length;
    return json({ total, folders: disk });
  }

  return json({ error: "rota desconhecida", path: p }, { status: 404 });
}

console.log(`Studio em http://localhost:${PORT}`);

/* alerta de saldo baixo (notificação + cooldown de 6h) */
let lastCreditAlert = Number(getSetting("last_credit_alert") ?? 0);
setInterval(async () => {
  try {
    const { alerts } = await getCredits();
    if (!alerts.length) return;
    if (Date.now() - lastCreditAlert < 6 * 60 * 60 * 1000) return;
    lastCreditAlert = Date.now();
    setSetting("last_credit_alert", String(lastCreditAlert));
    notify("Studio — saldo baixo", alerts.join(" · ").slice(0, 160));
  } catch {}
}, 10 * 60 * 1000);
