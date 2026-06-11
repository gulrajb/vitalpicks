import os
from datetime import datetime
import xml.etree.ElementTree as ET

sitemap_path = "sitemap.xml"

# Parse existing sitemap
tree = ET.parse(sitemap_path)
root = tree.getroot()
ns = {'': 'http://www.sitemaps.org/schemas/sitemap/0.9'}

# Get all existing URLs
existing_urls = set()
for url_elem in root.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc'):
    existing_urls.add(url_elem.text)

# New articles to add
new_articles = [
    "best-weight-loss-patches-2026.html",
    "best-meal-replacement-shakes-weight-loss.html",
    "best-waist-trainers-weight-loss.html"
]

# Add new entries
for article in new_articles:
    url = f"https://www.vitalpicks.org/{article}"
    if url not in existing_urls:
        url_elem = ET.Element('{http://www.sitemaps.org/schemas/sitemap/0.9}url')
        
        loc = ET.SubElement(url_elem, '{http://www.sitemaps.org/schemas/sitemap/0.9}loc')
        loc.text = url
        
        lastmod = ET.SubElement(url_elem, '{http://www.sitemaps.org/schemas/sitemap/0.9}lastmod')
        lastmod.text = datetime.now().strftime('%Y-%m-%d')
        
        changefreq = ET.SubElement(url_elem, '{http://www.sitemaps.org/schemas/sitemap/0.9}changefreq')
        changefreq.text = 'monthly'
        
        priority = ET.SubElement(url_elem, '{http://www.sitemaps.org/schemas/sitemap/0.9}priority')
        priority.text = '0.8'
        
        root.append(url_elem)
        print(f"✓ Added to sitemap: {article}")

# Save sitemap
ET.register_namespace('', 'http://www.sitemaps.org/schemas/sitemap/0.9')
tree.write(sitemap_path, encoding='utf-8', xml_declaration=True)
print(f"\n✓ Sitemap updated with {len(new_articles)} new articles")

# Count total entries
total = len(root.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}url'))
print(f"✓ Total entries in sitemap: {total}")
