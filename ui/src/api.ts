export const api = {
  async get<T>(path: string): Promise<T> {
    const r = await fetch(path);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post<T>(path: string, body?: unknown): Promise<T> {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async del<T>(path: string): Promise<T> {
    const r = await fetch(path, { method: "DELETE" });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async patch<T>(path: string, body?: unknown): Promise<T> {
    const r = await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
};

export type Brand = {
  id: number;
  slug: string;
  name: string;
  accent: string;
  cta: string | null;
  niche: string | null;
  voice_id: string | null;
};

export type Video = {
  id: number;
  brand_id: number;
  brand: string;
  brand_slug: string;
  accent: string;
  title: string;
  hook: string | null;
  format: string;
  status: "new" | "seen" | "posted" | "archived";
  network: string | null;
  file_path: string | null;
  thumb_path: string | null;
  duration: number | null;
  created_at: string;
  posted_at: string | null;
};

export type Provider = {
  id: string;
  label: string;
  unit: "usd" | "credits" | "chars";
  balance: number | null;
  lowThreshold: number;
  topupUrl: string;
  hasKey: boolean;
  source: string;
  note?: string;
  approxUsd?: number | null;
};

export type Summary = {
  counts: { new: number; seen: number; posted: number; queued: number };
  news: { id: number; title: string; thumb_path: string | null; format: string; brand: string; accent: string }[];
  alerts: string[];
  rendering: boolean;
};
