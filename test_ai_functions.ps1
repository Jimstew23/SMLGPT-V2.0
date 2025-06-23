# SMLGPT V2.0 - Comprehensive AI Functions Test Suite
# This script tests all advanced AI capabilities systematically

Write-Host "🧪 SMLGPT V2.0 - Comprehensive AI Functions Test Suite" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

$baseUrl = "http://localhost:5000"
$testResults = @{}

# Function to make API calls with proper PowerShell syntax
function Test-APIEndpoint {
    param(
        [string]$Endpoint,
        [string]$Method = "GET",
        [hashtable]$Body = @{},
        [string]$Description
    )
    
    Write-Host "`n🔍 Testing: $Description" -ForegroundColor Yellow
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        if ($Method -eq "GET") {
            $response = Invoke-RestMethod -Uri "$baseUrl$Endpoint" -Method $Method -Headers $headers
        } else {
            $jsonBody = $Body | ConvertTo-Json -Depth 10
            $response = Invoke-RestMethod -Uri "$baseUrl$Endpoint" -Method $Method -Body $jsonBody -Headers $headers
        }
        
        Write-Host "✅ SUCCESS: $Description" -ForegroundColor Green
        return @{ Success = $true; Data = $response }
    }
    catch {
        Write-Host "❌ FAILED: $Description" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

# Test 1: Backend Health Check
Write-Host "`n1️⃣ BACKEND HEALTH CHECK" -ForegroundColor Cyan
$testResults["Health"] = Test-APIEndpoint -Endpoint "/api/health" -Method "GET" -Description "Backend Health Status"

# Test 2: GPT-4.1 Chat Functionality
Write-Host "`n2️⃣ GPT-4.1 CHAT FUNCTIONALITY" -ForegroundColor Cyan
$chatBody = @{
    message = "Hello, can you analyze workplace safety?"
    messages = @()
    include_search = $false
}
$testResults["Chat"] = Test-APIEndpoint -Endpoint "/api/chat" -Method "POST" -Body $chatBody -Description "GPT-4.1 Chat Response"

# Test 3: Enhanced Safety Analysis
Write-Host "`n3️⃣ ENHANCED SAFETY ANALYSIS" -ForegroundColor Cyan
$safetyBody = @{
    message = "Analyze safety hazards in construction"
    context = "Construction site safety analysis"
}
$testResults["Safety"] = Test-APIEndpoint -Endpoint "/api/safety/analyze-enhanced" -Method "POST" -Body $safetyBody -Description "Enhanced Safety Analysis"

# Test 4: Document Store Status
Write-Host "`n4️⃣ DOCUMENT STORE STATUS" -ForegroundColor Cyan
$testResults["Documents"] = Test-APIEndpoint -Endpoint "/api/documents" -Method "GET" -Description "Document Store Status"

# Test 5: Speech Service Status
Write-Host "`n5️⃣ SPEECH SERVICE STATUS" -ForegroundColor Cyan
$speechBody = @{
    text = "Testing speech synthesis functionality"
    voice = "en-US-AriaNeural"
}
$testResults["Speech"] = Test-APIEndpoint -Endpoint "/api/speech/synthesize" -Method "POST" -Body $speechBody -Description "Speech Synthesis"

# Test 6: Azure Cognitive Search
Write-Host "`n6️⃣ AZURE COGNITIVE SEARCH" -ForegroundColor Cyan
$searchBody = @{
    query = "safety hazards"
    top = 5
}
$testResults["Search"] = Test-APIEndpoint -Endpoint "/api/search" -Method "POST" -Body $searchBody -Description "Azure Cognitive Search"

# Test 7: Memory System
Write-Host "`n7️⃣ MEMORY SYSTEM STATUS" -ForegroundColor Cyan
$testResults["Memory"] = Test-APIEndpoint -Endpoint "/api/memory/status" -Method "GET" -Description "Safety Memory System"

# Test 8: Blob Storage Status
Write-Host "`n8️⃣ BLOB STORAGE STATUS" -ForegroundColor Cyan
$testResults["BlobStorage"] = Test-APIEndpoint -Endpoint "/api/blob/status" -Method "GET" -Description "Azure Blob Storage"

# Generate Test Report
Write-Host "`n📊 TEST RESULTS SUMMARY" -ForegroundColor Magenta
Write-Host "========================" -ForegroundColor Magenta

$successCount = 0
$totalCount = $testResults.Count

foreach ($test in $testResults.GetEnumerator()) {
    $status = if ($test.Value.Success) { "✅ PASS" } else { "❌ FAIL" }
    $color = if ($test.Value.Success) { "Green" } else { "Red" }
    
    Write-Host "$($test.Key): $status" -ForegroundColor $color
    
    if ($test.Value.Success) {
        $successCount++
    } else {
        Write-Host "  Error: $($test.Value.Error)" -ForegroundColor Red
    }
}

Write-Host "`n📈 OVERALL RESULTS: $successCount/$totalCount tests passed" -ForegroundColor Cyan

if ($successCount -eq $totalCount) {
    Write-Host "🎉 ALL AI FUNCTIONS ARE WORKING PERFECTLY!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some AI functions need attention" -ForegroundColor Yellow
}

Write-Host "`n🔧 Next Steps:" -ForegroundColor White
Write-Host "- Review failed tests and fix any issues"
Write-Host "- Test file upload functionality manually"
Write-Host "- Verify embeddings and vector search"
Write-Host "- Test end-to-end safety analysis workflow"
