#!/bin/bash
# ============================================
# CZ Store — Launcher do frontend static server
# Duplo-clique para servir em http://localhost:3030
# ============================================

# Vai para a pasta deste script
cd "$(dirname "$0")"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  CZ Store — Frontend em http://localhost:3030"
echo "═══════════════════════════════════════════════════"
echo ""

# Verifica node
if ! command -v node &> /dev/null; then
  echo "❌ Node.js não encontrado."
  echo "   Instale em: https://nodejs.org/"
  echo ""
  read -p "Pressione ENTER para fechar..."
  exit 1
fi

# Sem npm install — o servidor é zero-dependency
node frontend-server.js
