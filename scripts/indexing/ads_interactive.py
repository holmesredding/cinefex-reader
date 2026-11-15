"""Advertisers for issues 127-172 (the interactive editions): from ad image names and the links on each ad page."""
import json, re, urllib.parse
from common import load_issue, page_html, ALIAS_OF, DOMAIN_OF, norm

SOCIAL = re.compile(r'facebook|twitter|instagram|linkedin|youtube|vimeo|bit\.ly|goo\.gl|^t\.co$|apple\.com|itunes|dropbox|imdb')

def stem(f):
    s = re.sub(r'\.(jpe?g|png)$', '', f, flags=re.I)
    s = re.sub(r'^(AD|Ad|ad)[ _-]*\d+([-_]\d+)?[ _-]*', '', s)
    s = re.sub(r'([_ -]?(VERTICAL|HORIZONTAL|HALF|FULL|SPREAD|PAGE|LEFT|RIGHT|V\d|\d+))+$', '', s, flags=re.I)
    return s.strip(' _-').replace('_', ' ').replace('-', ' ')

def ads(root):
    out = []
    for n in range(127, 173):
        d = load_issue(root, n)
        for p in d['pages']:
            if p['title'] != 'Advertisement' and not p['title'].startswith('Closing'):
                continue
            html = page_html(root, n, p)
            urls = re.findall(r'data-media-src="([^"]+)"', html)
            found = []                                   # (advertiser, image url)
            for u in urls:
                name = ALIAS_OF.get(norm(stem(urllib.parse.unquote(u).split('/')[-1])))
                if name and name not in [f[0] for f in found]: found.append((name, u))
            for h in re.findall(r'href="(https?://[^"]+)"', html):
                dom = re.sub(r'^(www\.)?', '', urllib.parse.urlsplit(h).netloc.lower())
                if not dom or SOCIAL.search(dom): continue
                name = DOMAIN_OF.get(dom)
                if name and name not in [f[0] for f in found]: found.append((name, urls[0] if urls else None))
            if not found and p['title'].startswith('Closing'):
                continue                                 # closing page with no ad on it
            for name, img in found or [('Unidentified advertiser', urls[0] if urls else None)]:
                out.append(dict(issue=n, ref=p['ref'], advertiser=name, image=img, source='filename/link'))
        for f in d.get('films', []):
            if f.get('title') == 'Advertiser showcase':
                out.append(dict(issue=n, ref=d['pages'][0]['ref'], advertiser='Advertiser showcase (video)', image=f.get('poster'),
                                note=f"Video ad {f.get('detail','').title()}, {f.get('duration','')}, in the issue's Clips", source='clip'))
    return out
