import os, json, base64, time, re
import urllib.request

TOKEN = os.environ.get('GITHUB_TOKEN','')
REPO = 'gulrajb/vitalpicks'
AFFILIATE = 'health2099-20'

def gh_req(path, method='GET', data=None):
    url = f'https://api.github.com/repos/{REPO}/contents/{path}'
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method, headers={
        'Authorization': f'token {TOKEN}',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def gh_put(path, html, msg):
    try:
        existing = gh_req(path)
        sha = existing['sha']
    except: sha = None
    data = {'message': msg, 'content': base64.b64encode(html.encode()).decode()}
    if sha: data['sha'] = sha
    return gh_req(path, 'PUT', data)

# ─── SLUG → gradient class + emoji mapping ───────────────────────────────────
THEME = {
    # Supplements
    'protein':    ('linear-gradient(135deg,#e8f5e9,#a5d6a7)', '🥤'),
    'whey':       ('linear-gradient(135deg,#e8f5e9,#a5d6a7)', '🥛'),
    'mass':       ('linear-gradient(135deg,#e3f2fd,#90caf9)', '💪'),
    'creatine':   ('linear-gradient(135deg,#e3f2fd,#bbdefb)', '⚗️'),
    'bcaa':       ('linear-gradient(135deg,#e3f2fd,#64b5f6)', '🔬'),
    'pre-workout':('linear-gradient(135deg,#fce4ec,#f8bbd0)', '⚡'),
    'multivit':   ('linear-gradient(135deg,#fff8e1,#ffecb3)', '💊'),
    'vitamin-d':  ('linear-gradient(135deg,#fff9c4,#fff176)', '☀️'),
    'vitamin-c':  ('linear-gradient(135deg,#fff3e0,#ffcc80)', '🍊'),
    'vitamin-k':  ('linear-gradient(135deg,#e8f5e9,#c8e6c9)', '🌿'),
    'vitamin-b':  ('linear-gradient(135deg,#fff8e1,#ffe082)', '⚡'),
    'b12':        ('linear-gradient(135deg,#fff8e1,#ffe082)', '⚡'),
    'omega-3':    ('linear-gradient(135deg,#e0f7fa,#80deea)', '🐟'),
    'fish-oil':   ('linear-gradient(135deg,#e0f7fa,#80deea)', '🐟'),
    'magnesium':  ('linear-gradient(135deg,#e8f5e9,#a5d6a7)', '🔮'),
    'calcium':    ('linear-gradient(135deg,#fafafa,#e0e0e0)', '🦴'),
    'zinc':       ('linear-gradient(135deg,#e8f5e9,#a5d6a7)', '🛡️'),
    'iron':       ('linear-gradient(135deg,#fce4ec,#ef9a9a)', '⚙️'),
    'collagen':   ('linear-gradient(135deg,#fff8e1,#ffe082)', '✨'),
    'probiot':    ('linear-gradient(135deg,#fce4ec,#f48fb1)', '🦠'),
    'digestive':  ('linear-gradient(135deg,#fce4ec,#f48fb1)', '🫁'),
    'ashwag':     ('linear-gradient(135deg,#f1f8e9,#aed581)', '🌿'),
    'adapto':     ('linear-gradient(135deg,#f1f8e9,#aed581)', '🍄'),
    'turmeric':   ('linear-gradient(135deg,#fff3e0,#ffb74d)', '🌻'),
    'nootropic':  ('linear-gradient(135deg,#e8eaf6,#7986cb)', '🧠'),
    'sleep':      ('linear-gradient(135deg,#ede7f6,#ce93d8)', '🌙'),
    'melatonin':  ('linear-gradient(135deg,#ede7f6,#ce93d8)', '🌙'),
    'greens':     ('linear-gradient(135deg,#f1f8e9,#aed581)', '🥦'),
    'spirulina':  ('linear-gradient(135deg,#e0f7fa,#4dd0e1)', '🌊'),
    'hair':       ('linear-gradient(135deg,#fce4ec,#f06292)', '💇'),
    'eye':        ('linear-gradient(135deg,#e8eaf6,#9fa8da)', '👁️'),
    'joint':      ('linear-gradient(135deg,#fff3e0,#ffa726)', '🦵'),
    'liver':      ('linear-gradient(135deg,#f1f8e9,#aed581)', '🫁'),
    'anti-aging': ('linear-gradient(135deg,#fce4ec,#f48fb1)', '✨'),
    'weight-loss':('linear-gradient(135deg,#fce4ec,#ef9a9a)', '⚖️'),
    'fat-burn':   ('linear-gradient(135deg,#fce4ec,#ef9a9a)', '🔥'),
    'keto':       ('linear-gradient(135deg,#fff3e0,#ffcc80)', '🥑'),
    'intermitt':  ('linear-gradient(135deg,#fff3e0,#ffcc80)', '⏰'),
    'carb-block': ('linear-gradient(135deg,#fce4ec,#ef9a9a)', '🚫'),
    'electrolyte':('linear-gradient(135deg,#e0f7fa,#80deea)', '⚡'),
    'l-carni':    ('linear-gradient(135deg,#fce4ec,#f48fb1)', '🔥'),
    'glutamine':  ('linear-gradient(135deg,#e3f2fd,#90caf9)', '💪'),
    'dhea':       ('linear-gradient(135deg,#e8eaf6,#9fa8da)', '⚡'),
    'caffeine':   ('linear-gradient(135deg,#fbe9e7,#ff8a65)', '☕'),
    'coq10':      ('linear-gradient(135deg,#fce4ec,#ef9a9a)', '❤️'),
    'berberine':  ('linear-gradient(135deg,#f1f8e9,#aed581)', '🌿'),
    'nac':        ('linear-gradient(135deg,#e8f5e9,#a5d6a7)', '🛡️'),
    'colostrum':  ('linear-gradient(135deg,#fff8e1,#ffe082)', '🥛'),
    'heart':      ('linear-gradient(135deg,#fce4ec,#ef9a9a)', '❤️'),
    'bone':       ('linear-gradient(135deg,#fafafa,#e0e0e0)', '🦴'),
    'immune':     ('linear-gradient(135deg,#e8f5e9,#a5d6a7)', '🛡️'),
    'testosterone':('linear-gradient(135deg,#e3f2fd,#90caf9)', '⚡'),
    'senior':     ('linear-gradient(135deg,#fff8e1,#ffecb3)', '👴'),
    'women-over': ('linear-gradient(135deg,#fce4ec,#f48fb1)', '👩'),
    'men-over':   ('linear-gradient(135deg,#e3f2fd,#90caf9)', '🧑'),
    'anxiety':    ('linear-gradient(135deg,#ede7f6,#ce93d8)', '🧘'),
    'runner':     ('linear-gradient(135deg,#e3f2fd,#90caf9)', '🏃'),
    'muscle-gain':('linear-gradient(135deg,#e3f2fd,#90caf9)', '💪'),
    'prenatal':   ('linear-gradient(135deg,#fce4ec,#f48fb1)', '🤱'),
    'postnatal':  ('linear-gradient(135deg,#fce4ec,#f48fb1)', '🤱'),
    'vegan':      ('linear-gradient(135deg,#f1f8e9,#aed581)', '🌱'),
    'kids':       ('linear-gradient(135deg,#fff8e1,#ffecb3)', '🧒'),
    'teen':       ('linear-gradient(135deg,#e3f2fd,#90caf9)', '🧑'),
    'athlete':    ('linear-gradient(135deg,#e3f2fd,#90caf9)', '🏅'),
    'energy':     ('linear-gradient(135deg,#fbe9e7,#ff8a65)', '⚡'),
    'brain':      ('linear-gradient(135deg,#e8eaf6,#7986cb)', '🧠'),
    'gut':        ('linear-gradient(135deg,#fce4ec,#f48fb1)', '🫁'),
    'nmn':        ('linear-gradient(135deg,#e8eaf6,#7986cb)', '🔬'),
    'nad':        ('linear-gradient(135deg,#e8eaf6,#7986cb)', '🔬'),
    'resveratrol':('linear-gradient(135deg,#fce4ec,#f48fb1)', '🍷'),
    'alpha-lipoic':('linear-gradient(135deg,#e8f5e9,#a5d6a7)', '🛡️'),
    'coenzyme':   ('linear-gradient(135deg,#fce4ec,#ef9a9a)', '❤️'),
    'taurine':    ('linear-gradient(135deg,#e3f2fd,#90caf9)', '💪'),
    'glycine':    ('linear-gradient(135deg,#ede7f6,#ce93d8)', '🌙'),
    'rhodiola':   ('linear-gradient(135deg,#f1f8e9,#aed581)', '🌿'),
    'lions-mane': ('linear-gradient(135deg,#e8eaf6,#9fa8da)', '🧠'),
    'reishi':     ('linear-gradient(135deg,#f1f8e9,#aed581)', '🍄'),
    'mushroom':   ('linear-gradient(135deg,#f1f8e9,#aed581)', '🍄'),
    'ginkgo':     ('linear-gradient(135deg,#e8eaf6,#9fa8da)', '🧠'),
    'ginseng':    ('linear-gradient(135deg,#f1f8e9,#aed581)', '🌿'),
    'maca':       ('linear-gradient(135deg,#fff3e0,#ffcc80)', '🌱'),
    'saw-palm':   ('linear-gradient(135deg,#f1f8e9,#aed581)', '🌿'),
    '5-htp':      ('linear-gradient(135deg,#ede7f6,#ce93d8)', '🌙'),
    'valerian':   ('linear-gradient(135deg,#ede7f6,#ce93d8)', '🌙'),
    'passion':    ('linear-gradient(135deg,#ede7f6,#ce93d8)', '🌿'),
    'st-john':    ('linear-gradient(135deg,#fff9c4,#fff176)', '☀️'),
    'diabetic':   ('linear-gradient(135deg,#e0f7fa,#80deea)', '🩸'),
    'india':      ('linear-gradient(135deg,#e8f5e9,#a5d6a7)', '🇮🇳'),
    'post-workout':('linear-gradient(135deg,#e3f2fd,#90caf9)', '💪'),
    'intra':      ('linear-gradient(135deg,#e0f7fa,#80deea)', '⚡'),
    'meal-replac':('linear-gradient(135deg,#fff8e1,#ffecb3)', '🍽️'),
    'blender':    ('linear-gradient(135deg,#e8f5e9,#a5d6a7)', '🥤'),
    # Fitness
    'dumbbell':   ('linear-gradient(135deg,#e3f2fd,#42a5f5)', '🏋️'),
    'adjustable': ('linear-gradient(135deg,#e3f2fd,#42a5f5)', '⚖️'),
    'barbell':    ('linear-gradient(135deg,#e8eaf6,#5c6bc0)', '🏋️'),
    'kettlebell': ('linear-gradient(135deg,#e8eaf6,#5c6bc0)', '🔔'),
    'resistance-band':('linear-gradient(135deg,#e8f5e9,#66bb6a)', '🪢'),
    'pull-up':    ('linear-gradient(135deg,#fce4ec,#ef5350)', '🔗'),
    'squat-rack': ('linear-gradient(135deg,#e3f2fd,#1e88e5)', '🏗️'),
    'bench':      ('linear-gradient(135deg,#e3f2fd,#1e88e5)', '🛋️'),
    'power-rack': ('linear-gradient(135deg,#e3f2fd,#1e88e5)', '🏗️'),
    'treadmill':  ('linear-gradient(135deg,#e0f2f1,#26a69a)', '🏃'),
    'stationary-bike':('linear-gradient(135deg,#e8f5e9,#43a047)', '🚴'),
    'spin-bike':  ('linear-gradient(135deg,#e8f5e9,#43a047)', '🚴'),
    'rowing':     ('linear-gradient(135deg,#e0f7fa,#00acc1)', '🚣'),
    'elliptical': ('linear-gradient(135deg,#e8f5e9,#43a047)', '🚴'),
    'yoga':       ('linear-gradient(135deg,#f1f8e9,#9ccc65)', '🧘'),
    'pilates':    ('linear-gradient(135deg,#f3e5f5,#ab47bc)', '🧘'),
    'foam-roller':('linear-gradient(135deg,#f3e5f5,#ab47bc)', '🧻'),
    'massage-gun':('linear-gradient(135deg,#fff8e1,#ffa726)', '🔫'),
    'massage-roller':('linear-gradient(135deg,#fff8e1,#ffa726)', '🔫'),
    'jump-rope':  ('linear-gradient(135deg,#e8f5e9,#66bb6a)', '🪢'),
    'battle-rope':('linear-gradient(135deg,#e3f2fd,#42a5f5)', '🌀'),
    'ab-roller':  ('linear-gradient(135deg,#fce4ec,#ef5350)', '🔄'),
    'medicine-ball':('linear-gradient(135deg,#e3f2fd,#1e88e5)', '⚽'),
    'plyo-box':   ('linear-gradient(135deg,#e8eaf6,#5c6bc0)', '📦'),
    'trx':        ('linear-gradient(135deg,#fce4ec,#ef5350)', '🔗'),
    'agility':    ('linear-gradient(135deg,#e8f5e9,#66bb6a)', '🪜'),
    'balance':    ('linear-gradient(135deg,#f3e5f5,#ab47bc)', '⚖️'),
    'parallette': ('linear-gradient(135deg,#e3f2fd,#42a5f5)', '🤸'),
    'speed-bag':  ('linear-gradient(135deg,#fce4ec,#ef5350)', '👊'),
    'hand-grip':  ('linear-gradient(135deg,#e3f2fd,#42a5f5)', '✊'),
    'chalk':      ('linear-gradient(135deg,#fafafa,#e0e0e0)', '🤍'),
    'gym-bag':    ('linear-gradient(135deg,#e3f2fd,#42a5f5)', '👜'),
    'gym-glove':  ('linear-gradient(135deg,#e3f2fd,#42a5f5)', '🧤'),
    'gym-floor':  ('linear-gradient(135deg,#e8eaf6,#9fa8da)', '🏠'),
    'gym-mirror': ('linear-gradient(135deg,#e8eaf6,#9fa8da)', '🪞'),
    'home-gym':   ('linear-gradient(135deg,#e8eaf6,#9fa8da)', '🏠'),
    'running-shoe':('linear-gradient(135deg,#fce4ec,#e91e63)', '👟'),
    'lifting-belt':('linear-gradient(135deg,#e3f2fd,#1e88e5)', '🪖'),
    'weight-plate':('linear-gradient(135deg,#e8eaf6,#5c6bc0)', '⭕'),
    'lifting-strap':('linear-gradient(135deg,#e3f2fd,#42a5f5)', '🪢'),
    'wrist-wrap': ('linear-gradient(135deg,#e3f2fd,#42a5f5)', '💪'),
    'knee-sleeve':('linear-gradient(135deg,#e3f2fd,#42a5f5)', '🦵'),
    'elbow-sleeve':('linear-gradient(135deg,#e3f2fd,#42a5f5)', '💪'),
    'compression':('linear-gradient(135deg,#fce4ec,#e91e63)', '🧦'),
    'weightlifting-shoe':('linear-gradient(135deg,#fce4ec,#e91e63)', '👟'),
    'running-short':('linear-gradient(135deg,#e3f2fd,#42a5f5)', '🩳'),
    'sports-bra': ('linear-gradient(135deg,#fce4ec,#f48fb1)', '👙'),
    'gym-headphone':('linear-gradient(135deg,#e8eaf6,#9fa8da)', '🎧'),
    'workout-glove':('linear-gradient(135deg,#e3f2fd,#42a5f5)', '🧤'),
    'core':       ('linear-gradient(135deg,#fce4ec,#ef5350)', '🔥'),
    'cable-machine':('linear-gradient(135deg,#e3f2fd,#1e88e5)', '🔗'),
    'landmine':   ('linear-gradient(135deg,#e3f2fd,#1e88e5)', '🏋️'),
    'pull-up-station':('linear-gradient(135deg,#fce4ec,#ef5350)', '🔗'),
    'dip-bar':    ('linear-gradient(135deg,#e3f2fd,#42a5f5)', '🤸'),
    'gymnastic':  ('linear-gradient(135deg,#e3f2fd,#42a5f5)', '🤸'),
    'grip':       ('linear-gradient(135deg,#e3f2fd,#42a5f5)', '✊'),
    'stair':      ('linear-gradient(135deg,#e8f5e9,#66bb6a)', '🪜'),
    'mini-trampoline':('linear-gradient(135deg,#f1f8e9,#aed581)', '🪃'),
    'battle-rope-anchor':('linear-gradient(135deg,#e3f2fd,#42a5f5)', '⚓'),
    'under-desk': ('linear-gradient(135deg,#e0f2f1,#26a69a)', '🚶'),
    'workout-mirror':('linear-gradient(135deg,#e8eaf6,#9fa8da)', '🪞'),
    'fat-gripz':  ('linear-gradient(135deg,#e3f2fd,#42a5f5)', '✊'),
    'stretching': ('linear-gradient(135deg,#f3e5f5,#ab47bc)', '🧘'),
    'yoga-wheel': ('linear-gradient(135deg,#f3e5f5,#ab47bc)', '⭕'),
    # Health devices
    'fitness-track':('linear-gradient(135deg,#e8eaf6,#3f51b5)', '⌚'),
    'smart-scale':('linear-gradient(135deg,#e0f2f1,#00897b)', '⚖️'),
    'blood-press':('linear-gradient(135deg,#fce4ec,#d32f2f)', '❤️'),
    'glucose':    ('linear-gradient(135deg,#fff3e0,#e65100)', '🩸'),
    'pulse-ox':   ('linear-gradient(135deg,#e0f2f1,#00897b)', '💓'),
    'sleep-track':('linear-gradient(135deg,#ede7f6,#9c27b0)', '😴'),
    'air-purif':  ('linear-gradient(135deg,#e0f7fa,#00acc1)', '🌬️'),
    'red-light':  ('linear-gradient(135deg,#fce4ec,#d32f2f)', '🔴'),
    'cpap':       ('linear-gradient(135deg,#e0f2f1,#00897b)', '😴'),
    'sauna':      ('linear-gradient(135deg,#fff3e0,#ff8f00)', '🧖'),
    'cold-plunge':('linear-gradient(135deg,#e0f7fa,#0097a7)', '🧊'),
    'cgm':        ('linear-gradient(135deg,#fff3e0,#e65100)', '🩸'),
    'heart-rate': ('linear-gradient(135deg,#fce4ec,#d32f2f)', '❤️'),
    'smart-ring': ('linear-gradient(135deg,#e8eaf6,#3f51b5)', '💍'),
    'thermometer':('linear-gradient(135deg,#fce4ec,#d32f2f)', '🌡️'),
    'nebulizer':  ('linear-gradient(135deg,#e0f7fa,#00acc1)', '🫁'),
    'posture':    ('linear-gradient(135deg,#e3f2fd,#1e88e5)', '🧍'),
    # Wellness
    'ergonomic':  ('linear-gradient(135deg,#e3f2fd,#0277bd)', '🪑'),
    'standing-desk':('linear-gradient(135deg,#e8eaf6,#4527a0)', '🖥️'),
    'water-bottle':('linear-gradient(135deg,#e0f7fa,#006064)', '💧'),
    'fitness-app':('linear-gradient(135deg,#f3e5f5,#7b1fa2)', '📱'),
}

DEFAULT = ('linear-gradient(135deg,#e8f5e9,#a5d6a7)', '💊')

def get_theme(slug):
    s = slug.lower()
    for key,(grad,icon) in THEME.items():
        if key in s:
            return grad, icon
    return DEFAULT

def fix_html(html, slug):
    """Replace Unsplash img tags with CSS gradient divs"""
    grad, icon = get_theme(slug)
    
    # Pattern 1: <img ... class="hero-img"> (old articles)
    hero_div = f'<div style="width:100%;height:280px;background:{grad};border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:80px;margin-bottom:24px" role="img" aria-label="{slug.replace("-"," ").title()}">{icon}</div>'
    html = re.sub(r'<img[^>]+class="hero-img"[^>]*>', hero_div, html)
    
    # Pattern 2: <img ... class="hi-img"> (newer articles)  
    hi_div = f'<div style="width:100%;height:280px;background:{grad};border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:80px;margin-bottom:24px" role="img" aria-label="{slug.replace("-"," ").title()}">{icon}</div>'
    html = re.sub(r'<img[^>]+class="hi-img"[^>]*>', hi_div, html)
    
    # Pattern 3: hero banner image style used in some articles
    # <div class="hb" style="padding:0;overflow:hidden;display:block"><img ...>
    def replace_hb_img(m):
        return f'<div class="hb"><div style="width:100%;height:220px;background:{grad};display:flex;align-items:center;justify-content:center;font-size:64px;border-radius:14px 14px 0 0">{icon}</div>\n<div style="padding:28px 32px">'
    html = re.sub(r'<div class="hb" style="padding:0[^"]*">[\s]*<img[^>]+>[\s]*<div style="padding:[^"]*">', replace_hb_img, html)
    
    # Pattern 4: any remaining Unsplash images  
    html = re.sub(
        r'<img\s+src="https://images\.unsplash\.com/[^"]*"[^>]*>',
        f'<div style="width:100%;height:240px;background:{grad};border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:64px;margin-bottom:20px">{icon}</div>',
        html
    )
    
    return html

# ─── GET ALL EXISTING ARTICLE PAGES ──────────────────────────────────────────
print("Fetching file list...")
files = gh_req('')
pages = [f for f in files if f['name'].endswith('.html') and (
    f['name'].startswith('best-') or f['name'].startswith('how-')
)]
print(f"Found {len(pages)} article pages to fix")

ok = err = 0
for p in pages:
    slug = p['name'].replace('.html','')
    try:
        data = gh_req(p['name'])
        sha = data['sha']
        html = base64.b64decode(data['content']).decode('utf-8', errors='replace')
        
        # Only process if it has Unsplash images
        if 'unsplash.com' not in html:
            continue
            
        fixed = fix_html(html, slug)
        if fixed == html:
            continue
            
        gh_req(p['name'], 'PUT', {
            'message': f'Fix images: {slug}',
            'content': base64.b64encode(fixed.encode()).decode(),
            'sha': sha
        })
        ok += 1
        print(f"  ✅ [{ok}] {slug}")
        time.sleep(0.45)
    except Exception as e:
        err += 1
        print(f"  ❌ {slug}: {e}")
        time.sleep(0.8)

print(f"\nFixed {ok} articles. Errors: {err}")
