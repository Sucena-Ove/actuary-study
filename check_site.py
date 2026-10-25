"""Check static files and subpath-safe links without third-party packages."""
import json,re,sys
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse,unquote

ROOT=Path(__file__).resolve().parent
DIST=ROOT/'docs'
errors=[];files=0;images=0
class Inspect(HTMLParser):
    def __init__(self,path):
        super().__init__(convert_charrefs=True);self.path=path;self.lang=False;self.canonical=False;self.title=False;self.main=False
    def handle_starttag(self,tag,attrs):
        global images
        a=dict(attrs)
        if tag=='html':self.lang=a.get('lang')=='zh-CN'
        if tag=='title':self.title=True
        if tag=='main':self.main=True
        if tag=='link' and a.get('rel')=='canonical':self.canonical=True
        if tag=='img':
            images+=1
            if not a.get('alt'):errors.append(f'{self.path}: image missing alt')
        for key in ['href','src']:
            value=a.get(key,'');u=urlparse(value)
            if not value or value.startswith('#') or u.scheme or u.netloc:continue
            if value.startswith('/'):
                errors.append(f'{self.path}: root absolute path {value}');continue
            target=(self.path.parent/unquote(u.path)).resolve()
            if not target.is_relative_to(DIST.resolve()):errors.append(f'{self.path}: escaped dist {value}')
            elif not target.exists():errors.append(f'{self.path}: missing {value}')

for path in DIST.rglob('*.html'):
    files+=1;content=path.read_text(encoding='utf-8');p=Inspect(path);p.feed(content)
    for field in ['title']:
        if not getattr(p,field):errors.append(f'{path}: missing {field}')
    if path.name!='404.html':
        for field in ['lang','canonical','main']:
            if not getattr(p,field):errors.append(f'{path}: missing {field}')
    if re.search(r'[A-Za-z]:[/\\]Users[/\\]',content):errors.append(f'{path}: local user path exposed')
    if 'sync.js' in content:errors.append(f'{path}: sync.js loaded in static site')
bank=json.loads((DIST/'practice'/'bank.json').read_text(encoding='utf-8'))
math=json.loads((DIST/'practice'/'math-map.json').read_text(encoding='utf-8'))
missing_math=[]
for q in bank['questions']:
    if not (DIST/'questions'/f'{q["id"]:03d}.html').exists():errors.append(f'Question {q["id"]}: no detail page')
    else:
        entry=(DIST/'questions'/f'{q["id"]:03d}.html').read_text(encoding='utf-8')
        if 'id="practice-entry"' not in entry or 'noindex,follow' not in entry:errors.append(f'Question {q["id"]}: missing guarded practice entry')
        if any(marker in entry for marker in ['class="stem"','class="choices"','class="answer"','class="steps"']):errors.append(f'Question {q["id"]}: static answer bypass')
    for text in [q['stem'],*q['options'],*q['steps'],q['pitfall']]:
        for formula in re.findall(r'\$([^$]+)\$',text):
            if formula not in math:missing_math.append({'id':q['id'],'formula':formula})
            elif not (DIST/'practice'/math[formula]['src']).exists():errors.append(f'Question {q["id"]}: missing SVG')
if missing_math:errors.append(f'{len(missing_math)} formula occurrences missing SVG mapping')
for file in DIST.rglob('*'):
    if file.is_file() and file.suffix.lower() in ['.pdf','.apk','.sqlite','.db','.jks','.keystore','.pem','.p12']:errors.append(f'Unexpected private/binary asset: {file}')
app=(DIST/'practice'/'app.js').read_text(encoding='utf-8')
for misleading in ['登录后可同步到其他设备','连接服务器并登录后','旧版备份先导入游客区']:
    if misleading in app:errors.append('Static app misleading claim: '+misleading)
report={'htmlFiles':files,'questions':len(bank['questions']),'formulaImages':images,'missingFormulaMappings':missing_math,'errors':errors}
(ROOT/'qa-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='missingFormulaMappings'},ensure_ascii=False,indent=2))
sys.exit(bool(errors))
