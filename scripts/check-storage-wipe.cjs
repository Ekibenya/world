const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('core/res/world/storage-wipe.js','utf8');
const local=new Map([['guardianDragonSet','settings'],['guardianDragonAuto2','save'],['unknownWorldKey','legacy']]);
const deleted=[],cacheDeleted=[],unregistered=[],filesDeleted=[];
const indexedDB={
  databases:async()=>[{name:'guardianDragonPlanet'},{name:'extraWorldDatabase'}],
  deleteDatabase(name){deleted.push(name);const request={};queueMicrotask(()=>request.onsuccess&&request.onsuccess());return request;}
};
const root={
  async *entries(){yield ['gallery'];yield ['model-cache'];},
  async removeEntry(name,options){filesDeleted.push([name,options.recursive]);}
};
const ctx={
  Promise,queueMicrotask,setTimeout,clearTimeout,window:{indexedDB,caches:{},GAME:{on:true},FEL_RISU:{clearPalace:async()=>ctx.palaceCleared=true}},indexedDB,
  localStorage:{get length(){return local.size;},clear(){local.clear();}},
  sessionStorage:{clear(){ctx.sessionCleared=true;}},
  document:{cookie:'one=1; two=2',getElementById:id=>id==='bakWipe'?ctx.button:ctx.message},
  caches:{keys:async()=>['old-assets','gallery-cache'],delete:async name=>(cacheDeleted.push(name),true)},
  navigator:{storage:{getDirectory:async()=>root},serviceWorker:{getRegistrations:async()=>[
    {unregister:async()=>(unregistered.push('a'),true)},{unregister:async()=>(unregistered.push('b'),true)}
  ]}},
  button:{style:{},addEventListener(type,listener,capture){ctx.listener=listener;ctx.capture=capture;}},message:{}
};
ctx.window.caches=ctx.caches;
vm.createContext(ctx);
vm.runInContext(source,ctx);
(async()=>{
  assert.equal(ctx.capture,true,'new handler intercepts old prefix-only handler');
  await ctx.window.WORLD_STORAGE_WIPE.run();
  assert.equal(ctx.window.__WORLD_STORAGE_WIPING__,true);
  assert.equal(ctx.window.GAME.on,false,'pagehide autosave disabled before deletion');
  assert.equal(local.size,0,'all localStorage keys, including current and future names');
  assert.equal(ctx.sessionCleared,true);
  assert.equal(ctx.palaceCleared,true);
  assert.deepEqual(new Set(deleted),new Set(['feliniaPalace','guardianDragonPlanet','DPoPDB','extraWorldDatabase']));
  assert.deepEqual(cacheDeleted,['old-assets','gallery-cache']);
  assert.deepEqual(unregistered,['a','b']);
  assert.deepEqual(filesDeleted,[['gallery',true],['model-cache',true]]);
  const index=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
  assert.match(index,/storage-wipe\.js\?v=1/);assert.match(sw,/guardian-dragon-art-v97/);assert.match(sw,/storage-wipe\.js\?v=1/);
  console.log('PASS: full storage wipe, write lock, databases, OPFS, Cache Storage, service workers, and cache-version rollout');
})().catch(error=>{console.error(error);process.exitCode=1;});
