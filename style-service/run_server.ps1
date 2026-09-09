$ErrorActionPreference = "Stop"

$serviceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $serviceDir

$python = Get-Command python -ErrorAction SilentlyContinue
if ($null -eq $python) {
    Write-Error "Python을 찾을 수 없습니다. Python 설치 후 다시 실행하세요."
}

Write-Host "Starting FLUX.1-Kontext style service on http://127.0.0.1:8765"
Write-Host "Press Ctrl+C to stop the server."

& $python.Source server.py
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    Write-Host "서버가 오류 코드 $exitCode 로 종료되었습니다." -ForegroundColor Red
    Read-Host "오류 내용을 확인한 뒤 Enter를 누르세요"
}

exit $exitCode
