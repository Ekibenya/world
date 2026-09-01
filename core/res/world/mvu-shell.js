var SET={mvuRing:1};
var REDUCED=false;
var gEl=$('#game');
function pad(n){return (n<10?'0':'')+n;}
function lerp(a,b,t){return a+(b-a)*t;}
function clamp01(v){return v<0?0:v>1?1:v;}
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

var lastPtr=0;
function parTarget(){
  var now=performance.now();
  if(now-lastPtr>2400){
    var d=now/1000;
    return [Math.sin(d*.152)*.55+Math.sin(d*.071)*.24, Math.cos(d*.118)*.42+Math.sin(d*.059)*.18];
  }
  return [mouseX,mouseY];
}

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
var MV={pos:0,tgt:null,drag:null,n:0,cards:[],raf:0,R:600,ang:[],maxH:600,
        box:null,stage:null,track:null,bg:null,bgx:null,rail:null,railx:null,foot:null,
        bgT:0,w:0,h:0,scroll:{}};
function mvOn(){try{return SET&&SET.mvuRing>0;}catch(_){return false;}}
function mvMode(){try{return SET.mvuRing===2?2:1;}catch(_){return 1;}}
function mvCyc(){return MV.mode===2;}
function mvWrap(x){var n=MV.n||1;if(!mvCyc())return Math.max(0,Math.min(n-1,Math.round(x)));return ((x%n)+n)%n;}
function mvNear(t){
  var n=MV.n||1;
  if(!mvCyc())return Math.max(0,Math.min(n-1,Math.round(t)));
  var d=mvWrap(t)-mvWrap(MV.pos);
  if(d>n/2)d-=n;else if(d<-n/2)d+=n;
  return MV.pos+d;
}
function mvBox(){return document.querySelector('#game .gMfd');}

function mvPhone(){try{return innerWidth<=760;}catch(_){return false;}}
function mvTag(t){

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
  if(typeof MV==='undefined'||!MV)return;
  var box=mvBox();if(!box)return;
  if(!mvOn()){
    if(box.querySelector('.mvStage')){mvFlatten(box);box.classList.remove('mvRing');}
    box.classList.remove('mvRing');mvStop();return;
  }

  var keep={};
  if(box.querySelector('.mvStage')){
    var bs=box.querySelectorAll('.mvBody');
    for(var q=0;q<bs.length;q++)keep[q]=bs[q].scrollTop;
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

      fr.innerHTML='<div class="mw"></div><div class="cshade"></div><div class="ic"></div>'
        +'<div class="mvGhost"><span class="g1"></span><div class="g2"></div><div class="g3"></div></div>';
      mw=fr.querySelector('.mw');

      win=document.createElement('div');win.className='mvWin';win.setAttribute('data-i',k);
      wfr=document.createElement('div');wfr.className='cfr';
      wfr.innerHTML='<span class="ftag"></span><span class="fnum"></span><div class="mvBody"></div>';
      win.appendChild(wfr);panes.appendChild(win);

      try{
        if(MV.tiltU!=null)tiltSet(win,'--mvTilt','--mvFit',-10,MV.tiltU);
        tiltBind(win,'--mvTilt','--mvFit',-10);
        win.addEventListener('pointerup',function(){MV.tiltU=tiltGet(win,'--mvTilt',-10);});
      }catch(_){}
      wfr.querySelector('.ftag').textContent=tag+' SECTIO // '+pad(k+1);
      wfr.querySelector('.fnum').textContent='SIG_'+pad(k+1)+'/'+pad(secs.length);
      body=wfr.querySelector('.mvBody');

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
  if(deck)box.classList.add('mvBoot');

  MV.box=box;MV.stage=stage;MV.track=track;MV.panes=panes;MV.foot=foot;MV.cards=cards;MV.n=cards.length;
  MV.bg=bg;MV.bgx=bg.getContext('2d');MV.rail=rail;MV.railx=rail.getContext('2d');
  MV.n=cards.length;MV.pos=mvWrap(MV.pos||0);MV.tgt=null;MV.drag=null;MV.bgT=0;
  MV.w=0;MV.h=0;
  mvBind();mvSize();mvLayout();mvStart();
}
function mvBind(){
  var st=MV.stage;

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

  st.addEventListener('click',function(e){
    var c=e.target&&e.target.closest?e.target.closest('.mvCard'):null;
    if(!c){MV.w=0;return;}
    if(c.classList.contains('on')){

      if(mvPhone()){try{gEl.classList.toggle('mvOpen');}catch(_){}}

      try{if(gEl&&gEl.classList.contains('txBig')){gEl.classList.toggle('txMvShut');MV.w=0;return;}}catch(_){}
      MV.w=0;return;
    }

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

function mvSize(){
  if(!MV.stage||!MV.box)return;

  MV.mode=mvMode();
  MV.box.classList.toggle('mvDeck',MV.mode!==2);
  try{gEl.classList.toggle('mvFree',MV.mode!==2);}catch(_){}
  var W=MV.stage.clientWidth,H=MV.stage.clientHeight;
  if(!(W>10&&H>10))return;

  if(mvMode()!==2&&W<260)return;
  MV.w=W;MV.h=H;
  var cw=Math.max(150,W-10);

  var _nar=(W<520);

  MV.tw=_nar?34:64;MV.th=_nar?23:44;MV.tgap=_nar?18:20;
  var _cn=Math.max(1,MV.cards.length);
  while(_cn*(MV.th+MV.tgap)>H-20&&MV.th>24){MV.tw-=4;MV.th=Math.round(MV.tw*.69);MV.tgap=Math.max(12,MV.tgap-1);}

  MV.mo=_nar?66:14;MV.mi=6;
  MV.gut=Math.max(240,Math.min(384,W-24));
  try{gEl.style.setProperty('--mvGut',MV.gut+'px');}catch(_){}

  var maxH=(mvMode()===2)?Math.max(150,Math.round(H*.68)):Math.max(180,H-12);
  var minH=104,PADY=43;

  MV.small=Math.max(74,Math.round(H*.115));
  MV.gap=-6;
  var C=MV.cards,i;
  MV.cw=cw;

  if(mvMode()===2)for(i=0;i<C.length;i++)C[i].el.style.width=cw+'px';

  MV.minH=minH;MV.maxH=maxH;MV.padY=PADY;
  MV.full=mvMeasure();
  var mean=0;for(i=0;i<MV.full.length;i++)mean+=MV.full[i];
  mean=MV.full.length?mean/MV.full.length:200;

  MV.R=Math.max(160,Math.round(1.46*Math.max(90,(mean+MV.small)/2+MV.gap)));

  if(MV.mode===2){
    MV.P=Math.max(120,Math.round(MV.R*1.30));
  }else{

    MV.P=620;MV.peek=Math.max(24,Math.round(H*.042));MV.dz=Math.round(H*.16);
    MV.stepPix=Math.max(120,Math.round(H*.34));
  }
  MV.stage.style.perspective=MV.P+'px';

  MV.stage.style.perspectiveOrigin=(MV.mode===2?'':'100% 50%');
  MV.track.style.transform=(MV.mode===2?'translateZ('+MV.R.toFixed(1)+'px)':'none');

  for(i=0;i<C.length;i++){C[i].k='';C[i].w=-1;C[i].h=-1;C[i].bk='';C[i].mwk='';C[i].wk='';}

  if(MV.mode===2)mvHeights();
  var d=Math.min(devicePixelRatio||1,2);
  MV.bg.width=Math.max(1,Math.round(MV.box.clientWidth*d));
  MV.bg.height=Math.max(1,Math.round(MV.box.clientHeight*d));
  MV.rail.width=Math.max(1,Math.round((MV.rail.clientWidth||16)*d));
  MV.rail.height=Math.max(1,Math.round((MV.rail.clientHeight||H)*d));
  MV.bgT=0;
}

function mvMeasure(){
  var C=MV.cards,out=[],i;
  for(i=0;i<C.length;i++){
    var kid=C[i].body.firstElementChild;
    out.push(Math.max(MV.minH||104,Math.min(MV.maxH||600,(kid?kid.offsetHeight:0)+(MV.padY||43))));
  }
  return out;
}

function mvRemeasure(){
  if(!MV.cards||!MV.cards.length||!MV.full||MV.full.length!==MV.cards.length)return;
  var m=mvMeasure(),ch=false;
  for(var i=0;i<m.length;i++)if(Math.abs(m[i]-MV.full[i])>=4){MV.full[i]=m[i];ch=true;}
  return ch;
}

function mvHeights(){
  var C=MV.cards,n=C.length;if(!n||!MV.full||MV.full.length!==n)return;
  var hs=[],i;
  for(i=0;i<n;i++){
    var d=Math.abs(MV.pos-i);d=Math.min(d,n-d);
    var w=clamp01(1-d);
    var h=Math.round(MV.small+(MV.full[i]-MV.small)*w);
    hs.push(h);
    if(Math.abs((C[i].h||0)-h)>=1){C[i].el.style.height=h+'px';C[i].h=h;}
  }
  MV.ang=[0];
  for(i=1;i<n;i++)MV.ang.push(MV.ang[i-1]+((hs[i-1]+hs[i])/2+MV.gap)/MV.R);

  MV.tot=MV.ang[n-1]+((hs[n-1]+hs[0])/2+MV.gap)/MV.R;
}

function mvHeightsDeck(){
  var C=MV.cards,n=C.length;if(!n||!MV.full||MV.full.length!==n)return;
  for(var i=0;i<n;i++){
    var h=MV.full[i];
    if(Math.abs((C[i].h||0)-h)>=1){C[i].el.style.height=h+'px';C[i].h=h;}
  }
}
function mvSeg(i){
  var A=MV.ang,n=MV.n;
  return (i<n-1?A[i+1]-A[i]:MV.tot-A[n-1])||1e-6;
}
function mvRot(){
  var A=MV.ang,n=MV.n;if(n<1)return 0;if(n<2)return A[0];
  var p=((MV.pos%n)+n)%n,i=Math.floor(p);
  return A[i]+(p-i)*mvSeg(i);
}
function mvPosFromRot(r){
  var A=MV.ang,n=MV.n,T=MV.tot;if(n<2||!T)return 0;
  var q=((r%T)+T)%T;
  for(var i=n-1;i>=0;i--)if(q>=A[i])return i+(q-A[i])/mvSeg(i);
  return 0;
}

function mvShell(C,w,h,R,P,a,curve){
  if(!curve){
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

  var f=(e+R)/(e+R*Math.cos(th/2));
  f=Math.max(1.014,Math.min(1.26,1+(f-1)*1.6));

  f=Math.min(f,1+26/Math.max(40,w/2-1));
  var key=(w|0)+'x'+(h|0)+'x'+f.toFixed(4);
  if(C.k===key)return;
  C.k=key;
  var cx=w/2, hw1=w/2-1, hw0=hw1/f, y0=.5, y1=h-.5, ym=h/2;

  var pad=Math.round(hw1-hw0)+3;
  if(C.pad!==pad){C.pad=pad;C.body.style.left=pad+'px';C.body.style.right=pad+'px';}
  var qx=2*hw0-hw1;
  var d='M'+(cx-hw1).toFixed(1)+' '+y0.toFixed(1)
       +'H'+(cx+hw1).toFixed(1)
       +'Q'+(cx+qx).toFixed(1)+' '+ym.toFixed(1)+' '+(cx+hw1).toFixed(1)+' '+y1.toFixed(1)
       +'H'+(cx-hw1).toFixed(1)
       +'Q'+(cx-qx).toFixed(1)+' '+ym.toFixed(1)+' '+(cx-hw1).toFixed(1)+' '+y0.toFixed(1)+'Z';
  C.p1.setAttribute('d',d);
  C.p1.setAttribute('stroke','rgba(19,18,13,.5)');
  C.p1.setAttribute('stroke-width','1');

  var b=7;
  C.p2.setAttribute('d',
     'M'+(cx-hw1).toFixed(1)+' '+(y0+b)+'V'+y0.toFixed(1)+'H'+(cx-hw1+b).toFixed(1)
    +'M'+(cx+hw1-b).toFixed(1)+' '+y0.toFixed(1)+'H'+(cx+hw1).toFixed(1)+'V'+(y0+b)
    +'M'+(cx+hw1).toFixed(1)+' '+(y1-b)+'V'+y1.toFixed(1)+'H'+(cx+hw1-b).toFixed(1)
    +'M'+(cx-hw1+b).toFixed(1)+' '+y1.toFixed(1)+'H'+(cx-hw1).toFixed(1)+'V'+(y1-b));
  C.p2.setAttribute('stroke','var(--paper)');
  C.p2.setAttribute('stroke-width','1');
  C.svg.setAttribute('viewBox','0 0 '+w.toFixed(1)+' '+h.toFixed(1));

  var pts=[],k,pp,hw,N=9;
  for(k=0;k<=N;k++){pp=-1+2*k/N;hw=hw0+(hw1-hw0)*pp*pp;
    pts.push((cx+hw).toFixed(1)+'px '+(ym+pp*(h/2-.5)).toFixed(1)+'px');}
  for(k=N;k>=0;k--){pp=-1+2*k/N;hw=hw0+(hw1-hw0)*pp*pp;
    pts.push((cx-hw).toFixed(1)+'px '+(ym+pp*(h/2-.5)).toFixed(1)+'px');}
  C.fr.style.clipPath='polygon('+pts.join(',')+')';
}

function mvDeck(){
  var n=MV.n,C0=MV.cards;
  if(!n||!C0[0]||!C0[0].win)return;

  var SW=MV.w||320,SH=MV.h||600,MO=MV.mo||14,MI=MV.mi||6;
  var TW=MV.tw||52,TH=MV.th||36,STEP=TH+(MV.tgap==null?7:MV.tgap);
  var GUT=MV.gut||368;

  var winW=Math.max(180,GUT-MO-TW-MI*2);
  var winH=Math.max(160,SH-MO);
  var thumbX=SW/2-TW/2-MI;
  var winX=SW/2-MI*2-TW-winW/2;

  var TILT=10;
  var PP=620,SN=Math.sin(TILT*Math.PI/180),CS=Math.cos(TILT*Math.PI/180);
  if(MV.panes&&MV.tiltK!==TILT){MV.tiltK=TILT;MV.panes.style.setProperty('--mvTilt',(-TILT)+'deg');}
  var ox=SW;
  var xl=SW/2+winX-winW/2,xr=SW/2+winX+winW/2;
  var Wc=winW,xc=SW/2+winX,ka=1;
  for(var it=0;it<4;it++){
    ka=PP/(PP-SN*Wc/2);
    var kb=PP/(PP+SN*Wc/2);
    Wc=((xr-ox)/ka-(xl-ox)/kb)/CS;
    xc=ox+(xr-ox)/ka-CS*Wc/2;
  }
  winW=Math.round(Wc);

  var winCap=Math.round(winH/ka);
  var full=MV.full||[];
  var wl=Math.round(xc-Wc/2);
  var y0=-(n-1)*STEP/2;
  var sc=TW/Math.max(1,winW),mwH=Math.round((TH-2)/Math.max(.001,sc));
  var cur=mvWrap(Math.round(MV.pos));
  for(var i=0;i<n;i++){
    var C=C0[i],on=(i===cur),y=y0+i*STEP;
    if(C.w!==TW){C.w=TW;C.el.style.width=TW+'px';}
    if(C.h!==TH){C.h=TH;C.el.style.height=TH+'px';}

    var pop=on&&(!mvPhone()||(gEl&&gEl.classList.contains('mvOpen')))
              &&!(gEl&&gEl.classList.contains('txMvShut'));

    var key=(on?'1':'0')+(pop?'1':'0')+'|'+thumbX.toFixed(1)+'|'+y.toFixed(1);
    if(C.k!==key){
      C.k=key;
      C.el.style.transform='translate(-50%,-50%) translate('+thumbX.toFixed(1)+'px,'+y.toFixed(1)+'px)'
        +(pop?' translateX(-7px) translateZ(22px) rotateY(0deg)':' rotateY(-17deg)');
      C.el.classList.toggle('on',on);
      C.fr.style.filter=pop?'none':'contrast(.77) brightness(1.116)';
      if(C.win)C.win.classList.toggle('on',on);
    }

    if(C.mw&&C.mwk!==TW+'x'+TH){
      C.mwk=TW+'x'+TH;
      C.mw.style.width=winW+'px';
      C.mw.style.height=mwH+'px';
      C.mw.style.transform='scale('+sc.toFixed(4)+')';
    }

    var Hc=Math.max(160,Math.min(winCap,Math.round(full[i]||winCap)));
    var wt=Math.round(SH/2-Hc/2);
    if(C.win&&C.wk!==wl+','+wt+','+winW+','+Hc){
      C.wk=wl+','+wt+','+winW+','+Hc;
      C.win.style.left=wl+'px';C.win.style.top=wt+'px';
      C.win.style.width=winW+'px';C.win.style.height=Hc+'px';
    }
  }

  if((MV.stableN||0)>=2&&MV.box&&MV.box.classList.contains('mvBoot'))MV.box.classList.remove('mvBoot');
}
function mvLayout(){
  if(MV.mode!==2)return mvDeck();
  mvHeights();
  var R=MV.R,rot=mvRot(),DEG=180/Math.PI,T=MV.tot||6.283;
  var half=T*DEG/2;
  var fade=Math.max(12,half*.55);
  for(var i=0;i<MV.n;i++){
    var C=MV.cards[i],a=(MV.ang[i]-rot)*DEG;

    a=((a%(half*2))+half*3)%(half*2)-half;
    var aa=Math.abs(a),c=Math.cos(a*Math.PI/180);
    var hid=(aa>=half-.5||aa>78);
    C.el.style.transform=hid?'translate(-50%,-50%) scale(0)'
      :('translate(-50%,-50%) rotateX('+a.toFixed(2)+'deg) translateZ('+(-R).toFixed(1)+'px)');
    C.el.style.opacity=(hid?0:clamp01((half-aa)/fade)).toFixed(3);
    C.el.style.visibility=hid?'hidden':'visible';
    C.el.style.pointerEvents=hid?'none':'auto';

    if(!hid){
      var P0=MV.P||(R*1.3);
      var mag=P0/Math.max(1,P0-R*(1-c));
      var wq=Math.max(60,Math.round((MV.cw||C.el.clientWidth)/Math.pow(mag,.8)/2)*2);
      if(C.w!==wq){C.w=wq;C.el.style.width=wq+'px';}
      mvShell(C,wq,C.h||1,R,P0,a,true);
    }

    var th=(C.h||1)/R, lum=[], q;
    for(q=0;q<=4;q++){
      var dl=(q/4-.5)*th*180/Math.PI;
      lum.push('rgba(242,236,222,'+(0.94*(1-Math.pow(clamp01(Math.cos((a+dl)*Math.PI/180)),.9))).toFixed(3)+') '+(q*25)+'%');
    }
    C.fr.style.filter='brightness('+(.46+.54*Math.pow(clamp01(c),.7)).toFixed(3)+')';
    C.shade.style.background='linear-gradient(to bottom,'+lum.join(',')+')';
    C.shade.style.opacity='1';

    C.ghost.style.opacity=clamp01(aa/22-.5).toFixed(3);
    C.body.style.opacity=clamp01(1-aa/(half*1.25)).toFixed(3);
    C.el.classList.toggle('on',aa<6);
  }
}
function mvRailDraw(){
  var c=MV.rail,g=MV.railx;if(!g)return;

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

  var _mv=MV.drag||MV.tgt!=null||(MV.stableN||0)<3
        ||Math.abs(MV.pos-Math.round(MV.pos))>.001;
  if(!_mv){
    var _n=performance.now();
    if(_n-(MV._slow||0)<500){MV.raf=requestAnimationFrame(mvTick);return;}
    MV._slow=_n;
  }else MV._slow=0;
  if(box.clientHeight>10&&box.clientWidth>10){

    var nav=gEl.querySelector('.gNav');
    var navH=(nav&&getComputedStyle(nav).display!=='none')?'34px':'0px';
    if(MV._nav!==navH){MV._nav=navH;box.style.setProperty('--mvNav',navH);MV.w=0;}

    if(MV.stage.clientWidth!==MV.w||MV.stage.clientHeight!==MV.h){MV.stableN=0;mvSize();}
    else MV.stableN=(MV.stableN||0)+1;
    var now=performance.now();

    var dt=Math.min(80,Math.max(1,now-(MV._t||now)));MV._t=now;
    var f=dt/16.7;
    if(!MV.drag){
      if(MV.mode!==2){

        if(MV.tgt!=null){MV.pos=mvWrap(MV.tgt);MV.tgt=null;}
        else MV.pos=mvWrap(Math.round(MV.pos));
      }else{
        var t=(MV.tgt==null)?Math.round(MV.pos):MV.tgt;
        MV.pos=lerp(MV.pos,t,1-Math.pow(.82,f));
        if(Math.abs(MV.pos-t)<.002){MV.pos=mvWrap(t);MV.tgt=null;}
      }
    }
    if(now-(MV._mT||0)>600){MV._mT=now;try{mvRemeasure();}catch(_){}}
    var sel=Math.round(MV.pos);
    if(MV._sel!==sel){
      MV._sel=sel;

      try{graphHydrate();}catch(_){}
      try{zj3dTick();}catch(_){}
      try{mvRemeasure();}catch(_){}
    }
    mvLayout();mvRailDraw();
    if(REDUCED){if(!MV.bgT){MV.bgT=now;mvBgDraw(now);}}
    else if(now-MV.bgT>48){MV.bgT=now;mvBgDraw(now);}
    var ix=MV.foot.querySelector('.mvIdx');
    if(ix){var lab=pad(mvWrap(Math.round(MV.pos))+1)+'/'+pad(MV.n);if(ix.textContent!==lab)ix.textContent=lab;}
  }
  MV.raf=requestAnimationFrame(mvTick);
}
function mvStart(){if(!MV.raf)MV.raf=requestAnimationFrame(mvTick);}
function mvStop(){if(MV.raf)cancelAnimationFrame(MV.raf);MV.raf=0;}
addEventListener('resize',function(){if(MV.stage){MV.w=0;MV.h=0;}});
try{if(mvOn())mvRingMount();}catch(_){}

window.WORLD_MVU={mount:mvRingMount,stop:mvStop,setMode:function(mode){SET.mvuRing=mode;mvRingMount();},state:MV};
