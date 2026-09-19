# Template — preenchido por scripts/gen-package-manifests.mjs.
# Instala o instalador NSIS do release em modo silencioso (/S).
$ErrorActionPreference = 'Stop'

$packageName  = 'ai-launcher'
$url          = '{{INSTALLER_URL}}'
$checksum     = '{{SHA256}}'
$checksumType = 'sha256'

Install-ChocolateyPackage `
  -PackageName $packageName `
  -FileType 'exe' `
  -SilentArgs '/S' `
  -Url $url `
  -Checksum $checksum `
  -ChecksumType $checksumType
