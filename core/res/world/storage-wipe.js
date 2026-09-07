(function(){
  'use strict';
  var button=document.getElementById('bakWipe'),message=document.getElementById('bakMsg');
  if(!button||!message)return;

  function deleteDatabase(name){
    return new Promise(function(resolve){
      if(!window.indexedDB||!name){resolve(false);return;}
      var done=false,finish=function(ok){if(done)return;done=true;resolve(ok);};
      try{
        var request=indexedDB.deleteDatabase(name);
        request.onsuccess=function(){finish(true);};
        request.onerror=function(){finish(false);};
        /* An open Risu connection closes during reload; its queued deletion then completes. */
        request.onblocked=function(){finish(false);};
        setTimeout(function(){finish(false);},1200);
      }catch(_){finish(false);}
    });
  }

  function clearIndexedDatabases(){
    if(!window.indexedDB)return Promise.resolve([]);
    var names=['feliniaPalace','guardianDragonPlanet','DPoPDB'];
    var listed=typeof indexedDB.databases==='function'
      ?Promise.resolve(indexedDB.databases()).then(function(rows){
          (rows||[]).forEach(function(row){if(row&&row.name&&names.indexOf(row.name)<0)names.push(row.name);});
        },function(){})
      :Promise.resolve();
    return listed.then(function(){return Promise.all(names.map(deleteDatabase));});
  }

  function clearOriginFiles(){
    try{
      if(!navigator.storage||typeof navigator.storage.getDirectory!=='function')return Promise.resolve();
      return navigator.storage.getDirectory().then(async function(root){
        if(!root||typeof root.entries!=='function')return;
        for await(var item of root.entries()){
          try{await root.removeEntry(item[0],{recursive:true});}catch(_){}
        }
      },function(){});
    }catch(_){return Promise.resolve();}
  }

  function clearWorldStorage(){
    /* Stop engine.js pagehide/visibility autosave before removing any key. */
    window.__WORLD_STORAGE_WIPING__=true;
    try{if(window.GAME)window.GAME.on=false;}catch(_){}
    var palace=Promise.resolve();
    try{
      if(window.FEL_RISU&&window.FEL_RISU.clearPalace)palace=Promise.resolve(window.FEL_RISU.clearPalace());
    }catch(_){}
    try{localStorage.clear();}catch(_){}
    try{sessionStorage.clear();}catch(_){}
    try{document.cookie.split(';').forEach(function(part){
      var name=part.split('=')[0].trim();if(name)document.cookie=name+'=; Max-Age=0; path=/; SameSite=Lax';
    });}catch(_){}
    var databases=palace.catch(function(){}).then(clearIndexedDatabases);
    var cacheTask=Promise.resolve();
    try{
      if(window.caches&&typeof caches.keys==='function')cacheTask=caches.keys().then(function(names){
        return Promise.all(names.map(function(name){return caches.delete(name);}));
      },function(){});
    }catch(_){}
    var workerTask=Promise.resolve();
    try{
      if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations)workerTask=navigator.serviceWorker.getRegistrations().then(function(registrations){
        return Promise.all(registrations.map(function(registration){return registration.unregister();}));
      },function(){});
    }catch(_){}
    return Promise.allSettled([databases,cacheTask,workerTask,clearOriginFiles()]);
  }

  var armed=false,armTimer=0;
  button.addEventListener('click',function(event){
    /* engine.js retains the old narrow prefix-only listener for old pages; this release owns the click. */
    event.preventDefault();event.stopImmediatePropagation();
    var keyCount=0;try{keyCount=localStorage.length;}catch(_){}
    if(!armed){
      armed=true;
      button.textContent='确认彻底清除——再点一次执行，不可撤销';
      message.textContent='将删除 '+keyCount+' 项本机资料，以及本地数据库、图库与离线缓存';
      clearTimeout(armTimer);
      armTimer=setTimeout(function(){
        if(!armed)return;armed=false;button.textContent='一键清除全部资料…';message.textContent='已取消（超时未确认）';
      },8000);
      return;
    }
    armed=false;clearTimeout(armTimer);button.style.pointerEvents='none';
    message.textContent='正在彻底清除本机资料、数据库与离线缓存…';
    clearWorldStorage().then(function(){
      message.textContent='全部资料已清除 · 正在重新载入干净页面…';
      setTimeout(function(){location.replace(location.pathname+'?reset='+Date.now());},350);
    });
  },true);

  window.WORLD_STORAGE_WIPE={run:clearWorldStorage};
})();
