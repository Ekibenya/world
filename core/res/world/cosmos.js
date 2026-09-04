/* 正文舞台的底：星云与星星，会动。
   菜单那一片是 three.js 画的（world-planet-map 的 mountMenu），但整个仓库只有一块
   WebGL 画布，进对局之后它归地图面板用，正文这边借不到。所以这里用 2D 画布另画一份，
   照着菜单的语汇来：同一片深空底色、紫与洋红的星云、缓慢横移的星原。
   自己造一块画布挂进 #game，不借 #gTerr：那块是 cat 画山脊剪影用的旧画布，
   壳样式把它 display:none 了，engine.js 里还留着一个会重设它 width 的 gTerrDraw，
   借来用等于把自己的底交给别人管。z-index:-1 让它落在 #game 的背景之上、
   一切子元素之下；#game::before 那道暗角仍压在最上面。 */
(function () {
  'use strict';

  var ID = 'worldCosmos';
  var C = null, X = null, W = 0, H = 0, DPR = 1;
  var NEB = null, NX = null, NW = 0, NH = 0, nebAt = -1e9;
  var stars = [], raf = 0, last = 0, acc = 0, drawnOnce = false;

  /* 星云：七团彩雾，各走各的李萨如轨迹，各自呼吸。
     画在三分之一大小的离屏画布上再放大铺开——渐变本来就软，放大反而更像云，
     而且每半秒才重画一次，逐帧只剩一次 drawImage。
     六分之一试过，放大后 8 位色的渐变会踩出一层层横纹；三分之一就看不出来了。 */
  var CLOUDS = [
    { h: 258, s: 46, l: 34, r: .62, x: .18, y: .20, ax: .07, ay: .05, sp: .011, ph: 0.0, a: .50 },
    { h: 318, s: 44, l: 30, r: .54, x: .84, y: .78, ax: .06, ay: .06, sp: .008, ph: 1.7, a: .38 },
    { h: 220, s: 52, l: 30, r: .74, x: .58, y: .32, ax: .05, ay: .04, sp: .006, ph: 3.1, a: .42 },
    { h: 282, s: 40, l: 28, r: .46, x: .34, y: .70, ax: .08, ay: .05, sp: .013, ph: 4.4, a: .30 },
    { h: 196, s: 48, l: 28, r: .40, x: .72, y: .16, ax: .06, ay: .07, sp: .010, ph: 2.2, a: .26 },
    { h: 340, s: 38, l: 26, r: .34, x: .12, y: .56, ax: .05, ay: .06, sp: .015, ph: 5.6, a: .22 },
    { h: 240, s: 34, l: 22, r: .90, x: .50, y: .50, ax: .03, ay: .03, sp: .004, ph: 0.9, a: .30 }
  ];

  function paintNebula(t) {
    if (!NX) return;
    NX.clearRect(0, 0, NW, NH);
    NX.globalCompositeOperation = 'lighter';
    var d = Math.min(NW, NH);
    for (var i = 0; i < CLOUDS.length; i++) {
      var c = CLOUDS[i], u = t * c.sp * 0.001 + c.ph;
      var cx = (c.x + Math.cos(u) * c.ax) * NW;
      var cy = (c.y + Math.sin(u * 0.83) * c.ay) * NH;
      var rr = c.r * d * (0.90 + 0.10 * Math.sin(u * 0.61));   /* 呼吸 */
      var g = NX.createRadialGradient(cx, cy, 0, cx, cy, rr);
      var a = c.a * (0.86 + 0.14 * Math.sin(u * 0.47 + 1.3));
      g.addColorStop(0, 'hsla(' + c.h + ',' + c.s + '%,' + c.l + '%,' + a.toFixed(3) + ')');
      g.addColorStop(0.45, 'hsla(' + c.h + ',' + c.s + '%,' + (c.l * 0.7) + '%,' + (a * 0.45).toFixed(3) + ')');
      g.addColorStop(1, 'hsla(' + c.h + ',' + c.s + '%,' + (c.l * 0.5) + '%,0)');
      NX.fillStyle = g;
      NX.beginPath(); NX.arc(cx, cy, rr, 0, Math.PI * 2); NX.fill();
    }
    NX.globalCompositeOperation = 'source-over';
  }

  /* 星星分三层，越近走得越快 —— 横移读起来就是菜单里那颗星球绕轴慢转的样子。 */
  var LAYERS = [
    { n: 190, r0: .45, r1: 1.05, v: 0.55, a0: .28, a1: .62, tw: 0.9 },
    { n: 76, r0: .85, r1: 1.60, v: 1.50, a0: .40, a1: .82, tw: 1.4 },
    { n: 22, r0: 1.30, r1: 2.30, v: 3.10, a0: .60, a1: 1.00, tw: 2.1 }
  ];
  function seedStars() {
    stars = [];
    if (!W || !H) return;
    for (var li = 0; li < LAYERS.length; li++) {
      var L = LAYERS[li];
      var n = Math.round(L.n * Math.min(2.2, (W * H) / (1440 * 900)));
      for (var i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * W, y: Math.random() * H,
          r: L.r0 + Math.random() * (L.r1 - L.r0),
          v: L.v, tw: L.tw, ph: Math.random() * Math.PI * 2,
          a: L.a0 + Math.random() * (L.a1 - L.a0),
          /* 少数几颗偏暖，和界面的金色呼应；其余是冷白 */
          warm: Math.random() < 0.22
        });
      }
    }
  }

  function paintStars(t, dt) {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.x -= s.v * dt * 0.001 * 12;
      if (s.x < -4) { s.x = W + 4; s.y = Math.random() * H; }
      var tw = 0.76 + 0.24 * Math.sin(t * 0.001 * s.tw + s.ph);
      var a = s.a * tw;
      X.globalAlpha = a;
      X.fillStyle = s.warm ? '#f6e3b4' : '#dfe8ff';
      X.beginPath(); X.arc(s.x, s.y, s.r, 0, Math.PI * 2); X.fill();
      if (s.r > 1.5) {                       /* 大颗的带一圈光晕：要用渐变，
                                                平涂一个大圆看着就是一块灰盘子 */
        var R = s.r * 4.2;
        var g = X.createRadialGradient(s.x, s.y, s.r * 0.5, s.x, s.y, R);
        var c0 = s.warm ? '246,227,180' : '223,232,255';
        g.addColorStop(0, 'rgba(' + c0 + ',' + (a * 0.38).toFixed(3) + ')');
        g.addColorStop(0.42, 'rgba(' + c0 + ',' + (a * 0.10).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + c0 + ',0)');
        X.globalAlpha = 1; X.fillStyle = g;
        X.beginPath(); X.arc(s.x, s.y, R, 0, Math.PI * 2); X.fill();
      }
    }
    X.globalAlpha = 1;
  }

  function frame(t) {
    var el = document.getElementById('game');
    var on = el && el.classList.contains('show') && document.visibilityState === 'visible';
    if (!on) { raf = requestAnimationFrame(frame); last = t; return; }
    if (!C && !attach()) { raf = requestAnimationFrame(frame); return; }
    /* 画布挂在一个一开始 display:none 的容器里，第一次量到的可能还是 0 或是
       画布的默认 300×150。所以每帧对一下版：尺寸对不上就当场重建，自己找回来。 */
    var cw = C.clientWidth, ch = C.clientHeight;
    if (cw && ch && (cw !== W || ch !== H || C.width !== Math.round(W * DPR))) {
      if (size() === false) { raf = requestAnimationFrame(frame); return; }
    }
    if (!W || !H) { raf = requestAnimationFrame(frame); return; }
    var dt = Math.min(66, t - last || 16); last = t;
    /* 三十帧足够：这是一片慢慢飘的底，多画的每一帧都在跟正文抢主线程。 */
    acc += dt;
    if (acc < 33 && drawnOnce) { raf = requestAnimationFrame(frame); return; }
    acc = 0;
    if (t - nebAt > 500) { paintNebula(t); nebAt = t; }
    X.fillStyle = '#05070c';
    X.fillRect(0, 0, W, H);
    if (NEB) X.drawImage(NEB, 0, 0, W, H);
    paintStars(t, dt);
    drawnOnce = true;
    if (window.REDUCED) { cancelAnimationFrame(raf); raf = 0; return; }   /* 减弱动效：画一帧就停 */
    raf = requestAnimationFrame(frame);
  }

  function size() {
    if (!C) return;
    DPR = Math.min(1.5, window.devicePixelRatio || 1);
    var w = C.clientWidth || window.innerWidth, h = C.clientHeight || window.innerHeight;
    if (!w || !h) return false;
    W = Math.round(w); H = Math.round(h);
    C.width = Math.round(W * DPR); C.height = Math.round(H * DPR);
    X.setTransform(DPR, 0, 0, DPR, 0, 0);
    NW = Math.max(32, Math.round(W / 3)); NH = Math.max(32, Math.round(H / 3));
    NEB.width = NW; NEB.height = NH;
    seedStars(); nebAt = -1e9; drawnOnce = false;
    return true;
  }

  function attach() {
    var g = document.getElementById('game');
    if (!g) return false;
    var c = document.getElementById(ID);
    if (!c) {
      c = document.createElement('canvas');
      c.id = ID;
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;display:block';
      g.insertBefore(c, g.firstChild);
    }
    C = c; X = c.getContext('2d');
    if (!X) { C = null; return false; }
    X.imageSmoothingEnabled = true;
    try { X.imageSmoothingQuality = 'high'; } catch (_) {}
    NEB = document.createElement('canvas'); NX = NEB.getContext('2d');
    if (!NX) { C = null; return false; }
    if (size() === false) { C = null; return false; }
    return true;
  }

  function kick() { if (!raf) { last = 0; acc = 999; raf = requestAnimationFrame(frame); } }

  addEventListener('resize', function () { if (C) { size(); kick(); } });
  document.addEventListener('visibilitychange', kick);
  /* 减弱动效是可以在设置里当场切换的：切回全开时要重新起转。 */
  window.WORLD_COSMOS = { kick: kick, restart: function () { if (C) { size(); } kick(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kick);
  else kick();
})();
