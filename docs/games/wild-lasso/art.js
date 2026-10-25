(function () {
  'use strict';

  const W = 1400, H = 820;
  const ink = '#59483b';
  let background;

  function shade(color,amount) {
    const match=/^#([0-9a-f]{6})$/i.exec(color||'');if(!match)return color;
    const value=parseInt(match[1],16),target=amount<0?0:255,mix=Math.min(1,Math.abs(amount));
    const channel=shift=>Math.round(((value>>shift)&255)*(1-mix)+target*mix).toString(16).padStart(2,'0');
    return '#'+channel(16)+channel(8)+channel(0);
  }

  function path(c, points, fill, stroke, width) {
    c.beginPath();
    points.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width || 1; c.stroke(); }
  }

  function ellipse(c, x, y, rx, ry, color, rotation) {
    c.beginPath(); c.ellipse(x, y, rx, ry, rotation || 0, 0, Math.PI * 2);
    c.fillStyle = color; c.fill();
  }

  function round(c, x, y, w, h, r, fill, stroke, lw) {
    c.beginPath(); c.roundRect(x, y, w, h, r);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.stroke(); }
  }

  function line(c, points, color, width) {
    c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
    c.strokeStyle = color; c.lineWidth = width || 1; c.stroke();
  }

  function rng(seed) {
    return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }

  function grass(c, x, y, s, tilt) {
    c.save(); c.translate(x, y); c.rotate(tilt || 0); c.lineCap = 'round';
    line(c, [[-6*s, 0], [-9*s, -6*s]], '#baa077', 1.3*s);
    line(c, [[-2*s, 1*s], [-3*s, -10*s]], '#bca57a', 1.3*s);
    line(c, [[2*s, 0], [5*s, -8*s]], '#c4ad82', 1.3*s);
    line(c, [[5*s, 1*s], [10*s, -3*s]], '#bca57a', 1.3*s);
    c.restore();
  }

  function cactus(c, x, y, s, flip) {
    c.save(); c.translate(x, y); c.scale(s * (flip ? -1 : 1), s);
    ellipse(c, 6, 7, 28, 8, 'rgba(120,99,66,.12)');
    c.lineCap = 'round'; c.lineJoin = 'round';
    line(c, [[0, 3], [0, -57]], '#6d8d6d', 18);
    line(c, [[-2, -18], [-23, -20], [-23, -40]], '#779373', 13);
    line(c, [[4, -34], [24, -34], [24, -53]], '#6d8d6d', 12);
    line(c, [[-3, 1], [-3, -58]], '#94a281', 3);
    line(c, [[-24, -25], [-24, -41]], '#9baa85', 2);
    line(c, [[22, -38], [22, -53]], '#93a17e', 2);
    for (let i = 0; i < 5; i++) line(c, [[4, -9-i*9], [7, -12-i*9]], '#53795d', 1);
    ellipse(c, 1, -67, 4, 3, '#dc9474'); ellipse(c, 5, -65, 3, 3, '#ecab85');
    grass(c, -12, 7, .8); c.restore();
  }

  function rock(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    ellipse(c, 3, 5, 17, 5, 'rgba(125,103,77,.10)');
    path(c, [[-17, 2], [-10, -10], [2, -14], [14, -7], [18, 3], [4, 7]], '#b9aa91');
    path(c, [[-10,-10], [2,-14], [14,-7], [1,-3]], '#cbbca3');
    line(c, [[1,-3], [4,7]], '#ad9c82', 1.5); c.restore();
  }

  function fencePost(c, x, y) {
    ellipse(c, x+6, y+9, 12, 4, 'rgba(112,83,49,.12)');
    path(c, [[x-5,y+8],[x-6,y-20],[x-1,y-25],[x+6,y-21],[x+6,y+8]], '#a77c53');
    path(c, [[x-5,y-20],[x-1,y-25],[x+6,y-21],[x+2,y-17]], '#c59b6b');
    line(c, [[x+2,y-17],[x+3,y+6]], '#8f6846', 1.3);
    ellipse(c, x-1, y-8, 1.3, 1.3, '#71573e');
  }

  function fenceHorizontal(c, x1, x2, y, spacing) {
    let n = Math.ceil((x2-x1)/(spacing || 87));
    c.save(); c.lineJoin = 'round';
    for (let i=0; i<n; i++) {
      const a=x1+(x2-x1)*i/n, b=x1+(x2-x1)*(i+1)/n;
      line(c, [[a,y-10],[b,y-12]], '#9d754f', 8);
      line(c, [[a,y-11],[b,y-13]], '#c39a69', 3);
      line(c, [[a,y+1],[b,y-1]], '#a77d51', 7);
      line(c, [[a,y],[b,y-2]], '#cba575', 2);
    }
    for (let i=0; i<=n; i++) fencePost(c, x1+(x2-x1)*i/n, y);
    c.restore();
  }

  function fenceVertical(c, x, y1, y2) {
    let n=Math.ceil((y2-y1)/87);
    c.save(); c.lineJoin='round';
    line(c, [[x-2,y1-9],[x-2,y2-9]], '#b68e5d', 7);
    line(c, [[x+3,y1+1],[x+3,y2+1]], '#b38a59', 6);
    line(c, [[x-3,y1-9],[x-3,y2-9]], '#cfaf7b', 2);
    for(let i=0;i<=n;i++) fencePost(c,x,y1+(y2-y1)*i/n);
    c.restore();
  }

  function trough(c, x, y) {
    c.save(); c.translate(x,y);
    ellipse(c,5,17,48,11,'rgba(120,99,66,.13)');
    path(c,[[-44,-10],[43,-10],[37,19],[-38,19]],'#84999a','#667e80',2);
    path(c,[[-44,-10],[-37,-18],[37,-18],[44,-10],[37,2],[-37,2]],'#b6c2b8','#718b8c',2);
    path(c,[[-37,-10],[-32,-14],[32,-14],[37,-10],[31,-3],[-31,-3]],'#91b7b6');
    line(c,[[-22,-9],[8,-9]],'#c5d7cc',2);
    line(c,[[17,-6],[29,-6]],'#c5d7cc',1.4);
    for(let i=-24;i<=24;i+=24) line(c,[[i,4],[i,17]],'#667e80',2);
    line(c,[[-37,4],[36,4]],'#b1bbb1',1.5); c.restore();
  }

  function hay(c, x, y, s) {
    c.save(); c.translate(x,y); c.scale(s,s);
    ellipse(c,4,13,30,8,'rgba(120,99,66,.12)');
    round(c,-29,-17,57,34,8,'#c9a25c');
    path(c,[[-29,-10],[-22,-23],[25,-23],[28,-16],[-22,-15]],'#e0bc75');
    line(c,[[-15,-21],[-15,15]],'#9e7c43',3); line(c,[[14,-21],[14,15]],'#9e7c43',3);
    for(let i=0;i<5;i++) line(c,[[-25,-10+i*5],[24,-12+i*5]],'#ddba72',1);
    c.restore();
  }

  function makeBackground() {
    const canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H;
    const c=canvas.getContext('2d'); const random=rng(1062);
    c.lineCap='round'; c.lineJoin='round';
    c.fillStyle='#e8d2ac'; c.fillRect(0,0,W,H);
    const base=c.createLinearGradient(0,0,W,H);
    base.addColorStop(0,'#ecd8b6'); base.addColorStop(.55,'#f1e0c2'); base.addColorStop(1,'#ead2a9');
    round(c,28,42,W-56,H-67,100,base);
    c.beginPath(); c.moveTo(105,126); c.bezierCurveTo(375,65,1025,90,1290,120);
    c.bezierCurveTo(1335,305,1330,565,1290,730); c.bezierCurveTo(985,775,355,772,106,730);
    c.bezierCurveTo(67,500,69,297,105,126); c.closePath(); c.fillStyle='#f1e0bf'; c.fill();
    const glow=c.createRadialGradient(680,350,0,680,350,680);
    glow.addColorStop(0,'rgba(255,247,225,.25)'); glow.addColorStop(1,'rgba(255,247,225,0)');
    c.fillStyle=glow; c.fillRect(0,0,W,H);

    // Quiet, fixed paper-grain texture: no flicker as the camera redraws.
    for(let i=0;i<4200;i++) {
      const x=random()*W,y=random()*H;
      c.fillStyle=random()>.45?'rgba(126,96,60,.065)':'rgba(255,251,225,.26)';
      const size=.55+random()*1.5; c.fillRect(x,y,size,size*.65);
    }
    for(let i=0;i<68;i++) {
      const x=93+random()*1214,y=115+random()*625;
      const v=random();
      if(v<.28) grass(c,x,y,.35+random()*.28,(random()-.5)*.8);
      else {
        c.strokeStyle='rgba(175,142,94,.12)'; c.lineWidth=1;
        c.beginPath(); c.ellipse(x,y,5+random()*18,1+random()*2,random()*.2,0,Math.PI); c.stroke();
      }
    }
    // Weathered perimeter, with an open gate in the middle.
    fenceHorizontal(c,54,626,88); fenceHorizontal(c,774,1347,88);
    fenceVertical(c,54,88,774); fenceVertical(c,1347,88,774);
    fenceHorizontal(c,54,1347,785,92);
    line(c,[[628,72],[628,25]],'#9b714a',10); line(c,[[772,72],[772,25]],'#9b714a',10);
    path(c,[[618,24],[783,22],[780,60],[620,62]],'#a27850','#896442',2);
    line(c,[[626,28],[774,27]],'#c69c6c',2);
    c.font='700 16px Georgia, serif'; c.textAlign='center'; c.fillStyle='#f5e3b9';
    c.fillText('DUSTY CREEK',700,49);
    ellipse(c,628,34,2,2,'#735539'); ellipse(c,772,34,2,2,'#735539');

    cactus(c,23,201,.73,false); cactus(c,1377,337,.88,true);
    cactus(c,1374,717,.62,false); cactus(c,26,664,.76,true);
    cactus(c,1155,44,.58,false); cactus(c,214,43,.5,true);
    rock(c,22,267,.7); rock(c,1378,389,.65); rock(c,23,713,.48);
    rock(c,111,800,.54); rock(c,1325,38,.72);
    trough(c,161,47); hay(c,1250,42,.76); hay(c,1290,804,.8);
    for(const p of [[31,363,.7],[1365,491,.8],[32,755,.6],[296,40,.7],[1077,38,.5],[1144,800,.7],[123,800,.7],[1368,177,.6]]) grass(c,...p);
    // A tiny sun-bleached skull and an old horseshoe at the edges of the ranch.
    c.save(); c.translate(318,790); c.rotate(-.2);
    path(c,[[-8,-8],[7,-8],[10,-1],[4,8],[-4,8],[-10,0]],'#f7e9cc','#c8b38e',1);
    line(c,[[-6,-5],[-16,-9],[-20,-16]],'#f7e9cc',4);
    line(c,[[6,-5],[16,-9],[20,-16]],'#f7e9cc',4);
    ellipse(c,-4,-1,2,2,'#a99372'); ellipse(c,4,-1,2,2,'#a99372'); c.restore();
    c.save(); c.translate(1024,49); c.rotate(.5); c.beginPath(); c.arc(0,0,9,.15,Math.PI-.15);
    c.strokeStyle='#9b8d72'; c.lineWidth=4; c.stroke(); c.restore();
    return canvas;
  }

  function deliveryPen(c, state) {
    const p=state.pen || {x:555,y:300,w:260,h:220,progress:0,active:true};
    const active=!p.closed;
    const inside=penHasCow(state,p);
    const progress=Math.max(0,Math.min(1,p.gateProgress || 0));
    c.save();
    round(c,p.x+5,p.y+1,p.w-8,p.h-3,18,active?'rgba(174,198,136,.24)':'rgba(166,180,130,.09)');
    const inset=24;
    c.beginPath(); c.roundRect(p.x+inset,p.y+inset,p.w-inset*2,p.h-inset*2,13);
    c.setLineDash([7,7]); c.lineWidth=2;
    c.strokeStyle=active?'rgba(113,149,86,.68)':'rgba(130,151,99,.34)'; c.stroke(); c.setLineDash([]);
    if(active && progress>0) {
      c.save(); c.globalAlpha=.14;
      round(c,p.x+inset,p.y+inset+(p.h-inset*2)*(1-progress),p.w-inset*2,(p.h-inset*2)*progress,10,'#92b66b');
      c.restore();
    }
    // Three fixed sides and one hinged gate frame the east entrance.
    fenceHorizontal(c,p.x,p.x+p.w,p.y,79);
    fenceHorizontal(c,p.x,p.x+p.w,p.y+p.h,79);
    fenceVertical(c,p.x,p.y,p.y+p.h);
    deliveryGate(c,p);
    c.textAlign='center'; c.textBaseline='middle';
    c.font='700 17px "Microsoft YaHei", sans-serif';
    c.fillStyle=active?'#6c8c50':'#929975'; c.fillText('交牛区',p.x+p.w*.5,p.y+49);
    const status=p.closed?'已关门':p.closing?'正在关门':p.canClose?'按 E 扳动门闩':inside?'到右上方门闩关门':'赶牛 / 牵牛入栏';
    const statusBelow=inside||p.closing||p.closed;
    if(statusBelow)round(c,p.x+p.w*.5-88,p.y+p.h+17,176,25,10,'rgba(250,239,213,.94)','rgba(174,144,94,.24)',1);
    c.font='600 11px "Microsoft YaHei", sans-serif';
    c.fillStyle=p.canClose?'#ad7b38':active?'#8b9b6d':'#a4a17d'; c.fillText(status,p.x+p.w*.5,statusBelow?p.y+p.h+30:p.y+70);
    if(!p.closing && !p.closed) {
      c.globalAlpha=active?.75:.3;
      const pulse=active?Math.sin((state.time || 0)*3)*3:0;
      for(let i=0;i<2;i++) line(c,[[p.x+p.w-5-i*13+pulse,p.y+p.h*.5-7],[p.x+p.w-12-i*13+pulse,p.y+p.h*.5],[p.x+p.w-5-i*13+pulse,p.y+p.h*.5+7]],'#79935e',2.5);
    }
    c.restore();
    drawLatch(c,state,p);
  }

  function penHasCow(state,p) {
    return (state.cows||[]).some(a=>{const r=23*cowScale(a);return !a.delivered&&a.x>=p.x+r&&a.x<=p.x+p.w-r&&a.y>=p.y+r&&a.y<=p.y+p.h-r;});
  }

  function latchPosition(p) {
    return p.latch&&Number.isFinite(p.latch.x)&&Number.isFinite(p.latch.y)?p.latch:{x:p.x+p.w+54,y:p.y+32};
  }

  function drawLatch(c,state,p) {
    const latch=latchPosition(p),inside=penHasCow(state,p),ready=!!p.canClose;
    c.save();
    if(inside&&!p.closed&&!p.closing) {
      c.globalAlpha=.23;c.beginPath();c.ellipse(latch.x,latch.y+3,34,23,0,0,Math.PI*2);c.fillStyle=ready?'#b5ba6c':'#d7b976';c.fill();
      c.setLineDash([3,6]);c.strokeStyle=ready?'#8a9751':'#b78b4a';c.lineWidth=1.5;c.stroke();c.setLineDash([]);c.globalAlpha=1;
    }
    // This fixed outside lever is the interaction point, separate from the
    // moving latch bar on the gate itself.
    line(c,[[p.x+p.w+4,p.y+4],[latch.x-3,latch.y-8]],'#b7a174',2);
    ellipse(c,latch.x+4,latch.y+9,16,6,'rgba(114,88,48,.14)');
    round(c,latch.x-6,latch.y-25,12,35,3,'#a0774e','#805e3e',1.2);
    line(c,[[latch.x-3,latch.y-22],[latch.x-3,latch.y+6]],'#c9a06a',2);
    round(c,latch.x-10,latch.y-13,20,12,3,'#c7a35d','#99763d',1.3);
    const angle=p.closed?.7:p.closing?.7*(p.gateProgress||0):-.55;
    c.save();c.translate(latch.x,latch.y-7);c.rotate(angle);
    line(c,[[0,0],[16,0]],'#8a6838',5);line(c,[[0,-1],[15,-1]],'#dfc27f',2);
    ellipse(c,17,0,4.5,4.5,p.closed?'#7f9660':'#dab769');c.restore();
    ellipse(c,latch.x,latch.y-7,3,3,'#f0d496');
    c.textAlign='center';c.textBaseline='middle';c.font='600 10px "Microsoft YaHei",sans-serif';c.fillStyle='#997b4e';c.fillText('门闩',latch.x,latch.y+23);
    if(ready&&!p.closing&&!p.closed) {
      round(c,latch.x+28,latch.y-18,25,27,6,'#fbefd2','#b88e4b',1.5);
      c.font='800 15px "Trebuchet MS",sans-serif';c.fillStyle='#99672d';c.fillText('E',latch.x+40.5,latch.y-5);
    }
    c.restore();
  }

  function rodeoStands(c,state) {
    const value=Number(state.excitement)||0, energy=Math.max(0,Math.min(1,value>1?value/100:value));
    const time=state.time||0, live=state.gameMode==='challenge';
    c.save();
    for(const x of [300,805]) {
      round(c,x-12,6,300,61,5,'#ba9367');
      for(const y of [24,47,65]) {
        line(c,[[x-10,y],[x+287,y]],'#936e48',6);
        line(c,[[x-10,y-2],[x+287,y-2]],'#d6b286',2);
      }
      for(let row=0;row<2;row++)for(let i=0;i<15;i++) {
        const n=i+row*15+(x===805?30:0),px=x+i*19,py=20+row*25;
        const wave=Math.sin(time*(3+energy*5)+n*1.7),cheer=live&&(energy>.25||n%6===0);
        const shirt=['#b96c4d','#6d9090','#d0b06f','#8f9c70','#e4ceb0'][n%5];
        const skin=['#d7a67a','#bd8864','#e1bc92','#a97152'][n%4];
        c.save();c.translate(px,py-(cheer?Math.max(0,wave)*energy*2:0));
        line(c,[[-5,8],[-9,cheer?-3-wave*5:9]],shirt,3.5);
        line(c,[[5,8],[9,cheer?-3+wave*5:9]],shirt,3.5);
        round(c,-5,5,10,11,3,shirt);ellipse(c,0,0,4,4.6,skin);
        if(n%3!==1){ellipse(c,0,-3,7,2,'#b58a55');round(c,-4,-7,8,5,2,'#caa16b');}
        else ellipse(c,0,-3,4.4,2.6,'#6b4d3a');
        c.restore();
      }
    }
    // Red, cream and sage bunting sways above the timber grandstands.
    for(const x of [283,792]) {
      line(c,[[x,3],[x+318,3]],'#9a805c',1.5);
      for(let i=0;i<18;i++) {
        const px=x+i*18,shift=Math.sin(time*2+i)*1.7;
        path(c,[[px,3],[px+12,3],[px+6+shift,15]],['#bb6b4b','#f7e9c6','#789783'][i%3]);
      }
    }
    path(c,[[640,65],[760,65],[754,84],[646,84]],'#b56b4c','#9b5c40',1);
    c.font='700 10px Georgia,serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#f4e4bd';c.fillText('RODEO ARENA',700,75);
    // A separate timber chute makes the right-hand release side unmistakable.
    round(c,1328,348,65,116,5,'rgba(139,101,62,.13)');
    for(const y of [355,408,462])line(c,[[1330,y],[1396,y]],'#9e754f',7);
    for(const x of [1335,1390])line(c,[[x,337],[x,473]],'#a07850',10);
    for(let i=0;i<5;i++)line(c,[[1343+i*10,360],[1343+i*10,458]],'#c39c68',5);
    round(c,1322,325,75,24,4,'#a5794d','#87603d',1);
    c.font='700 10px "Microsoft YaHei",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#f4e3bd';c.fillText('放牛闸门',1359,337);
    if(state.eventLabel) {
      c.font='700 11px "Microsoft YaHei",sans-serif';
      const width=Math.min(340,c.measureText(state.eventLabel).width+32);
      round(c,700-width/2,88,width,25,12,'rgba(248,236,210,.9)','rgba(151,115,74,.22)',1);
      c.fillStyle='#977046';c.fillText(state.eventLabel,700,101);
    }
    c.restore();
  }

  function throwerWarning(c,state) {
    for(const a of state.cows||[]) {
      if(a.attack!=='stoneWindup'||!a.throwTarget)continue;
      const target=a.throwTarget,locked=!!a.targetLocked,pulse=locked?.85+Math.sin((state.time||0)*14)*.13:.52+Math.sin((state.time||0)*5)*.1;
      c.save();c.globalAlpha=pulse;
      const color=locked?'#bd573e':'#bf985a';
      ellipse(c,target.x,target.y,43,29,locked?'rgba(191,88,58,.16)':'rgba(191,148,78,.08)');
      c.beginPath();c.ellipse(target.x,target.y,43,29,0,0,Math.PI*2);c.setLineDash(locked?[]:[5,7]);c.strokeStyle=color;c.lineWidth=locked?2.7:1.7;c.stroke();c.setLineDash([]);
      if(locked) {
        line(c,[[target.x-10,target.y-7],[target.x+10,target.y+7]],color,2.5);line(c,[[target.x-10,target.y+7],[target.x+10,target.y-7]],color,2.5);
        for(const side of[-1,1])line(c,[[target.x+side*49,target.y-5],[target.x+side*44,target.y],[target.x+side*49,target.y+5]],color,1.7);
      }else {
        line(c,[[target.x-6,target.y],[target.x+6,target.y]],color,1.5);line(c,[[target.x,target.y-4],[target.x,target.y+4]],color,1.5);
      }
      c.font='600 10px "Microsoft YaHei",sans-serif';c.textAlign='center';c.fillStyle=color;c.fillText(locked?'落点已锁定':'落点跟踪中',target.x,target.y+44);
      c.globalAlpha=.3;c.setLineDash([3,9]);c.beginPath();c.moveTo(a.x,a.y-58);c.quadraticCurveTo((a.x+target.x)/2,(a.y+target.y)/2-120,target.x,target.y);c.lineWidth=1.5;c.stroke();c.setLineDash([]);
      c.restore();
    }
  }

  function standingCow(c,a,time) {
    const s=cowScale(a),coat=a.coat||'#e7dfc9',patch=a.patch||'#5c6350';
    const windup=a.attack==='stoneWindup', lift=Math.max(.1,Math.min(1,Number(a.standing)||1));
    c.save();c.translate(a.x,a.y);c.scale(s,s);
    ellipse(c,2,11,31,13,'rgba(101,75,44,.18)');
    const shake=windup?Math.sin(time*9)*1.5:0;c.translate(shake,-lift*5);
    line(c,[[-13,-13],[-17,5]],coat,12);line(c,[[13,-13],[18,5]],coat,12);
    round(c,-25,2,17,10,4,'#675345');round(c,10,2,17,10,4,'#675345');
    c.beginPath();c.moveTo(-22,-15);c.quadraticCurveTo(-30,-44,-20,-67);c.quadraticCurveTo(0,-76,21,-66);c.quadraticCurveTo(32,-44,24,-15);c.closePath();c.fillStyle=coat;c.fill();c.strokeStyle='#c5bba1';c.lineWidth=1.5;c.stroke();
    ellipse(c,-16,-42,10,18,patch,-.2);ellipse(c,15,-24,9,10,patch,.2);
    // Raised forelegs become expressive arms, with the stone carried in one hoof.
    line(c,[[-21,-60],[-35,-46],[-31,-30]],coat,12);round(c,-37,-34,11,10,3,'#675345');
    const handY=windup?-96:-58;
    line(c,[[21,-61],[36,-76],[44,handY]],coat,12);round(c,39,handY-6,12,11,3,'#675345');
    const horns=Math.max(.6,Math.min(1.7,a.hornScale||1));
    for(const side of [-1,1]) {
      c.beginPath();c.moveTo(side*18,-83);c.quadraticCurveTo(side*(27+horns*8),-84,side*(26+horns*9),-102);c.quadraticCurveTo(side*24,-94,side*13,-92);c.closePath();c.fillStyle='#eddbb4';c.fill();c.strokeStyle='#baa77f';c.lineWidth=1;c.stroke();
    }
    ellipse(c,-23,-80,10,5,patch,-.25);ellipse(c,23,-80,10,5,patch,.25);
    round(c,-22,-100,44,37,12,coat,'#c3b69a',1.5);
    path(c,[[-20,-96],[-4,-100],[3,-88],[-8,-78],[-20,-81]],patch);
    ellipse(c,-11,-83,2.4,3,'#3c382e');ellipse(c,11,-83,2.4,3,'#3c382e');
    line(c,[[-16,-89],[-6,-87]],'#65533f',2);line(c,[[6,-87],[16,-89]],'#65533f',2);
    round(c,-19,-76,38,21,9,'#cfab91');ellipse(c,-10,-69,2,1.5,'#96735f');ellipse(c,10,-69,2,1.5,'#96735f');
    if(windup){ellipse(c,0,-61,5,3+Math.sin(time*17),'#795545');}
    // A tiny circuit badge gives this deliberately unusual competitor its identity.
    round(c,-10,-53,20,17,3,'#688a76','#526e5e',1);round(c,-5,-49,10,9,1,'#b8b982');
    for(let i=0;i<4;i++){line(c,[[-13,-50+i*4],[-10,-50+i*4]],'#d2bf83',1.5);line(c,[[10,-50+i*4],[13,-50+i*4]],'#d2bf83',1.5);}
    if(windup) {
      path(c,[[32,handY-10],[37,handY-25],[52,handY-28],[62,handY-16],[58,handY-5],[43,handY-1]],'#9c9482','#827b6c',1.3);
      path(c,[[37,handY-25],[52,handY-28],[62,handY-16],[46,handY-12]],'#bbb09b');
    }
    c.restore();
    c.save();c.textAlign='center';c.textBaseline='middle';
    if(windup) {
      const width=210,x=Math.max(12,Math.min(W-width-12,a.x-width*.5)),y=Math.max(8,a.y-150*s),center=x+width*.5;
      path(c,[[center-6,y+30],[center,y+42],[center+10,y+30]],'#fbedd1','#d5b781',1);
      round(c,x,y,width,34,11,'#fbedd1','#c99b5f',1.7);
      c.font='800 16px "Microsoft YaHei",sans-serif';c.fillStyle='#965f33';c.fillText('牛来，半导体跌了',center,y+17);
    }else{
      c.font='700 12px "Microsoft YaHei",sans-serif';c.fillStyle='#7a7353';c.fillText(a.nickname||'半导体牛',a.x,a.y-112*s);
    }
    c.restore();
  }

  function airborneStones(c,state) {
    for(const p of state.projectiles||[]) {
      const r=Math.max(7,Math.min(27,p.radius||16)),z=Math.max(0,p.z||0),x=p.x,y=p.y;
      c.save();c.globalAlpha=.17;ellipse(c,Number.isFinite(p.shadowX)?p.shadowX:x,Number.isFinite(p.shadowY)?p.shadowY:y,r*(1+z/230),r*.43,'#6e583b');c.restore();
      c.save();c.translate(x,y-z);c.rotate((state.time||0)*4+(Number(p.id)||0));
      path(c,[[-r,-r*.3],[-r*.5,-r],[r*.45,-r*.85],[r,r*.1],[r*.5,r*.8],[-r*.5,r]],'#9a9383','#7c7669',1.5);
      path(c,[[-r*.5,-r],[r*.45,-r*.85],[r,r*.1],[-r*.12,-r*.02]],'#c2b6a1');
      line(c,[[-r*.12,-r*.02],[-r*.5,r]],'#817c6e',1.5);c.restore();
    }
  }

  function arenaAnnouncement(c,state) {
    const a=state.announcement,count=Number(state.countdown)||0;
    c.save();c.textAlign='center';c.textBaseline='middle';
    if(count>0) {
      const value=Math.ceil(count),pulse=1+(count%1)*.08;
      c.translate(700,230);c.scale(pulse,pulse);
      ellipse(c,0,0,57,57,'rgba(249,235,202,.92)');c.beginPath();c.arc(0,0,57,0,Math.PI*2);c.strokeStyle='#b78344';c.lineWidth=2;c.stroke();
      c.font='900 66px Georgia,serif';c.fillStyle='#9b6237';c.fillText(String(Math.min(3,value)),0,-2);
      c.font='700 13px "Microsoft YaHei",sans-serif';c.fillStyle='#98764c';c.fillText('准备出闸',0,80);
    } else if(a&&a.life>0) {
      c.globalAlpha=Math.min(1,a.life*2);
      c.font='800 28px "Microsoft YaHei",sans-serif';const width=Math.max(270,Math.min(620,c.measureText(a.text||'').width+70));
      round(c,700-width/2,147,width,a.sub?81:59,15,'rgba(250,239,214,.94)','rgba(174,129,72,.38)',1.5);
      c.fillStyle='#8e6038';c.fillText(a.text||'',700,177);
      if(a.sub){c.font='500 13px "Microsoft YaHei",sans-serif';c.fillStyle='#a08762';c.fillText(a.sub,700,209);}
    }
    c.restore();
  }

  function deliveryGate(c, p) {
    const progress=p.closed?1:Math.max(0,Math.min(1,p.gateProgress || 0));
    const ease=progress*progress*(3-2*progress);
    const angle=ease*Math.PI*.5, length=p.h;
    c.save(); c.translate(p.x+p.w,p.y);
    // The whole timber frame swings clockwise around this brass hinge.
    c.save(); c.translate(5,8); c.rotate(angle);
    line(c,[[0,0],[length,0]],'rgba(100,76,45,.13)',24); c.restore();
    c.rotate(angle);
    for(const y of [-10,9]) {
      round(c,-4,y-4.5,length+9,9,2,'#a87244','#8e5d37',1);
      line(c,[[1,y-2],[length-2,y-2]],'#d3a365',2);
      line(c,[[18,y+2],[length-14,y+2]],'#93633d',1);
    }
    line(c,[[7,8],[length-8,-9]],'#ba8951',6);
    line(c,[[8,6],[length-9,-11]],'#d5aa70',1.5);
    for(let i=0;i<=3;i++) {
      const x=length*i/3;
      round(c,x-4,-17,8,34,2,'#a16c40','#8b5b37',1);
      line(c,[[x-2,-14],[x-2,13]],'#c89860',1.5);
      ellipse(c,x,-10,1.6,1.6,'#775035'); ellipse(c,x,9,1.6,1.6,'#775035');
    }
    round(c,-6,-13,12,7,2,'#d2ad63','#aa853e',1);
    round(c,-6,5,12,7,2,'#d2ad63','#aa853e',1);
    round(c,length-10,-5,20,9,2,'#c8a34f','#9b7939',1.2);
    ellipse(c,length+5,-.5,2,2,'#eed38e');
    c.restore();
    // A fixed latch receiver makes the closed position easy to read.
    round(c,p.x+p.w-6,p.y+p.h-6,12,11,2,'#b68c45','#99763e',1);
    if(p.closed) {
      line(c,[[p.x+p.w-5,p.y+p.h-1],[p.x+p.w+6,p.y+p.h-1]],'#e1bc6a',3);
    }
  }

  function cattleTelegraphs(c, state) {
    for(const a of state.cows || []) {
      if(a.attack!=='windup') continue;
      const angle=Number.isFinite(a.attackAngle)?a.attackAngle:a.angle || 0;
      const length=(a.attackRange || 440*.88)+32+22*(a.scale || 1);
      const pulse=.72+Math.sin((state.time || 0)*12)*.23;
      c.save(); c.translate(a.x,a.y); c.rotate(angle);
      c.globalAlpha=.15*pulse;
      path(c,[[15,-16],[length-22,-16],[length-22,-30],[length,0],[length-22,30],[length-22,16],[15,16]],'#be5e40');
      c.globalAlpha=.6*pulse; c.setLineDash([8,8]);
      line(c,[[33,0],[length-18,0]],'#bf6649',2); c.setLineDash([]);
      line(c,[[length-22,-10],[length-10,0],[length-22,10]],'#bf6649',2.5);
      c.restore();
    }
  }

  function cowPressureHints(c,state) {
    const player=state.player,time=state.time||0;
    for(const a of state.cows||[]) {
      if(a.delivered)continue;
      const s=cowScale(a),stage=a.skillStage||'idle';
      c.save();c.lineCap='round';
      if(stage==='cue'||stage==='burst') {
        const pulse=.25+.15*Math.sin(time*(stage==='burst'?17:9));
        c.globalAlpha=pulse;c.beginPath();c.ellipse(a.x,a.y+6,49*s,33*s,0,0,Math.PI*2);
        c.strokeStyle=stage==='cue'?'#c5994f':'#ba664a';c.lineWidth=stage==='cue'?3:4;c.stroke();
        if(stage==='burst')for(let i=0;i<4;i++){const theta=i*Math.PI/2;line(c,[[a.x+Math.cos(theta)*54*s,a.y+6+Math.sin(theta)*37*s],[a.x+Math.cos(theta)*61*s,a.y+6+Math.sin(theta)*42*s]],'#b46d4c',2);}
      }
      const pressure=Math.max(0,Math.min(1,a.pressure||0));
      if(player&&!state.tether&&pressure>.035&&Math.hypot(a.x-player.x,a.y-player.y)<270) {
        const away=Math.atan2(a.y-player.y,a.x-player.x),near=away+Math.PI,color=pressure>.72?'#bd7855':'#b9a06d';
        c.globalAlpha=.25+pressure*.33;
        c.beginPath();c.ellipse(a.x,a.y+5,46*s,32*s,0,near-.6,near+.6);c.strokeStyle=color;c.lineWidth=2+pressure*1.5;c.stroke();
        c.save();c.translate(a.x+Math.cos(away)*63*s,a.y+5+Math.sin(away)*47*s);c.rotate(away);
        line(c,[[-6,-5],[2,0],[-6,5]],color,1.8);c.restore();
      }
      c.restore();
    }
  }

  function cowStatus(c,a,time) {
    if(a.delivered||(!a.intent&&!Number.isFinite(a.vigor)&&!a.skillStage))return;
    const s=cowScale(a),standing=a.personality==='thrower'&&(a.attack==='stoneWindup'||a.attack==='stoneThrow'||(a.standing||0)>.1);
    const y=standing?a.y+35:a.y-58*s-2,stage=a.skillStage||'idle';
    const color=stage==='cue'?'#b58435':stage==='burst'?'#b55a40':stage==='recover'?'#779084':'#88775b';
    const intent=a.intent||(stage==='cue'?(a.skillName||'正在蓄势'):stage==='burst'?(a.skillName||'正在发力'):stage==='recover'?'恢复体力中':'观察骑手');
    c.save();c.textAlign='center';c.textBaseline='middle';
    round(c,a.x-82,y-9,164,Number.isFinite(a.vigor)?31:19,8,'rgba(250,240,216,.88)','rgba(175,146,98,.16)',1);
    c.font='600 10px "Microsoft YaHei",sans-serif';c.fillStyle=color;c.fillText(intent,a.x,y,148);
    if(Number.isFinite(a.vigor)) {
      const vigor=Math.max(0,Math.min(1,a.vigor)),barX=a.x-44,barY=y+11;
      c.font='500 8px "Microsoft YaHei",sans-serif';c.fillStyle='#a59679';c.fillText('体力',a.x-63,barY+1);
      round(c,barX,barY-1,109,4,2,'rgba(154,139,107,.17)');
      if(vigor>0)round(c,barX,barY-1,109*vigor,4,2,vigor>.45?'#8da078':vigor>.18?'#c0a16b':'#bc8e73');
    }
    if(stage==='cue') {
      c.globalAlpha=.62+.3*Math.sin(time*9);
      ellipse(c,a.x+91,y,6,6,'#d8b66d');c.font='800 9px sans-serif';c.fillStyle='#fff1cd';c.fillText('!',a.x+91,y+.5);
    }
    c.restore();
  }

  function deliveryGuide(c, state) {
    if(state.mode!=='playing' || !state.player) return;
    const pen=state.pen || {x:555,y:300,w:260,h:220};
    const player=state.player;
    if(pen.closed || pen.closing) return;
    if(pen.canClose)return; // The fixed latch itself carries the E hint.
    const inside=penHasCow(state,pen),latch=latchPosition(pen);
    if(!inside&&!state.tether)return;
    // Once the cow is inside, leave through the east opening before following
    // the outside path to the upper latch. A direct diagonal would hit a fence.
    const right=pen.x+pen.w,bottom=pen.y+pen.h,gateX=right+72,gateY=pen.y+pen.h*.5;
    let targetX=pen.x+pen.w*.5,targetY=gateY;
    // A central pen can be approached from every side. Guide around its solid
    // sides before pointing through the east opening, never through a rail.
    if(player.x<pen.x && player.y>pen.y-64 && player.y<bottom+64) {
      targetX=pen.x-72;targetY=player.y<gateY?pen.y-72:bottom+72;
    } else if(player.x<gateX && (player.y<=pen.y || player.y>=bottom)) {
      targetX=gateX;targetY=player.y<=pen.y?pen.y-72:bottom+72;
    } else if(inside) {
      if(player.x<right+42){targetX=gateX;targetY=gateY;}
      else{targetX=latch.x;targetY=latch.y;}
    } else if(player.x>=right && Math.abs(player.y-gateY)>pen.h*.5-45) {
      targetX=gateX;targetY=gateY;
    }
    const dx=targetX-player.x,dy=targetY-player.y,distance=Math.hypot(dx,dy);
    if(distance<(inside?36:95)) return;
    const angle=Math.atan2(dy,dx), bob=Math.sin((state.time || 0)*3)*3;
    c.save(); c.translate(player.x+Math.cos(angle)*(Math.min(82,distance*.65)+bob),player.y+Math.sin(angle)*(Math.min(82,distance*.65)+bob)); c.rotate(angle);
    c.globalAlpha=.75;
    path(c,[[-8,-8],[7,0],[-8,8],[-3,0]],inside?'#b49354':'#849a64','#f3e4c5',1.5);
    c.restore();
  }

  function cowScale(a) {
    return Number.isFinite(a.scale) ? a.scale : a.size==='small' ? .75 : a.size==='large' ? 1.45 : 1;
  }

  function cowPose(a, time) {
    const struggle=a.struggling?Math.max(.2,Math.min(1,a.strugglePower || .4)):0;
    const attack=a.attack==='charge'?.9:a.attack==='windup'?.27:a.skillStage==='burst'?.55:a.skillStage==='cue'?.15:0;
    const yank=Math.max(0,Math.min(1,(a.yankStun||0)/.45));
    const power=a.subdued?0:Math.max(struggle,attack)*(1-yank*.9);
    const phase=a.phase || 0;
    return {
      power,
      x:a.x+Math.sin(time*17+phase)*2.1*power,
      y:a.y-Math.abs(Math.sin(time*12+phase))*6*power,
      angle:(a.angle || 0)+Math.sin(time*15+phase)*.13*power,
      head:Math.sin(time*23+phase)*.24*power-yank*.14
    };
  }

  function cow(c, a, time) {
    if(a.personality==='thrower'&&(a.attack==='stoneWindup'||a.attack==='stoneThrow'||(a.standing||0)>.1)) {
      standingCow(c,a,time);return;
    }
    const caught=a.subdued&&!a.delivered?0:a.caught || 0, alpha=caught?Math.max(0,1-caught/.65):1;
    if(alpha<=0) return;
    const gold=a.type==='gold', fast=a.type==='fast', small=a.size==='small', large=a.size==='large';
    const scale=cowScale(a), pose=cowPose(a,time), power=pose.power;
    const rage=a.subdued?0:Math.max(0,Math.min(1,a.rage || 0));
    const coat=a.coat || (gold?'#d9a459':fast?'#b6815d':'#faf4e5');
    const spot=a.patch || (gold?'#a86e37':fast?'#704e40':'#725849');
    const phase=(a.walk || 0)+(a.phase || 0);
    const gait=Math.sin(power?time*27+phase:phase*1.8)*(3+power*9);
    c.save(); c.globalAlpha=alpha;
    // Hooves kick up little expanding clouds while the animal resists.
    if(power) {
      for(let i=0;i<7;i++) {
        const t=(time*(1.4+power)+i*.147+(a.phase||0)*.1)%1;
        const theta=i*2.4+(a.angle||0);
        c.globalAlpha=alpha*(1-t)*.25*power;
        ellipse(c,a.x+Math.cos(theta)*(24+t*28)*scale,a.y+Math.sin(theta)*(13+t*17)*scale+8,
          (5+t*13)*scale,(3+t*6)*scale,'#bfa072');
      }
      c.globalAlpha=alpha;
    }
    ellipse(c,a.x+4,a.y+10,33*scale,15*scale,'rgba(116,85,46,.13)');
    c.translate(pose.x,pose.y); c.scale(scale,scale);
    if(caught) c.scale(1+caught*.3,1+caught*.3);
    if(gold) {
      c.save(); c.globalAlpha*=.34+.05*Math.sin(time*3);
      ellipse(c,0,4,38,23,'#efd489'); c.restore();
    }
    c.rotate(pose.angle);
    const variation=typeof a.bodyVariation==='number'?Math.max(.8,Math.min(1.22,a.bodyVariation)):a.bodyVariation==='stocky'||a.bodyVariation==='broad'?1.16:a.bodyVariation==='lean'?.85:1;
    const shoulder=(large?25:small?15:19)*variation;
    const hoofW=large?9:small?6:8;
    for(const [x,y,offset] of [[-16,-shoulder,gait],[16,-shoulder,-gait],[-15,shoulder,-gait],[15,shoulder,gait]]) {
      c.save(); c.translate(x+offset,y); c.rotate(power*Math.sin(time*22+x)*.32);
      round(c,-hoofW*.5,-4,hoofW,13+power*3,3,coat);
      round(c,-hoofW*.5,y>0?5:-4,hoofW,5,2,'#6c5645'); c.restore();
    }
    const tailSwing=Math.sin(time*(5+power*10)+(a.phase||0))*(3+power*9);
    c.beginPath(); c.moveTo(-25,0); c.bezierCurveTo(-38,-2,-33,10,-42,10+tailSwing);
    c.strokeStyle=gold?'#ae7a43':'#b9a387'; c.lineWidth=small?2:3; c.stroke();
    ellipse(c,-42,10+tailSwing,small?4:5,3,spot,-.3);
    c.beginPath(); c.moveTo(-27,-11); c.quadraticCurveTo(-20,-shoulder-2,-5,-shoulder-1);
    c.lineTo(13,-shoulder); c.quadraticCurveTo(28,-shoulder+1,29,0);
    c.quadraticCurveTo(28,shoulder,16,shoulder+1); c.lineTo(-13,small?16:20);
    c.quadraticCurveTo(-28,17,-28,7); c.closePath();
    c.fillStyle=coat; c.fill(); c.strokeStyle=gold?'#bf8c4c':'#d6c7ab'; c.lineWidth=1.5; c.stroke();
    if(rage>.12) {
      c.save(); c.globalAlpha*=rage*.14;
      ellipse(c,8,0,20,shoulder,'#d86437'); c.restore();
    }
    c.beginPath(); c.moveTo(-20,-12); c.bezierCurveTo(-24,-3,-13,0,-15,8);
    c.bezierCurveTo(-7,13,1,6,-1,0); c.bezierCurveTo(2,-8,-12,-15,-20,-12); c.fillStyle=spot; c.fill();
    c.beginPath(); c.moveTo(7,-shoulder); c.bezierCurveTo(0,-9,8,-4,13,-6);
    c.bezierCurveTo(20,-4,27,-8,21,-shoulder+2); c.closePath(); c.fill();
    ellipse(c,13,small?11:15,7,5,spot,-.4);
    line(c,[[-20,-14],[-9,-17]],gold?'#eac582':'#fffaf0',2);
    if(large) {
      // A pronounced muscular shoulder and neck distinguish a heavy bull.
      c.beginPath(); c.moveTo(9,-22); c.quadraticCurveTo(21,-31,29,-14);
      c.lineTo(31,14); c.quadraticCurveTo(20,28,9,22); c.quadraticCurveTo(18,0,9,-22);
      c.fillStyle=spot; c.fill();
      line(c,[[16,-20],[22,-17]],gold?'#c99454':'#94705a',2);
    }
    c.save(); c.translate(23,0); c.rotate(pose.head); c.translate(-23,0);
    const hornReach=(large?34:small?15:23)*Math.max(.65,Math.min(1.7,a.hornScale||1));
    for(const side of [-1,1]) {
      c.beginPath(); c.moveTo(29,side*8);
      c.quadraticCurveTo(30,side*(hornReach-3),large?13:21,side*hornReach);
      c.quadraticCurveTo(large?23:24,side*(hornReach-7),21,side*11); c.closePath();
      c.fillStyle='#f3e2bc'; c.fill(); c.strokeStyle='#c4ae87'; c.lineWidth=1; c.stroke();
    }
    ellipse(c,24,-14,small?7:8,4,spot,-.5); ellipse(c,24,14,small?7:8,4,spot,.5);
    round(c,19,-12,25,24,small?10:large?6:9,coat,gold?'#b98444':'#d7c6a8',1.3);
    if(rage>.15) {
      c.save(); c.globalAlpha*=rage*.24;
      round(c,20,-11,23,22,7,'#d96a42'); c.restore();
    }
    if(large) path(c,[[19,-11],[31,-9],[34,-4],[27,0],[33,6],[30,11],[19,12]],spot);
    ellipse(c,34,-8,small?2.5:2,2.2,'#443c32'); ellipse(c,34,8,small?2.5:2,2.2,'#443c32');
    if(power>.4 || rage>.45) {
      line(c,[[30,-11],[36,-10]],'#6b4d3b',1.7);
      line(c,[[30,11],[36,10]],'#6b4d3b',1.7);
    }
    round(c,36,-10,13,20,6,gold?'#d9b082':fast?'#c7977b':'#dfb5a0');
    ellipse(c,44,-5,1.6,1.4,'#a77e68'); ellipse(c,44,5,1.6,1.4,'#a77e68');
    if((a.vocal || 0)>0) {
      ellipse(c,47,0,2.8,4.6+Math.sin(time*19)*.9,'#7d4f40');
      ellipse(c,47,2,1.7,2.1,'#d3987f');
    }
    if(rage>.2 || a.attack==='windup') {
      for(let i=0;i<4;i++) {
        const t=(time*(a.attack==='windup'?3:1.7)+i*.27)%1;
        c.save(); c.globalAlpha*=(1-t)*(.2+rage*.3);
        ellipse(c,49+t*14,(i%2?-1:1)*(7+t*9),2+t*4,1.5+t*3,'#f7e5c7'); c.restore();
      }
    }
    c.restore();
    if(caught) {
      c.beginPath(); c.ellipse(3,0,33,22,0,0,Math.PI*2); c.strokeStyle='#c89137'; c.lineWidth=3; c.stroke();
    }
    c.restore();
    if(!caught) {
      c.save();
      const sizeLabel=small?'小牛':large?'重型牛':'壮牛';
      const label=a.nickname || sizeLabel;
      const detail=a.nickname?(sizeLabel+(a.personalityLabel?' · '+a.personalityLabel:'')):(a.personalityLabel || '');
      c.font='700 12px "Microsoft YaHei", sans-serif';
      const labelW=Math.max(48,Math.min(160,Math.max(c.measureText(label).width,c.measureText(detail).width)+22));
      const hasStatus=!!a.intent||Number.isFinite(a.vigor)||!!a.skillStage;
      const labelY=a.y-58*scale-9-(hasStatus?22:0), labelH=detail?34:22;
      round(c,a.x-labelW*.5,labelY-labelH*.5,labelW,labelH,10,'rgba(250,240,216,.9)',rage>.65?'rgba(185,101,64,.38)':'rgba(170,139,92,.22)',1);
      c.textAlign='center'; c.textBaseline='middle';
      c.fillStyle=a.subdued?'#78905f':rage>.65?'#a45f40':large?'#826044':'#8b7655';
      c.fillText(label,a.x,labelY+(detail?-6:0));
      if(detail) {
        c.font='500 9px "Microsoft YaHei", sans-serif'; c.fillStyle='#9e8c6f';
        c.fillText(detail,a.x,labelY+8);
      }
      if(rage>.08 || a.attack==='windup' || a.attack==='charge') {
        const barY=labelY+labelH*.5+4, barW=labelW-8;
        round(c,a.x-barW*.5,barY,barW,3,2,'rgba(169,131,87,.2)');
        round(c,a.x-barW*.5,barY,Math.max(2,barW*rage),3,2,a.attack==='windup'?'#c96743':'#c88b56');
      }
      c.translate(a.x-labelW*.5-11,labelY);
      if(gold) {
        path(c,[[0,-7],[5,0],[0,7],[-5,0]],'#e5b74c','#bc8a34',1);
        line(c,[[-1,-4],[-2,0]],'#fff0b0',1.5);
      } else if(fast) path(c,[[0,-6],[-5,1],[-1,1],[-3,7],[5,-2],[1,-2],[3,-6]],'#b47b4e');
      c.restore();
      if((a.vocal || 0)>0) {
        const bubbleX=a.x+50*scale,bubbleY=a.y-48*scale+Math.sin(time*8)*1.5;
        c.save(); c.globalAlpha=Math.min(1,a.vocal*3);
        c.translate(bubbleX,bubbleY);
        path(c,[[6,6],[2,19],[16,10]],'#fbefd7','#d2bb93',1);
        round(c,0,-14,45,27,10,'#fbefd7','#d2bb93',1);
        c.font='700 12px "Microsoft YaHei", sans-serif'; c.textAlign='center'; c.textBaseline='middle';
        c.fillStyle='#9c704a'; c.fillText('哞～',23,0); c.restore();
      }
    }
  }

  function horse(c, a, time, mount={}, tether) {
    const coat=mount.coat||'#ab6846',mane=mount.mane||'#654334',outline=shade(coat,-.22),highlight=shade(coat,.18);
    const id=mount.id||a.horseId||'balanced',pull=Number(mount.pull)||1;
    const heavy=id==='draft'||mount.build==='heavy'||pull>=1.3,light=id==='agile'||mount.build==='light';
    const buildX=heavy?1.13:light?.93:id==='mustang'?1.06:1,buildY=heavy?1.23:light?.85:id==='mustang'?.93:id==='endurance'?1.06:1;
    const facing=Number.isFinite(a.horseAngle)?a.horseAngle:a.angle || 0;
    const sprint=!!a.sprinting && !!a.moving;
    const brace=tether?Math.max(0,Math.min(1,Math.max(tether.yankFlash||0,(tether.yankActive||0)/.22))):0;
    const phase=(a.walk || time*9)*(sprint?1.3:1), stride=(a.moving?Math.sin(phase)*(sprint?16:11):0)*(1-brace*.8);
    const bob=(a.moving?Math.abs(Math.sin(phase))*(sprint?4:2.3):Math.sin(time*2)*.45)*(1-brace);
    c.save(); c.translate(a.x,a.y);
    if((a.hurt || 0)>0) c.globalAlpha*=Math.sin(time*37)>0?.48:1;
    ellipse(c,3,15,48*buildX,20*buildY,'rgba(108,76,41,.16)',facing*.12);
    c.translate(0,-bob); c.rotate(facing);
    if(sprint) {
      for(let i=0;i<7;i++) {
        const t=(time*2.1+i*.143)%1;
        c.save(); c.globalAlpha*=(1-t)*.3;
        ellipse(c,-32-t*55,(i%2?-1:1)*(10+t*12),4+t*11,2+t*6,'#c3a273'); c.restore();
      }
      c.save(); c.globalAlpha=.25;
      line(c,[[-58,-21],[-77,-21]],'#b99564',1.7);
      line(c,[[-65,13],[-89,13]],'#b99564',1.5); c.restore();
    }
    c.scale(buildX,buildY);
    // Four articulated legs reach forward and back in a diagonal gallop.
    for(const leg of [{x:-24,y:-15,s:-1},{x:24,y:-15,s:1},{x:-24,y:15,s:1},{x:24,y:15,s:-1}]) {
      const extension=stride*leg.s+(leg.x<0?-10:7)*brace, side=leg.y<0?-1:1;
      const kneeX=leg.x+extension*.55, kneeY=leg.y+side*9;
      const footX=leg.x+extension, footY=leg.y+side*(17-Math.abs(extension)*.2+brace*6);
      line(c,[[leg.x,leg.y],[kneeX,kneeY],[footX,footY]],leg.y<0?outline:coat,heavy?9:light?6.5:8);
      line(c,[[kneeX,kneeY],[footX,footY]],leg.y<0?shade(coat,.08):highlight,heavy?6:4.5);
      if(heavy)ellipse(c,footX,footY-1,6,4,'#d3c6aa');
      round(c,footX-4,footY-3,9,6,2,'#60483a');
    }
    const tail=Math.sin(time*(a.moving?10:3))*8;
    c.beginPath(); c.moveTo(-35,-6); c.bezierCurveTo(-47,-7,-49,tail-3,-64,tail-2);
    c.bezierCurveTo(-60,tail+8,-45,tail+12,-33,5); c.closePath(); c.fillStyle=mane; c.fill();
    line(c,[[-37,0],[-50,tail+4],[-61,tail+2]],shade(mane,.17),2);
    c.beginPath(); c.moveTo(-37,-9); c.bezierCurveTo(-31,-23,-8,-23,9,-19);
    c.bezierCurveTo(22,-23,36,-14,35,0); c.bezierCurveTo(35,16,22,23,8,20);
    c.bezierCurveTo(-13,24,-33,21,-37,10); c.closePath();
    c.fillStyle=coat; c.fill(); c.strokeStyle=outline; c.lineWidth=1.5; c.stroke();
    ellipse(c,-24,-4,13,12,highlight,-.2);
    c.beginPath(); c.moveTo(19,-13); c.bezierCurveTo(30,-19,37,-14,43,-11);
    c.lineTo(45,6); c.quadraticCurveTo(30,17,23,13); c.closePath(); c.fillStyle=shade(coat,.1); c.fill();
    // Slender head, alert ears, pale blaze and leather bridle.
    c.save(); c.translate(38,0); c.rotate(a.moving?Math.sin(phase+.5)*.055:0);
    path(c,[[-4,-11],[5,-12],[18,-7],[24,-5],[25,6],[15,10],[1,10],[-5,4]],shade(coat,.08),outline,1.2);
    path(c,[[-1,-10],[-3,-23],[6,-13]],outline);
    path(c,[[5,7],[3,18],[12,9]],outline);
    line(c,[[-1,-17],[2,-12]],highlight,2);
    path(c,[[5,-7],[8,-6],[19,1],[17,5],[9,2]],'#edd8ae');
    round(c,18,-5,10,12,4,shade(coat,-.28));
    ellipse(c,10,-7,2,1.8,'#352f29'); ellipse(c,22,-1,1.4,1.2,'#362d29');
    line(c,[[0,-10],[0,9]],'#6c4b35',3); line(c,[[18,-6],[17,7]],'#6c4b35',2.5);
    ellipse(c,18,7,2.5,2.5,'#d6b474'); c.restore();
    // Dark flowing mane and a woven saddle blanket.
    path(c,[[10,-18],[20,-20],[35,-14],[44,-10],[37,-7],[31,-10],[25,-7],[20,-12],[14,-10]],mane);
    line(c,[[18,-17],[32,-12]],shade(mane,.22),1.5);
    const blanket={balanced:'#668b8b',agile:'#b08e55',endurance:'#86906b',draft:'#8b6055',mustang:'#b57c4f'}[id]||'#668b8b';
    round(c,-14,-21,28,42,6,blanket,shade(blanket,-.2),1.3);
    line(c,[[-11,-15],[11,-15]],'#d5bd87',2); line(c,[[-11,15],[11,15]],'#d5bd87',2);
    round(c,-11,-14,22,28,7,'#765039','#5d402f',1.5);
    ellipse(c,-6,0,8,12,'#976640'); line(c,[[8,-10],[8,10]],'#c49861',3);
    ellipse(c,10,-1,4,4,'#b78652');
    // Two rein strands lead back from the bridle to the rider's holding hand.
    c.beginPath(); c.moveTo(55,-5); c.quadraticCurveTo(30,-25,-5,-11);
    c.moveTo(55,7); c.quadraticCurveTo(28,24,-5,7); c.strokeStyle='#71513b'; c.lineWidth=1.8; c.stroke();
    c.restore();
  }

  function cowboy(c, a, time, charging, reeling, mount, outfit={}, tether) {
    horse(c,a,time,mount,tether);
    outfit=outfit||{};
    const shirt=outfit.shirt||'#638f95',hat=outfit.hat||'#d1a368',scarf=outfit.scarf||'#b95842',vest=outfit.vest||null;
    const yank=tether?Math.max(0,Math.min(1,Math.max(tether.yankFlash||0,(tether.yankActive||0)/.22))):0;
    const angle=a.angle || 0;
    const phase=(a.walk || time*9)*(a.sprinting?1.3:1);
    const bob=a.moving?Math.abs(Math.sin(phase))*(a.sprinting?3:1.6):0;
    c.save(); c.translate(a.x-Math.cos(angle)*yank*5,a.y-14-bob-Math.sin(angle)*yank*3); c.scale(.76,.76);
    if((a.hurt || 0)>0) c.globalAlpha*=Math.sin(time*37)>0?.48:1;
    const tilt=Math.max(-.65,Math.min(.65,a.balanceTilt || 0));
    c.rotate(tilt+(reeling?-Math.cos(angle)*.1:0)-Math.cos(angle)*yank*.21);
    // Bent knees and boots hug the saddle instead of walking on the ground.
    line(c,[[-7,7],[-18,15],[-16,25]],'#566f73',9);
    line(c,[[7,7],[18,15],[16,25]],'#52686b',9);
    round(c,-20,23,10,7,3,'#71513a'); round(c,10,23,10,7,3,'#71513a');
    line(c,[[-21,22],[-21,30],[-11,30]],'#bb9b6b',1.6);
    line(c,[[21,22],[21,30],[11,30]],'#bb9b6b',1.6);
    // Small metal spurs flash as the rider urges the horse into a sprint.
    line(c,[[-19,27],[-24,27]],'#c5b077',1.5); line(c,[[19,27],[24,27]],'#c5b077',1.5);
    if(a.sprinting && a.moving) {
      const glint=.5+.5*Math.sin(time*17);
      c.save(); c.globalAlpha*=glint;
      for(const side of [-1,1]) {
        const x=side*25;
        line(c,[[x-4,27],[x+4,27]],'#fff2bc',1.5);
        line(c,[[x,23],[x,31]],'#fff2bc',1.5);
      }
      c.restore();
    }
    round(c,-14,-13,28,26,8,shirt,shade(shirt,-.2),1);
    path(c,[[-13,-8],[-9,-13],[-3,-10],[-5,7],[-13,7]],shade(shirt,.18));
    if(vest) {
      path(c,[[-13,-12],[-7,-13],[-1,-6],[-3,9],[-13,9]],vest,shade(vest,-.2),.8);
      path(c,[[13,-12],[7,-13],[1,-6],[3,9],[13,9]],vest,shade(vest,-.2),.8);
      line(c,[[-7,-11],[-2,-4],[-4,6]],shade(vest,.28),1.2);
      line(c,[[7,-11],[2,-4],[4,6]],shade(vest,.28),1.2);
      line(c,[[-11,3],[-6,3]],shade(vest,-.28),1);line(c,[[6,3],[11,3]],shade(vest,-.28),1);
      for(const y of[-2,3,7])ellipse(c,3,y,.8,.8,'#d9bd7c');
      if(outfit.id==='champion') {
        path(c,[[-8,-9],[-6,-5],[-2,-5],[-5,-2],[-4,2],[-8,0],[-11,2],[-10,-2],[-13,-5],[-9,-5]],'#e3bc6b');
      } else if(outfit.id==='scholar') {
        line(c,[[7,-9],[11,-9]],'#c6b88c',1.6);line(c,[[9,-11],[9,-7]],'#c6b88c',1.6);
      }
    }
    round(c,-13,7,26,5,1,'#806344'); round(c,-3,7,7,5,1,'#d7b26c');
    c.save(); c.rotate(angle);
    line(c,[[4,0],[17,-yank*4],[23,0]],shade(shirt,-.12),10);
    line(c,[[19,0],[26,0]],'#dfb48c',7);
    ellipse(c,28,0,4,4,'#e5bd94');
    c.restore();
    ellipse(c,-12,-1,5,8,shade(shirt,.14),.4);
    ellipse(c,-15,5,4,4,'#ddb18a');
    ellipse(c,0,-15,10,11,'#deb28b');
    path(c,[[-9,-7],[0,-3],[9,-7],[4,1],[0,8],[-4,0]],scarf);
    line(c,[[0,0],[2,5]],shade(scarf,.27),1.3);
    // Broad brim, raised crown and pinched hat top.
    ellipse(c,0,-20,24,12,shade(hat,-.25),-.04);
    ellipse(c,-1,-23,24,10,shade(hat,-.07),-.04);
    c.beginPath(); c.moveTo(-14,-25); c.lineTo(-12,-37); c.quadraticCurveTo(-9,-42,0,-40);
    c.quadraticCurveTo(10,-42,13,-35); c.lineTo(14,-25); c.quadraticCurveTo(1,-18,-14,-25);
    c.fillStyle=hat; c.fill(); c.strokeStyle=shade(hat,-.22); c.lineWidth=1.2; c.stroke();
    c.beginPath(); c.moveTo(-13,-28); c.quadraticCurveTo(0,-22,13,-28); c.strokeStyle=shade(hat,-.4); c.lineWidth=5; c.stroke();
    line(c,[[-8,-36],[0,-33],[8,-36]],shade(hat,-.2),1.5);
    line(c,[[-18,-24],[-12,-22]],shade(hat,.26),2);
    if(outfit.id==='champion'){c.beginPath();c.ellipse(-1,-23,23,9,-.04,0,Math.PI*2);c.strokeStyle='#e7bd60';c.lineWidth=1.5;c.stroke();}
    if(charging) {
      ellipse(c,-12,-7,2,2,'rgba(244,219,161,.7)');
    }
    c.restore();
  }

  function aim(c, state) {
    const a=state.aim, p=state.player;
    if(!a || !p || state.mode!=='playing' || state.tether) return;
    const charge=Math.max(0,Math.min(1,state.charge || 0));
    const sweet=a.sweet;
    c.save(); c.lineCap='round';
    const color=sweet?'#7d986d':'#b78a54';
    if(state.charging) {
      c.strokeStyle=sweet?'rgba(116,143,99,.42)':'rgba(174,125,67,.36)';
      c.lineWidth=1.5; c.setLineDash([3,8]);
      c.beginPath(); c.moveTo(p.x+Math.cos(a.angle || 0)*34,p.y+Math.sin(a.angle || 0)*34);
      c.lineTo(a.x,a.y); c.stroke(); c.setLineDash([]);
      ellipse(c,a.x,a.y,a.radius || 28,(a.radius || 28)*.68,sweet?'rgba(135,163,103,.11)':'rgba(204,151,75,.09)');
      c.beginPath(); c.ellipse(a.x,a.y,a.radius || 28,(a.radius || 28)*.68,0,0,Math.PI*2);
      c.strokeStyle=color; c.lineWidth=2; c.setLineDash([6,5]); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.ellipse(a.x,a.y,(a.radius || 28)+6,((a.radius || 28)+6)*.68,0,-Math.PI*.5,-Math.PI*.5+Math.PI*2*charge);
      c.lineWidth=3; c.strokeStyle=sweet?'#819b6a':'#cb974d'; c.stroke();
    } else {
      c.strokeStyle='rgba(151,117,74,.42)'; c.lineWidth=1.5;
      for(let i=0;i<4;i++) {
        const theta=i*Math.PI*.5;
        c.beginPath(); c.arc(a.x,a.y,10,theta+.13,theta+.65); c.stroke();
      }
      ellipse(c,a.x,a.y,1.7,1.7,'rgba(151,117,74,.48)');
    }
    c.restore();
  }

  function ropeStroke(c) {
    c.strokeStyle='#a87534'; c.lineWidth=4; c.stroke();
    c.strokeStyle='#e3bb73'; c.lineWidth=2; c.stroke();
  }

  function riderHand(p) {
    return {x:p.x+Math.cos(p.angle || 0)*21,y:p.y-14+Math.sin(p.angle || 0)*21};
  }

  function tetherGround(c, state) {
    const tether=state.tether;
    if(!tether) return;
    const animal=(state.cows || []).find(a=>a.id===tether.cowId);
    if(!animal) return;
    const control=Number.isFinite(tether.focus)?tether.focus:Number.isFinite(tether.control)?tether.control:tether.progress || 0;
    const scale=cowScale(animal), progress=Math.max(0,Math.min(1,control));
    const tension=Math.max(0,Math.min(1,tether.tension || 0));
    const color=tension>.82?'#bf6850':tether.inZone||tension>=.25&&tension<=.78?'#819b6a':'#c49b59';
    c.save(); c.lineCap='round';
    c.beginPath(); c.ellipse(animal.x,animal.y+5,49*scale,34*scale,0,0,Math.PI*2);
    c.strokeStyle='rgba(155,121,77,.18)'; c.lineWidth=4; c.stroke();
    c.beginPath(); c.ellipse(animal.x,animal.y+5,49*scale,34*scale,0,-Math.PI*.5,-Math.PI*.5+Math.PI*2*progress);
    c.strokeStyle=color; c.lineWidth=4; c.stroke();
    if(tether.surge) {
      c.globalAlpha=.14+.1*Math.sin((state.time || 0)*16);
      c.beginPath(); c.ellipse(animal.x,animal.y+5,55*scale,38*scale,0,0,Math.PI*2);
      c.strokeStyle='#bc6a4e'; c.lineWidth=2; c.stroke();
    }
    c.restore();
  }

  function yankDust(c,state) {
    const t=state.tether,p=state.player;
    if(!t||!p||!(t.yankFlash>0))return;
    const a=(state.cows||[]).find(cow=>cow.id===t.cowId);if(!a)return;
    const flash=Math.max(0,Math.min(1,t.yankFlash)),spread=1-flash,angle=Math.atan2(a.y-p.y,a.x-p.x);
    c.save();
    for(const body of [{x:p.x,y:p.y,s:1},{x:a.x,y:a.y,s:cowScale(a)}]) {
      c.save();c.translate(body.x,body.y);c.rotate(angle);
      for(const side of[-1,1])for(let i=0;i<4;i++) {
        c.globalAlpha=flash*(.16+i*.025);
        ellipse(c,(-23+i*13-spread*13)*body.s,side*(18+spread*(8+i*3))*body.s,(3+spread*(4+i*2))*body.s,(2+spread*4)*body.s,'#b79a6c');
      }
      c.globalAlpha=flash*.55;
      for(const side of[-1,1])line(c,[[27,side*23],[37+spread*18,side*23]],'#b59058',1.6);
      c.restore();
    }
    c.restore();
  }

  function tetherRope(c, state, hand) {
    const tether=state.tether;
    const animal=(state.cows || []).find(a=>a.id===tether.cowId);
    if(!animal) return;
    const time=state.time || 0, pose=cowPose(animal,time), scale=cowScale(animal);
    const neck={x:pose.x+Math.cos(pose.angle)*24*scale,y:pose.y+Math.sin(pose.angle)*24*scale};
    const tension=Math.max(0,Math.min(1,tether.tension || 0));
    const force=Math.max(0,Math.min(1,Number.isFinite(tether.force)?tether.force:tension));
    const integrity=Math.max(0,Math.min(1,Number.isFinite(tether.integrity)?tether.integrity:1));
    const yank=Math.max(0,Math.min(1,tether.yankFlash||0));
    const danger=tension>.82||integrity<.28, controlled=!!tether.inZone||tension>=.25&&tension<=.78;
    const dark=danger?'#a84e3b':controlled?'#668454':'#a67a3c';
    const light=danger?'#e39b76':controlled?'#b5c58c':'#e2ba73';
    const distance=Math.hypot(neck.x-hand.x,neck.y-hand.y);
    const spare=Number.isFinite(tether.restLength)?Math.max(0,tether.restLength-distance):Math.pow(1-tension,2)*110;
    const taut=yank>0||(tether.yankActive||0)>0||force>.56||spare<5;
    const sag=taut?0:Math.min(76,spare*.65+5)*(1-force*.7);
    const controlX=(hand.x+neck.x)*.5,controlY=(hand.y+neck.y)*.5+sag;
    c.beginPath(); c.moveTo(hand.x,hand.y);
    if(taut)c.lineTo(neck.x,neck.y);else c.quadraticCurveTo(controlX,controlY,neck.x,neck.y);
    c.strokeStyle=dark; c.lineWidth=4+force*1.6; c.stroke();
    c.strokeStyle=light; c.lineWidth=2.1+force*.55; c.stroke();
    if(state.reeling&&!taut) {
      c.save(); c.globalAlpha=.3; c.setLineDash([5,20]); c.lineDashOffset=time*35;
      c.strokeStyle='#fff1c7'; c.lineWidth=1.3; c.stroke(); c.restore();
    }
    if(yank>0) {
      c.save();c.globalAlpha=yank*.82;c.strokeStyle='#fff2bb';c.lineWidth=6*yank+1;c.stroke();
      const release=1-yank;
      for(const end of [hand,neck]) {
        for(let i=0;i<6;i++) {
          const theta=i*Math.PI/3+.2;
          line(c,[[end.x+Math.cos(theta)*(8+release*4),end.y+Math.sin(theta)*(8+release*4)],
            [end.x+Math.cos(theta)*(14+release*11),end.y+Math.sin(theta)*(14+release*11)]],'#fff2b9',2.2);
        }
      }
      c.restore();
    }
    const ropeAngle=Math.atan2(neck.y-hand.y,neck.x-hand.x);
    if(force>.58) {
      c.save();c.globalAlpha=.25+force*.3;
      for(const end of [{x:hand.x,y:hand.y,angle:ropeAngle},{x:neck.x,y:neck.y,angle:ropeAngle+Math.PI}]) {
        c.save();c.translate(end.x,end.y);c.rotate(end.angle);
        line(c,[[12,-9],[17,-5]],dark,1.5);line(c,[[12,9],[17,5]],dark,1.5);c.restore();
      }
      c.restore();
    }
    if(integrity<.55) {
      const midX=hand.x*.25+controlX*.5+neck.x*.25,midY=hand.y*.25+controlY*.5+neck.y*.25;
      c.save();c.translate(midX,midY);c.rotate(ropeAngle);c.globalAlpha=.8;
      for(let i=0;i<3;i++)line(c,[[-5+i*4,0],[-8+i*5,(i%2?-1:1)*(5+(1-integrity)*6)]],light,1.3);
      c.restore();
    }
    c.save(); c.translate(neck.x,neck.y); c.rotate(pose.angle);
    c.beginPath(); c.ellipse(0,0,8*scale,16*scale,0,0,Math.PI*2);
    c.strokeStyle=dark; c.lineWidth=3.5; c.stroke();
    c.strokeStyle=light; c.lineWidth=1.5; c.stroke();
    ellipse(c,-5*scale,8*scale,2.5,2.5,light); c.restore();
  }

  function rope(c, state) {
    c.save(); c.lineCap='round'; c.lineJoin='round';
    const r=state.rope,p=state.player;
    if(!p) { c.restore(); return; }
    const hand=riderHand(p);
    if(state.tether) {
      tetherRope(c,state,hand);
    } else if(r) {
      const x=Number.isFinite(r.x)?r.x:r.endX, y=Number.isFinite(r.y)?r.y:r.endY;
      // The moving rider keeps hold of the rope while the loop follows its flight.
      const sx=hand.x, sy=hand.y;
      const dx=x-sx,dy=y-sy,d=Math.hypot(dx,dy);
      const bounce=Math.sin(Math.max(0,Math.min(1,r.progress || 0))*Math.PI);
      c.beginPath(); c.moveTo(sx,sy);
      c.quadraticCurveTo(sx+dx*.52,sy+dy*.52-22-bounce*36,x,y-bounce*18);
      ropeStroke(c);
      const radius=r.radius || 26;
      // At impact, the drawn loop and the engine's ellipse share the exact center and radii.
      c.beginPath(); c.ellipse(x,y-bounce*18,radius,radius*.68,0,0,Math.PI*2);
      ropeStroke(c);
      if(r.hit) {
        c.globalAlpha=.23; ellipse(c,x,y,radius+14,(radius+14)*.68,'#d6ac50');
      } else if(r.phase==='out' && d>30) {
        c.globalAlpha=.12; ellipse(c,x,y+13,radius*.8,6,'#a67d47');
      }
    } else if(state.charging && p) {
      const q=Math.max(0,Math.min(1,state.charge || 0));
      const a=(state.time || 0)*(13+q*8);
      const centerX=p.x+Math.cos(a)*8,centerY=p.y-48+Math.sin(a)*4;
      const radius=24+q*13;
      c.beginPath(); c.moveTo(hand.x,hand.y);
      c.quadraticCurveTo(p.x+27,p.y-42,centerX+Math.cos(a)*radius,centerY+Math.sin(a)*radius*.4);
      ropeStroke(c);
      c.beginPath(); c.ellipse(centerX,centerY,radius,radius*.42,Math.sin(a)*.18,0,Math.PI*2);
      ropeStroke(c);
      c.save(); c.globalAlpha=.23; c.lineWidth=1.5; c.strokeStyle='#c4944e';
      c.beginPath(); c.ellipse(centerX-2,centerY-2,radius+5,radius*.5,Math.sin(a-.6)*.18,a,a+Math.PI*1.1); c.stroke(); c.restore();
    }
    c.restore();
  }

  function particles(c, list) {
    c.save();
    for(const p of list || []) {
      const life=Math.max(0,Math.min(1,p.maxLife?p.life/p.maxLife:p.life));
      c.globalAlpha=life;
      ellipse(c,p.x,p.y,p.size || 3,(p.size || 3)*.8,p.color || '#d3b17a');
    }
    c.restore();
  }

  function floaters(c, list) {
    c.save(); c.textAlign='center'; c.textBaseline='middle';
    for(const f of list || []) {
      c.globalAlpha=Math.max(0,Math.min(1,(f.life || 0)*2));
      c.font='800 25px "Trebuchet MS", "Microsoft YaHei", sans-serif';
      c.lineWidth=5; c.strokeStyle='#f3e3c4'; c.lineJoin='round'; c.strokeText(f.text,f.x,f.y);
      c.fillStyle=f.color || '#866238'; c.fillText(f.text,f.x,f.y);
    }
    c.restore();
  }

  function draw(c, state) {
    if(!background) background=makeBackground();
    state=state || {};
    c.save(); c.lineCap='round'; c.lineJoin='round';
    c.drawImage(background,0,0);
    rodeoStands(c,state);
    deliveryPen(c,state);
    aim(c,state);
    cattleTelegraphs(c,state);
    throwerWarning(c,state);
    cowPressureHints(c,state);
    deliveryGuide(c,state);
    tetherGround(c,state);
    yankDust(c,state);
    particles(c,state.particles);
    const entities=(state.cows || []).map(a=>({y:a.y,cow:a}));
    if(state.player) entities.push({y:state.player.y,player:state.player});
    entities.sort((a,b)=>a.y-b.y);
    for(const item of entities) {
      if(item.cow) cow(c,item.cow,state.time || 0);
      else cowboy(c,item.player,state.time || 0,state.charging,state.reeling,state.horse,state.outfit,state.tether);
    }
    rope(c,state);
    airborneStones(c,state);
    for(const a of state.cows||[])cowStatus(c,a,state.time||0);
    floaters(c,state.floaters);
    arenaAnnouncement(c,state);
    c.restore();
  }

  window.RanchArt={draw};
})();
