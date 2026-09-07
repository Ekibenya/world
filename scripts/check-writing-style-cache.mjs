import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const index=read('index.html'),engine=read('core/res/world/engine.js');
// These URLs had immutable responses before the style release. An installed
// browser can retain all of them even after updating index.html and the SW.
const stale=new Set([
 '/core/res/world/engine.js?v=24',
 '/core/res/runtime/risu/risu-headless.js?v=36',
 '/core/res/runtime/risu/feliniaGame-Do_6xMRR.js',
 '/core/res/world/risu-native-settings.mjs','/core/res/world/risu-native-ui.mjs',
 '/core/res/world/dragon-writing-style.mjs','/core/res/world/dragon-writing-style-data.mjs'
]);
const entryFiles=['engine.js','risu-headless.js'];
const entries=[...index.matchAll(/src="([^"]+)"/g)].map(m=>m[1]).filter(p=>entryFiles.some(f=>p.split('?')[0].endsWith('/'+f)));
const visited=new Set();
function check(url){
 assert.ok(!stale.has(url),'must bypass already-cached module: '+url);
 if(visited.has(url))return;visited.add(url);
 const path=url.split('?')[0],text=read(path.slice(1));
 for(const m of text.matchAll(/(?:import\s*\(\s*|from\s*)['"]([^'"]+)['"]/g)){
  if(!/risu-native-|dragon-writing-style|feliniaGame-/.test(m[1]))continue;
  const next=new URL(m[1],'https://world.test'+url);
  check(next.pathname+next.search);
 }
}
entries.forEach(check);
assert.equal(visited.size,7,'entry points and entire changed module chain');
const sw=read('sw.js');for(const url of visited)assert.ok(sw.includes("'"+url+"'"),'offline preload '+url);
const handlers={},cached='old settings module';let cacheMode;
runInNewContext(sw,{
 self:{addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting(){},clients:{claim(){}}},
 location:{origin:'https://world.test'},URL,Response,
 caches:{match:async()=>new Response(cached),open:async()=>({put:async()=>{}})},
 fetch:async(request,options)=>{cacheMode=options?.cache;return new Response(cacheMode==='no-cache'?'fresh settings module':cached);}
});
let response;handlers.fetch({request:{method:'GET',url:'https://world.test/core/res/world/risu-native-settings.mjs',mode:'cors'},respondWith:p=>response=p});
assert.equal(await(await response).text(),'fresh settings module');
assert.equal(cacheMode,'no-cache');
const config=JSON.parse(read('vercel.json'));
for(const path of ['/core/res/world/risu-native-settings.mjs','/core/res/runtime/risu/risu-headless.js','/core/res/runtime/risu/feliniaGame-Do_6xMRR.js']){
 let cache;
 for(const rule of config.headers)if((rule.source.endsWith('(.*)')?path.startsWith(rule.source.slice(0,-4)):path===rule.source)){
  for(const h of rule.headers)if(h.key==='Cache-Control')cache=h.value;
 }
 assert.ok(cache?.includes('max-age=0'),'mutable code revalidates: '+path);
}
console.log('CACHE UPGRADE PASS: stale immutable URLs bypassed across 7 modules; service worker revalidates code; mutable headers');
