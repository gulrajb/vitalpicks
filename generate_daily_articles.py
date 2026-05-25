#!/usr/bin/env python3
import json
from datetime import datetime
import re

# Today is Monday (Supplements theme)
AFFILIATE_TAG = "health2099-20"
BASE_URL = "https://www.vitalpicks.org"

supplement_topics = [
    {
        "title": "Best Electrolyte Drinks & Powders",
        "slug": "best-electrolyte-drinks-powders",
        "focus_keyword": "electrolyte drinks",
        "meta_description": "Top electrolyte drinks & powders for hydration, recovery, and athletic performance. Compare brands, prices & benefits.",
        "products": [
            {"name": "Liquid IV Hydration Multiplier", "asin": "B076QQHTKK", "rating": 4.6, "price_range": "$20-30"},
            {"name": "LMNT Electrolyte Packets", "asin": "B081S3V5Z2", "rating": 4.7, "price_range": "$20-25"},
            {"name": "Nuun Hydration Tablets", "asin": "B003D5WKOI", "rating": 4.5, "price_range": "$8-12"},
            {"name": "Liquid IV Variety Pack", "asin": "B08JL3LHLY", "rating": 4.5, "price_range": "$25-35"},
            {"name": "Gatorade Electrolyte Drink", "asin": "B00JEN2MHE", "rating": 4.3, "price_range": "$10-15"},
        ],
        "benefits": ["Faster hydration absorption", "Electrolyte replenishment", "Better endurance performance", "Reduced muscle cramps", "Improved recovery"],
        "buying_guide": "Look for electrolytes with optimal sodium-potassium ratios (1:1 or similar). Choose based on taste preference, price, and convenience (powder vs. tablets vs. ready-to-drink). Consider your activity level and climate.",
        "faq": [
            {"q": "When should I drink electrolytes?", "a": "During or after intense exercise lasting 60+ minutes, or in hot/humid conditions."},
            {"q": "Are electrolyte drinks better than water?", "a": "For intense workouts, yes. For light activity, water is sufficient."},
            {"q": "Can I make my own electrolyte drink?", "a": "Yes, mix water, salt, sugar, and lemon juice. Commercial options offer convenience and tested ratios."},
            {"q": "Do electrolytes help with hydration?", "a": "Yes, sodium and potassium enhance water absorption in the gut."},
        ]
    },
    {
        "title": "Best NAD+ Boosters & NMN Supplements",
        "slug": "best-nad-boosters-nmn-supplements",
        "focus_keyword": "NAD+ boosters",
        "meta_description": "Top NAD+ and NMN supplements for cellular energy, anti-aging & longevity. Compare brands, dosages & effectiveness.",
        "products": [
            {"name": "Renue by Science NMN Powder", "asin": "B08YYMNHKY", "rating": 4.6, "price_range": "$45-55"},
            {"name": "Tru Niagen NAD+ Supplement", "asin": "B01MQ3K7FW", "rating": 4.5, "price_range": "$35-45"},
            {"name": "Alive by Science NAD+", "asin": "B08QMXR6ZL", "rating": 4.7, "price_range": "$40-50"},
            {"name": "Wonderfeel NMN Capsules", "asin": "B08XZY5Q8R", "rating": 4.4, "price_range": "$50-60"},
            {"name": "GeroScience NMN", "asin": "B08WNNMB6C", "rating": 4.5, "price_range": "$60-70"},
        ],
        "benefits": ["Supports cellular energy production", "May improve mitochondrial function", "Potential anti-aging effects", "Enhanced metabolism", "Better endurance performance"],
        "buying_guide": "Choose between NMN and NR based on research preference. Look for third-party tested products. Consider dosage (250-1000mg daily). Price varies significantly; compare cost per dose.",
        "faq": [
            {"q": "What's the difference between NMN and NR?", "a": "Both boost NAD+. NMN may be more direct, but more research on NR. Effects are similar for most users."},
            {"q": "How long before I see results?", "a": "Most users report benefits after 4-8 weeks of consistent use."},
            {"q": "Is NAD+ supplementation safe?", "a": "Generally safe in recommended doses. Consult your doctor if you have health conditions."},
            {"q": "Can I stack NAD+ with other supplements?", "a": "Yes, it pairs well with resveratrol, fisetin, and other longevity compounds."},
        ]
    },
    {
        "title": "Best Ashwagandha Supplements for Stress & Sleep",
        "slug": "best-ashwagandha-stress-sleep",
        "focus_keyword": "ashwagandha supplements",
        "meta_description": "Top ashwagandha supplements for stress relief, anxiety & better sleep. Compare dosages, brands & user reviews.",
        "products": [
            {"name": "KSM-66 Ashwagandha Extract", "asin": "B07N3QBNXW", "rating": 4.7, "price_range": "$15-20"},
            {"name": "NOW Ashwagandha 500mg", "asin": "B00016EBFA", "rating": 4.5, "price_range": "$8-12"},
            {"name": "Gaia Herbs Ashwagandha Root", "asin": "B000EOQTLY", "rating": 4.6, "price_range": "$10-14"},
            {"name": "NaturesWay Ashwagandha", "asin": "B00G8V7HT2", "rating": 4.4, "price_range": "$10-15"},
            {"name": "Himalaya Organic Ashwagandha", "asin": "B004JZ1CNA", "rating": 4.5, "price_range": "$12-17"},
        ],
        "benefits": ["Reduces stress and anxiety", "Improves sleep quality", "Supports cortisol balance", "Enhanced mood", "Better cognitive function"],
        "buying_guide": "Look for standardized extracts (KSM-66 or Sensoril). Typical dose is 300-600mg daily. Choose between capsules and powder based on preference. Take consistently for 4-8 weeks for best results.",
        "faq": [
            {"q": "How long does ashwagandha take to work?", "a": "Most people notice benefits after 2-4 weeks of consistent use."},
            {"q": "Can I take ashwagandha with other supplements?", "a": "Generally safe, but consult your doctor if taking medications for anxiety or sleep."},
            {"q": "Is ashwagandha safe for long-term use?", "a": "Yes, it's well-tolerated. Some recommend cycling off periodically."},
            {"q": "What's the best time to take ashwagandha?", "a": "Morning or evening works. Evening is better if using for sleep."},
        ]
    },
]

def create_article(topic):
    """Generate a full HTML article with hero, comparison table, product cards, FAQ, and structured data."""
    
    products_html = ""
    for i, product in enumerate(topic["products"], 1):
        amazon_url = f"https://www.amazon.com/s?k={product['name'].replace(' ', '+')}&tag={AFFILIATE_TAG}"
        products_html += f"""
        <div class="product-card">
            <div class="product-rank">#{i}</div>
            <h4>{product['name']}</h4>
            <div class="product-rating">⭐ {product['rating']}/5</div>
            <p class="product-price">{product['price_range']}</p>
            <div class="product-pros">
                <strong>Pros:</strong>
                <ul>
                    <li>High quality & purity</li>
                    <li>Good bioavailability</li>
                    <li>Positive user reviews</li>
                </ul>
            </div>
            <div class="product-cons">
                <strong>Cons:</strong>
                <ul>
                    <li>Premium pricing</li>
                    <li>Smaller bottle size</li>
                </ul>
            </div>
            <a href="{amazon_url}" class="btn-affiliate" target="_blank" rel="noopener noreferrer">
                View on Amazon
            </a>
        </div>
        """
    
    comparison_rows = ""
    for product in topic["products"]:
        comparison_rows += f"""
        <tr>
            <td>{product['name']}</td>
            <td>{product['price_range']}</td>
            <td>{product['rating']}/5</td>
            <td>Premium</td>
        </tr>
        """
    
    faq_html = ""
    for item in topic["faq"]:
        faq_html += f"""
        <div class="faq-item">
            <h4>{item['q']}</h4>
            <p>{item['a']}</p>
        </div>
        """
    
    benefits_list = "".join([f"<li>{b}</li>" for b in topic["benefits"]])
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{topic['title']} - VitalPicks</title>
    <meta name="description" content="{topic['meta_description']}">
    <meta name="keywords" content="{topic['focus_keyword']}, supplements, health, fitness">
    <link rel="canonical" href="{BASE_URL}/{topic['slug']}.html">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background: #f9f9f9; }}
        header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; text-align: center; }}
        header h1 {{ font-size: 2.5rem; margin-bottom: 0.5rem; }}
        header p {{ font-size: 1.1rem; opacity: 0.9; }}
        .container {{ max-width: 1200px; margin: 0 auto; padding: 2rem; }}
        .hero-banner {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 3rem; border-radius: 8px; margin-bottom: 2rem; text-align: center; }}
        .hero-banner h2 {{ font-size: 2rem; margin-bottom: 1rem; }}
        .comparison-table {{ width: 100%; border-collapse: collapse; margin: 2rem 0; background: white; border-radius: 8px; overflow: hidden; }}
        .comparison-table th {{ background: #667eea; color: white; padding: 1rem; text-align: left; }}
        .comparison-table td {{ padding: 1rem; border-bottom: 1px solid #eee; }}
        .comparison-table tr:hover {{ background: #f5f5f5; }}
        .products-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; margin: 2rem 0; }}
        .product-card {{ background: white; border-radius: 8px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
        .product-rank {{ font-size: 0.9rem; color: #667eea; font-weight: bold; }}
        .product-card h4 {{ margin: 0.5rem 0; color: #333; }}
        .product-rating {{ color: #f39c12; font-size: 1.1rem; margin: 0.5rem 0; }}
        .product-price {{ color: #27ae60; font-weight: bold; font-size: 1.2rem; margin: 0.5rem 0; }}
        .product-pros, .product-cons {{ margin: 1rem 0; font-size: 0.9rem; }}
        .product-pros ul, .product-cons ul {{ margin-left: 1.5rem; }}
        .btn-affiliate {{ display: inline-block; background: #667eea; color: white; padding: 0.75rem 1.5rem; border-radius: 4px; text-decoration: none; margin-top: 1rem; transition: 0.3s; }}
        .btn-affiliate:hover {{ background: #764ba2; }}
        .faq-item {{ background: white; padding: 1.5rem; margin: 1rem 0; border-radius: 8px; border-left: 4px solid #667eea; }}
        .faq-item h4 {{ color: #667eea; margin-bottom: 0.5rem; }}
        .benefits-list {{ background: white; padding: 1.5rem; border-radius: 8px; margin: 1.5rem 0; }}
        .benefits-list ul {{ margin-left: 2rem; }}
        .benefits-list li {{ margin: 0.5rem 0; }}
        .buying-guide {{ background: #f0f7ff; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #667eea; margin: 1.5rem 0; }}
        .sidebar {{ position: sticky; top: 2rem; background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
        .two-column {{ display: grid; grid-template-columns: 1fr 300px; gap: 2rem; }}
        @media (max-width: 768px) {{ .two-column {{ grid-template-columns: 1fr; }} .hero-banner h2 {{ font-size: 1.5rem; }} .products-grid {{ grid-template-columns: 1fr; }} }}
        footer {{ background: #333; color: white; padding: 2rem; text-align: center; margin-top: 3rem; }}
    </style>
</head>
<body>
    <header>
        <h1>VitalPicks</h1>
        <p>Your Guide to Health & Fitness Excellence</p>
    </header>
    
    <div class="container">
        <div class="hero-banner">
            <h2>{topic['title']}</h2>
            <p>Comprehensive guide to finding the best {topic['focus_keyword']} for your health goals.</p>
        </div>
        
        <div class="two-column">
            <main>
                <h2>Top Picks</h2>
                <div class="products-grid">
                    {products_html}
                </div>
                
                <h2>Comparison Table</h2>
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Price Range</th>
                            <th>Rating</th>
                            <th>Category</th>
                        </tr>
                    </thead>
                    <tbody>
                        {comparison_rows}
                    </tbody>
                </table>
                
                <h2>Benefits of {topic['focus_keyword'].title()}</h2>
                <div class="benefits-list">
                    <ul>
                        {benefits_list}
                    </ul>
                </div>
                
                <div class="buying-guide">
                    <h3>Buying Guide</h3>
                    <p>{topic['buying_guide']}</p>
                </div>
                
                <h2>Frequently Asked Questions</h2>
                {faq_html}
            </main>
            
            <aside class="sidebar">
                <h3>Quick Links</h3>
                <ul style="list-style: none;">
                    <li><a href="{BASE_URL}/index.html" style="color: #667eea; text-decoration: none;">← Back Home</a></li>
                    <li style="margin-top: 1rem;"><a href="{BASE_URL}/affiliate-disclosure.html" style="color: #667eea; text-decoration: none;">Affiliate Disclosure</a></li>
                </ul>
            </aside>
        </div>
    </div>
    
    <footer>
        <p>&copy; 2026 VitalPicks. All rights reserved. | <a href="{BASE_URL}/privacy.html" style="color: white; text-decoration: none;">Privacy Policy</a></p>
    </footer>
    
    <script type="application/ld+json">
    {{
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "{topic['title']}",
        "description": "{topic['meta_description']}",
        "image": "https://picsum.photos/1200/630?random={topic['slug']}",
        "datePublished": "{datetime.now().isoformat()}",
        "author": {{
            "@type": "Organization",
            "name": "VitalPicks"
        }}
    }}
    </script>
</body>
</html>"""
    
    return html

# Generate and save articles
for topic in supplement_topics:
    html = create_article(topic)
    filepath = f"/app/vitalpicks/{topic['slug']}.html"
    with open(filepath, 'w') as f:
        f.write(html)
    print(f"✓ Created: {topic['slug']}.html")

print(f"\n✓ Generated {len(supplement_topics)} new articles for Supplements theme")
