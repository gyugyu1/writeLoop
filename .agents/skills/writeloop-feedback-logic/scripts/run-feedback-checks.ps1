param(
    [string]$RepoRoot = "C:\WriteLoop"
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [string]$Command
    )

    Write-Host ""
    Write-Host "==> $Name" -ForegroundColor Cyan
    Push-Location $WorkingDirectory
    try {
        powershell -NoProfile -ExecutionPolicy Bypass -Command $Command
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path $RepoRoot)) {
    throw "Repo root not found: $RepoRoot"
}

Invoke-Step `
    -Name "Backend compile" `
    -WorkingDirectory (Join-Path $RepoRoot "apps\backend") `
    -Command ".\gradlew.bat compileJava"

Invoke-Step `
    -Name "Backend feedback contract tests" `
    -WorkingDirectory (Join-Path $RepoRoot "apps\backend") `
    -Command ".\gradlew.bat test --tests com.writeloop.dto.FeedbackResponseContractTest --tests com.writeloop.service.FeedbackUiComposerTest"

Invoke-Step `
    -Name "Mobile typecheck" `
    -WorkingDirectory (Join-Path $RepoRoot "apps\mobile") `
    -Command "npm.cmd run typecheck"

Invoke-Step `
    -Name "Frontend build" `
    -WorkingDirectory $RepoRoot `
    -Command "npm.cmd run build --workspace @english-learning/frontend"

Write-Host ""
Write-Host "Feedback checks completed." -ForegroundColor Green
