# build_release.ps1

Write-Host "Building Standard Public Release v8.0.0..."
npm run tauri build

if (!(Test-Path "dist-public")) { New-Item -ItemType Directory -Force -Path "dist-public" }
Copy-Item "src-tauri\target\release\bundle\msi\*.msi" -Destination "dist-public\ai-launcher_8.0.0_x64_public.msi" -Force
Copy-Item "src-tauri\target\release\bundle\nsis\*.exe" -Destination "dist-public\ai-launcher_8.0.0_x64_public-setup.exe" -Force -ErrorAction SilentlyContinue

Write-Host "Building Admin Full Local Release v8.0.0..."
$env:VITE_ADMIN_MODE = '1'
npm run tauri build

if (!(Test-Path "dist-admin")) { New-Item -ItemType Directory -Force -Path "dist-admin" }
Copy-Item "src-tauri\target\release\bundle\msi\*.msi" -Destination "dist-admin\ai-launcher_8.0.0_x64_admin.msi" -Force
Copy-Item "src-tauri\target\release\bundle\nsis\*.exe" -Destination "dist-admin\ai-launcher_8.0.0_x64_admin-setup.exe" -Force -ErrorAction SilentlyContinue

Write-Host "Creating GitHub Release v8.0.0..."
git push origin main
gh release create v8.0.0 -t "v8.0.0: Friendly Dashboard" -F CHANGELOG.md "dist-public\*" "dist-admin\*"

Write-Host "Done!"
