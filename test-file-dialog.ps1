Add-Type -AssemblyName System.Windows.Forms

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = "Teste Seletor de Arquivo"
$dialog.Filter = "SQLite Files (*.db *.sqlite *.sqlite3)|*.db;*.sqlite;*.sqlite3|All Files (*.*)|*.*"
$dialog.FilterIndex = 1
$dialog.InitialDirectory = [Environment]::GetFolderPath('Desktop')

$result = $dialog.ShowDialog()

if ($result -eq 'OK') {
    Write-Output "SUCESSO: $($dialog.FileName)"
} else {
    Write-Output "CANCELADO"
}
