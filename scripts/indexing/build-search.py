#!/usr/bin/env python3
"""Build the full-text search files from the OCR page text (scripts/indexing/data/page-text/<n>.json).

usage: python3 scripts/indexing/build-search.py [repo root]
writes <root>/assets/data/search/
  meta.json          issue -> [date, cover image, [ad page indexes]]
  words/<xx>.json    word -> pages it appears on (shards by the word's first two characters)
  text/<n>.json      the text of every page of issue n, for phrases and result snippets

A page key is issue * 1000 + page index; each word's page list is stored sorted, delta-encoded, in base 36.
"""
import json, os, re, sys, unicodedata
from collections import defaultdict
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import load_issue

root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..'))
src = os.path.join(HERE, 'data', 'page-text')
out = os.path.join(root, 'assets', 'data', 'search')
os.makedirs(os.path.join(out, 'words'), exist_ok=True)
os.makedirs(os.path.join(out, 'text'), exist_ok=True)

STOP = set('''the a an and or of to in on at by for with from as is was were be been are it its this that these those
he she they his her their we our you your i me my not no but so if then than there here which who whom what when where
how all any each also into over out up down about after before more most such only own same can could would should will
just very had has have do did does one two'''.split())   # keep in step with search.js

def tidy(t):
    t = re.sub(r'(\w)-\n(\w)', r'\1\2', t)                 # words split across lines: "sto-\nry"
    t = unicodedata.normalize('NFKC', t).replace('­', '')
    return re.sub(r'\s+', ' ', t).strip()

def words(t):  # same rule as search.js: lower case, accents folded, letters and digits
    t = ''.join(c for c in unicodedata.normalize('NFKD', t.lower()) if not unicodedata.combining(c))
    return {w for w in re.findall(r'[a-z0-9]+', t.replace("'", '').replace('’', '')) if len(w) > 1 and w not in STOP}

def b36(n):
    s = ''
    while True:
        n, r = divmod(n, 36); s = '0123456789abcdefghijklmnopqrstuvwxyz'[r] + s
        if not n: return s

postings = defaultdict(list)
meta, issues, pages_total = {}, 0, 0
for n in range(1, 173):
    d = load_issue(root, n)
    path = os.path.join(src, f'{n}.json')
    text = json.load(open(path)) if os.path.exists(path) else {}
    titles = {}
    for st in d['stories']:                                  # story title for every page of each article
        if isinstance(st.get('article'), int): titles[st['article']] = st['title']
    rows, current, ads = [], '', []
    for i, p in enumerate(d['pages']):
        current = titles.get(i, current) if p['title'] not in ('Advertisement', 'Cover', 'Contents') else current
        kind = 1 if p['title'] == 'Advertisement' else 0
        if kind: ads.append(i)
        t = tidy(text.get(p['ref'], ''))
        label = p['title'] if p['title'] in ('Advertisement', 'Cover', 'Contents') or p['title'].startswith('Closing') else (current or p['title'])
        rows.append([p['ref'], label, t])
        for w in words(t): postings[w].append(n * 1000 + i)
        pages_total += 1
    if text: issues += 1
    cover = d.get('cover') or (d['pages'][0].get('preview') if d['pages'] else '')
    meta[n] = [d['date'], cover, ads]
    json.dump({'issue': n, 'date': d['date'], 'pages': rows}, open(os.path.join(out, 'text', f'{n}.json'), 'w'), ensure_ascii=False, separators=(',', ':'))

shards = defaultdict(dict)
for w, keys in postings.items():
    keys.sort(); prev = 0; enc = []
    for k in keys: enc.append(b36(k - prev)); prev = k
    shards[w[:2]][w] = ','.join(enc)
for s, table in shards.items():
    json.dump(table, open(os.path.join(out, 'words', f'{s}.json'), 'w'), separators=(',', ':'))
json.dump({'version': 1, 'issues': meta}, open(os.path.join(out, 'meta.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(out) for f in fs)
print(f'search/: {issues} issues with text, {pages_total} pages, {len(postings)} words in {len(shards)} shards, {size / 1e6:.1f} MB')
