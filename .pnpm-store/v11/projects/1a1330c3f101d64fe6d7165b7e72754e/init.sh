#!/usr/bin/env bash
# Baseline Fase 0 — instalar deps y smoke build (desde ibarra-app/).
set -euo pipefail
cd "$(dirname "$0")"

echo "==> npm install"
npm install --legacy-peer-deps

echo "==> ng build (development)"
npm run build

echo "==> Baseline OK"
