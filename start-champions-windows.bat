@echo off
chcp 65001 >nul
title 히어로 챔피언스 서버
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [!] Node.js 가 설치되어 있지 않습니다.
  echo      잠시 후 열리는 페이지에서 LTS 버전을 설치한 뒤, 이 파일을 다시 실행하세요.
  echo.
  start "" "https://nodejs.org/ko/download"
  pause
  exit /b 1
)

if not exist "node_modules\ws" (
  echo  필요한 파일을 설치합니다. 잠시만 기다려 주세요...
  call npm install --omit=dev
  if errorlevel 1 (
    echo  [!] 설치에 실패했습니다. 인터넷 연결을 확인하세요.
    pause
    exit /b 1
  )
)

echo  히어로 챔피언스 서버를 시작합니다. 브라우저가 자동으로 열립니다.
echo  게임하는 동안 이 창을 닫지 마세요.
if /i "%~1"=="noopen" (
  node champions\server\index.js
) else (
  node champions\server\index.js --open
)
pause
