#!/bin/bash
# 정령섬 온라인 — Linux 실행 스크립트
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "[!] Node.js 가 필요합니다: https://nodejs.org"
  exit 1
fi
[ -d node_modules/ws ] || npm install --omit=dev || exit 1
node server/index.js --open
