import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from advertisers import A

def norm(s):
    return re.sub(r'[^A-Z0-9]+', ' ', s.upper().replace('&', ' ')).strip()

ALIAS_OF, DOMAIN_OF, CATEGORY_OF = {}, {}, {}
for name, (cat, aliases, doms) in A.items():
    CATEGORY_OF[name] = cat
    for a in aliases: ALIAS_OF.setdefault(norm(a), name)
    ALIAS_OF.setdefault(norm(name), name)
    for part in re.split(r' / |\|', name.split(' (')[0]):
        if len(part) > 3: ALIAS_OF.setdefault(norm(part), name)
    ALIAS_OF.setdefault(norm(name.split(' (')[0]), name)
    for d in doms: DOMAIN_OF[d] = name

_cache = {}
def load_issue(root, n):
    if n not in _cache:
        s = open(os.path.join(root, 'issues', str(n), 'data.js'), encoding='utf-8').read()
        _cache[n] = json.loads(re.search(r'window\.ISSUE=(\{.*\})', s, re.S).group(1))
    return _cache[n]

def page_html(root, n, p):
    return open(os.path.join(root, 'issues', str(n), p['file']), encoding='utf-8').read()

def page_text(root, n):
    source = os.path.join(os.path.dirname(__file__), 'data', 'page-text', f'{n}.json')
    if os.path.exists(source):
        text = json.load(open(source))
    else:
        # Published page text can rebuild the index without repeating the OCR.
        folder = os.path.join(root, 'assets', 'data', 'search', 'text')
        js = os.path.join(folder, f'{n}.js')
        raw = os.path.join(folder, f'{n}.json')
        if os.path.exists(js):
            body = open(js, encoding='utf-8').read()
            data = json.loads(body[body.index(',') + 1:body.rfind(')')])
        elif os.path.exists(raw):
            data = json.load(open(raw))
        else:
            raise FileNotFoundError(f'No page text for issue {n}. Run ocr-pages.swift first.')
        text = {row[0]: row[2] for row in data['pages']}
    captions = os.path.join(os.path.dirname(__file__), 'data', 'background-text', f'{n}.json')
    if os.path.exists(captions):
        for ref, caption in json.load(open(captions)).items():
            current = text.get(ref, '')
            if caption.strip() and ' '.join(caption.split()) not in ' '.join(current.split()):
                text[ref] = (caption + '\n' + current).strip()
    return text
