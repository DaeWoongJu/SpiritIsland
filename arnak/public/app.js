'use strict';
/* 아르낙 온라인 — 클라이언트 */

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const app = {
  ws: null, token: null, catalog: null, room: null, you: null, state: null, prompt: null,
  sel: [], lastLog: 0, tab: 'log', lastChat: 0, wasMyTurn: false,
  seen: { hand: new Set(), row: new Set(), sites: {}, occ: new Set(), guard: new Set() }, prevRes: null, tipOwner: null,
};
window.app = app;

const CARD_ART = {
  funding: '💰', exploration: '🗺', fear: '😱', machete: '🔪', canteen: '🫗', rope: '🪢', lantern: '🏮', brush: '🖌', trowel: '⛏', binoculars: '🔭',
  journal: '📔', pith_helmet: '⛑', bow: '🏹', pickaxe: '⛏', jeep: '🚙', seaplane: '🛩', camera: '📷', compass_item: '🧭', trade_goods: '📦',
  climbing_gear: '🧗', old_map: '🗺', pack_mule: '🫏', cargo_ship: '🚢', chisel: '🔨', revolver: '🔫', monocle: '🧐', grant: '📜', telegram: '📨',
  hot_air: '🎈', museum_letter: '✉', expedition_tent: '⛺', jade_mask: '🎭', obsidian_knife: '🗡', star_chart: '✨', sun_disc: '🌞', ancient_scroll: '📜',
  feather_crown: '👑', idol_eye: '👁', serpent_staff: '🐍', stone_key: '🗝', ritual_drum: '🥁', warrior_totem: '🗿', moon_pendant: '🌙', golden_jaguar: '🐆',
  temple_map: '🏛', guardian_horn: '📯', crystal_skull: '💀', clay_tablet: '🧱', bone_flute: '🦴', sky_lens: '🔮', spirit_mask: '👺',
  lecture_notes: '📝', wrench: '🔧', walking_stick: '🦯', ship_log: '⚓', crystal_ball: '🔮', family_jewels: '💍',
  radio: '📻', motorboat: '🚤', field_kit: '🎒', camp_stove: '🔥', guidebook: '📘', rifle: '🎯', gold_pan: '🥘', sextant: '📐', cargo_plane: '✈', field_notes: '🗒',
  sun_mirror: '🪞', stone_compass: '🧭', jaguar_mask: '🐯', ancestor_bones: '☠', serpent_ring: '💍', thunder_drum: '🪘', golden_mask: '😷', eternal_flame: '🕯',
};
const GUARDIAN_ART = { g1: '🐢', g2: '🐍', g3: '🐆', g4: '🦇', g5: '🗿', g6: '🐉', g7: '🐊', g8: '🐒', g9: '🦅', g10: '🕷', g11: '🪨', g12: '🌪', g13: '🦎', g14: '🐺', g15: '🪲', g16: '🌳' };
const KIND_NAME = { item: '물건', artifact: '유물', start: '시작 카드', fear: '두려움' };

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
  ws.onopen = () => send({ t: 'hello', token: sessionStorage.getItem('arnak-token') || localStorage.getItem('arnak-token') });
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onclose = () => { toast('서버와 연결이 끊겼어요. 다시 연결하는 중…'); setTimeout(connect, 1500); };
}
function send(msg) { if (app.ws && app.ws.readyState === 1) app.ws.send(JSON.stringify(msg)); }

function onMessage(msg) {
  switch (msg.t) {
    case 'welcome':
      app.token = msg.token;
      app.catalog = msg.catalog;
      try { sessionStorage.setItem('arnak-token', msg.token); localStorage.setItem('arnak-token', msg.token); } catch { /* 무시 */ }
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
      }
      app.state = msg.state;
      app.prompt = msg.prompt;
      show('game');
      onNewLogs(first);
      renderGame();
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

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
}

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

// ───────────── 첫 화면 / 대기실 ─────────────
function myName() { return $('#in-name').value.trim(); }
function initHome() {
  try { $('#in-name').value = localStorage.getItem('arnak-name') || ''; } catch { /* 무시 */ }
  const save = () => { try { localStorage.setItem('arnak-name', myName()); } catch { /* 무시 */ } };
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
    const text = `아르낙 온라인 같이 해요! 주소: ${location.origin}  방 코드: ${app.room.code}`;
    navigator.clipboard?.writeText(text).then(() => toast('초대 문구를 복사했어요.'), () => toast(text));
  };
  for (const f of document.querySelectorAll('[data-chat]')) {
    f.onsubmit = (e) => { e.preventDefault(); const i = f.querySelector('input'); if (i.value.trim()) send({ t: 'chat', text: i.value }); i.value = ''; };
  }
  for (const b of document.querySelectorAll('.tabs [data-tab]')) b.onclick = () => { app.tab = b.dataset.tab; renderTabs(); };
  if (!localStorage.getItem('arnak-guided')) setTimeout(() => Guide.open(), 400);
}

// ───────────── 저장된 게임 이어하기 ─────────────
function saveTitle(sv) {
  const sm = sv.summary || {};
  return `<b>${sm.round || 1}/${sm.rounds || 5}라운드</b>${sm.expansion ? ' · 확장' : ''}`;
}
function slotDesc(s) {
  const l = s.leader && app.catalog.leaders.find((x) => x.id === s.leader);
  return l ? `${l.icon} ${esc(l.name)}` : '';
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
  $('#leader-pick').innerHTML = `<div class="rs-title">🪑 내 자리 고르기 <span class="hint">저장할 때 누가 어느 자리였는지 보고 고르세요.</span></div>
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
  $('#room-code').textContent = r.code;
  $('#invite-hint').innerHTML = `친구에게 이 주소 <b>${esc(location.origin)}</b> 와 방 코드 <b>${r.code}</b>를 알려 주세요. (최대 ${r.maxPlayers}명, AI로 빈자리를 채울 수 있어요)`;
  $('#room-players').innerHTML = r.players.map((p, i) => `<div class="rp" style="--pc:${p.color}">
      <span class="rp-order">${i + 1}</span>${ico('ic-arch', 26, '', `color:${p.color}`)}
      <span class="rp-name">${esc(p.name)}${p.id === app.you ? ' <span class="hint">(나)</span>' : ''}${p.id === r.hostId ? ' 👑' : ''}${p.bot ? ' <span class="tag">AI</span>' : ''}${!p.connected ? ' <span class="hint">(연결 끊김)</span>' : ''}</span>
      <span class="rp-res hint">시작 자원 ${resHTML(app.catalog.startRes[Math.min(i, 3)], 14)}</span>
      ${isHost ? `<span class="rp-btns"><button class="small" data-move="${p.id}" data-dir="up" ${i ? '' : 'disabled'}>▲</button><button class="small" data-move="${p.id}" data-dir="down" ${i < r.players.length - 1 ? '' : 'disabled'}>▼</button>${p.bot ? `<button class="small" data-rmbot="${p.id}">✕</button>` : ''}</span>` : ''}
    </div>`).join('');
  for (const b of document.querySelectorAll('[data-move]')) b.onclick = () => send({ t: 'move', id: b.dataset.move, dir: b.dataset.dir });
  for (const b of document.querySelectorAll('[data-rmbot]')) b.onclick = () => send({ t: 'removeBot', id: b.dataset.rmbot });
  renderRoomSettings(isHost);
  $('#btn-start').disabled = !isHost;
  $('#btn-add-bot').disabled = !isHost || r.players.length >= r.maxPlayers;
  $('#btn-start').textContent = isHost ? '게임 시작 ▶' : '방장이 시작하기를 기다리는 중…';
}

function renderRoomSettings(isHost) {
  const r = app.room;
  const c = app.catalog;
  const st = r.settings || {};
  const dis = isHost ? '' : 'disabled';
  $('#room-settings').innerHTML = `<div class="rs-title">⚙ 게임 설정 ${isHost ? '' : '<span class="hint">(방장만 바꿀 수 있어요)</span>'}</div>
    <div class="rs-grid">
      <label class="rs-opt ${st.leaders ? 'on' : ''}"><input type="checkbox" data-set="leaders" ${st.leaders ? 'checked' : ''} ${dis}>
        <span><b>👑 확장: 탐험대장</b><br><span class="hint">각자 고유 능력이 있는 탐험대장 6명 중 한 명을 골라요. 두려움 카드 1장 대신 대장 전용 카드로 시작.</span></span></label>
      <label class="rs-opt ${st.expansion ? 'on' : ''}"><input type="checkbox" data-set="expansion" ${st.expansion ? 'checked' : ''} ${dis}>
        <span><b>📦 확장: 새 카드·수호자·조수·유적</b><br><span class="hint">물건 ${c.expansionInfo.items} · 유물 ${c.expansionInfo.artifacts} · 수호자 ${c.expansionInfo.guardians} · 조수 ${c.expansionInfo.assistants} · 유적 ${c.expansionInfo.sites}곳이 더해져요.</span></span></label>
      <div class="rs-opt track"><b>🔍 연구 트랙 (판의 면)</b>
        ${c.tracks.map((t) => `<label class="rs-radio ${st.track === t.id ? 'on' : ''}"><input type="radio" name="track" value="${t.id}" ${st.track === t.id ? 'checked' : ''} ${dis}> ${t.id === 'snake' ? '🐍' : '🦅'} <b>${esc(t.name)}</b> <span class="hint">${esc(t.desc)}</span></label>`).join('')}</div>
    </div>`;
  if (isHost) {
    for (const cb of document.querySelectorAll('#room-settings [data-set]')) cb.onchange = () => send({ t: 'setSettings', settings: { [cb.dataset.set]: cb.checked } });
    for (const rb of document.querySelectorAll('#room-settings input[name=track]')) rb.onchange = () => send({ t: 'setSettings', settings: { track: rb.value } });
  }
  // 탐험대장 고르기
  const lp = $('#leader-pick');
  if (!st.leaders) { lp.innerHTML = ''; return; }
  const meP = r.players.find((p) => p.id === app.you);
  const owner = (id) => r.players.find((p) => p.leader === id);
  lp.innerHTML = `<div class="rs-title">👑 탐험대장 고르기 <span class="hint">카드를 눌러 내 대장을 고르세요. 안 고르면 시작할 때 무작위로 정해져요.${isHost && r.players.some((p) => p.bot) ? ' 방장은 AI 이름 옆 버튼으로 AI 대장도 정할 수 있어요.' : ''}</span></div>
    <div class="leaders">${c.leaders.map((l) => {
      const o = owner(l.id);
      const card = c.cards[l.card];
      return `<div class="leader ${o ? 'taken' : ''} ${meP && meP.leader === l.id ? 'mine' : ''}" data-leader="${l.id}" style="${o ? `--pc:${o.color}` : ''}">
        <div class="ld-icon">${l.icon}</div><div class="ld-name">${esc(l.name)}</div><div class="ld-title">${esc(l.title)}</div>
        <div class="ld-desc">${esc(l.desc)}</div>
        <div class="ld-card">시작 카드: <b>${esc(card.name)}</b> — ${esc(card.text.replace(/^⚡ /, '⚡'))}</div>
        ${o ? `<div class="ld-owner">✔ ${esc(o.name)}</div>` : ''}
        ${isHost ? r.players.filter((p) => p.bot).map((b) => `<button class="small ld-bot" data-bot="${b.id}" data-l="${l.id}">${esc(b.name.replace('AI ', ''))}에게</button>`).join('') : ''}
      </div>`;
    }).join('')}</div>`;
  for (const el of lp.querySelectorAll('.leader')) {
    el.onclick = (e) => {
      if (e.target.closest('.ld-bot')) return;
      const id = el.dataset.leader;
      send({ t: 'pickLeader', leader: meP && meP.leader === id ? null : id });
    };
  }
  for (const b of lp.querySelectorAll('.ld-bot')) b.onclick = () => send({ t: 'pickLeader', leader: b.dataset.l, target: b.dataset.bot });
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
  if (!card) return '<div class="card empty"></div>';
  const c = app.catalog.cards[card.id];
  const costIcon = c.kind === 'item' ? 'res-coin' : 'res-compass';
  return `<div class="card k-${c.kind} ${opts.cls || ''}" data-uid="${card.uid || ''}" data-cid="${c.id}" ${opts.attrs || ''}>
    <div class="c-top">${c.travel ? `<span class="c-travel" title="이동 아이콘: ${app.catalog.travelNames[c.travel]}">${ico(TRAVEL_ICON[c.travel], 22)}</span>` : ''}
      <span class="c-name">${esc(c.name)}</span></div>
    <div class="c-art">${CARD_ART[c.id] || '🃏'}${c.cost ? `<span class="c-cost" title="${c.kind === 'item' ? '동전' : '나침반'} ${c.cost}개로 구매">${ico(costIcon, 18)}<b>${c.cost}</b></span>` : ''}</div>
    <div class="c-text">${c.free ? '<b class="free">⚡ 자유 행동</b> ' : ''}${esc(c.text.replace(/^⚡ /, ''))}</div>
    <div class="c-foot"><span class="c-kind">${KIND_NAME[c.kind]}</span>${c.vp ? `<span class="c-vp ${c.vp < 0 ? 'neg' : ''}">${ico('ic-vp', 14)}${c.vp}</span>` : ''}</div>
  </div>`;
}

// ───────────── 게임 화면 ─────────────
function promptMap() {
  // 지금 선택지에 해당하는 화면 요소(유적/카드 줄/손패) → 선택 값
  const m = { site: {}, slot: {}, card: {} };
  const p = app.prompt;
  if (!p || p.type !== 'option') return m;
  for (const o of p.options) {
    if (o.disabled) continue;
    if (o.site) m.site[o.site] = o.value;
    if (o.slot != null) m.slot[o.slot] = o.value;
    if (o.card && p.kind === 'turn') m.card[o.card] = o.value;
  }
  return m;
}

function renderGame() {
  const st = app.state;
  if (!st || !st.ps[app.you] && !st.players.length) return;
  renderTop();
  renderPrompt();
  renderBoard();
  renderRow();
  renderResearch();
  renderPlayers();
  renderMine();
  renderLog();
  renderTabs();
  renderCardModal();
  renderResult();
  if (app.tipOwner && !document.body.contains(app.tipOwner)) hideTip();
  // 내 차례 알림
  const myTurn = st.current === app.you && !st.result;
  if (myTurn && !app.wasMyTurn) { Sound.play('turn'); flashTurn(); }
  app.wasMyTurn = myTurn;
}

function flashTurn() {
  const b = $('#topbar');
  b.classList.remove('flash');
  void b.offsetWidth;
  b.classList.add('flash');
}

function me() { return app.state.ps[app.you]; }

/** 내용이 바뀐 경우에만 다시 그린다 (깜빡임·애니메이션 재시작 방지). 다시 그렸으면 true */
function setHTML(el, html) {
  if (el._html === html) return false;
  el._html = html;
  el.innerHTML = html;
  return true;
}

/** 새로 나타난 요소에만 등장 애니메이션 */
function animateNew(root, selector, keyOf, set, cls) {
  for (const el of root.querySelectorAll(selector)) {
    const k = keyOf(el);
    if (!k || set.has(k)) continue;
    set.add(k);
    el.classList.add(cls);
  }
}

/** 숫자가 바뀌면 그 자리에서 +1 / -2 가 떠오른다 */
function spawnFloat(el, text, good) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = `float-num ${good ? 'up' : 'down'}`;
  f.textContent = text;
  f.style.left = `${r.left + r.width / 2}px`;
  f.style.top = `${r.top}px`;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1300);
}

function renderTop() {
  const st = app.state;
  const cur = st.players.find((p) => p.id === st.current);
  const colorOf = (pid) => app.catalog.colors[st.order.indexOf(pid)];
  const m = me();
  const rounds = Array.from({ length: st.rounds }, (_, i) => `<span class="rd ${i + 1 < st.round ? 'done' : i + 1 === st.round ? 'now' : ''}">${i + 1}</span>`).join('');
  const html = `
    <div class="tb-logo"><img src="/icon.svg" width="34" height="34" alt=""><b>아르낙</b></div>
    <div class="tb-round"><span class="hint">라운드</span><div class="rds">${rounds}</div></div>
    <div class="tb-turn">${st.result ? '🏆 게임 종료' : cur ? `<span class="dot" style="background:${colorOf(cur.id)}"></span>${cur.id === app.you ? '<b class="mine">내 차례!</b>' : `<b>${esc(cur.name)}</b>의 차례`}` : '진행 중…'}</div>
    ${m ? `<div class="tb-res">${['coin', 'compass', 'tablet', 'arrow', 'gem'].map((k) => `<span class="big-res" title="${app.catalog.resNames[k]}">${ico(RES_ICON[k], 26)}<b>${m.res[k]}</b></span>`).join('')}
      <span class="big-res" title="남은 고고학자">${ico('ic-arch', 26, '', `color:${colorOf(app.you)}`)}<b>${m.arch}</b></span>
      <span class="big-res vp" title="지금 점수">${ico('ic-vp', 24)}<b>${m.score.total}</b></span></div>` : ''}
    <div class="tb-btns"><button class="small btn-full" title="전체 화면 켜기/끄기 (F11도 돼요)">${document.fullscreenElement ? '🗗 창 모드' : '⛶ 전체 화면'}</button><button class="small btn-guide2">📖 게임 방법</button><button class="small btn-ref">📋 빠른 참고</button><button class="small btn-sound2" title="소리 · 배경음악 · 글자 크기">⚙ 설정</button>${quitButtonHTML()}${st.result ? '<button class="small" id="btn-show-result">🏆 결과</button>' : ''}</div>`;
  if (setHTML($('#topbar'), html)) {
    $('#topbar .btn-guide2').onclick = () => Guide.open();
    $('#topbar .btn-ref').onclick = () => Guide.reference();
    $('#topbar .btn-sound2').onclick = openSound;
    $('#topbar .btn-full').onclick = toggleFullscreen;
    bindQuitButton();
    const rb = $('#btn-show-result');
    if (rb) rb.onclick = () => { app.hideResult = false; renderResult(); };
  }
  // 내 자원이 바뀌면 숫자가 떠오른다
  if (m) {
    const cur = { ...m.res, vp: m.score.total };
    if (app.prevRes) {
      const els = $('#topbar').querySelectorAll('.tb-res .big-res');
      ['coin', 'compass', 'tablet', 'arrow', 'gem'].forEach((k, i) => {
        const d = cur[k] - app.prevRes[k];
        if (d) { spawnFloat(els[i], `${d > 0 ? '+' : ''}${d}`, d > 0); els[i].classList.remove('bump'); void els[i].offsetWidth; els[i].classList.add('bump'); }
      });
      const dv = cur.vp - app.prevRes.vp;
      if (dv) spawnFloat($('#topbar .big-res.vp'), `${dv > 0 ? '+' : ''}${dv}★`, dv > 0);
    }
    app.prevRes = cur;
  }
}

function renderPrompt() {
  const p = app.prompt;
  const st = app.state;
  const box = $('#prompt');
  if (!p || p.type !== 'option') {
    box.className = 'prompt waiting';
    const cur = st.players.find((x) => x.id === st.current);
    box._html = null;
    box.innerHTML = p && p.type === 'cards' ? '<div class="p-title">카드를 고르세요 (가운데 창)</div>' : `<div class="p-title">${st.result ? '🏆 게임이 끝났어요' : cur ? `⏳ ${esc(cur.name)}의 차례를 기다리는 중…` : '⏳ 진행 중…'}</div>`;
  } else {
    box.className = 'prompt active';
    const groups = { main: [], card: [], free: [], end: [], other: [] };
    for (const o of p.options) (groups[o.group] || groups.other).push(o);
    const btn = (o, cls = '') => `<button class="opt ${cls} ${o.disabled ? 'off' : ''}" data-v="${esc(o.value)}" ${o.disabled ? `title="${esc(o.reason || '')}"` : ''}>${esc(o.label)}</button>`;
    let html = `<div class="p-title">${esc(p.title)}</div><div class="p-opts">`;
    if (p.kind === 'turn') {
      if (groups.main.length) html += `<div class="p-group"><span class="p-gl">주요 행동</span>${groups.main.map((o) => btn(o, 'main')).join('')}</div>`;
      if (groups.card.length) html += `<div class="p-group"><span class="p-gl">카드 사용</span>${groups.card.map((o) => btn(o, 'cardopt')).join('')}</div>`;
      if (groups.free.length) html += `<div class="p-group"><span class="p-gl">⚡ 자유 행동</span>${groups.free.map((o) => btn(o, 'freeopt')).join('')}</div>`;
      html += `<div class="p-group end">${groups.end.map((o) => btn(o, o.value === 'pass' ? 'pass' : 'endbtn')).join('')}</div>`;
    } else html += p.options.map((o) => btn(o, o.value === 'cancel' ? 'cancel' : '')).join('');
    html += '</div>';
    const fresh = box._html !== html;
    setHTML(box, html);
    if (fresh) box.classList.remove('pop'), void box.offsetWidth, box.classList.add('pop');
    for (const b of box.querySelectorAll('button[data-v]')) {
      const o = p.options.find((x) => x.value === b.dataset.v);
      b.onclick = () => {
        const cur = app.prompt && app.prompt.options && app.prompt.options.find((x) => x.value === b.dataset.v);
        if (!cur) return;
        if (cur.disabled) { toast(cur.reason || '지금은 할 수 없어요'); return; }
        if (cur.value === 'pass' && !confirm('이번 라운드를 패스할까요? 이번 라운드에는 더 이상 차례가 오지 않아요.')) return;
        answer(cur.value);
      };
      const desc = optionDesc(o, p, st, me() || {});
      if (desc) {
        b.onmouseenter = (e) => showTip(e, desc + (o.disabled && o.reason ? `<div class="tip-warn">🚫 지금 못 하는 이유: ${esc(o.reason)}</div>` : ''));
        b.onmousemove = moveTip;
        b.onmouseleave = hideTip;
      }
    }
  }
  setHTML($('#hint'), `💡 ${promptHint(p, st, me() || {})}`);
}

// 지도 좌표 (%)
const SITE_POS = {
  l2a: [21.5, 17], l2b: [41.5, 17], l2c: [61.5, 17], l2d: [81.5, 17],
  l1a: [21.5, 50], l1b: [41.5, 50], l1c: [61.5, 50], l1d: [81.5, 50],
  b1: [17.5, 83], b2: [34.5, 83], b3: [51.5, 83], b4: [68.5, 83], b5: [85.5, 83],
};

function boardBackground() {
  return `<svg class="board-bg" viewBox="0 0 1000 560" preserveAspectRatio="none">
    <defs>
      <linearGradient id="jg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a4228"/><stop offset=".55" stop-color="#3a5e30"/><stop offset="1" stop-color="#5a6a3a"/></linearGradient>
      <radialGradient id="glow" cx="50%" cy="0%" r="70%"><stop offset="0" stop-color="#f0d890" stop-opacity=".35"/><stop offset="1" stop-color="#f0d890" stop-opacity="0"/></radialGradient>
      <pattern id="leaf" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M10 50c10-20 25-25 40-30-12 12-20 22-40 30z" fill="#1e3a1c" opacity=".35"/><path d="M40 10c-8 10-6 20 4 28-2-12 0-18-4-28z" fill="#4a7a3a" opacity=".25"/></pattern>
      <linearGradient id="band" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    </defs>
    <rect width="1000" height="560" fill="url(#jg)"/><rect width="1000" height="560" fill="url(#leaf)"/><rect width="1000" height="560" fill="url(#glow)"/>
    <path d="M0 515 C 180 480, 260 550, 420 525 S 700 480, 1000 530 L1000 560 L0 560z" fill="#2f6a8a" opacity=".55"/>
    <rect x="0" y="0" width="95" height="560" fill="url(#band)"/>
    <g stroke="#e8d8a0" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round" fill="none" opacity=".5">
      <path d="M175 430 C 190 380, 215 340, 215 330"/><path d="M515 430 C 490 380, 420 340, 415 330"/><path d="M515 430 C 545 380, 610 340, 615 330"/><path d="M855 430 C 840 380, 815 340, 815 330"/>
      <path d="M215 220 L 215 150"/><path d="M415 220 L 415 150"/><path d="M615 220 L 615 150"/><path d="M815 220 L 815 150"/>
    </g>
    <g font-size="17" font-weight="800" fill="#f3e6c4" text-anchor="middle" style="paint-order:stroke;stroke:#000a;stroke-width:4px">
      <text transform="translate(44 95) rotate(-90)">⛰ 2단계</text><text transform="translate(70 95) rotate(-90)" font-size="12" font-weight="600">나침반 6</text>
      <text transform="translate(44 280) rotate(-90)">🌴 1단계</text><text transform="translate(70 280) rotate(-90)" font-size="12" font-weight="600">나침반 3</text>
      <text transform="translate(44 465) rotate(-90)">🏕 기본</text><text transform="translate(70 465) rotate(-90)" font-size="12" font-weight="600">바로 발굴</text>
    </g>
  </svg>`;
}

function renderBoard() {
  const st = app.state;
  const pm = promptMap();
  const colorOf = (pid) => app.catalog.colors[st.order.indexOf(pid)];
  const lvName = ['기본', '1단계', '2단계'];
  let html = boardBackground();
  for (const s of st.sites) {
    const [x, y] = SITE_POS[s.id];
    const can = pm.site[s.id] != null;
    const occ = s.occupants.map((pid) => `<span class="meeple" data-k="${s.id}:${pid}:${st.round}" title="${esc(st.players.find((p) => p.id === pid).name)}">${ico('ic-arch', 26, '', `color:${colorOf(pid)}`)}</span>`).join('');
    let body;
    if (!s.discovered) {
      body = `<div class="st-name unk">❓ 미탐사 유적</div>
        <div class="st-disc">${ico('res-compass', 18)}<b>${s.compass}</b> + ${travelHTML(s.travel, 18)}</div>
        <div class="st-idol">${s.idol ? `${ico('ic-idol', 22)} <span>우상</span>` : ''}</div>`;
    } else {
      body = `<div class="st-name">${esc(s.name)}</div><div class="st-reward">${resHTML(s.reward, 20)}</div>`;
    }
    const guard = s.guardian ? `<div class="st-guard" data-k="${s.id}:${s.guardian.id}" title="제압 비용: ${esc(Object.entries(s.guardian.cost).map(([k, n]) => `${app.catalog.resNames[k]} ${n}`).join(', '))}"><span class="g-art">${GUARDIAN_ART[s.guardian.id] || '👹'}</span><span class="g-txt"><b>${esc(s.guardian.name)}</b><span class="g-cost">제압: ${resHTML(s.guardian.cost, 15)}</span></span></div>` : '';
    html += `<div class="site lv${s.level} ${s.discovered ? 'open' : 'closed'} ${can ? 'can' : ''} ${s.guardian ? 'guarded' : ''}" style="left:${x}%;top:${y}%" data-site="${s.id}">
      <div class="st-head"><span class="st-lv">${lvName[s.level]}</span>${s.discovered ? `<span class="st-travel" title="이동 비용">${travelHTML(s.travel, 18)}</span>` : ''}</div>
      ${body}${guard}<div class="st-occ">${occ}</div></div>`;
  }
  const board = $('#board');
  if (!setHTML(board, html)) return;
  for (const el of board.querySelectorAll('.site')) {
    const key = `${el.dataset.site}:${el.classList.contains('open') ? 'open' : 'closed'}`;
    if (!app.seen.sites[key]) {
      // 처음 그릴 때는 부드럽게 등장, 게임 중에 새로 탐사된 유적은 뒤집히며 공개
      const revealed = el.classList.contains('open') && !el.classList.contains('lv0') && app.seen.sites[`${el.dataset.site}:closed`];
      app.seen.sites[key] = true;
      el.classList.add(revealed ? 'reveal' : 'enter');
    }
  }
  animateNew(board, '.meeple', (el) => el.dataset.k, app.seen.occ, 'drop');
  animateNew(board, '.st-guard', (el) => el.dataset.k, app.seen.guard, 'appear');
  for (const el of board.querySelectorAll('.site')) {
    const id = el.dataset.site;
    el.onclick = () => { if (pm.site[id] != null) answer(pm.site[id]); };
    el.onmouseenter = (e) => showTip(e, siteTip(st.sites.find((s) => s.id === id)));
    el.onmousemove = moveTip;
    el.onmouseleave = hideTip;
  }
}

function siteTip(s) {
  const parts = [];
  if (!s.discovered) {
    parts.push(`<b>미탐사 ${s.level}단계 유적</b>`, `탐사 비용: 나침반 ${s.compass} + 이동 ${travelHTML(s.travel, 15)}`, '탐사하면: 우상(즉시 보너스 + 3점) + 유적 자원, 그리고 수호자가 나타나요.');
  } else {
    parts.push(`<b>${esc(s.name)}</b> (${['기본', '1단계', '2단계'][s.level]} 유적)`, `이동 비용: ${travelHTML(s.travel, 15)}`, `발굴하면: ${resHTML(s.reward, 15)}`);
  }
  if (s.guardian) {
    const b = s.guardian.boon;
    const boon = b.kind === 'gain' ? resHTML(b.res, 14) : b.kind === 'draw' ? `카드 ${b.n}장` : b.kind === 'research' ? '연구 1칸 (무료)' : '카드 1장 추방';
    parts.push(`<span style="color:#ffb090">⚔ 수호자 「${esc(s.guardian.name)}」</span>`, `제압 비용: ${resHTML(s.guardian.cost, 14)} → 5점 + 혜택: ${boon}`, '<span class="hint">라운드가 끝날 때 여기 남은 고고학자는 두려움 카드를 받아요.</span>');
  }
  if (s.occupants.length) parts.push('<span class="hint">이미 고고학자가 있어서 다른 사람은 이번 라운드에 들어갈 수 없어요.</span>');
  return parts.join('<br>');
}

function renderRow() {
  const st = app.state;
  const pm = promptMap();
  let html = '';
  st.row.forEach((c, i) => {
    if (i === st.staff) html += `<div class="staff" title="달 지팡이: 왼쪽은 유물, 오른쪽은 물건">${ico('ic-moon', 26)}<span></span></div>`;
    const can = pm.slot[i] != null;
    html += `<div class="slot ${i < st.staff ? 'art' : 'itm'}">${cardHTML(c, { cls: can ? 'can' : '', attrs: `data-slot="${i}"` })}</div>`;
  });
  if (st.staff >= st.row.length) html += `<div class="staff">${ico('ic-moon', 26)}<span></span></div>`;
  const row = $('#card-row');
  if (!setHTML(row, html)) return;
  animateNew(row, '.card[data-uid]', (el) => el.dataset.uid, app.seen.row, 'enter');
  for (const el of row.querySelectorAll('[data-slot]')) {
    el.onclick = () => { const v = pm.slot[el.dataset.slot]; if (v != null) answer(v); };
  }
  attachCardTips(row);
}

function trackData() {
  const st = app.state;
  const c = app.catalog;
  return { rows: (st && st.researchRows) || c.research, glassVP: (st && st.glassVP) || c.glassVP, noteVP: (st && st.noteVP) || c.noteVP, snake: st && st.track === 'snake' };
}

function renderResearch() {
  const st = app.state;
  const c = { ...app.catalog, research: trackData().rows, glassVP: trackData().glassVP, noteVP: trackData().noteVP };
  const colorOf = (pid) => c.colors[st.order.indexOf(pid)];
  const rewardLabel = (r) => {
    if (!r) return '';
    if (r.kind === 'gain') return resHTML(r.res, 15);
    if (r.kind === 'assistant') return `${ico('ic-assist', 16)} 조수`;
    if (r.kind === 'upgrade') return `${ico('ic-assist', 16)} 조수 강화`;
    if (r.kind === 'temple') return '🏛 신전 도착 보너스';
    return '';
  };
  let rows = '';
  for (let r = 7; r >= 0; r--) {
    const row = c.research[r];
    const tokens = st.order.map((pid) => {
      const p = st.ps[pid];
      return `${p.glass === r ? `<span class="tok" title="${esc(st.players.find((x) => x.id === pid).name)}의 돋보기" style="--pc:${colorOf(pid)}">${ico('ic-glass', 18)}</span>` : ''}${p.note === r ? `<span class="tok" title="${esc(st.players.find((x) => x.id === pid).name)}의 수첩" style="--pc:${colorOf(pid)}">${ico('ic-note', 18)}</span>` : ''}`;
    }).join('');
    rows += `<div class="rr ${r === 7 ? 'temple' : ''}" data-row="${r}">
      <div class="rr-n">${r === 7 ? ico('ic-temple', 20) : r === 0 ? '출발' : r}</div>
      <div class="rr-body"><span class="rr-cost" title="이 줄로 올라오는 비용">${r ? resHTML(row.cost, 14) : '<span class="hint">시작</span>'}</span>${row.reward ? `<span class="rr-rew" title="처음 도착하면 받는 보상">→ ${rewardLabel(row.reward)}</span>` : ''}</div>
      <div class="rr-vp" title="게임 끝 점수: 돋보기 / 수첩">${c.glassVP[r]}<span>/${c.noteVP[r]}</span></div>
      <div class="rr-tok">${tokens}</div></div>`;
  }
  const temple = c.temple.map((t) => `<span class="tt" title="${resText(t.cost)} → ${t.vp}점 (남은 ${st.templeSupply[t.id] ?? 0}장)">${t.vp}점 ${resHTML(t.cost, 12)}</span>`).join('');
  const offer = st.assistantOffer.map((id) => { const a = c.assistants[id]; return `<div class="as-card" data-as="${id}">${ico('ic-assist', 18)}<b>${esc(a.name)}</b><span>${resHTML(a.base, 13)}</span></div>`; }).join('');
  const rhtml = `${trackData().snake ? '<div class="track-badge">🐍 뱀 신전 (어려운 면)</div>' : ''}<div class="r-title" title="줄마다: 올라오는 비용 → 처음 도착 보상 · 오른쪽 숫자는 게임 끝 점수(돋보기/수첩)">🔍 연구 트랙 <span class="hint">비용 → 보상 · 점수</span></div>
    <div class="temple-tiles" title="돋보기가 신전에 도착한 뒤 살 수 있어요"><span class="hint">🏛 신전 타일</span>${temple}</div>
    <div class="r-rows">${rows}</div>
    <div class="r-title small">👤 고용 가능한 조수 <span class="hint">(연구 2·5줄에서 1명씩)</span></div><div class="as-offer">${offer || '<span class="hint">없음</span>'}</div>`;
  if (!setHTML($('#research'), rhtml)) return;
  for (const el of $('#research').querySelectorAll('.rr')) {
    const r = Number(el.dataset.row);
    el.onmouseenter = (e) => showTip(e, researchTip(r));
    el.onmousemove = moveTip;
    el.onmouseleave = hideTip;
  }
  for (const el of $('#research').querySelectorAll('.as-card')) {
    const a = c.assistants[el.dataset.as];
    el.onmouseenter = (e) => showTip(e, `<b>👤 ${esc(a.name)}</b><br>라운드마다 1번(자유 행동): ${resHTML(a.base, 14)} ${a.base.exile ? '카드 추방' : ''}<br>업그레이드하면: ${resHTML(a.up, 14)} ${a.up.exile ? '카드 추방' : ''}<br><span class="hint">연구 트랙 2줄·5줄에 처음 도착하면 이 중 한 명을 고용해요. 4줄에 도착하면 조수 한 명을 업그레이드해요.</span>`);
    el.onmousemove = moveTip;
    el.onmouseleave = hideTip;
  }
}

function researchTip(r) {
  const c = { ...app.catalog, research: trackData().rows, glassVP: trackData().glassVP, noteVP: trackData().noteVP };
  const row = c.research[r];
  const rw = row.reward;
  const rewardText = !rw ? '' : rw.kind === 'gain' ? `자원 ${resHTML(rw.res, 14)}` : rw.kind === 'assistant' ? '조수 1명 고용 (라운드마다 1번 쓰는 능력)' : rw.kind === 'upgrade' ? '조수 1명 업그레이드 (더 강한 능력, 이번 라운드 다시 사용 가능). 조수가 없으면 나침반 2' : '돋보기 도착 순서대로 6 / 4 / 2 / 1점, 이후 신전 타일 구매 가능';
  if (!r) return '<b>출발</b><br>모든 탐험가의 돋보기와 수첩이 여기서 시작해요.';
  return `<b>${r === 7 ? '🏛 신전' : `연구 ${r}줄`}</b><br>올라오는 비용: ${resHTML(row.cost, 14)}<br>처음 도착 보상: ${rewardText}<br>게임 끝 점수: 돋보기 <b>${c.glassVP[r]}</b>점 · 수첩 <b>${c.noteVP[r]}</b>점<br><span class="hint">돋보기와 수첩은 각각 따로 보상을 받아요. 수첩은 돋보기보다 위로 갈 수 없어요.</span>`;
}

function resText(r) { return Object.entries(r).filter(([, n]) => n).map(([k, n]) => `${app.catalog.resNames[k]} ${n}`).join(' + '); }
function rewardPlain(r) { return Object.entries(r).filter(([, n]) => n).map(([k, n]) => (k === 'draw' ? `카드 ${n}장` : k === 'exile' ? '카드 추방' : `${app.catalog.resNames[k]} ${n}`)).join(' + '); }

function renderPlayers() {
  const st = app.state;
  const c = app.catalog;
  const phtml = st.order.map((pid, i) => {
    const pl = st.players.find((x) => x.id === pid);
    const p = st.ps[pid];
    const color = c.colors[i];
    const guards = p.guardians.map((g) => `<span class="mini-g ${g.used ? 'used' : ''}" title="${esc(c.guardians[g.id].name)}${g.used ? ' (혜택 사용함)' : ''}">${GUARDIAN_ART[g.id]}</span>`).join('');
    const assists = p.assistants.map((a) => `<span class="mini-a ${a.used ? 'used' : ''} ${a.up ? 'up' : ''}" title="${esc(c.assistants[a.id].name)}: ${esc(rewardPlain(a.up ? c.assistants[a.id].up : c.assistants[a.id].base))}${a.used ? ' (이번 라운드 사용함)' : ''}">${ico('ic-assist', 15)}${esc(c.assistants[a.id].name.split(' ')[1] || '')}</span>`).join('');
    const s = p.score;
    return `<div class="pl ${st.current === pid ? 'turn' : ''} ${p.passed ? 'passed' : ''}" data-pid="${pid}" style="--pc:${color}">
      <div class="pl-head"><span class="dot" style="background:${color}"></span>${p.leader ? `<span class="pl-leader" title="${esc(c.leaders.find((l) => l.id === p.leader).name)}: ${esc(c.leaders.find((l) => l.id === p.leader).desc)}">${c.leaders.find((l) => l.id === p.leader).icon}</span>` : ''}<b>${esc(pl.name)}</b>${pid === app.you ? ' <span class="hint">(나)</span>' : ''}${pl.bot ? ' <span class="tag">AI</span>' : ''}${st.first === pid ? ' <span class="tag first" title="이번 라운드 선 플레이어">선</span>' : ''}
        <span style="flex:1"></span>${p.passed ? '<span class="tag">패스</span>' : ''}<span class="pl-vp" title="연구 ${s.research} · 신전 ${s.temple} · 우상 ${s.idols} · 수호자 ${s.guardians} · 카드 ${s.cards} · 두려움 ${s.fear}">${ico('ic-vp', 16)}${s.total}</span></div>
      <div class="pl-res">${['coin', 'compass', 'tablet', 'arrow', 'gem'].map((k) => `<span>${ico(RES_ICON[k], 16)}${p.res[k]}</span>`).join('')}<span title="남은 고고학자">${ico('ic-arch', 16, '', `color:${color}`)}${p.arch}</span></div>
      <div class="pl-more"><span title="손패 / 덱 / 버림">🃏 ${p.handCount} · 덱 ${p.deckCount} · 버림 ${p.discardCount}</span><span title="우상 (안 쓴 것 / 판에 놓은 것)">${ico('ic-idol', 15)}${p.idols}${p.idolSlots ? `+${p.idolSlots}` : ''}</span>${p.temple.length ? `<span>🏛${p.temple.length}</span>` : ''}</div>
      ${guards || assists ? `<div class="pl-extra">${guards}${assists}</div>` : ''}
    </div>`;
  }).join('');
  if (!setHTML($('#players'), phtml)) return;
  for (const el of $('#players').querySelectorAll('.pl-vp')) {
    const pid = el.closest('.pl').dataset.pid;
    const sc = st.ps[pid].score;
    el.removeAttribute('title');
    el.onmouseenter = (e) => showTip(e, `<b>지금 점수 ${sc.total}점</b><table class="tip-tbl"><tr><td>🔍 연구 트랙</td><td>${sc.research}</td></tr><tr><td>🏛 신전</td><td>${sc.temple}</td></tr><tr><td>🗿 우상</td><td>${sc.idols}</td></tr><tr><td>⚔ 수호자</td><td>${sc.guardians}</td></tr><tr><td>🃏 카드 ★</td><td>${sc.cards}</td></tr><tr><td>😱 두려움</td><td>${sc.fear}</td></tr></table>`);
    el.onmousemove = moveTip;
    el.onmouseleave = hideTip;
  }
}

function renderMine() {
  const st = app.state;
  const p = me();
  if (!p) return;
  const pm = promptMap();
  if (setHTML($('#my-title'), `내 탐험대 <span class="hint">덱 ${p.deckCount}장 · 버림 ${p.discardCount}장</span> <button class="small" id="btn-deck">📚 내 카드 전체 보기</button>`)) $('#btn-deck').onclick = showDeck;
  const c = app.catalog;
  const extras = [];
  if (p.leader) { const l = c.leaders.find((x) => x.id === p.leader); extras.push(`<span class="ex leader-ex ${l.power && p.leaderUsed ? 'used' : ''}" title="${esc(l.desc)}">${l.icon} ${esc(l.name)}: ${esc(l.desc.split('.')[0])}${l.power && p.leaderUsed ? ' (이번 라운드 사용함)' : ''}</span>`); }
  if (p.idols || p.idolSlots) extras.push(`<span class="ex">${ico('ic-idol', 18)} 우상 ${p.idols}개${p.idolSlots ? ` (판에 ${p.idolSlots})` : ''}${p.idolUsedRound ? ' · 이번 라운드 사용함' : ''}</span>`);
  for (const a of p.assistants) { const ad = c.assistants[a.id]; extras.push(`<span class="ex ${a.used ? 'used' : ''}">${ico('ic-assist', 18)} ${esc(ad.name)}${a.up ? '⭐' : ''}: ${resHTML(a.up ? ad.up : ad.base, 14)}${a.used ? ' (사용함)' : ''}</span>`); }
  p.guardians.forEach((g) => { const gd = c.guardians[g.id]; const b = gd.boon; extras.push(`<span class="ex ${g.used ? 'used' : ''}">${GUARDIAN_ART[g.id]} ${esc(gd.name)} 혜택: ${b.kind === 'gain' ? resHTML(b.res, 14) : b.kind === 'draw' ? `카드 ${b.n}장` : b.kind === 'research' ? '연구 1칸' : '추방'}${g.used ? ' (사용함)' : ''}</span>`); });
  setHTML($('#my-extras'), extras.join(''));
  const handChanged = setHTML($('#hand'), (p.hand || []).map((cd) => cardHTML(cd, { cls: pm.card[cd.uid] != null ? 'can' : '' })).join('') || '<span class="hint">손패가 없어요</span>');
  if (handChanged) animateNew($('#hand'), '.card[data-uid]', (el) => el.dataset.uid, app.seen.hand, 'enter');
  setHTML($('#play'), p.play.length ? `<span class="hint">이번 라운드에 쓴 카드:</span> ${p.play.map((cd) => `<span class="chip" data-cid="${cd.id}">${CARD_ART[cd.id] || '🃏'} ${esc(app.catalog.cards[cd.id].name)}</span>`).join('')}` : '');
  for (const el of document.querySelectorAll('#play .chip')) {
    const c = app.catalog.cards[el.dataset.cid];
    el.onmouseenter = (e) => showTip(e, `<b>${esc(c.name)}</b><br>${esc(c.text)}`);
    el.onmousemove = moveTip;
    el.onmouseleave = hideTip;
  }
  for (const el of document.querySelectorAll('#hand .card')) {
    el.onclick = () => {
      const v = pm.card[el.dataset.uid];
      if (v != null) answer(v);
      else if (app.prompt && app.prompt.kind === 'turn') {
        const o = app.prompt.options.find((x) => x.card === el.dataset.uid);
        toast(o && o.disabled ? o.reason : '이 카드는 지금 쓸 수 없어요. (이동 비용으로 버릴 때 쓰여요)');
      }
    };
  }
  attachCardTips($('#hand'));
}

function showDeck() {
  const p = me();
  const list = (p.deckList || []).slice().sort((a, b) => a.id.localeCompare(b.id));
  $('#modal .modal-inner').innerHTML = `<h2>📚 내 덱과 버림 더미 (${list.length}장)</h2><p class="hint">손패와 이번 라운드에 쓴 카드를 뺀 나머지 카드예요. 순서는 섞여 있어요.</p>
    <div class="cards-grid">${list.map((cd) => cardHTML(cd)).join('')}</div><div class="actions"><button class="primary" id="deck-close">닫기</button></div>`;
  $('#modal').classList.remove('hidden');
  $('#modal').dataset.mode = 'deck';
  $('#deck-close').onclick = () => { $('#modal').classList.add('hidden'); $('#modal').dataset.mode = ''; };
}

// ───────────── 카드 고르기 창 (이동 비용 / 추방) ─────────────
function travelCheck(cost, uids) {
  const have = { boot: 0, car: 0, ship: 0, plane: 0 };
  const hand = me().hand;
  for (const u of uids) { const cd = hand.find((x) => x.uid === u); const t = cd && app.catalog.cards[cd.id].travel; if (t) have[t]++; }
  const need = { boot: cost.boot || 0, car: cost.car || 0, ship: cost.ship || 0, plane: cost.plane || 0 };
  const useShip = Math.min(need.ship, have.ship);
  const useCar = Math.min(need.car, have.car);
  const useBootB = Math.min(need.boot, have.boot);
  const useBootC = Math.min(need.boot - useBootB, have.car - useCar);
  let unmet = (need.ship - useShip) + (need.car - useCar) + (need.boot - useBootB - useBootC) + need.plane;
  unmet -= Math.min(unmet, have.plane);
  const coins = unmet * 2;
  return { ok: coins <= me().res.coin, coins };
}

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
  const all = [...hand, ...(me().play || [])];
  const cards = p.cards.map((u) => all.find((x) => x.uid === u)).filter(Boolean);
  let status = '';
  let ok = true;
  if (p.pay) {
    const chk = travelCheck(p.pay, app.sel);
    ok = chk.ok;
    status = `<div class="pay-status ${ok ? 'ok' : 'bad'}">필요한 이동: ${travelHTML(p.pay, 22)} &nbsp;→&nbsp; ${ok ? `✔ 낼 수 있어요${chk.coins ? ` (모자란 비행기는 동전 ${chk.coins}개로)` : ''}` : `✖ 아직 모자라요${chk.coins ? ` (동전이 ${chk.coins}개 필요한데 ${me().res.coin}개뿐)` : ''}`}</div>`;
  } else {
    ok = app.sel.length >= (p.min || 0) && app.sel.length <= p.max;
  }
  modal.querySelector('.modal-inner').innerHTML = `<h2>${esc(p.title)}</h2>${status}
    <div class="cards-grid">${cards.map((cd) => cardHTML(cd, { cls: `pick ${app.sel.includes(cd.uid) ? 'sel' : ''}` })).join('')}</div>
    <div class="actions">${p.cancel ? '<button id="cm-cancel" class="small">취소</button>' : ''}${p.kind === 'exile' ? '<button id="cm-skip" class="small">추방하지 않기</button>' : ''}<button id="cm-ok" class="primary" ${ok ? '' : 'disabled'}>${p.kind === 'exile' ? '추방하기' : '이 카드로 내기'}</button></div>`;
  modal.classList.remove('hidden');
  for (const el of modal.querySelectorAll('.card.pick')) {
    el.onclick = () => {
      const u = el.dataset.uid;
      if (app.sel.includes(u)) app.sel = app.sel.filter((x) => x !== u);
      else { if (p.max === 1) app.sel = []; app.sel.push(u); }
      renderCardModal();
    };
  }
  $('#cm-ok').onclick = () => answer(app.sel.slice());
  const cc = $('#cm-cancel');
  if (cc) cc.onclick = () => answer(null);
  const sk = $('#cm-skip');
  if (sk) sk.onclick = () => answer([]);
}

// ───────────── 기록 / 결과 ─────────────
function renderLog() {
  const st = app.state;
  const colorOf = (pid) => app.catalog.colors[st.order.indexOf(pid)];
  const el = $('#log');
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  const changed = setHTML(el, st.log.map((l) => `<div class="lg ${l.text.startsWith('══') ? 'round' : ''} ${l.text.startsWith('▶') ? 'turnline' : ''}" style="${l.pid ? `--pc:${colorOf(l.pid)}` : ''}">${esc(l.text)}</div>`).join(''));
  if (!changed) return;
  if (atBottom || !renderLog.init) el.scrollTop = el.scrollHeight;
  renderLog.init = true;
}

function renderTabs() {
  for (const b of document.querySelectorAll('.tabs [data-tab]')) b.classList.toggle('on', b.dataset.tab === app.tab);
  $('#log').classList.toggle('hidden', app.tab !== 'log');
  $('#chat').classList.toggle('hidden', app.tab !== 'chat');
}

function onNewLogs(first) {
  const st = app.state;
  const fresh = st.log.filter((l) => l.seq > app.lastLog);
  app.lastLog = st.log.length ? st.log[st.log.length - 1].seq : 0;
  if (first) return;
  for (const l of fresh.slice(-3)) {
    const t = l.text;
    if (t.includes('라운드 시작')) Sound.play('phase');
    else if (t.includes('새 유적')) Sound.play('explore');
    else if (t.includes('제압!')) Sound.play('destroy');
    else if (t.includes('두려움 카드를 받')) Sound.play('fear');
    else if (t.includes('에서 발굴')) Sound.play('land');
    else if (t.includes('구매')) Sound.play('build');
    else if (t.includes('사용 —')) Sound.play('cardPlay');
    else if (t.includes('연구') || t.includes('올렸습니다')) Sound.play('presence');
    else if (t.includes('게임 종료')) Sound.play(st.result && st.result.winner === app.you ? 'victory' : 'defeat');
  }
}

function renderResult() {
  const st = app.state;
  const box = $('#result');
  if (!st.result || app.hideResult) { box.classList.add('hidden'); return; }
  const rows = st.result.scores.map((s, i) => `<tr class="${s.pid === app.you ? 'me' : ''}"><td>${i === 0 ? '🏆' : i + 1}</td><td><b>${esc(s.name)}</b></td><td>${s.research}</td><td>${s.temple}</td><td>${s.idols}</td><td>${s.guardians}</td><td>${s.cards}</td><td>${s.fear}</td><td class="tot">${s.total}</td></tr>`).join('');
  const isHost = app.room && app.room.hostId === app.you;
  box.querySelector('.modal-inner').innerHTML = `<h2>🏆 탐험 종료 — ${esc(st.result.scores[0].name)} 승리!</h2>
    <table class="score-tbl"><tr><th></th><th>탐험가</th><th>🔍 연구</th><th>🏛 신전</th><th>🗿 우상</th><th>⚔ 수호자</th><th>🃏 카드</th><th>😱 두려움</th><th>합계</th></tr>${rows}</table>
    <div class="actions"><button class="small" id="res-close">지도 보기</button>${isHost ? '<button class="primary" id="res-rematch">🔁 바로 다시 하기</button><button class="small" id="res-lobby">⚙ 대기실에서 설정 바꾸기</button>' : '<span class="hint">방장이 "바로 다시 하기"를 누르면 같은 구성으로 새 판이 시작돼요</span>'}<button class="small" id="res-leave">나가기</button></div>`;
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
  const x = Math.min(e.clientX + 16, window.innerWidth - t.offsetWidth - 8);
  const y = Math.min(e.clientY + 16, window.innerHeight - t.offsetHeight - 8);
  t.style.left = x + 'px'; t.style.top = y + 'px';
}
function hideTip() { $('#tip').classList.add('hidden'); app.tipOwner = null; }
function attachCardTips(root) {
  for (const el of root.querySelectorAll('.card[data-cid]')) {
    const c = app.catalog.cards[el.dataset.cid];
    if (!c) continue;
    el.onmouseenter = (e) => showTip(e, `<b>${CARD_ART[c.id] || ''} ${esc(c.name)}</b> <span class="hint">(${KIND_NAME[c.kind]}${c.cost ? ` · ${c.kind === 'item' ? '동전' : '나침반'} ${c.cost}개로 구매` : ''})</span>
      <div class="tip-body">${c.free ? '<b class="free">⚡ 자유 행동</b> — 주요 행동과 별개로 쓸 수 있어요.<br>' : ''}${esc(c.text.replace(/^⚡ /, ''))}</div>
      <div class="tip-meta">${c.travel ? `이동 아이콘 ${ico(TRAVEL_ICON[c.travel], 16)} ${app.catalog.travelNames[c.travel]} — 발굴·탐사 때 이 카드를 버려 이 비용을 낼 수 있어요.<br>` : ''}게임 끝 점수 ★${c.vp}${c.kind === 'artifact' ? '<br>유물: 사자마자 공짜로 한 번 사용할 수 있어요.' : ''}${c.kind === 'item' ? '<br>물건: 사면 덱 맨 아래로 들어가요.' : ''}</div>${cardAdvice(c)}`);
    el.onmousemove = moveTip;
    el.onmouseleave = hideTip;
  }
}

// ───────────── 설정 (소리 · 글자 크기) ─────────────
function applyFontScale(v) {
  document.documentElement.style.setProperty('--fs', String(v));
  try { localStorage.setItem('arnak-fs', String(v)); } catch { /* 무시 */ }
  for (const b of document.querySelectorAll('.fs-btn')) b.classList.toggle('on', Number(b.dataset.fs) === Number(v));
  // 글자 크기가 바뀌면 캐시를 비워 다시 그린다
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
function initSound() {
  let fs = 1;
  try { fs = Number(localStorage.getItem('arnak-fs')) || 1; } catch { /* 무시 */ }
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
  // 곡이 바뀌면 화면 구석에 곡 이름을 잠깐 보여 준다
  Sound.onTrack = (t) => {
    renderTrackInfo();
    if (!Sound.settings.musicOn) return;
    const el = $('#now-playing-toast');
    el.textContent = `♪ ${t.name}`;
    el.classList.remove('hidden', 'show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(initSound.npTimer);
    initSound.npTimer = setTimeout(() => el.classList.add('hidden'), 4200);
  };
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (Guide.isOpen()) Guide.close();
    else if (!$('#sound-panel').classList.contains('hidden')) $('#sound-panel').classList.add('hidden');
    else if ($('#modal').dataset.mode === 'deck') $('#deck-close').click();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initHome();
  initSound();
  connect();
});
