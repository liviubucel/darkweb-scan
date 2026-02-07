export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // API endpoint - proxy to Python backend
    if (url.pathname === '/api/scan' && request.method === 'POST') {
      return handleScanProxy(request, env, corsHeaders);
    }
    
    // Client branding
    const client = {
      name: 'ZebraByte',
      logo: 'https://static.zebrabyte.ro/web/image/3839-d356d2ee/logo-zebra-white.webp',
      primaryColor: '#000000',
      website: 'https://zebrabyte.ro',
      contactEmail: 'contact@zebrabyte.ro',
      phone: '+40.316.302.226'
    };
    
    return new Response(getHTML(client), {
      headers: { 
        'content-type': 'text/html;charset=UTF-8',
        ...corsHeaders
      },
    });
  },
};

async function handleScanProxy(request, env, corsHeaders) {
  try {
    const { target } = await request.json();
    
    if (!target) {
      return new Response(
        JSON.stringify({ error: 'Target required' }), 
        { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } }
      );
    }
    
    // Get Python backend URL from environment
    const BACKEND_URL = env.PYTHON_BACKEND_URL || 'http://localhost:8000';
    
    // Forward to Python backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/darkweb-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: target })
    });
    
    if (!backendResponse.ok) {
      throw new Error(`Backend error: ${backendResponse.statusText}`);
    }
    
    const data = await backendResponse.json();
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'content-type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { 'content-type': 'application/json', ...corsHeaders } }
    );
  }
}

function getHTML(client) {
  return `<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dark Web Intelligence Scanner | ${client.name}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #fff;
            color: #1a1a1a;
            line-height: 1.6;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 0 20px; }
        header { border-bottom: 1px solid #e5e7eb; padding: 20px 0; }
        .header-content { display: flex; justify-content: space-between; align-items: center; }
        .logo { display: inline-block; text-decoration: none; transition: opacity 0.2s; }
        .logo:hover { opacity: 0.7; }
        .logo img { height: 40px; filter: brightness(0); display: block; }
        .header-right { display: flex; gap: 20px; align-items: center; }
        .lang-switch { display: flex; gap: 10px; }
        .lang-btn {
            padding: 6px 12px;
            border: 1px solid #e5e7eb;
            background: #fff;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
        }
        .lang-btn.active {
            background: ${client.primaryColor};
            color: white;
            border-color: ${client.primaryColor};
        }
        .hero { text-align: center; padding: 60px 20px 40px; }
        .hero h1 { font-size: 48px; font-weight: 700; margin-bottom: 16px; color: ${client.primaryColor}; }
        .hero p { font-size: 18px; color: #666; margin-bottom: 40px; }
        .scan-form { max-width: 700px; margin: 0 auto 40px; }
        .input-group {
            display: flex;
            gap: 12px;
            background: #f9fafb;
            padding: 8px;
            border-radius: 12px;
            border: 2px solid #e5e7eb;
        }
        .scan-input {
            flex: 1;
            padding: 14px 20px;
            border: none;
            background: white;
            border-radius: 8px;
            font-size: 16px;
        }
        .scan-btn {
            padding: 14px 40px;
            background: ${client.primaryColor};
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
        }
        .scan-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .loading {
            text-align: center;
            padding: 60px 20px;
            display: none;
        }
        .loading.active { display: block; }
        .spinner {
            width: 60px;
            height: 60px;
            border: 5px solid #e5e7eb;
            border-top-color: ${client.primaryColor};
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 30px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .results {
            max-width: 900px;
            margin: 40px auto;
            padding: 30px;
            background: white;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            display: none;
        }
        .results.active { display: block; }
        .result-item {
            padding: 20px;
            margin-bottom: 15px;
            background: #f9fafb;
            border-left: 4px solid ${client.primaryColor};
            border-radius: 8px;
        }
        .result-title { font-weight: 700; font-size: 18px; margin-bottom: 8px; }
        .result-url { color: #666; font-size: 14px; margin-bottom: 8px; word-break: break-all; }
        .result-snippet { color: #333; line-height: 1.6; }
        footer { border-top: 1px solid #e5e7eb; padding: 40px 0; text-align: center; }
        @media (max-width: 768px) {
            .hero h1 { font-size: 32px; }
            .input-group { flex-direction: column; }
        }
    </style>
</head>
<body>
    <header>
        <div class="container">
            <div class="header-content">
                <a href="${client.website}" class="logo">
                    <img src="${client.logo}" alt="${client.name}">
                </a>
                <div class="header-right">
                    <div class="lang-switch">
                        <button class="lang-btn active" data-lang="ro">RO</button>
                        <button class="lang-btn" data-lang="en">EN</button>
                    </div>
                    <a href="${client.website}" class="header-link">Înapoi la site</a>
                </div>
            </div>
        </div>
    </header>

    <main>
        <div class="container">
            <section class="hero">
                <h1 id="title">Dark Web Intelligence Scanner</h1>
                <p id="subtitle">Scanare Dark Web cu AI - OSINT profesional</p>
                
                <div class="scan-form">
                    <div class="input-group">
                        <input type="text" class="scan-input" id="target" placeholder="Introdu termenul de căutare...">
                        <button class="scan-btn" id="scanBtn">Scanează</button>
                    </div>
                </div>
            </section>

            <div class="loading" id="loading">
                <div class="spinner"></div>
                <p id="loadingText">Scanare în desfășurare...</p>
            </div>

            <div class="results" id="results"></div>
        </div>
    </main>

    <footer>
        <div class="container">
            <p>© 2024 ${client.name}. Dark Web Intelligence Scanner.</p>
        </div>
    </footer>

    <script>
        const translations = {
            ro: {
                title: 'Dark Web Intelligence Scanner',
                subtitle: 'Scanare Dark Web cu AI - OSINT profesional',
                placeholder: 'Introdu termenul de căutare...',
                scan: 'Scanează',
                loadingText: 'Scanare în desfășurare...',
                noResults: 'Niciun rezultat găsit',
                error: 'Eroare la scanare'
            },
            en: {
                title: 'Dark Web Intelligence Scanner',
                subtitle: 'AI-Powered Dark Web Scanning - Professional OSINT',
                placeholder: 'Enter search term...',
                scan: 'Scan',
                loadingText: 'Scanning...',
                noResults: 'No results found',
                error: 'Scan error'
            }
        };
        
        let currentLang = 'ro';
        
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                currentLang = this.getAttribute('data-lang');
                document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                updateTranslations();
            });
        });
        
        function updateTranslations() {
            const t = translations[currentLang];
            document.getElementById('title').textContent = t.title;
            document.getElementById('subtitle').textContent = t.subtitle;
            document.getElementById('target').placeholder = t.placeholder;
            document.getElementById('scanBtn').textContent = t.scan;
            document.getElementById('loadingText').textContent = t.loadingText;
        }
        
        document.getElementById('scanBtn').addEventListener('click', startScan);
        document.getElementById('target').addEventListener('keypress', e => {
            if (e.key === 'Enter') startScan();
        });
        
        async function startScan() {
            const target = document.getElementById('target').value.trim();
            if (!target) {
                alert(currentLang === 'ro' ? 'Introduceți un termen' : 'Enter a search term');
                return;
            }
            
            document.getElementById('loading').classList.add('active');
            document.getElementById('results').classList.remove('active');
            document.getElementById('scanBtn').disabled = true;
            
            try {
                const response = await fetch('/api/scan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target }),
                });
                
                if (!response.ok) {
                    throw new Error('Scan failed');
                }
                
                const data = await response.json();
                
                setTimeout(() => {
                    document.getElementById('loading').classList.remove('active');
                    showResults(data);
                }, 500);
                
            } catch (error) {
                console.error('Error:', error);
                alert(translations[currentLang].error + ': ' + error.message);
                document.getElementById('loading').classList.remove('active');
            }
            
            document.getElementById('scanBtn').disabled = false;
        }
        
        function showResults(data) {
            const resultsDiv = document.getElementById('results');
            resultsDiv.innerHTML = '';
            
            if (!data.results || data.results.length === 0) {
                resultsDiv.innerHTML = '<p style="text-align:center">' + translations[currentLang].noResults + '</p>';
                resultsDiv.classList.add('active');
                return;
            }
            
            data.results.forEach(result => {
                const item = document.createElement('div');
                item.className = 'result-item';
                item.innerHTML = `
                    <div class="result-title">${result.title || 'Result'}</div>
                    <div class="result-url">${result.url || ''}</div>
                    <div class="result-snippet">${result.snippet || result.description || ''}</div>
                `;
                resultsDiv.appendChild(item);
            });
            
            resultsDiv.classList.add('active');
        }
    </script>
</body>
</html>`;
}