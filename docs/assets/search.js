'use strict';
(function(){
 const input=document.getElementById('search'),module=document.getElementById('filter-module'),level=document.getElementById('filter-level');
 if(!input)return;
 const rows=Array.from(document.querySelectorAll('.question-row')),count=document.getElementById('result-count'),empty=document.getElementById('empty-result');
 const params=new URLSearchParams(location.search);input.value=params.get('q')||'';module.value=params.get('module')||'';
 function update(){const terms=input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);let n=0;rows.forEach(row=>{const ok=(!module.value||row.dataset.module===module.value)&&(!level.value||row.dataset.level===level.value)&&terms.every(t=>row.dataset.search.includes(t));row.hidden=!ok;if(ok)n++});count.textContent='找到 '+n+' 道题 · 共 '+rows.length+' 道';empty.hidden=n>0;}
 [input,module,level].forEach(el=>el.addEventListener('input',update));document.getElementById('search-form').addEventListener('submit',e=>{e.preventDefault();update()});update();
})();
