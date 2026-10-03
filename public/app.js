'use strict';
/* 정령섬 온라인 — 브라우저 클라이언트 (빌드 도구 없이 동작하는 순수 JS) */

const TERRAIN_COLOR = { M: '#9aa0a7', J: '#3f9a46', S: '#e2c681', W: '#5aaba3' };
const elRep = (e, n, size = 14) => Array.from({ length: n }, () => elIcon(e, size)).join('');
const FILTER_NAME = {
  any: '아무 지역', dahan: '다한이 있는 지역', invaders: '침략자가 있는 지역', noinvaders: '침략자가 없는 지역',
  blight: '황폐가 있는 지역', noblight: '황폐가 없는 지역', coastal: '해안 지역', inland: '내륙 지역',
};
const PHASE_NAME = { setup: '준비', growth: '정령 단계 (성장·카드 선택)', fast: '빠른 권능', invader: '침략자 단계', slow: '느린 권능', time: '시간 흐름', end: '게임 종료' };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const app = {
  ws: null,
  token: sessionStorage.getItem('si-token') || null,
  catalog: null,
  room: null,
  you: null,
  state: null,
  prompt: null,
  tab: null,
  sidePane: 'log',
  modal: { promptId: null, selected: [], hidden: false },
  resultDismissed: false,
  chatSeen: 0,
  retry: 0,
};

// ───────────── 연결 ─────────────
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}`);
  app.ws = ws;
  ws.onopen = () => {
    app.retry = 0;
    $('#conn-status').textContent = '서버에 연결되었습니다.';
    $('#conn-status').classList.add('ok');
    send({ t: 'hello', token: app.token });
  };
  ws.onmessage = (ev) => onMessage(JSON.parse(ev.data));
  ws.onclose = () => {
    $('#conn-status').textContent = '연결이 끊어졌습니다. 다시 연결 중...';
    $('#conn-status').classList.remove('ok');
    if (app.room) toast('서버 연결이 끊어졌습니다. 재연결 중...');
    setTimeout(connect, Math.min(5000, 500 * 2 ** app.retry++));
  };
}

function send(msg) {
  if (app.ws && app.ws.readyState === 1) app.ws.send(JSON.stringify(msg));
}

function onMessage(msg) {
  switch (msg.t) {
    case 'welcome':
      app.token = msg.token;
      sessionStorage.setItem('si-token', msg.token);
      app.catalog = msg.catalog;
      app.lan = msg.lan || [];
      break;
    case 'room':
      app.room = msg.room;
      app.you = msg.you;
      if (!msg.room.started) { app.state = null; app.prompt = null; app.resultDismissed = false; }
      render();
      break;
    case 'state':
      app.state = msg.state;
      app.prompt = msg.prompt;
      app.you = msg.you;
      render();
      break;
    case 'left':
      app.room = null; app.state = null; app.prompt = null;
      render();
      break;
    case 'error':
      toast(msg.msg);
      break;
    default:
  }
}

function answer(value) {
  if (!app.prompt) return;
  send({ t: 'answer', promptId: app.prompt.id, value });
}

// ───────────── 화면 전환 ─────────────
function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
}

function render() {
  if (!app.room) { showScreen('screen-home'); return; }
  if (!app.room.started || !app.state) { showScreen('screen-room'); renderRoom(); return; }
  showScreen('screen-game');
  renderGame();
}

// ───────────── 홈 ─────────────
function initHome() {
  const name = localStorage.getItem('si-name') || '';
  $('#in-name').value = name;
  const params = new URLSearchParams(location.search);
  if (params.get('room')) $('#in-code').value = params.get('room').toUpperCase();
  const saveName = () => localStorage.setItem('si-name', $('#in-name').value.trim());
  $('#btn-create').onclick = () => { saveName(); send({ t: 'create', name: $('#in-name').value }); };
  $('#btn-join').onclick = () => {
    saveName();
    const code = $('#in-code').value.trim();
    if (code.length !== 4) { toast('4자리 방 코드를 입력하세요.'); return; }
    send({ t: 'join', code, name: $('#in-name').value });
  };
  $('#in-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-join').click(); });
}

// ───────────── 대기실 ─────────────
function renderRoom() {
  const r = app.room;
  const c = app.catalog;
  if (!c) return;
  $('#room-code').textContent = r.code;
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);
  $('#lan-hint').innerHTML = local && app.lan && app.lan.length
    ? `같은 와이파이 친구 접속 주소: <b>${app.lan.map(esc).join(' / ')}</b><br>멀리 있는 친구는 README의 "npm run share" 방법을 이용하세요.`
    : `친구에게 이 주소를 알려주세요: <b>${esc(location.origin)}</b>`;
  const isHost = r.hostId === app.you;
  $('#room-players').innerHTML = r.players.map((p) => {
    const sp = c.spirits.find((s) => s.id === p.spiritId);
    return `<li class="${p.connected ? '' : 'off'}"><span>${p.id === r.hostId ? '👑 ' : ''}${esc(p.name)}${p.id === app.you ? ' (나)' : ''}${p.connected ? '' : ' · 연결 끊김'}</span>
      <span style="color:${sp ? sp.color : 'var(--muted)'}">${sp ? esc(sp.name) : '정령 미선택'}</span></li>`;
  }).join('');
  const allPicked = r.players.every((p) => p.spiritId);
  $('#btn-start').disabled = !isHost || !allPicked;
  $('#btn-start').classList.toggle('hidden', !isHost);
  $('#start-hint').textContent = isHost
    ? (allPicked ? `${r.players.length}인 게임을 시작할 수 있습니다.` : '모든 플레이어가 정령을 고르면 시작할 수 있습니다.')
    : '방장이 게임을 시작하기를 기다리는 중...';

  $('#spirit-list').innerHTML = c.spirits.map((s) => {
    const owner = r.players.find((p) => p.spiritId === s.id);
    const mine = owner && owner.id === app.you;
    const pips = (arr) => `<span class="pips">${arr.map((v) => `<span class="pip">${v}</span>`).join('')}</span>`;
    return `<div class="spirit-card ${mine ? 'mine' : ''} ${owner && !mine ? 'taken' : ''}" data-spirit="${s.id}" style="--sc:${s.color}">
      ${owner ? `<span class="owner">${esc(owner.name)}</span>` : ''}
      <h3><span class="spirit-orb"></span>${esc(s.name)}</h3>
      <div class="en">${esc(s.en)} · 난이도 ${esc(s.complexity)}</div>
      <div class="sec">${esc(s.summary)}</div>
      <div class="sec"><b>${esc(s.special.name)}</b>: ${esc(s.special.text)}</div>
      <div class="sec"><b>성장</b> (하나 선택)<br>${s.growth.map((g, i) => `${i + 1}. ${g.map(esc).join(' + ')}`).join('<br>')}</div>
      <div class="sec tracks"><span>${pcIcon('energy', 13, '#f3d98b')} 에너지</span>${pips(s.energyTrack)}<span>${pcIcon('card', 13, '#9ed3ff')} 카드 수</span>${pips(s.cardTrack)}</div>
      <div class="sec"><b>내재 권능</b>: ${s.innates.map((i) => esc(i.name)).join(', ')}</div>
      <div class="sec"><b>시작 배치</b>: ${esc(s.setupText)}</div>
      <div class="sec"><b>고유 권능</b>: ${s.uniques.map((u) => esc(c.powers[u].name)).join(', ')}</div>
    </div>`;
  }).join('');
  for (const el of document.querySelectorAll('.spirit-card')) {
    el.onclick = () => {
      const sid = el.dataset.spirit;
      const me = r.players.find((p) => p.id === app.you);
      send({ t: 'pickSpirit', spiritId: me && me.spiritId === sid ? null : sid });
    };
  }
  renderChat($('#room-chat'));
}

function renderChat(box) {
  const chat = (app.room && app.room.chat) || [];
  box.innerHTML = chat.map((m) => `<div><span class="from">${esc(m.from)}</span>: ${esc(m.text)}</div>`).join('') || '<div class="hint">아직 메시지가 없습니다.</div>';
  box.scrollTop = box.scrollHeight;
}

// ───────────── 카드 렌더링 ─────────────
function targetText(t) {
  if (!t) return '';
  if (t.kind === 'spirit') return t.filter === 'other' ? '다른 정령' : t.filter === 'self' ? '자신' : '정령 대상';
  const f = FILTER_NAME[t.filter] || t.filter.split('/').map((x) => app.catalog.terrains[x]).join('/');
  return `${t.from === 'sacred' ? '성지' : '존재'}에서 사거리 ${t.range} · ${f}`;
}

function cardHTML(id, opts = {}) {
  const c = app.catalog.powers[id];
  if (!c) return '';
  const cls = ['card', c.kind, 'sp-' + c.speed, opts.mini ? 'mini' : '', opts.used ? 'used' : '', opts.selectable ? 'selectable' : '', opts.selected ? 'selected' : '', opts.disabled ? 'disabled' : ''].join(' ');
  let th = '';
  if (c.threshold) {
    const met = opts.elements && Object.entries(c.threshold.el).every(([e, n]) => (opts.elements[e] || 0) >= n);
    th = `<div class="c-th ${met ? 'met' : ''}"><span class="th-els">${Object.entries(c.threshold.el).map(([e, n]) => elRep(e, n, 12)).join('')}</span> ${esc(c.threshold.text.replace(/^[^:]+:\s*/, ''))}</div>`;
  }
  const kindName = { unique: '고유', minor: '소형', major: '대형' }[c.kind];
  return `<div class="${cls}" data-card="${id}">
    <div class="c-top"><span class="c-cost">${c.cost}</span><span class="c-name">${esc(c.name)}</span><span class="c-speed ${c.speed}">${c.speed === 'fast' ? '빠름' : '느림'}</span></div>
    <div class="c-el">${c.elements.map((e) => elIcon(e, opts.mini ? 15 : 18)).join('')}</div>
    <div class="c-target">${esc(targetText(c.target))}</div>
    <div class="c-text">${esc(c.text)}</div>${th}
    <span class="c-kind">${kindName} · ${esc(c.en)}</span>
  </div>`;
}

// ───────────── 게임 화면 ─────────────
function spiritOf(pid) {
  const s = app.state.spirits[pid];
  return { s, def: app.catalog.spirits.find((d) => d.id === s.spiritId), player: app.state.players.find((p) => p.id === pid) };
}

function renderGame() {
  hideTip();
  renderTopbar();
  renderPrompt();
  renderMap();
  renderSide();
  renderHand();
  renderLog();
  renderModal();
}

function invCardHTML(card) {
  if (!card) return '<span class="hint">없음</span>';
  if (card.coastal) return '<span class="inv-card" style="background:#7fb3e0">해안 지역</span>';
  return card.terrains.map((t) => `<span class="inv-card" style="background:${TERRAIN_COLOR[t]}">${trIcon(t, 12, '#1b1a12')}${app.catalog.terrains[t]}</span>`).join('');
}

function renderTopbar() {
  const st = app.state;
  const f = st.fear;
  const fearDots = Array.from({ length: f.poolSize }, (_, i) => `<i class="${i < f.generated ? 'on' : ''}"></i>`).join('');
  $('#topbar').innerHTML = `
    <div class="tb-logo"><svg viewBox="0 0 64 64"><use href="#logo"/></svg></div>
    <div class="tb-box phase"><span class="k">${st.turn}턴</span><span class="v">${PHASE_NAME[st.phase] || st.phase}</span></div>
    <div class="tb-box" title="공포가 공포 풀만큼 쌓이면 공포 카드를 얻습니다."><span class="k">공포 ${f.generated}/${f.poolSize} · 획득 카드 ${f.earnedTotal}장${f.pending ? ` (대기 ${f.pending})` : ''}</span><div class="fear-bar">${fearDots}</div></div>
    <div class="tb-box" title="공포 단계에 따라 승리 조건이 쉬워집니다."><span class="k">공포 단계 · 남은 공포 카드</span><span class="v">${pcIcon('fear', 16, '#c9a2ff')} ${f.terrorLevel}단계 · ${f.deckLeft}장</span></div>
    <div class="tb-box" title="${st.blight.flipped ? '황폐해진 섬: 다시 비면 패배' : '건강한 섬: 비면 뒤집힘'}"><span class="k">황폐 카드${st.blight.flipped ? ' (황폐해진 섬!)' : ''}</span><span class="v" style="color:${st.blight.flipped ? 'var(--danger)' : 'inherit'}">${pcIcon('blight', 16, '#e8604f')} ${st.blight.pool}</span></div>
    <div class="tb-box"><span class="k">약탈 (이번 턴)</span><span class="v">${invCardHTML(st.invader.ravage)}</span></div>
    <div class="tb-box"><span class="k">건설 (이번 턴)</span><span class="v">${invCardHTML(st.invader.build)}</span></div>
    <div class="tb-box"><span class="k">침략자 덱</span><span class="v">${st.invader.deckCount}장${st.invader.nextStage ? ` <small class="hint">(다음 ${st.invader.nextStage}단계)</small>` : ''}</span></div>
    <div class="tb-box" style="flex:1;min-width:180px"><span class="k">승리 조건 (공포 ${f.terrorLevel}단계)</span><span style="font-size:12px">${['', '섬에 침략자가 하나도 없으면 승리', '섬에 마을·도시가 없으면 승리', '섬에 도시가 없으면 승리'][f.terrorLevel]}${st.turnRules.length ? `<br><span style="color:var(--accent2)">이번 턴: ${st.turnRules.map(esc).join(', ')}</span>` : ''}</span></div>
    <button id="btn-help">❓ 규칙</button>
  `;
  $('#btn-help').onclick = () => $('#help').classList.remove('hidden');
}

function renderPrompt() {
  const el = $('#prompt');
  const p = app.prompt;
  const st = app.state;
  if (st.result) {
    el.className = 'prompt idle';
    el.innerHTML = `<span class="title">${st.result.win ? '🎉 승리!' : '💀 패배'}</span> ${esc(st.result.reason)} <button id="btn-show-result">결과 보기</button>`;
    $('#btn-show-result').onclick = () => { app.resultDismissed = false; renderModal(); };
    return;
  }
  if (!p) {
    el.className = 'prompt idle';
    const waiting = st.players.filter((pl) => st.spirits[pl.id].waiting).map((pl) => pl.name);
    el.innerHTML = waiting.length ? `⏳ 다른 플레이어를 기다리는 중: <b>${waiting.map(esc).join(', ')}</b>` : '⏳ 진행 중...';
    if (st.fear.current) el.innerHTML += ` &nbsp; <span style="color:#c99bf0">공포 카드 [${esc(st.fear.current.name)}] ${st.fear.current.tl}단계: ${esc(st.fear.current.text)}</span>`;
    return;
  }
  el.className = 'prompt';
  let html = `<span class="title pulse">${esc(p.title)}</span>`;
  if (p.type === 'option') {
    html += p.options.map((o, i) => {
      const done = ['done', '__stop', '__cancel'].includes(o.value);
      return `<button data-i="${i}" class="${done ? 'opt-done' : ''}" ${o.card ? `data-card-tip="${o.card}"` : ''}>${esc(o.label)}</button>`;
    }).join('');
  } else if (p.type === 'land') {
    html += '<span class="hint">지도에서 빛나는 지역을 클릭하거나:</span>';
    html += p.options.map((id) => `<button data-land="${id}" class="small" title="${esc((p.notes && p.notes[id]) || '')}">${id}${p.notes && p.notes[id] ? '*' : ''}</button>`).join('');
    if (p.cancel) html += '<button data-cancel="1" class="opt-done">취소 / 그만</button>';
  } else if (p.type === 'cards') {
    html += '<button id="btn-open-cards" class="primary">카드 선택 창 열기</button>';
  }
  el.innerHTML = html;
  if (st.fear.current) el.innerHTML += `<div class="fear-now">${pcIcon('fear', 14, '#c9a2ff')} 공포 카드 [${esc(st.fear.current.name)}] ${st.fear.current.tl}단계: ${esc(st.fear.current.text)}</div>`;
  for (const b of el.querySelectorAll('button[data-i]')) b.onclick = () => answer(p.options[Number(b.dataset.i)].value);
  for (const b of el.querySelectorAll('button[data-land]')) b.onclick = () => answer(b.dataset.land);
  const cancel = el.querySelector('button[data-cancel]');
  if (cancel) cancel.onclick = () => answer(null);
  const open = el.querySelector('#btn-open-cards');
  if (open) open.onclick = () => { app.modal.hidden = false; renderModal(); };
  attachCardTips(el);
}

function attachCardTips(root) {
  for (const b of root.querySelectorAll('[data-card-tip]')) {
    b.onmouseenter = (e) => showTip(e, cardHTML(b.dataset.cardTip, {}), true);
    b.onmousemove = moveTip;
    b.onmouseleave = hideTip;
  }
}

const TOKEN_STYLE = {
  city: { fill: '#c3c6cd', stroke: '#454a54', glyph: '#262a31' },
  town: { fill: '#dcae62', stroke: '#6b4a1a', glyph: '#3a270b' },
  explorer: { fill: '#f1e7cc', stroke: '#6b5a3a', glyph: '#47381f' },
  dahan: { fill: '#7e5130', stroke: '#2e1a0a', glyph: '#f4dcb6' },
  blight: { fill: '#2a1014', stroke: '#c0443c', glyph: '#e8604f' },
  shield: { fill: '#24496d', stroke: '#9cc6ee', glyph: '#e2f1ff' },
  skip: { fill: '#3a3552', stroke: '#a59cf0', glyph: '#d9d3ff' },
};

function landPieces(l) {
  const out = [];
  const damaged = (arr, full) => arr.some((h) => h < full);
  if (l.cities.length) out.push({ kind: 'city', n: l.cities.length, dmg: damaged(l.cities, 3) });
  if (l.towns.length) out.push({ kind: 'town', n: l.towns.length, dmg: damaged(l.towns, 2) });
  if (l.explorers) out.push({ kind: 'explorer', n: l.explorers });
  if (l.dahan.length) out.push({ kind: 'dahan', n: l.dahan.length, dmg: damaged(l.dahan, 2) });
  if (l.blight) out.push({ kind: 'blight', n: l.blight });
  for (const [pid, n] of Object.entries(l.presence)) {
    if (!n) continue;
    const { def, s } = spiritOf(pid);
    out.push({ presence: def.color, sid: def.id, n, sacred: s.sacred.includes(l.id) });
  }
  if (l.defend) out.push({ kind: 'shield', n: l.defend, always: true });
  if (l.skip) out.push({ kind: 'skip', n: 0 });
  return out;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) * amt : v * amt))));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function mapDefs() {
  const spiritGrads = app.catalog.spirits.map((sp) => `<radialGradient id="pg-${sp.id}" cx="38%" cy="32%" r="70%">
      <stop offset="0" stop-color="${shade(sp.color, 0.65)}"/><stop offset=".55" stop-color="${sp.color}"/><stop offset="1" stop-color="${shade(sp.color, -0.45)}"/></radialGradient>`).join('');
  return `<defs>
    <radialGradient id="sea" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="#1f6a92"/><stop offset=".7" stop-color="#103a5c"/><stop offset="1" stop-color="#081d33"/></radialGradient>
    <pattern id="waves" width="40" height="18" patternUnits="userSpaceOnUse"><path d="M0 9q5-4 10 0t10 0 10 0 10 0" fill="none" stroke="#9fd4ff" stroke-opacity=".12" stroke-width="1"/></pattern>
    <linearGradient id="shallow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2b86b0" stop-opacity="0"/><stop offset="1" stop-color="#4fb0d0" stop-opacity=".55"/></linearGradient>
    <linearGradient id="light" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>
    <pattern id="tex-M" width="30" height="26" patternUnits="userSpaceOnUse"><rect width="30" height="26" fill="#8e949b"/>
      <path d="M2 22 9 10l7 12z" fill="#7a8087"/><path d="M9 10l-2.2 3.8 2.2-.8 1.8 1.2z" fill="#e9eef2" opacity=".8"/>
      <path d="M15 12 21 3l6 9z" fill="#848a91"/><path d="M21 3l-1.8 2.8 1.8-.6 1.4.9z" fill="#e9eef2" opacity=".7"/></pattern>
    <pattern id="tex-J" width="26" height="26" patternUnits="userSpaceOnUse"><rect width="26" height="26" fill="#2c7232"/>
      <circle cx="6" cy="6" r="5" fill="#368a3d"/><circle cx="19" cy="13" r="5.5" fill="#327f39"/><circle cx="9" cy="21" r="4.5" fill="#3b9142"/>
      <circle cx="5" cy="5" r="2" fill="#4aa451" opacity=".6"/><circle cx="18" cy="12" r="2.2" fill="#4aa451" opacity=".5"/><circle cx="23" cy="24" r="3" fill="#24612a"/></pattern>
    <pattern id="tex-S" width="34" height="24" patternUnits="userSpaceOnUse"><rect width="34" height="24" fill="#dcc07e"/>
      <path d="M0 8q8.5-6 17 0t17 0M0 20q8.5-6 17 0t17 0" fill="none" stroke="#c4a35f" stroke-width="1.4"/>
      <circle cx="6" cy="14" r=".9" fill="#b8975a"/><circle cx="24" cy="3" r=".9" fill="#b8975a"/><circle cx="28" cy="15" r=".7" fill="#efdcac"/></pattern>
    <pattern id="tex-W" width="28" height="22" patternUnits="userSpaceOnUse"><rect width="28" height="22" fill="#4e9d96"/>
      <path d="M0 16q3.5-2.5 7 0t7 0 7 0 7 0" fill="none" stroke="#79c2b9" stroke-width="1.1"/>
      <path d="M5 13V5M8 13V7M20 10V2M23 10V5" stroke="#2f6f68" stroke-width="1.2" stroke-linecap="round"/>
      <ellipse cx="5" cy="5" rx=".9" ry="1.8" fill="#6b4f2f"/><ellipse cx="20" cy="2.5" rx=".9" ry="1.8" fill="#6b4f2f"/></pattern>
    <filter id="island-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000" flood-opacity=".6"/></filter>
    <filter id="tok-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1.2" stdDeviation="1" flood-color="#000" flood-opacity=".65"/></filter>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    ${spiritGrads}
  </defs>`;
}

function tokenSVG(c, x, y) {
  const badge = (n, dmg) => (n > 1 || dmg || c.always
    ? `<circle cx="6.2" cy="-6.2" r="4.6" fill="${dmg ? '#a8231f' : '#14181d'}" stroke="#f3e6c4" stroke-width=".7"/><text x="6.2" y="-3.9" text-anchor="middle" class="tok-n">${n}</text>` : '');
  if (c.presence) {
    return `<g transform="translate(${x},${y})" filter="url(#tok-shadow)">
      ${c.sacred ? '<circle r="10.6" fill="none" stroke="#ffd86b" stroke-width="1.6" stroke-dasharray="2.2 1.4"/>' : ''}
      <circle r="8" fill="url(#pg-${c.sid})" stroke="${shade(c.presence, -0.6)}" stroke-width="1"/>
      <circle cx="-2.6" cy="-3" r="2.4" fill="#fff" opacity=".55"/>${badge(c.n, false)}</g>`;
  }
  const st = TOKEN_STYLE[c.kind];
  return `<g transform="translate(${x},${y})" filter="url(#tok-shadow)">
    <circle r="8.2" fill="${st.fill}" stroke="${st.stroke}" stroke-width="1.2"/>
    <circle r="8.2" fill="url(#light)"/>
    <use href="#pc-${c.kind}" x="-5.6" y="-5.6" width="11.2" height="11.2" style="color:${st.glyph}"/>${badge(c.n, c.dmg)}</g>`;
}

function renderMap() {
  const st = app.state;
  const svg = $('#map');
  const pad = 14;
  const W = st.mapSize.width;
  const H = st.mapSize.height;
  svg.setAttribute('viewBox', `${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`);
  const p = app.prompt;
  const landPrompt = p && p.type === 'land';
  const selectable = new Set(landPrompt ? p.options : []);
  const focus = new Set((p && p.focus) || []);
  const ptsStr = (poly) => poly.map((q) => q.join(',')).join(' ');
  let html = mapDefs();
  html += `<rect x="${-pad}" y="${-pad}" width="${W + pad * 2}" height="${H + pad * 2}" fill="url(#sea)"/><rect x="${-pad}" y="${-pad}" width="${W + pad * 2}" height="${H + pad * 2}" fill="url(#waves)"/>`;
  for (const o of Object.values(st.oceans)) {
    const flip = o.center[0] > W / 2;
    html += `<polygon points="${ptsStr(o.poly)}" fill="url(#shallow)" ${flip ? `transform="translate(${2 * o.center[0]} 0) scale(-1 1)"` : ''} opacity=".8"/>`;
    html += `<text x="${o.center[0]}" y="${o.center[1]}" class="sea-label" transform="rotate(${flip ? 90 : -90} ${o.center[0]} ${o.center[1]})">바다 · ${o.board}</text>`;
  }
  const evPriority = { ravage: 3, build: 2, explore: 1 };
  const ev = {};
  for (const e of st.events) if (!ev[e.landId] || evPriority[e.kind] > evPriority[ev[e.landId]]) ev[e.landId] = e.kind;
  html += '<g filter="url(#island-shadow)">';
  for (const l of Object.values(st.lands)) html += `<polygon points="${ptsStr(l.poly)}" fill="url(#tex-${l.terrain})" class="land-base"/>`;
  html += '</g>';
  for (const l of Object.values(st.lands)) {
    const dim = landPrompt && !selectable.has(l.id);
    html += `<polygon points="${ptsStr(l.poly)}" fill="url(#light)" pointer-events="none"/>`;
    if (l.blight) html += `<polygon points="${ptsStr(l.poly)}" fill="#5a1a1a" opacity="${Math.min(0.12 * l.blight, 0.36)}" pointer-events="none"/>`;
    if (dim) html += `<polygon points="${ptsStr(l.poly)}" fill="#05080c" opacity=".45" pointer-events="none"/>`;
    if (ev[l.id]) html += `<polygon class="ev ev-${ev[l.id]}" points="${ptsStr(l.poly)}"/>`;
  }
  for (const l of Object.values(st.lands)) {
    const cls = ['land', selectable.has(l.id) ? 'selectable' : '', focus.has(l.id) ? 'focus' : ''].join(' ');
    html += `<polygon class="${cls}" data-land="${l.id}" points="${ptsStr(l.poly)}"/>`;
  }
  for (const l of Object.values(st.lands)) {
    const [cx, cy] = l.center;
    const name = app.catalog.terrains[l.terrain] + (l.coastal ? '·해안' : '');
    const lw = 31 + name.length * 6.8;
    html += `<g transform="translate(${cx},${cy - 24})" pointer-events="none" class="plaque">
      <rect x="${-lw / 2}" y="-7" width="${lw}" height="13" rx="6.5" fill="#0c1117" fill-opacity=".78" stroke="#d9b45a" stroke-opacity=".55" stroke-width=".7"/>
      <use href="#tr-${l.terrain}" x="${-lw / 2 + 3}" y="-5" width="9" height="9" style="color:#e9d8a6"/>
      <text x="${-lw / 2 + 14}" y="2.6" class="plaque-t">${l.id}</text><text x="${-lw / 2 + 28}" y="2.4" class="plaque-s">${name}</text></g>`;
    const toks = landPieces(l);
    const perRow = 4;
    const sp = 19;
    toks.forEach((c, i) => {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, toks.length - row * perRow);
      const col = i % perRow;
      html += tokenSVG(c, cx + (col - (inRow - 1) / 2) * sp, cy - 4 + row * sp);
    });
  }
  svg.innerHTML = html;
  for (const poly of svg.querySelectorAll('polygon.land')) {
    const id = poly.dataset.land;
    poly.onclick = () => { if (selectable.has(id)) answer(id); };
    poly.onmouseenter = (e) => showTip(e, landTip(id));
    poly.onmousemove = moveTip;
    poly.onmouseleave = hideTip;
  }
  const lg = (k, label) => `<span class="lg">${pcIcon(k, 14, TOKEN_STYLE[k] ? TOKEN_STYLE[k].fill : '#ddd')} ${label}</span>`;
  $('#legend').innerHTML = [lg('explorer', '탐험가 1'), lg('town', '마을 2'), lg('city', '도시 3'), lg('dahan', '다한 2'), lg('blight', '황폐'),
    `<span class="lg">${pcIcon('presence', 14, '#f2c94c')} 존재 <span class="hint">(금빛 테두리 = 성지)</span></span>`, lg('shield', '방어'), lg('skip', '행동 건너뜀'),
    '<span class="lg"><i class="sw sw-dmg"></i>손상</span>', '<span class="lg"><i class="sw sw-ravage"></i>약탈</span>', '<span class="lg"><i class="sw sw-build"></i>건설</span>', '<span class="lg"><i class="sw sw-explore"></i>탐험</span>'].join('');
}

function landTip(id) {
  const l = app.state.lands[id];
  const t = app.catalog.terrains[l.terrain];
  const parts = [`<b>${id} — ${t}${l.coastal ? ' (해안)' : ' (내륙)'}</b>`];
  if (l.cities.length) parts.push(`도시 ${l.cities.length} (체력 ${l.cities.join(', ')})`);
  if (l.towns.length) parts.push(`마을 ${l.towns.length} (체력 ${l.towns.join(', ')})`);
  if (l.explorers) parts.push(`탐험가 ${l.explorers}`);
  if (l.dahan.length) parts.push(`다한 ${l.dahan.length} (체력 ${l.dahan.join(', ')})`);
  if (l.blight) parts.push(`황폐 ${l.blight}`);
  for (const [pid, n] of Object.entries(l.presence)) if (n) { const { def, player, s } = spiritOf(pid); parts.push(`<span style="color:${def.color}">● ${esc(player.name)} 존재 ${n}${s.sacred.includes(id) ? ' (성지)' : ''}</span>`); }
  if (l.defend) parts.push(`방어 ${l.defend}`);
  if (l.skip) parts.push('이번 턴 침략자 행동 건너뜀');
  if (l.dahanProtected) parts.push('다한이 약탈 피해를 받지 않음');
  parts.push(`<span class="hint">인접: ${l.adj.join(', ')}</span>`);
  const note = app.prompt && app.prompt.type === 'land' && app.prompt.notes && app.prompt.notes[id];
  if (note) parts.push(`<span style="color:var(--accent2)">${esc(note)}</span>`);
  return parts.join('<br>');
}

function renderSide() {
  const st = app.state;
  const order = [app.you, ...st.players.map((p) => p.id).filter((id) => id !== app.you)].filter((id) => st.spirits[id]);
  if (!app.tab || !st.spirits[app.tab]) app.tab = order[0];
  $('#tabs').innerHTML = order.map((pid) => {
    const { def, player, s } = spiritOf(pid);
    return `<button data-tab="${pid}" class="${app.tab === pid ? 'active' : ''}"><span class="dot" style="background:${def.color};color:${def.color}"></span>${esc(player.name)}${pid === app.you ? ' (나)' : ''}${s.waiting ? ' <span class="wait">●선택 중</span>' : ''}</button>`;
  }).join('');
  for (const b of document.querySelectorAll('#tabs button')) b.onclick = () => { app.tab = b.dataset.tab; renderSide(); };
  $('#side-content').innerHTML = spiritPanel(app.tab);
  attachCardTips($('#side-content'));
}

function trackHTML(label, values, revealed, color) {
  return `<div class="track"><span class="lbl">${label}</span>${values.map((v, i) => {
    const isRev = i < revealed;
    const cur = i === revealed - 1;
    return `<span class="slot ${isRev ? 'rev' : 'pres'} ${cur ? 'cur' : ''}" style="--pc:${color}" title="${isRev ? (cur ? '현재 값' : '드러남') : '존재가 덮고 있음'}">${isRev ? v : ''}</span>`;
  }).join('')}</div>`;
}

function spiritPanel(pid) {
  const { s, def, player } = spiritOf(pid);
  const els = Object.entries(s.elements).filter(([, n]) => n > 0);
  const growth = def.growth.map((g, i) => `<div class="${s.growthChoice === i ? 'chosen' : ''}">${i + 1}. ${g.map(esc).join(' + ')}</div>`).join('');
  const innates = def.innates.map((inn) => {
    const lv = s.innateLevels[inn.id] || 0;
    return `<div class="innate ${inn.speed}"><b>${esc(inn.name)}</b> <span class="hint">(내재 · ${inn.speed === 'fast' ? '빠름' : '느림'} · ${esc(targetText(inn.target))})${s.innatesUsed[inn.id] ? ' · 사용함' : ''}</span>
      ${inn.levels.map((l, i) => `<div class="lv ${i < lv ? 'met' : ''}"><span class="lv-els">${Object.entries(l.el).map(([e, n]) => elRep(e, n, 13)).join('')}</span> ${esc(l.text)}</div>`).join('')}</div>`;
  }).join('');
  const played = s.played.map((p) => `<span data-card-tip="${p.id}">${cardHTML(p.id, { mini: true, used: p.used, elements: s.elements })}</span>`).join('');
  const handList = pid === app.you ? '' : `<div class="pile">손패: ${s.hand.map((id) => `<span data-card-tip="${id}" style="text-decoration:underline dotted">${esc(app.catalog.powers[id].name)}</span>`).join(', ') || '없음'}</div>`;
  return `
    <div class="sp-head" style="--sc:${def.color}"><span class="spirit-orb"></span><h3>${esc(def.name)}</h3></div>
    <div class="hint">${esc(player.name)} · 보드 ${s.board} · ${esc(s.status || '')}</div>
    <div class="stat-row">
      <div class="stat energy"><div class="k">보유 에너지</div><div class="v">${pcIcon('energy', 16, '#f3d98b')}${s.energy}</div></div>
      <div class="stat"><div class="k">턴당 에너지</div><div class="v">+${s.energyPerTurn}</div></div>
      <div class="stat"><div class="k">카드 사용 수</div><div class="v">${s.cardPlays}</div></div>
      <div class="stat"><div class="k">섬의 존재</div><div class="v">${s.islandPresence}</div></div>
      ${s.destroyed ? `<div class="stat"><div class="k">파괴된 존재</div><div class="v">${s.destroyed}</div></div>` : ''}
      ${s.fastAllowance ? `<div class="stat"><div class="k">느림→빠름</div><div class="v">${s.fastAllowance}</div></div>` : ''}
      ${s.repeats.length ? `<div class="stat"><div class="k">반복 가능</div><div class="v">${s.repeats.length}</div></div>` : ''}
    </div>
    <div class="els">원소: ${els.length ? els.map(([e, n]) => `<span title="${app.catalog.elements[e]}">${elIcon(e, 16)}<b>${n}</b></span>`).join('') : '<span class="hint">없음</span>'}</div>
    ${trackHTML(`${pcIcon('energy', 12, '#f3d98b')}에너지`, def.energyTrack, s.energyRevealed, def.color)}
    ${trackHTML(`${pcIcon('card', 12, '#9ed3ff')}카드`, def.cardTrack, s.cardRevealed, def.color)}
    <div class="special"><b>${esc(def.special.name)}</b>: ${esc(def.special.text)}</div>
    <h2>성장 옵션</h2><div class="growth-opts">${growth}</div>
    <h2>내재 권능</h2>${innates}
    <h2>이번 턴에 낸 카드</h2><div class="mini-cards">${played || '<span class="hint">없음</span>'}</div>
    ${handList}
    <div class="pile">버린 카드 ${s.discard.length}장: ${s.discard.map((id) => `<span data-card-tip="${id}" style="text-decoration:underline dotted">${esc(app.catalog.powers[id].name)}</span>`).join(', ') || '-'}</div>
    ${s.forgotten.length ? `<div class="pile">잊은 카드: ${s.forgotten.map((id) => esc(app.catalog.powers[id].name)).join(', ')}</div>` : ''}
  `;
}

function renderHand() {
  const s = app.state.spirits[app.you];
  if (!s) { $('#hand-area').innerHTML = ''; return; }
  $('#hand-area').innerHTML = `
    <div class="grp"><div class="grp-title">내 손패 (${s.hand.length}장)</div><div class="grp-cards">${s.hand.map((id) => cardHTML(id, { mini: true, elements: s.elements })).join('') || '<span class="hint">비어 있음</span>'}</div></div>
  `;
}

function logClass(m) {
  if (m.startsWith('══')) return 'turn';
  if (m.startsWith('▶')) return 'act';
  if (/^(💀|⚠)/.test(m) || m.includes('황폐 추가') || m.includes('번집니다')) return 'bad';
  if (/^(🎉|★)/.test(m)) return 'good';
  return '';
}

function renderLog() {
  const box = $('#log');
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = app.state.log.map((l) => `<div class="${logClass(l.msg)}">${esc(l.msg)}</div>`).join('');
  if (atBottom) box.scrollTop = box.scrollHeight;
  const chat = (app.room && app.room.chat) || [];
  if (app.sidePane === 'chat') { app.chatSeen = chat.length; renderChat($('#game-chat')); }
  $('#chat-badge').textContent = chat.length > app.chatSeen ? `(${chat.length - app.chatSeen})` : '';
}

// ───────────── 모달 (카드 선택 / 결과) ─────────────
function closeModal() { $('#modal').classList.add('hidden'); }

function renderModal() {
  const st = app.state;
  const p = app.prompt;
  const inner = $('#modal .modal-inner');
  if (st && st.result && !app.resultDismissed) {
    const isHost = app.room.hostId === app.you;
    inner.innerHTML = `<div class="result ${st.result.win ? 'win' : 'lose'}"><svg class="big-logo" viewBox="0 0 64 64"><use href="#logo"/></svg><h1>${st.result.win ? '승리' : '패배'}</h1><p>${esc(st.result.reason)}</p><p class="hint">${st.result.turn}턴에 게임이 끝났습니다.</p>
      <div class="actions" style="justify-content:center">${isHost ? '<button id="btn-lobby" class="primary">대기실로 돌아가기 (새 게임)</button>' : '<span class="hint">방장이 새 게임을 준비할 수 있습니다.</span>'}<button id="btn-close-result">지도 보기</button></div></div>`;
    $('#modal').classList.remove('hidden');
    const lb = $('#btn-lobby');
    if (lb) lb.onclick = () => send({ t: 'backToLobby' });
    $('#btn-close-result').onclick = () => { app.resultDismissed = true; closeModal(); };
    return;
  }
  if (!p || p.type !== 'cards') { closeModal(); return; }
  if (app.modal.promptId !== p.id) { app.modal = { promptId: p.id, selected: [], hidden: false }; }
  if (app.modal.hidden) { closeModal(); return; }
  const s = st.spirits[app.you];
  const sel = app.modal.selected;
  const cost = sel.reduce((a, id) => a + app.catalog.powers[id].cost, 0);
  const isPlay = p.mode === 'play';
  inner.innerHTML = `<h2>${esc(p.title)}</h2>
    ${isPlay ? `<div class="budget">선택 ${sel.length}/${p.max}장 · 비용 <b style="color:${cost > p.budget ? 'var(--danger)' : 'var(--accent2)'}">${cost}</b> / 에너지 ${p.budget} · 현재 원소: ${Object.entries(sumElements(sel)).map(([e, n]) => `${elIcon(e, 15)}×${n}`).join(' ') || '없음'}</div>` : ''}
    <div class="cards-row">${p.cards.map((id) => {
      const picked = sel.includes(id);
      const c = app.catalog.powers[id];
      const disabled = !picked && ((isPlay && (sel.length >= p.max || cost + c.cost > p.budget)) || (!isPlay && sel.length >= p.max && p.max > 1));
      return cardHTML(id, { selectable: !disabled, selected: picked, disabled, elements: isPlay ? sumElements(sel) : s.elements });
    }).join('')}</div>
    <div class="actions">
      <button id="btn-hide-modal">지도 보기 (나중에 선택)</button>
      <button id="btn-confirm-cards" class="primary" ${sel.length < p.min || sel.length > p.max ? 'disabled' : ''}>${isPlay ? (sel.length ? `${sel.length}장 사용하기` : '카드 없이 진행') : '선택 완료'}</button>
    </div>`;
  $('#modal').classList.remove('hidden');
  for (const el of inner.querySelectorAll('.card')) {
    el.onclick = () => {
      const id = el.dataset.card;
      if (sel.includes(id)) app.modal.selected = sel.filter((x) => x !== id);
      else if (!el.classList.contains('disabled')) {
        if (!isPlay && p.max === 1) app.modal.selected = [id];
        else app.modal.selected = [...sel, id];
      }
      renderModal();
    };
  }
  $('#btn-hide-modal').onclick = () => { app.modal.hidden = true; closeModal(); };
  $('#btn-confirm-cards').onclick = () => answer(app.modal.selected);
}

function sumElements(ids) {
  const out = {};
  for (const id of ids) for (const e of app.catalog.powers[id].elements) out[e] = (out[e] || 0) + 1;
  return out;
}

// ───────────── 툴팁 / 토스트 ─────────────
function showTip(e, html, isCard = false) {
  const t = $('#tooltip');
  t.innerHTML = html;
  t.style.padding = isCard ? '0' : '';
  t.style.background = isCard ? 'transparent' : '';
  t.style.border = isCard ? 'none' : '';
  t.classList.remove('hidden');
  moveTip(e);
}
function moveTip(e) {
  const t = $('#tooltip');
  const x = Math.min(e.clientX + 14, window.innerWidth - t.offsetWidth - 8);
  const y = Math.min(e.clientY + 14, window.innerHeight - t.offsetHeight - 8);
  t.style.left = x + 'px';
  t.style.top = y + 'px';
}
function hideTip() { $('#tooltip').classList.add('hidden'); }

let toastTimer = null;
function toast(msg, info = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (info ? ' info' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3500);
}

// ───────────── 기타 UI ─────────────
function initRoomAndGameUI() {
  $('#btn-leave').onclick = () => send({ t: 'leave' });
  $('#btn-help-close').onclick = () => $('#help').classList.add('hidden');
  $('#help').onclick = (e) => { if (e.target.id === 'help') $('#help').classList.add('hidden'); };
  $('#btn-start').onclick = () => send({ t: 'start' });
  $('#btn-copy').onclick = async () => {
    const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);
    const base = local && app.lan && app.lan.length ? app.lan[0] : location.origin;
    const url = `${base}/?room=${app.room.code}`;
    try { await navigator.clipboard.writeText(url); toast('초대 링크를 복사했습니다: ' + url, true); } catch { toast('복사 실패. 직접 공유하세요: ' + url, true); }
  };
  for (const id of ['#room-chat-form', '#game-chat-form']) {
    $(id).onsubmit = (e) => {
      e.preventDefault();
      const input = $(id).querySelector('input');
      if (input.value.trim()) send({ t: 'chat', text: input.value });
      input.value = '';
    };
  }
  for (const b of document.querySelectorAll('.mini-tabs button')) {
    b.onclick = () => {
      app.sidePane = b.dataset.pane;
      for (const x of document.querySelectorAll('.mini-tabs button')) x.classList.toggle('active', x === b);
      $('#log').classList.toggle('hidden', app.sidePane !== 'log');
      $('#game-chat').classList.toggle('hidden', app.sidePane !== 'chat');
      $('#game-chat-form').classList.toggle('hidden', app.sidePane !== 'chat');
      if (app.state) renderLog();
    };
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) {
      if (app.state && app.state.result) app.resultDismissed = true; else app.modal.hidden = true;
      closeModal();
    }
  });
}

// 앱 설치 (바탕화면/작업표시줄 아이콘)
let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  $('#btn-install').classList.remove('hidden');
});
function initInstall() {
  $('#btn-install').onclick = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    $('#btn-install').classList.add('hidden');
  };
  if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
}

initHome();
initRoomAndGameUI();
initInstall();
connect();
