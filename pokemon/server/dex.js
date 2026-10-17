'use strict';
// 포켓몬 자료 도우미: 능력치 계산, 경험치, 기술 배우기, 진화 (2세대 규칙)
const crypto = require('crypto');
const ko = require('./ko');

const D = { world: null };

function init(world) {
  D.world = world;
  D.species = world.species;
  D.moves = world.moves;
  D.items = world.items;
  D.moveById = {};
  for (const m of Object.values(world.moves)) D.moveById[m.id] = m;
  D.speciesByConst = {};
  for (const s of Object.values(world.species)) D.speciesByConst[s.const] = s;
  D.chart = {};
  for (const [a, d, x] of world.matchups) D.chart[a + '>' + d] = x;
  ko.bindMoves(world.moves);
}

const randInt = (n) => crypto.randomInt(n);
const PHYSICAL = new Set(['NORMAL', 'FIGHTING', 'FLYING', 'POISON', 'GROUND', 'ROCK', 'BIRD', 'BUG', 'GHOST', 'STEEL', 'CURSE_TYPE']);

function typeEff(atkType, defTypes, foresight = false) {
  let x = 1;
  for (const t of defTypes) {
    const v = D.chart[atkType + '>' + t];
    if (v === undefined) continue;
    if (v === 0 && foresight && t === 'GHOST') continue;
    x *= v;
  }
  return x;
}

// ── 경험치 곡선
function expForLevel(growth, n) {
  if (n <= 1) return 0;
  switch (growth) {
    case 'FAST': return Math.floor(4 * n ** 3 / 5);
    case 'MEDIUM_SLOW': return Math.max(0, Math.floor(6 * n ** 3 / 5 - 15 * n * n + 100 * n - 140));
    case 'SLOW': return Math.floor(5 * n ** 3 / 4);
    case 'SLIGHTLY_FAST': return Math.floor(3 * n ** 3 / 4 + 10 * n * n - 30);
    case 'SLIGHTLY_SLOW': return Math.floor(3 * n ** 3 / 4 + 20 * n * n - 70);
    default: return n ** 3;
  }
}

function hpDV(dv) { return ((dv.atk & 1) << 3) | ((dv.def & 1) << 2) | ((dv.spd & 1) << 1) | (dv.spc & 1); }
function isShiny(dv) { return dv.def === 10 && dv.spd === 10 && dv.spc === 10 && [2, 3, 6, 7, 10, 11, 14, 15].includes(dv.atk); }

/** 능력치 [HP, 공격, 방어, 스피드, 특공, 특방] */
function calcStats(mon) {
  const s = D.species[mon.species];
  const dv = mon.dvs;
  const dvs = [hpDV(dv), dv.atk, dv.def, dv.spd, dv.spc, dv.spc];
  const se = mon.statExp || [0, 0, 0, 0, 0];
  const ses = [se[0], se[1], se[2], se[3], se[4], se[4]];
  return s.base.map((b, i) => {
    const core = Math.floor((((b + dvs[i]) * 2 + Math.floor(Math.ceil(Math.sqrt(ses[i])) / 4)) * mon.level) / 100);
    return i === 0 ? core + mon.level + 10 : core + 5;
  });
}

function refreshStats(mon) {
  const old = mon.stats ? mon.stats[0] : null;
  mon.stats = calcStats(mon);
  if (old == null) mon.hp = mon.stats[0];
  else mon.hp = Math.max(mon.hp > 0 ? 1 : 0, Math.min(mon.stats[0], mon.hp + (mon.stats[0] - old)));
}

/** 레벨까지 배우는 기술 중 마지막 4개 */
function defaultMoves(speciesId, level) {
  const ls = (D.species[speciesId].learnset || []).filter(([lv]) => lv <= level).map(([, m]) => m);
  const uniq = [];
  for (const m of ls) { const i = uniq.indexOf(m); if (i >= 0) uniq.splice(i, 1); uniq.push(m); }
  return uniq.slice(-4);
}

let uidSeq = 0;
function newUid() { return Date.now().toString(36) + (uidSeq++).toString(36) + randInt(1e6).toString(36); }

function makeMon(speciesId, level, opts = {}) {
  const s = D.species[speciesId];
  const dvs = opts.dvs || { atk: randInt(16), def: randInt(16), spd: randInt(16), spc: randInt(16) };
  const mon = {
    uid: newUid(), species: speciesId, level, exp: expForLevel(s.growth, level),
    dvs, statExp: [0, 0, 0, 0, 0],
    moves: (opts.moves && opts.moves.length ? opts.moves : defaultMoves(speciesId, level)).filter((m) => D.moves[m]).map((m) => ({ id: m, pp: D.moves[m].pp, max: D.moves[m].pp })),
    status: null, sleep: 0, item: opts.item || null, happiness: opts.happiness ?? 70,
    ot: opts.ot || null, otId: opts.otId || null, ball: opts.ball || 'POKE_BALL', metAt: opts.metAt || null,
  };
  mon.shiny = isShiny(dvs);
  // 성별: 공격 DV 와 성비로 (2세대 방식)
  const g = s.gender;
  const thr = { F0: -1, F12_5: 1, F25: 3, F50: 7, F75: 11, F100: 16, UNKNOWN: null }[g];
  mon.gender = thr === null ? null : thr === undefined ? null : (dvs.atk <= thr ? 'F' : 'M');
  if (g === 'F0') mon.gender = 'M';
  if (g === 'F100') mon.gender = 'F';
  refreshStats(mon);
  return mon;
}

function displayName(mon) { return mon.nick || ko.speciesName(mon.species); }

/** 경험치 더하기 → 오른 레벨 목록과 새로 배울 기술 */
function gainExp(mon, amount) {
  const s = D.species[mon.species];
  const out = { levels: [], learn: [] };
  if (mon.level >= 100) return out;
  mon.exp += amount;
  while (mon.level < 100 && mon.exp >= expForLevel(s.growth, mon.level + 1)) {
    mon.level++;
    refreshStats(mon);
    out.levels.push(mon.level);
    for (const [lv, m] of s.learnset || []) if (lv === mon.level && !mon.moves.some((x) => x.id === m)) out.learn.push(m);
  }
  if (mon.level >= 100) mon.exp = expForLevel(s.growth, 100);
  return out;
}

/** 기술 배우기: 빈칸이면 바로 배우고 true, 꽉 찼으면 false */
function learnMove(mon, moveId, replaceIdx = -1) {
  const mv = D.moves[moveId];
  if (!mv || mon.moves.some((m) => m.id === moveId)) return true;
  const slot = { id: moveId, pp: mv.pp, max: mv.pp };
  if (replaceIdx >= 0 && replaceIdx < mon.moves.length) { mon.moves[replaceIdx] = slot; return true; }
  if (mon.moves.length < 4) { mon.moves.push(slot); return true; }
  return false;
}

/** 시간대: 아침 4~10, 낮 10~18, 밤 18~4 */
function timeOfDay(date = new Date()) {
  const h = date.getHours();
  return h >= 4 && h < 10 ? 'morn' : h >= 10 && h < 18 ? 'day' : 'nite';
}

/** 진화할지: 레벨업/행복/능력치 조건 (아이템·교환은 따로) */
function levelEvolution(mon) {
  const s = D.species[mon.species];
  for (const e of s.evos || []) {
    if (e.kind === 'LEVEL' && mon.level >= e.param) return e.into;
    if (e.kind === 'HAPPINESS' && mon.happiness >= 220) {
      const t = timeOfDay();
      if (e.param === 'TR_ANYTIME' || (e.param === 'TR_MORNDAY' && t !== 'nite') || (e.param === 'TR_NITE' && t === 'nite')) return e.into;
    }
    if (e.kind === 'STAT' && mon.level >= e.level) {
      const [, a, d] = mon.stats;
      if ((e.stat === 'ATK_LT_DEF' && a < d) || (e.stat === 'ATK_GT_DEF' && a > d) || (e.stat === 'ATK_EQ_DEF' && a === d)) return e.into;
    }
  }
  return null;
}
function itemEvolution(mon, item) {
  for (const e of D.species[mon.species].evos || []) if (e.kind === 'ITEM' && e.param === item) return e.into;
  return null;
}
function tradeEvolution(mon) {
  for (const e of D.species[mon.species].evos || []) {
    if (e.kind !== 'TRADE') continue;
    if (e.param === '-1' || e.param === -1) return { into: e.into };
    if (mon.item === e.param) return { into: e.into, useItem: true };
  }
  return null;
}
function evolve(mon, into) {
  const wasNamed = mon.nick;
  mon.species = into;
  refreshStats(mon);
  if (!wasNamed) delete mon.nick;
  const learn = [];
  for (const [lv, m] of D.species[into].learnset || []) if (lv === mon.level && !mon.moves.some((x) => x.id === m)) learn.push(m);
  return learn;
}

function canLearnTM(mon, move) { return (D.species[mon.species].tmhm || []).includes(move); }

function healMon(mon) {
  mon.hp = mon.stats[0];
  mon.status = null; mon.sleep = 0;
  for (const m of mon.moves) m.pp = m.max;
}

/** 화면에 보낼 포켓몬 정보 */
function publicMon(mon, full = true) {
  if (!mon) return null;
  const s = D.species[mon.species];
  const o = {
    uid: mon.uid, species: mon.species, name: displayName(mon), level: mon.level, hp: mon.hp, maxhp: mon.stats[0],
    status: mon.status, gender: mon.gender, shiny: !!mon.shiny, types: s.types, egg: !!mon.egg,
  };
  if (full) {
    const nextExp = mon.level >= 100 ? mon.exp : expForLevel(s.growth, mon.level + 1);
    Object.assign(o, {
      stats: mon.stats, exp: mon.exp, expBase: expForLevel(s.growth, mon.level), expNext: nextExp, item: mon.item, happiness: mon.happiness, ot: mon.ot, dvs: mon.dvs,
      moves: mon.moves.map((m) => ({ id: m.id, name: ko.moveName(m.id), pp: m.pp, max: m.max, type: D.moves[m.id].type, power: D.moves[m.id].power, acc: D.moves[m.id].acc })),
    });
  }
  return o;
}

module.exports = { D, init, randInt, PHYSICAL, typeEff, expForLevel, calcStats, refreshStats, defaultMoves, makeMon, displayName, gainExp, learnMove, timeOfDay, levelEvolution, itemEvolution, tradeEvolution, evolve, canLearnTM, healMon, publicMon, isShiny, hpDV };
