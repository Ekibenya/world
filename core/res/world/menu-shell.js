var MENU={on:false,exiting:false,t0:0};

/* 主菜单背景已改为三维星球与宇宙场景（world-planet-map.js 的 menu 宿主），旧的马赛克拼图已整段移除。 */


/* 封面标题字体：页面一开始就显式触发加载，避免首帧回退成系统字体 */
(function(){try{if(document.fonts&&document.fonts.load)document.fonts.load('40px Metropolitain').catch(function(){});}catch(_){}})();
