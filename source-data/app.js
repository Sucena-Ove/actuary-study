'use strict';
var BANK,MATH,byId,sourceMap,progress,screen='home',topicSearch='',toastTimer;
var app=document.getElementById('app'),nav=document.getElementById('nav');
var STORAGE='actuary-mobile-400-v1';
var DAILY_STORAGE='actuary-study-daily-goal-v1',dailyMemory=null;
var ACCESS_STORAGE='actuary-study-access-key-v1';
var accessState={unlocked:false,loading:false,saved:false,error:'',generation:0};
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
  d.session={ids:s.ids,index:s.index,answers:s.answers,checked:s.checked,notes:s.notes,at:s.at,done:s.done,title:s.title,dailyDate:typeof s.dailyDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s.dailyDate)?s.dailyDate:null};
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
function randomBelow(max){var limit=Math.floor(4294967296/max)*max,value=new Uint32Array(1);do{crypto.getRandomValues(value)}while(value[0]>=limit);return value[0]%max}
function randomIds(ids,count){var copy=ids.slice();for(var i=0;i<count;i++){var j=i+randomBelow(copy.length-i),temp=copy[i];copy[i]=copy[j];copy[j]=temp}return copy.slice(0,count)}
function saveGoal(data){dailyMemory=data;try{localStorage.setItem(DAILY_STORAGE,JSON.stringify(data))}catch(e){toast('当前浏览器不能保存今日抽题，关闭页面后记录可能丢失。')}}
function todayGoal(){
 var date=dayKey(),data=dailyMemory;
 try{var raw=localStorage.getItem(DAILY_STORAGE);if(raw)data=JSON.parse(raw)}catch(e){}
 if(!data||data.date!==date)data={version:2,date:date,target:null,ids:[],submitted:[],answers:{}};
 var target=Number.isInteger(data.target)&&data.target>=1&&data.target<=120?Math.min(data.target,BANK.questions.length):null;
 if(target!==null&&data.version!==2){
  // Keep a pre-update roll; already seen questions fill its fixed pool first.
  var previous=Array.isArray(data.submitted)?Array.from(new Set(data.submitted.filter(function(id){return byId.has(id)}))).slice(0,target):[];
  var remaining=BANK.questions.map(function(q){return q.id}).filter(function(id){return !previous.includes(id)});
  data={version:2,date:date,target:target,ids:previous.concat(randomIds(remaining,target-previous.length)),submitted:previous,answers:{}};saveGoal(data);
 }
 if(target===null){data={version:2,date:date,target:null,ids:[],submitted:[],answers:{}}}
 else if(!Array.isArray(data.ids)||data.ids.length!==target||new Set(data.ids).size!==target||!data.ids.every(function(id){return byId.has(id)})){
  // A damaged local draw cannot introduce additional questions that day.
  data={version:2,date:date,target:target,ids:[],submitted:[],answers:{},damaged:true};
 }else{
  data={version:2,date:date,target:target,ids:data.ids.slice(),submitted:Array.isArray(data.submitted)?Array.from(new Set(data.submitted.filter(function(id){return data.ids.includes(id)}))):[],answers:data.answers&&typeof data.answers==='object'&&!Array.isArray(data.answers)?data.answers:{}};
  var clean={};data.submitted.forEach(function(id){var answer=data.answers[id];if(Number.isInteger(answer)&&answer>=-1&&answer<=3)clean[id]=answer});data.answers=clean;
 }
 dailyMemory=data;return data;
}
function hasFullAccess(){return !!window.LocalApp||accessState.unlocked}
function canPracticeId(id){return byId.has(id)&&(hasFullAccess()||todayGoal().ids.includes(id))}
function allowedQuestions(){return hasFullAccess()?BANK.questions:todayGoal().ids.map(function(id){return byId.get(id)}).filter(Boolean)}
function sessionAllowed(s){return !!s&&s.ids.length>0&&s.ids.every(function(id){return byId.has(id)})&&(hasFullAccess()||(s.dailyDate===dayKey()&&s.ids.every(canPracticeId)))}
function accessNotice(){
 var data=todayGoal();app.innerHTML='<section class="panel empty"><h2>'+(data.target===null?'先掷出今天的题数':'今天只练随机抽到的题')+'</h2><p>'+(data.target===null?'每天掷一次 1–120 面骰子，系统按点数随机抽题。':'当前题目不在今天的抽题范围内。历史错题、收藏和草稿仍然保留。')+'</p><button class="primary" data-action="home">返回今日练习</button><button data-action="show-vault">解锁自由练习</button></section>';
}
function guardSession(){if(sessionAllowed(progress.session))return true;accessNotice();return false}
function rollDailyGoal(){
 if(window.navigator&&navigator.locks&&typeof navigator.locks.request==='function')return navigator.locks.request('actuary-study-daily-draw',commitDailyRoll);
 return commitDailyRoll();
}
function commitDailyRoll(){
 var data=todayGoal();if(data.target!==null){toast('今天已经掷过骰子，抽到的题目不会改变。');return}
 data.target=Math.min(randomBelow(120)+1,BANK.questions.length);data.ids=randomIds(BANK.questions.map(function(q){return q.id}),data.target);data.version=2;saveGoal(data);render();toast('今日抽到 '+data.target+' 道题，可以开始了。');
}
function markDailyAttempt(id,answer){var data=todayGoal();if(!data.ids.includes(id))return;if(!data.submitted.includes(id))data.submitted.push(id);data.answers[id]=answer;saveGoal(data)}
function startDaily(){
 var data=todayGoal();if(data.target===null){toast('请先掷出今天的题数。');return}if(data.damaged||!data.ids.length){toast('今日抽题记录异常，请明天重新抽题，或输入密钥自由练习。');return}
 var old=progress.session,notes={},answers=Object.assign({},data.answers),checked=data.submitted.slice();
 if(old&&old.dailyDate===data.date){data.ids.forEach(function(id){if(old.notes&&typeof old.notes[id]==='string')notes[id]=old.notes[id].slice(0,10000);if(!checked.includes(id)&&old.answers&&Number.isInteger(old.answers[id])&&old.answers[id]>=0&&old.answers[id]<=3)answers[id]=old.answers[id]})}
 // Migrated goal-only records retain their completed count without invented answers.
 checked=checked.filter(function(id){return Number.isInteger(answers[id])});
 var index=data.ids.findIndex(function(id){return !checked.includes(id)});if(index<0)index=0;
 progress.session={ids:data.ids.slice(),index:index,answers:answers,checked:checked,notes:notes,at:Date.now(),done:checked.length===data.ids.length,title:'今日随机抽题',dailyDate:data.date};persist();setScreen('session');
}
function dailyGoalCard(){
 var data=todayGoal(),done=data.submitted.length,target=data.target,complete=target!==null&&done>=target;
 return '<section class="panel daily-goal" aria-labelledby="daily-goal-title"><div class="daily-top"><div class="goal-die" aria-hidden="true"><b>'+(target===null?'?':target)+'</b><small>D120</small></div><div><span class="goal-eyebrow">DAILY DRAW</span><h2 id="daily-goal-title">'+(target===null?'今天，随机抽一组题':'今日可练 '+target+' 题')+'</h2><p class="description" aria-live="polite">'+(target===null?'掷一次骰子，按点数从全部题目中随机抽取。':'已完成 '+done+' 题 · 剩余 '+Math.max(0,target-done)+' 题。'+(complete?'今天已完成，可以回顾这组题。':'今天的题目已固定。'))+'</p></div></div>'+(target!==null?'<div class="progress goal-progress" role="progressbar" aria-label="今日完成题数" aria-valuemin="0" aria-valuemax="'+target+'" aria-valuenow="'+Math.min(done,target)+'"><i style="width:'+Math.min(100,done/target*100)+'%"></i></div>':'')+'<div class="goal-actions">'+(target===null?'<button class="primary" data-action="daily-roll">掷骰子，抽取今日题目</button>':'<button class="primary" data-action="daily-start" '+(data.damaged?'disabled':'')+'>'+(complete?'回顾今日题目':'继续今日练习')+'</button>')+(!window.LocalApp?'<a class="button-link" href="../games/index.html">休息一局 ↗</a>':'')+'</div><p class="tip goal-tip">按北京时间每日更新。每天只能练习抽到的这组题，重复练习不增加题数；输入密钥后可自由选题。'+(data.damaged?' 今日抽题记录异常，请明天重新抽题。':'')+'</p></section>';
}
function lockedRecordCount(){return Object.keys(progress.stats).filter(function(id){return !byId.has(+id)}).length}
function vaultCard(){
 if(window.LocalApp)return '';
 return '<section class="panel vault-card" id="vault-panel"><div class="row"><h2>解锁自由练习</h2><span class="offline">'+(hasFullAccess()?'本机已解锁':'密钥开启')+'</span></div>'+(hasFullAccess()?'<p class="description">全部 '+BANK.questions.length+' 道题可自由选择，按知识点、错题或收藏练习，不受每日抽题限制。</p><div class="goal-actions"><button class="primary" data-action="vault-practice">自由选题</button><button data-action="vault-lock">清除本机解锁</button></div>':'<p class="description">每天可以免费抽题练习。已有作者提供的密钥，可解锁全部题目的自由练习。</p><form id="vault-form" autocomplete="off"><label class="label" for="vault-code">解锁密钥</label><div class="vault-input-row"><input id="vault-code" name="code" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" required maxlength="100" placeholder="粘贴作者提供的密钥"><button class="primary" type="submit" '+(accessState.loading?'disabled':'')+'>'+(accessState.loading?'正在验证…':'解锁并记住')+'</button></div><p id="vault-error" class="vault-error" role="alert">'+esc(accessState.error)+'</p></form>'+(accessState.saved?'<div class="goal-actions"><button data-action="vault-retry" '+(accessState.loading?'disabled':'')+'>重试已保存的密钥</button><button data-action="vault-lock">清除本机密钥</button></div>':''))+'<p class="tip">'+(hasFullAccess()?(accessState.saved?'密钥已保存在这个浏览器，下次打开会自动验证，无需重新输入。':'本次已解锁，但浏览器未能保存密钥；下次需重新输入。'):'成功验证后，密钥会单独保存在这个浏览器，学习进度备份不包含密钥。')+' 共用电脑请在离开前清除本机解锁。</p><a class="vault-contact" href="https://space.bilibili.com/247892366" target="_blank" rel="noopener noreferrer">联系作者，获取解锁密钥 ↗</a></section>';
}
function rememberedKey(){try{var value=localStorage.getItem(ACCESS_STORAGE);return typeof value==='string'&&value.length<=100?value:''}catch(e){return ''}}
async function unlockAccess(code,remember){
 var generation=++accessState.generation;accessState.loading=true;accessState.error='';
 try{
  if(!window.StudyVault||typeof StudyVault.unlock!=='function')throw Error('unavailable');
  await StudyVault.unlock(code);if(generation!==accessState.generation)return false;
  accessState.unlocked=true;
  if(remember!==false){try{localStorage.setItem(ACCESS_STORAGE,String(code).trim());accessState.saved=true}catch(e){accessState.saved=false}}
  return true;
 }catch(e){if(generation===accessState.generation){accessState.unlocked=false;var invalid=e&&['FORMAT','INVALID_KEY'].includes(e.code);if(invalid&&remember===false&&rememberedKey()===code){try{localStorage.removeItem(ACCESS_STORAGE);accessState.saved=false}catch(ignore){}}accessState.error=invalid?'密钥未通过验证，请重新输入作者提供的完整密钥。':'暂未能验证密钥，请检查网络后重试；已保存的密钥会保留。';}return false}
 finally{code='';if(generation===accessState.generation)accessState.loading=false}
}
async function initializeAccess(){
 if(window.LocalApp)return;var code=rememberedKey();accessState.saved=!!code;if(!code){accessState.generation++;accessState.unlocked=false;accessState.loading=false;accessState.error='';return}
 await unlockAccess(code,false);code='';
}
function forgetAccess(){
 try{localStorage.removeItem(ACCESS_STORAGE)}catch(e){toast('浏览器未能清除密钥，请在浏览器设置中清除本站数据。');return false}
 accessState.generation++;accessState.unlocked=false;accessState.loading=false;accessState.saved=false;accessState.error='';if(window.StudyVault&&typeof StudyVault.lock==='function')StudyVault.lock();setScreen('home');toast('已清除本机解锁，学习记录保留。');return true;
}
function normalizeVaultFilters(){
 if(!progress||!BANK)return;var f=progress.preferences;
 if(f.scope==='vault')f.scope='';
 if(f.source&&f.source!=='nau'&&!sourceMap.has(f.source))f.source='';
 if(f.module&&!BANK.modules.includes(f.module))f.module='';
 if(f.tag&&!BANK.questions.some(function(q){return q.tags.includes(f.tag)}))f.tag='';
}
function sourceName(q){return sourceMap.get(q.sourceId).title}
function summary(qs){var practiced=qs.filter(function(q){return progress.stats[q.id]}),correct=practiced.filter(function(q){return progress.stats[q.id].lastCorrect});return {done:practiced.length,correct:correct.length,rate:practiced.length?Math.round(correct.length/practiced.length*100):null}}
function options(values,current){return values.map(function(v){return '<option value="'+esc(v[0])+'" '+(v[0]===current?'selected':'')+'>'+esc(v[1])+'</option>'}).join('')}
function setScreen(next){screen=next;render();window.scrollTo(0,0)}
function filtered(){if(!hasFullAccess())return [];var f=progress.preferences;return BANK.questions.filter(function(q){return (!f.source||(f.source==='nau'?q.sourceId.indexOf('nau')===0:q.sourceId===f.source))&&(!f.module||q.module===f.module)&&(!f.tag||q.tags.includes(f.tag))&&(!f.difficulty||q.difficulty===f.difficulty)&&(!f.scope||q.scope===f.scope)})}
function filterFields(){if(!hasFullAccess())return '';var f=progress.preferences,tags=Array.from(new Set(BANK.questions.reduce(function(a,q){return a.concat(q.tags)},[]))).sort(function(a,b){return a.localeCompare(b,'zh-CN')});return '<div class="fields"><div class="wide"><label class="label" for="source">资料来源</label><select id="source" data-filter="source">'+options([['','全部来源'],['nau','南审813 · 全部年份']].concat(BANK.sources.map(function(s){return [s.id,s.title]})),f.source)+'</select></div><div><label class="label" for="module">模块</label><select id="module" data-filter="module">'+options([['','全部模块']].concat(BANK.modules.map(function(m){return [m,m]})),f.module)+'</select></div><div><label class="label" for="difficulty">难度</label><select id="difficulty" data-filter="difficulty">'+options([['','全部难度'],['基础','基础'],['中等','中等'],['提高','提高']],f.difficulty)+'</select></div><div class="wide"><label class="label" for="tag">细分知识点</label><select id="tag" data-filter="tag">'+options([['','全部知识点']].concat(tags.map(function(t){return [t,t]})),f.tag)+'</select></div><div class="wide"><label class="label" for="scope">练习范围</label><select id="scope" data-filter="scope">'+options([['','全部内容'],['core','主科目练习'],['extension','拓展提高']],f.scope)+'</select></div><div><label class="label" for="amount">题数</label><select id="amount" data-filter="amount">'+options([['10','10题'],['20','20题'],['50','50题'],['all','全部']],f.amount)+'</select></div><div><label class="label" for="order">选题方式</label><select id="order" data-filter="order">'+options([['random','随机选题'],['weak','错题 / 新题优先'],['ordered','按题号顺序']],f.order)+'</select></div></div>'}
function home(){
 var st=summary(BANK.questions),s=progress.session,full=hasFullAccess();
 app.innerHTML='<section class="hero"><div class="eyebrow">ONE QUESTION AT A TIME</div><h1>先想清楚，<br>再看答案。</h1><p>'+BANK.questions.length+' 道题，包含进阶挑战。<br>'+(full?'自由选题，逐个突破薄弱点。':'每天掷一次骰子，专心完成今天抽到的题。')+'</p>'+(full?'<button class="white" data-action="quick">随机练 20 题 →</button>':'')+'</section>'+(full?'':dailyGoalCard())+'<div class="stats"><div class="stat"><b>'+st.done+'</b><span>累计已练</span></div><div class="stat"><b>'+(st.rate===null?'—':st.rate+'%')+'</b><span>最近答对率</span></div><div class="stat"><b>'+progress.wrong.length+'</b><span>历史错题</span></div></div>'+vaultCard()+(s&&sessionAllowed(s)?'<div class="resume row"><div><b>'+(s.done?'最近一组已完成':'继续上一次思考')+'</b><div class="tiny muted">已核对 '+s.checked.length+' / '+s.ids.length+' 题</div></div><button data-action="resume">'+(s.done?'查看小结':'继续练习')+'</button></div>':'')+(full?'<div class="section-title"><h2>题库修订版 · 专题练习</h2><button class="linklike" data-action="topics">查看全部 →</button></div><div class="pills">'+['进阶挑战','新增100题','考后回忆重建','卷积','零截断泊松','Ross拓展','Fisher信息'].map(function(t){return '<button class="pill" data-action="tag" data-tag="'+t+'">'+t+'</button>'}).join('')+'</div><section class="panel" id="filter-panel"><div class="row"><h3>选一组适合你的题</h3><button class="linklike" data-action="reset-filter">重置</button></div>'+filterFields()+'<p class="tip" id="match-count">当前可选 '+filtered().length+' 题</p><button class="primary widebtn" data-action="start-filter">开始逐题练习</button><p class="tip" style="margin:12px 0 0">先选择 A / B / C / D，再确认。确认前不显示答案；确认后立即展开题解。</p></section>':'<p class="tip">普通练习每天只开放随机抽到的题目。错题和收藏可以在当天抽题范围内回顾；历史记录一直保留。</p>');
}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}
function start(ids,title,order,amount){
 ids=ids.filter(function(id){return byId.has(id)});
 if(!hasFullAccess()&&(!todayGoal().target||ids.some(function(id){return !canPracticeId(id)}))){toast('只能练习今天随机抽到的题目。');setScreen('home');return}
 if(!ids.length){toast('当前没有可练的题目');return}
 if(progress.session&&!progress.session.done&&progress.session.checked.length<progress.session.ids.length&&!confirm('开始新的一组练习？当前这组会被替换，已核对的学习记录、错题和收藏会保留。'))return;
 ids=order==='ordered'?ids.slice():shuffle(ids);
 if(order==='weak')ids.sort(function(a,b){var ra=progress.wrong.includes(a)?0:progress.stats[a]?2:1,rb=progress.wrong.includes(b)?0:progress.stats[b]?2:1;return ra-rb});
 if(amount!=='all')ids=ids.slice(0,+amount||20);
 progress.session={ids:ids,index:0,answers:{},checked:[],notes:{},at:Date.now(),done:false,title:title,dailyDate:hasFullAccess()?null:dayKey()};persist();setScreen('session');
}
function isChecked(id){return progress.session.checked.includes(id)}
function session(){var s=progress.session;if(!s){setScreen('home');return}if(!guardSession())return;var id=s.ids[s.index],q=byId.get(id),checked=isChecked(id),a=s.answers[id],correct=a===q.answer;
 app.innerHTML='<div class="session-head"><button data-action="home">← 保存并返回</button><span class="tiny muted">第 '+(s.index+1)+' / '+s.ids.length+' 题</span><button data-action="star" data-id="'+id+'" class="'+(progress.stars.includes(id)?'starred':'')+'">'+(progress.stars.includes(id)?'★ 已收藏':'☆ 收藏')+'</button></div><div class="progress"><i style="width:'+(s.checked.length/s.ids.length*100)+'%"></i></div><div class="question"><div class="meta"><strong>#'+String(id).padStart(3,'0')+'</strong><span>'+esc(q.module)+'</span><span>'+esc(q.difficulty)+'</span><span>'+esc(q.topic)+'</span><span>'+(q.scope==='extension'?'拓展提高':'主科目练习')+'</span></div><div class="stem">'+fmt(q.stem)+'</div><div class="choices" role="radiogroup" aria-label="选择答案">'+q.options.map(function(t,i){return '<button role="radio" aria-checked="'+(a===i)+'" class="choice '+(a===i?'selected ':'')+(checked&&i===q.answer?'correct ':'')+(checked&&a===i&&!correct?'incorrect':'')+'" data-action="choose" data-value="'+i+'" '+(checked?'disabled':'')+'><span class="letter">'+'ABCD'[i]+'</span><span>'+fmt(t)+'</span></button>'}).join('')+'</div>'+(checked?'<div class="feedback '+(correct?'':'bad')+'" role="status"><b>'+(correct?'答对了 ✓':a===-1||a===undefined?'先学会，再练一次':'这次答错了')+'</b><p>正确答案：'+'ABCD'[q.answer]+(a>=0?'　你的选择：'+'ABCD'[a]:'　已加入错题本')+'</p></div>'+explanation(q):'<p class="hint">想好后选择答案，再点击下方“确认答案”。</p>')+'<details><summary>写一点思路 / 草稿</summary><textarea class="notes" id="note" maxlength="2000" placeholder="记下你的推导或容易混淆的地方">'+esc(s.notes[id]||'')+'</textarea><span class="note-save">自动保存到本机</span></details><div class="tools"><button data-action="previous" '+(s.index===0?'disabled':'')+'>上一题</button>'+(!checked?'<button data-action="later">稍后再想</button>':'')+'</div></div><div class="sticky-actions">'+(checked?'<button class="primary" data-action="next">'+(s.index===s.ids.length-1?'查看本组小结':'下一题 →')+'</button>':'<button class="skip" data-action="dont-know">不会做，看题解</button><button class="primary" data-action="check" '+(!Number.isInteger(a)||a<0?'disabled':'')+'>确认答案</button>')+'</div>';
}
function explanation(q){return '<section class="explanation"><h2>一步一步看懂</h2><div class="goal"><b>本题要掌握</b><br>'+esc(q.objective)+'</div>'+q.steps.map(function(s,i){return '<div class="step"><i>'+(i+1)+'</i><div>'+fmt(s)+'</div></div>'}).join('')+'<div class="pitfall"><b>易错提醒</b><br>'+fmt(q.pitfall)+'</div>'+(q.correction?'<div class="pitfall"><b>原资料校订</b><br>'+fmt(q.correction)+'</div>':'')+'<div class="pills">'+q.tags.map(function(t){return '<span class="pill">'+esc(t)+'</span>'}).join('')+'</div><p class="source">'+esc(sourceName(q))+' · '+esc(q.sourceRef)+'<br>'+esc(q.adaptation)+(sourceMap.get(q.sourceId).url?'<br><span class="source-url">参考链接（可复制）：'+esc(sourceMap.get(q.sourceId).url)+'</span>':'')+'</p></section>'}
function check(skip){if(!guardSession())return;var s=progress.session,id=s.ids[s.index];if(isChecked(id))return;if(skip)s.answers[id]=-1;if(!Number.isInteger(s.answers[id]))return;
 var ok=s.answers[id]===byId.get(id).answer,h=progress.stats[id]||{attempts:0,correct:0};progress.stats[id]={attempts:h.attempts+1,correct:h.correct+(ok?1:0),lastCorrect:ok,at:Date.now()};
 s.checked.push(id);if(ok)progress.wrong=progress.wrong.filter(function(x){return x!==id});else if(!progress.wrong.includes(id))progress.wrong.push(id);
 markDailyAttempt(id,s.answers[id]);if(window.recordAttempt)recordAttempt(id,s.answers[id]);persist();render();setTimeout(function(){var el=document.querySelector('.feedback');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})},20);
}
function finish(){if(!guardSession())return;var s=progress.session;if(!s.done&&s.checked.length===s.ids.length){s.done=true;var correct=s.ids.filter(function(id){return s.answers[id]===byId.get(id).answer}).length;progress.records.push({total:s.ids.length,correct:correct,at:Date.now()});progress.records=progress.records.slice(-20);persist()}setScreen('report')}
function report(){var s=progress.session;if(!s){setScreen('home');return}if(!guardSession())return;var correct=s.checked.filter(function(id){return s.answers[id]===byId.get(id).answer}).length,remaining=s.ids.filter(function(id){return !s.checked.includes(id)}),bad=s.checked.filter(function(id){return s.answers[id]!==byId.get(id).answer});
 app.innerHTML='<div class="section-title"><h1>每一题，都有收获。</h1></div><section class="panel"><p class="tiny muted">'+esc(s.title)+' · '+s.ids.length+' 题</p><div class="score">'+correct+'<small> / '+s.checked.length+' 已核对答对</small></div><p class="muted">待巩固 '+bad.length+' 题 · 尚未核对 '+remaining.length+' 题</p><div class="stack">'+(remaining.length?'<button class="primary" data-action="continue-unchecked">继续未核对题目</button>':'')+'<button class="'+(remaining.length?'soft':'primary')+'" data-action="retry" '+(!bad.length?'disabled':'')+'>重练本组错题</button><button data-action="review">从第一题回顾</button><button data-action="home">返回练习首页</button></div></section><section class="panel"><h3>本组知识模块</h3>'+Array.from(new Set(s.ids.map(function(id){return byId.get(id).module}))).map(function(m){var ids=s.ids.filter(function(id){return byId.get(id).module===m}),done=ids.filter(function(id){return s.checked.includes(id)}),ok=done.filter(function(id){return s.answers[id]===byId.get(id).answer});return '<div class="barline"><span>'+esc(m)+'　'+ok.length+' / '+done.length+' 已核对答对</span><div class="progress"><i style="width:'+(done.length?ok.length/done.length*100:0)+'%"></i></div></div>'}).join('')+'</section><p class="tip">未核对的题目不会计入正确率。重新做对一道错题后，它会从错题本移除。</p>';
}
function topics(){if(!hasFullAccess()){accessNotice();return}var term=topicSearch.trim().toLowerCase();app.innerHTML='<div class="section-title"><div><h1>按薄弱点，逐个突破。</h1><p class="muted tiny">点击模块或知识点，即可筛选练习。</p></div></div><input type="search" id="topic-search" placeholder="搜索考点，如 Fisher、区间估计" value="'+esc(topicSearch)+'"><div class="topic-filter"><button class="linklike" data-action="search-topic">搜索</button><button class="linklike" data-action="clear-topic">清空</button></div>'+BANK.modules.map(function(m){var qs=BANK.questions.filter(function(q){return q.module===m}),tags=Array.from(new Set(qs.reduce(function(a,q){return a.concat(q.tags)},[]))).filter(function(t){return !term||t.toLowerCase().includes(term)||m.includes(term)}),st=summary(qs);if(!tags.length)return '';return '<section class="panel"><div class="row"><h2>'+esc(m)+'</h2><button class="linklike" data-action="module" data-module="'+esc(m)+'">'+qs.length+'题 →</button></div><p class="tiny muted">已练 '+st.done+' / '+qs.length+'　最近答对率 '+(st.rate===null?'暂无':st.rate+'%')+'</p><div class="progress"><i style="width:'+st.done/qs.length*100+'%"></i></div><div class="knowledge">'+tags.map(function(t){var group=qs.filter(function(q){return q.tags.includes(t)}),a=summary(group);return '<button data-action="tag" data-tag="'+esc(t)+'" data-module="'+esc(m)+'"><b>'+esc(t)+'</b><small>'+group.length+'题 · 已练 '+a.done+'</small></button>'}).join('')+'</div></section>'}).join('')}
function library(which){
 var stored=which==='wrong'?progress.wrong:progress.stars,ids=stored.filter(canPracticeId),outside=stored.length-ids.length,qs=ids.map(function(id){return byId.get(id)});
 app.innerHTML='<div class="section-title"><h1>'+(which==='wrong'?'把错题，变成会的题。':'我的收藏')+'</h1></div><p class="muted tiny">当前可复习 '+ids.length+' 题'+(outside?' · 另有 '+outside+' 道历史记录保留':'')+(which==='wrong'?' · 最近一次答对后自动移出':'')+'</p>'+(!hasFullAccess()?'<p class="tip">这里只显示今天随机抽到的题目。输入密钥后，可复习全部历史错题和收藏。</p>':'')+(qs.length?'<button class="primary widebtn" data-action="practice-library" data-kind="'+which+'">开始复练这 '+ids.length+' 题</button><section class="panel">'+qs.map(function(q){return '<article class="listitem"><div class="meta"><strong>#'+q.id+'</strong><span>'+esc(q.topic)+'</span></div><div class="stem">'+fmt(q.stem)+'</div><button data-action="single" data-id="'+q.id+'">练这一题</button></article>'}).join('')+'</section>':'<div class="panel empty">'+(outside?'历史记录仍在，当前抽题范围内暂无可复习题目。':which==='wrong'?'目前没有待复习的错题。':'练习时点击“☆ 收藏”，就能把重要的题留在这里。')+'</div><button class="primary widebtn" data-action="home">返回今日练习</button>')+(outside&&!hasFullAccess()?'<section class="panel"><button class="primary" data-action="show-vault">解锁自由练习</button></section>':'');
}
function mine(){var st=summary(BANK.questions);app.innerHTML='<div class="section-title"><h1>记录你的每一步。</h1></div><section class="panel"><div class="row"><h2>本地学习记录</h2><span class="offline">不需要账号</span></div><p class="description">已练 '+st.done+' 题，最近答对 '+st.correct+' 题。学习记录保存在当前浏览器，可导出备份。</p><div class="stack"><button data-action="stars">我的收藏 · '+progress.stars.length+' 题</button><button data-action="export">导出学习进度</button><button data-action="import">导入学习进度</button></div><p class="tip">备份包含作答、错题、收藏和草稿，不包含密钥，也不会改变今天的抽题范围。清除浏览器数据前，请先导出备份。</p></section><section class="panel"><h3>最近完成</h3>'+(progress.records.length?progress.records.slice().reverse().map(function(r){return '<p class="tiny">'+new Date(r.at).toLocaleDateString()+'　'+r.total+'题 · 答对 '+r.correct+'题</p>'}).join(''):'<p class="tip">完成一组练习后，会在这里留下记录。</p>')+'</section><details class="panel"><summary>关于题库与资料来源</summary><p class="description">题库修订版 · '+BANK.questions.length+' 题<br>先思考，确认答案后再显示对错与解析。</p><p class="tip">原有题目完整保留，包含 24 道专题进阶题；本次新增 40 道投针、随机分段、区间长度与样本量、随机游走回忆改编题（517–556）。可筛选“回忆补充20261026”标签，所有题目都可能被每日随机抽到。401–500 题覆盖 19 类考后回忆，并结合 Ross《Introduction to Probability Models》和 SOA 公开概率资料原创编写。Ross 章节按出版社第10版公开目录定位；随机过程题单独标注为拓展。每题附解析、考点与出处，不标作官方原题。</p><p class="tip">分类对应中国精算师协会2023年公开考纲；Fisher信息、C-R下界等列为深化学习内容。数学三与茆诗松教材体系部分为原创专题，不标作教材原题。题目不是官方模拟卷。</p><p class="tip">无需注册。每日抽题与学习记录只保存在本机；解锁密钥另行保存，下次打开会自动验证。</p></details>';app.insertAdjacentHTML('beforeend',vaultCard()+(!window.LocalApp?'<section class="panel"><h3>学习间隙，休息一局</h3><a class="button-link" href="../games/index.html">进入小游戏 ↗</a></section>':''))}
function render(){var sessionView=screen==='session';nav.classList.toggle('hidden',sessionView);Array.from(nav.children).forEach(function(b){b.hidden=!hasFullAccess()&&b.dataset.action==='topics';b.classList.toggle('active',b.dataset.action===screen||(screen==='stars'&&b.dataset.action==='mine')||(screen==='report'&&b.dataset.action==='home'))});if(screen==='home')home();else if(screen==='topics')topics();else if(screen==='session')session();else if(screen==='report')report();else if(screen==='wrong'||screen==='stars')library(screen);else mine()}
function choose(id){if(!guardSession())return;var s=progress.session,qid=s.ids[s.index];if(isChecked(qid))return;s.answers[qid]=id;persist();render()}
function exportProgress(){var text=JSON.stringify(progress,null,2);if(window.LocalApp)LocalApp.exportProgress(text);else{var a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.href=url;a.download='精算随身练_学习进度.json';a.click();setTimeout(function(){URL.revokeObjectURL(url)},1000)}}
function receiveImport(text){try{var d=validate(JSON.parse(text));if(!confirm('导入将替换当前作答、错题、收藏和草稿。确认导入这份进度？'))return;progress=d;normalizeVaultFilters();persist();setScreen('home');toast('进度已导入；今日抽题和本机解锁状态不受影响。')}catch(e){toast('无法导入，请选择本题库导出的进度文件。')}}
function importProgress(){if(window.LocalApp){LocalApp.importProgress();return}var el=document.createElement('input');el.type='file';el.accept='.json,application/json';el.onchange=function(){var f=el.files[0];if(!f)return;if(f.size>4000000){toast('文件过大，请选择有效进度文件。');return}var reader=new FileReader();reader.onload=function(){receiveImport(reader.result)};reader.readAsText(f)};el.click()}
document.addEventListener('click',function(e){var el=e.target.closest('[data-action]');if(!el||el.disabled||!BANK)return;var a=el.dataset.action,id=+el.dataset.id,s=progress.session;
 if(['home','topics','wrong','mine','stars'].includes(a)){setScreen(a);return}
 if(a==='daily-roll'){try{Promise.resolve(rollDailyGoal()).catch(function(){toast('暂时无法掷骰子，请稍后再试。')})}catch(error){toast('暂时无法掷骰子，请稍后再试。')}return}
 if(a==='daily-start'){startDaily();return}
 if(a==='show-vault'){setScreen('home');var panel=document.getElementById('vault-panel');if(panel){panel.scrollIntoView({block:'start'});var input=document.getElementById('vault-code');if(input)input.focus()}return}
 if(a==='vault-practice'){if(!hasFullAccess()){toast('请先输入密钥解锁自由练习。');return}setScreen('home');document.getElementById('filter-panel').scrollIntoView({block:'start'});return}
 if(a==='vault-lock'){forgetAccess();return}
 if(a==='vault-retry'){initializeAccess().then(function(){setScreen('home')});return}
 if(!hasFullAccess()&&['quick','start-filter','tag','module','reset-filter','search-topic','clear-topic'].includes(a)){toast('自由选题需要输入密钥；你可以继续今日抽题。');setScreen('home');return}
 if(['resume','choose','check','dont-know','previous','next','later','continue-unchecked','review','retry'].includes(a)&&!guardSession())return;
 if(a==='star'&&!canPracticeId(id)){toast('这道题不在今天的抽题范围内。');return}
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
 else if(a==='continue-unchecked'){var nextIndex=s.ids.findIndex(function(id){return !s.checked.includes(id)});if(nextIndex<0){finish();return}s.index=nextIndex;persist();setScreen('session')}
 else if(a==='review'){s.index=0;persist();setScreen('session')}
 else if(a==='retry'){var bad=s.checked.filter(function(id){return s.answers[id]!==byId.get(id).answer});start(bad,'本组错题复练','ordered','all')}
 else if(a==='practice-library')start((progress[el.dataset.kind]||[]).filter(canPracticeId),'错题 / 收藏复练','random','all');
 else if(a==='single')start([id],'单题练习','ordered','all');
 else if(a==='search-topic'){topicSearch=document.getElementById('topic-search').value;render()}
 else if(a==='clear-topic'){topicSearch='';render()}
 else if(a==='export')exportProgress();
 else if(a==='import')importProgress();
});
document.addEventListener('change',function(e){var k=e.target.dataset.filter;if(k&&hasFullAccess()){progress.preferences[k]=e.target.value;persist();document.getElementById('match-count').textContent='当前可选 '+filtered().length+' 题'}});
document.addEventListener('input',function(e){if(e.target.id==='note'&&sessionAllowed(progress.session)){progress.session.notes[progress.session.ids[progress.session.index]]=e.target.value;persist()}});
document.addEventListener('keydown',function(e){if(hasFullAccess()&&e.target.id==='topic-search'&&e.key==='Enter'){topicSearch=e.target.value;render()}});
function appBack(){if(screen==='home')return false;setScreen(screen==='stars'?'mine':'home');return true}
window.addEventListener('pagehide',function(){if(progress)persist()});window.addEventListener('pageshow',async function(e){if(e.persisted&&BANK&&progress){accessState.generation++;accessState.unlocked=false;render();await initializeAccess();render()}});document.addEventListener('visibilitychange',function(){if(document.hidden&&progress)persist();else if(BANK&&progress)render()});
window.addEventListener('storage',function(event){if(!BANK||!progress)return;if(event.key===null){dailyMemory=null;accessState.generation++;accessState.unlocked=false;initializeAccess().then(function(){render()})}else if(event.key===DAILY_STORAGE){dailyMemory=null;render()}else if(event.key===ACCESS_STORAGE){accessState.generation++;accessState.unlocked=false;initializeAccess().then(function(){render()})}});
Promise.all([fetch('bank.json').then(function(r){if(!r.ok)throw Error('bank');return r.json()}),fetch('math-map.json').then(function(r){if(!r.ok)throw Error('math');return r.json()})]).then(async function(data){BANK=data[0];MATH=data[1];byId=new Map(BANK.questions.map(function(q){return [q.id,q]}));sourceMap=new Map(BANK.sources.map(function(s){return [s.id,s]}));try{progress=readProgress()}catch(e){progress=blank();toast('旧记录未能读取，可到“我的”导入备份。')}normalizeVaultFilters();await initializeAccess();render();if(window.initializeCloud)initializeCloud()}).catch(function(){app.innerHTML='<div class="panel empty"><h2>题库暂时没有打开</h2><p>请检查网络后刷新网页。学习记录仍保存在当前浏览器中。</p></div>'});

// The reusable key is separate from study progress; backups never include it.
document.addEventListener('submit',async function(event){
 var form=event.target;if(!form||form.id!=='vault-form')return;event.preventDefault();
 if(accessState.loading)return;var input=form.querySelector('[name="code"]'),code=input.value.trim(),button=form.querySelector('button[type="submit"]'),errorNode=document.getElementById('vault-error');
 input.value='';if(errorNode)errorNode.textContent='';
 if(!code){if(errorNode)errorNode.textContent='请先输入作者提供的解锁密钥。';input.focus();return}
 button.disabled=true;button.textContent='正在验证…';
 var ok=await unlockAccess(code,true);code='';setScreen('home');
 var panel=document.getElementById('vault-panel');if(panel)panel.scrollIntoView({block:'start'});
 if(ok)toast(accessState.saved?'已解锁并记住，下次打开无需重新输入。':'本次已解锁；浏览器未能保存密钥。');
});
