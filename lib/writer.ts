import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../db";
import { getKeys } from "./keys";
import { logSpend } from "./credits";
import { learningBrief } from "./learning";
import { swipeBrief } from "./swipe";

const GUIDELINES = readFileSync(join(ROOT, "GUIDELINES.md"), "utf8");

export const ANGLES = [
  { id: "descoberta", hint: "encontrou por acaso e testou sem esperar nada", hintEn: "found it by accident and tried it expecting nothing" },
  { id: "primeira_pessoa", hint: "demonstração em primeira pessoa, mostrando a tela/arquivo", hintEn: "first-person demo, showing the screen or the file" },
  { id: "cotidiano", hint: "uma situação real do dia a dia que virou problema e como resolveu", hintEn: "a real everyday situation that turned into a problem and how it got solved" },
  { id: "duvida", hint: "responde uma dúvida que muita gente tem sobre o assunto", hintEn: "answers a question a lot of people have about this" },
  { id: "opiniao", hint: "opinião específica e justificável, sem atacar ninguém", hintEn: "a specific, defensible opinion, without attacking anyone" },
  { id: "comparacao", hint: "compara o caminho antigo com o que passou a fazer", hintEn: "compares the old way with what they do now" },
  { id: "detalhe", hint: "explica um detalhe pouco conhecido que muda a percepção", hintEn: "explains a little-known detail that changes how you see it" },
  { id: "reacao", hint: "reação autêntica ao resultado da primeira tentativa", hintEn: "authentic reaction to the result of the first try" },
  { id: "bastidor", hint: "mostra o processo por trás, sem editar demais", hintEn: "shows the process behind it, lightly edited" },
  { id: "historico", hint: "conta um episódio específico com data, lugar ou nome próprio", hintEn: "tells a specific episode with a date, place or first name" },
  { id: "objecao_preco", hint: "quebra a objeção de que traduzir/contratar isso sai caro (sem citar número)", hintEn: "breaks the objection that translating/paying for this is too expensive (no numbers)" },
  { id: "objecao_qualidade", hint: "quebra a objeção de que tradução automática fica horrível — mostra o resultado real", hintEn: "breaks the objection that machine translation reads terribly — show the actual result" },
] as const;

export type AngleId = (typeof ANGLES)[number]["id"];

export type Lang = "pt" | "en";

export const LANGS: Lang[] = ["pt", "en"];

const BRIEF: Record<string, string> = {
  giftsqr:
    "Página de presente digital personalizada. A pessoa monta no celular em poucos minutos: fotos, mensagem, música e uma contagem regressiva até a data. Entrega por QR code impresso ou mandando no WhatsApp. Quem recebe abre no celular e vê a página. Funciona em 17 idiomas.",
  tradubook:
    "Envia um PDF ou EPUB e recebe o livro traduzido em português, com capa, sumário, notas e formatação preservadas. O arquivo volta em minutos e dá pra ler no Kindle ou no celular. Tem amostra antes de liberar o livro inteiro.",
};

const BRIEF_EN: Record<string, string> = {
  giftsqr:
    "Personalized digital gift page. You build it on your phone in a few minutes: photos, a message, music and a countdown to the date. You hand it over as a printed QR code or send it on WhatsApp. The person opens it on their phone and sees the page. It works in 17 languages.",
  tradubook:
    "You send a PDF or EPUB and get the book translated, with cover, table of contents, footnotes and formatting preserved. The file comes back in minutes and reads on Kindle or phone. There is a free sample before you unlock the whole book.",
};

const DORES: Record<string, string> = {
  giftsqr:
    "dores: dar presente genérico, esquecer a data, não ter tempo de ir atrás, gastar com algo que a pessoa não usa. objeções: 'é só um cartão', 'vai parecer frio', 'não sei mexer'.",
  tradubook:
    "dores: livro parado na estante porque está em inglês, tradução oficial cara, tradução automática travada e sem formatação, Kindle que não traduz o arquivo inteiro. objeções: 'deve custar caro', 'tradução de máquina fica horrível', 'vai perder a formatação'. O vídeo pode quebrar essas objeções mostrando o resultado — sem citar preço, desconto ou condição comercial.",
};

const DORES_EN: Record<string, string> = {
  giftsqr:
    "pain points: giving a generic gift, forgetting the date, having no time to shop, spending money on something the person never uses. objections: 'it's just a card', 'it will feel cold', 'I don't know how to build it'.",
  tradubook:
    "pain points: a book sitting on the shelf because it is in another language, official translation costs too much, browser translation breaks the formatting, Kindle does not translate the whole file. objections: 'it must be expensive', 'machine translation reads terribly', 'it will lose the formatting'. The video can break those objections by showing the result — never mention price, discount or any commercial condition.",
};

const MODELOS = [
  "deepseek/deepseek-chat-v3.1",
  "google/gemini-2.5-flash",
  "openai/gpt-4o-mini",
];

const BANIDO = /(incr[íi]vel|revolucion|transforme|descubra|segredo|muito al[ée]m|sem sair de casa|na palma da sua m[ãa]o|s[óo] pra voc[êe]|como ter|mudou minha vida|nova leitura|jornada|experi[êe]ncia [úu]nica)/i;

const BANIDO_EN = /(unbelievable|revolutionar|transform your|discover the secret|game.?changer|life.?changing|you won'?t believe|mind.?blowing|secret trick|in the palm of your hand)/i;

const PROIBIDO = /(R\$|pre[çc]o|desconto|cupom|promo[çc]|gr[áa]tis|gratuit|compre agora|corre que|[úu]ltimas unidades|não perca|imperd[íi]vel|aproveite|por apenas)/i;

const PROIBIDO_EN = /(\$\d|price|discount|coupon|promo code|for free|buy now|hurry|limited (stock|time)|last chance|don'?t miss|act now|cheap)/i;

const HASHTAG_STOP = new Set(["de", "da", "do", "para", "pra", "com", "the", "and", "for", "with", "your", "you", "a", "o", "e"]);

/** "Tradução de Livros" -> "traducaodelivros" (sem acento, sem espaço, sem #). */
function normalizeTag(raw: string): string | null {
  const t = String(raw)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (t.length < 3 || t.length > 24) return null;
  if (HASHTAG_STOP.has(t)) return null;
  return t;
}

function promptPT(brand: string, angle: (typeof ANGLES)[number]) {
  return `Você escreve roteiros de vídeo curto (TikTok/Reels) em português brasileiro para uma pessoa comum publicar no próprio perfil. Nada de anúncio.

PRODUTO (fatos reais, não invente nada além disso):
${BRIEF[brand] ?? BRIEF.giftsqr}

CONTEXTO DO PÚBLICO:
${DORES[brand] ?? DORES.giftsqr}

ÂNGULO NARRATIVO OBRIGATÓRIO: ${angle.hint}
UMA única ideia central. Não fale de outro benefício.

O QUE JÁ FUNCIONOU E O QUE FOI REPROVADO (aprenda com isso):
${learningBrief(brand)}

${swipeBrief(brand)}

EXEMPLOS DE GANCHO BOM (concreto, dito por uma pessoa):
- "Esse livro está na minha estante há quatro anos."
- "Ela abriu e ficou olhando a tela sem falar nada."
- "Terminei um livro que não existe em português."
EXEMPLOS RUINS (nunca faça):
- "Sua biblioteca: muito além da estante."
- "Descubra uma nova forma de ler."
- "A solução definitiva para seus livros."

VOZ: primeira pessoa, cena específica com um detalhe concreto (hora, lugar, objeto, nome).
Sem metáfora de vendas, sem adjetivo grandioso, sem frase de resumo no final.
Não invente parentes, nomes próprios, doenças, números de vendas ou resultados.
Se precisar de contexto pessoal, use algo genérico e plausível ("um livro que ganhei", "uma amiga").
O gancho tem que soar como fala, não como título de matéria.

IDIOMA: tudo em português brasileiro falado. As referências em inglês servem só de
estrutura — nunca copie nem adapte a frase em inglês literalmente.

REGRAS DURAS:
- Nunca cite preço, desconto, cupom, "grátis", urgência, "link na bio", "corre".
- Nada de "descubra", "incrível", "revolucionário", "você já imaginou", "não perca".
- Não recite funcionalidades em lista. Mostre uma situação concreta.
- Não repita o nome do produto mais de uma vez (pode ser zero).
- Nada de depoimento inventado, número inventado ou promessa.
- Português falado, frases curtas, sem formalidade.
- O vídeo entrega o que o gancho promete.

DESCRIÇÃO DO POST (campo "caption"): 1 ou 2 frases, até 180 caracteres, em português brasileiro,
escrita pra ser lida por quem só vê o vídeo no feed. Diga em linguagem simples o que acontece no vídeo
e o que a pessoa leva dali. Pode terminar com um convite discreto ("se quiser ver como fica, tá no link da bio").
Sem hashtag, sem emoji, sem preço, sem promessa, sem "descubra". Não repita o gancho palavra por palavra:
a descrição contextualiza o vídeo pra quem chega sem som.

HASHTAGS: 8 a 10, minúsculas, sem "#", sem acento, sem espaço (ex: "traducaodelivros").
Misture: 2 do produto/marca, 4 do nicho específico, 2 a 4 amplas do tema. Nada de hashtag genérica de engajamento
(tipo "fyp", "viral", "paravoce", "explore").

FORMATO DE SAÍDA (JSON puro, sem markdown):
{"hook":"até 8 palavras, concreto, dito no primeiro segundo","voiceover":"45 a 65 palavras, narração corrida, sem marcações. A ÚLTIMA frase do voiceover deve ser o fechamento (ver abaixo)","closing":"fechamento falado, até 10 palavras: um convite discreto ('tá no link da bio'), uma pergunta genuína pra comentar, ou um detalhe que deixe curiosidade. Nunca pressão.","cta":"2 a 4 palavras para o card final, ex: 'link na bio', 'procura no perfil'. Ou null","kicker":"2 a 3 palavras opcionais, ou null","caption":"descrição do post, 1-2 frases, até 180 caracteres","hashtags":["traducaodelivros","livrosemingles","kindle"]}

Diretrizes completas (siga; elas estão em português — aplique o mesmo espírito no idioma de saída):\n${GUIDELINES}`;
}

function promptEN(brand: string, angle: (typeof ANGLES)[number]) {
  return `You write short-form video scripts (TikTok/Reels) in natural English for a regular person posting on their own account. Not an ad.

PRODUCT (real facts, invent nothing beyond this):
${BRIEF_EN[brand] ?? BRIEF_EN.giftsqr}

AUDIENCE CONTEXT:
${DORES_EN[brand] ?? DORES_EN.giftsqr}

MANDATORY NARRATIVE ANGLE: ${angle.hintEn}
ONE single central idea. Do not talk about another benefit.

WHAT ALREADY WORKED AND WHAT WAS REJECTED (learn from it):
${learningBrief(brand)}

GOOD HOOK EXAMPLES (concrete, said by a person):
- "This book has been on my shelf for four years."
- "She opened it and just stared at the screen."
- "I finished a book that doesn't exist in English."
BAD EXAMPLES (never do this):
- "Your library: so much more than a shelf."
- "Discover a new way to read."
- "The definitive solution for your books."

VOICE: first person, a specific scene with one concrete detail (a time, a place, an object, a name).
No sales metaphors, no grand adjectives, no summary sentence at the end.
Do not invent relatives, real names, illnesses, sales numbers or results.
If you need personal context, use something generic and plausible ("a book I was given", "a friend of mine").
The hook must sound spoken, not like a headline.

HARD RULES:
- Never mention price, discount, coupon, "free", urgency, "link in bio", "run".
- No "discover", "unbelievable", "revolutionary", "have you ever imagined", "don't miss".
- Do not list features. Show one concrete situation.
- Do not repeat the product name more than once (zero is fine).
- No invented testimonial, invented number or promise.
- Spoken English, short sentences, contractions, no formality.
- The video delivers what the hook promises.

POST DESCRIPTION (field "caption"): 1 or 2 sentences, max 180 characters, in English,
written for someone who only sees the video in the feed. In plain words, say what happens in the video
and what the viewer takes from it. It may end with a soft invite ("link in bio if you want to see yours").
No hashtag, no emoji, no price, no promise, no "discover". Do not repeat the hook word for word:
the description gives context to someone watching without sound.

HASHTAGS: 8 to 10, lowercase, no "#", no spaces or punctuation (e.g. "booktranslation").
Mix: 2 for the product/brand, 4 for the specific niche, 2 to 4 broad topic tags. No generic engagement
hashtags ("fyp", "viral", "foryou", "explore").

OUTPUT FORMAT (pure JSON, no markdown):
{"hook":"up to 8 words, concrete, said in the first second","voiceover":"45 to 65 words, continuous narration, no markup. The LAST sentence of the voiceover must be the closing (see below)","closing":"spoken closing, up to 10 words: a soft invite ('link in bio'), a genuine question for comments, or a detail that leaves curiosity. Never pressure.","cta":"2 to 4 words for the final card, e.g. 'link in bio', 'check my profile'. Or null","kicker":"2 to 3 optional words, or null","caption":"post description, 1-2 sentences, max 180 characters","hashtags":["booktranslation","booksinenglish","kindle"]}

Full guidelines (follow them; they are written in Portuguese — apply the same spirit to the output language):\n${GUIDELINES}`;
}

function prompt(brand: string, angle: (typeof ANGLES)[number], lang: Lang = "pt") {
  return lang === "en" ? promptEN(brand, angle) : promptPT(brand, angle);
}

async function callModel(model: string, text: string, key: string, lang: Lang = "pt"): Promise<string> {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            lang === "en"
              ? "You are a short-form content writer. Reply with valid JSON only."
              : "Você é roteirista de conteúdo orgânico. Responde somente JSON válido.",
        },
        { role: "user", content: text },
      ],
      temperature: 1.05,
      max_tokens: 900,
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 140)}`);
  const j: any = await r.json();
  const out = j?.choices?.[0]?.message?.content ?? "";
  if (!out) throw new Error("resposta vazia");
  const usage = j?.usage;
  if (usage) logSpend({ provider: "openrouter", model, units: (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0), cost: 0.0004 });
  return out;
}

function parse(out: string) {
  const clean = out.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("sem JSON");
  const j = JSON.parse(clean.slice(start, end + 1));
  const hook = String(j.hook ?? "").trim();
  const voiceover = String(j.voiceover ?? "").trim();
  const cta = j.cta ? String(j.cta).trim() : null;
  const closing = j.closing ? String(j.closing).trim() : null;
  const kicker = j.kicker ? String(j.kicker).trim() : null;
  const caption = j.caption ? String(j.caption).replace(/\s+/g, " ").trim().slice(0, 240) : null;
  const rawTags: unknown[] = Array.isArray(j.hashtags) ? j.hashtags : String(j.hashtags ?? "").split(/[\s,]+/);
  const hashtags = [...new Set(rawTags.map((t) => normalizeTag(String(t))).filter(Boolean) as string[])].slice(0, 12);
  if (hook.length < 6 || voiceover.split(/\s+/).length < 25) throw new Error("roteiro curto demais");
  return {
    hook,
    voiceover,
    closing: closing && closing !== "null" ? closing : null,
    cta: cta && cta !== "null" ? cta : null,
    kicker: kicker && kicker !== "null" ? kicker : null,
    caption: caption && caption !== "null" ? caption : null,
    hashtags,
  };
}

type Parsed = ReturnType<typeof parse>;

async function proofread(parsed: Parsed, model: string, key: string, lang: Lang) {
  const text =
    lang === "en"
      ? `Fix only spelling, agreement and punctuation in the JSON below. Do not change the tone, do not add sentences, do not remove ideas. Keep the same fields, including "caption" and "hashtags". Reply with the corrected JSON only.
${JSON.stringify(parsed)}`
      : `Corrija apenas ortografia, concordância e pontuação do JSON abaixo. Não mude o tom, não adicione frases, não remova ideias. Mantenha os campos "caption" e "hashtags". Responda só o JSON corrigido, mesma estrutura.
${JSON.stringify(parsed)}`;
  const raw = await callModel(model, text, key, lang);
  return parse(raw);
}

export type Written = {
  hook: string;
  voiceover: string;
  closing: string | null;
  cta: string | null;
  kicker: string | null;
  caption: string | null;
  hashtags: string[];
  lang: Lang;
  angle: string;
  source: "llm" | "fallback";
};

const HOOK_OK_PT =
  /(^|\s)(eu|voc[êe]|ele|ela|isso|esse|essa|tem|tinha|era|foi|li|vi|abri|mandei|peguei|descobri|terminei|acabei|nunca|sempre|hoje|ontem|aqui|minha|meu)\b|\?/i;

const HOOK_OK_EN =
  /(^|\s)(i|my|me|she|he|it|this|that|there|was|is|had|got|sent|read|found|finished|never|always|today|yesterday|last|every)\b|\?/i;

export async function writeWithLLM(brand: string, angleId: AngleId, seed: number, lang: Lang = "pt"): Promise<Written | null> {
  const key = getKeys().openrouter;
  if (!key) return null;
  const angle = ANGLES.find((a) => a.id === angleId) ?? ANGLES[0];
  const p = prompt(brand, angle, lang);

  for (const model of MODELOS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await callModel(model, p, key, lang);
        const parsed = parse(raw);
        const joined = `${parsed.hook} ${parsed.voiceover} ${parsed.closing ?? ""} ${parsed.cta ?? ""} ${parsed.kicker ?? ""} ${parsed.caption ?? ""}`;
        const ptWords = (joined.match(/\b(que|não|nao|eu|você|voce|pra|para|de|a|o|um|uma|com|meu|minha|ele|ela|isso|tem|era|foi)\b/gi) ?? []).length;
        const enWords = (joined.match(/\b(the|and|this|that|with|your|book|i|you|it|was|is|my)\b/gi) ?? []).length;
        const langOk = ptWords >= 6 && ptWords > enWords * 2;
        const hookOk = (lang === "en" ? HOOK_OK_EN : HOOK_OK_PT).test(parsed.hook);
        const banned = lang === "en" ? BANIDO_EN.test(joined) || PROIBIDO_EN.test(joined) : BANIDO.test(joined) || PROIBIDO.test(joined);
        if (banned || !hookOk) {
          if (attempt < 2) continue;
          throw new Error("roteiro com termo proibido");
        }
        const fixed = await proofread(parsed, model, key, lang).catch(() => parsed);
        return { ...fixed, lang, angle: angle.id, source: "llm" };
      } catch (e) {
        if (attempt === 1) break;
      }
    }
  }
  return null;
}
