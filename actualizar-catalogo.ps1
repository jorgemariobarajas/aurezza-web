# Genera catalogo.js a partir de los nombres de las fotos en imagenes\joyas.
# Formato del nombre: CATEGORIA - NOMBRE - $PRECIO - DETALLE (el detalle es opcional)
# Uso: clic derecho > "Ejecutar con PowerShell", o desde la terminal: .\actualizar-catalogo.ps1

$carpeta = Join-Path $PSScriptRoot 'imagenes\joyas'
$productos = @()
$omitidos = @()

Get-ChildItem $carpeta -File | Where-Object { $_.Extension -match '^\.(jpe?g|png|webp)$' } | Sort-Object Name | ForEach-Object {
    $partes = $_.BaseName -split '\s+-\s+'
    if ($partes.Count -lt 3) { $omitidos += $_.Name; return }
    $productos += [ordered]@{
        categoria = $partes[0].Trim()
        nombre    = $partes[1].Trim()
        precio    = $partes[2].Trim()
        detalle   = if ($partes.Count -gt 3) { ($partes[3..($partes.Count - 1)] -join ' - ').Trim() } else { '' }
        foto      = 'imagenes/joyas/' + $_.Name
    }
}

$json = ConvertTo-Json -InputObject $productos -Compress
Set-Content -Path (Join-Path $PSScriptRoot 'catalogo.js') -Value "window.CATALOGO = $json;" -Encoding UTF8

Write-Host "Catalogo actualizado: $($productos.Count) productos."
if ($omitidos) { Write-Host "Omitidos (nombre sin el formato esperado):"; $omitidos | ForEach-Object { Write-Host "  $_" } }
