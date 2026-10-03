# 바탕화면과 시작 메뉴에 "정령섬" 바로가기(아이콘)를 만든다.
$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $root '정령섬.exe'
if (-not (Test-Path $target)) { $target = Join-Path $root 'start-windows.bat' }
$icon = Join-Path $root 'public\icons\icon.ico'
$shell = New-Object -ComObject WScript.Shell
$places = @(
  [Environment]::GetFolderPath('Desktop'),
  [Environment]::GetFolderPath('Programs')
)
foreach ($dir in $places) {
  $lnk = $shell.CreateShortcut((Join-Path $dir '정령섬.lnk'))
  $lnk.TargetPath = $target
  $lnk.WorkingDirectory = $root
  $lnk.IconLocation = "$icon,0"
  $lnk.Description = '정령섬 온라인 서버를 켜고 게임을 엽니다'
  $lnk.Save()
}
Write-Host ''
Write-Host ' 바탕화면과 시작 메뉴에 "정령섬" 아이콘을 만들었습니다.' -ForegroundColor Green
Write-Host ' 이제 아이콘을 더블클릭하면 서버가 켜지고 게임이 열립니다.'
