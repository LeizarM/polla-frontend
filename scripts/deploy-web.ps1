<#
.SYNOPSIS
  Build del frontend web (Expo export) + upload al servidor que lo sirve con
  nginx en https://app.esppapel.com:9443/

.DESCRIPTION
  1. Genera dist/ con EXPO_PUBLIC_API_URL apuntando al backend.
  2. Limpia la carpeta remota y sube el dist/ nuevo.
  3. (Opcional) reinicia nginx la primera vez (-RestartNginx).

  Requiere: OpenSSH (ssh.exe / scp.exe en Windows 10+), acceso por llave.

.EXAMPLE
  # Primera vez (sube + reinicia nginx para tomar el nuevo mount):
  ./scripts/deploy-web.ps1 -ServerIp 200.105.10.20 -SshPort 22 -RestartNginx

  # Updates siguientes (solo reemplaza archivos):
  ./scripts/deploy-web.ps1 -ServerIp 200.105.10.20 -SshPort 22
#>
param(
  [Parameter(Mandatory = $true)] [string] $ServerIp,
  [Parameter(Mandatory = $true)] [int]    $SshPort,
  [string] $SshUser   = "deploy",
  [string] $RemoteDir = "/opt/mundial2026/frontend-dist",
  [string] $ApiUrl    = "https://app.esppapel.com:9443",
  [switch] $RestartNginx,
  [switch] $SkipBuild
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# 1. Build
if (-not $SkipBuild) {
  Write-Host "==> Building web export (API: $ApiUrl)..." -ForegroundColor Cyan
  $env:EXPO_PUBLIC_API_URL = $ApiUrl
  npx expo export --platform web
  if ($LASTEXITCODE -ne 0) { throw "expo export fallo" }
}

if (-not (Test-Path "$root\dist\index.html")) {
  throw "No se encontro dist/index.html. El build no genero el frontend."
}

$dest = "$SshUser@${ServerIp}:$RemoteDir"

# 2. Limpiar remoto + subir
Write-Host "==> Preparando carpeta remota $RemoteDir ..." -ForegroundColor Cyan
ssh -p $SshPort "$SshUser@$ServerIp" "mkdir -p $RemoteDir && find $RemoteDir -mindepth 1 -delete"
if ($LASTEXITCODE -ne 0) { throw "No se pudo preparar la carpeta remota (revisa SSH)" }

Write-Host "==> Subiendo dist/ ..." -ForegroundColor Cyan
scp -P $SshPort -r "$root\dist\*" $dest
if ($LASTEXITCODE -ne 0) { throw "scp fallo" }

# 3. (Opcional) reiniciar nginx
if ($RestartNginx) {
  Write-Host "==> Reiniciando nginx ..." -ForegroundColor Cyan
  ssh -p $SshPort "$SshUser@$ServerIp" "cd /opt/mundial2026 && docker compose -f docker-compose.prod.yml --env-file .env.prod up -d nginx"
}

Write-Host ""
Write-Host "[OK] Frontend desplegado en $ApiUrl/" -ForegroundColor Green
Write-Host "     Verifica: $ApiUrl/  y  $ApiUrl/admin" -ForegroundColor Green
