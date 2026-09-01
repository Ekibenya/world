/* 纪年简介弹窗。
   复用页面现成的 gDlg / box / tag / sub / eBtn，不另造一套弹窗外壳。 */
(function(){
  'use strict';

  var B=null, ST={ok:null,no:null,row:null};

  function build(){
    if(B)return B;
    B=document.createElement('div');
    B.className='gDlg';B.id='dlgEra';B.style.zIndex='88';B.style.animation='none';
    B.innerHTML='<div class="box" role="dialog" aria-modal="true" aria-labelledby="erTtl"'
      +' style="max-width:min(calc(94vw/var(--ui)),680px)">'
      +'<span class="tag">AETATES</span>'
      +'<h2 id="erTtl"></h2>'
      +'<div class="sub" id="erYr"></div>'
      +'<dl id="erDl" style="margin:20px 0 0;display:grid;'
      +'grid-template-columns:auto 1fr;gap:16px 20px;align-items:start"></dl>'
      +'<div style="display:flex;gap:14px;margin-top:28px">'
      +'<span class="eBtn" id="erNo">RETVRN&nbsp;返回时间轴</span>'
      +'<span class="eBtn" id="erGo" style="flex:1;text-align:center">PERGERE&nbsp;进入该节点</span>'
      +'</div></div>';
    document.body.appendChild(B);
    B.querySelector('#erNo').addEventListener('click',function(){close(0);});
    B.querySelector('#erGo').addEventListener('click',function(){close(1);});
    B.addEventListener('click',function(e){if(e.target===B)close(0);});
    document.addEventListener('keydown',function(e){
      if(B.style.display!=='flex')return;
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close(0);}
      else if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();close(1);}
    },true);
    return B;
  }

  function close(go){
    if(!B)return;
    var ok=ST.ok,no=ST.no;ST.ok=ST.no=ST.row=null;
    B.style.display='none';
    try{if(go){if(ok)ok();}else if(no)no();}catch(_){}
  }

  function put(label,text){
    var dt=document.createElement('dt');
    dt.className='sub';dt.style.cssText='line-height:1.8;white-space:nowrap;color:#9a742a';
    dt.textContent=label;
    var dd=document.createElement('dd');
    dd.style.cssText='margin:0;font-size:12px;line-height:2;letter-spacing:.045em;color:#35342b';
    dd.textContent=text||'本节点资料尚未载入。';
    B.querySelector('#erDl').append(dt,dd);
  }

  function fill(row){
    B.querySelector('#erTtl').textContent=row.t||'';
    B.querySelector('#erYr').textContent='节点 '+String(row.i||0).padStart(2,'0')+'　·　'+(row.y||'');
    B.querySelector('#erDl').innerHTML='';
    put('前情提要',row.recap);
    put('本节点剧情简介',row.synopsis);
  }

  function ask(row,ok,no){
    if(!row||row.i==null||row.i<=0){if(no)no();return;}
    build();ST.ok=ok;ST.no=no;ST.row=row;fill(row);
    B.style.display='flex';
    try{B.querySelector('#erGo').focus();}catch(_){}
  }

  window.WORLD_ERA={ask:ask,close:close};
})();
