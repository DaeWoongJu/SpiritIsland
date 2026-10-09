'use strict';
/* 언락! — 클라이언트 */

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const app = {
  ws: null, token: null, catalog: null, room: null, you: null, state: null, prompt: null, stateAt: 0,
  lastLog: 0, lastEv: 0, tab: 'log', lastChat: 0, seen: new Set(), sel: [], code: '', seq: [], box: null,
};
window.app = app;

const TYPE_NAME = { place: '장소', red: '빨강 — 물건', blue: '파랑 — 물건', code: '노랑 — 코드', machine: '초록 — 장치', item: '결과', trap: '함정' };
const TYPE_COLOR = { place: '#8a96a4', red: '#e0443a', blue: '#2a7ae0', code: '#d8a818', machine: '#30b860', item: '#a89c84' };

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
  ws.onopen = () => send({ t: 'hello', token: sessionStorage.getItem('unlock-token') || localStorage.getItem('unlock-token') });
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onclose = () => { toast('서버와 연결이 끊겼어요. 다시 연결하는 중…'); setTimeout(connect, 1500); };
}
function send(msg) { if (app.ws && app.ws.readyState === 1) app.ws.send(JSON.stringify(msg)); }

function onMessage(msg) {
  switch (msg.t) {
    case 'welcome':
      app.token = msg.token;
      app.catalog = msg.catalog;
      try { sessionStorage.setItem('unlock-token', msg.token); localStorage.setItem('unlock-token', msg.token); } catch { /* 무시 */ }
      $('#lan').innerHTML = msg.lan.length ? `같은 와이파이 친구 접속 주소: ${msg.lan.map((u) => `<b>${u}</b>`).join(' 또는 ')}` : '';
      app.saves = msg.saves || [];
      renderSaves();
      if (!app.room) show('home');
      break;
    case 'saves': app.saves = msg.list || []; renderSaves(); break;
    case 'room':
      app.room = msg.room;
      app.you = msg.you;
      if (!msg.room.started) { app.state = null; app.prompt = null; show('room'); renderRoom(); }
      renderChat();
      break;
    case 'state': {
      const first = !app.state || msg.gameNo !== app.gameNo;
      if (msg.gameNo !== app.gameNo) { app.gameNo = msg.gameNo; app.hideResult = false; app.lastEv = 0; app.lastLog = 0; app.seen = new Set(); app.sel = []; app.code = ''; app.seq = []; }
      app.state = msg.state;
      app.prompt = msg.prompt;
      app.stateAt = Date.now();
      // 사라진 카드는 선택에서 뺌
      app.sel = app.sel.filter((k) => app.state.cards.some((c) => c.key === k));
      show('game');
      onNewLogs(first);
      renderGame();
      playEvents(first);
      if (msg.state.result && msg.state.result.win) markDone(msg.state.scenario.id, msg.state.result.stars);
      break;
    }
    case 'left':
      app.room = null; app.state = null; app.prompt = null;
      show('home');
      send({ t: 'listSaves' });
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
  toast.timer = setTimeout(() => t.classList.add('hidden'), 3200);
}
function act(value) {
  if (!app.prompt) return;
  send({ t: 'answer', promptId: app.prompt.id, value });
  Sound.play('select');
}
function setHTML(el, html) { if (el._html === html) return false; el._html = html; el.innerHTML = html; return true; }
function colorOf(pid) { return app.catalog.colors[app.state.order.indexOf(pid)] || '#ccc'; }
const scenDef = (id) => app.catalog.scenarios.find((s) => s.id === id);
const diffStr = (d) => (d ? '🔑'.repeat(d) : '🔰 입문');

// 완료 기록 (이 브라우저)
function doneMap() { try { return JSON.parse(localStorage.getItem('unlock-done') || '{}'); } catch { return {}; } }
function markDone(id, stars) { const m = doneMap(); if (!m[id] || m[id] < stars) { m[id] = stars; try { localStorage.setItem('unlock-done', JSON.stringify(m)); } catch { /* 무시 */ } } }

// ───────────── 첫 화면 / 대기실 ─────────────
function myName() { return $('#in-name').value.trim(); }
function initHome() {
  try { $('#in-name').value = localStorage.getItem('unlock-name') || ''; } catch { /* 무시 */ }
  const save = () => { try { localStorage.setItem('unlock-name', myName()); } catch { /* 무시 */ } };
  $('#btn-create').onclick = () => { save(); send({ t: 'create', name: myName() }); };
  $('#btn-join').onclick = () => { save(); send({ t: 'join', name: myName(), code: $('#in-code').value }); };
  $('#in-code').onkeydown = (e) => { if (e.key === 'Enter') $('#btn-join').click(); };
  for (const b of document.querySelectorAll('.solo')) b.onclick = () => { save(); send({ t: 'solo', name: myName() }); };
  for (const b of document.querySelectorAll('.btn-guide')) b.onclick = () => Guide.open();
  for (const b of document.querySelectorAll('.btn-sound')) b.onclick = openSound;
  $('#btn-leave').onclick = () => send({ t: 'leave' });
  $('#btn-start').onclick = () => send({ t: 'start' });
  $('#btn-copy').onclick = () => {
    const text = `언락! 방탈출 같이 해요! 주소: ${location.origin}  방 코드: ${app.room.code}`;
    navigator.clipboard?.writeText(text).then(() => toast('초대 문구를 복사했어요.'), () => toast(text));
  };
  for (const f of document.querySelectorAll('[data-chat]')) f.onsubmit = (e) => { e.preventDefault(); const i = f.querySelector('input'); if (i.value.trim()) send({ t: 'chat', text: i.value }); i.value = ''; };
  for (const b of document.querySelectorAll('.tabs [data-tab]')) b.onclick = () => { app.tab = b.dataset.tab; renderTabs(); };
  document.addEventListener('keydown', onKey);
  if (!localStorage.getItem('unlock-guided')) setTimeout(() => Guide.open(), 400);
}

function fmtTime(ms) { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function fmtClock(ms) { const neg = ms < 0; const s = Math.floor(Math.abs(ms) / 1000); return `${neg ? '+' : ''}${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
function saveTitle(sv) {
  const sm = sv.summary || {};
  return `<b>${esc(sm.title || '')}</b> · ${fmtClock(sm.elapsed || 0)} 지남 · 카드 ${sm.cards || 0}장`;
}
function renderSaves() {
  const box = $('#saves-box');
  const list = app.saves || [];
  box.classList.toggle('hidden', !list.length);
  if (!list.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="saves-title">💾 저장된 게임 이어하기</div>${list.map((sv) => `<div class="save-row"><div class="save-info">${saveTitle(sv)}<br><span class="hint">${esc(sv.names.join(', '))} · ${fmtTime(sv.savedAt)} 저장</span></div>
      <button class="primary small" data-resume="${esc(sv.id)}">▶ 이어하기</button><button class="small" data-delsave="${esc(sv.id)}" title="저장 삭제">🗑</button></div>`).join('')}
    <p class="hint">게임 중에 그만두거나 창을 닫아도 자동으로 저장돼요 (시계도 멈춘 시간부터 이어져요).</p>`;
  for (const b of box.querySelectorAll('[data-resume]')) b.onclick = () => send({ t: 'resume', id: b.dataset.resume, name: $('#in-name').value });
  for (const b of box.querySelectorAll('[data-delsave]')) b.onclick = () => { if (confirm('이 저장된 게임을 삭제할까요? 되돌릴 수 없어요.')) send({ t: 'deleteSave', id: b.dataset.delsave }); };
}

function renderResumeRoom(r, isHost) {
  const rs = r.resume;
  $('#room-players').innerHTML = r.players.map((p, i) => `<div class="rp" style="--pc:${app.catalog.colors[i]}">${esc(p.name)}${p.id === app.you ? ' <span class="hint">(나)</span>' : ''}${p.id === r.hostId ? ' 👑' : ''}</div>`).join('');
  $('#room-settings').innerHTML = `<div class="resume-box"><div class="resume-head">💾 저장된 게임 이어하기</div>
    <p>${saveTitle(rs)} <span class="hint">(${fmtTime(rs.savedAt)} 저장)</span></p>
    <div class="slot-list">${rs.slots.map((s) => { const mine = s.id === app.you; return `<div class="slot-card ${mine ? 'mine' : ''} ${s.taken && !mine ? 'taken' : ''}"><b>${esc(s.name)}의 자리</b>${mine ? '<span>✔ 내 자리</span>' : s.taken ? '<span class="hint">다른 사람이 앉음</span>' : `<button class="small primary" data-slot="${esc(s.id)}">이 자리에 앉기</button>`}</div>`; }).join('')}</div>
    <p class="hint">빈자리는 그냥 비워 둬도 돼요. 언락은 누구든 모든 카드를 다룰 수 있어요.</p>
    ${isHost ? '<button class="small" id="btn-new-instead">이어하지 않고 새 게임 준비하기</button>' : ''}</div>`;
  const nb = $('#btn-new-instead');
  if (nb) nb.onclick = () => { if (confirm('저장된 게임은 그대로 두고, 이 방에서 새 게임을 준비할까요?')) send({ t: 'cancelResume' }); };
  for (const b of document.querySelectorAll('[data-slot]')) b.onclick = () => send({ t: 'claimSlot', slot: b.dataset.slot });
  $('#btn-start').disabled = !isHost || r.loading;
  $('#btn-start').textContent = r.loading ? '불러오는 중…' : isHost ? '▶ 이어서 시작' : '방장이 이어서 시작하기를 기다리는 중…';
}

function renderRoom() {
  const r = app.room;
  const c = app.catalog;
  const isHost = r.hostId === app.you;
  $('#room-code').textContent = r.code;
  if (r.resume) { renderResumeRoom(r, isHost); return; }
  $('#invite-hint').innerHTML = `친구에게 주소 <b>${esc(location.origin)}</b> 와 방 코드 <b>${r.code}</b>를 알려 주세요. (최대 ${r.maxPlayers}명, 모두가 같은 카드를 보며 함께 풀어요)`;
  $('#room-players').innerHTML = r.players.map((p) => `<div class="rp" style="--pc:${p.color}">${esc(p.name)}${p.id === app.you ? ' <span class="hint">(나)</span>' : ''}${p.id === r.hostId ? ' 👑' : ''}${!p.connected ? ' <span class="hint">(연결 끊김)</span>' : ''}</div>`).join('');
  const cur = scenDef(r.settings.scenario) || c.scenarios[0];
  if (!app.box) app.box = cur.box;
  const done = doneMap();
  const boxDone = (b) => c.scenarios.filter((s) => s.box === b && done[s.id]).length;
  $('#room-settings').innerHTML = `<div class="rs-title">🗝 시나리오 고르기 <span class="hint" style="font-family:var(--sans)">${isHost ? '' : '(방장만 고를 수 있어요)'} · 모두 ${c.scenarios.length}개 · 이 컴퓨터에서 ${Object.keys(done).length}개 탈출</span></div>
    <div class="box-tabs">${c.boxes.map((b) => `<button class="small box-tab ${b === app.box ? 'on' : ''}" data-box="${esc(b)}">${esc(b)} <span class="hint">${boxDone(b)}/${c.scenarios.filter((s) => s.box === b).length}</span></button>`).join('')}</div>
    <div class="scens">${c.scenarios.filter((s) => s.box === app.box).map((s) => `<div class="scen ${s.id === cur.id ? 'on' : ''} ${isHost ? '' : 'dis'}" data-scen="${s.id}" style="--sc:${s.theme || '#2e5478'}">
      ${done[s.id] ? `<span class="done">✔ ${'★'.repeat(done[s.id])}</span>` : ''}
      <div class="s-title">${esc(s.title)}</div><div class="s-orig">${esc(s.orig)}</div>
      <div class="s-meta"><span class="diff">${diffStr(s.diff)}</span><span>🃏 ${s.cards}장</span></div>
      <div class="s-intro">${esc(s.intro)}</div></div>`).join('')}</div>`;
  for (const b of document.querySelectorAll('[data-box]')) b.onclick = () => { app.box = b.dataset.box; renderRoom(); };
  if (isHost) for (const el of document.querySelectorAll('[data-scen]')) el.onclick = () => send({ t: 'setSettings', settings: { scenario: el.dataset.scen } });
  $('#btn-start').disabled = !isHost;
  $('#btn-start').textContent = isHost ? `「${cur.title}」 탈출 시작! ▶` : '방장이 시작하기를 기다리는 중…';
}

function renderChat() {
  if (!app.room) return;
  const html = app.room.chat.map((c) => `<div><b>${esc(c.name)}</b>: ${esc(c.text)}</div>`).join('') || '<div class="hint">채팅 내용이 여기에 나와요.</div>';
  for (const el of [$('#room-chat'), $('#game-chat')]) { el.innerHTML = html; el.scrollTop = el.scrollHeight; }
  const last = app.room.chat.length ? app.room.chat[app.room.chat.length - 1].at : 0;
  if (last > app.lastChat && app.lastChat) Sound.play('chat');
  app.lastChat = last;
}

// ───────────── 게임 화면 ─────────────
function partColor(c) { if (['red', 'blue'].includes(c.type)) return c.type; return c.plus ? c.plus.color : null; }
function cardOf(k) { return app.state.cards.find((c) => c.key === k); }
function elapsedNow() { const st = app.state; if (st.result) return st.result.ms; return st.elapsed + (st.running ? Date.now() - app.stateAt : 0); }

function renderGame() {
  renderTop();
  renderTable();
  renderAction();
  renderLog();
  renderTabs();
  renderResult();
}

function renderTop() {
  const st = app.state;
  const html = `
    <div class="tb-logo">UNLOCK!</div>
    <div class="tb-scen">${esc(st.scenario.title)} <span class="hint" style="font-family:var(--sans)">${esc(st.scenario.orig)}</span></div>
    <div class="timer" id="timer"></div>
    <div class="tb-box" title="틀린 조합·코드마다 ${st.penaltyMin}분씩 줄어요">⏱ 벌점 <b>${st.penalties}</b></div>
    <div class="tb-box">💡 힌트 <b>${st.hintsUsed}</b></div>
    <div class="tb-box">🃏 ${st.cards.length}장 · 버린 ${st.goneCount}장</div>
    <div class="tb-btns"><button class="small btn-full">${document.fullscreenElement ? '🗗 창 모드' : '⛶ 전체 화면'}</button><button class="small btn-guide2">📖 게임 방법</button><button class="small btn-sound2">⚙ 설정</button>${quitButtonHTML()}${st.result ? '<button class="small" id="btn-show-result">🏁 결과</button>' : '<button class="small danger" id="btn-giveup">🏳 포기</button>'}</div>`;
  if (setHTML($('#topbar'), html)) {
    $('#topbar .btn-guide2').onclick = () => Guide.open();
    $('#topbar .btn-sound2').onclick = openSound;
    $('#topbar .btn-full').onclick = toggleFullscreen;
    bindQuitButton();
    const rb = $('#btn-show-result');
    if (rb) rb.onclick = () => { app.hideResult = false; renderResult(); };
    const gb = $('#btn-giveup');
    if (gb) gb.onclick = () => { if (confirm('정말 탈출을 포기할까요?')) act({ a: 'giveup' }); };
  }
  tickTimer();
}
function tickTimer() {
  const el = $('#timer');
  if (!el || !app.state) return;
  const left = app.state.limitMin * 60000 - elapsedNow();
  el.textContent = fmtClock(left);
  el.className = `timer ${left < 0 ? 'over' : left < 10 * 60000 ? 'low' : ''}`;
}
setInterval(tickTimer, 500);
function quitButtonHTML() {
  if (!app.room || app.state.result || app.room.hostId !== app.you) return '';
  return '<button class="small" id="btn-quit" title="지금까지 진행을 저장하고 대기실로 돌아가기">💾 저장하고 그만하기</button>';
}
function bindQuitButton() {
  const b = $('#btn-quit');
  if (b) b.onclick = () => { if (confirm('게임을 저장하고 대기실로 돌아갈까요?\n\n나중에 첫 화면의 "💾 저장된 게임 이어하기"에서 지금 상태 그대로 계속할 수 있어요.')) send({ t: 'quitGame' }); };
}

/** 그림(이모지) 개수 — 많으면 글자를 줄여 한 줄에 맞춘다 */
const artSeg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter() : null;
function artCount(art) { return Math.max(1, artSeg ? [...artSeg.segment(art || '')].length : [...(art || '')].length); }

function cardHTML(c, theme) {
  const sel = app.sel.includes(c.key);
  const spots = c.spots.map((s, i) => (s.hidden ? `<span class="hnum ${s.found ? 'found' : ''}" style="left:${s.x}%;top:${s.y}%">${esc(s.num)}</span>`
    : `<span class="spot ${s.found ? 'found' : ''}" data-spot="${i}" data-card="${c.key}" style="left:${s.x}%;top:${s.y}%" title="${esc(s.label)} 살펴보기">${s.emoji || '🔍'}</span>`)).join('');
  return `<div class="ucard t-${c.type} ${sel ? 'sel' : ''} ${app.seen.has(c.key) ? '' : 'new'}" data-key="${c.key}" style="--theme:${theme};--artn:${artCount(c.art)}">
    <div class="c-head"><span class="c-num">${esc(c.num)}</span><span class="c-title">${esc(c.title)}</span>${c.plus ? `<span class="plus plus-${c.plus.color}" title="보정 숫자: 다른 색 번호에 더해요">+${c.plus.n}</span>` : ''}</div>
    <div class="c-art">${c.type === 'place' ? `<span class="bg">${esc(c.art)}</span>` : esc(c.art)}${spots}</div>
    ${c.solved ? '<span class="solved">✅</span>' : ''}
    <div class="c-text">${esc(c.text)}</div>
    ${c.hintsSeen.length ? c.hintsSeen.map((h) => `<div class="hint-seen">💡 ${esc(h)}</div>`).join('') : ''}
    <div class="c-foot"><span class="hint" style="color:#666">${TYPE_NAME[c.type]}</span>${c.shows.length ? ` · 보이는 번호 ${c.shows.map((n) => `<span class="chipn">${n}</span>`).join('')}` : ''}${c.spots.some((s) => !s.hidden) ? ` · 🔍 ${c.spots.filter((s) => !s.hidden && s.found).length}/${c.spots.filter((s) => !s.hidden).length}` : ''}</div>
  </div>`;
}

function renderTable() {
  const st = app.state;
  const places = st.cards.filter((c) => c.type === 'place');
  const others = st.cards.filter((c) => c.type !== 'place');
  const theme = st.scenario.theme || '#2e5478';
  const html = `${places.map((c) => cardHTML(c, theme)).join('')}<div class="table-sec">${others.length ? '🃏 손에 든 카드 · 장치 · 단서 <span class="hint" style="font-family:var(--sans)">(카드를 눌러 고르세요 — 빨강+파랑을 고르면 합칠 수 있어요)</span>' : ''}</div>${others.map((c) => cardHTML(c, theme)).join('')}
    <div class="table-sec">🂠 덱 — 아직 뒤집지 않은 카드 ${st.deck.length}장 <span class="hint" style="font-family:var(--sans)">(합친 번호가 여기 없으면 그 조합은 아니에요. 있는데 틀린 조합이면 벌점!)</span></div>
    <div class="deck">${st.deck.map((n) => `<span class="back">${esc(n)}</span>`).join('')}</div>`;
  const el = $('#table');
  if (setHTML(el, html)) {
    for (const d of el.querySelectorAll('.ucard')) d.onclick = (e) => {
      const sp = e.target.closest('[data-spot]');
      if (sp) { e.stopPropagation(); act({ a: 'spot', card: sp.dataset.card, i: Number(sp.dataset.spot) }); return; }
      toggleSel(d.dataset.key);
    };
  }
  for (const c of st.cards) app.seen.add(c.key);
}

function toggleSel(k) {
  const c = cardOf(k);
  if (!c) return;
  if (app.sel.includes(k)) app.sel = app.sel.filter((x) => x !== k);
  else if (partColor(c)) {
    // 빨강·파랑(보정 숫자 포함)은 색깔별로 하나씩 (같은 색이면 바꿈), 다른 종류 선택은 지움
    app.sel = app.sel.filter((x) => { const o = cardOf(x); return o && partColor(o) && partColor(o) !== partColor(c); });
    app.sel.push(k);
  } else app.sel = [k];
  app.code = ''; app.seq = [];
  Sound.play('click');
  $('#table')._html = null;
  renderTable(); renderAction();
}

function renderAction() {
  const st = app.state;
  const el = $('#action');
  const who = `<div class="who">${st.players.map((p) => `<span style="--pc:${colorOf(p.id)}">${esc(p.name)}</span>`).join('')}</div>`;
  if (st.result) { setHTML(el, `<h3>${st.result.win ? '🎉 탈출 성공!' : '🏁 게임 종료'}</h3><p>${esc(st.result.reason)}</p>${who}`); return; }
  const sel = app.sel.map(cardOf).filter(Boolean);
  let body = '';
  if (!sel.length) {
    body = `<h3>🔍 무엇을 할까요?</h3><p class="hint">· 그림 속에 <b>작게 숨은 번호</b>를 찾으면 위 칸에 입력해 카드를 가져와요<br>· 🔍 동그라미는 눌러서 살펴봐요<br>· <b class="red">빨간</b> 번호 + <b class="blue">파란</b> 번호(또는 <b>+보정 숫자</b>)를 골라 합치기<br>· <b class="yellow">노란</b> 카드는 코드, <b class="green">초록</b> 카드는 장치<br>· 막히면 카드를 골라 💡 힌트!</p>`;
  } else {
    const chips = sel.map((c) => `<span class="sel-chip" style="--cc:${TYPE_COLOR[c.type]}">${esc(c.num)} ${esc(c.title)}</span>`).join('');
    const one = sel.length === 1 ? sel[0] : null;
    body = `<h3>선택한 카드</h3><div class="sel-list">${chips}</div>`;
    const red = sel.find((c) => partColor(c) === 'red'); const blue = sel.find((c) => partColor(c) === 'blue');
    if (red && blue) { const sv = (c) => (c.plus && !['red', 'blue'].includes(c.type) ? c.plus.n : c.num); body += `<div class="sum">${red.plus && !['red', 'blue'].includes(red.type) ? '+' : ''}${sv(red)} + ${blue.plus && !['red', 'blue'].includes(blue.type) ? '+' : ''}${sv(blue)} = ${sv(red) + sv(blue)}</div><button class="primary" id="btn-combine">🧩 합치기</button> <span class="hint">그 번호의 카드가 덱에 있는데 틀리면 벌점 ${st.penaltyMin}분</span>`; }
    else if (red || blue) body += `<p class="hint">${red ? '파란' : '빨간'} 카드를 하나 더 고르면 합칠 수 있어요.</p>`;
    if (one && one.type === 'code' && !one.solved) {
      body += `<div class="code-show">${esc(app.code.padEnd(one.len, '·'))}</div>
        <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="del">⌫</button><button data-k="0">0</button><button data-k="ok" class="primary">확인</button></div>
        <p class="hint">숫자 ${one.len}자리 · 키보드로도 입력할 수 있어요</p>`;
    }
    if (one && one.type === 'machine' && !one.solved) {
      body += `<div class="code-show" style="letter-spacing:2px;font-size:1.3em">${app.seq.map(esc).join(' ') || '&nbsp;'}</div>
        <div class="mach-btns">${one.buttons.map((b, i) => `<button data-mb="${i}">${esc(b)}</button>`).join('')}</div>
        <div class="act-row"><button class="small" id="btn-mclear">↺ 다시</button><button class="primary small" id="btn-mgo" ${app.seq.length ? '' : 'disabled'}>⚙ 작동!</button><span class="hint">${one.len}번 누르는 장치</span></div>`;
    }
    const rows = [];
    if (one && one.hints > one.hintsSeen.length) rows.push(`<button class="small" id="btn-hint">💡 힌트 (${one.hintsSeen.length + 1}/${one.hints})</button>`);
    if (one) rows.push(`<button class="small" id="btn-discard" title="다 쓴 카드를 치워요">🗑 버리기</button>`);
    rows.push('<button class="small" id="btn-unsel">선택 해제</button>');
    body += `<div class="act-row">${rows.join('')}</div>`;
  }
  const take = `<form class="take-row" id="take-form"><input id="take-num" maxlength="3" placeholder="번호" autocomplete="off"><button class="small primary">🂠 번호로 카드 가져오기</button></form>`;
  const keep = document.activeElement && document.activeElement.id === 'take-num' ? document.activeElement.value : null;
  if (setHTML(el, take + body + who)) {
    bindAction();
    const tf = document.getElementById('take-form');
    tf.onsubmit = (e) => { e.preventDefault(); const i = document.getElementById('take-num'); if (i.value.trim()) act({ a: 'take', num: i.value.trim() }); i.value = ''; };
    if (keep != null) { const i = document.getElementById('take-num'); i.value = keep; i.focus(); }
  }
}
function bindAction() {
  const sel = app.sel.map(cardOf).filter(Boolean);
  const one = sel.length === 1 ? sel[0] : null;
  const on = (id, f) => { const b = document.getElementById(id); if (b) b.onclick = f; };
  on('btn-combine', () => { const r = sel.find((c) => partColor(c) === 'red'); const b = sel.find((c) => partColor(c) === 'blue'); act({ a: 'combine', x: r.key, y: b.key }); app.sel = []; });
  on('btn-hint', () => { if (confirm('힌트를 볼까요? (별점에 영향이 있어요)')) act({ a: 'hint', card: one.key }); });
  on('btn-discard', () => { act({ a: 'discard', card: one.key }); app.sel = []; });
  on('btn-unsel', () => { app.sel = []; $('#table')._html = null; renderTable(); renderAction(); });
  on('btn-mclear', () => { app.seq = []; renderAction(); });
  on('btn-mgo', () => { act({ a: 'machine', card: one.key, seq: app.seq }); app.seq = []; });
  for (const b of document.querySelectorAll('[data-k]')) b.onclick = () => keyIn(b.dataset.k);
  for (const b of document.querySelectorAll('[data-mb]')) b.onclick = () => { if (app.seq.length < 12) { app.seq.push(one.buttons[Number(b.dataset.mb)]); Sound.play('click'); renderAction(); } };
}
function keyIn(k) {
  const one = app.sel.length === 1 ? cardOf(app.sel[0]) : null;
  if (!one || one.type !== 'code' || one.solved) return;
  if (k === 'del') app.code = app.code.slice(0, -1);
  else if (k === 'ok') { if (app.code) { act({ a: 'code', card: one.key, code: app.code }); app.code = ''; } }
  else if (app.code.length < 8) { app.code += k; Sound.play('click'); }
  renderAction();
}
function onKey(e) {
  if (!app.state || e.target.tagName === 'INPUT') return;
  if (/^[0-9]$/.test(e.key)) keyIn(e.key);
  else if (e.key === 'Backspace') keyIn('del');
  else if (e.key === 'Enter') keyIn('ok');
}

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

function onNewLogs(first) {
  const st = app.state;
  app.lastLog = st.log.length ? st.log[st.log.length - 1].seq : 0;
  if (first) return;
}
function burstAt(el, text, cls) {
  const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2 - 50, top: innerHeight / 2, width: 100, height: 0 };
  const f = document.createElement('div');
  f.className = `burst ${cls}`;
  f.textContent = text;
  f.style.left = `${r.left + r.width / 2}px`;
  f.style.top = `${r.top + Math.min(r.height, 120) / 2 + 20}px`;
  $('#fx-layer').appendChild(f);
  setTimeout(() => f.remove(), 1500);
}
function playEvents(first) {
  const st = app.state;
  const evs = (st.events || []).filter((e) => e.id > app.lastEv);
  if (st.events && st.events.length) app.lastEv = Math.max(app.lastEv, ...st.events.map((e) => e.id));
  if (first) return;
  const cardEl = (k) => document.querySelector(`.ucard[data-key="${k}"]`);
  for (const e of evs.slice(-8)) {
    if (e.kind === 'found') { burstAt(cardEl(e.card), '🔍 발견!', 'good'); Sound.play('presence'); }
    else if (e.kind === 'combine') { burstAt(cardEl(e.key), '🧩 딸깍!', 'good'); Sound.play('build'); }
    else if (e.kind === 'solved') { burstAt(null, '✅ 풀었다!', 'good'); Sound.play('fearCard'); }
    else if (e.kind === 'wrong' || e.kind === 'penalty') { const t = $('#topbar'); t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake'); Sound.play('error'); if (e.kind === 'penalty') burstAt($('#timer'), `-${e.n * st.penaltyMin}분`, 'bad'); }
    else if (e.kind === 'end') { burstAt(null, e.win ? '🔓 탈출 성공!' : '게임 종료', 'big'); Sound.play(e.win ? 'victory' : 'defeat'); }
  }
}

function renderResult() {
  const st = app.state;
  const box = $('#result');
  if (!st.result || app.hideResult) { box.classList.add('hidden'); return; }
  const isHost = app.room && app.room.hostId === app.you;
  const r = st.result;
  const left = st.limitMin * 60000 - r.ms;
  box.querySelector('.modal-inner').innerHTML = `<div class="res-head ${r.win ? 'win' : 'lose'}">${r.win ? '🔓 탈출 성공!' : '🏳 탈출 실패'}</div>
    <p>${esc(r.reason)}</p>
    ${r.win ? `<div class="stars">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= r.stars ? '' : 'off'}">⭐</span>`).join('')}</div>` : ''}
    <div class="res-stats"><div>걸린 시간 <b>${fmtClock(r.ms)}</b></div><div>${left >= 0 ? `남은 시간 <b>${fmtClock(left)}</b>` : `초과 <b>${fmtClock(-left)}</b>`}</div><div>벌점 <b>${r.penalties}</b></div><div>힌트 <b>${r.hints}</b></div></div>
    <div class="actions" style="justify-content:center"><button class="small" id="res-close">카드 보기</button>${isHost ? '<button class="primary" id="res-lobby">🗝 다른 시나리오 고르기</button><button class="small" id="res-rematch">🔁 같은 시나리오 다시</button>' : '<span class="hint">방장이 다음 시나리오를 고를 거예요</span>'}<button class="small" id="res-leave">나가기</button></div>`;
  box.classList.remove('hidden');
  $('#res-close').onclick = () => { app.hideResult = true; box.classList.add('hidden'); };
  const lb = $('#res-lobby');
  if (lb) lb.onclick = () => { app.hideResult = false; send({ t: 'backToLobby' }); };
  const rm = $('#res-rematch');
  if (rm) rm.onclick = () => { rm.disabled = true; send({ t: 'rematch' }); };
  $('#res-leave').onclick = () => { app.hideResult = false; box.classList.add('hidden'); send({ t: 'leave' }); };
}

// ───────────── 설정 ─────────────
function applyFontScale(v) {
  document.documentElement.style.setProperty('--fs', String(v));
  try { localStorage.setItem('unlock-fs', String(v)); } catch { /* 무시 */ }
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
  try { fs = Number(localStorage.getItem('unlock-fs')) || 1; } catch { /* 무시 */ }
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
    el.classList.remove('hidden');
    clearTimeout(initSettings.t);
    initSettings.t = setTimeout(() => el.classList.add('hidden'), 4200);
  };
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (Guide.isOpen()) Guide.close();
    else $('#sound-panel').classList.add('hidden');
  });
  document.addEventListener('pointerdown', () => Sound.init(), { once: true });
}

document.addEventListener('DOMContentLoaded', () => { initHome(); initSettings(); connect(); });
