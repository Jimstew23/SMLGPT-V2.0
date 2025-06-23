# Simple Chat Debug Test
Write-Host "=== Chat Debug Test ===" -ForegroundColor Green

# Test with minimal payload
$basicChat = @{
    message = "Hello"
} | ConvertTo-Json

Write-Host "Testing basic chat..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/chat" -Method POST -Body $basicChat -ContentType "application/json" -UseBasicParsing
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content.Substring(0, 200))..." -ForegroundColor Green
} catch {
    Write-Host "Error Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Error Message: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Error Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}
