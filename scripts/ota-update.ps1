<#
.SYNOPSIS
  Publica un OTA (eas update) FORZANDO la URL de produccion del backend.

.DESCRIPTION
  PROBLEMA QUE RESUELVE:
  `eas update` NO usa el env del build profile de eas.json. En cambio carga el
  archivo .env local, que tiene la URL de DEV (IP LAN). Eso horneaba la URL de
  dev en el bundle OTA -> los celulares quedaban con "sin conexion a internet"
  hasta reinstalar.

  Este script setea EXPO_PUBLIC_* en el shell ANTES de correr eas update. El env
  del shell tiene mas precedencia que cualquier .env, asi que el OTA SIEMPRE
  sale con la URL de produccion correcta.

  Usalo SIEMPRE para publicar OTA (en vez de `eas update` directo).

.EXAMPLE
  ./scripts/ota-update.ps1 -Message "fix de privacidad en reportes"

.EXAMPLE
  ./scripts/ota-update.ps1 -Message "cambios varios" -Branch production
#>
param(
  [Parameter(Mandatory = $true)] [string] $Message,
  [string] $Branch = "preview"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Forzar PRODUCCION. El shell env pisa el .env local (que tiene la IP de dev).
$env:EXPO_PUBLIC_API_URL    = "https://app.esppapel.com:9443"
$env:EXPO_PUBLIC_SENTRY_DSN = "https://1e3427564e87313e57d9186afb9ddd1d@o4507654786842624.ingest.us.sentry.io/4511487584567296"

Write-Host "==> Publicando OTA en branch '$Branch'" -ForegroundColor Cyan
Write-Host "    API: $env:EXPO_PUBLIC_API_URL" -ForegroundColor Cyan

eas update --branch $Branch --message $Message
if ($LASTEXITCODE -ne 0) { throw "eas update fallo (codigo $LASTEXITCODE)" }

Write-Host ""
Write-Host "[OK] OTA publicado. Los celulares lo bajan al abrir la app." -ForegroundColor Green
Write-Host "     (Puede que tengan que abrirla 2 veces: 1 para bajar, 1 para aplicar.)" -ForegroundColor Green
