# ZebraByte Vulnerability Scanner - Integration Guide

## 🏗️ Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Cloudflare     │         │   Python FastAPI │         │   Dark Web      │
│  Worker         │◄───────►│   Backend        │◄───────►│   Scanner       │
│  (Frontend)     │  HTTP   │   (Brain)        │   API   │   (Existing)    │
└─────────────────┘         └──────────────────┘         └─────────────────┘
        │                            │
        │                            │
        ▼                            ▼
   User Browser              Advanced Analysis
   - HTML/CSS/JS             - SSL/TLS Testing
   - Language Switch         - Security Headers
   - Results Display         - Dark Web Intelligence
                             - OWASP Top 10 Checks
```

## 📁 File Structure

```
zebrabyte-darkweb-scan/
├── vuln_scanner.py              # NEW: Python FastAPI backend
├── cloudflare-worker/
│   ├── worker.js                # NEW: Cloudflare Worker frontend
│   ├── wrangler.toml            # NEW: Cloudflare config
│   └── README.md                # NEW: Deployment guide
├── main.py                      # Existing: CLI entry point
├── ui.py                        # Existing: Streamlit UI
├── scrape.py                    # Existing: Dark web scraping
├── search.py                    # Existing: Dark web search
├── llm.py                       # Existing: LLM integration
└── requirements.txt             # Updated with new dependencies
```

## 🚀 Quick Start

### Step 1: Start Python Backend

```bash
# Install dependencies
pip install -r requirements.txt

# Run the vulnerability scanner API
python -m uvicorn vuln_scanner:app --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`

### Step 2: Deploy Cloudflare Worker

```bash
cd cloudflare-worker

# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Configure backend URL in wrangler.toml
# Edit: PYTHON_BACKEND_URL = "http://your-server:8000"

# Deploy
wrangler deploy
```

### Step 3: Test Integration

1. Open your Cloudflare Worker URL (e.g., `https://zebrabyte-vuln-scanner.workers.dev`)
2. Enter a target domain
3. Check "Verificare Dark Web" for dark web intelligence
4. Click "Scanează"

## 🔧 Configuration

### Environment Variables

#### Cloudflare Worker (`wrangler.toml`)
```toml
[env.production.vars]
PYTHON_BACKEND_URL = "https://your-production-backend.com"

[env.development.vars]
PYTHON_BACKEND_URL = "http://localhost:8000"
```

#### Python Backend (`.env`)
```bash
# Already configured in your existing .env file
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

## 📡 API Endpoints

### POST /api/scan

**Request:**
```json
{
  "target": "example.com",
  "deep_analysis": true,
  "check_darkweb": true
}
```

**Response:**
```json
{
  "target": "https://example.com",
  "timestamp": "2024-01-15T10:30:00",
  "vulnerabilities": [...],
  "summary": {
    "critical": 2,
    "high": 5,
    "medium": 3,
    "low": 1,
    "info": 0,
    "total": 11
  },
  "metadata": {
    "scanDuration": 12.5,
    "testsPerformed": 12,
    "securityScore": 65,
    "targetInfo": {...}
  },
  "darkweb_intelligence": {
    "exposed": true,
    "mentions": 3,
    "risk_level": "high",
    "results": [...]
  }
}
```

## 🎯 Features

### Frontend (Cloudflare Worker)
- ✅ Beautiful responsive UI
- ✅ Multi-language support (Romanian/English)
- ✅ Real-time scanning feedback
- ✅ Vulnerability filtering
- ✅ JSON/PDF export
- ✅ FAQ section
- ✅ Contact information

### Backend (Python FastAPI)
- ✅ SSL/TLS advanced testing
- ✅ Certificate validation & expiry check
- ✅ Security headers analysis
- ✅ HSTS, CSP, CORS testing
- ✅ Cookie security checks
- ✅ HTTP methods analysis
- ✅ Dark web intelligence integration
- ✅ OWASP Top 10 mapping
- ✅ CWE classification
- ✅ CVSS scoring

## 🔒 Security Tests Performed

1. **SSL/TLS Analysis**
   - Certificate validity
   - Expiration warnings
   - TLS version check
   - Cipher suite analysis

2. **Security Headers**
   - X-Content-Type-Options
   - X-Frame-Options
   - Referrer-Policy
   - Permissions-Policy
   - HSTS
   - Content-Security-Policy

3. **Cookie Security**
   - Secure flag
   - HttpOnly flag
   - SameSite attribute

4. **CORS Policy**
   - Origin validation
   - Wildcard detection

5. **Information Disclosure**
   - Server header
   - X-Powered-By header
   - Technology fingerprinting

6. **HTTP Configuration**
   - Dangerous methods (PUT, DELETE, TRACE)
   - HTTPS redirect

7. **Deep Analysis** (optional)
   - Sensitive path exposure
   - Common vulnerable files
   - Directory traversal

8. **Dark Web Intelligence** (optional)
   - Domain mentions
   - Data breach detection
   - Risk level assessment

## 🔗 Integration with Existing Features

The vulnerability scanner integrates seamlessly with your existing dark web scanning:

```python
# In vuln_scanner.py
async def check_darkweb_exposure(target_url: str) -> Dict:
    from search import get_search_results
    from llm import get_llm, filter_results
    
    # Uses your existing dark web search functionality
    search_results = get_search_results(query, max_workers=3)
    llm = get_llm("gpt-4o-mini")
    filtered = filter_results(llm, query, search_results)
```

## 🐳 Docker Deployment

```dockerfile
# Add to your existing Dockerfile
EXPOSE 8000

# Run both services
CMD ["sh", "-c", "uvicorn vuln_scanner:app --host 0.0.0.0 --port 8000 & streamlit run ui.py"]
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:8000/health
```

Response:
```json
{
  "status": "healthy",
  "service": "ZebraByte Vulnerability Scanner"
}
```

## 🎨 Customization

### Branding
Edit `worker.js` to customize:
```javascript
const client = {
  name: 'Your Company',
  logo: 'https://your-logo-url.com/logo.png',
  primaryColor: '#your-color',
  website: 'https://your-website.com',
  contactEmail: 'contact@your-company.com',
  phone: 'your-phone'
};
```

## 📈 Performance

- **Frontend**: Edge-deployed via Cloudflare (global CDN)
- **Backend**: Async operations with httpx
- **Concurrent tests**: All vulnerability tests run in parallel
- **Average scan time**: 10-15 seconds (without dark web check)
- **With dark web**: +30-60 seconds depending on results

## 🛠️ Troubleshooting

### Backend Not Responding
```bash
# Check if backend is running
curl http://localhost:8000/health

# Check logs
python -m uvicorn vuln_scanner:app --log-level debug
```

### Cloudflare Worker Error
```bash
# Check worker logs
wrangler tail

# Test locally
wrangler dev
```

### Dark Web Integration Not Working
Ensure your `.env` file has valid API keys and the dark web scanning modules are accessible.

## 🚦 Next Steps

1. ✅ Python backend created (`vuln_scanner.py`)
2. ✅ Cloudflare Worker frontend created (`cloudflare-worker/worker.js`)
3. ✅ Dependencies updated (`requirements.txt`)
4. ⏳ Deploy Python backend to your server
5. ⏳ Deploy Cloudflare Worker
6. ⏳ Configure backend URL in worker
7. ⏳ Test end-to-end integration

## 📞 Support

For issues or questions:
- Email: contact@zebrabyte.ro
- Phone: +40.316.302.226
- Website: https://zebrabyte.ro