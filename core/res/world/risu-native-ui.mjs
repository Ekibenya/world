import {clone,TASKS} from './risu-native-settings.mjs';
const types={plain:'文本',jailbreak:'NSFW',cot:'思考',description:'角色描述',persona:'用户设定',lorebook:'世界书',chat:'聊天记录',authornote:'作者注释',memory:'记忆',postEverything:'末尾',chatML:'ChatML',cache:'缓存点'};
const triggerModes={start:'生成前',input:'用户输入',output:'模型输出',manual:'手动',display:'显示',request:'请求'};
function el(tag,text,attrs={}){const n=document.createElement(tag);if(text!=null)n.textContent=text;Object.assign(n,attrs);return n;}
function button(text,fn){const b=el('button',text,{type:'button',className:'eBtn'});b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){report(e);}finally{b.disabled=false;}});return b;}
function report(e){const host=Array.from(document.querySelectorAll('[data-native-status]')).find(n=>n.closest('.cfgPane')?.style.display!=='none')||document.querySelector('[data-native-status]');if(host){host.textContent=e?.message||String(e);host.setAttribute('role','alert');}else console.error(e);}
function field(host,label,value,change,kind='text',choices){const row=el('label',null,{className:'sRow'});row.append(el('span',label));let input;
 if(choices){input=el('select',null,{className:'aIn'});for(const [v,l] of Object.entries(choices))input.append(el('option',l,{value:v}));input.value=String(value??'');}
 else if(kind==='textarea'){input=el('textarea',null,{className:'aIn',rows:5,value:String(value??'')});}
 else{input=el('input',null,{className:'aIn',type:kind});if(kind==='checkbox')input.checked=!!value;else input.value=value??'';}
 input.setAttribute('aria-label',label);input.addEventListener('change',()=>{try{const v=kind==='checkbox'?input.checked:kind==='number'?Number(input.value):input.value;Promise.resolve(change(v)).catch(report);}catch(e){report(e);}});row.append(input);host.append(row);return input;}
function section(host,title,note){const d=el('details',null,{className:'nativeSection',open:true});d.append(el('summary',title));if(note)d.append(el('p',note,{className:'sub'}));host.append(d);return d;}
function jsonEditor(host,title,value,commit){const d=el('details',null,{className:'nativeSection'});d.append(el('summary',title));const ta=el('textarea',null,{className:'aIn',rows:12,value:JSON.stringify(value,null,2)});ta.setAttribute('aria-label',title);d.append(ta,button('保存 '+title,()=>commit(JSON.parse(ta.value))));host.append(d);return ta;}
function download(name,data,type='application/octet-stream'){const u=URL.createObjectURL(new Blob([data],{type}));const a=el('a',null,{href:u,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function fileButton(host,title,accept,fn){const input=el('input',null,{type:'file',accept,hidden:true});input.addEventListener('change',async()=>{const f=input.files[0];if(!f)return;try{await fn(f);}catch(e){report(e);}finally{input.value='';}});host.append(button(title,()=>input.click()),input);}
function reorder(host,list,index,save){host.append(button('上移',()=>{if(index>0){[list[index-1],list[index]]=[list[index],list[index-1]];save();}}),button('下移',()=>{if(index+1<list.length){[list[index+1],list[index]]=[list[index],list[index+1]];save();}}),button('删除',()=>{list.splice(index,1);save();}));}
export function installNativeAlerts(stores,db) {
 const dialog=el('dialog',null,{className:'nativeDialog'});document.body.append(dialog);
 let active;
 const close=msg=>{dialog.close();stores.alertStore.set({type:'none',msg});};
 dialog.addEventListener('cancel',e=>{e.preventDefault();close('');});
 stores.alertStore.subscribe(value=>{
  if(!value||value.type==='none'){dialog.close();active=null;return;}
  if(active===value)return;active=value;dialog.replaceChildren();
  let message=String(value.msg||''),items=[];
  if(value.type==='select'){items=message.split('||');if(items[0].startsWith('__DISPLAY__'))message=items.shift().slice(11);else message='请选择';}
  dialog.append(el('p',message));if(value.submsg)dialog.append(el('p',value.submsg));
  if(value.type==='wait'){if(!dialog.open)dialog.showModal();return;}
  if(value.type==='ask'){dialog.append(button('YES',()=>close('yes')),button('NO',()=>close('no')));}
  else if(value.type==='input'){const input=el('textarea',null,{className:'aIn',value:value.defaultValue||''});dialog.append(input,button('确定',()=>close(input.value)),button('取消',()=>close('')));}
  else if(value.type==='select'){items.forEach((v,i)=>dialog.append(button(v,()=>close(String(i)))));dialog.append(button('取消',()=>close('')));}
  else if(value.type==='selectModule'){for(const m of db().modules||[])dialog.append(button(m.name,()=>close(m.id)));dialog.append(button('取消',()=>close('')));}
  else dialog.append(button('确定',()=>close('')));
  if(!dialog.open)dialog.showModal();
 });
}
export function createNativeUI(native,{save,getTriggers,setTriggers,prepareSession,onPresetChanged}){
 let schemaPromise;
 let modelListPromise;
 const schema=()=>schemaPromise||=(fetch(new URL('./risu-trigger-schema.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('触发器字段载入失败');return r.json();}));
 const persist=()=>{native.capture();save();};
 const refresh=key=>render(key);
 function changed(){persist();onPresetChanged?.();refresh('preset');}
 function presetPane(host){
  const manager=section(host,'Risu 原生预设','选择后立即启用；选项保持作者定义与已保存的值。');
  const list=native.db().botPresets||[];
  field(manager,'当前预设',native.db().botPresetsId,v=>{native.changePreset(Number(v));onPresetChanged?.();refresh('preset');},'text',Object.fromEntries(list.map((p,i)=>[i,p.name||`预设 ${i+1}`])));
  manager.append(button('新建',()=>{native.addPreset();refresh('preset');}),button('复制当前预设',()=>{native.addPreset({...clone(native.preset()),name:(native.preset()?.name||'预设')+' Copy'});refresh('preset');}),button('删除当前预设',()=>{if(confirm('删除当前原生预设？')){native.deletePreset(native.db().botPresetsId);refresh('preset');}}),button('导出 .risup',async()=>{const p=await native.exportPreset();download((p.data.name||'preset')+'.risup',p.buf);}));
  fileButton(manager,'导入原生预设','.json,.preset,.risup,.risupreset',async f=>{await native.database.importPreset({name:f.name,data:new Uint8Array(await f.arrayBuffer())});native.changePreset(native.db().botPresets.length-1);onPresetChanged?.();refresh('preset');});
  const options=section(host,'预设与模块选项');renderOptions(options);
  const p=clone(native.preset());if(!p){manager.append(el('p','尚未导入原生预设，可新建或导入后编辑模板。',{className:'sub'}));manager.querySelector('select').disabled=true;for(const b of manager.querySelectorAll('button'))if(['复制当前预设','删除当前预设','导出 .risup'].includes(b.textContent))b.disabled=true;return;}
  field(manager,'名称',p.name,v=>{p.name=v;native.editPreset(p);changed();});
  field(manager,'生成参数来源',native.state().parameterSource||'preset',v=>{native.state().parameterSource=v;persist();},'text',{preset:'使用当前原生预设',world:'使用 World 生成引擎设置'});
  const template=section(host,'提示模板','条目顺序就是执行顺序；条件使用 Risu 原生宏。修改后点击保存模板。');
  const draft=clone(p);draft.promptTemplate??=[];
  field(template,'使用提示模板',p.promptTemplate!=null,v=>{p.promptTemplate=v?draft.promptTemplate:null;native.editPreset(p);changed();},'checkbox');
  const listHost=el('div');template.append(listHost);
  function draw(){listHost.replaceChildren();draft.promptTemplate.forEach((item,i)=>{
   const row=section(listHost,`${i+1}. ${item.name||types[item.type]||item.type}`);row.open=false;
   field(row,'条目名称',item.name,v=>item.name=v);
   field(row,'条目类型',item.type,v=>{item.type=v;if(v==='chat'){item.rangeStart??=0;item.rangeEnd??='end';}if(v==='plain')item.type2??='normal';draw();},'text',types);
   if(['plain','jailbreak','cot','chatML'].includes(item.type))field(row,'文本（支持条件宏）',item.text,v=>item.text=v,'textarea');
   if(['plain','jailbreak','cot'].includes(item.type)){field(row,'角色',item.role||'system',v=>item.role=v,'text',{system:'System',user:'User',bot:'Assistant'});field(row,'文本来源',item.type2||'normal',v=>item.type2=v,'text',{normal:'本条文本',main:'主提示词',globalNote:'全局注释'});}
   if(['persona','description','lorebook','postEverything','memory','authornote'].includes(item.type)){field(row,'包装格式',item.innerFormat||'',v=>item.innerFormat=v,'textarea');field(row,'角色覆盖',item.role2||'',v=>{if(v)item.role2=v;else delete item.role2;},'text',{'':'默认',system:'System',user:'User',bot:'Assistant'});}
   if(item.type==='authornote')field(row,'默认注释',item.defaultText,v=>item.defaultText=v,'textarea');
   if(item.type==='chat'){field(row,'起始条目',item.rangeStart||0,v=>item.rangeStart=v,'number');field(row,'结束条目（end 表示末尾）',item.rangeEnd??'end',v=>{if(v!=='end'&&!Number.isFinite(Number(v)))throw Error('请输入数字或 end');item.rangeEnd=v==='end'?v:Number(v);});field(row,'保留原始聊天角色',item.chatAsOriginalOnSystem,v=>item.chatAsOriginalOnSystem=v,'checkbox');}
   if(item.type==='cache'){field(row,'深度',item.depth||0,v=>item.depth=v,'number');field(row,'缓存角色',item.role||'all',v=>item.role=v,'text',{all:'全部',system:'System',user:'User',assistant:'Assistant'});}
   jsonEditor(row,'完整条目字段',item,v=>{if(!v||typeof v.type!=='string')throw Error('缺少条目 type');draft.promptTemplate[i]=v;draw();});reorder(row,draft.promptTemplate,i,draw);
  });}
  draw();template.append(button('添加条目',()=>{draft.promptTemplate.push({type:'plain',type2:'normal',role:'system',text:''});draw();}),button('保存模板',()=>{native.editPreset({...clone(native.preset()),promptTemplate:draft.promptTemplate});changed();}));
  field(template,'模板默认变量',p.templateDefaultVariables||'',v=>{p.templateDefaultVariables=v;native.editPreset(p);persist();},'textarea');
  field(template,'选项定义',p.customPromptTemplateToggle||'',v=>{p.customPromptTemplateToggle=v;native.editPreset(p);changed();},'textarea');
  field(template,'关联模块',p.moduleIntergration||'',v=>{p.moduleIntergration=v;native.editPreset(p);changed();},'textarea');
  jsonEditor(template,'完整预设字段',p,v=>{native.editPreset(v);changed();});
 }
 function renderOptions(host){
  const options=native.options();if(!options.length)host.append(el('p','当前预设与模块未定义额外选项。',{className:'sub'}));
  let group=host;
  for(const item of options){
   if(item.type==='group'){group=section(host,item.value||'选项组');continue;}
   if(item.type==='groupEnd'){group=host;continue;}
   if(item.type==='divider'){group.append(el('hr'),el('span',item.value||''));continue;}
   if(item.type==='caption'){group.append(el('p',item.value,{className:'sub'}));continue;}
   const key='toggle_'+item.key,value=native.getVar(key),v=value==='null'?'':value;
   const choices=item.type==='select'?{'':'未选择',...Object.fromEntries((item.options||[]).map((x,i)=>[i,x]))}:undefined;
   field(group,item.value,item.type?v:v==='1',v=>native.setVar(key,item.type?v:v?'1':'0'),item.type==='select'?'text':item.type||'checkbox',choices);
   if(Object.hasOwn(native.database.getCurrentChat()?.GLGlobalVariables||{},key))group.append(button('取消本局固定：'+item.value,()=>{native.unpin(key);refresh('preset');}));
  }
  field(host,'选项只保存到当前游戏',native.database.getCurrentChat()?.useLocallySetGlobalVariables,v=>native.setLocal(v),'checkbox').disabled=!native.database.getCurrentChat();
 }
 function modulesPane(host){
  const block=section(host,'Risu 模块','模块可同时包含世界书、正则、触发器、选项和资源。');
  block.append(button('导入模块',async()=>{await native.modules.importModule();persist();native.modules.refreshModules();refresh('lore');}));
  for(const m of native.db().modules||[]){
   if(!m)continue;
   const row=section(block,m.name||'模块');row.open=false;
   const enabled=native.db().enabledModules||=[];
   field(row,'启用模块',enabled.includes(m.id),v=>{native.db().enabledModules=v?[...new Set([...enabled,m.id])]:enabled.filter(x=>x!==m.id);native.modules.refreshModules();persist();refresh('lore');},'checkbox');
   if(m.description)row.append(el('p',m.description,{className:'sub'}));
   if((native.db().moduleIntergration||'').includes(m.id)||(m.namespace&&(native.db().moduleIntergration||'').includes(m.namespace)))row.append(el('p','当前预设关联了此模块；停用时也需解除预设关联。',{className:'sub'}));
   row.append(button('导出模块',async()=>download((m.name||'module')+'.risum',await native.modules.exportModuleLegacy(m,{saveData:false,alertEnd:false}))),button('删除模块',()=>{if(confirm('删除模块 '+m.name+'？')){native.db().modules=native.db().modules.filter(x=>x.id!==m.id);native.db().enabledModules=enabled.filter(x=>x!==m.id);native.modules.refreshModules();persist();refresh('lore');}}));
   jsonEditor(row,'完整模块字段',m,v=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('模块必须是对象');if(v.lowLevelAccess&&!m.lowLevelAccess&&!confirm('允许此模块使用低级访问功能？'))return;Object.assign(m,v,{id:m.id});native.modules.refreshModules();persist();refresh('lore');});
  }
 }
 function pluginsPane(host){
  const block=section(host,'Risu 原生插件','支持当前内核的 API 3.0 插件。原生权限询问会在使用相应功能时显示。');
  fileButton(block,'导入插件','.js,.ts',async f=>{await native.plugins.importPlugin(await f.text(),{isTypescript:f.name.endsWith('.ts')});persist();refresh('js');});
  block.append(button('重新加载插件',async()=>{await native.plugins.loadPlugins();persist();refresh('js');}));
  const source=section(block,'从源码安装插件');source.open=false;const sourceText=el('textarea',null,{className:'aIn',rows:10});sourceText.setAttribute('aria-label','插件源码');source.append(sourceText,button('安装源码插件',async()=>{if(!sourceText.value.trim())throw Error('请先粘贴插件源码');await native.plugins.importPlugin(sourceText.value);persist();refresh('js');}));
  for(const p of native.db().plugins||[]){
   const row=section(block,p.displayName||p.name);row.open=false;
   field(row,'启用插件',p.enabled,async v=>{p.enabled=v;persist();try{await native.plugins.loadPlugins();refresh('js');}catch(e){report(e);}},'checkbox');
   for(const [key,type] of Object.entries(p.arguments||{}))field(row,p.argMeta?.[key]?.description||key,p.realArg?.[key],v=>{(p.realArg||={})[key]=v;persist();},type==='int'?'number':p.argMeta?.[key]?.password?'password':'text');
   row.append(button('应用插件参数',async()=>{await native.plugins.loadPlugins();persist();}),button('检查更新',async()=>{const update=await native.plugins.checkPluginUpdate(p);if(!update){report('没有可用更新');return;}if(confirm('将 '+p.name+' 更新为 '+update.version+'？')){const ok=await native.plugins.updatePlugin(p);if(!ok)throw Error('插件更新失败');persist();refresh('js');}}),button('导出插件',()=>download(p.name+'.js',p.script,'text/javascript')),button('删除插件',async()=>{if(!confirm('删除插件 '+p.name+'？'))return;native.db().plugins=native.db().plugins.filter(x=>x.name!==p.name);await native.plugins.loadPlugins();persist();refresh('js');}));
  }
  const menus=section(block,'插件设置与操作');
  function drawMenus(){menus.querySelectorAll('button').forEach(b=>b.remove());for(const entries of [native.stores.additionalSettingsMenu,native.stores.additionalHamburgerMenu,native.stores.additionalChatMenu,native.stores.additionalFloatingActionButtons])for(const m of entries||[])menus.append(button(m.name||'插件操作',()=>m.callback()));}
  drawMenus();
  block.append(button('刷新插件操作',drawMenus));
 }
 async function triggersPane(host){
  const schemas=await schema(),block=section(host,'Risu 触发器','条件和动作由原生执行器运行。编辑后保存；显示与请求触发器仍受原生动作限制。');
  const list=clone(getTriggers()||[]),rows=el('div');block.append(rows);
  const commit=()=>{setTriggers(clone(list));save();};
  function typedList(host,list,title){const container=section(host,title);for(let i=0;i<list.length;i++){
   const item=list[i],row=section(container,`${i+1}. ${item.type}`);row.open=false;
   const defs=schemas[item.type]?.fields||{};
   for(const [key,meta] of Object.entries(defs)){if(key==='type')continue;
    field(row,key,meta.kind==='json'?JSON.stringify(item[key]??[],null,2):item[key],v=>{item[key]=meta.kind==='json'?JSON.parse(v):v;},meta.kind==='json'?'textarea':meta.kind==='boolean'?'checkbox':meta.kind==='number'?'number':['code','value','prompt'].includes(key)?'textarea':'text',meta.options?Object.fromEntries(meta.options.map(v=>[v,v])):undefined);
   }
   jsonEditor(row,'完整动作或条件',item,v=>{if(!v||!v.type)throw Error('缺少 type');list[i]=v;draw();});reorder(row,list,i,draw);
  }
   const names=Object.keys(schemas).filter(k=>title==='条件'?['var','value','exists','chatindex'].includes(k):!['var','value','exists','chatindex'].includes(k));
   const choice=field(container,'添加'+title,names[0],()=>{},'text',Object.fromEntries(names.map(n=>[n,n])));
   container.append(button('添加'+title,()=>{const type=choice.value,obj={type};for(const [k,m]of Object.entries(schemas[type]?.fields||{})){if(k==='type'||m.optional)continue;obj[k]=m.options?.[0]??(m.kind==='number'?0:m.kind==='boolean'?false:m.kind==='json'?[]:'');}list.push(obj);draw();}));
  }
  function draw(){rows.replaceChildren();list.forEach((t,i)=>{
   const row=section(rows,t.comment||`触发器 ${i+1}`);row.open=false;
   field(row,'启用触发器',t.worldEnabled!==false,v=>t.worldEnabled=v,'checkbox');
   field(row,'触发器名称',t.comment,v=>t.comment=v);
   field(row,'运行时机',t.type,v=>{t.type=v;draw();},'text',triggerModes);
   typedList(row,t.conditions||=[],'条件');typedList(row,t.effect||=[],'动作');
   if(t.type==='manual')row.append(button('运行此触发器',async()=>{commit();await prepareSession();await native.runManual(t.comment);report('手动触发器运行完成');}));
   reorder(row,list,i,draw);
  });}
  draw();block.append(button('新建触发器',()=>{list.push({comment:'新触发器',type:'start',conditions:[],effect:[]});draw();}),button('保存触发器',()=>{commit();report('触发器已保存');}));
  fileButton(block,'导入触发器','.json',async f=>{const v=JSON.parse(await f.text()),items=Array.isArray(v)?v:v.triggerscript||v.trigger;if(!Array.isArray(items)||items.some(t=>!t.type||!Array.isArray(t.effect)))throw Error('不是有效的 Risu 触发器数组');list.push(...items);draw();commit();});
  block.append(button('导出触发器',()=>download('risu-triggers.json',JSON.stringify(list,null,2),'application/json')));
  field(block,'允许当前角色使用低级访问功能',native.state().triggerLowLevelAccess,v=>{if(v&&!confirm('允许当前角色触发器使用原生低级访问功能？')){refresh('js');return;}native.state().triggerLowLevelAccess=v;persist();},'checkbox');
  jsonEditor(block,'完整触发器数组',list,v=>{if(!Array.isArray(v)||v.some(t=>!t.type||!Array.isArray(t.effect)))throw Error('触发器必须包含 type 和 effect 数组');setTriggers(v);save();refresh('js');});
 }
 async function modelPane(host){
  const block=section(host,'按任务选择副模型','留空时继承统一副模型；reverse_proxy 使用 AI 接口页的连接。原生模型 ID 使用下方对应的原生连接配置。');
  const m=native.state().models||={enabled:false,values:{}};m.values||={};
  const models=await (modelListPromise||=fetch(new URL('./risu-model-list.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('模型列表载入失败');return r.json();}));
  const modelOptions=el('datalist',null,{id:'native-model-options'});for(const model of models)modelOptions.append(el('option',model.name,{value:model.id}));block.append(modelOptions);
  field(block,'分别选择副模型',m.enabled,v=>{m.enabled=v;native.applyModels();persist();},'checkbox');
  field(block,'统一副模型 ID',native.state().subModel||'reverse_proxy',v=>{native.state().subModel=v.trim()||'reverse_proxy';native.applyModels();persist();}).setAttribute('list','native-model-options');
  for(const [key,label]of Object.entries(TASKS))field(block,label+'模型 ID',m.values[key]||'',v=>{m.values[key]=v.trim();native.applyModels();persist();}).setAttribute('list','native-model-options');
  field(block,'记忆摘要方式',native.state().memoryMode||'verbatim',v=>{native.state().memoryMode=v;persist();},'text',{verbatim:'保留原文（无需模型请求）',model:'使用记忆副模型摘要'});
  block.append(el('p','表情模型只在角色启用原生表情判断时调用。选择模型本身不会自动开启表情、生图或翻译。',{className:'sub'}));
  const con=section(block,'原生连接配置');con.open=false;
  const c=native.state().connections||={};
  for(const [key,label]of Object.entries({openAIKey:'OpenAI API Key',claudeAPIKey:'Claude API Key',openrouterKey:'OpenRouter API Key',openrouterRequestModel:'OpenRouter 模型'}))field(con,label,c[key]||'',v=>{c[key]=v;native.applyModels();persist();},key.endsWith('Model')?'text':'password');
  field(con,'Google API Key',c.google?.accessToken||'',v=>{c.google={...(native.db().google||{}),...(c.google||{}),accessToken:v};native.applyModels();persist();},'password');
  jsonEditor(con,'其他原生连接字段',c,v=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('连接配置必须是对象');native.state().connections=v;native.applyModels();persist();});
  if(native.preset())jsonEditor(block,'按任务分配采样参数',{enabled:native.db().seperateParametersEnabled,parameters:native.db().seperateParameters},v=>{const p=clone(native.preset());p.seperateParametersEnabled=!!v.enabled;p.seperateParameters=v.parameters;native.editPreset(p);persist();});
  else block.append(el('p','导入或新建原生预设后，可编辑分任务采样参数。',{className:'sub'}));
 }
 async function render(key){
  const root=document.getElementById('native-'+key);if(!root)return;
  root.replaceChildren();const status=el('p','',{className:'sub'});status.dataset.nativeStatus='';status.setAttribute('aria-live','polite');root.append(status);
  try{if(key==='preset')presetPane(root);if(key==='lore')modulesPane(root);if(key==='js'){pluginsPane(root);await triggersPane(root);}if(key==='api')await modelPane(root);if(key==='engine')root.append(el('p','原生预设的参数优先级在“预设 → 生成参数来源”中选择。',{className:'sub'}));}catch(e){report(e);}
 }
 const style=el('style',`.nativeSection{border-top:1px solid rgba(150,130,80,.35);margin-top:16px;padding:12px 0}.nativeSection summary{cursor:pointer;font-size:14px;font-weight:600}.nativeSection .eBtn{margin:6px 8px 4px 0;cursor:pointer}.nativeSection .sRow{gap:12px;flex-wrap:wrap}.nativeSection textarea{width:100%;min-height:90px;box-sizing:border-box;resize:vertical}.nativeSection input:not([type=checkbox]),.nativeSection select{max-width:100%;flex:1;min-width:130px}.nativeDialog{background:#151b1a;color:#efe4c8;border:1px solid #8b794d;max-width:min(600px,90vw);max-height:85vh;z-index:2147483647;white-space:pre-wrap;overflow:auto}.nativeDialog::backdrop{background:rgba(0,0,0,.75)}.nativeDialog .aIn{width:100%}.nativeDialog button{margin:8px}`);document.head.append(style);
 return {render};
}
