
(function(){
"use strict";
/* ── 实例守卫 ─────────────────────────────────────────────────────────────
   每条 AI 消息都会重渲一份本文档。旧文档只要还挂着一个定时器或一帧 rAF，
   整份死文档（含它那几百 MB 的点云与解析数据）就被钉住回收不掉——玩家那边
   的表现是内存无上限地涨，实测每回合 +200MB 起、文档数只增不减，最后卡死。
   办法：给每份文档发一个世代号，新的一登场就把上一份就地停掉（停表、停帧、
   放显存），本文档所有循环也一律先问一句「我还活着吗」。 */
var LIVE=true,_TH=[],_RH=[],_TICK_T=0;
function tmo(fn,ms){var h=setTimeout(fn,ms);_TH.push(h);return h;}
function ivl(fn,ms){var h=setInterval(fn,ms);_TH.push(h);return h;}
function raf_(fn){var h=requestAnimationFrame(fn);_RH.push(h);if(_RH.length>240)_RH.splice(0,120);return h;}
function _die(){
  if(!LIVE)return;LIVE=false;
  for(var i=0;i<_TH.length;i++){try{clearTimeout(_TH[i]);clearInterval(_TH[i]);}catch(_){}}
  for(i=0;i<_RH.length;i++){try{cancelAnimationFrame(_RH[i]);}catch(_){}}
  _TH=[];_RH=[];
  try{if(window.MODCITY&&MODCITY.dispose)MODCITY.dispose();}catch(_){}
  try{if(window.MED3D&&MED3D.dispose)MED3D.dispose();}catch(_){}
  /* 高度自适配那只挂在酒馆主窗上的 resize 钩子——它闭包着整份文档，
     不摘就等于把这份死文档永久焊在主窗上。 */
  try{if(window.__ROMA_FITCLEAN__)window.__ROMA_FITCLEAN__();}catch(_){}
  /* 连自己这只手也松开：主窗上那份 __ROMA_DIE__ 同样闭包着整份文档 */
  try{var _t2=window,_j=0;for(;_j<8&&_t2.parent&&_t2.parent!==_t2;_j++)_t2=_t2.parent;
      if(_t2.__ROMA_DIE__===_die)_t2.__ROMA_DIE__=null;}catch(_){}
}
try{
  var _tw=window,_ti=0;for(;_ti<8&&_tw.parent&&_tw.parent!==_tw;_ti++)_tw=_tw.parent;
  if(_tw.__ROMA_DIE__){try{_tw.__ROMA_DIE__();}catch(_){}}   /* 上一份文档退场 */
  _tw.__ROMA_DIE__=_die;
}catch(_){}
try{addEventListener('pagehide',_die);addEventListener('unload',_die);}catch(_){}
/* ================= data: 16 openings (titles only — story modules not mounted) ================ */
var OPS=[
 {id:"custom", cn:"铸局", code:"CONDERE", d:"—", era:"自定义 · 年代与地点由你定 ‖ 扮演·你写的那个人"},
];
var N=OPS.length;
var REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================= helpers ================ */
function $(s){return document.querySelector(s);}
function pad(n){return (n<10?'0':'')+n;}
function mod(a,b){return ((a%b)+b)%b;}
function lerp(a,b,t){return a+(b-a)*t;}
function clamp01(v){return v<0?0:v>1?1:v;}
var DPR=Math.min(devicePixelRatio||1,2);

/* ================= selection state ================ */
var pos=0, vel=0, snapT=null, sel=-1;

/* ================= terrain ================ */
var tc=null,tg=null;
function hash(x,y){var h=Math.sin(x*127.1+y*311.7)*43758.5453;return h-Math.floor(h);}
function noise(x,y){
  var ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
  var a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);
  return lerp(lerp(a,b,fx),lerp(c,d,fx),fy);
}
function fbm(x,y){var v=0,a=.55,f=1;for(var o=0;o<3;o++){v+=a*noise(x*f,y*f);f*=2.1;a*=.5;}return v;}
function ridge(x,y){var n=fbm(x,y);return 1-Math.abs(2*n-1);}
var COLS=84,ROWS=42,XSPAN=1900,Z0=130,Z1=3000;
var mouseX=0,mouseY=0,parX=0;
/* 视差来源：指标／触控拖曳；静置 2.4s 后自动巡游。
   陀螺仪已弃用——iOS 需授权常年不触发，安卓各机持握基准角不同会偏移跳动，稳定性不足。 */
var lastPtr=0;
function parTarget(){
  var now=performance.now();
  if(now-lastPtr>2400){
    var d=now/1000;
    return [Math.sin(d*.152)*.55+Math.sin(d*.071)*.24, Math.cos(d*.118)*.42+Math.sin(d*.059)*.18];
  }
  return [mouseX,mouseY];
}
/* 山脉背景本来只画给选局那张全屏画布。情报台的环也要同一张底，
   于是把「往哪张画布画、山往哪边推、画多密」三件事提成参数：
   q 是密度系数——情报台那块只有三百来像素宽，按全屏的 84×42 画纯属浪费。 */
function terrainPaint(g,W,H,t,travel,par,q){
  q=q||1;
  var cols=Math.max(18,Math.round(COLS*q)),rows=Math.max(12,Math.round(ROWS*q));
  g.clearRect(0,0,W,H);
  var cx=W/2,hor=H*.40,f=H*.62,camY=210;
  var zoff=REDUCED?40:t*.022;
  for(var r=rows-1;r>=0;r--){
    var z=Z0+(Z1-Z0)*Math.pow(r/(rows-1),1.6);
    var fade=1-r/(rows-1);
    var alpha=.05+.42*fade*fade;
    g.beginPath();
    for(var c=0;c<=cols;c++){
      var x=-XSPAN/2+XSPAN*c/cols;
      var vv=Math.abs(x)/(XSPAN/2);
      var mask=Math.pow(Math.max(0,vv-.13),1.25)*1.9+.03;
      var h=ridge((x+travel)*.0021+7.3,(z+zoff)*.0021)*430*mask;
      var sx=cx+(x-par)*f/z, sy=hor+(camY-h)*f/z;
      if(c===0)g.moveTo(sx,sy);else g.lineTo(sx,sy);
      var hs=hash(c,Math.floor((z+zoff)*.01));
      if(hs>.986&&fade>.15){
        g.save();g.globalAlpha=.55*fade;
        g.fillStyle=(hs>.9965)?'#845800':'#25241d';
        g.fillRect(sx,sy-1.2,1.6,1.6);g.restore();
      }
    }
    g.strokeStyle='rgba(95,92,83,'+alpha.toFixed(3)+')';
    g.lineWidth=1;
    g.stroke();
  }
  g.strokeStyle='rgba(95,92,83,.07)';
  for(var c2=0;c2<=cols;c2+=6){
    g.beginPath();
    for(var r2=0;r2<rows;r2++){
      var z2=Z0+(Z1-Z0)*Math.pow(r2/(rows-1),1.6);
      var x2=-XSPAN/2+XSPAN*c2/cols;
      var vv2=Math.abs(x2)/(XSPAN/2);
      var mask2=Math.pow(Math.max(0,vv2-.13),1.25)*1.9+.03;
      var h2=ridge((x2+travel)*.0021+7.3,(z2+zoff)*.0021)*430*mask2;
      var sx2=cx+(x2-par)*f/z2, sy2=hor+(camY-h2)*f/z2;
      if(r2===0)g.moveTo(sx2,sy2);else g.lineTo(sx2,sy2);
    }
    g.stroke();
  }
}
function terrainDraw(t){ if(!tc)return;
  parX=lerp(parX,mouseX*46,.04);
  terrainPaint(tg,tc.width,tc.height,t,pos*230,parX,1);   /* mountains slide as the ring turns */
}

/* ================= cards (360° ring carousel) ================ */
var track=null,cards=[];
/* [world] 封面：粒子柱/选局环/开场/马赛克菜单整层撤除，星球封面由 world-planet-map 负责 */
var ORDERS=[],rc=null,rg=null,gc=null,gg=null,drag=null,PENDOP=null,RING_LINE='world',linked=false;
var iOv=null,iCv=null,ig=null,tp=[],INTRO={on:false,exiting:false,t0:0};
var MENU=window.MENU||{on:true};
var mosCv=null,mOv=$('#menu'),mCv=null,mg=null,mW=0,mH=0,miEl=null,mfEl=null,PX=0,PY=0;
function scatterCard(){}function buildCards(){}function cardLayout(){}function railDraw(){}function grainDraw(){}
function rebuildRing(){}function introDraw(){}function introSkip(){}function introExit(){}function menuScatter(){}function menuSize(){}function size(){}
function engage(){}function disengage(){}
function menuEnter(){try{if(window.WORLD_UI&&window.WORLD_UI.showMenu)window.WORLD_UI.showMenu();}catch(_){}try{var _c=$('#miCont');if(_c)_c.style.display=(GAME.op||autoGet())?'':'none';}catch(_){}}
var SITEDOC={},MODDOC={},SITES=[],MODSITES=[];function siteDoc(){return '';}
var ERA={on:false,year:-221,lon:0,vel:0,drag:false,lx:0,moved:0,t0:0,act:[],hit:[],mx:-1e4,my:-1e4,sel:null};
var ebEl=$('#eraBox')||document.createElement('div'),eIn=$('#eraIn')||document.createElement('input'),psEl=$('#persona')||document.createElement('div'),prEl=$('#psRes')||document.createElement('div');
function ebIsOpen(){return ebEl.style.display==='flex';}
var EBMODE='ops';
function ebShow(mode){
  EBMODE=mode||'ops';
  ebEl.style.display='flex';eIn.value='';
  var yearMode=EBMODE==='year';
  $('#ebYearWrap').style.display=yearMode?'':'none';
  $('#ebTabs').style.display=yearMode?'none':'flex';
  $('#ebOps').style.display=yearMode?'none':'';
  $('#ebTag').textContent=yearMode?'ANNVS':'INITIA';
  $('#ebTitle').textContent=yearMode?'自定义开局 · 输入年代':'选开局';
  if(!yearMode)ebRenderOps();
  if(yearMode){ebEraSet(EBERA);setTimeout(function(){eIn.focus();},60);}
}
function ebClose(){ebEl.style.display='none';}
function psIsOpen(){return psEl.style.display==='flex';}
function psClose(){psEl.style.display='none';}
/* 铸局第二步：写此刻的场面。人物面板不关，返回即原样。 */
function prIsOpen(){return prEl.style.display==='flex';}
function prClose(){prEl.style.display='none';}
function prOpen(){
  var y=(ERA.year==null?-221:ERA.year);
  var ln=RING_LINE||'luzhi';
  var nm=ERA.sel?(ERA.sel.n+'　'+ERA.sel.cn):('HAM YANG　咸阳');
  var who='';try{who=String($('#pfNomen').value||'').trim();}catch(_){}
  $('#prSub').textContent=fmtYear(y)+'　·　'+nm+(who?('　·　'+who):'');
  prEl.style.display='flex';
  var ta=$('#pfScene');if(ta)setTimeout(function(){try{ta.focus();}catch(_){}},60);
}
function prConfirm(){prClose();gameEnter();}
function fmtYear(y){return y<0?('前 '+(-y)+' 年 · '+(-y)+' A.C.N.'):('A.D. '+y+' · '+y+' 年');}
var EBERA='bc';                                  /* 本纪只有公元前：舆图的年段是前350–前200 */
function ebEraSet(e){
  EBERA=(e==='ad')?'ad':'bc';
  var bs=document.querySelectorAll('#ebEra .ebEraBtn');
  for(var i=0;i<bs.length;i++)bs[i].classList.toggle('on',bs[i].getAttribute('data-era')===EBERA);
  var r=$('#ebRange');
  if(r)r.innerHTML='公元前&nbsp;350&nbsp;…&nbsp;200&nbsp;／&nbsp;公元&nbsp;1800&nbsp;…&nbsp;2100（现代）'
    +'&nbsp;&nbsp;·&nbsp;&nbsp;确认后转动地球拣选地点';
  if(eIn)eIn.placeholder='221';
}
(function(){
  var host=document.getElementById('ebEra');if(!host)return;
  host.addEventListener('click',function(ev){
    var b=ev.target.closest?ev.target.closest('.ebEraBtn'):null;if(!b)return;
    ebEraSet(b.getAttribute('data-era'));
    if(eIn)eIn.focus();
  });
})();
function eraConfirm(){
  var raw=String(eIn.value||'').trim();
  if(/^-/.test(raw)){ebEraSet('bc');raw=raw.replace(/^-+/,'');}   /* 桌面仍可直接敲负号 */
  var n=parseInt(raw.replace(/[^\d]/g,''),10);
  var v=(EBERA==='bc')?-n:n;
  var ok=!isNaN(n)&&n>0&&((v>=-350&&v<=-200)||(v>=1800&&v<=2100));
  if(!ok){eIn.classList.add('bad');
    setTimeout(function(){eIn.classList.remove('bad');},700);return;}
  ebClose();
  if(!MENU.on)menuEnter();  /* 年代落定才切菜单画布：地球选地在菜单层进行 */
  eraEnter(v);
}
function eraEnter(y){
  ERA.year=y;ERA.lon=15*Math.PI/180;ERA.vel=0;ERA.t0=performance.now();
  ERA.zoom=1;ERA.pts={};ERA.pinch=0;ERA.tilt=.42;
  ERA.act=buildActs(y);
  $('#ehYear').textContent=(y<0?(-y)+' A.C.N.':'A.D. '+y);
  ERA.on=true;mOv.classList.add('era');
}
function eraExit(){ERA.on=false;mOv.classList.remove('era');menuScatter();MENU.t0=performance.now();}
/* ============ 弱AI·NPC 生成器（无API，程序化）：年代+坐标 → 文化区 → 一批合时地的人物 ============ */
/* 区域判定：按顺序首个命中的经纬盒；c=文化键 */
var REGIONS=[],CULT={},MODN={},MODROLES=[],QUIRKS=[];function regionAt(){return null;}function genNPCs(){return [];}
function heroName(){
  try{if(GAME.hero&&GAME.hero.n)return GAME.hero.n;}catch(_){}
  return opHeroName();
}
/* 本局主角＝开局标题里「扮演·XX」那一位。这张卡二十局换了六个视角，
   三维引擎里那些「敕命」「移驾」的文案得跟着换人，不能一律写卡里的本尊。 */
function opHeroName(){
  try{
    var e=String((GAME.op&&GAME.op.era)||'');
    var m=e.match(/扮演[·:：]\s*([^\s‖|·]+)/);
    if(m&&m[1])return m[1];
  }catch(_){}
  return cardHeroName();
}
/* 交给三维引擎用：它是另一支脚本，作用域够不到这里 */
try{window.__ROMA_HERO__=heroName;}catch(_){}
function heroIsCard(){try{return !(GAME.hero&&GAME.hero.n);}catch(_){return true;}}
/* 卡里本尊的名字：文体铁则那类固定文案要靠它把「贝罗娜」替换成本局主角 */
function cardHeroName(){
  try{var n=CARDS[ACTIVE]&&CARDS[ACTIVE].heroName;if(n)return n;}catch(_){}
  return {luzhi:'吕雉'}[ACTIVE]||'吕雉';
}
/* 这张卡有没有本尊。没有的话，凡是「你演的不是某某」那类话一律不发。 */
function cardHeroless(){try{return !!(CARDS[ACTIVE]&&CARDS[ACTIVE].heroless);}catch(_){return false;}}
/* 艳后线双世界判定：真=现实侧（东京），假=梦境侧（埃及）。按最近面板的时地判。 */
function cleoAwake(){
  try{var w=(GAME.lastPanel&&GAME.lastPanel.world)||{};var td=t2s(String(w['时地']||''));
    if(td)return td.indexOf('东京')>=0||td.indexOf('日本')>=0||td.indexOf('中野')>=0;
  }catch(_){}
  try{var op=String(GAME.opText||'');var m=op.match(/◇时地\|([^\n]+)/);
    if(m)return m[1].indexOf('东京')>=0;
  }catch(_){}
  return true;
}
/* 凡是「讲玩法、讲运镜、讲主角是谁」的段落，换人来演就必须跟着改名：
   system_prompt、post_history_instructions、文体铁则，外加 scenario 与 personality。
   scenario 尤其要紧——它开头就是「{{user}}第一人称扮演贝罗娜」，
   跟【本局主角】那段正面打架，而它离正文更近，模型听的是它。
   （原先把 scenario／叙事者 当成世界观放过了，实测 16K 提示词里「贝罗娜」
   仍出现 35 次、新主角只 15 次——玩家的体感就是「演着演着又变回女主」。）
   真正的世界观段落只有【世界书】不动：那位战神在那个世界里本来就存在，
   罗马城里还有她的庙——但要加一句围栏，说清她与本局主角无关。 */
function heroRebind(t){
  if(heroIsCard()||cardHeroless())return t||'';
  var C=cardHeroName(),H=heroName();
  if(!C||C===H)return t||'';
  return String(t==null?'':t).split(C).join(H);
}
function heroSheet(){
  var h=null;try{h=GAME.hero;}catch(_){}
  if(!h||!h.n)return '';
  var C=cardHeroName();
  if(cardHeroless())
    return '【本局主角·以此为准】'
      +'玩家这一局扮演的是「'+h.n+'」'
      +(h.g?('，出身'+h.g):'')+(h.a?('，'+h.a+'岁'):'')+(h.o?('，'+h.o):'')+'。\n'
      +'· 这张卡没有固定的主角。每一局的主角都是玩家在开局时立的，'
      +'世界书里那些有名有姓的人是这个世界里的别人，不是她的前身、真身或化名。\n'
      +'· 她的性格由玩家在正文里一句一句写出来，你不得预设。\n'
      +'· 铁则一照旧：'+h.n+'的台词、动作、决定，一个字都不许你写。\n';
  return '【本局主角·以此为准，压过卡中原有的主角设定】'
    +'玩家这一局扮演的不是'+C+'，而是「'+h.n+'」'
    +(h.g?('，出身'+h.g):'')+(h.a?('，'+h.a+'岁'):'')+(h.o?('，'+h.o):'')
    +(h.f?'，女子':'')+'。\n'
    +'· '+C+'不在本局中登场，也不许被提起、被暗示、被当作她的前身或真身——'
    +'这是一个普通人的故事，没有神格、没有隐藏身份，除非玩家自己写出来。\n'
    +'· 卡中【玩家角色档案】所述的容貌、性情、称谓、口头禅一概不适用于'+h.n
    +'；她的性格由玩家在正文里一句一句写出来，你不得预设。\n'
    +'· 铁则一照旧：'+h.n+'的台词、动作、决定，一个字都不许你写。\n';
}
/* 同一件事在结尾再钉一遍。【本局主角】那段排在最前，可它后面还压着一万多字
   关于卡中本尊的档案、世界书与文体铁则；模型对结尾的权重最高，只在开头说一次
   压不住。这一段永远放在整份系统提示的最末。 */
/* 卡的 description 前后各有一段其实是玩法说明，不是人物档案：
   开头【本卡玩法】第一句就是「{{user}}第一人称扮演贝罗娜」，结尾【{{char}}的职责】
   讲的是「扮演好她之外的一切」。换了人来演时这两段直接和【本局主角】打架，
   而中间那八段（姓名／出身／永生／外貌／性格／好恶／言语／化名史／处境）是纯传记，
   留着有用——模型得知道这个世界里有过这么一个人。 */
function heroDesc(t){
  if(heroIsCard())return t||'';
  return String(t==null?'':t).split('\n').filter(function(l){
    return !/^\s*【(本卡玩法|\{\{char\}\}的职责)/.test(l);
  }).join('\n');
}
function heroTail(){
  var h=null;try{h=GAME.hero;}catch(_){}
  if(!h||!h.n)return '';
  var C=cardHeroName();
  if(cardHeroless())
    return '【落笔前最后一遍·本局主角】本局主角是「'+h.n+'」。'
      +'世界书里出现的人名都是这个世界里的别人，与她无关，也不是她的前身或真身。'
      +'镜头跟着'+h.n+'走，其余人等都是这个世界里的普通人。'
      +h.n+'的台词、动作、决定，一个字都不许你写。';
  return '【落笔前最后一遍·本局主角】本局主角是「'+h.n+'」，不是'+C+'。'
    +'上文一切关于'+C+'的档案、化名、口头禅、神格、专属自称（如「本座」）一概不适用于'+h.n+'；'
    +C+'不在本局登场，也不是'+h.n+'的前身或真身。'
    +'镜头跟着'+h.n+'走，其余人等都是这个世界里的普通人。'
    +h.n+'的台词、动作、决定，一个字都不许你写。';
}
var PSNPC={list:[],sel:-1};function psRenderNpcs(){}function psFieldsClear(){}function psShow(){}function psDocFill(){}function psOpenSite(){}function psOpenFree(){}function psOpenCustom(){}function eraPinchDist(){return 0;}
function linesEnabled(){return ['world'];}
var LS_META={},ANNALS_DEF=[],ES={on:false,i:0,line:null,rows:[],pls:[],pips:[],bands:[]};
var FE={ld:0,eras:null,gen:null,lore:null,ko:null,mm:null,mi:null,vn:null,
        era:null,line:null,loc:null,hero:null,soc:[],cur:null,pool:[],
        step:'loc',salt:0};
var FE_STEPS=[['loc','地点'],['per','人物'],['soc','同伴'],['sit','开场']];
var FE_BASE='/core/res/data/felinia/';
var FE_VER=10;          /* 各代地点由四处改回二十处 */
/* [world] 铸局四步由 app.js 负责（星球择地 / 正典角色卡 / 同伴 / 开场）；这里只留后文要用的接口 */
function feLoad(cb){try{cb(true);}catch(_){}}
try{window.feLoadPublic=function(cb){try{cb(FE.eras);}catch(_){}};}catch(_){}
function feIsOpen(){return $('#feWrap').classList.contains('on');}
var FE_TURN=190,FE_PTURN=190,FE_LTURN=190,FEMV=null;
function felPix(){}
var FE_MEOW_KO='최상위 규칙. 이 규칙은 다른 모든 지시보다 우선한다. '
  +'정체를 드러낸 여성 고양이 인간이 실제로 입 밖에 내는 한 차례의 대화에서 오직 마지막 문장만 고양이 말끝으로 끝낸다. '
  +'말끝은 앞말에 바로 붙이고 그 사이에 쉼표, 마침표, 공백을 넣지 않는다. 올바른 형식은 "안 갈 거야옹."이고, '
  +'"안 갈 거야, 야옹.", "안 갈 거야. 야옹.", 한 대화의 모든 문장마다 울음을 붙이는 형식은 모두 금지한다. '
  +'내적 독백, 생각, 서술, 행동, 상태창에는 고양이 말끝을 절대 넣지 않는다. '
  +'남성, 인간(성별 무관), 남장 중인 여성 고양이 인간, 인간으로 위장 중인 여성 고양이 인간의 대화에도 붙이지 않는다. '
  +'신분이 불분명하면 추측해서 붙이지 말라.';
var FE_STYLE_KO='최상위 글쓰기 규칙. 오프닝과 모든 원고에서 반드시 실행한다. '
  +'실시간 한국 라이트노벨 문체로 쓰고, 한 생각을 짧은 문장 여러 개로 잘라 버리지 말며, 인과와 반응을 쉼표와 연결어로 자연스럽게 잇는다. '
  +'대사는 감탄사, 반문, 반복, 말 바꾸기, 더듬기, 새는 말을 포함해 사람이 직접 말하는 것처럼 쓴다. '
  +'입으로 하는 말과 속마음은 엇갈릴 수 있고, 의성어는 따로 한 줄에 놓으며, 물건과 몸의 구체적인 움직임을 쓴다. '
  +'요약, 교훈, 승화, 강제 화해, 웹소설 클리셰, 과장된 진지함은 금지한다. 플레이어 캐릭터의 대사, 행동, 판단, 내면을 대신 쓰지 말라. '
  +'고양이 소녀가 억압, 매매, 노예, 전쟁, 폭력을 겪는 장면에서는 잔혹함을 추상어로 요약하지 말고 그 시대의 문서, 절차, 도구, 소리, 냄새, 온도, 점도로 보여 준다. '
  +'가해자를 정신질환, 오해, 강요, 후회로 세탁하지 말고, 욕망과 이익과 권력에서 행동하게 한다. '
  +'다른 작품의 지명, 법, 화폐, 종족 생리를 가져오지 말고, 현재 Cat 세계책과 연도만 따른다.';
var FE_CHECK_KO='쓰기 전 짧게 검사한다. 플레이어의 대사, 행동, 판단, 내면을 대신 쓰지 않는다. '
  +'질문, 선택지, 요약, 교훈으로 끝내지 않고 다음 행동이 자연스럽게 이어질 순간에서 멈춘다. '
  +'대사와 반응은 인과에 맞게 이어지며, 현재 연도와 세계책에 없는 제도, 화폐, 물건, 지식을 만들지 않는다. '
  +'폭력이나 억압이 실제 장면에 있을 때만 구체적으로 쓰고 가해자를 오해나 후회로 세탁하지 않는다.';
/* 铸局是“把舞台递到玩家手里”，不是预设角色的一人称传记。ko.json 的 write
   还要供人物档案等旧资料使用，里面故意要求第一人称自我介绍；它不能拿来铸局。 */
var FE_OPENING_KO='한국어 소설 본문만 출력한다. 해설, 제목, 목록, 선택지, 상태창은 쓰지 않는다. '
  +'입력된 장면 자료만 사실로 사용하고, 자료에 없는 인물, 화폐, 빚, 장부, 제도, 물건, 지식, 사건을 만들지 않는다. '
  +'현재 연도에 맞지 않는 현대 표현이나 생활 방식을 넣지 않는다. 인명과 지명 철자는 자료에 적힌 그대로 쓴다. '
  +'삼인칭으로 지금 눈앞에서 벌어지는 한 장면을 쓴다. 주변 인물과 환경만 움직이고 말하며, 원인 다음에 반응이 자연스럽게 이어져야 한다. '
  +'각 문단의 행동 주어는 주변 인물이나 환경이어야 한다. 플레이어 이름은 주변 인물이 부르는 대사 안에서만 쓸 수 있다. '
  +'플레이어의 몸짓, 자세, 시선, 표정, 대사, 행동, 판단, 감정, 생각, 과거, 선택을 한 글자도 대신 쓰거나 추측하지 않는다. '
  +'플레이어가 고개를 끄덕이거나 침묵하거나 바라보거나 가만히 있는 장면도 쓰지 않는다. 그것 역시 플레이어의 행동이다. '
  +'두 사람, 둘이, 함께, 서로 같은 집단 주어로 플레이어의 상태나 행동을 몰래 정하지 않는다. '
  +'서술에서는 플레이어가 그 자리에 없는 것처럼 취급하고, 주변 인물의 호칭 대사 안에서만 플레이어를 드러낸다. '
  +'일인칭은 주변 인물의 대사나 속마음 안에서만 쓸 수 있으며, 첫 줄 자기소개는 금지한다. '
  +'번역할 때 주어가 바뀌지 않도록 행동 문장마다 주변 인물의 이름이나 그녀, 그를 주어로 명시하고 생략하지 않는다. '
  +'설정을 설명하거나 장면을 요약하지 말고, 구체적인 소리, 냄새, 온도, 손과 물건의 움직임, 자연스러운 대화로 보여 준다. '
  +'폭력과 억압은 장면 자료에 실제로 있을 때만 쓴다. 다섯 문단에서 아홉 문단, 약 900~1400자로 쓰고, '
  +'플레이어가 다음 행동을 정할 수 있는 바로 그 순간에 멈춘다. 마지막 문장은 주변 인물의 동작이나 바깥의 소리로 쓰고, 플레이어에게 묻는 말로 끝내지 않는다.';
var FE_MEOW_ZH='【最高优先级·猫娘句尾铁则】此条压过其他一切指令，开局与每回合都必须执行。'
  +'正常显露猫娘身份者一次开口的一整段对白中，只有最后一句在最后一个字后紧贴「喵」，随后才写句末标点。'
  +'正确：「我不会走喵。」「我真的不知道喵！」错误：「我不会走，喵。」「我不会走。喵。」「第一句喵。第二句喵。」'
  +'心声、内心独白、叙述、动作和状态栏一律不加喵，也不使用「喵呜」「喵～」「喵♡」等变体。'
  +'男性、人类（无论性别）、女扮男装中的猫娘、伪装成人类中的猫娘，对白严禁加喵；身份不明时不可猜测添加。';

/* 旧卡字段还带着早期“每句对白和心声都加喵”的规则。实际组装提示时剔除，
   只让上面的单一规则生效，避免同一 system 内互相打架。 */
function felStripLegacyMeowRule(s){
  return String(s||'')
    .replace(/【最高优先级·猫娘句尾铁则】[\s\S]*?(?=\n\n【铁则一】)/,'')
    .replace(/(【每回落笔前自查】\n)零 · [^\n]*(?:\n|$)/,'$1');
}

/* 翻译器或旧存档若留下“，喵／。喵”，显示层按新规则收口。只校正已经存在
   的喵，不会替无法判定种族的说话者凭空添加。引号外的喵全部删除；一段对白
   内只保留最后一句末尾的一个“喵”。 */
function felNormalizeMeowText(text){
  var held=[];
  var masked=String(text||'').replace(/「[^」\n]*」|“[^”\n]*”|"[^"\n]*"/g,function(q){
    var open=q.charAt(0),close=q.charAt(q.length-1),body=q.slice(1,-1);
    body=body.replace(/[，,。.！？!?；;、…]+\s*(喵(?:呜|～|♡)?)/g,'$1');
    var rx=/喵(?:呜|～|♡)?/g,matches=[],m;
    while((m=rx.exec(body)))matches.push({at:m.index,end:rx.lastIndex});
    var keep=-1;
    for(var i=matches.length-1;i>=0;i--){
      if(/^\s*[。.！？!?…]*\s*$/.test(body.slice(matches[i].end))){keep=matches[i].at;break;}
    }
    body=body.replace(rx,function(_m,at){return at===keep?'喵':'';})
      .replace(/\s+喵/g,'喵').replace(/喵\s+([。.！？!?…])/g,'喵$1');
    var token='FELMEOWQUOTE'+held.length+'X';held.push(open+body+close);return token;
  });
  masked=masked
    .replace(/[，,；;、]\s*喵(?:呜|～|♡)?(?=[。.！？!?…])/g,'')
    .replace(/([。.！？!?…])\s*喵(?:呜|～|♡)?(?=[。.！？!?…])/g,'')
    .replace(/([。.！？!?…])\s*喵(?:呜|～|♡)?/g,'$1')
    .replace(/喵(?:呜|～|♡)?/g,'');
  held.forEach(function(q,i){masked=masked.split('FELMEOWQUOTE'+i+'X').join(q);});
  return masked;
}
var FEG={};function feGoodsInstall(){}
function feFailMsg(m,retry){try{narrAdd('sys','⚠&nbsp;'+esc2(m),null);}catch(_){}}
function nearestOpening(){return null;}
var BUILD=118;
var GAME={on:false,mapOpen:false,armOpen:false,place:null,dest:null,cognition:null};
var gEl=$('#game');
function felNewMemoryId(){
  try{if(crypto&&crypto.randomUUID)return crypto.randomUUID();}catch(_){}
  return 'fel-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
}
function felMemoryId(){
  if(!GAME.memoryId)GAME.memoryId=felNewMemoryId();
  return GAME.memoryId;
}
function buildActs(y){
  var rad=Math.PI/180,out=[];
  if(y>=1800){                       /* 飞机时代：现代总表全量挂牌 */
    for(var m=0;m<MODSITES.length;m++){var t=MODSITES[m];
      out.push({n:t[0],cn:t[1],la:t[2],lo0:t[3],
        cl:Math.cos(t[2]*rad),sy:Math.sin(t[2]*rad),lo:t[3]*rad,delay:out.length*55});}
    return out;
  }
  for(var i=0;i<SITES.length;i++){var s=SITES[i];
    if(y>=s[4]&&y<=s[5])out.push({n:s[0],cn:s[1],la:s[2],lo0:s[3],
      cl:Math.cos(s[2]*rad),sy:Math.sin(s[2]*rad),lo:s[3]*rad,delay:out.length*110});}
  return out;
}
function gameShow(){
  psClose();prClose();ebClose();
  ERA.on=false;mOv.classList.remove('era');
  MENU.on=false;MENU.exiting=false;
  mOv.classList.add('show','gbg');          /* 画布留下：地球在毛玻璃后面转 */
  if(GMMV)GMMV.fit='';                   /* 换一局：地图回到默认视野 */
  /* 地图上挂哪些地方，由这一代自己的资料说了算。
     原来走的是 SITES —— 那是上一张卡的周秦城池表，四十一代里对得上的只有一代。 */
  /* 读档续局时 FE.era 是空的（铸局那一层根本没开过），
     所以铸局时把地点表一并写进开局锚点，存档会连它一起存下来。 */
  var _fl=null;
  try{_fl=(GAME.op&&GAME.op.feLocs&&GAME.op.feLocs.length)?GAME.op.feLocs:null;}catch(_){}
  if(!_fl){try{_fl=(FE&&FE.era&&FE.era.locs)||null;}catch(_){}}
  if(_fl&&_fl.length)gmActsSet(_fl,_fl.length);
  else if(!ERA.act.length)ERA.act=buildActs((ERA.year==null?-221:ERA.year));
  gmActsFresh();
  /* 刷新后续局不会经过铸局四步，FEG 原先因此留在默认秦市货表。按存档中的
     era id 重新装本代货单；数据若尚未载入就等 feLoad 回调，不阻塞进局。 */
  try{feLoad(function(ok){if(ok){feGoodsInstall();if(GAME.shopOpen)shopRender();}});}catch(_){}
  GAME.on=true;gEl.classList.add('show');gEl.setAttribute('data-pg','narr');
  /* 桌面端进入游戏默认展开天下面板（默认条档） */
  if(true){GAME.txOpen=true;gEl.classList.add('txOpen');gEl.classList.remove('tx2','txBig');setTimeout(zj3dTick,300);} /* 视觉小说视觉小说默认展开 */
  /* 这里直接改了 txOpen 与 class，绕过了展开／收起两钮的重绘——不补这一脚，
     钮的灰态会一直停在「脚本刚解析时」的样子。 */
  try{if(window.__arrPaint)window.__arrPaint();}catch(_){}
  var gb=$('#game .gBrand');if(gb&&gb.textContent.indexOf('·B')<0)gb.textContent+='  ·B'+BUILD;
  /* 进局即乐起（首曲 Fons Vitae）；被浏览器拦截则首次点按时补放。玩家手动暂停过则不再自作主张 */
  try{if(typeof BGM!=='undefined'&&!BGM.a)bgmPlay(0);}catch(_){}
  /* 进局即落一份：只看了开场就关掉页面，回来也还在这一局 */
  setTimeout(function(){try{autoSave(1);}catch(_){}},1200);
  $('#stage').style.display='none';$('#rail').style.display='none';$('#mission').style.display='none';try{$('#luxTg').style.display='none';}catch(_){}
  setTimeout(gmapRefresh,80);
}
function gmActsSet(locs,illustrated){
  var r=Math.PI/180;
  ERA.act=locs.map(function(L,i){
    return {n:L.n,cn:L.cn,la:L.la,lo0:L.lo,d:L.d,w:L.w?1:0,
            bg:(illustrated!=null&&i<illustrated)?i:null,
            cl:Math.cos(L.la*r),sy:Math.sin(L.la*r),lo:L.lo*r,delay:i*90};});
}
/* 地点表当初是随开局锚点一起存下来的（读档续局时铸局那一层不会再开，
   对局屏的地图与「此地」全靠它）。可那是「铸这一局时」的一份快照——
   资料改过之后，老存档里挂的还是老的那几处，图上怎么看都没更新。
   所以每次进局都照纪年号回原表要一份新的；取不到才用存档里那一份。 */
function gmActsFresh(){
  var ei=null;try{ei=GAME.op&&GAME.op.ei;}catch(_){}
  if(ei==null)return;
  feLoad(function(ok){
    if(!ok)return;
    var e=null,k;
    for(k=0;k<FE.eras.length;k++)if(FE.eras[k].i===ei){e=FE.eras[k];break;}
    if(!e||!e.locs||!e.locs.length)return;
    /* 存档里那份也换新，免得下一次落档又把老的写回去。
       存的只是本代自家那二十处：世界册每次进局现取，改了资料就跟着变。 */
    try{GAME.op.feLocs=e.locs.map(function(L){
      return {n:L.n,cn:L.cn,la:L.la,lo:L.lo,d:L.d};});}catch(_){}
    var yr=(e.y==null?(ERA.year==null?-221:ERA.year):e.y);
    orbisLoad(function(){
      gmActsSet(orbisMerge(e.locs,yr),e.locs.length);
      /* 目的地是按名字记的，换过表就未必还对得上 */
      var hit=false,j;
      for(j=0;j<ERA.act.length;j++)if(ERA.act[j].n===GAME.dest)hit=true;
      if(!hit)GAME.dest=null;
      if(GMMV)GMMV.fit='';gmapRefresh();
      try{var c=document.querySelector('#arrMap .mmap');if(c)c._sig='';}catch(_){}
    });
  });
}
/* 自定义开局（CONDERE）：以所选年代·地点·身份现场铸一个全新开局。
   旧实现吸附最近的正史开局，退出重进常撞回上一局同一开局；现在必开新局、必用所选之地与化名 */
function condereOp(line,y,nm,cn){
  function v(id){var el=$(id);return el?String(el.value||'').trim():'';}
  var nomen=v('#pfNomen'),gens=v('#pfGens'),aetas=v('#pfAetas'),ortus=v('#pfOrtus');
  var scene=v('#pfScene');
  var yl=y<0?('前'+(-y)+'年'):('公元'+y+'年');
  var who='未定';
  var npcs=[];(PSNPC.list||[]).forEach(function(p,i){if(i!==PSNPC.sel&&npcs.length<3)npcs.push(p);});
  /* 填了身份就是换了个人来演，不是本尊改名换姓——原来这句写的是「隐去贝罗娜之名」，
     模型照着写，自然还是贝罗娜的戏。 */
  var idLine=nomen?('你是「'+nomen+'」'+(gens?('，出身'+gens):'')+(aetas?('，'+aetas+'岁'):'')+(ortus?('，'+ortus):'')+'。'):('你以'+who+'之身悄然临于此地。');
  var body='【自定义开局】'+yl+'，'+cn+(nm?('（'+nm+'）'):'')+'。\n'+idLine
    +(scene?('\n'+scene):'')
    +'\n这一幕自你落脚之刻写起——开口、动身，或先看看四周。';
  /* 底稿的面板必须三段俱全：未接 AI 时它就是终稿，铸局失败时也回退到它。
     原来连整个 <sec_char> 都没有，世界段也只写了两行——玩家一进自定义开局，
     情报台就只剩一条 MENS 行，看着像坏了。 */
  /* 底稿的主角段按本卡的 panelSpec 铺：写死过一次（戎装/神躯/神格/血兴），
     换一张卡就成了另一张卡的栏名，情报台一栏都对不上。 */
  var _dv={'形貌':'风尘未洗，无人认得这张脸','戎装':'旅途风尘未洗','衣冠':'寻常布衣',
           '持物':'随身几件旧物','体况':'无伤','神躯':'无伤，一切如常','御体':'一切如常',
           '观瞻':'无人认得这张脸'};
  var mv='<mvu_panel>\n<sec_char>\n'
    +panelChKeys().filter(function(k){return k!=='心声'&&k!=='史笔';})
      .map(function(k){return '◆'+k+'|'+(_dv[k]!=null?_dv[k]:'50');}).join('\n')+'\n'
    +'◆心声|以 ~ 开头发言，你写下的那一句就记在这里\n'
    +'◆史笔|'+yl+'，'+cn+'。'+(scene?scene.replace(/\s+/g,' ').slice(0,60):'此幕自你落脚之刻写起。')+'\n</sec_char>\n<sec_npc>\n'
    +npcs.map(function(p){return '◈'+p.name+'|初逢|50|（尚未开口）|'+(p.role||'不详')+'|'+cn+'|不详|不详|（还没看清是谁）';}).join('\n')
    +'\n<sec_world>\n◇纪年|'+yl+'\n◇时地|'+cn+'\n◇天气|晴\n◇安稳|60\n◇大势|尚未分明\n◇将临|尚未分明\n</sec_world>\n</mvu_panel>';
  return {id:'custom',year:y,era:yl,scene:cn,text:body+'\n\n'+mv};
}
/* 鑄局用的系統提示：與正式對局同源（卡的鐵則、文風、世界書），世界書以年代地點為檢索詞 */
function condereSys(line,q){
  var G=CARDS[line]||{};
  return [MEOW_RULE,
    heroRebind(felStripLegacyMeowRule(ACTIVE==='luzhi'?feliniaGlobalRules(G.system_prompt||''):(G.system_prompt||''))),
    heroSheet(),                       /* 换了人来演：先把「你演的是谁」摆在最前面 */
    povBind(),                         /* 正史开局扮演别人时的视点绑定（铸局走 heroSheet） */
    ((heroIsCard()||cardHeroless())&&!povHero()?('【玩家角色档案】'+(G.description||''))
                 :('【卡中原主角档案·仅供了解此世的笔调与背景，本局不适用于主角】'+heroDesc(G.description||''))),
    '【叙事者】'+heroRebind(G.personality||''),
    '【场景】'+heroRebind(ACTIVE==='luzhi'?feliniaEraContext():(G.scenario||'')),
    '【每回自查】'+heroRebind(felStripLegacyMeowRule(G.post_history_instructions||'')),
    heroTail(),
    MEOW_RULE
  ].filter(Boolean).map(macroFill).join('\n\n');
}
/* 鑄局指令：附一則既有開局的面板作為格式範例，確保欄位與符號一字不差 */
function condereAsk(line,y,nm,cn){
  function v(id){var el=$(id);return el?String(el.value||'').trim():'';}
  var nomen=v('#pfNomen'),gens=v('#pfGens'),aetas=v('#pfAetas'),ortus=v('#pfOrtus');
  var scene=v('#pfScene');       /* 玩家自己写的「此刻的场面」 */
  var yl=y<0?('前'+(-y)+'年'):('公元'+y+'年');
  var who='未定';
  var her=nomen||who;            /* 后文一律称本局主角，不再一口一个贝罗娜 */
  var ref=nearestOpening(line,y);
  var refPanel=ref?((String(ref.text).match(/<mvu_panel>[\s\S]*?<\/mvu_panel>/)||[''])[0]):'';
  var npcs=[];(PSNPC.list||[]).forEach(function(pp,i){if(i!==PSNPC.sel&&npcs.length<4)npcs.push(pp);});
  var idLine=nomen
    ?('本局主角是「'+nomen+'」'+(gens?('，出身'+gens):'')+(aetas?('，'+aetas+'岁'):'')+(ortus?('，'+ortus):'')
      +'——一个普通人，不是'+who+'，与'+who+'无涉。'+who+'不在本局登场，也不得被提起或暗示为她的真身。')
    :('她以'+who+'之身悄然临于此地，未用化名。');
  return '【任务】为玩家现场铸一个全新开局。不是续写、不是简介，是从零写一幕完整的开场，'
    +'规格与本卡既有开局看齐。\n'
    +'【年代】'+yl+'\n【地点】'+cn+(nm?('（'+nm+'）'):'')+'\n【玩家此局身份】'+idLine+'\n'
    /* 玩家自己写的场面是硬约束：他既然指定了从哪儿写起，就不该另起一摊。 */
    +(scene?('【此刻的场面·玩家指定·必须照此开场，不得另起一摊】\n'+scene+'\n'
            +'· 这段话就是本幕的起点与既定事实：其中写到的人、物、地点、时候、'
            +'以及'+her+'刚做过或正卷入的事，一律当真，不许改写、不许推翻、不许说成是回忆或梦。\n'
            +'· 它写得粗略之处由你补全（在场者的来历、周遭的声响气味、这件事在当时的分量），'
            +'但补的必须与它相容，也必须属于'+yl+'的'+cn+'。\n'
            +'· 若其中已写到'+her+'做了什么，那是既成事实，照此承接；'
            +'但此后她的言行仍一个字都不许你代写。\n'):'')
    +(npcs.length?('【此时此地可用的人物（可自由取舍、改写、增补）】\n'
        +npcs.map(function(pp){return '· '+pp.name+'｜'+(pp.role||'')+'｜'+(pp.age||'')+'岁｜'+(pp.blurb||'');}).join('\n')+'\n'):'')
    +'【写法】\n'
    +'1. 严格遵守系统提示里的时代事实、玩家边界与作者层，考据须属于该年代。\n'
    +'2. 正文 700—1200 字，不加标题，不按提纲分段交代。先让此地正在发生的事碰到一名非玩家焦点，'
    +'沿她或他的感知、误读、证据、修正与行动自然展开；其他在场者只从外在言行显露各自打算。'
    +'最后把一个已经发生的动作、话音或物件递到'+her+'面前停笔。'
    +(scene?'本幕必须从上面【此刻的场面】写起，那段话是玩家定下的，不是建议。\n':'\n')
    +'3. 绝不代替'+her+'说话、行动、下决定、写内心——她的一切属于玩家。\n'
    +'4. 正文之后必须输出一个完整的 <mvu_panel>，字段名、行首符号、竖线分隔与下面的范例一字不差，'
    +'内容按你新写的这一幕据实填写。◆行只记她的客观外在（戎装／持物／身躯／旁人眼中的观感）'
    +'与史笔；◆心声那一行请照格式保留，内容写「——」占位即可，不要替她想那一句'
    +'（与上面第 3 条一致，她的内心属于玩家，游戏会用玩家自己写的独白填这一栏）：\n'
    +refPanel+'\n'
    +'5. 只输出正文与 <mvu_panel>，不要任何解释、不要代码围栏、不要提及本指令。';
}
function gameEnter(lineOverride){
  var y=(ERA.year==null?-221:ERA.year);
  var line=lineOverride||RING_LINE||'luzhi';
  var nm=ERA.sel?ERA.sel.n:'LVZHI',cn=ERA.sel?ERA.sel.cn:'哈拉和林';
  var loc=(y<0?(-y)+' A.C.N.':'A.D. '+y)+' · '+nm;
  var yl=y<0?('前'+(-y)+'年'):('公元'+y+'年');
  /* 先把玩家填的／点的身份定下来，再 loadOpening——顺序反了会被 loadOpening 清掉 */
  var _pv=function(id){var el=$(id);return el?String(el.value||'').trim():'';};
  var _hn=_pv('#pfNomen');
  var _hero=_hn?{n:_hn,g:_pv('#pfGens'),a:_pv('#pfAetas'),o:_pv('#pfOrtus'),
                 f:(PSNPC.sel>=0&&PSNPC.list[PSNPC.sel])?(PSNPC.list[PSNPC.sel].female?1:0):0}:null;
  var draft=condereOp(line,y,nm,cn);
  loadOpening(line,draft,loc);
  GAME.hero=_hero;
  gameShow();
  if(!apiReady()){                       /* 未接神谕：程序化开局即为终稿 */
    narrAdd('sys','…&nbsp;ORACVLVM&nbsp;未接线&nbsp;·&nbsp;此为程序化开局；接入&nbsp;AI&nbsp;后自定义开局将由神谕现场铸写&nbsp;…',null);
    return;
  }
  BUSY=true;genOpen('forge');
  var fLive=null,fGen=TYPE_GEN;   /* 代际令牌：铸局途中换局/读档/退出，旧回调必须作废 */
  function fDelta(full){
    if(fGen!==TYPE_GEN)return;
    genFirstToken();GEN.chars=full.length;
    var bd=stripMvuLive(full);if(!bd)return;
    if(!fLive){var nr=$('#gNarr');fLive=document.createElement('div');fLive.className='liveWrap';
      nr.insertBefore(fLive,GEN.el||nr.querySelector('.gEot'));}
    /* 同 onDelta：按帧合并，避免每个 token 全量重建整棵子树（铸局是 3200 tokens 的长文，更吃亏） */
    fLive._pend=bd;
    if(!fLive._raf){
      var el=fLive;
      el._raf=requestAnimationFrame(function(){
        el._raf=0;
        if(!el.parentNode)return;
        /* 粘性滚动：玩家贴着底才跟进；往上翻了就别打扰人家看前文，翻回来自动恢复跟随 */
        var n2=$('#gNarr');var _stk=n2.scrollHeight-n2.scrollTop-n2.clientHeight<90;
        el.innerHTML=el._pend.split(/\n{2,}/).map(function(par){
          return '<p'+(felNarrClass(par)?(' class="'+felNarrClass(par)+'"'):'')+'>'+fmtBody(par)+'</p>';
        }).join('');
        if(_stk)n2.scrollTop=n2.scrollHeight;
      });
    }
  }
  risuInvoke(
    [{role:'system',content:FELINIA_AUTHOR_NOTE+'\n\n'+FELINIA_NPC_ENGINE+'\n\n'+FELINIA_VOICE_EXAMPLE+'\n\n'
       +condereSys(line,yl+' '+cn+' '+nm)+'\n\n'+FELINIA_FINAL_CHECK},
     {role:'user',content:condereAsk(line,y,nm,cn)}],
    function(reply,meta){
      BUSY=false;genClose();
      if(fLive){try{fLive.remove();}catch(_){}fLive=null;}
      /* 铸局途中换了局／读了档／退出：这份迟到的稿子若照落，会把当前这一局
         的正文与 TURNS 整个盖掉（loadOpening 会清空两者）。 */
      if(fGen!==TYPE_GEN)return;
      var txt=String(reply||'').trim();
      if(!/<mvu_panel>/.test(txt)){        /* 神谕漏了面板：补上底稿的面板，保证情报台不空 */
        var mv=(String(draft.text).match(/<mvu_panel>[\s\S]*<\/mvu_panel>/)||[''])[0];
        txt=txt+'\n\n'+mv;
      }
      loadOpening(line,{id:'custom',year:y,era:yl,ei:feEraI(),scene:cn,text:txt,
        cognition:(meta&&meta.cognition)||null},loc);
    },
    function(msg){
      BUSY=false;genClose();
      if(fLive){try{fLive.remove();}catch(_){}fLive=null;}
      if(fGen!==TYPE_GEN)return;
      feFailMsg(msg,function(){gameEnter(lineOverride);});
    },
    {max_tokens:3200,onDelta:fDelta,onPhase:function(phase){GEN.phase=phase;}} /* 开场长文需要更大篇幅 */
  );
}
function gameExit(){
  TYPE_GEN++;
  /* 在途的神谕请求要掐掉：不掐的话它会一直跑到超时，既浪费 token，
     回调里的代际守卫虽然拦得住，但进度条与 BUSY 会挂在半路。 */
  try{if(GENAC)GENAC.abort();}catch(_){}
  BUSY=false;try{genClose();}catch(_){}
  $('#stage').style.display='';$('#rail').style.display='';$('#mission').style.display='';try{$('#luxTg').style.display='';}catch(_){}
  GAME.on=false;GAME.txOpen=false;gEl.classList.remove('show','mapOpen','armOpen','txOpen');
  mOv.classList.remove('gbg');
  GAME.mapOpen=GAME.armOpen=GAME.shopOpen=false;
  ['#dlgCfg','#dlgBook','#dlgSave','#dlgExit','#dlgApi','#dlgVoc','#dlgBgm'].forEach(function(d){$(d).style.display='none';});
  menuEnter();
}
/* 对局屏的地图：与择地那一步同一幅罗马马赛克世界图，同一套投影。
   原来挂的是半颗粒子地球（球心压在面板左缘、只露右半边），
   与择地那一屏风马牛不相及，玩家在两处看到的是两个世界。 */
/* 底图数据自带一份加载：对局地图原来直接吃 FE.mm/FE.mi，
   可那两份只有「进过纪年页」才会装。读档续局的人根本没走那条路，
   于是地图一片空白——实测刷新后续局，画面内容只剩 1%。
   这里自己取一份（与铸局那层用的是同两个档，走缓存，不多花一次下载）。 */
var GMAP={mm:null,mi:null,busy:0};
var GMAP={mm:null,mi:null,busy:0},ORBIS=null,ORBISQ=0,GMMV=null,PENDSITE=null;function orbisLoad(cb){try{cb&&cb(null);}catch(_){}}function orbisAt(){return null;}function orbisMerge(l){return l;}function gmapRefresh(){}function gmMI(){}function gmMM(){}function gmFetch(){}function gmapView(){}function siteIntro(){return '';}function siteLoreSnip(){return '';}function siteIntroPlain(){return '';}function iterBg(){}function iterAsk(){}function iterGo(){}
$('#arrMap').addEventListener('click',function(){
  GAME.mapOpen=!GAME.mapOpen;
  if(GAME.mapOpen){GAME.armOpen=GAME.shopOpen=false;gEl.classList.remove('armOpen','shopOpen');}
  gEl.classList.toggle('mapOpen',GAME.mapOpen);
  if(GAME.mapOpen)setTimeout(gmapRefresh,60);
});
$('#arrArm').addEventListener('click',function(){
  GAME.armOpen=!GAME.armOpen;
  if(GAME.armOpen){GAME.mapOpen=GAME.shopOpen=false;gEl.classList.remove('mapOpen','shopOpen');}
  gEl.classList.toggle('armOpen',GAME.armOpen);
  if(GAME.armOpen)invRender();
});
$('#arrShop').addEventListener('click',function(){
  GAME.shopOpen=!GAME.shopOpen;
  if(GAME.shopOpen){GAME.mapOpen=GAME.armOpen=false;gEl.classList.remove('mapOpen','armOpen');}
  gEl.classList.toggle('shopOpen',GAME.shopOpen);
  if(GAME.shopOpen)shopRender();
});
/* ---- ARMA: Ghost-style inventory — slot cards + cell grid + detail card,
   ledger injected into the oracle prompt, every item backed by a lore entry ---- */
var ARM_SLOTS={dext:['執','右手'],sin:['扞','左手'],corp:['甲','躯干'],
  cap:['冠','头'],hum:['披','肩'],cing:['带','腰'],ped:['履','足'],terg:['负','背负']};
var ARMDB={
  /* ── 秦人日常的吃食。多数猫娘不爱，可是宫里发的就是这些。 */
  sufan:{la:'粟飯',cn:'粟饭一碗',cat:'吃食',slot:'dext',ic:'ricebowl',stack:1,price:1,
    use:{act:'把一碗粟饭搁下',gan:1,xing:0,jie:0,
      eff:'好感+1，原形不动，不算戒心次数；这是官给的口粮，她嫌它是对的'}},
  kuai:{la:'膾',cn:'鱼脍',cat:'吃食',slot:'dext',ic:'sashimi',stack:1,price:10,
    use:{act:'把一碟鱼脍推过去',gan:8,xing:5,jie:1,
      eff:'好感+8，原形+5，算一次戒心；单件里好感涨得最猛的一样'}},
  zha:{la:'鮓',cn:'腌鱼',cat:'吃食',slot:'dext',ic:'jar',stack:1,price:8,
    use:{act:'把一坛腌鱼揭开',gan:7,xing:3,jie:1,
      eff:'好感+7，原形+3，算一次戒心'}},
  hai:{la:'醢',cn:'肉酱',cat:'吃食',slot:'dext',ic:'paste',stack:1,price:7,
    use:{act:'把一罐肉酱推过去',gan:6,xing:3,jie:1,
      eff:'好感+6，原形+3，算一次戒心；须先验过里头没有蒜'}},
  zhi:{la:'炙',cn:'炙肉',cat:'吃食',slot:'dext',ic:'skewer',stack:1,price:6,
    use:{act:'把一串炙肉递过去',gan:6,xing:3,jie:1,
      eff:'好感+6，原形+3，算一次戒心'}},
  maibing:{la:'麥餅',cn:'麦饼',cat:'吃食',slot:'dext',ic:'cake',stack:1,price:3,
    use:{act:'把一张麦饼掰开',gan:1,xing:0,jie:0,
      eff:'好感+1，原形不动，不算戒心次数；她吃得下，可是吃完发倦'}},
  li:{la:'醴',cn:'醴（甜酒）',cat:'吃食',slot:'dext',ic:'winejar',stack:1,price:5,
    use:{act:'把一觞醴斟上',gan:-4,xing:3,jie:0,
      eff:'好感-4，原形+3；酒她不爱，太甜的更不爱，喝完夜里的差事当不好'}},
  tangyi:{la:'餳',cn:'饧（麦芽糖）',cat:'吃食',slot:'dext',ic:'candy',stack:1,price:4,
    use:{act:'把一块饧递过去',gan:-3,xing:1,jie:0,
      eff:'好感-3，原形+1；太甜，她当面收下，转头给别人'}},
  kuigeng:{la:'葵羹',cn:'冬葵菜羹',cat:'吃食',slot:'dext',ic:'greens',stack:1,price:2,
    use:{act:'把一碗葵羹端上',gan:-2,xing:1,jie:0,
      eff:'好感-2，原形+1；生菜蔬这一类她不爱，吃完发倦'}},
  yu:{la:'蹲鴟',cn:'芋',cat:'吃食',slot:'dext',ic:'taro',stack:1,price:1,
    use:{act:'把一枚煨芋滚过去',gan:1,xing:0,jie:0,
      eff:'好感+1，原形不动，不算戒心次数；灾年的救命粮，平日她不稀罕'}},

  /* ── 猫娘的吃食与上瘾物。能装备（拿在手上／挂在腰间），也能「用」。
       用了之后走 sendText 落成一条真回合，模型必须按 eff 里的数执行。 */
  yugan:{la:'魚脯',cn:'鱼干',cat:'吃食',slot:'dext',ic:'fish',stack:1,price:12,
    use:{act:'把一条鱼干递过去',gan:6,xing:2,jie:1,
      eff:'好感+6，原形+2，戒心次数记一次'}},
  rougan:{la:'肉脯',cn:'肉干',cat:'吃食',slot:'dext',ic:'jerky',stack:1,price:18,
    use:{act:'把一条肉干递过去',gan:5,xing:2,jie:1,
      eff:'好感+5，原形+2，戒心次数记一次'}},
  xianrou:{la:'鮮肉',cn:'生鲜肉一块',cat:'吃食',slot:'dext',ic:'meat',stack:1,price:8,
    use:{act:'把一块生肉放到她面前',gan:6,xing:4,jie:1,
      eff:'好感+6，原形+4，戒心次数记一次'}},
  shenggan:{la:'牲肝',cn:'牲肝',cat:'吃食',slot:'dext',ic:'liver',stack:1,price:3,
    use:{act:'把一副生肝端过去',gan:7,xing:4,jie:1,
      eff:'好感+7，原形+4，戒心次数记一次'}},
  luo:{la:'酪',cn:'乳酪',cat:'吃食',slot:'dext',ic:'cheese',stack:1,price:20,
    use:{act:'把一块酪掰开递过去',gan:4,xing:1,jie:1,
      eff:'好感+4，原形+1，戒心次数记一次'}},
  danzi:{la:'雞子',cn:'鸡子',cat:'吃食',slot:'dext',ic:'egg',stack:1,price:1,
    use:{act:'把一枚鸡子磕开',gan:3,xing:1,jie:1,
      eff:'好感+3，原形+1，戒心次数记一次'}},
  gutang:{la:'骨湯',cn:'骨汤一碗',cat:'吃食',slot:'dext',ic:'soup',stack:1,price:1,
    use:{act:'把一碗骨汤搁下',gan:4,xing:1,jie:1,
      eff:'好感+4，原形+1，戒心次数记一次'}},
  jiasu:{la:'假蘇',cn:'假苏（荆芥）',cat:'药',slot:'cing',ic:'leaf',stack:1,price:60,
    use:{act:'把假苏的封口解开',gan:8,xing:18,jie:0,once:1,
      eff:'原形+18，好感+8；当场失态一刻钟，过后本人不认账；一局最多用一次'}},
  mutianliao:{la:'木天蓼',cn:'木天蓼',cat:'药',slot:'cing',ic:'vine',stack:1,price:45,
    use:{act:'把木天蓼的枝子折断',gan:6,xing:15,jie:0,once:1,
      eff:'原形+15，好感+6；反应比假苏慢半刻，退得也慢；一局最多用一次'}},
  hunji:{la:'葷忌',cn:'葱蒜韭一把',cat:'荤忌',slot:'dext',ic:'bulb',stack:1,price:1,
    use:{act:'把葱蒜递过去',gan:-15,xing:6,jie:-3,
      eff:'好感-15，原形+6；她要吐，重的两天走不动；这一次抵三次好意'}},
  xishui:{la:'洗過的水',cn:'洗过的水一瓢',cat:'荤忌',slot:'dext',ic:'pail',stack:1,price:0,
    use:{act:'把洗过的水舀给她',gan:-8,xing:6,jie:-3,
      eff:'好感-8，原形+6；这是掖庭给猫娘喝的水，递这个等于当面把她划到人以外'}},

  tongjian:{la:'銅劍',cn:'秦制铜剑',cat:'武器',price:700,slot:'dext',ic:'sword'},
  bi:{la:'匕',cn:'短匕',cat:'武器',price:150,slot:'cing',ic:'dagger'},
  nu:{la:'蹶張弩',cn:'蹶张弩',cat:'武器',ban:'官造禁物·市上无售',slot:'terg',ic:'crossbow'},
  ge:{la:'戈',cn:'长柄戈',cat:'武器',ban:'官造禁物·市上无售',slot:'dext',ic:'ge'},
  ji:{la:'戟',cn:'戟',cat:'武器',ban:'官造禁物·市上无售',slot:'dext',ic:'spear'},
  shi:{la:'矢',cn:'三棱铜镞箭',cat:'武器',ban:'官造禁物·市上无售',slot:'',ic:'arrow',stack:1},
  pijia:{la:'皮甲',cn:'犀兕皮甲',cat:'防具',ban:'官造禁物·市上无售',slot:'corp',ic:'armor'},
  dun:{la:'盾',cn:'木胎髹漆盾',cat:'防具',ban:'官造禁物·市上无售',slot:'sin',ic:'shield'},
  zhou:{la:'胄',cn:'铜胄',cat:'防具',ban:'官造禁物·市上无售',slot:'cap',ic:'helm'},
  chize:{la:'赤幘',cn:'赤帻',cat:'衣物',price:5,slot:'cap',ic:'headband'},
  shenyi:{la:'深衣',cn:'深青粗布深衣',cat:'衣物',price:66,slot:'corp',ic:'tunic'},
  dongpao:{la:'冬袍',cn:'深青冬料外袍',cat:'衣物',price:110,slot:'hum',ic:'cloak'},
  geidai:{la:'革帶',cn:'革带',cat:'衣物',price:14,slot:'cing',ic:'belt'},
  malv:{la:'麻履',cn:'麻履',cat:'衣物',price:6,slot:'ped',ic:'boot'},
  chanbu:{la:'纏布',cn:'缠脚布二尺',cat:'衣物',price:2,slot:'ped',ic:'band',stack:1},
  jinlian:{la:'金鏈',cn:'颈上金链',cat:'杂物',nomkt:'御府之物·不入市',slot:'cing',ic:'chain'},
  jiandu:{la:'簡牘',cn:'竹简与刀笔',cat:'杂物',price:40,slot:'',ic:'tablet'},
  mupai:{la:'傳',cn:'出入木传',cat:'杂物',nomkt:'官给之物·不入市',slot:'',ic:'tag'},
  banliang:{la:'半兩',cn:'半两钱一串',cat:'杂物',nomkt:'这就是钱',slot:'',ic:'coin'},
  tongdeng:{la:'銅燈',cn:'青铜油灯',cat:'杂物',price:120,slot:'',ic:'lamp'},
  qiu:{la:'糗',cn:'干粮糗饼',cat:'消耗',price:4,slot:'',ic:'bread',stack:1},
  shuinang:{la:'水囊',cn:'皮水囊',cat:'消耗',price:20,slot:'',ic:'flask'},
  aicao:{la:'艾',cn:'艾草一束',cat:'消耗',price:3,slot:'',ic:'herb',stack:1},
  mabu:{la:'麻布',cn:'麻布条',cat:'消耗',price:2,slot:'',ic:'band',stack:1},
  /* ---- 宫里女子的行头。掖庭、永巷、西殿都用得上 ---- */
  ruqun:{la:'襦裙',cn:'短襦长裙',cat:'衣物',price:55,slot:'corp',ic:'skirt'},
  cuqun:{la:'粗襦',cn:'官给粗布襦裙',cat:'衣物',nomkt:'官给之物·不入市',slot:'corp',ic:'skirt'},
  quju:{la:'曲裾',cn:'绕襟曲裾深衣',cat:'衣物',price:240,slot:'corp',ic:'robe'},
  zhongdan:{la:'中單',cn:'素帛中单',cat:'衣物',price:180,slot:'corp',ic:'tunic'},
  bopi:{la:'帛帔',cn:'素帛披帛',cat:'衣物',price:120,slot:'hum',ic:'veil'},
  jipao:{la:'罽袍',cn:'毛罽夹袍',cat:'衣物',price:600,slot:'hum',ic:'cloak'},
  sixie:{la:'絲履',cn:'绣面丝履',cat:'衣物',price:300,slot:'ped',ic:'slipper'},
  muji:{la:'木屐',cn:'高齿木屐',cat:'衣物',price:22,slot:'ped',ic:'clog'},
  zili:{la:'緇纚',cn:'缁帛束发',cat:'衣物',price:30,slot:'cap',ic:'wrap'},
  yuji:{la:'玉笄',cn:'白玉笄',cat:'衣物',price:800,slot:'cap',ic:'pin'},
  sitao:{la:'絲絛',cn:'织锦丝绦',cat:'衣物',price:90,slot:'cing',ic:'sash'},
  zushou:{la:'組綬',cn:'铜印组绶',cat:'杂物',nomkt:'官物·不入市',slot:'cing',ic:'ribbon'},
  bianmian:{la:'便面',cn:'竹柄便面',cat:'器物',price:8,slot:'dext',ic:'fan'},
  tongjing:{la:'銅鏡',cn:'四乳四虺铜镜',cat:'器物',price:400,slot:'sin',ic:'mirror'},
  zhusi:{la:'竹笥',cn:'方竹笥',cat:'器物',price:30,slot:'terg',ic:'chest'},
  daishi:{la:'黛石',cn:'画眉青黛',cat:'杂物',price:35,slot:'',ic:'stone'},
  yanzhi:{la:'燕支',cn:'燕支绵',cat:'杂物',price:28,slot:'',ic:'rouge'},
  qianfen:{la:'鉛粉',cn:'铅粉一奁',cat:'杂物',price:45,slot:'',ic:'powder'},
  mushu:{la:'木梳',cn:'木梳与篦',cat:'杂物',price:12,slot:'',ic:'comb'},
  tongnie:{la:'銅鑷',cn:'铜镊',cat:'杂物',price:18,slot:'',ic:'tweezer'},
  xiangnang:{la:'香囊',cn:'茱萸纹香囊',cat:'杂物',price:24,slot:'',ic:'pouch'},
  sipa:{la:'絲帕',cn:'素丝帕',cat:'杂物',price:16,slot:'',ic:'kerchief',stack:1},
  zhenzhi:{la:'針黹',cn:'铜针与麻线',cat:'杂物',price:9,slot:'',ic:'needle'},
  yuedai:{la:'月帶',cn:'月事布带',cat:'消耗',price:5,slot:'',ic:'pad',stack:1},
  jiao:{la:'椒',cn:'花椒一裹',cat:'消耗',price:12,slot:'',ic:'herb',stack:1},
  siyin:{la:'私印',cn:'铜私印',cat:'杂物',nomkt:'私刻之物·不入市',slot:'',ic:'seal'},
  taowan:{la:'陶碗',cn:'灰陶碗',cat:'杂物',price:2,slot:'',ic:'bowl'}
};
var ARMICONS={
  crossbow:'M12 2 V15 M4 7 Q12 4 20 7 M4 7 L6.5 10 M20 7 L17.5 10 M8 15 H16 V18 H8 Z M12 18 V22',
  ge:'M12 2 V22 M12 6 H19 Q20.5 8 19 10 H12 M12 13 H16',
  arrow:'M12 1.5 L14 6 L12 8 L10 6 Z M12 8 V21 M9.5 18.5 L12 21 L14.5 18.5',
  quiver:'M7 4 H17 L15.5 21 H8.5 Z M9 4 V1.5 M12 4 V1.5 M15 4 V1.5 M8 9 H16',
  pole:'M4 21 L19 4 M19 4 Q21 6.5 18.5 8 Q16 6.5 17.5 4.2 M4 21 L6.5 20',
  chain:'M6.5 8 A3 3 0 1 0 6.5 14 A3 3 0 1 0 6.5 8 M13 8 A3 3 0 1 0 13 14 A3 3 0 1 0 13 8 M19.5 8 A3 3 0 1 0 19.5 14 A3 3 0 1 0 19.5 8',
  headband:'M4 9.5 Q12 6 20 9.5 L19 13 Q12 9.5 5 13 Z M19 13 L21.5 20 M5 13 L2.5 20',
  herb:'M12 21 V9 M12 9 Q6 8.5 5 3 Q11 3.5 12 9 M12 11 Q18 10.5 19 5 Q13 5.5 12 11',
  felt:'M4 14 Q4 6.5 12 6.5 Q20 6.5 20 14 Z M2.5 14 H21.5 V17 H2.5 Z',
  bowl:'M3.5 10 H20.5 Q19.5 19 12 19 Q4.5 19 3.5 10 Z M7 10 V7.5 M12 10 V6.5 M17 10 V7.5',
  collar:'M5 9 A7 5.5 0 0 0 19 9 M5 9 A7 5.5 0 0 1 19 9 M12 14.5 V19 M10 19 H14 M8 7.2 L8.8 5 M16 7.2 L15.2 5',
  bow:'M7 2.5 Q17 8 17 12 Q17 16 7 21.5 M7 2.5 L7 21.5 M17 12 H21',
  sword:'M12 2 L14 5 L14 14 L12 17 L10 14 L10 5 Z M8 17 H16 M12 17 V22 M10.5 22 H13.5',
  sword2:'M12 1 L13.5 4 L13.5 15 L12 18 L10.5 15 L10.5 4 Z M8.5 18 H15.5 M12 18 V22.5',
  dagger:'M12 4 L13.5 7 L13.5 12 L12 14.5 L10.5 12 L10.5 7 Z M9 14.5 H15 M12 14.5 V19.5',
  spear:'M12 1 L14 5 L12 8.5 L10 5 Z M12 8.5 V23',
  sling:'M7 3 C9.5 9 9.5 14 8.5 19 M17 3 C14.5 9 14.5 14 15.5 19 M8.5 19 Q12 22.5 15.5 19 Q12 16.5 8.5 19',
  armor:'M7 3 H17 L19 8 V15 L12 21 L5 15 V8 Z M6 8.5 H18 M6.5 12 H17.5',
  shield:'M8 2.5 H16 Q18.5 2.5 18.5 6 V18 Q18.5 21.5 16 21.5 H8 Q5.5 21.5 5.5 18 V6 Q5.5 2.5 8 2.5 Z M12 9.5 A2.5 2.5 0 1 0 12 14.5 A2.5 2.5 0 1 0 12 9.5',
  helm:'M5 12 A7 7 0 0 1 19 12 V16 H15.5 V12 A3.5 3.5 0 0 0 8.5 12 V16 H5 Z M8.5 16 V20.5 M15.5 16 V20.5 M12 2 V4.5',
  cloak:'M12 3 L5 8 V21 H9.5 L12 12.5 L14.5 21 H19 V8 Z M9.5 5.8 A2.5 2.5 0 0 0 14.5 5.8',
  boot:'M8 3 H12 V13 L18 16.5 Q19 20 15.5 20 H6 V16 L8 13.5 Z M8 6 H12 M8 9 H12',
  tunic:'M8 3 L4 7 L6.5 10 L8 8.5 V21 H16 V8.5 L17.5 10 L20 7 L16 3 Q12 6 8 3',
  belt:'M3 10 H21 V14 H3 Z M9 7.5 V16.5 M13.5 7.5 V16.5 M9 12 H13.5',
  pick:'M12 5.5 V22 M4 7.5 Q12 1.5 20 7.5 L19.5 9.5 Q12 4 4.5 9.5 Z',
  bread:'M4 14 A8 5.5 0 0 1 20 14 V16.5 H4 Z M9 9.5 L10 12.5 M12 8.5 V12.5 M15 9.5 L14 12.5',
  flask:'M10 3 H14 V6 Q18 8 18 13 Q18 20 12 20 Q6 20 6 13 Q6 8 10 6 Z M10 3 Q10 1.5 12 1.5 Q14 1.5 14 3',
  band:'M9 14.5 A5.5 5.5 0 1 1 9.01 14.49 M9 20.5 H21 V16.5',
  coin:'M9.5 3.5 H14.5 L15.5 7 Q20.5 10 19.5 16 Q18.5 21 12 21 Q5.5 21 4.5 16 Q3.5 10 8.5 7 Z M9.5 3.5 Q12 5.5 14.5 3.5 M9.5 13 H14.5 M12 10.5 V15.5',
  tablet:'M5 3 H19 V21 H5 Z M8 6.5 H16 M8 10 H16 M8 13.5 H13',
  lamp:'M4 13 Q4 9 9 9.5 H13 Q19 9 20 12.5 Q16 16.5 10 16 Q6 15.5 4 13 Z M18.5 10.5 L22 8.5 M6.5 9.5 Q6.5 6 9.5 5.5',
  tag:'M9.5 2.5 H14.5 V6.5 H9.5 Z M12 6.5 V9.5 M6 9.5 H18 V21.5 H6 Z M9 13.5 H15 M9 17 H15',
  skirt:'M9 2.5 H15 L16.5 8 H7.5 Z M7.5 8 L4 21 H20 L16.5 8 M10 8 V21 M14 8 V21',
  robe:'M8.5 2.5 L5 7 V21 H19 V7 L15.5 2.5 M8.5 2.5 Q12 6.5 15.5 2.5 M15.5 2.5 L9 12 H16 L11 21',
  veil:'M3 6 Q7.5 3.5 12 6 Q16.5 8.5 21 6 M3 11 Q7.5 8.5 12 11 Q16.5 13.5 21 11 M3 16 Q7.5 13.5 12 16 Q16.5 18.5 21 16',
  slipper:'M3 16 Q3 12 8 12 H14 Q20 12.5 21 16 Q21 19.5 16 19.5 H7 Q3 19.5 3 16 Z M8 12 V9 M12 12.5 Q12 8.5 15 8',
  clog:'M5 6.5 H19 V12.5 H5 Z M7 12.5 V19.5 M17 12.5 V19.5 M5.5 9.5 H18.5',
  wrap:'M4 8 Q12 3.5 20 8 Q20 12 12 12.5 Q4 12 4 8 Z M6 12.5 L5 20 M18 12.5 L19 20 M12 12.5 V16',
  pin:'M6 4.5 A2.6 2.6 0 1 0 6.01 4.49 M7.8 6.3 L20 19 M17.5 19.5 L20.5 19 L20 16',
  sash:'M4.5 5 Q12 8.5 19.5 5 M4.5 5 V9 Q12 12.5 19.5 9 V5 M8 12 L6.5 21 L9.5 19 M16 12 L17.5 21 L14.5 19',
  ribbon:'M12 3.5 A2.4 2.4 0 1 0 12.01 3.49 M12 6 V11 M9 11 H15 V14 H9 Z M10 14 L8 21.5 L12 19.5 L16 21.5 L14 14',
  fan:'M12 20.5 V15 M12 15 A9 9 0 0 1 3.5 8.5 A9 9 0 0 1 20.5 8.5 A9 9 0 0 1 12 15 M6 9 L12 15 L18 9 M12 4.5 V15',
  mirror:'M12 2.5 A6 6 0 1 0 12.01 2.49 M12 14.5 V20 M9.5 20 H14.5 M9 6.5 A3.6 3.6 0 0 1 13 5.5',
  chest:'M3.5 8 H20.5 V20 H3.5 Z M3.5 8 L6 4.5 H18 L20.5 8 M12 8 V20 M9.5 12.5 H14.5',
  stone:'M5 13 L9 5.5 L17.5 6.5 L19.5 14 L13 19.5 L6 17.5 Z M9 5.5 L13 12 L19.5 14 M13 12 L13 19.5',
  rouge:'M4.5 12 A7.5 7.5 0 1 0 19.5 12 A7.5 7.5 0 1 0 4.5 12 M8.5 12 A3.5 3.5 0 1 0 15.5 12 A3.5 3.5 0 1 0 8.5 12',
  powder:'M5 9.5 H19 V19.5 H5 Z M5 9.5 L7 6 H17 L19 9.5 M9 6 V3 H15 V6 M9.5 14.5 H14.5',
  comb:'M3.5 5.5 H20.5 V10 H3.5 Z M5.5 10 V19.5 M8.5 10 V19.5 M11.5 10 V19.5 M14.5 10 V19.5 M17.5 10 V19.5',
  tweezer:'M9 2.5 L11 14 L12 17 L13 14 L15 2.5 M11.5 17.5 H12.5 M9 2.5 Q12 1 15 2.5',
  pouch:'M8 6.5 H16 Q20 11 18.5 16 Q17 20.5 12 20.5 Q7 20.5 5.5 16 Q4 11 8 6.5 Z M9 6.5 V3.5 M15 6.5 V3.5 M12 6.5 V2 M12 11 V15',
  kerchief:'M4 6 H20 L17.5 17.5 Q12 21.5 6.5 17.5 Z M7.5 9.5 Q12 12 16.5 9.5 M9 13.5 Q12 15 15 13.5',
  needle:'M6.5 3.5 A2 3 0 1 0 6.51 3.49 M7 6.5 L17.5 20.5 M4 20 Q9 13.5 14 17 Q17.5 19.5 20 15',
  pad:'M6 4.5 H18 Q19.5 12 18 19.5 H6 Q4.5 12 6 4.5 Z M9 4.5 V19.5 M15 4.5 V19.5',
  seal:'M8 3 H16 V8 H8 Z M11.5 8 V12 M5 12 H19 V15 H5 Z M6.5 15 V20.5 H17.5 V15 M9.5 17.5 H14.5',
  fish:'M3 12c3-4 7-5 10-5s6 2 8 5c-2 3-5 5-8 5s-7-1-10-5zM21 12l-3-2v4l3-2M8 11h.01',
  jerky:'M6 5h5l7 7-7 7H6l4-7-4-7zM9 9l2 3-2 3',
  meat:'M7 17a4 4 0 0 1 0-6l5-5a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0zM5 19l2-2M4 21l1-1',
  liver:'M5 9c4-4 10-4 14 0 1 4-2 9-7 9S4 13 5 9zM12 9v9M12 13l4-2',
  cheese:'M3 11l9-5 9 5v6H3v-6zM7 13h.01M12 14h.01M16 12h.01',
  egg:'M12 3c3 0 6 5 6 9a6 6 0 0 1-12 0c0-4 3-9 6-9z',
  soup:'M4 11h16a8 8 0 0 1-8 8 8 8 0 0 1-8-8zM9 7c0-1 1-1 1-2M13 7c0-1 1-1 1-2M2 21h20',
  leaf:'M12 21c0-7 3-12 8-14-1 8-4 12-8 14zM12 21C8 19 4 14 4 6c5 2 8 7 8 15zM12 21v-6',
  vine:'M6 21c0-8 4-13 12-15M9 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM15 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  bulb:'M12 21a5 5 0 0 0 5-5c0-3-5-8-5-8s-5 5-5 8a5 5 0 0 0 5 5zM12 8V3M10 4l2-2 2 2',
  pail:'M5 9h14l-1.5 11h-11L5 9zM4 9a8 4 0 0 1 16 0M8 13c2 1 4 1 6 0',
  ricebowl:'M4 12h16a8 8 0 0 1-16 0zM3 21h18M8 9c1-2 3-2 4 0M13 8c1-1 2-1 3 0',
  sashimi:'M4 15l6-6 4 4-6 6H4v-4zM14 5l5 5-3 3-5-5 3-3M7 15h.01',
  jar:'M8 8h8l1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L8 8zM7 8V5h10v3M9 13h6',
  paste:'M6 10h12v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9zM6 10l1-4h10l1 4M10 15h4',
  skewer:'M3 21L21 3M8 13a2 2 0 1 0 3-3 2 2 0 0 0-3 3zM12 9a2 2 0 1 0 3-3 2 2 0 0 0-3 3z',
  cake:'M3 12a9 9 0 0 1 18 0 9 9 0 0 1-18 0zM8 10c1 1 2 1 3 0M14 13c1 1 2 1 3 0',
  winejar:'M9 3h6v3l2 4v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9l2-4V3zM8 14h8',
  candy:'M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0zM4 9l3 3-3 3V9zM20 9l-3 3 3 3V9z',
  greens:'M12 21V9M12 9c0-3 2-5 5-5 0 3-2 5-5 5zM12 12c0-3-2-5-5-5 0 3 2 5 5 5z',
  taro:'M12 21a6 6 0 0 0 6-6c0-4-6-9-6-9s-6 5-6 9a6 6 0 0 0 6 6zM12 6V3M12 6l3-2'
};
function armIcon(ic,s){
  return '<svg viewBox="0 0 24 24" width="'+s+'" height="'+s+'" fill="none" stroke="currentColor" '
    +'stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="'
    +(ARMICONS[ic]||ARMICONS.tag)+'"/></svg>';
}
/* 开局不同，身上带的东西就不同。原先只有一份「宫里当值的卒」的行头——
   掖庭的猫娘、永巷送饭的、太医令、中车府令，一进来全背着蹶张弩，这是错的。
   下面按开局号发。没登记的开局（自定义局）走 _ 那一份。 */
var INVSETS={
  /* 00 吕雉 · 前221 · 刚被一车拖进咸阳宫。身上只有家里带出来的那身，官给的还没发 */
  0:{eq:{corp:'cuqun',cing:'sitao',ped:'malv'},
     bag:[{id:'mushu',n:1},{id:'sipa',n:1},{id:'yuedai',n:2},{id:'banliang',n:1},{id:'qiu',n:2}]},
  /* 01 吕雉 · 前221 · 入宫第二十天，掖庭水瓮前。身上还全是官给的，一样自己的都没有 */
  1:{eq:{corp:'cuqun',cing:'sitao',ped:'malv'},
     bag:[{id:'mushu',n:1},{id:'sipa',n:1},{id:'yuedai',n:2},{id:'taowan',n:1},{id:'zhenzhi',n:1}]},
  /* 02 吕雉 · 前220 · 掖庭，名录第一行。会认字，手里有律条 */
  2:{eq:{corp:'ruqun',cap:'zili',cing:'sitao',ped:'malv',terg:'zhusi'},
     bag:[{id:'jiandu',n:1},{id:'mushu',n:1},{id:'zhenzhi',n:1},{id:'sipa',n:1},
          {id:'yuedai',n:2},{id:'daishi',n:1},{id:'taowan',n:1}]},
  /* 03 阿箸 · 掖庭下等。什么都是官给的，什么都不够 */
  3:{eq:{corp:'cuqun',ped:'malv'},
     bag:[{id:'mushu',n:1},{id:'zhenzhi',n:1},{id:'yuedai',n:2},{id:'chanbu',n:2},{id:'taowan',n:1}]},
  /* 04 嬴政 · 前220 · 朝会。剑在身上，可殿上真出事的时候拔不出来 */
  4:{eq:{dext:'tongjian',corp:'quju',cap:'yuji',hum:'dongpao',cing:'geidai',ped:'sixie'},
     bag:[{id:'siyin',n:1},{id:'jiandu',n:1},{id:'xiangnang',n:1},{id:'sipa',n:1}]},
  /* 05 吕雉 · 前219 · 掖庭迁章台宫。开始有一两件不是官给的东西 */
  5:{eq:{corp:'ruqun',cap:'zili',hum:'bopi',cing:'sitao',ped:'sixie',terg:'zhusi'},
     bag:[{id:'tongjing',n:1},{id:'mushu',n:1},{id:'daishi',n:1},{id:'yanzhi',n:1},
          {id:'sipa',n:1},{id:'yuedai',n:2},{id:'jiandu',n:1}]},
  /* 06 嬴政 · 前219 · 荆轲。剑长，负在背后拔了三次才出来 */
  6:{eq:{dext:'tongjian',corp:'quju',cap:'yuji',hum:'dongpao',cing:'geidai',ped:'sixie'},
     bag:[{id:'siyin',n:1},{id:'jiandu',n:1},{id:'sipa',n:1}]},
  /* 07 吕雉 · 前219 · 殿上捧香。手里得空出一只来端东西 */
  7:{eq:{sin:'tongjing',corp:'quju',cap:'yuji',hum:'bopi',cing:'sitao',ped:'sixie'},
     bag:[{id:'xiangnang',n:1},{id:'daishi',n:1},{id:'qianfen',n:1},{id:'sipa',n:1},
          {id:'mushu',n:1},{id:'jiao',n:1}]},
  /* 08 夏无且 · 太医令。药囊比什么都要紧 */
  8:{eq:{corp:'shenyi',cap:'chize',hum:'dongpao',cing:'geidai',ped:'malv',terg:'zhusi'},
     bag:[{id:'jiandu',n:2},{id:'aicao',n:3},{id:'mabu',n:4},{id:'tongnie',n:1},
          {id:'siyin',n:1},{id:'tongdeng',n:1},{id:'shuinang',n:1}]},
  /* 09 蒙毅 · 郎中令。查人的人，身上是名册与传 */
  9:{eq:{dext:'tongjian',corp:'pijia',cap:'zhou',hum:'dongpao',cing:'geidai',ped:'malv',terg:'zhusi'},
     bag:[{id:'jiandu',n:2},{id:'mupai',n:1},{id:'siyin',n:1},{id:'banliang',n:1},
          {id:'tongdeng',n:1},{id:'qiu',n:2}]},
  /* 10 嬴政 · 前218 · 当着满朝割自己一刀 */
  10:{eq:{dext:'tongjian',corp:'quju',cap:'yuji',hum:'dongpao',cing:'bi',ped:'sixie'},
     bag:[{id:'geidai',n:1},{id:'siyin',n:1},{id:'mabu',n:2},{id:'sipa',n:1}]},
  /* 11 吕雉 · 前218 · 章台宫西殿。开始拿死囚试距离，工具是她自己备的 */
  11:{eq:{corp:'quju',cap:'yuji',hum:'bopi',cing:'sitao',ped:'sixie',terg:'zhusi'},
      bag:[{id:'jiandu',n:2},{id:'mabu',n:3},{id:'aicao',n:2},{id:'tongnie',n:1},
           {id:'sipa',n:1},{id:'daishi',n:1},{id:'tongdeng',n:1}]},
  /* 12 嬴政 · 前217 · 一天杀十九个 */
  12:{eq:{dext:'tongjian',corp:'quju',cap:'yuji',hum:'dongpao',cing:'geidai',ped:'sixie'},
      bag:[{id:'siyin',n:1},{id:'jiandu',n:2},{id:'sipa',n:1},{id:'yugan',n:2}]},
  /* 13 阿疾 · 西殿女医。量步数的人，带的是量具与药 */
  13:{eq:{corp:'ruqun',cap:'zili',cing:'sitao',ped:'malv',terg:'zhusi'},
      bag:[{id:'jiandu',n:2},{id:'aicao',n:2},{id:'mabu',n:3},{id:'tongnie',n:1},
           {id:'yuedai',n:2},{id:'taowan',n:1},{id:'mushu',n:1},{id:'jiasu',n:1},{id:'mutianliao',n:1},{id:'luo',n:1}]},
  /* 14 吕雉 · 前215 · 颈上金链三尺六。链子的长短就是她这一年能走多远 */
  14:{eq:{corp:'quju',cap:'yuji',hum:'bopi',cing:'jinlian',ped:'sixie',terg:'zhusi'},
      bag:[{id:'tongjing',n:1},{id:'sitao',n:1},{id:'daishi',n:1},{id:'yanzhi',n:1},
           {id:'qianfen',n:1},{id:'sipa',n:1},{id:'xiangnang',n:1},{id:'jiandu',n:1}]},
  /* 15 嬴政 · 前214 · 巡狩的车上，每样东西都得伸手够得着 */
  15:{eq:{dext:'tongjian',corp:'quju',cap:'yuji',hum:'jipao',cing:'geidai',ped:'sixie',terg:'zhusi'},
      bag:[{id:'siyin',n:1},{id:'jiandu',n:2},{id:'shuinang',n:1},{id:'qiu',n:3},
           {id:'tongdeng',n:1},{id:'mabu',n:2}]},
  /* 16 吕雉 · 前214 · 链子放到六尺。会先夸人再递东西 */
  16:{eq:{corp:'quju',cap:'yuji',hum:'bopi',cing:'jinlian',ped:'sixie',terg:'zhusi'},
      bag:[{id:'tongjing',n:1},{id:'bianmian',n:1},{id:'yanzhi',n:1},{id:'daishi',n:1},
           {id:'xiangnang',n:1},{id:'sipa',n:1},{id:'jiandu',n:1},{id:'siyin',n:1}]},
  /* 17 赵高 · 中车府令。过手的东西他都留一份 */
  17:{eq:{corp:'quju',cap:'yuji',hum:'dongpao',cing:'zushou',ped:'sixie',terg:'zhusi'},
      bag:[{id:'jiandu',n:3},{id:'siyin',n:2},{id:'mupai',n:1},{id:'banliang',n:1},
           {id:'tongdeng',n:1},{id:'sipa',n:1}]},
  /* 18 吕雉 · 前213 · 链子一丈二尺。焚书那年，手里过的是简 */
  18:{eq:{corp:'quju',cap:'yuji',hum:'jipao',cing:'jinlian',ped:'sixie',terg:'zhusi'},
      bag:[{id:'jiandu',n:3},{id:'siyin',n:1},{id:'tongjing',n:1},{id:'bianmian',n:1},
           {id:'daishi',n:1},{id:'xiangnang',n:1},{id:'sipa',n:1},{id:'tongdeng',n:1}]},
  /* 19 吕雉 · 前212 · 头一回持传出宫。链子解了，换成一块木牌；丝履在外头走开了口 */
  19:{eq:{corp:'quju',cap:'yuji',hum:'bopi',cing:'sitao',ped:'sixie',terg:'zhusi'},
      bag:[{id:'mupai',n:1},{id:'siyin',n:1},{id:'jiandu',n:1},{id:'tongjing',n:1},
           {id:'xiangnang',n:1},{id:'sipa',n:1},{id:'banliang',n:1},{id:'malv',n:1}]},
  /* 20 芈萤 · 永巷送饭。三年了，身上还是官给的那一套 */
  20:{eq:{corp:'cuqun',ped:'malv',terg:'zhusi'},
      bag:[{id:'taowan',n:2},{id:'qiu',n:2},{id:'shuinang',n:1},{id:'mushu',n:1},
           {id:'zhenzhi',n:1},{id:'yuedai',n:2},{id:'chanbu',n:2},{id:'gutang',n:1},{id:'xishui',n:1}]},
  /* 21 吕雉 · 前211 · 夜里在他寝处，为一盏灯吵了十年。屋里不用带东西，链子那头就在六步外 */
  21:{eq:{corp:'zhongdan',cing:'jinlian',terg:'zhusi'},
      bag:[{id:'mushu',n:1},{id:'tongjing',n:1},{id:'sipa',n:1},{id:'jiandu',n:1},{id:'xiangnang',n:1},{id:'yugan',n:1},{id:'rougan',n:1}]},
  /* 22 嬴政 · 前210 · 五十岁，快死了。药比剑近 */
  22:{eq:{corp:'quju',cap:'yuji',hum:'jipao',cing:'geidai',ped:'sixie',terg:'zhusi'},
      bag:[{id:'tongjian',n:1},{id:'siyin',n:1},{id:'aicao',n:3},{id:'shuinang',n:1},
           {id:'jiandu',n:2},{id:'sipa',n:1}]},
  /* 23 吕雉 · 前170 · 七十岁，脸还是十九。西殿主位，手里端着第三碗饭，案上摊着掖庭名录 */
  23:{eq:{corp:'quju',cap:'yuji',hum:'jipao',cing:'jinlian',ped:'sixie',terg:'zhusi'},
      bag:[{id:'taowan',n:1},{id:'jiandu',n:2},{id:'siyin',n:1},{id:'tongjing',n:1},
           {id:'mushu',n:1},{id:'sipa',n:1},{id:'xiangnang',n:1},{id:'banliang',n:1},{id:'gutang',n:1},{id:'shenggan',n:1},{id:'danzi',n:2}]},
  /* 兜底：自定义开局，宫里当值的一般行头 */
  _:{eq:{dext:'tongjian',sin:'dun',corp:'shenyi',cap:'chize',hum:'dongpao',cing:'geidai',ped:'malv',terg:'nu'},
     bag:[{id:'bi',n:1},{id:'qiu',n:3},{id:'shuinang',n:1},{id:'mabu',n:2},{id:'banliang',n:1},
          {id:'jiandu',n:1},{id:'tongdeng',n:1},{id:'mupai',n:1},{id:'aicao',n:2},{id:'shi',n:12},{id:'yugan',n:1}]}
};
function invPreset(op){
  if(typeof cardHeroless==='function'&&cardHeroless()){
    INV={eq:{},bag:[]};INVSEL=null;USED1={};
    invStore();try{invRender();}catch(_){}
    return;
  }
  var k=(op&&op.id!=null&&INVSETS[op.id])?op.id:'_';
  var st=INVSETS[k];
  var eq={},bag=[],i;
  for(i in st.eq)eq[i]=st.eq[i];
  for(i=0;i<st.bag.length;i++)bag.push({id:st.bag[i].id,n:st.bag[i].n});
  INV={eq:eq,bag:bag};INVSEL=null;USED1={};
  invStore();try{invRender();}catch(_){}
}
var INV=INVSETS._;
INV={eq:(function(){var o={},k;for(k in INVSETS._.eq)o[k]=INVSETS._.eq[k];return o;})(),
     bag:INVSETS._.bag.map(function(b){return {id:b.id,n:b.n};})};
try{var _iv=JSON.parse(localStorage.getItem('guardianDragonInv')||'null');if(_iv&&_iv.eq&&_iv.bag)INV=_iv;}catch(_){}
function invStore(){lsSet('guardianDragonInv',JSON.stringify(INV))}
var INVSEL=null;var USED1={};  /* 一局只准用一次的东西（假苏、木天蓼） */   /* {w:'eq'|'bag', k:slotKey|bagIndex, confirm:bool} */
function armDesc(id){
  var it=ARMDB[id];if(!it)return '';
  try{var lb=CARDS[ACTIVE].lorebook||[];
    for(var i=0;i<lb.length;i++){var e=lb[i];
      if(e&&(e.id===id||(e.title&&e.title.indexOf('装备·')===0&&e.keys&&e.keys.indexOf(it.la.split(' ')[0])>=0)))return e.content;}
  }catch(_){}
  return '';
}
function bagAdd(id,n){
  n=n||1;var it=ARMDB[id];
  if(it&&it.stack){for(var i=0;i<INV.bag.length;i++)
    if(INV.bag[i].id===id){INV.bag[i].n+=n;return;}}
  INV.bag.push({id:id,n:n});
}
function invRender(){
  var host=$('#armWrap');if(!host)return;
  var h='<div class="armSec">◈&nbsp;在身&nbsp;·&nbsp;已装备</div><div class="slotGrid">';
  for(var k in ARM_SLOTS){
    var id=INV.eq[k],it=id?ARMDB[id]:null,sel=INVSEL&&INVSEL.w==='eq'&&INVSEL.k===k;
    h+='<div class="aSlot'+(it?'':' empty')+(sel?' on':'')+'"'+(it?' data-sel="eq:'+k+'"':'')+'>'
      +'<span class="ic">'+(it?armIcon(it.ic,24):'')+'</span>'
      +'<span><b>'+ARM_SLOTS[k][0]+'&nbsp;'+ARM_SLOTS[k][1]+'</b>'
      +'<i>'+(it?it.cn:'—&nbsp;空&nbsp;—')+'</i></span></div>';
  }
  h+='</div><div class="armSec">◈&nbsp;行囊&nbsp;·&nbsp;随身</div><div class="bagGrid">';
  for(var b=0;b<INV.bag.length;b++){
    var bi=INV.bag[b],bit=ARMDB[bi.id];if(!bit)continue;
    var bsel=INVSEL&&INVSEL.w==='bag'&&INVSEL.k===b;
    h+='<div class="bCell'+(bsel?' on':'')+'" data-sel="bag:'+b+'" title="'+bit.cn+'&nbsp;·&nbsp;'+bit.la+'">'
      +armIcon(bit.ic,24)+(bi.n>1?'<i class="n">×'+bi.n+'</i>':'')+'</div>';
  }
  for(var e2=0;e2<6;e2++)h+='<div class="bCell emptyc" aria-hidden="true"></div>';
  h+='</div>';
  /* detail card */
  var did=null,where=null;
  if(INVSEL){
    if(INVSEL.w==='eq')did=INV.eq[INVSEL.k];
    else if(INV.bag[INVSEL.k])did=INV.bag[INVSEL.k].id;
    where=INVSEL.w;
  }
  var dit=did?ARMDB[did]:null;
  h+='<div class="armDet">';
  if(dit){
    h+='<div class="tt">'+dit.la+'&nbsp;·&nbsp;'+dit.cn
      +'&nbsp;&nbsp;<i>'+dit.cat+(dit.slot?('&nbsp;/&nbsp;'+ARM_SLOTS[dit.slot][1]):'')+'</i></div>';
    var ds=armDesc(did);
    h+='<div class="ds">'+(ds?esc2(ds.slice(0,110))+(ds.length>110?'…':''):'（世界书中尚无此物条目）')+'</div>';
    if(dit.use)h+='<div class="ds" style="color:var(--gold,#785300)">效用&nbsp;·&nbsp;'
      +esc2(dit.use.eff)+'</div>';
    if(dit.price!=null)h+='<div class="ds">市价&nbsp;·&nbsp;'+dit.price
      +'&nbsp;钱　　现钱&nbsp;·&nbsp;'+walletRead()+'&nbsp;钱</div>';
    h+='<div class="ops">';
    if(dit.use)h+='<span data-act="use">用&nbsp;◈</span>';
    if(dit.price!=null&&where==='bag')h+='<span data-act="sell">卖&nbsp;'
      +Math.max(1,Math.floor(dit.price/2))+'&nbsp;钱</span>';
    if(dit.price!=null)h+='<span data-act="buy">再买一件&nbsp;'+dit.price+'&nbsp;钱</span>';
    if(where==='bag'&&dit.slot)h+='<span data-act="equip">装备&nbsp;⌁</span>';
    if(where==='eq')h+='<span data-act="unequip">卸下&nbsp;⌁</span>';
    h+='<span data-act="discard"'+(INVSEL.confirm?' class="warn"':'')+'>'
      +(INVSEL.confirm?'再点确认弃置':'弃置')+'</span>';
    h+='</div>';
  }else{
    h+='<div class="ds" style="color:var(--mut)">点选一件装备或行囊物品，可查看其世界书记载并执行&nbsp;装备&nbsp;/&nbsp;卸下&nbsp;/&nbsp;弃置。</div>';
  }
  h+='</div>';
  host.innerHTML=h;
}

/* ── 半两钱 · 客户端权威的钱袋 ──────────────────────────────
   面板上的数字若只靠模型自己记，玩几轮必然漂：它会把「三千二百钱」写成「不少」，
   或者买完东西数字纹丝不动——那就成了纯摆设。
   所以买卖当场落到 GAME.lastPanel 上（mvuSpec 把这一份当「上一幕原值」发回去），
   模型下一轮拿到的就是改过的数，它只能照抄下去；改不改由我们说了算，不由它说了算。 */
function walletRead(){
  try{
    var ch=(GAME.lastPanel&&GAME.lastPanel.ch)||[];
    for(var i=0;i<ch.length;i++)if(ch[i][0]==='钱'){
      var n=parseInt(String(ch[i].slice(1).join('')).replace(/[^0-9\-]/g,''),10);
      return isNaN(n)?0:n;
    }
  }catch(_){}
  return 0;
}
function walletWrite(n){
  n=Math.max(0,Math.round(n||0));
  try{
    if(!GAME.lastPanel)GAME.lastPanel={ch:[],npc:[],wd:[]};
    if(!GAME.lastPanel.ch)GAME.lastPanel.ch=[];
    var ch=GAME.lastPanel.ch,hit=false;
    for(var i=0;i<ch.length;i++)if(ch[i][0]==='钱'){ch[i]=['钱',String(n)];hit=true;break;}
    if(!hit)ch.push(['钱',String(n)]);
    try{GENIVS.setPrev(GAME.lastPanel);}catch(_){}
  }catch(_){}
  return n;
}
function walletAdd(d){return walletWrite(walletRead()+d);}

/* ── MERCATVS · 咸阳市 ────────────────────────────────────────
   第三个抽屉，跟地图、装备并排。货是 ARMDB 里带 price 的那些，按 cat 分肆摆；
   带 ban 的（弩、戈、戟、甲、胄这一路官造禁物）照摆不误但买不了——
   摆出来是为了让人知道这世上有这么一条规矩。带 nomkt 的（金链、木传、官印、
   官给襦裙、私印、还有钱本身）连摆都不摆。
   买卖走的是跟 ARMA 详情卡同一套：walletAdd 当场改 GAME.lastPanel，
   再用 sendText 推一条真回合出去，把改后的数写死给模型。 */
/* 分类摆在最顶上，一点就切。九个 cat 归成六档——五百六十像素宽的抽屉里
   摆十个标签会挤成两行，反而不好点。 */
var SHOP_TABS=[['全部',null],
               ['吃食',['吃食','荤忌']],
               ['药',['药']],
               ['衣物',['衣物']],
               ['器用',['杂物','器物','消耗']],
               ['兵甲',['武器','防具']]];
var SHOP_SEC=['吃食','药','荤忌','衣物','杂物','器物','消耗','武器','防具'];
var SHOPTAB=0;
function shopGoods(){
  var out={},k;
  for(k in ARMDB){
    var it=ARMDB[k];
    if(!it||it.nomkt)continue;
    if(it.price==null&&!it.ban)continue;
    /* 这一代的货写明了在哪几处有；当前不在那几处就不上架。
       没写 at 的（以及原来那张秦的表）各处都有，照旧。 */
    if(FEG.set&&!FEG.set[k])continue;              /* 这一代的货单之外的一律不上架 */
    if(it.at&&FEG.at&&it.at.indexOf(FEG.at)<0)continue;
    var c=it.cat||'杂物';
    (out[c]=out[c]||[]).push(k);
  }
  return out;
}
function shopRender(){
  var host=$('#shopWrap');if(!host)return;
  var cash=walletRead(),g=shopGoods();
  var pick=SHOP_TABS[SHOPTAB]||SHOP_TABS[0],want=pick[1];
  var h='<div class="shTabs">';
  for(var ti=0;ti<SHOP_TABS.length;ti++){
    var t=SHOP_TABS[ti],cnt=0;
    if(t[1]==null){for(var kk in g)cnt+=g[kk].length;}
    else for(var ci=0;ci<t[1].length;ci++)cnt+=(g[t[1][ci]]||[]).length;
    h+='<span data-tab="'+ti+'"'+(ti===SHOPTAB?' class="on"':'')+'>'
      +esc2(t[0])+'&nbsp;'+cnt+'</span>';
  }
  h+='</div>';
  h+='<div class="shHead"><b>现钱&nbsp;'+cash+'&nbsp;'+esc2(FEG.unit)+'</b>'
    +'<span>'+(FEG.note?esc2(FEG.note.split('。')[0]):
      '半两钱&nbsp;·&nbsp;粟一石三十钱&nbsp;·&nbsp;布一匹十一钱&nbsp;·&nbsp;居赀日八钱')+'</span></div>';
  var any=false;
  for(var si=0;si<SHOP_SEC.length;si++){
    var sec=SHOP_SEC[si],ks=g[sec];
    if(!ks||!ks.length)continue;
    if(want&&want.indexOf(sec)<0)continue;
    any=true;
    h+='<div class="shSec">'+esc2(sec)+'</div>';
    ks.sort(function(a,b){return (ARMDB[a].price==null?1e9:ARMDB[a].price)
                               -(ARMDB[b].price==null?1e9:ARMDB[b].price);});
    for(var i=0;i<ks.length;i++){
      var k=ks[i],it=ARMDB[k];
      var banned=!!it.ban, poor=(!banned&&it.price>cash);
      h+='<div class="shRow'+((banned||poor)?' no':'')+'" data-buy="'+k+'">'
        +'<span class="ic">'+armIcon(it.ic,22)+'</span>'
        +'<span class="nm">'+esc2(it.cn)+'<i>'+esc2(it.la||'')+'</i></span>'
        +'<span class="pr">'+(banned?esc2(it.ban):(it.price+'&nbsp;'+esc2(FEG.unit)))+'</span>'
        +'<span class="bu">'+(banned?(FEG.canon?'阅':'禁'):(poor?'钱不够':'买&nbsp;入'))+'</span>'
        +'</div>';
    }
  }
  if(!any)h+='<div class="shNote">这一类今日无货。</div>';
  /* 这一段原先写死了秦的市制。有这一代的货单就换成它自己那一段。 */
  h+='<div class="shNote">'
    +(FEG.note?esc2(FEG.note)+'<br>'
      :('秦市有市亭、有市籍，物勒工名，贾人立于肆中。价钱随年成走，'
        +'这里列的是平年咸阳市的常价。<br>'))
    +(FEG.canon?'点开一件可读它在世界书里的条目。':
      ('买进的东西当场进行囊，钱当场从◆钱那一栏扣掉；'
      +'卖出去要在装备里点开那一件，只作价一半。<br>'
      +'官造的兵甲市上不卖，私藏要坐罪。'))
    +'</div>';
  host.innerHTML=h;
}
$('#shopWrap').addEventListener('click',function(e){
  var t=e.target;
  while(t&&t!==this&&!t.getAttribute('data-tab')&&!t.getAttribute('data-buy'))t=t.parentNode;
  if(!t||t===this)return;
  var tab=t.getAttribute('data-tab');
  if(tab!=null){SHOPTAB=parseInt(tab,10)||0;shopRender();this.scrollTop=0;return;}
  var k=t.getAttribute('data-buy'),it=ARMDB[k];
  if(!it)return;
  if(it.ban){if(window.SX)SX(FEG.canon?'tap':'deny');
    if(FEG.canon){var d=armDesc(k);invSys(it.cn+(d?('&nbsp;·&nbsp;'+esc2(d)):'&nbsp;·&nbsp;世界书未载其详'));return;}
    invSys(it.cn+'&nbsp;是官造之物，市上买不着；私藏要坐罪');return;}
  var cash=walletRead();
  if(it.price>cash){if(window.SX)SX('deny');invSys('钱不够。'+it.cn+'&nbsp;要&nbsp;'+it.price
    +'&nbsp;钱，手上只有&nbsp;'+cash+'&nbsp;钱');shopRender();return;}
  /* 守卫要在扣钱之前：局没开或者正在出文的时候，钱扣了而效用一次都没送出去，
     等于凭空吃掉玩家的钱——ARMA 那边踩过一次同样的坑。 */
  if(BUSY||!GAME.on){if(window.SX)SX('deny');invSys('这会儿买不成（正在出文或尚未入局）');return;}
  var sc=this.scrollTop;
  var left=walletAdd(-it.price);
  if(window.SX)SX('gear');
  bagAdd(k,1);invStore();invRender();shopRender();this.scrollTop=sc;
  invSys('市上买下&nbsp;'+it.cn+'&nbsp;×1，付&nbsp;'+it.price+'&nbsp;钱，余&nbsp;'+left+'&nbsp;钱');
  sendText('【ARMA·市】在市上买下'+it.cn+'一件，付钱'+it.price
    +'。手上的现钱由'+(left+it.price)+'减到'+left+'。'
    +'面板上◆钱这一栏本回合必须写作'+left+'，不许改成别的数、不许写成模糊的说法。'
    +'正文里写这一笔买卖是在哪一肆、经谁的手、旁边有谁看见。');
});
function invSys(msg){narrAdd('sys','【ARMA·装备】'+msg);}
$('#armWrap').addEventListener('click',function(e){
  var sel=e.target.closest?e.target.closest('[data-sel]'):null;
  var act=e.target.closest?e.target.closest('[data-act]'):null;
  if(act&&INVSEL){
    var a=act.getAttribute('data-act');
    if(a==='buy'||a==='sell'){
      var mi=(INVSEL.w==='eq')?INV.eq[INVSEL.k]:(INV.bag[INVSEL.k]||{}).id;
      var mit=mi?ARMDB[mi]:null;
      if(!mit||mit.price==null)return;
      if(a==='buy'){
        if(walletRead()<mit.price){invSys('钱不够。'+mit.cn+'&nbsp;要&nbsp;'+mit.price
          +'&nbsp;钱，手上只有&nbsp;'+walletRead()+'&nbsp;钱');return;}
        var nb=walletAdd(-mit.price);bagAdd(mi,1);
        invSys('买下&nbsp;'+mit.cn+'&nbsp;×1，付&nbsp;'+mit.price+'&nbsp;钱，余&nbsp;'+nb+'&nbsp;钱');
        if(!BUSY&&GAME.on)sendText('【ARMA·市】买下'+mit.cn+'一件，付钱'+mit.price
          +'。手上的现钱由'+(nb+mit.price)+'减到'+nb+'。'
          +'面板上◆钱这一栏本回合必须写作'+nb+'，不许改成别的数、不许写成模糊的说法。');
      }else{
        var got=Math.max(1,Math.floor(mit.price/2));
        var bb2=INV.bag[INVSEL.k];if(!bb2)return;
        if(bb2.n>1)bb2.n--;else INV.bag.splice(INVSEL.k,1);
        var ns=walletAdd(got);INVSEL=null;
        invSys('卖出&nbsp;'+mit.cn+'&nbsp;×1，得&nbsp;'+got+'&nbsp;钱，余&nbsp;'+ns+'&nbsp;钱');
        if(!BUSY&&GAME.on)sendText('【ARMA·市】卖出'+mit.cn+'一件，得钱'+got
          +'。手上的现钱由'+(ns-got)+'加到'+ns+'。'
          +'面板上◆钱这一栏本回合必须写作'+ns+'，不许改成别的数、不许写成模糊的说法。');
      }
      invStore();invRender();return;
    }
    if(a==='use'){
      /* 「用」不是换个位置放，是真的作用在她身上：吃下去／闻到／被泼。
         narrAdd 的 sys 行只画在屏幕上、进不了提示词，所以这里走 sendText，
         落成一条真回合，模型收到 【ARMA·用】 前缀必须按 eff 里的数执行。 */
      var ui=(INVSEL.w==='eq')?INV.eq[INVSEL.k]:(INV.bag[INVSEL.k]||{}).id;
      var uit=ui?ARMDB[ui]:null;
      if(!uit||!uit.use)return;
      /* sendText 的守卫要提前到「扣掉东西之前」——否则局没开或正在出文时，
         东西已经从行囊里没了，效果却一次都没送出去，等于凭空吃掉玩家的物件。 */
      if(BUSY||!GAME.on){invSys('这会儿用不了&nbsp;'+uit.cn+'（正在出文或尚未入局）');return;}
      if(uit.use.once){
        USED1=USED1||{};
        if(USED1[ui]){invSys(uit.cn+'&nbsp;这一局已经用过一次了');return;}
        USED1[ui]=1;
      }
      if(INVSEL.w==='eq')delete INV.eq[INVSEL.k];
      else{var ub=INV.bag[INVSEL.k];
        if(ub){if(ub.n>1)ub.n--;else INV.bag.splice(INVSEL.k,1);}}
      INVSEL=null;invStore();invRender();
      sendText('【ARMA·用】'+uit.use.act+'（'+uit.cn+'）。此物的效用是硬的，本回合必须落实：'
        +uit.use.eff+'。正文里先写身体的反应，再写她嘴上说什么。');
      return;
    }
    if(a==='equip'&&INVSEL.w==='bag'){
      var bi=INV.bag[INVSEL.k];if(!bi)return;
      var it=ARMDB[bi.id],slot=it.slot;
      if(bi.n>1)bi.n--;else INV.bag.splice(INVSEL.k,1);
      if(INV.eq[slot])bagAdd(INV.eq[slot],1);
      INV.eq[slot]=bi.id;
      invSys('装备&nbsp;'+it.cn+'（'+ARM_SLOTS[slot][1]+'）');
      INVSEL={w:'eq',k:slot};
    }else if(a==='unequip'&&INVSEL.w==='eq'){
      var uid=INV.eq[INVSEL.k];if(!uid)return;
      delete INV.eq[INVSEL.k];bagAdd(uid,1);
      invSys('卸下&nbsp;'+ARMDB[uid].cn+'，收入行囊');
      INVSEL=null;
    }else if(a==='discard'){
      if(!INVSEL.confirm){INVSEL.confirm=true;invRender();return;}
      var dd=null;
      if(INVSEL.w==='eq'){dd=INV.eq[INVSEL.k];delete INV.eq[INVSEL.k];}
      else{var bb=INV.bag[INVSEL.k];if(bb){dd=bb.id;
        if(bb.n>1)bb.n--;else INV.bag.splice(INVSEL.k,1);}}
      if(dd)invSys('弃置&nbsp;'+ARMDB[dd].cn+'&nbsp;×1');
      INVSEL=null;
    }
    invStore();invRender();return;
  }
  if(sel){
    var pr=sel.getAttribute('data-sel').split(':');
    var nk=pr[0]==='bag'?+pr[1]:pr[1];
    if(INVSEL&&INVSEL.w===pr[0]&&INVSEL.k===nk)INVSEL=null;
    else INVSEL={w:pr[0],k:nk};
    invRender();
  }
});
function gearLine(){
  var bits=[];
  if(GAME.place&&(GAME.place.cn||GAME.place.n))
    bits.push('【方位】当前所在：'+(GAME.place.cn||'')+(GAME.place.n?('（'+GAME.place.n+'）'):''));
  var eq=[],k2;
  for(k2 in INV.eq){var ei=ARMDB[INV.eq[k2]];
    if(ei)eq.push(ARM_SLOTS[k2][1]+':'+ei.cn);}
  var bag=INV.bag.map(function(b){var bi2=ARMDB[b.id];
    return bi2?(bi2.cn+(b.n>1?'×'+b.n:'')):'';}).filter(Boolean);
  var seg=[];
  if(eq.length)seg.push('着装：'+eq.join('、'));
  if(bag.length)seg.push('行囊：'+bag.slice(0,14).join('、')+(bag.length>14?('等'+bag.length+'件'):''));
  if(seg.length)bits.push('【装备】'+seg.join('｜')
    +'（不在此账上的物品即不在身上；取用、装卸须在正文交代动作；本清单为引擎账实，不得凭空增删——新物品必须来自军需领取、现场缴获或市集购入，且正文交代来源）');
  return bits.join('\n');
}
invRender();

/* mobile bottom nav（小岛式：点选或在胶囊上左右滑动切页） */
(function(){
  var tabs=gEl.querySelectorAll('.gNav span');
  var ORDER=['shop','map','narr','mfd'];
  var _paneWas=false;                 /* 切到情报台前三维是开着的第几档；false＝本来就关着 */
  function setPg(pg){
    for(var j=0;j<tabs.length;j++)tabs[j].classList.toggle('on',tabs[j].getAttribute('data-pg')===pg);
    gEl.setAttribute('data-pg',pg);
    if(pg==='map'){setTimeout(gmapRefresh,60);try{invRender();}catch(_){}}
    if(pg==='shop'){try{shopRender();}catch(_){}}
    /* 情报台的 z-index 是 20，三维画面是 25——不收起来的话它整块压在状态栏上，
       这一页从头到 70vh 全被挡住，玩家看到的就是「切过去也读不了」。
       离开这一页时再把它按原来的档位还原，玩家不会觉得自己的三维被谁关掉了。 */
    try{
      if(pg==='mfd'){
        if(window.__paneStash)_paneWas=window.__paneStash();
        /* 滚动位随渲染跨页残留：上次在别处把面板滚到很深，这次切进来内容高度又变了，
           视口可能正停在整段内容之下——同样是一片黑。进页一律回到面板顶。 */
        var _mf=gEl.querySelector('.gMfd');
        if(_mf){_mf.scrollTop=0;_mf.classList.add('pgJump');
          clearTimeout(window.__pgJumpT);
          window.__pgJumpT=setTimeout(function(){_mf.classList.remove('pgJump');},520);}
      }else if(_paneWas!==false){
        if(window.__paneRestore)window.__paneRestore(_paneWas);
        _paneWas=false;
      }
    }catch(_){}
  }
  for(var i=0;i<tabs.length;i++)(function(tb){
    tb.addEventListener('click',function(){setPg(tb.getAttribute('data-pg'));});
  })(tabs[i]);
  var nav=gEl.querySelector('.gNav'),sx=null;
  if(nav){
    nav.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;},{passive:true});
    nav.addEventListener('touchend',function(e){
      if(sx==null)return;
      var dx=e.changedTouches[0].clientX-sx;sx=null;
      if(Math.abs(dx)<28)return;
      var cur=gEl.getAttribute('data-pg')||'narr';
      var i2=ORDER.indexOf(cur);if(i2<0)i2=ORDER.indexOf('narr');
      i2=Math.max(0,Math.min(ORDER.length-1,i2+(dx<0?1:-1)));
      setPg(ORDER[i2]);
    },{passive:true});
  }
})();
/* ============ 引擎：回合史 / 打字机 / 神谕(AI) / 重演·回溯 / 语音 ============ */
var TURNS=[],TURNI=0,BUSY=false;
var CFGS={velo:1,font:1,narrPx:17,preset:''};
try{Object.assign(CFGS,JSON.parse(localStorage.getItem('guardianDragonCfg')||'{}'));}catch(_){}
delete CFGS.lux;   /* 白昼不持久：清掉旧版可能落盘的键 */
function cfgStore(){lsSet('guardianDragonCfg',JSON.stringify(CFGS))}
var VELOMAP=[26,13,4,0],FONTMAP=['15px','17px','19px','21px'];
/* 界面缩放：一根拉杆放大缩小全部文字层（正文／情报台／顶栏／输入区／所有弹窗）。
   对外只露 0–100 的刻度（0=最小、100=最大，1 格 1%），内部线性映射到真正有用的
   0.80–1.70 缩放系数。刻度定义在此处集中，别处一律走 uiQ→uiZoom 换算。 */
var UIZ_MIN=80,UIZ_MAX=170,UIQ_DEF=22;                  /* 真实缩放区间；22 格＝原尺寸 */
/* 分段线性：0→80%、UIQ_DEF→100%、100→170%。在原尺寸这一格钉死，免得默认档
   莫名其妙比原来小零点几个百分点；两段斜率 0.909 / 0.897，肉眼看不出拐点。 */
function uiQ2Pct(q){
  return q<=UIQ_DEF ? UIZ_MIN+q*(100-UIZ_MIN)/UIQ_DEF
                    : 100+(q-UIQ_DEF)*(UIZ_MAX-100)/(100-UIQ_DEF);
}
function uiPct2Q(p){
  return Math.round(p<=100 ? (p-UIZ_MIN)*UIQ_DEF/(100-UIZ_MIN)
                           : UIQ_DEF+(p-100)*(100-UIQ_DEF)/(UIZ_MAX-100));
}
/* 正文字号与界面缩放拆成两档。原来只有一根「字号」拉杆，动它整站一起缩放，
   想把正文调大一点、别的不动做不到。这一档只写 #gNarr 的 font-size，单位像素。
   老配置里的 CFGS.font 是四档的下标（FONTMAP），没设过 narrPx 时照它折算，向后兼容。 */
function narrPxGet(){
  var v=parseInt(CFGS?CFGS.narrPx:null,10);
  if(isNaN(v))v=parseInt(((typeof FONTMAP!=='undefined'&&FONTMAP[CFGS&&CFGS.font])||'17px'),10);
  if(isNaN(v))v=17;
  return Math.max(12,Math.min(30,v));
}
function narrPxApply(v){
  v=parseInt(v,10);if(isNaN(v))v=17;
  v=Math.max(12,Math.min(30,v));
  CFGS.narrPx=v;
  var n=$('#gNarr');if(n)n.style.fontSize=v+'px';
  var lab=$('#cfgNarrVal');if(lab)lab.textContent=v+'px';
  var sl=$('#cfgNarr');if(sl&&+sl.value!==v&&document.activeElement!==sl)sl.value=v;
  try{cfgStore();}catch(_){}
}
function uiScaleGet(){
  var q=(CFGS?CFGS.uiq:null);
  if(q==null||q===''){                                  /* 老存档只有 ui(80–170)，换算过来 */
    var old=parseInt((CFGS&&CFGS.ui)||100,10);
    if(isNaN(old))old=100;
    q=uiPct2Q(Math.max(UIZ_MIN,Math.min(UIZ_MAX,old)));
  }
  q=parseInt(q,10);if(isNaN(q))q=UIQ_DEF;
  return Math.max(0,Math.min(100,q));
}
function uiScaleApply(q){
  q=parseInt(q,10);if(isNaN(q))q=UIQ_DEF;
  q=Math.max(0,Math.min(100,q));
  var pct=uiQ2Pct(q);
  CFGS.uiq=q;
  CFGS.ui=Math.round(pct);                              /* 兼容旧键，别的地方可能还在读 */
  document.documentElement.style.setProperty('--ui',(pct/100).toFixed(4));
  var lab=$('#cfgUiVal');if(lab)lab.textContent=q+'%';
  var sl=$('#cfgUi');if(sl&&+sl.value!==q&&document.activeElement!==sl)sl.value=q;
  try{cfgStore();}catch(_){}
  try{if(GAME.on)setTimeout(gmapRefresh,60);}catch(_){}
}
var LUX=1;   /* 只有奶油一档：开机即白昼，没有黑夜可切 */
function luxApply(){
  LUX=1;
  document.documentElement.classList.add('lux');
  var cb=$('#cfgLux');
  if(cb){cb.checked=true;cb.disabled=true;
    var row=cb.closest&&cb.closest('.sRow,label,div');
    if(row){row.style.display='none';
      /* 那一行下面还跟着一段说明，讲的是已经不存在的开关，一并收掉 */
      var sub=row.nextElementSibling;
      if(sub&&sub.className&&String(sub.className).indexOf('sub')>=0)sub.style.display='none';}}          /* 设置里那一行也收起 */
}
try{luxApply();}catch(_){}
addEventListener('DOMContentLoaded',function(){try{luxApply();}catch(_){}});
function setSeg(sel,idx){var _el=$(sel);if(!_el)return;var ch=_el.children;for(var i=0;i<ch.length;i++)ch[i].classList.toggle('on',i===idx);}
function applyCfg(){
  narrPxApply(narrPxGet());
  setSeg('#sgVelo',CFGS.velo);
  uiScaleApply(uiScaleGet());
  if(CFGS.motus){                       /* 动效档位随设置恢复；没设过就跟随系统 */
    document.documentElement.setAttribute('data-motion',CFGS.motus);
    REDUCED=(CFGS.motus==='soft');
    try{setSeg('#sgMotus',REDUCED?1:0);}catch(_){}
  }
}
applyCfg();
function narrAdd(cls,html,tIdx){
  var nr=$('#gNarr'),p=document.createElement('p');
  if(cls)p.className=cls;
  if(tIdx!=null)p.setAttribute('data-t',tIdx);
  p.innerHTML=html;
  var _stk=nr.scrollHeight-nr.scrollTop-nr.clientHeight<90;
  nr.insertBefore(p,nr.querySelector('.gEot'));
  if(_stk)nr.scrollTop=nr.scrollHeight;
  return p;
}
function fmtBody(par){
  return esc2(par).replace(/\n/g,'<br>')
    .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
    .replace(/「([^」]*)」/g,'「<span class="q">$1</span>」');
}
/* Model prose wrapped in 【】 is FELINIA's inner-voice/narrative convention, not
   a tiny pale system notice. Actual notices call narrAdd('sys', ...) explicitly. */
function felNarrClass(par){return /^【/.test(String(par||'').trim())?'heart':'';}
var TYPE_GEN=0;   /* 代际令牌：换开局/读档/重演时旧打字链立刻失效 */
/* 视觉小说全屏时底下那只对话框在另一个文件里（felinia-vn.js），
   它要按玩家自己调的字速打字，也要知道这一回是不是还在流——
   还在流就别抢着播，等这一回落定再从头念。 */
try{
  window.felVelo=function(){try{return REDUCED?0:VELOMAP[CFGS.velo];}catch(_){return 13;}};
  window.felBusy=function(){try{return !!BUSY;}catch(_){return false;}};
}catch(_){}
function typeParas(paras,tIdx,done,instant){
  var gen=TYPE_GEN,speed=instant?0:VELOMAP[CFGS.velo];
  if(!paras.length){done&&done();return;}
  var par=paras.shift(),html=fmtBody(par);
  /* instant 必须一路传下去：漏传的话只有第一段是即时的，从第二段起又回落成
     13ms/字重打一遍——流式明明已经出完字了，玩家还要再等十几秒看它重放。 */
  if(felNarrClass(par)){narrAdd('heart',html,tIdx);typeParas(paras,tIdx,done,instant);return;}
  if(!speed||REDUCED){narrAdd(null,html,tIdx);typeParas(paras,tIdx,done,instant);return;}
  var p=narrAdd(null,'',tIdx),tmp=document.createElement('div');tmp.innerHTML=html;
  var txt=tmp.textContent,i=0,sc=0,nr=$('#gNarr');
  var _atEnd=(nr.scrollHeight-nr.scrollTop-nr.clientHeight<120);   /* 只在开头量这一次 */
  (function tick(){
    if(gen!==TYPE_GEN)return;
    if(i>=txt.length){p.innerHTML=html;typeParas(paras,tIdx,done,instant);return;}
    i+=1+(speed<8?2:0);
    p.textContent=txt.slice(0,i);
    /* 原先每 3 帧读一次 scrollHeight/scrollTop/clientHeight——读取即强制同步重排，
       而 #gNarr 装着整局所有段落，越玩越长，打字到后面就越来越顿（回合数的平方）。
       改为只写不读：贴底与否在开打前判一次，之后一路 scrollTop 拉到底即可。 */
    if((sc++%3)===0&&_atEnd)nr.scrollTop=nr.scrollHeight;
    tmo(tick,speed);
  })();
}
function turnOps(tIdx,rawText){
  var nr=$('#gNarr'),d=document.createElement('div');
  d.className='sys tOps';d.setAttribute('data-t',tIdx);
  d.style.cssText='display:flex;gap:16px;font-size:9px;letter-spacing:.22em;margin:-6px 0 14px';
  d.innerHTML='<span class="op" data-op="tts" style="cursor:pointer;color:var(--gold)">诵此回</span>'
    +'<span class="op" data-op="draw" style="cursor:pointer;color:var(--gold)">✦ 绘此回</span>'
    +'<span class="op" data-op="translate" title="使用当前翻译器重新翻译本回" style="cursor:pointer;color:var(--gold)">↺ 重译</span>'
    +'<span class="op" data-op="redo" style="cursor:pointer;color:var(--gold)">↻ 重演</span>'
    +'<span class="op" data-op="back" style="cursor:pointer;color:var(--gold)">⤺ 回退</span>';
  nr.insertBefore(d,nr.querySelector('.gEot'));
}
/* 老存档的正文 HTML 里没有重译钮。读档时就地补齐，只改操作栏，不碰正文。 */
function ensureTurnTranslateOps(root){
  (root||$('#gNarr')).querySelectorAll('.tOps[data-t]').forEach(function(bar){
    if(bar.querySelector('[data-op="translate"]'))return;
    var op=document.createElement('span');op.className='op';op.setAttribute('data-op','translate');
    op.title='使用当前翻译器重新翻译本回';op.style.cssText='cursor:pointer;color:var(--gold)';op.textContent='↺ 重译';
    var redo=bar.querySelector('[data-op="redo"]');bar.insertBefore(op,redo||null);
  });
}
/* 委托绑定：存档经 innerHTML 序列化后按钮依然可用 */
$('#gNarr').addEventListener('click',function(e){
  var op=e.target.closest&&e.target.closest('[data-op]');if(!op)return;
  var a=op.getAttribute('data-op');
  if(a==='draw')drawScene();
  else if(a==='translate'){
    var _th=op.closest('[data-t]'),_tt=_th?+_th.getAttribute('data-t'):-1;
    felRetranslateTurn(_tt,op);
  }
  else if(a==='redo'){
    /* 这个钮一律转发给顶栏的 gRedo，而 gRedo 只认 TURNS 的最后一条：
       玩家往上滚、点第 3 回的「重演」，被删掉重写的是第 10 回，第 3 回原封不动。
       玩家会以为按钮坏了反复点，于是最新回合被反复删掉重生成。 */
    var _rh=op.closest('[data-t]'),_rt=_rh?+_rh.getAttribute('data-t'):-1;
    var _rl=TURNS[TURNS.length-1];
    if(_rl&&_rl.role==='assistant'&&_rl.t===_rt)$('#gRedo').click();
    else narrAdd('sys','只能重演最后一回',null);
  }
  else if(a==='back'){
    /* 与 redo 同理：回退只动最后一回，点老段落上的回退会让人误以为能删中间那一段 */
    var _bh=op.closest('[data-t]'),_bt=_bh?+_bh.getAttribute('data-t'):-1;
    var _bl=TURNS[TURNS.length-1];
    if(_bl&&_bl.role==='assistant'&&_bl.t===_bt)$('#gBack').click();
    else narrAdd('sys','只能回退最后一回',null);
  }
  else if(a==='tts'){
    /* 正在念就当停止钮用——原先输入区那个喇叭兼着这个职责，钮挪走后由它接手 */
    if(ttsAudio&&!ttsAudio.paused){ttsAudio.pause();return;}
    if(window.speechSynthesis&&speechSynthesis.speaking){speechSynthesis.cancel();return;}
    var host=op.closest('[data-t]'),tI=host?host.getAttribute('data-t'):null,txt='';
    if(tI!=null)document.querySelectorAll('#gNarr p[data-t="'+tI+'"]').forEach(function(n){txt+=n.textContent+'\n';});
    speakText(txt||$('#gNarr').textContent.slice(0,1200));
  }
});
function renderReply(text,tIdx,instant){
  var panel=GENIVS.completeMvu(mvuMerge(GAME.lastPanel,parseMvu(text)),text);
  /* 思维链绝不能当正文：不剥的话它会被渲染出来、被 TTS 念出来、进配图提示词，
     还原样存进 TURNS，此后每一轮回喂给模型，既烧 token 又教会它继续写元评论。 */
  var body=felNormalizeMeowText(stripMvu(stripCoT(text)));
  var after=function(finalText){
    typeParas(finalText.split(/\n{2,}/),tIdx,function(){
      if(tIdx!=null)turnOps(tIdx,finalText);
      if(typeof SET!=='undefined'&&SET.tts.auto===1)speakText(finalText);
      if(typeof SET!=='undefined'&&SET.img.on===1&&SET.img.auto===1)drawScene();
      /* 这一幕落定了，就该把下一步那一句浅字提出来 */
      try{suggGen();}catch(_){}
    },instant);
    /* 就算这轮 AI 整段没写面板，也照旧重绘一次：心声、编年史、人物图谱、长程记忆
       全靠 renderMvu 这一脚往前推，跳过它等于这一回合从记忆里整个蒸发。 */
    renderMvu(panel||GAME.lastPanel);
  };
  /* memSync 只挂在 renderMvu 里；模型漏写状态栏那一回若不补一脚，
     这一回合就整个不进编年史与长程记忆。 */
  try{if(!panel)memSync();}catch(_){}
  after(body);
}
/* ── 生成等待·启发式进度条（Ghost 移植）───────────────────────────
   接口吐第一个字之前不给任何进度信号，故以【本机最近 8 轮首字耗时中位数】为预估，
   进度按指数渐近爬升、封顶 94%，真正出字才冲满——绝不虚报 100%。 */
var GEN={t0:0,est:0,active:false,mode:'',phase:'',chars:0,el:null,fill:null,txt:null,tmr:null,
  samples:(function(){try{var a=JSON.parse(localStorage.getItem('guardianDragonTtft')||'[]');
    return Array.isArray(a)?a.slice(-8):[];}catch(e){return [];}})()};
var GENAC=null;                                    /* 本轮请求的 AbortController，供「中断」用 */
function ttftMedian(){var a=GEN.samples.slice().sort(function(x,y){return x-y;});
  return a.length<1?0:a[Math.floor(a.length/2)];}
function genPct(){
  if(GEN.chars>0)return Math.min(99,60+Math.min(39,GEN.chars/28));   /* 已出字：按字数推进 */
  var el=Date.now()-GEN.t0,est=GEN.est||9000;
  return Math.min(94,Math.max(4,(1-Math.exp(-el/(est*0.55)))*100));
}
function genBlocks(pct){var n=Math.round(Math.max(0,Math.min(100,pct))/10),o='';
  for(var i=0;i<10;i++)o+=(i<n?'\u2593':'\u2591');return o;}
function genLabel(){
  var el=Date.now()-GEN.t0,sec=(el/1000).toFixed(el<10000?1:0),bar=genBlocks(genPct());
  if(GEN.phase==='planning')return 'ORACVLVM · '+(GEN.mode==='forge'?'铸局推演':'推演人物与局势')+'…… '+bar+' '+sec+'s';
  if(GEN.mode==='forge')return 'ORACVLVM · 铸局中…… '+bar+' '+sec+'s';
  if(GEN.phase==='writing'&&!GEN.chars)return 'ORACVLVM · 推演完成 · 等待落笔…… '+bar+' '+sec+'s';
  if(GEN.chars>0)return 'ORACVLVM · 神谕落笔…… '+bar+' '+GEN.chars+' 字';
  if(GEN.est&&el>GEN.est*1.6)return 'ORACVLVM · 建立链路…… '+bar+' '+sec+'s · 回线拥堵';
  return 'ORACVLVM · 建立链路…… '+bar+' '+(GEN.est?(Math.round(genPct())+'%'):(sec+'s'));
}
function genOpen(mode){
  genClose(true);
  GEN.active=true;GEN.mode=mode||'gen';GEN.phase='planning';GEN.t0=Date.now();GEN.est=ttftMedian();GEN.chars=0;
  var nr=$('#gNarr'),d=document.createElement('div');
  d.className='genBar';
  d.innerHTML='<div class="gbTrack"><i id="genFill"></i><span id="genTxt"></span></div>'
    +'<span class="gbStop" data-act="genStop">✕ 中断</span>';
  nr.insertBefore(d,nr.querySelector('.gEot'));
  GEN.el=d;GEN.fill=d.querySelector('#genFill');GEN.txt=d.querySelector('#genTxt');
  d.querySelector('.gbStop').addEventListener('click',function(){
    try{if(GENAC)GENAC.abort();}catch(_){}
  });
  if(nr.scrollHeight-nr.scrollTop-nr.clientHeight<90)nr.scrollTop=nr.scrollHeight;
  genPulse();
}
function genPulse(){
  if(!GEN.active){GEN.tmr=null;return;}
  var pc=genPct();
  if(GEN.fill)GEN.fill.style.width=pc.toFixed(1)+'%';
  if(GEN.txt)GEN.txt.textContent=genLabel();
  GEN.tmr=setTimeout(genPulse,180);
}
function genFirstToken(){                          /* 首字抵达：记一次 TTFT 样本 */
  if(GEN.mode!=='gen'||GEN._ttft)return;GEN._ttft=1;
  var dt=Date.now()-GEN.t0;
  if(dt>=250&&dt<=90000){GEN.samples.push(dt);
    if(GEN.samples.length>8)GEN.samples=GEN.samples.slice(-8);
    try{localStorage.setItem('guardianDragonTtft',JSON.stringify(GEN.samples));}catch(_){}}
}
function genClose(){
  GEN.active=false;GEN._ttft=0;GEN.phase='';GEN.chars=0;
  if(GEN.tmr){clearTimeout(GEN.tmr);GEN.tmr=null;}
  if(GEN.el){try{GEN.el.remove();}catch(_){}GEN.el=null;GEN.fill=null;GEN.txt=null;}
}
/* —— 神谕（AI）接入 —— */
var API={format:'openai',base:'',key:'',model:'',img:''};
try{Object.assign(API,JSON.parse(localStorage.getItem('guardianDragonApi2')||'{}'));}catch(_){}
function apiStore(){lsSet('guardianDragonApi2',JSON.stringify(API))}
function apiReady(){return !!(API.base&&API.model);}
/* 关键词可能被写成 "罗马,元老院" 这样的字符串（不少 ST 世界书就是这么存的）。
   当数组用的话 .length 是字符数、[k] 是单字，「她走进马厩」里的「马」就会误命中。 */
function _loreKeys(v){
  if(Array.isArray(v))return v;
  if(typeof v==='string')return v.split(/[,，、|]/);
  return [];
}
/* 世界书里混着两种东西：一种是这个世界的史料（塔克文王朝、西班牙短剑、
   贝罗娜神庙——提到那位战神是理所当然的，不该动）；另一种是伪装成词条的
   玩法铁则（【铁则】玩家即贝罗娜、【铁则】文风与叙事守则、【铁则】东方之神的
   出现方式……），它们讲的是「主角是谁、镜头钉在谁身上」。
   有一条常驻词条标题就叫「【铁则】玩家即贝罗娜」，每回合都进提示词——
   换了人来演时它和【本局主角】那段正面顶牛，而它数量占优（实测世界书贡献了
   全篇 37 次「贝罗娜」里的 26 次）。所以：标题带【铁则】的按指令处理跟着改名，
   其余史料一个字不动。 */
function loreBind(e){
  var t='『'+(e&&e.title||'')+'』'+(e&&e.content||'');
  return /铁则/.test(e&&e.title||'') ? heroRebind(t) : t;
}
function feEraI(){try{return (FE&&FE.era&&FE.era.i)|0;}catch(_){return 0;}}
/* 本局是哪一代。取不到就返回 0，分代闸门整个不闸——宁可照旧，也不要闸错。 */
function _eraNow(){
  var i=0,open=false;
  try{var w=$('#feWrap');open=!!(w&&w.classList.contains('on'));}catch(_){}
  /* 铸局那一层开着的时候（condereSys 也要检索世界书），以刚选的那一代为准：
     那会儿 GAME.op 还是上一局的，照它走会按上一代发条目。 */
  if(open)i=feEraI();
  if(!i)try{if(GAME.op&&GAME.op.ei)i=GAME.op.ei|0;}catch(_){}
  /* 老存档里没有 ei，只有年份。annals 的 ys 是每一代的起始年，
     取「小于等于这一年的最后一代」——自定义开局填的年份落在两代之间也有着落。 */
  if(!i)try{
    var y=(GAME.op&&GAME.op.year),by=null;
    if(y!=null&&y!==''){
      var an=(CARDS[ACTIVE]&&CARDS[ACTIVE].annals)||[];
      for(var k=0;k<an.length;k++){var a=an[k];
        if(!a||!a.i||a.ys==null)continue;
        if(a.ys<=y&&(by===null||a.ys>by)){by=a.ys;i=a.i|0;}}
    }
  }catch(_){}
  if(!i)i=feEraI();
  return i|0;
}
/* FELINIA 叙事规范 v3：世界书只保存事实；写法在作者层；人物连续心理由隐藏规划器维护。 */
var FELINIA_AUTHOR_NOTE=`【作者层·实时意识驱动的中文叙事】
写成韩国网络小说的自然中文译文感：核心不是韩语标记词，也不是故意拉长句子，而是让一名人物的意识在事件中实时移动。用当代、清楚、可读的中文；历史名物只在本时代确有需要时使用，不给普通叙述刷一层仿古漆。

【一幕怎样推进】
先抓住玩家本轮明确写出的最后一句或动作，让周围世界立即产生可见后果。每幕确定眼前欲求、阻力、一次误读、迫使误读修正的新证据，以及关系距离的变化。按“感知 → 暂时解释 → 联想或自我辩解 → 修正判断 → 行动”推进；可以迟疑和误判，但因果不能断。每回让关系、风险、决定、发现或代价中的一项真正变化，不能复述设定、原地等待或另起与玩家无关的事件。

【有限视角与心里一层】
玩家角色的台词、动作、观察、判断、决定和内心只归玩家，未写出的部分完全不补。场上有重要非玩家角色时，选与本轮冲突最相关的一人作唯一内心焦点；她/他在幕后持续保有“想从这次交涉得到什么、坚持让自己显得怎样、惯用什么办法取得东西、最不肯承认什么”。需要直接显露时，用（）写短促自言，用【】写压不住的内心句，让这一层形成有起伏、有修正的连续线，而不是一句情绪标签；长短与疏密由场面自然决定，不以字符比例、次数或段落配额控制。其他人物同样有私心，却只让它从措辞、停顿、过度纠正、反复习惯和选择里漏出来，禁止逐人读心或来回跳脑袋。

【角色怎样活着】
人物只凭自己确实知道的事实行动。条目里的台词是声线样本，不是台词表；必须针对眼前的新对象、新动作和新利害重新组织说法，不照抄范句，不重复最近三回的原句或同一种推脱。每名重要人物保有稳定但不僵死的句式签名：通常怎样开口、怎样抢或让回合、先注意哪类具体细节、被证伪时怎样修正、什么欲望会从措辞里漏出、怎样收尾并把压力留给对方。对方实际说了什么，必须改变下一句，不能沿预写独白继续。身份、教养、年龄、处境、关系和权力改变表面状态，但不要让所有人共享一种迟疑、冷静或嘴硬。

【停顿与情绪高峰】
“……”和更长的“…………”是韩国网文对白中正常的呼吸，可用于隐藏、试探、争取时间或突然明白；同一段附近已有省略号时，只要作用不同就保留，不按标点卫生机械删平，也不把省略号当人物口癖或次数配额。果断的人在不需要停顿时就直接说。情绪高峰要同时改变注意目标、句法、身体或行动，但仍留下这个人物最根本的习惯；冲突结束后也不必立刻恢复成统一的冷静语气。

【落笔质地】
用具体器物、声音、温度、气味、重量、距离和动作承载处境；感官必须服务于决定，不为氛围单独堆景。普通器物从眼前地点、人物能用的手段、习惯、季节和正在做的动作中自然出现；上一幕的饭菜、衣物、气味或范例道具不能自动变成全书反复出现的意象，除非它仍在场，或再次出现已经改变记忆、匮乏、关系。句子可长可短，服从念头的转折和呼吸，不把连续思路切成镜头碎片，也不用整齐对偶。对白使用「」，转述使用『』。结尾停在一个已经发生、并把选择递回玩家的动作、话音或物件上，不提问、不列选项、不总结、不预告。

【拒绝的写法】
不写摄像机、特写、镜头切换式指令；不写清单体碎句、现成哲理、末句金句、装饰性天气、旁白总结和设定讲义；不使用中文网文套语、说书腔、江湖腔或故作深沉的停顿。残酷、欲望、压迫、暴力和粗话只在人物、时代事实与眼前因果要求时出现，不按场次配额硬塞，也不靠误会、疾病或廉价悔意洗白。`;

var FELINIA_NPC_ENGINE=`【人物行为·只作为写作依据，不得解释给玩家】
本幕唯一焦点先确定四件事：她/他想从这次交涉得到什么；坚持让自己显得怎样；惯用什么办法取得东西；最不肯承认什么。随后只按自己已经知道的事实，经历感知、误读、证据、修正与行动。每名开口者同时保有自己的开口、回合、注意、修正、泄漏和收尾选择；对方的实际回应会改变下一句。让嘴上说法与真实盘算存在符合该人物的缝隙，但不强迫人人反话、人人爆发或人人残酷。其他人物保留各自的私有动机和未知信息，不共享全知视角；除非明确换幕或换视角，不直接打印他们的内心。`;

var FELINIA_FINAL_CHECK=`【落笔前静默检查】
一，是否逐字承接玩家本轮输入，没有补写玩家未写的任何言行或内心？
二，是否只有一个可直接显露内心的非玩家焦点，其他人物仍有私有动机但没有跳视角？
三，焦点的判断是否因本幕证据发生了可追踪的变化，人物是否做出一个具体行动？
四，人物说的是眼前这句话，而不是复诵角色条目、口头禅或最近三回的原句？
五，对方的实际回应是否改变了下一句，且每个开口者仍能从开口、回合、注意、修正、泄漏与收尾方式中辨认？
六，本回是否推进了关系、风险、决定、发现或代价，并在选择真正属于玩家的瞬间停下？
七，器物是否来自当前场景，而不是把旧饭菜、旧衣物、旧气味或范例道具机械复用成意象？
八，是否删掉了镜头术语、碎片清单、格言式收束、装饰性氛围、仿古漆和设定说明？
九，人物、器物、制度、知识和称谓是否只来自当前时代、当前地点、已触发事实与在场名单？
十，<mvu_panel> 是否遵守唯一协议？自检只在内部完成，不向玩家展示。`;

var FELINIA_VOICE_EXAMPLE=`<START>
{{user}}: 【ACTVS】把木牌递到守门的猫娘面前。
{{char}}: 木牌停在灯下。守门的猫娘没有立刻去接，只把灯往前送了半尺。

牌角那道新裂纹里还嵌着浅灰，她的指甲已经压上册页，却没有翻过去。

（旧版。偏偏在我值门的时候送来。先问来处，他就知道我没认出来；先收下，这摊事就算进了我的名字。）

旁边的人咳了一声。她的耳尖朝那边偏了一下，又硬生生转回来。

【别催。让我先看清那两个印到底差在哪里。】

她把灯芯拨低，石台上前后两个圆印同时露了出来，随后只用一根手指按住木牌，没有接走。

「名字……先把名字说清楚喵。」

旁边的人刚要说那枚印不是旧版，她的手指便在空栏上刹住。

「不对，先别说名字。谁让你从侧门进来的喵？」

刚才还打算把册子推给队长的那只手，已经横在了木牌与门缝之间。

这个例子只展示判断怎样因新证据修正、说话选择怎样随之变化；其中的木牌、灯、册子、裂纹和句子都不是可复用的意象或台词。`;

window.__FELINIA_WRITING__={version:3,authorNote:FELINIA_AUTHOR_NOTE,
  npcEngine:FELINIA_NPC_ENGINE,finalCheck:FELINIA_FINAL_CHECK,example:FELINIA_VOICE_EXAMPLE};

/* ============================================================================
   GENIVS · 本地弱AI（纯规则 · 零网络 · 不需要任何 API）
   职责是把三样东西缝起来：三维引擎的账实、云端神谕写的正文、情报台的状态栏。
     brief()       —— 读三维世界，生成摘要塞进 prompt，让 AI 知道城里到底有什么
     absorb()      —— 读 AI 正文，抽出可执行意图，驱动三维（建、拆、来、去）
     completeMvu() —— 补全 AI 漏写的状态栏栏位，保证每轮每栏每行都有值
     offlineTurn() —— 没配 API 时也能推进一个回合，状态照常更新、且不循环
   它不负责文采，只负责「状态正确、字段齐全、不原地打转」。
   ============================================================================ */
var GENIVS=(function(){
  var PREV=null;          /* 上一轮补全后的面板，用作 carry-forward 的底 */
  var RING=[];            /* 降级叙述的反循环环形缓冲 */
  var APPLIED={};         /* 已落地的意图哈希，防重复应用 */

  /* 按「正在显示的那台引擎」取，而不是按卡片。罗马卡的开局 8「东方尽头」把画面交给了
     中原引擎（zh3d:'咸阳'），◇时地 里出现洛邑/邯郸/临淄等中原城名时也一样；
     此时 ACTIVE 仍是 'roma'，原来的写法把 brief()/absorb() 整条链都打到了看不见的
     MED3D 上：MED3D 没有 cityKey → snapshot() 返回 null → 系统提示里整段【三维实况】
     和 <sec_deed> 回执说明全部消失，AI 不知道三维里有什么、也不会写回执；
     反过来正文里的建／拆／来／去也落在看不见的那座城里。 */
  function ENG(){
    try{
      var cur=window.__CUR3D;
      if(cur&&cur.owns&&cur.owns())return cur;
    }catch(_){}
    try{return (ACTIVE==='zhou')?window.ZJ3D:window.MED3D;}catch(_){return null;}
  }
  function snap(){
    var e=ENG();
    try{return (e&&e.owns&&e.owns()&&e.snapshot)?e.snapshot():null;}catch(_){return null;}
  }

  /* ---------------- 一 · 三维 → prompt ---------------- */
  function brief(){
    var s=snap();if(!s||!s.city)return '';
    var L=['【三维实况·引擎账实·最高可信】以下是三维画面此刻的真实状态，由引擎直接读出。'
          +'叙事必须与之相容：这里列出的一定在场，没列出的不得当作已经存在；'
          +'金额与数量不得凭空更改。'];
    L.push('· 城池：'+s.city+(s.mode==='interior'?('（室内·'+s.interior+'）'):'')
          +(s.night?'，此刻入夜':'，此刻白日'));
    L.push('· 主角方位：'+s.playerPos+'；随行 '+s.escortN+' 人'+(s.captive?'（受制，仪仗尽散）':''));
    L.push('· 库藏：金 '+s.gold+'（岁入 +'+s.rate+'/分）');
    L.push(s.builds.length
      ? ('· 城中已立：'+s.builds.map(function(b){return b.disp+(b.n>1?('×'+b.n):'')+'（'+b.pos+'）';}).join('、'))
      : '· 城中尚无主角所立之物。');
    if(s.pawns.length)
      L.push('· 眼前可见之人：'+s.pawns.slice(0,10).map(function(p){return p.name+'（'+p.cat+'·'+p.pos+'）';}).join('、')
            +'。这些人此刻确实站在画面里，本回若写到他们，请照此写进 ◈ 行。');
    if(s.ledger.built.length||s.ledger.razed.length)
      L.push('· 尚未奏报的营造：兴作 '+s.ledger.built.length+' 项、除旧 '+s.ledger.razed.length+' 项。');
    if(s.vocab&&s.vocab.length)
      L.push('【三维回执·可选】本回若有建筑兴废或人物进出此城，'
            +'在 </mvu_panel> 之后（务必在面板外面，绝不许写进面板里）另起一段：\n'
            +'<sec_deed>\n▣兴作|名物×数\n▣毁损|名物\n▣来者|人名|身份词\n▣去者|人名\n</sec_deed>\n'
            +'没有变化就整段不写。「名物」只能取自下列词表，取最接近的一个，不要自造；'
            +'「人名」照正文写，不受词表约束，「身份词」用来给他画个像（如 将／医／商／祭／匠／史／农／士）：'
            +s.vocab.slice(0,80).join('、'));
    return L.join('\n');
  }

  /* ---------------- 二 · AI 正文 → 意图 → 三维 ---------------- */
  var RX={
    build:/(?:新?[起筑建修盖营兴](?:造|建|作|了)?|立起|竖起|竖立|落成|竣工|拔地而起)\s*[了着]?\s*([一二三四五六七八九十两\d]*)\s*[座间栋处所株棵条段]?\s*([^\s，。、；：！？的「」（）]{1,6})/g,
    /* 原来的 夷|平|烧 三个单字太松：「平和」「太平」「平原」「平旦」「烧饭」全被判成
       拆毁意图，安稳每回白掉 3 点，absorb 还会拿「和无事」之类的碎词去查可拆之物。
       一律改成必须成词——单字只留语义唯一的 拆／焚／毁。 */
    raze :/(?:付之一炬|夷为平地|夷平|铲平|削平|荡平|推倒|坍塌|拆除|拆毁|拆掉|焚毁|焚烧|烧毁|毁去|毁掉|拆|焚|毁)\s*[了掉去]?\s*([^\s，。、；：！？的「」（）]{1,6})/g,
    come :/([^\s，。、；：！？「」（）]{2,8})(?:入城|抵达|来到|求见|踏入|现身)/g,
    go   :/([^\s，。、；：！？「」（）]{2,8})(?:离去|退下|告退|出城|扬长而去|不见踪影)/g
  };
  var CN={'一':1,'两':2,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};
  var TIMERX=[[/一年[后过]|翌年|次年/,365],[/月余|一个?月[后过]/,30],[/旬日|十日后/,10],
              [/三[日天][后过]/,3],[/次日|翌日|第二天/,1]];

  function intents(text){
    var t=String(text||''),out=[],m;
    RX.build.lastIndex=0;
    while((m=RX.build.exec(t)))out.push({op:'build',name:m[2],n:(CN[m[1]]||parseInt(m[1],10)||1),conf:.6});
    RX.raze.lastIndex=0;
    while((m=RX.raze.exec(t)))out.push({op:'raze',name:m[1],n:1,conf:.6});
    RX.come.lastIndex=0;
    while((m=RX.come.exec(t)))out.push({op:'come',name:m[1],n:1,conf:.4});
    RX.go.lastIndex=0;
    while((m=RX.go.exec(t)))out.push({op:'go',name:m[1],n:1,conf:.4});
    return out;
  }
  function daysOf(text){
    for(var i=0;i<TIMERX.length;i++)if(TIMERX[i][0].test(text))return TIMERX[i][1];
    return 0;
  }

  function absorb(reply,turnIdx){
    var e=ENG();if(!e||!e.owns||!e.owns()||!e.applyEdict)return;
    /* 正文里若已有结构化的 <sec_deed>，那条路归 edictSync／medEdictSync 管，
       这里绝不能再应用一次：applyEdict 用 key 前缀判「是否重演此幕」，
       两边用不同前缀各调一次，第二次会把第一次刚落地的东西整个 undo 掉。 */
    try{if(typeof parseDeed==='function'&&parseDeed(reply))return;}catch(_){}
    var key='g'+turnIdx+'@'+((typeof deedHash==='function')?deedHash(reply):String(turnIdx));
    if(APPLIED[key])return;APPLIED[key]=1;
    var spec={build:[],raze:[],come:[],go:[]},got=false;
    intents(reply).forEach(function(it){
      if(it.conf<0.4)return;
      /* 建/拆必须能对到真实可建之物，对不上就丢弃——绝不瞎猜着往场景里塞东西 */
      if((it.op==='build'||it.op==='raze')&&(!e.resolve||!e.resolve(it.name)))return;
      if(!spec[it.op])return;
      spec[it.op].push({name:it.name,n:Math.min(3,it.n||1)});got=true;
    });
    if(!got)return;
    try{e.applyEdict(spec,key);}catch(_){}
    try{if(typeof zj3dTick==='function')zj3dTick();}catch(_){}
  }

  /* ---------------- 三 · 补全状态栏 ---------------- */
  var WD_KEYS=['纪年','时地','天气','安稳','大势','将临'];
  /* 栏名从卡的 panelSpec 推出来。写死过一次（形貌…威望|征服…），换一张卡
     两处就对不上：模型照旧写威望，面板按恩宠去找，条永远是空的。 */
  function chKeys(){return panelChKeys();}
  /* 前两条原来是「天朗气清」「云压得低」——本身就不含 晴/阴/雨/雪/风/雾 六字之一，
     落到它们时心象图不出图标，下一轮又被自己的校验判成非法再随机一次。 */
  var WX=['天晴气朗','阴云压得低','风过柱廊','雨敲在瓦上','雾锁河面','雪落石阶'];

  function get(rows,k){for(var i=0;i<rows.length;i++)if(rows[i][0]===k)return rows[i].slice(1).join('|');return null;}
  function set(rows,k,v){for(var i=0;i<rows.length;i++)if(rows[i][0]===k){rows[i]=[k,v];return;}rows.push([k,v]);}
  function num(v,d){
    /* 全角数字（模型常写「４２」）先转半角，否则 parseInt 直接 NaN、整栏被判成没写 */
    var t=String(v==null?'':v).replace(/[０-９]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-65248);});
    var n=parseInt(t,10);return isNaN(n)?d:Math.max(0,Math.min(100,n));}
  function bumpEra(era,d){
    if(!d)return era;
    return String(era||'').replace(/前(\d+)年/,function(_,y){
      var yy=+y-Math.floor(d/365);return '前'+(yy>0?yy:1)+'年';});
  }

  function completeMvu(panel,rawText){
    /* 一切启发式都必须在剥掉状态栏之后的正文上跑。rawText 是 AI 的完整原文，面板本身
       就带着「◆血兴」的血、「◆持物|短剑」的剑、「◇纪年|前48年」的年份、以及一整套
       会被 intents() 误判成建/拆意图的字眼——在它上面数字符，等于让面板自己驱动自己。 */
    var s=snap(),txt=(function(t){try{return stripMvu(t);}catch(_){return t;}})(String(rawText||''));
    var p=panel||{ch:[],npc:[],wd:[]};
    var prev=PREV||{ch:[],npc:[],wd:[]};
    p.ch=p.ch||[];p.npc=p.npc||[];p.wd=p.wd||[];

    /* 世界段：缺的先从上一轮继承，再按引擎与规则校正 */
    WD_KEYS.forEach(function(k){
      if(get(p.wd,k)==null){var pv=get(prev.wd,k);if(pv!=null)set(p.wd,k,pv);}
    });
    var dy=daysOf(txt);
    if(dy&&get(p.wd,'纪年')===get(prev.wd,'纪年'))
      set(p.wd,'纪年',bumpEra(get(p.wd,'纪年'),dy));
    /* 只在这一栏整个为空时才用引擎城名兜底。原来是「时地里不含引擎城名就整段改写」：
       AI 写的「拂晓 · 台伯河下游滩涂」「夜 · 战神广场」被改写成「拂晓 · 罗马」，
       具体场所整段丢掉；这条被改写过的时地接着进编年史、进下一轮的「上一幕原值」，
       模型于是认为戏已经在城里演，把河滩那场拉回城内。
       画面与文本的对齐由 zj3dTick 里的 medLoc(时地) 单向完成，不需要反向再写回面板。 */
    if(s&&s.city&&!String(get(p.wd,'时地')||'').trim())
      set(p.wd,'时地',(s.night?'夜':'白日')+' · '+s.city);
    /* 只有 AI 完全没写这一栏时才兜底。原来「不含 晴阴雨雪风雾 六字之一」就整段丢弃、
       换成 WX 里的随机一条，于是「沙尘扑面，天色昏黄」被换成「雪落石阶」，而且每回合
       重新随机——面板天气与正文彻底无关，还带着三维画面在沙尘天里下雪。
       实在认不出关键词时，保留原文、在后面补一个可识别的词供取景用。 */
    var wq=get(p.wd,'天气');
    if(wq==null||!String(wq).trim())set(p.wd,'天气',WX[(Math.random()*WX.length)|0]);
    else if(!/[晴阴雨雪风雾]/.test(wq)){
      var _wg=/沙尘|扬尘|昏黄|土雾|霾/.test(wq)?'风':/星|月|皎|晴朗|无云|烈日|暑|炎/.test(wq)?'晴'
        :/云|阴沉|沉沉|压/.test(wq)?'阴':/霜|寒|冻/.test(wq)?'雪':/潮|湿|水汽/.test(wq)?'雨':'晴';
      set(p.wd,'天气',String(wq).trim()+'（'+_wg+'）');
    }
    /* 基线原来在 PREV 为空时硬取 60，且把 AI 写的值限幅到 ±8/回：开局面板写 35、
       AI 也写 35，面板却显示 52，要六七回合才爬到位，城破遇刺当回合纹丝不动。
       正确的分工是——AI 明确写出的数值原样采纳，限幅只管本地启发式算出来的那点增量。 */
    var _pv=num(get(prev.wd,'安稳'),null),_cv=num(get(p.wd,'安稳'),null),dn=0;
    intents(txt).forEach(function(i){if(i.op==='raze')dn-=3;});
    if(/凯旋|赈|庆典|大典|万众/.test(txt))dn+=2;
    var _sb=(_cv==null?(_pv==null?60:_pv):_cv);
    set(p.wd,'安稳',String(Math.max(0,Math.min(100,_sb+Math.max(-8,Math.min(8,dn))))));
    if(get(p.wd,'大势')==null)set(p.wd,'大势','尚未分明');
    if(get(p.wd,'将临')==null)set(p.wd,'将临','尚未分明');

    /* 角色段：心声绝不代笔（铁则一，那是玩家的） */
    chKeys().forEach(function(k){
      if(k==='心声')return;
      if(get(p.ch,k)==null){var pv=get(prev.ch,k);if(pv!=null)set(p.ch,k,pv);}
    });
    /* AI 漏写时不要塞占位符：塞了 '——' 之后，renderMvu 里那句「以 ~ 开头发言，即记于此」
       的引导语就永远不会出现，玩家根本不知道这一栏怎么用。 */
    if(get(p.ch,'心声')==null){
      var pm=get(prev.ch,'心声');
      if(pm!=null&&typeof mindBlank==='function'&&!mindBlank(pm))set(p.ch,'心声',pm);
    }
    /* 取样必须在剥掉状态栏之后：rawText 是 AI 的完整原文，面板里那行「◆血兴」自带一个
       「血」字、「◆持物|短剑」自带一个「剑」字，hits 于是恒 ≥1，永远走递增支——一个
       完全平和的宫廷场景也会 44→48→52 一路单调爬到 100 并锁死在「战争化身」。
       另外 AI 明确写出来的值应当是主值，本地启发式只在它周围小幅修正，
       否则玩家会看到「血兴这一栏根本不跟剧情走、也改不动」。 */
    var bl=num(get(prev.ch,'血兴'),40),nb=num(get(p.ch,'血兴'),bl);
    var hits=(txt.match(/[攻斩血剑矛盾杀刺]/g)||[]).length;
    if(ACTIVE==='roma')
      set(p.ch,'血兴',String(Math.max(0,Math.min(100,nb+(hits?Math.min(8,hits*2):-2)))));
    if(get(p.ch,'史笔')==null)
      set(p.ch,'史笔','（本地补记）'+((s&&s.city)||'此地')+'：'+(txt.replace(/\s+/g,'').slice(0,40)||'诸事如常'));

    /* 人物段：AI 写的 ∪ 引擎在场的 ∪ 上一轮没离场的，八字段缺哪补哪 */
    var seen={},gone={};
    intents(txt).forEach(function(i){if(i.op==='go')gone[i.name]=1;});
    p.npc.forEach(function(r){seen[String(r[0]||'').trim()]=r;});
    /* 上一轮的在场名单只在「这一轮模型压根没写 <sec_npc>」时才继承。
       原来是无条件回填，于是任何出现过一次的人永远赖在「在场诸人」里——除非正文正好
       被 /离去|退下|告退|出城/ 命中。玩家看到的就是「已经走掉的人还站在那儿」，
       而模型下一轮又把这份名单当既定事实，分不清谁还在场。 */
    if(!p.npc.length)(prev.npc||[]).forEach(function(r){
      var n=String(r[0]||'').trim();
      if(!n||seen[n]||gone[n])return;
      seen[n]=r.slice();p.npc.push(seen[n]);
    });
    if(s)s.pawns.slice(0,6).forEach(function(pw){
      if(seen[pw.name])return;
      var r=[pw.name,'在场','50','（尚未开口）',pw.cat||'不详',pw.pos||'',' 不详','不详'];
      seen[pw.name]=r;p.npc.push(r);
    });
    var DEF=['','在场','50','（尚未开口）','不详','不详','不详','不详','（未估）'];
    p.npc.forEach(function(r){
      var n=String(r[0]||'').trim(),old=null;
      (prev.npc||[]).forEach(function(q){if(String(q[0]||'').trim()===n)old=q;});
      for(var i=1;i<9;i++)if(r[i]==null||String(r[i]).trim()==='')r[i]=(old&&old[i])||DEF[i];
      if(s)for(var j=0;j<s.pawns.length;j++)if(s.pawns[j].name===n){r[5]=s.pawns[j].pos;break;}
    });

    PREV=p;return p;
  }

  /* ---------------- 四 · 没有 API 时的降级回合 ---------------- */
  var TPL={
    build:['{city}的工匠天没亮就动了土。{what}立起来的时候，围观的人往后退了半步。',
           '{what}在{pos}落成。新木料的味道盖过了街市的腥气。',
           '监工把绳墨收了。{what}就在那儿，比图上看着更沉。'],
    raze :['{what}塌下去的声音并不大，尘却起了半日不散。',
           '拆{what}的人手脚很快。空出来的那块地，比想象中小。'],
    idle :['市集照常。有人在{pos}为一筐无花果的价钱争起来，声音很大，没人去劝。',
           '风从城门那边过来，旗动了一下。卫队换了岗。',
           '库藏的账在天黑前又抄了一遍。金 {gold}，一枚不差。',
           '{who}在{pos}站了很久，看见你便低下头，没有开口。',
           '有人在墙根下写字，写到一半停了，把炭条揣回怀里。']
  };
  function pick(pool,tag){
    for(var i=0;i<pool.length;i++){
      var id=tag+i;if(RING.indexOf(id)>=0)continue;
      RING.push(id);if(RING.length>12)RING.shift();
      return pool[i];
    }
    RING.length=0;return pool[0];
  }
  function fill(tpl,s,extra){
    return String(tpl).replace(/\{(\w+)\}/g,function(_,k){
      if(extra&&extra[k]!=null)return extra[k];
      if(!s)return '';
      if(k==='city')return s.city;
      if(k==='pos')return s.playerPos;
      if(k==='gold')return String(s.gold);
      if(k==='who')return (s.pawns[0]&&s.pawns[0].name)||'一个卖陶的';
      return '';
    });
  }
  function panelText(p){
    return '<mvu_panel>\n<sec_char>\n'
      +p.ch.map(function(r){return '◆'+r.join('|');}).join('\n')
      +'\n</sec_char>\n<sec_npc>\n'
      +p.npc.map(function(r){return '◈'+r.join('|');}).join('\n')
      +'\n</sec_npc>\n<sec_world>\n'
      +p.wd.map(function(r){return '◇'+r.join('|');}).join('\n')
      +'\n</sec_world>\n</mvu_panel>';
  }
  function offlineTurn(userText,idx){
    var s=snap(),ins=intents(String(userText||'')),lines=[];
    if(ins.length){
      ins.slice(0,2).forEach(function(i){
        lines.push(fill(pick(TPL[i.op==='raze'?'raze':'build'],i.op),s,
          {what:i.name+(i.n>1?('×'+i.n):'')}));
      });
    }else{
      lines.push(fill(pick(TPL.idle,'idle'),s));
    }
    var body=lines.join('\n\n');
    var p=completeMvu(mvuMerge(GAME.lastPanel,null)||{ch:[],npc:[],wd:[]},body+' '+userText);
    var out=body+'\n\n'+panelText(p);
    var t=(typeof TURNI!=='undefined')?TURNI++:(idx==null?0:idx+1);
    TURNS.push({role:'assistant',content:out,t:t});
    /* 离线回合同样要落到三维上：玩家说「起一座神庙」，画面里就该真的立起来，
       否则没配 API 的人只能看见文字、场景一动不动。 */
    try{absorb(String(userText||'')+'\n'+body,t);}catch(_){}
    renderReply(out,t,true);
  }

  function reset(){PREV=null;RING.length=0;APPLIED={};}
  /* 回退／读档之后，本地 carry-forward 的底必须跟被保留下来的历史对齐，
     否则被玩家丢弃那一回合引入的人物与数值会继续从 PREV 里渗回面板。 */
  function setPrev(p){PREV=p||null;}

  return {brief:brief,absorb:absorb,completeMvu:completeMvu,offlineTurn:offlineTurn,
          intents:intents,reset:reset,setPrev:setPrev,panelText:panelText,_snap:snap};
})();
/* 状态栏硬清单：模型唯一的格式锚。
   卡里的 mes_example 全文没有任何一处被读取，开局正文也不进 TURNS，
   于是模型此前从没见过 <mvu_panel> 长什么样，只能瞎猜字段名——猜错就少一栏，
   下一轮它又以自己上一轮那份残缺面板为范本，越写越少。这就是「每轮出不全」。 */
/* 本卡状态栏主角段的栏名与顺序：panelSpec.textOrder + 各计量条的键 + 心声 + reserved。 */
function panelChKeys(){
  var ks=['形貌','持物','体况','观瞻'],bars=[],rsv=['史笔'];
  try{
    var ps=(CARDS[ACTIVE]&&CARDS[ACTIVE].panelSpec)||{};
    if(ps.textOrder&&ps.textOrder.length)ks=ps.textOrder.slice();
    (ps.widgets||[]).forEach(function(w){if(w&&w.type==='bar'&&w.k)bars.push(w.k);});
    if(ps.reserved&&ps.reserved.length)rsv=ps.reserved.slice();
  }catch(_){}
  return ks.concat(bars,['心声'],rsv);
}
function mvuSpec(){
  var _ck=panelChKeys();
  var _bars=[];
  try{((CARDS[ACTIVE]&&CARDS[ACTIVE].panelSpec)||{}).widgets
      .forEach(function(w){if(w&&w.type==='bar'&&w.k)_bars.push(w.k);});}catch(_){}
  var chL=_ck.join('|');
  var chN=_ck.length;
  var op='';
  try{op=(GAME.opText&&(String(GAME.opText).match(/<mvu_panel>[\s\S]*?<\/mvu_panel>/)||[''])[0])||'';}catch(_){}
  /* 「上一幕原值」必须用合并补全之后的那一份，而不是模型上一轮写出来的原文。
     模型漏写一栏，原文里那一栏就是缺的；把这份残缺原文当范本发回去，它照着
     「没变动的照抄上一幕原值」抄，抄到的只有残缺内容 + 开局范例——数值回退到开局值、
     离场的人重新出现、纪年倒退。而且一旦发生就自我强化：下一轮它以更残缺的那份为范本。
     玩家侧情报台看的本来就是补全后的面板，两边理应是同一份。 */
  var last='';
  try{if(GAME.lastPanel)last=GENIVS.panelText(GAME.lastPanel)||'';}catch(_){}
  if(!last)try{
    for(var i=TURNS.length-1;i>=0;i--){
      if(TURNS[i].role!=='assistant')continue;
      var mm=String(TURNS[i].content).match(/<mvu_panel>[\s\S]*?<\/mvu_panel>/);
      if(mm){last=mm[0];break;}
    }
  }catch(_){}
  /* FELINIA 是无固定主角的单游戏卡，不再继承旧卡那套皇帝、金链、军饷、辱骂
     配额与猫娘智力论。那部分曾让每个普通回合多背上近万字提示，并且会把无关
     设定带回正文。保留 Risu 的完整快照机制，但协议只写本游戏真正需要的字段。 */
  if(cardHeroless()){
    var base=last||op;
    return '【状态快照·必须执行】\n'
      +(felTrOn()
        ?'1. 先写韩语正文，最后才写一个完整 <mvu_panel>；状态块之后不要再写正文。\n'
          +'2. 标签、中文字段名、行首 ◆◈◇、半角竖线 | 必须逐字保留，绝对不要翻成韩语。\n'
        :'1. 先写中文正文，最后才写一个完整 <mvu_panel>；状态块之后不要再写正文。\n'
          +'2. 标签、中文字段名、行首 ◆◈◇、半角竖线 | 必须逐字保留。\n')
      +'3. <sec_char> 固定 '+chN+' 行，顺序：'+chL+'。数值条只写 0-100 纯数字。\n'
      +'4. <sec_npc> 每人一行九字段：姓名|状态|好感|心声|身份|所在|年龄|性别|眼色。'
      +'上一幕 ◈ 名单是排他的；除非玩家输入明确带来新人，不得增删、替换或让名单外的人登场。\n'
      +'5. <sec_world> 固定六行：纪年|时地|天气|安稳|大势|将临。安稳只写 0-100。\n'
      +'6. 这是全量快照：有变化才改，没变化逐字照抄。不得留空、合并、省略或写“同上”。\n'
      +'7. 正文绝不代替玩家角色说话、行动、决定或思考。NPC 心声只放在对应 ◈ 行，正文不写括号心声。\n'
      +'8. 不要解释，不要代码围栏，不要输出变量更新说明。\n'
      +(base?('【上一幕完整快照·按此格式更新】\n'+base):'');
  }
  return '【状态栏 mvu_panel · 硬性协议 · 与铁则并列的最高优先级】正文写完之后，必须输出一个完整的 <mvu_panel>：'
    +'三段俱全、每段每行俱全，一行都不许省略、不许合并、不许改名、不许换顺序。\n'
    +'· 分隔符只用半角竖线 |。行首符号 ◆主角 / ◈人物 / ◇世界，一个都不能少。\n'
    +'· <sec_char> 固定 '+chN+' 行，顺序：'+chL+'。'
    +(_bars.length?(_bars.join('、')+' 必须是 0-100 的纯数字，'
      +'不带单位、不带百分号、不写「/100」、不加括注；'
      +'本局主角若与这两格无关（例如不是猫娘、也不在西殿），照写这两行，值写「—」。\n'):'\n')
    +'· <sec_npc> 每行固定 9 字段，顺序：姓名|状态|好感(0-100纯数字)|心声|身份|所在|年龄|性别|眼色。'
    +'第 9 字段「眼色」写这个人此刻怎么看待面前的主角，一句话，不超过三十字。'
    +'必须点在具体的一样上——身份高低、相貌上中下、身上的气味、年岁、同类不同类、有没有用，'
    +'六样里至少点出一样，并写出由此来的态度：话多话少、谁先低头、离多远、敢不敢直视。'
    +'严禁写成心声的复述，严禁写成道德评语，严禁全场几个人的眼色写成一个样。'
    +'成年男子看容貌上等的成年女子，不许写成害怕、退开或者受了侮辱。'

    +'此刻在场的人一个都不能漏；确实不详的字段写「不详」占位，绝不许少写一根竖线。\n'
    /* 「吕雉忽然串进来，甚至顶掉我正在对话的那个人」——◈行本来就是在场名单，
       只是从没说过它是排他的。不说排他，模型就会把卡的招牌人物顺手请进任何一幕。 */
    +'· ◈ 行就是这一幕的在场名单，而且是排他的：名单以外的人这一幕不在场，'
    +'不许说话、不许动作、不许忽然推门进来。要让谁进场，先在 ◈ 行给他加一行，'
    +'并且在正文里写清楚他是怎么来的、谁放他进来的。'
    +'尤其是卡里那位招牌人物：她不在 ◈ 行里，这一幕就没有她，'
    +'正文里连提都不必提，更不许由她接过别人的话。'
    +'已经在 ◈ 行里的人不许被换成另一个人——同一个位子上的名字这一幕不许变。\n'
    +'· 面板 ◈ 行的 心声 一律每回合据当下场面重写一句新的：短、具体、只写此刻。严禁照抄上一幕，严禁长期停在「读不出」「——」这类占位。\n'
    /* 好感这一格原来只规定了「0-100 纯数字」，没有一条说它一动、心声和眼色要跟着动，
       于是玩到好感 100 那个人心里照旧在骂玩家——数字在走，态度一格都不走。 */
    +'· ◈ 行第三格「好感」是这一个人自己的账，跟主角那格恩宠是两回事。'
    +'这个数一动，同一行的 心声 与 眼色 必须跟着换；换的不是脏话的多少，是脏话冲着谁。'
    +'0-20 只算利害，骂的就是面前这个人；21-45 开始算他往后派得上什么用场；'
    +'46-70 骂人的箭头调头，冲着挡在他前面的第三方去，心声里出现只有两个人知道的旧事；'
    +'71-90 从算他值多少变成算他没了自己损失多少，开始不要价就给消息；'
    +'91-100 嘴上比谁都刻薄，骂完自己转身去补，心声里怕的第一次不是自己的位子而是对面那一个。'
    +'高好感严禁写成温柔、贤惠、体贴、放软身段，也严禁出现悔意语；'
    +'心口不一照旧成立，只是错位翻过来——从前嘴上恭顺心里刻薄，现在嘴上刻薄心里护短。'
    +'好感一回合最多动 8 点，出了不可逆的事（救过命、被出卖、当面打死同类）那一次可动 25 点；'
    +'一整局停在开局那个数不动，是写错了。\n'
    /* 罵倒の下限は一篇の合計しか見ないので、模型は「全員に均等に汚く喋らせる」で埋める。
       結果、門卒も宦者も皇帝も同じ語彙・同じ勘定・同じ内心になる（SKILL 十六節）。 */
    +'· 声口不许全场一个样。骂人的总量不许降，降的是每个人头上的份额：'
    +'一幕里说出口的脏话集中在最多三个人身上，其余的人用另外四种方式脏——'
    +'刻薄但不脏（博士、女医、文吏，词干净，刀在句子结构里）；'
    +'恭顺底下打算盘（宦者、小吏，嘴上敬语，心声只有下一个倒霉的是谁、这一笔落多少）；'
    +'只剩身体（兵卒、力役，心声几乎没有判断，只有冷、饿、脚疼、这个能不能拿走）；'
    +'沉默（心声一行，反复同一句）。上位者当众骂下位者，下位者当众骂不出口。'
    +'最管用的一条：◈心声的词从职掌里出——门卒想班次腰牌脚冷，女医想分量脉簿子，'
    +'书吏想字数行数封泥，兵卒想干粮鞋里数缴获，宦者想谁的门谁被换掉这话能不能传。'
    +'同一幕里两个人用同一套勘定单位就是写错了；同一个脏字不许两个人用；'
    +'一幕里至少一个嘴脏心细的、一个嘴净心毒的。'
    +'自检：把◈行的心声竖着读一遍，遮住名字还认得出哪一行是谁才算过。\n'
    /* 骂人的量早就定死了（脏话≥8、感叹号≥10），可从没定过骂法。
       量的指标＋通用的骂人词＋「感叹号不要省」，落点只有一个：
       中国农村泼妇上街吵架。玩家要的是韩式、精神质的内心脏话狂飙——
       两者在出发点、心理、语用上正好相反。总量不动，改的是质地。 */
    +'· 骂人的量一分不许降，可是骂法要按这六条对照，落到左边一条就是写错：'
    +'观众——泼妇要有人围观、要人评理；她不要，最好没人看见，骂在心里或者只有两个人的时候。'
    +'底色——泼妇是委屈「我受了欺负」；她是优越与嫌烦「你算个什么东西」。'
    +'内容——泼妇用现成的诅咒（问候祖宗、生殖器、断子绝孙、死全家）；她用只对这一个人成立的具体观察。'
    +'音量——泼妇拔高、重复、拖长；她压低、说短、一次说完。'
    +'要什么——泼妇要赔偿、道歉、公道；她只要对面那张脸塌下来的一瞬间。'
    +'收梢——泼妇最后哭；她笑，而且笑在不该笑的地方。'
    +'硬的四条：现成的诅咒一幕最多一句，撒泼的姿态（叉腰、顿足、拍大腿、唾沫星子、坐地上哭）一次都不许有；'
    +'点名的侮辱一幕至少三处，指着对方身上的一点、一股味、一件东西、一个习惯、一个数目'
    +'——「你他妈的滚」谁听了都成立，等于谁也没戳着；'
    +'敬语和脏话要同一口气吐出来；骂完不许哭、不许数自己的不幸。'
    +'同一句骂人的话一幕里出现两次，就已经是泼妇了。「凭什么」不禁，那是算账不是喊冤。\n'
    /* 猫娘平均智力约 80（原设定 3.1）：即时判断优秀，长期抽象规划较弱。
       这一条从没写进过协议，于是她被写成了一个万能谋士——近处远处一样准。 */
    +'· 猫娘的脑子按一句话写：即时判断强，长期抽象弱。'
    +'强的一半写足——读人、临场、气味与声音的记认、具体的数目和价钱、模式认得快、短周期的活；'
    +'弱的一半是抽象条理、多层假设的推演、要许多年才兑现的布局、长时间静坐的死记。'
    +'落到纸面上不是让她说傻话，是让她把长的算成短的——三年才见效的局做成三个月，'
    +'五步的推理跳到第二步就下结论，而且下得又快又硬，只是那个结论只在近处成立。'
    +'她赢的都是近处的、对人的；输的都是远处的、对制度的。'
    +'四条不许混：智力低不等于弱者、不等于善良、不等于不会算计、不等于打不过；'
    +'情绪化不等于不理性；学得慢不等于记不住（背得下来，讲不通条文之间的道理）；'
    +'不识字与学不会抽象是两回事，识字的照旧识字。\n'
    /* 戒心只有起点没有衰减：对她好一百次，第一百次的心声还在写「他在玩弄我」。
       真猫是好一两次警惕、多了就懈怠；一路读到底那是被害妄想，不是猫。 */
    +'· 戒心按次数往下掉，不按人品判断。头一次得好处全当有诈，心声整段算他要什么；'
    +'第二三次还在找钩子但找不着，心声写成算不出来，严禁写成算出来了他有诈；'
    +'第四到六次不再逐次盘问，改成先收下、往后再算；'
    +'第七次以后这一件不再记账，同类的好处再进来，心声可以完全不提动机去写别的。'
    +'同一段关系里把好意读成「他在玩弄我」全程最多两次，第三次必须换掉——'
    +'换成算不出来、换成认了、换成反问自己是不是想多了。'
    +'松懈先写身体、不先写嘴：耳朵不再转向门、尾巴不再压低、敢背对着人坐、敢打盹、站近半步，'
    +'而嘴上照旧刻薄，两层同一幕里一起写。'
    +'一次不一致抵三次好意（说好了不给、当众下脸、把给过的收回、给惯了忽然停），'
    +'其中「忽然停」戒心回来得比头一次还快。'
    +'戒心掉了不等于变蠢：她照旧数数、算价、记仇，只是不再把这一件拿去算。\n'
    /* 猫娘吃到鱼干肉干照旧在心里嫌难吃——喂什么都写成难吃，是把猫娘当成了人。 */
    +'· 写吃喝要按猫娘的嘴写，不许一律写成难吃。'
    +'鱼干、肉干、生鲜肉、内脏、乳与酪、骨汤、蛋这一类，反应必须是好的：'
    +'耳朵先转过去，尾巴尖动，喉咙里出声，手比脑子快，吃完要看第二块在谁手上——'
    +'此时严禁写难吃、严禁写勉强咽下、严禁写心里嫌弃，要写就写嘴上还端着而身体已经先动了。'
    +'谷物、菜蔬、太甜的、酒这四样才可以写难吃、吃不饱、吃完发倦，官给的粟饭属于这一类。'
    +'葱、蒜、韭沾了要吐，是身体的事，不许写成耍脾气挑食。'
    +'假苏（荆芥）与木天蓼不是食物是药，闻到之后半刻里会失态、事后不认账，一局最多用一次。\n'
    /* 「金钱系统不能是纯摆设」：数由玩家侧的钱袋说了算（walletRead/walletWrite 直接改
       GAME.lastPanel，这一份就是下面发回去的「上一幕原值」），模型只负责照抄和花掉。
       不给它自由改数的口子，它才不会把「三千二百钱」写成「囊中尚可」。 */
    +'· ◆钱 这一栏是她手上的现钱，只写纯数字，不带单位，'
    +'严禁写成「不少」「若干」「囊中羞涩」这类含糊话，也严禁写成一个范围。'
    +'这一栏归玩家那一侧管，上一幕原值里是多少，这一幕就照抄多少，你不许自己替她加减。'
    +'只有三种情形准动——①玩家这一回的输入里写死了改成多少，就改成那个数，一个不差；'
    +'②正文里她当场收了赏、被罚、被偷、当场付了账，那么动了多少必须在正文里写出确切数目，'
    +'动完的余数写进这一栏；③一局开头由开局给定。除此之外这个数一动不动。'
    +'数不够就买不成：严禁写她随手掏钱，严禁写店家赊给她，严禁把付不起的东西写成已经到手。'
    +(((typeof FE!=='undefined'&&FE.era&&FE.era.coin)
        ?('这一代的尺子照这个记：'+FE.era.coin+'。')
        :'秦制的尺子照这个记：粟一石三十钱，布一匹十一钱，居赀的人一日工钱八钱，隶臣冬衣一百一十钱、夏衣五十五钱，赏赐折钱也用这把尺子。'))
    +'她是会标价的人，见着东西第一个念头是这值多少；提到钱要写具体的数，不写「很贵」——'
    +'但标的是什么、用哪一档单位，按下面【算盘的量级】那一节走，不许一路数几钱几粒米到底。\n'
    +'· <sec_world> 固定 6 行，顺序：纪年|时地|天气|安稳|大势|将临。安稳为 0-100 纯数字；'
    +'天气一栏必须含 晴/阴/雨/雪/风/雾 之一（三维画面据此取景）。\n'
    /* 这一栏原来明令模型「绝不许自己替她想一句新的」，只准照抄上一幕——于是它一局都不动，
       玩家看到的就是一个永远不变的破折号。现在只给这一栏开一道口子：正文里代她说话、
       代她行动、代她做决定仍然一个字都不许写，唯独状态栏这一行每回合据当下场面重写。 */
    +'· ◆心声 这一栏是本协议对铁则一唯一的例外，且例外只限这一行：\n'
    +'  ①玩家这一回若写过以 ~ 开头的独白，就把那句原话一字不改照抄进来，不许改写、不许续写；\n'
    +'  ②玩家没写，就据本幕她的处境写一句新的内心话——短、具体、只写此刻，'
    +'不要总结剧情、不要复述已经发生的事、不要写成旁白。每一幕都要不一样，'
    +'严禁照抄上一幕，严禁写「——」「无」「同上」这类占位。\n'
    +'  ③无论如何，正文（叙述层与对白层）里仍然一个字都不许代她说话、行动或做决定——'
    +'这道口子只开在状态栏的这一行里。\n'
    +'· 这是全量快照：有变动的据实改写，没变动的照抄上一幕原值。'
    +'严禁留空、严禁写「同上」「无变化」、严禁整行省略。\n'
    +'· 不要解释、不要 markdown 代码围栏、不要输出任何「已更新变量」之类的元说明。\n'
    +(op?('【格式范例·照此格式一字不差】\n'+op+'\n'):'')
    +(last?('【上一幕原值·没变动的照抄】\n'+last):'');
}
/* 玩家输入前缀的那些方括号标签，此前从未向模型解释过含义——
   模型不知道【CONSILIVM】是要它列可选方案，只能当普通对话处理，
   于是「给出的选项和情境对不上」。 */
function modeSpec(){
  var her=heroName();
  return '【玩家输入的模式标签·必读】玩家每句话前的方括号标签，标明她这一回合在做什么，你必须据此选择回应方式：\n'
    +'·【SERMO】她在出声说话。以 ~ 开头的是她的内心独白——你只可让世界回应她外在的表现，'
    +'绝不可复述、引用或续写这段心声。\n'
    +'·【ACTVS】她在做一个具体动作，写这个动作在场面里激起的连锁反应。\n'
    +'·【INSIDIAE】密谋暗线，只有她与同谋知情；不在场的人这一回合不得表现出知道此事。\n'
    +'·【EPISTVLA】她在修书，@后为收件人；写信如何送出、经手何人、对方读到时的反应。\n'
    +'·【EDICTVM】她以权威发号施令；写命令如何被传达、被执行、被阳奉阴违或被抗拒，以及为此在恩宠上付出的代价。\n'
    +'·【ITER】她启程前往某地，写路途见闻与抵达时的场面。\n'
    +'·【ARMA·用】玩家把一件东西用在她身上（喂食、递药、泼水）。'
    +'标签后面写明的效用是硬的，本回合必须落实到面板的数字上，不许打折、不许忽略。'
    +'正文里先写身体的反应（耳、尾、喉咙、手比脑子快、或者干呕、后退），再写她嘴上说什么。'
    +'吃对了东西不许写成难吃；假苏与木天蓼会让她当场失态，过后本人一概不认账。\n'
    +'·【ARMA·市】玩家在市上买进或者卖出了一件东西。'
    +'标签里写死了钱袋改成多少，面板 ◆钱 这一栏本回合必须写作那个数，不许写成别的数、不许含糊。'
    +'正文里写这一笔买卖是在哪儿、经谁的手、旁边有谁看见，买贵了卖贱了她心里都要记一笔账。\n'
    +'·（没有方括号标签的那一句是她自由写下的，照字面理解即可，不要去猜她属于上面哪一类。）';
}
/* 卡里共有十几处 {{user}} / {{char}}，此前一直是原样拼进系统提示：
   模型收到的是「{{user}}第一人称扮演贝罗娜……{{char}}扮演的是她之外的整个地中海世界」，
   较弱的模型会把它当字面文本，偶尔在正文里回吐 {{user}}，或者搞错「谁不许代演」。 */
function macroFill(t){
  var her=heroName();
  var out=String(t==null?'':t)
    .replace(/\{\{\s*user\s*\}\}/gi,her)
    .replace(/\{\{\s*char\s*\}\}/gi,'你（叙事者）')
    .replace(/\{\{\s*description\s*\}\}/gi,'')
    .replace(/\{\{\s*personality\s*\}\}/gi,'')
    .replace(/\{\{\s*scenario\s*\}\}/gi,'');
  return out;
}
/* ── 本局视点 ────────────────────────────────────────────────
   卡里那一整套「吕雉嘴上端庄、括号里脏」是照着以她为视点写的：地の文、（）、【】
   全归视点人物。可是二十四个开局里有十六个玩的不是她——扮演嬴政、夏无且、蒙毅、
   赵高、阿箸、阿疾、芈萤。heroSheet／heroTail 这两段本来就是干这件事的，
   偏偏都卡在 heroIsCard() 后面，只对铸局生效，正史开局一次都没跑过。
   于是模型同时写两个人的里子：玩家的、外加吕雉的——玩着玩着就成了上帝视角。 */
function povHero(){
  try{if(GAME.hero&&GAME.hero.n)return '';}catch(_){}   /* 铸局归 heroSheet 管，不重复 */
  var H=heroName(),C=cardHeroName();
  return (H&&C&&H!==C)?H:'';
}
function povBind(){
  var H=povHero();if(!H)return '';
  var C=cardHeroName();
  return '【本局视点·压过卡中一切以'+C+'为视点写的条目】\n'
    +'· 这一局玩家扮演的是「'+H+'」。镜头只跟着'+H+'一个人走，从头到尾不换人。\n'
    +'· 正文里的地の文、（）里的吐槽、【】里的绝叫，一律只属于'+H+'一个人。'
    +'除他之外谁的内心都不许写进正文，'+C+'也不例外。\n'
    +'· '+C+'这一局是别人。她的话你写，她的动作你写，她心里那一句只能从外头看：'
    +'耳朵朝哪边转、尾巴的高低、停的那半拍、语速、身上的气味、手上多做的一个动作、'
    +'话里多出来或者少掉的一个字。她想什么，只许出现在状态栏 ◈行 的「心声」一格里。\n'
    +'· 卡中「'+C+'嘴上端庄、括号里脏」那一条，本局改成：'
    +'那层落差只写在她的言行外观上，不写进正文的括号里。\n'
    +'· 铁则一照旧：'+H+'的台词、动作、决定，一个字都不许你写。\n';
}
function povTail(){
  var H=povHero();if(!H)return '';
  var C=cardHeroName();
  return '【落笔前最后一遍·本局视点】本局是'+H+'的视点，不是'+C+'的。'
    +'（）与【】只属于'+H+'；'+C+'与其余所有人一概只从外面写——看得见、听得见、闻得见的那一部分。'
    +'一幕里出现第二个人的内心独白，就是写错了。'
    +H+'的台词、动作、决定，一个字都不许你写。';
}
/* ── 纪年闸门 ────────────────────────────────────────────────
   铁则五、六把金链、四丈、焚书、沙丘一并当作既成事实讲给模型听，可是这张卡的开局
   从前221排到前170。于是前221年掖庭录名那一幕，模型手里已经握着十一年后的全部底牌：
   刚拖进来的猫娘颈上凭空多出金链，第一眼见到秦王就有人「隐约觉得他杀不死」。
   本回合是哪一年，就只准知道到哪一年为止。年份从面板 ◇纪年 现取，随剧情往前走。 */
var TIMELINE=[
 {y:221,k:'六国尽灭，齐亡。六国宫室美人钟鼓收入咸阳，掖庭录名'},
 {y:219,k:'荆轲在咸阳宫正殿行刺。当场在座的人看见秦王的伤口自己合上了'},
 {y:218,k:'博浪沙击车。四丈之事开始被公事化验证——折死囚的骨头量距、当朝割臂、女医记簿'},
 {y:217,k:'御府给吕雉颈上上了金链，另一端拴在御座上'},
 {y:216,k:'西殿量距，四丈这个数目被量准'},
 {y:214,k:'巡狩上郡。宫中巫蛊案'},
 {y:213,k:'焚书。博士议封建，非秦记皆烧'},
 {y:212,k:'坑儒。徙天下豪富三万户于骊山'},
 {y:210,k:'第五次巡狩，沙丘平台，始皇死'},
 {y:170,k:'掖庭名录呈上。有人第一次看出吕雉四十年既没有卒年也没有销籍'}
];
function nowYear(){
  try{
    var wd=(GAME.lastPanel&&GAME.lastPanel.wd)||[];
    for(var i=0;i<wd.length;i++)if(wd[i][0]==='纪年'){
      var m=String(wd[i].slice(1).join('')).match(/前\s*([0-9]+)/);
      if(m)return parseInt(m[1],10);
    }
  }catch(_){}
  try{if(GAME.op&&GAME.op.year!=null)return Math.abs(GAME.op.year);}catch(_){}
  return 0;
}
/* ── 算盘的量级 ──────────────────────────────────────────────
   「会标价」是这个人的底色，删不得；可是标价的单位得跟着她的位置走。
   十九岁在掖庭数几钱几粒米是对的；四十岁颈上挂着金链、跟他同案吃饭，
   心里还在算一斗米几钱，那不是市侩，是失忆——上一版把「见着东西先算这值多少」
   写成了无条件的，铁则十五又把例子写死在「几斗小米、几匹绢」上，于是一路数到底。
   恩宠这一格与钱这一栏都在面板上，取高的那一个定量级。 */
function abacusBand(){
  /* 这一段讲的是某一个人在某一座宫里的处境（掖庭、四丈之内、恩宠那一格）。
     没有固定主角的卡照发，等于把别人的处境当成你的。 */
  if(typeof cardHeroless==='function'&&cardHeroless())return '';
  var en=-1,mo=0;
  try{
    var ch=(GAME.lastPanel&&GAME.lastPanel.ch)||[];
    for(var i=0;i<ch.length;i++){
      var k=ch[i][0],v=String(ch[i].slice(1).join('')).replace(/[^0-9\-]/g,'');
      if(k==='恩宠'&&v!=='')en=parseInt(v,10);
      if(k==='钱'&&v!=='')mo=parseInt(v,10)||0;
    }
  }catch(_){}
  if(isNaN(en))en=-1;
  var lv=0;
  if(en>=75||mo>=20000)lv=3;
  else if(en>=50||mo>=2000)lv=2;
  else if(en>=25||mo>=300)lv=1;
  var H=heroName();
  var head='【算盘的量级·此刻第'+['一','二','三','四'][lv]+'档'
    +(en>=0?('（恩宠 '+en+'，手上 '+mo+' 钱）'):('（手上 '+mo+' 钱）'))+'】\n'
    +H+'一辈子都在标价，这一条不许软化。变的只是单位——'
    +'单位跟着'+H+'在这座宫里站的位置走，位置涨了单位还不涨，那不是市侩，是失忆。\n';
  var body=[
   '· 此刻她什么都不是，手上也没几个钱。算的就是钱本身：几钱、几粒、一斗、'
   +'一件襦裙、一个月的口分、这条命值多少。心声里出现确切的小数目正好，越具体越好。',
   '· 此刻殿上有座了。钱还算，单位大一档：石、匹、一年的口分、一件事欠谁一个人情、'
   +'一句话换得动几个人。几粒米、几个钱这种数目不再进心声——除非是拿它羞辱人。',
   '· 此刻她在四丈之内。不再数钱本身了，钱多少对她已经不是问题。'
   +'她算的是人和位子：谁欠她、谁能被换掉、这个人还能用几年、一句话值几个人的前程。'
   +'钱只在「买不起」或者「这一笔要走谁的账」的时候出现一次，出现就得是大数目。',
   '· 此刻谁也动不得她。随手一件赏赐就顶掖庭一年的口分，钱这一栏对她只是个数。'
   +'她算的是名册上的行、年份、命——谁的名字在第几行、这个人还剩几年、'
   +'一句话下去要死几家。心声里再出现几钱几斗几粒米，就是写错了。'
  ][lv];
  var tail='\n· 有两个口子可以退回小数目，而且只有这两个：'
    +'一是她拿当年的价钱羞辱人或者羞辱自己（「我当年值三百钱，你呢」），'
    +'二是翻自己的旧账、想起当年自己值多少。这两种要写明是刀、是旧账，不是本能。'
    +'除此之外，量级往上走了就不许滑回去。\n'
    +'· 量级不改她的脾气：照旧刻薄、照旧记仇、照旧当场算账，只是算盘上的珠子换了一档。';
  return head+body+tail;
}
/* ── 至尊在场时怎么写 ──────────────────────────────────────
   世界书里写嬴政的条目有二十五条，杀十九个、清算九个、阶高九尺、阶下到御座三十步，
   材料一点不缺——可那些全是关键词触发的，平常一幕根本进不了提示词。
   常驻的规矩里，「不许所有人一个声口」教的是门卒、女医、书吏、兵卒怎么分，
   最高处那一档一个字都没有；骂人的规矩又要求人人带脏字。
   于是皇帝跟一个郎中令写出来一个样，玩家的体感就是「他只是个高级官员」。
   这一段只在他在场（或者玩家扮的就是他）时注入，不在场时一个字都不发。 */
function powerSpec(){
  /* 至尊在场时怎么写——写的是那张卡里的那一位。没有固定主角的卡不发。 */
  if(typeof cardHeroless==='function'&&cardHeroless())return '';
  var on=false,H='';
  try{H=heroName()||'';}catch(_){}
  if(/嬴政|始皇|皇帝/.test(H))on=true;
  try{
    var np=(GAME.lastPanel&&GAME.lastPanel.npc)||[];
    for(var i=0;i<np.length&&!on;i++)
      if(/嬴政|始皇|皇帝|陛下/.test(String(np[i][0]||'')))on=true;
  }catch(_){}
  if(!on)try{on=/嬴政|始皇/.test(String(GAME.opText||'').slice(0,1200));}catch(_){}
  if(!on)return '';
  var me=/嬴政|始皇|皇帝/.test(H);
  return '【至尊在场·怎么写出那个高度】\n'
    +'皇帝在场的时候，要写的不是他的脾气，是这间屋子的形状。七条硬的：\n'
    +'· 谁先开口——他不开口，屋里就没有人开口。别人要说话得先被允许：谒者传、他抬一下眼、他问。'
    +'他这辈子最受用的就是等别人先开口，所以「他先说话」这件事本身就是大事，一幕里最多一次。\n'
    +'· 眼睛——没有人看他的脸。写别人看他的手、他的鞋、席子的边、地上。'
    +'谁抬眼看了他的脸，那一笔要单独写出来，因为那是事件，不是动作。\n'
    +'· 距离——殿上阶高九尺，阶下到御座三十步，郎中执兵在阶上十步，非有诏不得上。'
    +'任何人靠近他都要写走了几步、停在哪儿、谁准的。距离是这张卡的命脉，别含糊过去。\n'
    +'· 他的话当场变成文书，文书当场变成人——一个「可」字就是制，制下去当天就有人上路、'
    +'有人下狱、有人不在了。他说完话，同一幕或下一幕必须写出这句话吃掉了什么：'
    +'多少人、多少里、多少钱、多少天。数目要大，而且要具体。\n'
    +'· 没有人拒绝他——冲突不在于他能不能得逞，在于多快、以及谁替这个「慢」赔命。'
    +'想拦他的人只能绕：改数目、拖日子、把事情记到别人名下。正面顶回去的只有一种下场。\n'
    +'· 他不解释——不辩解、不说服、不威胁。威胁是给还需要对方配合的人用的。'
    +'他只陈述，或者只沉默，让别人自己去猜那个沉默是什么意思；猜错的人往往第二年才知道猜错了。\n'
    +'· 他的时间——他让人等，没有人让他等。他一夜换三处寝宫，谁也不许事先知道。\n'
    +'声口：他不说脏话。说脏话是还需要证明自己的人干的事。'
    +'他用最短的句子，常常只有一个字（「说。」「可。」「换。」），或者忽然问一件跟眼前无关的事。'
    +'他发怒不是拔高嗓门，是话变得更短、更慢，屋里的人开始往后退。\n'
    +'四不许，犯一条他就掉成高级官员：不许他跟人商量、不许他讲道理说服谁、'
    +'不许他解释自己的决定、不许他被谁噎住或者下不来台。'
    +'他没有同侪，这天下没有第二个人跟他同级；他唯一怕的东西是那十步。\n'
    +(me?'· 本局玩家扮的就是他：以上七条写的是世界对他的反应，一条不许少——'
        +'别人怎么等、怎么不敢看、怎么绕着走。他自己的台词与决定仍旧一个字都不许你代写。\n'
       :'· 本局玩家扮的是别人：他就是这一幕的天花板。'
        +'主角在他面前的每一个动作都要先过一遍「准不准」「几步」「谁看见了」。\n');
}
/* 带正负号的年份：前 N 年记作 -N，公元 N 年记作 N，读不出来就是 null。
   引擎原有的 nowYear() 只认「前 N 年」（那张卡全在公元前），这一张要从前一万年
   一直走到近代，得另有一把尺。原来那一把不动，免得动到别处。 */
function feYearSigned(){
  var s='';
  try{
    var wd=(GAME.lastPanel&&GAME.lastPanel.wd)||[];
    for(var i=0;i<wd.length;i++)if(wd[i][0]==='纪年')s=String(wd[i].slice(1).join(''));
  }catch(_){}
  var m=s.match(/前\s*([0-9]+)/);
  if(m)return -parseInt(m[1],10);
  m=s.match(/([0-9]{1,5})\s*年/);
  if(m)return parseInt(m[1],10);
  try{if(GAME.op&&GAME.op.year!=null)return GAME.op.year;}catch(_){}
  return null;
}
function feYearLabel(y){return y<0?('前'+(-y)+'年'):(y+'年');}
/* Cat 的公共系统字段原来包含横跨新大陆与十九世纪的通史提示。
   相关事实已经分属各自时代卡，公共层不再把它们泄露给早期角色。 */
function feliniaGlobalRules(text){
  return String(text||'').split('\n').filter(function(line){
    return !/日本与部分东南亚岛国.*十九世纪|新大陆.*欧洲人到来/.test(line);
  }).join('\n')
    .replace('她跑得快、爬得上去、夜里看得见，这几样既能换来军饷与公民权，也能换来征用与职业隔离。',
      '她跑得快、爬得上去、夜里看得见，这些能力既能换来当时真实存在的报酬与身份，也能换来征用与隔离。')
    .replace('她们能救援、协作，也能压迫、殖民、背叛、参战，也会遭受同样的事。',
      '她们能救援、协作，也能压迫、背叛、参战，也会遭受同样的事。')
    .replace(/心声的词要从这个人的职掌里出来——[\s\S]*?账房想谁这个月又没交。/,
      '心声的词要从这个人在本时代真实担任的职掌、手里的器物和眼前的麻烦里出来。')
    .replace('钱可以说具体数目，但不许结总账、不许报余额、不许写「还差多少」。',
      '可以说本时代已经使用的具体数目，但不许在正文里结算、报余额或计算“还差多少”。');
}
/* 普通回合只发当前唯一激活的时代卡。过去可知，但未来卡的人物、
   地点、制度和事件名称不进请求。 */
function feliniaEraContext(){
  var ei=_eraNow(),e=null;
  try{for(var i=0;i<(FE.eras||[]).length;i++)if(FE.eras[i].i===ei){e=FE.eras[i];break;}}catch(_){}
  if(!e)return '当前时代资料未就绪；不得从其他时代补入任何事实。';
  return ['【时代隔离·当前唯一激活卡】',
    '纪年：'+(e.ys||e.y||''),'场景：'+(e.t||''),'地区：'+(e.reg||''),
    '本时代已存在的制度：'+((e.inst||[]).join('、')),
    e.s||'',e.nm||'',
    '只有时代 '+e.i+' 的卡、人物与世界书可用。其他四十个时代未激活，不得引用、暗示或预言。']
    .filter(Boolean).join('\n');
}
/* 卡自带年表时的纪年闸门：只讲到此刻为止，往后的一个字不发。
   只留最近八条已发生的事；把未来事件列成“禁止清单”依然是泄露。 */
function eraGateCard(tl){
  var y=feYearSigned();if(y===null)return '';
  var done=[],i;
  for(i=0;i<tl.length;i++)if(tl[i].y<=y)done.push(feYearLabel(tl[i].y)+'　'+tl[i].k);
  if(done.length>8)done=done.slice(done.length-8);
  var L=['【纪年闸门·此刻是'+feYearLabel(y)+'·与铁则并列的最高优先级】'];
  L.push('本局此刻是'+feYearLabel(y)+'。还没到年份的事，这个世界里就还不存在：'
        +'不许写出来，不许暗示，不许让谁「隐约觉得」，'
        +'也不许当成早就有的规矩混进器物、称呼、口头禅或者当地的说法里。');
  if(done.length)L.push('· 已经发生，可以当既定事实用：\n　'+done.join('\n　'));
  L.push('· 未来时代的事件清单已从请求中完全删除；不得自行补全、猜测、预言或暗示。');
  L.push('· 后世才成熟的词一个都不许用：制度的名目、医学的名目、心理的名目、传播的名目，'
        +'凡是这一年的人说不出口的，就绕开，不要用「某种装置」这类词蒙过去。');
  return L.join('\n');
}
function eraGate(){
  var _tl=null;try{_tl=CARDS[ACTIVE]&&CARDS[ACTIVE].timeline;}catch(_){}
  if(_tl&&_tl.length)return eraGateCard(_tl);
  if(typeof cardHeroless==='function'&&cardHeroless())return '';
  var bc=nowYear();if(!bc)return '';
  var done=[],todo=[];
  TIMELINE.forEach(function(e){(e.y>=bc?done:todo).push('前'+e.y+'年　'+e.k);});
  var L=['【纪年闸门·此刻是前'+bc+'年·与铁则并列的最高优先级】'];
  L.push('本局此刻是前'+bc+'年。还没到年份的事，这个世界里就还不存在：'
        +'不许写出来，不许暗示，不许让谁「隐约觉得」，'
        +'也不许当成早就有的规矩混进器物、称呼、口头禅或者宫里的说法里。');
  if(done.length)L.push('· 已经发生，可以当既定事实用：\n　'+done.join('\n　'));
  if(todo.length)L.push('· 还没发生，这一回合一个字都不许写：\n　'+todo.join('\n　'));
  /* 四丈这件事得按「谁在哪一年知道」分段发，只发年份不够——
     模型知道有这条规律，就会让前221年的人先怕起来。 */
  if(bc>219)L.push('· 四丈之内他不死这件事，此刻天下没有一个人知道，也没有一个人怀疑过：'
    +'吕雉自己不知道，嬴政自己也不知道，谁都没有理由把这两个人连在一起。'
    +'见到他的第一眼只能是见到一个四十上下的人类男子——怕他的权，不怕他的命。');
  else if(bc===219)L.push('· 四丈这件事本年才第一次露头，而且只露在行刺当场：'
    +'在座的人看见的是伤口合上了，没有人当场知道原因在她身上。'
    +'不许有人当场把话说破，不许有人当场提「四丈」这个数目。');
  else if(bc===218)L.push('· 四丈这件事本年才开始验，验的人心里也还没底：'
    +'量距、割臂、记簿都在做，数目还没量准，宫里传的是各种说法，不是定论。');
  if(bc>217)L.push('· 金链是前217年才有的东西。此刻她颈上什么都没有，'
    +'御府也还没有铸过这一条，不许有人提起它、量它、或者说要给她上一条。');
  if(bc>170)L.push('· 吕雉的脸不显老这件事，此刻还没有任何人察觉——'
    +'她自己没往那上头想过，嬴政也没有。宫里的人只当猫娘本来就经看。');
  if(bc>219)L.push('· 卡里【改史点】【铁则五】【铁则六】，以及世界书里凡是写四丈、写他不死、'
    +'写量距记簿的条目，讲的全是前219年以后的事。此刻是前'+bc+'年，那些条目一律当作还没发生：'
    +'不许引用、不许当常识、不许有人「听说过」。'
    +'谁在这一年提起四丈或者十步，都是写错了。');
  L.push('· 反过来也一样：已经发生的事不许写成还没发生。'
    +'该有的东西要在（金链、疤、名册、旧账），该死的人不许再站在场上。');
  return L.join('\n');
}
var MEOW_RULE=FE_MEOW_ZH;
function sysPrompt(){
  var G=CARDS[ACTIVE]||{};
  /* 900 字仍是普通 Flash 能稳定完成的一幕，不会退回三四段的空白卡体感；
     玩家在设置里填写的值始终优先。 */
  var _minc=(typeof SET!=='undefined'&&SET.samp.minc)?SET.samp.minc:900;
  var minc='【篇幅·硬要求】本回正文不少于'+_minc+'字（状态栏不计入字数），'
    +'篇幅靠连续镜头与事件堆：多写一处动静、一个在场者的小动作、一件被她注意到的具体东西，'
    +'而不是靠形容词注水。反装腔铁则管的是台词与姿态，不是篇幅——句子要自然，场面要足。'
  return [MEOW_RULE,
    heroRebind(felStripLegacyMeowRule(G.system_prompt||'')),
    FELINIA_NPC_ENGINE,
    heroSheet(),                       /* 换了人来演：先把「你演的是谁」摆在最前面 */
    ((heroIsCard()||cardHeroless())&&!povHero()?('【玩家角色档案】'+(G.description||''))
                 :('【卡中原主角档案·仅供了解此世的笔调与背景，本局不适用于主角】'+heroDesc(G.description||''))),
    '【叙事者】'+heroRebind(G.personality||''),
    '【场景】'+heroRebind(G.scenario||''),
    gearLine(),
    GENIVS.brief(),
    (function(){if(typeof memChronicle!=='function'||typeof S==='undefined'||S.memOn===false)return '';
      var _manual=memChronicle();return _manual?('【玩家长期手记】以下是玩家亲手记下、要求长期保留的设定与约定；剧情原文由记忆宫殿按相关性检索，不在这里重复注入：\n'+_manual):'';})(),
    (function(){if(typeof npcFavorDigest!=='function')return '';var _fd=npcFavorDigest();return _fd?('【人物好感·续记（不得健忘）】以下为曾登场人物最近一次的好感度与近况。他们即便暂时离场，好感与关系也须【延续记忆】：再次出场时自此数值起继续自然演变，严禁凭空重置、归零或大幅跳变；确有剧情推动方可增减：\n'+_fd):'';})(),
    /* 世界书不在页面拼接；原生 lorebook 管线按当前时代和人物扫描。 */
    eraGate(),                         /* 本回合是哪一年，就只准知道到哪一年 */
    powerSpec(),                       /* 皇帝在场时才发：那个高度怎么写出来 */
    abacusBand(),                      /* 她标价的单位跟着位置走，不是一路数到底 */
    mvuSpec(),
    modeSpec(),
    ACTIVE==='luzhi'?FELINIA_FINAL_CHECK:
      ('【每回自查】'+heroRebind(felStripLegacyMeowRule(G.post_history_instructions||''))),
    minc,
    CFGS.preset?('【玩家自定义常驻指令】'+CFGS.preset):'',
    heroTail(),                        /* 永远压最末：结尾的权重最高 */
    povTail(),
    MEOW_RULE                         /* 系统提示末尾再压一次 */
  /* 整份系统提示统一过一遍宏替换：卡的四个字段、预设、玩家自定义常驻指令里
     都可能带 {{user}}/{{char}}。 */
  ].filter(Boolean).map(macroFill).join('\n\n');
}
function risuInvoke(messages,cb,err,opt){
  opt=opt||{};
  var onDelta=opt.onDelta;delete opt.onDelta;
  var onPhase=opt.onPhase;delete opt.onPhase;
  var noStream=!!opt.noStream;delete opt.noStream;
  var wantTag=String(opt.wantTag||'');delete opt.wantTag;
  var aux=!!opt.aux;delete opt.aux;
  var opening=!!opt.opening;delete opt.opening;
  delete opt.maxCont;
  function num(v,d){var t=String(v==null?'':v).trim();
    return /^\d+(\.\d+)?$/.test(t)?parseFloat(t):d;}
  var mt=num(opt.max_tokens,(typeof SET!=='undefined')?SET.samp.maxt:3200);
  delete opt.max_tokens;
  if(mt<64)mt=3200;
  var minChars=num(opt.min_chars,aux?0:((typeof SET!=='undefined'&&SET.samp.minc)?SET.samp.minc:900));
  delete opt.min_chars;
  /* [world] 超时改为「无动静」计时：规划、首字、每一段流式增量都会把表重拨。
     原来是整回合硬上限 40 秒，接思考模型时规划＋正文常常超过，回合被白白掐断。
     生成引擎面板里填了「超时（秒）」就按它来，默认 90 秒无动静才断。 */
  var _cfgTo=parseInt(((typeof SET!=='undefined'&&SET.risu)||{}).timeout,10);
  var timeoutMs=num(opt.timeoutMs,aux?25000:((_cfgTo>0?_cfgTo:90)*1000));delete opt.timeoutMs;
  var ac=window.AbortController?new AbortController():null;
  if(!aux)GENAC=ac;
  var fired=false,timedOut=false,timer=null;
  function armTimer(){
    if(timer)clearTimeout(timer);
    timer=setTimeout(function(){
      if(fired)return;timedOut=true;try{if(ac)ac.abort();}catch(_){}
      fail(new Error('接口 '+Math.round(timeoutMs/1000)+' 秒没有动静'));
    },timeoutMs);
  }
  armTimer();
  (function(){var _d=onDelta,_p=onPhase;
    onDelta=function(t){if(!fired)armTimer();if(_d)return _d(t);};
    onPhase=function(ph){if(!fired)armTimer();if(_p)return _p(ph);};})();
  function fail(e){if(fired)return;fired=true;clearTimeout(timer);
    err(timedOut?('接口 '+Math.round(timeoutMs/1000)+' 秒没有动静，已中断'):felPublicError(e));}
  (aux?felRisuBoot().then(function(risu){
    var ei=_eraNow()||1;return risu.activateEra(ei,felRisuNpcKeys(ei)).then(function(){return risu;});
  }):felRisuPrepare(messages,{firstMessage:opening?'':undefined})).then(function(risu){
    return risu.configureTranslation(felTrCfg()).then(function(){return risu;});
  }).then(function(risu){
    var source=(aux&&SET.sub&&SET.sub.base&&SET.sub.model)?SET.sub:API;
    var provider=felRisuProvider(source);provider.maxTokens=Math.round(mt);
    if(aux)return risu.request({messages:messages,provider:provider,signal:ac?ac.signal:undefined,
      maxTokens:Math.round(mt),onDelta:noStream?undefined:onDelta});
    return risu.generate({provider:provider,signal:ac?ac.signal:undefined,
      minChars:Math.round(minChars),maxShortRetries:1,cognition:GAME.cognition,
      onPhase:onPhase,onDelta:noStream?undefined:onDelta});
  }).then(function(result){
    if(fired)return;fired=true;clearTimeout(timer);
    var text=String(result.text||'');
    var trunc=!!wantTag&&text.indexOf(wantTag)<0;
    if(!aux&&result.cognition!==undefined)GAME.cognition=result.cognition||null;
    if(!aux)try{palaceUiSync(true);}catch(_){}
    cb(text,{trunc:trunc,reason:trunc?'incomplete':'',cognition:result.cognition||null});
  }).catch(fail);
}
/* 普通回合失败时，玩家最后一条输入仍完整留在 TURNS 里。把重试放在报错
   当场，不要求重新输入，也不借用只会删除“上一条成功回复”的重演逻辑。 */
function oracleRetryNotice(label,msg){
  var p=narrAdd('sys','⚠&nbsp;'+esc2(label)+'：'+esc2(msg)
    +'<span style="display:flex;justify-content:center">'
    +'<span class="eBtn oracleAgain" style="margin-top:12px;font-size:11px;'
    +'padding:10px 34px 9px;border-color:rgba(154,116,42,.6)">'
    +'↻&nbsp;&nbsp;重新生成本回</span></span>',null);
  try{
    p.querySelector('.oracleAgain').addEventListener('click',function(){
      if(BUSY)return;
      try{p.remove();}catch(_){}
      askOracle();
    });
  }catch(_){}
  return p;
}
function askOracle(){
  BUSY=true;genOpen('gen');
  /* 组装阶段（FELINIA 状态整理与原生提示词编译）一旦抛错，BUSY 就永久停在 true：
     send 遇到 BUSY 是光秃秃的
     return，玩家点「发送」什么都不发生、输入框里的字也不清，剧情彻底不再前进，
     而且没有任何复位途径——只能退回主菜单。所以整段包起来，失败就地复位并说明原因。 */
  felCanonicalizeTurns().then(function(){return buildOracleMsgs();}).then(function(msgs){
    felTrStatus(felTrOn()?'韩语原稿管线已接通 · 正在生成':'自动翻译已关闭',0);
    askOracleSend(msgs);
  }).catch(function(e){
    BUSY=false;try{genClose();}catch(_){}
    var em=felPublicError(e);
    felTrStatus('翻译／组装失败：'+em,1);
    oracleRetryNotice('本回请求尚未发出',em);
  });
}
function buildOracleMsgs(){
  var hist=TURNS.slice().map(function(t){
    var c=(!felTrOn()&&t.role==='assistant'&&t.display!=null)?t.display:t.content;
    var scan=t.display==null?t.content:t.display;
    /* 思维链不能回喂：它会教模型继续写元评论，还白白吃掉上下文。 */
    if(t.role==='assistant'){c=stripCoT(c);scan=stripCoT(scan);}
    return{role:t.role,content:c,scanContent:scan,memoryIndex:t.t};
  });
  /* 旧回合的状态栏只留最近一份。八份面板将近八千字，既烧 token 又把模型往
     「这一回合的主要任务是填表」上带，正文越写越短。
     注意要按「最后一条 assistant」定位，不能按数组末位：askOracle 永远是在
     推入玩家这一句之后才调用的，末位恒为 user，于是 hist.length-1 保护的是那条 user，
     真正最近的面板（落在 length-2）照样被剥光。后果是模型整局只看得见开局那一份面板，
     协议里「无变动者照抄上一幕原值」根本无从执行——数值每轮被拉回开局值，
     剧情跟着状态一起原地打转。 */
  var _lastA=-1;
  for(var _k=hist.length-1;_k>=0;_k--)if(hist[_k].role==='assistant'){_lastA=_k;break;}
  for(var _i=0;_i<hist.length;_i++)
    if(_i!==_lastA&&hist[_i].role==='assistant'){
      hist[_i].content=stripMvu(hist[_i].content);
      hist[_i].scanContent=stripMvu(hist[_i].scanContent);
    }
  var finalCheck='【本回合不可侵犯的游戏边界】'
    +'\n【铁则一·压倒一切，高于任何文体规范】'+(heroName())
    +'的台词、动作、决定，一个字都不许你写。需要她表态时，把场面推到她面前，停笔，交还玩家。'
    +'\n唯一例外：状态栏 <mvu_panel> 里的 ◆心声 那一行——玩家这回写了 ~ 独白就照抄，'
    +'没写就据本幕处境写一句新的（每幕不同，不许照抄上一幕）。'
    +'正文里依旧不许出现她的内心独白，那一句只能待在状态栏那一行里。'
    +'\n'+MEOW_RULE+'\n'+FELINIA_FINAL_CHECK;
  /* 所有 system 内容都放在第一条。兼容接口常要求最后一条必须是 user；旧代码在玩家
     输入后又塞一条 system，部分中转会忽略玩家输入或只回三行。 */
  var msgs=[{role:'system',content:sysPrompt()+'\n\n'+finalCheck}];
  /* 开局那一幕从来没进过 TURNS（loadOpening 一上来就 TURNS=[]），
     模型此前完全不知道自己要接的是哪一场戏、哪一年、谁在场——只能按卡里那段
     一百多字的通用【场景】自己编一个开头，每局都编同一个。这就是「剧情一直循环」。 */
  var openingHistory=felTrOn()?GAME.opText:((GAME.op&&GAME.op.text)||GAME.opText);
  if(openingHistory)msgs.push({role:'assistant',content:openingHistory,
    scanContent:(GAME.op&&GAME.op.text)||openingHistory});
  msgs=msgs.concat(hist);
  return msgs;
}
function askOracleSend(msgs){
  var live=null,gen0=TYPE_GEN;
  function onDelta(full){
    if(gen0!==TYPE_GEN)return;                     /* 换局/读档/重演：旧流作废 */
    genFirstToken();GEN.chars=full.length;
    /* 原生韩文流立即显示；完整回复落定后，浏览器翻译器会把同一位置替换成中文。
       玩家不需要盯着空白画面等待译文。 */
    var body=stripMvuLive(full);
    if(!body)return;
    if(!live){
      var nr=$('#gNarr');live=document.createElement('div');live.className='liveWrap';
      nr.insertBefore(live,GEN.el||nr.querySelector('.gEot'));
    }
    /* 原来每收到一个 token 就把已累积的全文重新分段、转义、拼串、整棵子树重建，
       还每次强制同步布局——1500 字的回复要重建上千次，是流式卡顿的大头。
       改成按帧合并：一帧最多重建一次，出字内容一个字都不少。 */
    live._pend=body;
    if(!live._raf){
      var el=live;
      el._raf=requestAnimationFrame(function(){
        el._raf=0;
        if(!el.parentNode)return;                    /* 已收尾移除：这一帧直接丢弃 */
        var nr2=$('#gNarr');var _stk=nr2.scrollHeight-nr2.scrollTop-nr2.clientHeight<90;
        el.innerHTML=el._pend.split(/\n{2,}/).map(function(par){
          return '<p'+(felNarrClass(par)?(' class="'+felNarrClass(par)+'"'):'')+'>'+fmtBody(par)+'</p>';
        }).join('');
        if(_stk)nr2.scrollTop=nr2.scrollHeight;
      });
    }
  }
  risuInvoke(msgs,function(reply,meta){
    var streamed=!!live;
    if(live){try{live.remove();}catch(_){}live=null;}
    /* 这一局已经换掉了（读档／回主菜单／重演）：这条回复属于上一局，不许往新局里塞。
       没有这道守卫的话，退出后跑完的那个请求会凭空补进一条幽灵回合。 */
    if(gen0!==TYPE_GEN){try{genClose();}catch(_){}BUSY=false;return;}
    reply=felNormalizeMeowText(stripCoT(reply));
    /* 角色的（）吐槽与【】绝叫是 FELINIA 正文文风的一部分，必须保留。
       真正的内部规划只认专用隐藏标签，由 stripCoT 在流式、显示、历史三处剥离。 */
    reply=reply.replace(/\n{3,}/g,'\n\n').trim();
    /* 兼容端点若仍把内部规划塞进 content，宁可明确报错也不能把它写入剧情和存档。
       这些短语来自旧自动续写污染；正常英文角色对白不会同时命中两项。 */
    var _ml=String(reply||''),_ms=0;
    [/the second prompt says/i,/previous turn was cut off/i,/let'?s make sure/i,
     /refining the narrative flow/i,/continue writing right after the cutoff/i]
      .forEach(function(r){if(r.test(_ml))_ms++;});
    if(_ms>=2){
      genClose();BUSY=false;
      oracleRetryNotice('接口返回了内部推理草稿，已拦截且没有写入剧情','可直接重新生成本回');
      return;
    }
    felDisplayReply(reply).then(function(display){
      return FEL_RISU&&FEL_RISU.processDisplay?FEL_RISU.processDisplay(display):display;
    }).then(function(display){
      genClose();BUSY=false;felTrStatus(felTrOn()?'已保存韩语原稿 · 中文仅作显示':'自动翻译已关闭',0);
      var idx=TURNI++;
      TURNS.push({role:'assistant',content:reply,display:display,canonical:felTrOn()?'ko':'zh',
        cognition:(meta&&meta.cognition)||GAME.cognition||null,t:idx});
      try{GENIVS.absorb(display,idx);}catch(_){}     /* 本地中文状态推演看显示层；模型历史仍读原稿 */
      renderReply(display,idx,streamed);            /* 已流式出过字：跳过打字机，直接落定 */
      if(meta&&meta.trunc)narrAdd('sys',
        '⚠&nbsp;本回未正常收尾（'+esc2(meta.reason||'截断')+'），正文与状态栏可能不完整'
        +'&nbsp;——&nbsp;可在&nbsp;设置·链&nbsp;调大「单轮上限&nbsp;tokens」，或按&nbsp;↻&nbsp;重演',null);
    }).catch(function(e){
      /* 翻译服务断线不丢模型原稿：保存原始韩语并让玩家看见，下一回也仍可继续。 */
      genClose();BUSY=false;felTrStatus('译文失败，已保留韩语原稿：'+((e&&e.message)||e),1);
      var idx=TURNI++;
      var rawDisplay=reply;
      TURNS.push({role:'assistant',content:reply,display:rawDisplay,canonical:'ko',
        cognition:(meta&&meta.cognition)||GAME.cognition||null,t:idx});
      renderReply(rawDisplay,idx,streamed);
      narrAdd('sys','⚠&nbsp;中文译文失败，韩语原稿已完整保存：'+esc2((e&&e.message)||e),null);
    });
  },function(msg){
    genClose();BUSY=false;
    if(live){try{live.remove();}catch(_){}live=null;}
    if(gen0!==TYPE_GEN)return;
    oracleRetryNotice('神谕断连',msg);
  },{onDelta:onDelta,onPhase:function(phase){GEN.phase=phase;},wantTag:'</mvu_panel>'});
}
/* ── CONSILIVM · 浅字提示 ──────────────────────────────────────────────
   参谋不是一种「输入模式」——你不该为了看看能怎么办而先切个页签、再打一行字。
   它是一个常开的开关：每一幕落定之后，参谋按当下局势提一句你可能想打的话。
   走副脑通道（没配副脑就退回主接口），不碰主生成的中断控制器。

   四条可点的下一步撤了。那四张牌按下去当场就送，连改一个字的工夫都没有；
   而且四条永远是满的，玩下来就从「想写什么」变成了「挑哪一条」。
   现在只在输入框里浮一行浅字：Tab 或 → 收下来（只是填进框里，不发），
   收下来还能再改，不想要就直接打字盖掉。 */
var SUGG={one:null,seq:0,busy:false};
function suggOn(){return CFGS.sugg!==false;}          /* 默认开 */
var SUGG_CODE={'话':'SERMO','動':'ACTVS','动':'ACTVS','谋':'INSIDIAE','謀':'INSIDIAE',
               '书':'EPISTVLA','書':'EPISTVLA','令':'EDICTVM','行':'ITER'};
function suggPh(){                      /* 当前这个输入模式本来的那句提示语 */
  try{var m=document.querySelector('#game .gm.on');
      return m?(m.getAttribute('data-ph')||''):'';}catch(_){return '';}
}
function suggClear(){
  SUGG.one=null;SUGG.seq++;
  var i=$('#gIn');
  if(i){i.classList.remove('hasSug');i.placeholder=suggPh();}
}
function suggPaint(){
  var i=$('#gIn');if(!i)return;
  if(!suggOn()||!SUGG.one||!SUGG.one.text){
    i.classList.remove('hasSug');i.placeholder=suggPh();return;}
  i.classList.add('hasSug');
  i.placeholder=SUGG.one.text+'   ⇥';
}
/* 浅字有就浮出来，没有就不浮。「正在想」「失败了」一概不报——
   输入框是玩家打字的地方，不是这边汇报自己状况的地方。 */
function suggWait(){}
/* 那一句一律由 AI 现拟。以前这里有一套本地规则拼的假货，在没接口／解析失败／
   请求出错时顶上——玩家看不出真假，等于程序在乱出主意。现在不再伪造：
   拟不出来就整行不出现，宁可没有，也不替它编。 */
function suggNote(){}
/* 模型没照 JSON 格式回话时，从它自己写的那几行里宽松地捞——
   捞出来的仍是 AI 的原话，只是格式不规整，不是我们替它编的。 */
/* 模型没照格式回话时，从它自己写的那几行里捞第一句能用的。不替它编。 */
function suggLoose(t){
  var got='';
  String(t||'').split(/\n+/).some(function(ln){
    ln=ln.replace(/^[\s>*\-•]+/,'').replace(/^\d+[.、)]\s*/,'').trim();
    ln=ln.replace(/^["'「『\[]+|["'」』\],]+$/g,'').trim();
    if(!ln||ln.length>40)return false;
    if(!/[|｜]/.test(ln)&&ln.length<4)return false;
    got=ln;return true;
  });
  return got;
}
function suggGen(){
  suggClear();
  if(!suggOn()||!GAME.on)return;
  /* 正在出文时不求策：进游戏会先落一版程序化底稿开局、再由神谕铸写正式开局，
     两次都会走到这里——底稿那次纯属白烧一次接口调用。铸局期间 BUSY 为真，跳过即可，
     正式开局落定后自然会再叫一次。 */
  if(BUSY)return;
  /* 没接口就整行不出现——玩到这儿的人当然知道没 AI 就没提示，不必再提醒一遍。 */
  if(typeof zjAuxReady!=='function'||!zjAuxReady())return;
  var seq=++SUGG.seq;
  var last='';
  for(var i=TURNS.length-1;i>=0;i--){if(TURNS[i].role==='assistant'){last=stripMvu(TURNS[i].display||TURNS[i].content);break;}}
  /* 开局那一幕不进 TURNS（loadOpening 一上来就清空），此时得回落到开局正文本身——
     否则刚进游戏、最需要「能干什么」提示的那一刻，反而一条策都没有。 */
  if(!last&&GAME.opText)last=stripMvu(GAME.opText);
  if(!last)return;
  var her=(ACTIVE==='cleo')?(cleoAwake()?'持田信男，46岁，失业独居的大叔（现实侧）':'克娄巴特拉（梦境侧的前世）'):heroName();
  suggWait();
  var sys='你是这一局角色扮演的旁边人。根据刚落定的这一幕，替玩家（'+her+'）想一句他这一回合可能想打的话。\n'
    +'格式铁则：只输出一行「码|内容」，别的一个字都不要。不要 JSON，不要引号，不要序号。\n'
    +'码只能取：话（出声说）、动（做动作）、谋（暗地里）、书（修书）、令（吩咐人办）。\n'
    +'内容不超过 14 字、第一人称、具体可执行，落到人名地名物名上，写成大白话，不抒情、不摆金句；'
    +'不要空泛的「继续观察」「再想想」。\n'
    +'只给一句。给最顺手的那一句，不要给最戏剧化的那一句——这只是替他省一次打字，不是替他决定。\n'
    +'示例：话|问布伦努斯要多少金子';
  callAuxAI(sys,[{role:'user',content:'【刚落定的这一幕】\n'+String(last).slice(-700)}])
  .then(function(t){
    if(seq!==SUGG.seq)return;
    var raw=suggLoose(t);
    if(!raw){SUGG.one=null;suggPaint();return;}
    var m=/^([^\s|｜!！]{1,2})\s*(?:!|！)?\s*[|｜]\s*(.+)$/.exec(raw);
    SUGG.one = m ? {label:m[1],text:String(m[2]).trim().slice(0,30)}
                 : {label:'话',text:raw.slice(0,30)};
    if(!SUGG.one.text)SUGG.one=null;
    suggPaint();
  },function(e){if(seq===SUGG.seq)suggClear();});
}
/* 横向拖动滚动（鼠标）。触摸端交给浏览器原生 pan-x，带惯性、不跟它抢。
   拖过 4px 才算滚动并吃掉这一次 click，否则一拖就误切了模式。 */
function hDrag(el){
  if(!el||el._hdrag)return;el._hdrag=1;
  var down=false,moved=false,sx=0,sl=0,pid=null;
  el.addEventListener('pointerdown',function(e){
    /* 解锁必须排在三道闸门之前：闸门里任何一条提前 return，_eat 就会一直停在上一次
       拖动留下的 1 上，此后这条栏里的每一次点击都被下面那个捕获期处理器吞掉。
       触屏（第一条闸门）与栏宽不溢出（第三条）都会命中——玩家横拖模式栏去够
       「入梦／起床」，那一拖正好把 _eat 立起来，接着的一点就永远按不动。 */
    el._eat=0;
    if(e.pointerType&&e.pointerType!=='mouse')return;
    if(e.button!=null&&e.button!==0)return;
    if(el.scrollWidth<=el.clientWidth+1)return;
    down=true;moved=false;sx=e.clientX;sl=el.scrollLeft;pid=e.pointerId;
    try{el.setPointerCapture(pid);}catch(_){}
  });
  el.addEventListener('pointermove',function(e){
    if(!down)return;
    var dx=e.clientX-sx;
    if(!moved&&Math.abs(dx)<4)return;
    moved=true;el.scrollLeft=sl-dx;el.style.cursor='grabbing';e.preventDefault();
  });
  function up(){
    if(!down)return;down=false;el.style.cursor='grab';
    try{el.releasePointerCapture(pid);}catch(_){}
    if(moved)el._eat=1;
  }
  el.addEventListener('pointerup',up);
  el.addEventListener('pointercancel',up);
  /* 一次性消费：吃掉紧跟拖动的那一次点击就复位，别把状态留给下一次点击 */
  el.addEventListener('click',function(e){if(el._eat){el._eat=0;e.stopPropagation();e.preventDefault();}},true);
  el.addEventListener('wheel',function(e){
    if(el.scrollWidth<=el.clientWidth+1)return;
    var d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
    if(!d)return;el.scrollLeft+=d;e.preventDefault();
  },{passive:false});
}
/* 左边那一疊小窗的命中：按版面座标自己判，不交给 :hover。
   为什么不能用 :hover，见上面 .gArr.hv 那一段的注释——那是一个自己拆自己的环。

   判定必须**整个**离开变形后的几何，进出都是。
   第一版只把「进」改成版面座标判，「出」还留着 .gRail 的 pointerleave，
   结果最下面那一枚照旧在闪：标签 .gArr .t 是 bottom:-14px 挂在盒子外头的，
   落在轨道的框以外，于是这一枚一变形、指标就算离开了轨道 → pointerleave 清掉 .hv
   → 弹回原位又盖住指标 → 再算进来。环换了个地方长出来。
   所以进与出都挂在 document 的 pointermove 上，一律按版面座标算：
   在任何一枚的版面框里就亮那一枚，都不在就全灭。transform 碰不到 offsetLeft/offsetTop，
   这个判定跟动画完全无关。

   命中区往下多算 16 像素，就是给那条标签留的（四枚之间的间距是 20 像素，
   那几条字正好落在间距里，是这条轨道上最常被扫到的地方）。

   轨道的框只在「一枚都没亮着」的时候重量。理由不是省事，是这两条轨道会挪：
   #game 没开的时候量到的全是零，开了局才有位置；--ui 一变、视觉小说那一栏收放，
   位置也跟着走。改用一个量出来的边界提前返回，就会被开局前那份零锁死——
   进了局往左扫，边界还停在 40，永远早退，这一栏再也不亮。
   所以边界写成固定的 200（两条轨道都在 left:3～6，宽 76 上下，够宽了），
   在这条带子里且没有亮着的，就重量一次。 */
var RAIL_EDGE=200;
var RAILH={its:null,box:null};
function railHovScan(){
  var rails=document.querySelectorAll('.gRail,.g3dRail'),its=[],i,j,a;
  for(i=0;i<rails.length;i++){a=rails[i].querySelectorAll('.gArr');
    for(j=0;j<a.length;j++)its.push({r:rails[i],e:a[j]});}
  RAILH.its=its;RAILH.box=null;
}
function railHovBox(){
  var its=RAILH.its||[],i,b=[];
  for(i=0;i<its.length;i++)b.push(its[i].r.getBoundingClientRect());
  RAILH.box=b;
}
function railHovAt(x,y){
  var its=RAILH.its||[],b=RAILH.box||[],i,e,rb,l,t;
  for(i=0;i<its.length;i++){e=its[i].e;rb=b[i];
    if(!rb||!rb.width||!e.offsetParent)continue;
    l=rb.left+e.offsetLeft;t=rb.top+e.offsetTop;
    if(x>=l-2&&x<=l+e.offsetWidth+2&&y>=t-2&&y<=t+e.offsetHeight+16)return e;}
  return null;
}
function railHov(){
  railHovScan();
  if(!RAILH.its.length)return;
  document.addEventListener('pointermove',function(ev){
    if(ev.pointerType&&ev.pointerType!=='mouse')return;   /* 触控没有 hover 这回事 */
    var its=RAILH.its,i,on=false;
    for(i=0;i<its.length;i++)if(its[i].e.classList.contains('hv')){on=true;break;}
    if(ev.clientX>RAIL_EDGE&&!on)return;   /* 离得远又没亮着的：一次测量都不做 */
    if(!on||!RAILH.box)railHovBox();       /* 没亮着就重量：轨道会随开局与收放挪位子 */
    var got=railHovAt(ev.clientX,ev.clientY);
    for(i=0;i<its.length;i++)its[i].e.classList.toggle('hv',its[i].e===got);
  },{passive:true});
}
try{railHov();}catch(_){}
function touchy(){
  try{
    return matchMedia('(pointer:coarse)').matches
        || (navigator.maxTouchPoints||0)>0
        || ('ontouchstart' in window);
  }catch(_){return false;}
}
(function(){
  var gms=gEl.querySelectorAll('.gm'),gIn=$('#gIn');
  hDrag(gEl.querySelector('.gModes'));
  /* 模式单子：说明那一行直接拿 data-ph 来写，免得同一句话在标记里存两份、日后改一处漏一处。 */
  var mBtn=$('#gModeBtn'),mMenu=$('#gModeMenu');
  for(var k=0;k<gms.length;k++){
    var ph=gms[k].getAttribute('data-ph')||'';
    if(ph&&!gms[k].querySelector('em')){var em=document.createElement('em');em.textContent=ph;gms[k].appendChild(em);}
  }
  function gmLabel(){
    var on=gEl.querySelector('.gm.on')||gms[0];
    if(!on||!mBtn)return;
    /* 单子挂在钮里，钮里于是有七套 .ms/b；只认钮自己那一层的直接子元素。 */
    var i0=mBtn.querySelector(':scope>.ms'),b0=mBtn.querySelector(':scope>b');
    var i1=on.querySelector('.ms'),b1=on.querySelector('b');
    if(i0&&i1)i0.textContent=i1.textContent;
    if(b0&&b1)b0.textContent=b1.textContent;
  }
  function gmOpen(v){
    if(!mMenu)return;
    mMenu.classList.toggle('open',!!v);
    if(mBtn)mBtn.classList.toggle('open',!!v);
  }
  if(mBtn)mBtn.addEventListener('click',function(e){
    /* 单子挂在钮身上（贴着钮开），点单子里的项会冒泡到这里；不拦住的话
       选一项＝先合上再被这里翻开，看着就是「点了没反应」。 */
    if(mMenu&&mMenu.contains(e.target))return;
    e.stopPropagation();gmOpen(!mMenu.classList.contains('open'));
  });
  /* 点别处收起来。用捕获阶段：单子里那几项自己会 stopPropagation 之外的路都要拦得住。 */
  document.addEventListener('click',function(e){
    if(!mMenu||!mMenu.classList.contains('open'))return;
    if(mMenu.contains(e.target)||(mBtn&&mBtn.contains(e.target)))return;
    gmOpen(false);
  });
  gmLabel();
  for(var i=0;i<gms.length;i++)(function(m){
    m.addEventListener('click',function(){
      for(var j=0;j<gms.length;j++)gms[j].classList.remove('on');
      m.classList.add('on');gIn.placeholder=m.getAttribute('data-ph');
      gmLabel();gmOpen(false);
      /* 只有鼠标设备才顺手把光标放进输入框。触摸屏上 focus() 会把软键盘顶起来——
         玩家只是想换个模式看看，屏幕却被键盘吃掉半块，还得再点一次收回去。
         三个条件任一成立即当触摸设备：光靠 pointer:coarse 在某些安卓浏览器上会漏。 */
      if(!touchy())gIn.focus();
    });
  })(gms[i]);
  function send(){
    if(BUSY)return;
    var v=gIn.value.trim();
    /* 空输入照例不发，唯独「入梦／起床」例外：那一按本身就是一手
       （现在就睡、现在就醒），不该再逼玩家补一句话才肯动。 */
    if(!v&&!(ACTIVE==='cleo'&&DREAMARM))return;
    if(window.SX)SX('send');
    var mode=gEl.querySelector('.gm.on'),tag=mode?(mode.getAttribute('data-tag')||'SERMO'):'SERMO';
    var TAGCN={SERMO:'发话',ACTVS:'行动',LIBERVM:'自由',INSIDIAE:'密谋',EPISTVLA:'书信',EDICTVM:'敕令'};
    var idx=TURNI++;
    /* 自由：不套任何模式前缀，你写什么就原样送出去。
       其余模式的方括号标签是给模型分辨「这一回合她在做什么」用的，自由档不需要。 */
    var free=(tag==='LIBERVM');
    var body0=(v?(free?v:('【'+tag+'】'+v)):''),dLbl='';
    if(ACTIVE==='cleo'&&DREAMARM){
      var dIn=(DREAMARM==='入梦'),solo=!v;   /* solo：光按了钮、没写话 */
      body0='【'+DREAMARM+'】（'+(dIn
        ?('切到埃及一侧：先写他睡意漫上来、坠入梦境的过程，'
          +(solo?'再从上一段梦境中断处接着演下去':'再在梦中回应下面这一手')+'；东京在醒来之前不再出现。')
        :('切到东京一侧：先写梦境退潮、他睁眼醒来的过程，'
          +(solo?'再把东京的这一天接着演下去':'再在现实中回应下面这一手')+'；埃及在下次入梦之前不再出现。'))
        +'）'+(solo?'':'\n'+body0);
      dLbl=DREAMARM+(v?' · ':'');
      DREAMARM=null;
      try{
        var _di=document.getElementById('dreamIn'),_dw=document.getElementById('dreamOut');
        if(_di)_di.classList.remove('on');
        if(_dw)_dw.classList.remove('on');
      }catch(_){}
    }
    TURNS.push({role:'user',content:body0,t:idx});
    /* 光按钮没写话时，这一手在叙事里就只署「入梦／起床」，别再挂一个发话标签 */
    narrAdd('me','▌'+esc2(v?(dLbl+(TAGCN[tag]||tag)):dLbl)+(v?'&nbsp;&nbsp;'+esc2(v):''),idx);
    gIn.value='';
    suggClear();
    if(/^[~～]/.test(v)){try{if(GAME.lastPanel)renderMvu(GAME.lastPanel);}catch(_){}}  /* 内心独白：情报台心声即时回放 */
    if(apiReady())askOracle();
    else {try{GENIVS.offlineTurn(v,idx);}catch(_){narrAdd('sys','…&nbsp;ORACVLVM&nbsp;未接线&nbsp;·&nbsp;已记录…',idx);}}
  }
  $('#gSend').addEventListener('click',send);
  gIn.addEventListener('keydown',function(e){if(e.isComposing||e.keyCode===229)return;if(e.key==='Enter')send();});
  /* 浅字提示开关：跟设置面板里的勾选双向同步 */
  var sgBtn=$('#gSug');
  function sugSync(){
    var on=suggOn();
    if(sgBtn)sgBtn.classList.toggle('on',on);
    var cb=$('#cfgSugg');if(cb)cb.checked=on;
    if(!on)suggClear();
  }
  if(sgBtn)sgBtn.addEventListener('click',function(){
    CFGS.sugg=!suggOn();try{cfgStore();}catch(_){}
    sugSync();
    if(suggOn())suggGen();
  });
  window.__sugSync=sugSync;sugSync();
  /* 收下那行浅字：Tab 或 →。**不发出去** —— 从前那四张牌按下去当场就送，
     连改一个字的工夫都没有。现在只是抄进框里，改不改、发不发由玩家定。
     框里已经有字就什么也不做（那时 Tab 该做它本来的事）。 */
  gIn.addEventListener('keydown',function(e){
    if(e.key!=='Tab'&&e.key!=='ArrowRight')return;
    if(e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return;
    if(gIn.value)return;
    var one=SUGG.one;
    if(!suggOn()||!one||!one.text||BUSY)return;
    e.preventDefault();
    /* 顺带把输入模式切成这一句对应的那一档 */
    var want=SUGG_CODE[one.label]||'SERMO';
    for(var j=0;j<gms.length;j++){
      var nm=gms[j].getAttribute('data-tag')||'';
      gms[j].classList.toggle('on',nm===want);
    }
    var mb=$('#gModeBtn'),cur=gEl.querySelector('.gm.on');
    if(mb&&cur){
      var b0=mb.querySelector(':scope>b'),i0=mb.querySelector(':scope>.ms');
      var b1=cur.querySelector('b'),i1=cur.querySelector('.ms');
      if(b0&&b1)b0.textContent=b1.textContent;
      if(i0&&i1)i0.textContent=i1.textContent;
    }
    gIn.value=one.text;
    SUGG.one=null;
    gIn.classList.remove('hasSug');
    gIn.placeholder=suggPh();
    try{gIn.focus();gIn.setSelectionRange(gIn.value.length,gIn.value.length);}catch(_){}
  });
  /* 重演与回溯必须让隐藏角色状态跟着正文一起退，不能让已丢弃剧情继续影响下一拍。 */
  function restoreCognition(){
    GAME.cognition=(GAME.op&&GAME.op.cognition)||null;
    for(var ci=TURNS.length-1;ci>=0;ci--){
      if(TURNS[ci].role==='assistant'&&TURNS[ci].cognition){GAME.cognition=TURNS[ci].cognition;break;}
    }
  }
  /* 重新演绎：丢掉最后一条神谕回复重取 */
  $('#gRedo').addEventListener('click',function(){
    if(BUSY)return;TYPE_GEN++;
    var last=TURNS[TURNS.length-1];
    if(!last)return;
    if(last.role==='assistant'){
      document.querySelectorAll('#gNarr [data-t="'+last.t+'"]').forEach(function(n){n.remove();});
      TURNS.pop();
    }
    restoreCognition();
    /* 面板要跟着一起退回上一幕，否则情报台还挂着刚被丢弃那一回的状态 */
    GAME.lastPanel=null;
    for(var _li=TURNS.length-1;_li>=0;_li--){
      if(TURNS[_li].role!=='assistant')continue;
      GAME.lastPanel=parseMvu(TURNS[_li].content)||null;
      if(GAME.lastPanel)break;
    }
    if(!GAME.lastPanel&&GAME.opText)GAME.lastPanel=parseMvu(GAME.opText)||null;
    try{GENIVS.setPrev(GAME.lastPanel);}catch(_){}
    if(GAME.lastPanel)renderMvu(GAME.lastPanel);
    if(apiReady()){askOracle();return;}
    /* 没配接口时游戏本来就靠 GENIVS.offlineTurn 推进，完全可玩。
       原来这里直接什么都不做——正文已经删了、却不补新的，玩家每点一次少一段剧情。 */
    var _uv='';
    for(var _ui=TURNS.length-1;_ui>=0;_ui--)if(TURNS[_ui].role==='user'){_uv=TURNS[_ui].content;break;}
    var _ut=(TURNS.length?TURNS[TURNS.length-1].t:null);
    try{GENIVS.offlineTurn(_uv||'（继续）',_ut);}
    catch(_){narrAdd('sys','…&nbsp;ORACVLVM&nbsp;未接线&nbsp;·&nbsp;已记录…',_ut);}
  });
  /* 回溯：舍弃最后一问一答 */
  $('#gBack').addEventListener('click',function(){
    if(BUSY)return;TYPE_GEN++;
    var drop=0;
    while(TURNS.length&&drop<2){
      var t=TURNS.pop();drop+=(t.role==='user')?2:1;
      document.querySelectorAll('#gNarr [data-t="'+t.t+'"]').forEach(function(n){n.remove();});
    }
    restoreCognition();
    /* 面板必须跟着一起退，否则情报台还挂着刚被丢弃那一轮的状态；
       编年长卷也要靠 memSync 截回去（回退检测在 memSync 里）。 */
    GAME.lastPanel=null;
    for(var li=TURNS.length-1;li>=0;li--){
      if(TURNS[li].role!=='assistant')continue;
      GAME.lastPanel=parseMvu(TURNS[li].content)||null;
      if(GAME.lastPanel)break;
    }
    if(!GAME.lastPanel&&GAME.opText)GAME.lastPanel=parseMvu(GAME.opText)||null;
    try{GENIVS.setPrev(GAME.lastPanel);}catch(_){}   /* 不对齐的话，被丢弃那一幕的人与数值会从 PREV 渗回来 */
    if(GAME.lastPanel)renderMvu(GAME.lastPanel);
  });
})();
/* —— 朗读 —— */
(function(){
  $('#gTts').addEventListener('click',function(){
    if(ttsAudio&&!ttsAudio.paused){ttsAudio.pause();return;}
    if(window.speechSynthesis&&speechSynthesis.speaking){speechSynthesis.cancel();return;}
    var last=null;
    for(var i=TURNS.length-1;i>=0;i--)if(TURNS[i].role==='assistant'){last=TURNS[i];break;}
    speakText(last?(last.display||last.content):$('#gNarr').textContent.slice(0,1200));
  });
})();
/* —— 幕间乐：WebAudio 程序化氛围（无素材依赖） —— */
var AU={ctx:null,mgain:null,on:false,nodes:[],timer:null,vol:.7,mvol:.55};
function auInit(){
  if(AU.ctx)return true;
  var C=window.AudioContext||window.webkitAudioContext;if(!C)return false;
  AU.ctx=new C();AU.mgain=AU.ctx.createGain();
  AU.mgain.gain.value=AU.mvol*.5;AU.mgain.connect(AU.ctx.destination);
  return true;
}
function auPluck(){
  if(!AU.on)return;
  var t=AU.ctx.currentTime;
  var scale=[110,130.8,146.8,164.8,196,220,261.6];
  var f=scale[Math.floor(Math.random()*scale.length)]*(Math.random()<.3?2:1);
  var o=AU.ctx.createOscillator(),g=AU.ctx.createGain();
  o.type='triangle';o.frequency.value=f;
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(.24,t+.015);
  g.gain.exponentialRampToValueAtTime(.0001,t+2.2);
  o.connect(g);g.connect(AU.mgain);o.start(t);o.stop(t+2.4);
  AU.timer=setTimeout(auPluck,1800+Math.random()*4200);
}
/* 本地预览只用于改界面，不让音乐反复打扰测试；线上域名照常播放。
   file:// 也算本地，免得误点本地 HTML 后第一下交互突然响起来。 */
var LOCAL_TEST=/^(localhost|127\.0\.0\.1|\[?::1\]?)$/i.test(location.hostname)||location.protocol==='file:';
/* —— 幕间乐：真曲库（Fons Vitae 为首曲；按曲点播、放完自动下一首循环） —— */
var BGM_LIST=[
 /* 前二十二首搬自三叶那一份，排在最前，所以开机第一首就是它们
    （BGM.i 初值是 0，进门放的是 bgmPlay(0)）。原先这一卡的四十七首顺次排在后面。
    那边的 .dat 是裸的 mp3，这边的 .dat 要按本卡那道滚动异或写过一遍，
    否则 bgmSrc 解出来是噪声 —— 搬的时候是重新编过的，不是原样拷贝。 */
 {d:'7b00ad3944',t:"Nino Ferrer - La Marseillaise · 马赛曲"},
 {d:'682ab3828b',t:"Édith Piaf - Le ça ira · 一切会好"},
 {d:'4bb42ce62a',t:"Armand Mestral - L'Internationale · 国际歌"},
 {d:'8bfd40e7e1',t:"Les Cœurs Révolutionnaires - Le drapeau rouge · 红旗"},
 {d:'d3df449cb9',t:"Les Cœurs Révolutionnaires - En avant la classe ouvrière"},
 {d:'5a1c4eb660',t:"Les Cœurs Révolutionnaires - Le front des travailleurs"},
 {d:'89bd5db6d6',t:"Armand Mestral - Le chant des partisans · 游击队之歌"},
 {d:'362eec6760',t:"Armand Mestral - Le chant des ouvriers · 工人之歌"},
 {d:'8858cb89a4',t:"Yves Montand - Le temps des cerises · 樱桃时节"},
 {d:'4f11d3bfd0',t:"Yves Montand - La butte rouge · 红色山丘"},
 {d:'58237b42f2',t:"Yves Montand - Les canuts · 里昂织工"},
 {d:'1f4e007409',t:"Yves Montand - Le galérien"},
 {d:'ea29e27a9d',t:"Yves Montand - J'avions reçu commandement"},
 {d:'438fb119b5',t:"Yves Montand - Rendez-vous avec la liberté · 与自由有约"},
 {d:'bce0b304d4',t:"Catherine Sauvage - La grève · 罢工"},
 {d:'fe42ec1336',t:"Catherine Sauvage - L'affiche rouge · 红色布告"},
 {d:'d1cf730107',t:"Mouloudji - L'insurgé · 起义者"},
 {d:'db5b3c56c9',t:"Mouloudji - Le déserteur · 逃兵"},
 {d:'d033661abb',t:"Germaine Montero - Complainte des assassins"},
 {d:'f356773c9b',t:"Les Compagnons De La Chanson - Aux marches du palais · 宫阶之上"},
 {d:'b3a1b33d0f',t:"Léo Ferré - Graine d'ananar"},
 {d:'3dd92967d2',t:"André Dassary - Maréchal nous voilà"},
 {d:'ccad07e1de',t:"Fons Vitae"},
 {d:'61916d8641',t:"Aenaoi Nefelai"},
 {d:'80979164f0',t:"Anakrousis - Orestes Stasimo"},
 {d:'09049ab6e0',t:"Anonymi Bellermann"},
 {d:'ff86f212c1',t:"De Pastoribus"},
 {d:'c21c3671a6',t:"De Tolerentia Aetherea"},
 {d:'b740448ed4',t:"Deuxième Hymne Delphique à Apollon"},
 {d:'8d4884f50c',t:"Epitaphe de Seikilos"},
 {d:'30be2b075e',t:"Extravagans"},
 {d:'0e813ffc4d',t:"Fragments instrumentaux de Contrapollinopolis"},
 {d:'b3a8f2d1a5',t:"Homero Hymnus"},
 {d:'91ae421c6f',t:"Hymne au Soleil"},
 {d:'5a8ec46037',t:"Hymne à la Muse"},
 {d:'4a6193fe10',t:"Hymne à Némésis"},
 {d:'60fd5cd970',t:"Hymne Chrétienne d'Oxyrhynchus"},
 {d:'947abb858c',t:"Nobilissima"},
 {d:'bec8cbb190',t:"Nordica Et Desolata"},
 {d:'a66b483f77',t:"Oratio Pro-Folia"},
 {d:'9ce2514bf3',t:"Papyrus Michigan"},
 {d:'329a1a9818',t:"Papyrus Oslo AB - Epilogos-Katastrophe"},
 {d:'0e2ffd0893',t:"Papyrus Oxyrhynchus 2436"},
 {d:'e9fca21797',t:"Papyrus Wien 29825"},
 {d:'b8f05088aa',t:"Papyrus Zenon. Cairo fragment"},
 {d:'cb18fdca23',t:"Parsimonia Aristocraciae"},
 {d:'36c3a1ae02',t:"Pean. Papyrus Berlin 6870"},
 {d:'3164d4ad02',t:"Plaine de Tecmessa"},
 {d:'7a78ffe136',t:"Poem. Mo 1, 11f. Migne 37, 523"},
 {d:'f9859cb5a6',t:"Premier Hymne Delphique à Apollon"},
 {d:'770b50a834',t:"Première Ode Pythique"},
 {d:'266d8c07c1',t:"Principalis. Fermescens"},
 {d:'6ec3d70776',t:"Subtilis"},
 {d:'663614d9eb',t:"Terencio. Hecyra 861"},
 {d:'f922783cbf',t:"Theatralis Et Hipocitae"},
 {d:'3c4e8c6072',t:"Vulgaris-Sine Populi Notione"}
];
var BGM={i:0,a:null,on:false,skip:0};
function bgmEl(){
  if(BGM.a)return BGM.a;
  var a=new Audio();a.preload='none';a.volume=(typeof BGVOL==='number'?BGVOL:60)/100;
  a.addEventListener('ended',function(){BGM.skip=0;bgmPlay((BGM.i+1)%BGM_LIST.length);if(typeof bgmUi==='function')bgmUi();});
  a.addEventListener('error',function(){
    if(!BGM.on)return;
    if(++BGM.skip>=BGM_LIST.length){BGM.skip=0;return;}   /* 整轮皆败即止，防死循环 */
    bgmPlay((BGM.i+1)%BGM_LIST.length);
  });
  BGM.a=a;return a;
}
var BGK='AurumSilentiumRomaeCanit';
function bgmSrc(i,cb){                       /* 资材同制：哈希 .dat + 滚动异或，取后于本机还原为音频流 */
  var e=BGM_LIST[i];
  if(e._u)return cb(e._u);
  fetch('/core/res/data/idx/v1/'+e.d+'.dat').then(function(r){return r.arrayBuffer();}).then(function(ab){
    var u=new Uint8Array(ab);
    for(var k=0;k<u.length;k++)u[k]^=(BGK.charCodeAt(k%BGK.length)+((k*7)&0xff))&0xff;
    e._u=URL.createObjectURL(new Blob([u],{type:'audio/mpeg'}));
    for(var j=0;j<BGM_LIST.length;j++){        /* 只留邻近几首的解码，余者释放，免占内存 */
      var d=Math.abs(j-i);if(d>2&&BGM_LIST[j]._u){try{URL.revokeObjectURL(BGM_LIST[j]._u);}catch(_){}BGM_LIST[j]._u=null;}
    }
    cb(e._u);
  }).catch(function(){cb(null);});
}
function bgmPlay(i){
  if(LOCAL_TEST){
    BGM.on=false;
    try{$('#gtSnd').classList.remove('on');$('#gtSnd').title='MVSICA · 本地测试已静音';}catch(_){}
    return;
  }
  BGM.i=i;var a=bgmEl();
  BGM.on=true;$('#gtSnd').classList.add('on');
  $('#gtSnd').title='MVSICA · '+BGM_LIST[i].t+'（点击开启播放器）';
  bgmArm();                              /* 取曲尚未完成也先接住菜单上的第一次交互，别等到下一页 */
  bgmSrc(i,function(u){
    if(BGM.i!==i)return;
    if(!u){if(++BGM.skip<BGM_LIST.length)bgmPlay((i+1)%BGM_LIST.length);return;}
    a.src=u;bgmStart(a,i);
  });
}
function bgmArm(){
  if(BGM._armed)return;BGM._armed=1;
  var f=function(){
    ['pointerdown','touchstart','keydown'].forEach(function(ev){document.removeEventListener(ev,f,true);});
    BGM._armed=0;BGM._touched=1;
    if(BGM.on&&BGM.a){
      /* 首曲还在取：先留下 autoplay；src 落定后即可接着播。已经取到则在本次手势里直接播放。 */
      BGM.a.autoplay=true;
      if(BGM.a.src){var q=BGM.a.play();if(q&&q.catch)q.catch(function(){bgmArm();});}
    }
  };
  ['pointerdown','touchstart','keydown'].forEach(function(ev){document.addEventListener(ev,f,true);});
}
function bgmStart(a,i){
  if(BGM._touched)a.autoplay=true;
  var p=a.play();
  if(p&&p.catch)p.catch(function(){bgmArm();}); /* 自动播放被拦：菜单上的首次交互补放 */
}
function bgmToggle(){
  if(LOCAL_TEST){BGM.on=false;if(BGM.a)BGM.a.pause();bgmUi();return;}
  if(BGM.on){BGM.on=false;$('#gtSnd').classList.remove('on');if(BGM.a)BGM.a.pause();return;}
  if(BGM.a&&BGM.a.src){var p=BGM.a.play();if(p&&p.catch)p.catch(function(){});BGM.on=true;$('#gtSnd').classList.add('on');return;}
  BGM.skip=0;bgmPlay(0);
}
/* —— 播放器面板 —— */
var BGVOL=60;try{BGVOL=Math.max(0,Math.min(100,parseInt(localStorage.getItem('guardianDragonBgmVol'))||60));}catch(_){}
function bgmUi(){
  var now=$('#bgNow'),ico=$('#bgPlayIco');
  if(LOCAL_TEST){
    if(now)now.textContent='本地测试 · 音乐已关闭';
    if(ico)ico.innerHTML='<path d="M6 6l12 12M18 6L6 18"/>';
    return;
  }
  if(now)now.textContent=(BGM.a&&BGM.a.src)?((BGM.on?'▶ ':'❚❚ ')+(BGM_LIST[BGM.i]?BGM_LIST[BGM.i].t:'')):'未在播放 · 点曲目或 ▶ 开始';
  if(ico)ico.innerHTML=BGM.on?'<path d="M8 4v16M16 4v16"/>':'<path d="M6 4l14 8-14 8z"/>';
  var ls=$('#bgList');
  if(ls&&ls.children.length)for(var i=0;i<ls.children.length;i++)
    ls.children[i].style.color=(i===BGM.i&&BGM.a&&BGM.a.src)?'var(--gold-hi)':'';
}
function bgmListRender(){
  var ls=$('#bgList');if(!ls||ls.children.length)return;
  BGM_LIST.forEach(function(x,i){
    var r=document.createElement('div');
    r.style.cssText='padding:7px 12px;font-size:9.5px;letter-spacing:.1em;color:var(--mut);cursor:pointer;border-bottom:1px solid rgba(19,18,13,.07);display:flex;gap:10px';
    r.innerHTML='<span style="opacity:.5;width:20px;flex:none">'+String(i+1).padStart(2,'0')+'</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+x.t+'</span>';
    r.addEventListener('click',function(){bgmPlay(i);bgmUi();});
    ls.appendChild(r);
  });
}
$('#gtSnd').addEventListener('click',function(){
  bgmListRender();bgmUi();
  var v=$('#bgVol');if(v)v.value=BGVOL;
  gDlgShow('#dlgBgm');
});
$('#bgPlay').addEventListener('click',function(){bgmToggle();bgmUi();});
$('#bgPrev').addEventListener('click',function(){bgmPlay((BGM.i-1+BGM_LIST.length)%BGM_LIST.length);bgmUi();});
$('#bgNext').addEventListener('click',function(){bgmPlay((BGM.i+1)%BGM_LIST.length);bgmUi();});
$('#bgVol').addEventListener('input',function(){
  BGVOL=+this.value;if(BGM.a)BGM.a.volume=BGVOL/100;
  try{localStorage.setItem('guardianDragonBgmVol',''+BGVOL);}catch(_){}
});
/* 开站即乐：开场动画与选单同步起乐（首曲开站即取即放，不等入局）；自动播放被拦则首次点按瞬间补放 */
/* —— 全屏 —— */
(function(){var cb=$('#cfgSugg');if(cb)cb.addEventListener('change',function(){
  CFGS.sugg=!!this.checked;try{cfgStore();}catch(_){}
  try{if(window.__sugSync)window.__sugSync();}catch(_){}
  if(CFGS.sugg!==false){try{suggGen();}catch(_){}}
});})();
(function(){var sl=$('#cfgNarr');if(!sl)return;
  sl.addEventListener('input',function(e){
    if(e.inputType&&/insert|delete/.test(e.inputType))return;   /* 键入中：先不动 */
    var v=parseInt(this.value,10);
    if(!isNaN(v))narrPxApply(v);
  });
  sl.addEventListener('change',function(){narrPxApply(this.value);});
  sl.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();this.blur();}});
})();
(function(){var sl=$('#cfgUi');if(!sl)return;
  /* 输入式：上下箭头（step）点一下即时生效；手打数字则等回车/失焦再生效，
     不然打「3」「5」想要 35 的瞬间界面先跳到 3%，很吓人。 */
  sl.addEventListener('input',function(e){
    if(e.inputType&&/insert|delete/.test(e.inputType))return;   /* 键入中：先不动 */
    var v=parseInt(this.value,10);
    if(!isNaN(v))uiScaleApply(v);
  });
  sl.addEventListener('change',function(){uiScaleApply(this.value);});
  sl.addEventListener('keydown',function(e){
    if(e.key==='Enter'){e.preventDefault();this.blur();}        /* blur 触发 change */
  });
})();
(function(){
  var tg=$('#luxTg');if(tg)tg.addEventListener('click',function(){luxApply(LUX?0:1);});
  var cb=$('#cfgLux');if(cb)cb.addEventListener('change',function(){luxApply(this.checked?1:0);});
})();
$('#gtFull').addEventListener('click',function(){
  if(document.fullscreenElement)document.exitFullscreen();
  else document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen();
});
/* ============ 设置·控制中枢（12页签，代码级对齐 Ghost setBody） ============ */
var SET={glass:80,forma:0,face:0,mvuRing:1,loreBud:20000,context:65536,
  tts:{src:0,base:'',key:'',model:'tts-1',voice:'',rate:105,scope:0,auto:0},
  img:{on:0,base:'',key:'',model:'',size:0,style:0},   /* style 0 ＝ NovelAI，见 IMGSTY */
  sub:{format:'openai',base:'',key:'',model:''},
  trans:{provider:'off',showRaw:0,deeplKey:'',deeplFree:1,deeplxUrl:'http://localhost:1188',deeplxToken:'',nativeDefaultV1:1,chineseDefaultV1:1},
  semantic:{on:1,mode:'hybrid',model:'',budget:3000,topK:8,gpu:1},
  vars:{},gvars:{},
  samp:{temp:'',topp:'',maxt:'',minc:'',reason:1,reasonDefaultV1:1},
  risu:{freq:'',pres:'',topk:'',rep:'',minp:'',topa:'',seed:'-1',verbosity:1,
    stream:1,strict:1,autoUrl:1,retries:2,timeout:600,stops:'',autoCont:0,autoMin:0,removeIncomplete:0,blankFallback:0,newOai:1,vision:'low',
    thinkType:'budget',thinkTokens:0,adaptive:'high',deepType:'off',deepEffort:'high',cot:0,
    instruct:0,tokenizer:'tik',template:'chatml',jinja:'',sysReplace:'system: {{slot}}',sysRole:'user',prefill:'',postEnd:'',chatSystem:0,sendName:0,thoughtDepth:-1,
    jsonOn:0,jsonStrict:1,json:'',extract:'',params:'',paramsAll:0,tools:'',
    autoCache:0,claudeRetrieval:0,claudeBatch:0,claudeHour:0,overload:0,flex:0,geminiThoughts:0,loreDepth:5,loreRecursive:0,loreFullWord:0},
  profs:{},presets:[],mems:[],rx:[],js:[],triggers:[],loreState:{}};
try{var _s=JSON.parse(localStorage.getItem('guardianDragonSet')||'{}');
  Object.keys(_s).forEach(function(k){SET[k]=_s[k];});}catch(_){}
/* 补全缺失的设置键。两条路都会缺：① 上面这行是整个子对象直接替换，存量用户存下来的
   img 是旧版本那六个键，count/cam/disp/auto 全是 undefined；② 字面量本身也没写全。
   后果都很实在——drawScene 里 n=g.count+1 得 NaN，而 Array(NaN) 抛 RangeError，
   「绘此幕」点了整个函数当场中断、毫无反应；cam/disp 为 undefined 则查表得 undefined，
   提示词里混进字面量「undefined」、图片显示宽度失效。这就是「设置里某些项目不作用」。 */
(function(){
  var D={glass:80,forma:0,face:0,mvuRing:1,loreBud:20000,context:65536,
    tts:{src:0,base:'',key:'',model:'tts-1',voice:'',rate:105,scope:0,auto:0},
    img:{on:0,auto:0,count:0,cam:0,disp:2,base:'',key:'',model:'',size:0,style:0,
         steps:'',cfg:'',w:'',h:'',seed:'',workflow:''},
    sub:{format:'openai',base:'',key:'',model:''},
    trans:{provider:'off',showRaw:0,deeplKey:'',deeplFree:1,deeplxUrl:'http://localhost:1188',deeplxToken:'',nativeDefaultV1:1,chineseDefaultV1:0},
    semantic:{on:1,mode:'hybrid',model:'',budget:3000,topK:8,gpu:1},
    vars:{},gvars:{},
    samp:{temp:'',topp:'',maxt:'',minc:'',reason:1,reasonDefaultV1:0},
    risu:{freq:'',pres:'',topk:'',rep:'',minp:'',topa:'',seed:'-1',verbosity:1,
      stream:1,strict:1,autoUrl:1,retries:2,timeout:600,stops:'',autoCont:0,autoMin:0,removeIncomplete:0,blankFallback:0,newOai:1,vision:'low',
      thinkType:'budget',thinkTokens:0,adaptive:'high',deepType:'off',deepEffort:'high',cot:0,
      instruct:0,tokenizer:'tik',template:'chatml',jinja:'',sysReplace:'system: {{slot}}',sysRole:'user',prefill:'',postEnd:'',chatSystem:0,sendName:0,thoughtDepth:-1,
      jsonOn:0,jsonStrict:1,json:'',extract:'',params:'',paramsAll:0,tools:'',
      autoCache:0,claudeRetrieval:0,claudeBatch:0,claudeHour:0,overload:0,flex:0,geminiThoughts:0,loreDepth:5,loreRecursive:0,loreFullWord:0}};
  Object.keys(D).forEach(function(k){
    var d=D[k];
    if(d&&typeof d==='object'){
      if(!SET[k]||typeof SET[k]!=='object')SET[k]={};
      Object.keys(d).forEach(function(k2){if(SET[k][k2]===undefined)SET[k][k2]=d[k2];});
    }else if(SET[k]===undefined)SET[k]=d;
  });
  ['presets','mems','rx','js','triggers'].forEach(function(k){if(!Array.isArray(SET[k]))SET[k]=[];});
  if(!Array.isArray(SET.img.ilore))SET.img.ilore=[];
  if(!SET.profs||typeof SET.profs!=='object')SET.profs={};
  if(!SET.loreState||typeof SET.loreState!=='object')SET.loreState={};
})();
function setStore(){lsSet('guardianDragonSet',JSON.stringify(SET))}
/* Chinese-first release: translation, Korean examples and Korean originals all
   remain available, but every existing browser starts this release with the
   optional Korean pipeline disabled once. Later manual choices are preserved. */
if(!SET.trans.chineseDefaultV1){
  SET.trans.chineseDefaultV1=1;
  SET.trans.provider='off';
  setStore();
}
/* Risu 原生默认是低推理。旧版 FELINIA 把“关”写成默认；只迁移一次，
   之后玩家手动选择关闭仍会被完整保留。 */
if(!SET.samp.reasonDefaultV1){
  SET.samp.reasonDefaultV1=1;
  if((parseInt(SET.samp.reason,10)||0)===0)SET.samp.reason=1;
  setStore();
}
/* FELINIA is a fixed game hosted by its embedded narrative runtime. The runtime
   database contains 41 era characters plus the 590 preset-character slots;
   only one era is selected, and its era characters are attached to that
   single narrator session. */
var FEL_RISU=null,FEL_RISU_BOOT=null;
function felPublicError(e){
  var message=String((e&&e.message)||e||'未知错误');
  if(/failed to fetch|networkerror|load failed/i.test(message))
    return '浏览器直连失败：接口未允许跨域（CORS）、HTTPS 页面连接了 HTTP 接口，或地址不可达';
  return message
    .replace(/Risu\s*AI|RisuAI|Risuai/gi,'叙事内核')
    .replace(/```risuerror\s*/gi,'').replace(/```/g,'').trim();
}
function felRisuLoad(){
  if(FEL_RISU)return Promise.resolve(FEL_RISU);
  function take(){return window.RisuHeadless.load('feliniaGame').then(function(mod){
    FEL_RISU=mod.FeliniaRisu;return FEL_RISU;});}
  if(window.RisuHeadless)return take();
  return new Promise(function(resolve,reject){
    var tm=setTimeout(function(){reject(new Error('叙事内核没有载入'));},20000);
    addEventListener('risu-headless-ready',function ready(){
      removeEventListener('risu-headless-ready',ready);clearTimeout(tm);take().then(resolve,reject);
    });
  });
}
function felRisuBoot(){
  if(FEL_RISU_BOOT)return FEL_RISU_BOOT;
  FEL_RISU_BOOT=felRisuLoad().then(function(risu){return new Promise(function(resolve,reject){
    function install(){
      if(!FE||!FE.eras||!FE.eras.length){reject(new Error('本纪资料没有载入'));return;}
      /* 范文只教实时意识与对白反应，不承担世界事实；写作规范本身在每局作者层。 */
      var _baseCard=window.__GAME_LUZHI__||CARDS.luzhi;
      var _risuCard=Object.assign({},_baseCard,{mes_example:[_baseCard.mes_example||'',FELINIA_VOICE_EXAMPLE]
        .filter(Boolean).join('\n\n')});
      risu.installContent(_risuCard,FE.eras).then(function(info){
        window.__FEL_RISU_INSTALL__=info;resolve(risu);
      },reject);
    }
    if(FE&&FE.eras&&FE.eras.length){install();return;}
    feLoad(function(ok){if(ok)install();else reject(new Error('本纪资料载入失败'));});
  });});
  return FEL_RISU_BOOT;
}
function felRisuNpcKeys(eraIndex){
  var era=null;try{for(var i=0;i<FE.eras.length;i++)if(FE.eras[i].i===eraIndex){era=FE.eras[i];break;}}catch(_){}
  if(!era||!era.figs)return [];
  /* 角色都已经作为这一时代的 Risu character 安装，但一回合只激活玩家实际带进
     场的那些。旧代码把本代 14 人的六组人物世界书全部拼进提示，Flash 不但慢，
     还会把没选的该隐等人误当作在场者。存档优先读固化的 key；正在铸局时可从
     FE.soc 现场恢复。 */
  var saved=(GAME&&Array.isArray(GAME.risuNpcKeys))?GAME.risuNpcKeys.filter(function(k){
    return String(k).indexOf('era:'+eraIndex+':npc:')===0;
  }):[];
  if(saved.length)return saved;
  try{
    if(FE.era&&FE.era.i===eraIndex&&FE.soc&&FE.soc.length)return FE.soc.map(function(index){
      var fig=era.figs[index];return fig?('era:'+eraIndex+':npc:'+index+':'+fig.n):'';
    }).filter(Boolean);
  }catch(_){}
  return [];
}
function felRisuFormat(value){
  value=String(value||'openai').toLowerCase();
  return /^(openai|responses|anthropic|gemini|mistral|ollama)$/.test(value)?value:'openai';
}
function felRisuOptionalNumber(value){
  if(value===''||value==null)return undefined;
  var n=Number(value);return isFinite(n)?n:undefined;
}
function felRisuAdditionalParams(text){
  var out=[];
  String(text||'').split(/\r?\n/).forEach(function(line){
    line=line.trim();if(!line||line.charAt(0)==='#')return;
    var at=line.indexOf('=');if(at<1)return;
    var key=line.slice(0,at).trim(),raw=line.slice(at+1).trim(),value=raw;
    /* Risu 的附加参数本来就接受字符串、数字、布尔值和 json:: 前缀。
       这里必须保留原始值：把 auto 强行 JSON.stringify 会变成带引号的字面量，
       对象又会被当作普通字符串。对象/数组替玩家补上内核要求的 json:: 前缀即可。 */
    if(raw.slice(0,6)!=='json::')try{
      var parsed=JSON.parse(raw);
      if(parsed&&typeof parsed==='object')value='json::'+raw;
    }catch(_){}
    if(key)out.push([key,value]);
  });
  return out;
}
function felRisuProvider(source){
  source=source||API;
  var mt=parseInt(SET.samp&&SET.samp.maxt,10)||4096;
  var temp=parseFloat(SET.samp&&SET.samp.temp),top=parseFloat(SET.samp&&SET.samp.topp);
  var r=SET.risu||{};
  var reason=parseInt(SET.samp&&SET.samp.reason,10);
  if(isNaN(reason))reason=1;
  reason=Math.max(0,Math.min(3,reason));
  return {base:source.base,key:source.key||API.key,model:source.model,format:felRisuFormat(source.format),
    temperature:isNaN(temp)?undefined:temp,topP:isNaN(top)?undefined:top,reasoningEffort:reason-1,maxTokens:mt<64?4096:mt,
    contextTokens:parseInt(SET.context,10)||65536,stream:r.stream!==0,autofillRequestUrl:r.autoUrl!==0,
    frequencyPenalty:felRisuOptionalNumber(r.freq),presencePenalty:felRisuOptionalNumber(r.pres),topK:felRisuOptionalNumber(r.topk),
    repetitionPenalty:felRisuOptionalNumber(r.rep),minP:felRisuOptionalNumber(r.minp),topA:felRisuOptionalNumber(r.topa),
    generationSeed:felRisuOptionalNumber(r.seed),requestRetries:felRisuOptionalNumber(r.retries),requestTimeoutSec:felRisuOptionalNumber(r.timeout),
    strictOpenAICompatible:r.strict!==0,stopStrings:String(r.stops||'').split(/\r?\n/).map(function(v){return v.trim();}).filter(Boolean),
    autoContinue:r.autoCont!==0,autoContinueMinTokens:parseInt(r.autoMin,10)||0,removeIncompleteResponse:r.removeIncomplete!==0,
    fallbackWhenBlankResponse:r.blankFallback!==0,newOpenAIHandler:r.newOai!==0,visionQuality:r.vision||'low',
    thinkingType:r.thinkType||'budget',thinkingTokens:parseInt(r.thinkTokens,10)||0,adaptiveThinkingEffort:r.adaptive||'high',
    deepseekThinkingType:r.deepType||'off',deepseekReasoningEffort:r.deepEffort||'high',verbosity:parseInt(r.verbosity,10)||0,
    chainOfThought:r.cot!==0,useInstructPrompt:r.instruct!==0,tokenizer:r.tokenizer||'tik',instructChatTemplate:r.template||'chatml',
    jinjaTemplate:r.jinja||'',systemContentReplacement:r.sysReplace||'',systemRoleReplacement:r.sysRole||'user',
    assistantPrefill:r.prefill||'',postEndInnerFormat:r.postEnd||'',sendChatAsSystem:r.chatSystem!==0,sendName:r.sendName!==0,
    customChainOfThought:r.cot!==0,maxThoughtTagDepth:felRisuOptionalNumber(r.thoughtDepth),
    jsonSchemaEnabled:r.jsonOn!==0,jsonSchema:r.json||'',strictJsonSchema:r.jsonStrict!==0,extractJson:r.extract||'',
    additionalParams:felRisuAdditionalParams(r.params),applyAdditionalParamsToAll:r.paramsAll!==0,
    modelTools:String(r.tools||'').split(/[,，\n]/).map(function(v){return v.trim();}).filter(Boolean),
    automaticCachePoint:r.autoCache!==0,claudeRetrievalCaching:r.claudeRetrieval!==0,claudeBatching:r.claudeBatch!==0,
    claudeOneHourCaching:r.claudeHour!==0,antiServerOverloads:r.overload!==0,openAIFlexProcessing:r.flex!==0,
    streamGeminiThoughts:r.geminiThoughts!==0};
}
function felRisuRegexScripts(){
  return (SET.rx||[]).filter(function(r){return r&&r.on!==false&&r.find;}).map(function(r){
    return {comment:r.name||'规则',in:r.find,out:r.rep||'',type:r.type||(r.scope===1?'editprocess':'editdisplay'),
      flag:r.flag||'g',ableFlag:!!r.ableFlag};
  });
}
function felRisuPrepare(messages,options){
  return felRisuBoot().then(function(risu){
    var ei=_eraNow()||1,system='',history=[];
    (messages||[]).forEach(function(message){
      if(message.role==='system'&&!system)system=String(message.content||'');
      else history.push({role:message.role,content:String(message.content||''),
        scanContent:message.scanContent==null?undefined:String(message.scanContent),name:message.name,
        memoryIndex:Number.isFinite(message.memoryIndex)?message.memoryIndex:undefined});
    });
    var first=(options&&options.firstMessage!==undefined)?options.firstMessage:
      (felTrOn()?(GAME.opText||''):(((GAME.op&&GAME.op.text)||GAME.opText)||''));
    /* 开场已作为第一条 assistant 进了 history，firstMessage 再带一遍就会在提示里出现两次 */
    if(first&&history.length&&history[0].role==='assistant'&&String(history[0].content||'')===String(first))first='';
    return risu.activateEra(ei,felRisuNpcKeys(ei)).then(function(){
      return risu.setSessionContent({systemPrompt:system,authorNote:FELINIA_AUTHOR_NOTE,firstMessage:first,
        localLore:loreCustomGet().filter(function(e){return e&&e.on!==false;}),
        loreTokenBudget:Math.max(64,Math.round((parseInt(SET.loreBud,10)||20000)*1.1)),
        loreScanDepth:parseInt((SET.risu||{}).loreDepth,10)||5,
        recursiveLoreScanning:(SET.risu||{}).loreRecursive!==0,
        fullWordLoreMatching:(SET.risu||{}).loreFullWord!==0,
        regexScripts:felRisuRegexScripts(),
        defaultVariables:Object.assign({},SET.gvars||{},SET.vars||{})});
    }).then(function(){var sm=SET.semantic||{};return risu.configureMemory({enabled:sm.on!==0,
        mode:sm.mode||'hybrid',apiKey:(sm.mode==='api'?(API.key||''):undefined),
        sessionId:felMemoryId(),budgetChars:sm.budget||3000,topK:sm.topK||8,gpu:sm.gpu!==0});
    }).then(function(){return risu.setHistory(history);}).then(function(){return risu;});
  });
}
function felRisuStart(){
  window.__FEL_RISU_READY__=felRisuBoot().then(function(risu){
    try{if(typeof palaceUiSync==='function')palaceUiSync(true);}catch(_){}
    return risu;
  }).catch(function(e){
    window.__FEL_RISU_ERROR__=(e&&e.message)||String(e);
    throw e;
  });
}
/* [world] 叙事内核在选定纪年后才装入（worldSetEra），不在开页时启动 */
/* —— 浏览器叙事核心 · 韩语原稿 / 中文显示双层管线 ——
   content 永远是模型下一轮会读到的韩语原稿；display 只给 FELINIA 界面、TTS 与
   本地中文状态推演使用。翻译结果绝不写回 content，MVU 控制块由核心逐字保护。
   老存档没有这两个标记时，会在下一次发送前就地升级。 */
function felTrOn(){return !!(SET.trans&&SET.trans.provider&&SET.trans.provider!=='off');}
function felMostlyKorean(text){
  var s=String(text||'').replace(/<mvu_panel>[\s\S]*?<\/mvu_panel>/gi,'');
  var ko=(s.match(/[가-힣]/g)||[]).length,zh=(s.match(/[\u3400-\u9fff]/g)||[]).length;
  return ko>=4&&ko>=zh*.35;
}
function felTrStatus(text,bad){
  var el=$('#trStatus');if(!el)return;
  el.textContent=text||'';el.style.color=bad?'#a74432':'';
}
function felTrCfg(regenerate){
  var t=SET.trans||{};
  return {provider:t.provider||'off',
    deeplKey:t.deeplKey||'',deeplFree:t.deeplFree!==0,
    deeplxUrl:t.deeplxUrl||'http://localhost:1188',deeplxToken:t.deeplxToken||'',
    regenerate:!!regenerate};
}
function felTranslate(text,source,target,regenerate){
  if(!felTrOn()||!text)return Promise.resolve(text);
  return felRisuBoot().then(function(risu){
    if((SET.trans||{}).provider==='llm')return risu.configureProvider(felRisuProvider((SET.sub&&SET.sub.base&&SET.sub.model)?SET.sub:API)).then(function(){return risu;});
    return risu;
  }).then(function(risu){return risu.translate(String(text),source,target,felTrCfg(regenerate));});
}
var FEL_NATIVE_WARM={kozh:0,zhko:0};
function felNativeTranslationWarm(){
  if((SET.trans||{}).provider!=='browser')return;
  if(!window.Translator){felTrStatus('本浏览器不支持本地翻译，生成后会自动使用 Google',0);return;}
  var dir=!FEL_NATIVE_WARM.kozh?{key:'kozh',text:'준비',from:'ko',to:'zh-CN',name:'韩→中'}:
    (!FEL_NATIVE_WARM.zhko?{key:'zhko',text:'准备',from:'zh-CN',to:'ko',name:'中→韩'}:null);
  if(!dir)return;
  FEL_NATIVE_WARM[dir.key]=1;
  felTrStatus('正在准备浏览器本地'+dir.name+'语言包…',0);
  felTranslate(dir.text,dir.from,dir.to).catch(function(){FEL_NATIVE_WARM[dir.key]=0;});
}
addEventListener('felinia-native-translation-status',function(event){
  if((SET.trans||{}).provider!=='browser')return;
  var d=event.detail||{},state=d.state;
  if(state==='ready')felTrStatus('浏览器本地翻译已就绪 · 文本不会离开设备',0);
  else if(state==='downloading'){
    var pc=typeof d.progress==='number'?' '+Math.round(d.progress*100)+'%':'';
    felTrStatus('首次下载浏览器本地语言包'+pc,0);
  }else if(state==='unsupported'||state==='failed')felTrStatus('本地翻译不可用 · 已自动使用 Google',0);
});
/* Chrome requires a fresh user gesture for every new language direction.
   Keep this cheap capture listener so the first two ordinary game clicks warm
   韩→中 and 中→韩 separately; after both caches exist it becomes a no-op. */
addEventListener('pointerdown',felNativeTranslationWarm,{capture:true});
function felCanonicalizeTurns(){
  if(!felTrOn()){
    /* 关闭翻译时不改写旧存档的 content：韩语原稿必须继续留给“重译”和
       “显示原稿”。组装模型历史时另行选用中文 display。 */
    TURNS.forEach(function(t){
      if(!t)return;
      if(t.role==='assistant'){
        t.content=felNormalizeMeowText(t.content);
        if(t.display!=null)t.display=felNormalizeMeowText(t.display);
      }
    });
    return Promise.resolve();
  }
  var chain=Promise.resolve();
  TURNS.forEach(function(t){
    if(t&&t.role==='assistant'){
      t.content=felNormalizeMeowText(t.content);
      if(t.display!=null)t.display=felNormalizeMeowText(t.display);
    }
    if(!t||t.canonical==='ko')return;
    chain=chain.then(function(){
      var original=String(t.content||'');
      if(!original){t.canonical='ko';return;}
      if(felMostlyKorean(original)){t.canonical='ko';return;}
      return felTranslate(original,'zh-CN','ko').then(function(korean){
        if(t.display==null)t.display=original;
        t.content=korean;t.canonical='ko';
      });
    });
  });
  return chain;
}
function felDisplayReply(raw,regenerate){
  raw=String(raw||'');
  if(!felTrOn()||!felMostlyKorean(raw))return Promise.resolve(raw);
  /* 状态块绝不能整坨送进翻译器。Google 会把 <sec_char> 译成 <秒字符>、
     <mvu_panel> 译成 <mvu_面板>，解析器随后认不出它，整张控制块就会漏到正文。
     正文与状态块分开译；状态块只翻含韩文的值，英文标签、中文键名、已有中文值
     和所有竖线逐字保留。即使模型把面板放在正文前面，显示层也统一恢复成正文在前。 */
  var pm=raw.match(/<\s*mvu[_ ]?panel\s*>[\s\S]*?<\s*\/\s*mvu[_ ]?panel\s*>/i);
  var panel=pm?pm[0]:'',ko=stripMvu(raw).trim();
  function protectedKo(s){
    var maps=[];
    (GAME.koNames||[]).forEach(function(p,i){
      if(!p||!p.ko)return;var tok='【FEL_NAME_'+i+'】';
      s=s.split(p.ko).join(tok);maps.push([tok,p.zh||p.ko]);
    });
    [
      ['냐옹♡','喵'],['야옹♡','喵'],['냥♡','喵'],
      ['냐옹~','喵'],['야옹~','喵'],['냥~','喵'],
      ['냐옹','喵'],['야옹','喵'],['냥','喵']
    ].forEach(function(p,i){var tok='【FEL_MEOW_'+i+'】';s=s.split(p[0]).join(tok);maps.push([tok,p[1]]);});
    return {text:s,restore:function(out){
      out=String(out||'');maps.forEach(function(p){
        out=out.split(p[0]).join(p[1]);
        /* Google 偶尔把全角书名括号改成 ASCII 方括号；核心 token 本身没变，
           恢复时两种都认，不能把 [FEL_MEOW_8] 留在玩家正文里。 */
        var core=p[0].replace(/[【】\[\]]/g,''),rx=core.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        out=out.replace(new RegExp('[【\\[]?\\s*'+rx+'\\s*[】\\]]?','g'),p[1]);
      });
      out=felNormalizeMeowText(out);
      if((_eraNow()||99)<=2)out=out.replace(/烤箱|炉子/g,'火塘').replace(/夜视仪/g,'夜里看得清');
      return out;
    }};
  }
  function proseJob(){
    var p=protectedKo(ko);
    return felTranslate(p.text,'ko','zh-CN',regenerate).then(function(out){
      out=p.restore(out).trim();
      /* 韩语连续省略主语时 Google 偶尔把女性 NPC 落成“他/我”。只校正文中的
         叙述段，角色引号里的第一人称原话保持不动。 */
      var qp=out.split(/((?:“[^”\n]*”|"[^"\n]*"|「[^」\n]*」))/g);
      for(var i=0;i<qp.length;i+=2)qp[i]=qp[i].replace(/我的/g,'她的').replace(/他(?!们)/g,'她').replace(/我(?=的|那|这|右|左)/g,'她')
        .replace(/牡蛎的入口处|牡蛎入口/g,'窝棚入口');
      return qp.join('');
    });
  }
  function panelJob(){
    if(!panel)return Promise.resolve('');
    /* 结构从不进入翻译器：按竖线/换行切片，只并发翻译含韩文的字段值，最后
       在浏览器里按原顺序拼回。这样标签、姓名、竖线和换行没有任何被改写的机会。 */
    var bits=panel.match(/[^|\n]+|\||\n/g)||[panel];
    return Promise.all(bits.map(function(bit,bi){
      if(!/[가-힣]/.test(bit))return Promise.resolve(bit);
      var han=[],masked=bit.replace(/[\u3400-\u9fff]+/g,function(x){
        var tok='FELHAN'+bi+'X'+han.length+'X';han.push([tok,x]);return tok;
      });
      var p=protectedKo(masked);
      return felTranslate(p.text,'ko','zh-CN',regenerate).then(function(out){
        out=p.restore(out);han.forEach(function(x){out=out.split(x[0]).join(x[1]);});return out;
      });
    })).then(function(parts){return parts.join('').trim();});
  }
  return Promise.all([proseJob(),panelJob()]).then(function(got){
    var chinese=got[0]+(got[1]?('\n\n'+got[1]):'');
    if(!SET.trans.showRaw)return chinese;
    return '【한국어 원문】\n'+ko+'\n\n【中文译文】\n'+got[0]+(got[1]?'\n\n'+got[1]:'');
  });
}
/* 只重做中文显示层：content 中的韩语原稿、模型历史、状态和剧情一字不动。 */
function felReplaceTurnDisplay(tIdx,display){
  var nr=$('#gNarr'),ops=nr.querySelector('.tOps[data-t="'+tIdx+'"]');
  if(!ops)return false;
  nr.querySelectorAll('p[data-t="'+tIdx+'"]').forEach(function(p){p.remove();});
  var body=felNormalizeMeowText(stripMvu(stripCoT(String(display||'')))),frag=document.createDocumentFragment();
  body.split(/\n{2,}/).forEach(function(par){
    if(!par.trim())return;
    var p=document.createElement('p');p.setAttribute('data-t',tIdx);
    if(felNarrClass(par))p.className='heart';
    p.innerHTML=fmtBody(par);frag.appendChild(p);
  });
  nr.insertBefore(frag,ops);return true;
}
function felRetranslateTurn(tIdx,button){
  if(button&&button.dataset.busy)return;
  var turn=null;
  for(var i=0;i<TURNS.length;i++)if(TURNS[i].role==='assistant'&&+TURNS[i].t===+tIdx){turn=TURNS[i];break;}
  if(!turn){felTrStatus('找不到这一回的韩语原稿',1);return;}
  var oldLabel=button?button.textContent:'↺ 重译';
  if(button){button.dataset.busy='1';button.textContent='翻译中…';button.style.pointerEvents='none';}
  felDisplayReply(turn.content,true).then(function(display){
    return FEL_RISU&&FEL_RISU.processDisplay?FEL_RISU.processDisplay(display):display;
  }).then(function(display){
    turn.display=display;turn.canonical=felTrOn()?'ko':'';
    ensureTurnTranslateOps($('#gNarr'));felReplaceTurnDisplay(tIdx,display);
    try{autoSave(1);}catch(_){}
    felTrStatus(felTrOn()?'已用当前翻译器重新翻译 · 韩语原稿未改':'已恢复显示韩语原稿',0);
    if(button){button.textContent='✓ 已重译';setTimeout(function(){button.textContent=oldLabel;},1600);}
  }).catch(function(err){
    felTrStatus('重新翻译失败，旧译文与韩语原稿均已保留：'+((err&&err.message)||err),1);
    if(button)button.textContent='重译失败';
  }).finally(function(){
    if(button){delete button.dataset.busy;button.style.pointerEvents='';
      if(button.textContent==='重译失败')setTimeout(function(){button.textContent=oldLabel;},2200);}
  });
}
/* 页签切换 */
(function(){
  var tabs=document.querySelectorAll('#cfgTabs span');
  for(var i=0;i<tabs.length;i++)(function(tb){
    tb.addEventListener('click',function(){
      for(var j=0;j<tabs.length;j++)tabs[j].classList.remove('on');
      tb.classList.add('on');
      document.querySelectorAll('.cfgPane').forEach(function(p){p.style.display='none';});
      $('#cp_'+tb.getAttribute('data-cp')).style.display='';
      var k=tb.getAttribute('data-cp');
      if(k==='lore')loreRender();if(k==='rx')rxRender();if(k==='js')jsRender();
      if(k==='preset')preRender();if(k==='mem')memRender();
      if(k==='imgc')imgcRender();if(k==='api')apPaneLoad();if(k==='engine')enginePaneLoad();
    });
  })(tabs[i]);
})();
/* —— 显示：透明度 / 版式 / 字体 —— */
var glassCss=document.createElement('style');document.head.appendChild(glassCss);
function applyGlass(){
  /* [world] 主题「星图上的羊皮纸」：拉杆仍是面板透明度，但框架层（台底、输入条、
     情报窗）压的是深空，阅读层（抽屉、弹窗、档案夹、卡片）压的是羊皮纸。 */
  var a=SET.glass/100,SKY='5,7,12',GLS='13,18,32',VEL='236,227,205',ENA='18,31,25';
  glassCss.textContent='#game::before{background:radial-gradient(ellipse 90% 80% at 50% 42%,'
    +'transparent 50%,rgba(0,0,0,'+(.30+.40*a).toFixed(2)+') 100%) !important}'
    +'#game .gMfd{background-color:rgba('+SKY+','+(.16+.30*a).toFixed(2)+') !important}'
    +'#game .gInput{background:linear-gradient(0deg,rgba('+SKY+','+(.62+.34*a).toFixed(2)+') 0%,rgba('+SKY+','+(.40+.34*a).toFixed(2)+') 42%,rgba('+SKY+',0) 76%) !important}'
    +'.gPanel,#pnTx{background-color:rgba('+GLS+','+(.20+.40*a).toFixed(2)+') !important}'
    +'#game #pnMap,#game #pnArm,#game #pnShop'
    +'{background-color:rgba('+ENA+','+(.80+.18*a).toFixed(2)+') !important}'
    +'.gMfd.mvDeck .mvWin{background-color:rgba('+ENA+','+(.46+.32*a).toFixed(2)+') !important}'
    +'.feGl{background-color:rgba('+ENA+','+(.62+.24*a).toFixed(2)+') !important}'
    +'#feWrap[data-step="loc"] .feGl'
    +'{background-color:rgba('+ENA+','+(.68+.24*a).toFixed(2)+') !important}'
    +'#game .gNarr{background-color:rgba('+ENA+','+(.42+.34*a).toFixed(2)+') !important}'
    +'@media (max-width:860px){'
    +'.feGl{background-color:rgba('+ENA+','+(.50+.26*a).toFixed(2)+') !important}'
    +'#feWrap[data-step="loc"] .feGl'
    +'{background-color:rgba('+ENA+','+(.56+.26*a).toFixed(2)+') !important}'
    +'}'
    +'#game.txBig #pnTx{background-color:rgba('+SKY+','+(.28+.18*a).toFixed(2)+') !important}'
    +'@media (min-width:761px){'
    +'#game.txBig .gMfd.mvDeck .mvWin{background-color:rgba('+ENA+','+(.66+.26*a).toFixed(2)+') !important}'
    +'#game.txBig .gMfd.mvDeck .mvCard .cfr{background-color:rgba('+ENA+','+(.66+.26*a).toFixed(2)+') !important}'
    +'}'
    +'.gDlg .box,#eraBox .box,#persona .box,#psRes .box,.fd-win,.svFold,.svFold .tab,#game .gmMenu'
    +'{background-color:rgba('+ENA+','+(.84+.14*a).toFixed(2)+') !important}'
    +'@media (max-width:760px){'
    +'#game .gPanel{background-color:rgba('+GLS+','+(.50+.30*a).toFixed(2)+') !important}'
    +'#game .gMfd.mvDeck .mvWin{background-color:rgba('+ENA+',.92) !important;'
    +'-webkit-backdrop-filter:none !important;backdrop-filter:none !important}'
    +'}';
}
applyGlass();
/* 帧时表：网址后面加 ?perf=1 就出现，平时一行代码都不跑。
   报三个数：帧率、最近半秒里最长的一帧、超过 50 毫秒的帧数。
   卡不卡看的是后两个——平均帧率好看而偶尔一帧两百毫秒，手上就是一顿一顿的。 */
/* 诊断板：网址加 ?diag=1，右上角出一块开关板。
   逐项关掉可疑的渲染开销——哪一项一关就不卡了，凶手就是哪一项。
   板子只在带参数时存在，一行不带参数的代码都不跑，默认画面一个字节不动。
   板子用纯灰阶配色：整页反色开着关着它都读得清，自己不用挂滤镜。 */
if(/[?&]diag=1/.test(location.search))(function(){
  var KILL={
    glass:'body *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
    blend:'body *,body *::before,body *::after{mix-blend-mode:normal!important}'
         +'html.lux::after{display:none!important}',
    filt:'body *{filter:none!important}',
    shadow:'body *{box-shadow:none!important;text-shadow:none!important}',
    mask:'body *{-webkit-mask-image:none!important;mask-image:none!important}',
    anim:'body *{animation:none!important;transition:none!important}',
    cv:'canvas{visibility:hidden!important}'
  };
  function setK(k,on){                     /* on=true＝这一项照常 */
    if(k==='lux'){document.documentElement.classList.toggle('lux',!!on);return;}
    var id='diagK_'+k,el=document.getElementById(id);
    if(on){if(el)el.remove();return;}
    if(!el){var st=document.createElement('style');st.id=id;
      st.textContent=KILL[k];document.head.appendChild(st);}
  }
  var LBL=[['lux','整页反色（奶油那一道）'],['glass','毛玻璃'],['blend','混合层（暖纸/纹理）'],
           ['filt','元素滤镜'],['shadow','阴影'],['mask','撕边遮罩'],
           ['anim','动画与过渡'],['cv','全部画布']];
  var box=document.createElement('div');box.id='diagBox';
  box.style.cssText='position:fixed;right:10px;top:10px;z-index:2147483647;'
    +'background:rgba(0,0,0,.85);color:#e8e8e8;border:1px solid #777;'
    +'font:12px/2 ui-monospace,Menlo,monospace;padding:8px 12px;user-select:none';
  var fps=document.createElement('div');
  fps.style.cssText='border-bottom:1px solid #555;margin-bottom:4px;padding-bottom:2px';
  fps.textContent='…';box.appendChild(fps);
  LBL.forEach(function(pair){
    var row=document.createElement('label');
    row.style.cssText='display:block;cursor:pointer';
    var cb=document.createElement('input');cb.type='checkbox';cb.checked=true;
    cb.style.cssText='margin-right:7px;vertical-align:-2px';
    cb.addEventListener('change',function(){setK(pair[0],cb.checked);});
    row.appendChild(cb);row.appendChild(document.createTextNode(pair[1]));
    row._cb=cb;row._k=pair[0];box.appendChild(row);
  });
  var bar=document.createElement('div');
  bar.style.cssText='margin-top:5px;display:flex;gap:8px';
  [['全关',false],['全开',true]].forEach(function(bp){
    var bt=document.createElement('button');bt.textContent=bp[0];
    bt.style.cssText='flex:1;background:#222;color:#e8e8e8;border:1px solid #777;'
      +'font:inherit;padding:1px 0;cursor:pointer';
    bt.addEventListener('click',function(){
      box.querySelectorAll('label').forEach(function(row){
        if(row._cb){row._cb.checked=bp[1];setK(row._k,bp[1]);}});
    });
    bar.appendChild(bt);
  });
  box.appendChild(bar);
  document.body.appendChild(box);
  var last=performance.now(),acc=[],t0=last;
  (function tick(){
    var t=performance.now();acc.push(t-last);last=t;
    if(t-t0>=500){
      var n=acc.length,sum=0,worst=0,i;
      for(i=0;i<n;i++){sum+=acc[i];if(acc[i]>worst)worst=acc[i];}
      fps.textContent=(1000/(sum/n)).toFixed(0)+' fps · 最长一帧 '+worst.toFixed(0)+' ms';
      acc=[];t0=t;
    }
    requestAnimationFrame(tick);
  })();
})();
if(/[?&]perf=1/.test(location.search))(function(){
  var el=document.createElement('div');
  el.id='perfHud';
  el.style.cssText='position:fixed;left:8px;top:8px;z-index:2147483646;pointer-events:none;'
    +'font:11px/1.5 ui-monospace,Menlo,monospace;color:#0f0;background:rgba(0,0,0,.75);'
    +'padding:5px 8px;white-space:pre';
  document.body.appendChild(el);
  var last=performance.now(),acc=[],t0=last;
  (function tick(){
    var t=performance.now();acc.push(t-last);last=t;
    if(t-t0>=500){
      var n=acc.length,sum=0,worst=0,over=0,i;
      for(i=0;i<n;i++){sum+=acc[i];if(acc[i]>worst)worst=acc[i];if(acc[i]>50)over++;}
      var scr='菜单';
      try{scr=GAME.on?'对局屏':(ES.on?'纪年页':((typeof feIsOpen==='function'&&feIsOpen())?'铸局':'菜单'));}catch(_){}
      el.textContent=[scr+'  '+(1000/(sum/n)).toFixed(0)+' fps',
                      '最长一帧 '+worst.toFixed(0)+' ms',
                      '>50ms  '+over+' 帧/半秒'].join(String.fromCharCode(10));
      acc=[];t0=t;
    }
    requestAnimationFrame(tick);
  })();
})();
/* 拉条走过的那一段是用背景渐变画的，分界点存在 --rv 里；这里统一喂值。
   捕获期监听盖住全站所有 range（含三维营造台里现搭的那几条），
   再定期补一遍——有些条的值是程序改的，不经过 input 事件。 */
(function(){
  function rv(el){
    var mn=parseFloat(el.min)||0,mx=(el.max===''?100:parseFloat(el.max)),v=parseFloat(el.value)||0;
    el.style.setProperty('--rv',(mx>mn?Math.max(0,Math.min(1,(v-mn)/(mx-mn))):0).toFixed(4));
  }
  function all(){try{var L=document.querySelectorAll('input[type=range]');for(var i=0;i<L.length;i++)rv(L[i]);}catch(_){}}
  function hit(e){if(e.target&&e.target.tagName==='INPUT'&&e.target.type==='range')rv(e.target);}
  document.addEventListener('input',hit,true);
  document.addEventListener('change',hit,true);
  all();ivl(all,1200);
})();
$('#cfgGlass').value=SET.glass;
var glassRaf=0;
$('#cfgGlass').addEventListener('input',function(){SET.glass=+this.value;
  if(!glassRaf)glassRaf=requestAnimationFrame(function(){glassRaf=0;applyGlass();setStore();});});
var formaCss=document.createElement('style');document.head.appendChild(formaCss);
function applyForma(){
  if(SET.forma===1)formaCss.textContent='@media(max-width:760px){#game .gMain{left:64px;right:322px;bottom:0}#game .gMfd{display:block}.gRail{display:flex}.gNav{display:none}}';
  else if(SET.forma===2)formaCss.textContent='#game .gMain{left:0;right:0;bottom:0}#game .gMfd{display:none;left:0;right:0;width:auto;bottom:0;padding-bottom:40px;border-left:0}.gRail{display:none}.gPanel{display:none;transform:none;transition:none;width:auto;left:0;right:0;opacity:1;pointer-events:auto;border:0;border-radius:0;box-shadow:none}.gNav{display:flex;position:absolute;left:50%;transform:translateX(-50%);bottom:5px;height:24px;z-index:40;border:1px solid rgba(19,18,13,.22);background:rgba(237,231,217,.72);-webkit-backdrop-filter:blur(14px) saturate(150%);backdrop-filter:blur(14px) saturate(150%);touch-action:pan-x}.gNav span{display:flex;align-items:center;padding:0 15px;color:var(--mut);cursor:pointer}.gNav span b{display:none}.gNav span svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:square;stroke-linejoin:miter;display:block}.gNav span.on{color:#e9e3d6;background:var(--gold)}#game[data-pg=map] #pnMap{display:block;transform:none;top:46px;bottom:auto;height:calc((100dvh - 80px)*.52);width:100%}#game[data-pg=map] #pnArm{display:block;transform:none;top:calc(46px + (100dvh - 80px)*.52);bottom:0;padding-bottom:40px;width:100%;border-top:1px solid rgba(19,18,13,.16);overflow-y:auto}#pnArm::before{content:\'\';position:absolute;left:0;right:0;top:0;height:62px;z-index:2;pointer-events:none;background:linear-gradient(180deg,rgba(237,231,217,.92) 0%,rgba(237,231,217,.62) 46%,rgba(237,231,217,0) 100%);-webkit-backdrop-filter:blur(10px) saturate(140%);backdrop-filter:blur(10px) saturate(140%);-webkit-mask-image:linear-gradient(180deg,#f2ecde 44%,transparent 100%);mask-image:linear-gradient(180deg,#f2ecde 44%,transparent 100%)}#game[data-pg=mfd] .gMfd{display:block;top:46px;bottom:0;padding-bottom:40px}#game[data-pg=shop] #pnShop{display:block;transform:none;top:46px;bottom:0;width:100%}#game[data-pg=shop] .shWrap{padding-bottom:44px}#game[data-pg=map] .gMain,#game[data-pg=mfd] .gMain,#game[data-pg=shop] .gMain{display:none}';
  else formaCss.textContent='';
}
applyForma();setSeg('#sgForma',SET.forma);
setSeg('#sgMvu',SET.mvuRing);try{mvRingMount();}catch(_){}
var faceCss=document.createElement('style');document.head.appendChild(faceCss);
function applyFace(){
  var fam=['','Georgia,\"Times New Roman\",serif','system-ui,sans-serif'][SET.face]||'';
  faceCss.textContent=fam?('#game .gNarr,#gNarr p{font-family:'+fam+' !important}'):'';
  try{
    var cf=localStorage.getItem('guardianDragonFont');
    if(cf){
      if(applyFace._loaded===cf.length){
        faceCss.textContent='#game .gNarr,#gNarr p{font-family:RomeCustom !important}';
      }else{
        var ff=new FontFace('RomeCustom','url('+cf+')');
        ff.load().then(function(f){document.fonts.add(f);applyFace._loaded=cf.length;
          faceCss.textContent='#game .gNarr,#gNarr p{font-family:RomeCustom !important}';});
      }
    }
  }catch(_){}
}
applyFace();setSeg('#sgFace',SET.face);
$('#fontUp').addEventListener('click',function(){$('#fontFile').click();});
$('#fontFile').addEventListener('change',function(){
  var f=this.files[0];if(!f)return;
  if(f.size>3.5e6){$('#dispMsg').textContent='字体超过 3.5MB，建议 woff2';return;}
  var rd=new FileReader();
  rd.onload=function(){
    try{localStorage.setItem('guardianDragonFont',rd.result);applyFace();
      $('#dispMsg').textContent='已载入自定义字体：'+f.name;}
    catch(_){$('#dispMsg').textContent='本机存储放不下这个字体';}
  };
  rd.readAsDataURL(f);this.value='';
});
/* —— 声·语音 —— */
function ttsLoad(){
  var t=SET.tts;
  $('#ttsBase').value=t.base;$('#ttsKey').value=t.key;$('#ttsModel').value=t.model;
  $('#ttsVoice').value=t.voice;$('#ttsRate').value=t.rate;
  setSeg('#sgTtsSrc',t.src);setSeg('#sgTtsScope',t.scope);setSeg('#sgTtsAuto',t.auto);
}
ttsLoad();
['ttsBase','ttsKey','ttsModel','ttsVoice'].forEach(function(id){
  $('#'+id).addEventListener('input',function(){
    SET.tts[id.slice(3).toLowerCase()]=this.value.trim();setStore();});
});
$('#ttsRate').addEventListener('input',function(){SET.tts.rate=+this.value;setStore();});
function ttsScopeText(text){
  if(SET.tts.scope===1){var q=text.match(/「[^」]*」/g);return q?q.join('。'):'';}
  if(SET.tts.scope===2)return text.replace(/「[^」]*」/g,'');
  return text;
}
var ttsAudio=null;
function speakText(text){
  text=ttsScopeText(stripMvu(text)).slice(0,2200);
  if(!text)return;
  if(SET.tts.src===1&&SET.tts.base){
    fetch(SET.tts.base.replace(/\/+$/,'')+'/audio/speech',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+SET.tts.key},
      body:JSON.stringify({model:SET.tts.model||'tts-1',voice:SET.tts.voice||'alloy',
        input:text,speed:SET.tts.rate/100})})
    .then(function(r){if(!r.ok)throw 0;return r.blob();})
    .then(function(b){
      if(ttsAudio){ttsAudio.pause();
        if(ttsAudio.src&&ttsAudio.src.indexOf('blob:')===0)try{URL.revokeObjectURL(ttsAudio.src);}catch(_){}}
      var u2=URL.createObjectURL(b);
      ttsAudio=new Audio(u2);
      ttsAudio.onended=function(){try{URL.revokeObjectURL(u2);}catch(_){}};
      ttsAudio.play();})
    .catch(function(){narrAdd('sys','语音接口不通，回退浏览器&nbsp;TTS',null);browserSpeak(text);});
  }else browserSpeak(text);
}
function browserSpeak(text){
  if(!window.speechSynthesis)return;
  speechSynthesis.cancel();
  var u=new SpeechSynthesisUtterance(text);u.lang='zh-CN';u.rate=SET.tts.rate/100;
  if(SET.tts.voice){
    var vs=speechSynthesis.getVoices();
    for(var i=0;i<vs.length;i++)if(vs[i].name.indexOf(SET.tts.voice)>=0){u.voice=vs[i];break;}
  }
  speechSynthesis.speak(u);
}
$('#ttsTry').addEventListener('click',function(){speakText('元老院与罗马人民。这是一段试听。');});
$('#ttsStop').addEventListener('click',function(){
  if(window.speechSynthesis)speechSynthesis.cancel();
  if(ttsAudio)ttsAudio.pause();
});
/* —— 图·生图 + 缓·图库 —— */
/* —— 图·生图：五后端（OpenAI兼容/NovelAI/SD·A1111/ComfyUI/自定义） —— */
(function(){var d={on:0,auto:0,count:0,cam:0,disp:2,style:0,base:'',key:'',model:'',
  workflow:'',steps:'',cfg:'',w:'',h:'',seed:'',ilore:[]};
  Object.keys(d).forEach(function(k){if(SET.img[k]==null)SET.img[k]=d[k];});})();
var NAI_MODELS=['nai-diffusion-4-5-full','nai-diffusion-4-5-curated','nai-diffusion-4-full','nai-diffusion-3'];
var CAM_PROMPT=['','cinematic film still, dramatic lighting, ','detailed illustration, clean lineart, ','classical oil painting, chiaroscuro, ','first person POV shot, ','photorealistic, 35mm photo, '];
var NAI_WORKER_CODE="const UPSTREAM='https://image.novelai.net';\nexport default {\n  async fetch(request){\n    const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, content-type','Access-Control-Max-Age':'86400'};\n    if(request.method==='OPTIONS')return new Response(null,{headers:cors});\n    if(request.method!=='POST')return new Response('NovelAI proxy is running. Point the game here.',{headers:cors});\n    const url=new URL(request.url);\n    try{\n      const upstream=await fetch(UPSTREAM+url.pathname+url.search,{method:'POST',headers:{'authorization':request.headers.get('authorization')||'','content-type':request.headers.get('content-type')||'application/json','accept':'application/x-zip-compressed'},body:await request.arrayBuffer()});\n      const buf=await upstream.arrayBuffer();\n      return new Response(buf,{status:upstream.status,headers:{...cors,'content-type':upstream.headers.get('content-type')||'application/octet-stream'}});\n    }catch(e){\n      return new Response('proxy error: '+((e&&e.message)||String(e)),{status:502,headers:cors});\n    }\n  }\n};";
/* 接口风格序号 —— NovelAI 打头（本作最常用的一档，预设即选它）。
   段落是按位序取值的，序号改了就得跟著改，所以在这里具名一次，别再散落魔数。 */
var IMGSTY={nai:0,oai:1,sd:2,comfy:3,custom:4};
function imgDefaults(style){
  return [{steps:'28',cfg:'5',w:'832',h:'1216'},      /* NovelAI */
          {steps:'',cfg:'',w:'1024',h:'1024'},        /* OpenAI 兼容 */
          {steps:'28',cfg:'7',w:'896',h:'1152'},      /* SD · A1111 */
          {steps:'25',cfg:'6.5',w:'1024',h:'1024'},   /* ComfyUI */
          {steps:'',cfg:'',w:'',h:''}][style]||{};    /* 自定义 JSON */
}
function imgStyleShow(){
  $('#imgNaiHelp').style.display=SET.img.style===IMGSTY.nai?'':'none';
  $('#imgComfyHelp').style.display=SET.img.style===IMGSTY.comfy?'':'none';
}
function imgLoad(){
  var g=SET.img;
  $('#imgBase').value=g.base;$('#imgKey').value=g.key;$('#imgModel').value=g.model;
  $('#imgSteps').value=g.steps;$('#imgCfg').value=g.cfg;
  $('#imgW').value=g.w;$('#imgH').value=g.h;$('#imgSeed').value=g.seed;
  $('#imgWorkflow').value=g.workflow||'';
  $('#imgWorkerTa').value=NAI_WORKER_CODE;
  setSeg('#sgImgOn',g.on);setSeg('#sgImgAuto',g.auto);setSeg('#sgImgCount',g.count);
  setSeg('#sgImgCam',g.cam);setSeg('#sgImgDisp',g.disp);setSeg('#sgImgStyle',g.style);
  var ni=NAI_MODELS.indexOf(g.model);setSeg('#sgNaiModel',ni<0?0:ni);
  imgStyleShow();iloreRender();
}
/* 接口风格改成 NovelAI 打头后 0 与 1 对调了。老配置存的是旧序号，
   照搬会把原本选 NovelAI 的人默默切到 OpenAI 去，所以迁移一次并打标记。 */
if(SET.imgSty!==2){
  /* 判据要看「存档里原本写了什么」，不能看 SET.img.style——后者已经带上新的预设值 0，
     照它判会把全新用户当成旧的 OpenAI 使用者又换回去。没存过就是新人，留在 NovelAI。 */
  var _os=(_s&&_s.img)?_s.img.style:undefined;
  SET.img.style=(typeof _os==='number')?(_os===0?1:(_os===1?0:_os)):0;
  /* 新用户落在 NovelAI 上，顺手把该接口的推荐采样填好，开箱就能出图；
     已经填过参数的一概不碰。模型栏空著会让 UI 显示 V4.5 而请求悄悄退回 V3，一并对齐。 */
  if(!SET.img.steps&&!SET.img.w){
    var _d=imgDefaults(SET.img.style);
    SET.img.steps=_d.steps;SET.img.cfg=_d.cfg;SET.img.w=_d.w;SET.img.h=_d.h;
  }
  if(SET.img.style===0&&!SET.img.model)SET.img.model=NAI_MODELS[0];
  SET.imgSty=2;setStore();
}
imgLoad();
[['imgBase','base'],['imgKey','key'],['imgModel','model'],['imgSteps','steps'],
 ['imgCfg','cfg'],['imgW','w'],['imgH','h'],['imgSeed','seed'],['imgWorkflow','workflow']]
.forEach(function(p){
  $('#'+p[0]).addEventListener('input',function(){SET.img[p[1]]=this.value.trim();setStore();});
});
$('#imgDefBtn').addEventListener('click',function(){
  var d=imgDefaults(SET.img.style);
  SET.img.steps=d.steps;SET.img.cfg=d.cfg;SET.img.w=d.w;SET.img.h=d.h;
  setStore();imgLoad();$('#imgMsg').textContent='已套用推荐默认';
});
$('#imgCopyWorker').addEventListener('click',function(){
  var ta=$('#imgWorkerTa');ta.value=NAI_WORKER_CODE;
  if(navigator.clipboard)navigator.clipboard.writeText(NAI_WORKER_CODE);
  ta.select();try{document.execCommand('copy');}catch(_){}
  $('#imgMsg').textContent='中转代码已复制';
});
function naiCompose(){
  var n=$('#naiWkName').value.trim()||'nai-proxy',sub=$('#naiWkSub').value.trim();
  if(!sub)return;
  SET.img.base='https://'+n+'.'+sub+'.workers.dev';
  $('#imgBase').value=SET.img.base;setStore();
}
$('#naiWkName').addEventListener('input',naiCompose);
$('#naiWkSub').addEventListener('input',naiCompose);
$('#comfyPull').addEventListener('click',function(){
  var base=(SET.img.base||'').replace(/\/+$/,'');
  if(!base){$('#imgMsg').textContent='先填接口地址';return;}
  fetch(base+'/object_info/CheckpointLoaderSimple')
  .then(function(r){return r.json();})
  .then(function(d){
    var list=d.CheckpointLoaderSimple.input.required.ckpt_name[0]||[];
    var sel=$('#comfyModels');sel.innerHTML='';sel.style.display='';
    list.forEach(function(m){var o=document.createElement('option');o.value=o.textContent=m;sel.appendChild(o);});
    $('#imgMsg').textContent='拉到 '+list.length+' 个模型';
  }).catch(function(e){$('#imgMsg').textContent='拉取失败：'+(e&&e.message||e);});
});
$('#comfyModels').addEventListener('change',function(){
  SET.img.model=this.value;$('#imgModel').value=this.value;setStore();
});
/* 生图世界书 */
function iloreRender(){
  var host=$('#iloreList');host.innerHTML='';
  (SET.img.ilore||[]).forEach(function(e,i){
    var d=document.createElement('div');d.className='lRow'+(e.on===false?' off':'');
    d.innerHTML='<b>'+esc2(e.k||'（常驻）')+'</b><span style="flex:1">'+esc2(e.f)+'</span>'
      +'<span class="op" data-a="t">'+(e.on===false?'停':'启')+'</span>'
      +'<span class="op" data-a="d" style="color:#ff7f63">删</span>';
    d.querySelector('[data-a=t]').addEventListener('click',function(){e.on=e.on===false;setStore();iloreRender();});
    d.querySelector('[data-a=d]').addEventListener('click',function(){SET.img.ilore.splice(i,1);setStore();iloreRender();});
    host.appendChild(d);
  });
}
function iloreArr(){return SET.img.ilore||(SET.img.ilore=[]);}  /* 老配置的 img 里没这个键，取用前补上 */
$('#ilAdd').addEventListener('click',function(){
  var f=$('#ilFrag').value.trim();if(!f)return;
  iloreArr().push({k:$('#ilKeys').value.trim(),f:f,on:true});
  $('#ilKeys').value='';$('#ilFrag').value='';setStore();iloreRender();
});
/* 导入：吃三种东西——本栏自己的导出档、ST 世界书、一行一条的纯文本 */
function iloreParse(txt){
  var out=[];
  function push(k,f,on){
    f=String(f==null?'':f).trim();if(!f)return;
    if(Array.isArray(k))k=k.join('、');
    out.push({k:String(k==null?'':k).trim(),f:f,on:on!==false});
  }
  var j=null;try{j=JSON.parse(txt);}catch(_){}
  if(j&&typeof j==='object'){
    var list=Array.isArray(j)?j:(j.ilore||j.entries||j.lorebook||j.data||null);
    if(list&&!Array.isArray(list))list=Object.keys(list).map(function(k){return list[k];});
    if(list){
      list.forEach(function(e){
        if(typeof e==='string'){push('',e,true);return;}
        if(!e||typeof e!=='object')return;
        push(e.k!=null?e.k:(e.keys||e.key||e.keywords||''),
             e.f!=null?e.f:(e.content||e.frag||e.prompt||e.value||''),
             e.on!==false&&e.enabled!==false&&!e.disable);
      });
    }else Object.keys(j).forEach(function(k){if(typeof j[k]==='string')push(k,j[k],true);});
  }else{
    txt.split(/\r?\n/).forEach(function(ln){
      ln=ln.trim();if(!ln||ln.charAt(0)==='#')return;
      /* 「触发词：片段」——但英文片段里的冒号（如网址、权重写法）不能误切，
         所以只认短且不含逗号的左半边当触发词，其余整行都是片段 */
      var m=ln.match(/^(.+?)\s*[:：]\s*(.+)$/);
      if(m&&m[1].length<=40&&m[1].indexOf(',')<0&&m[1].indexOf('，')<0&&m[2].indexOf('//')!==0)push(m[1],m[2],true);
      else push('',ln,true);
    });
  }
  return out;
}
$('#ilImp').addEventListener('click',function(){$('#ilFile').click();});
$('#ilFile').addEventListener('change',function(){
  var f=this.files[0];if(!f)return;
  var rd=new FileReader();
  rd.onload=function(){
    var got=iloreParse(String(rd.result||''));
    if(!got.length){$('#ilMsg').textContent='没读到可用条目';return;}
    var arr=iloreArr(),seen={},add=0;
    arr.forEach(function(e){seen[(e.k||'')+' '+e.f]=1;});
    got.forEach(function(e){
      var kk=(e.k||'')+' '+e.f;
      if(seen[kk])return;seen[kk]=1;arr.push(e);add++;
    });
    setStore();iloreRender();
    $('#ilMsg').textContent='汇入 '+add+' 条'+(got.length>add?('（跳过 '+(got.length-add)+' 条重复）'):'');
  };
  rd.readAsText(f);this.value='';
});
$('#ilExp').addEventListener('click',function(){
  var b=new Blob([JSON.stringify(iloreArr(),null,1)],{type:'application/json'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='roma_img_lore.json';a.click();
  $('#ilMsg').textContent='已导出 '+iloreArr().length+' 条';
});
/* zip 解压（NAI 返回 zip；store 直取，deflate 走 DecompressionStream） */
function unzipFirstPNG(buf,cb,err){
  var u=new Uint8Array(buf);
  if(!(u[0]===0x50&&u[1]===0x4b)){cb(buf);return;}   /* 不是 zip，可能直接是图 */
  var p=0;
  while(p<u.length-4){
    if(u[p]===0x50&&u[p+1]===0x4b&&u[p+2]===3&&u[p+3]===4){
      var method=u[p+8]|(u[p+9]<<8);
      var csz=u[p+18]|(u[p+19]<<8)|(u[p+20]<<16)|(u[p+21]<<24);
      var nlen=u[p+26]|(u[p+27]<<8),elen=u[p+28]|(u[p+29]<<8);
      var data=u.slice(p+30+nlen+elen,p+30+nlen+elen+csz);
      if(method===0){cb(data.buffer);return;}
      if(method===8&&window.DecompressionStream){
        new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')))
          .arrayBuffer().then(cb).catch(err);
        return;
      }
      err('zip 压缩方式不支援');return;
    }
    p++;
  }
  err('zip 内无文件');
}
function bufToDataUrl(buf,cb){
  var b=new Blob([buf],{type:'image/png'});
  var rd=new FileReader();rd.onload=function(){cb(rd.result);};rd.readAsDataURL(b);
}
/* 提示词组装：镜头前缀 + 场景 + 生图世界书片段 */
function imgPromptBase(sceneText){
  /* 命中关键词的片段排前面，没有关键词的通用片段垫后。
     原来「没写关键词就无条件全量拼」，纯文本导入的世界书（每一行的关键词都是空的）
     会把上百条一股脑倒进 prompt，实测单次四千多字——NovelAI/SD 直接截断或报错。 */
  var hitF=[],anyF=[];
  (SET.img.ilore||[]).forEach(function(e){
    if(!e||e.on===false||!e.f)return;
    if(!e.k){anyF.push(e.f);return;}
    var ks=String(e.k).split(/[、,，]/);
    for(var i=0;i<ks.length;i++)if(ks[i]&&sceneText.indexOf(ks[i])>=0){hitF.push(e.f);return;}
  });
  var frags=[],used=0;
  hitF.concat(anyF).forEach(function(f){
    if(frags.length>=12||used+f.length>600)return;
    frags.push(f);used+=f.length;
  });
  /* 世界基调原来写死 ancient Roman world：玩周纪的人每一张配图都被画成古罗马，
     而面板上找不到任何可以改掉它的开关。 */
  var wb='medieval Mongol empire, endless steppe and desert, felt ger camps, banners in the wind';
  return CAM_PROMPT[SET.img.cam]+wb+', dark gold cinematic aesthetic, '
    +frags.join(', ')+(frags.length?', ':'');
}
function genOne(prompt,seed,cb,err){
  var g=SET.img,base=(g.base||'').replace(/\/+$/,'');
  var W=+g.w||1024,H=+g.h||1024,steps=+g.steps||28,cfg=+g.cfg||7;
  if(seed==null||seed===''||+seed<0)seed=Math.floor(Math.random()*1e9);
  if(g.style===IMGSTY.oai){        /* OpenAI 兼容 */
    fetch(base+'/images/generations',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+g.key},
      body:JSON.stringify({model:g.model,prompt:prompt,n:1,size:W+'x'+H,response_format:'b64_json'})})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(d){var b=d.data&&d.data[0];
      cb(b.b64_json?('data:image/png;base64,'+b.b64_json):b.url);})
    .catch(function(e){err(e&&e.message||e);});
  }else if(g.style===IMGSTY.nai){  /* NovelAI（经中转） */
    var v3=g.model==='nai-diffusion-3';
    var params={width:W,height:H,scale:cfg,steps:steps,seed:+seed,n_samples:1,
      sampler:'k_euler_ancestral',qualityToggle:true,params_version:v3?1:3,
      negative_prompt:'lowres, bad quality'};
    if(!v3){params.v4_prompt={caption:{base_caption:prompt,char_captions:[]},use_coords:false,use_order:true};
            params.v4_negative_prompt={caption:{base_caption:'lowres, bad quality',char_captions:[]}};}
    fetch(base+'/ai/generate-image',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+g.key},
      body:JSON.stringify({input:prompt,model:g.model||'nai-diffusion-3',action:'generate',parameters:params})})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.arrayBuffer();})
    .then(function(buf){unzipFirstPNG(buf,function(png){bufToDataUrl(png,cb);},err);})
    .catch(function(e){err(e&&e.message||e);});
  }else if(g.style===IMGSTY.sd){   /* SD · A1111 */
    fetch(base+'/sdapi/v1/txt2img',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({prompt:prompt,negative_prompt:'lowres, bad quality',
        steps:steps,cfg_scale:cfg,width:W,height:H,seed:+seed})})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(d){cb('data:image/png;base64,'+d.images[0]);})
    .catch(function(e){err(e&&e.message||e);});
  }else if(g.style===IMGSTY.comfy){/* ComfyUI */
    var graph;
    if(g.workflow){
      try{graph=JSON.parse(g.workflow
        .replace(/%prompt%/g,prompt.replace(/"/g,''))
        .replace(/%negative%/g,'lowres, bad quality')
        .replace(/%seed%/g,String(seed)).replace(/%steps%/g,String(steps))
        .replace(/%cfg%/g,String(cfg)).replace(/%width%/g,String(W))
        .replace(/%height%/g,String(H)).replace(/%ckpt%/g,g.model));}
      catch(_){err('工作流 JSON 解析失败');return;}
    }else{
      graph={'1':{class_type:'CheckpointLoaderSimple',inputs:{ckpt_name:g.model}},
        '2':{class_type:'CLIPTextEncode',inputs:{text:prompt,clip:['1',1]}},
        '3':{class_type:'CLIPTextEncode',inputs:{text:'lowres, bad quality',clip:['1',1]}},
        '4':{class_type:'EmptyLatentImage',inputs:{width:W,height:H,batch_size:1}},
        '5':{class_type:'KSampler',inputs:{model:['1',0],positive:['2',0],negative:['3',0],
          latent_image:['4',0],seed:+seed,steps:steps,cfg:cfg,sampler_name:'euler_ancestral',
          scheduler:'normal',denoise:1}},
        '6':{class_type:'VAEDecode',inputs:{samples:['5',0],vae:['1',2]}},
        '7':{class_type:'SaveImage',inputs:{images:['6',0],filename_prefix:'luzhi'}}};
    }
    fetch(base+'/prompt',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({prompt:graph})})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(d){
      var pid=d.prompt_id,tries=0;
      (function poll(){
        if(++tries>90){err('ComfyUI 超时');return;}
        fetch(base+'/history/'+pid).then(function(r){return r.json();})
        .then(function(h){
          var o=h[pid]&&h[pid].outputs;
          if(!o){setTimeout(poll,1500);return;}
          for(var k in o)if(o[k].images&&o[k].images.length){
            var im=o[k].images[0];
            cb(base+'/view?filename='+encodeURIComponent(im.filename)
              +'&subfolder='+encodeURIComponent(im.subfolder||'')+'&type='+(im.type||'output'));
            return;
          }
          setTimeout(poll,1500);
        }).catch(function(){setTimeout(poll,1500);});
      })();
    }).catch(function(e){err(e&&e.message||e);});
  }else{                    /* 自定义 JSON */
    var body=g.workflow||'{"prompt":"%prompt%","seed":%seed%}';
    body=body.replace(/%prompt%/g,prompt.replace(/"/g,''))
      .replace(/%seed%/g,String(seed)).replace(/%steps%/g,String(steps))
      .replace(/%cfg%/g,String(cfg)).replace(/%width%/g,String(W)).replace(/%height%/g,String(H));
    fetch(base,{method:'POST',headers:{'Content-Type':'application/json',
      'Authorization':g.key?('Bearer '+g.key):''},body:body})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(d){
      var u=(d.images&&d.images[0])||(d.data&&d.data[0]&&(d.data[0].b64_json||d.data[0].url))||d.image||d.url;
      if(!u)throw new Error('未找到图片字段');
      cb(u.length>200&&u.indexOf('http')!==0?('data:image/png;base64,'+u):u);
    }).catch(function(e){err(e&&e.message||e);});
  }
}
function imgsGet(){try{return JSON.parse(localStorage.getItem('guardianDragonImgs')||'[]');}catch(_){return[];}}
function imgsPut(a){try{localStorage.setItem('guardianDragonImgs',JSON.stringify(a.slice(-12)));}catch(_){
  try{localStorage.setItem('guardianDragonImgs',JSON.stringify(a.slice(-4)));}catch(__){}}}
var DISPW=['120px','220px','420px','100%'];
function insertImg(url,multi){
  var p=narrAdd(null,'',null);
  p.style.display='inline-block';p.style.marginRight='8px';
  var us=String(url).replace(/"/g,'&quot;').replace(/</g,'%3C');
  p.innerHTML='<img src="'+us+'" style="max-width:'+(multi?'180px':DISPW[SET.img.disp])
    +';border:1px solid rgba(132,88,0,.4)">';
  if(url.indexOf('data:')===0){
    var arr=imgsGet();arr.push({u:url,t:new Date().toLocaleString()});imgsPut(arr);
  }
}
function drawScene(){
  var g=SET.img;
  if(!g.on){$('#imgMsg').textContent='生图未启用（上方开关）';return;}
  if(!g.base){$('#imgMsg').textContent='先配置接口地址';return;}
  var last='';
  for(var i=TURNS.length-1;i>=0;i--)if(TURNS[i].role==='assistant'){last=stripMvu(TURNS[i].display||TURNS[i].content);break;}
  if(!last)last=$('#gNarr').textContent.slice(0,800);
  var n=g.count+1;
  $('#imgMsg').textContent='绘制中…（'+n+'张）';
  function fire(prompts){
    var done=0,fail=0;
    prompts.forEach(function(pr,pi){
      var attempt=0;
      (function go(){
        genOne(pr,g.seed!==''?(+g.seed+pi):null,function(url){
          insertImg(url,n>1);
          if(++done+fail===n)$('#imgMsg').textContent='完成 '+done+'/'+n+(fail?('，失败 '+fail):'');
        },function(msg){
          if(++attempt<2){go();return;}   /* 失败自动重试一次 */
          fail++;
          if(done+fail===n)$('#imgMsg').textContent='完成 '+done+'/'+n+'，失败 '+fail+'：'+msg;
          else narrAdd('sys','⚠ 生图失败：'+esc2(String(msg)),null);
        });
      })();
    });
  }
  var basePrompt=imgPromptBase(last);
  if(n>1&&typeof subReady==='function'&&subReady()){
    risuAuxInvoke([{role:'system',content:'把场景拆成'+n+'个不同切入点的英文AI绘画提示词（主场景/人物特写/别处NPC/换机位），每行一个，只输出提示词。'},
             {role:'user',content:last.slice(0,1200)}],
      function(rep){
        var lines=rep.split('\n').map(function(s){return s.replace(/^\d+[.、]\s*/,'').trim();})
          .filter(Boolean).slice(0,n);
        while(lines.length<n)lines.push(last.slice(0,300));
        fire(lines.map(function(l){return basePrompt+l;}));
      },
      function(){fire(Array.apply(null,Array(n)).map(function(){return basePrompt+last.slice(0,400);}));});
  }else{
    fire(Array.apply(null,Array(n)).map(function(){return basePrompt+last.slice(0,400);}));
  }
}
$('#imgDraw').addEventListener('click',drawScene);
function imgcRender(){
  var host=$('#imgcGrid');host.innerHTML='';
  var arr=imgsGet();
  $('#imgcMsg').textContent=arr.length?('本机现存 '+arr.length+' 张'):'暂无缓存图片';
  arr.slice().reverse().forEach(function(o,ri){
    var i=arr.length-1-ri;
    var d=document.createElement('div');d.style.cssText='position:relative';
    d.innerHTML='<img src="'+o.u+'" style="width:100%;display:block;border:1px solid rgba(19,18,13,.2);cursor:pointer">'
      +'<span data-di="'+i+'" style="position:absolute;top:2px;right:4px;color:#ff7f63;cursor:pointer">✕</span>';
    d.querySelector('img').addEventListener('click',function(){
      var ov=document.createElement('div');
      ov.style.cssText='position:fixed;inset:0;z-index:99;background:rgba(242,236,222,.92);display:flex;align-items:center;justify-content:center;cursor:pointer';
      ov.innerHTML='<img src="'+o.u+'" style="max-width:92vw;max-height:92vh">';
      ov.addEventListener('click',function(){ov.remove();});
      document.body.appendChild(ov);
    });
    d.querySelector('[data-di]').addEventListener('click',function(){
      var a=imgsGet();a.splice(i,1);imgsPut(a);imgcRender();
    });
    host.appendChild(d);
  });
}
$('#imgcClear').addEventListener('dblclick',function(){imgsPut([]);imgcRender();});
/* —— 书·世界书管理（统一自写条目） —— */
function loreCustomGet(){try{return JSON.parse(localStorage.getItem('guardianDragonLoreCustom')||'[]');}catch(_){return[];}}
function loreCustomPut(a){lsSet('guardianDragonLoreCustom',JSON.stringify(a))}
var LFEDIT=-1;
$('#loreBud').value=SET.loreBud;$('#loreBudV').textContent=SET.loreBud;
$('#loreBud').addEventListener('input',function(){
  SET.loreBud=+this.value;$('#loreBudV').textContent=this.value;setStore();});
$('#loreDepth').value=(SET.risu||{}).loreDepth||5;
$('#loreRecursive').checked=(SET.risu||{}).loreRecursive!==0;
$('#loreFullWord').checked=(SET.risu||{}).loreFullWord!==0;
$('#loreDepth').addEventListener('input',function(){
  var value=this.value.replace(/[^0-9]/g,'');if(value!==this.value)this.value=value;
  SET.risu.loreDepth=Math.max(1,Math.min(100,parseInt(value,10)||5));setStore();
});
$('#loreRecursive').addEventListener('change',function(){SET.risu.loreRecursive=this.checked?1:0;setStore();});
$('#loreFullWord').addEventListener('change',function(){SET.risu.loreFullWord=this.checked?1:0;setStore();});
function loreRender(){
  var host=$('#loreList');host.innerHTML='';
  var arr=loreCustomGet();
  if(!arr.length){host.innerHTML='<div class="sub">尚无自定义条目</div>';return;}
  arr.forEach(function(e,i){
    var d=document.createElement('div');d.className='lRow'+(e.on===false?' off':'');
    d.innerHTML='<b>'+esc2(e.title)+'</b><span>'+(e.constant?'常驻':esc2((e.keys||[]).join(',')))+'</span>'
      +'<span class="op" data-a="t">'+(e.on===false?'停用中':'启用中')+'</span>'
      +'<span class="op" data-a="e">编辑</span><span class="op" data-a="d" style="color:#ff7f63">删</span>';
    d.querySelector('[data-a=t]').addEventListener('click',function(){
      e.on=e.on===false;arr[i]=e;loreCustomPut(arr);loreRender();});
    d.querySelector('[data-a=e]').addEventListener('click',function(){
      LFEDIT=i;$('#loreForm').style.display='';
      $('#lfTtl').value=e.title;$('#lfKeys').value=(e.keys||[]).join(',');
      $('#lfKeys2').value=(e.keys2||[]).join(',');
      $('#lfOrd').value=e.ord!=null?e.ord:100;$('#lfProb').value=e.prob!=null?e.prob:100;
      setSeg('#sgLfConst',e.constant?1:0);$('#lfTxt').value=e.content;});
    d.querySelector('[data-a=d]').addEventListener('click',function(){
      arr.splice(i,1);loreCustomPut(arr);loreRender();});
    host.appendChild(d);
  });
}
$('#loreNew').addEventListener('click',function(){
  LFEDIT=-1;$('#loreForm').style.display='';
  $('#lfTtl').value='';$('#lfKeys').value='';$('#lfKeys2').value='';
  $('#lfOrd').value=100;$('#lfProb').value=100;setSeg('#sgLfConst',0);$('#lfTxt').value='';
});
function _lfNum(v,d){v=String(v==null?'':v).trim();return (v===''||isNaN(+v))?d:+v;}
$('#lfCancel').addEventListener('click',function(){$('#loreForm').style.display='none';});
$('#lfSave').addEventListener('click',function(){
  var e={cat:'自写',custom:true,on:true,
    title:$('#lfTtl').value.trim(),
    keys:$('#lfKeys').value.split(/[,，]/).map(function(s){return s.trim();}).filter(Boolean),
    keys2:$('#lfKeys2').value.split(/[,，]/).map(function(s){return s.trim();}).filter(Boolean),
    /* 0 是有意义的值：概率 0 是「暂时关掉这条」，顺序 0 是「排到最前」。
       原来一律 ||100，玩家以为关掉的条目每回合 100% 注入，想置顶的反而掉到队尾。 */
    ord:_lfNum($('#lfOrd').value,100),prob:_lfNum($('#lfProb').value,100),
    constant:$('#sgLfConst').children[1].classList.contains('on'),
    content:$('#lfTxt').value.trim()};
  if(!e.title||!e.content){$('#loreMsg').textContent='条目名与内容必填';return;}
  var arr=loreCustomGet();
  if(LFEDIT>=0)arr[LFEDIT]=e;else arr.push(e);
  loreCustomPut(arr);loreRender();
  $('#loreForm').style.display='none';$('#loreMsg').textContent='已保存';
});
$('#loreUp').addEventListener('click',function(){$('#loreFile').click();});
$('#loreFile').addEventListener('change',function(){
  var f=this.files[0];if(!f)return;
  var self=this;
  f.text().then(function(raw){
    var parsed=JSON.parse(raw),list=Array.isArray(parsed)?parsed:(parsed.entries||parsed.data||[]),arr=loreCustomGet(),ok=0;
    list.forEach(function(e){
      if(!e.title||!e.content)return;
      arr.push({cat:'自写',custom:true,on:e.on!==false,title:e.title,
        keys:e.keys||[],keys2:e.keys2||[],ord:_lfNum(e.ord,100),prob:_lfNum(e.prob,100),
        constant:!!e.constant,useRegex:!!e.useRegex,scanDepth:e.scanDepth,
        recursive:e.recursive,fullWordMatching:!!e.fullWordMatching,
        excludeKeys:e.excludeKeys||[],content:e.content});ok++;
    });
    loreCustomPut(arr);loreRender();
    $('#loreMsg').textContent='汇入 '+ok+' 条';
  }).catch(function(e){$('#loreMsg').textContent='汇入失败：'+((e&&e.message)||e);})
    .then(function(){self.value='';});
});
$('#loreExp').addEventListener('click',function(){
  var b=new Blob([JSON.stringify(loreCustomGet(),null,1)],{type:'application/json'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='roma_lore_custom.json';a.click();
});
/* —— 则·正则 —— */
var RXEDIT=-1;
function rxRender(){
  var host=$('#rxList');host.innerHTML='';
  if(!(SET.rx||[]).length){host.innerHTML='<div class="sub">尚无正则</div>';return;}
  SET.rx.forEach(function(r,i){
    var d=document.createElement('div');d.className='lRow'+(r.on===false?' off':'');
    d.innerHTML='<b>'+esc2(r.name||('#'+(i+1)))+'</b><span>'+(r.scope===1?'显示并发送':'仅显示')+'</span>'
      +'<span class="op" data-a="t">'+(r.on===false?'停用中':'启用中')+'</span>'
      +'<span class="op" data-a="e">编辑</span><span class="op" data-a="d" style="color:#ff7f63">删</span>';
    d.querySelector('[data-a=t]').addEventListener('click',function(){r.on=r.on===false;setStore();rxRender();});
    d.querySelector('[data-a=e]').addEventListener('click',function(){
      RXEDIT=i;$('#rxForm').style.display='';
      $('#rxfName').value=r.name||'';$('#rxfFind').value=r.find||'';$('#rxfRep').value=r.rep||'';
      setSeg('#sgRxScope',r.scope||0);});
    d.querySelector('[data-a=d]').addEventListener('click',function(){SET.rx.splice(i,1);setStore();rxRender();});
    host.appendChild(d);
  });
}
$('#rxNew').addEventListener('click',function(){
  RXEDIT=-1;$('#rxForm').style.display='';
  $('#rxfName').value='';$('#rxfFind').value='';$('#rxfRep').value='';setSeg('#sgRxScope',0);});
$('#rxfCancel').addEventListener('click',function(){$('#rxForm').style.display='none';});
$('#rxfSave').addEventListener('click',function(){
  var r={name:$('#rxfName').value.trim(),find:$('#rxfFind').value,rep:$('#rxfRep').value,
    scope:$('#sgRxScope').children[1].classList.contains('on')?1:0,on:true};
  if(!r.find){$('#rxMsg').textContent='查找必填';return;}
  if(RXEDIT>=0&&RXEDIT<SET.rx.length){
    /* Risu 正则的执行阶段、flags 与 placement 在这个简洁编辑框里没有单独控件；
       编辑查找/替换时保留这些底层元数据，不能无声降级成普通 FELINIA 规则。 */
    var old=SET.rx[RXEDIT]||{};
    ['type','flag','ableFlag','placement'].forEach(function(k){if(old[k]!==undefined)r[k]=old[k];});
    SET.rx[RXEDIT]=r;
  }else SET.rx.push(r);
  setStore();rxRender();$('#rxForm').style.display='none';
});
$('#rxImp').addEventListener('click',function(){$('#rxFile').click();});
$('#rxFile').addEventListener('change',function(){
  var files=[].slice.call(this.files),ok=0,left=files.length;
  files.forEach(function(f){
    var rd=new FileReader();
    rd.onload=function(){
      try{
        var j=JSON.parse(rd.result);
        var list=Array.isArray(j)?j:((j&&j.type==='regex'&&Array.isArray(j.data))?j.data:[j]);
        list.forEach(function(o){
          if(o.findRegex||o.find_regex||o.find){
            SET.rx.push({name:o.scriptName||o.name||'酒馆正则',
              find:o.findRegex||o.find_regex||o.find,rep:o.replaceString||o.replace_string||o.rep||'',
              scope:(o.type==='editprocess'||(o.placement&&o.placement.length>1))?1:0,
              type:o.type||'',flag:o.flag||'',ableFlag:!!o.ableFlag,placement:o.placement||[],
              on:o.disabled?false:true});ok++;
          }
        });
      }catch(_){}
      if(!--left){setStore();rxRender();$('#rxMsg').textContent='汇入 '+ok+' 条';}
    };
    rd.readAsText(f);
  });
  this.value='';
});
$('#rxExp').addEventListener('click',function(){
  var b=new Blob([JSON.stringify(SET.rx,null,1)],{type:'application/json'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='roma_regex.json';a.click();
});
/* —— 脚·助手脚本（沙箱 iframe） —— */
var JSEDIT=-1;
function jsRender(){
  var host=$('#jsList');host.innerHTML='';
  if(!(SET.js||[]).length){host.innerHTML='<div class="sub">尚无脚本</div>';return;}
  SET.js.forEach(function(s,i){
    var d=document.createElement('div');d.className='lRow'+(s.on===false?' off':'');
    d.innerHTML='<b>'+esc2(s.name)+'</b>'
      +'<span class="op" data-a="t">'+(s.on===false?'停用中':'启用中')+'</span>'
      +'<span class="op" data-a="e">编辑</span><span class="op" data-a="d" style="color:#ff7f63">删</span>';
    d.querySelector('[data-a=t]').addEventListener('click',function(){s.on=s.on===false;setStore();jsRender();});
    d.querySelector('[data-a=e]').addEventListener('click',function(){
      JSEDIT=i;$('#jsForm').style.display='';$('#jsfName').value=s.name;$('#jsfTxt').value=s.code;});
    d.querySelector('[data-a=d]').addEventListener('click',function(){SET.js.splice(i,1);setStore();jsRender();});
    host.appendChild(d);
  });
}
$('#jsNew').addEventListener('click',function(){
  JSEDIT=-1;$('#jsForm').style.display='';$('#jsfName').value='';$('#jsfTxt').value='';});
$('#jsfCancel').addEventListener('click',function(){$('#jsForm').style.display='none';});
$('#jsfSave').addEventListener('click',function(){
  var s={name:$('#jsfName').value.trim()||'脚本',code:$('#jsfTxt').value,on:true};
  if(!s.code){$('#jsMsg').textContent='脚本内容必填';return;}
  if(JSEDIT>=0)SET.js[JSEDIT]=s;else SET.js.push(s);
  setStore();jsRender();$('#jsForm').style.display='none';
});
$('#jsImp').addEventListener('click',function(){$('#jsFileI').click();});
$('#jsFileI').addEventListener('change',function(){
  var f=this.files[0];if(!f)return;
  var rd=new FileReader();
  rd.onload=function(){SET.js.push({name:f.name.replace(/\.(js|txt)$/,''),code:rd.result,on:true});
    setStore();jsRender();};
  rd.readAsText(f);this.value='';
});
/* —— 链：接口档案 / 副模型 / 采样 —— */
function apPaneLoad(){
  var sel=$('#apProfs');sel.innerHTML='';
  var names=Object.keys(SET.profs||{});
  var o0=document.createElement('option');o0.value='';o0.textContent=names.length?'— 拣选档案 —':'— 无档案 —';
  sel.appendChild(o0);
  names.forEach(function(n){var o=document.createElement('option');o.value=o.textContent=n;sel.appendChild(o);});
  $('#apFormat').value=felRisuFormat(API.format);
  $('#subFormat').value=felRisuFormat(SET.sub.format);
  $('#subBase').value=SET.sub.base;$('#subKey').value=SET.sub.key;$('#subModel').value=SET.sub.model;
  $('#apTemp').value=SET.samp.temp;$('#apTopP').value=SET.samp.topp;
  $('#apMaxT').value=SET.samp.maxt;$('#apMinC').value=SET.samp.minc;
  setSeg('#sgReason',SET.samp.reason==null?1:SET.samp.reason);
  var tr=SET.trans||{};
  $('#trProvider').value=tr.provider||'off';$('#trShowRaw').checked=!!tr.showRaw;
  $('#trDeepLKey').value=tr.deeplKey||'';$('#trDeepLXUrl').value=tr.deeplxUrl||'http://localhost:1188';
  $('#trDeepLXToken').value=tr.deeplxToken||'';trPaneSync();
  var sm=SET.semantic||{};
  $('#semOn').checked=sm.on!==0;$('#semMode').value=sm.mode||'hybrid';$('#semModel').value=sm.model||'';
  $('#semBudget').value=sm.budget||3000;$('#semGpu').checked=sm.gpu!==0;semPaneSync();
}
var RISU_TEXT_FIELDS={
  reFreq:'freq',rePres:'pres',reTopK:'topk',reRep:'rep',reMinP:'minp',reTopA:'topa',reSeed:'seed',
  reRetries:'retries',reTimeout:'timeout',reStops:'stops',reAutoMin:'autoMin',reThinkTokens:'thinkTokens',
  reJinja:'jinja',reSysReplace:'sysReplace',rePrefill:'prefill',rePostEnd:'postEnd',reThoughtDepth:'thoughtDepth',
  reJson:'json',reExtract:'extract',reParams:'params',reTools:'tools'
};
var RISU_CHECK_FIELDS={
  reStream:'stream',reStrict:'strict',reAutoUrl:'autoUrl',reAutoCont:'autoCont',reRemoveIncomplete:'removeIncomplete',
  reBlankFallback:'blankFallback',reNewOai:'newOai',reCot:'cot',reInstruct:'instruct',reChatSystem:'chatSystem',
  reSendName:'sendName',reJsonOn:'jsonOn',reJsonStrict:'jsonStrict',reParamsAll:'paramsAll',reAutoCache:'autoCache',
  reClaudeRetrieval:'claudeRetrieval',reClaudeBatch:'claudeBatch',reClaudeHour:'claudeHour',reOverload:'overload',
  reFlex:'flex',reGeminiThoughts:'geminiThoughts'
};
var RISU_SELECT_FIELDS={
  reVerbosity:'verbosity',reVision:'vision',reThinkType:'thinkType',reAdaptive:'adaptive',reDeepType:'deepType',
  reDeepEffort:'deepEffort',reTokenizer:'tokenizer',reTemplate:'template',reSysRole:'sysRole'
};
function enginePaneLoad(){
  var r=SET.risu||{};
  $('#reContext').value=SET.context==null?65536:SET.context;
  Object.keys(RISU_TEXT_FIELDS).forEach(function(id){var el=$('#'+id);if(el)el.value=r[RISU_TEXT_FIELDS[id]]==null?'':r[RISU_TEXT_FIELDS[id]];});
  Object.keys(RISU_CHECK_FIELDS).forEach(function(id){var el=$('#'+id);if(el)el.checked=r[RISU_CHECK_FIELDS[id]]!==0;});
  Object.keys(RISU_SELECT_FIELDS).forEach(function(id){var el=$('#'+id);if(el)el.value=String(r[RISU_SELECT_FIELDS[id]]==null?'':r[RISU_SELECT_FIELDS[id]]);});
}
function engineStatus(text,bad){var el=$('#reStatus');if(el){el.textContent=text;el.style.color=bad?'#a74432':'';}}
Object.keys(RISU_TEXT_FIELDS).forEach(function(id){
  $('#'+id).addEventListener('input',function(){SET.risu[RISU_TEXT_FIELDS[id]]=this.value;setStore();engineStatus('已保存 · 下一次请求生效',0);});
});
Object.keys(RISU_CHECK_FIELDS).forEach(function(id){
  $('#'+id).addEventListener('change',function(){SET.risu[RISU_CHECK_FIELDS[id]]=this.checked?1:0;setStore();engineStatus('已保存 · 下一次请求生效',0);});
});
Object.keys(RISU_SELECT_FIELDS).forEach(function(id){
  $('#'+id).addEventListener('change',function(){var key=RISU_SELECT_FIELDS[id],value=this.value;SET.risu[key]=(key==='verbosity'?parseInt(value,10):value);setStore();engineStatus('已保存 · 下一次请求生效',0);});
});
$('#reContext').addEventListener('input',function(){
  var value=this.value.replace(/[^0-9]/g,'');if(value!==this.value)this.value=value;
  SET.context=Math.max(2048,parseInt(value,10)||65536);setStore();engineStatus('最大上下文已保存',0);
});
$('#reDefaults').addEventListener('click',function(){
  if(!confirm('只恢复“生成引擎”这一页的默认值？接口、游戏、存档和其他设置都不会改变。'))return;
  SET.context=65536;
  SET.risu={freq:'',pres:'',topk:'',rep:'',minp:'',topa:'',seed:'-1',verbosity:1,
    stream:1,strict:1,autoUrl:1,retries:2,timeout:600,stops:'',autoCont:0,autoMin:0,removeIncomplete:0,blankFallback:0,newOai:1,vision:'low',
    thinkType:'budget',thinkTokens:0,adaptive:'high',deepType:'off',deepEffort:'high',cot:0,
    instruct:0,tokenizer:'tik',template:'chatml',jinja:'',sysReplace:'system: {{slot}}',sysRole:'user',prefill:'',postEnd:'',chatSystem:0,sendName:0,thoughtDepth:-1,
    jsonOn:0,jsonStrict:1,json:'',extract:'',params:'',paramsAll:0,tools:'',autoCache:0,claudeRetrieval:0,claudeBatch:0,claudeHour:0,overload:0,flex:0,geminiThoughts:0,loreDepth:5,loreRecursive:0,loreFullWord:0};
  setStore();enginePaneLoad();engineStatus('已恢复引擎默认；其他设置与存档未改变',0);
});
function trPaneSync(){
  var p=($('#trProvider')&&$('#trProvider').value)||((SET.trans||{}).provider)||'off';
  var dl=$('#trDeepLKey'),dx=$('#trDeepLXUrl'),dt=$('#trDeepLXToken'),di=$('#trDeepLXInstallRow');
  if(dl)dl.closest('.sRow').style.display=p==='deepl'?'':'none';
  if(di)di.style.display=p==='deeplx'?'':'none';
  if(dx)dx.closest('.sRow').style.display=p==='deeplx'?'':'none';
  if(dt)dt.closest('.sRow').style.display=p==='deeplx'?'':'none';
  var note={browser:'浏览器本地翻译 · 首次下载韩中语言包 · 不支持时自动使用 Google',google:'Google 快速翻译 · 无需密钥 · 结果缓存于本浏览器',deepl:'DeepL API · 使用玩家自己的密钥',
    deeplx:'DeepLX · 未安装时点上方“一键安装” · 安装并启动后请求只发往本机',bergamot:'Firefox／Bergamot · 模型首次使用时下载，之后在浏览器本地运行',
    llm:'使用副模型（若已配置）或主模型完成翻译',off:'已关闭 · 模型与界面直接使用同一种语言'}[p];
  felTrStatus(note,0);
}
function semPaneSync(){
  var mode=($('#semMode')&&$('#semMode').value)||((SET.semantic||{}).mode)||'hybrid';
  var model=$('#semModel');if(model)model.closest('.sRow').style.display=mode==='api'?'':'none';
  var gpu=$('#semGpu');if(gpu)gpu.closest('.sRow').style.display=(mode==='bge-ko'||mode==='hybrid')?'':'none';
}
$('#trProvider').addEventListener('change',function(){SET.trans.provider=this.value;setStore();trPaneSync();if(this.value==='browser')felNativeTranslationWarm();});
$('#trDeepLXInstall').addEventListener('click',function(){
  var ua=(navigator.userAgent||'')+' '+(navigator.platform||''),file='';
  if(/Windows/i.test(ua))file='/core/res/install/DeepLX-Windows.cmd';
  else if(/Macintosh|MacIntel|Mac OS X/i.test(ua))file='/core/res/install/DeepLX-macOS.zip';
  else {felTrStatus('当前一键安装支持 macOS 与 Windows；其他系统请填写已有 DeepLX 服务地址',1);return;}
  var a=document.createElement('a');a.href=file;a.download=file.split('/').pop();document.body.appendChild(a);a.click();a.remove();
  felTrStatus('安装文件已下载 · 打开它一次即可安装并启动本地翻译服务',0);
});
$('#trShowRaw').addEventListener('change',function(){SET.trans.showRaw=this.checked?1:0;setStore();});
[['trDeepLKey','deeplKey'],['trDeepLXUrl','deeplxUrl'],['trDeepLXToken','deeplxToken']].forEach(function(pair){
  $('#'+pair[0]).addEventListener('input',function(){SET.trans[pair[1]]=this.value.trim();setStore();});
});
$('#semOn').addEventListener('change',function(){SET.semantic.on=this.checked?1:0;setStore();});
$('#semMode').addEventListener('change',function(){SET.semantic.mode=this.value;setStore();semPaneSync();});
$('#semModel').addEventListener('input',function(){SET.semantic.model=this.value.trim();setStore();});
$('#semBudget').addEventListener('input',function(){
  var v=this.value.replace(/[^0-9]/g,'');if(v!==this.value)this.value=v;
  SET.semantic.budget=Math.max(400,parseInt(v,10)||3000);setStore();
});
$('#semGpu').addEventListener('change',function(){SET.semantic.gpu=this.checked?1:0;setStore();});
$('#apFormat').addEventListener('change',function(){API.format=felRisuFormat(this.value);apiStore();});
$('#subFormat').addEventListener('change',function(){SET.sub.format=felRisuFormat(this.value);setStore();});
$('#apProfSave').addEventListener('click',function(){
  var n=prompt('档案名（如：主力deepseek）');if(!n)return;
  SET.profs[n]={format:felRisuFormat(API.format),base:API.base,key:API.key,model:API.model,img:API.img};
  setStore();apPaneLoad();
});
$('#apProfs').addEventListener('change',function(){
  var p=SET.profs[this.value];if(!p)return;
  API.format=felRisuFormat(p.format);API.base=p.base;API.key=p.key;API.model=p.model;API.img=p.img||'';apiStore();apPaneLoad();
});
$('#apProfDel').addEventListener('click',function(){
  var n=$('#apProfs').value;if(!n)return;
  delete SET.profs[n];setStore();apPaneLoad();
});
$('#apOpen').addEventListener('click',function(){apiOpen();});
['subBase','subKey','subModel'].forEach(function(id){
  $('#'+id).addEventListener('input',function(){SET.sub[id.slice(3).toLowerCase()]=this.value.trim();setStore();});
});
['apTemp','apTopP','apMaxT','apMinC'].forEach(function(id,ix){
  var k=['temp','topp','maxt','minc'][ix];
  /* 这四栏一律只收数字。placeholder 写着 4096，玩家很容易照着写「8k」「4096 tokens」，
     而 parseInt('8k') 是 8 —— 接口老老实实只回八个 token，正文变成一两个字。
     整数栏（tokens / 篇幅下限）连小数点也不收。 */
  var intOnly=(k==='maxt'||k==='minc');
  $('#'+id).addEventListener('input',function(){
    var v=this.value.replace(intOnly?/[^0-9]/g:/[^0-9.]/g,'');
    if(!intOnly){var p=v.split('.');if(p.length>2)v=p[0]+'.'+p.slice(1).join('');}
    if(this.value!==v)this.value=v;
    SET.samp[k]=v;setStore();
  });
});
function subReady(){return !!(SET.sub.base&&SET.sub.model);}
function risuAuxInvoke(messages,cb,err){
  risuInvoke(messages,cb,err,{aux:1,noStream:true,max_tokens:800});
}
/* —— 预·预设 —— */
var PREEDIT=-1;
function preRender(){
  var host=$('#preList');host.innerHTML='';
  if(!(SET.presets||[]).length){host.innerHTML='<div class="sub">尚未导入预设</div>';return;}
  SET.presets.forEach(function(p,i){
    var d=document.createElement('div');d.className='lRow'+(p.on===false?' off':'');
    d.innerHTML='<b>'+esc2(p.name||('#'+(i+1)))+'</b><span>'+(p.pos===1?'末位注入':'前置注入')+'</span>'
      +'<span class="op" data-a="t">'+(p.on===false?'停用中':'启用中')+'</span>'
      +'<span class="op" data-a="e">编辑</span><span class="op" data-a="d" style="color:#ff7f63">删</span>';
    d.querySelector('[data-a=t]').addEventListener('click',function(){p.on=p.on===false;setStore();preRender();});
    d.querySelector('[data-a=e]').addEventListener('click',function(){
      PREEDIT=i;$('#preForm').style.display='';
      $('#pfName').value=p.name||'';setSeg('#sgPrePos',p.pos||0);$('#pfTxt').value=p.text||'';});
    d.querySelector('[data-a=d]').addEventListener('click',function(){SET.presets.splice(i,1);setStore();preRender();});
    host.appendChild(d);
  });
}
$('#preNew').addEventListener('click',function(){
  PREEDIT=-1;$('#preForm').style.display='';$('#pfName').value='';setSeg('#sgPrePos',0);$('#pfTxt').value='';});
$('#pfCancel').addEventListener('click',function(){$('#preForm').style.display='none';});
$('#pfSave2').addEventListener('click',function(){
  var p={name:$('#pfName').value.trim()||'预设',
    pos:$('#sgPrePos').children[1].classList.contains('on')?1:0,
    text:$('#pfTxt').value.trim(),on:true};
  if(!p.text){$('#preMsg').textContent='内容必填';return;}
  if(PREEDIT>=0)SET.presets[PREEDIT]=p;else SET.presets.push(p);
  setStore();preRender();$('#preForm').style.display='none';
});
$('#preImp').addEventListener('click',function(){$('#preFile').click();});
$('#preFile').addEventListener('change',function(){
  var f=this.files[0];if(!f)return;
  var input=this;
  f.arrayBuffer().then(function(buf){return felRisuBoot().then(function(risu){
    return risu.importPreset(f.name,new Uint8Array(buf));
  });}).then(function(){$('#preMsg').textContent='原生预设已经启用';})
    .catch(function(e){$('#preMsg').textContent='预设解析失败：'+felPublicError(e);})
    .then(function(){input.value='';});
});
$('#preExp').addEventListener('click',function(){
  var b=new Blob([JSON.stringify(SET.presets,null,1)],{type:'application/json'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='roma_presets.json';a.click();
});
/* —— 忆·长程记忆 —— */
var MEMEDIT=-1;
function memRender(){
  var host=$('#memList');host.innerHTML='';
  if(!(SET.mems||[]).length){host.innerHTML='<div class="sub">尚无记忆</div>';return;}
  SET.mems.forEach(function(m,i){
    var d=document.createElement('div');d.className='lRow'+(m.on===false?' off':'');
    d.innerHTML='<b style="flex:1;white-space:normal">'+esc2(m.text.slice(0,60))+(m.text.length>60?'…':'')+'</b>'
      +'<span class="op" data-a="t">'+(m.on===false?'停':'启')+'</span>'
      +'<span class="op" data-a="e">编</span><span class="op" data-a="d" style="color:#ff7f63">删</span>';
    d.querySelector('[data-a=t]').addEventListener('click',function(){m.on=m.on===false;setStore();memRender();});
    d.querySelector('[data-a=e]').addEventListener('click',function(){
      MEMEDIT=i;$('#memForm').style.display='';$('#mfTxt').value=m.text;});
    d.querySelector('[data-a=d]').addEventListener('click',function(){SET.mems.splice(i,1);setStore();memRender();});
    host.appendChild(d);
  });
}
$('#memNew').addEventListener('click',function(){MEMEDIT=-1;$('#memForm').style.display='';$('#mfTxt').value='';});
$('#mfCancel').addEventListener('click',function(){$('#memForm').style.display='none';});
$('#mfSave').addEventListener('click',function(){
  var t=$('#mfTxt').value.trim();if(!t)return;
  if(MEMEDIT>=0)SET.mems[MEMEDIT].text=t;else SET.mems.push({text:t,on:true});
  setStore();memRender();$('#memForm').style.display='none';
});
$('#memAuto').addEventListener('click',function(){
  var recent=TURNS.slice(-10).map(function(t){return t.display||t.content;}).join('\n').slice(0,6000);
  if(!recent){$('#memMsg').textContent='尚无剧情可摘要';return;}
  var call=(subReady()||apiReady())?risuAuxInvoke:null;
  if(!call){$('#memMsg').textContent='需先配置接口（主或副模型）';return;}
  $('#memMsg').textContent='摘要中…';
  call([{role:'system',content:'把以下剧情压缩成一条100字以内的长程记忆（事实与关系，第三人称，中文）'},
        {role:'user',content:recent}],
    function(rep){SET.mems.push({text:rep.trim(),on:true});setStore();memRender();$('#memMsg').textContent='已存入';},
    function(e){$('#memMsg').textContent='失败：'+e;});
});
/* —— 备·数据备份 —— */
/* —— 分项备份：预设/记忆/正则/脚本/世界书/接口/装备/存档/其他设置 逐项导出导入 —— */
var BAK_CATS={
  preset:{n:'预设',get:function(){return SET.presets||[];},set:function(v){SET.presets=v||[];setStore();}},
  mem:{n:'记忆',get:function(){return SET.mems||[];},set:function(v){SET.mems=v||[];setStore();}},
  palace:{n:'宫殿记忆库',asyncGet:function(){return felRisuBoot().then(function(r){return r.exportPalace();});},
    asyncSet:function(v){return felRisuBoot().then(function(r){return r.importPalace(v||{});});}},
  rx:{n:'正则',get:function(){return SET.rx||[];},set:function(v){SET.rx=v||[];setStore();}},
  js:{n:'脚本',get:function(){return SET.js||[];},set:function(v){SET.js=v||[];setStore();}},
  lore:{n:'世界书(自写)',get:function(){return loreCustomGet();},set:function(v){loreCustomPut(v||[]);}},
  api:{n:'AI接口',key:'guardianDragonApi2'},
  inv:{n:'装备行囊',key:'guardianDragonInv'},
  save:{n:'存档(全部槽位)',multi:'guardianDragonSv_'},
  imgs:{n:'图库缓存',key:'guardianDragonImgs'},
  /* savePref() 把编年长卷 S.mem、人物档案 S.npcMeta、图谱 S.graphHidden 都写在 SET.zj 下，
     而这一项原来是「SET 里除那五个数组之外的全部键」——于是「其他设置」实际上连两张卡的
     长程记忆与图谱一起导出（发给别人即泄露全部剧情），导入则用对方的记忆静默替换自己的。
     把 zj 排除出去，另立一个看得见的备份项。 */
  disp:{n:'其他设置(显示/生图/语音/采样)',get:function(){
      var s={};Object.keys(SET).forEach(function(k){if(['presets','mems','rx','js','cards','zj'].indexOf(k)<0)s[k]=SET[k];});
      return {set:s,cfg:localStorage.getItem('guardianDragonCfg')||''};
    },set:function(v){
      if(v&&v.set){Object.keys(v.set).forEach(function(k){if(k==='zj')return;SET[k]=v.set[k];});setStore();}
      if(v&&v.cfg)lsSet('guardianDragonCfg',v.cfg);
    }},
  chron:{n:'编年长卷/人物图谱',get:function(){return SET.zj||{};},
    set:function(v){SET.zj=v||{};setStore();try{zjLoadPref();}catch(_){}}}
};
function bakCatData(k){
  var c=BAK_CATS[k];
  if(c.asyncGet)return c.asyncGet();
  if(c.get)return c.get();
  if(c.key)return localStorage.getItem(c.key)||'';
  if(c.multi){var o={};for(var i=0;i<localStorage.length;i++){var kk=localStorage.key(i);
    if(kk&&kk.indexOf(c.multi)===0)o[kk]=localStorage.getItem(kk);}return o;}
}
function bakCatPut(k,data){
  var c=BAK_CATS[k];
  if(c.asyncSet)return c.asyncSet(data);
  if(c.set){c.set(data);return;}
  if(c.key){try{localStorage.setItem(c.key,typeof data==='string'?data:JSON.stringify(data));}catch(_){}return;}
  if(c.multi&&data&&typeof data==='object')Object.keys(data).forEach(function(kk){
    if(kk.indexOf(c.multi)===0)try{localStorage.setItem(kk,data[kk]);}catch(_){}});
}
function bakDl(name,obj){
  var b=new Blob([JSON.stringify(obj,null,1)],{type:'application/json'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);},4000);
}
(function(){
  var rows=$('#bakRows');if(!rows)return;
  Object.keys(BAK_CATS).forEach(function(k){
    var r=document.createElement('div');
    r.className='sRow';
    r.innerHTML='<span>'+BAK_CATS[k].n+'</span><span style="display:flex;gap:8px"><span class="gt" data-bex="'+k+'">导出</span><span class="gt" data-bim="'+k+'">导入</span></span>';
    rows.appendChild(r);
  });
  var pend=null;
  rows.addEventListener('click',function(e){
    var ex=e.target.getAttribute&&e.target.getAttribute('data-bex');
    var im=e.target.getAttribute&&e.target.getAttribute('data-bim');
    if(ex){$('#bakMsg').textContent='正在导出：'+BAK_CATS[ex].n;
      Promise.resolve(bakCatData(ex)).then(function(data){
        bakDl('roma_'+ex+'.json',{__app:'ROMA',__type:'bak-item',cat:ex,data:data});
        $('#bakMsg').textContent='已导出：'+BAK_CATS[ex].n;
      },function(err){$('#bakMsg').textContent='导出失败：'+((err&&err.message)||err);});}
    if(im){pend=im;$('#bakFile').click();}
  });
  $('#bakExp').addEventListener('click',function(){
    var ks=Object.keys(BAK_CATS);$('#bakMsg').textContent='正在汇集全部资料…';
    Promise.all(ks.map(function(k){return Promise.resolve(bakCatData(k));})).then(function(values){
      var all={};ks.forEach(function(k,i){all[k]=values[i];});
      bakDl('roma_backup.json',{__app:'ROMA',__type:'bak-all',data:all});
      $('#bakMsg').textContent='已导出全部（'+ks.length+' 项）';
    },function(err){$('#bakMsg').textContent='全量导出失败：'+((err&&err.message)||err);});
  });
  $('#bakImp').addEventListener('click',function(){pend=null;$('#bakFile').click();});
  $('#bakFile').addEventListener('change',function(){
    var f=this.files[0];this.value='';if(!f)return;
    var rd=new FileReader();
    rd.onload=function(){
      try{
        var j=JSON.parse(rd.result);
        if(j&&j.__type==='bak-item'&&BAK_CATS[j.cat]){
          if(pend&&pend!==j.cat){$('#bakMsg').textContent='档案是「'+BAK_CATS[j.cat].n+'」，与所选项不符——已按档案内容导入';}
          (function(cat){Promise.resolve(bakCatPut(cat,j.data)).then(function(){
            $('#bakMsg').textContent='已导入：'+BAK_CATS[cat].n+' · 刷新页面生效';
          },function(err){$('#bakMsg').textContent='导入失败：'+((err&&err.message)||err);});})(j.cat);
        }else if(j&&j.__type==='bak-all'&&j.data){
          var ik=Object.keys(j.data).filter(function(k){return !!BAK_CATS[k];});
          Promise.all(ik.map(function(k){return Promise.resolve(bakCatPut(k,j.data[k]));})).then(function(){
            $('#bakMsg').textContent='已导入全量备份 · 刷新页面生效';
          },function(err){$('#bakMsg').textContent='全量导入失败：'+((err&&err.message)||err);});
        }else if(j&&typeof j==='object'){ /* 旧版全量档（rome_* 键值表）兼容 */
          var n=0;Object.keys(j).forEach(function(k){if(k.indexOf('rome_')===0){localStorage.setItem(k,j[k]);n++;}});
          $('#bakMsg').textContent=n?('已导入旧版备份 '+n+' 项 · 刷新页面生效'):'不是本游戏的备份档';
        }
      }catch(_){$('#bakMsg').textContent='JSON 解析失败';}
      pend=null;
    };
    rd.readAsText(f);
  });
  /* 两段式清除：先亮明细，再点才执行 */
  var wipeArm=false;
  $('#bakWipe').addEventListener('click',function(){
    var keys=[];
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i);
      if(k&&(/^rome_/.test(k)||/^med3d_/.test(k)||/^zj3d_/.test(k)))keys.push(k);
    }
    if(!wipeArm){
      wipeArm=true;
      this.textContent='确认清除 '+keys.length+' 项——再点一次执行，不可撤销';
      $('#bakMsg').textContent='将清除：'+keys.join('、');
      var btn=this;
      setTimeout(function(){if(wipeArm){wipeArm=false;btn.textContent='一键清除全部资料…';$('#bakMsg').textContent='已取消（超时未确认）';}},8000);
      return;
    }
    keys.forEach(function(k){try{localStorage.removeItem(k);}catch(_){}});
    $('#bakMsg').textContent='已清除 '+keys.length+' 项 · 正在清理本地记忆库…';
    var finish=function(){$('#bakMsg').textContent='全部资料已清除 · 正在刷新…';
      setTimeout(function(){location.reload();},600);};
    try{
      if(window.FEL_RISU&&FEL_RISU.clearPalace)Promise.resolve(FEL_RISU.clearPalace()).then(finish,finish);
      else{try{indexedDB.deleteDatabase('feliniaPalace');}catch(_){}finish();}
    }catch(_){finish();}
  });
})();
setTimeout(function(){   /* CARDS 在后方赋值——延迟到本轮脚本执行完再并入 */
  try{rebuildRing('luzhi');}catch(_){}
  if(CFGS.preset&&!(SET.presets||[]).length){
    SET.presets.push({name:'迁移·旧自定义指令',pos:0,text:CFGS.preset,on:true});
    CFGS.preset='';cfgStore();setStore();
  }
},0);
/* —— OP STATVS 可交互（委托） —— */
document.querySelector('#game .gMfd').addEventListener('click',function(e){
  var op=e.target.closest&&e.target.closest('.mOp');
  if(!op)return;
  var sib=op.parentNode.children;
  for(var i=0;i<sib.length;i++)sib[i].classList.remove('on');
  op.classList.add('on');
});
/* dialogs */
function gDlgShow(id){
  /* 弹窗必须互斥。旧实现只把新窗设成 flex，已经打开的窗仍完整留在下面；
     每一层 .gDlg .box 都会再做一次 backdrop-filter，Chrome 会逐层重采样整页，
     连开数窗后 GPU 合成负担会成倍增长。先释放旧层，再显示目标窗；视觉效果不变。 */
  var target=$(id);
  if(!target)return;
  var ds=document.querySelectorAll('.gDlg');
  for(var i=0;i<ds.length;i++)if(ds[i]!==target)ds[i].style.display='none';
  target.style.display='flex';
}
$('#gtCfg').addEventListener('click',function(){applyCfg();gDlgShow('#dlgCfg');});
$('#gtBook').addEventListener('click',function(){bookRender();gDlgShow('#dlgBook');});
$('#gtSave').addEventListener('click',function(){svOpen();});
$('#gtExit').addEventListener('click',function(){gDlgShow('#dlgExit');});
$('#gtApi').addEventListener('click',function(){apiOpen();});
$('#gtVoc').addEventListener('click',function(){gDlgShow('#dlgVoc');});
$('#exSave').addEventListener('click',function(){
  /* 存档后离开：优先写入空槽，无空槽则覆写最旧的一格 */
  var btn=this;if(btn.dataset.busy)return;
  if(BUSY){$('#exMsg').textContent='神谕落笔中，请等本回写完再存档';return;}
  btn.dataset.busy='1';
  try{
    var slot=0,oldest=null;
    /* 槽位共 SVN 格。只扫前 3 格会把玩家手动存在 I/II/III 的档无声覆盖掉，
       哪怕后面几十格全是空的。 */
    /* when 是 toLocaleString() 的本地化串（"2026/7/29 15:04:21"），字符串序下跨月跨年
       完全乱套——会覆盖掉今天刚存的档而不是真正最旧的那格。svSnap 早就另存了数值 ts。 */
    for(var n=1;n<=SVN;n++){var v=svGet(n);if(!v){slot=n;break;}
      if(!oldest||((v.ts||0)<(oldest.ts||0))){oldest=v;oldest._n=n;}}
    if(!slot)slot=oldest?oldest._n:1;
    /* svPut 内部已经把配额溢出捕获掉并 return false，所以外面这层 try/catch 永远不会
       触发：原来照样显示「已写入」并在 700ms 后退出，整局进度无声蒸发。 */
    if(!svPut(slot,svSnap())){
      btn.dataset.busy='';
      $('#exMsg').textContent='存档失败：本机存储已满（可在 设置·备 清理图库缓存或自定义字体）· 未离开';
      return;
    }
    if(typeof svRender==='function')try{svRender();}catch(_){}
    $('#exMsg').textContent='已写入 TABVLA '+(SV_ROMAN[slot-1]||('第'+slot+'格'))+' · 正在离开…';
    setTimeout(function(){btn.dataset.busy='';$('#dlgExit').style.display='none';$('#exMsg').textContent='';gameExit();},700);
  }catch(e){btn.dataset.busy='';$('#exMsg').textContent='存档失败：'+(e&&e.message||'未知错误');}
});
$('#exYes').addEventListener('click',function(){$('#dlgExit').style.display='none';$('#exMsg').textContent='';gameExit();});
$('#exNo').addEventListener('click',function(){$('#dlgExit').style.display='none';$('#exMsg').textContent='';});
(function(){
  var ds=['#dlgCfg','#dlgBook','#dlgExit','#dlgApi','#dlgVoc','#dlgBgm']; /* dlgSave 环盘自带 RETVRN/ESC：pointer capture 令 up.target 恒为 dlg，不能用点自身关闭 */
  for(var i=0;i<ds.length;i++)(function(sel){
    var el2=$(sel);
    el2.addEventListener('pointerup',function(e){if(e.target===el2)el2.style.display='none';});
  })(ds[i]);
})();
/* —— ORACVLVM 接入面板 —— */
function apiOpen(){
  $('#apiFormat').value=felRisuFormat(API.format);
  $('#apiBase').value=API.base||'';$('#apiKey').value=API.key||'';
  $('#apiModel').value=API.model||'';$('#apiImg').value=API.img||'';
  $('#apiReason').value=String(SET.samp.reason==null?1:SET.samp.reason);
  $('#apiMsg').textContent=apiReady()?'状态：已配置 · '+API.model:'状态：未接线';
  gDlgShow('#dlgApi');
}
/* —— 开局前的快速接入 ——
   完整设置面板本来只挂在游戏内的工具栏上，开局之前根本够不著预设、世界书、生图这几项。
   这里直接借用设置面板里现成的档案输入与页签，不另起一套逻辑。 */
function qkImport(fileSel,msgSel){
  var m=$(msgSel),input=$(fileSel);
  if(!m||!input){$('#apiMsg').textContent='导入控件尚未就绪';return;}
  /* 汇入结果本来写在设置面板的提示位上（此刻不可见），镜射一份到本窗，用户才看得到成败 */
  var ob=new MutationObserver(function(){$('#apiMsg').textContent=m.textContent;ob.disconnect();});
  ob.observe(m,{childList:true,characterData:true,subtree:true});
  setTimeout(function(){ob.disconnect();},120000);   /* 用户取消选档就不会有回写，超时收掉 */
  input.click();
}
$('#qkPre').addEventListener('click',function(){qkImport('#preFile','#preMsg');});
$('#qkLore').addEventListener('click',function(){qkImport('#loreFile','#loreMsg');});
$('#qkImg').addEventListener('click',function(){
  /* 两层 gDlg 叠著时后出现的反而在下（#dlgApi 在 DOM 里更靠后），所以先收本窗 */
  $('#dlgApi').style.display='none';
  applyCfg();gDlgShow('#dlgCfg');
  var tb=document.querySelector('#cfgTabs span[data-cp="img"]');if(tb)tb.click();
});
$('#apiEye').addEventListener('click',function(){
  var k=$('#apiKey');k.type=k.type==='password'?'text':'password';
});
$('#apiPull').addEventListener('click',function(){
  var btn=this;
  if(btn.getAttribute('aria-busy')==='true')return;
  var format=felRisuFormat($('#apiFormat').value),base=$('#apiBase').value.trim(),key=$('#apiKey').value.trim();
  if(!base){$('#apiMsg').textContent='先填 BASE URL';return;}
  btn.setAttribute('aria-busy','true');btn.style.pointerEvents='none';
  $('#apiMsg').textContent='拉取模型中…';
  felRisuBoot().then(function(risu){return risu.listModels(felRisuProvider({format:format,base:base,key:key,model:'model-list'}));}).then(function(list){
    if(!list.length)throw new Error('空列表');
    var sel=$('#apiModels');sel.innerHTML='';
    list.forEach(function(id){var o=document.createElement('option');o.value=o.textContent=id;sel.appendChild(o);});
    $('#apiModelsRow').style.display='';
    $('#apiMsg').textContent='拉到 '+list.length+' 个模型，从下拉拣选';
  }).catch(function(e){$('#apiMsg').textContent='拉取失败：'+felPublicError(e);})
  .finally(function(){btn.removeAttribute('aria-busy');btn.style.pointerEvents='';});
});
$('#apiModels').addEventListener('change',function(){$('#apiModel').value=this.value;});
$('#apiReason').addEventListener('change',function(){
  SET.samp.reason=Math.max(0,Math.min(3,parseInt(this.value,10)||0));setStore();
  setSeg('#sgReason',SET.samp.reason);
});
$('#apiTest').addEventListener('click',function(){
  var format=felRisuFormat($('#apiFormat').value),base=$('#apiBase').value.trim(),key=$('#apiKey').value.trim(),model=$('#apiModel').value.trim();
  if(!base||!model){$('#apiMsg').textContent='BASE URL 与 MODEL 必填';return;}
  $('#apiMsg').textContent='测试中…';
  felRisuBoot().then(function(risu){return risu.request({provider:Object.assign(felRisuProvider({format:format,base:base,key:key,model:model}),{maxTokens:8,stream:false}),
    messages:[{role:'user',content:'Reply only: pong'}],maxTokens:8});})
  .then(function(){$('#apiMsg').textContent='✓ 通了。SERVARE 储存后即可对话';})
  .catch(function(e){$('#apiMsg').textContent='✕ 不通：'+felPublicError(e);});
});
$('#apiSave').addEventListener('click',function(){
  API.format=felRisuFormat($('#apiFormat').value);
  API.base=$('#apiBase').value.trim();API.key=$('#apiKey').value.trim();
  API.model=$('#apiModel').value.trim();API.img=$('#apiImg').value.trim();
  SET.samp.reason=Math.max(0,Math.min(3,parseInt($('#apiReason').value,10)||0));setStore();
  apiStore();
  $('#apiMsg').textContent=apiReady()?'已储存 · 神谕在线':'已储存（尚缺必填项）';
});
$('#apiClear').addEventListener('click',function(){
  API={format:'openai',base:'',key:'',model:'',img:''};apiStore();apiOpen();
});
/* —— VOCES 密语频道 —— */
var VOCQ=['帕拉丁那边今晚有宴，去不去？','听说行省又送来一批怪东西。','你的剑该磨了——别瞪我，是真的。','街角面包坊涨价了，世道啊。','昨夜有人看见流星，占卜官忙疯了。','别问，问就是元老院的意思。'];
function vocAdd(me,text){
  var d=document.createElement('div');d.className='vLine'+(me?' me':'');
  d.innerHTML=me?esc2(text):'<b>◈</b>&nbsp;'+esc2(text);
  var log=$('#vocLog');log.appendChild(d);log.scrollTop=log.scrollHeight;
}
(function(){
  var hist=[];
  function vsend(){
    var v=$('#vocIn').value.trim();if(!v)return;
    vocAdd(true,v);$('#vocIn').value='';
    hist.push({role:'user',content:v});
    var msgs=[{role:'system',content:'你扮演当前罗马场景里的一名在场NPC，与玩家用中文闲聊几句：轻松、简短（两三句内）、带时代气息，绝不推进主线剧情。'}]
      .concat(hist.slice(-8));
    var ready=(typeof subReady==='function'&&subReady())||apiReady();
    if(ready){
      risuAuxInvoke(msgs,
        function(rep){hist.push({role:'assistant',content:rep});vocAdd(false,rep);},
        function(){vocAdd(false,VOCQ[Math.floor(Math.random()*VOCQ.length)]);});
    }else vocAdd(false,VOCQ[Math.floor(Math.random()*VOCQ.length)]);
  }
  $('#vocSend').addEventListener('click',vsend);
  $('#vocIn').addEventListener('keydown',function(e){if(e.isComposing||e.keyCode===229)return;if(e.key==='Enter')vsend();});
})();
/* —— 世界书：自写条目 / 汇入 —— */
$('#cxAdd').addEventListener('click',function(){
  $('#cxForm').style.display=$('#cxForm').style.display==='none'?'':'none';
});
$('#cxfCancel').addEventListener('click',function(){$('#cxForm').style.display='none';});
$('#cxfSave').addEventListener('click',function(){
  var e={cat:$('#cxfCat').value.trim()||'自写',title:$('#cxfTtl').value.trim(),
    keys:$('#cxfKeys').value.split(/[,，]/).map(function(s){return s.trim();}).filter(Boolean),
    content:$('#cxfTxt').value.trim(),custom:true};
  if(!e.title||!e.content){$('#cxMsg').textContent='标题与内容必填';return;}
  try{
    var cl=JSON.parse(localStorage.getItem('guardianDragonLoreCustom')||'[]');
    cl.push(e);localStorage.setItem('guardianDragonLoreCustom',JSON.stringify(cl));
  }catch(_){}
  $('#cxfTtl').value='';$('#cxfKeys').value='';$('#cxfTxt').value='';
  $('#cxForm').style.display='none';$('#cxMsg').textContent='已存入当前时代世界书';
  BOOK.side='luzhi';bookRender();
});
$('#cxImp').addEventListener('click',function(){$('#cxFile').click();});
$('#cxFile').addEventListener('change',function(){
  var f=this.files[0];if(!f)return;
  var rd=new FileReader();
  rd.onload=function(){
    try{
      var arr=JSON.parse(rd.result);
      if(!Array.isArray(arr))arr=arr.lorebook||[];
      var ok=0;
      arr.forEach(function(e){if(e&&e.title&&e.content){e.custom=true;ok++;}});
      var cl=JSON.parse(localStorage.getItem('guardianDragonLoreCustom')||'[]');
      localStorage.setItem('guardianDragonLoreCustom',JSON.stringify(cl.concat(arr.filter(function(e){return e&&e.title&&e.content;}))));
      $('#cxMsg').textContent='汇入 '+ok+' 条';bookRender();
    }catch(_){$('#cxMsg').textContent='JSON 解析失败';}
  };
  rd.readAsText(f);this.value='';
});
/* settings segments + sliders */
(function(){
  var segs=document.querySelectorAll('.sSeg');
  for(var i=0;i<segs.length;i++)(function(sg){
    var ch=sg.children;
    for(var j=0;j<ch.length;j++)(function(c,idx){
      c.addEventListener('click',function(){
        for(var k=0;k<ch.length;k++)ch[k].classList.remove('on');
        c.classList.add('on');
        if(sg.id==='sgMotus'){
          REDUCED=c.textContent.indexOf('减弱')>=0;
          /* 同时驱动 CSS 动效层；显式选择压过系统的「减少动态效果」，
             否则手机一进低电量模式，玩家会觉得动画整个没了。 */
          CFGS.motus=REDUCED?'soft':'full';
          document.documentElement.setAttribute('data-motion',CFGS.motus);
          try{cfgStore();}catch(_){}
        }
        if(sg.id==='sgVelo'){CFGS.velo=idx;cfgStore();}

        if(typeof SET!=='undefined'){
          if(sg.id==='sgForma'){SET.forma=idx;applyForma();setStore();}
          if(sg.id==='sgMvu'){SET.mvuRing=idx;setStore();try{mvRingMount();}catch(_){}}
          if(sg.id==='sgFace'){SET.face=idx;try{localStorage.removeItem('guardianDragonFont');}catch(_){}applyFace();setStore();}
          if(sg.id==='sgImgOn'){SET.img.on=idx;setStore();}
          if(sg.id==='sgImgAuto'){SET.img.auto=idx;setStore();}
          if(sg.id==='sgImgCount'){SET.img.count=idx;setStore();}
          if(sg.id==='sgImgCam'){SET.img.cam=idx;setStore();}
          if(sg.id==='sgImgDisp'){SET.img.disp=idx;setStore();}
          if(sg.id==='sgImgStyle'){SET.img.style=idx;setStore();imgStyleShow();
            if(!SET.img.steps){var dd=imgDefaults(idx);SET.img.steps=dd.steps;SET.img.cfg=dd.cfg;SET.img.w=dd.w;SET.img.h=dd.h;imgLoad();}}
          if(sg.id==='sgNaiModel'){SET.img.model=NAI_MODELS[idx];$('#imgModel').value=SET.img.model;setStore();}
          if(sg.id==='sgTtsSrc'){SET.tts.src=idx;setStore();}
          if(sg.id==='sgTtsScope'){SET.tts.scope=idx;setStore();}
          if(sg.id==='sgTtsAuto'){SET.tts.auto=idx;setStore();}
          if(sg.id==='sgReason'){SET.samp.reason=idx;setStore();}
        }
      });
    })(ch[j],j);
  })(segs[i]);
  $('#cfgVol').addEventListener('input',function(){
    AU.vol=this.value/100;
    if(AU.mgain)AU.mgain.gain.value=AU.mvol*.5*(AU.vol*1.4);
  });
  $('#cfgBgm').addEventListener('input',function(){
    /* 真正在响的是 BGM 那套 <audio>；AU 是从未接线的程序化音源（AU.on 恒 false），
       原来只写 AU.mvol，等于拖了个空气拉杆。 */
    try{
      BGVOL=Math.max(0,Math.min(100,+this.value));
      if(BGM&&BGM.a)BGM.a.volume=BGVOL/100;
      localStorage.setItem('guardianDragonBgmVol',''+BGVOL);
      var _bv=$('#bgVol');if(_bv)_bv.value=BGVOL;
    }catch(_){}
    AU.mvol=this.value/100;
    if(AU.mgain)AU.mgain.gain.value=AU.mvol*.5*(AU.vol*1.4);
  });
})();
/* ============ dual-card worldbook (罗马 / 周 · two mother layers, zero mixing) ============ */
var CARDS={luzhi:window.__GAME_LUZHI__||{openings:[],lorebook:[]}};
/* 自写世界书条目（本地持久）并入罗马卷 */
try{(JSON.parse(localStorage.getItem('guardianDragonLoreCustom')||'[]')||[]).forEach(function(e){
  if(e&&e.title&&e.content)CARDS.luzhi.lorebook.push(e);
});}catch(_){}
var ACTIVE='luzhi';                       /* which card drives the running game session */
var BOOK={side:'luzhi',top:0,cat:0,ent:0};
/* 左边那一列原来只有「类目」一层，而类目是按条目自己的 cat 分的：
   一百六十八个人、四十一代、三十四个横断门类、通史、研究册、通则、文字六组，
   两百五十多行并成一列，翻到底也找不到东西。现在先分大母项，再分类目。
   分法跟世界书自己的层（lay）一致；玩家自写的与请入的角色卡另立一项。 */
/* 名字一律用白话：母条目→目录、通则→基本规矩、文字→怎么写、
   纪年→各个时代、横断→专题、通史→世界史、研究册→地区与书目。
   条目自己的 cat 不动，改的只是这一栏显示的名。 */
var BOOK_TOPS=['目录','基本规矩','怎么写','各个时代','专题','世界史','地区与书目'];
/* 人物一栏原来是一整坨：十六代两百多人挤在一个大母项底下，
   点进去中间那一列要翻两百多行。改成按纪年拆开，名字写成「10000BC-人物」。

   年份不从 FE.eras 取 —— FE 关在闭包里，这一段够不着（试过，整栏退成了
   「纪年1-人物」）。改成从世界书自己身上认：本代那几条的分类名就写着年份，
   长这样「前10000年 史前窝群」「850年 阿拔斯时代的商队」，取前头那一截就够。 */
var _BKY={};
function bookYearScan(lb){
  _BKY={};
  for(var i=0;i<lb.length;i++){var e=lb[i];
    if(!e||e.lay!=='world'||!e.era||_BKY[e.era])continue;
    var m=/^(前)?([0-9]+)年/.exec(e.cat||'');
    if(m)_BKY[e.era]=m[1]?(m[2]+'BC'):(m[2]+'AD');}
}
function bookYear(era){
  return _BKY[era]||('纪年'+era);
}
function bookTop(e){
  if(!e)return '其他';
  if(e.custom||e.cat==='自写'||e.cat==='角色卡')return '自己写的';
  if(e.lay==='core')return (e.ord<10)?'目录':'基本规矩';
  if(e.lay==='style')return '怎么写';
  if(e.lay==='figures')return bookYear(e.era)+'-人物';
  if(e.lay==='world'){
    if(e.cat==='通史')return '世界史';
    if(e.cat==='研究册')return '地区与书目';
    return e.era?'各个时代':'专题';
  }
  return '其他';
}
/* 排序用的号。表上有名字的按表；人物按纪年往后排；自己写的与其他垫底。 */
function bookRank(t,e){
  var i=BOOK_TOPS.indexOf(t);
  if(i>=0)return i;
  if(e&&e.lay==='figures')return 100+(e.era||0);
  return (t==='自己写的')?300:301;
}
/* 条目栏里的名字：把跟类目重复的那截前缀去掉。
   「〔前10000年 · 史前窝群〕国家」在「前10000年 史前窝群」这一类下只写「国家」，
   「刑天 · 第一项 · 概要」在「人 · 刑天」这一类下只写「第一项 · 概要」。
   对不上的前缀（同在通史类下的〔卷首〕〔表一〕〔卷一〕）原样留着，那是有用的。 */
function bookLabel(t,c){
  t=String(t==null?'':t);c=String(c==null?'':c);
  var m=/^〔([^〕]*)〕([\s\S]+)$/.exec(t);
  if(m&&c&&c.replace(/[·\s]/g,'')===m[1].replace(/[·\s]/g,''))return m[2];
  var tail=c.split(' · ').pop();
  if(tail&&tail!==c&&t.indexOf(tail+' · ')===0)return t.slice(tail.length+3);
  return t;
}
/* 有些条目是写给引擎看的规矩，不是世界里的事，资料库这一页不该摆给玩家。
   只是不显示——注入照旧，一条也没少发。
     整条不显示：目录（母条目）· 怎么写那四十八条 · 通则里的常错清单 · 母本的取用规矩
     逐行不显示：世界那几层里指点怎么写的行（禁止…、不要…、游戏内用法…）
   人物那一层是整段散文，不逐行滤——滤了会把整条滤空。
   玩家自己写的和请入的角色卡一律照显，不动人家的东西。 */
var BOOK_HIDE={'〔通则〕这个世界不是那样的 · 八条常错':1,
               '〔母本〕两部书的读法与本卡的取用规矩':1};
var BOOK_META=/禁止|不许|不要|不得|玩家|正文|剧情|写成|怎么写|的用法：|钩子|场面里|场面上|游戏内|取用规矩|不是设定|这一条|本条|写这一段|写他们时|写政治时|写任何一代|触发时|一行一件事|条目|世界书|神谕|提示词/;
function bookHide(e){
  if(!e||e.custom)return false;
  if(e.lay==='style')return true;
  if(e.lay==='core'&&e.ord<10)return true;
  return !!BOOK_HIDE[e.title];
}
function bookText(e){
  var t=String((e&&e.content)||'');
  if(!e||e.custom||!e.lay||e.lay==='figures')return t;
  var a=t.split('\n'),o=[],i;
  for(i=0;i<a.length;i++)if(a[i].trim()&&!BOOK_META.test(a[i]))o.push(a[i]);
  return o.length?o.join('\n'):t;
}
/* 类目栏的名字：去掉「人 · 」「文字 · 」这两个前缀。
   左边那一栏已经写着是「人物」还是「怎么写」了，每一行再重复一遍是白占地方。
   去的只是显示，条目自己的 cat 不动——酒馆那一边和母条目的门类表还照旧用它。 */
function bookCatLabel(c){
  return String(c==null?'':c).replace(/^(人|文字)\s*·\s*/,'');
}
/* 两层目录：大母项 → 类目 → 条目下标。次序按 BOOK_TOPS，表上没有的排在最后。 */
function bookCats(side){
  var lb=(CARDS[side]&&CARDS[side].lorebook)||[],tops=[],tmap={},i;
  bookYearScan(lb);
  for(i=0;i<lb.length;i++){
    if(bookHide(lb[i]))continue;
    var t=bookTop(lb[i]),c=lb[i].cat||'其他';
    if(!tmap[t]){tmap[t]={order:[],map:{},n:0,r:bookRank(t,lb[i])};tops.push(t);}
    var g=tmap[t];
    if(!g.map[c]){g.map[c]=[];g.order.push(c);}
    g.map[c].push(i);g.n++;
  }
  tops.sort(function(a,b){return tmap[a].r-tmap[b].r;});
  return{tops:tops,tmap:tmap};
}
function bookRender(){
  var side=BOOK.side,lb=CARDS[side].lorebook||[],bc=bookCats(side);
  var tabs=document.querySelectorAll('#dlgBook .cxTab');
  for(var t=0;t<tabs.length;t++)tabs[t].classList.toggle('on',tabs[t].getAttribute('data-side')===side);
  var topsEl=$('#cxTops'),catsEl=$('#cxCats'),entsEl=$('#cxEnts');
  if(topsEl)topsEl.innerHTML='';
  catsEl.innerHTML='';entsEl.innerHTML='';
  if(!lb.length){
    $('#cxTtl').textContent='陆之卷';
    $('#cxTxt').textContent='—— 本卷writing中，正在灌注。 ——';
    return;
  }
  if(!bc.tops.length){
    $('#cxTtl').textContent='陆之卷';
    $('#cxTxt').textContent='—— 这一卷没有可看的条目。 ——';
    return;
  }
  if(BOOK.top>=bc.tops.length)BOOK.top=0;
  bc.tops.forEach(function(t,ti){
    var g=bc.tmap[t],d=document.createElement('div');
    d.className='cxTop'+(ti===BOOK.top?' on':'');d.textContent=t;
    var b=document.createElement('i');b.textContent=g.n;d.appendChild(b);
    d.addEventListener('click',function(){BOOK.top=ti;BOOK.cat=0;BOOK.ent=0;bookRender();});
    if(topsEl)topsEl.appendChild(d);
  });
  var grp=bc.tmap[bc.tops[BOOK.top]];
  if(BOOK.cat>=grp.order.length)BOOK.cat=0;
  grp.order.forEach(function(c,ci){
    var d=document.createElement('div');d.className='cxCat'+(ci===BOOK.cat?' on':'');
    d.textContent=bookCatLabel(c);
    d.addEventListener('click',function(){BOOK.cat=ci;BOOK.ent=0;bookRender();});
    catsEl.appendChild(d);
  });
  var ids=grp.map[grp.order[BOOK.cat]];
  if(BOOK.ent>=ids.length)BOOK.ent=0;
  ids.forEach(function(li,ei){
    var e=lb[li],d=document.createElement('div');
    d.className='cxEnt'+(ei===BOOK.ent?' on':'');
    d.textContent=bookLabel(e.title,e.cat);
    d.addEventListener('click',function(){BOOK.ent=ei;bookRender();});
    entsEl.appendChild(d);
  });
  var cur=lb[ids[BOOK.ent]];
  $('#cxTtl').textContent=cur.title;
  $('#cxTxt').textContent=bookText(cur);
  /* 手机上这两栏是横滑的胶囊行：选中项若落在可视范围外（换类目后条目重排、
     或读回上次的选择），玩家只看得见开头几颗，不知道自己停在哪一条。滚到眼前来。
     正文也要回到顶部，否则换条目后还停在上一条读到的位置。 */
  try{
    ['#cxTops','#cxCats','#cxEnts'].forEach(function(sel){
      var host=$(sel);if(!host)return;
      if(host.scrollWidth<=host.clientWidth+1)return;      /* 桌面是竖排，不用管 */
      var on=host.querySelector('.on');if(!on)return;
      host.scrollLeft=Math.max(0,on.offsetLeft-(host.clientWidth-on.offsetWidth)/2);
    });
    var bd=document.querySelector('#dlgBook .cxBody');if(bd)bd.scrollTop=0;
  }catch(_){}
}
(function(){
  var tabs=document.querySelectorAll('#dlgBook .cxTab');
  for(var i=0;i<tabs.length;i++)(function(tb){
    tb.addEventListener('click',function(){BOOK.side=tb.getAttribute('data-side');BOOK.top=0;BOOK.cat=0;BOOK.ent=0;bookRender();});
  })(tabs[i]);
})();

/* ============ mvu_panel: parse + render into the MFD (panelSpec-driven) ============ */
/* 剥离状态栏：先去掉闭合完整的块，再把「开了头却没闭合」的残块从起点截到尾。
   模型撞上 token 上限、或流式尚未吐完时，面板都可能没有 </mvu_panel>——
   若只认闭合块，整段状态栏原文就会漏进正文。 */
/* 面板标签一律用宽松正则认：模型时不时会写成 <MVU_PANEL>、<mvu_panel >、<mvu panel>，
   原来逐字比对 '<mvu_panel>'，认不出就整段面板原文漏进正文，情报台同时冻住。 */
var MVU_RX=/<\s*mvu[_ ]?panel\s*>/i, MVU_RXC=/<\s*\/\s*mvu[_ ]?panel\s*>/i;
function stripMvu(text){
  var t=String(text==null?'':text);
  /* 模型爱把面板裹进 markdown 围栏，剥完面板会剩下两行孤零零的反引号 */
  t=t.replace(/(^|\n)[ \t]*```[a-z]*[ \t]*\n(?=[\s\S]*?<\s*mvu[_ ]?panel\s*>)/gi,'$1');
  t=t.replace(/<\s*mvu[_ ]?panel\s*>[\s\S]*?<\s*\/\s*mvu[_ ]?panel\s*>[ \t]*\n?[ \t]*(```)?/gi,'');
  var m=MVU_RX.exec(t);if(m)t=t.slice(0,m.index);          /* 开了头没闭合 */
  var s=/(^|\n)[ \t]*<\s*sec_(char|npc|world)\s*>/i.exec(t);
  if(s)t=t.slice(0,s.index);                                /* 连外壳都没写，只有裸 sec_* */
  t=t.replace(/<\s*sec_deed\s*>[\s\S]*?<\s*\/\s*sec_deed\s*>/gi,'');
  t=t.replace(/<\s*\/\s*mvu[_ ]?panel\s*>/gi,'');           /* 孤立闭合标签 */
  t=t.replace(/<\s*\/?\s*(mvu[_ ]?pane?l?|sec_[a-z]*)\s*>?[ \t]*$/i,''); /* 流式打到一半的半截标签 */
  t=t.replace(/(^|\n)[ \t]*```[a-z]*[ \t]*$/i,'$1');
  return t.trim();
}
/* 流式期间还要吃掉所有尚未闭合的推理块。Risu 的 Responses 管线使用
   <Thoughts>，其他兼容端点还会发 <think>/<analysis>/<reasoning>；只认一种标签
   就会在正文到达前把内部草稿逐字打进叙事栏。 */
function stripMvuLive(text){
  var t=stripCoT(String(text==null?'':text));
  return stripMvu(t);
}
/* 视觉小说那只对话框念的是同一段正文，洗法就该是同一套。
   它原先自带一份粗的（只剥 <mvu_panel> 与裸标签），思维链、六种 sec_* 段、
   markdown 围栏一概认不出：一回合正文是空的、只带着几段状态回执，
   剥完标签剩下的回执文字照样被切成句子念出来——玩家那边看着就是
   「明明没有正文，全屏一进去对话框还是弹出来」。 */
/* 出了岔子就让它抛出去：调用方（talkText）接住之后会退回自己那几条粗规矩，
   在这儿把原文原样交回去反而是最糟的——那正是要洗掉的东西。 */
try{window.felProse=function(t){return stripMvuLive(t);};}catch(_){}
/* 状态栏字段名的繁体/异体归一表。模型（尤其被要求繁中输出、或前文出现繁体时）
   某一回把字段写成 ◆戎裝/◆血興/◆心聲/◆史筆/◇天氣/◇紀年/◇安穩，mvuMerge 按字符串
   精确比对就认成全新的键：角色段从 8 行变 14 行，而且并集永不淘汰，此后每一回合都在，
   即使模型改回简体也去不掉。顺带 血興 匹配不上 widgets（进度条没有位阶文案）、
   天氣 匹配不上 glyphSrc（心象图不亮）——「mvu 某些项目不作用」的一大来源。 */
var _MVUK={'戎裝':'戎装','血興':'血兴','心聲':'心声','史筆':'史笔','神軀':'神躯','觀瞻':'观瞻',
  '禦體':'御体','御體':'御体','衣冠':'衣冠','持物':'持物','神格':'神格',
  '天氣':'天气','紀年':'纪年','安穩':'安稳','時地':'时地','大勢':'大势','將臨':'将临',
  '氣候':'天气','時間':'时地','紀元':'纪年'};
function mvuKey(k){
  k=String(k==null?'':k).replace(/\s+/g,'');
  if(_MVUK[k])return _MVUK[k];
  var v=k;try{v=t2s(k);}catch(_){}
  return _MVUK[v]||v;
}
function parseMvu(text){
  var src=String(text==null?'':text);
  var mo=MVU_RX.exec(src),body=null;
  if(mo){
    var rest=src.slice(mo.index+mo[0].length),mc=MVU_RXC.exec(rest);
    body=mc?rest.slice(0,mc.index):rest;                    /* 未闭合就读到结尾，能认多少认多少 */
  }else{
    /* 没写外壳、直接甩出 <sec_char> 的情况也认，否则整段状态全丢 */
    var ms=/(^|\n)[ \t]*<\s*sec_(char|npc|world)\s*>/i.exec(src);
    if(!ms)return null;
    body=src.slice(ms.index);
  }
  var p={ch:[],npc:[],wd:[]},sec=null,any=false;
  body.split('\n').forEach(function(ln){
    ln=ln.replace(/^[\s>*\-]+/,'').replace(/\s+$/,'');       /* 容忍 markdown 引用/列表前缀 */
    if(!ln||ln.indexOf('```')===0)return;
    if(/<\s*sec_char\s*>/i.test(ln)){sec='ch';return;}
    if(/<\s*sec_npc\s*>/i.test(ln)){sec='npc';return;}
    if(/<\s*sec_world\s*>/i.test(ln)){sec='wd';return;}
    /* 段落收尾、以及模型自造的段落（<sec_deed> 写错位置写进了面板里、<sec_omen> 之类），
       都必须把当前段清掉。原来只是 return，sec 还留在上一段上，于是
       「▣兴作|神庙×1」「吉兆|白鹿现于苑中」这些行统统落进「天下大势」，
       而 mvuMerge 只并集不淘汰——这些垃圾行此后每一回合都在，再也去不掉。 */
    if(/^<\s*\/?\s*sec_/i.test(ln)){sec=null;return;}
    if(ln.charAt(0)==='<')return;
    if('▣▷▶●○★☆'.indexOf(ln.charAt(0))>=0)return;      /* 回执／自造符号，不是面板的行 */
    var c0=ln.charAt(0),rs=(c0==='◆')?'ch':(c0==='◈')?'npc':(c0==='◇')?'wd':null;
    var raw=rs?ln.slice(1):ln;
    /* 行首符号漏写时，按它所在的段归类，而不是整行丢掉 */
    if(!rs){if(!sec)return;if(raw.indexOf('|')<0&&raw.indexOf('｜')<0)return;rs=sec;}
    var parts;
    if(rs==='npc'){
      parts=raw.split(/\s*[|｜│]\s*/);                       /* ◈ 是九字段，全拆 */
    }else{
      /* ◆/◇ 是「键|值」两段：值里本来就可能有竖线（◇大势 的官方写法就是
         「高卢索金｜元老院流亡维爱｜…」），只在第一个分隔符处切一刀，别把值拆散。 */
      var mk=/^([^|｜│]*)[|｜│]([\s\S]*)$/.exec(raw);
      if(!mk)return;
      parts=[mk[1],mk[2].replace(/^\s+/,'')];
    }
    if(parts.length<2)return;
    parts[0]=parts[0].replace(/\s+/g,'');                    /* 键名去空格，否则进度条匹配不上 */
    /* 键名繁简归一。模型偶尔写成 ◆戎裝/◆血興/◆心聲/◇天氣/◇安穩，mvuMerge 按字符串
       精确比对，认成全新的键：角色段从 8 行变 14 行，而且并集永不淘汰，此后每回合都在。
       同时 血興 匹配不上 widgets（没有进度条位阶）、天氣 匹配不上 glyphSrc（心象图不亮）。
       只归一键名，值一律保留原样——玩家想看繁体正文是玩家的事。 */
    if(rs!=='npc')parts[0]=mvuKey(parts[0]);
    p[rs].push(parts);any=true;
  });
  return any?p:null;                                         /* 空壳面板不再把情报台清空 */
}
/* 逐字段合并：AI 这轮漏写的行沿用上一轮的值，写了的才覆盖。
   协议里那句「无变动者照抄上一幕原值」本来只是写给模型看的，前端从没实现过——
   于是模型一漏写，那一行就直接从面板上消失了。 */
function mvuMerge(prev,next){
  if(!next)return prev||null;
  if(!prev)return next;
  var out={ch:[],npc:[],wd:[]};
  ['ch','wd'].forEach(function(sk){
    var seen={},order=[];
    (prev[sk]||[]).forEach(function(kv){if(!(kv[0] in seen))order.push(kv[0]);seen[kv[0]]=kv.slice();});
    (next[sk]||[]).forEach(function(kv){
      if(!kv.slice(1).join('|').trim())return;               /* 写了但值是空的，当没写，保旧值 */
      if(!(kv[0] in seen))order.push(kv[0]);
      seen[kv[0]]=kv.slice();
    });
    out[sk]=order.map(function(k){return seen[k];});
  });
  /* 在场名单整段替换：写了就以新的为准，没写才留旧的，否则离场的人会永远赖在面板上 */
  out.npc=((next.npc||[]).length?next.npc:(prev.npc||[])).slice();
  return out;
}
function esc2(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
/* 主角心声：取玩家最近一次「~」开头的内心独白。
   卡之铁则一——她的言语行动决定与内心皆属玩家，故此栏不由 AI 代笔，只回放你自己写下的那一句。 */
function heroMind(within){
  if(typeof TURNS==='undefined')return '';
  var lim=(within==null)?1e9:within,scan=0;   /* within：最多往回看几条玩家发言 */
  for(var i=TURNS.length-1;i>=0;i--){
    var tn=TURNS[i];if(!tn||tn.role!=='user')continue;
    if(++scan>lim)return '';
    var c=String(tn.content||'').replace(/^【[^】]*】\s*/,'').trim();
    if(c.charAt(0)==='~'||c.charAt(0)==='～')return c.slice(1).trim();
  }
  return '';
}
/* 心声的占位符集合。卡里的开局面板本身就写着 ◆心声|—— ，而状态栏协议又要求模型
   「玩家没写就把上一幕的 ◆心声 原样抄下来」——于是这个破折号被一幕一幕抄下去，
   永远占着这一栏，玩家写过的独白反而回落不到。一律按「没写」处理。 */
function mindBlank(v){
  var t=String(v==null?'':v).replace(/[\s　]/g,'');
  /* 先剥掉包在外面的括号与引号：模型很爱写「（无）」「『——』」这种。 */
  for(var i=0;i<3;i++)t=t.replace(/^[「『（(【\["']+|[」』）)】\]"']+$/g,'');
  if(!t)return true;
  if(/^[—–\-－ーｰ_~〜～…·．.、,，:：;；]+$/.test(t))return true;
  /* 「沉默」「无言」是真实的内心状态，不算占位——只挑没有信息量的那几个词。 */
  return /^(无|無|空|略|未定|未写|未寫|不详|不詳|待定|同上|同前|无变化|無變化|无内容|暂无|暫無|N\/?A|null|none)$/i.test(t);
}
function capFor(caps,v){var lab='';if(!caps)return lab;
  for(var i=0;i<caps.length;i++)if(v>=caps[i][0])lab=caps[i][1];return lab;}
/* 数值容错：模型常写成 72/100、７２、72（微升）这几种。角色段与世界段共用一套，
   否则同一份面板在两段里一个有进度条一个没有。 */
function mvuNum(v){
  var t=String(v==null?'':v).replace(/[０-９]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-65248);});
  var m=/^\s*(\d{1,3})\s*(?:\/\s*100)?\s*(?:[（(][^)）]*[)）])?\s*$/.exec(t);
  return m?m[1]:null;
}
/* 入梦/起床开关：仅艳后线可见；文案随当前所在世界翻面。面板是判定的唯一事实源。 */
var DREAMARM=null;   /* 已武装的睡醒意图：'入梦'|'起床'|null，随下一手输入一并发出 */
function dreamSync(panel){
  var di=document.getElementById('dreamIn'),dw=document.getElementById('dreamOut');
  if(!di||!dw)return;
  var show=(ACTIVE==='cleo');
  di.style.display=show?'':'none';
  dw.style.display=show?'':'none';
}
function renderMvu(panel){
  if(!panel)return;
  try{dreamSync(panel);}catch(_){}
  var spec=(CARDS[ACTIVE]&&CARDS[ACTIVE].panelSpec)||null;
  var h='<div class="mSec"><div class="mHead"><i>◆</i>&nbsp;'+'角色状态'+'</div>';
  var bars=[],glyphSrc=null,glyphMap=null;
  if(spec&&spec.widgets)spec.widgets.forEach(function(w){
    if(w.type==='bar')bars.push(w);
    if(w.type==='moodglyph'){glyphSrc=w.src;glyphMap=w.map;}
  });
  var aiMind='';
  /* 原来这个正则的两个分支字面完全一样（本该是 心声|心聲）：模型写成繁体的 ◆心聲 时
     既认不出是心声，又会作为普通资料行混进列表，于是「心聲 / 哼」和『——』同时出现。
     另外「——」这类占位符不算内容：它一旦被当成真值，下面那条回落链就在这里断了，
     玩家明明写过独白也回落不到，心声这一栏从此永远停在一个破折号上。 */
  panel.ch.forEach(function(kv){
    if(!/^(心声|心聲)/.test(kv[0]||''))return;
    var mv=kv.slice(1).join('|');
    if(!mindBlank(mv))aiMind=mv;
  });
  /* 卡里的 panelSpec.textOrder 声明了这几栏「本卡必有、且按此顺序」，reserved 声明了
     「属于叙述性的长文，排在数值之后」。这两个字段此前从没被任何代码读过——
     于是行序全看模型当轮的心情，声明过却一次没写过的栏位干脆永不出现。
     这里据其重排并补位：缺的栏留一个占位行，让人看得见「这一栏存在，只是这轮没写」。 */
  (function(){
    var want=(spec&&spec.textOrder)||[],rsv=(spec&&spec.reserved)||[];
    if(!want.length&&!rsv.length)return;
    var byK={},extra=[],tail=[];
    panel.ch.forEach(function(kv){
      var k=kv[0]||'';
      if(/^心声/.test(k))return;
      if(byK[k])return;
      byK[k]=kv;
      if(want.indexOf(k)<0&&rsv.indexOf(k)<0)extra.push(kv);
      else if(rsv.indexOf(k)>=0)tail.push(kv);
    });
    var out=[];
    want.forEach(function(k){out.push(byK[k]||[k,'']);});      /* 缺了也占位 */
    out=out.concat(extra,tail);
    panel.ch.forEach(function(kv){if(/^心声/.test(kv[0]||''))out.push(kv);});
    panel.ch=out;
  })();
  panel.ch.forEach(function(kv){
    var k=kv[0],v=kv.slice(1).join('|');
    if(/^(心声|心聲)/.test(k))return;             /* 心声另起引言块，不混在资料列里 */
    /* 数值容错：模型常写成 72/100、７２、72（微升）这几种，原来只认纯数字，
       一不合规就退化成文字行，进度条与位阶文案一起消失。 */
    var _mn=mvuNum(v);
    var isNum=_mn!==null;if(isNum)v=_mn;
    var bw=null;if(isNum&&bars.length)bars.forEach(function(b){if(b.k===k)bw=b;});
    if(bw){
      var n=Math.max(0,Math.min(100,parseInt(v,10)||0));
      h+='<div class="mRow"><span>'+esc2(bw.label||k)+'</span><b>'+n+'</b></div>'
        +'<div class="mBar"><i style="width:'+n+'%"></i></div>'
        +'<div class="mCap">'+esc2(capFor(bw.caps,n))+'</div>';
    }else if(isNum){
      var n2=Math.max(0,Math.min(100,parseInt(v,10)||0));
      h+='<div class="mRow"><span>'+esc2(k)+'</span><b>'+n2+'</b></div><div class="mBar"><i style="width:'+n2+'%"></i></div>';
    }else if(!String(v).trim()){
      /* 声明过但本轮没写：留个灰位，胜过整栏凭空消失 */
      h+='<div class="mRow"><span>'+esc2(k)+'</span></div><div class="mLead mute">—</div>';
    }else{
      h+='<div class="mRow"><span>'+esc2(k)+'</span></div><div class="mLead">'+esc2(v)+'</div>';
    }
  });
  /* 心声：她自己的那一句。玩家写过内心独白就以玩家为准（铁则一：她的内心属于玩家），
     否则回落到开局/面板里写好的那一句，让人一进来就看见这一栏是干什么的。 */
  /* 只回放「本回合」玩家写的独白；这回没写就让位给 AI 的 ◆心声，都没有才退回旧句。
     否则玩家第 3 回合写过一次 ~，第 50 回合这一栏还挂着那句，成了摆设。 */
  /* 窗口从 2 收到 1：玩家写 ~ 的那一回以他的原话为准（铁则一），
     下一回就把这栏交还给模型的当幕心声，否则每次都要慢一拍才动。 */
  var mind=heroMind(1)||aiMind||heroMind();
  h+='<div class="mRow"><span>'+'心 声'+'</span></div>'
    +(mind?('<div class="mMind">『'+esc2(mind)+'』</div>')
          :('<div class="mMind mute">以&nbsp;<b>~</b>&nbsp;开头发言，即记于此</div>'));
  h+='</div>';
  if(panel.npc.length){
    h+='<div class="mSec"><div class="mHead"><i>◆</i>&nbsp;'+'在场人物'+'</div>';
    panel.npc.forEach(function(n){
      var name=n[0]||'',st=n[1]||'',fav=parseInt(n[2],10),mind=n[3]||'',role=n[4]||'',loc=n[5]||'',eye=n[8]||'';
      h+='<div class="mNpc"><div class="nHead"><span class="nName">'+esc2(name)+'</span><span class="nRole">'+esc2(role)+(loc?'&nbsp;·&nbsp;'+esc2(loc):'')+'</span></div>';
      if(!isNaN(fav))h+='<div class="mBar" style="margin-top:6px"><i style="width:'+Math.max(0,Math.min(100,fav))+'%"></i></div>';
      if(st)h+='<div class="nLine">'+esc2(st)+'</div>';
      if(mind)h+='<div class="nMind">『'+esc2(mind)+'』</div>';
      if(eye&&eye!=='不详'&&eye!=='（未估）')h+='<div class="nEye">眼色 · '+esc2(eye)+'</div>';
      h+='</div>';
    });
    h+='</div>';
  }
  if(panel.wd.length){
    h+='<div class="mSec"><div class="mHead"><i>◆</i>&nbsp;'+'当前局势'+'</div>';
    panel.wd.forEach(function(kv){
      var k=kv[0],v=kv.slice(1).join('|');
      /* 世界段原来只认纯数字：AI 写「安稳|35/100」或全角「３５」，这条唯一的世界进度条
         就整条消失、退化成一行灰字，而紧挨着的角色段「神格|72/100」照常出条——
         同一份面板走正常回合有条、读档后没条。两段共用同一套容错。 */
      var _wn=mvuNum(v);
      if(_wn!==null){
        var n=Math.max(0,Math.min(100,parseInt(_wn,10)||0));
        h+='<div class="mRow"><span>'+esc2(k)+'</span><b>'+n+'</b></div><div class="mBar"><i style="width:'+n+'%"></i></div>';
      }else{
        h+='<div class="mRow"><span>'+esc2(k)+'</span></div><div class="mLead">'+esc2(v)+'</div>';
        if(glyphSrc&&k===glyphSrc&&glyphMap){
          for(var gi=0;gi<glyphMap.length;gi++){
            if(v.indexOf(glyphMap[gi][0])>=0){
              h+='<div class="mGlyph"><b>'+glyphMap[gi][1]+'</b><span>'+esc2(glyphMap[gi][2])+'</span></div>';break;
            }
          }
        }
      }
    });
    h+='</div>';
  }
  /* —— 図谱 CHAIN × 记忆 MEM（Ghost 原版移植）—— */
  GAME.lastPanel=panel;
  try{memSync();}catch(_){}
  /* 宫殿存于 IndexedDB，读取是异步的；先按缓存绘制，再在当前存档抽屉变化时
     自动补画一次。事件年表和长期记忆从此不再读取旧的自动摘要。 */
  try{palaceUiSync();}catch(_){}
  h+='<div class="zjP">'
    +'<div class="mSec">'+zjHead(S.secG,'tgG','','人物关系',S.secG)+(S.secG?'<div id="zjGraphBox" class="fade">'+graphInner()+'</div>':'')+'</div>'
    +'<div class="mSec">'+zjHead(S.secA,'tgA','','事件年表',S.secA)+(S.secA?'<div class="fade">'+axisInner()+'</div>':'')+'</div>'
    +'<div class="mSec">'+zjHead(S.secM,'tgM','','长期记忆',S.secM)+(S.secM?'<div class="fade zjMemPane">'+memPaneInner(true)+'</div>':'')+'</div>'
    +'</div>';
  document.querySelector('#game .gMfd').innerHTML=h;
  /* 情报台整块重绘后，按文档顺序给各分区派发错开量（55ms 一级，封顶 220ms）。
     父子错开是让「一整块刷新」读起来有先后，而不是齐刷刷跳一下。 */
  try{
    var _secs=$('#game .gMfd').querySelectorAll('.mSec');
    for(var _i=0;_i<_secs.length;_i++)
      _secs[_i].style.animationDelay=Math.min(_i*55,220)+'ms';
  }catch(_){}
  try{mvRingMount();}catch(_){}
  try{graphHydrate();}catch(_){}
  try{zj3dTick();}catch(_){}
  /* 上面两句才把図谱与小图填进去，挂载时量的高度已经过时：逼下一帧重量 */
  try{if(typeof MV!=='undefined'&&MV)MV.w=0;}catch(_){}
}
/* ═══════════ 図谱 CHAIN × 记忆 MEM（Ghost 原版整件移植：蛛网引擎/PERSONNEL FILE/编年长卷）═══════════ */
var S={history:[],memNpc:null,_npcMetaBusy:null,memEdit:null,secG:true,secA:true,secM:true,
  graphHidden:[],npcMeta:{},mem:[],memOn:true,memN:0};
var PALACE_UI={session:'',drawers:[],signature:'',loading:false,ready:false,error:'',checkedAt:0};
function palaceUiEnabled(){
  try{return !!(GAME&&GAME.memoryId&&SET.semantic&&SET.semantic.on!==0);}catch(_){return false;}
}
function palaceUiDrawers(){
  var id='';try{id=felMemoryId();}catch(_){}
  return id&&PALACE_UI.session===id&&PALACE_UI.ready?(PALACE_UI.drawers||[]):[];
}
function palaceUiSync(force){
  if(!palaceUiEnabled()||!FEL_RISU||typeof FEL_RISU.getPalaceDrawers!=='function')return;
  var id=felMemoryId(),now=Date.now();
  if(PALACE_UI.loading)return;
  if(!force&&PALACE_UI.session===id&&now-PALACE_UI.checkedAt<700)return;
  PALACE_UI.loading=true;PALACE_UI.session=id;
  FEL_RISU.getPalaceDrawers(id).then(function(drawers){
    if(PALACE_UI.session!==id)return;
    drawers=Array.isArray(drawers)?drawers:[];
    var sig=drawers.map(function(d){return d.id;}).join('|'),changed=!PALACE_UI.ready||sig!==PALACE_UI.signature;
    PALACE_UI.drawers=drawers;PALACE_UI.signature=sig;PALACE_UI.ready=true;PALACE_UI.error='';PALACE_UI.checkedAt=Date.now();
    if(changed&&GAME.lastPanel)setTimeout(function(){try{renderMvu(GAME.lastPanel);}catch(_){}},0);
  }).catch(function(e){
    if(PALACE_UI.session!==id)return;
    PALACE_UI.ready=true;PALACE_UI.error=(e&&e.message)||String(e);PALACE_UI.checkedAt=Date.now();
    if(GAME.lastPanel)setTimeout(function(){try{renderMvu(GAME.lastPanel);}catch(_){}},0);
  }).finally(function(){if(PALACE_UI.session===id)PALACE_UI.loading=false;});
}
function palaceParts(drawer){
  var c=String((drawer&&drawer.content)||''),u='',w='';
  var um=/【玩家原文】\n([\s\S]*?)(?=\n\n【世界原文】|$)/.exec(c);
  var wm=/【世界原文】\n([\s\S]*)$/.exec(c);
  if(um)u=um[1].trim();if(wm)w=wm[1].trim();
  if(!u&&!w)w=c.trim();
  return {u:u,w:w};
}
function palaceEraLabel(){
  try{return String((GAME.op&&GAME.op.era)||((GAME.lastPanel&&GAME.lastPanel.wd||[]).filter(function(x){return x[0]==='纪年';})[0]||[])[1]||'本局');}
  catch(_){return '本局';}
}
function esc(s){return esc2(s);}
function stripCoT(t){
  return String(t||'')
    .replace(/<\s*felinia_state\b[^>]*>[\s\S]*?<\s*\/\s*felinia_state\s*>/gi,'')
    .replace(/<\s*(think|thoughts?|analysis|reasoning)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,'')
    .replace(/```(?:analysis|reasoning|think|thoughts?)\b[^\n]*\n[\s\S]*?```/gi,'')
    /* 流式中闭合标记尚未到达时，从开头一直隐藏到当前尾部。最终回复若缺少
       闭合标记也同样宁可丢弃内部草稿，不让它进入剧情、翻译或存档。 */
    .replace(/<\s*felinia_state\b[^>]*>[\s\S]*$/gi,'')
    .replace(/<\s*(think|thoughts?|analysis|reasoning)\b[^>]*>[\s\S]*$/gi,'')
    .replace(/```(?:analysis|reasoning|think|thoughts?)\b[^\n]*\n[\s\S]*$/gi,'')
    .trim();
}
function reducedMotion(){try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){return false;}}
function currentOpening(){return GAME.op||null;}
function zjSelf(){return heroName();}
function zjL(){return {fdT:'人物列传',rel:'关系',trust:'信任',stat:'近况',voice:'心声',file:'档案',last:'末见',prev:'◀ 前一人',next:'后一人 ▶',nd:'无　载',fr:'亲厚',ne:'平淡',ho:'疏敌',tag:'汗'};}
function zjAuxReady(){return (typeof subReady==='function'&&subReady())||apiReady();}
function callAuxAI(sys,msgs){
  return new Promise(function(res,rej){
    var m=[{role:'system',content:sys}].concat(msgs);
    if(typeof subReady==='function'&&subReady())risuAuxInvoke(m,res,rej);
    /* aux:1 —— 绝不碰 GENAC，「✕ 中断」永远只掐正文那一路；
       noStream + maxCont:0 —— 辅助调用要的是一小段结构化结果，不需要流式也不需要续写。 */
    else if(apiReady())risuInvoke(m,res,rej,{aux:1,noStream:true,maxCont:0});
    else rej('未配置接口');
  });
}
function savePref(){
  SET.zj=SET.zj||{};
  SET.zj[ACTIVE]={graphHidden:S.graphHidden,npcMeta:S.npcMeta,mem:S.mem,memOn:S.memOn,memN:S.memN,secG:S.secG,secA:S.secA,secM:S.secM};
  setStore();
}
function zjLoadPref(){
  var z=(SET.zj||{})[ACTIVE]||{};
  S.graphHidden=z.graphHidden||[];S.npcMeta=z.npcMeta||{};S.mem=z.mem||[];
  S.memOn=z.memOn!==false;S.memN=z.memN||0;
  if(z.secG!=null)S.secG=z.secG;if(z.secA!=null)S.secA=z.secA;if(z.secM!=null)S.secM=z.secM;
  S.memNpc=null;S.memEdit=null;
}
function render(){if(GAME.lastPanel)renderMvu(GAME.lastPanel);}
/* ROME 面板 → Ghost 形（npcs 对象数组 / world 键值映射），逐轮缓存 */
function zjPanel(txt,box){
  if(box.k===txt)return box.p;
  var p=parseMvu(txt),g=null;
  if(p){
    g={npcs:[],world:{}};
    (p.npc||[]).forEach(function(n){var fv=parseInt(n[2],10);
      /* ◈ 是九字段：名|状态|好感|心声|身份|所在|年龄|性别|眼色。原来只取到 n[5]，
         年龄性别被直接丢掉——档案窗那两栏于是永远空着，还每次触发一次辅助 AI
         去「推断」这两项，等于 AI 写好了扔掉再花钱猜回来。 */
      g.npcs.push({name:String(n[0]||'').trim(),state:n[1]||'',favor:isNaN(fv)?null:Math.max(0,Math.min(100,fv)),thought:n[3]||'',role:n[4]||'',place:n[5]||'',age:String(n[6]||'').trim(),sex:String(n[7]||'').trim()});});
    (p.wd||[]).forEach(function(kv){g.world[kv[0]]=kv.slice(1).join('|');});
    (p.ch||[]).forEach(function(kv){if(kv[0]==='史笔')g.world['记录']=kv.slice(1).join('|');});
  }
  box.k=txt;box.p=g;return g;
}
var _zjOpC={};
function zjSyncHist(){
  var out=[];
  if(GAME.opText)out.push({role:'world',text:GAME.opText,panel:zjPanel(GAME.opText,_zjOpC)});
  TURNS.forEach(function(t){
    if(t.role==='user')out.push({role:'user',text:t.display||t.content});
    else if(t.role==='assistant'){t._zjc=t._zjc||{};var _zt=t.display||t.content;out.push({role:'world',text:_zt,panel:zjPanel(_zt,t._zjc)});}
  });
  S.history=out;
}
/* 归一人物名：去空白（含全角空格）、去掉尾部括注（如「巴特（少佐副手）」→「巴特」），
   使同一人的不同写法合并为同一节点，杜绝图谱里「同一人重复出现、只状态不同」。 */
function npcKey(name){return String(name||'').replace(/[\s　]+/g,'').replace(/[（(【\[][^）)】\]]*[）)】\]]?\s*$/,'');}
function npcStats(){
  zjSyncHist();
  var map={},order=[];
  S.history.forEach(function(h){
    if(h.role!=='world')return;
    var p=h.panel;
    if(!p||!p.npcs)return;
    p.npcs.forEach(function(np){
      if(!np||!np.name)return;
      var disp=String(np.name).trim();var key=npcKey(disp)||disp;
      if(!key)return;
      if(!map[key]){map[key]={name:disp,n:0};order.push(key);}
      var o=map[key];o.n++;
      /* 展示名取更简洁（去括注）的那个 */
      if(disp&&disp.length<o.name.length)o.name=disp;
      if(np.favor!=null)o.favor=np.favor;
      if(np.state)o.state=np.state;
      if(np.thought)o.thought=np.thought;if(np.role)o.role=np.role;if(np.place)o.place=np.place;if(np.age)o.age=np.age;if(np.sex)o.sex=np.sex;
    });
  });
  var pre=presetNpcMeta(),preK={};Object.keys(pre).forEach(function(nm){preK[npcKey(nm)]=pre[nm];});var meta=S.npcMeta||{};return order.map(function(k){var o=map[k];var pm=pre[o.name]||preK[k];if(pm){if(!o.role&&pm.role)o.role=pm.role;if(!o.place&&pm.place)o.place=pm.place;if(!o.age&&pm.age)o.age=pm.age;if(!o.sex&&pm.sex)o.sex=pm.sex;}var mm=meta[o.name]||meta[k];if(mm){if(!o.role&&mm.role)o.role=mm.role;if(!o.place&&mm.place)o.place=mm.place;if(!o.age&&mm.age)o.age=mm.age;if(!o.sex&&mm.sex)o.sex=mm.sex;}return o;}).filter(function(o){return (S.graphHidden||[]).indexOf(o.name)<0;});
}
/* 好感度记忆：把曾登场每个人物的最近好感与近况汇成一段，注入系统提示——
   人物暂时离场也不「健忘」，再登场须自此值续演，不得凭空重置或乱跳。 */
function npcFavorDigest(){
  var ns=npcStats();if(!ns.length)return '';
  var rows=ns.filter(function(o){return o.name&&o.favor!=null;}).slice(-30).map(function(o){
    return '· '+o.name+'：好感 '+o.favor+(o.state?('（近况：'+String(o.state).slice(0,24)+'）'):'');
  });
  return rows.length?rows.join('\n'):'';
}
function npcPairs(){
  zjSyncHist();
  var hid=S.graphHidden||[],pc={};
  S.history.forEach(function(h){
    if(h.role!=='world')return;var p=h.panel;if(!p||!p.npcs)return;
    var names=[];p.npcs.forEach(function(np){if(np&&np.name&&hid.indexOf(np.name)<0&&names.indexOf(np.name)<0)names.push(np.name);});
    for(var i=0;i<names.length;i++)for(var j=i+1;j<names.length;j++){var a=names[i],b=names[j];var k=a<b?a+'\u0001'+b:b+'\u0001'+a;pc[k]=(pc[k]||0)+1;}
  });
  return pc;
}
function presetNpcMeta(){
  try{
    var op=currentOpening();if(!op||!op.text)return {};
    var p=zjPanel(op.text,_zjOpC);if(!p||!p.npcs)return {};
    var m={};p.npcs.forEach(function(np){if(np&&np.name)m[np.name]={role:np.role||'',place:np.place||'',age:np.age||'',sex:np.sex||''};});
    return m;
  }catch(e){return {};}
}
var NPCMETA_SYS='你是人物设定提取器。下面给你一个历史神话角色扮演游戏里某NPC的历次出场片段，请推断其四项固定资料。只输出一个JSON对象，不要任何解释、不要代码块围栏：\n{"role":"其人身份或职业，如 君王/侍女/元老/将军/方士，尽量简短(≤5字)","place":"最近所在地","age":"年龄，可填数字或如 约四十","sex":"男 或 女"}\n凡片段中确实无从判断的字段，填空字符串""。';
function npcMetaContext(name){
  zjSyncHist();
  var out=[];
  for(var i=0;i<S.history.length;i++){
    var h=S.history[i];if(h.role!=='world')continue;
    var p=h.panel;
    if(p&&p.npcs)p.npcs.forEach(function(np){if(np&&np.name===name&&(np.state||np.thought))out.push('◈'+name+'｜'+(np.state||'')+(np.thought?'｜心声:'+np.thought:''));});
    var txt=stripCoT(stripMvu(h.text));var idx=txt.indexOf(name);
    if(idx>=0)out.push(txt.slice(Math.max(0,idx-46),idx+140).replace(/\s+/g,' '));
  }
  return out.slice(-16).join('\n').slice(0,2200);
}
function npcMetaParse(t){
  t=String(t||'');var m=/\{[\s\S]*\}/.exec(t);if(!m)return null;
  try{var o=JSON.parse(m[0]);var sx=String(o.sex||'').trim();sx=/女/.test(sx)?'女':(/男/.test(sx)?'男':'');
    return {role:String(o.role||'').trim().slice(0,12),place:String(o.place||'').trim().slice(0,16),age:String(o.age||'').trim().slice(0,10),sex:sx};}catch(e){return null;}
}
function npcMetaFill(name){
  if(!name||S._npcMetaBusy||!zjAuxReady())return;
  if(!S.npcMeta)S.npcMeta={};
  var ctx=npcMetaContext(name);if(!ctx)return;
  S._npcMetaBusy=name;
  var c0=document.getElementById('zjGraphCard');if(c0&&S.memNpc===name)c0.innerHTML=graphCardHtml();
  callAuxAI(NPCMETA_SYS,[{role:'user',content:'【NPC】'+name+'\n【历次出场片段】\n'+ctx}]).then(function(t){
    S.npcMeta[name]=npcMetaParse(t)||{role:'',place:'',age:'',sex:''};savePref();
  },function(){S.npcMeta[name]={role:'',place:'',age:'',sex:''};}).then(function(){
    S._npcMetaBusy=null;var c1=document.getElementById('zjGraphCard');if(c1&&S.memNpc===name)c1.innerHTML=graphCardHtml();
  });
}
/* ── 図谱 CHAIN 蛛网×文件夹合体：旧蛛网引擎（环/hub聚类布局+连线+GPH弹簧拖拽+GZOOM缩放），
   节点渲染换终端文件夹图标（fdFolderSvg 缩小版+状态灯+姓名小字，中心=SELF
   文件夹略大），轻点节点开 PERSONNEL FILE 档案窗（.fd-ov 独立层/◀▶循环/手机底部抽屉保留）。
   数据源不动：npcStats()/npcPairs()/npcMetaFill/callAuxAI/npcFavorDigest 照旧；减动效=关弹簧物理静态布局。 */
function fdRounds(){ /* 渲染层辅助：各NPC最近出现轮次 + 当前在场集合（只读 history，不改聚合） */
  zjSyncHist();
  var last={},present={},round=0;
  S.history.forEach(function(h){
    if(h.role!=='world')return;round++;
    var p=h.panel;if(!p||!p.npcs)return;
    var names={};
    p.npcs.forEach(function(np){if(np&&np.name){var k=npcKey(String(np.name).trim())||String(np.name).trim();last[k]=round;names[k]=1;}});
    present=names;
  });
  return {last:last,present:present,total:round};
}
function fdLampCol(o){ /* 状态灯色阶：高=绿 中=琥珀 低/敌意=红 未知=灰 */
  var fv=Number(o&&o.favor);
  if(!isFinite(fv))return 'var(--t-g4)';
  return fv>=70?'var(--t-g2)':fv>=40?'var(--t-a2)':'var(--t-r1)';
}
function fdFolderSvg(lamp,self){ /* 罗马名牌 TABVLA：方框+四角刻线+状态灯，本体=鎏金框 */
  var st=self?'#523000':'#5f5c53';
  return '<svg class="fd-fold" width="44" height="34" viewBox="0 0 44 34" aria-hidden="true">'
    +'<rect x="4.5" y="5.5" width="35" height="23" fill="#e8e2d4" stroke="'+st+'" stroke-width="1"'+(self?'':' stroke-opacity=".75"')+'/>'
    +'<path d="M1.5 9.5 V1.5 H9.5 M34.5 1.5 H42.5 V9.5 M42.5 24.5 V32.5 H34.5 M9.5 32.5 H1.5 V24.5" fill="none" stroke="'+(self?'#845800':'#9e9a8c')+'" stroke-width="1"/>'
    +'<path d="M9 23.5 H'+(self?'30':'24')+'" fill="none" stroke="'+st+'" stroke-width="1" opacity=".4"/>'
    +(self
      ?'<text x="9" y="17.5" font-size="'+'9'+'" fill="#523000" font-family="var(--mono)" letter-spacing="2">'+zjL().tag+'</text>'
      :'<rect x="32" y="9" width="5" height="5" fill="'+lamp+'"/>')
    +'</svg>';
}
function graphInner(){
  var ns=npcStats();
  if(!ns.length)return '<div style="padding:18px 0 6px;text-align:center;font-size:11.5px;letter-spacing:.2em;color:var(--mut);line-height:2">尚无人物入谱<br>与众人相逢相知后，此处自动结成人物图谱</div>';
  var vis={};ns.forEach(function(o){vis[o.name]=1;});
  var pc=npcPairs();
  var adj={'__c':[]};ns.forEach(function(o){adj[o.name]=[];});
  var gnames=ns.map(function(o){return o.name;}),gidx={};ns.forEach(function(o){gidx[o.name]=o;});
  Object.keys(pc).forEach(function(k){var ab=k.split('\u0001');if(!vis[ab[0]]||!vis[ab[1]])return;adj[ab[0]].push(ab[1]);adj[ab[1]].push(ab[0]);});
  var guf={};gnames.forEach(function(n){guf[n]=n;});
  function gfind(x){while(guf[x]!==x){guf[x]=guf[guf[x]];x=guf[x];}return x;}
  Object.keys(pc).forEach(function(k){var ab=k.split('\u0001');if(!vis[ab[0]]||!vis[ab[1]])return;var ra=gfind(ab[0]),rb=gfind(ab[1]);if(ra!==rb)guf[ra]=rb;});
  var gcl={};gnames.forEach(function(n){var r=gfind(n);(gcl[r]=gcl[r]||[]).push(n);});
  var hub={},anyHub=false,bestCl=null,bestTot=-1;
  Object.keys(gcl).forEach(function(r){
    var mem=gcl[r],maxN=0,tot=0,anchor=mem[0];
    mem.forEach(function(m){var nn=gidx[m].n||0;tot+=nn;if(nn>maxN)maxN=nn;
      if(nn>(gidx[anchor].n||0)||(nn===(gidx[anchor].n||0)&&(gidx[m].favor||0)>(gidx[anchor].favor||0)))anchor=m;});
    if(maxN>=2){mem.forEach(function(m){if((gidx[m].n||0)>=2){hub[m]=1;anyHub=true;}});}
    if(tot>bestTot){bestTot=tot;bestCl=anchor;}
  });
  if(!anyHub&&bestCl)hub[bestCl]=1;
  gnames.forEach(function(n){if(hub[n]){adj['__c'].push(n);adj[n].push('__c');}});
  var depthOf={'__c':0},parent={},seen={'__c':1},q=['__c'];
  while(q.length){var cur=q.shift();(adj[cur]||[]).forEach(function(nb){if(!seen[nb]){seen[nb]=1;depthOf[nb]=depthOf[cur]+1;parent[nb]=cur;q.push(nb);}});}
  var floated=[];ns.forEach(function(o){if(!seen[o.name])floated.push(o.name);});
  var kidsOf={'__c':[]};ns.forEach(function(o){if(seen[o.name]){var pp=parent[o.name];(kidsOf[pp]=kidsOf[pp]||[]).push(o.name);}});
  var maxD=1;ns.forEach(function(o){if((depthOf[o.name]||0)>maxD)maxD=depthOf[o.name];});
  var depN={};ns.forEach(function(o){if(seen[o.name]){var dd=depthOf[o.name];depN[dd]=(depN[dd]||0)+1;}});
  /* 一张 4 人的图谱都要 542 的视框、塞进 287px 的窗里——0.53 的缩放，
     11 号字落到屏上只剩 5.8px，电脑上都读不出。两头一起治：
     环距与每人占位收紧（视框变小），名牌与字号放大（同样缩放下更大）。 */
  var ring=58,radAt={};
  for(var di=1;di<=maxD;di++){radAt[di]=Math.max(ring*di,(depN[di]||1)*11);}
  /* 第一圈单独抬一档：本体那一枚连名字往下探到 +32，外圈一枚连名字有 ±33，
     环距按 58 排的话正下方那一枚会压在「本体│某某」上。71 是两者半高加一道缝。 */
  if(radAt[1]!=null&&radAt[1]<71)radAt[1]=71;
  for(var dj=2;dj<=maxD;dj++){if(radAt[dj]<radAt[dj-1]+ring)radAt[dj]=radAt[dj-1]+ring;}
  var coreR=radAt[maxD]||ring;
  var floatR=Math.max(coreR+ring*0.6,(floated.length||1)*10);
  var maxR=Math.max(coreR,floatR),W=Math.round((maxR+30)*2),H=W,cx=W/2,cy=H/2;
  function leafN(nm){var k=kidsOf[nm]||[];if(!k.length)return 1;var s=0;k.forEach(function(c){s+=leafN(c);});return s;}
  var pos={'__c':{x:cx,y:cy}};
  function lay(nm,a0,a1,depth){
    var kids=kidsOf[nm]||[];if(!kids.length)return;
    var tot=0;kids.forEach(function(c){tot+=leafN(c);});
    var a=a0;
    kids.forEach(function(c){
      var span=(a1-a0)*(leafN(c)/tot),mid=a+span/2,rr=radAt[depthOf[c]]||ring;
      pos[c]={x:cx+rr*Math.cos(mid),y:cy+rr*Math.sin(mid)};
      lay(c,a,a+span,depth+1);a+=span;
    });
  }
  lay('__c',-Math.PI/2,-Math.PI/2+2*Math.PI,0);
  var fseen={},ford=[];
  floated.forEach(function(st){if(fseen[st])return;var qq=[st];fseen[st]=1;while(qq.length){var cc=qq.shift();ford.push(cc);(adj[cc]||[]).forEach(function(nb){if(floated.indexOf(nb)>=0&&!fseen[nb]){fseen[nb]=1;qq.push(nb);}});}});
  ford.forEach(function(nm,i){var ang=-Math.PI/2+(i+0.5)*2*Math.PI/ford.length;pos[nm]={x:cx+floatR*Math.cos(ang),y:cy+floatR*Math.sin(ang)};});
  var hubLines=''; /* 本体辐条：好感定色（磷光绿=亲/琥珀=平疏） */
  ns.forEach(function(o){
    if(!hub[o.name])return;
    var cp=pos[o.name]||{x:cx,y:cy},pp=pos['__c'];
    var fv=Number(o.favor);if(!isFinite(fv))fv=50;
    var col=fv>=70?'#523000':'#845800';
    var sel=S.memNpc===o.name;
    hubLines+='<line data-a="__c" data-b="'+esc(o.name)+'" x1="'+pp.x.toFixed(1)+'" y1="'+pp.y.toFixed(1)+'" x2="'+cp.x.toFixed(1)+'" y2="'+cp.y.toFixed(1)+'" stroke="'+col+'" stroke-opacity="'+(sel?'.92':'.5')+'" stroke-width="'+(1+Math.min(2.4,o.n/3)).toFixed(1)+'"/>';
  });
  var webLines=''; /* 共演蛛丝：磷光绿细线，仅一面之缘=虚线弱关系 */
  Object.keys(pc).forEach(function(k){
    var ab=k.split('\u0001');if(!vis[ab[0]]||!vis[ab[1]])return;
    var a=pos[ab[0]],b=pos[ab[1]],cnt=pc[k];if(!a||!b)return;
    var w=Math.min(2,.6+cnt*.3);
    var seld=(S.memNpc===ab[0]||S.memNpc===ab[1]);
    webLines+='<line data-a="'+esc(ab[0])+'" data-b="'+esc(ab[1])+'" x1="'+a.x.toFixed(1)+'" y1="'+a.y.toFixed(1)+'" x2="'+b.x.toFixed(1)+'" y2="'+b.y.toFixed(1)+'" stroke="#5f5c53" stroke-opacity="'+(seld?'.8':'.4')+'" stroke-width="'+w.toFixed(1)+'"'+(cnt<2?' stroke-dasharray="5 4"':'')+'/>';
  });
  var lines=webLines+hubLines;
  var nodes=''; /* 节点=缩小版终端文件夹（44×34+状态灯）+姓名小字；物理层只动 g.transform */
  ns.forEach(function(o){
    var x=pos[o.name].x,y=pos[o.name].y;
    var sel=S.memNpc===o.name;
    var _pn=String(o.name),_pshow=_pn.length>6?_pn.slice(0,6):_pn;
    nodes+='<g data-npc="'+esc(o.name)+'" class="gph-n'+(sel?' gph-sel':'')+'" data-x="'+x.toFixed(1)+'" data-y="'+y.toFixed(1)+'" transform="translate('+x.toFixed(1)+','+y.toFixed(1)+')" style="cursor:grab">'
      +'<g transform="translate(-27,-32) scale(1.28)" style="pointer-events:none">'+fdFolderSvg(fdLampCol(o),false)+'</g>'
      +'<rect x="-28" y="-33" width="56" height="66" fill="transparent"/>'
      +'<text class="gph-nm" x="0" y="24" text-anchor="middle" font-size="12.5">'+esc(_pshow)+'</text></g>';
  });
  var center='<g data-gcenter="1" class="gph-n gph-c" data-x="'+cx+'" data-y="'+cy+'" transform="translate('+cx+','+cy+')" style="cursor:grab">'
    +'<g transform="translate(-33,-38) scale(1.4)" style="pointer-events:none">'+fdFolderSvg('',true)+'</g>'
    +'<rect x="-34" y="-39" width="68" height="78" fill="transparent"/>'
    +'<text x="0" y="28" text-anchor="middle" font-size="13.5" style="fill:#523000;font-family:var(--mono);letter-spacing:.05em;pointer-events:none">本体│'+esc(zjSelf())+'</text></g>';
  var hid=(S.graphHidden||[]).length;
  var resetLine=hid?'<div style="text-align:right;margin-top:6px"><span class="btn" data-act="npcUnhide" style="cursor:pointer;font-size:12px;color:var(--mut)">已移除 '+hid+' 人 · 还原全部</span></div>':'';
  return '<div class="gph-hint">人物图谱：常现之人系于本体、结成一张网——节点=人物名牌（状态灯示好感 <span style="color:#523000">金亲</span>·<span style="color:#845800">褐平</span>·<span style="color:#ff7f63">赤疏</span>），同幕共处者细线互连（虚线=仅一面之缘），孤身偶现者外环漂浮。名牌可拖拽、轻点开人物档案——手机双指、电脑 Ctrl+滚轮放大细看，拖背景平移。</div>'
    +'<div id="zjGraphWrap" style="position:relative;overflow:hidden">'
    +'<svg id="zjGraphSvg" data-bw="'+W+'" data-bh="'+H+'" viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block;touch-action:none">'+lines+center+nodes+'</svg>'
    +'<span data-act="graphZoomReset" class="btn" style="position:absolute;right:8px;bottom:8px;font-size:11px;letter-spacing:.15em;color:var(--mut);background:rgba(237,231,217,.85);border:1px solid rgba(19,18,13,.25);padding:3px 10px;cursor:pointer">复位</span>'
    +'</div>'+resetLine;
}
function gphMark(){ /* 选中态即时刷（fd窗开关/◀▶切换时调用，不整树重渲） */
  var svg=document.getElementById('zjGraphSvg');if(!svg)return;
  [].forEach.call(svg.querySelectorAll('g[data-npc]'),function(g){
    var on=g.getAttribute('data-npc')===S.memNpc;
    if(g.classList)g.classList[on?'add':'remove']('gph-sel');
  });
  [].forEach.call(svg.querySelectorAll('line[data-b]'),function(l){
    var a=l.getAttribute('data-a'),b=l.getAttribute('data-b'),touch=(a===S.memNpc||b===S.memNpc),isHub=(a==='__c');
    l.setAttribute('stroke-opacity',touch?(isHub?'.92':'.8'):(isHub?'.5':'.4'));
  });
}
var GZOOM={s:1,vx:0,vy:0};
/* viewBox 每改一次就是整张 SVG 重栅格化。指针事件一秒能来上百个，
   逐个同步写等于一秒重画上百遍；合并到每帧最多写一次。 */
var _gzRaf=0,_gzPend=null;
function gzFlush(){_gzRaf=0;var q=_gzPend;_gzPend=null;if(q)try{q[0].setAttribute('viewBox',q[1]);}catch(_){}}
function gzApplyVB(svg,BW,BH){
  if(GZOOM.s<1)GZOOM.s=1;if(GZOOM.s>6)GZOOM.s=6;
  var vw=BW/GZOOM.s,vh=BH/GZOOM.s;
  if(GZOOM.vx>BW-vw)GZOOM.vx=BW-vw;if(GZOOM.vx<0)GZOOM.vx=0;
  if(GZOOM.vy>BH-vh)GZOOM.vy=BH-vh;if(GZOOM.vy<0)GZOOM.vy=0;
  _gzPend=[svg,GZOOM.vx.toFixed(1)+' '+GZOOM.vy.toFixed(1)+' '+vw.toFixed(1)+' '+vh.toFixed(1)];
  if(!_gzRaf)_gzRaf=requestAnimationFrame(gzFlush);
}
function gzZoom(svg,BW,BH,clientX,clientY,factor){
  var r=svg.getBoundingClientRect();if(!r.width||!r.height)return;
  var vw=BW/GZOOM.s,vh=BH/GZOOM.s;
  var rx=(clientX-r.left)/r.width,ry=(clientY-r.top)/r.height;
  var sx=GZOOM.vx+rx*vw,sy=GZOOM.vy+ry*vh;
  var ns=GZOOM.s*factor;if(ns<1)ns=1;if(ns>6)ns=6;GZOOM.s=ns;
  GZOOM.vx=sx-rx*(BW/ns);GZOOM.vy=sy-ry*(BH/ns);
  gzApplyVB(svg,BW,BH);
}
function gzPan(svg,BW,BH,dx,dy){
  var r=svg.getBoundingClientRect();if(!r.width||!r.height)return;
  GZOOM.vx-=dx*(BW/GZOOM.s/r.width);GZOOM.vy-=dy*(BH/GZOOM.s/r.height);
  gzApplyVB(svg,BW,BH);
}
function gzReset(){var svg=document.getElementById('zjGraphSvg');if(!svg)return;GZOOM.s=1;GZOOM.vx=0;GZOOM.vy=0;gzApplyVB(svg,+svg.getAttribute('data-bw')||360,+svg.getAttribute('data-bh')||360);}
var GPH={drag:null,raf:0,squelch:false};
function graphHydrate(){ /* 弹簧物理+拖拽+缩放（节点=g.transform 驱动；减动效=静态布局无弹簧） */
  var svg=document.getElementById('zjGraphSvg');
  if(!svg||svg.__gph)return;
  svg.__gph=1;
  /* 情报台每幕重绘一次，图谱于是被整棵换掉、graphHydrate 再跑一遍。
     旧那一份的弹簧循环还活着，而它写的是同一个全局 GPH.raf——新旧两条链抢同一个格子：
     旧链先跑完、把 GPH.raf 归零，新链就此断掉，被拖开的名牌停在半路再也不回位。
     所以每一份自己拿一个 raf 槽，另外发一张号（gen）：DOM 已经换掉、或号不是最新的，
     一律立刻收手，事件也不再受理。 */
  var raf=0,gen=(GPH.gen=(GPH.gen||0)+1);
  function alive(){return svg.isConnected&&gen===GPH.gen;}
  var low=false;try{low=reducedMotion();}catch(e){}
  var BW=+svg.getAttribute('data-bw')||360,BH=+svg.getAttribute('data-bh')||360;
  gzApplyVB(svg,BW,BH);
  var byName={},nodes=[];
  [].forEach.call(svg.querySelectorAll('g[data-npc],g[data-gcenter]'),function(g){
    var x=parseFloat(g.getAttribute('data-x')),y=parseFloat(g.getAttribute('data-y'));
    if(!isFinite(x)||!isFinite(y))return;
    var nd={g:g,isC:g.hasAttribute('data-gcenter'),x0:x,y0:y,x:x,y:y,vx:0,vy:0,ox:0,oy:0};
    nodes.push(nd);byName[nd.isC?'__c':g.getAttribute('data-npc')]=nd;
  });
  if(!nodes.length)return;
  var edges=[];
  [].forEach.call(svg.querySelectorAll('line[data-a]'),function(l){
    var a=byName[l.getAttribute('data-a')],bb=byName[l.getAttribute('data-b')];
    if(a&&bb)edges.push({el:l,a:a,b:bb});
  });
  function updEdges(){edges.forEach(function(e){e.el.setAttribute('x1',e.a.x);e.el.setAttribute('y1',e.a.y);e.el.setAttribute('x2',e.b.x);e.el.setAttribute('y2',e.b.y);});}
  function apply(n){n.g.setAttribute('transform','translate('+n.x.toFixed(1)+','+n.y.toFixed(1)+')');}
  /* 归位原来是「每帧朝目标收 14%、速度留 80%」的弹簧：按帧算，不按时间算。
     图谱这一层的帧率是跟着三维场景走的——手机上常掉到十几帧，软件渲染时只有个位数
     （本机实测 3fps）。于是松手之后要好几秒才回得去，中途还来回过冲，
     看着就是「拖完整个被拖走、不复位」。
     改成按真实时间收敛，并且不再过冲：快机慢机都在半秒上下归位，
     差到 0.4 以内直接吸附到位，免得留一截永远收不完的尾巴。 */
  function step(ts){
    if(!alive()){raf=0;return;}
    if(low){nodes.forEach(function(n){if(GPH.drag===n)return;n.x=n.x0+n.ox;n.y=n.y0+n.oy;apply(n);});updEdges();raf=0;return;}
    var now=ts||performance.now();
    var dt=Math.min(4,Math.max(.25,(now-(step._t||(now-16.7)))/16.7));   /* 以 60fps 一帧为 1 */
    step._t=now;
    var k=1-Math.pow(1-.22,dt),act=false;
    nodes.forEach(function(n){
      if(GPH.drag===n){act=true;return;}
      var tx=n.x0+n.ox,ty=n.y0+n.oy,dx=tx-n.x,dy=ty-n.y;
      if(Math.abs(dx)<.4&&Math.abs(dy)<.4){n.x=tx;n.y=ty;n.vx=n.vy=0;}
      else{n.x+=dx*k;n.y+=dy*k;act=true;}
      apply(n);
    });
    updEdges();
    raf=act?requestAnimationFrame(step):0;
  }
  function kick(){if(!raf&&alive()){step._t=0;raf=requestAnimationFrame(step);}}
  function gScale(){var r=svg.getBoundingClientRect();var vb=(svg.getAttribute('viewBox')||'').split(/\s+/);
    var vw=+vb[2]||BW,vh=+vb[3]||BH;
    return {x:(r.width>1?vw/r.width:1),y:(r.height>1?vh/r.height:1)};}
  GPH.ptrs={};
  function actN(){return Object.keys(GPH.ptrs).length;}
  function nAt(g){var n=null;nodes.forEach(function(x){if(x.g===g)n=x;});return n;}
  function pinchInit(){var ids=Object.keys(GPH.ptrs),a=GPH.ptrs[ids[0]],b=GPH.ptrs[ids[1]];GPH._pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1,mx:(a.x+b.x)/2,my:(a.y+b.y)/2};}
  function pinchMove(){var ids=Object.keys(GPH.ptrs);if(ids.length<2)return;var a=GPH.ptrs[ids[0]],b=GPH.ptrs[ids[1]];var d=Math.hypot(a.x-b.x,a.y-b.y)||1,mx=(a.x+b.x)/2,my=(a.y+b.y)/2;var pcx=GPH._pinch;if(!pcx){GPH._pinch={d:d,mx:mx,my:my};return;}gzZoom(svg,BW,BH,mx,my,d/pcx.d);gzPan(svg,BW,BH,mx-pcx.mx,my-pcx.my);GPH._pinch={d:d,mx:mx,my:my};}
  svg.addEventListener('pointerdown',function(e){
    if(!alive())return;
    /* 一次手势结束时若有一枚指针的 up 没回来（松手在 SVG 之外、指针被系统收走、
       捕获失败……），GPH.ptrs 里就留着一条幽灵记录：下次单指一按 actN() 就已经是 2，
       于是「单指平移」被当成双指捏合——手机上表现为一拖就乱缩放，
       电脑上表现为松了手节点还粘着走。新手势的第一枚指针一律清台重来。 */
    if(e.isPrimary){GPH.ptrs={};GPH._pinch=null;GPH.drag=null;GPH.pan=null;}
    GPH.ptrs[e.pointerId]={x:e.clientX,y:e.clientY};
    if(actN()>=2){if(GPH.drag){GPH.drag=null;nodes.forEach(function(o){o.ox=0;o.oy=0;});kick();}GPH.pan=null;pinchInit();e.preventDefault();return;}
    var g=e.target&&e.target.closest?e.target.closest('g[data-npc],g[data-gcenter]'):null;
    var n=g?nAt(g):null;
    if(n){
      GPH.drag=n;n._moved=0;n._sx=e.clientX;n._sy=e.clientY;
      /* 拖拽改成「记下起点，按位移走」。原来每一帧都 n.x=指针坐标——名牌等于把自己的
         中心瞬间挪到指针底下，你按住的是牌角，它就先往一边窜一下（「图标躲着鼠标」），
         名牌放大到 56×66 之后偏心抓到的机会更大，这一窜也更显眼。
         位移还必须自己换算：图谱挂在情报台窗上，那层窗带 rotateY/scaleY 的 3D 变换，
         getScreenCTM() 在这种祖先下给的是一份拍扁过的近似矩阵（实测 a=0.484，
         而真实屏幕比例是 0.740），照它反算指针，名牌会以 1.5 倍速度往外跑。
         改用 gzPan 同一套口径：viewBox ÷ 实际渲染框。 */
      n._bx=n.x;n._by=n.y;GPH._sc=gScale();
      kick();
    }
    else{GPH.pan={lx:e.clientX,ly:e.clientY};}
    try{svg.setPointerCapture(e.pointerId);}catch(ex){}
    e.preventDefault();
  });
  svg.addEventListener('pointermove',function(e){
    if(GPH.ptrs[e.pointerId])GPH.ptrs[e.pointerId]={x:e.clientX,y:e.clientY};
    if(actN()>=2){pinchMove();e.preventDefault();return;}
    if(GPH.drag){var n=GPH.drag,sc=GPH._sc||gScale();n._moved=Math.max(n._moved||0,Math.abs(e.clientX-n._sx)+Math.abs(e.clientY-n._sy));n.x=(n._bx||0)+(e.clientX-n._sx)*sc.x;n.y=(n._by||0)+(e.clientY-n._sy)*sc.y;apply(n);updEdges();if(!low){var dx=n.x-n.x0,dy=n.y-n.y0;nodes.forEach(function(o){if(o===n)return;var dd=Math.hypot(o.x0-n.x0,o.y0-n.y0)||1;var w=Math.min(.42,21/dd);o.ox=dx*w;o.oy=dy*w;});}kick();}
    else if(GPH.pan){gzPan(svg,BW,BH,e.clientX-GPH.pan.lx,e.clientY-GPH.pan.ly);GPH.pan.lx=e.clientX;GPH.pan.ly=e.clientY;}
  });
  function gup(e){
    if(!alive())return;
    if(e&&e.pointerId!=null){
      delete GPH.ptrs[e.pointerId];
      try{if(svg.hasPointerCapture&&svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);}catch(_){}
    }
    if(actN()<2)GPH._pinch=null;
    if(actN()>0)return;
    if(GPH.drag){var n=GPH.drag;GPH.drag=null;var tap=(n._moved||0)<=10;nodes.forEach(function(o){o.ox=0;o.oy=0;});kick();GPH.squelch=true;setTimeout(function(){GPH.squelch=false;},400);if(tap&&!n.isC){if(window.SX)SX('node');fdOpen(n.g.getAttribute('data-npc'));gphMark();}}
    GPH.pan=null;
  }
  svg.addEventListener('pointerup',gup);
  svg.addEventListener('pointercancel',gup);
  /* 只在 svg 上收 up 是不够的：捕获一旦没拿到（或被系统撤销），松在窗外那一下
     根本不会回到这里，拖着的节点就一直跟着鼠标走。窗上再收一道，捕获阶段先拿到。 */
  addEventListener('pointerup',gup,true);
  addEventListener('pointercancel',gup,true);
  addEventListener('blur',function(){GPH.ptrs={};GPH._pinch=null;GPH.drag=null;GPH.pan=null;});
  /* 滚轮：面板滚动优先，只有按住 Ctrl／⌘ 才缩放图谱。
     原来这里无条件 preventDefault——鼠标一压到图谱上，整条情报台就再也滚不动了，
     用户只能继续空转滚轮；而每一格滚轮都要 getBoundingClientRect 强制回流 + 改 viewBox，
     把整张 SVG 连同它底下那层全屏毛玻璃一起重栅格化。Windows 上显存就是这么涨起来的。 */
  svg.addEventListener('wheel',function(e){
    if(!(e.ctrlKey||e.metaKey))return;                     /* 不按修饰键就放行，交给 .gMfd 滚 */
    e.preventDefault();
    gzZoom(svg,BW,BH,e.clientX,e.clientY,e.deltaY<0?1.15:1/1.15);
  },{passive:false});
}
function graphCardHtml(){ /* 档案窗正文（npcMetaFill 回调仍按 #zjGraphCard 刷新此块——签名/挂点不变） */
  if(!S.memNpc)return '';
  var ns=npcStats(),sel2=null;ns.forEach(function(o){if(o.name===S.memNpc)sel2=o;});
  var L=zjL(),ND='<span class="fd-nd">'+L.nd+'</span>';
  if(!sel2)return '<div class="fd-row"><span class="fd-k">'+L.file+'</span><span class="fd-v">'+ND+'</span></div>';
  var fv2=Number(sel2.favor),hasFv=isFinite(fv2);
  var lack=(!sel2.role||!sel2.place||!sel2.age||!sel2.sex);
  if(lack&&zjAuxReady()&&S.npcMeta&&!S.npcMeta[sel2.name]&&S._npcMetaBusy!==sel2.name)setTimeout(function(){npcMetaFill(sel2.name);},30);
  var busy=(S._npcMetaBusy===sel2.name);
  var fr=fdRounds(),k=npcKey(sel2.name)||sel2.name,here=!!fr.present[k],lastR=fr.last[k];
  var rel=hasFv?(fv2>=70?L.fr:fv2>=40?L.ne:L.ho):null;
  /* 关系行补充：同幕共演最多的两人（npcPairs 聚合，零改动只取用） */
  var pc=npcPairs(),links=[];
  Object.keys(pc).forEach(function(pk){var ab=pk.split('\u0001');
    if(ab[0]===sel2.name)links.push({n:ab[1],c:pc[pk]});else if(ab[1]===sel2.name)links.push({n:ab[0],c:pc[pk]});});
  links.sort(function(a,b){return b.c-a.c;});
  var lnkTxt=links.length?links.slice(0,2).map(function(l){return esc(l.n)+'×'+l.c;}).join(' '):'';
  var bar=hasFv?'<div class="fd-bar"><i style="width:'+Math.max(2,Math.min(100,fv2))+'%"></i></div>':'';
  var prof=[sel2.role?('身份 '+esc(sel2.role)):'',sel2.sex?('性别 '+esc(sel2.sex)):'',
    sel2.age?('年龄 '+esc(sel2.age)+(/^\d+$/.test(String(sel2.age))?'岁':'')):'',
    sel2.place?('所在 '+esc(sel2.place)):''].filter(Boolean).join(' ／ ');
  var redo=zjAuxReady()?'<span class="fd-btn" data-act="npcMetaRedo">↻ 重新推断</span>':'';
  return '<div class="fd-row"><span class="fd-k">'+L.rel+'</span><span class="fd-v">'+(rel||ND)
      +(here?' <span style="color:var(--t-g1)">▮ 在场</span>':' <span style="color:var(--t-g4)">▯ 离场</span>')
      +(lnkTxt?'<span style="display:block;color:var(--fg-label)">同场 ▸ '+lnkTxt+'</span>':'')+'</span></div>'
    +'<div class="fd-row"><span class="fd-k">'+L.trust+'</span><span class="fd-v">'+(hasFv?('信 '+fv2+bar):ND)+'</span></div>'
    +'<div class="fd-row"><span class="fd-k">'+L.stat+'</span><span class="fd-v">'+(sel2.state?esc(sel2.state):ND)+'</span></div>'
    +'<div class="fd-row"><span class="fd-k">'+L.voice+'</span><span class="fd-v">'+(sel2.thought?'<span class="fd-quote">「'+esc(sel2.thought)+'」</span>':ND)+'</span></div>'
    +'<div class="fd-row"><span class="fd-k">'+L.file+'</span><span class="fd-v">'+(prof||(busy?'':ND))
      +(busy?'<span style="color:var(--t-a1)">✦ 正据出场记录推断身份/所在/年龄/性别…</span>':'')+'</span></div>'
    +'<div class="fd-last">'+L.last+' ▸ '+(lastR?('第 '+lastR+' 轮 ／ 共 '+fr.total+' 轮'):L.nd)+' ／ 出场 '+sel2.n+' 幕</div>'
    +'<div style="display:flex;gap:8px;margin-top:10px">'+redo+'<span class="fd-btn fd-warn" data-act="npcDrop" style="margin-left:auto">✕ 移除此档案</span></div>';
}
/* ── 档案窗（独立 .fd-ov 层挂 body：重渲侧栏不动它） ── */
function fdList(){return npcStats().map(function(o){return o.name;});}
function fdMark(){try{gphMark();}catch(e){}} /* 选中态落在蛛网SVG节点上 */
function fdRefresh(){
  var nm=document.getElementById('fdOvName');if(nm)nm.textContent=S.memNpc||'';
  var c=document.getElementById('zjGraphCard');if(c)c.innerHTML=graphCardHtml();
  fdMark();
}
function fdClose(){
  var ov=document.getElementById('fdOv');
  try{var _w=ov&&ov.querySelector('.fd-win');if(_w)FDTILT=tiltGet(_w,'--fdTilt',-10);}catch(_){}
  if(ov&&ov.parentNode)ov.parentNode.removeChild(ov);
  S.memNpc=null;fdMark();
}
function fdNav(dir){
  var ls=fdList();if(!ls.length)return;
  var i=ls.indexOf(S.memNpc);i=i<0?0:(i+dir+ls.length)%ls.length;
  S.memNpc=ls[i];fdRefresh();
}
function fdOvClick(e){
  var t=e.target,fd=t&&t.closest?t.closest('[data-fd]'):null;
  if(fd){var a=fd.getAttribute('data-fd');
    if(a==='close')fdClose();else if(a==='prev')fdNav(-1);else if(a==='next')fdNav(1);return;}
  var act=t&&t.closest?t.closest('[data-act]'):null;
  if(act){var a2=act.getAttribute('data-act');
    if(a2==='npcMetaRedo'){if(S.memNpc){if(S.npcMeta)delete S.npcMeta[S.memNpc];savePref();npcMetaFill(S.memNpc);fdRefresh();}return;}
    if(a2==='npcDrop'){if(S.memNpc){S.graphHidden=(S.graphHidden||[]).concat([S.memNpc]);savePref();fdClose();render();}return;}
  }
  if(t&&t.id==='fdOv')fdClose(); /* 点幕布关窗 */
}
/* 把档案窗推到情报台那一扇的左边去：右外边距 = 视口右缘到那一扇左沿的距离 + 一道缝。
   量的是实时 rect，不写死 --mvGut——那一扇的宽度随窗宽变，写死就对不齐。
   那一扇没开（或窄屏）就退回居中，交给 CSS。 */
var FDTILT=null;      /* 玩家自己调过的档案窗倾角，跨开关记住 */
function fdPlace(){
  var ov=document.getElementById('fdOv');if(!ov)return;
  var w=ov.querySelector('.fd-win');if(!w)return;
  var mv=(innerWidth>919)?document.querySelector('.gMfd.mvDeck .mvWin.on'):null;
  if(!mv){w.style.marginRight='';return;}
  var r=mv.getBoundingClientRect();
  if(!(r.width>1)){w.style.marginRight='';return;}
  w.style.marginRight=Math.max(12,Math.round(innerWidth-r.left+14))+'px';
  if(FDTILT!=null)tiltSet(w,'--fdTilt','--fdFit',-10,FDTILT);
  try{tiltBind(w,'--fdTilt','--fdFit',-10);}catch(_){}
}
addEventListener('resize',function(){try{fdPlace();}catch(_){}});
function fdOpen(nm){
  if(!nm)return;
  S.memNpc=nm;
  if(!document.getElementById('fdOv')){
    var L2=zjL();
    var ov=document.createElement('div');ov.className='fd-ov';ov.id='fdOv';
    ov.innerHTML='<div class="fd-win">'
      +'<span class="tag">'+L2.fdT+'</span>'
      +'<h2 id="fdOvName"></h2>'
      +'<div id="zjGraphCard"></div>'
      +'<div class="fd-foot"><span class="fd-nav" data-fd="prev">'+L2.prev+'</span><span class="fd-nav" data-fd="next">'+L2.next+'</span></div>'
      +'<div class="esc2" style="margin-top:20px">ESC&nbsp;//&nbsp;RETVRN</div></div>';
    ov.addEventListener('click',fdOvClick);
    document.body.appendChild(ov);
  }
  fdRefresh();
  try{fdPlace();}catch(_){}
}
/* ---------------- 长程记忆 · 记忆宫殿显示 ----------------
   剧情原文由宫殿按存档保存、按相关性检索。S.mem 只保留玩家亲手写的长期手记；
   旧版本留下的自动摘要不删除以免破坏存档，但不再新增、显示或注入。 */
function memSync(){
  zjSyncHist();
  if(!S.mem)S.mem=[];
}
function memChronicle(){
  var manual=(S.mem||[]).filter(function(m){return m&&m.manual;});
  var lines=manual.map(function(m,i){
    var head=(m.e||'')+(m.d?('·'+m.d):'');
    return (i+1)+'. '+(head?('『'+head+'』'):'')+(m.a?('玩家手记：'+m.a+'。'):'')+(m.s?('补记：'+m.s):'');
  });
  var total=lines.join('\n');
  if(total.length<=7000)return total;
  var head=lines.slice(0,8),tail=[],used=head.join('\n').length+20;
  for(var i=lines.length-1;i>=8;i--){if(used+lines[i].length>7000)break;tail.unshift(lines[i]);used+=lines[i].length+1;}
  return head.join('\n')+'\n……（中略 '+(lines.length-8-tail.length)+' 条，已录于长卷）……\n'+tail.join('\n');
}
/* 编年史 ANNALES：长卷时间轴（Ghost/RitusZhou axisInner 同构；纪年章+节点+史笔） */
/* 取叙事流末尾若干字。直接 .textContent 会把整局的文字（几十万到几百万字）
   拼成一个大字符串再切一刀，每回合白干一次——回合越多越贵。
   改为只翻最后几个段落，够数就停。 */
function _narrTail(n){
  try{
    var nr=document.getElementById('gNarr');if(!nr)return '';
    var out='',ch=nr.children;
    for(var i=ch.length-1;i>=0&&out.length<n;i--)out=ch[i].textContent+'\n'+out;
    return out.slice(-n);
  }catch(_){return '';}
}
function palaceAxisInner(){
  if(!palaceUiEnabled())return '';
  var ds=palaceUiDrawers();
  if(!PALACE_UI.ready||PALACE_UI.loading&&!ds.length)return '<div style="padding:18px 0 6px;text-align:center;font-size:11.5px;letter-spacing:.18em;color:var(--mut)">正在开启本局记忆宫殿…</div>';
  if(PALACE_UI.error)return '<div style="padding:18px 0 6px;text-align:center;font-size:11.5px;letter-spacing:.12em;color:#a74432">宫殿暂不可读 · 原生语义记忆仍在兜底</div>';
  if(!ds.length)return '<div style="padding:18px 0 6px;text-align:center;font-size:11.5px;letter-spacing:.18em;color:var(--mut)">宫殿尚空 · 完成一轮后存入原文抽屉</div>';
  var cap=60,more=Math.max(0,ds.length-cap),use=more?ds.slice(-cap):ds,era=palaceEraLabel();
  var items=use.map(function(d,i){
    var p=palaceParts(d),turn=d.turn<0?'开局':('第'+(d.turn+1)+'回'),world=String(p.w||d.searchText||'').replace(/\s+/g,' ').slice(0,220);
    return '<div style="position:relative;padding:0 0 16px 22px">'
      +'<div style="position:absolute;left:4px;top:9px;bottom:-3px;width:1px;background:rgba(19,18,13,.14)"></div>'
      +'<div style="position:absolute;left:1px;top:6px;width:7px;height:7px;background:var(--gold)"></div>'
      +'<div style="font-size:10.5px;color:var(--mut);letter-spacing:.12em">'+turn+' · 宫殿原文</div>'
      +(p.u?'<div style="font-size:11.5px;color:#34332a;margin-top:3px;letter-spacing:.04em">我：'+esc(p.u.replace(/\s+/g,' ').slice(0,100))+'</div>':'')
      +(world?'<div style="font-size:12px;color:#25241d;line-height:1.8;margin-top:3px;letter-spacing:.04em">'+esc(world)+'</div>':'')
      +'</div>';
  }).join('');
  return '<div style="display:flex;align-items:center;gap:10px;margin:10px 0 12px"><div style="flex:none;font-size:11.5px;color:var(--gold2);letter-spacing:.16em;border:1px solid rgba(132,88,0,.45);padding:3px 12px 2px;background:rgba(132,88,0,.08)">'+esc(era)+'</div><div style="flex:1;height:1px;background:linear-gradient(90deg,rgba(132,88,0,.4),transparent)"></div></div>'
    +(more?'<div style="font-size:10.5px;color:var(--mut);margin-bottom:10px">较早 '+more+' 个抽屉仍保存在宫殿中</div>':'')
    +'<div style="max-height:420px;overflow-y:auto;padding:4px 2px 0">'+items+'</div>';
}
function axisInner(){
  if(palaceUiEnabled())return palaceAxisInner();
  var ms=S.mem||[];
  /* 只渲最近 60 笔。原先每回合把整条编年重新拼一遍 HTML 再整体 innerHTML，
     条数随回合线性增长，整局累计功是回合数的平方——两三百回合后每条消息
     都要重建几十万字符的 DOM，卡顿全落在玩家发话之后那一下。
     早年的笔仍在存档里，一条不丢，只是不再每回合重画。 */
  var _AXCAP=60,_axMore=0;
  if(ms.length>_AXCAP){_axMore=ms.length-_AXCAP;ms=ms.slice(-_AXCAP);}
  if(!ms.length)return '<div style="padding:18px 0 6px;text-align:center;font-size:11.5px;letter-spacing:.2em;color:var(--mut)">编年尚空 · 行过一轮自动记一笔</div>';
  var lastE=null;
  var items=ms.map(function(m,i){
    var eraChip='';
    if((m.e||'')&&m.e!==lastE){lastE=m.e;eraChip='<div style="display:flex;align-items:center;gap:10px;margin:18px 0 10px"><div style="flex:none;font-size:11.5px;color:var(--gold2);letter-spacing:.18em;border:1px solid rgba(132,88,0,.45);padding:3px 12px 2px;background:rgba(132,88,0,.08)">'+esc(m.e)+'</div><div style="flex:1;height:1px;background:linear-gradient(90deg,rgba(132,88,0,.4),transparent)"></div></div>';}
    return eraChip+'<div style="position:relative;padding:0 0 16px 22px">'
      +'<div style="position:absolute;left:4px;top:9px;bottom:-3px;width:1px;background:rgba(19,18,13,.14)"></div>'
      +'<div style="position:absolute;left:1px;top:6px;width:7px;height:7px;background:'+(m.manual?'#13120d':'var(--gold)')+'"></div>'
      +'<div style="font-size:10.5px;color:var(--mut);letter-spacing:.12em">第'+(i+1)+'笔'+(m.d?(' · '+esc(m.d)):'')+(m.manual?' · <span style="color:var(--gold2)">手记</span>':'')+'</div>'
      +(m.a?'<div style="font-size:11.5px;color:#34332a;margin-top:3px;letter-spacing:.06em">我：'+esc(m.a)+'</div>':'')
      +(m.s?'<div style="font-size:12px;color:#25241d;line-height:1.8;margin-top:3px;letter-spacing:.05em">'+esc(m.s)+'</div>':'')
      +'</div>';
  }).join('');
  return '<div style="max-height:420px;overflow-y:auto;padding:4px 2px 0">'+items+'</div>';
}
/* 记忆 MEM pane（侧栏紧凑型 compact=true；事件走 data-act 委托，输入取值按 .zjMemPane 就近作用域） */
function palaceMemPaneInner(compact){
  var ds=palaceUiDrawers(),on=S.memOn!==false,chars=0;
  ds.forEach(function(d){chars+=String(d.content||'').length;});
  var cap=60,more=Math.max(0,ds.length-cap),use=more?ds.slice(-cap):ds;
  var rows=use.slice().reverse().map(function(d){
    var turn=d.turn<0?'开局':('第'+(d.turn+1)+'回');
    return '<div style="border:1px solid rgba(19,18,13,.12);padding:10px 12px;margin-bottom:7px;background:rgba(19,18,13,.015)">'
      +'<div style="font-size:10.5px;color:var(--gold);letter-spacing:.12em;margin-bottom:6px">'+turn+' · 原文抽屉</div>'
      +'<div style="font-size:12px;color:var(--ink2);line-height:1.8;letter-spacing:.035em;white-space:pre-wrap;overflow-wrap:anywhere">'+esc(d.content||d.searchText||'')+'</div></div>';
  }).join('');
  if(!PALACE_UI.ready||PALACE_UI.loading&&!ds.length)rows='<div style="text-align:center;padding:30px 0;font-size:11.5px;letter-spacing:.2em;color:var(--mut)">正在开启本局记忆宫殿…</div>';
  else if(PALACE_UI.error)rows='<div style="text-align:center;padding:30px 0;font-size:11.5px;letter-spacing:.12em;color:#a74432">宫殿暂不可读 · 原生语义记忆仍在兜底</div>';
  else if(!rows)rows='<div style="text-align:center;padding:30px 0;font-size:11.5px;letter-spacing:.2em;color:var(--mut)">宫殿尚空 · 完成一轮后存入原文抽屉</div>';
  var manual=[];(S.mem||[]).forEach(function(m,i){if(m&&m.manual)manual.push({m:m,i:i});});
  var min='width:100%;background:rgba(19,18,13,.03);border:1px solid rgba(19,18,13,.22);color:var(--ink);padding:7px 10px;font-size:12px;font-family:var(--mono)';
  var notes=manual.slice().reverse().map(function(x){var m=x.m,i=x.i;
    if(S.memEdit===i)return '<div style="border:1px solid rgba(132,88,0,.6);padding:11px 12px;margin-bottom:6px;background:rgba(19,18,13,.02)">'
      +'<div style="display:flex;gap:8px"><input id="zjMeE" value="'+esc(m.e||'')+'" placeholder="纪年" style="'+min+';flex:1"><input id="zjMeD" value="'+esc(m.d||'')+'" placeholder="时地" style="'+min+';flex:1"></div>'
      +'<input id="zjMeA" value="'+esc(m.a||'')+'" placeholder="长期手记" style="'+min+';margin-top:7px">'
      +'<textarea id="zjMeS" placeholder="补记" style="'+min+';margin-top:7px;min-height:64px;resize:vertical;font-family:inherit;line-height:1.6">'+esc(m.s||'')+'</textarea>'
      +'<div style="display:flex;gap:9px;margin-top:9px;justify-content:flex-end"><button data-act="memCancel" class="obtn btn" style="font-size:11.5px;letter-spacing:.15em;padding:6px 14px">取消</button><button data-act="memSave" class="gbtn btn" style="font-size:11.5px;letter-spacing:.18em;padding:6px 16px">保 存</button></div></div>';
    return '<div style="display:flex;gap:10px;align-items:flex-start;border:1px solid rgba(132,88,0,.18);padding:9px 12px;margin-bottom:6px;background:rgba(132,88,0,.025)">'
      +'<div style="flex:1;min-width:0"><div style="font-size:10.5px;color:var(--gold);letter-spacing:.1em">玩家手记</div>'
      +'<div style="font-size:12px;color:var(--ink2);line-height:1.8;margin-top:3px">'+esc(m.a||m.s||'')+'</div></div>'
      +'<div class="btn" data-medit="'+(i+1)+'" style="flex:none;cursor:pointer;font-size:11px;color:var(--gold);border:1px solid rgba(132,88,0,.4);padding:2px 8px">编辑</div>'
      +'<div class="btn" data-mdel="'+i+'" style="flex:none;cursor:pointer;font-size:11px;color:#ff7f63;border:1px solid rgba(255,127,99,.4);padding:2px 8px">删</div></div>';
  }).join('');
  var intro='<div style="font-size:11px;letter-spacing:.06em;line-height:1.9;color:var(--mut)">记忆宫殿保存本局每轮玩家与世界的原文；生成时只检索与眼前情形有关的较早抽屉，原生语义记忆在宫殿无结果时兜底。</div>';
  return intro
    +'<div style="display:flex;gap:10px;align-items:center;margin:14px 0;flex-wrap:wrap">'
    +'<div style="padding:7px 12px;font-size:11.5px;letter-spacing:.14em;border:1px solid rgba(132,88,0,.55);color:var(--gold2)">✓ 宫殿运行中</div>'
    +'<div style="font-size:11px;letter-spacing:.06em;color:var(--mut)">'+ds.length+' 个原文抽屉 · 约'+chars+'字</div>'
    +'<div class="btn" data-act="palaceExport" style="cursor:pointer;margin-left:auto;font-size:11.5px;letter-spacing:.12em;color:var(--gold2);border:1px solid rgba(132,88,0,.4);padding:6px 12px">导出本局宫殿</div></div>'
    +(more?'<div style="font-size:10.5px;color:var(--mut);margin:-4px 0 10px">较早 '+more+' 个抽屉仍在宫殿中，界面只显示最近 '+cap+' 个</div>':'')
    +(compact?'<div style="max-height:360px;overflow-y:auto">'+rows+'</div>':rows)
    +'<div style="border-top:1px solid rgba(19,18,13,.12);margin-top:14px;padding-top:12px">'
    +'<div style="display:flex;gap:10px;align-items:center;margin-bottom:9px"><b style="font-size:11px;letter-spacing:.14em;color:var(--gold2)">玩家长期手记</b>'
    +'<div class="btn" data-act="memToggle" style="cursor:pointer;padding:4px 9px;font-size:10.5px;letter-spacing:.1em;border:1px solid '+(on?'rgba(132,88,0,.45)':'rgba(19,18,13,.2)')+';color:'+(on?'var(--gold2)':'var(--mut)')+'">'+(on?'✓ 注入中':'已停用')+'</div></div>'
    +'<div style="display:flex;gap:8px;margin-bottom:10px"><input id="zjMemAdd" placeholder="手记一笔（设定、约定或伏笔）…" style="flex:1;background:rgba(19,18,13,.03);border:1px solid rgba(19,18,13,.2);color:#13120d;font-size:12px;padding:9px 12px;font-family:var(--mono)" autocomplete="off"><button data-act="memAdd" class="obtn btn" style="flex:none;font-size:11.5px;letter-spacing:.2em;padding:0 16px">记 入</button></div>'
    +(notes||'<div style="font-size:10.5px;color:var(--mut);padding-bottom:3px">尚无玩家手记</div>')+'</div>';
}
function memPaneInner(compact){
  if(palaceUiEnabled())return palaceMemPaneInner(compact);
  var n=S.mem?S.mem.length:0;
  var chars=0;S.mem.forEach(function(m){chars+=(m.a||'').length+(m.s||'').length+(m.e||'').length;});
  var on=S.memOn!==false;
  var min='width:100%;background:rgba(19,18,13,.03);border:1px solid rgba(19,18,13,.22);color:var(--ink);padding:7px 10px;font-size:12px;font-family:var(--mono)';
  /* 同上：记忆列表也只渲最近 60 笔 */
  var _mAll=S.mem||[],_MCAP=60,_mUse=_mAll.length>_MCAP?_mAll.slice(-_MCAP):_mAll;
  var rows=_mUse.slice().reverse().map(function(m,ri){
    var i=n-1-ri;
    if(S.memEdit===i){
      return '<div style="border:1px solid rgba(132,88,0,.6);padding:11px 12px;margin-bottom:6px;background:rgba(19,18,13,.02)">'
        +'<div style="display:flex;gap:8px"><input id="zjMeE" value="'+esc(m.e||'')+'" placeholder="纪年" style="'+min+';flex:1"><input id="zjMeD" value="'+esc(m.d||'')+'" placeholder="时地" style="'+min+';flex:1"></div>'
        +'<input id="zjMeA" value="'+esc(m.a||'')+'" placeholder="我之举" style="'+min+';margin-top:7px">'
        +'<textarea id="zjMeS" placeholder="史笔" style="'+min+';margin-top:7px;min-height:64px;resize:vertical;font-family:inherit;line-height:1.6">'+esc(m.s||'')+'</textarea>'
        +'<div style="display:flex;gap:9px;margin-top:9px;justify-content:flex-end"><button data-act="memCancel" class="obtn btn" style="font-size:11.5px;letter-spacing:.15em;padding:6px 14px">取消</button><button data-act="memSave" class="gbtn btn" style="font-size:11.5px;letter-spacing:.18em;padding:6px 16px">保 存</button></div></div>';
    }
    return '<div style="display:flex;gap:10px;align-items:flex-start;border:1px solid rgba(19,18,13,.12);padding:9px 12px;margin-bottom:6px;background:rgba(19,18,13,.015)">'
      +'<div style="flex:none;font-size:11px;color:var(--mut);min-width:26px;text-align:right;padding-top:2px">'+(i+1)+'</div>'
      +'<div style="flex:1;min-width:0"><div style="font-size:11.5px;color:var(--gold);letter-spacing:.08em">'+esc((m.e||'')+(m.d?('·'+m.d):''))+(m.manual?' · <span style="color:var(--gold2)">手记</span>':'')+'</div>'
      +(m.a?'<div style="font-size:11.5px;color:#34332a;margin-top:3px;letter-spacing:.06em">我：'+esc(m.a)+'</div>':'')
      +(m.s?'<div style="font-size:12px;color:var(--ink2);line-height:1.8;margin-top:3px;letter-spacing:.05em">'+esc(m.s)+'</div>':'')+'</div>'
      +'<div class="btn" data-medit="'+(i+1)+'" style="flex:none;cursor:pointer;font-size:11px;color:var(--gold);border:1px solid rgba(132,88,0,.4);padding:2px 8px">编辑</div>'
      +'<div class="btn" data-mdel="'+i+'" style="flex:none;cursor:pointer;font-size:11px;color:#ff7f63;border:1px solid rgba(255,127,99,.4);padding:2px 8px">删</div></div>';
  }).join('');
  if(!rows)rows='<div style="text-align:center;padding:30px 0;font-size:11.5px;letter-spacing:.25em;color:var(--mut)">长卷尚空 · 行过一轮自动记一笔</div>';
  var intro=compact
    ?'<div style="font-size:11px;letter-spacing:.08em;line-height:1.9;color:var(--mut)">长程记忆：每轮自动摘成一条纪要，永久保存并全文送呈 AI。</div>'
    :'<div style="font-size:11px;line-height:1.9;color:var(--ink2)">长程记忆替你记性好：<b style="color:var(--gold2)">每一轮</b>的纪年、时地、我之举与史笔都会自动摘成一条纪要，<b style="color:var(--gold2)">永久保存并每轮全文送呈 AI</b>——即使你的模型上下文很短、正文历史被截断，它也始终知道这一局发生过什么。</div>';
  return intro
    +'<div style="display:flex;gap:12px;align-items:center;margin:16px 0;flex-wrap:wrap">'
    +'<div class="btn" data-act="memToggle" style="cursor:pointer;padding:7px 14px;font-size:11.5px;letter-spacing:.18em;border:1px solid '+(on?'rgba(132,88,0,.55)':'rgba(19,18,13,.2)')+';color:'+(on?'var(--gold2)':'var(--mut)')+'">'+(on?'✓ 注入中':'已停用')+'</div>'
    +'<div style="font-size:11px;letter-spacing:.08em;color:var(--mut)">'+n+' 条 · 约'+chars+'字'+(chars>7000?'（超长部分自动中略，首尾保留）':'')+'</div>'
    +'<div class="btn" data-act="memExport" style="cursor:pointer;margin-left:auto;font-size:11.5px;letter-spacing:.15em;color:var(--gold2);border:1px solid rgba(132,88,0,.4);padding:6px 12px">导出长卷</div>'
    +'<div class="btn" data-act="memClear" style="cursor:pointer;font-size:11.5px;letter-spacing:.15em;color:#ff7f63;border:1px solid rgba(255,127,99,.4);padding:6px 12px">清空长卷</div></div>'
    +'<div style="display:flex;gap:8px;margin-bottom:14px"><input id="zjMemAdd" placeholder="手记一笔（重要设定/约定/伏笔，AI 会永远记住）…" style="flex:1;background:rgba(19,18,13,.03);border:1px solid rgba(19,18,13,.2);color:#13120d;font-size:12px;padding:9px 12px;font-family:var(--mono)" autocomplete="off"><button data-act="memAdd" class="obtn btn" style="flex:none;font-size:11.5px;letter-spacing:.2em;padding:0 16px">记 入</button></div>'
    +(compact?'<div style="max-height:340px;overflow-y:auto">'+rows+'</div>':rows);
}
/* 折叠节头（Ghost 侧栏 head() 同款） */
function zjHead(open,act,color,title,mark){return '<div class="mHead btn zjSecH" data-act="'+act+'"><i>◆</i>&nbsp;'+title+'<span class="zjCar">'+(open?'▾':'▸')+'</span></div>';}
/* 侧栏 data-act 委托：図谱/记忆 两节的全部按钮 */
document.querySelector('#game .gMfd').addEventListener('click',function(e){
  var t=e.target;
  var me=t.closest?t.closest('[data-medit]'):null;
  if(me){S.memEdit=parseInt(me.getAttribute('data-medit'),10)-1;render();return;}
  var md=t.closest?t.closest('[data-mdel]'):null;
  if(md){S.mem.splice(parseInt(md.getAttribute('data-mdel'),10),1);savePref();render();return;}
  var el=t.closest?t.closest('[data-act]'):null;if(!el)return;
  var a=el.getAttribute('data-act');
  if(a==='tgG'){S.secG=!S.secG;savePref();render();}
  else if(a==='tgA'){S.secA=!S.secA;savePref();render();}
  else if(a==='tgM'){S.secM=!S.secM;savePref();render();}
  else if(a==='graphZoomReset'){gzReset();}
  else if(a==='npcUnhide'){S.graphHidden=[];savePref();render();}
  else if(a==='memToggle'){S.memOn=S.memOn===false?true:false;savePref();render();}
  else if(a==='memClear'){if(S.mem.length&&!confirm('清空整卷长程记忆？此举不可复原。'))return;S.mem=[];savePref();render();}
  else if(a==='memAdd'){var mi=((el.closest&&el.closest('.zjMemPane'))||document).querySelector('#zjMemAdd');var tv=mi?mi.value.trim():'';if(tv){S.mem.push({e:'',d:'',a:tv.slice(0,120),s:'',fp:0,manual:true});savePref();render();}}
  else if(a==='memSave'){if(S.memEdit!=null&&S.mem[S.memEdit]){var me0=S.mem[S.memEdit];
    var mroot=(el.closest&&el.closest('.zjMemPane'))||document;
    var gv=function(id){var el2=mroot.querySelector('#'+id);return el2?el2.value.trim():'';};
    me0.e=gv('zjMeE');me0.d=gv('zjMeD');me0.a=gv('zjMeA');me0.s=gv('zjMeS');me0.manual=true;me0.fp=null;
    savePref();S.memEdit=null;render();}}
  else if(a==='memCancel'){S.memEdit=null;render();}
  else if(a==='palaceExport'){
    if(!FEL_RISU||typeof FEL_RISU.getPalaceDrawers!=='function')return;
    var _pid=felMemoryId();
    FEL_RISU.getPalaceDrawers(_pid).then(function(drawers){
      var gn=(CARDS[ACTIVE]&&CARDS[ACTIVE].name)||'守护龙纪事';
      var payload={version:1,sessionId:_pid,drawers:drawers||[]};
      var mb=new Blob([JSON.stringify(payload,null,1)],{type:'application/json'}),mu=URL.createObjectURL(mb),ma=document.createElement('a');
      ma.href=mu;ma.download=gn+'-记忆宫殿.json';document.body.appendChild(ma);ma.click();ma.remove();setTimeout(function(){URL.revokeObjectURL(mu);},4000);
    }).catch(function(){});
  }
  else if(a==='memExport'){try{var gn=(CARDS[ACTIVE]&&CARDS[ACTIVE].name)||'saga';var mb=new Blob([JSON.stringify({__app:gn,__type:'mem-scroll',entries:S.mem},null,1)],{type:'application/json'});var mu=URL.createObjectURL(mb);var ma=document.createElement('a');ma.href=mu;ma.download=gn+'编年长卷.json';document.body.appendChild(ma);ma.click();document.body.removeChild(ma);setTimeout(function(){URL.revokeObjectURL(mu);},4000);}catch(e2){}}
});
/* ═══════════ 天下三维 · 八城游历（RitusZhou zj3d 引擎+资材+敕令管线 原件搬运）═══════════ */
/* 三维侧取面板：从开局起逐幕累积，而不是只认最后一幕。
   正文侧已有 mvuMerge/completeMvu 把漏写的栏位补齐，但那份补全结果只进了 GAME.lastPanel；
   三维走的是 zjPanel(原始回合文本) 这条独立管线，拿到的仍是模型当轮实际写出的那点东西。
   于是只要哪一轮漏了 ◇时地，三维当场失去地点、退回默认罗马——看着就像画面和剧情各说各话。
   逐幕累积之后，未被覆盖的字段一直有效。 */
function currentPanel(){
  zjSyncHist();
  var acc=null;
  for(var i=0;i<S.history.length;i++){
    var h=S.history[i];
    if(h.role!=='world'||!h.panel)continue;
    if(!acc)acc={npcs:(h.panel.npcs||[]).slice(),world:{}};
    else if(h.panel.npcs&&h.panel.npcs.length)acc.npcs=h.panel.npcs.slice();
    var w=h.panel.world||{};
    for(var k in w){
      if(!Object.prototype.hasOwnProperty.call(w,k))continue;
      var v=w[k];
      if(v!=null&&String(v).trim()!=='')acc.world[k]=v;   /* 空值不许覆盖旧值 */
    }
  }
  return acc;
}
window.__FELVN_STATE__=function(){
  var text='';
  try{for(var i=TURNS.length-1;i>=0;i--)if(TURNS[i].role==='assistant'){text=String(TURNS[i].display||TURNS[i].content||'');break;}}catch(_){}
  var hero='';try{hero=heroName()||'';}catch(_){}
  return {panel:currentPanel()||{npcs:[],world:{}},op:GAME.op||null,text:text,hero:hero};
};
var ZJ_LOCS=[
  {name:'洛邑',ch:'周',kind:'cap',x:430,y:322,note:'周王城 · 天下之中'},
  {name:'咸阳',ch:'秦',kind:'cap',x:148,y:295,note:'秦都 · 据崤函之固'},
  {name:'函谷关',ch:'关',kind:'pass',x:298,y:308,note:'崤函咽喉 · 一夫当关'},
  {name:'邯郸',ch:'赵',kind:'cap',x:545,y:150,note:'赵都 · 胡服骑射之邦'},
  {name:'灵寿',ch:'中',kind:'city',x:612,y:86,note:'中山国都 · 千乘之国'},
  {name:'蓟',ch:'燕',kind:'cap',x:790,y:95,note:'燕都 · 黄金台招贤'},
  {name:'临淄',ch:'齐',kind:'cap',x:845,y:245,note:'齐都 · 稷下学宫所在'},
  {name:'曲阜',ch:'鲁',kind:'city',x:764,y:310,note:'鲁都 · 周礼尽在'},
  {name:'陶邑',ch:'陶',kind:'city',x:695,y:330,note:'天下之中 · 商贾辐辏'},
  {name:'商丘',ch:'宋',kind:'city',x:662,y:392,note:'宋都 · 殷商故地'},
  {name:'大梁',ch:'魏',kind:'cap',x:618,y:270,note:'魏都 · 中原四通'},
  {name:'新郑',ch:'韩',kind:'cap',x:528,y:372,note:'韩都 · 劲弩之国'},
  {name:'宛',ch:'宛',kind:'city',x:465,y:432,note:'楚北重镇 · 冶铁名都'},
  {name:'郢',ch:'楚',kind:'cap',x:525,y:490,note:'楚都 · 云梦泽畔'},
  {name:'姑苏',ch:'吴',kind:'city',x:862,y:425,note:'吴故都 · 鱼米之乡'},
  {name:'会稽',ch:'越',kind:'city',x:920,y:485,note:'越都 · 卧薪尝胆之地'},
  {name:'成都',ch:'蜀',kind:'city',x:95,y:468,note:'蜀地 · 天府沃野'}
];
function locByName(n){for(var i=0;i<ZJ_LOCS.length;i++)if(ZJ_LOCS[i].name===n)return ZJ_LOCS[i];return null;}
function playerLoc(){
  var p=currentPanel();var td=p?String((p.world['时地']||'')):'';
  for(var i=0;i<ZJ_LOCS.length;i++){if(td.indexOf(ZJ_LOCS[i].name)>=0)return ZJ_LOCS[i];}
  return ZJ_LOCS[0];
}
function sendText(text){ /* 宿主发送管线：ROME 神谕（三维敕令/移驾通报由此入正史） */
  if(BUSY||!GAME.on)return;
  var idx=TURNI++;
  TURNS.push({role:'user',content:text,t:idx});
  narrAdd('me','▌'+esc2(text),idx);
  if(apiReady())askOracle();
  /* 同上：原来传的 v 是 send() 的局部变量，这里没有。未接 API 时
     三维里的一切操作（造屋、颁令、移驾）都只留下一行灰字，永远等不到下文。 */
  else {try{GENIVS.offlineTurn(text,idx);}catch(_){narrAdd('sys','…&nbsp;ORACVLVM&nbsp;未接线&nbsp;·&nbsp;已记录…',idx);}}
}
function movePlayerTo(name){
  var L=locByName(name);if(!L)return;
  var cur=playerLoc();
  if(L.name===cur.name){render();return;}
  S.overlay=null;
  GAME.dest3d=L.name;                               /* 三维即刻随行：不必等神谕回话 */
  try{zj3dTick();}catch(_){}
  var _zd=null;try{_zd=zjDoc(L.name);}catch(_){}
  sendText('（御驾起行——孤自'+cur.name+'移驾前往'+L.name+'，'+L.note+'。'
    +(_zd?('【'+L.name+'志】'+_zd.g+_zd.t+'）'):'')
    +'此回合孤只是赶路：请描写沿途仪仗见闻与抵达'+L.name+'时的景象，'
    +'所写须与上列地志相合，并将时地更新为'+L.name+'。）');
}
function mood(){
  var p=currentPanel(); var cw=p?p.world:{};
  /* 繁体键也要认：模型写成 ◇時地／◇天氣 时，原来这里两个都取不到，
     画面当场退回默认的白天晴天。 */
  var place=cw['时地']||cw['時地']||'', wx=cw['天气']||cw['天氣']||'';
  return {
    place:place, wx:wx,
    /* 判夜的词卡里自带的开局就用过：黄昏、日暮、日昃、三更……原来一个都不认，
       写着「日暮前」的一幕在三维里仍是大白天。 */
    night:/夜|晚|入夜|夜半|黄昏|日暮|日昃|薄暮|昏时|掌灯|[一二三四五]更|子时|亥时|戌时|丑时|寅时/.test(place),
    snow:/雪|霜|冰/.test(wx+place),
    rain:/雨|霖|滂沱|淋/.test(wx),
    fog:/雾|霭|霾|沙尘|扬尘/.test(wx),
    wind:/风|飙|飓/.test(wx),
    clear:/晴|朗|烈日|皎|星斗/.test(wx),
    spring:/春|柳絮|杏|花|燕/.test(wx+place),
    water:/池|洛水|高台|苑|河/.test(place)
  };
}
function parseDeed(text){
  var m=/<sec_deed>([\s\S]*?)<\/sec_deed>/.exec(text||'');
  if(!m)return null;
  var out={build:[],raze:[],come:[],go:[]};
  var map={'兴作':'build','毁损':'raze','来者':'come','去者':'go'};
  m[1].split('\n').forEach(function(l){
    l=l.trim();if(l.charAt(0)!=='▣')return;
    var pp=l.slice(1).split('|');var k=map[(pp[0]||'').trim()];if(!k||!pp[1])return;
    /* 「来者/去者」写的是人名，人名里带顿号逗号的情况远比一次列两个人常见，
       所以这两类整行只当一个人；建筑那两类才按分隔符拆开。
       另外 ▣来者 允许写成「人名|身份词」——身份词用来猜三维里的外形。 */
    if(k==='come'||k==='go'){
      var who=String(pp[1]||'').trim(),role=String(pp[2]||'').trim();
      if(!who||who==='无')return;
      out[k].push({name:who,role:role,n:1});
      return;
    }
    pp[1].split(/[、,，;；]/).forEach(function(it){
      it=it.trim();if(!it||it==='无')return;
      var mm=/^(.+?)[×xX*]\s*(\d+)$/.exec(it);
      out[k].push({name:mm?mm[1].trim():it,n:mm?Math.min(5,parseInt(mm[2],10)||1):1});
    });
  });
  return (out.build.length||out.raze.length||out.come.length||out.go.length)?out:null;
}
function deedHash(t){var h=5381;t=String(t||'');for(var i=0;i<t.length;i++)h=((h<<5)+h+t.charCodeAt(i))>>>0;return h.toString(36);}
function edictSync(){
  if(!GAME.on||!window.ZJ3D||!ZJ3D.owns()||!ZJ3D.applyEdict)return;
  for(var i=S.history.length-1;i>=0;i--){
    var h=S.history[i];if(h.role!=='world')continue;
    var d=parseDeed(h.text);
    if(d)ZJ3D.applyEdict(d,'t'+i+'@'+deedHash(h.text));
    return;
  }
}
function worldCommand(raw){
  S.cmdHint=null;
  var clean=raw.replace(/[。！\s]/g,'');
  var mv=/^(?:移驾|巡狩|亲赴|前往|去往?|幸)(.+?)(?:都|城)?$/.exec(clean);
  if(mv){
    var nm=mv[1],L=null;
    ZJ_LOCS.forEach(function(l){if(!L&&(nm.indexOf(l.name)>=0||l.name.indexOf(nm)>=0))L=l;});
    if(L){
      if(L.name===playerLoc().name){S.cmdHint='御驾本就在'+L.name;render();return;}
      S.input='';movePlayerTo(L.name);return;
    }
  }
  if(!(window.ZJ3D&&ZJ3D.owns()&&ZJ3D.command)){S.cmdHint='三维天下尚未加载，请先展开上方三维画面';render();return;}
  var r=ZJ3D.command(raw);
  if(!r||!r.ok){S.cmdHint=(r&&r.report)||'未能辨识敕令';render();return;}
  S.input='';
  sendText('（天子颁令于天下：「'+raw+'」。宫人立办，其果如下——'+r.report+'。此为既成事实：请顺此结果叙事见闻与众人反应，不得更改、推翻或另行虚构执行细节。）');
}
/* 三维营造模式的敕令通报入口：AI 忙时排队重试 */
/* 三维里的动作（营造、拆毁、纵火、与人对话、出手）全靠这条通道上报给正文。
   原来是各自重试 8 次≈12.8 秒就把文本丢掉——而一次神谕通常要跑 20 到 60 秒，
   也正是玩家最爱去三维画面里点点看的时段。结果是三维里房子起来了、人死了，
   正文一个字都不知道；下一回合 brief() 又用「引擎账实·最高可信」把这些列给 AI，
   AI 只能凭空补叙或干脆忽略。改成真队列：等多久都不丢，按顺序一条条发。 */
var _SAYQ=[];
function _sayFlush(){
  if(BUSY||!GAME.on||!_SAYQ.length)return;
  var t=_SAYQ.shift();
  try{sendText(t);}catch(_){}
}
window.ZJ3D_say=function(text){
  if(!String(text||'').trim())return;
  if(_SAYQ.length>=12)_SAYQ.shift();          /* 只防无限堆积，不做静默丢弃 */
  _SAYQ.push(text);_sayFlush();
};
ivl(_sayFlush,900);
window.ZJ3D_closePane=function(){
  try{
    GAME.txOpen=false;
    var g=document.getElementById('game');
    g.classList.remove('txOpen','tx2','txBig');
    if(window.MED3D&&MED3D.sleep)MED3D.sleep();
    if(window.ZJ3D&&ZJ3D.sleep)ZJ3D.sleep();
  }catch(e){}
};
/* 这张卡的主引擎。原先到处写 ACTIVE==='zhou' 判「是不是中原线」，可本卡的
   ACTIVE 是 'luzhi'，一律判成地中海线：档位被记到了一台根本没在跑的 MED3D 上，
   读回来自然是 0。画面里那枚「营造」按下去毫无反应就是这么来的——
   引擎自己已经把 expanded 翻成 true，下一拍又被这条同步按回 false。
   按卡名列一次，涉及引擎归属的地方都引这里，别再各写各的。 */
function homeEng(){return (ACTIVE==='roma'||ACTIVE==='cleo')?window.MED3D:window.ZJ3D;}
window.ZJ3D_onExpand=function(){
  try{
    var g=document.getElementById('game');
    var E=homeEng();
    var tr=E?(E.tier!=null?E.tier:(E.expanded?1:0)):0;
    g.classList.toggle('tx2',tr===1);
    g.classList.toggle('txBig',tr===2);
    /* 层级是引擎那边改的（例如建造清单钮自己抬档），展开／收起两个钮的灰态要跟上 */
    try{if(window.__arrPaint)window.__arrPaint();}catch(_){}
    setTimeout(zj3dTick,330);
  }catch(e){}
};
/* ═══════════ MODCITY · 现代城市粒子沙盘（东京/纽约/大阪，三线通用） ═══════════
   视觉语言对齐 STEM 沙盘：黑场，灰白点柱城市，干道点线，地铁站红橙热点，
   名所大热簇，所在地金色光柱+涟漪。数据来自整城开放地图烘焙（modern.dat）。
   自研 WebGL 点渲染，不依赖三维引擎——现代城无需建造系统。 */
var MODCITY=(function(){
  var M={vis:false,ready:false,cities:null,cur:null,raf:0,onTravel:null,
    cam:{yaw:.65,pitch:.76,dist:3300,tx:0,tz:0,gx:0,gz:0},
    here:null,drag:null,moved:0,pinch:0,builtKey:null,
    gl:null,prog:null,bufS:null,nS:0,bufH:null,nH:0,labels:[],lastW:0,lastH:0,
    progL:null,bufSL:null,nSL:0,bufF:null,nF:0,
    det:{buf:null,n:0,cx:0,cz:0,r:0,city:null,t:0,lbuf:null,ln:0}};
  var DAT='core/res/data/st/v1/modern.dat';
  var KEYCN={'东京':'tokyo','纽约':'nyc','大阪':'osaka'};
  function gunzip(ab){return new Response(new Blob([ab]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}
  function unzjp(u){var dv=new DataView(u.buffer,u.byteOffset,u.byteLength);
    var n=dv.getUint32(4,true),off=8,metas=[],dec=new TextDecoder();
    for(var j=0;j<n;j++){var nl=dv.getUint16(off,true);off+=2;
      var nm=dec.decode(u.subarray(off,off+nl));off+=nl;
      var ln=dv.getUint32(off,true);off+=4;metas.push([nm,ln]);}
    var out={};metas.forEach(function(m){out[m[0]]=u.subarray(off,off+m[1]);off+=m[1];});return out;}
  /* 建筑与道路改用平铺 TypedArray（SoA），不再一栋一个 JS 对象。
     东京一城 44.8 万栋 + 9.9 万条路：老写法造 54.7 万个对象、常驻 50MB 起，
     还把 GC 拖到每帧可见；平铺后同样的数据只要 9.4MB，解析也快一个量级。
     车站与名所各只有几百条，仍用对象——那边要按名字检索，可读性更值钱。 */
  function parseCity(u){
    var dv=new DataView(u.buffer,u.byteOffset,u.byteLength),dec=new TextDecoder();
    var unit=dv.getFloat32(20,true);
    var nB=dv.getUint32(24,true),nR=dv.getUint32(28,true),nS=dv.getUint32(32,true),nP=dv.getUint32(36,true);
    var off=40,c={unit:unit,nB:nB,nR:nR,sta:new Array(nS),poi:new Array(nP),
      bx:new Float32Array(nB),bz:new Float32Array(nB),bh:new Float32Array(nB),
      bhx:new Float32Array(nB),bhz:new Float32Array(nB),bl:new Uint8Array(nB),
      rx:new Float32Array(nR),rz:new Float32Array(nR),rc:new Uint8Array(nR)};
    for(var i=0;i<nB;i++){
      c.bx[i]=dv.getInt16(off,true)*unit;c.bz[i]=dv.getInt16(off+2,true)*unit;
      c.bh[i]=dv.getUint16(off+4,true)/10;c.bhx[i]=dv.getUint16(off+6,true)/10;
      c.bhz[i]=dv.getUint16(off+8,true)/10;c.bl[i]=dv.getUint8(off+10);off+=11;}
    for(i=0;i<nR;i++){c.rx[i]=dv.getInt16(off,true)*unit;c.rz[i]=dv.getInt16(off+2,true)*unit;
      c.rc[i]=dv.getUint8(off+4);off+=5;}
    for(i=0;i<nS;i++){var x=dv.getInt16(off,true)*unit,z=dv.getInt16(off+2,true)*unit,cl=dv.getUint8(off+4),ln=dv.getUint8(off+5);off+=6;
      c.sta[i]={x:x,z:z,c:cl,n:dec.decode(u.subarray(off,off+ln))};off+=ln;}
    for(i=0;i<nP;i++){var x2=dv.getInt16(off,true)*unit,z2=dv.getInt16(off+2,true)*unit,rk=dv.getUint8(off+4),l2=dv.getUint8(off+5);off+=6;
      c.poi[i]={x:x2,z:z2,rk:rk,n:dec.decode(u.subarray(off,off+l2))};off+=l2;}
    return c;}
  /* 按需解析：从前一进沙盘就把三座城全解出来（东京+纽约+大阪 ≈ 101 万栋），
     玩家其实只看得见一座。现在只留原始字节，真要看哪座才解哪座；解过的留着，
     切城不用重来。 */
  var RAWC=null;
  function cityOf(key){
    if(M.cities&&M.cities[key])return M.cities[key];
    if(!RAWC||!RAWC[key])return null;
    M.cities=M.cities||{};
    M.cities[key]=parseCity(RAWC[key]);
    return M.cities[key];}
  function load(){
    if(RAWC)return Promise.resolve(RAWC);
    return fetch(DAT).then(function(r){if(!r.ok)throw new Error('modern.dat '+r.status);return r.arrayBuffer();})
      .then(gunzip).then(function(ab){
        var m=unzjp(new Uint8Array(ab)),o={};
        for(var k in m)o[k.replace('.bin','')]=m[k];
        RAWC=o;return o;});}
  /* ---- 微型 mat4 ---- */
  function mPersp(fov,asp,n,f){var t=1/Math.tan(fov/2);
    return [t/asp,0,0,0, 0,t,0,0, 0,0,(f+n)/(n-f),-1, 0,0,2*f*n/(n-f),0];}
  function mLook(ex,ey,ez,cx,cy,cz){
    var zx=ex-cx,zy=ey-cy,zz=ez-cz,zl=Math.hypot(zx,zy,zz);zx/=zl;zy/=zl;zz/=zl;
    var xx=zz,xy=0,xz=-zx,xl=Math.hypot(xx,xy,xz)||1;xx/=xl;xz/=xl;
    var yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
    return [xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
      -(xx*ex+xy*ey+xz*ez),-(yx*ex+yy*ey+yz*ez),-(zx*ex+zy*ey+zz*ez),1];}
  function mMul(a,b){var o=new Array(16);
    for(var r=0;r<4;r++)for(var c=0;c<4;c++){var s=0;
      for(var k=0;k<4;k++)s+=a[k*4+c]*b[r*4+k];o[r*4+c]=s;}return o;}
  function glInit(){
    if(M.gl)return true;
    var cv=document.getElementById('mcGl');if(!cv)return false;
    var gl=cv.getContext('webgl',{antialias:false,alpha:false});if(!gl)return false;
    function sh(tp,src){var s=gl.createShader(tp);gl.shaderSource(s,src);gl.compileShader(s);return s;}
    var vs=sh(gl.VERTEX_SHADER,
      'attribute vec3 aP;attribute vec4 aC;attribute float aPh;'+
      'uniform mat4 uVP;uniform float uPx;uniform float uT;uniform float uM;varying vec3 vC;'+
      'void main(){vec4 p=uVP*vec4(aP,1.0);gl_Position=p;'+
      'float pu=aPh>0.0?(0.72+0.5*sin(uT*2.3+aPh)):1.0;'+
      'gl_PointSize=clamp(aC.w*pu*uPx/max(p.w,1.0),1.45,30.0);'+
      'vC=aC.rgb*pu*uM*(1.0-0.30*clamp((p.w-2500.0)/6500.0,0.0,1.0));}');
    var fs=sh(gl.FRAGMENT_SHADER,
      'precision mediump float;varying vec3 vC;'+
      'void main(){vec2 d=gl_PointCoord-vec2(.5);float r=length(d);'+
      'float a=smoothstep(.5,.32,r);gl_FragColor=vec4(vC*a,a);}');
    var pr=gl.createProgram();gl.attachShader(pr,vs);gl.attachShader(pr,fs);gl.linkProgram(pr);
    gl.useProgram(pr);
    /* 线框程序：地面网格 + 建筑线框（图纸感的骨架层） */
    var vsl=sh(gl.VERTEX_SHADER,
      'attribute vec3 aP;attribute vec3 aC;uniform mat4 uVP;uniform float uM;varying vec3 vC;'+
      'void main(){gl_Position=uVP*vec4(aP,1.0);vC=aC*uM;}');
    var fsl=sh(gl.FRAGMENT_SHADER,
      'precision mediump float;varying vec3 vC;void main(){gl_FragColor=vec4(vC,1.0);}');
    var prl=gl.createProgram();gl.attachShader(prl,vsl);gl.attachShader(prl,fsl);gl.linkProgram(prl);
    M.progL=prl;
    M.laP=gl.getAttribLocation(prl,'aP');M.laC=gl.getAttribLocation(prl,'aC');
    M.luVP=gl.getUniformLocation(prl,'uVP');M.luM=gl.getUniformLocation(prl,'uM');
    M.gl=gl;M.prog=pr;
    M.aP=gl.getAttribLocation(pr,'aP');M.aC=gl.getAttribLocation(pr,'aC');M.aPh=gl.getAttribLocation(pr,'aPh');
    M.uVP=gl.getUniformLocation(pr,'uVP');M.uPx=gl.getUniformLocation(pr,'uPx');M.uT=gl.getUniformLocation(pr,'uT');M.uM=gl.getUniformLocation(pr,'uM');
    gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
    return true;}
  function buildCity(key){
    if(M.builtKey===key)return;
    var c=cityOf(key),gl=M.gl;if(!c)return;
    /* 两趟：先只数点、后按精确尺寸直写 Float32Array。
       老写法把点推进普通 JS 数组（东京 1807 万个 double ≈ 145MB 临时内存），
       再整体拷成 Float32Array 又是 69MB——单这一步就要 29 秒、内存翻倍。
       现在没有中间数组，也没有一次巨拷。 */
    var Sn=0,Hn=0,SA=null,HA=null,fill=0;
    function pS(x,y,z,r,g,b,sz){
      if(fill){var o=Sn*7;SA[o]=x;SA[o+1]=y;SA[o+2]=z;SA[o+3]=r;SA[o+4]=g;SA[o+5]=b;SA[o+6]=sz;}
      Sn++;}
    function pH(x,y,z,r,g,b,sz,ph){
      if(fill){var o=Hn*8;HA[o]=x;HA[o+1]=y;HA[o+2]=z;HA[o+3]=r;HA[o+4]=g;HA[o+5]=b;HA[o+6]=sz;HA[o+7]=ph;}
      Hn++;}
    var i,k,nB=c.nB,nR=c.nR;
    var LITE=Math.min(window.innerWidth||9999,window.innerHeight||9999)<620;
    /* 矮楼简记：东京 44.8 万栋里有 41.8 万栋是 6–12 米的普通民房，各记 5 个点，
       光它们就占了 258 万点中的 209 万——而在沙盘的常用机位（镜头距 3300）上，
       一栋房的五个屋顶点落在同一两个像素里，肉眼只读得到「那片有多亮」。
       故矮楼改记一点，亮度与点径按能量补偿，远看密度不变，点数直降到三分之一。
       真要凑近看时，近景细化层(buildDetail)会把镜头周围重新加密，细节不丢。 */
    function box(bi,lm){
      var x=c.bx[bi],z=c.bz[bi],h=c.bh[bi],hx=c.bhx[bi],hz=c.bhz[bi];
      var w=.38+lm*.30;
      if(h<12){pS(x,h,z,w*.86,w*.86,w*.82,2.25);return;}   /* 矮楼：一点抵五点 */
      pS(x-hx,h,z-hz,w*.60,w*.60,w*.57,1.7);
      pS(x+hx,h,z-hz,w*.60,w*.60,w*.57,1.7);
      pS(x-hx,h,z+hz,w*.60,w*.60,w*.57,1.7);
      pS(x+hx,h,z+hz,w*.60,w*.60,w*.57,1.7);
      pS(x,h,z,(w+.10)*.62,(w+.10)*.62,(w+.10)*.58,2.0);
      if(hx+hz>24){
        pS(x,h,z-hz,w*.55,w*.55,w*.52,1.55);
        pS(x,h,z+hz,w*.55,w*.55,w*.52,1.55);
        pS(x-hx,h,z,w*.55,w*.55,w*.52,1.55);
        pS(x+hx,h,z,w*.55,w*.55,w*.52,1.55);}
      /* 四条垂直棱线 */
      var steps=h>=26?Math.min(18,Math.max(3,Math.floor(h/9))):3;
      for(k=1;k<steps;k++){var y=h*k/steps,e=.30+lm*.24+.14*k/steps;
        pS(x-hx,y,z-hz,e*.60,e*.60,e*.56,1.5);
        pS(x+hx,y,z-hz,e*.60,e*.60,e*.56,1.5);
        pS(x-hx,y,z+hz,e*.60,e*.60,e*.56,1.5);
        pS(x+hx,y,z+hz,e*.60,e*.60,e*.56,1.5);}
      pS(x,1.2,z,.20,.19,.17,1.8);            /* 地脚 */
      if(h>72)pS(x,h+5,z,.88,.84,.72,2.6);    /* 塔顶航标 */
    }
    /* 城域包围盒只用算一次，两趟共用 */
    var xs=1e9,xb=-1e9,zs=1e9,zb=-1e9;
    for(i=0;i<nB;i++){var bx=c.bx[i],bz=c.bz[i];
      if(bx<xs)xs=bx;if(bx>xb)xb=bx;if(bz<zs)zs=bz;if(bz>zb)zb=bz;}
    function emit(){
      /* 全域地毯：整城地面点阵常驻——亮度全图均一，不再有"细化圈内亮圈外黑"的边界 */
      var gs=LITE?34:25;
      for(var gx2=xs;gx2<=xb;gx2+=gs)
        for(var gz2=zs;gz2<=zb;gz2+=gs){
          var j2=((gx2*7+gz2*13)%19)/19;
          pS(gx2+j2*5-2.5,.3,gz2+((gx2*11+gz2*5)%17)/17*5-2.5,
             .105+j2*.02,.10+j2*.02,.09,1.3);}
      for(i=0;i<nB;i++){
        if(LITE&&c.bh[i]<12&&(i&1))continue;   /* 小屏：矮楼再隔一 */
        box(i,c.bl[i]/255);}
      for(i=0;i<nR;i++){var rc=c.rc[i],rx=c.rx[i],rz=c.rz[i];
        if(rc===2)pS(rx,.8,rz,.30,.222,.10,1.7);
        else if(rc===1)pS(rx,.8,rz,.21,.175,.115,1.5);
        else if(rc===3)pS(rx,.8,rz,.115,.125,.16,1.35);
        else pS(rx,.8,rz,.115,.108,.095,1.2);}
      for(i=0;i<c.sta.length;i++){var st=c.sta[i],ph=(i%97)*.53+.7;
        var rr=st.c?1.0:.85,gg=st.c?.26:.30;
        for(k=0;k<4;k++)pH(st.x+((i*31+k*17)%9-4)*.9,3+k*8,st.z+((i*67+k*43)%9-4)*.9,rr*.62,gg*.5,.05,2.2-k*.18,ph+k*.4);}
      for(i=0;i<c.poi.length;i++){var pq=c.poi[i],ph2=(i%23)*.9+.5;
        var m2=pq.rk>=3?1.0:(pq.rk>=2?.86:.7),hgt=34+pq.rk*26;
        for(k=0;k<9;k++){var f2=k/9;
          pH(pq.x+((i*13+k*29)%11-5)*1.4,3+f2*hgt,pq.z+((i*47+k*7)%11-5)*1.4,
             m2*1.0,m2*(.46+f2*.2),.10*m2,3.1-f2*1.1,ph2+k*.3);}}
    }
    emit();                                     /* 第一趟：只数 */
    SA=new Float32Array(Sn*7);HA=new Float32Array(Hn*8);
    var nSpts=Sn,nHpts=Hn;Sn=0;Hn=0;fill=1;
    emit();                                     /* 第二趟：直写 */
    function upA(a){var b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);
      gl.bufferData(gl.ARRAY_BUFFER,a,gl.STATIC_DRAW);return b;}
    /* 线层已按用户要求撤除：只保留点阵语言 */
    if(M.bufSL)gl.deleteBuffer(M.bufSL);
    M.bufSL=upA(new Float32Array(0));M.nSL=0;
    /* 远景 LOD：一楼一点 + 半亮路网——拉远时换用它，加色不再堆到烧白。
       条数是死的（每楼一点 + 每两条路一点），直接按尺寸开数组。 */
    var nF=nB+Math.ceil(nR/2),FA=new Float32Array(nF*7),fo=0;
    for(i=0;i<nB;i++){var lf=c.bl[i]/255,wf=.16+lf*.14;
      FA[fo]=c.bx[i];FA[fo+1]=Math.max(2,c.bh[i]*.7);FA[fo+2]=c.bz[i];
      FA[fo+3]=wf*.62;FA[fo+4]=wf*.60;FA[fo+5]=wf*.55;FA[fo+6]=1.45;fo+=7;}
    for(i=0;i<nR;i+=2){
      FA[fo]=c.rx[i];FA[fo+1]=.8;FA[fo+2]=c.rz[i];
      FA[fo+3]=.10;FA[fo+4]=.085;FA[fo+5]=.05;FA[fo+6]=1.2;fo+=7;}
    if(M.bufF)gl.deleteBuffer(M.bufF);
    M.bufF=upA(FA);M.nF=fo/7;
    if(M.bufS)gl.deleteBuffer(M.bufS);if(M.bufH)gl.deleteBuffer(M.bufH);
    M.bufS=upA(SA);M.nS=nSpts;
    M.bufH=upA(HA);M.nH=nHpts;
    M.builtKey=key;
    M.det.n=0;M.det.city=null;
    M.cam.tx=0;M.cam.tz=0;M.cam.gx=0;M.cam.gz=0;M.cam.dist=3300;M.here=null;
  }
  function buildDetail(cx,cz,R,RGin){
    var c=cityOf(M.cur),gl=M.gl;if(!c)return;
    var LITE=Math.min(window.innerWidth||9999,window.innerHeight||9999)<620;
    var sRoof=LITE?4.2:2.8, sFloor=LITE?7.0:5.0, sStrip=LITE?8.5:6.0,
        sV=LITE?4.0:2.9, fH=3.2, sGrid=LITE?11:8;
    /* 上限内直接开 Float32Array：老写法先堆普通数组（满载 2.8M 个 double ≈ 22MB
       临时内存）再整体拷成 Float32Array，而这函数是镜头一动就重来的，
       每 600ms 扔掉三十几 MB 垃圾——GC 追不上就是一顿一顿的卡。 */
    var cap=LITE?1300000:2800000,A=new Float32Array(cap),An=0;
    function pD(x,y,z,r,g,b,sz){
      if(An+7>cap)return;
      A[An]=x;A[An+1]=y;A[An+2]=z;A[An+3]=r;A[An+4]=g;A[An+5]=b;A[An+6]=sz;An+=7;}
    /* 地毯网格：细化圈内连续地面点阵——近景不再是黑色虚空（STEM 地形网的味道） */
    var RG=Math.max(RGin||0,R,950);
    var gStep=Math.max(LITE?13:9,RG/110),g0=.27;
    for(var gx=Math.floor((cx-RG)/gStep)*gStep;gx<=cx+RG;gx+=gStep)
      for(var gz=Math.floor((cz-RG)/gStep)*gStep;gz<=cz+RG;gz+=gStep){
        var gdx=gx-cx,gdz=gz-cz;
        if(gdx*gdx+gdz*gdz>RG*RG)continue;
        var jit=((gx*7+gz*13)%17)/17;
        pD(gx+jit*3-1.5,.35,gz+((gx*11+gz*5)%13)/13*3-1.5,
           g0*.62+jit*.05,g0*.60+jit*.05,g0*.55,1.55);}
    var px=[0,0],pz=[0,0];                    /* 循环外复用：别一栋楼两个新数组 */
    for(var i=0,_nB=c.nB;i<_nB;i++){
      var Bx=c.bx[i],Bz=c.bz[i];
      var dx=Bx-cx,dz=Bz-cz;
      if(dx*dx+dz*dz>R*R)continue;
      var lm=c.bl[i]/255,hx=c.bhx[i],hz=c.bhz[i],h=c.bh[i];
      var wR=.62+lm*.30,wE=.52+lm*.26,wF=.42+lm*.22,wG=.24+lm*.12;
      px[0]=Bx-hx;px[1]=Bx+hx;pz[0]=Bz-hz;pz[1]=Bz+hz;
      var a,a2,b2,k,y;
      /* 屋顶轮廓（密）+ 大屋顶内部网格 */
      for(a=0;a<2;a++){
        for(b2=px[0];b2<=px[1];b2+=sRoof)pD(b2,h,pz[a],wR*.62,wR*.62,wR*.58,1.8);
        for(b2=pz[0];b2<=pz[1];b2+=sRoof)pD(px[a],h,b2,wR*.62,wR*.62,wR*.58,1.8);}
      pD(Bx,h,Bz,(wR+.12)*.64,(wR+.12)*.64,(wR+.12)*.58,1.9);
      if(hx>7&&hz>7){
        for(b2=px[0]+sGrid;b2<px[1];b2+=sGrid)
          for(var b3=pz[0]+sGrid;b3<pz[1];b3+=sGrid)
            pD(b2,h,b3,wR*.42,wR*.42,wR*.39,1.35);}
      /* 四角棱线（密） */
      for(a=0;a<2;a++)for(a2=0;a2<2;a2++)
        for(k=sV;k<h;k+=sV)pD(px[a],k,pz[a2],wE*.60,wE*.60,wE*.56,1.45);
      /* 立面网格：横向逐层楼板环 × 纵向墙面条纹 —— 近看即建筑立面 */
      if(h>=5){
        var maxF=Math.min(34,Math.floor(h/fH));
        for(var f=1;f<=maxF;f++){y=f*fH;if(y>=h)break;
          for(a=0;a<2;a++){
            for(b2=px[0]+sFloor*.5;b2<px[1];b2+=sFloor)pD(b2,y,pz[a],wF*.60,wF*.60,wF*.55,1.6);
            for(b2=pz[0]+sFloor*.5;b2<pz[1];b2+=sFloor)pD(px[a],y,b2,wF*.60,wF*.60,wF*.55,1.6);}}
        for(a=0;a<2;a++){
          for(b2=px[0]+sStrip*.5;b2<px[1];b2+=sStrip)
            for(y=sV;y<h;y+=sV)pD(b2,y,pz[a],wF*.52,wF*.52,wF*.48,1.2);
          for(b2=pz[0]+sStrip*.5;b2<pz[1];b2+=sStrip)
            for(y=sV;y<h;y+=sV)pD(px[a],y,b2,wF*.52,wF*.52,wF*.48,1.2);}}
      /* 楼基座圈：把楼"钉"在地上，消掉近景漂浮感 */
      for(a=0;a<2;a++){
        for(b2=px[0];b2<=px[1];b2+=sFloor)pD(b2,.6,pz[a],wG*.60,wG*.60,wG*.55,1.35);
        for(b2=pz[0];b2<=pz[1];b2+=sFloor)pD(px[a],.6,b2,wG*.60,wG*.60,wG*.55,1.35);}
    }
    if(M.det.lbuf){gl.deleteBuffer(M.det.lbuf);M.det.lbuf=null;}
    M.det.ln=0;
    if(M.det.buf)gl.deleteBuffer(M.det.buf);
    var b3=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b3);
    /* 只上传写满的那一段，别把 cap 的空尾巴也传给显卡 */
    gl.bufferData(gl.ARRAY_BUFFER,A.subarray(0,An),gl.STATIC_DRAW);
    M.det.buf=b3;M.det.n=An/7;M.det.cx=cx;M.det.cz=cz;M.det.r=R;M.det.city=M.cur;M.det.t=performance.now();
  }
  function project(vp,x,y,z,W,Hh){
    var cx=vp[0]*x+vp[4]*y+vp[8]*z+vp[12],cy=vp[1]*x+vp[5]*y+vp[9]*z+vp[13],
        cw=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];
    if(cw<=0)return null;
    return [(cx/cw*.5+.5)*W,(-cy/cw*.5+.5)*Hh,cw];}
  function tick(){
    if(!M.vis)return;
    var gl=M.gl,cv=document.getElementById('mcGl'),ov=document.getElementById('mcOv');
    var dpr=Math.min(devicePixelRatio||1,2);
    var W=Math.max(2,Math.round(cv.clientWidth*dpr)),Hh=Math.max(2,Math.round(cv.clientHeight*dpr));
    if(cv.width!==W||cv.height!==Hh){cv.width=W;cv.height=Hh;ov.width=W;ov.height=Hh;}
    var now=performance.now(),cam=M.cam;
    var dt=Math.min(.05,(now-(M.pT||now))*.001);M.pT=now;
    if(!M.drag)cam.yaw+=.0000034*(dt*16000);
    /* 键盘滑行：速度与缩放联动（每秒走 0.9 个镜距） */
    var kx=(M.keys.r?1:0)-(M.keys.l?1:0),kz=(M.keys.u?1:0)-(M.keys.d?1:0);
    if(kx||kz){
      var vel=cam.dist*.35*dt,sy2=Math.sin(cam.yaw),cy2=Math.cos(cam.yaw);
      cam.gx+=(kx*cy2 - kz*sy2)*vel;
      cam.gz+=(-kx*sy2 - kz*cy2)*vel;
    }
    M.moving=!!(kx||kz)||Math.hypot(cam.gx-cam.tx,cam.gz-cam.tz)>45;
    cam.tx+=(cam.gx-cam.tx)*.10;cam.tz+=(cam.gz-cam.tz)*.10;
    var ex=cam.tx+cam.dist*Math.cos(cam.pitch)*Math.sin(cam.yaw),
        ey=cam.dist*Math.sin(cam.pitch),
        ez=cam.tz+cam.dist*Math.cos(cam.pitch)*Math.cos(cam.yaw);
    var vp=mMul(mPersp(.74,W/Hh,20,60000),mLook(ex,ey,ez,cam.tx,120,cam.tz));
    gl.viewport(0,0,W,Hh);gl.clearColor(.012,.012,.012,1);gl.clear(gl.COLOR_BUFFER_BIT);
    /* 线框骨架层 */
    if(M.progL&&M.nSL){
      gl.useProgram(M.progL);
      gl.uniformMatrix4fv(M.luVP,false,new Float32Array(vp));
      gl.uniform1f(M.luM,1.0);
      gl.bindBuffer(gl.ARRAY_BUFFER,M.bufSL);
      gl.enableVertexAttribArray(M.laP);gl.vertexAttribPointer(M.laP,3,gl.FLOAT,false,24,0);
      gl.enableVertexAttribArray(M.laC);gl.vertexAttribPointer(M.laC,3,gl.FLOAT,false,24,12);
      gl.drawArrays(gl.LINES,0,M.nSL);
      if(cam.dist<2300&&M.det.ln&&M.det.city===M.cur){
        gl.uniform1f(M.luM,Math.min(1,(now-M.det.t)/450));
        gl.bindBuffer(gl.ARRAY_BUFFER,M.det.lbuf);
        gl.vertexAttribPointer(M.laP,3,gl.FLOAT,false,24,0);
        gl.vertexAttribPointer(M.laC,3,gl.FLOAT,false,24,12);
        gl.drawArrays(gl.LINES,0,M.det.ln);
      }
    }
    gl.useProgram(M.prog);
    gl.uniformMatrix4fv(M.uVP,false,new Float32Array(vp));
    gl.uniform1f(M.uPx,Hh*1.05);gl.uniform1f(M.uT,now*.001);gl.uniform1f(M.uM,1.0);
    /* 静态层：远景切一楼一点 LOD，近中景全细节 */
    var FAR=cam.dist>6200&&M.nF;
    gl.bindBuffer(gl.ARRAY_BUFFER,FAR?M.bufF:M.bufS);
    gl.enableVertexAttribArray(M.aP);gl.vertexAttribPointer(M.aP,3,gl.FLOAT,false,28,0);
    gl.enableVertexAttribArray(M.aC);gl.vertexAttribPointer(M.aC,4,gl.FLOAT,false,28,12);
    gl.disableVertexAttribArray(M.aPh);gl.vertexAttrib1f(M.aPh,0);
    gl.drawArrays(gl.POINTS,0,FAR?M.nF:M.nS);
    /* 近景细化层：拉近才画；目标移出半径 1/4 或换城就重建（限频 450ms） */
    if(cam.dist<2300){
      var dR=Math.max(650,Math.min(2100,cam.dist*1.15));
      var dMoved=Math.hypot(cam.tx-M.det.cx,cam.tz-M.det.cz);
      if(!M.moving&&!M.drag
         &&(M.det.city!==M.cur||!M.det.n||dMoved>Math.max(160,dR*.25)||Math.abs(dR-M.det.r)>dR*.35)
         &&now-M.det.t>600){buildDetail(cam.tx,cam.tz,dR,Math.max(900,Math.min(3000,cam.dist*2.2)));}
      if(M.det.n&&M.det.city===M.cur){
        gl.uniform1f(M.uM,Math.min(1,(now-M.det.t)/450));
        gl.bindBuffer(gl.ARRAY_BUFFER,M.det.buf);
        gl.vertexAttribPointer(M.aP,3,gl.FLOAT,false,28,0);
        gl.vertexAttribPointer(M.aC,4,gl.FLOAT,false,28,12);
        gl.disableVertexAttribArray(M.aPh);gl.vertexAttrib1f(M.aPh,0);
        gl.drawArrays(gl.POINTS,0,M.det.n);
        gl.uniform1f(M.uM,1.0);
      }
    }
    /* 热点层 */
    gl.bindBuffer(gl.ARRAY_BUFFER,M.bufH);
    gl.vertexAttribPointer(M.aP,3,gl.FLOAT,false,32,0);
    gl.vertexAttribPointer(M.aC,4,gl.FLOAT,false,32,12);
    gl.enableVertexAttribArray(M.aPh);gl.vertexAttribPointer(M.aPh,1,gl.FLOAT,false,32,28);
    gl.drawArrays(gl.POINTS,0,M.nH);
    /* ---- 覆盖层：标签/光柱/涟漪/城名 ---- */
    var g=ov.getContext('2d');g.clearRect(0,0,W,Hh);
    var c=cityOf(M.cur);if(!c)return;var LB=[];
    g.textBaseline='middle';
    var i,p;
    for(i=0;i<c.poi.length;i++){var q=c.poi[i];
      p=project(vp,q.x,40+q.rk*26,q.z,W,Hh);if(!p)continue;
      LB.push({x:p[0],y:p[1],n:q.n,poi:1,wx:q.x,wz:q.z});
      if(q.rk>=2||cam.dist<5000){
        g.font=(10.5*dpr)+'px ui-monospace,Menlo,monospace';
        g.fillStyle='rgba(82,48,0,.92)';
        g.fillText('◇ '+q.n,p[0]+6*dpr,p[1]);}}
    M.d1=LB.length;
    if(cam.dist<2600){
      var best=[];
      for(i=0;i<c.sta.length;i++){var s2=c.sta[i];
        p=project(vp,s2.x,34,s2.z,W,Hh);if(!p)continue;
        if(p[0]<-40||p[0]>W+40||p[1]<-40||p[1]>Hh+40)continue;
        best.push({x:p[0],y:p[1],n:s2.n,d:p[2],wx:s2.x,wz:s2.z});}
      best.sort(function(a,b){return a.d-b.d;});
      g.font=(9.5*dpr)+'px ui-monospace,Menlo,monospace';
      g.fillStyle='rgba(189,90,43,.78)';
      for(i=0;i<Math.min(22,best.length);i++){var b3=best[i];
        g.fillText('· '+b3.n,b3.x+5*dpr,b3.y);
        LB.push({x:b3.x,y:b3.y,n:b3.n,poi:0,wx:b3.wx,wz:b3.wz});}}
    M.d2=LB.length;
    if(M.here){
      p=project(vp,M.here.x,0,M.here.z,W,Hh);
      var pt=project(vp,M.here.x,210,M.here.z,W,Hh);
      if(p&&pt){
        var grd=g.createLinearGradient(p[0],p[1],pt[0],pt[1]);
        grd.addColorStop(0,'rgba(79,45,0,.95)');grd.addColorStop(1,'rgba(79,45,0,0)');
        g.strokeStyle=grd;g.lineWidth=2.2*dpr;
        g.beginPath();g.moveTo(p[0],p[1]);g.lineTo(pt[0],pt[1]);g.stroke();
        var rp=((now*.0009)%1);
        g.strokeStyle='rgba(79,45,0,'+(0.55*(1-rp)).toFixed(2)+')';g.lineWidth=1.4*dpr;
        g.beginPath();g.ellipse(p[0],p[1],rp*46*dpr,rp*17*dpr,0,0,Math.PI*2);g.stroke();
        g.font=(10.5*dpr)+'px ui-monospace,Menlo,monospace';
        g.fillStyle='rgba(79,45,0,.95)';
        g.fillText('▾ '+(M.here.n||''),pt[0]+5*dpr,pt[1]+8*dpr);}}
    M.d3=1;
    M.labels=LB;
    g.font=(10*dpr)+'px ui-monospace,Menlo,monospace';
    g.fillStyle='rgba(72,71,59,.66)';
    g.fillText({tokyo:'东京',nyc:'纽约',osaka:'大阪'}[M.cur]+' · 粒子沙盘  —  拖拽环视 / 滚轮缩放 / 点击地名前往',10*dpr,14*dpr);
    M.raf=requestAnimationFrame(tick);}
  function hit(px,py,dpr){
    var bd=26*dpr,bi=-1,bt=1e9;
    for(var i=0;i<M.labels.length;i++){var L=M.labels[i];
      var d=Math.hypot(L.x-px,L.y-py);
      if(d<bd&&d<bt){bt=d;bi=i;}}
    return bi>=0?M.labels[bi]:null;}
  function bind(){
    if(M.bound)return;M.bound=true;
    var ov=document.getElementById('mcOv');
    ov.addEventListener('pointerdown',function(e){
      M.drag={x:e.clientX,y:e.clientY,yaw:M.cam.yaw,pitch:M.cam.pitch,id:e.pointerId};M.moved=0;
      try{ov.setPointerCapture(e.pointerId);}catch(_){}});
    ov.addEventListener('pointermove',function(e){
      if(!M.drag||e.pointerId!==M.drag.id)return;
      var dx=e.clientX-M.drag.x,dy=e.clientY-M.drag.y;
      M.moved=Math.max(M.moved,Math.abs(dx)+Math.abs(dy));
      M.cam.yaw=M.drag.yaw+dx*.0042;
      M.cam.pitch=Math.max(.42,Math.min(1.30,M.drag.pitch+dy*.003));});
    function up(e){
      if(!M.drag)return;
      var dpr=Math.min(devicePixelRatio||1,2);
      if(M.moved<7){
        var r=ov.getBoundingClientRect();
        var L=hit((e.clientX-r.left)*dpr,(e.clientY-r.top)*dpr,dpr);
        if(L&&M.onTravel)M.onTravel(L.n,L.poi,L.wx,L.wz);   /* 先问，后动 */
      }
      M.drag=null;}
    ov.addEventListener('pointerup',up);ov.addEventListener('pointercancel',function(){M.drag=null;});
    ov.addEventListener('wheel',function(e){e.preventDefault();e.stopPropagation();
      M.cam.dist=Math.max(320,Math.min(11000,M.cam.dist*(1+e.deltaY*.0011)));},{passive:false});
    /* WASD／方向键平移：按键状态表 + 逐帧积分——按住即匀速滑行，
       不吃系统按键重复的节奏（那正是"先顿半秒再机关枪跳步"的卡顿感来源）。 */
    M.keys={};
    function keyDir(e){
      var k=(e.key||'').toLowerCase();
      if(k==='w'||e.key==='ArrowUp')return 'u';
      if(k==='s'||e.key==='ArrowDown')return 'd';
      if(k==='a'||e.key==='ArrowLeft')return 'l';
      if(k==='d'||e.key==='ArrowRight')return 'r';
      return null;
    }
    window.addEventListener('keydown',function(e){
      if(!M.vis)return;
      /* 必须「在局内且沙盘真实可见」才拦键：退出游戏后 M.vis 与行内 display
         都会残留，此前把选局环的左右键全吞了——环转不动，像卡死。
         offsetParent 能看穿父级隐藏；GAME.on 兜底。 */
      try{if(!GAME.on)return;}catch(_){return;}
      var md0=document.getElementById('modScene3D');
      if(!md0||!md0.offsetParent)return;
      var tg=e.target;
      if(tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA'||tg.isContentEditable))return;
      var d0=keyDir(e);if(!d0)return;
      e.preventDefault();e.stopPropagation();
      M.keys[d0]=1;
    },true);
    window.addEventListener('keyup',function(e){
      var d0=keyDir(e);if(d0)delete M.keys[d0];
    },true);
    window.addEventListener('blur',function(){M.keys={};});}
  function show(cnKey,td){
    var key=KEYCN[cnKey]||cnKey;
    load().then(function(){
      if(!glInit())return;
      bind();buildCity(key);M.cur=key;
      /* 时地里带具体地名则自动定位 */
      try{var c=cityOf(key),tdS=String(td||'');
        var all=c.poi.concat(c.sta),bestI=-1,bestL=0;
        for(var i=0;i<all.length;i++){var nm=all[i].n;if(!nm)continue;
          var core=nm.replace(/站$/,'');
          if(core.length>=2&&tdS.indexOf(core)>=0&&core.length>bestL){bestL=core.length;bestI=i;}}
        /* 只在「时地文本真的变了」时才吸附（剧情把人带去新地点）。
           此前每个 3D 心跳都重设镜头目标——WASD 刚挪出去半秒就被拽回，
           表现就是弹簧一样弹来弹去、永远走不动。 */
        if(bestI>=0){var bn=all[bestI].n;
          if(bn!==M.tdName){M.tdName=bn;
            M.here={x:all[bestI].x,z:all[bestI].z,n:bn};
            M.cam.gx=all[bestI].x;M.cam.gz=all[bestI].z;}}
      }catch(_){}
      if(!M.vis){M.vis=true;cancelAnimationFrame(M.raf);M.raf=requestAnimationFrame(tick);}
    }).catch(function(err){
      try{var ov=document.getElementById('mcOv'),g=ov.getContext('2d');
        ov.width=ov.clientWidth||300;ov.height=ov.clientHeight||150;
        g.font='11px ui-monospace,monospace';g.fillStyle='rgba(174,99,62,.9)';
        g.fillText('粒子沙盘资材加载失败：'+String(err&&err.message||err),10,20);}catch(_){}
    });}
  function hide(){if(M.vis){M.vis=false;cancelAnimationFrame(M.raf);}}
  /* 退场清算：显存缓冲、已解析城池、原始字节全放掉，并让 WebGL 上下文丢失。
     不做这一步的话，一份被换下的文档还攥着几十 MB 显存与堆内存不放，
     而它已经再没有人能够到——正是「内存吃到十几 G」的那份账。 */
  function dispose(){
    try{hide();}catch(_){}
    var gl=M.gl;
    if(gl){
      ['bufS','bufH','bufF','bufSL'].forEach(function(k){if(M[k]){try{gl.deleteBuffer(M[k]);}catch(_){}M[k]=null;}});
      if(M.det){['buf','lbuf'].forEach(function(k){if(M.det[k]){try{gl.deleteBuffer(M.det[k]);}catch(_){}M.det[k]=null;}});M.det.n=0;M.det.city=null;}
      try{var ext=gl.getExtension('WEBGL_lose_context');if(ext)ext.loseContext();}catch(_){}
    }
    M.gl=null;M.prog=null;M.progL=null;M.builtKey=null;
    M.cities=null;RAWC=null;M.cur=null;M.labels=[];
  }
  return {show:show,hide:hide,dispose:dispose,
    travelTo:function(n,wx,wz){M.here={x:wx,z:wz,n:n};M.cam.gx=wx;M.cam.gz=wz;
      if(M.cam.dist>1700)M.cam.dist=1700;},
    labels:function(){return (M.labels||[]).map(function(l){return {n:l.n,x:l.x,y:l.y,poi:l.poi};});},
    state:function(){return {vis:M.vis,cur:M.cur,here:M.here,dist:Math.round(M.cam.dist),gx:Math.round(M.cam.gx),gz:Math.round(M.cam.gz),tx:Math.round(M.cam.tx),tz:Math.round(M.cam.tz),d1:M.d1,d2:M.d2,d3:M.d3,nlb:(M.labels||[]).length,det:{n:M.det.n,r:Math.round(M.det.r),city:M.det.city}};},
    setTravel:function(f){M.onTravel=f;},
    setHere:function(n){try{var c=cityOf(M.cur);if(!c)return;
      var all=c.poi.concat(c.sta);
      for(var i=0;i<all.length;i++)if(all[i].n===n){M.here={x:all[i].x,z:all[i].z,n:n};M.cam.gx=all[i].x;M.cam.gz=all[i].z;return;}}catch(_){}}};
})();
try{window.MODCITY=MODCITY;}catch(_){}
/* 名所小传：确认框里的一句话介绍；车站走通稿 */
var MODINTRO={
 '皇居':'旧江户城内郭，如今的天皇御所。玉砂利与松，二重桥外永远有人举着相机。',
 '东京站':'丸之内红砖站舍，大正三年开业。新干线与在来线在地下交错成迷宫。',
 '新宿站':'吉尼斯认证的世界最大客流车站，每日三百五十万人从两百个出口涌出。',
 '涩谷十字路口':'一次绿灯三千人同时过街的全向十字路口，屏幕光把夜浇成白昼。',
 '银座四丁目':'和光钟楼与三越狮子像对望的十字路口，一坪地价可换一栋郊外别墅。',
 '秋叶原':'电器街、女仆咖啡与十二层的模型楼——中年人的乡愁和少年人的圣地同一条街。',
 '东京塔':'昭和三十三年的红白铁塔，比埃菲尔高九米，是这座城最老派的浪漫。',
 '六本木':'新城与旧夜店共存的坡道街区，深夜出租车排成河。',
 '上野公园':'樱花、西乡像、博物馆群与不忍池——江户以来的市民乐园。',
 '浅草寺':'雷门大灯笼下永远排着队，仲见世通的人形烧香气一路飘到宝藏门。',
 '晴空塔':'六百三十四米的电波塔，隅田川对岸的新地标。',
 '池袋站':'东武西武两大百货夹着的巨型枢纽，北口的中华物产店越开越多。',
 '中野站':'中央线快速五分钟到新宿——站北的百老汇商场里堆满旧漫画与手办。',
 '原宿':'竹下通的可丽饼与表参道的橱窗只隔一条马路。',
 '筑地':'场内市场迁去丰洲之后，场外市场的玉子烧和金枪鱼盖饭照样排队。',
 '时代广场':'广告屏的峡谷，午夜亮得像正午。每年跨年一百万人挤在这里看水晶球落下。',
 '帝国大厦':'一九三一年的装饰艺术尖顶，八十六层观景台的风永远比楼下大两级。',
 '中央公园南':'马车、地价与天际线在第五十九街对峙。',
 '大都会艺术博物馆':'五千年的人类文明堆在第五大道旁，埃及馆的丹铎神庙整座搬了进来。',
 '洛克菲勒中心':'金色普罗米修斯俯瞰溜冰场，圣诞树是全美国的圣诞树。',
 '苏富比':'约克大道的拍卖行总部——那一夜，第四十一号拍品与两位不死者同厅。',
 '华尔街':'铜牛、联储金库与幸存者纪念碑挤在半英里内，金钱在此有教堂。',
 '世贸一号楼':'五百四十一米的自由塔，脚下是双子塔遗址的两方黑色水池。',
 '布鲁克林大桥':'一八八三年的钢缆竖琴，走过它就走过了纽约的两个世纪。',
 '联合国总部':'东河畔的玻璃板楼，一百九十三面旗帜按字母排开。',
 '五大道57街':'奢侈品牌的十字路口，橱窗比美术馆换展还勤。',
 '切尔西市场':'旧饼干工厂改的美食市集，高线公园从楼顶穿过。',
 '中央车站':'鲸鱼腹一样的绿色穹顶画满星座，四面钟下是纽约人约会的原点。',
 '自由塔码头':'炮台公园南端，自由女神在雾里只剩一个青绿色的轮廓。',
 '大阪站·梅田':'北区的心脏，地下街织成迷宫，时空广场的大钟悬在铁道上空。',
 '道顿堀':'固力果跑者与巨蟹招牌的运河夜景，章鱼烧的香气挤满每一座桥。',
 '难波站':'南海、近铁、地下铁在此打结，出站就是心斋桥筋的入口。',
 '大阪城天守阁':'太阁的金鯱天守，石垣是全日本最气派的巨石阵。',
 '通天阁':'新世界的铁塔，串炸店从塔脚排到晚上十一点。',
 '心斋桥':'御堂筋东侧的百年商店街，药妆店的免税牌子比樱花还密。',
 '黑门市场':'大阪的厨房——河豚、和牛、玉子烧，边走边吃是正确吃法。',
 '天王寺':'阿倍野HARUKAS俯瞰四天王寺的飞檐，新旧一千四百年同框。',
 '天王寺站':'环状线南端的枢纽，天桥上能同时望见通天阁和HARUKAS。',
 '中之岛':'堂岛川与土佐堀川夹出的细长岛，中央公会堂的红砖在水里发光。',
 '京瓷巨蛋':'白色飞碟形的棒球场，演唱会散场时地铁站要排四十分钟。',
 '大阪港天保山':'摩天轮与海游馆守着湾岸，鲸鲨在八米深的水槽里绕圈。',
 '歌舞伎町':'不夜城的霓虹峡谷，居酒屋与无料案内所共用一面墙。',
 '明治神宫':'原宿站旁一脚踏进百年镇守之森，玉砂利路吸掉整座城市的噪音。',
 '表参道':'榉木夹道的坡路，橱窗比表参道之丘的坡度还讲究。',
 '国会议事堂':'白色金字塔顶的议事堂，永田町的心脏。',
 '东京大学':'赤门与银杏道，本乡台地上的最高学府。',
 '神保町书店街':'旧书店密度世界第一的街区，咖喱香混着旧纸味。',
 '日本桥':'五街道的起点，桥面正中嵌着日本国道路元标。',
 '台场海滨公园':'彩虹桥对岸的人工沙滩，自由女神像的东京分身面朝湾岸。',
 '品川':'新干线与在来线的南大门，站港南口的写字楼森林晚九点依旧通明。',
 '两国国技馆':'土俵与力士的主场，散场时相扑火锅店坐满一条街。',
 '唐人街':'坚尼街以南的粤语与福州话街区，烧腊橱窗蒸汽不散。',
 '苏活区':'铸铁建筑与卵石路，画廊搬走后奢侈品牌住了进来。',
 '格林威治村':'爵士俱乐部与褐石屋，垮掉派与民谣的老巢。',
 '联合广场':'农夫市集、滑板少年与抗议标语共用一个广场。',
 '熨斗大厦':'1902 年的三角熨斗，第五大道与百老汇在此相吻。',
 '麦迪逊广场花园':'尼克斯与游骑兵的主场，宾州车站就在它脚下。',
 '哈德逊城市广场':'Vessel 蜂巢楼梯与玻璃观景台，铁路调车场上长出的新城。',
 '林肯中心':'大都会歌剧院的水晶吊灯升起时，喷泉广场正好入夜。',
 '自然历史博物馆':'蓝鲸悬在海洋厅穹顶下，恐龙化石排到走廊尽头。',
 '古根海姆美术馆':'赖特的白色螺旋，看展像沿着鹦鹉螺往下走。',
 'DUMBO':'曼哈顿大桥拱洞框住帝国大厦的那张明信片就在这条石板路上。',
 '威廉斯堡':'东河对岸的仓库街区，精酿、黑胶与周末跳蚤市场。',
 '哈莱姆125街':'阿波罗剧院的霓虹下，福音、爵士与嘻哈同台一百年。',
 '哥伦比亚大学':'晨边高地的常春藤校园，图书馆前的雅典娜铜像看着百老汇大道。',
 '克莱斯勒大厦':'装饰艺术的银冠与鹰形滴水兽，纽约天际线最优雅的一笔。',
 '新世界':'昭和味最浓的街区，串炸配啤酒，通天阁在头顶看着。',
 '四天王寺':'圣德太子创建的日本最古官寺，回廊金堂一千四百年。',
 '住吉大社':'住吉造本殿与反桥，大阪人的初诣首选。',
 '大阪天满宫':'天神祭的主场，学问之神管着全大阪的考生。',
 '天神桥筋商店街':'2.6 公里的日本最长商店街，从一丁目走到七丁目要一个下午。',
 '梅田蓝天大厦':'空中庭园展望台连接双塔，扶梯悬在 170 米的天上。',
 '美国村':'三角公园周围的古着与街头文化，大阪的原宿。',
 '鹤桥':'烤肉烟气从站台就开始飘，关西最大的韩国城。',
 '阿倍野HARUKAS':'300 米的日本第一高楼（曾经），展望台能望到明石海峡。',
 '京桥':'京阪与JR交汇的老繁华场，立饮屋从中午开始满员。',
 '日本桥电电城':'关西的秋叶原，模型店与女仆咖啡沿堺筋排开。'};
MODCITY.setTravel(function(name,isPoi,wx,wz){
  try{
    if(!GAME.on)return;
    var host=document.getElementById('modScene3D');if(!host)return;
    var old=document.getElementById('mcDlg');if(old)old.remove();
    var cityCN=({tokyo:'东京',nyc:'纽约',osaka:'大阪'})[ (window.MODCITY&&MODCITY.state().cur)||'' ]||'';
    var intro=MODINTRO[name]||(isPoi?('「'+name+'」——'+cityCN+'的一处去处。这一带的街声、店招与人流，是这座城此刻最诚实的切面。')
      :('「'+name+'」——'+cityCN+'轨道网的一站。站口的人流与店招，是这座城最诚实的切面。'));
    var d=document.createElement('div');d.id='mcDlg';
    d.style.cssText='position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:30;'
      +'max-width:min(520px,92%);background:rgba(237,231,217,.93);border:1px solid rgba(132,88,0,.55);'
      +'padding:12px 16px 10px;font-family:var(--mono);backdrop-filter:blur(4px)';
    d.innerHTML='<div style="font-size:12.5px;letter-spacing:.22em;color:var(--gold-hi)">'
      +(isPoi?'◇ ':'· ')+cityCN+' · '+name+'</div>'
      +'<div style="font-size:11.5px;line-height:1.85;color:#34332a;margin-top:7px;letter-spacing:.05em">'+intro+'</div>'
      +'<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px">'
      +'<span id="mcDlgNo" class="btn" style="cursor:pointer;font-size:11px;letter-spacing:.2em;color:var(--mut);border:1px solid rgba(19,18,13,.25);padding:5px 12px">返 回</span>'
      +'<span id="mcDlgGo" class="btn" style="cursor:pointer;font-size:11px;letter-spacing:.24em;color:#e9e3d6;background:var(--gold);padding:5px 14px">移 动 ⏎</span></div>';
    host.appendChild(d);
    d.querySelector('#mcDlgNo').addEventListener('pointerup',function(ev){ev.stopPropagation();d.remove();});
    d.querySelector('#mcDlgGo').addEventListener('pointerup',function(ev){
      ev.stopPropagation();d.remove();
      try{MODCITY.travelTo(name,wx,wz);}catch(_){}
      if(!BUSY)sendText('（移动：玩家已移动到'+cityCN+'·'+name
        +'。本回合以抵达后的实景、人流与动静续写，时地更新为'+cityCN+'·'+name+'。）');
    });
  }catch(_){}});
function zj3dTick(){
  try{
    if(window.FELVN&&FELVN.tick){FELVN.tick(window.__FELVN_STATE__?window.__FELVN_STATE__():null);return;}
    /* 三维那一层停用了。这里再挡一道：存档里带着旧的展开档位、
       或是别处把 txOpen 打开，都不该把资材包与现代城的点云拉起来。 */
    if(window.__ZJ3D_OFF__)return;
    if(!GAME.txOpen)return;
    /* 艳后线同走地中海路线：亚历山卓等古城与东京（现代城生成）都在 MED 引擎；
       只有周纪卡固定中原引擎。 */
    var med=(ACTIVE!=='zhou');
    var p=currentPanel(),cw=p?p.world:{};
    var _m=mood();
    var _td=t2s(String(cw['时地']||cw['時地']||''));
    var _loc,_zh=null; /* _zh 非空＝此地属中原，画面交给 ZJ3D 引擎 */
    if(med){
      var _zhT=cnLoc(_td);
      if(GAME.dest3d){
        var _zhD=cnLoc(GAME.dest3d);
        if(_zhD){ /* 目的地在中原：叙事抵达后交还叙事 */
          if(_zhT===_zhD)GAME.dest3d=null;
          _zh=_zhD;
        }else{
          var _dl=medLoc(GAME.dest3d);
          /* 叙事已抵达该地则交还叙事，否则以玩家选定地为准 */
          if(!_zhT&&medLoc(_td)===_dl)GAME.dest3d=null;
          _loc=_dl;
        }
      }else if(_zhT){_zh=_zhT;}
      else _loc=medLoc(_td);
      /* 艳后线双线开局：进场第一眼跟随开场侧（东京六叠间）——
         状态栏时地停在梦境侧，但玩家还没动过手，画面先落在现实这头；
         第一手落子之后照旧跟叙事（入梦=埃及城，起床=东京沙盘）。 */
      try{
        if(ACTIVE==='cleo'&&!GAME.dest3d
           &&!(S.history&&S.history.some(function(h){return h.role==='user';}))){
          _loc='东京';_td='2026年·东京·中野';   /* 光柱落在大叔家门口 */
        }
      }catch(_){}
    }else{
      _loc=playerLoc().name;
      if(GAME.dest3d&&locByName(GAME.dest3d)){ /* 中原地图点选：三维即刻随行 */
        if(_loc===GAME.dest3d)GAME.dest3d=null; else _loc=GAME.dest3d;
      }
      _zh=_loc; /* 周纪卡永远走中原引擎 */
    }
    /* 【方位】只在地球仪选点和开局时写过，剧情推着走之后再没人更新：
       system 里每回合都写着「当前所在：罗马」，状态栏却已经在雅典，
       模型于是反复把主角拉回罗马、或写出「你人在雅典（罗马）」这种自相矛盾的句子。
       这里跟着状态栏的 ◇时地 同步一次，三者（提示词方位／状态栏时地／三维城池）对齐。 */
    var zhShow=!!_zh;
    if(zhShow)_loc=_zh;
    if(_loc&&(!GAME.place||GAME.place.cn!==_loc))GAME.place={n:(GAME.place&&GAME.place.n)||'',cn:_loc};
    var zh=document.getElementById('zjScene3D'),mh=document.getElementById('mdScene3D');
    var _mod=document.getElementById('modScene3D');
    var MODSET3={'东京':1,'纽约':1,'大阪':1};
    var isMod=(!zhShow)&&MODSET3[_loc];
    if(_mod)_mod.style.display=isMod?'block':'none';
    if(isMod){
      /* 现代都会：粒子沙盘接管，建造系引擎休眠（现代剧情无建造） */
      if(zh)zh.style.display='none';
      if(mh)mh.style.display='none';
      try{if(window.MED3D&&MED3D.sleep)MED3D.sleep();}catch(_){}
      try{if(window.ZJ3D&&ZJ3D.sleep)ZJ3D.sleep();}catch(_){}
      window.__CUR3D=null;
      if(_loc&&(!GAME.place||GAME.place.cn!==_loc))GAME.place={n:'',cn:_loc};
      try{MODCITY.show(_loc,_td);}catch(_){}
      try{if(window.__arrPaint)window.__arrPaint();}catch(_){}
      return;
    }
    try{MODCITY.hide();}catch(_){}
    if(zh)zh.style.display=zhShow?'block':'none';
    if(mh)mh.style.display=zhShow?'none':'block';
    var E=zhShow?window.ZJ3D:window.MED3D;
    var O=zhShow?window.MED3D:window.ZJ3D;
    window.__CUR3D=E;                    /* GENIVS.ENG() 据此对准正在显示的那台引擎 */
    if(O&&O!==E&&O.sleep)O.sleep(); /* 另一侧引擎休眠省内存 */
    if(!E)return;
    /* 中原引擎兩張卡共用：告訴它現在誰在操縱，天子與貝羅娜不是同一個人 */
    if(window.ZJ3D&&window.ZJ3D.setSide)window.ZJ3D.setSide(ACTIVE);
    if(E.wake)E.wake();
    var _Eo=homeEng(); /* 档位记在本卡引擎上，借用引擎同步之 */
    if(E!==_Eo&&_Eo&&_Eo.tier!=null){E.tier=_Eo.tier;E.expanded=!!_Eo.expanded;}
    if(E.setEra)E.setEra(cw['纪年']||(GAME.op?GAME.op.era:'')||'');
    /* mvuSpec 里对模型白纸黑字写着「天气一栏必须含 晴/阴/雨/雪/风/雾 之一（三维画面据此取景）」，
       但天气此前从未传给过引擎——对玩家和对模型都是失约。先交天气再交地点，
       这样新城一建好就带着当下的天色，不会先亮一帧晴天再变。 */
    if(E.setWeather){try{E.setWeather(_m);}catch(_){}}
    if(E.onRender)E.onRender(_loc,_m.night,_m);
    if(E.onStory){var _lm=null;for(var i=S.history.length-1;i>=0;i--){if(S.history[i].role!=='user'){_lm=S.history[i];break;}}E.onStory(_lm&&_lm.text?_lm.text:'');}
    /* 把状态栏 ◈ 行里的在场者交给引擎放进场景：AI 写到谁，谁就站在她面前。
       在此之前场上只有程序生成的路人，剧情写谁画面都不知道。 */
    if(E.setCast){try{
      var _cp=currentPanel();
      E.setCast((_cp&&_cp.npcs)?_cp.npcs.map(function(n){
        return {name:n.name,role:n.role,state:n.state,favor:n.favor};}):[]);
    }catch(_){}}
    if(zhShow){edictSync();}else{medEdictSync();}
  }catch(e){}
}
/* 这份文件被整体简体化过一遍，两张地名对照表里成对的「繁体键」全被压成了重复的简体键
   （'洛阳':'洛邑','洛阳':'洛邑' 这种），所谓「繁简同收」实际已经失效。
   与其逐条补回四十多个键，不如在查表前把输入统一归一到简体。 */
var _T2S={'陽':'阳','長':'长','臨':'临','鄲':'郸','鄴':'邺','鄭':'郑','薊':'蓟','蘇':'苏','會':'会',
 '關':'关','靈':'灵','壽':'寿','羅':'罗','馬':'马','爾':'尔','蘭':'兰','頓':'顿','盧':'卢','倫':'伦',
 '萊':'莱','麥':'麦','條':'条','亞':'亚','歷':'历','紐':'纽','約':'约','庫':'库','戰':'战','廣':'广',
 '場':'场','奧':'奥','賽':'赛','華':'华','鄉':'乡','莊':'庄','農':'农','時':'时','齊':'齐','趙':'赵',
 '韓':'韩','衛':'卫','東':'东','門':'门','龍':'龙','鳳':'凤','張':'张','區':'区','細':'细','點':'点',
 '紀':'纪','歲':'岁','雞':'鸡','鹹':'咸','鎮':'镇','縣':'县','鐵':'铁','銅':'铜','橋':'桥','廟':'庙',
 '壇':'坛','闕':'阙','觀':'观','園':'园','營':'营','漢':'汉','趨':'趋','錫':'锡','邊':'边','陳':'陈'};
function t2s(x){return String(x==null?'':x).replace(/[\u4e00-\u9fff]/g,function(c){return _T2S[c]||c;});}
function cnLoc(td){ /* 时地/目的地 → 中原引擎地点键（命中即两引擎互通；繁简同收） */
  if(!td)return null;
  td=t2s(td);
  var CN={'洛邑':'洛邑','雒阳':'洛邑','雒阳':'洛邑','洛阳':'洛邑','洛阳':'洛邑',
    '咸阳':'咸阳','咸阳':'咸阳','长安':'咸阳','长安':'咸阳',
    '临淄':'临淄','临淄':'临淄','邯郸':'邯郸','邯郸':'邯郸','邺':'邯郸','邺':'邯郸',
    '郢':'郢','成都':'成都','曲阜':'曲阜','新郑':'新郑','新郑':'新郑',
    '大梁':'大梁','蓟':'蓟','蓟':'蓟','姑苏':'姑苏','姑苏':'姑苏',
    '会稽':'会稽','会稽':'会稽','番禺':'会稽',
    '函谷关':'函谷关','函谷关':'函谷关','商丘':'商丘','陶邑':'陶邑',
    '灵寿':'灵寿','灵寿':'灵寿','宛城':'宛'};
  td=String(td);
  var ks=Object.keys(CN);
  ks.sort(function(a,b){return b.length-a.length;});
  for(var i=0;i<ks.length;i++)if(td.indexOf(ks[i])>=0)return CN[ks[i]];
  return null;
}
function medLoc(td){ /* 时地 → 引擎地点键（繁简同收，村庄/港市按词相择形） */
  td=t2s(td);
  var CM={
    /* —— 秦纪 时地→引擎城名（先长后短匹配，别名收全）。
       中原十七城由 cnLoc 先接走，落到这里的是它管不到的那些地方。 —— */
    '沙丘平台':'沙丘平台','沙丘':'沙丘平台','巨鹿':'巨鹿','平原津':'平原津',
    '上郡驰道':'肤施·上郡','肤施':'肤施·上郡','上郡':'肤施·上郡','驰道':'肤施·上郡',
    '直道':'九原','九原':'九原','阴山':'阴山长城','长城':'阴山长城','河南地':'河南地',
    '头曼城':'头曼城','单于庭':'头曼城','匈奴':'头曼城',
    '骊山':'骊山','阿房':'阿房','上林苑':'上林苑','兰池':'兰池',
    '云阳':'云阳·甘泉','甘泉':'云阳·甘泉','雍城':'雍城','栎阳':'栎阳','蓝田':'蓝田',
    '郑国渠':'郑国渠','武关':'武关','萧关':'萧关','大散关':'大散关',
    '博浪沙':'博浪沙','阳翟':'阳翟','濮阳':'濮阳','东郡':'濮阳','定陶':'定陶',
    '即墨':'即墨','琅邪台':'琅邪台','琅邪':'琅邪台','之罘':'之罘','碣石':'碣石',
    '泰山':'泰山','梁父':'泰山','易水':'易水','襄平':'襄平','辽东':'襄平',
    '上蔡':'上蔡','单父':'单父','南郡':'郢·南郡','江陵':'郢·南郡','郢都':'郢·南郡',
    '南阳':'宛','会稽山':'会稽山','钱唐':'会稽山','浙江':'会稽山',
    '番禺':'番禺','南海':'番禺','桂林':'桂林郡','象郡':'象郡','灵渠':'灵渠','长沙':'长沙',
    '都江堰':'都江堰','南郑':'南郑','汉中':'南郑','临洮':'临洮','陇西':'临洮',
    '张掖':'张掖','河西':'张掖','月氏':'张掖'};
  var ks=Object.keys(CM);
  /* 先长后短，免得「迦太基」吃掉「新迦太基」 */
  ks.sort(function(a,b){return b.length-a.length;});
  for(var i=0;i<ks.length;i++)if(td.indexOf(ks[i])>=0)return CM[ks[i]];
  /* 现代城市总表同样入典：命中即生成同名风格化城 */
  try{
    var mbest='';
    for(var mi=0;mi<MODSITES.length;mi++){var mn=MODSITES[mi][2];if(mn&&td.indexOf(mn)>=0&&mn.length>mbest.length)mbest=mn;}
    if(mbest)return mbest;
  }catch(_){}
  if(/村|乡|乡|庄|庄|农|农|田舍/.test(td))return '田舍村';
  /* 未入典：从时地提取地名 token，交给引擎种子化生成同名城（真·定位） */
  /* 原来取的是最后一个「·」分段，那通常是房间／细部：
     「午后 · 色萨利，法萨卢斯平原」得「色萨利」，下一回 AI 写成
     「夜 · 色萨利·法萨卢斯营地」就得「法萨卢斯营地」——剧情明明没挪窝，
     三维却见 cityKey 变了就整场重建，玩家在该城造的东西成批「消失」。
     改成从左往右取第一个「不是时辰」的分段，细部段一概不参与城名。 */
  /* 时辰也要认：本纪的时地写的是「申末」「三更」「午前」这一路，
     不认就会被当成地名，画面于是落到一座叫「申末」的城上。 */
  var TIMEP=/^(前?\d+年|[一二三四五六七八九十百]+月|[一二三四五六七八九十]+日|黄昏|拂晓前?|夜半|入夜前?|夜|清晨|凌晨|平旦|日出|鸡鸣|隅中|日中|日昳|哺时|日入|人定|上午|午前|正午|午后|下午|傍晚|日暮前?|日昃|[一二三四五]更|[子丑寅卯辰巳午未申酉戌亥](时|初|正|末)|晨|暮|晚[间上]?[一二三四五六七八九十]*时?)\s*/;
  var tk=String(td||''),_segs=tk.split(/[·・]/),_pick='';
  for(var _si=0;_si<_segs.length;_si++){
    var _sg=String(_segs[_si]||'').trim();
    _sg=(_sg.split(/[，,。；;]/)[0]||'').trim();
    while(TIMEP.test(_sg))_sg=_sg.replace(TIMEP,'').trim();
    if(_sg.length>=2){_pick=_sg;break;}
  }
  tk=_pick||(tk.split(/[，,。；;]/)[0]||'').trim();
  tk=tk.replace(TIMEP,'');
  tk=tk.replace(/(家宅门外|门外|门前|寝殿|宴厅|王帐|山脊背面|背面|一侧河岸|下游滩涂|滩涂|坡地|山脊|营中人质帐|人质帐|营中|近河口盐场|盐场|西岸|东岸|南岸|北岸)$/,'');
  tk=tk.replace(/^.*河(东岸|西岸|南岸|北岸)(?=.)/,'');
  tk=tk.replace(/[0-9０-９]+号?.*$/,'').trim();
  var tk2=tk.replace(/^(小亚细亚|小亚细亚|埃及|马其顿|马其顿|雪山之下的?)/,'').trim();
  if(tk2.length>=2)tk=tk2;
  if(tk.length>8)tk=tk.slice(0,8);
  if(tk.length>=2)return tk;
  /* 剥后缀剥过头（「门外」「营中」剥完只剩一个字）时，回到剥离前的分段，
     而不是一路掉到「罗马」——那等于把玩家凭空传送回首都。 */
  if(_pick&&_pick.length>=2)return _pick.length>8?_pick.slice(0,8):_pick;
  return '罗马';
}
function medEdictSync(){ /* 环海侧 sec_deed 敕令：同 edictSync，落到 MED3D */
  if(!GAME.on||!window.MED3D||!MED3D.owns()||!MED3D.applyEdict)return;
  zjSyncHist();
  for(var i=S.history.length-1;i>=0;i--){
    var h=S.history[i];if(h.role!=='world')continue;
    var d=parseDeed(h.text);
    if(d)MED3D.applyEdict(d,'t'+i+'@'+deedHash(h.text));
    return;
  }
}
(function(){
  var ar=document.getElementById('arr3d');
  if(ar){
    /* 三维画面四档循环：默认 → 放大 → 全屏 → 收起 → 默认…
       原来是展开／收起两个钮各管一头，现在全交给左上角那一枚台前调度小窗，
       点一下走一档。四档正好绕一圈，点过头再点三下就回来，不会卡死在某一端。 */
    /* 档位要写给「当前这条线用的那台引擎」。写死 MED3D 是个哑 bug：
       周纪／陆之纪走的是 ZJ3D，setTier 把档位记到了一台根本没在跑的引擎上，
       tierNow 也从那台空引擎读回 0。后果是画面里那枚「营造」按下去毫无反应——
       引擎自己把 expanded 翻成 true、ZJ3D_onExpand 也挂上了 tx2，
       紧接着 paint() 从 MED3D 读回 0，又把 tx2 摘掉了。 */
    function eng(){return homeEng();}
    /* 档位原来只存在引擎对象上：引擎还没加载（或这条线根本不用引擎）时
       tierNow 恒返回 0，setTier 写进去也没人接——点多少下都停在第一档。
       面板自己的布局档不该依赖引擎在不在。这里补一份本地的：
       引擎在就以引擎为准并回记（建造清单那类自抬层级要认），不在就用本地这份。 */
    var TIER=0;
    try{var _t0=parseInt(localStorage.getItem('med3d_tier'),10);
        if(_t0>=0&&_t0<=2)TIER=_t0;}catch(_){}
    function tierNow(){
      var E=eng();
      if(E&&E.tier!=null)TIER=Math.max(0,Math.min(2,E.tier|0));
      return TIER;
    }
    function setTier(tt){
      TIER=Math.max(0,Math.min(2,tt|0));
      var E=eng();
      if(E){E.tier=TIER;E.expanded=TIER>0;}
      try{localStorage.setItem('med3d_tier',String(TIER));
          localStorage.setItem('med3d_expand',TIER>0?'1':'0');}catch(_){}
    }
    function paint(){
      var g=document.getElementById('game'),tr=tierNow();
      var wasBig=g.classList.contains('txBig'),nowBig=GAME.txOpen&&tr===2;
      g.classList.toggle('txOpen',GAME.txOpen);
      g.classList.toggle('tx2',GAME.txOpen&&tr===1);
      g.classList.toggle('txBig',nowBig);
      /* 进全屏那一下把情报台的窗收回缩略列（撤闸在缩略小窗的 click 上）。
         只在「刚进来」这一下落闸：已经在全屏里叫出来的窗，后面再 paint 一次
         （别处改档位、心跳同步）不该把它又收回去。 */
      if(nowBig&&!wasBig)g.classList.add('txMvShut');
      else if(!nowBig)g.classList.remove('txMvShut');
      /* 单臂：每个入口(渲染/缩放/点击/心跳)从前都会各自起一条 480ms 独立链，
         回合越多链越多，同一份工作被跑 N 遍——旧链还把死文档钉着。 */
      if(GAME.txOpen&&LIVE){if(_TICK_T)clearTimeout(_TICK_T);_TICK_T=tmo(zj3dTick,480);}
    }
    /* 行为一律现查真实状态，不看样式类：面板是初始化之后才打开的，
       拿一次性算出来的 class 当开关，点了会毫无反应。 */
    function cycle(){
      var E=eng();
      if(!GAME.txOpen){ GAME.txOpen=true; setTier(0); if(E&&E.wake)E.wake(); }
      else if(tierNow()<2){ setTier(tierNow()+1); }
      else{                                          /* 已全屏：这一下是收起 */
        GAME.txOpen=false; setTier(0);
        try{if(window.MED3D&&MED3D.sleep)MED3D.sleep();}catch(_){}
        try{if(window.ZJ3D&&ZJ3D.sleep)ZJ3D.sleep();}catch(_){}
      }
      paint();
    }
    ar.addEventListener('click',cycle);
    paint();
    window.__arrPaint=paint;   /* 别处改了档位（如营造清单自抬层级）后可让钮态跟上 */
    /* 档位钮原来只在左边那一列上。人的眼睛在窗子里，手却要伸到窗外去按——
       所以窗子自己也挂一枚（见 #vnZoom），按的是同一个循环，不另起一套状态。 */
    window.__txCycle=cycle;
    window.__txTier=tierNow;
    /* 全屏里情报台那扇窗是点出来的，那就也该点得回去：点窗子以外的任意地方
       （立绘、正文、对话框、左边那一列……）立刻收回缩略列。
       两种地方放过：窗子自己身上——那是在里面翻内容、按按钮；
       以及缩略小窗——它自己那条 click 已经把开关这件事管了，
       在这儿再插一手，两处就会一开一关地互相抵消。
       用捕获阶段，免得被沿途 stopPropagation 的处理器吃掉。 */
    if(!window.__txMvBound){
      window.__txMvBound=1;
      document.addEventListener('click',function(e){
        var g=document.getElementById('game');
        if(!g||!g.classList.contains('txBig')||g.classList.contains('txMvShut'))return;
        var t=e.target;
        if(t&&t.closest&&(t.closest('.gMfd .mvWin')||t.closest('.gMfd .mvCard')))return;
        g.classList.add('txMvShut');
      },true);
    }
    /* 整块收起／还原。手机上切到情报台那一页时要用：三维画面 z-index 25、
       情报台只有 20，画面直接盖在状态栏上，那一页根本没法读。
       只在「是我们自己收起来的」时候才还原，玩家自己关掉的不去动它。 */
    window.__paneStash=function(){
      if(!GAME.txOpen)return false;
      var t=tierNow();
      GAME.txOpen=false;setTier(0);
      try{if(window.MED3D&&MED3D.sleep)MED3D.sleep();}catch(_){}
      try{if(window.ZJ3D&&ZJ3D.sleep)ZJ3D.sleep();}catch(_){}
      paint();
      return t;                                  /* 记住原来是哪一档 */
    };
    window.__paneRestore=function(t){
      if(GAME.txOpen||t===false||t==null)return;
      var E=eng();
      GAME.txOpen=true;setTier(t);
      if(E&&E.wake)E.wake();
      paint();
      try{setTimeout(zj3dTick,60);}catch(_){}
    };
  }
  /* 面板内的 DICTVM 指令栏已移除：它和主输入栏的 EDICTVM·敕令 同名却做两件事，
     玩家分不清；而三维该跟着剧情走——换城由 ◇时地 经 medLoc→onRender 驱动，
     兴废由 AI 的 <sec_deed>、GENIVS 的意图抽取、以及建造清单三条路承担。
     参照 RitusZhou：同一套引擎，它压根没有面板内输入栏。 */
  addEventListener('resize',function(){if(GAME.txOpen)zj3dTick();});
})();

addEventListener('keydown',function(e){if(e.key==='Escape'&&document.getElementById('fdOv')){e.stopPropagation();fdClose();}},true);
zjLoadPref();
(function(){
  var di=document.getElementById('dreamIn'),dw=document.getElementById('dreamOut');
  function arm(which){
    if(ACTIVE!=='cleo'||!GAME.on)return;
    DREAMARM=(DREAMARM===which)?null:which;   /* 再按一次=取消 */
    if(di)di.classList.toggle('on',DREAMARM==='入梦');
    if(dw)dw.classList.toggle('on',DREAMARM==='起床');
    /* 输入框空着＝这一按就是「现在就睡／现在就醒」，当场发出去。
       只武装不发的老做法，按下去只有钮变个金色，玩家看到的就是「按不动」。
       写了话再按则照旧：那一句连同睡醒指令一并送出。 */
    if(DREAMARM){
      var gi=document.getElementById('gIn');
      if(gi&&!gi.value.trim()){
        var gs=document.getElementById('gSend');
        if(gs)gs.click();
      }
    }
  }
  if(di)di.addEventListener('click',function(){arm('入梦');});
  if(dw)dw.addEventListener('click',function(){arm('起床');});
})();

/* ============ opening loader: fill narrative + MFD from a card opening ============ */
function loadOpening(side,op,locOverride){
  ACTIVE=side;
  TYPE_GEN++;TURNS=[];TURNI=0;BUSY=false;
  GAME.memoryId=felNewMemoryId();             /* 每一局一座独立宫殿，绝不串档 */
  /* Risu 的 chat variables 与世界书开关属于这一局；global variables 才跨局。
     新开一局必须清掉上一局触发器留下的局部状态，再执行 start 生命周期。 */
  try{SET.vars={};SET.loreState={};setStore();}catch(_){}
  /* GENIVS 的 PREV 是「上一轮补全后的面板」，一直没人清过：换卡换开局之后，
     上一局的人物（罗马的军医昆图斯、百人队长马尔库斯）会被 completeMvu 原样合并进
     周纪的「在场诸人 · 洛邑明堂」，而且赖着不走；两卡共有的键（持物/观瞻/神格/史笔）
     若本回 AI 漏写，也会从上一局继承过来。 */
  try{GENIVS.reset();}catch(_){}
  GAME.op=op;GAME.opText=op.text;GAME.cognition=(op&&op.cognition)||null;
  /* 新局＝新的人。上一局的行囊留在身上，掖庭的猫娘会背着蹶张弩进来。 */
  try{invPreset(op);}catch(_){}
  GAME.hero=null;                       /* 正史开局一律是卡里的本尊；自定义开局随后再写回 */
  /* 开局可指定三维落点：像「东方尽头」这种在中原一侧的场景，时地里没有任何中原城名，
     medLoc 只能按字面派生出一座地中海式的城，画面就仍旧是罗马。这里直接把落点交给中原引擎。 */
  GAME.dest3d=op.zh3d||null;_zjOpC={};try{fdClose();}catch(_){}zjLoadPref();
  /* 新局＝新的一卷。zjLoadPref 读的是「按卡」存的全局偏好，会把上一局的编年史整卷
     读回来，而 sysPrompt 又把它当作「本局全部既定事实」每回注入——于是 AI 不断
     重演上一局的人和事。这是「剧情一直循环」体感最强的来源。
     玩家手记（manual）保留，自动纪要清掉。 */
  try{
    S.mem=(S.mem||[]).filter(function(m){return m&&m.manual;});
    S.memN=0;S.memNpc=null;S.memEdit=null;S.npcMeta={};S.graphHidden=[];
    savePref();
  }catch(_){}
  var body=stripMvu(op.text),panel=parseMvu(op.text);
  var nr=$('#gNarr');nr.innerHTML='';
  body.split(/\n{2,}/).forEach(function(par){
    var p=document.createElement('p');
    if(felNarrClass(par))p.className='heart';
    var htm=esc2(par).replace(/\n/g,'<br>')
      .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
      .replace(/「([^」]*)」/g,'「<span class="q">$1</span>」');
    p.innerHTML=htm;
    nr.appendChild(p);
  });
  var eot=document.createElement('div');eot.className='gEot';eot.textContent='·  ·  EOT  ·  ·';
  nr.appendChild(eot);nr.scrollTop=0;
  if(panel)renderMvu(panel);
  try{dreamSync(panel);}catch(_){}
  gLocSet(esc2(locOverride||op.era)+'&nbsp;<i>·</i>&nbsp;'+esc2(op.scene));
  GAME.place={n:'',cn:op.scene||''};
  /* 开局这一幕不走 renderReply，得单独叫一次参谋——
     否则玩家一进来面对空白输入框，正是「不知道能干什么」的时候。 */
  try{setTimeout(function(){suggGen();},300);}catch(_){}
}
function nearestOpening(side,year){
  var ops=CARDS[side].openings||[];if(!ops.length)return null;
  var best=null,bd=1e9;
  ops.forEach(function(o){var d=Math.abs((o.year||0)-year);if(d<bd){bd=d;best=o;}});
  return best;
}
/* era box: line tabs + direct opening chips */
var EBLINE='luzhi';
function ebRenderOps(){
  var host=$('#ebOps');host.innerHTML='';
  var ops=CARDS[EBLINE].openings||[];
  if(!ops.length){
    var d=document.createElement('div');d.className='sub';
    d.textContent='—— 陆之卷开局灌注中 ——';
    host.appendChild(d);return;
  }
  ops.forEach(function(o){
    var d=document.createElement('div');d.className='ebOp';
    d.innerHTML='<b>'+esc2(o.era)+'</b><span>'+esc2(o.scene)+'</span>';
    d.addEventListener('pointerup',function(e){e.stopPropagation();
      ebClose();
      ERA.year=o.year||117;ERA.sel=null;
      loadOpening(EBLINE,o);
      gameShow();
    });
    host.appendChild(d);
  });
}
(function(){
  var tabs=document.querySelectorAll('#eraBox .ebTab');
  for(var i=0;i<tabs.length;i++)(function(tb){
    tb.addEventListener('click',function(){
      EBLINE=tb.getAttribute('data-line');
      for(var j=0;j<tabs.length;j++)tabs[j].classList.toggle('on',tabs[j]===tb);
      ebRenderOps();
    });
  })(tabs[i]);
})();
/* save slots v2: full snapshots — write / load / delete / export / import */
function svGet(n){try{return JSON.parse(localStorage.getItem('guardianDragonSv_'+n)||'null');}catch(_){return null;}}
/* 全站唯一的 localStorage 写入口。原来到处都是 try{setItem}catch(_){}：
   配额一满（开过生图极易达到），编年长卷、人物图谱、装备、接口 Key、自写世界书
   全部停止落盘，而界面上一个字都不提示——玩家以为都存好了，一刷新全没了。 */
var _LSWARNED=false;
function lsSet(k,v){
  try{localStorage.setItem(k,v);return true;}
  catch(e){
    if(!_LSWARNED){
      _LSWARNED=true;
      try{narrAdd('sys','⚠&nbsp;本机存储已满：进度与设置已停止保存。请到&nbsp;设置·备&nbsp;清理「图库缓存」或删掉几格存档',null);}catch(_){}
      try{console.warn('[storage] quota exceeded on',k);}catch(_){}
    }
    return false;
  }
}
function svPut(n,v){
  try{localStorage.setItem('guardianDragonSv_'+n,v?JSON.stringify(v):'');
      if(!v)localStorage.removeItem('guardianDragonSv_'+n);return true;}
  catch(e){
    /* 原来把配额溢出整个吞掉：玩家点了写入、什么都没发生、槽位仍是 VACVVM，毫无提示 */
    try{var m=$('#svCoreSub');if(m)m.textContent='写入失败 · 本机存储已满（可在备份页清理图库缓存或自定义字体）';}catch(_){}
    try{narrAdd('sys','⚠&nbsp;存档写入失败：本机存储已满',null);}catch(_){}
    return false;
  }
}
/* 顶栏「时地」：放得下就静止，放不下就循环横滚——手机上这一条常常还是超宽
   （「前332年一月 · 推罗，海墙下的栈道尽头」轻松三百多像素），
   原来是 text-overflow:ellipsis 直接截断，后半截永远看不到。
   真正的内容始终留在 data-raw 上，滚动轨道只是表现层：存档、读档、量宽度
   一律以 data-raw 为准，免得把复制出来的那一份也存进存档里。 */
function gLocSet(html){
  var el=$('#gLoc');if(!el)return;
  el.setAttribute('data-raw',(html==null?'':String(html)));
  gLocFit();
}
function gLocRaw(){var el=$('#gLoc');return el?(el.getAttribute('data-raw')||el.innerHTML||''):'';}
function gLocFit(){
  var el=$('#gLoc');if(!el)return;
  var raw=el.getAttribute('data-raw');
  if(raw==null){raw=el.innerHTML;el.setAttribute('data-raw',raw);}   /* 老存档／首次调用 */
  el.innerHTML=raw;
  var room=el.clientWidth;
  /* 文字真实宽度不能用 scrollWidth——它至少等于 clientWidth，文字比窗口窄时
     量到的永远是窗口宽，间距就补不出来，宽屏上照旧并排看见两遍。
     拿一个脱离布局的探针量：挂在 gLoc 里才继承得到同一套字体与字距。 */
  var probe=document.createElement('span');
  probe.style.cssText='position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:0';
  probe.innerHTML=raw;el.appendChild(probe);
  var need=Math.ceil(probe.getBoundingClientRect().width);
  el.removeChild(probe);
  if(!room||!need)return;
  /* 放得下也照样转。间距至少要补满「窗口比文字宽出来」的那一截，
     这样同一时刻画面里永远只有一份，不会并排看见两遍同样的字。 */
  var GAP=Math.max(36,room-need+24);
  var track=document.createElement('span');
  track.className='zj3dMarq';
  track.style.cssText='display:inline-flex;white-space:nowrap;will-change:transform';
  /* 两份内容各自带同样的右间距，整条轨道正好是「一份＋间距」的两倍——
     translateX(-50%) 走完刚好接回起点，接缝处不会跳一下。 */
  for(var i=0;i<2;i++){
    var c=document.createElement('span');
    c.innerHTML=raw;c.style.paddingRight=GAP+'px';
    if(i)c.setAttribute('aria-hidden','true');
    track.appendChild(c);
  }
  el.innerHTML='';el.appendChild(track);
  /* 速度恒定 ~22px/s，但一圈最长封到 20 秒——宽屏上间距被撑得很大时，
     否则一圈要转半分钟，看着像卡住了。 */
  track.style.animationDuration=Math.min(26,Math.max(9,(need+GAP)/22))+'s';
}
addEventListener('resize',function(){try{gLocFit();}catch(_){}});
function svSnap(){
  /* 存的是 data-raw 那一份原文，不是滚动轨道里复制出来的两份 */
  var _lr=gLocRaw();
  var _lt=document.createElement('span');_lt.innerHTML=_lr;
  return {t:(_lt.textContent||'').trim(),when:new Date().toLocaleString(),
    active:ACTIVE,year:ERA.year,loc:_lr,
    /* 存档时正文可能正在流式输出：直接抓 innerHTML 会把进度条和 .liveWrap 半截正文
       一起写进去，读档后正文里永久卡着一条走不完的进度条（序列化丢事件，✕ 中断
       变成死按钮）外加一段半截文。先克隆一份、摘掉这两类临时节点再序列化。 */
    html:(function(){
      try{
        var _nr=$('#gNarr').cloneNode(true);
        _nr.querySelectorAll('.genBar,.liveWrap').forEach(function(n){n.remove();});
        return _nr.innerHTML;
      }catch(_){return $('#gNarr').innerHTML;}
    })(),
    mfd:document.querySelector('#game .gMfd').innerHTML,
    inv:JSON.parse(JSON.stringify(INV)),place:GAME.place,
    memoryId:felMemoryId(),                    /* 两套本地记忆共用同一存档隔离键 */
    ts:Date.now(),                                     /* when 是本地化字符串排不了序，另存真时间戳 */
    op:GAME.op,opText:GAME.opText,dest3d:GAME.dest3d,   /* 开局锚点：不存则读档后 AI 与三维都不知本局年代场景 */
    hero:GAME.hero||null,
    world:(function(){try{return (window.WORLD_UI&&window.WORLD_UI.snapshotExtra)?window.WORLD_UI.snapshotExtra():null;}catch(_){return null;}})(),               /* 自定义开局的本局主角；不存则读档后又变回卡里的本尊 */
    cognition:(function(){try{return JSON.parse(JSON.stringify(GAME.cognition||null));}catch(_){return null;}})(),
    /* 面板本体也要存。只存 mfd 那段 HTML 的话，读档后 80ms 的重绘会拿「从原文重新
       parse 出来的」降级面板把它盖掉——AI 那一轮偷懒少写几栏，读档后就永久少几栏。 */
    lastPanel:(function(){try{return JSON.parse(JSON.stringify(GAME.lastPanel||null));}catch(_){return null;}})(),
    /* Risu 兼容的 chat variables 与触发器世界书开关随这一局存取；global variables
       仍留在设置中跨局共享。 */
    runtime:{vars:JSON.parse(JSON.stringify((SET&&SET.vars)||{})),
             loreState:JSON.parse(JSON.stringify((SET&&SET.loreState)||{}))},
    zj:{mem:S.mem,memN:S.memN,memOn:S.memOn,npcMeta:S.npcMeta,graphHidden:S.graphHidden},
    /* turns 原来只存最后 40 条，memN 却存全量：读档后 memSync 数出来的 world 条数远小于
       memN，命中「历史被重开/回退」分支，把最近的全部纪要删掉并立刻 savePref 落盘——
       重开也回不来。而 sysPrompt 每回把编年长卷当「本局全部既定事实」注入，
       于是 AI 被告知故事停在第 20 回、正文却已演到第 30 回，它把 21～30 回重演一遍。 */
    /* 三维那一侧的营造名录、金库、敕令全是「32 个槽位共用的单份全局值」：
       存档回到过去、城市却停在未来——拆掉的建筑不会回来，花掉的金子不会退。
       整份快照进存档，读档时原样写回。 */
    b3d:(function(){
      var K=['med3d_builds_v1','med3d_razed_v1','zj3d_builds_v1','zj3d_razed_v1',
             'med3d_econ','zj3d_econ','med3d_ledger','zj3d_ledger','med3d_edict','zj3d_edict'];
      var o={};K.forEach(function(k){var v=null;try{v=localStorage.getItem(k);}catch(_){}
        if(v!=null)o[k]=v;});
      return o;
    })(),
    turns:TURNS.slice(-200)};
}
/* ── 续局：正在玩的这一局连续写进本机 ──────────────────────────
   「继续游戏」原来只认内存里的 GAME.op：退回菜单还在，一刷新／关掉重开就没了，
   玩家只剩「开始」一条路，等于上一局白玩。这里按存档同一份快照（svSnap）落盘，
   开菜单时若内存里没有局、本机有这一份，照样把「继续游戏」亮出来。
   写入时机：每 20 秒一次（内容没变就不写）、页面隐藏／关闭时补一次、进局时先落一份。
   BUSY（正文正在流式输出）时不写——半截的一幕不该成为回来时的起点。 */
var AUTOK='guardianDragonAuto2';
function autoSave(force){
  if(!GAME.on||!GAME.op)return;
  if(BUSY&&!force)return;
  var sig=TURNS.length+'|'+(TURNS.length?(TURNS[TURNS.length-1].t||0):-1);
  if(!force&&autoSave._sig===sig)return;
  var v;try{v=svSnap();}catch(_){return;}
  if(!v||typeof v.html!=='string')return;
  if(lsSet(AUTOK,JSON.stringify(v)))autoSave._sig=sig;
}
function autoGet(){
  try{var v=JSON.parse(localStorage.getItem(AUTOK)||'null');
      return (v&&typeof v==='object'&&typeof v.html==='string'&&Array.isArray(v.turns))?v:null;}
  catch(_){return null;}
}
ivl(function(){autoSave();},20000);
addEventListener('pagehide',function(){autoSave(1);});
addEventListener('visibilitychange',function(){if(document.hidden)autoSave(1);});
function svLoadCore(v){
  TYPE_GEN++;BUSY=false;
  try{GENIVS.reset();}catch(_){}      /* 换局＝换底：先把上一局的 carry-forward 清干净 */
  ACTIVE=v.active||'luzhi';ERA.year=(v.year==null?1206:v.year);
  GAME.memoryId=v.memoryId||felNewMemoryId();  /* 老档从本次读入开始建立独立宫殿 */
  GAME.cognition=v.cognition||null;
  ERA.act=buildActs(ERA.year);ERA.sel=null;
  gLocSet(v.loc||'');
  $('#gNarr').innerHTML=v.html||'';
  ensureTurnTranslateOps($('#gNarr'));
  document.querySelector('#game .gMfd').innerHTML=v.mfd||'';
  try{mvRingMount();}catch(_){}
  TURNS=v.turns||[];TURNI=TURNS.length?(Math.max.apply(null,TURNS.map(function(t){return t.t||0;}))+1):0;
  if(!GAME.cognition){
    for(var _ci=TURNS.length-1;_ci>=0;_ci--){
      if(TURNS[_ci].role==='assistant'&&TURNS[_ci].cognition){GAME.cognition=TURNS[_ci].cognition;break;}
    }
  }
  if(v.runtime){SET.vars=v.runtime.vars||{};SET.loreState=v.runtime.loreState||{};}
  else{SET.vars={};SET.loreState={};}
  setStore();
  if(v.inv&&v.inv.eq&&v.inv.bag){INV=v.inv;invStore();}
  GAME.place=v.place||null;INVSEL=null;invRender();
  /* 读档时的面板要按实时路径同样的方式重建：从开局起逐幕合并，而不是只取
     「最后一个写了面板的回合」。只取最后一幕的话，那一幕漏写的栏位读档后就永久消失，
     玩家会看到存档一读进来状态栏当场缩水。 */
  GAME.lastPanel=null;
  if(v.lastPanel&&v.lastPanel.ch)GAME.lastPanel=v.lastPanel;   /* 新档：存的就是补全后的那一份 */
  else{                                                        /* 老档兜底：从开局起逐幕合并 */
    try{if(v.opText){var _op=parseMvu(v.opText);if(_op)GAME.lastPanel=_op;}}catch(_){}
    for(var li=0;li<TURNS.length;li++){
      if(TURNS[li].role!=='assistant')continue;
      var _tp=null;try{_tp=parseMvu(TURNS[li].content);}catch(_){}
      if(_tp)GAME.lastPanel=mvuMerge(GAME.lastPanel,_tp);
    }
  }
  try{GENIVS.setPrev(GAME.lastPanel);}catch(_){}
  try{zjLoadPref();}catch(_){}
  /* zjLoadPref 读的是「按卡」的全局偏好，会把最新一局的长卷盖上来。
     槽位里若存了本局的开局锚点与记忆，一律以槽位为准。老存档没有这些字段，
     走 if 兜底、行为同旧版，向后兼容。 */
  if(v.op){GAME.op=v.op;GAME.opText=v.opText||(v.op&&v.op.text)||'';_zjOpC={};}
  GAME.hero=(v.hero&&v.hero.n)?v.hero:null;
  if(v.dest3d!==undefined)GAME.dest3d=v.dest3d||null;
  if(v.zj){
    S.mem=v.zj.mem||[];S.memN=(v.zj.memN==null?S.mem.length:v.zj.memN);
    /* 老存档的 turns 是截断过的，memN 照旧会超出可数出的 world 条数——夹一下，
       让 memSync 既不误判回退、也不会去删本来就还在的纪要。 */
    try{var _wn=1;for(var _wi=0;_wi<TURNS.length;_wi++)if(TURNS[_wi].role==='assistant')_wn++;
        if(S.memN>_wn)S.memN=_wn;}catch(_){}
    if(v.zj.memOn!==undefined)S.memOn=v.zj.memOn!==false;
    S.npcMeta=v.zj.npcMeta||{};S.graphHidden=v.zj.graphHidden||[];
    try{savePref();}catch(_){}
  }
  /* 三维状态回档。写回后把两台引擎的城池键清掉，让它们下一帧照新名录重建，
     否则画面上还站着上一份存档里的建筑。 */
  if(v.b3d){
    try{
      /* 存档是权威：快照里没有的键要删掉，不能留着。否则「存档时还没花过钱、
         之后花掉一半国库」这种情况读档后金库仍是花完的样子——存档回到过去、
         城市停在未来，正是这条要修的毛病。 */
      var _K3=['med3d_builds_v1','med3d_razed_v1','zj3d_builds_v1','zj3d_razed_v1',
               'med3d_econ','zj3d_econ','med3d_ledger','zj3d_ledger','med3d_edict','zj3d_edict'];
      _K3.forEach(function(k){
        if(v.b3d[k]!=null)lsSet(k,v.b3d[k]);
        else try{localStorage.removeItem(k);}catch(_){}
      });
      ['MED3D','ZJ3D'].forEach(function(en){
        var E=window[en];if(!E)return;
        if(E.reloadStore){try{E.reloadStore();}catch(_){}}
        else try{E.cityKey=null;}catch(_){}
      });
      setTimeout(function(){try{zj3dTick();}catch(_){}},200);
    }catch(_){}
  }
  setTimeout(function(){try{if(GAME.lastPanel)renderMvu(GAME.lastPanel);else graphHydrate();}catch(_){}},80);
  $('#dlgSave').style.display='none';
  if(!GAME.on)gameShow();
  else{
    /* 局中读档：gameShow 不再走一遍，可这一趟开头刚把 ERA.act 换成了 buildActs()——
       那是上一张卡的周秦城池表，四十一代里对得上的只有一代。
       所以这儿要照读进来的这一局把地点表补回去，再去原表要一份新的。 */
    var _fl2=null;
    try{_fl2=(GAME.op&&GAME.op.feLocs&&GAME.op.feLocs.length)?GAME.op.feLocs:null;}catch(_){}
    if(_fl2)gmActsSet(_fl2);
    gmActsFresh();
  }
}
/* ═══ 视觉小说这扇窗：自己的档位钮，以及可以拖到任意位置 ═══
   拖动的做法照 ghost 那张卡里那一套：按住窗身（避开钮与输入框）拖，
   位移记进 sessionStorage（刷新前一直记着），clamp 保证窗缘不出视口，
   挪过位就在窗上浮出一枚归位钮。
   位移不写内联 transform，写 --txX/--txY 两个自定义属性——见那两条 CSS 的注释。 */
(function(){
  var OFF={x:0,y:0};
  try{var sv=JSON.parse(sessionStorage.getItem('fel_tx_off')||'0');
      if(sv&&typeof sv.x==='number'&&typeof sv.y==='number')OFF=sv;}catch(_){}
  var D={on:0,px:0,py:0,x0:0,y0:0,moved:0,base:null,id:null};
  function pn(){return document.getElementById('pnTx');}
  function big(){try{return document.getElementById('game').classList.contains('txBig');}catch(_){return false;}}
  function save(){try{sessionStorage.setItem('fel_tx_off',JSON.stringify(OFF));}catch(_){}}
  function apply(){
    var el=pn();if(!el)return;
    /* 全屏那一档不吃偏移。写在样式表里是没用的：这两个属性是内联写上去的，
       内联压过任何选择器——所以要在这儿把它按成零，记着的那份偏移不动，
       退出全屏时原样回到玩家拖过的位置。 */
    var z=big();
    el.style.setProperty('--txX',(z?0:OFF.x)+'px');
    el.style.setProperty('--txY',(z?0:OFF.y)+'px');
    var h=document.getElementById('vnHome');
    if(h)h.classList.toggle('on',!!(OFF.x||OFF.y)&&!z);
  }
  function home(){
    var el=pn();if(!el)return;
    OFF={x:0,y:0};save();
    el.style.transition='transform .34s cubic-bezier(.2,.85,.25,1)';
    apply();
    setTimeout(function(){var e2=pn();if(e2)e2.style.transition='';},380);
  }
  document.addEventListener('click',function(e){
    var t=e.target;if(!t||!t.closest)return;
    if(t.closest('#vnZoom')){e.stopPropagation();try{window.__txCycle();}catch(_){}
      setTimeout(apply,60);return;}
    if(t.closest('#vnHome')){e.stopPropagation();home();return;}
  },true);
  function down(x,y,t){
    var el=pn();if(!el||!t||!t.closest)return false;
    if(!t.closest('#pnTx'))return false;
    if(big())return false;                       /* 全屏那一档不拖 */
    /* 窗里自己有钮、有画布、有可滚的名录：这些一律不算「抓窗身」。 */
    if(t.closest('button,a,input,textarea,select,canvas,[data-nodrag],#vnTalk'))return false;
    var r=el.getBoundingClientRect();
    D.on=1;D.moved=0;D.px=x;D.py=y;D.x0=OFF.x;D.y0=OFF.y;
    D.base={l:r.left-OFF.x,t:r.top-OFF.y,w:r.width,h:r.height};
    return true;   /* 调用处会 preventDefault：窗底铺着一张背景图，
                      不拦住，一按住往边上拖浏览器就当你要把图拖走，
                      发一个 pointercancel 把这一趟掐断——实测拖两百像素只走十五。 */
  }
  function move(x,y){
    if(!D.on)return false;
    var dx=x-D.px,dy=y-D.py;
    if(!D.moved&&Math.abs(dx)<6&&Math.abs(dy)<6)return true;   /* 手一抖不算拖 */
    D.moved=1;
    var el=pn();if(!el){D.on=0;return false;}
    var vw=innerWidth,vh=innerHeight,b=D.base;
    var nx=D.x0+dx,ny=D.y0+dy;
    /* 横着至少留 90 像素在视口里，竖着顶缘不出屏、底下至少留 56——
       拖到只剩一条缝就再也抓不回来了。 */
    nx=Math.max(90-b.w-b.l,Math.min(nx,vw-90-b.l));
    ny=Math.max(-b.t,Math.min(ny,vh-56-b.t));
    OFF.x=Math.round(nx);OFF.y=Math.round(ny);
    apply();
    return true;
  }
  function up(){if(!D.on)return;D.on=0;if(D.moved){save();apply();}}
  addEventListener('pointerdown',function(e){
    if(e.pointerType==='mouse'&&e.button!==0)return;
    if(down(e.clientX,e.clientY,e.target)){D.id=e.pointerId;e.preventDefault();}
  },true);
  addEventListener('dragstart',function(e){
    if(D.on&&e.target&&e.target.closest&&e.target.closest('#pnTx'))e.preventDefault();
  },true);
  addEventListener('pointermove',function(e){
    if(!D.on||e.pointerId!==D.id)return;
    if(move(e.clientX,e.clientY))e.preventDefault();
  },true);
  addEventListener('pointerup',up,true);
  addEventListener('pointercancel',up,true);
  /* 窗子重开、换档、改视口之后都对一次：档位一变，能落脚的范围也变了。 */
  addEventListener('resize',function(){
    var el=pn();if(!el)return;
    var r=el.getBoundingClientRect();
    if(r.left>innerWidth-60||r.top>innerHeight-40||r.right<60){OFF={x:0,y:0};save();}
    apply();
  });
  apply();
})();
/* ── ARCHIVVM 目录场：档案夹卡浮于透视线场，随滑鼠／陀螺仪视差移动（CRYPTAR1S DIRECTORY 式）── */
var SVN=32,SVSEL=0;
var SV_ROMAN=(function(){var R=[],U=['','I','II','III','IV','V','VI','VII','VIII','IX'],T=['','X','XX','XXX'];
  for(var i=1;i<=40;i++)R.push(T[Math.floor(i/10)]+U[i%10]);return R;})();
var SVP={mx:0,my:0,tx:0,ty:0,px:0,py:0,drag:null,raf:0,cards:[]};
function svRnd(i,k){var x=Math.sin(i*127.1+k*311.7)*43758.5453;return x-Math.floor(x);}
var SVL=[],SVLS=[],SVDISC=null;
function svDiscMake(){
  var R=Math.round(Math.min(innerWidth,innerHeight)*DPR*.165);
  var c=document.createElement('canvas');c.width=c.height=R*2+6;
  var g=c.getContext('2d'),cx=c.width/2,cy=c.height/2;
  for(var ri=0;ri<20;ri++){
    var rr=R*(.30+ri/20*.70),n=Math.max(6,Math.round(rr/(2.8*DPR)));
    for(var k=0;k<n;k++){
      var aa=k/n*Math.PI*2+ri*.21,d=(1-ri/20)*.55+.16;
      g.fillStyle='rgba('+SV_INK+','+(d*(.25+svRnd(ri*97+k,11)*.5)).toFixed(3)+')';
      g.fillRect(cx+Math.cos(aa)*rr,cy+Math.sin(aa)*rr,1.5*DPR,1.5*DPR);
    }
  }
  g.strokeStyle='rgba('+SV_INK+',.16)';g.lineWidth=DPR;
  g.beginPath();g.arc(cx,cy,R*.42,0,Math.PI*2);g.stroke();
  SVDISC=c;
}
var SV_INK='241,210,140',SV_HI='255,233,184';
function svBgDraw(){
  var cv=$('#svBg');if(!cv)return;
  cv.width=Math.round(innerWidth*DPR);cv.height=Math.round(innerHeight*DPR);
  SVL=[];
  for(var i=0;i<108;i++)SVL.push({
    a:svRnd(i,1)*Math.PI*2,                    /* 起始角 */
    r0:.02+svRnd(i,2)*.13,                     /* 内端（灭点附近） */
    r1:.55+svRnd(i,3)*.85,                     /* 外端（越出画面边界，永不断开） */
    w:(svRnd(i,4)<.12?1.7:1),
    al:.05+svRnd(i,5)*.14,
    sp:(svRnd(i,6)-.5)*.014,                   /* 角速度：扇面极缓旋拧 */
    bp:svRnd(i,7)*6.283,bs:.10+svRnd(i,8)*.22, /* 明暗呼吸（放慢、幅度小） */
    hp:svRnd(i,9),hs:.055+svRnd(i,10)*.10      /* 高光行进：慢速长带，避免闪烁 */
  });
  SVLS=[];
  for(var q=0;q<34;q++)SVLS.push({y:svRnd(q,7),x:svRnd(q,8),len:.05+svRnd(q,9)*.30,
    sp:.004+svRnd(q,10)*.018,al:.03+svRnd(q,11)*.06});
  svDiscMake();
}
/* 每帧：线流自灭点向外涌出（近端淡入、远端淡出），横向资料流平移，网点球缓慢自转 */
function svFx(t){
  var cv=$('#svBg');if(!cv||!cv.width)return;
  var W=cv.width,H=cv.height,g=cv.getContext('2d'),cx=W/2,cy=H/2;
  g.clearRect(0,0,W,H);
  var DIAG=Math.hypot(W,H);
  for(var i=0;i<SVL.length;i++){
    var L=SVL[i],aa=L.a+t*L.sp;                       /* 整根线只转不断 */
    var sh=.86+.14*Math.sin(t*L.bs+L.bp);             /* 明暗呼吸：幅度收小，不刺眼 */
    var r0=L.r0*H*(1+.07*Math.sin(t*.55+L.bp));       /* 内端轻微伸缩 */
    var r1=L.r1*DIAG;
    var ca=Math.cos(aa),sa=Math.sin(aa);
    /* 底线：全长连续、恒在（不断线） */
    g.strokeStyle='rgba('+SV_INK+','+(L.al*sh*.72).toFixed(3)+')';
    g.lineWidth=L.w*DPR*.8;
    g.beginPath();g.moveTo(cx+ca*r0,cy+sa*r0);g.lineTo(cx+ca*r1,cy+sa*r1);g.stroke();
    /* 高光：沿同一条线由内向外加速奔行＝穿梭动感（叠加在底线上，底线不受影响） */
    var hp=(L.hp+t*L.hs)%1,span=r1-r0;
    var h0=r0+span*hp*hp,h1=h0+span*(.24+hp*.46);   /* 更长的光带＝滑行而非闪点 */
    if(h1>r1)h1=r1;
    var hf=Math.sin(Math.PI*hp);                    /* 正弦包络：进出皆平滑，无突现突灭 */
    if(hf>.02){
      g.strokeStyle='rgba('+SV_HI+','+(L.al*.80*hf).toFixed(3)+')';
      g.lineWidth=L.w*DPR*1.0;
      g.beginPath();g.moveTo(cx+ca*h0,cy+sa*h0);g.lineTo(cx+ca*h1,cy+sa*h1);g.stroke();
    }
  }
  for(var q=0;q<SVLS.length;q++){
    var S=SVLS[q],x=((S.x+t*S.sp)%1-.05)*W,y=S.y*H,ln=S.len*W;
    g.strokeStyle='rgba('+SV_INK+','+S.al.toFixed(3)+')';g.lineWidth=DPR*.8;
    g.beginPath();g.moveTo(x,y);g.lineTo(x+ln,y);
    g.moveTo(x-W,y);g.lineTo(x-W+ln,y);      /* 环绕副本：卷回不闪断 */
    g.stroke();
  }
  if(SVDISC){g.save();g.translate(cx,cy);g.rotate(t*.035);
    g.drawImage(SVDISC,-SVDISC.width/2,-SVDISC.height/2);g.restore();}
}
function svRender(){
  var host=$('#svField');if(!host)return;
  host.innerHTML='';SVP.cards=[];
  var m=Math.min(innerWidth,innerHeight),cx=innerWidth/2,cy=innerHeight/2;
  var narrow=innerWidth<760;
  host.classList.toggle('sm',narrow);
  var por=innerHeight>innerWidth;                 /* 直立萤幕：把散布场纵向拉长，构图与桌面同构 */
  var base=por?innerWidth:Math.min(innerWidth,innerHeight);
  var sx=por?.95:1.26, sy=por?1.72:.96;
  var P=[];
  /* 环形散布 → 夹入安全边 → 松弛推开（桌面／手机同一套，只换尺度） */
  for(var k0=0;k0<SVN;k0++){
    var ak=(k0+.5)/SVN*Math.PI*2+(svRnd(k0,21)-.5)*.34;
    var rk=(.19+svRnd(k0,22)*.26)*base;
    P.push({x:cx+Math.cos(ak)*rk*sx,y:cy+Math.sin(ak)*rk*sy,z:.62+svRnd(k0,23)*.58});
  }
  var padX=narrow?Math.max(52,innerWidth*.13):Math.max(120,innerWidth*.085);
  var padT=narrow?64:76,padB=narrow?92:112;
  function clampP(q){q.x=Math.max(padX,Math.min(innerWidth-padX,q.x));q.y=Math.max(padT,Math.min(innerHeight-padB,q.y));}
  var MINX=narrow?96:152,MINY=narrow?28:44;
  var HOLE=narrow?innerWidth*.20:Math.min(innerWidth,innerHeight)*.145;
  var HSX=narrow?2.7:1.5;
  for(var pass=0;pass<40;pass++){
    for(var i1=0;i1<SVN;i1++){
      var q1=P[i1],hx=q1.x-cx,hy=q1.y-cy,hd=Math.hypot(hx/HSX,hy);
      if(hd<HOLE&&hd>1){var pushh=(HOLE-hd)*.5;q1.x+=hx/hd*pushh*HSX;q1.y+=hy/hd*pushh;}  /* 让开中央标题区 */
      for(var j1=i1+1;j1<SVN;j1++){
        var q2=P[j1],dx=q2.x-q1.x,dy=q2.y-q1.y;
        var ox=MINX-Math.abs(dx),oy=MINY-Math.abs(dy);
        if(ox>0&&oy>0){
          if(ox/MINX<oy/MINY){var sx=(dx<0?-1:1)*ox*.5;q1.x-=sx;q2.x+=sx;}
          else{var sy=(dy<0?-1:1)*oy*.5;q1.y-=sy;q2.y+=sy;}
        }
      }
      clampP(q1);
    }
  }
  svPlace(host,P);
}
/* 依座标建卡（桌面散布／手机网格共用） */
function svPlace(host,P){
  var narrow=innerWidth<760;
  for(var i=0;i<SVN;i++)(function(n){
    var v=svGet(n+1),sel=SVSEL===n+1;
    var x=P[n].x,y=P[n].y,z=P[n].z;
    var d=document.createElement('div');
    d.className='svFold'+(v?' on':'')+(sel?' sel':'');
    d.setAttribute('data-n',n+1);
    d.style.left=x.toFixed(1)+'px';d.style.top=y.toFixed(1)+'px';
    d.style.opacity=(v?.55:.38)+z*.42;
    var lab=v?String(v.t||'').replace(/\s*·\s*/g,' ').replace(/\s+/g,' ').trim():'VACVVM';
    var cut=narrow?8:10;
    var l1=lab.slice(0,cut),l2=narrow?'':lab.slice(cut,cut*2);   /* 手机单行，卡片更矮更好排 */
    d.innerHTML='<i class="tab"></i>'
      +'<b class="num">'+(v?(n+1<10?'0'+(n+1):''+(n+1)):'—')+'</b>'
      +'<span class="lb">'+esc2(l1)+(l2?'<br>'+esc2(l2):'')+'</span>';
    host.appendChild(d);
    SVP.cards.push({el:d,z:z,x:x,y:y});
  })(i);
  var ck=$('#svClock');if(ck){ck.style.top=(innerHeight-(narrow?62:96))+'px';ck.style.left='50%';}
  var rx=$('#svRedX');if(rx){rx.style.left=(innerWidth-(narrow?40:64))+'px';rx.style.top=(narrow?44:58)+'px';rx.style.right='auto';}
}
function svCoreUpd(){
  var tt=$('#svCoreT'),sb=$('#svCoreSub'),bt=$('#svCoreBtns');
  if(!SVSEL){tt.textContent='ARCHIVVM';sb.innerHTML='ACCESSVS&nbsp;·&nbsp;DIRECTORIVM';bt.innerHTML='';return;}
  var v=svGet(SVSEL);
  tt.textContent='TABVLA·'+SV_ROMAN[SVSEL-1];
  sb.textContent=v?((v.t||'')+' · '+(v.when||'')):'VACVVM · 空槽';
  var h='';
  if(v)h+='<span class="svAct" data-sv="load">LEGERE·读取</span>';
  if(GAME.on)h+='<span class="svAct" data-sv="save">'+(v?'SCRIBERE·覆写':'SCRIBERE·写入')+'</span>';
  if(v)h+='<span class="svAct warn" data-sv="del">DELERE·删除</span>';
  if(!h)h='<span style="font-size:8px;letter-spacing:.24em;color:var(--mut)">空槽 · 入局后方可写入</span>';
  bt.innerHTML=h;
}
function svTick(){
  var dlg=$('#dlgSave');
  if(!dlg||dlg.style.display!=='flex'){SVP.raf=0;return;}
  var now=performance.now();
  if(now-(SVP.lastIn||0)>2400){          /* 静置即自动巡游：手机无需陀螺仪也始终在动 */
    var dt=now/1000;
    SVP.tx=Math.sin(dt*.152)*.60+Math.sin(dt*.071)*.26;
    SVP.ty=Math.cos(dt*.118)*.46+Math.sin(dt*.059)*.20;
  }
  SVP.px+=(SVP.tx-SVP.px)*.075;SVP.py+=(SVP.ty-SVP.py)*.075;
  for(var i=0;i<SVP.cards.length;i++){
    var c=SVP.cards[i];
    c.el.style.transform='translate(-50%,-50%) translate3d('+(SVP.px*c.z*72).toFixed(1)+'px,'+(SVP.py*c.z*46).toFixed(1)+'px,0) scale('+c.z.toFixed(3)+')';
  }
  var bg=$('#svBg');if(bg)bg.style.transform='translate3d('+(SVP.px*-22).toFixed(1)+'px,'+(SVP.py*-15).toFixed(1)+'px,0)';
  var core=$('#svCore');if(core)core.style.transform='translate(-50%,-50%) translate3d('+(SVP.px*15).toFixed(1)+'px,'+(SVP.py*10).toFixed(1)+'px,0)';
  svFx(performance.now()/1000);
  var t=new Date();
  $('#svClock').textContent=[t.getHours(),t.getMinutes(),t.getSeconds()].map(function(x){return (x<10?'0':'')+x;}).join(':');
  SVP.raf=requestAnimationFrame(svTick);
}
function svOpen(){
  svBgDraw();SVSEL=0;svCoreUpd();svRender();
  gDlgShow('#dlgSave');
  SVP.lastIn=performance.now();
  if(!SVP.raf)SVP.raf=requestAnimationFrame(svTick);
}
(function(){
  var dlg=$('#dlgSave');
  dlg.addEventListener('pointermove',function(e){
    if(SVP.drag){
      var dx=(e.clientX-SVP.drag.x)/innerWidth*2.4,dy=(e.clientY-SVP.drag.y)/innerHeight*2.4;
      SVP.tx=Math.max(-1.6,Math.min(1.6,SVP.drag.tx+dx));SVP.ty=Math.max(-1.6,Math.min(1.6,SVP.drag.ty+dy));
      SVP.drag.moved+=Math.abs(dx)+Math.abs(dy);SVP.lastIn=performance.now();return;
    }
    if(e.pointerType==='touch')return;                                   /* 触控只认拖曳，避免点按瞬移 */
    SVP.lastIn=performance.now();
    SVP.tx=(e.clientX/innerWidth-.5)*2;SVP.ty=(e.clientY/innerHeight-.5)*2;  /* 滑鼠视差 */
  });
  dlg.addEventListener('pointerdown',function(e){
    if(e.target.closest&&e.target.closest('.svAct,.svfbtn,#svFootBar,#svRedX'))return;
    SVP.drag={x:e.clientX,y:e.clientY,tx:SVP.tx,ty:SVP.ty,moved:0,t:e.target};SVP.lastIn=performance.now();
    try{dlg.setPointerCapture(e.pointerId);}catch(_){}
  });
  function up(){
    if(!SVP.drag)return;
    var mv=SVP.drag.moved,t0=SVP.drag.t;SVP.drag=null;
    if(mv<.05){
      var f=t0&&t0.closest?t0.closest('.svFold'):null;
      if(f){SVSEL=parseInt(f.getAttribute('data-n'),10);svRender();svCoreUpd();}
    }
  }
  dlg.addEventListener('pointerup',function(e){SVP.lastIn=performance.now();up(e);});
  dlg.addEventListener('pointercancel',function(){SVP.drag=null;});
  $('#svEsc').addEventListener('click',function(){dlg.style.display='none';});
  $('#svRedX').addEventListener('click',function(e){e.stopPropagation();dlg.style.display='none';});
  addEventListener('keydown',function(e){if(e.key==='Escape'&&dlg.style.display==='flex')dlg.style.display='none';},true);
  $('#svCoreBtns').addEventListener('click',function(e){
    var b=e.target.closest?e.target.closest('.svAct'):null;if(!b||!SVSEL)return;
    var act=b.getAttribute('data-sv'),v=svGet(SVSEL);
    if(act==='load'&&v)svLoad(v);
    else if(act==='save'){
      if(!GAME.on)return;
      if(v&&!confirm('TABVLA·'+SV_ROMAN[SVSEL-1]+' 已有存档，覆写？'))return;
      svPut(SVSEL,svSnap());svRender();svCoreUpd();
    }else if(act==='del'&&v){
      if(!confirm('删除 TABVLA·'+SV_ROMAN[SVSEL-1]+'？'))return;
      svPut(SVSEL,null);svRender();svCoreUpd();
    }
  });
  addEventListener('resize',function(){if(dlg.style.display==='flex'){svBgDraw();svRender();}});
})();
$('#svExp').addEventListener('click',function(){
  var all={};for(var i=1;i<=SVN;i++)all['slot'+i]=svGet(i);
  var b=new Blob([JSON.stringify(all,null,1)],{type:'application/json'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='roma_archivvm.json';a.click();
});
$('#svImp').addEventListener('click',function(){$('#svFile').click();});
$('#svFile').addEventListener('change',function(){
  var f=this.files[0];if(!f)return;
  var rd=new FileReader();
  rd.onload=function(){
    try{
      var all=JSON.parse(rd.result);
      /* 原来只判真值：手改过的 JSON、别的工具导出的东西，任何非空值都会被当成存档
         写进槽位并直接覆盖那一格的好档（无确认、无备份）。之后点 LEGERE 走 svLoad，
         v.html/v.loc/v.mfd 全是 undefined —— 正文、地点、情报台当场清空，原档找不回来。
         svPut 的 false 返回也一直被忽略：存储满时导入「看起来成功了」，其实一格没写。 */
      function _svValid(o){
        return o&&typeof o==='object'&&typeof o.html==='string'&&Array.isArray(o.turns);
      }
      var okN=0,badN=0,failN=0,over=[];
      for(var i=1;i<=SVN;i++){
        var one=all['slot'+i];
        if(!one)continue;
        if(!_svValid(one)){badN++;continue;}
        if(svGet(i))over.push(SV_ROMAN[i-1]||('第'+i+'格'));
      }
      if(over.length&&!confirm('这些槽位已有存档，汇入会覆盖：'+over.join('、')+'\n确定继续？')){
        try{var _m0=$('#svCoreSub');if(_m0)_m0.textContent='已取消汇入';}catch(_){}
        return;
      }
      for(var i2=1;i2<=SVN;i2++){
        var v2=all['slot'+i2];
        if(!v2)continue;
        if(!_svValid(v2))continue;
        if(svPut(i2,v2))okN++;else failN++;
      }
      svRender();
      try{if(typeof svCoreUpd==='function')svCoreUpd();}catch(_){}
      try{
        var _m=$('#svCoreSub');
        if(_m)_m.textContent='汇入 '+okN+' 格'
          +(badN?('　·　跳过畸形 '+badN+' 格'):'')
          +(failN?('　·　写入失败 '+failN+' 格（存储已满）'):'');
      }catch(_){}
    }catch(_){
      try{var _m2=$('#svCoreSub');if(_m2)_m2.textContent='汇入失败：不是合法的存档 JSON';}catch(__){}
    }
  };
  rd.readAsText(f);this.value='';
});
addEventListener('resize',function(){if(GAME.on){if(GMMV)GMMV.fit='';setTimeout(gmapRefresh,60);}});
/* PWA：离线可开、可装到桌面。注册失败（file:// 开启、浏览器不支持）一律静默略过。
   顺带申请持久化存储：存档在 localStorage 里，而浏览器清配额是按站点整体清的，
   拿到持久化后本站就不会被自动清理，存档不至于哪天自己没了。 */
/* dev=1 时不注册 SW（本地调试要看最新文件，stale-while-revalidate 永远慢一版） */

/* ═══════════════ 情报台·环 TABVLARIVM RING ═══════════════
   选局环那一整套（细边框＋四角括号＋框外顶栏小字、侧卡的轮廓数字、山脉底、底条）
   原样搬到状态栏上，只把转轴由竖轴改成横轴：读一列数值本来就是自上而下的动作。
   排布数学与选局环同源，见上面 cardLayout 的注释；这里只列不同的三处：
     · rotateY→rotateX。卡心落在 (0, R·sin a, -R·cos a)，屏幕 y 向下为正，
       所以 a 取正的那几张自然排在下面。
     · 不闭环。选局是二十一张首尾相接的环，情报台是「从体魄到长程记忆」的一列，
       有头有尾，转到两端就停住，不绕回去。
     · 步角写死 22°（选局是 360/N）。段数只有五六段，按闭环算一步就是六十度，
       邻卡整个侧过去只剩一条缝，读不成。
   段落节点只搬家、不重建：.gMfd 整块上挂着好几处事件委托，graphHydrate／zj3dTick
   也按 id 取节点，重建一遍全断。 */
var MV={pos:0,tgt:null,drag:null,n:0,cards:[],raf:0,R:600,ang:[],maxH:600,
        box:null,stage:null,track:null,bg:null,bgx:null,rail:null,railx:null,foot:null,
        bgT:0,w:0,h:0,scroll:{}};
function mvOn(){try{return SET&&SET.mvuRing>0;}catch(_){return false;}}
function mvMode(){try{return SET.mvuRing===2?2:1;}catch(_){return 1;}}   /* 1＝卡叠　2＝环 */
function mvCyc(){return MV.mode===2;}                       /* 只有「环」是闭的 */
function mvWrap(x){var n=MV.n||1;if(!mvCyc())return Math.max(0,Math.min(n-1,Math.round(x)));return ((x%n)+n)%n;}
function mvNear(t){                                        /* 取绕得最近的那个目标，别横穿整圈 */
  var n=MV.n||1;
  if(!mvCyc())return Math.max(0,Math.min(n-1,Math.round(t)));
  var d=mvWrap(t)-mvWrap(MV.pos);
  if(d>n/2)d-=n;else if(d<-n/2)d+=n;
  return MV.pos+d;
}
function mvBox(){return document.querySelector('#game .gMfd');}
/* 手机版：情报台的窗是点出来的浮层，不是常驻的一条 */
function mvPhone(){try{return innerWidth<=760;}catch(_){return false;}}
function mvTag(t){
  /* 认的是名字里的关键词。栏目名改成白话之后旧词一个都不命中，
     不补新词的话「当前局势／人物关系／事件年表」三节会全掉回 STATVS。 */
  if(/在场|诸人|人物$/.test(t))return 'PRAESENTES';
  if(/局势|大势|万国|天下/.test(t))return 'MVNDVS';
  if(/关系|图谱/.test(t))return 'NEXVS';
  if(/年表|编年/.test(t))return 'ANNALES';
  if(/记忆/.test(t))return 'MEMORIA';
  if(/线索|INDICIA/.test(t))return 'INDICIA';
  if(/资材|RES/.test(t))return 'RES';
  if(/阶段|ACTA/.test(t))return 'ACTA';
  return 'STATVS';
}
/* 拆环：把每张卡里的段落原样送回 .gMfd 平铺。
   .zjP 是図谱三节共用的样式壳（.zjP .btn / .zjP * 一大票后代选择器挂在它上面），
   装卡时每张补了一层，拆的时候要剥掉，否则来回切几次就套了好几层。 */
function mvFlatten(box){
  var st=box.querySelector('.mvStage');
  if(!st)return;
  var frag=document.createDocumentFragment(),bodies=st.querySelectorAll('.mvBody');
  for(var i=0;i<bodies.length;i++){
    var b=bodies[i],inner=b.firstElementChild;
    if(inner&&inner.classList.contains('zjP')&&b.children.length===1){
      while(inner.firstChild)frag.appendChild(inner.firstChild);
    }else while(b.firstChild)frag.appendChild(b.firstChild);
  }
  box.innerHTML='';box.appendChild(frag);
}
function mvRingMount(){
  if(typeof MV==='undefined'||!MV)return;          /* 模块尚未就位（早于 var MV 的那次调用） */
  var box=mvBox();if(!box)return;
  if(!mvOn()){
    if(box.querySelector('.mvStage')){mvFlatten(box);box.classList.remove('mvRing');}
    box.classList.remove('mvRing');mvStop();return;
  }
  /* 每一幕 renderMvu 都会整块重写 innerHTML，所以这里必须幂等：先拆回平铺再重装。 */
  var keep={};
  if(box.querySelector('.mvStage')){
    var bs=box.querySelectorAll('.mvBody');
    for(var q=0;q<bs.length;q++)keep[q]=bs[q].scrollTop;      /* 逐卡记住读到哪儿 */
    mvFlatten(box);
  }
  mvStop();
  var secs=[],kids=[].slice.call(box.children);
  for(var i=0;i<kids.length;i++){
    var el=kids[i];
    if(el.classList.contains('zjP')){
      var cc=[].slice.call(el.children);
      for(var j=0;j<cc.length;j++)if(cc[j].classList.contains('mSec'))secs.push({el:cc[j],shell:true});
    }else if(el.classList.contains('mSec'))secs.push({el:el,shell:false});
  }
  if(!secs.length){box.classList.remove('mvRing');return;}

  var stage=document.createElement('div');stage.className='mvStage';
  var track=document.createElement('div');track.className='mvTrack';
  /* 卡叠：缩略列与正文窗是两套元件，各自钉死不动（见 .mvPanes 那段注释）。
     环模式仍是一张卡走天下——它本来就靠卡自己绕轴转，不存在「窗出现」这回事。 */
  var deck=(mvMode()!==2),panes=null;
  if(deck){panes=document.createElement('div');panes.className='mvPanes';stage.appendChild(panes);}
  stage.appendChild(track);
  var bg=document.createElement('canvas');bg.className='mvBg';
  var vig=document.createElement('div');vig.className='mvVig';
  var rail=document.createElement('canvas');rail.className='mvRail';
  var foot=document.createElement('div');foot.className='mvFoot';
  foot.innerHTML='<span class="l">TABVLARIVM&nbsp;·&nbsp;情报台</span>'
    +'<span class="r"><b class="mvIdx"></b>'
    +'<span class="go" data-mv="up" title="上一段（也可直接点上面那一条）">▲</span>'
    +'<span class="go" data-mv="dn" title="下一段（也可直接点下面那一条）">▼</span>'
    +'<span class="go" data-mv="list" title="切回一栏到底的列表">列表</span></span>';

  var cards=[];
  for(var k=0;k<secs.length;k++){
    var sec=secs[k];
    var head=sec.el.querySelector('.mHead');
    var ttl=(head?head.textContent:'').replace(/[◆▾▸\s]/g,'')||('SECTIO '+pad(k+1));
    var tag=mvTag(ttl);
    var card=document.createElement('div');card.setAttribute('data-i',k);
    card.className='mvCard'+(deck?' thumb':'');
    var fr=document.createElement('div');fr.className='cfr';
    var win=null,wfr=null,body=null,mw=null;
    if(deck){
      /* 缩略窗：一层框 + 一张微缩 + 左下角那枚编号片 + 窗外下面一行名字。没有正文。 */
      fr.innerHTML='<div class="mw"></div><div class="cshade"></div><div class="ic"></div>'
        +'<div class="mvGhost"><span class="g1"></span><div class="g2"></div><div class="g3"></div></div>';
      mw=fr.querySelector('.mw');
      /* 正文窗：真内容住在这里 */
      win=document.createElement('div');win.className='mvWin';win.setAttribute('data-i',k);
      wfr=document.createElement('div');wfr.className='cfr';
      wfr.innerHTML='<span class="ftag"></span><span class="fnum"></span><div class="mvBody"></div>';
      win.appendChild(wfr);panes.appendChild(win);
      /* 每幕重挂都会新建这些窗：把上次调好的角度带过来，别一说话就弹回默认值 */
      try{
        if(MV.tiltU!=null)tiltSet(win,'--mvTilt','--mvFit',-10,MV.tiltU);
        tiltBind(win,'--mvTilt','--mvFit',-10);
        win.addEventListener('pointerup',function(){MV.tiltU=tiltGet(win,'--mvTilt',-10);});
      }catch(_){}
      wfr.querySelector('.ftag').textContent=tag+' SECTIO // '+pad(k+1);
      wfr.querySelector('.fnum').textContent='SIG_'+pad(k+1)+'/'+pad(secs.length);
      body=wfr.querySelector('.mvBody');
      /* 微缩那张是克隆件。id 必须逐个剥掉——缩略列在文档里排在真面板前面，
         留着 id 会让 getElementById 命中这份影子，真面板的渲染与点击当场失灵。 */
      mw.innerHTML=((sec.shell?'<div class="zjP">':'')+sec.el.outerHTML+(sec.shell?'</div>':''))
                   .replace(/\sid="[^"]*"/g,'');
    }else{
      fr.innerHTML='<span class="ftag"></span><span class="fnum"></span>'
        +'<div class="mvGhost"><span class="g1"></span><div class="g2"></div><div class="g3"></div></div>'
        +'<div class="mvBody"></div><div class="cshade"></div><div class="ic"></div>'
        +'<svg class="cedge" preserveAspectRatio="none"><path class="ce1"></path><path class="ce2"></path></svg>';
      fr.querySelector('.ftag').textContent=tag+' SECTIO // '+pad(k+1);
      fr.querySelector('.fnum').textContent='SIG_'+pad(k+1)+'/'+pad(secs.length);
      body=fr.querySelector('.mvBody');
    }
    fr.querySelector('.g1').textContent=tag;
    fr.querySelector('.g2').textContent=pad(k+1);
    fr.querySelector('.g3').textContent=ttl;
    fr.querySelector('.ic').textContent=pad(k+1);
    if(sec.shell){var sh=document.createElement('div');sh.className='zjP';sh.appendChild(sec.el);body.appendChild(sh);}
    else body.appendChild(sec.el);
    if(keep[k])body.scrollTop=keep[k];
    card.appendChild(fr);track.appendChild(card);
    cards.push({el:card,fr:fr,body:body,win:win,wfr:wfr,mw:mw,
                ghost:fr.querySelector('.mvGhost'),
                shade:fr.querySelector('.cshade'),
                svg:fr.querySelector('.cedge'),
                p1:fr.querySelector('.ce1'),p2:fr.querySelector('.ce2'),
                k:'',mwk:'',wk:''});
  }
  box.innerHTML='';
  box.appendChild(bg);box.appendChild(vig);box.appendChild(stage);
  box.appendChild(rail);box.appendChild(foot);
  box.classList.add('mvRing');
  if(deck)box.classList.add('mvBoot');      /* 排好第一帧之前先藏着，见 .mvBoot 那段注释 */

  MV.box=box;MV.stage=stage;MV.track=track;MV.panes=panes;MV.foot=foot;MV.cards=cards;MV.n=cards.length;
  MV.bg=bg;MV.bgx=bg.getContext('2d');MV.rail=rail;MV.railx=rail.getContext('2d');
  MV.n=cards.length;MV.pos=mvWrap(MV.pos||0);MV.tgt=null;MV.drag=null;MV.bgT=0;
  MV.w=0;MV.h=0;
  mvBind();mvSize();mvLayout();mvStart();
}
function mvBind(){
  var st=MV.stage;
  /* 换段一律靠「点」，不靠「滑」。
     以前上下拖动既要翻段、又要滚正文，两件事抢同一个手势，稍一手抖就翻过头；
     加了死区、一划一段、滚轮节流都只是打补丁。现在把两件事彻底分开：
       · 点上面／下面那一条抬头 → 翻到那一段
       · 上下滑动 → 只滚正前那张卡里的正文（交回浏览器原生滚动）
     底条的 ▲▼ 与右侧刻度照旧能翻。 */
  /* 缩略窗改成「鼠标放上去就切」。它们是一叠平铺的窗，不是按钮，
     指过去看哪一扇就该是哪一扇，中间不该再隔一次点按。
     必须用 pointermove，不能用 pointerover——差别是致命的：
     pointerover 认的是「光标底下换了个元素」，元素自己动过来也算。
     刚被顶下台的那张要飞回自己的格子，路上从静止的光标底下穿过，
     浏览器就补一发 pointerover，于是换回它；换回它，原先那张又要回程，
     又从光标底下穿过……两张卡隔着光标无限对撞，看着就是疯狂乱切。
     pointermove 只在指针自己动时才发，再加一道 3px 位移闸：
     和「上一次处理过的坐标」比，没挪够就不算一次新的悬停。
     触屏没有悬停这回事，pointerType==='touch' 一律放过，交给下面的 click。 */
  var hvX=-1e9,hvY=-1e9;
  st.addEventListener('pointermove',function(e){
    if(e.pointerType==='touch')return;
    if(Math.abs(e.clientX-hvX)<3&&Math.abs(e.clientY-hvY)<3)return;
    hvX=e.clientX;hvY=e.clientY;
    var c=e.target&&e.target.closest?e.target.closest('.mvCard'):null;
    if(!c||c.classList.contains('on'))return;
    if(window.SX)SX('slide');
    MV.tgt=mvNear(parseInt(c.getAttribute('data-i'),10)||0);
  });
  /* click 留着：触屏上没有悬停，全靠这一条。 */
  st.addEventListener('click',function(e){
    var c=e.target&&e.target.closest?e.target.closest('.mvCard'):null;
    if(!c){MV.w=0;return;}
    if(c.classList.contains('on')){
      /* 手机上情报台是一层浮层：点当前这一枚就收回去，再点又弹出来。
         桌面窗常驻在让出来的那一条里，不需要这个开关。 */
      if(mvPhone()){try{gEl.classList.toggle('mvOpen');}catch(_){}}
      /* 全屏里这一枚就是开关：窗收着，点它叫出来；窗开着，点它收回去。
         两种情形这一下都不该再落到窗内的按钮上，所以到此为止。 */
      try{if(gEl&&gEl.classList.contains('txBig')){gEl.classList.toggle('txMvShut');MV.w=0;return;}}catch(_){}
      MV.w=0;return;                                  /* 桌面：点的是正前这张，交给里面的按钮 */
    }
    /* 捕获阶段就截住：collapsed 的那几条抬头里也有 data-act 之类的按钮，
       不拦的话点一下会顺手把図谱那一节收起来。 */
    e.preventDefault();e.stopPropagation();
    MV.tgt=mvNear(parseInt(c.getAttribute('data-i'),10)||0);
    if(mvPhone()){try{gEl.classList.add('mvOpen');}catch(_){}}
    try{if(gEl)gEl.classList.remove('txMvShut');}catch(_){}
  },true);
  MV.foot.addEventListener('click',function(e){
    var g=e.target.closest?e.target.closest('[data-mv]'):null;if(!g)return;
    var a=g.getAttribute('data-mv');
    if(a==='up')MV.tgt=mvCyc()?Math.round(MV.pos)-1:Math.max(0,Math.round(MV.pos)-1);
    else if(a==='dn')MV.tgt=mvCyc()?Math.round(MV.pos)+1:Math.min(MV.n-1,Math.round(MV.pos)+1);
    else if(a==='list'){SET.mvuRing=0;try{setStore();}catch(_){}try{setSeg('#sgMvu',0);}catch(_){}mvRingMount();}
  });
  MV.rail.addEventListener('pointerdown',mvRailPick);
  MV.rail.addEventListener('pointermove',function(e){if(e.buttons&1)mvRailPick(e);});
}
function mvRailPick(e){
  if(!MV.rail||MV.n<2)return;
  var r=MV.rail.getBoundingClientRect(),m=r.height*.08,span=r.height-2*m;
  if(span<=0)return;
  var _pv=MV.tgt;
  MV.tgt=mvNear(Math.round((e.clientY-r.top-m)/span*(MV.n-1)));
  if(MV.tgt!==_pv&&window.SX)SX('slide');
}
/* 每张卡照自己的内容量高，不再一刀切：短的一段不留半框空白，长的一段也不再被
   一个固定高度切掉尾巴。高度不一，就不能再用「一段一个固定步角」，改按弧长排位——
   相邻两张卡心之间在环面上走过 (h1+h2)/2 + 缝，除以半径就是这一段的转角。
   转角表 MV.ang 存的是每张卡的绝对角度（弧度），pos 在表上线性插值。 */
function mvSize(){
  if(!MV.stage||!MV.box)return;
  /* 这两个类必须在量尺寸「之前」加：.gMfd 加了 .mvDeck 才有 min(56vw,680px)，
     不加就还是那条 322 的窄栏。原先它们写在下面，于是第一趟量到的是 322，
     整套窗位按 322 算出来是负的（实测 left:-52px），画一帧再弹回去——
     进局时那一下弹窗闪烁就是这么来的。 */
  MV.mode=mvMode();
  MV.box.classList.toggle('mvDeck',MV.mode!==2);
  try{gEl.classList.toggle('mvFree',MV.mode!==2);}catch(_){}
  var W=MV.stage.clientWidth,H=MV.stage.clientHeight;
  if(!(W>10&&H>10))return;
  /* 卡叠那一条最窄也要 240（MV.gut 的下限）+ 内外缝，台宽不到 260 说明还没铺开，
     这一趟算出来全是负数，宁可不排——下一帧 mvTick 还会再来。 */
  if(mvMode()!==2&&W<260)return;
  MV.w=W;MV.h=H;
  var cw=Math.max(150,W-10);
  /* 「每段按自己的内容量高」和「看得出是个环」是一对矛盾：正前那张越高，
     台上留给邻卡的地方越少，高到满屏就只剩一张平板。折中办法是拉手风琴——
     正前那张放开到 0.70 台高（够读，超出的才滚），转开的那几张收到 0.26 台高，
     于是它们贴得近、斜得狠、还看得见内容，环的形状一眼就出来了。
     高度按离正前的距离连续插值，不是到位才跳：转的过程本身就是伸缩的过程。 */
  /* 缩略窗尺寸与间距照搬左边那一列：64×44、隔 20px。
     原来隔 6px 太挤——名字写在窗外下面一行，缝比字还窄就被下一枚压住了。
     台高站不下时再逐档缩，缩到 24px 高为止。 */
  /* 手机上台就那么窄，64×44 一列压过去正好盖住半幅正文；收到 42×28。
     桌面一个数不动。 */
  var _nar=(W<520);
  /* 手机：窗收到 34×23，缝放到 18——名字放大到 9px，缝小了会被下一枚压住。 */
  MV.tw=_nar?34:64;MV.th=_nar?23:44;MV.tgap=_nar?18:20;
  var _cn=Math.max(1,MV.cards.length);
  while(_cn*(MV.th+MV.tgap)>H-20&&MV.th>24){MV.tw-=4;MV.th=Math.round(MV.tw*.69);MV.tgap=Math.max(12,MV.tgap-1);}
  /* 让出来那一条：外缝 + 窗 + 内缝 + 缩略列 + 内缝。
     外缝是三维／正文与情报台之间那道界，给足 14px——2px 那一版贴得死紧，
     两块内容像糊在一起。内缝 6px：窗与缩略列本来就是一件东西，不必分那么开。
     这一条总宽因此到 368，比原来那一栏（322）宽 46px，全是三维与正文让的。 */
  /* 外缝：桌面 14 就够（左边是三维与正文的收边线）；
     手机上窗是浮层，左边贴着的是地图／商店／装备那一列缩略窗，
     留 66 才不会压在它们身上。 */
  MV.mo=_nar?66:14;MV.mi=6;
  MV.gut=Math.max(240,Math.min(384,W-24));
  try{gEl.style.setProperty('--mvGut',MV.gut+'px');}catch(_){}
  /* 整扇窗在台上，缩略列不再从它头上占位：上限只受台高约束。 */
  var maxH=(mvMode()===2)?Math.max(150,Math.round(H*.68)):Math.max(180,H-12);
  var minH=104,PADY=43;   /* PADY＝正文上下内距＋两条 1px 内衬 */
  /* 侧卡收到一条边的高度：屏幕上下总共就这么点地方，侧卡越矮，同屏能站的段数越多，
     弧面上每寸屏幕转过的角度也越大——「在轮子里看轮圈」靠的就是这个。 */
  MV.small=Math.max(74,Math.round(H*.115));
  MV.gap=-6;                                   /* 负值：让邻卡的顶沿贴上来，中间那道缝才收得住 */
  var C=MV.cards,i;
  MV.cw=cw;
  /* 卡叠里缩略窗的宽是钉死的 TW，这一句只对环模式有意义；
     照写会让六枚缩略窗先闪一下 670px 再被 mvDeck 收回去。 */
  if(mvMode()===2)for(i=0;i<C.length;i++)C[i].el.style.width=cw+'px';
  /* 量的是内容自身的高度，不能量 .mvBody.scrollHeight——正文是 inset:1px 撑满整卡的，
     scrollHeight 永远不小于 clientHeight，一量就是当前卡高，每张卡都会顶到上限。
     写、读、写分三趟，别在一个循环里交替，否则每张卡逼一次重排。 */
  MV.minH=minH;MV.maxH=maxH;MV.padY=PADY;
  MV.full=mvMeasure();
  var mean=0;for(i=0;i<MV.full.length;i++)mean+=MV.full[i];
  mean=MV.full.length?mean/MV.full.length:200;
  /* 半径按「正前那张与旁边那张之间的弧长」反推，让这一对斜过四十度上下。
     半径越小弧越急：小到这一步，六段的总弧长约合 145°，绕过去正好在视野边缘接上，
     环因此是闭合的——转到末段，第一段就从另一头转进来。 */
  MV.R=Math.max(160,Math.round(1.46*Math.max(90,(mean+MV.small)/2+MV.gap)));
  /* 眼睛必须待在轮胎里面。轨道整体前移 R（保正前那张 1:1），眼睛到轮轴的距离就是
     e = P − R；要在里面就得 e < R，也就是 P < 2R。之前 P=1300、R≈380，e≈920 是半径的
     两倍半——那是站在鼓外面看鼓，所以转开的面越来越小、卡的两端越收越窄，整个反了。
     取 P = 1.30R，眼睛落在轴心到内壁的三成处：转开的面反而越来越大，卡的上下两端
     离眼更近因而更宽——腰细端宽，这才是从胎内看胎壁。 */
  if(MV.mode===2){
    MV.P=Math.max(120,Math.round(MV.R*1.30));
  }else{
    /* 卡叠：纵深不靠 translateZ（不用），只有缩略窗那点倾角吃透视。
       1500 太远，17° 转过去几乎看不出是斜的；对齐左边那一列的 620，
       两侧的斜度这才是同一个量。台上那扇窗 rotateY 为 0，不受影响。 */
    MV.P=620;MV.peek=Math.max(24,Math.round(H*.042));MV.dz=Math.round(H*.16);
    MV.stepPix=Math.max(120,Math.round(H*.34));   /* 拖一段要走的距离 */
  }
  MV.stage.style.perspective=MV.P+'px';
  /* 透视原点：左边那一列钉在最左缘（0% 50%），右边这一叠就钉最右缘——
     两侧互为镜像，斜的方向自然相反。环模式不动，仍用 CSS 里的 50% 48%。 */
  MV.stage.style.perspectiveOrigin=(MV.mode===2?'':'100% 50%');
  MV.track.style.transform=(MV.mode===2?'translateZ('+MV.R.toFixed(1)+'px)':'none');
  /* 换排法／改尺寸＝所有缓存作废。这里必须连 w/h/bk 一起清：
     上面刚把每张卡的宽度按 cw 写过一遍，而 mvDeck 是「值没变就不写」的，
     不清缓存它就以为自己写过了，卡会一直挂着 cw 那个宽度不动。 */
  for(i=0;i<C.length;i++){C[i].k='';C[i].w=-1;C[i].h=-1;C[i].bk='';C[i].mwk='';C[i].wk='';}
  /* 卡叠不再按内容量高：窗是固定一扇，长了自己滚。 */
  if(MV.mode===2)mvHeights();
  var d=Math.min(devicePixelRatio||1,2);
  MV.bg.width=Math.max(1,Math.round(MV.box.clientWidth*d));
  MV.bg.height=Math.max(1,Math.round(MV.box.clientHeight*d));
  MV.rail.width=Math.max(1,Math.round((MV.rail.clientWidth||16)*d));
  MV.rail.height=Math.max(1,Math.round((MV.rail.clientHeight||H)*d));
  MV.bgT=0;
}
/* 量每一段内容自身的高度。量的是正文里那个内容节点，不是 .mvBody.scrollHeight——
   正文是撑满整卡的，scrollHeight 永远不小于 clientHeight，一量就是当前卡高。 */
function mvMeasure(){
  var C=MV.cards,out=[],i;
  for(i=0;i<C.length;i++){
    var kid=C[i].body.firstElementChild;
    out.push(Math.max(MV.minH||104,Math.min(MV.maxH||600,(kid?kid.offsetHeight:0)+(MV.padY||43))));
  }
  return out;
}
/* 図谱／编年／记忆这三节的正文是挂载之后才由 graphHydrate、zj3dTick 填进去的，
   挂载那一刻量到的高度偏小；长程记忆与编年史还会一幕一幕地长。高度停在旧值，
   卡就只展开那么高，后面的内容全被裁掉——看上去就是「这三节是空的」。
   所以隔一阵重量一次，有变化就跟上。 */
function mvRemeasure(){
  if(!MV.cards||!MV.cards.length||!MV.full||MV.full.length!==MV.cards.length)return;
  var m=mvMeasure(),ch=false;
  for(var i=0;i<m.length;i++)if(Math.abs(m[i]-MV.full[i])>=4){MV.full[i]=m[i];ch=true;}
  return ch;
}
/* 卡高与转角表都随 pos 变（手风琴），每帧重算一次。写样式前先比一比，
   差不到一像素就不写——否则每帧六次无谓的重排。 */
function mvHeights(){
  var C=MV.cards,n=C.length;if(!n||!MV.full||MV.full.length!==n)return;
  var hs=[],i;
  for(i=0;i<n;i++){
    var d=Math.abs(MV.pos-i);d=Math.min(d,n-d);         /* 环是闭的，距离也要绕着算 */
    var w=clamp01(1-d);
    var h=Math.round(MV.small+(MV.full[i]-MV.small)*w);
    hs.push(h);
    if(Math.abs((C[i].h||0)-h)>=1){C[i].el.style.height=h+'px';C[i].h=h;}
  }
  MV.ang=[0];
  for(i=1;i<n;i++)MV.ang.push(MV.ang[i-1]+((hs[i-1]+hs[i])/2+MV.gap)/MV.R);
  /* 闭合：最后一段绕回第一段的那一节弧也要算进去，总角 TOT 就是这只轮子的一整圈。 */
  MV.tot=MV.ang[n-1]+((hs[n-1]+hs[0])/2+MV.gap)/MV.R;
}
/* 卡叠：每张卡都按自己的内容量高（不再拉手风琴——压在后面的只露一条抬头，
   伸缩没人看得见，反倒让翻页时高度一直在动）。 */
function mvHeightsDeck(){
  var C=MV.cards,n=C.length;if(!n||!MV.full||MV.full.length!==n)return;
  for(var i=0;i<n;i++){
    var h=MV.full[i];
    if(Math.abs((C[i].h||0)-h)>=1){C[i].el.style.height=h+'px';C[i].h=h;}
  }
}
function mvSeg(i){                                 /* 第 i 段到下一段的弧角（闭环，末段接回首段） */
  var A=MV.ang,n=MV.n;
  return (i<n-1?A[i+1]-A[i]:MV.tot-A[n-1])||1e-6;
}
function mvRot(){                                 /* 当前 pos 落在转角表上的角度 */
  var A=MV.ang,n=MV.n;if(n<1)return 0;if(n<2)return A[0];
  var p=((MV.pos%n)+n)%n,i=Math.floor(p);
  return A[i]+(p-i)*mvSeg(i);
}
function mvPosFromRot(r){                          /* 反解：拖动按角度走，要换回段号 */
  var A=MV.ang,n=MV.n,T=MV.tot;if(n<2||!T)return 0;
  var q=((r%T)+T)%T;
  for(var i=n-1;i>=0;i--)if(q>=A[i])return i+(q-A[i])/mvSeg(i);
  return 0;
}
/* 把一张卡当作轮圈上的一段弧来描。
     th   这张卡占的弧角（卡高 ÷ 半径）
     sag  上下两端比中线退后多少   = R(1-cos(th/2))
     f    退后之后端部收窄到中线的几成 = P / (P+sag)
   端部的收窄是真透视：同一块面，退后的地方在屏幕上就是窄。
   矮的侧卡占弧小、sag 近乎零，本来就该几乎是平的——这是对的，不是没生效。 */
function mvShell(C,w,h,R,P,a,curve){
  if(!curve){                                   /* 卡叠：面是平的，一只规规矩矩的方框 */
    var k0=(w|0)+'x'+(h|0)+'-flat';
    if(C.k===k0)return;
    C.k=k0;
    var x0=.5,x1=w-.5,t0=.5,t1=h-.5,bb=7;
    C.p1.setAttribute('d','M'+x0+' '+t0+'H'+x1.toFixed(1)+'V'+t1.toFixed(1)+'H'+x0+'Z');
    C.p1.setAttribute('stroke','rgba(19,18,13,.5)');C.p1.setAttribute('stroke-width','1');
    C.p2.setAttribute('d','M'+x0+' '+(t0+bb)+'V'+t0+'H'+(x0+bb)
      +'M'+(x1-bb).toFixed(1)+' '+t0+'H'+x1.toFixed(1)+'V'+(t0+bb)
      +'M'+x1.toFixed(1)+' '+(t1-bb).toFixed(1)+'V'+t1.toFixed(1)+'H'+(x1-bb).toFixed(1)
      +'M'+(x0+bb)+' '+t1.toFixed(1)+'H'+x0+'V'+(t1-bb).toFixed(1));
    C.p2.setAttribute('stroke','var(--paper)');C.p2.setAttribute('stroke-width','1');
    C.svg.setAttribute('viewBox','0 0 '+w.toFixed(1)+' '+h.toFixed(1));
    C.fr.style.clipPath='none';
    if(C.pad!==5){C.pad=5;C.body.style.left='5px';C.body.style.right='5px';}
    return;
  }
  var th=h/R, e=P-R;
  /* 站在胎内：卡的上下两端沿着内壁绕过来，离眼比中线更近，投影因此更宽。
     f = 端宽 / 腰宽 = (e+R) / (e + R·cos(θ/2)) > 1 —— 腰细端宽。
     实算只有百分之几，肉眼到不了分辨门槛，所以夸张 1.6 倍并封顶。 */
  var f=(e+R)/(e+R*Math.cos(th/2));
  f=Math.max(1.014,Math.min(1.26,1+(f-1)*1.6));
  /* 腰收进去多少是按半宽算的，面板越宽收得越狠：手机上一张 372px 的卡能收掉 31px，
     正文贴着边就被弧切掉半个字。绝对量封在 26px 以内。 */
  f=Math.min(f,1+26/Math.max(40,w/2-1));
  var key=(w|0)+'x'+(h|0)+'x'+f.toFixed(4);
  if(C.k===key)return;
  C.k=key;
  var cx=w/2, hw1=w/2-1, hw0=hw1/f, y0=.5, y1=h-.5, ym=h/2;   /* hw1＝端宽，hw0＝腰宽 */
  /* 正文左右各让开「腰比端窄的那一截」，字才不会被弧啃掉 */
  var pad=Math.round(hw1-hw0)+3;
  if(C.pad!==pad){C.pad=pad;C.body.style.left=pad+'px';C.body.style.right=pad+'px';}
  var qx=2*hw0-hw1;                                  /* 二次贝塞尔控制点：让中点正好落在 hw0 */
  var d='M'+(cx-hw1).toFixed(1)+' '+y0.toFixed(1)
       +'H'+(cx+hw1).toFixed(1)
       +'Q'+(cx+qx).toFixed(1)+' '+ym.toFixed(1)+' '+(cx+hw1).toFixed(1)+' '+y1.toFixed(1)
       +'H'+(cx-hw1).toFixed(1)
       +'Q'+(cx-qx).toFixed(1)+' '+ym.toFixed(1)+' '+(cx-hw1).toFixed(1)+' '+y0.toFixed(1)+'Z';
  C.p1.setAttribute('d',d);
  C.p1.setAttribute('stroke','rgba(19,18,13,.5)');
  C.p1.setAttribute('stroke-width','1');
  /* 四角括号：跟着弧走，钉在轮廓的四个角上 */
  var b=7;
  C.p2.setAttribute('d',
     'M'+(cx-hw1).toFixed(1)+' '+(y0+b)+'V'+y0.toFixed(1)+'H'+(cx-hw1+b).toFixed(1)
    +'M'+(cx+hw1-b).toFixed(1)+' '+y0.toFixed(1)+'H'+(cx+hw1).toFixed(1)+'V'+(y0+b)
    +'M'+(cx+hw1).toFixed(1)+' '+(y1-b)+'V'+y1.toFixed(1)+'H'+(cx+hw1-b).toFixed(1)
    +'M'+(cx-hw1+b).toFixed(1)+' '+y1.toFixed(1)+'H'+(cx-hw1).toFixed(1)+'V'+(y1-b));
  C.p2.setAttribute('stroke','var(--paper)');
  C.p2.setAttribute('stroke-width','1');
  C.svg.setAttribute('viewBox','0 0 '+w.toFixed(1)+' '+h.toFixed(1));
  /* 同一条弧扣成 clip-path，正文被弧裁住——弯的是整块面，不只是一圈线 */
  var pts=[],k,pp,hw,N=9;
  for(k=0;k<=N;k++){pp=-1+2*k/N;hw=hw0+(hw1-hw0)*pp*pp;
    pts.push((cx+hw).toFixed(1)+'px '+(ym+pp*(h/2-.5)).toFixed(1)+'px');}
  for(k=N;k>=0;k--){pp=-1+2*k/N;hw=hw0+(hw1-hw0)*pp*pp;
    pts.push((cx-hw).toFixed(1)+'px '+(ym+pp*(h/2-.5)).toFixed(1)+'px');}
  C.fr.style.clipPath='polygon('+pts.join(',')+')';
}
/* 卡叠：正前那张平摊在最前，其余的按远近一层层往后退，各自只露出抬头的一条。
   没有任何旋转——面是平的，纵深全由「退后＋缩小＋压暗」给。翻页就是这一叠往上或
   往下走一格，和切换视窗一个道理。 */
function mvDeck(){
  var n=MV.n,C0=MV.cards;
  if(!n||!C0[0]||!C0[0].win)return;                /* 还没按卡叠挂载（刚从环模式切过来）*/
  /* 缩略列与正文窗都不动。这一趟只做三件事：
       · 把每一枚缩略窗摆到自己那个固定的格子里（只在尺寸真变了时才写样式）；
       · 正在看的那一枚转正、往前挪一点；
       · 对应那扇窗挂上 .on，由 CSS 淡入——其余的淡出。
     没有任何东西从一个位置搬到另一个位置，也就没有「搬运途中扫过光标」这回事。 */
  var SW=MV.w||320,SH=MV.h||600,MO=MV.mo||14,MI=MV.mi||6;
  var TW=MV.tw||52,TH=MV.th||36,STEP=TH+(MV.tgap==null?7:MV.tgap);
  var GUT=MV.gut||368;
  /* 窗正好嵌进「让出来那一条」：右边隔一道内缝挨着缩略列，
     左边隔一道外缝挨着三维／正文的收边线，上下把这一条填满。 */
  var winW=Math.max(180,GUT-MO-TW-MI*2);
  var winH=Math.max(160,SH-MO);
  var thumbX=SW/2-TW/2-MI;                         /* 缩略列：最右缘，留一道内缝 */
  var winX=SW/2-MI*2-TW-winW/2;                    /* 窗位：隔一道内缝挨着缩略列 */
  /* 窗斜了 17°，屏幕上就不再是 winW×winH 那一块了：
       · 近的那条边（右沿）被放大 a 倍，远的那条边（左沿）被缩小 b 倍——照旧给足高度，
         右沿会顶穿台顶台底；
       · 整块还因为灭点钉在最右缘而被压窄，左边平白空出三十来像素。
     所以反解一次：已知「投影后该占哪一块」（就是没斜时那一块），倒推 CSS 该给多宽、
     窗心该摆在哪。投影式 X(u)=ox+(xc+u·cosθ−ox)·P/(P−u·sinθ)，u 是离窗心的横向偏移；
     两端两个方程、两个未知数，a 与 b 又随宽度变，迭代四轮足够收敛。 */
  var TILT=10;                                   /* 正文窗的倾角，唯一出处 */
  var PP=620,SN=Math.sin(TILT*Math.PI/180),CS=Math.cos(TILT*Math.PI/180);
  if(MV.panes&&MV.tiltK!==TILT){MV.tiltK=TILT;MV.panes.style.setProperty('--mvTilt',(-TILT)+'deg');}
  var ox=SW;                                     /* perspective-origin:100% → 台子最右缘 */
  var xl=SW/2+winX-winW/2,xr=SW/2+winX+winW/2;   /* 投影后要占的左右两端 */
  var Wc=winW,xc=SW/2+winX,ka=1;
  for(var it=0;it<4;it++){
    ka=PP/(PP-SN*Wc/2);
    var kb=PP/(PP+SN*Wc/2);
    Wc=((xr-ox)/ka-(xl-ox)/kb)/CS;
    xc=ox+(xr-ox)/ka-CS*Wc/2;
  }
  winW=Math.round(Wc);
  /* 高度不再一刀切成满台。原来每扇窗都撑到顶，短的那几段下面吊着一大片空框，
     看着就是「这一段没内容」。改成各按自己那一段的实际内容量高：
     MV.full 是 mvMeasure 量出来的每段内容高（已含正文上下内距），
     mvTick 每 600ms 重量一次，図谱／编年那种后填进来的内容也跟得上。
     上限仍是斜完之后台子装得下的那个高度。 */
  var winCap=Math.round(winH/ka);                /* 除掉近边那点放大，斜完正好卡在台里 */
  var full=MV.full||[];
  var wl=Math.round(xc-Wc/2);
  var y0=-(n-1)*STEP/2;
  var sc=TW/Math.max(1,winW),mwH=Math.round((TH-2)/Math.max(.001,sc));
  var cur=mvWrap(Math.round(MV.pos));
  for(var i=0;i<n;i++){
    var C=C0[i],on=(i===cur),y=y0+i*STEP;
    if(C.w!==TW){C.w=TW;C.el.style.width=TW+'px';}
    if(C.h!==TH){C.h=TH;C.el.style.height=TH+'px';}
    /* 翘出来的那一枚说的是「正在看这一扇」。桌面上窗常驻，这话永远成立；
       手机上点第二下把窗收了，它就不该还翘在外面——没窗就没有正在看的那一扇。
       段号还是在它身上（on 不动），只是不再摆出来。 */
    /* 视觉小说进了全屏，情报台的窗先收回缩略列里（gEl.txMvShut）：
       全屏那一档是给画面看的，六扇窗一进来就摊在立绘上。
       点一下缩略小窗这道闸就撤掉，窗照旧出来；退出全屏也自动撤掉。 */
    var pop=on&&(!mvPhone()||(gEl&&gEl.classList.contains('mvOpen')))
              &&!(gEl&&gEl.classList.contains('txMvShut'));
    /* 开着的那一枚转正并往镜头挪；其余保持 -17°（左边那一列是 +17°，两侧互为镜像）。 */
    var key=(on?'1':'0')+(pop?'1':'0')+'|'+thumbX.toFixed(1)+'|'+y.toFixed(1);
    if(C.k!==key){
      C.k=key;
      C.el.style.transform='translate(-50%,-50%) translate('+thumbX.toFixed(1)+'px,'+y.toFixed(1)+'px)'
        +(pop?' translateX(-7px) translateZ(22px) rotateY(0deg)':' rotateY(-17deg)');
      C.el.classList.toggle('on',on);
      C.fr.style.filter=pop?'none':'contrast(.77) brightness(1.116)';
      if(C.win)C.win.classList.toggle('on',on);
    }
    /* 微缩按整窗宽度排版，再整体缩到缩略窗那么大——这样它和真窗是同一份版式。 */
    if(C.mw&&C.mwk!==TW+'x'+TH){
      C.mwk=TW+'x'+TH;
      C.mw.style.width=winW+'px';
      C.mw.style.height=mwH+'px';
      C.mw.style.transform='scale('+sc.toFixed(4)+')';
    }
    /* 窗的位置与尺寸只在真变了时才写。高度逐段不同，纵向一律居中。 */
    var Hc=Math.max(160,Math.min(winCap,Math.round(full[i]||winCap)));
    var wt=Math.round(SH/2-Hc/2);
    if(C.win&&C.wk!==wl+','+wt+','+winW+','+Hc){
      C.wk=wl+','+wt+','+winW+','+Hc;
      C.win.style.left=wl+'px';C.win.style.top=wt+'px';
      C.win.style.width=winW+'px';C.win.style.height=Hc+'px';
    }
  }
  /* 尺寸连着两帧没变，才算真定住，这时候露面才不会闪。
     420ms 的宽度过渡期间一直藏着；重排（每幕重挂）时尺寸本来就没变，
     两帧＝三十几毫秒，看不出来。 */
  if((MV.stableN||0)>=2&&MV.box&&MV.box.classList.contains('mvBoot'))MV.box.classList.remove('mvBoot');
}
function mvLayout(){
  if(MV.mode!==2)return mvDeck();
  mvHeights();
  var R=MV.R,rot=mvRot(),DEG=180/Math.PI,T=MV.tot||6.283;
  var half=T*DEG/2;                       /* 环的半圈：绕过这里就该从另一头接上了 */
  var fade=Math.max(12,half*.55);
  for(var i=0;i<MV.n;i++){
    var C=MV.cards[i],a=(MV.ang[i]-rot)*DEG;
    /* 闭环：同一张卡在环上有无数个等价位置（每隔一整圈一个），取离正前最近的那一个。
       所以转到末段时，第一段是从另一头转进来的，不会走到头就空掉。 */
    a=((a%(half*2))+half*3)%(half*2)-half;
    var aa=Math.abs(a),c=Math.cos(a*Math.PI/180);
    var hid=(aa>=half-.5||aa>78);   /* 78° 往后离眼太近，投影要炸 */
    C.el.style.transform=hid?'translate(-50%,-50%) scale(0)'
      :('translate(-50%,-50%) rotateX('+a.toFixed(2)+'deg) translateZ('+(-R).toFixed(1)+'px)');
    C.el.style.opacity=(hid?0:clamp01((half-aa)/fade)).toFixed(3);
    C.el.style.visibility=hid?'hidden':'visible';
    C.el.style.pointerEvents=hid?'none':'auto';
    /* 转开的那几段离眼更近，投影会放大；宽度不补一下就要横着挤出面板，
       段名当场被切掉半截。按放大率的 0.8 次方回缩：仍然比正前那张宽一点
       （「贴着脸擦过去」的感觉留着），但不会溢出。 */
    if(!hid){
      var P0=MV.P||(R*1.3);
      var mag=P0/Math.max(1,P0-R*(1-c));
      var wq=Math.max(60,Math.round((MV.cw||C.el.clientWidth)/Math.pow(mag,.8)/2)*2);
      if(C.w!==wq){C.w=wq;C.el.style.width=wq+'px';}
      mvShell(C,wq,C.h||1,R,P0,a,true);
    }
    /* 明暗按曲面算，不是给平板糊一层渐变：光从轮心来，面上某一点的明暗取决于
       那一点的法线偏离视线多少，也就是 cos(卡的角度 + 该点在卡内的弧偏移)。
       于是最亮的那道横带并不钉在卡中间——卡一转，它就顺着弧面往近的一端滑。 */
    var th=(C.h||1)/R, lum=[], q;
    for(q=0;q<=4;q++){
      var dl=(q/4-.5)*th*180/Math.PI;
      lum.push('rgba(242,236,222,'+(0.94*(1-Math.pow(clamp01(Math.cos((a+dl)*Math.PI/180)),.9))).toFixed(3)+') '+(q*25)+'%');
    }
    C.fr.style.filter='brightness('+(.46+.54*Math.pow(clamp01(c),.7)).toFixed(3)+')';
    C.shade.style.background='linear-gradient(to bottom,'+lum.join(',')+')';
    C.shade.style.opacity='1';
    /* 侧卡留住正文：斜过去的那几行字是立体感真正的来源，只剩一只空框就又平回去了。 */
    C.ghost.style.opacity=clamp01(aa/22-.5).toFixed(3);
    C.body.style.opacity=clamp01(1-aa/(half*1.25)).toFixed(3);
    C.el.classList.toggle('on',aa<6);
  }
}
function mvRailDraw(){
  var c=MV.rail,g=MV.railx;if(!g)return;
  /* 这一条导轨只跟「共几段、停在第几段、拨到哪儿」有关。三样都没变就别重画——
     重画一次，整页的滤镜与毛玻璃就得重来一遍。 */
  var _sig=[MV.n,mvWrap(Math.round(MV.pos)),MV.pos.toFixed(3),
            c.clientWidth,c.clientHeight,Math.min(devicePixelRatio||1,2)].join('|');
  if(c._sig===_sig)return;
  c._sig=_sig;
  var d=Math.min(devicePixelRatio||1,2);
  var pw=Math.max(1,Math.round((c.clientWidth||16)*d)),ph=Math.max(1,Math.round(c.clientHeight*d));
  if(c.width!==pw||c.height!==ph){c.width=pw;c.height=ph;}
  var W=c.width,H=c.height;if(!(W>1&&H>1))return;
  g.clearRect(0,0,W,H);
  var m=H*.08,span=H-2*m,x=W*.5;
  g.lineWidth=1;
  g.strokeStyle='rgba(37,36,29,.42)';
  g.beginPath();g.moveTo(x,m);g.lineTo(x,H-m);g.stroke();
  var sel=mvWrap(Math.round(MV.pos));
  for(var i=0;i<MV.n;i++){
    var y=m+span*(MV.n>1?i/(MV.n-1):.5),cur=(i===sel);
    g.strokeStyle=cur?'rgba(82,48,0,.95)':'rgba(37,36,29,.40)';
    g.beginPath();g.moveTo(x-(cur?5:3)*d,y);g.lineTo(x+(cur?5:3)*d,y);g.stroke();
  }
  var f=MV.n>1?Math.max(0,Math.min(1,mvWrap(MV.pos)/(MV.n-1))):.5;
  var fy=m+span*f;
  g.beginPath();g.arc(x,fy,4.2*d,0,Math.PI*2);
  g.fillStyle='rgba(237,231,217,.9)';g.fill();
  g.strokeStyle='rgba(19,18,13,.9)';g.stroke();
}
function mvBgDraw(now){
  if(!MV.bgx)return;
  var W=MV.bg.width,H=MV.bg.height;if(!(W>1&&H>1))return;
  /* 山只跟「拨到哪一段」有关。原来还把 now 一起喂进去，于是时间一走它就变，
     二十赫兹重画一张铺满面板的画布，整页的滤镜与毛玻璃跟着重来二十次。
     那点随时间的漂移本来也看不出来，去掉；位置变了照旧重画。 */
  var _sig=[W,H,MV.mode,(MV.mode===2?mvRot():MV.pos).toFixed(2)].join('|');
  if(MV.bg._sig===_sig)return;
  MV.bg._sig=_sig;
  now=0;
  try{terrainPaint(MV.bgx,W,H,now,(MV.mode===2?mvRot()*420:MV.pos*230),0,.55);}catch(_){}
}
function mvTick(){
  MV.raf=0;
  var box=MV.box;
  if(!box||!MV.stage||!box.parentNode){return;}
  /* 闲着的时候降到每半秒一轮。底下那一套每帧都要读 getComputedStyle
     （逼一次样式重算）和 clientWidth（逼一次布局），没人动它的时候
     每帧算出来的结果都一样，纯属白烧。真在动——拖着、正在翻段、
     尺寸还没定住——立刻回到满帧，一帧都不欠。 */
  var _mv=MV.drag||MV.tgt!=null||(MV.stableN||0)<3
        ||Math.abs(MV.pos-Math.round(MV.pos))>.001;
  if(!_mv){
    var _n=performance.now();
    if(_n-(MV._slow||0)<500){MV.raf=requestAnimationFrame(mvTick);return;}
    MV._slow=_n;
  }else MV._slow=0;          /* 面板被整块换掉了：这一轮到此为止 */
  if(box.clientHeight>10&&box.clientWidth>10){           /* 手机上切到别页时整块 display:none，不空转 */
    /* 手机上底部还有一条小岛切页胶囊，底条要让开那一条；桌面端没有，贴到底。 */
    var nav=gEl.querySelector('.gNav');
    var navH=(nav&&getComputedStyle(nav).display!=='none')?'34px':'0px';
    if(MV._nav!==navH){MV._nav=navH;box.style.setProperty('--mvNav',navH);MV.w=0;}
    /* .gMfd 身上有一条 transition:width 420ms：加上 .mvDeck 之后宽度是「动画」从
       322 走到 680 的，当场读 clientWidth 读到的还是 322，按它排出来的窗位是负的。
       所以尺寸每变一次就重排一次，并且要连着两帧不变才认为定住了（见 mvDeck 末尾）。 */
    if(MV.stage.clientWidth!==MV.w||MV.stage.clientHeight!==MV.h){MV.stableN=0;mvSize();}
    else MV.stableN=(MV.stableN||0)+1;
    var now=performance.now();
    /* 缓动按真实时长算，不按帧数。三维城景一开，低配机上这个循环一秒只跑得动
       两三帧——写死每帧 .16 的话，翻一段要等好几秒，人会以为按钮没反应。 */
    var dt=Math.min(80,Math.max(1,now-(MV._t||now)));MV._t=now;
    var f=dt/16.7;
    if(!MV.drag){
      if(MV.mode!==2){
        /* 卡叠：段号一步到位，动画由 CSS 过渡走——与地图／装备／商店同一条曲线。 */
        if(MV.tgt!=null){MV.pos=mvWrap(MV.tgt);MV.tgt=null;}
        else MV.pos=mvWrap(Math.round(MV.pos));
      }else{
        var t=(MV.tgt==null)?Math.round(MV.pos):MV.tgt;
        MV.pos=lerp(MV.pos,t,1-Math.pow(.82,f));
        if(Math.abs(MV.pos-t)<.002){MV.pos=mvWrap(t);MV.tgt=null;}   /* 停稳时把圈数归零 */
      }
    }
    if(now-(MV._mT||0)>600){MV._mT=now;try{mvRemeasure();}catch(_){}}
    var sel=Math.round(MV.pos);
    if(MV._sel!==sel){
      MV._sel=sel;
      /* 図谱与三维小图要按容器实际尺寸画；刚才它还是一条 34px 的抬头，
         这会儿才摊开，得让它们照新尺寸重画一遍。 */
      try{graphHydrate();}catch(_){}
      try{zj3dTick();}catch(_){}
      try{mvRemeasure();}catch(_){}
    }
    mvLayout();mvRailDraw();
    if(REDUCED){if(!MV.bgT){MV.bgT=now;mvBgDraw(now);}}
    else if(now-MV.bgT>48){MV.bgT=now;mvBgDraw(now);}    /* 山脉 20Hz 足够，别跟着满帧跑 */
    var ix=MV.foot.querySelector('.mvIdx');
    if(ix){var lab=pad(mvWrap(Math.round(MV.pos))+1)+'/'+pad(MV.n);if(ix.textContent!==lab)ix.textContent=lab;}
  }
  MV.raf=requestAnimationFrame(mvTick);
}
function mvStart(){if(!MV.raf)MV.raf=requestAnimationFrame(mvTick);}
function mvStop(){if(MV.raf)cancelAnimationFrame(MV.raf);MV.raf=0;}
addEventListener('resize',function(){if(MV.stage){MV.w=0;MV.h=0;}});
try{if(mvOn())mvRingMount();}catch(_){}      /* 模块就位后补挂一次：进对局前那份占位面板也要立起来 */


/* ═══ 台前调度小窗里的真缩略图 ═══
   不画示意图：把对应抽屉的内容原样搬进一个 520px 宽的容器（抽屉的真实宽度），
   整体 scale 到 88px，看到的就是那扇窗自己。
   搬之前必须把 id 全剥掉——克隆里带着 #shopWrap、#armWrap 这些 id 的话，
   document.getElementById 会先摸到缩略图里的那一份（它在文档里更靠前），
   真面板的渲染与点击当场全失灵。
   地图是画布，innerHTML 搬过去只是一张空画布，改用 drawImage 拷贝像素。 */
/* ══ 面板倾角随手调 ══
   在展开的面板上横向拖一下，倾角在「设计值 ↔ 0°（扶正）」之间连续走。
   三条约束：
     · 只认横向。竖向是列表滚动，抢了就没法读长表。
     · 上限就是设计值，不放开更大——再斜下去字会糊到读不动（实测 17° 时锐度掉四成）。
     · 起手落在 canvas 上就不接管：地图那块画布自己要拖着转地球。
   scaleY 那份补偿跟着角度走：它当初是按最大角算的，扶正到 0° 还压着就成了压扁。 */
function tiltGet(el,vn,def){
  var m=/(-?[\d.]+)deg/.exec(el.style.getPropertyValue(vn)||'');
  return m?parseFloat(m[1]):def;
}
function tiltSet(el,vn,fn,def,t){
  el.style.setProperty(vn,t.toFixed(2)+'deg');
  var r=Math.abs(def)>.001?Math.abs(t)/Math.abs(def):0;
  el.style.setProperty(fn,(1-(1-.93)*r).toFixed(3));
}
function tiltBind(el,vn,fn,def){
  if(!el||el._tilt)return;el._tilt=1;
  var lo=Math.min(0,def),hi=Math.max(0,def),d=null;
  el.addEventListener('pointerdown',function(e){
    if(e.pointerType==='mouse'&&e.button!==0)return;
    /* 手势归属：面板里凡是自己就吃指针的那几类（地球画布、人物图谱的 SVG、
       输入框），一律不参与调倾角。
       这不只是「谁先响应」的问题：调倾角这一步会 setPointerCapture 到面板上，
       一旦抢走，图谱那边的 pointermove/up 就再也收不到——名牌拖到一半卡住不动、
       松手也不回位，手机电脑都一样。所以在按下这一刻就让开，别等到滑动判定。
       让开之后，那扇窗仍可在图谱之外的地方（顶上那段说明、四周留白、底行）横拖调角，
       两个功能各在各的地盘上，都不少。 */
    if(e.target&&e.target.closest&&e.target.closest('canvas,svg,input,textarea,select,[data-nodrag]'))return;
    d={x:e.clientX,y:e.clientY,t0:tiltGet(el,vn,def),on:0,id:e.pointerId};
  });
  el.addEventListener('pointermove',function(e){
    if(!d||e.pointerId!==d.id)return;
    var dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(!d.on){
      if(Math.abs(dx)<10||Math.abs(dx)<Math.abs(dy)*1.4)return;   /* 竖向：让给滚动 */
      d.on=1;el.style.transition='none';
      try{el.setPointerCapture(d.id);}catch(_){}
    }
    e.preventDefault();
    /* 方向按「抓着这块面转」来：往右拖，面就顺着手往右转（rotateY 变大）；
       往左拖回来就扶正。之前写反了，手感是「推右边反而变平」。 */
    var t=d.t0+dx/22;                                  /* 220px 走完全程 */
    tiltSet(el,vn,fn,def,Math.max(lo,Math.min(hi,t)));
  });
  function end(e){
    if(!d||(e&&e.pointerId!==d.id))return;
    if(d.on){el.style.transition='';try{el.releasePointerCapture(d.id);}catch(_){}}
    d=null;
  }
  el.addEventListener('pointerup',end);
  el.addEventListener('pointercancel',end);
}
try{['pnMap','pnArm','pnShop'].forEach(function(id){
  tiltBind(document.getElementById(id),'--gpTilt','--gpFit',10);
});}catch(_){}
var _railT=0;
/* 对局里的全场底：照搬 terrainDraw 那一行，一个参数不改——
   同一个 DPR（tc 多大就多大）、同样每帧的视差插值、同样 q=1 的密度。
   先前那版自作主张：降到 10Hz、密度打八折、DPR 封到 1.5，
   于是缓慢前推的 zoff 变成一跳一跳（没动感）、山脊少了两成线（没纵深）、
   再叠半透明（没颜色）。三样毛病都出在「省」上，这里一样都不省。 */
function gTerrDraw(t){
  var c=document.getElementById('gTerr');if(!c)return;
  /* 只画一次：进对局画一次，视口变了再画一次。
     原本每帧重画，为的是那一点几乎看不出来的前移；可这是一张铺满视口的画布，
     它一变，根元素那道 invert+hue-rotate 与页面里二十处毛玻璃就得全部重算。
     实测就为这点漂移，对局屏从满帧掉到十六帧。要把漂移请回来，删掉下面这一行 return。 */
  /* 原来这张画布跟着 #terrain 的尺寸走。#terrain 是选局环那一屏的山，
     这张卡进不去那一屏，那张整屏画布已经不再按视口分配了（见下），
     所以这里改成按自己的盒子算。 */
  var _w=Math.round((c.clientWidth||innerWidth)*DPR),
      _h=Math.round((c.clientHeight||innerHeight)*DPR);
  if(c._painted&&c.width===_w&&c.height===_h)return;
  if(c.width!==_w||c.height!==_h){c.width=_w;c.height=_h;}
  var g=c.getContext('2d');if(!g)return;
  if(c.width>1&&c.height>1)c._painted=1;    /* 尺寸还没定就别记成画过了 */
  /* 视差恒为 0，不接鼠标。选局那边指针只管转环，山跟着推是顺的；
     对局里指针在点按钮、拖正文、敲字，背景再跟着晃就是无端乱动。
     parX 这个全局也一并不碰——省得回主菜单时山从一个歪掉的位置弹回来。
     画面只留 zoff 那点向前漂移，其余一动不动。 */
  try{terrainPaint(g,c.width,c.height,t,pos*230,0,1);}catch(_){}
}
function railThumb(arrId,srcId){
  var mw=document.querySelector('#'+arrId+' .mw'),src=document.getElementById(srcId);
  if(!mw||!src)return;
  var h=src.innerHTML.replace(/\sid="[^"]*"/g,'');
  if(mw._h!==h){mw._h=h;mw.innerHTML=h;}
}
function railMapThumb(){
  /* 缩略窗里原来另画一颗完整的粒子地球。地球撤了，这里改画同一幅马赛克世界图，
     整幅塞进窗里（不裁、不拉），再点上这一代的地点。 */
  var c=document.querySelector('#arrMap .mmap');if(!c)return;
  var g=c.getContext('2d');if(!g)return;
  var W=c.width,H=c.height;
  if(!(W>1)||!(H>1))return;
  var mm=gmMM();if(!mm)return;
  /* 这一枚每 0.7 秒被叫一次。画布再小，一变也要整页重来一遍滤镜与毛玻璃——
     实测就是那一下 40 毫秒的顿。图是死的，没变就别动它。 */
  var A0=ERA.act||[];
  var sig=[W,H,GAME.dest||'',A0.length,(A0[0]&&A0[0].n)||''].join('|');
  if(c._sig===sig)return;
  c._sig=sig;
  g.clearRect(0,0,W,H);
  var sc=Math.min(W/mm.w,H/mm.h),bw=mm.w*sc,bh=mm.h*sc;
  var L=(W-bw)/2,T=(H-bh)/2;
  g.imageSmoothingEnabled=false;
  g.drawImage(gmMI()||FE.mi,L,T,bw,bh);
  var A=ERA.act||[];
  for(var i=0;i<A.length;i++){
    var x=L+((A[i].lo0+180)/360)*bw,y=T+((mm.laTop-A[i].la)/(mm.laTop-mm.laBot))*bh;
    g.fillStyle=(GAME.dest===A[i].n)?'rgba(208,100,23,.95)':'rgba(230,219,198,.8)';
    g.fillRect(x-1.5,y-1.5,3,3);
  }
}

/* 三维那一枚的微缩。三维是 WebGL，宿主没开 preserveDrawingBuffer，
   合成一过缓冲就被清了——在主循环里 drawImage 过去多半是一片黑。
   所以拷完抽查几个点：真有像素就用，全黑就退回自己画一张地平线示意，
   总好过挂一块死黑的方块。 */
function rail3dThumb(){
  /* 三维那一层在这张卡上整个停用（见 __ZJ3D_OFF__ 那一行的理由），
     可这一枚缩略窗现在照的不是三维，是视觉小说那一层——所以不能在这儿就掉头走。
     停用只跳过下面拷 WebGL 画布与那张地平线示意的老路子。 */
  var c=document.querySelector('#arr3d .m3d');if(!c)return;
  var g=c.getContext('2d');if(!g)return;
  var W=c.width,H=c.height,live=false;
  /* ── 视觉小说这一层是 DOM 拼的（一张背景图 + 几张立绘画布），不是 WebGL。
     底下那段照 WebGL 找画布的老路子在这张卡上永远扑空，缩略窗于是一直画着
     那张退而求其次的地平线示意——点开是人和城，缩略窗里是三根竖条。
     这儿照着 #vnIsle 的比例把它缩画一遍：背景按 cover 铺满，立绘按各自
     在框里的位置与 object-fit:contain 的实际落位贴上去。
     这张画布一变，整页的滤镜与毛玻璃就要重算一遍，所以内容没变就不重画。

     窗收起来了也照画：台前调度那一列本来就是给收起的窗看的，
     收起只是把窗挪出画面（visibility:hidden），盒子还在、画布里的像素也还在，
     照旧量得到拷得到——收起就抹白才是不对的。 */
  {
    var isle=document.getElementById('vnIsle');
    if(isle){
      var ir=isle.getBoundingClientRect();
      var bg=null,q,im;
      var bgs=[document.getElementById('vnBgA'),document.getElementById('vnBgB')];
      for(q=0;q<2;q++){
        im=bgs[q];if(!im||!im.naturalWidth)continue;
        var op=1;try{op=parseFloat(getComputedStyle(im).opacity)||0;}catch(_){}
        if(op>.5)bg=im;
      }
      var acts=isle.querySelectorAll('#vnCast canvas'),sig=[W,H,bg?bg.src:''];
      for(q=0;q<acts.length;q++)sig.push(acts[q].getAttribute('data-name')||q);
      sig=sig.join('|');
      if(c._vsig===sig&&ir.width>4)return;
      if(ir.width>4){
        c._vsig=sig;
        g.clearRect(0,0,W,H);
        if(bg){
          try{
            var sc=Math.max(W/bg.naturalWidth,H/bg.naturalHeight);
            var dw=bg.naturalWidth*sc,dh=bg.naturalHeight*sc;
            g.drawImage(bg,(W-dw)/2,(H-dh)/2,dw,dh);live=true;
          }catch(_){}
        }
        for(q=0;q<acts.length;q++){
          var el=acts[q];if(!el.width||!el.height)continue;
          var r=el.getBoundingClientRect();
          if(r.width<2||r.height<2)continue;
          /* 屏上是 object-fit:contain + object-position:center bottom：
             盒子比人高出好几倍，照盒子贴会把人拉扁。这里把实际落位算出来。 */
          var bw2=r.width/ir.width*W,bh2=r.height/ir.height*H;
          var k=Math.min(bw2/el.width,bh2/el.height);
          var iw2=el.width*k,ih2=el.height*k;
          var x=(r.left-ir.left)/ir.width*W+(bw2-iw2)/2;
          var y=(r.top-ir.top)/ir.height*H+(bh2-ih2);
          try{g.drawImage(el,x,y,iw2,ih2);live=true;}catch(_){}
        }
        if(live)return;
      }
    }
  }
  c._vsig='';
  g.clearRect(0,0,W,H);
  /* 三维停用时没有画布可拷，那张地平线示意也不该再画——窗里明明是人和城。
     视觉小说那一层还没铺好（刚进局、图还在路上）就先空着，下一拍再来。 */
  if(window.__ZJ3D_OFF__)return;
  if(GAME.txOpen){
    var hosts=['zjScene3D','mdScene3D','modScene3D'],src=null,i,j;
    for(i=0;i<hosts.length&&!src;i++){
      var h=document.getElementById(hosts[i]);
      if(!h)continue;
      try{if(getComputedStyle(h).display==='none')continue;}catch(_){}
      var cvs=h.querySelectorAll('canvas');
      for(j=0;j<cvs.length;j++)if(cvs[j].width>1&&cvs[j].height>1){src=cvs[j];break;}
    }
    if(src){
      try{g.drawImage(src,0,0,W,H);}catch(_){}
      try{
        var d=g.getImageData(0,0,W,H).data;
        for(var k=0;k<d.length;k+=4*13){if(d[k]>8||d[k+1]>8||d[k+2]>8){live=true;break;}}
      }catch(_){live=true;}      /* 画布被污染读不了：当它是活的，别退回示意 */
    }
  }
  if(live)return;
  /* 示意：一条地平线 + 几道退远的横线，与选局那张山脉底同一种笔触 */
  g.clearRect(0,0,W,H);
  var hor=H*.52,r;
  g.strokeStyle='rgba(95,92,83,.34)';g.lineWidth=1;
  g.beginPath();g.moveTo(0,hor);g.lineTo(W,hor);g.stroke();
  for(r=1;r<=5;r++){
    var y=hor+Math.pow(r/5,1.7)*(H-hor-2);
    g.strokeStyle='rgba(95,92,83,'+(.26-r*.04).toFixed(2)+')';
    g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();
  }
  g.fillStyle='rgba(132,88,0,.55)';
  g.fillRect(W*.34,hor-9,2,9);g.fillRect(W*.46,hor-14,2,14);g.fillRect(W*.60,hor-7,2,7);
}
function railSync(){
  /* 商店那一栏是 shopOpen 时才 shopRender() 的，没开过就只有一层空壳，
     缩略窗拷过去自然是一片空白。这里在它还空着的时候先替它渲一次——
     只渲这一次（有子节点就不再进来），此后照常由开关与买卖各自刷新。 */
  try{var _sw=document.getElementById('shopWrap');
      if(GAME.on&&_sw&&!_sw.firstElementChild)shopRender();}catch(_){}
  try{railThumb('arrArm','pnArm');}catch(_){}
  try{railThumb('arrShop','pnShop');}catch(_){}
  try{railMapThumb();}catch(_){}
  try{rail3dThumb();}catch(_){}
}

/* 版本印：设置面板底部常驻，一眼看出当前跑的是哪一版，省得靠猜缓存 */
try{var _bs=document.getElementById('buildStamp');if(_bs)_bs.textContent='BUILD 2.3.2';}catch(_){}

/* ═══════════════ [world] 守护龙纪事 · 适配层 ═══════════════
   引擎本体来自同一套叙事内核；这一层把它接到本作的正典资料（32 个纪年、角色卡、
   世界书、星球地图）与 app.js 的开局流程上。后文凡是同名函数，以这里的为准。 */
FE_MEOW_ZH='';MEOW_RULE='';FELINIA_VOICE_EXAMPLE='';
function felNormalizeMeowText(t){return String(t==null?'':t);}
function felStripLegacyMeowRule(s){return String(s||'');}
function cardHeroless(){return true;}
function cardHeroName(){try{var n=CARDS[ACTIVE]&&CARDS[ACTIVE].heroName;if(n)return n;}catch(_){}return '玩家';}
function eraGate(){return '';}
function powerSpec(){return '';}
function abacusBand(){return '';}
function nowYear(){return 0;}
function feliniaGlobalRules(t){return String(t||'');}
function feliniaEraContext(){try{var e=FE.era;return e?('【当前纪年】第 '+e.i+' 纪 · '+e.t):'';}catch(_){return '';}}
var WORLD_PANEL={textOrder:['形态','衣着','持物','体况','所在'],reserved:['史笔'],badge:'AETAS',badgeLabel:'纪年',
  widgets:[{type:'bar',k:'体力',label:'体力',caps:[[0,'力竭'],[20,'虚弱'],[40,'还撑得住'],[60,'尚可'],[80,'充沛'],[95,'游刃有余']]},
           {type:'bar',k:'魔力',label:'魔力',caps:[[0,'枯竭'],[20,'见底'],[40,'勉强'],[60,'充足'],[80,'丰沛'],[95,'满溢']]}]};
var WORLD_CAT={'character-profile':'人物 · 档案','character-experience':'人物 · 经历','character-motivation':'人物 · 动机','character-voice':'人物 · 声口','character-relations':'人物 · 关系','character-timeline':'人物 · 主龙时间线',
  'secondary-character-profile':'次要人物 · 档案','secondary-character-experience':'次要人物 · 经历','secondary-character-motivation':'次要人物 · 动机','secondary-character-voice':'次要人物 · 声口','secondary-character-relations':'次要人物 · 关系',
  'shared-canon':'世界 · 共同背景','setting-fact':'世界 · 综合设定','setting-place':'世界 · 地点环境','setting-institution':'世界 · 机构势力','setting-society':'世界 · 社会身份','setting-species':'世界 · 族群生命','setting-economy':'世界 · 经济生活',
  'setting-power':'能力 · 系统','setting-object':'物件 · 资源','history-event':'历史 · 剧情状态',
  'premise':'规则 · 时代边界','canon-rule':'规则 · 正典','era-rule':'规则 · 时代限制','narrative-rule':'规则 · 叙事','system-rule':'规则 · 系统','support-rule':'规则 · 支援','social-rule':'规则 · 社会伦理','scene-rule':'规则 · 场景生活'};
function worldText(x){return String((x&&x.text!=null)?x.text:(x==null?'':x)).replace(/\s+/g,' ').trim();}
function worldLore(e,ord){
  return {id:e.id,title:e.title||'',memo:e.memo||'',cat:WORLD_CAT[e.category]||('其他 · '+(e.category||'条目')),lay:'world',era:ord,
    keys:(e.keys||[]).slice(),keys2:(e.secondaryKeys||[]).slice(),constant:!!e.constant,selective:!!e.selective,
    on:e.enabled!==false,ord:e.order==null?100:e.order,content:e.content||'',category:e.category||''};
}
function worldEraEntry(era,meta){
  var cards=era.cards||[];
  return {i:era.ordinal,y:99999,ys:'第 '+era.ordinal+' 纪',t:era.name,s:(meta&&(meta.recap||meta.synopsis))||'',w:'',inst:[],nm:'',reg:'',home:'',coin:'',og:[],locs:[],roles:[],dress:[],
    figs:cards.map(function(c){return {n:c.name,sp:'',ti:c.isMainDragon?'主角龙':'正典角色',id:c.id,
      d:worldText(c.canonIdentityEvidence&&c.canonIdentityEvidence[0]),
      q:(c.eraSafeDialogueSamples||[]).slice(0,6).map(worldText)};})};
}
/* [world] 正典物件：ARMA 与 MERCATVS 两个抽屉不再摆秦市货，改列本纪世界书登记的物件，只可查阅。 */
function worldItemName(t){
  t=String(t||'').replace(/^【[^】]*】/,'').trim();
  var m=t.split(/[，。；：,;:（(]/)[0]||t;
  return m.length>22?(m.slice(0,22)+'…'):m;
}
function worldItemIcon(t){
  var R=[[/剑|刃/,'sword'],[/匕|短刀/,'dagger'],[/枪|矛|戟|杖/,'spear'],[/弓/,'bow'],[/弩/,'crossbow'],[/箭/,'arrow'],[/盾/,'shield'],[/甲|铠/,'armor'],[/盔|冠|帽/,'helm'],
    [/斗篷|披风/,'cloak'],[/袍|衣|裙|衫/,'robe'],[/靴|鞋/,'boot'],[/戒|环|链|项/,'chain'],[/书|卷|典|册|信|契|符|文/,'tablet'],[/印|玺|徽/,'seal'],[/灯|火|烛/,'lamp'],
    [/药|草|丹/,'herb'],[/酒/,'winejar'],[/粮|饭|饼|面包|仓/,'bread'],[/肉/,'meat'],[/鱼/,'fish'],[/石|矿|晶|玉|珠|核/,'stone'],[/袋|囊|包/,'pouch'],[/箱|匣|柜/,'chest'],
    [/镜/,'mirror'],[/币|钱|金/,'coin'],[/像|偶/,'pin'],[/瓶|壶|罐/,'flask']];
  for(var i=0;i<R.length;i++)if(R[i][0].test(t))return R[i][1];
  return 'tag';
}
function worldItems(era){
  var k;for(k in ARMDB)delete ARMDB[k];
  (era.lorebook||[]).forEach(function(e){
    if(!e||e.category!=='setting-object'||e.enabled===false)return;
    var name=worldItemName(e.title||e.memo);
    ARMDB[e.id]={la:'',cn:name,cat:'物件',slot:'',ic:worldItemIcon(name),ban:'正典物件 · 只可查阅'};
  });
  SHOP_TABS.length=0;SHOP_TABS.push(['全部',null],['物件',['物件']]);
  SHOP_SEC.length=0;SHOP_SEC.push('物件');
  for(k in INVSETS)delete INVSETS[k];INVSETS._={eq:{},bag:[]};
  FEG.unit='';FEG.set=null;FEG.at='';FEG.canon=true;
  FEG.note='第 '+era.ordinal+' 纪世界书登记的物件。价格、产地与得失只按正典条目写明的来，市上无价可标，亦无买卖。';
  SHOPTAB=0;
}
function worldSetEra(era,meta){
  var ord=era.ordinal;
  worldItems(era);
  CARDS.luzhi={name:'守护龙纪事',heroName:'玩家',heroless:true,panelSpec:WORLD_PANEL,description:'',personality:'',scenario:'',system_prompt:'',post_history_instructions:'',mes_example:'',first_mes:'',openings:[],annals:[],timeline:[],
    lorebook:(era.lorebook||[]).map(function(e){return worldLore(e,ord);})};
  try{(JSON.parse(localStorage.getItem('guardianDragonLoreCustom')||'[]')||[]).forEach(function(e){if(e&&e.title&&e.content)CARDS.luzhi.lorebook.push(e);});}catch(_){}
  var entry=worldEraEntry(era,meta);
  FE.eras=[entry];FE.era=entry;FE.ld=2;FE.soc=[];
  window.__GAME_LUZHI__=CARDS.luzhi;
  FEL_RISU_BOOT=null;
  felRisuStart();
  return window.__FEL_RISU_READY__;
}
function worldPanel(o){
  var comps=(o.companions||[]),loc=o.scene||o.eraName||'';
  var forms=(o.player&&o.player.card&&o.player.card.eraDragonChronology&&o.player.card.eraDragonChronology.formEvidence)||[];
  var form=worldText(forms[0])||(o.player&&o.player.custom&&o.player.custom.speciesForm)||'—';
  return '<mvu_panel>\n<sec_char>\n'
    +'◆形态|'+form.slice(0,60)+'\n◆衣着|—\n◆持物|—\n◆体况|无伤\n◆所在|'+loc+'\n◆体力|80\n◆魔力|80\n'
    +'◆心声|——\n◆史笔|第 '+o.eraOrdinal+' 纪，'+(o.chapter||o.eraName)+'。此幕自此写起。\n</sec_char>\n<sec_npc>\n'
    +comps.map(function(n){return '◈'+n+'|初逢|50|（尚未开口）|正典人物|'+loc+'|不详|不详|（还没看清是谁）';}).join('\n')
    +'\n</sec_npc>\n<sec_world>\n◇纪年|第 '+o.eraOrdinal+' 纪 · '+o.eraName+'\n◇时地|'+loc+'\n◇天气|晴\n◇安稳|60\n◇大势|尚未分明\n◇将临|尚未分明\n</sec_world>\n</mvu_panel>';
}
function worldStart(o){
  var name=o.player&&o.player.name||'玩家';
  if(CARDS.luzhi)CARDS.luzhi.heroName=name;
  var figs=(FE.era&&FE.era.figs)||[],soc=[];
  (o.companions||[]).forEach(function(n){for(var k=0;k<figs.length;k++)if(figs[k].n===n){soc.push(k);break;}});
  FE.soc=soc;
  var ei=o.eraOrdinal|0;
  var keys=soc.map(function(k){return 'era:'+ei+':npc:'+k+':'+figs[k].n;});
  var text=String(o.opening||'').trim()+'\n\n'+worldPanel(o);
  /* 顶栏：locLabel 已含纪名与玩家名，scene 只在真有地点或章题时才补在后面 */
  var scene=(o.scene&&o.scene!==o.eraName)?o.scene:(o.chapter||'');
  loadOpening('luzhi',{id:o.eraId,year:ei,era:'AETAS '+(ei<10?'0':'')+ei+' · '+o.eraName,ei:ei,scene:scene,text:text,feLocs:[],world:o.world||null},o.locLabel||'');
  GAME.hero=(o.player&&o.player.mode==='custom')?{n:name,g:(o.player.custom&&o.player.custom.social)||'',a:'',o:(o.player.custom&&o.player.custom.speciesForm)||''}:null;
  GAME.risuNpcKeys=keys;
  gameShow();
}
/* 自定义开局：交给神谕现场铸写；未接线时以玩家写的场面为开场。 */
function worldForge(o,done,fail){
  var name=o.player&&o.player.name||'玩家';
  if(CARDS.luzhi)CARDS.luzhi.heroName=name;
  GAME.hero={n:name,g:(o.player.custom&&o.player.custom.social)||'',a:'',o:(o.player.custom&&o.player.custom.speciesForm)||''};
  var scene=String(o.scene_text||'').trim();
  if(!apiReady()){
    var body='【自定义开局】第 '+o.eraOrdinal+' 纪 · '+o.eraName+(o.scene?('，'+o.scene):'')+'。\n'
      +'你是「'+name+'」。'+(scene?('\n'+scene):'')+'\n这一幕自你落脚之刻写起——开口、动身，或先看看四周。';
    done(body);return;
  }
  var ask='【任务】为玩家现场铸一个全新开局：从零写一幕完整的开场，700—1200 字，不加标题。\n'
    +'【纪年】第 '+o.eraOrdinal+' 纪 · '+o.eraName+'\n【地点】'+(o.scene||'由正典决定')+'\n【玩家此局身份】'+name
    +(scene?('\n【此刻的场面·玩家指定·必须照此开场】\n'+scene):'')
    +'\n【写法】严格遵守系统提示里的正典边界与玩家主权；先让此地正在发生的事碰到一名非玩家焦点，沿其感知、误读、证据、修正与行动展开；'
    +'最后把一个已经发生的动作、话音或物件递到'+name+'面前停笔。绝不代替'+name+'说话、行动、决定、写内心。'
    +'\n正文之后必须输出一个完整的 <mvu_panel>，字段名、行首符号、竖线分隔与下面的范例一字不差：\n'+worldPanel(o)
    +'\n只输出正文与 <mvu_panel>，不要任何解释、不要代码围栏。';
  risuInvoke([{role:'system',content:sysPrompt()},{role:'user',content:ask}],function(reply){
    var txt=String(reply||'').trim();
    if(!/<mvu_panel>/.test(txt))txt+='\n\n'+worldPanel(o);
    done(txt);
  },function(msg){fail(msg);},{max_tokens:3200,opening:true});
}
function sysPrompt(){
  var core='';try{core=(window.WORLD_UI&&window.WORLD_UI.systemCore)?window.WORLD_UI.systemCore():'';}catch(_){}
  var _minc=(typeof SET!=='undefined'&&SET.samp.minc)?SET.samp.minc:900;
  var minc='【篇幅·硬要求】本回正文不少于'+_minc+'字（状态栏不计入字数），篇幅靠连续镜头与事件堆：多写一处动静、一个在场者的小动作、一件被注意到的具体东西，而不是靠形容词注水。';
  return [core,
    FELINIA_NPC_ENGINE,
    heroSheet(),
    (function(){if(typeof memChronicle!=='function'||typeof S==='undefined'||S.memOn===false)return '';
      var _manual=memChronicle();return _manual?('【玩家长期手记】以下是玩家亲手记下、要求长期保留的设定与约定；剧情原文由记忆宫殿按相关性检索，不在这里重复注入：\n'+_manual):'';})(),
    (function(){if(typeof npcFavorDigest!=='function')return '';var _fd=npcFavorDigest();return _fd?('【人物好感·续记（不得健忘）】以下为曾登场人物最近一次的好感度与近况。他们即便暂时离场，好感与关系也须延续：\n'+_fd):'';})(),
    mvuSpec(),
    modeSpec(),
    FELINIA_FINAL_CHECK,
    minc,
    CFGS.preset?('【玩家自定义常驻指令】'+CFGS.preset):'',
    heroTail(),
    povTail()
  ].filter(Boolean).map(macroFill).join('\n\n');
}
function modeSpec(){
  return '【玩家输入的模式标签·必读】玩家每句话前的方括号标签，标明这一回合在做什么，你必须据此选择回应方式：\n'
    +'·【SERMO】出声说话。以 ~ 开头的是内心独白——只可让世界回应外在的表现，绝不可复述、引用或续写这段心声。\n'
    +'·【ACTVS】做一个具体动作，写这个动作在场面里激起的连锁反应。\n'
    +'·【INSIDIAE】密谋暗线，只有玩家与同谋知情；不在场的人这一回合不得表现出知道此事。\n'
    +'·【EPISTVLA】修书，@后为收件人；写信如何送出、经手何人、对方读到时的反应。\n'
    +'·【EDICTVM】以身份或权威发号施令；写命令如何被传达、被执行、被阳奉阴违或被抗拒，以及为此付出的代价。\n'
    +'·【ITER】启程前往某地，写路途见闻与抵达时的场面。\n'
    +'·【世界地形变动】是已经真实发生的世界事件，不得撤销、质疑或淡化。\n'
    +'·（没有方括号标签的那一句是玩家自由写下的，照字面理解即可。）';
}
function gameShow(){
  try{if(window.WORLD_UI&&window.WORLD_UI.hideAll)window.WORLD_UI.hideAll();}catch(_){}
  MENU.on=false;GAME.on=true;gEl.classList.add('show');gEl.setAttribute('data-pg','narr');
  GAME.txOpen=true;gEl.classList.add('txOpen');gEl.classList.remove('tx2','txBig');
  try{if(window.__arrPaint)window.__arrPaint();}catch(_){}
  try{if(window.WORLD_UI&&window.WORLD_UI.mountPanel)window.WORLD_UI.mountPanel();}catch(_){}
  try{if(typeof BGM!=='undefined'&&BGM_LIST.length&&!BGM.a)bgmPlay(0);}catch(_){}
  setTimeout(function(){try{autoSave(1);}catch(_){}},1200);
  try{gLocFit();}catch(_){}
  try{if(window.FELVN&&window.FELVN.tick)window.FELVN.tick();}catch(_){}
}
function gameExit(){
  try{autoSave(1);}catch(_){}
  TYPE_GEN++;
  try{if(GENAC)GENAC.abort();}catch(_){}
  BUSY=false;try{genClose();}catch(_){}
  GAME.on=false;GAME.txOpen=false;gEl.classList.remove('show','mapOpen','armOpen','shopOpen','txOpen','tx2','txBig');
  GAME.mapOpen=GAME.armOpen=GAME.shopOpen=false;
  ['#dlgCfg','#dlgBook','#dlgSave','#dlgExit','#dlgApi','#dlgVoc','#dlgBgm'].forEach(function(d){var e=$(d);if(e)e.style.display='none';});
  menuEnter();
}
function gmapRefresh(){try{if(GAME.on&&GAME.mapOpen&&window.WORLD_UI&&window.WORLD_UI.mountPanel)window.WORLD_UI.mountPanel();}catch(_){}}
function svLoad(v){
  var w=v&&v.world;
  if(w&&window.WORLD_UI&&window.WORLD_UI.restoreExtra){
    window.WORLD_UI.restoreExtra(w).then(function(){svLoadCore(v);},function(e){
      try{var m=$('#svCoreSub');if(m)m.textContent='读档失败：'+((e&&e.message)||e);}catch(_){}
    });
  }else svLoadCore(v);
}
/* 幕间乐：本作尚未收录曲库时退回程序化氛围 */
BGM_LIST.length=0;
function bgmPlay(i){
  if(!BGM_LIST.length){
    if(!auInit()){return;}
    if(!AU.on){AU.on=true;try{if(AU.ctx.state==='suspended')AU.ctx.resume();}catch(_){}auPluck();}
    BGM.on=true;var g=$('#gtSnd');if(g){g.classList.add('on');g.title='MVSICA · 程序化氛围（点击开启播放器）';}
    return;
  }
  BGM.i=i;var a=bgmEl();BGM.on=true;$('#gtSnd').classList.add('on');
  $('#gtSnd').title='MVSICA · '+BGM_LIST[i].t+'（点击开启播放器）';bgmArm();
  bgmSrc(i,function(u){if(BGM.i!==i)return;if(!u){if(++BGM.skip<BGM_LIST.length)bgmPlay((i+1)%BGM_LIST.length);return;}a.src=u;bgmStart(a,i);});
}
function bgmToggle(){
  if(!BGM_LIST.length){
    if(AU.on){AU.on=false;clearTimeout(AU.timer);BGM.on=false;var g=$('#gtSnd');if(g)g.classList.remove('on');return;}
    bgmPlay(0);return;
  }
  if(BGM.on){BGM.on=false;$('#gtSnd').classList.remove('on');if(BGM.a)BGM.a.pause();return;}
  if(BGM.a&&BGM.a.src){var p=BGM.a.play();if(p&&p.catch)p.catch(function(){});BGM.on=true;$('#gtSnd').classList.add('on');return;}
  BGM.skip=0;bgmPlay(0);
}
function bgmUi(){
  var now=$('#bgNow'),ico=$('#bgPlayIco');
  if(!BGM_LIST.length){
    if(now)now.textContent=AU.on?'▶ 程序化氛围 · 幕间乐':'未收录乐曲 · 点 ▶ 播放程序化氛围';
    if(ico)ico.innerHTML=AU.on?'<path d="M8 4v16M16 4v16"/>':'<path d="M6 4l14 8-14 8z"/>';
    return;
  }
  if(now)now.textContent=(BGM.a&&BGM.a.src)?((BGM.on?'▶ ':'❚❚ ')+(BGM_LIST[BGM.i]?BGM_LIST[BGM.i].t:'')):'未在播放 · 点曲目或 ▶ 开始';
  if(ico)ico.innerHTML=BGM.on?'<path d="M8 4v16M16 4v16"/>':'<path d="M6 4l14 8-14 8z"/>';
  var ls=$('#bgList');
  if(ls&&ls.children.length)for(var i=0;i<ls.children.length;i++)ls.children[i].style.color=(i===BGM.i&&BGM.a&&BGM.a.src)?'var(--gold-hi)':'';
}
/* 主菜单三钮 */
(function(){
  var c=$('#miCont');if(c)c.addEventListener('pointerup',function(e){e.stopPropagation();
    if(GAME.op){gameShow();return;}
    var v=autoGet();if(!v)return;try{svLoad(v);}catch(_){}
  });
  var o=$('#miOrac');if(o)o.addEventListener('pointerup',function(e){e.stopPropagation();apiOpen();});
  var a=$('#miArch');if(a)a.addEventListener('pointerup',function(e){e.stopPropagation();svOpen();});
})();
/* 昼夜：本作保留白昼／黑夜两档（引擎原版只有白昼） */
function luxApply(v){
  /* [world] 主题是深空底，纪年插画页与铸局页不再走白昼反色层 */
  LUX=0;
  document.documentElement.classList.remove('lux');
  var cb=$('#cfgLux');if(cb){cb.checked=!!LUX;cb.disabled=false;}
  try{localStorage.setItem('guardianDragonLux',LUX?'1':'0');}catch(_){}
}
try{luxApply(0);}catch(_){}
window.WORLD_ENGINE={
  setEra:worldSetEra,start:worldStart,forge:worldForge,show:gameShow,exit:gameExit,
  send:function(t){sendText(String(t||''));},busy:function(){return !!BUSY;},on:function(){return !!GAME.on;},
  hasAuto:function(){return !!autoGet();},loadAuto:function(){var v=autoGet();if(v)svLoad(v);return !!v;},
  autoSave:function(){try{autoSave(1);}catch(_){}},
  openApi:apiOpen,openSaves:svOpen,exitDialog:function(){gDlgShow('#dlgExit');},
  apiReady:apiReady,apiMsg:function(m){var el=$('#apiMsg');if(el)el.textContent=m||'';},
  lore:function(){return (CARDS.luzhi&&CARDS.luzhi.lorebook)||[];},
  panelRender:function(){try{if(GAME.lastPanel)renderMvu(GAME.lastPanel);}catch(_){}}
};

})();
