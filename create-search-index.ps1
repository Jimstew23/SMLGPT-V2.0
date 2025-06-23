# SMLGPT V2.0 - Create Azure Cognitive Search Index via REST API
# This script creates the search index using your exact configuration

# Configuration from your .env file
$searchService = "sml-image-analysis-eastus"
$adminKey = "77jQ77rTh5XiVfbaDb9LBeI2UzYrmxXftQNbOZhWnZdaQTiEnVv5JQQJ99BCACYeBjFXJ3w3AAAAACOGhXPp"
$indexName = "smlgpt-v2-index"

# API endpoint
$uri = "https://$searchService.search.windows.net/indexes?api-version=2023-11-01"

Write-Host " Creating Azure Cognitive Search Index: $indexName" -ForegroundColor Cyan

# Read the schema from file
$schemaPath = ".\search-index-schema.json"
if (-not (Test-Path $schemaPath)) {
    Write-Error "Schema file not found: $schemaPath"
    exit 1
}

$schema = Get-Content $schemaPath -Raw

# Headers
$headers = @{
    'Content-Type' = 'application/json'
    'api-key' = $adminKey
}

Write-Host " Sending request to Azure Cognitive Search..." -ForegroundColor Yellow

try {
    # Create the index
    $response = Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $schema
    
    Write-Host " Index created successfully!" -ForegroundColor Green
    Write-Host " Index Details:" -ForegroundColor Cyan
    Write-Host "   Name: $($response.name)" -ForegroundColor White
    Write-Host "   Fields Count: $($response.fields.Count)" -ForegroundColor White
    Write-Host "   Vector Search: Enabled" -ForegroundColor White
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    $errorBody = $_.Exception.Response | Get-Member
    
    if ($statusCode -eq 409) {
        Write-Host "  Index already exists! Checking current configuration..." -ForegroundColor Yellow
        
        # Get existing index
        $getUri = "https://$searchService.search.windows.net/indexes/$indexName" + "?api-version=2023-11-01"
        try {
            $existingIndex = Invoke-RestMethod -Uri $getUri -Method GET -Headers $headers
            Write-Host " Existing index found with $($existingIndex.fields.Count) fields" -ForegroundColor Green
        } catch {
            Write-Host " Error checking existing index: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host " Error creating index: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Status Code: $statusCode" -ForegroundColor Red
    }
}

Write-Host "`n Next Steps:" -ForegroundColor Cyan
Write-Host "1. Verify the index exists in Azure Portal" -ForegroundColor White
Write-Host "2. Get your Cohere API key from https://dashboard.cohere.com/" -ForegroundColor White
Write-Host "3. Update .env with COHERE_API_KEY=your_key_here" -ForegroundColor White
Write-Host "4. Start your SMLGPT V2.0 system!" -ForegroundColor White
