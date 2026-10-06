'use strict';
/* 반지의 제왕: 원정대의 운명 — 클라이언트 */

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const app = {
  ws: null, token: null, catalog: null, room: null, you: null, state: null, prompt: null,
  lastLog: 0, lastEv: 0, tab: 'log', lastChat: 0, wasMyTurn: false, seenCards: new Set(), actor: null, D: null,
};
window.app = app;

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
  ws.onopen = () => send({ t: 'hello', token: sessionStorage.getItem('lotr-token') || localStorage.getItem('lotr-token') });
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onclose = () => { toast('서버와 연결이 끊겼어요. 다시 연결하는 중…'); setTimeout(connect, 1500); };
}
function send(msg) { if (app.ws && app.ws.readyState === 1) app.ws.send(JSON.stringify(msg)); }

function buildD(c) {
  const LOC = Object.fromEntries(c.locations.map((l) => [l.id, l]));
  const EDGES = [];
  for (const l of c.locations) for (const a of l.adj) if (l.id < a) EDGES.push([l.id, a]);
  return { LOCATIONS: c.locations, LOC, EDGES, REGIONS: c.regions, CHAR: Object.fromEntries(c.characters.map((x) => [x.id, x])) };
}

function onMessage(msg) {
  switch (msg.t) {
    case 'welcome':
      app.token = msg.token;
      app.catalog = msg.catalog;
      app.D = buildD(msg.catalog);
      try { sessionStorage.setItem('lotr-token', msg.token); localStorage.setItem('lotr-token', msg.token); } catch { /* 무시 */ }
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
      if (msg.gameNo !== app.gameNo) { app.gameNo = msg.gameNo; app.hideResult = false; app.lastEv = 0; app.lastLog = 0; app.seenCards = new Set(); app.actor = null; app.boardBuilt = false; }
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
function answer(value) {
  if (!app.prompt) return;
  send({ t: 'answer', promptId: app.prompt.id, value });
  Sound.play('select');
}
function setHTML(el, html) { if (el._html === html) return false; el._html = html; el.innerHTML = html; return true; }
const charDef = (id) => app.D.CHAR[id];
const locDef = (id) => app.D.LOC[id];
const regionColor = (r) => (app.catalog.regions[r] || {}).color || '#666';
function colorOf(pid) { return app.catalog.colors[app.state.order.indexOf(pid)] || '#ccc'; }
function ownerOf(charId) { const p = app.state.players.find((x) => x.chars.includes(charId)); return p ? p.id : null; }

// ───────────── 첫 화면 / 대기실 ─────────────
function myName() { return $('#in-name').value.trim(); }
function initHome() {
  try { $('#in-name').value = localStorage.getItem('lotr-name') || ''; } catch { /* 무시 */ }
  const save = () => { try { localStorage.setItem('lotr-name', myName()); } catch { /* 무시 */ } };
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
    const text = `반지의 제왕: 원정대의 운명 같이 해요! 주소: ${location.origin}  방 코드: ${app.room.code}`;
    navigator.clipboard?.writeText(text).then(() => toast('초대 문구를 복사했어요.'), () => toast(text));
  };
  for (const f of document.querySelectorAll('[data-chat]')) f.onsubmit = (e) => { e.preventDefault(); const i = f.querySelector('input'); if (i.value.trim()) send({ t: 'chat', text: i.value }); i.value = ''; };
  for (const b of document.querySelectorAll('.tabs [data-tab]')) b.onclick = () => { app.tab = b.dataset.tab; renderTabs(); };
  if (!localStorage.getItem('lotr-guided')) setTimeout(() => Guide.open(), 400);
}

function charsLine(ids, size = 24) {
  return (ids || []).map((id, i) => { const c = charDef(id); return c ? `${Art.charBadge(c, size)}<b>${esc(c.short)}</b>${ids.length > 1 ? `<span class="role">${i ? '(보조)' : '(주)'}</span>` : ''}` : ''; }).join(' ');
}
function saveTitle(sv) {
  const sm = sv.summary || {};
  const d = app.catalog.difficulties.find((x) => x.id === sm.difficulty);
  return `<b>${sm.round || 1}라운드</b>${d ? ` · ${esc(d.name)}` : ''} · 희망 ${sm.hope ?? '-'} · 목표 ${sm.objectives || 0}개 · ${(sm.chars || []).flat().map((c) => (charDef(c) || {}).icon || '').join('')}`;
}
function slotDesc(s) { return `<span class="rp-chars">${charsLine(s.chars, 22)}</span>`; }
function fmtTime(ms) { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function renderSaves() {
  const box = $('#saves-box');
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
      ${slotDesc(s)}</div>`;
  }).join('');
  $('#room-settings').innerHTML = `<div class="resume-box"><div class="resume-head">💾 저장된 게임 이어하기</div>
    <p>${saveTitle(rs)}부터 계속합니다 <span class="hint">(${fmtTime(rs.savedAt)} 저장)</span></p>
    <p class="hint">설정·순서·인물은 저장할 때 그대로예요. 아무도 앉지 않은 자리는 AI가 대신 진행합니다.</p>
    ${isHost ? '<button class="small" id="btn-new-instead">이어하지 않고 새 게임 준비하기</button>' : ''}</div>`;
  const nb = $('#btn-new-instead');
  if (nb) nb.onclick = () => { if (confirm('저장된 게임은 그대로 두고, 이 방에서 새 게임을 준비할까요?')) send({ t: 'cancelResume' }); };
  $('#char-pick').innerHTML = `<div class="rs-title">🪑 내 자리 고르기</div><div class="slot-list">${rs.slots.filter((s) => !s.bot).map((s) => {
    const mine = s.id === app.you;
    return `<div class="slot-card ${mine ? 'mine' : ''} ${s.taken && !mine ? 'taken' : ''}"><div class="slot-name">${esc(s.name)}의 자리</div><div>${slotDesc(s)}</div>
      ${mine ? '<span class="slot-tag">✔ 내 자리</span>' : s.taken ? '<span class="hint">다른 사람이 앉음</span>' : `<button class="small primary" data-slot="${esc(s.id)}">이 자리에 앉기</button>`}</div>`;
  }).join('')}</div>`;
  for (const b of document.querySelectorAll('[data-slot]')) b.onclick = () => send({ t: 'claimSlot', slot: b.dataset.slot });
  $('#btn-start').disabled = !isHost || r.loading;
  $('#btn-add-bot').disabled = true;
  $('#btn-start').textContent = r.loading ? '불러오는 중…' : isHost ? '▶ 이어서 시작' : '방장이 이어서 시작하기를 기다리는 중…';
}

function renderRoom() {
  const r = app.room;
  const c = app.catalog;
  const isHost = r.hostId === app.you;
  $('#room-code').textContent = r.code;
  if (r.resume) { renderResumeRoom(r, isHost); return; }
  $('#invite-hint').innerHTML = `친구에게 주소 <b>${esc(location.origin)}</b> 와 방 코드 <b>${r.code}</b>를 알려 주세요. (최대 ${r.maxPlayers}명, AI 동료로 빈자리를 채울 수 있어요)`;
  $('#room-players').innerHTML = r.players.map((p, i) => `<div class="rp" style="--pc:${p.color}"><span class="rp-order">${i + 1}</span>
      <span class="rp-name">${esc(p.name)}${p.id === app.you ? ' <span class="hint">(나)</span>' : ''}${p.id === r.hostId ? ' 👑' : ''}${p.bot ? ' <span class="tag">AI</span>' : ''}${!p.connected ? ' <span class="hint">(연결 끊김)</span>' : ''}</span>
      <span class="rp-chars">${p.chars.length ? charsLine(p.chars, 24) : ''}${p.chars.length < 2 ? ` <span class="hint">${p.chars.length ? '보조 인물 미선택' : '인물 미선택'} (무작위)</span>` : ''}</span>
      ${isHost ? `<span><button class="small" data-move="${p.id}" data-dir="up" ${i ? '' : 'disabled'}>▲</button><button class="small" data-move="${p.id}" data-dir="down" ${i < r.players.length - 1 ? '' : 'disabled'}>▼</button>${p.bot ? `<button class="small" data-rmbot="${p.id}">✕</button>` : ''}</span>` : ''}
    </div>`).join('');
  for (const b of document.querySelectorAll('[data-move]')) b.onclick = () => send({ t: 'move', id: b.dataset.move, dir: b.dataset.dir });
  for (const b of document.querySelectorAll('[data-rmbot]')) b.onclick = () => send({ t: 'removeBot', id: b.dataset.rmbot });
  const st = r.settings;
  const dis = isHost ? '' : 'disabled';
  $('#room-settings').innerHTML = `<div class="rs-title">⚔ 난이도 ${isHost ? '' : '<span class="hint">(방장만 바꿀 수 있어요)</span>'}</div>
    <div class="diffs">${c.difficulties.map((d) => `<button class="small diff-opt ${st.difficulty === d.id ? 'on' : ''}" data-diff="${d.id}" ${dis}>${esc(d.name)}</button>`).join('')}</div>
    <div class="hint diff-desc">${esc((c.difficulties.find((d) => d.id === st.difficulty) || {}).desc || '')}. 희망이 0이 되거나 원정대 덱이 떨어지면 패배!</div>`;
  if (isHost) for (const b of document.querySelectorAll('[data-diff]')) b.onclick = () => send({ t: 'setSettings', settings: { difficulty: b.dataset.diff } });
  const meP = r.players.find((p) => p.id === app.you);
  const owner = (id) => r.players.find((p) => p.chars.includes(id));
  const frodo = c.characters.find((x) => x.ringbearer);
  $('#char-pick').innerHTML = `<div class="rs-title">🧝 인물 고르기 <span class="hint">한 사람이 2명을 맡아요: 처음 고른 인물이 <b>주 인물</b>(행동 4번), 두 번째가 <b>보조 인물</b>(행동 1번). 다시 누르면 취소.${isHost && r.players.some((p) => p.bot) ? ' 방장은 AI의 인물도 정할 수 있어요.' : ''}</span></div>
    <div class="chars">
      <div class="char-opt fixed" style="--cc:${frodo.color}"><div class="co-top">${Art.charBadge(frodo, 44)}<div><div class="co-name">${esc(frodo.name)}</div><span class="hint">언제나 함께 — 모두가 움직여요</span></div></div><div class="co-ab">${esc(frodo.ability)}</div></div>
      ${c.characters.filter((x) => !x.ringbearer).map((ch) => {
        const o = owner(ch.id);
        const mineIdx = meP ? meP.chars.indexOf(ch.id) : -1;
        return `<div class="char-opt ${o && o.id !== app.you ? 'taken' : ''} ${mineIdx >= 0 ? 'mine' : ''}" data-char="${ch.id}" style="--cc:${ch.color}">
          <div class="co-top">${Art.charBadge(ch, 44)}<div><div class="co-name">${esc(ch.name)}</div><span class="hint">시작: ${esc(locDef(ch.start).name)}</span></div></div>
          <div class="co-ab">✨ ${esc(ch.ability)}</div>
          ${o ? `<div class="co-owner">✔ ${esc(o.name)}${o.chars.indexOf(ch.id) === 0 ? ' (주)' : ' (보조)'}</div>` : ''}
          ${isHost ? r.players.filter((p) => p.bot).map((b) => `<button class="small co-bot" data-bot="${b.id}" data-c="${ch.id}">${esc(b.name.replace('AI ', ''))}에게</button>`).join('') : ''}
        </div>`;
      }).join('')}</div>`;
  for (const el of document.querySelectorAll('.char-opt[data-char]')) el.onclick = (e) => { if (e.target.closest('.co-bot')) return; send({ t: 'pickChar', char: el.dataset.char }); };
  for (const b of document.querySelectorAll('.co-bot')) b.onclick = () => send({ t: 'pickChar', char: b.dataset.c, target: b.dataset.bot });
  $('#btn-start').disabled = !isHost;
  $('#btn-add-bot').disabled = !isHost || r.players.length >= r.maxPlayers;
  $('#btn-start').textContent = isHost ? '원정 출발! ▶' : '방장이 시작하기를 기다리는 중…';
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
function me() { return app.state.players.find((p) => p.id === app.you); }
function myChars() { const m = me(); return m ? m.chars : []; }

/** 차례 행동 중 지금 고른 인물의 선택지 */
function turnInfo() {
  const p = app.prompt;
  if (!p || p.kind !== 'turn') return null;
  const actors = [...myChars(), 'frodo'];
  const by = {};
  for (const a of actors) by[a] = p.options.filter((o) => o.char === a);
  if (!app.actor || !by[app.actor] || !by[app.actor].length) app.actor = actors.find((a) => by[a] && by[a].some((o) => !o.disabled)) || actors[0];
  return { actors, by, actor: app.actor, opts: by[app.actor] || [] };
}

function mapTargets() {
  const p = app.prompt;
  const can = {};
  if (!p) return can;
  const ti = turnInfo();
  if (ti) {
    for (const o of ti.opts) if ((o.group === 'move' || o.group === 'cardmove') && !o.disabled && (can[o.loc] == null || o.group === 'move')) can[o.loc] = o.value;
    return can;
  }
  if (['loc', 'frodostep'].includes(p.kind)) for (const o of p.options) if (o.loc && !o.disabled) can[o.loc] = o.value;
  return can;
}
function cardTargets() {
  const p = app.prompt;
  const out = {};
  const m = me();
  if (!p || !m || !['card', 'discard'].includes(p.kind)) return out;
  for (const o of p.options) if (m.hand.some((c) => c.uid === o.value)) out[o.value] = o.value;
  return out;
}

function renderGame() {
  renderTop();
  renderPrompt();
  renderBoard();
  renderSide();
  renderHand();
  renderLog();
  renderTabs();
  renderResult();
  const myTurn = app.state.current === app.you && !app.state.result;
  if (myTurn && !app.wasMyTurn) { Sound.play('turn'); const b = $('#topbar'); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }
  app.wasMyTurn = myTurn;
}

function renderTop() {
  const st = app.state;
  const cur = st.players.find((p) => p.id === st.current);
  const html = `
    <div class="tb-logo"><img src="/icon.svg" width="32" height="32" alt=""><span>원정대의 운명</span></div>
    <div class="tb-box">라운드 <b>${st.round}</b></div>
    <div class="tb-box" title="희망이 0이 되면 패배">희망 <b>${st.hope}</b></div>
    <div class="tb-box" title="이뤄야 하는 목표 수">목표 <b>${st.objectives.filter((o) => o.done).length}/${st.objNeed}</b></div>
    <div class="tb-box" title="원정대 손패의 💍 반지 문양 카드">💍 <b>${st.ringInHands}/${st.ringNeed}</b></div>
    <div class="tb-box" title="원정대 덱이 떨어지면 패배">원정대 덱 <b>${st.playerDeck}</b></div>
    <div class="tb-turn">${st.result ? '🏁 게임 종료' : st.phase === 'shadow' ? '🌑 어둠이 움직이는 중…' : cur ? (cur.id === app.you ? '<b class="mine">내 차례!</b>' : `<b>${esc(cur.name)}</b>의 차례`) : ''}</div>
    <div class="tb-btns"><button class="small btn-full">${document.fullscreenElement ? '🗗 창 모드' : '⛶ 전체 화면'}</button><button class="small btn-guide2">📖 게임 방법</button><button class="small btn-sound2">⚙ 설정</button>${quitButtonHTML()}${st.result ? '<button class="small" id="btn-show-result">🏁 결과</button>' : ''}</div>`;
  if (setHTML($('#topbar'), html)) {
    $('#topbar .btn-guide2').onclick = () => Guide.open();
    $('#topbar .btn-sound2').onclick = openSound;
    $('#topbar .btn-full').onclick = toggleFullscreen;
    bindQuitButton();
    const rb = $('#btn-show-result');
    if (rb) rb.onclick = () => { app.hideResult = false; renderResult(); };
  }
}
function quitButtonHTML() {
  if (!app.room || app.state.result || app.room.hostId !== app.you) return '';
  return '<button class="small" id="btn-quit" title="지금까지 진행을 저장하고 대기실로 돌아가기">💾 저장하고 그만하기</button>';
}
function bindQuitButton() {
  const b = $('#btn-quit');
  if (b) b.onclick = () => { if (confirm('게임을 저장하고 대기실로 돌아갈까요?\n\n나중에 첫 화면의 "💾 저장된 게임 이어하기"에서 지금 상태 그대로 계속할 수 있어요.\n(함께하는 친구들도 모두 대기실로 이동합니다)')) send({ t: 'quitGame' }); };
}

function renderPrompt() {
  const st = app.state;
  const p = app.prompt;
  const el = $('#prompt');
  if (st.result) { setHTML(el, `<span class="p-title">${st.result.win ? '🎉 승리!' : '💀 패배…'}</span> ${esc(st.result.reason)}`); return; }
  if (!p) {
    const cur = st.players.find((x) => x.id === st.current);
    setHTML(el, `<span class="p-wait">${st.phase === 'shadow' ? '🌑 어둠의 세력이 움직이는 중…' : cur ? `⏳ ${esc(cur.name)}의 차례를 기다리는 중…` : ''}</span>`);
    return;
  }
  const btn = (o, cls = '') => `<button class="small ${cls} ${o.value === 'end' ? 'opt-end' : ''}" data-v="${esc(o.value)}" ${o.disabled ? 'disabled' : ''} title="${esc(o.reason || o.text || '')}">${esc(o.label)}</button>`;
  let html;
  const ti = turnInfo();
  if (ti) {
    const a = p.actions || { main: 0, sub: 0 };
    const ap = `<span class="ap" title="남은 행동 (노랑: 주 인물·프로도, 파랑: 보조 인물)">${'<i></i>'.repeat(Math.max(0, a.main))}${'<i class="sub"></i>'.repeat(Math.max(0, a.sub))}</span>`;
    const tabs = ti.actors.map((id) => { const c = charDef(id); const n = (ti.by[id] || []).filter((o) => !o.disabled).length; return `<button class="small actor-tab ${id === ti.actor ? 'on' : ''}" data-actor="${id}" ${n ? '' : 'disabled'}>${Art.charBadge(c, 22)}${esc(c.short)}</button>`; }).join('');
    const moves = ti.opts.filter((o) => o.group === 'move' || o.group === 'cardmove');
    const acts = ti.opts.filter((o) => o.group !== 'move' && o.group !== 'cardmove');
    const events = p.options.filter((o) => o.group === 'event');
    const end = p.options.find((o) => o.value === 'end');
    html = `<span class="p-title">${ap} ${esc(p.title)}</span><span class="actor-tabs">${tabs}</span><span class="p-sep"></span>
      ${acts.map((o) => btn(o)).join('')}
      ${moves.length ? `<span class="hint">이동: 지도에서 빛나는 곳을 누르세요</span>${moves.map((o) => btn({ ...o, label: o.label.replace(/^.*? → /, '→ ') }, 'mv-btn')).join('')}` : ''}
      ${events.length ? '<span class="p-sep"></span>' + events.map((o) => btn(o, 'ev-btn')).join('') : ''}
      ${end ? btn(end) : ''}`;
  } else {
    const hasMap = Object.keys(mapTargets()).length;
    const hasCard = Object.keys(cardTargets()).length;
    html = `<span class="p-title">${esc(p.title)}</span>${hasMap ? ' <span class="hint">(지도에서 빛나는 곳을 눌러도 돼요)</span>' : ''}${hasCard ? ' <span class="hint">(아래 손패의 카드를 눌러도 돼요)</span>' : ''}
      ${p.options.map((o) => btn(o)).join('')}`;
  }
  if (setHTML(el, html)) {
    for (const b of el.querySelectorAll('button[data-v]')) b.onclick = () => answer(b.dataset.v);
    for (const b of el.querySelectorAll('button[data-actor]')) b.onclick = () => { app.actor = b.dataset.actor; el._html = null; renderPrompt(); renderBoard(); };
  }
}

function renderBoard() {
  const st = app.state;
  const board = $('#board');
  if (!app.boardBuilt) {
    board.innerHTML = Art.baseMap(app.D) + '<div class="over-wrap"></div>';
    board._over = null;
    app.boardBuilt = true;
    board.onclick = (e) => {
      const pw = e.target.closest('[data-pawn]');
      const ti = turnInfo();
      if (pw && ti && ti.actors.includes(pw.dataset.pawn) && pw.dataset.pawn !== app.actor) {
        app.actor = pw.dataset.pawn; $('#prompt')._html = null; renderPrompt(); renderBoard(); return;
      }
      const g = e.target.closest('[data-loc]');
      if (!g) return;
      const can = mapTargets();
      if (can[g.dataset.loc] != null) answer(can[g.dataset.loc]);
    };
    board.onmousemove = (e) => {
      const pw = e.target.closest('[data-pawn]');
      const g = e.target.closest('[data-loc]');
      if (pw) showTip(e, pawnTip(pw.dataset.pawn));
      else if (g) showTip(e, locTip(g.dataset.loc));
      else hideTip();
    };
    board.onmouseleave = hideTip;
  }
  const ti = turnInfo();
  const focus = new Set();
  for (const o of st.objectives) if (!o.done) { const d = app.catalog.objectives.find((x) => x.id === o.id); for (const l of (d && d.focus) || []) focus.add(l); }
  const html = Art.overlay(app.D, st, { can: mapTargets(), sel: ti ? ti.actor : null, mine: myChars(), focus, pawnColor: (id) => (id === 'frodo' ? '#ffd860' : colorOf(ownerOf(id))) });
  const wrap = board.querySelector('.over-wrap');
  if (wrap._html !== html) { wrap._html = html; wrap.innerHTML = html; }
}
const TYPE_TEXT = { haven: '✦ 안식처 — 오크와 나즈굴이 들어오지 못해요. 프로도를 숨길 수 있어요.', stronghold: '♜ 적의 요새 — 오크를 모두 물리치고 같은 지역 카드 3장으로 점령!', mountain: '▲ 산 — 김리가 강해요.', forest: '♣ 숲 — 나무수염·레골라스가 강해요.', city: '♖ 도시', plain: '• 들판' };
function locTip(id) {
  const l = locDef(id);
  const s = app.state.locs[id] || {};
  const nz = app.state.nazgul.filter((n) => n.loc === id).length;
  const pw = app.state.pawns.filter((p) => p.loc === id).map((p) => charDef(p.id).short);
  return `<b>${esc(l.name)}</b> <span class="chip" style="--rc:${regionColor(l.region)}">${esc(app.catalog.regions[l.region].name)}</span>
    <br>👹 오크 ${s.orcs || 0}/3 · 🛡 군대 ${s.armies || 0}/3${nz ? ` · 🐎 나즈굴 ${nz}` : ''}${s.captured ? ' · 🚩 점령함' : ''}
    ${pw.length ? `<br>인물: ${esc(pw.join(', '))}` : ''}
    <div class="tip-meta">${esc(TYPE_TEXT[l.type])}<br>이웃: ${l.adj.map((a) => esc(locDef(a).name)).join(', ')}</div>`;
}
function pawnTip(id) {
  const c = charDef(id);
  const o = ownerOf(id);
  const pl = o && app.state.players.find((p) => p.id === o);
  return `<b>${c.icon} ${esc(c.name)}</b> ${pl ? `<span class="hint">(${esc(pl.name)})</span>` : '<span class="hint">(원정대 모두)</span>'}
    ${id === 'frodo' ? `<br>${app.state.hidden ? '🍃 숨어 있음 — 수색 주사위 1개' : '👁 발각됨! — 수색 주사위 2개, 나즈굴이 2칸씩 쫓아와요'}` : ''}
    <div class="tip-meta">${esc(c.ability)}</div>`;
}

function renderSide() {
  const st = app.state;
  const hopeDots = Array.from({ length: st.maxHope }, (_, i) => `<i class="${i < st.hope ? '' : 'off'}"></i>`).join('');
  const threat = st.threatTrack.map((n, i) => `<span class="${i === st.threat ? 'on' : ''}">${n}</span>`).join('');
  setHTML($('#tracks'), `
    <div class="trk-row"><span class="lbl">희망</span><span class="hope">${hopeDots}</span><b>${st.hope}</b></div>
    <div class="trk-row" title="플레이어 차례가 끝날 때마다 뽑는 어둠 카드 수. 어둠의 파도가 나오면 올라가요."><span class="lbl">위협</span><span class="threat">${threat}</span><span class="hint">장씩</span></div>
    <div class="trk-row"><span class="lbl">프로도</span><span class="frodo-state ${st.hidden ? 'hid' : 'rev'}">${st.hidden ? '🍃 숨어 있음' : '👁 발각됨!'}</span><span class="hint">· ${esc(locDef(st.pawns.find((p) => p.id === 'frodo').loc).name)}</span></div>
    <div class="trk-row"><span class="lbl">덱</span><span class="hint">원정대 ${st.playerDeck}장 (🌑파도 ${st.surgesLeft}) · 어둠 ${st.shadowDeck}장${st.skipShadow ? ' · 🌙고요한 밤' : ''}</span></div>
    <div class="trk-row"><span class="lbl">기록</span><span class="hint">물리친 오크 ${st.stats.orcsSlain || 0} · 쫓아낸 나즈굴 ${st.stats.nazgulRepelled || 0}</span></div>`);
  setHTML($('#objectives'), `<div class="ob-title">🏆 목표 (${st.objectives.filter((o) => o.done).length}/${st.objNeed} 필요) <span class="hint" style="font-family:var(--sans);font-weight:400">이루고 나면 운명의 산으로!</span></div>
    ${st.objectives.map((o) => { const d = app.catalog.objectives.find((x) => x.id === o.id); return `<div class="ob ${o.done ? 'done' : ''}"><b>${esc(d.name)}</b> <span class="hint">${esc(d.text)}</span></div>`; }).join('')}`);
  const html = st.players.map((p) => `<div class="pl ${st.current === p.id ? 'cur' : ''}" style="--pc:${colorOf(p.id)}"><div class="pl-head">${esc(p.name)}${p.bot ? ' <span class="tag">AI</span>' : ''}${p.id === app.you ? ' <span class="hint">(나)</span>' : ''} <span class="hint">🃏 ${p.hand.length}</span></div>
      <div class="pl-chars">${p.chars.map((id, i) => `${Art.charBadge(charDef(id), 22, colorOf(p.id))}<span>${esc(charDef(id).short)}${i ? '' : '★'}</span>`).join(' ')}</div>
      <div class="mini-hand">${p.hand.map((c) => `<span class="chip ${c.kind === 'event' ? 'ev' : ''}" style="--rc:${c.region ? regionColor(c.region) : '#6a4a8a'}" title="${esc(c.text || '')}">${esc(c.name)}${c.ring ? '💍' : ''}${c.stealth ? '👣' : ''}</span>`).join('')}</div></div>`).join('');
  setHTML($('#players'), html);
}

function cardHTML(c, can) {
  const reg = c.region ? app.catalog.regions[c.region] : null;
  return `<div class="card ${c.kind} ${can ? 'can' : ''} ${app.seenCards.has(c.uid) ? '' : 'new'}" data-card="${c.uid}" style="--cc:${reg ? reg.color : '#6a4a8a'}">
    <div class="c-region">${reg ? esc(reg.name) : '이벤트'}</div><div class="c-name">${esc(c.name)}</div>
    ${c.kind === 'loc' ? `<div class="c-syms">${c.ring ? '<span title="반지 문양: 운명의 산에서 반지를 파괴할 때 필요">💍</span>' : ''}${c.stealth ? '<span title="은신 문양: 프로도가 숨어서 2칸 이동">👣</span>' : ''}</div>` : ''}
    ${c.text ? `<div class="c-text">${esc(c.text)}</div>` : ''}</div>`;
}
function renderHand() {
  const m = me();
  $('#my-title').innerHTML = m ? `내 손패 (${m.hand.length}/${app.catalog.handLimit}) <span class="hint" style="font-family:var(--sans)">· 지역 카드: 그 지역에서 군대 소집 · 그곳으로 이동 · 요새 점령 · 💍 반지 파괴 · 👣 은신 이동</span>` : '관전 중';
  const ct = cardTargets();
  const html = m ? m.hand.map((c) => cardHTML(c, ct[c.uid] != null)).join('') : '';
  const el = $('#hand');
  if (setHTML(el, html)) {
    for (const d of el.querySelectorAll('[data-card]')) {
      d.onclick = () => { const tt = cardTargets(); if (tt[d.dataset.card] != null) { answer(tt[d.dataset.card]); Sound.play('cardPlay'); } };
    }
  }
  if (m) for (const c of m.hand) app.seenCards.add(c.uid);
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

const LOG_SOUND = { bad: 'ravage', good: 'presence', turn: 'phase' };
function onNewLogs(first) {
  const st = app.state;
  const fresh = st.log.filter((l) => l.seq > app.lastLog);
  app.lastLog = st.log.length ? st.log[st.log.length - 1].seq : 0;
  if (first) return;
  const played = new Set();
  for (const l of fresh.slice(-5)) {
    if (l.kind === 'win' && st.result) { Sound.play('victory'); continue; }
    if (l.kind === 'lose') { Sound.play('defeat'); continue; }
    const s = LOG_SOUND[l.kind];
    if (s && !played.has(s)) { Sound.play(s); played.add(s); }
  }
}

function burstAt(locId, text, cls) {
  const l = locDef(locId);
  const b = $('#board').getBoundingClientRect();
  burstXY(b.left + (l.x / Art.W) * b.width, b.top + (l.y / Art.H) * b.height, text, cls);
}
function burstXY(x, y, text, cls) {
  const f = document.createElement('div');
  f.className = `burst ${cls}`;
  f.textContent = text;
  f.style.left = `${x + (Math.random() * 30 - 15)}px`;
  f.style.top = `${y}px`;
  $('#fx-layer').appendChild(f);
  setTimeout(() => f.remove(), 1400);
}
function burstCenter(text, cls) { const b = $('#board').getBoundingClientRect(); burstXY(b.left + b.width / 2, b.top + b.height / 2, text, cls); }
function playEvents(first) {
  const st = app.state;
  const evs = (st.events || []).filter((e) => e.id > app.lastEv);
  if (st.events && st.events.length) app.lastEv = Math.max(app.lastEv, ...st.events.map((e) => e.id));
  if (first) return;
  const frodoLoc = st.pawns.find((p) => p.id === 'frodo').loc;
  for (const e of evs.slice(-10)) {
    if (e.kind === 'slay') { burstAt(e.loc, `⚔ -${e.n}`, 'hit'); Sound.play('destroy'); }
    else if (e.kind === 'overflow') { burstAt(e.loc, '돌파!', 'bad'); const b = $('#board'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); Sound.play('blight'); }
    else if (e.kind === 'reveal') { burstAt(frodoLoc, '👁 발각!', 'bad'); Sound.play('fear'); }
    else if (e.kind === 'search') burstAt(frodoLoc, e.faces.map((f) => ({ skull: '💀', eye: '👁', blank: '·' }[f])).join(' '), 'hurt');
    else if (e.kind === 'objective') { burstCenter('🏆 목표 달성!', 'wave'); Sound.play('presence'); }
    else if (e.kind === 'capture') { burstAt(e.loc, '🚩 점령!', 'good'); }
    else if (e.kind === 'nazgul') burstAt(e.loc, '⚡ 나즈굴 퇴각!', 'good');
    else if (e.kind === 'surge') { burstCenter('🌑 어둠의 파도!', 'bad'); Sound.play('fearCard'); }
    else if (e.kind === 'destroy') burstCenter('💍 반지가 녹아내린다!', 'ring');
    else if (e.kind === 'hope' && e.n > 0) burstCenter(`✨ 희망 +${e.n}`, 'good');
  }
}

function renderResult() {
  const st = app.state;
  const box = $('#result');
  if (!st.result || app.hideResult) { box.classList.add('hidden'); return; }
  const isHost = app.room && app.room.hostId === app.you;
  box.querySelector('.modal-inner').innerHTML = `<div class="res-head ${st.result.win ? 'win' : 'lose'}">${st.result.win ? '💍 절대반지가 파괴되었다!' : '🌑 어둠이 가운데땅을 덮었다…'}</div>
    <p>${esc(st.result.reason)}</p>
    <div class="res-stats"><div>라운드 <b>${st.round}</b></div><div>목표 <b>${st.objectives.filter((o) => o.done).length}</b></div><div>남은 희망 <b>${st.hope}</b></div><div>물리친 오크 <b>${st.stats.orcsSlain || 0}</b></div><div>난이도 <b>${esc(st.difficulty)}</b></div></div>
    <div class="actions" style="justify-content:center"><button class="small" id="res-close">지도 보기</button>${isHost ? '<button class="primary" id="res-rematch">🔁 바로 다시 하기</button><button class="small" id="res-lobby">⚙ 대기실에서 설정 바꾸기</button>' : '<span class="hint">방장이 "바로 다시 하기"를 누르면 같은 구성으로 새 판이 시작돼요</span>'}<button class="small" id="res-leave">나가기</button></div>`;
  box.classList.remove('hidden');
  $('#res-close').onclick = () => { app.hideResult = true; box.classList.add('hidden'); };
  const lb = $('#res-lobby');
  if (lb) lb.onclick = () => { app.hideResult = false; send({ t: 'backToLobby' }); };
  const rm = $('#res-rematch');
  if (rm) rm.onclick = () => { rm.disabled = true; send({ t: 'rematch' }); };
  $('#res-leave').onclick = () => { app.hideResult = false; box.classList.add('hidden'); send({ t: 'leave' }); };
}

// ───────────── 툴팁 ─────────────
function showTip(e, html) { if (!html) return; const t = $('#tip'); if (t._html !== html) { t._html = html; t.innerHTML = html; } t.classList.remove('hidden'); moveTip(e); }
function moveTip(e) {
  const t = $('#tip');
  t.style.left = `${Math.min(e.clientX + 16, window.innerWidth - t.offsetWidth - 8)}px`;
  t.style.top = `${Math.min(e.clientY + 16, window.innerHeight - t.offsetHeight - 8)}px`;
}
function hideTip() { $('#tip').classList.add('hidden'); }

// ───────────── 설정 ─────────────
function applyFontScale(v) {
  document.documentElement.style.setProperty('--fs', String(v));
  try { localStorage.setItem('lotr-fs', String(v)); } catch { /* 무시 */ }
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
  try { fs = Number(localStorage.getItem('lotr-fs')) || 1; } catch { /* 무시 */ }
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
