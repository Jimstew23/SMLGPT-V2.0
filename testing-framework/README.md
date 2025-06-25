# 🔍 SMLGPT Testing & Monitoring Framework

A comprehensive testing and monitoring system for SMLGPT V2.0 that provides real-time flow tracing, API monitoring, and end-to-end testing capabilities.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- SMLGPT V2.0 backend running on `localhost:5000`
- SMLGPT V2.0 frontend running on `localhost:3000`

### Installation

```bash
# Navigate to the testing framework directory
cd testing-framework

# Install dependencies
npm install

# Install Playwright browsers (for E2E tests)
npx playwright install
```

## 🎯 Features

### 1. **CLI Flow Tracer** (`flowTracer.js`)
- Step-by-step API tracing with colored console output
- Detailed timing and performance metrics
- Error detection and reporting
- Comprehensive JSON reports

### 2. **Real-time Monitoring Dashboard** (`monitor-dashboard.html`)
- Live WebSocket updates
- Visual flow diagrams
- Performance charts
- Error tracking and alerts

### 3. **Test Server** (`test-server.js`)
- WebSocket broadcasting for real-time updates
- REST API for triggering tests
- HTTP polling fallback
- Comprehensive test orchestration

### 4. **E2E Playwright Tests** (`e2e-tests.js`)
- Browser automation and testing
- Video recording of test sessions
- Network request/response monitoring
- Screenshot capture on failures

## 📋 Usage Guide

### Method 1: Real-time Monitoring Dashboard (Recommended)

```bash
# Start the monitoring server
npm run monitor

# Open browser to: http://localhost:8081/monitor-dashboard.html
```

**Dashboard Features:**
- 🟢 Connection status indicator
- 📊 Real-time performance metrics
- 🔄 Live process flow visualization
- 📝 Detailed logging with filtering
- 🎮 One-click test execution buttons

### Method 2: CLI Testing

```bash
# Run full test scenario
npm run test

# Or run specific tests
node flowTracer.js
```

### Method 3: E2E Browser Testing

```bash
# Run complete E2E test suite
npm run test:e2e

# Run specific E2E tests
npm run test:frontend  # Frontend only
npm run test:backend   # Backend API only
```

## 🔧 Test Scenarios

### Health Check Test
Verifies backend connectivity and basic API functionality.

```bash
# Via dashboard: Click "Test Health Check"
# Via CLI: Included in full scenario
# Via API: POST http://localhost:8081/test/health
```

### File Upload Test
Tests the complete file upload workflow including:
- File reading and validation
- Form data creation
- Backend upload processing
- Response validation

```bash
# Via dashboard: Click "Test Image Upload"
# Via API: POST http://localhost:8081/test/upload
```

### Chat Analysis Test
Tests AI chat functionality including:
- Message sending
- Document reference handling
- GPT-4.1 processing
- Response validation

```bash
# Via dashboard: Click "Test Chat Analysis"
# Via API: POST http://localhost:8081/test/chat
```

### Full Integration Test
Runs all tests in sequence to validate the complete SMLGPT workflow.

```bash
# Via dashboard: Click "Run Full Scenario"
# Via CLI: npm run test
# Via API: POST http://localhost:8081/test/full
```

## 📊 Monitoring & Debugging

### Real-time Metrics
The dashboard provides live monitoring of:
- **API Call Count**: Total number of API requests
- **Success Rate**: Percentage of successful requests
- **Average Response Time**: Mean API response time
- **Error Count**: Number of failed requests

### Flow Visualization
Visual representation of the request flow:
```
Frontend → Backend API → Azure Services → Response
```
- 🔵 Blue: Active/Processing
- 🟢 Green: Success
- 🔴 Red: Error/Failed

### Error Detection
Automatic detection and reporting of:
- Network connectivity issues
- API endpoint failures
- Timeout errors
- Azure service problems
- Frontend JavaScript errors

## 🐛 Troubleshooting

### Common Issues

#### 1. Backend Not Connected
**Symptoms**: Dashboard shows "Disconnected", health checks fail
**Solution**: 
```bash
# Check if backend is running
curl http://localhost:5000/api/health

# Start SMLGPT backend if not running
cd ../backend
npm start
```

#### 2. Frontend Not Loading
**Symptoms**: E2E tests fail on frontend load
**Solution**:
```bash
# Check if frontend is running
curl http://localhost:3000

# Start SMLGPT frontend if not running
cd ../frontend
npm start
```

#### 3. WebSocket Connection Failed
**Symptoms**: Dashboard shows "Disconnected", no real-time updates
**Solution**: The system automatically falls back to HTTP polling. No action needed.

#### 4. File Upload Fails
**Symptoms**: Upload test returns errors
**Common Causes**:
- Backend storage configuration issues
- Azure Blob Storage connectivity problems
- File size/type restrictions

**Debug Steps**:
```bash
# Check backend logs during upload test
# Verify Azure storage configuration in backend/.env
# Run upload test with CLI for detailed error output
```

#### 5. Chat Analysis Fails
**Symptoms**: Chat test timeouts or errors
**Common Causes**:
- Azure OpenAI API issues
- Missing document references
- GPT-4.1 configuration problems

**Debug Steps**:
```bash
# Verify Azure OpenAI configuration
# Check document storage status
# Review chat service logs
```

## 📁 Output Files

### Test Reports
- `trace-report-{timestamp}.json`: Detailed flow analysis
- `e2e-report-{timestamp}.json`: End-to-end test results

### Screenshots
- `test-results/screenshot-*.png`: Test execution screenshots
- Automatic capture on failures and key steps

### Videos
- `test-videos/*.webm`: Complete E2E test recordings
- Useful for debugging complex interaction issues

### Network Logs
- `test-results/network-*.har`: Complete network traffic logs
- Can be imported into Chrome DevTools for analysis

## 🔌 API Reference

### Test Server API

#### Start Test
```http
POST http://localhost:8081/test/{type}
```
**Types**: `health`, `upload`, `chat`, `full`

#### Get Status
```http
GET http://localhost:8081/status
```

#### Health Check
```http
GET http://localhost:8081/health
```

#### API Documentation
```http
GET http://localhost:8081/api/docs
```

### WebSocket Events

#### Connection
```javascript
ws://localhost:8081
```

#### Event Types
- `step`: Process step updates
- `api_call`: API request/response info
- `error`: Error notifications
- `connection`: Connection status changes

## 🎛️ Configuration

### Environment Variables
```bash
# Test server port (default: 8081)
TEST_MONITOR_PORT=8081

# Target backend URL (default: http://localhost:5000)
SMLGPT_BACKEND_URL=http://localhost:5000

# Target frontend URL (default: http://localhost:3000)
SMLGPT_FRONTEND_URL=http://localhost:3000
```

### Test Customization
Edit `flowTracer.js` to modify:
- API endpoints
- Timeout values
- Test data
- Report formats

## 🚨 Performance Impact

### Monitoring Overhead
- **WebSocket connections**: Minimal impact
- **Network interception**: < 5ms per request
- **Video recording**: Requires ~100MB disk space per test

### Best Practices
- Run monitoring during development/debugging only
- Close browser windows when E2E tests complete
- Clear test artifacts regularly to save disk space

## 🔄 Integration with SMLGPT

### Automatic Integration
The testing framework automatically detects and monitors:
- All API calls to `localhost:5000` (backend)
- All requests from `localhost:3000` (frontend)
- Azure service interactions
- File upload workflows
- Chat processing pipelines

### Manual Integration
To monitor custom endpoints, update the base URL in test scenarios:
```javascript
const tester = new SMGPTTestScenarios('http://your-custom-backend:port');
```

## 📞 Support

### Debug Information Collection
When reporting issues, include:
1. Test output logs
2. Generated JSON reports
3. Screenshots from failed tests
4. Network HAR files
5. Console error messages

### Log Levels
- **INFO**: Normal operation
- **SUCCESS**: Completed successfully  
- **WARNING**: Non-critical issues
- **ERROR**: Test failures or critical problems

---

## 🎉 Success Indicators

✅ **Healthy System**:
- All health checks pass
- File uploads complete within 30 seconds
- Chat responses received within 60 seconds
- No error messages in dashboard
- Success rate > 95%

❌ **Unhealthy System**:
- Health checks fail consistently
- Upload timeouts or errors
- Chat analysis failures
- High error count
- Success rate < 80%

This framework provides comprehensive visibility into your SMLGPT system's performance and helps identify bottlenecks, failures, and optimization opportunities.
