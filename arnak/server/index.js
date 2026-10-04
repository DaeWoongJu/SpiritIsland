'use strict';
// 아르낙 온라인 서버: 정적 파일 + WebSocket 방(로비) + 게임 진행
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { exec } = require('child_process');
const { WebSocketServer } = require('ws');
const { Game, botAnswer } = require('./game/game');
const D = require('./game/data');

const PORT = Number(process.env.PORT) || 3100;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_PLAYERS = 4;
const BOT_DELAY = Number(process.env.BOT_DELAY ?? 900);
const COLORS = ['#e0b040', '#4f9ad8', '#d8584f', '#5fb36a'];
const BOT_NAMES = ['AI 탐험가 로라', 'AI 교수 헨리', 'AI 사냥꾼 카이', 'AI 기자 미나'];

// ───────────── 카탈로그 ─────────────
const cardInfo = (c) => ({ id: c.id, kind: c.kind, name: c.name, cost: c.cost || 0, vp: c.vp, travel: c.travel, text: c.text, free: !!c.free });
const CATALOG = {
  cards: Object.fromEntries(Object.values(D.CARD_MAP).map((c) => [c.id, cardInfo(c)])),
  guardians: Object.fromEntries([...D.GUARDIANS, ...D.EXP_GUARDIANS].map((g) => [g.id, g])),
  assistants: Object.fromEntries([...D.ASSISTANTS, ...D.EXP_ASSISTANTS].map((a) => [a.id, a])),
  leaders: D.LEADERS.map((l) => ({ id: l.id, name: l.name, title: l.title, icon: l.icon, desc: l.desc, card: l.card, power: !!l.power })),
  tracks: Object.values(D.TRACKS).map((t) => ({ id: t.id, name: t.name, desc: t.desc })),
  expansionInfo: { items: D.EXP_ITEMS.length, artifacts: D.EXP_ARTIFACTS.length, guardians: D.EXP_GUARDIANS.length, assistants: D.EXP_ASSISTANTS.length, sites: D.EXP_SITE_TILES_1.length + D.EXP_SITE_TILES_2.length },
  research: D.RESEARCH,
  glassVP: D.GLASS_VP, noteVP: D.NOTE_VP,
  temple: D.TEMPLE_TILES, templeArrival: D.TEMPLE_ARRIVAL_VP,
  idolChoices: D.IDOL_SLOT_CHOICES, idolVP: D.IDOL_VP, idolPlacedVP: D.IDOL_PLACED_VP, guardianVP: D.GUARDIAN_VP,
  resNames: D.RES_NAMES, travelNames: D.TRAVEL_NAMES, rounds: D.ROUNDS, startRes: D.START_RES,
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
    players: room.players.map((p, i) => ({ id: p.id, name: p.name, bot: !!p.bot, leader: p.leader || null, color: COLORS[i], connected: p.bot || !!(p.ws && p.ws.readyState === 1) })),
    chat: room.chat.slice(-50), maxPlayers: MAX_PLAYERS,
  };
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

function startGame(room) {
  // 차례 순서는 방에 들어온 순서 그대로 (첫 플레이어가 시작, 뒤 플레이어는 시작 자원이 조금 더 많음)
  const game = new Game(room.players.map((p) => ({ id: p.id, name: p.name, bot: !!p.bot, leader: p.leader || null })), { settings: room.settings });
  room.game = game;
  room.botTimers = {};
  game.on('update', () => broadcastState(room));
  broadcastRoom(room);
  game.run().then(() => broadcastState(room)).catch((e) => console.error(e));
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
  const r = { code, hostId: null, players: [], game: null, chat: [], lastActive: Date.now(), settings: { leaders: false, expansion: false, track: 'bird' }, ...extra };
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
        send(ws, { t: 'welcome', token, catalog: CATALOG, lan: lanAddresses().map((ip) => `http://${ip}:${PORT}`) });
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
      case 'join': {
        if (!token) return fail('먼저 연결하세요.');
        if (room) return fail('이미 방에 있습니다.');
        const code = String(msg.code || '').trim().toUpperCase();
        const r = rooms.get(code);
        if (!r) return fail('방을 찾을 수 없습니다: ' + code);
        if (r.game) return fail('이미 게임이 시작된 방입니다.');
        if (r.players.length >= MAX_PLAYERS) return fail(`방이 가득 찼습니다 (최대 ${MAX_PLAYERS}명).`);
        const p = { id: crypto.randomBytes(6).toString('hex'), name: cleanName(msg.name), token, ws: null };
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
        const i = room.players.findIndex((p) => p.id === msg.id);
        const j = i + (msg.dir === 'up' ? -1 : 1);
        if (i < 0 || j < 0 || j >= room.players.length) return;
        [room.players[i], room.players[j]] = [room.players[j], room.players[i]];
        broadcastRoom(room);
        break;
      }
      case 'setSettings': {
        if (!room || room.game) return;
        if (room.hostId !== player.id) return fail('방장만 설정을 바꿀 수 있습니다.');
        const st = msg.settings || {};
        if (typeof st.leaders === 'boolean') room.settings.leaders = st.leaders;
        if (typeof st.expansion === 'boolean') room.settings.expansion = st.expansion;
        if (D.TRACKS[st.track]) room.settings.track = st.track;
        broadcastRoom(room);
        break;
      }
      case 'pickLeader': {
        if (!room || room.game) return;
        const id = msg.leader === null || D.LEADERS.some((l) => l.id === msg.leader) ? msg.leader : undefined;
        if (id === undefined) return;
        // 방장은 AI의 대장도 정할 수 있다
        const target = msg.target && room.hostId === player.id ? room.players.find((x) => x.id === msg.target && x.bot) : player;
        if (!target) return;
        if (id && room.players.some((x) => x !== target && x.leader === id)) return fail('다른 사람이 이미 고른 탐험대장입니다.');
        target.leader = id;
        broadcastRoom(room);
        break;
      }
      case 'start': {
        if (!room || room.game) return;
        if (room.hostId !== player.id) return fail('방장만 게임을 시작할 수 있습니다.');
        startGame(room);
        break;
      }
      case 'answer': {
        if (!room || !room.game || !player) return;
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
  return s || '탐험가' + crypto.randomInt(100, 999);
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
    console.error(`\n[오류] ${PORT}번 포트가 이미 사용 중입니다. 아르낙 서버가 이미 켜져 있는지 확인하세요.`);
    if (process.argv.includes('--open')) openBrowser(`http://localhost:${PORT}`);
  } else console.error(err);
  process.exitCode = 1;
});

server.listen(PORT, () => {
  const line = '─'.repeat(52);
  console.log(`\n${line}\n  🗿 아르낙 온라인 서버가 실행되었습니다\n${line}`);
  console.log(`  내 컴퓨터에서 접속   : http://localhost:${PORT}`);
  const lan = lanAddresses();
  if (lan.length) console.log('  같은 와이파이 친구   : ' + lan.map((ip) => `http://${ip}:${PORT}`).join('  또는  '));
  console.log('  멀리 있는 친구       : 새 창에서 "npm run share:arnak" 실행 → 나오는 https 주소 공유');
  console.log(`  종료하려면 이 창을 닫거나 Ctrl+C 를 누르세요.\n${line}\n`);
  if (process.argv.includes('--open')) openBrowser(`http://localhost:${PORT}`);
});

module.exports = { server };
