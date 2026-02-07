<div align="center">

<img src="https://static.zebrabyte.ro/web/image/3839-d356d2ee/logo-zebra-white.webp" alt="ZebraByte Logo" width="300"/>

# ZebraByte Dark Web Intelligence Scanner

**AI-Powered OSINT | Professional Dark Web Monitoring**

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-green.svg)](https://fastapi.tiangolo.com/)
[![Streamlit](https://img.shields.io/badge/Streamlit-1.40.0-red.svg)](https://streamlit.io/)
[![License](https://img.shields.io/badge/License-Proprietary-black.svg)](https://zebrabyte.ro)

🔍 Advanced dark web intelligence gathering using AI-powered analysis  
🧠 Multi-LLM support (OpenAI, Anthropic, Google, Ollama)  
📊 Comprehensive OSINT reports with automated scraping  

[🌐 Website](https://zebrabyte.ro) | [📧 Contact](mailto:contact@zebrabyte.ro) | [📱 +40.316.302.226](tel:+40316302226)

</div>

---

## 🦓 About ZebraByte

**ZebraByte** is a leading cybersecurity intelligence company specializing in:  
- 🛡️ **Dark Web Monitoring** - Real-time threat intelligence  
- 🔍 **OSINT Services** - Open-source intelligence gathering  
- 🧠 **AI-Powered Analysis** - Advanced LLM-based insights  
- 📊 **Security Consulting** - Professional cybersecurity advisory

This tool is part of ZebraByte's professional intelligence suite, designed for security researchers, analysts, and organizations requiring comprehensive dark web monitoring capabilities.

---

## ✨ Features

### 🔍 Intelligent Search
- **AI Query Refinement** - Automatically optimize search queries using LLM  
- **Multi-Source Crawling** - Search across multiple dark web sources  
- **Parallel Processing** - Configurable multi-threaded scraping

### 🧠 AI Analysis
- **Auto-Model Detection** - Automatically selects available LLM provider  
- **Multi-LLM Support**:  
  - OpenAI (GPT-4, GPT-4o-mini)  
  - Anthropic (Claude 3.5 Sonnet)  
  - Google (Gemini 1.5 Flash)  
  - Ollama (Local models)  
- **Smart Filtering** - LLM-powered result relevance filtering  
- **Intelligent Summarization** - Comprehensive threat intelligence reports

### 📊 Professional Interface
- **Streamlit Web UI** - Beautiful, user-friendly interface with ZebraByte branding  
- **FastAPI Backend** - High-performance REST API for integrations  
- **Cloudflare Worker** - Global edge deployment for minimal latency

### 🚀 Deployment Ready
- **Railway Integration** - One-click cloud deployment  
- **Docker Support** - Containerized deployment  
- **Environment Configuration** - Flexible API key management

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+  
- API key for at least one LLM provider (OpenAI, Anthropic, Google, or Ollama)

### Installation

1. **Clone the repository**  
```bash
git clone https://github.com/liviubucel/zebrabyte-darkweb-scan.git  
cd zebrabyte-darkweb-scan
```

2. **Install dependencies**  
```bash
pip install -r requirements.txt
```

3. **Configure API keys**  
Create a `.env` file in the root directory:  
```env
# Choose at least one:
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
GOOGLE_API_KEY=your_google_key_here

# Optional: Ollama (local models, no API key needed)
```

4. **Run the application**

**Option A: Streamlit UI (Recommended)**  
```bash
streamlit run ui.py
```  
Access at: `http://localhost:8501`

**Option B: FastAPI Backend**  
```bash
uvicorn api_server:app --host 0.0.0.0 --port 8000
```  
API at: `http://localhost:8000`

---

## 🎯 Usage

### Web Interface (Streamlit)

1. **Open the UI** - Navigate to `http://localhost:8501`  
2. **Enter Query** - Type your dark web search query (e.g., "data breach", "leaked credentials")  
3. **Start Scan** - Click "🚀 Start Scan"  
4. **Review Results** - View AI-generated summary and detailed findings  
5. **Download Report** - Export complete intelligence report

### API Usage (FastAPI)

**Endpoint:** `POST /api/darkweb-scan`

**Request:**  
```json
{
  "query": "company data breach",
  "threads": 4,
  "model": "gpt-4o-mini"
}
```

**Response:**  
```json
{
  "query": "company data breach",
  "refined_query": "recent corporate data breaches stolen credentials",
  "timestamp": "2024-02-07T18:00:00",
  "results": [
    {
      "title": "Result Title",
      "url": "https://...",
      "snippet": "Content preview..."
    }
  ],
  "summary": "AI-generated intelligence summary...",
  "total_results": 10
}
```

**cURL Example:**  
```bash
curl -X POST https://zebrabyte.up.railway.app/api/darkweb-scan \
  -H "Content-Type: application/json" \
  -d '{
    "query": "ransomware groups",
    "threads": 4
  }'
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│         Cloudflare Worker (Global Edge)         │
│            Frontend + API Proxy Layer           │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│          Railway Backend (Python)               │
│  ┌──────────────────────────────────────────┐   │
│  │  FastAPI REST API (api_server.py)       │   │
│  │  • POST /api/darkweb-scan                │   │
│  │  • GET /health                           │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  Streamlit Web UI (ui.py)               │   │
│  │  • Interactive interface                 │   │
│  │  • Real-time scanning                    │   │
│  │  • Report generation                     │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  Core Engine                             │   │
│  │  • search.py - Dark web crawling         │   │
│  │  • scrape.py - Content extraction        │   │
│  │  • llm.py - AI analysis                  │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │   LLM Providers     │
        │ • OpenAI            │
        │ • Anthropic         │
        │ • Google            │
        │ • Ollama (local)    │
        └─────────────────────┘
```

---

## 📦 Project Structure

```
zebrabyte-darkweb-scan/
├── ui.py                    # Streamlit web interface (ZebraByte branded)
├── api_server.py           # FastAPI REST API backend
├── llm.py                  # LLM integration (OpenAI, Anthropic, Google, Ollama)
├── search.py               # Dark web search engine
├── scrape.py               # Multi-threaded content scraper
├── requirements.txt        # Python dependencies
├── runtime.txt             # Python version specification
├── Procfile                # Railway deployment config
├── railway.json            # Railway service configuration
├── cloudflare-worker/      # Edge deployment
│   ├── worker.js          # Cloudflare Worker script
│   └── wrangler.toml      # Worker configuration
└── README.md              # This file
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for GPT models | One of these |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | is required |
| `GOOGLE_API_KEY` | Google API key for Gemini | |
| `PORT` | Server port (default: 8000) | No |

### Supported LLM Models

**OpenAI:**
- `gpt-4o-mini` (recommended, fast & cost-effective)
- `gpt-4o`
- `gpt-4-turbo`

**Anthropic:**
- `claude-3-5-sonnet-20241022` (recommended)
- `claude-3-opus-20240229`

**Google:**
- `gemini-1.5-flash` (recommended)
- `gemini-1.5-pro`

**Ollama (Local):**
- `llama3.2:3b`
- Any locally available model

---

## 🚀 Deployment

### Railway (Recommended)

1. **Fork this repository**  
2. **Connect to Railway:**  
   - Go to [railway.app](https://railway.app)  
   - Click "New Project" → "Deploy from GitHub repo"  
   - Select your forked repository  
3. **Add environment variables:**  
   - Add your LLM API keys in Railway dashboard  
4. **Deploy!** - Railway automatically detects and deploys

**Live URL:** `https://zebrabyte.up.railway.app`

### Cloudflare Workers

1. **Install Wrangler CLI:**  
```bash
npm install -g wrangler
```

2. **Deploy worker:**  
```bash
cd cloudflare-worker
wrangler deploy
```

### Docker (Coming Soon)

```bash
docker build -t zebrabyte-darkweb-scan .
docker run -p 8000:8000 -e OPENAI_API_KEY=your_key zebrabyte-darkweb-scan
```

---

## 🛡️ Security & Privacy

- ⚠️ **Professional Use Only** - This tool is designed for authorized security research
- 🔒 **API Key Security** - Never commit API keys to version control
- 🌐 **Network Security** - Consider using VPN/Tor for enhanced anonymity
- 📊 **Data Handling** - All scanned data is processed in-memory, no persistent storage
- 🔐 **Compliance** - Ensure compliance with local laws and regulations

---

## 📞 Support & Contact

**ZebraByte Cybersecurity Intelligence**

- 🌐 **Website:** [zebrabyte.ro](https://zebrabyte.ro)
- 📧 **Email:** [contact@zebrabyte.ro](mailto:contact@zebrabyte.ro)
- 📱 **Phone:** [+40.316.302.226](tel:+40316302226)
- 🏢 **Enterprise Inquiries:** Available for custom deployments and integrations

---

## 📄 License

© 2024 ZebraByte. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

For licensing inquiries, contact: [contact@zebrabyte.ro](mailto:contact@zebrabyte.ro)

---

## 🙏 Credits

**Developed by ZebraByte Team**  
Based on Robin OSINT framework, enhanced with enterprise-grade features and ZebraByte intelligence capabilities.

**Technologies:**
- Python 3.11+
- FastAPI & Streamlit
- LangChain
- BeautifulSoup4
- Cloudflare Workers

---

<div align="center">

**🦓 ZebraByte - Professional Cybersecurity Intelligence**

[Website](https://zebrabyte.ro) • [Contact](mailto:contact@zebrabyte.ro) • [Phone](tel:+40316302226)

</div>