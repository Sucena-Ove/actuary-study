(() => {
  'use strict';
  const W = 1400, H = 820, CHARGE_TIME = 1.12;
  const $ = id => document.getElementById(id), canvas = $('game'), ctx = canvas.getContext('2d');
  const keys = new Set(), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a);
  const BREEDS = {small:{scale:.75,weight:180,name:'小牛'},medium:{scale:1,weight:420,name:'壮牛'},large:{scale:1.45,weight:780,name:'重型牛'}};
  const ROUNDS = window.RanchCatalog, HORSES = window.RanchHorses, STORY=window.RanchStory;
  const RIVALS=[{name:"沙尘杰克",interval:24,points:470},{name:"铁蹄露西",interval:20,points:565},{name:"峡谷冠军",interval:17,points:640}];
  const state = {mode:'ready',gameMode:'practice',trainingIndex:0,career:0,profile:{wins:0,money:0,matches:0,outfitId:'town'},outfit:STORY.outfits[0],matchSettled:false,roundCatchBonus:0,timedCaught:false,storyPage:0,horse:HORSES[0],horseId:HORSES[0].id,phase:'hunt',time:0,elapsed:0,remaining:180,roundIndex:0,rosterIndex:0,order:[],matchElapsed:0,streak:0,bestStreak:0,multiplier:1,excitement:0,shake:0,countdown:0,intermission:0,announcement:null,roundThrowsStart:0,roundDamage:0,perfectHits:0,pausedMode:'playing',projectiles:[],eventLabel:'开场赛',score:0,catches:0,throws:0,dodges:0,roundDodgesStart:0,roundPoints:0,won:false,best:0,sound:true,music:true,
    player:{vx:0,vy:0,aimVx:0,aimVy:0,x:540,y:460,angle:0,horseAngle:0,moving:false,walk:0,sprinting:false,spurBurst:0,stamina:100,exhausted:false,hp:100,maxHp:100,recoverTimer:0,hurt:0,invincible:0,stun:0,balanceTilt:0},
    cows:[],particles:[],floaters:[],charging:false,charge:0,aim:{x:650,y:460,angle:0,range:110,radius:42,sweet:false},rope:null,tether:null,reeling:false,
    pen:{x:555,y:300,w:260,h:220,progress:0,active:false,gateProgress:0,closing:false,closed:false,canClose:false},results:[]};
  let idCounter=0,pointer={x:850,y:390},activePointer=null,lastTime=0,renderScale=1,renderScaleY=1,cameraX=0,cameraY=0,viewWidth=W,viewHeight=H;
  let helpWasPlaying=false,storyWasPlaying=false,messageUntil=0,lastRankingMarkup='';
  const touchInput={enabled:false,x:0,y:0,spur:false,action:false};
  let viewOffsetX=0,viewOffsetY=0;
  const narrativeOpen=()=>Boolean(document.getElementById('prologueDialog')?.open);
  try { state.career=Math.max(0,Math.floor(Number(localStorage.getItem('wild-lasso-career-v6'))||0));const savedHorse=localStorage.getItem('wild-lasso-horse-v6');state.horse=HORSES.find(h=>h.id===savedHorse&&h.unlockAt<=state.career)||HORSES[0];state.horseId=state.horse.id;state.best=Math.max(0,Number(localStorage.getItem('wild-lasso-rodeo-best-v5'))||0); } catch (_) {}
  try {
    const saved=JSON.parse(localStorage.getItem('wild-lasso-story-v7')||'{}');
    for(const key of ['wins','money','matches'])state.profile[key]=Math.max(0,Math.floor(Number(saved[key])||0));
    state.outfit=STORY.outfits.find(o=>o.id===saved.outfitId&&o.wins<=state.profile.wins)||STORY.outfits[0];state.profile.outfitId=state.outfit.id;
  }catch(_){}
  function saveProfile(){try{localStorage.setItem('wild-lasso-story-v7',JSON.stringify(state.profile));}catch(_){} }
  function chapterComplete(ch){return state.profile.wins>=ch.wins&&state.profile.money>=ch.prizeGoal;}
  function currentChapter(){const i=STORY.chapters.findIndex(ch=>!chapterComplete(ch));return i<0?STORY.chapters.length-1:i;}
  function showStory(page=currentChapter(),sceneIndex){
    state.storyPage=clamp(page,0,currentChapter());const ch=STORY.chapters[state.storyPage],done=chapterComplete(ch);
    if(window.RanchNarrative?.render){window.RanchNarrative.render({chapterIndex:state.storyPage,profile:{...state.profile},unlockedIndex:currentChapter(),sceneIndex});return;}
    $('storyTitle').textContent=(state.storyPage+1)+' / '+STORY.chapters.length+' · '+ch.title;
    $('storyText').textContent=ch.text;$('storyObjective').textContent=ch.objective;
    $('storyProgress').textContent=(done?'已完成 · ':'进行中 · ')+state.profile.wins+' / '+ch.wins+' 场胜利 · 学业基金 $'+state.profile.money+' / $'+ch.prizeGoal;
    $('storyReward').textContent=ch.rewardHint;$('storyPrevBtn').disabled=state.storyPage===0;$('storyNextBtn').disabled=state.storyPage>=currentChapter();
  }
  function openStory(page=currentChapter(),sceneIndex){if(narrativeOpen())return;storyWasPlaying=['playing','countdown','intermission'].includes(state.mode);if(storyWasPlaying)pause();showStory(page,sceneIndex);$('storyDialog').showModal();}
  const audio = () => window.RanchAudio;
  function unlockAudio() { audio()?.unlock(); audio()?.setMusic(state.music); audio()?.setSfx(state.sound); }
  function sound(kind,options) { audio()?.play(kind,options); }
  function moo(c,strong=false) { c.vocal=strong?1.1:.8; c.mooCooldown=strong?2.8:4; sound('moo',{size:c.size,volume:strong?.85:.6}); }
  function cow(round) { return {id:++idCounter,x:state.gameMode==='challenge'?1195:1120,y:state.gameMode==='challenge'?rnd(345,465):390,...BREEDS[round.size],...round,angle:Math.PI,phase:rnd(0,6),walk:0,caught:0,delivered:false,subdued:false,struggling:false,strugglePower:0,vocal:0,mooCooldown:0,turnIn:1.5,attack:'none',attackAngle:0,attackTimer:0,attackCooldown:round.personality==='thrower'?2.5:3,attackHit:false,attackThreat:false,standing:0,throwTarget:null,launch:state.gameMode==='challenge'?1.1:0,feint:0,vigor:1,pressure:0,skillStage:'idle',skillTimer:0,skillCooldown:2.8+round.index%4*.6,skillAngle:Math.PI,intent:'观察你的站位',penTime:0,targetLocked:false,yankStun:0}; }
  function message(text,seconds=3) { $('statusHint').textContent=text; messageUntil=state.time+seconds; }
  function burst(x,y,color,amount=12) { for(let i=0;i<amount;i++) state.particles.push({x,y,vx:rnd(-85,85),vy:rnd(-85,35),life:rnd(.35,.8),maxLife:.8,color,size:rnd(2,5)}); }
  function floater(c,text,color='#936333') { state.floaters.push({x:c.x,y:c.y-45,text,life:1.5,color}); }
  function setMode(mode) {
    state.mode=mode; audio()?.setPlaying(['playing','countdown','intermission'].includes(mode));
    $('arena').classList.toggle('is-playing',mode==='playing');$('overlay').classList.toggle('hidden',['playing','countdown'].includes(mode));
    for(const [id,match] of [['welcomeCard','ready'],['pauseCard','paused'],['resultCard','ended']])$(id).classList.toggle('hidden',mode!==match);
    $('roundCard').classList.toggle('hidden',!['roundclear','intermission'].includes(mode));
    $('pauseBtn').disabled=!['playing','countdown','intermission','paused'].includes(mode);$('pauseBtn').querySelector('span').textContent=mode==='paused'?'继续':'暂停';
    for(const id of ['challengeBtn','practiceBtn'])$(id).disabled=['playing','countdown','intermission','paused'].includes(mode);
  }
  function cancelCharge() { state.charging=false;state.charge=0;state.reeling=false;const old=activePointer;activePointer=null;if(old!==null&&canvas.hasPointerCapture?.(old))canvas.releasePointerCapture(old); }
  function clearInput() { keys.clear();touchInput.x=0;touchInput.y=0;touchInput.spur=false;touchInput.action=false;cancelCharge();state.player.moving=false;state.player.sprinting=false;state.player.spurBurst=0; }
  function resetPen() { Object.assign(state.pen,{progress:0,active:true,gateProgress:0,closing:false,closed:false,canClose:false}); }
  function loadRound(index,keepVitals=false) {
    clearInput();state.roundIndex=index;state.rosterIndex=state.gameMode==='practice'?clamp(index,0,ROUNDS.length-1):chooseOpponent(index);state.phase='hunt';state.elapsed=0;state.rope=null;state.tether=null;state.projectiles=[];state.particles=[];state.floaters=[];state.roundDodgesStart=state.dodges;state.roundThrowsStart=state.throws;state.roundDamage=0;state.roundPoints=0;state.won=false;state.roundCatchBonus=0;state.timedCaught=false;state.countdown=0;state.intermission=0;resetPen();
    const hp=keepVitals?state.player.hp:100,stamina=keepVitals?Math.min(state.horse.stamina,state.player.stamina+25):state.horse.stamina;
    Object.assign(state.player,{vx:0,vy:0,aimVx:0,aimVy:0,x:980,y:590,angle:0,horseAngle:0,moving:false,walk:0,sprinting:false,spurBurst:0,stamina,exhausted:false,hp,maxHp:100,recoverTimer:0,hurt:0,invincible:0,stun:0,balanceTilt:0});
    state.cows=[cow(ROUNDS[state.rosterIndex])];const c=state.cows[0];c.speed*=1.25;
    if(state.gameMode==='challenge'){const pressure=1+Math.min(index,30)*.009;c.speed*=pressure;c.strength=Math.min(2.3,c.strength*pressure);}
    const tier=Math.floor(index/4);state.eventLabel=state.gameMode==='practice'?'自由训练':['开场赛','技巧赛','烈牛赛','冠军赛'][Math.min(tier,3)]+(tier>3?' '+(tier-2):'');
    pointer={x:c.x,y:c.y};messageUntil=0;updateAim();
  }
  function chooseOpponent(wave) {
    if(state.order[wave]!==undefined)return state.order[wave];
    if(wave===0)return state.order[wave]=Math.floor(rnd(0,2));
    if(wave%7===2)return state.order[wave]=24;
    const tier=Math.min(4,1+Math.floor(wave/3)),recent=state.order.slice(-5);
    let pool=ROUNDS.filter(c=>c.index!==24&&c.tier<=tier&&!recent.includes(c.index));
    if(!pool.length)pool=ROUNDS.filter(c=>c.index!==24&&c.tier<=tier);
    return state.order[wave]=pool[Math.floor(rnd(0,pool.length))].index;
  }
  function announce(text,sub='',life=1.7) { state.announcement={text,sub,life}; }
  function rankings() {
    return [...RIVALS.map((r,i)=>({name:r.name,score:Math.floor(Math.max(0,state.matchElapsed-i*2)/r.interval)*r.points,you:false})),{name:'你',score:state.score,you:true}].sort((a,b)=>b.score-a.score||Number(a.you)-Number(b.you));
  }
  function resetMatch() { state.pendingStoryChapter=-1;state.matchSettled=false;state.score=0;state.catches=0;state.throws=0;state.dodges=0;state.results=[];state.order=[];state.matchElapsed=0;state.remaining=180;state.streak=0;state.bestStreak=0;state.multiplier=1;state.excitement=0;state.perfectHits=0;state.shake=0;state.announcement=null; }
  function focusGame() { canvas.focus({preventScroll:true}); }
  function start() {
    if(narrativeOpen())return;
    unlockAudio();resetMatch();if(state.gameMode==='practice')state.trainingIndex=clamp(Number($('trainingSelect').value)||0,0,ROUNDS.length-1);
    if(ROUNDS[state.trainingIndex].unlockAt>state.career)state.trainingIndex=0;loadRound(state.gameMode==='practice'?state.trainingIndex:0);
    if(state.gameMode==='challenge'){state.countdown=3;setMode('countdown');sound('countdown');}
    else{setMode('playing');announce(state.rosterIndex===24?'半导体牛登场':'自由训练',ROUNDS[state.rosterIndex].nickname+' · '+ROUNDS[state.rosterIndex].personalityLabel,2);}
    updateHud();focusGame();
  }
  function retryRound() {
    if(state.mode==='ended'){start();return;}unlockAudio();
    if(state.gameMode==='challenge'){state.remaining=Math.max(0,state.remaining-8);state.streak=0;state.multiplier=1;if(state.remaining<=0){finish(false,'重试消耗了最后的时间。');return;}}
    loadRound(state.roundIndex,state.gameMode==='challenge');setMode('playing');message(state.gameMode==='challenge'?'重试当前对手：扣除 8 秒，连胜重置。':'重新练习这一头牛。');updateHud();focusGame();
  }
  function nextRound() { if(!['roundclear','intermission'].includes(state.mode))return;unlockAudio();loadRound(state.gameMode==='practice'?state.trainingIndex:state.roundIndex+1,state.gameMode==='challenge');setMode('playing');announce(state.cows[0].nickname+' 出闸！',state.cows[0].personalityLabel,1.4);sound('bell');updateHud();focusGame(); }
  function changeTrainingCow() { if(state.mode!=='roundclear'||state.gameMode!=='practice')return;do{state.trainingIndex=(state.trainingIndex+1)%ROUNDS.length;}while(ROUNDS[state.trainingIndex].unlockAt>state.career);$('trainingSelect').value=String(state.trainingIndex);nextRound(); }
  function pause() { if(!['playing','countdown','intermission'].includes(state.mode))return;state.pausedMode=state.mode;clearInput();setMode('paused');updateHud(); }
  function resume() { if(state.mode!=='paused'||$('helpDialog').open||$('storyDialog').open||narrativeOpen())return;unlockAudio();setMode(state.pausedMode||'playing');const c=state.cows[0];if(state.mode==='playing'&&c.attack==='stoneWindup'){c.attackTimer=3.1;c.targetLocked=false;sound('stoneCall');}canvas.focus({preventScroll:true}); }
  function finish(won,reason='') {
    if(state.matchSettled)return;state.matchSettled=true;clearInput();state.rope=null;state.tether=null;state.projectiles=[];state.pen.active=false;state.pen.closing=false;state.cows.forEach(c=>{c.struggling=false;c.strugglePower=0;c.attack='none';});
    const place=rankings().findIndex(r=>r.you)+1;state.won=Boolean(won)&&state.player.hp>0&&place===1&&state.catches>=3;
    const previousWins=state.profile.wins,previousChapter=currentChapter(),previousComplete=STORY.chapters.map(chapterComplete);
    const payout=won&&state.player.hp>0&&state.catches>0?([0,650,350,200,100][place]+Math.min(200,state.catches*20)):0;
    if(state.gameMode==='challenge'){state.profile.matches++;state.profile.money+=payout;if(state.won)state.profile.wins++;saveProfile();refreshSelections();}
    state.pendingStoryChapter=STORY.chapters.findIndex((ch,i)=>!previousComplete[i]&&chapterComplete(ch));
    $('resultMenuBtn').textContent=state.pendingStoryChapter>=0?'领取这一程的故事 →':'返回牧场 · 查看旅程与换装';
    const clothes=STORY.outfits.filter(o=>o.wins>previousWins&&o.wins<=state.profile.wins).map(o=>o.name);
    $('resultPrize').textContent='本场奖金 $'+payout+' · 学业基金 $'+state.profile.money;
    $('resultStory').textContent=(clothes.length?'新服装：'+clothes.join('、')+'！返回牧场换装。 ':'')+(STORY.chapters.every(chapterComplete)?'第一学年的资金缺口补齐了。带上家人的来信，回学校参加期末考试！':currentChapter()>previousChapter?'旅程翻开了新的一页。去看看家里和赛场传来的消息。':STORY.chapters[currentChapter()].objective);
    if(state.gameMode==='challenge'&&state.score>state.best){state.best=state.score;try{localStorage.setItem('wild-lasso-rodeo-best-v5',String(state.best));}catch(_){}}
    $('resultKicker').textContent=state.won?'WEST VIRGINIA · A NEW CHAMPION':'THE RODEO RESULTS';$('resultTitle').textContent=state.won?'冠军属于你！':`本场第 ${place} 名`;
    $('resultDetail').textContent=reason+(state.catches<3?' 至少完成 3 头入栏才能获得整场胜利。':'')+` 抓回 ${state.catches} 头牛，最高 ${state.bestStreak} 连胜。对手为本地电脑选手。`;$('finalScore').textContent=state.score;$('finalCombo').textContent=state.catches;$('accuracy').textContent=state.dodges;$('againBtn').innerHTML='再战一场 <span>↗</span>';setMode('ended');sound(state.won?'win':'bell');updateHud();
  }
  function selectGameMode(mode) {
    if(['playing','countdown','intermission','paused'].includes(state.mode))return;
    state.gameMode=mode;resetMatch();loadRound(mode==='practice'?state.trainingIndex:0);setMode('ready');
    for(const [id,value]of[['challengeBtn','challenge'],['practiceBtn','practice']]){$(id).classList.toggle('selected',mode===value);$(id).setAttribute('aria-pressed',String(mode===value));}
    refreshSelections();const training=mode==='practice';$('trainingOptions').classList.toggle('hidden',!training);$('trainingSelect').value=String(state.trainingIndex);
    $('welcomeTitle').textContent=training?'先把这一程骑稳。':'替家里，骑出下一步。';$('welcomeDescription').textContent=training?'从西弗吉尼亚的家族牧场出发。练习赶牛与控绳，准备你的第一场奖金赛。':'林野的第一学年还差一笔学费。每场冠军都会推进旅程；每头牛出闸后 12 秒内套中，再争一份加分。';$('startBtn').innerHTML=(training?'骑马练习':'报名参赛')+' <span>↗</span>';updateHud();
  }
  function updateAim() { const target=state.tether&&state.cows.find(c=>c.id===state.tether.cowId),p=state.player;const angle=Math.atan2((target||pointer).y-p.y,(target||pointer).x-p.x),sweet=state.charge>=.62&&state.charge<=.88,range=110+370*state.charge;p.angle=angle;state.aim={angle,range,radius:sweet?57:42,sweet,x:p.x+Math.cos(angle)*range,y:p.y+Math.sin(angle)*range}; }
  function throwLasso() { if(!state.charging||state.mode!=='playing')return;updateAim();state.throws++;const p=state.player,x=p.x+Math.cos(p.angle)*21,y=p.y-14+Math.sin(p.angle)*21;state.rope={startX:x,startY:y,endX:state.aim.x,endY:state.aim.y,x,y,progress:0,phase:'out',hit:false,radius:state.aim.radius,sweet:state.aim.sweet,duration:.28+state.charge*.26};cancelCharge();sound('throw'); }
  function landLasso(rope) {
    const c=state.cows[0],d=c?Math.hypot(c.x-rope.endX,(c.y-rope.endY)/.68):Infinity;
    if(c&&!c.delivered&&d<=rope.radius+10*c.scale){
      c.struggling=true;c.subdued=false;c.launch=0;c.strugglePower=.5;state.phase='lead';state.tether={cowId:c.id,phase:'lead',control:rope.sweet?.68:.55,progress:.55,tension:.35,danger:0,integrity:1,force:0,slackTime:0,grip:.5,gripVelocity:0,target:.5,zoneWidth:.30,focus:.18,inZone:true,mismatch:0,yankCooldown:0,yankFlash:0,yankActive:0,yankSpeed:0,restLength:clamp(Math.hypot(c.x-state.player.x,c.y-state.player.y)*.88,95,350),surge:false,elapsed:0,distance:Math.hypot(c.x-state.player.x,c.y-state.player.y)};state.rope=null;state.reeling=false;state.pen.active=true;
      if(rope.sweet){state.perfectHits++;state.excitement=clamp(state.excitement+12,0,100);floater(c,'漂亮套中！','#a87523');sound('perfect');}else{floater(c,'套住了，较量才开始');sound('catch');}
      if(state.gameMode==='challenge'){sound('crowd',{intensity:.9});if(!state.timedCaught&&state.elapsed<=12){state.timedCaught=true;state.roundCatchBonus=120;state.excitement=clamp(state.excitement+24,0,100);sound('timedCatch');announce('限时命中！','好样的，牛仔！本头入栏额外 +120',1.7);}}
      burst(c.x,c.y,'#d6b887');message('套住！按住左键升握力，松开下降，跟住牛标攒力；超过 55% 后在绿区按空格猛拽。',5);moo(c);return;
    }
    state.streak=0;state.multiplier=1;burst(rope.endX,rope.endY,'#c4a574',8);message('没套中！瞄准牛前方，连胜已重置。');rope.phase='return';rope.progress=0;sound('miss');
  }
  function escapeCow(c,reason) { c.subdued=false;c.struggling=false;c.strugglePower=0;state.phase='hunt';state.tether=null;state.streak=0;state.multiplier=1;state.excitement=Math.max(0,state.excitement-12);cancelCharge();floater(c,'挣脱了！','#b65b38');burst(c.x,c.y,'#c3a06d');message(reason,4);moo(c,true); }
  function cowInsidePen(c) { const b=state.pen,r=23*c.scale;return c.x>=b.x+r&&c.x<=b.x+b.w-r&&c.y>=b.y+r&&c.y<=b.y+b.h-r; }
  function outsidePen() { const p=state.player,b=state.pen;return p.x>=b.x+b.w+42; }
  function nearGate() { const p=state.player,b=state.pen;return outsidePen()&&Math.hypot(p.x-(b.x+b.w+54),p.y-(b.y+32))<65; }
  function refreshGate() { const b=state.pen,c=state.cows[0];b.canClose=state.mode==='playing'&&!b.closed&&!b.closing&&!!c&&cowInsidePen(c)&&nearGate(); }
  function closeGate() { refreshGate();if(!state.pen.canClose){if(state.mode==='playing')message('整头牛进入后，骑到右上角栏外的门闩旁按 E。');return;}state.pen.closing=true;state.pen.canClose=false;state.pen.gateProgress=0;message('正在关门：守住栏外门闩，别让牛跑出入口。');sound('gate'); }
  function updateGate(dt) {
    const b=state.pen,c=state.cows[0];if(!c||c.delivered)return;
    if(b.closing){
      if(!cowInsidePen(c)||!nearGate()){b.closing=false;b.gateProgress=0;message('关门中断：牛要留在栏内，你要守在栏外门闩旁。',3);sound('warn');}
      else{b.gateProgress=clamp(b.gateProgress+dt/1.1,0,1);if(b.gateProgress>=1){b.closed=true;b.closing=false;completeDelivery(c);return;}}
    }
    refreshGate();
  }
  function releaseRope() { if(!state.tether||state.mode!=='playing')return;const c=state.cows[0];state.tether=null;state.phase='hunt';c.struggling=false;c.strugglePower=0;cancelCharge();message('已主动放绳。绕到牛后侧，用马的位置把它赶进牛栏。',3); }

  function completeDelivery(c) {
    if(state.mode!=='playing'||c.delivered||!state.pen.closed||!cowInsidePen(c)||!nearGate())return;
    const training=state.gameMode==='practice',firstTry=state.throws===state.roundThrowsStart?180:state.throws-state.roundThrowsStart===1?120:0,quick=state.elapsed<20?150:state.elapsed<35?75:0,clean=state.roundDamage===0?100:0;
    state.streak++;state.bestStreak=Math.max(state.bestStreak,state.streak);state.multiplier=training?1:1+Math.min(4,state.streak-1)*.25;
    const points=Math.round((c.points+firstTry+quick+clean+state.roundCatchBonus+(state.dodges-state.roundDodgesStart)*40)*state.multiplier),added=Math.max(0,Math.min(state.elapsed<20?10:6,240-state.matchElapsed-state.remaining)),timeReward=Math.round(added*10)/10;
    state.score+=points;state.roundPoints=points;state.catches++;state.career++;try{localStorage.setItem('wild-lasso-career-v6',String(state.career));}catch(_){}refreshSelections();state.excitement=clamp(state.excitement+26,0,100);state.results.push({round:state.roundIndex,name:c.nickname,points,seconds:state.elapsed});
    if(!training){state.remaining=Math.min(240-state.matchElapsed,state.remaining+added);state.player.hp=Math.min(100,state.player.hp+8);}
    c.delivered=true;c.caught=.001;c.subdued=true;c.struggling=false;c.strugglePower=0;c.attack='none';state.projectiles=[];state.pen.progress=1;state.pen.active=false;state.pen.canClose=false;state.tether=null;clearInput();
    $('roundTitle').textContent=training?`${c.nickname}，关好门了！`:`${state.streak} 连胜！ ×${state.multiplier.toFixed(2)}`;
    $('roundDetail').textContent=training?`已完成 ${state.catches} 次训练，再抓一头或换牛练习。`:`${c.nickname} 入栏，时间 +${timeReward} 秒，血量 +8。下一头即将出闸！`;
    const unlocked=[...ROUNDS,...HORSES].filter(x=>x.unlockAt===state.career).map(x=>x.nickname||x.name);if(unlocked.length)$('roundDetail').textContent+=' 新解锁：'+unlocked.join('、')+'。返回菜单可选择。';if(state.throws===state.roundThrowsStart)$('roundDetail').textContent+=' 纯赶牛奖励 +180！';if(state.roundCatchBonus)$('roundDetail').textContent+=' 限时命中 +120！';$('roundPoints').textContent=`+${points}`;$('nextRoundBtn').innerHTML=(training?'再抓一头':'立即放牛')+' <span>↗</span>';$('trainingChangeBtn').classList.toggle('hidden',!training);
    state.intermission=2.4;setMode(training?'roundclear':'intermission');sound('crowd');sound(state.streak>=3?'combo':'win');updateHud();
  }
  function moveBody(body,dx,dy,r) {
    const b=state.pen,l=b.x,t=b.y,right=l+b.w,bottom=t+b.h,ox=body.x,oy=body.y;
    let nx=ox+dx,ny=oy+dy;
    const walls=[{x:l,y:t,w:b.w,h:0},{x:l,y:bottom,w:b.w,h:0},{x:l,y:t,w:0,h:b.h}];
    if(b.closed)walls.push({x:right,y:t,w:0,h:b.h});
    // Sweep against expanded wall rectangles, including their end posts.
    for(const wall of walls){
      if(oy>wall.y-r&&oy<wall.y+wall.h+r){
        if(ox<=wall.x-r&&nx>wall.x-r)nx=wall.x-r;
        else if(ox>=wall.x+wall.w+r&&nx<wall.x+wall.w+r)nx=wall.x+wall.w+r;
      }
    }
    for(const wall of walls){
      if(nx>wall.x-r&&nx<wall.x+wall.w+r){
        if(oy<=wall.y-r&&ny>wall.y-r)ny=wall.y-r;
        else if(oy>=wall.y+wall.h+r&&ny<wall.y+wall.h+r)ny=wall.y+wall.h+r;
      }
    }
    body.x=clamp(nx,body===state.player?110:125,body===state.player?1290:1265);
    body.y=clamp(ny,body===state.player?140:155,body===state.player?710:695);
  }
  function yank() {
    const t=state.tether,c=state.cows[0];if(state.mode!=='playing'||!t||t.yankCooldown>0)return;
    if(t.focus<.55||!t.inZone){
      t.focus=Math.max(0,t.focus-.12);t.integrity=Math.max(0,t.integrity-.06);t.yankCooldown=.45;sound('yankMiss');floater(c,t.focus<.43?'拉力不足！先稳住绿区':'脱离绿区，拽空了！','#b26445');message('先让牛标留在绿区，攒到 55% 拉力再按空格。',2);return;
    }
    const strength=clamp(state.horse.pull/(.72+c.strength*.3),.6,1.4),distance=Math.hypot(c.x-state.player.x,c.y-state.player.y);
    const amount=Math.min(Math.max(0,distance-58),(78+t.focus*66)*strength);
    t.yankActive=.22;t.yankSpeed=amount/.22;t.yankFlash=1;t.yankCooldown=.8;t.restLength=Math.max(70,t.restLength-amount*.75);
    t.focus=Math.max(0,t.focus-.62);t.integrity=Math.min(1,t.integrity+.025);c.yankStun=.45;c.vigor=Math.max(.16,c.vigor-.12);state.shake=.16;state.excitement=clamp(state.excitement+6,0,100);
    floater(c,'漂亮猛拽！','#9b7737');burst(c.x,c.y+15,'#b9996c',18);sound('yank');message('猛拽成功！趁它踉跄调整方向，下一次跟住牛标再发力。',2);
  }
  function updateLead(dt) {
    if(!state.tether)return;
    const c=state.cows[0],p=state.player,t=state.tether,h=state.horse;t.elapsed+=dt;
    let dx=p.x-c.x,dy=p.y-c.y,d=Math.hypot(dx,dy),nx=dx/Math.max(1,d),ny=dy/Math.max(1,d);
    t.surge=c.skillStage==='burst'||c.attack==='charge';c.struggling=true;c.strugglePower=t.surge?1:c.skillStage==='cue'?.65:.25;
    t.yankCooldown=Math.max(0,t.yankCooldown-dt);t.yankFlash=Math.max(0,t.yankFlash-dt/ .32);
    // Holding lifts the player's control band; release lets it fall. The animal
    // marker has its own rhythm, and a burst changes that rhythm visibly.
    t.zoneWidth=clamp(.34-c.strength*.035+(h.turn-10)*.002,.23,.36);
    t.gripVelocity+=((state.reeling?.62:-.48)-t.gripVelocity)*Math.min(1,dt*9);
    t.grip=clamp(t.grip+t.gripVelocity*dt,t.zoneWidth/2,1-t.zoneWidth/2);
    const rhythm=['zigzag','feint','leap'].includes(c.ability)?2.8:1.65;
    const desired=clamp(.47+Math.sin(t.elapsed*rhythm+c.phase)*(.11+c.strength*.035)+(t.surge?.24:0)-(c.skillStage==='recover'?.12:0),.12,.91);
    t.target+=(desired-t.target)*Math.min(1,dt*(t.surge?6:3));t.inZone=Math.abs(t.grip-t.target)<=t.zoneWidth/2;
    t.mismatch=t.inZone?Math.max(0,t.mismatch-dt*2):t.mismatch+dt;
    t.focus=clamp(t.focus+dt*(t.inZone?.40/(.8+c.strength*.2):-.15),0,1);t.control=t.focus;t.progress=t.focus;
    if(t.inZone&&state.reeling)t.restLength=Math.max(75,t.restLength-dt*20*h.pull);
    else if(!state.reeling)t.restLength=Math.min(400,t.restLength+dt*(t.surge?24:7));
    const stretch=Math.max(0,d-t.restLength),resistance=c.strength*(.45+c.vigor*.65);
    const targetTension=clamp(.22+stretch/190+(t.surge?.22:0)+(state.reeling?.10:0)+(p.sprinting?.16:0),0,1);
    t.tension+=(targetTension-t.tension)*Math.min(1,dt*8);t.force=clamp(stretch/100+(t.surge?.38:0)+t.yankFlash,0,1);
    const wear=(t.mismatch>1.2?.065*resistance:0)+(t.tension>.86?(t.tension-.80)*.8:0)+(d>520?.6:0);
    t.integrity=clamp(t.integrity-wear*dt,0,1);t.danger=1-t.integrity;
    t.slackTime=(!state.reeling&&!t.inZone&&d<t.restLength-45)?t.slackTime+dt:Math.max(0,t.slackTime-dt*2);
    if(t.integrity<=0||d>640){escapeCow(c,'绳索失控断开！用按住/松开的节奏跟住牛标，别一直硬拉。');return;}
    if(t.slackTime>(c.ability==='duck'?1.5:5.5)){escapeCow(c,c.ability==='duck'?'花生钻出了松绳！稳住握力区，或主动放绳改赶牛。':'绳圈松得太久，被牛甩掉了。仍然可以继续赶牛。');return;}
    if(t.yankActive>0){
      const step=Math.min(dt,t.yankActive),pull=Math.min(Math.max(0,d-58),t.yankSpeed*step);
      moveBody(c,nx*pull,ny*pull,23*c.scale);t.yankActive=Math.max(0,t.yankActive-dt);c.walk+=pull*.07;
    }else{
      const slow=(t.inZone&&state.reeling?30*h.pull:0)+Math.min(50,stretch*.30);
      if(d>65)moveBody(c,nx*slow*dt,ny*slow*dt,23*c.scale);
    }
    const drag=Math.min(95,stretch*.24+(t.surge?38*resistance:0))/h.pull*(t.inZone?.35:1);
    moveBody(p,-nx*drag*dt,-ny*drag*dt,20);p.balanceTilt=t.yankFlash>0?-.28*t.yankFlash:t.surge?Math.sin(t.elapsed*20)*.16:0;
    c.vigor=clamp(c.vigor-dt*(t.inZone?.021:.003),.16,1);t.distance=Math.hypot(p.x-c.x,p.y-c.y);
  }

  function damageRider(c) { if(c.attackHit)return;c.attackHit=true;takeDamage(28+Math.round(c.strength*4),'被牛撞到了！转向并用 Shift 躲开红线。',c.attackAngle); }
  function takeDamage(amount,reason,angle=0) {
    const p=state.player;if(p.invincible>0||state.mode!=='playing')return false;
    p.hp=Math.max(0,p.hp-amount);p.hurt=1;p.invincible=.85;p.stun=.25;p.balanceTilt=.35;state.roundDamage+=amount;state.streak=0;state.multiplier=1;state.shake=.32;state.excitement=Math.max(0,state.excitement-16);
    moveBody(p,Math.cos(angle)*30,Math.sin(angle)*30,20);burst(p.x,p.y,'#bd855b',20);floater(p,'−'+amount+' HP','#be4d3c');message(reason,3);sound('impact');
    if(state.tether){state.tether.control=Math.max(0,state.tether.control-.12);state.tether.integrity=Math.max(0,state.tether.integrity-.08);state.tether.focus=Math.max(0,state.tether.focus-.16);state.tether.danger=1-state.tether.integrity;}
    if(p.hp<=0){if(state.gameMode==='challenge')finish(false,'血量耗尽，比赛结束。');else{p.recoverTimer=1.3;p.stun=1.3;p.invincible=3;announce('训练恢复中','稍后恢复血量，继续练习',1.3);}}
    return true;
  }
  function throwStone(c) {
    const target=c.throwTarget||{x:state.player.x,y:state.player.y},d=Math.hypot(target.x-c.x,target.y-c.y);
    state.projectiles.push({id:++idCounter,x:c.x,y:c.y,z:38,startX:c.x,startY:c.y,targetX:target.x,targetY:target.y,shadowX:c.x,shadowY:c.y,radius:18,progress:0,duration:clamp(d/820,.52,1.05),damage:25});
    c.attack='stoneThrow';c.attackTimer=.45;sound('stoneThrow');
  }
  function updateProjectiles(dt) {
    for(const rock of state.projectiles){
      rock.progress=Math.min(1,rock.progress+dt/rock.duration);const t=rock.progress;
      rock.x=rock.startX+(rock.targetX-rock.startX)*t;rock.y=rock.startY+(rock.targetY-rock.startY)*t;rock.shadowX=rock.x;rock.shadowY=rock.y;rock.z=(1-t)*38+Math.sin(t*Math.PI)*145;
      if(t>=1){const hit=Math.hypot(state.player.x-rock.x,state.player.y-rock.y)<rock.radius+27;
        if(hit)takeDamage(rock.damage,'被石头砸中！离开红色落点，Shift 加速躲开。',Math.atan2(rock.targetY-rock.startY,rock.targetX-rock.startX));
        else{state.dodges++;state.excitement=clamp(state.excitement+7,0,100);floater(state.player,'躲开飞石！','#617743');}
        burst(rock.x,rock.y,'#8a7762',14);sound('impact');rock.done=true;
      }
    }
    state.projectiles=state.projectiles.filter(r=>!r.done);
  }
  function updateRage(c,dt,distance) {
    if(c.subdued||c.delivered)return;c.attackCooldown=Math.max(0,c.attackCooldown-dt);
    if(c.personality==='thrower'){
      if(c.attack==='none'&&c.attackCooldown<=0&&distance<900){c.attack='stoneWindup';c.attackTimer=3.1;c.targetLocked=false;c.throwTarget={x:state.player.x,y:state.player.y};c.attackAngle=Math.atan2(state.player.y-c.y,state.player.x-c.x);c.standing=1;c.vocal=3.1;sound('stoneCall');message('半导体牛：“牛来，半导体跌了！”快离开红色落点！',4);}
      return;
    }
    const aggressive=c.personality==='aggressive'||c.personality==='champion',rate=aggressive?(distance<620?.14:.075)+(state.reeling?.035:0):c.personality==='stubborn'?(state.reeling&&state.tether?.tension>.72?.12:-.025):-.1;
    if(c.attack==='none')c.rage=clamp(c.rage+rate*dt,0,1);
    if(c.rage>=1&&c.attack==='none'&&c.attackCooldown<=0){c.attack='windup';c.attackTimer=1.0;c.attackRange=440*.88;c.attackAngle=Math.atan2(state.player.y-c.y,state.player.x-c.x);c.attackHit=false;c.attackThreat=distance<550;sound('charge');moo(c,true);message(`${c.nickname}冲撞预警！转向，按 Shift 躲开红线。`);}
  }
  function turnToward(a,b,rate) { return a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*clamp(rate,0,1); }
  function updateSkill(c,dt,away,distance) {
    c.skillTimer-=dt;
    if(c.skillStage==='idle'){
      c.skillCooldown-=dt;
      if(c.skillCooldown<=0&&(c.pressure>.12||state.tether)){
        c.skillStage='cue';c.skillTimer=.75;c.skillAngle=away;
        const labels={backtrack:'回头找空档！',gateShy:'门前急停！',leap:'惊跳，准备侧蹿！',zigzag:'准备连续折返！',dash:'刨地蓄力冲刺！',duck:'低头钻绳，收紧！',brace:'四蹄扎地，准备猛挣！',orbit:'绕圈甩绳！',feint:'假停，准备变向！',charge:'低头猛挣！',throw:'蹬地甩绳！',steady:'摆头准备挣扎！'};
        c.intent=labels[c.ability]||'准备猛挣！';
        if(c.ability==='backtrack')c.skillAngle+=Math.PI*.94;
        else if(['feint','leap','zigzag'].includes(c.ability))c.skillAngle+=Math.PI*(c.index%2?.55:-.55);
        if(state.tether&&c.mooCooldown<=0)moo(c,true);
      }else c.intent=c.pressure>.7?'被逼急了！拉开一点':c.pressure>.12?'正在赶动':state.tether?'顶着绳子试探':'观察你的站位';
    }else if(c.skillTimer<=0){
      if(c.skillStage==='cue'){c.skillStage='burst';c.skillTimer=c.ability==='zigzag'?1.25:c.ability==='brace'?1.5:.9;c.intent=c.ability==='duck'?'钻绳中！短暂收紧！':c.ability==='brace'?'顶绳不走！松手绕侧面！':state.tether?'猛挣！跟住握力标！':'突围！堵住侧前方！';moo(c,true);}
      else if(c.skillStage==='burst'){c.skillStage='recover';c.skillTimer=1.25;c.vigor=Math.max(.16,c.vigor-.10);c.intent='喘气空档 · 趁机赶入栏';}
      else{c.skillStage='idle';c.skillCooldown=4.5+(1-c.vigor)*2+c.index%3*.5;}
    }
  }
  function updateCow(dt,demo=false) {
    const c=state.cows[0];if(!c||c.delivered)return;c.vocal=Math.max(0,c.vocal-dt);c.mooCooldown=Math.max(0,c.mooCooldown-dt);
    c.yankStun=Math.max(0,c.yankStun-dt);
    const p=state.player,distance=Math.hypot(c.x-p.x,c.y-p.y),away=Math.atan2(c.y-p.y,c.x-p.x),fear=c.ability==='leap'?340:290;
    c.pressure=demo?0:clamp((fear-distance)/220,0,1);
    c.penTime=cowInsidePen(c)?c.penTime+dt:0;
    if(!demo)updateRage(c,dt,distance);
    if(c.attack==='stoneWindup'){
      c.attackTimer-=dt;c.standing=1;c.intent=c.targetLocked?'落点已锁！立即转向！':'正在预判你的跑位';
      if(!c.targetLocked){
        let flight=clamp(distance/820,.52,1.05);
        for(let pass=0;pass<5;pass++){
          const lead=flight+Math.max(0,c.attackTimer);
          c.throwTarget={x:clamp(p.x+p.aimVx*lead,115,1285),y:clamp(p.y+p.aimVy*lead,145,705)};
          flight=clamp(Math.hypot(c.throwTarget.x-c.x,c.throwTarget.y-c.y)/820,.52,1.05);
        }
        if(c.attackTimer<=.65){c.targetLocked=true;sound('warn');}
      }
      c.attackAngle=Math.atan2(c.throwTarget.y-c.y,c.throwTarget.x-c.x);c.angle=c.attackAngle;
      if(c.attackTimer<=0)throwStone(c);return;
    }
    if(c.attack==='stoneThrow'){c.attackTimer-=dt;c.standing=Math.max(0,c.attackTimer/.45);if(c.attackTimer<=0){c.attack='none';c.standing=0;c.attackCooldown=4.8;c.throwTarget=null;c.targetLocked=false;}return;}
    if(c.attack==='windup'){c.attackTimer-=dt;c.angle=c.attackAngle;c.intent='冲撞预警！横向闪避！';c.strugglePower=1;if(c.attackTimer<=0){c.attack='charge';c.attackTimer=.88;}return;}
    if(c.attack==='charge'){
      c.attackTimer-=dt;c.angle=c.attackAngle;moveBody(c,Math.cos(c.attackAngle)*440*dt,Math.sin(c.attackAngle)*440*dt,23*c.scale);c.walk+=dt*20;
      if(Math.hypot(c.x-p.x,c.y-p.y)<32+22*c.scale)damageRider(c);
      if(c.attackTimer<=0){if(!c.attackHit&&c.attackThreat){state.dodges++;state.excitement=clamp(state.excitement+10,0,100);floater(p,'极限闪避！','#617743');sound('crowd');}c.attack='none';c.attackCooldown=c.personality==='champion'?3.7:5.3;c.rage=.15;c.skillStage='recover';c.skillTimer=1.25;}
      return;
    }
    if(!demo)updateSkill(c,dt,away,distance);
    c.vigor=clamp(c.vigor+dt*(c.pressure>.2?-.006:state.tether?0:.028),.16,1);
    let target=c.angle,speed=c.speed*.20,turn=2.4;
    if(c.pressure>.02){target=away;speed=(28+c.speed*c.pressure*1.15)*(.60+c.vigor*.4);turn=3.5;}
    else{c.turnIn-=dt;if(c.turnIn<=0){target+=rnd(-.7,.7);c.turnIn=rnd(2,4);}}
    if(c.penTime>1.5&&c.pressure<.22){target=Math.atan2(state.pen.y+state.pen.h/2-c.y,state.pen.x+state.pen.w+60-c.x);speed=c.speed*.7;c.intent='寻找门口逃跑！';}
    if(c.launch>0){c.launch-=dt;target=Math.PI;speed=160;}
    if(c.skillStage==='cue')speed*=c.ability==='dash'||c.ability==='feint'?.12:.65;
    if(c.skillStage==='burst'){
      if(c.ability==='brace'){speed=6;target=away;}
      else if(c.ability==='gateShy'){speed=Math.hypot(c.x-(state.pen.x+state.pen.w),c.y-(state.pen.y+state.pen.h/2))<180?8:65;target=away;}
      else if(c.ability==='orbit'){target=away+1.25;speed=c.speed*1.7;turn=7;}
      else if(c.ability==='zigzag'){target=c.skillAngle+(c.skillTimer<.6?1.7:0);speed=c.speed*1.9;turn=8;}
      else if(['leap','dash','backtrack','feint'].includes(c.ability)){target=c.skillAngle;speed=c.speed*(c.ability==='dash'?2.5:1.9);turn=7;}
      else{speed*=1.5;target=away;}
    }
    if(c.skillStage==='recover')speed*=.6;
    if(c.pressure>.85&&p.sprinting){target+=Math.sin(state.elapsed*5+c.phase)*.8;speed*=1.35;c.intent='惊慌乱窜！别贴身猛冲';}
    if(demo)speed*=.45;
    // The arena boundaries make the animal turn back into space, instead of sticking.
    if(c.x>1230&&Math.cos(target)>.1)target=Math.PI+(c.y>420?.55:-.55);
    if(c.y<180&&Math.sin(target)<0)target=Math.abs(target);
    if(c.y>675&&Math.sin(target)>0)target=-Math.abs(target);
    c.angle=turnToward(c.angle,target,dt*turn);
    let sx=Math.cos(c.angle)*speed*dt,sy=Math.sin(c.angle)*speed*dt;
    if(c.yankStun>0){sx=0;sy=0;c.intent='被拽得踉跄 · 抢位！';}
    const t=state.tether;
    if(t&&distance>t.restLength){const nx=(c.x-p.x)/Math.max(1,distance),ny=(c.y-p.y)/Math.max(1,distance),outward=Math.max(0,sx*nx+sy*ny),restraint=t.inZone?.94:.7;sx-=nx*outward*restraint;sy-=ny*outward*restraint;}
    const ox=c.x,oy=c.y;moveBody(c,sx,sy,23*c.scale);c.walk+=Math.hypot(c.x-ox,c.y-oy)*.07;
    if(Math.hypot(c.x-ox,c.y-oy)<speed*dt*.15&&speed>20){c.angle+=dt*3;c.turnIn=.1;}
    if(c.strugglePower>.7&&Math.random()<dt*10)burst(c.x,c.y+12,'#cdb184',2);
  }

  function spur() { const p=state.player;if(p.stamina>0&&!p.exhausted)p.spurBurst=.28; }
  function updatePlayer(dt) {
    const p=state.player,h=state.horse;p.hurt=Math.max(0,p.hurt-dt);p.invincible=Math.max(0,p.invincible-dt);p.stun=Math.max(0,p.stun-dt);if(p.recoverTimer>0){p.recoverTimer=Math.max(0,p.recoverTimer-dt);if(p.recoverTimer===0&&state.gameMode==='practice'){p.hp=100;floater(p,'恢复满血，继续练习','#617743');}}p.balanceTilt*=Math.max(0,1-dt*6);p.spurBurst=Math.max(0,p.spurBurst-dt);
    const kx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),ky=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);
    const dx=kx+touchInput.x,dy=ky+touchInput.y,mag=Math.hypot(dx,dy),shift=keys.has('ShiftLeft')||keys.has('ShiftRight')||touchInput.spur;
    p.moving=mag>0&&p.stun<=0;p.sprinting=p.moving&&(shift||p.spurBurst>0)&&!p.exhausted&&p.stamina>0;
    if(p.sprinting){p.stamina=Math.max(0,p.stamina-33*dt);if(p.stamina===0){p.exhausted=true;p.sprinting=false;}}
    else if(!shift||p.exhausted||!p.moving)p.stamina=Math.min(h.stamina,p.stamina+h.regen*dt);
    if(p.exhausted&&p.stamina>=h.stamina*.28&&!shift)p.exhausted=false;
    let speed=h.speed*(state.charging?.80:1)*(state.tether&&state.reeling?.73:1);if(p.sprinting)speed*=h.sprint;
    const inputScale=Math.min(1,mag),tx=p.moving?dx/mag*speed*inputScale:0,ty=p.moving?dy/mag*speed*inputScale:0,ease=Math.min(1,dt*(p.moving?h.turn:16));
    p.vx+=(tx-p.vx)*ease;p.vy+=(ty-p.vy)*ease;
    const ox=p.x,oy=p.y;moveBody(p,p.vx*dt,p.vy*dt,20);
    p.aimVx+=((p.x-ox)/Math.max(dt,.001)-p.aimVx)*Math.min(1,dt*8);p.aimVy+=((p.y-oy)/Math.max(dt,.001)-p.aimVy)*Math.min(1,dt*8);
    if(!p.moving)return;p.walk+=dt*(p.sprinting?20:12);
    p.horseAngle=turnToward(p.horseAngle,Math.atan2(p.vy,p.vx),dt*h.turn);
    if(Math.random()<dt*(p.sprinting?30:10))state.particles.push({x:p.x-dx*20,y:p.y+15,vx:rnd(-12,12),vy:-5,life:.5,maxLife:.5,size:rnd(2,5),color:'#c4a477'});
  }

  function update(dt) {
    if(['paused','ended','roundclear'].includes(state.mode))return;state.time+=dt;state.shake=Math.max(0,state.shake-dt);state.excitement=Math.max(0,state.excitement-dt*.8);
    if(state.announcement){state.announcement.life-=dt;if(state.announcement.life<=0)state.announcement=null;}
    if(state.mode==='ready'){updateCow(dt,true);return;}
    if(state.mode==='countdown'){const before=Math.ceil(state.countdown);state.countdown=Math.max(0,state.countdown-dt);if(Math.ceil(state.countdown)<before&&state.countdown>0)sound('countdown');if(state.countdown===0){setMode('playing');announce('放牛！','把牛赶入栏，在栏外关门！',1.5);sound('bell');}audio()?.update(state,dt);return;}
    if(state.mode==='intermission'){state.intermission-=dt;$('nextRoundBtn').innerHTML=`立即放牛 · ${Math.max(1,Math.ceil(state.intermission))}`;if(state.intermission<=0)nextRound();audio()?.update(state,dt);return;}
    state.elapsed+=dt;
    if(state.gameMode==='challenge'){state.matchElapsed+=dt;state.remaining=Math.max(0,Math.min(state.remaining-dt,240-state.matchElapsed));if(state.remaining<=0){finish(true,'终场铃响！');return;}}
    updatePlayer(dt);if(state.charging)state.charge=clamp(state.charge+dt/CHARGE_TIME,0,1);updateAim();updateCow(dt);if(state.mode!=='playing')return;updateProjectiles(dt);if(state.mode!=='playing')return;updateLead(dt);updateGate(dt);
    if(state.rope){const r=state.rope;if(r.phase==='out'){r.progress=Math.min(1,r.progress+dt/r.duration);const t=r.progress;r.x=r.startX+(r.endX-r.startX)*t;r.y=r.startY+(r.endY-r.startY)*t-Math.sin(t*Math.PI)*72;if(t>=1)landLasso(r);}else{r.progress=Math.min(1,r.progress+dt/.38);r.x=r.endX+(state.player.x-r.endX)*r.progress;r.y=r.endY+(state.player.y-r.endY)*r.progress;if(r.progress>=1)state.rope=null;}}
    for(const p of state.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=65*dt;p.life-=dt;}state.particles=state.particles.filter(p=>p.life>0);
    for(const f of state.floaters){f.y-=26*dt;f.life-=dt;}state.floaters=state.floaters.filter(f=>f.life>0);audio()?.update(state,dt);
  }
  function updateHud() {
    const round=state.cows[0],p=state.player,c=state.cows[0],training=state.gameMode==='practice';
    $('score').textContent=String(state.score).padStart(4,'0');$('caught').textContent=state.catches;$('best').textContent=state.best;$('modeLabel').textContent=training?'训练 · 25 种牛':'牛仔大赛 · 连续抢分';
    const seconds=Math.ceil(state.remaining);$('timerLabel').textContent=training?'自由训练':'比赛剩余';$('timer').textContent=training?'∞':`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;$('timerFill').style.width=(training?100:Math.min(100,state.remaining/180*100))+'%';$('timer').parentElement.classList.toggle('urgent',!training&&seconds<=15);
    $('roundLabel').textContent=training?'自由训练':`第 ${state.roundIndex+1} 头 · ${state.eventLabel}`;$('cowName').textContent=round.nickname;$('personalityLabel').textContent=`${BREEDS[round.size].name} · ${round.personalityLabel}`;
    $('objectiveText').textContent=state.pen.closing?'守住栏外门闩，正在关门':state.pen.canClose?'牛已入栏！按 E 关门':cowInsidePen(c)?'去右上角栏外门闩，按 E 关门':'绕到牛后侧，把牛赶入中央牛栏右侧入口';$('tacticText').textContent=round.skillHint;
    $('staminaFill').style.width=(p.stamina/state.horse.stamina*100)+'%';$('staminaValue').textContent=p.exhausted?'稍歇':Math.round(p.stamina)+' / '+state.horse.stamina;$('healthValue').textContent=Math.ceil(p.hp)+' / '+p.maxHp;$('healthFill').style.width=(p.hp/p.maxHp*100)+'%';$('healthFill').style.background=p.hp<=30?'#d54d3b':'#ba6244';
    const power=state.tether?state.tether.tension:state.charge;$('powerFill').style.width=power*100+'%';$('powerPercent').textContent=Math.round(power*100)+'%';$('powerFill').parentElement.classList.toggle('sweet',state.tether?power>=.24&&power<=.78:state.charging&&state.aim.sweet);
    $('powerLabel').textContent=state.tether?(state.reeling?'握力上升':'握力下降'):state.rope?(state.rope.phase==='out'?'套索飞行中':'收回套索中'):state.charging?(state.aim.sweet?'最佳蓄力！':state.charge>=1?'已蓄满力':'正在蓄力'):'套索就绪';
    $('strugglePanel').classList.toggle('hidden',!state.tether||state.mode!=='playing');
    if(state.tether&&c){const t=state.tether;$('targetName').textContent=c.nickname+' · '+c.name;$('targetWeight').textContent=c.weight+' KG';$('struggleBadge').textContent=c.attack.startsWith('stone')?'小心飞石':c.attack!=='none'?'当心冲撞':t.surge?'用力挣扎':'牵引中 · 仍会挣脱';$('struggleLabel').textContent='绳索完好';$('struggleFill').style.width=t.integrity*100+'%';$('strugglePercent').textContent=Math.floor(t.integrity*100)+'%';$('tensionFill').style.width=t.tension*100+'%';$('tensionValue').textContent=Math.round(t.tension*100)+'%';$('tensionFill').style.background=t.tension>.78?'#c15c3b':t.tension<.24?'#bea77d':'#80945e';$('dangerFill').style.width=t.danger*100+'%';$('strugglePanel').classList.toggle('danger',t.danger>.35||t.tension>.85);
      $('struggleHint').textContent=t.mismatch>1.2?'牛标脱离绿区！调整握力，绳子正在磨损':t.surge?'猛挣时标记会跳高，跟住它！':'按住上升，松开下降 · 右键/Q 完全解绳';
      $('duelGrip').style.bottom=(t.grip*100)+'%';$('duelGrip').style.height=(t.zoneWidth*100)+'%';$('duelMarker').style.bottom=(t.target*100)+'%';$('duelTrack').classList.toggle('matched',t.inZone);
      $('duelChargeFill').style.width=(t.focus*100)+'%';$('duelChargeValue').textContent=Math.round(t.focus*100)+'%';
      $('yankBtn').disabled=t.focus<.55||!t.inZone||t.yankCooldown>0;$('duelHint').textContent=t.yankCooldown>0?'收势中，继续稳住握力':t.focus>=.55?(t.inZone?'现在按空格：猛拽！':'拉力已足，等牛标进入绿区'):'让牛标留在绿区，攒到 55% 再猛拽';
    }
    const song=audio()?.snapshot?.();$('musicTrackLabel').textContent=song?.trackTitle||'西部电台';$('sprintCatchText').textContent=training?'自由训练 · 套索可选':state.timedCaught?'限时命中 ✓ 入栏额外 +120':state.elapsed<12?'限时套中 '+(12-state.elapsed).toFixed(1)+' 秒 · 入栏 +120':'限时奖励已过 · 赶牛仍可得分';
    const b=state.pen;$('gatePanel').classList.toggle('hidden',state.mode!=='playing');$('gateBtn').disabled=!b.canClose;$('gateBtn').innerHTML=b.closing?'正在关门…':'<kbd>E</kbd> 关门';$('gateHint').textContent=b.closing?'守在栏外门闩旁，牛仍会逃跑':b.canClose?'你在栏外，按 E 关好门':cowInsidePen(c)?'骑到右上角栏外的金色门闩旁':'把牛赶进右侧入口，不必先套住';
    $('cowTrait').textContent=c.skillName;$('resistanceFill').style.width=(c.vigor*100)+'%';$('resistanceText').textContent=Math.round(c.vigor*100)+'% · '+c.intent;$('ropeIntegrity').textContent=state.tether?'绳索 '+Math.round(state.tether.integrity*100)+'%':'未套绳 · 仍可赶入栏';$('combo').classList.add('hidden');
    $('racePanel').classList.toggle('hidden',training||state.mode==='ready');$('heatLabel').textContent=state.eventLabel;$('comboMultiplier').textContent='×'+state.multiplier.toFixed(2);$('streakValue').textContent=state.streak;$('crowdFill').style.width=state.excitement+'%';
    const board=rankings();$('rankingValue').textContent='第 '+(board.findIndex(r=>r.you)+1)+' 名';const rankingMarkup=board.map((r,i)=>'<div class="rival-row '+(r.you?'you':'')+'"><span>'+(i+1)+'</span><span>'+r.name+'</span><b>'+r.score+'</b></div>').join('');if(rankingMarkup!==lastRankingMarkup){$('rivalsList').innerHTML=rankingMarkup;lastRankingMarkup=rankingMarkup;}
    if(state.time>messageUntil)$('statusHint').textContent=b.closing?'正在关门，牛还可能跑出去！':b.canClose?'牛已入栏！按 E 或点击按钮关门':state.tether?'左键升握力，松开下降 · 绿区攒力后空格猛拽 · 右键解绳':p.exhausted?'马需要缓一缓：松开 Shift 恢复耐力':'从牛后侧施压，留出距离慢赶 · Shift 截路 · 套索只是帮手';
  }
  function resize() { const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);viewWidth=r.width;viewHeight=r.height;canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);if(touchInput.enabled){renderScale=renderScaleY=Math.max(.01,Math.min(r.width/W,r.height/H));viewOffsetX=(r.width-W*renderScale)/2;viewOffsetY=(r.height-H*renderScale)/2;}else{viewOffsetX=viewOffsetY=0;renderScale=r.width<=650?Math.max(r.width/W,r.height/H):r.width/W;renderScaleY=r.width<=650?renderScale:r.height/H;} }
  function draw() { const dpr=Math.min(window.devicePixelRatio||1,2);cameraX=clamp(state.player.x-viewWidth/renderScale/2,0,Math.max(0,W-viewWidth/renderScale));cameraY=clamp(state.player.y-viewHeight/renderScaleY/2,0,Math.max(0,H-viewHeight/renderScaleY));const shake=state.shake*10;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect?.(0,0,canvas.width,canvas.height);ctx.setTransform(dpr*renderScale,0,0,dpr*renderScaleY,viewOffsetX*dpr-cameraX*dpr*renderScale+Math.sin(state.time*83)*shake,viewOffsetY*dpr-cameraY*dpr*renderScaleY+Math.cos(state.time*67)*shake);window.RanchArt?.draw(ctx,state); }
  function frame(t) { const dt=lastTime?Math.min((t-lastTime)/1000,.05):0;lastTime=t;update(dt);draw();updateHud();requestAnimationFrame(frame); }
  function updatePointer(e) { const r=canvas.getBoundingClientRect();pointer.x=(e.clientX-r.left-viewOffsetX)/renderScale+cameraX;pointer.y=(e.clientY-r.top-viewOffsetY)/renderScaleY+cameraY; }
  canvas.addEventListener('pointermove',e=>{if(touchInput.enabled&&e.pointerType==='touch')return;if(activePointer===null||e.pointerId===activePointer)updatePointer(e);});
  canvas.addEventListener('pointerdown',e=>{if(touchInput.enabled&&e.pointerType==='touch')return;if(e.button===2){e.preventDefault();releaseRope();return;}if(e.button!==0||state.mode!=='playing'||state.rope||state.charging||activePointer!==null||narrativeOpen())return;e.preventDefault();updatePointer(e);canvas.focus({preventScroll:true});activePointer=e.pointerId;canvas.setPointerCapture(e.pointerId);if(state.tether)state.reeling=true;else{state.charging=true;state.charge=0;updateAim();}});
  canvas.addEventListener('pointerup',e=>{if(e.pointerId===activePointer){updatePointer(e);if(state.tether)cancelCharge();else throwLasso();}});
  canvas.addEventListener('pointercancel',e=>{if(e.pointerId===activePointer)cancelCharge();});canvas.addEventListener('lostpointercapture',e=>{if(e.pointerId===activePointer&&(state.charging||state.reeling))cancelCharge();});canvas.addEventListener('contextmenu',e=>e.preventDefault());
  const movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
  window.addEventListener('keydown',e=>{
    if($('helpDialog').open||$('storyDialog').open||narrativeOpen())return;
    if(e.code==='Escape'&&!e.repeat){if(['playing','countdown','intermission'].includes(state.mode))pause();else if(state.mode==='paused')resume();return;}
    if(movementKeys.has(e.code)&&state.mode==='playing'){e.preventDefault();keys.add(e.code);if(!e.repeat&&e.code.startsWith('Shift'))spur();}
    if(e.repeat)return;
    if(e.code==='Space'&&state.mode==='playing'&&state.tether){e.preventDefault();yank();}
    if(e.code==='KeyN'){e.preventDefault();audio()?.nextTrack?.();}
    if(e.code==='KeyQ'&&state.mode==='playing'){e.preventDefault();releaseRope();}
    if(e.code==='KeyE'&&state.mode==='playing'){e.preventDefault();closeGate();}
    if(e.code==='KeyR'&&['playing','paused','ended'].includes(state.mode)){if(state.mode==='ended')start();else retryRound();}
    if(e.code==='Space'&&state.mode==='ready'&&e.target===canvas){e.preventDefault();start();}
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{clearInput();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause();}});
  $('startBtn').addEventListener('click',start);$('againBtn').addEventListener('click',start);$('restartBtn').addEventListener('click',retryRound);$('nextRoundBtn').addEventListener('click',nextRound);$('trainingChangeBtn').addEventListener('click',changeTrainingCow);
  $('pauseBtn').addEventListener('click',()=>state.mode==='paused'?resume():pause());$('resumeBtn').addEventListener('click',resume);$('menuBtn').addEventListener('click',()=>{state.mode='ended';selectGameMode(state.gameMode);});$('challengeBtn').addEventListener('click',()=>selectGameMode('challenge'));$('practiceBtn').addEventListener('click',()=>selectGameMode('practice'));
  $('trainingSelect').addEventListener('change',()=>{if(state.mode==='ready'&&state.gameMode==='practice'){const selected=clamp(Number($('trainingSelect').value)||0,0,ROUNDS.length-1);state.trainingIndex=ROUNDS[selected].unlockAt<=state.career?selected:0;loadRound(state.trainingIndex);updateHud();}});
  $('yankBtn').addEventListener('click',()=>{yank();focusGame();});
  $('nextMusicBtn').addEventListener('click',()=>{unlockAudio();audio()?.nextTrack?.();});
  $('resultMenuBtn').addEventListener('click',()=>{const reward=state.pendingStoryChapter;selectGameMode(state.gameMode);if(reward>=0)openStory(reward,'last');});
  $('storyBtn').addEventListener('click',()=>openStory());
  $('storyCloseBtn').addEventListener('click',()=>$('storyDialog').close());
  $('storyPrevBtn').addEventListener('click',()=>showStory(state.storyPage-1));$('storyNextBtn').addEventListener('click',()=>showStory(state.storyPage+1));
  $('storyDialog').addEventListener('close',()=>{if(storyWasPlaying)resume();storyWasPlaying=false;});
  $('outfitSelect').addEventListener('change',()=>{if(!['ready','ended','roundclear'].includes(state.mode))return;const outfit=STORY.outfits.find(o=>o.id===$('outfitSelect').value&&o.wins<=state.profile.wins);if(!outfit)return;state.outfit=outfit;state.profile.outfitId=outfit.id;saveProfile();refreshSelections();});
  $('gateBtn').addEventListener('click',()=>{closeGate();canvas.focus({preventScroll:true});});
  function toggleAudio(kind) { state[kind]=!state[kind];unlockAudio();const button=$(kind==='sound'?'soundBtn':'musicBtn'),label=kind==='sound'?'音效':'音乐';button.setAttribute('aria-pressed',String(state[kind]));button.title=(state[kind]?'关闭':'开启')+label;button.querySelector('span').textContent=label+(state[kind]?'开':'关');if(kind==='sound'&&state.sound)sound('catch'); }
  $('soundBtn').addEventListener('click',()=>toggleAudio('sound'));$('musicBtn').addEventListener('click',()=>toggleAudio('music'));
  $('helpBtn').addEventListener('click',()=>{helpWasPlaying=['playing','countdown','intermission'].includes(state.mode);if(helpWasPlaying)pause();$('helpDialog').showModal();});$('closeHelpBtn').addEventListener('click',()=>$('helpDialog').close());$('gotItBtn').addEventListener('click',()=>$('helpDialog').close());$('helpDialog').addEventListener('close',()=>{if(helpWasPlaying)resume();helpWasPlaying=false;});
  document.querySelectorAll('[data-dir]').forEach(button=>{button.addEventListener('pointerdown',e=>{e.preventDefault();if(state.mode==='playing'){button.setPointerCapture(e.pointerId);keys.add(button.dataset.dir);}});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(button.dataset.dir));});
  $('spurBtn').addEventListener('pointerdown',e=>{e.preventDefault();if(state.mode==='playing'){$('spurBtn').setPointerCapture(e.pointerId);keys.add('ShiftLeft');spur();}});for(const event of ['pointerup','pointercancel','lostpointercapture'])$('spurBtn').addEventListener(event,()=>keys.delete('ShiftLeft'));
  $('specialCowBtn').addEventListener('click',()=>{if(!['ready','ended','roundclear'].includes(state.mode))return;state.mode='ready';state.trainingIndex=24;selectGameMode('practice');$('trainingSelect').value='24';start();});
  $('fullscreenBtn').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>message('请按 F11 切换全屏'));});
  function refreshSelections() {
    $('outfitSelect').innerHTML=STORY.outfits.map(o=>'<option value="'+o.id+'" '+(o.wins>state.profile.wins?'disabled':'')+'>'+o.name+(o.wins>state.profile.wins?' · 获胜 '+o.wins+' 场解锁':'')+'</option>').join('');$('outfitSelect').value=state.outfit.id;
    $('careerMoney').textContent='$'+state.profile.money;$('careerWins').textContent=state.profile.wins;
    const chapter=STORY.chapters[currentChapter()];$('storySummary').textContent=(STORY.chapters.every(chapterComplete)?'学业目标已完成，新的赛季仍在继续。':chapter.title+' · '+chapter.objective);

    $('trainingSelect').innerHTML=ROUNDS.map((c,i)=>'<option value="'+i+'" '+(c.unlockAt>state.career?'disabled':'')+'>'+c.nickname+' · '+c.skillName+(c.unlockAt>state.career?' · 入栏 '+c.unlockAt+' 次解锁':'')+'</option>').join('');$('trainingSelect').value=String(state.trainingIndex);
    $('horseSelect').innerHTML=HORSES.map(h=>'<option value="'+h.id+'" '+(h.unlockAt>state.career?'disabled':'')+'>'+h.name+(h.unlockAt>state.career?' · 入栏 '+h.unlockAt+' 次解锁':'')+'</option>').join('');$('horseSelect').value=state.horse.id;
    const h=state.horse;$('horseDetail').textContent=h.description+' · 速度 '+h.speed+' / 转向 '+h.turn+' / 耐力 '+h.stamina+' / 牵引 ×'+h.pull;
    const next=[...ROUNDS,...HORSES].filter(x=>x.unlockAt>state.career).sort((a,b)=>a.unlockAt-b.unlockAt)[0];$('careerProgress').textContent='累计入栏 '+state.career+' 次 · '+(next?'再完成 '+(next.unlockAt-state.career)+' 次解锁新伙伴':'所有牛与马已解锁');
  }
  $('horseSelect').addEventListener('change',()=>{if(!['ready','roundclear','ended'].includes(state.mode))return;const h=HORSES.find(h=>h.id===$('horseSelect').value&&h.unlockAt<=state.career);if(!h)return;state.horse=h;state.horseId=h.id;state.player.stamina=h.stamina;try{localStorage.setItem('wild-lasso-horse-v6',h.id);}catch(_){}refreshSelections();updateHud();});
  refreshSelections();

  function touchReset(){touchInput.x=0;touchInput.y=0;touchInput.spur=false;if(touchInput.action){touchInput.action=false;cancelCharge();}state.player.spurBurst=0;}
  const canTouch=()=>state.mode==='playing'&&!$('helpDialog').open&&!$('storyDialog').open&&!narrativeOpen();
  const touch={
    setEnabled(enabled){touchInput.enabled=Boolean(enabled);if(!enabled)touchReset();resize();},
    setMoveVector(x,y){if(!canTouch()){touchInput.x=touchInput.y=0;return;}const nx=Number(x)||0,ny=Number(y)||0,m=Math.max(1,Math.hypot(nx,ny));touchInput.x=nx/m;touchInput.y=ny/m;},
    setAim(clientX,clientY){if(canTouch()){updatePointer({clientX,clientY});updateAim();}},
    setAimWorld(x,y){if(canTouch()&&Number.isFinite(x)&&Number.isFinite(y)){pointer={x:clamp(x,0,W),y:clamp(y,0,H)};updateAim();}},
    beginAction(){if(!canTouch()||state.rope||state.charging||activePointer!==null||touchInput.action)return false;unlockAudio();touchInput.action=true;if(state.tether)state.reeling=true;else{state.charging=true;state.charge=0;updateAim();}return true;},
    endAction(options={}){if(!touchInput.action)return;touchInput.action=false;if(options.cancel||state.tether||!canTouch())cancelCharge();else throwLasso();},
    setSpur(held){const next=Boolean(held)&&canTouch();if(next&&!touchInput.spur)spur();touchInput.spur=next;},
    yank(){if(canTouch())yank();},release(){if(canTouch()){touchInput.action=false;releaseRope();}},gate(){if(canTouch())closeGate();},pause(){touchReset();if(state.mode==='paused')resume();else pause();},reset:touchReset,
    status(){const p=state.player,c=state.cows[0],t=state.tether;return {mode:state.mode,player:{x:p.x,y:p.y},cow:c?{id:c.id,x:c.x,y:c.y}:null,hasTether:Boolean(t),ropeFlying:Boolean(state.rope),charging:state.charging,charge:state.charge,grip:t?.grip||0,target:t?.target||0,zoneWidth:t?.zoneWidth||0,focus:t?.focus||0,inZone:Boolean(t?.inZone),yankCooldown:t?.yankCooldown||0,health:p.hp,stamina:p.stamina,maxStamina:state.horse.stamina,gateCanClose:state.pen.canClose,gateClosing:state.pen.closing,aim:{...state.aim},remaining:state.remaining,score:state.score,catches:state.catches};}
  };
  window.addEventListener('resize',resize);if(window.ResizeObserver)new window.ResizeObserver(resize).observe(canvas);window.WildLasso={snapshot:()=>JSON.parse(JSON.stringify(state)),touch,openStory,pause};selectGameMode('practice');resize();updateHud();window.RanchNarrative?.mount({onSelectChapter:showStory,onOpenStory:openStory});requestAnimationFrame(frame);
})();
