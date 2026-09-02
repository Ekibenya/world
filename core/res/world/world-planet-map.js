var GB_COLS=['255,64,50','240,208,132','255,184,72','212,166,72',
             '232,192,100',   /* 4 艾尔加德帝国 */
             '188,138,74',    /* 5 克拉默施塔特自由都市同盟 */
             '214,208,190',   /* 6 柯尼希斯霍夫教皇领 */
             '140,158,180',   /* 7 北马尔克大公领 */
             '178,104,138',   /* 8 梅尔卡托港市 */
             '124,140,132',   /* 9 北境边伯领 */
             '150,146,140',   /* 10 雾底下的陆 */
             '186,190,202'];  /* 11 雾 */
var GB_N=32;                       /* 档数：32 档，取桶中值，肉眼与连续值无从分辨 */
var GB_STYLE=[],GB_BOX=[];
(function(){
  for(var c=0;c<GB_COLS.length;c++){
    GB_STYLE[c]=[];GB_BOX[c]=[];
    for(var a=0;a<GB_N;a++){
      GB_STYLE[c][a]='rgba('+GB_COLS[c]+','+((a+.5)/GB_N).toFixed(4)+')';
      GB_BOX[c][a]=[];
    }
  }
})();
function GB_push(c,a,x,y,w,h){
  if(a<0)a=0;else if(a>GB_N-1)a=GB_N-1;
  var b=GB_BOX[c][a];b.push(x,y,w,h);
}
function GB_flush(g){
  for(var c=0;c<GB_COLS.length;c++)for(var a=0;a<GB_N;a++){
    var b=GB_BOX[c][a];
    if(!b.length)continue;
    g.fillStyle=GB_STYLE[c][a];
    g.beginPath();
    for(var i=0;i<b.length;i+=4)g.rect(b[i],b[i+1],b[i+2],b[i+3]);
    g.fill();
    b.length=0;
  }
}
var GAME={on:false,mapOpen:false,armOpen:false,place:null,dest:null,lon:-46*Math.PI/180,vel:0,drag:false,
          lx:0,moved:0,mx:-1e4,my:-1e4,hit:[]};
var gEl=$('#game'),gmCv=$('#gmapCv'),gmc=gmCv.getContext('2d');
var gmW=0,gmH=0;
/* 面板斜了之后 getBoundingClientRect 给的是投影后的外接框，比真尺寸小一圈；
   拿它定画布分辨率会让整张地图糊掉。clientWidth/Height 是布局值，不受变换影响。 */
function gmapSize(){
  var cw=gmCv.clientWidth,chh=gmCv.clientHeight;
  if(cw<4)return;
  var w=Math.round(cw*DPR),h=Math.round(chh*DPR);
  if(gmCv.width===w&&gmCv.height===h)return;
  gmW=gmCv.width=w;gmH=gmCv.height=h;}
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
/* half-globe map: the sphere hangs off the panel's left edge; drag to roll it */
function gmapDraw(){
  if(gmW<4){gmapSize();if(gmW<4)return;}
  if(!GAME.drag){GAME.lon+=GAME.vel+((REDUCED||GAME.hov)?0:.00022);GAME.vel*=.94;}
  var cx=gmW*.04,cy=gmH*.5,R=Math.min(gmH*.72,gmW*.98)*(GAME.zoom||1);
  var lonC=GAME.lon,tilt=(GAME.tilt==null?.42:GAME.tilt),ctl=Math.cos(tilt),stl=Math.sin(tilt);
  var cs=Math.cos(lonC),sn=Math.sin(lonC);
  gmc.clearRect(0,0,gmW,gmH);
  var hg=gmc.createRadialGradient(cx,cy,0,cx,cy,R*1.12);
  hg.addColorStop(0,'rgba(255,148,38,0)');
  hg.addColorStop(.86,'rgba(255,148,38,0)');
  hg.addColorStop(.905,'rgba(255,148,38,.18)');
  hg.addColorStop(1,'rgba(255,148,38,0)');
  gmc.fillStyle=hg;gmc.beginPath();gmc.arc(cx,cy,R*1.12,0,Math.PI*2);gmc.fill();
  for(var i=0;i<LANDPTS.length;i++){
    var p=LANDPTS[i],lam=p.lo-lonC;
    var Xr=p.cl*Math.sin(lam),Zr=p.cl*Math.cos(lam),Yr=p.sy;
    var Y2=Yr*ctl-Zr*stl,Z2=Yr*stl+Zr*ctl;
    if(Z2<=0)continue;
    var sx=cx+Xr*R,sy2=cy-Y2*R;
    if(sx<-4||sx>gmW+4)continue;
    if(p.fog){
      var fs=5.6*DPR;
      GB_push(11,(p.fog*(.09+.18*Z2)*GB_N)|0,sx-fs/2,sy2-fs/2,fs,fs);
    }else if(p.dim){
      var ds=1.1*DPR*(.75+.4*Z2);
      GB_push(10,((.14+.26*Z2)*GB_N)|0,sx,sy2,ds,ds);
    }else if(p.st){
      var sr=1.6*DPR*(.8+.35*Z2);
      GB_push(3+p.st,((.5+.5*Z2)*GB_N)|0,sx,sy2,sr,sr);
    }else if(p.hi){
      var ah2=Math.min(1,(.2+.6*Z2)*1.4);
      GB_push(1,(ah2*GB_N)|0,sx-1*DPR,sy2-1*DPR,2.6*DPR,2.6*DPR);
    }else{
      var rim=Math.pow(1-Z2,5)*.38,a=Math.min(1,(.10+.5*Z2)*p.br+rim);
      var s=1.15*DPR*(.75+.4*Z2);
      GB_push(rim>.12?2:3,(a*GB_N)|0,sx,sy2,s,s);
    }
  }
  GB_flush(gmc);
  GAME.hit.length=0;
  gmc.textBaseline='middle';
  var vis=[],hovI=-1,hb=52;
  for(var si=0;si<ERA.act.length;si++){
    var st=ERA.act[si],lam2=st.lo-lonC;
    var Xs=st.cl*Math.sin(lam2),Zs=st.cl*Math.cos(lam2),Ys=st.sy;
    var Ym=Ys*ctl-Zs*stl,Zm=Ys*stl+Zs*ctl;
    if(Zm<=.10)continue;
    var mx=cx+Xs*R,my=cy-Ym*R;
    if(mx<0||mx>gmW)continue;
    vis.push({s:st,i:si,x:mx,y:my});
  }
  for(var vi=0;vi<vis.length;vi++){
    var d0=Math.hypot(GAME.mx-vis[vi].x/DPR,GAME.my-vis[vi].y/DPR);
    if(d0<hb){hb=d0;hovI=vis[vi].i;}
  }
  var boxes=[];
  function coll(b){for(var k=0;k<boxes.length;k++){var o=boxes[k];
    if(b.x0<o.x1&&b.x1>o.x0&&b.y0<o.y1&&b.y1>o.y0)return true;}return false;}
  var prev=GAME.lblPrev||{},shown={};
  vis.sort(function(a,b){return (prev[b.s.n]?1:0)-(prev[a.s.n]?1:0);});
  for(var vj=0;vj<vis.length;vj++){
    var V=vis[vj],st2=V.s,mx2=V.x,my2=V.y,hov=V.i===hovI;
    gmc.fillStyle=hov?'rgba(255,222,150,1)':'rgba(240,208,132,.95)';
    var ms=(hov?2.8:2.0)*DPR;
    gmc.fillRect(mx2-ms/2,my2-ms/2,ms,ms);
    var isDest=GAME.dest===st2.n;
    if(isDest){
      var pu=1+.18*Math.sin(performance.now()*.004);
      gmc.strokeStyle='rgba(255,208,104,.95)';gmc.lineWidth=1.6*DPR;
      gmc.beginPath();gmc.arc(mx2,my2,12*DPR*pu,0,Math.PI*2);gmc.stroke();
      gmc.strokeStyle='rgba(212,166,72,.5)';gmc.lineWidth=1;
      gmc.beginPath();gmc.arc(mx2,my2,17*DPR*pu,0,Math.PI*2);gmc.stroke();
    }else{
      gmc.strokeStyle=hov?'rgba(255,208,104,.9)':'rgba(212,166,72,.5)';gmc.lineWidth=1;
      gmc.beginPath();gmc.arc(mx2,my2,(hov?6:4)*DPR,0,Math.PI*2);gmc.stroke();
    }
    gmc.font=(10.5*DPR)+'px ui-monospace,Menlo,monospace';
    var lw=Math.max(gmc.measureText(st2.n).width,st2.cn.length*12*DPR);
    var bx={x0:mx2+6*DPR,y0:my2-12*DPR,x1:mx2+13*DPR+lw,y1:my2+18*DPR};
    if(hov||!coll(bx)){
      boxes.push(bx);
      gmc.save();
      gmc.shadowColor='rgba(0,0,0,.95)';gmc.shadowBlur=4*DPR;
      gmc.fillStyle=hov?'rgba(255,236,190,1)':'rgba(232,232,228,.92)';
      gmc.fillText(st2.n,mx2+9*DPR,my2-6*DPR);
      gmc.font=(12*DPR)+'px "PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",system-ui,sans-serif';
      gmc.fillStyle=hov?'rgba(255,214,120,1)':'rgba(224,206,168,.95)';
      gmc.fillText(st2.cn,mx2+9*DPR,my2+8*DPR);
      gmc.restore();
      shown[st2.n]=1;
      GAME.hit.push({x:mx2/DPR,y:my2/DPR,i:V.i,
        b:{x0:bx.x0/DPR-4,y0:bx.y0/DPR-2,x1:bx.x1/DPR+4,y1:bx.y1/DPR+2}});
      continue;
    }
    GAME.hit.push({x:mx2/DPR,y:my2/DPR,i:V.i});
  }
  GAME.lblPrev=shown;
  try{window.__MAPHIT=GAME.hit;}catch(_){}   /* 可观测：测试用命中表 */
}
var GMP={},gmPin0=0,gmZoom0=1,gmMid0=null;   /* 多指登记：双指=捏合缩放+平移 */
function gmPts(){return Object.keys(GMP);}
function gmDist(){var k=gmPts();var a=GMP[k[0]],b=GMP[k[1]];return Math.hypot(a.x-b.x,a.y-b.y);}
function gmMid(){var k=gmPts();var a=GMP[k[0]],b=GMP[k[1]];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
/* 面板一斜，「clientX − rect.left」这个线性映射就废了：外接框是投影后的，
   而画布上的点还被透视除过一道，边上能差二三十像素——城池点半径才八到十一，
   悬停会高亮错、点击会点空。这里按元素自己的变换矩阵反解回本地坐标。
     局部点 (u,v,0,1) 经矩阵 M 得 (X,Y,Z,W)，屏幕点是 (X/W, Y/W)。
     展开成两个未知数的线性方程组，2×2 直接解：
       (m11 − sx·m14)·u + (m21 − sx·m24)·v = sx·m44 − m41
       (m12 − sy·m14)·u + (m22 − sy·m24)·v = sy·m44 − m42
   不写死角度与透视值，改哪个数都不用回来同步。 */
function gmLocal(e){
  var pn=document.getElementById('pnMap');
  if(!pn){var r0=gmCv.getBoundingClientRect();return {x:e.clientX-r0.left,y:e.clientY-r0.top};}
  var tf='';
  try{tf=getComputedStyle(pn).transform||'';}catch(_){}
  if(!tf||tf==='none'||tf.indexOf('matrix')<0){
    var r1=gmCv.getBoundingClientRect();return {x:e.clientX-r1.left,y:e.clientY-r1.top};
  }
  var m;
  try{m=new DOMMatrix(tf);}catch(_){m=null;}
  if(!m){var r2=gmCv.getBoundingClientRect();return {x:e.clientX-r2.left,y:e.clientY-r2.top};}
  var gr=gEl.getBoundingClientRect();
  var W=pn.offsetWidth,H=pn.offsetHeight;
  var ox=gr.left+pn.offsetLeft+W/2,oy=gr.top+pn.offsetTop+H/2;   /* 变换原点：面板未变换时的中心 */
  var sx=e.clientX-ox,sy=e.clientY-oy;
  var a11=m.m11-sx*m.m14,a12=m.m21-sx*m.m24,b1=sx*m.m44-m.m41;
  var a21=m.m12-sy*m.m14,a22=m.m22-sy*m.m24,b2=sy*m.m44-m.m42;
  var det=a11*a22-a12*a21;
  if(!det||!isFinite(det)){var r3=gmCv.getBoundingClientRect();return {x:e.clientX-r3.left,y:e.clientY-r3.top};}
  var u=(b1*a22-a12*b2)/det,v=(a11*b2-b1*a21)/det;
  return {x:u+W/2-gmCv.offsetLeft,y:v+H/2-gmCv.offsetTop};
}
gmCv.addEventListener('pointerdown',function(e){
  GMP[e.pointerId]={x:e.clientX,y:e.clientY};
  if(gmPts().length===2){
    GAME.drag=false;GAME.vel=0;
    gmPin0=gmDist();gmZoom0=GAME.zoom||1;gmMid0=gmMid();
    return;
  }
  GAME.drag=true;GAME.moved=0;GAME.lx=e.clientX;GAME.ly=e.clientY;GAME.lt=performance.now();
  if(gmCv.setPointerCapture)try{gmCv.setPointerCapture(e.pointerId);}catch(_){}
});
gmCv.addEventListener('pointerleave',function(){GAME.hov=false;GAME.mx=-1e4;GAME.my=-1e4;});
gmCv.addEventListener('wheel',function(e){
  e.preventDefault();e.stopPropagation();
  GAME.zoom=Math.max(.7,Math.min(4,(GAME.zoom||1)*Math.exp(-e.deltaY*.0012)));
},{passive:false});
gmCv.addEventListener('pointermove',function(e){
  var lp=gmLocal(e);
  GAME.mx=lp.x;GAME.my=lp.y;GAME.hov=true;
  if(GMP[e.pointerId])GMP[e.pointerId]={x:e.clientX,y:e.clientY};
  if(gmPts().length>=2){                        /* 双指：捏合缩放 + 中点平移 */
    if(gmPin0>0)GAME.zoom=Math.max(.7,Math.min(4,gmZoom0*gmDist()/gmPin0));
    var mid=gmMid();
    if(gmMid0){
      GAME.lon-=(mid.x-gmMid0.x)*.005/(GAME.zoom||1);
      GAME.tilt=Math.max(-1.25,Math.min(1.35,(GAME.tilt==null?.42:GAME.tilt)+(mid.y-gmMid0.y)*.0035/(GAME.zoom||1)));
    }
    gmMid0=mid;
    return;
  }
  if(!GAME.drag)return;
  var dx=e.clientX-GAME.lx;GAME.lx=e.clientX;
  var dy=e.clientY-(GAME.ly==null?e.clientY:GAME.ly);GAME.ly=e.clientY;
  var nowT=performance.now(),dtT=nowT-(GAME.lt||nowT);GAME.lt=nowT;
  GAME.lon-=dx*.005/(GAME.zoom||1);
  var vRaw=(-dx*.005/(GAME.zoom||1))*(16.7/Math.max(dtT,8));
  GAME.vel=Math.max(-.02,Math.min(.02,vRaw));
  GAME.tilt=Math.max(-1.25,Math.min(1.35,(GAME.tilt==null?.42:GAME.tilt)+dy*.0035/(GAME.zoom||1)));
  GAME.moved+=Math.abs(dx)+Math.abs(dy);
});
gmCv.addEventListener('pointercancel',function(e){delete GMP[e.pointerId];if(gmPts().length<2){gmPin0=0;gmMid0=null;}});
gmCv.addEventListener('pointerup',function(e){
  delete GMP[e.pointerId];
  if(gmPts().length<2){gmPin0=0;gmMid0=null;}
  if(!GAME.drag)return;GAME.drag=false;
  if(GAME.moved<5){
    GAME.vel=0;                                   /* 纯点击不留甩动惯性 */
    var lp2=gmLocal(e),px=lp2.x,py=lp2.y,best=-1,bd=26;
    for(var i=0;i<GAME.hit.length;i++){var h=GAME.hit[i];
      if(h.b&&px>=h.b.x0&&px<=h.b.x1&&py>=h.b.y0&&py<=h.b.y1){best=h.i;break;}
      var d=Math.hypot(px-h.x,py-h.y);
      if(d<bd){bd=d;best=h.i;}}
    if(best>=0)iterAsk(ERA.act[best]);
  }
});
