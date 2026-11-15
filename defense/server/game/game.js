'use strict';
// 요괴 퇴마 디펜스 — 실시간 시뮬레이션 (서버가 모든 계산을 하고 화면에는 결과만 보냄)
// 전장(field) 여러 개: 사람마다 자기 전장(m0, m1) · 자기 보스방(r0, r1) · 함께 쓰는 스토리 이벤트 전장(ev)
const D = require('./data');
const M = require('./maps');

const DT = 0.05; // 1틱 = 0.05초
const ROOM_CENTER = [11, 7]; // 보스방 보스 자리 (고정)
const FIELD_HP = 1.38; // 한 사람이 한 전장을 혼자 막으므로 체력 보정

/** 웨이브 기본 체력 */
function hpBase(w) { return Math.round((w < 8 ? 0.55 + w * 0.06 : 1) * 22 * Math.pow(1.18, Math.min(w, 25) - 1) * Math.pow(1.125, Math.max(0, w - 25)) * (1 + w * 0.03)); }
function killGold(w) { return 3 + Math.floor(w / 6); }

function makeField(id, kind, owner, map, diff) {
  const paths = map.paths.map((p) => {
    const pts = p.pts.map(([x, y]) => [x + 0.5, y + 0.5]);
    if (p.loop) pts.push(pts[0]);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, len: cum[cum.length - 1], loop: p.loop, start: p.start || 0 };
  });
  const blocked = new Set();
  for (const [x, y] of map.pathTiles) blocked.add(x + ',' + y);
  for (const [x, y] of map.decor) blocked.add(x + ',' + y);
  const spots = [];
  for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) {
    if (blocked.has(x + ',' + y)) continue;
    let d = 99;
    for (const [px, py] of map.pathTiles) d = Math.min(d, Math.max(Math.abs(px - x), Math.abs(py - y)));
    spots.push({ x, y, d });
  }
  spots.sort((a, b) => a.d - b.d);
  // 소환진 (3×3): 소환한 유닛은 모두 여기에 나옴 → 넘치면 가까운 빈칸부터
  const sc = map.summon || [12, 7];
  const zone = new Set();
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) zone.add(sc[0] + dx + ',' + (sc[1] + dy));
  const summonSpots = spots.slice().sort((a, b) => Math.max(Math.abs(a.x - sc[0]), Math.abs(a.y - sc[1])) - Math.max(Math.abs(b.x - sc[0]), Math.abs(b.y - sc[1])) || Math.hypot(a.x - sc[0], a.y - sc[1]) - Math.hypot(b.x - sc[0], b.y - sc[1]));
  return { id, kind, owner, map, paths, blocked, spots, summonSpots, zone, loopMode: map.kind === 'loop', lives: diff.lives, limit: diff.limit, count: 0, spawnN: 0 };
}

class Game {
  /**
   * @param {{id:string,name:string,leader:string,bot?:boolean}[]} roster
   * @param {{mapId?:string, difficulty?:string, seed?:number, endless?:boolean}} opts
   */
  constructor(roster, opts = {}) {
    this.seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.rand = M.rng(this.seed);
    this.diff = D.DIFFICULTIES.find((d) => d.id === opts.difficulty) || D.DIFFICULTIES[1];
    this.map = opts.mapId && opts.mapId !== 'random' && M.MAP_MAP[opts.mapId] ? M.MAP_MAP[opts.mapId] : M.randomMap(this.seed ^ 0x5bd1e995);
    this.endless = !!opts.endless;
    this.loopMode = this.map.kind === 'loop';
    this.players = roster.map((p, i) => ({
      id: p.id, name: p.name, idx: i, bot: !!p.bot, leader: D.LEADER_MAP[p.leader] ? p.leader : D.LEADERS[i % D.LEADERS.length].id,
      gold: D.ECON.startGold, upg: { blade: 0, bow: 0, magic: 0 }, bless: [], choice: null, skillCd: 8, kills: 0, damage: 0, summons: 0,
      goldRainUntil: 0, temperUntil: 0,
      bosses: 0, toads: 0, bestTier: 1, done: [], tickets: 0, heroChoice: null, heroes: [],
      items: {},
    }));
    // 전장: 각자 같은 모양의 전장을 하나씩 + 각자 보스방 + 함께 쓰는 이벤트 전장
    this.fields = [];
    for (const p of this.players) this.fields.push(makeField('m' + p.idx, 'main', p.idx, this.map, this.diff));
    // 보스방: 보스는 가운데 고정, 유닛은 보스와 가까운 칸부터
    const room = makeField('room', 'room', null, M.ROOM_MAP, this.diff);
    room.center = ROOM_CENTER;
    room.blocked.add(ROOM_CENTER.join(','));
    room.spots = room.spots.filter((sp) => !room.blocked.has(sp.x + ',' + sp.y)).map((sp) => ({ ...sp, d: Math.max(Math.abs(sp.x - ROOM_CENTER[0]), Math.abs(sp.y - ROOM_CENTER[1])) })).sort((a, b) => a.d - b.d || Math.abs(a.y - ROOM_CENTER[1]) - Math.abs(b.y - ROOM_CENTER[1]));
    this.fields.push(room);
    this.story = { cleared: [], active: null, deadline: 0, cdUntil: 0, by: null }; // 보스 스토리 진행 (둘이 함께)
    this.fields.push(makeField('ev', 'event', null, M.EVENT_MAP, this.diff));
    this.F = Object.fromEntries(this.fields.map((f) => [f.id, f]));
    this.mains = this.fields.filter((f) => f.kind === 'main');
    this.units = [];
    this.enemies = [];
    this.zones = [];
    this.nextId = 1;
    this.time = 0;
    this.wave = 0;
    this.waveTimer = 6;
    this.spawnQueue = [];
    this.result = null;
    this.fx = [];
    this.msgs = [];
    this.globalSlowUntil = 0;
    this.event = null; // { idx, deadline }
    this.eventsDone = [];
    this.discovered = []; // 이번 판에 공개된 히든 조합
    this.revealed = {}; // 히든 조합 족보 힌트: 조합 id → 공개된 재료 수
    this.nextPlan = this.planWave(1);
  }

  // ───────── 도우미 ─────────
  pick(arr) { return arr[Math.floor(this.rand() * arr.length)]; }
  player(id) { return this.players.find((p) => p.id === id); }
  msg(text, kind = 'info', to = null) { this.msgs.push({ text, kind, at: this.time, to }); }
  /** 효과 이벤트 (전장 id 를 앞에 붙임. '*' = 모든 전장) */
  fxp(field, arr) { this.fx.push([field, ...arr]); }
  mainOf(p) { return this.F['m' + p.idx]; }
  /** 그 칸에 다른 유닛이 있는가 (type·owner 를 주면 같은 유닛 무리는 함께 설 수 있음) */
  occupied(f, x, y, type = null, owner = null) { return this.units.some((u) => u.field === f && u.x === x && u.y === y && !(type && u.type === type && u.owner === owner)); }
  free(f, x, y, type = null, owner = null) { const F = this.F[f]; return !!F && Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < M.W && y < M.H && !F.blocked.has(x + ',' + y) && !this.occupied(f, x, y, type, owner); }
  /** 같은 유닛 무리 위치 (내 전장) */
  stackOf(pidx, type, fieldId) { const u = this.units.find((x) => x.owner === pidx && x.type === type && x.field === (fieldId || 'm' + pidx)); return u ? { x: u.x, y: u.y, field: u.field } : null; }
  /** 내가 유닛을 둘 수 있는 전장인가 */
  canUse(p, f) { return f === 'm' + p.idx || f === 'room' || (f === 'ev' && !!this.event); }
  autoSpot(owner, fieldId) {
    const p = typeof owner === 'string' ? this.player(owner) : this.players[owner];
    const F = this.F[fieldId || 'm' + p.idx];
    let best = null, bs = Infinity;
    for (const s of F.spots) {
      if (s.d > 3 && best) break;
      if (this.occupied(F.id, s.x, s.y) || F.zone.has(s.x + ',' + s.y)) continue;
      const score = s.d * 10 + this.rand() * 4;
      if (score < bs) { bs = score; best = s; }
    }
    if (!best) for (const s of F.spots) if (!this.occupied(F.id, s.x, s.y)) { best = s; break; }
    return best ? { x: best.x, y: best.y, field: F.id } : null;
  }

  sellPrice(p, u) { return Math.round(D.ECON.sellRate[D.UNIT_MAP[u.type].tier] * (p.leader === 'merchant' ? 1.2 : 1)); }
  /** 소환진의 빈칸 (내 전장) */
  summonSpot(pidx, type = null) {
    // 같은 유닛이 이미 있으면 그 무리에 합류 (한 칸에 겹쳐 쌓임)
    if (type) { const st = this.stackOf(pidx, type); if (st) return st; }
    const F = this.F['m' + pidx];
    for (const s of F.summonSpots) if (!this.occupied(F.id, s.x, s.y)) return { x: s.x, y: s.y, field: F.id };
    return null;
  }
  /** (x, y) 에서 가까운 빈칸 n개 (여럿을 한꺼번에 옮길 때) */
  spotsNear(fid, x, y, n, type = null, owner = null) {
    const F = this.F[fid];
    const out = [];
    const cand = F.spots.filter((s) => !this.occupied(fid, s.x, s.y, type, owner)).sort((a, b) => Math.max(Math.abs(a.x - x), Math.abs(a.y - y)) - Math.max(Math.abs(b.x - x), Math.abs(b.y - y)) || Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    for (const s of cand) { out.push(s); if (out.length >= n) break; }
    return out;
  }

  /** 다음 웨이브 계획 */
  planWave(w) {
    const boss = D.BOSSES.find((b) => b.wave === w) || (this.endless && w > D.WAVES && w % 10 === 0 ? D.BOSSES[D.BOSSES.length - 1] : null);
    const pool = D.ENEMY_POOL.filter((e) => e.from <= w).map((e) => e.id);
    const main = pool.length > 2 && this.rand() < 0.5 ? pool[pool.length - 1 - Math.floor(this.rand() * 3)] : this.pick(pool);
    const second = this.rand() < 0.35 ? this.pick(pool) : null;
    const mod = !boss && w >= 4 && this.rand() < 0.4 ? this.pick(D.MODIFIERS).id : null;
    const mini = !boss && w % 5 === 0;
    let count = boss ? 8 : 20;
    if (mod === 'swarm') count = Math.round(count * 1.6);
    return { wave: w, main, second, mod, boss: boss ? boss.id : null, mini, count, chest: !boss && w >= 3 && this.rand() < 0.18 };
  }
  planInfo(p) {
    if (!p) return null;
    const boss = p.boss && D.BOSSES.find((b) => b.id === p.boss);
    const ev = D.EVENTS.find((e) => e.wave === p.wave);
    return {
      wave: p.wave, main: D.ENEMIES[p.main].name, mainIcon: D.ENEMIES[p.main].icon, second: p.second && p.second !== p.main ? D.ENEMIES[p.second].name : null,
      mod: p.mod ? D.MODIFIERS.find((m) => m.id === p.mod) : null, boss: boss ? { name: boss.name, icon: boss.icon, desc: boss.desc } : null, mini: p.mini, count: p.count,
      flying: p.main === 'crow' || p.second === 'crow', event: ev ? { boss: ev.boss, icon: ev.icon } : null,
    };
  }

  startWave() {
    const plan = this.nextPlan;
    this.wave = plan.wave;
    this.curPlan = plan;
    this.nextPlan = this.wave < D.WAVES || this.endless ? this.planWave(this.wave + 1) : null;
    this.waveTimer = D.WAVE_TIME;
    const q = [];
    for (let i = 0; i < plan.count; i++) q.push({ type: plan.second && i % 3 === 2 ? plan.second : plan.main, mod: plan.mod });
    if (plan.mini) q.push({ mini: true, mod: plan.mod });
    if (plan.boss) q.push({ boss: plan.boss });
    if (plan.chest) q.splice(Math.floor(q.length / 2), 0, { type: 'chest' });
    this.spawnQueue = q.map((s, i) => ({ ...s, at: this.time + i * (plan.mod === 'swarm' ? 0.35 : 0.55) }));
    const info = this.planInfo(plan);
    if (info.boss) this.msg(`⚠ ${this.wave}웨이브 보스 「${info.boss.icon} ${info.boss.name}」 등장! ${info.boss.desc}`, 'boss');
    else this.msg(`🌊 ${this.wave}웨이브: ${info.mainIcon} ${info.main}${info.mod ? ` · ${info.mod.icon}${info.mod.name}` : ''}${plan.chest ? ' · 🐸 보물 두꺼비!' : ''}`, 'wave');
    if (this.wave > 1) {
      for (const p of this.players) {
        let g = D.ECON.waveBonus(this.wave) * this.diff.gold;
        if (p.leader === 'merchant') g *= 1.5;
        g += 40 * p.bless.filter((b) => b === 'income').length;
        p.gold += Math.round(g);
      }
    }
    // 5웨이브를 깰 때마다 히든 조합 족보 힌트 (재료 하나씩 공개)
    if (this.wave > 1 && (this.wave - 1) % 5 === 0) this.revealHint(1);
    // 스토리 이벤트
    const ei = D.EVENTS.findIndex((e) => e.wave === this.wave);
    if (ei >= 0 && !this.event) this.openEvent(ei);
  }

  // ───────── 히든 조합 족보 힌트 ─────────
  /** n: 공개할 재료 수 (99 = 통째로) */
  revealHint(n, known = []) {
    const pool = D.RECIPES.filter((r) => r.hidden && !this.discovered.includes(r.id) && !known.includes(r.id) && (this.revealed[r.id] || 0) < r.need.length);
    if (!pool.length) return null;
    // 이미 조금 공개된 것부터 이어서 (없으면 무작위)
    const started = pool.filter((r) => this.revealed[r.id]);
    const r = started.length && n < 99 ? started[0] : this.pick(pool);
    const before = this.revealed[r.id] || 0;
    this.revealed[r.id] = Math.min(r.need.length, before + n);
    const names = r.need.slice(before, this.revealed[r.id]).map((x) => (x[0] === '#' ? D.ITEMS[x.slice(1)].name : D.UNIT_MAP[x].name));
    const full = this.revealed[r.id] >= r.need.length;
    this.msg(full ? `📜 족보 공개! 히든 조합 「${D.UNIT_MAP[r.out].name}」 = ${r.need.map((x) => (x[0] === '#' ? D.ITEMS[x.slice(1)].name : D.UNIT_MAP[x].name)).join(' + ')}` : `📜 족보 힌트! ??? 조합의 재료: ${names.join(', ')} (${this.revealed[r.id]}/${r.need.length})`, 'legend');
    this.fxp('*', ['reveal', r.id, this.revealed[r.id]]);
    return r.id;
  }

  // ───────── 스토리 이벤트 (함께) ─────────
  openEvent(i) {
    const ev = D.EVENTS[i];
    const w = this.wave;
    this.event = { idx: i, deadline: this.time + D.EVENT_TIME };
    const base = hpBase(w) * this.diff.hp * FIELD_HP * Math.max(1, this.players.length * 0.8);
    this.spawnBoss('ev', { k: ev.model, name: ev.boss, hp: base * ev.hp, speed: 0.45, armor: ev.armor, eventBoss: true, ability: 'brood', gold: 0 });
    this.msg(`⚔ 스토리 이벤트! 「${ev.icon} ${ev.boss}」 — 이벤트 전장에 유닛을 보내 함께 쓰러뜨리세요 (${D.EVENT_TIME}초)`, 'event');
    this.fxp('*', ['story', 'event', i]);
  }
  closeEvent(win) {
    const ev = D.EVENTS[this.event.idx];
    this.eventsDone.push({ idx: this.event.idx, win });
    if (win) {
      for (const p of this.players) {
        p.tickets++; p.gold += 500 + this.wave * 10; p.items.star = (p.items.star || 0) + 1;
        this.offerHero(p);
      }
      this.msg(`🏆 스토리 이벤트 성공! 「${ev.boss}」 처치 — 모두 영웅 영입권 +1 · 골드 · 🌠 별의 파편`, 'legend');
    } else this.msg(`💨 「${ev.boss}」이(가) 사라졌어요… 스토리 이벤트 실패`, 'bad');
    for (const e of this.enemies) if (e.field === 'ev') { e.dead = true; e.gone = true; }
    this.event = null;
    this.returnUnits('ev');
  }

  // ───────── 보스 스토리 (각자) ─────────
  storyState(s) {
    const st = this.story;
    if (st.cleared.includes(s.id)) return 'cleared';
    if (st.active === s.id) return 'active';
    const i = D.STORY.indexOf(s);
    if (i > 0 && !st.cleared.includes(D.STORY[i - 1].id)) return 'locked';
    if (this.wave < s.wave) return 'locked';
    return 'open';
  }
  /** 보스 스토리 시작 — 보스방은 둘이 함께 쓰고, 둘 다 유닛을 보낼 수 있음 */
  startStory(p, id) {
    const s = D.STORY.find((x) => x.id === id);
    if (!s) return null;
    const state = this.storyState(s);
    if (state === 'cleared') return '이미 깬 장이에요.';
    if (state === 'locked') return this.wave < s.wave ? `${s.wave}웨이브부터 도전할 수 있어요.` : '이전 장을 먼저 깨야 해요.';
    if (this.story.active) return '이미 도전 중이에요.';
    if (this.story.cdUntil > this.time) return `잠시 뒤 다시 도전할 수 있어요 (${Math.ceil(this.story.cdUntil - this.time)}초)`;
    // 보스 체력은 그 장이 열리는 웨이브 기준 (늦게 다시 도전하면 그만큼 쉬워짐), 난이도 영향은 완만하게
    const base = hpBase(s.wave) * 1.2 * Math.sqrt(this.diff.hp / 1.2) * FIELD_HP * Math.max(1, this.players.length * 0.85);
    this.spawnBoss('room', { k: s.model, name: s.boss, hp: base * s.hp, speed: 0.5, armor: s.armor, storyBoss: s.id, gold: 0 });
    this.story.active = s.id;
    this.story.deadline = this.time + D.STORY_TIME;
    this.story.by = p.idx;
    this.msg(`📖 ${p.name}: 보스 스토리 ${s.ch}장 「${s.title}」 시작! 둘 다 보스방에 한 명씩 보내 함께 잡으세요`, 'event');
    this.fxp('*', ['story', 'start', s.id, p.idx]);
    return null;
  }
  endStory(win) {
    const s = D.STORY.find((x) => x.id === this.story.active);
    this.story.active = null;
    if (win) {
      this.story.cleared.push(s.id);
      for (const p of this.players) {
        p.items[s.item] = (p.items[s.item] || 0) + 1;
        p.gold += s.gold;
        if (s.ch % 2 === 0) { p.tickets++; this.offerHero(p); }
      }
      this.msg(`📖 ${s.ch}장 「${s.title}」 클리어! 모두 ${D.ITEMS[s.item].icon} ${D.ITEMS[s.item].name} · 골드 +${s.gold}${s.ch % 2 === 0 ? ' · 영웅 영입권 +1' : ''}`, 'legend');
      this.fxp('*', ['story', 'clear', s.id, -1]);
    } else {
      this.story.cdUntil = this.time + D.STORY_COOLDOWN;
      for (const e of this.enemies) if (e.field === 'room') { e.dead = true; e.gone = true; }
      this.msg(`📖 「${s.boss}」이(가) 어둠 속으로 사라졌어요… ${D.STORY_COOLDOWN}초 뒤 다시 도전`, 'bad');
    }
    this.returnUnits('room');
  }

  spawnBoss(field, o) {
    const e = this.spawn({ custom: o }, field);
    e.boss = true; e.special = true;
    if (field === 'room') { e.fixed = true; e.speed = 0; e.x = ROOM_CENTER[0] + 0.5; e.y = ROOM_CENTER[1] + 0.5; }
    return e;
  }

  /** 보스 한 마리를 칠 때의 초당 피해 (보스방에 보낼 '가장 센 유닛' 고르기) */
  bossDps(u) {
    const st = this.unitStats(u);
    const t = st.t;
    let d = st.dmg / st.cd;
    if (t.crit) d *= 1 + t.crit.chance * (t.crit.mult - 1);
    const k = 1 + D.ECON.upgradeStep * this.players[u.owner].upg[t.cat];
    if (t.burn) d += t.burn.dps * k;
    if (t.poison) d += t.poison.dps * k;
    if (t.pierceArmor) d *= 1.4;
    return d;
  }

  sendHome(u) {
    const home = u.home && this.free(u.home.field, u.home.x, u.home.y, u.type, u.owner) ? u.home : this.autoSpot(u.owner, 'm' + u.owner);
    if (!home) return;
    this.fxp(u.field, ['tele', u.x, u.y]);
    u.field = home.field; u.x = home.x; u.y = home.y; u.home = null; u.cdLeft = 0.6;
    this.fxp(u.field, ['tele', u.x, u.y]);
  }

  /** 보스방·이벤트 전장에 보냈던 유닛을 원래 자리로 */
  returnUnits(fieldId) {
    for (const u of this.units) {
      if (u.field !== fieldId) continue;
      const home = u.home && this.free(u.home.field, u.home.x, u.home.y, u.type, u.owner) ? u.home : this.autoSpot(u.owner, 'm' + u.owner);
      if (!home) continue;
      this.fxp(u.field, ['tele', u.x, u.y]);
      u.field = home.field; u.x = home.x; u.y = home.y; u.home = null; u.cdLeft = 0.6;
      this.fxp(u.field, ['tele', u.x, u.y]);
    }
  }

  spawn(s, field) {
    const F = this.F[field];
    const w = Math.max(1, this.wave);
    const base = hpBase(w) * this.diff.hp * FIELD_HP;
    let e;
    if (s.custom) {
      e = { k: s.custom.k, name: s.custom.name, hp: s.custom.hp, speed: s.custom.speed, armor: s.custom.armor, ability: s.custom.ability, abilT: 0, gold: s.custom.gold || 0, storyBoss: s.custom.storyBoss, eventBoss: s.custom.eventBoss, owner: s.custom.owner };
    } else if (s.boss) {
      const b = D.BOSSES.find((x) => x.id === s.boss);
      const lvl = this.endless && w > D.WAVES ? Math.pow(1.5, (w - D.WAVES) / 10) : 1;
      e = { k: b.id, name: b.name, hp: base * b.hpMul * lvl, speed: b.speed, armor: b.armor, boss: true, ability: b.ability, gold: 120 + w * 6, abilT: 0, deadline: this.time + D.BOSS_TIME };
    } else if (s.mini) {
      e = { k: 'mini', name: D.MINIBOSS.name, hp: base * D.MINIBOSS.hpMul, speed: D.MINIBOSS.speed, armor: D.MINIBOSS.armor + Math.floor(w / 8), mini: true, gold: 40 + w * 3 };
    } else {
      const t = D.ENEMIES[s.type];
      e = { k: s.type, name: t.name, hp: base * t.hpMul, speed: t.speed, armor: t.armor + Math.floor(w / 10), flying: !!t.flying, regen: t.regen || 0, split: t.split || 0, treasure: !!t.treasure, gold: t.gold * killGold(w) };
    }
    const mod = s.mod;
    if (mod === 'fast') e.speed *= 1.35;
    if (mod === 'tough') e.hp *= 1.4;
    if (mod === 'regen') e.regen = (e.regen || 0) + 0.02;
    if (mod === 'iron') e.armor += 5;
    if (mod === 'swarm') e.hp *= 0.65;
    if (mod === 'ghost') e.evade = 0.2;
    if (w > D.WAVES && !s.custom) e.hp *= Math.pow(1.12, w - D.WAVES);
    e.hp = Math.round(e.hp);
    e.maxHp = e.hp;
    e.id = this.nextId++;
    e.field = field;
    e.path = s.path ?? (F.spawnN++ % F.paths.length);
    e.dist = s.dist ?? F.paths[e.path].start * F.paths[e.path].len;
    e.travel = s.dist || 0;
    e.slowPct = 0; e.slowUntil = 0; e.stunUntil = 0; e.shred = 0; e.shredUntil = 0;
    e.poison = null; e.burn = null; e.laps = 0;
    this.placeEnemy(e);
    this.enemies.push(e);
    return e;
  }

  placeEnemy(e) {
    const p = this.F[e.field].paths[e.path];
    let d = e.dist;
    if (p.loop) d = ((d % p.len) + p.len) % p.len;
    else d = Math.min(d, p.len);
    let i = 1;
    while (i < p.cum.length - 1 && p.cum[i] < d) i++;
    const a = p.pts[i - 1], b = p.pts[i];
    const seg = p.cum[i] - p.cum[i - 1] || 1;
    const t = (d - p.cum[i - 1]) / seg;
    e.x = a[0] + (b[0] - a[0]) * t;
    e.y = a[1] + (b[1] - a[1]) * t;
  }

  // ───────── 유닛 능력치 ─────────
  unitStats(u) {
    const t = D.UNIT_MAP[u.type];
    const p = this.players[u.owner];
    let dmg = t.dmg * (1 + D.ECON.upgradeStep * p.upg[t.cat]);
    if (t.hero) dmg *= 1 + D.HERO_LV_DMG * (D.heroLevel(u.kills || 0) - 1);
    let as = 1;
    let range = t.range;
    if (p.leader === 'sword' && t.cat === 'blade') dmg *= 1.15;
    if (p.leader === 'archer' && t.cat === 'bow') { dmg *= 1.1; range += 0.6; }
    if (p.leader === 'priest' && t.cat === 'magic') dmg *= 1.1;
    for (const b of p.bless) {
      if (b === t.cat) dmg *= 1.2;
      if (b === 'speed') as *= 1.12;
      if (b === 'range') range += 0.4;
    }
    if (p.temperUntil > this.time) as *= 1.6;
    for (const o of this.units) {
      if (o === u || o.field !== u.field) continue;
      const ot = D.UNIT_MAP[o.type];
      if (!ot.aura) continue;
      if (Math.hypot(o.x - u.x, o.y - u.y) > ot.aura.r) continue;
      if (ot.aura.as) as *= 1 + ot.aura.as;
      if (ot.aura.dmg) dmg *= 1 + ot.aura.dmg;
    }
    return { dmg, cd: t.cd / as, range, t };
  }

  // ───────── 피해 ─────────
  hurt(e, amount, u, opts = {}) {
    if (e.hp <= 0) return 0;
    if (e.evade && !opts.dot && this.rand() < e.evade) { this.fxp(e.field, ['miss', Math.round(e.x * 10), Math.round(e.y * 10)]); return 0; }
    let a = amount;
    if (!opts.dot && !opts.pierce) {
      const armor = Math.max(0, e.armor - (e.shredUntil > this.time ? e.shred : 0));
      a /= 1 + 0.06 * armor;
    }
    if (e.k === 'b_king' && e.hp < e.maxHp * 0.25) a *= 0.8;
    a = Math.min(a, e.hp);
    e.hp -= a;
    if (u) { u.dmg = (u.dmg || 0) + a; this.players[u.owner].damage += a; }
    else if (opts.by != null) this.players[opts.by].damage += a;
    if (e.hp <= 0.5) { if (u) u.kills = (u.kills || 0) + 1; this.kill(e, u ? u.owner : opts.by); }
    return a;
  }

  kill(e, by) {
    e.hp = 0;
    e.dead = true;
    const w = this.wave;
    const F = this.F[e.field];
    // 골드: 자기 전장 요괴는 그 전장 주인에게, 보스방·이벤트는 잡은 사람에게
    const getter = F.kind === 'main' ? this.players[F.owner] : this.players[by ?? 0];
    if (getter && e.gold) {
      let g = e.gold * this.diff.gold;
      if (getter.goldRainUntil > this.time) g *= 3;
      getter.gold += Math.round(g);
    }
    if (by != null && this.players[by]) this.players[by].kills++;
    this.fxp(e.field, ['die', e.id, Math.round(e.x * 10), Math.round(e.y * 10), e.boss ? 2 : e.mini ? 1 : 0]);
    if (e.storyBoss) { this.endStory(true); return; }
    if (e.eventBoss) { this.closeEvent(true); return; }
    const owner = F.kind === 'main' ? this.players[F.owner] : null;
    if (e.boss && owner) owner.bosses++;
    if (e.treasure && owner) owner.toads++;
    if (e.split) {
      for (let i = 0; i < e.split; i++) {
        const c = this.spawn({ type: 'slime', path: e.path, dist: Math.max(0, e.dist - 0.3 * i) }, e.field);
        c.split = 0; c.hp = c.maxHp = Math.round(e.maxHp * 0.4); c.k = 'slime_s'; c.gold = 0; c.laps = e.laps; c.travel = e.travel;
      }
    }
    if (e.treasure && owner) {
      const p = owner;
      if (this.rand() < 0.35) { const u = this.giveUnit(p, this.rand() < 0.15 ? 3 : 2); this.msg(`🐸 보물 두꺼비! ${p.name}: ${u ? D.UNIT_MAP[u.type].name + ' 획득' : '자리가 없어 골드로'}`, 'good'); if (!u) p.gold += 150; }
      else { const g = 120 + w * 12; p.gold += g; this.msg(`🐸 보물 두꺼비! ${p.name}: 골드 +${g}`, 'good'); }
    }
    if ((e.boss || e.mini) && owner) {
      this.msg(e.boss ? `🏆 ${owner.name}: 보스 「${e.name}」 처치! 축복을 하나 고르세요.` : `👿 ${owner.name}: ${e.name} 처치! 축복을 하나 고르세요.`, 'good');
      this.offerBlessing(owner);
    }
  }

  offerBlessing(p) {
    const pool = D.BLESSINGS.map((b) => b.id);
    const opts = [];
    while (opts.length < 3) { const b = this.pick(pool); if (!opts.includes(b)) opts.push(b); }
    if (p.choice) this.applyBlessing(p, p.choice[0]);
    p.choice = opts;
  }

  applyBlessing(p, id) {
    p.bless.push(id);
    if (id === 'gold') p.gold += 300;
    if (id === 'free') { this.giveUnit(p, 2, true); this.giveUnit(p, 2, true); }
  }

  /** 유닛 주기 (spot 이 없으면 내 전장 빈자리 자동) */
  giveUnit(p, tier, roll = false, spot = null, type = null) {
    if (!type && this.units.filter((u) => u.owner === p.idx).length >= D.ECON.maxUnits) return null;
    let t = tier;
    if (roll && tier === 2) t = this.rand() < 0.15 ? 3 : 2;
    const ty = type || this.pick(D.BY_TIER[t]);
    let s = spot && this.free(spot.field || 'm' + p.idx, spot.x, spot.y, ty, p.idx) ? spot : null;
    if (!s) s = this.summonSpot(p.idx, ty);
    if (!s) return null;
    const tt = D.UNIT_MAP[ty].tier;
    const u = { id: this.nextId++, owner: p.idx, type: ty, field: s.field || 'm' + p.idx, x: s.x, y: s.y, cdLeft: 0.3, dmg: 0, kills: 0, born: this.time, home: s.home || null };
    if (tt <= 5) p.bestTier = Math.max(p.bestTier, tt);
    this.units.push(u);
    this.fxp(u.field, ['summon', u.x, u.y, tt]);
    if (tt >= 4 && tt <= 5) this.msg(`✨ ${p.name}: ${D.TIERS[tt - 1].name} 「${D.UNIT_MAP[u.type].icon} ${D.UNIT_MAP[u.type].name}」!`, tt === 5 ? 'myth' : 'legend');
    return u;
  }

  rollTier(p, premium) {
    const odds = (premium ? D.PREMIUM_ODDS : D.SUMMON_ODDS).slice();
    let luck = 1;
    if (p.leader === 'gambler') luck *= 2;
    luck *= Math.pow(1.5, p.bless.filter((b) => b === 'luck').length);
    if (luck > 1) {
      const first = odds.findIndex((o) => o > 0);
      for (let i = first + 1; i < odds.length; i++) odds[i] *= luck;
      const rest = odds.reduce((s, o, i) => (i > first ? s + o : s), 0);
      odds[first] = Math.max(0.05, 1 - rest);
    }
    const sum = odds.reduce((a, b) => a + b, 0);
    let r = this.rand() * sum;
    for (let i = 0; i < odds.length; i++) { r -= odds[i]; if (r <= 0) return i + 1; }
    return 1;
  }

  summonCost(p, premium) {
    let c = premium ? D.ECON.premiumCost : D.ECON.summonCost;
    if (p.leader === 'priest') c *= 0.9;
    c *= Math.pow(0.85, p.bless.filter((b) => b === 'cheap').length);
    return Math.round(c);
  }
  upgradeCost(p, cat) {
    let c = D.ECON.upgradeCost(p.upg[cat]);
    if (p.leader === 'smith') c *= 0.75;
    return Math.round(c);
  }
  skillMax(p) {
    let cd = D.LEADER_MAP[p.leader].skill.cd;
    cd *= Math.pow(0.7, p.bless.filter((b) => b === 'cool').length);
    return cd;
  }

  /** 조합에 쓸 재료 고르기 (없으면 null) */
  craftPlan(p, r, prefer = null) {
    const mine = this.units.filter((u) => u.owner === p.idx);
    const used = new Set();
    const items = {};
    for (const n of r.need) {
      if (n.startsWith('#')) {
        const k = n.slice(1);
        items[k] = (items[k] || 0) + 1;
        if ((p.items[k] || 0) < items[k]) return null;
        continue;
      }
      let u = prefer && prefer.type === n && !used.has(prefer) ? prefer : null;
      if (!u) u = mine.find((x) => x.type === n && !used.has(x) && x.field === 'm' + p.idx) || mine.find((x) => x.type === n && !used.has(x));
      if (!u) return null;
      used.add(u);
    }
    return { units: [...used], items };
  }
  /** 조합 가능한 조합법 목록 */
  craftable(p) { return D.RECIPES.filter((r) => this.craftPlan(p, r)).map((r) => r.id); }

  // ───────── 명령 ─────────
  /** @returns {string|null|{ok:number}} 오류 메시지 */
  command(pid, c) {
    const p = this.player(pid);
    if (!p || !c || this.result) return null;
    const unit = (id) => this.units.find((u) => u.id === id && u.owner === p.idx);
    const fieldOf = (f) => (typeof f === 'string' && this.F[f] ? f : 'm' + p.idx);
    switch (c.t) {
      case 'summon': {
        const premium = !!c.premium;
        const cost = this.summonCost(p, premium);
        if (p.gold < cost) return '골드가 부족해요.';
        if (this.units.filter((u) => u.owner === p.idx).length >= D.ECON.maxUnits) return `유닛은 한 사람당 ${D.ECON.maxUnits}개까지예요.`;
        // 소환은 내 전장의 소환진에서 (같은 유닛이 있으면 그 무리에 합류)
        if (!this.summonSpot(p.idx)) return '빈자리가 없어요.';
        const spot = null;
        p.gold -= cost;
        p.summons++;
        const u = this.giveUnit(p, this.rollTier(p, premium), false, spot);
        return u ? { ok: u.id } : null;
      }
      case 'move': {
        const u = unit(c.unit);
        if (!u || !c.tile) return null;
        const f = typeof c.field === 'string' ? c.field : u.field;
        if (!this.canUse(p, f)) return f === 'ev' ? '스토리 이벤트가 열려 있을 때만 보낼 수 있어요.' : '여기에는 내 유닛을 둘 수 없어요.';
        if (!this.free(f, c.tile[0], c.tile[1], u.type, u.owner)) return '거기에는 세울 수 없어요 (다른 유닛이 있어요).';
        if (f === 'room' && u.field !== 'room') {
          // 보스방에는 한 사람당 한 명: 이미 있으면 교대
          for (const o of this.units) if (o.owner === p.idx && o.field === 'room') this.sendHome(o);
        }
        if (f !== u.field) {
          // 다른 전장으로 보내기 (보스방·이벤트 전장에서 돌아올 자리 기억)
          if (f !== 'm' + p.idx && u.field === 'm' + p.idx) u.home = { field: u.field, x: u.x, y: u.y };
          if (f === 'm' + p.idx) u.home = null;
          this.fxp(u.field, ['tele', u.x, u.y]);
          u.field = f;
          u.cdLeft = Math.max(u.cdLeft, 1);
          this.fxp(f, ['tele', c.tile[0], c.tile[1]]);
        } else u.cdLeft = Math.max(u.cdLeft, 0.5);
        u.x = c.tile[0]; u.y = c.tile[1];
        return null;
      }
      case 'dispatch': {
        // 가장 센 유닛 n개를 보스방·이벤트 전장으로 보내기
        const f = c.field;
        if (!this.canUse(p, f) || f === 'm' + p.idx) return '보낼 수 없는 곳이에요.';
        const n = f === 'room' ? 1 : Math.max(1, Math.min(8, Number(c.n) || 3));
        const pool = this.units.filter((u) => u.owner === p.idx && u.field === 'm' + p.idx);
        const cand = (f === 'room' ? pool.map((u) => [u, this.bossDps(u)]).sort((a, b) => b[1] - a[1]).map((x) => x[0]) : pool.sort((a, b) => D.UNIT_MAP[b.type].tier - D.UNIT_MAP[a.type].tier || b.dmg - a.dmg)).slice(0, n);
        let sent = 0;
        for (const u of cand) { const s = this.autoSpot(p.idx, f); if (!s) break; this.command(pid, { t: 'move', unit: u.id, tile: [s.x, s.y], field: f }); sent++; }
        return sent ? null : '보낼 유닛이 없어요.';
      }
      case 'moveMany': {
        // 드래그로 고른 여러 유닛을 목표 칸 주변으로 (같은 전장 안에서, 보스방 제외)
        const list = (Array.isArray(c.units) ? c.units : []).slice(0, 40).map(unit).filter(Boolean);
        if (!list.length || !c.tile) return null;
        const f = typeof c.field === 'string' ? c.field : list[0].field;
        if (f === 'room') { const u0 = list[0]; return this.command(pid, { t: 'send', unit: u0.id, field: 'room' }); }
        if (!this.canUse(p, f)) return '여기에는 내 유닛을 둘 수 없어요.';
        // 같은 종류끼리는 한 칸에 겹쳐서, 종류마다 목표 근처 칸 하나씩
        const groups = {};
        for (const u of list) (groups[u.type] ||= []).push(u);
        const taken = new Set();
        for (const [type, us] of Object.entries(groups)) {
          const cand = this.spotsNear(f, c.tile[0], c.tile[1], 60, type, p.idx).filter((sp) => !taken.has(sp.x + ',' + sp.y));
          const sp = cand[0];
          if (!sp) continue;
          taken.add(sp.x + ',' + sp.y);
          for (const u of us) this.command(pid, { t: 'move', unit: u.id, tile: [sp.x, sp.y], field: f });
        }
        return null;
      }
      case 'gather': {
        // 같은 유닛끼리 모으기: 고른 유닛 옆으로 같은 종류를 모음 (내 전장 안)
        const u = unit(c.unit);
        if (!u || u.field === 'room') return null;
        // 같은 종류를 모두 고른 유닛 칸으로 모아 한 무리로 (내 전장·이벤트 전장 안)
        const same = this.units.filter((x) => x !== u && x.owner === p.idx && x.type === u.type && x.field === u.field && (x.x !== u.x || x.y !== u.y));
        if (!same.length) return '모을 같은 유닛이 없어요.';
        for (const x of same) { this.fxp(x.field, ['tele', x.x, x.y]); x.x = u.x; x.y = u.y; x.cdLeft = Math.max(x.cdLeft, 0.4); }
        this.fxp(u.field, ['tele', u.x, u.y]);
        return null;
      }
      case 'autoPlace': {
        // 길 옆 좋은 빈자리로 (여러 개 가능)
        // 같은 칸의 같은 유닛 무리는 함께 옮김
        const list = (Array.isArray(c.units) ? c.units : [c.unit]).map(unit).filter(Boolean);
        const groups = {};
        for (const u of list) (groups[`${u.field}|${u.x},${u.y}|${u.type}`] ||= []).push(u);
        for (const us of Object.values(groups)) {
          const u0 = us[0];
          const s = this.autoSpot(p.idx, u0.field === 'room' ? 'm' + p.idx : u0.field);
          if (s) for (const u of us) this.command(pid, { t: 'move', unit: u.id, tile: [s.x, s.y], field: s.field });
        }
        return null;
      }
      case 'clearZone': {
        // 소환진에 있는 내 유닛을 모두 길 옆으로
        const F = this.F['m' + p.idx];
        const list = this.units.filter((u) => u.owner === p.idx && u.field === F.id && F.zone.has(u.x + ',' + u.y)).map((u) => u.id);
        if (!list.length) return '소환진이 비어 있어요.';
        return this.command(pid, { t: 'autoPlace', units: list });
      }
      case 'send': {
        // 유닛 하나를 다른 전장(보스방·이벤트·내 전장)의 빈자리로
        const u = unit(c.unit);
        if (!u) return null;
        if (!this.canUse(p, c.field)) return c.field === 'ev' ? '스토리 이벤트가 열려 있을 때만 보낼 수 있어요.' : '보낼 수 없는 곳이에요.';
        if (c.field === u.field) return null;
        const s = this.autoSpot(p.idx, c.field);
        if (!s) return '빈자리가 없어요.';
        return this.command(pid, { t: 'move', unit: u.id, tile: [s.x, s.y], field: c.field });
      }
      case 'recall': {
        const f = c.field;
        if (f === 'm' + p.idx) return null;
        for (const u of this.units) if (u.owner === p.idx && u.field === f) {
          const home = u.home && this.free(u.home.field, u.home.x, u.home.y, u.type, u.owner) ? u.home : this.autoSpot(p.idx);
          if (!home) continue;
          this.fxp(u.field, ['tele', u.x, u.y]);
          u.field = home.field; u.x = home.x; u.y = home.y; u.home = null; u.cdLeft = 0.6;
          this.fxp(u.field, ['tele', u.x, u.y]);
        }
        return null;
      }
      case 'swap': {
        const a = unit(c.unit), b = unit(c.other);
        if (!a || !b || a.field !== b.field) return null;
        [a.x, b.x] = [b.x, a.x]; [a.y, b.y] = [b.y, a.y];
        return null;
      }
      case 'sell': {
        const u = unit(c.unit);
        if (!u) return null;
        const t = D.UNIT_MAP[u.type];
        if (t.hero || t.hidden) return '영웅·히든 유닛은 팔 수 없어요.';
        p.gold += this.sellPrice(p, u);
        this.fxp(u.field, ['sold', u.x, u.y]);
        this.units = this.units.filter((x) => x !== u);
        return null;
      }
      case 'sellMany': case 'sellTier': {
        // 여러 개 한꺼번에 팔기: 고른 유닛들 / 등급 전체 (영웅·히든은 빼고)
        let list;
        if (c.t === 'sellTier') {
          const tier = Number(c.tier);
          list = this.units.filter((u) => u.owner === p.idx && D.UNIT_MAP[u.type].tier === tier && (c.field ? u.field === c.field : true));
        } else list = (Array.isArray(c.units) ? c.units : []).map(unit).filter(Boolean);
        list = list.filter((u) => !D.UNIT_MAP[u.type].hero && !D.UNIT_MAP[u.type].hidden);
        if (!list.length) return '팔 유닛이 없어요.';
        const gold = list.reduce((sum, u) => sum + this.sellPrice(p, u), 0);
        const gone = new Set(list);
        for (const u of list) this.fxp(u.field, ['sold', u.x, u.y]);
        this.units = this.units.filter((x) => !gone.has(x));
        p.gold += gold;
        this.msg(`💰 ${p.name}: 유닛 ${list.length}개 판매 · 골드 +${gold}`, 'info');
        return null;
      }
      case 'merge': {
        // 같은 유닛 n개 → 한 등급 위 무작위 (랜덤 합성)
        const u = unit(c.unit);
        if (!u) return null;
        const t = D.UNIT_MAP[u.type];
        const need = D.MERGE_NEED[t.tier];
        if (t.hero) return '영웅은 합성하지 않아요. 요괴를 처치할수록 레벨이 올라요!';
        if (t.hidden || !need) return '이 유닛은 더 합성할 수 없어요.';
        const same = this.units.filter((x) => x !== u && x.owner === p.idx && x.type === u.type).sort((a, b) => (a.field === u.field ? 0 : 1) - (b.field === u.field ? 0 : 1) || Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y));
        if (same.length < need - 1) return `같은 유닛이 ${need}개 있어야 합성할 수 있어요.`;
        const gone = new Set(same.slice(0, need - 1));
        this.units = this.units.filter((x) => !gone.has(x) && x !== u);
        const nu = this.giveUnit(p, t.tier + 1, false, { x: u.x, y: u.y, field: u.field, home: u.home });
        if (nu) { nu.cdLeft = 0.2; this.fxp(u.field, ['merge', u.x, u.y, t.tier + 1]); }
        return nu ? { ok: nu.id } : null;
      }
      case 'craft': {
        // 조합법: 정해진 재료 → 정해진 유닛
        const r = D.RECIPE_MAP[c.recipe];
        if (!r) return null;
        const plan = this.craftPlan(p, r, c.unit ? unit(c.unit) : null);
        if (!plan) return '재료가 모자라요.';
        const at = plan.units.find((x) => x.field === 'm' + p.idx) || plan.units[0];
        const spot = { x: at.x, y: at.y, field: at.field, home: at.home };
        const gone = new Set(plan.units);
        this.units = this.units.filter((x) => !gone.has(x));
        for (const [k, n] of Object.entries(plan.items)) p.items[k] -= n;
        const nu = this.giveUnit(p, D.UNIT_MAP[r.out].tier, false, spot, r.out);
        if (!nu) return null;
        nu.cdLeft = 0.2;
        const tt = D.UNIT_MAP[r.out].tier;
        this.fxp(nu.field, [r.hidden ? 'hero' : 'merge', nu.x, nu.y, tt]);
        if (r.hidden) {
          const first = !this.discovered.includes(r.id);
          if (first) this.discovered.push(r.id);
          this.msg(`🔮 ${p.name}: 히든 조합${first ? ' 발견' : ''}! 「${D.UNIT_MAP[r.out].icon} ${D.UNIT_MAP[r.out].name}」`, 'myth');
          this.fxp('*', ['hidden', r.id]);
        } else if (tt >= 4) this.msg(`📜 ${p.name}: 조합 성공 「${D.UNIT_MAP[r.out].icon} ${D.UNIT_MAP[r.out].name}」`, 'legend');
        return { ok: nu.id };
      }
      case 'upgrade': {
        if (!D.CATS[c.cat]) return null;
        if (p.upg[c.cat] >= D.ECON.maxUpgrade) return '최대 강화예요.';
        const cost = this.upgradeCost(p, c.cat);
        if (p.gold < cost) return '골드가 부족해요.';
        p.gold -= cost;
        p.upg[c.cat]++;
        return null;
      }
      case 'gift': {
        const other = this.players.find((x) => x !== p);
        const amt = Math.floor(Number(c.amount));
        if (!other || !(amt > 0)) return null;
        if (p.gold < amt) return '골드가 부족해요.';
        p.gold -= amt; other.gold += amt;
        this.msg(`🎁 ${p.name} → ${other.name}: 골드 ${amt}`, 'info');
        return null;
      }
      case 'bless': {
        if (!p.choice || !p.choice.includes(c.id)) return null;
        p.choice = null;
        this.applyBlessing(p, c.id);
        this.msg(`${D.BLESS_MAP[c.id].icon} ${p.name}: 축복 「${D.BLESS_MAP[c.id].name}」`, 'info');
        return null;
      }
      case 'hero': {
        if (!p.heroChoice || !p.heroChoice.includes(c.id)) return null;
        const u = this.giveUnit(p, 6, false, null, c.id);
        if (!u) return '빈자리가 없어요.';
        p.heroes.push(c.id);
        p.tickets--;
        p.heroChoice = null;
        this.fxp(u.field, ['hero', u.x, u.y, 6]);
        this.msg(`🦸 ${p.name}: 영웅 「${D.UNIT_MAP[c.id].icon} ${D.UNIT_MAP[c.id].name}」 합류!`, 'myth');
        this.offerHero(p);
        return { ok: u.id };
      }
      case 'story': return this.startStory(p, c.id);
      case 'skill': return this.useSkill(p, c);
      case 'ping': {
        if (typeof c.x === 'number' && typeof c.y === 'number') this.fxp(fieldOf(c.field), ['ping', Math.round(c.x * 10), Math.round(c.y * 10), p.idx]);
        return null;
      }
      default: return null;
    }
  }

  // ───────── 미션 · 영웅 ─────────
  missionValue(p, stat) {
    if (stat === 'kills') return p.kills;
    if (stat === 'upgSum') return p.upg.blade + p.upg.bow + p.upg.magic;
    if (stat === 'wave') return this.wave;
    return p[stat] || 0;
  }
  checkMissions() {
    for (const p of this.players) {
      for (const m of D.MISSIONS) {
        if (p.done.includes(m.id) || this.missionValue(p, m.stat) < m.goal) continue;
        p.done.push(m.id);
        p.tickets++;
        this.msg(`🎖 ${p.name}: 미션 「${m.icon} ${m.name}」 달성! 영웅 영입권 +1`, 'legend');
        this.fxp('*', ['mission', p.idx]);
      }
      this.offerHero(p);
    }
  }
  offerHero(p) {
    if (p.heroChoice || p.tickets <= 0) return;
    const pool = D.HEROES.map((h) => h.id).filter((id) => !p.heroes.includes(id));
    if (!pool.length) { p.tickets--; p.gold += 500; this.msg(`🦸 ${p.name}: 영웅을 모두 모아 영입권을 골드 500으로 바꿨어요.`, 'good'); return; }
    const opts = [];
    while (opts.length < Math.min(3, pool.length)) { const h = this.pick(pool); if (!opts.includes(h)) opts.push(h); }
    p.heroChoice = opts;
  }

  useSkill(p, c) {
    if (p.skillCd > 0) return `필살기 준비 중 (${Math.ceil(p.skillCd)}초)`;
    const L = D.LEADER_MAP[p.leader];
    const w = Math.max(1, this.wave);
    const x = Number(c.x), y = Number(c.y);
    const f = typeof c.field === 'string' && this.F[c.field] ? c.field : 'm' + p.idx;
    if (L.skill.target && !(Number.isFinite(x) && Number.isFinite(y))) return '위치를 골라 주세요.';
    if (L.skill.target && !this.canUse(p, f)) return '내 전장·보스방·이벤트 전장에서만 쓸 수 있어요.';
    switch (p.leader) {
      case 'sword': {
        const dmg = hpBase(w) * this.diff.hp * FIELD_HP * 7;
        for (const e of this.enemies) if (!e.dead && e.field === f && Math.hypot(e.x - x, e.y - y) <= 2.6) this.hurt(e, dmg, null, { pierce: true, by: p.idx });
        this.fxp(f, ['slash', Math.round(x * 10), Math.round(y * 10)]);
        break;
      }
      case 'archer':
        this.zones.push({ field: f, x, y, r: 2.3, until: this.time + 5, dps: hpBase(w) * this.diff.hp * FIELD_HP * 2.2, by: p.idx });
        break;
      case 'priest': this.globalSlowUntil = this.time + 6; this.fxp('*', ['seal']); break;
      case 'merchant': { const g = 100 + w * 15; p.gold += g; p.goldRainUntil = this.time + 10; this.fxp('*', ['goldrain', p.idx]); break; }
      case 'smith': p.temperUntil = this.time + 8; this.fxp('*', ['temper', p.idx]); break;
      case 'gambler': {
        const mine = this.units.filter((u) => u.owner === p.idx && D.UNIT_MAP[u.type].tier < 5);
        if (!mine.length) return '올릴 유닛이 없어요.';
        const u = this.pick(mine);
        const before = D.UNIT_MAP[u.type];
        u.type = this.pick(D.BY_TIER[before.tier + 1]);
        this.fxp(u.field, ['merge', u.x, u.y, before.tier + 1]);
        this.msg(`🎲 ${p.name}: ${before.name} → ${D.UNIT_MAP[u.type].name}!`, before.tier + 1 >= 4 ? 'legend' : 'info');
        break;
      }
      default:
    }
    p.skillCd = this.skillMax(p);
    this.msg(`${L.icon} ${p.name}: 「${L.skill.name}」!`, 'skill');
    return null;
  }

  // ───────── 진행 ─────────
  tick() {
    if (this.result) return;
    const dt = DT;
    this.time += dt;
    for (const p of this.players) p.skillCd = Math.max(0, p.skillCd - dt);
    // 웨이브 (각자 전장에 똑같이)
    this.waveTimer -= dt;
    const lastWave = !this.endless && this.wave >= D.WAVES;
    if (this.waveTimer <= 0 && !lastWave) this.startWave();
    while (this.spawnQueue.length && this.spawnQueue[0].at <= this.time) {
      const s = this.spawnQueue.shift();
      for (const F of this.mains) this.spawn(s, F.id);
    }
    // 보스방·이벤트 제한 시간
    if (this.story.active && this.story.deadline <= this.time) this.endStory(false);
    if (this.event && this.event.deadline <= this.time) this.closeEvent(false);
    // 요괴 이동·상태
    const sealed = this.globalSlowUntil > this.time;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.poison && e.poison.until > this.time) this.hurt(e, e.poison.dps * dt, null, { dot: true, by: e.poison.by });
      if (e.burn && e.burn.until > this.time) this.hurt(e, e.burn.dps * dt, null, { dot: true, by: e.burn.by });
      if (e.dead) continue;
      if (e.regen) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.regen * dt);
      const F = this.F[e.field];
      if (e.boss) {
        this.bossAbility(e, dt);
        if (F.kind === 'main' && F.loopMode && e.deadline <= this.time) {
          e.dead = true; e.gone = true;
          if (e.k === 'b_king' || (!this.endless && this.wave >= D.WAVES)) { this.end(false, `${D.BOSS_TIME}초 안에 「${e.name}」을(를) 쓰러뜨리지 못했어요…`); continue; }
          F.limit -= 10;
          this.fxp(F.id, ['leak', 10]);
          this.msg(`💔 ${this.players[F.owner].name}의 전장: 「${e.name}」이(가) 결계를 부수고 사라졌어요! 최대 요괴 수 -10 (${F.limit})`, 'bad');
          continue;
        }
      }
      if (e.fixed) continue;
      let sp = e.speed;
      if (e.ability === 'rage' || e.ability === 'all') if (e.hp < e.maxHp * 0.5) sp *= 1.6;
      let slow = e.slowUntil > this.time ? e.slowPct : 0;
      if (sealed) slow = Math.max(slow, e.boss ? 0.35 : 0.7);
      if (e.boss) slow *= 0.6;
      sp *= 1 - slow;
      if (e.stunUntil > this.time) sp = 0;
      e.dist += sp * dt;
      e.travel += sp * dt;
      const path = F.paths[e.path];
      if (path.loop) {
        const laps = Math.floor((e.dist - path.start * path.len) / path.len);
        if (laps > e.laps) { e.laps = laps; if (e.treasure) { e.dead = true; e.gone = true; this.msg('🐸 보물 두꺼비가 도망쳤어요…', 'bad'); } }
      } else if (e.dist >= path.len) {
        e.dead = true; e.gone = true;
        if (!e.treasure && F.kind === 'main') {
          const cost = e.boss ? 10 : e.mini ? 3 : 1;
          F.lives -= cost;
          this.fxp(F.id, ['leak', cost]);
          if (e.boss || e.mini) this.msg(`💔 ${this.players[F.owner].name}의 전장: ${e.name}이(가) 빠져나갔어요! 생명 -${cost}`, 'bad');
        }
        continue;
      }
      this.placeEnemy(e);
    }
    // 지속 효과
    this.zones = this.zones.filter((z) => z.until > this.time);
    for (const z of this.zones) for (const e of this.enemies) if (!e.dead && e.field === z.field && Math.hypot(e.x - z.x, e.y - z.y) <= z.r) this.hurt(e, z.dps * dt, null, { dot: true, by: z.by });
    // 유닛 공격 (같은 전장의 요괴만)
    const byField = {};
    for (const e of this.enemies) if (!e.dead) (byField[e.field] ||= []).push(e);
    for (const u of this.units) {
      u.cdLeft -= dt;
      if (u.cdLeft > 0) continue;
      const list = byField[u.field];
      if (!list) { u.cdLeft = 0.1; continue; }
      const st = this.unitStats(u);
      const ux = u.x + 0.5, uy = u.y + 0.5;
      const cands = [];
      for (const e of list) {
        if (e.dead || (e.flying && st.t.cat === 'blade')) continue;
        if (Math.hypot(e.x - ux, e.y - uy) <= st.range) cands.push(e);
      }
      if (!cands.length) { u.cdLeft = 0.1; continue; }
      cands.sort((a, b) => b.travel - a.travel);
      const targets = cands.slice(0, st.t.multi || 1);
      for (const tg of targets) this.attack(u, st, tg, list);
      u.cdLeft = st.cd;
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    // 패배·승리 (어느 한 전장이라도 무너지면 패배)
    for (const F of this.mains) {
      const who = this.players[F.owner].name;
      if (F.loopMode) {
        F.count = this.enemies.reduce((s, e) => s + (e.field !== F.id ? 0 : e.boss ? 10 : e.mini ? 3 : e.treasure ? 0 : 1), 0);
        if (F.count >= F.limit) this.end(false, `${who}의 전장에 요괴가 ${F.limit}마리 넘게 쌓였어요…`);
      } else if (F.lives <= 0) { F.lives = 0; this.end(false, `${who}의 전장 결계가 무너졌어요…`); }
    }
    if (!this.result && !this.endless && this.wave >= D.WAVES && !this.spawnQueue.length && !this.enemies.some((e) => this.F[e.field].kind === 'main')) this.end(true, `${D.WAVES}웨이브를 모두 막아냈어요!`);
    const tickNo = Math.round(this.time / dt);
    if (tickNo % 20 === 0) this.checkMissions();
    if (tickNo % 10 === 0) for (const p of this.players) if (p.bot) botAct(this, p);
  }

  bossAbility(e, dt) {
    e.abilT += dt;
    const ab = e.ability;
    if ((ab === 'brood' || ab === 'all') && e.abilT % 6 < dt) {
      for (let i = 0; i < 3; i++) {
        const c = this.spawn({ type: 'imp', path: e.path, dist: Math.max(0, e.dist - 0.4 * (i + 1)) }, e.field);
        c.hp = c.maxHp = Math.round(e.maxHp * 0.012); c.gold = 1; c.laps = e.laps; c.travel = e.travel - 0.4 * (i + 1);
      }
      this.fxp(e.field, ['brood', Math.round(e.x * 10), Math.round(e.y * 10)]);
    }
    if ((ab === 'heal' || ab === 'all') && (e.abilT + 3) % 10 < dt) {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.04);
      this.fxp(e.field, ['heal', Math.round(e.x * 10), Math.round(e.y * 10)]);
    }
  }

  attack(u, st, tg, list) {
    const t = st.t;
    const p = this.players[u.owner];
    let dmg = st.dmg;
    let crit = false;
    if (t.crit && this.rand() < t.crit.chance) { dmg *= t.crit.mult; crit = true; }
    if (p.bless.includes('crit') && this.rand() < 0.1 * p.bless.filter((b) => b === 'crit').length) { dmg *= 2; crit = true; }
    const kind = t.chain ? 'chain' : t.splash ? 'splash' : t.cat;
    const f = u.field;
    let first = true;
    const hit = (e, amt) => {
      if (t.execute && !e.boss && !e.mini && e.hp - amt <= e.maxHp * t.execute) amt = e.hp + 1;
      const done = Math.round(this.hurt(e, amt, u, { pierce: t.pierceArmor }));
      if (first) { this.fxp(f, ['atk', u.id, e.id, done, kind, Math.min(5, t.tier), crit ? 1 : 0, Math.round(e.x * 10), Math.round(e.y * 10)]); first = false; }
      else this.fxp(f, ['hit', e.id, done, Math.round(e.x * 10), Math.round(e.y * 10)]);
      if (t.slow && (e.slowUntil <= this.time || e.slowPct <= t.slow.pct)) { e.slowPct = t.slow.pct; e.slowUntil = this.time + t.slow.dur; }
      if (t.poison && (!e.poison || e.poison.until < this.time || e.poison.dps <= t.poison.dps)) e.poison = { dps: t.poison.dps * (1 + D.ECON.upgradeStep * p.upg[t.cat]), until: this.time + t.poison.dur, by: u.owner };
      if (t.burn && (!e.burn || e.burn.until < this.time || e.burn.dps <= t.burn.dps)) e.burn = { dps: t.burn.dps * (1 + D.ECON.upgradeStep * p.upg[t.cat]), until: this.time + t.burn.dur, by: u.owner };
      if (t.shred) { e.shred = Math.min(10, (e.shredUntil > this.time ? e.shred : 0) + t.shred); e.shredUntil = this.time + 5; }
      if (t.stun && !e.boss && this.rand() < t.stun.chance) e.stunUntil = this.time + t.stun.dur;
    };
    hit(tg, dmg);
    if (t.splash) for (const e of list) if (e !== tg && !e.dead && Math.hypot(e.x - tg.x, e.y - tg.y) <= t.splash && !(e.flying && t.cat === 'blade')) hit(e, dmg * 0.7);
    if (t.chain) {
      let cur = tg, amt = dmg;
      const done = new Set([tg]);
      for (let i = 0; i < t.chain; i++) {
        let best = null, bd = 2.2;
        for (const e of list) { if (e.dead || done.has(e)) continue; const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < bd) { bd = d; best = e; } }
        if (!best) break;
        amt *= 0.85;
        this.fxp(f, ['zap', Math.round(cur.x * 10), Math.round(cur.y * 10), Math.round(best.x * 10), Math.round(best.y * 10), t.hero || t.hidden ? 1 : 0]);
        hit(best, amt);
        done.add(best); cur = best;
      }
    }
  }

  end(win, reason) {
    if (this.result) return;
    this.result = { win, reason, wave: this.wave, time: Math.round(this.time) };
    // 게임을 깨면 히든 조합 족보 2개를 통째로 공개
    if (win) { const a = this.revealHint(99); const b = this.revealHint(99, a ? [a] : []); this.result.revealed = [a, b].filter(Boolean); }
    this.msg(win ? `🎉 승리! ${reason}` : `💀 패배… ${reason}`, win ? 'good' : 'bad');
  }

  // ───────── 화면용 ─────────
  staticView() {
    return {
      map: M.summary(this.map), loopMode: this.loopMode, diff: this.diff, seed: this.seed,
      maps: { main: M.summary(this.map), room: M.summary(M.ROOM_MAP), event: M.summary(M.EVENT_MAP) },
      fields: this.fields.map((f) => ({ id: f.id, kind: f.kind, owner: f.owner })),
      players: this.players.map((p) => ({ id: p.id, name: p.name, leader: p.leader, bot: p.bot })),
    };
  }

  /** 자주 보내는 상태 (작게) */
  view() {
    const fx = this.fx; this.fx = [];
    const msgs = this.msgs; this.msgs = [];
    const bossOf = (fid) => {
      const b = this.enemies.find((e) => e.field === fid && e.boss) || this.enemies.find((e) => e.field === fid && e.mini);
      return b ? { name: b.name, hp: Math.round(b.hp), max: b.maxHp, left: b.deadline && this.F[fid].loopMode && this.F[fid].kind === 'main' ? Math.max(0, Math.ceil(b.deadline - this.time)) : null } : null;
    };
    return {
      time: Math.round(this.time * 100) / 100, wave: this.wave, waves: D.WAVES, endless: this.endless, nextIn: Math.max(0, Math.ceil(this.waveTimer)), lastWave: !this.endless && this.wave >= D.WAVES,
      cur: this.planInfo(this.curPlan), next: this.planInfo(this.nextPlan), sealed: this.globalSlowUntil > this.time,
      fields: this.fields.map((f) => ({ id: f.id, lives: f.lives, limit: f.limit, count: f.count, enemies: this.enemies.filter((e) => e.field === f.id).length, boss: bossOf(f.id) })),
      event: this.event ? { idx: this.event.idx, left: Math.max(0, Math.ceil(this.event.deadline - this.time)) } : null,
      nextEvent: (D.EVENTS.find((e) => e.wave > this.wave) || {}).wave || null,
      eventsDone: this.eventsDone, discovered: this.discovered, revealed: this.revealed,
      story: { cleared: this.story.cleared, active: this.story.active, left: this.story.active ? Math.max(0, Math.ceil(this.story.deadline - this.time)) : 0, cd: Math.max(0, Math.ceil(this.story.cdUntil - this.time)), states: D.STORY.map((s) => this.storyState(s)) },
      players: this.players.map((p) => ({
        id: p.id, gold: p.gold, upg: p.upg, bless: p.bless, choice: p.choice, skillCd: Math.ceil(p.skillCd), skillMax: Math.round(this.skillMax(p)), kills: p.kills, damage: Math.round(p.damage),
        cost: this.summonCost(p, false), pcost: this.summonCost(p, true), ucost: { blade: this.upgradeCost(p, 'blade'), bow: this.upgradeCost(p, 'bow'), magic: this.upgradeCost(p, 'magic') },
        rain: p.goldRainUntil > this.time, temper: p.temperUntil > this.time, units: this.units.filter((u) => u.owner === p.idx).length,
        missions: D.MISSIONS.map((m) => [m.id, Math.min(m.goal, this.missionValue(p, m.stat)), p.done.includes(m.id) ? 1 : 0]), tickets: p.tickets, heroChoice: p.heroChoice,
        items: p.items, craftable: this.craftable(p),
      })),
      units: this.units.map((u) => [u.id, u.owner, u.type, u.x, u.y, Math.round(u.dmg || 0), D.UNIT_MAP[u.type].hero ? D.heroLevel(u.kills || 0) : 0, u.kills || 0, u.field]),
      enemies: this.enemies.map((e) => [e.id, e.k, Math.round(e.x * 100), Math.round(e.y * 100), Math.round((e.hp / e.maxHp) * 100), (e.slowUntil > this.time || this.globalSlowUntil > this.time ? 1 : 0) | (e.stunUntil > this.time ? 2 : 0) | (e.burn && e.burn.until > this.time ? 4 : 0) | (e.poison && e.poison.until > this.time ? 8 : 0) | (e.flying ? 16 : 0) | (e.boss ? 32 : 0) | (e.mini ? 64 : 0), e.field]),
      zones: this.zones.map((z) => [Math.round(z.x * 10), Math.round(z.y * 10), z.r, z.field]),
      fx, msgs, result: this.result,
    };
  }
}

// ───────── AI 동료 / 테스트용 봇 ─────────
function botAct(g, p) {
  if (g.result) return;
  if (p.choice) g.command(p.id, { t: 'bless', id: p.choice[0] });
  if (p.heroChoice) g.command(p.id, { t: 'hero', id: p.heroChoice[0] });
  // 소환진에 남은 유닛(영웅·조합·보상)은 길 옆으로
  const Fm = g.F['m' + p.idx];
  const inZone = g.units.filter((u) => u.owner === p.idx && u.field === Fm.id && Fm.zone.has(u.x + ',' + u.y));
  if (inZone.length) g.command(p.id, { t: 'autoPlace', units: inZone.map((u) => u.id) });
  // 조합법 (높은 등급부터)
  const can = g.craftable(p).map((id) => D.RECIPE_MAP[id]).sort((a, b) => D.UNIT_MAP[b.out].tier - D.UNIT_MAP[a.out].tier);
  if (can.length) { g.command(p.id, { t: 'craft', recipe: can[0].id }); return; }
  const mine = g.units.filter((u) => u.owner === p.idx);
  const byType = {};
  for (const u of mine) (byType[u.type] ||= []).push(u);
  for (const [type, list] of Object.entries(byType)) {
    const need = D.MERGE_NEED[D.UNIT_MAP[type].tier];
    if (need && list.length >= need + 1) { g.command(p.id, { t: 'merge', unit: list[0].id }); return; }
  }
  // 스토리 이벤트: 정예 둘을 보냄 / 보스 스토리: 셋을 보냄
  if (g.event && !mine.some((u) => u.field === 'ev')) g.command(p.id, { t: 'dispatch', field: 'ev', n: 2 });
  const strong = mine.filter((u) => D.UNIT_MAP[u.type].tier >= 3).length;
  const next = D.STORY.find((s) => g.storyState(s) === 'open');
  if (!g.story.active && next && strong >= 4 + next.ch && g.story.cdUntil <= g.time) g.command(p.id, { t: 'story', id: next.id });
  if (g.story.active && !mine.some((u) => u.field === 'room')) g.command(p.id, { t: 'dispatch', field: 'room', n: 3 });
  // 필살기: 내 전장에서 가장 앞선 요괴
  const front = g.enemies.filter((e) => e.field === 'm' + p.idx);
  if (p.skillCd <= 0 && front.length >= 6) {
    const e = front.reduce((best, x) => (!best || x.travel > best.travel ? x : best), null);
    g.command(p.id, { t: 'skill', x: e.x, y: e.y, field: e.field });
  }
  const cost = g.summonCost(p, false);
  const cnt0 = {};
  for (const u of mine) cnt0[D.UNIT_MAP[u.type].cat] = (cnt0[D.UNIT_MAP[u.type].cat] || 0) + D.UNIT_MAP[u.type].tier;
  const main = Object.keys(D.CATS).sort((a, b) => (cnt0[b] || 0) - (cnt0[a] || 0))[0];
  if (mine.length >= 12 && g.upgradeCost(p, main) <= cost * (1 + g.wave / 8) && p.gold >= g.upgradeCost(p, main)) { g.command(p.id, { t: 'upgrade', cat: main }); return; }
  if (p.gold >= cost && mine.length < D.ECON.maxUnits - 2) { g.command(p.id, { t: 'summon' }); return; }
  if (mine.length >= D.ECON.maxUnits - 2) {
    const weak = mine.find((u) => D.UNIT_MAP[u.type].tier === 1 && byType[u.type].length === 1);
    if (weak) g.command(p.id, { t: 'sell', unit: weak.id });
  }
  if (p.gold >= g.upgradeCost(p, main) + (mine.length < D.ECON.maxUnits - 2 ? cost : 0)) g.command(p.id, { t: 'upgrade', cat: main });
}

module.exports = { Game, botAct, hpBase, DT };
