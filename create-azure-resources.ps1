# SMLGPT V2.0 - Azure Resource Creation Script
# Run this PowerShell script to create the required Azure resources

Write-Host "🚀 SMLGPT V2.0 - Creating Azure Resources" -ForegroundColor Cyan

# Variables from your .env configuration
$StorageAccount = "smlgpt0243076580"
$ContainerName = "smlgpt-files"
$SearchService = "sml-image-analysis-eastus"
$SearchIndex = "smlgpt-v2-index"

Write-Host "`n📦 Creating Azure Blob Storage Container..." -ForegroundColor Yellow

# Method 1: Azure CLI (Recommended)
Write-Host "Option 1: Using Azure CLI" -ForegroundColor Green
Write-Host "az storage container create --name $ContainerName --account-name $StorageAccount --public-access blob" -ForegroundColor White

# Method 2: Azure Portal (Manual)
Write-Host "`nOption 2: Using Azure Portal" -ForegroundColor Green
Write-Host "1. Go to https://portal.azure.com" -ForegroundColor White
Write-Host "2. Navigate to Storage Account: $StorageAccount" -ForegroundColor White
Write-Host "3. Go to Containers > + Container" -ForegroundColor White
Write-Host "4. Name: $ContainerName" -ForegroundColor White
Write-Host "5. Public access level: Blob (anonymous read access for blobs only)" -ForegroundColor White

Write-Host "`n🔍 Creating Azure Cognitive Search Index..." -ForegroundColor Yellow

# Search Index Schema
$SearchIndexSchema = @"
{
  "name": "$SearchIndex",
  "fields": [
    {
      "name": "id",
      "type": "Edm.String",
      "key": true,
      "filterable": true
    },
    {
      "name": "title",
      "type": "Edm.String",
      "searchable": true,
      "filterable": true,
      "sortable": true
    },
    {
      "name": "content",
      "type": "Edm.String",
      "searchable": true,
      "analyzer": "en.microsoft"
    },
    {
      "name": "summary",
      "type": "Edm.String",
      "searchable": true
    },
    {
      "name": "category",
      "type": "Edm.String",
      "filterable": true,
      "facetable": true
    },
    {
      "name": "file_type",
      "type": "Edm.String",
      "filterable": true,
      "facetable": true
    },
    {
      "name": "url",
      "type": "Edm.String",
      "filterable": true
    },
    {
      "name": "created_at",
      "type": "Edm.DateTimeOffset",
      "filterable": true,
      "sortable": true
    },
    {
      "name": "updated_at",
      "type": "Edm.DateTimeOffset",
      "filterable": true,
      "sortable": true
    },
    {
      "name": "content_vector",
      "type": "Collection(Edm.Single)",
      "searchable": true,
      "dimensions": 1536,
      "vectorSearchConfiguration": "my-vector-config"
    },
    {
      "name": "image_vector",
      "type": "Collection(Edm.Single)",
      "searchable": true,
      "dimensions": 1024,
      "vectorSearchConfiguration": "my-vector-config"
    }
  ],
  "vectorSearch": {
    "algorithms": [
      {
        "name": "my-hnsw-algorithm",
        "kind": "hnsw",
        "hnswParameters": {
          "metric": "cosine",
          "m": 4,
          "efConstruction": 400,
          "efSearch": 500
        }
      }
    ],
    "profiles": [
      {
        "name": "my-vector-config",
        "algorithm": "my-hnsw-algorithm"
      }
    ]
  },
  "suggesters": [
    {
      "name": "sg",
      "searchMode": "analyzingInfixMatching",
      "sourceFields": ["title", "content"]
    }
  ]
}
"@

Write-Host "Option 1: Using REST API" -ForegroundColor Green
Write-Host "POST https://$SearchService.search.windows.net/indexes?api-version=2023-11-01" -ForegroundColor White
Write-Host "Content-Type: application/json" -ForegroundColor White
Write-Host "api-key: [Your Admin Key]" -ForegroundColor White
Write-Host "Body: See search-index-schema.json" -ForegroundColor White

Write-Host "`nOption 2: Using Azure Portal" -ForegroundColor Green
Write-Host "1. Go to https://portal.azure.com" -ForegroundColor White
Write-Host "2. Navigate to Search Service: $SearchService" -ForegroundColor White
Write-Host "3. Go to Indexes > + Add Index" -ForegroundColor White
Write-Host "4. Import the schema from search-index-schema.json" -ForegroundColor White

# Save the schema to a file
$SearchIndexSchema | Out-File -FilePath "search-index-schema.json" -Encoding UTF8
Write-Host "`n✅ Search index schema saved to: search-index-schema.json" -ForegroundColor Green

Write-Host "`n🎯 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Create the Blob Storage container using one of the methods above" -ForegroundColor White
Write-Host "2. Create the Search index using the provided schema" -ForegroundColor White
Write-Host "3. Get Cohere API key from https://dashboard.cohere.com/" -ForegroundColor White
Write-Host "4. Update .env with COHERE_API_KEY=your_key_here" -ForegroundColor White

Write-Host "`n🚀 Your SMLGPT V2.0 will then be fully operational!" -ForegroundColor Green
