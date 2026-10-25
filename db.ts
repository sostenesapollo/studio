import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const ROOT = join(homedir(), "dev", "studio");
export const FILES = join(homedir(), "Movies", "studio");
export const ASSETS = join(ROOT, "assets");

for (const d of [FILES, join(FILES, "thumbs"), ASSETS, join(ASSETS, "broll"), join(ASSETS, "music"), join(ASSETS, "overlay")]) {
  mkdirSync(d, { recursive: true });
}

const db = new Database(join(ROOT, "studio.sqlite"), { create: true });
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  accent TEXT NOT NULL DEFAULT '#c8a24a',
  voice_id TEXT,
  avatar_path TEXT,
  cta TEXT,
  links TEXT,
  niche TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  hook TEXT,
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  network TEXT,
  file_path TEXT,
  thumb_path TEXT,
  duration REAL,
  project TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  posted_at TEXT,
  seen_at TEXT,
  rating TEXT,
  feedback_note TEXT,
  rated_at TEXT,
  caption TEXT,
  hashtags TEXT,
  lang TEXT DEFAULT 'pt'
);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_brand ON videos(brand_id);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER,
  kind TEXT NOT NULL,
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS spend (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  model TEXT,
  video_id INTEGER,
  units REAL,
  cost_usd REAL NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS music_use (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  video_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS broll (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  source TEXT,
  license TEXT,
  tags TEXT,
  duration REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const seedBrands = [
  {
    slug: "giftsqr",
    name: "giftsqr",
    accent: "#f0b3c7",
    niche: "presentes digitais com QR code, 17 idiomas, BR R$19,97",
    cta: "Cria o teu em giftsqr.com",
    links: JSON.stringify({ site: "https://giftsqr.com", afiliado: "https://giftsqr.com/afiliado" }),
  },
  {
    slug: "tradubook",
    name: "tradubook",
    accent: "#c8a24a",
    niche: "tradução de livros PDF/EPUB para português em minutos, US$1,99",
    cta: "Testa grátis em tradubook.com",
    links: JSON.stringify({ site: "https://tradubook.com", afiliado: "https://tradubook.com/afiliado.html" }),
  },
];

const ins = db.query(
  "INSERT INTO brands (slug, name, accent, niche, cta, links) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(slug) DO NOTHING",
);
for (const b of seedBrands) ins.run(b.slug, b.name, b.accent, b.niche, b.cta, b.links);

// migração para bancos já criados
try {
  const cols = (db.query("PRAGMA table_info(videos)").all() as { name: string }[]).map((c) => c.name);
  for (const [col, type] of [
    ["rating", "TEXT"],
    ["feedback_note", "TEXT"],
    ["rated_at", "TEXT"],
    ["caption", "TEXT"],
    ["hashtags", "TEXT"],
    ["lang", "TEXT DEFAULT 'pt'"],
  ] as const) {
    if (!cols.includes(col)) db.exec(`ALTER TABLE videos ADD COLUMN ${col} ${type}`);
  }
} catch {}

const setDefault = db.query("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING");
setDefault.run("low_balance_threshold", "1.00");
setDefault.run("monthly_budget", "100");
setDefault.run("notify", "1");

export { db };

export type Brand = {
  id: number;
  slug: string;
  name: string;
  accent: string;
  voice_id: string | null;
  avatar_path: string | null;
  cta: string | null;
  links: string | null;
  niche: string | null;
};

export type Video = {
  id: number;
  brand_id: number;
  title: string;
  hook: string | null;
  format: string;
  status: "new" | "seen" | "posted" | "archived";
  network: string | null;
  file_path: string | null;
  thumb_path: string | null;
  duration: number | null;
  project: string | null;
  created_at: string;
  posted_at: string | null;
  seen_at: string | null;
  caption: string | null;
  hashtags: string | null;
  lang: string | null;
};

export function getSetting(key: string): string | null {
  const row = db.query("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | null;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db.query("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
