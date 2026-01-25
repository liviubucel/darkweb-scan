# Quick Deployment Reference

## ⚠️ Important: Netlify is NOT supported

Robin cannot be deployed to Netlify. See [DEPLOYMENT.md](DEPLOYMENT.md) for details.

## 🚀 Quick Deploy Options

### 1. Render.com (Easiest - One Click)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com)

**Steps:**
1. Click button above or go to render.com
2. Create new Web Service
3. Connect this GitHub repo
4. Configuration is automatic (uses `render.yaml`)
5. Add your API keys as environment variables
6. Deploy!

**Config file:** `render.yaml` ✅

---

### 2. Railway.app (Automatic)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app)

**Steps:**
1. Sign up at railway.app
2. New Project → Deploy from GitHub
3. Select this repository
4. Add API keys as variables
5. Deploy!

**Config file:** `railway.json` ✅

---

### 3. Heroku (Traditional PaaS)

**Steps:**
1. Install Heroku CLI
2. `heroku create your-app-name`
3. `heroku buildpacks:set heroku/python`
4. `heroku buildpacks:add --index 1 heroku-community/apt`
5. `heroku config:set OPENAI_API_KEY=your_key`
6. `git push heroku main`

**Config files:** `Procfile` + `Aptfile` ✅

---

### 4. Fly.io (Global Edge)

**Steps:**
1. Install flyctl
2. `fly launch`
3. `fly secrets set OPENAI_API_KEY=your_key`
4. `fly deploy`

**Uses:** `Dockerfile` ✅

---

### 5. Self-Hosted Docker

**Steps:**
```bash
docker run -d \
  -p 8501:8501 \
  -e OPENAI_API_KEY=your_key \
  --name robin \
  apurvsg/robin:latest
```

---

## 🔑 Required Environment Variables

All platforms need these:

```env
OPENAI_API_KEY=sk-...              # For GPT models
ANTHROPIC_API_KEY=sk-ant-...       # For Claude models  
GOOGLE_API_KEY=...                 # For Gemini models
OLLAMA_BASE_URL=http://...         # For Ollama (optional)
```

---

## 📖 Full Documentation

See [DEPLOYMENT.md](DEPLOYMENT.md) for:
- Detailed platform instructions
- Troubleshooting guide
- Security considerations
- Performance optimization
- Why Netlify doesn't work

---

## ❓ Need Help?

1. Check [DEPLOYMENT.md](DEPLOYMENT.md) first
2. Review platform-specific docs
3. Open a GitHub issue if stuck
