$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$venv = Join-Path $root ".venv-ytm"

if (-not (Test-Path (Join-Path $venv "Scripts\python.exe"))) {
  Write-Host "[ytmusic] creating virtual environment in .venv-ytm" -ForegroundColor Cyan
  py -m venv $venv
  & (Join-Path $venv "Scripts\python.exe") -m pip install --upgrade pip -q
  & (Join-Path $venv "Scripts\python.exe") -m pip install -r (Join-Path $PSScriptRoot "requirements.txt") -q
}

& (Join-Path $venv "Scripts\python.exe") (Join-Path $PSScriptRoot "server.py")
