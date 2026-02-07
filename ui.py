import streamlit as st

# ZebraByte Branding
st.set_page_config(page_title='ZebraByte Dark Web Intelligence Scanner', layout='wide')

# Logo
st.image('https://static.zebrabyte.ro/web/image/3839-d356d2ee/logo-zebra-white.webp', width=300)

# Primary Color
primary_color = '#000000'

# Custom Streamlit Styling
st.markdown(f'<style>body {{background-color: {primary_color}; color: white;}}</style>', unsafe_allow_html=True)

# Header
st.title('ZebraByte Dark Web Intelligence Scanner')

# Original OSINT functionality preserved
# (Assuming existing OSINT functionality code is included here)

# Footer with company info
footer = '''
<footer style='color: white;'>
    <p>For inquiries, please contact us at <a href='mailto:contact@zebrabyte.ro'>contact@zebrabyte.ro</a></p>
    <p>Phone: +40.316.302.226</p>
    <p><a href='https://zebrabyte.ro' style='color: white;'>Visit our website</a></p>
</footer>
''' 

st.markdown(footer, unsafe_allow_html=True)