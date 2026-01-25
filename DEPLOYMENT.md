# Deployment Guide for Robin

## Why Netlify Doesn't Work ❌

**Robin cannot be deployed to Netlify** for the following technical reasons:

1. **Continuous Server Requirement**: Robin is a Streamlit application that requires a Python web server running continuously, not a static site
2. **Tor Service Dependency**: The application requires the Tor service to be installed and running in the background
3. **Active Processing**: Robin makes live HTTP requests through Tor to dark web search engines and performs real-time scraping
4. **Threading Operations**: The application uses threading for concurrent scraping operations
5. **Platform Limitations**: Netlify is designed for static sites and serverless functions with limited execution time

## Recommended Deployment Platforms ✅

### Option 1: Render.com (Recommended)
**Best for**: Easy deployment with free tier available

Render natively supports Docker containers and long-running web services.

#### Quick Start:
1. Fork this repository
2. Sign up at [render.com](https://render.com)
3. Create a new "Web Service"
4. Connect your GitHub repository
5. Use the included `render.yaml` configuration
6. Add environment variables (API keys)
7. Deploy!

See `render.yaml` in this repository for pre-configured settings.

---

### Option 2: Railway.app
**Best for**: Simple deployment with automatic CI/CD

Railway automatically detects Dockerfiles and handles deployment.

#### Quick Start:
1. Sign up at [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your forked repository
4. Add environment variables:
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `GOOGLE_API_KEY`
   - `OLLAMA_BASE_URL` (if using Ollama)
5. Railway will automatically build and deploy using the Dockerfile

---

### Option 3: Fly.io
**Best for**: Global edge deployment

Fly.io offers excellent Docker support with global distribution.

#### Quick Start:
1. Install flyctl: `curl -L https://fly.io/install.sh | sh`
2. Run: `fly launch` (in the project directory)
3. Set secrets: `fly secrets set OPENAI_API_KEY=your_key`
4. Deploy: `fly deploy`

---

### Option 4: Heroku
**Best for**: Traditional PaaS experience

#### Quick Start:
1. Install Heroku CLI
2. Create a new app: `heroku create your-app-name`
3. Set buildpack: `heroku buildpacks:set heroku/python`
4. Add apt buildpack for Tor: `heroku buildpacks:add --index 1 heroku-community/apt`
5. Create `Aptfile` with content: `tor`
6. Add Procfile: `web: python main.py ui --ui-port $PORT --ui-host 0.0.0.0`
7. Set environment variables: `heroku config:set OPENAI_API_KEY=your_key`
8. Deploy: `git push heroku main`

---

### Option 5: DigitalOcean App Platform
**Best for**: Integrated with DO ecosystem

1. Sign up at [digitalocean.com](https://digitalocean.com)
2. Create a new App
3. Connect your GitHub repository
4. Select "Dockerfile" as build method
5. Configure environment variables
6. Deploy

---

### Option 6: Self-Hosted (Docker)
**Best for**: Full control and privacy

Run on your own server using Docker:

```bash
# Build the image
docker build -t robin:latest .

# Run the container
docker run -d \
  --name robin \
  -p 8501:8501 \
  -e OPENAI_API_KEY=your_key \
  -e ANTHROPIC_API_KEY=your_key \
  -e GOOGLE_API_KEY=your_key \
  --restart unless-stopped \
  robin:latest
```

---

## Environment Variables Required

All platforms require these environment variables:

```env
OPENAI_API_KEY=sk-...              # For GPT models
ANTHROPIC_API_KEY=sk-ant-...       # For Claude models
GOOGLE_API_KEY=...                 # For Gemini models
OLLAMA_BASE_URL=http://...         # For local Ollama models (optional)
```

---

## Port Configuration

- **Default Port**: 8501 (Streamlit default)
- Most platforms automatically set `$PORT` environment variable
- The application is configured to use `0.0.0.0` as host for external access

---

## Resource Requirements

**Minimum:**
- RAM: 512MB
- CPU: 0.5 vCPU
- Storage: 1GB

**Recommended:**
- RAM: 1GB+
- CPU: 1 vCPU+
- Storage: 2GB+

---

## Security Considerations

⚠️ **Important Security Notes:**

1. **Never commit API keys** to version control
2. **Use environment variables** for all sensitive data
3. **Enable HTTPS** on your deployment platform
4. **Review the Disclaimer** in README.md regarding legal and ethical usage
5. **Monitor usage** of your LLM API keys to avoid unexpected charges

---

## Troubleshooting

### Tor Connection Issues
If you get "Tor connection failed" errors:
- Ensure Tor is installed in your container/environment
- Check if Tor service is running: `systemctl status tor` or `ps aux | grep tor`
- Verify SOCKS proxy is accessible on `127.0.0.1:9050`

### Port Binding Issues
If the app won't start:
- Check if port 8501 is available
- Ensure you're using `0.0.0.0` as host, not `localhost`
- Check platform-specific port requirements (some use `$PORT`)

### API Key Issues
If you get authentication errors:
- Verify environment variables are set correctly
- Check API key validity on provider's website
- Ensure no extra spaces in environment variable values

---

## Performance Optimization

1. **Adjust Thread Count**: Use fewer threads (2-4) on limited resources
2. **Cache Results**: Streamlit's `@st.cache_data` is already implemented
3. **Monitor Memory**: Large scraping operations can use significant RAM

---

## Need Help?

- Check the [main README](README.md) for general usage instructions
- Open an issue on GitHub for deployment-specific problems
- Review platform-specific documentation linked above
