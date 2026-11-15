from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin,urlparse,unquote
import json,re,sys,struct
root=Path(__file__).resolve().parent.parent
allowed={'.html','.css','.js','.json','.md','.txt','.py','.swift'}
icons={'assets/icons/reader-180.png':180,'assets/icons/reader-192.png':192,'assets/icons/reader-512.png':512}
app_manifest='assets/app.webmanifest'
errors=[];files=[p for p in root.rglob('*') if p.is_file() and '.git' not in p.relative_to(root).parts and '__pycache__' not in p.relative_to(root).parts]
for p in files:
 relative=str(p.relative_to(root))
 if relative in icons:
  content=p.read_bytes()
  if not content.startswith(b'\x89PNG\r\n\x1a\n') or len(content)<24 or struct.unpack('>II',content[16:24])!=(icons[relative],icons[relative]):errors.append('Invalid app icon: '+relative)
 elif relative!=app_manifest and p.name not in {'.nojekyll','.gitignore'} and p.suffix.lower() not in allowed:errors.append('Unexpected file type: '+relative)
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
manifest=json.loads((root/app_manifest).read_text())
for reference in [manifest['start_url'],*(icon['src'] for icon in manifest['icons'])]:
 target=((root/app_manifest).parent/reference).resolve()
 if not target.is_relative_to(root) or not target.is_file():errors.append('Invalid app manifest reference: '+reference)
for i in range(1,173):
 for name in ['index.html','data.js']:
  if not (root/f'issues/{i}'/name).is_file():errors.append(f'Issue {i}: missing {name}')
report={'files':len(files),'bytes':sum(p.stat().st_size for p in files),'issues':len(list(root.glob('issues/*/index.html'))),'pages':len(list(root.glob('issues/*/pages/*.html'))),'errors':errors}
print(json.dumps(report,indent=2));sys.exit(bool(errors))
