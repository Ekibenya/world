(function(){
  'use strict';

  var KEY='guardianDragonMvuStateV1';
  var W=null,selectedNpc='',graph={s:1,x:0,y:0,drag:null};
  var P={secG:true,secA:true,secM:true,memOn:true,manual:[],hidden:[]};

  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function load(){try{var x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&typeof x==='object')P=Object.assign(P,x);}catch(_){}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(P));}catch(_){}}
  function clip(v,n){v=String(v||'').replace(/\s+/g,' ').trim();return v.length>n?v.slice(0,n)+'…':v;}
  function hero(){if(!W||!W.player)return '';return W.player.mode==='preset'?(W.player.card&&W.player.card.name||''):(W.player.custom&&W.player.custom.name||'');}
  function anchor(){if(!W||!W.player)return null;return W.player.mode==='preset'?W.player.card:W.player.anchor;}
  function evidenceAt(list,idx){
    list=Array.isArray(list)?list:[];
    if(list.length&&list.every(function(item){return item.sourceIndex==null;}))return list[0].text||'';
    for(var i=0;i<list.length;i++)if(Number(list[i].sourceIndex)===Number(idx))return list[i].text||'';
    for(var j=list.length-1;j>=0;j--)if(Number(list[j].sourceIndex)<=Number(idx))return list[j].text||'';
    return list[0]&&list[0].text||'';
  }
  function aliases(card){
    var out=[];
    [card&&card.name].concat(card&&card.matchedLedgerLabels||[]).forEach(function(raw){
      String(raw||'').split(/[／/]/).forEach(function(v){v=v.replace(/[（(【\[].*$/,'').trim();if(v&&out.indexOf(v)<0)out.push(v);});
    });
    if(card&&/^(无名|未具名)/.test(card.name||'')){
      var tail=String(card.name).replace(/^(无名|未具名)/,'');
      if(tail&&out.indexOf(tail)<0)out.push(tail);
      if(tail==='创世神'&&out.indexOf('神')<0)out.push('神');
    }
    return out;
  }
  function isMentioned(card,text){return aliases(card).some(function(name){return text.indexOf(name)>=0;});}
  function cardsIn(text){
    if(!W||!W.era)return [];
    var me=anchor();
    return (W.era.cards||[]).filter(function(c){return c!==me&&isMentioned(c,text||'')&&(P.hidden||[]).indexOf(c.name)<0;});
  }
  function latestText(){var h=W&&W.history||[];return h.length?String(h[h.length-1].content||''):'';}
  function sceneCards(){var now=cardsIn(latestText()),opening=W&&W.era&&W.era.opening;if(!now.length&&opening)now=cardsIn(opening.verbatim||'');return now;}
  function heroMind(){
    var h=W&&W.history||[];
    for(var i=h.length-1;i>=0;i--)if(h[i].role==='user'){var t=String(h[i].content||'').trim();return /^[~～]/.test(t)?t.slice(1).trim():'';}
    return '';
  }
  function textRow(k,v){return '<div class="mRow"><span>'+esc(k)+'</span></div><div class="mLead'+(v?'':' mute')+'">'+esc(v||'—')+'</div>';}
  function roleSection(){
    var a=anchor(),op=W.era.opening,idx=op.sourceIndex,h='<div class="mSec"><div class="mHead"><i>◆</i>&nbsp;角色状态</div>';
    if(W.player.mode==='custom'){
      var c=W.player.custom||{};
      h+=textRow('姓名',c.name)+textRow('物种与身体形态',c.speciesForm)+textRow('社会位置',c.social)+textRow('眼前目标',c.want)+textRow('知识范围',c.knowledge);
    }else{
      var chron=a&&a.eraDragonChronology||{};
      h+=textRow('姓名',a&&a.name)+textRow('身份',evidenceAt(a&&a.canonIdentityEvidence,idx));
      if(chron.formEvidence&&chron.formEvidence.length)h+=textRow('形态',evidenceAt(chron.formEvidence,idx));
      if(chron.stateEvidence&&chron.stateEvidence.length)h+=textRow('状态',evidenceAt(chron.stateEvidence,idx));
      h+=textRow('知识边界',a&&a.knowledgeBoundary&&a.knowledgeBoundary.rule||'');
    }
    var mind=heroMind();
    h+='<div class="mRow"><span>心 声</span></div>'+(mind?'<div class="mMind">『'+esc(mind)+'』</div>':'<div class="mMind mute">以&nbsp;<b>~</b>&nbsp;开头发言，即记于此</div>')+'</div>';
    return h;
  }
  function npcSection(){
    var ns=sceneCards(),idx=W.era.opening.sourceIndex;if(!ns.length)return '';
    var h='<div class="mSec"><div class="mHead"><i>◆</i>&nbsp;在场人物</div>';
    ns.forEach(function(c){var st=evidenceAt(c.canonIdentityEvidence,idx);h+='<div class="mNpc" data-world-npc="'+esc(c.name)+'"><div class="nHead"><span class="nName">'+esc(c.name)+'</span><span class="nRole"></span></div>'+(st?'<div class="nLine">'+esc(st)+'</div>':'')+'</div>';});
    return h+'</div>';
  }
  function situationSection(){
    var op=W.era.opening,h='<div class="mSec"><div class="mHead"><i>◆</i>&nbsp;当前局势</div>';
    h+=textRow('纪年',W.era.name)+textRow('时地',op.chapterTitle)+textRow('正典范围','当前时代完整剧情阶段');
    if(W.error)h+=textRow('神谕',W.error);
    return h+'</div>';
  }
  function head(open,act,title){return '<div class="mHead btn zjSecH" data-act="'+act+'"><i>◆</i>&nbsp;'+title+'<span class="zjCar">'+(open?'▾':'▸')+'</span></div>';}
  function folderSvg(self){
    var st=self?'#523000':'#5f5c53';
    return '<svg class="fd-fold" width="44" height="34" viewBox="0 0 44 34" aria-hidden="true"><rect x="4.5" y="5.5" width="35" height="23" fill="#e8e2d4" stroke="'+st+'" stroke-width="1"/><path d="M1.5 9.5 V1.5 H9.5 M34.5 1.5 H42.5 V9.5 M42.5 24.5 V32.5 H34.5 M9.5 32.5 H1.5 V24.5" fill="none" stroke="'+(self?'#845800':'#9e9a8c')+'" stroke-width="1"/><path d="M9 23.5 H'+(self?'30':'24')+'" fill="none" stroke="'+st+'" stroke-width="1" opacity=".4"/>'+(self?'<text x="9" y="17.5" font-size="9" fill="#523000" font-family="var(--mono)" letter-spacing="2">本</text>':'<rect x="32" y="9" width="5" height="5" fill="var(--t-g2)"/>')+'</svg>';
  }
  function allSeenCards(){
    var out=[],seen={};
    (W&&W.history||[]).forEach(function(m){cardsIn(String(m.content||'')).forEach(function(c){if(!seen[c.name]){seen[c.name]=1;out.push(c);}});});
    sceneCards().forEach(function(c){if(!seen[c.name]){seen[c.name]=1;out.push(c);}});
    return out;
  }
  function graphInner(){
    var ns=allSeenCards();
    if(!ns.length)return '<div style="padding:18px 0 6px;text-align:center;font-size:11.5px;letter-spacing:.2em;color:var(--mut);line-height:2">尚无人物入谱<br>与众人相逢相知后，此处自动结成人物图谱</div>';
    var wd=Math.max(260,Math.min(430,220+ns.length*20)),cx=wd/2,cy=wd/2,r=Math.max(76,Math.min(145,52+ns.length*8)),lines='',nodes='';
    ns.forEach(function(c,i){var a=-Math.PI/2+i*Math.PI*2/ns.length,x=cx+r*Math.cos(a),y=cy+r*Math.sin(a);lines+='<line data-a="__c" data-b="'+esc(c.name)+'" x1="'+cx+'" y1="'+cy+'" x2="'+x.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="#845800" stroke-opacity=".5" stroke-width="1"/>';nodes+='<g data-npc="'+esc(c.name)+'" class="gph-n'+(selectedNpc===c.name?' gph-sel':'')+'" data-x="'+x.toFixed(1)+'" data-y="'+y.toFixed(1)+'" transform="translate('+x.toFixed(1)+','+y.toFixed(1)+')" style="cursor:grab"><g transform="translate(-27,-32) scale(1.28)" style="pointer-events:none">'+folderSvg(false)+'</g><rect x="-28" y="-33" width="56" height="66" fill="transparent"/><text class="gph-nm" x="0" y="24" text-anchor="middle" font-size="12.5">'+esc(c.name.length>6?c.name.slice(0,6):c.name)+'</text></g>';});
    var center='<g data-gcenter="1" class="gph-n gph-c" data-x="'+cx+'" data-y="'+cy+'" transform="translate('+cx+','+cy+')" style="cursor:grab"><g transform="translate(-33,-38) scale(1.4)" style="pointer-events:none">'+folderSvg(true)+'</g><rect x="-34" y="-39" width="68" height="78" fill="transparent"/><text x="0" y="28" text-anchor="middle" font-size="13.5" style="fill:#523000;font-family:var(--mono);letter-spacing:.05em;pointer-events:none">本体│'+esc(hero())+'</text></g>';
    return '<div class="gph-hint">人物图谱：同幕共处者系于本体。名牌可拖拽、轻点开人物档案；电脑按 Ctrl／⌘ 滚轮、手机双指缩放，拖背景平移。</div><div id="zjGraphWrap" style="position:relative;overflow:hidden"><svg id="zjGraphSvg" data-bw="'+wd+'" data-bh="'+wd+'" viewBox="0 0 '+wd+' '+wd+'" style="width:100%;height:auto;display:block;touch-action:none">'+lines+center+nodes+'</svg><span data-act="graphZoomReset" class="btn" style="position:absolute;right:8px;bottom:8px;font-size:11px;letter-spacing:.15em;color:var(--mut);background:rgba(237,231,217,.85);border:1px solid rgba(19,18,13,.25);padding:3px 10px;cursor:pointer">复位</span></div>';
  }
  function historyRows(){
    var h=W&&W.history||[],cap=60,use=h.length>cap?h.slice(-cap):h;
    if(!use.length)return '<div style="padding:18px 0 6px;text-align:center;font-size:11.5px;letter-spacing:.2em;color:var(--mut)">编年尚空 · 行过一轮自动记一笔</div>';
    var items=use.map(function(m,i){var n=h.length-use.length+i+1,label=m.label||(m.role==='user'?'玩家':'叙事');return '<div style="position:relative;padding:0 0 16px 22px"><div style="position:absolute;left:4px;top:9px;bottom:-3px;width:1px;background:rgba(19,18,13,.14)"></div><div style="position:absolute;left:1px;top:6px;width:7px;height:7px;background:'+(m.role==='user'?'#13120d':'var(--gold)')+'"></div><div style="font-size:10.5px;color:var(--mut);letter-spacing:.12em">第'+n+'笔 · '+esc(label)+'</div><div style="font-size:12px;color:#25241d;line-height:1.8;margin-top:3px;letter-spacing:.04em">'+esc(clip(m.content,240))+'</div></div>';}).join('');
    return '<div style="display:flex;align-items:center;gap:10px;margin:10px 0 12px"><div style="flex:none;font-size:11.5px;color:var(--gold2);letter-spacing:.16em;border:1px solid rgba(132,88,0,.45);padding:3px 12px 2px;background:rgba(132,88,0,.08)">'+esc(W.era.name)+'</div><div style="flex:1;height:1px;background:linear-gradient(90deg,rgba(132,88,0,.4),transparent)"></div></div><div style="max-height:420px;overflow-y:auto;padding:4px 2px 0">'+items+'</div>';
  }
  function memoryRows(){
    var h=W&&W.history||[],rows=h.slice(-60).reverse().map(function(m,i){var n=h.length-i;return '<div style="border:1px solid rgba(19,18,13,.12);padding:10px 12px;margin-bottom:7px;background:rgba(19,18,13,.015)"><div style="font-size:10.5px;color:var(--gold);letter-spacing:.12em;margin-bottom:6px">第'+n+'笔 · '+esc(m.label||m.role)+'</div><div style="font-size:12px;color:var(--ink2);line-height:1.8;letter-spacing:.035em;white-space:pre-wrap;overflow-wrap:anywhere">'+esc(m.content||'')+'</div></div>';}).join('');
    if(!rows)rows='<div style="text-align:center;padding:30px 0;font-size:11.5px;letter-spacing:.2em;color:var(--mut)">本局原文抽屉尚空</div>';
    var notes=(P.manual||[]).slice().reverse().map(function(m,ri){var i=P.manual.length-1-ri;return '<div style="display:flex;gap:10px;align-items:flex-start;border:1px solid rgba(132,88,0,.18);padding:9px 12px;margin-bottom:6px;background:rgba(132,88,0,.025)"><div style="flex:1;min-width:0"><div style="font-size:10.5px;color:var(--gold);letter-spacing:.1em">玩家手记</div><div style="font-size:12px;color:var(--ink2);line-height:1.8;margin-top:3px">'+esc(m)+'</div></div><div class="btn" data-mdel="'+i+'" style="flex:none;cursor:pointer;font-size:11px;color:#ff7f63;border:1px solid rgba(255,127,99,.4);padding:2px 8px">删</div></div>';}).join('');
    return '<div style="font-size:11px;letter-spacing:.06em;line-height:1.9;color:var(--mut)">本局每轮玩家与世界的原文保存在下方；玩家长期手记可选择是否送入下一轮。</div><div style="display:flex;gap:10px;align-items:center;margin:14px 0;flex-wrap:wrap"><div class="btn" data-act="memToggle" style="cursor:pointer;padding:7px 12px;font-size:11.5px;letter-spacing:.14em;border:1px solid '+(P.memOn?'rgba(132,88,0,.55)':'rgba(19,18,13,.2)')+';color:'+(P.memOn?'var(--gold2)':'var(--mut)')+'">'+(P.memOn?'✓ 手记注入中':'手记已停用')+'</div><div style="font-size:11px;letter-spacing:.06em;color:var(--mut)">'+h.length+' 个原文抽屉</div><div class="btn" data-act="memExport" style="cursor:pointer;margin-left:auto;font-size:11.5px;letter-spacing:.12em;color:var(--gold2);border:1px solid rgba(132,88,0,.4);padding:6px 12px">导出本局长卷</div></div><div style="max-height:340px;overflow-y:auto">'+rows+'</div><div style="border-top:1px solid rgba(19,18,13,.12);margin-top:14px;padding-top:12px"><div style="display:flex;gap:8px;margin-bottom:10px"><input id="zjMemAdd" placeholder="手记一笔（设定、约定或伏笔）…" style="flex:1;background:rgba(19,18,13,.03);border:1px solid rgba(19,18,13,.2);color:#13120d;font-size:12px;padding:9px 12px;font-family:var(--mono)" autocomplete="off"><button data-act="memAdd" class="obtn btn" style="flex:none;font-size:11.5px;letter-spacing:.2em;padding:0 16px">记 入</button></div>'+(notes||'<div style="font-size:10.5px;color:var(--mut);padding-bottom:3px">尚无玩家手记</div>')+'</div>';
  }
  function render(world){
    if(world)W=world;if(!W||!W.era||!W.player)return;
    var host=document.querySelector('#game .gMfd');if(!host)return;
    host.innerHTML=roleSection()+npcSection()+situationSection()+'<div class="zjP"><div class="mSec">'+head(P.secG,'tgG','人物关系')+(P.secG?'<div id="zjGraphBox" class="fade">'+graphInner()+'</div>':'')+'</div><div class="mSec">'+head(P.secA,'tgA','事件年表')+(P.secA?'<div class="fade">'+historyRows()+'</div>':'')+'</div><div class="mSec">'+head(P.secM,'tgM','长期记忆')+(P.secM?'<div class="fade zjMemPane">'+memoryRows()+'</div>':'')+'</div></div>';
    [].forEach.call(host.querySelectorAll('.mSec'),function(s,i){s.style.animationDelay=Math.min(i*55,220)+'ms';});
    requestAnimationFrame(hydrate);
  }
  function refresh(){render();if(window.WORLD_MVU)window.WORLD_MVU.mount();requestAnimationFrame(hydrate);}
  function npcByName(name){return (W&&W.era&&W.era.cards||[]).find(function(c){return c.name===name;});}
  function dossier(name){
    var c=npcByName(name);if(!c)return '';var idx=W.era.opening.sourceIndex,dialogs=(c.eraSafeDialogueSamples||[]).slice(0,3),minds=(c.eraSafeInnerThoughtSamples||[]).slice(0,3);
    function quotes(list){return list.length?list.map(function(x){return '<span class="fd-quote">'+esc(x.text)+'</span>';}).join(''):'<span class="fd-nd">无　载</span>';}
    return '<div class="fd-row"><span class="fd-k">身份</span><span class="fd-v">'+esc(evidenceAt(c.canonIdentityEvidence,idx)||'无　载')+'</span></div><div class="fd-row"><span class="fd-k">对白声口</span><span class="fd-v">'+quotes(dialogs)+'</span></div><div class="fd-row"><span class="fd-k">直接心声</span><span class="fd-v">'+quotes(minds)+'</span></div><div class="fd-row"><span class="fd-k">知识边界</span><span class="fd-v">'+esc(c.knowledgeBoundary&&c.knowledgeBoundary.rule||'无　载')+'</span></div><div class="fd-last">当前时代 // 角色档案</div>';
  }
  function openDossier(name){
    selectedNpc=name;var old=document.getElementById('fdOv');if(old)old.remove();
    var ns=allSeenCards(),i=Math.max(0,ns.findIndex(function(c){return c.name===name;})),ov=document.createElement('div');ov.className='fd-ov';ov.id='fdOv';
    ov.innerHTML='<div class="fd-win"><span class="tag">人物列传</span><h2 id="fdOvName">'+esc(name)+'</h2><div id="zjGraphCard">'+dossier(name)+'</div><div class="fd-foot"><span class="fd-nav" data-fd="prev">◀ 前一人</span><span class="fd-nav" data-fd="next">后一人 ▶</span></div><div class="esc2" style="margin-top:20px">ESC&nbsp;//&nbsp;RETVRN</div></div>';
    ov.onclick=function(e){var nav=e.target.closest('[data-fd]');if(nav&&ns.length){i=(i+(nav.dataset.fd==='next'?1:-1)+ns.length)%ns.length;selectedNpc=ns[i].name;ov.querySelector('#fdOvName').textContent=selectedNpc;ov.querySelector('#zjGraphCard').innerHTML=dossier(selectedNpc);return;}if(e.target===ov)ov.remove();};document.body.appendChild(ov);
  }
  function applyView(svg){var bw=+svg.dataset.bw||360,bh=+svg.dataset.bh||360,vw=bw/graph.s,vh=bh/graph.s;graph.x=Math.max(0,Math.min(bw-vw,graph.x));graph.y=Math.max(0,Math.min(bh-vh,graph.y));svg.setAttribute('viewBox',graph.x+' '+graph.y+' '+vw+' '+vh);}
  function hydrate(){
    var svg=document.getElementById('zjGraphSvg');if(!svg||svg.__worldGraph)return;svg.__worldGraph=1;applyView(svg);
    svg.addEventListener('wheel',function(e){if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();graph.s=Math.max(1,Math.min(6,graph.s*(e.deltaY<0?1.15:1/1.15)));applyView(svg);},{passive:false});
    svg.addEventListener('pointerdown',function(e){var n=e.target.closest('g[data-npc]');graph.drag=n?{n:n,x:e.clientX,y:e.clientY,m:0}:{x:e.clientX,y:e.clientY};try{svg.setPointerCapture(e.pointerId);}catch(_){}});
    svg.addEventListener('pointermove',function(e){if(!graph.drag)return;var d=graph.drag,dx=e.clientX-d.x,dy=e.clientY-d.y;d.x=e.clientX;d.y=e.clientY;if(d.n){d.m+=Math.abs(dx)+Math.abs(dy);var tr=/translate\(([-.\d]+),([-.\d]+)\)/.exec(d.n.getAttribute('transform')||'');var x=(tr?+tr[1]:0)+dx/graph.s,y=(tr?+tr[2]:0)+dy/graph.s;d.n.setAttribute('transform','translate('+x+','+y+')');var nm=d.n.dataset.npc;[].forEach.call(svg.querySelectorAll('line[data-b]'),function(l){if(l.getAttribute('data-b')===nm){l.setAttribute('x2',x);l.setAttribute('y2',y);}});}else{graph.x-=dx/graph.s;graph.y-=dy/graph.s;applyView(svg);}});
    svg.addEventListener('pointerup',function(e){var d=graph.drag;graph.drag=null;if(d&&d.n&&d.m<10)openDossier(d.n.dataset.npc);try{svg.releasePointerCapture(e.pointerId);}catch(_){}});
  }
  function download(){var data={version:1,era:W&&W.era&&W.era.id,history:W&&W.history||[],manual:P.manual||[]},a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='守护龙纪事-本局长卷.json';a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);}

  document.addEventListener('click',function(e){
    var del=e.target.closest&&e.target.closest('[data-mdel]');if(del){P.manual.splice(+del.dataset.mdel,1);save();refresh();return;}
    var el=e.target.closest&&e.target.closest('#game .gMfd [data-act]');if(!el)return;var a=el.dataset.act;
    if(a==='tgG')P.secG=!P.secG;else if(a==='tgA')P.secA=!P.secA;else if(a==='tgM')P.secM=!P.secM;else if(a==='graphZoomReset'){graph={s:1,x:0,y:0,drag:null};var s=document.getElementById('zjGraphSvg');if(s)applyView(s);return;}else if(a==='memToggle')P.memOn=!P.memOn;else if(a==='memAdd'){var input=document.getElementById('zjMemAdd'),v=input&&input.value.trim();if(v)P.manual.push(v.slice(0,500));else return;}else if(a==='memExport'){download();return;}else return;save();refresh();
  });
  document.addEventListener('click',function(e){var n=e.target.closest&&e.target.closest('[data-world-npc]');if(n)openDossier(n.dataset.worldNpc);});
  addEventListener('keydown',function(e){if(e.key==='Escape'){var ov=document.getElementById('fdOv');if(ov){e.stopImmediatePropagation();ov.remove();}}},true);
  load();
  window.WORLD_MVU_CONTENT={render:render,hydrate:hydrate,memoryPrompt:function(){return P.memOn&&(P.manual||[]).length?'【玩家长期手记】\n'+P.manual.join('\n'):'';},snapshot:function(){return JSON.parse(JSON.stringify(P));},restore:function(p){if(p&&typeof p==='object'){P=Object.assign(P,p);save();}}};
})();
