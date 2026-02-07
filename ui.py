import streamlit as st
import os
import json
from datetime import datetime

# Import custom modules
from search import search_function
from scrape import scrape_function
from llm import detect_model, run_llm_analysis

# ========================================
# PAGE CONFIG & BRANDING
# ========================================
st.set_page_config(
    page_title='ZebraByte Dark Web Intelligence Scanner',
    page_icon='🦓',
    layout='wide',
    initial_sidebar_state='expanded'
)

# Custom CSS for ZebraByte branding
st.markdown("""
<style>
    /* Main background */
    .stApp {
        background-color: #0a0a0a;
        color: #ffffff;
    }
    
    /* Headers */
    h1, h2, h3 {
        color: #ffffff !important;
        font-weight: 700;
    }
    
    /* Buttons */
    .stButton>button {
        background-color: #000000;
        color: white;
        border: 2px solid #333;
        border-radius: 8px;
        padding: 12px 24px;
        font-weight: 600;
        transition: all 0.3s;
    }
    
    .stButton>button:hover {
        background-color: #222;
        border-color: #555;
        transform: translateY(-2px);
    }
    
    /* Input fields */
    .stTextInput>div>div>input {
        background-color: #1a1a1a;
        color: white;
        border: 1px solid #333;
        border-radius: 6px;
    }
    
    /* Sidebar */
    .css-1d391kg {
        background-color: #0f0f0f;
    }
    
    /* Success/Info boxes */
    .stSuccess {
        background-color: #1a3d1a;
        border-left: 4px solid #4caf50;
    }
    
    .stInfo {
        background-color: #1a2a3d;
        border-left: 4px solid #2196f3;
    }
    
    /* Logo container */
    .logo-container {
        text-align: center;
        padding: 20px 0;
        margin-bottom: 30px;
    }
    
    /* Footer */
    .footer {
        text-align: center;
        padding: 30px 0;
        margin-top: 50px;
        border-top: 1px solid #333;
        color: #999;
    }
    
    .footer a {
        color: #fff;
        text-decoration: none;
        transition: color 0.3s;
    }
    
    .footer a:hover {
        color: #ccc;
    }
</style>
""", unsafe_allow_html=True)

# ========================================
# LOGO & HEADER
# ========================================
col1, col2, col3 = st.columns([1, 2, 1])
with col2:
    st.markdown('<div class="logo-container">', unsafe_allow_html=True)
    st.image('https://static.zebrabyte.ro/web/image/3839-d356d2ee/logo-zebra-white.webp', width=300)
    st.markdown('</div>', unsafe_allow_html=True)

st.title('🦓 Dark Web Intelligence Scanner')
st.markdown('**Professional OSINT | AI-Powered Analysis**')
st.markdown('---')

# ========================================
# SIDEBAR - SETTINGS
# ========================================
with st.sidebar:
    st.header('⚙️ Settings')
    
    # Auto-detect LLM model
    st.subheader('🤖 AI Model')
    
    detected_model = None
    model_names = {
        'OPENAI_API_KEY': 'OpenAI GPT',
        'ANTHROPIC_API_KEY': 'Anthropic Claude',
        'GOOGLE_API_KEY': 'Google Gemini',
        'OLLAMA_BASE_URL': 'Ollama (Local)'
    }
    
    for env_key, model_name in model_names.items():
        if os.getenv(env_key):
            detected_model = model_name
            st.success(f'✅ **Active:** {model_name}')
            break
    
    if not detected_model:
        st.error('❌ No LLM API key found!')
        st.info('Add one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY')
    
    st.markdown('---')
    
    # Thread configuration
    st.subheader('🔧 Scan Configuration')
    threads = st.slider('Threads', min_value=1, max_value=10, value=4, help='Number of parallel scraping threads')
    
    st.markdown('---')
    
    # Tips
    st.subheader('💡 Tips')
    st.info("""
    - Use specific keywords
    - More threads = faster scan
    - Results are AI-filtered
    - Download reports as JSON
    """)
    
    st.markdown('---')
    st.caption('© 2024 ZebraByte')

# ========================================
# MAIN INTERFACE
# ========================================

# Query input
query = st.text_input(
    '🔍 Enter Dark Web Search Query',
    placeholder='e.g., data breach, leaked credentials, ransomware',
    help='Enter keywords to search the dark web'
)

# Scan button
col1, col2, col3 = st.columns([1, 1, 1])
with col2:
    scan_button = st.button('🚀 Start Scan', use_container_width=True, type='primary')

# ========================================
# SCAN EXECUTION
# ========================================
if scan_button:
    if not query:
        st.warning('⚠️ Please enter a search query')
    elif not detected_model:
        st.error('❌ No AI model available. Please configure API keys.')
    else:
        # Progress tracking
        progress_bar = st.progress(0)
        status_text = st.empty()
        
        try:
            # Step 1: Search
            status_text.text('🔎 Step 1/4: Searching dark web...')
            progress_bar.progress(25)
            search_results = search_function(query, threads)
            
            # Step 2: Scrape
            status_text.text('📥 Step 2/4: Scraping content...')
            progress_bar.progress(50)
            scraped_data = scrape_function(search_results, threads)
            
            # Step 3: LLM Analysis
            status_text.text('🧠 Step 3/4: AI analysis...')
            progress_bar.progress(75)
            analysis = run_llm_analysis(scraped_data, detected_model)
            
            # Step 4: Complete
            status_text.text('✅ Step 4/4: Complete!')
            progress_bar.progress(100)
            
            st.success('✅ Scan completed successfully!')
            
            # ========================================
            # RESULTS DISPLAY
            # ========================================
            st.markdown('---')
            st.header('📊 Results')
            
            # AI Summary
            st.subheader('🧠 AI Intelligence Summary')
            st.markdown(analysis.get('summary', 'No summary available'))
            
            st.markdown('---')
            
            # Detailed Results
            st.subheader('🔍 Detailed Findings')
            
            if scraped_data and len(scraped_data) > 0:
                for idx, result in enumerate(scraped_data, 1):
                    with st.expander(f"Result {idx}: {result.get('title', 'Untitled')[:80]}"):
                        st.markdown(f"**URL:** {result.get('url', 'N/A')}")
                        st.markdown(f"**Content:**")
                        st.text(result.get('content', 'No content')[:500])
            else:
                st.info('No results found')
            
            # ========================================
            # DOWNLOAD REPORT
            # ========================================
            st.markdown('---')
            st.subheader('📥 Download Report')
            
            report_data = {
                'query': query,
                'timestamp': datetime.now().isoformat(),
                'model_used': detected_model,
                'threads': threads,
                'total_results': len(scraped_data) if scraped_data else 0,
                'ai_summary': analysis.get('summary', ''),
                'results': scraped_data
            }
            
            report_json = json.dumps(report_data, indent=2, ensure_ascii=False)
            
            col1, col2, col3 = st.columns([1, 1, 1])
            with col2:
                st.download_button(
                    label='📥 Download JSON Report',
                    data=report_json,
                    file_name=f'zebrabyte_scan_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json',
                    mime='application/json',
                    use_container_width=True
                )
            
        except Exception as e:
            st.error(f'❌ Scan failed: {str(e)}')
            st.exception(e)

# ========================================
# FOOTER
# ========================================
st.markdown('---')
st.markdown("""
<div class="footer">
    <h3>🦓 ZebraByte Cybersecurity Intelligence</h3>
    <p>
        <strong>Contact:</strong> 
        <a href="mailto:contact@zebrabyte.ro">contact@zebrabyte.ro</a> | 
        <a href="tel:+40316302226">+40.316.302.226</a> | 
        <a href="https://zebrabyte.ro" target="_blank">zebrabyte.ro</a>
    </p>
    <p style="font-size: 0.9em; color: #666;">
        Professional Dark Web Intelligence | OSINT Services | Threat Monitoring
    </p>
</div>
""", unsafe_allow_html=True)