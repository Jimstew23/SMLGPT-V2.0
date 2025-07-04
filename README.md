# SMLGPT V2.0 - AI Safety Analysis Platform

## Overview
SMLGPT V2.0 is a comprehensive AI-powered safety analysis platform built for Georgia-Pacific 2025 SML compliance standards. The system provides advanced document analysis, image hazard detection, and intelligent safety recommendations through a professional ChatGPT-style interface.

## Features
- 🛡️ **AI Safety Analysis** with GPT-4.5 and Azure Cognitive Services
- 📁 **File Upload & Processing** (Images, PDFs, DOCX, TXT)
- 🎤 **Voice Input/Output** with Azure Speech Services
- 🔍 **Vector Search** with Azure Cognitive Search and Cohere embeddings
- 🌙 **Dark Theme UI** with professional safety branding
- 📊 **SML Category Detection** and compliance scoring
- 🔒 **Enterprise Security** with rate limiting and CORS protection

## Architecture
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + Azure Services
- **AI**: Azure OpenAI GPT-4.5 + Cohere Embed-v4.0
- **Storage**: Azure Blob Storage + Azure Cognitive Search
- **Speech**: Azure Speech Services

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Azure subscription with required services
- Cohere API account

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Update .env with your Azure and Cohere credentials
npm start
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

## Environment Variables
See `.env.example` for required Azure and Cohere credentials.

## Azure Services Required
- Azure Cognitive Services Multi-Service
- Azure Blob Storage
- Azure Cognitive Search
- Azure OpenAI (GPT-4.5)
- Azure Speech Services

## API Endpoints
- `POST /api/chat` - AI chat completions
- `POST /api/upload` - File upload and analysis
- `GET /api/search` - Document search
- `GET /api/health` - Health check

## Development
Built with professional safety standards and enterprise security practices.

## License
Proprietary - Georgia-Pacific Corporation 2025
#   S M L G P T - V 2 . 0  
 