'use strict';
// 히어로 챔피언스 서버: 정적 파일 + WebSocket 방(로비) + 게임 진행 (협력 카드게임)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { exec } = require('child_process');
const { WebSocketServer } = require('ws');
const { Game, botAnswer } = require('./game/game');
const D = require('./game/data');
const savegame = require('../../shared/savegame');

const saves = savegame.store('champions');

const PORT = Number(process.env.PORT) || 3200;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_PLAYERS = 4;
const BOT_DELAY = Number(process.env.BOT_DELAY ?? 900);
const COLORS = ['#f0c020', '#3a8ad8', '#e04848', '#3ab86a'];
const BOT_NAMES = ['AI 동료 하나', 'AI 동료 두리', 'AI 동료 세찬', 'AI 동료 네오'];

// ───────────── 카탈로그 ─────────────
const strip = (o) => JSON.parse(JSON.stringify(o)); // 함수(효과)는 빼고 보냄
const CATALOG = {
  heroes: D.HEROES.map((h) => strip(h)),
  aspects: D.ASPECTS,
  cards: Object.fromEntries(D.PLAYER_CARDS.map((c) => [c.id, strip({ ...c, effect: undefined, action: c.action ? { ...c.action, effect: undefined } : undefined })])),
  encounter: Object.fromEntries(D.ENCOUNTER.map((e) => [e.id, strip({ ...e, reveal: undefined, onEnter: undefined })])),
  villains: D.VILLAINS.map((v) => strip(v)),
  packs: D.PACKS,
  difficulties: D.DIFFICULTIES,
  resNames: D.RES_NAMES, resIcon: D.RES_ICON, allyLimit: D.ALLY_LIMIT,
  decks: Object.fromEntries(D.HEROES.flatMap((h) => Object.keys(D.ASPECTS).map((a) => [`${h.id}:${a}`, D.buildDeck(h.id, a)]))),
  colors: COLORS,
};

// ───────────── HTTP ─────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ───────────── 방 ─────────────
const rooms = new Map();
const sessions = new Map(); // token → { roomCode, playerId }

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join(''); } while (rooms.has(code));
  return code;
}

function send(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }

function roomInfo(room) {
  return {
    code: room.code, hostId: room.hostId, started: !!room.game, solo: !!room.solo, settings: room.settings,
    loading: !!room.loading, resume: room.resume ? resumeInfo(room) : null,
    players: room.players.map((p, i) => ({ id: p.id, name: p.name, bot: !!p.bot, hero: p.hero || null, aspect: p.aspect || null, color: COLORS[i], connected: p.bot || !!(p.ws && p.ws.readyState === 1) })),
    chat: room.chat.slice(-50), maxPlayers: MAX_PLAYERS,
  };
}

/** 이어하기 대기실 정보: 저장된 자리와 누가 앉았는지 (AI 자리는 자동) */
function resumeInfo(room) {
  const sv = room.resume;
  return {
    id: sv.id, savedAt: sv.savedAt, summary: sv.summary,
    slots: sv.roster.map((s) => ({ ...s, taken: !s.bot && room.players.some((p) => p.id === s.id) })),
  };
}

/** 지금 게임을 파일로 저장 (선택할 때마다 자동으로) */
function saveNow(room) {
  const g = room.game;
  if (!g || g.result || room.loading || !room.saveId) return;
  clearTimeout(room.saveTimer);
  saves.write({ v: 1, id: room.saveId, savedAt: Date.now(), seed: g.seed, settings: room.settings, roster: room.roster, history: g.history, summary: { round: g.round, heroes: g.players.map((x) => x.hero), villain: room.settings.villain, difficulty: room.settings.difficulty } });
}
function scheduleSave(room) {
  clearTimeout(room.saveTimer);
  room.saveTimer = setTimeout(() => saveNow(room), 300);
}
/** 이어하기 대기실에서 내 자리 정하기: 이름이 같은 빈자리 → 아무 빈자리 */
function freeSlot(room, name, except) {
  const free = room.resume.roster.filter((s) => !s.bot && s.id !== except && !room.players.some((p) => p.id === s.id));
  return free.find((s) => s.name === name) || free[0] || null;
}
function sitAt(room, player, slot) {
  if (room.hostId === player.id) room.hostId = slot.id;
  player.id = slot.id;
  if (player.token) sessions.set(player.token, { roomCode: room.code, playerId: slot.id });
}

function broadcastRoom(room) {
  const info = roomInfo(room);
  for (const p of room.players) if (!p.bot) send(p.ws, { t: 'room', room: info, you: p.id });
}

function sendState(room, p) {
  if (!room.game || p.bot) return;
  send(p.ws, { t: 'state', state: room.game.view(p.id), prompt: room.game.currentPrompt(p.id) });
}

function broadcastState(room) {
  if (!room.game) return;
  for (const p of room.players) sendState(room, p);
  scheduleBots(room);
}

/** 봇 차례면 잠시 뒤 자동으로 응답 */
function scheduleBots(room) {
  const g = room.game;
  if (!g || g.result) return;
  room.botTimers ||= {};
  for (const p of room.players) {
    if (!p.bot) continue;
    const pr = g.currentPrompt(p.id);
    if (!pr || room.botTimers[p.id] === pr.id) continue;
    room.botTimers[p.id] = pr.id;
    const delay = pr.kind === 'turn' ? BOT_DELAY : BOT_DELAY / 2;
    setTimeout(() => {
      if (room.game !== g) return;
      const cur = g.currentPrompt(p.id);
      if (!cur || cur.id !== pr.id) return;
      const err = g.answer(p.id, cur.id, botAnswer(g, p.id, cur));
      if (err) console.error('봇 응답 오류:', err);
    }, delay);
  }
}

async function startGame(room) {
  // 차례 순서는 방에 들어온 순서 그대로 (첫 플레이어가 시작, 뒤 플레이어는 시작 자원이 조금 더 많음)
  if (!room.resume) {
    // 영웅을 안 고른 사람은 남은 영웅 중 무작위
    const taken = new Set(room.players.map((p) => p.hero).filter(Boolean));
    for (const p of room.players) {
      if (!p.hero) { const free = D.HEROES.filter((h) => !taken.has(h.id)); p.hero = free[crypto.randomInt(free.length)].id; taken.add(p.hero); }
      if (!p.aspect) { const as = Object.keys(D.ASPECTS); p.aspect = as[crypto.randomInt(as.length)]; }
    }
  }
  const sv = room.resume;
  if (sv) {
    // 이어하기: 저장된 순서 그대로. 아무도 앉지 않은 사람 자리는 AI가 대신 진행
    room.settings = sv.settings;
    const humans = new Map(room.players.filter((p) => !p.bot).map((p) => [p.id, p]));
    room.players = sv.roster.map((s) => humans.get(s.id) || { ...s, bot: true, sub: !s.bot });
    room.roster = sv.roster;
  } else room.roster = room.players.map((p) => ({ id: p.id, name: p.name, bot: !!p.bot, hero: p.hero, aspect: p.aspect }));
  const game = new Game(room.roster, { settings: room.settings, seed: sv ? sv.seed : undefined });
  room.game = game;
  room.botTimers = {};
  room.saveId = sv ? sv.id : savegame.newSaveId(room.code);
  room.resume = null;
  savegame.record(game, () => scheduleSave(room));
  game.run().then(() => {
    if (room.game !== game) return;
    if (game.result && room.saveId) { clearTimeout(room.saveTimer); saves.remove(room.saveId); }
    broadcastState(room);
  }).catch((e) => console.error(e));
  if (sv) {
    room.loading = true;
    broadcastRoom(room);
    const r = await savegame.replay(game, sv.history || []);
    room.loading = false;
    if (room.game !== game) return;
    if (!r.ok) room.chat.push({ name: '안내', text: `저장 기록 일부(${r.at + 1}번째 선택부터)를 되살리지 못해 그 시점부터 이어서 진행합니다.`, at: Date.now() });
    game.log('💾 저장된 게임을 불러왔습니다. 이어서 진행합니다.');
    saveNow(room);
  }
  game.on('update', () => broadcastState(room));
  broadcastRoom(room);
  broadcastState(room);
}

function cleanupRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const anyone = room.players.some((p) => !p.bot && p.ws && p.ws.readyState === 1);
    if (anyone) room.lastActive = now;
    else if (now - room.lastActive > 60 * 60 * 1000) {
      for (const p of room.players) if (p.token) sessions.delete(p.token);
      if (room.game) room.game.removeAllListeners();
      rooms.delete(code);
    }
  }
}
setInterval(cleanupRooms, 5 * 60 * 1000).unref();

function newRoom(extra = {}) {
  const code = makeCode();
  const r = { code, hostId: null, players: [], game: null, chat: [], lastActive: Date.now(), settings: { villain: 'sonix', difficulty: 'easy' }, ...extra };
  rooms.set(code, r);
  return r;
}

function addBot(room) {
  const used = new Set(room.players.map((p) => p.name));
  const name = BOT_NAMES.find((n) => !used.has(n)) || `AI ${room.players.length + 1}`;
  room.players.push({ id: 'bot-' + crypto.randomBytes(4).toString('hex'), name, bot: true });
}

// ───────────── WebSocket ─────────────
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let token = null;
  let room = null;
  let player = null;
  const fail = (msg) => send(ws, { t: 'error', msg });

  const attach = (r, p) => {
    room = r;
    player = p;
    if (p.ws && p.ws !== ws) { try { p.ws.close(); } catch { /* ignore */ } }
    p.ws = ws;
    sessions.set(token, { roomCode: r.code, playerId: p.id });
    r.lastActive = Date.now();
    broadcastRoom(r);
    sendState(r, p);
  };

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    switch (msg.t) {
      case 'hello': {
        token = typeof msg.token === 'string' && msg.token.length >= 16 ? msg.token : crypto.randomBytes(16).toString('hex');
        send(ws, { t: 'welcome', token, catalog: CATALOG, lan: lanAddresses().map((ip) => `http://${ip}:${PORT}`), saves: saves.list() });
        const sess = sessions.get(token);
        if (sess && rooms.has(sess.roomCode)) {
          const r = rooms.get(sess.roomCode);
          const p = r.players.find((x) => x.id === sess.playerId);
          if (p) attach(r, p);
        }
        break;
      }
      case 'create': case 'solo': {
        if (!token) return fail('먼저 연결하세요.');
        if (room) return fail('이미 방에 있습니다.');
        const r = newRoom({ solo: msg.t === 'solo' });
        const p = { id: crypto.randomBytes(6).toString('hex'), name: cleanName(msg.name), token, ws: null };
        r.players.push(p);
        r.hostId = p.id;
        if (msg.t === 'solo') {
          const n = Math.max(0, Math.min(3, Number(msg.bots) || 0));
          for (let i = 0; i < n; i++) addBot(r);
        }
        attach(r, p);
        break;
      }
      case 'listSaves': {
        send(ws, { t: 'saves', list: saves.list() });
        break;
      }
      case 'deleteSave': {
        if (room) return;
        saves.remove(msg.id);
        send(ws, { t: 'saves', list: saves.list() });
        break;
      }
      case 'resume': {
        // 저장된 게임으로 새 방을 만들고 대기실에서 친구들을 기다림
        if (!token) return fail('먼저 연결하세요.');
        if (room) return fail('이미 방에 있습니다.');
        const sv = saves.load(msg.id);
        if (!sv || !Array.isArray(sv.roster) || !sv.roster.some((s) => !s.bot)) return fail('저장된 게임을 찾을 수 없습니다.');
        const r = newRoom({ resume: sv, settings: sv.settings });
        const name = cleanName(msg.name);
        const slot = freeSlot(r, name);
        const p = { id: slot.id, name, token, ws: null };
        r.players.push(p);
        r.hostId = p.id;
        attach(r, p);
        break;
      }
      case 'claimSlot': {
        if (!room || room.game || !room.resume) return;
        const slot = room.resume.roster.find((s) => s.id === msg.slot && !s.bot);
        if (!slot || room.players.some((p) => p.id === slot.id)) return fail('이미 누가 앉은 자리입니다.');
        sitAt(room, player, slot);
        broadcastRoom(room);
        break;
      }
      case 'cancelResume': {
        if (!room || room.game || !room.resume) return;
        if (room.hostId !== player.id) return fail('방장만 할 수 있습니다.');
        room.resume = null;
        broadcastRoom(room);
        break;
      }
      case 'quitGame': {
        // 게임 도중 그만두기: 저장하고 대기실로 (나중에 '이어하기'로 계속)
        if (!room || !room.game) return;
        if (room.hostId !== player.id) return fail('방장만 게임을 그만둘 수 있습니다.');
        if (room.loading) return fail('불러오는 중입니다. 잠시 후 다시 시도하세요.');
        const g = room.game;
        const savable = !g.result;
        if (savable) saveNow(room);
        clearTimeout(room.saveTimer);
        g.removeAllListeners();
        room.game = null;
        const sv = savable ? saves.load(room.saveId) : null;
        // AI가 대신하던 자리, 완전히 떠난 사람은 정리
        room.players = room.players.filter((p) => !p.sub && (p.id === room.hostId || p.bot || sessions.has(p.token)));
        if (sv) {
          room.resume = sv;
          room.players = room.players.filter((p) => !p.bot);
          room.chat.push({ name: '안내', text: `게임을 저장했습니다 (${g.round}라운드). '저장된 게임 이어하기'로 계속할 수 있어요.`, at: Date.now() });
        }
        broadcastRoom(room);
        break;
      }
      case 'join': {
        if (!token) return fail('먼저 연결하세요.');
        if (room) return fail('이미 방에 있습니다.');
        const code = String(msg.code || '').trim().toUpperCase();
        const r = rooms.get(code);
        if (!r) return fail('방을 찾을 수 없습니다: ' + code);
        if (r.game) return fail('이미 게임이 시작된 방입니다.');
        if (r.players.length >= MAX_PLAYERS) return fail(`방이 가득 찼습니다 (최대 ${MAX_PLAYERS}명).`);
        const p = { id: crypto.randomBytes(6).toString('hex'), name: cleanName(msg.name), token, ws: null };
        if (r.resume) {
          const slot = freeSlot(r, p.name);
          if (!slot) return fail('저장된 게임의 자리가 모두 찼습니다.');
          p.id = slot.id;
        }
        r.players.push(p);
        attach(r, p);
        break;
      }
      case 'leave': {
        if (!room || !player) return;
        sessions.delete(token);
        if (!room.game) {
          room.players = room.players.filter((p) => p !== player);
          if (!room.players.some((p) => !p.bot)) rooms.delete(room.code);
          else {
            if (room.hostId === player.id) room.hostId = room.players.find((p) => !p.bot).id;
            broadcastRoom(room);
          }
        } else {
          player.ws = null;
          broadcastRoom(room);
        }
        room = null;
        player = null;
        send(ws, { t: 'left' });
        break;
      }
      case 'addBot': case 'removeBot': {
        if (!room || room.game) return;
        if (room.resume) return fail('저장된 게임을 이어하는 중에는 바꿀 수 없습니다.');
        if (room.hostId !== player.id) return fail('방장만 할 수 있습니다.');
        if (msg.t === 'addBot') {
          if (room.players.length >= MAX_PLAYERS) return fail(`최대 ${MAX_PLAYERS}명입니다.`);
          addBot(room);
        } else room.players = room.players.filter((p) => !(p.bot && p.id === msg.id));
        broadcastRoom(room);
        break;
      }
      case 'move': {
        // 차례 순서 바꾸기 (방장)
        if (!room || room.game || room.hostId !== player.id) return;
        if (room.resume) return fail('저장된 게임을 이어하는 중에는 바꿀 수 없습니다.');
        const i = room.players.findIndex((p) => p.id === msg.id);
        const j = i + (msg.dir === 'up' ? -1 : 1);
        if (i < 0 || j < 0 || j >= room.players.length) return;
        [room.players[i], room.players[j]] = [room.players[j], room.players[i]];
        broadcastRoom(room);
        break;
      }
      case 'setSettings': {
        if (!room || room.game) return;
        if (room.resume) return fail('저장된 게임을 이어하는 중에는 바꿀 수 없습니다.');
        if (room.hostId !== player.id) return fail('방장만 설정을 바꿀 수 있습니다.');
        const st = msg.settings || {};
        if (D.VILLAINS.some((v) => v.id === st.villain)) room.settings.villain = st.villain;
        if (D.DIFFICULTIES.some((d) => d.id === st.difficulty)) room.settings.difficulty = st.difficulty;
        broadcastRoom(room);
        break;
      }
      case 'pickHero': {
        if (!room || room.game) return;
        if (room.resume) return fail('저장된 게임을 이어하는 중에는 바꿀 수 없습니다.');
        const target = msg.target && room.hostId === player.id ? room.players.find((x) => x.id === msg.target && x.bot) : player;
        if (!target) return;
        if (msg.hero !== undefined) {
          if (msg.hero !== null && !D.HEROES.some((h) => h.id === msg.hero)) return;
          if (msg.hero && room.players.some((x) => x !== target && x.hero === msg.hero)) return fail('다른 사람이 이미 고른 영웅입니다.');
          target.hero = msg.hero;
        }
        if (msg.aspect !== undefined && (msg.aspect === null || D.ASPECTS[msg.aspect])) target.aspect = msg.aspect;
        broadcastRoom(room);
        break;
      }
      case 'start': {
        if (!room || room.game) return;
        if (room.hostId !== player.id) return fail('방장만 게임을 시작할 수 있습니다.');
        if (room.loading) return;
        startGame(room);
        break;
      }
      case 'answer': {
        if (!room || !room.game || !player || room.loading) return;
        const err = room.game.answer(player.id, msg.promptId, msg.value);
        if (err) { fail(err); sendState(room, player); }
        break;
      }
      case 'backToLobby': {
        if (!room || !room.game) return;
        if (room.hostId !== player.id) return fail('방장만 할 수 있습니다.');
        if (!room.game.result) return fail('게임이 아직 끝나지 않았습니다.');
        room.game.removeAllListeners();
        room.game = null;
        broadcastRoom(room);
        break;
      }
      case 'chat': {
        if (!room || !player) return;
        const text = String(msg.text || '').slice(0, 200).trim();
        if (!text) return;
        room.chat.push({ name: player.name, text, at: Date.now() });
        if (room.chat.length > 100) room.chat.shift();
        broadcastRoom(room);
        break;
      }
      default:
    }
  });

  ws.on('close', () => {
    if (room && player && player.ws === ws) {
      player.ws = null;
      broadcastRoom(room);
    }
  });
});

function cleanName(name) {
  const s = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return s || '히어로' + crypto.randomInt(100, 999);
}

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  return out;
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[오류] ${PORT}번 포트가 이미 사용 중입니다. 히어로 챔피언스 서버가 이미 켜져 있는지 확인하세요.`);
    if (process.argv.includes('--open')) openBrowser(`http://localhost:${PORT}`);
  } else console.error(err);
  process.exitCode = 1;
});

server.listen(PORT, () => {
  const line = '─'.repeat(52);
  console.log(`\n${line}\n  🦸 히어로 챔피언스 서버가 실행되었습니다\n${line}`);
  console.log(`  내 컴퓨터에서 접속   : http://localhost:${PORT}`);
  const lan = lanAddresses();
  if (lan.length) console.log('  같은 와이파이 친구   : ' + lan.map((ip) => `http://${ip}:${PORT}`).join('  또는  '));
  console.log('  멀리 있는 친구       : 새 창에서 "npm run share:champions" 실행 → 나오는 https 주소 공유');
  console.log(`  종료하려면 이 창을 닫거나 Ctrl+C 를 누르세요.\n${line}\n`);
  if (process.argv.includes('--open')) openBrowser(`http://localhost:${PORT}`);
});

module.exports = { server };
