$p = (Get-NetTCPConnection -LocalPort 3000 -State Listen).OwningProcess
if ($p) { Stop-Process -Id $p -Force }
Write-Output done