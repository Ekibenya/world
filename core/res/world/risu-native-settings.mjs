/* World settings host for Risu 2026.8.250 (upstream e565563a).
 * Imports, execution, permissions and prompt parsing remain in the native engine.
 */
export const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
export const TASKS = {memory:'记忆摘要', translate:'翻译', emotion:'表情判断', otherAx:'其他辅助任务与剧情规划'};
const CONNECTION = ['aiModel','subModel','proxyRequestModel','customProxyRequestModel','forceReplaceUrl','proxyKey','customAPIFormat','usePlainFetch','autofillRequestUrl'];
const STORAGE = ['modules','enabledModules','plugins','pluginCustomStorage','globalChatVariables'];
export function parseToggleSyntax(e) {
  // Same parser as src/ts/util.ts at the pinned upstream commit.
  try {
    if (!e) return [];
    let t = [], n = e.split('\n');
    for (let e of n) {
      let [n,r,i,a] = e.split('=');
      i === 'group' || i === 'groupEnd' || i === 'divider' ? t.push({key:n,value:r,type:i,children:[]}) :
        i === 'caption' && r ? t.push({key:n,value:r,type:i}) :
        n && r && t.push({key:n,value:r,type:i === 'select' || i === 'text' || i === 'textarea' ? i : undefined,options:a?.split(',') ?? []});
    }
    return t;
  } catch (e) { console.error(e); return []; }
}
export async function createNativeSettings({load,getSettings,save,getSession}) {
  const [database,modules,plugins,stores,triggers] = await Promise.all(['database','modules','plugins','stores','triggers'].map(load));
  const db = () => database.getDatabase();
  const state = () => (getSettings().nativeState ||= {});
  const session = () => getSession?.();
  let loadedPlugins = false;
  function preset() {return db().botPresets?.[db().botPresetsId];}
  function parameterSource(){return state().parameterSource||(getSettings().nativePreset?'preset':'world');}
  function setParameterSource(value){
    if(!['preset','world'].includes(value))throw Error('未知参数来源');
    if(value==='preset'){if(!preset())throw Error('请先导入或新建原生预设');getSettings().nativePreset=clone(preset());}
    state().parameterSource=value;capture();
  }
  function capture() {
    const s=state(), d=db();
    s.presets=clone(d.botPresets);s.index=d.botPresetsId;
    for(const key of STORAGE)s[key]=clone(d[key]);
    s.models||={};s.models.enabled=!!d.seperateModelsForAxModels;s.models.values=clone(d.seperateModels);
    if(preset()&&getSettings().nativePreset)getSettings().nativePreset=clone(preset());
    getSettings().jailbreak=d.jailbreak;getSettings().jailbreakToggle=d.jailbreakToggle;
    save();
  }
  function restore() {
    const s=state(),d=db();
    if(s.presets?.length){d.botPresets=clone(s.presets);d.botPresetsId=Math.min(s.index||0,s.presets.length-1);database.changeToPreset(d.botPresetsId,false);}
    for(const key of STORAGE)if(s[key]!==undefined)d[key]=clone(s[key]);
    applyModels();modules.refreshModules();
    if(typeof getSettings().jailbreakToggle==='boolean')d.jailbreakToggle=getSettings().jailbreakToggle;
    if(typeof getSettings().jailbreak==='string')d.jailbreak=getSettings().jailbreak;
  }
  function applyModels() {
    const m=state().models,d=db();
    if(m){d.seperateModelsForAxModels=m.enabled;d.seperateModels=clone(m.values||{});}
    Object.assign(d,clone(state().connections||{}));
    d.subModel=state().subModel||'reverse_proxy';
  }
  function afterProvider(d) {
    // configureProvider owns endpoint/protocol; native setPreset owns every preset field.
    if(getSettings().nativePreset && parameterSource()==='preset'){
      const connection=Object.fromEntries(CONNECTION.map(key=>[key,clone(d[key])]));
      database.setPreset(d,clone(preset()||getSettings().nativePreset));
      Object.assign(d,connection);
    }
    applyModels();
  }
  async function startPlugins() {
    if(loadedPlugins)return;
    loadedPlugins=true;
    try {await plugins.loadPlugins();}catch(e){loadedPlugins=false;throw e;}
  }
  function changePreset(index) {
    if(!db().botPresets[index])throw Error('预设不存在');
    database.changeToPreset(index,false);getSettings().nativePreset=clone(preset());
    const s=state();s.models={enabled:!!db().seperateModelsForAxModels,values:clone(db().seperateModels)};
    capture();modules.refreshModules();
  }
  function editPreset(value) {
    if(!value || typeof value!=='object' || Array.isArray(value))throw Error('预设必须是对象');
    if(value.promptTemplate!=null&&!Array.isArray(value.promptTemplate))throw Error('模板必须是数组或 null');
    const d=db();d.botPresets[d.botPresetsId]=clone(value);changePreset(d.botPresetsId);
  }
  function addPreset(value) {
    db().botPresets.push(clone(value||database.presetTemplate));changePreset(db().botPresets.length-1);
  }
  async function exportPreset() {
    // Native serializer strips credentials. Preserve unknown imported fields in storage.
    const d=db(), before=clone(preset()),connection=Object.fromEntries(CONNECTION.map(key=>[key,clone(db()[key])]));
    database.setPreset(d,clone(before));
    try{return await database.downloadPreset(d.botPresetsId,'return');}
    finally{d.botPresets[d.botPresetsId]=before;Object.assign(d,connection);afterProvider(d);}
  }
  function deletePreset(index) {
    if(db().botPresets.length<=1)throw Error('至少保留一个预设');
    db().botPresets.splice(index,1);changePreset(Math.min(db().botPresetsId,db().botPresets.length-1));
  }
  function options() {
    return parseToggleSyntax([db().customPromptTemplateToggle,modules.getModuleToggles(),database.getCurrentCharacter()?.customModuleToggle].filter(Boolean).join('\n'));
  }
  function local() {return database.getCurrentChat();}
  function getVar(key) {
    const value=local()?.GLGlobalVariables?.[key];
    return value!=null&&value!==''&&value!=='null'?value:(db().globalChatVariables?.[key]??'null');
  }
  function setVar(key,value) {
    const chat=local();
    if(chat?.useLocallySetGlobalVariables) {
      (chat.GLGlobalVariables||={})[key]=String(value);saveSession();
    }else{if(chat?.GLGlobalVariables?.[key]!==undefined){delete chat.GLGlobalVariables[key];saveSession();}(db().globalChatVariables||={})[key]=String(value);capture();}
  }
  function saveSession() {
    const chat=local(),s=session();if(!chat||!s)return;
    for(const key of STORAGE)state()[key]=clone(db()[key]);
    s.globals=clone(chat.GLGlobalVariables||{});s.local=!!chat.useLocallySetGlobalVariables;
    s.scriptstate=clone(chat.scriptstate||{});save();
  }
  function applySession() {
    const chat=local(),s=session();if(!chat||!s)return;
    chat.GLGlobalVariables=clone(s.globals||{});chat.useLocallySetGlobalVariables=!!s.local;
    chat.scriptstate=clone(s.scriptstate||{});
    const character=database.getCurrentCharacter();
    if(character)character.lowLevelAccess=!!state().triggerLowLevelAccess;
  }
  function setLocal(value){if(!local())throw Error('进入游戏后可保存本局选项');local().useLocallySetGlobalVariables=value;saveSession();}
  function unpin(key){if(local()?.GLGlobalVariables){delete local().GLGlobalVariables[key];saveSession();}}
  function memorySettings() {
    if(state().memoryMode!=='model')return;
    const d=db(),p=d.hypaV3Presets?.[d.hypaV3PresetId];
    if(p)p.settings.summarizationModel='subModel';
    applyModels();
  }
  async function runManual(name) {
    const char=database.getCurrentCharacter();if(!char)throw Error('请先进入游戏');
    const result=await triggers.runTrigger(char,'manual',{chat:database.getCurrentChat(),manualName:name});
    if(result?.chat)database.setCurrentChat(result.chat);
    saveSession();return result;
  }
  return {database,modules,plugins,stores,triggers,db,state,preset,capture,restore,afterProvider,startPlugins,
    changePreset,editPreset,addPreset,deletePreset,exportPreset,parameterSource,setParameterSource,options,getVar,setVar,setLocal,unpin,
    applySession,saveSession,memorySettings,runManual,applyModels};
}
