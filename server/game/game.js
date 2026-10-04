'use strict';
const { EventEmitter } = require('events');
const { buildIsland, TERRAIN_NAMES } = require('./boards');
const { SPIRIT_MAP } = require('./spirits');
const { POWERS, POWER_MAP } = require('./powers');
const { FEAR_CARDS } = require('./fear');
const { difficultyConfig } = require('./adversaries');

const PIECE_NAMES = { explorer: '탐험가', town: '마을', city: '도시', dahan: '다한', blight: '황폐' };
const ELEMENT_NAMES = { sun: '태양', moon: '달', fire: '불', air: '공기', water: '물', earth: '대지', plant: '식물', animal: '짐승' };
const TIER = { city: 3, town: 2, explorer: 1 };
const HP = { explorer: 1, town: 2, city: 3, dahan: 2 };

class GameOver extends Error {
  constructor(win, reason) {
    super(reason);
    this.win = win;
    this.reason = reason;
  }
}

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

function invaderCardName(card) {
  if (card.coastal) return '해안 지역';
  return card.terrains.map((t) => TERRAIN_NAMES[t]).join('+');
}

class Game extends EventEmitter {
  /**
   * @param {Array<{id:string,name:string,spiritId:string}>} players
   * @param {{seed?:number}} opts
   */
  constructor(players, opts = {}) {
    super();
    if (!players.length || players.length > 6) throw new Error('정령은 1~6개여야 합니다.');
    this.seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.rand = mulberry32(this.seed);
    this.players = players.map((p) => ({ ...p }));
    this.playerIds = this.players.map((p) => p.id);
    const settings = opts.settings || {};
    this.settings = settings;
    this.stepDelay = opts.stepDelay || 0; // 침략자 단계를 사람이 볼 수 있도록 잠깐씩 멈추는 시간(ms)
    this.stepManual = !!opts.stepManual; // true면 모두 "다음"을 누를 때까지 기다림 (stepMaxWait 후 자동 진행)
    this.stepMaxWait = opts.stepMaxWait || 120000;
    this.stepNo = 0;
    this.stepWaiter = null;
    this.tutorial = !!opts.tutorial;
    this.invaderStep = null;
    this.diff = difficultyConfig(settings.difficulty);
    const map = settings.map || {};
    const avail = ['A', 'B', 'C', 'D', ...((settings.expansions || []).includes('je') || players.length > 4 ? ['E', 'F'] : [])];
    let boardCount = players.length + (map.extraBoard ? 1 : 0);
    boardCount = Math.max(players.length, Math.min(boardCount, avail.length));
    const letters = (map.boards === 'random' ? this.shuffle(avail) : avail).slice(0, boardCount);
    const island = buildIsland({ boards: letters, layout: boardCount > 4 ? 'coast' : (map.layout || 'auto') });
    this.boardLetters = island.boards;
    this.lands = island.lands;
    this.oceans = island.oceans;
    this.mapSize = { width: island.width, height: island.height };
    this.boardOf = {};
    this.players.forEach((p, i) => { this.boardOf[p.id] = island.boards[i]; });

    this.phase = 'setup';
    this.turn = 0;
    this.logLines = [];
    this.prompts = {}; // pid -> [{id, prompt, resolve}]
    this.promptSeq = 1;
    this.turnRules = [];
    this.result = null;
    this.events = []; // 최근 침략자 행동 하이라이트 [{landId, kind}]

    const n = players.length;
    const d = this.diff;
    const fearCards = Math.min(FEAR_CARDS.length, 9 + (d.extraFear || 0));
    this.fear = { poolSize: d.fearPerPlayer * n, generated: 0, deck: this.shuffle(FEAR_CARDS.map((c) => c.id)).slice(0, fearCards), earned: [], earnedTotal: 0, resolved: [], total: fearCards };
    this.blight = { pool: Math.max(1, (2 + d.blightPerPlayer) * n + 1), flipped: false };

    const minors = POWERS.filter((p) => p.kind === 'minor').map((p) => p.id);
    const majors = POWERS.filter((p) => p.kind === 'major').map((p) => p.id);
    this.decks = { minor: this.shuffle(minors), major: this.shuffle(majors), minorDiscard: [], majorDiscard: [] };

    const s1 = this.shuffle(['M', 'J', 'S', 'W'].map((t) => ({ stage: 1, terrains: [t] }))).slice(0, 3);
    const s2 = this.shuffle([...['M', 'J', 'S', 'W'].map((t) => ({ stage: 2, terrains: [t] })), { stage: 2, coastal: true, terrains: [] }]).slice(0, 4);
    const s3 = this.shuffle(['MJ', 'MS', 'MW', 'JS', 'JW', 'SW'].map((s) => ({ stage: 3, terrains: s.split('') }))).slice(0, 5);
    s1.splice(0, Math.min(s1.length, d.removeStage1 || 0));
    // 쉬운 난이도: 1단계 카드를 더 넣어 침략자가 천천히 강해진다 (기존 순서 뒤에 추가)
    for (let i = 0; i < (d.addStage1 || 0); i++) s1.push({ stage: 1, terrains: [['M', 'J', 'S', 'W'][(i + s1.length) % 4]] });
    s2.splice(0, Math.min(s2.length - 1, d.removeStage2 || 0));
    this.invader = { deck: [...s1, ...s2, ...s3], ravage: null, build: null, lastExplore: null, discard: [] };

    this.spirits = {};
    for (const p of this.players) {
      const def = SPIRIT_MAP[p.spiritId];
      if (!def) throw new Error('알 수 없는 정령: ' + p.spiritId);
      this.spirits[p.id] = {
        pid: p.id,
        spiritId: def.id,
        energy: d.startEnergy || 0,
        energyRevealed: 1,
        cardRevealed: 1,
        destroyed: 0,
        hand: [...def.uniques],
        played: [], // [{id, used}]
        discard: [],
        forgotten: [],
        bonusElements: {},
        fastAllowance: 0,
        repeats: [], // [{maxCost}]
        innatesUsed: {},
        growthChoice: null,
        status: '',
      };
    }
  }

  static get ELEMENT_NAMES() { return ELEMENT_NAMES; }

  // ───────────── 유틸 ─────────────
  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  log(msg) {
    this.logSeq = (this.logSeq || 0) + 1;
    this.logLines.push({ seq: this.logSeq, turn: this.turn, msg });
    if (this.logLines.length > 300) this.logLines.shift();
    this.changed();
  }

  changed() {
    if (this._changeScheduled) return;
    this._changeScheduled = true;
    setImmediate(() => {
      this._changeScheduled = false;
      this.emit('update');
    });
  }

  pname(pid) {
    const p = this.players.find((x) => x.id === pid);
    return p ? `${p.name}(${SPIRIT_MAP[p.spiritId].name})` : pid;
  }

  spiritDef(pid) { return SPIRIT_MAP[this.spirits[pid].spiritId]; }

  forEachLand(fn) { for (const l of Object.values(this.lands)) fn(l); }

  // ───────────── 선택(프롬프트) ─────────────
  ask(pid, prompt) {
    if (this.result) return new Promise(() => {});
    return new Promise((resolve) => {
      const entry = { id: this.promptSeq++, prompt, resolve };
      (this.prompts[pid] ||= []).push(entry);
      this.changed();
    });
  }

  currentPrompt(pid) {
    const stack = this.prompts[pid];
    if (!stack || !stack.length) return null;
    const top = stack[stack.length - 1];
    return { id: top.id, ...top.prompt };
  }

  /** 클라이언트의 응답 처리. 잘못된 응답이면 에러 메시지 문자열 반환 */
  answer(pid, promptId, value) {
    const stack = this.prompts[pid];
    if (!stack || !stack.length) return '대기 중인 선택이 없습니다.';
    const top = stack[stack.length - 1];
    if (top.id !== promptId) return '이미 처리된 선택입니다.';
    const p = top.prompt;
    if (p.type === 'option') {
      if (!p.options.some((o) => o.value === value)) return '잘못된 선택입니다.';
    } else if (p.type === 'land') {
      if (value === null) { if (!p.cancel) return '취소할 수 없습니다.'; } else if (!p.options.includes(value)) return '선택할 수 없는 지역입니다.';
    } else if (p.type === 'cards') {
      if (!Array.isArray(value) || new Set(value).size !== value.length) return '잘못된 카드 선택입니다.';
      if (value.some((v) => !p.cards.includes(v))) return '선택할 수 없는 카드입니다.';
      if (value.length < p.min || value.length > p.max) return `카드를 ${p.min === p.max ? p.min : `${p.min}~${p.max}`}장 선택하세요.`;
      if (p.budget != null) {
        const cost = value.reduce((s, id) => s + POWER_MAP[id].cost, 0);
        if (cost > p.budget) return `에너지가 부족합니다 (필요 ${cost}, 보유 ${p.budget}).`;
      }
    }
    stack.pop();
    this.changed();
    top.resolve(value);
    return null;
  }

  askOption(pid, title, options, extra = {}) {
    return this.ask(pid, { type: 'option', title, options, ...extra });
  }

  async askLand(pid, title, options, cancel = false, notes = {}, extra = {}) {
    if (!options.length) return null;
    return this.ask(pid, { type: 'land', title, options, cancel, notes, ...extra });
  }

  // ───────────── 조각/지역 조회 ─────────────
  count(landId, type) {
    const l = this.lands[landId];
    switch (type) {
      case 'explorer': return l.explorers;
      case 'town': return l.towns.length;
      case 'city': return l.cities.length;
      case 'dahan': return l.dahan.length;
      case 'blight': return l.blight;
      default: return 0;
    }
  }

  invaderCount(landId) { const l = this.lands[landId]; return l.explorers + l.towns.length + l.cities.length; }
  townCityCount(landId) { const l = this.lands[landId]; return l.towns.length + l.cities.length; }
  totalInvaders() { return Object.keys(this.lands).reduce((s, id) => s + this.invaderCount(id), 0); }

  presenceCount(pid, landId) { return this.lands[landId].presence[pid] || 0; }
  presenceLands(pid) { return Object.keys(this.lands).filter((id) => this.presenceCount(pid, id) > 0); }
  anyPresence(landId) { return Object.values(this.lands[landId].presence).some((n) => n > 0); }
  isSacred(pid, landId) {
    const n = this.presenceCount(pid, landId);
    if (n >= 2) return true;
    const st = this.spiritDef(pid).sacredTerrain;
    return n >= 1 && !!st && st.includes(this.lands[landId].terrain);
  }
  sacredLands(pid) { return Object.keys(this.lands).filter((id) => this.isSacred(pid, id)); }
  islandPresence(pid) { return Object.keys(this.lands).reduce((s, id) => s + this.presenceCount(pid, id), 0); }

  landsWithinRange(sources, range) {
    const dist = {};
    const queue = [];
    for (const s of sources) { dist[s] = 0; queue.push(s); }
    while (queue.length) {
      const cur = queue.shift();
      if (dist[cur] >= range) continue;
      for (const nb of this.lands[cur].adj) {
        if (dist[nb] === undefined) { dist[nb] = dist[cur] + 1; queue.push(nb); }
      }
    }
    return Object.keys(dist);
  }

  landMatches(landId, filter) {
    const l = this.lands[landId];
    switch (filter) {
      case 'any': return true;
      case 'dahan': return l.dahan.length > 0;
      case 'invaders': return this.invaderCount(landId) > 0;
      case 'noinvaders': return this.invaderCount(landId) === 0;
      case 'blight': return l.blight > 0;
      case 'noblight': return l.blight === 0;
      case 'coastal': return l.coastal;
      case 'inland': return !l.coastal;
      default: return filter.split('/').includes(l.terrain);
    }
  }

  // ───────────── 원소 / 트랙 ─────────────
  elements(pid) {
    const s = this.spirits[pid];
    const el = {};
    for (const p of s.played) for (const e of POWER_MAP[p.id].elements) el[e] = (el[e] || 0) + 1;
    for (const [e, n] of Object.entries(s.bonusElements)) el[e] = (el[e] || 0) + n;
    return el;
  }

  meets(pid, req) {
    const el = this.elements(pid);
    return Object.entries(req).every(([e, n]) => (el[e] || 0) >= n);
  }

  energyPerTurn(pid) {
    const s = this.spirits[pid];
    const def = this.spiritDef(pid);
    let e = def.energyTrack[s.energyRevealed - 1] + (def.energyBonus || 0) + ((this.diff && this.diff.turnEnergy) || 0);
    if (def.energyPerSacred) e += Math.min(3, this.sacredLands(pid).length);
    return e;
  }
  cardPlays(pid) { const s = this.spirits[pid]; const def = this.spiritDef(pid); return def.cardTrack[s.cardRevealed - 1] + (def.extraCard || 0); }

  /** 정령 특성 bonusWhere 가 이 지역에 해당하는지 */
  bonusApplies(where, landId) {
    if (!where) return false;
    const l = this.lands[landId];
    switch (where) {
      case 'any': return true;
      case 'coastal': return l.coastal;
      case 'inland': return !l.coastal;
      case 'blight': return l.blight > 0;
      case 'dahan': return l.dahan.length > 0;
      default: return where.split('/').includes(l.terrain);
    }
  }

  gainEnergy(pid, n) {
    this.spirits[pid].energy += n;
    this.log(`${this.pname(pid)}: 에너지 +${n}`);
  }

  // ───────────── 조각 조작 ─────────────
  addPieces(landId, type, n = 1) {
    const l = this.lands[landId];
    for (let i = 0; i < n; i++) {
      if (type === 'explorer') l.explorers++;
      else if (type === 'town') l.towns.push(HP.town);
      else if (type === 'city') l.cities.push(HP.city);
      else if (type === 'dahan') l.dahan.push(HP.dahan);
    }
    this.changed();
  }

  /** 조각 하나를 꺼낸다 (체력 반환). 없으면 null */
  takePiece(landId, type) {
    const l = this.lands[landId];
    if (type === 'explorer') { if (!l.explorers) return null; l.explorers--; return 1; }
    const arr = type === 'town' ? l.towns : type === 'city' ? l.cities : type === 'dahan' ? l.dahan : null;
    if (!arr || !arr.length) return null;
    // 손상된 조각부터 꺼낸다
    let idx = 0;
    for (let i = 1; i < arr.length; i++) if (arr[i] < arr[idx]) idx = i;
    return arr.splice(idx, 1)[0];
  }

  putPiece(landId, type, hp) {
    const l = this.lands[landId];
    if (type === 'explorer') l.explorers++;
    else if (type === 'town') l.towns.push(hp);
    else if (type === 'city') l.cities.push(hp);
    else if (type === 'dahan') l.dahan.push(hp);
  }

  movePiece(from, to, type) {
    const hp = this.takePiece(from, type);
    if (hp == null) return false;
    this.putPiece(to, type, hp);
    this.changed();
    return true;
  }

  /** 제거 (공포 없음) */
  removePieces(landId, type, n = 1) {
    let k = 0;
    for (let i = 0; i < n; i++) { if (this.takePiece(landId, type) == null) break; k++; }
    if (k) { this.log(`${landId}: ${PIECE_NAMES[type]} ${k}개 제거`); this.checkVictory(); }
    return k;
  }

  /** 파괴 (마을 공포 1, 도시 공포 2) */
  destroyPiece(landId, type, quiet = false) {
    if (this.takePiece(landId, type) == null) return false;
    if (!quiet) this.log(`${landId}: ${PIECE_NAMES[type]} 파괴`);
    if (type === 'town') this.addFear(1);
    else if (type === 'city') this.addFear(2);
    this.checkVictory();
    return true;
  }

  /** 지정 종류 중 가치가 높은 것부터 n개 파괴 */
  destroyInvaders(landId, types, n) {
    let k = 0;
    const order = [...types].sort((a, b) => (TIER[b] || 0) - (TIER[a] || 0));
    for (let i = 0; i < n; i++) {
      const t = order.find((ty) => this.count(landId, ty) > 0);
      if (!t) break;
      this.destroyPiece(landId, t);
      k++;
    }
    return k;
  }

  destroyAllOf(landId, types) {
    let k = 0;
    for (const t of types) while (this.count(landId, t) > 0) { this.destroyPiece(landId, t); k++; }
    return k;
  }

  /** 침략자에게 피해 n. 효율적으로 자동 배분. */
  damageInvaders(landId, n, types = ['explorer', 'town', 'city']) {
    const l = this.lands[landId];
    const destroyed = { explorer: 0, town: 0, city: 0 };
    let dmg = n;
    if (dmg > 0 && this.invaderCount(landId)) this.log(`${landId}: 침략자에게 피해 ${n}`);
    while (dmg > 0) {
      const pieces = [];
      if (types.includes('city')) l.cities.forEach((hp, i) => pieces.push({ t: 'city', i, hp }));
      if (types.includes('town')) l.towns.forEach((hp, i) => pieces.push({ t: 'town', i, hp }));
      if (l.explorers && types.includes('explorer')) pieces.push({ t: 'explorer', i: 0, hp: 1 });
      if (!pieces.length) break;
      const killable = pieces.filter((p) => p.hp <= dmg).sort((a, b) => TIER[b.t] - TIER[a.t] || a.hp - b.hp);
      if (killable.length) {
        const p = killable[0];
        dmg -= p.hp;
        if (p.t === 'explorer') l.explorers--; else (p.t === 'town' ? l.towns : l.cities).splice(p.i, 1);
        destroyed[p.t]++;
        this.log(`${landId}: ${PIECE_NAMES[p.t]} 파괴`);
        if (p.t === 'town') this.addFear(1);
        if (p.t === 'city') this.addFear(2);
      } else {
        const p = pieces.sort((a, b) => a.hp - b.hp)[0];
        (p.t === 'town' ? l.towns : l.cities)[p.i] -= dmg;
        dmg = 0;
      }
    }
    this.changed();
    this.checkVictory();
    return { destroyed, count: destroyed.explorer + destroyed.town + destroyed.city };
  }

  /** 지정 종류의 모든 침략자에게 각각 피해 n */
  damageEach(landId, n, types) {
    const l = this.lands[landId];
    let fear = 0;
    let k = 0;
    if (types.includes('explorer') && n >= 1) { k += l.explorers; l.explorers = 0; }
    for (const t of ['town', 'city']) {
      if (!types.includes(t)) continue;
      const arr = t === 'town' ? l.towns : l.cities;
      for (let i = arr.length - 1; i >= 0; i--) {
        arr[i] -= n;
        if (arr[i] <= 0) { arr.splice(i, 1); k++; fear += t === 'town' ? 1 : 2; }
      }
    }
    this.log(`${landId}: 각 침략자에게 피해 ${n} (파괴 ${k})`);
    if (fear) this.addFear(fear);
    this.changed();
    this.checkVictory();
    return k;
  }

  /** 서로 다른 침략자 k개에게 각각 피해 n */
  damageDifferent(landId, k, n) {
    const l = this.lands[landId];
    const pieces = [];
    l.cities.forEach((hp, i) => pieces.push({ t: 'city', i, hp }));
    l.towns.forEach((hp, i) => pieces.push({ t: 'town', i, hp }));
    for (let i = 0; i < l.explorers; i++) pieces.push({ t: 'explorer', i, hp: 1 });
    pieces.sort((a, b) => ((b.hp <= n) - (a.hp <= n)) || TIER[b.t] - TIER[a.t]);
    const chosen = pieces.slice(0, k);
    let fear = 0;
    let destroyedExplorers = 0;
    for (const t of ['city', 'town']) {
      const arr = t === 'town' ? l.towns : l.cities;
      const idxs = chosen.filter((p) => p.t === t).map((p) => p.i).sort((a, b) => b - a);
      for (const i of idxs) {
        arr[i] -= n;
        if (arr[i] <= 0) { arr.splice(i, 1); fear += t === 'town' ? 1 : 2; }
      }
    }
    destroyedExplorers = chosen.filter((p) => p.t === 'explorer').length;
    l.explorers -= destroyedExplorers;
    this.log(`${landId}: 침략자 ${chosen.length}개에게 각각 피해 ${n}`);
    if (fear) this.addFear(fear);
    this.changed();
    this.checkVictory();
  }

  damageDahan(landId, n) {
    const l = this.lands[landId];
    let dmg = n;
    let killed = 0;
    l.dahan.sort((a, b) => a - b);
    while (dmg > 0 && l.dahan.length) {
      if (l.dahan[0] <= dmg) { dmg -= l.dahan[0]; l.dahan.shift(); killed++; } else { l.dahan[0] -= dmg; dmg = 0; }
    }
    if (killed) this.log(`${landId}: 다한 ${killed}개 파괴`);
    this.changed();
    return killed;
  }

  destroyDahan(landId, n) {
    const l = this.lands[landId];
    const k = Math.min(n, l.dahan.length);
    l.dahan.splice(0, k);
    if (k) this.log(`${landId}: 다한 ${k}개 파괴`);
    this.changed();
    return k;
  }

  // ───────────── 공포 / 황폐 ─────────────
  addFear(n) {
    for (let i = 0; i < n; i++) {
      this.fear.generated++;
      if (this.fear.generated >= this.fear.poolSize) {
        this.fear.generated = 0;
        const card = this.fear.deck.shift();
        if (card) {
          this.fear.earned.push(card);
          this.fear.earnedTotal++;
          this.log(`★ 공포 카드 획득! (총 ${this.fear.earnedTotal}장, 공포 단계 ${this.terrorLevel()})`);
        }
        if (!this.fear.deck.length) this.endGame(true, '공포 카드를 모두 획득했습니다. 침략자들이 섬을 버리고 떠납니다!');
      }
    }
    this.changed();
    this.checkVictory();
  }

  terrorLevel() {
    const e = this.fear.earnedTotal;
    const t = this.fear.total || 9;
    return e >= Math.round((2 * t) / 3) ? 3 : e >= Math.round(t / 3) ? 2 : 1;
  }

  takeBlightFromPool() {
    if (this.blight.pool <= 0 && this.diff.noLose) {
      if (!this.blight.warned) { this.blight.warned = true; this.log('⚠ 황폐 카드가 비었습니다! (체험 모드라 지지 않고 계속합니다. 실제 게임이라면 위험한 상황이에요)'); }
      return;
    }
    if (this.blight.pool <= 0) {
      if (!this.blight.flipped) {
        this.blight.flipped = true;
        this.blight.pool = 5 * this.players.length;
        this.log('⚠ 황폐 카드가 비었습니다! "황폐해진 섬" 면으로 뒤집습니다. 다시 비면 패배합니다.');
      } else {
        this.endGame(false, '황폐가 섬 전체를 뒤덮었습니다. (황폐 카드 고갈)');
      }
    }
    this.blight.pool--;
  }

  addBlight(landId, depth = 0) {
    const l = this.lands[landId];
    // 만연한 초록: 황폐 대신 존재 1개 파괴
    for (const pid of this.playerIds) {
      if (this.spiritDef(pid).blightShield && this.presenceCount(pid, landId) > 0 && this.islandPresence(pid) >= 2) {
        this.log(`${this.pname(pid)}: 땅을 뒤덮는 초록 — ${landId}에 황폐 대신 존재 1개가 희생됩니다`);
        this.destroyPresence(pid, landId, 1, '황폐를 대신 받음');
        this.events.push({ landId, kind: 'shield' });
        return;
      }
    }
    const had = l.blight > 0;
    this.takeBlightFromPool();
    l.blight++;
    this.log(`${landId}: 황폐 추가`);
    this.events.push({ landId, kind: 'blight' });
    for (const pid of this.playerIds) {
      if (this.spiritDef(pid).blightFear && this.presenceCount(pid, landId) > 0) { this.log(`${this.pname(pid)}: 땅의 복수 — 공포 +1`); this.addFear(1); }
    }
    for (const pid of this.playerIds) {
      if (this.presenceCount(pid, landId) > 0 && !this.spiritDef(pid).blightImmune) {
        if (this.diff.presenceSafe) this.log(`${this.pname(pid)}: ${landId}의 존재는 쉬운 난이도라 황폐로 파괴되지 않습니다 (원래 규칙: 존재 1개 파괴)`);
        else this.destroyPresence(pid, landId, 1, '황폐');
      }
    }
    if (had && this.diff.noCascade) this.log(`${landId}: 이미 황폐가 있던 곳이지만, 쉬운 난이도라 황폐가 번지지 않습니다 (원래 규칙: 옆 지역으로 번짐)`);
    else if (had && depth < 20) {
      const target = [...l.adj].sort((a, b) => this.lands[a].blight - this.lands[b].blight || a.localeCompare(b))[0];
      if (target) {
        this.log(`${landId}: 황폐가 ${target}(으)로 번집니다!`);
        this.addBlight(target, depth + 1);
      }
    }
    this.changed();
  }

  removeBlight(landId) {
    const l = this.lands[landId];
    if (!l.blight) return false;
    l.blight--;
    this.blight.pool++;
    this.log(`${landId}: 황폐 제거`);
    this.changed();
    return true;
  }

  destroyPresence(pid, landId, n, why = '') {
    const cur = this.presenceCount(pid, landId);
    const k = Math.min(cur, n);
    if (!k) return;
    this.lands[landId].presence[pid] = cur - k;
    this.spirits[pid].destroyed += k;
    this.log(`${this.pname(pid)}: ${landId}의 존재 ${k}개 파괴${why ? ` (${why})` : ''}`);
    if (this.spiritDef(pid).erupts && this.invaderCount(landId)) {
      this.log(`🌋 ${this.pname(pid)}: 분출! ${landId}에 피해 ${2 * k}`);
      this.damageInvaders(landId, 2 * k);
    }
    if (this.islandPresence(pid) === 0 && !this.diff.noLose) this.endGame(false, `${this.pname(pid)}의 존재가 섬에서 모두 사라졌습니다.`);
  }

  // ───────────── 승패 ─────────────
  endGame(win, reason) {
    if (this.result) throw new GameOver(this.result.win, this.result.reason);
    this.result = { win, reason, turn: this.turn };
    this.phase = 'end';
    this.log(win ? `🎉 승리! ${reason}` : `💀 패배... ${reason}`);
    for (const pid of Object.keys(this.prompts)) this.prompts[pid] = [];
    this.changed();
    throw new GameOver(win, reason);
  }

  checkVictory() {
    if (this.result || this.phase === 'setup') return;
    const tl = this.terrorLevel();
    const lands = Object.values(this.lands);
    const towns = lands.reduce((s, l) => s + l.towns.length, 0);
    const cities = lands.reduce((s, l) => s + l.cities.length, 0);
    const explorers = lands.reduce((s, l) => s + l.explorers, 0);
    if (tl === 1 && towns + cities + explorers === 0) this.endGame(true, '섬에 침략자가 하나도 남지 않았습니다! (공포 단계 1)');
    if (tl === 2 && towns + cities === 0) this.endGame(true, '섬에 마을과 도시가 남지 않았습니다! (공포 단계 2)');
    if (tl === 3 && cities === 0) this.endGame(true, '섬에 도시가 남지 않았습니다! (공포 단계 3)');
  }

  // ───────────── 이동(밀어내기/모으기) ─────────────
  async push(pid, landId, types, max, { upTo = true } = {}) {
    const moved = [];
    for (let i = 0; i < max; i++) {
      const avail = types.filter((t) => this.count(landId, t) > 0);
      if (!avail.length) break;
      const dests = this.lands[landId].adj;
      if (!dests.length) break;
      let type = avail[0];
      const opts = avail.map((t) => ({ value: t, label: `${PIECE_NAMES[t]} 밀어내기` }));
      if (upTo) opts.push({ value: '__stop', label: '그만 밀어내기' });
      if (opts.length > 1) type = await this.askOption(pid, `${landId}에서 밀어낼 조각 선택 (${i + 1}/${max === 99 ? '∞' : max})`, opts, { focus: [landId], kind: 'push' });
      if (type === '__stop') break;
      const dest = dests.length === 1 ? dests[0] : await this.askLand(pid, `${PIECE_NAMES[type]}을(를) ${landId}에서 어디로 밀어낼까요?`, dests, false, {}, { focus: [landId], kind: 'push' });
      this.movePiece(landId, dest, type);
      this.log(`${landId} → ${dest}: ${PIECE_NAMES[type]} 밀어냄`);
      moved.push({ type, to: dest });
    }
    return moved;
  }

  async gather(pid, landId, types, max, { upTo = true } = {}) {
    const moved = [];
    for (let i = 0; i < max; i++) {
      const sources = this.lands[landId].adj.filter((a) => types.some((t) => this.count(a, t) > 0));
      if (!sources.length) break;
      const typeLabel = types.map((t) => PIECE_NAMES[t]).join('/');
      const src = await this.askLand(pid, `${landId}(으)로 ${typeLabel}을(를) 모을 지역 선택 (${i + 1}/${max})${upTo ? ' — 취소 시 그만' : ''}`, sources, upTo, {}, { focus: [landId], kind: 'gather' });
      if (!src) break;
      const avail = types.filter((t) => this.count(src, t) > 0);
      let type = avail[0];
      if (avail.length > 1) type = await this.askOption(pid, `${src}에서 무엇을 모을까요?`, avail.map((t) => ({ value: t, label: PIECE_NAMES[t] })), { kind: 'gather' });
      this.movePiece(src, landId, type);
      this.log(`${src} → ${landId}: ${PIECE_NAMES[type]} 모음`);
      moved.push({ type, from: src });
    }
    return moved;
  }

  // ───────────── 존재 추가 ─────────────
  async placePresence(pid, landId) {
    const s = this.spirits[pid];
    const def = this.spiritDef(pid);
    const opts = [];
    if (s.energyRevealed < def.energyTrack.length) opts.push({ value: 'energy', label: `에너지 트랙 (→ 턴당 에너지 ${def.energyTrack[s.energyRevealed]})` });
    if (s.cardRevealed < def.cardTrack.length) opts.push({ value: 'card', label: `카드 트랙 (→ 카드 ${def.cardTrack[s.cardRevealed]}장)` });
    if (s.destroyed > 0) opts.push({ value: 'destroyed', label: `파괴된 존재 (${s.destroyed}개)` });
    if (!opts.length) { this.log(`${this.pname(pid)}: 추가할 존재가 없습니다.`); return false; }
    const src = opts.length === 1 ? opts[0].value : await this.askOption(pid, `${landId}에 놓을 존재를 어디서 가져올까요?`, opts, { kind: 'presenceSource', focus: [landId] });
    if (src === 'energy') s.energyRevealed++;
    else if (src === 'card') s.cardRevealed++;
    else s.destroyed--;
    const l = this.lands[landId];
    l.presence[pid] = (l.presence[pid] || 0) + 1;
    this.log(`${this.pname(pid)}: ${landId}에 존재 추가`);
    return true;
  }

  // ───────────── 권능 카드 획득 ─────────────
  drawFrom(kind, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      if (!this.decks[kind].length) {
        this.decks[kind] = this.shuffle(this.decks[kind + 'Discard']);
        this.decks[kind + 'Discard'] = [];
      }
      if (!this.decks[kind].length) break;
      out.push(this.decks[kind].shift());
    }
    return out;
  }

  async gainPowerCard(pid, forceKind = null) {
    const kind = forceKind || await this.askOption(pid, '어떤 권능 카드를 얻을까요?', [
      { value: 'minor', label: '소형 권능 (4장 중 1장)' },
      { value: 'major', label: '대형 권능 (4장 중 1장, 카드 1장을 잊어야 함)' },
    ], { kind: 'gainKind' });
    const drawn = this.drawFrom(kind, this.spiritDef(pid).cardDraw || 4);
    if (!drawn.length) return;
    const [pick] = await this.ask(pid, { type: 'cards', title: `${kind === 'minor' ? '소형' : '대형'} 권능 카드 ${drawn.length}장 중 1장을 고르세요`, cards: drawn, min: 1, max: 1, kind: 'pickCard' });
    this.decks[kind + 'Discard'].push(...drawn.filter((c) => c !== pick));
    const s = this.spirits[pid];
    s.hand.push(pick);
    this.log(`${this.pname(pid)}: 권능 카드 [${POWER_MAP[pick].name}] 획득`);
    if (kind === 'major') {
      const all = [...s.hand.filter((c) => c !== pick), ...s.discard, ...s.played.map((p) => p.id)];
      if (all.length) {
        const [f] = await this.ask(pid, { type: 'cards', title: '대형 권능을 얻었습니다. 잊을(영구 제거) 카드 1장을 고르세요', cards: all, min: 1, max: 1, kind: 'forget' });
        this.forgetCard(pid, f);
      }
    }
  }

  forgetCard(pid, cardId) {
    const s = this.spirits[pid];
    for (const key of ['hand', 'discard']) {
      const i = s[key].indexOf(cardId);
      if (i >= 0) { s[key].splice(i, 1); s.forgotten.push(cardId); this.log(`${this.pname(pid)}: [${POWER_MAP[cardId].name}] 카드를 잊었습니다`); return; }
    }
    const pi = s.played.findIndex((p) => p.id === cardId);
    if (pi >= 0) { s.played.splice(pi, 1); s.forgotten.push(cardId); this.log(`${this.pname(pid)}: [${POWER_MAP[cardId].name}] 카드를 잊었습니다`); }
  }

  // ───────────── 공포 카드용 헬퍼 ─────────────
  addTurnRule(kind, test, text) {
    this.turnRules.push({ kind, test, text });
    this.log(`이번 턴 규칙: ${text}`);
  }

  async eachPlayerRemoves(types, n, filter, desc) {
    await Promise.all(this.playerIds.map(async (pid) => {
      const opts = Object.values(this.lands).filter((l) => filter(l, pid) && types.some((t) => this.count(l.id, t) > 0)).map((l) => l.id);
      if (!opts.length) return;
      const typeLabel = types.map((t) => PIECE_NAMES[t]).join('/');
      const land = await this.askLand(pid, `공포: ${desc} 지역에서 ${typeLabel} ${n}개 제거 — 지역 선택`, opts, false, {}, { kind: 'fear' });
      for (let i = 0; i < n; i++) {
        const avail = types.filter((t) => this.count(land, t) > 0);
        if (!avail.length) break;
        const t = avail.length === 1 ? avail[0] : await this.askOption(pid, `${land}에서 무엇을 제거할까요?`, avail.map((x) => ({ value: x, label: PIECE_NAMES[x] })));
        this.removePieces(land, t, 1);
      }
    }));
  }

  async eachPlayerRemovesTwoOrTown(filter, desc) {
    await Promise.all(this.playerIds.map(async (pid) => {
      const opts = Object.values(this.lands).filter((l) => filter(l, pid) && (l.explorers || l.towns.length)).map((l) => l.id);
      if (!opts.length) return;
      const land = await this.askLand(pid, `공포: ${desc} 지역에서 탐험가 2개 또는 마을 1개 제거 — 지역 선택`, opts, false, {}, { kind: 'fear' });
      const o = [];
      if (this.count(land, 'explorer')) o.push({ value: 'e', label: '탐험가 2개 제거' });
      if (this.count(land, 'town')) o.push({ value: 't', label: '마을 1개 제거' });
      const c = o.length === 1 ? o[0].value : await this.askOption(pid, '무엇을 제거할까요?', o);
      if (c === 'e') this.removePieces(land, 'explorer', 2); else this.removePieces(land, 'town', 1);
    }));
  }

  async eachPlayerPushes(types, n, filter, desc) {
    await Promise.all(this.playerIds.map(async (pid) => {
      const opts = Object.values(this.lands).filter((l) => filter(l, pid) && types.some((t) => this.count(l.id, t) > 0)).map((l) => l.id);
      if (!opts.length) return;
      const land = await this.askLand(pid, `공포: ${desc} 지역에서 밀어내기 — 지역 선택 (취소 가능)`, opts, true, {}, { kind: 'fear' });
      if (land) await this.push(pid, land, types, n, { upTo: true });
    }));
  }

  async eachPlayerReplaces(filter, types, desc) {
    await Promise.all(this.playerIds.map(async (pid) => {
      const opts = Object.values(this.lands).filter((l) => filter(l, pid) && types.some((t) => this.count(l.id, t) > 0)).map((l) => l.id);
      if (!opts.length) return;
      const land = await this.askLand(pid, `공포: ${desc} 지역에서 교체 — 지역 선택 (취소 가능)`, opts, true, {}, { kind: 'fear' });
      if (!land) return;
      const avail = types.filter((t) => this.count(land, t) > 0);
      // 다른 플레이어가 같은 지역을 먼저 골라 이미 교체했을 수 있음
      if (!avail.length) { this.log(`${land}: 교체할 침략자가 이미 없습니다`); return; }
      const t = avail.length === 1 ? avail[0] : await this.askOption(pid, '무엇을 교체할까요?', avail.map((x) => ({ value: x, label: x === 'city' ? '도시 → 마을' : '마을 → 탐험가' })));
      this.replacePiece(land, t, t === 'city' ? 'town' : 'explorer');
    }));
  }

  replacePiece(landId, from, to) {
    if (this.takePiece(landId, from) == null) return false;
    this.addPieces(landId, to, 1);
    this.log(`${landId}: ${PIECE_NAMES[from]} → ${PIECE_NAMES[to]} 교체`);
    this.checkVictory();
    return true;
  }

  // ───────────── 권능 사용 ─────────────
  makeCtx(pid, power, landId, targetPid) {
    const g = this;
    const def = this.spiritDef(pid);
    // 꿈과 악몽: 피해/파괴 대신 공포 (최대 8)
    const dream = (f) => {
      const n = Math.min(8, f);
      if (n > 0) { g.log(`꿈의 세계: 침략자가 악몽에 시달립니다 — 공포 +${n}`); g.addFear(n); }
      return { count: 0, destroyed: { explorer: 0, town: 0, city: 0 } };
    };
    const invaderHp = (types = ['explorer', 'town', 'city']) => {
      const l = g.lands[landId];
      return (types.includes('explorer') ? l.explorers : 0) + (types.includes('town') ? l.towns.reduce((a, b) => a + b, 0) : 0) + (types.includes('city') ? l.cities.reduce((a, b) => a + b, 0) : 0);
    };
    const ctx = {
      game: g,
      pid,
      spirit: g.spirits[pid],
      power,
      landId,
      land: landId ? g.lands[landId] : null,
      targetPid,
      target: targetPid ? g.spirits[targetPid] : null,
      targetName: targetPid ? g.pname(targetPid) : '',
      log: (m) => g.log(m),
      has: (req) => g.meets(pid, req),
      threshold: () => {
        if (!power.threshold) return false;
        const ok = g.meets(pid, power.threshold.el);
        if (ok) g.log(`[${power.name}] 원소 조건 달성!`);
        return ok;
      },
      count: (t) => g.count(landId, t),
      invaderCount: () => g.invaderCount(landId),
      terrainIs: (...ts) => ts.includes(g.lands[landId].terrain),
      hasPresence: () => g.presenceCount(pid, landId) > 0,
      damage: (n, types) => {
        if (n <= 0) return { count: 0, destroyed: { explorer: 0, town: 0, city: 0 } };
        // 바다(해안) / 들불(황폐 지역): 권능마다 한 번 피해 +1
        if (!ctx.bonusUsed && g.bonusApplies(def.bonusWhere, landId)) {
          ctx.bonusUsed = true; n += 1; g.log(`${def.special.name}: 피해 +1`);
        }
        if (def.dreamer) return dream(Math.min(n, invaderHp(types)));
        return g.damageInvaders(landId, n, types);
      },
      damageEach: (n, types) => {
        if (def.dreamer) { dream(types.reduce((a, t) => a + g.count(landId, t), 0)); return 0; }
        return g.damageEach(landId, n, types);
      },
      destroy: (types, n) => {
        if (def.dreamer) {
          let f = 0; let k = 0;
          const order = [...types].sort((a, b) => (TIER[b] || 0) - (TIER[a] || 0));
          const left = Object.fromEntries(order.map((t) => [t, g.count(landId, t)]));
          for (let i = 0; i < n; i++) { const t = order.find((x) => left[x] > 0); if (!t) break; left[t]--; f += TIER[t]; k++; }
          dream(f);
          return 0;
        }
        return g.destroyInvaders(landId, types, n);
      },
      destroyAll: (types) => {
        if (def.dreamer) { dream(types.reduce((a, t) => a + g.count(landId, t) * (TIER[t] || 1), 0)); return 0; }
        return g.destroyAllOf(landId, types);
      },
      destroyDahan: (n) => g.destroyDahan(landId, n),
      push: (types, n, upTo = true) => g.push(pid, landId, types, n, { upTo }),
      gather: (types, n, upTo = true) => g.gather(pid, landId, types, n, { upTo }),
      fear: (n) => { g.log(`공포 +${n}`); g.addFear(n); },
      defend: (n) => { g.lands[landId].defend += n; g.log(`${landId}: 방어 ${n}`); g.changed(); },
      add: (t, n) => { g.addPieces(landId, t, n); g.log(`${landId}: ${PIECE_NAMES[t]} ${n}개 추가`); },
      replace: (from, to) => g.replacePiece(landId, from, to),
      addBlight: () => g.addBlight(landId),
      removeBlight: () => g.removeBlight(landId),
      skipActions: () => { g.lands[landId].flags.skipAll = true; g.log(`${landId}: 이번 턴 침략자는 모든 행동을 건너뜁니다`); g.changed(); },
      gainEnergy: (n, who = pid) => g.gainEnergy(who, n),
      choose: (title, options) => g.askOption(pid, title, options),
      addPresence: () => g.placePresence(pid, landId),
    };
    return ctx;
  }

  /** 이 권능을 쓸 수 있는 대상이 있는지 */
  hasTarget(pid, power) {
    const t = power.target;
    if (t.kind !== 'land') return true;
    const sources = t.from === 'sacred' ? this.sacredLands(pid) : this.presenceLands(pid);
    if (this.landsWithinRange(sources, t.range + (this.spiritDef(pid).rangeBonus || 0)).some((id) => this.landMatches(id, t.filter))) return true;
    return !!(this.spiritDef(pid).dahanReach && this.spirits[pid].energy >= 1
      && Object.keys(this.lands).some((id) => this.lands[id].dahan.length > 0 && this.landMatches(id, t.filter)));
  }

  /** 대상 지역 선택. 반환: landId | null(취소) | false(대상 없음) */
  async chooseTargetLand(pid, power) {
    const t = power.target;
    const sources = t.from === 'sacred' ? this.sacredLands(pid) : this.presenceLands(pid);
    const inRange = this.landsWithinRange(sources, t.range + (this.spiritDef(pid).rangeBonus || 0)).filter((id) => this.landMatches(id, t.filter));
    const s = this.spirits[pid];
    const notes = {};
    let extra = [];
    if (this.spiritDef(pid).dahanReach && s.energy >= 1) {
      extra = Object.keys(this.lands).filter((id) => !inRange.includes(id) && this.lands[id].dahan.length > 0 && this.landMatches(id, t.filter));
      for (const id of extra) notes[id] = '에너지 1 지불 (다한의 그림자)';
    }
    const options = [...inRange, ...extra];
    if (!options.length) return false;
    const rangeText = `${t.from === 'sacred' ? '성지' : '존재'}에서 사거리 ${t.range}`;
    const choice = await this.askLand(pid, `[${power.name}] 대상 지역 선택 (${rangeText})`, options, true, notes, { kind: 'target', power: power.id || null });
    if (choice && extra.includes(choice)) {
      s.energy -= 1;
      this.log(`${this.pname(pid)}: 다한의 그림자 — 에너지 1을 지불하고 ${choice}을(를) 대상으로 합니다`);
    }
    return choice;
  }

  async chooseTargetSpirit(pid, power) {
    const f = power.target.filter;
    let opts = this.playerIds;
    if (f === 'other') opts = opts.filter((x) => x !== pid);
    if (f === 'self') opts = [pid];
    if (!opts.length) return false;
    if (opts.length === 1) return opts[0];
    return this.askOption(pid, `[${power.name}] 대상 정령 선택`, [...opts.map((x) => ({ value: x, label: this.pname(x) })), { value: '__cancel', label: '취소' }], { kind: 'targetSpirit' })
      .then((v) => (v === '__cancel' ? null : v));
  }

  /** 권능 하나를 해결. 성공 시 true, 취소/대상 없음 시 false */
  async resolvePower(pid, power, innateLevels = 0) {
    let landId = null;
    let targetPid = null;
    if (power.target.kind === 'land') {
      landId = await this.chooseTargetLand(pid, power);
      if (landId === false) { this.log(`[${power.name}]: 대상으로 삼을 수 있는 지역이 없습니다.`); return false; }
      if (landId === null) return false;
    } else {
      targetPid = await this.chooseTargetSpirit(pid, power);
      if (!targetPid) return false;
    }
    this.log(`▶ ${this.pname(pid)}: [${power.name}] 사용${landId ? ` → ${landId}` : ''}${targetPid && targetPid !== pid ? ` → ${this.pname(targetPid)}` : ''}`);
    const ctx = this.makeCtx(pid, power, landId, targetPid);
    if (innateLevels) await power.effect(ctx, innateLevels);
    else await power.effect(ctx);
    this.changed();
    return true;
  }

  innateLevels(pid, innate) {
    let n = 0;
    for (const lv of innate.levels) { if (this.meets(pid, lv.el)) n++; else break; }
    return n;
  }

  // ───────────── 게임 진행 ─────────────
  async run() {
    try {
      this.setup();
      while (!this.result) {
        this.turn++;
        this.log(`══════ ${this.turn}턴 시작 ══════`);
        await this.spiritPhase();
        await this.powerPhase('fast');
        await this.invaderPhase();
        await this.powerPhase('slow');
        this.timePasses();
      }
    } catch (e) {
      if (!(e instanceof GameOver)) {
        console.error(e);
        this.result = { win: false, reason: '서버 오류: ' + e.message, turn: this.turn };
        this.phase = 'end';
        this.changed();
      }
    }
    return this.result;
  }

  setup() {
    // 정령 초기 존재 배치
    for (const pid of this.playerIds) {
      const def = this.spiritDef(pid);
      const board = this.boardOf[pid];
      const boardLands = Object.values(this.lands).filter((l) => l.board === board);
      for (const rule of def.setup) {
        if (rule.mostDahan) {
          const top = [...boardLands].sort((a, b) => b.dahan.length - a.dahan.length || b.num - a.num).slice(0, rule.mostDahan);
          for (const l of top) l.presence[pid] = (l.presence[pid] || 0) + 1;
          continue;
        }
        let land;
        if (rule.num) land = boardLands.find((l) => l.num === rule.num);
        else land = boardLands.filter((l) => l.terrain === rule.terrain).sort((a, b) => b.num - a.num)[0];
        land.presence[pid] = (land.presence[pid] || 0) + rule.count;
        if (rule.blight) land.blight += rule.blight;
        // 트랙에서 존재를 꺼낸 것이 아니라 시작 존재로 취급
      }
    }
    for (const sp of this.diff.setupPieces) {
      for (const b of this.boardLetters) {
        const land = this.lands[b + sp.num];
        if (land) this.addPieces(land.id, sp.type, sp.count || 1);
      }
    }
    this.log(`게임 준비 완료 (난이도: ${this.diff.label}). 침략자들이 섬에 상륙합니다...`);
    // 첫 탐험
    const card = this.invader.deck.shift();
    this.log(`첫 탐험: [${invaderCardName(card)}]`);
    this.doExplore(card);
    this.invader.build = card;
    this.invader.lastExplore = card;
    this.phase = 'growth';
  }

  async spiritPhase() {
    this.phase = 'growth';
    for (const pid of this.playerIds) this.spirits[pid].status = '성장 선택 중';
    await Promise.all(this.playerIds.map((pid) => this.spiritPhaseFor(pid)));
  }

  async spiritPhaseFor(pid) {
    const s = this.spirits[pid];
    const def = this.spiritDef(pid);
    const opts = def.growth.map((g, i) => ({ value: String(i), label: g.actions.map(growthLabel).join(' + ') }));
    const gi = Number(await this.askOption(pid, '성장 단계: 성장 옵션을 하나 고르세요', opts, { kind: 'growth' }));
    s.growthChoice = gi;
    this.log(`${this.pname(pid)}: 성장 — ${opts[gi].label}`);
    for (const act of def.growth[gi].actions) await this.doGrowthAction(pid, act);
    const e = this.energyPerTurn(pid);
    s.energy += e;
    this.log(`${this.pname(pid)}: 에너지 +${e} (보유 ${s.energy})`);
    s.status = '권능 카드 선택 중';
    this.changed();
    const plays = this.cardPlays(pid);
    const chosen = await this.ask(pid, {
      type: 'cards', mode: 'play', kind: 'play', title: `사용할 권능 카드를 고르세요 (최대 ${plays}장, 에너지 ${s.energy})`,
      cards: [...s.hand], min: 0, max: plays, budget: s.energy,
    });
    for (const id of chosen) {
      s.hand.splice(s.hand.indexOf(id), 1);
      s.energy -= POWER_MAP[id].cost;
      s.played.push({ id, used: false });
    }
    this.log(`${this.pname(pid)}: 카드 ${chosen.length}장 사용 — ${chosen.map((c) => POWER_MAP[c].name).join(', ') || '없음'}`);
    if (this.spiritDef(pid).airFast) {
      const air = this.elements(pid).air || 0;
      if (air) { s.fastAllowance += air; this.log(`${this.pname(pid)}: 번개의 신속함 — 느린 권능 ${air}개를 빠르게 사용 가능`); }
    }
    s.status = '대기 중';
    this.changed();
  }

  async doGrowthAction(pid, act) {
    const s = this.spirits[pid];
    switch (act.type) {
      case 'reclaimAll':
        s.hand.push(...s.discard);
        if (s.discard.length) this.log(`${this.pname(pid)}: 버린 카드 ${s.discard.length}장 회수`);
        s.discard = [];
        break;
      case 'gainCard':
        await this.gainPowerCard(pid);
        break;
      case 'energy':
        s.energy += act.n;
        this.log(`${this.pname(pid)}: 에너지 +${act.n}`);
        break;
      case 'presence': {
        let opts = this.landsWithinRange(this.presenceLands(pid), act.range);
        if (this.spiritDef(pid).coastalOnly) opts = opts.filter((id) => this.lands[id].coastal);
        if (this.spiritDef(pid).inlandOnly) opts = opts.filter((id) => !this.lands[id].coastal);
        if (!opts.length) { this.log(`${this.pname(pid)}: 존재를 놓을 수 있는 지역이 없습니다`); break; }
        const land = await this.askLand(pid, `존재를 추가할 지역 선택 (존재에서 사거리 ${act.range})`, opts, false, {}, { kind: 'presenceLand' });
        await this.placePresence(pid, land);
        break;
      }
      default:
    }
  }

  availablePowers(pid, speed) {
    const s = this.spirits[pid];
    const out = [];
    s.played.forEach((p, idx) => {
      if (p.used) return;
      const c = POWER_MAP[p.id];
      if (!this.hasTarget(pid, c)) return;
      if (c.speed === speed) out.push({ value: `card:${idx}`, label: `${c.name} (${speedName(c.speed)})`, card: c.id });
      else if (speed === 'fast' && c.speed === 'slow' && s.fastAllowance > 0) out.push({ value: `card:${idx}`, label: `${c.name} (느림→빠르게)`, card: c.id, convert: true });
    });
    for (const inn of this.spiritDef(pid).innates) {
      if (s.innatesUsed[inn.id]) continue;
      const lv = this.innateLevels(pid, inn);
      if (!lv || !this.hasTarget(pid, inn)) continue;
      if (inn.speed === speed) out.push({ value: `innate:${inn.id}`, label: `${inn.name} (내재 권능 ${lv}단계)` });
      else if (speed === 'fast' && inn.speed === 'slow' && s.fastAllowance > 0) out.push({ value: `innate:${inn.id}`, label: `${inn.name} (내재 권능 ${lv}단계, 느림→빠르게)`, convert: true });
    }
    if (s.repeats.length) {
      const maxCost = Math.max(...s.repeats.map((r) => r.maxCost));
      s.played.forEach((p, idx) => {
        const c = POWER_MAP[p.id];
        if (c.speed === speed && c.cost <= maxCost && this.hasTarget(pid, c)) out.push({ value: `repeat:${idx}`, label: `${c.name} 반복 사용`, card: c.id });
      });
    }
    return out;
  }

  async powerPhase(speed) {
    this.phase = speed;
    this.log(`── ${speed === 'fast' ? '빠른' : '느린'} 권능 단계 ──`);
    for (const pid of this.playerIds) this.spirits[pid].status = '권능 사용 중';
    // 다른 정령이 '번개의 은총' 등으로 권능을 새로 쓸 수 있게 되면 그 정령의 차례가 다시 열릴 수 있으므로,
    // 모든 정령의 권능 사용이 끝날 때까지 기다린다.
    this.powerLoops = {};
    // 나중에 다시 열린 루프에서 게임이 끝나도(GameOver) 바로 전달되도록
    const abort = new Promise((_, reject) => { this.powerAbort = reject; });
    abort.catch(() => {});
    for (const pid of this.playerIds) this.powerLoops[pid] = this.startPowerLoop(pid, speed);
    for (;;) {
      const loops = Object.values(this.powerLoops);
      await Promise.race([Promise.all(loops), abort]);
      if (Object.values(this.powerLoops).every((l, i) => l === loops[i]) && Object.keys(this.powerLoops).length === loops.length) break;
    }
    this.powerLoops = null;
    this.powerAbort = null;
  }

  /** 느린 권능을 빠르게 쓸 수 있는 횟수 추가. 빠른 권능 단계라면 바로 쓸 수 있도록 선택지를 다시 열어 준다 */
  grantFastAllowance(pid, n) {
    const s = this.spirits[pid];
    s.fastAllowance += n;
    if (this.phase !== 'fast' || !this.powerLoops) return;
    const stack = this.prompts[pid] || [];
    const waiting = stack.findIndex((e) => e.prompt.kind === 'power');
    if (waiting >= 0) {
      // 권능 선택 창을 띄워 둔 상태 → 새 선택지로 다시 묻기
      const [entry] = stack.splice(waiting, 1);
      entry.resolve('__refresh');
      this.changed();
    } else if (this.powerLoopDone && this.powerLoopDone[pid]) {
      // 이미 빠른 권능 단계를 끝낸 정령 → 다시 열어 줌
      s.status = '권능 사용 중';
      this.powerLoops[pid] = this.startPowerLoop(pid, 'fast');
    }
  }

  /** 권능 루프 시작. 게임 종료(GameOver)로 끝나도 처리되지 않은 오류가 되지 않게 표시 (powerPhase에서 기다림) */
  startPowerLoop(pid, speed) {
    const p = this.powerLoop(pid, speed);
    p.catch((e) => { if (this.powerAbort) this.powerAbort(e); });
    return p;
  }

  async powerLoop(pid, speed) {
    const s = this.spirits[pid];
    (this.powerLoopDone ||= {})[pid] = false;
    for (;;) {
      const opts = this.availablePowers(pid, speed);
      if (!opts.length) break;
      opts.push({ value: 'done', label: `${speed === 'fast' ? '빠른' : '느린'} 권능 단계 종료` });
      const v = await this.askOption(pid, `${speed === 'fast' ? '빠른' : '느린'} 권능: 사용할 권능을 고르세요`, opts, { kind: 'power' });
      if (v === '__refresh') continue;
      if (v === 'done') break;
      const [kind, key] = v.split(':');
      const opt = opts.find((o) => o.value === v);
      if (kind === 'card' || kind === 'repeat') {
        const entry = s.played[Number(key)];
        const ok = await this.resolvePower(pid, POWER_MAP[entry.id]);
        if (ok) {
          if (kind === 'card') {
            entry.used = true;
            if (opt.convert) s.fastAllowance--;
          } else {
            const c = POWER_MAP[entry.id];
            const ri = s.repeats.findIndex((r) => r.maxCost >= c.cost);
            s.repeats.splice(ri, 1);
          }
        }
      } else if (kind === 'innate') {
        const inn = this.spiritDef(pid).innates.find((i) => i.id === key);
        const lv = this.innateLevels(pid, inn);
        const ok = await this.resolvePower(pid, inn, lv);
        if (ok) {
          s.innatesUsed[inn.id] = true;
          if (opt.convert) s.fastAllowance--;
        }
      }
    }
    s.status = '대기 중';
    this.powerLoopDone[pid] = true;
    this.changed();
  }

  skipAction(land, action) {
    if (land.flags.skipAll || land.flags['skip' + action]) return true;
    return this.turnRules.some((r) => r.kind === 'no' + action && r.test(land));
  }

  cardMatches(card, land) {
    return card.coastal ? land.coastal : card.terrains.includes(land.terrain);
  }

  pause(ms) { return ms > 0 && !this.result ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve(); }

  /** 침략자 단계의 현재 진행 상황을 화면에 알림 */
  async step(kind, card, lands, text, report = null) {
    const no = ++this.stepNo;
    this.invaderStep = { kind, card: card ? invaderCardName(card) : null, lands, text, report, no, manual: this.stepManual, acks: [] };
    this.changed();
    if (!this.stepManual || this.result) { await this.pause(this.stepDelay); return; }
    await new Promise((resolve) => {
      const timer = setTimeout(() => { this.stepWaiter = null; resolve(); }, this.stepMaxWait);
      this.stepWaiter = { no, done: () => { clearTimeout(timer); this.stepWaiter = null; resolve(); } };
    });
  }

  /** 침략자 단계 설명을 다 봤다고 알림. 모든 정령이 누르면 다음 단계로 */
  ackStep(pid, no) {
    const st = this.invaderStep;
    if (!st || !this.stepWaiter || st.no !== no || this.stepWaiter.no !== no || !this.playerIds.includes(pid)) return;
    if (!st.acks.includes(pid)) st.acks.push(pid);
    if (this.playerIds.every((id) => st.acks.includes(id))) this.stepWaiter.done();
    else this.changed();
  }

  /** 이번 턴 침략자가 행동할 지역 예보 */
  forecast() {
    const out = { ravage: [], build: [], exploreStage: this.invader.deck[0] ? this.invader.deck[0].stage : null };
    const d = this.diff;
    if (this.invader.ravage) out.ravage = Object.values(this.lands).filter((l) => this.cardMatches(this.invader.ravage, l) && this.invaderCount(l.id) > 0).map((l) => l.id);
    if (this.invader.build) {
      out.build = Object.values(this.lands).filter((l) => this.cardMatches(this.invader.build, l)
        && (this.invaderCount(l.id) > 0 || (d.buildAdjacent && l.adj.reduce((a, id) => a + this.townCityCount(id), 0) >= 2))).map((l) => l.id);
    }
    out.ravageInfo = {};
    for (const id of out.ravage) out.ravageInfo[id] = this.ravagePreview(this.lands[id]);
    return out;
  }

  async invaderPhase() {
    this.phase = 'invader';
    for (const pid of this.playerIds) this.spirits[pid].status = '대기 중';
    this.events = [];
    this.log('── 침략자 단계 ──');
    for (const pid of this.playerIds) {
      const def = this.spiritDef(pid);
      if (!def.fearPerSacred) continue;
      const n = Math.min(2, this.sacredLands(pid).filter((id) => this.invaderCount(id) > 0).length);
      if (n) { this.log(`${this.pname(pid)}: ${def.special.name} — 공포 +${n}`); this.addFear(n); }
    }
    // 공포 카드
    while (this.fear.earned.length) {
      const id = this.fear.earned.shift();
      const card = FEAR_CARDS.find((c) => c.id === id);
      const tl = this.terrorLevel();
      const lv = card.levels[tl - 1];
      this.log(`공포 카드 [${card.name}] (단계 ${tl}): ${lv.text}`);
      this.fear.resolved.push({ id, tl, turn: this.turn });
      this.fear.current = { id, name: card.name, tl, text: lv.text };
      await this.step('fear', null, [], `공포 카드 [${card.name}] (${tl}단계): ${lv.text}`);
      await lv.effect(this);
      this.fear.current = null;
    }
    // 약탈
    const fc = this.forecast();
    if (this.invader.ravage) {
      const card = this.invader.ravage;
      this.log(`약탈: [${invaderCardName(card)}]`);
      await this.step('ravage', card, fc.ravage, fc.ravage.length
        ? `${invaderCardName(card)} 지형에 있는 침략자들이 땅을 공격합니다. 침략자마다 공격력(탐험가 ${this.diff.explorerDamage}·마을 ${this.diff.townDamage}·도시 ${this.diff.cityDamage})을 모두 더하고 방어를 뺀 만큼 피해를 줍니다. 피해가 2 이상이면 황폐가 생기고, 피해는 다한에게도 가며, 살아남은 다한은 1명당 2씩 반격합니다. 지역마다 계산을 차례로 보여 줄게요.`
        : `${invaderCardName(card)} 지형에 침략자가 없어서 약탈이 일어나지 않습니다.`);
      for (const land of Object.values(this.lands)) {
        if (this.cardMatches(card, land)) await this.doRavage(land);
      }
    }
    // 건설
    if (this.invader.build) {
      const card = this.invader.build;
      this.log(`건설: [${invaderCardName(card)}]`);
      const d = this.diff;
      const targets = Object.values(this.lands).filter((land) => this.cardMatches(card, land)
        && (this.invaderCount(land.id) > 0 || (d.buildAdjacent && land.adj.reduce((a, id) => a + this.townCityCount(id), 0) >= 2)));
      await this.step('build', card, targets.map((l) => l.id), targets.length
        ? `${invaderCardName(card)} 지형 중 침략자가 있는 곳에 마을을 짓습니다 (마을이 도시보다 많으면 도시).`
        : `${invaderCardName(card)} 지형에 침략자가 없어서 건설하지 않습니다.`);
      for (const land of targets) {
        this.doBuild(land, true);
        if (d.buildTwice === 'all' || (d.buildTwice === 'coastal' && land.coastal)) this.doBuild(land, true);
      }
    }
    // 탐험
    if (!this.invader.deck.length) {
      if (this.diff.noLose) this.endGame(true, '체험 완료! 침략자 덱이 모두 끝날 때까지 섬을 지켰어요. 이제 "연습"이나 "입문" 난이도에 도전해 보세요.');
      this.endGame(false, '침략자 덱이 바닥났습니다. 시간이 다 되었습니다.');
    }
    const card = this.invader.deck.shift();
    this.log(`탐험: [${invaderCardName(card)}] (${card.stage}단계)`);
    const exploreTargets = Object.values(this.lands).filter((land) => this.cardMatches(card, land)
      && (land.coastal || this.townCityCount(land.id) || land.adj.some((a) => this.townCityCount(a) > 0))).map((l) => l.id);
    await this.step('explore', card, exploreTargets, `새 침략자 카드 [${invaderCardName(card)}]가 뒤집혔습니다. 이 지형 중 해안이거나 마을·도시가 있거나 그 옆인 곳에 탐험가가 도착합니다. 이 카드는 다음 턴 '건설', 그다음 턴 '약탈'로 이동합니다.`);
    this.doExplore(card);
    // 카드 전진
    if (this.invader.ravage) this.invader.discard.push(this.invader.ravage);
    this.invader.ravage = this.invader.build;
    this.invader.build = card;
    this.invader.lastExplore = card;
    await this.step('advance', null, [], '침략자 카드가 한 칸씩 이동했습니다: 탐험 → 건설 → 약탈. 위쪽 진행표에서 다음 턴에 어디가 위험한지 확인하세요.');
    this.invaderStep = null;
    this.changed();
  }

  /** 침략자·다한의 체력과 공격력 (난이도에 따라 공격력이 바뀜) */
  pieceStats() {
    const d = this.diff;
    return {
      explorer: { hp: HP.explorer, atk: d.explorerDamage }, town: { hp: HP.town, atk: d.townDamage },
      city: { hp: HP.city, atk: d.cityDamage }, dahan: { hp: HP.dahan, atk: 2 + (d.dahanCounterBonus || 0) },
    };
  }

  ravageDefend(land) {
    let defend = land.defend;
    for (const pid of this.playerIds) {
      const def = this.spiritDef(pid);
      if (def.sacredDefend && this.isSacred(pid, land.id)) defend += def.sacredDefend;
      if (def.presenceDefend) defend += def.presenceDefend * this.presenceCount(pid, land.id);
    }
    return defend;
  }

  counterBonusAt(land) {
    const here = this.playerIds.filter((pid) => this.presenceCount(pid, land.id) > 0);
    return Math.max(0, ...here.map((pid) => this.spiritDef(pid).counterBonus || 0));
  }

  /** 약탈 결과를 미리 계산 (상태를 바꾸지 않음) — 화면 예보와 설명용 */
  ravagePreview(land) {
    const st = this.pieceStats();
    const att = { explorer: land.explorers, town: land.towns.length, city: land.cities.length };
    const raw = att.explorer * st.explorer.atk + att.town * st.town.atk + att.city * st.city.atk;
    const out = { att, atk: { explorer: st.explorer.atk, town: st.town.atk, city: st.city.atk }, raw, defend: 0, dmg: 0, blight: 0,
      dahanBefore: land.dahan.length, dahanHp: [...land.dahan], dahanLost: 0, dahanLeft: land.dahan.length, dahanAtk: 2, counter: 0, killed: { explorer: 0, town: 0, city: 0 } };
    if (!this.invaderCount(land.id)) { out.none = true; return out; }
    if (this.skipAction(land, 'Ravage')) { out.skipped = true; return out; }
    const d = this.diff;
    const here = this.playerIds.filter((pid) => this.presenceCount(pid, land.id) > 0);
    const protectedDahan = land.flags.dahanProtected || here.some((pid) => this.spiritDef(pid).dahanShield);
    out.defend = this.ravageDefend(land);
    out.dahanAtk = 2 + this.counterBonusAt(land);
    out.dmg = Math.max(0, raw - out.defend);
    out.blight = out.dmg >= 2 ? (out.dmg >= 6 && d.heavyMining ? 2 : 1) : 0;
    out.dahanProtected = !!protectedDahan;
    out.ambush = !!land.flags.dahanAmbush;
    // 다한 피해: 체력이 낮은 다한부터 쓰러짐
    const hp = [...land.dahan].sort((x, y) => x - y);
    let left = out.dmg > 0 && !protectedDahan ? out.dmg + (d.ravageDahanBonus || 0) : 0;
    out.dahanDmg = left;
    while (left > 0 && hp.length) { if (hp[0] <= left) { left -= hp.shift(); out.dahanLost++; } else { hp[0] -= left; left = 0; } }
    out.dahanLeft = out.ambush ? land.dahan.length : hp.length;
    out.counter = out.dahanLeft * out.dahanAtk;
    // 반격으로 쓰러질 침략자 (큰 것부터 처치 가능한 만큼)
    let c = out.counter;
    const pcs = [...land.cities.map((h) => ['city', h]), ...land.towns.map((h) => ['town', h]), ...Array(land.explorers).fill(['explorer', 1])];
    for (;;) {
      const k = pcs.map((x, i) => [x, i]).filter(([x]) => x[1] <= c).sort((a, b2) => TIER[b2[0][0]] - TIER[a[0][0]] || a[0][1] - b2[0][1])[0];
      if (!k) break;
      c -= k[0][1]; out.killed[k[0][0]]++; pcs.splice(k[1], 1);
    }
    return out;
  }

  async doRavage(land) {
    if (!this.invaderCount(land.id)) return;
    if (this.skipAction(land, 'Ravage')) {
      this.log(`${land.id}: 약탈하지 않음`);
      await this.step('ravageLand', null, [land.id], `${land.id}: 권능 효과로 이번 턴 침략자가 약탈하지 않습니다.`, { landId: land.id, skipped: true });
      return;
    }
    const report = this.ravagePreview(land);
    report.landId = land.id;
    const defend = report.defend;
    const here = this.playerIds.filter((pid) => this.presenceCount(pid, land.id) > 0);
    const counterBonus = this.counterBonusAt(land);
    if (here.some((pid) => this.spiritDef(pid).dahanShield)) land.flags.dahanProtected = true;
    for (const pid of here) {
      const def = this.spiritDef(pid);
      if (def.ravageFear && (this.spirits[pid].ravageFearUsed || 0) < 2) {
        this.spirits[pid].ravageFearUsed = (this.spirits[pid].ravageFearUsed || 0) + 1;
        this.log(`${this.pname(pid)}: ${def.special.name} — 공포 +1`);
        this.addFear(1);
      }
    }
    if (land.flags.dahanAmbush && land.dahan.length) {
      const pre = land.dahan.length * (2 + counterBonus);
      this.log(`${land.id}: 다한의 선제 반격! 피해 ${pre}`);
      this.damageInvaders(land.id, pre);
      land.flags.dahanAmbushed = true;
    }
    const d = this.diff;
    let dmg = land.explorers * d.explorerDamage + d.townDamage * land.towns.length + d.cityDamage * land.cities.length;
    const raw = dmg;
    dmg = Math.max(0, dmg - defend);
    this.events.push({ landId: land.id, kind: 'ravage' });
    this.log(`${land.id}: 약탈! 공격력 합계 ${raw}${defend ? ` − 방어 ${defend}` : ''} = 땅에 피해 ${dmg}`);
    let blight = 0;
    if (dmg >= 2) { this.addBlight(land.id); blight++; }
    if (dmg >= 6 && d.heavyMining) { this.log(`${land.id}: 대규모 채굴 — 황폐가 하나 더!`); this.addBlight(land.id); blight++; }
    let dahanLost = 0;
    if (dmg > 0 && !land.flags.dahanProtected) dahanLost = this.damageDahan(land.id, dmg + (d.ravageDahanBonus || 0));
    let counter = 0;
    let killed = { explorer: 0, town: 0, city: 0 };
    if (land.dahan.length && !land.flags.dahanAmbushed && this.invaderCount(land.id)) {
      counter = land.dahan.length * (2 + counterBonus);
      this.log(`${land.id}: 살아남은 다한 ${land.dahan.length}명의 반격! (${land.dahan.length} × ${2 + counterBonus}) = 피해 ${counter}`);
      killed = this.damageInvaders(land.id, counter).destroyed;
    }
    Object.assign(report, { raw, dmg, blight, dahanLost, dahanLeft: land.dahan.length, counter, killed, done: true });
    await this.step('ravageLand', null, [land.id], `${land.id} 약탈 결과`, report);
  }

  doBuild(land, force = false) {
    if (!force && !this.invaderCount(land.id)) return;
    if (this.skipAction(land, 'Build')) { this.log(`${land.id}: 건설하지 않음`); return; }
    const blocker = this.playerIds.find((pid) => this.spiritDef(pid).noBuildSacred && this.isSacred(pid, land.id));
    if (blocker) { this.log(`${land.id}: ${this.spiritDef(blocker).special.name} — 건설하지 못합니다`); return; }
    const type = land.towns.length > land.cities.length ? 'city' : 'town';
    if (type === 'city' && this.turnRules.some((r) => r.kind === 'noBuildCity' && r.test(land))) { this.log(`${land.id}: 도시를 건설하지 않음`); return; }
    this.addPieces(land.id, type, 1);
    this.events.push({ landId: land.id, kind: 'build' });
    this.log(`${land.id}: ${PIECE_NAMES[type]} 건설`);
  }

  doExplore(card) {
    const targets = Object.values(this.lands).filter((land) => {
      if (!this.cardMatches(card, land)) return false;
      if (land.coastal || this.townCityCount(land.id)) return true;
      return land.adj.some((a) => this.townCityCount(a) > 0);
    });
    for (const land of targets) {
      if (this.skipAction(land, 'Explore')) { this.log(`${land.id}: 탐험하지 않음`); continue; }
      const keeper = this.playerIds.find((pid) => this.spiritDef(pid).forbidExplore && this.isSacred(pid, land.id));
      if (keeper) { this.log(`${land.id}: 금지된 땅 — 침략자가 들어오지 못합니다`); continue; }
      this.addPieces(land.id, 'explorer', this.diff.coastalExploreExtra && land.coastal ? 2 : 1);
      this.events.push({ landId: land.id, kind: 'explore' });
      this.log(`${land.id}: 탐험가 도착`);
      const bane = this.playerIds.find((pid) => this.spiritDef(pid).explorerBane && this.isSacred(pid, land.id));
      if (bane) { this.log(`${land.id}: ${this.spiritDef(bane).special.name} — 탐험가가 사라집니다`); this.removePieces(land.id, 'explorer', 1); }
    }
  }

  timePasses() {
    this.phase = 'time';
    for (const l of Object.values(this.lands)) {
      l.towns = l.towns.map(() => HP.town);
      l.cities = l.cities.map(() => HP.city);
      l.dahan = l.dahan.map(() => HP.dahan);
      l.defend = 0;
      l.flags = {};
    }
    for (const pid of this.playerIds) {
      const s = this.spirits[pid];
      s.discard.push(...s.played.map((p) => p.id));
      s.played = [];
      s.bonusElements = {};
      s.fastAllowance = 0;
      s.repeats = [];
      s.innatesUsed = {};
      s.growthChoice = null;
      s.ravageFearUsed = 0;
      if (this.spiritDef(pid).blightHeal) {
        const land = this.sacredLands(pid).find((id) => this.lands[id].blight > 0);
        if (land) { this.log(`${this.pname(pid)}: ${this.spiritDef(pid).special.name} — ${land}의 황폐가 치유됩니다`); this.removeBlight(land); }
      }
    }
    this.turnRules = [];
    this.log('시간이 흐릅니다. (피해·방어 초기화, 사용한 카드는 버림 더미로)');
  }

  // ───────────── 클라이언트용 상태 ─────────────
  view() {
    const lands = {};
    for (const l of Object.values(this.lands)) {
      lands[l.id] = {
        id: l.id, board: l.board, num: l.num, terrain: l.terrain, poly: l.poly, center: l.center, coastal: l.coastal, adj: l.adj,
        explorers: l.explorers, towns: l.towns, cities: l.cities, dahan: l.dahan, blight: l.blight, presence: l.presence,
        defend: l.defend, skip: !!l.flags.skipAll, dahanProtected: !!l.flags.dahanProtected,
      };
    }
    const spirits = {};
    for (const pid of this.playerIds) {
      const s = this.spirits[pid];
      spirits[pid] = {
        ...s,
        elements: this.elements(pid),
        energyPerTurn: this.energyPerTurn(pid),
        cardPlays: this.cardPlays(pid),
        islandPresence: this.islandPresence(pid),
        sacred: this.sacredLands(pid),
        innateLevels: Object.fromEntries(this.spiritDef(pid).innates.map((i) => [i.id, this.innateLevels(pid, i)])),
        waiting: !!(this.prompts[pid] && this.prompts[pid].length),
        board: this.boardOf[pid],
      };
    }
    const cardInfo = (c) => (c ? { name: invaderCardName(c), stage: c.stage, terrains: c.terrains, coastal: !!c.coastal } : null);
    return {
      players: this.players,
      phase: this.phase,
      turn: this.turn,
      lands,
      oceans: this.oceans,
      mapSize: this.mapSize,
      spirits,
      fear: {
        poolSize: this.fear.poolSize, generated: this.fear.generated, earnedTotal: this.fear.earnedTotal, total: this.fear.total,
        pending: this.fear.earned.length, deckLeft: this.fear.deck.length, terrorLevel: this.terrorLevel(), current: this.fear.current || null,
      },
      blight: this.blight,
      invader: {
        ravage: cardInfo(this.invader.ravage),
        build: cardInfo(this.invader.build),
        deckCount: this.invader.deck.length,
        nextStage: this.invader.deck[0] ? this.invader.deck[0].stage : null,
        discardCount: this.invader.discard.length,
      },
      turnRules: this.turnRules.map((r) => r.text),
      difficulty: this.diff.label,
      forecast: this.forecast(),
      invaderStep: this.invaderStep,
      pieceStats: this.pieceStats(),
      tutorial: this.tutorial,
      invaderTrack: { explore: cardInfo(this.invader.lastExplore), discard: this.invader.discard.length },
      boards: this.boardLetters,
      events: this.events,
      log: this.logLines.slice(-120),
      result: this.result,
    };
  }
}

function growthLabel(a) {
  switch (a.type) {
    case 'reclaimAll': return '카드 모두 회수';
    case 'gainCard': return '권능 카드 획득';
    case 'energy': return `에너지 +${a.n}`;
    case 'presence': return `존재 추가(사거리 ${a.range})`;
    default: return a.type;
  }
}

function speedName(s) { return s === 'fast' ? '빠름' : '느림'; }

module.exports = { Game, GameOver, PIECE_NAMES, ELEMENT_NAMES, growthLabel, invaderCardName };
