'use strict';
(function(){
 const input=document.getElementById('search'),module=document.getElementById('filter-module'),level=document.getElementById('filter-level');
 if(!input)return;
 const rows=Array.from(document.querySelectorAll('.question-row')),count=document.getElementById('result-count'),empty=document.getElementById('empty-result');
 const params=new URLSearchParams(location.search);input.value=params.get('q')||'';module.value=params.get('module')||'';level.value=params.get('level')||'';
 let activeTag=params.get('tag')||'';
 const topicFilter=document.getElementById('exact-topic-filter'),topicLabel=document.getElementById('exact-topic-label'),clearTopic=document.getElementById('clear-topic-filter');
 const tagsByRow=new Map(rows.map(row=>{let tags=[];try{const parsed=JSON.parse(row.dataset.tags||'[]');if(Array.isArray(parsed)&&parsed.every(tag=>typeof tag==='string'))tags=parsed}catch(_){}return [row,tags]}));
 function update(){const terms=input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);let n=0;rows.forEach(row=>{const ok=(!activeTag||tagsByRow.get(row).includes(activeTag))&&(!module.value||row.dataset.module===module.value)&&(!level.value||row.dataset.level===level.value)&&terms.every(t=>row.dataset.search.includes(t));row.hidden=!ok;if(ok)n++});count.textContent='找到 '+n+' 道题 · 共 '+rows.length+' 道';empty.hidden=n>0;if(topicFilter)topicFilter.hidden=!activeTag;if(topicLabel)topicLabel.textContent=activeTag?'专题：'+activeTag:'';}
 if(clearTopic)clearTopic.addEventListener('click',()=>{activeTag='';try{const url=new URL(location.href);url.searchParams.delete('tag');history.replaceState(history.state,'',url.href)}catch(_){}update()});
 [input,module,level].forEach(el=>el.addEventListener('input',update));document.getElementById('search-form').addEventListener('submit',e=>{e.preventDefault();update()});update();
})();
