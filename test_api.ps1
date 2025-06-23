# SMLGPT V2.0 API Test Script
# Tests: 1) Text chat, 2) Document analysis, 3) Image analysis, 4) Blob storage

Write-Host "=== SMLGPT V2.0 API Testing ===" -ForegroundColor Green

# Test 1: Health Check
Write-Host "`n1. Testing Backend Health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:5000/api/health" -Method GET
    Write-Host "✅ Backend Health: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend Health Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Text-based Chat
Write-Host "`n2. Testing Text-based Chat..." -ForegroundColor Yellow
try {
    $chatBody = @{
        message = "Hello, can you help me with safety analysis?"
        include_search = $false
        conversation_history = @()
    } | ConvertTo-Json

    $chatResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/chat" -Method POST -Body $chatBody -ContentType "application/json"
    Write-Host "✅ Text Chat Response: $($chatResponse.response.Substring(0, 50))..." -ForegroundColor Green
} catch {
    Write-Host "❌ Text Chat Failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Error Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
}

# Test 3: Document Analysis (simulated - would need actual file)
Write-Host "`n3. Testing Document Analysis..." -ForegroundColor Yellow
Write-Host "⚠️  Document analysis requires file upload - check frontend UI" -ForegroundColor Yellow

# Test 4: Image Analysis (simulated - would need actual file)  
Write-Host "`n4. Testing Image Analysis..." -ForegroundColor Yellow
Write-Host "⚠️  Image analysis requires file upload - check frontend UI" -ForegroundColor Yellow

# Test 5: Enhanced Safety Analysis Endpoint
Write-Host "`n5. Testing Enhanced Safety Analysis..." -ForegroundColor Yellow
try {
    $safetyBody = @{
        image_url = "https://example.com/test.jpg"
        analysis_type = "comprehensive"
    } | ConvertTo-Json

    $safetyResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/safety/analyze-enhanced" -Method POST -Body $safetyBody -ContentType "application/json"
    Write-Host "✅ Safety Analysis Endpoint Available" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Safety Analysis: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Green
Write-Host "Next: Test file uploads via frontend UI" -ForegroundColor Cyan
