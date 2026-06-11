import os
import re

# New articles to link to
new_articles = {
    "best-weight-loss-patches-2026.html": "Best Weight Loss Patches and Topical Solutions for 2026",
    "best-meal-replacement-shakes-weight-loss.html": "Best Meal Replacement Shakes for Weight Loss",
    "best-waist-trainers-weight-loss.html": "Best Waist Trainers and Corsets for Weight Loss Results"
}

# Related existing articles to update
related_articles = [
    "best-weight-loss-supplements.html",
    "best-appetite-suppressants-2026.html",
    "best-weight-loss-apps-2026.html",
    "best-weight-loss-drinks.html",
    "best-fat-burners-for-men.html",
    "best-womens-fat-burners.html"
]

for article in related_articles:
    filepath = f"vitalpicks/{article}"
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if article already has the new links
    if "best-weight-loss-patches-2026" in content or "best-meal-replacement-shakes" in content:
        continue
    
    # Find the "Related Articles" or similar section, or add before footer
    # Add links in the aside section before the footer
    
    new_link = """                    <li><a href="best-weight-loss-patches-2026.html">Weight Loss Patches</a></li>
                    <li><a href="best-meal-replacement-shakes-weight-loss.html">Meal Replacement Shakes</a></li>
                    <li><a href="best-waist-trainers-weight-loss.html">Waist Trainers</a></li>"""
    
    # Find the aside section and add links
    if '<aside>' in content and 'Quick Links' in content:
        # Insert after the first <li> in the aside
        pattern = r'(<aside>.*?<h3>📌 Quick Links</h3>.*?<ul>)'
        replacement = r'\1\n' + new_link
        content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✓ Updated internal links in {article}")

print("\n✓ Internal linking complete")
