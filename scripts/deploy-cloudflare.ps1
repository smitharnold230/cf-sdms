#!/usr/bin/env powershell
<#
.SYNOPSIS
    Automated deployment script for Student Database Management System on Cloudflare
.DESCRIPTION
    This script automates the entire deployment process including:
    - Creating D1 database
    - Creating KV namespaces
    - Creating R2 bucket
    - Updating wrangler.toml
    - Running database migrations
    - Deploying the application
.NOTES
    Make sure you have wrangler CLI installed and are logged in before running this script
#>

param(
    [string]$ProjectName = "student-db-ms",
    [string]$DatabaseName = "student_db",
    [string]$BucketName = "student-certificates",
    [switch]$SkipSecrets,
    [switch]$DryRun
)

# Colors for output
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Reset = "`e[0m"

function Write-ColoredOutput {
    param([string]$Message, [string]$Color = $Reset)
    Write-Host "$Color$Message$Reset"
}

function Write-Step {
    param([string]$Message)
    Write-ColoredOutput "🔄 $Message" $Blue
}

function Write-Success {
    param([string]$Message)
    Write-ColoredOutput "✅ $Message" $Green
}

function Write-Warning {
    param([string]$Message)
    Write-ColoredOutput "⚠️  $Message" $Yellow
}

function Write-Error {
    param([string]$Message)
    Write-ColoredOutput "❌ $Message" $Red
}

# Check prerequisites
function Test-Prerequisites {
    Write-Step "Checking prerequisites..."
    
    # Check if wrangler is installed
    try {
        $wranglerVersion = wrangler --version 2>$null
        Write-Success "Wrangler CLI is installed: $wranglerVersion"
    }
    catch {
        Write-Error "Wrangler CLI is not installed. Please run: npm install -g wrangler"
        exit 1
    }
    
    # Check if user is logged in
    try {
        $whoami = wrangler whoami 2>$null
        Write-Success "Logged in as: $whoami"
    }
    catch {
        Write-Error "Not logged in to Cloudflare. Please run: wrangler login"
        exit 1
    }
    
    # Check if we're in the right directory
    if (-not (Test-Path "wrangler.toml")) {
        Write-Error "wrangler.toml not found. Please run this script from the project root directory."
        exit 1
    }
    
    Write-Success "All prerequisites met!"
}

# Create D1 database
function New-D1Database {
    param([string]$Name)
    
    Write-Step "Creating D1 database: $Name"
    
    if ($DryRun) {
        Write-Warning "DRY RUN: Would create D1 database '$Name'"
        return "dry-run-database-id"
    }
    
    try {
        $output = wrangler d1 create $Name 2>&1 | Out-String
        
        # Extract database ID from output
        if ($output -match 'database_id = "([^"]+)"') {
            $databaseId = $Matches[1]
            Write-Success "Created D1 database with ID: $databaseId"
            return $databaseId
        }
        else {
            Write-Error "Failed to extract database ID from output"
            Write-Host $output
            exit 1
        }
    }
    catch {
        Write-Error "Failed to create D1 database: $_"
        exit 1
    }
}

# Create KV namespace
function New-KVNamespace {
    param([string]$Name, [switch]$Preview)
    
    $previewFlag = if ($Preview) { " --preview" } else { "" }
    Write-Step "Creating KV namespace: $Name$previewFlag"
    
    if ($DryRun) {
        Write-Warning "DRY RUN: Would create KV namespace '$Name'$previewFlag"
        return "dry-run-kv-id"
    }
    
    try {
        $args = @("kv:namespace", "create", $Name)
        if ($Preview) { $args += "--preview" }
        
        $output = & wrangler $args 2>&1 | Out-String
        
        # Extract namespace ID from output
        if ($output -match 'id = "([^"]+)"') {
            $namespaceId = $Matches[1]
            $previewText = if ($Preview) { " (preview)" } else { "" }
            Write-Success "Created KV namespace$previewText with ID: $namespaceId"
            return $namespaceId
        }
        else {
            Write-Error "Failed to extract namespace ID from output"
            Write-Host $output
            exit 1
        }
    }
    catch {
        Write-Error "Failed to create KV namespace: $_"
        exit 1
    }
}

# Create R2 bucket
function New-R2Bucket {
    param([string]$Name)
    
    Write-Step "Creating R2 bucket: $Name"
    
    if ($DryRun) {
        Write-Warning "DRY RUN: Would create R2 bucket '$Name'"
        return
    }
    
    try {
        wrangler r2 bucket create $Name
        Write-Success "Created R2 bucket: $Name"
    }
    catch {
        Write-Error "Failed to create R2 bucket: $_"
        exit 1
    }
}

# Update wrangler.toml with resource IDs
function Update-WranglerConfig {
    param(
        [string]$DatabaseId,
        [string]$RateLimitKvId,
        [string]$RateLimitPreviewId,
        [string]$CacheKvId,
        [string]$CachePreviewId
    )
    
    Write-Step "Updating wrangler.toml configuration..."
    
    if ($DryRun) {
        Write-Warning "DRY RUN: Would update wrangler.toml with resource IDs"
        return
    }
    
    try {
        $config = Get-Content "wrangler.toml" -Raw
        
        # Update database ID
        $config = $config -replace 'database_id = ""', "database_id = `"$DatabaseId`""
        
        # Update KV namespace IDs
        $config = $config -replace '(?<=binding = "RATE_LIMIT_KV"[\s\S]*?)id = ""', "id = `"$RateLimitKvId`""
        $config = $config -replace '(?<=binding = "RATE_LIMIT_KV"[\s\S]*?)preview_id = ""', "preview_id = `"$RateLimitPreviewId`""
        $config = $config -replace '(?<=binding = "CACHE_KV"[\s\S]*?)id = ""', "id = `"$CacheKvId`""
        $config = $config -replace '(?<=binding = "CACHE_KV"[\s\S]*?)preview_id = ""', "preview_id = `"$CachePreviewId`""
        
        Set-Content "wrangler.toml" $config
        Write-Success "Updated wrangler.toml with resource IDs"
    }
    catch {
        Write-Error "Failed to update wrangler.toml: $_"
        exit 1
    }
}

# Run database migrations
function Invoke-DatabaseMigrations {
    param([string]$DatabaseName)
    
    Write-Step "Running database migrations..."
    
    if ($DryRun) {
        Write-Warning "DRY RUN: Would run database migrations"
        return
    }
    
    $migrationFiles = @(
        "migrations/001_init.sql",
        "migrations/002_expand_schema.sql", 
        "migrations/003_file_management.sql",
        "migrations/004_notification_system.sql"
    )
    
    foreach ($migration in $migrationFiles) {
        if (Test-Path $migration) {
            Write-Step "Running migration: $migration"
            try {
                wrangler d1 execute $DatabaseName --file=$migration
                Write-Success "Migration completed: $migration"
            }
            catch {
                Write-Error "Failed to run migration $migration`: $_"
                exit 1
            }
        }
        else {
            Write-Warning "Migration file not found: $migration"
        }
    }
}

# Set up secrets
function Set-Secrets {
    Write-Step "Setting up secrets..."
    
    if ($SkipSecrets) {
        Write-Warning "Skipping secrets setup (--SkipSecrets flag provided)"
        return
    }
    
    if ($DryRun) {
        Write-Warning "DRY RUN: Would prompt for secrets"
        return
    }
    
    $secrets = @(
        @{Name="JWT_SECRET"; Description="Strong random string for JWT signing (64+ characters)"},
        @{Name="SENDGRID_API_KEY"; Description="SendGrid API key for email notifications"},
        @{Name="VIRUS_SCAN_API_KEY"; Description="VirusTotal API key for file scanning (optional)"}
    )
    
    foreach ($secret in $secrets) {
        Write-ColoredOutput "Setting up secret: $($secret.Name)" $Yellow
        Write-Host "Description: $($secret.Description)"
        
        $response = Read-Host "Do you want to set $($secret.Name)? (y/n/skip)"
        
        switch ($response.ToLower()) {
            "y" {
                try {
                    wrangler secret put $secret.Name
                    Write-Success "Secret set: $($secret.Name)"
                }
                catch {
                    Write-Error "Failed to set secret $($secret.Name): $_"
                }
            }
            "skip" {
                Write-Warning "Skipping remaining secrets"
                break
            }
            default {
                Write-Warning "Skipping secret: $($secret.Name)"
            }
        }
    }
}

# Deploy application
function Deploy-Application {
    Write-Step "Deploying application to Cloudflare Workers..."
    
    if ($DryRun) {
        Write-Warning "DRY RUN: Would deploy application"
        return
    }
    
    try {
        $output = wrangler deploy 2>&1 | Out-String
        Write-Host $output
        
        # Extract deployment URL
        if ($output -match 'https://[^\s]+\.workers\.dev') {
            $deploymentUrl = $Matches[0]
            Write-Success "Application deployed successfully!"
            Write-ColoredOutput "🌐 URL: $deploymentUrl" $Green
            return $deploymentUrl
        }
        else {
            Write-Success "Application deployed successfully!"
        }
    }
    catch {
        Write-Error "Failed to deploy application: $_"
        exit 1
    }
}

# Test deployment
function Test-Deployment {
    param([string]$Url)
    
    if (-not $Url -or $DryRun) {
        Write-Warning "Skipping deployment test"
        return
    }
    
    Write-Step "Testing deployment..."
    
    try {
        $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 30
        if ($response.status -eq "ok") {
            Write-Success "Deployment test passed!"
        }
        else {
            Write-Warning "Deployment test returned unexpected response"
        }
    }
    catch {
        Write-Warning "Deployment test failed (this might be normal if auth is required): $_"
    }
}

# Main deployment flow
function Start-Deployment {
    Write-ColoredOutput "🚀 Starting Cloudflare deployment for $ProjectName" $Blue
    Write-Host ""
    
    # Check prerequisites
    Test-Prerequisites
    Write-Host ""
    
    # Create resources
    $databaseId = New-D1Database -Name $DatabaseName
    Write-Host ""
    
    $rateLimitKvId = New-KVNamespace -Name "RATE_LIMIT_KV"
    $rateLimitPreviewId = New-KVNamespace -Name "RATE_LIMIT_KV" -Preview
    Write-Host ""
    
    $cacheKvId = New-KVNamespace -Name "CACHE_KV"
    $cachePreviewId = New-KVNamespace -Name "CACHE_KV" -Preview
    Write-Host ""
    
    New-R2Bucket -Name $BucketName
    Write-Host ""
    
    # Update configuration
    Update-WranglerConfig -DatabaseId $databaseId -RateLimitKvId $rateLimitKvId -RateLimitPreviewId $rateLimitPreviewId -CacheKvId $cacheKvId -CachePreviewId $cachePreviewId
    Write-Host ""
    
    # Run migrations
    Invoke-DatabaseMigrations -DatabaseName $DatabaseName
    Write-Host ""
    
    # Set up secrets
    Set-Secrets
    Write-Host ""
    
    # Deploy
    $deploymentUrl = Deploy-Application
    Write-Host ""
    
    # Test
    Test-Deployment -Url $deploymentUrl
    Write-Host ""
    
    # Summary
    Write-ColoredOutput "🎉 Deployment completed successfully!" $Green
    Write-Host ""
    Write-Host "📋 Summary:"
    Write-Host "  • Database: $DatabaseName (ID: $databaseId)"
    Write-Host "  • R2 Bucket: $BucketName"
    Write-Host "  • KV Namespaces: RATE_LIMIT_KV, CACHE_KV"
    if ($deploymentUrl) {
        Write-Host "  • Deployment URL: $deploymentUrl"
    }
    Write-Host ""
    Write-Host "📚 Next steps:"
    Write-Host "  1. Update your frontend configuration with the API URL"
    Write-Host "  2. Test all functionality in production"
    Write-Host "  3. Set up custom domain (optional)"
    Write-Host "  4. Configure monitoring and alerts"
}

# Script execution
if ($DryRun) {
    Write-Warning "🧪 DRY RUN MODE - No actual changes will be made"
    Write-Host ""
}

try {
    Start-Deployment
}
catch {
    Write-Error "Deployment failed: $_"
    exit 1
}