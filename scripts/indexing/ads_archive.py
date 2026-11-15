"""Advertisers for issues 1-126 (the archive editions).

Sources, best first:
  1. Each issue's printed ADVERTISER INDEX (from issue 50 on): name -> page numbers (data/advertiser-index.json).
  2. Text recognised on the ad page itself, matched against the known advertisers (data/archive-ad-text.json).
Anything left is listed as "Unidentified advertiser" so the ad is still browsable.
"""
import json, os, re
from collections import Counter, defaultdict
from common import load_issue, page_text as recognised_page_text, ALIAS_OF, CATEGORY_OF, norm
from advertisers import VFX, FX, SOFT, HARD, POST, STUDIO, SCHOOL, EVENT, PUB, HOUSE

HERE = os.path.dirname(__file__)
SUFFIX = re.compile(r'\b(INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|LLC|GMBH|PLC|THE|AND ASSOCIATES|ASSOCIATES)\b')
SHORT_OK = {'ILM', 'MPC', 'SGI', 'PDI', 'KNB', 'VES', 'ARRI', 'HPA', 'FMX', 'DGA', 'ASC', 'PGA', 'VIFX', 'CIS', 'EFILM'}

def key(name):
    k = SUFFIX.sub(' ', norm(name))
    return re.sub(r'\s+', ' ', k).strip()

ALIAS_KEY = {}
for a, canon in ALIAS_OF.items():
    if not SUFFIX.sub(' ', a).strip(): continue        # an alias that is only a suffix word ("COMPANY") is useless here
    ALIAS_KEY.setdefault(SUFFIX.sub(' ', a).strip(), canon)
    ALIAS_KEY.setdefault(re.sub(r'\s+', ' ', SUFFIX.sub(' ', a)).strip(), canon)

RULES = [  # category guesses for advertisers not in advertisers.py
    (HOUSE, r'\bCINEFEX\b'),
    (SCHOOL, r'SCHOOL|INSTITUTE|UNIVERSITY|COLLEGE|ACADEMY|TRAINING|EXTENSION|COURSE|WORKSHOPS?\b|UCLA|USC\b'),
    (EVENT, r'SIGGRAPH|CONFERENCE|FESTIVAL|EXPO|SOCIETY|GUILD|AWARDS|SHOW\b|CONVENTION|NAB\b'),
    (PUB, r'MAGAZINE|PRESS|BOOKS?|PUBLISH|VIDEO ?TAPES?|LASER ?DISC|COLLECTIB|PRINTS|POSTERS|STORE|COMICS'),
    (STUDIO, r'PICTURES|ENTERTAINMENT|FILMS? CORP|STUDIOS INC|TRISTAR|COLUMBIA|UNIVERSAL|PARAMOUNT|WARNER|DISNEY|MGM|ORION|CAROLCO|DREAMWORKS'),
    (SOFT, r'SOFTWARE|SOFTIMAGE|ALIAS|WAVEFRONT|GRAPHICS|ANIMATION SYSTEMS|DIGITAL ARTS|DISCREET|MAYA|AUTODESK|3D\b|CAD\b'),
    (HARD, r'CAMERA|MOTION CONTROL|CONTROLS?\b|OPTICS|LENS|ELECTRONICS|SYSTEMS|TECHNOLOG|HYDRAULIC|PNEUMATIC|LIGHTING|ROBOTIC|COMPUTERS?|ENGINEERING|SCIENCES|FIBER|MONITORS?|SCANNER|RECORDER|LASER'),
    (FX, r'MAKE ?UP|MAKEUP|CREATURE|PROSTHETIC|LATEX|SILICONE|FOAM|SCULPT|MOLD|CASTING|RESIN|PLASTICS?|CLAY|MODELS?\b|MINIATURE|PYRO|SPECIAL EFFECTS|FX\b|F X\b|ANIMATRONIC|PUPPET|PROPS?\b|SUPPLY|SUPPLIES|NEON|FOG|SMOKE|SNOW|FLUORESCENT|SHOP\b'),
    (POST, r'\bLAB\b|LABORATOR|FILM LAB|KODAK|TITLES?\b|POST\b|OPTICAL|VIDEO\b|RENTALS?|SERVICES|DUPLICATION|SOUND|IMAGICA|TECHNICOLOR|DELUXE|CONSULTING|INSURANCE|STAFFING|RECRUIT'),
    (VFX, r'DIGITAL|VISUAL|EFFECTS|IMAGES|ILLUSION|PIXEL|STUDIOS?\b|PRODUCTIONS|ANIMATION|DOMAIN|FILMWORKS|DESIGN'),
]

def category(name):
    if name in CATEGORY_OF: return CATEGORY_OF[name]
    n = norm(name)
    for cat, rx in RULES:
        if re.search(rx, n): return cat
    return 'Other'

FRAGMENTS = {'ARTS', 'CENTER', 'CENTERS', 'COLLEGE', 'COMMUNITIES', 'DESIGN', 'COSMETICS', 'CONDITIONING', 'CAM', 'SUPPLIES',
             'HAIRSTYLISTS', 'STUDIOS', 'STUDIO', 'PRODUCTIONS', 'EFFECTS', 'SYSTEMS', 'SOFTWARE', 'INTERNATIONAL', 'GROUP',
             'ENTERTAINMENT', 'DIGITAL', 'PICTURES', 'IMAGING', 'ANIMATION', 'CHARACTER ANIMATION', 'INSTITUTE', 'SCHOOL', 'UNIVERSITY'}

def clean(name):
    """Tidy an index name read by OCR; None for fragments that are not names."""
    n = re.sub(r'^[^A-Za-z0-9]+', '', name).strip()
    n = re.sub(r'^\d{1,3}[.,]\s+(?=[A-Za-z])', '', n)              # "23. Video Watchdog"
    if len(n) < 3 or not re.match(r'[A-Z0-9]', n) or re.match(r'^\d+[, ]', n): return None
    # Two columns run together leave lowercase debris in front of the real name: keep the trailing run of
    # capitalised words ("Maya training to animation & visual Cyberware Laboratory" -> "Cyberware Laboratory").
    words = n.split()
    small = {'of', 'and', 'the', 'for', '&', 'de', 'in', 'on', 'at', 'y', 'du', 'a', '+', '/', '-'}
    lower = [w for w in words if w[0].islower() and w.lower() not in small]
    if lower and (words[0][0].islower() or len(lower) >= 2):
        run = []
        for w in reversed(words):
            if w[0].isupper() or w[0].isdigit() or (w.lower() in small and run): run.insert(0, w)
            else: break
        while run and run[0].lower() in small: run.pop(0)
        n = ' '.join(run)
        if len(n) < 4: return None
    if key(n) in FRAGMENTS or re.search(r'\b(in|and|of)\s*$', n) or len(n.split()) > 7: return None
    return n

def tight(k): return k.replace(' ', '')

def canonical_names(index):
    """Group index spellings across issues (OCR variants merged); known advertisers keep their canonical names."""
    import difflib
    spellings = defaultdict(Counter)
    for entries in index.values():
        for e in entries:
            n = clean(e['name'])
            if n: spellings[tight(key(n))][n] += 1
    known_tight = {tight(k): v for k, v in ALIAS_KEY.items()}
    keys = sorted(spellings, key=lambda k: -sum(spellings[k].values()))
    parent = {}
    for i, k in enumerate(keys):                     # fold rarer OCR variants into the common spelling
        if k in known_tight or len(k) < 6: continue
        for j in range(i):
            c = keys[j]
            if c in parent or abs(len(c) - len(k)) > 2: continue
            if difflib.SequenceMatcher(None, k, c).ratio() >= 0.9:
                parent[k] = c; break
    out = {}
    for k in keys:
        root = parent.get(k, k)
        out[k] = known_tight.get(root) or known_tight.get(k) or spellings[root].most_common(1)[0][0]
    return out

ALIASES_BY_LEN = sorted(ALIAS_OF, key=len, reverse=True)
STOP = {'COMPANY', 'STUDIO', 'STUDIOS', 'PRODUCTIONS', 'ENTERPRISES', 'CORPORATION', 'INTERNATIONAL', 'EFFECTS', 'DIGITAL',
        'PICTURES', 'FILM', 'FILMS', 'VISUAL', 'SYSTEMS', 'SPECIAL', 'DESIGN', 'GROUP', 'ENTERTAINMENT', 'ANIMATION', 'CINEFEX',
        'MAKEUP', 'SCHOOL', 'IMAGES', 'IMAGING', 'TECHNOLOGY', 'TECHNOLOGIES', 'SOFTWARE', 'INDUSTRIES', 'ASSOCIATES', 'MEDIA',
        'CREATIVE', 'GRAPHICS', 'MOTION', 'PRODUCTION', 'SERVICES', 'LABORATORY', 'INSTITUTE', 'UNIVERSITY', 'COLLEGE', 'CENTER'}
def local_match(text, issue_names):
    """An advertiser from this issue's own index whose distinctive words appear on the page."""
    t = ' ' + norm(text) + ' '
    best, score = None, 0
    for nm in issue_names:
        words = [w for w in norm(nm).split() if len(w) >= 4 and w not in STOP]
        if not words: continue
        hit = sum(1 for w in words if ' ' + w + ' ' in t)
        if hit and hit / len(words) >= 0.5 and hit > score: best, score = nm, hit
    return [best] if best else []
def text_match(text):
    t = ' ' + norm(text) + ' '
    hits = []
    for a in ALIASES_BY_LEN:
        if (len(a) >= 5 or a in SHORT_OK) and ' ' + a + ' ' in t:
            name = ALIAS_OF[a]
            if name not in hits: hits.append(name)
    return hits[:1]          # the most specific (longest) match only; page text is a weak source

def ads(root):
    index = json.load(open(os.path.join(HERE, 'data', 'advertiser-index.json')))
    text = json.load(open(os.path.join(HERE, 'data', 'archive-ad-text.json')))
    # Full page text from ocr-pages.swift (Apple Vision), when it has been run, fills any gaps.
    for n in range(1, 127):
        try: recognised = recognised_page_text(root, n)
        except FileNotFoundError: continue
        for ref, t in recognised.items():
            if t and len(t) > len(text.get(f'{n}:{ref}', '')): text[f'{n}:{ref}'] = t
    names = canonical_names(index)
    labels = {k: v for k, v in json.load(open(os.path.join(HERE, 'data', 'ad-labels.json'))).items() if not k.startswith('_')}
    known_tight = {tight(k): v for k, v in ALIAS_KEY.items()}
    def canon(label):
        t = tight(key(label))
        return known_tight.get(t) or names.get(t) or label
    opath = os.path.join(HERE, 'data', 'index-offsets.json')
    offsets = json.load(open(opath)) if os.path.exists(opath) else {}   # issues whose printed page numbers are shifted
    out = []
    for n in range(1, 127):
        d = load_issue(root, n)
        pages = d['pages']; by_ref = {p['ref']: p for p in pages}
        ad_refs = [p['ref'] for i, p in enumerate(pages)
                   if p['title'] == 'Advertisement' or (p['title'].startswith('Closing') and i > 0)]
        from_index = defaultdict(list)
        refs = [p['ref'] for p in pages]; pos = {r: i for i, r in enumerate(refs)}; k = offsets.get(str(n), 0)
        for e in index.get(str(n), []):
            c = clean(e['name'])
            if not c: continue
            for ref in e['pages']:
                if k and ref in pos and 0 <= pos[ref] + k < len(refs): ref = refs[pos[ref] + k]
                nm = names[tight(key(c))]
                if nm not in from_index[ref]: from_index[ref].append(nm)
        issue_names = sorted({names[tight(key(c))] for e in index.get(str(n), []) for c in [clean(e['name'])] if c})
        for ref in sorted(set(ad_refs) | set(from_index), key=lambda r: [int(x) for x in re.findall(r'\d+', r)] or [0]):
            p = by_ref.get(ref)
            if not p: continue
            img = (re.findall(r'data-media-src="([^"]+)"', open(os.path.join(root, 'issues', str(n), p['file']), encoding='utf-8').read()) or [p.get('preview')])[0]
            page_text = text.get(f'{n}:{ref}', '')
            label = [canon(l) for l in labels.get(f'{n}:{ref}', [])]
            found = label or from_index.get(ref) or local_match(page_text, issue_names) or text_match(page_text)
            src = 'checked by eye' if label else 'advertiser index' if from_index.get(ref) else 'page text' if found else 'none'
            if not found:
                if p['title'].startswith('Closing'): continue     # a closing page that is not an ad
                found = ['Unidentified advertiser']
            for nm in found:
                out.append(dict(issue=n, ref=ref, advertiser=nm, image=img, source=src))
    return out
