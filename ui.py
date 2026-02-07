import streamlit as st
import os
import json
from datetime import datetime

# Import your custom modules
from search import search_function
from scrape import scrape_function
from llm import detect_model, run_llm_analysis

# Set page config for Streamlit
st.set_page_config(page_title='ZebraByte Darkweb Scan', layout='wide')

# Add ZebraByte logo header
st.image('zebrabyte_logo.png')  # Make sure to include the logo in your repo

# Apply black theme styling
st.markdown('<style>body{background-color: black; color: white;}</style>', unsafe_allow_html=True)

# Auto-detect available LLM model from env variables
available_models = ['OpenAI', 'Anthropic', 'Google', 'Ollama']
selected_model = None
for model in available_models:
    if os.getenv(f'{model}_API_KEY'):
        selected_model = model
        break

if not selected_model:
    st.error('No available LLM model found!')
else:
    st.write(f'Using model: {selected_model}')

# Search query input
query = st.text_input('Enter your search query:')

# Thread configuration
threads = st.number_input('Number of threads:', min_value=1, max_value=10, value=5)

# Scan execution with progress bar
if st.button('Start Scan'):
    with st.spinner('Scanning...'):
        results = search_function(query, threads)
    st.success('Scan completed!')

    # Display results with AI summary
    for result in results:
        st.write(result)

    summary = run_llm_analysis(results, selected_model)
    st.write('AI Summary:')
    st.write(summary)

    # Download report functionality
    if st.button('Download Report'):
        report_data = json.dumps(results)
        st.download_button(
            label='Download Report',
            data=report_data,
            file_name='report.json',
            mime='application/json'
        )

# Footer with contact information
st.markdown('---')
st.markdown("**Contact Us:**\n Email: contact@zebrabyte.ro  \n Phone: +40.316.302.226  \n Website: [zebrabyte.ro](https://zebrabyte.ro)")
