'use strict';
(() => {
// 시작: 접속, 화면 갱신, 서버 소식 처리
const G = window.G;

// ───────── 조사 ─────────
G.hasBatchim = (word) => {
  const s = String(word || '').replace(/[^가-힣A-Za-z0-9]+$/u, '');
  const ch = s[s.length - 1];
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(ch)) return '013678'.includes(ch);
  return /[LMNR]$/i.test(ch);
};
G.josa = (word, pair) => {
  if (!pair.includes('/')) return word + pair;
  const [a, b] = pair.split('/');
  if (pair === '으로/로') { const code = String(word).charCodeAt(String(word).length - 1); const rieul = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 === 8; return word + (G.hasBatchim(word) && !rieul ? '으로' : '로'); }
  return word + (G.hasBatchim(word) ? a : b);
};
G.josaEunNeun = (w) => (G.hasBatchim(w) ? '은' : '는');

// ───────── 접속 ─────────
G.net = {
  ws: null,
  send(msg) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); },
  sendMove(step) {
    const ow = G.ow;
    this.send({ t: 'move', map: ow.mapId, x: ow.x, y: ow.y, dir: ow.dir, surf: ow.surf, bike: ow.bike, step, busy: G.uiBusy() });
  },
};

G.deferred = [];
G.runDeferred = () => { const list = G.deferred; G.deferred = []; for (const f of list) f(); };
const later = (f) => { if (G.battle) G.deferred.push(f); else f(); };

function connect(name, look) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}`);
  G.net.ws = ws;
  ws.onopen = () => { G.net.send({ t: 'hello', name, look }); };
  ws.onmessage = (ev) => { let msg; try { msg = JSON.parse(ev.data); } catch { return; } onMessage(msg); };
  ws.onclose = () => {
    if (G.kicked) return;
    G.toast('서버와 연결이 끊어졌습니다. 다시 연결하는 중…');
    setTimeout(() => connect(name, look), 2000);
  };
}

let firstState = true;
function onMessage(msg) {
  switch (msg.t) {
    case 'hi': G.saves = msg.saves; G.showLogin && G.showLogin(msg.saves); break;
    case 'welcome': G.myId = msg.id; G.isNew = msg.isNew; break;
    case 'state': {
      const prev = G.me;
      G.me = msg.me;
      if (firstState) {
        firstState = false;
        document.getElementById('login').classList.add('hidden');
        G.enterMap(G.me.map, G.me.x, G.me.y, G.me.dir);
        G.ow.surf = !!G.me.surf;
        G.net.sendMove(false);
        if (G.isNew) intro();
        else G.say([[`${G.josa(G.me.name, '이/가')} 돌아왔다!`], [`지금 시간은 ${G.todName()}입니다.`]]);
      } else if (prev && JSON.stringify(prev.flags) !== JSON.stringify(G.me.flags) && !G.inScript()) G.refreshObjects();
      break;
    }
    case 'players': G.setOthers(msg.list, msg.you); break;
    case 'pmove': G.moveOther(msg.p, msg.step); break;
    case 'say':
      if (msg.toast) { G.toast(msg.text.map((p) => p.join(' ')).join(' ')); break; }
      later(() => G.say(msg.text));
      break;
    case 'script': later(() => G.onScript(msg)); break;
    case 'objects': G.onObjects(msg); break;
    case 'battle': G.onBattle(msg); break;
    case 'battleEnd': G.onBattleEnd(msg); break;
    case 'battleError': G.toast(msg.text); if (G.battle) { G.battle.promptShown = null; G.battle.feed([], msg.view); } break;
    case 'warp': later(() => G.teleport(msg.map, msg.x, msg.y, msg.dir, msg.fade)); break;
    case 'post': later(async () => { for (const it of msg.post) await G.postItem(it); }); break;
    case 'mart': G.openMart(msg.items); break;
    case 'bought': break;
    case 'needSlot': later(async () => {
      await G.say([[`${G.josa(G.me.party.find((m) => m.uid === msg.uid).name, '은/는')} 기술을 4개 알고 있다!`]]);
      if (!await G.yesno(`다른 기술을 잊게 하고 ${G.josa(msg.moveName, '을/를')} 배우게 하겠습니까?`)) return;
      const i = await G.choose(msg.moves, { x: 40, y: 32, w: 120, rows: msg.moves.length });
      if (i >= 0) G.net.send({ t: 'useItem', item: msg.item, uid: msg.uid, slot: i });
    }); break;
    case 'evolved': later(async () => { await G.evolutionScene(G.me.party.find((m) => m.name === msg.name) ? G.me.party.find((m) => m.name === msg.name).species : msg.from, msg.from, msg.name, msg.into); }); break;
    case 'asked': G.incoming.push(msg); break;
    case 'trade': G.tradeState = msg; if (!G.tradeScr || !G.ui.includes(G.tradeScr)) { G.closeAllUI(); G.tradeScr = null; G.tradeScreen(); } break;
    case 'tradeEnd': G.tradeState = null; G.say(msg.text || '교환이 끝났다.'); break;
    case 'tradeDone': G.tradeState = null; later(async () => {
      await G.say([[`${G.josa(msg.gave.name, '을/를')} 보내고`], [`${G.josa(msg.got.name, '을/를')} 받았다!`]]);
      if (msg.evo) { await G.say(msg.evo); }
    }); break;
    case 'mission': onMission(msg); break;
    case 'chat': addChat(msg.name, msg.text); break;
    case 'kicked': G.kicked = true; alert(msg.text); break;
    case 'error': alert(msg.text); break;
    default: break;
  }
}

function onMission(msg) {
  if (msg.kind === 'start') {
    later(async () => {
      await G.say([[`★ 새 미션: ${msg.title}`], ...(msg.text || [])]);
      const cur = G.me && G.me.mission && G.me.mission.cur;
      if (cur) G.toast(`미션 목표: ${cur.goals.filter((g) => !g.done).map((g) => g.text).join(' / ')}`);
    });
  } else if (msg.kind === 'goal') {
    G.toast(`✔ ${msg.by ? msg.by + '이(가) ' : ''}${msg.goal}`);
    if (msg.text) later(() => G.say(msg.text));
  } else if (msg.kind === 'done') {
    G.sfx('level');
    later(() => G.say([[`★ 미션 완료! ${msg.title}`], ...(msg.text || [])]));
  }
}

async function intro() {
  G.ow.locked = 600;
  await G.say([['포켓몬스터 골드에 어서 오세요!'], ['이 세계에는 포켓몬이라고 불리는', '신기한 생물이 살고 있단다.'], [`${G.josa(G.me.name, '이/가')} 사는 곳은 조토 지방의`, '연두마을!'], ['먼저 공박사님 연구소에 가서', '포켓몬을 받아 보렴.'], ['조작: 방향키 이동, Z 결정, X 취소', 'Enter 메뉴, X 누르고 달리기'], ['옆 컴퓨터의 친구도 같은 주소로', '들어오면 같은 세계에서 만나요!']]);
  G.ow.locked = 0;
}

// ───────── 화면 ─────────
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
function fit() {
  const wrap = document.getElementById('wrap');
  const pad = document.getElementById('pad');
  const padH = pad && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight : 0;
  // 위아래에 여백을 두고 가운데에 놓는다 (화면 테두리에 붙지 않게)
  const availW = window.innerWidth - 24, availH = window.innerHeight - 40 - padH;
  const s = Math.max(1, Math.floor(Math.min(availW / 160, availH / 144)));
  const s2 = Math.min(availW / 160, availH / 144);
  const scale = s >= 2 ? s : Math.max(1, s2);
  canvas.style.width = `${160 * scale}px`;
  canvas.style.height = `${144 * scale}px`;
  wrap.style.height = `${Math.max(144 * scale + 40, window.innerHeight - padH)}px`;
  // 화면에 보이는 크기 그대로 그려서 글자가 번지지 않게 (도트는 그대로 크게)
  G.R = Math.max(1, Math.round(scale * (window.devicePixelRatio || 1)));
  canvas.width = 160 * G.R;
  canvas.height = 144 * G.R;
}
window.addEventListener('resize', fit);

let lastT = performance.now(), acc = 0;
function loop(t) {
  requestAnimationFrame(loop);
  acc += Math.min(100, t - lastT);
  lastT = t;
  while (acc >= 1000 / 60) {
    acc -= 1000 / 60;
    tick();
  }
  draw();
}
function tick() {
  const waiters = G.frameWaiters; G.frameWaiters = [];
  for (const w of waiters) w();
  if (G.waitingBattle > 0) G.waitingBattle--;
  if (G.battle && G.battle.closed) G.battle = null;
  G.updateFade();
  const top = G.top();
  if (top && top.update) top.update();
  else if (!G.battle && G.me) G.updateOverworld();
  if (G.battle && !G.battle.closed && top === undefined) { /* 배틀 진행은 비동기 */ }
  if (G.me && !G.battle && !G.uiBusy()) G.handleAsked();
  G.endFrameInput();
}
function draw() {
  if (!G.W) return;
  ctx.setTransform(G.R || 1, 0, 0, G.R || 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (G.battle && !G.battle.closed) G.battle.draw(ctx);
  else G.drawOverworld(ctx);
  if (G.showMonPreview) { const c = G.picCanvas(G.W.species[G.showMonPreview].front); if (c) { G.box(ctx, 44, 8, 72, 72); ctx.drawImage(c, 52 + (56 - c.width) / 2, 16 + 56 - c.height); } }
  for (const s of G.ui) if (s.draw) s.draw(ctx);
  G.drawFade(ctx);
  G.drawToasts(ctx);
}

// ───────── 대화창(채팅) ─────────
const chatLog = document.getElementById('chat-log');
const chatInput = document.getElementById('chat-input');
function addChat(name, text) {
  const div = document.createElement('div');
  div.textContent = `${name}: ${text}`;
  chatLog.appendChild(div);
  while (chatLog.children.length > 30) chatLog.removeChild(chatLog.firstChild);
  chatLog.scrollTop = chatLog.scrollHeight;
  G.toast(`${name}: ${text}`);
}
chatInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') { const v = chatInput.value.trim(); if (v) G.net.send({ t: 'chat', text: v }); chatInput.value = ''; chatInput.blur(); }
  if (e.key === 'Escape') chatInput.blur();
});
window.addEventListener('keydown', (e) => { if (e.code === 'KeyT' && !G.typing() && G.me) { e.preventDefault(); chatInput.focus(); } });
// 채팅 칸에 커서가 남아 있어서 방향키가 안 먹는 일이 없도록
chatInput.addEventListener('keydown', (e) => { if (/^Arrow/.test(e.key) && !chatInput.value) chatInput.blur(); });
canvas.addEventListener('mousedown', () => { if (G.typing()) document.activeElement.blur(); });

// ───────── 터치 버튼 ─────────
for (const b of document.querySelectorAll('#pad [data-k]')) {
  const k = b.dataset.k;
  const down = (e) => { e.preventDefault(); G.press(k); b.classList.add('on'); };
  const up = (e) => { e.preventDefault(); G.release(k); b.classList.remove('on'); };
  b.addEventListener('touchstart', down, { passive: false }); b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
  b.addEventListener('mousedown', down); b.addEventListener('mouseup', up); b.addEventListener('mouseleave', up);
}

// ───────── 처음 화면 (이름 입력) ─────────
let look = 0;
G.showLogin = (saves) => {
  const list = document.getElementById('saves');
  list.innerHTML = '';
  for (const s of saves || []) {
    const b = document.createElement('button');
    b.className = 'save';
    b.textContent = `${s.name} — 배지 ${s.badges}개 · 포켓몬 ${s.party}마리`;
    b.onclick = () => { document.getElementById('name').value = s.name; start(); };
    list.appendChild(b);
  }
  document.getElementById('saves-title').classList.toggle('hidden', !(saves && saves.length));
};
for (const b of document.querySelectorAll('.look')) b.onclick = () => { look = +b.dataset.look; for (const x of document.querySelectorAll('.look')) x.classList.toggle('sel', x === b); };
document.getElementById('start').onclick = start;
document.getElementById('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });
let started = false;
function start() {
  const name = document.getElementById('name').value.trim();
  if (!name) { document.getElementById('name').focus(); return; }
  if (started) return;
  started = true;
  try { localStorage.setItem('pkgold-name', name); } catch { /* 저장 안 됨 */ }
  document.getElementById('start').textContent = '불러오는 중…';
  if (G.preWs) { G.preWs.onclose = null; G.preWs.close(); }
  connect(name, look);
}

/** 하트골드 그림 목록 (서버가 처음 켤 때 준비하므로 늦게 생길 수 있음) */
async function loadHg() {
  try {
    const r = await fetch('/hgss/manifest.json');
    if (r.ok) { G.hg = await r.json(); for (const id of [G.hg.player.hero, G.hg.player.heroine]) G.hgImg(`ow/${id}.png`); return; }
  } catch { /* 아직 */ }
  setTimeout(loadHg, 15000);
}

async function boot() {
  fit();
  try { document.getElementById('name').value = localStorage.getItem('pkgold-name') || ''; } catch { /* 없음 */ }
  await document.fonts.load('10px Galmuri9').catch(() => {});
  const res = await fetch('/world.json');
  G.W = await res.json();
  G.LANDMARKS = G.W.ko.landmarks;
  loadHg();
  await G.preload([G.W.sprites[1].file, G.W.sprites[2] && G.W.sprites[2].file, G.W.ui.playerBack, G.W.tilesets[1].png]);
  // 저장 목록 받기
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}`);
  G.preWs = ws;
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.t === 'hi') { G.showLogin(m.saves); ws.close(); } };
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('login-form').classList.remove('hidden');
  requestAnimationFrame(loop);
}
boot().catch((e) => { document.getElementById('loading').textContent = '불러오지 못했습니다: ' + e.message; });
})();
