(function(){
  'use strict';
  var $=window.$||function(s){return document.querySelector(s);};
  var game=$('#game');
  var panelState={mapOpen:false,armOpen:false,shopOpen:false,txTier:1};
  var uiKey='guardianDragonUi';
  var uiState={motus:0,narr:17,uiq:22,lux:true,glass:80,mvu:1,face:0};
  try{Object.assign(uiState,JSON.parse(localStorage.getItem(uiKey)||'{}'));}catch(_){}
  var glassStyle=document.createElement('style'),faceStyle=document.createElement('style');
  document.head.appendChild(glassStyle);document.head.appendChild(faceStyle);

  function uiSave(){try{localStorage.setItem(uiKey,JSON.stringify(uiState));}catch(_){}}
  function clamp(value,min,max,fallback){value=parseInt(value,10);return isNaN(value)?fallback:Math.max(min,Math.min(max,value));}
  function uiPercent(q){q=clamp(q,0,100,22);return q<=22?80+q*20/22:100+(q-22)*70/78;}
  function segSet(id,index){var el=$(id);if(!el)return;[].forEach.call(el.children,function(item,i){item.classList.toggle('on',i===index);});}
  function applyGlass(){
    var a=clamp(uiState.glass,0,100,80)/100;
    glassStyle.textContent='#game::before{background:radial-gradient(ellipse 90% 80% at 50% 42%,transparent 55%,rgba(242,236,222,'+(.12+.28*a).toFixed(2)+') 100%)!important}'
      +'#game .gMfd{background:rgba(235,229,215,'+(.02+.10*a).toFixed(2)+')!important}'
      +'#game .gInput{background:linear-gradient(0deg,rgba(237,231,217,'+(.55+.4*a).toFixed(2)+') 0%,rgba(237,231,217,'+(.35+.35*a).toFixed(2)+') 42%,rgba(237,231,217,0) 76%)!important}'
      +'.gPanel,#pnTx{background:rgba(237,231,217,'+(.04+.16*a).toFixed(2)+')!important}'
      +'#game #pnMap,#game #pnArm,#game #pnShop{background:rgba(237,231,217,'+(.16+.26*a).toFixed(2)+')!important}'
      +'.gMfd.mvDeck .mvWin{background:rgba(237,231,217,'+(.02+.09*a).toFixed(2)+')!important}';
  }
  function applyFace(){
    var family=['','Georgia,"Times New Roman",serif','system-ui,sans-serif'][clamp(uiState.face,0,2,0)]||'';
    faceStyle.textContent=family?'#game .gNarr,#game .gNarr p{font-family:'+family+'!important}':'';
    try{
      var custom=localStorage.getItem('guardianDragonFont');if(!custom)return;
      var font=new FontFace('GuardianDragonCustom','url('+custom+')');
      font.load().then(function(loaded){document.fonts.add(loaded);faceStyle.textContent='#game .gNarr,#game .gNarr p{font-family:GuardianDragonCustom!important}';});
    }catch(_){}
  }
  function applyUiSettings(){
    uiState.narr=clamp(uiState.narr,12,30,17);uiState.uiq=clamp(uiState.uiq,0,100,22);
    uiState.glass=clamp(uiState.glass,0,100,80);uiState.motus=clamp(uiState.motus,0,1,0);
    uiState.mvu=clamp(uiState.mvu,0,2,1);uiState.face=clamp(uiState.face,0,2,0);
    document.documentElement.style.setProperty('--ui',(uiPercent(uiState.uiq)/100).toFixed(4));
    document.documentElement.setAttribute('data-motion',uiState.motus?'soft':'full');
    document.documentElement.classList.toggle('lux',!!uiState.lux);window.REDUCED=!!uiState.motus;
    try{if(window.SET)window.SET.mvuRing=uiState.mvu;}catch(_){}
    if($('#gNarr'))$('#gNarr').style.fontSize=uiState.narr+'px';
    if($('#cfgNarr'))$('#cfgNarr').value=uiState.narr;if($('#cfgNarrVal'))$('#cfgNarrVal').textContent=uiState.narr+'px';
    if($('#cfgUi'))$('#cfgUi').value=uiState.uiq;if($('#cfgUiVal'))$('#cfgUiVal').textContent=uiState.uiq+'%';
    if($('#cfgLux'))$('#cfgLux').checked=!!uiState.lux;if($('#cfgGlass'))$('#cfgGlass').value=uiState.glass;
    segSet('#sgMotus',uiState.motus);segSet('#sgMvu',uiState.mvu);segSet('#sgFace',uiState.face);
    applyGlass();applyFace();uiSave();
  }

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
    var w=world(),era=w&&w.era;if(!era)return;
    if(window.WORLD_PLANET_MAP)window.WORLD_PLANET_MAP.render({era:era});
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
    var lore=window.WORLD_UI&&window.WORLD_UI.lore?window.WORLD_UI.lore():[],tops=$('#cxTops'),cats=$('#cxCats'),ents=$('#cxEnts'),dialog=$('#dlgBook');if(!tops||!cats||!ents||!dialog)return;
    var sections=[
      {id:'characters',label:'人物档案'},
      {id:'world',label:'世界结构'},
      {id:'mechanics',label:'能力与物件'},
      {id:'history',label:'历史与连续性'},
      {id:'rules',label:'运行规则'}
    ];
    var groups=[
      {id:'preset',section:'characters',label:'预设角色',categories:['character-profile','character-experience','character-motivation','character-voice','character-relations']},
      {id:'secondary',section:'characters',label:'次要人物',categories:['secondary-character-profile','secondary-character-experience','secondary-character-motivation','secondary-character-voice','secondary-character-relations']},
      {id:'dragon-timeline',section:'characters',label:'主龙时间线',categories:['character-timeline']},
      {id:'shared-canon',section:'world',label:'共同背景',categories:['shared-canon']},
      {id:'setting-fact',section:'world',label:'综合设定',categories:['setting-fact']},
      {id:'setting-place',section:'world',label:'地点与环境',categories:['setting-place']},
      {id:'setting-institution',section:'world',label:'机构与势力',categories:['setting-institution']},
      {id:'setting-society',section:'world',label:'社会与身份',categories:['setting-society']},
      {id:'setting-species',section:'world',label:'族群与生命',categories:['setting-species']},
      {id:'setting-economy',section:'world',label:'经济与生活',categories:['setting-economy']},
      {id:'setting-power',section:'mechanics',label:'能力与系统',categories:['setting-power']},
      {id:'setting-object',section:'mechanics',label:'物件与资源',categories:['setting-object']},
      {id:'history-event',section:'history',label:'剧情状态',categories:['history-event']},
      {id:'premise',section:'rules',label:'时代边界',categories:['premise']},
      {id:'canon-rule',section:'rules',label:'正典规则',categories:['canon-rule']},
      {id:'era-rule',section:'rules',label:'时代限制',categories:['era-rule']},
      {id:'narrative-rule',section:'rules',label:'叙事规则',categories:['narrative-rule']},
      {id:'system-rule',section:'rules',label:'系统规则',categories:['system-rule']},
      {id:'support-rule',section:'rules',label:'支援规则',categories:['support-rule']},
      {id:'social-rule',section:'rules',label:'社会伦理',categories:['social-rule']},
      {id:'scene-rule',section:'rules',label:'场景生活',categories:['scene-rule']},
      {id:'other',section:'world',label:'其他条目',categories:[]}
    ];
    var categoryGroup={};groups.forEach(function(group){group.categories.forEach(function(category){categoryGroup[category]=group.id;});});
    var groupById={};groups.forEach(function(group){groupById[group.id]=group;});
    var sectionById={};sections.forEach(function(section){sectionById[section.id]=section;});
    function groupOf(entry){return groupById[categoryGroup[entry.category]||'other'];}
    function chineseTitle(value){
      return String(value||'')
        .replace(/伽拉忒亚II/g,'伽拉忒亚二号')
        .replace(/重要NPC/g,'重要非玩家人物').replace(/普通NPC/g,'普通非玩家人物')
        .replace(/转生者A/g,'匿名转生者甲')
        .replace(/F-S等级/g,'冒险者全等级').replace(/等级F至S/g,'等级从末级至特级').replace(/S级/g,'特级').replace(/A级/g,'甲级').replace(/B级/g,'乙级').replace(/C级/g,'丙级').replace(/F级/g,'末级')
        .replace(/Boss/g,'首领').replace(/DP/g,'地下城点数').replace(/LD/g,'人生体验器')
        .replace(/WWE式/g,'摔角式').replace(/Gate/g,'异界门灾害').replace(/JQK/g,'人头牌')
        .replace(/Ante、Be…/g,'底注、下注等规则…').replace(/Ante/g,'底注').replace(/Bet/g,'下注').replace(/Raise/g,'加注').replace(/Fold/g,'弃牌').replace(/Check/g,'让牌').replace(/Call/g,'跟注').replace(/All-?In/gi,'全押').replace(/Meta/g,'策略风向')
        .replace(/伊伦・M・普莱奥内/g,'伊伦・普莱奥内').replace(/V角/g,'双叉角');
    }
    function fullTitle(entry,index){var value=entry.title||entry.keys&&entry.keys[0]||('条目 '+(index+1));value=chineseTitle(value);return value.length>72?value.slice(0,72)+'…':value;}
    function shortTitle(entry,index){return fullTitle(entry,index).replace(/^【[^】]+】/,'');}
    function subjectOf(entry,index){return shortTitle(entry,index).split('｜')[0].trim();}
    function facetRank(category){return ({'character-profile':0,'secondary-character-profile':0,'character-experience':1,'secondary-character-experience':1,'character-motivation':2,'secondary-character-motivation':2,'character-voice':3,'secondary-character-voice':3,'character-relations':4,'secondary-character-relations':4,'character-timeline':5})[category]||0;}
    function searchable(entry,index){return chineseTitle([entry.title,entry.memo,(entry.keys||[]).join(' '),entry.content].join('\n')).toLocaleLowerCase();}
    function groupItems(group,query){
      var list=[];lore.forEach(function(entry,index){if(groupOf(entry).id!==group.id)return;if(query&&searchable(entry,index).indexOf(query)<0)return;list.push({entry:entry,i:index});});
      return list.sort(function(a,b){
        if(group.section==='characters'){var sa=subjectOf(a.entry,a.i),sb=subjectOf(b.entry,b.i),subjectOrder=sa.localeCompare(sb,'zh-CN');return subjectOrder||facetRank(a.entry.category)-facetRank(b.entry.category)||a.i-b.i;}
        if(group.section==='history')return a.i-b.i;
        if(group.section==='rules')return (b.entry.order||0)-(a.entry.order||0)||fullTitle(a.entry,a.i).localeCompare(fullTitle(b.entry,b.i),'zh-CN');
        return fullTitle(a.entry,a.i).localeCompare(fullTitle(b.entry,b.i),'zh-CN');
      });
    }
    var tab=dialog.querySelector('.cxTab'),tag=dialog.querySelector('.tag'),heading=dialog.querySelector('h2'),wrap=dialog.querySelector('.cxWrap');
    if(tab)tab.textContent='当前时代正典';if(tag)tag.textContent='世界书';if(heading)heading.textContent='当前时代 · 世界书';
    var search=dialog.querySelector('#cxSearch');if(!search&&wrap){var bar=document.createElement('div');bar.className='cxSearchBar';bar.innerHTML='<input id="cxSearch" type="search" placeholder="搜索人物、地点、事件、关键词或正文"><span id="cxSearchCount"></span>';wrap.parentNode.insertBefore(bar,wrap);search=bar.querySelector('#cxSearch');}
    var body=dialog.querySelector('.cxBody'),meta=dialog.querySelector('#cxMeta');if(!meta&&body){meta=document.createElement('div');meta.id='cxMeta';meta.className='cxMeta';body.insertBefore(meta,$('#cxTxt'));}
    var activeSection='characters',activeGroup='preset',query='';
    function countGroup(group){return groupItems(group,query).length;}
    function visibleGroups(sectionId){return groups.filter(function(group){return group.section===sectionId&&countGroup(group)>0;});}
    function visibleSections(){return sections.filter(function(section){return visibleGroups(section.id).length>0;});}
    function sectionCount(sectionId){return visibleGroups(sectionId).reduce(function(sum,group){return sum+countGroup(group);},0);}
    function showEntry(index){
      var entry=lore[index];if(!entry)return;var group=groupOf(entry),keys=(entry.keys||[]).slice(0,8);
      $('#cxTtl').textContent=fullTitle(entry,index);$('#cxTxt').textContent=entry.content||'';
      if(meta)meta.innerHTML='<span>'+esc(sectionById[group.section].label)+'／'+esc(group.label)+'</span>'+(keys.length?'<span>触发词：'+esc(keys.join('、'))+'</span>':'<span>常驻条目</span>');
      ents.querySelectorAll('.cxEnt').forEach(function(item){item.classList.toggle('on',Number(item.getAttribute('data-entry'))===index);});if(body)body.scrollTop=0;
    }
    function renderEntries(){
      var group=groupById[activeGroup],list=group?groupItems(group,query):[];
      ents.innerHTML=list.map(function(item,i){return '<div class="cxEnt'+(i?'':' on')+'" data-entry="'+item.i+'">'+esc(shortTitle(item.entry,item.i))+'</div>';}).join('');
      if(list[0])showEntry(list[0].i);else{$('#cxTtl').textContent=query?'没有匹配条目':'本类暂无条目';$('#cxTxt').textContent=query?'换一个人物名、地点名或关键词再试。':'';if(meta)meta.textContent='';}
    }
    function renderGroups(preferred){
      var available=visibleGroups(activeSection);if(!available.some(function(group){return group.id===preferred;}))preferred=available[0]&&available[0].id;activeGroup=preferred||'';
      cats.innerHTML=available.map(function(group){return '<div class="cxCat'+(group.id===activeGroup?' on':'')+'" data-group="'+group.id+'">'+esc(group.label)+'<i>'+countGroup(group)+'</i></div>';}).join('');renderEntries();
    }
    function renderSections(preferred){
      var available=visibleSections();if(!available.some(function(section){return section.id===preferred;}))preferred=available[0]&&available[0].id;activeSection=preferred||'';
      tops.innerHTML=available.map(function(section){return '<div class="cxTop'+(section.id===activeSection?' on':'')+'" data-section="'+section.id+'">'+esc(section.label)+'<i>'+sectionCount(section.id)+'</i></div>';}).join('');renderGroups(activeGroup);
      var count=$('#cxSearchCount');if(count)count.textContent=query?'找到 '+available.reduce(function(sum,section){return sum+sectionCount(section.id);},0)+' 条':'共 '+lore.length+' 条';
    }
    tops.onclick=function(event){var item=event.target.closest('[data-section]');if(!item)return;activeSection=item.getAttribute('data-section');activeGroup='';renderSections(activeSection);};
    cats.onclick=function(event){var item=event.target.closest('[data-group]');if(!item)return;activeGroup=item.getAttribute('data-group');renderGroups(activeGroup);};
    ents.onclick=function(event){var item=event.target.closest('[data-entry]');if(item)showEntry(Number(item.getAttribute('data-entry')));};
    if(search){search.value='';search.oninput=function(){query=chineseTitle(search.value.trim()).toLocaleLowerCase();activeSection='characters';activeGroup='';renderSections(activeSection);};}
    if(lore.length)renderSections(activeSection);else{$('#cxTtl').textContent='尚未进入时代';$('#cxTxt').textContent='进入任一时代后显示该节点世界书。';if(meta)meta.textContent='';}
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
    document.querySelectorAll('#cp_disp .sSeg').forEach(function(seg){seg.addEventListener('pointerup',function(e){
      var item=e.target.closest('span');if(!item||item.parentNode!==seg)return;
      var index=[].indexOf.call(seg.children,item);segSet('#'+seg.id,index);
      if(seg.id==='sgMotus'){uiState.motus=index;document.documentElement.setAttribute('data-motion',index?'soft':'full');window.REDUCED=!!index;}
      if(seg.id==='sgMvu'){uiState.mvu=index;if(window.WORLD_MVU)window.WORLD_MVU.setMode(index);}
      if(seg.id==='sgFace'){uiState.face=index;try{localStorage.removeItem('guardianDragonFont');}catch(_){}applyFace();}
      uiSave();
    });});
    function bindNumber(id,key,min,max,fallback,suffix,apply){var input=$(id);if(!input)return;var commit=function(){uiState[key]=clamp(input.value,min,max,fallback);input.value=uiState[key];var label=$(id+'Val');if(label)label.textContent=uiState[key]+suffix;apply();uiSave();};input.addEventListener('change',commit);input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();input.blur();}});}
    bindNumber('#cfgNarr','narr',12,30,17,'px',function(){if($('#gNarr'))$('#gNarr').style.fontSize=uiState.narr+'px';});
    bindNumber('#cfgUi','uiq',0,100,22,'%',function(){document.documentElement.style.setProperty('--ui',(uiPercent(uiState.uiq)/100).toFixed(4));if(window.WORLD_MVU)window.WORLD_MVU.mount();});
    var glass=$('#cfgGlass');if(glass)glass.addEventListener('input',function(){uiState.glass=clamp(glass.value,0,100,80);glass.style.setProperty('--rv',(uiState.glass/100).toFixed(4));applyGlass();uiSave();});
    var cfgLux=$('#cfgLux');if(cfgLux)cfgLux.addEventListener('change',function(){uiState.lux=cfgLux.checked;document.documentElement.classList.toggle('lux',uiState.lux);uiSave();});
    var fontUp=$('#fontUp'),fontFile=$('#fontFile');if(fontUp&&fontFile){fontUp.addEventListener('pointerup',function(){fontFile.click();});fontFile.addEventListener('change',function(){var file=fontFile.files&&fontFile.files[0];if(!file)return;var msg=$('#dispMsg');if(file.size>3500000){if(msg)msg.textContent='字体超过 3.5MB，请换用较小的 woff2 文件。';fontFile.value='';return;}var reader=new FileReader();reader.onload=function(){try{localStorage.setItem('guardianDragonFont',reader.result);applyFace();if(msg)msg.textContent='已载入自定义字体：'+file.name;}catch(_){if(msg)msg.textContent='本机存储空间不足，字体没有载入。';}};reader.readAsDataURL(file);fontFile.value='';});}
    var tabs=$('#cfgTabs');if(tabs)tabs.addEventListener('pointerup',function(e){var t=e.target.closest('[data-cp]');if(!t)return;tabs.querySelectorAll('[data-cp]').forEach(function(x){x.classList.toggle('on',x===t);});document.querySelectorAll('.cfgPane').forEach(function(x){x.style.display=x.id==='cp_'+t.getAttribute('data-cp')?'block':'none';});});
    document.querySelectorAll('.gDlg').forEach(function(d){d.addEventListener('pointerup',function(e){if(e.target===d)closeDialog(d);});});
    document.querySelectorAll('.gDlg .esc2').forEach(function(escButton){escButton.addEventListener('pointerup',function(){closeDialog(escButton.closest('.gDlg'));});});
    ['#svRedX','#svEsc','#exNo','#itNo','#opNo'].forEach(function(id){var b=$(id);if(b)b.addEventListener('pointerup',function(){var d=b.closest('.gDlg');if(d)closeDialog(d);});});
    var field=$('#svField');if(field)field.addEventListener('pointerup',function(e){var slot=e.target.closest('[data-slot]');if(!slot)return;field._selected=Number(slot.getAttribute('data-slot'));field.querySelectorAll('[data-slot]').forEach(function(x){x.classList.toggle('sel',x===slot);});});var saveBtns=$('#svCoreBtns');if(saveBtns)saveBtns.addEventListener('pointerup',function(e){var b=e.target.closest('[data-save-act]');if(b)saveAction(b.getAttribute('data-save-act'));});
    var exp=$('#svExp');if(exp)exp.addEventListener('pointerup',function(){download('guardian-dragon-saves.json',JSON.stringify(saveSlots(),null,2));});var imp=$('#svImp'),file=$('#svFile');if(imp&&file){imp.addEventListener('pointerup',function(){file.click();});file.addEventListener('change',function(){var f=file.files&&file.files[0];if(!f)return;f.text().then(function(t){writeSlots(JSON.parse(t));renderSaves();});});}
    var lux=$('#luxTg');if(lux)lux.addEventListener('pointerup',function(){uiState.lux=!uiState.lux;document.documentElement.classList.toggle('lux',uiState.lux);if($('#cfgLux'))$('#cfgLux').checked=uiState.lux;uiSave();});
    document.addEventListener('keydown',function(e){if(e.key!=='Escape')return;var open=[].slice.call(document.querySelectorAll('.gDlg')).reverse().find(function(d){return d.style.display==='flex'||d.style.display==='block';});if(open)closeDialog(open);});
  }
  function show(){
    if(!game)return;panelState.txTier=1;game.classList.add('txOpen');game.classList.remove('tx2','txBig');setPage('narr');
    renderMap();renderArm();renderShop();
    if(window.WORLD_MVU)window.WORLD_MVU.mount();
    if(window.FELVN)window.FELVN.tick();
  }
  applyUiSettings();
  bind();
  window.WORLD_GAME_UI={show:show,toggle:toggle,setPage:setPage,renderMap:renderMap,renderArm:renderArm,renderShop:renderShop,state:panelState};
})();
