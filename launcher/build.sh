#!/bin/bash
# Windows 실행 아이콘(정령섬.exe)을 빌드한다. 필요: mingw-w64 (apt install gcc-mingw-w64-x86-64)
set -e
cd "$(dirname "$0")"
x86_64-w64-mingw32-windres -c 65001 launcher.rc -O coff -o launcher.res
x86_64-w64-mingw32-gcc -O2 -s -municode -mwindows -o "../정령섬.exe" launcher.c launcher.res -lws2_32 -lshell32 -lole32 -luuid
rm -f launcher.res
echo "빌드 완료: ../정령섬.exe"
