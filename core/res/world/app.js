import { requestChatCompletion } from './runtime.mjs';
import { selectLoreEntries } from './lore-retrieval.mjs';

const DATA_ROOT = '/core/res/data/world/';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const steps = ['loc', 'per', 'soc', 'sit'];
const stepNames = { loc: '地点', per: '人物', soc: '同伴', sit: '开场' };
const agency = [
  '不得替玩家角色说话或描写玩家未输入的内心决定',
  '告白、服从、原谅与关系升级必须由玩家明确选择',
  '杀人、牺牲与不可逆身体变化必须由玩家明确选择',
  '不得让非玩家人物自动读心；非当前视角的心声通过行为泄露',
  '不得补写当前时代世界书没有的人物、国家、历史、能力与隐藏真相',
];

const state = {
  index: null, customization: null, intros: null, era: null, eraIndex: 0, step: 'loc', route: 'preset',
  cardId: null, companions: new Map(), custom: {}, player: null, history: [], busy: false, error: '', loc: null,
};

function apiSettings() {
  try { return JSON.parse(localStorage.getItem('guardianDragonApi') || '{}'); } catch { return {}; }
}
function meta() { return state.index.eras[state.eraIndex]; }
function card(id = state.cardId) { return state.era?.cards.find((item) => item.id === id) || null; }
function cardPortrait(item) { return item?.portrait || (item?.id ? `/art/portraits/${state.era.id}/${item.id}.png` : ''); }
function rangeText(range) { return `${range[1] - range[0] + 1} 个连续剧情节点`; }
function hideAll() { $('#menu').classList.remove('show'); $('#eraSel').classList.remove('on'); $('#feWrap').classList.remove('on'); $('#game').classList.remove('show'); if (window.WORLD_MVU) window.WORLD_MVU.stop(); }
function showMenu() { hideAll(); window.MENU.on = true; $('#menu').classList.add('show'); if (window.mosStart) window.mosStart(); }
function openSettings(message = '') {
  const saved = apiSettings();
  $('#apiBase').value = saved.endpoint || ''; $('#apiModel').value = saved.model || ''; $('#apiKey').value = saved.apiKey || '';
  $('#apiMsg').textContent = message;
  $('#dlgApi').style.display = 'flex';
}
function closeSettings() { $('#dlgApi').style.display = 'none'; }

function annalsRows() {
  return state.index.eras.map((era) => ({
    i: era.ordinal,
    src: era.image,
    era: era.name.split(/[、，与]/, 1)[0],
    y: rangeText(era.sourceRange),
    ys: era.sourceRange[0],
    t: era.name,
    s: era.arcTitles?.length ? era.arcTitles.join(' · ') : `${era.presetCount} 个预设角色 · ${era.secondaryCharacterCount} 个次要人物记录`,
    recap: era.recap,
    synopsis: era.synopsis,
    primer: state.intros?.standalonePrimer || '',
    history: (state.intros?.historyMilestones || [])
      .filter((item) => item.ordinal < era.ordinal - 1)
      .map((item) => {
        const title = state.index.eras.find((candidate) => candidate.ordinal === item.ordinal)?.name || '';
        return `${String(item.ordinal).padStart(2, '0')}　${title}${title ? '：' : ''}${item.summary}`;
      })
      .join('\n'),
    opening: era.opening?.chapterTitle || '',
    r: 1.5,
  }));
}
function showEras() {
  hideAll(); window.MENU.on = false; if (window.mosStop) window.mosStop();
  window.esOpen('world');
}

async function chooseEra() {
  const chosen = meta();
  try {
    const response = await fetch(`${DATA_ROOT}${chosen.bundle}`); if (!response.ok) throw new Error(`时代资料读取失败（${response.status}）`);
    state.era = await response.json(); state.era.image = chosen.image; state.route = 'preset'; state.cardId = state.era.cards.find((item) => item.isMainDragon)?.id || state.era.cards[0].id; state.companions.clear(); state.custom = {}; state.loc = null; state.step = 'loc';
    openForge();
  } catch (error) { $('#esEra').textContent = error.message; }
}

function openForge() {
  hideAll(); const wrap = $('#feWrap'); wrap.classList.add('on'); $('#fePanR').classList.remove('locArtOn'); $('#fePanR').classList.add('locPlanet'); $('#feEraLbl').textContent = `AETAS ${String(state.era.ordinal).padStart(2, '0')} · ${state.era.name}`;
  mountPlanet('forge');
  state.step = ''; setStep('loc', false, true);
}
/* 星球：开局「地点」步铺满底层，正文时挂进地图面板；两处是同一颗星球。 */
function planet() { return window.WORLD_PLANET_MAP || null; }
function mountPlanet(mode) {
  const map = planet(); if (!map) return;
  if (!map._wired) {
    map._wired = true;
    map.onPick((site) => { if (!site) return; state.loc = site; if (state.step === 'loc' && $('#feWrap').classList.contains('on')) renderRoute(); if ($('#game').classList.contains('show')) $('#gLoc').textContent = gameHeader(); });
    map.onProgress((f, label) => { const el = $('#feLocW'); if (el && state.step === 'loc' && !state.loc) el.textContent = f < 1 ? `星球生成中 · ${label} ${Math.round(f * 100)}%` : ''; });
  }
  if (mode === 'forge') { $('#feBg').classList.add('planetOn'); map.mountForge($('#feBg')); } else map.mountPanel($('#gmMap'));
  map.render({ era: state.era });
  if (state.loc) { if (state.loc.free && map.ready()) map.selectCoord(state.loc.lon, state.loc.lat); else if (!state.loc.free) map.select(state.loc.id); }
}
function gameHeader() { return `${state.era.name}${state.loc ? ' · ' + state.loc.name : ''} · ${state.player.mode === 'preset' ? state.player.card.name : state.player.custom.name}`; }
function applyStep(next) {
  if (state.step === 'per' && state.route === 'custom') state.custom = readCustom();
  state.step = next;
  $('#fePanR').classList.toggle('locPlanet', next === 'loc'); $('#feBg').classList.toggle('planetOn', next === 'loc');
  renderForge();
}
const FE_TURN = 190;
function enterStep(stage) {
  stage.classList.remove('feTurn'); stage.classList.add('feEnter');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    stage.classList.remove('feEnter');
    state._btmr = setTimeout(() => { state._btmr = 0; stage.classList.remove('feBack'); }, 400);
  }));
}
function setStep(next, backwards = false, instant = false) {
  const stage = $('#feStage'); if (!stage) { applyStep(next); return; }
  if (state._tmr) { clearTimeout(state._tmr); state._tmr = 0; }
  if (state._btmr) { clearTimeout(state._btmr); state._btmr = 0; }
  stage.classList.toggle('feBack', Boolean(backwards));
  if (instant || !state.step) { applyStep(next); enterStep(stage); return; }
  stage.classList.remove('feEnter'); stage.classList.add('feTurn');
  state._tmr = setTimeout(() => { state._tmr = 0; applyStep(next); enterStep(stage); }, FE_TURN);
}
function renderForge() {
  const wrap = $('#feWrap'); wrap.dataset.step = state.step; $('#feStName').textContent = stepNames[state.step];
  const current = steps.indexOf(state.step); $$('#feSteps i').forEach((item, index) => { item.classList.toggle('on', index === current); item.classList.toggle('done', index < current); });
  if (state.step === 'loc') renderRoute(); if (state.step === 'per') renderPersona(); if (state.step === 'soc') renderCompanions(); if (state.step === 'sit') renderOpening();
  $('#feGo').innerHTML = state.step === 'sit' ? `进入游戏<span class="key">START ⏎</span>` : `下一步<span class="key">NEXT ⏎</span>`;
  $('#feHint').textContent = `● ${state.route === 'preset' ? 'VERBATIM' : 'PLAYER API'} · ${rangeText(state.era.sourceRange)}`;
}
function renderRoute() {
  const map = planet(); const sites = map ? map.sitesFor(state.era.ordinal, 'surface') : [];
  const routeHtml = `<div class="feColH feRouteH">开局方式</div><div class="feRoutes"><button class="feLoc feRoute ${state.route === 'preset' ? 'on' : ''}" data-route="preset"><b>默认正典开局</b><span>VERBATIM · 原文逐字</span></button><button class="feLoc feRoute ${state.route === 'custom' ? 'on' : ''}" data-route="custom"><b>自定义 API 开局</b><span>PLAYER API · 本局生成</span></button></div>`;
  const siteHtml = sites.length ? `<div class="feColH feRouteH">这一代能落脚的地方 · ${sites.length}</div>` + sites.map((site, index) => `<button class="feLoc feSite ${state.loc && state.loc.id === site.id ? 'on' : ''}" data-site="${esc(site.id)}"><b>${esc(site.name)}</b><span>${String(index + 1).padStart(2, '0')} · ${esc(site.kind)}${site.unplaced ? ' · 方位未载' : ''}</span></button>`).join('') : `<div class="feNote">星球资料载入中…</div>`;
  $('#feLocList').innerHTML = routeHtml + siteHtml;
  const loc = state.loc;
  $('#feLocN').textContent = loc ? (loc.free ? 'LOCVS' : String(Math.max(1, sites.findIndex((site) => site.id === loc.id) + 1)).padStart(2, '0')) : '—';
  $('#feLocCn').textContent = loc ? loc.name : '在星球上拣一处';
  $('#feLocD').textContent = loc ? loc.summary : '转动星球，点一处地名落脚；也可以点任意座标，神谕会按那里的地貌铺陈场面。留空则由默认开局决定。';
  $('#feLocW').innerHTML = loc ? `${esc([loc.region, loc.biome, loc.elev].filter(Boolean).join(' · '))}${loc.coord ? ' · ' + esc(loc.coord) : ''}${loc.ref ? `<br>原文 · ${esc(loc.ref)}` : ''}<br>${state.route === 'preset' ? `开局仍按《${esc(state.era.opening.chapterTitle)}》原文逐字进入；地点写进玩家档案，供之后的对话取用。` : '自定义开局会把这一处的地貌与出处交给神谕。'}` : (state.route === 'preset' ? `连续正典正文 · 无需 API` : '不得新增人物、国家、历史、能力、私交、秘密或后世知识。');
}
function selectCard(id) { state.cardId = id; renderPersona(); }
function renderPersona() {
  const selected = card(); $('#fePreList').innerHTML = state.era.cards.map((item) => `<button class="fePre ${item.id === state.cardId ? 'on' : ''}" data-card="${esc(item.id)}"><b>${esc(item.name)}</b><span>${item.isMainDragon ? '主角龙 · 本时代形态' : '正典可选角色'} · ${item.eraSafeDialogueSamples.length} 条本期对白</span></button>`).join('');
  turnPortrait(cardPortrait(selected), selected.name, selected.name); $('#fePerT').textContent = state.route === 'preset' ? '人物档案' : '存在条件锚点';
  $('#fePerDoss').innerHTML = cardDossier(selected);
  $('#fePerNote').textContent = state.route === 'preset' ? '身份、判断方式、声口与知识边界均已整理为可直接扮演的正典角色档案。' : '锚点只限制自定义角色能否在本时代存在；不会把玩家变成该正典人物。';
  $('#fePerForm').innerHTML = state.route === 'custom' ? customFields() : '';
}
const FE_PTURN = 190;
function turnPortrait(src, alt, capText) {
  const box = $('#fePerPortrait'), img = $('#fePerPortraitImg'), cap = $('#fePerPortraitCap'); if (!box || !img) return;
  if (img.getAttribute('src') === src) { img.alt = alt; img.classList.add('ready'); if (cap) cap.textContent = capText; return; }
  const run = box._run = (box._run || 0) + 1; if (box._t) clearTimeout(box._t); if (box._g) clearTimeout(box._g);
  let loaded = false, turned = false;
  const done = () => { if (box._run !== run || !loaded || !turned) return; if (box._g) clearTimeout(box._g); img.src = src; img.alt = alt; img.classList.add('ready'); if (cap) cap.textContent = capText; box.classList.remove('pTurn'); box.classList.add('pEnter'); requestAnimationFrame(() => requestAnimationFrame(() => { if (box._run === run) box.classList.remove('pEnter'); })); };
  const preload = new Image(); preload.onload = () => { loaded = true; done(); }; preload.onerror = () => { if (box._run !== run) return; img.removeAttribute('src'); img.classList.remove('ready'); if (cap) cap.textContent = capText; box.classList.remove('pTurn', 'pEnter'); };
  box.classList.add('pTurn'); box._t = setTimeout(() => { box._t = 0; turned = true; done(); }, FE_PTURN); box._g = setTimeout(() => { box._g = 0; if (box._run === run && !loaded) box.classList.remove('pTurn', 'pEnter'); }, 2600); preload.src = src;
}
function evidence(items, limit = 4) { return (items || []).slice(0, limit).map((item) => esc(item.text ?? item)).join(''); }
function cardDossier(item) {
  const dialogue = item.eraSafeDialogueSamples?.slice(0, 4) || []; const thoughts = item.eraSafeInnerThoughtSamples?.slice(0, 3) || [];
  return `<b>身份与处境</b><div class="world-evidence">${evidence(item.canonIdentityEvidence)}</div><b>判断与行动方式</b><div class="world-evidence">${evidence(item.thoughtEngine.privateEngineEvidence)}</div><b>对白声口样本</b><div class="world-evidence">${dialogue.length ? evidence(dialogue) : '本时代无可直接归属的对白，不伪造。'}</div><b>直接心声样本</b><div class="world-evidence">${thoughts.length ? evidence(thoughts) : esc(item.thoughtEngine.absenceRule)}</div>`;
}
function customFields() {
  const c = state.custom;
  const knowledge = ['只知道本时代公共知识', '不超过锚点角色已知范围', '比锚点知道得更少', '对隐藏真相一无所知'];
  return `<label>玩家自定姓名<input id="cuName" maxlength="40" value="${esc(c.name)}" placeholder="不新增家族史"></label><label>物种与身体形态<input id="cuSpecies" maxlength="160" value="${esc(c.speciesForm)}" placeholder="由 API 按当前时代世界书核对"></label><label>社会位置<input id="cuSocial" maxlength="180" value="${esc(c.social)}" placeholder="只填写本时代已有的位置"></label><label>知识范围<select id="cuKnowledge">${knowledge.map((item) => `<option ${item === c.knowledge ? 'selected' : ''}>${item}</option>`).join('')}</select></label><label>能力与完整限制<textarea id="cuCapability" placeholder="能力、代价、触发条件和上限成组填写">${esc(c.capability)}</textarea></label><label>正典未限定的外观<textarea id="cuAppearance" placeholder="不能新增器官、血统或能力">${esc(c.appearance)}</textarea></label><label>眼前目标<textarea id="cuWant" placeholder="与本时代事件兼容的即时目标">${esc(c.want)}</textarea></label><label>惯常解释与盲点<textarea id="cuMind" placeholder="怎样解释、怎样误判、怎样修正">${esc(c.mentalEngine)}</textarea></label><label>压力反应<textarea id="cuPressure" placeholder="紧迫时先注意什么、如何恢复">${esc(c.pressureResponse)}</textarea></label><label>说话习惯<textarea id="cuVoice" placeholder="不复制正典角色台词">${esc(c.dialogueSignature)}</textarea></label><label>真实风险与代价<textarea id="cuRisk" placeholder="只能取自时代危机和身份限制">${esc(c.risk)}</textarea></label>`;
}
function readCustom() {
  const get = (id) => $(id)?.value.trim() || '';
  if (!$('#cuName')) return state.custom;
  return { name: get('#cuName'), speciesForm: get('#cuSpecies'), social: get('#cuSocial'), knowledge: get('#cuKnowledge'), capability: get('#cuCapability'), appearance: get('#cuAppearance'), want: get('#cuWant'), mentalEngine: get('#cuMind'), pressureResponse: get('#cuPressure'), dialogueSignature: get('#cuVoice'), risk: get('#cuRisk') };
}
function renderCompanions() {
  const selected = card(); const others = state.era.cards.filter((item) => item.id !== selected.id);
  $('#feSocList').innerHTML = others.map((item) => `<button class="feCard ${state.companions.has(item.id) ? 'on' : ''}" data-companion="${esc(item.id)}"><b>${esc(item.name)}</b><i>${state.companions.get(item.id) || '希望争取同行'}</i><span>${esc(item.canonIdentityEvidence?.[0]?.text || '本时代正典人物')}</span></button>`).join('');
  $('#feDoss').innerHTML = `<b>${esc(selected.name)}</b><br><br>已选择 ${state.companions.size} / 5。同行选择只是本局希望同行、求助、追踪或避免的意向，不自动写成旧交、血缘或恋爱。`;
}
function renderOpening() {
  const isPreset = state.route === 'preset'; $('#feSit').style.display = isPreset ? 'none' : 'block'; const help = document.querySelector('#fePanL .feSec[data-s="sit"] .sub'); if (help) help.textContent = isPreset ? '下方是该节点选定的连续原文。不会按角色另写，也不会重述。' : '填写玩家希望发生在本时代正典边界内的眼前场面。内容将交给玩家自己的 API。';
  $('#feSit').placeholder = '只写玩家身份、眼前目标和可见场面；不要新增世界设定。';
  $('#feSum').innerHTML = isPreset ? `<b>${esc(state.era.opening.chapterTitle)}</b><div class="world-opening">${esc(state.era.opening.verbatim)}</div>` : `<b>PLAYER API</b> 自定义开局不会写入仓库，也不会被标记为正典。`;
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
  hideAll(); $('#game').classList.add('show'); $('#gLoc').textContent = gameHeader(); mountPlanet('panel');
  $('#gNarr').innerHTML = `<p class="sys">▚&nbsp;ACTVS&nbsp;I</p>${state.error ? `<p class="world-error">${esc(state.error)}</p>` : ''}${state.history.map((message) => `<p class="${message.role === 'user' ? 'me' : ''}"><span class="world-label">${esc(message.label)}</span>${esc(message.content)}</p>`).join('')}${state.busy ? '<p class="sys">ORACVLVM · 玩家 API 正在生成…</p>' : ''}<div class="gEot">·&nbsp;&nbsp;·&nbsp;&nbsp;EOT&nbsp;&nbsp;·&nbsp;&nbsp;·</div>`;
  if (window.WORLD_MVU_CONTENT) window.WORLD_MVU_CONTENT.render(state);
  $('#gIn').disabled = state.busy; $('#gSend').classList.toggle('off', state.busy); if (window.WORLD_GAME_UI) window.WORLD_GAME_UI.show(); if (window.WORLD_MVU_CONTENT) window.WORLD_MVU_CONTENT.hydrate(); requestAnimationFrame(() => { $('#gNarr').scrollTop = $('#gNarr').scrollHeight; });
  if (window.WORLD_UI?.saveAuto) window.WORLD_UI.saveAuto();
}

function stateAnchors() {
  if (!state.era) return '';
  const playerName = state.player?.mode === 'preset' ? state.player.card?.name : state.player?.custom?.name;
  const companionNames = (state.player?.companions || []).map((entry) => entry.name).filter(Boolean);
  return [
    `【时代：${state.era.id}】`,
    `【时代名：${state.era.name}】`,
    `【路线：${state.route === 'preset' ? '默认正典开局' : '自定义API开局'}】`,
    `【开局节点：${state.era.opening.chapterTitle}】`,
    state.loc && `【所在地点：${state.loc.name}${state.loc.kind ? '（' + state.loc.kind + '）' : ''}】`,
    state.loc && `【地点地志：${[state.loc.region, state.loc.biome, state.loc.elev].filter(Boolean).join('，')}。${state.loc.summary}】`,
    playerName && `【玩家：${playerName}】`,
    ...companionNames.map((name) => `【同伴：${name}】`),
  ].filter(Boolean).join('\n');
}
function retrieveLore(query) {
  const manualMemory = window.WORLD_MVU_CONTENT?.memoryPrompt?.();
  const enabled = state.era.lorebook.filter((entry) => entry.enabled !== false);
  const always = enabled.filter((entry) => entry.constant).map((entry) => entry.content);
  const recentHistory = state.history.filter(({ role }) => role === 'user').slice(-4).map(({ content }) => `玩家: ${content}`).join('\n');
  const primaryScan = `${query}\n${recentHistory}\n${manualMemory || ''}`;
  const secondaryScan = `${primaryScan}\n${stateAnchors()}`;
  const budget = Math.max(3000, Number($('#loreBud')?.value || 9000));
  const alwaysCharacters = always.reduce((sum, content) => sum + content.length, 0);
  const selectedBudget = Math.max(0, budget - alwaysCharacters - String(manualMemory || '').length);
  const result = selectLoreEntries({ entries: enabled, primaryScan, secondaryScan, budget: selectedBudget, maxEntries: 16 });
  const activations = result.chosen.map(({ entry, primaryHits, secondaryHits }) => ({ id: entry.id, title: entry.title, primaryHits, secondaryHits }));
  state.lastLoreActivation = { anchors: stateAnchors(), activations, usedCharacters: alwaysCharacters + result.usedCharacters + String(manualMemory || '').length, candidateCount: result.candidateCount, scannedEntryCount: enabled.length - always.length };
  return [manualMemory, ...always, result.chosen.map((item) => item.packet).join('\n\n')].filter(Boolean).join('\n\n');
}
function runtimeTexts(items, limit) { return [...new Set((items || []).map((entry) => String(entry?.text ?? entry ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, limit); }
function compactCard(item) {
  if (!item) return null;
  return {
    name: item.name,
    identityAndSituation: runtimeTexts(item.canonIdentityEvidence, 6),
    decisionPatterns: runtimeTexts(item.thoughtEngine?.sourceDerivedDecisionPatterns ?? item.thoughtEngine?.privateEngineEvidence, 6),
    currentForms: runtimeTexts(item.eraDragonChronology?.formEvidence, 3),
    currentStates: runtimeTexts(item.eraDragonChronology?.stateEvidence, 3),
    knowledgeLimits: runtimeTexts(item.eraDragonChronology?.knowledgeEvidence, 3),
    dialogueSamples: runtimeTexts(item.eraSafeDialogueSamples, 5),
    innerThoughtSamples: runtimeTexts(item.eraSafeInnerThoughtSamples, 3),
    knowledgeBoundary: item.knowledgeBoundary?.rule ?? item.knowledgeBoundary,
    playerAgencyRule: item.playerAgencyRule,
    canonClosureRule: item.canonClosureRule,
  };
}
function buildSystem(query, customOpening) {
  const player = state.player.mode === 'preset' ? { route: 'preset', card: compactCard(state.player.card) } : { route: 'custom', settings: state.player.custom, anchorEvidenceOnly: compactCard(state.player.anchor) };
  const companions = state.player.companions.map((entry) => ({ ...entry, card: compactCard(state.era.cards.find((item) => item.name === entry.name)) }));
  return `你正在运行《无论你是否称呼我为守护龙，我都要去睡觉》的封闭正典角色扮演。\n\n【绝对边界】\n只能使用下面注入的当前时代正典、角色档案与世界书。禁止新增人物、国家、历史、制度、能力、血缘、私交、秘密真相或后世知识。资料不足就让角色不知道。不得把系统正典自动变成角色知识。不得替玩家说话、思考、接受关系、原谅、服从、杀人或作不可逆决定。\n\n【自定义玩家角色的唯一例外】\n自定义路线只允许玩家填写本局身份，不得把它写成正典人物或世界正典，也不得新增家族、国家、机构、种族、能力来源、旧交或其他人物。与当前世界书冲突时必须停下列出可用选项。\n\n【叙事与人物声音】\n使用自然中文，呈现韩国连载网文译文式的连续意识。当前视角依次经历感知、暂时解释、联想或自我辩解、修正判断和行动。对话依据每个角色自己的声口样本与决策方式，保持有限视角，不逐行跳进多个头脑。每次回应保持清楚因果，并在玩家必须回应处停下。\n\n【开局模式】\n${customOpening ? '玩家 API 自定义开局，不得声称生成内容属于正典。' : '默认正典开局已提供，不得重写。'}\n\n【当前时代】\n${state.era.name}。\n\n【玩家】\n${JSON.stringify(player, null, 2)}\n\n【同伴契约】\n${JSON.stringify(companions, null, 2)}\n\n【玩家主权】\n${agency.join('\n')}\n\n【按当前对话触发的世界书】\n${retrieveLore(query)}`;
}
async function generate(text, customOpening = false) { const config = apiSettings(); if (!config.endpoint || !config.model || !config.apiKey) throw new Error('请先填写接口、模型和密钥。'); return requestChatCompletion(config, [{ role: 'system', content: buildSystem(text, customOpening) }, ...state.history.map(({ role, content }) => ({ role, content })), { role: 'user', content: text }]); }
async function sendMessageText(text) { if (!text || state.busy) return; state.error = ''; state.history.push({ role: 'user', content: text, label: '玩家' }); state.busy = true; showGame(); try { state.history.push({ role: 'assistant', content: await generate(text), label: '叙事' }); } catch (error) { state.error = error.message; } finally { state.busy = false; showGame(); } }
async function sendMessage() { const input = $('#gIn'); const text = input.value.trim(); if (!text || state.busy) return; input.value = ''; await sendMessageText(text); }

document.addEventListener('click', (event) => {
  const route = event.target.closest('[data-route]'); if (route) { state.route = route.dataset.route; renderRoute(); return; }
  const site = event.target.closest('[data-site]'); if (site) { planet()?.select(site.dataset.site); return; }
  const persona = event.target.closest('[data-card]'); if (persona) { selectCard(persona.dataset.card); return; }
  const companion = event.target.closest('[data-companion]'); if (companion) { const id = companion.dataset.companion; if (state.companions.has(id)) state.companions.delete(id); else if (state.companions.size < 5) state.companions.set(id, '希望争取同行'); renderCompanions(); return; }
});
$('#miMiss').addEventListener('pointerup', showEras); $('#miOrac').addEventListener('pointerup', () => openSettings());
$('#feGo').addEventListener('pointerup', () => { const index = steps.indexOf(state.step); if (index < steps.length - 1) setStep(steps[index + 1]); else beginGame(); });
$('#feBack').addEventListener('pointerup', () => { const index = steps.indexOf(state.step); if (index > 0) setStep(steps[index - 1], true); else showEras(); });
$('#gtApi').addEventListener('pointerup', () => openSettings()); $('#gSend').addEventListener('pointerup', sendMessage); $('#gIn').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); sendMessage(); } });
$('#dlgApi').addEventListener('pointerup', (event) => { if (event.target === $('#dlgApi')) closeSettings(); });
$('#apiSave').addEventListener('pointerup', () => { const data = { endpoint: $('#apiBase').value.trim(), model: $('#apiModel').value.trim(), apiKey: $('#apiKey').value.trim(), temperature: .8, maxTokens: 1600 }; if (!data.endpoint || !data.model) { $('#apiMsg').textContent = '接口地址和模型需要填写。'; return; } localStorage.setItem('guardianDragonApi', JSON.stringify(data)); closeSettings(); });
$('#apiClear').addEventListener('pointerup', () => { localStorage.removeItem('guardianDragonApi'); $('#apiBase').value = ''; $('#apiModel').value = ''; $('#apiKey').value = ''; $('#apiMsg').textContent = '已清除本机接口配置。'; });
$('#apiEye').addEventListener('pointerup', () => { $('#apiKey').type = $('#apiKey').type === 'password' ? 'text' : 'password'; });
addEventListener('keydown', (event) => { if (event.key === 'Escape') { if ($('#dlgApi').style.display === 'flex') closeSettings(); else if ($('#game').classList.contains('show')) showMenu(); else if ($('#feWrap').classList.contains('on')) { const index = steps.indexOf(state.step); if (index > 0) setStep(steps[index - 1], true); else showEras(); } } });

async function init() {
  try {
    const [a, b, c, d] = await Promise.all([fetch(`${DATA_ROOT}index.json`), fetch(`${DATA_ROOT}customization.json`), fetch(`${DATA_ROOT}timeline-arcs.json`), fetch(`${DATA_ROOT}era-intros.json`)]); if (!a.ok || !b.ok || !c.ok || !d.ok) throw new Error('正典资料索引读取失败。');
    state.index = await a.json(); state.customization = await b.json(); const timeline = await c.json(); state.intros = await d.json();
    const arcById = new Map(timeline.eras.map((era) => [era.id, era.arcTitles])); state.index.eras.forEach((era) => { era.arcTitles = arcById.get(era.id) || []; });
    const introById = new Map(state.intros.entries.map((entry) => [entry.id, entry])); state.index.eras.forEach((era) => { const intro = introById.get(era.id); era.recap = intro?.recap || ''; era.synopsis = intro?.synopsis || ''; });
    window.WORLD_ANNALS = annalsRows();
    window.WORLD_UI = {
      enterEra(row) { state.eraIndex = Math.max(0, Number(row.i) - 1); chooseEra(); },
      showMenu,
      snapshot() { return { version: 1, eraIndex: state.eraIndex, route: state.route, loc: state.loc, cardId: state.cardId, companions: [...state.companions], custom: state.custom, player: state.player, history: state.history, mvu: window.WORLD_MVU_CONTENT?.snapshot?.(), savedAt: new Date().toISOString() }; },
      saveAuto() { if (state.player) { localStorage.setItem('guardianDragonAutoSave', JSON.stringify(this.snapshot())); $('#miCont').style.display = ''; } },
      async restore(snapshot) { const meta = state.index.eras[snapshot.eraIndex]; if (!meta) throw new Error('存档时代不存在。'); const response = await fetch(`${DATA_ROOT}${meta.bundle}`); if (!response.ok) throw new Error('存档时代资料读取失败。'); state.eraIndex = snapshot.eraIndex; state.era = await response.json(); state.era.image = meta.image; state.route = snapshot.route || 'preset'; state.loc = snapshot.loc || null; state.cardId = snapshot.cardId; state.companions = new Map(snapshot.companions || []); state.custom = snapshot.custom || {}; state.player = snapshot.player; state.history = snapshot.history || []; state.error = ''; if (snapshot.mvu&&window.WORLD_MVU_CONTENT) window.WORLD_MVU_CONTENT.restore(snapshot.mvu); showGame(); },
      async loadAuto() { const raw = localStorage.getItem('guardianDragonAutoSave'); if (raw) await this.restore(JSON.parse(raw)); },
      lore() { return state.era?.lorebook || []; },
      loreDebug(query = '') { const packet = state.era && state.player ? retrieveLore(query) : ''; return { packet, ...(state.lastLoreActivation || {}), sourceArchiveScanned: false }; },
      undo() { if (state.busy || !state.history.length) return; const assistant = state.history.pop(); const user = state.history.at(-1)?.role === 'user' ? state.history.pop() : null; state.lastUndone = { assistant, user }; showGame(); },
      async redo() { if (state.busy || !state.lastUndone?.user) return; const text = state.lastUndone.user.content; state.lastUndone = null; await sendMessageText(text); },
    };
    window.WORLD_UI_STATE = () => state;
    window.__FELVN_STATE__ = () => ({ panel: { npcs: (state.player?.companions || []).map((item) => ({ name: item.name, role: item.relation })), world: { '纪年': state.era?.name || '', '时地': state.loc ? `${state.era?.name || ''} · ${state.loc.name}` : (state.era?.name || '') } }, op: { era: state.era?.name || '', scene: state.era?.name || '', year: state.era?.ordinal || 1 }, text: state.history.at(-1)?.content || '', hero: state.player?.mode === 'preset' ? state.player?.card?.name : state.player?.custom?.name });
    if (localStorage.getItem('guardianDragonAutoSave')) $('#miCont').style.display = '';
    showMenu();
  }
  catch (error) { $('#menu .mFoot').textContent = error.message; }
}
init();
