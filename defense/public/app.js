'use strict';
/* 요괴 퇴마 디펜스 — 클라이언트 (대기실 + 실시간 전장 그리기) */

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const T = 48; // 한 칸 크기(px, 캔버스 내부 해상도)

const app = {
  ws: null, token: null, cat: null, room: null, you: null,
  info: null, v: null, gameNo: 0, myIdx: 0,
  sel: null, selTile: null, hover: null, aiming: false,
  ents: new Map(), fx: [], feed: [], tab: 'feed', mapFilter: 'all', lastChat: 0, shownResult: false,
};
window.app = app;

// ───────────── 연결 ─────────────
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}`);
  app.ws = ws;
  ws.onopen = () => send({ t: 'hello', token: sessionStorage.getItem('defense-token') || localStorage.getItem('defense-token') });
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onclose = () => { toast('서버와 연결이 끊겼어요. 다시 연결하는 중…'); setTimeout(connect, 1500); };
}
function send(msg) { if (app.ws && app.ws.readyState === 1) app.ws.send(JSON.stringify(msg)); }
function cmd(c) { send({ t: 'cmd', c }); }

function onMessage(msg) {
  switch (msg.t) {
    case 'welcome':
      app.token = msg.token;
      app.cat = msg.catalog;
      app.unitMap = Object.fromEntries(app.cat.units.map((u) => [u.id, u]));
      app.leaderMap = Object.fromEntries(app.cat.leaders.map((l) => [l.id, l]));
      app.blessMap = Object.fromEntries(app.cat.blessings.map((b) => [b.id, b]));
      app.bossMap = Object.fromEntries(app.cat.bosses.map((b) => [b.id, b]));
      app.missionMap = Object.fromEntries(app.cat.missions.map((m) => [m.id, m]));
      try { sessionStorage.setItem('defense-token', msg.token); localStorage.setItem('defense-token', msg.token); } catch { /* 무시 */ }
      $('#lan').innerHTML = msg.lan.length ? `같은 와이파이 친구 접속 주소: ${msg.lan.map((u) => `<b>${u}</b>`).join(' 또는 ')}` : '';
      if (!app.room) show('home');
      break;
    case 'room':
      app.room = msg.room;
      app.you = msg.you;
      if (!msg.room.started) { app.info = null; app.v = null; show('room'); renderRoom(); }
      renderChat();
      if (app.info) renderTop();
      break;
    case 'start':
      startView(msg);
      break;
    case 'tick':
      onTick(msg.v);
      break;
    case 'made': {
      // 방금 소환·합성한 유닛을 선택
      app.pendingSelect = msg.id;
      break;
    }
    case 'left':
      app.room = null; app.info = null; app.v = null;
      show('home');
      break;
    case 'error': toast(msg.msg); Sound.play('error'); break;
    default:
  }
}

function show(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id); }
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 2800);
}
function myName() { const n = $('#in-name').value.trim(); try { localStorage.setItem('defense-name', n); } catch { /* 무시 */ } return n; }

// ───────────── 첫 화면 ─────────────
try { $('#in-name').value = localStorage.getItem('defense-name') || ''; } catch { /* 무시 */ }
$('#btn-create').onclick = () => send({ t: 'create', name: myName() });
$('#btn-join').onclick = () => send({ t: 'join', name: myName(), code: $('#in-code').value });
$('#in-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-join').click(); });
for (const b of document.querySelectorAll('.solo')) b.onclick = () => send({ t: 'solo', name: myName(), bot: b.dataset.bot === '1' });
for (const b of document.querySelectorAll('.btn-guide')) b.onclick = openGuide;
for (const b of document.querySelectorAll('.btn-codex')) b.onclick = openCodex;
for (const b of document.querySelectorAll('.btn-sound')) b.onclick = () => { const on = Sound.toggle(); toast(on ? '🔊 소리 켬' : '🔇 소리 끔'); };
const urlCode = new URLSearchParams(location.search).get('room');
if (urlCode) $('#in-code').value = urlCode.toUpperCase();

// ───────────── 대기실 ─────────────
$('#btn-leave').onclick = () => send({ t: 'leave' });
$('#btn-start').onclick = () => send({ t: 'start' });
$('#btn-bot').onclick = () => send({ t: app.room.players.some((p) => p.bot) ? 'removeBot' : 'addBot' });
$('#btn-copy').onclick = () => {
  const lan = $('#lan').textContent.match(/http:\/\/[\d.]+:\d+/);
  const base = location.hostname === 'localhost' && lan ? lan[0] : location.origin;
  const text = `🏮 요괴 퇴마 디펜스 같이 해요!\n주소: ${base}/?room=${app.room.code}\n방 코드: ${app.room.code}`;
  navigator.clipboard?.writeText(text).then(() => toast('초대 문구를 복사했어요!'), () => toast(text));
};

function renderRoom() {
  const r = app.room;
  const host = r.hostId === app.you;
  $('#room-code').textContent = r.code;
  $('#invite-hint').textContent = location.hostname === 'localhost'
    ? '같은 와이파이 친구는 첫 화면 아래 주소로, 멀리 있는 친구는 "npm run share:defense"로 만든 주소로 들어와 방 코드를 입력하면 돼요.'
    : '친구에게 이 주소와 방 코드를 알려 주세요.';
  // 플레이어
  const slots = [];
  for (let i = 0; i < 2; i++) {
    const p = r.players[i];
    if (!p) { slots.push(`<div class="rp empty" style="--c:#555">빈자리 — 친구를 기다리는 중… ${host ? '(또는 🤖 AI 동료 넣기)' : ''}</div>`); continue; }
    const L = p.leader && app.leaderMap[p.leader];
    slots.push(`<div class="rp" style="--c:${p.color}"><span class="dot ${p.connected ? '' : 'off'}"></span><span class="nm">${esc(p.name)}</span>${p.id === r.hostId ? ' 👑' : ''}${p.id === app.you ? ' <span class="hint">(나)</span>' : ''}${p.bot ? ' 🤖' : ''}<span class="ld">${L ? `${L.icon} ${esc(L.name)}` : '대장 고르는 중…'}</span></div>`);
  }
  $('#room-players').innerHTML = slots.join('');
  // 대장
  const me = r.players.find((p) => p.id === app.you);
  const bot = r.players.find((p) => p.bot);
  $('#leader-pick').innerHTML = app.cat.leaders.map((l) => {
    const who = r.players.find((p) => p.leader === l.id);
    return `<div class="leader ${who && who.id === app.you ? 'mine' : who ? 'taken' : ''}" data-l="${l.id}" style="border-left:5px solid ${l.color}">
      <div><span class="ic">${l.icon}</span> <span class="nm">${esc(l.name)}</span></div>
      <div class="ps">🔹 ${esc(l.passive)}</div>
      <div class="sk">⚡ ${esc(l.skill.name)}: ${esc(l.skill.desc)} (${l.skill.cd}초)</div>
      ${who ? `<div class="who" style="color:${who.color}">${esc(who.name)}</div>` : ''}
      ${host && bot && !who ? `<button class="small bot-pick" data-l="${l.id}">🤖 AI 동료에게</button>` : ''}
    </div>`;
  }).join('');
  for (const el of document.querySelectorAll('.leader')) el.onclick = (e) => {
    if (e.target.closest('.bot-pick')) { send({ t: 'pickLeader', leader: el.dataset.l, target: bot.id }); return; }
    send({ t: 'pickLeader', leader: me && me.leader === el.dataset.l ? null : el.dataset.l });
    Sound.play('click');
  };
  // 설정
  const s = r.settings;
  $('#room-settings').innerHTML = `
    <label>난이도 <select id="set-diff" ${host ? '' : 'disabled'}>${app.cat.difficulties.map((d) => `<option value="${d.id}" ${d.id === s.difficulty ? 'selected' : ''}>${d.name}</option>`).join('')}</select></label>
    <label><input type="checkbox" id="set-endless" ${s.endless ? 'checked' : ''} ${host ? '' : 'disabled'}> ♾ 무한 모드 (40웨이브 뒤에도 계속)</label>
    ${host ? '' : '<span class="hint">설정은 방장이 정해요</span>'}`;
  if (host) {
    $('#set-diff').onchange = (e) => send({ t: 'setSettings', settings: { difficulty: e.target.value } });
    $('#set-endless').onchange = (e) => send({ t: 'setSettings', settings: { endless: e.target.checked } });
  }
  renderMaps();
  $('#btn-start').disabled = !host;
  $('#btn-start').textContent = host ? (r.players.length < 2 ? '혼자 출진! ▶' : '둘이서 출진! ▶') : '방장이 시작하기를 기다리는 중…';
  $('#btn-bot').classList.toggle('hidden', !host || (r.players.length >= 2 && !bot));
  $('#btn-bot').textContent = bot ? '🤖 AI 동료 빼기' : '🤖 AI 동료 넣기';
}

const KIND_FILTERS = [['all', '전체'], ['외길', '외길'], ['긴 외길', '긴 외길'], ['결계 돌격', '결계 돌격'], ['순환', '순환'], ['큰 순환', '큰 순환']];
function renderMaps() {
  const r = app.room;
  const host = r.hostId === app.you;
  const maps = app.cat.maps;
  $('#map-count').textContent = `— 총 ${maps.length}개 + 매번 새로 만드는 무작위 맵`;
  $('#map-filter').innerHTML = KIND_FILTERS.map(([k, n]) => `<button class="small ${app.mapFilter === k ? 'on' : ''}" data-k="${k}">${n}</button>`).join('');
  for (const b of document.querySelectorAll('#map-filter button')) b.onclick = () => { app.mapFilter = b.dataset.k; renderMaps(); };
  const list = maps.filter((m) => app.mapFilter === 'all' || m.kindName === app.mapFilter);
  const cur = r.settings.map;
  const special = [
    { id: 'random', icon: '🎲', name: '완전 무작위 맵', note: '매판 길을 새로 만들어요' },
    { id: 'pick', icon: '🎰', name: '맵 뽑기', note: `${maps.length}개 중 하나를 무작위로` },
  ];
  $('#map-list').innerHTML = (app.mapFilter === 'all' ? special.map((m) => `<div class="map-item ${cur === m.id ? 'sel' : ''}" data-m="${m.id}"><div class="special">${m.icon}</div><div class="mn">${m.name}</div><div class="mk">${m.note}</div></div>`).join('') : '')
    + list.map((m) => `<div class="map-item ${cur === m.id ? 'sel' : ''}" data-m="${m.id}"><canvas width="96" height="60" data-thumb="${m.id}"></canvas><div class="mn">${esc(m.name)}</div><div class="mk">${esc(m.kindName)} · ${esc(app.cat.themes[m.theme].name)}</div></div>`).join('');
  for (const c of document.querySelectorAll('[data-thumb]')) drawThumb(c, app.cat.maps.find((m) => m.id === c.dataset.thumb));
  for (const el of document.querySelectorAll('.map-item')) el.onclick = () => { if (host) { send({ t: 'setSettings', settings: { map: el.dataset.m } }); Sound.play('click'); } else toast('맵은 방장이 골라요.'); };
}
function drawThumb(c, m) {
  const g = c.getContext('2d');
  const th = app.cat.themes[m.theme];
  const s = c.width / m.W;
  g.fillStyle = th.ground; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = th.edge; for (const [x, y] of m.decor) g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
  g.fillStyle = th.path; for (const [x, y] of m.pathTiles) g.fillRect(x * s, y * s, s, s);
  g.fillStyle = '#f84'; for (const p of m.paths) { const [x, y] = p.pts[0]; g.fillRect(Math.max(0, Math.min(m.W - 1, x)) * s, Math.max(0, Math.min(m.H - 1, y)) * s, s, s); }
}

// ───────────── 채팅 ─────────────
for (const f of document.querySelectorAll('[data-chat]')) f.onsubmit = (e) => {
  e.preventDefault();
  const i = f.querySelector('input');
  if (i.value.trim()) send({ t: 'chat', text: i.value });
  i.value = '';
  i.blur();
};
function renderChat() {
  if (!app.room) return;
  const html = app.room.chat.map((c) => `<div><b>${esc(c.name)}</b>: ${esc(c.text)}</div>`).join('');
  for (const el of [$('#room-chat'), $('#game-chat')]) { el.innerHTML = html; el.scrollTop = el.scrollHeight; }
  const last = app.room.chat[app.room.chat.length - 1];
  if (last && last.at > app.lastChat && app.info && app.tab !== 'chat') { if (app.lastChat) toast(`💬 ${last.name}: ${last.text}`); }
  if (last) app.lastChat = last.at;
}
for (const b of document.querySelectorAll('.tabs button')) b.onclick = () => {
  app.tab = b.dataset.tab;
  for (const x of document.querySelectorAll('.tabs button')) x.classList.toggle('on', x === b);
  $('#feed').classList.toggle('hidden', app.tab !== 'feed');
  $('#chat').classList.toggle('hidden', app.tab !== 'chat');
};

// ───────────── 게임 시작 ─────────────
const canvas = $('#board');
const ctx = canvas.getContext('2d');
let bgCanvas = null;

function startView(msg) {
  const fresh = msg.gameNo !== app.gameNo;
  app.info = msg.info;
  app.gameNo = msg.gameNo;
  app.myIdx = Math.max(0, msg.info.players.findIndex((p) => p.id === msg.you));
  if (fresh || !app.viewField) app.viewField = 'm' + app.myIdx;
  if (fresh) { app.ents.clear(); app.fx = []; app.feed = []; app.sel = null; app.selTile = null; app.aiming = false; app.shownResult = false; app.v = null; $('#feed').innerHTML = ''; closeModal(); }
  const m = msg.info.map;
  bgCanvas = drawBackground(fieldMap(app.viewField));
  show('game');
  setup3d();
  if (!app.use3d) { canvas.width = m.W * T; canvas.height = m.H * T; }
  if (fresh) {
    addFeed(`🗺 맵 「${m.name}」 (${m.kindName}) · 난이도 ${msg.info.diff.name}`, 'wave');
    addFeed(msg.info.loopMode ? `🔁 순환 맵: 입구에서 나온 요괴가 빙글빙글 돌아요. 살아 있는 요괴가 ${msg.info.diff.limit}마리가 되면 패배! 보스는 ${app.cat.bossTime}초 안에 잡아야 해요.` : `⚔ 요괴가 입구(보라색 소용돌이)에서 몰려와요! 끝(⛩️)에 닿으면 생명이 줄어요 (보스는 -10). 둘은 각자 자기 전장을 막고, 📖 보스방에서는 함께 싸워요.`, 'info');
    addFeed('💡 Q 소환 → 같은 유닛 3개면 F(랜덤 합성, Lv3까지) · H·LVX는 📜 족보(R)로! 유닛 클릭 후 빈칸 클릭으로 이동.', 'info');
  }
}

/** 3D 전장 준비 (three.js 모듈이 늦게 오면 도착했을 때 다시) */
function setup3d() {
  if (!app.info || !window.Board3D) return;
  if (!Board3D.ok && !Board3D.init($('.board-wrap'), canvas)) return;
  app.use3d = true;
  $('.board-wrap').classList.add('is3d');
  Board3D.setup(fieldMap(app.viewField), app.cat);
  Board3D.resize();
}

// ───────────── 전장 (내 전장 · 동료 전장 · 내 보스방 · 스토리 이벤트) ─────────────
function fieldMap(fid) {
  const mp = app.info.maps;
  if (!mp) return app.info.map;
  return fid[0] === 'm' ? mp.main : fid === 'room' ? mp.room : mp.event;
}
function fieldName(fid) {
  if (fid === 'ev') return '스토리 이벤트 전장';
  if (fid === 'room') return '보스방 (함께)';
  const i = Number(fid.slice(1));
  const who = i === app.myIdx ? '내' : `${app.info.players[i] ? app.info.players[i].name : '?'}의`;
  return fid[0] === 'm' ? `${who} 전장` : `${who} 보스방`;
}
function switchField(fid) {
  if (fid === app.viewField) return;
  app.viewField = fid;
  app.ents.clear();
  app.fx = [];
  app.selTile = null;
  app.aiming = false;
  bgCanvas = drawBackground(fieldMap(fid));
  if (app.use3d) Board3D.setup(fieldMap(fid), app.cat);
  if (app.v) filterView();
  renderFieldTabs();
  renderControls.key = null;
  Sound.play('click');
}
function filterView() {
  const v = app.v;
  app.fu = v.units.filter((u) => (u[8] || 'm0') === app.viewField);
  app.vf = { ...v, units: app.fu, zones: v.zones.filter((z) => (z[3] || 'm0') === app.viewField), boss: (v.fields || []).find((f) => f.id === app.viewField)?.boss };
}
function renderFieldTabs() {
  const v = app.v;
  if (!v || !v.fields) return;
  const me = app.myIdx;
  const tabs = [];
  const fst = (id) => v.fields.find((f) => f.id === id);
  const lifeTxt = (f) => (app.info.loopMode ? `👹${f.count}/${f.limit}` : `❤️${f.lives}`);
  for (const p of app.info.players.map((x, i) => i)) {
    const f = fst('m' + p);
    if (!f) continue;
    const danger = app.info.loopMode ? f.count / f.limit > 0.7 : f.lives <= 5;
    tabs.push(`<button data-f="m${p}" class="${app.viewField === 'm' + p ? 'cur' : ''} ${danger ? 'danger' : ''}">${p === me ? '🏯 내 전장' : `👀 ${esc(app.info.players[p].name)}`} <small>${lifeTxt(f)}</small></button>`);
  }
  const my = v.players[me];
  const st = v.story;
  tabs.push(`<button data-f="room" class="${app.viewField === 'room' ? 'cur' : ''} ${st.active ? 'alert' : ''}">📖 보스방 (함께) <small>${st.active ? `⏳${st.left}초` : '대기'}</small></button>`);
  void my;
  if (v.event) tabs.push(`<button data-f="ev" class="${app.viewField === 'ev' ? 'cur' : ''} alert">⚔ 스토리 이벤트 <small>⏳${v.event.left}초</small></button>`);
  else tabs.push(`<button disabled title="정해진 웨이브에 열려요">⚔ 스토리 이벤트 <small>${v.nextEvent ? `${v.nextEvent}웨이브` : '끝'}</small></button>`);
  // 보스방·이벤트를 보고 있으면 보내기/돌려보내기
  if (app.viewField === 'ev' || app.viewField === 'room') {
    const n = v.units.filter((u) => u[1] === me && u[8] === app.viewField).length;
    tabs.push('<span style="flex:1"></span>');
    tabs.push(app.viewField === 'room'
      ? `<button data-act="dispatch" title="보스에게 가장 센 내 유닛 하나 (이미 있으면 교대)">⚔ 가장 센 유닛 보내기</button><button data-act="recall" ${n ? '' : 'disabled'}>↩ 돌려보내기</button>`
      : `<button data-act="dispatch">⚔ 정예 3명 보내기</button><button data-act="recall" ${n ? '' : 'disabled'}>↩ 돌려보내기 (${n})</button>`);
  }
  setHTML($('#fieldtabs'), tabs.join(''));
  void room;
}
onPress($('#fieldtabs'), (b) => {
  if (b.dataset.f) switchField(b.dataset.f);
  else if (b.dataset.act === 'dispatch') { cmd({ t: 'dispatch', field: app.viewField, n: app.viewField === 'room' ? 1 : 3 }); Sound.play('rare'); }
  else if (b.dataset.act === 'recall') cmd({ t: 'recall', field: app.viewField });
});
app.on3dReady = () => { if (app.info && !app.use3d && !$('#game').classList.contains('hidden')) setup3d(); };
app.Sound = Sound;

function drawBackground(m) {
  const c = document.createElement('canvas');
  c.width = m.W * T; c.height = m.H * T;
  const g = c.getContext('2d');
  const th = app.cat.themes[m.theme];
  for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) { g.fillStyle = (x + y) % 2 ? th.ground : th.ground2; g.fillRect(x * T, y * T, T, T); }
  // 길
  const path = new Set(m.pathTiles.map(([x, y]) => x + ',' + y));
  g.fillStyle = th.edge;
  for (const [x, y] of m.pathTiles) g.fillRect(x * T - 3, y * T - 3, T + 6, T + 6);
  g.fillStyle = th.path;
  for (const [x, y] of m.pathTiles) g.fillRect(x * T, y * T, T, T);
  // 길 무늬 (돌)
  g.fillStyle = '#0001';
  for (const [x, y] of m.pathTiles) if ((x * 7 + y * 13) % 3 === 0) { g.beginPath(); g.arc(x * T + 14 + ((x * 5) % 20), y * T + 16 + ((y * 3) % 18), 4, 0, 7); g.fill(); }
  // 방향 화살표
  g.fillStyle = '#fff4';
  g.font = `${T * 0.45}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const p of m.paths) {
    for (let i = 0; i < p.pts.length - (p.loop ? 0 : 1); i++) {
      const a = p.pts[i], b = p.pts[(i + 1) % p.pts.length];
      const mx = Math.round((a[0] + b[0]) / 2), my = Math.round((a[1] + b[1]) / 2);
      if (mx < 0 || my < 0 || mx >= m.W || my >= m.H) continue;
      const ch = b[0] > a[0] ? '▶' : b[0] < a[0] ? '◀' : b[1] > a[1] ? '▼' : '▲';
      g.fillText(ch, mx * T + T / 2, my * T + T / 2);
    }
    // 입구 / 끝
    const s = p.pts[0];
    const sx = Math.max(0, Math.min(m.W - 1, s[0])), sy = Math.max(0, Math.min(m.H - 1, s[1]));
    g.font = `${T * 0.7}px sans-serif`;
    g.fillText(p.loop ? '🌀' : '🕳️', sx * T + T / 2, sy * T + T / 2);
    if (!p.loop) { const e = p.pts[p.pts.length - 1]; g.fillText('⛩️', Math.max(0, Math.min(m.W - 1, e[0])) * T + T / 2, Math.max(0, Math.min(m.H - 1, e[1])) * T + T / 2); }
    g.font = `${T * 0.45}px sans-serif`;
  }
  // 장식
  g.font = `${T * 0.66}px sans-serif`;
  for (const [x, y, ch] of m.decor) g.fillText(ch, x * T + T / 2, y * T + T / 2 + 2);
  // 격자
  g.strokeStyle = '#0000000f';
  for (let x = 0; x <= m.W; x++) { g.beginPath(); g.moveTo(x * T, 0); g.lineTo(x * T, m.H * T); g.stroke(); }
  for (let y = 0; y <= m.H; y++) { g.beginPath(); g.moveTo(0, y * T); g.lineTo(m.W * T, y * T); g.stroke(); }
  c.blocked = new Set([...path, ...m.decor.map(([x, y]) => x + ',' + y)]);
  return c;
}

// ───────────── 상태 받기 ─────────────
function onTick(v) {
  if (!app.info) return;
  const prev = app.v;
  app.v = v;
  const now = performance.now();
  // 요괴 위치 보간 준비
  const seen = new Set();
  for (const e of v.enemies) {
    if ((e[6] || 'm0') !== app.viewField) continue;
    const [id, k, x100, y100, hp, fl] = e;
    const x = x100 / 100, y = y100 / 100;
    seen.add(id);
    let ent = app.ents.get(id);
    if (!ent) { ent = { id, k, fx: x, fy: y, tx: x, ty: y, t0: now }; app.ents.set(id, ent); }
    const p = entPos(ent, now);
    ent.fx = p.x; ent.fy = p.y; ent.tx = x; ent.ty = y; ent.t0 = now; ent.hp = hp; ent.fl = fl; ent.k = k;
  }
  for (const id of [...app.ents.keys()]) if (!seen.has(id)) app.ents.delete(id);
  // 효과
  filterView();
  for (const f0 of v.fx) {
    const where = f0[0];
    const f = f0.slice(1);
    if (f[0] === 'story') { onStoryFx(f); continue; }
    if (f[0] === 'hidden') { rememberHidden(f[1]); continue; }
    if (f[0] === 'reveal') { rememberReveal(f[1], f[2]); continue; }
    if (where !== '*' && where !== app.viewField) { if (f[0] === 'leak' && where === 'm' + app.myIdx) { Sound.play('leak'); toast('💔 내 전장에서 요괴가 빠져나갔어요!'); } continue; }
    if (app.use3d) Board3D.fx(f, app); else addFx(f, now);
  }
  for (const m of v.msgs) {
    addFeed(m.text, m.kind);
    if (m.kind === 'boss') { banner(m.text.replace(/^⚠ /, '').split('!')[0] + '!'); Sound.play('boss'); }
    else if (m.kind === 'wave') Sound.play('wave');
    else if (m.kind === 'myth') { banner('🌈 신화 등장!'); Sound.play('myth'); }
    else if (m.kind === 'legend') Sound.play('legend');
    else if (m.kind === 'skill') Sound.play('skill');
    if (m.text.includes('영웅 「')) { banner(m.text.replace(/^.*?영웅 /, '🦸 ')); Sound.play('hero'); }
  }
  if (app.pendingSelect) { const u = v.units.find((x) => x[0] === app.pendingSelect); if (u) { app.sel = u[0]; app.selTile = null; } app.pendingSelect = null; }
  if (app.sel && !v.units.some((u) => u[0] === app.sel && u[1] === app.myIdx)) app.sel = null;
  renderTop();
  renderControls();
  renderTeam();
  renderSelected();
  renderNext();
  renderBless();
  renderHeroPick();
  renderFieldTabs();
  renderSideTabs();
  if (app.drawer) renderDrawer();
  if (v.result && !app.shownResult) { app.shownResult = true; setTimeout(showResult, 900); Sound.play(v.result.win ? 'win' : 'lose'); }
  if (prev && prev.wave !== v.wave && v.wave) banner(`${v.wave}웨이브`);
}
function entPos(ent, now) {
  const t = Math.min(1, (now - ent.t0) / 105);
  return { x: ent.fx + (ent.tx - ent.fx) * t, y: ent.fy + (ent.ty - ent.fy) * t };
}

function addFeed(text, kind = 'info') {
  const el = $('#feed');
  const d = document.createElement('div');
  d.className = kind;
  d.textContent = text;
  el.appendChild(d);
  while (el.children.length > 80) el.firstChild.remove();
  el.scrollTop = el.scrollHeight;
}
function banner(text) {
  const b = $('#banner');
  b.textContent = text;
  b.classList.remove('hidden');
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(banner.t);
  banner.t = setTimeout(() => b.classList.add('hidden'), 2200);
}

const me = () => app.v && app.v.players[app.myIdx];
/** 내용이 바뀌었을 때만 다시 그림 (버튼 클릭이 끊기지 않게) */
function setHTML(el, html) { if (el._html !== html) { el._html = html; el.innerHTML = html; } }
/** 자주 다시 그리는 곳의 버튼은 누르는 순간(pointerdown) 처리 */
function onPress(el, fn) {
  el.addEventListener('pointerdown', (e) => { const b = e.target.closest('button'); if (!b || b.disabled || e.button > 0) return; e.preventDefault(); fn(b); });
  el.addEventListener('click', (e) => { if (e.target.closest('button')) e.preventDefault(); });
}
const mate = () => app.v && app.v.players.find((p, i) => i !== app.myIdx);

// ───────────── 위쪽 막대 ─────────────
function renderTop() {
  const v = app.v;
  if (!v) return;
  const host = app.room && app.room.hostId === app.you;
  const loop = app.info.loopMode;
  const myF = (v.fields || []).find((f) => f.id === 'm' + app.myIdx) || { lives: 0, limit: 1, count: 0 };
  const viewF = (v.fields || []).find((f) => f.id === app.viewField);
  const danger = loop ? myF.count / myF.limit : 1 - myF.lives / app.info.diff.lives;
  const others = (v.fields || []).filter((f) => f.id[0] === 'm' && f.id !== 'm' + app.myIdx);
  const vboss = viewF && viewF.boss;
  const waveTxt = v.wave ? `${v.wave}${v.endless ? '' : ` / ${v.waves}`} 웨이브` : '준비!';
  setHTML($('#topbar'), `
    <span class="wv">${waveTxt}</span>
    <span class="stat">${v.lastWave ? '🏁 마지막 웨이브!' : `⏱ 다음 웨이브 ${v.nextIn}초`}</span>
    ${loop
    ? `<span class="bar ${danger < 0.5 ? 'safe' : ''}" title="내 전장에 살아 있는 요괴 수 (보스 10, 우두머리 3)"><i style="width:${Math.min(100, danger * 100)}%"></i><span>내 전장 👹 ${myF.count} / ${myF.limit}</span></span>`
    : `<span class="bar ${danger < 0.5 ? 'safe' : ''}" title="내 전장 생명"><i style="width:${Math.max(0, (myF.lives / app.info.diff.lives) * 100)}%"></i><span>내 전장 ❤️ ${myF.lives} / ${app.info.diff.lives}</span></span>`}
    ${others.map((f) => `<span class="stat hint">동료 ${loop ? `👹${f.count}/${f.limit}` : `❤️${f.lives}`}</span>`).join('')}
    ${vboss ? `<span class="bar bossbar"><i style="width:${(vboss.hp / vboss.max) * 100}%"></i><span>${esc(vboss.name)} ${fmt(vboss.hp)}${vboss.left != null ? ` · ⏳${vboss.left}초` : ''}</span></span>` : ''}
    ${v.sealed ? '<span class="stat">⛩️ 결계!</span>' : ''}
    <span class="sp"></span>
    ${v.paused ? '<span class="stat" style="color:#f88">⏸ 일시정지</span>' : ''}
    <button class="small" id="btn-pause">${v.paused ? '▶ 계속' : '⏸ 정지'} <kbd>P</kbd></button>
    ${host ? `<button class="small" id="btn-speed">⏩ ${v.speed}배속</button>` : `<span class="hint">${v.speed}배속</span>`}
    <button class="small" id="btn-codex2">📚 도감</button>
    <button class="small" id="btn-help">❔</button>
    <button class="small" id="btn-sound2">${Sound.on ? '🔊' : '🔇'}</button>
    ${host ? '<button class="small danger" id="btn-quit">그만하기</button>' : ''}`);
}
onPress($('#topbar'), (b) => {
  const v = app.v;
  if (b.id === 'btn-pause') send({ t: 'pause' });
  else if (b.id === 'btn-speed') send({ t: 'speed', speed: (v.speed % 3) + 1 });
  else if (b.id === 'btn-codex2') openCodex();
  else if (b.id === 'btn-help') openGuide();
  else if (b.id === 'btn-sound2') { Sound.toggle(); renderTop(); }
  else if (b.id === 'btn-quit') setTimeout(() => { if (confirm('게임을 그만두고 대기실로 돌아갈까요?')) send({ t: 'backToLobby', force: true }); }, 0);
});
function fmt(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : String(n); }

// ───────────── 아래 조작판 ─────────────
function renderControls() {
  const p = me();
  if (!p) return;
  const L = app.leaderMap[app.info.players[app.myIdx].leader];
  const cats = app.cat.cats;
  const key = JSON.stringify([p.gold, p.cost, p.pcost, p.ucost, p.upg, p.skillCd, app.aiming, p.units, app.selTile, app.sellMenu, p.autoGather, app.sellMenu ? app.v.units.filter((u) => u[1] === app.myIdx).map((u) => u[2]).join() : '']);
  if (key === renderControls.key) return;
  renderControls.key = key;
  const cdPct = p.skillCd > 0 ? (p.skillCd / p.skillMax) * 100 : 0;
  $('#controls').innerHTML = `
    <div class="gold">💰 ${p.gold}</div>
    <button class="btn-summon" data-a="summon" ${p.gold < p.cost ? 'disabled' : ''}>🎲 소환 <kbd>Q</kbd><small>${p.cost}G · 소환진에</small></button>
    <button class="btn-premium" data-a="premium" ${p.gold < p.pcost ? 'disabled' : ''}>💎 고급 소환 <kbd>W</kbd><small>${p.pcost}G · Lv2 이상</small></button>
    <div class="grp">${Object.entries(cats).map(([id, c], i) => `<button data-a="up" data-c="${id}" ${p.gold < p.ucost[id] ? 'disabled' : ''} title="${c.name} 유닛 피해 +12%">${c.icon} ${c.name} +${p.upg[id]} <kbd>${i + 1}</kbd><small>${p.ucost[id]}G</small></button>`).join('')}</div>
    <div class="grp"><button class="btn-skill ${app.aiming ? 'aim' : ''}" data-a="skill" ${p.skillCd > 0 ? 'disabled' : ''} title="${esc(L.skill.desc)}">${L.icon} ${esc(L.skill.name)} <kbd>E</kbd><small>${p.skillCd > 0 ? `${p.skillCd}초` : L.skill.target ? '위치 선택' : '바로 사용'}</small><span class="cdv" style="height:${cdPct}%"></span></button></div>
    <div class="grp"><button data-a="clearZone" title="소환진에 있는 내 유닛을 모두 길 옆 빈자리로">📦 소환진 비우기 <kbd>Z</kbd><small>길 옆으로 자동 배치</small></button><button data-a="autoGather" class="${p.autoGather ? 'on' : ''}" title="켜 두면 유닛 하나를 옮길 때 내 전장의 같은 유닛이 모두 따라와요">🧲 자동 모으기<small>${p.autoGather ? '켬 · 같은 유닛 따라옴' : '끔'}</small></button><button data-a="sellMenu" class="${app.sellMenu ? 'on' : ''}">💰 일괄 판매<small>등급별로 한꺼번에</small></button><button data-a="gift" ${app.v.players.length < 2 ? 'disabled' : ''}>🎁 골드 선물<small>동료에게 100G</small></button></div>
    ${app.sellMenu ? `<div class="sellmenu">${[1, 2, 3, 4, 5].map((tr) => { const list = app.v.units.filter((u) => u[1] === app.myIdx && app.unitMap[u[2]].tier === tr && !app.unitMap[u[2]].hero && !app.unitMap[u[2]].hidden); const tt = app.cat.tiers[tr - 1]; return `<button data-a="sellTier" data-c="${tr}" ${list.length ? '' : 'disabled'} style="border-color:${tt.color}"><b style="color:${tt.color}">${tt.name} 전부</b><small>${list.length}개 · +${sellTotal(list)}G</small></button>`; }).join('')}<span class="hint">영웅·히든은 팔지 않아요</span></div>` : ''}
    <div class="hint" style="align-self:center">유닛 ${p.units}/${app.cat.econ.maxUnits}</div>`;
}
onPress($('#controls'), (b) => action(b.dataset.a, b.dataset.c));
function sellOne(t) { return Math.round(app.cat.econ.sellRate[t.tier] * (app.info.players[app.myIdx].leader === 'merchant' ? 1.2 : 1)); }
function sellTotal(list) { return list.reduce((s, u) => { const t = app.unitMap[u[2]]; return s + (t.hero || t.hidden ? 0 : sellOne(t)); }, 0); }
function action(a, c) {
  const p = me();
  if (!p) return;
  if (a === 'summon' || a === 'premium') {
    cmd({ t: 'summon', premium: a === 'premium' });
    if (app.viewField !== 'm' + app.myIdx) toast('소환한 유닛은 내 전장의 소환진에 나와요.');
    Sound.play(a === 'premium' ? 'rare' : 'summon');
  } else if (a === 'up') { cmd({ t: 'upgrade', cat: c }); Sound.play('upgrade'); }
  else if (a === 'skill') {
    const L = app.leaderMap[app.info.players[app.myIdx].leader];
    if (p.skillCd > 0) return toast(`필살기 준비 중 (${p.skillCd}초)`);
    if (L.skill.target) { app.aiming = !app.aiming; renderControls.key = null; renderControls(); if (app.aiming) toast('전장에서 필살기를 쓸 곳을 누르세요 (Esc 취소)'); }
    else cmd({ t: 'skill' });
  } else if (a === 'gift') { const amt = Math.min(100, p.gold); if (amt > 0) { cmd({ t: 'gift', amount: amt }); Sound.play('sell'); } }
  else if (a === 'merge' && app.sel) { cmd({ t: 'merge', unit: app.sel }); Sound.play('merge'); }
  else if (a === 'clearZone') { cmd({ t: 'clearZone' }); Sound.play('click'); }
  else if (a === 'autoGather') { cmd({ t: 'setAuto', on: !p.autoGather }); Sound.play('click'); }
  else if (a === 'sellSel') {
    const ids = app.multi && app.multi.length ? app.multi : app.sel ? [app.sel] : [];
    if (ids.length) { cmd({ t: 'sellMany', units: ids }); clearSel(); Sound.play('sell'); renderSelected(); }
  } else if (a === 'sellMenu') { app.sellMenu = !app.sellMenu; renderControls.key = null; renderControls(); }
  else if (a === 'sellTier') {
    const tt = app.cat.tiers[Number(c) - 1];
    setTimeout(() => { if (confirm(`${tt.name} 등급 유닛을 전부 팔까요? (영웅·히든 제외)`)) { cmd({ t: 'sellTier', tier: Number(c) }); Sound.play('sell'); } }, 0);
  }
  else if (a === 'autoPlace') { const ids = app.multi && app.multi.length ? app.multi : app.sel ? [app.sel] : []; if (ids.length) { cmd({ t: 'autoPlace', units: ids }); clearSel(); Sound.play('click'); } }
  else if (a === 'gather') { const id = app.sel || (app.multi && app.multi[0]); if (id) { cmd({ t: 'gather', unit: id }); Sound.play('click'); } }
  else if (a === 'clearSel') { clearSel(); renderSelected(); }
  else if (a === 'sell' && app.sel) { cmd({ t: 'sell', unit: app.sel }); const rest = (app.multi || []).filter((id) => id !== app.sel); clearSel(); if (rest.length) { app.sel = rest[0]; if (rest.length > 1) app.multi = rest; } Sound.play('sell'); }
}

// ───────────── 오른쪽: 팀 / 선택 / 다음 웨이브 / 축복 ─────────────
function renderTeam() {
  const v = app.v;
  setHTML($('#team'), v.players.map((p, i) => {
    const info = app.info.players[i];
    const L = app.leaderMap[info.leader];
    const color = app.cat.colors[i];
    return `<div class="tm" style="--c:${color}">
      <div class="h"><span>${esc(info.name)}${i === app.myIdx ? ' (나)' : ''}${info.bot ? ' 🤖' : ''}</span><span>💰 ${p.gold}</span></div>
      <div>${L.icon} ${esc(L.name)} · 필살기 ${p.skillCd > 0 ? `${p.skillCd}초` : '<b style="color:#8f8">준비!</b>'}</div>
      <div class="hint">유닛 ${p.units} · 처치 ${p.kills} · 피해 ${fmt(p.damage)} · 강화 ⚔${p.upg.blade} 🏹${p.upg.bow} 🔮${p.upg.magic}${p.rain ? ' · 💰황금비' : ''}${p.temper ? ' · 🔥담금질' : ''}</div>
      ${p.bless.length ? `<div class="bl" title="${p.bless.map((b) => app.blessMap[b].name).join(', ')}">${p.bless.map((b) => app.blessMap[b].icon).join('')}</div>` : ''}
    </div>`;
  }).join(''));
}

function unitCounts(owner) {
  const c = {};
  for (const u of app.v.units) if (u[1] === owner) c[u[2]] = (c[u[2]] || 0) + 1;
  return c;
}
function renderSelected() {
  const el = $('#selected');
  if (app.multi && app.multi.length) app.multi = app.multi.filter((id) => app.v.units.some((u) => u[0] === id));
  const mlist = app.multi && app.multi.length ? app.v.units.filter((u) => app.multi.includes(u[0])) : [];
  const isStack = mlist.length > 1 && mlist.every((u) => u[2] === mlist[0][2] && u[3] === mlist[0][3] && u[4] === mlist[0][4] && u[8] === mlist[0][8]);
  if (isStack && !mlist.some((u) => u[0] === app.sel)) app.sel = mlist[0][0];
  if (mlist.length > 1 && !isStack) {
    const list = mlist;
    const cnt = {};
    for (const u of list) cnt[u[2]] = (cnt[u[2]] || 0) + 1;
    setHTML(el, `<div class="un">🖱 ${list.length}명 선택</div>
      <div>${Object.entries(cnt).map(([id, n]) => `${app.unitMap[id].icon} ${esc(app.unitMap[id].name)} ×${n}`).join(' · ')}</div>
      <div class="hint">빈칸을 클릭하면 그 주변으로 한꺼번에 이동해요.</div>
      <div class="acts"><button class="small" data-a="autoPlace">🛡 길 옆으로 자동 배치 <kbd>A</kbd></button><button class="small danger" data-a="sellSel">💰 선택 전부 팔기 +${sellTotal(list)}G <kbd>⇧S</kbd></button><button class="small" data-a="clearSel">선택 해제</button></div>
      ${list.some((u) => app.unitMap[u[2]].hero || app.unitMap[u[2]].hidden) ? '<div class="hint">영웅·히든 유닛은 팔지 않아요.</div>' : ''}`);
    return;
  }
  const u = app.sel && app.v.units.find((x) => x[0] === app.sel);
  const hu = !u && app.hover && (app.fu || []).find((x) => x[3] === app.hover.x && x[4] === app.hover.y);
  const show = u || hu;
  if (!show) {
    const cnt = unitCounts(app.myIdx);
    const ready = Object.entries(cnt).filter(([id, n]) => app.cat.mergeNeed[app.unitMap[id].tier] && n >= app.cat.mergeNeed[app.unitMap[id].tier]);
    setHTML(el, `<div class="hint">유닛을 누르면 정보가 보여요.<br><b>Q</b> 소환 → 유닛은 <b>소환진</b>(노란 마법진)에 나와요 · 유닛 클릭 후 빈칸 클릭 = 이동 · <b>드래그</b>로 여러 명 선택 · <b>더블클릭</b>으로 같은 유닛 모두 선택 · <b>Z</b> 소환진 비우기 · <b>G</b> 위치 알림</div>
      ${ready.length ? `<div style="margin-top:6px">✨ 합성 가능: ${ready.map(([id, n]) => `<button class="small" data-merge="${id}">${app.unitMap[id].icon} ${esc(app.unitMap[id].name)} ×${n}</button>`).join(' ')}</div>` : ''}`);
    return;
  }
  const [id, owner, type, , , dmg, lvl, kills, ufield] = show;
  const t = app.unitMap[type];
  const tier = app.cat.tiers[t.tier - 1];
  const mine = owner === app.myIdx;
  const need = app.cat.mergeNeed[t.tier];
  const have = unitCounts(owner)[type] || 0;
  const cat = app.cat.cats[t.cat];
  setHTML(el, `<div class="un">${t.icon} ${esc(t.name)} <span class="tier-tag" style="background:${tier.color}">${tier.name}</span>${isStack ? ` <span class="tier-tag" style="background:#ffd040">×${mlist.length} 무리</span>` : ''}</div>
    <div class="hint">${cat.icon} ${cat.name} · 피해 ${t.dmg} · ${(1 / t.cd).toFixed(1)}회/초 · 사거리 ${t.range}${t.cat === 'blade' ? ' · 날아다니는 적 공격 불가' : ''}</div>
    <div>${esc(t.desc)}</div>
    <div class="hint">누적 피해 ${fmt(dmg)} · ${mine ? '내 유닛' : `${esc(app.info.players[owner].name)}의 유닛`} · 📍${esc(fieldName(ufield || 'm0'))}${need ? ` · 같은 유닛 ${have}/${need}` : ''}</div>
    ${mine && u ? `<div class="acts">${ufield !== 'm' + app.myIdx ? '<button class="small" data-send="home">↩ 내 전장으로</button>' : ''}${ufield !== 'room' ? '<button class="small" data-send="room" title="보스방에는 한 사람당 한 명 (있으면 교대)">📖 이 유닛을 보스방으로</button>' : ''}${app.v.event && ufield !== 'ev' ? '<button class="small" data-send="ev">⚔ 이벤트로</button>' : ''}</div>` : ''}
    ${mine && u ? `<div class="acts"><button class="small" data-a="gather" ${(unitCounts(app.myIdx)[type] || 0) < 2 ? 'disabled' : ''}>🧲 같은 유닛 모으기 (${unitCounts(app.myIdx)[type] || 0}) <kbd>D</kbd></button><button class="small" data-a="autoPlace">🛡 길 옆으로 <kbd>A</kbd></button></div>` : ''}
    ${mine && u ? recipeHints(type) : ''}
    ${t.hero ? `<div style="color:#8ff0e0"><b>Lv.${lvl}</b> / 10 · 처치 ${kills} · 피해 +${(lvl - 1) * 12}% (요괴를 잡을수록 성장)</div>` : ''}
    ${mine && u && t.hero ? '<div class="acts"><span class="hint">영웅은 합성·판매하지 않아요 · 빈칸 클릭 = 이동</span></div>' : ''}
    ${mine && u && !t.hero ? `<div class="acts">
      ${need ? `<button class="small primary" data-a="merge" ${have < need ? 'disabled' : ''}>✨ 합성 <kbd>F</kbd></button>` : '<span class="hint">최고 등급!</span>'}
      <button class="small" data-a="sell">💰 ${isStack ? '한 마리 ' : ''}판매 ${sellOne(t)}G <kbd>S</kbd></button>
      ${isStack ? `<button class="small danger" data-a="sellSel">💰 무리 전부 팔기 (${mlist.length}) +${sellOne(t) * mlist.length}G <kbd>⇧S</kbd></button>` : ''}
      <span class="hint">빈칸 클릭 = 이동</span></div>` : ''}`);
}
onPress($('#selected'), (b) => {
  if (b.dataset.merge) { const x = app.v.units.find((q) => q[1] === app.myIdx && q[2] === b.dataset.merge); if (x) { cmd({ t: 'merge', unit: x[0] }); Sound.play('merge'); } }
  else if (b.dataset.send) { const f = b.dataset.send === 'home' ? 'm' + app.myIdx : b.dataset.send === 'room' ? 'room' : 'ev'; cmd({ t: 'send', unit: app.sel, field: f }); Sound.play('click'); }
  else if (b.dataset.craft) { cmd({ t: 'craft', recipe: b.dataset.craft, unit: app.sel }); Sound.play('merge'); }
  else if (b.dataset.a) action(b.dataset.a);
});

function renderNext() {
  const v = app.v;
  const n = v.next;
  const c = v.cur;
  const line = (w, label) => w ? `<div><b>${label} ${w.wave}웨이브</b>: ${w.boss ? `${w.boss.icon} <b style="color:#f8a">${esc(w.boss.name)}</b> <span class="hint">${esc(w.boss.desc)}</span>` : `${w.mainIcon} ${esc(w.main)}${w.second ? ` + ${esc(w.second)}` : ''} ×${w.count}${w.mini ? ' + 👿우두머리' : ''}`}${w.mod ? ` <span title="${esc(w.mod.desc)}">· ${w.mod.icon}${esc(w.mod.name)}(${esc(w.mod.desc)})</span>` : ''}${w.flying ? ' <span class="hint">· 🐦‍⬛ 하늘을 날아 검술 유닛이 못 때려요</span>' : ''}</div>` : '';
  const html = line(c, '지금') + (n ? line(n, '다음') : '<div class="hint">마지막 웨이브예요! 남은 요괴를 모두 물리치세요.</div>');
  if (html !== renderNext.html) { $('#nextwave').innerHTML = html; renderNext.html = html; }
}

function renderBless() {
  const p = me();
  const el = $('#bless');
  if (!p || !p.choice) { el.classList.add('hidden'); renderBless.key = null; return; }
  const key = p.choice.join();
  if (key === renderBless.key) return;
  renderBless.key = key;
  Sound.play('bless');
  el.innerHTML = `<b>🌟 축복을 하나 고르세요!</b> <span class="hint">(게임은 계속 진행돼요)</span><div class="opts">${p.choice.map((id) => { const b = app.blessMap[id]; return `<button data-b="${id}"><b>${b.icon}</b>${esc(b.name)}<small>${esc(b.desc)}</small></button>`; }).join('')}</div>`;
  el.classList.remove('hidden');
}
onPress($('#bless'), (b) => { if (b.dataset.b) { cmd({ t: 'bless', id: b.dataset.b }); $('#bless').classList.add('hidden'); } });

function renderHeroPick() {
  const p = me();
  const el = $('#herochoice');
  if (!p || !p.heroChoice) { el.classList.add('hidden'); renderHeroPick.key = null; return; }
  const key = p.heroChoice.join() + '|' + (app.selTile || '');
  if (key === renderHeroPick.key) return;
  renderHeroPick.key = key;
  el.innerHTML = `<b>🦸 영웅 영입권!</b> <span class="hint">데려올 영웅을 고르세요 (소환진에 나와요) · 남은 영입권 ${p.tickets}</span><div class="opts">${p.heroChoice.map((id) => { const h = app.unitMap[id]; return `<button data-h="${id}"><b>${h.icon}</b>${esc(h.name)}<small>${esc(h.desc)}</small></button>`; }).join('')}</div>`;
  el.classList.remove('hidden');
}
onPress($('#herochoice'), (b) => { if (b.dataset.h) { cmd({ t: 'hero', id: b.dataset.h }); } });


// ───────────── 오른쪽 서랍: 조합법 · 미션 · 보스 스토리 ─────────────
function hiddenKnown() {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem('defense-hidden') || '[]'); } catch { /* 무시 */ }
  return new Set([...saved, ...((app.v && app.v.discovered) || [])]);
}
function rememberHidden(id) {
  const k = hiddenKnown();
  const first = !k.has(id);
  k.add(id);
  try { localStorage.setItem('defense-hidden', JSON.stringify([...k])); } catch { /* 무시 */ }
  if (first) { banner('🔮 히든 조합 발견!'); Sound.play('myth'); }
}
/** 히든 조합 족보 힌트 (5웨이브마다 · 게임 승리 시) — 이 컴퓨터에 기억 */
function revealMap() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('defense-reveal') || '{}'); } catch { /* 무시 */ }
  const live = (app.v && app.v.revealed) || {};
  for (const [k, n] of Object.entries(live)) saved[k] = Math.max(saved[k] || 0, n);
  return saved;
}
function rememberReveal(id, n) {
  const m = revealMap();
  m[id] = Math.max(m[id] || 0, n);
  try { localStorage.setItem('defense-reveal', JSON.stringify(m)); } catch { /* 무시 */ }
  const r = app.cat.recipes.find((x) => x.id === id);
  if (r && n >= r.need.length) banner('📜 히든 족보 공개!'); else toast('📜 히든 조합 족보 힌트가 하나 공개됐어요! (📜 조합법)');
  Sound.play('bless');
}
function haveCounts() {
  const c = {};
  for (const u of app.v.units) if (u[1] === app.myIdx) c[u[2]] = (c[u[2]] || 0) + 1;
  return c;
}
function ingChips(r, have, items) {
  // 같은 재료는 묶어서 x2, x3 (보내 준 족보표 형식)
  const order = [];
  const cnt = {};
  for (const n of r.need) { if (!cnt[n]) order.push(n); cnt[n] = (cnt[n] || 0) + 1; }
  return order.map((n) => {
    const k = cnt[n];
    if (n[0] === '#') { const it = app.cat.items[n.slice(1)]; const ok = (items[n.slice(1)] || 0) >= k; return `<span class="ing1 ${ok ? 'ok' : ''}" title="보스 스토리·이벤트 보상"><b style="color:#ff6a8a">재료</b> ${it.icon} ${esc(it.name)}${k > 1 ? ` x${k}` : ''}</span>`; }
    const t = app.unitMap[n];
    const tier = app.cat.tiers[t.tier - 1];
    const h = have[n] || 0;
    return `<span class="ing1 ${h >= k ? 'ok' : ''}" title="가진 수 ${h}/${k}"><b style="color:${tier.color}">${tier.name}</b> ${esc(t.name)}${k > 1 ? ` x${k}` : ''}${h && h < k ? ` <i>(${h})</i>` : ''}</span>`;
  }).join('<span class="plus">+</span>');
}
/** 선택한 유닛이 재료로 들어가는 조합 */
function recipeHints(type) {
  const p = me();
  const known = hiddenKnown();
  const list = app.cat.recipes.filter((r) => r.need.includes(type) && (!r.hidden || known.has(r.id)));
  if (!list.length) return '';
  return `<div style="margin-top:6px"><b>📜 이 유닛으로 만드는 조합</b>${list.map((r) => { const o = app.unitMap[r.out]; const ok = p.craftable.includes(r.id); return `<div class="rc ${ok ? 'ok' : ''} ${r.hidden ? 'hid' : ''}" style="--c:${app.cat.tiers[o.tier - 1].color}"><span class="out">${o.icon} ${esc(o.name)}</span><span class="ing">${ingChips(r, haveCounts(), p.items)}</span>${ok ? `<button class="primary" data-craft="${r.id}">조합</button>` : ''}</div>`; }).join('')}</div>`;
}
function renderSideTabs() {
  const p = me();
  if (!p) return;
  const badge = (d, n) => { const el = document.querySelector(`#sidetabs [data-d=${d}] .badge`); el.textContent = n; el.classList.toggle('hidden', !n); };
  badge('recipe', p.craftable.length);
  badge('mission', p.tickets || 0);
  const sv = app.v.story;
  badge('story', sv.states.filter((x) => x === 'open').length + (sv.active ? 1 : 0));
  for (const b of document.querySelectorAll('#sidetabs button')) b.classList.toggle('on', b.dataset.d === app.drawer);
}
function toggleDrawer(d) { if (app.drawer === d) closeDrawer(); else { app.drawer = d; $('#drawer').classList.remove('hidden'); renderDrawer(); renderSideTabs(); Sound.play('click'); } }
function closeDrawer() { app.drawer = null; $('#drawer').classList.add('hidden'); $('#drawer')._html = null; if (app.v) renderSideTabs(); }
onPress($('#sidetabs'), (b) => toggleDrawer(b.dataset.d));
function renderDrawer() {
  const p = me();
  if (!p || !app.drawer) return;
  let html = `<button class="small" style="float:right" data-close="1">✕</button>`;
  if (app.drawer === 'recipe') {
    const have = haveCounts();
    const known = hiddenKnown();
    const rev = revealMap();
    const row = (r) => {
      const o = app.unitMap[r.out];
      const ok = p.craftable.includes(r.id);
      const tier = app.cat.tiers[o.tier - 1];
      if (r.hidden && !known.has(r.id)) {
        const n = rev[r.id] || 0;
        const full = n >= r.need.length;
        const shown = { ...r, need: r.need.slice(0, n) };
        const chips = (n ? ingChips(shown, have, p.items) : '') + (n < r.need.length ? `${n ? '<span class="plus">+</span>' : ''}<span class="ing1">❓ 재료 ${r.need.length - n}개</span>` : '');
        return `<div class="rc hid"><span class="out"><b style="color:#ff3a4a">LVZ</b> ${full ? esc(o.name) : '???'}</span><span class="ing">${chips}<span class="hint" style="width:100%">${esc(r.hint)}${n && !full ? ` · 족보 ${n}/${r.need.length}` : ''}</span></span>${ok ? `<button class="primary" data-craft="${r.id}">조합</button>` : ''}</div>`;
      }
      return `<div class="rc ${ok ? 'ok' : ''} ${r.hidden ? 'hid' : ''}" style="--c:${tier.color}" title="${esc(o.desc)}"><span class="out"><b style="color:${tier.color}">${tier.name}</b> ${esc(o.name)}</span><span class="ing">${ingChips(r, have, p.items)}</span>${ok ? `<button class="primary" data-craft="${r.id}">조합</button>` : ''}</div>`;
    };
    const groups = [[2, 'Lv2'], [3, 'Lv3'], [4, 'H'], [5, 'LVX']];
    const itemsHtml = Object.entries(p.items).filter(([, n]) => n > 0).map(([k, n]) => `<span class="chip have">${app.cat.items[k].icon} ${esc(app.cat.items[k].name)} ×${n}</span>`).join('');
    html += `<h3>📜 조합법 <span class="hint">R</span></h3>
      <div class="hint">재료가 다 모이면 <b>조합</b> 버튼이 켜져요 (밝은 글자 = 개수만큼 가짐, 괄호 = 지금 가진 수). <b>H·LVX·LVZ는 족보로만</b> 만들어요. 같은 유닛 3개 랜덤 합성(F)은 Lv1→Lv2→Lv3까지만.</div>
      ${itemsHtml ? `<div class="sec">🎒 재료 아이템</div><div class="items">${itemsHtml}</div>` : ''}
      ${groups.map(([t, n]) => `<div class="sec" style="color:${app.cat.tiers[t - 1].color}">${n}</div>${app.cat.recipes.filter((r) => !r.hidden && app.unitMap[r.out].tier === t).map(row).join('')}`).join('')}
      <div class="sec" style="color:#ff3a4a">🔮 LVZ 히든 족보 (${app.cat.recipes.filter((r) => r.hidden && known.has(r.id)).length}/${app.cat.recipes.filter((r) => r.hidden).length} 발견)</div>
      <div class="hint">처음엔 ???로 가려져 있어요. <b>5웨이브를 깰 때마다</b> 재료가 하나씩, <b>게임을 이기면</b> 족보 2개가 통째로 공개돼요. 직접 맞혀 만들어도 공개돼요 (모두 이 컴퓨터에 기억돼요).</div>
      ${app.cat.recipes.filter((r) => r.hidden).map(row).join('')}`;
  } else if (app.drawer === 'mission') {
    const done = p.missions.filter((m) => m[2]).length;
    html += `<h3>🎖 미션 (${done}/${p.missions.length})</h3><div class="hint">미션을 달성할 때마다 <b>영웅 영입권</b> 1장 → 영웅 3명 중 1명을 데려와요. 보스 스토리 2·4·6장과 스토리 이벤트도 영입권을 줘요.</div>
      ${p.tickets ? `<div class="sec">🦸 남은 영입권 ${p.tickets}장</div>` : ''}
      ${p.missions.map(([id, cur, ok]) => { const m = app.missionMap[id]; return `<div class="st ${ok ? 'cleared' : 'open'}"><div class="t">${ok ? '✅' : m.icon} ${esc(m.name)}</div><div>${esc(m.desc)} — <b>${ok ? '완료' : `${cur}/${m.goal}`}</b></div></div>`; }).join('')}`;
  } else if (app.drawer === 'story') {
    const names = { open: '도전 가능', active: '도전 중', cleared: '클리어', locked: '잠김' };
    const sv = app.v.story;
    html += `<h3>📖 보스 스토리 (함께)</h3><div class="hint">보스방은 <b>둘이 같이</b> 써요. 누가 도전을 누르든 장마다 보스가 <b>가운데에 고정</b>되어 나오고 (${app.cat.storyTime}초 제한), 둘이 <b>각자 한 명씩</b> 보내 함께 잡아요. 가장 센 유닛을 자동으로 보내거나, 유닛을 골라 「이 유닛을 보스방으로」를 누르세요 (다시 보내면 교대). 끝나면 자동으로 돌아와요. 클리어하면 <b>둘 다</b> 히든 조합 재료를 얻어요.</div>
      ${app.cat.story.map((st, i) => { const state = sv.states[i]; const it = app.cat.items[st.item]; return `<div class="st ${state}"><div class="t">${st.ch}장 「${esc(st.title)}」 ${st.icon} <span class="hint">${names[state]}${state === 'locked' ? ` · ${st.wave}웨이브부터` : ''}</span></div>
        <div class="hint">보스: ${esc(st.boss)} · 보상 ${it.icon} ${esc(it.name)} + 골드 ${st.gold}${st.ch % 2 === 0 ? ' + 영웅 영입권' : ''}</div>
        ${state === 'cleared' ? `<div class="hint">“${esc(st.outro)}”</div>` : ''}
        <div class="acts">${state === 'open' ? `<button class="primary" data-story="${st.id}" ${sv.active || sv.cd ? 'disabled' : ''}>⚔ 도전 + 가장 센 유닛 보내기${sv.cd ? ` (${sv.cd}초)` : ''}</button>` : ''}${state === 'active' ? `<button data-view="room">📖 보스방 보기 (⏳${sv.left}초)</button> <button data-join="1">⚔ 나도 가장 센 유닛 보내기</button>` : ''}</div></div>`; }).join('')}
      <div class="sec">⚔ 스토리 이벤트 (함께)</div>
      <div class="hint">${app.cat.events.map((e) => `${e.wave}웨이브: ${e.icon} ${esc(e.boss)}`).join(' · ')} — 열리면 둘 다 이벤트 전장에 유닛을 보내 ${app.cat.eventTime}초 안에 함께 잡아요. 성공하면 모두 영웅 영입권 + 🌠 별의 파편.</div>`;
  }
  setHTML($('#drawer'), html);
}
onPress($('#drawer'), (b) => {
  if (b.dataset.close) closeDrawer();
  else if (b.dataset.craft) { cmd({ t: 'craft', recipe: b.dataset.craft }); Sound.play('merge'); }
  else if (b.dataset.story) { cmd({ t: 'story', id: b.dataset.story }); setTimeout(() => { cmd({ t: 'dispatch', field: 'room', n: 1 }); switchField('room'); }, 150); }
  else if (b.dataset.join) { cmd({ t: 'dispatch', field: 'room', n: 1 }); switchField('room'); }
  else if (b.dataset.view) switchField(b.dataset.view);
});

/** 스토리 대화창 */
function storyBox(face, title, text) {
  const el = $('#storybox');
  el.innerHTML = `<div class="face">${face}</div><div><div class="tt">${esc(title)}</div><p>${esc(text)}</p><button class="small" data-x="1">닫기</button></div>`;
  el.classList.remove('hidden');
  clearTimeout(storyBox.t);
  storyBox.t = setTimeout(() => el.classList.add('hidden'), 14000);
}
$('#storybox').addEventListener('click', (e) => { if (e.target.closest('[data-x]')) $('#storybox').classList.add('hidden'); });
function onStoryFx(f) {
  const [, kind, id, who] = f;
  if (kind === 'event') { const ev = app.cat.events[id]; storyBox(ev.icon, `스토리 이벤트 — ${ev.boss}`, ev.intro); banner('⚔ 스토리 이벤트!'); Sound.play('boss'); return; }
  const st = app.cat.story.find((x) => x.id === id);
  if (!st) return;
  if (kind === 'start') { storyBox(st.icon, `${st.ch}장 「${st.title}」`, st.intro + (who !== app.myIdx ? `\n— ${app.info.players[who].name}님이 도전을 시작했어요. 보스방에 가장 센 유닛을 보내 도와주세요!` : '')); Sound.play('boss'); }
  if (kind === 'clear') { storyBox('📜', `${st.ch}장 클리어!`, st.outro); banner(`📖 ${st.ch}장 클리어!`); Sound.play('win'); }
}

// ───────────── 입력 ─────────────
function tileAt(e) {
  if (app.use3d) return Board3D.pick(e.clientX, e.clientY) || { fx: -1, fy: -1, x: -1, y: -1 };
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * canvas.width / T;
  const y = ((e.clientY - r.top) / r.height) * canvas.height / T;
  return { fx: x, fy: y, x: Math.floor(x), y: Math.floor(y) };
}
app.freeTile = (x, y) => freeTile(x, y);
app.entPos = (ent, now) => entPos(ent, now);
function freeTile(x, y) {
  const m = app.info.map;
  return x >= 0 && y >= 0 && x < m.W && y < m.H && !bgCanvas.blocked.has(x + ',' + y) && !(app.fu || []).some((u) => u[3] === x && u[4] === y);
}
canvas.addEventListener('mousemove', (e) => { if (!app.info) return; app.hover = tileAt(e); });
canvas.addEventListener('mouseleave', () => { app.hover = null; });
canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); clearSel(); app.aiming = false; renderControls.key = null; });
function clearSel() { app.sel = null; app.multi = []; app.selTile = null; }
/** 유닛의 화면 위치 (드래그 선택) */
function unitScreenPos(u) {
  if (app.use3d) return Board3D.unitScreen(u[0]);
  const r = canvas.getBoundingClientRect();
  return [r.left + ((u[3] + 0.5) * T / canvas.width) * r.width, r.top + ((u[4] + 0.5) * T / canvas.height) * r.height];
}
// 드래그로 여러 유닛 고르기
canvas.addEventListener('pointerdown', (e) => { if (e.button !== 0 || !app.v || app.aiming) return; app.drag = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, on: false }; });
window.addEventListener('pointermove', (e) => {
  if (!app.drag) return;
  app.drag.x1 = e.clientX; app.drag.y1 = e.clientY;
  if (!app.drag.on && Math.hypot(app.drag.x1 - app.drag.x0, app.drag.y1 - app.drag.y0) > 10) app.drag.on = true;
});
window.addEventListener('pointerup', () => {
  const d = app.drag;
  app.drag = null;
  if (!d || !d.on || !app.v) return;
  const [xa, xb] = [Math.min(d.x0, d.x1), Math.max(d.x0, d.x1)], [ya, yb] = [Math.min(d.y0, d.y1), Math.max(d.y0, d.y1)];
  const ids = (app.fu || []).filter((u) => u[1] === app.myIdx).filter((u) => { const p = unitScreenPos(u); return p && p[0] >= xa && p[0] <= xb && p[1] >= ya && p[1] <= yb; }).map((u) => u[0]);
  clearSel();
  if (ids.length === 1) app.sel = ids[0];
  else if (ids.length) app.multi = ids;
  app.justDragged = true;
  setTimeout(() => { app.justDragged = false; }, 50);
  if (ids.length) Sound.play('click');
  renderSelected();
});
canvas.addEventListener('dblclick', (e) => {
  // 더블클릭: 보이는 전장의 같은 유닛 모두 선택
  if (!app.v) return;
  const t = tileAt(e);
  const u = (app.fu || []).find((x) => x[3] === t.x && x[4] === t.y && x[1] === app.myIdx);
  if (!u) return;
  const ids = app.fu.filter((x) => x[1] === app.myIdx && x[2] === u[2]).map((x) => x[0]);
  clearSel();
  if (ids.length > 1) app.multi = ids; else app.sel = u[0];
  renderSelected();
});
canvas.addEventListener('click', (e) => {
  if (!app.v || app.justDragged) return;
  const t = tileAt(e);
  app.hover = t;
  if (app.aiming) { cmd({ t: 'skill', x: t.fx, y: t.fy, field: app.viewField }); app.aiming = false; renderControls.key = null; return; }
  const u = (app.fu || []).find((x) => x[3] === t.x && x[4] === t.y);
  if (u) {
    if (u[1] === app.myIdx) {
      const stack = app.fu.filter((x) => x[1] === app.myIdx && x[3] === t.x && x[4] === t.y).map((x) => x[0]);
      const cur = app.multi && app.multi.length ? app.multi : app.sel ? [app.sel] : [];
      const curUnits = app.v.units.filter((x) => cur.includes(x[0]));
      // 같은 유닛을 고른 상태에서 같은 유닛 무리를 누르면 그 무리에 합류
      if (curUnits.length && curUnits.every((x) => x[2] === u[2]) && !curUnits.some((x) => stack.includes(x[0])) && !e.ctrlKey && !e.metaKey) {
        cmd({ t: 'moveMany', units: cur, tile: [t.x, t.y], field: app.viewField }); clearSel(); Sound.play('click');
        renderSelected(); return;
      }
      if (app.sel && app.sel !== u[0] && e.shiftKey) { cmd({ t: 'swap', unit: app.sel, other: u[0] }); app.sel = null; return; }
      if (e.ctrlKey || e.metaKey) { const set = new Set(cur); const has = stack.every((id) => set.has(id)); for (const id of stack) { if (has) set.delete(id); else set.add(id); } clearSel(); if (set.size === 1) app.sel = [...set][0]; else app.multi = [...set]; }
      else { const was = cur.includes(u[0]) && cur.length === stack.length; clearSel(); if (!was) { app.sel = stack[0]; if (stack.length > 1) app.multi = stack; } }
    } else { clearSel(); toast(`${app.info.players[u[1]].name}의 유닛이에요.`); }
    Sound.play('click');
  } else if (freeTile(t.x, t.y)) {
    if (app.multi && app.multi.length) { cmd({ t: 'moveMany', units: app.multi, tile: [t.x, t.y], field: app.viewField }); clearSel(); Sound.play('click'); }
    else if (app.sel) { cmd({ t: 'move', unit: app.sel, tile: [t.x, t.y], field: app.viewField }); app.sel = null; Sound.play('click'); }
  } else clearSel();
  renderSelected();
  renderControls.key = null; renderControls();
});
document.addEventListener('keydown', (e) => {
  if (!app.v || $('#game').classList.contains('hidden')) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (k === 'enter') { app.tab = 'chat'; document.querySelector('.tabs [data-tab=chat]').click(); $('#chat input').focus(); e.preventDefault(); return; }
  const map = { q: 'summon', w: 'premium', e: 'skill', f: 'merge', s: 'sell' };
  const ko = { ㅂ: 'q', ㅈ: 'w', ㄷ: 'e', ㄹ: 'f', ㄴ: 's', ㅔ: 'p', ㅎ: 'g', ㄱ: 'r', ㅁ: 'a', ㅇ: 'd', ㅋ: 'z' }; // 한글 자판
  const key = ko[k] || k;
  if (key === 'a') { action('autoPlace'); return; }
  if (key === 'd') { action('gather'); return; }
  if (key === 'z') { action('clearZone'); return; }
  if (key === 'r') { toggleDrawer('recipe'); return; }
  if (key === 'tab') { e.preventDefault(); const order = ['m' + app.myIdx, 'room', ...(app.v.event ? ['ev'] : []), ...app.info.players.map((_, i) => 'm' + i).filter((f) => f !== 'm' + app.myIdx)]; switchField(order[(order.indexOf(app.viewField) + 1) % order.length]); return; }
  if (key === 's' && e.shiftKey) { action('sellSel'); return; }
  if (map[key]) { action(map[key]); return; }
  if (['1', '2', '3'].includes(key)) { action('up', Object.keys(app.cat.cats)[Number(key) - 1]); return; }
  if (key === 'p' || key === ' ') { send({ t: 'pause' }); e.preventDefault(); return; }
  if (key === 'g' && app.hover) { cmd({ t: 'ping', x: app.hover.fx, y: app.hover.fy, field: app.viewField }); return; }
  if (key === 'escape') { clearSel(); app.aiming = false; renderControls.key = null; closeModal(); closeDrawer(); $('#storybox').classList.add('hidden'); }
});

// ───────────── 효과 ─────────────
function addFx(f, now) {
  const [kind] = f;
  const push = (o) => { if (app.fx.length < 400) app.fx.push({ ...o, t0: now }); };
  switch (kind) {
    case 'atk': { const [, ux, uy, tx, ty, k, tier, crit] = f; push({ k: 'atk', x1: ux + 0.5, y1: uy + 0.5, x2: tx / 10, y2: ty / 10, kind: k, tier, crit, life: k === 'blade' ? 150 : 200 }); if (crit) push({ k: 'text', x: tx / 10, y: ty / 10, text: '치명!', color: '#ff6', life: 600 }); break; }
    case 'zap': push({ k: 'zap', x1: f[1] / 10, y1: f[2] / 10, x2: f[3] / 10, y2: f[4] / 10, life: 180 }); break;
    case 'die': push({ k: 'die', x: f[1] / 10, y: f[2] / 10, big: f[3], life: f[3] ? 900 : 350 }); break;
    case 'summon': push({ k: 'ring', x: f[1] + 0.5, y: f[2] + 0.5, color: app.cat.tiers[f[3] - 1].color, life: f[3] >= 4 ? 1200 : 600, big: f[3] >= 4 }); break;
    case 'merge': push({ k: 'ring', x: f[1] + 0.5, y: f[2] + 0.5, color: app.cat.tiers[f[3] - 1].color, life: 1000, big: true }); push({ k: 'text', x: f[1] + 0.5, y: f[2], text: '합성!', color: app.cat.tiers[f[3] - 1].color, life: 900 }); break;
    case 'slash': push({ k: 'slash', x: f[1] / 10, y: f[2] / 10, life: 700 }); break;
    case 'seal': push({ k: 'tint', color: '#a8f', life: 1200 }); break;
    case 'goldrain': push({ k: 'tint', color: '#fd4', life: 900 }); break;
    case 'temper': push({ k: 'tint', color: '#f84', life: 700 }); break;
    case 'leak': push({ k: 'tint', color: '#f00', life: 500 }); Sound.play('leak'); break;
    case 'ping': push({ k: 'ping', x: f[1] / 10, y: f[2] / 10, color: app.cat.colors[f[3]], life: 1600 }); Sound.play('ping'); break;
    case 'miss': push({ k: 'text', x: f[1] / 10, y: f[2] / 10, text: '회피', color: '#ccc', life: 500 }); break;
    case 'heal': push({ k: 'text', x: f[1] / 10, y: f[2] / 10, text: '💚 회복', color: '#8f8', life: 900 }); break;
    case 'brood': push({ k: 'text', x: f[1] / 10, y: f[2] / 10, text: '새끼 소환!', color: '#fa8', life: 900 }); break;
    default:
  }
}

const ATK_COLORS = { blade: '#fff', bow: '#c8f8a8', magic: '#a8c8ff', splash: '#ffb060', chain: '#c8e8ff' };
const ENEMY_ICON = (k) => (app.cat.enemies[k] ? app.cat.enemies[k].icon : k === 'slime_s' ? '🟢' : k === 'mini' ? app.cat.miniboss.icon : app.bossMap[k] ? app.bossMap[k].icon : '👹');

// ───────────── 그리기 ─────────────
function frame() {
  requestAnimationFrame(frame);
  if (!app.info || !app.v || !bgCanvas || $('#game').classList.contains('hidden')) return;
  const now = performance.now();
  if (app.use3d) { Board3D.render(app, now); return; }
  const v = app.vf || app.v;
  const g = ctx;
  g.drawImage(bgCanvas, 0, 0);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // 화살비 구역
  for (const [x10, y10, r] of v.zones) {
    g.fillStyle = '#c8f8a833'; g.strokeStyle = '#c8f8a8aa'; g.lineWidth = 2;
    g.beginPath(); g.arc((x10 / 10) * T, (y10 / 10) * T, r * T, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = '#efe';
    for (let i = 0; i < 8; i++) { const a = Math.random() * 7, d = Math.random() * r * T; const px = (x10 / 10) * T + Math.cos(a) * d, py = (y10 / 10) * T + Math.sin(a) * d; g.beginPath(); g.moveTo(px, py - 10); g.lineTo(px, py); g.stroke(); }
  }
  // 고른 칸
  if (app.selTile) { g.strokeStyle = '#ffe08a'; g.lineWidth = 3; g.setLineDash([6, 4]); g.strokeRect(app.selTile[0] * T + 3, app.selTile[1] * T + 3, T - 6, T - 6); g.setLineDash([]); }
  // 마우스가 있는 칸
  const h = app.hover;
  if (h && freeTile(h.x, h.y)) { g.fillStyle = app.sel ? '#8f84' : '#fff2'; g.fillRect(h.x * T, h.y * T, T, T); }
  // 사거리
  const selU = app.sel && v.units.find((u) => u[0] === app.sel);
  const hovU = h && v.units.find((u) => u[3] === h.x && u[4] === h.y);
  for (const u of [selU, hovU]) {
    if (!u) continue;
    const t = app.unitMap[u[2]];
    let range = t.range;
    if (app.info.players[u[1]].leader === 'archer' && t.cat === 'bow') range += 0.6;
    g.fillStyle = '#ffffff14'; g.strokeStyle = '#ffffff88'; g.lineWidth = 2;
    g.beginPath(); g.arc((u[3] + 0.5) * T, (u[4] + 0.5) * T, range * T, 0, 7); g.fill(); g.stroke();
  }
  // 합성 가능한 같은 유닛 표시
  const ready = new Set();
  const cnt = unitCounts(app.myIdx);
  for (const [id, n] of Object.entries(cnt)) { const need = app.cat.mergeNeed[app.unitMap[id].tier]; if (need && n >= need) ready.add(id); }
  // 유닛
  for (const u of v.units) {
    const [id, owner, type, x, y] = u;
    const t = app.unitMap[type];
    const tier = app.cat.tiers[t.tier - 1];
    const cx = (x + 0.5) * T, cy = (y + 0.5) * T;
    g.fillStyle = '#0007';
    g.beginPath(); g.ellipse(cx, cy + T * 0.32, T * 0.32, T * 0.1, 0, 0, 7); g.fill();
    // 등급 원
    const grad = g.createRadialGradient(cx, cy - 4, 4, cx, cy, T * 0.44);
    grad.addColorStop(0, '#fff8'); grad.addColorStop(1, tier.color);
    g.fillStyle = grad;
    g.beginPath(); g.arc(cx, cy, T * 0.42, 0, 7); g.fill();
    g.lineWidth = t.tier >= 4 ? 4 : 3;
    g.strokeStyle = t.tier === 5 ? `hsl(${(now / 8) % 360},90%,65%)` : app.cat.colors[owner];
    g.stroke();
    g.font = `${T * 0.5}px sans-serif`;
    g.fillText(t.icon, cx, cy + 1);
    // 주인 표시 점
    g.fillStyle = app.cat.colors[owner];
    g.beginPath(); g.arc(cx + T * 0.32, cy - T * 0.32, 5, 0, 7); g.fill();
    if (owner === app.myIdx && ready.has(type)) { g.fillStyle = '#ffe060'; g.font = `bold ${T * 0.3}px sans-serif`; g.fillText('✦', cx - T * 0.33, cy - T * 0.32); }
    if (id === app.sel) { g.strokeStyle = '#fff'; g.lineWidth = 3; g.setLineDash([5, 4]); g.beginPath(); g.arc(cx, cy, T * 0.5, 0, 7); g.stroke(); g.setLineDash([]); }
  }
  // 요괴
  for (const ent of app.ents.values()) {
    const p = entPos(ent, now);
    const fl = ent.fl || 0;
    const boss = fl & 32, mini = fl & 64, flying = fl & 16;
    const size = boss ? 1.3 : mini ? 0.95 : 0.62;
    const cx = p.x * T, cy = p.y * T - (flying ? 8 + Math.sin(now / 200 + ent.id) * 3 : 0);
    if (flying) { g.fillStyle = '#0005'; g.beginPath(); g.ellipse(p.x * T, p.y * T + 8, T * 0.2, T * 0.07, 0, 0, 7); g.fill(); }
    if (boss) { g.fillStyle = '#f0486044'; g.beginPath(); g.arc(cx, cy, T * 0.75 + Math.sin(now / 150) * 3, 0, 7); g.fill(); }
    g.font = `${T * size}px sans-serif`;
    g.fillText(ENEMY_ICON(ent.k), cx, cy + 2);
    if (fl & 1) { g.fillStyle = '#88ccff55'; g.beginPath(); g.arc(cx, cy, T * size * 0.55, 0, 7); g.fill(); }
    if (fl & 2) { g.font = `${T * 0.3}px sans-serif`; g.fillText('💫', cx, cy - T * size * 0.55); }
    if (fl & 4) { g.font = `${T * 0.25}px sans-serif`; g.fillText('🔥', cx + T * 0.25, cy + T * 0.2); }
    if (fl & 8) { g.fillStyle = '#9f6c'; g.beginPath(); g.arc(cx - T * 0.25, cy + T * 0.2, 4, 0, 7); g.fill(); }
    // 체력 막대
    const bw = T * (boss ? 1.4 : mini ? 0.9 : 0.6), by = cy - T * size * 0.62;
    g.fillStyle = '#000a'; g.fillRect(cx - bw / 2, by, bw, boss ? 7 : 5);
    g.fillStyle = ent.hp > 50 ? '#6e6' : ent.hp > 25 ? '#fd4' : '#f55';
    g.fillRect(cx - bw / 2, by, (bw * ent.hp) / 100, boss ? 7 : 5);
  }
  // 효과
  app.fx = app.fx.filter((f) => now - f.t0 < f.life);
  for (const f of app.fx) {
    const t = (now - f.t0) / f.life;
    g.globalAlpha = 1 - t;
    switch (f.k) {
      case 'atk': {
        const col = ATK_COLORS[f.kind] || '#fff';
        if (f.kind === 'blade') {
          g.strokeStyle = col; g.lineWidth = 3 + f.tier;
          g.beginPath(); g.arc(f.x2 * T, f.y2 * T, T * 0.35, t * 4, t * 4 + 1.8); g.stroke();
        } else {
          const px = f.x1 + (f.x2 - f.x1) * Math.min(1, t * 2), py = f.y1 + (f.y2 - f.y1) * Math.min(1, t * 2);
          g.strokeStyle = col; g.lineWidth = 2 + f.tier * 0.6;
          g.beginPath(); g.moveTo(f.x1 * T + (px - f.x1) * T * 0.6, f.y1 * T + (py - f.y1) * T * 0.6); g.lineTo(px * T, py * T); g.stroke();
          if (f.kind === 'splash' && t > 0.45) { g.fillStyle = '#ffa04066'; g.beginPath(); g.arc(f.x2 * T, f.y2 * T, T * (0.4 + t * 0.6), 0, 7); g.fill(); }
        }
        break;
      }
      case 'zap': {
        g.strokeStyle = '#d8f0ff'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(f.x1 * T, f.y1 * T);
        for (let i = 1; i < 5; i++) { const k = i / 5; g.lineTo((f.x1 + (f.x2 - f.x1) * k) * T + (Math.random() - 0.5) * 12, (f.y1 + (f.y2 - f.y1) * k) * T + (Math.random() - 0.5) * 12); }
        g.lineTo(f.x2 * T, f.y2 * T); g.stroke();
        break;
      }
      case 'die': g.fillStyle = f.big ? '#ffd060' : '#ffffffaa'; g.beginPath(); g.arc(f.x * T, f.y * T, T * (0.2 + t * (f.big ? 2 : 0.5)), 0, 7); g.fill(); break;
      case 'ring': g.strokeStyle = f.color; g.lineWidth = f.big ? 6 : 3; g.beginPath(); g.arc(f.x * T, f.y * T, T * (0.3 + t * (f.big ? 1.6 : 0.6)), 0, 7); g.stroke(); break;
      case 'slash': g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.arc(f.x * T, f.y * T, T * 2.6 * (0.3 + t), -1 + t * 3, 1 + t * 3); g.stroke(); g.fillStyle = '#f8604433'; g.beginPath(); g.arc(f.x * T, f.y * T, T * 2.6, 0, 7); g.fill(); break;
      case 'tint': g.globalAlpha = (1 - t) * 0.25; g.fillStyle = f.color; g.fillRect(0, 0, canvas.width, canvas.height); break;
      case 'ping': g.strokeStyle = f.color; g.lineWidth = 4; for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(f.x * T, f.y * T, T * (0.3 + ((t * 2 + i * 0.5) % 1) * 1.2), 0, 7); g.stroke(); } g.font = `${T * 0.6}px sans-serif`; g.fillText('❗', f.x * T, f.y * T - T * 0.6); break;
      case 'text': g.font = `bold ${T * 0.32}px sans-serif`; g.fillStyle = f.color; g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeText(f.text, f.x * T, f.y * T - t * 24); g.fillText(f.text, f.x * T, f.y * T - t * 24); break;
      default:
    }
    g.globalAlpha = 1;
  }
  if (v.sealed) { g.fillStyle = '#a080ff18'; g.fillRect(0, 0, canvas.width, canvas.height); }
  if (app.aiming && h) {
    g.strokeStyle = '#ff8060'; g.lineWidth = 3; g.setLineDash([8, 6]);
    g.beginPath(); g.arc(h.fx * T, h.fy * T, (app.info.players[app.myIdx].leader === 'sword' ? 2.6 : 2.3) * T, 0, 7); g.stroke(); g.setLineDash([]);
  }
  if (v.paused) { g.fillStyle = '#0008'; g.fillRect(0, 0, canvas.width, canvas.height); g.fillStyle = '#fff'; g.font = `${T}px Jua, sans-serif`; g.fillText('⏸ 일시정지', canvas.width / 2, canvas.height / 2); }
  else if (!v.wave) { g.fillStyle = '#fff'; g.font = `${T * 0.8}px Jua, sans-serif`; g.strokeStyle = '#000'; g.lineWidth = 6; const s = `${v.nextIn}초 뒤 요괴가 몰려와요! 빈칸을 누르고 Q로 소환!`; g.strokeText(s, canvas.width / 2, T * 1.3); g.fillText(s, canvas.width / 2, T * 1.3); }
}
requestAnimationFrame(frame);

// ───────────── 결과 / 모달 ─────────────
function openModal(html) {
  $('#modal .modal-inner').innerHTML = `<button class="small close">✕</button>${html}`;
  $('#modal').classList.remove('hidden');
  $('#modal .close').onclick = closeModal;
}
function closeModal() { $('#modal').classList.add('hidden'); }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

function showResult() {
  const v = app.v;
  const r = v.result;
  const host = app.room && app.room.hostId === app.you;
  openModal(`<div class="result-box">
    <h1>${r.win ? '🎉 승리!' : '💀 패배…'}</h1>
    <p>${esc(r.reason)}</p>
    ${r.revealed && r.revealed.length ? `<p>📜 <b>히든 족보 공개!</b> ${r.revealed.map((id) => { const rc = app.cat.recipes.find((x) => x.id === id); return `${app.unitMap[rc.out].icon} ${esc(app.unitMap[rc.out].name)} = ${rc.need.map((n) => (n[0] === '#' ? app.cat.items[n.slice(1)].name : app.unitMap[n].name)).join(' + ')}`; }).join('<br>')}</p>` : ''}
    <p>도달 웨이브 <b>${r.wave}</b> · 플레이 시간 ${Math.floor(r.time / 60)}분 ${r.time % 60}초 · 맵 「${esc(app.info.map.name)}」 · ${esc(app.info.diff.name)}</p>
    <table class="result-table"><tr><th>퇴마사</th><th>대장</th><th>처치</th><th>피해</th><th>남은 유닛</th></tr>
    ${v.players.map((p, i) => `<tr><td style="color:${app.cat.colors[i]}"><b>${esc(app.info.players[i].name)}</b></td><td>${app.leaderMap[app.info.players[i].leader].icon} ${esc(app.leaderMap[app.info.players[i].leader].name)}</td><td>${p.kills}</td><td>${fmt(p.damage)}</td><td>${p.units}</td></tr>`).join('')}</table>
    ${host ? '<button class="primary" id="btn-rematch">🔁 같은 설정으로 다시</button> <button id="btn-lobby">🏠 대기실로</button>' : '<p class="hint">방장이 다음 판을 고르는 중…</p>'}
  </div>`);
  if (host) {
    $('#btn-rematch').onclick = () => { send({ t: 'rematch' }); closeModal(); };
    $('#btn-lobby').onclick = () => { send({ t: 'backToLobby' }); closeModal(); };
  }
}

function openCodex() {
  if (!app.cat) return;
  const c = app.cat;
  const effect = (u) => [u.splash && `광역 ${u.splash}`, u.slow && `감속 ${Math.round(u.slow.pct * 100)}%`, u.poison && `독 ${u.poison.dps}/초`, u.burn && `화상 ${u.burn.dps}/초`, u.chain && `연쇄 ${u.chain}`, u.shred && `방어 깎기 ${u.shred}`, u.crit && `치명 ${Math.round(u.crit.chance * 100)}%`, u.execute && `처형 ${Math.round(u.execute * 100)}%`, u.multi && `동시 ${u.multi}발`, u.aura && '오라', u.stun && '기절', u.pierceArmor && '방어 무시'].filter(Boolean).join(' · ');
  openModal(`<h2>📚 유닛 도감</h2>
    <p class="hint">소환 확률 — 일반 소환: ${c.summonOdds.map((o, i) => `${c.tiers[i].name} ${(o * 100).toFixed(1)}%`).join(' / ')} · 고급 소환: ${c.premiumOdds.map((o, i) => o ? `${c.tiers[i].name} ${(o * 100).toFixed(0)}%` : '').filter(Boolean).join(' / ')}</p>
    <p class="hint">랜덤 합성: <b>같은 유닛 3개</b> → 한 등급 위 무작위 유닛 (Lv1→Lv2→Lv3까지). <b>H·LVX·LVZ는 족보로만</b> (📜 조합법). 검술 유닛은 날아다니는 요괴를 못 때려요.</p>
    ${c.tiers.filter((t) => t.id <= 5).map((t) => `<div class="codex-tier"><h3 style="color:${t.color}">${t.name}${c.mergeNeed[t.id] ? ` <span class="hint">— ${c.mergeNeed[t.id]}개 합성 → ${c.tiers[t.id]?.name}</span>` : ''}</h3><div class="codex-grid">
      ${c.units.filter((u) => u.tier === t.id).map((u) => `<div class="cx" style="--c:${t.color}"><div class="n">${u.icon} ${esc(u.name)} <span class="hint">${c.cats[u.cat].icon}</span></div><div class="s">피해 ${u.dmg} · ${(1 / u.cd).toFixed(1)}회/초 · 사거리 ${u.range}</div><div class="s">${esc(effect(u))}</div><div>${esc(u.desc)}</div></div>`).join('')}
    </div></div>`).join('')}
    <h2>🦸 영웅 <span class="hint">— 소환·합성으로는 안 나와요. 미션을 달성해 받은 영입권으로 데려오고, 요괴를 잡을수록 레벨업(최대 10)</span></h2><div class="codex-grid">${c.units.filter((u) => u.hero).map((u) => `<div class="cx" style="--c:#48f0d8"><div class="n">${u.icon} ${esc(u.name)} <span class="hint">${c.cats[u.cat].icon}</span></div><div class="s">피해 ${u.dmg} · ${(1 / u.cd).toFixed(1)}회/초 · 사거리 ${u.range}</div><div class="s">${esc(effect(u))}</div><div>${esc(u.desc)}</div></div>`).join('')}</div>
    <h2>🔮 히든 유닛 <span class="hint">— 히든 조합으로만 만들어요 (조합법은 📜 조합법에서)</span></h2><div class="codex-grid">${c.units.filter((u) => u.hidden).map((u) => { const r = c.recipes.find((x) => x.out === u.id); const k = hiddenKnown().has(r.id); return k ? `<div class="cx" style="--c:#ff5ad8"><div class="n">${u.icon} ${esc(u.name)}</div><div class="s">피해 ${u.dmg} · ${(1 / u.cd).toFixed(1)}회/초 · 사거리 ${u.range}</div><div>${esc(u.desc)}</div></div>` : `<div class="cx" style="--c:#ff5ad8"><div class="n">❓ ???</div><div class="s">${esc(r.hint)}</div></div>`; }).join('')}</div>
    <h2>🎖 미션</h2><div class="codex-grid">${c.missions.map((m) => `<div class="cx" style="--c:#fd6"><div class="n">${m.icon} ${esc(m.name)}</div><div class="s">${esc(m.desc)}</div></div>`).join('')}</div>
    <h2>👹 요괴</h2><div class="codex-grid">${Object.entries(c.enemies).map(([, e]) => `<div class="cx" style="--c:#a66"><div class="n">${e.icon} ${esc(e.name)}</div><div class="s">속도 ${e.speed} · 방어 ${e.armor}${e.flying ? ' · 비행' : ''}${e.split ? ' · 죽으면 분열' : ''}${e.regen ? ' · 재생' : ''}${e.treasure ? ' · 잡으면 보상!' : ''}</div></div>`).join('')}
    ${c.bosses.map((b) => `<div class="cx" style="--c:#f48"><div class="n">${b.icon} ${esc(b.name)} <span class="hint">${b.wave}웨이브</span></div><div class="s">${esc(b.desc)}</div></div>`).join('')}</div>
    <h2>🌟 축복</h2><div class="codex-grid">${c.blessings.map((b) => `<div class="cx" style="--c:#fd6"><div class="n">${b.icon} ${esc(b.name)}</div><div class="s">${esc(b.desc)}</div></div>`).join('')}</div>`);
}

function openGuide() {
  openModal(`<h2>📖 게임 방법</h2><div class="guide-body">
    <p><b>목표</b>: 둘이 힘을 합쳐 <b>40웨이브</b>를 버티고 마지막 보스 「요괴왕 흑염」을 쓰러뜨리세요.</p>
    <ul>
      <li>🎲 <b>소환 (Q)</b>: 50골드로 무작위 퇴마사를 불러요. 빈칸을 먼저 누르면 그 자리에, 아니면 길 가까운 곳에 자동으로 놓여요. 마우스를 빈칸에 올리고 Q를 눌러도 돼요.</li>
      <li>💎 <b>고급 소환 (W)</b>: 비싸지만 희귀 등급 이상이 확정!</li>
      <li>✨ <b>랜덤 합성 (F)</b>: 같은 유닛 <b>3개</b>를 모으면 한 등급 위 <b>무작위</b> 유닛 (Lv1 → Lv2 → Lv3까지). 합성할 수 있는 유닛에는 ✦ 표시가 떠요.</li>
      <li>📜 <b>족보 (R)</b>: <b>H · LVX</b>는 "Lv2 ○○ x2 + Lv1 ○○ x2 …"처럼 정해진 Lv1~Lv3 재료를 모아서만 만들어요. <b>LVZ 히든</b>은 ???로 가려져 있고 스토리 재료가 필요해요.</li>
      <li>🧲 <b>자동 모으기</b>: 켜 두면 유닛 하나를 옮길 때 같은 유닛이 모두 따라와 한 칸에 겹쳐요 (×n).</li>
      <li>🏯 <b>각자 전장</b>: 둘이 <b>각자 자기 전장</b>을 막아요. 위쪽 탭으로 동료 전장을 볼 수 있고(Tab 키), 어느 한쪽이라도 무너지면 패배!</li>
      <li>📜 <b>조합법 (R)</b>: 정해진 재료를 모으면 원하는 유닛을 만들 수 있어요. <b>히든 조합</b>은 ???로 가려져 있고, 보스 스토리 보상 재료가 필요해요.</li>
      <li>📖 <b>보스 스토리</b>: <b>보스방은 둘이 함께</b> 써요 — 가운데 고정된 스토리 보스(6장)를 각자 한 명씩 보내 잡아요. ⚔ <b>스토리 이벤트</b>(12·24·36웨이브)는 둘이 함께 이벤트 전장에 유닛을 보내 잡아요.</li>
      <li>🦸 <b>영웅</b>: 오른쪽 <b>🎖 미션</b>(처치 수, 전설 만들기, 보스 잡기 등)을 달성하면 <b>영웅 영입권</b>을 받아요. 영웅 8명 중 3명이 제시되고 하나를 골라 데려와요. 영웅은 요괴를 잡을수록 레벨이 올라 강해져요 (최대 Lv.10).</li>
      <li>🖱 유닛을 누르고 빈칸을 누르면 <b>이동</b>, Shift+클릭이면 내 유닛 둘의 자리 <b>바꾸기</b>. 오른쪽 클릭은 선택 취소.</li>
      <li>⚔🏹🔮 <b>강화 (1·2·3)</b>: 검술·궁술·술법 유닛 피해를 각각 올려요. 내 유닛 구성에 맞춰 강화하세요.</li>
      <li>⚡ <b>필살기 (E)</b>: 대장마다 다른 필살기. 위치를 고르는 필살기는 E를 누른 뒤 전장을 클릭.</li>
      <li>🌟 <b>축복</b>: 우두머리·보스를 잡을 때마다 3개 중 하나를 골라요 (무작위).</li>
      <li>🎁 <b>골드 선물</b>: 동료가 합성 재료가 하나 모자랄 때 도와주세요. <b>G</b>를 누르면 마우스 위치를 동료에게 알려요.</li>
    </ul>
    <p><b>맵 종류</b></p>
    <ul>
      <li>➡ <b>외길·긴 외길·결계 돌격</b>: 요괴가 <b>입구 하나</b>(보라색 소용돌이)에서 나와 끝(⛩️)으로 가요. 끝에 닿으면 생명이 줄고, 보스는 -10!</li>
      <li>🔁 <b>순환·큰 순환</b>: 입구에서 나온 요괴가 계속 돌아요. 살아 있는 요괴가 한도에 닿으면 패배. 보스는 ${app.cat ? app.cat.bossTime : 100}초 안에 잡아야 해요.</li>
    </ul>
    <p><b>요괴 특징</b>: 🐦‍⬛ 까마귀는 날아다녀서 검술 유닛이 못 때려요 · 💀 갑옷 망령은 방어가 높아 강한 한 방이나 방어 깎기가 좋아요 · 🟢 점액은 죽으면 분열 · 🐸 보물 두꺼비를 잡으면 보상!</p>
    <p><b>웨이브 변이</b>: 질풍(빠름)·거구(체력)·재생·강철(방어)·떼거리(수가 많음)·유령(회피). 오른쪽 '다음 웨이브'에서 미리 확인하세요.</p>
    <p><b>단축키</b>: Q 소환(소환진에) · W 고급 소환 · E 필살기 · F 랜덤 합성 · R 조합법 · A 길 옆으로 자동 배치 · D 같은 유닛 모으기 · Z 소환진 비우기 · Tab 전장 바꾸기 · S 한 마리 판매 · Shift+S 선택·무리 전부 판매 · 1/2/3 강화 · G 위치 알림 · P/스페이스 일시정지 · Enter 채팅 · Esc 취소 · 마우스 휠 확대</p>
    <p><b>마우스</b>: 드래그 = 여러 명 선택 · 더블클릭 = 같은 유닛 모두 선택 · Ctrl+클릭 = 선택에 더하기 · 우클릭 = 선택 해제</p>
  </div>`);
}

connect();
