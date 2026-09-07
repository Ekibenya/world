const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('sw.js','utf8');
const handlers={},ctx={Response,URL,location:{origin:'https://world.test'},self:{addEventListener:(name,fn)=>handlers[name]=fn}};
vm.createContext(ctx);vm.runInContext(source,ctx);
const good=()=>new Response('export const ok=true',{headers:{'content-type':'text/javascript'}});
async function run(sequence,cached){let calls=0,puts=0;ctx.fetch=async()=>{const value=sequence[calls++];if(value instanceof Error)throw value;return value;};ctx.caches={match:async()=>cached,open:async()=>({put:async()=>puts++})};const response=await ctx.loadScript({url:'https://world.test/core/test.mjs'});await Promise.resolve();return {response,calls,puts};}
(async()=>{
 let r=await run([good()]);assert.equal(r.calls,1);assert.equal(r.response.status,200);
 for(const failure of [new Error('offline'),new Response('',{status:503}),new Response('<html>error</html>',{headers:{'content-type':'text/html'}})]){r=await run([failure],good());assert.equal(r.calls,1);assert.equal(await r.response.text(),'export const ok=true');}
 r=await run([new Error('transient'),good()]);assert.equal(r.calls,2);assert.equal(r.response.status,200);
 r=await run([new Response('',{status:404}),good()],new Response('<html/>',{headers:{'content-type':'text/html'}}));assert.equal(r.calls,2);assert.equal(r.response.status,200);
 r=await run([new Error('offline'),new Error('offline')]);assert.equal(r.calls,2);assert.equal(r.response.type,'error');assert.equal(r.puts,0);
 let intercepted=false;handlers.fetch({request:{method:'POST',url:'https://world.test/api'},respondWith:()=>intercepted=true});handlers.fetch({request:{method:'GET',url:'https://api.other.test/core/a.js'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
 console.log('PASS: script success, offline/503/HTML cache recovery, one retry, invalid cache rejection, bounded failure, API isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
