# Studio

Fábrica local de vídeos verticais para giftsqr / tradubook (ou qualquer marca).
Render com Remotion + ffmpeg, na sua máquina. Voz via ElevenLabs, B-roll Pexels/Mixkit.

```
bun install
bun run build     # compila a UI
bun run dev       # http://localhost:4599
```

Servidor e menu bar já rodam como LaunchAgents:
`com.sostenes.studio` (porta 4599) e `com.sostenes.studiobar` (bolinha na barra).

## Abas

| Aba | O que faz |
|---|---|
| **Vídeos** | grade com thumb, player, arrastar/baixar, ✓/✕ de aprovação, campo "por que não gostei", marcar postado, apagar, ajustar e re-renderizar |
| **Gerar** | marca + formato + template + partícula + quantidade + hook |
| **Créditos** | saldo por provedor, gasto do dia/mês, teto, alerta de saldo baixo, botão de recarga |
| **Marcas** | cria marca nova (slug, cor, CTA) |

## Templates (7)

`bold` condensada gigante · `premium` centralizado · `editorial` serifa + grão ·
`punch` uma palavra por vez · `split` tela dividida (produto em cima) ·
`letterbox` 4:5 com barras · `bar` faixa colorida.

Escolha no Gerar; `Aleatório` sorteia por vídeo. Cada template tem fonte, grade,
partícula, transição e trilha próprias.

## Feedback que ensina o gerador

- Cada vídeo tem ✓ (gostei) e ✕ (não gostei) no card, e um campo de motivo no player.
- `~/.config` não: fica no banco (`videos.rating`, `videos.feedback_note`).
- `lib/learning.ts` monta um resumo dos aprovados e reprovados (gancho + ângulo +
  template + motivo) e o `lib/writer.ts` injeta no prompt das próximas gerações.
- `GET /api/learning?brand=tradubook` mostra exatamente o que está sendo usado.

## Diretrizes

`GUIDELINES.md` é lido a cada geração e injetado no prompt. Mudou o tom desejado?
Edita o arquivo — vale para todos os vídeos seguintes.

Regras extras que vieram do feedback: fala no primeiro segundo (sem silêncio),
fechamento falado + card final (link na bio / pergunta), quebra de objeção
(caro / tradução ruim), prova visual (original x português), sem preço.

## Conteúdo

- **Roteiro**: gerado por LLM (DeepSeek/Gemini via OpenRouter) seguindo `GUIDELINES.md`,
  com 12 ângulos narrativos e revisão ortográfica. Sem LLM, cai no banco local.
- **Hooks**: banco de reserva sem preço em `lib/script.ts`.
- **Idioma**: `pt` ou `en` (aba Gerar: português / inglês / os dois — alterna por vídeo).
  O idioma vale para tudo: roteiro, voz, legendas queimadas, título, descrição, hashtags
  e os textos do mock do produto. Banco de reserva em inglês em `lib/script.ts`.
- **Título, descrição e hashtags**: cada vídeo grava `title` (o hook falado), `caption`
  (legenda do post, 1-2 frases) e `hashtags` (8-10, sem `#`), no idioma do vídeo.
  Aparecem prontos pra copiar no StudioBar (clique copia) e no modal do vídeo.
  `bun run scripts/backfill-copy.ts` preenche os vídeos antigos.
- **Voz**: ElevenLabs, rotacionada por seed e filtrada por idioma
  (`pt-voices.json` / `en-voices.json`); áudio normalizado a -16 LUFS.
- **Trilha**: 36 faixas (Mixkit + Internet Archive), escolhidas por mood da marca,
  sem repetir nenhuma das últimas 8 usadas, com offset aleatório no arquivo e volume por template.
- **Mock do produto**: página de livro traduzida (tradubook) ou tela do presente (giftsqr)
  desenhada em HTML — `renderer/ProductMock.tsx`.
- **Duração**: acompanha a narração (20-34s).

## Arquivos

- Vídeos: `~/Movies/studio/<marca>/<data>/vNNN-<template>-<formato>.mp4` (+ `.json` do projeto)
- Thumbs: `~/Movies/studio/thumbs/`
- Banco: `~/dev/studio/studio.sqlite`
- B-roll: `assets/stock/<marca>/` · Demo: `assets/demo/<marca>/` · Música: `assets/music/`
- Frames do overlay: `assets/overlay/<id>/`

## Scripts

```
bun run scripts/fetch-pexels.ts [n]   # B-roll vertical 1080p por tema
bun run scripts/fetch-stock.ts        # Mixkit
bun run scripts/fetch-music.ts        # trilhas CC (Internet Archive)
bun run scripts/fetch-music-mixkit.ts # trilhas Mixkit por mood (upbeat, funk, cinematic...)
bun run scripts/shots.ts              # telas reais do site (formato demo)
bun run scripts/backfill-copy.ts      # descrição + hashtags nos vídeos antigos (--dry pra simular)
```

## Créditos

Chaves: `~/.config/studio/keys.json`, com fallback em `~/.config/vsl/{elevenlabs,pexels}`
e `~/.config/{openrouter,magmarouter}/api_key`.

| Provedor | Saldo | Recarga |
|---|---|---|
| OpenRouter | API | openrouter.ai/settings/credits |
| MagmaRouter | manual (sem endpoint público) | magmarouter.com/topup |
| kie.ai | API `chat/credit` | kie.ai/billing |
| ElevenLabs | API `user/subscription` | elevenlabs.io/subscription |

Alerta: saldo ≤ US$ 1 (ajustável) → card vermelho + notificação macOS a cada 6h.

## Pendente

- Formato **avatar** (pessoa falando): precisa de chave kie.ai (Kling Avatar 2.0 ~US$ 0,08/s).
- Post automático: fora de escopo por escolha (post manual).
