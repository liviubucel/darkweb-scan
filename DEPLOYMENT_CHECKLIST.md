# Deployment Checklist ✅

Use this checklist when deploying Robin to ensure everything is configured correctly.

## Pre-Deployment

- [ ] **Read the documentation**
  - [ ] Review [DEPLOYMENT.md](DEPLOYMENT.md) for your chosen platform
  - [ ] Check [QUICK_DEPLOY.md](QUICK_DEPLOY.md) for quick reference
  
- [ ] **Gather API Keys** (get at least one)
  - [ ] OpenAI API Key (for GPT models) - [Get Key](https://platform.openai.com/api-keys)
  - [ ] Anthropic API Key (for Claude models) - [Get Key](https://console.anthropic.com/)
  - [ ] Google API Key (for Gemini models) - [Get Key](https://makersuite.google.com/app/apikey)
  - [ ] Ollama URL (if using local models) - [Setup Ollama](https://ollama.ai/)

- [ ] **Choose Your Platform**
  - [ ] Render.com (Recommended - easiest)
  - [ ] Railway.app (Very simple)
  - [ ] Fly.io (Global edge)
  - [ ] Heroku (Traditional PaaS)
  - [ ] DigitalOcean App Platform
  - [ ] Self-hosted Docker

## Deployment Steps

### If using Render.com:
- [ ] Fork this repository to your GitHub account
- [ ] Sign up at [render.com](https://render.com)
- [ ] Create new "Web Service"
- [ ] Connect your forked repository
- [ ] Render will auto-detect `render.yaml`
- [ ] Add environment variables in Render dashboard
- [ ] Click "Deploy"

### If using Railway.app:
- [ ] Sign up at [railway.app](https://railway.app)
- [ ] Click "New Project" → "Deploy from GitHub repo"
- [ ] Select your forked repository
- [ ] Railway will auto-detect `Dockerfile` and `railway.json`
- [ ] Add environment variables in Railway dashboard
- [ ] Automatic deployment starts

### If using Heroku:
- [ ] Install Heroku CLI
- [ ] Run `heroku create your-app-name`
- [ ] Run `heroku buildpacks:set heroku/python`
- [ ] Run `heroku buildpacks:add --index 1 heroku-community/apt`
- [ ] Set env vars: `heroku config:set OPENAI_API_KEY=your_key`
- [ ] Deploy: `git push heroku main`

### If using Fly.io:
- [ ] Install flyctl CLI
- [ ] Run `fly launch` in project directory
- [ ] Run `fly secrets set OPENAI_API_KEY=your_key`
- [ ] Run `fly deploy`

### If using Docker (self-hosted):
- [ ] Build: `docker build -t robin:latest .`
- [ ] Run with env vars (see [QUICK_DEPLOY.md](QUICK_DEPLOY.md))

## Post-Deployment

- [ ] **Verify Deployment**
  - [ ] Open the application URL
  - [ ] Check that the UI loads correctly
  - [ ] Verify Tor connection works
  - [ ] Test with a simple query

- [ ] **Security Check**
  - [ ] Confirm HTTPS is enabled
  - [ ] Verify environment variables are not exposed
  - [ ] Check that API keys are stored securely
  - [ ] Review firewall/access rules if applicable

- [ ] **Monitor Usage**
  - [ ] Check platform dashboard for resource usage
  - [ ] Monitor API key usage on provider dashboards
  - [ ] Set up alerts for unexpected charges (if applicable)

## Troubleshooting

If something doesn't work:

- [ ] Check platform logs for errors
- [ ] Verify all environment variables are set correctly
- [ ] Ensure Tor service is running (check logs)
- [ ] Review [DEPLOYMENT.md](DEPLOYMENT.md) troubleshooting section
- [ ] Check that API keys are valid and have credits
- [ ] Verify port configuration (should be $PORT on most platforms)

## Common Issues

| Issue | Solution |
|-------|----------|
| "Tor connection failed" | Check Tor installation in container logs |
| "API key invalid" | Verify env vars are set correctly, no extra spaces |
| Port binding error | Ensure using 0.0.0.0 as host, not localhost |
| Build fails | Check Dockerfile and platform-specific requirements |

## Need Help?

- 📖 Read [DEPLOYMENT.md](DEPLOYMENT.md)
- 🚀 Check [QUICK_DEPLOY.md](QUICK_DEPLOY.md)
- 📝 Review platform-specific documentation
- 🐛 Open a GitHub issue with details

## Success! 🎉

Once deployed successfully:
- Your Robin instance should be accessible at your platform's URL
- You can run dark web OSINT investigations
- Remember to follow the disclaimer and use responsibly
- Consider setting up monitoring and backups

---

**Important**: This is not a Netlify application. If you were trying to deploy to Netlify, please review why it won't work in [DEPLOYMENT.md](DEPLOYMENT.md).
