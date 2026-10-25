import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../db";
import { getKeys } from "./keys";
import { logSpend } from "./credits";
import { learningBrief } from "./learning";

const GUIDELINES = readFileSync(join(ROOT, "GUIDELINES.md"), "utf8");

export const ANGLES = [
  { id: "descoberta", hint: "encontrou por acaso e testou sem esperar nada" },
  { id: "primeira_pessoa", hint: "demonstração em primeira pessoa, mostrando a tela/arquivo" },
  { id: "cotidiano", hint: "uma situação real do dia a dia que virou problema e como resolveu" },
  { id: "duvida", hint: "responde uma dúvida que muita gente tem sobre o assunto" },
  { id: "opiniao", hint: "opinião específica e justificável, sem atacar ninguém" },
  { id: "comparacao", hint: "compara o caminho antigo com o que passou a fazer" },
  { id: "detalhe", hint: "explica um detalhe pouco conhecido que muda a percepção" },
  { id: "reacao", hint: "reação autêntica ao resultado da primeira tentativa" },
  { id: "bastidor", hint: "mostra o processo por trás, sem editar demais" },
  { id: "historico", hint: "conta um episódio específico com data, lugar ou nome próprio" },
  { id: "objecao_preco", hint: "quebra a objeção de que traduzir/contratar isso sai caro (sem citar número)" },
  { id: "objecao_qualidade", hint: "quebra a objeção de que tradução automática fica horrível — mostra o resultado real" },
] as const;

export type AngleId = (typeof ANGLES)[number]["id"];

const BRIEF: Record<string, string> = {
  giftsqr:
    "Página de presente digital personalizada. A pessoa monta no celular em poucos minutos: fotos, mensagem, música e uma contagem regressiva até a data. Entrega por QR code impresso ou mandando no WhatsApp. Quem recebe abre no celular e vê a página. Funciona em 17 idiomas.",
  tradubook:
    "Envia um PDF ou EPUB e recebe o livro traduzido em português, com capa, sumário, notas e formatação preservadas. O arquivo volta em minutos e dá pra ler no Kindle ou no celular. Tem amostra antes de liberar o livro inteiro.",
};

const DORES: Record<string, string> = {
  giftsqr:
    "dores: dar presente genérico, esquecer a data, não ter tempo de ir atrás, gastar com algo que a pessoa não usa. objeções: 'é só um cartão', 'vai parecer frio', 'não sei mexer'.",
  tradubook:
    "dores: livro parado na estante porque está em inglês, tradução oficial cara, tradução automática travada e sem formatação, Kindle que não traduz o arquivo inteiro. objeções: 'deve custar caro', 'tradução de máquina fica horrível', 'vai perder a formatação'. O vídeo pode quebrar essas objeções mostrando o resultado — sem citar preço, desconto ou condição comercial.",
};

const MODELOS = [
  "deepseek/deepseek-chat-v3.1",
  "google/gemini-2.5-flash",
  "openai/gpt-4o-mini",
];

const BANIDO = /(incr[íi]vel|revolucion|transforme|descubra|segredo|muito al[ée]m|sem sair de casa|na palma da sua m[ãa]o|s[óo] pra voc[êe]|como ter|mudou minha vida|nova leitura|jornada|experi[êe]ncia [úu]nica)/i;

const PROIBIDO = /(R\$|pre[çc]o|desconto|cupom|promo[çc]|gr[áa]tis|gratuit|compre agora|corre que|[úu]ltimas unidades|não perca|imperd[íi]vel|aproveite|por apenas)/i;

function prompt(brand: string, angle: (typeof ANGLES)[number], seed: number) {
  return `Você escreve roteiros de vídeo curto (TikTok/Reels) em português brasileiro para uma pessoa comum publicar no próprio perfil. Nada de anúncio.

PRODUTO (fatos reais, não invente nada além disso):
${BRIEF[brand] ?? BRIEF.giftsqr}

CONTEXTO DO PÚBLICO:
${DORES[brand] ?? DORES.giftsqr}

ÂNGULO NARRATIVO OBRIGATÓRIO: ${angle.hint}
UMA única ideia central. Não fale de outro benefício.

O QUE JÁ FUNCIONOU E O QUE FOI REPROVADO (aprenda com isso):
${learningBrief(brand)}

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

REGRAS DURAS:
- Nunca cite preço, desconto, cupom, "grátis", urgência, "link na bio", "corre".
- Nada de "descubra", "incrível", "revolucionário", "você já imaginou", "não perca".
- Não recite funcionalidades em lista. Mostre uma situação concreta.
- Não repita o nome do produto mais de uma vez (pode ser zero).
- Nada de depoimento inventado, número inventado ou promessa.
- Português falado, frases curtas, sem formalidade.
- O vídeo entrega o que o gancho promete.

FORMATO DE SAÍDA (JSON puro, sem markdown):
{"hook":"até 8 palavras, concreto, dito no primeiro segundo","voiceover":"45 a 65 palavras, narração corrida, sem marcações. A ÚLTIMA frase do voiceover deve ser o fechamento (ver abaixo)","closing":"fechamento falado, até 10 palavras: um convite discreto ('tá no link da bio'), uma pergunta genuína pra comentar, ou um detalhe que deixe curiosidade. Nunca pressão.","cta":"2 a 4 palavras para o card final, ex: 'link na bio', 'procura no perfil'. Ou null","kicker":"2 a 3 palavras opcionais, ou null"}

Diretrizes completas (siga):\n${GUIDELINES}`;
}

async function callModel(model: string, text: string, key: string): Promise<string> {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Você é roteirista de conteúdo orgânico. Responde somente JSON válido." },
        { role: "user", content: text },
      ],
      temperature: 1.05,
      max_tokens: 700,
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
  if (hook.length < 6 || voiceover.split(/\s+/).length < 25) throw new Error("roteiro curto demais");
  return {
    hook,
    voiceover,
    closing: closing && closing !== "null" ? closing : null,
    cta: cta && cta !== "null" ? cta : null,
    kicker: kicker && kicker !== "null" ? kicker : null,
  };
}

async function proofread(
  parsed: { hook: string; voiceover: string; closing: string | null; cta: string | null; kicker: string | null },
  model: string,
  key: string,
) {
  const text = `Corrija apenas ortografia, concordância e pontuação do JSON abaixo. Não mude o tom, não adicione frases, não remova ideias. Responda só o JSON corrigido, mesma estrutura.
${JSON.stringify(parsed)}`;
  const raw = await callModel(model, text, key);
  const out = parse(raw);
  return out;
}

export type Written = {
  hook: string;
  voiceover: string;
  closing: string | null;
  cta: string | null;
  kicker: string | null;
  angle: string;
  source: "llm" | "fallback";
};

export async function writeWithLLM(brand: string, angleId: AngleId, seed: number): Promise<Written | null> {
  const key = getKeys().openrouter;
  if (!key) return null;
  const angle = ANGLES.find((a) => a.id === angleId) ?? ANGLES[0];
  const p = prompt(brand, angle, seed);

  for (const model of MODELOS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await callModel(model, p, key);
        const parsed = parse(raw);
        const joined = `${parsed.hook} ${parsed.voiceover} ${parsed.closing ?? ""} ${parsed.cta ?? ""} ${parsed.kicker ?? ""}`;
        const hookOk = /(^|\s)(eu|voc[êe]|ele|ela|isso|esse|essa|tem|tinha|era|foi|li|vi|abri|mandei|peguei|descobri|terminei|acabei|nunca|sempre|hoje|ontem|aqui|minha|meu)\b|\?/i.test(parsed.hook);
        if (PROIBIDO.test(joined) || BANIDO.test(joined) || !hookOk) {
          if (attempt < 2) continue;
          throw new Error("roteiro com termo proibido");
        }
        const fixed = await proofread(parsed, model, key).catch(() => parsed);
        return { ...fixed, angle: angle.id, source: "llm" };
      } catch (e) {
        if (attempt === 1) break;
      }
    }
  }
  return null;
}
