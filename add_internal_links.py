#!/usr/bin/env python3
import os
import re

NEW_ARTICLES = [
    {"slug": "best-electrolyte-drinks-powders", "title": "Best Electrolyte Drinks & Powders"},
    {"slug": "best-nad-boosters-nmn-supplements", "title": "Best NAD+ Boosters & NMN Supplements"},
    {"slug": "best-ashwagandha-stress-sleep", "title": "Best Ashwagandha Supplements for Stress & Sleep"},
]

EXISTING_ARTICLES_TO_LINK = [
    "best-protein-powders.html",
    "best-pre-workout.html",
    "best-recovery-drinks.html",
    "best-bcaa-supplements.html",
    "best-magnesium-supplements.html",
    "best-sleep-supplements.html",
    "best-stress-relief-supplements.html",  # May not exist, but try
]

vitalpicks_dir = "/app/vitalpicks"

# Add links to existing articles
for article_file in EXISTING_ARTICLES_TO_LINK:
    filepath = os.path.join(vitalpicks_dir, article_file)
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Check if content already has these links
    for new in NEW_ARTICLES:
        link_text = f'<a href="/{new["slug"]}.html">{new["title"]}</a>'
        if new["slug"] in content:
            continue  # Already linked
        
        # Add link before closing </main> or </article>
        new_link = f'<li><a href="/{new["slug"]}.html">{new["title"]}</a></li>'
        
        # Try to insert in a Related Articles section or at the end of the main content
        if '<h2>Related Articles</h2>' in content or '<h3>Related Articles</h3>' in content:
            content = re.sub(
                r'(<h[23]>Related Articles</h[23]>.*?<ul>)',
                r'\1' + f'\n{new_link}',
                content,
                flags=re.DOTALL,
                count=1
            )
        
        with open(filepath, 'w') as f:
            f.write(content)
        
        print(f"✓ Added link to {new['slug']} in {article_file}")

print("✓ Internal linking complete")
