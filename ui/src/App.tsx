import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Brand, type Provider, type Summary, type Video } from "./api";

type Tab = "videos" | "gerar" | "refs" | "creditos" | "marcas";

const NETWORKS = ["tiktok", "youtube", "instagram", "pinterest", "outro"];
const FORMATS = [
  { id: "faceless", label: "Faceless", desc: "B-roll + partículas + legenda" },
  { id: "demo", label: "Demo", desc: "Produto em uso" },
  { id: "avatar", label: "Avatar", desc: "Pessoa falando (Kling)" },
];
const PARTICLES = ["gold-dust", "sparkle", "light-leak", "bokeh", "grain", "none"];
const TEMPLATES = [
  { id: "auto", label: "Aleatório", desc: "sorteia template a cada vídeo" },
  { id: "natural", label: "Natural", desc: "legenda discreta, sem efeito, parece perfil pessoal" },
  { id: "bold", label: "Bold", desc: "condensada gigante + legenda em caixa" },
  { id: "premium", label: "Premium", desc: "centralizado, régua fina, muito respiro" },
  { id: "editorial", label: "Editorial", desc: "serifa + grão de filme" },
  { id: "punch", label: "Kinetic", desc: "uma palavra por vez, batida rápida" },
  { id: "split", label: "Split", desc: "tela dividida: produto em cima" },
  { id: "letterbox", label: "Letterbox", desc: "4:5 com barras pretas, cinema" },
  { id: "bar", label: "Bar", desc: "faixa colorida com o hook" },
];

const ANGLES = [
  { id: "auto", label: "aleatório" },
  { id: "descoberta", label: "descoberta casual" },
  { id: "primeira_pessoa", label: "demonstração em 1ª pessoa" },
  { id: "cotidiano", label: "história do cotidiano" },
  { id: "duvida", label: "resposta a dúvida" },
  { id: "opiniao", label: "opinião" },
  { id: "comparacao", label: "comparação" },
  { id: "detalhe", label: "detalhe pouco conhecido" },
  { id: "reacao", label: "reação" },
  { id: "bastidor", label: "bastidor" },
  { id: "historico", label: "episódio específico" },
  { id: "objecao_preco", label: "quebrar objeção: caro" },
  { id: "objecao_qualidade", label: "quebrar objeção: tradução ruim" },
];

function fmtDur(s: number | null) {
  if (!s) return "—";
  return `${Math.round(s)}s`;
}

/** "2026-10-25 14:22:33" (UTC do sqlite) -> "25/10 · 14:22" no fuso local */
function fmtWhen(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s.length > 10 ? s.replace(" ", "T") + "Z" : s + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        window.setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? "✓ copiado" : label}
    </button>
  );
}

function money(v: number | null, unit: string) {
  if (v === null) return "—";
  if (unit === "usd") return `US$ ${v.toFixed(2)}`;
  if (unit === "chars") return `${v.toLocaleString("pt-BR")} chars`;
  return `${v} créditos`;
}

/* ------------------------------- Vídeos ------------------------------- */

function Videos({ brands, onChange }: { brands: Brand[]; onChange: () => void }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [brand, setBrand] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [rating, setRating] = useState<string>("all");
  const [open, setOpen] = useState<Video | null>(null);
  const [editHook, setEditHook] = useState<string | null>(null);
  const [editParticle, setEditParticle] = useState("gold-dust");
  const [editGrade, setEditGrade] = useState("warm");
  const [editDur, setEditDur] = useState(18);
  const [proj, setProj] = useState<any>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (brand !== "all") q.set("brand", brand);
    if (status !== "all") q.set("status", status);
    if (rating !== "all") q.set("rating", rating);
    setVideos(await api.get<Video[]>(`/api/videos?${q}`));
  }, [brand, status, rating]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function act(v: Video, action: string, body?: unknown) {
    if (action === "delete") {
      if (!confirm("Apagar este vídeo do disco?")) return;
      await api.del(`/api/videos/${v.id}`);
    } else if (action === "file") {
      await api.post(`/api/open`, { path: v.file_path });
    } else {
      await api.post(`/api/videos/${v.id}/${action}`, body);
    }
    setOpen(null);
    load();
    onChange();
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>Vídeos</h1>
        <div className="filters">
          <select value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="all">todas as marcas</option>
            {brands.map((b) => (
              <option key={b.id} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">todos</option>
            <option value="new">novos</option>
            <option value="seen">vistos</option>
            <option value="posted">postados</option>
          </select>
          <select value={rating} onChange={(e) => setRating(e.target.value)}>
            <option value="all">nota: todas</option>
            <option value="up">gostei</option>
            <option value="down">não gostei</option>
          </select>
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="empty">Nada aqui ainda. Vai em <b>Gerar</b> e cria os primeiros 3.</div>
      ) : (
        <div className="grid">
          {videos.map((v) => (
            <div key={v.id} className={`card ${v.status === "posted" ? "is-posted" : ""}`} onClick={() => {
                setOpen(v);
                setEditHook(null);
                setEditDur(Math.round(v.duration ?? 18));
                setProj(null);
                setNote(v.feedback_note ?? "");
                api.get<any>(`/api/videos/${v.id}/project`).then(setProj).catch(() => {});
              }}>
              <div className="thumb">
                {v.thumb_path ? <img src={`/api/videos/${v.id}/thumb?v=${v.id}`} alt="" /> : <div className="ph" />}
                <span className="dur">{fmtDur(v.duration)}</span>
                {v.status === "new" ? <span className="dot" /> : null}
                <div className="rate" onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`rate-btn up ${v.rating === "up" ? "on" : ""}`}
                    title="gostei"
                    onClick={async () => {
                      await api.post(`/api/videos/${v.id}/feedback`, { rating: v.rating === "up" ? null : "up" });
                      load();
                    }}
                  >
                    ✓
                  </button>
                  <button
                    className={`rate-btn down ${v.rating === "down" ? "on" : ""}`}
                    title="não gostei"
                    onClick={async () => {
                      await api.post(`/api/videos/${v.id}/feedback`, { rating: v.rating === "down" ? null : "down" });
                      setOpen(v);
                      setEditHook(null);
                      setEditDur(Math.round(v.duration ?? 18));
                      setNote(v.feedback_note ?? "");
                      api.get<any>(`/api/videos/${v.id}/project`).then(setProj).catch(() => {});
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="card-body">
                <div className="row">
                  <span className="chip" style={{ borderColor: v.accent, color: v.accent }}>
                    {v.brand}
                  </span>
                  <span className="muted">{v.format}</span>
                  <span className="muted">{(v.lang ?? "pt").toUpperCase()}</span>
                  <span className="muted">{fmtWhen(v.created_at)}</span>
                </div>
                <p className="hook">{v.hook ?? v.title}</p>
                <div className="row">
                  <span className={`status ${v.status}`}>{v.status}</span>
                  {v.network ? <span className="muted">{v.network}</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open ? (
        <div className="modal-bg" onClick={() => setOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <video src={`/api/videos/${open.id}/file`} controls autoPlay />
            <div className="modal-body">
              <h2>{open.hook}</h2>
              <div className="meta">
                <span className="chip" style={{ borderColor: open.accent, color: open.accent }}>{open.brand}</span>
                <span className="muted">{open.format} · {fmtDur(open.duration)}</span>
                <span className="muted">{(open.lang ?? "pt").toUpperCase()} · gerado em {fmtWhen(open.created_at)}</span>
              </div>

              <div className="copyblock">
                <div className="copyhead">
                  <span>título</span>
                  <CopyBtn text={open.hook ?? open.title} label="copiar título" />
                </div>
                <p>{open.hook ?? open.title}</p>
              </div>

              <div className="copyblock">
                <div className="copyhead">
                  <span>descrição do post</span>
                  <CopyBtn text={open.caption ?? ""} label="copiar descrição" />
                </div>
                <p>{open.caption ?? "—"}</p>
              </div>

              <div className="copyblock">
                <div className="copyhead">
                  <span>hashtags</span>
                  <CopyBtn
                    text={(open.hashtags ?? "")
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((h) => `#${h}`)
                      .join(" ")}
                    label="copiar hashtags"
                  />
                </div>
                <p className="tags">
                  {(open.hashtags ?? "")
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((h) => `#${h}`)
                    .join(" ") || "—"}
                </p>
              </div>
              {proj ? (
                <div className="ficha">
                  <span>gatilho: <b>{proj.trigger ?? "—"}</b></span>
                  <span>trilha: <b>{(proj.music ?? "sem trilha").split("/").pop()}</b></span>
                  <span>voz: <b>{proj.voice ? "ElevenLabs" : "sem voz"}</b></span>
                </div>
              ) : null}
              <div className="actions">
                <a className="btn primary" href={`/api/videos/${open.id}/file`} download={`${open.brand}-${open.id}.mp4`} draggable>
                  Arrastar / baixar
                </a>
                <button className="btn" onClick={() => act(open, "file")}>Abrir no Finder</button>
                <button className="btn" onClick={() => navigator.clipboard.writeText(open.hook ?? "")}>Copiar hook</button>
                {open.status !== "posted" ? (
                  <button className="btn ok" onClick={() => act(open, "posted", { network: "tiktok" })}>
                    Marquei como postado
                  </button>
                ) : (
                  <button className="btn" onClick={() => act(open, "unpost")}>Desmarcar</button>
                )}
                <button className="btn danger" onClick={() => act(open, "delete")}>Apagar</button>
              </div>
              <p className="hint">
                Arquivo: <code>{open.file_path}</code>
              </p>
              <div className="feedback">
                <h3>Deu pra usar?</h3>
                <div className="row">
                  <button
                    className={`btn ${open.rating === "up" ? "ok" : ""}`}
                    onClick={async () => {
                      await api.post(`/api/videos/${open.id}/feedback`, { rating: "up", note });
                      setOpen({ ...open, rating: "up", feedback_note: note });
                      load();
                    }}
                  >
                    ✓ Gostei
                  </button>
                  <button
                    className={`btn ${open.rating === "down" ? "danger" : ""}`}
                    onClick={async () => {
                      await api.post(`/api/videos/${open.id}/feedback`, { rating: "down", note });
                      setOpen({ ...open, rating: "down", feedback_note: note });
                      load();
                    }}
                  >
                    ✕ Não gostei
                  </button>
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="por que não gostei? (ex: parece anúncio, gancho fraco, legenda atrapalha, voz corrida) — fica salvo e a IA usa pra ajustar os próximos"
                />
                <div className="row">
                  <button
                    className="btn sm"
                    onClick={async () => {
                      await api.post(`/api/videos/${open.id}/feedback`, {
                        rating: open.rating ?? undefined,
                        note,
                      });
                      setOpen({ ...open, feedback_note: note });
                      load();
                    }}
                  >
                    Salvar motivo
                  </button>
                  {open.feedback_note ? <span className="muted small">salvo</span> : null}
                </div>
              </div>

              <div className="editor">
                <h3>Ajustar e re-renderizar</h3>
                <input
                  value={editHook ?? open.hook ?? ""}
                  onChange={(e) => setEditHook(e.target.value)}
                  placeholder="hook"
                />
                <div className="row">
                  <select value={editParticle} onChange={(e) => setEditParticle(e.target.value)}>
                    {PARTICLES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <select value={editGrade} onChange={(e) => setEditGrade(e.target.value)}>
                    <option value="warm">warm</option>
                    <option value="neutral">neutral</option>
                    <option value="film">film</option>
                  </select>
                  <select value={editDur} onChange={(e) => setEditDur(Number(e.target.value))}>
                    {[12, 15, 18, 21, 24, 30].map((d) => (
                      <option key={d} value={d}>{d}s</option>
                    ))}
                  </select>
                  <button
                    className="btn"
                    onClick={async () => {
                      await api.post(`/api/videos/${open.id}/rerender`, {
                        hook: editHook ?? open.hook,
                        particle: editParticle,
                        grade: editGrade,
                        durationSec: editDur,
                      });
                      setOpen(null);
                      onChange();
                    }}
                  >
                    Re-renderizar
                  </button>
                </div>
                <p className="hint">Gera um vídeo novo com esses ajustes (o original fica salvo).</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------- Gerar ------------------------------- */

function Gerar({ brands, onDone }: { brands: Brand[]; onDone: () => void }) {
  const [brand, setBrand] = useState(brands[0]?.slug ?? "giftsqr");
  const [lang, setLang] = useState("pt");
  const [format, setFormat] = useState("faceless");
  const [template, setTemplate] = useState("auto");
  const [angle, setAngle] = useState("auto");
  const [particle, setParticle] = useState("");
  const [count, setCount] = useState(3);
  const [hook, setHook] = useState("");
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);

  async function loadJobs() {
    setJobs(await api.get<any[]>("/api/jobs"));
  }
  useEffect(() => {
    loadJobs();
    const t = setInterval(loadJobs, 3000);
    return () => clearInterval(t);
  }, []);

  async function go() {
    setBusy(true);
    try {
      await api.post("/api/generate", {
        brand,
        lang,
        format,
        count,
        hook: hook || undefined,
        template: template === "auto" ? undefined : template,
        angle: angle === "auto" ? undefined : angle,
        particle: particle || undefined,
      });
      setHook("");
      loadJobs();
      onDone();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>Gerar</h1>
        <span className="muted">render local · sem custo de API nos formatos faceless/demo</span>
      </div>

      <div className="panel">
        <label>Marca</label>
        <div className="seg">
          {brands.map((b) => (
            <button key={b.id} className={brand === b.slug ? "on" : ""} onClick={() => setBrand(b.slug)}>
              {b.name}
            </button>
          ))}
        </div>

        <label>Idioma (legenda falada, legendas queimadas, título e descrição)</label>
        <div className="seg">
          <button className={lang === "pt" ? "on" : ""} onClick={() => setLang("pt")} title="roteiro, voz e legenda em português brasileiro">
            português
          </button>
          <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")} title="roteiro, voz e legenda em inglês">
            inglês
          </button>
          <button className={lang === "both" ? "on" : ""} onClick={() => setLang("both")} title="alterna os idiomas vídeo a vídeo">
            os dois (alterna)
          </button>
        </div>

        <label>Formato</label>
        <div className="seg">
          {FORMATS.map((f) => (
            <button key={f.id} className={format === f.id ? "on" : ""} onClick={() => setFormat(f.id)} title={f.desc}>
              {f.label}
            </button>
          ))}
        </div>

        <label>Template visual</label>
        <div className="seg wrap">
          {TEMPLATES.map((t) => (
            <button key={t.id} className={template === t.id ? "on" : ""} onClick={() => setTemplate(t.id)} title={t.desc}>
              {t.label}
            </button>
          ))}
        </div>

        <label>Efeito de partícula (opcional — sobrescreve o do template)</label>
        <div className="seg wrap">
          <button className={particle === "" ? "on" : ""} onClick={() => setParticle("")}>
            do template
          </button>
          {PARTICLES.map((p) => (
            <button key={p} className={particle === p ? "on" : ""} onClick={() => setParticle(p)}>
              {p}
            </button>
          ))}
        </div>

        <label>Quantos</label>
        <div className="seg">
          {[1, 2, 3, 6].map((n) => (
            <button key={n} className={count === n ? "on" : ""} onClick={() => setCount(n)}>
              {n}
            </button>
          ))}
        </div>

        <label>Ângulo narrativo</label>
        <select value={angle} onChange={(e) => setAngle(e.target.value)}>
          {ANGLES.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>

        <label>Hook (opcional — sobrescreve o sorteado)</label>
        <input value={hook} onChange={(e) => setHook(e.target.value)} placeholder="ex: R$19 e a pessoa chora na frente do celular" />

        <button className="btn primary big" disabled={busy} onClick={go}>
          {busy ? "enfileirando…" : `Gerar ${count} vídeo${count > 1 ? "s" : ""}`}
        </button>
      </div>

      <div className="jobs">
        <h3>Fila</h3>
        {jobs.length === 0 ? <p className="muted">nada na fila</p> : null}
        {jobs.map((j) => (
          <div key={j.id} className={`job ${j.status}`}>
            <span className="jid">#{j.id}</span>
            <span className="jkind">{j.kind}</span>
            <span className={`status ${j.status}`}>{j.status}</span>
            <span className="jmsg">{j.message ?? ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- Referências ------------------------------- */

function Referencias() {
  const [refs, setRefs] = useState<any[]>([]);
  const [brand, setBrand] = useState("tradubook");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [swipe, setSwipe] = useState("");

  const load = useCallback(async () => {
    const d = await api.get<any>(`/api/references?brand=${brand}`);
    setRefs(d.refs ?? []);
    const s = await api.get<any>(`/api/swipe?brand=${brand}`);
    setSwipe(s.brief ?? "");
  }, [brand]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: string, extra?: any) {
    setBusy(action);
    try {
      await api.post("/api/references", { action, brand, ...extra });
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>Referências</h1>
        <div className="filters">
          <select value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="tradubook">tradubook</option>
            <option value="giftsqr">giftsqr</option>
          </select>
        </div>
      </div>

      <div className="panel">
        <div className="row">
          <button className="btn primary" disabled={!!busy} onClick={() => act("collect", { per: 3 })}>
            {busy === "collect" ? "coletando…" : "Coletar do YouTube (inglês)"}
          </button>
          <button className="btn" disabled={!!busy} onClick={() => act("analyze")}>
            {busy === "analyze" ? "analisando…" : "Analisar pendentes"}
          </button>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <input
            style={{ flex: 1 }}
            placeholder="cola um link do TikTok ou YouTube que performou"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            className="btn"
            disabled={!url || !!busy}
            onClick={async () => {
              await act("add", { url });
              setUrl("");
            }}
          >
            Adicionar
          </button>
        </div>
        <p className="hint">
          YouTube: pega transcript e extrai o padrão. TikTok: só metadados (sem login o TikTok bloqueia leitura).
        </p>
      </div>

      <div className="panel">
        <div className="row between">
          <h3>O que está sendo injetado no gerador</h3>
          <span className="muted small">{swipe ? "ativo" : "sem referências analisadas"}</span>
        </div>
        <pre className="swipe">{swipe || "Analise algumas referências para o gerador começar a copiar o padrão."}</pre>
      </div>

      {refs.length === 0 ? (
        <div className="empty">Nada coletado ainda.</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>vídeo</th>
              <th>views</th>
              <th>views/dia</th>
              <th>dur</th>
              <th>status</th>
            </tr>
          </thead>
          <tbody>
            {refs.map((r) => (
              <tr key={r.id}>
                <td>
                  <a href={r.url} target="_blank" rel="noreferrer">{r.title?.slice(0, 70)}</a>
                  <div className="muted small">{r.author}</div>
                </td>
                <td>{r.views?.toLocaleString("pt-BR")}</td>
                <td>{r.velocity?.toLocaleString("pt-BR")}</td>
                <td className="muted">{Math.round(r.duration)}s</td>
                <td className={`status ${r.status === "analyzed" ? "new" : ""}`}>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ------------------------------- Créditos ------------------------------- */

function Creditos() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [spend, setSpend] = useState<any>(null);
  const [settings, setSettings] = useState<any>({});
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [c, s, st, k] = await Promise.all([
      api.get<{ providers: Provider[]; alerts: string[] }>("/api/credits"),
      api.get<any>("/api/spend"),
      api.get<any>("/api/settings"),
      api.get<Record<string, boolean>>("/api/keys"),
    ]);
    setProviders(c.providers);
    setAlerts(c.alerts);
    setSpend(s);
    setSettings(st);
    setKeys(k);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  async function saveKey(provider: string) {
    await api.post("/api/keys", { provider, key: draft[provider] ?? "" });
    setDraft((d) => ({ ...d, [provider]: "" }));
    load();
  }

  async function saveSettings(patch: Record<string, string>) {
    setSettings({ ...settings, ...patch });
    await api.post("/api/settings", patch);
    load();
  }

  const pct = spend ? Math.min((spend.month / Math.max(spend.budget, 1)) * 100, 100) : 0;

  return (
    <div className="view">
      <div className="view-head">
        <h1>Créditos e gastos</h1>
        <span className="muted">atualiza a cada 30s</span>
      </div>

      {alerts.length ? (
        <div className="alert">
          <b>Saldo baixo.</b>
          <ul>{alerts.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      ) : null}

      <div className="providers">
        {providers.map((p) => {
          const low = p.balance !== null && p.balance <= p.lowThreshold;
          return (
            <div key={p.id} className={`prov ${low ? "low" : ""}`}>
              <div className="prov-head">
                <h3>{p.label}</h3>
                <span className={`badge ${p.source === "api" && !p.note ? "live" : ""}`}>
                  {p.source === "api" && !p.note ? "ao vivo" : p.hasKey ? "manual" : "sem chave"}
                </span>
              </div>
              <div className="balance">{money(p.balance, p.unit)}</div>
              {p.approxUsd !== null && p.approxUsd !== undefined ? <div className="muted">≈ US$ {p.approxUsd.toFixed(2)}</div> : null}
              <div className="muted small">alerta em {money(p.lowThreshold, p.unit)}</div>
              {p.note ? <div className="note">{p.note}</div> : null}
              <div className="prov-actions">
                <a className="btn primary sm" href={p.topupUrl} target="_blank" rel="noreferrer">
                  Recarregar
                </a>
                {!p.hasKey ? (
                  <div className="keyrow">
                    <input
                      placeholder="cola a API key"
                      value={draft[p.id] ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                    />
                    <button className="btn sm" onClick={() => saveKey(p.id)}>salvar</button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel">
        <div className="row between">
          <h3>Gasto do mês</h3>
          <span className="muted">US$ {spend?.month?.toFixed(2) ?? "0,00"} de US$ {spend?.budget ?? 100}</span>
        </div>
        <div className="bar"><div className="fill" style={{ width: `${pct}%` }} /></div>
        <div className="row between small muted">
          <span>hoje: US$ {spend?.today?.toFixed(2) ?? "0,00"}</span>
          <span>
            {(spend?.byProvider ?? []).map((b: any) => `${b.provider} ${b.cost}`).join(" · ") || "sem gastos registrados"}
          </span>
        </div>

        <div className="row between" style={{ marginTop: 22 }}>
          <h3>Ajustes</h3>
        </div>
        <div className="settings">
          <label>
            Alertar quando o saldo ficar abaixo de (US$)
            <input
              type="number"
              step="0.5"
              value={settings.low_balance_threshold ?? "1"}
              onChange={(e) => saveSettings({ low_balance_threshold: e.target.value })}
            />
          </label>
          <label>
            Teto mensal (US$)
            <input
              type="number"
              value={settings.monthly_budget ?? "100"}
              onChange={(e) => saveSettings({ monthly_budget: e.target.value })}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.notify !== "0"}
              onChange={(e) => saveSettings({ notify: e.target.checked ? "1" : "0" })}
            />
            Notificação do macOS quando o vídeo ficar pronto
          </label>
        </div>
      </div>

      <div className="panel">
        <h3>Últimos lançamentos</h3>
        <table className="tbl">
          <thead>
            <tr><th>quando</th><th>provider</th><th>modelo</th><th>custo</th></tr>
          </thead>
          <tbody>
            {(spend?.recent ?? []).map((r: any) => (
              <tr key={r.id}>
                <td className="muted">{r.created_at}</td>
                <td>{r.provider}</td>
                <td className="muted">{r.model ?? r.note ?? "—"}</td>
                <td>{r.cost_usd ? `US$ ${Number(r.cost_usd).toFixed(3)}` : "grátis"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------- Marcas ------------------------------- */

function Marcas({ brands, reload }: { brands: Brand[]; reload: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [accent, setAccent] = useState("#c8a24a");

  async function create() {
    if (!name || !slug) return;
    await api.post("/api/brands", { slug, name, accent });
    setName("");
    setSlug("");
    reload();
  }

  return (
    <div className="view">
      <div className="view-head"><h1>Marcas</h1><span className="muted">uma por produto / perfil</span></div>
      <div className="providers">
        {brands.map((b) => (
          <div key={b.id} className="prov">
            <div className="prov-head">
              <h3 style={{ color: b.accent }}>{b.name}</h3>
              <span className="badge">/{b.slug}</span>
            </div>
            <p className="muted small">{b.niche ?? "sem descrição"}</p>
            <p className="muted small">CTA: {b.cta ?? "—"}</p>
          </div>
        ))}
      </div>
      <div className="panel">
        <h3>Nova marca</h3>
        <div className="grid2">
          <input placeholder="nome" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
          <button className="btn primary" onClick={create}>Criar</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Shell ------------------------------- */

const TABS: Tab[] = ["videos", "gerar", "refs", "creditos", "marcas"];

export function App() {
  const [tab, setTabState] = useState<Tab>(() => {
    const h = location.hash.replace("#", "") as Tab;
    return TABS.includes(h) ? h : "videos";
  });
  const setTab = (t: Tab) => {
    setTabState(t);
    history.replaceState(null, "", `#${t}`);
  };
  const [brands, setBrands] = useState<Brand[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const reloadBrands = useCallback(async () => setBrands(await api.get<Brand[]>("/api/brands")), []);
  const reloadSummary = useCallback(async () => setSummary(await api.get<Summary>("/api/summary")), []);

  useEffect(() => {
    reloadBrands();
    reloadSummary();
    const t = setInterval(reloadSummary, 5000);
    return () => clearInterval(t);
  }, [reloadBrands, reloadSummary]);

  const c = summary?.counts;

  return (
    <div className="shell">
      <aside className="side">
        <div className="logo">
          <span className="mark" />
          <span>Studio</span>
        </div>
        <nav>
          <button className={tab === "videos" ? "on" : ""} onClick={() => setTab("videos")}>
            Vídeos {c?.new ? <span className="pill">{c.new}</span> : null}
          </button>
          <button className={tab === "gerar" ? "on" : ""} onClick={() => setTab("gerar")}>
            Gerar {c?.queued ? <span className="pill">{c.queued}</span> : null}
          </button>
          <button className={tab === "refs" ? "on" : ""} onClick={() => setTab("refs")}>
            Referências
          </button>
          <button className={tab === "creditos" ? "on" : ""} onClick={() => setTab("creditos")}>
            Créditos
            {summary?.alerts?.length ? <span className="pill warn">!</span> : null}
          </button>
          <button className={tab === "marcas" ? "on" : ""} onClick={() => setTab("marcas")}>
            Marcas
          </button>
        </nav>
        <div className="side-foot">
          {summary?.rendering ? <span className="live"><i /> renderizando</span> : <span className="muted small">parado</span>}
          <span className="muted small">{c?.posted ?? 0} postados</span>
        </div>
      </aside>

      <main>
        {tab === "videos" ? <Videos brands={brands} onChange={reloadSummary} /> : null}
        {tab === "gerar" ? <Gerar brands={brands} onDone={reloadSummary} /> : null}
        {tab === "refs" ? <Referencias /> : null}
        {tab === "creditos" ? <Creditos /> : null}
        {tab === "marcas" ? <Marcas brands={brands} reload={reloadBrands} /> : null}
      </main>
    </div>
  );
}
