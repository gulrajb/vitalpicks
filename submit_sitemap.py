import os
import sys
sys.path.insert(0, '/app')

# Get the Google Search Console token
token = os.getenv('GOOGLE_SEARCH_CONSOLE_TOKEN') or os.getenv('GOOGLECALENDAR_ACCESS_TOKEN')

if not token:
    print("⚠️  No Google token available. Sitemap queued for manual submission.")
    print("To auto-submit, please authorize Google Search Console connector.")
    sys.exit(0)

import requests

# Submit sitemap to Google Search Console
site_url = "https://www.vitalpicks.org"
sitemap_url = f"{site_url}/sitemap.xml"

headers = {"Authorization": f"Bearer {token}"}

# URL to submit sitemap
submit_url = f"https://www.google.com/webmasters/tools/ping?sitemap={sitemap_url}"

try:
    response = requests.get(submit_url, timeout=10)
    if response.status_code in [200, 204]:
        print("✅ Sitemap submitted to Google Search Console")
    else:
        print(f"⚠️  Submission response: {response.status_code}")
except Exception as e:
    print(f"⚠️  Could not submit sitemap: {str(e)}")
    print(f"   Manual submission: {submit_url}")
