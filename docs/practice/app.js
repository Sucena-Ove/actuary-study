'use strict';
var BANK,MATH,byId,sourceMap,progress,screen='home',topicSearch='',toastTimer;
var app=document.getElementById('app'),nav=document.getElementById('nav');
var STORAGE='actuary-mobile-400-v1';
var DAILY_STORAGE='actuary-study-daily-goal-v1',dailyMemory=null;
var vaultState={ids:new Set(),questions:null,sources:null,modules:null,title:'',loading:false,generation:0};
function progressIdOK(id){return Number.isInteger(id)&&(byId.has(id)||(id>=10001&&id<=9999999))}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function fmt(v){return String(v).split(/(\$[^$]+\$)/g).map(function(x){if(x.charAt(0)!=='$')return esc(x);var t=x.slice(1,-1),m=MATH[t];return m?'<img class="math" alt="'+esc(t)+'" src="'+esc(m.src)+'" style="width:'+m.width/12+'em">':esc(t)}).join('')}
function blank(){return {bankId:BANK.id,app:'actuary-mobile',version:1,session:null,stats:{},stars:[],wrong:[],records:[],preferences:{source:'',module:'',tag:'',difficulty:'',scope:'',amount:'20',order:'random'}}}
function idsOK(a){return Array.isArray(a)&&a.length<=100000&&new Set(a).size===a.length&&a.every(progressIdOK)}
function validate(input){
 var d=JSON.parse(JSON.stringify(input));
 if(!d||!['prob-stat-complete-v3','prob-stat-expanded-250-v2'].includes(d.bankId))throw Error('题库版本不匹配');
 if(d.app!=='actuary-mobile'){
  var old=d,n=blank();n.stars=old.stars;n.wrong=old.wrong;n.stats=old.history||{};n.records=[];
  if(old.state){var s=old.state;n.session={ids:s.ids,index:s.current,answers:s.answers,checked:s.status==='submitted'?s.ids:s.revealed,notes:s.notes,at:s.startedAt,done:s.status==='submitted',title:'已导入的练习'};}d=n;
 }
 if(!idsOK(d.stars)||!idsOK(d.wrong))throw Error('题目记录有误');
 if(!d.stats||typeof d.stats!=='object'||Array.isArray(d.stats))throw Error('学习记录有误');
 Object.keys(d.stats).forEach(function(id){var h=d.stats[id];if(!progressIdOK(+id)||!h||!Number.isInteger(h.attempts)||h.attempts<1||!Number.isInteger(h.correct)||h.correct<0||h.correct>h.attempts||typeof h.lastCorrect!=='boolean'||!Number.isFinite(h.at))throw Error('学习记录有误');d.stats[id]={attempts:h.attempts,correct:h.correct,lastCorrect:h.lastCorrect,at:h.at}});
 if(d.session){var s=d.session;
  if(!idsOK(s.ids)||!s.ids.length||!Number.isInteger(s.index)||s.index<0||s.index>=s.ids.length||!idsOK(s.checked)||!s.checked.every(function(id){return s.ids.includes(id)})||typeof s.done!=='boolean'||!Number.isFinite(s.at))throw Error('练习记录有误');
  if(!s.answers||!s.notes||typeof s.answers!=='object'||Array.isArray(s.answers)||typeof s.notes!=='object'||Array.isArray(s.notes))throw Error('作答记录有误');
  Object.keys(s.answers).forEach(function(id){var a=s.answers[id];if(!s.ids.includes(+id)||!Number.isInteger(a)||a < -1||a>3)throw Error('答案记录有误')});
  Object.keys(s.notes).forEach(function(id){if(!s.ids.includes(+id)||typeof s.notes[id]!=='string'||s.notes[id].length>10000)throw Error('草稿记录有误')});
  s.title=String(s.title||'逐题练习').slice(0,100);
  d.session={ids:s.ids,index:s.index,answers:s.answers,checked:s.checked,notes:s.notes,at:s.at,done:s.done,title:s.title};
 }
 d.bankId=BANK.id;d.app='actuary-mobile';d.version=1;
 d.preferences=Object.assign(blank().preferences,d.preferences||{});
 var preferences={};['source','module','tag','difficulty','scope','amount','order'].forEach(function(k){preferences[k]=typeof d.preferences[k]==='string'?d.preferences[k]:''});d.preferences=preferences;
 d.records=Array.isArray(d.records)?d.records.filter(function(r){return r&&Number.isInteger(r.total)&&r.total>0&&r.total<=100000&&Number.isInteger(r.correct)&&r.correct>=0&&r.correct<=r.total&&Number.isFinite(r.at)}).slice(-20).map(function(r){return {total:r.total,correct:r.correct,at:r.at}}):[];
 return {bankId:d.bankId,app:d.app,version:d.version,session:d.session||null,stats:d.stats,stars:d.stars,wrong:d.wrong,records:d.records,preferences:d.preferences};
}
function toast(msg){document.getElementById('toast').textContent=msg;clearTimeout(toastTimer);toastTimer=setTimeout(function(){document.getElementById('toast').textContent=''},2600)}
function persist(){try{var json=JSON.stringify(progress);if(window.LocalApp){if(!LocalApp.saveProgress(json))throw Error('save')}else localStorage.setItem(STORAGE,json)}catch(e){toast('记录暂未保存，请到“我的”导出备份。')}}
function readProgress(){var raw=window.LocalApp?LocalApp.loadProgress():localStorage.getItem(STORAGE);return raw?validate(JSON.parse(raw)):blank()}
function dayKey(at){return new Date((at==null?Date.now():at)+8*60*60*1000).toISOString().slice(0,10)}
function todayGoal(){
 var date=dayKey(),data=dailyMemory;
 try{var raw=localStorage.getItem(DAILY_STORAGE);if(raw)data=JSON.parse(raw)}catch(e){}
 if(!data||data.date!==date)data={date:date,target:null,submitted:[]};
 if(!Number.isInteger(data.target)||data.target<1||data.target>120)data.target=null;
 data.submitted=Array.isArray(data.submitted)?Array.from(new Set(data.submitted.filter(progressIdOK))):[];
 dailyMemory=data;return data;
}
function saveGoal(data){dailyMemory=data;try{localStorage.setItem(DAILY_STORAGE,JSON.stringify(data))}catch(e){toast('当前浏览器暂不能保存今日目标，关闭页面后可能重置。')}}
function rollDailyGoal(){
 var data=todayGoal();if(data.target!==null){toast('今天已经开局，继续完成你的目标。');return}
 var value=new Uint32Array(1);do{crypto.getRandomValues(value)}while(value[0]>=4294967280);
 data.target=value[0]%120+1;saveGoal(data);render();toast('今天的目标是 '+data.target+' 道题。慢慢想，认真做。');
}
function markDailyAttempt(id){var data=todayGoal();if(!data.submitted.includes(id)){data.submitted.push(id);saveGoal(data)}}
function dailyGoalCard(){
 var data=todayGoal(),done=data.submitted.length,target=data.target,complete=target!==null&&done>=target;
 return '<section class="panel daily-goal" aria-labelledby="daily-goal-title"><div class="daily-top"><div class="goal-die" aria-hidden="true"><b>'+(target===null?'?':target)+'</b><small>D120</small></div><div><span class="goal-eyebrow">DAILY PRACTICE</span><h2 id="daily-goal-title">'+(target===null?'今天，掷一个小目标':complete?'今日目标已完成':'今天的目标：'+target+' 道')+'</h2><p class="description" aria-live="polite">今天已作答 '+done+' 道不同的题目。'+(target===null?'从 1–120 中，掷出你的练习目标。':complete?'继续练习或休息一会儿，都很好。':'还差 '+Math.max(0,target-done)+' 道，一步一步来。')+'</p></div></div>'+(target!==null?'<div class="progress goal-progress" role="progressbar" aria-label="今日练习目标" aria-valuemin="0" aria-valuemax="'+target+'" aria-valuenow="'+Math.min(done,target)+'"><i style="width:'+Math.min(100,done/target*100)+'%"></i></div>':'')+'<div class="goal-actions">'+(target===null?'<button class="primary" data-action="daily-roll">掷出今日目标</button>':'<button class="primary" data-action="daily-start">'+(complete?'再练一组':'按目标开始练习')+'</button>')+(!window.LocalApp?'<a class="button-link" href="../games/index.html">休息一局 ↗</a>':'')+'</div><p class="tip goal-tip">按北京时间每日更新，只保存在当前浏览器。目标不限制原题库使用；换浏览器或清除网站数据会重置。</p></section>';
}
function lockedRecordCount(){return Object.keys(progress.stats).filter(function(id){return !byId.has(+id)}).length}
function vaultCard(){
 if(window.LocalApp)return '';
 var unlocked=vaultState.ids.size>0,count=lockedRecordCount();
 return '<section class="panel vault-card" id="vault-panel"><div class="row"><h2>专题进阶题</h2><span class="offline">'+(unlocked?'本次已解锁':'密钥开启')+'</span></div>'+(unlocked?'<p class="description">'+esc(vaultState.title)+' · '+vaultState.ids.size+' 道题已加入本次练习，可按知识点筛选。</p><div class="goal-actions"><button class="primary" data-action="vault-practice">练习专题进阶题</button><button data-action="vault-lock">锁定题库</button></div>':'<p class="description">原有 516 道题继续免费练习。已有作者提供的密钥，可在这里打开额外的专题题库。</p><form id="vault-form" autocomplete="off"><label class="label" for="vault-code">题库密钥</label><div class="vault-input-row"><input id="vault-code" name="code" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" required maxlength="100" placeholder="粘贴作者提供的密钥"><button class="primary" type="submit" '+(vaultState.loading?'disabled':'')+'>'+(vaultState.loading?'正在打开…':'解锁题库')+'</button></div><p id="vault-error" class="vault-error" role="alert"></p></form>')+(count?'<p class="tip">已保留 '+count+' 道进阶题的学习记录；解锁后可继续查看错题和复习。</p>':'')+'<p class="tip">密钥不保存在浏览器；刷新、关闭或锁定页面后需重新输入。请妥善保存自己的密钥。</p><a class="vault-contact" href="https://space.bilibili.com/247892366" target="_blank" rel="noopener noreferrer">联系作者，了解专题题库 ↗</a></section>';
}
function lockedSession(){app.innerHTML='<section class="panel empty"><h2>先打开本组的专题题库</h2><p>这组练习包含尚未解锁的题目。作答、错题和收藏记录仍然保留。</p><button class="primary" data-action="show-vault">输入题库密钥</button><button data-action="home">返回练习首页</button></section>'}
function validateVault(payload){
 if(!payload||typeof payload.id!=='string'||typeof payload.title!=='string'||!Array.isArray(payload.questions)||!payload.questions.length||payload.questions.length>2000||!Array.isArray(payload.sources))throw Error('专题题库格式不正确，请联系作者。');
 var ids=new Set(),sourceIds=new Set();
 payload.sources.forEach(function(s){if(!s||typeof s.id!=='string'||!s.id||sourceIds.has(s.id)||sourceMap.has(s.id)||typeof s.title!=='string')throw Error('专题来源信息有误。');sourceIds.add(s.id)});
 payload.questions.forEach(function(q){
  if(!q||!Number.isInteger(q.id)||q.id<10001||q.id>9999999||ids.has(q.id)||byId.has(q.id)||!sourceIds.has(q.sourceId))throw Error('专题题号或来源有误。');ids.add(q.id);
  ['stem','topic','module','objective','pitfall','sourceRef','adaptation','difficulty'].forEach(function(k){if(typeof q[k]!=='string'||q[k].length>30000)throw Error('专题题目内容有误。')});
  if(!Array.isArray(q.options)||q.options.length!==4||!q.options.every(function(x){return typeof x==='string'&&x.length<=10000})||!Number.isInteger(q.answer)||q.answer<0||q.answer>3||!Array.isArray(q.steps)||!q.steps.length||q.steps.length>50||!q.steps.every(function(x){return typeof x==='string'&&x.length<=30000})||!Array.isArray(q.tags)||!q.tags.every(function(x){return typeof x==='string'&&x.length<=200}))throw Error('专题答案或解析格式有误。');
 });return payload;
}
function attachVault(payload){
 var data=validateVault(payload);vaultState.questions=BANK.questions;vaultState.sources=BANK.sources;vaultState.modules=BANK.modules;
 vaultState.ids=new Set(data.questions.map(function(q){return q.id}));vaultState.title=data.title.slice(0,100);
 BANK.questions=BANK.questions.concat(data.questions);BANK.sources=BANK.sources.concat(data.sources);BANK.modules=Array.from(new Set(BANK.modules.concat(data.questions.map(function(q){return q.module}))));
 byId=new Map(BANK.questions.map(function(q){return [q.id,q]}));sourceMap=new Map(BANK.sources.map(function(s){return [s.id,s]}));
}
function lockVault(renderNow){
 vaultState.generation++;vaultState.loading=false;
 if(vaultState.questions){BANK.questions=vaultState.questions;BANK.sources=vaultState.sources;BANK.modules=vaultState.modules;byId=new Map(BANK.questions.map(function(q){return [q.id,q]}));sourceMap=new Map(BANK.sources.map(function(s){return [s.id,s]}));}
 vaultState.ids=new Set();vaultState.questions=null;vaultState.sources=null;vaultState.modules=null;vaultState.title='';
 normalizeVaultFilters();
 if(window.StudyVault&&typeof StudyVault.lock==='function')StudyVault.lock();
 if(renderNow){setScreen('home');toast('专题题库已锁定，学习记录保留。');}
}
function normalizeVaultFilters(){
 if(!progress||!BANK)return;var f=progress.preferences;
 if(f.scope==='vault'&&!vaultState.ids.size)f.scope='';
 if(f.source&&f.source!=='nau'&&!sourceMap.has(f.source))f.source='';
 if(f.module&&!BANK.modules.includes(f.module))f.module='';
 if(f.tag&&!BANK.questions.some(function(q){return q.tags.includes(f.tag)}))f.tag='';
}
function sourceName(q){return sourceMap.get(q.sourceId).title}
function summary(qs){var practiced=qs.filter(function(q){return progress.stats[q.id]}),correct=practiced.filter(function(q){return progress.stats[q.id].lastCorrect});return {done:practiced.length,correct:correct.length,rate:practiced.length?Math.round(correct.length/practiced.length*100):null}}
function options(values,current){return values.map(function(v){return '<option value="'+esc(v[0])+'" '+(v[0]===current?'selected':'')+'>'+esc(v[1])+'</option>'}).join('')}
function setScreen(next){screen=next;render();window.scrollTo(0,0)}
function filtered(){var f=progress.preferences;return BANK.questions.filter(function(q){return (!f.source||(f.source==='nau'?q.sourceId.indexOf('nau')===0:q.sourceId===f.source))&&(!f.module||q.module===f.module)&&(!f.tag||q.tags.includes(f.tag))&&(!f.difficulty||q.difficulty===f.difficulty)&&(!f.scope||(f.scope==='vault'?vaultState.ids.has(q.id):q.scope===f.scope))})}
function filterFields(){var f=progress.preferences,tags=Array.from(new Set(BANK.questions.reduce(function(a,q){return a.concat(q.tags)},[]))).sort(function(a,b){return a.localeCompare(b,'zh-CN')});return '<div class="fields"><div class="wide"><label class="label" for="source">资料来源</label><select id="source" data-filter="source">'+options([['','全部来源'],['nau','南审813 · 全部年份']].concat(BANK.sources.map(function(s){return [s.id,s.title]})),f.source)+'</select></div><div><label class="label" for="module">模块</label><select id="module" data-filter="module">'+options([['','全部模块']].concat(BANK.modules.map(function(m){return [m,m]})),f.module)+'</select></div><div><label class="label" for="difficulty">难度</label><select id="difficulty" data-filter="difficulty">'+options([['','全部难度'],['基础','基础'],['中等','中等'],['提高','提高']],f.difficulty)+'</select></div><div class="wide"><label class="label" for="tag">细分知识点</label><select id="tag" data-filter="tag">'+options([['','全部知识点']].concat(tags.map(function(t){return [t,t]})),f.tag)+'</select></div><div class="wide"><label class="label" for="scope">练习范围</label><select id="scope" data-filter="scope">'+options([['','全部内容'],['core','主科目练习'],['extension','拓展提高']].concat(vaultState.ids.size?[['vault','专题进阶题 · 已解锁']]:[]),f.scope)+'</select></div><div><label class="label" for="amount">题数</label><select id="amount" data-filter="amount">'+options([['10','10题'],['20','20题'],['50','50题'],['all','全部']],f.amount)+'</select></div><div><label class="label" for="order">选题方式</label><select id="order" data-filter="order">'+options([['random','随机选题'],['weak','错题 / 新题优先'],['ordered','按题号顺序']],f.order)+'</select></div></div>'}
function home(){var st=summary(BANK.questions),s=progress.session,f=progress.preferences;app.innerHTML='<section class="hero"><div class="eyebrow">ONE QUESTION AT A TIME</div><h1>先想清楚，<br>再看答案。</h1><p>'+BANK.questions.length+' 题随身带。每一次思考，<br>都可以成为下一次答对的理由。</p><button class="white" data-action="quick">随机练 20 题 →</button></section><div class="stats"><div class="stat"><b>'+st.done+'</b><span>已练题目</span></div><div class="stat"><b>'+(st.rate===null?'—':st.rate+'%')+'</b><span>最近答对率</span></div><div class="stat"><b>'+progress.wrong.length+'</b><span>错题待复习</span></div></div>'+(s?'<div class="resume row"><div><b>'+(s.done?'最近一组已完成':'继续上一次思考')+'</b><div class="tiny muted">已核对 '+s.checked.length+' / '+s.ids.length+' 题</div></div><button data-action="resume">'+(s.done?'查看小结':'继续练习')+'</button></div>':'')+'<div class="section-title"><h2>题库修订版 · 专题练习</h2><button class="linklike" data-action="topics">查看全部 →</button></div><div class="pills">'+['进阶挑战','新增100题','考后回忆重建','卷积','零截断泊松','Ross拓展','Fisher信息'].map(function(t){return '<button class="pill" data-action="tag" data-tag="'+t+'">'+t+'</button>'}).join('')+'</div><section class="panel" id="filter-panel"><div class="row"><h3>选一组适合你的题</h3><button class="linklike" data-action="reset-filter">重置</button></div>'+filterFields()+'<p class="tip" id="match-count">当前可选 '+filtered().length+' 题</p><button class="primary widebtn" data-action="start-filter">开始逐题练习</button><p class="tip" style="margin:12px 0 0">先选择 A / B / C / D，再确认。确认前不显示答案；确认后立即展开题解。</p></section><p class="tip">本次新增 16 题零截断泊松进阶挑战：可逆统计量、条件分布、UMVUE、Fisher 信息与极大似然。原 500 题完整保留。本公开学习站的进度保存在当前浏览器，可在“我的”中导出备份。</p>';app.querySelector('.hero').insertAdjacentHTML('afterend',dailyGoalCard());app.querySelector('.stats').insertAdjacentHTML('afterend',vaultCard())}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}
function start(ids,title,order,amount){
 ids=ids.filter(function(id){return byId.has(id)});
 if(!ids.length){toast('当前没有可练的题目');return}
 if(progress.session&&!progress.session.done&&progress.session.checked.length<progress.session.ids.length&&!confirm('开始新的一组练习？当前这组会被替换，已核对的学习记录、错题和收藏会保留。'))return;
 ids=order==='ordered'?ids.slice():shuffle(ids);
 if(order==='weak')ids.sort(function(a,b){var ra=progress.wrong.includes(a)?0:progress.stats[a]?2:1,rb=progress.wrong.includes(b)?0:progress.stats[b]?2:1;return ra-rb});
 if(amount!=='all')ids=ids.slice(0,+amount||20);
 progress.session={ids:ids,index:0,answers:{},checked:[],notes:{},at:Date.now(),done:false,title:title};persist();setScreen('session');
}
function isChecked(id){return progress.session.checked.includes(id)}
function session(){var s=progress.session;if(!s){setScreen('home');return}if(s.ids.some(function(id){return !byId.has(id)})){lockedSession();return}var id=s.ids[s.index],q=byId.get(id),checked=isChecked(id),a=s.answers[id],correct=a===q.answer;
 app.innerHTML='<div class="session-head"><button data-action="home">← 保存并返回</button><span class="tiny muted">第 '+(s.index+1)+' / '+s.ids.length+' 题</span><button data-action="star" data-id="'+id+'" class="'+(progress.stars.includes(id)?'starred':'')+'">'+(progress.stars.includes(id)?'★ 已收藏':'☆ 收藏')+'</button></div><div class="progress"><i style="width:'+(s.checked.length/s.ids.length*100)+'%"></i></div><div class="question"><div class="meta"><strong>#'+String(id).padStart(3,'0')+'</strong><span>'+esc(q.module)+'</span><span>'+esc(q.difficulty)+'</span><span>'+esc(q.topic)+'</span><span>'+(q.scope==='extension'?'拓展提高':'主科目练习')+'</span></div><div class="stem">'+fmt(q.stem)+'</div><div class="choices" role="radiogroup" aria-label="选择答案">'+q.options.map(function(t,i){return '<button role="radio" aria-checked="'+(a===i)+'" class="choice '+(a===i?'selected ':'')+(checked&&i===q.answer?'correct ':'')+(checked&&a===i&&!correct?'incorrect':'')+'" data-action="choose" data-value="'+i+'" '+(checked?'disabled':'')+'><span class="letter">'+'ABCD'[i]+'</span><span>'+fmt(t)+'</span></button>'}).join('')+'</div>'+(checked?'<div class="feedback '+(correct?'':'bad')+'" role="status"><b>'+(correct?'答对了 ✓':a===-1||a===undefined?'先学会，再练一次':'这次答错了')+'</b><p>正确答案：'+'ABCD'[q.answer]+(a>=0?'　你的选择：'+'ABCD'[a]:'　已加入错题本')+'</p></div>'+explanation(q):'<p class="hint">想好后选择答案，再点击下方“确认答案”。</p>')+'<details><summary>写一点思路 / 草稿</summary><textarea class="notes" id="note" maxlength="2000" placeholder="记下你的推导或容易混淆的地方">'+esc(s.notes[id]||'')+'</textarea><span class="note-save">自动保存到本机</span></details><div class="tools"><button data-action="previous" '+(s.index===0?'disabled':'')+'>上一题</button>'+(!checked?'<button data-action="later">稍后再想</button>':'')+'</div></div><div class="sticky-actions">'+(checked?'<button class="primary" data-action="next">'+(s.index===s.ids.length-1?'查看本组小结':'下一题 →')+'</button>':'<button class="skip" data-action="dont-know">不会做，看题解</button><button class="primary" data-action="check" '+(!Number.isInteger(a)||a<0?'disabled':'')+'>确认答案</button>')+'</div>';
}
function explanation(q){return '<section class="explanation"><h2>一步一步看懂</h2><div class="goal"><b>本题要掌握</b><br>'+esc(q.objective)+'</div>'+q.steps.map(function(s,i){return '<div class="step"><i>'+(i+1)+'</i><div>'+fmt(s)+'</div></div>'}).join('')+'<div class="pitfall"><b>易错提醒</b><br>'+fmt(q.pitfall)+'</div>'+(q.correction?'<div class="pitfall"><b>原资料校订</b><br>'+fmt(q.correction)+'</div>':'')+'<div class="pills">'+q.tags.map(function(t){return '<span class="pill">'+esc(t)+'</span>'}).join('')+'</div><p class="source">'+esc(sourceName(q))+' · '+esc(q.sourceRef)+'<br>'+esc(q.adaptation)+(sourceMap.get(q.sourceId).url?'<br><span class="source-url">参考链接（可复制）：'+esc(sourceMap.get(q.sourceId).url)+'</span>':'')+'</p></section>'}
function check(skip){var s=progress.session,id=s.ids[s.index];if(isChecked(id))return;if(skip)s.answers[id]=-1;if(!Number.isInteger(s.answers[id]))return;
 var ok=s.answers[id]===byId.get(id).answer,h=progress.stats[id]||{attempts:0,correct:0};progress.stats[id]={attempts:h.attempts+1,correct:h.correct+(ok?1:0),lastCorrect:ok,at:Date.now()};
 s.checked.push(id);if(ok)progress.wrong=progress.wrong.filter(function(x){return x!==id});else if(!progress.wrong.includes(id))progress.wrong.push(id);
 if(!skip)markDailyAttempt(id);if(window.recordAttempt)recordAttempt(id,s.answers[id]);persist();render();setTimeout(function(){var el=document.querySelector('.feedback');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})},20);
}
function finish(){var s=progress.session;if(!s.done&&s.checked.length===s.ids.length){s.done=true;var correct=s.ids.filter(function(id){return s.answers[id]===byId.get(id).answer}).length;progress.records.push({total:s.ids.length,correct:correct,at:Date.now()});progress.records=progress.records.slice(-20);persist()}setScreen('report')}
function report(){var s=progress.session;if(!s){setScreen('home');return}if(s.ids.some(function(id){return !byId.has(id)})){lockedSession();return}var correct=s.checked.filter(function(id){return s.answers[id]===byId.get(id).answer}).length,remaining=s.ids.filter(function(id){return !s.checked.includes(id)}),bad=s.checked.filter(function(id){return s.answers[id]!==byId.get(id).answer});
 app.innerHTML='<div class="section-title"><h1>每一题，都有收获。</h1></div><section class="panel"><p class="tiny muted">'+esc(s.title)+' · '+s.ids.length+' 题</p><div class="score">'+correct+'<small> / '+s.checked.length+' 已核对答对</small></div><p class="muted">待巩固 '+bad.length+' 题 · 尚未核对 '+remaining.length+' 题</p><div class="stack">'+(remaining.length?'<button class="primary" data-action="continue-unchecked">继续未核对题目</button>':'')+'<button class="'+(remaining.length?'soft':'primary')+'" data-action="retry" '+(!bad.length?'disabled':'')+'>重练本组错题</button><button data-action="review">从第一题回顾</button><button data-action="home">返回练习首页</button></div></section><section class="panel"><h3>本组知识模块</h3>'+Array.from(new Set(s.ids.map(function(id){return byId.get(id).module}))).map(function(m){var ids=s.ids.filter(function(id){return byId.get(id).module===m}),done=ids.filter(function(id){return s.checked.includes(id)}),ok=done.filter(function(id){return s.answers[id]===byId.get(id).answer});return '<div class="barline"><span>'+esc(m)+'　'+ok.length+' / '+done.length+' 已核对答对</span><div class="progress"><i style="width:'+(done.length?ok.length/done.length*100:0)+'%"></i></div></div>'}).join('')+'</section><p class="tip">未核对的题目不会计入正确率。重新做对一道错题后，它会从错题本移除。</p>';
}
function topics(){var term=topicSearch.trim().toLowerCase();app.innerHTML='<div class="section-title"><div><h1>按薄弱点，逐个突破。</h1><p class="muted tiny">点击模块或知识点，即可筛选练习。</p></div></div><input type="search" id="topic-search" placeholder="搜索考点，如 Fisher、区间估计" value="'+esc(topicSearch)+'"><div class="topic-filter"><button class="linklike" data-action="search-topic">搜索</button><button class="linklike" data-action="clear-topic">清空</button></div>'+BANK.modules.map(function(m){var qs=BANK.questions.filter(function(q){return q.module===m}),tags=Array.from(new Set(qs.reduce(function(a,q){return a.concat(q.tags)},[]))).filter(function(t){return !term||t.toLowerCase().includes(term)||m.includes(term)}),st=summary(qs);if(!tags.length)return '';return '<section class="panel"><div class="row"><h2>'+esc(m)+'</h2><button class="linklike" data-action="module" data-module="'+esc(m)+'">'+qs.length+'题 →</button></div><p class="tiny muted">已练 '+st.done+' / '+qs.length+'　最近答对率 '+(st.rate===null?'暂无':st.rate+'%')+'</p><div class="progress"><i style="width:'+st.done/qs.length*100+'%"></i></div><div class="knowledge">'+tags.map(function(t){var group=qs.filter(function(q){return q.tags.includes(t)}),a=summary(group);return '<button data-action="tag" data-tag="'+esc(t)+'" data-module="'+esc(m)+'"><b>'+esc(t)+'</b><small>'+group.length+'题 · 已练 '+a.done+'</small></button>'}).join('')+'</div></section>'}).join('')}
function library(which){var stored=which==='wrong'?progress.wrong:progress.stars,ids=stored.filter(function(id){return byId.has(id)}),locked=stored.length-ids.length,qs=ids.map(function(id){return byId.get(id)});app.innerHTML='<div class="section-title"><h1>'+(which==='wrong'?'把错题，变成会的题。':'我的收藏')+'</h1></div><p class="muted tiny">'+(locked?'当前可查看 '+ids.length+' 题，另有 '+locked+' 题待解锁':'共 '+ids.length+' 题')+(which==='wrong'?' · 最近一次答对后自动移出':' · 收藏与错题互不影响')+'</p>'+(qs.length?'<button class="primary widebtn" data-action="practice-library" data-kind="'+which+'">开始复练这 '+ids.length+' 题</button><section class="panel">'+qs.map(function(q){return '<article class="listitem"><div class="meta"><strong>#'+q.id+'</strong><span>'+esc(q.topic)+'</span><span>'+(q.scope==='extension'?'拓展提高':'主科目练习')+'</span></div><div class="stem">'+fmt(q.stem)+'</div><button data-action="single" data-id="'+q.id+'">练这一题</button></article>'}).join('')+'</section>':'<div class="panel empty">'+(locked?'进阶题记录已保留，请先解锁后复习。':which==='wrong'?'目前没有待复习的错题。<br>开始练习，看看自己掌握了多少。':'练习时点击“☆ 收藏”，<br>就能把重要的题留在这里。')+'</div><button class="primary widebtn" data-action="home">去练习</button>');if(locked)app.insertAdjacentHTML('beforeend','<section class="panel"><p class="description">还有 '+locked+' 道进阶题记录已保留，解锁后可以复习。</p><button class="primary" data-action="show-vault">输入题库密钥</button></section>')}
function mine(){var st=summary(BANK.questions);app.innerHTML='<div class="section-title"><h1>记录你的每一步。</h1></div><section class="panel"><div class="row"><h2>本地学习记录</h2><span class="offline">不需要账号</span></div><p class="description">已练 '+st.done+' 题，最近答对 '+st.correct+' 题。题目与公式来自本站，学习记录保存在当前浏览器本机。</p><div class="stack"><button data-action="stars">我的收藏 · '+progress.stars.length+' 题</button><button data-action="export">导出学习进度</button><button data-action="import">导入学习进度</button></div><p class="tip">本网站不提供账号服务。清理浏览器数据或更换设备前，请导出学习进度；可在其他设备手动导入。</p></section><section class="panel"><h3>最近完成</h3>'+(progress.records.length?progress.records.slice().reverse().map(function(r){return '<p class="tiny">'+new Date(r.at).toLocaleDateString()+'　'+r.total+'题 · 答对 '+r.correct+'题</p>'}).join(''):'<p class="tip">完成一组练习后，会在这里留下记录。</p>')+'</section><details class="panel"><summary>关于题库与资料来源</summary><p class="description">题库修订版 · '+BANK.questions.length+' 题<br>先思考，确认答案后再显示对错与解析。</p><p class="tip">原 500 题完整保留；501–516 题补充零截断泊松进阶挑战。401–500 题覆盖 19 类考后回忆，并结合 Ross《Introduction to Probability Models》和 SOA 公开概率资料原创编写。Ross 章节按出版社第10版公开目录定位；随机过程题单独标注为拓展。每题附解析、考点与出处，不标作官方原题。</p><p class="tip">分类对应中国精算师协会2023年公开考纲；Fisher信息、C-R下界等列为深化学习内容。数学三与茆诗松教材体系部分为原创专题，不标作教材原题。题目不是官方模拟卷。</p><p class="tip">题目与公式从本站读取。学习记录只保存在当前浏览器，不会自动跨设备同步。</p></details>';app.insertAdjacentHTML('beforeend',vaultCard()+(!window.LocalApp?'<section class="panel"><h3>学习间隙，休息一局</h3><a class="button-link" href="../games/index.html">进入小游戏 ↗</a></section>':''))}
function render(){var sessionView=screen==='session';nav.classList.toggle('hidden',sessionView);Array.from(nav.children).forEach(function(b){b.classList.toggle('active',b.dataset.action===screen||(screen==='stars'&&b.dataset.action==='mine')||(screen==='report'&&b.dataset.action==='home'))});if(screen==='home')home();else if(screen==='topics')topics();else if(screen==='session')session();else if(screen==='report')report();else if(screen==='wrong'||screen==='stars')library(screen);else mine()}
function choose(id){var s=progress.session,qid=s.ids[s.index];if(isChecked(qid))return;s.answers[qid]=id;persist();render()}
function exportProgress(){var text=JSON.stringify(progress,null,2);if(window.LocalApp)LocalApp.exportProgress(text);else{var a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.href=url;a.download='精算随身练_学习进度.json';a.click();setTimeout(function(){URL.revokeObjectURL(url)},1000)}}
function receiveImport(text){try{var d=validate(JSON.parse(text));if(!confirm('导入将替换当前作答、错题、收藏和草稿。确认导入这份进度？'))return;progress=d;normalizeVaultFilters();persist();setScreen('home');toast(lockedRecordCount()?'进度已导入；进阶题记录已保留，解锁后可继续复习。':'进度已导入')}catch(e){toast('无法导入，请选择本题库导出的进度文件。')}}
function importProgress(){if(window.LocalApp){LocalApp.importProgress();return}var el=document.createElement('input');el.type='file';el.accept='.json,application/json';el.onchange=function(){var f=el.files[0];if(!f)return;if(f.size>4000000){toast('文件过大，请选择有效进度文件。');return}var reader=new FileReader();reader.onload=function(){receiveImport(reader.result)};reader.readAsText(f)};el.click()}
document.addEventListener('click',function(e){var el=e.target.closest('[data-action]');if(!el||el.disabled||!BANK)return;var a=el.dataset.action,id=+el.dataset.id,s=progress.session;
 if(['home','topics','wrong','mine','stars'].includes(a)){setScreen(a);return}
 if(a==='daily-roll'){try{rollDailyGoal()}catch(error){toast('暂时无法掷骰子，请稍后再试。')}return}
 if(a==='daily-start'){var goal=todayGoal(),remaining=(goal.target||20)-goal.submitted.length,ids=BANK.questions.map(function(q){return q.id});if(remaining>0)ids=ids.filter(function(id){return !goal.submitted.includes(id)});start(ids,'今日目标练习','random',String(remaining>0?remaining:20));return}
 if(a==='show-vault'){setScreen('home');var panel=document.getElementById('vault-panel');if(panel){panel.scrollIntoView({block:'start'});var input=document.getElementById('vault-code');if(input)input.focus()}return}
 if(a==='vault-practice'){if(!vaultState.ids.size){toast('请先输入密钥打开专题题库。');return}progress.preferences=blank().preferences;progress.preferences.scope='vault';persist();setScreen('home');document.getElementById('filter-panel').scrollIntoView({block:'start'});return}
 if(a==='vault-lock'){lockVault(true);return}
 if(a==='quick')start(BANK.questions.map(function(q){return q.id}),'随机练习','random','20');
 else if(a==='start-filter')start(filtered().map(function(q){return q.id}),'专题练习',progress.preferences.order,progress.preferences.amount);
 else if(a==='tag'||a==='module'){var f=blank().preferences;f.tag=el.dataset.tag||'';f.module=el.dataset.module||'';progress.preferences=f;persist();setScreen('home');document.getElementById('filter-panel').scrollIntoView({block:'start'})}
 else if(a==='reset-filter'){progress.preferences=blank().preferences;persist();home();document.getElementById('filter-panel').scrollIntoView()}
 else if(a==='resume')setScreen(s.done?'report':'session');
 else if(a==='choose')choose(+el.dataset.value);
 else if(a==='check')check(false);
 else if(a==='dont-know')check(true);
 else if(a==='star'){if(progress.stars.includes(id))progress.stars=progress.stars.filter(function(x){return x!==id});else progress.stars.push(id);persist();render()}
 else if(a==='previous'){s.index=Math.max(0,s.index-1);persist();setScreen('session')}
 else if(a==='next'||a==='later'){if(s.index<s.ids.length-1){s.index++;persist();setScreen('session')}else finish()}
 else if(a==='continue-unchecked'){s.index=s.ids.findIndex(function(id){return !s.checked.includes(id)});persist();setScreen('session')}
 else if(a==='review'){s.index=0;persist();setScreen('session')}
 else if(a==='retry'){var bad=s.checked.filter(function(id){return s.answers[id]!==byId.get(id).answer});start(bad,'本组错题复练','ordered','all')}
 else if(a==='practice-library')start(progress[el.dataset.kind].slice(),'错题 / 收藏复练','random','all');
 else if(a==='single')start([id],'单题练习','ordered','all');
 else if(a==='search-topic'){topicSearch=document.getElementById('topic-search').value;render()}
 else if(a==='clear-topic'){topicSearch='';render()}
 else if(a==='export')exportProgress();
 else if(a==='import')importProgress();
});
document.addEventListener('change',function(e){var k=e.target.dataset.filter;if(k){progress.preferences[k]=e.target.value;persist();document.getElementById('match-count').textContent='当前可选 '+filtered().length+' 题'}});
document.addEventListener('input',function(e){if(e.target.id==='note'){progress.session.notes[progress.session.ids[progress.session.index]]=e.target.value;persist()}});
document.addEventListener('keydown',function(e){if(e.target.id==='topic-search'&&e.key==='Enter'){topicSearch=e.target.value;render()}});
function appBack(){if(screen==='home')return false;setScreen(screen==='stars'?'mine':'home');return true}
window.addEventListener('pagehide',function(){if(progress)persist();if(BANK){lockVault(false);app.innerHTML='';screen='home'}});window.addEventListener('pageshow',function(e){if(e.persisted&&BANK&&progress)render()});document.addEventListener('visibilitychange',function(){if(document.hidden&&progress)persist()});
Promise.all([fetch('bank.json').then(function(r){if(!r.ok)throw Error('bank');return r.json()}),fetch('math-map.json').then(function(r){if(!r.ok)throw Error('math');return r.json()})]).then(function(data){BANK=data[0];MATH=data[1];byId=new Map(BANK.questions.map(function(q){return [q.id,q]}));sourceMap=new Map(BANK.sources.map(function(s){return [s.id,s]}));try{progress=readProgress()}catch(e){progress=blank();toast('旧记录未能读取，可到“我的”导入备份。')}normalizeVaultFilters();render();var qp=new URLSearchParams(location.search),qid=Number(qp.get('question'));if(qp.has('question')&&byId.has(qid)){start([qid],'单题练习','ordered','all')}else if(qp.get('tag')){progress.preferences=blank().preferences;progress.preferences.tag=qp.get('tag');persist();home();document.getElementById('filter-panel').scrollIntoView()}}).catch(function(){app.innerHTML='<div class="panel empty"><h2>题库暂时没有打开</h2><p>请检查网络并刷新网页；若刚完成网站更新，请稍后重试。</p></div>'});

// Unlocking only extends the in-memory bank; no key or question payload enters progress storage.
document.addEventListener('submit',async function(event){
 var form=event.target;if(!form||form.id!=='vault-form')return;event.preventDefault();
 if(vaultState.loading)return;var input=form.querySelector('[name="code"]'),code=input.value.trim(),button=form.querySelector('button[type="submit"]'),errorNode=document.getElementById('vault-error');
 input.value='';if(errorNode)errorNode.textContent='';
 if(!code){if(errorNode)errorNode.textContent='请先输入作者提供的题库密钥。';input.focus();return}
 vaultState.loading=true;button.disabled=true;button.textContent='正在打开…';var generation=vaultState.generation;
 try{
  if(!window.StudyVault||typeof StudyVault.unlock!=='function')throw Error('专题题库暂时无法打开，请刷新网页后再试。');
  var payload=await StudyVault.unlock(code);code='';if(generation!==vaultState.generation)return;
  attachVault(payload);payload=null;vaultState.loading=false;setScreen('home');document.getElementById('vault-panel').scrollIntoView({block:'start'});toast('专题题库已打开。刷新后需要重新输入密钥。');
 }catch(error){
  var message=error&&typeof error.message==='string'?error.message:'暂时无法打开专题题库，请稍后重试。';
  // Never echo any entered credential in an error message.
  if(code&&message.includes(code))message='密钥未通过验证，请检查后重新输入。';
  code='';var current=document.getElementById('vault-error');if(current)current.textContent=message;else toast(message);
 }finally{code='';vaultState.loading=false;button.disabled=false;button.textContent='解锁题库';input.value='';}
});
