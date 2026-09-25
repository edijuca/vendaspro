#!/bin/bash
set -e

PROJECT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT"

echo "======================================="
echo " VendasPRO - Iniciando Ambiente"
echo "======================================="
echo ""

echo "[1/2] Iniciando Backend (porta 3001)..."
echo ""
npx tsx watch server/index.ts &

BACKEND_PID=$!
sleep 3

echo "[2/2] Iniciando Frontend (porta 5173)..."
echo ""
npx vite --port=5173 --host=0.0.0.0 &

FRONTEND_PID=$!

echo ""
echo "======================================="
echo " Ambiente iniciado!"
echo " Backend:  http://localhost:3001"
echo " Frontend: http://localhost:5173"
echo "======================================="
echo ""
echo "Para parar: kill $BACKEND_PID $FRONTEND_PID"
echo ""

wait
