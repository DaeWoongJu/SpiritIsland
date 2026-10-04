#!/bin/bash
# 정령섬·아르낙 자동 업데이트 (macOS / Linux). 실패해도 현재 버전으로 계속한다.
main() {
  local ROOT REPO BRANCH SHA CUR TMP SRC
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  REPO='DaeWoongJu/SpiritIsland'
  BRANCH="$(cat "$ROOT/UPDATE_BRANCH" 2>/dev/null || echo main)"
  echo " 새 버전이 있는지 확인하는 중..."
  SHA="$(curl -fsSL --max-time 10 "https://api.github.com/repos/$REPO/commits/$BRANCH" 2>/dev/null | grep -m1 '"sha"' | sed 's/.*"sha": *"\([0-9a-f]*\)".*/\1/')" || true
  [ -z "$SHA" ] && { echo " 업데이트 확인 실패 — 현재 버전으로 실행합니다."; return 0; }
  CUR="$(cat "$ROOT/.version" 2>/dev/null)"
  [ "$1" != "--force" ] && [ "$CUR" = "$SHA" ] && { echo " 최신 버전입니다."; return 0; }
  echo " 새 버전을 내려받는 중..."
  TMP="$(mktemp -d)"
  curl -fsSL --max-time 120 "https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH" | tar -xz -C "$TMP" || { echo " 내려받기 실패 — 현재 버전으로 실행합니다."; return 0; }
  SRC="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -1)"
  (cd "$SRC" && tar --exclude=node_modules --exclude=.git -cf - .) | (cd "$ROOT" && tar -xf -)
  echo "$SHA" > "$ROOT/.version"
  rm -rf "$TMP"
  chmod +x "$ROOT"/start-*.sh "$ROOT"/start-*.command "$ROOT"/scripts/*.sh 2>/dev/null
  echo " 업데이트 완료! 필요한 파일을 설치합니다..."
  (cd "$ROOT" && npm install --omit=dev --no-audit --no-fund)
}
main "$@"
exit 0
