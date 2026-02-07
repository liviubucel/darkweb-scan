import streamlit as st
import os
import json
from datetime import datetime

# Import custom modules
from search import search_function
from scrape import scrape_function
from llm import detect_model, run_llm_analysis

# ===================================
# ZebraByte Branding Configuration
# ===================================
st.set_page_config(
    page_title='ZebraByte Dark Web Intelligence Scanner',
    page_icon='🦓',
    layout='wide',
    initial_sidebar_state='expanded'
)

# Custom CSS for ZebraByte Design
st.markdown("""
<style>
    /* Global Theme */
    .stApp {
        background-color: #0a0a0a;
        color: #ffffff;
    }
    
    /* Header Styling */
    header {
        background-color: #000000 !important;
    }
    
    /* Logo Container */
    .logo-container {
        text-align: center;
        padding: 20px 0;
        background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
        border-bottom: 2px solid #333;
        margin-bottom: 30px;
    }
    
    /* Main Content */
    .main-content {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
    }
    
    /* Input Fields */
    .stTextInput > div > div > input {
        background-color: #1a1a1a;
        color: #ffffff;
        border: 2px solid #333;
        border-radius: 8px;
        padding: 12px;
        font-size: 16px;
    }
    
    .stTextInput > div > div > input:focus {
        border-color: #666;
        box-shadow: 0 0 10px rgba(255,255,255,0.1);
    }
    
    /* Buttons */
    .stButton > button {
        background-color: #000000;
        color: #ffffff;
        border: 2px solid #333;
        border-radius: 8px;
        padding: 12px 30px;
        font-size: 16px;
        font-weight: 600;
        transition: all 0.3s ease;
    }
    
    .stButton > button:hover {
        background-color: #1a1a1a;
        border-color: #666;
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(255,255,255,0.1);
    }
    
    /* Results Container */
    .result-card {
        background-color: #1a1a1a;
        border: 1px solid #333;
        border-radius: 10px;
        padding: 20px;
        margin: 15px 0;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }
    
    /* Sidebar */
    .css-1d391kg {
        background-color: #0f0f0f;
    }
    
    /* Model Indicator */
    .model-badge {
        display: inline-block;
        background-color: #1a1a1a;
        color: #00ff00;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        border: 1px solid #333;
        margin: 10px 0;
    }
    
    /* Footer */
    .footer {
        text-align: center;
        padding: 30px 0;
        margin-top: 50px;
        border-top: 2px solid #333;
        color: #999;
    }
    
    .footer a {
        color: #ffffff;
        text-decoration: none;
        transition: color 0.3s ease;
    }
    
    .footer a:hover {
        color: #cccccc;
    }
    
    /* Progress Indicator */
    .stProgress > div > div {
        background-color: #000000;
    }
</style>
""", unsafe_allow_html=True)

# ===================================
# Logo Header
# ===================================
st.markdown('<div class="logo-container">', unsafe_allow_html=True)
st.image('https://static.zebrabyte.ro/web/image/3839-d356d2ee/logo-zebra-white.webp', width=350)
st.markdown('</div>', unsafe_allow_html=True)

# ===================================
# Main Title
# ===================================
st.title('🦓 ZebraByte Dark Web Intelligence Scanner')
st.markdown('**AI-Powered OSINT | Professional Dark Web Monitoring**')
st.markdown('---')

# ===================================
# Auto-Detect LLM Model
# ===================================
available_model_keys = {
    'OPENAI_API_KEY': 'OpenAI (GPT-4)',
    'ANTHROPIC_API_KEY': 'Anthropic (Claude)',
    'GOOGLE_API_KEY': 'Google (Gemini)',
    'OLLAMA_BASE_URL': 'Ollama (Local)'
}

selected_model = None
model_name = None

for env_key, display_name in available_model_keys.items():
    if os.getenv(env_key):
        selected_model = env_key.split('_')[0].lower()
        model_name = display_name
        break

# Display Model Status
if not selected_model:
    st.error('❌ No LLM model available! Please configure an API key.')
    st.info('Add one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, or configure Ollama')
    st.stop()
else:
    st.markdown(f'<div class="model-badge">🤖 Active Model: {model_name}</div>', unsafe_allow_html=True)
    st.success(f'✅ System ready with {model_name}')

st.markdown('---')

# ===================================
# Search Interface
# ===================================
st.subheader('🔍 Dark Web Search Query')

col1, col2 = st.columns([3, 1])

with col1:
    query = st.text_input(
        'Enter search query',
        placeholder='e.g., data breach, leaked credentials, ransomware...',
        help='Enter keywords to search the dark web'
    )

with col2:
    threads = st.number_input(
        'Threads',
        min_value=1,
        max_value=10,
        value=4,
        help='Number of parallel scraping threads'
    )

# ===================================
# Scan Execution
# ===================================
if st.button('🚀 Start Scan', use_container_width=True):
    if not query:
        st.warning('⚠️ Please enter a search query')
    else:
        # Progress tracking
        progress_bar = st.progress(0)
        status_text = st.empty()
        
        try:
            # Step 1: Search
            status_text.text('🔍 Searching dark web sources...')
            progress_bar.progress(25)
            
            results = search_function(query, threads)
            
            progress_bar.progress(50)
            
            # Step 2: Scrape
            status_text.text('📡 Scraping content...')
            scraped_data = scrape_function(results, threads)
            
            progress_bar.progress(75)
            
            # Step 3: AI Analysis
            status_text.text('🧠 Running AI analysis...')
            summary = run_llm_analysis(scraped_data, selected_model)
            
            progress_bar.progress(100)
            status_text.text('✅ Scan completed!')
            
            st.success(f'✅ Found {len(results)} results')
            
            # ===================================
            # Display Results
            # ===================================
            st.markdown('---')
            st.subheader('📊 Intelligence Summary')
            
            with st.expander('🧠 AI-Generated Summary', expanded=True):
                st.markdown(summary)
            
            st.markdown('---')
            st.subheader(f'🔎 Detailed Findings ({len(results)} results)')
            
            for idx, result in enumerate(results, 1):
                with st.expander(f'Result #{idx}: {result.get("title", "No title")}'):
                    st.markdown(f'**URL:** {result.get("url", "N/A")}')
                    st.markdown(f'**Content:**')
                    st.text(result.get("content", "No content available"))
            
            # ===================================
            # Download Report
            # ===================================
            st.markdown('---')
            
            report_data = {
                'query': query,
                'timestamp': datetime.now().isoformat(),
                'model_used': model_name,
                'total_results': len(results),
                'summary': summary,
                'results': results
            }
            
            report_json = json.dumps(report_data, indent=2)
            
            col1, col2, col3 = st.columns([1, 2, 1])
            with col2:
                st.download_button(
                    label='📥 Download Complete Report (JSON)',
                    data=report_json,
                    file_name=f'zebrabyte_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json',
                    mime='application/json',
                    use_container_width=True
                )
        
        except Exception as e:
            st.error(f'❌ Error during scan: {str(e)}')
            st.info('Please check your configuration and try again')

# ===================================
# Sidebar Information
# ===================================
with st.sidebar:
    st.markdown('### ℹ️ About')
    st.markdown("""
    **ZebraByte Dark Web Intelligence Scanner**
    
    Advanced OSINT tool for dark web monitoring and threat intelligence.
    
    **Features:**
    - 🔍 Multi-source crawling
    - 🧠 AI-powered analysis
    - 📊 Comprehensive reporting
    - ⚡ Parallel processing
    """)
    
    st.markdown('---')
    st.markdown('### 🛡️ Security Tips')
    st.markdown("""
    - Use VPN/Tor for anonymity
    - Authorized research only
    - Follow local regulations
    - Protect sensitive data
    """)
    
    st.markdown('---')
    st.markdown('### 📞 Contact')
    st.markdown("""
    **ZebraByte**  
    📧 contact@zebrabyte.ro  
    📱 +40.316.302.226  
    🌐 [zebrabyte.ro](https://zebrabyte.ro)
    """)

# ===================================
# Footer
# ===================================
st.markdown('<div class="footer">', unsafe_allow_html=True)
st.markdown("""
---
**© 2024 ZebraByte. All Rights Reserved.**  
Professional Cybersecurity Intelligence | [Website](https://zebrabyte.ro) | [Contact](mailto:contact@zebrabyte.ro) | +40.316.302.226
""")
st.markdown('</div>', unsafe_allow_html=True)