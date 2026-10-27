import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Chaves nunca ficam no repo. Ordem de precedência (a última vence):
 *   1. arquivos padrão em ~/.config/... (compatibilidade com a máquina do autor)
 *   2. ~/.config/studio/keys.json (gravado pelo painel Créditos, mode 0600)
 *   3. variáveis de ambiente (.env na raiz do repo é carregado pelo Bun sozinho)
 */

const DIR = join(homedir(), ".config", "studio");
const FILE = join(DIR, "keys.json");

type KeyMap = Record<string, string>;

const DEFAULTS: KeyMap = {
  openrouter: join(homedir(), ".config", "openrouter", "api_key"),
  magmarouter: join(homedir(), ".config", "magmarouter", "api_key"),
  elevenlabs: join(homedir(), ".config", "vsl", "elevenlabs"),
  pexels: join(homedir(), ".config", "vsl", "pexels"),
  gemini: join(homedir(), ".config", "vsl", "gemini"),
};

const ENV_VARS: KeyMap = {
  openrouter: "OPENROUTER_API_KEY",
  magmarouter: "MAGMAROUTER_API_KEY",
  elevenlabs: "ELEVENLABS_API_KEY",
  pexels: "PEXELS_API_KEY",
  gemini: "GEMINI_API_KEY",
  kie: "KIE_API_KEY",
  openai: "OPENAI_API_KEY",
};

function readFileKey(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    const v = readFileSync(path, "utf8").trim();
    return v.length > 8 ? v : null;
  } catch {
    return null;
  }
}

export function getKeys(): KeyMap {
  const out: KeyMap = {};
  for (const [k, p] of Object.entries(DEFAULTS)) {
    const v = readFileKey(p);
    if (v) out[k] = v;
  }
  try {
    if (existsSync(FILE)) Object.assign(out, JSON.parse(readFileSync(FILE, "utf8")));
  } catch {}
  for (const [provider, env] of Object.entries(ENV_VARS)) {
    const v = process.env[env];
    if (v) out[provider] = v;
  }
  return out;
}

export function setKey(provider: string, value: string) {
  mkdirSync(DIR, { recursive: true });
  let cur: KeyMap = {};
  try {
    if (existsSync(FILE)) cur = JSON.parse(readFileSync(FILE, "utf8"));
  } catch {}
  if (!value.trim()) delete cur[provider];
  else cur[provider] = value.trim();
  writeFileSync(FILE, JSON.stringify(cur, null, 2), { mode: 0o600 });
}

export function keySet(provider: string): boolean {
  return Boolean(getKeys()[provider]);
}

export function maskKey(v: string): string {
  return `${v.slice(0, 5)}…${v.slice(-4)}`;
}
