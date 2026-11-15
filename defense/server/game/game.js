'use strict';
// 요괴 퇴마 디펜스 — 실시간 시뮬레이션 (서버가 모든 계산을 하고 화면에는 결과만 보냄)
const D = require('./data');
const M = require('./maps');

const DT = 0.05; // 1틱 = 0.05초

/** 웨이브 기본 체력 */
function hpBase(w) { return Math.round(22 * Math.pow(1.18, Math.min(w, 25) - 1) * Math.pow(1.125, Math.max(0, w - 25)) * (1 + w * 0.03)); }
function killGold(w) { return 2 + Math.floor(w / 8); }

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
    this.solo = roster.length === 1;
    this.players = roster.map((p, i) => ({
      id: p.id, name: p.name, idx: i, bot: !!p.bot, leader: D.LEADER_MAP[p.leader] ? p.leader : D.LEADERS[i % D.LEADERS.length].id,
      gold: D.ECON.startGold, upg: { blade: 0, bow: 0, magic: 0 }, bless: [], choice: null, skillCd: 8, kills: 0, damage: 0, summons: 0,
      goldRainUntil: 0, temperUntil: 0,
    }));
    this.units = [];
    this.enemies = [];
    this.zones = []; // 화살비 같은 지속 효과
    this.nextId = 1;
    this.time = 0;
    this.wave = 0;
    this.waveTimer = 6; // 첫 웨이브까지
    this.spawnQueue = [];
    this.lives = this.diff.lives;
    this.limit = this.diff.limit;
    this.result = null;
    this.fx = [];
    this.msgs = [];
    this.globalSlowUntil = 0;
    // 길 미리 계산
    this.paths = this.map.paths.map((p) => {
      const pts = p.pts.map(([x, y]) => [x + 0.5, y + 0.5]);
      if (p.loop) pts.push(pts[0]);
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      return { pts, cum, len: cum[cum.length - 1], loop: p.loop };
    });
    this.blocked = new Set();
    for (const [x, y] of this.map.pathTiles) this.blocked.add(x + ',' + y);
    for (const [x, y] of this.map.decor) this.blocked.add(x + ',' + y);
    // 길 옆 자리(자동 배치용) — 길과 가까운 순
    this.spots = [];
    for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) {
      if (this.blocked.has(x + ',' + y)) continue;
      let d = 99;
      for (const [px, py] of this.map.pathTiles) d = Math.min(d, Math.max(Math.abs(px - x), Math.abs(py - y)));
      this.spots.push({ x, y, d });
    }
    this.nextPlan = this.planWave(1);
  }

  // ───────── 도우미 ─────────
  pick(arr) { return arr[Math.floor(this.rand() * arr.length)]; }
  player(id) { return this.players.find((p) => p.id === id); }
  msg(text, kind = 'info') { this.msgs.push({ text, kind, at: this.time }); }
  occupied(x, y) { return this.units.some((u) => u.x === x && u.y === y); }
  free(x, y) { return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < M.W && y < M.H && !this.blocked.has(x + ',' + y) && !this.occupied(x, y); }
  autoSpot(owner) {
    // 같은 편 유닛 근처 + 길에 가까운 빈칸 (쌍둥이 맵이면 내 쪽 절반 우선)
    const half = this.players.length > 1 && this.map.paths.length > 1;
    const me = this.player(owner);
    let best = null, bs = Infinity;
    for (const s of this.spots) {
      if (this.occupied(s.x, s.y)) continue;
      let score = s.d * 10 + this.rand() * 4;
      if (half) score += ((me.idx === 0) === (s.x < M.W / 2) ? 0 : 25);
      if (score < bs) { bs = score; best = s; }
    }
    return best;
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
    return {
      wave: p.wave, main: D.ENEMIES[p.main].name, mainIcon: D.ENEMIES[p.main].icon, second: p.second && p.second !== p.main ? D.ENEMIES[p.second].name : null,
      mod: p.mod ? D.MODIFIERS.find((m) => m.id === p.mod) : null, boss: boss ? { name: boss.name, icon: boss.icon, desc: boss.desc } : null, mini: p.mini, count: p.count,
      flying: p.main === 'crow' || p.second === 'crow',
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
  }

  spawn(s) {
    const w = this.wave;
    const base = hpBase(w) * this.diff.hp * (this.solo ? 0.7 : 1);
    let e;
    if (s.boss) {
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
    if (w > D.WAVES) e.hp *= Math.pow(1.12, w - D.WAVES);
    e.hp = Math.round(e.hp);
    e.maxHp = e.hp;
    e.id = this.nextId++;
    e.path = s.path ?? (this.spawnCounter = (this.spawnCounter || 0) + 1) % this.paths.length;
    e.dist = s.dist || 0;
    e.travel = s.dist || 0;
    e.slowPct = 0; e.slowUntil = 0; e.stunUntil = 0; e.shred = 0; e.shredUntil = 0;
    e.poison = null; e.burn = null; e.laps = 0;
    this.placeEnemy(e);
    this.enemies.push(e);
    return e;
  }

  placeEnemy(e) {
    const p = this.paths[e.path];
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
    // 오라 (아군 전체에 적용: 둘이 붙어서 세우면 서로 도움이 됨)
    for (const o of this.units) {
      if (o === u) continue;
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
    if (e.evade && !opts.dot && this.rand() < e.evade) { this.fx.push(['miss', Math.round(e.x * 10), Math.round(e.y * 10)]); return 0; }
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
    if (e.hp <= 0.5) this.kill(e, u ? u.owner : opts.by);
    return a;
  }

  kill(e, by) {
    e.hp = 0;
    e.dead = true;
    const w = this.wave;
    for (const p of this.players) {
      let g = e.gold * this.diff.gold;
      if (p.goldRainUntil > this.time) g *= 3;
      p.gold += Math.round(g);
    }
    if (by != null && this.players[by]) this.players[by].kills++;
    this.fx.push(['die', Math.round(e.x * 10), Math.round(e.y * 10), e.boss ? 2 : e.mini ? 1 : 0]);
    if (e.split) {
      for (let i = 0; i < e.split; i++) {
        const c = this.spawn({ type: 'slime', path: e.path, dist: Math.max(0, e.dist - 0.3 * i) });
        c.split = 0; c.hp = c.maxHp = Math.round(e.maxHp * 0.4); c.k = 'slime_s'; c.gold = 0; c.laps = e.laps; c.travel = e.travel;
      }
    }
    if (e.treasure) {
      for (const p of this.players) {
        if (this.rand() < 0.35) { const u = this.giveUnit(p, this.rand() < 0.15 ? 3 : 2); this.msg(`🐸 보물 두꺼비! ${p.name}: ${u ? D.UNIT_MAP[u.type].name + ' 획득' : '자리가 없어 골드로'}`, 'good'); if (!u) p.gold += 150; }
        else { const g = 120 + w * 12; p.gold += g; this.msg(`🐸 보물 두꺼비! ${p.name}: 골드 +${g}`, 'good'); }
      }
    }
    if (e.boss || e.mini) {
      this.msg(e.boss ? `🏆 보스 「${e.name}」 처치! 축복을 하나 고르세요.` : `👿 ${e.name} 처치! 축복을 하나 고르세요.`, 'good');
      for (const p of this.players) this.offerBlessing(p);
    }
  }

  offerBlessing(p) {
    const pool = D.BLESSINGS.map((b) => b.id);
    const opts = [];
    while (opts.length < 3) { const b = this.pick(pool); if (!opts.includes(b)) opts.push(b); }
    if (p.choice) this.applyBlessing(p, p.choice[0]); // 못 고른 게 남아 있으면 첫 번째로
    p.choice = opts;
  }

  applyBlessing(p, id) {
    p.bless.push(id);
    if (id === 'gold') p.gold += 300;
    if (id === 'free') { this.giveUnit(p, 2, true); this.giveUnit(p, 2, true); }
  }

  /** 등급을 정해 유닛 주기 (auto: 빈자리 자동) */
  giveUnit(p, tier, roll = false, spot = null) {
    if (this.units.filter((u) => u.owner === p.idx).length >= D.ECON.maxUnits) return null;
    let t = tier;
    if (roll && tier === 2) t = this.rand() < 0.15 ? 3 : 2;
    const s = spot || this.autoSpot(p.id);
    if (!s) return null;
    const u = { id: this.nextId++, owner: p.idx, type: this.pick(D.BY_TIER[t]), x: s.x, y: s.y, cdLeft: 0.3, dmg: 0, born: this.time };
    this.units.push(u);
    this.fx.push(['summon', u.x, u.y, t]);
    if (t >= 4) this.msg(`✨ ${p.name}: ${D.TIERS[t - 1].name} 「${D.UNIT_MAP[u.type].icon} ${D.UNIT_MAP[u.type].name}」!`, t === 5 ? 'myth' : 'legend');
    return u;
  }

  rollTier(p, premium) {
    let odds = (premium ? D.PREMIUM_ODDS : D.SUMMON_ODDS).slice();
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

  // ───────── 명령 ─────────
  /** @returns {string|null} 오류 메시지 */
  command(pid, c) {
    const p = this.player(pid);
    if (!p || !c || this.result) return null;
    const unit = (id) => this.units.find((u) => u.id === id && u.owner === p.idx);
    switch (c.t) {
      case 'summon': {
        const premium = !!c.premium;
        const cost = this.summonCost(p, premium);
        if (p.gold < cost) return '골드가 부족해요.';
        if (this.units.filter((u) => u.owner === p.idx).length >= D.ECON.maxUnits) return `유닛은 한 사람당 ${D.ECON.maxUnits}개까지예요.`;
        let spot = null;
        if (c.tile) { if (!this.free(c.tile[0], c.tile[1])) return '거기에는 세울 수 없어요.'; spot = { x: c.tile[0], y: c.tile[1] }; }
        else if (!(spot = this.autoSpot(pid))) return '빈자리가 없어요.';
        p.gold -= cost;
        p.summons++;
        const u = this.giveUnit(p, this.rollTier(p, premium), false, spot);
        return u ? { ok: u.id } : null;
      }
      case 'move': {
        const u = unit(c.unit);
        if (!u || !c.tile) return null;
        if (!this.free(c.tile[0], c.tile[1])) return '거기에는 세울 수 없어요.';
        u.x = c.tile[0]; u.y = c.tile[1]; u.cdLeft = Math.max(u.cdLeft, 0.5);
        return null;
      }
      case 'swap': {
        // 내 유닛 두 개 자리 바꾸기
        const a = unit(c.unit), b = unit(c.other);
        if (!a || !b) return null;
        [a.x, b.x] = [b.x, a.x]; [a.y, b.y] = [b.y, a.y];
        return null;
      }
      case 'sell': {
        const u = unit(c.unit);
        if (!u) return null;
        const t = D.UNIT_MAP[u.type];
        p.gold += Math.round(D.ECON.sellRate[t.tier] * (p.leader === 'merchant' ? 1.2 : 1));
        this.units = this.units.filter((x) => x !== u);
        return null;
      }
      case 'merge': {
        const u = unit(c.unit);
        if (!u) return null;
        const t = D.UNIT_MAP[u.type];
        const need = D.MERGE_NEED[t.tier];
        if (!need) return '신화 유닛은 더 합성할 수 없어요.';
        const same = this.units.filter((x) => x !== u && x.owner === p.idx && x.type === u.type).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y));
        if (same.length < need - 1) return `같은 유닛이 ${need}개 있어야 합성할 수 있어요.`;
        const gone = new Set(same.slice(0, need - 1));
        this.units = this.units.filter((x) => !gone.has(x) && x !== u);
        const nu = this.giveUnit(p, t.tier + 1, false, { x: u.x, y: u.y });
        if (nu) { nu.cdLeft = 0.2; this.fx.push(['merge', u.x, u.y, t.tier + 1]); }
        return nu ? { ok: nu.id } : null;
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
      case 'skill': return this.useSkill(p, c);
      case 'ping': {
        if (typeof c.x === 'number' && typeof c.y === 'number') this.fx.push(['ping', Math.round(c.x * 10), Math.round(c.y * 10), p.idx]);
        return null;
      }
      default: return null;
    }
  }

  useSkill(p, c) {
    if (p.skillCd > 0) return `필살기 준비 중 (${Math.ceil(p.skillCd)}초)`;
    const L = D.LEADER_MAP[p.leader];
    const w = Math.max(1, this.wave);
    const x = Number(c.x), y = Number(c.y);
    if (L.skill.target && !(Number.isFinite(x) && Number.isFinite(y))) return '위치를 골라 주세요.';
    switch (p.leader) {
      case 'sword': {
        const dmg = hpBase(w) * this.diff.hp * 7;
        for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) <= 2.6) this.hurt(e, dmg, null, { pierce: true, by: p.idx });
        this.fx.push(['slash', Math.round(x * 10), Math.round(y * 10)]);
        break;
      }
      case 'archer':
        this.zones.push({ x, y, r: 2.3, until: this.time + 5, dps: hpBase(w) * this.diff.hp * 2.2, by: p.idx });
        this.fx.push(['rain', Math.round(x * 10), Math.round(y * 10)]);
        break;
      case 'priest': this.globalSlowUntil = this.time + 6; this.fx.push(['seal']); break;
      case 'merchant': { const g = 100 + w * 15; p.gold += g; p.goldRainUntil = this.time + 10; this.fx.push(['goldrain', p.idx]); break; }
      case 'smith': p.temperUntil = this.time + 8; this.fx.push(['temper', p.idx]); break;
      case 'gambler': {
        const mine = this.units.filter((u) => u.owner === p.idx && D.UNIT_MAP[u.type].tier < 5);
        if (!mine.length) return '올릴 유닛이 없어요.';
        const u = this.pick(mine);
        const before = D.UNIT_MAP[u.type];
        u.type = this.pick(D.BY_TIER[before.tier + 1]);
        this.fx.push(['merge', u.x, u.y, before.tier + 1]);
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
    // 웨이브
    this.waveTimer -= dt;
    const lastWave = !this.endless && this.wave >= D.WAVES;
    if (this.waveTimer <= 0 && !lastWave) this.startWave();
    while (this.spawnQueue.length && this.spawnQueue[0].at <= this.time) this.spawn(this.spawnQueue.shift());
    // 요괴 이동·상태
    const sealed = this.globalSlowUntil > this.time;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.poison && e.poison.until > this.time) this.hurt(e, e.poison.dps * dt, null, { dot: true, by: e.poison.by });
      if (e.burn && e.burn.until > this.time) this.hurt(e, e.burn.dps * dt, null, { dot: true, by: e.burn.by });
      if (e.dead) continue;
      if (e.regen) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.regen * dt);
      if (e.boss) {
        this.bossAbility(e, dt);
        if (this.loopMode && e.deadline <= this.time) {
          e.dead = true; e.gone = true;
          if (e.k === 'b_king' || (!this.endless && this.wave >= D.WAVES)) { this.end(false, `${D.BOSS_TIME}초 안에 「${e.name}」을(를) 쓰러뜨리지 못했어요…`); continue; }
          this.limit -= 10;
          this.fx.push(['leak', 10]);
          this.msg(`💔 「${e.name}」이(가) 결계를 부수고 사라졌어요! 최대 요괴 수 -10 (${this.limit})`, 'bad');
          continue;
        }
      }
      let sp = e.speed;
      if (e.ability === 'rage' || e.ability === 'all') if (e.hp < e.maxHp * 0.5) sp *= 1.6;
      let slow = e.slowUntil > this.time ? e.slowPct : 0;
      if (sealed) slow = Math.max(slow, e.boss ? 0.35 : 0.7);
      if (e.boss) slow *= 0.6;
      sp *= 1 - slow;
      if (e.stunUntil > this.time) sp = 0;
      e.dist += sp * dt;
      e.travel += sp * dt;
      const path = this.paths[e.path];
      if (path.loop) {
        const laps = Math.floor(e.dist / path.len);
        if (laps > e.laps) { e.laps = laps; if (e.treasure) { e.dead = true; e.gone = true; this.msg('🐸 보물 두꺼비가 도망쳤어요…', 'bad'); } }
      } else if (e.dist >= path.len) {
        e.dead = true; e.gone = true;
        if (!e.treasure) {
          const cost = e.boss ? 10 : e.mini ? 3 : 1;
          this.lives -= cost;
          this.fx.push(['leak', cost]);
          if (e.boss || e.mini) this.msg(`💔 ${e.name}이(가) 빠져나갔어요! 생명 -${cost}`, 'bad');
        }
        continue;
      }
      this.placeEnemy(e);
    }
    // 지속 효과
    this.zones = this.zones.filter((z) => z.until > this.time);
    for (const z of this.zones) for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - z.x, e.y - z.y) <= z.r) this.hurt(e, z.dps * dt, null, { dot: true, by: z.by });
    // 유닛 공격
    for (const u of this.units) {
      u.cdLeft -= dt;
      if (u.cdLeft > 0) continue;
      const st = this.unitStats(u);
      const ux = u.x + 0.5, uy = u.y + 0.5;
      const cands = [];
      for (const e of this.enemies) {
        if (e.dead || (e.flying && st.t.cat === 'blade')) continue;
        const d = Math.hypot(e.x - ux, e.y - uy);
        if (d <= st.range) cands.push(e);
      }
      if (!cands.length) { u.cdLeft = 0.1; continue; }
      cands.sort((a, b) => b.travel - a.travel);
      const targets = cands.slice(0, st.t.multi || 1);
      for (const tg of targets) this.attack(u, st, tg);
      u.cdLeft = st.cd;
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    // 패배·승리
    if (this.loopMode) {
      this.count = this.enemies.reduce((s, e) => s + (e.boss ? 10 : e.mini ? 3 : e.treasure ? 0 : 1), 0);
      if (this.count >= this.limit) this.end(false, `요괴가 ${this.limit}마리 넘게 쌓였어요…`);
    } else if (this.lives <= 0) { this.lives = 0; this.end(false, '마을 결계가 무너졌어요…'); }
    if (!this.result && !this.endless && this.wave >= D.WAVES && !this.spawnQueue.length && !this.enemies.length) this.end(true, `${D.WAVES}웨이브를 모두 막아냈어요!`);
    // 봇
    if (Math.floor(this.time / dt) % 10 === 0) for (const p of this.players) if (p.bot) botAct(this, p);
  }

  bossAbility(e, dt) {
    e.abilT += dt;
    const ab = e.ability;
    if ((ab === 'brood' || ab === 'all') && e.abilT % 6 < dt) {
      for (let i = 0; i < 3; i++) {
        const c = this.spawn({ type: 'imp', path: e.path, dist: Math.max(0, e.dist - 0.4 * (i + 1)) });
        c.hp = c.maxHp = Math.round(e.maxHp * 0.012); c.gold = 1; c.laps = e.laps; c.travel = e.travel - 0.4 * (i + 1);
      }
      this.fx.push(['brood', Math.round(e.x * 10), Math.round(e.y * 10)]);
    }
    if ((ab === 'heal' || ab === 'all') && (e.abilT + 3) % 10 < dt) {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.04);
      this.fx.push(['heal', Math.round(e.x * 10), Math.round(e.y * 10)]);
    }
  }

  attack(u, st, tg) {
    const t = st.t;
    const p = this.players[u.owner];
    let dmg = st.dmg;
    let crit = false;
    if (t.crit && this.rand() < t.crit.chance) { dmg *= t.crit.mult; crit = true; }
    if (p.bless.includes('crit') && this.rand() < 0.1 * p.bless.filter((b) => b === 'crit').length) { dmg *= 2; crit = true; }
    const kind = t.chain ? 'chain' : t.splash ? 'splash' : t.cat;
    this.fx.push(['atk', u.x, u.y, Math.round(tg.x * 10), Math.round(tg.y * 10), kind, t.tier, crit ? 1 : 0]);
    const hit = (e, amt) => {
      if (t.execute && !e.boss && !e.mini && e.hp - amt <= e.maxHp * t.execute) amt = e.hp + 1;
      this.hurt(e, amt, u, { pierce: t.pierceArmor });
      if (t.slow && (e.slowUntil <= this.time || e.slowPct <= t.slow.pct)) { e.slowPct = t.slow.pct; e.slowUntil = this.time + t.slow.dur; }
      if (t.poison && (!e.poison || e.poison.until < this.time || e.poison.dps <= t.poison.dps)) e.poison = { dps: t.poison.dps * (1 + D.ECON.upgradeStep * p.upg[t.cat]), until: this.time + t.poison.dur, by: u.owner };
      if (t.burn && (!e.burn || e.burn.until < this.time || e.burn.dps <= t.burn.dps)) e.burn = { dps: t.burn.dps * (1 + D.ECON.upgradeStep * p.upg[t.cat]), until: this.time + t.burn.dur, by: u.owner };
      if (t.shred) { e.shred = Math.min(10, (e.shredUntil > this.time ? e.shred : 0) + t.shred); e.shredUntil = this.time + 5; }
      if (t.stun && !e.boss && this.rand() < t.stun.chance) e.stunUntil = this.time + t.stun.dur;
    };
    hit(tg, dmg);
    if (t.splash) for (const e of this.enemies) if (e !== tg && !e.dead && Math.hypot(e.x - tg.x, e.y - tg.y) <= t.splash && !(e.flying && t.cat === 'blade')) hit(e, dmg * 0.7);
    if (t.chain) {
      let cur = tg, amt = dmg;
      const done = new Set([tg]);
      for (let i = 0; i < t.chain; i++) {
        let best = null, bd = 2.2;
        for (const e of this.enemies) { if (e.dead || done.has(e)) continue; const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < bd) { bd = d; best = e; } }
        if (!best) break;
        amt *= 0.85;
        this.fx.push(['zap', Math.round(cur.x * 10), Math.round(cur.y * 10), Math.round(best.x * 10), Math.round(best.y * 10)]);
        hit(best, amt);
        done.add(best); cur = best;
      }
    }
  }

  end(win, reason) {
    if (this.result) return;
    this.result = { win, reason, wave: this.wave, time: Math.round(this.time) };
    this.msg(win ? `🎉 승리! ${reason}` : `💀 패배… ${reason}`, win ? 'good' : 'bad');
  }

  // ───────── 화면용 ─────────
  staticView() {
    return { map: M.summary(this.map), loopMode: this.loopMode, diff: this.diff, seed: this.seed, players: this.players.map((p) => ({ id: p.id, name: p.name, leader: p.leader, bot: p.bot })) };
  }

  /** 자주 보내는 상태 (작게) */
  view() {
    const fx = this.fx; this.fx = [];
    const msgs = this.msgs; this.msgs = [];
    return {
      time: Math.round(this.time * 100) / 100, wave: this.wave, waves: D.WAVES, endless: this.endless, nextIn: Math.max(0, Math.ceil(this.waveTimer)), lastWave: !this.endless && this.wave >= D.WAVES,
      cur: this.planInfo(this.curPlan), next: this.planInfo(this.nextPlan), lives: this.lives, limit: this.limit, count: this.count || 0, sealed: this.globalSlowUntil > this.time,
      players: this.players.map((p) => ({
        id: p.id, gold: p.gold, upg: p.upg, bless: p.bless, choice: p.choice, skillCd: Math.ceil(p.skillCd), skillMax: Math.round(this.skillMax(p)), kills: p.kills, damage: Math.round(p.damage),
        cost: this.summonCost(p, false), pcost: this.summonCost(p, true), ucost: { blade: this.upgradeCost(p, 'blade'), bow: this.upgradeCost(p, 'bow'), magic: this.upgradeCost(p, 'magic') },
        rain: p.goldRainUntil > this.time, temper: p.temperUntil > this.time, units: this.units.filter((u) => u.owner === p.idx).length,
      })),
      units: this.units.map((u) => [u.id, u.owner, u.type, u.x, u.y, Math.round(u.dmg || 0)]),
      enemies: this.enemies.map((e) => [e.id, e.k, Math.round(e.x * 100), Math.round(e.y * 100), Math.round((e.hp / e.maxHp) * 100), (e.slowUntil > this.time || this.globalSlowUntil > this.time ? 1 : 0) | (e.stunUntil > this.time ? 2 : 0) | (e.burn && e.burn.until > this.time ? 4 : 0) | (e.poison && e.poison.until > this.time ? 8 : 0) | (e.flying ? 16 : 0) | (e.boss ? 32 : 0) | (e.mini ? 64 : 0)]),
      zones: this.zones.map((z) => [Math.round(z.x * 10), Math.round(z.y * 10), z.r]),
      fx, msgs, result: this.result,
      boss: (() => { const b = this.enemies.find((e) => e.boss) || this.enemies.find((e) => e.mini); return b ? { name: b.name, hp: Math.round(b.hp), max: b.maxHp, left: b.deadline && this.loopMode ? Math.max(0, Math.ceil(b.deadline - this.time)) : null } : null; })(),
    };
  }
}

// ───────── AI 동료 / 테스트용 봇 ─────────
function botAct(g, p) {
  if (g.result) return;
  if (p.choice) g.command(p.id, { t: 'bless', id: p.choice[0] });
  // 합성할 수 있으면 합성
  const mine = g.units.filter((u) => u.owner === p.idx);
  const byType = {};
  for (const u of mine) (byType[u.type] ||= []).push(u);
  for (const [type, list] of Object.entries(byType)) {
    const need = D.MERGE_NEED[D.UNIT_MAP[type].tier];
    if (need && list.length >= need) { g.command(p.id, { t: 'merge', unit: list[0].id }); return; }
  }
  // 필살기: 요괴가 많은 곳
  if (p.skillCd <= 0 && g.enemies.length >= 6) {
    const e = g.enemies.reduce((best, x) => (!best || x.travel > best.travel ? x : best), null);
    g.command(p.id, { t: 'skill', x: e.x, y: e.y });
  }
  // 소환 우선, 자리가 차면 강화
  const cost = g.summonCost(p, false);
  const cats0 = Object.keys(D.CATS);
  const cnt0 = {};
  for (const u of mine) cnt0[D.UNIT_MAP[u.type].cat] = (cnt0[D.UNIT_MAP[u.type].cat] || 0) + D.UNIT_MAP[u.type].tier;
  const main = cats0.sort((a, b) => (cnt0[b] || 0) - (cnt0[a] || 0))[0];
  if (mine.length >= 12 && g.upgradeCost(p, main) <= cost * (1 + g.wave / 8) && p.gold >= g.upgradeCost(p, main)) { g.command(p.id, { t: 'upgrade', cat: main }); return; }
  if (p.gold >= cost && mine.length < D.ECON.maxUnits - 2) { g.command(p.id, { t: 'summon' }); return; }
  if (mine.length >= D.ECON.maxUnits - 2) {
    // 약한 유닛 팔기 (같은 게 1개뿐인 일반 등급)
    const weak = mine.find((u) => D.UNIT_MAP[u.type].tier === 1 && byType[u.type].length === 1);
    if (weak) g.command(p.id, { t: 'sell', unit: weak.id });
  }
  const cats = Object.keys(D.CATS);
  const counts = {};
  for (const u of mine) counts[D.UNIT_MAP[u.type].cat] = (counts[D.UNIT_MAP[u.type].cat] || 0) + D.UNIT_MAP[u.type].tier;
  const cat = cats.sort((a, b) => (counts[b] || 0) - (counts[a] || 0))[0];
  if (p.gold >= g.upgradeCost(p, cat) + (mine.length < D.ECON.maxUnits - 2 ? cost : 0)) g.command(p.id, { t: 'upgrade', cat });
}

module.exports = { Game, botAct, hpBase, DT };
