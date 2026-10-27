#!/bin/bash
# Instala o Studio nesta máquina: dependências, build da UI, .env,
# LaunchAgent do servidor e app da barra de menu.
#
#   ./bin/install.sh                # instala tudo
#   ./bin/install.sh --no-menubar   # só o servidor (sem app Swift)
#   ./bin/install.sh --no-agents    # só prepara deps + build (não mexe no launchd)
#   ./bin/install.sh --assets       # baixa também stock/música/sfx/b-roll (~1,5 GB)
#   ./bin/install.sh --dry-run      # mostra o que faria
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

AGENTS="$HOME/Library/LaunchAgents"
LOGS="$HOME/Library/Logs/studio"
SERVER_LABEL="com.studio.server"
MENUBAR_LABEL="com.studio.menubar"
LEGACY_LABELS=("com.sostenes.studio" "com.sostenes.studiobar")

WITH_MENUBAR=1
WITH_AGENTS=1
FETCH_ASSETS=0
DRY=0

for arg in "$@"; do
  case "$arg" in
    --no-menubar) WITH_MENUBAR=0 ;;
    --no-agents) WITH_AGENTS=0 ;;
    --assets) FETCH_ASSETS=1 ;;
    --dry-run) DRY=1 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "opção desconhecida: $arg (use --help)" >&2; exit 1 ;;
  esac
done

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
info() { printf '  %s\n' "$1"; }
warn() { printf '  \033[33m! %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m✕ %s\033[0m\n' "$1" >&2; exit 1; }
run() {
  if [ "$DRY" = 1 ]; then
    printf '  [dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

PORT="${PORT:-4599}"

# ---------------------------------------------------------------- checagens
step "Checando sistema e dependências"

[ "$(uname -s)" = "Darwin" ] || fail "o Studio foi feito para macOS (usa ffmpeg, launchd e o app de barra)."

if ! command -v bun >/dev/null 2>&1; then
  fail "Bun não encontrado. Instale com:
    curl -fsSL https://bun.sh/install | bash
  e abra um terminal novo (ou adicione ~/.bun/bin ao PATH)."
fi
BUN="$(command -v bun)"
info "bun: $BUN ($(bun --version))"

if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    warn "ffmpeg não encontrado — instalando com Homebrew (pode demorar alguns minutos)"
    run brew install ffmpeg
  else
    fail "ffmpeg/ffprobe não encontrados. Instale o Homebrew (https://brew.sh) e rode: brew install ffmpeg"
  fi
else
  info "ffmpeg: $(command -v ffmpeg)"
fi

if [ "$WITH_MENUBAR" = 1 ] && ! command -v swift >/dev/null 2>&1; then
  warn "Swift não encontrado — o app da barra será pulado. Para ter: xcode-select --install"
  WITH_MENUBAR=0
fi

# ---------------------------------------------------------------- deps
step "Instalando dependências (bun install)"
run bun install

# ---------------------------------------------------------------- .env
step "Configuração local (.env)"
if [ -f .env ]; then
  info ".env já existe (não mexi)"
else
  run cp .env.example .env
  run chmod 600 .env
  info ".env criado a partir de .env.example — preencha as chaves depois"
fi

# ---------------------------------------------------------------- build
step "Compilando a interface"
run bun run build
[ -f ui/dist/index.html ] || fail "build da UI não gerou ui/dist/index.html"

if [ ! -f public/fonts/InterTight.ttf ]; then
  fail "fontes de public/fonts/ faltando — o render não funciona sem elas (deveriam estar no repo)."
fi
info "fontes ok"

# ---------------------------------------------------------------- assets
step "Banco de mídia (assets/)"
if [ "$FETCH_ASSETS" = 1 ]; then
  info "baixando stock, música, sfx e b-roll (licenças livres; ~1,5 GB)"
  run bun run scripts/fetch-stock.ts
  run bun run scripts/fetch-music.ts
  run bun run scripts/fetch-sfx.ts
  run bun run scripts/fetch-broll.ts
else
  stock=$({ find assets/stock -maxdepth 2 -type f 2>/dev/null || true; } | wc -l | tr -d ' ')
  if [ "${stock:-0}" -lt 4 ]; then
    warn "assets/stock está vazio: o painel abre, mas gerar vídeo falha (\"sem b-roll\")."
    warn "rode depois: ./bin/install.sh --assets   (ou bun run assets)"
  else
    info "assets/stock com $stock arquivos"
  fi
fi

# ---------------------------------------------------------------- chaves
step "Chaves de API"
MISSING="$(bun -e 'import { getKeys } from "./lib/keys.ts"; const k = getKeys(); const need = ["openrouter","elevenlabs","pexels"]; console.log(need.filter((n) => !k[n]).join(" "))' 2>/dev/null || echo "openrouter elevenlabs pexels")"
if [ -n "${MISSING// /}" ]; then
  warn "sem chave para: ${MISSING// /, }"
  info "cole no painel (aba Créditos) ou preencha o .env — nada disso vai para o git"
else
  info "openrouter, elevenlabs e pexels configuradas"
fi

# ---------------------------------------------------------------- agents
if [ "$WITH_AGENTS" = 0 ]; then
  step "Pronto (sem LaunchAgent)"
  info "rode na mão: bun run dev   → http://localhost:$PORT"
  exit 0
fi

step "Instalando LaunchAgents"
run mkdir -p "$AGENTS" "$LOGS"

# agentes antigos de outra instalação (evita dois servidores/ícones na barra)
for label in "${LEGACY_LABELS[@]}"; do
  if launchctl print "gui/$(id -u)/$label" >/dev/null 2>&1; then
    warn "removendo agente antigo $label"
    run launchctl bootout "gui/$(id -u)/$label" || true
    run rm -f "$AGENTS/$label.plist"
  fi
done

PATH_VALUE="$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SERVER_PLIST="$AGENTS/$SERVER_LABEL.plist"
if [ "$DRY" = 1 ]; then
  printf '  [dry-run] escrever %s\n' "$SERVER_PLIST"
else
  cat > "$SERVER_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$SERVER_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$BUN</string>
    <string>$ROOT/server.ts</string>
  </array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key><string>$PORT</string>
    <key>PATH</key><string>$PATH_VALUE</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOGS/server.log</string>
  <key>StandardErrorPath</key><string>$LOGS/server.err.log</string>
</dict>
</plist>
PLIST
fi
info "servidor: $SERVER_LABEL → http://localhost:$PORT"

if [ "$WITH_MENUBAR" = 1 ]; then
  step "Compilando o app da barra de menu"
  run ./menubar/build.sh

  MENUBAR_PLIST="$AGENTS/$MENUBAR_LABEL.plist"
  if [ "$DRY" = 1 ]; then
    printf '  [dry-run] escrever %s\n' "$MENUBAR_PLIST"
  else
    cat > "$MENUBAR_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$MENUBAR_LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$ROOT/menubar/StudioBar.app/Contents/MacOS/StudioBar</string></array>
  <key>EnvironmentVariables</key>
  <dict><key>STUDIO_URL</key><string>http://localhost:$PORT</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOGS/menubar.log</string>
  <key>StandardErrorPath</key><string>$LOGS/menubar.err.log</string>
</dict>
</plist>
PLIST
  fi
  info "barra de menu: $MENUBAR_LABEL"
fi

step "Ativando"
for label in "$SERVER_LABEL" "$MENUBAR_LABEL"; do
  plist="$AGENTS/$label.plist"
  [ -f "$plist" ] || continue
  run launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  run launchctl bootstrap "gui/$(id -u)" "$plist"
  run launchctl kickstart -k "gui/$(id -u)/$label"
done

if [ "$DRY" = 0 ]; then
  printf '  aguardando o servidor subir'
  ok=0
  for _ in $(seq 1 30); do
    if curl -fsS "http://localhost:$PORT/api/summary" >/dev/null 2>&1; then ok=1; break; fi
    printf '.'
    sleep 1
  done
  printf '\n'
  if [ "$ok" = 1 ]; then
    info "no ar: http://localhost:$PORT"
    run open "http://localhost:$PORT"
  else
    warn "não respondeu em 30s. Veja o log: ~/Library/Logs/studio/server.err.log"
    warn "ou rode ./bin/studio logs"
  fi
fi

step "Pronto"
info "painel:   http://localhost:$PORT"
info "comandos: ./bin/studio start|stop|restart|status|logs|open"
info "logs:     $LOGS"
