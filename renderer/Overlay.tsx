import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ProductMock } from "./ProductMock";
import { GRAIN_URI } from "./grain";

export type Caption = { text: string; from: number; to: number };

export type OverlayProps = {
  hook: string;
  kicker?: string;
  cta?: string;
  accent: string;
  brand: string;
  captions: Caption[];
  template: any;
  particle: string;
  split?: { top: string; bottom: string } | null;
  mock?: any;
  closing?: string | null;
  durationInFrames?: number;
  showProgress?: boolean;
  ctaFrom?: number;
};

function rnd(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const COUNT = 110;

const Particles: React.FC<{ preset: string; accent: string }> = ({ preset, accent }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  if (!preset || preset === "none") return null;
  const r = rnd(preset === "gold-dust" ? 1337 : preset === "bokeh" ? 77 : preset === "sparkle" ? 991 : 42);
  const items = new Array(COUNT).fill(0).map((_, i) => ({
    i,
    x: r(),
    y: r(),
    size: r(),
    speed: r(),
    phase: r(),
  }));

  if (preset === "light-leak") {
    const p = (frame / durationInFrames) * Math.PI * 2;
    return (
      <AbsoluteFill style={{ mixBlendMode: "screen", opacity: 0.5 }}>
        <div style={{ position: "absolute", left: `${-20 + Math.sin(p) * 22}%`, top: "-10%", width: "70%", height: "120%", background: `radial-gradient(ellipse at center, ${accent}cc 0%, ${accent}33 35%, transparent 70%)`, filter: "blur(70px)", transform: `rotate(${Math.sin(p * 0.7) * 10}deg)` }} />
        <div style={{ position: "absolute", right: `${-30 + Math.cos(p) * 18}%`, bottom: "-20%", width: "80%", height: "100%", background: "radial-gradient(ellipse at center, rgba(255,214,170,0.5) 0%, transparent 65%)", filter: "blur(90px)" }} />
      </AbsoluteFill>
    );
  }

  if (preset === "grain") {
    const jitter = Math.floor(frame / 2) % 4;
    return (
      <AbsoluteFill
        style={{
          opacity: 0.2,
          mixBlendMode: "overlay",
          backgroundImage: `url(${GRAIN_URI})`,
          backgroundRepeat: "repeat",
          backgroundPosition: `${jitter * 7}px ${jitter * 11}px`,
          backgroundSize: "192px 192px",
        }}
      />
    );
  }

  return (
    <AbsoluteFill style={{ mixBlendMode: "screen" }}>
      {items.map(({ i, x: bx, y: by, size, speed, phase }) => {
        const t = frame / durationInFrames;
        const drift = preset === "gold-dust" ? -1 : 0.3;
        const y = (((by + drift * t * (0.6 + speed)) % 1) + 1) % 1;
        const x = (bx + Math.sin(t * 6 + phase * 10) * 0.025) % 1;
        const px = preset === "bokeh" ? 24 + size * 74 : 3 + size * 10;
        const opacity =
          (preset === "sparkle" ? 0.2 + Math.abs(Math.sin(t * 9 + phase * 7)) * 0.8 : 0.16 + size * 0.5) *
          interpolate(t, [0, 0.08, 0.9, 1], [0, 1, 1, 0.2], { extrapolateRight: "clamp" });
        const blur = preset === "bokeh" ? 6 + size * 18 : size * 2;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: px,
              height: px,
              borderRadius: "50%",
              background:
                preset === "bokeh"
                  ? `radial-gradient(circle, ${accent}55 0%, ${accent}22 60%, transparent 72%)`
                  : `radial-gradient(circle, #fff8e6 0%, ${accent} 45%, transparent 70%)`,
              opacity,
              filter: `blur(${blur}px)`,
              transform: "translate(-50%,-50%)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Kicker: React.FC<{ text?: string; accent: string; font?: string; style?: React.CSSProperties }> = ({ text, accent, font, style }) =>
  text ? (
    <div
      style={{
        display: "inline-block",
        fontSize: 24,
        letterSpacing: 4.5,
        textTransform: "uppercase",
        color: accent,
        fontFamily: font ?? '"AvenirNext-Medium", "Avenir Next", sans-serif',
        fontWeight: 600,
        padding: "7px 15px",
        border: `1px solid ${accent}66`,
        borderRadius: 999,
        background: "rgba(0,0,0,0.42)",
        ...style,
      }}
    >
      {text}
    </div>
  ) : null;

/** legenda com estilos diferentes */
const CaptionLine: React.FC<{ c: Caption; tpl: any; accent: string; frame: number }> = ({ c, tpl, accent, frame }) => {
  if (frame < c.from || frame > c.to + 1) return null;
  const p = interpolate(frame, [c.from, c.to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const words = c.text.split(" ");
  const active = Math.min(Math.floor(p * words.length), words.length - 1);
  const base: React.CSSProperties = {
    fontFamily: tpl.captionStyle === "serif" ? 'Georgia, "Times New Roman", serif' : tpl.font,
    fontWeight: tpl.captionStyle === "serif" ? 600 : 800,
    fontSize: tpl.captionSize ?? (tpl.captionStyle === "serif" ? 46 : 52),
    lineHeight: 1.18,
    letterSpacing: tpl.captionStyle === "serif" ? 0 : -0.5,
    textTransform: tpl.captionStyle === "serif" ? "none" : "none",
    opacity: Math.min(p * 8, 1),
  };

  const Words = ({ dim }: { dim: number }) => (
    <>
      {words.map((w, wi) => (
        <span
          key={wi}
          style={{
            color: wi <= active ? "#fff" : `rgba(255,255,255,${dim})`,
            textShadow: wi === active ? `0 0 14px ${accent}55` : "none",
          }}
        >
          {w}{" "}
        </span>
      ))}
    </>
  );

  if (tpl.captionStyle === "boxed")
    return (
      <div style={{ ...base, display: "inline", background: "rgba(0,0,0,0.72)", padding: "6px 10px", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
        <Words dim={0.6} />
      </div>
    );
  if (tpl.captionStyle === "bar")
    return (
      <div style={{ ...base, background: "rgba(0,0,0,0.78)", padding: "16px 22px", width: "100%", textAlign: "center" }}>
        <Words dim={0.55} />
      </div>
    );
  if (tpl.captionStyle === "outline")
    return (
      <div style={{ ...base, fontSize: 66, fontWeight: 900, WebkitTextStroke: "3px #000", paintOrder: "stroke fill" } as any}>
        <Words dim={0.45} />
      </div>
    );
  if (tpl.captionStyle === "serif")
    return (
      <div style={{ ...base, color: "#f4efe6" }}>
        <Words dim={0.5} />
      </div>
    );
  return (
    <div style={{ ...base, borderLeft: `5px solid ${accent}`, paddingLeft: 16 }}>
      <Words dim={0.5} />
    </div>
  );
};

export const Overlay: React.FC<OverlayProps> = ({ hook, kicker, cta, accent, brand, captions, template, particle, split, mock, closing, showProgress, ctaFrom }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const tpl = template ?? {};

  const inAnim = spring({ frame, fps, config: { damping: 200, mass: 0.6 }, durationInFrames: 16 });
  const hookOut = interpolate(frame, [110, 130], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ctaStart = ctaFrom ?? Math.max(durationInFrames - 70, 40);
  const ctaIn = spring({ frame: frame - ctaStart, fps, config: { damping: 200 }, durationInFrames: 18 });

  const hookStyle: React.CSSProperties = {
    fontFamily: tpl.font,
    fontWeight: tpl.hookWeight ?? 800,
    fontSize: tpl.hookSize ?? 76,
    lineHeight: 1.02,
    letterSpacing: tpl.hookCase === "upper" ? -1 : -1.8,
    textTransform: tpl.hookCase === "upper" ? "uppercase" : "none",
    color: "#fff",
    textShadow: "0 10px 44px rgba(0,0,0,0.8)",
  };

  const CTA = () =>
    cta ? (
      <div style={{ position: "absolute", bottom: mock ? 800 : tpl.layout === "bottom-bar" ? 40 : 138, left: 0, right: 0, textAlign: "center", opacity: ctaIn, transform: `translateY(${interpolate(ctaIn, [0, 1], [18, 0])}px)` }}>
        {tpl.ctaStyle === "underline" ? (
          <div style={{ display: "inline-block", fontFamily: tpl.font, fontSize: 40, fontWeight: 800, color: "#fff", borderBottom: `4px solid ${accent}`, paddingBottom: 8 }}>{cta}</div>
        ) : tpl.ctaStyle === "bare" ? (
          <div style={{ fontFamily: tpl.kickerFont ?? tpl.font, fontSize: 30, letterSpacing: 2, textTransform: "uppercase", color: "#fff" }}>{cta}</div>
        ) : (
          <span style={{ display: "inline-block", fontFamily: tpl.font, fontSize: 38, fontWeight: 800, color: "#0b0b0c", background: "#fff", padding: "17px 32px", borderRadius: 999, boxShadow: `0 12px 50px ${accent}88` }}>{cta}</span>
        )}
      </div>
    ) : null;

  const captionsBox = (style: React.CSSProperties) => (
    <div style={{ position: "absolute", left: 56, right: 56, ...style }}>
      {captions.map((c, i) => (
        <CaptionLine key={i} c={c} tpl={tpl} accent={accent} frame={frame} />
      ))}
    </div>
  );

  /* ---------- kinetic: uma palavra por vez ---------- */
  if (tpl.layout === "kinetic") {
    const words = hook.split(" ");
    const span = 84;
    const idx = Math.min(Math.floor(frame / (span / Math.max(words.length, 1))), words.length - 1);
    const showHook = frame < span;
    return (
      <AbsoluteFill style={{ backgroundColor: "transparent" }}>
        <Particles preset={particle} accent={accent} />
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 30%, transparent 62%, rgba(0,0,0,0.72) 100%)" }} />
        {showHook ? (
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 60 }}>
            <div style={{ ...hookStyle, textAlign: "center", transform: `scale(${1 + interpolate(frame % (span / words.length), [0, 6], [0.12, 0], { extrapolateRight: "clamp" })})` }}>
              {words.slice(0, idx + 1).map((w, i) => (
                <span key={i} style={{ color: i === idx ? accent : "#fff", display: "inline-block", marginRight: 14 }}>{w}</span>
              ))}
            </div>
          </AbsoluteFill>
        ) : null}
        {captionsBox({ bottom: 260, textAlign: "center" })}
        {closing
        ? (() => {
            const startFrame = Math.max(durationInFrames - 78, 30);
            const p = interpolate(frame, [startFrame, startFrame + 14], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            if (p <= 0) return null;
            return (
              <div
                style={{
                  position: "absolute",
                  bottom: mock ? 960 : 236,
                  left: 44,
                  right: 44,
                  opacity: p,
                  transform: `translateY(${(1 - p) * 14}px)`,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    fontFamily: tpl.font,
                    fontSize: 36,
                    lineHeight: 1.2,
                    fontWeight: 700,
                    letterSpacing: -0.4,
                    color: "#fff",
                    background: "rgba(0,0,0,0.58)",
                    padding: "14px 20px",
                    borderRadius: 12,
                    boxShadow: `inset 0 -2px 0 ${accent}`,
                  }}
                >
                  {closing}
                </div>
              </div>
            );
          })()
        : null}

      <CTA />
        {showProgress ? (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 5, background: "rgba(255,255,255,0.15)" }}>
            <div style={{ height: "100%", width: `${(frame / durationInFrames) * 100}%`, background: accent }} />
          </div>
        ) : null}
      </AbsoluteFill>
    );
  }

  /* ---------- letterbox ---------- */
  const isLetter = tpl.layout === "letterbox";
  const barH = isLetter ? 260 : 0;

  /* ---------- split ---------- */
  const isSplit = tpl.layout === "split";

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <Particles preset={particle} accent={accent} />

      {isLetter ? (
        <>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: barH, background: "#08090a" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: barH, background: "#08090a" }} />
        </>
      ) : (
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.45) 100%)" }} />
      )}

      {isSplit && split ? (
        <>
          {/* scrim no painel de cima para o hook ficar legível */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 700, background: "linear-gradient(180deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.25) 100%)" }} />
          <div style={{ position: "absolute", top: 700, left: 0, right: 0, height: 3, background: `${accent}` }} />
          <div style={{ position: "absolute", top: 646, right: 40, fontSize: 20, letterSpacing: 4, textTransform: "uppercase", color: accent, fontFamily: tpl.kickerFont ?? tpl.font, background: "rgba(0,0,0,0.55)", padding: "6px 12px", borderRadius: 4 }}>
            {split.top}
          </div>
          <div style={{ position: "absolute", top: 720, right: 40, fontSize: 20, letterSpacing: 4, textTransform: "uppercase", color: "rgba(255,255,255,0.8)", fontFamily: tpl.kickerFont ?? tpl.font, background: "rgba(0,0,0,0.5)", padding: "6px 12px", borderRadius: 4 }}>
            {split.bottom}
          </div>
        </>
      ) : null}

      {/* hook — topo */}
      {(tpl.layout === "top-left" || isSplit) ? (
        <div style={{ position: "absolute", top: isLetter ? 56 : 130, left: 56, right: 56, opacity: inAnim * hookOut, transform: `translateY(${interpolate(inAnim, [0, 1], [36, 0])}px)` }}>
          <Kicker text={kicker} accent={accent} font={tpl.kickerFont} style={{ marginBottom: 14 }} />
          <div style={hookStyle}>{hook}</div>
        </div>
      ) : null}

      {/* hook — centro */}
      {tpl.layout === "center" ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 64, opacity: inAnim * hookOut }}>
          <Kicker text={kicker} accent={accent} font={tpl.kickerFont} style={{ marginBottom: 22 }} />
          <div style={{ ...hookStyle, textAlign: "center", maxWidth: 900 }}>{hook}</div>
          <div style={{ width: 90, height: 2, background: `${accent}aa`, marginTop: 26 }} />
        </AbsoluteFill>
      ) : null}

      {/* hook — barra inferior */}
      {tpl.layout === "bottom-bar" ? (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: accent, padding: "30px 40px 40px", transform: `translateY(${interpolate(inAnim, [0, 1], [140, 0])}px)` }}>
          <div style={{ ...hookStyle, fontSize: (tpl.hookSize ?? 56) - 6, color: "#0b0b0c", textShadow: "none", letterSpacing: -1 }}>{hook}</div>
        </div>
      ) : null}

      {/* letterbox: hook na barra de cima */}
      {isLetter ? (
        <div style={{ position: "absolute", top: 54, left: 40, right: 40, opacity: inAnim * hookOut, textAlign: "center" }}>
          <div style={{ ...hookStyle, fontSize: tpl.hookSize, textAlign: "center" }}>{hook}</div>
        </div>
      ) : null}

      {/* mock do produto */}
      {mock && !isSplit ? (
        <div
          style={{
            position: "absolute",
            bottom: isLetter ? -10 : 26,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            transform: "scale(0.8)",
            transformOrigin: "center bottom",
          }}
        >
          <ProductMock {...mock} accent={accent} />
        </div>
      ) : null}

      {/* legendas */}
      {captionsBox(
        isLetter
          ? { bottom: mock ? 650 : 74, textAlign: "center", left: 46, right: 46 }
          : tpl.layout === "bottom-bar"
            ? { bottom: 300 }
            : isSplit
              ? { bottom: 210, left: 40, right: 40 }
              : { bottom: mock ? 720 : 300 },
      )}

      {closing
        ? (() => {
            const startFrame = Math.max(durationInFrames - 78, 30);
            const p = interpolate(frame, [startFrame, startFrame + 14], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            if (p <= 0) return null;
            return (
              <div
                style={{
                  position: "absolute",
                  bottom: mock ? 960 : 236,
                  left: 44,
                  right: 44,
                  opacity: p,
                  transform: `translateY(${(1 - p) * 14}px)`,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    fontFamily: tpl.font,
                    fontSize: 36,
                    lineHeight: 1.2,
                    fontWeight: 700,
                    letterSpacing: -0.4,
                    color: "#fff",
                    background: "rgba(0,0,0,0.58)",
                    padding: "14px 20px",
                    borderRadius: 12,
                    boxShadow: `inset 0 -2px 0 ${accent}`,
                  }}
                >
                  {closing}
                </div>
              </div>
            );
          })()
        : null}

      <CTA />

      {showProgress ? (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 5, background: "rgba(255,255,255,0.12)" }}>
          <div style={{ height: "100%", width: `${(frame / durationInFrames) * 100}%`, background: accent }} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
