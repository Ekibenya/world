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
await fel.install({base:{name:'World Test'},eras:[{index:1,year:1000,name:'Era Test'}],npcs:[]});
const {createNativeSettings,clone}=await import('../core/res/world/risu-native-settings.mjs');
let settings={},session={},writes=0;
const native=await createNativeSettings({load,getSettings:()=>settings,getSession:()=>session,save:()=>writes++});
native.capture();assert.equal(native.parameterSource(),'world');assert.equal(settings.nativePreset,undefined,'saving a module must not activate a default preset');
const p={...clone(database.presetTemplate),name:'Fixture',temperature:137,maxResponse:333,maxContext:8192,promptTemplate:[{type:'plain',type2:'normal',role:'system',text:'OPTION {{getglobalvar::toggle_story}}'},{type:'jailbreak',role:'system',text:'NSFW_TEST {{char}}'},{type:'chat',rangeStart:0,rangeEnd:'end'}],customPromptTemplateToggle:'story=Story\nstyle=Style=select=Quiet,Loud\nnotes=Notes=textarea',templateDefaultVariables:'counter=1',customUnrecognizedField:{keep:['all']}};
native.addPreset(p);assert.equal(native.parameterSource(),'preset');native.setParameterSource('world');assert.equal(native.parameterSource(),'world');native.setParameterSource('preset');settings.jailbreakToggle=true;database.getDatabase().jailbreakToggle=true;
native.setVar('toggle_story','1');native.setVar('toggle_style','1');native.setVar('toggle_notes','a\nb');
assert.equal(native.options().length,3);assert.equal(native.getVar('toggle_story'),'1');
native.setLocal(true);native.setVar('toggle_story','0');assert.equal(native.getVar('toggle_story'),'0');assert.equal(database.getDatabase().globalChatVariables.toggle_story,'1');native.unpin('toggle_story');assert.equal(native.getVar('toggle_story'),'1');native.setVar('toggle_story','0');native.setLocal(false);native.setVar('toggle_story','1');assert.equal(database.getCurrentChat().GLGlobalVariables.toggle_story,undefined,'global edit removes local override like upstream');
native.addPreset({...p,name:'Second'});native.changePreset(0);native.capture();
const originalNSFW=database.getDatabase().jailbreak;
await fel.install({base:{name:'Reinstalled'},eras:[{index:1,year:1000,name:'Era Test'}],npcs:[]});native.restore();native.applySession();
assert.equal(database.getDatabase().botPresets.length,2);assert.equal(database.getDatabase().botPresetsId,0);assert.equal(native.preset().name,'Fixture');assert.equal(database.getDatabase().jailbreakToggle,true);assert.equal(database.getDatabase().jailbreak,originalNSFW);assert.deepEqual(native.preset().customUnrecognizedField,{keep:['all']});
const provider={base:'https://fixture.invalid/v1',model:'gpt-4o',key:'fixture',format:'openai',temperature:.2,maxTokens:100,contextTokens:4096,stream:false,afterConfigure:native.afterProvider};
await fel.configureProvider(provider);
assert.equal(database.getDatabase().temperature,137);assert.equal(database.getDatabase().maxResponse,333);assert.equal(database.getDatabase().forceReplaceUrl,provider.base);
native.state().parameterSource='world';await fel.configureProvider(provider);assert.equal(database.getDatabase().temperature,20);native.state().parameterSource='preset';await fel.configureProvider(provider);
const exported=await native.exportPreset();assert.ok(exported.buf.length);assert.equal(exported.data.openAIKey,'');assert.equal(database.getDatabase().forceReplaceUrl,provider.base);
await database.importPreset({name:'test.risup',data:exported.buf});assert.equal(database.getDatabase().botPresets.at(-1).temperature,137);
const module={name:'Module Test',id:'module-fixture',description:'Test',customModuleToggle:'moduleOption=Module',lorebook:[{key:'always',content:'MODULE_CONTENT',alwaysActive:true,insertionOrder:100,comment:'Module',mode:'normal'}],regex:[],trigger:[],assets:[]};
const data=await native.modules.exportModuleLegacy(module,{saveData:false,alertEnd:false});
const imported=await native.modules.readModule(Buffer.from(data));assert.equal(imported.name,module.name);assert.equal(imported.lorebook[0].content,'MODULE_CONTENT');
database.getDatabase().modules=[imported];database.getDatabase().enabledModules=[imported.id];native.modules.refreshModules();assert.equal(native.modules.getModuleLorebooks().length,1);assert.equal(native.options().length,4);
native.capture();database.getDatabase().enabledModules=[];native.modules.refreshModules();assert.equal(native.modules.getModuleLorebooks().length,0);native.restore();assert.equal(native.modules.getModuleLorebooks().length,1);
await fel.activateEra(1);await fel.setSessionContent({triggerScripts:[{comment:'Set variable',type:'manual',conditions:[],effect:[{type:'setvar',operator:'=',var:'native_test',value:'42'}]}]});
await native.runManual('Set variable');assert.equal(database.getCurrentChat().scriptstate.$native_test,'42');assert.equal(session.scriptstate.$native_test,'42');
// Native prompt generation, including options and NSFW (no LLM/network required).
await fel.setHistory([{role:'user',content:'hello'}]);await fel.configureProvider(provider);
const proc=await import('../core/res/runtime/risu/index.svelte-CX_u1ZSW.js');proc.doingChat.set(false);assert.equal(await proc.sendChat(-1,{preview:true}),true);
const preview=JSON.stringify(proc.previewFormated);assert.ok(preview.includes('OPTION 1'));assert.ok(preview.includes('NSFW_TEST Era Test'));
// Capture real native HTTP request selection with an entirely local transport double.
const requests=[];globalThis.fetch=window.fetch=async(url,init={})=>{requests.push({url:String(url),body:JSON.parse(init.body||'{}')});return new Response(JSON.stringify({choices:[{message:{content:'fixture response'},finish_reason:'stop'}]}),{status:200,headers:{'Content-Type':'application/json'}});};
native.state().models={enabled:true,values:{memory:'gpt-4o-mini',translate:'gpt-4o-mini',emotion:'gpt-4o-mini',otherAx:'gpt-4o-mini'}};
for(const task of ['memory','translate','emotion','otherAx']){const result=await fel.request({messages:[{role:'user',content:'Test'}],provider,maxTokens:32,task});assert.equal(result.text,'fixture response');assert.equal(requests.at(-1).body.model,'gpt-4o-mini');}
native.state().memoryMode='model';await fel.configureMemory({enabled:true,mode:'lexical'});native.memorySettings();assert.equal(database.getDatabase().hypaV3Presets[database.getDatabase().hypaV3PresetId].settings.summarizationModel,'subModel');
// Exercise actual DOM controls against native state, including sequential edits.
const {createNativeUI}=await import('../core/res/world/risu-native-ui.mjs');
globalThis.fetch=async url=>new Response(readFileSync('core/res/world/'+String(url).split('/').at(-1)));
let triggers=[];const ui=createNativeUI(native,{save:()=>writes++,getTriggers:()=>triggers,setTriggers:v=>triggers=v,prepareSession:async()=>{}});
await ui.render('api');
function change(label,value){const input=document.querySelector('[aria-label="'+label+'"]');assert.ok(input,label);input.value=value;input.dispatchEvent(new window.Event('change',{bubbles:true}));}
change('记忆摘要模型 ID','gpt-4o');change('翻译模型 ID','gpt-4o-mini');assert.equal(native.state().models.values.memory,'gpt-4o');assert.equal(native.state().models.values.translate,'gpt-4o-mini');
await ui.render('preset');await ui.render('lore');await ui.render('js');assert.ok(document.getElementById('native-js').textContent.includes('保存触发器'));
database.getDatabase().botPresets=[];await ui.render('preset');assert.ok(document.getElementById('native-preset').textContent.includes('预设与模块选项'));assert.ok(document.querySelector('[aria-label="当前预设"]').disabled);await ui.render('api');assert.ok(document.getElementById('native-api').textContent.includes('导入或新建原生预设后'));
assert.ok(writes>0);console.log('NATIVE INTEGRATION PASS: presets/options/modules/triggers/parameter priority/task HTTP routing/UI/persistence');dom.window.close();
