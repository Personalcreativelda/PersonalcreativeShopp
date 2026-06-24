# Script para iniciar Backend e Frontend simultaneamente
Write-Host "🚀 Iniciando NaturErva ERP..." -ForegroundColor Green
Write-Host ""

# Verificar se node_modules existe no backend
if (-Not (Test-Path "backend/node_modules")) {
    Write-Host "📦 Instalando dependências do backend..." -ForegroundColor Yellow
    Push-Location backend
    npm install
    Pop-Location
    Write-Host ""
}

# Iniciar Backend em nova janela
Write-Host "🔧 Iniciando Backend (porta 3001)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; Write-Host '🔧 BACKEND - NaturErva API' -ForegroundColor Cyan; Write-Host ''; npm start"

# Aguardar 2 segundos para backend iniciar
Start-Sleep -Seconds 2

# Iniciar Frontend em nova janela
Write-Host "⚛️  Iniciando Frontend (porta 3055)..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; Write-Host '⚛️  FRONTEND - NaturErva ERP' -ForegroundColor Blue; Write-Host ''; npm run dev"

Write-Host ""
Write-Host "✅ Servidores iniciados com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Backend:  http://localhost:3001" -ForegroundColor Cyan
Write-Host "📍 Frontend: http://localhost:3055" -ForegroundColor Blue
Write-Host ""
Write-Host "💡 Feche as janelas do PowerShell para parar os servidores" -ForegroundColor Yellow
Write-Host ""
