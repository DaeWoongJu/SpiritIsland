# 정령섬·아르낙·챔피언스 자동 업데이트: GitHub 에 새 버전이 있으면 내려받아 게임 폴더를 갱신한다.
# 정령섬.exe / 아르낙.exe / 챔피언스.exe 가 서버를 켜기 전에 실행한다. 실패해도 게임은 현재 버전으로 실행된다.
param([switch]$Force)
$ErrorActionPreference = 'Stop'
$repo = 'DaeWoongJu/SpiritIsland'
$root = Split-Path -Parent $PSScriptRoot
$branchFile = Join-Path $root 'UPDATE_BRANCH'
$branch = if (Test-Path $branchFile) { (Get-Content $branchFile -Raw).Trim() } else { 'main' }
$verFile = Join-Path $root '.version'
$Host.UI.RawUI.WindowTitle = '업데이트 확인 (정령섬 · 아르낙)'
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Write-Host ' 새 버전이 있는지 확인하는 중...'
  $info = Invoke-RestMethod "https://api.github.com/repos/$repo/commits/$branch" -Headers @{ 'User-Agent' = 'SpiritIsland-Updater' } -TimeoutSec 10
  $sha = $info.sha
  $current = if (Test-Path $verFile) { (Get-Content $verFile -Raw).Trim() } else { '' }
  if (-not $Force -and $current -eq $sha) { Write-Host ' 최신 버전입니다.'; exit 0 }
  Write-Host ' 새 버전을 내려받는 중... (잠시만 기다려 주세요)' -ForegroundColor Yellow
  $tmp = Join-Path $env:TEMP 'spiritisland-update'
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  New-Item -ItemType Directory $tmp | Out-Null
  $zip = Join-Path $tmp 'update.zip'
  Invoke-WebRequest "https://codeload.github.com/$repo/zip/refs/heads/$branch" -OutFile $zip -UseBasicParsing -TimeoutSec 120
  Expand-Archive $zip -DestinationPath $tmp -Force
  $src = Get-ChildItem $tmp -Directory | Select-Object -First 1
  # 실행 중인 exe 는 덮어쓸 수 없으므로 이름을 바꿔 둔다 (정령섬.exe, 아르낙.exe)
  $exes = @('정령섬.exe', '아르낙.exe', '챔피언스.exe')
  foreach ($name in $exes) {
    $exe = Join-Path $root $name
    $old = Join-Path $root "$name.old"
    if (Test-Path $old) { Remove-Item $old -Force -ErrorAction SilentlyContinue }
    if (Test-Path $exe) { Rename-Item $exe "$name.old" -ErrorAction SilentlyContinue }
  }
  robocopy $src.FullName $root /E /R:1 /W:1 /XD node_modules .git /XF .shortcut-created .shortcut-created-arnak .shortcut-created-champions .version /NFL /NDL /NJH /NJS /NP | Out-Null
  foreach ($name in $exes) {
    $exe = Join-Path $root $name
    $old = Join-Path $root "$name.old"
    if (-not (Test-Path $exe) -and (Test-Path $old)) { Rename-Item $old $name }
  }
  Set-Content $verFile $sha
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host ' 업데이트 완료! 필요한 파일을 설치합니다...' -ForegroundColor Green
  Push-Location $root
  & npm install --omit=dev --no-audit --no-fund
  Pop-Location
  Write-Host ' 새 버전으로 실행합니다.' -ForegroundColor Green
} catch {
  Write-Host " 업데이트하지 못했습니다 (인터넷 연결 확인). 현재 버전으로 실행합니다." -ForegroundColor DarkYellow
  Write-Host " $($_.Exception.Message)" -ForegroundColor DarkGray
  Start-Sleep -Seconds 2
}
exit 0
