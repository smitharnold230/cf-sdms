#!/usr/bin/env pwsh

# Production Secrets Management Script
# Generates secure secrets and sets them in Cloudflare Workers

param(
    [Parameter(Mandatory=$false)]
    [switch]$Generate = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$Set = $false,
    
    [Parameter(Mandatory=$false)]
    [string]$Environment = "production"
)

function Generate-SecretKey {
    param([int]$Length = 32)
    
    $bytes = New-Object byte[] $Length
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    
    return [Convert]::ToBase64String($bytes)
}

function Generate-Password {
    param([int]$Length = 16)
    
    $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
    $password = ""
    
    for ($i = 0; $i -lt $Length; $i++) {
        $password += $chars[(Get-Random -Maximum $chars.Length)]
    }
    
    return $password
}

Write-Host "🔐 SDMS Production Secrets Management" -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Yellow

if ($Generate) {
    Write-Host ""
    Write-Host "🎲 Generating Secure Secrets..." -ForegroundColor Blue
    
    $jwtSecret = Generate-SecretKey -Length 32
    $adminPassword = Generate-Password -Length 20
    
    Write-Host ""
    Write-Host "Generated Secrets:" -ForegroundColor Yellow
    Write-Host "==================" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "JWT_SECRET:" -ForegroundColor Cyan
    Write-Host $jwtSecret -ForegroundColor White
    Write-Host ""
    
    Write-Host "ADMIN_PASSWORD (for database seed):" -ForegroundColor Cyan
    Write-Host $adminPassword -ForegroundColor White
    Write-Host ""
    
    Write-Host "⚠️  IMPORTANT: Save these secrets securely!" -ForegroundColor Red
    Write-Host "⚠️  These will not be displayed again!" -ForegroundColor Red
    Write-Host ""
    
    # Save to secure file
    $secretsFile = ".secrets-$Environment.txt"
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    @"
SDMS Production Secrets - Generated: $timestamp
============================================

JWT_SECRET=$jwtSecret
ADMIN_PASSWORD=$adminPassword

External Service Keys (set manually):
====================================
SENDGRID_API_KEY=your-sendgrid-key-here
TWILIO_ACCOUNT_SID=your-twilio-sid-here
TWILIO_AUTH_TOKEN=your-twilio-token-here
VIRUS_SCAN_API_KEY=your-virustotal-key-here

Instructions:
=============
1. Run: ./scripts/secrets.ps1 -Set
2. Update admin password in database
3. Delete this file after use
4. Set external service keys manually

"@ | Out-File -FilePath $secretsFile -Encoding UTF8
    
    Write-Host "📄 Secrets saved to: $secretsFile" -ForegroundColor Green
    Write-Host "🗑️  Remember to delete this file after use!" -ForegroundColor Yellow
}

if ($Set) {
    Write-Host ""
    Write-Host "⬆️  Setting Secrets in Cloudflare Workers..." -ForegroundColor Blue
    
    $secretsFile = ".secrets-$Environment.txt"
    
    if (-not (Test-Path $secretsFile)) {
        Write-Error "Secrets file not found: $secretsFile"
        Write-Host "Run with -Generate flag first to create secrets"
        exit 1
    }
    
    $secrets = @{
        "JWT_SECRET" = "Required for authentication"
        "SENDGRID_API_KEY" = "For email notifications (optional)"
        "TWILIO_ACCOUNT_SID" = "For SMS notifications (optional)"
        "TWILIO_AUTH_TOKEN" = "For SMS notifications (optional)"
        "VIRUS_SCAN_API_KEY" = "For file scanning (optional)"
    }
    
    foreach ($secret in $secrets.Keys) {
        $description = $secrets[$secret]
        Write-Host ""
        Write-Host "Setting $secret ($description)..." -ForegroundColor Cyan
        
        if ($secret -eq "JWT_SECRET") {
            # Auto-extract JWT secret from file
            $content = Get-Content $secretsFile -Raw
            if ($content -match "JWT_SECRET=(.+)") {
                $secretValue = $matches[1].Trim()
                Write-Host "Using generated JWT secret"
                echo $secretValue | wrangler secret put $secret
            } else {
                Write-Host "Enter JWT secret manually:"
                wrangler secret put $secret
            }
        } else {
            Write-Host "Enter $secret (or press Enter to skip):"
            try {
                wrangler secret put $secret
            } catch {
                Write-Host "Skipped $secret" -ForegroundColor Yellow
            }
        }
    }
    
    Write-Host ""
    Write-Host "✅ Secrets configuration complete!" -ForegroundColor Green
    
    # Prompt to delete secrets file
    $deleteFile = Read-Host "Delete secrets file for security? (Y/n)"
    if ($deleteFile -ne "n" -and $deleteFile -ne "N") {
        Remove-Item $secretsFile
        Write-Host "🗑️  Secrets file deleted" -ForegroundColor Green
    }
}

if (-not $Generate -and -not $Set) {
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  Generate secrets:  ./scripts/secrets.ps1 -Generate" -ForegroundColor Cyan
    Write-Host "  Set secrets:       ./scripts/secrets.ps1 -Set" -ForegroundColor Cyan
    Write-Host "  Both:              ./scripts/secrets.ps1 -Generate -Set" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Environment       production|staging (default: production)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "External Services Setup:" -ForegroundColor Yellow
    Write-Host "========================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "SendGrid (Email):" -ForegroundColor Cyan
    Write-Host "1. Sign up at sendgrid.com" -ForegroundColor White
    Write-Host "2. Create API key with Mail Send permissions" -ForegroundColor White
    Write-Host "3. Set SENDGRID_API_KEY secret" -ForegroundColor White
    Write-Host ""
    Write-Host "Twilio (SMS):" -ForegroundColor Cyan
    Write-Host "1. Sign up at twilio.com" -ForegroundColor White
    Write-Host "2. Get Account SID and Auth Token" -ForegroundColor White
    Write-Host "3. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN secrets" -ForegroundColor White
    Write-Host ""
    Write-Host "VirusTotal (File Scanning):" -ForegroundColor Cyan
    Write-Host "1. Sign up at virustotal.com" -ForegroundColor White
    Write-Host "2. Get API key from account settings" -ForegroundColor White
    Write-Host "3. Set VIRUS_SCAN_API_KEY secret" -ForegroundColor White
    Write-Host ""
}