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

/* ---------- simplex 3D（Ashima/Gustavson 算法，与着色器里的 snoise 逐位一致） ---------- */
function m289(x){return x-Math.floor(x*(1/289))*289;}
function perm(x){return m289(((x*34)+1)*x);}
function tis(r){return 1.79284291400159-0.85373472095314*r;}
var NSX=2/7,NSY=1/14-1,NSZ=1/7;
function n3(vx,vy,vz){
  var s=(vx+vy+vz)/3,ix=Math.floor(vx+s),iy=Math.floor(vy+s),iz=Math.floor(vz+s),t=(ix+iy+iz)/6;
  var x0x=vx-ix+t,x0y=vy-iy+t,x0z=vz-iz+t;
  var gx=x0x>=x0y?1:0,gy=x0y>=x0z?1:0,gz=x0z>=x0x?1:0,lx=1-gx,ly=1-gy,lz=1-gz;
  var i1x=Math.min(gx,lz),i1y=Math.min(gy,lx),i1z=Math.min(gz,ly),i2x=Math.max(gx,lz),i2y=Math.max(gy,lx),i2z=Math.max(gz,ly);
  var x1x=x0x-i1x+1/6,x1y=x0y-i1y+1/6,x1z=x0z-i1z+1/6,x2x=x0x-i2x+1/3,x2y=x0y-i2y+1/3,x2z=x0z-i2z+1/3,x3x=x0x-.5,x3y=x0y-.5,x3z=x0z-.5;
  ix=m289(ix);iy=m289(iy);iz=m289(iz);
  var p0=perm(perm(perm(iz)+iy)+ix),p1=perm(perm(perm(iz+i1z)+iy+i1y)+ix+i1x),p2=perm(perm(perm(iz+i2z)+iy+i2y)+ix+i2x),p3=perm(perm(perm(iz+1)+iy+1)+ix+1);
  var n=0,P=[p0,p1,p2,p3],X=[x0x,x1x,x2x,x3x],Y=[x0y,x1y,x2y,x3y],Z=[x0z,x1z,x2z,x3z],k;
  for(k=0;k<4;k++){
    var j=P[k]-49*Math.floor(P[k]*NSZ*NSZ),x_=Math.floor(j*NSZ),y_=Math.floor(j-7*x_),x=x_*NSX+NSY,y=y_*NSX+NSY,h=1-Math.abs(x)-Math.abs(y);
    var sh=h<=0?-1:0,gx_=x+(Math.floor(x)*2+1)*sh,gy_=y+(Math.floor(y)*2+1)*sh,gz_=h;
    var nm=tis(gx_*gx_+gy_*gy_+gz_*gz_);gx_*=nm;gy_*=nm;gz_*=nm;
    var m=.6-(X[k]*X[k]+Y[k]*Y[k]+Z[k]*Z[k]);if(m<0)m=0;m*=m;
    n+=m*m*(gx_*X[k]+gy_*Y[k]+gz_*Z[k]);
  }
  return 42*n;
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
var HGT,HPRE,LAND,RIV,RNG,ALB,NRM,RGH,EMI0,EMI,DSP,FILL,CW=1024,CH=512,CLD,LW,LH,DIST;
var ANALYTIC=!MOBILE;   /* 桌面：海岸线与湖岸在着色器里逐像素解析，不受贴图分辨率限制 */
function alloc(){HGT=new Float32Array(W*H);HPRE=new Float32Array(W*H);FILL=new Uint8Array(W*H);LAND=new Uint8Array(W*H);RIV=new Uint8Array(W*H);RNG=new Float32Array(W*H);ALB=new Uint8Array(W*H*4);NRM=new Uint8Array(W*H*4);RGH=new Uint8Array(W*H*4);EMI0=new Uint8Array(W*H*4);EMI=new Uint8Array(W*H*4);DSP=new Uint8Array(W*H*4);CLD=new Uint8Array(CW*CH*4);LW=W/4;LH=H/4;DIST=new Float32Array(LW*LH);}
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
    HPRE[idx]=h;
    h-=.5*gauss(lon,lat,36,27,3.2);if(h<.012&&h>-.02)h=.012;
  }else{HPRE[idx]=0;coast=sstep(0.02,-.4,f);h=-(.06+.9*coast)+.06*fbm(p[0]*3+5,p[1]*3,p[2]*3,4)*coast-.06*R;if(h>-.02)h=-.02;}
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
  DSP[i4]=clamp(Math.max(0,h)/1.15,0,1)*255;DSP[i4+1]=clamp(-h,0,1)*255;DSP[i4+2]=clamp(HPRE[idx]/1.15,0,1)*255;DSP[i4+3]=255;
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
/* 陆色外扩（仅解析海岸线模式）：海侧纹素填最近的陆色，海水改由着色器按解析海岸线绘制 */
function dilate(x0,y0,x1,y1,nx){
  if(!ANALYTIC)return;var pass,x,y,k,idx,i4,dx,dy,n,cand;
  for(y=y0;y<=y1;y++)for(x=0;x<=nx;x++){idx=y*W+((x0+x)%W);FILL[idx]=LAND[idx]?255:0;}
  for(pass=1;pass<=4;pass++){cand=[];
    for(y=Math.max(0,y0);y<=Math.min(H-1,y1);y++)for(x=0;x<=nx;x++){idx=y*W+((x0+x)%W);if(FILL[idx])continue;
      for(dy=-1;dy<=1&&!cand[cand.length-1]!==idx;dy++)for(dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;var yy=y+dy;if(yy<0||yy>=H)continue;n=yy*W+((idx%W)+dx+W)%W;var fv=FILL[n];if(fv===255||(fv>0&&fv<pass)){cand.push(idx,n);dy=2;break;}}}
    for(k=0;k<cand.length;k+=2){idx=cand[k];n=cand[k+1];i4=idx*4;var j4=n*4;ALB[i4]=ALB[j4];ALB[i4+1]=ALB[j4+1];ALB[i4+2]=ALB[j4+2];RGH[i4+1]=RGH[j4+1];FILL[idx]=pass;}}
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
    if(pa.h){for(y=Math.max(0,y0-1);y<=Math.min(H-1,y1+1);y++)for(x=-1;x<=n+1;x++)normalPx((x0+x+W)%W,y);dilate(x0,y0,x1,y1,n);}}
  if(SHU){SHU.uBlobOn.value[15]=F.cause?1:0;SHU.uBlobOn.value[16]=F.nc?1:0;SHU.uBlobOn.value[17]=F.nc?1:0;}
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
        prog(.86,'点亮城市灯火');setTimeout(function(){for(var y=0;y<H;y++)for(var x=0;x<W;x++)normalPx(x,y);dilate(0,0,W-1,H-1,W-1);prog(.92,'拂过云鲸之息');
          setTimeout(function(){genClouds();READY=true;BUILDING=false;initPlanet();applyEra(VIEW.ord);prog(1,'升起');refreshSites();},20);},20);});},20);});
}

/* ---------- 场景 ---------- */
var SHU=null,renderer,scene,camera,planet,proto,cosmos,nebula,sunGlow,group,clouds,sunDir=T?new T.Vector3(5,1.6,2.8).normalize():null,sunView=T?new T.Vector3():null,atmoIn,atmoOut,rail,isle,stars,TEXS=null,DISP=.04;
var cam={theta:1.22,phi:1.15,r:4.6,vt:0,vp:0,tr:3.6,tt:null,tp:null},idleAt=0,spinAngle=0,lastT=0,raf=0;
var VIEW={ord:16,eraName:'',layer:'surface',mode:'forge',selected:null,free:null};
var canvas=null,pinLayer=null,host=null,hostMode='',onPick=null,resizeObs=null,mini=null,mctx=null;
function tex(data,w,h,srgb){var t=new T.DataTexture(data,w,h,T.RGBAFormat);t.flipY=false;t.wrapS=T.RepeatWrapping;t.wrapT=T.ClampToEdgeWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;if(srgb)t.encoding=T.sRGBEncoding;t.needsUpdate=true;return t;}
/* ---------- 宇宙场景（立即建立：星野、星云、远行星、太阳辉光、占位星球） ---------- */
function canvasTex(w,h,fn){var c=document.createElement('canvas');c.width=w;c.height=h;var g=c.getContext('2d'),img=g.createImageData(w,h);fn(img.data,w,h);g.putImageData(img,0,0);var t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;return t;}
function glowTex(){var c=document.createElement('canvas');c.width=c.height=128;var g=c.getContext('2d'),r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.18,'rgba(255,255,255,.75)');r.addColorStop(.5,'rgba(255,255,255,.12)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,128,128);return new T.CanvasTexture(c);}
function nebulaTex(){
  var w=MOBILE?512:1024,h=w/2;
  return canvasTex(w,h,function(d,w,h){var x,y,i4,lon,lat,p,ax=[0.42,0.62,-0.66];
    for(y=0;y<h;y++){lat=(y+.5)/h*180-90;for(x=0;x<w;x++){lon=(x+.5)/w*360-180;p=sph(lon,lat,v3);i4=(y*w+x)*4;
      var band=p[0]*ax[0]+p[1]*ax[1]+p[2]*ax[2];band=Math.exp(-band*band*9);
      var f1=fbm(p[0]*2.3+7,p[1]*2.3,p[2]*2.3,5,2.1,.55)*.5+.5,f2=fbm(p[0]*4.1,p[1]*4.1+3,p[2]*4.1,4)*.5+.5,f3=fbm(p[0]*9+1,p[1]*9,p[2]*9,3)*.5+.5;
      var dust=Math.pow(f1,1.6)*(.25+.75*band),teal=sstep(.5,.8,f2)*band,ember=sstep(.55,.85,f1)*sstep(.4,.8,f3)*(.2+.8*band),milk=band*(.4+.6*f2);
      var r=6+dust*85+teal*28+ember*220+milk*56,g=8+dust*100+teal*150+ember*105+milk*62,b=16+dust*150+teal*190+ember*80+milk*84;
      var dark=1-.45*sstep(.55,.9,f3)*band;r*=dark;g*=dark;b*=dark;
      d[i4]=Math.min(255,r);d[i4+1]=Math.min(255,g);d[i4+2]=Math.min(255,b);d[i4+3]=255;}}});
}
function planetTex(kind){
  var w=512,h=256;
  return canvasTex(w,h,function(d,w,h){var x,y,i4,lon,lat,p;
    for(y=0;y<h;y++){lat=(y+.5)/h*180-90;for(x=0;x<w;x++){lon=(x+.5)/w*360-180;p=sph(lon,lat,v3);i4=(y*w+x)*4;var r,g,b;
      if(kind==='giant'){var tw=n3(p[0]*3,p[1]*3,p[2]*3)*.35,bd=Math.sin((lat*.19+tw)*7)*.5+.5,st=fbm(p[0]*6,p[1]*2,p[2]*6,4)*.5+.5;
        r=95+75*bd-40*st;g=70+50*bd-30*st;b=45+30*bd-15*st;var spot=Math.exp(-(Math.pow(wrapLon(lon-40)/22,2)+Math.pow((lat+18)/7,2)));r+=70*spot;g-=5*spot;b-=15*spot;}
      else if(kind==='moon'){var c=fbm(p[0]*7,p[1]*7,p[2]*7,5)*.5+.5,cr=1-Math.abs(n3(p[0]*14,p[1]*14,p[2]*14));r=g=b=70+90*c-35*cr*cr;b+=6;}
      else{var f=fbm(p[0]*4+2,p[1]*4,p[2]*4,4)*.5+.5,ice=sstep(.55,.85,Math.abs(p[1]));r=40+60*f;g=70+70*f;b=120+90*f;r=lerp(r,215,ice);g=lerp(g,225,ice);b=lerp(b,235,ice);}
      d[i4]=Math.max(0,Math.min(255,r));d[i4+1]=Math.max(0,Math.min(255,g));d[i4+2]=Math.max(0,Math.min(255,b));d[i4+3]=255;}}});
}
function ringTex(){var c=document.createElement('canvas');c.width=256;c.height=4;var g=c.getContext('2d');for(var x=0;x<256;x++){var t=x/255,a=(.35+.65*Math.pow(Math.abs(n3(t*22,1.7,0)),.8))*(1-sstep(.9,1,t))*sstep(0,.08,t)*(t>.56&&t<.62?.25:1);g.fillStyle='rgba(205,190,160,'+a.toFixed(3)+')';g.fillRect(x,0,1,4);}return new T.CanvasTexture(c);}
function initSpace(){
  if(renderer)return;
  try{renderer=new T.WebGLRenderer({canvas:canvas,antialias:true,alpha:true,powerPreference:'high-performance'});}catch(e){renderer=null;prog(1,'此设备不支持 WebGL');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.setClearColor(0x000000,0);
  scene=new T.Scene();camera=new T.PerspectiveCamera(38,1,.05,120);group=new T.Group();scene.add(group);cosmos=new T.Group();scene.add(cosmos);
  proto=new T.Mesh(new T.SphereGeometry(1,96,48),new T.MeshStandardMaterial({color:0x03070d,roughness:1,metalness:0}));group.add(proto);
  var atmoV='varying vec3 vN; varying vec3 vW; void main(){ vN = normalize( normalMatrix * normal ); vW = normalize( ( modelMatrix * vec4( position, 1.0 ) ).xyz ); gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }';
  atmoOut=new T.Mesh(new T.SphereGeometry(1.09,96,48),new T.ShaderMaterial({uniforms:{uSunW:{value:sunDir}},vertexShader:atmoV,fragmentShader:'varying vec3 vN; varying vec3 vW; uniform vec3 uSunW; void main(){ float i = pow( 0.52 - dot( vN, vec3( 0.0, 0.0, 1.0 ) ), 3.2 ); float day = smoothstep( -0.35, 0.45, dot( vW, uSunW ) ); vec3 c = mix( vec3( 0.36, 0.55, 0.95 ), vec3( 0.95, 0.62, 0.36 ), pow( 1.0 - day, 3.0 ) * 0.6 ); gl_FragColor = vec4( c * i * ( 0.15 + 0.85 * day ), 1.0 ); }',side:T.BackSide,blending:T.AdditiveBlending,transparent:true,depthWrite:false}));scene.add(atmoOut);
  atmoIn=new T.Mesh(new T.SphereGeometry(1.02,128,64),new T.ShaderMaterial({uniforms:{uSunW:{value:sunDir}},vertexShader:atmoV,fragmentShader:'varying vec3 vN; varying vec3 vW; uniform vec3 uSunW; void main(){ float f = pow( 1.0 - max( 0.0, dot( vN, vec3( 0.0, 0.0, 1.0 ) ) ), 3.5 ); float day = smoothstep( -0.3, 0.5, dot( vW, uSunW ) ); vec3 c = mix( vec3( 0.42, 0.62, 1.0 ), vec3( 1.0, 0.55, 0.3 ), pow( 1.0 - day, 2.0 ) * 0.5 ); gl_FragColor = vec4( c * f * 0.55 * ( 0.12 + 0.88 * day ), 1.0 ); }',side:T.FrontSide,blending:T.AdditiveBlending,transparent:true,depthWrite:false}));scene.add(atmoIn);
  var sun=new T.DirectionalLight(0xfff2dc,2.35);sun.position.copy(sunDir).multiplyScalar(10);scene.add(sun);scene.add(new T.AmbientLight(0x2a3140,.55));scene.add(new T.HemisphereLight(0x3b4a66,0x120c08,.22));
  var glow=glowTex(),save=seed;seed=777;
  function starCloud(N,rad,sizeF,spread,center,bright){var pos=new Float32Array(N*3),col=new Float32Array(N*3),i;
    for(i=0;i<N;i++){var th,ph,vx,vy,vz;if(center){vx=center[0]+(rnd()+rnd()+rnd()-1.5)*spread;vy=center[1]+(rnd()+rnd()+rnd()-1.5)*spread;vz=center[2]+(rnd()+rnd()+rnd()-1.5)*spread;}
      else{th=rnd()*PI*2;ph=Math.acos(2*rnd()-1);vx=Math.sin(ph)*Math.cos(th);vy=Math.cos(ph);vz=Math.sin(ph)*Math.sin(th);}
      var l=Math.sqrt(vx*vx+vy*vy+vz*vz);pos[i*3]=vx/l*rad;pos[i*3+1]=vy/l*rad;pos[i*3+2]=vz/l*rad;
      var b=(.3+Math.pow(rnd(),2.6)*.7)*bright,tint=rnd();col[i*3]=b*(tint<.18?.72:tint>.9?1:.95);col[i*3+1]=b*(tint<.18?.8:tint>.9?.9:.95);col[i*3+2]=b*(tint<.18?1.05:tint>.9?.72:1);}
    var g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('color',new T.BufferAttribute(col,3));
    return new T.Points(g,new T.PointsMaterial({size:sizeF,map:glow,vertexColors:true,sizeAttenuation:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));}
  stars=new T.Group();
  stars.add(starCloud(MOBILE?2500:7000,52,.32,0,null,.9));
  stars.add(starCloud(MOBILE?120:360,50,1.5,0,null,1.2));
  stars.add(starCloud(MOBILE?300:900,48,.55,3.2,[-22,9,-40],1.1));
  stars.add(starCloud(MOBILE?200:600,48,.4,5,[30,-14,-30],.8));
  scene.add(stars);seed=save;
  nebula=new T.Mesh(new T.SphereGeometry(58,48,24),new T.MeshBasicMaterial({map:nebulaTex(),side:T.BackSide,depthWrite:false}));scene.add(nebula);
  sunGlow=new T.Sprite(new T.SpriteMaterial({map:glow,color:0xffe6b0,transparent:true,blending:T.AdditiveBlending,depthWrite:false,opacity:.9}));sunGlow.position.copy(sunDir).multiplyScalar(50);sunGlow.scale.set(14,14,1);scene.add(sunGlow);
  var giant=new T.Mesh(new T.SphereGeometry(1.5,48,24),new T.MeshStandardMaterial({map:planetTex('giant'),roughness:1}));giant.userData.at=[-6.8,2.3,17];giant.userData.tilt=true;cosmos.add(giant);
  var ring=new T.Mesh(new T.RingGeometry(2.05,3.4,96,1),new T.MeshStandardMaterial({map:ringTex(),transparent:true,side:T.DoubleSide,roughness:.9,depthWrite:false}));
  var rg=ring.geometry,uv=rg.attributes.uv,pos=rg.attributes.position;for(var i=0;i<uv.count;i++){var rr=Math.hypot(pos.getX(i),pos.getY(i));uv.setXY(i,(rr-2.05)/1.35,.5);}
  ring.rotation.x=PI/2;giant.add(ring);
  var moon=new T.Mesh(new T.SphereGeometry(.42,32,16),new T.MeshStandardMaterial({map:planetTex('moon'),roughness:1}));moon.userData.at=[2.9,-1.7,9];cosmos.add(moon);
  var blue=new T.Mesh(new T.SphereGeometry(.7,32,16),new T.MeshStandardMaterial({map:planetTex('blue'),roughness:.8}));blue.userData.at=[6.5,3.6,24];cosmos.add(blue);
  cosmos.userData={giant:giant,moon:moon,blue:blue};
  applyMode();resize();if(!raf)raf=requestAnimationFrame(loop);
}
/* ---------- 主星球（贴图生成完毕后建立） ---------- */
function initPlanet(){
  if(!renderer)return;
  if(proto){group.remove(proto);proto=null;}
  var an=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  var mAlb=tex(ALB,W,H,true),mNrm=tex(NRM,W,H,false),mRgh=tex(RGH,W,H,false),mEmi=tex(EMI,W,H,true),mDsp=tex(DSP,W,H,false);TEXS=[mAlb,mNrm,mRgh,mEmi,mDsp];TEXS.forEach(function(t){t.anisotropy=an;});
  var mat=new T.MeshStandardMaterial({map:mAlb,normalMap:mNrm,normalScale:new T.Vector2(1,1),roughnessMap:mRgh,roughness:1,metalness:0,emissive:new T.Color(0xffffff),emissiveMap:mEmi,emissiveIntensity:1.1,displacementMap:mDsp,displacementScale:DISP});
  var sunU={value:sunView};
  var lin=function(c){var k=new T.Color(c[0]/255,c[1]/255,c[2]/255).convertSRGBToLinear();return new T.Vector3(k.r,k.g,k.b);};
  SHU={uSun:sunU,uBlobs:{value:BLOBS.concat([BLOB_CAUSE],BLOB_NC).map(function(b){return new T.Vector4(b[0],b[1],b[2],b[3]);})},uBlobOn:{value:BLOBS.map(function(){return 1;}).concat([0,0,0])},
    uTime:{value:0},uBump:{value:0},uHgt:{value:mDsp},uShoal:{value:lin(COL.shoal)},uShelf:{value:lin(COL.shelf)},uDeep:{value:lin(COL.deep)},uLake:{value:lin(COL.lake)},uSand:{value:lin(COL.sand)}};
  var GLSL_NOISE='vec3 m289v3(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}\nvec4 m289v4(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}\nvec4 permv4(vec4 x){return m289v4(((x*34.0)+1.0)*x);}\nvec4 tisv4(vec4 r){return 1.79284291400159-0.85373472095314*r;}\n'
   +'float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=m289v3(i);vec4 p=permv4(permv4(permv4(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);vec4 norm=tisv4(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}\n'
   +'float wrapLonG(float d){return mod(d+540.0,360.0)-180.0;}\nfloat blobG(vec4 b,float lon,float lat){float dl=wrapLonG(lon-b.x)/b.z;float dy=(lat-b.y)/b.w;return 1.0-sqrt(dl*dl+dy*dy);}\n'
   +'float maskG(float lon,float lat){float f=-9.0;for(int i=0;i<18;i++){if(uBlobOn[i]>0.5)f=max(f,blobG(uBlobs[i],lon,lat));}return max(f,(-lat-72.0)/6.0);}\n'
   +'float fbm4(vec3 p){float a=1.0,s=0.0,n=0.0;for(int i=0;i<4;i++){s+=a*snoise(p);n+=a;p*=2.0;a*=0.5;}return s/n;}\n'
   +'float gaussG(float lon,float lat,float cl,float ct,float s){float dl=wrapLonG(lon-cl)*cos(ct*0.017453292);float dy=lat-ct;return exp(-(dl*dl+dy*dy)/(s*s));}\n'
   +'vec3 bumpArb(vec3 sp,vec3 sn,vec2 dH){vec3 sx=vec3(dFdx(sp.x),dFdx(sp.y),dFdx(sp.z));vec3 sy=vec3(dFdy(sp.x),dFdy(sp.y),dFdy(sp.z));vec3 r1=cross(sy,sn);vec3 r2=cross(sn,sx);float det=dot(sx,r1);vec3 g=sign(det)*(dH.x*r1+dH.y*r2);return normalize(abs(det)*sn-g);}\n';
  var PRELUDE='vec3 sp=normalize(vSph);float latG=asin(clamp(sp.y,-1.0,1.0))*57.29577951;float lonG=atan(-sp.z,sp.x)*57.29577951;'
   +'float wxG=snoise(vec3(sp.x*1.7+3.1,sp.y*1.7,sp.z*1.7));float wyG=snoise(vec3(sp.x*1.7,sp.y*1.7+7.3,sp.z*1.7));'
   +'float lonW=lonG+10.0*wxG+3.0*snoise(vec3(sp.x*5.0+1.0,sp.y*5.0,sp.z*5.0));float latW=latG+8.0*wyG+2.5*snoise(vec3(sp.x*5.0,sp.y*5.0+2.0,sp.z*5.0));'
   +'float gF=maskG(lonW,latW)+0.16*fbm4(sp*2.4);float gCoast=gF-0.02;float gAA=max(fwidth(gCoast),1e-5)*0.8;float gLand=smoothstep(-gAA,gAA,gCoast);float gWater=1.0-gLand;';
  var MAPFRAG='#ifdef USE_MAP\n vec4 texelColor=texture2D(map,vUv);texelColor=mapTexelToLinear(texelColor);vec3 landCol=texelColor.rgb;'
   +'vec3 dspT=texture2D(uHgt,vUv).rgb;float lakeV=0.5*gaussG(lonG,latG,36.0,27.0,3.2)-dspT.b*1.15;float lakeAA=max(fwidth(lakeV),1e-5);float gLake=smoothstep(-lakeAA,lakeAA,lakeV)*gLand;'
   +'float depth=smoothstep(0.02,-0.4,gF);float onz=snoise(sp*3.0+vec3(5.0,0.0,0.0));float dd=0.06+0.9*depth+0.06*onz*depth;'
   +'vec3 ocean=mix(uShoal,uShelf,smoothstep(0.0,0.12,dd));ocean=mix(ocean,uDeep,smoothstep(0.08,0.55,dd));ocean*=1.0+0.06*(snoise(sp*38.0)*0.5+snoise(sp*90.0)*0.25);'
   +'float lum=dot(landCol,vec3(0.3333));float beach=smoothstep(0.045,0.0,gCoast)*(1.0-smoothstep(0.45,0.7,lum))*0.75;landCol=mix(landCol,uSand,beach);'
   +'vec3 water=mix(ocean,uLake*(0.9+0.2*depth),gLake);gWater=max(gWater,gLake);'
   +'diffuseColor.rgb*=mix(landCol,water,gWater);\n#endif';
  var ROUGHFRAG='float roughnessFactor=roughness;\n#ifdef USE_ROUGHNESSMAP\n vec4 texelRoughness=texture2D(roughnessMap,vUv);roughnessFactor*=mix(texelRoughness.g,0.3,gWater);\n#endif';
  var NORMALX='normal=normalize(mix(normal,normalize(vNormal),gWater));'
   +'{float mh=gWater>0.5?(snoise(sp*360.0+vec3(uTime*0.03))*0.5+snoise(sp*820.0-vec3(0.0,uTime*0.02,0.0))*0.25)*0.12:(snoise(sp*110.0)*0.5+snoise(sp*280.0)*0.25+(1.0-abs(snoise(sp*62.0)))*texture2D(uHgt,vUv).r*0.7);'
   +'vec2 dH=vec2(dFdx(mh),dFdy(mh))*uBump;normal=bumpArb(-vViewPosition,normal,dH);}';
  var EMIFRAG='#ifdef USE_EMISSIVEMAP\n vec4 emissiveColor = texture2D( emissiveMap, vUv );\n emissiveColor.rgb = emissiveMapTexelToLinear( emissiveColor ).rgb;\n float ndl = dot( normalize( normal ), uSun );\n float night = smoothstep( 0.18, -0.16, ndl );\n totalEmissiveRadiance *= emissiveColor.rgb * mix( 0.05, 1.0, night );\n#endif';

  mat.onBeforeCompile=function(s){
    for(var k in SHU)s.uniforms[k]=SHU[k];
    if(ANALYTIC){
      s.vertexShader='varying vec3 vSph;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vSph = normalize( position );');
      s.fragmentShader=s.fragmentShader.replace('uniform vec3 emissive;','uniform vec3 emissive; uniform vec3 uSun; varying vec3 vSph; uniform vec4 uBlobs[18]; uniform float uBlobOn[18]; uniform float uTime; uniform float uBump; uniform sampler2D uHgt; uniform vec3 uShoal; uniform vec3 uShelf; uniform vec3 uDeep; uniform vec3 uLake; uniform vec3 uSand;\n'+GLSL_NOISE)
        .replace('void main() {','void main() {\n'+PRELUDE).replace('#include <map_fragment>',MAPFRAG).replace('#include <roughnessmap_fragment>',ROUGHFRAG)
        .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n'+NORMALX).replace('#include <emissivemap_fragment>',EMIFRAG);
    }else{
      s.fragmentShader=s.fragmentShader.replace('uniform vec3 emissive;','uniform vec3 emissive; uniform vec3 uSun;').replace('#include <emissivemap_fragment>',EMIFRAG);
    }
  };
  planet=new T.Mesh(new T.SphereGeometry(1,MOBILE?256:768,MOBILE?128:384),mat);group.add(planet);
  clouds=new T.Mesh(new T.SphereGeometry(1.022,128,64),new T.MeshStandardMaterial({map:tex(CLD,CW,CH,true),transparent:true,depthWrite:false,roughness:1,metalness:0,opacity:.92}));group.add(clouds);
  rail=makeArc(-92,44,-8,33,0xd6a64e);group.add(rail);isle=makeIsle(-35,64);group.add(isle);
  buildPins();applyMode();resize();
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
  wrap.appendChild(canvas);wrap.appendChild(pinLayer);wrap.classList.toggle('space',mode==='forge'||mode==='menu');wrap.classList.toggle('menu',mode==='menu');pinLayer.style.display=mode==='menu'?'none':'';
  if(resizeObs)resizeObs.disconnect();if(window.ResizeObserver){resizeObs=new ResizeObserver(function(){resize();});resizeObs.observe(wrap);}
  initSpace();if(!READY)build();else{if(DATA&&!pins.length)buildPins();}
  applyMode();resize();
  mini=document.querySelector('#arrMap .mmap');mctx=mini&&mini.getContext('2d');
}
function applyMode(){if(!renderer)return;var space=hostMode==='forge'||hostMode==='menu';if(stars)stars.visible=space;if(nebula)nebula.visible=space;if(cosmos)cosmos.visible=hostMode==='menu';if(sunGlow)sunGlow.visible=space;
  renderer.setClearColor(space?0x05070c:0x000000,space?1:0);cam.tr=hostMode==='menu'?5.7:hostMode==='forge'?Math.max(cam.tr,3.4):4.8;if(hostMode==='menu'){cam.tt=cam.tp=null;cam.phi=1.22;}}
function resize(){
  if(!renderer||!canvas)return;var w=canvas.clientWidth||host.clientWidth||300,h=canvas.clientHeight||host.clientHeight||200;if(w<4||h<4)return;
  renderer.setSize(w,h,false);
  var wide=w>h*1.1;if(host&&host.id==='gmMap'){host.classList.toggle('wpmWide',wide);host.classList.toggle('wpmTall',!wide);}
  if(hostMode==='menu'){var mw=w*(wide?1.18:1.0),mh=h*1.22;camera.aspect=mw/mh;camera.setViewOffset(mw,mh,wide?w*.03:0,h*.2,w,h);}
  else if(hostMode==='panel'&&wide){var fw=w*1.6;camera.aspect=fw/h;camera.setViewOffset(fw,h,w*.52,0,w,h);}          /* 横版：星球挂左，地志在右 */
  else if(hostMode==='panel'){var fh=h*1.3;camera.aspect=w/fh;camera.setViewOffset(w,fh,0,h*.27,w,h);}             /* 竖版：星球在上，地志在下 */
  else{camera.clearViewOffset();camera.aspect=w/h;}
  camera.updateProjectionMatrix();
}
function visible(){if(!host)return false;if(hostMode==='menu')return !!document.querySelector('#menu.show:not(.era):not(.gbg)');if(hostMode==='forge')return host.offsetParent!==null&&document.querySelector('#feWrap.on')&&document.querySelector('#feWrap[data-step="loc"]');var game=$('#game');return !!(game&&game.classList.contains('show')&&(game.classList.contains('mapOpen')||(window.innerWidth<=760&&game.getAttribute('data-pg')==='map')));}
function loop(t){
  raf=requestAnimationFrame(loop);
  var dt=Math.min(.05,(t-lastT)/1000||.016);lastT=t;
  if(!renderer||!visible()){if(mctx&&READY&&$('#game.show'))drawMini();return;}
  cam.r+=(cam.tr-cam.r)*Math.min(1,dt*7);var dragging=canvas.classList.contains('drag');
  if(hostMode==='menu'){spinAngle+=dt*.05;cam.theta+=dt*.011;cam.phi=1.2+.06*Math.sin(t*.00006);nebula.rotation.y=t*.000004;stars.rotation.y=t*.000007;
    var cu=cosmos.userData;cu.moon.rotation.y=t*.00009;cu.blue.rotation.y=t*.00006;}
  if(!dragging){if(cam.tt!=null){var dth=Math.atan2(Math.sin(cam.tt-cam.theta),Math.cos(cam.tt-cam.theta)),dph=cam.tp-cam.phi,k=Math.min(1,dt*5);cam.theta+=dth*k;cam.phi+=dph*k;if(Math.abs(dth)<.002&&Math.abs(dph)<.002)cam.tt=cam.tp=null;}
    else{cam.theta+=cam.vt;cam.phi=clamp(cam.phi+cam.vp,.12,PI-.12);cam.vt*=.9;cam.vp*=.9;}}
  if(hostMode!=='menu'&&!window.REDUCED&&!dragging&&!VIEW.selected&&cam.tt==null&&t-idleAt>6000)spinAngle+=dt*.035;
  group.rotation.y=spinAngle;group.updateMatrixWorld();
  camera.position.set(cam.r*Math.sin(cam.phi)*Math.cos(cam.theta),cam.r*Math.cos(cam.phi),cam.r*Math.sin(cam.phi)*Math.sin(cam.theta));camera.lookAt(0,0,0);camera.updateMatrixWorld();
  if(hostMode==='menu'){var fw=new T.Vector3();camera.getWorldDirection(fw);var rt=new T.Vector3().crossVectors(fw,camera.up).normalize(),upv=new T.Vector3().crossVectors(rt,fw).normalize();
    cosmos.children.forEach(function(o){var a=o.userData.at;if(!a)return;o.position.copy(camera.position).addScaledVector(rt,a[0]).addScaledVector(upv,a[1]).addScaledVector(fw,a[2]);
      if(o.userData.tilt){o.quaternion.copy(camera.quaternion);o.rotateX(-.55);o.rotateZ(.32);o.rotateY(t*.00004);}});}
  sunView.copy(sunDir).transformDirection(camera.matrixWorldInverse);if(clouds)clouds.rotation.y=spinAngle*.06+t*.000012;if(proto)proto.rotation.y=spinAngle;
  if(SHU){SHU.uTime.value=t*.001;SHU.uBump.value=.0007*sstep(4.6,1.7,cam.r);}
  renderer.render(scene,camera);if(hostMode!=='menu')updatePins();if(mctx&&(t|0)%6===0)drawMini();
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
  mountForge:function(el){mount(el,'forge');},mountPanel:function(el){mount(el,'panel');},mountMenu:function(el){mount(el,'menu');},
  whenData:function(cb){if(DATA)cb();else pending=cb;},
  describe:function(lon,lat){return describe(lon,lat);},
  destroy:function(){if(raf)cancelAnimationFrame(raf);raf=0;if(resizeObs)resizeObs.disconnect();}
};
if(!T){var d0=$('#worldMapDetail');if(d0)d0.innerHTML='<b>三维引擎未载入</b><p>星球需要 three.js；请刷新页面。</p>';}
})();
