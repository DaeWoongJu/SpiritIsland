#!/bin/bash
# 앱 메뉴와 바탕화면에 정령섬 아이콘을 만든다.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$HOME/.local/share/applications/spirit-island.desktop"
mkdir -p "$(dirname "$FILE")"
cat > "$FILE" <<DESK
[Desktop Entry]
Type=Application
Name=정령섬
Comment=정령섬 온라인 서버를 켜고 게임을 엽니다
Exec=bash "$ROOT/start-linux.sh"
Icon=$ROOT/public/icons/icon-512.png
Terminal=true
Categories=Game;
DESK
chmod +x "$FILE"
DESKTOP="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
[ -d "$DESKTOP" ] && cp "$FILE" "$DESKTOP/" && chmod +x "$DESKTOP/spirit-island.desktop"
echo "완료: 앱 메뉴(와 바탕화면)에 '정령섬' 아이콘을 만들었습니다."
