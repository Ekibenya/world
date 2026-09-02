(function(){
  'use strict';

  var MAP_URL='/core/res/data/world/world-map.json';
  var cv=document.getElementById('gmapCv'),ctx=cv&&cv.getContext('2d');
  var mini=document.querySelector('#arrMap .mmap'),mctx=mini&&mini.getContext('2d');
  var DPR=Math.min(window.devicePixelRatio||1,2),W=0,H=0,raf=0,resizeObserver=null;
  var DATA=null,LANDPTS=[],ACTIVE=[],HIT=[],POINTERS={},pinch0=0,zoom0=1,mid0=null;
  var VIEW={era:1,eraName:'',layer:'surface',lon:-92*Math.PI/180,tilt:.34,zoom:1,vel:0,drag:false,lx:0,ly:0,lt:0,moved:0,mx:-1e4,my:-1e4,hover:false,selected:null};
  var ZONE_COLORS=['126,91,32','142,108,48','111,104,79','103,118,125','151,118,72','118,92,116'];
  var LEVELS=24,STYLES=[],BOXES=[];

  function $(selector){return document.querySelector(selector);}
  function esc(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function wrapLon(value){while(value>180)value-=360;while(value<-180)value+=360;return value;}
  function inEra(item){return VIEW.era>=(item.from||1)&&VIEW.era<=(item.to||99);}
  function periodFor(site){
    if(!site.periods||!site.periods.length)return site;
    for(var i=0;i<site.periods.length;i++)if(inEra(site.periods[i]))return Object.assign({},site,site.periods[i]);
    return site;
  }
  function pointInEllipse(lon,lat,e){
    var dx=wrapLon(lon-e[0]),dy=lat-e[1],a=e[2],b=e[3],r=(e[4]||0)*Math.PI/180;
    var cr=Math.cos(r),sr=Math.sin(r),x=dx*cr+dy*sr,y=-dx*sr+dy*cr;
    return x*x/(a*a)+y*y/(b*b)<=1;
  }
  function landformAt(lon,lat){
    if(!DATA)return null;
    for(var i=DATA.landforms.length-1;i>=0;i--){var f=DATA.landforms[i];if(inEra(f))for(var j=0;j<f.ellipses.length;j++)if(pointInEllipse(lon,lat,f.ellipses[j]))return f;}
    return null;
  }
  function hash(a,b){var x=Math.sin(a*127.1+b*311.7)*43758.5453;return x-Math.floor(x);}
  function buildLand(){
    LANDPTS=[];var d2r=Math.PI/180,step=.78;
    for(var lat=-90+step/2;lat<90;lat+=step){
      var count=Math.max(1,Math.round(360*Math.cos(lat*d2r)/step));
      for(var k=0;k<count;k++){
        var lon=-180+(k+.5)*360/count,form=landformAt(lon,lat);if(!form)continue;
        var la=lat*d2r;
        LANDPTS.push({sy:Math.sin(la),cl:Math.cos(la),lo:lon*d2r,br:.76+.3*hash(k*1.3,lat*2.1),zone:form.zone||1,hi:hash(k*7.7,lat*3.3)<.006});
      }
    }
  }
  function initBuckets(){
    STYLES=[];BOXES=[];
    for(var c=0;c<ZONE_COLORS.length;c++){STYLES[c]=[];BOXES[c]=[];for(var a=0;a<LEVELS;a++){STYLES[c][a]='rgba('+ZONE_COLORS[c]+','+((a+.5)/LEVELS).toFixed(4)+')';BOXES[c][a]=[];}}
  }
  function bucket(color,alpha,x,y,w,h){alpha=clamp(alpha|0,0,LEVELS-1);BOXES[color][alpha].push(x,y,w,h);}
  function flush(){
    for(var c=0;c<ZONE_COLORS.length;c++)for(var a=0;a<LEVELS;a++){var box=BOXES[c][a];if(!box.length)continue;ctx.fillStyle=STYLES[c][a];ctx.beginPath();for(var i=0;i<box.length;i+=4)ctx.rect(box[i],box[i+1],box[i+2],box[i+3]);ctx.fill();box.length=0;}
  }
  function size(){
    if(!cv)return;DPR=Math.min(window.devicePixelRatio||1,2);
    var width=cv.clientWidth,height=cv.clientHeight;if(width<4||height<4)return;
    var w=Math.round(width*DPR),h=Math.round(height*DPR);if(cv.width===w&&cv.height===h){W=w;H=h;return;}
    W=cv.width=w;H=cv.height=h;
  }
  function refreshSites(){
    if(!DATA)return;
    ACTIVE=DATA.sites.filter(function(site){return inEra(site)&&site.layer===VIEW.layer;}).map(periodFor);
    if(!ACTIVE.some(function(site){return site.id===VIEW.selected;}))VIEW.selected=ACTIVE.length?ACTIVE[0].id:null;
    renderHud();
  }
  function selectedSite(){for(var i=0;i<ACTIVE.length;i++)if(ACTIVE[i].id===VIEW.selected)return ACTIVE[i];return null;}
  function renderHud(){
    if(!DATA)return;var current=selectedSite(),detail=$('#worldMapDetail'),loose=$('#worldMapLoose'),status=$('#worldMapStatus');
    document.querySelectorAll('#worldMapLayers button').forEach(function(button){button.classList.toggle('on',button.dataset.layer===VIEW.layer);});
    if(status)status.textContent=VIEW.eraName+' · '+(VIEW.layer==='surface'?'地表与海域':'界门与异空间入口');
    if(detail)detail.innerHTML=current?'<b>'+esc(current.name)+'</b><i>'+esc(current.kind||'地点')+'</i><p>'+esc(current.summary||'')+'</p>':'<b>此时代没有可核实地点</b><p>原文没有给出可放在这一层的地点时，地图保持空白，不补造。</p>';
    var unplaced=ACTIVE.filter(function(site){return site.unplaced;});
    if(loose)loose.innerHTML=unplaced.length?'<span>方位未载</span>'+unplaced.map(function(site){return '<button type="button" data-map-site="'+esc(site.id)+'"'+(site.id===VIEW.selected?' class="on"':'')+'>'+esc(site.name)+'</button>';}).join(''):'';
    try{window.dispatchEvent(new CustomEvent('world-map-change',{detail:inspect()}));}catch(_){ }
  }
  function choose(id){VIEW.selected=id;renderHud();}
  function project(lat,lon,cx,cy,R){
    var la=lat*Math.PI/180,lo=lon*Math.PI/180,sy=Math.sin(la),cl=Math.cos(la),lam=lo-VIEW.lon;
    var xr=cl*Math.sin(lam),zr=cl*Math.cos(lam),yr=sy,ct=Math.cos(VIEW.tilt),st=Math.sin(VIEW.tilt),y=yr*ct-zr*st,z=yr*st+zr*ct;
    return {x:cx+xr*R,y:cy-y*R,z:z};
  }
  function drawGrid(cx,cy,R){
    ctx.save();ctx.strokeStyle='rgba(74,61,38,.12)';ctx.lineWidth=.7*DPR;
    [-60,-30,0,30,60].forEach(function(lat){ctx.beginPath();var open=false;for(var lon=-180;lon<=180;lon+=3){var p=project(lat,lon,cx,cy,R);if(p.z<=0){open=false;continue;}if(!open){ctx.moveTo(p.x,p.y);open=true;}else ctx.lineTo(p.x,p.y);}ctx.stroke();});
    for(var lon=-180;lon<180;lon+=30){ctx.beginPath();var open=false;for(var lat=-88;lat<=88;lat+=2){var p=project(lat,lon,cx,cy,R);if(p.z<=0){open=false;continue;}if(!open){ctx.moveTo(p.x,p.y);open=true;}else ctx.lineTo(p.x,p.y);}ctx.stroke();}
    ctx.restore();
  }
  function draw(){
    if(!ctx||!DATA)return;size();if(W<4||H<4)return;
    var game=$('#game'),mobile=window.innerWidth<=760;
    var visible=game&&game.classList.contains('show')&&(game.classList.contains('mapOpen')||(mobile&&game.getAttribute('data-pg')==='map'));
    if(!visible){if(game&&game.classList.contains('show'))drawMini();return;}
    if(!VIEW.drag){VIEW.lon+=VIEW.vel+(VIEW.hover||window.REDUCED?0:.00018);VIEW.vel*=.94;}
    var cx=W*.06,cy=H*.5,R=Math.min(H*.75,W*.9)*VIEW.zoom,ct=Math.cos(VIEW.tilt),st=Math.sin(VIEW.tilt);
    ctx.clearRect(0,0,W,H);
    var wash=ctx.createRadialGradient(cx,cy,R*.18,cx,cy,R*1.08);wash.addColorStop(0,'rgba(154,116,42,.025)');wash.addColorStop(.84,'rgba(154,116,42,.04)');wash.addColorStop(.94,'rgba(126,91,32,.18)');wash.addColorStop(1,'rgba(126,91,32,0)');ctx.fillStyle=wash;ctx.beginPath();ctx.arc(cx,cy,R*1.08,0,Math.PI*2);ctx.fill();
    drawGrid(cx,cy,R);
    for(var i=0;i<LANDPTS.length;i++){
      var p=LANDPTS[i],lam=p.lo-VIEW.lon,xr=p.cl*Math.sin(lam),zr=p.cl*Math.cos(lam),yr=p.sy,y=yr*ct-zr*st,z=yr*st+zr*ct;if(z<=0)continue;
      var x=cx+xr*R,yy=cy-y*R;if(x<-4||x>W+4||yy<-4||yy>H+4)continue;
      var rim=Math.pow(1-z,5)*.36,alpha=Math.min(1,(.12+.54*z)*p.br+rim),dot=(p.hi?1.85:1.08)*DPR*(.76+.38*z),color=clamp((p.zone||1)-1,0,ZONE_COLORS.length-1);
      bucket(color,(alpha*LEVELS)|0,x-dot/2,yy-dot/2,dot,dot);
    }
    flush();HIT.length=0;var plotted=[];
    ACTIVE.forEach(function(site){if(site.unplaced||site.lat==null||site.lon==null)return;var p=project(site.lat,site.lon,cx,cy,R);if(p.z<=.08||p.x<0||p.x>W||p.y<0||p.y>H)return;plotted.push({site:site,x:p.x,y:p.y,z:p.z});});
    var hover=null,best=46*DPR;plotted.forEach(function(item){var d=Math.hypot(VIEW.mx*DPR-item.x,VIEW.my*DPR-item.y);if(d<best){best=d;hover=item;}});
    var boxes=[];ctx.textBaseline='middle';
    plotted.sort(function(a,b){return (a.site.id===VIEW.selected?1:0)-(b.site.id===VIEW.selected?1:0);});
    plotted.forEach(function(item){
      var chosen=item.site.id===VIEW.selected,hot=hover===item,r=(chosen?6:hot?5:3.5)*DPR;
      ctx.strokeStyle=chosen?'rgba(122,78,0,.95)':'rgba(126,91,32,.72)';ctx.lineWidth=(chosen?1.5:1)*DPR;ctx.beginPath();ctx.arc(item.x,item.y,r,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle=chosen?'rgba(93,54,0,1)':'rgba(126,91,32,.9)';ctx.fillRect(item.x-DPR,item.y-DPR,2*DPR,2*DPR);
      ctx.font=(11*DPR)+'px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';var tw=ctx.measureText(item.site.name).width,b={x0:item.x+7*DPR,y0:item.y-8*DPR,x1:item.x+12*DPR+tw,y1:item.y+9*DPR};
      var collision=boxes.some(function(other){return b.x0<other.x1&&b.x1>other.x0&&b.y0<other.y1&&b.y1>other.y0;});
      if(chosen||hot||!collision){boxes.push(b);ctx.save();ctx.shadowColor='rgba(242,236,222,.95)';ctx.shadowBlur=4*DPR;ctx.fillStyle=chosen?'rgba(76,43,0,1)':'rgba(45,42,34,.9)';ctx.fillText(item.site.name,item.x+9*DPR,item.y);ctx.restore();HIT.push({id:item.site.id,x:item.x/DPR,y:item.y/DPR,b:{x0:b.x0/DPR-3,y0:b.y0/DPR-4,x1:b.x1/DPR+3,y1:b.y1/DPR+4}});}else HIT.push({id:item.site.id,x:item.x/DPR,y:item.y/DPR});
    });
    try{window.__WORLD_MAP_HIT__=HIT;}catch(_){ }
    drawMini();
  }
  function drawMini(){
    if(!mctx||!mini)return;var w=mini.width,h=mini.height,cx=w*.5,cy=h*.5,R=Math.min(w,h)*.38;mctx.clearRect(0,0,w,h);mctx.strokeStyle='rgba(126,91,32,.35)';mctx.beginPath();mctx.arc(cx,cy,R,0,Math.PI*2);mctx.stroke();
    mctx.fillStyle='rgba(126,91,32,.55)';for(var i=0;i<LANDPTS.length;i+=28){var p=LANDPTS[i],lam=p.lo-VIEW.lon,xr=p.cl*Math.sin(lam),zr=p.cl*Math.cos(lam),yr=p.sy,y=yr*Math.cos(VIEW.tilt)-zr*Math.sin(VIEW.tilt),z=yr*Math.sin(VIEW.tilt)+zr*Math.cos(VIEW.tilt);if(z>0)mctx.fillRect(cx+xr*R,cy-y*R,1,1);}
  }
  function frame(){draw();raf=requestAnimationFrame(frame);}
  function localPoint(event){var rect=cv.getBoundingClientRect();return {x:(event.clientX-rect.left)*cv.clientWidth/Math.max(rect.width,1),y:(event.clientY-rect.top)*cv.clientHeight/Math.max(rect.height,1)};}
  function pointerKeys(){return Object.keys(POINTERS);}
  function pointerDistance(){var keys=pointerKeys(),a=POINTERS[keys[0]],b=POINTERS[keys[1]];return Math.hypot(a.x-b.x,a.y-b.y);}
  function pointerMid(){var keys=pointerKeys(),a=POINTERS[keys[0]],b=POINTERS[keys[1]];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
  function bind(){
    if(!cv)return;
    cv.addEventListener('pointerdown',function(event){POINTERS[event.pointerId]={x:event.clientX,y:event.clientY};if(pointerKeys().length===2){VIEW.drag=false;VIEW.vel=0;pinch0=pointerDistance();zoom0=VIEW.zoom;mid0=pointerMid();return;}VIEW.drag=true;VIEW.moved=0;VIEW.lx=event.clientX;VIEW.ly=event.clientY;VIEW.lt=performance.now();if(cv.setPointerCapture)try{cv.setPointerCapture(event.pointerId);}catch(_){}});
    cv.addEventListener('pointerleave',function(){VIEW.hover=false;VIEW.mx=-1e4;VIEW.my=-1e4;});
    cv.addEventListener('wheel',function(event){event.preventDefault();event.stopPropagation();VIEW.zoom=clamp(VIEW.zoom*Math.exp(-event.deltaY*.0012),.72,2.6);},{passive:false});
    cv.addEventListener('pointermove',function(event){var lp=localPoint(event);VIEW.mx=lp.x;VIEW.my=lp.y;VIEW.hover=true;if(POINTERS[event.pointerId])POINTERS[event.pointerId]={x:event.clientX,y:event.clientY};if(pointerKeys().length>=2){if(pinch0>0)VIEW.zoom=clamp(zoom0*pointerDistance()/pinch0,.72,2.6);var m=pointerMid();if(mid0){VIEW.lon-=(m.x-mid0.x)*.005/VIEW.zoom;VIEW.tilt=clamp(VIEW.tilt+(m.y-mid0.y)*.0035/VIEW.zoom,-1.25,1.35);}mid0=m;return;}if(!VIEW.drag)return;var dx=event.clientX-VIEW.lx,dy=event.clientY-VIEW.ly;VIEW.lx=event.clientX;VIEW.ly=event.clientY;var now=performance.now(),dt=now-(VIEW.lt||now);VIEW.lt=now;VIEW.lon-=dx*.005/VIEW.zoom;VIEW.vel=clamp((-dx*.005/VIEW.zoom)*(16.7/Math.max(dt,8)),-.02,.02);VIEW.tilt=clamp(VIEW.tilt+dy*.0035/VIEW.zoom,-1.25,1.35);VIEW.moved+=Math.abs(dx)+Math.abs(dy);});
    function release(event){delete POINTERS[event.pointerId];if(pointerKeys().length<2){pinch0=0;mid0=null;}}
    cv.addEventListener('pointercancel',release);
    cv.addEventListener('pointerup',function(event){release(event);if(!VIEW.drag)return;VIEW.drag=false;if(VIEW.moved>=5)return;VIEW.vel=0;var p=localPoint(event),best=null,distance=28;for(var i=0;i<HIT.length;i++){var hit=HIT[i];if(hit.b&&p.x>=hit.b.x0&&p.x<=hit.b.x1&&p.y>=hit.b.y0&&p.y<=hit.b.y1){best=hit;break;}var d=Math.hypot(p.x-hit.x,p.y-hit.y);if(d<distance){distance=d;best=hit;}}if(best)choose(best.id);});
    var layers=$('#worldMapLayers');if(layers)layers.addEventListener('click',function(event){var button=event.target.closest('[data-layer]');if(!button)return;VIEW.layer=button.dataset.layer;refreshSites();});
    var loose=$('#worldMapLoose');if(loose)loose.addEventListener('click',function(event){var button=event.target.closest('[data-map-site]');if(button)choose(button.dataset.mapSite);});
    if(window.ResizeObserver){resizeObserver=new ResizeObserver(size);resizeObserver.observe(cv);}else window.addEventListener('resize',size);
  }
  function render(input){
    var era=input&&input.era?input.era:input;if(era){VIEW.era=Number(era.ordinal)||1;VIEW.eraName=era.name||'';}
    if(DATA){buildLand();refreshSites();size();}
  }
  function inspect(){return {ready:!!DATA,era:VIEW.era,eraName:VIEW.eraName,layer:VIEW.layer,landPoints:LANDPTS.length,activeSites:ACTIVE.map(function(site){return site.name;}),selected:VIEW.selected,hitCount:HIT.length,zoom:Number(VIEW.zoom.toFixed(3)),longitude:Number((VIEW.lon*180/Math.PI).toFixed(2)),tilt:Number((VIEW.tilt*180/Math.PI).toFixed(2)),cartography:DATA&&DATA.cartography};}

  initBuckets();bind();
  fetch(MAP_URL).then(function(response){if(!response.ok)throw new Error('世界地图资料读取失败（'+response.status+'）');return response.json();}).then(function(data){DATA=data;buildLand();refreshSites();size();if(!raf)frame();}).catch(function(error){var detail=$('#worldMapDetail');if(detail)detail.innerHTML='<b>地图没有载入</b><p>'+esc(error.message)+'</p>';});
  window.WORLD_PLANET_MAP={render:render,inspect:inspect,select:choose,setLayer:function(layer){if(layer==='surface'||layer==='gateway'){VIEW.layer=layer;refreshSites();}},destroy:function(){if(raf)cancelAnimationFrame(raf);raf=0;if(resizeObserver)resizeObserver.disconnect();}};
})();
