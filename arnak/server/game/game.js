'use strict';
const { EventEmitter } = require('events');
const D = require('./data');

const { RES, RES_NAMES, TRAVEL_NAMES, CARD_MAP, resText } = D;

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

const emptyRes = () => ({ coin: 0, compass: 0, tablet: 0, arrow: 0, gem: 0 });
const travelText = (t) => Object.entries(t).filter(([, n]) => n).map(([k, n]) => `${TRAVEL_NAMES[k]} ${n}`).join(' + ') || '없음';
const rewardText = (r) => Object.entries(r).filter(([, n]) => n).map(([k, n]) => (k === 'draw' ? `카드 ${n}장` : k === 'exile' ? '카드 추방' : `${RES_NAMES[k]} ${n}`)).join(' + ');
const VALUE = { coin: 1, compass: 1, tablet: 2, arrow: 2.5, gem: 4 };

class Game extends EventEmitter {
  /**
   * @param {{id:string,name:string,bot?:boolean}[]} players 차례 순서대로
   * @param {{seed?:number}} opts
   */
  constructor(players, opts = {}) {
    super();
    this.rand = mulberry32(opts.seed ?? Math.floor(Math.random() * 2 ** 31));
    this.players = players.map((p) => ({ id: p.id, name: p.name, bot: !!p.bot }));
    this.order = this.players.map((p) => p.id);
    this.prompts = {};
    this.promptSeq = 1;
    this.logs = [];
    this.logSeq = 1;
    this.round = 0;
    this.result = null;
    this.current = null;
    this.firstIdx = 0;
    this.uidSeq = 1;
    this.cards = {}; // uid → 카드 id
    this.templeArrivals = 0;
    this.events = [];
  }

  // ───────────── 기본 도구 ─────────────
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  newCard(id) { const uid = 'c' + this.uidSeq++; this.cards[uid] = id; return uid; }
  def(uid) { return CARD_MAP[this.cards[uid]]; }
  pname(pid) { return (this.players.find((p) => p.id === pid) || {}).name || pid; }
  log(text, pid = null) { this.logs.push({ seq: this.logSeq++, text, pid, round: this.round }); if (this.logs.length > 300) this.logs.shift(); }
  changed() { this.emit('update'); }

  // ───────────── 선택(프롬프트) ─────────────
  ask(pid, prompt) {
    if (this.result) return new Promise(() => {});
    return new Promise((resolve) => {
      this.prompts[pid] = { id: this.promptSeq++, prompt, resolve };
      this.changed();
    });
  }

  currentPrompt(pid) {
    const e = this.prompts[pid];
    return e ? { id: e.id, ...e.prompt } : null;
  }

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
        if (!Array.isArray(value) || new Set(value).size !== value.length) return '잘못된 카드 선택입니다.';
        if (value.some((v) => !p.cards.includes(v))) return '선택할 수 없는 카드입니다.';
        if (value.length < (p.min || 0) || value.length > (p.max ?? 99)) return `카드를 ${p.min}~${p.max}장 고르세요.`;
        if (p.pay) {
          const plan = this.travelPlan(pid, p.pay, value);
          if (!plan) return '이동 비용이 모자랍니다. 카드를 더 고르세요.';
        }
      }
    }
    delete this.prompts[pid];
    this.changed();
    e.resolve(value);
    return null;
  }

  async choose(pid, title, options, extra = {}) {
    if (options.length === 1 && !extra.always) return options[0].value;
    return this.ask(pid, { type: 'option', title, options, ...extra });
  }

  // ───────────── 자원 ─────────────
  P(pid) { return this.ps[pid]; }

  gain(pid, r, quiet = false) {
    const p = this.P(pid);
    const parts = [];
    for (const [k, n] of Object.entries(r)) {
      if (!n) continue;
      if (k === 'draw') { this.drawCards(pid, n); parts.push(`카드 ${n}장`); continue; }
      if (k === 'exile') continue;
      p.res[k] += n;
      parts.push(`${RES_NAMES[k]} +${n}`);
    }
    if (parts.length && !quiet) this.log(`${this.pname(pid)}: ${parts.join(', ')}`, pid);
    this.changed();
  }

  canAfford(pid, cost, discount = null) {
    const res = this.P(pid).res;
    return Object.entries(cost).every(([k, n]) => res[k] >= Math.max(0, n - ((discount && discount[k]) || 0)));
  }

  pay(pid, cost, discount = null) {
    const res = this.P(pid).res;
    for (const [k, n] of Object.entries(cost)) res[k] -= Math.max(0, n - ((discount && discount[k]) || 0));
  }

  /** 아무 자원 n개 면제가 있을 때 지불 가능? (가장 비싼 자원부터 면제) */
  flexDiscount(pid, cost, n) {
    const res = this.P(pid).res;
    const disc = {};
    let left = n;
    // 모자란 것부터 면제
    for (const k of Object.keys(cost)) {
      const short = Math.max(0, cost[k] - res[k]);
      const d = Math.min(short, left);
      if (d) { disc[k] = d; left -= d; }
    }
    for (const k of ['gem', 'arrow', 'tablet', 'compass', 'coin']) {
      if (!left || !cost[k]) continue;
      const d = Math.min(cost[k] - (disc[k] || 0), left);
      if (d > 0) { disc[k] = (disc[k] || 0) + d; left -= d; }
    }
    return disc;
  }

  async convert(pid, cost, reward) {
    if (!this.canAfford(pid, cost)) { this.log(`${this.pname(pid)}: ${resText(cost)}가 없어 교환하지 못했습니다`, pid); return false; }
    const v = await this.choose(pid, `${resText(cost)}을(를) 내고 ${rewardText(reward)}을(를) 얻을까요?`, [{ value: 'yes', label: '교환하기' }, { value: 'no', label: '하지 않기' }], { always: true });
    if (v !== 'yes') return false;
    this.pay(pid, cost);
    this.gain(pid, reward);
    return true;
  }

  async chooseGain(pid, options) {
    const v = await this.choose(pid, '얻을 것을 고르세요', options.map((r, i) => ({ value: String(i), label: rewardText(r) })), { always: true });
    this.gain(pid, options[Number(v)]);
  }

  // ───────────── 카드 ─────────────
  drawCards(pid, n) {
    const p = this.P(pid);
    let drawn = 0;
    for (let i = 0; i < n; i++) {
      if (!p.deck.length) {
        if (!p.discard.length) break;
        p.deck = this.shuffle(p.discard);
        p.discard = [];
        this.log(`${this.pname(pid)}: 버린 카드를 섞어 새 덱을 만듭니다`, pid);
      }
      p.hand.push(p.deck.pop());
      drawn++;
    }
    this.changed();
    return drawn;
  }

  gainFear(pid) {
    const uid = this.newCard('fear');
    this.P(pid).discard.push(uid);
    this.log(`${this.pname(pid)}: 두려움 카드를 받았습니다 (-1점)`, pid);
  }

  async exileCard(pid) {
    const p = this.P(pid);
    const pool = [...p.hand, ...p.play];
    if (!pool.length) return false;
    const fearFirst = pool.slice().sort((a, b) => (this.cards[b] === 'fear') - (this.cards[a] === 'fear'));
    const v = await this.ask(pid, { type: 'cards', kind: 'exile', title: '추방할 카드를 고르세요 (게임에서 영원히 제거). 두려움 카드를 추방하면 좋아요!', cards: fearFirst, min: 0, max: 1, suggest: this.cards[fearFirst[0]] === 'fear' ? [fearFirst[0]] : [] });
    if (!v || !v.length) return false;
    const uid = v[0];
    p.hand = p.hand.filter((x) => x !== uid);
    p.play = p.play.filter((x) => x !== uid);
    p.exiled.push(uid);
    this.log(`${this.pname(pid)}: [${this.def(uid).name}] 카드를 추방했습니다`, pid);
    this.changed();
    return true;
  }

  // ───────────── 이동 비용 ─────────────
  /** cards(uid 목록)로 이동 비용 cost를 낼 수 있는지 계산. 가능하면 { cards, coins } */
  travelPlan(pid, cost, cards) {
    const have = { boot: 0, car: 0, ship: 0, plane: 0 };
    for (const uid of cards) { const t = this.def(uid).travel; if (t) have[t]++; }
    const need = { boot: cost.boot || 0, car: cost.car || 0, ship: cost.ship || 0, plane: cost.plane || 0 };
    const useShip = Math.min(need.ship, have.ship);
    const useCar = Math.min(need.car, have.car);
    const carLeft = have.car - useCar;
    const useBootB = Math.min(need.boot, have.boot);
    const useBootC = Math.min(need.boot - useBootB, carLeft);
    let unmet = (need.ship - useShip) + (need.car - useCar) + (need.boot - useBootB - useBootC) + need.plane;
    const planesUsed = Math.min(unmet, have.plane);
    unmet -= planesUsed;
    const coins = unmet * 2;
    if (coins > this.P(pid).res.coin) return null;
    return { coins };
  }

  /** 추천 조합: 동전을 덜 쓰고, 카드를 덜 쓰고, 덜 아까운 카드(두려움·시작 카드)부터 */
  suggestTravel(pid, cost) {
    const hand = this.P(pid).hand.filter((u) => this.def(u).travel);
    const rank = (u) => ({ fear: 0, start: 1, item: 3, artifact: 4 }[this.def(u).kind] * 10 + { boot: 0, ship: 1, car: 2, plane: 5 }[this.def(u).travel]);
    const n = Object.values(cost).reduce((a, b) => a + b, 0);
    let best = null;
    let bestScore = Infinity;
    const walk = (start, combo) => {
      const plan = this.travelPlan(pid, cost, combo);
      if (plan) {
        const sc = plan.coins * 1000 + combo.length * 100 + combo.reduce((a, u) => a + rank(u), 0);
        if (sc < bestScore) { bestScore = sc; best = combo.slice(); }
      }
      if (combo.length >= n) return;
      for (let i = start; i < hand.length; i++) { combo.push(hand[i]); walk(i + 1, combo); combo.pop(); }
    };
    walk(0, []);
    return best;
  }

  canTravel(pid, cost) {
    if (!Object.values(cost).some(Boolean)) return true;
    return !!this.travelPlan(pid, cost, this.P(pid).hand);
  }

  async payTravel(pid, cost, cancel = true) {
    if (!Object.values(cost).some(Boolean)) return true;
    const p = this.P(pid);
    const suggest = this.suggestTravel(pid, cost) || [];
    const v = await this.ask(pid, {
      type: 'cards', kind: 'travel', title: `이동 비용 [${travelText(cost)}]: 버릴 카드를 고르세요 (카드 왼쪽 위 이동 아이콘). 모자란 비행기는 동전 2개로 대신합니다.`,
      cards: p.hand.filter((u) => this.def(u).travel), min: 0, max: 8, pay: cost, suggest, cancel,
    });
    if (v === null) return false;
    const plan = this.travelPlan(pid, cost, v);
    p.hand = p.hand.filter((u) => !v.includes(u));
    p.play.push(...v);
    if (plan.coins) p.res.coin -= plan.coins;
    this.log(`${this.pname(pid)}: 이동 비용으로 ${v.map((u) => `[${this.def(u).name}]`).join(' ')}${plan.coins ? ` + 동전 ${plan.coins}` : ''} 사용`, pid);
    this.changed();
    return true;
  }

  // ───────────── 준비 ─────────────
  setup() {
    this.sites = {};
    for (const s of D.BASIC_SITES) this.sites[s.id] = { ...s, discovered: true, occupants: [], guardian: null };
    const t1 = this.shuffle(D.SITE_TILES_1.slice());
    const t2 = this.shuffle(D.SITE_TILES_2.slice());
    this.tileDeck = { 1: t1, 2: t2 };
    const idols = this.shuffle(D.IDOLS.slice());
    for (const l of D.LOCATIONS) this.sites[l.id] = { ...l, name: null, reward: null, discovered: false, occupants: [], guardian: null, idol: idols.pop() };
    this.guardianDeck = this.shuffle(D.GUARDIANS.slice());
    this.assistantPool = this.shuffle(D.ASSISTANTS.map((a) => a.id));
    this.assistantOffer = this.assistantPool.splice(0, 4);
    this.templeSupply = Object.fromEntries(D.TEMPLE_TILES.map((t) => [t.id, t.count]));
    this.itemDeck = this.shuffle(D.ITEMS.map((c) => this.newCard(c.id)));
    this.artifactDeck = this.shuffle(D.ARTIFACTS.map((c) => this.newCard(c.id)));
    this.row = new Array(D.ROW_SIZE).fill(null);
    this.staff = 1; // 달 지팡이: 이보다 왼쪽(인덱스 < staff)은 유물 칸
    this.refillRow();

    this.ps = {};
    this.order.forEach((pid, i) => {
      const deck = [];
      for (const s of D.START) { deck.push(this.newCard(s.id)); deck.push(this.newCard(s.id)); }
      deck.push(this.newCard('fear'), this.newCard('fear'));
      this.ps[pid] = {
        res: { ...emptyRes(), ...D.START_RES[Math.min(i, D.START_RES.length - 1)] },
        deck: this.shuffle(deck), hand: [], play: [], discard: [], exiled: [],
        arch: D.ARCHAEOLOGISTS, idols: [], idolSlots: [], idolUsedRound: false,
        guardians: [], glass: 0, note: 0, assistants: [], assistRows: [], temple: [], templeVP: 0,
        passed: false,
      };
    });
    this.log(`게임 준비 완료. ${this.order.map((id) => this.pname(id)).join(' → ')} 순서로 진행합니다.`);
  }

  refillRow() {
    for (let i = 0; i < D.ROW_SIZE; i++) {
      if (this.row[i]) continue;
      const deck = i < this.staff ? this.artifactDeck : this.itemDeck;
      this.row[i] = deck.pop() || null;
    }
  }

  // ───────────── 진행 ─────────────
  async run() {
    this.setup();
    for (this.round = 1; this.round <= D.ROUNDS; this.round++) {
      await this.playRound();
      if (this.result) return;
      this.endRound();
    }
    this.finish();
  }

  async playRound() {
    this.log(`══════ ${this.round}라운드 시작 ══════`);
    for (const pid of this.order) { this.P(pid).passed = false; this.drawCards(pid, D.HAND_SIZE - this.P(pid).hand.length); }
    let idx = this.firstIdx;
    this.changed();
    while (this.order.some((pid) => !this.P(pid).passed)) {
      const pid = this.order[idx % this.order.length];
      idx++;
      if (this.P(pid).passed) continue;
      await this.takeTurn(pid);
      if (this.result) return;
    }
  }

  endRound() {
    this.current = null;
    // 수호자가 있는 유적에 남은 고고학자 → 두려움
    for (const s of Object.values(this.sites)) {
      if (s.guardian) for (const pid of s.occupants) this.gainFear(pid);
      s.occupants = [];
    }
    for (const pid of this.order) {
      const p = this.P(pid);
      p.arch = D.ARCHAEOLOGISTS;
      p.discard.push(...p.play);
      p.play = [];
      p.idolUsedRound = false;
      for (const a of p.assistants) a.used = false;
    }
    if (this.round < D.ROUNDS) {
      // 달 지팡이가 한 칸 오른쪽으로: 그 칸의 물건은 치우고 유물을 놓는다
      const i = this.staff;
      if (this.row[i]) this.log(`달 지팡이가 이동합니다. [${this.def(this.row[i]).name}]이(가) 치워집니다.`);
      this.row[i] = null;
      this.staff = Math.min(D.ROW_SIZE, this.staff + 1);
      // 가장 왼쪽 유물은 치우고 새로 채움 (카드 순환)
      if (this.row[0]) this.row[0] = null;
      this.refillRow();
      this.firstIdx = (this.firstIdx + 1) % this.order.length;
    }
    this.log(`── ${this.round}라운드 종료 ──`);
    this.changed();
  }

  // ───────────── 턴 ─────────────
  turnOptions(pid, mainDone) {
    const p = this.P(pid);
    const o = [];
    const add = (value, label, group, ok, reason, extra = {}) => o.push({ value, label, group, disabled: !ok, reason: ok ? undefined : reason, ...extra });
    if (!mainDone) {
      add('dig', '⛏ 발굴하기', 'main', p.arch > 0 && this.digTargets(pid, {}).length > 0, p.arch ? '이동 비용을 낼 수 있는 빈 유적이 없어요' : '남은 고고학자가 없어요');
      add('discover', '🧭 새 유적 탐사', 'main', p.arch > 0 && this.discoverTargets(pid).length > 0, p.arch ? '나침반이나 이동 비용이 모자라요' : '남은 고고학자가 없어요');
      add('overcome', '⚔ 수호자 제압', 'main', this.overcomeTargets(pid, 0).length > 0, '내 고고학자가 있는 곳의 수호자를 제압할 자원이 없어요');
      add('buy', '🛒 카드 구매', 'main', this.buyTargets(pid, {}).length > 0, '살 수 있는 카드가 없어요');
      add('research', '🔍 연구', 'main', this.researchTokens(pid, {}).length > 0, '연구 비용이 모자라요');
      if (p.glass >= 7) add('temple', '🏛 신전 타일 구매', 'main', this.templeTargets(pid).length > 0, '신전 타일 비용이 모자라요');
      for (const uid of p.hand) {
        const d = this.def(uid);
        if (!d.effect || d.free) continue;
        add('play:' + uid, `🃏 ${d.name}`, 'card', !d.can || d.can(this, pid), '지금은 이 카드의 효과를 쓸 수 없어요', { card: uid });
      }
    }
    for (const uid of p.hand) {
      const d = this.def(uid);
      if (d.effect && d.free) add('play:' + uid, `⚡ ${d.name}`, 'free', !d.can || d.can(this, pid), '지금은 쓸 수 없어요', { card: uid });
    }
    if (p.idols.length && !p.idolUsedRound && p.idolSlots.length < 4) add('idol', '🗿 우상 놓기', 'free', true, '');
    for (const a of p.assistants) if (!a.used) { const ad = D.ASSISTANTS.find((x) => x.id === a.id); add('assist:' + a.id, `👤 ${ad.name}`, 'free', true, ''); }
    p.guardians.forEach((g, i) => {
      if (g.used) return;
      const gd = D.GUARDIANS.find((x) => x.id === g.id);
      const ok = gd.boon.kind !== 'research' || this.researchTokens(pid, { free: true }).length > 0;
      add('boon:' + i, `🛡 ${gd.name} 혜택`, 'free', ok, '연구할 수 있는 말이 없어요');
    });
    if (mainDone) add('end', '턴 끝내기 ▶', 'end', true, '');
    else add('pass', '이번 라운드 패스', 'end', true, '');
    return o;
  }

  async takeTurn(pid) {
    this.current = pid;
    this.events = [];
    const p = this.P(pid);
    let mainDone = false;
    this.log(`▶ ${this.pname(pid)}의 차례`, pid);
    for (let guard = 0; guard < 60; guard++) {
      const options = this.turnOptions(pid, mainDone);
      if (mainDone && options.length === 1) break; // 할 수 있는 자유 행동이 없으면 자동으로 턴 종료
      const v = await this.ask(pid, { type: 'option', kind: 'turn', title: mainDone ? '자유 행동(⚡)을 더 하거나 턴을 끝내세요' : `${this.round}라운드 — 행동을 하나 고르세요`, options, main: !mainDone });
      if (this.result) return;
      if (v === 'end') break;
      if (v === 'pass') { p.passed = true; this.log(`${this.pname(pid)}: 이번 라운드를 마쳤습니다 (패스)`, pid); break; }
      const [kind, arg] = v.split(':');
      let done = false;
      if (kind === 'dig') done = await this.doDig(pid, { cancel: true });
      else if (kind === 'discover') done = await this.doDiscover(pid);
      else if (kind === 'overcome') done = await this.doOvercome(pid, { cancel: true });
      else if (kind === 'buy') done = await this.doBuy(pid, { cancel: true });
      else if (kind === 'research') done = await this.doResearch(pid, { cancel: true });
      else if (kind === 'temple') done = await this.doTemple(pid);
      else if (kind === 'play') { const free = this.def(arg).free; await this.playCard(pid, arg); done = !free; }
      else if (kind === 'idol') await this.placeIdol(pid);
      else if (kind === 'assist') await this.useAssistant(pid, arg);
      else if (kind === 'boon') await this.useBoon(pid, Number(arg));
      if (done) mainDone = true;
      this.changed();
    }
    this.current = null;
  }

  // ───────────── 행동: 발굴 ─────────────
  digTargets(pid, opts) {
    const maxLevel = opts.maxLevel ?? 2;
    return Object.values(this.sites).filter((s) => s.discovered && s.level <= maxLevel && !s.occupants.length
      && (opts.free || this.canTravel(pid, s.travel)));
  }

  async doDig(pid, opts = {}) {
    const p = this.P(pid);
    if (p.arch <= 0) { this.log(`${this.pname(pid)}: 남은 고고학자가 없어 발굴할 수 없습니다`, pid); return false; }
    const targets = this.digTargets(pid, opts);
    if (!targets.length) { this.log(`${this.pname(pid)}: 발굴할 수 있는 유적이 없습니다`, pid); return false; }
    const options = targets.map((s) => ({ value: s.id, label: `${s.name} (${opts.free ? '이동 무료' : travelText(s.travel)} → ${rewardText(s.reward)})`, site: s.id }));
    if (opts.cancel) options.push({ value: 'cancel', label: '취소' });
    const v = await this.ask(pid, { type: 'option', kind: 'site', title: '발굴할 유적을 고르세요 (지도에서 빛나는 곳)', options });
    if (v === 'cancel') return false;
    const s = this.sites[v];
    if (!opts.free && !(await this.payTravel(pid, s.travel, !!opts.cancel))) return false;
    p.arch--;
    s.occupants.push(pid);
    this.events.push({ kind: 'dig', site: s.id, pid });
    this.log(`${this.pname(pid)}: [${s.name}]에서 발굴`, pid);
    this.gain(pid, s.reward);
    return true;
  }

  // ───────────── 행동: 탐사 ─────────────
  discoverTargets(pid) {
    const p = this.P(pid);
    return Object.values(this.sites).filter((s) => !s.discovered && this.tileDeck[s.level].length && p.res.compass >= s.compass && this.canTravel(pid, s.travel));
  }

  async doDiscover(pid) {
    const p = this.P(pid);
    const targets = this.discoverTargets(pid);
    if (!targets.length || p.arch <= 0) return false;
    const options = targets.map((s) => ({ value: s.id, label: `${s.level}단계 유적 (나침반 ${s.compass} + ${travelText(s.travel)})`, site: s.id }));
    options.push({ value: 'cancel', label: '취소' });
    const v = await this.ask(pid, { type: 'option', kind: 'site', title: '탐사할 곳을 고르세요. 새 유적과 우상을 얻지만 수호자가 나타나요!', options });
    if (v === 'cancel') return false;
    const s = this.sites[v];
    if (!(await this.payTravel(pid, s.travel, true))) return false;
    p.res.compass -= s.compass;
    const tile = this.tileDeck[s.level].pop();
    Object.assign(s, { discovered: true, name: tile.name, reward: tile.reward, tile: tile.id });
    p.arch--;
    s.occupants.push(pid);
    this.events.push({ kind: 'discover', site: s.id, pid });
    this.log(`${this.pname(pid)}: 새 유적 [${tile.name}] 발견! (나침반 ${s.compass})`, pid);
    // 우상
    if (s.idol) {
      p.idols.push(s.idol.id);
      this.log(`${this.pname(pid)}: 우상을 얻었습니다 (게임 끝 ${D.IDOL_VP}점)`, pid);
      this.gain(pid, s.idol.reward);
      s.idol = null;
    }
    this.gain(pid, s.reward);
    // 수호자 등장
    const g = this.guardianDeck.pop();
    if (g) {
      s.guardian = g;
      this.log(`[${tile.name}]에 수호자 「${g.name}」이(가) 나타났습니다! 라운드가 끝날 때까지 제압하지 못하면 여기 있는 고고학자는 두려움을 받아요.`, pid);
    }
    return true;
  }

  // ───────────── 행동: 수호자 제압 ─────────────
  overcomeTargets(pid, discountN) {
    return Object.values(this.sites).filter((s) => s.guardian && s.occupants.includes(pid)
      && this.canAfford(pid, s.guardian.cost, discountN ? this.flexDiscount(pid, s.guardian.cost, discountN) : null));
  }

  async doOvercome(pid, opts = {}) {
    const n = opts.discount || 0;
    const targets = this.overcomeTargets(pid, n);
    if (!targets.length) { if (!opts.cancel) this.log(`${this.pname(pid)}: 제압할 수 있는 수호자가 없습니다`, pid); return false; }
    const options = targets.map((s) => ({ value: s.id, label: `${s.guardian.name} (${resText(s.guardian.cost)}${n ? `, ${n}개 면제` : ''})`, site: s.id }));
    if (opts.cancel) options.push({ value: 'cancel', label: '취소' });
    const v = await this.ask(pid, { type: 'option', kind: 'site', title: '제압할 수호자를 고르세요', options });
    if (v === 'cancel') return false;
    const s = this.sites[v];
    const disc = n ? this.flexDiscount(pid, s.guardian.cost, n) : null;
    this.pay(pid, s.guardian.cost, disc);
    this.P(pid).guardians.push({ id: s.guardian.id, used: false });
    this.events.push({ kind: 'overcome', site: s.id, pid });
    this.log(`${this.pname(pid)}: 수호자 「${s.guardian.name}」 제압! (+${D.GUARDIAN_VP}점, 혜택 1번 사용 가능)`, pid);
    s.guardian = null;
    return true;
  }

  // ───────────── 행동: 카드 구매 ─────────────
  cardCost(uid, discount = 0) {
    const d = this.def(uid);
    return Math.max(0, d.cost - discount);
  }

  buyTargets(pid, opts) {
    const p = this.P(pid);
    const kinds = opts.kinds || ['item', 'artifact'];
    return this.row.map((uid, i) => ({ uid, i })).filter(({ uid }) => {
      if (!uid) return false;
      const d = this.def(uid);
      if (!kinds.includes(d.kind)) return false;
      const c = this.cardCost(uid, opts.discount || 0);
      return d.kind === 'item' ? p.res.coin >= c : p.res.compass >= c;
    });
  }

  async doBuy(pid, opts = {}) {
    const p = this.P(pid);
    const targets = this.buyTargets(pid, opts);
    if (!targets.length) { if (!opts.cancel) this.log(`${this.pname(pid)}: 살 수 있는 카드가 없습니다`, pid); return false; }
    const options = targets.map(({ uid, i }) => {
      const d = this.def(uid);
      return { value: String(i), label: `${d.name} (${d.kind === 'item' ? '동전' : '나침반'} ${this.cardCost(uid, opts.discount || 0)})`, slot: i, card: uid };
    });
    if (opts.cancel) options.push({ value: 'cancel', label: '취소' });
    const v = await this.ask(pid, { type: 'option', kind: 'row', title: '살 카드를 고르세요 (물건 = 동전, 유물 = 나침반)', options });
    if (v === 'cancel') return false;
    const i = Number(v);
    const uid = this.row[i];
    const d = this.def(uid);
    const c = this.cardCost(uid, opts.discount || 0);
    if (d.kind === 'item') p.res.coin -= c; else p.res.compass -= c;
    this.row[i] = null;
    this.refillRow();
    this.events.push({ kind: 'buy', pid, card: uid });
    if (d.kind === 'item') {
      p.deck.unshift(uid); // 덱 맨 아래
      this.log(`${this.pname(pid)}: 물건 [${d.name}] 구매 (동전 ${c}) → 덱 맨 아래로`, pid);
    } else {
      this.log(`${this.pname(pid)}: 유물 [${d.name}] 구매 (나침반 ${c})`, pid);
      p.play.push(uid);
      const use = await this.choose(pid, `유물 [${d.name}]을(를) 지금 공짜로 한 번 쓸까요? — ${d.text}`, [{ value: 'yes', label: '지금 사용' }, { value: 'no', label: '쓰지 않기' }], { always: true, card: uid });
      if (use === 'yes') { this.log(`${this.pname(pid)}: [${d.name}] 효과 사용`, pid); await d.effect(this, pid); }
    }
    this.changed();
    return true;
  }

  async playCard(pid, uid) {
    const p = this.P(pid);
    const d = this.def(uid);
    p.hand = p.hand.filter((x) => x !== uid);
    p.play.push(uid);
    this.log(`${this.pname(pid)}: [${d.name}] 사용 — ${d.text}`, pid);
    this.events.push({ kind: 'play', pid, card: uid });
    this.changed();
    await d.effect(this, pid);
  }

  // ───────────── 행동: 연구 ─────────────
  researchCost(row, opts) {
    if (opts.free) return {};
    const cost = { ...D.RESEARCH[row].cost };
    for (const [k, n] of Object.entries(opts.discount || {})) if (cost[k]) cost[k] = Math.max(0, cost[k] - n);
    return cost;
  }

  researchTokens(pid, opts) {
    const p = this.P(pid);
    const out = [];
    if (p.glass < 7 && this.canAfford(pid, this.researchCost(p.glass + 1, opts))) out.push('glass');
    if (p.note < p.glass && this.canAfford(pid, this.researchCost(p.note + 1, opts))) out.push('note');
    return out;
  }

  async doResearch(pid, opts = {}) {
    const p = this.P(pid);
    const tokens = this.researchTokens(pid, opts);
    if (!tokens.length) { if (!opts.cancel) this.log(`${this.pname(pid)}: 연구할 수 없습니다 (비용 부족)`, pid); return false; }
    const label = (t) => {
      const row = (t === 'glass' ? p.glass : p.note) + 1;
      const cost = this.researchCost(row, opts);
      return `${t === 'glass' ? '🔍 돋보기' : '📓 수첩'} → ${row === 7 ? '신전' : `${row}줄`} (${resText(cost) || '무료'})`;
    };
    const options = tokens.map((t) => ({ value: t, label: label(t), research: t }));
    if (opts.cancel) options.push({ value: 'cancel', label: '취소' });
    const v = await this.choose(pid, '연구 트랙에서 올릴 말을 고르세요 (수첩은 돋보기보다 높이 갈 수 없어요)', options, { kind: 'research', always: !!opts.cancel });
    if (v === 'cancel') return false;
    const row = (v === 'glass' ? p.glass : p.note) + 1;
    this.pay(pid, this.researchCost(row, opts));
    if (v === 'glass') p.glass = row; else p.note = row;
    this.events.push({ kind: 'research', pid, token: v, row });
    this.log(`${this.pname(pid)}: ${v === 'glass' ? '돋보기' : '수첩'}를 ${row === 7 ? '신전' : `${row}줄`}로 올렸습니다`, pid);
    await this.researchReward(pid, v, row);
    return true;
  }

  async researchReward(pid, token, row) {
    const p = this.P(pid);
    const r = D.RESEARCH[row].reward;
    if (!r) return;
    if (r.kind === 'gain') this.gain(pid, r.res);
    else if (r.kind === 'assistant') {
      if (p.assistRows.includes(row) || !this.assistantOffer.length) { this.gain(pid, { coin: 1, compass: 1 }); return; }
      p.assistRows.push(row);
      const v = await this.choose(pid, '함께할 조수를 고르세요 (라운드마다 1번 쓰는 능력)', this.assistantOffer.map((id) => {
        const a = D.ASSISTANTS.find((x) => x.id === id);
        return { value: id, label: `${a.name}: ${rewardText(a.base)}`, assistant: id };
      }), { always: true });
      this.assistantOffer = this.assistantOffer.filter((x) => x !== v);
      if (this.assistantPool.length) this.assistantOffer.push(this.assistantPool.pop());
      p.assistants.push({ id: v, up: false, used: false });
      this.log(`${this.pname(pid)}: 조수 ${D.ASSISTANTS.find((x) => x.id === v).name}이(가) 합류했습니다`, pid);
    } else if (r.kind === 'upgrade') {
      const cand = p.assistants.filter((a) => !a.up);
      if (!cand.length) { this.gain(pid, { compass: 2 }); return; }
      const v = await this.choose(pid, '업그레이드할 조수를 고르세요', cand.map((a) => {
        const ad = D.ASSISTANTS.find((x) => x.id === a.id);
        return { value: a.id, label: `${ad.name}: ${rewardText(ad.base)} → ${rewardText(ad.up)}` };
      }), { always: true });
      const a = p.assistants.find((x) => x.id === v);
      a.up = true;
      a.used = false;
      this.log(`${this.pname(pid)}: 조수 ${D.ASSISTANTS.find((x) => x.id === v).name} 업그레이드 (이번 라운드 다시 사용 가능)`, pid);
    } else if (r.kind === 'temple' && token === 'glass') {
      const vp = D.TEMPLE_ARRIVAL_VP[this.templeArrivals] || 0;
      this.templeArrivals++;
      p.templeVP += vp;
      this.log(`${this.pname(pid)}: 신전에 ${this.templeArrivals}번째로 도착! +${vp}점. 이제 신전 타일을 살 수 있어요.`, pid);
    }
  }

  templeTargets(pid) {
    return D.TEMPLE_TILES.filter((t) => this.templeSupply[t.id] > 0 && this.canAfford(pid, t.cost));
  }

  async doTemple(pid) {
    const targets = this.templeTargets(pid);
    if (!targets.length) return false;
    const options = targets.map((t) => ({ value: t.id, label: `${t.vp}점 타일 (${resText(t.cost)})` }));
    options.push({ value: 'cancel', label: '취소' });
    const v = await this.choose(pid, '살 신전 타일을 고르세요', options, { always: true });
    if (v === 'cancel') return false;
    const t = D.TEMPLE_TILES.find((x) => x.id === v);
    this.pay(pid, t.cost);
    this.templeSupply[t.id]--;
    this.P(pid).temple.push(t.id);
    this.log(`${this.pname(pid)}: 신전 타일 구매 (+${t.vp}점)`, pid);
    return true;
  }

  // ───────────── 자유 행동 ─────────────
  async placeIdol(pid) {
    const p = this.P(pid);
    if (!p.idols.length || p.idolUsedRound || p.idolSlots.length >= 4) return;
    const options = D.IDOL_SLOT_CHOICES.map((r, i) => ({ value: String(i), label: rewardText(r) }));
    options.push({ value: 'cancel', label: '취소' });
    const v = await this.choose(pid, `우상을 판에 놓고 효과를 고르세요 (그 우상은 ${D.IDOL_VP}점 → ${D.IDOL_PLACED_VP}점이 돼요, 라운드마다 1번)`, options, { always: true });
    if (v === 'cancel') return;
    p.idolSlots.push(p.idols.pop());
    p.idolUsedRound = true;
    this.log(`${this.pname(pid)}: 우상을 놓았습니다`, pid);
    this.gain(pid, D.IDOL_SLOT_CHOICES[Number(v)]);
  }

  async useAssistant(pid, id) {
    const a = this.P(pid).assistants.find((x) => x.id === id && !x.used);
    if (!a) return;
    const ad = D.ASSISTANTS.find((x) => x.id === id);
    const r = a.up ? ad.up : ad.base;
    a.used = true;
    this.log(`${this.pname(pid)}: 조수 ${ad.name}의 도움`, pid);
    if (r.exile) await this.exileCard(pid);
    this.gain(pid, r);
  }

  async useBoon(pid, i) {
    const g = this.P(pid).guardians[i];
    if (!g || g.used) return;
    const gd = D.GUARDIANS.find((x) => x.id === g.id);
    g.used = true;
    this.log(`${this.pname(pid)}: 「${gd.name}」의 혜택 사용`, pid);
    const b = gd.boon;
    if (b.kind === 'gain') this.gain(pid, b.res);
    else if (b.kind === 'draw') this.drawCards(pid, b.n);
    else if (b.kind === 'exile') await this.exileCard(pid);
    else if (b.kind === 'research') { if (!(await this.doResearch(pid, { free: true }))) g.used = false; }
  }

  // ───────────── 점수 ─────────────
  score(pid) {
    const p = this.P(pid);
    const owned = [...p.deck, ...p.hand, ...p.play, ...p.discard];
    const cardVP = owned.reduce((s, u) => s + Math.max(0, this.def(u).vp), 0);
    const fear = owned.filter((u) => this.cards[u] === 'fear').length;
    const research = D.GLASS_VP[p.glass] + D.NOTE_VP[p.note];
    const temple = p.temple.reduce((s, id) => s + D.TEMPLE_TILES.find((t) => t.id === id).vp, 0) + p.templeVP;
    const idols = p.idols.length * D.IDOL_VP + p.idolSlots.length * D.IDOL_PLACED_VP;
    const guardians = p.guardians.length * D.GUARDIAN_VP;
    const total = research + temple + idols + guardians + cardVP - fear;
    return { research, temple, idols, guardians, cards: cardVP, fear: -fear, total };
  }

  finish() {
    const scores = this.order.map((pid) => ({ pid, name: this.pname(pid), ...this.score(pid), res: this.P(pid).res }));
    scores.sort((a, b) => b.total - a.total || (b.res.coin + b.res.compass) - (a.res.coin + a.res.compass));
    this.result = { scores, winner: scores[0].pid };
    this.log(`🏆 게임 종료! 우승: ${scores[0].name} (${scores[0].total}점)`);
    this.current = null;
    this.changed();
  }

  // ───────────── 화면용 상태 ─────────────
  view(forPid) {
    const card = (uid) => (uid ? { uid, id: this.cards[uid] } : null);
    return {
      round: this.round, rounds: D.ROUNDS, current: this.current, order: this.order, first: this.order[this.firstIdx],
      players: this.players,
      sites: Object.values(this.sites || {}).map((s) => ({
        id: s.id, level: s.level, name: s.name, travel: s.travel, compass: s.compass, reward: s.reward, discovered: s.discovered,
        occupants: s.occupants, guardian: s.guardian ? { id: s.guardian.id, name: s.guardian.name, cost: s.guardian.cost, boon: s.guardian.boon } : null,
        idol: !!s.idol,
      })),
      row: (this.row || []).map(card), staff: this.staff,
      decks: { item: (this.itemDeck || []).length, artifact: (this.artifactDeck || []).length, guardian: (this.guardianDeck || []).length },
      assistantOffer: this.assistantOffer || [], templeSupply: this.templeSupply || {},
      ps: Object.fromEntries(this.order.map((pid) => {
        const p = this.P(pid);
        if (!p) return [pid, null];
        return [pid, {
          res: p.res, arch: p.arch, passed: p.passed, glass: p.glass, note: p.note,
          idols: p.idols.length, idolSlots: p.idolSlots.length, idolUsedRound: p.idolUsedRound,
          guardians: p.guardians, assistants: p.assistants, temple: p.temple, templeVP: p.templeVP,
          hand: pid === forPid ? p.hand.map(card) : null, handCount: p.hand.length,
          play: p.play.map(card), deckCount: p.deck.length, discardCount: p.discard.length,
          deckList: pid === forPid ? [...p.deck, ...p.discard].map(card) : null,
          score: this.score(pid),
        }];
      })),
      log: this.logs.slice(-80),
      result: this.result,
    };
  }
}

// ───────────── AI ─────────────
/** 봇의 선택. game.currentPrompt(pid)를 보고 값을 돌려준다 */
function botAnswer(g, pid, prompt) {
  const p = g.P(pid);
  if (prompt.type === 'cards') {
    if (prompt.kind === 'travel') return prompt.suggest || [];
    if (prompt.kind === 'exile') return prompt.suggest || [];
    return prompt.cards.slice(0, prompt.min || 0);
  }
  const opts = prompt.options.filter((o) => !o.disabled && o.value !== 'cancel');
  if (!opts.length) return prompt.options.find((o) => !o.disabled).value;
  const has = (v) => opts.find((o) => o.value === v);
  if (prompt.kind === 'turn') {
    // 자유 행동 먼저
    const free = opts.find((o) => o.group === 'free' && o.value !== 'idol');
    if (free) return free.value;
    if (has('idol') && g.round >= 4) return 'idol';
    if (has('overcome')) return 'overcome';
    if (has('temple')) return 'temple';
    if (has('research') && (p.res.gem || p.res.arrow || p.res.tablet >= 2 || g.rand() < 0.5)) return 'research';
    if (has('discover') && g.rand() < 0.8) return 'discover';
    const play = opts.filter((o) => o.group === 'card');
    if (play.length && g.rand() < 0.6) return play[Math.floor(g.rand() * play.length)].value;
    if (has('buy') && g.rand() < 0.7) return 'buy';
    if (has('dig')) return 'dig';
    if (play.length) return play[0].value;
    if (has('buy')) return 'buy';
    if (has('research')) return 'research';
    return has('end') ? 'end' : 'pass';
  }
  if (prompt.kind === 'site') {
    // 보상 가치가 높은 곳
    const score = (o) => { const s = g.sites[o.value]; if (!s) return 0; const r = s.reward || {}; return Object.entries(r).reduce((a, [k, n]) => a + (VALUE[k] || 1.5) * n, 0) + (s.level || 0) * 2; };
    return opts.slice().sort((a, b) => score(b) - score(a))[0].value;
  }
  if (prompt.kind === 'row') {
    return opts.slice().sort((a, b) => (g.def(b.card).vp + g.def(b.card).cost) - (g.def(a.card).vp + g.def(a.card).cost))[0].value;
  }
  if (has('yes')) return 'yes';
  if (has('glass')) return 'glass';
  return opts[0].value;
}

module.exports = { Game, botAnswer, travelText, rewardText };
