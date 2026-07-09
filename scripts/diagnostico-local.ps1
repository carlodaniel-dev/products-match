$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Diagnostico local de Proveedor IA" -ForegroundColor Cyan
Write-Host "Carpeta actual: $(Get-Location)"

if (-not (Test-Path -LiteralPath "package.json")) {
    Write-Host ""
    Write-Host "No se encontro package.json en esta carpeta." -ForegroundColor Red
    Write-Host "Abre la terminal de VSCode dentro de la carpeta del proyecto y vuelve a ejecutar:"
    Write-Host "npm run diagnostico" -ForegroundColor Yellow
    exit 1
}

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js: NO encontrado" -ForegroundColor Red
    Write-Host "Instala Node.js 20 o superior desde https://nodejs.org"
    exit 1
}

$nodeVersion = (& node.exe --version).Trim()
Write-Host "Node.js: $nodeVersion" -ForegroundColor Green

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    Write-Host "npm: NO encontrado" -ForegroundColor Red
    exit 1
}

$npmVersion = (& npm.cmd --version).Trim()
Write-Host "npm: $npmVersion" -ForegroundColor Green

if (Test-Path -LiteralPath ".env.local") {
    $envContent = Get-Content -Raw -LiteralPath ".env.local"
    if ($envContent -match "(?m)^OPENAI_API_KEY=sk-[^\s]+$") {
        Write-Host ".env.local: API key encontrada" -ForegroundColor Green
    }
    else {
        Write-Host ".env.local: existe, pero no se ve OPENAI_API_KEY valida" -ForegroundColor Yellow
    }
}
else {
    Write-Host ".env.local: NO existe" -ForegroundColor Yellow
    Write-Host "Si el .bat ya funciono, revisa que VSCode este abierto en esta misma carpeta."
}

if (Test-Path -LiteralPath "node_modules") {
    Write-Host "node_modules: encontrado" -ForegroundColor Green
}
else {
    Write-Host "node_modules: NO encontrado. Ejecuta npm install" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Para correrlo desde VSCode usa:" -ForegroundColor Cyan
Write-Host "npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "No uses npm start para desarrollo, porque requiere haber ejecutado npm run build antes."
