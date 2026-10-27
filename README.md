# Studio

Fábrica local de vídeos verticais (9:16). Você escreve o tema, ele escreve o roteiro,
gera a voz, monta as legendas, escolhe b-roll e trilha, renderiza com Remotion + ffmpeg
e entrega o `.mp4` pronto pra postar — com título, descrição e hashtags.

Roda na sua máquina. Nada de fila em nuvem. As únicas chamadas externas são as APIs
que você configurar (roteiro, voz, banco de imagens).

---

## Requisitos

| O quê | Por quê | Como ter |
|---|---|---|
| macOS 13+ | servidor, notificações e app da barra | — |
| [Bun](https://bun.sh) 1.2+ | roda o servidor, o banco e os scripts | `curl -fsSL https://bun.sh/install \| bash` |
| ffmpeg + ffprobe | cortar, montar, normalizar áudio | `brew install ffmpeg` |
| Swift (opcional) | compilar o app da barra de menu | `xcode-select --install` |

O Chrome do Remotion (~150 MB) é baixado sozinho no primeiro render.

## Instalação

```bash
git clone https://github.com/sostenesapollo/studio.git
cd studio
./bin/install.sh
```

O instalador, em ordem:

1. confere Bun e ffmpeg (instala o ffmpeg pelo Homebrew se faltar);
2. roda `bun install`;
3. cria `.env` a partir do `.env.example` (permissão 600);
4. compila a interface (`ui/dist`);
5. mostra quais chaves de API ainda faltam;
6. registra os LaunchAgents `com.studio.server` (porta 4599) e `com.studio.menubar`;
7. compila e abre o app da barra;
8. espera o servidor responder e abre `http://localhost:4599`.

Opções:

```bash
./bin/install.sh --no-menubar   # sem app de barra (só servidor)
./bin/install.sh --no-agents    # só dependências + build (não mexe no launchd)
./bin/install.sh --assets       # baixa também stock, música, sfx e b-roll (~1,5 GB)
./bin/install.sh --dry-run      # mostra o que faria
```

Prefere na mão? Dá no mesmo:

```bash
bun install
bun run build
bun run dev        # http://localhost:4599
```

## Chaves de API

**Nenhuma chave vai para o git.** O `.gitignore` cobre `.env` e o banco; o painel
grava as chaves fora do repo, em `~/.config/studio/keys.json` (mode 600).

| Provedor | Serve para | Obrigatória? |
|---|---|---|
| OpenRouter | roteiro, título, descrição, hashtags | sim, para gerar |
| ElevenLabs | narração | sim, para gerar com voz |
| Pexels | b-roll vertical | sim, para `fetch-pexels` |
| kie.ai | formato avatar (Kling) | opcional |
| MagmaRouter | LLM alternativo | opcional |
| Gemini | reservado, não usado hoje | opcional |

Três formas de configurar (a última vence):

1. **Aba Créditos** do painel — cola e salva em `~/.config/studio/keys.json`.
2. **`.env` na raiz** — copie o `.env.example` e preencha; o Bun carrega sozinho.

   ```bash
   cp .env.example .env && chmod 600 .env
   ```

3. **Arquivos em `~/.config/...`** (compatível com instalações antigas):
   `~/.config/studio/keys.json`, `~/.config/openrouter/api_key`,
   `~/.config/vsl/{elevenlabs,pexels}`.

Confira o que está configurado sem expor valor: `./bin/studio status` ou a aba **Créditos**.

## Banco de mídia

O repo **não** traz mídia (ficaria com gigabytes). Baixe uma vez:

```bash
bun run assets        # stock + música + sfx + b-roll (~1,5 GB, licenças livres)
```

| Pasta | Conteúdo | Vem de |
|---|---|---|
| `assets/stock/<marca>/` | b-roll vertical | Mixkit / Pexels |
| `assets/music/` | 36 trilhas | Mixkit + Internet Archive (CC) |
| `assets/sfx/` | whoosh, pop, click, paper, riser, ui | Mixkit |
| `assets/demo/<marca>/<idioma>/` | telas reais do site (formato `demo`) | `bun run scripts/shots.ts` |
| `assets/voices/` | cache de narração | gerado pelo próprio app |
| `assets/overlay/` | frames do render | gerado e podável |

Sem `assets/stock` o painel abre, mas gerar falha com *"sem b-roll"*.

## O que dá para fazer no painel

| Aba | O que faz |
|---|---|
| **Vídeos** | grade com thumb, player, arrastar/baixar, ✓/✕ de aprovação, motivo da reprovação, marcar postado, apagar, ajustar e re-renderizar |
| **Gerar** | marca + formato + template + partícula + quantidade + idioma + hook |
| **Referências** | coleta vídeos em inglês que performaram, extrai transcript e resume o padrão (hook, primeiro frame, beats, tom) |
| **Créditos** | saldo por provedor, gasto do dia/mês, teto, alerta de saldo baixo, recarga |
| **Marcas** | cria marca nova (slug, cor, CTA) |

### Templates (7)

`bold` condensada gigante · `premium` centralizado · `editorial` serifa + grão ·
`punch` uma palavra por vez · `split` tela dividida (produto em cima) ·
`letterbox` 4:5 com barras · `bar` faixa colorida.

Cada template tem fonte, grade, partícula, transição e trilha próprias. `Aleatório`
sorteia por vídeo.

### Feedback que ensina o gerador

- ✓ / ✕ em cada card + campo "por que não gostei" (fica no banco, não em arquivo solto).
- `lib/learning.ts` resume aprovados e reprovados (gancho + ângulo + template + motivo);
  `lib/writer.ts` injeta isso no prompt das próximas gerações.
- `GET /api/learning?brand=<slug>` mostra exatamente o que está sendo usado.

### Conteúdo

- **Roteiro**: LLM (DeepSeek/Gemini via OpenRouter) seguindo `GUIDELINES.md`, com 12
  ângulos narrativos e revisão ortográfica. Sem LLM, cai no banco local (`lib/script.ts`).
- **Idioma**: `pt` ou `en` — vale para roteiro, voz, legendas queimadas, título,
  descrição, hashtags e textos do mock.
- **Voz**: ElevenLabs, rotacionada por seed e filtrada por idioma, normalizada a -16 LUFS.
- **Trilha**: escolhida pelo mood da marca, sem repetir as 8 últimas, com offset aleatório.
- **Efeitos**: pop na abertura, whoosh nas transições, paper na prova, ui/riser no fecho.
- **Mock do produto**: HTML em `renderer/ProductMock.tsx`.
- **Duração**: acompanha a narração (20–34 s).

## App da barra de menu

`menubar/` (Swift, AppKit) mostra os vídeos novos, o que está renderizando e os alertas
de saldo. Dá para copiar título/descrição/hashtags, marcar como postado, apagar e
arrastar o `.mp4` direto para o Finder.

```bash
./menubar/build.sh     # gera menubar/StudioBar.app
```

O `bin/install.sh` já compila e registra. O app conversa com
`http://localhost:4599`; para outra porta, defina `STUDIO_URL` no LaunchAgent
ou rode `STUDIO_URL=http://localhost:4700 ./menubar/StudioBar.app/Contents/MacOS/StudioBar`.

## Comandos

```bash
./bin/studio start|stop|restart|status|logs|open|dev
./bin/studio dev       # roda em primeiro plano (melhor para ver erro)
./bin/uninstall.sh     # remove os LaunchAgents (--purge apaga banco e vídeos)
```

Scripts do projeto:

```bash
bun run scripts/fetch-stock.ts         # b-roll Mixkit
bun run scripts/fetch-pexels.ts [n]    # b-roll vertical 1080p por tema (precisa de chave)
bun run scripts/fetch-music.ts         # trilhas CC (Internet Archive)
bun run scripts/fetch-music-mixkit.ts  # trilhas Mixkit por mood
bun run scripts/fetch-sfx.ts           # efeitos sonoros
bun run scripts/shots.ts               # telas reais do site para o formato demo
bun run scripts/rerender.ts <id>       # remonta um vídeo com os assets atuais
bun run scripts/backfill-copy.ts       # descrição + hashtags nos vídeos antigos
```

## Onde ficam as coisas

| O quê | Caminho |
|---|---|
| Vídeos | `~/Movies/studio/<marca>/<data>/*.mp4` (+ `.json` do projeto) |
| Thumbs | `~/Movies/studio/thumbs/` |
| Banco | `studio.sqlite` na raiz do repo |
| Chaves | `~/.config/studio/keys.json` |
| Logs | `~/Library/Logs/studio/` |

Dá para mudar sem editar código: `STUDIO_FILES=~/Videos/studio` (saída) e
`STUDIO_DB=/caminho/studio.sqlite` (banco). O repo pode morar em qualquer pasta.

## Estrutura do código

```
server.ts        Bun.serve + fila de jobs + API (porta 4599, sem framework)
db.ts            schema sqlite, seed de marcas, caminhos (ROOT/FILES/ASSETS)
lib/
  pipeline.ts    orquestra: roteiro → voz → b-roll → overlay → ffmpeg
  writer.ts      LLM + GUIDELINES.md + learning/swipe no prompt
  voice.ts       ElevenLabs + cache + normalização
  overlay.ts     Remotion: bundle e renderFrames
  media.ts       ffmpeg/ffprobe, montagem, legendas, thumbs
  templates.ts   7 templates (fonte, grade, partícula, transição)
  sfx.ts         sound design
  refs.ts        swipe file (YouTube/transcript/LLM)
  credits.ts     saldo por provedor
  keys.ts        leitura de chaves (env, keys.json, ~/.config)
ui/              React + Vite (o build sai em ui/dist, servido pelo server.ts)
renderer/        composições Remotion
menubar/         app Swift da barra de menu
bin/             install.sh, uninstall.sh, studio (CLI)
GUIDELINES.md    diretrizes de conteúdo injetadas em todo roteiro
```

## Problemas comuns

**"build a UI com bun run build"** — falta `ui/dist`. Rode `bun run build`.

**"sem b-roll em assets/stock"** — falta o banco de mídia: `bun run assets`.

**Primeiro render demora** — o Remotion baixa o Chrome headless na primeira vez
(`~/Library/Caches/remotion/`). Depois é rápido.

**Porta ocupada** — outro processo em 4599. `PORT=4700 ./bin/studio dev` (e ajuste
`STUDIO_URL` do app da barra).

**Nada abre depois do login** — `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.studio.server.plist`
ou `./bin/studio start`. Logs em `~/Library/Logs/studio/server.err.log`.

**Vídeo sai com 404 do site** — o formato `demo` grava telas reais; se a página mudou,
refaça `bun run scripts/shots.ts`.

## Custo aproximado

Cada vídeo consome alguns milhares de caracteres de ElevenLabs e uma chamada de LLM.
O painel mostra o gasto do dia/mês e avisa quando o saldo cai abaixo do teto
(padrão US$ 1). O render em si é local e não custa nada.

## Licenças

Código do projeto: uso pessoal do autor. Fontes em `public/fonts/` são OFL
(Inter Tight, Instrument Serif). Mídia baixada pelos scripts segue a licença da fonte
(Mixkit, Pexels, Internet Archive CC) — confira antes de usar comercialmente.
