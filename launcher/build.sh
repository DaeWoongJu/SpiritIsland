#!/bin/bash
# Windows 실행 아이콘(정령섬.exe, 아르낙.exe, 챔피언스.exe)을 빌드한다. 필요: mingw-w64 (apt install gcc-mingw-w64-x86-64)
set -e
cd "$(dirname "$0")"
LIBS="-lws2_32 -lshell32 -lole32 -luuid -ladvapi32"
x86_64-w64-mingw32-windres -c 65001 launcher.rc -O coff -o launcher.res
x86_64-w64-mingw32-gcc -O2 -s -municode -mwindows -o "../정령섬.exe" launcher.c launcher.res $LIBS
x86_64-w64-mingw32-windres -c 65001 launcher-arnak.rc -O coff -o launcher-arnak.res
x86_64-w64-mingw32-gcc -O2 -s -municode -mwindows -include config-arnak.h -o "../아르낙.exe" launcher.c launcher-arnak.res $LIBS
x86_64-w64-mingw32-windres -c 65001 launcher-champions.rc -O coff -o launcher-champions.res
x86_64-w64-mingw32-gcc -O2 -s -municode -mwindows -include config-champions.h -o "../챔피언스.exe" launcher.c launcher-champions.res $LIBS
rm -f launcher.res launcher-arnak.res launcher-champions.res
echo "빌드 완료: ../정령섬.exe, ../아르낙.exe, ../챔피언스.exe"
