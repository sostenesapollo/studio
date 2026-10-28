#!/bin/bash
# Compila o app da barra de menu (StudioBar.app) dentro de menubar/.
# Não instala LaunchAgent: isso é feito por ../bin/install.sh.
set -euo pipefail
cd "$(dirname "$0")"

APP="StudioBar.app"

if ! command -v swift >/dev/null 2>&1; then
  echo "Swift não encontrado. Instale as Command Line Tools: xcode-select --install" >&2
  exit 1
fi

swift build -c release

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp .build/release/StudioBar "$APP/Contents/MacOS/StudioBar"

if [ ! -f assets/AppIcon.icns ]; then
  swift tools/make-icons.swift
fi
cp assets/AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>StudioBar</string>
  <key>CFBundleIdentifier</key><string>com.studio.menubar</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleExecutable</key><string>StudioBar</string>
  <key>CFBundleDisplayName</key><string>StudioBar</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSUIElement</key><true/>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

# assinatura ad-hoc: suficiente para rodar na máquina local
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true

echo "app: $PWD/$APP"
