import streamlit as st
import os
from datetime import datetime
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# Import module personalizate
from search import search_function
from scrape import scrape_function
from llm import get_llm, refine_query, filter_results, generate_summary

# Configurare pagină
st.set_page_config(
    page_title='ZebraByte - Scanner Dark Web Intelligence',
    page_icon='https://static.zebrabyte.ro/web/image/3839-d356d2ee/logo-zebra-white.webp',
    layout='wide'
)

# CSS pentru design negru profesional
st.markdown("""
<style>
    .stApp {
        background-color: #000000;
        color: #ffffff;
    }
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    h1, h2, h3, h4, h5, h6 {
        color: #ffffff !important;
        font-weight: 600;
        text-align: center;
    }
    p {
        color: #cccccc;
        line-height: 1.6;
    }
    .stButton>button {
        background-color: #ffffff;
        color: #000000;
        border: none;
        border-radius: 8px;
        padding: 16px 48px;
        font-weight: 600;
        font-size: 16px;
        width: 100%;
        max-width: 300px;
        margin: 0 auto;
        display: block;
    }
    .stButton>button:hover {
        background-color: #e0e0e0;
        transform: translateY(-2px);
    }
    .stTextInput>div>div>input {
        background-color: #1a1a1a;
        color: #ffffff;
        border: 1px solid #333333;
        border-radius: 8px;
        padding: 16px;
        font-size: 16px;
    }
    .block-container {
        max-width: 900px;
        padding-top: 3rem;
    }
    .footer-section {
        margin-top: 4rem;
        padding-top: 2rem;
        border-top: 1px solid #333333;
        text-align: center;
    }
</style>
""", unsafe_allow_html=True)

# Funcție generare PDF

def generate_pdf_report(query, results, summary, model_used):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    story = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=24, textColor='#000000', spaceAfter=30, alignment=TA_CENTER, fontName='Helvetica-Bold')
    heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading2'], fontSize=16, textColor='#000000', spaceAfter=12, spaceBefore=12, fontName='Helvetica-Bold')
    normal_style = ParagraphStyle('CustomNormal', parent=styles['Normal'], fontSize=11, textColor='#000000', spaceAfter=12, alignment=TA_LEFT, fontName='Helvetica')
    
    story.append(Paragraph("RAPORT INTELLIGENCE DARK WEB", title_style))
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("INFORMAȚII GENERALE", heading_style))
    story.append(Paragraph(f"<b>Interogare:</b> {query}", normal_style))
    story.append(Paragraph(f"<b>Data și ora:</b> {datetime.now().strftime('%d.%m.%Y %H:%M:%S')}", normal_style))
    story.append(Paragraph(f"<b>Model AI utilizat:</b> {model_used}", normal_style))
    story.append(Paragraph(f"<b>Număr rezultate:</b> {len(results) if results else 0}", normal_style))
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("SUMAR INTELLIGENCE AI", heading_style))
    story.append(Paragraph(summary if summary else "Nu există sumar disponibil.", normal_style))
    story.append(Spacer(1, 0.5*cm))
    
    story.append(PageBreak())
    story.append(Paragraph("REZULTATE DETALIATE", heading_style))
    
    if results and len(results) > 0:
        for idx, result in enumerate(results, 1):
            story.append(Paragraph(f"<b>Rezultat {idx}</b>", heading_style))
            title = result.get('title', 'Fără titlu')
            story.append(Paragraph(f"<b>Titlu:</b> {title}", normal_style))
            url = result.get('url', 'N/A')
            story.append(Paragraph(f"<b>URL:</b> {url}", normal_style))
            snippet = result.get('snippet', result.get('content', 'Nu există conținut'))[:500]
            story.append(Paragraph(f"<b>Conținut:</b> {snippet}...", normal_style))
            story.append(Spacer(1, 0.3*cm))
    else:
        story.append(Paragraph("Nu au fost găsite rezultate.", normal_style))
    
    story.append(PageBreak())
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph("DESPRE ZEBRABYTE", heading_style))
    story.append(Paragraph("ZebraByte este o companie lider în domeniul securității cibernetice și intelligence, specializată în monitorizarea dark web, servicii OSINT și analiză avansată cu inteligență artificială.", normal_style))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph("<b>Contact:</b>", normal_style))
    story.append(Paragraph("Email: contact@zebrabyte.ro", normal_style))
    story.append(Paragraph("Telefon: +40.316.302.226", normal_style))
    story.append(Paragraph("Website: https://zebrabyte.ro", normal_style))
    
    doc.build(story)
    buffer.seek(0)
    return buffer

# Auto-detect model LLM
detected_model = None
model_names = {'OPENAI_API_KEY': 'OpenAI GPT', 'ANTHROPIC_API_KEY': 'Anthropic Claude', 'GOOGLE_API_KEY': 'Google Gemini', 'OLLAMA_BASE_URL': 'Ollama Local'}
for env_key, model_name in model_names.items():
    if os.getenv(env_key):
        detected_model = model_name
        break

# HEADER - Logo și titlu
col1, col2, col3 = st.columns([1, 2, 1])
with col2:
    st.image('https://static.zebrabyte.ro/web/image/3839-d356d2ee/logo-zebra-white.webp', width=300)

st.markdown("<h1 style='text-align: center;'>Scanner Dark Web Intelligence</h1>", unsafe_allow_html=True)
st.markdown("<p style='text-align: center; font-size: 18px; color: #999999;'>Scanare și analiză profesională dark web utilizând inteligență artificială</p>", unsafe_allow_html=True)
st.markdown("<br>", unsafe_allow_html=True)

# Secțiune informații
st.markdown("### Ce este acest instrument?")
st.markdown("""
Acest scanner profesional dark web vă permite să:
- Căutați informații pe dark web folosind motoare de căutare specializate
- Analizați conținut prin scraping avansat multi-threaded
- Obțineți rapoarte intelligence generate de inteligență artificială
- Exportați rezultate în format PDF profesional

Instrumentul utilizează modele avansate de limbaj natural (LLM) pentru filtrarea și analiza rezultatelor, oferind un sumar comprehensiv al informațiilor găsite.
""")

if not detected_model:
    st.error("Atenție: Nu există niciun model AI configurat. Vă rugăm să adăugați o cheie API (OPENAI_API_KEY, ANTHROPIC_API_KEY, sau GOOGLE_API_KEY).")
else:
    st.info(f"Model AI activ: **{detected_model}**")

st.markdown("<br><br>", unsafe_allow_html=True)

# Formular scanare
st.markdown("### Începeți scanarea")
query = st.text_input(label="Introduceți termenul de căutare", placeholder="Exemplu: data breach, leaked credentials, ransomware groups", help="Introduceți cuvinte cheie relevante pentru căutarea dumneavoastră pe dark web", label_visibility="collapsed")

st.markdown("<br>", unsafe_allow_html=True)
col1, col2, col3 = st.columns([1, 1, 1])
with col2:
    scan_button = st.button('Scanează Dark Web', use_container_width=True)

st.markdown("<br><br>", unsafe_allow_html=True)

# Execuție scanare
if scan_button:
    if not query:
        st.warning("Vă rugăm să introduceți un termen de căutare.")
    elif not detected_model:
        st.error("Nu este disponibil niciun model AI. Scanarea nu poate continua.")
    else:
        search_results = []
        scraped_data = []
        analysis_summary = ""
        
        try:
            progress_bar = st.progress(0)
            status_text = st.empty()
            
            status_text.text('Pas 1/4: Căutare pe dark web în curs...')
            progress_bar.progress(25)
            llm = get_llm('gpt-4o-mini')
            refined_query = refine_query(llm, query)
            search_results = search_function(refined_query, threads=4)
            
            status_text.text('Pas 2/4: Extragere conținut în curs...')
            progress_bar.progress(50)
            filtered_results = filter_results(llm, refined_query, search_results)
            
            status_text.text('Pas 3/4: Scraping în curs...')
            progress_bar.progress(75)
            scraped_data_dict = scrape_function(filtered_results, threads=4)
            scraped_data = [{'title': k, 'url': k, 'content': v} for k, v in scraped_data_dict.items()]
            
            status_text.text('Pas 4/4: Analiză AI în curs...')
            progress_bar.progress(90)
            analysis_summary = generate_summary(llm, query, scraped_data_dict)
            
            progress_bar.progress(100)
            status_text.empty()
            progress_bar.empty()
            
            st.success('Scanarea s-a finalizat cu succes!')
            
            st.markdown("---")
            st.markdown("## Rezultate Scanare")
            st.markdown("### Sumar Intelligence AI")
            st.markdown(analysis_summary)
            st.markdown("<br>", unsafe_allow_html=True)
            st.markdown("### Rezultate Detaliate")
            
            if scraped_data and len(scraped_data) > 0:
                st.markdown(f"**Total rezultate găsite:** {len(scraped_data)}")
                st.markdown("<br>", unsafe_allow_html=True)
                for idx, result in enumerate(scraped_data, 1):
                    title = result.get('title', 'Fără titlu')
                    url = result.get('url', 'N/A')
                    content = result.get('content', 'Nu există conținut disponibil')
                    with st.expander(f"Rezultat {idx}: {title[:80]}..."):
                        st.markdown(f"**Titlu:** {title}")
                        st.markdown(f"**URL:** {url}")
                        st.markdown(f"**Conținut:**")
                        st.text(content[:800])
            else:
                st.info("Nu au fost găsite rezultate pentru interogarea dumneavoastră.")
            
            st.markdown("<br>", unsafe_allow_html=True)
            st.markdown("### Descărcare Raport")
            st.markdown("Exportați rezultatele complete într-un raport PDF profesional.")
            
            pdf_buffer = generate_pdf_report(query, scraped_data, analysis_summary, detected_model)
            col1, col2, col3 = st.columns([1, 1, 1])
            with col2:
                st.download_button(label='Descarcă Raport PDF', data=pdf_buffer, file_name=f'zebrabyte_raport_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf', mime='application/pdf', use_container_width=True)
        except Exception as e:
            st.error(f"A apărut o eroare în timpul scanării: {str(e)}")

# Footer
st.markdown("""
<div class="footer-section">
    <h3>ZebraByte - Cybersecurity Intelligence</h3>
    <p style="font-size: 16px; margin-bottom: 1.5rem;">Companie lider în securitate cibernetică, specializată în monitorizare dark web, servicii OSINT (Open Source Intelligence) și consultanță avansată în securitate.</p>
    <p><strong>Servicii oferite:</strong></p>
    <p>Monitorizare Dark Web | Threat Intelligence | Analiza OSINT | Consultanță Securitate Cibernetică</p>
    <br>
    <p><strong>Contact:</strong></p>
    <p>Email: <a href="mailto:contact@zebrabyte.ro" style="color: #ffffff;">contact@zebrabyte.ro</a><br>Telefon: <a href="tel:+40316302226" style="color: #ffffff;">+40.316.302.226</a><br>Website: <a href="https://zebrabyte.ro" target="_blank" style="color: #ffffff;">zebrabyte.ro</a></p>
    <br>
    <p style="font-size: 14px; color: #666666;">© 2024 ZebraByte. Toate drepturile rezervate.<br>Acest instrument este destinat exclusiv utilizării profesionale și autorizate.</p>
</div>
""", unsafe_allow_html=True)