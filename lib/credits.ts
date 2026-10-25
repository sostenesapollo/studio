import { db, getSetting } from "../db";
import { getKeys, keySet } from "./keys";

export type Provider = {
  id: string;
  label: string;
  unit: "usd" | "credits" | "chars";
  balance: number | null;
  lowThreshold: number;
  topupUrl: string;
  docsUrl?: string;
  hasKey: boolean;
  source: "api" | "manual" | "none";
  note?: string;
  approxUsd?: number | null;
};

const DEFS = [
  {
    id: "openrouter",
    label: "OpenRouter",
    unit: "usd" as const,
    lowThreshold: 1,
    topupUrl: "https://openrouter.ai/settings/credits",
  },
  {
    id: "magmarouter",
    label: "MagmaRouter",
    unit: "usd" as const,
    lowThreshold: 1,
    topupUrl: "https://magmarouter.com/topup/",
  },
  {
    id: "kie",
    label: "kie.ai (Kling Avatar)",
    unit: "credits" as const,
    lowThreshold: 200,
    topupUrl: "https://kie.ai/billing",
    docsUrl: "https://kie.ai/billing",
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs (voz)",
    unit: "chars" as const,
    lowThreshold: 5000,
    topupUrl: "https://elevenlabs.io/subscription",
  },
];

async function j(url: string, key: string): Promise<any> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchOpenRouter(key: string) {
  const d = await j("https://openrouter.ai/api/v1/credits", key);
  const c = d?.data ?? d;
  const total = Number(c.total_credits ?? 0);
  const used = Number(c.total_usage ?? 0);
  return { balance: +(total - used).toFixed(4), approxUsd: +(total - used).toFixed(4) };
}

async function fetchMagma(key: string) {
  const d = await j("https://magmarouter.com/api/v1/credits", key).catch(() =>
    j("https://api.magmarouter.com/v1/credits", key),
  );
  const c = d?.data ?? d;
  const total = Number(c.total_credits ?? c.credits ?? 0);
  const used = Number(c.total_usage ?? c.used ?? 0);
  return { balance: +(total - used).toFixed(4), approxUsd: +(total - used).toFixed(4) };
}

async function fetchKie(key: string) {
  const d = await j("https://api.kie.ai/api/v1/chat/credit", key);
  const credits = Number(d?.data?.credits ?? d?.data ?? 0);
  // ~8 credits = US$0.04 no Kling Avatar Standard => 1 credit ~ US$0.005
  return { balance: Math.round(credits), approxUsd: +(credits * 0.005).toFixed(2) };
}

async function fetchEleven(key: string) {
  const d = await j("https://api.elevenlabs.io/v1/user/subscription", key);
  const used = Number(d?.character_count ?? 0);
  const limit = Number(d?.character_limit ?? 0);
  return { balance: Math.max(limit - used, 0), approxUsd: null };
}

export async function getCredits(): Promise<{ providers: Provider[]; alerts: string[]; threshold: number }> {
  const keys = getKeys();
  const threshold = Number(getSetting("low_balance_threshold") ?? 1);
  const providers: Provider[] = [];

  for (const d of DEFS) {
    const key = keys[d.id];
    const base: Provider = {
      ...d,
      lowThreshold: d.id === "openrouter" || d.id === "magmarouter" ? threshold : d.lowThreshold,
      balance: null,
      hasKey: Boolean(key),
      source: key ? "api" : "none",
    };
    if (!key) {
      providers.push({ ...base, note: "sem chave — cole na aba Créditos" });
      continue;
    }
    try {
      const fn =
        d.id === "openrouter"
          ? fetchOpenRouter
          : d.id === "magmarouter"
            ? fetchMagma
            : d.id === "kie"
              ? fetchKie
              : fetchEleven;
      const r = await fn(key);
      providers.push({ ...base, ...r, source: "api" });
    } catch (e: any) {
      providers.push({ ...base, note: `falha ao consultar: ${e?.message ?? e}` });
    }
  }
  const alerts = providers
    .filter((p) => p.balance !== null && p.balance <= p.lowThreshold)
    .map((p) =>
      p.unit === "usd"
        ? `${p.label}: US$ ${p.balance.toFixed(2)} (limite US$ ${p.lowThreshold.toFixed(2)})`
        : `${p.label}: ${p.balance} ${p.unit} restantes`,
    );
  return { providers, alerts, threshold };
}

export function logSpend(p: { provider: string; model?: string; videoId?: number; units?: number; cost: number; note?: string }) {
  db.query("INSERT INTO spend (provider, model, video_id, units, cost_usd, note) VALUES (?,?,?,?,?,?)").run(
    p.provider,
    p.model ?? null,
    p.videoId ?? null,
    p.units ?? 0,
    p.cost,
    p.note ?? null,
  );
}

export function spendSummary() {
  const today = db
    .query("SELECT COALESCE(SUM(cost_usd),0) AS v FROM spend WHERE date(created_at) = date('now','localtime')")
    .get() as { v: number };
  const month = db
    .query("SELECT COALESCE(SUM(cost_usd),0) AS v FROM spend WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m','now','localtime')")
    .get() as { v: number };
  const byProvider = db
    .query(
      "SELECT provider, ROUND(SUM(cost_usd),3) AS cost, COUNT(*) AS n FROM spend WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m','now','localtime') GROUP BY provider ORDER BY cost DESC",
    )
    .all();
  const recent = db.query("SELECT * FROM spend ORDER BY id DESC LIMIT 40").all();
  return {
    today: +today.v.toFixed(3),
    month: +month.v.toFixed(3),
    budget: Number(getSetting("monthly_budget") ?? 100),
    byProvider,
    recent,
  };
}

export { keySet };
