(() => {
  'use strict';
  const traits = {
    docile:['温顺','从侧后方靠近，把它往牛栏方向赶；留出门口，不必先套绳。'],
    skittish:['胆小快跑','靠近就逃，还会突然跃步。绕到外侧压住退路，别一直追着尾巴跑。'],
    zigzag:['蛇形走位','会左右变向。骑到外侧封住偏离牛栏的方向，再慢慢压近。'],
    sprinter:['短跑健将','隔一阵就突然加速。留耐力抢到侧面，等短跑结束再赶回路线。'],
    stubborn:['倔强顶绳','会扎住脚步拒绝移动。换到侧后方施压，套绳时先卸力再牵。'],
    roller:['绕圈反抗','喜欢绕着骑手打转。拉开距离，抢到圈外侧，把绕圈变成向牛栏前进。'],
    trickster:['假动作','会假装转向再折返，见到套索还会闪躲。保持间距，等动作结束再封路。'],
    aggressive:['暴躁冲撞','会低头冲锋。转向加速躲开红线，再绕到侧后方赶牛，套绳也要防冲撞。'],
    champion:['首领 · 狂暴','冲锋更快、反抗更强。留耐力躲避，分段施压赶向牛栏。'],
    thrower:['直立 · 扔石头','先喊“牛来，半导体跌了”，再扔石头。离开红色落点，Shift 加速躲开。']
  };
  // Unique combinations of movement, mass, strength, appearance and aggression.
  const rows = [
    ['豆丁','small','docile',180,60,.65,200,1,'#e8ddc6','#69513d'],
    ['牛奶糖','small','docile',220,71,.72,220,1,'#f3e8d4','#b17a48'],
    ['风铃','small','skittish',190,90,.82,280,1,'#c89562','#674a36'],
    ['跳豆','small','zigzag',205,88,.9,300,1,'#e1c7a3','#574136'],
    ['红辣椒','small','sprinter',230,106,.85,300,1,'#ae6444','#e9bc8a'],
    ['斑点','medium','docile',380,70,.92,320,1,'#ece7d8','#373a36'],
    ['花生','small','trickster',250,90,.95,340,2,'#c8a171','#7a583b'],
    ['迷路侠','medium','zigzag',430,84,1.05,380,2,'#a9a398','#f2e6ca'],
    ['磐石','medium','stubborn',510,42,1.18,420,2,'#8c7d68','#cbb89c'],
    ['银蹄','medium','sprinter',450,117,1.04,420,2,'#c3c4bb','#4e5753'],
    ['西风','medium','skittish',405,104,1.1,440,2,'#c18e62','#795644'],
    ['铜铃','medium','roller',490,80,1.22,460,2,'#b7854c','#e6c995'],
    ['黑旋风','large','zigzag',690,88,1.32,520,3,'#4c4740','#8d8372'],
    ['铁头','large','stubborn',820,46,1.52,560,3,'#7a7770','#393c38'],
    ['火药桶','large','aggressive',720,78,1.48,580,3,'#894632','#d3a07b'],
    ['赤焰','large','aggressive',780,92,1.62,650,3,'#a14f35','#e0b181'],
    ['金角','large','champion',850,88,1.78,800,3,'#c49947','#79542b'],
    ['雪崩','large','sprinter',760,108,1.58,650,3,'#dfdfd4','#a7aa9e'],
    ['老油条','medium','trickster',560,110,1.32,620,3,'#9b7859','#dcc8a3'],
    ['沙暴','large','zigzag',790,108,1.58,720,4,'#c4a36a','#785c36'],
    ['雷霆','large','champion',930,100,1.92,950,4,'#555a5c','#b9afa0'],
    ['大块头','large','stubborn',1080,42,1.84,880,4,'#79614b','#bba482'],
    ['闪电','small','sprinter',310,142,1.32,850,4,'#ded3ac','#7f8462'],
    ['荒野王','large','champion',1050,110,2.02,1150,4,'#513e32','#bb8247'],
    ['半导体牛','medium','thrower',620,66,1.2,720,2,'#a59d87','#373c36']
  ];
  const abilities = {
    backtrack:['回头找路','被赶急时会回头折返；提前移到外侧堵住退路，别贴身直追。'],
    gateShy:['门前犹豫','接近牛栏会突然急停；从侧后方慢慢施压，贴身猛冲会让它惊慌。'],
    leap:['轻巧跃步','受到压力会突然跃步拉开距离；留耐力追到侧面，再收窄它的路线。'],
    zigzag:['左右急摆','会连续左右变向；守住远离牛栏的一侧，避免跟着它来回摇摆。'],
    dash:['短程爆发','会突然加速冲出一段；等爆发结束再靠近，别把马的耐力一次耗完。'],
    steady:['稳步跟随','逃跑方向比较稳定；从侧后方保持距离，适合练习不套绳赶牛。'],
    duck:['低头闪绳','绳子一松就会低头钻出绳圈；短暂收紧防脱，也可主动解绳改用走位赶牛。'],
    brace:['扎步顶住','会站住顶住压力；换一侧施压，牵绳时先松开缓冲再缓慢拉动。'],
    orbit:['绕人转圈','会绕着骑手打转；拉开距离并抢到外侧，逐渐把圆圈压向牛栏。'],
    feint:['佯退折返','会假停后突然向侧面突围；不要追得太近，稳住通向栏外的退路。'],
    charge:['低头冲锋','预警后沿红线冲撞；转向加速闪开，再回到侧后方继续赶牛。'],
    throw:['直立投石','喊话时预判跑位；黄色圈跟踪，变红锁定后立刻转向加速，再回到侧后方。']
  };
  const starterAbilities=['backtrack','gateShy','leap','zigzag','dash','steady','duck'];
  const personalityAbility={docile:'steady',skittish:'leap',zigzag:'zigzag',sprinter:'dash',stubborn:'brace',roller:'orbit',trickster:'feint',aggressive:'charge',champion:'charge',thrower:'throw'};
  const unlockTiers={2:3,3:7,4:12};
  window.RanchCatalog=Object.freeze(rows.map((r,index)=>Object.freeze({
    index,nickname:r[0],size:r[1],personality:r[2],weight:r[3],speed:r[4],strength:r[5],points:r[6],tier:r[7],coat:r[8],patch:r[9],
    personalityLabel:traits[r[2]][0],tactic:traits[r[2]][1],type:r[2]==='champion'?'gold':['sprinter','skittish'].includes(r[2])?'fast':'normal',
    hornScale:r[1]==='large'?1.15+index%3*.1:r[1]==='small'?.78:1,
    bodyVariation:.92+(index%5)*.04,rage:['aggressive','champion'].includes(r[2])?.4:0,limit:180,
    ability:starterAbilities[index]||personalityAbility[r[2]],
    skillName:abilities[starterAbilities[index]||personalityAbility[r[2]]][0],
    skillHint:abilities[starterAbilities[index]||personalityAbility[r[2]]][1],
    unlockAt:index<=5||index===24?0:unlockTiers[r[7]]||0
  })));
  window.RanchHorses=Object.freeze([
    {id:'balanced',name:'栗影 · 均衡马',description:'速度、转向与牵引均衡，适合熟悉走位赶牛。',speed:330,turn:10,stamina:100,regen:23,pull:1,sprint:1.75,unlockAt:0,coat:'#9a5f3e',mane:'#463125'},
    {id:'agile',name:'燕尾 · 灵巧马',description:'转向灵活、恢复较快，适合封住退路；牵引力量较轻。',speed:315,turn:16,stamina:95,regen:26,pull:.85,sprint:1.7,unlockAt:0,coat:'#d0ba95',mane:'#5d5243'},
    {id:'endurance',name:'长风 · 耐力马',description:'耐力充足、恢复很快，适合长距离绕行与持续赶牛。',speed:310,turn:8,stamina:155,regen:31,pull:1.1,sprint:1.65,unlockAt:4,coat:'#ac9580',mane:'#e5d7bd'},
    {id:'draft',name:'铁蹄 · 挽马',description:'牵引力量最强，适合重型牛；速度较慢，转弯要提前。',speed:270,turn:6,stamina:130,regen:19,pull:1.5,sprint:1.5,unlockAt:7,coat:'#62584c',mane:'#282725'},
    {id:'mustang',name:'荒火 · 野马',description:'速度最快、冲刺猛烈，适合抢位闪避；耐力与牵引较弱。',speed:380,turn:9,stamina:90,regen:18,pull:.75,sprint:1.85,unlockAt:12,coat:'#af5435',mane:'#372823'}
  ].map(h=>Object.freeze(h)));
})();
