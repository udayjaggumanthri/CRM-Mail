# PowerShell script to rebuild Docker containers
# Usage: .\rebuild-docker.ps1 [dev|prod]

param(
    [string]$mode = "prod"
)

Write-Host "🐳 Docker Rebuild Script" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan

# Check if Docker is running
try {
    docker ps | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Set compose file based on mode
if ($mode -eq "dev") {
    $composeFile = "docker-compose.dev.yml"
    Write-Host "📦 Building in DEVELOPMENT mode" -ForegroundColor Yellow
} else {
    $composeFile = "docker-compose.yml"
    Write-Host "📦 Building in PRODUCTION mode" -ForegroundColor Yellow
}

# Step 1: Stop and remove containers
Write-Host "`n[1/5] Stopping containers..." -ForegroundColor Cyan
docker-compose -f $composeFile down -v 2>&1 | Out-Null
Write-Host "✅ Containers stopped" -ForegroundColor Green

# Step 2: Remove old images (optional but recommended)
Write-Host "`n[2/5] Removing old images..." -ForegroundColor Cyan
docker-compose -f $composeFile images -q | ForEach-Object {
    if ($_) {
        docker rmi $_ -f 2>&1 | Out-Null
    }
}
Write-Host "✅ Old images removed" -ForegroundColor Green

# Step 3: Rebuild images
Write-Host "`n[3/5] Rebuilding images (this may take a few minutes)..." -ForegroundColor Cyan
$buildResult = docker-compose -f $composeFile build --no-cache 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Images rebuilt successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed. See logs above." -ForegroundColor Red
    exit 1
}

# Step 4: Start services
Write-Host "`n[4/5] Starting services..." -ForegroundColor Cyan
docker-compose -f $composeFile up -d 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Services started" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to start services" -ForegroundColor Red
    exit 1
}

# Step 5: Wait and check status
Write-Host "`n[5/5] Waiting for services to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

docker-compose -f $composeFile ps

Write-Host "`n✅ Docker rebuild complete!" -ForegroundColor Green
Write-Host "`nAccess URLs:" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:5000" -ForegroundColor White
Write-Host "  Backend:  http://localhost:3001" -ForegroundColor White

Write-Host "`nUseful commands:" -ForegroundColor Cyan
Write-Host "  View logs:     docker-compose -f $composeFile logs -f" -ForegroundColor White
Write-Host "  Stop all:      docker-compose -f $composeFile down" -ForegroundColor White
Write-Host "  Restart:       docker-compose -f $composeFile restart" -ForegroundColor White

