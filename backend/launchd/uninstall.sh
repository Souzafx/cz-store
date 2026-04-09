#!/bin/bash
# Remove o LaunchAgent CZ Store.

PLIST_DEST="$HOME/Library/LaunchAgents/com.czstore.backend.plist"

if [ -f "$PLIST_DEST" ]; then
  echo "♻️  Descarregando LaunchAgent..."
  launchctl unload "$PLIST_DEST" 2>/dev/null || true
  rm -f "$PLIST_DEST"
  echo "✅ LaunchAgent removido."
else
  echo "ℹ️  LaunchAgent não estava instalado."
fi
