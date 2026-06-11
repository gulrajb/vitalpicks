import requests
import json

# Get the token
with open('.agents/.env', 'r') as f:
    for line in f:
        if line.startswith('GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN'):
            token = line.split('=')[1].strip()
            break

# GSC API endpoint
gsc_url = "https://www.google.com/webmasters/tools/submit?sitemap=https://www.vitalpicks.org/sitemap.xml"
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# Alternative: Direct API submission
api_url = "https://www.google.com/ping?sitemap=https://www.vitalpicks.org/sitemap.xml"

try:
    response = requests.get(api_url, timeout=10)
    if response.status_code in [200, 204]:
        print("✓ Sitemap successfully submitted to Google Search Console")
    else:
        print(f"! Submission status: {response.status_code}")
except Exception as e:
    print(f"! Submission error: {str(e)}")
