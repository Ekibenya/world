(function(){
  'use strict';
  var $=window.$||function(s){return document.querySelector(s);};
  var game=$('#game');
  var panelState={mapOpen:false,armOpen:false,shopOpen:false,txTier:1};

  function world(){try{return window.WORLD_UI_STATE?window.WORLD_UI_STATE():null;}catch(_){return null;}}
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function sourceItems(kind){
    var w=world(),era=w&&w.era;if(!era)return [];
    var out=[];
    (era.lorebook||[]).forEach(function(entry){
      if(entry.category!==kind)return;
      (entry.keys||[]).forEach(function(name){if(name&&!out.some(function(x){return x.name===name;}))out.push({name:name,content:entry.content||''});});
    });
    return out;
  }
  function renderMap(){
    var host=$('#gmMapIn'),w=world(),era=w&&w.era;if(!host||!era)return;
    var places=sourceItems('place');
    host.innerHTML='<img src="'+esc(era.image||'')+'" alt="'+esc(era.name||'')+'">'
      +'<div class="world-map-ledger"><b>◆ TABVLA · '+esc(era.name)+'</b>'
      +(places.length?places.map(function(p){return '<button type="button" data-world-place="'+esc(p.name)+'">'+esc(p.name)+'</button>';}).join('')
        :'<span>本时代资料尚无可核实地点条目；不从 Cat 或模型补造地点。</span>')+'</div>';
  }
  function renderArm(){
    var host=$('#armWrap');if(!host)return;
    var items=sourceItems('equipment');
    host.innerHTML='<div class="armSec">◈&nbsp;在身&nbsp;·&nbsp;已装备</div><div class="slotGrid">'
      +['右手','左手','躯干','头','肩','腰','足','背负'].map(function(slot){return '<div class="aSlot empty"><span class="ic"></span><span><b>'+slot+'</b><i>— 空 —</i></span></div>';}).join('')
      +'</div><div class="armSec">◈&nbsp;行囊&nbsp;·&nbsp;随身</div><div class="bagGrid">'
      +(items.length?items.map(function(item){return '<div class="bCell" title="'+esc(item.name)+'"><span>'+esc(item.name.slice(0,1))+'</span></div>';}).join(''):'')
      +Array.from({length:6},function(){return '<div class="bCell emptyc" aria-hidden="true"></div>';}).join('')
      +'</div><div class="armDet"><div class="ds" style="color:var(--mut)">'+(items.length?'点选原文中明确记载的物品查看资料。':'当前时代没有可核实的装备条目；不从 Cat 或模型补造物品。')+'</div></div>';
  }
  function renderShop(){
    var host=$('#shopWrap');if(!host)return;
    var items=sourceItems('goods');
    host.innerHTML='<div class="shTabs"><span class="on">全部&nbsp;'+items.length+'</span></div><div class="shHead"><b>正典货单</b><span>只陈列该时代原文明确出现且可交易的物品</span></div>'
      +(items.length?items.map(function(item){return '<div class="shRow"><span class="nm">'+esc(item.name)+'<i>原文条目</i></span><span class="pr">原文未载价</span><span class="bu">查看</span></div>';}).join('')
        :'<div class="shNote">当前时代没有可核实的商店货单；不从 Cat 或模型补造商品、价格或货币制度。</div>');
  }
  function toggle(which){
    if(!game)return;
    panelState[which+'Open']=!panelState[which+'Open'];
    ['map','arm','shop'].forEach(function(name){if(name!==which)panelState[name+'Open']=false;game.classList.toggle(name+'Open',panelState[name+'Open']);});
    if(which==='map'&&panelState.mapOpen)renderMap();
    if(which==='arm'&&panelState.armOpen)renderArm();
    if(which==='shop'&&panelState.shopOpen)renderShop();
  }
  function setPage(pg){
    if(!game)return;game.setAttribute('data-pg',pg);
    game.querySelectorAll('.gNav [data-pg]').forEach(function(el){el.classList.toggle('on',el.getAttribute('data-pg')===pg);});
    if(pg==='map'){renderMap();renderArm();}else if(pg==='shop')renderShop();else if(pg==='mfd'&&window.WORLD_MVU)window.WORLD_MVU.mount();
  }
  function cycleVn(){
    if(!game)return;
    panelState.txTier=(panelState.txTier+1)%4;
    game.classList.remove('txOpen','tx2','txBig');
    if(panelState.txTier===1)game.classList.add('txOpen');
    if(panelState.txTier===2)game.classList.add('txOpen','tx2');
    if(panelState.txTier===3)game.classList.add('txOpen','txBig');
    if(window.FELVN)window.FELVN.tick();
  }
  function openDialog(id){var el=$(id);if(el)el.style.display='flex';}
  function closeDialog(el){if(el)el.style.display='none';}
  function bindDialogButton(button,dialog){var b=$(button);if(b)b.addEventListener('pointerup',function(e){e.stopPropagation();openDialog(dialog);});}
  function saveSlots(){try{return JSON.parse(localStorage.getItem('guardianDragonSaves')||'{}');}catch(_){return {};}}
  function writeSlots(slots){localStorage.setItem('guardianDragonSaves',JSON.stringify(slots));}
  function renderSaves(){
    var host=$('#svField'),buttons=$('#svCoreBtns');if(!host||!buttons)return;var slots=saveSlots(),html='';
    for(var i=1;i<=12;i++){var slot=slots[i];html+='<div class="svFold'+(slot?' on':'')+'" data-slot="'+i+'" style="left:'+(12+(i%4)*24)+'%;top:'+(18+Math.floor((i-1)/4)*28)+'%"><span class="tab"></span><span class="num">'+String(i).padStart(2,'0')+'</span><span class="lb">'+(slot?esc(slot.name)+'<br>'+esc(slot.savedAt.slice(0,16).replace('T',' ')):'VACVVM<br>空槽')+'</span></div>';}
    host.innerHTML=html;buttons.innerHTML='<span class="svAct" data-save-act="save">存入选中槽</span><span class="svAct" data-save-act="load">读取选中槽</span><span class="svAct warn" data-save-act="delete">清空选中槽</span>';host._selected=host._selected||1;
    var chosen=host.querySelector('[data-slot="'+host._selected+'"]');if(chosen)chosen.classList.add('sel');
  }
  function openSaves(){renderSaves();openDialog('#dlgSave');}
  function saveAction(action){
    var host=$('#svField'),slot=host&&host._selected||1,slots=saveSlots();
    if(action==='save'&&window.WORLD_UI){var shot=window.WORLD_UI.snapshot();shot.name=(shot.player&&shot.player.mode==='preset'&&shot.player.card&&shot.player.card.name)||(shot.player&&shot.player.custom&&shot.player.custom.name)||'未命名棋局';slots[slot]=shot;writeSlots(slots);renderSaves();}
    if(action==='load'&&slots[slot]&&window.WORLD_UI){closeDialog($('#dlgSave'));window.WORLD_UI.restore(slots[slot]);}
    if(action==='delete'&&slots[slot]){delete slots[slot];writeSlots(slots);renderSaves();}
  }
  function renderBook(){
    var lore=window.WORLD_UI&&window.WORLD_UI.lore?window.WORLD_UI.lore():[],tops=$('#cxTops'),cats=$('#cxCats'),ents=$('#cxEnts');if(!tops||!cats||!ents)return;
    var labels={'event':'原文事件','world-fact':'原文世界设定','secondary-character':'原文次要人物','premise':'时代运行边界'};
    var order=['event','world-fact','secondary-character','premise'];
    var groups={};lore.forEach(function(entry,i){var cat=entry.category||'未分类';(groups[cat]=groups[cat]||[]).push({entry:entry,i:i});});var names=Object.keys(groups).sort(function(a,b){var ai=order.indexOf(a),bi=order.indexOf(b);return(ai<0?999:ai)-(bi<0?999:bi);});
    tops.innerHTML='<div class="cxTop on">当前时代<i>'+lore.length+'</i></div>';cats.innerHTML=names.map(function(name,i){return '<div class="cxCat'+(i?'':' on')+'" data-cat="'+esc(name)+'">'+esc(labels[name]||name)+' · '+groups[name].length+'</div>';}).join('');
    function showCat(name){var list=groups[name]||[];ents.innerHTML=list.map(function(item,i){var title=item.entry.title||item.entry.keys&&item.entry.keys[0]||('条目 '+(item.i+1));return '<div class="cxEnt'+(i?'':' on')+'" data-entry="'+item.i+'">'+esc(title)+'</div>';}).join('');if(list[0])showEntry(list[0].i);else{$('#cxTtl').textContent='本类暂无条目';$('#cxTxt').textContent='';}}
    function showEntry(i){var entry=lore[i];if(!entry)return;$('#cxTtl').textContent=entry.title||entry.keys&&entry.keys[0]||('条目 '+(i+1));$('#cxTxt').textContent=entry.content||'';ents.querySelectorAll('.cxEnt').forEach(function(x){x.classList.toggle('on',Number(x.getAttribute('data-entry'))===i);});var body=$('#dlgBook .cxBody');if(body)body.scrollTop=0;}
    cats.onclick=function(e){var el=e.target.closest('[data-cat]');if(!el)return;cats.querySelectorAll('.cxCat').forEach(function(x){x.classList.toggle('on',x===el);});showCat(el.getAttribute('data-cat'));};ents.onclick=function(e){var el=e.target.closest('[data-entry]');if(el)showEntry(Number(el.getAttribute('data-entry')));};if(names[0])showCat(names[0]);else{$('#cxTtl').textContent='尚未进入时代';$('#cxTxt').textContent='进入任一时代后显示该节点世界书。';}
  }
  function download(name,data){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'application/json'}));a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},0);}
  function speech(){var w=world(),text=w&&w.history&&w.history.length?w.history[w.history.length-1].content:'';if(!text||!window.speechSynthesis)return;window.speechSynthesis.cancel();window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));}
  function bind(){
    var intro=$('#intro');if(intro){intro.style.transition='none';intro.style.display='none';setTimeout(function(){if(intro.parentNode)intro.parentNode.removeChild(intro);},850);}
    var map=$('#arrMap'),arm=$('#arrArm'),shop=$('#arrShop'),vn=$('#arr3d');
    if(map)map.addEventListener('click',function(){toggle('map');});
    if(arm)arm.addEventListener('click',function(){toggle('arm');});
    if(shop)shop.addEventListener('click',function(){toggle('shop');});
    if(vn)vn.addEventListener('click',cycleVn);
    document.querySelectorAll('.gNav [data-pg]').forEach(function(el){el.addEventListener('pointerup',function(){setPage(el.getAttribute('data-pg'));});});
    bindDialogButton('#gtCfg','#dlgCfg');bindDialogButton('#gtVoc','#dlgVoc');bindDialogButton('#gtSnd','#dlgBgm');
    var book=$('#gtBook');if(book)book.addEventListener('pointerup',function(){renderBook();openDialog('#dlgBook');});
    var save=$('#gtSave');if(save)save.addEventListener('pointerup',openSaves);var arch=$('#miArch');if(arch)arch.addEventListener('pointerup',openSaves);
    var cont=$('#miCont');if(cont)cont.addEventListener('pointerup',function(){if(window.WORLD_UI)window.WORLD_UI.loadAuto();});
    var full=$('#gtFull');if(full)full.addEventListener('pointerup',function(){if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(function(){});});
    var exit=$('#gtExit');if(exit)exit.addEventListener('pointerup',function(){openDialog('#dlgExit');});
    var exNo=$('#exNo');if(exNo)exNo.addEventListener('pointerup',function(){closeDialog($('#dlgExit'));});
    var leave=function(){closeDialog($('#dlgExit'));if(window.WORLD_UI)window.WORLD_UI.showMenu();};var exYes=$('#exYes');if(exYes)exYes.addEventListener('pointerup',leave);var exSave=$('#exSave');if(exSave)exSave.addEventListener('pointerup',function(){if(window.WORLD_UI)window.WORLD_UI.saveAuto();leave();});
    var tts=$('#gTts');if(tts)tts.addEventListener('pointerup',speech);var back=$('#gBack');if(back)back.addEventListener('pointerup',function(){if(window.WORLD_UI)window.WORLD_UI.undo();});var redo=$('#gRedo');if(redo)redo.addEventListener('pointerup',function(){if(window.WORLD_UI)window.WORLD_UI.redo();});
    var modeBtn=$('#gModeBtn'),modeMenu=$('#gModeMenu');if(modeBtn&&modeMenu){modeBtn.addEventListener('pointerup',function(e){if(e.target.closest('.gm'))return;modeBtn.classList.toggle('open');});modeMenu.addEventListener('pointerup',function(e){var m=e.target.closest('.gm');if(!m)return;modeMenu.querySelectorAll('.gm').forEach(function(x){x.classList.toggle('on',x===m);});modeBtn.querySelector(':scope>b').textContent=m.querySelector('b').textContent;$('#gIn').placeholder=m.getAttribute('data-ph')||'';modeBtn.classList.remove('open');});}
    document.querySelectorAll('.sSeg').forEach(function(seg){seg.addEventListener('pointerup',function(e){var item=e.target.closest('span');if(!item||item.parentNode!==seg)return;seg.querySelectorAll(':scope>span').forEach(function(x){x.classList.toggle('on',x===item);});if(seg.id==='sgMvu'&&window.WORLD_MVU)window.WORLD_MVU.setMode([0,1,2][[].indexOf.call(seg.children,item)]);});});
    var tabs=$('#cfgTabs');if(tabs)tabs.addEventListener('pointerup',function(e){var t=e.target.closest('[data-cp]');if(!t)return;tabs.querySelectorAll('[data-cp]').forEach(function(x){x.classList.toggle('on',x===t);});document.querySelectorAll('.cfgPane').forEach(function(x){x.style.display=x.id==='cp_'+t.getAttribute('data-cp')?'block':'none';});});
    document.querySelectorAll('.gDlg').forEach(function(d){d.addEventListener('pointerup',function(e){if(e.target===d)closeDialog(d);});});
    ['#svRedX','#svEsc','#exNo','#itNo','#opNo'].forEach(function(id){var b=$(id);if(b)b.addEventListener('pointerup',function(){var d=b.closest('.gDlg');if(d)closeDialog(d);});});
    var field=$('#svField');if(field)field.addEventListener('pointerup',function(e){var slot=e.target.closest('[data-slot]');if(!slot)return;field._selected=Number(slot.getAttribute('data-slot'));field.querySelectorAll('[data-slot]').forEach(function(x){x.classList.toggle('sel',x===slot);});});var saveBtns=$('#svCoreBtns');if(saveBtns)saveBtns.addEventListener('pointerup',function(e){var b=e.target.closest('[data-save-act]');if(b)saveAction(b.getAttribute('data-save-act'));});
    var exp=$('#svExp');if(exp)exp.addEventListener('pointerup',function(){download('guardian-dragon-saves.json',JSON.stringify(saveSlots(),null,2));});var imp=$('#svImp'),file=$('#svFile');if(imp&&file){imp.addEventListener('pointerup',function(){file.click();});file.addEventListener('change',function(){var f=file.files&&file.files[0];if(!f)return;f.text().then(function(t){writeSlots(JSON.parse(t));renderSaves();});});}
    var lux=$('#luxTg');if(lux)lux.addEventListener('pointerup',function(){document.documentElement.classList.toggle('lux');});
    document.addEventListener('keydown',function(e){if(e.key!=='Escape')return;var open=[].slice.call(document.querySelectorAll('.gDlg')).reverse().find(function(d){return d.style.display==='flex'||d.style.display==='block';});if(open)closeDialog(open);});
  }
  function show(){
    if(!game)return;panelState.txTier=1;game.classList.add('txOpen');game.classList.remove('tx2','txBig');setPage('narr');
    renderMap();renderArm();renderShop();
    if(window.WORLD_MVU)window.WORLD_MVU.mount();
    if(window.FELVN)window.FELVN.tick();
  }
  bind();
  window.WORLD_GAME_UI={show:show,toggle:toggle,setPage:setPage,renderMap:renderMap,renderArm:renderArm,renderShop:renderShop,state:panelState};
})();
