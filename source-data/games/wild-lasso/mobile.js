(function () {
  'use strict';
  const query=new URLSearchParams(window.location.search),forced=query.get('mobile')==='1';
  const coarse=window.matchMedia&&window.matchMedia('(pointer: coarse)').matches;
  if(query.get('mobile')==='0'||(!forced&&(query.get('desktop')==='1'||!coarse)))return;

  function mount() {
    const game=window.WildLasso,api=game&&game.touch,arena=document.getElementById('arena'),canvas=document.getElementById('game');
    if(!api||!arena||!canvas||document.getElementById('mobileControls'))return;
    document.body.classList.add('touch-mode');
    const root=document.createElement('section');root.id='mobileControls';root.className='mobile-controls';root.setAttribute('aria-label','双手触屏操作');
    root.innerHTML=`
      <div class="mobile-scoreboard" aria-label="比赛状态"><span>积分 <b id="mobileScore">0</b></span><span>入栏 <b id="mobileCatches">0</b></span><span id="mobileTime">训练</span><div class="mobile-vital"><span>生命 <b id="mobileHealth">100</b></span><i><em id="mobileHealthFill"></em></i></div><div class="mobile-vital"><span>马力 <b id="mobileStamina">100</b></span><i><em id="mobileStaminaFill"></em></i></div></div>
      <button id="mobilePause" class="mobile-small mobile-pause" type="button" aria-label="暂停游戏"><span aria-hidden="true">Ⅱ</span><small>暂停</small></button>
      <div id="mobileStick" class="mobile-stick" role="group" aria-label="移动摇杆，拖动骑马，推得越远跑得越快"><span class="mobile-stick-cross" aria-hidden="true"></span><span id="mobileKnob" class="mobile-knob" aria-hidden="true"></span><span class="mobile-stick-label">骑马</span></div>
      <button id="mobileSpur" class="mobile-small mobile-spur" type="button" aria-label="按住催马加速"><span aria-hidden="true">↗</span><strong>催马</strong><small>按住加速</small></button>
      <button id="mobileAimCow" class="mobile-small mobile-aim-cow" type="button" aria-label="瞄准当前这头牛"><span aria-hidden="true">⌖</span><strong>瞄牛</strong></button>
      <div id="mobileDuel" class="mobile-duel" hidden><div class="mobile-duel-track"><i id="mobileGrip"></i><b id="mobileTarget">◆</b></div><small>握力</small></div>
      <button id="mobileAction" class="mobile-action" type="button" aria-label="按住蓄力，拖动瞄准，松手投绳"><span id="mobileAimArrow" class="mobile-aim-arrow" aria-hidden="true">➤</span><strong id="mobileActionLabel">蓄力</strong><small id="mobileActionHint">按住 · 松手抛绳</small></button>
      <button id="mobileYank" class="mobile-small mobile-yank" type="button" disabled aria-label="猛拽，需要足够拉力且牛标在绿区"><strong>猛拽</strong><small id="mobileYankPower">0%</small></button>
      <button id="mobileRelease" class="mobile-small mobile-release" type="button" disabled aria-label="完全解开套索"><strong>放绳</strong></button>
      <button id="mobileGate" class="mobile-gate" type="button" disabled aria-label="站在栏外门闩旁关门"><span aria-hidden="true">▤</span><strong>关门</strong><small id="mobileGateHint">到栏外门闩旁</small></button>
      <p id="mobileTip" class="mobile-tip">左手骑马 · 右手蓄力，拖动瞄准</p>`;
    arena.appendChild(root);
    const rotate=document.createElement('aside');rotate.id='mobileRotate';rotate.className='mobile-rotate';rotate.setAttribute('role','status');rotate.innerHTML='<span aria-hidden="true">↻</span><div><strong>把手机横过来，上马开赛</strong><small>竖屏也可以选牛、换装和阅读来信。</small></div>';document.body.appendChild(rotate);
    const byId=id=>document.getElementById(id),els={};
    for(const id of['mobileStick','mobileKnob','mobileSpur','mobileAction','mobileActionLabel','mobileActionHint','mobileAimCow','mobileAimArrow','mobileYank','mobileYankPower','mobileRelease','mobileGate','mobileGateHint','mobilePause','mobileTip','mobileDuel','mobileGrip','mobileTarget','mobileScore','mobileCatches','mobileTime','mobileHealth','mobileHealthFill','mobileStamina','mobileStaminaFill'])els[id]=byId(id);
    const owners=new Map();let status=api.status(),lastMode='',lastCow=null,wasPlayable=false,manualAim=false,actionOrigin=null,lastPoll=-Infinity;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const portrait=()=>window.innerHeight>window.innerWidth;
    const modal=()=>!!document.querySelector('dialog[open]');
    const playable=()=>status.mode==='playing'&&!portrait()&&!modal();
    function consume(e){e.preventDefault();e.stopPropagation();}
    function capture(el,id){try{el.setPointerCapture(id);}catch(_){}}
    function uncapture(el,id){try{if(el.hasPointerCapture(id))el.releasePointerCapture(id);}catch(_){}}
    function reset() {
      const held=[...owners];owners.clear();actionOrigin=null;
      for(const[id,owner]of held){owner.el.classList.remove('is-held');uncapture(owner.el,id);}
      els.mobileKnob.style.transform='translate(0px,0px)';els.mobileStick.classList.remove('is-held');
      api.reset();
    }
    function own(el,role,e){
      if(!playable()||el.disabled||owners.has(e.pointerId)||[...owners.values()].some(o=>o.role===role))return false;
      consume(e);owners.set(e.pointerId,{el,role});capture(el,e.pointerId);el.classList.add('is-held');return true;
    }
    function finish(el,role,e,cancel) {
      const owner=owners.get(e.pointerId);if(!owner||owner.el!==el||owner.role!==role)return;
      consume(e);owners.delete(e.pointerId);el.classList.remove('is-held');
      if(role==='move'){api.setMoveVector(0,0);els.mobileKnob.style.transform='translate(0px,0px)';}
      if(role==='action'){actionOrigin=null;api.endAction({cancel:!!cancel});}
      if(role==='spur')api.setSpur(false);
      uncapture(el,e.pointerId);
    }
    function bindEnds(el,role){for(const name of['pointerup','pointercancel','lostpointercapture'])el.addEventListener(name,e=>finish(el,role,e,name!=='pointerup'),{passive:false});}
    function moveStick(e){
      const owner=owners.get(e.pointerId);if(!owner||owner.role!=='move')return;consume(e);
      const box=els.mobileStick.getBoundingClientRect(),radius=Math.min(box.width,box.height)*.34;
      let x=(e.clientX-box.left-box.width/2)/radius,y=(e.clientY-box.top-box.height/2)/radius,m=Math.hypot(x,y);
      if(m>1){x/=m;y/=m;m=1;}
      els.mobileKnob.style.transform=`translate(${(x*radius).toFixed(1)}px,${(y*radius).toFixed(1)}px)`;
      const gain=m>.13?(m-.13)/(.87*m):0;api.setMoveVector(x*gain,y*gain);
    }
    els.mobileStick.addEventListener('pointerdown',e=>{if(own(els.mobileStick,'move',e))moveStick(e);},{passive:false});
    els.mobileStick.addEventListener('pointermove',moveStick,{passive:false});bindEnds(els.mobileStick,'move');
    function aimCow(){status=api.status();if(status.cow){api.setAimWorld(status.cow.x,status.cow.y);manualAim=false;}}
    els.mobileAction.addEventListener('pointerdown',e=>{
      if(!own(els.mobileAction,'action',e))return;
      status=api.status();if(!status.hasTether&&!manualAim)aimCow();
      actionOrigin={id:e.pointerId,x:e.clientX,y:e.clientY};
      if(api.beginAction()===false){owners.delete(e.pointerId);actionOrigin=null;els.mobileAction.classList.remove('is-held');uncapture(els.mobileAction,e.pointerId);}
    },{passive:false});
    els.mobileAction.addEventListener('pointermove',e=>{
      if(!actionOrigin||actionOrigin.id!==e.pointerId)return;consume(e);
      status=api.status();if(status.hasTether)return;
      const dx=e.clientX-actionOrigin.x,dy=e.clientY-actionOrigin.y,d=Math.hypot(dx,dy);
      if(d>12){manualAim=true;api.setAimWorld(status.player.x+dx/d*500,status.player.y+dy/d*500);}
    },{passive:false});bindEnds(els.mobileAction,'action');
    els.mobileSpur.addEventListener('pointerdown',e=>{if(own(els.mobileSpur,'spur',e))api.setSpur(true);},{passive:false});bindEnds(els.mobileSpur,'spur');
    function once(el,role,fn){
      el.addEventListener('pointerdown',e=>{if(own(el,role,e))fn();},{passive:false});bindEnds(el,role);
      el.addEventListener('click',e=>{if(e.detail===0&&playable()&&!el.disabled){e.preventDefault();fn();}});
    }
    once(els.mobileAimCow,'aimCow',aimCow);once(els.mobileYank,'yank',()=>api.yank());
    once(els.mobileRelease,'release',()=>{for(const[id,o]of[...owners])if(o.role==='action'){owners.delete(id);o.el.classList.remove('is-held');uncapture(o.el,id);}actionOrigin=null;api.release();});
    once(els.mobileGate,'gate',()=>api.gate());once(els.mobilePause,'pause',()=>{reset();api.pause();});
    // Touching the arena sets an aim point only. The dedicated action thumb is
    // the sole owner of charging/reeling, so a second finger never throws early.
    canvas.addEventListener('pointerdown',e=>{
      if(!playable()||owners.has(e.pointerId))return;
      consume(e);e.stopImmediatePropagation();owners.set(e.pointerId,{el:canvas,role:'aim'});capture(canvas,e.pointerId);manualAim=true;api.setAim(e.clientX,e.clientY);
    },{capture:true,passive:false});
    canvas.addEventListener('pointermove',e=>{const o=owners.get(e.pointerId);if(o&&o.role==='aim'){consume(e);e.stopImmediatePropagation();api.setAim(e.clientX,e.clientY);}},{capture:true,passive:false});
    bindEnds(canvas,'aim');
    root.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('contextmenu',e=>e.preventDefault());
    root.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
    window.addEventListener('blur',reset);window.addEventListener('pagehide',reset);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
    window.addEventListener('resize',()=>{reset();refresh();});window.addEventListener('orientationchange',()=>{reset();refresh();});
    function refresh() {
      status=api.status();const isPortrait=portrait(),isModal=modal(),live=['playing','countdown','intermission'].includes(status.mode);
      document.body.classList.toggle('touch-portrait',isPortrait);document.body.classList.toggle('touch-live',live&&!isPortrait);
      rotate.hidden=!isPortrait;
      if(isPortrait&&['playing','countdown'].includes(status.mode)){reset();if(typeof game.pause==='function')game.pause();else api.pause();status=api.status();}
      const can=playable();if((wasPlayable&&!can)||(lastMode&&status.mode!==lastMode))reset();wasPlayable=can;lastMode=status.mode;
      const cowId=status.cow&&status.cow.id;if(cowId!==lastCow){lastCow=cowId;manualAim=false;}
      root.hidden=!can;root.setAttribute('aria-hidden',String(!can));
      const tether=status.hasTether,charge=clamp(status.charge||0,0,1),focus=clamp(status.focus||0,0,1);
      els.mobileAction.disabled=!can||(!tether&&status.ropeFlying);
      els.mobileAction.classList.toggle('is-tethered',tether);els.mobileAction.classList.toggle('is-sweet',tether?status.inZone:charge>=.62&&charge<=.88);
      els.mobileAction.style.setProperty('--action-power',`${Math.round((tether?focus:charge)*360)}deg`);
      els.mobileActionLabel.textContent=tether?'控绳':status.ropeFlying?'飞绳中':status.charging?`${Math.round(charge*100)}%`:'蓄力';
      els.mobileActionHint.textContent=tether?'按住升 · 松手降':status.charging?'拖动瞄准 · 松手抛':'按住瞄牛 · 松手抛';
      els.mobileAction.setAttribute('aria-label',tether?'按住使握力区上升，松开下降':'按住蓄力，拖动改变瞄准方向，松手投绳');
      els.mobileAimArrow.style.transform=`rotate(${status.aim&&status.aim.angle||0}rad)`;els.mobileAimArrow.hidden=tether;
      els.mobileAimCow.disabled=!can||tether;els.mobileRelease.disabled=!can||!tether;
      els.mobileYank.disabled=!can||!tether||focus<.55||!status.inZone||status.yankCooldown>0;
      els.mobileYank.classList.toggle('is-ready',!els.mobileYank.disabled);els.mobileYankPower.textContent=status.yankCooldown>0?'稍等':Math.round(focus*100)+'%';
      els.mobileGate.disabled=!can||!status.gateCanClose||status.gateClosing;
      els.mobileGate.classList.toggle('is-ready',!els.mobileGate.disabled);els.mobileGateHint.textContent=status.gateClosing?'守住门闩，关门中':status.gateCanClose?'现在可以关门':'到栏外门闩旁';
      // Keep a held spur button receptive to pointerup even at zero stamina.
      // Disabling a captured HTML button mid-touch can swallow its release.
      els.mobileSpur.disabled=!can;els.mobileSpur.classList.toggle('is-empty',status.stamina<=0);
      els.mobileDuel.hidden=!tether;els.mobileDuel.classList.toggle('matched',!!status.inZone);
      els.mobileGrip.style.bottom=clamp(status.grip||0,0,1)*100+'%';els.mobileGrip.style.height=clamp(status.zoneWidth||.3,0,1)*100+'%';els.mobileTarget.style.bottom=clamp(status.target||0,0,1)*100+'%';
      els.mobileTip.textContent=status.gateClosing?'守在栏外门闩旁，等门关好':status.gateCanClose?'牛已进栏，点「关门」':tether?(els.mobileYank.disabled?'按住/松手跟住牛标，攒力到 55%':'拉力就绪！点「猛拽」'):'摇杆骑马 · 右手蓄力，拖动瞄准';
      els.mobileScore.textContent=status.score||0;els.mobileCatches.textContent=status.catches||0;
      const seconds=Math.max(0,Math.ceil(status.remaining||0));els.mobileTime.textContent=document.getElementById('timer')?.textContent==='∞'?'自由训练':`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
      els.mobileHealth.textContent=Math.ceil(status.health||0);els.mobileStamina.textContent=Math.round(status.stamina||0);
      els.mobileHealthFill.style.width=clamp(status.health||0,0,100)+'%';els.mobileStaminaFill.style.width=clamp((status.stamina||0)/(status.maxStamina||100)*100,0,100)+'%';
      els.mobileHealthFill.classList.toggle('is-low',status.health<=30);
    }
    api.setEnabled(true);refresh();
    function loop(now){if(now-lastPoll>=75){lastPoll=now;refresh();}window.requestAnimationFrame(loop);}window.requestAnimationFrame(loop);
    window.RanchMobile={enabled:true,reset,refresh};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
