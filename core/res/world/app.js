import { requestChatCompletion } from './runtime.mjs';

const DATA_ROOT = '/core/res/data/world/';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const steps = ['loc', 'per', 'soc', 'sit'];
const stepNames = { loc: '模式', per: '人物', soc: '同伴', sit: '开场' };
const agency = [
  '不得替玩家角色说话或描写玩家未输入的内心决定',
  '告白、服从、原谅与关系升级必须由玩家明确选择',
  '杀人、牺牲与不可逆身体变化必须由玩家明确选择',
  '不得让 NPC 自动读心；非当前视角的心声通过行为泄露',
  '不得补写原文没有的人物、国家、历史、能力与隐藏真相',
];

const state = {
  index: null, customization: null, era: null, eraIndex: 0, step: 'loc', route: 'preset',
  cardId: null, companions: new Map(), custom: {}, player: null, history: [], busy: false, error: '',
};

function apiSettings() {
  try { return JSON.parse(localStorage.getItem('guardianDragonApi') || '{}'); } catch { return {}; }
}
function meta() { return state.index.eras[state.eraIndex]; }
function card(id = state.cardId) { return state.era?.cards.find((item) => item.id === id) || null; }
function rangeText(range) { return `第 ${range[0]}–${range[1]} 源章`; }
function hideAll() { $('#menu').classList.remove('show'); $('#eraSel').classList.remove('on'); $('#feWrap').classList.remove('on'); $('#game').classList.remove('show'); }
function showMenu() { hideAll(); window.MENU.on = true; $('#menu').classList.add('show'); if (window.mosStart) window.mosStart(); }
function openSettings(message = '') {
  const saved = apiSettings();
  for (const key of ['endpoint', 'model', 'apiKey', 'temperature', 'maxTokens']) if ($('#settingsForm').elements[key]) $('#settingsForm').elements[key].value = saved[key] ?? (key === 'temperature' ? .8 : key === 'maxTokens' ? 1600 : '');
  $('#settingsError').textContent = message;
  $('#dlgApi').style.display = 'flex';
}
function closeSettings() { $('#dlgApi').style.display = 'none'; }

function buildEraSelector() {
  const track = $('#esTrack'); const bar = $('#esBar'); const pips = $('#esPips'); const bands = $('#esBands');
  track.innerHTML = ''; bar.innerHTML = ''; pips.innerHTML = ''; bands.innerHTML = '';
  state.index.eras.forEach((era, index) => {
    const plate = document.createElement('button'); plate.className = 'pl'; plate.type = 'button'; plate.dataset.eraIndex = index; plate.innerHTML = `<img src="${esc(era.image)}" alt="${esc(era.name)}">`; track.append(plate);
    const cell = document.createElement('button'); cell.className = 'esCell'; cell.type = 'button'; cell.dataset.eraIndex = index; cell.innerHTML = `<img src="${esc(era.image)}" alt="">`; bar.append(cell);
    const pip = document.createElement('button'); pip.className = `pip${index % 4 === 0 ? ' mark' : ''}`; pip.type = 'button'; pip.dataset.eraIndex = index; pip.innerHTML = `<i style="background-image:url(${esc(era.image)})"></i><b>${String(index + 1).padStart(2, '0')}</b>`; pips.append(pip);
  });
  const band = document.createElement('div'); band.style.flex = '32 1 0'; const label = document.createElement('b'); label.textContent = '守护龙纪事'; band.append(label); bands.append(band);
}
function renderEra() {
  const era = meta();
  $$('#eraSel .pl,#eraSel .pip,#eraSel .esCell').forEach((element) => element.classList.toggle('on', Number(element.dataset.eraIndex) === state.eraIndex));
  $('#esNum').textContent = String(era.ordinal).padStart(2, '0');
  $('#esTtl').innerHTML = `<span>${esc(era.name)}</span><span>${rangeText(era.sourceRange)}</span>`;
  $('#esEra').textContent = `${era.presetCount} 个预设角色 · ${era.secondaryCharacterCount} 个次要人物记录`;
  const reel = $('#esReel'); const plates = $$('#esTrack .pl'); const narrow = innerWidth <= 760; const height = reel.clientHeight || 420; const gap = narrow ? Math.round(innerWidth * .10) : 6; const max = narrow ? innerWidth : innerWidth * .62;
  $('#esTrack').style.gap = `${gap}px`; let before = 0; let selectedWidth = 0;
  plates.forEach((plate, index) => { const image = state.index.eras[index]; const ratio = 1.5; const width = index === state.eraIndex || narrow ? Math.min(max, height * ratio) : 92; plate.style.width = `${width}px`; plate.style.height = `${Math.min(height, width / ratio)}px`; if (index < state.eraIndex) before += width + gap; if (index === state.eraIndex) selectedWidth = width; });
  $('#esTrack').style.transform = `translateX(${-Math.max(0, before + selectedWidth / 2 - reel.clientWidth / 2)}px)`;
  requestAnimationFrame(() => $$('#esBar .esCell')[state.eraIndex]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }));
}
function showEras() { hideAll(); window.MENU.on = false; if (window.mosStop) window.mosStop(); $('#eraSel').classList.add('on'); renderEra(); }

async function chooseEra() {
  const chosen = meta();
  try {
    const response = await fetch(`${DATA_ROOT}${chosen.bundle}`); if (!response.ok) throw new Error(`时代资料读取失败（${response.status}）`);
    state.era = await response.json(); state.era.image = chosen.image; state.route = 'preset'; state.cardId = state.era.cards.find((item) => item.isMainDragon)?.id || state.era.cards[0].id; state.companions.clear(); state.custom = {}; state.step = 'loc';
    openForge();
  } catch (error) { $('#esEra').textContent = error.message; }
}

function openForge() {
  hideAll(); const wrap = $('#feWrap'); wrap.classList.add('on'); $('#fePanR').classList.add('locArtOn'); $('#feMapImg').src = state.era.image; $('#feMapImg').alt = state.era.name; $('#feEraLbl').textContent = `AETAS ${String(state.era.ordinal).padStart(2, '0')} · ${state.era.name}`;
  renderForge();
}
function setStep(next, backwards = false) {
  if (state.step === 'per' && state.route === 'custom') state.custom = readCustom();
  const stage = $('#feStage'); stage.classList.toggle('feBack', backwards); stage.classList.add('feTurn');
  setTimeout(() => { state.step = next; renderForge(); stage.classList.add('feEnter'); stage.classList.remove('feTurn'); requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.remove('feEnter', 'feBack'))); }, 180);
}
function renderForge() {
  const wrap = $('#feWrap'); wrap.dataset.step = state.step; $('#feStName').textContent = stepNames[state.step];
  const current = steps.indexOf(state.step); $$('#feSteps i').forEach((item, index) => { item.classList.toggle('on', index === current); item.classList.toggle('done', index < current); });
  if (state.step === 'loc') renderRoute(); if (state.step === 'per') renderPersona(); if (state.step === 'soc') renderCompanions(); if (state.step === 'sit') renderOpening();
  $('#feGo').innerHTML = state.step === 'sit' ? `进入游戏<span class="key">START ⏎</span>` : `下一步<span class="key">NEXT ⏎</span>`;
  $('#feHint').textContent = `● ${state.route === 'preset' ? 'VERBATIM' : 'PLAYER API'} · ${rangeText(state.era.sourceRange)}`;
}
function renderRoute() {
  $('#feLocList').innerHTML = `<button class="feLoc ${state.route === 'preset' ? 'on' : ''}" data-route="preset"><b>默认正典开局</b><span>VERBATIM · 原文逐字</span></button><button class="feLoc ${state.route === 'custom' ? 'on' : ''}" data-route="custom"><b>自定义 API 开局</b><span>PLAYER API · 本局生成</span></button>`;
  $('#feLocN').textContent = state.route === 'preset' ? '01' : '02'; $('#feLocCn').textContent = state.route === 'preset' ? '默认正典开局' : '自定义 API 开局';
  $('#feLocD').textContent = state.route === 'preset' ? `直接显示《${state.era.opening.chapterTitle}》${state.era.opening.startParagraph}–${state.era.opening.endParagraph}，不改字、不拼接。` : '由玩家填写身份边界和当下目标，再交给玩家自己的 API；生成内容不写入正典。';
  $('#feLocW').textContent = state.route === 'preset' ? `${state.era.opening.paragraphCount} 段连续原文 · 无需 API` : '不得新增人物、国家、历史、能力、私交、秘密或后世知识。';
}
function selectCard(id) { state.cardId = id; renderPersona(); }
function renderPersona() {
  const selected = card(); $('#fePreList').innerHTML = state.era.cards.map((item) => `<button class="fePre ${item.id === state.cardId ? 'on' : ''}" data-card="${esc(item.id)}"><b>${esc(item.name)}</b><span>${item.isMainDragon ? '主角龙 · 本时代形态' : '正典可选角色'} · ${item.eraSafeDialogueSamples.length} 条本期对白</span></button>`).join('');
  const portrait = $('#fePerPortraitImg'); portrait.src = selected.portrait; portrait.alt = selected.name; portrait.classList.add('ready'); $('#fePerPortraitCap').textContent = selected.name; $('#fePerT').textContent = state.route === 'preset' ? '人物档案' : '存在条件锚点';
  $('#fePerDoss').innerHTML = cardDossier(selected);
  $('#fePerNote').textContent = state.route === 'preset' ? '对白、心声、思考方式与知识边界均来自原文证据。' : '锚点只限制自定义角色能否在本时代存在；不会把玩家变成该正典人物。';
  $('#fePerForm').innerHTML = state.route === 'custom' ? customFields() : '';
}
function evidence(items, limit = 4) { return (items || []).slice(0, limit).map((item) => `${esc(item.text)}<small>第 ${item.sourceIndex} 源章</small>`).join(''); }
function cardDossier(item) {
  const dialogue = item.eraSafeDialogueSamples?.slice(0, 4) || []; const thoughts = item.eraSafeInnerThoughtSamples?.slice(0, 3) || [];
  return `<b>身份与行动证据</b><div class="world-evidence">${evidence(item.canonIdentityEvidence)}</div><b>思考模式证据</b><div class="world-evidence">${evidence(item.thoughtEngine.privateEngineEvidence)}</div><b>原文对白样本</b><div class="world-evidence">${dialogue.length ? evidence(dialogue) : '本时代无可直接归属的对白，不伪造。'}</div><b>原文直接心声</b><div class="world-evidence">${thoughts.length ? evidence(thoughts) : esc(item.thoughtEngine.absenceRule)}</div>`;
}
function customFields() {
  const c = state.custom;
  const knowledge = ['只知道本时代公共知识', '不超过锚点角色已知范围', '比锚点知道得更少', '对隐藏真相一无所知'];
  return `<label>玩家自定姓名<input id="cuName" maxlength="40" value="${esc(c.name)}" placeholder="不新增家族史"></label><label>物种与身体形态<input id="cuSpecies" maxlength="160" value="${esc(c.speciesForm)}" placeholder="由 API 按本时代原文核对"></label><label>社会位置<input id="cuSocial" maxlength="180" value="${esc(c.social)}" placeholder="只填写本时代已有的位置"></label><label>知识范围<select id="cuKnowledge">${knowledge.map((item) => `<option ${item === c.knowledge ? 'selected' : ''}>${item}</option>`).join('')}</select></label><label>能力与完整限制<textarea id="cuCapability" placeholder="能力、代价、触发条件和上限成组填写">${esc(c.capability)}</textarea></label><label>原文未限定的外观<textarea id="cuAppearance" placeholder="不能新增器官、血统或能力">${esc(c.appearance)}</textarea></label><label>眼前目标<textarea id="cuWant" placeholder="与本时代事件兼容的即时目标">${esc(c.want)}</textarea></label><label>惯常解释与盲点<textarea id="cuMind" placeholder="怎样解释、怎样误判、怎样修正">${esc(c.mentalEngine)}</textarea></label><label>压力反应<textarea id="cuPressure" placeholder="紧迫时先注意什么、如何恢复">${esc(c.pressureResponse)}</textarea></label><label>说话习惯<textarea id="cuVoice" placeholder="不复制正典角色台词">${esc(c.dialogueSignature)}</textarea></label><label>真实风险与代价<textarea id="cuRisk" placeholder="只能取自时代危机和身份限制">${esc(c.risk)}</textarea></label>`;
}
function readCustom() {
  const get = (id) => $(id)?.value.trim() || '';
  if (!$('#cuName')) return state.custom;
  return { name: get('#cuName'), speciesForm: get('#cuSpecies'), social: get('#cuSocial'), knowledge: get('#cuKnowledge'), capability: get('#cuCapability'), appearance: get('#cuAppearance'), want: get('#cuWant'), mentalEngine: get('#cuMind'), pressureResponse: get('#cuPressure'), dialogueSignature: get('#cuVoice'), risk: get('#cuRisk') };
}
function renderCompanions() {
  const selected = card(); const others = state.era.cards.filter((item) => item.id !== selected.id);
  $('#feSocList').innerHTML = others.map((item) => `<button class="feCard ${state.companions.has(item.id) ? 'on' : ''}" data-companion="${esc(item.id)}"><b>${esc(item.name)}</b><i>${state.companions.get(item.id) || '希望争取同行'}</i><span>${esc(item.canonIdentityEvidence?.[0]?.text || '本时代正典人物')}</span></button>`).join('');
  $('#feSocCount').textContent = `${state.companions.size} / 5`; $('#feDoss').innerHTML = `<b>${esc(selected.name)}</b><br><br>同伴选择只是本局希望同行、求助、追踪或避免的意向，不自动写成旧交、血缘或恋爱。`;
}
function renderOpening() {
  const isPreset = state.route === 'preset'; $('#feSit').style.display = isPreset ? 'none' : 'block'; $('#feSitHelp').textContent = isPreset ? '下方是该节点选定的连续原文。不会按角色另写，也不会重述。' : '填写玩家希望发生在本时代正典边界内的眼前场面。内容将交给玩家自己的 API。';
  $('#feSit').placeholder = '只写玩家身份、眼前目标和可见场面；不要新增世界设定。';
  $('#feSum').innerHTML = isPreset ? `<b>${esc(state.era.opening.chapterTitle)} · ${esc(state.era.opening.startParagraph)}–${esc(state.era.opening.endParagraph)}</b><div class="world-opening">${esc(state.era.opening.verbatim)}</div>` : `<b>PLAYER API</b> 自定义开局不会写入仓库，也不会被标记为原文。`;
}
function companionPacket() { return [...state.companions].map(([id, relation]) => ({ name: card(id)?.name, relation })); }

async function beginGame() {
  if (state.route === 'preset') {
    state.player = { mode: 'preset', card: card(), agency, companions: companionPacket() }; state.history = [{ role: 'assistant', content: state.era.opening.verbatim, label: '原文默认开局' }]; showGame(); return;
  }
  const custom = readCustom(); if (!custom.name || !custom.speciesForm || !custom.social || !custom.want || !custom.mentalEngine || !custom.dialogueSignature || !custom.risk) { $('#feSum').innerHTML = '<b>尚未完成</b> 姓名、形态、社会位置、眼前目标、思考方式、说话习惯与风险需要填写。'; return; }
  if (!apiSettings().endpoint) { openSettings('自定义开局需要先填写接口、模型和密钥。'); return; }
  state.player = { mode: 'custom', anchor: card(), custom, agency, companions: companionPacket() }; state.history = []; state.busy = true; showGame();
  try { const opening = await generate($('#feSit').value.trim() || '请依据玩家填写内容和本时代证据建立开局，在玩家必须回应处停下。', true); state.history.push({ role: 'assistant', content: opening, label: '玩家 API 自定义开局' }); } catch (error) { state.error = error.message; } finally { state.busy = false; showGame(); }
}
function showGame() {
  hideAll(); $('#game').classList.add('show'); $('#gLoc').textContent = `${state.era.name} · ${state.player.mode === 'preset' ? state.player.card.name : state.player.custom.name}`;
  $('#gNarr').innerHTML = `<p class="sys">▚&nbsp;ACTVS&nbsp;I</p>${state.error ? `<p class="world-error">${esc(state.error)}</p>` : ''}${state.history.map((message) => `<p class="${message.role === 'user' ? 'me' : ''}"><span class="world-label">${esc(message.label)}</span>${esc(message.content)}</p>`).join('')}${state.busy ? '<p class="sys">ORACVLVM · 玩家 API 正在生成…</p>' : ''}<div class="gEot">·&nbsp;&nbsp;·&nbsp;&nbsp;EOT&nbsp;&nbsp;·&nbsp;&nbsp;·</div>`;
  const portrait = state.player.mode === 'preset' ? state.player.card.portrait : state.player.anchor.portrait; const name = state.player.mode === 'preset' ? state.player.card.name : state.player.custom.name;
  $('#gMfd').innerHTML = `<div class="mSec world-persona"><img src="${esc(portrait)}" alt="${esc(name)}"><div><div class="mHead"><i>◆</i>&nbsp;PERSONA</div><b>${esc(name)}</b><span>${state.player.mode === 'preset' ? '正典预设' : '玩家自定义'}</span></div></div><div class="mSec"><div class="mHead"><i>◆</i>&nbsp;AETAS&nbsp;·&nbsp;时代</div><div class="mRow"><span>${esc(state.era.name)}</span><b>${String(state.era.ordinal).padStart(2, '0')}</b></div><div class="mRow"><span>原文范围</span><b>${rangeText(state.era.sourceRange)}</b></div></div><div class="mSec"><div class="mHead"><i>◆</i>&nbsp;SOCII&nbsp;·&nbsp;同行意向</div>${state.player.companions.length ? state.player.companions.map((item) => `<div class="mLead"><i>◆</i>&nbsp;${esc(item.name)} · ${esc(item.relation)}</div>`).join('') : '<div class="mLead">未选择</div>'}</div>`;
  $('#gIn').disabled = state.busy; $('#gSend').classList.toggle('off', state.busy); requestAnimationFrame(() => { $('#gNarr').scrollTop = $('#gNarr').scrollHeight; });
}

function queryTerms(text) { const clean = String(text).replace(/[\s\p{P}\p{S}]+/gu, ''); const terms = new Set(); for (let i = 0; i < clean.length - 1; i += 1) terms.add(clean.slice(i, i + 2)); return [...terms]; }
function retrieveLore(query) {
  const always = state.era.lorebook.filter((entry) => entry.constant).map((entry) => entry.content); const terms = queryTerms(query);
  const scored = state.era.lorebook.filter((entry) => !entry.constant).flatMap((entry) => entry.content.split('\n').map((line) => ({ line, score: terms.reduce((sum, term) => sum + (line.includes(term) ? 1 : 0), entry.keys.some((key) => query.includes(key)) ? 8 : 0) }))).filter((item) => item.line.trim()).sort((a, b) => b.score - a.score);
  const chosen = []; const seen = new Set(); for (const item of scored) { if (chosen.length >= 90 || (item.score <= 0 && chosen.length >= 28)) break; if (!seen.has(item.line)) { seen.add(item.line); chosen.push(item.line); } }
  return [...always, chosen.join('\n')].filter(Boolean).join('\n\n');
}
function compactCard(item) { return item ? { name: item.name, identityEvidence: item.canonIdentityEvidence, eraDragonChronology: item.eraDragonChronology, thoughtEngine: item.thoughtEngine, dialogueSamples: item.cumulativeVoiceArchiveThroughEraEnd.dialogue, innerThoughtSamples: item.cumulativeVoiceArchiveThroughEraEnd.innerThought, knowledgeBoundary: item.knowledgeBoundary, playerAgencyRule: item.playerAgencyRule, canonClosureRule: item.canonClosureRule } : null; }
function buildSystem(query, customOpening) {
  const player = state.player.mode === 'preset' ? { route: 'preset', card: compactCard(state.player.card) } : { route: 'custom', settings: state.player.custom, anchorEvidenceOnly: compactCard(state.player.anchor) };
  const companions = state.player.companions.map((entry) => ({ ...entry, card: compactCard(state.era.cards.find((item) => item.name === entry.name)) }));
  return `你正在运行《无论你是否称呼我为守护龙，我都要去睡觉》的封闭正典角色扮演。\n\n【绝对边界】\n只能使用下面提供的原文证据。禁止新增人物、国家、历史、制度、能力、血缘、私交、秘密真相或后世知识。证据不足就让角色不知道。不得把系统正典自动变成角色知识。不得替玩家说话、思考、接受关系、原谅、服从、杀人或作不可逆决定。\n\n【自定义玩家角色的唯一例外】\n自定义路线只允许玩家填写本局身份，不得把它写成原文人物或世界正典，也不得新增家族、国家、机构、种族、能力来源、旧交或其他人物。与时代证据冲突时必须停下列出来源内可选项。\n\n【叙事与人物声音】\n使用自然中文，呈现韩国连载网文译文式的连续意识。当前视角依次经历感知、暂时解释、联想或自我辩解、修正判断和行动。对话依据每个角色自己的原文样本与决策证据，保持有限视角，不逐行跳进多个头脑。每次回应保持清楚因果，并在玩家必须回应处停下。\n\n【开局模式】\n${customOpening ? '玩家 API 自定义开局，不得声称生成内容属于原文。' : '默认开局已逐字提供，不得重写。'}\n\n【当前时代】\n${state.era.name}，${rangeText(state.era.sourceRange)}。\n\n【玩家】\n${JSON.stringify(player, null, 2)}\n\n【同伴契约】\n${JSON.stringify(companions, null, 2)}\n\n【玩家主权】\n${agency.join('\n')}\n\n【按请求检索到的世界书】\n${retrieveLore(`${query}\n${JSON.stringify(player)}\n${JSON.stringify(companions)}`)}`;
}
async function generate(text, customOpening = false) { const config = apiSettings(); if (!config.endpoint || !config.model || !config.apiKey) throw new Error('请先填写接口、模型和密钥。'); return requestChatCompletion(config, [{ role: 'system', content: buildSystem(text, customOpening) }, ...state.history.map(({ role, content }) => ({ role, content })), { role: 'user', content: text }]); }
async function sendMessage() { const input = $('#gIn'); const text = input.value.trim(); if (!text || state.busy) return; input.value = ''; state.error = ''; state.history.push({ role: 'user', content: text, label: '玩家' }); state.busy = true; showGame(); try { state.history.push({ role: 'assistant', content: await generate(text), label: '叙事' }); } catch (error) { state.error = error.message; } finally { state.busy = false; showGame(); } }

document.addEventListener('click', (event) => {
  const eraTarget = event.target.closest('[data-era-index]'); if (eraTarget) { const index = Number(eraTarget.dataset.eraIndex); if (index === state.eraIndex && eraTarget.classList.contains('pl')) chooseEra(); else { state.eraIndex = index; renderEra(); } return; }
  const route = event.target.closest('[data-route]'); if (route) { state.route = route.dataset.route; renderRoute(); return; }
  const persona = event.target.closest('[data-card]'); if (persona) { selectCard(persona.dataset.card); return; }
  const companion = event.target.closest('[data-companion]'); if (companion) { const id = companion.dataset.companion; if (state.companions.has(id)) state.companions.delete(id); else if (state.companions.size < 5) state.companions.set(id, '希望争取同行'); renderCompanions(); return; }
});
$('#miMiss').addEventListener('pointerup', showEras); $('#miOrac').addEventListener('pointerup', () => openSettings()); $('#esBack').addEventListener('pointerup', showMenu);
$('#feGo').addEventListener('pointerup', () => { const index = steps.indexOf(state.step); if (index < steps.length - 1) setStep(steps[index + 1]); else beginGame(); });
$('#feBack').addEventListener('pointerup', () => { const index = steps.indexOf(state.step); if (index > 0) setStep(steps[index - 1], true); else showEras(); });
$('#gtApi').addEventListener('pointerup', () => openSettings()); $('#gtExit').addEventListener('pointerup', showMenu); $('#gSend').addEventListener('pointerup', sendMessage); $('#gIn').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); sendMessage(); } });
$('#apiCancel').addEventListener('pointerup', closeSettings); $('#dlgApi').addEventListener('pointerup', (event) => { if (event.target === $('#dlgApi')) closeSettings(); });
$('#settingsForm').addEventListener('submit', (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget).entries()); if (!data.endpoint || !data.model || !data.apiKey) { $('#settingsError').textContent = '接口地址、模型和密钥都需要填写。'; return; } localStorage.setItem('guardianDragonApi', JSON.stringify(data)); closeSettings(); });
addEventListener('keydown', (event) => { if (event.key === 'Escape') { if ($('#dlgApi').style.display === 'flex') closeSettings(); else if ($('#game').classList.contains('show')) showMenu(); else if ($('#feWrap').classList.contains('on')) { const index = steps.indexOf(state.step); if (index > 0) setStep(steps[index - 1], true); else showEras(); } else if ($('#eraSel').classList.contains('on')) showMenu(); } if ($('#eraSel').classList.contains('on') && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { state.eraIndex = Math.max(0, Math.min(state.index.eras.length - 1, state.eraIndex + (event.key === 'ArrowRight' ? 1 : -1))); renderEra(); } });
addEventListener('resize', () => { if ($('#eraSel').classList.contains('on')) renderEra(); });

async function init() {
  try { const [a, b] = await Promise.all([fetch(`${DATA_ROOT}index.json`), fetch(`${DATA_ROOT}customization.json`)]); if (!a.ok || !b.ok) throw new Error('正典资料索引读取失败。'); state.index = await a.json(); state.customization = await b.json(); buildEraSelector(); showMenu(); }
  catch (error) { $('#menu .mFoot').textContent = error.message; }
}
init();
