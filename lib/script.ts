import { ANGLES, writeWithLLM, type AngleId, type Lang } from "./writer";

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
  lang: Lang;
  /** descrição do post (legenda pra copiar no TikTok/Reels) */
  caption: string;
  /** hashtags sem o "#" */
  hashtags: string[];
};

/* ---------------- banco de reserva (sem preço, sem CTA agressivo) ---------------- */

const CLOSINGS: Record<string, string[]> = {
  giftsqr: [
    "Se quiser ver como fica, tá no link da bio.",
    "O link tá na bio, se quiser testar.",
    "Qual foi o último presente que você guardou?",
  ],
  tradubook: [
    "Tem o link na bio, se quiser ver o seu.",
    "Qual livro da sua estante você nunca conseguiu ler?",
    "Tá no link da bio, a primeira parte é aberta.",
  ],
};

const CLOSINGS_EN: Record<string, string[]> = {
  giftsqr: [
    "Link in bio if you want to see how yours would look.",
    "Link's in the bio if you want to try it.",
    "What's the last gift you actually kept?",
  ],
  tradubook: [
    "Link in bio if you want to see yours.",
    "Which book on your shelf have you never finished?",
    "It's in the bio, the first part is open.",
  ],
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

const FALLBACK_EN: Record<string, { hooks: string[]; voices: string[] }> = {
  giftsqr: {
    hooks: [
      "I gave the wrong gift three Christmases in a row.",
      "She opened it and just stared at the screen.",
      "Her birthday was an hour away and I had nothing.",
      "Some gifts get kept without anyone saying so.",
      "Every year I forget a date. Not this one.",
      "It's not the gift. It's what's inside it.",
    ],
    voices: [
      "Last year I tried something different. I put together a page with our photos, the song that was playing the first time we met and a countdown to the date. I printed the code and taped it inside a card. She opened it on her phone and just sat there scrolling through the photos without saying anything for a while.",
      "I had no idea what to get. So I built it on my phone with the photos already in my camera roll, wrote a message and picked the song. It generated a code, I glued it to the envelope. She opened it on her phone and saw all of it in there.",
      "We always give the same thing and pretend it's different. This time I gathered the photos, wrote down what I never say out loud and added a countdown to the wedding day. All she had to do was point her camera at the code.",
      "My sister lives far away and we barely talk. I built a page with photos of the two of us, a song and a countdown to the day she arrives. I sent the code on WhatsApp. She replied a while later without typing anything, just a voice note of her crying.",
    ],
  },
  tradubook: {
    hooks: [
      "This book has been on my shelf for four years.",
      "I didn't give up on the book. I gave up on the language.",
      "I finished a book that doesn't exist in English.",
      "My grandfather had a shelf I could never read.",
      "The problem was never the book.",
      "There's a whole classic out there you can't read yet.",
    ],
    voices: [
      "I started this book three times and stopped in the first pages, always for the same reason. Then I sent the file and got the whole book back in English, with the table of contents in place and the footnotes preserved. I read it in two nights, on my phone, in line at the bank and on the bus.",
      "My grandfather had a shelf full of books in another language. He read them. I never could. Last week I picked one up, sent the file and came back with the book in English, chapter by chapter. I read the first part for free, then unlocked the rest.",
      "That classic everyone quotes and you never read. It's not about wanting to. It's the language. I sent the file, waited a few minutes and got the whole book back, ready for Kindle, with the formatting of the original.",
      "I tried reading it in the browser translator and gave up on page three. Then I sent the file and the book came back whole, with cover, table of contents and the notes at the bottom. It's not the same as paper, but it was the first time I made it to the end.",
    ],
  },
};

const CAPTIONS: Record<string, Record<Lang, string[]>> = {
  giftsqr: {
    pt: [
      "Montei uma página com nossas fotos, uma música e a contagem até o dia. Ela só apontou a câmera pro código.",
      "Presente que não fica na gaveta: fotos, mensagem e música numa página que abre no celular.",
      "Um QR code no cartão e a pessoa abre as fotos, a música e a contagem regressiva no celular.",
    ],
    en: [
      "I built a page with our photos, a song and a countdown to the day. All she had to do was point her camera at the code.",
      "A gift that doesn't end up in a drawer: photos, a message and a song on a page that opens on any phone.",
      "One QR code inside the card and the person opens the photos, the song and the countdown on their phone.",
    ],
  },
  tradubook: {
    pt: [
      "Mandei o arquivo e o livro voltou inteiro em português, com sumário e notas no lugar. Li em duas noites no celular.",
      "Aquele clássico parado na estante por causa do idioma. Mandei o PDF e li o livro inteiro em português.",
      "Livro em inglês na estante há anos. Mandei o arquivo e recebi a tradução com a formatação original.",
    ],
    en: [
      "I sent the file and got the whole book back in English, with the table of contents and footnotes intact. Two nights on my phone.",
      "That classic sitting on the shelf because of the language. I sent the PDF and read the whole thing in English.",
      "A book in another language, untouched for years. I sent the file and got the translation with the original formatting.",
    ],
  },
};

const TAGS: Record<string, Record<Lang, string[]>> = {
  giftsqr: {
    pt: ["giftsqr", "presentedigital", "presentepersonalizado", "presentecriativo", "qrcode", "fotos", "aniversario", "presente"],
    en: ["giftsqr", "digitalgift", "personalizedgift", "giftideas", "qrcode", "memories", "birthday", "thoughtfulgift"],
  },
  tradubook: {
    pt: ["tradubook", "traducaodelivros", "livrosemingles", "livronopdf", "traducaopdf", "kindle", "leitura", "livros"],
    en: ["tradubook", "booktranslation", "translatedbooks", "booksinenglish", "pdfbook", "kindle", "reading", "books"],
  },
};

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

export function defaultCaption(brand: string, lang: Lang, seed: number): string {
  const bank = CAPTIONS[brand] ?? CAPTIONS.giftsqr;
  return pick(bank[lang] ?? bank.pt, seed);
}

export function defaultHashtags(brand: string, lang: Lang, seed: number): string[] {
  const bank = TAGS[brand] ?? TAGS.giftsqr;
  const all = (bank[lang] ?? bank.pt).slice();
  // rotaciona pra não sair sempre a mesma ordem/combinação
  const k = Math.abs(seed) % all.length;
  return [...all.slice(k), ...all.slice(0, k)];
}

export async function buildScript(
  brand: string,
  format: string,
  seed = Date.now(),
  angle?: AngleId,
  lang: Lang = "pt",
): Promise<Script> {
  const chosenAngle = angle ?? pick(ANGLES as any, seed).id;

  const llm = await writeWithLLM(brand, chosenAngle as AngleId, seed, lang).catch(() => null);
  const pool = lang === "en" ? FALLBACK_EN : FALLBACK;
  const bank = pool[brand] ?? pool.giftsqr;
  const closings = (lang === "en" ? CLOSINGS_EN : CLOSINGS)[brand] ?? (lang === "en" ? CLOSINGS_EN : CLOSINGS).giftsqr;

  const hook = llm?.hook ?? pick(bank.hooks, seed);
  const voiceover = llm?.voiceover ?? pick(bank.voices, seed >> 3);
  const cta = llm ? llm.cta : null;
  const closing = llm ? llm.closing : pick(closings, seed >> 7);
  const kicker = llm ? llm.kicker : null;

  const caption = llm?.caption ?? defaultCaption(brand, lang, seed >> 5);
  const hashtags = llm?.hashtags?.length ? llm.hashtags : defaultHashtags(brand, lang, seed);

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
    lang,
    caption,
    hashtags: hashtags.slice(0, 10),
  };
}

export function makeCaptions(voiceover: string, startSec: number, endSec: number) {
  const words = voiceover.split(/\s+/).filter(Boolean);
  // inglês tem palavras mais curtas por segundo: 3 por bloco funciona nos dois idiomas
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
