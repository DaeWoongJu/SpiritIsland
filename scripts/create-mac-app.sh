#!/bin/bash
# ~/Applications/정령섬.app 을 만들어 Launchpad/Dock 에서 아이콘으로 실행할 수 있게 한다.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$HOME/Applications/정령섬.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cat > "$APP/Contents/MacOS/run" <<RUN
#!/bin/bash
open -a Terminal "$ROOT/start-mac.command"
RUN
chmod +x "$APP/Contents/MacOS/run"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>정령섬</string>
  <key>CFBundleExecutable</key><string>run</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundleIdentifier</key><string>local.spiritisland.online</string>
  <key>CFBundlePackageType</key><string>APPL</string>
</dict></plist>
PLIST
TMP="$(mktemp -d)/icon.iconset"
mkdir -p "$TMP"
for s in 16 32 64 128 256 512; do
  sips -z $s $s "$ROOT/public/icons/icon-512.png" --out "$TMP/icon_${s}x${s}.png" >/dev/null
done
cp "$TMP/icon_32x32.png" "$TMP/icon_16x16@2x.png"
cp "$TMP/icon_64x64.png" "$TMP/icon_32x32@2x.png"
cp "$TMP/icon_256x256.png" "$TMP/icon_128x128@2x.png"
cp "$TMP/icon_512x512.png" "$TMP/icon_256x256@2x.png"
rm "$TMP/icon_64x64.png"
iconutil -c icns "$TMP" -o "$APP/Contents/Resources/icon.icns"
touch "$APP"
echo "완료: $APP 를 만들었습니다. Launchpad 또는 Finder > 응용 프로그램에서 '정령섬'을 실행하거나 Dock 으로 끌어다 놓으세요."
