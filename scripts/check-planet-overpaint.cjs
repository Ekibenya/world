const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('core/res/world/world-planet-map.js','utf8');
function fn(name){const start=source.indexOf('function '+name+'(');assert(start>=0,name);let brace=source.indexOf('{',start),depth=1,end=brace+1;for(;depth;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}return source.slice(start,end);}
const W=360,H=180,ctx={W,H,D2R:Math.PI/180,VIEW:{ord:16},eraFlags:()=>({}),EDIT:{gestures:[]},recompose:()=>{}};
for(const k of ['BF','BHL','BON','EF','EH','EW','HGT','RNG'])ctx[k]=new Float32Array(W*H);
for(const k of ['ET','LAND'])ctx[k]=new Uint8Array(W*H);
ctx.BF.fill(.5);ctx.BHL.fill(.1);ctx.LAND.fill(1);ctx.HGT.fill(.1);
vm.createContext(ctx);vm.runInContext(['clamp','sstep','wrapLon','lonOf','latOf','pxOf','pyOf','stampRect','rectN','inRect','composeHeight','applyStamp','rebuildRect'].map(fn).join('\n'),ctx);
const idx=90*W+180,op=(k,s=5)=>({t:'type',k,r:4,s,lon:.5,lat:.5});
for(let old=1;old<=5;old++)for(let next=1;next<=5;next++)if(old!==next){
 ctx.ET.fill(0);ctx.EW.fill(0);
 for(let i=0;i<10;i++)ctx.applyStamp(op(old));assert.equal(ctx.EW[idx],1);
 ctx.applyStamp(op(next));assert.equal(ctx.ET[idx],next,`${old}->${next}`);assert(ctx.EW[idx]>0&&ctx.EW[idx]<1);
 for(let i=0;i<10;i++)ctx.applyStamp(op(next));assert.equal(ctx.EW[idx],1);
}
ctx.ET[idx]=1;ctx.EW[idx]=1;ctx.applyStamp(op(3,1));assert.equal(ctx.ET[idx],3);assert(ctx.EW[idx]>0);
ctx.ET.fill(0);ctx.EW.fill(0);
const gestures=[{t:'type',k:1,r:4,s:5,p:Array.from({length:10},()=>[.5,.5])},{t:'type',k:3,r:4,s:5,p:Array.from({length:10},()=>[.5,.5])}];
const rect=ctx.stampRect(op(1));ctx.EDIT.gestures=JSON.parse(JSON.stringify(gestures));ctx.rebuildRect(rect);assert.equal(ctx.ET[idx],3);assert.equal(ctx.EW[idx],1);
ctx.EDIT.gestures.pop();ctx.rebuildRect(rect);assert.equal(ctx.ET[idx],1);assert.equal(ctx.EW[idx],1);
ctx.EDIT.gestures=JSON.parse(JSON.stringify(gestures));ctx.rebuildRect(rect);assert.equal(ctx.ET[idx],3);
assert.equal(ctx.ET[0],0);assert.equal(ctx.EF[idx],0);assert.equal(ctx.EH[idx],0);
console.log('PASS: all 20 biome replacements, minimum strength, saturation, saved-stroke replay, undo, and untouched height/outside region');
