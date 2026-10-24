#requires -Version 5.1
<#
.SYNOPSIS
    Dong goi (zip tu git) va deploy cell-tracker len LXC tren Proxmox.

.DESCRIPTION
    Quy trinh:
      1. Kiem tra working tree sach + version trong package.json da bump (so voi ban dang chay).
      2. Chay smoke test cuc bo (tru khi -SkipTests).
      3. `git archive` HEAD -> dist/cell-tracker-<version>-<timestamp>.zip (loai node_modules,
         test, sample, .env... theo .gitattributes).
      4. scp zip + bin/deploy-release.sh len LXC, roi SSH chay deploy-release.sh
         (cai deps, chuyen symlink, restart systemd, health check, tu rollback neu loi).

    VI DU (chay duoc voi Windows PowerShell 5.1 hoac PowerShell 7):
      powershell -ExecutionPolicy Bypass -File .\deploy\deploy.ps1 -Target root@192.168.1.50
      pwsh ./deploy/deploy.ps1 -Target root@192.168.1.50
      pwsh ./deploy/deploy.ps1 -Target root@192.168.1.50 -SkipTests
      pwsh ./deploy/deploy.ps1 -Target root@192.168.1.50 -AllowDirty
      pwsh ./deploy/deploy.ps1 -Target root@192.168.1.50 -FirstDeploy -SeedDatabase D:\Code\database.sqlite

    LUU Y
      * Khong deploy code chua commit (mac dinh). Commit truoc, hoac dung -AllowDirty
        (khi do zip CHI chua HEAD, khong chua thay doi chua commit).
      * Version phai doi so voi ban dang chay tren server. Dung -AllowSameVersion de bo qua.
      * App phai da duoc cau hinh (deploy/proxmox/bootstrap-app.sh) truoc lan deploy dau.

    LUU Y KY THUAT: file nay co y KHONG dung chu tieng Viet co dau. Parser PowerShell
    coi mot so ky tu Unicode (gach ngang trong D/d, nhay thong minh) la dau ket thuc
    chuoi -> parse loi. Tai lieu co dau nam trong README.md.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Target,                       # vd: root@192.168.1.50

    [switch]$FirstDeploy,                  # chua co release nao tren server
    [string]$SeedDatabase,                 # (FirstDeploy) file .sqlite seed
    [string]$SeedUploads,                  # (FirstDeploy) thu muc uploads de seed

    [switch]$SkipTests,
    [switch]$AllowDirty,
    [switch]$AllowSameVersion,
    [string]$SshKey = "",                  # vd: C:\Users\me\.ssh\proxmox_ed25519
    [string]$KnownHostsFile = "",
    [string]$RepoRoot = ""                 # mac dinh: thu muc cha cua deploy/
)

# $PSScriptRoot KHONG duoc danh gia trong param default khi chay bang
# `powershell -File ...` tren Windows PowerShell 5.1 -> phai tinh sau khi vao script.
if (-not $RepoRoot) {
    if ($PSScriptRoot) { $RepoRoot = Split-Path -Parent $PSScriptRoot }
    elseif ($MyInvocation.MyCommand.Path) { $RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path) }
    else { $RepoRoot = (Get-Location).Path }
}

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Step([string]$msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok([string]$msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Warn2([string]$msg) { Write-Host "    $msg" -ForegroundColor Yellow }

# ---------- SSH/SCP options -------------------------------------------------
$sshCommon = @()
if ($SshKey)         { $sshCommon += @('-i', $SshKey) }
if ($KnownHostsFile) { $sshCommon += @('-o', "UserKnownHostsFile=$KnownHostsFile") }
$sshCommon += @('-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15')

function Invoke-Ssh([string]$Command) {
    & ssh @sshCommon $Target $Command
    if ($LASTEXITCODE -ne 0) { throw "ssh that bai (exit $LASTEXITCODE): $Command" }
}

$APP_ROOT = '/opt/cell-tracker'

# ---------- 0. moi truong ---------------------------------------------------
Step "Kiem tra moi truong"
Push-Location $RepoRoot
try {
    foreach ($bin in 'git', 'ssh', 'scp') {
        if (-not (Get-Command $bin -ErrorAction SilentlyContinue)) { throw "Khong tim thay '$bin' trong PATH" }
    }
    if (-not (Test-Path 'package.json')) { throw "Khong thay package.json trong $RepoRoot" }

    $pkg     = Get-Content 'package.json' -Raw | ConvertFrom-Json
    $version = $pkg.version
    Ok "repo: $RepoRoot"
    Ok "version local: $version"

    $dirty = @(git status --porcelain)
    if ($dirty.Count -gt 0) {
        if ($AllowDirty) {
            Warn2 ("{0} file chua commit - AllowDirty: zip CHI chua HEAD, KHONG gom thay doi chua commit." -f $dirty.Count)
        }
        else {
            $dirty | ForEach-Object { Warn2 "  $_" }
            throw "Working tree con thay doi chua commit. Commit truoc, hoac dung -AllowDirty (chi dong goi HEAD)."
        }
    }
    else { Ok "working tree sach" }

    # ---------- 0b. kiem tra seed TRUOC khi dung toi server -----------------
    # Fail som: tranh truong hop da chep artifact / stop service roi moi bao
    # "khong thay file seed" (da tung xay ra voi D:\Code\database.seed.sqlite).
    if ($FirstDeploy) {
        if ($SeedDatabase) {
            if (-not (Test-Path -LiteralPath $SeedDatabase -PathType Leaf)) {
                $hint = @(
                    "Khong thay file seed: $SeedDatabase",
                    "",
                    "Tao ban sao nhat quan cua DB truoc (KHONG copy file khi app dang chay):",
                    "  sqlite3 `"D:\Code\database.sqlite`" `".backup '$SeedDatabase'`"",
                    "",
                    "Kiem tra:",
                    "  sqlite3 `"$SeedDatabase`" `"PRAGMA integrity_check; SELECT COUNT(*) FROM cells;`"",
                    "",
                    "Neu khong co sqlite3 trong PATH, cai: winget install SQLite.SQLite",
                    "Hoac bo qua seed: chay lai KHONG co -SeedDatabase (DB moi, trang)."
                ) -join "`n"
                throw $hint
            }
            $seedMb = [math]::Round((Get-Item -LiteralPath $SeedDatabase).Length / 1MB, 1)
            if ($seedMb -lt 0.01) { throw "File seed rong (0 MB): $SeedDatabase - tao lai bang lenh .backup o tren." }
            Ok "seed DB: $SeedDatabase ($seedMb MB)"
        }
        else {
            Warn2 "Khong co -SeedDatabase: server se dung DB moi (trong)."
            Warn2 'Muon chuyen du lieu: them -SeedDatabase D:\Code\database.seed.sqlite'
        }
        if ($SeedUploads) {
            if (-not (Test-Path -LiteralPath $SeedUploads -PathType Container)) {
                throw "Khong thay thu muc uploads: $SeedUploads"
            }
            Ok "seed uploads: $SeedUploads"
        }
    }

    # version dang chay tren server
    $remoteVersion = $null
    try {
        $remoteJson = (& ssh @sshCommon $Target "curl -fsS --max-time 5 http://127.0.0.1:3000/api/version" 2>$null) | Out-String
        if ($remoteJson.Trim()) { $remoteVersion = ($remoteJson | ConvertFrom-Json).version }
    }
    catch {
        if ($FirstDeploy) { Warn2 "Server chua tra /api/version (dung neu la lan deploy dau)." }
        else { Warn2 "Khong doc duoc /api/version tren server: $($_.Exception.Message)" }
    }
    if ($remoteVersion) {
        Ok "version tren server: $remoteVersion"
        if ($remoteVersion -eq $version -and -not $AllowSameVersion) {
            Warn2 "Version chua doi so voi ban dang chay."
            Warn2 "Sua 'version' trong package.json + muc CHANGELOG.md, hoac dung -AllowSameVersion."
            throw "Version chua bump ($version)."
        }
    }

    # ---------- 1. smoke test ----------------------------------------------
    if ($SkipTests) { Warn2 "Bo qua smoke test (-SkipTests)" }
    else {
        Step "Smoke test cuc bo (npm run smoke)"
        & npm run smoke
        if ($LASTEXITCODE -ne 0) { throw "npm run smoke that bai (exit $LASTEXITCODE) - dung deploy." }
        Ok "smoke OK"

        # Kiem thu luong nap diem/thanh toan (offline: webhook, chong cong trung,
        # tra thieu, don tre han, chan gia lap o production).
        Step "Verify payments (npm run verify:payments)"
        & npm run verify:payments
        if ($LASTEXITCODE -ne 0) { throw "npm run verify:payments that bai (exit $LASTEXITCODE) - dung deploy." }
        Ok "verify payments OK"
    }

    # ---------- 2. dong goi ------------------------------------------------
    Step "Dong goi tu git HEAD"
    $stamp   = Get-Date -Format 'yyyyMMdd-HHmmss'
    $distDir = Join-Path $RepoRoot 'dist'
    New-Item -ItemType Directory -Force -Path $distDir | Out-Null
    $zipName = "cell-tracker-$version-$stamp.zip"
    $zipPath = Join-Path $distDir $zipName
    $tmpZip  = "$zipPath.partial"

    & git archive --format=zip -o $tmpZip HEAD
    if ($LASTEXITCODE -ne 0) { throw "git archive that bai (exit $LASTEXITCODE)" }
    Move-Item -Force $tmpZip $zipPath
    $sizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
    Ok "$zipPath  ($sizeMb MB)"

    # ---------- 3. day len server ------------------------------------------
    Step "Chep len $Target"
    Invoke-Ssh "mkdir -p $APP_ROOT/incoming $APP_ROOT/bin"
    & scp @sshCommon $zipPath "${Target}:$APP_ROOT/incoming/$zipName"
    if ($LASTEXITCODE -ne 0) { throw "scp zip that bai" }

    $releaseSh = Join-Path $RepoRoot 'bin/deploy-release.sh'
    if (Test-Path $releaseSh) {
        & scp @sshCommon $releaseSh "${Target}:$APP_ROOT/bin/deploy-release.sh"
        if ($LASTEXITCODE -ne 0) { throw "scp deploy-release.sh that bai" }
    }
    $backupSh = Join-Path $RepoRoot 'bin/backup-db.sh'
    if (Test-Path $backupSh) {
        & scp @sshCommon $backupSh "${Target}:$APP_ROOT/bin/backup-db.sh"
    }
    Invoke-Ssh "chmod 755 $APP_ROOT/bin/*.sh 2>/dev/null; true"
    Ok "da chep"

    # ---------- 4. seed du lieu (chi lan dau) ------------------------------
    if ($FirstDeploy) {
        if ($SeedDatabase) {
            Step "Seed CSDL (lan dau): $SeedDatabase"
            & ssh @sshCommon $Target "systemctl stop cell-tracker 2>/dev/null; true"
            & scp @sshCommon $SeedDatabase "${Target}:$APP_ROOT/shared/database.sqlite.upload"
            if ($LASTEXITCODE -ne 0) { throw "scp DB seed that bai" }
            Invoke-Ssh "mv -f $APP_ROOT/shared/database.sqlite.upload $APP_ROOT/shared/database.sqlite && chown celltracker:celltracker $APP_ROOT/shared/database.sqlite && chmod 640 $APP_ROOT/shared/database.sqlite && sqlite3 $APP_ROOT/shared/database.sqlite 'PRAGMA integrity_check;'"
            Ok "DB seed -> shared/database.sqlite"
        }
        if ($SeedUploads) {
            Step "Seed uploads (lan dau): $SeedUploads"
            & scp @sshCommon -r $SeedUploads "${Target}:$APP_ROOT/shared/uploads.incoming"
            if ($LASTEXITCODE -ne 0) { throw "scp uploads that bai" }
            Invoke-Ssh "cp -a $APP_ROOT/shared/uploads.incoming/. $APP_ROOT/shared/uploads/ && rm -rf $APP_ROOT/shared/uploads.incoming && chown -R celltracker:celltracker $APP_ROOT/shared/uploads"
            Ok "uploads -> shared/uploads"
        }
    }

    # ---------- 5. chay deploy tren server ---------------------------------
    Step "Deploy tren server"
    Invoke-Ssh "bash $APP_ROOT/bin/deploy-release.sh $APP_ROOT/incoming/$zipName '$version'"
    Ok "deploy xong: $version"

    # ---------- 6. kiem tra lai --------------------------------------------
    Step "Kiem tra lai"
    $afterJson = (& ssh @sshCommon $Target "curl -fsS --max-time 5 http://127.0.0.1:3000/api/version") | Out-String
    Ok ("server /api/version = " + $afterJson.Trim())
    Warn2 "Kiem tra https://<domain>/ tren trinh duyet. Neu sua public/m/sw.js thi bump CACHE_VERSION."
}
finally {
    Pop-Location
}
