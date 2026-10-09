'use strict';
// 언락! — 게임 엔진 (협력 방탈출: 장소 살펴보기 · 빨강+파랑 합치기 · 코드 · 기계 · 힌트 · 벌점)
const { EventEmitter } = require('events');
const S = require('./scenarios');
const { partOf } = require('./build');

const PENALTY_MIN = 3;
const LIMIT_MIN = 60;

class GameOver extends Error {}

class Game extends EventEmitter {
  /**
   * @param {{id:string,name:string}[]} players
   * @param {{seed?:number, settings?:{scenario?:string}}} opts
   */
  constructor(players, opts = {}) {
    super();
    this.seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.settings = { scenario: S.LIST[0].id, ...(opts.settings || {}) };
    this.sc = S.get(this.settings.scenario) || S.LIST[0];
    this.players = players.map((p) => ({ id: p.id, name: p.name, bot: !!p.bot }));
    this.order = this.players.map((p) => p.id);
    this.logs = [];
    this.logSeq = 1;
    this.events = [];
    this.evSeq = 0;
    this.seq = 1;
    this.result = null;
    this.round = 0;
    this.phase = 'play';
    this.timeBase = 0; // 이전에 흐른 실제 시간 (이어하기)
    this.startAt = null;
    this.inPlay = []; // 카드 키 (나온 순서)
    this.gone = new Set();
    this.spotsFound = new Set();
    this.solved = new Set();
    this.hints = {}; // key → 본 힌트 수
    this.penalties = 0;
    this.wrong = 0;
    this.lastBy = {};
  }

  log(text, pid = null, kind = '') { this.logs.push({ seq: this.logSeq++, text, pid, kind }); if (this.logs.length > 300) this.logs.shift(); }
  ev(kind, data = {}) { this.events.push({ id: ++this.evSeq, kind, ...data }); if (this.events.length > 40) this.events = this.events.slice(-20); }
  changed() { this.emit('update'); }
  pname(pid) { const p = this.players.find((x) => x.id === pid); return p ? p.name : '누군가'; }
  card(k) { return this.sc.byKey[k]; }
  label(k) { const c = this.card(k); return `${c.num} ${c.title}`; }
  has(k) { return this.inPlay.includes(k); }
  realElapsed() { return this.timeBase + (this.startAt ? Date.now() - this.startAt : 0); }
  elapsed() { return this.realElapsed() + this.penalties * PENALTY_MIN * 60000; }

  // ───────────── 선택(프롬프트) — 방탈출은 모두가 언제든 행동 ─────────────
  currentPrompt(pid) {
    if (this.result || !this.players.some((p) => p.id === pid)) return null;
    return { id: this.seq, kind: 'escape', title: '자유롭게 살펴보세요', options: [] };
  }
  answer(pid, promptId, value) {
    if (this.result) return '게임이 끝났습니다.';
    if (!value || typeof value !== 'object') return '잘못된 행동입니다.';
    const err = this.act(pid, value);
    if (!err) { this.seq++; this.changed(); }
    return err;
  }

  endGame(win, reason) {
    if (this.result) return;
    const ms = this.elapsed();
    this.result = { win, reason, ms, penalties: this.penalties, hints: Object.values(this.hints).reduce((s, n) => s + n, 0), stars: this.stars(ms) };
    this.phase = 'end';
    this.log(win ? `🎉 탈출 성공! ${reason}` : reason, null, win ? 'win' : 'lose');
    this.ev('end', { win });
    this.changed();
    if (this._done) this._done(this.result);
  }

  /** 별점: 60분 안 + 힌트 적을수록 */
  stars(ms) {
    const min = ms / 60000;
    let s = 5;
    const lim = this.sc.limit || LIMIT_MIN;
    if (min > lim) s -= 2;
    else if (min > lim * 0.85) s -= 1;
    const h = Object.values(this.hints).reduce((a, n) => a + n, 0);
    if (h >= 6) s -= 2; else if (h >= 3) s -= 1;
    return Math.max(1, s);
  }

  // ───────────── 카드 ─────────────
  reveal(k, by, quiet = false) {
    if (this.has(k) || this.gone.has(k)) return;
    const c = this.card(k);
    this.inPlay.push(k);
    this.ev('reveal', { key: k });
    if (!quiet) this.log(`🃏 ${c.type === 'place' ? '장소' : '카드'} ${this.label(k)}`, by);
    for (const d of c.discard || []) this.discardCard(d, true);
    for (const s of c.shows || []) this.reveal(s, by, true);
    if (c.penalty) this.addPenalty(c.penalty, by);
    if (c.end) this.endGame(true, c.endText || '모든 수수께끼를 풀었습니다!');
  }
  discardCard(k, quiet) {
    const i = this.inPlay.indexOf(k);
    if (i < 0) return;
    this.inPlay.splice(i, 1);
    this.gone.add(k);
    if (!quiet) this.log(`🗑 ${this.label(k)} 카드를 버렸어요.`);
  }
  addPenalty(n, by) {
    this.penalties += n;
    this.log(`⏱ 벌점! ${n * PENALTY_MIN}분이 줄었어요.`, by, 'bad');
    this.ev('penalty', { n });
  }

  act(pid, v) {
    switch (v.a) {
      case 'spot': {
        const c = this.card(v.card);
        if (!c || !this.has(v.card) || !c.spots || !c.spots[v.i] || c.spots[v.i].hidden) return '살펴볼 수 없습니다.';
        const id = `${v.card}#${v.i}`;
        const s = c.spots[v.i];
        if (!this.spotsFound.has(id)) {
          this.spotsFound.add(id);
          if (s.reveal) { this.log(`🔍 ${this.pname(pid)}: ${s.label}에서 ${this.card(s.reveal).num}번 카드를 찾았다!`, pid, 'good'); this.ev('found', { card: v.card, i: v.i }); this.reveal(s.reveal, pid, true); }
          else this.log(`🔍 ${this.pname(pid)}: ${s.label} — ${s.text || '특별한 것은 없다.'}`, pid);
        }
        return null;
      }
      case 'take': {
        // 그림 속에서 찾은 숨은 번호로 카드 가져오기
        const num = String(v.num || '').trim().toUpperCase();
        if (!num) return '번호를 입력하세요.';
        for (const k of this.inPlay.slice()) {
          const c = this.card(k);
          const i = (c.spots || []).findIndex((sp) => sp.hidden && String(sp.num) === num);
          if (i >= 0 && !this.spotsFound.has(`${k}#${i}`)) {
            this.spotsFound.add(`${k}#${i}`);
            this.log(`🔎 ${this.pname(pid)}: 「${c.title}」 그림 속에서 숨은 번호 ${num}을(를) 찾았다!`, pid, 'good');
            this.ev('found', { card: k, i });
            this.reveal(c.spots[i].reveal, pid);
            return null;
          }
        }
        const t = this.sc.byNum[num];
        if (!t) return `${num}번 카드는 덱에 없어요.`;
        if (this.has(t.key)) return '이미 나와 있는 카드예요.';
        if (this.gone.has(t.key)) return '이미 버린 카드예요.';
        // 원작처럼 머릿속으로 두 번호를 더해 바로 그 카드를 뒤집은 경우 — 재료 두 장이 다 나와 있으면 합치기로 처리
        if (t.from && t.type !== 'trap' && t.from.every((k) => this.has(k))) {
          const [x, y] = t.from;
          this.log(`🔎 ${this.pname(pid)}: ${num}번 = 「${this.card(x).title}」 + 「${this.card(y).title}」`, pid);
          return this.act(pid, { a: 'combine', x, y });
        }
        this.log(`🔎 ${this.pname(pid)}: ${num}번 카드를 뒤집으려 했지만, 그 번호는 아직 어디에서도 찾지 못했다.`, pid, 'bad');
        this.addPenalty(1, pid);
        return null;
      }
      case 'combine': {
        const [x, y] = [v.x, v.y];
        if (x === y || !this.has(x) || !this.has(y)) return '두 카드를 골라 주세요.';
        const cx = this.card(x); const cy = this.card(y);
        const px = partOf(cx); const py = partOf(cy);
        if (!px || !py || px.color === py.color) return '빨간 번호와 파란 번호(또는 보정 숫자 +N)를 하나씩 합칠 수 있어요.';
        if (px.plus != null && py.plus != null) return '보정 숫자끼리는 합칠 수 없어요.';
        const vx = px.plus != null ? px.plus : cx.num;
        const vy = py.plus != null ? py.plus : cy.num;
        const sum = vx + vy;
        this.log(`🧩 ${this.pname(pid)}: ${px.plus != null ? '+' : ''}${vx} + ${py.plus != null ? '+' : ''}${vy} = ${sum}`, pid);
        const hit = this.sc.cards.find((c) => c.from && c.from.includes(x) && c.from.includes(y));
        if (hit && !this.has(hit.key) && !this.gone.has(hit.key)) {
          this.ev('combine', { key: hit.key });
          if (hit.type === 'trap') { this.log(`💥 ${hit.num} ${hit.title}: ${hit.text}`, pid, 'bad'); this.addPenalty(hit.penalty || 1, pid); return null; }
          this.reveal(hit.key, pid);
          return null;
        }
        if (hit) { this.log('이미 해 본 조합이에요.', pid); return null; }
        const t = this.sc.byNum[String(sum)];
        if (!t) { this.log(`덱에 ${sum}번 카드가 없다. 이 조합은 아닌가 보다.`, pid); return null; }
        if (this.has(t.key) || this.gone.has(t.key)) { this.log(`${sum}번은 이미 나온 카드다. 이 조합은 아닌가 보다.`, pid); return null; }
        // 원작처럼: 합한 번호의 카드가 있는데 맞는 조합이 아니면 벌점 카드
        this.wrong++;
        this.log(`💥 ${sum}번 카드를 뒤집었다 — 벌점! ${t.decoy ? t.text : '이 둘을 합치는 게 아니었다.'}`, pid, 'bad');
        this.ev('wrong', { key: x });
        this.addPenalty(1, pid);
        return null;
      }
      case 'code': {
        const c = this.card(v.card);
        if (!c || !this.has(v.card) || c.type !== 'code') return '코드를 넣을 수 없는 카드예요.';
        if (this.solved.has(v.card)) return '이미 푼 수수께끼예요.';
        const code = String(v.code || '').replace(/\s/g, '').toUpperCase();
        if (!code) return '코드를 입력하세요.';
        this.log(`🔢 ${this.pname(pid)}: ${c.num}번에 코드 ${code} 입력`, pid);
        if (code === String(c.code).toUpperCase()) {
          this.solved.add(v.card);
          this.log(`✅ 정답! ${c.okText || ''}`, pid, 'good');
          this.ev('solved', { key: v.card });
          if (c.discardSelf !== false) this.discardCard(v.card, true);
          this.reveal(c.result, pid);
        } else { this.wrong++; this.log('❌ 틀렸어요.', pid, 'bad'); this.ev('wrong', { key: v.card }); this.addPenalty(1, pid); }
        return null;
      }
      case 'machine': {
        const c = this.card(v.card);
        if (!c || !this.has(v.card) || c.type !== 'machine') return '작동할 수 없는 카드예요.';
        if (this.solved.has(v.card)) return '이미 작동시켰어요.';
        const seq = Array.isArray(v.seq) ? v.seq.map(String) : [];
        if (!seq.length) return '버튼을 눌러 주세요.';
        this.log(`⚙ ${this.pname(pid)}: ${c.num}번 장치 — ${seq.join(' ')}`, pid);
        if (seq.join('|') === c.solution.join('|')) {
          this.solved.add(v.card);
          this.log(`✅ 장치가 움직였다! ${c.okText || ''}`, pid, 'good');
          this.ev('solved', { key: v.card });
          if (c.discardSelf !== false) this.discardCard(v.card, true);
          this.reveal(c.result, pid);
        } else { this.wrong++; this.log('❌ 아무 반응이 없다.', pid, 'bad'); this.ev('wrong', { key: v.card }); this.addPenalty(1, pid); }
        return null;
      }
      case 'hint': {
        const c = this.card(v.card);
        if (!c || !this.has(v.card) || !c.hint || !c.hint.length) return '이 카드에는 힌트가 없어요.';
        const n = this.hints[v.card] || 0;
        if (n >= c.hint.length) return '모든 힌트를 이미 봤어요.';
        this.hints[v.card] = n + 1;
        this.log(`💡 ${this.pname(pid)}: ${c.num}번 힌트 ${n + 1} — ${c.hint[n]}`, pid, 'hint');
        return null;
      }
      case 'discard': {
        const c = this.card(v.card);
        if (!c || !this.has(v.card)) return '버릴 수 없어요.';
        if (c.type === 'place' && this.inPlay.filter((k) => this.card(k).type === 'place').length <= 1) return '마지막 장소는 버릴 수 없어요.';
        this.discardCard(v.card);
        return null;
      }
      case 'giveup': {
        this.endGame(false, '🏳 탈출을 포기했어요.');
        return null;
      }
      default: return '알 수 없는 행동입니다.';
    }
  }

  async run() {
    this.startAt = Date.now();
    if (!this.inPlay.length) {
      this.log(`📖 ${this.sc.title} — ${this.sc.intro}`);
      for (const k of this.sc.start) this.reveal(k, null);
    }
    this.changed();
    if (this.result) return this.result;
    return new Promise((res) => { this._done = res; });
  }

  // ───────────── 화면용 상태 ─────────────
  fill(text) { return String(text || '').replace(/\{@(\w+)\}/g, (_, k) => (this.sc.byKey[k] ? String(this.sc.byKey[k].num) : '?')); }
  view() {
    const card = (k) => {
      const c = this.card(k);
      return {
        key: k, num: c.num, type: c.type, title: c.title, text: this.fill(c.text), art: c.art || '', big: c.big || '',
        spots: (c.spots || []).map((s, i) => (s.hidden ? { x: s.x, y: s.y, hidden: true, num: s.num, found: this.spotsFound.has(`${k}#${i}`) }
          : { x: s.x, y: s.y, emoji: s.emoji || '', label: s.label, found: this.spotsFound.has(`${k}#${i}`) })),
        plus: c.plus != null ? { n: c.plus, color: c.plusColor || 'blue' } : null,
        buttons: c.type === 'machine' ? c.buttons : undefined, len: c.type === 'machine' ? c.solution.length : c.type === 'code' ? String(c.code).length : undefined,
        hints: c.hint ? c.hint.length : 0, hintsSeen: (c.hint || []).slice(0, this.hints[k] || 0), solved: this.solved.has(k), shows: (c.shows || []).map((s) => this.card(s).num),
      };
    };
    return {
      scenario: { id: this.sc.id, title: this.sc.title, orig: this.sc.orig, box: this.sc.box, diff: this.sc.diff, intro: this.sc.intro, theme: this.sc.theme || '' },
      cards: this.inPlay.map(card), goneCount: this.gone.size, total: this.sc.cards.length,
      deck: this.sc.cards.filter((c) => !this.has(c.key) && !this.gone.has(c.key)).map((c) => String(c.num)).sort((a, b) => (isNaN(a) - isNaN(b)) || (isNaN(a) ? a.localeCompare(b) : a - b)),
      elapsed: this.elapsed(), running: !this.result, startAt: this.startAt, timeBase: this.timeBase, penalties: this.penalties, penaltyMin: PENALTY_MIN, limitMin: this.sc.limit || LIMIT_MIN,
      hintsUsed: Object.values(this.hints).reduce((s, n) => s + n, 0), result: this.result, order: this.order, current: null, round: 0, phase: this.phase,
      players: this.players.map((p) => ({ id: p.id, name: p.name })),
      log: this.logs.slice(-80), events: this.events.slice(-20),
    };
  }
}

module.exports = { Game, GameOver, PENALTY_MIN, LIMIT_MIN };
