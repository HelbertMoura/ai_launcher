# Code Signing Guide — AI Launcher Pro

This document explains why code signing matters, how to obtain a certificate, how to sign Windows binaries, and how to integrate signing into the release workflow.

## Why Code Signing Matters

### SmartScreen

Windows SmartScreen is a reputation-based filter that warns users when they try to run unsigned or unrecognized applications. For AI Launcher Pro:

- **Unsigned builds**: Users see "Windows protected your PC" with a blue "Run anyway" button hidden behind "More info". Many users abandon the install at this point.
- **Signed builds (no reputation)**: First few hundred downloads still show SmartScreen, but the warning is less scary — it shows the publisher name from the certificate.
- **Signed builds (established reputation)**: After the certificate builds enough reputation (typically 1,000+ downloads over weeks), SmartScreen stops warning entirely.

### User Trust

A digital signature provides:
- **Authenticity**: Users can verify the binary came from DevManiac's / Helbert Moura
- **Integrity**: Any tampering with the binary invalidates the signature
- **Professionalism**: Signed software is taken more seriously by enterprise and power users

### Platform Requirements

- **Winget**: Works without signing, but SmartScreen warnings reduce adoption
- **Chocolatey**: Works without signing, same SmartScreen caveat
- **Enterprise deployment**: Many organizations require signed binaries via Group Policy

## Types of Code Signing Certificates

| Type | Cost (per year) | Validation | Use Case |
|------|----------------|------------|----------|
| OV (Organization Validation) | $200-400/year | Organization identity verified | Standard software distribution |
| EV (Extended Validation) | $400-800/year | Strict organization + individual verification | Highest trust, immediate SmartScreen reputation |

### Recommended Vendors

| Vendor | OV Price | EV Price | Notes |
|--------|----------|----------|-------|
| [Sectigo](https://sectigo.com/ssl-certificates-tls/code-signing) | ~$200/yr | ~$400/yr | Popular, good value |
| [DigiCert](https://www.digicert.com/signing/code-signing-certificates) | ~$400/yr | ~$700/yr | Premium, fastest reputation build |
| [SSL.com](https://www.ssl.com/certificates/code-signing/) | ~$200/yr | ~$400/yr | Good documentation |
| [Certum](https://certum.store/data/code-signing-certificates.html) | ~$150/yr | N/A | Budget option |

### OV vs EV for AI Launcher

For AI Launcher Pro, an **OV certificate** is the recommended starting point:

- OV is sufficient for Winget and Chocolatey
- EV requires a hardware token (USB key) which adds complexity to CI
- OV builds SmartScreen reputation over time through downloads
- EV provides immediate SmartScreen reputation but costs 2-3x more

If the app gains significant enterprise adoption, consider upgrading to EV.

## How to Get a Code Signing Certificate

### Step 1: Prepare Your Identity

You will need:
- Legal business name (or verified personal identity for some vendors)
- Business registration documents (for OV/EV)
- A phone number listed in public business directories
- An email address at your domain (not Gmail/Outlook)

For individual developers without a registered business:
- Some vendors offer Individual Validation certificates (~$100-200/yr)
- Sectigo and Certum are known to support individual developers
- You will need to provide government-issued ID

### Step 2: Purchase and Validate

1. Choose a vendor and purchase the certificate
2. Complete the validation process (1-5 business days for OV, 1-10 for EV)
3. Receive the certificate file (PFX/P12) via secure download or hardware token
4. Store the PFX file and password securely — treat it like a production secret

### Step 3: Export for CI

For use in GitHub Actions:

```powershell
# Convert PFX to base64 for storing as a GitHub secret
$bytes = [System.IO.File]::ReadAllBytes("path\to\code-signing.pfx")
[Convert]::ToBase64String($bytes) | Set-Clipboard
```

Then add two secrets to your GitHub repository:
- `SIGNING_CERT_BASE64`: The base64-encoded PFX
- `SIGNING_CERT_PASSWORD`: The PFX password

## How to Sign with signtool.exe

### Prerequisites

- Windows SDK (includes signtool.exe)
- Code signing certificate (PFX file)

### Locate signtool.exe

```powershell
# Find signtool on your machine
Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin" -Recurse -Filter signtool.exe |
  Where-Object { $_.FullName -like "*x64*" } |
  Select-Object -First 1 -ExpandProperty FullName
```

### Sign a Binary

```powershell
$signtool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"
$certPath = "C:\path\to\code-signing.pfx"
$certPassword = "your-password"

# Sign with SHA256 and timestamp
& $signtool sign `
  /f $certPath `
  /p $certPassword `
  /tr http://timestamp.digicert.com `
  /td sha256 `
  /fd sha256 `
  "path\to\AI-Launcher_15.0.0_x64-setup.exe"
```

### Verify a Signature

```powershell
& $signtool verify /pa "path\to\AI-Launcher_15.0.0_x64-setup.exe"
```

### Sign All Release Artifacts

```powershell
$artifacts = Get-ChildItem -Path "src-tauri\target\release\bundle" -Recurse -Include *.msi,*-setup.exe

foreach ($artifact in $artifacts) {
  & $signtool sign /f $certPath /p $certPassword /tr http://timestamp.digicert.com /td sha256 /fd sha256 $artifact.FullName
  Write-Host "Signed: $($artifact.FullName)" -ForegroundColor Green
}
```

## Integration with the Release Workflow

The existing `.github/workflows/release.yml` already has signing support (opt-in). Here is how it works:

### Current Setup (Opt-in)

The workflow checks if `SIGNING_CERT_BASE64` secret exists. If it does, it signs the binaries before uploading:

```yaml
- name: Sign binaries (opt-in)
  if: env.SIGNING_CERT_BASE64 != ''
  env:
    SIGNING_CERT_BASE64: ${{ secrets.SIGNING_CERT_BASE64 }}
    SIGNING_CERT_PASSWORD: ${{ secrets.SIGNING_CERT_PASSWORD }}
  shell: pwsh
  run: |
    $certBytes = [Convert]::FromBase64String($env:SIGNING_CERT_BASE64)
    $certPath = "$env:RUNNER_TEMP\code-signing.pfx"
    [IO.File]::WriteAllBytes($certPath, $certBytes)
    $signtool = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin" -Recurse -Filter signtool.exe |
      Where-Object { $_.FullName -like "*x64*" } | Select-Object -First 1
    Get-ChildItem -Path src-tauri/target/release/bundle -Recurse -Include *.msi,*-setup.exe | ForEach-Object {
      & $signtool.FullName sign /f $certPath /p $env:SIGNING_CERT_PASSWORD /tr http://timestamp.digicert.com /td sha256 /fd sha256 $_.FullName
    }
```

### To Activate Signing

1. Obtain a code signing certificate (PFX)
2. Base64-encode it and add as `SIGNING_CERT_BASE64` secret
3. Add the certificate password as `SIGNING_CERT_PASSWORD` secret
4. Push a new tag — the workflow will automatically sign the binaries

### Recommended Workflow Enhancement

For production-grade signing, consider adding verification:

```yaml
- name: Verify signatures
  if: env.SIGNING_CERT_BASE64 != ''
  shell: pwsh
  run: |
    $signtool = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin" -Recurse -Filter signtool.exe |
      Where-Object { $_.FullName -like "*x64*" } | Select-Object -First 1
    Get-ChildItem -Path src-tauri/target/release/bundle -Recurse -Include *.msi,*-setup.exe | ForEach-Object {
      $result = & $signtool.FullName verify /pa $_.FullName 2>&1
      if ($LASTEXITCODE -ne 0) {
        Write-Error "Signature verification failed for $($_.FullName)"
        Write-Error $result
        exit 1
      }
      Write-Host "Verified: $($_.FullName)" -ForegroundColor Green
    }
```

## Timestamp Servers

When signing, always include a timestamp. This ensures the signature remains valid even after the certificate expires.

| Provider | URL |
|----------|-----|
| DigiCert | `http://timestamp.digicert.com` |
| Sectigo | `http://timestamp.sectigo.com` |
| GlobalSign | `http://timestamp.globalsign.com` |
| Microsoft | `http://timestamp.acs.microsoft.com` |

DigiCert is recommended for reliability and wide recognition.

## Cost Estimates

### Year 1 (Getting Started)

| Item | Cost |
|------|------|
| OV Code Signing Certificate | $200-400 |
| Total | **$200-400/year** |

### Year 2+ (Established)

| Item | Cost |
|------|------|
| OV Certificate Renewal | $200-400/year |
| Total | **$200-400/year** |

### Enterprise Tier (Optional)

| Item | Cost |
|------|------|
| EV Code Signing Certificate | $400-800/year |
| USB Hardware Token (required for EV) | ~$50-100 (one-time) |
| Total | **$450-900/year** |

## Security Best Practices

1. **Never commit the PFX file** to the repository — always use secrets
2. **Rotate the password** when team members with access leave
3. **Use hardware tokens** for EV certificates (required by CA/Browser Forum)
4. **Enable GitHub Environment protection** on the release workflow to require approval before signing
5. **Audit signing events** — track who triggered signed releases and when
6. **Back up the certificate** to a secure offline location (encrypted USB or password manager)

## Troubleshooting

### SmartScreen Still Warns After Signing

This is normal for new certificates. SmartScreen requires reputation to be built through:
- Sufficient downloads over time
- Reports from Windows Defender telemetry
- No malware flags from antivirus engines

Workarounds:
- Submit to Microsoft for review: https://www.microsoft.com/en-us/wdsi/filesubmission
- Distribute via Winget/Chocolatey (Microsoft-trusted channels)
- Encourage users to click "Run anyway" and report the app as safe

### signtool.exe Not Found

Install the Windows SDK:
- Visual Studio Installer -> Windows SDK (latest)
- Or standalone: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/

### Certificate Expired

OV certificates are valid for 1-3 years. Before expiry:
1. Renew with your vendor (usually discounted for renewals)
2. Update the GitHub secret with the new PFX
3. Old signatures remain valid (thanks to timestamps)

## Summary

| Step | Status |
|------|--------|
| Manifests for Winget | Ready in `dist/winget/` |
| Manifests for Chocolatey | Ready in `dist/chocolatey/` |
| CI signing support | Built into `release.yml` (opt-in) |
| Code signing certificate | Pending purchase |
| SmartScreen reputation | Builds after signing + distribution |

Next steps: purchase an OV certificate, configure the GitHub secrets, and push a signed release.
