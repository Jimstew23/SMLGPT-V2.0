# SMLGPT V2.0 Test Suite Documentation

## Overview

These test scripts allow you to simulate and test the complete file upload flow in SMLGPT V2.0, from initial upload through Azure Computer Vision/Document Intelligence to GPT-4.1 analysis.

## Flow Being Tested

```
1. File Upload → Backend Express Server
2. File Storage → Azure Blob Storage  
3. Analysis:
   - Images → Azure Computer Vision → GPT-4.1 Vision
   - Documents → Azure Document Intelligence → GPT-4.1
4. Results → Indexed in Azure Search
5. Chat Integration → Reference uploaded files in conversations
```

## Setup Instructions

### 1. Install Dependencies

**For Node.js Script:**
```bash
npm install axios form-data
# or
yarn add axios form-data
```

**For Python Script:**
```bash
pip install requests aiohttp
# or
pip install -r requirements.txt
```

### 2. Create Test Files Directory

```bash
mkdir test-files
```

### 3. Add Test Files

Add the following test files to the `test-files` directory:

- **workplace-safety-scene.jpg** - An image showing a workplace with various safety elements
- **construction-site.png** - Construction site image with potential hazards
- **safety-procedures.pdf** - A PDF document with safety procedures
- **test-image.jpg** - Any image for load testing

You can use stock photos or your own workplace images.

### 4. Set Environment Variables (Optional)

```bash
export API_URL=http://localhost:5000  # Default
```

## Usage Examples

### Node.js Script

**Run all tests:**
```bash
node test-smlgpt-pipeline.js
```

**Run specific test types:**
```bash
# Only upload tests
node test-smlgpt-pipeline.js upload

# Only Azure service tests  
node test-smlgpt-pipeline.js azure

# Load test (3 concurrent, 10 total)
node test-smlgpt-pipeline.js load 3 10
```

### Python Script

**Run all tests:**
```bash
python test_smlgpt_pipeline.py
```

**Run specific test types:**
```bash
# Only upload tests
python test_smlgpt_pipeline.py upload

# Async upload test
python test_smlgpt_pipeline.py async

# Load test (5 concurrent, 20 total)
python test_smlgpt_pipeline.py load 5 20
```

## Test Scenarios

### 1. Basic Upload Test
- Uploads individual files
- Verifies Azure Computer Vision integration
- Verifies Azure Document Intelligence integration
- Checks GPT-4.1 safety analysis
- Displays processing times

### 2. Chat Integration Test
- Uploads multiple files
- References them in a chat message
- Verifies document context is included
- Tests the complete RAG (Retrieval Augmented Generation) flow

### 3. Load Test
- Tests concurrent uploads
- Measures throughput
- Identifies performance bottlenecks
- Validates system stability

### 4. Async Test (Python only)
- Tests asynchronous upload capabilities
- Better performance for bulk uploads

## Expected Output

### Successful Upload:
```
📤 Uploading file: workplace-safety-scene.jpg
Upload Progress: 100%
✅ Upload completed in 3245ms

📊 Analysis Results:
File ID: abc123-def456-789
Blob URL: https://yourstorage.blob.core.windows.net/...
Processing Time: 3245ms
Indexed: true

🖼️  Vision Analysis:
Caption: A construction worker wearing safety equipment
Tags: person, helmet, safety, construction
Objects: person, hard hat, safety vest

🦺 Safety Analysis Preview:
## Safety Analysis Results

**Overall Risk Level:** MODERATE_CONCERN
**Risk Score:** 6.5/10
**Confidence Level:** 85%

## Hazards Identified
🟡 **Fall Hazard** (Medium Risk)
   - Worker near unguarded edge...
```

### Chat Response:
```
💬 Sending chat message with 3 document references

Chat Response:
Based on my analysis of the uploaded images and documents, I've identified several critical safety concerns:

1. **Fall Hazards** (Critical Risk):
   - Unguarded edges in construction-site.png
   - Missing fall protection equipment...

Processing Time: 1823ms
Context Used: true
```

## Troubleshooting

### Common Issues:

1. **Connection Refused**
   - Ensure backend is running: `npm start` in backend directory
   - Check API_URL environment variable

2. **404 Not Found**
   - Verify the upload endpoint exists: `/api/upload`
   - Check backend routes configuration

3. **Timeout Errors**
   - Large files may take time to process
   - Increase timeout values in scripts
   - Check Azure service connectivity

4. **Azure Service Errors**
   - Verify Azure credentials in `.env` file
   - Check Azure service endpoints are correct
   - Ensure services are provisioned and running

5. **Memory/Performance Issues**
   - Reduce concurrent uploads in load test
   - Use smaller test files
   - Monitor backend memory usage

## Interpreting Results

### Processing Times:
- **Good**: < 5 seconds for images
- **Acceptable**: 5-10 seconds for complex images
- **Slow**: > 10 seconds (check Azure region/network)

### Success Metrics:
- **Upload Success Rate**: Should be > 95%
- **Throughput**: Depends on Azure tier and network
- **Error Rate**: Should be < 5% under normal load

## Advanced Testing

### Custom Test Cases

Add your own test cases to the scripts:

```javascript
const CUSTOM_TESTS = [
  {
    name: 'ppe-compliance-test',
    file: 'workers-ppe-check.jpg',
    type: 'image',
    description: 'Testing PPE compliance detection'
  }
];
```

### Performance Profiling

Use the load test results to:
- Identify optimal concurrent upload limits
- Determine maximum throughput
- Plan for scaling requirements

### Integration Testing

Combine with frontend testing:
1. Run backend with test script
2. Verify uploaded files appear in UI
3. Test chat interactions with uploaded content

## Security Considerations

- Test scripts use actual Azure services (costs may apply)
- Don't include sensitive images in test files
- Clear test data after testing
- Use separate test Azure resources if possible

## Next Steps

1. **Automate Testing**: Integrate into CI/CD pipeline
2. **Mock Services**: Create mocked Azure services for unit tests
3. **Stress Testing**: Use tools like K6 or JMeter for larger scale tests
4. **Monitoring**: Add Application Insights or similar for production monitoring

## Quick Start Guide

```bash
# 1. Create test directory
mkdir test-files

# 2. Add some test images/PDFs to test-files/

# 3. Install dependencies
npm install axios form-data

# 4. Run tests
node test-smlgpt-pipeline.js
```

## Files Created

- `test-smlgpt-pipeline.js` - Node.js test script
- `test_smlgpt_pipeline.py` - Python test script  
- `TEST_SUITE_README.md` - This documentation

## What Gets Tested

✅ File upload to Express backend  
✅ Storage in Azure Blob Storage  
✅ Azure Computer Vision analysis for images  
✅ Azure Document Intelligence for PDFs/documents  
✅ GPT-4.1 safety analysis  
✅ Chat integration with document context  
✅ Performance under load  
✅ Error handling and reporting  
✅ Processing time measurements  
✅ Success rate tracking
