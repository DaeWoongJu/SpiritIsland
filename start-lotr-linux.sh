#!/bin/bash
# 반지의 제왕 — Linux 실행 스크립트. 시작할 때 자동으로 업데이트를 확인합니다.
main() {
  cd "$(dirname "$0")" || exit 1
  if ! command -v node >/dev/null 2>&1; then
    echo "[!] Node.js 가 필요합니다: https://nodejs.org"
    exit 1
  fi
  curl -s --max-time 1 http://localhost:3400/health >/dev/null 2>&1 || bash scripts/update.sh
  [ -d node_modules/ws ] || npm install --omit=dev || exit 1
  node lotr/server/index.js --open
}
main "$@"
exit
