'use strict';
/* 킵 더 히어로즈 아웃 — 클라이언트 */

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const app = {
  ws: null, token: null, catalog: null, room: null, you: null, state: null, prompt: null,
  lastLog: 0, lastEv: 0, tab: 'log', lastChat: 0, wasMyTurn: false, seenUnits: new Set(), seenCards: new Set(),
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
  ws.onopen = () => send({ t: 'hello', token: sessionStorage.getItem('keepout-token') || localStorage.getItem('keepout-token') });
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onclose = () => { toast('서버와 연결이 끊겼어요. 다시 연결하는 중…'); setTimeout(connect, 1500); };
}
function send(msg) { if (app.ws && app.ws.readyState === 1) app.ws.send(JSON.stringify(msg)); }

function onMessage(msg) {
  switch (msg.t) {
    case 'welcome':
      app.token = msg.token;
      app.catalog = msg.catalog;
      try { sessionStorage.setItem('keepout-token', msg.token); localStorage.setItem('keepout-token', msg.token); } catch { /* 무시 */ }
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
      if (msg.gameNo !== app.gameNo) { app.gameNo = msg.gameNo; app.hideResult = false; app.lastEv = 0; app.lastLog = 0; app.seenUnits = new Set(); app.seenCards = new Set(); }
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
const clanDef = (id) => app.catalog.clans.find((c) => c.id === id);
const roomDef = (id) => app.catalog.rooms.find((r) => r.id === id);
function colorOf(pid) { return app.catalog.colors[app.state.order.indexOf(pid)] || '#ccc'; }
function iconBall(k, size = '') { const d = app.catalog.icons[k]; return `<span class="ic ic-${k}" title="${esc(d.name)}: ${esc(d.help)}" ${size ? `style="width:${size}px;height:${size}px;font-size:${size * 0.55}px"` : ''}>${d.icon}</span>`; }

// ───────────── 첫 화면 / 대기실 ─────────────
function myName() { return $('#in-name').value.trim(); }
function initHome() {
  try { $('#in-name').value = localStorage.getItem('keepout-name') || ''; } catch { /* 무시 */ }
  const save = () => { try { localStorage.setItem('keepout-name', myName()); } catch { /* 무시 */ } };
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
    const text = `킵 더 히어로즈 아웃 같이 해요! 주소: ${location.origin}  방 코드: ${app.room.code}`;
    navigator.clipboard?.writeText(text).then(() => toast('초대 문구를 복사했어요.'), () => toast(text));
  };
  for (const f of document.querySelectorAll('[data-chat]')) f.onsubmit = (e) => { e.preventDefault(); const i = f.querySelector('input'); if (i.value.trim()) send({ t: 'chat', text: i.value }); i.value = ''; };
  for (const b of document.querySelectorAll('.tabs [data-tab]')) b.onclick = () => { app.tab = b.dataset.tab; renderTabs(); };
  if (!localStorage.getItem('keepout-guided')) setTimeout(() => Guide.open(), 400);
}

function saveTitle(sv) {
  const sm = sv.summary || {};
  const d = app.catalog.difficulties.find((x) => x.id === sm.difficulty);
  return `<b>${sm.round || 1}라운드</b> · ${sm.wave ? '2웨이브' : '1웨이브'}${d ? ` · ${esc(d.name)}` : ''} · ${(sm.clans || []).map((c) => (clanDef(c) || {}).icon || '').join('')}`;
}
function slotDesc(s) { const c = clanDef(s.clan); return c ? `${c.icon} ${esc(c.name)}` : ''; }
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
      <span class="rp-clan">${slotDesc(s)}</span></div>`;
  }).join('');
  $('#room-settings').innerHTML = `<div class="resume-box"><div class="resume-head">💾 저장된 게임 이어하기</div>
    <p>${saveTitle(rs)}부터 계속합니다 <span class="hint">(${fmtTime(rs.savedAt)} 저장)</span></p>
    <p class="hint">설정·순서·종족은 저장할 때 그대로예요. 아무도 앉지 않은 자리는 AI가 대신 진행합니다.</p>
    ${isHost ? '<button class="small" id="btn-new-instead">이어하지 않고 새 게임 준비하기</button>' : ''}</div>`;
  const nb = $('#btn-new-instead');
  if (nb) nb.onclick = () => { if (confirm('저장된 게임은 그대로 두고, 이 방에서 새 게임을 준비할까요?')) send({ t: 'cancelResume' }); };
  $('#clan-pick').innerHTML = `<div class="rs-title">🪑 내 자리 고르기</div><div class="slot-list">${rs.slots.filter((s) => !s.bot).map((s) => {
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
  $('#invite-hint').innerHTML = `친구에게 주소 <b>${esc(location.origin)}</b> 와 방 코드 <b>${r.code}</b>를 알려 주세요. (최대 ${r.maxPlayers}명, AI 몬스터로 빈자리를 채울 수 있어요)`;
  $('#room-players').innerHTML = r.players.map((p, i) => {
    const cl = p.clan && clanDef(p.clan);
    return `<div class="rp" style="--pc:${p.color}"><span class="rp-order">${i + 1}</span>
      <span class="rp-name">${esc(p.name)}${p.id === app.you ? ' <span class="hint">(나)</span>' : ''}${p.id === r.hostId ? ' 👑' : ''}${p.bot ? ' <span class="tag">AI</span>' : ''}${!p.connected ? ' <span class="hint">(연결 끊김)</span>' : ''}</span>
      <span class="rp-clan">${cl ? `${Art.monster(cl.id, cl.color, 28)} <b>${esc(cl.name)}</b>` : '<span class="hint">종족 미선택 (무작위)</span>'}</span>
      ${isHost ? `<span><button class="small" data-move="${p.id}" data-dir="up" ${i ? '' : 'disabled'}>▲</button><button class="small" data-move="${p.id}" data-dir="down" ${i < r.players.length - 1 ? '' : 'disabled'}>▼</button>${p.bot ? `<button class="small" data-rmbot="${p.id}">✕</button>` : ''}</span>` : ''}
    </div>`;
  }).join('');
  for (const b of document.querySelectorAll('[data-move]')) b.onclick = () => send({ t: 'move', id: b.dataset.move, dir: b.dataset.dir });
  for (const b of document.querySelectorAll('[data-rmbot]')) b.onclick = () => send({ t: 'removeBot', id: b.dataset.rmbot });
  const st = r.settings;
  const dis = isHost ? '' : 'disabled';
  $('#room-settings').innerHTML = `<div class="rs-title">⚔ 난이도 ${isHost ? '' : '<span class="hint">(방장만 바꿀 수 있어요)</span>'}</div>
    <div class="diffs">${c.difficulties.map((d) => `<button class="small diff-opt ${st.difficulty === d.id ? 'on' : ''}" data-diff="${d.id}" ${dis}>${esc(d.name)}</button>`).join('')}</div>
    <div class="hint">${esc((c.difficulties.find((d) => d.id === st.difficulty) || {}).desc || '')} 대보물 금고의 상자 3개를 모두 빼앗기면 패배!</div>
    <div class="rs-title" style="margin-top:10px">📦 확장</div>
    <div class="exps">${c.expansions.map((e) => `<label class="exp-opt ${st[e.id] ? 'on' : ''}"><input type="checkbox" data-exp="${e.id}" ${st[e.id] ? 'checked' : ''} ${dis}> <span><b>${esc(e.name)}</b><br><span class="hint">${esc(e.desc)}</span></span></label>`).join('')}</div>`;
  if (isHost) for (const b of document.querySelectorAll('[data-diff]')) b.onclick = () => send({ t: 'setSettings', settings: { difficulty: b.dataset.diff } });
  if (isHost) for (const cb of document.querySelectorAll('[data-exp]')) cb.onchange = () => send({ t: 'setSettings', settings: { [cb.dataset.exp]: cb.checked } });
  const meP = r.players.find((p) => p.id === app.you);
  const owner = (id) => r.players.find((p) => p.clan === id);
  $('#clan-pick').innerHTML = `<div class="rs-title">👾 몬스터 종족 고르기 <span class="hint">카드를 눌러 내 종족을 고르세요. 다시 누르면 취소.${isHost && r.players.some((p) => p.bot) ? ' 방장은 AI의 종족도 정할 수 있어요.' : ''}</span></div>
    <div class="clans">${c.clans.filter((cl) => !cl.pack || st[cl.pack]).map((cl) => {
      const o = owner(cl.id);
      return `<div class="clan-opt ${o && o.id !== app.you ? 'taken' : ''} ${meP && meP.clan === cl.id ? 'mine' : ''}" data-clan="${cl.id}" style="--cc:${cl.color}">
        <div class="co-top">${Art.monster(cl.id, cl.color, 46)}<div><div class="co-name">${esc(cl.name)}${cl.pack ? ' <span class="tag">확장</span>' : ''}</div><span class="hint">${esc(cl.level)} · ${cl.count}마리</span></div></div>
        <div class="co-stats"><span>❤ 체력 ${cl.hp}</span><span>⚔ 공격 ${cl.atk}</span></div>
        <div class="co-ab"><b>✨ ${esc(cl.ability)}</b></div>
        <div class="hint" style="font-size:.84em">${esc(cl.desc)}</div>
        ${o ? `<div class="co-owner">✔ ${esc(o.name)}</div>` : ''}
        ${isHost ? r.players.filter((p) => p.bot).map((b) => `<button class="small co-bot" data-bot="${b.id}" data-c="${cl.id}">${esc(b.name.replace('AI 몬스터 ', ''))}에게</button>`).join('') : ''}
      </div>`;
    }).join('')}</div>`;
  for (const el of document.querySelectorAll('.clan-opt')) el.onclick = (e) => { if (e.target.closest('.co-bot')) return; const id = el.dataset.clan; send({ t: 'pickClan', clan: meP && meP.clan === id ? null : id }); };
  for (const b of document.querySelectorAll('.co-bot')) b.onclick = () => send({ t: 'pickClan', clan: b.dataset.c, target: b.dataset.bot });
  $('#btn-start').disabled = !isHost;
  $('#btn-add-bot').disabled = !isHost || r.players.length >= r.maxPlayers;
  $('#btn-start').textContent = isHost ? '던전 열기! ▶' : '방장이 시작하기를 기다리는 중…';
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
function promptTargets() {
  const p = app.prompt;
  const out = { room: {}, unit: {}, hero: {}, card: {} };
  if (!p) return out;
  for (const o of p.options) {
    if (o.disabled) continue;
    if (o.card) out.card[o.card] = o.value;
    else if (o.unit) out.unit[o.unit] = o.value;
    else if (o.hero && !String(o.value).startsWith('scare:')) out.hero[o.hero] = o.value;
    else if (o.room && !o.hero) out.room[o.room] = o.value;
  }
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
  Sound.setMood(app.state.phase === 'heroes' || app.state.heroes.length > 3 ? 'tense' : 'calm');
}

function renderTop() {
  const st = app.state;
  const cur = st.players.find((p) => p.id === st.current);
  const vault = st.rooms.vault ? st.rooms.vault.chests : 3;
  const html = `
    <div class="tb-logo"><img src="/icon.svg" width="32" height="32" alt=""><span>킵 더 히어로즈 아웃</span></div>
    <div class="tb-box">라운드 <b>${st.round}</b></div>
    <div class="tb-box" title="이번 웨이브에 남은 용사 수. 차례마다 ${st.perTurn}명씩 들어와요.">⚔ ${esc(st.finalAssault ? '마지막 공세!' : st.waveName)} · 남은 용사 <b>${st.heroDeck}</b></div>
    <div class="tb-box tb-vault" title="대보물 금고의 상자. 모두 빼앗기면 패배!">금고 <span class="chest-row">${[0, 1, 2].map((i) => `<span class="${i < vault ? '' : 'lost'}">${Art.chest(20)}</span>`).join('')}</span></div>
    <div class="tb-box">빼앗긴 보물 <b>${st.stolen}</b> · 쓰러뜨린 용사 <b>${st.defeated}</b></div>
    <div class="tb-turn">${st.result ? '🏁 게임 종료' : st.phase === 'heroes' ? '⚔ 용사들이 움직이는 중…' : cur ? (cur.id === app.you ? '<b class="mine">내 차례!</b>' : `<b>${esc(cur.name)}</b>의 차례`) : ''}</div>
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
    setHTML(el, `<span class="p-wait">${st.phase === 'heroes' ? '⚔ 용사들이 던전을 휘젓는 중…' : cur ? `⏳ ${esc(cur.name)}(${esc((clanDef(cur.clan) || {}).name || '')})의 차례를 기다리는 중…` : ''}</span>`);
    return;
  }
  const t = promptTargets();
  const boardHint = Object.keys(t.room).length || Object.keys(t.unit).length || Object.keys(t.hero).length ? ' <span class="hint">(던전에서 반짝이는 곳을 눌러도 돼요)</span>' : '';
  const cardHint = Object.keys(t.card).length ? ' <span class="hint">(아래 손패의 카드를 눌러요)</span>' : '';
  const opts = p.options.filter((o) => !(p.kind === 'turn' && o.group === 'card')); // 카드는 손패에서
  const html = `<span class="p-title">${esc(p.title)}</span>${boardHint}${cardHint}
    ${opts.map((o, i) => `<button class="small ${o.value === 'end' ? 'opt-end' : ''}" data-i="${p.options.indexOf(o)}" ${o.disabled ? 'disabled' : ''} title="${esc(o.reason || '')}">${o.icon ? `<span class="ico">${app.catalog.icons[o.icon].icon}</span> ${esc(app.catalog.icons[o.icon].name)}` : esc(o.label)}</button>`).join('')}`;
  if (setHTML(el, html)) for (const b of el.querySelectorAll('button[data-i]')) b.onclick = () => answer(p.options[Number(b.dataset.i)].value);
}

function hpDots(cur, max) { return `<span class="hpbar">${Array.from({ length: Math.min(max, 8) }, (_, i) => `<i class="${i < cur ? '' : 'off'}"></i>`).join('')}</span>`; }

function renderBoard() {
  const st = app.state;
  const c = app.catalog;
  const t = promptTargets();
  const html = c.rooms.map((rd) => {
    const r = st.rooms[rd.id] || {};
    const act = c.roomActions[rd.type];
    const mons = st.monsters.filter((m) => m.room === rd.id);
    const heroes = st.heroes.filter((h) => h.room === rd.id);
    const toks = [];
    if (r.chests) toks.push(`<span class="tok" title="보물 상자: 용사가 훔쳐 가요">${Art.chest(20)}×${r.chests}</span>`);
    if (r.items) toks.push(`<span class="tok" title="아이템: 몬스터가 들고 제단으로 옮기면 전리품 카드로 바꿀 수 있어요">${rd.type === 'lab' ? Art.potion(18) : Art.item(18)}×${r.items}</span>`);
    if (r.bones) toks.push(`<span class="tok" title="뼈: 몬스터가 이동할 때 들고 가서 납골당에서 몬스터를 되살리는 데 써요">${Art.bone(18)}×${r.bones}</span>`);
    if (r.traps) toks.push(`<span class="tok" title="함정: 용사가 들어오면 피해 1">${Art.trap(20)}×${r.traps}</span>`);
    if (r.fire) toks.push(`<span class="tok fire" title="불: 용사 단계 전에 용사에게 피해 1 (없으면 아이템·몬스터를 태워요)">🔥×${r.fire}</span>`);
    return `<div class="room t-${rd.type} ${r.fire ? 'burning' : ''} ${t.room[rd.id] != null ? 'can' : ''}" data-room="${rd.id}" style="grid-column:${rd.x + 1};grid-row:${rd.y + 1}">
      ${Art.roomDeco(rd.type)}
      ${rd.type === 'entrance' ? '<span class="gate-arrow">⬇</span>' : ''}
      <div class="r-name"><span>${esc(rd.name)}</span><span class="r-act">✋ ${esc(act.name)}</span></div>
      <div class="r-tokens">${toks.join('')}</div>
      <div class="r-heroes">${heroes.map((h) => { const d = c.heroes[h.type]; return `<span class="unit hero ${t.hero[h.hid] != null ? 'can' : ''} ${app.seenUnits.has(h.hid) ? '' : 'new'}" data-hero="${h.hid}">${Art.hero(h.type, d.color, 34, h.exhausted)}${h.exhausted ? '<span class="zz">Zz</span>' : ''}${hpDots(h.hp, h.maxHp)}</span>`; }).join('')}</div>
      <div class="r-units">${mons.map((m) => { const cl = clanDef(m.clan); return `<span class="unit mon ${t.unit[m.uid] != null ? 'can' : ''} ${app.seenUnits.has(m.uid) ? '' : 'new'}" data-unit="${m.uid}" style="--pc:${colorOf(m.owner)}">${Art.monster(m.clan, cl.color, 34)}<span class="own"></span>${m.maxHp > 1 ? hpDots(m.hp, m.maxHp) : ''}</span>`; }).join('')}</div>
    </div>`;
  }).join('');
  const board = $('#board');
  if (setHTML(board, html)) {
    for (const el of board.querySelectorAll('.room')) {
      el.onclick = (e) => {
        const tt = promptTargets();
        const u = e.target.closest('[data-unit]');
        const h = e.target.closest('[data-hero]');
        if (u && tt.unit[u.dataset.unit] != null) return answer(tt.unit[u.dataset.unit]);
        if (h && tt.hero[h.dataset.hero] != null) return answer(tt.hero[h.dataset.hero]);
        if (tt.room[el.dataset.room] != null) return answer(tt.room[el.dataset.room]);
      };
      el.onmouseenter = (e) => showTip(e, roomTip(el.dataset.room));
      el.onmousemove = moveTip;
      el.onmouseleave = hideTip;
    }
    for (const el of board.querySelectorAll('[data-unit]')) { el.onmouseenter = (e) => { e.stopPropagation(); showTip(e, monsterTip(el.dataset.unit)); }; el.onmouseleave = () => hideTip(); el.onmousemove = moveTip; }
    for (const el of board.querySelectorAll('[data-hero]')) { el.onmouseenter = (e) => { e.stopPropagation(); showTip(e, heroTip(el.dataset.hero)); }; el.onmouseleave = () => hideTip(); el.onmousemove = moveTip; }
  }
  for (const m of st.monsters) app.seenUnits.add(m.uid);
  for (const h of st.heroes) app.seenUnits.add(h.hid);
}
function roomTip(id) {
  const rd = roomDef(id);
  const r = app.state.rooms[id] || {};
  const act = app.catalog.roomActions[rd.type];
  return `<b>${esc(rd.name)}</b><br>✋ <b>${esc(act.name)}</b>: ${esc(act.text)}<div class="tip-meta">보물 ${r.chests || 0} · 아이템 ${r.items || 0} · 뼈 ${r.bones || 0} · 함정 ${r.traps || 0}${rd.type === 'entrance' ? '<br>🚪 용사들이 여기로 들어와요.' : ''}${rd.type === 'vault' ? '<br>💰 이 방의 상자 3개를 모두 빼앗기면 패배!' : ''}</div>`;
}
function monsterTip(uid) {
  const m = app.state.monsters.find((x) => x.uid === uid);
  if (!m) return '';
  const cl = clanDef(m.clan);
  const owner = app.state.players.find((p) => p.id === m.owner);
  return `<b>${cl.icon} ${esc(cl.name)}</b> <span class="hint">(${esc(owner ? owner.name : '')})</span><br>체력 ${m.hp}/${m.maxHp} · 공격 ${cl.atk}<div class="tip-meta">${esc(cl.ability)}</div>`;
}
function heroTip(hid) {
  const h = app.state.heroes.find((x) => x.hid === hid);
  if (!h) return '';
  const d = app.catalog.heroes[h.type];
  return `<b>${d.icon} ${esc(d.name)}</b> ${d.elite ? '<span class="tag">정예</span>' : ''}<br>체력 ${h.hp}/${h.maxHp} · 공격 ${h.atk} · 이동 ${d.move}${h.exhausted ? '<br>💤 소진됨: 같은 방에 새 용사가 들어오기 전까지 행동하지 않아요.' : ''}
    <div class="tip-meta">${esc(d.text)}<br>용사는 차례가 오면: 같은 방에 몬스터가 있으면 공격 → 없으면 보물을 훔침 → 없으면 보물 쪽으로 이동. 행동하면 소진돼요.</div>`;
}

function renderSide() {
  const st = app.state;
  const html = st.players.map((p) => {
    const cl = clanDef(p.clan);
    return `<div class="pl ${st.current === p.id ? 'cur' : ''}" style="--pc:${colorOf(p.id)}"><div class="pl-head">${Art.monster(cl.id, cl.color, 26)} ${esc(p.name)}${p.bot ? ' <span class="tag">AI</span>' : ''}${p.id === app.you ? ' <span class="hint">(나)</span>' : ''}</div>
      <div class="pl-stats"><span>${esc(cl.name)}</span><span title="던전 밖에서 쉬고 있는 몬스터 (소환 가능)">🥚 ${p.supply}</span><span>🃏 손 ${p.handCount} · 덱 ${p.deckCount} · 버림 ${p.discardCount}</span>${p.clan === 'gnolls' ? `<span>💰 ${p.gold}</span>` : ''}<span>💥 ${p.kills}</span></div>
      ${p.played.length ? `<div class="played-row">이번 차례: ${p.played.map((c) => esc(c.name)).join(', ')}</div>` : ''}</div>`;
  }).join('');
  setHTML($('#players'), html);
  setHTML($('#market'), `<div class="mk-title">🎁 전리품 시장 <span class="hint" style="font-family:var(--sans)">(제단에 아이템을 바쳐 하나 골라요)</span></div>${st.market.map((id) => { const l = app.catalog.loot[id]; return `<div class="mk-card"><b>${esc(l.name)}</b> ${l.icons.map((k) => app.catalog.icons[k].icon).join('')}${l.text ? ` <span class="hint">${esc(l.text)}</span>` : ''}</div>`; }).join('') || '<div class="hint">남은 전리품이 없어요</div>'}`);
}

function renderHand() {
  const st = app.state;
  const m = me();
  const cl = m && clanDef(m.clan);
  $('#my-title').innerHTML = m ? `${Art.monster(cl.id, cl.color, 24)} 내 손패 — ${esc(cl.name)} <span class="hint" style="font-family:var(--sans)">· ${esc(cl.ability)}</span>` : '관전 중';
  const t = promptTargets();
  const html = m && m.hand ? m.hand.map((c) => `<div class="card ${c.loot ? 'loot' : ''} ${t.card[c.uid] != null ? 'can' : ''} ${app.seenCards.has(c.uid) ? '' : 'new'}" data-card="${c.uid}" style="--cc:${cl.color}">
      <div class="c-name">${esc(c.name)}</div><div class="c-icons">${c.icons.map((k) => iconBall(k)).join('')}</div>${c.text ? `<div class="c-text">${esc(c.text)}</div>` : ''}</div>`).join('') : '';
  const el = $('#hand');
  if (setHTML(el, html)) {
    for (const d of el.querySelectorAll('[data-card]')) {
      d.onclick = () => { const tt = promptTargets(); if (tt.card[d.dataset.card] != null) { answer(tt.card[d.dataset.card]); Sound.play('cardPlay'); } };
      d.onmouseenter = (e) => { const c = m.hand.find((x) => x.uid === d.dataset.card); showTip(e, `<b>${esc(c.name)}</b>${c.loot ? ' <span class="tag">전리품</span>' : ''}<br>${c.icons.map((k) => `${app.catalog.icons[k].icon} <b>${esc(app.catalog.icons[k].name)}</b>: ${esc(app.catalog.icons[k].help)}`).join('<br>')}${c.text ? `<br>✨ ${esc(c.text)}` : ''}<div class="tip-meta">카드를 내면 아이콘을 원하는 순서로, 내 몬스터들에게 나눠서 쓸 수 있어요.</div>`); };
      d.onmousemove = moveTip;
      d.onmouseleave = hideTip;
    }
  }
  if (m && m.hand) for (const c of m.hand) app.seenCards.add(c.uid);
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

const LOG_SOUND = { hero: 'explore', steal: 'blight', hdead: 'destroy', mdead: 'ravage', wave: 'fearCard', loot: 'presence', turn: 'phase' };
function onNewLogs(first) {
  const st = app.state;
  const fresh = st.log.filter((l) => l.seq > app.lastLog);
  app.lastLog = st.log.length ? st.log[st.log.length - 1].seq : 0;
  if (first) return;
  const played = new Set();
  for (const l of fresh.slice(-5)) {
    if (l.kind === 'win') { Sound.play('victory'); continue; }
    if (l.kind === 'lose') { Sound.play('defeat'); continue; }
    const s = LOG_SOUND[l.kind];
    if (s && !played.has(s)) { Sound.play(s); played.add(s); }
  }
}

function burst(el, text, cls) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) return;
  const f = document.createElement('div');
  f.className = `burst ${cls}`;
  f.textContent = text;
  f.style.left = `${r.left + r.width / 2 + (Math.random() * 40 - 20)}px`;
  f.style.top = `${r.top + r.height / 2}px`;
  $('#fx-layer').appendChild(f);
  setTimeout(() => f.remove(), 1400);
}
function playEvents(first) {
  const st = app.state;
  const evs = (st.events || []).filter((e) => e.id > app.lastEv);
  if (st.events && st.events.length) app.lastEv = Math.max(app.lastEv, ...st.events.map((e) => e.id));
  if (first) return;
  const room = (id) => document.querySelector(`.room[data-room="${id}"]`);
  const shake = (id) => { const el = room(id); if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); } };
  for (const e of evs.slice(-10)) {
    if (e.kind === 'hhit') burst(room(e.room), `퍽! -${e.n}`, 'hit');
    else if (e.kind === 'hdead') burst(room(e.room), '용사 퇴치!', 'good');
    else if (e.kind === 'mhit') { burst(room(e.room), `-${e.n}`, 'hurt'); shake(e.room); }
    else if (e.kind === 'steal') { burst(room(e.room), '보물을 빼앗겼다!', 'steal'); shake(e.room); }
    else if (e.kind === 'spawn') burst(room(e.room), '용사 침입!', 'hurt');
    else if (e.kind === 'trapfire') burst(room(e.room), '철컥! 함정!', 'hit');
    else if (e.kind === 'loot') burst(room(e.room), '전리품!', 'good');
    else if (e.kind === 'craft') burst(room(e.room), '제작!', 'good');
    else if (e.kind === 'bomb') { burst(room(e.room), '쾅!', 'hit'); shake(e.room); }
    else if (e.kind === 'wave') burst($('#board'), '다음 웨이브!', 'wave');
    else if (e.kind === 'fire') burst(room(e.room), '화르륵!', 'hit');
  }
}

function renderResult() {
  const st = app.state;
  const box = $('#result');
  if (!st.result || app.hideResult) { box.classList.add('hidden'); return; }
  const isHost = app.room && app.room.hostId === app.you;
  box.querySelector('.modal-inner').innerHTML = `<div class="res-head ${st.result.win ? 'win' : 'lose'}">${st.result.win ? '🎉 던전을 지켜냈다!' : '💀 보물을 빼앗겼다…'}</div>
    <p>${esc(st.result.reason)}</p>
    <div class="res-stats"><div>라운드 <b>${st.round}</b></div><div>쓰러뜨린 용사 <b>${st.defeated}</b></div><div>빼앗긴 보물 <b>${st.stolen}</b></div><div>난이도 <b>${esc(st.difficulty)}</b></div></div>
    <div class="actions" style="justify-content:center"><button class="small" id="res-close">던전 보기</button>${isHost ? '<button class="primary" id="res-rematch">🔁 바로 다시 하기</button><button class="small" id="res-lobby">⚙ 대기실에서 설정 바꾸기</button>' : '<span class="hint">방장이 "바로 다시 하기"를 누르면 같은 구성으로 새 판이 시작돼요</span>'}<button class="small" id="res-leave">나가기</button></div>`;
  box.classList.remove('hidden');
  $('#res-close').onclick = () => { app.hideResult = true; box.classList.add('hidden'); };
  const lb = $('#res-lobby');
  if (lb) lb.onclick = () => { app.hideResult = false; send({ t: 'backToLobby' }); };
  const rm = $('#res-rematch');
  if (rm) rm.onclick = () => { rm.disabled = true; send({ t: 'rematch' }); };
  $('#res-leave').onclick = () => { app.hideResult = false; box.classList.add('hidden'); send({ t: 'leave' }); };
}

// ───────────── 툴팁 ─────────────
function showTip(e, html) { if (!html) return; const t = $('#tip'); t.innerHTML = html; t.classList.remove('hidden'); moveTip(e); }
function moveTip(e) {
  const t = $('#tip');
  t.style.left = `${Math.min(e.clientX + 16, window.innerWidth - t.offsetWidth - 8)}px`;
  t.style.top = `${Math.min(e.clientY + 16, window.innerHeight - t.offsetHeight - 8)}px`;
}
function hideTip() { $('#tip').classList.add('hidden'); }

// ───────────── 설정 ─────────────
function applyFontScale(v) {
  document.documentElement.style.setProperty('--fs', String(v));
  try { localStorage.setItem('keepout-fs', String(v)); } catch { /* 무시 */ }
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
  try { fs = Number(localStorage.getItem('keepout-fs')) || 1; } catch { /* 무시 */ }
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
