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
  view3d: readPref('si-3d', '1') === '1',
  showHints: readPref('si-hints', '1') === '1',
};

function readPref(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
function writePref(k, v) { try { localStorage.setItem(k, v); } catch { /* 무시 */ } }

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
      app.saves = msg.saves || [];
      renderSaves();
      break;
    case 'saves':
      app.saves = msg.list || [];
      renderSaves();
      break;
    case 'room':
      if (app.room && msg.room.chat.length > app.room.chat.length && msg.room.chat[msg.room.chat.length - 1].from !== myName()) Sound.play('chat');
      app.room = msg.room;
      if (!msg.room.started) Sound.setMood('calm');
      app.personId = msg.you;
      if (!msg.room.started) { app.state = null; app.prompt = null; app.resultDismissed = false; }
      render();
      SpiritBoard.refresh();
      break;
    case 'state': {
      const prevPrompt = app.prompt;
      if (msg.gameNo !== app.gameNo) {
        // 새 판 (바로 다시 하기 포함): 결과 창·기록 표시 상태 초기화
        app.gameNo = msg.gameNo;
        app.resultDismissed = false;
        app.resultSounded = false;
        app.logSeq = null;
        if (msg.state.tutorial && app.gameNo > 1 && window.Tutorial) Tutorial.reset();
      }
      app.state = msg.state;
      app.prompts = msg.prompts || {};
      app.mySeats = msg.seats || [];
      // 조종 중인 정령(좌석) 선택: 현재 좌석에 할 일이 없고 다른 좌석에 있으면 자동 전환
      if (!app.mySeats.includes(app.you)) app.you = app.mySeats[0];
      if (!app.prompts[app.you] && app.mySeats.some((id) => app.prompts[id])) {
        // 다음 선택이 곧 올 수 있으므로 잠깐 기다렸다가 할 일이 있는 정령으로 전환
        clearTimeout(app.seatTimer);
        app.seatTimer = setTimeout(() => {
          if (app.prompts[app.you]) return;
          const busy = app.mySeats.find((id) => app.prompts[id]);
          if (busy) { app.you = busy; app.prompt = app.prompts[busy]; app.tab = busy; render(); }
        }, 700);
      }
      app.prompt = app.prompts[app.you] || null;
      gameSounds(prevPrompt);
      render();
      if (!app.guideShown) {
        app.guideShown = true;
        let seen = false;
        try { seen = localStorage.getItem('si-guided') === '1'; } catch { /* 무시 */ }
        if (!seen) Guide.open(0);
      }
      break;
    }
    case 'left':
      app.room = null; app.state = null; app.prompt = null;
      render();
      send({ t: 'listSaves' });
      break;
    case 'error':
      Sound.play('error');
      toast(msg.msg);
      break;
    default:
  }
}

function myName() {
  const me = app.room && app.room.players.find((p) => p.id === app.personId);
  return me ? me.name : null;
}

// ───────────── 사운드 연결 ─────────────
const LOG_SOUNDS = [
  [/공포 카드 획득/, 'fearCard'],
  [/약탈!/, 'ravage'],
  [/황폐 추가/, 'blight'],
  [/: (마을|도시) 파괴|각 침략자에게 피해 \d+ \(파괴 [1-9]/, 'destroy'],
  [/(마을|도시) 건설/, 'build'],
  [/탐험가 도착/, 'explore'],
  [/존재 추가/, 'presence'],
  [/^공포 \+/, 'fear'],
  [/카드 \d+장 사용 — (?!없음)/, 'cardPlay'],
  [/^(══|── )/, 'phase'],
];

function gameSounds(prevPrompt) {
  const st = app.state;
  if (!st) return;
  const lastSeq = st.log.length ? st.log[st.log.length - 1].seq : 0;
  if (app.logSeq == null || lastSeq < app.logSeq) { app.logSeq = lastSeq; } else {
    const fresh = st.log.filter((l) => l.seq > app.logSeq);
    app.logSeq = lastSeq;
    const kinds = [];
    for (const l of fresh) for (const [re, k] of LOG_SOUNDS) if (re.test(l.msg) && !kinds.includes(k)) kinds.push(k);
    kinds.slice(0, 4).forEach((k, i) => setTimeout(() => Sound.play(k), i * 170));
  }
  Sound.setMood(st.phase === 'invader' ? 'tense' : 'calm');
  if (st.result && !app.resultSounded) { app.resultSounded = true; Sound.play(st.result.win ? 'victory' : 'defeat'); }
  if (!st.result) app.resultSounded = false;
  if (app.prompt && !prevPrompt) Sound.play('turn');
}

function answer(value) {
  if (!app.prompt) return;
  send({ t: 'answer', promptId: app.prompt.id, value, seat: app.you });
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
  $('#btn-video').onclick = () => RuleVideo.open();
  $('#btn-tutorial').onclick = () => { saveName(); Tutorial.reset(); send({ t: 'tutorial', name: $('#in-name').value || '연습생' }); };
  $('#btn-join').onclick = () => {
    saveName();
    const code = $('#in-code').value.trim();
    if (code.length !== 4) { toast('4자리 방 코드를 입력하세요.'); return; }
    send({ t: 'join', code, name: $('#in-name').value });
  };
  $('#in-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-join').click(); });
}

// ───────────── 대기실 ─────────────
const EXP_SHORT = { base: '기본', bc: '가지와 발톱', ff: '깃털과 불꽃', je: '들쭉날쭉한 대지', hz: '지평선', ni: '자연의 화신' };

// ───────────── 저장된 게임 ─────────────
function saveTitle(sv) {
  const c = app.catalog;
  const sm = sv.summary || {};
  const sp = (sm.spirits || []).map((id) => { const x = c && c.spirits.find((s) => s.id === id); return x ? x.name : id; });
  const preset = c && c.presets.find((p) => p.id === sm.preset);
  return { turn: sm.turn || 0, spirits: sp.join(', '), diff: preset ? preset.name : '' };
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
  box.innerHTML = `<div class="saves-title">💾 저장된 게임 이어하기</div>${list.map((sv) => {
    const t = saveTitle(sv);
    return `<div class="save-row"><div class="save-info"><b>${t.turn}턴</b> · ${esc(t.spirits)}<br><span class="hint">${esc(sv.names.join(', '))}${t.diff ? ` · ${esc(t.diff)}` : ''} · ${fmtTime(sv.savedAt)} 저장</span></div>
      <button class="primary small" data-resume="${esc(sv.id)}">▶ 이어하기</button><button class="small" data-delsave="${esc(sv.id)}" title="저장 삭제">🗑</button></div>`;
  }).join('')}<p class="hint">게임 중에 그만두거나 창을 닫아도 자동으로 저장돼요. 이어하기를 누르면 방이 만들어지고, 친구는 방 코드로 들어와 자기 자리에 앉으면 돼요.</p>`;
  for (const b of box.querySelectorAll('[data-resume]')) b.onclick = () => { localStorage.setItem('si-name', $('#in-name').value.trim()); send({ t: 'resume', id: b.dataset.resume, name: $('#in-name').value }); };
  for (const b of box.querySelectorAll('[data-delsave]')) b.onclick = () => { if (confirm('이 저장된 게임을 삭제할까요? 되돌릴 수 없어요.')) send({ t: 'deleteSave', id: b.dataset.delsave }); };
}

/** 이어하기 대기실: 저장된 자리 고르기 */
function renderResumeRoom(r, isHost) {
  const c = app.catalog;
  const rs = r.resume;
  const t = saveTitle(rs);
  const spiritName = (id) => { const sp = c.spirits.find((x) => x.id === id); return sp ? `<span style="color:${sp.color}">${esc(sp.name)}</span>` : id; };
  $('#room-players').innerHTML = r.players.map((p) => `<li class="${p.connected ? '' : 'off'}"><span>${p.id === r.hostId ? '👑 ' : ''}${esc(p.name)}${p.id === app.personId ? ' (나)' : ''}${p.connected ? '' : ' · 연결 끊김'}</span>
    <span style="text-align:right">${p.spiritIds.map(spiritName).join('<br>')}</span></li>`).join('');
  const empty = rs.slots.filter((s) => !s.taken).length;
  $('#btn-start').disabled = !isHost || r.loading;
  $('#btn-start').classList.toggle('hidden', !isHost);
  $('#btn-start').textContent = r.loading ? '불러오는 중…' : '▶ 이어서 시작';
  $('#start-hint').textContent = isHost
    ? (empty ? `빈자리 ${empty}개는 방장이 대신 조종합니다. 친구가 들어오면 자기 자리를 고를 수 있어요.` : '모든 자리가 찼어요. 이어서 시작하세요!')
    : '방장이 게임을 이어서 시작하기를 기다리는 중...';
  $('#room-settings').innerHTML = `<div class="resume-box"><div class="resume-head">💾 저장된 게임 이어하기</div>
    <p><b>${t.turn}턴</b>부터 계속합니다${t.diff ? ` · 난이도 ${esc(t.diff)}` : ''} <span class="hint">(${fmtTime(rs.savedAt)} 저장)</span></p>
    <p class="hint">설정과 정령은 저장할 때 그대로예요.</p>
    ${isHost ? '<button class="small" id="btn-new-instead">이어하지 않고 새 게임 준비하기</button>' : ''}</div>`;
  const nb = $('#btn-new-instead');
  if (nb) nb.onclick = () => { if (confirm('저장된 게임은 그대로 두고, 이 방에서 새 게임을 준비할까요?')) send({ t: 'cancelResume' }); };
  document.querySelector('.room-right h2').innerHTML = '내 자리 고르기 <span class="hint" style="font-family:var(--sans);font-weight:400">— 저장할 때 누가 어느 정령이었는지 보고 내 자리를 고르세요.</span>';
  $('#spirit-filter').innerHTML = '';
  $('#spirit-list').innerHTML = `<div class="slot-list">${rs.slots.map((s) => {
    const mine = s.id === app.personId;
    return `<div class="slot-card ${mine ? 'mine' : ''} ${s.taken && !mine ? 'taken' : ''}"><div class="slot-name">${esc(s.name)}의 자리</div><div>${s.spiritIds.map(spiritName).join(' · ')}</div>
      ${mine ? '<span class="slot-tag">✔ 내 자리</span>' : s.taken ? '<span class="hint">다른 사람이 앉음</span>' : `<button class="small primary" data-slot="${esc(s.id)}">이 자리에 앉기</button>`}</div>`;
  }).join('')}</div>`;
  for (const b of document.querySelectorAll('[data-slot]')) b.onclick = () => send({ t: 'claimSlot', slot: b.dataset.slot });
}

function renderRoom() {
  const r = app.room;
  const c = app.catalog;
  if (!c) return;
  $('#room-code').textContent = r.code;
  const roomH2 = document.querySelector('.room-right h2');
  if (!r.resume && roomH2.dataset.orig) roomH2.innerHTML = roomH2.dataset.orig;
  if (!roomH2.dataset.orig) roomH2.dataset.orig = roomH2.innerHTML;
  if (!r.resume) $('#btn-start').textContent = '게임 시작';
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);
  $('#lan-hint').innerHTML = local && app.lan && app.lan.length
    ? `같은 와이파이 친구 접속 주소: <b>${app.lan.map(esc).join(' / ')}</b><br>멀리 있는 친구는 README의 "npm run share" 방법을 이용하세요.`
    : `친구에게 이 주소를 알려주세요: <b>${esc(location.origin)}</b>`;
  const isHost = r.hostId === app.personId;
  if (r.resume) { renderResumeRoom(r, isHost); renderChat($('#room-chat')); return; }
  const spiritById = (id) => c.spirits.find((x) => x.id === id);
  $('#room-players').innerHTML = r.players.map((p) => {
    const names = p.spiritIds.map((id) => { const sp = spiritById(id); return `<span style="color:${sp.color}">${esc(sp.name)}</span>`; }).join('<br>');
    return `<li class="${p.connected ? '' : 'off'}"><span>${p.id === r.hostId ? '👑 ' : ''}${esc(p.name)}${p.id === app.personId ? ' (나)' : ''}${p.connected ? '' : ' · 연결 끊김'}</span>
      <span style="text-align:right">${names || '<span class="hint">정령 미선택</span>'}</span></li>`;
  }).join('');
  const total = r.players.reduce((a, p) => a + p.spiritIds.length, 0);
  const allPicked = r.players.every((p) => p.spiritIds.length);
  $('#btn-start').disabled = !isHost || !allPicked;
  $('#btn-start').classList.toggle('hidden', !isHost);
  $('#start-hint').textContent = isHost
    ? (allPicked ? `정령 ${total}개로 게임을 시작할 수 있습니다.` : '모든 플레이어가 정령을 하나 이상 고르면 시작할 수 있습니다.')
    : '방장이 게임을 시작하기를 기다리는 중...';
  renderSettings(isHost, total);

  // 정령 목록
  const order = { 낮음: 0, 보통: 1, 높음: 2 };
  const enabled = r.settings.expansions;
  const pool = c.spirits.filter((sp) => enabled.includes(sp.exp));
  app.spiritFilter ||= 'all';
  app.expFilter ||= 'all';
  if (app.expFilter !== 'all' && !enabled.includes(app.expFilter)) app.expFilter = 'all';
  const cx = [['all', '전체'], ['낮음', '쉬움'], ['보통', '보통'], ['높음', '어려움']];
  const ex = [['all', '모든 확장'], ...c.expansions.filter((e) => enabled.includes(e.id)).map((e) => [e.id, EXP_SHORT[e.id]])];
  $('#spirit-filter').innerHTML = `${cx.map(([k, n]) => `<button class="small ${app.spiritFilter === k ? 'on' : ''}" data-f="${k}">${n}</button>`).join('')}
    <span class="sep"></span>${ex.map(([k, n]) => `<button class="small ${app.expFilter === k ? 'on' : ''}" data-e="${k}">${n}</button>`).join('')}
    <span class="sep"></span><button class="small" id="btn-rand">🎲 무작위 정령</button><span class="hint">사용 가능 ${pool.length}종 / 전체 ${c.spirits.length}종</span>`;
  for (const b of document.querySelectorAll('#spirit-filter button[data-f]')) b.onclick = () => { app.spiritFilter = b.dataset.f; renderRoom(); };
  for (const b of document.querySelectorAll('#spirit-filter button[data-e]')) b.onclick = () => { app.expFilter = b.dataset.e; renderRoom(); };
  $('#btn-rand').onclick = () => send({ t: 'pickSpirit', spiritId: 'random', mode: 'replace' });
  const me = r.players.find((p) => p.id === app.personId) || { spiritIds: [] };
  const list = [...pool].sort((a, b) => order[a.complexity] - order[b.complexity])
    .filter((sp) => (app.spiritFilter === 'all' || sp.complexity === app.spiritFilter) && (app.expFilter === 'all' || sp.exp === app.expFilter));
  app.openSpirit ||= {};
  $('#spirit-list').innerHTML = list.map((s) => {
    const owner = r.players.find((p) => p.spiritIds.includes(s.id));
    const mine = owner && owner.id === app.personId;
    const open = app.openSpirit[s.id];
    const pips = (arr) => `<span class="pips">${arr.map((v) => `<span class="pip">${v}</span>`).join('')}</span>`;
    const canAdd = !owner && me.spiritIds.length > 0 && total < r.maxSpirits;
    return `<div class="spirit-card ${mine ? 'mine' : ''} ${owner && !mine ? 'taken' : ''}" data-spirit="${s.id}" style="--sc:${s.color}">
      <div class="sc-art">${SpiritArt.html(s.id)}</div>
      ${owner ? `<span class="owner">${esc(owner.name)}</span>` : ''}
      <h3><span class="spirit-orb"></span>${esc(s.name)}</h3>
      <div class="en">${esc(s.en)}</div>
      <div class="badges"><span class="badge cx-${order[s.complexity]}">난이도 ${esc(s.complexity)}</span>${s.complexity === '낮음' ? '<span class="badge rec">초보 추천</span>' : ''}<span class="badge exp">${EXP_SHORT[s.exp]}</span></div>
      <div class="sec summary">${esc(s.summary)}</div>
      ${s.tip ? `<div class="sec tipbox">💡 ${esc(s.tip)}</div>` : ''}
      <div class="sec"><b>${esc(s.special.name)}</b>: ${esc(s.special.text)}</div>
      ${open ? `<div class="sec"><b>성장</b> (하나 선택)<br>${s.growth.map((g, i) => `${i + 1}. ${g.map(esc).join(' + ')}`).join('<br>')}</div>
      <div class="sec tracks"><span>${pcIcon('energy', 13, '#f3d98b')} 에너지</span>${pips(s.energyTrack)}<span>${pcIcon('card', 13, '#9ed3ff')} 카드 수</span>${pips(s.cardTrack)}</div>
      <div class="sec"><b>내재 권능</b>: ${s.innates.map((i) => esc(i.name)).join(', ')}</div>
      <div class="sec"><b>시작 배치</b>: ${esc(s.setupText)}</div>
      <div class="sec"><b>고유 권능</b>: ${s.uniques.map((u) => `<span data-card-tip="${u}" class="ulink">${esc(c.powers[u].name)}</span>`).join(', ')}</div>` : ''}
      <div class="sc-actions">
        ${!owner ? `<button class="small sc-pick primary" data-pick="${s.id}">선택</button>` : ''}
        <button class="small sc-more" data-board="${s.id}">📜 정령 판</button>
        <button class="small" data-more="${s.id}">${open ? '접기 ▴' : '자세히 ▾'}</button>
        ${mine ? `<button class="small sc-remove" data-remove="${s.id}">선택 해제</button>` : ''}
        ${canAdd ? `<button class="small sc-add" data-add="${s.id}" title="한 사람이 정령을 여러 개 조종합니다">＋ 추가로 조종</button>` : ''}
      </div>
    </div>`;
  }).join('') || '<p class="hint">조건에 맞는 정령이 없습니다.</p>';
  for (const el of document.querySelectorAll('.spirit-card')) {
    el.onclick = (e) => {
      const sid = el.dataset.spirit;
      if (e.target.closest('[data-more]')) { app.openSpirit[sid] = !app.openSpirit[sid]; renderRoom(); return; }
      if (e.target.closest('[data-remove]')) { send({ t: 'pickSpirit', spiritId: sid, mode: 'remove' }); return; }
      if (e.target.closest('[data-add]')) { send({ t: 'pickSpirit', spiritId: sid, mode: 'add' }); return; }
      if (e.target.closest('.ulink')) return;
      if (e.target.closest('[data-pick]')) { send({ t: 'pickSpirit', spiritId: sid, mode: 'replace' }); return; }
      SpiritBoard.open(sid, list.map((x) => x.id));
    };
  }
  attachCardTips($('#spirit-list'));
  renderChat($('#room-chat'));
}

function renderSettings(isHost, total) {
  const r = app.room;
  const c = app.catalog;
  const st = r.settings;
  const dis = isHost ? '' : 'disabled';
  const adv = c.adversaries.find((a) => a.id === st.difficulty.adversary);
  const preset = c.presets.find((p) => p.id === st.difficulty.preset);
  const boards = total + (st.map.extraBoard ? 1 : 0);
  $('#room-settings').innerHTML = `
    ${isHost ? '' : '<p class="hint">방장만 설정을 바꿀 수 있습니다.</p>'}
    <div class="set-group"><div class="set-title">📦 확장판 (DLC)</div>
      ${c.expansions.map((e) => `<label class="set-check"><input type="checkbox" data-exp="${e.id}" ${st.expansions.includes(e.id) ? 'checked' : ''} ${e.required ? 'disabled' : dis}> ${esc(e.name)} <span class="hint">${esc(e.en)} · 정령 ${c.spirits.filter((sp) => sp.exp === e.id).length}종</span></label>`).join('')}
    </div>
    <div class="set-group"><div class="set-title">🗺 맵</div>
      <label class="set-row">보드 배치 <select id="set-layout" ${dis}>
        <option value="auto" ${st.map.layout === 'auto' ? 'selected' : ''}>섬 (격자 배치)</option>
        <option value="coast" ${st.map.layout === 'coast' ? 'selected' : ''}>긴 해안선 (세로 일렬)</option></select></label>
      <label class="set-row">보드 선택 <select id="set-boards" ${dis}>
        <option value="ordered" ${st.map.boards === 'ordered' ? 'selected' : ''}>순서대로 (A, B, C…)</option>
        <option value="random" ${st.map.boards === 'random' ? 'selected' : ''}>무작위${st.expansions.includes('je') ? ' (E·F 포함)' : ''}</option></select></label>
      <label class="set-check"><input type="checkbox" id="set-extra" ${st.map.extraBoard ? 'checked' : ''} ${dis}> 추가 보드 +1 <span class="hint">(더 넓은 섬, 더 많은 침략자 — 어려워짐)</span></label>
      <div class="hint">보드 ${boards}개${boards > 4 ? ' · 5개 이상은 자동으로 세로 배치' : ''}</div>
    </div>
    <div class="set-group"><div class="set-title">⏱ 침략자 단계 진행</div>
      <label class="set-row">진행 방식 <select id="set-pace" ${dis}>
        <option value="manual" ${(st.pace || 'manual') === 'manual' ? 'selected' : ''}>직접 넘기기 — 모두 "다음"을 눌러야 진행 (추천)</option>
        <option value="slow" ${st.pace === 'slow' ? 'selected' : ''}>자동 · 느리게 (단계마다 5초)</option>
        <option value="normal" ${st.pace === 'normal' ? 'selected' : ''}>자동 · 보통 (단계마다 2.5초)</option></select></label>
      <div class="hint">약탈·건설·탐험을 하나씩 보여 줍니다. 익숙해지면 자동으로 바꾸세요.</div>
    </div>
    <div class="set-group"><div class="set-title">⚔ 난이도</div>
      <div class="preset-row">${c.presets.map((p) => `<button class="small preset ${st.difficulty.preset === p.id ? 'on' : ''}" data-preset="${p.id}" ${dis} title="${esc(p.desc)}">${esc(p.name)}</button>`).join('')}</div>
      <div class="hint">${esc(preset ? preset.desc : '')}</div>
      <label class="set-row">적대 세력 <select id="set-adv" ${dis}>
        <option value="">없음</option>
        ${c.adversaries.filter((a) => st.expansions.includes(a.exp)).map((a) => `<option value="${a.id}" ${st.difficulty.adversary === a.id ? 'selected' : ''}>${esc(a.name)}${a.exp !== 'base' ? ` (${EXP_SHORT[a.exp]})` : ''}</option>`).join('')}
      </select></label>
      ${adv ? `<label class="set-row">레벨 <input type="range" id="set-level" min="0" max="6" value="${st.difficulty.level}" ${dis}> <b>${st.difficulty.level}</b></label>
        <ol class="adv-levels">${adv.levels.map((l, i) => `<li class="${i < st.difficulty.level ? 'on' : ''}"><b>${i + 1}. ${esc(l.name)}</b> — ${esc(l.text)}</li>`).join('')}</ol>` : '<div class="hint">적대 세력을 고르면 레벨(0~6)별로 침략자가 더 강해집니다.</div>'}
    </div>`;
  if (!isHost) return;
  const push = (patch) => {
    const next = JSON.parse(JSON.stringify(st));
    patch(next);
    send({ t: 'setSettings', settings: next });
  };
  for (const cb of document.querySelectorAll('#room-settings [data-exp]')) {
    cb.onchange = () => push((n) => { n.expansions = [...document.querySelectorAll('#room-settings [data-exp]:checked')].map((x) => x.dataset.exp); });
  }
  $('#set-layout').onchange = (e) => push((n) => { n.map.layout = e.target.value; });
  $('#set-boards').onchange = (e) => push((n) => { n.map.boards = e.target.value; });
  $('#set-extra').onchange = (e) => push((n) => { n.map.extraBoard = e.target.checked; });
  $('#set-pace').onchange = (e) => push((n) => { n.pace = e.target.value; });
  for (const b of document.querySelectorAll('#room-settings [data-preset]')) b.onclick = () => push((n) => { n.difficulty.preset = b.dataset.preset; });
  $('#set-adv').onchange = (e) => push((n) => { n.difficulty.adversary = e.target.value || null; n.difficulty.level = e.target.value ? Math.max(1, n.difficulty.level) : 0; });
  const lv = $('#set-level');
  if (lv) lv.onchange = (e) => push((n) => { n.difficulty.level = Number(e.target.value); });
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

function renderSeatBar() {
  const bar = $('#seat-bar');
  const seats = app.mySeats || [];
  bar.classList.toggle('hidden', seats.length < 2);
  if (seats.length < 2) return;
  bar.innerHTML = `<span class="hint">내가 조종하는 정령:</span>${seats.map((id) => {
    const { def } = spiritOf(id);
    return `<button class="small seat ${id === app.you ? 'on' : ''}" data-seat="${id}" style="--sc:${def.color}"><span class="dot" style="background:${def.color}"></span>${esc(def.name)}${app.prompts[id] ? ' <b class="need">● 할 일</b>' : ''}</button>`;
  }).join('')}`;
  for (const b of bar.querySelectorAll('[data-seat]')) {
    b.onclick = () => { app.you = b.dataset.seat; app.prompt = app.prompts[app.you] || null; app.tab = app.you; renderGame(); };
  }
}

const PIECE_KO = { explorer: '탐험가', town: '마을', city: '도시', dahan: '다한' };
function pieceIco(k, size = 15) { return pcIcon(k, size, TOKEN_STYLE[k] ? TOKEN_STYLE[k].fill : '#ddd'); }
function killedText(k) {
  const parts = ['city', 'town', 'explorer'].filter((t) => k && k[t]).map((t) => `${PIECE_KO[t]} ${k[t]}`);
  return parts.length ? parts.join(', ') + ' 쓰러뜨림' : '아무도 쓰러뜨리지 못함';
}

/** 약탈 계산 과정을 한 줄씩 보여 주는 HTML. preview=true면 "예상" 문구 */
function ravageBreakdown(r, preview) {
  if (r.none) return '<div class="rv"><div class="rv-row">침략자가 없어서 약탈이 일어나지 않아요.</div></div>';
  if (r.skipped) return '<div class="rv"><div class="rv-row ok">권능 효과로 이번 턴 약탈하지 않아요. 🛡</div></div>';
  const terms = ['explorer', 'town', 'city'].filter((t) => r.att[t]).map((t) => `<span class="rv-t">${pieceIco(t)} ${PIECE_KO[t]} ${r.att[t]} × 공격력 ${r.atk[t]}</span>`);
  const will = preview ? '예정' : '';
  const rows = [];
  rows.push(`<div class="rv-row"><b class="rv-k">① 침략자 공격력</b><span>${terms.join(' + ')} = <b class="rv-n">${r.raw}</b></span></div>`);
  rows.push(`<div class="rv-row"><b class="rv-k">② 방어</b><span>${r.defend ? `🛡 ${r.raw} − ${r.defend} = <b class="rv-n">${r.dmg}</b>` : '없음 (방어 0)'}</span></div>`);
  rows.push(`<div class="rv-row ${r.blight ? 'bad' : 'ok'}"><b class="rv-k">③ 땅에 피해 ${r.dmg}</b><span>${r.blight ? `피해가 2 이상 → <b>황폐 +${r.blight}</b> ${will}` : '피해가 2 미만 → 황폐 없음 👍'}</span></div>`);
  let dahan;
  if (!r.dahanBefore) dahan = '이 지역에 다한이 없어요.';
  else if (r.dahanProtected) dahan = `다한 ${r.dahanBefore}명은 정령의 보호로 피해를 받지 않아요.`;
  else if (!r.dmg) dahan = `피해가 0이라 다한 ${r.dahanBefore}명 모두 무사해요.`;
  else dahan = `같은 피해 ${r.dahanDmg != null ? r.dahanDmg : r.dmg}을 다한이 받아요. 다한 체력은 1명당 ❤2 → ${r.dahanBefore}명 중 <b>${r.dahanLost}명 쓰러짐</b>${r.dahanLost < r.dahanBefore ? `, ${r.dahanBefore - r.dahanLost}명 생존` : ''}`;
  rows.push(`<div class="rv-row ${r.dahanLost ? 'bad' : ''}"><b class="rv-k">④ ${pieceIco('dahan')} 다한</b><span>${dahan}</span></div>`);
  let ctr;
  if (r.ambush) ctr = '다한이 먼저 기습 반격했어요!';
  else if (!r.dahanLeft) ctr = r.dahanBefore ? '살아남은 다한이 없어 반격하지 못해요.' : '반격할 다한이 없어요.';
  else ctr = `살아남은 다한 ${r.dahanLeft}명 × 반격력 ${r.dahanAtk} = 피해 <b class="rv-n">${r.counter}</b> → ${killedText(r.killed)}`;
  rows.push(`<div class="rv-row ${r.counter ? 'ok' : ''}"><b class="rv-k">⑤ 다한의 반격</b><span>${ctr}</span></div>`);
  return `<div class="rv">${rows.join('')}</div>`;
}

function openCombatHelp() {
  const st = (app.state && app.state.pieceStats) || { explorer: { hp: 1, atk: 1 }, town: { hp: 2, atk: 2 }, city: { hp: 3, atk: 3 }, dahan: { hp: 2, atk: 2 } };
  const row = (k, note) => `<tr><td>${pieceIco(k, 22)} <b>${PIECE_KO[k]}</b></td><td class="c">${st[k].hp}</td><td class="c">${st[k].atk}</td><td>${note}</td></tr>`;
  const ex = { att: { explorer: 1, town: 1, city: 0 }, atk: { explorer: st.explorer.atk, town: st.town.atk, city: st.city.atk }, defend: 0, dahanBefore: 2, dahanAtk: st.dahan.atk };
  ex.raw = ex.att.explorer * ex.atk.explorer + ex.att.town * ex.atk.town; ex.dmg = ex.raw; ex.blight = ex.dmg >= 2 ? 1 : 0;
  ex.dahanLost = Math.min(2, Math.floor(ex.dmg / st.dahan.hp)); ex.dahanLeft = 2 - ex.dahanLost; ex.counter = ex.dahanLeft * st.dahan.atk;
  ex.killed = { explorer: 0, town: 0, city: 0 };
  { let c = ex.counter; if (c >= st.town.hp) { ex.killed.town = 1; c -= st.town.hp; } if (c >= 1) ex.killed.explorer = 1; }
  const ex2 = { ...ex, defend: 3, dmg: Math.max(0, ex.raw - 3) }; ex2.blight = ex2.dmg >= 2 ? 1 : 0; ex2.dahanLost = Math.min(2, Math.floor(ex2.dmg / st.dahan.hp)); ex2.dahanLeft = 2 - ex2.dahanLost; ex2.counter = ex2.dahanLeft * st.dahan.atk;
  ex2.killed = { explorer: 0, town: 0, city: 0 }; { let c = ex2.counter; if (c >= st.town.hp) { ex2.killed.town = 1; c -= st.town.hp; } if (c >= 1) ex2.killed.explorer = 1; }
  $('#combat .combat-body').innerHTML = `
    <h3>조각마다 체력과 공격력이 있어요</h3>
    <table class="combat-tbl"><tr><th>조각</th><th>체력 ❤</th><th>공격력</th><th>설명</th></tr>
      ${row('explorer', '피해 1이면 쓰러짐. 약탈할 때 땅을 1만큼 공격')}
      ${row('town', '피해 2가 필요. 쓰러뜨리면 공포 +1')}
      ${row('city', '피해 3이 필요. 쓰러뜨리면 공포 +2')}
      ${row('dahan', '<b>우리 편</b>. 약탈 피해를 같이 받고, 살아남으면 반격')}</table>
    <p class="hint">체력: 이만큼 피해를 받으면 쓰러집니다. 덜 받은 피해는 그 턴 동안만 남고 턴이 끝나면 회복돼요. · 공격력: 약탈(침략자) 또는 반격(다한) 때 주는 피해. 난이도(적대 세력)에 따라 침략자 공격력이 더 높을 수 있어요.</p>
    <h3>약탈은 이렇게 계산해요</h3>
    <ol class="combat-steps">
      <li><b>공격력 합계</b>: 그 지역 침략자들의 공격력을 모두 더합니다.</li>
      <li><b>방어</b>: 권능이나 정령 능력으로 얻은 🛡 방어만큼 뺍니다. 남은 값이 <b>땅에 주는 피해</b>예요.</li>
      <li><b>황폐</b>: 땅에 피해가 <b>2 이상</b>이면 황폐 1개가 놓입니다. (이미 황폐가 있으면 옆 지역으로 번지고, 그 지역 존재 1개가 사라져요)</li>
      <li><b>다한이 다침</b>: 같은 피해가 다한에게도 갑니다. 다한은 1명당 ❤${st.dahan.hp}이라 피해 ${st.dahan.hp}마다 1명씩 쓰러져요.</li>
      <li><b>다한의 반격</b>: 살아남은 다한 1명당 피해 ${st.dahan.atk}씩, 모두 합쳐 침략자에게 반격합니다. (큰 침략자부터 쓰러뜨릴 수 있는 만큼)</li>
    </ol>
    <div class="combat-ex"><h4>예시 ① ${pieceIco('explorer')} 탐험가 1 + ${pieceIco('town')} 마을 1 vs ${pieceIco('dahan')} 다한 2 (방어 없음)</h4>${ravageBreakdown(ex, true)}</div>
    <div class="combat-ex"><h4>예시 ② 같은 지역에 🛡 방어 3을 걸었다면</h4>${ravageBreakdown(ex2, true)}</div>
    <h3>그래서 어떻게 막나요?</h3>
    <ul>
      <li><b>침략자 줄이기</b>: 피해 권능으로 약탈 전에(빠른 권능) 쓰러뜨리거나, 밀어내기로 다른 곳으로 보내요.</li>
      <li><b>방어 올리기</b>: 피해가 1 이하가 되면 황폐도 안 생기고 다한도 무사 → 다한이 전부 반격!</li>
      <li><b>다한 모으기</b>: 다한이 많을수록 반격이 세져요. 다한 3명이면 반격 피해 ${st.dahan.atk * 3}.</li>
      <li>지도에서 <span class="fc-chip ravage">⚔ 약탈 예정</span> 지역에 마우스를 올리면 이번 턴 <b>예상 계산</b>이 나와요.</li>
    </ul>`;
  $('#combat').classList.remove('hidden');
}

function stepFoot(step) {
  if (!step.manual) return '';
  const total = app.state.players.length;
  const acks = step.acks || [];
  const mine = (app.mySeats || [app.you]).every((id) => acks.includes(id));
  const waitMsg = acks.length >= total ? (app.prompt ? '효과를 처리하는 중… 위 안내에 따라 지도에서 골라 주세요' : '효과를 처리하는 중…') : `다른 플레이어를 기다리는 중… (${acks.length}/${total})`;
  return `<div class="ib-next-row">${mine ? `<span class="hint">${waitMsg}</span>` : `<button class="primary ib-next" data-ack="${step.no}">다 봤어요, 다음 ▶</button>${total > 1 ? `<span class="hint">${acks.length}/${total}명 확인</span>` : ''}<span class="hint">(Enter 키)</span>`}</div>`;
}
function bindStepFoot(b) {
  const btn = b.querySelector('[data-ack]');
  if (btn) btn.onclick = () => { Sound.play('click'); send({ t: 'ackStep', no: Number(btn.dataset.ack) }); btn.disabled = true; };
}

function renderInvaderBanner() {
  renderInvaderBannerInner();
  // 지도 영역이 좁으면 배너를 화면 가운데에 띄움
  const b = $('#inv-banner');
  const wrap = document.querySelector('.map-wrap');
  const float = !b.classList.contains('hidden') && !b.classList.contains('ib-mini') && wrap && (wrap.clientHeight < 440 || wrap.clientWidth < 760);
  b.classList.toggle('ib-float', !!float);
  if (wrap) wrap.classList.toggle('ib-float-on', !!float);
}

// 배너 접기 상태: 내가 고를 것이 있으면(공포 카드 효과 등) 자동으로 작게 접어서 지도를 가리지 않게 함
function bannerMinimized(step) {
  if (app.bannerToggle && app.bannerToggle.no === step.no) return app.bannerToggle.min;
  return !!app.prompt;
}
function renderInvaderBannerInner() {
  const b = $('#inv-banner');
  const step = app.state.invaderStep;
  if (!step || app.state.result) { b.classList.add('hidden'); return; }
  const meta = { fear: ['😱', '공포 카드'], ravage: ['⚔', '약탈'], ravageLand: ['⚔', '약탈'], build: ['🏠', '건설'], explore: ['🧭', '탐험'], advance: ['➡', '카드 이동'] }[step.kind] || ['•', ''];
  const toggle = (min) => { app.bannerToggle = { no: step.no, min }; Sound.play('click'); renderInvaderBanner(); };
  if (bannerMinimized(step)) {
    const label = step.kind === 'ravageLand' && step.report ? `⚔ 약탈 계산 — ${step.report.landId}` : `${meta[0]} ${meta[1]}${step.card ? ` [${esc(step.card)}]` : ''}`;
    b.className = `inv-banner ib-${step.kind === 'ravageLand' ? 'ravage' : step.kind} ib-mini`;
    b.innerHTML = `<span class="ib-mini-title">${label}</span>${app.prompt ? '<span class="ib-mini-hint">지도에서 고르세요</span>' : ''}<button class="small" data-open>▾ 펼치기</button>`;
    b.querySelector('[data-open]').onclick = () => toggle(false);
    return;
  }
  const addFold = () => {
    const btn = document.createElement('button');
    btn.className = 'small ib-fold'; btn.textContent = '▴ 접기'; btn.title = '배너를 작게 접어 지도를 봅니다';
    btn.onclick = () => toggle(true);
    b.prepend(btn);
  };
  if (step.kind === 'ravageLand' && step.report) {
    const r = step.report;
    const l = app.state.lands[r.landId];
    b.className = 'inv-banner ib-ravage ib-wide';
    b.innerHTML = `<div class="ib-title">⚔ 약탈 계산 — ${r.landId} ${l ? esc(app.catalog.terrains[l.terrain]) : ''}</div>
      ${r.skipped ? `<div class="ib-text">${esc(step.text)}</div>` : ravageBreakdown(r, false)}
      <div class="ib-foot"><button class="small" data-combat>⚔ 전투 계산법 자세히</button></div>${stepFoot(step)}`;
    b.querySelector('[data-combat]').onclick = openCombatHelp;
    bindStepFoot(b);
    addFold();
    return;
  }
  b.className = `inv-banner ib-${step.kind}`;
  b.innerHTML = `<div class="ib-title">${meta[0]} 침략자 단계 — ${meta[1]}${step.card ? ` <span class="ib-card">[${esc(step.card)}]</span>` : ''}</div>
    <div class="ib-text">${esc(step.text)}</div>${step.lands && step.lands.length ? `<div class="ib-lands">${step.lands.map((id) => `<span>${id}</span>`).join('')}</div>` : ''}${stepFoot(step)}`;
  bindStepFoot(b);
  addFold();
}

function renderGame() {
  hideTip();
  renderSeatBar();
  renderInvaderBanner();
  Tutorial.update(app.state, app.prompt);
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
    <div class="tb-box phase" title="${PHASE_NAME[st.phase] || ''}"><span class="k">${st.turn}턴 · 지금 단계</span>
      <div class="phases">${[['growth', '성장·카드'], ['fast', '빠른 권능'], ['invader', '침략자'], ['slow', '느린 권능']].map(([k, n]) => `<span class="ph ${st.phase === k ? 'on' : ''} ph-${k}">${n}</span>`).join('<i>›</i>')}</div></div>
    <div class="tb-box" title="공포가 공포 풀만큼 쌓이면 공포 카드를 얻습니다."><span class="k">공포 ${f.generated}/${f.poolSize} · 획득 카드 ${f.earnedTotal}장${f.pending ? ` (대기 ${f.pending})` : ''}</span><div class="fear-bar">${fearDots}</div></div>
    <div class="tb-box" title="공포 단계에 따라 승리 조건이 쉬워집니다."><span class="k">공포 단계 · 남은 공포 카드</span><span class="v">${pcIcon('fear', 16, '#c9a2ff')} ${f.terrorLevel}단계 · ${f.deckLeft}장</span></div>
    <div class="tb-box" title="${st.blight.flipped ? '황폐해진 섬: 다시 비면 패배' : '건강한 섬: 비면 뒤집힘'}"><span class="k">황폐 카드${st.blight.flipped ? ' (황폐해진 섬!)' : ''}</span><span class="v" style="color:${st.blight.flipped ? 'var(--danger)' : 'inherit'}">${pcIcon('blight', 16, '#e8604f')} ${st.blight.pool}</span></div>
    <div class="tb-box inv-track" title="침략자 카드는 매 턴 오른쪽으로 한 칸씩 이동합니다: 탐험 → 건설 → 약탈">
      <span class="k">침략자 진행표 <span class="hint">(매 턴 → 방향으로 이동)</span></span>
      <div class="it-row">
        <div class="it-slot"><span class="it-l">🧭 탐험 <small>(새 카드)</small></span><span class="it-c">${st.invader.deckCount ? `<span class="inv-card back">?</span><small>${st.invader.nextStage}단계 · ${st.invader.deckCount}장</small>` : '<span class="hint">없음</span>'}</span></div>
        <i>›</i>
        <div class="it-slot build"><span class="it-l">🏠 건설 <small>이번 턴</small></span><span class="it-c">${invCardHTML(st.invader.build)}</span></div>
        <i>›</i>
        <div class="it-slot ravage"><span class="it-l">⚔ 약탈 <small>이번 턴</small></span><span class="it-c">${invCardHTML(st.invader.ravage)}</span></div>
      </div></div>
    <div class="tb-box" style="flex:1;min-width:180px"><span class="k">승리 조건 (공포 ${f.terrorLevel}단계) · 난이도 ${esc(st.difficulty || '보통')}</span><span style="font-size:12px">${['', '섬에 침략자가 하나도 없으면 승리', '섬에 마을·도시가 없으면 승리', '섬에 도시가 없으면 승리'][f.terrorLevel]}${st.turnRules.length ? `<br><span style="color:var(--accent2)">이번 턴: ${st.turnRules.map(esc).join(', ')}</span>` : ''}</span></div>
    <div class="tb-actions"><button class="btn-guide small">📖 게임 방법</button>${soundButtonHTML()}<button id="btn-help" class="small">❓ 규칙 요약</button>${quitButtonHTML()}</div>
  `;
  $('#btn-help').onclick = () => $('#help').classList.remove('hidden');
  bindQuitButton();
}

function renderPrompt() {
  const el = $('#prompt');
  const p = app.prompt;
  const st = app.state;
  const hint = st.result ? '' : p ? promptHint(p, st, app.you) : idleHint(st);
  $('#hint').classList.toggle('hidden', !hint || !app.showHints);
  $('#hint').innerHTML = hint ? `<span class="hint-ico">💡</span><span>${hint}</span><button class="hint-x small" title="도움말 숨기기">숨기기</button>` : '';
  const hx = $('#hint .hint-x');
  if (hx) hx.onclick = () => { app.showHints = false; try { localStorage.setItem('si-hints', '0'); } catch { /* 무시 */ } renderPrompt(); };
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

function use3D() {
  return app.view3d && window.Map3D && window.Map3D.supported();
}

function renderMap() {
  const st = app.state;
  const svg = $('#map');
  $('#btn-view').textContent = app.view3d ? '🗺 2D 보기' : '🏔 3D 보기';
  $('#btn-cam').classList.toggle('hidden', !use3D());
  $('#map-help').classList.toggle('hidden', !use3D());
  if (use3D()) {
    svg.classList.add('hidden');
    $('#map3d').classList.remove('hidden');
    const ok = window.Map3D.init($('#map3d'), {
      onClick: (id) => {
        const p = app.prompt;
        if (p && p.type === 'land' && p.options.includes(id)) { Sound.play('land'); answer(id); }
      },
      onHover: (id, e) => { if (id) showTip(e, landTip(id)); else hideTip(); },
    });
    if (ok) {
      window.Map3D.render(st, app.prompt, {
        spiritColor: (pid) => spiritOf(pid).def.color,
        isSacred: (pid, landId) => st.spirits[pid].sacred.includes(landId),
      });
      renderLegend();
      return;
    }
    app.view3d = false;
  }
  svg.classList.remove('hidden');
  $('#map3d').classList.add('hidden');
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
    const stepLands = st.invaderStep && st.invaderStep.lands ? st.invaderStep.lands : [];
    if (stepLands.includes(l.id)) html += `<polygon class="fc fc-now fc-${st.invaderStep.kind === 'ravageLand' ? 'ravage' : st.invaderStep.kind}" points="${ptsStr(l.poly)}"/>`;
    else if (st.phase !== 'invader' && st.forecast) {
      if (st.forecast.ravage.includes(l.id)) html += `<polygon class="fc fc-ravage" points="${ptsStr(l.poly)}"/>`;
      else if (st.forecast.build.includes(l.id)) html += `<polygon class="fc fc-build" points="${ptsStr(l.poly)}"/>`;
    }
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
    const fcTag = st.phase !== 'invader' && st.forecast ? (st.forecast.ravage.includes(l.id) ? ['⚔ 약탈 예정', '#ff4d4d'] : st.forecast.build.includes(l.id) ? ['🏠 건설 예정', '#ffb547'] : null) : null;
    const rvi = fcTag && st.forecast.ravageInfo && st.forecast.ravageInfo[l.id];
    if (rvi && !rvi.skipped) fcTag[0] = `⚔ 약탈 피해 ${rvi.dmg}${rvi.blight ? ' → 황폐!' : ' (황폐 없음)'}`;
    else if (rvi && rvi.skipped) fcTag[0] = '⚔ 약탈 막음 🛡';
    const tw = fcTag ? Math.max(52, fcTag[0].length * 5.6 + 8) : 0;
    if (fcTag) html += `<g transform="translate(${cx},${cy - 38})" pointer-events="none"><rect x="${-tw / 2}" y="-7" width="${tw}" height="13" rx="6.5" fill="${fcTag[1]}" opacity=".92"/><text x="0" y="2.6" text-anchor="middle" class="plaque-t" fill="#1a0a04" style="fill:#1a0a04">${fcTag[0]}</text></g>`;
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
    poly.onclick = () => { if (selectable.has(id)) { Sound.play('land'); answer(id); } };
    poly.onmouseenter = (e) => showTip(e, landTip(id));
    poly.onmousemove = moveTip;
    poly.onmouseleave = hideTip;
  }
  renderLegend();
}

function renderLegend() {
  const lg = (k, label) => `<span class="lg">${pcIcon(k, 14, TOKEN_STYLE[k] ? TOKEN_STYLE[k].fill : '#ddd')} ${label}</span>`;
  const ps = app.state.pieceStats || { explorer: { hp: 1, atk: 1 }, town: { hp: 2, atk: 2 }, city: { hp: 3, atk: 3 }, dahan: { hp: 2, atk: 2 } };
  const st = (k) => `${PIECE_KO[k]} <span class="lg-st">체력 ${ps[k].hp} · ${k === 'dahan' ? '반격' : '공격'} ${ps[k].atk}</span>`;
  $('#legend').innerHTML = ['<button class="small lg-combat" data-combat>⚔ 전투 계산법</button>', lg('explorer', st('explorer')), lg('town', st('town')), lg('city', st('city')), lg('dahan', st('dahan')), lg('blight', '황폐'),
    `<span class="lg">${pcIcon('presence', 14, '#f2c94c')} 존재 <span class="hint">(금빛 테두리 = 성지)</span></span>`, lg('shield', '방어'), lg('skip', '행동 건너뜀'),
    '<span class="lg"><i class="sw sw-dmg"></i>손상</span>', '<span class="lg"><i class="sw sw-ravage"></i>약탈</span>', '<span class="lg"><i class="sw sw-build"></i>건설</span>', '<span class="lg"><i class="sw sw-explore"></i>탐험</span>'].join('');
  $('#legend [data-combat]').onclick = openCombatHelp;
}

function landTip(id) {
  const l = app.state.lands[id];
  const t = app.catalog.terrains[l.terrain];
  const parts = [`<b>${id} — ${t}${l.coastal ? ' (해안)' : ' (내륙)'}</b>`];
  const ps = app.state.pieceStats || { explorer: { atk: 1 }, town: { atk: 2 }, city: { atk: 3 }, dahan: { atk: 2 } };
  if (l.cities.length) parts.push(`${pieceIco('city', 13)} 도시 ${l.cities.length} — 남은 체력 ❤${l.cities.join(', ❤')} · 공격력 ${ps.city.atk}`);
  if (l.towns.length) parts.push(`${pieceIco('town', 13)} 마을 ${l.towns.length} — 남은 체력 ❤${l.towns.join(', ❤')} · 공격력 ${ps.town.atk}`);
  if (l.explorers) parts.push(`${pieceIco('explorer', 13)} 탐험가 ${l.explorers} — 체력 ❤1 · 공격력 ${ps.explorer.atk}`);
  if (l.dahan.length) parts.push(`${pieceIco('dahan', 13)} 다한 ${l.dahan.length} (우리 편) — 남은 체력 ❤${l.dahan.join(', ❤')} · 반격력 ${ps.dahan.atk}`);
  if (l.blight) parts.push(`황폐 ${l.blight}`);
  for (const [pid, n] of Object.entries(l.presence)) if (n) { const { def, player, s } = spiritOf(pid); parts.push(`<span style="color:${def.color}">● ${esc(player.name)} 존재 ${n}${s.sacred.includes(id) ? ' (성지)' : ''}</span>`); }
  if (l.defend) parts.push(`방어 ${l.defend}`);
  if (l.skip) parts.push('이번 턴 침략자 행동 건너뜀');
  if (l.dahanProtected) parts.push('다한이 약탈 피해를 받지 않음');
  const rv = app.state.phase !== 'invader' && app.state.forecast && app.state.forecast.ravageInfo && app.state.forecast.ravageInfo[id];
  if (rv) parts.push(`<div class="tip-rv"><b style="color:#ff8a7a">⚔ 이번 턴 약탈 예상 (지금 상태 그대로라면)</b>${ravageBreakdown(rv, true)}</div>`);
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
  const bb = $('#side-content [data-board]');
  if (bb) bb.onclick = () => SpiritBoard.open(bb.dataset.board, app.state.players.map((p) => app.state.spirits[p.id].spiritId));
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
    const now = innateNow(inn, lv);
    const need = innateNeed(inn, lv, s.elements);
    const status = s.innatesUsed[inn.id] ? '<div class="inn-now used">✔ 이번 턴에 사용했어요</div>'
      : lv ? `<div class="inn-now on">✨ 지금 쓸 수 있어요 (${lv}단계): <b>${esc(now)}</b>${need ? `<br><span class="hint">다음 단계까지: ${esc(need)}</span>` : ''}</div>`
        : `<div class="inn-now off">🔒 아직 못 써요 — 이번 턴에 낸 카드의 원소가 부족해요<br><span class="hint">1단계 조건: ${esc(need)}</span></div>`;
    return `<div class="innate ${inn.speed}"><b>${esc(inn.name)}</b> <span class="hint">(내재 · ${inn.speed === 'fast' ? '빠름' : '느림'} · ${esc(targetText(inn.target))})</span>
      ${inn.levels.map((l, i) => `<div class="lv ${i < lv ? 'met' : ''}"><span class="lv-n">${i + 1}단계</span><span class="lv-els">${Object.entries(l.el).map(([e, n]) => elRep(e, n, 13)).join('')}</span> ${esc(l.text)}</div>`).join('')}${status}</div>`;
  }).join('');
  const played = s.played.map((p) => `<span data-card-tip="${p.id}">${cardHTML(p.id, { mini: true, used: p.used, elements: s.elements })}</span>`).join('');
  const handList = pid === app.you ? '' : `<div class="pile">손패: ${s.hand.map((id) => `<span data-card-tip="${id}" style="text-decoration:underline dotted">${esc(app.catalog.powers[id].name)}</span>`).join(', ') || '없음'}</div>`;
  return `
    <div class="sp-art">${SpiritArt.html(def.id)}<button class="small sp-boardbtn" data-board="${def.id}">📜 정령 판 보기</button></div>
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
    <h2>내재 권능</h2>
    <div class="inn-help">💡 <b>내재 권능</b> = 카드 없이 쓰는 이 정령만의 고유 능력이에요. 에너지가 들지 않고 매 턴 1번 쓸 수 있어요.<br>
      단, <b>이번 턴에 낸 카드들의 원소</b>(카드 왼쪽 위 아이콘)를 합쳐서 조건을 채워야 해요. 조건을 채운 단계까지 효과가 <b>모두 더해져요</b>. 쓸 수 있으면 빠름/느림 권능 단계에 버튼이 나타나요.</div>
    ${innates}
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

// 게임 도중 그만두기: 방장은 저장하고 대기실로, 튜토리얼은 그냥 나가기
function quitButtonHTML() {
  if (!app.room || app.state.result) return '';
  if (app.room.hostId !== app.personId) return '';
  return `<button id="btn-quit" class="small" title="${app.state.tutorial ? '튜토리얼을 그만두고 첫 화면으로' : '지금까지 진행을 저장하고 대기실로 돌아가기'}">${app.state.tutorial ? '🚪 그만하기' : '💾 저장하고 그만하기'}</button>`;
}
function bindQuitButton() {
  const b = $('#btn-quit');
  if (!b) return;
  b.onclick = () => {
    if (app.state.tutorial) { if (confirm('튜토리얼을 그만두고 첫 화면으로 갈까요?')) send({ t: 'leave' }); return; }
    if (confirm('게임을 저장하고 대기실로 돌아갈까요?\n\n나중에 첫 화면의 "💾 저장된 게임 이어하기"에서 지금 상태 그대로 계속할 수 있어요.\n(함께하는 친구들도 모두 대기실로 이동합니다)')) send({ t: 'quitGame' });
  };
}

function renderModal() {
  const st = app.state;
  const p = app.prompt;
  const inner = $('#modal .modal-inner');
  if (st && st.result && !app.resultDismissed) {
    const isHost = app.room.hostId === app.personId;
    inner.innerHTML = `<div class="result ${st.result.win ? 'win' : 'lose'}"><svg class="big-logo" viewBox="0 0 64 64"><use href="#logo"/></svg><h1>${st.result.win ? '승리' : '패배'}</h1><p>${esc(st.result.reason)}</p><p class="hint">${st.result.turn}턴에 게임이 끝났습니다.</p>
      <div class="actions" style="justify-content:center">${isHost ? '<button id="btn-rematch" class="primary">🔁 바로 다시 하기 (같은 정령·설정)</button><button id="btn-lobby">⚙ 대기실에서 설정 바꾸기</button>' : '<span class="hint">방장이 "바로 다시 하기"를 누르면 같은 구성으로 새 판이 시작돼요.</span>'}<button id="btn-close-result">지도 보기</button></div></div>`;
    $('#modal').classList.remove('hidden');
    const lb = $('#btn-lobby');
    if (lb) lb.onclick = () => send({ t: 'backToLobby' });
    const rm = $('#btn-rematch');
    if (rm) rm.onclick = () => { rm.disabled = true; send({ t: 'rematch' }); };
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
    ${isPlay ? `<div class="read-guide">📖 <b>카드 읽는 법</b> — 왼쪽 위 숫자: 필요한 에너지 · <span class="ex-fast">빠름</span>: 침략자보다 먼저 / <span class="ex-slow">느림</span>: 침략자 다음 · 가운데 줄: 쓸 수 있는 곳(사거리) · 아래: 효과 · 원소 아이콘: 모이면 내재 권능이 강해짐</div>` : ''}
    ${isPlay ? `<div class="budget">선택 ${sel.length}/${p.max}장 · 비용 <b style="color:${cost > p.budget ? 'var(--danger)' : 'var(--accent2)'}">${cost}</b> / 에너지 ${p.budget} · 현재 원소: ${Object.entries(sumElements(sel)).map(([e, n]) => `${elIcon(e, 15)}×${n}`).join(' ') || '없음'}</div>` : ''}
    <div class="cards-row">${p.cards.map((id) => {
      const picked = sel.includes(id);
      const c = app.catalog.powers[id];
      const disabled = !picked && ((isPlay && (sel.length >= p.max || cost + c.cost > p.budget)) || (!isPlay && sel.length >= p.max && p.max > 1));
      return cardHTML(id, { selectable: !disabled, selected: picked, disabled, elements: isPlay ? sumElements(sel) : s.elements });
    }).join('')}</div>
    ${sel.length ? `<div class="sel-explain">${sel.map((id) => `<div>▶ <b>${esc(app.catalog.powers[id].name)}</b>: ${explainCard(app.catalog.powers[id])}</div>`).join('')}</div>` : (isPlay ? '<div class="sel-explain hint">카드를 누르면 그 카드가 무엇을 하는지 여기에 설명이 나옵니다.</div>' : '')}
    <div class="actions">
      <button id="btn-hide-modal">지도 보기 (나중에 선택)</button>
      <button id="btn-confirm-cards" class="primary" ${sel.length < p.min || sel.length > p.max ? 'disabled' : ''}>${isPlay ? (sel.length ? `${sel.length}장 사용하기` : '카드 없이 진행') : '선택 완료'}</button>
    </div>`;
  $('#modal').classList.remove('hidden');
  for (const el of inner.querySelectorAll('.card')) {
    el.onclick = () => {
      const id = el.dataset.card;
      Sound.play('select');
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
  document.addEventListener('click', (e) => { if (e.target.closest('.btn-guide')) Guide.open(0); });
  $('#btn-view').onclick = () => { app.view3d = !app.view3d; writePref('si-3d', app.view3d ? '1' : '0'); if (app.state) renderMap(); };
  $('#btn-cam').onclick = () => window.Map3D && window.Map3D.resetView();
  const applyLayout = () => {
    document.body.classList.toggle('side-collapsed', readPref('si-side', '1') === '0');
    document.body.classList.toggle('hand-collapsed', readPref('si-handv', '1') === '0');
    $('#btn-panel').textContent = document.body.classList.contains('side-collapsed') ? '⇤ 패널 펴기' : '⇥ 패널 접기';
    $('#btn-hand').textContent = document.body.classList.contains('hand-collapsed') ? '▴ 손패 펴기' : '▾ 손패 접기';
  };
  $('#btn-panel').onclick = () => { writePref('si-side', document.body.classList.contains('side-collapsed') ? '1' : '0'); applyLayout(); };
  $('#btn-hand').onclick = () => { writePref('si-handv', document.body.classList.contains('hand-collapsed') ? '1' : '0'); applyLayout(); };
  $('#btn-full').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); };
  applyLayout();
  window.addEventListener('map3d-ready', () => { if (app.state) renderMap(); });
  $('#btn-help-close').onclick = () => $('#help').classList.add('hidden');
  $('#btn-combat-close').onclick = () => $('#combat').classList.add('hidden');
  $('#combat').onclick = (e) => { if (e.target.id === 'combat') $('#combat').classList.add('hidden'); };
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
    if (e.key === 'Enter' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test((document.activeElement || {}).tagName || '')) {
      const ack = document.querySelector('#inv-banner:not(.hidden) [data-ack]:not([disabled])');
      if (ack) { ack.click(); e.preventDefault(); return; }
    }
    if (e.key === 'Escape' && RuleVideo.isOpen()) { RuleVideo.close(); return; }
    if (e.key === 'Escape' && !$('#combat').classList.contains('hidden')) { $('#combat').classList.add('hidden'); return; }
    if (e.key === 'Escape' && SpiritBoard.isOpen()) { SpiritBoard.close(); return; }
    if (e.key === 'Escape' && !$('#guide').classList.contains('hidden')) { Guide.close(); return; }
    if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) {
      if (app.state && app.state.result) app.resultDismissed = true; else app.modal.hidden = true;
      closeModal();
    }
  });
}

// 사운드 설정 패널
function initSoundUI() {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && !b.closest('#sound-panel')) Sound.play('click');
    if (e.target.closest('.btn-sound')) { toggleSoundPanel(e.target.closest('.btn-sound')); return; }
    if (!e.target.closest('#sound-panel')) $('#sound-panel').classList.add('hidden');
  });
  const panel = $('#sound-panel');
  const st = Sound.settings;
  panel.innerHTML = `<div class="sp-title">소리 설정</div>
    <label class="sp-row"><input type="checkbox" id="snd-music" ${st.musicOn ? 'checked' : ''}> 배경음악</label>
    <input type="range" id="snd-music-vol" min="0" max="1" step="0.05" value="${st.music}">
    <label class="sp-row"><input type="checkbox" id="snd-sfx" ${st.sfxOn ? 'checked' : ''}> 효과음</label>
    <input type="range" id="snd-sfx-vol" min="0" max="1" step="0.05" value="${st.sfx}">
    <button id="snd-test" class="small">🔔 소리 테스트</button>
    <div class="hint" id="snd-state"></div>`;
  const stateText = () => {
    const m = { running: '소리 켜짐 ✓', suspended: '브라우저가 소리를 막고 있어요. 화면을 클릭하세요.', none: '화면을 한 번 클릭하면 소리가 시작됩니다.', closed: '소리 꺼짐' };
    $('#snd-state').textContent = m[Sound.state] || Sound.state;
  };
  $('#snd-test').onclick = () => { Sound.test(); setTimeout(stateText, 300); };
  setInterval(() => { if (!panel.classList.contains('hidden')) stateText(); }, 1000);
  stateText();
  $('#snd-music').onchange = (e) => { Sound.init(); Sound.set('musicOn', e.target.checked); updateSoundButtons(); };
  $('#snd-sfx').onchange = (e) => { Sound.set('sfxOn', e.target.checked); updateSoundButtons(); };
  $('#snd-music-vol').oninput = (e) => Sound.set('music', Number(e.target.value));
  $('#snd-sfx-vol').oninput = (e) => { Sound.set('sfx', Number(e.target.value)); Sound.play('select'); };
  updateSoundButtons();
}
function toggleSoundPanel(btn) {
  const panel = $('#sound-panel');
  const r = btn.getBoundingClientRect();
  panel.style.top = `${r.bottom + 8}px`;
  panel.style.left = `${Math.max(8, Math.min(window.innerWidth - 230, r.right - 220))}px`;
  panel.classList.toggle('hidden');
}
function soundButtonHTML() {
  const on = Sound.settings.musicOn || Sound.settings.sfxOn;
  return `<button class="btn-sound small" title="소리 설정">${on ? '🔊' : '🔇'} 소리</button>`;
}
function updateSoundButtons() {
  for (const b of document.querySelectorAll('.btn-sound')) b.outerHTML = soundButtonHTML();
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
initSoundUI();
connect();
