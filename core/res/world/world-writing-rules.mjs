// Only the conflicting writing clauses are optional. Canon, agency, knowledge
// boundaries, voice, causality and panel instructions are not toggleable here.
export const WORLD_WRITING_RULES = [
  {id:'chain',label:'每回完成固定心理步骤',description:'要求感知、解释、辩解、修正和行动在本回依次完成。',prompt:'本回按感知、暂时解释、联想或自我辩解、修正判断、行动的完整次序展开。',edits:[
    ['每幕确定眼前欲求、阻力、一次误读、迫使误读修正的新证据，以及关系距离的变化。按“感知 → 暂时解释 → 联想或自我辩解 → 修正判断 → 行动”推进；',''],
    ['随后只按自己已经知道的事实，经历感知、误读、证据、修正与行动。','随后只按自己已经知道的事实理解当前场面。'],
    ['当前视角依次经历感知、暂时解释、联想或自我辩解、修正判断和行动。',''],
    ['三，焦点的判断是否因本幕证据发生了可追踪的变化，人物是否做出一个具体行动？\n',''],
    ['按“感知到的新证据 → 暂时解释 → 联想或自我辩解 → 修正判断 → 采取行动”的因果链安排本回，',''],
    ['沿其感知、误读、证据、修正与行动展开；','沿其当下感知与判断展开；']
  ]},
  {id:'progress',label:'每回必须产生实质推进',description:'要求每回都改变关系、风险、决定、发现或代价。',prompt:'本回让关系、风险、决定、发现或代价至少一项产生变化；推进只能来自既有场景与 NPC 自己的选择，仍不得越过需要玩家决定的位置或代写玩家。',edits:[
    ['先抓住玩家本轮明确写出的最后一句或动作，让周围世界立即产生可见后果。','先抓住玩家本轮明确写出的最后一句或动作。'],
    ['每回让关系、风险、决定、发现或代价中的一项真正变化，不能复述设定、原地等待或另起与玩家无关的事件。','不能复述设定或另起与玩家无关的事件。'],
    ['六，本回是否推进了关系、风险、决定、发现或代价，并在选择真正属于玩家的瞬间停下？','六，是否在选择真正属于玩家的瞬间停下？'],
    ['本回必须推进关系、风险、决定、发现或代价；对白必须迫使人物更新判断或下一步，不能只是复述设定、重复口头禅或等待玩家再次触发。','不能只是复述设定或重复口头禅。'],
    ['本回将发生的具体推进','本回对玩家输入的回应']
  ]},
  {id:'brackets',label:'心声固定使用（）与【】',description:'将短促自言与强烈心声分别放进两种括号。',prompt:'需要直接显露心声时，用（）写短促自言，用【】写压不住的内心句。',edits:[
    ['需要直接显露时，用（）写短促自言，用【】写压不住的内心句，让这一层形成','需要直接显露时，让这一层形成']
  ]},
  {id:'singleFocus',label:'每回只允许一个内心焦点',description:'本回不切入其他 NPC 的内心，即使有清楚的段落边界。',prompt:'本回只公开一个非玩家焦点的内心，不在本回切入其他 NPC；其余人物的动机只通过外在行为泄露。',edits:[
    ['选与本轮冲突最相关的一人作唯一内心焦点；','选与本轮冲突最相关的一人作当前内心焦点；'],
    ['本幕唯一焦点先确定四件事：','当前焦点先确定四件事：'],
    ['二，是否只有一个可直接显露内心的非玩家焦点，其他人物仍有私有动机但没有跳视角？','二，每一段是否只直接显露当前非玩家焦点的内心，没有无边界跳视角？'],
    ['只有本幕唯一焦点可以直接显露内心，其他人的动机只能通过外在行为泄露。','当前未采用其视角的 NPC，其动机只能通过外在行为泄露。']
  ]},
  {id:'noQuestions',label:'结尾禁止提问',description:'结尾只能停在动作、话音或物件上，不能以 NPC 提问收尾。',prompt:'结尾不提问；在需要玩家回应的位置，以未完成的动作、话音或物件交还控制权。',edits:[
    ['不提问、不列选项、不总结、不预告。','不列选项、不总结、不预告。']
  ]},
  {id:'minLength',label:'最低字数与不足时重写',description:'使用生成引擎的最低字数设置；不足时自动重写。',prompt:'本回正文达到 World 生成引擎设置的最低字数，状态栏不计入；仍不得编造新事实或代写玩家来凑字数。',edits:[]},
  {id:'repeatGuard',label:'重复台词自动重写',description:'与最近三回出现相同的三字以上台词时自动重写，不判断语境是否改变。',prompt:'不复用最近三回已经出现的三字以上台词；本回改用新的措辞。',edits:[
    ['不照抄范句，不重复最近三回的原句或同一种推脱。','不照抄范句，不重复同一种没有新含义的推脱。'],
    ['四，人物说的是眼前这句话，而不是复诵角色条目、口头禅或最近三回的原句？','四，人物说的是眼前这句话，而不是无新含义地复诵角色条目或口头禅？'],
    ['不得复用的台词、动作或已失去场景依据的器物','无新含义的台词复述、重复动作或已失去场景依据的器物']
  ]}
];

export const worldRuleEnabled=(settings,id)=>settings?.worldWritingRules?.[id]===true;

export function filterWorldWriting(text,settings={}) {
  let result=String(text??'');
  for(const rule of WORLD_WRITING_RULES){
    if(worldRuleEnabled(settings,rule.id))continue;
    for(const [from,to] of rule.edits)result=result.split(from).join(to);
    if(rule.id==='minLength')result=result.replace(/【篇幅·硬要求】[^\n]*(?:\n|$)/g,'');
  }
  return result;
}

export function worldRuleOverrides(settings={}) {
  const selected=WORLD_WRITING_RULES.filter(rule=>worldRuleEnabled(settings,rule.id));
  if(!selected.length)return '';
  return '【玩家手动启用的 World 写作条目】\n以下仅为玩家勾选的文风例外，在对应范围优先于 Dragon 文风；未列出的冲突条目继续关闭。世界正典、玩家主权与状态栏协议仍不受影响。\n'+selected.map(rule=>rule.prompt).join('\n');
}
