var ES={on:false,i:0,line:null,rows:[],pls:[],pips:[],bands:[]};

function esRows(){return window.WORLD_ANNALS||[];}
function esHas(line){return esRows(line).length>0;}

function esBuild(){
  var tr=$('#esTrack'),bd=$('#esBands'),pp=$('#esPips'),k;
  tr.innerHTML='';bd.innerHTML='';pp.innerHTML='';
  ES.pls=[];ES.pips=[];ES.bands=[];
  for(k=0;k<ES.rows.length;k++){
    (function(n){
      var d=ES.rows[n];
      var b=document.createElement('button');
      b.className='pl';b.type='button';
      b.setAttribute('aria-label',(d.y||'卷首')+' '+d.t);
      b.innerHTML='<img alt="" decoding="async">';
      if((d.r||1.5)<1)b.classList.add('tall');

      b.addEventListener('pointerup',function(){
        if(ES.moved>ES.dead)return;
        if(n!==ES.i){esGo(n);return;}
        esEngage();
      });
      tr.appendChild(b);ES.pls.push(b);
      var p=document.createElement('button');
      p.className='pip'+((n===0||ES.rows[n-1].era!==d.era)?' mark':'');
      p.type='button';p.setAttribute('aria-label',(d.y||'卷首')+' '+d.t);
      var jt=esJit(n);
      p.innerHTML='<i style="background-image:url('+esMini(d.src)+');'
        +'--jr:'+jt[0]+'deg;--jx:'+jt[1]+'px;--jy:'+jt[2]+'px;--js:'+jt[3]
        +'"></i><b>'+(d.y||'卷首')+'</b>';
      p.addEventListener('pointerup',function(){esGo(n);});
      pp.appendChild(p);ES.pips.push(p);
    })(k);
  }
  var g=[];
  for(k=0;k<ES.rows.length;k++){
    if(g.length&&g[g.length-1].era===ES.rows[k].era)g[g.length-1].n++;
    else g.push({era:ES.rows[k].era,n:1});
  }
  for(k=0;k<g.length;k++){
    var e=document.createElement('div');
    e.style.flex=g[k].n+' 1 0';
    var eb=document.createElement('b');eb.textContent=g[k].era;e.appendChild(eb);
    bd.appendChild(e);g[k].el=e;
  }
  ES.bands=g;
  esBarBuild();
}
function esNarrow(){try{return innerWidth<=760;}catch(_){return false;}}

function esBarBuild(){
  var bar=$('#esBar');if(!bar)return;
  bar.innerHTML='';ES.bar=[];
  for(var k=0;k<ES.rows.length;k++)(function(n){
    var d=ES.rows[n];
    var b=document.createElement('button');
    b.className='esCell'+(((d.r||1.5)<1)?' tall':'');
    b.type='button';
    b.setAttribute('aria-label',(d.y||'卷首')+' '+d.t);
    b.innerHTML='<img alt="" decoding="async">';

    b.addEventListener('click',function(e){
      e.stopPropagation();
      if(ES.moved>ES.dead)return;
      if(n!==ES.i)esGo(n);
    });
    bar.appendChild(b);ES.bar.push(b);
  })(k);

  var _t=0;
  bar.addEventListener('scroll',function(){
    if(_t)return;
    _t=requestAnimationFrame(function(){_t=0;esBarLoad();});
  },{passive:true});
}
function esBarLoad(){
  var bar=$('#esBar');if(!bar||!ES.bar||!ES.bar.length)return;
  var w=bar.clientWidth||innerWidth,sl=bar.scrollLeft;
  var lo=sl-w*0.3,hi=sl+w*1.3;
  for(var k=0;k<ES.bar.length;k++){
    var c=ES.bar[k],im=c.firstChild;if(!im)continue;
    var x=c.offsetLeft,x2=x+c.offsetWidth;
    if(x2>=lo&&x<=hi){
      var want=esPrev(ES.rows[k].src);
      if(im.getAttribute('src')!==want)im.setAttribute('src',want);
    }else if(im.getAttribute('src'))im.removeAttribute('src');
  }
}

function esBarSync(){
  var bar=$('#esBar');if(!bar||!ES.bar||!ES.bar.length)return;
  for(var k=0;k<ES.bar.length;k++)ES.bar[k].classList.toggle('on',k===ES.i);
  if(!esNarrow())return;
  var c=ES.bar[ES.i];if(!c)return;
  var br=bar.getBoundingClientRect(),cr=c.getBoundingClientRect();
  if(br.width<8)return;
  var to=bar.scrollLeft+(cr.left-br.left)-(br.width-cr.width)/2;
  to=Math.max(0,Math.min(to,bar.scrollWidth-bar.clientWidth));
  try{bar.scrollTo({left:to,behavior:'smooth'});}catch(_){bar.scrollLeft=to;}
  esBarLoad();
}

function esThumb(s){return String(s);}

function esPrev(s){return String(s);}

function esMini(s){return String(s);}

function esJit(n){
  var f=function(k){var x=Math.sin((n+1)*12.9898+k*78.233)*43758.5453;return x-Math.floor(x)-0.5;};
  return [(f(1)*3.6).toFixed(2),(f(2)*2.0).toFixed(2),(f(3)*1.1).toFixed(2),
          (1+f(4)*0.10).toFixed(3)];
}
function esLoad(){
  var k,d,im,th;
  for(k=0;k<ES.rows.length;k++){
    im=ES.pls[k].firstChild;if(!im)continue;
    d=ES.rows[k];th=esPrev(d.src);
    if(im.getAttribute('alt')!==d.t)im.setAttribute('alt',d.t);
    if(Math.abs(k-ES.i)>6){

      if(im.getAttribute('src')){im._want=null;im.removeAttribute('src');}
      continue;
    }
    if(k!==ES.i){

      im._want=th;
      if(im.getAttribute('src')!==th)im.setAttribute('src',th);
      continue;
    }
    im._want=d.src;

    var cur=im.getAttribute('src'),pv=esPrev(d.src);
    if(cur!==d.src&&cur!==pv)im.setAttribute('src',pv);
    if(im.getAttribute('src')===d.src)continue;

    clearTimeout(esLoad._t);
    esLoad._t=setTimeout(function(){
      var j=ES.i,img=ES.pls[j]&&ES.pls[j].firstChild,full=ES.rows[j]&&ES.rows[j].src;
      if(!img||!full||img._want!==full||img.getAttribute('src')===full)return;
      var pre=new Image();
      pre.decoding='async';
      pre.onload=function(){

        var go=function(){if(img._want===full)img.setAttribute('src',full);};
        if(pre.decode)pre.decode().then(go,go);else go();
      };
      pre.src=full;
    },240);
  }
}

function esLayout(){
  var reel=$('#esReel'),h=reel.clientHeight||420;
  var nar=esNarrow(),narrow=92,gap=6;

  if(nar)gap=Math.round(innerWidth*0.10);

  var _tr=$('#esTrack');
  if(_tr&&_tr._gap!==gap){_tr._gap=gap;_tr.style.gap=gap+'px';}

  var maxW=(nar?innerWidth:innerWidth*0.62),before=0,k,w,wi,hi=h;

  var r=ES.rows[ES.i].r||1.5;
  wi=h*r;
  if(wi>maxW){wi=maxW;hi=maxW/r;}

  for(k=0;k<ES.pls.length;k++){
    var el=ES.pls[k];
    var hh;
    if(k===ES.i){w=wi;hh=hi;}
    else if(nar){
      var rk=ES.rows[k].r||1.5,wk=h*rk,hk=h;
      if(wk>maxW){wk=maxW;hk=maxW/rk;}
      w=wk;hh=hk;
    }else{w=narrow;hh=h;}
    if(el._w!==w){el._w=w;el.style.width=w+'px';}
    if(el._h!==hh){el._h=hh;el.style.height=hh+'px';}
    if(k<ES.i)before+=w+gap;
  }
  $('#esTrack').style.transform='translateX('+(-(before+wi/2-reel.clientWidth/2))+'px)';

  var m=$('#esMission'),rr=reel.getBoundingClientRect();
  var pb=rr.top+rr.height/2+hi/2;
  if(!nar){
    m.style.left=Math.round(rr.left+rr.width/2-wi/2+26)+'px';
    m.style.bottom=Math.round(innerHeight-pb+24)+'px';
  }else{

    m.style.left=Math.round(Math.max(10,rr.left+rr.width/2-wi/2+10))+'px';
    m.style.bottom=Math.round(innerHeight-pb+12)+'px';
  }
}

function esChronFit(){
  if(!ES.bands||!ES.bands.length||!ES.pips.length)return;
  var k,j,n=0;
  for(k=0;k<ES.bands.length;k++){
    var w=ES.bands[k].el.getBoundingClientRect().width/ES.bands[k].n;
    if(!(w>0))return;
    for(j=0;j<ES.bands[k].n;j++,n++)ES.pips[n].style.flex='0 0 '+w+'px';
  }
}
function esThin(){

  var k,act=null,edge=-1e9,rects=[],hush=[];
  for(k=0;k<ES.pips.length;k++)ES.pips[k].classList.remove('hush');
  for(k=0;k<ES.pips.length;k++){
    var bb=ES.pips[k].querySelector('b');
    rects[k]=bb?bb.getBoundingClientRect():null;
  }
  act=rects[ES.i]||null;
  for(k=0;k<ES.pips.length;k++){
    if(k===ES.i||!ES.pips[k].classList.contains('mark'))continue;
    var r=rects[k];if(!r)continue;
    if(act&&r.left<act.right+10&&r.right>act.left-10){hush.push(k);continue;}
    if(r.left<edge+10){hush.push(k);continue;}
    edge=r.right;
  }
  for(k=0;k<hush.length;k++)ES.pips[hush[k]].classList.add('hush');
}

function esRender(){
  var d=ES.rows[ES.i],k;
  for(k=0;k<ES.pls.length;k++)ES.pls[k].classList.toggle('on',k===ES.i);
  for(k=0;k<ES.pips.length;k++)ES.pips[k].classList.toggle('on',k===ES.i);
  for(k=0;k<ES.bands.length;k++)ES.bands[k].el.classList.toggle('live',ES.bands[k].era===d.era);
  $('#esNum').textContent=(ES.i<9?'0':'')+(ES.i+1);
  var t=$('#esTtl');t.innerHTML='';
  var a=document.createElement('span');a.textContent=d.t;t.appendChild(a);
  if(d.y){var b=document.createElement('span');b.textContent=d.y;t.appendChild(b);}
  $('#esEra').textContent=d.s||'';
  esLoad();esLayout();esChronFit();esThin();esBarSync();
}
function esGo(n){
  if(n<0)n=0;if(n>ES.rows.length-1)n=ES.rows.length-1;
  ES.i=n;esRender();
}
function esOpen(line){
  ES.line=line;ES.rows=esRows(line);ES.i=0;
  esBuild();$('#eraSel').classList.add('on');ES.on=true;
  esRender();setTimeout(function(){esLayout();esChronFit();esThin();},60);
}
function esClose(){
  ES.on=false;$('#eraSel').classList.remove('on');

  for(var _i=0;_i<ES.pls.length;_i++){
    var _im=ES.pls[_i]&&ES.pls[_i].firstChild;
    if(_im&&_im.getAttribute('src')){_im._want=null;_im.removeAttribute('src');}
  }
}
function esEngage(){
  if(!ES.on)return;
  var d=ES.rows[ES.i];

  if(!d||d.i==null||d.i<=0)return;

  try{
    if(window.FELERA){FELERA.ask(d,function(){esEnter(d);},null);return;}
  }catch(_){}
  esEnter(d);
}
function esEnter(d){esClose();if(window.WORLD_UI)window.WORLD_UI.enterEra(d);}
function esBackToLines(){esClose();if(window.WORLD_UI)window.WORLD_UI.showMenu();}

(function(){

  var el=$('#eraSel');

  function esStep(){return esNarrow()?Math.max(150,Math.round(innerWidth*0.5)):150;}
  ES.dead=14;ES.drag=null;ES.moved=0;
  el.addEventListener('pointerdown',function(e){
    if(e.button!==undefined&&e.button!==0)return;

    if(e.target.closest&&(e.target.closest('#esFoot')||e.target.closest('#esChron')
                        ||e.target.closest('#esBar')))return;
    ES.drag={x:e.clientX,i:ES.i,live:false};ES.moved=0;
  });

  addEventListener('pointermove',function(e){
    var d=ES.drag;if(!d)return;
    ES.moved=Math.max(ES.moved,Math.abs(e.clientX-d.x));
    if(!d.live){
      if(ES.moved<ES.dead)return;
      d.live=true;d.x=e.clientX;return;
    }
    var step=Math.round((d.x-e.clientX)/esStep());
    if(d.i+step!==ES.i)esGo(d.i+step);
  });
  function up(){ES.drag=null;setTimeout(function(){ES.moved=0;},0);}
  addEventListener('pointerup',up);addEventListener('pointercancel',up);
  addEventListener('keydown',function(e){
    if(!ES.on)return;
    var k=e.key;
    if(k==='ArrowRight'||k==='d'||k==='D'){esGo(ES.i+1);e.preventDefault();}
    else if(k==='ArrowLeft'||k==='a'||k==='A'){esGo(ES.i-1);e.preventDefault();}
    else if(k==='Home'){esGo(0);e.preventDefault();}
    else if(k==='End'){esGo(ES.rows.length-1);e.preventDefault();}
    else if(k==='Enter'){esEngage();e.preventDefault();}
    else if(k==='Escape'){esBackToLines();e.preventDefault();}
  });
  addEventListener('resize',function(){if(ES.on){esLayout();esChronFit();esThin();}});

  $('#esBack').addEventListener('pointerup',function(){esBackToLines();});
})();
window.esOpen=esOpen;window.esClose=esClose;window.esGo=esGo;window.esRender=esRender;window.ES=ES;
