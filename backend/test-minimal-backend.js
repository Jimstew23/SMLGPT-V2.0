require('dotenv').config();
const express = require('express');

console.log('🔍 Testing minimal backend startup...');

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(express.json());

// Simple health endpoint
app.get('/api/health', (req, res) => {
  console.log('Health endpoint hit');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Simple test endpoint
app.post('/api/test', (req, res) => {
  console.log('Test endpoint hit');
  res.json({ message: 'Backend is responding', body: req.body });
});

app.listen(PORT, () => {
  console.log(`✅ Minimal backend running on port ${PORT}`);
  console.log('Ready to test API endpoints');
});

console.log('Backend startup script completed');
