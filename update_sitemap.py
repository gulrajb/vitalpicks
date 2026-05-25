#!/usr/bin/env python3
import os
from datetime import datetime

vitalpicks_dir = "/app/vitalpicks"
base_url = "https://www.vitalpicks.org"

# Get all HTML files
html_files = [f[:-5] for f in os.listdir(vitalpicks_dir) if f.endswith('.html')]
html_files.sort()

# Generate sitemap.xml
sitemap_content = '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
'''

for page in html_files:
    if page == 'index':
        loc = base_url
    else:
        loc = f"{base_url}/{page}.html"
    
    sitemap_content += f'''    <url>
        <loc>{loc}</loc>
        <lastmod>{datetime.now().strftime('%Y-%m-%d')}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>{"0.8" if page != "index" else "1.0"}</priority>
    </url>
'''

sitemap_content += '\n</urlset>'

# Write sitemap
with open(f"{vitalpicks_dir}/sitemap.xml", 'w') as f:
    f.write(sitemap_content)

print(f"✓ Updated sitemap.xml with {len(html_files)} pages")
print(f"✓ Total pages: {len(html_files)}")
