import base64
import streamlit as st
from datetime import datetime
from scrape import scrape_multiple
from search import get_search_results
from llm_utils import BufferedStreamingHandler, get_model_choices
from llm import get_llm, refine_query, filter_results, generate_summary

# Cache expensive backend calls
@st.cache_data(ttl=200, show_spinner=False)
def cached_search_results(refined_query: str, threads: int):
    return get_search_results(refined_query.replace(" ", "+"), max_workers=threads)

@st.cache_data(ttl=200, show_spinner=False)
def cached_scrape_multiple(filtered: list, threads: int):
    return scrape_multiple(filtered, max_workers=threads)

# ZebraByte branding configuration
ZEBRABYTE_CONFIG = {
    "name": "ZebraByte",
    "logo_url": "https://static.zebrabyte.ro/web/image/3839-d356d2ee/logo-zebra-white.webp",
    "primary_color": "#000000",
    "secondary_color": "#ffffff",
    "website": "https://zebrabyte.ro",
    "contact_email": "contact@zebrabyte.ro",
    "phone": "+40.316.302.226"
}

# Streamlit page configuration
st.set_page_config(
    page_title=f"Dark Web Intelligence Scanner | {ZEBRABYTE_CONFIG['name']}",
    page_icon="🦓",
    initial_sidebar_state="expanded",
    layout="wide"
)

# Custom CSS for ZebraByte branding
st.markdown(f"""
    <style>
        /* ZebraByte Theme */
        :root {{
            --zebrabyte-black: {ZEBRABYTE_CONFIG['primary_color']};
            --zebrabyte-white: {ZEBRABYTE_CONFIG['secondary_color']};
        }}
        
        /* Header styling */
        .main-header {{
            background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
            padding: 2rem;
            border-radius: 10px;
            margin-bottom: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }}
        
        /* Logo container */
        .logo-container {{
            text-align: center;
            margin-bottom: 1rem;
        }}
        
        .logo-container img {{
            max-width: 200px;
            height: auto;
        }}
        
        /* Title styling */
        .app-title {{
            color: white;
            text-align: center;
            font-size: 2.5rem;
            font-weight: bold;
            margin: 1rem 0;
        }}
        
        .app-subtitle {{
            color: #cccccc;
            text-align: center;
            font-size: 1.2rem;
            margin-bottom: 1rem;
        }}
        
        /* Results styling */
        .colHeight {{
            max-height: 40vh;
            overflow-y: auto;
            text-align: center;
            background: #f9f9f9;
            padding: 1rem;
            border-radius: 8px;
            border: 2px solid #000000;
        }}
        
        .pTitle {{
            font-weight: bold;
            color: #000000;
            margin-bottom: 0.5em;
            font-size: 1.2rem;
        }}
        
        .aStyle {{
            font-size: 18px;
            font-weight: bold;
            padding: 5px;
            padding-left: 0px;
            text-align: center;
            color: #000000;
        }}
        
        /* Footer styling */
        .footer {{
            text-align: center;
            padding: 2rem;
            background: #000000;
            color: white;
            border-radius: 10px;
            margin-top: 3rem;
        }}
        
        .footer a {{
            color: white;
            text-decoration: none;
            margin: 0 1rem;
        }}
        
        .footer a:hover {{
            text-decoration: underline;
        }}
        
        /* Sidebar styling */
        [data-testid="stSidebar"] {{
            background-color: #f5f5f5;
        }}
        
        /* Button styling */
        .stButton>button {{
            background-color: #000000;
            color: white;
            border: none;
            border-radius: 5px;
            padding: 0.5rem 2rem;
            font-weight: bold;
        }}
        
        .stButton>button:hover {{
            background-color: #333333;
        }}
    </style>
""", unsafe_allow_html=True)

# Header with logo
st.markdown(f"""
    <div class="main-header">
        <div class="logo-container">
            <img src="{ZEBRABYTE_CONFIG['logo_url']}" alt="{ZEBRABYTE_CONFIG['name']} Logo">
        </div>
        <h1 class="app-title">Dark Web Intelligence Scanner</h1>
        <p class="app-subtitle">Powered by AI - Professional OSINT Tool</p>
    </div>
""", unsafe_allow_html=True)

# Sidebar
st.sidebar.image(ZEBRABYTE_CONFIG['logo_url'], width=150)
st.sidebar.title("⚙️ Settings")
st.sidebar.markdown("---")

model_options = get_model_choices()
default_model_index = (
    next(
        (idx for idx, name in enumerate(model_options) if name.lower() == "gpt4o"),
        0,
    )
    if model_options
    else 0
)

model = st.sidebar.selectbox(
    "🤖 Select LLM Model",
    model_options,
    index=default_model_index,
    key="model_select",
)

if any(name not in {"gpt4o", "gpt-4.1", "claude-3-5-sonnet-latest", "llama3.1", "gemini-2.5-flash"} for name in model_options):
    st.sidebar.caption("💡 Locally detected Ollama models are automatically added")

threads = st.sidebar.slider("🔄 Scraping Threads", 1, 16, 4, key="thread_slider")

st.sidebar.markdown("---")
st.sidebar.markdown("### 📞 Contact")
st.sidebar.markdown(f"🌐 [{ZEBRABYTE_CONFIG['website']}]({ZEBRABYTE_CONFIG['website']})")
st.sidebar.markdown(f"📧 {ZEBRABYTE_CONFIG['contact_email']}")
st.sidebar.markdown(f"📱 {ZEBRABYTE_CONFIG['phone']}")

# Main UI - Search form
with st.form("search_form", clear_on_submit=True):
    col_input, col_button = st.columns([10, 1])
    query = col_input.text_input(
        "🔍 Enter Dark Web Search Query",
        placeholder="Enter search term (e.g., 'ransomware', 'data breach', 'credentials')",
        label_visibility="collapsed",
        key="query_input",
    )
    run_button = col_button.form_submit_button("🚀 Run")

# Status and results placeholders
status_slot = st.empty()
cols = st.columns(3)
p1, p2, p3 = [col.empty() for col in cols]
summary_container_placeholder = st.empty()

# Process search when button clicked
if run_button and query:
    with status_slot.container():
        st.info(f"🔄 Processing query: **{query}**")
    
    llm = get_llm(model)
    
    # Step 1: Refine query
    with p1.container():
        st.markdown('<p class="pTitle">🔄 Step 1: Refining Query</p>', unsafe_allow_html=True)
        with st.spinner("Processing..."):
            refined_query = refine_query(llm, query)
        st.markdown(f'<div class="colHeight"><p class="aStyle">✅ Refined Query:<br>{refined_query}</p></div>', unsafe_allow_html=True)
    
    # Step 2: Search dark web
    with p2.container():
        st.markdown('<p class="pTitle">🔍 Step 2: Searching Dark Web</p>', unsafe_allow_html=True)
        with st.spinner("Searching..."):
            search_results = cached_search_results(refined_query, threads)
        st.markdown(f'<div class="colHeight"><p class="aStyle">✅ Found {len(search_results)} results</p></div>', unsafe_allow_html=True)
    
    # Step 3: Filter and analyze
    with p3.container():
        st.markdown('<p class="pTitle">🎯 Step 3: Filtering Results</p>', unsafe_allow_html=True)
        with st.spinner("Analyzing..."):
            search_filtered = filter_results(llm, refined_query, search_results)
        st.markdown(f'<div class="colHeight"><p class="aStyle">✅ Selected {len(search_filtered)} relevant results</p></div>', unsafe_allow_html=True)
    
    # Scrape and generate summary
    with status_slot.container():
        st.info("🔄 Scraping content and generating intelligence summary...")
    
    scraped_results = cached_scrape_multiple(search_filtered, threads)
    
    with summary_container_placeholder.container():
        st.markdown("## 📊 Intelligence Summary")
        summary = generate_summary(llm, query, scraped_results)
        st.markdown(summary)
        
        # Download button
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"zebrabyte_dark_web_intel_{timestamp}.md"
        st.download_button(
            label="📥 Download Report",
            data=summary,
            file_name=filename,
            mime="text/markdown"
        )
    
    with status_slot.container():
        st.success("✅ Analysis complete!")

# Footer
st.markdown(f"""
    <div class="footer">
        <p><strong>{ZEBRABYTE_CONFIG['name']}</strong> - Dark Web Intelligence Scanner</p>
        <p>
            <a href="{ZEBRABYTE_CONFIG['website']}" target="_blank">Website</a> |
            <a href="mailto:{ZEBRABYTE_CONFIG['contact_email']}">Contact</a> |
            <a href="tel:{ZEBRABYTE_CONFIG['phone']}">Phone: {ZEBRABYTE_CONFIG['phone']}</a>
        </p>
        <p style="margin-top: 1rem; font-size: 0.9rem;">© 2024 {ZEBRABYTE_CONFIG['name']}. All rights reserved.</p>
    </div>
""", unsafe_allow_html=True)