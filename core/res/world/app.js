import { requestChatCompletion } from './runtime.mjs';

const DATA_ROOT = '/core/res/data/world/';
const app = document.querySelector('#app');
const sourceState = document.querySelector('#sourceState');
const settingsDialog = document.querySelector('#settingsDialog');
const settingsForm = document.querySelector('#settingsForm');
const settingsError = document.querySelector('#settingsError');

const state = {
  index: null,
  customization: null,
  era: null,
  route: null,
  cardId: null,
  companions: new Map(),
  history: [],
  phase: 'loading',
  busy: false,
  error: '',
};

const agencyDefaults = [
  '不得替玩家角色说话或描写玩家未输入的内心决定',
  '告白、服从、原谅与关系升级必须由玩家明确选择',
  '杀人、牺牲与不可逆身体变化必须由玩家明确选择',
  '不得让 NPC 自动读心；非当前视角的心声通过行为泄露',
  '不得补写原文没有的人物、国家、历史、能力与隐藏真相',
];

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function apiSettings() {
  try {
    return JSON.parse(localStorage.getItem('guardianDragonApi') || '{}');
  } catch {
    return {};
  }
}

function showLoading(label = '正在整理这一时代的原文证据…') {
  app.innerHTML = `<section class="loading"><span class="spinner"></span><p>${esc(label)}</p></section>`;
}

function eraById(id) {
  return state.index.eras.find((era) => era.id === id);
}

function cardById(id) {
  return state.era?.cards.find((card) => card.id === id) || null;
}

function formatRange(range) {
  return `第 ${range[0]}–${range[1]} 源章`;
}

function renderEras() {
  state.phase = 'eras';
  state.era = null;
  state.route = null;
  state.history = [];
  const totalPresets = state.index.eras.reduce((sum, era) => sum + era.presetCount, 0);
  app.innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">A CLOSED CANON ACROSS AGES</p>
        <h1>从创世，到重新养育厄瑞玻斯。</h1>
      </div>
      <div class="hero-copy">
        <p>先选择一个时代。默认开局直接取自原文章节；自定义开局只会交给玩家自己的 API，并接受该时代正典许可表检查。</p>
        <div class="stat-row"><span class="stat">${state.index.eraCount} 个时代</span><span class="stat">${totalPresets} 个正典预设</span><span class="stat">全书顺序校验完成</span></div>
      </div>
    </section>
    <section class="era-grid">
      ${state.index.eras.map((era) => `
        <button class="era-card" type="button" data-action="choose-era" data-era="${esc(era.id)}">
          <img class="era-card-art" src="${esc(era.image)}" alt="${esc(era.name)}时代插画" loading="lazy">
          <span class="era-card-shade" aria-hidden="true"></span>
          <span class="era-card-copy">
          <span class="era-num">ERA ${String(era.ordinal).padStart(2, '0')}</span>
          <h2>${esc(era.name)}</h2>
          <div class="era-meta">${formatRange(era.sourceRange)}<br>${era.presetCount} 个预设 · ${era.secondaryCharacterCount} 个次要人物记录</div>
          </span>
        </button>`).join('')}
    </section>`;
}

async function chooseEra(id) {
  showLoading();
  const meta = eraById(id);
  try {
    const response = await fetch(`${DATA_ROOT}${meta.bundle}`);
    if (!response.ok) throw new Error(`时代资料读取失败（${response.status}）`);
    state.era = await response.json();
    state.era.image = meta.image;
    state.cardId = state.era.cards.find((card) => card.isMainDragon)?.id || state.era.cards[0].id;
    state.companions = new Map();
    state.route = null;
    renderRoute();
  } catch (error) {
    app.innerHTML = `<section class="error-box">${esc(error.message)}</section>`;
  }
}

function eraHeader(backAction = 'home') {
  return `<div class="crumb"><button class="ghost" type="button" data-action="${backAction}">← 返回</button><span>ERA ${String(state.era.ordinal).padStart(2, '0')}</span><span>·</span><span>${esc(state.era.name)}</span></div>`;
}

function renderRoute() {
  state.phase = 'route';
  app.innerHTML = `
    ${eraHeader('home')}
    <figure class="era-banner"><img src="${esc(state.era.image)}" alt="${esc(state.era.name)}时代插画"><figcaption>ERA ${String(state.era.ordinal).padStart(2, '0')} · ${esc(state.era.name)}</figcaption></figure>
    <section class="section-head">
      <div><p class="eyebrow">ENTRY ROUTE</p><h1>${esc(state.era.name)}</h1></div>
      <div class="evidence-strip"><span>${formatRange(state.era.sourceRange)}</span><span>${state.era.cards.length} 个可选角色</span><span>主角龙本期形态已锁定</span></div>
    </section>
    <section class="route-grid">
      <button class="route-card" type="button" data-action="select-route" data-route="preset">
        <span class="route-tag">VERBATIM · DEFAULT</span><h2>默认正典开局</h2>
        <p>选择原文角色后，直接展示《${esc(state.era.opening.chapterTitle)}》${esc(state.era.opening.startParagraph)}–${esc(state.era.opening.endParagraph)}。这段文字没有拼接或改写。</p>
        <div class="evidence-strip"><span>${state.era.opening.paragraphCount} 段原文</span><span>无需 API 即可查看</span></div>
      </button>
      <button class="route-card" type="button" data-action="select-route" data-route="custom">
        <span class="route-tag">PLAYER API · CUSTOM</span><h2>自定义 API 开局</h2>
        <p>玩家选择正典锚点、知识边界、思考方式、关系位置和同伴意向，再由自己的 API 生成。仓库中没有预写的自定义开局。</p>
        <div class="evidence-strip"><span>不创造既有私交</span><span>不跨时代</span><span>不代替玩家决定</span></div>
      </button>
    </section>`;
}

function renderPresetSetup() {
  state.phase = 'preset';
  const selected = cardById(state.cardId);
  app.innerHTML = `
    ${eraHeader('back-route')}
    <section class="section-head"><div><p class="eyebrow">CANON PRESET</p><h1>选择正典角色</h1></div><p class="muted">每张卡只使用本时代结束前的证据。后世对白不会提前泄露。</p></section>
    <section class="workspace">
      <div class="panel"><h2>本时代预设</h2><div class="preset-list">
        ${state.era.cards.map((card) => presetButton(card, selected?.id === card.id)).join('')}
      </div></div>
      <div class="panel detail">${renderCardDetail(selected)}</div>
    </section>`;
}

function presetButton(card, selected) {
  return `<button class="preset-card ${selected ? 'selected' : ''}" type="button" data-action="choose-card" data-card="${esc(card.id)}">
    <img class="preset-portrait" src="${esc(card.portrait)}" alt="${esc(card.name)}立绘" loading="lazy">
    <span class="preset-copy"><b>${esc(card.name)}${card.isMainDragon ? '<span class="dragon-badge">每时代可选</span>' : ''}</b>
    <span class="mini">${card.eraSafeDialogueSamples.length} 条本期对白 · ${card.eraSafeInnerThoughtSamples.length} 条直接心声${card.thoughtEngine.noDirectThoughtEvidence ? '<br>原文无可直接归属心声' : ''}</span></span>
  </button>`;
}

function renderCardDetail(card) {
  if (!card) return '<p class="muted">请选择角色。</p>';
  const identity = card.canonIdentityEvidence.slice(0, 5);
  const dragonForms = card.eraDragonChronology?.formEvidence ?? [];
  const decision = card.thoughtEngine.privateEngineEvidence.slice(0, 5);
  const dialogue = card.eraSafeDialogueSamples.slice(0, 6);
  const thought = card.eraSafeInnerThoughtSamples.slice(0, 4);
  return `
    <div class="character-hero"><img class="detail-portrait" src="${esc(card.portrait)}" alt="${esc(card.name)}立绘"><div><p class="eyebrow">${card.isMainDragon ? 'PROTAGONIST DRAGON' : 'PLAYABLE CANON'}</p><h2>${esc(card.name)}</h2>
    <div class="evidence-strip"><span>${esc(card.matchedLedgerLabels.join(' · '))}</span><span>知识上限：第 ${card.eraSourceRange[1]} 源章</span></div>
    </div></div>
    ${card.isMainDragon ? `<div class="subsection"><h3>本时代主角龙形态</h3>${renderChronology(dragonForms)}</div>` : ''}
    <div class="subsection"><h3>身份与行动证据</h3>${renderEvidence(identity)}</div>
    <div class="subsection"><h3>独有思考引擎证据</h3>${renderEvidence(decision)}</div>
    <div class="subsection"><h3>原文对白样本</h3>${dialogue.length ? `<div class="quote-list">${dialogue.map(renderQuote).join('')}</div>` : '<div class="empty-evidence">原文在本时代没有可直接归属于此角色的对白。游戏只能依据行动证据表现，不能伪造正典台词。</div>'}</div>
    <div class="subsection"><h3>原文直接心声</h3>${thought.length ? `<div class="quote-list">${thought.map(renderQuote).join('')}</div>` : `<div class="empty-evidence">${esc(card.thoughtEngine.absenceRule)}</div>`}</div>
    ${renderCompanions(card)}
    ${renderAgency()}
    <div class="opening-card"><div class="opening-source"><span>默认开局 · ${esc(state.era.opening.chapterTitle)}</span><span>${esc(state.era.opening.startParagraph)}–${esc(state.era.opening.endParagraph)}</span></div><div class="opening-text">${esc(state.era.opening.verbatim)}</div></div>
    <div class="setup-actions"><span class="muted">开局指纹 ${esc(state.era.opening.verbatimSha256.slice(0, 16))}…</span><button class="primary" type="button" data-action="start-preset">以此角色进入原文开局</button></div>`;
}

function renderChronology(items) {
  if (!items.length) return '<div class="empty-evidence">本时代没有新增形态说明，只能沿用原文最近一次已确认形态。</div>';
  return `<div class="chronology">${items.map((item) => `<div class="chronology-item"><b>第 ${item.sourceIndex} 源章</b><span>${esc(item.text)}</span></div>`).join('')}</div>`;
}

function renderEvidence(items) {
  if (!items.length) return '<div class="empty-evidence">证据不足，保持未知。</div>';
  return `<div class="quote-list">${items.map((item) => `<div class="quote">${esc(item.text)}<small>第 ${item.sourceIndex} 源章 ${esc(item.paragraph || '')}</small></div>`).join('')}</div>`;
}

function renderQuote(item) {
  return `<div class="quote">${esc(item.text)}<small>第 ${item.sourceIndex} 源章 ${esc(item.paragraph || '')}</small></div>`;
}

function renderCompanions(selectedCard) {
  const choices = state.era.cards.filter((card) => card.id !== selectedCard.id);
  return `<div class="subsection"><h3>同伴关系契约</h3><p class="muted">选择的是本局希望同行或接触的人，不会自动生成旧交、血缘或恋爱。</p><div class="companion-grid">${choices.map((card) => companionButton(card)).join('')}</div>${state.companions.size ? `<div class="quote-list">${[...state.companions].map(([id, relation]) => `<label>${esc(cardById(id)?.name)}<select data-companion-relation="${esc(id)}">${['原文已同行', '开局现场可接触', '希望争取同行', '任务上必须接触', '主动保持距离'].map((option) => `<option ${option === relation ? 'selected' : ''}>${option}</option>`).join('')}</select></label>`).join('')}</div>` : ''}</div>`;
}

function companionButton(card) {
  return `<button class="companion-card ${state.companions.has(card.id) ? 'on' : ''}" type="button" data-action="toggle-companion" data-card="${esc(card.id)}"><img src="${esc(card.portrait)}" alt="${esc(card.name)}立绘" loading="lazy"><span>${esc(card.name)}</span></button>`;
}

function renderAgency() {
  return `<div class="subsection"><h3>玩家主权边界</h3><div class="check-grid">${agencyDefaults.map((rule, index) => `<label class="check"><input type="checkbox" name="agency" value="${index}" checked><span>${esc(rule)}</span></label>`).join('')}</div></div>`;
}

function renderCustomSetup() {
  state.phase = 'custom';
  const anchors = state.era.cards;
  app.innerHTML = `
    ${eraHeader('back-route')}
    <section class="section-head"><div><p class="eyebrow">CUSTOM · PLAYER API</p><h1>在正典边界内自定义</h1></div><p class="muted">身份锚点提供时代许可，不会把你变成该正典角色。</p></section>
    <form class="panel custom-form" id="customForm">
      <div class="rule-box">先选一个本时代人物作为“存在条件锚点”。自定义角色可以有自己的姓名和不改变设定的外观，但不能继承锚点的特殊血缘、专属神器、私交、神格或剧情功绩。</div>
      <div class="subsection custom-anchor"><h3>存在条件锚点</h3><input type="hidden" name="anchor" value="${esc(state.cardId)}"><div class="anchor-grid">${anchors.map((card) => `<button class="anchor-card ${card.id === state.cardId ? 'selected' : ''}" type="button" data-action="choose-anchor" data-card="${esc(card.id)}"><img src="${esc(card.portrait)}" alt="${esc(card.name)}立绘" loading="lazy"><span>${esc(card.name)}${card.isMainDragon ? '<small>主角龙本期形态</small>' : ''}</span></button>`).join('')}</div></div>
      <div class="form-grid">
        <label>玩家自定姓名<input name="name" required maxlength="40" placeholder="只改变个人称呼，不新增家族史"></label>
        <label>物种与身体形态<input name="speciesForm" required maxlength="160" placeholder="填写希望使用的物种与形态；API 会先按本时代原文核对"></label>
        <label>身份公开方式<select name="identityVisibility"><option>全部按公开普通身份处理，不设置秘密</option><option>只隐藏玩家自己填写的姓名与来意</option><option>若原文证据许可伪装机制，则由 API 先列出可选项</option></select></label>
        <label>社会位置<select name="social"><option>与锚点同一公开群体的普通成员</option><option>开局现场的陌生旁观者</option><option>原文机构中的无特殊职级成员</option><option>没有既有归属的旅行者</option></select></label>
        <label>社会位置细节<input name="socialDetail" required maxlength="180" placeholder="填写聚落、神殿、队伍、机构或现场位置；API 按时代证据核对"></label>
        <label>知识范围<select name="knowledge"><option>只知道本时代公共知识</option><option>不超过锚点角色已知范围</option><option>比锚点知道得更少</option><option>对隐藏真相一无所知</option></select></label>
        <label>能力范围<select name="capability"><option>普通人范围，不继承锚点特殊能力</option><option>同类常见能力，并承担全部原文限制</option><option>没有战斗能力</option><option>由 API 选择证据最充分的最低能力</option></select></label>
        <label>能力限制与代价<textarea name="capabilityLimits" required placeholder="能力、代价、触发条件和上限必须成组填写；证据不足时由 API 降到最低能力"></textarea></label>
        <label>与正典人物的起始位置<select name="relationship"><option>从未私下相识</option><option>只知道其公共身份</option><option>希望在开局后争取接触</option><option>主动避免接触</option></select></label>
      </div>
      <label>不改变种族规则的外观细节<textarea name="appearance" placeholder="只写原文未限定的颜色、发型、衣着偏好等；不要新增器官、血统或能力"></textarea></label>
      <label>眼前目标<textarea name="want" required placeholder="写一个与本时代事件兼容、可以立即采取行动的目标"></textarea></label>
      <div class="form-grid">
        <label>惯常解释方式<textarea name="explanation" required placeholder="角色通常怎样解释眼前发生的事"></textarea></label>
        <label>不愿承认的盲点<textarea name="blindspot" required placeholder="只影响个人判断，不能变成隐藏正典"></textarea></label>
        <label>认错或修正方式<textarea name="repair" required placeholder="被证据推翻时怎样改口、退让或继续否认"></textarea></label>
        <label>压力下的反应<textarea name="pressureResponse" required placeholder="紧迫时先注意什么、会犯什么判断错误、如何恢复"></textarea></label>
        <label>说话的独有习惯<textarea name="dialogue" required placeholder="开口方式、注意点、停顿、打断与收尾；不要复制正典角色台词"></textarea></label>
      </div>
      <label>真实风险与代价<textarea name="risk" required placeholder="从时代危机和自身身份限制中选择，不新增灾难"></textarea></label>
      ${renderCustomCompanions()}
      ${renderAgency()}
      <div class="setup-actions"><span class="muted">自定义开局不会写入仓库。</span><button class="primary" type="submit">交给我的 API 生成开局</button></div>
    </form>`;
}

function renderCustomCompanions() {
  return `<div class="subsection"><h3>希望接触的同伴</h3><p class="muted">这是未来意向，不是已经成立的关系。</p><div class="companion-grid">${state.era.cards.map((card) => companionButton(card)).join('')}</div></div>`;
}

function selectedAgency(form) {
  return [...form.querySelectorAll('input[name="agency"]:checked')].map((input) => agencyDefaults[Number(input.value)]);
}

function startPreset() {
  const card = cardById(state.cardId);
  const agency = selectedAgency(app);
  state.player = { mode: 'preset', card, agency, companions: companionPacket() };
  state.history = [{ role: 'assistant', content: state.era.opening.verbatim, label: '原文默认开局' }];
  renderGame();
}

async function startCustom(form) {
  const config = apiSettings();
  if (!config.endpoint || !config.model || !config.apiKey) {
    openSettings('自定义开局需要先填写接口地址、模型和密钥。');
    return;
  }
  const data = Object.fromEntries(new FormData(form).entries());
  const anchor = cardById(data.anchor);
  state.player = { mode: 'custom', anchor, custom: data, agency: selectedAgency(form), companions: companionPacket() };
  state.history = [];
  state.phase = 'game';
  state.busy = true;
  renderGame();
  try {
    const prompt = `请先逐项核对自定义玩家设定是否能被当前时代原文证据许可。玩家设定如下：\n${JSON.stringify(data, null, 2)}\n\n若物种、身体、社会位置、能力、知识或关系中任一项没有时代证据支持，不得偷偷修改或编造开局；应停下，指出冲突字段，并只列出原文证据能够支持的替代选项。全部通过后才生成开局，在第一个需要玩家回应或行动的时刻停下。不得替玩家说话，也不得把愿望写成已经完成。`;
    const content = await generate(prompt, true);
    state.history.push({ role: 'assistant', content, label: '玩家 API 自定义开局' });
  } catch (error) {
    state.error = error.message;
  } finally {
    state.busy = false;
    renderGame();
  }
}

function companionPacket() {
  return [...state.companions].map(([id, relation]) => ({ name: cardById(id)?.name, relation }));
}

function renderGame() {
  state.phase = 'game';
  const playerName = state.player?.mode === 'preset' ? state.player.card.name : state.player?.custom?.name;
  app.innerHTML = `<section class="game">
    ${eraHeader(state.player?.mode === 'preset' ? 'back-preset' : 'back-custom')}
    <div class="game-head"><div class="game-identity">${state.player?.mode === 'preset' ? `<img class="game-portrait" src="${esc(state.player.card.portrait)}" alt="${esc(playerName)}立绘">` : ''}<div><p class="eyebrow">${state.player?.mode === 'preset' ? 'CANON OPENING' : 'CUSTOM API OPENING'}</p><h2>${esc(playerName || '')}</h2></div></div><span class="badge">${esc(state.era.name)}</span></div>
    ${state.error ? `<div class="error-box">${esc(state.error)}</div>` : ''}
    <div class="messages">${state.history.map((message) => `<article class="message ${message.role}"><span class="message-label">${esc(message.label || (message.role === 'user' ? '玩家' : '叙事'))}</span>${esc(message.content)}</article>`).join('')}${state.busy ? '<section class="message assistant"><span class="spinner"></span> 玩家 API 正在生成…</section>' : ''}</div>
    <form class="composer" id="composer"><textarea name="message" required placeholder="写下你的行动或对白。游戏不会替你决定。" ${state.busy ? 'disabled' : ''}></textarea><button class="primary" ${state.busy ? 'disabled' : ''}>继续</button></form>
  </section>`;
  requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
}

function queryTerms(text) {
  const cleaned = String(text).replace(/[\s\p{P}\p{S}]+/gu, '');
  const terms = new Set();
  for (let index = 0; index < cleaned.length - 1; index += 1) terms.add(cleaned.slice(index, index + 2));
  return [...terms];
}

function retrieveLore(query) {
  const always = state.era.lorebook.filter((entry) => entry.constant).map((entry) => entry.content);
  const conditional = state.era.lorebook.filter((entry) => !entry.constant);
  const terms = queryTerms(query);
  const lines = conditional.flatMap((entry) => entry.content.split('\n').map((line) => ({ line, entry })));
  const scored = lines.map(({ line, entry }) => {
    const keyHit = entry.keys.some((key) => query.includes(key));
    const overlap = terms.reduce((score, term) => score + (line.includes(term) ? 1 : 0), 0);
    return { line, score: overlap + (keyHit ? 8 : 0) };
  }).filter((item) => item.line.trim()).sort((a, b) => b.score - a.score);
  const chosen = [];
  const seen = new Set();
  for (const item of scored) {
    if (chosen.length >= 90) break;
    if (item.score <= 0 && chosen.length >= 28) break;
    if (!seen.has(item.line)) { seen.add(item.line); chosen.push(item.line); }
  }
  return [...always, chosen.join('\n')].filter(Boolean).join('\n\n');
}

function compactCard(card) {
  if (!card) return null;
  return {
    name: card.name,
    identityEvidence: card.canonIdentityEvidence,
    eraDragonChronology: card.eraDragonChronology,
    thoughtEngine: card.thoughtEngine,
    dialogueSamples: card.cumulativeVoiceArchiveThroughEraEnd.dialogue,
    innerThoughtSamples: card.cumulativeVoiceArchiveThroughEraEnd.innerThought,
    knowledgeBoundary: card.knowledgeBoundary,
    playerAgencyRule: card.playerAgencyRule,
    canonClosureRule: card.canonClosureRule,
  };
}

function buildSystem(query, customOpening) {
  const player = state.player.mode === 'preset'
    ? { route: 'preset', card: compactCard(state.player.card) }
    : { route: 'custom', settings: state.player.custom, anchorEvidenceOnly: compactCard(state.player.anchor) };
  const companions = state.player.companions.map((companion) => ({
    ...companion,
    card: compactCard(state.era.cards.find((card) => card.name === companion.name)),
  }));
  return `你正在运行《无论你是否称呼我为守护龙，我都要去睡觉》的封闭正典角色扮演。

【绝对边界】
只能使用下面提供的原文证据。禁止新增人物、国家、历史、制度、能力、血缘、私交、秘密真相或后世知识。证据不足就让角色不知道。不得把系统正典自动变成角色知识。不得替玩家说话、思考、接受关系、原谅、服从、杀人或作不可逆决定。

【自定义玩家角色的唯一例外】
自定义路线允许玩家自己填写一个非正典玩家角色；这只是玩家在本局中的身份，不得被写成原文人物、历史名人或世界正典，也不得由此新增家族、国家、机构、种族、能力来源、旧交或其他人物。先验证其物种、身体、社会位置、知识、能力与关系是否有本时代证据许可；冲突时必须停下列出来源内可选项，不能擅自改设定后继续。

【叙事与人物声音】
使用自然中文，呈现韩国连载网文译文式的连续意识。当前视角依次经历感知、暂时解释、联想或自我辩解、修正判断和行动。对话必须依据每个角色自己的原文样本与决策证据；不要给所有人同一种冷静成熟口吻。保持有限视角，不逐行跳进多个头脑。重要 NPC 有私有欲望与误解，但非视角人物的内心通过措辞、停顿、行为和选择泄露。每次回应保持清楚因果，并在玩家必须回应处停下。

【开局模式】
${customOpening ? '这是玩家 API 自定义开局。不得复制默认开局，也不得声称自定义内容属于原文；只在已有时代与人物边界内建立当前场面。' : '默认开局已由原文逐字提供。继续时承认已经发生的原文开局，不得重写或纠正它。'}

【当前时代】
${state.era.name}，原文范围第${state.era.sourceRange[0]}至第${state.era.sourceRange[1]}源章。

【玩家角色与选择】
${JSON.stringify(player, null, 2)}

【同伴关系契约】
${JSON.stringify(companions, null, 2)}

【玩家主权边界】
${state.player.agency.join('\n')}

【按当前请求检索到的世界书】
${retrieveLore(`${query}\n${JSON.stringify(player)}\n${JSON.stringify(companions)}`)}`;
}

async function generate(userText, customOpening = false) {
  const config = apiSettings();
  if (!config.endpoint || !config.model || !config.apiKey) throw new Error('请先在 API 设置中填写接口、模型和密钥。');
  const prior = state.history.map(({ role, content }) => ({ role, content }));
  const messages = [{ role: 'system', content: buildSystem(userText, customOpening) }, ...prior, { role: 'user', content: userText }];
  return requestChatCompletion(config, messages);
}

async function sendMessage(form) {
  const input = form.elements.message;
  const text = input.value.trim();
  if (!text || state.busy) return;
  state.error = '';
  state.history.push({ role: 'user', content: text, label: '玩家' });
  state.busy = true;
  renderGame();
  try {
    const content = await generate(text, false);
    state.history.push({ role: 'assistant', content, label: '叙事' });
  } catch (error) {
    state.error = error.message;
  } finally {
    state.busy = false;
    renderGame();
  }
}

function openSettings(error = '') {
  const config = apiSettings();
  settingsForm.elements.endpoint.value = config.endpoint || '';
  settingsForm.elements.model.value = config.model || '';
  settingsForm.elements.apiKey.value = config.apiKey || '';
  settingsForm.elements.temperature.value = config.temperature ?? .8;
  settingsForm.elements.maxTokens.value = config.maxTokens ?? 1600;
  settingsError.textContent = error;
  settingsDialog.showModal();
}

function saveSettings() {
  const data = Object.fromEntries(new FormData(settingsForm).entries());
  if (!data.endpoint || !data.model || !data.apiKey) {
    settingsError.textContent = '接口地址、模型和密钥都需要填写。';
    return false;
  }
  localStorage.setItem('guardianDragonApi', JSON.stringify(data));
  settingsError.textContent = '';
  settingsDialog.close();
  return true;
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'home') renderEras();
  if (action === 'settings') openSettings();
  if (action === 'save-settings') { event.preventDefault(); saveSettings(); }
  if (action === 'choose-era') chooseEra(target.dataset.era);
  if (action === 'back-route') renderRoute();
  if (action === 'select-route') {
    state.route = target.dataset.route;
    state.companions = new Map();
    if (state.route === 'preset') renderPresetSetup(); else renderCustomSetup();
  }
  if (action === 'choose-card') { state.cardId = target.dataset.card; renderPresetSetup(); }
  if (action === 'choose-anchor') {
    event.preventDefault();
    state.cardId = target.dataset.card;
    app.querySelectorAll('.anchor-card').forEach((button) => button.classList.toggle('selected', button.dataset.card === state.cardId));
    const anchorInput = app.querySelector('input[name="anchor"]');
    if (anchorInput) anchorInput.value = state.cardId;
  }
  if (action === 'toggle-companion') {
    event.preventDefault();
    const id = target.dataset.card;
    if (state.companions.has(id)) state.companions.delete(id);
    else if (state.companions.size < 4) state.companions.set(id, '希望争取同行');
    if (state.route === 'preset') renderPresetSetup();
    else target.classList.toggle('on', state.companions.has(id));
  }
  if (action === 'start-preset') startPreset();
  if (action === 'back-preset') renderPresetSetup();
  if (action === 'back-custom') renderCustomSetup();
});

document.addEventListener('change', (event) => {
  const id = event.target.dataset.companionRelation;
  if (id && state.companions.has(id)) state.companions.set(id, event.target.value);
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'customForm') { event.preventDefault(); startCustom(event.target); }
  if (event.target.id === 'composer') { event.preventDefault(); sendMessage(event.target); }
});

async function init() {
  showLoading('正在载入全书时代索引…');
  try {
    const [indexResponse, customizationResponse] = await Promise.all([
      fetch(`${DATA_ROOT}index.json`),
      fetch(`${DATA_ROOT}customization.json`),
    ]);
    if (!indexResponse.ok || !customizationResponse.ok) throw new Error('正典资料索引读取失败。');
    state.index = await indexResponse.json();
    state.customization = await customizationResponse.json();
    sourceState.textContent = `${state.index.sourceCoverage.storyChapters} 章原文 · ${state.index.eraCount} 个时代 · 已校验`;
    renderEras();
  } catch (error) {
    app.innerHTML = `<section class="error-box">${esc(error.message)}</section>`;
    sourceState.textContent = '资料未载入';
  }
}

init();
