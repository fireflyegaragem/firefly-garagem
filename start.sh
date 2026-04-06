#!/bin/bash
# Mini Garagem CMS - Script de inicialização

echo ""
echo "🏎️  Mini Garagem CMS"
echo "─────────────────────────────────"

cd "$(dirname "$0")/backend"

# Instala dependências se necessário
if [ ! -d "node_modules" ]; then
  echo "📦 Instalando dependências..."
  npm install
fi

echo "🚀 Iniciando servidor..."
echo ""
node server.js
