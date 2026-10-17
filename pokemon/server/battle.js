'use strict';
// 배틀 엔진 (2세대 금·은 규칙 기반)
// 한 판에 두 편(side)이 있고, 편마다 자리(slot)가 1~2개. 자리마다 조종하는 사람(ctrl)이 있다.
//  - 야생 1:1, 트레이너 1:1, 대결(1:1 / 2:2), 협동(두 사람이 한 편 → 야생 2마리·트레이너와 2:2)
const EventEmitter = require('events');
const dex = require('./dex');
const ko = require('./ko');

const { D, randInt, PHYSICAL, typeEff } = dex;
const STAGE = [25, 28, 33, 40, 50, 66, 100, 150, 200, 250, 300, 350, 400];
const ACC_STAGE = [33, 36, 43, 50, 60, 75, 100, 133, 166, 200, 233, 266, 300];
const CRIT = [17, 32, 64, 85, 128];
const STAT_KO = { atk: '공격', def: '방어', spe: '스피드', spa: '특수공격', spd: '특수방어', acc: '명중률', eva: '회피율' };
const HIGH_CRIT = new Set(['KARATE_CHOP', 'RAZOR_LEAF', 'CRABHAMMER', 'SLASH', 'AEROBLAST', 'CROSS_CHOP']);
const SOUND_PRIO = { PROTECT: 3, ENDURE: 3, PRIORITY_HIT: 2, FORCE_SWITCH: 0, COUNTER: 0, MIRROR_COAT: 0 };
const CHARGE_MOVES = { FLY: 'fly', DIG: 'dig' };
const BALL_BONUS = { MASTER_BALL: 255, ULTRA_BALL: 2, GREAT_BALL: 1.5, POKE_BALL: 1, PARK_BALL: 1.5, FAST_BALL: 1, LEVEL_BALL: 1, LURE_BALL: 1, HEAVY_BALL: 1, LOVE_BALL: 1, FRIEND_BALL: 1, MOON_BALL: 1 };

const pick = (arr) => (arr.length ? arr[randInt(arr.length)] : undefined);
const chance256 = (n) => randInt(256) < n;
const J = ko.josa;

function newVol() {
  return {
    st: { atk: 0, def: 0, spe: 0, spa: 0, spd: 0, acc: 0, eva: 0 }, confused: 0, toxicN: 0, seeded: null, trap: 0, trapMove: null,
    sub: 0, charging: null, invuln: null, recharge: false, rampage: null, rollout: 0, furyCutter: 0, protect: false, endure: false, protectN: 0,
    focus: false, foresight: false, lockOn: 0, nightmare: false, curse: false, perish: 0, destinyBond: false, disabled: null, encore: null,
    transformed: null, types: null, lastMove: null, hurt: null, flinch: false, attract: null, curl: false, meanLook: false, bide: null, rage: false, mimic: null,
  };
}

class Battle extends EventEmitter {
  /**
   * opts.kind: 'wild' | 'trainer' | 'pvp'
   * opts.sides: [{ name, ctrls: [{ id, human, name, party, ai, slots }] }, ...]
   *   ctrl.slots: 이 사람이 차지하는 자리 수 (보통 1, 혼자 2:2 대결이면 2)
   */
  constructor(opts) {
    super();
    this.kind = opts.kind;
    this.id = opts.id || Math.random().toString(36).slice(2, 10);
    this.trainer = opts.trainer || null; // { cls, name, reward, pic, beaten }
    this.sides = opts.sides.map((s, si) => {
      const side = { idx: si, name: s.name, ctrls: [], slots: [], scr: { reflect: 0, light: 0, safeguard: 0, mist: 0, spikes: 0 } };
      s.ctrls.forEach((c, ci) => {
        const ctrl = { idx: ci, side: si, id: c.id, human: !!c.human, name: c.name, party: c.party, ai: c.ai || null, bag: c.bag || null, out: false };
        side.ctrls.push(ctrl);
        const n = c.slots || 1;
        let used = 0;
        for (let k = 0; k < n; k++) {
          const pi = ctrl.party.findIndex((m, i) => m && m.hp > 0 && !m.egg && !side.slots.some((sl) => sl.ctrl === ctrl && sl.pi === i));
          const slot = { side: si, idx: side.slots.length, ctrl, pi: pi >= 0 ? pi : -1, mon: pi >= 0 ? ctrl.party[pi] : null, vol: newVol() };
          if (pi < 0 && used > 0) continue;
          side.slots.push(slot);
          used++;
        }
      });
      return side;
    });
    this.weather = null; // { kind: 'RAIN'|'SUN'|'SAND', turns }
    this.turn = 0;
    this.events = [];
    this.actions = new Map();
    this.prompts = new Map(); // slotKey → prompt
    this.phase = 'start';
    this.result = null;
    this.runTries = 0;
    this.payDay = 0;
    this.participants = new Map(); // enemy mon uid → Set(우리 편 mon uid)
    this.after = new Map(); // ctrl id → [{kind:'learn'|'evolve', ...}]
    this.futureSight = [];
    this.moneyWon = 0;
  }

  // ───────── 도우미 ─────────
  key(slot) { return `${slot.side}-${slot.idx}`; }
  slotByKey(k) { const [s, i] = String(k).split('-').map(Number); return this.sides[s] && this.sides[s].slots[i]; }
  foe(slot) { return this.sides[1 - slot.side]; }
  allSlots() { return [...this.sides[0].slots, ...this.sides[1].slots]; }
  alive(slot) { return slot && slot.mon && slot.mon.hp > 0; }
  name(slot) {
    const n = dex.displayName(slot.mon);
    if (slot.ctrl.ai === 'wild') return `야생 ${n}`;
    if (slot.ctrl.ai === 'trainer' || (this.kind === 'pvp' && slot.side === 1) || this.sides[slot.side].ctrls.length > 1) {
      if (slot.ctrl.ai === 'trainer') return `상대 ${n}`;
      return `${slot.ctrl.name}의 ${n}`;
    }
    return n;
  }
  types(slot) { return slot.vol.types || (slot.vol.transformed ? slot.vol.transformed.types : D.species[slot.mon.species].types); }
  rawStat(slot, i) { return slot.vol.transformed && i > 0 ? slot.vol.transformed.stats[i] : slot.mon.stats[i]; }
  stat(slot, k) {
    const idx = { atk: 1, def: 2, spe: 3, spa: 4, spd: 5 }[k];
    let v = Math.floor(this.rawStat(slot, idx) * STAGE[slot.vol.st[k] + 6] / 100);
    if (k === 'spe' && slot.mon.status === 'PAR') v = Math.floor(v / 4);
    return Math.max(1, v);
  }
  log(e) { this.events.push(e); }
  say(s) { this.log({ t: 'text', s }); }
  hpEv(slot) { this.log({ t: 'hp', side: slot.side, slot: slot.idx, hp: slot.mon.hp, max: slot.mon.stats[0] }); }
  ctrlsOf(pid) { return this.sides.flatMap((s) => s.ctrls).filter((c) => c.id === pid); }
  sideOf(pid) { const c = this.ctrlsOf(pid)[0]; return c ? c.side : 0; }
  healthy(ctrl) { return ctrl.party.filter((m) => m && m.hp > 0 && !m.egg); }
  sideAlive(side) { return side.ctrls.some((c) => this.healthy(c).length > 0); }
  heldEffect(mon) { const it = mon.item && D.items[mon.item]; return it ? it.held : null; }

  // ───────── 시작 ─────────
  start() {
    const s1 = this.sides[1];
    if (this.kind === 'wild') {
      for (const slot of s1.slots) if (slot.mon) this.sendOut(slot, true);
      const names = s1.slots.filter((s) => s.mon).map((s) => `야생 ${dex.displayName(s.mon)}`);
      this.say(names.length > 1 ? `앗! ${J(names[0], '과/와')} ${J(names[1], '이/가')} 나타났다!` : `앗! ${J(names[0], '이/가')} 튀어나왔다!`);
    } else if (this.kind === 'trainer') {
      const t = this.trainer;
      this.say(`${t.title} ${J(t.name, '이/가')} 승부를 걸어왔다!`);
    } else {
      this.say(`${J(this.sides[1].name, '이/가')} 승부를 걸어왔다!`);
    }
    for (const side of this.sides) {
      if (this.kind === 'wild' && side.idx === 1) continue;
      for (const slot of side.slots) if (slot.mon) this.sendOut(slot, true);
    }
    this.newTurn();
    this.flush();
  }

  sendOut(slot, first = false) {
    const mon = slot.mon;
    slot.vol = newVol();
    const pub = dex.publicMon(mon, false);
    pub.owner = slot.ctrl.name;
    this.log({ t: 'switch', side: slot.side, slot: slot.idx, mon: pub });
    const c = slot.ctrl;
    if (c.ai === 'wild') { /* 이미 나왔다고 말함 */ }
    else if (c.ai === 'trainer') this.say(`${this.trainer.title} ${J(this.trainer.name, '은/는')} ${J(dex.displayName(mon), '을/를')} 내보냈다!`);
    else if (c.human && (this.sides[slot.side].ctrls.length > 1 || slot.side === 1 || this.kind === 'pvp')) this.say(`${J(c.name, '은/는')} ${J(dex.displayName(mon), '을/를')} 내보냈다!`);
    else this.say(`가랏! ${dex.displayName(mon)}!`);
    if (!first && this.sides[slot.side].scr.spikes && !this.types(slot).includes('FLYING')) {
      const d = Math.max(1, Math.floor(mon.stats[0] / 8));
      mon.hp = Math.max(0, mon.hp - d);
      this.say(`${J(this.name(slot), '은/는')} 압정뿌리기의 데미지를 입었다!`);
      this.hpEv(slot);
    }
    this.markParticipants();
  }

  markParticipants() {
    // 지금 마주하고 있는 상대 포켓몬 ↔ 우리 편 포켓몬
    for (const foe of this.sides[1].slots) {
      if (!this.alive(foe)) continue;
      const set = this.participants.get(foe.mon.uid) || new Set();
      for (const me of this.sides[0].slots) if (this.alive(me)) set.add(me.mon.uid);
      this.participants.set(foe.mon.uid, set);
    }
  }

  // ───────── 차례 시작: 무엇을 할지 묻기 ─────────
  newTurn() {
    this.turn++;
    this.phase = 'choose';
    this.actions.clear();
    this.prompts.clear();
    for (const slot of this.allSlots()) {
      if (!this.alive(slot)) continue;
      const forced = this.forcedAction(slot);
      if (forced) { this.actions.set(this.key(slot), forced); continue; }
      if (slot.ctrl.human) this.prompts.set(this.key(slot), this.actionPrompt(slot));
      else this.actions.set(this.key(slot), this.aiAction(slot));
    }
    this.maybeResolve();
  }

  forcedAction(slot) {
    const v = slot.vol;
    if (v.recharge) return { type: 'recharge' };
    if (v.charging) return { type: 'move', move: v.charging.move, target: v.charging.target, charged: true };
    if (v.rampage) return { type: 'move', move: v.rampage.move, target: null, locked: true };
    if (v.rollout) return { type: 'move', move: 'ROLLOUT', target: v.rolloutTarget, locked: true };
    if (v.bide) return { type: 'move', move: 'BIDE', target: null, locked: true };
    return null;
  }

  usableMoves(slot) {
    const v = slot.vol;
    const moves = v.mimicMoves || slot.mon.moves;
    return moves.map((m, i) => ({ i, id: m.id, pp: m.pp, ok: m.pp > 0 && !(v.disabled && v.disabled.move === m.id) && !(v.encore && v.encore.move !== m.id) }));
  }

  canEscape(slot) {
    const v = slot.vol;
    if (v.trap > 0 || v.meanLook) return false;
    return true;
  }

  targetsFor(slot) {
    const foes = this.foe(slot).slots.filter((s) => this.alive(s));
    return foes.map((s) => ({ key: this.key(s), name: this.name(s) }));
  }

  actionPrompt(slot) {
    const moves = this.usableMoves(slot);
    return {
      kind: 'action', key: this.key(slot), ctrl: slot.ctrl.id, turn: this.turn,
      mon: dex.publicMon(slot.mon, true),
      moves: moves.map((m) => ({ ...m, name: ko.moveName(m.id), type: D.moves[m.id].type, max: (slot.mon.moves[m.i] || {}).max || m.pp })),
      struggle: !moves.some((m) => m.ok),
      targets: this.targetsFor(slot),
      canRun: this.kind === 'wild' || this.kind === 'pvp',
      canItem: this.kind !== 'pvp',
      canSwitch: this.canEscape(slot) && slot.ctrl.party.some((m, i) => m && m.hp > 0 && !m.egg && !this.sides[slot.side].slots.some((s) => s.ctrl === slot.ctrl && s.pi === i)),
      party: slot.ctrl.party.map((m) => dex.publicMon(m, false)),
      active: this.sides[slot.side].slots.filter((s) => s.ctrl === slot.ctrl).map((s) => s.pi),
    };
  }

  /** 사람 선택 받기. 잘못됐으면 오류 글 */
  answer(pid, key, action) {
    const pr = this.prompts.get(key);
    if (!pr || pr.ctrl !== pid) return '지금 고를 차례가 아닙니다.';
    const slot = this.slotByKey(key);
    if (pr.kind === 'replace') {
      const i = Number(action && action.party);
      const m = slot.ctrl.party[i];
      if (!m || m.hp <= 0 || m.egg || this.sides[slot.side].slots.some((s) => s !== slot && s.ctrl === slot.ctrl && s.pi === i && this.alive(s))) return '그 포켓몬은 나갈 수 없습니다.';
      this.prompts.delete(key);
      this.actions.set(key, { type: 'replace', party: i });
      this.maybeResolve();
      return null;
    }
    if (!action || !action.type) return '잘못된 선택';
    if (action.type === 'move') {
      const um = this.usableMoves(slot);
      if (pr.struggle) action = { type: 'move', move: 'STRUGGLE', target: action.target };
      else {
        const m = um[action.i];
        if (!m || !m.ok) return '그 기술은 쓸 수 없습니다.';
        action = { type: 'move', move: m.id, idx: m.i, target: action.target };
      }
    } else if (action.type === 'switch') {
      if (!pr.canSwitch) return '교체할 수 없습니다.';
      const m = slot.ctrl.party[action.party];
      if (!m || m.hp <= 0 || m.egg || this.sides[slot.side].slots.some((s) => s.ctrl === slot.ctrl && s.pi === action.party)) return '그 포켓몬은 나갈 수 없습니다.';
      if ([...this.actions.values()].some((a) => a.type === 'switch' && a.party === action.party && a.ctrl === slot.ctrl)) return '이미 나가기로 한 포켓몬입니다.';
      action = { type: 'switch', party: Number(action.party), ctrl: slot.ctrl };
    } else if (action.type === 'run') {
      if (!pr.canRun) return '도망칠 수 없다!';
    } else if (action.type === 'item') {
      if (!pr.canItem) return '여기서는 도구를 쓸 수 없다!';
      action = { type: 'item', item: action.item, target: action.target };
    } else return '잘못된 선택';
    this.prompts.delete(key);
    this.actions.set(key, action);
    this.maybeResolve();
    return null;
  }

  /** 연결이 끊긴 사람 대신 아무거나 고르기 */
  autoAnswer(pid) {
    for (const [key, pr] of [...this.prompts]) {
      if (pr.ctrl !== pid) continue;
      const slot = this.slotByKey(key);
      if (pr.kind === 'replace') { const i = slot.ctrl.party.findIndex((m, k) => m && m.hp > 0 && !m.egg && !this.sides[slot.side].slots.some((s) => s.ctrl === slot.ctrl && s.pi === k && this.alive(s))); this.answer(pid, key, { party: i }); }
      else { const a = this.aiAction(slot); if (a.type === 'move' && a.idx !== undefined) this.answer(pid, key, { type: 'move', i: a.idx, target: a.target }); else this.answer(pid, key, { type: 'move', i: 0 }); }
    }
  }

  forfeit(pid) {
    if (this.result) return;
    const side = this.sideOf(pid);
    this.say(this.kind === 'pvp' ? `${this.ctrlsOf(pid)[0].name}의 연결이 끊어졌다…` : '승부를 그만두었다.');
    this.finish({ winner: 1 - side, reason: 'forfeit' });
    this.flush();
  }

  maybeResolve() {
    if (this.phase === 'choose' && this.prompts.size === 0) this.resolveTurn();
    else if (this.phase === 'replace' && this.prompts.size === 0) this.resolveReplace();
  }

  // ───────── AI ─────────
  aiAction(slot) {
    const um = this.usableMoves(slot).filter((m) => m.ok);
    if (!um.length) return { type: 'move', move: 'STRUGGLE', target: null };
    const foes = this.foe(slot).slots.filter((s) => this.alive(s));
    const target = foes.length ? pick(foes) : null;
    if (slot.ctrl.ai === 'trainer' && target) {
      // 트레이너: 효과 좋은 기술을 더 자주
      const scored = um.map((m) => {
        const mv = D.moves[m.id];
        let sc = 10;
        if (mv.power > 1) sc = mv.power * typeEff(mv.type, this.types(target)) * (this.types(slot).includes(mv.type) ? 1.5 : 1) / 10 + 5;
        else if (/SLEEP|PARALYZE|TOXIC|POISON|CONFUSE/.test(mv.effect) && target.mon.status) sc = 1;
        else if (mv.effect === 'HEAL' && slot.mon.hp > slot.mon.stats[0] / 2) sc = 1;
        else sc = 8;
        if (typeEff(mv.type, this.types(target)) === 0 && mv.power > 0) sc = 0.1;
        return { m, sc: sc * (0.6 + randInt(80) / 100) };
      }).sort((a, b) => b.sc - a.sc);
      const best = scored[0].m;
      return { type: 'move', move: best.id, idx: best.i, target: this.key(target) };
    }
    const m = pick(um);
    return { type: 'move', move: m.id, idx: m.i, target: target ? this.key(target) : null };
  }

  // ───────── 차례 진행 ─────────
  priorityOf(slot, a) {
    if (a.type === 'switch' || a.type === 'replace') return 10;
    if (a.type === 'item') return 9;
    if (a.type === 'run') return 8;
    if (a.type !== 'move') return 1;
    const eff = D.moves[a.move] ? D.moves[a.move].effect : 'NORMAL_HIT';
    return SOUND_PRIO[eff] ?? 1;
  }

  resolveTurn() {
    this.phase = 'resolve';
    const order = [...this.actions.entries()].map(([k, a]) => {
      const slot = this.slotByKey(k);
      let spe = this.alive(slot) ? this.stat(slot, 'spe') : 0;
      if (slot.mon && this.heldEffect(slot.mon) === 'HELD_QUICK_CLAW' && chance256(60)) spe = 99999;
      return { slot, a, pr: this.priorityOf(slot, a), spe, r: randInt(1000) };
    }).sort((x, y) => y.pr - x.pr || y.spe - x.spe || x.r - y.r);
    for (const s of this.allSlots()) { s.vol.protect = false; s.vol.endure = false; s.vol.flinch = false; s.vol.hurt = null; }
    for (const { slot, a } of order) {
      if (this.result) break;
      if (a.type === 'replace') continue;
      if (!this.alive(slot)) continue;
      this.doAction(slot, a);
      this.checkFaints();
      if (this.result) break;
    }
    if (!this.result) this.endOfTurn();
    if (!this.result) this.checkFaints();
    if (!this.result) this.afterFaints();
    this.flush();
  }

  doAction(slot, a) {
    if (a.type === 'switch') return this.doSwitch(slot, a.party);
    if (a.type === 'run') return this.doRun(slot);
    if (a.type === 'item') return this.doItem(slot, a);
    if (a.type === 'recharge') { slot.vol.recharge = false; this.say(`${J(this.name(slot), '은/는')} 공격의 반동으로 움직일 수 없다!`); return; }
    if (a.type === 'move') return this.useMove(slot, a);
  }

  doSwitch(slot, pi) {
    const old = slot.mon;
    if (slot.ctrl.human && this.alive(slot)) this.say(`돌아와, ${dex.displayName(old)}!`);
    else if (slot.ctrl.ai === 'trainer' && this.alive(slot)) this.say(`${this.trainer.title} ${J(this.trainer.name, '은/는')} ${J(dex.displayName(old), '을/를')} 불러들였다!`);
    this.log({ t: 'withdraw', side: slot.side, slot: slot.idx });
    if (old && old.status === 'TOX') old.status = 'PSN';
    for (const s of this.allSlots()) if (s.vol.seeded === slot) s.vol.seeded = null;
    slot.pi = pi;
    slot.mon = slot.ctrl.party[pi];
    this.sendOut(slot);
  }

  doRun(slot) {
    if (this.kind === 'pvp') { this.say(`${J(slot.ctrl.name, '은/는')} 항복했다!`); this.finish({ winner: 1 - slot.side, reason: 'forfeit' }); return; }
    if (!this.canEscape(slot) && this.heldEffect(slot.mon) !== 'HELD_ESCAPE') { this.say('도망칠 수 없다!'); return; }
    const foe = this.foe(slot).slots.find((s) => this.alive(s));
    this.runTries++;
    let ok = true;
    if (foe) {
      const a = this.stat(slot, 'spe'), b = this.stat(foe, 'spe');
      if (a < b) {
        const f = Math.floor(a * 32 / Math.max(1, Math.floor(b / 4) % 256)) + 30 * this.runTries;
        ok = f > 255 || randInt(256) < f;
      }
    }
    if (ok) { this.say('무사히 도망쳤다!'); this.finish({ winner: -1, reason: 'run' }); }
    else this.say('도망칠 수 없었다!');
  }

  doItem(slot, a) {
    const it = D.items[a.item];
    const ctrl = slot.ctrl;
    const bag = ctrl.bag;
    if (!it || !bag || !bag.has(a.item)) { this.say('그 도구는 없다!'); return; }
    const iname = ko.itemName(a.item, D.items);
    if (it.pocket === 'BALL') {
      if (this.kind !== 'wild') { bag.use(a.item); this.say(`${J(ctrl.name, '은/는')} ${J(iname, '을/를')} 던졌다!`); this.say('트레이너가 볼을 쳐냈다!'); this.say('남의 포켓몬을 뺏으면 도둑이야!'); return; }
      const foes = this.foe(slot).slots.filter((s) => this.alive(s));
      if (foes.length !== 1) { this.say('두 마리가 있어서 노릴 수가 없다!'); return; }
      bag.use(a.item);
      this.say(`${J(ctrl.name, '은/는')} ${J(iname, '을/를')} 던졌다!`);
      return this.tryCatch(slot, foes[0], a.item);
    }
    const targetMon = ctrl.party.find((m) => m && m.uid === a.target) || slot.mon;
    const tSlot = this.sides[slot.side].slots.find((s) => s.mon === targetMon);
    let used = false;
    if (it.healHP && targetMon.hp > 0 && targetMon.hp < targetMon.stats[0]) {
      const before = targetMon.hp;
      targetMon.hp = Math.min(targetMon.stats[0], targetMon.hp + it.healHP);
      this.say(`${J(ctrl.name, '은/는')} ${J(iname, '을/를')} 사용했다!`);
      this.say(`${J(dex.displayName(targetMon), '의')} 체력이 ${targetMon.hp - before} 회복되었다!`);
      used = true;
    }
    if (it.healStatus && targetMon.hp > 0 && (targetMon.status || (tSlot && tSlot.vol.confused))) {
      const st = it.healStatus;
      if (st === 'ALL' || targetMon.status === st || (st === 'PSN' && targetMon.status === 'TOX')) {
        if (!used) this.say(`${J(ctrl.name, '은/는')} ${J(iname, '을/를')} 사용했다!`);
        targetMon.status = null; targetMon.sleep = 0;
        if (tSlot && st === 'ALL') tSlot.vol.confused = 0;
        this.say(`${J(dex.displayName(targetMon), '은/는')} 건강해졌다!`);
        used = true;
      }
    }
    if (a.item === 'REVIVE' || a.item === 'MAX_REVIVE') {
      if (targetMon.hp <= 0) {
        targetMon.hp = a.item === 'MAX_REVIVE' ? targetMon.stats[0] : Math.floor(targetMon.stats[0] / 2);
        targetMon.status = null;
        this.say(`${J(ctrl.name, '은/는')} ${J(iname, '을/를')} 사용했다!`);
        this.say(`${J(dex.displayName(targetMon), '은/는')} 기운을 되찾았다!`);
        used = true;
      }
    }
    const X = { X_ATTACK: 'atk', X_DEFEND: 'def', X_SPEED: 'spe', X_SPECIAL: 'spa', X_ACCURACY: 'acc' };
    if (X[a.item] && tSlot) { this.say(`${J(ctrl.name, '은/는')} ${J(iname, '을/를')} 사용했다!`); this.boost(tSlot, X[a.item], a.item === 'X_SPECIAL' ? 1 : 1, true); if (a.item === 'X_SPECIAL') this.boost(tSlot, 'spd', 1, true); used = true; }
    if (a.item === 'GUARD_SPEC' || a.item === 'DIRE_HIT') { if (tSlot) { this.say(`${J(ctrl.name, '은/는')} ${J(iname, '을/를')} 사용했다!`); if (a.item === 'DIRE_HIT') tSlot.vol.focus = true; else this.sides[slot.side].scr.mist = 5; used = true; } }
    if (/ETHER|ELIXER/.test(a.item)) {
      const full = /MAX/.test(a.item);
      const ms = /ELIXER/.test(a.item) ? targetMon.moves : [targetMon.moves.find((m) => m.pp < m.max)].filter(Boolean);
      if (ms.length) { this.say(`${J(ctrl.name, '은/는')} ${J(iname, '을/를')} 사용했다!`); for (const m of ms) m.pp = full ? m.max : Math.min(m.max, m.pp + 10); this.say('PP가 회복되었다!'); used = true; }
    }
    if (!used) { this.say('효과가 없을 것 같다…'); return; }
    bag.use(a.item);
    if (tSlot) this.hpEv(tSlot);
    this.log({ t: 'party' });
  }

  tryCatch(slot, foe, ball) {
    const mon = foe.mon;
    const s = D.species[mon.species];
    let shakes = 0, ok = false;
    if (ball === 'MASTER_BALL') ok = true;
    else {
      const max = mon.stats[0], hp = mon.hp;
      let rate = s.catchRate;
      if (ball === 'ULTRA_BALL') rate *= 2; else if (ball === 'GREAT_BALL' || ball === 'PARK_BALL') rate = Math.floor(rate * 1.5);
      else if (ball === 'LEVEL_BALL') { const r = slot.mon.level / mon.level; rate *= r >= 4 ? 8 : r >= 2 ? 4 : r > 1 ? 2 : 1; }
      else if (ball === 'FAST_BALL' && s.base[3] >= 100) rate *= 4;
      else if (ball === 'MOON_BALL' && [29, 30, 32, 33, 35, 36, 39, 40, 173, 174].includes(mon.species)) rate *= 4;
      else if (ball === 'LURE_BALL' && this.fishing) rate *= 3;
      else if (ball === 'HEAVY_BALL') rate += 0;
      rate = Math.min(255, rate);
      let a = Math.max(1, Math.floor((3 * max - 2 * hp) * rate / (3 * max)));
      if (mon.status === 'SLP' || mon.status === 'FRZ') a += 10;
      else if (mon.status) a += 5;
      a = Math.min(255, a);
      ok = randInt(256) <= a;
      if (!ok) { const p = a / 256; shakes = p < 0.1 ? 0 : p < 0.3 ? 1 : p < 0.7 ? 2 : 3; shakes = Math.min(3, shakes + (randInt(3) === 0 ? 1 : 0)); }
      else shakes = 3;
    }
    this.log({ t: 'catch', side: foe.side, slot: foe.idx, shakes, ok, ball });
    if (!ok) { this.say(['아앗! 포켓몬이 볼에서 나와 버렸다!', '아앗! 조금만 더하면 잡을 수 있었는데!', '아-! 잡았다고 생각했는데!', '아쉽다! 거의 잡았는데!'][shakes] || '아앗! 포켓몬이 볼에서 나와 버렸다!'); return; }
    this.say(`신난다! ${J(dex.displayName(mon), '을/를')} 붙잡았다!`);
    mon.ball = ball;
    mon.ot = slot.ctrl.name;
    mon.otId = slot.ctrl.id;
    if (mon.status === 'TOX') mon.status = 'PSN';
    this.finish({ winner: slot.side, reason: 'caught', caught: mon, catcher: slot.ctrl.id });
  }

  // ───────── 기술 ─────────
  useMove(slot, a) {
    const v = slot.vol;
    const mon = slot.mon;
    let moveId = a.move;
    // 행동 불능 체크
    if (mon.status === 'SLP') {
      mon.sleep--;
      if (mon.sleep <= 0) { mon.status = null; this.say(`${J(this.name(slot), '은/는')} 눈을 떴다!`); this.statusEv(slot); }
      else if (moveId !== 'SNORE' && moveId !== 'SLEEP_TALK') { this.say(`${J(this.name(slot), '은/는')} 쿨쿨 잠들어 있다.`); v.rampage = null; v.charging = null; return; }
    } else if (moveId === 'SNORE' || moveId === 'SLEEP_TALK') { this.say(`${J(this.name(slot), '의')} ${ko.moveName(moveId)}!`); this.say('그러나 실패했다!'); this.spendPP(slot, a); return; }
    if (mon.status === 'FRZ') {
      if (randInt(256) < 25) { mon.status = null; this.say(`${J(this.name(slot), '의')} 얼음이 녹았다!`); this.statusEv(slot); }
      else if (!['FLAME_WHEEL', 'SACRED_FIRE'].includes(moveId)) { this.say(`${J(this.name(slot), '은/는')} 얼어 버려서 움직일 수 없다!`); return; }
      else { mon.status = null; this.statusEv(slot); }
    }
    if (v.flinch) { this.say(`${J(this.name(slot), '은/는')} 풀이 죽어 움직일 수 없다!`); v.rampage = null; return; }
    if (v.disabled) { v.disabled.turns--; if (v.disabled.turns <= 0) { this.say(`${J(this.name(slot), '의')} 사슬묶기가 풀렸다!`); v.disabled = null; } }
    if (v.confused) {
      v.confused--;
      if (v.confused <= 0) this.say(`${J(this.name(slot), '의')} 혼란이 풀렸다!`);
      else {
        this.say(`${J(this.name(slot), '은/는')} 혼란에 빠져 있다!`);
        if (randInt(2) === 0) {
          const atk = this.stat(slot, 'atk'), def = this.stat(slot, 'def');
          const dmg = Math.floor(Math.floor(Math.floor(2 * mon.level / 5 + 2) * 40 * atk / Math.max(1, def)) / 50) + 2;
          this.say('영문도 모른 채 자신을 공격했다!');
          this.hurt(slot, dmg);
          v.rampage = null; v.charging = null;
          return;
        }
      }
    }
    if (v.attract && this.alive(v.attract)) {
      this.say(`${J(this.name(slot), '은/는')} ${J(this.name(v.attract), '에게')} 헤롱헤롱하다!`);
      if (randInt(2) === 0) { this.say(`${J(this.name(slot), '은/는')} 헤롱헤롱해서 기술을 쓸 수 없었다!`); return; }
    }
    if (mon.status === 'PAR' && randInt(4) === 0) { this.say(`${J(this.name(slot), '은/는')} 몸이 저려서 움직일 수 없다!`); v.rampage = null; v.charging = null; return; }

    // 잠꼬대 / 손가락흔들기 / 따라하기
    if (moveId === 'SLEEP_TALK') {
      this.say(`${J(this.name(slot), '의')} 잠꼬대!`);
      this.spendPP(slot, a);
      const others = mon.moves.filter((m) => !['SLEEP_TALK', 'BIDE', 'RAZOR_WIND', 'SOLARBEAM', 'SKULL_BASH', 'SKY_ATTACK', 'FLY', 'DIG'].includes(m.id));
      if (!others.length) { this.say('그러나 실패했다!'); return; }
      moveId = pick(others).id;
      a = { ...a, move: moveId, noPP: true };
    }
    if (moveId === 'METRONOME') {
      this.say(`${J(this.name(slot), '의')} 손가락흔들기!`);
      this.spendPP(slot, a);
      const all = Object.keys(D.moves).filter((m) => !['METRONOME', 'STRUGGLE', 'SKETCH', 'MIMIC', 'COUNTER', 'MIRROR_COAT', 'PROTECT', 'DETECT', 'ENDURE', 'DESTINY_BOND', 'SLEEP_TALK', 'THIEF'].includes(m));
      moveId = pick(all);
      a = { ...a, move: moveId, noPP: true, target: null };
    }
    if (moveId === 'MIRROR_MOVE') {
      this.spendPP(slot, a);
      const t = this.pickTarget(slot, a);
      const last = t && t.vol.lastMove;
      if (!last || last === 'MIRROR_MOVE') { this.say(`${J(this.name(slot), '의')} 따라하기!`); this.say('그러나 실패했다!'); return; }
      moveId = last;
      a = { ...a, move: moveId, noPP: true };
    }

    const mv = D.moves[moveId];
    if (!mv) return;
    // 기 모으는 기술 (1턴째)
    const eff = mv.effect;
    const chargeKind = { FLY: true, SOLARBEAM: true, RAZOR_WIND: true, SKULL_BASH: true, SKY_ATTACK: true }[eff];
    if (chargeKind && !a.charged) {
      if (!(eff === 'SOLARBEAM' && this.weather && this.weather.kind === 'SUN')) {
        this.spendPP(slot, a);
        this.say(`${J(this.name(slot), '의')} ${ko.moveName(moveId)}!`);
        const msg = { FLY: moveId === 'DIG' ? '땅속으로 파고들었다!' : '하늘 높이 날아올랐다!', SOLARBEAM: '빛을 흡수했다!', RAZOR_WIND: '바람을 일으켰다!', SKULL_BASH: '목을 움츠렸다!', SKY_ATTACK: '격렬한 빛에 휩싸였다!' }[eff];
        this.say(`${J(this.name(slot), '은/는')} ${msg}`);
        if (eff === 'SKULL_BASH') this.boost(slot, 'def', 1, true);
        if (eff === 'FLY') v.invuln = moveId === 'DIG' ? 'dig' : 'fly';
        v.charging = { move: moveId, target: a.target };
        return;
      }
    }
    v.charging = null;
    v.invuln = null;
    if (!a.charged && !a.locked) this.spendPP(slot, a);
    v.lastMove = moveId;
    this.say(`${J(this.name(slot), '의')} ${ko.moveName(moveId)}!`);
    const target = this.pickTarget(slot, a, mv);
    this.log({ t: 'move', side: slot.side, slot: slot.idx, move: moveId, type: mv.type, target: target ? [target.side, target.idx] : null, power: mv.power });
    this.execMove(slot, target, mv, moveId);
    if (v.rampage) {
      v.rampage.turns--;
      if (v.rampage.turns <= 0) { v.rampage = null; if (!v.confused) { v.confused = 2 + randInt(4); this.say(`${J(this.name(slot), '은/는')} 지쳐서 혼란에 빠졌다!`); } }
    }
  }

  spendPP(slot, a) {
    if (a.noPP || a.move === 'STRUGGLE') return;
    const list = slot.vol.mimicMoves || slot.mon.moves;
    const m = list.find((x) => x.id === a.move) || (a.idx !== undefined ? list[a.idx] : null);
    if (m && m.pp > 0) m.pp--;
  }

  pickTarget(slot, a, mv) {
    if (mv && this.selfTargeted(mv)) return slot;
    let t = a.target ? this.slotByKey(a.target) : null;
    if (!t || t.side === slot.side || !this.alive(t)) {
      const foes = this.foe(slot).slots.filter((s) => this.alive(s));
      t = foes.length ? pick(foes) : null;
    }
    return t;
  }

  selfTargeted(mv) {
    if (mv.power > 0) return false;
    return /_UP|^HEAL$|PROTECT|ENDURE|FOCUS_ENERGY|REFLECT|LIGHT_SCREEN|SAFEGUARD|MIST|SUBSTITUTE|DEFENSE_CURL|BELLY_DRUM|RAIN_DANCE|SUNNY_DAY|SANDSTORM|HEAL_BELL|SPLASH|TELEPORT|CONVERSION$|MORNING_SUN|SYNTHESIS|MOONLIGHT|BATON_PASS|RESET_STATS|SPIKES/.test(mv.effect) && !/HIT$/.test(mv.effect);
  }

  /** 명중 판정 */
  hits(user, target, mv, moveId) {
    if (target === user) return true;
    const tv = target.vol;
    if (tv.protect) { this.say(`${J(this.name(target), '은/는')} 공격으로부터 몸을 지켰다!`); return false; }
    if (tv.invuln) {
      const ok = (tv.invuln === 'fly' && ['GUST', 'THUNDER', 'TWISTER', 'WHIRLWIND'].includes(moveId)) || (tv.invuln === 'dig' && ['EARTHQUAKE', 'MAGNITUDE', 'FISSURE'].includes(moveId));
      if (!ok) { this.say(`${J(this.name(target), '에게는')} 맞지 않았다!`); return false; }
    }
    if (user.vol.lockOn) { user.vol.lockOn = 0; return true; }
    if (mv.effect === 'ALWAYS_HIT' || mv.acc >= 100 && mv.effect === 'NORMAL_HIT' && false) return true;
    if (mv.effect === 'ALWAYS_HIT') return true;
    let acc = Math.round(mv.acc * 255 / 100);
    if (mv.effect === 'THUNDER' && this.weather && this.weather.kind === 'RAIN') return true;
    if (mv.effect === 'THUNDER' && this.weather && this.weather.kind === 'SUN') acc = 127;
    const stage = Math.max(-6, Math.min(6, user.vol.st.acc - (tv.foresight ? Math.min(0, tv.st.eva) : tv.st.eva)));
    acc = Math.floor(acc * ACC_STAGE[stage + 6] / 100);
    if (this.heldEffect(target.mon) === 'HELD_BRIGHTPOWDER') acc -= 20;
    if (acc >= 255) return true;
    if (randInt(256) >= acc) { this.say(`그러나 ${J(this.name(user), '의')} 공격은 빗나갔다!`); return false; }
    return true;
  }

  /** 데미지 계산 */
  calcDamage(user, target, mv, opt = {}) {
    const type = opt.type || mv.type;
    const power = opt.power ?? mv.power;
    if (!power) return { dmg: 0, eff: 1 };
    const physical = PHYSICAL.has(type);
    let crit = false;
    if (!opt.noCrit) {
      let stage = (user.vol.focus ? 1 : 0) + (HIGH_CRIT.has(opt.moveId) ? 2 : 0) + (this.heldEffect(user.mon) === 'HELD_CRITICAL_UP' ? 1 : 0);
      if (user.mon.species === 83 && user.mon.item === 'STICK') stage += 2;
      if (user.mon.species === 113 && user.mon.item === 'LUCKY_PUNCH') stage += 2;
      crit = randInt(256) < CRIT[Math.min(4, stage)];
    }
    const ak = physical ? 'atk' : 'spa', dk = physical ? 'def' : 'spd';
    let A = crit && user.vol.st[ak] < 0 ? this.rawStat(user, physical ? 1 : 4) : this.stat(user, ak);
    let Dv = crit && target.vol.st[dk] > 0 ? this.rawStat(target, physical ? 2 : 5) : this.stat(target, dk);
    if (physical && user.mon.status === 'BRN') A = Math.floor(A / 2);
    if (!crit) {
      const scr = this.sides[target.side].scr;
      if (physical && scr.reflect) Dv *= 2;
      if (!physical && scr.light) Dv *= 2;
    }
    if (user.mon.species === 25 && user.mon.item === 'LIGHT_BALL' && !physical) A *= 2;
    if (user.mon.species === 104 || user.mon.species === 105) { if (user.mon.item === 'THICK_CLUB' && physical) A *= 2; }
    if (target.mon.species === 132 && target.mon.item === 'METAL_POWDER') Dv = Math.floor(Dv * 1.5);
    if (opt.selfdestruct) Dv = Math.max(1, Math.floor(Dv / 2));
    if (A > 255 || Dv > 255) { A = Math.floor(A / 4); Dv = Math.floor(Dv / 4); }
    Dv = Math.max(1, Dv);
    let dmg = Math.floor(Math.floor(Math.floor(2 * user.mon.level / 5 + 2) * power * A / Dv) / 50);
    if (crit) dmg *= 2;
    const held = this.heldEffect(user.mon);
    if (held && held.endsWith('_BOOST') && held.replace('HELD_', '').replace('_BOOST', '') === type.replace('_TYPE', '')) dmg = Math.floor(dmg * 1.1);
    dmg = Math.min(997, dmg) + 2;
    if (this.weather && !opt.noWeather) {
      const w = this.weather.kind;
      if ((w === 'RAIN' && type === 'WATER') || (w === 'SUN' && type === 'FIRE')) dmg = Math.floor(dmg * 1.5);
      if ((w === 'RAIN' && (type === 'FIRE' || opt.moveId === 'SOLARBEAM')) || (w === 'SUN' && type === 'WATER')) dmg = Math.floor(dmg / 2);
    }
    if (this.types(user).includes(type) && type !== 'CURSE_TYPE') dmg = Math.floor(dmg * 1.5);
    const eff = opt.typeless ? 1 : typeEff(type, this.types(target), target.vol.foresight);
    dmg = Math.floor(dmg * eff);
    if (!opt.noRandom && dmg > 1) dmg = Math.floor(dmg * (217 + randInt(39)) / 255);
    if (eff === 0) dmg = 0;
    return { dmg: Math.max(eff === 0 ? 0 : 1, dmg), eff, crit };
  }

  /** 체력 깎기 (대타·버티기·기합의띠 반영) → 실제 깎인 양 */
  hurt(target, dmg, { fromMove = false, user = null, physical = true } = {}) {
    const v = target.vol;
    if (fromMove && v.sub > 0 && user !== target) {
      v.sub -= dmg;
      this.say('대타가 공격을 대신 받았다!');
      if (v.sub <= 0) { v.sub = 0; this.say(`${J(this.name(target), '의')} 대타는 사라져 버렸다…`); this.log({ t: 'sub', side: target.side, slot: target.idx, on: false }); }
      return 0;
    }
    const mon = target.mon;
    let d = Math.min(dmg, mon.hp);
    if (fromMove && d >= mon.hp) {
      if (v.endure) { d = mon.hp - 1; this.say(`${J(this.name(target), '은/는')} 공격을 버텼다!`); }
      else if (this.heldEffect(mon) === 'HELD_FOCUS_BAND' && randInt(256) < 30) { d = mon.hp - 1; this.say(`${J(this.name(target), '은/는')} 기합의띠로 버텼다!`); }
    }
    mon.hp -= d;
    if (fromMove) { v.hurt = { amt: d, physical, by: user }; if (v.bide) v.bide.dmg += d; if (v.rage && d > 0 && mon.hp > 0) { this.boost(target, 'atk', 1, true); this.say(`${J(this.name(target), '의')} 분노의 볼티지가 올라간다!`); } }
    this.hpEv(target);
    this.berryCheck(target);
    return d;
  }

  heal(slot, amt) {
    const mon = slot.mon;
    const before = mon.hp;
    mon.hp = Math.min(mon.stats[0], mon.hp + Math.max(1, amt));
    this.hpEv(slot);
    return mon.hp - before;
  }

  berryCheck(slot) {
    const mon = slot.mon;
    if (!mon.item || mon.hp <= 0) return;
    const it = D.items[mon.item];
    if (!it) return;
    if (it.held === 'HELD_BERRY' && mon.hp <= mon.stats[0] / 2) {
      this.say(`${J(this.name(slot), '은/는')} ${J(ko.itemName(mon.item, D.items), '으로/로')} 체력을 회복했다!`);
      mon.item = null;
      this.heal(slot, it.heldParam || 10);
    }
  }
  statusBerry(slot) {
    const mon = slot.mon;
    if (!mon.item) return;
    const it = D.items[mon.item];
    if (!it) return;
    const map = { HELD_HEAL_POISON: ['PSN', 'TOX'], HELD_HEAL_BURN: ['BRN'], HELD_HEAL_FREEZE: ['FRZ'], HELD_HEAL_PARALYZE: ['PAR'], HELD_HEAL_SLEEP: ['SLP'], HELD_HEAL_STATUS: ['PSN', 'TOX', 'BRN', 'FRZ', 'PAR', 'SLP'] };
    const cure = map[it.held];
    if ((cure && cure.includes(mon.status)) || ((it.held === 'HELD_HEAL_CONFUSION' || it.held === 'HELD_HEAL_STATUS') && slot.vol.confused)) {
      this.say(`${J(this.name(slot), '은/는')} ${J(ko.itemName(mon.item, D.items), '을/를')} 먹었다!`);
      if (cure && cure.includes(mon.status)) { mon.status = null; mon.sleep = 0; this.statusEv(slot); }
      if (it.held === 'HELD_HEAL_CONFUSION' || it.held === 'HELD_HEAL_STATUS') slot.vol.confused = 0;
      mon.item = null;
    }
  }

  statusEv(slot) { this.log({ t: 'status', side: slot.side, slot: slot.idx, status: slot.mon.status }); }

  effMsg(eff, target) {
    if (eff === 0) this.say(`${J(this.name(target), '에게는')} 효과가 없는 것 같다…`);
    else if (eff > 1) this.say('효과가 굉장했다!');
    else if (eff < 1) this.say('효과가 별로인 듯하다…');
  }

  /** 상태이상 걸기 */
  inflict(target, st, { fromUser = null, quiet = false, secondary = false } = {}) {
    const mon = target.mon;
    if (!this.alive(target)) return false;
    if (mon.status) { if (!secondary && !quiet) this.say(mon.status === st || (st === 'TOX' && mon.status === 'PSN') ? `${J(this.name(target), '은/는')} 이미 ${ko.STATUS[mon.status]} 상태다!` : '그러나 실패했다!'); return false; }
    if (this.sides[target.side].scr.safeguard && fromUser && fromUser.side !== target.side) { if (!secondary) this.say(`${J(this.name(target), '은/는')} 신비의 베일에 보호받고 있다!`); return false; }
    if (target.vol.sub && fromUser && fromUser !== target && !secondary) { this.say('그러나 실패했다!'); return false; }
    const types = this.types(target);
    if ((st === 'PSN' || st === 'TOX') && (types.includes('POISON') || types.includes('STEEL'))) { if (!secondary) this.say(`${J(this.name(target), '에게는')} 효과가 없는 것 같다…`); return false; }
    if (st === 'BRN' && types.includes('FIRE')) { if (!secondary) this.say('그러나 실패했다!'); return false; }
    if (st === 'FRZ' && (types.includes('ICE') || (this.weather && this.weather.kind === 'SUN'))) return false;
    mon.status = st;
    if (st === 'SLP') mon.sleep = 1 + randInt(7);
    if (st === 'TOX') target.vol.toxicN = 0;
    const msg = { PSN: '독에 걸렸다!', TOX: '맹독을 입었다!', BRN: '화상을 입었다!', PAR: '마비되어 기술이 나오기 어려워졌다!', SLP: '잠들어 버렸다!', FRZ: '얼어붙었다!' }[st];
    this.say(`${J(this.name(target), '은/는')} ${msg}`);
    this.statusEv(target);
    if (st === 'FRZ' || st === 'SLP') { target.vol.rampage = null; }
    this.statusBerry(target);
    return true;
  }

  confuse(target, { secondary = false, fromUser = null } = {}) {
    if (!this.alive(target)) return false;
    if (target.vol.confused) { if (!secondary) this.say(`${J(this.name(target), '은/는')} 이미 혼란 상태다!`); return false; }
    if (this.sides[target.side].scr.safeguard && fromUser && fromUser.side !== target.side) { if (!secondary) this.say(`${J(this.name(target), '은/는')} 신비의 베일에 보호받고 있다!`); return false; }
    target.vol.confused = 2 + randInt(4);
    this.say(`${J(this.name(target), '은/는')} 혼란에 빠졌다!`);
    this.statusBerry(target);
    return true;
  }

  boost(slot, k, n, quiet = false) {
    const v = slot.vol;
    if (n < 0 && this.sides[slot.side].scr.mist && !quiet) { this.say(`${J(this.name(slot), '은/는')} 흰안개에 보호받고 있다!`); return false; }
    const before = v.st[k];
    v.st[k] = Math.max(-6, Math.min(6, v.st[k] + n));
    if (v.st[k] === before) { if (!quiet || true) this.say(`${J(this.name(slot), '의')} ${STAT_KO[k]}${n > 0 ? '은(는) 더 이상 올라가지 않는다!' : '은(는) 더 이상 떨어지지 않는다!'}`); return false; }
    const word = n >= 2 ? '크게 올라갔다!' : n > 0 ? '올라갔다!' : n <= -2 ? '크게 떨어졌다!' : '떨어졌다!';
    this.say(`${J(this.name(slot), '의')} ${J(STAT_KO[k], '이/가')} ${word}`);
    return true;
  }

  /** 실제 효과 실행 */
  execMove(user, target, mv, moveId) {
    const eff = mv.effect;
    const uv = user.vol;
    const needsTarget = !this.selfTargeted(mv);
    if (needsTarget && (!target || !this.alive(target))) { this.say('그러나 상대가 없다!'); return; }
    if (eff === 'FURY_CUTTER') uv.furyCutter = Math.min(5, uv.furyCutter + 1); else uv.furyCutter = 0;
    if (eff !== 'PROTECT' && eff !== 'ENDURE') uv.protectN = 0;
    if (eff !== 'ROLLOUT') uv.rollout = 0;
    uv.rage = eff === 'RAGE';

    // ── 상태 기술 (자기 자신)
    const selfStat = { ATTACK_UP: ['atk', 1], DEFENSE_UP: ['def', 1], SP_ATK_UP: ['spa', 1], EVASION_UP: ['eva', 1], ATTACK_UP_2: ['atk', 2], DEFENSE_UP_2: ['def', 2], SPEED_UP_2: ['spe', 2], SP_DEF_UP_2: ['spd', 2] }[eff];
    if (selfStat) { this.boost(user, selfStat[0], selfStat[1]); if (moveId === 'GROWTH') this.boost(user, 'spd', 1, true); return; }
    const foeStat = { ATTACK_DOWN: ['atk', -1], DEFENSE_DOWN: ['def', -1], SPEED_DOWN: ['spe', -1], ACCURACY_DOWN: ['acc', -1], EVASION_DOWN: ['eva', -1], ATTACK_DOWN_2: ['atk', -2], DEFENSE_DOWN_2: ['def', -2], SPEED_DOWN_2: ['spe', -2] }[eff];
    if (foeStat) {
      if (!this.hits(user, target, mv, moveId)) return;
      if (target.vol.sub) { this.say('그러나 실패했다!'); return; }
      this.boost(target, foeStat[0], foeStat[1]);
      return;
    }
    switch (eff) {
      case 'HEAL': {
        const mon = user.mon;
        if (mon.hp >= mon.stats[0]) { this.say('그러나 실패했다!'); return; }
        if (moveId === 'REST') {
          mon.status = 'SLP'; mon.sleep = 3; this.statusEv(user);
          this.say(`${J(this.name(user), '은/는')} 잠들어서 건강해졌다!`);
          this.heal(user, mon.stats[0]);
        } else { this.heal(user, Math.floor(mon.stats[0] / 2)); this.say(`${J(this.name(user), '은/는')} 체력을 회복했다!`); }
        return;
      }
      case 'MORNING_SUN': case 'SYNTHESIS': case 'MOONLIGHT': {
        const mon = user.mon;
        if (mon.hp >= mon.stats[0]) { this.say('그러나 실패했다!'); return; }
        const t = dex.timeOfDay();
        let frac = (eff === 'MOONLIGHT' ? t === 'nite' : (eff === 'MORNING_SUN' ? t === 'morn' : t === 'day')) ? 2 : 4;
        if (this.weather && this.weather.kind === 'SUN') frac = Math.max(1, frac / 2) === 1 ? 1.5 : frac / 2;
        if (this.weather && this.weather.kind !== 'SUN') frac *= 2;
        this.heal(user, Math.floor(mon.stats[0] / frac));
        this.say(`${J(this.name(user), '은/는')} 체력을 회복했다!`);
        return;
      }
      case 'PROTECT': case 'ENDURE': {
        const ok = randInt(256) < Math.floor(255 / (1 << Math.min(7, uv.protectN * 1)));
        uv.protectN++;
        if (!ok) { this.say('그러나 실패했다!'); uv.protectN = 0; return; }
        if (eff === 'PROTECT') { uv.protect = true; this.say(`${J(this.name(user), '은/는')} 방어 태세에 들어갔다!`); }
        else { uv.endure = true; this.say(`${J(this.name(user), '은/는')} 버티기 태세에 들어갔다!`); }
        return;
      }
      case 'FOCUS_ENERGY': uv.focus = true; this.say(`${J(this.name(user), '은/는')} 의욕이 넘치고 있다!`); return;
      case 'MIST': this.sides[user.side].scr.mist = 5; this.say(`${J(this.name(user), '은/는')} 흰안개에 둘러싸였다!`); return;
      case 'REFLECT': if (this.sides[user.side].scr.reflect) { this.say('그러나 실패했다!'); return; } this.sides[user.side].scr.reflect = 5; this.say('리플렉터로 물리공격에 강해졌다!'); return;
      case 'LIGHT_SCREEN': if (this.sides[user.side].scr.light) { this.say('그러나 실패했다!'); return; } this.sides[user.side].scr.light = 5; this.say('빛의장막으로 특수공격에 강해졌다!'); return;
      case 'SAFEGUARD': if (this.sides[user.side].scr.safeguard) { this.say('그러나 실패했다!'); return; } this.sides[user.side].scr.safeguard = 5; this.say('신비의 베일에 둘러싸였다!'); return;
      case 'SPIKES': { const s = this.foe(user); if (s.scr.spikes) { this.say('그러나 실패했다!'); return; } s.scr.spikes = 1; this.say('상대 발밑에 압정이 뿌려졌다!'); return; }
      case 'RAIN_DANCE': this.weather = { kind: 'RAIN', turns: 5 }; this.say('비가 내리기 시작했다!'); this.log({ t: 'weather', kind: 'RAIN' }); return;
      case 'SUNNY_DAY': this.weather = { kind: 'SUN', turns: 5 }; this.say('햇살이 강해졌다!'); this.log({ t: 'weather', kind: 'SUN' }); return;
      case 'SANDSTORM': this.weather = { kind: 'SAND', turns: 5 }; this.say('모래바람이 불기 시작했다!'); this.log({ t: 'weather', kind: 'SAND' }); return;
      case 'SUBSTITUTE': {
        const cost = Math.floor(user.mon.stats[0] / 4);
        if (uv.sub) { this.say(`${J(this.name(user), '의')} 대타는 이미 나와 있다!`); return; }
        if (user.mon.hp <= cost) { this.say('그러나 대타를 만들기에는 체력이 모자랐다!'); return; }
        user.mon.hp -= cost; this.hpEv(user); uv.sub = cost + 1;
        this.say(`${J(this.name(user), '의')} 대타가 나타났다!`);
        this.log({ t: 'sub', side: user.side, slot: user.idx, on: true });
        return;
      }
      case 'DEFENSE_CURL': uv.curl = true; this.boost(user, 'def', 1); return;
      case 'BELLY_DRUM': {
        const half = Math.floor(user.mon.stats[0] / 2);
        if (user.mon.hp <= half) { this.say('그러나 실패했다!'); return; }
        user.mon.hp -= half; this.hpEv(user); uv.st.atk = 6;
        this.say(`${J(this.name(user), '은/는')} 체력을 깎아서 공격을 최대로 올렸다!`);
        return;
      }
      case 'HEAL_BELL': for (const m of user.ctrl.party) if (m && m.hp > 0) { m.status = null; m.sleep = 0; } this.say('방울 소리가 울려 퍼졌다!'); for (const s of this.sides[user.side].slots) if (s.mon) this.statusEv(s); this.log({ t: 'party' }); return;
      case 'RESET_STATS': for (const s of this.allSlots()) s.vol.st = { atk: 0, def: 0, spe: 0, spa: 0, spd: 0, acc: 0, eva: 0 }; this.say('모든 능력 변화가 원래대로 돌아갔다!'); return;
      case 'SPLASH': this.say('그러나 아무 일도 일어나지 않았다!'); return;
      case 'TELEPORT': case 'FORCE_SWITCH': {
        if (this.kind === 'wild') {
          if (eff === 'FORCE_SWITCH' && target && target.mon.level > user.mon.level + 0 && randInt(4) === 0) { this.say('그러나 실패했다!'); return; }
          if (eff === 'TELEPORT' && user.side === 1) { this.say(`${J(this.name(user), '은/는')} 도망쳐 버렸다!`); this.finish({ winner: -1, reason: 'fled' }); return; }
          if (eff === 'TELEPORT' && !this.canEscape(user)) { this.say('그러나 실패했다!'); return; }
          if (eff === 'TELEPORT') { this.say('무사히 도망쳤다!'); this.finish({ winner: -1, reason: 'run' }); return; }
          this.say(`${J(this.name(target), '은/는')} 겁을 먹고 도망쳐 버렸다!`);
          this.finish({ winner: -1, reason: 'fled' });
          return;
        }
        if (eff === 'TELEPORT') { this.say('그러나 실패했다!'); return; }
        if (!this.hits(user, target, mv, moveId)) return;
        const opts = target.ctrl.party.map((m, i) => i).filter((i) => { const m = target.ctrl.party[i]; return m && m.hp > 0 && !m.egg && !this.sides[target.side].slots.some((s) => s.ctrl === target.ctrl && s.pi === i); });
        if (!opts.length) { this.say('그러나 실패했다!'); return; }
        this.log({ t: 'withdraw', side: target.side, slot: target.idx });
        target.pi = pick(opts); target.mon = target.ctrl.party[target.pi];
        this.say(`${J(dex.displayName(target.mon), '이/가')} 끌려 나왔다!`);
        this.sendOut(target);
        return;
      }
      case 'MEAN_LOOK': if (!this.hits(user, target, mv, moveId)) return; target.vol.meanLook = true; this.say(`${J(this.name(target), '은/는')} 이제 도망칠 수 없다!`); return;
      case 'LEECH_SEED': {
        if (!this.hits(user, target, mv, moveId)) return;
        if (this.types(target).includes('GRASS') || target.vol.seeded) { this.say(`${J(this.name(target), '에게는')} 효과가 없는 것 같다…`); return; }
        target.vol.seeded = user; this.say(`${J(this.name(target), '에게')} 씨앗을 심었다!`); return;
      }
      case 'SLEEP': case 'POISON': case 'TOXIC': case 'PARALYZE': {
        if (!this.hits(user, target, mv, moveId)) return;
        if (eff === 'PARALYZE' && typeEff(mv.type, this.types(target)) === 0) { this.say(`${J(this.name(target), '에게는')} 효과가 없는 것 같다…`); return; }
        this.inflict(target, { SLEEP: 'SLP', POISON: 'PSN', TOXIC: 'TOX', PARALYZE: 'PAR' }[eff], { fromUser: user });
        return;
      }
      case 'CONFUSE': if (!this.hits(user, target, mv, moveId)) return; if (target.vol.sub) { this.say('그러나 실패했다!'); return; } this.confuse(target, { fromUser: user }); return;
      case 'SWAGGER': if (!this.hits(user, target, mv, moveId)) return; this.boost(target, 'atk', 2); this.confuse(target, { fromUser: user }); return;
      case 'ATTRACT': {
        if (!this.hits(user, target, mv, moveId)) return;
        if (!user.mon.gender || !target.mon.gender || user.mon.gender === target.mon.gender || target.vol.attract) { this.say('그러나 실패했다!'); return; }
        target.vol.attract = user; this.say(`${J(this.name(target), '은/는')} 헤롱헤롱해졌다!`); return;
      }
      case 'DISABLE': {
        if (!this.hits(user, target, mv, moveId)) return;
        const lm = target.vol.lastMove;
        if (!lm || target.vol.disabled) { this.say('그러나 실패했다!'); return; }
        target.vol.disabled = { move: lm, turns: 2 + randInt(7) };
        this.say(`${J(this.name(target), '의')} ${J(ko.moveName(lm), '을/를')} 사용할 수 없게 되었다!`); return;
      }
      case 'ENCORE': {
        if (!this.hits(user, target, mv, moveId)) return;
        const lm = target.vol.lastMove;
        if (!lm || target.vol.encore || ['ENCORE', 'MIRROR_MOVE', 'STRUGGLE'].includes(lm)) { this.say('그러나 실패했다!'); return; }
        target.vol.encore = { move: lm, turns: 2 + randInt(5) };
        this.say(`${J(this.name(target), '은/는')} 앙코르를 받았다!`); return;
      }
      case 'SPITE': {
        if (!this.hits(user, target, mv, moveId)) return;
        const lm = target.vol.lastMove; const m = lm && target.mon.moves.find((x) => x.id === lm);
        if (!m || !m.pp) { this.say('그러나 실패했다!'); return; }
        const n = Math.min(m.pp, 2 + randInt(4)); m.pp -= n;
        this.say(`${J(this.name(target), '의')} ${J(ko.moveName(lm), '을/를')} ${n} 깎았다!`); return;
      }
      case 'CONVERSION': { const t = pick(user.mon.moves.map((m) => D.moves[m.id].type).filter((t2) => !this.types(user).includes(t2) && t2 !== 'CURSE_TYPE')); if (!t) { this.say('그러나 실패했다!'); return; } uv.types = [t]; this.say(`${J(this.name(user), '은/는')} ${ko.TYPES[t]} 타입이 되었다!`); return; }
      case 'CONVERSION2': {
        const lm = target && target.vol.lastMove; if (!lm) { this.say('그러나 실패했다!'); return; }
        const at = D.moves[lm].type; const res = Object.keys(ko.TYPES).filter((t) => typeEff(at, [t]) < 1 && t !== 'CURSE_TYPE' && t !== 'BIRD');
        const t = pick(res); if (!t) { this.say('그러나 실패했다!'); return; } uv.types = [t]; this.say(`${J(this.name(user), '은/는')} ${ko.TYPES[t]} 타입이 되었다!`); return;
      }
      case 'TRANSFORM': {
        if (!this.hits(user, target, mv, moveId) || target.vol.transformed) { this.say('그러나 실패했다!'); return; }
        uv.transformed = { species: target.mon.species, stats: target.mon.stats.slice(), types: this.types(target) };
        uv.mimicMoves = target.mon.moves.map((m) => ({ id: m.id, pp: 5, max: 5 }));
        uv.st = { ...target.vol.st };
        this.log({ t: 'transform', side: user.side, slot: user.idx, species: target.mon.species });
        this.say(`${J(this.name(user), '은/는')} ${J(dex.displayName(target.mon), '으로/로')} 변신했다!`); return;
      }
      case 'MIMIC': case 'SKETCH': {
        const lm = target && target.vol.lastMove;
        if (!lm || user.mon.moves.some((m) => m.id === lm) || lm === 'STRUGGLE') { this.say('그러나 실패했다!'); return; }
        if (!uv.mimicMoves) uv.mimicMoves = user.mon.moves.map((m) => ({ ...m }));
        const i = uv.mimicMoves.findIndex((m) => m.id === moveId);
        if (i >= 0) uv.mimicMoves[i] = { id: lm, pp: 5, max: 5 };
        this.say(`${J(this.name(user), '은/는')} ${J(ko.moveName(lm), '을/를')} 배웠다!`); return;
      }
      case 'LOCK_ON': if (!this.hits(user, target, mv, moveId)) return; uv.lockOn = 2; this.say(`${J(this.name(user), '은/는')} ${J(this.name(target), '을/를')} 노리고 있다!`); return;
      case 'FORESIGHT': if (!this.hits(user, target, mv, moveId)) return; target.vol.foresight = true; this.say(`${J(this.name(user), '은/는')} ${J(this.name(target), '의')} 정체를 꿰뚫어 보았다!`); return;
      case 'NIGHTMARE': if (!this.hits(user, target, mv, moveId)) return; if (target.mon.status !== 'SLP' || target.vol.nightmare) { this.say('그러나 실패했다!'); return; } target.vol.nightmare = true; this.say(`${J(this.name(target), '은/는')} 악몽을 꾸기 시작했다!`); return;
      case 'CURSE': {
        if (this.types(user).includes('GHOST')) {
          if (!target || target.vol.curse) { this.say('그러나 실패했다!'); return; }
          user.mon.hp = Math.max(0, user.mon.hp - Math.floor(user.mon.stats[0] / 2)); this.hpEv(user);
          target.vol.curse = true; this.say(`${J(this.name(user), '은/는')} 체력을 깎아서 ${J(this.name(target), '에게')} 저주를 걸었다!`);
        } else { this.boost(user, 'spe', -1, true); this.boost(user, 'atk', 1); this.boost(user, 'def', 1); }
        return;
      }
      case 'PERISH_SONG': for (const s of this.allSlots()) if (this.alive(s) && !s.vol.perish) s.vol.perish = 4; this.say('멸망의 노래를 들은 포켓몬은 3턴 후에 쓰러진다!'); return;
      case 'DESTINY_BOND': uv.destinyBond = true; this.say(`${J(this.name(user), '은/는')} 상대를 길동무로 삼으려 하고 있다!`); return;
      case 'PAIN_SPLIT': {
        if (!this.hits(user, target, mv, moveId)) return;
        const avg = Math.floor((user.mon.hp + target.mon.hp) / 2);
        user.mon.hp = Math.min(user.mon.stats[0], avg); target.mon.hp = Math.min(target.mon.stats[0], avg);
        this.hpEv(user); this.hpEv(target); this.say('서로의 체력을 나누었다!'); return;
      }
      case 'PSYCH_UP': if (!target) return; uv.st = { ...target.vol.st }; this.say(`${J(this.name(user), '은/는')} ${J(this.name(target), '의')} 능력 변화를 복사했다!`); return;
      case 'BATON_PASS': this.say('그러나 실패했다!'); return;
      case 'BIDE': {
        if (!uv.bide) { uv.bide = { turns: 2, dmg: 0 }; this.say(`${J(this.name(user), '은/는')} 참기 시작했다!`); return; }
        uv.bide.turns--;
        if (uv.bide.turns > 0) { this.say(`${J(this.name(user), '은/는')} 참고 있다!`); return; }
        const d = uv.bide.dmg * 2; uv.bide = null;
        this.say(`${J(this.name(user), '은/는')} 참았던 힘을 풀어놓았다!`);
        const t = target || this.foe(user).slots.find((s) => this.alive(s));
        if (!d || !t) { this.say('그러나 실패했다!'); return; }
        this.hurt(t, d, { fromMove: true, user });
        return;
      }
      default: break;
    }
    // ── 공격 기술
    if (!target || !this.alive(target)) { this.say('그러나 상대가 없다!'); return; }
    if (eff === 'DREAM_EATER' && target.mon.status !== 'SLP') { this.say(`${J(this.name(target), '에게는')} 효과가 없는 것 같다…`); return; }
    if (eff === 'SNORE' && user.mon.status !== 'SLP') { this.say('그러나 실패했다!'); return; }
    if (eff === 'OHKO') {
      if (target.mon.level > user.mon.level) { this.say(`${J(this.name(target), '에게는')} 효과가 없는 것 같다…`); return; }
      if (typeEff(mv.type, this.types(target)) === 0) { this.effMsg(0, target); return; }
      const acc = Math.min(255, Math.round(mv.acc * 255 / 100) + 2 * (user.mon.level - target.mon.level));
      if (target.vol.protect || randInt(256) >= acc) { this.say(`그러나 ${J(this.name(user), '의')} 공격은 빗나갔다!`); return; }
      this.hurt(target, target.mon.hp, { fromMove: true, user });
      this.say('일격필살!');
      return;
    }
    if (!this.hits(user, target, mv, moveId)) {
      if (eff === 'JUMP_KICK') { const crash = Math.max(1, Math.floor(this.calcDamage(user, target, mv, { moveId }).dmg / 8)); this.say(`${J(this.name(user), '은/는')} 기세 좋게 땅에 부딪혔다!`); this.hurt(user, crash); }
      if (eff === 'SELFDESTRUCT') { user.mon.hp = 0; this.hpEv(user); }
      uv.rampage = null; uv.rollout = 0;
      return;
    }
    // 고정 데미지
    const fixed = { STATIC_DAMAGE: mv.power, LEVEL_DAMAGE: user.mon.level, PSYWAVE: 1 + randInt(Math.max(1, Math.floor(user.mon.level * 1.5))), SUPER_FANG: Math.max(1, Math.floor(target.mon.hp / 2)) }[eff];
    if (fixed !== undefined) {
      if (typeEff(mv.type, this.types(target), target.vol.foresight) === 0) { this.effMsg(0, target); return; }
      this.hurt(target, fixed, { fromMove: true, user });
      return;
    }
    if (eff === 'COUNTER' || eff === 'MIRROR_COAT') {
      const h = uv.hurt;
      const phys = eff === 'COUNTER';
      if (!h || !h.amt || h.physical !== phys || !h.by || h.by.side === user.side) { this.say('그러나 실패했다!'); return; }
      const t = this.alive(h.by) ? h.by : target;
      if (phys && typeEff('FIGHTING', this.types(t)) === 0) { this.effMsg(0, t); return; }
      this.hurt(t, h.amt * 2, { fromMove: true, user, physical: phys });
      return;
    }
    if (eff === 'FUTURE_SIGHT') {
      if (this.futureSight.some((f) => f.target === target)) { this.say('그러나 실패했다!'); return; }
      const { dmg } = this.calcDamage(user, target, mv, { moveId, typeless: true, noCrit: true });
      this.futureSight.push({ target, dmg, turns: 2, name: this.name(user) });
      this.say(`${J(this.name(user), '은/는')} 미래를 내다보았다!`);
      return;
    }
    // 위력 바뀌는 기술
    let power = mv.power, type = mv.type;
    if (eff === 'REVERSAL') { const r = Math.floor(user.mon.hp * 48 / user.mon.stats[0]); power = r <= 1 ? 200 : r <= 4 ? 150 : r <= 9 ? 100 : r <= 16 ? 80 : r <= 32 ? 40 : 20; }
    if (eff === 'RETURN') power = Math.max(1, Math.floor(user.mon.happiness * 10 / 25));
    if (eff === 'FRUSTRATION') power = Math.max(1, Math.floor((255 - user.mon.happiness) * 10 / 25));
    if (eff === 'MAGNITUDE') { const r = randInt(100); const tbl = [[5, 4, 10], [15, 5, 30], [35, 6, 50], [65, 7, 70], [85, 8, 90], [95, 9, 110], [100, 10, 150]]; const e = tbl.find((x) => r < x[0]); power = e[2]; this.say(`매그니튜드 ${e[1]}!`); }
    if (eff === 'HIDDEN_POWER') { const d = user.mon.dvs; const T = ['FIGHTING', 'FLYING', 'POISON', 'GROUND', 'ROCK', 'BUG', 'GHOST', 'STEEL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'PSYCHIC_TYPE', 'ICE', 'DRAGON', 'DARK']; type = T[((d.atk & 3) << 2) | (d.def & 3)]; power = Math.floor((5 * (((d.spc >> 3) & 1) | (((d.spd >> 3) & 1) << 1) | (((d.def >> 3) & 1) << 2) | (((d.atk >> 3) & 1) << 3)) + (d.spc & 3)) / 2) + 31; }
    if (eff === 'FURY_CUTTER') power = Math.min(160, mv.power * (1 << (uv.furyCutter - 1)));
    if (eff === 'ROLLOUT') { if (!uv.rollout) { uv.rollout = 1; uv.rolloutTarget = this.key(target); } power = mv.power * (1 << (uv.rollout - 1)) * (uv.curl ? 2 : 1); uv.rollout++; if (uv.rollout > 5) uv.rollout = 0; }
    if (eff === 'PRESENT') { const r = randInt(256); if (r < 52) { this.heal(target, Math.floor(target.mon.stats[0] / 4)); this.say(`${J(this.name(target), '은/는')} 체력을 회복했다!`); return; } power = r < 154 ? 40 : r < 230 ? 80 : 120; }
    if (eff === 'GUST' && target.vol.invuln === 'fly') power *= 2;
    if (eff === 'TWISTER' && target.vol.invuln === 'fly') power *= 2;
    if (eff === 'EARTHQUAKE' && target.vol.invuln === 'dig') power *= 2;
    if (eff === 'STOMP' && target.vol.minimized) power *= 2;
    if (eff === 'PURSUIT') power = mv.power;
    if (eff === 'RAMPAGE' && !uv.rampage) uv.rampage = { move: moveId, turns: 1 + randInt(2) };
    if (eff === 'HYPER_BEAM') uv.recharge = true;
    if (eff === 'BEAT_UP') {
      const helpers = user.ctrl.party.filter((m) => m && m.hp > 0 && !m.status);
      let total = 0;
      for (const h of helpers) {
        if (!this.alive(target)) break;
        const d = Math.floor(Math.floor(Math.floor(2 * h.level / 5 + 2) * 10 * h.stats[1] / Math.max(1, target.mon.stats[2])) / 50) + 2;
        this.say(`${J(dex.displayName(h), '의')} 공격!`);
        total += this.hurt(target, d, { fromMove: true, user });
      }
      if (!helpers.length) this.say('그러나 실패했다!');
      return;
    }
    // 여러 번 때리기
    let hitsN = 1;
    if (eff === 'MULTI_HIT') { const r = randInt(8); hitsN = r < 3 ? 2 : r < 6 ? 3 : r < 7 ? 4 : 5; }
    if (eff === 'DOUBLE_HIT' || eff === 'POISON_MULTI_HIT') hitsN = 2;
    if (eff === 'TRIPLE_KICK') hitsN = 1 + randInt(3);
    let total = 0, lastEff = 1, n = 0;
    for (let h = 0; h < hitsN; h++) {
      if (!this.alive(target)) break;
      const p = eff === 'TRIPLE_KICK' ? power * (h + 1) : power;
      const r = this.calcDamage(user, target, mv, { moveId, power: p, type, selfdestruct: eff === 'SELFDESTRUCT', typeless: moveId === 'STRUGGLE' || moveId === 'BEAT_UP' });
      lastEff = r.eff;
      if (r.eff === 0) break;
      if (eff === 'FALSE_SWIPE') r.dmg = Math.min(r.dmg, target.mon.hp - 1);
      if (r.crit) this.say('급소에 맞았다!');
      total += this.hurt(target, Math.max(0, r.dmg), { fromMove: true, user, physical: PHYSICAL.has(type) });
      n++;
    }
    if (eff === 'SELFDESTRUCT') { user.mon.hp = 0; this.hpEv(user); }
    if (lastEff === 0) { this.effMsg(0, target); uv.rampage = null; uv.rollout = 0; return; }
    if (hitsN > 1) this.say(`${n}번 맞았다!`);
    this.effMsg(lastEff, target);
    // 흡수 / 반동
    if ((eff === 'LEECH_HIT' || eff === 'DREAM_EATER') && total > 0) { this.heal(user, Math.max(1, Math.floor(total / 2))); this.say(`${J(this.name(target), '은/는')} 체력을 빼앗겼다!`); }
    if (eff === 'RECOIL_HIT' && total > 0) { this.say(`${J(this.name(user), '은/는')} 반동으로 데미지를 입었다!`); this.hurt(user, Math.max(1, Math.floor(total / 4))); }
    if (eff === 'PAY_DAY') { this.payDay += user.mon.level * 2; this.say('주변에 돈이 흩어졌다!'); }
    if (eff === 'RAPID_SPIN') { uv.trap = 0; uv.seeded = null; this.sides[user.side].scr.spikes = 0; for (const s of this.allSlots()) if (s.vol.seeded === user) s.vol.seeded = null; }
    if (eff === 'THIEF' && !user.mon.item && target.mon.item && user.ctrl.human && this.kind === 'wild') { user.mon.item = target.mon.item; target.mon.item = null; this.say(`${J(this.name(user), '은/는')} ${J(ko.itemName(user.mon.item, D.items), '을/를')} 빼앗았다!`); }
    if (eff === 'TRAP_TARGET' && this.alive(target) && !target.vol.trap && !target.vol.sub) { target.vol.trap = 2 + randInt(4); target.vol.trapMove = moveId; target.vol.trapper = user; this.say(`${J(this.name(target), '은/는')} ${J(ko.moveName(moveId), '에')} 갇혔다!`); }
    if (moveId === 'MINIMIZE') uv.minimized = true;
    // 부가 효과
    if (!this.alive(target) || target === user) return;
    const ch = Math.round((mv.chance || 0) * 255 / 100);
    const roll = () => randInt(256) < ch;
    const sec = { PARALYZE_HIT: 'PAR', BURN_HIT: 'BRN', FREEZE_HIT: 'FRZ', POISON_HIT: 'PSN', THUNDER: 'PAR', FLAME_WHEEL: 'BRN', SACRED_FIRE: 'BRN', POISON_MULTI_HIT: 'PSN' }[eff];
    if (sec && !target.vol.sub && roll() && typeEff(mv.type, this.types(target)) > 0) this.inflict(target, sec, { fromUser: user, secondary: true });
    if (eff === 'TRI_ATTACK' && !target.vol.sub && randInt(256) < 51) this.inflict(target, pick(['PAR', 'BRN', 'FRZ']), { fromUser: user, secondary: true });
    if ((eff === 'CONFUSE_HIT') && roll() && !target.vol.sub) this.confuse(target, { secondary: true, fromUser: user });
    if ((eff === 'FLINCH_HIT' || eff === 'STOMP' || eff === 'TWISTER' || eff === 'SNORE' || (eff === 'SKY_ATTACK' && ch)) && roll()) target.vol.flinch = true;
    if (this.heldEffect(user.mon) === 'HELD_FLINCH' && randInt(256) < 30 && mv.power > 0) target.vol.flinch = true;
    const down = { SPEED_DOWN_HIT: 'spe', ATTACK_DOWN_HIT: 'atk', DEFENSE_DOWN_HIT: 'def', SP_DEF_DOWN_HIT: 'spd', ACCURACY_DOWN_HIT: 'acc' }[eff];
    if (down && roll() && !target.vol.sub) this.boost(target, down, -1);
    const up = { DEFENSE_UP_HIT: 'def', ATTACK_UP_HIT: 'atk' }[eff];
    if (up && roll()) this.boost(user, up, 1);
    if (eff === 'ALL_UP_HIT' && roll()) for (const k of ['atk', 'def', 'spe', 'spa', 'spd']) this.boost(user, k, 1);
  }

  // ───────── 차례 끝 ─────────
  endOfTurn() {
    // 미래예지
    for (const f of [...this.futureSight]) {
      f.turns--;
      if (f.turns > 0) continue;
      this.futureSight.splice(this.futureSight.indexOf(f), 1);
      if (!this.alive(f.target)) continue;
      this.say(`${J(this.name(f.target), '은/는')} 미래예지 공격을 받았다!`);
      this.hurt(f.target, f.dmg);
    }
    // 날씨
    if (this.weather) {
      this.weather.turns--;
      if (this.weather.turns <= 0) { this.say({ RAIN: '비가 그쳤다!', SUN: '햇살이 약해졌다!', SAND: '모래바람이 가라앉았다!' }[this.weather.kind]); this.weather = null; this.log({ t: 'weather', kind: null }); }
      else {
        this.say({ RAIN: '비가 계속 내리고 있다.', SUN: '햇살이 강하다.', SAND: '모래바람이 세차게 분다.' }[this.weather.kind]);
        if (this.weather.kind === 'SAND') for (const s of this.allSlots()) {
          if (!this.alive(s) || this.types(s).some((t) => ['ROCK', 'GROUND', 'STEEL'].includes(t))) continue;
          this.say(`모래바람이 ${J(this.name(s), '을/를')} 덮쳤다!`);
          this.hurt(s, Math.max(1, Math.floor(s.mon.stats[0] / 8)));
        }
      }
    }
    for (const s of this.allSlots()) {
      if (!this.alive(s)) continue;
      const mon = s.mon, v = s.vol, max = mon.stats[0];
      if (mon.status === 'PSN' || mon.status === 'BRN') { this.say(`${J(this.name(s), '은/는')} ${mon.status === 'PSN' ? '독' : '화상'}의 데미지를 입고 있다!`); this.hurt(s, Math.max(1, Math.floor(max / 8))); }
      else if (mon.status === 'TOX') { v.toxicN++; this.say(`${J(this.name(s), '은/는')} 독의 데미지를 입고 있다!`); this.hurt(s, Math.max(1, Math.floor(max * v.toxicN / 16))); }
      if (!this.alive(s)) continue;
      if (v.seeded && this.alive(v.seeded)) { const d = this.hurt(s, Math.max(1, Math.floor(max / 8))); this.say(`씨뿌리기가 ${J(this.name(s), '의')} 체력을 빼앗는다!`); this.heal(v.seeded, d); }
      if (!this.alive(s)) continue;
      if (v.nightmare && mon.status === 'SLP') { this.say(`${J(this.name(s), '은/는')} 악몽에 시달리고 있다!`); this.hurt(s, Math.max(1, Math.floor(max / 4))); }
      else v.nightmare = false;
      if (!this.alive(s)) continue;
      if (v.curse) { this.say(`${J(this.name(s), '은/는')} 저주를 받고 있다!`); this.hurt(s, Math.max(1, Math.floor(max / 4))); }
      if (!this.alive(s)) continue;
      if (v.trap > 0) { v.trap--; this.say(`${J(this.name(s), '은/는')} ${J(ko.moveName(v.trapMove), '의')} 데미지를 입고 있다!`); this.hurt(s, Math.max(1, Math.floor(max / 16))); if (v.trap === 0) this.say(`${J(this.name(s), '은/는')} ${ko.moveName(v.trapMove)}에서 풀려났다!`); }
      if (!this.alive(s)) continue;
      if (this.heldEffect(mon) === 'HELD_LEFTOVERS' && mon.hp < max) { this.heal(s, Math.max(1, Math.floor(max / 16))); this.say(`${J(this.name(s), '은/는')} 먹다남은음식으로 조금 회복했다!`); }
      if (v.perish) { v.perish--; this.say(`${J(this.name(s), '의')} 멸망 카운트가 ${v.perish} 되었다!`); if (v.perish === 0) { mon.hp = 0; this.hpEv(s); } }
      if (v.encore) { v.encore.turns--; if (v.encore.turns <= 0) { v.encore = null; this.say(`${J(this.name(s), '의')} 앙코르 상태가 풀렸다!`); } }
      this.berryCheck(s);
      this.statusBerry(s);
    }
    for (const side of this.sides) {
      for (const k of ['reflect', 'light', 'safeguard', 'mist']) {
        if (side.scr[k] > 0) { side.scr[k]--; if (side.scr[k] === 0) this.say({ reflect: '리플렉터의 효과가 사라졌다!', light: '빛의장막의 효과가 사라졌다!', safeguard: '신비의 베일이 사라졌다!', mist: '흰안개가 사라졌다!' }[k]); }
      }
    }
  }

  // ───────── 쓰러짐 처리 ─────────
  checkFaints() {
    for (const s of this.allSlots()) {
      if (!s.mon || s.mon.hp > 0 || s.fainted === s.mon.uid) continue;
      s.fainted = s.mon.uid;
      s.mon.status = null; s.mon.sleep = 0;
      this.log({ t: 'faint', side: s.side, slot: s.idx });
      this.say(`${J(this.name(s), '은/는')} 쓰러졌다!`);
      // 길동무
      const h = s.vol.hurt;
      if (s.vol.destinyBond && h && h.by && this.alive(h.by)) { this.say(`${J(this.name(s), '은/는')} 상대를 길동무로 삼았다!`); h.by.mon.hp = 0; this.hpEv(h.by); }
      if (s.side === 1 && this.kind !== 'pvp') this.giveExp(s);
      if (s.ctrl.human) for (const m of s.ctrl.party) if (m === s.mon) m.happiness = Math.max(0, m.happiness - 1);
    }
    // 한 편이 전멸했나
    for (const side of this.sides) {
      if (!this.sideAlive(side)) {
        const other = this.sides[1 - side.idx];
        if (!this.sideAlive(other)) { this.finish({ winner: -1, reason: 'draw' }); return; }
        this.finish({ winner: other.idx, reason: 'faint' });
        return;
      }
    }
    for (const s of this.allSlots()) if (s.fainted && s.ctrl.human && !this.healthy(s.ctrl).length && !s.ctrl.out) { s.ctrl.out = true; this.say(`${J(s.ctrl.name, '은/는')} 더 이상 싸울 포켓몬이 없다!`); }
  }

  giveExp(foe) {
    const fm = foe.mon;
    const s = D.species[fm.species];
    const ids = this.participants.get(fm.uid) || new Set();
    const mine = this.sides[0].ctrls.flatMap((c) => c.party.filter((m) => m && ids.has(m.uid) && m.hp > 0 && !m.egg).map((m) => ({ m, c })));
    if (!mine.length) return;
    let base = Math.floor(s.baseExp * fm.level / 7);
    if (this.kind === 'trainer') base = Math.floor(base * 1.5);
    const each = Math.max(1, Math.floor(base / mine.length));
    for (const { m, c } of mine) {
      let amt = each;
      if (m.otId && m.otId !== c.id) amt = Math.floor(amt * 1.5);
      for (let i = 0; i < 5; i++) m.statExp[i] = Math.min(65535, (m.statExp[i] || 0) + s.base[[0, 1, 2, 3, 4][i]]);
      if (m.level >= 100) continue;
      const res = dex.gainExp(m, amt);
      this.say(`${J(dex.displayName(m), '은/는')} ${amt} 경험치를 얻었다!`);
      if (res.levels.length) {
        const sl = this.sides[0].slots.find((x) => x.mon === m);
        this.log({ t: 'level', uid: m.uid, level: m.level, side: sl ? 0 : null, slot: sl ? sl.idx : null, hp: m.hp, max: m.stats[0] });
        this.say(`${J(dex.displayName(m), '은/는')} 레벨 ${ko.roNum(m.level)} 올랐다!`);
        m.happiness = Math.min(255, m.happiness + (m.happiness < 100 ? 5 : m.happiness < 200 ? 3 : 2));
        for (const mv of res.learn) {
          if (dex.learnMove(m, mv)) this.say(`${J(dex.displayName(m), '은/는')} 새로 ${J(ko.moveName(mv), '을/를')} 배웠다!`);
          else this.queueAfter(c.id, { kind: 'learn', uid: m.uid, move: mv });
        }
        this.queueAfter(c.id, { kind: 'evocheck', uid: m.uid });
        if (sl) this.hpEv(sl);
      }
    }
    this.log({ t: 'party' });
  }

  queueAfter(pid, item) {
    if (!this.after.has(pid)) this.after.set(pid, []);
    const list = this.after.get(pid);
    if (item.kind === 'evocheck' && list.some((x) => x.kind === 'evocheck' && x.uid === item.uid)) return;
    list.push(item);
  }

  /** 쓰러진 자리 채우기: 사람은 고르게, AI 는 바로 */
  afterFaints() {
    this.prompts.clear();
    this.actions.clear();
    this.phase = 'replace';
    for (const s of this.allSlots()) {
      if (this.alive(s)) continue;
      if (!s.mon && s.pi < 0) continue;
      const avail = s.ctrl.party.map((m, i) => i).filter((i) => { const m = s.ctrl.party[i]; return m && m.hp > 0 && !m.egg && !this.sides[s.side].slots.some((o) => o !== s && o.ctrl === s.ctrl && o.pi === i && this.alive(o)); });
      if (!avail.length) continue;
      if (s.ctrl.ai === 'wild') continue;
      if (s.ctrl.human) {
        // 한 사람이 두 자리를 가질 때 같은 포켓몬을 두 번 고르지 않도록
        this.prompts.set(this.key(s), { kind: 'replace', key: this.key(s), ctrl: s.ctrl.id, party: s.ctrl.party.map((m) => dex.publicMon(m, false)), choices: avail });
      } else this.actions.set(this.key(s), { type: 'replace', party: avail[0] });
    }
    if (!this.prompts.size) this.resolveReplace();
  }

  resolveReplace() {
    const chosen = new Set();
    for (const [k, a] of this.actions) {
      if (a.type !== 'replace') continue;
      const s = this.slotByKey(k);
      let pi = a.party;
      if (chosen.has(s.ctrl.idx + ':' + pi)) {
        pi = s.ctrl.party.findIndex((m, i) => m && m.hp > 0 && !m.egg && !chosen.has(s.ctrl.idx + ':' + i) && !this.sides[s.side].slots.some((o) => o.ctrl === s.ctrl && o.pi === i && this.alive(o)));
        if (pi < 0) continue;
      }
      chosen.add(s.ctrl.idx + ':' + pi);
      s.pi = pi; s.mon = s.ctrl.party[pi]; s.fainted = null;
      this.sendOut(s);
    }
    this.checkFaints();
    if (this.result) { this.flush(); return; }
    this.newTurn();
    this.flush();
  }

  finish(result) {
    if (this.result) return;
    this.result = result;
    this.phase = 'over';
    this.prompts.clear();
    // 변신·흉내 원래대로
    for (const s of this.allSlots()) { s.vol = newVol(); }
    if (this.kind === 'trainer' && result.winner === 0) {
      const t = this.trainer;
      const last = this.sides[1].ctrls[0].party.reduce((a, m) => Math.max(a, m ? m.level : 0), 0);
      this.moneyWon = t.reward * last;
      this.say(`${t.title} ${J(t.name, '과/와')}의 승부에서 이겼다!`);
      if (t.beaten) for (const p of t.beaten) this.log({ t: 'trainertext', s: p });
    }
    this.log({ t: 'end', result: { winner: result.winner, reason: result.reason } });
  }

  // ───────── 화면 정보 ─────────
  view(pid) {
    const mySide = this.sideOf(pid);
    const sides = this.sides.map((side) => ({
      name: side.name,
      slots: side.slots.map((s) => ({
        mon: s.mon ? Object.assign(dex.publicMon(s.mon, false), { owner: s.ctrl.name, mine: s.ctrl.id === pid, sub: s.vol.sub > 0, transformed: s.vol.transformed ? s.vol.transformed.species : null }) : null,
        ctrl: s.ctrl.id, human: s.ctrl.human,
      })),
      party: side.ctrls.map((c) => ({ id: c.id, name: c.name, balls: c.party.map((m) => (m ? (m.egg ? 'egg' : m.hp > 0 ? (m.status ? 'status' : 'ok') : 'faint') : null)) })),
    }));
    const prompts = [...this.prompts.values()].filter((p) => p.ctrl === pid);
    return {
      id: this.id, kind: this.kind, turn: this.turn, mySide, sides, weather: this.weather && this.weather.kind,
      trainer: this.trainer ? { name: this.trainer.name, title: this.trainer.title, pic: this.trainer.pic, cls: this.trainer.cls } : null,
      prompt: prompts[0] || null, waiting: !prompts.length && this.prompts.size > 0, over: !!this.result,
    };
  }

  flush() {
    const ev = this.events;
    this.events = [];
    this.emit('update', ev);
  }
}

module.exports = { Battle };
