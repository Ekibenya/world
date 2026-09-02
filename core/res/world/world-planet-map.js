/* ============================================================
   守护龙纪事 · 泛大陆星球（world-planet-map）
   程序生成的三维星球：高度场→置换/法线/粗糙度贴图，河流、云层、大气、昼夜灯火。
   两个宿主共用同一颗星球：
     · 开局「地点」步：mountForge(host)   — 满屏星空底，拣选落脚地
     · 正文地图面板：  mountPanel(host)   — 透明底，星球挂在面板左缘，右侧是地志
   地理来自 /core/res/data/world/world-map.json，时代（1–32）决定当时存在的地点与灾变地形。
   ============================================================ */
(function(){
'use strict';
var T=window.THREE,MAP_URL='/core/res/data/world/world-map.json';
var PI=Math.PI,D2R=PI/180;
function $(s){return document.querySelector(s);}
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function clamp(x,a,b){return x<a?a:x>b?b:x;}
function lerp(a,b,t){return a+(b-a)*t;}
function sstep(a,b,x){x=clamp((x-a)/(b-a),0,1);return x*x*(3-2*x);}
function wrapLon(d){d=(d+540)%360;if(d<0)d+=360;return d-180;}
function sph(lon,lat,out){var la=lat*D2R,lo=lon*D2R,c=Math.cos(la);out=out||[0,0,0];out[0]=c*Math.cos(lo);out[1]=Math.sin(la);out[2]=-c*Math.sin(lo);return out;}
var seed=1337;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}

/* ---------- simplex 3D ---------- */
var G3=[[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
var P=new Uint8Array(512),PM=new Uint8Array(512);
(function(){var p=[],i;for(i=0;i<256;i++)p[i]=i;for(i=255;i>0;i--){var j=Math.floor(rnd()*(i+1)),t=p[i];p[i]=p[j];p[j]=t;}for(i=0;i<512;i++){P[i]=p[i&255];PM[i]=P[i]%12;}})();
var F3=1/3,G3c=1/6;
function n3(x,y,z){
  var s=(x+y+z)*F3,i=Math.floor(x+s),j=Math.floor(y+s),k=Math.floor(z+s),t=(i+j+k)*G3c;
  var x0=x-(i-t),y0=y-(j-t),z0=z-(k-t),i1,j1,k1,i2,j2,k2;
  if(x0>=y0){if(y0>=z0){i1=1;j1=0;k1=0;i2=1;j2=1;k2=0;}else if(x0>=z0){i1=1;j1=0;k1=0;i2=1;j2=0;k2=1;}else{i1=0;j1=0;k1=1;i2=1;j2=0;k2=1;}}
  else{if(y0<z0){i1=0;j1=0;k1=1;i2=0;j2=1;k2=1;}else if(x0<z0){i1=0;j1=1;k1=0;i2=0;j2=1;k2=1;}else{i1=0;j1=1;k1=0;i2=1;j2=1;k2=0;}}
  var x1=x0-i1+G3c,y1=y0-j1+G3c,z1=z0-k1+G3c,x2=x0-i2+2*G3c,y2=y0-j2+2*G3c,z2=z0-k2+2*G3c,x3=x0-1+3*G3c,y3=y0-1+3*G3c,z3=z0-1+3*G3c;
  var ii=i&255,jj=j&255,kk=k&255,n=0,t0,g;
  t0=.6-x0*x0-y0*y0-z0*z0;if(t0>0){g=G3[PM[ii+P[jj+P[kk]]]];t0*=t0;n+=t0*t0*(g[0]*x0+g[1]*y0+g[2]*z0);}
  t0=.6-x1*x1-y1*y1-z1*z1;if(t0>0){g=G3[PM[ii+i1+P[jj+j1+P[kk+k1]]]];t0*=t0;n+=t0*t0*(g[0]*x1+g[1]*y1+g[2]*z1);}
  t0=.6-x2*x2-y2*y2-z2*z2;if(t0>0){g=G3[PM[ii+i2+P[jj+j2+P[kk+k2]]]];t0*=t0;n+=t0*t0*(g[0]*x2+g[1]*y2+g[2]*z2);}
  t0=.6-x3*x3-y3*y3-z3*z3;if(t0>0){g=G3[PM[ii+1+P[jj+1+P[kk+1]]]];t0*=t0;n+=t0*t0*(g[0]*x3+g[1]*y3+g[2]*z3);}
  return 32*n;
}
function fbm(x,y,z,oct,lac,gain){var a=1,s=0,nrm=0,i;lac=lac||2;gain=gain||.5;for(i=0;i<oct;i++){s+=a*n3(x,y,z);nrm+=a;x*=lac;y*=lac;z*=lac;a*=gain;}return s/nrm;}
function ridged(x,y,z,oct){var a=.5,s=0,w=1,i,r;for(i=0;i<oct;i++){r=1-Math.abs(n3(x,y,z));r=r*r*w;w=clamp(r*1.6,0,1);s+=r*a;x*=2.1;y*=2.1;z*=2.1;a*=.5;}return s;}

/* ---------- 泛大陆轮廓 ---------- */
var BLOBS=[[-75,38,62,24],[-112,56,26,14],[-118,30,22,12],[-45,12,34,16],[-55,63,42,10],[-10,35,22,38],[-30,70,20,8],[-95,48,20,10],
 [45,30,52,26],[70,4,28,16],[85,48,26,12],[108,20,14,9],[20,40,16,14],[-42,83,5,3],[-125,17,4.2,3]];
var BLOB_CAUSE=[-42,77,1.1,5.4],BLOB_NC=[[165,-15,26,20],[178,-4,14,10]];
function blobF(b,lon,lat){var dl=wrapLon(lon-b[0])/b[2],dy=(lat-b[1])/b[3];return 1-Math.sqrt(dl*dl+dy*dy);}
function maskAt(lon,lat,nc,cause){
  var f=-9,i,v;for(i=0;i<BLOBS.length;i++){v=blobF(BLOBS[i],lon,lat);if(v>f)f=v;}
  if(nc){for(i=0;i<2;i++){v=blobF(BLOB_NC[i],lon,lat);if(v>f)f=v;}}
  if(cause){v=blobF(BLOB_CAUSE,lon,lat);if(v>f)f=v;}
  var ice=(-lat-72)/6;if(ice>f)f=ice;return f;
}
var RANGES=[{p:[[-15,3],[-11,18],[-8,33],[-9,48],[-12,62]],s:4.6,w:1},{p:[[166,-32],[168,-16],[171,0]],s:3.4,w:.75,nc:true},
 {p:[[72,38],[92,52]],s:3.6,w:.55},{p:[[-128,42],[-108,50]],s:2.8,w:.45},{p:[[40,12],[62,22]],s:3,w:.4},{p:[[-100,20],[-80,14]],s:2.6,w:.35}];
function segDist(lon,lat,a,b){var cl=Math.cos(((a[1]+b[1])*.5)*D2R),ax=wrapLon(a[0]-lon)*cl,ay=a[1]-lat,bx=wrapLon(b[0]-lon)*cl,by=b[1]-lat,vx=bx-ax,vy=by-ay,t=clamp(-(ax*vx+ay*vy)/(vx*vx+vy*vy+1e-9),0,1),px=ax+vx*t,py=ay+vy*t;return Math.sqrt(px*px+py*py);}
function rangeAt(lon,lat,nc){var w=0,i,j,r,d,dm;for(i=0;i<RANGES.length;i++){r=RANGES[i];if(r.nc&&!nc)continue;dm=1e9;for(j=0;j<r.p.length-1;j++){d=segDist(lon,lat,r.p[j],r.p[j+1]);if(d<dm)dm=d;}d=dm/r.s;w+=r.w*Math.exp(-d*d);}return clamp(w,0,1);}
function gauss(lon,lat,cl,ct,s){var dl=wrapLon(lon-cl)*Math.cos(ct*D2R),dy=lat-ct;return Math.exp(-(dl*dl+dy*dy)/(s*s));}
function degDist(lon,lat,cl,ct){return Math.sqrt(Math.pow(wrapLon(lon-cl)*Math.cos(ct*D2R),2)+Math.pow(lat-ct,2));}

/* ---------- 时代旗标（按 1–32 时代序号） ---------- */
function eraFlags(o){return {nc:o>=12,cause:o>=6,crater:o>=23,pit:o>=20,blight:o>=18&&o<=20,akk:(o>=9&&o<=13)?1:o>=14?2:0,kun:o>=11&&o<=12,deforest:o>=26,rail:o>=30,isle:o>=20,
  lights:o<4?0:o<10?.3:o<14?.45:o<18?.7:o<22?.8:o<26?1:1.25};}

/* ---------- 纹理 ---------- */
var MOBILE=Math.min(window.innerWidth,window.innerHeight)<=760||(navigator.deviceMemory&&navigator.deviceMemory<4);
var W=MOBILE?1024:2048,H=W/2;
var HGT,LAND,RIV,RNG,ALB,NRM,RGH,EMI0,EMI,DSP,CW=1024,CH=512,CLD,LW,LH,DIST;
function alloc(){HGT=new Float32Array(W*H);LAND=new Uint8Array(W*H);RIV=new Uint8Array(W*H);RNG=new Float32Array(W*H);ALB=new Uint8Array(W*H*4);NRM=new Uint8Array(W*H*4);RGH=new Uint8Array(W*H*4);EMI0=new Uint8Array(W*H*4);EMI=new Uint8Array(W*H*4);DSP=new Uint8Array(W*H*4);CLD=new Uint8Array(CW*CH*4);LW=W/4;LH=H/4;DIST=new Float32Array(LW*LH);}
var v3=[0,0,0];
function lonOf(x){return (x+.5)/W*360-180;}function latOf(y){return (y+.5)/H*180-90;}
var BASEF=eraFlags(16);
function heightPx(x,y,F){
  var lat=latOf(y),lon=lonOf(x),idx=y*W+x,p=sph(lon,lat,v3),wx,wy,lonW,latW,f,land,coast,hills,R,rid,h;
  wx=n3(p[0]*1.7+3.1,p[1]*1.7,p[2]*1.7);wy=n3(p[0]*1.7,p[1]*1.7+7.3,p[2]*1.7);
  lonW=lon+10*wx+3*n3(p[0]*5+1,p[1]*5,p[2]*5);latW=lat+8*wy+2.5*n3(p[0]*5,p[1]*5+2,p[2]*5);
  f=maskAt(lonW,latW,F.nc,F.cause)+.16*fbm(p[0]*2.4,p[1]*2.4,p[2]*2.4,4);land=f>0.02;
  R=rangeAt(lon,lat,F.nc);RNG[idx]=R;
  if(land){
    coast=sstep(0.02,.34,f);hills=fbm(p[0]*4.2+9,p[1]*4.2,p[2]*4.2,6,2.05,.5);
    h=.03+coast*.14+(.09+.11*coast)*hills*(.5+.5*coast)+.05*Math.abs(hills);
    if(R>.01){rid=ridged(p[0]*7+2,p[1]*7,p[2]*7,5);h+=R*(.28+.62*rid);}
    h+=.55*gauss(lon,lat,-8,33,2.4)+.2*gauss(lon,lat,-8,33,6);
    var dv=degDist(lon,lat,-45,8);if(dv<4.5){var cone=(1-dv/4.5);h+=.62*cone*cone;if(dv<.7)h-=.25*(1-dv/.7);}
    if(F.nc)h+=.35*gauss(lon,lat,169,-15,3);
    if(F.crater){var dc=degDist(lon,lat,-72,40);if(dc<2.2){h-=.13*sstep(2.2,.6,dc);if(dc>1.6&&dc<2.2)h+=.035;}}
    if(F.pit){var dp=degDist(lon,lat,-35,64);if(dp<1.6){h-=.2*sstep(1.6,.4,dp);if(dp>1.2&&dp<1.6)h+=.03;}}
    var dg=segDist(lon,lat,[-34,70],[-26,72.5]);if(dg<1.1)h-=.16*(1-dg/1.1);
    if(F.cause&&lat>74&&lat<81.5&&blobF(BLOB_CAUSE,lon,lat)>-.3)h=Math.min(h,.03);   /* 黑石长堤：贴着海面的低堤 */
    if(lat>81)h=Math.min(h,.06);   /* 极北冰岛：低矮的冰浪小岛 */
    if(h<.012)h=.012;
    h-=.5*gauss(lon,lat,36,27,3.2);if(h<.012&&h>-.02)h=.012;
  }else{coast=sstep(0.02,-.4,f);h=-(.06+.9*coast)+.06*fbm(p[0]*3+5,p[1]*3,p[2]*3,4)*coast-.06*R;if(h>-.02)h=-.02;}
  HGT[idx]=clamp(h,-1,1.15);LAND[idx]=HGT[idx]>0?1:0;
}
function genRivers(){
  var n=0,tries=0,x,y,idx,steps,best,bi,i,dx,dy,nx,ny,ni,path,w,fi=0,goal=MOBILE?150:240;
  var FORCED=[[-9,37],[-7,29],[-12,45],[-6,24],[-10,52],[40,36],[30,33],[-60,44],[-84,40],[-118,44],[80,44],[50,16],[170,-12],[-112,50],[-24,56],[-70,46],[-100,36],[-52,40],[60,34],[95,30]];
  while(n<goal&&tries<60000){
    tries++;
    if(fi<FORCED.length){x=Math.floor((FORCED[fi][0]+(rnd()-.5)*3+180)/360*W);y=Math.floor((FORCED[fi][1]+(rnd()-.5)*3+90)/180*H);fi++;}
    else{x=Math.floor(rnd()*W);y=Math.floor(H*.12+rnd()*H*.8);}
    x=((x%W)+W)%W;y=clamp(y,1,H-2);idx=y*W+x;
    if(!LAND[idx]||HGT[idx]<.2||RIV[idx])continue;
    if(fi>=FORCED.length&&rnd()>.35+RNG[idx])continue;
    path=[];steps=0;
    while(steps<2600){
      path.push(idx);steps++;best=HGT[idx];bi=-1;
      for(dy=-1;dy<=1;dy++)for(dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;nx=(x+dx+W)%W;ny=y+dy;if(ny<0||ny>=H)continue;ni=ny*W+nx;var hv=HGT[ni]+(RIV[ni]?-.002:0)+(rnd()-.5)*.003;if(hv<best){best=hv;bi=ni;}}
      if(bi<0)break;idx=bi;x=idx%W;y=(idx-x)/W;if(HGT[idx]<=0||RIV[idx])break;
    }
    if(path.length<40||HGT[idx]>0&&!RIV[idx])continue;
    n++;
    for(i=0;i<path.length;i++){var pi=path[i];w=i>700?2:i>140?1:0;RIV[pi]=Math.max(RIV[pi],1+w);HGT[pi]-=.016;
      if(w>0){var px=pi%W,py=(pi-px)/W,q=py*W+((px+1)%W);RIV[q]=Math.max(RIV[q],1);if(w>1&&py+1<H){q=(py+1)*W+px;RIV[q]=Math.max(RIV[q],1);}}}
  }
}
function genDist(){
  var q=new Int32Array(LW*LH),qh=0,qt=0,i,x,y;for(i=0;i<LW*LH;i++)DIST[i]=1e9;
  for(y=0;y<LH;y++)for(x=0;x<LW;x++){if(!LAND[(y*4+2)*W+x*4+2]){i=y*LW+x;DIST[i]=0;q[qt++]=i;}}
  while(qh<qt){i=q[qh++];x=i%LW;y=(i-x)/LW;var d=DIST[i]+1,nb=[[(x+1)%LW,y],[(x-1+LW)%LW,y],[x,y+1],[x,y-1]],k;
    for(k=0;k<4;k++){var nx=nb[k][0],ny=nb[k][1];if(ny<0||ny>=LH)continue;var ni=ny*LW+nx;if(DIST[ni]>d){DIST[ni]=d;q[qt++]=ni;}}}
}
function distAt(x,y){return DIST[Math.min(LH-1,y>>2)*LW+Math.min(LW-1,x>>2)];}
function C(h){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
var COL={deep:C("#061a33"),shelf:C("#1d6f8c"),shoal:C("#3f9fb0"),sand:C("#d2b57a"),dune:C("#bd8d4f"),dry:C("#a89f5e"),grass:C("#7d9a4c"),meadow:C("#578f3e"),
 forest:C("#2c6a31"),elf:C("#175a2c"),boreal:C("#2c5f45"),tundra:C("#8f9a80"),rock:C("#6b625a"),scree:C("#7f7469"),snow:C("#e6ebee"),ice:C("#d5e3ea"),lava:C("#2c1f1c"),ash:C("#4a3b36"),
 wn:C("#dfe6dd"),river:C("#2b7f98"),lake:C("#1e6f88"),curse:C("#5b4a3a"),scorch:C("#6e5237")};
function mix3(a,b,t,o){o[0]=a[0]+(b[0]-a[0])*t;o[1]=a[1]+(b[1]-a[1])*t;o[2]=a[2]+(b[2]-a[2])*t;return o;}
var c1=[0,0,0];
/* 一个点的气候：温度、湿度（也供地志文字用） */
function climate(x,y,lon,lat,h,p,F){
  var T=Math.pow(Math.cos(lat*D2R),.9)*1.05-.55*Math.max(0,h)+.05*n3(p[0]*3+11,p[1]*3,p[2]*3);
  var M=.5+.5*fbm(p[0]*3.1+21,p[1]*3.1,p[2]*3.1,4);M=.33+.42*M+.3*Math.exp(-distAt(x,y)/22*(2048/W));
  M+=.16*Math.exp(-Math.pow((lat-4)/12,2))-.14*Math.exp(-Math.pow((Math.abs(lat)-24)/9,2));
  var wd=gauss(lon,lat,-42,13,11);M-=.9*wd;T+=.22*wd;var wf=gauss(lon,lat,-112,56,11);M+=.55*wf;
  var wa=gauss(lon,lat,-58,50,7);if(F.akk===2)M=lerp(M,.42,wa*.7);
  var wk=F.kun?gauss(lon,lat,85,47,6):0;M-=.8*wk;T+=.3*wk;
  if(F.deforest)M-=.14*gauss(lon,lat,-72,38,9)+.1*gauss(lon,lat,-92,44,5);
  return {T:clamp(T,0,1),M:clamp(M,0,1),wf:wf,wa:wa,wk:wk,ww:gauss(lon,lat,-12,70,6)};
}
function biomeName(c,h,land){
  if(!land)return h>-.12?'近岸浅海':'深海';
  if(c.ww>.3)return '白夜冰原';var snow=clamp(sstep(.24,.1,c.T)+sstep(.64,.86,h)*sstep(.6,.3,c.T),0,1);
  if(snow>.5)return '雪线之上';if(h>.55)return '高山裸岩';if(c.wk>.3)return '焦土';if(c.M<.22&&c.T>.5)return '沙漠';if(c.M<.4)return '干草原';
  if(c.T<.3)return '苔原';if(c.M>.6&&c.T<.45)return '寒带针叶林';if(c.M>.6)return c.wf>.3?'精灵大森林':'温带森林';return c.T>.5?'草甸':'草原';
}
function surfacePx(x,y,F){
  var lat=latOf(y),lon=lonOf(x),idx=y*W+x,i4=idx*4,h=HGT[idx],land=LAND[idx],p=sph(lon,lat,v3),c,det,coast,rough=.9,em0=0,em1=0,em2=0;
  det=n3(p[0]*38,p[1]*38,p[2]*38)*.5+n3(p[0]*90,p[1]*90,p[2]*90)*.25;
  if(!land||RIV[idx]){
    var d=RIV[idx]?.12:-h;
    if(RIV[idx]){c=mix3(COL.river,COL.lake,.4,c1);c[0]*=.85;c[1]*=.92;}
    else{c=mix3(COL.shoal,COL.shelf,sstep(0,.12,d),c1);c=mix3(c,COL.deep,sstep(.08,.55,d),c1);var lk=gauss(lon,lat,36,27,3.6);if(lk>.05)c=mix3(c,COL.lake,lk*.8,c1);}
    c[0]*=1+det*.06;c[1]*=1+det*.06;c[2]*=1+det*.05;rough=.28+.06*(det+.5);
    var sd=gauss(lon,lat,-160,5,2.2);if(sd>.02){em0=60*sd;em1=150*sd;em2=170*sd;}
  }else{
    var k=climate(x,y,lon,lat,h,p,F),T=k.T,M=k.M;
    c=mix3(COL.grass,COL.meadow,sstep(.45,.62,M),c1);c=mix3(c,COL.forest,sstep(.56,.78,M)*sstep(.32,.52,T),c1);c=mix3(c,COL.elf,k.wf*sstep(.5,.75,M),c1);
    c=mix3(c,COL.dry,sstep(.42,.28,M),c1);c=mix3(c,COL.sand,sstep(.3,.14,M)*sstep(.45,.62,T),c1);c=mix3(c,COL.dune,sstep(.3,.14,M)*sstep(.45,.62,T)*(.5+.5*Math.abs(det))*.7,c1);
    c=mix3(c,COL.boreal,sstep(.52,.36,T)*sstep(.4,.6,M),c1);c=mix3(c,COL.tundra,sstep(.4,.22,T),c1);c=mix3(c,COL.rock,sstep(.42,.68,h),c1);c=mix3(c,COL.scree,sstep(.6,.82,h)*(.5+.5*det),c1);
    var snow=clamp(sstep(.24,.1,T)+sstep(.64,.86,h)*sstep(.6,.3,T)+sstep(.52,.72,h)*sstep(.33,.2,T),0,1);c=mix3(c,COL.snow,snow,c1);
    c=mix3(c,COL.ice,sstep(-70,-76,lat),c1);c=mix3(c,COL.wn,k.ww*.9,c1);if(k.ww>.03){em0=190*k.ww;em1=205*k.ww;em2=225*k.ww;}
    if(F.akk===1){var cw=k.wa*sstep(.2,.9,k.wa+.3);c=mix3(c,COL.curse,Math.min(1,cw*1.3)*(.8+.2*det),c1);}
    if(k.wk>.03)c=mix3(c,COL.scorch,Math.min(1,k.wk*1.2),c1);
    if(F.blight)c=mix3(c,COL.ash,gauss(lon,lat,-35,64,5)*.75,c1);
    if(F.pit){var dp=degDist(lon,lat,-35,64);if(dp<1.6)c=mix3(c,COL.rock,sstep(1.6,.6,dp)*.8,c1);}
    if(F.crater){var dc=degDist(lon,lat,-72,40);if(dc<2.2)c=mix3(c,COL.scree,sstep(2.2,1,dc)*.7,c1);}
    var dv=degDist(lon,lat,-45,8);
    if(dv<5){var vw=sstep(5,2.5,dv);c=mix3(c,COL.ash,vw*.85,c1);var lv=sstep(2.6,.4,dv)*(.35+.65*Math.max(0,det*2+.5));c=mix3(c,COL.lava,vw,c1);var glow=clamp(lv*(0.6+0.8*Math.max(0,n3(p[0]*60,p[1]*60,p[2]*60))),0,1);em0=Math.max(em0,255*glow);em1=Math.max(em1,90*glow);em2=Math.max(em2,20*glow);}
    coast=sstep(.03,.012,h);c=mix3(c,COL.sand,coast*(1-snow)*.8,c1);
    c[0]*=1+det*.14;c[1]*=1+det*.14;c[2]*=1+det*.12;rough=lerp(.92,.7,snow)-.05*det;
  }
  ALB[i4]=clamp(c[0],0,255);ALB[i4+1]=clamp(c[1],0,255);ALB[i4+2]=clamp(c[2],0,255);ALB[i4+3]=255;
  RGH[i4]=0;RGH[i4+1]=clamp(rough*255,0,255);RGH[i4+2]=0;RGH[i4+3]=255;
  EMI0[i4]=em0;EMI0[i4+1]=em1;EMI0[i4+2]=em2;EMI0[i4+3]=255;
  var dsp=clamp(Math.max(0,h)/1.15,0,1)*255;DSP[i4]=dsp;DSP[i4+1]=dsp;DSP[i4+2]=dsp;DSP[i4+3]=255;
}
function genLights(o){
  EMI.set(EMI0);var F=eraFlags(o);if(!F.lights||!DATA)return;
  var save=seed;seed=4242;
  DATA.sites.forEach(function(s){
    if(s.unplaced||s.layer!=='surface')return;if(o<s.from||o>s.to)return;
    var kind=s.kind||'';var cap=/都|帝国|首都|之城|大城/.test(kind),city=/城|村|港|国|中心|圣地|领地|骑兵/.test(kind);if(!cap&&!city)return;
    if(/海|荒|禁地|神系|神域|神族|草原|湿地|冰|荒原|岛屿港口 · 七大/.test(kind)&&!cap)return;
    var age=Math.min(1,(o-s.from+1)/3),n=Math.round((cap?1000:450)*F.lights*age*(W/2048)),rad=/国|领地/.test(kind)?4:1.7,crater=(s.id==='sir'&&o>=23&&o<=24);
    for(var k=0;k<n;k++){var r=rad*Math.pow(rnd(),.6),a=rnd()*PI*2;if(crater&&r<1.9)continue;
      var lon=s.lon+Math.cos(a)*r/Math.max(.3,Math.cos(s.lat*D2R)),lat=s.lat+Math.sin(a)*r,x=Math.floor((wrapLon(lon)+180)/360*W),y=Math.floor((lat+90)/180*H);if(y<0||y>=H)continue;var idx=y*W+x;
      if(!LAND[idx]||RIV[idx]||HGT[idx]>.55)continue;var i4=idx*4,b=120+rnd()*135;EMI[i4]=Math.max(EMI[i4],b);EMI[i4+1]=Math.max(EMI[i4+1],b*.66);EMI[i4+2]=Math.max(EMI[i4+2],b*.32);}
  });
  seed=save;
}
function normalPx(x,y){
  var idx=y*W+x,i4=idx*4,sx=Math.min(4,1/Math.max(.08,Math.cos(latOf(y)*D2R)));
  var hl=Math.max(0,HGT[y*W+((x-1+W)%W)]),hr=Math.max(0,HGT[y*W+((x+1)%W)]),hd=Math.max(0,HGT[Math.max(0,y-1)*W+x]),hu=Math.max(0,HGT[Math.min(H-1,y+1)*W+x]);
  var st=LAND[idx]?70*(W/2048):0,nx=-(hr-hl)*st*sx,ny=-(hu-hd)*st,l=Math.sqrt(nx*nx+ny*ny+1);
  NRM[i4]=(nx/l*.5+.5)*255;NRM[i4+1]=(ny/l*.5+.5)*255;NRM[i4+2]=(1/l*.5+.5)*255;NRM[i4+3]=255;
}
function genClouds(){
  var x,y,i4,lon,lat,p,a,b;
  for(y=0;y<CH;y++){lat=(y+.5)/CH*180-90;for(x=0;x<CW;x++){lon=(x+.5)/CW*360-180;p=sph(lon,lat,v3);i4=(y*CW+x)*4;
    var wx=n3(p[0]*2+4,p[1]*2,p[2]*2)*.35,wy=n3(p[0]*2,p[1]*2+9,p[2]*2)*.35;
    a=fbm(p[0]*3.2+wx+30,p[1]*3.2+wy,p[2]*3.2,6,2.2,.55)*.5+.5;b=fbm(p[0]*9+3,p[1]*9,p[2]*9,3)*.5+.5;
    var band=.5+.35*Math.cos(lat*D2R*3)+.15*Math.cos(lat*D2R),al=sstep(.52,.78,a*band+.12*b-.04);al*=1-.55*sstep(.5,.9,a);
    var shade=200+55*sstep(.5,.85,a);CLD[i4]=shade;CLD[i4+1]=shade;CLD[i4+2]=Math.min(255,shade+8);CLD[i4+3]=al*255;}}
}
var PATCHES=[{b:[126,-158,-50,18],h:true},{b:[-47,-37,72,87],h:true},{b:[-77,-67,37,43],h:true},{b:[-42,-28,58,70],h:true},{b:[-70,-46,42,58]},{b:[76,94,40,54]},{b:[-100,-58,28,50]}];
function pxOf(lon){return ((Math.floor((lon+180)/360*W)%W)+W)%W;}function pyOf(lat){return clamp(Math.floor((lat+90)/180*H),0,H-1);}
var patchedFor=-1;
function applyEra(o){
  if(!READY||patchedFor===o)return;patchedFor=o;
  var F=eraFlags(o),i,pa,x0,x1,y0,y1,x,y,n;
  for(i=0;i<PATCHES.length;i++){pa=PATCHES[i];x0=pxOf(pa.b[0]);x1=pxOf(pa.b[1]);y0=pyOf(pa.b[2]);y1=pyOf(pa.b[3]);n=x1>=x0?x1-x0:x1+W-x0;
    if(pa.h){for(y=y0;y<=y1;y++)for(x=0;x<=n;x++)heightPx((x0+x)%W,y,F);}
    for(y=y0;y<=y1;y++)for(x=0;x<=n;x++)surfacePx((x0+x)%W,y,F);
    if(pa.h){for(y=Math.max(0,y0-1);y<=Math.min(H-1,y1+1);y++)for(x=-1;x<=n+1;x++)normalPx((x0+x+W)%W,y);}}
  genLights(o);if(TEXS)TEXS.forEach(function(t){t.needsUpdate=true;});
  if(rail)rail.visible=!!F.rail;if(isle)isle.visible=!!F.isle;
}

/* ---------- 渐进生成 ---------- */
var READY=false,BUILDING=false,progressCb=[];
function prog(f,s){progressCb.forEach(function(cb){try{cb(f,s);}catch(_){}});}
function rows(fn,label,f0,f1,done){var y=0;function tick(){var t0=performance.now();while(y<H&&performance.now()-t0<24){for(var k=0;k<8&&y<H;k++,y++)fn(y);}prog(f0+(f1-f0)*y/H,label);if(y<H)setTimeout(tick,0);else done();}tick();}
function build(){
  if(READY||BUILDING)return;BUILDING=true;alloc();
  rows(function(y){for(var x=0;x<W;x++)heightPx(x,y,BASEF);},'凝聚泛大陆 · 隆起山脉',0,.5,function(){
    prog(.52,'开凿河流');setTimeout(function(){genRivers();genDist();
      rows(function(y){for(var x=0;x<W;x++)surfacePx(x,y,BASEF);},'描绘生灵之地',.55,.85,function(){
        prog(.86,'点亮城市灯火');setTimeout(function(){for(var y=0;y<H;y++)for(var x=0;x<W;x++)normalPx(x,y);prog(.92,'拂过云鲸之息');
          setTimeout(function(){genClouds();READY=true;BUILDING=false;initScene();applyEra(VIEW.ord);prog(1,'升起');refreshSites();},20);},20);});},20);});
}

/* ---------- 场景 ---------- */
var renderer,scene,camera,planet,group,clouds,sunDir=T?new T.Vector3(5,1.6,2.8).normalize():null,sunView=T?new T.Vector3():null,atmoIn,atmoOut,rail,isle,stars,TEXS=null,DISP=.04;
var cam={theta:1.22,phi:1.15,r:4.6,vt:0,vp:0,tr:3.6,tt:null,tp:null},idleAt=0,spinAngle=0,lastT=0,raf=0;
var VIEW={ord:16,eraName:'',layer:'surface',mode:'forge',selected:null,free:null};
var canvas=null,pinLayer=null,host=null,hostMode='',onPick=null,resizeObs=null,mini=null,mctx=null;
function tex(data,w,h,srgb){var t=new T.DataTexture(data,w,h,T.RGBAFormat);t.flipY=false;t.wrapS=T.RepeatWrapping;t.wrapT=T.ClampToEdgeWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;if(srgb)t.encoding=T.sRGBEncoding;t.needsUpdate=true;return t;}
function initScene(){
  try{renderer=new T.WebGLRenderer({canvas:canvas,antialias:true,alpha:true,powerPreference:'high-performance'});}catch(e){renderer=null;prog(1,'此设备不支持 WebGL');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.setClearColor(0x000000,0);
  scene=new T.Scene();camera=new T.PerspectiveCamera(38,1,.05,60);group=new T.Group();scene.add(group);
  var an=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  var mAlb=tex(ALB,W,H,true),mNrm=tex(NRM,W,H,false),mRgh=tex(RGH,W,H,false),mEmi=tex(EMI,W,H,true),mDsp=tex(DSP,W,H,false);TEXS=[mAlb,mNrm,mRgh,mEmi,mDsp];TEXS.forEach(function(t){t.anisotropy=an;});
  var mat=new T.MeshStandardMaterial({map:mAlb,normalMap:mNrm,normalScale:new T.Vector2(1,1),roughnessMap:mRgh,roughness:1,metalness:0,emissive:new T.Color(0xffffff),emissiveMap:mEmi,emissiveIntensity:1.1,displacementMap:mDsp,displacementScale:DISP});
  var sunU={value:sunView};
  mat.onBeforeCompile=function(s){s.uniforms.uSun=sunU;s.fragmentShader=s.fragmentShader.replace('uniform vec3 emissive;','uniform vec3 emissive; uniform vec3 uSun;').replace('#include <emissivemap_fragment>','#ifdef USE_EMISSIVEMAP\n vec4 emissiveColor = texture2D( emissiveMap, vUv );\n emissiveColor.rgb = emissiveMapTexelToLinear( emissiveColor ).rgb;\n float ndl = dot( normalize( normal ), uSun );\n float night = smoothstep( 0.18, -0.16, ndl );\n totalEmissiveRadiance *= emissiveColor.rgb * mix( 0.05, 1.0, night );\n#endif');};
  planet=new T.Mesh(new T.SphereGeometry(1,MOBILE?256:512,MOBILE?128:256),mat);group.add(planet);
  clouds=new T.Mesh(new T.SphereGeometry(1.022,128,64),new T.MeshStandardMaterial({map:tex(CLD,CW,CH,true),transparent:true,depthWrite:false,roughness:1,metalness:0,opacity:.92}));group.add(clouds);
  var atmoV='varying vec3 vN; varying vec3 vW; void main(){ vN = normalize( normalMatrix * normal ); vW = normalize( ( modelMatrix * vec4( position, 1.0 ) ).xyz ); gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }';
  atmoOut=new T.Mesh(new T.SphereGeometry(1.09,96,48),new T.ShaderMaterial({uniforms:{uSunW:{value:sunDir}},vertexShader:atmoV,fragmentShader:'varying vec3 vN; varying vec3 vW; uniform vec3 uSunW; void main(){ float i = pow( 0.52 - dot( vN, vec3( 0.0, 0.0, 1.0 ) ), 3.2 ); float day = smoothstep( -0.35, 0.45, dot( vW, uSunW ) ); vec3 c = mix( vec3( 0.36, 0.55, 0.95 ), vec3( 0.95, 0.62, 0.36 ), pow( 1.0 - day, 3.0 ) * 0.6 ); gl_FragColor = vec4( c * i * ( 0.15 + 0.85 * day ), 1.0 ); }',side:T.BackSide,blending:T.AdditiveBlending,transparent:true,depthWrite:false}));scene.add(atmoOut);
  atmoIn=new T.Mesh(new T.SphereGeometry(1.02,128,64),new T.ShaderMaterial({uniforms:{uSunW:{value:sunDir}},vertexShader:atmoV,fragmentShader:'varying vec3 vN; varying vec3 vW; uniform vec3 uSunW; void main(){ float f = pow( 1.0 - max( 0.0, dot( vN, vec3( 0.0, 0.0, 1.0 ) ) ), 3.5 ); float day = smoothstep( -0.3, 0.5, dot( vW, uSunW ) ); vec3 c = mix( vec3( 0.42, 0.62, 1.0 ), vec3( 1.0, 0.55, 0.3 ), pow( 1.0 - day, 2.0 ) * 0.5 ); gl_FragColor = vec4( c * f * 0.55 * ( 0.12 + 0.88 * day ), 1.0 ); }',side:T.FrontSide,blending:T.AdditiveBlending,transparent:true,depthWrite:false}));scene.add(atmoIn);
  var sun=new T.DirectionalLight(0xfff2dc,2.35);sun.position.copy(sunDir).multiplyScalar(10);scene.add(sun);scene.add(new T.AmbientLight(0x2a3140,.55));scene.add(new T.HemisphereLight(0x3b4a66,0x120c08,.22));
  var N=MOBILE?1500:4200,pos=new Float32Array(N*3),col=new Float32Array(N*3),i;
  for(i=0;i<N;i++){var th=rnd()*PI*2,ph=Math.acos(2*rnd()-1);pos[i*3]=40*Math.sin(ph)*Math.cos(th);pos[i*3+1]=40*Math.cos(ph);pos[i*3+2]=40*Math.sin(ph)*Math.sin(th);var b=.35+Math.pow(rnd(),3)*.65,tint=rnd();col[i*3]=b*(tint<.15?.8:1);col[i*3+1]=b*(tint<.15?.85:tint>.9?.92:1);col[i*3+2]=b*(tint>.9?.8:1.05);}
  var sg=new T.BufferGeometry();sg.setAttribute('position',new T.BufferAttribute(pos,3));sg.setAttribute('color',new T.BufferAttribute(col,3));stars=new T.Points(sg,new T.PointsMaterial({size:.09,vertexColors:true,sizeAttenuation:true,transparent:true,opacity:.9}));scene.add(stars);
  rail=makeArc(-92,44,-8,33,0xd6a64e);group.add(rail);isle=makeIsle(-35,64);group.add(isle);
  buildPins();applyMode();resize();if(!raf)raf=requestAnimationFrame(loop);
}
function hAt(lon,lat){if(!HGT)return 0;var x=Math.floor((wrapLon(lon)+180)/360*W)%W,y=clamp(Math.floor((lat+90)/180*H),0,H-1);return HGT[y*W+x];}
function surfaceR(lon,lat){return 1+DISP*Math.max(0,hAt(lon,lat))/1.15;}
function makeArc(lo1,la1,lo2,la2,color){var a=new T.Vector3().fromArray(sph(lo1,la1)),b=new T.Vector3().fromArray(sph(lo2,la2)),pts=[],n=96,i;for(i=0;i<=n;i++){var v=new T.Vector3().copy(a).lerp(b,i/n).normalize(),lat=Math.asin(v.y)/D2R,lon=Math.atan2(-v.z,v.x)/D2R;v.multiplyScalar(surfaceR(lon,lat)+.004);pts.push(v);}return new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:color,transparent:true,opacity:.9}));}
function makeIsle(lon,lat){var g=new T.CylinderGeometry(.022,.004,.026,14,3),p=g.attributes.position,i;for(i=0;i<p.count;i++){var x=p.getX(i),y=p.getY(i),z=p.getZ(i),j=.006*n3(x*90,y*90,z*90);if(y>.012)p.setXYZ(i,x*(1+j*20),y,z*(1+j*20));else p.setXYZ(i,x+j,y+j*.5,z+j);}g.computeVertexNormals();
  var m=new T.Mesh(g,new T.MeshStandardMaterial({color:0x4b433d,roughness:.95,flatShading:true})),keep=new T.Mesh(new T.BoxGeometry(.008,.014,.008),new T.MeshStandardMaterial({color:0x2a2526,roughness:.8}));keep.position.y=.019;m.add(keep);
  var nrm=new T.Vector3().fromArray(sph(lon,lat));m.position.copy(nrm).multiplyScalar(1.105);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),nrm);return m;}

/* ---------- 地点 ---------- */
var DATA=null,ACTIVE=[],pins=[],tmpV=T?new T.Vector3():null,tmpW=T?new T.Vector3():null;
function inEra(s){return VIEW.ord>=(s.from||1)&&VIEW.ord<=(s.to||99);}
function refreshSites(){
  if(!DATA)return;
  ACTIVE=DATA.sites.filter(function(s){return inEra(s)&&s.layer===VIEW.layer;});
  if(VIEW.selected&&VIEW.selected!=='free'&&!ACTIVE.some(function(s){return s.id===VIEW.selected;}))VIEW.selected=null;
  renderHud();
}
function siteById(id){if(id==='free')return VIEW.free;for(var i=0;i<(DATA?DATA.sites.length:0);i++)if(DATA.sites[i].id===id)return DATA.sites[i];return null;}
function buildPins(){
  if(!DATA||!pinLayer)return;pinLayer.innerHTML='';pins=[];
  DATA.sites.forEach(function(s){if(s.unplaced||s.lat==null)return;var d=document.createElement('div');d.className='wpmPin t'+(s.t||s.tier||2)+(s.layer==='gateway'?' k-gate':/禁地/.test(s.kind)?' k-forbid':/神/.test(s.kind)?' k-god':/海|洋/.test(s.kind)?' k-sea':/圣|信仰/.test(s.kind)?' k-sacred':/都|之城|首都/.test(s.kind)?' k-cap':'');
    d.innerHTML='<i></i><span>'+esc(s.name)+'</span>';d.setAttribute('role','button');d.tabIndex=0;
    d.addEventListener('pointerdown',function(e){e.stopPropagation();});d.addEventListener('click',function(e){e.stopPropagation();choose(s.id,true);});d.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(s.id,true);}});
    pinLayer.appendChild(d);var lift=s.id==='isle'?1.135:surfaceR(s.lon,s.lat)+.008;s.local=new T.Vector3().fromArray(sph(s.lon,s.lat)).multiplyScalar(lift);s.el=d;pins.push(s);});
  var f=document.createElement('div');f.className='wpmPin k-free';f.innerHTML='<i></i><span></span>';pinLayer.appendChild(f);freePin=f;
}
var freePin=null;
function updatePins(){
  if(!camera||!pinLayer)return;var camN=camera.position.clone().normalize(),w=canvas.clientWidth,h=canvas.clientHeight,placed=[],showAll=hostMode==='forge'||hostMode==='panel';
  var order=pins.slice().sort(function(a,b){return (a.id===VIEW.selected?-1:b.id===VIEW.selected?1:(a.tier||2)-(b.tier||2));});
  order.forEach(function(s){
    var sel=s.id===VIEW.selected,show=showAll&&inEra(s)&&s.layer===VIEW.layer&&(s.tier===1||(s.tier===2&&cam.r<4.4)||(s.tier===3&&cam.r<3.0)||sel);
    if(!show){s.el.style.opacity=0;s.el.style.pointerEvents='none';return;}
    tmpW.copy(s.local).applyMatrix4(group.matrixWorld);var face=tmpW.clone().normalize().dot(camN);
    if(face<.1){s.el.style.opacity=0;s.el.style.pointerEvents='none';return;}
    tmpV.copy(tmpW).project(camera);var x=(tmpV.x*.5+.5)*w,y=(-tmpV.y*.5+.5)*h,tw=s.el.offsetWidth||90,i;
    if(!sel){for(i=0;i<placed.length;i++){var q=placed[i];if(Math.abs(q.y-y)<20&&x<q.x+q.w+10&&x+tw>q.x-10){s.el.style.opacity=0;s.el.style.pointerEvents='none';return;}}}
    placed.push({x:x,y:y,w:tw});s.el.classList.toggle('sel',sel);
    s.el.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) translate(-3px,-50%)';s.el.style.opacity=(.35+.65*sstep(.1,.4,face)).toFixed(2);s.el.style.pointerEvents='auto';
  });
  if(freePin){var fr=VIEW.selected==='free'&&VIEW.free;if(fr){tmpW.copy(VIEW.free.local).applyMatrix4(group.matrixWorld);var fc=tmpW.clone().normalize().dot(camN);if(fc>.1){tmpV.copy(tmpW).project(camera);freePin.style.transform='translate('+((tmpV.x*.5+.5)*w).toFixed(1)+'px,'+((-tmpV.y*.5+.5)*h).toFixed(1)+'px) translate(-3px,-50%)';freePin.style.opacity=1;freePin.querySelector('span').textContent=VIEW.free.name;return;}}freePin.style.opacity=0;}
}
function flyToWorld(v,zoom){var n=v.clone().normalize();cam.tt=Math.atan2(n.z,n.x);cam.tp=clamp(Math.acos(clamp(n.y,-1,1)),.12,PI-.12);if(zoom)cam.tr=zoom;cam.vt=0;cam.vp=0;idleAt=performance.now();}
function regionName(lon,lat){var h=hAt(lon,lat);if(lat<-70)return '南极冰盖';if(h<=0)return (wrapLon(lon)>130||wrapLon(lon)<-150)?'忒提丝之洋 · 远海':'忒提丝之洋';var l=wrapLon(lon);if(l>140||l<-170)return '新大陆';if(l>-2)return '东大陆';return '西大陆';}
function fmtLon(v){return Math.abs(v).toFixed(1)+'°'+(v<0?'W':'E');}function fmtLat(v){return Math.abs(v).toFixed(1)+'°'+(v<0?'S':'N');}
/* 任意座标的地志（自由拣选用） */
function describe(lon,lat){
  if(!READY)return null;var x=pxOf(lon),y=pyOf(lat),idx=y*W+x,h=HGT[idx],land=LAND[idx],p=sph(lon,lat,v3),k=climate(x,y,lon,lat,h,p,eraFlags(VIEW.ord)),bio=biomeName(k,h,land);
  var near=null,nd=1e9;ACTIVE.forEach(function(s){if(s.unplaced)return;var d=degDist(lon,lat,s.lon,s.lat);if(d<nd){nd=d;near=s;}});
  return {lon:lon,lat:lat,land:!!land,h:h,biome:bio,region:regionName(lon,lat),near:near,nearDist:nd,
    elev:h>0?'海拔约 '+(h*8800).toFixed(0)+' 米':'水深约 '+(-h*6000).toFixed(0)+' 米',
    text:regionName(lon,lat)+'，'+bio+(land?'，'+(h>0?'海拔约 '+(h*8800).toFixed(0)+' 米':''):'')+(near&&nd<25?'；距'+near.name+'约 '+(nd*111).toFixed(0)+' 里程':'')};
}
function choose(id,fly){
  VIEW.selected=id;var s=siteById(id);renderHud();
  if(s&&s.lat!=null&&camera&&fly){var v=(id==='free'?VIEW.free.local:s.local).clone().applyMatrix4(group.matrixWorld);flyToWorld(v,hostMode==='forge'?Math.max(3.1,Math.min(cam.tr,3.4)):Math.max(3.6,Math.min(cam.tr,4.8)));}
  if(onPick)try{onPick(packet(s));}catch(_){}
}
function packet(s){if(!s)return null;var d=s.lat!=null&&READY?describe(s.lon,s.lat):null;return {id:s.id,name:s.name,latin:s.latin||'',kind:s.kind||'',summary:s.summary||'',ref:s.ref||'',lon:s.lon,lat:s.lat,unplaced:!!s.unplaced,region:d?d.region:'',biome:d?d.biome:'',elev:d?d.elev:'',coord:s.lat!=null?fmtLon(s.lon)+' '+fmtLat(s.lat):'',free:s.id==='free'};}
function pickFree(lon,lat){
  var d=describe(lon,lat);if(!d)return;
  if(d.near&&d.nearDist<7){choose(d.near.id,true);return;}
  VIEW.free={id:'free',name:d.region+' · '+d.biome,latin:'LOCVS LIBER',kind:'自由座标',lon:lon,lat:lat,summary:'原文没有为这一处命名。'+d.text+'。神谕只按这里的地貌与所属陆块铺陈场面，不新增国家、城镇或人物。',ref:'按地图地貌推定',local:new T.Vector3().fromArray(sph(lon,lat)).multiplyScalar(surfaceR(lon,lat)+.008)};
  choose('free',true);
}
function renderHud(){
  var s=siteById(VIEW.selected),detail=$('#worldMapDetail'),loose=$('#worldMapLoose'),status=$('#worldMapStatus');
  document.querySelectorAll('#worldMapLayers button').forEach(function(b){b.classList.toggle('on',b.dataset.layer===VIEW.layer);});
  if(status)status.textContent=(VIEW.eraName||'')+' · '+(VIEW.layer==='surface'?'地表与海域':'界门与异空间入口')+(READY?'':' · 星球生成中');
  if(detail){if(s){var d=s.lat!=null&&READY?describe(s.lon,s.lat):null;detail.innerHTML='<b>'+esc(s.name)+'</b><i>'+esc(s.kind||'地点')+(s.latin?' · '+esc(s.latin):'')+'</i><p>'+esc(s.summary||'')+'</p>'+(d?'<p class="wpmGeo">'+esc(d.region)+' · '+esc(d.biome)+' · '+esc(d.elev)+' · '+fmtLon(s.lon)+' '+fmtLat(s.lat)+'</p>':'')+(s.ref?'<p class="wpmRef">原文 · '+esc(s.ref)+'</p>':'');}
    else detail.innerHTML='<b>'+esc(VIEW.eraName||'泛大陆')+'</b><p>点图上的地名看地志；拖动旋转，滚轮向光标缩放，双击定位。</p>';}
  if(loose){var un=ACTIVE.filter(function(x){return x.unplaced;});loose.innerHTML=un.length?'<span>方位未载</span>'+un.map(function(x){return '<button type="button" data-map-site="'+esc(x.id)+'"'+(x.id===VIEW.selected?' class="on"':'')+'>'+esc(x.name)+'</button>';}).join(''):'';}
  try{window.dispatchEvent(new CustomEvent('world-map-change',{detail:inspect()}));}catch(_){}
}

/* ---------- 宿主 ---------- */
function ensureDom(){
  if(canvas)return;canvas=document.createElement('canvas');canvas.className='wpmCv';canvas.tabIndex=0;canvas.setAttribute('aria-label','可拖动旋转、滚轮缩放的泛大陆星球');
  pinLayer=document.createElement('div');pinLayer.className='wpmPins';bindInput();
}
function mount(el,mode){
  if(!el)return;ensureDom();host=el;hostMode=mode;VIEW.mode=mode;
  var wrap=el.querySelector('.wpmHost');if(!wrap){wrap=document.createElement('div');wrap.className='wpmHost';el.appendChild(wrap);}
  wrap.appendChild(canvas);wrap.appendChild(pinLayer);wrap.classList.toggle('space',mode==='forge');
  if(resizeObs)resizeObs.disconnect();if(window.ResizeObserver){resizeObs=new ResizeObserver(function(){resize();});resizeObs.observe(wrap);}
  if(!READY)build();else{applyMode();resize();if(DATA&&!pins.length)buildPins();}
  mini=document.querySelector('#arrMap .mmap');mctx=mini&&mini.getContext('2d');
}
function applyMode(){if(!renderer)return;var forge=hostMode==='forge';if(stars)stars.visible=forge;renderer.setClearColor(forge?0x05070c:0x000000,forge?1:0);cam.tr=forge?Math.max(cam.tr,3.4):4.8;}
function resize(){
  if(!renderer||!canvas)return;var w=canvas.clientWidth||host.clientWidth||300,h=canvas.clientHeight||host.clientHeight||200;if(w<4||h<4)return;
  renderer.setSize(w,h,false);
  var wide=w>h*1.1;if(host&&host.id==='gmMap'){host.classList.toggle('wpmWide',wide);host.classList.toggle('wpmTall',!wide);}
  if(hostMode==='panel'&&wide){var fw=w*1.6;camera.aspect=fw/h;camera.setViewOffset(fw,h,w*.52,0,w,h);}          /* 横版：星球挂左，地志在右 */
  else if(hostMode==='panel'){var fh=h*1.3;camera.aspect=w/fh;camera.setViewOffset(w,fh,0,h*.27,w,h);}             /* 竖版：星球在上，地志在下 */
  else{camera.clearViewOffset();camera.aspect=w/h;}
  camera.updateProjectionMatrix();
}
function visible(){if(!host)return false;if(hostMode==='forge')return host.offsetParent!==null&&document.querySelector('#feWrap.on')&&document.querySelector('#feWrap[data-step="loc"]');var game=$('#game');return !!(game&&game.classList.contains('show')&&(game.classList.contains('mapOpen')||(window.innerWidth<=760&&game.getAttribute('data-pg')==='map')));}
function loop(t){
  raf=requestAnimationFrame(loop);
  var dt=Math.min(.05,(t-lastT)/1000||.016);lastT=t;
  if(!renderer||!visible()){if(mctx&&READY&&$('#game.show'))drawMini();return;}
  cam.r+=(cam.tr-cam.r)*Math.min(1,dt*7);var dragging=canvas.classList.contains('drag');
  if(!dragging){if(cam.tt!=null){var dth=Math.atan2(Math.sin(cam.tt-cam.theta),Math.cos(cam.tt-cam.theta)),dph=cam.tp-cam.phi,k=Math.min(1,dt*5);cam.theta+=dth*k;cam.phi+=dph*k;if(Math.abs(dth)<.002&&Math.abs(dph)<.002)cam.tt=cam.tp=null;}
    else{cam.theta+=cam.vt;cam.phi=clamp(cam.phi+cam.vp,.12,PI-.12);cam.vt*=.9;cam.vp*=.9;}}
  if(!window.REDUCED&&!dragging&&!VIEW.selected&&cam.tt==null&&t-idleAt>6000)spinAngle+=dt*.035;
  group.rotation.y=spinAngle;group.updateMatrixWorld();
  camera.position.set(cam.r*Math.sin(cam.phi)*Math.cos(cam.theta),cam.r*Math.cos(cam.phi),cam.r*Math.sin(cam.phi)*Math.sin(cam.theta));camera.lookAt(0,0,0);camera.updateMatrixWorld();
  sunView.copy(sunDir).transformDirection(camera.matrixWorldInverse);if(clouds)clouds.rotation.y=spinAngle*.06+t*.000012;
  renderer.render(scene,camera);updatePins();if(mctx&&(t|0)%6===0)drawMini();
}
function drawMini(){
  if(!mini||!LAND||!camera)return;var w=mini.width,h=mini.height,cx=w*.5,cy=h*.5,R=Math.min(w,h)*.4;mctx.clearRect(0,0,w,h);mctx.strokeStyle='rgba(126,91,32,.35)';mctx.beginPath();mctx.arc(cx,cy,R,0,PI*2);mctx.stroke();
  var inv=camera.matrixWorldInverse,v=tmpV,step=MOBILE?32:16;mctx.fillStyle='rgba(126,91,32,.6)';
  for(var y=0;y<H;y+=step)for(var x=0;x<W;x+=step){if(!LAND[y*W+x])continue;v.fromArray(sph(lonOf(x),latOf(y))).applyAxisAngle(new T.Vector3(0,1,0),spinAngle);var d=v.clone().normalize().dot(camera.position.clone().normalize());if(d<=0)continue;v.applyMatrix4(inv);mctx.fillRect(cx+v.x*R,cy-v.y*R,1,1);}
}
function worldAt(px,py){if(!camera)return null;var r=canvas.getBoundingClientRect(),nd=new T.Vector3(((px-r.left)/r.width)*2-1,-((py-r.top)/r.height)*2+1,.5).unproject(camera),o=camera.position,d=nd.sub(o).normalize(),b=o.dot(d),c=o.dot(o)-1,disc=b*b-c;if(disc<0)return null;return o.clone().add(d.multiplyScalar(-b-Math.sqrt(disc)));}
function lonLatOf(v){var p=v.clone().applyMatrix4(new T.Matrix4().copy(group.matrixWorld).invert());return [Math.atan2(-p.z,p.x)/D2R,Math.asin(clamp(p.y,-1,1))/D2R];}
function bindInput(){
  var down=false,lx=0,ly=0,moved=0,pinchD=0,ptrs={},lastTap=0;
  canvas.addEventListener('pointerdown',function(e){ptrs[e.pointerId]=e;if(Object.keys(ptrs).length===1){down=true;lx=e.clientX;ly=e.clientY;moved=0;cam.vt=0;cam.vp=0;cam.tt=cam.tp=null;canvas.classList.add('drag');try{canvas.setPointerCapture(e.pointerId);}catch(_){}}});
  canvas.addEventListener('pointermove',function(e){
    if(ptrs[e.pointerId])ptrs[e.pointerId]=e;var ids=Object.keys(ptrs);
    if(ids.length===2){var a=ptrs[ids[0]],b=ptrs[ids[1]],d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);if(pinchD)cam.tr=clamp(cam.tr*(pinchD/d),1.6,6);pinchD=d;idleAt=performance.now();return;}
    if(!down)return;var dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;moved+=Math.abs(dx)+Math.abs(dy);
    var k=.0036*Math.sqrt(cam.r/3)*(cam.r-1)/2.2;cam.vt=dx*k/Math.max(.35,Math.sin(cam.phi));cam.vp=-dy*k;cam.theta+=cam.vt;cam.phi=clamp(cam.phi+cam.vp,.12,PI-.12);idleAt=performance.now();
  });
  function up(e){delete ptrs[e.pointerId];if(Object.keys(ptrs).length<2)pinchD=0;if(!Object.keys(ptrs).length){down=false;canvas.classList.remove('drag');
    if(moved<4&&READY){var now=performance.now(),w=worldAt(e.clientX,e.clientY);if(now-lastTap<320){if(w)flyToWorld(w,Math.max(1.6,cam.tr*.62));}else if(w){var ll=lonLatOf(w);pickFree(ll[0],ll[1]);}lastTap=now;}}}
  canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
  canvas.addEventListener('wheel',function(e){e.preventDefault();e.stopPropagation();if(!camera)return;var r0=cam.tr,r1=clamp(cam.tr*Math.exp(e.deltaY*.0011),1.6,6);cam.tr=r1;idleAt=performance.now();
    if(r1<r0){var w=worldAt(e.clientX,e.clientY);if(w){var n=w.normalize(),f=(1-r1/r0)*1.15,tt=Math.atan2(n.z,n.x),tp=clamp(Math.acos(clamp(n.y,-1,1)),.12,PI-.12),dth=Math.atan2(Math.sin(tt-cam.theta),Math.cos(tt-cam.theta));cam.theta+=dth*f;cam.phi+=(tp-cam.phi)*f;cam.tt=cam.tp=null;}}},{passive:false});
  canvas.addEventListener('keydown',function(e){var st=.05;if(e.key==='ArrowLeft'){cam.theta-=st;}else if(e.key==='ArrowRight'){cam.theta+=st;}else if(e.key==='ArrowUp'){cam.phi=clamp(cam.phi-st,.12,PI-.12);}else if(e.key==='ArrowDown'){cam.phi=clamp(cam.phi+st,.12,PI-.12);}else if(e.key==='+'||e.key==='='){cam.tr=clamp(cam.tr*.85,1.6,6);}else if(e.key==='-'){cam.tr=clamp(cam.tr/.85,1.6,6);}else return;e.preventDefault();cam.tt=cam.tp=null;idleAt=performance.now();});
  var layers=$('#worldMapLayers');if(layers)layers.addEventListener('click',function(e){var b=e.target.closest('[data-layer]');if(!b)return;VIEW.layer=b.dataset.layer;refreshSites();});
  var loose=$('#worldMapLoose');if(loose)loose.addEventListener('click',function(e){var b=e.target.closest('[data-map-site]');if(b)choose(b.dataset.mapSite,false);});
}

/* ---------- 对外 ---------- */
function render(input){var era=input&&input.era?input.era:input;if(era){VIEW.ord=Number(era.ordinal)||VIEW.ord;VIEW.eraName=era.name||'';}applyEra(VIEW.ord);refreshSites();}
function sitesFor(ord,layer){if(!DATA)return [];var o=Number(ord)||VIEW.ord;return DATA.sites.filter(function(s){return o>=(s.from||1)&&o<=(s.to||99)&&s.layer===(layer||'surface');}).map(function(s){return packet(s);});}
function inspect(){return {ready:READY,era:VIEW.ord,eraName:VIEW.eraName,layer:VIEW.layer,mode:VIEW.mode,activeSites:ACTIVE.map(function(s){return s.name;}),selected:VIEW.selected,selectedSite:packet(siteById(VIEW.selected)),zoom:Number(cam.r.toFixed(3)),cartography:DATA&&DATA.cartography,terrain:DATA&&DATA.eraTerrain?DATA.eraTerrain.filter(function(t){return VIEW.ord>=t.from&&VIEW.ord<=(t.to||99);}).map(function(t){return t.label;}):[]};}
var pending=null;
fetch(MAP_URL).then(function(r){if(!r.ok)throw new Error('世界地图资料读取失败（'+r.status+'）');return r.json();}).then(function(d){DATA=d;if(pinLayer&&READY)buildPins();refreshSites();if(pending){var p=pending;pending=null;p();}}).catch(function(e){var d=$('#worldMapDetail');if(d)d.innerHTML='<b>地图没有载入</b><p>'+esc(e.message)+'</p>';});
window.WORLD_PLANET_MAP={
  ready:function(){return READY;},data:function(){return DATA;},render:render,inspect:inspect,sitesFor:sitesFor,select:function(id){choose(id,true);},
  selectCoord:function(lon,lat){pickFree(Number(lon),Number(lat));},
  setLayer:function(l){if(l==='surface'||l==='gateway'){VIEW.layer=l;refreshSites();}},
  onProgress:function(cb){progressCb.push(cb);},onPick:function(cb){onPick=cb;},
  mountForge:function(el){mount(el,'forge');},mountPanel:function(el){mount(el,'panel');},
  whenData:function(cb){if(DATA)cb();else pending=cb;},
  describe:function(lon,lat){return describe(lon,lat);},
  destroy:function(){if(raf)cancelAnimationFrame(raf);raf=0;if(resizeObs)resizeObs.disconnect();}
};
if(!T){var d0=$('#worldMapDetail');if(d0)d0.innerHTML='<b>三维引擎未载入</b><p>星球需要 three.js；请刷新页面。</p>';}
})();
