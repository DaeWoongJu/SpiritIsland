'use strict';
const { EventEmitter } = require('events');
const D = require('./data');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class GameOver extends Error {}

class Game extends EventEmitter {
  /**
   * @param {{id:string,name:string,bot?:boolean,hero:string,aspect:string}[]} players 차례 순서대로
   * @param {{seed?:number, settings?:{villain?:string, difficulty?:string}}} opts
   */
  constructor(players, opts = {}) {
    super();
    this.seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.rand = mulberry32(this.seed);
    this.botRand = mulberry32((this.seed ^ 0x5bd1e995) >>> 0); // AI 선택용 (게임 진행 난수와 분리: 저장/이어하기 재현을 위해)
    this.settings = { villain: 'brute', difficulty: 'standard', ...(opts.settings || {}) };
    this.villainDef = D.VILLAINS.find((v) => v.id === this.settings.villain) || D.VILLAINS[0];
    this.diff = D.DIFFICULTIES.find((d) => d.id === this.settings.difficulty) || D.DIFFICULTIES[2];
    this.players = players.map((p) => ({ id: p.id, name: p.name, bot: !!p.bot, hero: p.hero, aspect: p.aspect }));
    this.order = this.players.map((p) => p.id);
    this.prompts = {};
    this.promptSeq = 1;
    this.logs = [];
    this.logSeq = 1;
    this.round = 0;
    this.phase = 'setup';
    this.result = null;
    this.current = null;
    this.firstIdx = 0;
    this.uidSeq = 1;
    this.cards = {};
    this.events = [];
    this.evSeq = 0;
  }

  // ───────────── 도구 ─────────────
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  newId(prefix) { return prefix + this.uidSeq++; }
  def(uid) { return D.CARD_MAP[this.cards[uid]]; }
  hero(pid) { return D.HEROES.find((h) => h.id === this.P(pid).heroId); }
  P(pid) { return this.ps[pid]; }
  pname(pid) { const p = this.players.find((x) => x.id === pid); const h = this.ps && this.ps[pid] && this.hero(pid); return h ? `${p.name}(${this.form(pid) === 'hero' ? h.name : h.alter.name})` : (p ? p.name : pid); }
  log(text, pid = null, kind = '') { this.logs.push({ seq: this.logSeq++, text, pid, kind, round: this.round }); if (this.logs.length > 300) this.logs.shift(); }
  changed() { if (this.events.length > 40) this.events = this.events.slice(-20); this.emit('update'); }
  nPlayers() { return this.order.length; }
  alive() { return this.order.filter((pid) => !this.P(pid).defeated); }
  form(pid) { return this.P(pid).form; }

  // ───────────── 선택(프롬프트) ─────────────
  ask(pid, prompt) {
    if (this.result) return new Promise(() => {});
    return new Promise((resolve) => {
      this.prompts[pid] = { id: this.promptSeq++, prompt, resolve };
      this.changed();
    });
  }
  currentPrompt(pid) { const e = this.prompts[pid]; return e ? { id: e.id, ...e.prompt } : null; }
  answer(pid, promptId, value) {
    const e = this.prompts[pid];
    if (!e) return '대기 중인 선택이 없습니다.';
    if (e.id !== promptId) return '이미 처리된 선택입니다.';
    const p = e.prompt;
    if (p.type === 'option') {
      const o = p.options.find((x) => x.value === value);
      if (!o) return '잘못된 선택입니다.';
      if (o.disabled) return o.reason || '지금은 할 수 없습니다.';
    } else if (p.type === 'cards') {
      if (value === null && p.cancel) { /* 취소 */ } else {
        if (!Array.isArray(value) || new Set(value).size !== value.length || value.some((v) => !p.cards.includes(v))) return '잘못된 카드 선택입니다.';
        if (p.pay != null && this.resourceSum(value) + Math.min(this.P(pid).bonusRes, p.pay) < p.pay) return `자원이 모자랍니다 (필요 ${p.pay}).`;
      }
    }
    delete this.prompts[pid];
    this.changed();
    e.resolve(value);
    return null;
  }
  async choose(pid, title, options, extra = {}) {
    const ok = options.filter((o) => !o.disabled);
    if (ok.length === 1 && !extra.always) return ok[0].value;
    return this.ask(pid, { type: 'option', title, options, ...extra });
  }

  endGame(win, reason) {
    if (this.result) throw new GameOver();
    this.result = { win, reason, round: this.round };
    this.phase = 'end';
    this.current = null;
    this.log(win ? `🎉 승리! ${reason}` : `💀 패배... ${reason}`, null, win ? 'win' : 'lose');
    this.prompts = {};
    this.changed();
    throw new GameOver();
  }

  // ───────────── 준비 ─────────────
  setup() {
    const n = this.nPlayers();
    this.ps = {};
    for (const pl of this.players) {
      const heroDef = D.HEROES.find((h) => h.id === pl.hero) || D.HEROES[0];
      const aspect = D.ASPECTS[pl.aspect] ? pl.aspect : 'justice';
      const deck = this.shuffle(D.buildDeck(heroDef.id, aspect).map((id) => { const u = this.newId('c'); this.cards[u] = id; return u; }));
      this.ps[pl.id] = {
        heroId: heroDef.id, aspect, form: 'alter', hp: heroDef.hp, exhausted: false, flipped: false, abilityUsed: false,
        stunned: false, confused: false, tough: false, deck, hand: [], discard: [], play: [], engaged: [],
        bonusRes: 0, defeated: false, extraEncounter: 0, pending: [],
      };
      this.draw(pl.id, heroDef.alter.hand, true);
    }
    // 악당
    const vs = this.diff.stages.map((i) => this.villainDef.stages[i]);
    this.villain = { stages: vs, stageIdx: 0, hp: this.stageHp(vs[0]), maxHp: this.stageHp(vs[0]), stunned: false, confused: false, tough: false, attachments: [] };
    const sc = this.villainDef.scheme;
    this.scheme = { name: sc.name, text: sc.text, threat: sc.start * n, threshold: Math.ceil(sc.threshold * n * this.diff.thresholdMul), accel: sc.accel };
    this.sides = [];
    this.encDeck = [];
    for (const [id, k] of Object.entries(this.villainDef.encounter)) for (let i = 0; i < k; i++) this.encDeck.push(id);
    this.shuffle(this.encDeck);
    this.encDiscard = [];
    this.extraAccel = 0;
    this.log(`악당 「${this.villainDef.name}」 (${this.villain.stages.map((s) => s.stage).join('→')}단계) · 난이도 ${this.diff.name}`);
    this.log(`주 계략 「${sc.name}」: 위협 ${this.scheme.threat} / 한계 ${this.scheme.threshold}`);
    this.log('모든 영웅은 일상 모습으로 시작해요. 내 차례에 "변신"하면 영웅이 됩니다.');
  }

  // ───────────── 진행 ─────────────
  async run() {
    try {
      this.setup();
      for (this.round = 1; this.round <= 60; this.round++) {
        await this.playerPhase();
        await this.villainPhase();
        this.endPhase();
      }
      this.endGame(false, '너무 오래 걸렸습니다.');
    } catch (e) {
      if (!(e instanceof GameOver)) { console.error(e); if (!this.result) { this.result = { win: false, reason: '서버 오류: ' + e.message }; this.changed(); } }
    }
    return this.result;
  }

  async playerPhase() {
    this.phase = 'player';
    this.log(`══════ ${this.round}라운드 — 영웅 단계 ══════`, null, 'round');
    const n = this.order.length;
    for (let k = 0; k < n; k++) {
      const pid = this.order[(this.firstIdx + k) % n];
      if (this.P(pid).defeated) continue;
      await this.takeTurn(pid);
    }
  }

  endPhase() {
    this.phase = 'end-round';
    for (const pid of this.alive()) {
      const p = this.P(pid);
      const hs = this.handSize(pid);
      if (p.hand.length < hs) this.draw(pid, hs - p.hand.length);
      p.exhausted = false; p.flipped = false; p.abilityUsed = false;
      for (const c of p.play) c.exhausted = false;
    }
    this.firstIdx = (this.firstIdx + 1) % this.order.length;
    this.log('── 라운드 끝: 손패를 채우고 모든 카드를 준비합니다 ──');
    this.changed();
  }

  // ───────────── 스탯 ─────────────
  mods(pid) {
    const m = { thw: 0, atk: 0, def: 0, hp: 0, allyAtk: 0, allyThw: 0 };
    for (const c of this.P(pid).play) { const d = this.def(c.uid); if (d.mods) for (const [k, v] of Object.entries(d.mods)) m[k] = (m[k] || 0) + v; }
    return m;
  }
  stat(pid, k) { const h = this.hero(pid); return (h.hero[k] || 0) + (this.mods(pid)[k] || 0); }
  maxHp(pid) { return this.hero(pid).hp + this.mods(pid).hp; }
  handSize(pid) { const h = this.hero(pid); return this.form(pid) === 'hero' ? h.hero.hand : h.alter.hand; }
  allies(pid) { return this.P(pid).play.filter((c) => this.def(c.uid).type === 'ally'); }
  stageHp(st) { return Math.max(1, Math.round(st.hp * this.nPlayers() * (this.diff.hpMul || 1))); }
  villainStage() { return this.villain.stages[this.villain.stageIdx]; }
  villainSch() { return this.villainStage().sch + this.villain.attachments.reduce((a, id) => a + ((D.ENC_MAP[id].mods || {}).sch || 0), 0); }
  villainAtk() { return this.villainStage().atk + this.villain.attachments.reduce((a, id) => a + ((D.ENC_MAP[id].mods || {}).atk || 0), 0); }
  allMinions() { return this.order.flatMap((pid) => this.P(pid).engaged); }
  findMinion(iid) { for (const pid of this.order) { const m = this.P(pid).engaged.find((x) => x.iid === iid); if (m) return m; } return null; }
  enemyName(t) { return t === 'villain' || (t && t.kind === 'villain') ? this.villainDef.name : (typeof t === 'string' ? (this.findMinion(t) || {}).name : t.name); }

  // ───────────── 카드 / 자원 ─────────────
  draw(pid, n, quiet = false) {
    const p = this.P(pid);
    for (let i = 0; i < n; i++) {
      if (!p.deck.length) {
        if (!p.discard.length) break;
        p.deck = this.shuffle(p.discard);
        p.discard = [];
        p.extraEncounter++;
        this.log(`${this.pname(pid)}: 덱이 떨어져 버린 카드를 섞었습니다 (벌칙: 다음 악당 단계에 조우 카드 +1장)`, pid);
      }
      p.hand.push(p.deck.pop());
    }
    if (!quiet && n) this.log(`${this.pname(pid)}: 카드 ${n}장 뽑기`, pid);
    this.changed();
  }
  resourceSum(uids) { return uids.reduce((a, u) => a + (this.def(u) ? this.def(u).resN : 0), 0); }
  canPay(pid, cost, exclude) {
    const p = this.P(pid);
    return this.resourceSum(p.hand.filter((u) => u !== exclude)) + p.bonusRes >= cost;
  }
  suggestPay(pid, cost, exclude) {
    const p = this.P(pid);
    let need = Math.max(0, cost - p.bonusRes);
    const pool = p.hand.filter((u) => u !== exclude);
    // 자원 카드 → 비싼 카드보다 싼 카드 순서로
    const rank = (u) => { const d = this.def(u); return (d.type === 'resource' ? -10 : 0) + d.cost + (d.type === 'ally' ? 1 : 0); };
    const out = [];
    for (const u of pool.slice().sort((a, b) => rank(a) - rank(b))) { if (need <= 0) break; out.push(u); need -= this.def(u).resN; }
    return out;
  }
  async payCost(pid, cost, exclude, cancel = true) {
    const p = this.P(pid);
    const paid = { energy: 0, mental: 0, physical: 0, wild: 0 };
    if (cost <= 0) return paid;
    const useBonus = Math.min(p.bonusRes, cost);
    if (cost - useBonus <= 0) { p.bonusRes -= useBonus; return paid; }
    const v = await this.ask(pid, { type: 'cards', kind: 'pay', title: `비용 ${cost}${useBonus ? ` (보너스 자원 ${useBonus} 사용)` : ''}: 버릴 카드를 고르세요. 카드 아래쪽 자원 아이콘 개수만큼 자원이 돼요.`,
      cards: p.hand.filter((u) => u !== exclude), pay: cost, suggest: this.suggestPay(pid, cost, exclude), cancel });
    if (v === null) return null;
    p.bonusRes -= useBonus;
    for (const u of v) { const d = this.def(u); paid[d.res] = (paid[d.res] || 0) + d.resN; }
    p.hand = p.hand.filter((u) => !v.includes(u));
    p.discard.push(...v);
    this.log(`${this.pname(pid)}: 비용으로 ${v.map((u) => `[${this.def(u).name}]`).join(' ')} 버림`, pid);
    return paid;
  }
  bonus(pid, n) { this.P(pid).bonusRes += n; this.log(`${this.pname(pid)}: 다음 비용에 쓸 자원 +${n}`, pid); }

  // ───────────── 턴 ─────────────
  turnOptions(pid) {
    const p = this.P(pid);
    const o = [];
    const add = (value, label, group, ok, reason, extra = {}) => o.push({ value, label, group, disabled: !ok, reason: ok ? undefined : reason, ...extra });
    const hero = this.form(pid) === 'hero';
    for (const uid of p.hand) {
      const d = this.def(uid);
      if (d.type === 'resource') continue;
      if (d.defense) { add('play:' + uid, `🛡 ${d.name}`, 'card', false, '방어 이벤트는 악당이 나를 공격할 때 쓸 수 있어요', { card: uid }); continue; }
      let why = '';
      if (d.form === 'hero' && !hero) why = '영웅 모습일 때만 쓸 수 있어요';
      else if (d.type === 'ally' && this.allies(pid).length >= D.ALLY_LIMIT) why = `아군은 ${D.ALLY_LIMIT}명까지예요`;
      else if (d.attack && !this.damageTargets(pid, { attack: true }).length) why = '공격할 대상이 없어요';
      else if (!this.canPay(pid, d.cost, uid)) why = `자원이 모자라요 (비용 ${d.cost})`;
      add('play:' + uid, `🃏 ${d.name} (${d.cost})`, 'card', !why, why, { card: uid });
    }
    if (hero) {
      const guardOnly = this.guarded(pid);
      add('attack', `👊 공격 (${this.stat(pid, 'atk')})`, 'basic', !p.exhausted, '영웅이 소진됐어요', { hint: guardOnly ? '경비 미니언부터!' : '' });
      add('thwart', `🛑 저지 (${this.stat(pid, 'thw')})`, 'basic', !p.exhausted && this.thwartTargets({}).length > 0, p.exhausted ? '영웅이 소진됐어요' : '위협을 제거할 계략이 없어요');
    } else {
      add('recover', `❤ 회복 (${this.hero(pid).alter.rec})`, 'basic', !p.exhausted && p.hp < this.maxHp(pid), p.exhausted ? '이미 소진됐어요' : '체력이 가득해요');
    }
    const ab = hero ? this.hero(pid).hero.ability : this.hero(pid).alter.ability;
    add('ability', `✨ ${ab.name}`, 'basic', !p.abilityUsed, '이번 라운드에 이미 썼어요');
    add('flip', hero ? '🔄 일상 모습으로' : '🦸 변신 (영웅 모습으로)', 'basic', !p.flipped, '모습 바꾸기는 라운드마다 1번이에요');
    for (const c of this.allies(pid)) {
      const d = this.def(c.uid);
      const m = this.mods(pid);
      add('allyatk:' + c.uid, `${d.name} 공격 (${d.ally.atk + m.allyAtk})`, 'ally', !c.exhausted && d.ally.atk + m.allyAtk > 0, c.exhausted ? '소진됨' : '공격력 0', { card: c.uid });
      add('allythw:' + c.uid, `${d.name} 저지 (${d.ally.thw + m.allyThw})`, 'ally', !c.exhausted && d.ally.thw + m.allyThw > 0 && this.thwartTargets({}).length > 0, c.exhausted ? '소진됨' : '저지력 0', { card: c.uid });
    }
    for (const c of p.play) {
      const d = this.def(c.uid);
      if (!d.action) continue;
      let why = '';
      if (d.action.exhaust && c.exhausted) why = '소진됨';
      else if (d.action.uses && (c.uses || 0) <= 0) why = '사용 횟수를 다 썼어요';
      else if (d.action.form === 'hero' && !hero) why = '영웅 모습일 때만';
      add('use:' + c.uid, `⚙ ${d.action.name}`, 'tech', !why, why, { card: c.uid });
    }
    add('end', '차례 끝내기 ▶', 'end', true, '');
    return o;
  }

  async takeTurn(pid) {
    this.current = pid;
    this.log(`▶ ${this.pname(pid)}의 차례`, pid, 'turn');
    for (let guard = 0; guard < 80; guard++) {
      const v = await this.ask(pid, { type: 'option', kind: 'turn', title: `${this.round}라운드 — 내 차례: 행동을 고르세요 (원하는 만큼)`, options: this.turnOptions(pid) });
      if (v === 'end') break;
      const [kind, arg] = v.split(':');
      if (kind === 'play') await this.playCard(pid, arg);
      else if (kind === 'attack') await this.basicAttack(pid);
      else if (kind === 'thwart') await this.basicThwart(pid);
      else if (kind === 'recover') this.recover(pid);
      else if (kind === 'flip') this.flip(pid);
      else if (kind === 'ability') await this.useAbility(pid);
      else if (kind === 'allyatk' || kind === 'allythw') await this.allyAct(pid, arg, kind === 'allyatk');
      else if (kind === 'use') await this.useAction(pid, arg);
      if (this.P(pid).defeated) break;
      this.changed();
    }
    this.current = null;
  }

  async playCard(pid, uid) {
    const p = this.P(pid);
    const d = this.def(uid);
    const paid = await this.payCost(pid, d.cost, uid, true);
    if (!paid) return false;
    p.hand = p.hand.filter((u) => u !== uid);
    this.events.push({ id: ++this.evSeq, kind: 'play', pid, card: uid });
    this.log(`${this.pname(pid)}: [${d.name}] 사용 — ${d.text}`, pid, 'play');
    const ctx = { paid };
    if (d.type === 'event') {
      p.discard.push(uid);
      await d.effect(this, pid, ctx);
    } else {
      const c = { uid, exhausted: false, damage: 0, uses: d.action && d.action.uses ? d.action.uses : 0 };
      p.play.push(c);
      if (d.mods && d.mods.hp) p.hp += d.mods.hp;
      if (d.effect) await d.effect(this, pid, ctx);
    }
    this.changed();
    return true;
  }

  flip(pid) {
    const p = this.P(pid);
    p.form = p.form === 'hero' ? 'alter' : 'hero';
    p.flipped = true;
    const h = this.hero(pid);
    this.events.push({ id: ++this.evSeq, kind: 'flip', pid });
    this.log(p.form === 'hero' ? `🦸 ${h.alter.name}이(가) ${h.name}(으)로 변신!` : `${h.name}이(가) ${h.alter.name}(으)로 돌아갑니다 (일상 모습: 회복할 수 있지만 악당이 계략을 꾸며요)`, pid, 'flip');
  }

  async useAbility(pid) {
    const p = this.P(pid);
    if (p.abilityUsed) return;
    const ab = this.form(pid) === 'hero' ? this.hero(pid).hero.ability : this.hero(pid).alter.ability;
    p.abilityUsed = true;
    this.log(`${this.pname(pid)}: 능력 「${ab.name}」 — ${ab.text}`, pid);
    await ab.effect(this, pid, {});
  }

  async basicAttack(pid) {
    const p = this.P(pid);
    p.exhausted = true;
    if (p.stunned) { p.stunned = false; this.log(`${this.pname(pid)}: 기절 상태라 공격이 무효가 되었습니다 (기절 해제)`, pid); return; }
    await this.damage(pid, this.stat(pid, 'atk'), { attack: true, attacker: { kind: 'hero', pid } });
  }
  async basicThwart(pid) {
    const p = this.P(pid);
    p.exhausted = true;
    if (p.confused) { p.confused = false; this.log(`${this.pname(pid)}: 혼란 상태라 저지가 무효가 되었습니다 (혼란 해제)`, pid); return; }
    await this.thwart(pid, this.stat(pid, 'thw'));
  }
  recover(pid) {
    const p = this.P(pid);
    p.exhausted = true;
    this.heal(pid, this.hero(pid).alter.rec);
  }

  async allyAct(pid, uid, atk) {
    const c = this.P(pid).play.find((x) => x.uid === uid);
    if (!c || c.exhausted) return;
    const d = this.def(uid);
    const m = this.mods(pid);
    c.exhausted = true;
    if (atk) await this.damage(pid, d.ally.atk + m.allyAtk, { attack: true, attacker: { kind: 'ally', pid, uid } });
    else await this.thwart(pid, d.ally.thw + m.allyThw);
    // 결과 피해 (아군이 기본 능력을 쓰면 다침)
    if (this.P(pid).play.includes(c)) this.damageAlly(pid, c, d.ally.cons, '결과 피해');
  }

  async useAction(pid, uid) {
    const c = this.P(pid).play.find((x) => x.uid === uid);
    const d = c && this.def(uid);
    if (!d || !d.action) return;
    if (d.action.exhaust) c.exhausted = true;
    if (d.action.uses) {
      c.uses--;
      if (c.uses <= 0) { this.P(pid).play = this.P(pid).play.filter((x) => x !== c); this.P(pid).discard.push(uid); this.log(`[${d.name}] 사용 횟수를 다 써서 버립니다`, pid); }
    }
    this.log(`${this.pname(pid)}: [${d.name}] — ${d.action.name}`, pid);
    await d.action.effect(this, pid, {});
  }

  // ───────────── 피해 / 저지 ─────────────
  guarded(pid) { return this.P(pid).engaged.some((m) => m.guard); }
  damageTargets(pid, opts) {
    const out = [];
    const guard = opts.attack && this.guarded(pid);
    if (!opts.minionOnly && !guard) out.push({ value: 'villain', label: `😈 ${this.villainDef.name} (체력 ${this.villain.hp})`, target: 'villain' });
    if (!opts.villainOnly) {
      for (const m of (guard ? this.P(pid).engaged.filter((x) => x.guard) : this.allMinions())) out.push({ value: m.iid, label: `👾 ${m.name} (체력 ${m.hp})`, target: m.iid });
    }
    return out;
  }
  async damage(pid, n, opts = {}, ctx = {}) {
    const options = this.damageTargets(pid, opts);
    if (!options.length) { this.log('피해를 줄 대상이 없습니다', pid); return null; }
    const v = await this.choose(pid, `피해 ${n >= 99 ? '(처치)' : n}을(를) 줄 적을 고르세요${opts.attack && this.guarded(pid) ? ' — 경비 미니언이 있어 악당은 공격할 수 없어요' : ''}`, options, { kind: 'target' });
    const target = v === 'villain' ? 'villain' : v;
    this.dealTo(target, n, pid, { attack: !!opts.attack, attacker: opts.attacker || (ctx && ctx.attacker) || { kind: 'hero', pid } });
    return target;
  }
  dealTo(target, n, pid, opts = {}) {
    if (target === 'villain') {
      const v = this.villain;
      if (v.tough) { v.tough = false; this.log(`😈 ${this.villainDef.name}: 강인함으로 피해를 막았습니다`, pid); this.changed(); return; }
      v.hp -= n;
      this.events.push({ id: ++this.evSeq, kind: 'hit', target: 'villain', n });
      this.log(`😈 ${this.villainDef.name}에게 피해 ${n} (남은 체력 ${Math.max(0, v.hp)})`, pid, 'hit');
      if (v.hp <= 0) this.villainDefeated();
      this.changed();
      return;
    }
    const m = typeof target === 'string' ? this.findMinion(target) : target;
    if (!m) return;
    if (m.tough) { m.tough = false; this.log(`👾 ${m.name}: 강인함으로 피해를 막았습니다`, pid); this.changed(); return; }
    m.hp -= n;
    this.events.push({ id: ++this.evSeq, kind: 'hit', target: m.iid, n });
    this.log(`👾 ${m.name}에게 피해 ${n >= 99 ? '(처치)' : n}`, pid, 'hit');
    if (opts.attack && m.retaliate && opts.attacker) {
      this.log(`👾 ${m.name}의 반격 ${m.retaliate}!`, pid);
      if (opts.attacker.kind === 'hero') this.damageHero(opts.attacker.pid, m.retaliate, '반격');
      else if (opts.attacker.kind === 'ally') { const c = this.P(opts.attacker.pid).play.find((x) => x.uid === opts.attacker.uid); if (c) this.damageAlly(opts.attacker.pid, c, m.retaliate, '반격'); }
    }
    if (m.hp <= 0) {
      for (const p of this.order) this.P(p).engaged = this.P(p).engaged.filter((x) => x !== m);
      this.encDiscard.push(m.cardId);
      this.log(`👾 ${m.name} 처치!`, pid, 'kill');
    }
    this.changed();
  }
  damageVillain(n, pid) { if (n > 0) this.dealTo('villain', n, pid); }
  damageAllMinions(n, pid) { for (const m of this.allMinions().slice()) this.dealTo(m, n, pid); }

  villainDefeated() {
    const v = this.villain;
    if (v.stageIdx + 1 >= v.stages.length) this.endGame(true, `${this.villainDef.name}을(를) 쓰러뜨렸습니다! 도시를 지켜냈어요.`);
    v.stageIdx++;
    const st = this.villainStage();
    v.hp = this.stageHp(st);
    v.maxHp = v.hp;
    v.stunned = false; v.confused = false; v.tough = false;
    this.events.push({ id: ++this.evSeq, kind: 'stage' });
    this.log(`💥 ${this.villainDef.name}의 ${v.stages[v.stageIdx - 1].stage}단계를 쓰러뜨렸습니다! → ${st.stage}단계 (체력 ${v.hp})${st.text ? ` · ${st.text}` : ''}`, null, 'stage');
    if (st.tough) v.tough = true;
    if (st.threat) this.addThreat(this.nPlayers(), `${st.stage}단계 시작`);
    if (st.drones) for (const p of this.alive()) this.summon(p, 'drone', true);
  }

  thwartTargets(opts) {
    const crisis = this.sides.some((s) => s.crisis);
    const out = [];
    if (!opts.sideOnly && !crisis && this.scheme.threat > 0) out.push({ value: 'main', label: `🗺 ${this.scheme.name} (위협 ${this.scheme.threat}/${this.scheme.threshold})`, scheme: 'main' });
    if (!opts.mainOnly) for (const s of this.sides) out.push({ value: s.sid, label: `📌 ${s.name} (위협 ${s.threat})`, scheme: s.sid });
    return out;
  }
  async thwart(pid, n, opts = {}) {
    const options = this.thwartTargets(opts);
    if (!options.length) { this.log(this.sides.some((s) => s.crisis) && opts.mainOnly ? '위기 계략 때문에 주 계략의 위협을 제거할 수 없습니다' : '위협을 제거할 계략이 없습니다', pid); return; }
    const v = await this.choose(pid, `위협 ${n}을(를) 제거할 계략을 고르세요`, options, { kind: 'scheme' });
    this.removeThreat(v, n, pid);
  }
  thwartEach(pid, n) { for (const o of this.thwartTargets({})) this.removeThreat(o.value, n, pid); }
  removeThreat(where, n, pid) {
    if (where === 'main') {
      const k = Math.min(n, this.scheme.threat);
      this.scheme.threat -= k;
      this.log(`🗺 ${this.scheme.name}: 위협 -${k} (${this.scheme.threat}/${this.scheme.threshold})`, pid, 'thwart');
    } else {
      const s = this.sides.find((x) => x.sid === where);
      if (!s) return;
      s.threat -= n;
      this.log(`📌 ${s.name}: 위협 -${n}`, pid, 'thwart');
      if (s.threat <= 0) { this.sides = this.sides.filter((x) => x !== s); this.encDiscard.push(s.cardId); this.log(`📌 부가 계략 「${s.name}」을(를) 막아냈습니다!`, pid, 'kill'); }
    }
    this.events.push({ id: ++this.evSeq, kind: 'thwart', where });
    this.changed();
  }
  addThreat(n, label = '') {
    if (n <= 0) return;
    this.scheme.threat += n;
    this.log(`⚠ ${label ? `${label}: ` : ''}주 계략 위협 +${n} (${this.scheme.threat}/${this.scheme.threshold})`, null, 'threat');
    this.changed();
    if (this.scheme.threat >= this.scheme.threshold) this.endGame(false, `「${this.scheme.name}」 계략이 완성되었습니다.`);
  }

  // ───────────── 영웅 / 아군 상태 ─────────────
  heal(pid, n) {
    const p = this.P(pid);
    const k = Math.min(n, this.maxHp(pid) - p.hp);
    p.hp += k;
    if (k > 0) this.log(`${this.pname(pid)}: 체력 +${k} (${p.hp}/${this.maxHp(pid)})`, pid, 'heal');
    this.changed();
  }
  async chooseHero(pid, title) {
    const opts = this.alive().map((h) => ({ value: h, label: `${this.pname(h)} (체력 ${this.P(h).hp}/${this.maxHp(h)})`, hero: h }));
    return this.choose(pid, title, opts, { kind: 'hero' });
  }
  async healAny(pid, n) { this.heal(await this.chooseHero(pid, `체력 ${n}을 회복할 영웅을 고르세요`), n); }
  toughSelf(pid) { this.P(pid).tough = true; this.log(`${this.pname(pid)}: 강인함 (다음 피해 1번 무효)`, pid); this.changed(); }
  async toughAny(pid) { this.toughSelf(await this.chooseHero(pid, '강인함을 줄 영웅을 고르세요')); }
  readyHero(pid) { this.P(pid).exhausted = false; this.log(`${this.pname(pid)}: 영웅 준비 (다시 행동할 수 있어요)`, pid); this.changed(); }
  readyAllies(pid) { for (const c of this.allies(pid)) c.exhausted = false; this.log(`${this.pname(pid)}: 아군 모두 준비`, pid); this.changed(); }
  async readyAlly(pid) {
    const ex = this.allies(pid).filter((c) => c.exhausted);
    if (!ex.length) { this.log('준비시킬 아군이 없습니다', pid); return; }
    const v = await this.choose(pid, '준비시킬 아군을 고르세요', ex.map((c) => ({ value: c.uid, label: this.def(c.uid).name, card: c.uid })), { kind: 'ally' });
    ex.find((c) => c.uid === v).exhausted = false;
    this.log(`${this.pname(pid)}: [${this.def(v).name}] 준비`, pid);
  }
  async returnAlly(pid) {
    const p = this.P(pid);
    const list = p.discard.filter((u) => this.def(u).type === 'ally');
    if (!list.length) { this.log('버린 더미에 아군이 없습니다', pid); return; }
    const v = await this.choose(pid, '손으로 가져올 아군을 고르세요', list.map((u) => ({ value: u, label: this.def(u).name, card: u })), { kind: 'ally' });
    p.discard = p.discard.filter((u) => u !== v);
    p.hand.push(v);
    this.log(`${this.pname(pid)}: [${this.def(v).name}]을(를) 손으로 가져왔습니다`, pid);
  }
  exhaustHero(pid) { this.P(pid).exhausted = true; this.log(`${this.pname(pid)}: 영웅이 소진되었습니다`, pid); }
  discardRandom(pid, n) {
    const p = this.P(pid);
    for (let i = 0; i < n && p.hand.length; i++) {
      const u = p.hand.splice(Math.floor(this.rand() * p.hand.length), 1)[0];
      p.discard.push(u);
      this.log(`${this.pname(pid)}: [${this.def(u).name}]을(를) 버렸습니다`, pid);
    }
    this.changed();
  }
  async discardOwnTech(pid) {
    const p = this.P(pid);
    const list = p.play.filter((c) => ['upgrade', 'support'].includes(this.def(c.uid).type));
    if (!list.length) return false;
    const v = await this.choose(pid, '버릴 강화·지원 카드를 고르세요 (시스템 해킹)', list.map((c) => ({ value: c.uid, label: this.def(c.uid).name, card: c.uid })), { kind: 'tech' });
    const c = list.find((x) => x.uid === v);
    p.play = p.play.filter((x) => x !== c);
    p.discard.push(v);
    if (p.hp > this.maxHp(pid)) p.hp = this.maxHp(pid);
    this.log(`${this.pname(pid)}: [${this.def(v).name}] 버림`, pid);
    return true;
  }
  statusHero(pid, kind, elseDmg = 0) {
    const p = this.P(pid);
    if (p[kind]) { this.damageHero(pid, elseDmg, '이미 상태 이상'); return; }
    p[kind] = true;
    this.log(`${this.pname(pid)}: ${kind === 'stunned' ? '기절 (다음 기본 공격 무효)' : '혼란 (다음 기본 저지 무효)'}`, pid);
    this.changed();
  }
  applyStatus(target, kind) {
    const t = target === 'villain' ? this.villain : (typeof target === 'string' ? this.findMinion(target) : target);
    if (!t) return;
    t[kind] = true;
    this.log(`${target === 'villain' ? '😈 ' + this.villainDef.name : '👾 ' + t.name}: ${kind === 'stunned' ? '기절 (다음 공격 무효)' : '혼란 (다음 계략 무효)'}`, null, 'status');
    this.changed();
  }
  async statusEnemy(pid, kind) {
    const options = this.damageTargets(pid, {});
    if (!options.length) return null;
    const v = await this.choose(pid, `${kind === 'stunned' ? '기절' : '혼란'}시킬 적을 고르세요`, options, { kind: 'target' });
    this.applyStatus(v, kind);
    return v;
  }
  damageHero(pid, n, label = '') {
    const p = this.P(pid);
    if (n <= 0 || p.defeated) return;
    if (p.tough) { p.tough = false; this.log(`${this.pname(pid)}: 강인함으로 피해를 막았습니다`, pid); this.changed(); return; }
    p.hp -= n;
    this.events.push({ id: ++this.evSeq, kind: 'hurt', pid, n });
    this.log(`${this.pname(pid)}: 피해 ${n}${label ? ` (${label})` : ''} → 체력 ${Math.max(0, p.hp)}`, pid, 'hurt');
    if (p.hp <= 0) {
      p.hp = 0;
      p.defeated = true;
      for (const m of p.engaged) this.encDiscard.push(m.cardId);
      p.engaged = [];
      this.log(`💀 ${this.pname(pid)}이(가) 쓰러졌습니다!`, pid, 'lose');
      if (!this.alive().length) this.endGame(false, '모든 영웅이 쓰러졌습니다.');
    }
    this.changed();
  }
  damageAllHeroes(n, label) { for (const pid of this.alive()) this.damageHero(pid, n, label); }
  damageAlly(pid, c, n, label = '') {
    if (n <= 0) return;
    const d = this.def(c.uid);
    c.damage += n;
    this.log(`[${d.name}] 피해 ${n}${label ? ` (${label})` : ''} (${Math.max(0, d.ally.hp - c.damage)}/${d.ally.hp})`, pid);
    if (c.damage >= d.ally.hp) {
      const p = this.P(pid);
      p.play = p.play.filter((x) => x !== c);
      p.discard.push(c.uid);
      this.log(`[${d.name}]이(가) 쓰러졌습니다`, pid);
    }
    this.changed();
  }

  // ───────────── 조우 덱 ─────────────
  drawEncounter() {
    if (!this.encDeck.length) {
      this.encDeck = this.shuffle(this.encDiscard);
      this.encDiscard = [];
      this.extraAccel++;
      this.log('⚠ 조우 덱이 떨어져 다시 섞습니다. 이제 악당 단계마다 위협이 1 더 쌓여요!', null, 'threat');
    }
    return this.encDeck.pop();
  }
  boost() {
    if (this.diff.noBoost) return 0;
    const id = this.drawEncounter();
    if (!id) return 0;
    this.encDiscard.push(id);
    const b = D.ENC_MAP[id].boost || 0;
    this.log(`🎴 부스트: [${D.ENC_MAP[id].name}] → +${b}`, null, 'boost');
    return b;
  }
  makeMinion(pid, cardId) {
    const e = D.ENC_MAP[cardId];
    const m = { iid: this.newId('m'), cardId, name: e.name, sch: e.sch, atk: e.atk, hp: e.hp, maxHp: e.hp, guard: !!e.guard, retaliate: e.retaliate || 0, stunned: false, confused: false, tough: false };
    this.P(pid).engaged.push(m);
    this.events.push({ id: ++this.evSeq, kind: 'minion', pid, iid: m.iid });
    this.log(`👾 미니언 「${e.name}」이(가) ${this.pname(pid)}와(과) 교전합니다 (계략 ${e.sch} · 공격 ${e.atk} · 체력 ${e.hp}${e.guard ? ' · 경비' : ''}${e.retaliate ? ` · 반격 ${e.retaliate}` : ''})`, pid, 'minion');
    if (e.onEnter) e.onEnter(this, pid);
    return m;
  }
  summon(pid, cardId, always = false) {
    let i = this.encDeck.indexOf(cardId);
    if (i >= 0) this.encDeck.splice(i, 1);
    else if ((i = this.encDiscard.indexOf(cardId)) >= 0) this.encDiscard.splice(i, 1);
    else if (!always) { this.log(`${D.ENC_MAP[cardId].name}이(가) 남아 있지 않습니다`, pid); return; }
    this.makeMinion(pid, cardId);
  }
  async reveal(pid, id) {
    const e = D.ENC_MAP[id];
    this.log(`🎴 ${this.pname(pid)}의 조우 카드: [${e.name}] — ${e.text}`, pid, 'encounter');
    this.events.push({ id: ++this.evSeq, kind: 'encounter', pid, card: id });
    if (e.type === 'minion') this.makeMinion(pid, id);
    else if (e.type === 'treachery') { this.encDiscard.push(id); await e.reveal(this, pid); }
    else if (e.type === 'side') {
      const s = { sid: this.newId('s'), cardId: id, name: e.name, threat: e.threat * (e.perPlayer ? this.nPlayers() : 1), crisis: !!e.crisis, hazard: e.hazard || 0, accel: e.accel || 0, text: e.text };
      this.sides.push(s);
      this.log(`📌 부가 계략 「${e.name}」 등장 (위협 ${s.threat})`, pid, 'threat');
    } else if (e.type === 'attachment') {
      this.villain.attachments.push(id);
      if (e.tough) this.villain.tough = true;
      this.log(`😈 ${this.villainDef.name}에게 [${e.name}] 부착`, pid);
    }
    this.changed();
    if (e.surge && !this.P(pid).defeated) { this.log('쇄도! 조우 카드를 1장 더 공개합니다', pid); await this.reveal(pid, this.drawEncounter()); }
  }

  // ───────────── 악당 단계 ─────────────
  async villainPhase() {
    this.phase = 'villain';
    this.log(`══════ ${this.round}라운드 — 악당 단계 ══════`, null, 'round');
    // 1. 주 계략에 위협
    const accel = this.scheme.accel * this.nPlayers() + this.sides.reduce((a, s) => a + s.accel, 0) + (this.diff.extraAccel || 0) + this.extraAccel;
    this.addThreat(accel, '악당 단계 시작 (가속)');
    // 2. 악당과 미니언 활성화
    const n = this.order.length;
    const turnOrder = Array.from({ length: n }, (_, k) => this.order[(this.firstIdx + k) % n]);
    for (const pid of turnOrder) {
      if (this.P(pid).defeated) continue;
      await this.villainActivate(pid);
      for (const m of this.P(pid).engaged.slice()) {
        if (this.P(pid).defeated) break;
        if (!this.P(pid).engaged.includes(m)) continue;
        await this.minionActivate(pid, m);
      }
    }
    // 3. 조우 카드 나누기 + 공개
    const hazard = this.sides.reduce((a, s) => a + s.hazard, 0);
    const alive = turnOrder.filter((pid) => !this.P(pid).defeated);
    for (const pid of alive) { const p = this.P(pid); p.pending.push(this.drawEncounter()); for (; p.extraEncounter > 0; p.extraEncounter--) p.pending.push(this.drawEncounter()); }
    for (let h = 0; h < hazard && alive.length; h++) this.P(alive[h % alive.length]).pending.push(this.drawEncounter());
    for (const pid of alive) {
      const p = this.P(pid);
      while (p.pending.length && !p.defeated) await this.reveal(pid, p.pending.shift());
      p.pending = [];
    }
    // 4. 부착 효과
    for (const id of this.villain.attachments) {
      const e = D.ENC_MAP[id];
      if (e.regen) { this.villain.hp = Math.min(this.villain.maxHp, this.villain.hp + e.regen); this.log(`😈 [${e.name}]: 악당 체력 +${e.regen}`); }
    }
    this.changed();
  }

  async villainActivate(pid, label = '') {
    if (this.form(pid) === 'hero') await this.villainAttack(pid, { label });
    else this.villainScheme(pid, label);
  }

  villainScheme(pid, label = '') {
    const v = this.villain;
    if (v.confused) { v.confused = false; this.log(`😈 ${this.villainDef.name}: 혼란 상태라 계략이 무효가 되었습니다`, pid); return; }
    const b = this.boost();
    this.log(`😈 ${this.villainDef.name}이(가) ${this.pname(pid)}의 일상 모습을 노리고 계략을 꾸밉니다${label ? ` (${label})` : ''} (계략 ${this.villainSch()} + 부스트 ${b})`, pid, 'scheme');
    this.addThreat(this.villainSch() + b, '악당의 계략');
  }

  async villainAttack(pid, { bonus = 0, label = '' } = {}) {
    const v = this.villain;
    if (v.stunned) { v.stunned = false; this.log(`😈 ${this.villainDef.name}: 기절 상태라 공격이 무효가 되었습니다`, pid); return; }
    const b = this.boost();
    const total = this.villainAtk() + bonus + b;
    this.log(`😈 ${this.villainDef.name}이(가) ${this.pname(pid)}을(를) 공격합니다${label ? ` (${label})` : ''}: 공격 ${this.villainAtk()}${bonus ? ` + ${bonus}` : ''} + 부스트 ${b} = ${total}`, pid, 'attack');
    await this.resolveAttack(pid, total, 'villain', this.villainDef.name);
  }

  async minionActivate(pid, m) {
    if (this.form(pid) === 'hero') {
      if (m.stunned) { m.stunned = false; this.log(`👾 ${m.name}: 기절 상태라 공격 무효`, pid); return; }
      if (!m.atk) return;
      this.log(`👾 ${m.name}이(가) ${this.pname(pid)}을(를) 공격합니다: ${m.atk}`, pid, 'attack');
      await this.resolveAttack(pid, m.atk, m, m.name);
    } else {
      if (m.confused) { m.confused = false; this.log(`👾 ${m.name}: 혼란 상태라 계략 무효`, pid); return; }
      if (!m.sch) return;
      this.addThreat(m.sch, `👾 ${m.name}의 계략`);
    }
  }

  /** 공격을 받을 때: 방어 이벤트 → 영웅 방어 / 아군 막기 / 그냥 맞기 */
  async resolveAttack(pid, total, attacker, attackerName) {
    const p = this.P(pid);
    const atk = { attacker, reduce: 0 };
    for (let guard = 0; guard < 10; guard++) {
      const options = [];
      if (!p.exhausted) options.push({ value: 'hero', label: `🛡 영웅이 방어 (방어력 ${this.stat(pid, 'def')} → 피해 ${Math.max(0, total - this.stat(pid, 'def') - atk.reduce)})`, group: 'defend' });
      for (const c of this.allies(pid).filter((x) => !x.exhausted)) options.push({ value: 'ally:' + c.uid, label: `🧍 ${this.def(c.uid).name}이(가) 대신 막기 (아군이 피해 ${Math.max(0, total - atk.reduce)})`, group: 'defend', card: c.uid });
      for (const u of p.hand.filter((x) => this.def(x).defense)) {
        const d = this.def(u);
        const ok = this.canPay(pid, d.cost, u);
        options.push({ value: 'event:' + u, label: `🃏 ${d.name} (${d.cost})`, group: 'card', disabled: !ok, reason: ok ? undefined : '자원이 모자라요', card: u });
      }
      options.push({ value: 'none', label: `맞기 (피해 ${Math.max(0, total - atk.reduce)})`, group: 'end' });
      const v = await this.choose(pid, `${attackerName}의 공격 ${total}! 어떻게 막을까요?${atk.reduce ? ` (방어 이벤트로 -${atk.reduce})` : ''}`, options, { kind: 'defend', always: true, damage: total });
      if (v.startsWith('event:')) {
        const u = v.slice(6);
        const d = this.def(u);
        const paid = await this.payCost(pid, d.cost, u, true);
        if (!paid) continue;
        p.hand = p.hand.filter((x) => x !== u);
        p.discard.push(u);
        this.log(`${this.pname(pid)}: [${d.name}] — ${d.text}`, pid, 'play');
        await d.effect(this, pid, { paid, attack: atk });
        if (atk.reduce >= total) { this.log('공격을 완전히 막았습니다!', pid); return; }
        continue;
      }
      if (v === 'hero') {
        p.exhausted = true;
        const dmg = Math.max(0, total - this.stat(pid, 'def') - atk.reduce);
        this.log(`${this.pname(pid)}: 방어! (방어력 ${this.stat(pid, 'def')})`, pid, 'defend');
        this.damageHero(pid, dmg, '방어 후');
        return;
      }
      if (v.startsWith('ally:')) {
        const c = p.play.find((x) => x.uid === v.slice(5));
        c.exhausted = true;
        this.log(`[${this.def(c.uid).name}]이(가) 영웅 대신 공격을 막습니다`, pid, 'defend');
        this.damageAlly(pid, c, Math.max(0, total - atk.reduce), '막기');
        return;
      }
      this.damageHero(pid, Math.max(0, total - atk.reduce), '방어 없음');
      return;
    }
  }

  // ───────────── 화면용 상태 ─────────────
  view(forPid) {
    const card = (uid) => ({ uid, id: this.cards[uid] });
    const v = this.villain;
    return {
      round: this.round, phase: this.phase, current: this.current, order: this.order, first: this.order[this.firstIdx],
      players: this.players, settings: this.settings, villainId: this.villainDef.id, difficulty: this.diff.id,
      villain: v ? { hp: Math.max(0, v.hp), maxHp: v.maxHp, stage: this.villainStage().stage, stageIdx: v.stageIdx, stageCount: v.stages.length, stages: v.stages.map((s) => s.stage), sch: this.villainSch(), atk: this.villainAtk(), stunned: v.stunned, confused: v.confused, tough: v.tough, attachments: v.attachments, text: this.villainStage().text } : null,
      scheme: this.scheme, sides: this.sides || [], encDeck: (this.encDeck || []).length, encDiscardTop: this.encDiscard && this.encDiscard.length ? this.encDiscard[this.encDiscard.length - 1] : null,
      accel: this.scheme ? this.scheme.accel * this.nPlayers() + (this.sides || []).reduce((a, s) => a + s.accel, 0) + (this.diff.extraAccel || 0) + (this.extraAccel || 0) : 0,
      ps: Object.fromEntries(this.order.map((pid) => {
        const p = this.ps && this.ps[pid];
        if (!p) return [pid, null];
        const h = this.hero(pid);
        return [pid, {
          heroId: p.heroId, aspect: p.aspect, form: p.form, hp: p.hp, maxHp: this.maxHp(pid), exhausted: p.exhausted, flipped: p.flipped, abilityUsed: p.abilityUsed,
          stunned: p.stunned, confused: p.confused, tough: p.tough, defeated: p.defeated, bonusRes: p.bonusRes,
          thw: this.stat(pid, 'thw'), atk: this.stat(pid, 'atk'), def: this.stat(pid, 'def'), rec: h.alter.rec, handSize: this.handSize(pid),
          hand: pid === forPid ? p.hand.map(card) : null, handCount: p.hand.length, deckCount: p.deck.length, discardCount: p.discard.length,
          play: p.play.map((c) => ({ ...card(c.uid), exhausted: c.exhausted, damage: c.damage, uses: c.uses })),
          engaged: p.engaged.map((m) => ({ ...m })),
          allyMods: { atk: this.mods(pid).allyAtk, thw: this.mods(pid).allyThw },
        }];
      })),
      log: this.logs.slice(-80), result: this.result, events: this.events.slice(-12),
    };
  }
}

// ───────────── AI 동료 ─────────────
function botAnswer(g, pid, pr) {
  const p = g.P(pid);
  if (pr.type === 'cards') return pr.suggest || [];
  const ok = pr.options.filter((o) => !o.disabled);
  const has = (v) => ok.find((o) => o.value === v);
  if (pr.kind === 'turn') {
    const max = g.maxHp(pid);
    const threatRatio = g.scheme.threat / g.scheme.threshold;
    if (g.form(pid) === 'alter' && !p.flipped && p.hp > max * 0.5 && (p.exhausted || p.hp >= max - 1)) return 'flip';
    if (g.form(pid) === 'alter' && has('recover')) return 'recover';
    if (g.form(pid) === 'alter' && !p.flipped && p.hp > max * 0.5) return 'flip';
    if (g.form(pid) === 'hero' && !p.flipped && p.hp <= max * 0.35 && p.exhausted) return 'flip';
    if (has('ability')) return 'ability';
    // 카드: 아군·강화·지원 먼저, 그다음 이벤트 (위협이 높으면 저지 이벤트 우선)
    const cards = ok.filter((o) => o.group === 'card').map((o) => ({ o, d: g.def(o.card) }));
    const pick = cards.find((x) => ['ally', 'upgrade', 'support'].includes(x.d.type))
      || (threatRatio > 0.5 ? cards.find((x) => /위협/.test(x.d.text)) : null)
      || cards.find((x) => x.d.attack)
      || cards.find((x) => !/회복/.test(x.d.text) || p.hp < max - 2);
    if (pick && g.botRand() < 0.9) return pick.o.value;
    const tech = ok.find((o) => o.group === 'tech');
    if (tech) return tech.value;
    const allyOpts = ok.filter((o) => o.group === 'ally');
    const allyPick = allyOpts.find((o) => (threatRatio > 0.45 ? o.value.startsWith('allythw') : o.value.startsWith('allyatk'))) || allyOpts[0];
    if (allyPick) return allyPick.value;
    if (has('thwart') && (threatRatio > 0.45 || g.sides.length)) return 'thwart';
    if (has('attack')) return 'attack';
    if (has('thwart')) return 'thwart';
    return 'end';
  }
  if (pr.kind === 'defend') {
    const dmg = pr.damage || 0;
    const ally = ok.find((o) => o.value.startsWith('ally:'));
    if (ally && dmg >= 2) return ally.value;
    const ev = ok.find((o) => o.value.startsWith('event:'));
    if (ev && dmg >= 3) return ev.value;
    if (has('hero') && (p.hp - dmg <= 4 || dmg >= 3)) return 'hero';
    return 'none';
  }
  if (pr.kind === 'target') {
    // 처치할 수 있는 미니언 → 경비 → 악당
    const dmgM = /피해 (\d+)/.exec(pr.title);
    const n = dmgM ? Number(dmgM[1]) : 99;
    const kill = ok.find((o) => o.target !== 'villain' && g.findMinion(o.target) && g.findMinion(o.target).hp <= n);
    if (kill) return kill.value;
    return (has('villain') || ok[0]).value;
  }
  if (pr.kind === 'scheme') {
    const side = ok.filter((o) => o.scheme !== 'main');
    if (side.length && (g.scheme.threat / g.scheme.threshold < 0.6)) return side[0].value;
    return (has('main') || ok[0]).value;
  }
  if (pr.kind === 'hero') {
    return ok.slice().sort((a, b) => (g.P(a.value).hp / g.maxHp(a.value)) - (g.P(b.value).hp / g.maxHp(b.value)))[0].value;
  }
  return ok[0].value;
}

module.exports = { Game, botAnswer, GameOver };
