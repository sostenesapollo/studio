import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Mock do produto: página de livro traduzida ou tela do presente.
 * Desenhado em HTML/CSS (texto nítido, zero artefato de IA) e animado no tempo.
 */

type Lang = "pt" | "en";

const BookPanel: React.FC<{ accent: string; title: string; chapter: string; lines: string[]; page: number; lang?: Lang }> = ({
  accent,
  title,
  chapter,
  lines,
  page,
  lang = "pt",
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scroll = interpolate(frame, [0, durationInFrames], [0, -46]);
  return (
    <div
      style={{
        width: 620,
        height: 800,
        background: "linear-gradient(160deg,#fbf8f1 0%,#f4eee1 100%)",
        borderRadius: 6,
        boxShadow: "0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.12)",
        padding: "50px 46px",
        position: "relative",
        overflow: "hidden",
        transform: "rotate(-1.6deg)",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, background: `linear-gradient(180deg, ${accent}, rgba(0,0,0,0.15))` }} />
      <div style={{ transform: `translateY(${scroll}px)` }}>
        <div style={{ fontFamily: '"AvenirNext-Medium", "Avenir Next", sans-serif', fontSize: 15, letterSpacing: 3.4, textTransform: "uppercase", color: "#8a7a5c", marginBottom: 18 }}>
          {chapter}
        </div>
        <div style={{ fontFamily: '"InstrumentSerif", Georgia, serif', fontSize: 48, lineHeight: 1.06, color: "#1b1a17", marginBottom: 24, letterSpacing: -0.6 }}>
          {title}
        </div>
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              fontFamily: '"InstrumentSerif", Georgia, serif',
              fontSize: 26,
              lineHeight: 1.58,
              color: "#2b2823",
              marginBottom: i === 0 ? 14 : 8,
              textAlign: "left",
              opacity: interpolate(frame, [i * 3, i * 3 + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
{l}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", bottom: 22, left: 0, right: 0, textAlign: "center", fontFamily: '"InstrumentSerif", Georgia, serif', fontSize: 15, color: "#8d8069", letterSpacing: 1 }}>
        — {page} —
      </div>
      <div style={{ position: "absolute", top: 22, left: 46, right: 22, textAlign: "right", fontFamily: '"AvenirNext-Medium","Avenir Next",sans-serif', fontSize: 12, letterSpacing: 2.4, textTransform: "uppercase", color: "#a2937a" }}>
        tradubook
      </div>
      <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, background: "linear-gradient(225deg, rgba(0,0,0,0.10), transparent 70%)" }} />
      <div style={{ position: "absolute", bottom: 22, right: 22, fontFamily: '"AvenirNext-DemiBold","Avenir Next",sans-serif', fontSize: 13, letterSpacing: 2, color: "#fff", background: "#1b1a17", padding: "7px 12px", borderRadius: 4 }}>
        {lang === "en" ? "EPUB · EN" : "EPUB · PT-BR"}
      </div>
    </div>
  );
};

const PhonePanel: React.FC<{ accent: string; name: string; days: string; lang?: Lang }> = ({ accent, name, days, lang = "pt" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bars = new Array(28).fill(0).map((_, i) => 8 + Math.abs(Math.sin(frame / 6 + i * 0.9)) * 26);
  return (
    <div
      style={{
        width: 430,
        height: 820,
        borderRadius: 54,
        background: "#0a0a0c",
        boxShadow: "0 40px 100px rgba(0,0,0,0.65), 0 0 0 2px rgba(255,255,255,0.12)",
        padding: 12,
        transform: "rotate(-1.4deg)",
      }}
    >
      <div style={{ width: "100%", height: "100%", borderRadius: 44, overflow: "hidden", background: "#111", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 12, display: "flex", justifyContent: "center" }}>
          <div style={{ width: 120, height: 26, borderRadius: 14, background: "#000", marginTop: -8 }} />
        </div>
        <div style={{ height: 400, background: `linear-gradient(160deg, ${accent}66, #1b1b22 85%)`, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `radial-gradient(circle at 30% 30%, ${accent}55, transparent 55%), radial-gradient(circle at 70% 70%, #ffffff22, transparent 50%)`,
            }}
          />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 180, background: "linear-gradient(180deg, transparent, #111)" }} />
        </div>
        <div style={{ padding: "22px 26px", color: "#fff", fontFamily: '"AvenirNext-DemiBold", "Avenir Next", sans-serif' }}>
          <div style={{ fontSize: 15, letterSpacing: 3, textTransform: "uppercase", color: accent, marginBottom: 10 }}>{lang === "en" ? "made for you" : "feito pra você"}</div>
          <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.8, marginBottom: 22 }}>{name}</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 34, marginBottom: 22 }}>
            {bars.map((h, i) => (
              <div key={i} style={{ width: 5, height: h, background: i % 3 === 0 ? accent : "rgba(255,255,255,0.35)", borderRadius: 3 }} />
            ))}
          </div>
          <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>{lang === "en" ? "counting down to" : "contando até"}</div>
          <div style={{ fontFamily: '"AvenirNext-Heavy","Avenir Next",sans-serif', fontSize: 40, fontWeight: 800, letterSpacing: -1, marginTop: 4 }}>{days}</div>
        </div>
      </div>
    </div>
  );
};

const ComparePanel: React.FC<{ accent: string; en: string; pt: string; lang?: Lang }> = ({ accent, en, pt, lang = "pt" }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const sweep = interpolate(frame, [30, durationInFrames * 0.6], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        width: 640,
        height: 780,
        background: "linear-gradient(160deg,#fbf8f1,#f2ece0)",
        borderRadius: 8,
        padding: "34px 38px",
        boxShadow: "0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.12)",
        transform: "rotate(-1.2deg)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ fontFamily: '"AvenirNext-DemiBold","Avenir Next",sans-serif', fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: "#a2937a" }}>original</div>
      <div style={{ fontFamily: '"InstrumentSerif", Georgia, serif', fontSize: 20, lineHeight: 1.5, color: "#8d8477" }}>{en}</div>
      <div style={{ height: 1, background: "#d8cfbd", margin: "6px 0" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontFamily: '"AvenirNext-DemiBold","Avenir Next",sans-serif', fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: accent }}>{lang === "en" ? "english" : "português"}</div>
        <div style={{ flex: 1, height: 1, background: `${accent}55` }} />
      </div>
      <div style={{ position: "relative", fontFamily: '"InstrumentSerif", Georgia, serif', fontSize: 22, lineHeight: 1.55, color: "#1f1d19" }}>
        {pt}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(90deg, ${accent}33 0%, ${accent}00 ${Math.round(sweep * 100)}%)`,
            pointerEvents: "none",
          }}
        />
      </div>
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: '"AvenirNext-DemiBold","Avenir Next",sans-serif', fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#a2937a" }}>tradubook</div>
        <div style={{ fontFamily: '"AvenirNext-DemiBold","Avenir Next",sans-serif', fontSize: 11, letterSpacing: 1.5, color: "#fff", background: "#1b1a17", padding: "6px 10px", borderRadius: 4 }}>{lang === "en" ? "EPUB · EN" : "EPUB · PT-BR"}</div>
      </div>
    </div>
  );
};

export const ProductMock: React.FC<{
  mode: "book" | "phone" | "compare";
  en?: string;
  pt?: string;
  accent: string;
  position?: "center" | "right" | "bottom";
  title?: string;
  chapter?: string;
  lines?: string[];
  name?: string;
  days?: string;
  lang?: Lang;
}> = ({ mode, accent, position = "center", title, chapter, lines = [], name, days, lang = "pt", en, pt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 14, fps, config: { damping: 18, mass: 0.8 }, durationInFrames: 24 });
  const y = interpolate(enter, [0, 1], [90, 0]);
  const scale = interpolate(enter, [0, 1], [0.92, 1]);
  const opacity = interpolate(enter, [0, 1], [0, 1]);

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ transform: `translateY(${y}px) scale(${scale})`, opacity }}>
        {mode === "compare" ? (
          <ComparePanel
            lang={lang}
            accent={accent}
            en={en ?? "The room was full of the smell of roses, and the sound of the piano came from another room."}
            pt={pt ?? "A sala estava cheia do perfume das rosas, e o som do piano vinha de outro quarto."}
          />
        ) : mode === "book" ? (
          <BookPanel
            lang={lang}
            accent={accent}
            title={title ?? (lang === "en" ? "The Picture of Dorian Gray" : "O retrato de Dorian Gray")}
            chapter={chapter ?? (lang === "en" ? "chapter IV · translated" : "capítulo IV · traduzido")}
            lines={lines}
            page={47}
          />
        ) : (
          <PhonePanel
            lang={lang}
            accent={accent}
            name={name ?? (lang === "en" ? "For you, Bia" : "Bia, 24 anos")}
            days={days ?? (lang === "en" ? "23 days 11:04:59" : "23 dias 11:04:59")}
          />
        )}
      </div>
    </div>
  );
};
