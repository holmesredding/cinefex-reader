from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin,urlparse,unquote
import json,re,sys
root=Path(__file__).resolve().parent
allowed={'.html','.css','.js','.json','.md','.txt','.py'}
errors=[];files=[p for p in root.rglob('*') if p.is_file() and '.git' not in p.relative_to(root).parts and '__pycache__' not in p.relative_to(root).parts]
for p in files:
 if p.name not in {'.nojekyll','.gitignore'} and p.suffix.lower() not in allowed:errors.append('Unexpected file type: '+str(p.relative_to(root)))
 if p.suffix in {'.js','.css','.html','.json'}:
  s=p.read_text()
  if re.search(r'data:(?:image|font|video)/[^;]+;base64,',s,re.I):errors.append('Embedded media: '+str(p.relative_to(root)))
class Links(HTMLParser):
 def __init__(self,p):super().__init__();self.p=p;self.base=p.as_uri()
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='base' and a.get('href'):self.base=urljoin(self.base,a['href']);return
  if tag in ['script','link','img','iframe']:
   u=a.get('src') or (a.get('href') if tag=='link' else None)
   if not u:return
   url=urlparse(urljoin(self.base,u))
   if url.scheme=='file' and not Path(unquote(url.path)).is_file():errors.append(str(self.p.relative_to(root))+': missing '+u)
for p in root.rglob('*.html'):
 h=Links(p);h.feed(p.read_text())
for i in range(1,173):
 for name in ['index.html','data.js']:
  if not (root/f'issues/{i}'/name).is_file():errors.append(f'Issue {i}: missing {name}')
report={'files':len(files),'bytes':sum(p.stat().st_size for p in files),'issues':len(list(root.glob('issues/*/index.html'))),'pages':len(list(root.glob('issues/*/pages/*.html'))),'errors':errors}
print(json.dumps(report,indent=2));sys.exit(bool(errors))
