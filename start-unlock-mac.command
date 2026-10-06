#!/bin/bash
# 언락! 방탈출 — macOS 실행 파일 (더블클릭). 시작할 때 자동으로 업데이트를 확인합니다.
main() {
  cd "$(dirname "$0")" || exit 1
  if ! command -v node >/dev/null 2>&1; then
    echo ""
    echo " [!] Node.js 가 설치되어 있지 않습니다. 열리는 페이지에서 LTS 버전을 설치한 뒤 다시 실행하세요."
    open "https://nodejs.org/ko/download"
    read -r -p " 엔터를 누르면 창이 닫힙니다..."
    exit 1
  fi
  if ! curl -s --max-time 1 http://localhost:3500/health >/dev/null 2>&1; then
    bash scripts/update.sh
  fi
  if [ ! -d node_modules/ws ]; then
    echo " 필요한 파일을 설치합니다..."
    npm install --omit=dev || { read -r -p " 설치 실패. 엔터를 누르세요..."; exit 1; }
  fi
  echo " 언락! 방탈출 서버를 시작합니다. 게임하는 동안 이 창을 닫지 마세요."
  node unlock/server/index.js --open
}
main "$@"
exit
