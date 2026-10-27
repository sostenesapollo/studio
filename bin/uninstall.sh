#!/bin/bash
# Remove os LaunchAgents do Studio. Não apaga código, banco nem vídeos.
#   ./bin/uninstall.sh            # só desativa
#   ./bin/uninstall.sh --purge    # apaga também banco e vídeos renderizados
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

UID_NUM="$(id -u)"
AGENTS="$HOME/Library/LaunchAgents"
LOGS="$HOME/Library/Logs/studio"
LABELS=("com.studio.menubar" "com.studio.server" "com.sostenes.studiobar" "com.sostenes.studio")

for label in "${LABELS[@]}"; do
  if launchctl print "gui/$UID_NUM/$label" >/dev/null 2>&1; then
    launchctl bootout "gui/$UID_NUM/$label" || true
    echo "parado: $label"
  fi
  rm -f "$AGENTS/$label.plist"
done

if [ "${1:-}" = "--purge" ]; then
  rm -f "$ROOT/studio.sqlite" "$ROOT/studio.sqlite-wal" "$ROOT/studio.sqlite-shm"
  echo "banco apagado"
  FILES="${STUDIO_FILES:-$HOME/Movies/studio}"
  if [ -d "$FILES" ]; then
    read -r -p "apagar os vídeos em $FILES? [s/N] " ans
    case "$ans" in
      s|S|y|Y) rm -rf "$FILES"; echo "vídeos apagados" ;;
      *) echo "vídeos mantidos" ;;
    esac
  fi
fi

echo "pronto. código em $ROOT intacto."
