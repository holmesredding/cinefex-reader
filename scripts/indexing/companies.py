#!/usr/bin/env python3
"""Companies index: which effects companies each article discusses.

Needs the page text from ocr-pages.swift (scripts/indexing/data/page-text/<n>.json).
usage: python3 scripts/indexing/companies.py [repo root]  ->  scripts/indexing/data/companies.json
Then run build-index.py to fold it into index-extra.js.
"""
import json, os, re, sys
from collections import Counter, defaultdict
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import load_issue, CATEGORY_OF
from advertisers import A, VFX, FX, SOFT, HARD, POST, STUDIO

root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..'))
TEXT = os.path.join(HERE, 'data', 'page-text')

# Companies that matter to the story of effects but seldom or never advertised. name: (category, aliases)
MORE = {
    'Apogee Productions': (VFX, ['Apogee']),
    'Introvision': (VFX, ['Introvision']),
    'Entertainment Effects Group': (VFX, ['Entertainment Effects Group', 'EEG']),
    'Digital Productions': (VFX, ['Digital Productions']),
    'MAGI / SynthaVision': (VFX, ['MAGI', 'Mathematical Applications Group', 'SynthaVision']),
    'Information International (Triple-I)': (VFX, ['Information International', 'Triple-I', 'Triple I']),
    'Robert Abel & Associates': (VFX, ['Robert Abel and Associates', 'Robert Abel & Associates', 'Abel and Associates']),
    'Universal Hartland': (VFX, ['Universal Hartland']),
    'Illusion Arts': (VFX, ['Illusion Arts']),
    'Visual Concept Engineering (VCE)': (VFX, ['Visual Concept Engineering', 'VCE']),
    'Fantasy II Film Effects': (VFX, ['Fantasy II']),
    'Grant McCune Design': (FX, ['Grant McCune Design']),
    'Magic Camera Company': (VFX, ['Magic Camera Company']),
    'Optic Nerve Studios': (FX, ['Optic Nerve']),
    'XFX': (FX, ['XFX']),
    'Spectral Motion': (FX, ['Spectral Motion']),
    'The Character Shop': (FX, ['Character Shop']),
    'Chiodo Brothers': (FX, ['Chiodo Brothers', 'Chiodo Bros']),
    'Aardman Animations': (VFX, ['Aardman']),
    'Manex Visual Effects': (VFX, ['Manex']),
    'Mass.Illusion': (VFX, ['Mass.Illusion', 'Mass Illusion']),
    'Warner Digital Studios': (VFX, ['Warner Digital']),
    'Digital Pictures': (VFX, ['Digital Pictures']),
    'Stetson Visual Services': (VFX, ['Stetson Visual']),
    'Hunter/Gratzner Industries': (FX, ['Hunter/Gratzner', 'Hunter Gratzner']),
    'Image Animation': (FX, ['Image Animation']),
    'Screen Novelties': (FX, ['Screen Novelties']),
    'Laika': (STUDIO, ['Laika']),
}
# Aliases too generic to count in running text.
SKIP = {'LOOK', 'BLUR', 'GHOST', 'RISE', 'FUEL', 'UNION', 'METHOD', 'BASE', 'PROOF', 'LUX', 'TEN', 'COMPANY', 'EDITOR', 'MILL',
        'SPIN', 'ODD', 'BLIND', 'ATLAS', 'ARGON', 'ALCHEMY', 'KELVIN', 'LINDSAY', 'ABSOLUTE', 'FOLKS', 'MILK', 'CHAOS', 'EPIC',
        'MASSIVE', 'SHAPES', 'EMBASSY', 'FOX', 'WB', 'UT', 'USC', 'MIT', 'NIM', 'XM', 'CHE', 'ICO', 'TNC', 'NAC', 'PRG',
        'SONY', 'DISNEY', 'UNIVERSAL', 'PARAMOUNT', 'AMAZON', 'NETFLIX', 'NBC', 'MGM', 'DD', 'SPI', 'OPTICAL', 'PROFILE',
        'DANIELS', 'LAIRD', 'CINEFEX', 'FB', 'MESSAGE', 'FRACTURE', 'CENTROID', 'CONTAINMENT', 'MOCHA', 'FUSION', 'HARRY',
        'HENRY', 'DOMINO', 'MOTION', 'THE FRONT', 'FRONT', 'FRAME BY FRAME', 'DEADLINE', 'APPLE', 'JELLYFISH', 'MITCHELL', 'PARALLAX', 'FOUNDRY', 'THE FOUNDRY', 'VIDEO IMAGE', 'LIGHTSTORM', 'MOVING PICTURE', 'LEGACY', 'RISING SUN', 'HYBRIDE ', 'INTELLIGENT', 'SPECTRAL MOTION ', 'ORIGINAL', 'TWISTED MEDIA', 'FLAME', 'INFERNO', 'MAYA', 'NUKE', 'ARNOLD', 'SHAKE', 'ALIAS', 'MILO', 'ADOBE', 'APOGEE '}
INCLUDE = {VFX, FX, SOFT, HARD, POST}

def patterns():
    out = []
    for name, (cat, aliases, _d) in A.items():
        if cat not in INCLUDE: continue
        for a in [name.split(' (')[0].split(' / ')[0]] + aliases:
            if a.upper() in SKIP or len(a) < 3: continue
            out.append((a, name, cat))
    for name, (cat, aliases) in MORE.items():
        for a in aliases: out.append((a, name, cat))
    compiled = []
    for a, name, cat in sorted(set(out), key=lambda x: -len(x[0])):
        # Names are matched as printed (capitals included), so ordinary words never count as companies.
        form = a if not a.isupper() or len(a) <= 5 else a.title().replace(' And ', ' and ').replace(' Of ', ' of ')
        forms = {form, a} if a.isupper() and len(a) > 5 else {form}
        for f in forms:
            compiled.append((re.compile(r'(?<![A-Za-z0-9])' + re.escape(f).replace(r'\ ', r'[\s-]+') + r'(?![A-Za-z0-9])'), name, cat))
    return compiled

def main():
    pats = patterns()
    rows = []
    for n in range(1, 173):
        path = os.path.join(TEXT, f'{n}.json')
        if not os.path.exists(path): continue
        text = json.load(open(path))
        d = load_issue(root, n); pages = d['pages']
        starts = sorted((s['article'], s) for s in d['stories'] if isinstance(s.get('article'), int))
        for k, (start, story) in enumerate(starts):
            end = starts[k + 1][0] if k + 1 < len(starts) else len(pages)
            body = [(pages[i]['ref'], text.get(pages[i]['ref'], '')) for i in range(start, end)
                    if pages[i]['title'] != 'Advertisement']
            counts, first = Counter(), {}
            for ref, t in body:
                for rx, name, cat in pats:
                    c = len(rx.findall(t))
                    if c:
                        counts[name] += c
                        first.setdefault(name, ref)
            for name, c in counts.items():
                if c < 2: continue                                   # a passing mention is not indexed
                rows.append(dict(issue=n, ref=first[name], company=name, category=CATEGORY_OF.get(name) or MORE.get(name, ('Other',))[0],
                                 mentions=c, article=story['title'], image=story.get('image')))
    out = os.path.join(HERE, 'data', 'companies.json')
    json.dump(rows, open(out, 'w'), indent=0)
    print(f'{len(rows)} company–article links, {len({r["company"] for r in rows})} companies -> {out}')

if __name__ == '__main__':
    main()
