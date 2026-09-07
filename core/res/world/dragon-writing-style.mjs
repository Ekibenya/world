import data from './dragon-writing-style-data.mjs?v=world-rules-1';
import {worldRuleEnabled,worldRuleOverrides} from './world-writing-rules.mjs?v=world-rules-1';
// Risu database values may be Svelte proxies, which structuredClone rejects.
const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));

// Fixed values are resolved before the request; no accumulating ST variables.
export const WORD_COUNT_PROMPT = `<word_count>
**字数要求**：正文每次响应字数不小于1000，不大于3000。
这是本轮正文篇幅的最高优先级要求；其他预设、文风示例、历史回复及回合节奏中的篇幅要求与此冲突时，以此为准。
正文指小说叙事、对白与心声；若使用 <content>，仅计算其中正文。状态栏、<mvu_panel>、思考与控制标签不计入，不为计数额外添加正文标签。
在当前场景内充分展开人物的感知、判断、心声、对白与反应；保持韩文文风（若已开启）、World 世界规则及玩家控制权，不代写玩家，不靠复述或无关事件凑字数。
</word_count>`;

export const STYLE_SCOPE = `【World 文风优先级：《粉 v10》】
World 的当前时代正典、人物身份与能力、在场名单、玩家控制权、记忆、输入模式、游戏机制和 <mvu_panel> 字段协议继续生效。以下优先级只管小说正文怎样写，不改写世界事实，也不扩大代写玩家的权限。
文风发生冲突时，采用《粉 v10》的第一人称焦点、连续意识、对白、停顿和回合节奏，优先于 Risu 默认预设、World 作者注释、旧范文、落笔检查及隐藏剧情计划中的写法。旧回复只延续已发生事实，不锁定旧文风。
“我”属于当前清醒的非玩家焦点，绝不是玩家。沿用已明确的非玩家焦点；尚未明确时，从当前确实在场且能感知的 NPC 中选与交互最相关的一人，之后延续，不能新造人物。无人可作焦点时只写可感知外部事实，不虚构一个心声者。必要的 NPC 视角切换必须有清楚边界且不进入玩家内心。
心声用该人物自己的口语与第一人称在正文自然展开，不强制套（）或【】，不写成旁观心理报告。感知、误认、辩解与修正可以跨回合，不能强迫每轮完成整套流程或产生新事件。篇幅遵守请求开头的 <word_count> 要求，在当前交换内充分展开；不越过真正需要玩家作决定的位置。允许 NPC 提问并等待，不受旧文风“不提问”的要求限制。
下面的范例只是独立的写法示范，其中的姓名、地点、族群、道具与经历不是本局正典；只采用写法，不移植其世界或角色设定。范例中的动作均是玩家已经明确给出的动作，绝不借此补写玩家未输入的言行。状态栏仍严格输出 World 当前协议，不能换用《粉》的面板字段。`;

export const STYLE_PROMPT = [STYLE_SCOPE,
  ...data.rules.map(rule=>rule.text),
  '【独立文风示例·不属于本局事实】\n'+data.examples,
  '【本轮末位文风指令】\n'+data.postHistory,
  '【篇幅适用边界】上述原始文风材料中允许短回合、篇幅随输入决定的表述，只约束事件跨度，不降低请求开头 <word_count> 规定的正文 1000～3000 字要求。充分展开当前意识与交流，不预写玩家的回应。',
  '【适用边界复核】以上“开局焦点”一律对应 World 本局已经确定的非玩家焦点；示例身份不进入本局。保留 World 正典、玩家主权与状态栏，仅在文风冲突处采用上述写法。'
].join('\n\n');

// Native Risu inserts depth_prompt after both legacy and template assembly.
// Keep a pre-existing depth prompt recoverable and avoid stacking each turn.
export function applyWritingStyle(character,enabled=true,overrides='') {
  if(!character||character.type==='group')return;
  const ext=character.extentions||={},saved=ext.worldWritingStyle;
  if(!enabled){
    if(saved){
      if(saved.originalDepth==null)delete character.depth_prompt;
      else character.depth_prompt=copy(saved.originalDepth);
      delete ext.worldWritingStyle;
    }
    return;
  }
  if(!saved)ext.worldWritingStyle={originalDepth:character.depth_prompt?copy(character.depth_prompt):null};
  character.extentions=ext;
  const original=ext.worldWritingStyle.originalDepth?.prompt;
  character.depth_prompt={depth:0,prompt:[original,STYLE_PROMPT,overrides].filter(Boolean).join('\n\n')};
}

export function writingGenerationOptions(enabled,minChars,settings={}) {
  const planningNote=[enabled?STYLE_SCOPE:'',worldRuleOverrides(settings)].filter(Boolean).join('\n\n');
  return {minChars:worldRuleEnabled(settings,'minLength')?Math.round(minChars):0,repeatGuard:worldRuleEnabled(settings,'repeatGuard'),...(planningNote?{planningNote}:{})};
}

export const writingStyleSource=data.source;
