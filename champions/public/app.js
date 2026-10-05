'use strict';
/* 히어로 챔피언스 — 클라이언트 */

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const app = {
  ws: null, token: null, catalog: null, room: null, you: null, state: null, prompt: null,
  sel: [], lastLog: 0, lastEv: 0, tab: 'log', lastChat: 0, wasMyTurn: false, tipOwner: null, prevHp: {},
  seen: { hand: new Set(), minion: new Set(), play: new Set() },
};
window.app = app;

const TYPE_NAME = { ally: '아군', event: '이벤트', upgrade: '강화', support: '지원', resource: '자원' };
const ENC_TYPE = { minion: '미니언', treachery: '배신', side: '부가 계략', attachment: '부착' };
const CARD_ART = {
  energy_cell: '🔋', genius: '💡', strength: '💪', briefing: '📋', citizen: '🙋', first_aid: '🩹',
  flash_strike: '⚡', chain_lightning: '🌩', charge_gloves: '🧤', static_wall: '🔆', roommate: '🧑‍🎓', lab_gear: '🔬',
  rocket_boots: '🚀', repulsor: '🔫', armor_plate: '🛡', drone_buddy: '🛸', overload: '💥', workshop: '🔧',
  quake_smash: '🌋', bare_block: '✋', stone_skin: '🪨', law_partner: '👨‍💼', rage_burst: '😤', gym: '🏋',
  photon_beam: '🔦', cosmic_flight: '🌠', absorb: '✨', star_armor: '🌟', wingmate: '👩‍✈️', orbital: '🛰',
  shadow_strike: '🗡', smoke_bomb: '💨', shuriken: '✴', informant: '🕵', infiltrate: '🥷', dojo: '⛩',
  seal_rune: '🔯', fire_spell: '🔥', portal: '🌀', mystic_cloak: '🧥', apprentice: '🧙', sanctum: '🏯',
  assault: '👊', brutal: '🥊', berserk: '😡', merc: '⚔', charge: '🐂', sweep: '🌪', fighting_spirit: '🔥', training_ground: '🎯', brawler: '🤼', finisher: '💢',
  investigate: '🔍', arrest: '🚔', sense_justice: '⚖', detective: '🕵', stakeout: '🔭', rally_citizens: '📣', evidence: '🗂', lawyers: '👩‍⚖️', smoking_gun: '📁', vigilance: '👀',
  rally: '📯', teamwork: '🤝', veteran: '🎖', rookie: '🧒', command: '📡', rescue_team: '🚑', hq_link: '📞', return_hero: '↩', all_out: '🚩', commander: '👩‍✈️',
  shield_block: '🛡', counter: '↪', iron_will: '🧱', barrier: '🔰', medic: '⛑', bear: '🐻', vest: '🦺', infirmary: '🏥', full_guard: '🏰', reflex: '⚡',
};
const ENC_ART = {
  thug: '🦹', guard: '💂', hacker: '💻', ambush: '⚠', dark_plot: '🕸', reinforce: '📢', hostages: '🧑‍🤝‍🧑', bomb: '💣', gear_up: '🔩', exhaust_trick: '🪤',
  brute_goon: '🐗', brute_charge: '🐃', brute_armor: '🦏', collapse: '🏚', stampede: '🌪',
  sonic_beast: '🦇', noise_soldier: '📢', eardrum: '🔊', sonic_storm: '🌀', amplifier: '📡', resonance: '🎛',
  drone: '🛸', war_bot: '🤖', drone_factory: '🏭', produce: '⚙', hack: '🖥', nano: '🧬',
};

function encArt(id) { return ENC_ART[id] || ((app.catalog && app.catalog.encounter[id]) || {}).icon || ''; }
/** 확장(팩) 고르기 버튼 줄 */
function packTabs(key, items) {
  const packs = app.catalog.packs;
  const used = [...new Set(items.map((x) => x.pack || 'core'))].sort((a, b) => packs[a].order - packs[b].order);
  const cur = app[key] || 'all';
  return `<div class="pack-tabs">${[['all', `전체 (${items.length})`], ...used.map((k) => [k, `${packs[k].name} (${items.filter((x) => (x.pack || 'core') === k).length})`])]
    .map(([k, n]) => `<button class="small pack-tab ${cur === k ? 'on' : ''}" data-pack-key="${key}" data-pack="${k}">${esc(n)}</button>`).join('')}</div>`;
}
function bindPackTabs() {
  for (const b of document.querySelectorAll('[data-pack-key]')) b.onclick = () => { app[b.dataset.packKey] = b.dataset.pack; renderRoom(); };
}
const inPack = (key, x) => !app[key] || app[key] === 'all' || (x.pack || 'core') === app[key];

/** 전체 화면 켜기/끄기 */
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => toast('이 브라우저에서는 전체 화면을 쓸 수 없어요. F11 키를 눌러 보세요.'));
}
document.addEventListener('fullscreenchange', () => { const b = document.querySelector('#topbar .btn-full'); if (b) b.textContent = document.fullscreenElement ? '🗗 창 모드' : '⛶ 전체 화면'; });

// ───────────── 연결 ─────────────
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}`);
  app.ws = ws;
  ws.onopen = () => send({ t: 'hello', token: sessionStorage.getItem('champ-token') || localStorage.getItem('champ-token') });
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onclose = () => { toast('서버와 연결이 끊겼어요. 다시 연결하는 중…'); setTimeout(connect, 1500); };
}
function send(msg) { if (app.ws && app.ws.readyState === 1) app.ws.send(JSON.stringify(msg)); }

function onMessage(msg) {
  switch (msg.t) {
    case 'welcome':
      app.token = msg.token;
      app.catalog = msg.catalog;
      try { sessionStorage.setItem('champ-token', msg.token); localStorage.setItem('champ-token', msg.token); } catch { /* 무시 */ }
      $('#lan').innerHTML = msg.lan.length ? `같은 와이파이 친구 접속 주소: ${msg.lan.map((u) => `<b>${u}</b>`).join(' 또는 ')}` : '';
      app.saves = msg.saves || [];
      renderSaves();
      if (!app.room) show('home');
      break;
    case 'saves':
      app.saves = msg.list || [];
      renderSaves();
      break;
    case 'room':
      app.room = msg.room;
      app.you = msg.you;
      if (!msg.room.started) { app.state = null; app.prompt = null; show('room'); renderRoom(); }
      renderChat();
      break;
    case 'state': {
      const first = !app.state || msg.gameNo !== app.gameNo;
      if (msg.gameNo !== app.gameNo) {
        // 새 판 (바로 다시 하기 포함): 결과 창·효과 표시 상태 초기화
        app.gameNo = msg.gameNo;
        app.hideResult = false;
        app.lastEv = 0;
        app.lastLog = 0;
        app.prevHp = {};
      }
      app.state = msg.state;
      app.prompt = msg.prompt;
      show('game');
      onNewLogs(first);
      renderGame();
      playEvents(first);
      break;
    }
    case 'left':
      app.room = null; app.state = null; app.prompt = null;
      show('home');
      send({ t: 'listSaves' });
      break;
    case 'error':
      toast(msg.msg);
      Sound.play('error');
      break;
    default:
  }
}

function show(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id); }
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 3200);
}
function answer(value) {
  if (!app.prompt) return;
  send({ t: 'answer', promptId: app.prompt.id, value });
  Sound.play('select');
}
function setHTML(el, html) { if (el._html === html) return false; el._html = html; el.innerHTML = html; return true; }
function heroDef(id) { return app.catalog.heroes.find((h) => h.id === id); }
function villainDef(id) { return app.catalog.villains.find((v) => v.id === id); }
function resIcons(c) { return `<span class="res r-${c.res}" title="${app.catalog.resNames[c.res]} 자원 ${c.resN}개">${app.catalog.resIcon[c.res].repeat(c.resN)}</span>`; }
function colorOf(pid) { return app.catalog.colors[app.state.order.indexOf(pid)] || '#ccc'; }

// ───────────── 첫 화면 / 대기실 ─────────────
function myName() { return $('#in-name').value.trim(); }
function initHome() {
  try { $('#in-name').value = localStorage.getItem('champ-name') || ''; } catch { /* 무시 */ }
  const save = () => { try { localStorage.setItem('champ-name', myName()); } catch { /* 무시 */ } };
  $('#btn-create').onclick = () => { save(); send({ t: 'create', name: myName() }); };
  $('#btn-join').onclick = () => { save(); send({ t: 'join', name: myName(), code: $('#in-code').value }); };
  $('#in-code').onkeydown = (e) => { if (e.key === 'Enter') $('#btn-join').click(); };
  for (const b of document.querySelectorAll('.solo')) b.onclick = () => { save(); send({ t: 'solo', name: myName(), bots: Number(b.dataset.bots) }); };
  for (const b of document.querySelectorAll('.btn-guide')) b.onclick = () => Guide.open();
  for (const b of document.querySelectorAll('.btn-sound')) b.onclick = openSound;
  $('#btn-leave').onclick = () => send({ t: 'leave' });
  $('#btn-start').onclick = () => send({ t: 'start' });
  $('#btn-add-bot').onclick = () => send({ t: 'addBot' });
  $('#btn-copy').onclick = () => {
    const text = `히어로 챔피언스 같이 해요! 주소: ${location.origin}  방 코드: ${app.room.code}`;
    navigator.clipboard?.writeText(text).then(() => toast('초대 문구를 복사했어요.'), () => toast(text));
  };
  for (const f of document.querySelectorAll('[data-chat]')) f.onsubmit = (e) => { e.preventDefault(); const i = f.querySelector('input'); if (i.value.trim()) send({ t: 'chat', text: i.value }); i.value = ''; };
  for (const b of document.querySelectorAll('.tabs [data-tab]')) b.onclick = () => { app.tab = b.dataset.tab; renderTabs(); };
  if (!localStorage.getItem('champ-guided')) setTimeout(() => Guide.open(), 400);
}

// ───────────── 저장된 게임 이어하기 ─────────────
function saveTitle(sv) {
  const sm = sv.summary || {};
  const c = app.catalog;
  const v = c.villains.find((x) => x.id === sm.villain);
  const d = c.difficulties.find((x) => x.id === sm.difficulty);
  return `<b>${sm.round || 1}라운드</b>${v ? ` · 😈 ${esc(v.name)}` : ''}${d ? ` · ${esc(d.name)}` : ''}`;
}
function slotDesc(s) {
  const h = app.catalog.heroes.find((x) => x.id === s.hero);
  const a = app.catalog.aspects[s.aspect];
  return h ? `${esc(h.name)}${a ? ` <span class="hint">(${esc(a.name)})</span>` : ''}` : '';
}
function fmtTime(ms) {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function renderSaves() {
  const box = $('#saves-box');
  if (!box) return;
  const list = app.saves || [];
  box.classList.toggle('hidden', !list.length);
  if (!list.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="saves-title">💾 저장된 게임 이어하기</div>${list.map((sv) => `<div class="save-row"><div class="save-info">${saveTitle(sv)}<br><span class="hint">${esc(sv.names.join(', '))} · ${fmtTime(sv.savedAt)} 저장</span></div>
      <button class="primary small" data-resume="${esc(sv.id)}">▶ 이어하기</button><button class="small" data-delsave="${esc(sv.id)}" title="저장 삭제">🗑</button></div>`).join('')}
    <p class="hint">게임 중에 그만두거나 창을 닫아도 자동으로 저장돼요. 친구는 방 코드로 들어와 자기 자리에 앉으면 되고, 빈자리는 AI가 대신해요.</p>`;
  for (const b of box.querySelectorAll('[data-resume]')) b.onclick = () => send({ t: 'resume', id: b.dataset.resume, name: $('#in-name').value });
  for (const b of box.querySelectorAll('[data-delsave]')) b.onclick = () => { if (confirm('이 저장된 게임을 삭제할까요? 되돌릴 수 없어요.')) send({ t: 'deleteSave', id: b.dataset.delsave }); };
}

function renderResumeRoom(r, isHost) {
  const rs = r.resume;
  const sitter = (s) => r.players.find((p) => p.id === s.id);
  $('#room-players').innerHTML = rs.slots.map((s, i) => {
    const p = sitter(s);
    return `<div class="rp" style="--pc:${app.catalog.colors[i]}"><span class="rp-order">${i + 1}</span>
      <span class="rp-name">${s.bot ? `${esc(s.name)} <span class="tag">AI</span>` : p ? `${esc(p.name)}${p.id === app.you ? ' <span class="hint">(나)</span>' : ''}${p.id === r.hostId ? ' 👑' : ''}` : `<span class="hint">${esc(s.name)}의 빈자리 — AI가 대신</span>`}</span>
      <span class="rp-res">${slotDesc(s)}</span></div>`;
  }).join('');
  $('#room-settings').innerHTML = `<div class="resume-box"><div class="resume-head">💾 저장된 게임 이어하기</div>
    <p>${saveTitle(rs)}부터 계속합니다 <span class="hint">(${fmtTime(rs.savedAt)} 저장)</span></p>
    <p class="hint">설정·순서·캐릭터는 저장할 때 그대로예요. 아무도 앉지 않은 자리는 AI가 대신 진행합니다.</p>
    ${isHost ? '<button class="small" id="btn-new-instead">이어하지 않고 새 게임 준비하기</button>' : ''}</div>`;
  const nb = $('#btn-new-instead');
  if (nb) nb.onclick = () => { if (confirm('저장된 게임은 그대로 두고, 이 방에서 새 게임을 준비할까요?')) send({ t: 'cancelResume' }); };
  $('#hero-pick').innerHTML = `<div class="rs-title">🪑 내 자리 고르기 <span class="hint">저장할 때 누가 어느 자리였는지 보고 고르세요.</span></div>
    <div class="slot-list">${rs.slots.filter((s) => !s.bot).map((s) => {
      const mine = s.id === app.you;
      return `<div class="slot-card ${mine ? 'mine' : ''} ${s.taken && !mine ? 'taken' : ''}"><div class="slot-name">${esc(s.name)}의 자리</div><div>${slotDesc(s)}</div>
        ${mine ? '<span class="slot-tag">✔ 내 자리</span>' : s.taken ? '<span class="hint">다른 사람이 앉음</span>' : `<button class="small primary" data-slot="${esc(s.id)}">이 자리에 앉기</button>`}</div>`;
    }).join('')}</div>`;
  for (const b of document.querySelectorAll('[data-slot]')) b.onclick = () => send({ t: 'claimSlot', slot: b.dataset.slot });
  $('#btn-start').disabled = !isHost || r.loading;
  $('#btn-add-bot').disabled = true;
  $('#btn-start').textContent = r.loading ? '불러오는 중…' : isHost ? '▶ 이어서 시작' : '방장이 이어서 시작하기를 기다리는 중…';
}

/** 게임 도중 그만두기 버튼 (방장) */
function quitButtonHTML() {
  if (!app.room || app.state.result || app.room.hostId !== app.you) return '';
  return '<button class="small" id="btn-quit" title="지금까지 진행을 저장하고 대기실로 돌아가기">💾 저장하고 그만하기</button>';
}
function bindQuitButton() {
  const b = $('#btn-quit');
  if (b) b.onclick = () => { if (confirm('게임을 저장하고 대기실로 돌아갈까요?\n\n나중에 첫 화면의 "💾 저장된 게임 이어하기"에서 지금 상태 그대로 계속할 수 있어요.\n(함께하는 친구들도 모두 대기실로 이동합니다)')) send({ t: 'quitGame' }); };
}

function renderRoom() {
  const r = app.room;
  const isHost = r.hostId === app.you;
  if (r.resume) { $('#room-code').textContent = r.code; renderResumeRoom(r, isHost); return; }
  const c = app.catalog;
  $('#room-code').textContent = r.code;
  $('#invite-hint').innerHTML = `친구에게 주소 <b>${esc(location.origin)}</b> 와 방 코드 <b>${r.code}</b>를 알려 주세요. (최대 ${r.maxPlayers}명, AI 동료로 빈자리를 채울 수 있어요)`;
  $('#room-players').innerHTML = r.players.map((p, i) => {
    const h = p.hero && heroDef(p.hero);
    const a = p.aspect && c.aspects[p.aspect];
    return `<div class="rp" style="--pc:${p.color}"><span class="rp-order">${i + 1}</span>
      <span class="rp-name">${esc(p.name)}${p.id === app.you ? ' <span class="hint">(나)</span>' : ''}${p.id === r.hostId ? ' 👑' : ''}${p.bot ? ' <span class="tag">AI</span>' : ''}${!p.connected ? ' <span class="hint">(연결 끊김)</span>' : ''}</span>
      <span class="rp-hero">${h ? `${h.icon} <b>${esc(h.name)}</b>` : '<span class="hint">영웅 미선택 (무작위)</span>'} ${a ? `<span class="asp-chip" style="--ac:${a.color}">${esc(a.name)}</span>` : ''}</span>
      ${isHost ? `<span class="rp-btns"><button class="small" data-move="${p.id}" data-dir="up" ${i ? '' : 'disabled'}>▲</button><button class="small" data-move="${p.id}" data-dir="down" ${i < r.players.length - 1 ? '' : 'disabled'}>▼</button>${p.bot ? `<button class="small" data-rmbot="${p.id}">✕</button>` : ''}</span>` : ''}
    </div>`;
  }).join('');
  for (const b of document.querySelectorAll('[data-move]')) b.onclick = () => send({ t: 'move', id: b.dataset.move, dir: b.dataset.dir });
  for (const b of document.querySelectorAll('[data-rmbot]')) b.onclick = () => send({ t: 'removeBot', id: b.dataset.rmbot });
  // 악당 · 난이도
  const st = r.settings;
  const dis = isHost ? '' : 'disabled';
  $('#room-settings').innerHTML = `<div class="rs-title">😈 악당과 난이도 ${isHost ? '' : '<span class="hint">(방장만 바꿀 수 있어요)</span>'}</div>
    ${packTabs('villainPack', c.villains)}
    <div class="villains">${c.villains.filter((v) => inPack('villainPack', v) || v.id === st.villain).map((v) => `<button class="villain-opt ${st.villain === v.id ? 'on' : ''}" data-villain="${v.id}" ${dis} style="--vc:${v.color}">
      <span class="vo-icon">${v.icon}</span><b>${esc(v.name)}</b><span class="vo-level">${esc(v.level)}</span><span class="pack-chip">${esc(c.packs[v.pack || 'core'].name)}</span><span class="vo-desc">${esc(v.desc)}</span>
      <span class="vo-scheme">계략: ${esc(v.scheme.name)}</span></button>`).join('')}</div>
    <div class="diffs">${c.difficulties.map((d) => `<button class="small diff-opt ${st.difficulty === d.id ? 'on' : ''}" data-diff="${d.id}" ${dis} title="${esc(d.desc)}">${esc(d.name)}</button>`).join('')}</div>
    <div class="hint">${esc((c.difficulties.find((d) => d.id === st.difficulty) || {}).desc || '')}</div>`;
  if (isHost) {
    for (const b of document.querySelectorAll('[data-villain]')) b.onclick = () => send({ t: 'setSettings', settings: { villain: b.dataset.villain } });
    for (const b of document.querySelectorAll('[data-diff]')) b.onclick = () => send({ t: 'setSettings', settings: { difficulty: b.dataset.diff } });
  }
  // 영웅 고르기
  const meP = r.players.find((p) => p.id === app.you);
  const owner = (id) => r.players.find((p) => p.hero === id);
  $('#hero-pick').innerHTML = `<div class="rs-title">🦸 영웅 고르기 <span class="hint">카드를 눌러 내 영웅을, 아래에서 측면(덱 성향)을 고르세요.${isHost && r.players.some((p) => p.bot) ? ' 방장은 AI 동료의 영웅도 정할 수 있어요.' : ''}</span></div>
    ${packTabs('heroPack', c.heroes)}
    <div class="heroes">${c.heroes.filter((h) => inPack('heroPack', h) || (meP && meP.hero === h.id)).map((h) => {
      const o = owner(h.id);
      return `<div class="hero-opt ${o ? 'taken' : ''} ${meP && meP.hero === h.id ? 'mine' : ''}" data-hero="${h.id}" style="--hc:${h.color};${o ? `--pc:${o.color}` : ''}">
        <div class="ho-top"><span class="ho-icon">${h.icon}</span><span><b>${esc(h.name)}</b> <span class="pack-chip">${esc(c.packs[h.pack || 'core'].name)}</span><br><span class="hint">${esc(h.archetype)}</span></span></div>
        <div class="ho-stats"><span title="저지">🛑${h.hero.thw}</span><span title="공격">👊${h.hero.atk}</span><span title="방어">🛡${h.hero.def}</span><span title="체력">❤${h.hp}</span><span title="손패">✋${h.hero.hand}</span></div>
        <div class="ho-ab"><b>✨ ${esc(h.hero.ability.name)}</b>: ${esc(h.hero.ability.text)}</div>
        <div class="ho-alter">일상: <b>${esc(h.alter.name)}</b> (${esc(h.alter.job)}) · 회복 ${h.alter.rec} · ${esc(h.alter.ability.name)}</div>
        <div class="ho-lore hint">${esc(h.lore)}</div>
        ${o ? `<div class="ho-owner">✔ ${esc(o.name)}</div>` : ''}
        ${isHost ? r.players.filter((p) => p.bot).map((b) => `<button class="small ho-bot" data-bot="${b.id}" data-h="${h.id}">${esc(b.name.replace('AI ', ''))}에게</button>`).join('') : ''}
      </div>`;
    }).join('')}</div>
    <div class="rs-title" style="margin-top:10px">🎴 내 측면 (덱 성향) <span class="hint">다시 누르면 취소돼요. 안 고르면 시작할 때 무작위로 정해져요.</span></div>
    <div class="aspects">${Object.values(c.aspects).map((a) => `<button class="asp-opt ${meP && meP.aspect === a.id ? 'on' : ''}" data-aspect="${a.id}" style="--ac:${a.color}"><b>${esc(a.name)}</b> <span class="hint">(${esc(a.en)})</span><br><span class="asp-desc">${esc(a.desc)}</span></button>`).join('')}</div>`;
  for (const el of document.querySelectorAll('.hero-opt')) el.onclick = (e) => { if (e.target.closest('.ho-bot')) return; const id = el.dataset.hero; send({ t: 'pickHero', hero: meP && meP.hero === id ? null : id }); };
  for (const b of document.querySelectorAll('.ho-bot')) b.onclick = () => send({ t: 'pickHero', hero: b.dataset.h, target: b.dataset.bot });
  // 같은 측면을 다시 누르면 선택 취소 (안 고르면 시작할 때 무작위)
  for (const b of document.querySelectorAll('.asp-opt')) b.onclick = () => send({ t: 'pickHero', aspect: meP && meP.aspect === b.dataset.aspect ? null : b.dataset.aspect });
  bindPackTabs();
  $('#btn-start').disabled = !isHost;
  $('#btn-add-bot').disabled = !isHost || r.players.length >= r.maxPlayers;
  $('#btn-start').textContent = isHost ? '출동! ▶' : '방장이 시작하기를 기다리는 중…';
}

function renderChat() {
  if (!app.room) return;
  const html = app.room.chat.map((c) => `<div><b>${esc(c.name)}</b>: ${esc(c.text)}</div>`).join('') || '<div class="hint">채팅 내용이 여기에 나와요.</div>';
  for (const el of [$('#room-chat'), $('#game-chat')]) { el.innerHTML = html; el.scrollTop = el.scrollHeight; }
  const last = app.room.chat.length ? app.room.chat[app.room.chat.length - 1].at : 0;
  if (last > app.lastChat && app.lastChat) Sound.play('chat');
  app.lastChat = last;
}

// ───────────── 카드 그리기 ─────────────
function cardHTML(card, opts = {}) {
  const c = app.catalog.cards[card.id];
  if (!c) return '';
  const asp = app.catalog.aspects[c.aspect];
  const hero = heroDef(c.aspect);
  const color = asp ? asp.color : hero ? hero.color : '#8a8a9a';
  const ally = c.ally ? `<div class="c-stats"><span title="저지">🛑${c.ally.thw}</span><span title="공격">👊${c.ally.atk}</span><span title="체력">❤${c.ally.hp - (card.damage || 0)}/${c.ally.hp}</span></div>` : '';
  const uses = card.uses ? `<span class="c-uses">남은 사용 ${card.uses}</span>` : '';
  return `<div class="card t-${c.type} ${card.exhausted ? 'exhausted' : ''} ${opts.cls || ''}" data-uid="${card.uid || ''}" data-cid="${c.id}" style="--cc:${color}">
    <div class="c-head">${c.type !== 'resource' ? `<span class="c-cost" title="비용">${c.cost}</span>` : ''}<span class="c-type">${TYPE_NAME[c.type]}${c.defense ? ' · 방어' : ''}${c.attack ? ' · 공격' : ''}</span></div>
    <div class="c-name">${esc(c.name)}</div>
    <div class="c-art">${CARD_ART[c.id] || c.icon || '🃏'}</div>
    ${opts.mini ? '' : `<div class="c-text">${esc(c.text)}</div>`}
    ${ally}${uses}
    <div class="c-foot"><span class="c-asp">${asp ? esc(asp.name) : hero ? esc(hero.name) : '기본'}</span>${resIcons(c)}</div>
  </div>`;
}

function minionHTML(m, can) {
  const e = app.catalog.encounter[m.cardId] || {};
  return `<div class="minion ${can ? 'can' : ''}" data-target="${m.iid}">
    <div class="mn-name">${encArt(m.cardId) || '👾'} ${esc(m.name)}</div>
    <div class="mn-stats"><span title="계략">🕸${m.sch}</span><span title="공격">👊${m.atk}</span></div>
    <div class="bar"><i style="width:${Math.max(0, 100 * m.hp / m.maxHp)}%"></i><span>❤ ${Math.max(0, m.hp)}/${m.maxHp}</span></div>
    <div class="mn-tags">${m.guard ? '<span class="kw">경비</span>' : ''}${m.retaliate ? `<span class="kw">반격 ${m.retaliate}</span>` : ''}${m.stunned ? '<span class="st st-stun">기절</span>' : ''}${m.confused ? '<span class="st st-conf">혼란</span>' : ''}${m.tough ? '<span class="st st-tough">강인함</span>' : ''}</div>
    <div class="mn-text hint">${esc(e.text || '')}</div>
  </div>`;
}

// ───────────── 게임 화면 ─────────────
function promptMap() {
  const m = { target: {}, scheme: {}, card: {}, hero: {} };
  const p = app.prompt;
  if (!p || p.type !== 'option') return m;
  for (const o of p.options) {
    if (o.disabled) continue;
    if (o.target) m.target[o.target] = o.value;
    if (o.scheme) m.scheme[o.scheme] = o.value;
    if (o.hero) m.hero[o.hero] = o.value;
    if (o.card && (p.kind === 'turn' || p.kind === 'defend' || p.kind === 'ally' || p.kind === 'tech')) {
      if (!m.card[o.card] || o.value.startsWith('play:') || o.value.startsWith('event:')) m.card[o.card] = o.value;
    }
  }
  return m;
}

function me() { return app.state.ps[app.you]; }

function renderGame() {
  const st = app.state;
  if (!st || !st.villain) return;
  renderTop();
  renderPrompt();
  renderVillain();
  renderHeroes();
  renderHand();
  renderLog();
  renderTabs();
  renderCardModal();
  renderResult();
  if (app.tipOwner && !document.body.contains(app.tipOwner)) hideTip();
  const myTurn = st.current === app.you && !st.result;
  if (myTurn && !app.wasMyTurn) { Sound.play('turn'); flashTurn(); }
  app.wasMyTurn = myTurn;
}

function flashTurn() { const b = $('#topbar'); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }

function renderTop() {
  const st = app.state;
  const cur = st.players.find((p) => p.id === st.current);
  const v = villainDef(st.villainId);
  const diff = app.catalog.difficulties.find((d) => d.id === st.difficulty);
  const phase = st.result ? '🏁 게임 종료' : st.phase === 'villain' ? '😈 악당 단계' : '🦸 영웅 단계';
  const html = `<div class="tb-logo"><img src="/icon.svg" width="36" height="36" alt=""><b>히어로 챔피언스</b></div>
    <div class="tb-round">라운드 <b>${st.round}</b></div>
    <div class="tb-phase ${st.phase === 'villain' ? 'villain' : ''}">${phase}</div>
    <div class="tb-turn">${cur ? `<span class="dot" style="background:${colorOf(cur.id)}"></span>${cur.id === app.you ? '<b class="mine">내 차례!</b>' : `<b>${esc(cur.name)}</b>의 차례`}` : ''}</div>
    <div class="tb-info">${v.icon} ${esc(v.name)} · ${esc(diff ? diff.name : '')}</div>
    <div class="tb-btns"><button class="small btn-full" title="전체 화면 켜기/끄기 (F11도 돼요)">${document.fullscreenElement ? '🗗 창 모드' : '⛶ 전체 화면'}</button><button class="small btn-guide2">📖 게임 방법</button><button class="small btn-ref">📋 빠른 참고</button><button class="small btn-sound2">⚙ 설정</button>${quitButtonHTML()}${st.result ? '<button class="small" id="btn-show-result">🏁 결과</button>' : ''}</div>`;
  if (setHTML($('#topbar'), html)) {
    $('#topbar .btn-guide2').onclick = () => Guide.open();
    $('#topbar .btn-ref').onclick = () => Guide.reference();
    $('#topbar .btn-sound2').onclick = openSound;
    $('#topbar .btn-full').onclick = toggleFullscreen;
    bindQuitButton();
    const rb = $('#btn-show-result');
    if (rb) rb.onclick = () => { app.hideResult = false; renderResult(); };
  }
}

function renderPrompt() {
  const p = app.prompt;
  const st = app.state;
  const box = $('#prompt');
  if (!p || p.type !== 'option') {
    box.className = 'prompt waiting';
    const cur = st.players.find((x) => x.id === st.current);
    setHTML(box, p && p.type === 'cards' ? '<div class="p-title">비용을 낼 카드를 고르세요 (가운데 창)</div>' : `<div class="p-title">${st.result ? '🏁 게임이 끝났어요' : st.phase === 'villain' ? '😈 악당 단계 진행 중…' : cur ? `⏳ ${esc(cur.name)}의 차례를 기다리는 중…` : '⏳ 진행 중…'}</div>`);
  } else {
    box.className = `prompt active ${p.kind === 'defend' ? 'danger' : ''}`;
    const groups = {};
    for (const o of p.options) (groups[o.group || 'other'] = groups[o.group || 'other'] || []).push(o);
    const btn = (o) => `<button class="opt g-${o.group || 'other'} ${o.disabled ? 'off' : ''}" data-v="${esc(o.value)}">${esc(o.label)}</button>`;
    const order = [['basic', '영웅 행동'], ['card', '카드'], ['ally', '아군'], ['tech', '강화·지원'], ['defend', '막기'], ['other', ''], ['end', '']];
    let html = `<div class="p-title">${esc(p.title)}</div><div class="p-opts">`;
    for (const [g, label] of order) if (groups[g]) html += `<div class="p-group ${g === 'end' ? 'end' : ''}">${label ? `<span class="p-gl">${label}</span>` : ''}${groups[g].map(btn).join('')}</div>`;
    html += '</div>';
    if (setHTML(box, html)) { box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop'); }
    for (const b of box.querySelectorAll('button[data-v]')) {
      const o = p.options.find((x) => x.value === b.dataset.v);
      b.onclick = () => {
        const cur = app.prompt && app.prompt.options && app.prompt.options.find((x) => x.value === b.dataset.v);
        if (!cur) return;
        if (cur.disabled) { toast(cur.reason || '지금은 할 수 없어요'); return; }
        answer(cur.value);
      };
      const desc = optionDesc(o, p, st);
      if (desc || o.disabled) {
        b.onmouseenter = (e) => showTip(e, (desc || '') + (o.disabled && o.reason ? `<div class="tip-warn">🚫 ${esc(o.reason)}</div>` : ''));
        b.onmousemove = moveTip;
        b.onmouseleave = hideTip;
      }
    }
  }
  setHTML($('#hint'), `💡 ${promptHint(p, st)}`);
}

function bar(cur, max, cls = '') { return `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, 100 * cur / max))}%"></i><span>${cur} / ${max}</span></div>`; }

function renderVillain() {
  const st = app.state;
  const v = st.villain;
  const vd = villainDef(st.villainId);
  const pm = promptMap();
  const sc = st.scheme;
  const ratio = sc.threat / sc.threshold;
  const html = `<div class="villain-card ${pm.target.villain ? 'can' : ''}" data-target="villain" style="--vc:${vd.color}">
      <div class="vc-top"><span class="vc-icon">${vd.icon}</span><div><div class="vc-name">${esc(vd.name)}</div>
        <div class="vc-stage">${v.stages.map((s, i) => `<span class="${i === v.stageIdx ? 'now' : i < v.stageIdx ? 'done' : ''}">${s}</span>`).join('→')}단계</div></div></div>
      ${bar(v.hp, v.maxHp, 'hp')}
      <div class="vc-stats"><span title="계략력: 일상 모습인 영웅에게 계략을 꾸밀 때 위협을 이만큼 쌓아요">🕸 계략 <b>${v.sch}</b></span><span title="공격력: 영웅 모습인 영웅을 공격할 때 피해">👊 공격 <b>${v.atk}</b></span></div>
      <div class="vc-tags">${v.stunned ? '<span class="st st-stun">기절</span>' : ''}${v.confused ? '<span class="st st-conf">혼란</span>' : ''}${v.tough ? '<span class="st st-tough">강인함</span>' : ''}${v.attachments.map((id) => `<span class="kw" title="${esc(app.catalog.encounter[id].text)}">${encArt(id) || ''} ${esc(app.catalog.encounter[id].name)}</span>`).join('')}</div>
      ${v.text ? `<div class="vc-text hint">${esc(v.text)}</div>` : ''}
    </div>
    <div class="scheme-card ${pm.scheme.main ? 'can' : ''} ${ratio >= 0.7 ? 'danger' : ''}" data-scheme="main">
      <div class="sc-label">🗺 주 계략</div><div class="sc-name">${esc(sc.name)}</div>
      <div class="threat-meter"><i style="width:${Math.min(100, ratio * 100)}%"></i><span>위협 <b>${sc.threat}</b> / ${sc.threshold}</span></div>
      <div class="hint">악당 단계마다 위협 +${st.accel} · 한계에 닿으면 패배!</div>
      <div class="sc-text hint">${esc(sc.text)}</div>
    </div>
    <div class="side-schemes">${st.sides.map((s) => `<div class="side-card ${pm.scheme[s.sid] ? 'can' : ''}" data-scheme="${s.sid}">
        <div class="sc-label">📌 부가 계략</div><div class="sc-name">${encArt(s.cardId) || ''} ${esc(s.name)}</div>
        <div class="threat-num">위협 <b>${s.threat}</b> <span class="hint">→ 0이 되면 사라져요</span></div>
        ${sideRules(s).map((r) => `<div class="side-rule ${r.cls}">${r.icon} <b>${r.name}</b>: ${esc(r.text)}</div>`).join('')}
      </div>`).join('') || '<div class="hint side-empty">부가 계략 없음</div>'}
    </div>
    <div class="enc-deck" title="악당의 조우 덱: 악당 단계마다 플레이어마다 1장씩 공개돼요. 부스트로도 쓰여요.">
      <div class="deck-back">🎴<b>${st.encDeck}</b></div><div class="hint">조우 덱</div>
      ${st.encDiscardTop ? `<div class="hint">최근: ${esc(app.catalog.encounter[st.encDiscardTop].name)}</div>` : ''}
    </div>`;
  const zone = $('#villain-zone');
  if (!setHTML(zone, html)) return;
  for (const el of zone.querySelectorAll('[data-target]')) el.onclick = () => { const val = promptMap().target[el.dataset.target]; if (val != null) answer(val); };
  for (const el of zone.querySelectorAll('.side-card')) {
    const sd = st.sides.find((x) => x.sid === el.dataset.scheme);
    if (sd) { el.onmouseenter = (e) => showTip(e, sideTip(sd)); el.onmouseleave = hideTip; }
  }
  for (const el of zone.querySelectorAll('[data-scheme]')) el.onclick = () => { const val = promptMap().scheme[el.dataset.scheme]; if (val != null) answer(val); };
  const vEl = zone.querySelector('.villain-card');
  vEl.onmouseenter = (e) => showTip(e, villainTip());
  vEl.onmousemove = moveTip;
  vEl.onmouseleave = hideTip;
}

function villainTip() {
  const st = app.state;
  const vd = villainDef(st.villainId);
  return `<b>${vd.icon} ${esc(vd.name)}</b><br>${esc(vd.desc)}<table class="tip-tbl">${vd.stages.map((s) => `<tr><td>${s.stage}단계</td><td>계략 ${s.sch} · 공격 ${s.atk} · 체력 ${s.hp}×플레이어</td></tr>`).join('')}</table>
    <div class="tip-meta">악당 단계마다: 영웅 모습인 사람은 <b>공격</b>받고, 일상 모습인 사람에게는 <b>계략</b>을 꾸며요 (부스트 카드만큼 더 세짐). 체력이 0이 되면 다음 단계로, 마지막 단계를 쓰러뜨리면 승리!</div>`;
}

function renderHeroes() {
  const st = app.state;
  const pm = promptMap();
  const html = st.order.map((pid) => {
    const p = st.ps[pid];
    const pl = st.players.find((x) => x.id === pid);
    const h = heroDef(p.heroId);
    const a = app.catalog.aspects[p.aspect];
    const isHero = p.form === 'hero';
    const tags = `${p.stunned ? '<span class="st st-stun">기절</span>' : ''}${p.confused ? '<span class="st st-conf">혼란</span>' : ''}${p.tough ? '<span class="st st-tough">강인함</span>' : ''}${p.bonusRes ? `<span class="kw">보너스 자원 ${p.bonusRes}</span>` : ''}`;
    const tableau = p.play.map((c) => cardHTML(c, { mini: true, cls: `${pm.card[c.uid] ? 'can' : ''}` })).join('');
    const minions = p.engaged.map((m) => minionHTML(m, pm.target[m.iid] != null)).join('');
    return `<div class="hpanel ${st.current === pid ? 'turn' : ''} ${p.defeated ? 'defeated' : ''}" style="--pc:${colorOf(pid)};--hc:${h.color}">
      <div class="identity ${isHero ? 'hero' : 'alter'} ${p.exhausted ? 'exhausted' : ''} ${pm.hero[pid] ? 'can' : ''}" data-hero="${pid}">
        <div class="id-player"><span class="dot" style="background:${colorOf(pid)}"></span>${esc(pl.name)}${pid === app.you ? ' (나)' : ''}${pl.bot ? ' <span class="tag">AI</span>' : ''}${st.first === pid ? ' <span class="tag first">선</span>' : ''}</div>
        <div class="id-main"><span class="id-icon">${isHero ? h.icon : '🧑'}</span><div><div class="id-name">${esc(isHero ? h.name : h.alter.name)}</div>
          <div class="id-form">${isHero ? '🦸 영웅 모습' : `🏠 일상 모습 · ${esc(h.alter.job)}`}</div></div></div>
        ${bar(p.hp, p.maxHp, 'hp')}
        <div class="id-stats">${isHero ? `<span title="저지력">🛑${p.thw}</span><span title="공격력">👊${p.atk}</span><span title="방어력">🛡${p.def}</span>` : `<span title="회복력">❤+${p.rec}</span>`}<span title="손패 / 손패 한도">✋${p.handCount}/${p.handSize}</span><span title="덱 / 버림">🂠${p.deckCount}</span></div>
        <div class="id-tags">${p.exhausted ? '<span class="kw">소진</span>' : ''}${p.abilityUsed ? '<span class="kw used">능력 사용함</span>' : ''}${tags}${a ? `<span class="asp-chip" style="--ac:${a.color}">${esc(a.name)}</span>` : ''}</div>
        ${p.defeated ? '<div class="id-dead">쓰러짐</div>' : ''}
      </div>
      <div class="tableau">${tableau || '<span class="hint">놓인 카드 없음</span>'}</div>
      <div class="engaged">${minions ? `<div class="eng-label">교전 중인 미니언</div>${minions}` : ''}</div>
    </div>`;
  }).join('');
  const zone = $('#hero-zone');
  if (!setHTML(zone, html)) return;
  animateNew(zone, '.minion', (el) => el.dataset.target, app.seen.minion, 'enter');
  animateNew(zone, '.tableau .card', (el) => el.dataset.uid, app.seen.play, 'enter');
  for (const el of zone.querySelectorAll('[data-target]')) el.onclick = () => { const val = promptMap().target[el.dataset.target]; if (val != null) answer(val); };
  for (const el of zone.querySelectorAll('[data-hero]')) {
    el.onclick = () => { const val = promptMap().hero[el.dataset.hero]; if (val != null) answer(val); };
    el.onmouseenter = (e) => showTip(e, heroTip(el.dataset.hero));
    el.onmousemove = moveTip;
    el.onmouseleave = hideTip;
  }
  for (const el of zone.querySelectorAll('.tableau .card')) el.onclick = () => { const val = promptMap().card[el.dataset.uid]; if (val != null) answer(val); };
  attachCardTips(zone);
}

function heroTip(pid) {
  const p = app.state.ps[pid];
  const h = heroDef(p.heroId);
  return `<b>${h.icon} ${esc(h.name)}</b> / 일상: <b>${esc(h.alter.name)}</b> (${esc(h.alter.job)})<br>
    <span class="hint">영웅</span> 저지 ${h.hero.thw} · 공격 ${h.hero.atk} · 방어 ${h.hero.def} · 손패 ${h.hero.hand} — ✨ ${esc(h.hero.ability.name)}: ${esc(h.hero.ability.text)}<br>
    <span class="hint">일상</span> 회복 ${h.alter.rec} · 손패 ${h.alter.hand} — ✨ ${esc(h.alter.ability.name)}: ${esc(h.alter.ability.text)}
    <div class="tip-meta">영웅 모습이면 악당이 <b>공격</b>하고, 일상 모습이면 악당이 <b>계략</b>을 꾸며요. 능력은 라운드마다 1번, 모습 바꾸기도 라운드마다 1번.</div>`;
}

function animateNew(root, selector, keyOf, set, cls) {
  for (const el of root.querySelectorAll(selector)) { const k = keyOf(el); if (!k || set.has(k)) continue; set.add(k); el.classList.add(cls); }
}

function renderHand() {
  const p = me();
  if (!p) return;
  const pm = promptMap();
  setHTML($('#my-title'), `✋ 내 손패 <span class="hint">${p.handCount}장 · 손패 한도 ${p.handSize} · 덱 ${p.deckCount}장 · 버림 ${p.discardCount}장 — 빛나는 카드를 누르면 사용 · 비용은 다른 카드를 버려서 내요 (아래쪽 아이콘 = 자원)</span>`);
  const html = (p.hand || []).map((c) => cardHTML(c, { cls: pm.card[c.uid] ? 'can' : '' })).join('') || '<span class="hint">손패가 없어요</span>';
  const hand = $('#hand');
  if (setHTML(hand, html)) animateNew(hand, '.card', (el) => el.dataset.uid, app.seen.hand, 'enter');
  for (const el of hand.querySelectorAll('.card')) {
    el.onclick = () => {
      const val = promptMap().card[el.dataset.uid];
      if (val != null) answer(val);
      else if (app.prompt && app.prompt.kind === 'turn') {
        const o = app.prompt.options.find((x) => x.card === el.dataset.uid);
        toast(o && o.disabled ? o.reason : '자원 카드는 다른 카드의 비용을 낼 때 버려서 써요.');
      }
    };
  }
  attachCardTips(hand);
}

// ───────────── 비용 지불 창 ─────────────
function renderCardModal() {
  const p = app.prompt;
  const modal = $('#modal');
  if (!p || p.type !== 'cards') {
    if (modal.dataset.mode === 'cards') { modal.classList.add('hidden'); modal.dataset.mode = ''; }
    return;
  }
  if (modal.dataset.mode !== 'cards' || modal.dataset.pid !== String(p.id)) {
    app.sel = (p.suggest || []).slice();
    modal.dataset.mode = 'cards';
    modal.dataset.pid = String(p.id);
  }
  const hand = me().hand || [];
  const cards = p.cards.map((u) => hand.find((x) => x.uid === u)).filter(Boolean);
  const bonus = Math.min(me().bonusRes, p.pay);
  const sum = app.sel.reduce((a, u) => { const cd = hand.find((x) => x.uid === u); return a + (cd ? app.catalog.cards[cd.id].resN : 0); }, 0) + bonus;
  const ok = sum >= p.pay;
  modal.querySelector('.modal-inner').innerHTML = `<h2>${esc(p.title)}</h2>
    <div class="pay-status ${ok ? 'ok' : 'bad'}">필요한 자원 <b>${p.pay}</b> · 고른 자원 <b>${sum}</b>${bonus ? ` (보너스 ${bonus} 포함)` : ''} → ${ok ? '✔ 낼 수 있어요' : '✖ 아직 모자라요'}</div>
    <p class="hint">버린 카드는 효과를 쓰지 못해요. 자원 카드(🔋💡💪)나 지금 필요 없는 카드를 버리세요. 추천 조합이 미리 골라져 있어요.</p>
    <div class="cards-grid">${cards.map((cd) => cardHTML(cd, { cls: `pick ${app.sel.includes(cd.uid) ? 'sel' : ''}` })).join('')}</div>
    <div class="actions">${p.cancel ? '<button id="cm-cancel" class="small">취소</button>' : ''}<button id="cm-ok" class="primary" ${ok ? '' : 'disabled'}>이 카드로 내기</button></div>`;
  modal.classList.remove('hidden');
  for (const el of modal.querySelectorAll('.card.pick')) {
    el.onclick = () => { const u = el.dataset.uid; app.sel = app.sel.includes(u) ? app.sel.filter((x) => x !== u) : [...app.sel, u]; renderCardModal(); };
  }
  attachCardTips(modal);
  $('#cm-ok').onclick = () => answer(app.sel.slice());
  const cc = $('#cm-cancel');
  if (cc) cc.onclick = () => answer(null);
}

// ───────────── 기록 / 효과 / 결과 ─────────────
function renderLog() {
  const st = app.state;
  const el = $('#log');
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  const changed = setHTML(el, st.log.map((l) => `<div class="lg k-${l.kind || 'x'}" style="${l.pid ? `--pc:${colorOf(l.pid)}` : ''}">${esc(l.text)}</div>`).join(''));
  if (changed && (atBottom || !renderLog.init)) el.scrollTop = el.scrollHeight;
  renderLog.init = true;
}
function renderTabs() {
  for (const b of document.querySelectorAll('.tabs [data-tab]')) b.classList.toggle('on', b.dataset.tab === app.tab);
  $('#log').classList.toggle('hidden', app.tab !== 'log');
  $('#chat').classList.toggle('hidden', app.tab !== 'chat');
}

const LOG_SOUND = { hit: 'ravage', kill: 'destroy', hurt: 'blight', encounter: 'fearCard', threat: 'fear', play: 'cardPlay', flip: 'presence', round: 'phase', thwart: 'land', stage: 'explore', minion: 'build', defend: 'select' };
function onNewLogs(first) {
  const st = app.state;
  const fresh = st.log.filter((l) => l.seq > app.lastLog);
  app.lastLog = st.log.length ? st.log[st.log.length - 1].seq : 0;
  if (first) return;
  const played = new Set();
  for (const l of fresh.slice(-4)) {
    if (l.kind === 'win') { Sound.play('victory'); continue; }
    if (l.kind === 'lose' && st.result) { Sound.play('defeat'); continue; }
    const s = LOG_SOUND[l.kind];
    if (s && !played.has(s)) { Sound.play(s); played.add(s); }
  }
}

/** 화면 위 만화 효과 (POW!, -3 등) */
function burst(el, text, cls) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const foot = $('.my-area').getBoundingClientRect().top;
  if (r.top > foot - 20 || r.bottom < 0) return; // 손패 뒤로 가려졌거나 화면 밖이면 생략
  const f = document.createElement('div');
  f.className = `burst ${cls}`;
  f.textContent = text;
  f.style.left = `${r.left + r.width / 2 + (Math.random() * 40 - 20)}px`;
  f.style.top = `${r.top + r.height / 3}px`;
  $('#fx-layer').appendChild(f);
  setTimeout(() => f.remove(), 1400);
}
function playEvents(first) {
  const st = app.state;
  const evs = (st.events || []).filter((e) => e.id > app.lastEv);
  if (st.events && st.events.length) app.lastEv = Math.max(app.lastEv, ...st.events.map((e) => e.id));
  if (first) return;
  const words = ['POW!', 'BAM!', 'WHAM!', 'KRAK!', 'BOOM!'];
  for (const e of evs) {
    if (e.kind === 'hit') burst(document.querySelector(`[data-target="${e.target}"]`), `${words[e.id % words.length]} ${e.n >= 99 ? '' : -e.n}`, 'hit');
    else if (e.kind === 'hurt') burst(document.querySelector(`[data-hero="${e.pid}"]`), `-${e.n}`, 'hurt');
    else if (e.kind === 'thwart') burst(document.querySelector(`[data-scheme="${e.where}"]`), '위협↓', 'thw');
    else if (e.kind === 'stage') burst(document.querySelector('.villain-card'), '다음 단계!', 'stage');
    else if (e.kind === 'flip') { const el = document.querySelector(`[data-hero="${e.pid}"]`); if (el) { el.classList.remove('flipping'); void el.offsetWidth; el.classList.add('flipping'); } }
    else if (e.kind === 'encounter') encounterBanner(e);
  }
}
function encounterBanner(e) {
  const c = app.catalog.encounter[e.card];
  if (!c) return;
  const pl = app.state.players.find((x) => x.id === e.pid);
  const el = document.createElement('div');
  el.className = `enc-banner t-${c.type}`;
  el.innerHTML = `<div class="eb-type">🎴 조우 카드 — ${ENC_TYPE[c.type]}${pl ? ` · ${esc(pl.name)}` : ''}</div><div class="eb-name">${encArt(e.card) || ''} ${esc(c.name)}</div><div class="eb-text">${esc(c.text)}</div>`;
  $('#fx-layer').appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/** 부가 계략 키워드 설명 (카드에 바로 보이게) */
function sideRules(s) {
  const out = [];
  if (s.crisis) out.push({ cls: 'danger', icon: '⛔', name: '위기', text: '이 계략이 남아 있는 동안 주 계략의 위협을 제거할 수 없어요. 먼저 없애세요!' });
  if (s.accel) out.push({ cls: '', icon: '⏩', name: '가속', text: `악당 단계마다 주 계략 위협이 +${s.accel} 더 늘어요.` });
  if (s.hazard) out.push({ cls: '', icon: '☢', name: '위험', text: `악당 단계마다 조우 카드를 ${s.hazard}장 더 공개해요 (나쁜 일이 더 자주 생겨요).` });
  if (!out.length) out.push({ cls: '', icon: '📌', name: '효과', text: '특별한 효과는 없지만, 남겨 두면 위협이 쌓여 있어요.' });
  return out;
}
function sideTip(s) {
  const e = app.catalog.encounter[s.cardId] || {};
  return `<b>${encArt(s.cardId)} ${esc(s.name)}</b> <span class="hint">(부가 계략)</span><br>${esc(e.text || '')}
    <div style="margin-top:6px">${sideRules(s).map((r) => `${r.icon} <b>${r.name}</b>: ${esc(r.text)}`).join('<br>')}</div>
    <div class="tip-meta">부가 계략은 악당이 동시에 꾸미는 또 다른 음모예요. 여기에 쌓인 위협으로는 지지 않지만, 위의 효과가 계속 발동해요.<br>
    🛑 <b>저지</b>(기본 저지·저지 카드·아군 저지)로 이 카드를 골라 위협을 0으로 만들면 버려져요. 위협 ${s.threat} 남음.</div>`;
}

function renderResult() {
  const st = app.state;
  const box = $('#result');
  if (!st.result || app.hideResult) { box.classList.add('hidden'); return; }
  const isHost = app.room && app.room.hostId === app.you;
  const vd = villainDef(st.villainId);
  box.querySelector('.modal-inner').innerHTML = `<div class="res-head ${st.result.win ? 'win' : 'lose'}">${st.result.win ? '🎉 승리!' : '💀 패배…'}</div>
    <p class="res-reason">${esc(st.result.reason)}</p>
    <p class="hint">악당: ${vd.icon} ${esc(vd.name)} · ${st.round}라운드</p>
    <div class="actions"><button class="small" id="res-close">판 보기</button>${isHost ? '<button class="primary" id="res-rematch">🔁 바로 다시 하기</button><button class="small" id="res-lobby">⚙ 대기실에서 설정 바꾸기</button>' : '<span class="hint">방장이 "바로 다시 하기"를 누르면 같은 구성으로 새 판이 시작돼요</span>'}<button class="small" id="res-leave">나가기</button></div>`;
  box.classList.remove('hidden');
  $('#res-close').onclick = () => { app.hideResult = true; box.classList.add('hidden'); };
  const lb = $('#res-lobby');
  if (lb) lb.onclick = () => { app.hideResult = false; send({ t: 'backToLobby' }); };
  const rm = $('#res-rematch');
  if (rm) rm.onclick = () => { rm.disabled = true; send({ t: 'rematch' }); };
  $('#res-leave').onclick = () => { app.hideResult = false; box.classList.add('hidden'); send({ t: 'leave' }); };
}

// ───────────── 툴팁 ─────────────
function showTip(e, html) { const t = $('#tip'); t.innerHTML = html; t.classList.remove('hidden'); app.tipOwner = e.currentTarget; moveTip(e); }
function moveTip(e) {
  const t = $('#tip');
  t.style.left = `${Math.min(e.clientX + 16, window.innerWidth - t.offsetWidth - 8)}px`;
  t.style.top = `${Math.min(e.clientY + 16, window.innerHeight - t.offsetHeight - 8)}px`;
}
function hideTip() { $('#tip').classList.add('hidden'); app.tipOwner = null; }
function attachCardTips(root) {
  for (const el of root.querySelectorAll('.card[data-cid]')) {
    const c = app.catalog.cards[el.dataset.cid];
    if (!c) continue;
    el.onmouseenter = (e) => showTip(e, cardTip(c));
    el.onmousemove = moveTip;
    el.onmouseleave = hideTip;
  }
  for (const el of root.querySelectorAll('.minion[data-target]')) {
    const m = app.state && app.state.order.flatMap((pid) => app.state.ps[pid].engaged).find((x) => x.iid === el.dataset.target);
    if (!m) continue;
    const e2 = app.catalog.encounter[m.cardId];
    el.onmouseenter = (e) => showTip(e, `<b>${encArt(m.cardId) || '👾'} ${esc(m.name)}</b> <span class="hint">(미니언)</span><br>계략 ${m.sch} · 공격 ${m.atk} · 체력 ${m.hp}/${m.maxHp}<br>${esc(e2.text)}<div class="tip-meta">악당 단계에 교전 중인 영웅이 영웅 모습이면 공격, 일상 모습이면 계략을 꾸며요. 공격이나 피해 카드로 쓰러뜨리세요.</div>`);
    el.onmousemove = moveTip;
    el.onmouseleave = hideTip;
  }
}
function cardTip(c) {
  const hero = heroDef(c.aspect);
  const asp = app.catalog.aspects[c.aspect];
  const typeHelp = {
    ally: '아군: 내 앞에 놓여 공격·저지를 대신해 줘요 (쓰면 소진되고 결과 피해 1). 악당의 공격을 대신 막을 수도 있어요.',
    event: '이벤트: 쓰면 효과를 내고 버림 더미로 가요.',
    upgrade: '강화: 내 영웅에게 붙어 계속 효과를 줘요.',
    support: '지원: 내 앞에 놓이고, 능력을 쓸 수 있어요 (보통 라운드마다 1번 소진).',
    resource: '자원 카드: 직접 쓰지 않고, 다른 카드 비용을 낼 때 버리면 자원 2개가 돼요.',
  }[c.type];
  return `<b>${CARD_ART[c.id] || c.icon || ''} ${esc(c.name)}</b> <span class="hint">(${TYPE_NAME[c.type]} · ${asp ? asp.name : hero ? hero.name + ' 전용' : '기본'}${c.type !== 'resource' ? ` · 비용 ${c.cost}` : ''})</span>
    <div class="tip-body">${esc(c.text)}${c.ally ? `<br>저지 ${c.ally.thw} · 공격 ${c.ally.atk} · 체력 ${c.ally.hp} · 결과 피해 ${c.ally.cons}` : ''}</div>
    <div class="tip-meta">${typeHelp}<br>${c.form === 'hero' ? '🦸 영웅 모습일 때만 쓸 수 있어요.<br>' : ''}${c.defense ? '🛡 방어 이벤트: 악당·미니언이 나를 공격할 때 쓸 수 있어요.<br>' : ''}비용으로 버리면 자원 ${app.catalog.resIcon[c.res].repeat(c.resN)} (${app.catalog.resNames[c.res]} ${c.resN}개)</div>`;
}

// ───────────── 설정 ─────────────
function applyFontScale(v) {
  document.documentElement.style.setProperty('--fs', String(v));
  try { localStorage.setItem('champ-fs', String(v)); } catch { /* 무시 */ }
  for (const b of document.querySelectorAll('.fs-btn')) b.classList.toggle('on', Number(b.dataset.fs) === Number(v));
  for (const el of document.querySelectorAll('*')) if (el._html) el._html = null;
  if (app.state) renderGame();
}
function renderTrackInfo() {
  const t = Sound.track;
  $('#snd-track').textContent = t ? t.name : '-';
  $('#snd-tracks').innerHTML = Sound.tracks.map((x) => `<span class="trk ${t && x.id === t.id ? 'on' : ''}">${x.name}</span>`).join('');
}
function openSound() {
  Sound.init();
  const s = Sound.settings;
  $('#snd-music').checked = s.musicOn; $('#snd-sfx').checked = s.sfxOn; $('#snd-shuffle').checked = s.shuffle !== false;
  $('#snd-music-vol').value = s.music; $('#snd-sfx-vol').value = s.sfx;
  renderTrackInfo();
  $('#sound-panel').classList.remove('hidden');
}
function initSettings() {
  let fs = 1;
  try { fs = Number(localStorage.getItem('champ-fs')) || 1; } catch { /* 무시 */ }
  applyFontScale(fs);
  for (const b of document.querySelectorAll('.fs-btn')) b.onclick = () => applyFontScale(Number(b.dataset.fs));
  $('#snd-music').onchange = (e) => Sound.set('musicOn', e.target.checked);
  $('#snd-sfx').onchange = (e) => Sound.set('sfxOn', e.target.checked);
  $('#snd-shuffle').onchange = (e) => Sound.set('shuffle', e.target.checked);
  $('#snd-music-vol').oninput = (e) => Sound.set('music', Number(e.target.value));
  $('#snd-sfx-vol').oninput = (e) => Sound.set('sfx', Number(e.target.value));
  $('#snd-next').onclick = () => { Sound.init(); Sound.nextTrack(); };
  $('#snd-test').onclick = () => Sound.test();
  $('#snd-close').onclick = () => $('#sound-panel').classList.add('hidden');
  $('#sound-panel').onclick = (e) => { if (e.target.id === 'sound-panel') $('#sound-panel').classList.add('hidden'); };
  Sound.onTrack = (t) => {
    renderTrackInfo();
    if (!Sound.settings.musicOn) return;
    const el = $('#now-playing-toast');
    el.textContent = `♪ ${t.name}`;
    el.classList.remove('hidden', 'show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(initSettings.t);
    initSettings.t = setTimeout(() => el.classList.add('hidden'), 4200);
  };
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (Guide.isOpen()) Guide.close();
    else $('#sound-panel').classList.add('hidden');
  });
}

document.addEventListener('DOMContentLoaded', () => { initHome(); initSettings(); connect(); });
