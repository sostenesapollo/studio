import { ANGLES, writeWithLLM, type AngleId } from "./writer";

export type Script = {
  hook: string;
  kicker: string | null;
  voiceover: string;
  cta: string | null;
  closing: string | null;
  trigger: string;
  angle: string;
  template: string;
  particle: string;
  grade: string;
  durationSec: number;
  tags: string[];
};

/* ---------------- banco de reserva (sem preço, sem CTA agressivo) ---------------- */

const CLOSINGS: Record<string, string[]> = {
  giftsqr: ["Se quiser ver como fica, tá no link da bio.", "O link tá na bio, se quiser testar.", "Qual foi o último presente que você guardou?"],
  tradubook: ["Tem o link na bio, se quiser ver o seu.", "Qual livro da sua estante você nunca conseguiu ler?", "Tá no link da bio, a primeira parte é aberta."],
};

const FALLBACK: Record<string, { hooks: string[]; voices: string[] }> = {
  giftsqr: {
    hooks: [
      "Passei três natais dando o presente errado.",
      "Ela abriu e ficou olhando a tela sem falar nada.",
      "Faltava uma hora pro aniversário e eu não tinha nada.",
      "Tem presente que a pessoa guarda sem perceber.",
      "Todo ano eu esqueço uma data. Esse ano não.",
      "Não é o presente. É o que tem dentro dele.",
    ],
    voices: [
      "Ano passado eu tentei fazer algo diferente. Montei uma página com as fotos de vocês, a música que tocou no primeiro encontro e uma contagem até a data. Imprimi o código e colei no cartão. Ela abriu no celular e ficou ali, rolando as fotos, sem falar nada por um tempo.",
      "Eu não sabia o que dar. Aí montei no celular mesmo, com as fotos que estavam no rolo da câmera, escrevi uma mensagem e escolhi a música. O negócio gerou um código, eu colei no envelope. Ela abriu pelo celular e viu tudo lá dentro.",
      "A gente sempre dá a mesma coisa e finge que é diferente. Dessa vez eu juntei as fotos, escrevi o que eu não falo em voz alta e coloquei uma contagem até o dia do casamento. Ela só precisou apontar a câmera pro código.",
      "Minha irmã mora longe e a gente quase não se fala. Montei uma página com as fotos dos dois, uma música e um contador pro dia que ela vem. Mandei o código pelo WhatsApp. Ela respondeu depois de um tempo, sem escrever nada, só com áudio chorando.",
    ],
  },
  tradubook: {
    hooks: [
      "Esse livro está na minha estante há quatro anos.",
      "Eu não desisti do livro. Desisti do idioma.",
      "Terminei um livro que não existe em português.",
      "Meu avô tinha uma estante que eu nunca consegui ler.",
      "O problema nunca foi o livro.",
      "Tem um clássico inteiro que só existe em inglês pra você.",
    ],
    voices: [
      "Eu comecei esse livro três vezes e parei nas primeiras páginas, sempre pelo mesmo motivo. Aí mandei o arquivo e recebi o livro inteiro em português, com o sumário no lugar e as notas preservadas. Li em duas noites, no celular mesmo, na fila do banco e no ônibus.",
      "Meu avô tinha uma estante cheia de livros em inglês. Ele lia. Eu nunca consegui. Semana passada eu peguei um deles, mandei o arquivo e voltei com o livro em português, capítulo por capítulo. Li a primeira parte de graça, depois liberei o resto.",
      "Aquele clássico que todo mundo cita e você nunca leu. Não é falta de vontade. É o idioma. Eu mandei o arquivo, esperei alguns minutos e recebi o livro inteiro em português, pronto pro Kindle, com a formatação igual à do original.",
      "Eu tentei ler no tradutor do navegador e desisti na terceira página. Aí mandei o arquivo e o livro voltou inteiro, com capa, sumário e as notas no rodapé. Não é a mesma coisa que ler no papel, mas foi a primeira vez que eu cheguei até o fim.",
    ],
  },
};

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

export async function buildScript(brand: string, format: string, seed = Date.now(), angle?: AngleId): Promise<Script> {
  const chosenAngle = angle ?? pick(ANGLES as any, seed).id;

  const llm = await writeWithLLM(brand, chosenAngle as AngleId, seed).catch(() => null);
  const bank = FALLBACK[brand] ?? FALLBACK.giftsqr;

  const hook = llm?.hook ?? pick(bank.hooks, seed);
  const voiceover = llm?.voiceover ?? pick(bank.voices, seed >> 3);
  const cta = llm ? llm.cta : null;
  const closing = llm ? llm.closing : pick(CLOSINGS[brand] ?? CLOSINGS.giftsqr, seed >> 7);
  const kicker = llm ? llm.kicker : null;

  return {
    hook,
    kicker,
    voiceover: llm ? voiceover : `${voiceover} ${closing ?? ""}`.trim(),
    cta,
    closing,
    trigger: chosenAngle,
    angle: chosenAngle,
    template: "natural",
    particle: "none",
    grade: "neutral",
    durationSec: format === "avatar" ? 20 : 16,
    tags: [brand, format],
  };
}

export function makeCaptions(voiceover: string, startSec: number, endSec: number) {
  const words = voiceover.split(/\s+/).filter(Boolean);
  const chunks: string[][] = [];
  for (let i = 0; i < words.length; i += 3) chunks.push(words.slice(i, i + 3));
  const span = Math.max(endSec - startSec, 1);
  const per = span / Math.max(chunks.length, 1);
  return chunks.map((c, i) => ({
    text: c.join(" "),
    from: Math.round((startSec + i * per) * 30),
    to: Math.round((startSec + (i + 1) * per - 0.05) * 30),
  }));
}
