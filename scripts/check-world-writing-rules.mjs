import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {WORLD_WRITING_RULES,worldRuleEnabled,filterWorldWriting,worldRuleOverrides} from '../core/res/world/world-writing-rules.mjs';
import {writingGenerationOptions} from '../core/res/world/dragon-writing-style.mjs';
const engine=readFileSync('core/res/world/engine.js','utf8'),app=readFileSync('core/res/world/app.js','utf8');
const wrapper=readFileSync('core/res/runtime/risu/feliniaGame-Do_6xMRR.js','utf8');
const ctx={window:{},state:{player:{mode:'custom',custom:{name:'玩家'},companions:[]},era:{name:'测试时代',cards:[]}},compactCard:()=>null,agency:['PLAYER_AGENCY'],Y:()=>null};
runInNewContext(engine.slice(engine.indexOf('var FELINIA_AUTHOR_NOTE='),engine.indexOf('var FELINIA_VOICE_EXAMPLE=')),ctx);
runInNewContext(app.slice(app.indexOf('function systemCore('),app.indexOf('function buildSystem(')),ctx);
runInNewContext(wrapper.slice(wrapper.indexOf('function Oe('),wrapper.indexOf('function ke(')),ctx);
Object.assign(ctx,{SET:{samp:{minc:900}},FELINIA_NPC_ENGINE:ctx.FELINIA_NPC_ENGINE,FELINIA_FINAL_CHECK:ctx.FELINIA_FINAL_CHECK,
 heroSheet:()=> 'HERO_CANON',mvuSpec:()=>'<mvu_panel>WORLD_PROTOCOL',presetHead:()=>'',heroTail:()=>'',povTail:()=>'',presetTail:()=>'',macroFill:t=>t});
ctx.window.WORLD_UI={systemCore:ctx.systemCore};
runInNewContext(engine.slice(engine.lastIndexOf('function sysPrompt(){'),engine.indexOf('function gameShow(){',engine.lastIndexOf('function sysPrompt(){'))),ctx);
const system=ctx.sysPrompt(),note=ctx.FELINIA_AUTHOR_NOTE,plan=ctx.Oe(null);
Object.assign(ctx,{CARDS:{luzhi:{}},GAME:{},apiReady:()=>true,worldPanel:()=>'<mvu_panel>WORLD_PROTOCOL',risuInvoke:messages=>ctx.opening=messages[1].content});
runInNewContext(engine.slice(engine.indexOf('function worldForge('),engine.lastIndexOf('function sysPrompt(){')),ctx);
ctx.worldForge({player:{name:'玩家'},eraOrdinal:1,eraName:'测试时代'},()=>{},()=>{});
const texts=[system,note,plan,ctx.opening];
const all={worldWritingRules:Object.fromEntries(WORLD_WRITING_RULES.map(r=>[r.id,true]))};
assert.equal(WORLD_WRITING_RULES.length,7);
for(const text of texts)assert.equal(filterWorldWriting(text,all),text,'all enabled restores original instructions exactly');
const disabled=texts.map(t=>filterWorldWriting(t)).join('\n');
for(const rule of WORLD_WRITING_RULES){
 assert.equal(worldRuleEnabled({},rule.id),false);
 for(const [from] of rule.edits){
  assert.ok(texts.some(t=>t.includes(from)),'source clause still exists: '+from);
  assert.ok(!disabled.includes(from),'disabled clause removed: '+from);
  assert.ok(texts.some(t=>filterWorldWriting(t,{worldWritingRules:{[rule.id]:true}}).includes(from)),'individual enable restores clause: '+rule.id);
 }
 const override=worldRuleOverrides({worldWritingRules:{[rule.id]:true}});
 assert.ok(override.includes(rule.prompt));
 for(const other of WORLD_WRITING_RULES)if(other.id!==rule.id)assert.ok(!override.includes(other.prompt));
}
assert.ok(!disabled.includes('【篇幅·硬要求】'));
for(const unchanged of ['PLAYER_AGENCY','HERO_CANON','<mvu_panel>WORLD_PROTOCOL','不得替玩家说话、思考','人物只凭自己确实知道的事实行动。','对白使用「」，转述使用『』。','不能复述设定或另起与玩家无关的事件。','不得跳过玩家输入另起事件。','只输出一个有效 JSON 对象'])assert.ok(disabled.includes(unchanged),unchanged);
const unrelated='【正典】世袭制度继续有效。玩家说：我想改变关系。不要代写玩家。';
assert.equal(filterWorldWriting(unrelated),unrelated);
for(const enabled of [true,false]){
 assert.equal(writingGenerationOptions(enabled,1200).minChars,0);
 assert.equal(writingGenerationOptions(enabled,1200,{worldWritingRules:{minLength:true}}).minChars,1200);
}
console.log('WORLD RULES PASS: exactly 7 conflicts, source/system/author note/planner/opening filtered; each re-enabled independently; non-conflicting rules unchanged');
