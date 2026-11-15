'use strict';
// 요괴 퇴마 디펜스 서버: 정적 파일 + WebSocket 방(로비) + 실시간 게임 진행
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { exec } = require('child_process');
const { WebSocketServer } = require('ws');
const { Game, DT } = require('./game/game');
const D = require('./game/data');
const M = require('./game/maps');

const PORT = Number(process.env.PORT) || 3600;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const THREE_DIR = path.dirname(path.dirname(require.resolve('three')));
const MAX_PLAYERS = 2;
const COLORS = ['#58b8f8', '#f87898'];
const BOT_NAME = 'AI 동료 단비';

// ───────────── 카탈로그 (처음 접속할 때 한 번) ─────────────
const CATALOG = {
  tiers: D.TIERS, units: D.UNITS, cats: D.CATS, enemies: D.ENEMIES, bosses: D.BOSSES, miniboss: D.MINIBOSS, modifiers: D.MODIFIERS,
  leaders: D.LEADERS, blessings: D.BLESSINGS, difficulties: D.DIFFICULTIES, mergeNeed: D.MERGE_NEED, econ: { ...D.ECON, waveBonus: undefined, upgradeCost: undefined },
  summonOdds: D.SUMMON_ODDS, premiumOdds: D.PREMIUM_ODDS, waves: D.WAVES, waveTime: D.WAVE_TIME, bossTime: D.BOSS_TIME,
  themes: M.THEMES, maps: M.MAPS.map(M.summary), colors: COLORS, missions: D.MISSIONS, heroLvDmg: D.HERO_LV_DMG, recipes: D.RECIPES, items: D.ITEMS, story: D.STORY, events: D.EVENTS, storyTime: D.STORY_TIME, eventTime: D.EVENT_TIME,
};

// ───────────── HTTP ─────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  let p = decodeURIComponent(url.pathname);
  // 3D 전장용 three.js 를 node_modules 에서 제공
  if (p.startsWith('/vendor/three/')) {
    const file = path.normalize(path.join(THREE_DIR, p.slice('/vendor/three/'.length)));
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
const humans = (room) => room.players.filter((p) => !p.bot);

function roomInfo(room) {
  return {
    code: room.code, hostId: room.hostId, started: !!room.game, settings: room.settings, paused: room.paused, speed: room.speed,
    players: room.players.map((p, i) => ({ id: p.id, name: p.name, bot: !!p.bot, leader: p.leader || null, color: COLORS[i], connected: p.bot || !!(p.ws && p.ws.readyState === 1) })),
    chat: room.chat.slice(-50), maxPlayers: MAX_PLAYERS,
  };
}
function broadcastRoom(room) {
  const info = roomInfo(room);
  for (const p of humans(room)) send(p.ws, { t: 'room', room: info, you: p.id });
}
function sendStart(room, p) {
  if (!room.game) return;
  send(p.ws, { t: 'start', info: room.game.staticView(), gameNo: room.gameNo, you: p.id });
}

function startGame(room) {
  room.gameNo = (room.gameNo || 0) + 1;
  // 대장을 안 고른 사람은 남은 대장 중 무작위
  const taken = new Set(room.players.map((p) => p.leader).filter(Boolean));
  for (const p of room.players) if (!p.leader) { const free = D.LEADERS.filter((l) => !taken.has(l.id)); p.leader = free[crypto.randomInt(free.length)].id; taken.add(p.leader); }
  const roster = room.players.map((p) => ({ id: p.id, name: p.name, leader: p.leader, bot: !!p.bot }));
  const mapId = room.settings.map === 'pick' ? M.MAPS[crypto.randomInt(M.MAPS.length)].id : room.settings.map;
  room.game = new Game(roster, { mapId, difficulty: room.settings.difficulty, endless: room.settings.endless });
  room.paused = false;
  room.speed = 1;
  room.tickN = 0;
  clearInterval(room.loop);
  room.loop = setInterval(() => stepRoom(room), DT * 1000);
  for (const p of humans(room)) sendStart(room, p);
  broadcastRoom(room);
}

function stepRoom(room) {
  const g = room.game;
  if (!g) { clearInterval(room.loop); return; }
  // 아무도 접속해 있지 않으면 자동 일시정지
  if (!humans(room).some((p) => p.ws && p.ws.readyState === 1)) return;
  if (!room.paused && !g.result) for (let i = 0; i < room.speed; i++) g.tick();
  room.tickN++;
  if (room.tickN % 2 === 0) {
    const v = g.view();
    v.paused = room.paused;
    v.speed = room.speed;
    const s = JSON.stringify({ t: 'tick', v });
    for (const p of humans(room)) if (p.ws && p.ws.readyState === 1) p.ws.send(s);
  }
}

function stopGame(room) {
  clearInterval(room.loop);
  room.game = null;
  room.paused = false;
}

function cleanupRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const anyone = humans(room).some((p) => p.ws && p.ws.readyState === 1);
    if (anyone) room.lastActive = now;
    else if (now - room.lastActive > 60 * 60 * 1000) {
      for (const p of room.players) if (p.token) sessions.delete(p.token);
      stopGame(room);
      rooms.delete(code);
    }
  }
}
setInterval(cleanupRooms, 5 * 60 * 1000).unref();

function newRoom() {
  const code = makeCode();
  const r = { code, hostId: null, players: [], game: null, chat: [], lastActive: Date.now(), settings: { map: 'h-ring', difficulty: 'normal', endless: false }, paused: false, speed: 1 };
  rooms.set(code, r);
  return r;
}

// ───────────── WebSocket ─────────────
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let token = null;
  let room = null;
  let player = null;
  const fail = (msg) => send(ws, { t: 'error', msg });
  const isHost = () => room && player && room.hostId === player.id;

  const attach = (r, p) => {
    room = r;
    player = p;
    if (p.ws && p.ws !== ws) { try { p.ws.close(); } catch { /* 무시 */ } }
    p.ws = ws;
    sessions.set(token, { roomCode: r.code, playerId: p.id });
    r.lastActive = Date.now();
    broadcastRoom(r);
    sendStart(r, p);
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
        const r = newRoom();
        const p = { id: crypto.randomBytes(6).toString('hex'), name: cleanName(msg.name), token, ws: null };
        r.players.push(p);
        r.hostId = p.id;
        if (msg.t === 'solo' && msg.bot) r.players.push({ id: 'bot-' + crypto.randomBytes(4).toString('hex'), name: BOT_NAME, bot: true });
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
        // AI 동료 자리가 있으면 사람이 대신 들어감
        const bi = r.players.findIndex((p) => p.bot);
        if (bi < 0 && r.players.length >= MAX_PLAYERS) return fail(`방이 가득 찼습니다 (최대 ${MAX_PLAYERS}명).`);
        const p = { id: crypto.randomBytes(6).toString('hex'), name: cleanName(msg.name), token, ws: null };
        if (bi >= 0) r.players.splice(bi, 1, p); else r.players.push(p);
        attach(r, p);
        break;
      }
      case 'leave': {
        if (!room || !player) return;
        sessions.delete(token);
        if (!room.game) {
          room.players = room.players.filter((p) => p !== player);
          if (!humans(room).length) { stopGame(room); rooms.delete(room.code); } else {
            if (room.hostId === player.id) room.hostId = humans(room)[0].id;
            broadcastRoom(room);
          }
        } else {
          player.ws = null;
          broadcastRoom(room);
        }
        room = null; player = null;
        send(ws, { t: 'left' });
        break;
      }
      case 'addBot': case 'removeBot': {
        if (!room || room.game || !isHost()) return;
        if (msg.t === 'addBot') {
          if (room.players.length >= MAX_PLAYERS) return fail('이미 2명이에요.');
          room.players.push({ id: 'bot-' + crypto.randomBytes(4).toString('hex'), name: BOT_NAME, bot: true });
        } else room.players = room.players.filter((p) => !p.bot);
        broadcastRoom(room);
        break;
      }
      case 'setSettings': {
        if (!room || room.game) return;
        if (!isHost()) return fail('방장만 설정을 바꿀 수 있습니다.');
        const st = msg.settings || {};
        if (typeof st.map === 'string' && (st.map === 'random' || st.map === 'pick' || M.MAP_MAP[st.map])) room.settings.map = st.map;
        if (D.DIFFICULTIES.some((d) => d.id === st.difficulty)) room.settings.difficulty = st.difficulty;
        if (typeof st.endless === 'boolean') room.settings.endless = st.endless;
        broadcastRoom(room);
        break;
      }
      case 'pickLeader': {
        if (!room || room.game) return;
        const target = msg.target && isHost() ? room.players.find((x) => x.id === msg.target && x.bot) : player;
        if (!target) return;
        if (msg.leader !== null && !D.LEADER_MAP[msg.leader]) return;
        if (msg.leader && room.players.some((x) => x !== target && x.leader === msg.leader)) return fail('다른 사람이 이미 고른 대장이에요.');
        target.leader = msg.leader;
        broadcastRoom(room);
        break;
      }
      case 'start': {
        if (!room || room.game) return;
        if (!isHost()) return fail('방장만 시작할 수 있습니다.');
        startGame(room);
        break;
      }
      case 'cmd': {
        if (!room || !room.game || !player) return;
        if (room.paused && msg.c && msg.c.t !== 'bless' && msg.c.t !== 'ping') return fail('일시정지 중이에요.');
        const r = room.game.command(player.id, msg.c);
        if (typeof r === 'string') fail(r);
        else if (r && r.ok) send(ws, { t: 'made', id: r.ok });
        break;
      }
      case 'pause': {
        if (!room || !room.game || room.game.result) return;
        room.paused = !room.paused;
        room.chat.push({ name: '안내', text: `${player.name}님이 ${room.paused ? '일시정지했어요' : '다시 시작했어요'}.`, at: Date.now() });
        broadcastRoom(room);
        break;
      }
      case 'speed': {
        if (!room || !room.game || !isHost()) return;
        const s = Number(msg.speed);
        if ([1, 2, 3].includes(s)) room.speed = s;
        broadcastRoom(room);
        break;
      }
      case 'rematch': case 'backToLobby': {
        if (!room || !room.game || !isHost()) return;
        if (!room.game.result && !msg.force) return fail('게임이 아직 끝나지 않았습니다.');
        stopGame(room);
        if (msg.t === 'rematch') { room.chat.push({ name: '안내', text: '같은 설정으로 새 게임을 시작합니다!', at: Date.now() }); startGame(room); } else broadcastRoom(room);
        break;
      }
      case 'debug': {
        // 자동 테스트 전용 (TEST_HOOKS=1)
        if (process.env.TEST_HOOKS !== '1' || !room || !room.game) return;
        if (msg.gold) for (const p of room.game.players) p.gold += msg.gold;
        if (msg.wave) room.game.waveTimer = 0;
        if (msg.bless) for (const p of room.game.players) room.game.offerBlessing(p);
        if (msg.end) room.game.end(true, '테스트로 끝냈어요.');
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
  return s || '퇴마사' + crypto.randomInt(100, 999);
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
    console.error(`\n[오류] ${PORT}번 포트가 이미 사용 중입니다. 요괴 퇴마 디펜스 서버가 이미 켜져 있는지 확인하세요.`);
    if (process.argv.includes('--open')) openBrowser(`http://localhost:${PORT}`);
  } else console.error(err);
  process.exitCode = 1;
});

server.listen(PORT, () => {
  const line = '─'.repeat(52);
  console.log(`\n${line}\n  🏮 요괴 퇴마 디펜스 서버가 실행되었습니다\n${line}`);
  console.log(`  내 컴퓨터에서 접속   : http://localhost:${PORT}`);
  const lan = lanAddresses();
  if (lan.length) console.log('  같은 와이파이 친구   : ' + lan.map((ip) => `http://${ip}:${PORT}`).join('  또는  '));
  console.log('  멀리 있는 친구       : 새 창에서 "npm run share:defense" 실행 → 나오는 https 주소 공유');
  console.log(`  종료하려면 이 창을 닫거나 Ctrl+C 를 누르세요.\n${line}\n`);
  if (process.argv.includes('--open')) openBrowser(`http://localhost:${PORT}`);
});

module.exports = { server };
