# Teste do Seletor de Arquivos - Multiplas abordagens
Write-Host "==============================================="
Write-Host "    TESTE DO SELETOR DE ARQUIVOS"
Write-Host "==============================================="
Write-Host ""

# Teste 1: PowerShell direto
Write-Host "Teste 1: PowerShell Script Direto"
Write-Host "   Executando: src\web\file-dialog.ps1"

try {
    $result1 = & "src\web\file-dialog.ps1" -title "Teste Direto" -filter "SQLite Files (*.db *.sqlite *.sqlite3)|*.db;*.sqlite;*.sqlite3|All Files (*.*)|*.*"
    Write-Host "   Sucesso - Resultado: $result1"
} catch {
    Write-Host "   Erro: $($_.Exception.Message)"
}

Write-Host ""

# Teste 3: Verificar se arquivo existe
Write-Host "Teste 2: Verificacao de Arquivos"
$scriptPath = "src\web\file-dialog.ps1"
if (Test-Path $scriptPath) {
    Write-Host "   Sucesso - Script PowerShell existe: $scriptPath"
    $scriptContent = Get-Content $scriptPath -TotalCount 5
    Write-Host "   Primeiras linhas do script:"
    $scriptContent | ForEach-Object { Write-Host "      $_" }
} else {
    Write-Host "   Erro - Script PowerShell NAO existe: $scriptPath"
}

Write-Host ""

# Teste 4: Testar permissões
Write-Host "Teste 3: Teste de Permissoes PowerShell"
try {
    $policy = Get-ExecutionPolicy
    Write-Host "   Politica atual: $policy"
    
    if ($policy -eq "Restricted") {
        Write-Host "   AVISO: Politica Restricted pode bloquear scripts"
        Write-Host "   Sugestao: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser"
    } else {
        Write-Host "   Sucesso - Politica permite execucao de scripts"
    }
} catch {
    Write-Host "   Erro ao verificar politica: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Teste concluido!"
Write-Host "=============================================="
