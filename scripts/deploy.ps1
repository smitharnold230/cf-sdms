# PowerShell Deployment Script for Notification System
# Usage: .\scripts\deploy.ps1 [environment]

param(
    [Parameter(Position=0)]
    [ValidateSet("development", "staging", "production")]
    [string]$Environment = "development"
)

# Color functions for output
function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

Write-Info "Starting deployment to $Environment environment..."

# Check prerequisites
function Test-Prerequisites {
    Write-Info "Checking prerequisites..."
    
    # Check if wrangler is installed
    try {
        $null = wrangler --version
        Write-Success "Wrangler CLI found"
    }
    catch {
        Write-Error "Wrangler CLI not found. Please install it: npm install -g wrangler"
        exit 1
    }
    
    # Check if authenticated
    try {
        $null = wrangler whoami
        Write-Success "Authenticated with Cloudflare"
    }
    catch {
        Write-Error "Not authenticated with Cloudflare. Run: wrangler login"
        exit 1
    }
    
    Write-Success "Prerequisites check completed"
}

# Setup infrastructure
function Set-Infrastructure {
    Write-Info "Setting up infrastructure for $Environment..."
    
    $dbName = "student-db"
    $kvName = "RATE_LIMIT_KV"
    $bucketName = "student-certificates"
    
    if ($Environment -ne "production") {
        $dbName = "$dbName-$Environment"
        $bucketName = "$bucketName-$Environment"
    }
    
    # Create D1 database
    Write-Info "Creating D1 database: $dbName"
    try {
        wrangler d1 create $dbName
    }
    catch {
        Write-Warning "Database may already exist"
    }
    
    # Create KV namespace
    Write-Info "Creating KV namespace: $kvName"
    try {
        if ($Environment -eq "production") {
            wrangler kv:namespace create $kvName
        }
        else {
            wrangler kv:namespace create $kvName --preview
        }
    }
    catch {
        Write-Warning "KV namespace may already exist"
    }
    
    # Create R2 bucket
    Write-Info "Creating R2 bucket: $bucketName"
    try {
        wrangler r2 bucket create $bucketName
    }
    catch {
        Write-Warning "R2 bucket may already exist"
    }
    
    Write-Success "Infrastructure setup completed"
}

# Run database migrations
function Invoke-Migrations {
    Write-Info "Running database migrations..."
    
    $dbName = "student-db"
    if ($Environment -ne "production") {
        $dbName = "$dbName-$Environment"
    }
    
    # Apply migrations in order
    $migrationFiles = Get-ChildItem -Path "migrations\*.sql" | Sort-Object Name
    
    foreach ($migrationFile in $migrationFiles) {
        Write-Info "Applying migration: $($migrationFile.Name)"
        wrangler d1 execute $dbName --file=$($migrationFile.FullName)
    }
    
    Write-Success "Database migrations completed"
}

# Deploy application
function Deploy-Application {
    Write-Info "Deploying application to $Environment..."
    
    # Create environment-specific wrangler config
    $configFile = "wrangler.$Environment.toml"
    Copy-Item "wrangler.toml" $configFile
    
    # Update worker name for non-production environments
    if ($Environment -ne "production") {
        $content = Get-Content $configFile
        $content = $content -replace 'name = "student-db-ms"', "name = `"student-db-ms-$Environment`""
        Set-Content $configFile $content
    }
    
    # Deploy with environment-specific config
    if ($Environment -eq "production") {
        wrangler deploy
    }
    else {
        wrangler deploy --config $configFile
    }
    
    # Cleanup temporary config file
    Remove-Item $configFile -ErrorAction SilentlyContinue
    
    Write-Success "Application deployment completed"
}

# Run post-deployment tests
function Test-Deployment {
    Write-Info "Running post-deployment tests..."
    
    if ($Environment -eq "production") {
        $baseUrl = "https://student-db-ms.yourdomain.workers.dev"
    }
    else {
        $baseUrl = "https://student-db-ms-$Environment.yourdomain.workers.dev"
    }
    
    # Wait for deployment to propagate
    Write-Info "Waiting for deployment to propagate..."
    Start-Sleep -Seconds 30
    
    # Health check
    Write-Info "Running health check..."
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/health" -Method Get -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Success "Health check passed"
        }
        else {
            Write-Error "Health check failed with status: $($response.StatusCode)"
            return $false
        }
    }
    catch {
        Write-Error "Health check failed: $($_.Exception.Message)"
        return $false
    }
    
    Write-Success "Post-deployment tests completed"
    return $true
}

# Main deployment flow
function Main {
    Write-Host "🚀 Notification System Deployment Script" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        Test-Prerequisites
        Set-Infrastructure
        Invoke-Migrations
        Deploy-Application
        
        if (Test-Deployment) {
            Write-Success "Deployment to $Environment completed successfully! 🎉"
            
            if ($Environment -eq "production") {
                Write-Host ""
                Write-Host "🌐 Production URL: https://student-db-ms.yourdomain.workers.dev" -ForegroundColor Cyan
                Write-Host "📊 Admin Dashboard: https://student-db-ms.yourdomain.workers.dev/admin" -ForegroundColor Cyan
                Write-Host "📚 API Documentation: https://student-db-ms.yourdomain.workers.dev/docs" -ForegroundColor Cyan
            }
        }
        else {
            Write-Error "Deployment verification failed"
            exit 1
        }
    }
    catch {
        Write-Error "Deployment failed: $($_.Exception.Message)"
        Write-Error "Check the logs above for details."
        exit 1
    }
}

# Run main function
Main