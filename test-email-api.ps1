# Test Email API Script
# This script will help you test the email sending functionality

$baseUrl = "http://localhost:5000"

Write-Host "🚀 Testing Email API..." -ForegroundColor Green

# Step 1: Login first
Write-Host "`n1. Logging in..." -ForegroundColor Yellow
try {
    $loginData = @{
        email = "admin@crm.com"
        password = "admin123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    $token = $loginResponse.token
    Write-Host "✅ Login successful! Token: $($token.Substring(0,20))..." -ForegroundColor Green
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# Step 2: Test sending email
Write-Host "`n2. Testing email send..." -ForegroundColor Yellow
try {
    $headers = @{
        Authorization = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $emailData = @{
        to = "test@example.com"
        cc = ""
        bcc = ""
        subject = "Test Email from CRM"
        body = "This is a test email sent from the Conference CRM system."
        templateId = $null
        attachments = @()
        clientId = $null
        isDraft = $false
    } | ConvertTo-Json

    Write-Host "📧 Sending email with data:" -ForegroundColor Cyan
    Write-Host $emailData -ForegroundColor Gray

    $emailResponse = Invoke-RestMethod -Uri "$baseUrl/api/emails/send" -Method POST -Body $emailData -Headers $headers
    Write-Host "✅ Email sent successfully!" -ForegroundColor Green
    Write-Host "Response: $($emailResponse | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Email send failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody" -ForegroundColor Red
    }
}

Write-Host "`n🎉 Test complete!" -ForegroundColor Green
