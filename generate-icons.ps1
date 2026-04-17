# AI Launcher Icon Generator
# Run this script to generate icon files for the Tauri app

Add-Type -AssemblyName System.Drawing

$scriptRoot = $PSScriptRoot
if (-not $scriptRoot) { $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
$iconDir = Join-Path $scriptRoot "src-tauri\icons"
$svgPath = "$iconDir\icon.svg"

# Create a simple icon programmatically
function New-AppIcon {
    param([int]$Size)
    
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    
    # Background gradient (simplified to solid)
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(139, 30, 42))
    $graphics.FillRectangle($bgBrush, 0, 0, $Size, $Size)
    
    # Hexagon outline
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(232, 232, 232), [Math]::Max(2, $Size / 32))
    $points = @()
    $cx = $Size / 2
    $cy = $Size / 2
    $radius = $Size * 0.4
    
    for ($i = 0; $i -lt 6; $i++) {
        $angle = [Math]::PI / 3 * $i - [Math]::PI / 2
        $x = $cx + $radius * [Math]::Cos($angle)
        $y = $cy + $radius * [Math]::Sin($angle)
        $points += New-Object System.Drawing.PointF($x, $y)
    }
    
    $graphics.DrawPolygon($pen, $points)
    
    # Text "AI"
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(232, 232, 232))
    $fontSize = [Math]::Max(8, $Size / 4)
    $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF(0, 0, $Size, $Size)
    $graphics.DrawString("AI", $font, $textBrush, $rect, $sf)
    
    # Bottom dot
    $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(232, 232, 232))
    $dotSize = [Math]::Max(2, $Size / 16)
    $graphics.FillEllipse($dotBrush, $cx - $dotSize/2, $Size * 0.72, $dotSize, $dotSize)
    
    $graphics.Dispose()
    return $bitmap
}

# Generate PNGs
# Note: icon.png at 1024x1024 is the source used by `npx tauri icon` to repack
# the multi-res ICO for Windows bundling.
@(
    @{Size = 32; Name = "32x32.png"},
    @{Size = 128; Name = "128x128.png"},
    @{Size = 256; Name = "128x128@2x.png"},
    @{Size = 1024; Name = "icon.png"}
) | ForEach-Object {
    $icon = New-AppIcon -Size $_.Size
    $icon.Save("$iconDir\$($_.Name)", [System.Drawing.Imaging.ImageFormat]::Png)
    $icon.Dispose()
    Write-Host "Created $($_.Name)"
}

# For ICO file, we'll create a simple one
$ico32 = New-AppIcon -Size 32
$ico128 = New-AppIcon -Size 128
$ico256 = New-AppIcon -Size 256

# Save as ICO (simplified - just use 256px PNG)
$ico256.Save("$iconDir\icon.ico", [System.Drawing.Imaging.ImageFormat]::Png)
$ico32.Dispose()
$ico128.Dispose()
$ico256.Dispose()

Write-Host "Created icon.ico (256x256 PNG format)"
Write-Host ""
Write-Host "Icon generation complete!"
Write-Host ""
Write-Host "Note: For production, use a proper ICO multi-resolution file."
Write-Host "You can convert the PNGs to ICO using:"
Write-Host "  - https://icoconvert.com/"
Write-Host "  - Or ImageMagick: magick convert *.png icon.ico"
