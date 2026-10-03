'use strict';
// 정령섬 온라인 서버: 정적 파일 + WebSocket 방(로비) + 게임 진행
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { exec } = require('child_process');
const { WebSocketServer } = require('ws');
const { Game, PIECE_NAMES, ELEMENT_NAMES, growthLabel } = require('./game/game');
const { SPIRITS } = require('./game/spirits');
const { POWERS } = require('./game/powers');
const { FEAR_CARDS } = require('./game/fear');
const { TERRAIN_NAMES } = require('./game/boards');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const THREE_DIR = path.dirname(path.dirname(require.resolve('three')));
const MAX_PLAYERS = 4;

// ───────────── 정적 데이터(카탈로그) ─────────────
const CATALOG = {
  spirits: SPIRITS.map((s) => ({
    id: s.id, name: s.name, en: s.en, color: s.color, complexity: s.complexity, summary: s.summary,
    growth: s.growth.map((g) => g.actions.map(growthLabel)),
    energyTrack: s.energyTrack, cardTrack: s.cardTrack, special: s.special, setupText: s.setupText, uniques: s.uniques, tip: s.tip || '',
    innates: s.innates.map((i) => ({ id: i.id, name: i.name, speed: i.speed, target: i.target, levels: i.levels })),
  })),
  powers: Object.fromEntries(POWERS.map((p) => [p.id, {
    id: p.id, name: p.name, en: p.en, cost: p.cost, speed: p.speed, kind: p.kind, elements: p.elements, target: p.target, text: p.text, threshold: p.threshold || null,
  }])),
  fear: FEAR_CARDS.map((f) => ({ id: f.id, name: f.name, levels: f.levels.map((l) => l.text) })),
  pieces: PIECE_NAMES,
  elements: ELEMENT_NAMES,
  terrains: TERRAIN_NAMES,
};

// ───────────── HTTP ─────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  let p = decodeURIComponent(url.pathname);
  // 3D 지도용 three.js 를 node_modules 에서 제공
  if (p.startsWith('/vendor/three/')) {
    const rel = p.slice('/vendor/three/'.length);
    const file = path.normalize(path.join(THREE_DIR, rel));
    if (!file.startsWith(THREE_DIR) || !/^(build|examples[\\/]jsm)[\\/]/.test(path.relative(THREE_DIR, file))) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
      res.end(data);
    });
    return;
  }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ───────────── 방 관리 ─────────────
/** @type {Map<string, any>} */
const rooms = new Map();
/** token -> { roomCode, playerId } */
const sessions = new Map();

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join(''); } while (rooms.has(code));
  return code;
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function roomInfo(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    started: !!room.game,
    players: room.players.map((p) => ({ id: p.id, name: p.name, spiritId: p.spiritId, connected: !!(p.ws && p.ws.readyState === 1) })),
    chat: room.chat.slice(-50),
  };
}

function broadcastRoom(room) {
  const info = roomInfo(room);
  for (const p of room.players) send(p.ws, { t: 'room', room: info, you: p.id });
}

function sendState(room, player) {
  if (!room.game) return;
  send(player.ws, { t: 'state', state: room.game.view(), prompt: room.game.currentPrompt(player.id), you: player.id });
}

function broadcastState(room) {
  if (!room.game) return;
  const state = room.game.view();
  for (const p of room.players) send(p.ws, { t: 'state', state, prompt: room.game.currentPrompt(p.id), you: p.id });
}

function startGame(room) {
  const game = new Game(room.players.map((p) => ({ id: p.id, name: p.name, spiritId: p.spiritId })));
  room.game = game;
  game.on('update', () => broadcastState(room));
  broadcastRoom(room);
  game.run().then(() => broadcastState(room));
}

function cleanupRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const anyone = room.players.some((p) => p.ws && p.ws.readyState === 1);
    if (anyone) room.lastActive = now;
    else if (now - room.lastActive > 60 * 60 * 1000) {
      for (const p of room.players) sessions.delete(p.token);
      rooms.delete(code);
    }
  }
}
setInterval(cleanupRooms, 5 * 60 * 1000).unref();

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
      case 'create': {
        if (!token) return fail('먼저 연결하세요.');
        if (room) return fail('이미 방에 있습니다.');
        const name = cleanName(msg.name);
        const code = makeCode();
        const r = { code, hostId: null, players: [], game: null, chat: [], lastActive: Date.now() };
        const p = { id: crypto.randomBytes(6).toString('hex'), name, spiritId: null, token, ws: null };
        r.players.push(p);
        r.hostId = p.id;
        rooms.set(code, r);
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
        if (r.players.length >= MAX_PLAYERS) return fail('방이 가득 찼습니다 (최대 4명).');
        const p = { id: crypto.randomBytes(6).toString('hex'), name: cleanName(msg.name), spiritId: null, token, ws: null };
        r.players.push(p);
        attach(r, p);
        break;
      }
      case 'leave': {
        if (!room || !player) return;
        sessions.delete(token);
        if (!room.game) {
          room.players = room.players.filter((p) => p !== player);
          if (!room.players.length) rooms.delete(room.code);
          else {
            if (room.hostId === player.id) room.hostId = room.players[0].id;
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
      case 'pickSpirit': {
        if (!room || room.game) return;
        const sid = msg.spiritId;
        if (sid !== null && !SPIRITS.some((s) => s.id === sid)) return fail('알 수 없는 정령입니다.');
        if (sid && room.players.some((p) => p !== player && p.spiritId === sid)) return fail('다른 플레이어가 이미 고른 정령입니다.');
        player.spiritId = sid;
        broadcastRoom(room);
        break;
      }
      case 'start': {
        if (!room || room.game) return;
        if (room.hostId !== player.id) return fail('방장만 게임을 시작할 수 있습니다.');
        if (room.players.some((p) => !p.spiritId)) return fail('모든 플레이어가 정령을 골라야 합니다.');
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
        const text = String(msg.text || '').slice(0, 300).trim();
        if (!text) return;
        room.chat.push({ from: player.name, text, at: Date.now() });
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
  return s || '정령' + crypto.randomInt(100, 999);
}

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[오류] ${PORT}번 포트가 이미 사용 중입니다. 정령섬 서버가 이미 켜져 있는지 확인하거나, 다른 포트로 실행하세요 (예: PORT=3001).`);
    if (process.argv.includes('--open')) openBrowser(`http://localhost:${PORT}`);
  } else console.error(err);
  process.exitCode = 1;
});

server.listen(PORT, () => {
  const line = '─'.repeat(52);
  console.log(`\n${line}\n  🌋 정령섬 온라인 서버가 실행되었습니다\n${line}`);
  console.log(`  내 컴퓨터에서 접속   : http://localhost:${PORT}`);
  const lan = lanAddresses();
  if (lan.length) {
    console.log('  같은 와이파이 친구   : ' + lan.map((ip) => `http://${ip}:${PORT}`).join('  또는  '));
  }
  console.log('  멀리 있는 친구       : 새 창에서 "npm run share" 실행 → 나오는 https 주소 공유');
  console.log(`  종료하려면 이 창을 닫거나 Ctrl+C 를 누르세요.\n${line}\n`);
  if (process.argv.includes('--open')) openBrowser(`http://localhost:${PORT}`);
});

module.exports = { server };
