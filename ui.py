import streamlit as st
import os
import json
from datetime import datetime

# Import custom modules
from search import search_function
from scrape import scrape_function
from llm import detect_model, run_llm_analysis

# ========================
# ZEBRABYTE BRANDING
# ========================

# Page config
st.set_page_config(
    page_title='ZebraByte Dark Web Intelligence Scanner',
    layout='wide',
    initial_sidebar_state='expanded'
)

# Custom CSS for ZebraByte theme
st.markdown("""
<style>
    /* Main theme */
    .stApp {
        background-color: #0a0a0a;
        color: #ffffff;
    }
    
    /* Header styling */
    h1, h2, h3 {
        color: #ffffff;
        font-weight: 700;
    }
    
    /* Input fields */
    .stTextInput input {
        background-color: #1a1a1a;
        color: #ffffff;
        border: 2px solid #333;
        border-radius: 8px;
    }
    
    /* Buttons */
    .stButton button {
        background-color: #000000;
        color: #ffffff;
        border: 2px solid #ffffff;
        border-radius: 8px;
        font-weight: 600;
        padding: 12px 40px;
        transition: all 0.3s;
    }
    
    .stButton button:hover {
        background-color: #ffffff;
        color: #000000;
        transform: scale(1.05);
    }
    
    /* Results box */
    .result-box {
        background-color: #1a1a1a;
        border-left: 4px solid #000000;
        padding: 20px;
        margin: 10px 0;
        border-radius: 8px;
    }
    
    /* Footer */
    .footer {
        text-align: center;
        padding: 30px;
        margin-top: 50px;
        border-top: 2px solid #333;
        color: #999;
    }
    
    .footer a {
        color: #ffffff;
        text-decoration: none;
        font-weight: 600;
    }
    
    .footer a:hover {
        text-decoration: underline;
    }
</style>
""", unsafe_allow_html=True)

# ZebraByte Logo Header
col1, col2, col3 = st.columns([1, 2, 1])
with col2:
    st.image('https://static.zebrabyte.ro/web/image/3839-d356d2ee/logo-zebra-white.webp', width=300)

# Main Title
st.title('🦓 ZebraByte Dark Web Intelligence Scanner')
st.markdown('**AI-Powered OSINT | Professional Dark Web Monitoring**')
st.markdown('---')

# ========================
# AUTO-DETECT LLM MODEL
# ========================

def auto_detect_llm():
    """Automatically detect available LLM from environment variables"""
    api_keys = {
        'OPENAI_API_KEY': 'OpenAI GPT',
        'ANTHROPIC_API_KEY': 'Anthropic Claude',
        'GOOGLE_API_KEY': 'Google Gemini',
    }
    
    for key, name in api_keys.items():
        if os.getenv(key):
            return name
    
    # Check for Ollama (no API key needed)
    try:
        import requests
        response = requests.get('http://localhost:11434/api/tags', timeout=2)
        if response.status_code == 200:
            return 'Ollama (Local)'
    except:
        pass
    
    return None

selected_model = auto_detect_llm()

# Display model status
if selected_model:
    st.success(f'✅ **AI Model Active:** {selected_model}')
else:
    st.error('❌ **No AI model detected!** Please configure API keys in environment variables.')
st.info('Set one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, or run Ollama locally.')

st.markdown('---')

# ========================
# MAIN INTERFACE
# ========================

# Sidebar with info
with st.sidebar:
    st.header('ℹ️ About')
    st.markdown("""
    **ZebraByte Dark Web Scanner** uses AI to intelligently search and analyze dark web content.
    
    **Features:**
    - 🔍 Multi-source dark web search
    - 🧠 AI-powered analysis
    - 📊 Comprehensive reports
    - 🚀 Multi-threaded scraping
    """)
    
    st.markdown('---')
    
    st.header('⚙️ Settings')
    threads = st.slider('Scraping Threads', min_value=1, max_value=10, value=4)
    
    st.markdown('---')
    
    st.header('💡 Tips')
    st.markdown("""
    - Use specific keywords
    - Try different thread counts
    - Download reports for analysis
    """)

# Main search interface
st.header('🔍 Start Your Scan')

query = st.text_input(
    'Enter search query:',
    placeholder='e.g., data breach, leaked credentials, ransomware...',
    help='Enter keywords to search the dark web'
)

# Scan button
if st.button('🚀 Start Scan', use_container_width=True):
    if not query:
        st.warning('⚠️ Please enter a search query!')
    elif not selected_model:
        st.error('❌ Cannot start scan without an AI model. Please configure API keys.')
    else:
        # Progress tracking
        progress_bar = st.progress(0)
        status_text = st.empty()
        
        try:
            # Step 1: Searching
            status_text.text('🔍 Searching dark web sources...')
            progress_bar.progress(25)
            
            with st.spinner('Searching...'):
                search_results = search_function(query, threads)
            
            # Step 2: Scraping
            status_text.text('📥 Scraping content...')
            progress_bar.progress(50)
            
            with st.spinner('Scraping...'):
                scraped_data = scrape_function(search_results, threads)
            
            # Step 3: AI Analysis
            status_text.text('🧠 Analyzing with AI...')
            progress_bar.progress(75)
            
            with st.spinner('Analyzing...'):
                analysis = run_llm_analysis(scraped_data, selected_model)
            
            # Step 4: Complete
            progress_bar.progress(100)
            status_text.text('✅ Scan completed!')
            
            st.success('🎉 Scan completed successfully!')
            
            # Display results
            st.markdown('---')
            st.header('📊 Results')
            
            # AI Summary
            st.subheader('🧠 AI Analysis Summary')
            st.markdown(f"""
            <div class="result-box">
                {analysis}
            </div>
            """, unsafe_allow_html=True)
            
            # Detailed results
            st.subheader('📋 Detailed Findings')
            
            if scraped_data:
                for idx, result in enumerate(scraped_data, 1):
                    with st.expander(f'Result #{idx}: {result.get("title", "Unknown")}'):
                        st.markdown(f"**URL:** {result.get('url', 'N/A')}")
                        st.markdown(f"**Content:** {result.get('content', 'N/A')}")
                        st.markdown(f"**Timestamp:** {result.get('timestamp', 'N/A')}")
            else:
                st.info('No results found.')
            
            # Download report
            st.markdown('---')
            st.subheader('📥 Download Report')
            
            report_data = {
                'query': query,
                'timestamp': datetime.now().isoformat(),
                'model': selected_model,
                'threads': threads,
                'summary': analysis,
                'results': scraped_data,
                'total_results': len(scraped_data) if scraped_data else 0
            }
            
            report_json = json.dumps(report_data, indent=2)
            
            st.download_button(
                label='📄 Download Full Report (JSON)',
                data=report_json,
                file_name=f'zebrabyte_scan_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json',
                mime='application/json',
                use_container_width=True
            )
            
        except Exception as e:
            st.error(f'❌ Error during scan: {str(e)}')
            st.exception(e)

# ========================
# FOOTER
# ========================
st.markdown('---')
st.markdown("""
<div class="footer">
    <p><strong>🦓 ZebraByte - Professional Cybersecurity Intelligence</strong></p>
    <p>
        📧 <a href="mailto:contact@zebrabyte.ro">contact@zebrabyte.ro</a> | 
        📱 <a href="tel:+40316302226">+40.316.302.226</a> | 
        🌐 <a href="https://zebrabyte.ro" target="_blank">zebrabyte.ro</a>
    </p>
    <p style="font-size: 12px; color: #666;">© 2024 ZebraByte. All rights reserved.</p>
</div>
""", unsafe_allow_html=True)