"""Render the curated knowledge tree using exact, live question-bank counts."""
import html
import json
from urllib.parse import urlencode


def render_knowledge_map(source, questions):
    data = json.loads(source.read_text(encoding='utf-8'))
    esc = lambda value: html.escape(str(value), quote=True)
    modules = {q['module'] for q in questions}
    listed = [item['module'] for item in data['modules']]
    if len(listed) != len(set(listed)) or set(listed) != modules:
        raise ValueError('Knowledge map must cover each question-bank module exactly once')

    def ids_for(module, tag=None):
        return {q['id'] for q in questions if q['module'] == module and (tag is None or tag in q['tags'])}

    def topic_link(module, tag=None):
        params = {'module': module}
        if tag is not None:
            params['tag'] = tag
        return 'questions.html?' + esc(urlencode(params))

    def leaf(module, item):
        tag = item['tag']
        ids = ids_for(module, tag)
        if not ids:
            raise ValueError(f'Knowledge-map tag missing from module: {module} / {tag}')
        return (f'<li class="km-leaf" data-search="{esc(item["label"] + " " + tag)}">'
                f'<a class="km-topic" href="{topic_link(module, tag)}">{esc(item["label"])}'
                f'<span aria-label="{len(ids)}道相关题">{len(ids)}题</span></a></li>')

    count = sum(len(group['tags']) for item in data['modules'] for group in item['groups'])
    parts = [f'''<section class="section knowledge-map" id="knowledge-map" aria-labelledby="knowledge-map-title">
<div class="section-head km-head"><div><span class="eyebrow">KNOWLEDGE MAP / 知识导图</span><h2 id="knowledge-map-title">把知识点连成一张图。</h2><p>{esc(data['description'])}</p></div><a href="topics.html">完整标签目录 →</a></div>
<div class="km-tools"><label class="km-search" for="knowledge-search">找一个知识点<input type="search" id="knowledge-search" placeholder="试试：UMVUE、次序统计量、两人赌博" autocomplete="off"></label><div class="km-actions"><button type="button" data-map-action="expand">全部展开</button><button type="button" data-map-action="collapse">全部收起</button><button type="button" data-map-action="reset">清空搜索</button></div></div>
<p id="knowledge-map-status" class="km-status" role="status">{len(listed)} 个模块 · {count} 个精选考点入口，点击分支展开。</p>
<div class="km-root"><span class="eyebrow">从模型到推断</span><h3>{esc(data['title'])}</h3><p>{len(questions)} 道题 · {len(listed)} 个模块 · 按知识关系复习</p></div><div class="km-branches">''']
    for index, item in enumerate(data['modules']):
        module = item['module']
        parts.append(f'<details class="km-branch" data-module="{esc(module)}" data-search="{esc(module)}"'+(' open' if index < 3 else '')+'>')
        parts.append(f'<summary><span class="km-number">{index+1:02d}</span><div class="km-branch-label"><h3>{esc(module)}</h3><span class="km-kicker">{esc(item["kicker"])}</span></div><span class="km-count">{len(ids_for(module))}题</span></summary>')
        parts.append(f'<p class="km-branch-intro">{esc(item["summary"])}</p><div class="km-groups">')
        for group in item['groups']:
            badge = '<span class="km-extension">拓展</span>' if group.get('extension') else ''
            title = group['title'].removesuffix(' · 拓展') if badge else group['title']
            parts.append(f'<section class="km-group" data-search="{esc(group["title"])}"><h4>{esc(title)}{badge}</h4><p>{esc(group["description"])}</p><ul class="km-leaves">')
            parts.extend(leaf(module, tag) for tag in group['tags'])
            parts.append('</ul></section>')
        parts.append(f'</div><a class="km-module-link" href="{topic_link(module)}">查看本模块全部 {len(ids_for(module))} 题 →</a></details>')
    parts.append('</div><p class="km-footnote">考点之间会交叉，同一道题可能出现在多个入口，题数不相加。未列出的细分标签可在“完整标签目录”继续查找；进入刷题仍按每日抽题或密钥解锁规则进行。</p>')
    parts.append('<div class="km-routes"><h3>沿着一条线，串起相邻知识点。</h3>')
    for route in data.get('routes', []):
        parts.append(f'<article class="km-route"><h4>{esc(route["title"])}</h4><p>{esc(route["description"])}</p><ol class="km-route-steps">')
        for step in route['steps']:
            if not ids_for(step['module'], step['tag']):
                raise ValueError('Knowledge-map route points to an empty topic')
            parts.append(f'<li><a href="{topic_link(step["module"],step["tag"])}">{esc(step["label"])}</a></li>')
        parts.append('</ol></article>')
    parts.append('</div></section>')
    return ''.join(parts)
