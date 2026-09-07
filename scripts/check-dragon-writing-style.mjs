// Run from repository root. Test dependencies: jsdom and fake-indexeddb.
// WORLD_QA_MODULES=/absolute/path/to/node_modules node scripts/check-risu-native.mjs
const deps=process.env.WORLD_QA_MODULES;
if(!deps)throw Error('Set WORLD_QA_MODULES to a node_modules directory containing jsdom and fake-indexeddb');
const {JSDOM}=await import(deps+'/jsdom/lib/api.js');
const {indexedDB,IDBKeyRange}=await import(deps+'/fake-indexeddb/build/esm/index.js');
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'http://localhost/'});
for(const k of ['window','document','location','navigator','localStorage','DOMParser','XMLSerializer','HTMLElement','HTMLIFrameElement','Element','Node'])Object.defineProperty(globalThis,k,{value:dom.window[k],configurable:true});
Object.assign(globalThis,{indexedDB,IDBKeyRange,safeStructuredClone:v=>v==null?v:JSON.parse(JSON.stringify(v))});
window.matchMedia=()=>({matches:false,addEventListener(){}});
Object.defineProperty(window,'crypto',{value:globalThis.crypto});
globalThis.Buffer=undefined;
const paths={database:'database.svelte-FgK7m0Ym',modules:'modules-BJS9D8ea',plugins:'plugins.svelte-Diqyqpbb',stores:'stores.svelte-MIgqTXU-',triggers:'triggers-Cd6DTSmI'};
const load=k=>import('../core/res/runtime/risu/'+paths[k]+'.js');
const database=await load('database'),fel=(await import('../core/res/runtime/risu/feliniaGame-Do_6xMRR.js')).FeliniaRisu;
const {createNativeSettings,clone}=await import('../core/res/world/risu-native-settings.mjs');
const {STYLE_SCOPE,STYLE_PROMPT}=await import('../core/res/world/dragon-writing-style.mjs');
const data=(await import('../core/res/world/dragon-writing-style-data.mjs')).default;
const {createHash}=await import('node:crypto');
const {runInNewContext}=await import('node:vm');
const log=console.log;console.log=()=>{};
try {
  assert.equal(data.rules.length,16);
  for(const rule of data.rules)assert.equal(createHash('sha256').update(rule.text).digest('hex'),rule.sha256);
  assert.equal(data.examples.split('<START>').length-1,6);
  assert.ok(!data.examples.includes('<mvu_panel>'));
  let settings={},saved=0;
  let native=await createNativeSettings({load,getSettings:()=>settings,save:()=>saved++});
  await fel.install({base:{name:'World',description:'WORLD_CANON'},eras:[{index:1,year:1000,name:'Era Test'},{index:2,year:1100,name:'Era Two'}],npcs:[]});
  native.restore();assert.equal(native.writingStyleEnabled(),true);
  const originalPreset=clone(native.preset()),originalNSFW=native.db().jailbreak;
  // Execute the production preparation function, including era activation,
  // content replacement and priority injection, against the real native core.
  const engine=readFileSync('core/res/world/engine.js','utf8');
  const prepareCode=engine.slice(engine.indexOf('function felRisuPrepare('),engine.indexOf('function felRisuStart('));
  const ctx={felRisuBoot:async()=>fel,_eraNow:()=>1,felTrOn:()=>false,GAME:{opText:''},
    felRisuPrompts:async()=>({apply(){}}),SET:{risu:{},semantic:{on:0}},felRisuNpcKeys:()=>[],
    FEL_RISU_NATIVE:native,FELINIA_AUTHOR_NOTE:'WORLD_AUTHOR_NOTE',loreCustomGet:()=>[],
    felRisuRegexScripts:()=>[],felMemoryId:()=> 'style-fixture'};
  runInNewContext(prepareCode,ctx);
  const worldMessages=[{role:'system',content:'WORLD_RULES\n【篇幅·硬要求】本回正文不少于900字'}, {role:'user',content:'我把杯子放下。'}];
  await ctx.felRisuPrepare(worldMessages,{});
  const char=database.getCurrentCharacter();
  assert.equal(char.depth_prompt.depth,0);
  assert.equal(char.chats[char.chatPage].note,'WORLD_AUTHOR_NOTE');
  assert.ok(char.desc.includes('WORLD_CANON'));
  assert.deepEqual(native.preset(),originalPreset);
  assert.equal(native.db().jailbreak,originalNSFW);
  const provider={base:'https://fixture.invalid/v1',key:'fixture',model:'gpt-4o',format:'openai',stream:false,maxTokens:4096,contextTokens:65536,afterConfigure:native.afterProvider};
  await fel.configureProvider(provider);
  const proc=await import('../core/res/runtime/risu/index.svelte-CX_u1ZSW.js');
  async function preview(){proc.doingChat.set(false);assert.equal(await proc.sendChat(-1,{preview:true}),true);return proc.previewFormated;}
  let messages=await preview(),joined=messages.map(m=>m.content).join('\n');
  assert.ok(joined.includes('WORLD_RULES'));
  assert.ok(joined.includes('third-person omniscient'));
  assert.equal(messages.at(-1).role,'system');
  assert.ok(messages.at(-1).content.startsWith(STYLE_SCOPE));
  assert.equal(joined.split(STYLE_SCOPE).length-1,1);
  // A template can omit author notes and main prompts; depth_prompt still arrives last.
  const template=[{type:'chat',rangeStart:0,rangeEnd:'end'},{type:'plain',role:'system',type2:'normal',text:'CUSTOM_PRESET_TAIL'}];
  native.db().promptTemplate=clone(template);
  await ctx.felRisuPrepare(worldMessages,{});
  messages=await preview();joined=messages.map(m=>m.content).join('\n');
  assert.ok(joined.indexOf(STYLE_SCOPE)>joined.indexOf('CUSTOM_PRESET_TAIL'));
  assert.equal(joined.split(STYLE_SCOPE).length-1,1);
  assert.deepEqual(native.db().promptTemplate,template);
  native.db().promptTemplate=null;
  // Dragon opt-out restores the native depth prompt. World conflict switches
  // are independent, and minimum-length retries require their own opt-in.
  native.setWritingStyle(false);assert.equal(database.getCurrentCharacter().depth_prompt,undefined);
  database.getCurrentCharacter().depth_prompt={depth:3,prompt:'ORIGINAL_DEPTH'};
  native.setWritingStyle(true);native.prepareWritingStyle();native.prepareWritingStyle();
  assert.equal(database.getCurrentCharacter().depth_prompt.prompt.split(STYLE_SCOPE).length-1,1);
  assert.ok(database.getCurrentCharacter().depth_prompt.prompt.startsWith('ORIGINAL_DEPTH'));
  native.setWritingStyle(false);
  assert.deepEqual(database.getCurrentCharacter().depth_prompt,{depth:3,prompt:'ORIGINAL_DEPTH'});
  assert.equal(native.generationOptions(900).minChars,0);
  assert.equal(native.generationOptions(900).planningNote,undefined);
  native.setWorldWritingRule('minLength',true);
  assert.equal(native.generationOptions(900).minChars,900);
  native.setWorldWritingRule('minLength',false);
  settings=JSON.parse(JSON.stringify(settings));
  native=await createNativeSettings({load,getSettings:()=>settings,save:()=>saved++});native.restore();
  assert.equal(native.writingStyleEnabled(),false);
  native.setWritingStyle(true);ctx.FEL_RISU_NATIVE=native;
  ctx._eraNow=()=>2;await ctx.felRisuPrepare(worldMessages,{});
  assert.equal(database.getCurrentCharacter().depth_prompt.depth,0);
  assert.equal(native.generationOptions(900).minChars,0);
  // Capture actual planning and final HTTP payloads. A short valid answer must
  // survive without an automatic 900-character retry. No external LLM is used.
  const requests=[];
  globalThis.fetch=window.fetch=async(url,init={})=>{
    const body=JSON.parse(init.body||'{}');requests.push(body);
    const planning=body.messages?.some(m=>m.content?.includes('【FELINIA 隐藏剧情规划器】'));
    const content=planning?JSON.stringify({v:1,beat:'等待玩家回答',focus:'Era Two'}):'我盯着杯沿。只是放下了，别的还没有说。\n「……还要吗？」';
    return new Response(JSON.stringify({choices:[{message:{content},finish_reason:'stop'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const result=await fel.generate({provider,...native.generationOptions(900),maxShortRetries:1});
  assert.ok(result.text.includes('我盯着杯沿'));
  assert.equal(requests.length,2,'one planning request and one final request; no length retry');
  assert.ok(requests[0].messages[0].content.indexOf(STYLE_SCOPE)>requests[0].messages[0].content.indexOf('【FELINIA 隐藏剧情规划器】'));
  assert.ok(!requests[0].messages[0].content.includes('本回必须推进关系、风险、决定、发现或代价；'));
  assert.ok(!requests[0].messages[0].content.includes('按“感知到的新证据 → 暂时解释'));
  assert.ok(requests[1].messages.at(-1).content.includes(STYLE_SCOPE));
  assert.ok(requests[1].messages.some(m=>m.content.includes('WORLD_RULES')));
  // A repeated line may have new meaning. Mechanical rejection is optional.
  const repeated='我盯着杯沿。只是放下了，别的还没有说。\n「……还要吗？」';
  const history=[{role:'assistant',content:repeated},{role:'user',content:'我仍然没有回答。'}];
  requests.length=0;await fel.setHistory(history);
  await fel.generate({provider,...native.generationOptions(900),maxShortRetries:1});
  assert.equal(requests.length,2,'repeat check disabled: planning + one response');
  native.setWorldWritingRule('repeatGuard',true);requests.length=0;await fel.setHistory(history);
  await fel.generate({provider,...native.generationOptions(900),maxShortRetries:1});
  assert.equal(requests.length,3,'repeat check enabled: planning + response + retry');
  native.setWorldWritingRule('repeatGuard',false);
  const {createNativeUI}=await import('../core/res/world/risu-native-ui.mjs');
  const ui=createNativeUI(native,{save:()=>saved++,getTriggers:()=>[],setTriggers(){},prepareSession:async()=>{}});
  await ui.render('preset');
  const toggle=document.querySelector('[aria-label="《粉》文风优先"]');
  assert.ok(toggle.checked);
  // Exercise each real checkbox -> saved state -> production preparation ->
  // native request assembly, rather than testing only labels or the filter.
  runInNewContext(engine.slice(engine.indexOf('var FELINIA_AUTHOR_NOTE='),engine.indexOf('var FELINIA_VOICE_EXAMPLE=')),ctx);
  for(const rule of native.worldWritingRules){
    const input=document.querySelector('[aria-label="'+rule.label+'"]');
    assert.ok(input);assert.equal(input.checked,false,rule.id+' default off');
    input.checked=true;input.dispatchEvent(new window.Event('change',{bubbles:true}));
    await ctx.felRisuPrepare(worldMessages,{});
    let prompt=(await preview()).map(m=>m.content).join('\n');
    assert.ok(prompt.includes(rule.prompt),'manual exception is sent: '+rule.id);
    assert.ok(prompt.lastIndexOf(rule.prompt)>prompt.indexOf('【本轮末位文风指令】'));
    for(const other of native.worldWritingRules)if(other.id!==rule.id)assert.equal(native.worldWritingRuleEnabled(other.id),false);
    input.checked=false;input.dispatchEvent(new window.Event('change',{bubbles:true}));
    await ctx.felRisuPrepare(worldMessages,{});
    prompt=(await preview()).map(m=>m.content).join('\n');
    assert.ok(!prompt.includes(rule.prompt),'disabled exception absent: '+rule.id);
  }
  native.setWorldWritingRule('brackets',true);
  settings=JSON.parse(JSON.stringify(settings));
  const reloaded=await createNativeSettings({load,getSettings:()=>settings,save:()=>{}});reloaded.restore();
  assert.equal(reloaded.worldWritingRuleEnabled('brackets'),true);
  assert.equal(reloaded.worldWritingRuleEnabled('minLength'),false);
  toggle.checked=false;toggle.dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.equal(native.writingStyleEnabled(),false);assert.ok(saved>0);
  log('DRAGON STYLE PASS: default/legacy/template order, era switch, real HTTP, short/repeated replies; all 7 conflict checkboxes -> persistence -> native prompt, independent enable/disable and reload');
} finally {console.log=log;dom.window.close();}
