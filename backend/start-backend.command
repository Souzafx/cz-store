#!/bin/bash
# ============================================
# CZ Store — Launcher do backend
# Duplo-clique neste arquivo para iniciar o servidor.
# ============================================

# Vai para a pasta deste script (mesmo se chamado de outro lugar)
cd "$(dirname "$0")"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  CZ Store — Iniciando backend Shopee"
echo "═══════════════════════════════════════════════════"
echo ""

# Verifica se node está instalado
if ! command -v node &> /dev/null; then
  echo "❌ Node.js não encontrado."
  echo "   Instale em: https://nodejs.org/"
  echo ""
  read -p "Pressione ENTER para fechar..."
  exit 1
fi

# Instala dependências se ainda não instalou
if [ ! -d "node_modules" ]; then
  echo "📦 Primeira execução — instalando dependências..."
  npm install
  echo ""
fi

# Inicia o servidor
echo "🚀 Iniciando servidor em http://localhost:3000"
echo "   (feche esta janela para parar o servidor)"
echo ""
node server.js
