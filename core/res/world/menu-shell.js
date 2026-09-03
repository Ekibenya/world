var MENU={on:false,exiting:false,t0:0};

/* 主菜单背景已改为三维星球与宇宙场景（world-planet-map.js 的 menu 宿主），旧的马赛克拼图已整段移除。 */


/* 封面标题：把 <use> 引用的图层展开成真正的 <text> 节点。
   直接存在于渲染树里的文字才能可靠触发 Web 字体加载、并在字体到位后重排，
   避免个别浏览器对 <defs>+<use> 文字不加载字体或加载后不刷新的问题。 */
(function(){
  var svg=document.querySelector('#menuTitle svg');if(!svg)return;
  Array.prototype.slice.call(svg.querySelectorAll('use')).forEach(function(u){
    var ref=svg.querySelector(u.getAttribute('href')||u.getAttribute('xlink:href'));if(!ref)return;
    var t=ref.cloneNode(true);t.removeAttribute('id');
    for(var i=0;i<u.attributes.length;i++){var a=u.attributes[i];if(a.name==='href'||a.name==='xlink:href')continue;t.setAttribute(a.name,a.value);}
    u.parentNode.replaceChild(t,u);
  });
  try{if(document.fonts&&document.fonts.load)document.fonts.load('40px Metropolitain').catch(function(){});}catch(_){}
})();
