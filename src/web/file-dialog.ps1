# PowerShell script para abrir dialog de seleção de arquivo - Versão melhorada
param(
    [string]$title = "Selecionar arquivo de banco de dados",
    [string]$filter = "Arquivos de Banco|*.db;*.sqlite;*.sqlite3;*.fdb;*.gdb;*.pdx;*.px|Todos os arquivos|*.*"
)

try {
    # Garantir que a assembly seja carregada
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    
    # Forçar STA thread
    [System.Threading.Thread]::CurrentThread.SetApartmentState([System.Threading.ApartmentState]::STA)

    $fileDialog = New-Object System.Windows.Forms.OpenFileDialog
    $fileDialog.Title = $title
    $fileDialog.Filter = $filter
    $fileDialog.FilterIndex = 1
    $fileDialog.Multiselect = $false
    $fileDialog.CheckFileExists = $true
    $fileDialog.CheckPathExists = $true
    $fileDialog.RestoreDirectory = $true
    $fileDialog.AutoUpgradeEnabled = $true

    # Definir diretório inicial - tentar vários locais
    $initialDirs = @(
        "C:\Users\GIGAINFORMATICA\Desktop",
        "$env:USERPROFILE\Desktop",
        "$env:USERPROFILE\Documents",
        "$env:USERPROFILE",
        "C:\",
        "D:\"
    )

    foreach ($dir in $initialDirs) {
        if (Test-Path $dir) {
            $fileDialog.InitialDirectory = $dir
            break
        }
    }

    # Tentar mostrar o dialog
    $result = $fileDialog.ShowDialog()

    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        Write-Output $fileDialog.FileName
        $fileDialog.Dispose()
        exit 0
    } else {
        Write-Output "CANCELLED"
        $fileDialog.Dispose()
        exit 1
    }

} catch {
    Write-Error "Erro no PowerShell: $($_.Exception.Message)"
    Write-Output "ERROR: $($_.Exception.Message)"
    exit 2
}
