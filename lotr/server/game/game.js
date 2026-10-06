'use strict';
// 반지의 제왕: 원정대의 운명 — 게임 엔진 (협력: 목표를 이루고 운명의 산에서 반지를 파괴)
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

const L = (id) => D.LOC_MAP[id];
const HIDERS = ['aragorn', 'galadriel', 'faramir'];
const NAZ_FIGHTERS = ['gandalf', 'eowyn'];

class Game extends EventEmitter {
  /**
   * @param {{id:string,name:string,bot?:boolean,chars:string[]}[]} players 차례 순서대로 (chars[0] = 주 인물, chars[1] = 보조 인물)
   * @param {{seed?:number, settings?:{difficulty?:string}}} opts
   */
  constructor(players, opts = {}) {
    super();
    this.seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.rand = mulberry32(this.seed);
    this.botRand = mulberry32((this.seed ^ 0x5bd1e995) >>> 0);
    this.settings = { difficulty: 'normal', ...(opts.settings || {}) };
    this.diff = D.DIFFICULTIES.find((d) => d.id === this.settings.difficulty) || D.DIFFICULTIES[1];
    this.players = players.map((p) => ({ id: p.id, name: p.name, bot: !!p.bot, chars: (p.chars || []).slice(0, 2) }));
    this.order = this.players.map((p) => p.id);
    this.prompts = {};
    this.promptSeq = 1;
    this.logs = [];
    this.logSeq = 1;
    this.round = 0;
    this.phase = 'setup';
    this.result = null;
    this.current = null;
    this.seq = 1;
    this.events = [];
    this.evSeq = 0;
  }

  // ───────────── 도구 ─────────────
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  newId(prefix) { return prefix + this.seq++; }
  P(pid) { return this.ps[pid]; }
  pl(pid) { return this.players.find((x) => x.id === pid); }
  pname(pid) { const p = this.pl(pid); return p ? p.name : pid; }
  log(text, pid = null, kind = '') { this.logs.push({ seq: this.logSeq++, text, pid, kind, round: this.round }); if (this.logs.length > 300) this.logs.shift(); }
  ev(kind, data = {}) { this.events.push({ id: ++this.evSeq, kind, ...data }); if (this.events.length > 40) this.events = this.events.slice(-20); }
  changed() { this.emit('update'); }
  pawn(id) { return this.pawns.find((p) => p.id === id); }
  cname(id) { return D.CHAR_MAP[id].short; }
  owner(charId) { const p = this.players.find((x) => x.chars.includes(charId)); return p ? p.id : null; }
  hasChar(id) { return this.pawns.some((p) => p.id === id); }
  frodo() { return this.pawn('frodo'); }
  objNeed() { return this.diff.objNeed; }
  objDone() { return this.objectives.filter((o) => o.done).length; }

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
    const o = e.prompt.options.find((x) => x.value === value);
    if (!o) return '잘못된 선택입니다.';
    if (o.disabled) return o.reason || '지금은 할 수 없습니다.';
    delete this.prompts[pid];
    this.changed();
    e.resolve(value);
    return null;
  }
  /** 고를 것이 하나뿐이면 자동, 없으면 null */
  async choose(pid, title, options, extra = {}) {
    const ok = options.filter((o) => !o.disabled);
    if (!ok.length) return null;
    if (ok.length === 1 && !extra.always) return ok[0].value;
    return this.ask(pid, { type: 'option', title, options, ...extra });
  }

  endGame(win, reason) {
    if (this.result) throw new GameOver();
    this.result = { win, reason, round: this.round, objectives: this.objDone ? this.objDone() : 0, hope: this.hope };
    this.phase = 'end';
    this.current = null;
    this.log(win ? `🎉 승리! ${reason}` : `💀 패배... ${reason}`, null, win ? 'win' : 'lose');
    this.prompts = {};
    this.changed();
    throw new GameOver();
  }

  // ───────────── 준비 ─────────────
  setup() {
    this.locs = {};
    for (const l of D.LOCATIONS) this.locs[l.id] = { id: l.id, orcs: 0, armies: 0, captured: false };
    // 인물: 고르지 않은 자리는 남은 인물에서 무작위
    const taken = new Set(this.players.flatMap((p) => p.chars));
    const free = this.shuffle(D.PLAYABLE.map((c) => c.id).filter((id) => !taken.has(id)));
    for (const p of this.players) {
      p.chars = p.chars.filter((id) => D.CHAR_MAP[id] && !D.CHAR_MAP[id].ringbearer);
      while (p.chars.length < 2 && free.length) p.chars.push(free.shift());
    }
    this.pawns = [{ id: 'frodo', loc: D.CHAR_MAP.frodo.start }];
    for (const p of this.players) for (const c of p.chars) this.pawns.push({ id: c, loc: D.CHAR_MAP[c].start });
    this.hidden = true;
    this.nazgul = D.NAZGUL_START.map((loc, i) => ({ nid: 'n' + (i + 1), loc }));
    this.hope = this.diff.hope;
    this.maxHope = this.diff.hope + 2;
    this.threatIdx = this.diff.threat;
    this.stats = { orcsSlain: 0, nazgulRepelled: 0, overflows: 0 };
    this.skipShadow = false;
    // 어둠 덱: 안식처를 뺀 장소 + 특수 카드
    this.shadowDeck = this.shuffle([
      ...D.LOCATIONS.filter((l) => l.type !== 'haven').map((l) => ({ kind: 'loc', loc: l.id })),
      ...D.SHADOW_SPECIAL.map((c) => ({ kind: c.kind })),
    ]);
    this.shadowDiscard = [];
    // 시작 오크: 요새 2마리, 모르도르 1마리, 어둠 카드 3장씩 3/2/1마리
    for (const l of D.LOCATIONS) {
      if (l.type === 'stronghold') this.locs[l.id].orcs = 2;
      else if (l.region === 'mordor') this.locs[l.id].orcs = 1;
    }
    for (const n of [3, 3, 3, 2, 2, 2, 1, 1, 1]) {
      const c = this.drawShadowLoc();
      if (!c) break;
      const loc = this.locs[c.loc];
      // 시작부터 프로도 곁을 막지 않도록 호빗골은 비워 둠
      if (c.loc !== 'hobbiton') loc.orcs = Math.max(loc.orcs, Math.min(D.MAX_ORCS, n));
      this.shadowDiscard.push(c);
    }
    // 시작 군대: 미나스 티리스·에도라스·너른골·깊은골
    for (const id of ['minastirith', 'edoras', 'dale', 'rivendell']) this.locs[id].armies = 1;
    // 원정대 덱: 장소 카드 + 이벤트, 나눠 준 뒤 어둠의 파도를 고르게 섞음
    const deck = this.shuffle([
      ...D.LOCATIONS.map((l) => ({ uid: this.newId('c'), kind: 'loc', loc: l.id })),
      ...D.EVENTS.map((e) => ({ uid: this.newId('c'), kind: 'event', event: e.id })),
    ]);
    this.ps = {};
    const nDeal = { 1: 5, 2: 4, 3: 3 }[this.players.length] || 2;
    for (const p of this.players) this.ps[p.id] = { hand: deck.splice(0, nDeal), freeMuster: false, elrondUsed: false };
    const piles = Array.from({ length: this.diff.surges }, () => []);
    deck.forEach((c, i) => piles[i % piles.length].push(c));
    this.playerDeck = [];
    for (const pile of piles) { pile.push({ uid: this.newId('c'), kind: 'surge' }); this.shuffle(pile); this.playerDeck.push(...pile); }
    this.playerDiscard = [];
    // 목표: 24장 중 5장 공개 (시작부터 이뤄진 것은 빼고)
    this.objectives = this.shuffle(D.OBJECTIVES.map((o) => o.id)).filter((id) => !D.OBJ_MAP[id].check(this)).slice(0, D.FACEUP_OBJECTIVES).map((id) => ({ id, done: false }));
    this.log(`가운데땅의 운명이 원정대에게 달렸습니다. 난이도 ${this.diff.name} — 목표 ${this.objNeed()}개를 이루고 운명의 산에서 반지를 파괴하세요!`);
    this.log(`프로도와 샘은 호빗골에서 출발합니다. 희망이 0이 되거나 원정대 덱이 떨어지면 패배.`);
  }

  drawShadowLoc() {
    const i = this.shadowDeck.findIndex((c) => c.kind === 'loc');
    return i < 0 ? null : this.shadowDeck.splice(i, 1)[0];
  }

  cardName(c) {
    if (c.kind === 'loc') return L(c.loc).name;
    if (c.kind === 'event') return D.EVENT_MAP[c.event].name;
    return '어둠의 파도';
  }
  cardRegion(c) { return c.kind === 'loc' ? L(c.loc).region : null; }

  loseHope(n, why) {
    this.hope = Math.max(0, this.hope - n);
    this.log(`💔 희망 -${n} (${why}) → ${this.hope}`, null, 'bad');
    this.ev('hope', { n: -n });
    if (this.hope <= 0) this.endGame(false, '희망이 꺼졌습니다. 어둠이 가운데땅을 덮었습니다.');
  }
  gainHope(n, why) {
    const before = this.hope;
    this.hope = Math.min(this.maxHope, this.hope + n);
    if (this.hope > before) { this.log(`✨ 희망 +${this.hope - before} (${why}) → ${this.hope}`, null, 'good'); this.ev('hope', { n: this.hope - before }); }
  }

  // ───────────── 오크·군대 ─────────────
  /** 오크 추가: 군대가 막고, 보로미르가 막고, 3마리가 넘치면 돌파 (희망 -1, 옆으로 번짐) */
  addOrcs(locId, n, why = '', chain = null) {
    const loc = this.locs[locId];
    const def = L(locId);
    if (def.type === 'haven') return;
    if (loc.captured) { this.log(`${def.name}은(는) 원정대가 점령해 오크가 모이지 않아요.`); return; }
    if (this.pawns.some((p) => p.id === 'boromir' && p.loc === locId)) { this.log(`📯 보로미르가 ${def.name}을(를) 지켜 오크가 오지 못했어요.`); return; }
    for (let i = 0; i < n; i++) {
      if (loc.armies > 0) { loc.armies--; this.log(`⚔ ${def.name}의 군대가 오크를 막다가 1부대가 쓰러졌어요.`); continue; }
      if (loc.orcs < D.MAX_ORCS) { loc.orcs++; continue; }
      // 모르도르는 원래 오크 땅 — 넘쳐도 더 늘지 않음
      if (def.region === 'mordor') return;
      // 돌파: 희망 -1 (연쇄는 한 번만), 옆 지역으로 번짐
      const root = !chain;
      chain = chain || new Set();
      if (chain.has(locId)) return;
      chain.add(locId);
      this.stats.overflows++;
      this.ev('overflow', { loc: locId });
      this.log(`🔥 ${def.name}에서 오크가 넘쳐 흘러요!`, null, 'bad');
      if (root) this.loseHope(1, `${def.name} 돌파`);
      for (const a of def.adj) if (!chain.has(a)) this.addOrcs(a, 1, '돌파', chain);
      return;
    }
    if (why) this.log(`👹 ${def.name}에 오크 +${n} (${why}) → ${loc.orcs}`);
  }

  removeOrcs(locId, n, by) {
    const loc = this.locs[locId];
    const k = Math.min(loc.orcs, n);
    loc.orcs -= k;
    this.stats.orcsSlain += k;
    if (k) { this.log(`🗡 ${by}: ${L(locId).name}의 오크 ${k}마리를 물리쳤어요. (남은 오크 ${loc.orcs})`); this.ev('slay', { loc: locId, n: k }); }
    return k;
  }

  addArmies(locId, n, by) {
    const loc = this.locs[locId];
    const k = Math.min(n, D.MAX_ARMIES - loc.armies);
    loc.armies += k;
    if (k) this.log(`🛡 ${by}: ${L(locId).name}에 군대 +${k} (모두 ${loc.armies})`);
    return k;
  }

  // ───────────── 프로도·나즈굴 ─────────────
  reveal(why) {
    if (!this.hidden) return false;
    this.hidden = false;
    this.log(`👁 프로도가 발각되었어요! (${why})`, null, 'bad');
    this.ev('reveal');
    return true;
  }
  hide(why) {
    if (this.hidden) return;
    this.hidden = true;
    this.log(`🍃 프로도가 다시 숨었어요. (${why})`, null, 'good');
  }
  /** 수색 주사위: 숨어 있으면 1개, 발각되면 2개, 같은 곳의 나즈굴 1기마다 +1 (최대 3) */
  search(why, extra = 0) {
    const n = Math.min(3, (this.hidden ? 1 : 2) + extra);
    const faces = [];
    for (let i = 0; i < n; i++) faces.push(D.SEARCH_DIE[Math.floor(this.rand() * 6)]);
    this.log(`🎲 수색 (${why}): ${faces.map((f) => ({ skull: '💀', eye: '👁', blank: '·' }[f])).join(' ')}`);
    this.ev('search', { faces });
    for (const f of faces) {
      if (f === 'skull') this.loseHope(1, '절망');
      else if (f === 'eye') { if (!this.reveal('수색')) this.loseHope(1, '추격'); }
    }
  }
  nazgulAt(locId) { return this.nazgul.filter((n) => n.loc === locId); }
  dist(from, to, opts = {}) {
    if (from === to) return 0;
    const seen = new Set([from]);
    let frontier = [from];
    for (let d = 1; d < 40 && frontier.length; d++) {
      const next = [];
      for (const x of frontier) for (const a of L(x).adj) {
        if (seen.has(a)) continue;
        if (opts.noHaven && L(a).type === 'haven' && a !== to) continue;
        if (a === to) return d;
        seen.add(a); next.push(a);
      }
      frontier = next;
    }
    return 99;
  }
  /** from에서 to 쪽으로 한 걸음 (안식처는 나즈굴이 못 들어감) */
  stepToward(from, to, noHaven) {
    let best = null; let bd = this.dist(from, to, { noHaven });
    for (const a of L(from).adj) {
      if (noHaven && L(a).type === 'haven') continue;
      const d = this.dist(a, to, { noHaven });
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }
  nazgulHunt() {
    const f = this.frodo().loc;
    if (L(f).type === 'haven') { this.log('🌙 나즈굴이 안식처 근처를 맴돌 뿐 들어오지 못해요.'); }
    const steps = this.hidden ? 1 : 2;
    const hunters = this.nazgul.slice().sort((a, b) => this.dist(a.loc, f, { noHaven: true }) - this.dist(b.loc, f, { noHaven: true })).slice(0, 3);
    let found = 0;
    for (const n of hunters) {
      for (let s = 0; s < steps; s++) {
        const nx = n.loc === f ? null : this.stepToward(n.loc, f, true);
        if (!nx) break;
        n.loc = nx;
        if (nx === f) { found++; break; }
      }
    }
    this.log(`🐎 나즈굴 ${hunters.length}기가 반지를 쫓아 움직여요.`);
    if (found) this.search('나즈굴이 프로도를 찾아냄', this.nazgulAt(f).length - 1);
  }

  // ───────────── 목표 ─────────────
  checkObjectives() {
    for (const o of this.objectives) {
      if (o.done) continue;
      if (D.OBJ_MAP[o.id].check(this)) {
        o.done = true;
        this.log(`🏆 목표 달성: ${D.OBJ_MAP[o.id].name}! (${this.objDone()}/${this.objNeed()})`, null, 'win');
        this.ev('objective', { id: o.id });
        this.gainHope(1, '목표 달성');
      }
    }
  }

  // ───────────── 플레이어 차례 ─────────────
  pawnsOf(pid) { return this.pl(pid).chars.map((c) => this.pawn(c)).filter(Boolean); }
  handRingCount() { return this.players.reduce((s, p) => s + this.P(p.id).hand.filter((c) => c.kind === 'loc' && L(c.loc).ring).length, 0); }

  /** 이번 차례에 할 수 있는 행동 목록 */
  turnOptions(pid, st) {
    const p = this.P(pid);
    const pl = this.pl(pid);
    const opts = [];
    const primary = pl.chars[0];
    const fr = this.frodo();
    const canAct = (c) => (c === primary || c === 'frodo' ? st.main > 0 : (st.sub > 0 || st.main > 0));
    const actors = [...pl.chars.filter((c) => this.pawn(c)), 'frodo'];
    for (const c of actors) {
      if (!canAct(c)) continue;
      const pw = this.pawn(c);
      const here = pw.loc;
      const hd = L(here);
      const nm = this.cname(c);
      // 이동
      const reach = new Set(hd.adj);
      if (c === 'faramir') for (const a of hd.adj) if (L(a).region === 'gondor' && hd.region === 'gondor') for (const b of L(a).adj) if (L(b).region === 'gondor' && b !== here) reach.add(b);
      for (const to of reach) {
        if (c === 'frodo' && to === 'mountdoom' && false) continue;
        opts.push({ value: `mv:${c}:${to}`, label: `${nm} → ${L(to).name}`, group: 'move', char: c, loc: to });
      }
      // 카드 이동: 목적지 장소 카드를 버리고 그곳으로 (모르도르로는 못 감)
      for (const card of p.hand) {
        if (card.kind !== 'loc' || card.loc === here || L(card.loc).region === 'mordor' || reach.has(card.loc)) continue;
        if (c === 'frodo') continue;
        opts.push({ value: `fly:${c}:${card.uid}`, label: `${nm} → ${L(card.loc).name} (카드 사용)`, group: 'cardmove', char: c, loc: card.loc });
      }
      if (c === 'frodo') {
        // 은신 이동: 👣 카드를 버리고 2칸까지 숨어서
        const sc = p.hand.filter((x) => x.kind === 'loc' && L(x.loc).stealth);
        if (sc.length) opts.push({ value: 'sneak', label: '👣 은신 이동 (👣 카드 1장 → 2칸까지 숨어서)', group: 'frodo', char: c });
        // 숨기
        const hider = this.pawns.find((x) => x.loc === here && HIDERS.includes(x.id));
        if (!this.hidden && (hd.type === 'haven' || hider)) opts.push({ value: 'hide', label: `🍃 프로도 숨기기 (${hd.type === 'haven' ? '안식처' : this.cname(hider.id)})`, group: 'frodo', char: c });
        // 반지 파괴
        if (here === 'mountdoom') {
          const ok = this.objDone() >= this.objNeed() && this.handRingCount() >= this.diff.ring;
          opts.push({ value: 'destroy', label: `🌋 반지 파괴! (💍 ${this.diff.ring}장 · 목표 ${this.objNeed()}개)`, group: 'frodo', char: c, disabled: !ok,
            reason: this.objDone() < this.objNeed() ? `목표를 ${this.objNeed()}개 이뤄야 해요 (지금 ${this.objDone()}개).` : `원정대 손패에 💍 카드가 ${this.diff.ring}장 필요해요 (지금 ${this.handRingCount()}장).` });
        }
        continue;
      }
      // 공격
      const atkTargets = [here, ...(c === 'legolas' ? hd.adj : [])].filter((id) => this.locs[id].orcs > 0);
      for (const t of atkTargets) opts.push({ value: `atk:${c}:${t}`, label: `⚔ ${nm} 공격${t === here ? '' : ` → ${L(t).name}`} (오크 ${this.locs[t].orcs})`, group: 'attack', char: c, loc: t });
      // 나즈굴 쫓기
      if (NAZ_FIGHTERS.includes(c) && this.nazgulAt(here).length) opts.push({ value: `naz:${c}`, label: `⚡ ${nm}: 나즈굴 쫓아내기`, group: 'attack', char: c, loc: here });
      // 소집
      if (hd.region !== 'mordor' && this.locs[here].armies < D.MAX_ARMIES) {
        const free = c === 'aragorn' && !p.freeMuster;
        const hasCard = p.hand.some((x) => x.kind === 'loc' && L(x.loc).region === hd.region);
        if (free || hasCard) opts.push({ value: `mus:${c}`, label: `🛡 ${nm}: 군대 소집${free ? ' (카드 없이)' : ` (${D.REGIONS[hd.region].name} 카드 1장)`}`, group: 'muster', char: c, loc: here });
      }
      // 요새 점령
      if (hd.type === 'stronghold' && !this.locs[here].captured) {
        const need = c === 'gimli' ? 2 : 3;
        const have = p.hand.filter((x) => x.kind === 'loc' && L(x.loc).region === hd.region).length;
        const ok = this.locs[here].orcs === 0 && have >= need;
        opts.push({ value: `cap:${c}`, label: `🏰 ${nm}: ${hd.name} 점령 (${D.REGIONS[hd.region].name} 카드 ${need}장)`, group: 'capture', char: c, loc: here, disabled: !ok,
          reason: this.locs[here].orcs ? '오크를 모두 물리쳐야 점령할 수 있어요.' : `${D.REGIONS[hd.region].name} 카드가 ${need}장 필요해요.` });
      }
      // 카드 주고받기
      for (const other of this.players) {
        if (other.id === pid) continue;
        const near = c === 'merrypippin' || other.chars.some((oc) => this.pawn(oc) && this.pawn(oc).loc === here) || pl.chars.some((mc) => mc === 'merrypippin') && false;
        if (!near) continue;
        if (p.hand.length) opts.push({ value: `give:${c}:${other.id}`, label: `🤝 ${nm}: ${other.name}에게 카드 주기`, group: 'trade', char: c });
        if (this.P(other.id).hand.length) opts.push({ value: `take:${c}:${other.id}`, label: `🤝 ${nm}: ${other.name}에게서 카드 받기`, group: 'trade', char: c });
      }
      // 고유 능력
      if (c === 'galadriel' && this.shadowDeck.length) opts.push({ value: `mirror:${c}`, label: '🔮 갈라드리엘의 거울 (어둠 카드 위 3장 중 1장을 맨 아래로)', group: 'ability', char: c });
      if (c === 'elrond' && hd.type === 'haven' && !p.elrondUsed && p.hand.length && this.hope < this.maxHope) opts.push({ value: `elrond:${c}`, label: '✨ 엘론드: 카드 1장 버리고 희망 +1', group: 'ability', char: c });
    }
    // 이벤트 카드 (행동을 쓰지 않음)
    for (const card of p.hand) if (card.kind === 'event') opts.push({ value: `ev:${card.uid}`, label: `📜 ${D.EVENT_MAP[card.event].name}`, group: 'event', text: D.EVENT_MAP[card.event].text });
    opts.push({ value: 'end', label: '차례 마치기', group: 'end' });
    return opts;
  }

  spend(pid, st, c) {
    const primary = this.pl(pid).chars[0];
    if (c === primary || c === 'frodo' || !c) st.main--;
    else if (st.sub > 0) st.sub--;
    else st.main--;
  }

  moveFrodo(to, how) {
    const fr = this.frodo();
    fr.loc = to;
    const loc = this.locs[to];
    this.log(`🧝 프로도와 샘 → ${L(to).name}${how ? ` (${how})` : ''}`);
    if (how !== 'sneak' && loc.orcs >= 2) this.reveal(`${L(to).name}의 오크 무리`);
    const nz = this.nazgulAt(to).length;
    if (nz) this.search(`${L(to).name}의 나즈굴`, nz - 1);
  }

  async playerTurn(pid) {
    this.current = pid;
    this.phase = 'actions';
    const p = this.P(pid);
    p.freeMuster = false;
    p.elrondUsed = false;
    const st = { main: D.ACTIONS, sub: 1 };
    this.turnState = st;
    this.log(`── ${this.round}라운드: ${this.pname(pid)}의 차례 (${this.pl(pid).chars.map((c) => this.cname(c)).join(' · ')}) ──`, pid, 'turn');
    for (let guard = 0; guard < 60; guard++) {
      if (st.main <= 0 && st.sub <= 0 && !p.hand.some((c) => c.kind === 'event')) break;
      const opts = this.turnOptions(pid, st);
      const v = await this.ask(pid, { type: 'option', kind: 'turn', title: `행동 ${st.main}${st.sub ? ` + 보조 ${st.sub}` : ''}번 남음`, options: opts, actions: { ...st } });
      if (v === 'end') break;
      await this.doAction(pid, st, v);
      this.checkObjectives();
      this.changed();
    }
    this.turnState = null;
  }

  takeCard(pid, uid) {
    const p = this.P(pid);
    const i = p.hand.findIndex((c) => c.uid === uid);
    if (i < 0) return null;
    const [c] = p.hand.splice(i, 1);
    return c;
  }
  discard(pid, uid) { const c = this.takeCard(pid, uid); if (c) this.playerDiscard.push(c); return c; }

  /** 카드 고르기 (filter에 맞는 손패 중) */
  async pickCard(pid, title, filter, extra = {}) {
    const p = this.P(pid);
    const opts = p.hand.filter(filter).map((c) => ({ value: c.uid, label: this.cardName(c), loc: c.loc, ring: c.kind === 'loc' && L(c.loc).ring, stealth: c.kind === 'loc' && L(c.loc).stealth }));
    return this.choose(pid, title, opts, { kind: 'card', ...extra });
  }

  async doAction(pid, st, v) {
    const p = this.P(pid);
    const [kind, a, b] = v.split(':');
    switch (kind) {
      case 'mv': {
        this.spend(pid, st, a);
        if (a === 'frodo') this.moveFrodo(b);
        else { this.pawn(a).loc = b; this.log(`${this.cname(a)} → ${L(b).name}`, pid); }
        break;
      }
      case 'fly': {
        const c = this.discard(pid, b);
        this.spend(pid, st, a);
        this.pawn(a).loc = c.loc;
        this.log(`${this.cname(a)} → ${L(c.loc).name} (${L(c.loc).name} 카드 사용)`, pid);
        break;
      }
      case 'sneak': {
        const uid = await this.pickCard(pid, '버릴 👣 은신 카드', (c) => c.kind === 'loc' && L(c.loc).stealth);
        if (!uid) break;
        this.discard(pid, uid);
        this.spend(pid, st, 'frodo');
        this.hide('은신 이동');
        await this.frodoSteps(pid, 2, 'sneak');
        break;
      }
      case 'hide': {
        this.spend(pid, st, 'frodo');
        this.hide(L(this.frodo().loc).type === 'haven' ? '안식처' : '동료의 도움');
        break;
      }
      case 'destroy': {
        let need = this.diff.ring;
        // 💍 카드는 원정대 누구의 손패에서든 (지금 차례인 사람부터)
        for (const q of [pid, ...this.order.filter((x) => x !== pid)]) {
          for (const c of this.P(q).hand.slice()) if (need > 0 && c.kind === 'loc' && L(c.loc).ring) { this.discard(q, c.uid); need--; }
        }
        this.spend(pid, st, 'frodo');
        this.ev('destroy');
        this.endGame(true, '프로도와 샘이 운명의 산의 불길 속에 절대반지를 던졌습니다! 사우론이 무너집니다.');
        break;
      }
      case 'atk': {
        this.spend(pid, st, a);
        const here = this.pawn(a).loc;
        const t = b;
        const tl = L(t);
        let n = 1;
        if (a === 'gandalf') n = D.MAX_ORCS;
        if (a === 'treebeard' && tl.type === 'forest') n = 3;
        if (a === 'aragorn') n += 1;
        if (a === 'legolas' && tl.type === 'forest') n += 1;
        if (a === 'gimli' && (tl.type === 'mountain' || tl.type === 'stronghold')) n += 1;
        if (a === 'eowyn' && tl.region === 'rohan') n += 1;
        if (this.locs[t].armies > 0 && t === here) n += 1;
        this.removeOrcs(t, n, this.cname(a));
        break;
      }
      case 'naz': {
        this.spend(pid, st, a);
        const here = this.pawn(a).loc;
        const nz = this.nazgulAt(here)[0];
        nz.loc = 'minasmorgul';
        this.stats.nazgulRepelled++;
        this.log(`⚡ ${this.cname(a)}이(가) 나즈굴을 미나스 모르굴로 쫓아냈어요!`, pid, 'good');
        this.ev('nazgul', { loc: here });
        break;
      }
      case 'mus': {
        const here = this.pawn(a).loc;
        const hd = L(here);
        if (a === 'aragorn' && !p.freeMuster) p.freeMuster = true;
        else {
          const uid = await this.pickCard(pid, `버릴 ${D.REGIONS[hd.region].name} 카드`, (c) => c.kind === 'loc' && L(c.loc).region === hd.region);
          if (!uid) break;
          this.discard(pid, uid);
        }
        this.spend(pid, st, a);
        this.addArmies(here, a === 'theoden' && hd.region === 'rohan' ? 2 : 1, this.cname(a));
        break;
      }
      case 'cap': {
        const here = this.pawn(a).loc;
        const hd = L(here);
        const need = a === 'gimli' ? 2 : 3;
        for (let i = 0; i < need; i++) {
          const uid = await this.pickCard(pid, `버릴 ${D.REGIONS[hd.region].name} 카드 (${i + 1}/${need})`, (c) => c.kind === 'loc' && L(c.loc).region === hd.region);
          if (uid) this.discard(pid, uid);
        }
        this.spend(pid, st, a);
        this.locs[here].captured = true;
        this.log(`🏰 ${this.cname(a)}이(가) ${hd.name}을(를) 점령했어요! 이제 이곳엔 오크가 모이지 않아요.`, pid, 'good');
        this.ev('capture', { loc: here });
        this.gainHope(1, `${hd.name} 점령`);
        break;
      }
      case 'give': case 'take': {
        const from = kind === 'give' ? pid : b;
        const to = kind === 'give' ? b : pid;
        const uid = await this.choose(pid, kind === 'give' ? `${this.pname(b)}에게 줄 카드` : `${this.pname(b)}에게서 받을 카드`,
          this.P(from).hand.map((c) => ({ value: c.uid, label: this.cardName(c), loc: c.loc, ring: c.kind === 'loc' && L(c.loc).ring, stealth: c.kind === 'loc' && L(c.loc).stealth })).concat([{ value: 'cancel', label: '취소' }]), { kind: 'card', always: true });
        if (!uid || uid === 'cancel') break;
        const c = this.takeCard(from, uid);
        this.P(to).hand.push(c);
        this.spend(pid, st, a);
        this.log(`🤝 ${this.pname(from)} → ${this.pname(to)}: ${this.cardName(c)}`, pid);
        await this.handLimit(to);
        break;
      }
      case 'mirror': {
        this.spend(pid, st, a);
        const top = this.shadowDeck.slice(0, 3);
        const i = await this.choose(pid, '거울에 비친 어둠 — 맨 아래로 보낼 카드', top.map((c, k) => ({ value: String(k), label: this.shadowName(c) })), { kind: 'mirror', always: true });
        const [c] = this.shadowDeck.splice(Number(i), 1);
        this.shadowDeck.push(c);
        this.log(`🔮 갈라드리엘의 거울: "${this.shadowName(c)}"을(를) 어둠 덱 맨 아래로.`, pid);
        break;
      }
      case 'elrond': {
        const uid = await this.pickCard(pid, '버릴 카드 (희망 +1)', () => true);
        if (!uid) break;
        this.discard(pid, uid);
        p.elrondUsed = true;
        this.spend(pid, st, a);
        this.gainHope(1, '엘론드의 지혜');
        break;
      }
      case 'ev': {
        const c = this.discard(pid, a);
        this.log(`📜 ${this.pname(pid)}: ${D.EVENT_MAP[c.event].name}!`, pid, 'good');
        await this.playEvent(pid, c.event, st);
        break;
      }
      default:
    }
  }

  shadowName(c) {
    if (c.kind === 'loc') return `${L(c.loc).name} (오크)`;
    return D.SHADOW_SPECIAL.find((s) => s.kind === c.kind).name;
  }

  async frodoSteps(pid, n, how) {
    for (let i = 0; i < n; i++) {
      const fr = this.frodo();
      const opts = L(fr.loc).adj.map((to) => ({ value: to, label: L(to).name, loc: to, orcs: this.locs[to].orcs, nazgul: this.nazgulAt(to).length }));
      const to = await this.choose(pid, `프로도 이동 (${i + 1}/${n})`, [...opts, { value: 'stop', label: '여기서 멈추기' }], { kind: 'frodostep', always: true });
      if (!to || to === 'stop') return;
      this.moveFrodo(to, how);
    }
  }

  async pickLoc(pid, title, filter) {
    return this.choose(pid, title, D.LOCATIONS.filter(filter).map((l) => ({ value: l.id, label: l.name, loc: l.id })), { kind: 'loc' });
  }

  async playEvent(pid, id, st) {
    switch (id) {
      case 'eagles': {
        const who = await this.choose(pid, '독수리가 태워 갈 인물', this.pawns.map((p) => ({ value: p.id, label: this.cname(p.id), loc: p.loc })), { kind: 'pawn' });
        const to = await this.choose(pid, `${this.cname(who)}을(를) 어디로?`, D.LOCATIONS.filter((l) => l.region !== 'mordor' && l.id !== this.pawn(who).loc).map((l) => ({ value: l.id, label: l.name, loc: l.id })), { kind: 'loc', eagle: who });
        if (who === 'frodo') { this.frodo().loc = to; this.log(`🦅 독수리가 프로도와 샘을 ${L(to).name}(으)로 데려갔어요.`); const nz = this.nazgulAt(to).length; if (nz) this.search('나즈굴', nz - 1); } else { this.pawn(who).loc = to; this.log(`🦅 독수리가 ${this.cname(who)}을(를) ${L(to).name}(으)로 데려갔어요.`); }
        break;
      }
      case 'lembas': st.main += 2; this.log('🍞 렘바스 빵: 이번 차례 행동 +2'); break;
      case 'palantir': {
        const top = this.shadowDeck.slice(0, 5);
        if (!top.length) break;
        const i = await this.choose(pid, '팔란티르 — 없앨 어둠 카드', top.map((c, k) => ({ value: String(k), label: this.shadowName(c) })), { kind: 'mirror', always: true });
        const [c] = this.shadowDeck.splice(Number(i), 1);
        this.log(`🔮 팔란티르: "${this.shadowName(c)}"을(를) 게임에서 없앴어요.`);
        break;
      }
      case 'entwrath': for (const l of ['fangorn', 'isengard', 'isenfords']) this.removeOrcs(l, 9, '엔트의 분노'); break;
      case 'beacons': {
        this.addArmies('minastirith', 1, '곤도르의 봉화');
        this.addArmies('edoras', 1, '곤도르의 봉화');
        const to = await this.pickLoc(pid, '봉화가 닿을 곳 (군대 +1)', (l) => (l.region === 'gondor' || l.region === 'rohan') && this.locs[l.id].armies < D.MAX_ARMIES);
        if (to) this.addArmies(to, 1, '곤도르의 봉화');
        break;
      }
      case 'mithril': this.hide('미스릴 갑옷'); this.gainHope(1, '미스릴 갑옷'); break;
      case 'elbereth': {
        const locs = [...new Set(this.nazgul.map((n) => n.loc))].filter((x) => x !== 'minasmorgul');
        const to = await this.choose(pid, '나즈굴을 쫓아낼 지역', locs.map((x) => ({ value: x, label: `${L(x).name} (나즈굴 ${this.nazgulAt(x).length})`, loc: x })), { kind: 'loc' });
        if (!to) { this.log('쫓아낼 나즈굴이 없어요.'); break; }
        const k = this.nazgulAt(to).length;
        for (const n of this.nazgulAt(to)) n.loc = 'minasmorgul';
        this.stats.nazgulRepelled += k;
        this.log(`✨ "엘베레스 길소니엘!" 나즈굴 ${k}기가 미나스 모르굴로 달아났어요.`, pid, 'good');
        break;
      }
      case 'tom': {
        const to = await this.pickLoc(pid, '톰 봄바딜이 지킬 곳', (l) => l.region === 'eriador' && this.locs[l.id].orcs > 0);
        if (to) this.removeOrcs(to, 9, '톰 봄바딜');
        if (L(this.frodo().loc).region === 'eriador') this.hide('톰 봄바딜');
        break;
      }
      case 'gandalfwhite': this.gainHope(2, '백색의 간달프'); break;
      case 'rohirrim': {
        const to = await this.pickLoc(pid, '기병대가 달려갈 곳 (군대 +2)', (l) => (l.region === 'gondor' || l.region === 'rohan') && this.locs[l.id].armies < D.MAX_ARMIES);
        if (to) this.addArmies(to, 2, '로한의 기병대');
        break;
      }
      case 'dead': {
        this.removeOrcs('pelargir', 9, '망자의 군대');
        this.removeOrcs('dolamroth', 9, '망자의 군대');
        const to = await this.pickLoc(pid, '망자의 군대가 휩쓸 곤도르 지역', (l) => l.region === 'gondor' && this.locs[l.id].orcs > 0);
        if (to) this.removeOrcs(to, 9, '망자의 군대');
        break;
      }
      case 'phial': this.hide('별빛 유리병'); await this.frodoSteps(pid, 2, 'sneak'); break;
      case 'gollum': this.hide('스메아골의 안내'); await this.frodoSteps(pid, 3, 'sneak'); break;
      case 'quiet': this.skipShadow = true; this.log('🌙 고요한 밤: 다음 어둠 단계를 건너뜁니다.'); break;
      default:
    }
  }

  async handLimit(pid) {
    const p = this.P(pid);
    while (p.hand.length > D.HAND_LIMIT) {
      const uid = await this.choose(pid, `손패가 ${D.HAND_LIMIT}장을 넘어요 — 버리거나 이벤트를 쓰세요`, p.hand.map((c) => ({ value: c.uid, label: this.cardName(c) + (c.kind === 'event' ? ' (사용)' : ' (버림)'), loc: c.loc, ring: c.kind === 'loc' && L(c.loc).ring, stealth: c.kind === 'loc' && L(c.loc).stealth })), { kind: 'discard', always: true });
      const c = this.discard(pid, uid);
      if (c.kind === 'event') { this.log(`📜 ${this.pname(pid)}: ${D.EVENT_MAP[c.event].name}!`, pid, 'good'); await this.playEvent(pid, c.event, { main: 0, sub: 0 }); }
      else this.log(`${this.pname(pid)}이(가) ${this.cardName(c)} 카드를 버렸어요.`, pid);
    }
  }

  // ───────────── 카드 뽑기 · 어둠 단계 ─────────────
  async drawPhase(pid) {
    this.phase = 'draw';
    for (let i = 0; i < 2; i++) {
      if (!this.playerDeck.length) this.endGame(false, '시간이 다 되었습니다. 원정대 덱이 바닥났습니다.');
      const c = this.playerDeck.shift();
      if (c.kind === 'surge') { this.surge(); continue; }
      this.P(pid).hand.push(c);
      this.log(`🃏 ${this.pname(pid)}이(가) ${this.cardName(c)} 카드를 받았어요.`, pid);
    }
    this.changed();
    await this.handLimit(pid);
  }

  /** 어둠의 파도: 위협 +1, 맨 아래 장소에 오크 3, 버린 어둠 카드를 섞어 위에 */
  surge() {
    this.threatIdx = Math.min(D.THREAT_TRACK.length - 1, this.threatIdx + 1);
    this.log(`🌑 어둠의 파도! 위협이 오릅니다 (어둠 카드 ${D.THREAT_TRACK[this.threatIdx]}장씩)`, null, 'bad');
    this.ev('surge');
    let i = -1;
    for (let k = this.shadowDeck.length - 1; k >= 0; k--) if (this.shadowDeck[k].kind === 'loc') { i = k; break; }
    if (i >= 0) {
      const [c] = this.shadowDeck.splice(i, 1);
      this.addOrcs(c.loc, 3, '어둠의 파도');
      this.shadowDiscard.push(c);
    }
    this.shadowDeck = [...this.shuffle(this.shadowDiscard), ...this.shadowDeck];
    this.shadowDiscard = [];
  }

  shadowPhase() {
    this.phase = 'shadow';
    if (this.skipShadow) { this.skipShadow = false; this.log('🌙 고요한 밤 — 어둠이 잠잠합니다.'); return; }
    const n = D.THREAT_TRACK[this.threatIdx];
    for (let i = 0; i < n; i++) {
      if (!this.shadowDeck.length) { this.shadowDeck = this.shuffle(this.shadowDiscard); this.shadowDiscard = []; }
      const c = this.shadowDeck.shift();
      if (!c) break;
      this.shadowDiscard.push(c);
      this.ev('shadow', { card: c });
      if (c.kind === 'loc') this.addOrcs(c.loc, 1, '어둠 카드');
      else if (c.kind === 'nazgul') this.nazgulHunt();
      else if (c.kind === 'eye') {
        const f = this.frodo().loc;
        if (L(f).type === 'haven') this.log('👁 사우론의 눈이 안식처를 꿰뚫어 보지 못해요.');
        else if (L(f).region === 'mordor' || !this.hidden) this.search('사우론의 눈', 0);
        else if (this.locs[f].orcs > 0) this.reveal('사우론의 눈');
        else this.log('👁 사우론의 눈이 가운데땅을 훑었지만 반지를 찾지 못했어요.');
      } else if (c.kind === 'saruman') { this.addOrcs('isengard', 1, '사루만의 배신'); this.addOrcs('isenfords', 1, '사루만의 배신'); }
    }
  }

  // ───────────── 진행 ─────────────
  async run() {
    try {
      this.setup();
      for (this.round = 1; this.round <= 60; this.round++) {
        for (const pid of this.order) {
          await this.playerTurn(pid);
          await this.drawPhase(pid);
          this.shadowPhase();
          // 모르도르 안에서는 차례가 끝날 때마다 눈이 프로도를 찾음 (보통 이상)
          if (this.diff.mordor && L(this.frodo().loc).region === 'mordor') this.search('모르도르의 감시', 0);
          this.checkObjectives();
          this.changed();
        }
      }
      this.endGame(false, '너무 오래 걸렸습니다.');
    } catch (e) {
      if (!(e instanceof GameOver)) { console.error(e); if (!this.result) { this.result = { win: false, reason: '서버 오류: ' + e.message }; this.changed(); } }
    }
    return this.result;
  }

  // ───────────── 화면용 상태 ─────────────
  view(forPid) {
    const card = (c) => ({ uid: c.uid, kind: c.kind, loc: c.loc || null, event: c.event || null, name: this.cardName(c), region: this.cardRegion(c),
      ring: c.kind === 'loc' && L(c.loc).ring, stealth: c.kind === 'loc' && L(c.loc).stealth, text: c.kind === 'event' ? D.EVENT_MAP[c.event].text : '' });
    return {
      round: this.round, phase: this.phase, current: this.current, order: this.order, result: this.result, you: forPid,
      difficulty: this.diff.name, diffId: this.diff.id, hope: this.hope ?? 0, maxHope: this.maxHope ?? 0,
      threat: this.threatIdx ?? 0, threatRate: D.THREAT_TRACK[this.threatIdx ?? 0], threatTrack: D.THREAT_TRACK,
      hidden: !!this.hidden, objNeed: this.diff.objNeed, ringNeed: this.diff.ring, ringInHands: this.ps ? this.handRingCount() : 0,
      objectives: this.objectives || [], locs: this.locs || {}, pawns: this.pawns || [], nazgul: this.nazgul || [],
      playerDeck: this.playerDeck ? this.playerDeck.length : 0, surgesLeft: this.playerDeck ? this.playerDeck.filter((c) => c.kind === 'surge').length : 0,
      shadowDeck: this.shadowDeck ? this.shadowDeck.length : 0, shadowDiscard: this.shadowDiscard ? this.shadowDiscard.slice(-6).map((c) => this.shadowName(c)) : [],
      stats: this.stats || {}, skipShadow: !!this.skipShadow, turn: this.turnState ? { ...this.turnState } : null,
      players: this.players.map((pl) => {
        const p = this.ps ? this.ps[pl.id] : null;
        // 협력 게임이라 손패는 모두에게 공개
        return { id: pl.id, name: pl.name, bot: pl.bot, chars: pl.chars, hand: p ? p.hand.map(card) : [] };
      }),
      log: this.logs.slice(-80), events: this.events.slice(-20),
    };
  }
}

// ───────────── AI ─────────────
function botAnswer(g, pid, pr) {
  const ok = pr.options.filter((o) => !o.disabled);
  const val = (o) => (o ? o.value : ok[0].value);
  if (!ok.length) return pr.options[0].value;
  switch (pr.kind) {
    case 'turn': return botTurn(g, pid, ok);
    case 'card': {
      // 💍 카드는 아끼고, 많은 지역 카드부터 버림
      const cancel = ok.find((o) => o.value === 'cancel');
      const cards = ok.filter((o) => o.value !== 'cancel');
      if (g._botGive) { const want = cards.find((o) => o.value === g._botGive); g._botGive = null; if (want) return want.value; }
      return val(cards.slice().sort((a, b) => (a.ring ? 1 : 0) - (b.ring ? 1 : 0))[0] || cancel);
    }
    case 'discard': {
      const ev = ok.find((o) => /\(사용\)/.test(o.label));
      if (ev) return ev.value;
      return val(ok.slice().sort((a, b) => (a.ring ? 1 : 0) - (b.ring ? 1 : 0) || (a.stealth ? 1 : 0) - (b.stealth ? 1 : 0))[0]);
    }
    case 'frodostep': {
      const f = g.frodo().loc;
      const goal = botFrodoGoal(g);
      const cur = g.dist(f, goal);
      const steps = ok.filter((o) => o.value !== 'stop' && g.dist(o.value, goal) < cur && !g.nazgulAt(o.value).length);
      if (!steps.length) return 'stop';
      return steps.sort((a, b) => g.locs[a.value].orcs - g.locs[b.value].orcs)[0].value;
    }
    case 'pawn': return val(ok.find((o) => o.value === 'frodo') || ok[0]);
    case 'loc': {
      if (pr.eagle === 'frodo') return val(ok.slice().sort((x, y) => g.dist(x.value, 'mountdoom') + g.nazgulAt(x.value).length * 3 + g.locs[x.value].orcs - g.dist(y.value, 'mountdoom') - g.nazgulAt(y.value).length * 3 - g.locs[y.value].orcs)[0]);
      // 오크가 가장 많은 곳 / 군대가 적은 목표 지역
      const focus = new Set(botFocus(g).map((f) => f.loc));
      return val(ok.slice().sort((a, b) => (focus.has(b.value) ? 2 : 0) + g.locs[b.value].orcs - (focus.has(a.value) ? 2 : 0) - g.locs[a.value].orcs)[0]);
    }
    case 'mirror': {
      const pri = (o) => (/나즈굴/.test(o.label) ? 3 : /눈/.test(o.label) ? 2 : /사루만/.test(o.label) ? 1 : 0);
      return val(ok.slice().sort((a, b) => pri(b) - pri(a))[0]);
    }
    default: return val(ok[0]);
  }
}

/** 프로도가 향할 곳: 목표를 충분히 이뤘으면 운명의 산, 아니면 모르도르 문턱에서 기다림 */
function botFrodoGoal(g) {
  const ready = g.objDone() >= g.objNeed() - 1;
  return ready ? 'mountdoom' : 'ithilien';
}

/** 아직 못 이룬 공개 목표에서 할 일 목록 {loc, need, army} */
function botFocus(g) {
  const out = [];
  for (const o of g.objectives) {
    if (o.done) continue;
    const def = D.OBJ_MAP[o.id];
    for (const loc of def.focus || []) out.push({ loc, need: def.need, army: def.army || 0, obj: o.id });
  }
  return out;
}

function botTurn(g, pid, ok) {
  const has = (v) => ok.find((o) => o.value === v);
  const p = g.P(pid);
  // 1) 반지 파괴
  if (has('destroy')) return 'destroy';
  // 2) 이벤트: 상황에 맞으면 사용
  for (const o of ok.filter((x) => x.group === 'event')) {
    const id = p.hand.find((c) => c.uid === o.value.slice(3)).event;
    if (id === 'gandalfwhite' && g.hope <= g.maxHope - 2) return o.value;
    if (id === 'mithril' && (!g.hidden || g.hope <= g.maxHope - 1)) return o.value;
    if (id === 'quiet' && g.threatIdx >= 2) return o.value;
    if (id === 'lembas') return o.value;
    if (['entwrath', 'dead', 'tom', 'beacons', 'rohirrim'].includes(id)) return o.value;
    if (id === 'elbereth' && g.nazgul.some((n) => g.dist(n.loc, g.frodo().loc) <= 1)) return o.value;
    if (id === 'palantir' && g.threatIdx >= 1) return o.value;
    if ((id === 'phial' || id === 'gollum') && g.objDone() >= g.objNeed() - 1 && g.frodo().loc !== 'mountdoom') return o.value;
    if (id === 'eagles' && g.objDone() >= g.objNeed() && g.dist(g.frodo().loc, 'mountdoom') > 3) return o.value;
  }
  // 3) 요새 점령
  const cap = ok.find((o) => o.group === 'capture');
  if (cap) return cap.value;
  const fr = g.frodo();
  const goal = botFrodoGoal(g);
  const st = g.turnState || { main: 1, sub: 0 };
  // 4) 프로도: 발각되면 숨기, 나즈굴이 옆에 있으면 피하기, 아니면 목표로 (차례마다 한 걸음)
  if (has('hide')) return 'hide';
  g._botFrodoMoved = g._botFrodoMoved || {};
  const turnKey = `${g.round}:${pid}`;
  const frodoMoves = ok.filter((o) => o.group === 'move' && o.char === 'frodo');
  const atGoal = fr.loc === goal;
  const ringReady = g.handRingCount() >= g.diff.ring;
  const maxSteps = goal === 'mountdoom' ? 2 : 1;
  if (!atGoal && (g._botFrodoMoved[turnKey] || 0) < maxSteps && (goal !== 'mountdoom' || ringReady || g.dist(fr.loc, goal) > 2)) {
    const cur = g.dist(fr.loc, goal);
    let safe = frodoMoves.filter((o) => g.dist(o.loc, goal) < cur && !g.nazgulAt(o.loc).length && (g.locs[o.loc].orcs < 2 || L(o.loc).region === 'mordor'));
    // 길이 막혔으면 (목표를 다 이뤘고 희망이 넉넉할 때) 위험을 무릅쓰고
    if (!safe.length && goal === 'mountdoom' && ringReady && g.hope >= 3) safe = frodoMoves.filter((o) => g.dist(o.loc, goal) < cur);
    if (safe.length) {
      g._botFrodoMoved[turnKey] = (g._botFrodoMoved[turnKey] || 0) + 1;
      const sneak = has('sneak');
      if (sneak && (L(fr.loc).region === 'mordor' || g.dist(fr.loc, goal) >= 2) && p.hand.filter((c) => c.kind === 'loc' && L(c.loc).stealth && !L(c.loc).ring).length) return 'sneak';
      return safe.sort((a, b) => g.locs[a.loc].orcs - g.locs[b.loc].orcs)[0].value;
    }
  }
  // 나즈굴이 같은 곳에 오면 쫓기
  const naz = ok.find((o) => o.value.startsWith('naz:') && (o.loc === fr.loc || g.dist(o.loc, fr.loc) <= 2));
  if (naz) return naz.value;
  // 5) 오크가 많은 곳 공격 (2마리 이상, 또는 목표 지역)
  const focus = botFocus(g);
  const focusLocs = new Set(focus.map((f) => f.loc));
  const atks = ok.filter((o) => o.group === 'attack' && o.value.startsWith('atk:'));
  const atkScore = (o) => g.locs[o.loc].orcs * 2 + (focusLocs.has(o.loc) ? 3 : 0) + (g.dist(o.loc, fr.loc) <= 1 ? 2 : 0);
  const bestAtk = atks.sort((a, b) => atkScore(b) - atkScore(a))[0];
  if (bestAtk && (g.locs[bestAtk.loc].orcs >= 2 || focusLocs.has(bestAtk.loc) || atkScore(bestAtk) >= 4)) return bestAtk.value;
  // 6) 목표 지역에서 군대 소집 (💍 카드는 아끼며)
  for (const o of ok.filter((x) => x.group === 'muster')) {
    const f = focus.find((x) => x.loc === o.loc && x.need === 'army' && g.locs[o.loc].armies < Math.max(1, x.army));
    const ringOnly = !o.label.includes('카드 없이') && !p.hand.some((c) => c.kind === 'loc' && L(c.loc).region === L(o.loc).region && !L(c.loc).ring);
    if (f && (!ringOnly || g.handRingCount() > g.diff.ring)) return o.value;
  }
  // 7) 💍 카드 몰아주기: 프로도와 가까운 사람에게 (같은 곳이면)
  // 8) 남은 공격
  if (bestAtk) return bestAtk.value;
  // 9) 목표 지역으로 이동 (내 인물 중 행동 가능한 쪽)
  const moves = ok.filter((o) => (o.group === 'move' || o.group === 'cardmove') && o.char !== 'frodo');
  if (moves.length) {
    const targets = [];
    for (const f of focus) {
      const l = g.locs[f.loc];
      if (f.need === 'capture' && !l.captured) targets.push({ loc: f.loc, w: 3 });
      else if (f.need === 'clear' && l.orcs > 0) targets.push({ loc: f.loc, w: 2 + l.orcs });
      else if (f.need === 'army' && l.armies < Math.max(1, f.army)) targets.push({ loc: f.loc, w: 2 });
      else if (f.need === 'chars') targets.push({ loc: g.frodo().loc, w: 1 });
    }
    for (const l of D.LOCATIONS) if (g.locs[l.id].orcs >= 3) targets.push({ loc: l.id, w: 2 });
    // 나즈굴 사냥꾼은 프로도 곁으로
    if (targets.length) {
      let best = null; let bs = -1e9;
      for (const o of moves) {
        const from = g.pawn(o.char).loc;
        const ownTargetsHere = targets.some((t) => t.loc === from && (g.locs[from].orcs > 0 || focusLocs.has(from)));
        for (const t of targets) {
          const gain = g.dist(from, t.loc) - g.dist(o.loc, t.loc);
          if (gain <= 0) continue;
          const s = t.w * 3 - g.dist(o.loc, t.loc) + gain * 2 - (o.group === 'cardmove' ? 4 : 0) - (ownTargetsHere ? 6 : 0) - (NAZ_FIGHTERS.includes(o.char) && t.loc !== fr.loc ? 0 : 0);
          if (s > bs) { bs = s; best = o; }
        }
      }
      if (best && bs > 0) return best.value;
    }
  }
  return 'end';
}

module.exports = { Game, GameOver, botAnswer };
