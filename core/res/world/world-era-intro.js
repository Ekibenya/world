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
      +' style="max-width:min(calc(94vw/var(--ui)),820px);max-height:min(calc(92vh/var(--ui)),940px);display:flex;flex-direction:column">'
      +'<span class="tag">AETATES</span>'
      +'<h2 id="erTtl"></h2>'
      +'<div class="sub" id="erYr"></div>'
      +'<dl id="erDl" style="margin:20px 0 0;display:grid;'
      +'grid-template-columns:auto 1fr;gap:16px 20px;align-items:start;overflow:auto;min-height:0;padding-right:12px"></dl>'
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
    dt.className='sub';dt.style.cssText='line-height:1.8;white-space:nowrap;color:#f1d28c';
    dt.textContent=label;
    var dd=document.createElement('dd');
    dd.style.cssText='margin:0;font-size:12px;line-height:2;letter-spacing:.045em;color:#e8dcc0;white-space:pre-line';
    dd.textContent=text||'本节点资料尚未载入。';
    B.querySelector('#erDl').append(dt,dd);
  }

  function fill(row){
    B.querySelector('#erTtl').textContent=row.t||'';
    B.querySelector('#erYr').textContent='节点 '+String(row.i||0).padStart(2,'0')+'　·　'+(row.y||'');
    B.querySelector('#erDl').innerHTML='';
    put('第一次看也能懂',row.primer);
    if(row.history)put('此前完整历史',row.history);
    put('紧接本节点的前情',row.recap);
    put('本节点完整剧情',row.synopsis);
    put('从这里进入',row.opening?'本节点实际从《'+row.opening+'》开始。进入以后，前情属于已经发生的事实；完整剧情只用于帮助读者理解这一阶段会走向哪里。':'选择后将从本节点开局进入。');
  }

  function ask(row,ok,no){
    if(!row||row.i==null||row.i<=0){if(no)no();return;}
    build();ST.ok=ok;ST.no=no;ST.row=row;fill(row);
    B.style.display='flex';
    try{B.querySelector('#erGo').focus();}catch(_){}
  }

  window.WORLD_ERA={ask:ask,close:close};
})();
