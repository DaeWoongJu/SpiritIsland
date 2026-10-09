'use strict';
// 킵 더 히어로즈 아웃 — 게임 엔진 (몬스터 협력 던전 방어)
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
   * @param {{id:string,name:string,bot?:boolean,clan:string}[]} players 차례 순서대로
   * @param {{seed?:number, settings?:{difficulty?:string}}} opts
   */
  constructor(players, opts = {}) {
    super();
    this.seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.rand = mulberry32(this.seed);
    this.botRand = mulberry32((this.seed ^ 0x5bd1e995) >>> 0);
    this.settings = { difficulty: 'easy', fire: false, boss: false, wave3: false, ...(opts.settings || {}) };
    this.diff = D.DIFFICULTIES.find((d) => d.id === this.settings.difficulty) || D.DIFFICULTIES[1];
    this.players = players.map((p) => ({ id: p.id, name: p.name, bot: !!p.bot, clan: p.clan }));
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
  clan(pid) { return D.CLAN_MAP[this.P(pid).clan]; }
  pname(pid) { const p = this.players.find((x) => x.id === pid); return p ? `${p.name}(${D.CLAN_MAP[p.clan] ? D.CLAN_MAP[p.clan].name : ''})` : pid; }
  log(text, pid = null, kind = '') { this.logs.push({ seq: this.logSeq++, text, pid, kind, round: this.round }); if (this.logs.length > 300) this.logs.shift(); }
  ev(kind, data = {}) { this.events.push({ id: ++this.evSeq, kind, ...data }); if (this.events.length > 40) this.events = this.events.slice(-20); }
  changed() { this.emit('update'); }
  room(id) { return this.rooms[id]; }

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
    this.result = { win, reason, round: this.round, stolen: this.stolen };
    this.phase = 'end';
    this.current = null;
    this.log(win ? `🎉 승리! ${reason}` : `💀 패배... ${reason}`, null, win ? 'win' : 'lose');
    this.prompts = {};
    this.changed();
    throw new GameOver();
  }

  // ───────────── 준비 ─────────────
  setup() {
    this.rooms = {};
    for (const r of D.ROOMS) this.rooms[r.id] = { id: r.id, chests: r.chests || 0, items: 0, bones: 0, traps: 0, fire: 0 };
    this.monsters = []; // {uid, owner, clan, room, hp, maxHp}
    this.heroes = []; // {hid, type, room, hp, maxHp, atk, exhausted}
    this.ps = {};
    for (const pl of this.players) {
      const cl = D.CLAN_MAP[pl.clan] || D.CLANS[0];
      const deck = this.shuffle(cl.deck.map((card, i) => ({ uid: this.newId('c'), base: `${cl.id}:${i}` })));
      this.ps[pl.id] = { clan: cl.id, deck, hand: [], discard: [], played: [], supply: cl.count, gold: 0, kills: 0 };
      // 시작 몬스터: 둥지에 2마리 (드래곤은 1마리)
      const start = cl.id === 'dragon' ? 1 : Math.min(2, cl.count);
      for (let i = 0; i < start; i++) this.placeMonster(pl.id, 'lair', true);
      this.draw(pl.id, D.HAND);
    }
    this.lootDeck = this.shuffle([...D.LOOT_DECK]);
    this.market = this.lootDeck.splice(0, 3);
    // 용사 덱: 웨이브마다, 인원에 맞춰 늘림
    const mul = this.diff.size * (0.75 + 0.25 * this.players.length);
    const nWaves = this.diff.waves + (this.settings.wave3 && this.diff.waves >= 2 ? 1 : 0);
    this.waveDecks = D.WAVES.slice(0, nWaves).map((w) => {
      const deck = [];
      for (const [type, k] of Object.entries(w.cards)) for (let i = 0; i < Math.max(1, Math.round(k * mul)); i++) deck.push({ type, gate: this.rand() < 0.5 ? 'gate_w' : 'gate_e' });
      return this.shuffle(deck);
    });
    this.wave = 0;
    this.heroDeck = this.waveDecks[0];
    this.finalAssault = false;
    this.bossSpawned = false;
    this.stolen = 0;
    this.heroesDefeated = 0;
    this.log(`던전을 지켜라! 난이도 ${this.diff.name} · ${D.WAVES[0].name} (용사 ${this.heroDeck.length}명)`);
    this.log('대보물 금고의 상자 3개를 모두 빼앗기면 패배, 모든 웨이브를 막아내면 승리예요.');
  }

  cardDef(card) {
    if (card.loot) return D.LOOT_MAP[card.loot];
    const [cl, i] = card.base.split(':');
    return D.CLAN_MAP[cl].deck[Number(i)];
  }

  draw(pid, n) {
    const p = this.P(pid);
    for (let i = 0; i < n; i++) {
      if (!p.deck.length) {
        if (!p.discard.length) break;
        p.deck = this.shuffle(p.discard);
        p.discard = [];
      }
      p.hand.push(p.deck.pop());
    }
  }

  // ───────────── 몬스터 ─────────────
  placeMonster(pid, roomId, quiet = false) {
    const p = this.P(pid);
    if (p.supply <= 0) return null;
    const cl = D.CLAN_MAP[p.clan];
    p.supply--;
    const m = { uid: this.newId('m'), owner: pid, clan: cl.id, room: roomId, hp: cl.hp, maxHp: cl.hp };
    this.monsters.push(m);
    if (!quiet) { this.log(`${this.pname(pid)}: ${cl.icon} ${cl.name} 소환 → ${D.ROOM_MAP[roomId].name}`, pid); this.ev('summon', { room: roomId }); }
    return m;
  }
  myMonsters(pid) { return this.monsters.filter((m) => m.owner === pid); }
  monstersIn(roomId) { return this.monsters.filter((m) => m.room === roomId); }
  heroesIn(roomId) { return this.heroes.filter((h) => h.room === roomId); }
  monsterName(m) { const cl = D.CLAN_MAP[m.clan]; return `${cl.icon}${cl.name}`; }
  heroName(h) { return `${D.HEROES[h.type].icon}${D.HEROES[h.type].name}`; }

  killMonster(m, why = '') {
    this.monsters = this.monsters.filter((x) => x !== m);
    this.P(m.owner).supply++;
    this.log(`${this.monsterName(m)}이(가) 쓰러졌어요${why ? ` (${why})` : ''} — 다시 소환할 수 있어요`, m.owner, 'mdead');
    this.ev('mdead', { room: m.room });
    // 슬라임: 분열 (작은 슬라임은 다시 분열하지 않음)
    if (m.clan === 'slimes' && !m.small && this.P(m.owner).supply > 0) {
      const s = this.placeMonster(m.owner, m.room, true);
      s.hp = 1; s.small = true;
      this.log('🟢 분열! 작은 슬라임이 생겼어요', m.owner);
    }
    // 해골: 뼈 폭발
    if (m.clan === 'skeletons') {
      const t = this.heroesIn(m.room)[0];
      if (t) { this.log('💀 뼈 폭발!', m.owner); this.damageHero(t, 1, m.owner); }
    }
  }
  damageMonster(m, n, by) {
    if (!this.monsters.includes(m)) return;
    m.hp -= n;
    this.ev('mhit', { room: m.room, n });
    if (m.hp <= 0) this.killMonster(m, by);
    else this.log(`${this.monsterName(m)} 피해 ${n} (체력 ${m.hp}/${m.maxHp})`, m.owner);
  }
  damageHero(h, n, pid) {
    if (!this.heroes.includes(h)) return;
    h.hp -= n;
    this.ev('hhit', { room: h.room, n });
    if (h.hp <= 0) {
      this.heroes = this.heroes.filter((x) => x !== h);
      this.rooms[h.room].bones = Math.min(5, this.rooms[h.room].bones + 1);
      this.heroesDefeated++;
      this.log(`💥 ${this.heroName(h)}을(를) 쓰러뜨렸어요! (뼈 1개가 ${D.ROOM_MAP[h.room].name}에 남아요)`, pid, 'hdead');
      this.ev('hdead', { room: h.room });
      if (pid && this.ps[pid]) {
        this.P(pid).kills++;
        if (this.P(pid).clan === 'gnolls') { this.P(pid).gold++; this.log(`🐺 놀 용병단: 금화 +1 (${this.P(pid).gold})`, pid); }
      }
    } else this.log(`${this.heroName(h)} 피해 ${n} (체력 ${h.hp}/${h.maxHp})`, pid);
  }

  // ───────────── 플레이어 차례 ─────────────
  async playerTurn(pid) {
    this.current = pid;
    this.phase = 'monsters';
    const p = this.P(pid);
    p.played = [];
    this.log(`── ${this.pname(pid)}의 차례 ──`, pid, 'turn');
    for (let guard = 0; guard < 60; guard++) {
      const options = p.hand.map((card) => {
        const d = this.cardDef(card);
        return { value: card.uid, label: `${d.name} ${d.icons.map((k) => D.ICONS[k].icon).join('')}`, card: card.uid, group: 'card' };
      });
      if (p.clan === 'gnolls') options.push({ value: 'hire', label: '💰 놀 고용 (금화 2)', group: 'special', disabled: p.gold < 2 || p.supply <= 0, reason: p.gold < 2 ? '금화가 2개 필요해요' : '쉬고 있는 놀이 없어요' });
      options.push({ value: 'end', label: '차례 끝내기 ▶', group: 'end' });
      const v = await this.ask(pid, { type: 'option', kind: 'turn', title: '카드를 내서 아이콘 행동을 하세요 (원하는 만큼)', options });
      if (v === 'end') break;
      if (v === 'hire') { p.gold -= 2; await this.summon(pid, '💰 고용'); continue; }
      const card = p.hand.find((x) => x.uid === v);
      p.hand = p.hand.filter((x) => x !== card);
      p.played.push(card);
      await this.playCard(pid, card);
      this.changed();
    }
    // 차례 끝: 낸 카드 버리고 5장까지 채움
    p.discard.push(...p.played);
    p.played = [];
    this.draw(pid, D.HAND - p.hand.length);
  }

  async playCard(pid, card) {
    const d = this.cardDef(card);
    this.log(`${this.pname(pid)}: 「${d.name}」 ${d.icons.map((k) => D.ICONS[k].icon).join(' ')}`, pid);
    if (d.special) await this.special(pid, d.special);
    const left = [...d.icons];
    while (left.length) {
      const opts = [...new Set(left)].map((k) => {
        const why = this.iconBlocked(pid, k);
        return { value: k, label: `${D.ICONS[k].icon} ${D.ICONS[k].name}`, icon: k, disabled: !!why, reason: why };
      });
      opts.push({ value: 'skip', label: '남은 아이콘 버리기' });
      const k = opts.filter((o) => !o.disabled && o.value !== 'skip').length ? await this.ask(pid, { type: 'option', kind: 'icon', title: `「${d.name}」 — 쓸 아이콘을 고르세요 (순서 자유, 몬스터마다 나눠 써도 돼요)`, options: opts, card: card.uid }) : 'skip';
      if (k === 'skip') break;
      left.splice(left.indexOf(k), 1);
      await this.useIcon(pid, k);
      this.changed();
    }
  }

  iconBlocked(pid, k) {
    const mine = this.myMonsters(pid);
    const p = this.P(pid);
    if (k === 'A') return this.attackPairs(pid).length ? '' : '공격할 수 있는 용사가 없어요 (같은 방에 내 몬스터가 있어야 해요)';
    if (k === 'M') return mine.length ? '' : '던전에 내 몬스터가 없어요';
    if (k === 'P') return this.activatable(pid).length ? '' : '작동할 수 있는 방이 없어요';
    if (k === 'S') return p.supply > 0 ? '' : '쉬고 있는 몬스터가 없어요';
    if (k === 'T') return mine.length ? '' : '던전에 내 몬스터가 없어요';
    return '';
  }

  /** 공격 가능한 [몬스터, 용사] 쌍 */
  attackPairs(pid) {
    const out = [];
    for (const m of this.myMonsters(pid)) {
      const rooms = m.clan === 'dragon' ? [m.room, ...D.ROOM_MAP[m.room].adj] : [m.room];
      for (const h of this.heroes) if (rooms.includes(h.room)) out.push([m, h]);
    }
    return out;
  }

  async useIcon(pid, k) {
    if (k === 'A') return this.iconAttack(pid);
    if (k === 'M') return this.iconMove(pid);
    if (k === 'P') return this.iconActivate(pid);
    if (k === 'S') return this.summon(pid);
    if (k === 'T') return this.iconTrap(pid);
  }

  async pickMonster(pid, title, list, kind) {
    const v = await this.choose(pid, title, list.map((m) => ({ value: m.uid, label: `${this.monsterName(m)} (${D.ROOM_MAP[m.room].name}, 체력 ${m.hp})`, unit: m.uid, room: m.room })), { kind });
    return this.monsters.find((m) => m.uid === v) || null;
  }

  async iconAttack(pid) {
    const pairs = this.attackPairs(pid);
    if (!pairs.length) return;
    const attackers = [...new Set(pairs.map(([m]) => m))];
    const m = await this.pickMonster(pid, '⚔ 공격할 내 몬스터를 고르세요', attackers, 'attacker');
    if (!m) return;
    const targets = pairs.filter(([a]) => a === m).map(([, h]) => h);
    const opts = targets.map((h) => ({ value: h.hid, label: `${this.heroName(h)} (${D.ROOM_MAP[h.room].name}, 체력 ${h.hp}/${h.maxHp}${h.exhausted ? ', 소진' : ''})`, hero: h.hid, room: h.room }));
    // 폴터가이스트: 겁주기
    if (m.clan === 'ghosts') for (const h of targets.filter((x) => x.room === m.room)) opts.push({ value: 'scare:' + h.hid, label: `👻 겁주기: ${this.heroName(h)}을(를) 옆 방으로 쫓아내기`, hero: h.hid, room: h.room });
    const v = await this.choose(pid, `${this.monsterName(m)}: 누구를 공격할까요?`, opts, { kind: 'target' });
    if (!v) return;
    if (v.startsWith('scare:')) {
      const h = this.heroes.find((x) => x.hid === v.slice(6));
      const away = D.ROOM_MAP[h.room].adj.slice().sort((a, b) => this.distToVault(b) - this.distToVault(a))[0];
      this.log(`👻 ${this.heroName(h)}이(가) 겁에 질려 ${D.ROOM_MAP[away].name}(으)로 도망쳤어요!`, pid);
      h.room = away;
      h.exhausted = true;
      this.ev('scare', { room: away });
      return;
    }
    const h = this.heroes.find((x) => x.hid === v);
    const cl = D.CLAN_MAP[m.clan];
    this.log(`⚔ ${this.monsterName(m)} → ${this.heroName(h)}`, pid);
    this.ev('attack', { room: h.room });
    const exhaust = (m.clan === 'lizards' || m.clan === 'witches') && this.heroes.includes(h);
    // 쥐인간 떼 공격: 같은 방 쥐인간 수만큼 (최대 3)
    const swarm = (cap) => Math.min(cap, this.monstersIn(m.room).filter((x) => x.clan === m.clan).length);
    const dmg = m.clan === 'rats' ? swarm(3) : m.clan === 'slimes' ? swarm(2) : cl.atk;
    if ((m.clan === 'rats' || m.clan === 'slimes') && dmg > 1) this.log(`${cl.icon} 떼 공격! ${cl.name} ${dmg}마리`, pid);
    this.damageHero(h, dmg, pid);
    if (exhaust && this.heroes.includes(h) && !h.exhausted) { h.exhausted = true; this.log(`${m.clan === 'lizards' ? '🦎 독' : '🧙‍♀️ 저주'}: ${this.heroName(h)} 소진!`, pid); }
  }

  /** 몬스터가 이동할 수 있는 방 */
  moveTargets(m) {
    if (m.clan === 'ghosts') return D.ROOMS.map((r) => r.id).filter((id) => id !== m.room);
    const one = D.ROOM_MAP[m.room].adj;
    if (m.clan !== 'imps') return one;
    return [...new Set([...one, ...one.flatMap((id) => D.ROOM_MAP[id].adj)])].filter((id) => id !== m.room);
  }

  async iconMove(pid) {
    const mine = this.myMonsters(pid);
    const m = await this.pickMonster(pid, '👢 움직일 내 몬스터를 고르세요', mine, 'mover');
    if (!m) return;
    const dest = await this.choose(pid, `${this.monsterName(m)}: 어느 방으로 갈까요?`, this.moveTargets(m).map((id) => ({ value: id, label: `${D.ROOM_MAP[id].name}${this.heroesIn(id).length ? ` (용사 ${this.heroesIn(id).length})` : ''}`, room: id })), { kind: 'dest', always: true });
    if (!dest) return;
    const from = m.room;
    // 원작처럼 몬스터는 이동할 때 아이템이나 뼈 토큰 하나를 들고 갈 수 있어요
    const opts = [];
    if (this.rooms[from].items > 0) opts.push({ value: 'yes', label: '🎒 아이템 들고 가기 (제단에서 전리품으로)' });
    if (this.rooms[from].bones > 0 && this.rooms[dest].bones < 5) opts.push({ value: 'bone', label: '🦴 뼈 들고 가기 (납골당에서 몬스터 되살리기)' });
    let carry = null;
    if (opts.length) {
      this.pendingDest = { from, to: dest };
      const ans = await this.choose(pid, `${D.ROOM_MAP[from].name}에서 무엇을 들고 갈까요?`, [...opts, { value: 'no', label: '빈손으로 가기' }], { kind: 'carry', always: true });
      this.pendingDest = null;
      if (ans === 'yes' || ans === 'bone') carry = ans;
    }
    m.room = dest;
    if (carry === 'yes') { this.rooms[from].items--; this.rooms[dest].items++; }
    if (carry === 'bone') { this.rooms[from].bones--; this.rooms[dest].bones++; }
    this.log(`👢 ${this.monsterName(m)}: ${D.ROOM_MAP[from].name} → ${D.ROOM_MAP[dest].name}${carry === 'yes' ? ' (아이템을 들고)' : carry === 'bone' ? ' (뼈를 들고)' : ''}`, pid);
    this.ev('move', { room: dest });
  }

  /** 방 작동 가능한 [몬스터] 목록 */
  activatable(pid) {
    return this.myMonsters(pid).filter((m) => this.canActivate(pid, m));
  }
  canActivate(pid, m) {
    if (m.clan === 'witches' || m.clan === 'dragon') return true;
    const r = this.rooms[m.room];
    const type = D.ROOM_MAP[m.room].type;
    const p = this.P(pid);
    if (type === 'forge' || type === 'lab') return r.items < 2;
    if (type === 'altar') return r.items > 0 && this.market.length > 0;
    if (type === 'lair') return p.supply > 0;
    if (type === 'crypt') return (r.bones > 0 && p.supply > 0) || this.monstersIn(m.room).some((x) => x.owner === pid && x.hp < x.maxHp);
    return true; // 함정 놓기 방들
  }

  async iconActivate(pid) {
    const list = this.activatable(pid);
    const m = await this.pickMonster(pid, '✋ 어느 방을 작동할까요? (그 방에 있는 내 몬스터)', list, 'activator');
    if (!m) return;
    const room = this.rooms[m.room];
    const rd = D.ROOM_MAP[m.room];
    const p = this.P(pid);
    if (m.clan === 'dragon') { m.hp = Math.min(m.maxHp, m.hp + 1); this.log(`🐉 드래곤이 보물 위에서 쉬며 체력 회복 (${m.hp}/${m.maxHp})`, pid); }
    if (m.clan === 'witches') {
      if (room.items < 2) room.items++;
      for (const x of this.monstersIn(m.room)) x.hp = x.maxHp;
      this.log(`🧙‍♀️ 마녀의 솥: ${rd.name}에 물약 1개, 같은 방 몬스터 체력 회복`, pid);
      this.ev('craft', { room: m.room });
      if (!['altar', 'lair', 'crypt'].includes(rd.type)) return;
    }
    if (m.clan === 'imps') { room.traps = Math.min(3, room.traps + 1); this.log(`😈 임프 장난: ${rd.name}에 함정 1개`, pid); }
    if (m.clan === 'emberlings') this.addFire(m.room, pid);
    switch (rd.type) {
      case 'forge': case 'lab':
        if (room.items < 2) { room.items++; this.log(`✋ ${rd.name}: ${rd.type === 'forge' ? '무기' : '물약'} 1개 제작 (제단으로 옮겨 전리품으로 바꿔요)`, pid); this.ev('craft', { room: m.room }); }
        break;
      case 'altar': await this.exchange(pid, m.room); break;
      case 'lair': await this.summonAt(pid, m.room); break;
      case 'crypt':
        if (room.bones > 0 && p.supply > 0) { room.bones--; this.log('✋ 납골당: 뼈 1개로 몬스터 되살리기', pid); await this.summonAt(pid, m.room); } else { for (const x of this.monstersIn(m.room)) if (x.owner === pid) x.hp = x.maxHp; this.log('✋ 납골당: 내 몬스터 체력 회복', pid); }
        break;
      case 'trapshop': {
        for (let i = 0; i < 2; i++) await this.placeTrap(pid, [m.room, ...rd.adj], '함정 공방: 함정을 놓을 방');
        break;
      }
      default:
        room.traps = Math.min(3, room.traps + 1);
        this.log(`✋ ${rd.name}: 함정 1개 설치`, pid);
        this.ev('trap', { room: m.room });
    }
  }

  async exchange(pid, roomId) {
    const room = this.rooms[roomId];
    if (room.items <= 0 || !this.market.length) return;
    const v = await this.choose(pid, '제단에 아이템을 바쳐 받을 전리품 카드를 고르세요', this.market.map((id, i) => ({ value: `${i}`, label: `${D.LOOT_MAP[id].name} ${D.LOOT_MAP[id].icons.map((k) => D.ICONS[k].icon).join('')}${D.LOOT_MAP[id].text ? ' — ' + D.LOOT_MAP[id].text : ''}`, loot: id })), { kind: 'loot', always: true });
    const id = this.market.splice(Number(v), 1)[0];
    room.items--;
    this.P(pid).discard.push({ uid: this.newId('c'), loot: id });
    if (this.lootDeck.length) this.market.push(this.lootDeck.shift());
    this.log(`🎁 ${this.pname(pid)}: 전리품 「${D.LOOT_MAP[id].name}」 획득 (버림 더미로 — 곧 손에 들어와요)`, pid, 'loot');
    this.ev('loot', { room: roomId });
  }

  async summonAt(pid, roomId) {
    const p = this.P(pid);
    const n = p.clan === 'rats' ? 2 : 1;
    for (let i = 0; i < n; i++) if (p.supply > 0) this.placeMonster(pid, roomId);
  }

  async summon(pid, label = '🥚 소환') {
    const p = this.P(pid);
    if (p.supply <= 0) return;
    const allowed = [...new Set(['lair', ...this.myMonsters(pid).map((m) => m.room)])];
    const v = await this.choose(pid, `${label}: 어느 방에 불러올까요? (둥지 또는 내 몬스터가 있는 방)`, allowed.map((id) => ({ value: id, label: `${D.ROOM_MAP[id].name}${this.heroesIn(id).length ? ` (용사 ${this.heroesIn(id).length})` : ''}`, room: id })), { kind: 'summon', always: allowed.length > 1 });
    if (v) await this.summonAt(pid, v);
  }

  async placeTrap(pid, rooms, title) {
    const v = await this.choose(pid, title, rooms.map((id) => ({ value: id, label: `${D.ROOM_MAP[id].name} (함정 ${this.rooms[id].traps})`, room: id, disabled: this.rooms[id].traps >= 3, reason: '함정은 방마다 3개까지' })), { kind: 'trap', always: true });
    if (!v) return;
    this.rooms[v].traps++;
    this.log(`🪤 ${D.ROOM_MAP[v].name}에 함정 설치 (${this.rooms[v].traps}개)`, pid);
    this.ev('trap', { room: v });
  }

  async iconTrap(pid) {
    const rooms = [...new Set(this.myMonsters(pid).flatMap((m) => [m.room, ...D.ROOM_MAP[m.room].adj]))];
    if (this.P(pid).clan === 'emberlings') {
      const v = await this.choose(pid, '🔥 불을 붙일 방 (내 불씨족이 있는 방이나 옆 방)', rooms.map((id) => ({ value: id, label: `${D.ROOM_MAP[id].name} (불 ${this.rooms[id].fire})`, room: id, disabled: this.rooms[id].fire >= 2, reason: '불은 방마다 2개까지' })), { kind: 'fire', always: true });
      if (v) this.addFire(v, pid);
      return;
    }
    await this.placeTrap(pid, rooms, '🪤 함정을 놓을 방 (내 몬스터가 있는 방이나 옆 방)');
  }
  addFire(roomId, pid) {
    const r = this.rooms[roomId];
    if (r.fire >= 2) return;
    r.fire++;
    this.log(`🔥 ${D.ROOM_MAP[roomId].name}에 불! (${r.fire}개)`, pid);
    this.ev('fire', { room: roomId });
  }
  /** 용사 단계 전: 방의 불마다 용사 → 아이템 → 몬스터 순으로 태움 */
  burnFires() {
    for (const rd of D.ROOMS) {
      const r = this.rooms[rd.id];
      for (let i = 0; i < r.fire; i++) {
        const h = this.heroesIn(rd.id)[0];
        if (h) { r.fire--; i--; this.log(`🔥 불길! ${this.heroName(h)} (불이 꺼짐)`); this.damageHero(h, 1, null); continue; }
        if (r.items > 0) { r.items--; r.fire--; i--; this.log(`🔥 ${rd.name}의 아이템이 타 버렸어요 (불도 꺼짐)`); continue; }
        const m = this.monstersIn(rd.id).find((x) => x.clan !== 'emberlings');
        if (m) { r.fire--; i--; this.log(`🔥 ${rd.name}의 불이 ${this.monsterName(m)}을(를) 태웠어요 (불도 꺼짐)`); this.damageMonster(m, 1, '불'); continue; }
      }
    }
  }

  async special(pid, kind) {
    const myRooms = [...new Set(this.myMonsters(pid).map((m) => m.room))];
    if (kind === 'bomb') {
      const rooms = myRooms.filter((id) => this.heroesIn(id).length);
      const v = await this.choose(pid, '🔥 화염 폭탄을 던질 방', rooms.map((id) => ({ value: id, label: `${D.ROOM_MAP[id].name} (용사 ${this.heroesIn(id).length})`, room: id })), { kind: 'bomb' });
      if (v) { this.log(`🔥 화염 폭탄! ${D.ROOM_MAP[v].name}`, pid); this.ev('bomb', { room: v }); for (const h of this.heroesIn(v)) this.damageHero(h, 2, pid); }
    } else if (kind === 'fog') {
      const rooms = D.ROOMS.map((r) => r.id).filter((id) => this.heroesIn(id).length);
      const v = await this.choose(pid, '💤 잠의 안개를 뿌릴 방', rooms.map((id) => ({ value: id, label: `${D.ROOM_MAP[id].name} (용사 ${this.heroesIn(id).length})`, room: id })), { kind: 'fog' });
      if (v) { for (const h of this.heroesIn(v)) h.exhausted = true; this.log(`💤 ${D.ROOM_MAP[v].name}의 용사들이 잠들었어요 (소진)`, pid); }
    } else if (kind === 'heal') {
      for (const m of this.myMonsters(pid)) m.hp = m.maxHp;
      this.log('🧪 내 모든 몬스터 체력 회복', pid);
    } else if (kind === 'lock') {
      const v = this.rooms.vault;
      if (v.chests < 3) { v.chests++; this.stolen = Math.max(0, this.stolen - 1); this.log('🔒 마법 자물쇠: 금고에 보물 상자 1개를 되찾았어요!', pid); } else this.log('🔒 금고가 이미 가득해요', pid);
    }
  }

  // ───────────── 용사 단계 ─────────────
  distTo(roomId, type) { return this.dist(roomId, (id) => D.ROOM_MAP[id].type === type); }
  distToVault(roomId) { return this.dist(roomId, (id) => id === 'vault'); }
  /** BFS 거리 (조건을 만족하는 가장 가까운 방까지) */
  dist(from, pred) {
    const seen = new Set([from]);
    let frontier = [from];
    for (let d = 0; d < 20; d++) {
      if (frontier.some(pred)) return d;
      const next = [];
      for (const id of frontier) for (const a of D.ROOM_MAP[id].adj) if (!seen.has(a)) { seen.add(a); next.push(a); }
      frontier = next;
      if (!frontier.length) break;
    }
    return 99;
  }
  /** 보물을 향해 한 칸 */
  stepToward(from, greedy) {
    const hasLoot = (id) => this.rooms[id].chests > 0;
    const target = greedy ? hasLoot : (id) => hasLoot(id);
    let best = null; let bestD = 99;
    for (const a of D.ROOM_MAP[from].adj) {
      const d = this.dist(a, target);
      // 같은 거리면 금고에 가까운 쪽
      const tie = this.distToVault(a);
      if (d < bestD || (d === bestD && best && tie < this.distToVault(best))) { best = a; bestD = d; }
    }
    return best;
  }

  spawnHero(card) {
    const def = D.HEROES[card.type];
    const hp = def.hp + (this.diff.hpBonus || 0);
    const h = { hid: this.newId('h'), type: card.type, room: card.gate, hp, maxHp: hp, atk: def.atk, exhausted: false, fresh: true };
    // 고무: 같은 방의 소진된 용사를 모두 일으킴
    const woke = this.heroesIn(card.gate).filter((x) => x.exhausted);
    for (const x of woke) x.exhausted = false;
    this.heroes.push(h);
    this.log(`🚪 ${D.ROOM_MAP[card.gate].name}에 ${this.heroName(h)} 침입! (체력 ${hp})${woke.length ? ` — 소진된 용사 ${woke.length}명이 다시 일어났어요` : ''}`, null, 'hero');
    this.ev('spawn', { room: card.gate });
    this.enterRoom(h);
  }

  /** 방에 들어설 때 함정 */
  enterRoom(h) {
    const r = this.rooms[h.room];
    if (r.traps > 0 && this.heroes.includes(h)) {
      r.traps--;
      this.log(`🪤 함정 발동! ${this.heroName(h)}`, null);
      this.ev('trapfire', { room: h.room });
      this.damageHero(h, 1, null);
    }
  }

  async heroPhase(afterPid) {
    this.phase = 'heroes';
    this.current = null;
    if (this.settings.fire) this.burnFires();
    // 1) 침입
    for (let i = 0; i < this.diff.perTurn; i++) {
      if (!this.heroDeck.length) break;
      this.spawnHero(this.heroDeck.pop());
    }
    if (this.finalAssault) for (const h of this.heroes) h.exhausted = false;
    this.changed();
    // 2) 활성 용사 행동 (금고에 가까운 용사부터)
    const acting = this.heroes.filter((h) => !h.exhausted).sort((a, b) => this.distToVault(a.room) - this.distToVault(b.room));
    for (const h of acting) {
      if (!this.heroes.includes(h)) continue;
      this.heroAct(h);
      if (this.rooms.vault.chests <= 0) this.endGame(false, '대보물 금고의 보물을 모두 빼앗겼어요!');
    }
    for (const h of this.heroes) h.fresh = false;
    // 3) 웨이브 진행
    if (!this.heroDeck.length && !this.finalAssault) {
      if (this.wave + 1 < this.waveDecks.length) {
        this.wave++;
        this.heroDeck = this.waveDecks[this.wave];
        this.log(`══ ${D.WAVES[this.wave].name} 시작! (용사 ${this.heroDeck.length}명) ══`, null, 'wave');
        this.ev('wave', {});
      } else {
        this.finalAssault = true;
        this.log('══ 마지막 공세! 남은 용사가 모두 쉬지 않고 덤벼요. 던전의 용사를 모두 쓰러뜨리면 승리! ══', null, 'wave');
        if (this.settings.boss && !this.bossSpawned) {
          this.bossSpawned = true;
          this.log('👑👑 보스 「용사왕 레온하르트」가 나타났다! 👑👑', null, 'wave');
          this.spawnHero(D.BOSS);
        }
      }
    }
    if (this.finalAssault && !this.heroes.length) this.endGame(true, `모든 웨이브를 막아냈어요! 빼앗긴 보물 ${this.stolen}개.`);
    this.changed();
  }

  heroAct(h) {
    const def = D.HEROES[h.type];
    const here = this.monstersIn(h.room);
    const room = this.rooms[h.room];
    const stuck = here.some((m) => m.clan === 'slimes');
    const plunder = () => {
      room.chests--;
      this.stolen++;
      this.log(`💰 ${this.heroName(h)}이(가) ${D.ROOM_MAP[h.room].name}의 보물 상자를 훔쳤어요! (남은 상자 ${room.chests})`, null, 'steal');
      this.ev('steal', { room: h.room });
    };
    const attackIn = (list) => {
      if (def.aoe) {
        this.log(`${this.heroName(h)}의 마법 폭발! (방의 모든 몬스터에게 피해 ${h.atk})`);
        this.ev('hattack', { room: list[0].room });
        for (const m of list.slice()) this.damageMonster(m, h.atk, this.heroName(h));
      } else {
        const t = list.slice().sort((a, b) => a.hp - b.hp || (a.clan === 'dragon') - (b.clan === 'dragon'))[0];
        this.log(`${this.heroName(h)} → ${this.monsterName(t)} 공격 (피해 ${h.atk})`);
        this.ev('hattack', { room: t.room });
        this.damageMonster(t, h.atk, this.heroName(h));
      }
    };
    if (def.greedy && room.chests > 0) plunder();
    else if (here.length) attackIn(here);
    else if (room.chests > 0) plunder();
    else if (def.ranged && D.ROOM_MAP[h.room].adj.some((a) => this.monstersIn(a).length)) {
      const a = D.ROOM_MAP[h.room].adj.find((x) => this.monstersIn(x).length);
      this.log(`${this.heroName(h)}이(가) ${D.ROOM_MAP[a].name}으로 화살을 쏴요`);
      attackIn(this.monstersIn(a).filter(() => true).slice(0, def.aoe ? 99 : 99));
    } else if (stuck) {
      this.log(`🟢 ${this.heroName(h)}이(가) 슬라임에 발이 묶였어요!`);
    } else {
      for (let s = 0; s < def.move; s++) {
        const nxt = this.stepToward(h.room, def.greedy);
        if (!nxt) break;
        h.room = nxt;
        this.ev('hmove', { room: nxt });
        this.enterRoom(h);
        if (!this.heroes.includes(h)) return;
        if (this.monstersIn(h.room).some((m) => m.clan === 'slimes') || this.rooms[h.room].chests > 0 || this.monstersIn(h.room).length) break;
      }
      if (this.heroes.includes(h)) this.log(`${this.heroName(h)} → ${D.ROOM_MAP[h.room].name}`);
    }
    if (!this.heroes.includes(h)) return;
    // 행동한 용사는 소진 (마법사는 소진되지 않고, 같은 방 용사를 일으킴)
    if (def.inspire) {
      const woke = this.heroesIn(h.room).filter((x) => x.exhausted);
      for (const x of woke) x.exhausted = false;
      if (woke.length) this.log(`${this.heroName(h)}이(가) 동료 ${woke.length}명을 고무했어요!`);
    } else h.exhausted = true;
  }

  // ───────────── 진행 ─────────────
  async run() {
    try {
      this.setup();
      for (this.round = 1; this.round <= 80; this.round++) {
        for (const pid of this.order) {
          await this.playerTurn(pid);
          await this.heroPhase(pid);
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
    const card = (c) => { const d = this.cardDef(c); return { uid: c.uid, name: d.name, icons: d.icons, text: d.text || '', loot: c.loot || null }; };
    return {
      round: this.round, phase: this.phase, current: this.current, order: this.order, result: this.result,
      difficulty: this.diff.name, wave: this.wave, waves: this.waveDecks ? this.waveDecks.length : 0, waveName: D.WAVES[this.wave] ? D.WAVES[this.wave].name : '',
      heroDeck: this.heroDeck ? this.heroDeck.length : 0, perTurn: this.diff.perTurn, finalAssault: !!this.finalAssault, stolen: this.stolen || 0, defeated: this.heroesDefeated || 0,
      rooms: this.rooms || {}, monsters: this.monsters || [], heroes: this.heroes || [], market: this.market || [],
      players: this.players.map((pl) => {
        const p = this.ps ? this.ps[pl.id] : null;
        return { id: pl.id, name: pl.name, bot: pl.bot, clan: pl.clan, supply: p ? p.supply : 0, gold: p ? p.gold : 0, kills: p ? p.kills : 0,
          handCount: p ? p.hand.length : 0, deckCount: p ? p.deck.length : 0, discardCount: p ? p.discard.length : 0,
          hand: p && pl.id === forPid ? p.hand.map(card) : null, played: p ? p.played.map(card) : [] };
      }),
      log: this.logs.slice(-80), events: this.events.slice(-20),
    };
  }
}

// ───────────── AI ─────────────
function botAnswer(g, pid, pr) {
  const ok = pr.options.filter((o) => !o.disabled);
  const val = (o) => (o ? o.value : ok[0].value);
  const heroRooms = () => g.heroes.map((h) => h.room);
  const nearHero = (id) => (g.heroes.length ? g.dist(id, (x) => heroRooms().includes(x)) : 9);
  switch (pr.kind) {
    case 'turn': {
      const p = g.P(pid);
      if (ok.some((o) => o.value === 'hire')) return 'hire';
      const score = (o) => {
        const c = p.hand.find((x) => x.uid === o.value);
        if (!c) return -1;
        const d = g.cardDef(c);
        let s = d.special ? 3 : 0;
        for (const k of d.icons) s += g.iconBlocked(pid, k) ? 0 : { A: 4, S: 3, T: 2, P: 2, M: 1 }[k];
        return s;
      };
      const cards = ok.filter((o) => o.group === 'card').map((o) => [o, score(o)]).sort((a, b) => b[1] - a[1]);
      if (cards.length && cards[0][1] > 0) return cards[0][0].value;
      return 'end';
    }
    case 'icon': {
      for (const k of ['A', 'S', 'T', 'P', 'M']) { const o = ok.find((x) => x.value === k); if (o) return k; }
      return 'skip';
    }
    case 'attacker': return val(ok.slice().sort((a, b) => (g.monsters.find((m) => m.uid === b.value) || {}).hp - (g.monsters.find((m) => m.uid === a.value) || {}).hp)[0]);
    case 'target': {
      const hs = ok.filter((o) => !String(o.value).startsWith('scare:'));
      const hero = (o) => g.heroes.find((h) => h.hid === o.value);
      return val(hs.sort((a, b) => g.distToVault(hero(a).room) - g.distToVault(hero(b).room) || hero(a).hp - hero(b).hp)[0] || ok[0]);
    }
    case 'mover': {
      // 용사와 같은 방이 아닌 몬스터 중 용사에게 가까운 쪽
      const ms = ok.map((o) => g.monsters.find((m) => m.uid === o.value));
      const free = ms.filter((m) => !g.heroesIn(m.room).length);
      const pick = (free.length ? free : ms).sort((a, b) => nearHero(a.room) - nearHero(b.room))[0];
      return pick.uid;
    }
    case 'dest': {
      const sorted = ok.slice().sort((a, b) => (nearHero(a.value) - nearHero(b.value)) || (g.distToVault(a.value) - g.distToVault(b.value)));
      return val(sorted[0]);
    }
    case 'carry': {
      // 아이템은 늘 챙기고, 뼈는 납골당 쪽으로 갈 때만
      if (ok.find((o) => o.value === 'yes')) return 'yes';
      const pending = g.pendingDest;
      if (ok.find((o) => o.value === 'bone') && (pending == null || g.distTo(pending.to, 'crypt') < g.distTo(pending.from, 'crypt'))) return 'bone';
      return 'no';
    }
    case 'activator': {
      const ms = ok.map((o) => g.monsters.find((m) => m.uid === o.value));
      const pref = (m) => ({ altar: 0, lair: 1, crypt: 2, trapshop: 3, forge: 4, lab: 4 }[require('./data').ROOM_MAP[m.room].type] ?? 5);
      return ms.sort((a, b) => pref(a) - pref(b))[0].uid;
    }
    case 'summon': return val(ok.slice().sort((a, b) => nearHero(a.value) - nearHero(b.value))[0]);
    case 'trap': case 'fire': return val(ok.slice().sort((a, b) => (nearHero(a.value) - nearHero(b.value)) || (g.distToVault(a.value) - g.distToVault(b.value)))[0]);
    case 'bomb': case 'fog': return val(ok.slice().sort((a, b) => g.heroesIn(b.value).length - g.heroesIn(a.value).length)[0]);
    case 'loot': return val(ok[Math.floor(g.botRand() * ok.length)]);
    default: return val(ok[0]);
  }
}

module.exports = { Game, GameOver, botAnswer };
