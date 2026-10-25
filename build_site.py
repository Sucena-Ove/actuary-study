"""Build the public static study site; Python standard library only."""
from __future__ import annotations
import argparse, collections, datetime, hashlib, html, json, re, shutil
from pathlib import Path
from urllib.parse import quote, urlparse

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--bank', type=Path, default=HERE / 'source-data' / 'bank.json')
parser.add_argument('--assets', type=Path, help='Folder containing math-map.json, math/, app.js and style.css')
parser.add_argument('--site-url', default='https://sucena-ove.github.io/actuary-study/')
parser.add_argument('--output', type=Path, default=HERE / 'docs')
args = parser.parse_args()
site_url = args.site_url.rstrip('/') + '/'
if urlparse(site_url).scheme not in ('https', 'http'):
    parser.error('--site-url must be an absolute HTTP(S) URL')
bank_path = args.bank.resolve()
assets_dir = (args.assets or (bank_path.parent if (bank_path.parent/'app.js').exists() else HERE/'source-data')).resolve()
bank = json.loads(bank_path.read_text(encoding='utf-8'))
questions = bank['questions']
sources = {s['id']: s for s in bank['sources']}
math_map = json.loads((assets_dir/'math-map.json').read_text(encoding='utf-8'))
out = args.output.resolve()
out.mkdir(parents=True, exist_ok=True)
# Keep the public, explicit inputs so this repository can rebuild independently.
source_dir = HERE/'source-data'
source_dir.mkdir(exist_ok=True)
for src, dst in [(bank_path,source_dir/'bank.json'),(assets_dir/'math-map.json',source_dir/'math-map.json'),(assets_dir/'app.js',source_dir/'app.js'),(assets_dir/'style.css',source_dir/'style.css')]:
    if src.resolve() != dst.resolve(): shutil.copy2(src,dst)
if (assets_dir/'math').resolve() != (source_dir/'math').resolve():
    shutil.copytree(assets_dir/'math',source_dir/'math',dirs_exist_ok=True)

def esc(value): return html.escape(str(value), quote=True)
def write(path, value):
    file=out/path;file.parent.mkdir(parents=True,exist_ok=True);file.write_text(value,encoding='utf-8')
def plain(value): return re.sub(r'\$([^$]+)\$', lambda m:m.group(1), str(value))
def fmt(value, prefix=''):
    pieces=[]
    for piece in re.split(r'(\$[^$]+\$)',str(value)):
        if piece.startswith('$') and piece.endswith('$'):
            formula=piece[1:-1];item=math_map.get(formula)
            if item: pieces.append(f'<img class="math" src="{prefix}practice/{esc(item["src"])}" alt="{esc(formula)}" style="width:{item["width"]/12:g}em" loading="lazy">')
            else: pieces.append(f'<span class="math-fallback">{esc(formula)}</span>')
        else: pieces.append(esc(piece))
    return ''.join(pieces)

pages=[]
def page(path,title,description,body,prefix='',kind='website',script=''):
    canonical=site_url+path
    if path=='index.html':canonical=site_url
    pages.append(canonical)
    content=f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)} · 精算随身练</title><meta name="description" content="{esc(description)}"><meta name="theme-color" content="#205d49"><meta name="robots" content="index,follow">
<link rel="canonical" href="{esc(canonical)}"><meta property="og:type" content="{kind}"><meta property="og:locale" content="zh_CN"><meta property="og:site_name" content="精算随身练"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{esc(canonical)}">
<link rel="icon" href="{prefix}assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="{prefix}assets/site.css"></head><body>
<a class="sr-only" href="#main">跳至正文</a><header class="top"><div class="wrap top-inner"><a class="brand" href="{prefix}index.html"><span class="symbol" aria-hidden="true">Σ</span><span>精算随身练<small>PROBABILITY · THINK IT THROUGH</small></span></a><nav class="site-nav" aria-label="主导航"><a href="{prefix}topics.html">知识点</a><a href="{prefix}questions.html">题目目录</a><a href="{prefix}notes/zero-truncated-poisson.html">学习笔记</a><a class="nav-practice" href="{prefix}practice/index.html">开始练习 →</a></nav></div></header>
<main id="main" class="wrap">{body}</main><footer class="footer"><div class="wrap"><p>精算随身练 · 题库修订版<br>先思考，再看答案。每题都有一个值得弄懂的地方。</p><div><a href="{prefix}about.html">关于与来源</a><a href="{prefix}questions.html">全部题目</a><a href="{prefix}about.html#contact">联系作者</a><a href="https://space.bilibili.com/247892366" rel="noopener noreferrer">B站 · UID 247892366 ↗</a></div></div></footer>{script}</body></html>'''
    write(path,content)

modules=[m for m in bank['modules'] if any(q['module']==m for q in questions)]
for m in dict.fromkeys(q['module'] for q in questions):
    if m not in modules:modules.append(m)
module_ids={m:'module-'+str(i+1) for i,m in enumerate(modules)}
def module_link(m,prefix=''):return prefix+'topics.html#'+module_ids[m]
def breadcrumb(label,prefix=''):return f'<div class="breadcrumb"><a href="{prefix}index.html">首页</a> / {esc(label)}</div>'
def module_cards():
    rows=[]
    for m in modules:
        qs=[q for q in questions if q['module']==m]
        tags=collections.Counter(t for q in qs for t in q['tags'] if not any(x in t for x in ['新增','回忆','Ross','SOA','专题','教材']))
        rows.append(f'<a class="module-card" href="{module_link(m)}"><span>{len(qs)} 题 ↗</span><h3>{esc(m)}</h3><p>{esc(" · ".join(t for t,_ in tags.most_common(4)))}</p></a>')
    return ''.join(rows)
advanced=[q for q in questions if q['id']>=501]
advanced_text=f'新增 {len(advanced)} 道进阶题' if advanced else '从条件分布到 UMVUE'
home=f'''<section class="hero"><div><span class="eyebrow">一本随时翻开的概率学习笔记</span><h1>把一道题想明白，<br>比记住答案更重要。</h1><p>从概率分布到统计推断，把零散考点连起来。按知识点找题，先独立思考，再用分步解析检查每一步。</p><div class="actions"><a class="button primary" href="practice/index.html">开始今天的练习 →</a><a class="button" href="questions.html">翻一翻题目目录</a></div></div><aside class="notebook"><div class="label">本周的思考题 / 无偏估计</div><h2>已知总和 T = N，<br>怎样估计单点概率？</h2><div class="formula">T = X₁ + ⋯ + Xₙ = N<br>δₖ(N) = P(X₁ = k | T = N)</div><p class="note">从指示变量的无偏性出发，<br>推导关于 N 的一般 UMVUE。</p><a href="notes/zero-truncated-poisson.html">读这篇学习笔记 →</a></aside></section>
<div class="statline"><div><b>{len(questions)}</b><span>道题，逐题配解析</span></div><div><b>{len(modules)}</b><span>个知识模块</span></div><div><b>0</b><span>账号门槛，打开就练</span></div></div>
<section class="section"><div class="section-head"><h2>从一个薄弱点开始。</h2><a href="topics.html">完整知识点目录 →</a></div><div class="module-grid">{module_cards()}</div></section>
<section class="section"><div class="section-head"><h2>把公式背后的问题讲清楚。</h2><span class="note">{advanced_text}</span></div><article class="article-feature"><div class="label">Study note<br>01 / 统计推断</div><div><h3><a href="notes/zero-truncated-poisson.html">零截断泊松：总和、条件分布与 UMVUE</a></h3><p>给定 T = N，怎样估计 pλ(k)/(1 − e⁻λ)？先写一般条件分布，再沿无偏性、完备充分性推到 UMVUE；同时给出 n = 2 的简化式。</p></div><a class="arrow" href="notes/zero-truncated-poisson.html" aria-label="阅读零截断泊松学习笔记">↗</a></article></section>
<section class="section"><div class="section-head"><h2>怎样使用这本题库？</h2></div><div class="module-grid"><div class="module-card"><h3>01 / 先定位考点</h3><p>搜索题干、题号或知识点。每题都有独立页面，可以收藏、分享和打印。</p></div><div class="module-card"><h3>02 / 给思考留一点时间</h3><p>进入刷题区，选好答案后再确认。做错的题留在本机错题本，下一次接着练。</p></div><div class="module-card"><h3>03 / 回到模型与条件</h3><p>对照步骤检查假设、支持集和参数化。最后看易错提醒与来源说明，避免只记结论。</p></div></div></section>'''
home+='<section class="section contact-card"><div><span class="eyebrow">Contact / 联系作者</span><h2>一起把题目弄明白。</h2><p>有题目反馈、解题疑问或学习交流，欢迎到 B 站主页私信。反馈时带上题号和你的思路，方便一起核对。</p><span class="note">B站 UID 247892366</span></div><a class="button" href="https://space.bilibili.com/247892366" rel="noopener noreferrer">前往 B 站主页 ↗</a></section>'
page('index.html','概率论与数理统计学习题库',f'{len(questions)}道概率论与数理统计练习，含知识点分类、分步解析、来源说明与零截断泊松进阶笔记。免费在线刷题，无需注册。',home)

topic_body=f'<div class="page-head">{breadcrumb("知识点目录")}<span class="eyebrow">Knowledge map</span><h1>先找到你想弄懂的那一块。</h1><p>知识点标签连接相关题目；同一道题可以跨越多个考点。带“拓展提高”的题目用于深化理解，不表示属于当前考试必考范围。</p></div>'
for m in modules:
    qs=[q for q in questions if q['module']==m];tags=collections.Counter(t for q in qs for t in q['tags'])
    topic_body+=f'<section class="topic-group" id="{module_ids[m]}"><div class="section-head"><h2>{esc(m)}</h2><a href="questions.html?module={quote(m)}">查看 {len(qs)} 道题 →</a></div><div class="tag-grid">'+''.join(f'<a href="questions.html?module={quote(m)}&amp;q={quote(t)}">{esc(t)}<small>{c}</small></a>' for t,c in tags.most_common())+'</div></section>'
page('topics.html','知识点目录','按概率、分布、随机向量、抽样分布、估计、检验与回归分类的题库知识点索引。',topic_body)

rows=[]
for q in questions:
    search=' '.join([str(q['id']),q['module'],q['topic'],q['stem'],*q['tags']]).lower()
    rows.append(f'<li class="question-row" data-search="{esc(search)}" data-module="{esc(q["module"])}" data-level="{esc(q["difficulty"])}"><div class="meta"><strong>#{q["id"]:03d}</strong><span>{esc(q["module"])}</span><span>{esc(q["difficulty"])}</span><span>{"拓展提高" if q.get("scope")=="extension" else "主科目练习"}</span></div><h2><a href="questions/{q["id"]:03d}.html">{esc(q["topic"])}</a></h2><p>{fmt(q["stem"][:220]+("…" if len(q["stem"])>220 else ""))}</p></li>')
catalog=f'<div class="page-head">{breadcrumb("题目目录")}<span class="eyebrow">Question library</span><h1>带着问题，找到题目。</h1><p>搜索“零截断泊松”“Fisher”“卷积”，或者直接输入题号。题干与解析均有独立网页，方便反复查阅。</p></div><form id="search-form" class="searchbox" role="search"><label>搜索题号、考点与题干<input id="search" type="search" placeholder="试试：零截断泊松、次序统计量、501" autocomplete="off"></label><label>知识模块<select id="filter-module"><option value="">全部模块</option>'+''.join(f'<option>{esc(m)}</option>' for m in modules)+'</select></label><label>难度<select id="filter-level"><option value="">全部难度</option><option>基础</option><option>中等</option><option>提高</option></select></label></form>'+f'<p class="result-count" id="result-count">共 {len(questions)} 道题</p><noscript><p class="note">当前显示全部题目。启用 JavaScript 后可以搜索和筛选；阅读题干与题解不需要 JavaScript。</p></noscript><ol class="question-list">'+''.join(rows)+'</ol><p id="empty-result" class="empty-result" hidden>暂时没有匹配的题目。试试更短的关键词，或将模块和难度恢复为“全部”。</p>'
page('questions.html','题目目录与搜索',f'搜索{len(questions)}道概率论与数理统计题目，按知识模块和难度筛选，查看分步解析与出处。',catalog,script='<script src="assets/search.js" defer></script>')

for index,q in enumerate(questions):
    source=sources[q['sourceId']]
    source_url=source.get('url','')
    source_info=esc(source['title'])+' · '+esc(q.get('sourceRef',''))+'<br>'+esc(q.get('adaptation',''))
    if source_url and urlparse(source_url).scheme in ('https','http'):source_info+=f'<br><a href="{esc(source_url)}" rel="noopener noreferrer">查看参考来源</a>'
    tags=''.join(f'<a class="badge" href="../questions.html?q={quote(t)}">{esc(t)}</a>' for t in q['tags'])
    choices=''.join(f'<li><b>{"ABCD"[i]}</b><span>{fmt(t,"../")}</span></li>' for i,t in enumerate(q['options']))
    steps=''.join(f'<li>{fmt(s,"../")}</li>' for s in q['steps'])
    previous=f'<a href="{questions[index-1]["id"]:03d}.html">← 上一题</a>' if index else '<span></span>'
    following=f'<a href="{questions[index+1]["id"]:03d}.html">下一题 →</a>' if index+1<len(questions) else '<span></span>'
    body=f'<div class="page-head">{breadcrumb("题目目录","../")}<div class="meta"><strong>#{q["id"]:03d}</strong><a href="../questions.html?module={quote(q["module"])}">{esc(q["module"])}</a><span>{esc(q["difficulty"])}</span></div><h1>{esc(q["topic"])}</h1></div><div class="question-layout"><article class="question-body"><div class="stem">{fmt(q["stem"],"../")}</div><ol class="choices">{choices}</ol><details><summary>我已思考，展开答案与解析</summary><div class="answer">正确答案：<strong>{"ABCD"[q["answer"]]}</strong></div><ol class="steps">{steps}</ol><div class="pitfall"><b>易错提醒</b>{fmt(q["pitfall"],"../")}</div>'+(f'<p class="note">资料校订：{fmt(q["correction"],"../")}</p>' if q.get('correction') else '')+f'</details><p class="source">{source_info}</p></article><aside class="question-aside"><h2>这题要弄懂什么？</h2><p>{esc(q.get("objective",q["topic"]))}</p><div class="tags">{tags}</div><a class="button primary" href="../practice/index.html?question={q["id"]}">在刷题区作答 →</a><p>刷题区会在确认后显示对错，并将错题与进度保存在当前浏览器。可导出备份。</p></aside></div><nav class="prevnext" aria-label="相邻题目">{previous}<a href="../questions.html">返回题目目录</a>{following}</nav>'
    page(f'questions/{q["id"]:03d}.html',f'第{q["id"]}题：{q["topic"]}',plain(q['stem'])[:160],body,prefix='../',kind='article')

article=(HERE/'content'/'zero-truncated-poisson.html').read_text(encoding='utf-8-sig')
practice_order={qid:i for i,qid in enumerate([505,510,508,509,506,503,504,507,511,512,501,502,513,514,515,516])}
advanced_links=''.join(f'<li><a href="../questions/{q["id"]:03d}.html">#{q["id"]} · {esc(q["topic"])}</a></li>' for q in sorted((q for q in questions if q['id']>=501),key=lambda q:practice_order.get(q['id'],q['id'])))
if not advanced_links:advanced_links=''.join(f'<li><a href="../questions/{q["id"]:03d}.html">#{q["id"]} · {esc(q["topic"])}</a></li>' for q in questions if '零截断泊松' in q['tags'])
article=article.replace('{{QUESTION_LINKS}}',advanced_links)
page('notes/zero-truncated-poisson.html','零截断泊松：给定T=N的条件分布与UMVUE','给定零截断泊松样本和T=N，推导固定k的单点概率UMVUE，含一般n及n=2的公式、支持范围、Stirling数与完备充分性证明。',f'<div class="page-head">{breadcrumb("学习笔记","../")}<span class="eyebrow">Study note / 统计推断</span><h1>已知 T = N，怎样求一般条件分布与 UMVUE？</h1><p>以 pλ(k)/(1 − e⁻λ) 为待估函数，保留 N 为字母，写出条件分布、无偏估计与最小方差依据。</p></div><article class="article-body">{article}</article>',prefix='../',kind='article')

source_rows=''.join('<li><strong>'+esc(s['title'])+'</strong>：'+esc(s.get('description',s.get('kind','')))+(f' <a href="{esc(s["url"])}" rel="noopener noreferrer">参考链接</a>' if s.get('url') and urlparse(s['url']).scheme in ('https','http') else '')+'</li>' for s in bank['sources'])
about=f'<div class="page-head">{breadcrumb("关于与来源")}<h1>关于这本学习题库</h1><p>把考试复盘、教材知识点和日常练习整理成一处可以查阅的地方。</p></div><article class="article-body"><h2>题库说明</h2><p>当前收录 {len(questions)} 题，包含题干、四个选项、答案、分步解析、易错提醒与知识点标签。考试回忆题的缺失条件与数值由编者补全，不能视为官方原题。原创同型题不代表教材原书或 SOA 原题。</p><p>{esc(bank["conventions"])}</p><h2>公开学习与本机进度</h2><p>题目目录、题目正文和学习笔记是公开静态网页。网页不需要注册，也不提供账号后台。刷题进度、错题和收藏保存在当前浏览器本机；网站不会自动上传学习记录。浏览器清理数据、更换设备或使用无痕窗口时，记录可能丢失，请在刷题区“我的”中导出备份。</p><p>手机 App 与此网站不会自动互通账号。兼容的本地学习进度可以通过导出、导入手动转移；账号同步需要另行部署服务。</p><h2>资料与出处</h2><ul>{source_rows}</ul><h2>阅读与纠错</h2><p>来源说明用于辨别题目出处和改写范围。请以题干明确写出的条件为准，注意参数化、独立性与支持集。发现疑问时，可记录题号与推导进行复核。</p><p class="note">本网站与中国精算师协会、SOA、相关院校或出版社无隶属关系。主科目与拓展标签用于学习安排，不构成官方考试范围承诺。</p></article>'
contact='<section id="contact"><h2>联系作者与题目反馈</h2><p>这是一个边学习、边整理的概率统计学习站。如果发现题目条件有歧义、答案有疑问，或想交流一种更直观的解法，欢迎带上题号和推导到 B 站主页私信。</p><p><strong>B站 UID：247892366</strong></p><p><a class="button primary" href="https://space.bilibili.com/247892366" rel="noopener noreferrer">前往作者 B 站主页 ↗</a></p></section>'
about=about.replace('</article>',contact+'</article>')
page('about.html','关于、联系方式与资料来源','精算随身练题库来源说明、B站联系方式、本机学习记录与静态网站使用方式。',about)

shutil.copytree(HERE/'assets',out/'assets',dirs_exist_ok=True)
practice=out/'practice';practice.mkdir(exist_ok=True)
shutil.copytree(source_dir/'math',practice/'math',dirs_exist_ok=True)
for name in ['bank.json','math-map.json','style.css']:shutil.copy2(source_dir/name,practice/name)
js=(source_dir/'app.js').read_text(encoding='utf-8')
# Static hosting has no account API. Keep the proven local-practice flow only.
replacements={
'支持离线练习，登录后可同步到其他设备。':'本公开学习站的进度保存在当前浏览器，可在“我的”中导出备份。',
'题目与公式随应用内置，学习记录保存在这台手机。':'题目与公式来自本站，学习记录保存在当前浏览器本机。',
'互联版备份保留同步编号。旧版备份先导入游客区，再合并到账号。卸载应用或清除数据前，请先同步或导出。':'本网站不提供账号服务。清理浏览器数据或更换设备前，请导出学习进度；可在其他设备手动导入。',
'题目与公式可离线使用；连接服务器并登录后才同步学习记录。':'题目与公式从本站读取。学习记录只保存在当前浏览器，不会自动跨设备同步。',
'请关闭并重新打开应用。如果仍无法读取，可重新安装同一版本，保留应用数据。':'请检查网络并刷新网页；若刚完成网站更新，请稍后重试。',
}
for old,new in replacements.items():js=js.replace(old,new)
hook="render();if(window.initializeCloud)initializeCloud()"
replacement="render();var qp=new URLSearchParams(location.search),qid=Number(qp.get('question'));if(qp.has('question')&&byId.has(qid)){start([qid],'单题练习','ordered','all')}else if(qp.get('tag')){progress.preferences=blank().preferences;progress.preferences.tag=qp.get('tag');persist();home();document.getElementById('filter-panel').scrollIntoView()}"
if hook not in js:raise RuntimeError('App startup hook changed; review static practice integration')
js=js.replace(hook,replacement)
write('practice/app.js',js)
write('practice/index.html',f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#205d49"><meta name="description" content="精算随身练在线刷题：{len(questions)}道概率统计题，确认答案后显示分步解析，错题和进度保存在本机。"><meta name="robots" content="index,follow"><link rel="canonical" href="{esc(site_url)}practice/index.html"><title>在线刷题 · 精算随身练</title><link rel="icon" href="../assets/favicon.svg"><link rel="stylesheet" href="style.css"></head><body><header><a href="../index.html" class="brand" style="text-decoration:none;color:inherit"><span class="logo">Σ</span><div>精算随身练<small>← 返回学习站</small></div></a><span class="offline">本机保存 · 无需账号</span></header><main id="app"><div class="loading"><span class="logo">Σ</span><h2>准备好，练一题。</h2><p>正在读取题库…</p><noscript>刷题区需要 JavaScript；也可前往<a href="../questions.html">静态题目目录</a>阅读题解。</noscript></div></main><nav id="nav"><button data-action="home">练习</button><button data-action="topics">专题</button><button data-action="wrong">错题</button><button data-action="mine">我的</button></nav><div id="toast" role="status"></div><script src="app.js"></script></body></html>''')
practice_html=(practice/'index.html').read_text(encoding='utf-8')
practice_footer='<footer style="max-width:760px;margin:auto;padding:0 20px 100px;font-size:12px;color:#68766c"><a href="../about.html#contact">联系作者 / 题目反馈</a> · <a href="https://space.bilibili.com/247892366" rel="noopener noreferrer">B站 UID 247892366 ↗</a></footer>'
write('practice/index.html',practice_html.replace('</main><nav','</main>'+practice_footer+'<nav'))
pages.append(site_url+'practice/index.html')
write('.nojekyll','')
lastmod=bank.get('revisionDate',bank.get('date',datetime.date.today().isoformat()))
write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join(f'<url><loc>{esc(url)}</loc><lastmod>{esc(lastmod)}</lastmod></url>' for url in pages)+'</urlset>')
write('robots.txt','User-agent: *\nAllow: /\nSitemap: '+site_url+'sitemap.xml\n')
write('404.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>没有找到这页 · 精算随身练</title><body style="font:18px/2 system-ui;padding:10vw;background:#f7f5ee;color:#205d49"><h1>这页暂时没有找到。</h1><p>可以回到学习站，继续找题。</p><a href="'+esc(site_url)+'">返回精算随身练 →</a></body></html>')
manifest={'questions':len(questions),'modules':len(modules),'pages':len(pages),'siteUrl':site_url,'bankRevision':bank.get('revisionDate',bank.get('date')),'bankSHA256':hashlib.sha256(bank_path.read_bytes()).hexdigest(),'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
write('build-info.json',json.dumps(manifest,ensure_ascii=False,indent=2))
print(json.dumps(manifest,ensure_ascii=False,indent=2))
