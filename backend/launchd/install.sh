#!/bin/bash
# ============================================
# Instala o backend CZ Store como LaunchAgent
# para iniciar automaticamente no login do macOS.
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PLIST_NAME="com.czstore.backend.plist"
PLIST_SRC="$SCRIPT_DIR/$PLIST_NAME"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  CZ Store — Instalação do LaunchAgent"
echo "═══════════════════════════════════════════════════"
echo ""

# Verifica node
if ! command -v node &> /dev/null; then
  echo "❌ Node.js não encontrado. Instale em: https://nodejs.org/"
  exit 1
fi

NODE_PATH="$(command -v node)"
echo "✓ Node encontrado: $NODE_PATH"
echo "✓ Projeto: $PROJECT_DIR"

# Instala dependências se não estão instaladas
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  echo ""
  echo "📦 Instalando dependências..."
  (cd "$PROJECT_DIR" && npm install)
fi

# Cria dir LaunchAgents se não existir
mkdir -p "$HOME/Library/LaunchAgents"

# Descarrega versão antiga se houver
if [ -f "$PLIST_DEST" ]; then
  echo "♻️  Descarregando versão anterior..."
  launchctl unload "$PLIST_DEST" 2>/dev/null || true
fi

# Gera plist com paths corretos
echo "📝 Gerando plist em: $PLIST_DEST"
sed -e "s|__NODE_PATH__|$NODE_PATH|g" \
    -e "s|__PROJECT_PATH__|$PROJECT_DIR|g" \
    "$PLIST_SRC" > "$PLIST_DEST"

# Carrega
launchctl load "$PLIST_DEST"

# Valida
sleep 1
if launchctl list | grep -q "com.czstore.backend"; then
  echo ""
  echo "✅ LaunchAgent instalado e rodando!"
  echo ""
  echo "   Status:    launchctl list | grep czstore"
  echo "   Logs:      tail -f $PROJECT_DIR/logs/\$(date +%Y-%m-%d).log"
  echo "   Parar:     launchctl unload $PLIST_DEST"
  echo "   Remover:   $SCRIPT_DIR/uninstall.sh"
  echo ""
  echo "   Testar:    curl http://localhost:3000/health"
  echo ""
else
  echo "❌ Falha ao carregar o LaunchAgent. Veja os logs acima."
  exit 1
fi
