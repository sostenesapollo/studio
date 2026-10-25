export type TemplateId = "natural" | "bold" | "premium" | "editorial" | "punch" | "split" | "letterbox" | "bar";

export type Template = {
  id: TemplateId;
  label: string;
  hint: string;
  font: string;
  hookWeight: number;
  hookSize: number;
  hookCase: "none" | "upper";
  kickerFont?: string;
  captionStyle: "boxed" | "plain" | "bar" | "outline" | "serif";
  captionSize?: number;
  layout: "top-left" | "center" | "bottom-bar" | "kinetic" | "split" | "letterbox";
  particle: "gold-dust" | "bokeh" | "light-leak" | "grain" | "sparkle" | "none";
  grade: "neutral" | "warm" | "film";
  musicVolume: number;
  split?: boolean;
  ctaStyle: "pill" | "underline" | "bare";
  duration: number;
  transition: "fade" | "slideleft" | "smoothup" | "wipeleft" | "circleopen";
};

export const TEMPLATES: Record<TemplateId, Template> = {
  natural: {
    id: "natural",
    label: "Natural",
    hint: "sem pose: legenda discreta, sem partícula, parece publicação de perfil",
    font: '"HelveticaNeue-Medium", "Helvetica Neue", system-ui, sans-serif',
    hookWeight: 600,
    hookSize: 52,
    hookCase: "none",
    kickerFont: '"HelveticaNeue-Medium", "Helvetica Neue", sans-serif',
    captionStyle: "plain",
    captionSize: 42,
    layout: "top-left",
    particle: "none",
    grade: "neutral",
    musicVolume: 0.12,
    ctaStyle: "bare",
    duration: 15,
    transition: "fade",
  },
  bold: {
    id: "bold",
    label: "Bold",
    hint: "condensada gigante, legenda em caixa — o clássico do feed",
    font: '"HelveticaNeue-CondensedBlack", "Helvetica Neue", "Arial Narrow", sans-serif',
    hookWeight: 400,
    hookSize: 92,
    hookCase: "upper",
    captionStyle: "boxed",
    layout: "top-left",
    particle: "gold-dust",
    grade: "warm",
    musicVolume: 0.14,
    ctaStyle: "pill",
    duration: 16,
    transition: "smoothup",
  },
  premium: {
    id: "premium",
    label: "Premium",
    hint: "Avenir pesada, muito respiro, régua fina — parece marca grande",
    font: '"AvenirNext-Heavy", "Avenir Next", "Helvetica Neue", sans-serif',
    hookWeight: 800,
    hookSize: 68,
    hookCase: "none",
    captionStyle: "plain",
    captionSize: 46,
    layout: "center",
    particle: "bokeh",
    grade: "neutral",
    musicVolume: 0.16,
    ctaStyle: "underline",
    duration: 17,
    transition: "fade",
  },
  editorial: {
    id: "editorial",
    label: "Editorial",
    hint: "serifa com itálico, grão de filme — casa com tradubook",
    font: 'Georgia, "Times New Roman", serif',
    hookWeight: 700,
    hookSize: 64,
    hookCase: "none",
    kickerFont: '"AvenirNext-Medium", "Avenir Next", sans-serif',
    captionStyle: "serif",
    captionSize: 46,
    layout: "top-left",
    particle: "grain",
    grade: "film",
    musicVolume: 0.12,
    ctaStyle: "bare",
    duration: 18,
    transition: "fade",
  },
  punch: {
    id: "punch",
    label: "Kinetic",
    hint: "uma palavra por vez, batida no ritmo — retenção alta",
    font: '"AvenirNext-Heavy", "Avenir Next", sans-serif',
    hookWeight: 800,
    hookSize: 104,
    hookCase: "upper",
    captionStyle: "outline",
    layout: "kinetic",
    particle: "sparkle",
    grade: "neutral",
    musicVolume: 0.18,
    ctaStyle: "pill",
    duration: 15,
    transition: "slideleft",
  },
  split: {
    id: "split",
    label: "Split",
    hint: "tela dividida: produto em cima, cena embaixo",
    font: '"HelveticaNeue-CondensedBlack", "Helvetica Neue", sans-serif',
    hookWeight: 400,
    hookSize: 74,
    hookCase: "upper",
    captionStyle: "bar",
    layout: "split",
    particle: "none",
    grade: "warm",
    musicVolume: 0.14,
    split: true,
    ctaStyle: "pill",
    duration: 16,
    transition: "wipeleft",
  },
  letterbox: {
    id: "letterbox",
    label: "Letterbox",
    hint: "conteúdo em 4:5 com barras pretas — cinema no feed",
    font: '"Didot-Bold", Didot, "Times New Roman", serif',
    hookWeight: 400,
    hookSize: 58,
    hookCase: "none",
    kickerFont: '"AvenirNext-Medium", "Avenir Next", sans-serif',
    captionStyle: "plain",
    layout: "letterbox",
    particle: "none",
    grade: "film",
    musicVolume: 0.1,
    ctaStyle: "bare",
    duration: 18,
    transition: "fade",
  },
  bar: {
    id: "bar",
    label: "Bar",
    hint: "faixa colorida com o hook, imagem limpa em cima",
    font: '"AvenirNext-Heavy", "Avenir Next", sans-serif',
    hookWeight: 800,
    hookSize: 56,
    hookCase: "none",
    captionStyle: "bar",
    layout: "bottom-bar",
    particle: "light-leak",
    grade: "neutral",
    musicVolume: 0.16,
    ctaStyle: "pill",
    duration: 16,
    transition: "circleopen",
  },
};

export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];

export function pickTemplate(seed: number, allowed?: TemplateId[]): Template {
  const pool = allowed?.length ? allowed : TEMPLATE_IDS;
  return TEMPLATES[pool[Math.abs(seed) % pool.length]];
}
