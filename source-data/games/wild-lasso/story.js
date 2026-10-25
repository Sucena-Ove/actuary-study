(() => {
  'use strict';
  const outfits = [
    {id:'trail',name:'旧夹克',wins:0,hat:'#A9875C',shirt:'#8C9975',scarf:'#A95339',vest:'#73563B'},
    {id:'rookie',name:'新秀赤巾',wins:1,hat:'#D6B580',shirt:'#E8D7B7',scarf:'#CA4D38',vest:'#8A5A3C'},
    {id:'county',name:'镇赛蓝衣',wins:3,hat:'#E7CF9A',shirt:'#548AA7',scarf:'#E0AE51',vest:'#304C65'},
    {id:'scholar',name:'学院归途',wins:5,hat:'#54516B',shirt:'#EEE5CE',scarf:'#789C8E',vest:'#414A77'},
    {id:'champion',name:'金穗冠军',wins:8,hat:'#D5B255',shirt:'#F4E8BD',scarf:'#C65B3E',vest:'#315C4D'}
  ];
  const characters = {
    lin:{name:'林野',role:'19 岁 · 华裔牧场家庭的孩子',color:'#A55336',initial:'野'},
    father:{name:'林川',role:'父亲 · 小牧场主',color:'#685740',initial:'川'},
    mother:{name:'许安',role:'母亲 · 家里的记账人',color:'#7B7654',initial:'安'},
    may:{name:'梅·哈珀',role:'导师 · 退役牛仔',color:'#AA8B50',initial:'梅'},
    eli:{name:'艾利·布鲁克斯',role:'对手 · 也在打工读书',color:'#5D7C83',initial:'艾'}
  };
  const prologue = [
    {id:'ridge',kicker:'WEST VIRGINIA · 清晨 05:12',title:'山谷尚未醒来',art:'dawn',text:'晨雾沿着西弗吉尼亚州的山脊流进牧场。十九岁的林野已经补好一段围栏。他在这个华裔牧场家庭长大：牛不多，旧皮卡又坏了一次；父亲算完饲料账，天还没亮。',speaker:'father',quote:'东边那扇门修好了？那就回来吃早饭。'},
    {id:'letter',kicker:'雪松溪镇 · 林家的厨房',title:'一封录取信，一本旧账',art:'kitchen',text:'大学录取通知书压在账单下面。助学金和打工的钱算进去，第一学年仍缺一笔钱。母亲在本子上写下目标：$5,200。林野想学农牧科学，也想让家里的日子松快一点。',speaker:'mother',quote:'钱的事一起想办法。录取信要放在最上面。'},
    {id:'poster',kicker:'周末集市 · 牛仔赛场',title:'把本事骑出来',art:'arena',text:'集市墙上贴出牛仔大赛的奖金表。林野会赶牛、会照料马，却没骑进过正式赛场。退役牛仔梅·哈珀递来一副旧手套，约他第二天在围栏边见。',speaker:'may',quote:'你在牧场学的那些，够做个开始。先学会稳住自己。'},
    {id:'departure',kicker:'第一场比赛 · 上路',title:'沿着山路，去读书',art:'road',text:'父亲把拖车接上皮卡，母亲塞来一包午饭。林野摸了摸马的额头，带着家里那件旧夹克出发。赛场在山路尽头，学校还要更远一点。',speaker:'lin',quote:'我先把第一场骑好。下一步，再一步。'}
  ];
  // IDs, money goals, win thresholds and clothing remain compatible with v7 saves.
  const chapters = [
    {id:'first-entry',title:'第一章 · 围栏以外',shortTitle:'围栏以外',location:'西弗吉尼亚州 · 雪松溪镇',art:'dawn',
      text:'家里的小牧场靠全家人的劳动维持。林野带着大学录取信来到赛场，跟随梅·哈珀练习，把日常赶牛的本领变成第一笔学费。',
      objective:'完整赢下 1 场大赛，学业基金达到 $300。',wins:1,prizeGoal:300,moneyGoal:300,
      rewardHint:'首场冠军获得「新秀赤巾」。解锁第二章，认识那个总比你快半步的对手。',
      scenes:[
        {title:'还没收好的录取信',location:'林家牧场 · 早餐后',art:'kitchen',body:'林野把录取信折好，放进旧夹克内袋。这个夏天，他仍要喂牛、修围栏、帮父亲记账；每个周末，则多了一件事：去赛场争一份奖金。父亲没说什么，只把拖车轮胎充得足足的。',dialogue:[{speaker:'lin',line:'我会把牧场的活干完，再去练。'},{speaker:'father',line:'也给自己留点睡觉的时间。马累了要歇，人也一样。'}]},
        {title:'梅的第一课',location:'镇外练习场 · 午后',art:'arena',body:'林野追着牛跑了三圈，离入口反倒更远。梅靠在栅栏边，指向牛的侧后方。她让他把套索挂回鞍边，先看清牛在躲什么、又想往哪里去。',dialogue:[{speaker:'may',line:'别只盯着牛角。看它留下的空档，把那条退路堵上。'},{speaker:'lin',line:'我得先到合适的位置。'}]},
        {title:'第一条赤红领巾',location:'领奖台旁 · 傍晚',art:'sunset',earned:true,body:'广播念出名字时，林野还在拍靴子上的泥。梅递来的赤红领巾有些粗糙，他系了两次才系正。回家后，母亲把第一笔奖金记进学业基金，父亲给晚饭多添了一道菜。',dialogue:[{speaker:'mother',line:'这是第一笔。以后每一笔，我都替你记清楚。'},{speaker:'lin',line:'下一场，我想骑得更稳一点。'}]}
      ]},
    {id:'town-champion',title:'第二章 · 同一条山路',shortTitle:'同一条山路',location:'县集市 · 周末巡回赛',art:'arena',
      text:'林野遇见了速度很快的艾利。两人争夺名次，也在卸马后的停车场交换打工和上学的消息。三场冠军后，报名用品和第一程车费终于不再只是账本上的空格。',
      objective:'累计赢下 3 场大赛，学业基金达到 $1,600。',wins:3,prizeGoal:1600,moneyGoal:1600,
      rewardHint:'3 场冠军获得「镇赛蓝衣」。解锁第三章，在课本、家务与赛程之间安排时间。',
      scenes:[
        {title:'快半步的人',location:'县集市 · 候场区',art:'arena',body:'艾利·布鲁克斯的马鞍磨得很旧，成绩却亮眼。他替林野扶好松动的马镫，转身就把自己的名字骑到了排行榜前面。林野记下他的路线，也记下自己两次仓促的猛拽。',dialogue:[{speaker:'eli',line:'赛场上我不会让你。出来以后，有需要搭把手的就说。'},{speaker:'lin',line:'下一轮，我要把进栏的角度修正。'}]},
        {title:'停车场里的课表',location:'赛后停车场 · 夜灯下',art:'road',body:'课堂讲义从艾利的背包里掉出来。他也在半工半读，白天修车，晚上赶作业。两人坐在拖车边吃冷掉的三明治，发现各自都在赶一条通往学校的长路。',dialogue:[{speaker:'eli',line:'赛程表旁边，给课表也留个位置。选课别拖到最后。'},{speaker:'lin',line:'记住了。下一次午饭，我多带一份。'}]},
        {title:'蓝衣和一张车票',location:'家门口 · 开学前',art:'road',earned:true,body:'镇上的裁缝送来一件耐穿的蓝衣。三场冠军的奖金加上攒下的钱，让林野买齐了开学用品。母亲把车票夹进录取信，父亲确认着接送日期。家里的日历上，第一次写进了大学报到。',dialogue:[{speaker:'father',line:'早点出发，山里容易起雾。'},{speaker:'mother',line:'到了给家里打个电话。'}]}
      ]},
    {id:'tuition',title:'第三章 · 课本与缰绳',shortTitle:'课本与缰绳',location:'大学宿舍 / 雪松溪牧场',art:'campus',
      text:'学费目标渐渐接近，时间却越来越紧。林野必须学会休息、练习和读书。家人、导师与对手都在帮他走稳这一年。',
      objective:'累计赢下 5 场大赛，学业基金达到 $3,000。',wins:5,prizeGoal:3000,moneyGoal:3000,
      rewardHint:'5 场冠军获得「学院归途」。解锁最后一章，准备期末考试与学年收官赛。',
      scenes:[
        {title:'凌晨一点的灯',location:'学生宿舍 · 秋夜',art:'campus',body:'林野把农牧科学笔记摊开，旁边放着周末赛程。几天早起晚睡后，他在练习里拉断了绳。电话那头，梅没有谈成绩，先问他上一顿饭是什么时候吃的。',dialogue:[{speaker:'may',line:'握不稳的时候先缓一缓。留住力气，下一次才拉得准。'},{speaker:'lin',line:'周五的练习改到下午。今晚先睡。'}]},
        {title:'家里寄来的包裹',location:'校园收发室 · 雨后',art:'kitchen',body:'包裹里是补好的手套、果酱，还有母亲抄下的账目。父亲在纸背画了新围栏的位置，说这周一切都好。林野第一次安心地留在图书馆，把整章笔记读完。',dialogue:[{speaker:'mother',line:'家里的活，我们轮着来。你的课也要好好上。'},{speaker:'lin',line:'放假后，我把课堂上学的牧草记录法带回来。'}]},
        {title:'带着笔记回家',location:'冬季牧场 · 炉火旁',art:'kitchen',earned:true,body:'第五场冠军的奖金到账，学费缺口又小了一截。林野穿着深靛外套回家，把课堂记录与饲料账放在一起。父亲搬来一把椅子，两个人对着旧本子算到晚饭时间。',dialogue:[{speaker:'father',line:'这个表格我看得懂。以后我们就照这个记。'},{speaker:'lin',line:'还有些地方得继续学。下学期会讲到。'}]}
      ]},
    {id:'first-year',title:'第四章 · 山路通向明天',shortTitle:'山路通向明天',location:'春季收官赛 · 学年末',art:'sunset',
      text:'期末考试和收官赛落在同一个月。林野带着全家人的支持回到赛场，与艾利认真比完最后几轮。目标达成之后，他仍有课堂、家人和下一段路要走。',
      objective:'累计赢下 8 场大赛，学业基金达到 $5,200，补齐第一学年的资金缺口。',wins:8,prizeGoal:5200,moneyGoal:5200,
      rewardHint:'8 场冠军获得「金穗冠军」。完成第一学年故事；牧场、训练与比赛继续开放。',
      scenes:[
        {title:'两张日程表',location:'厨房餐桌 · 春天',art:'kitchen',body:'期末考试与收官赛挤在同一个月。林野把两张日程表贴在冰箱上，留出复习、训练和返校的时间。梅看了几轮练习，只提醒他：每一次动作，都要有理由。',dialogue:[{speaker:'may',line:'别为了追上别人，把自己的节奏丢了。'},{speaker:'lin',line:'看清牛、留住力气，再关好门。我记得。'}]},
        {title:'终场前的握手',location:'春季赛场 · 栅栏外',art:'arena',body:'艾利刚完成一轮干净的进栏。两人碰拳，各自走向马匹。看台上，父母坐在梅旁边；这次父亲把手机横过来，准备拍一段完整的录像。',dialogue:[{speaker:'eli',line:'考完试告诉我。比赛这边，我们各凭本事。'},{speaker:'lin',line:'成交。山路上见，课堂上也见。'}]},
        {title:'明天去上课',location:'林家牧场 · 初夏清晨',art:'campus',earned:true,body:'第八场冠军后，账本上的第一学年目标终于划掉。林野回校完成考试，再带着成绩单回家。金色帽子挂在门边，他照常起早喂马，也把下学期的课程写进日历。山谷依旧在晨雾里，往前的路已经比去年清楚了一些。',dialogue:[{speaker:'mother',line:'这一年，你读下来了。'},{speaker:'lin',line:'嗯。明天的课，我也会好好上。'}]}
      ]}
  ];
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  window.RanchStory=freeze({outfits,chapters,characters,prologue,title:'山路与马蹄',subtitle:'一段关于家、学费与远方的现代西部故事',setting:'美国 · 西弗吉尼亚州',town:'雪松溪镇',currency:'$',currencyLabel:'游戏内学业基金',saveNote:'现代背景的虚构故事。雪松溪镇、人物、赛事与奖金均为创作；$5,200 是剧情中的第一学年资金缺口。进度保存在本机。',winRule:'完整大赛结束时排名第一、仍有生命值，并至少入栏3头牛，才计为一场冠军。章节同时检查累计冠军与基金，基金不扣除。'});
})();
