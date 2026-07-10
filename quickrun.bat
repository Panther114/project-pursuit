@echo off
setlocal

set "ROOT=%~dp0"
set "PORT=5173"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = $env:ROOT.TrimEnd('\');" ^
  "$port = [int]$env:PORT;" ^
  "$processes = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -like ('*' + $root + '*') -and ($_.Name -eq 'node.exe' -or $_.Name -eq 'cmd.exe' -or $_.CommandLine -match 'vite --host 127.0.0.1|npm run dev') };" ^
  "foreach ($proc in $processes) { try { Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop } catch {} };" ^
  "$command = 'cd /d \"' + $root + '\" && npm run dev -- --host 127.0.0.1 --strictPort > \"' + $root + '\quickrun.log\" 2>&1';" ^
  "Start-Process -WindowStyle Hidden -FilePath 'cmd.exe' -ArgumentList '/c', $command | Out-Null;" ^
  "for ($i = 0; $i -lt 80; $i++) { if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { break }; Start-Sleep -Milliseconds 500 }" ^
  "; Start-Process ('http://127.0.0.1:' + $port + '/')"

endlocal
