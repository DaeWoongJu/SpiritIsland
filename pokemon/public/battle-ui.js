'use strict';
(() => {
// 배틀 화면: 서버가 보낸 일(events)을 차례로 보여 주고, 내 차례가 되면 메뉴를 띄운다
const G = window.G;

const TYPE_COLOR = { FIRE: '#f08030', WATER: '#6890f0', GRASS: '#78c850', ELECTRIC: '#f8d030', ICE: '#98d8d8', PSYCHIC_TYPE: '#f85888', DRAGON: '#7038f8', DARK: '#705848', GHOST: '#705898', POISON: '#a040a0', GROUND: '#e0c068', ROCK: '#b8a038', BUG: '#a8b820', FLYING: '#a890f0', FIGHTING: '#c03028', STEEL: '#b8b8d0', NORMAL: '#a8a878' };
G.TYPE_COLOR = TYPE_COLOR;

/** 하트골드풍 배틀 배경: 하늘·땅과 포켓몬이 서는 둥근 발판 */
function drawHgBackground(ctx) {
  const env = (G.ow && G.ow.map && G.ow.map.env) || 'ROUTE';
  const night = G.timeOfDay() === 2;
  const cave = env === 'CAVE' || env === 'DUNGEON';
  const indoor = env === 'INDOOR' || env === 'GATE';
  const sky = cave ? ['#4a3c34', '#6c5848'] : indoor ? ['#c8c0d8', '#e8e4f0'] : night ? ['#28305c', '#58609c'] : ['#78c0f8', '#d8f0f8'];
  const ground = cave ? ['#7c6450', '#5c4838'] : indoor ? ['#d8d0c0', '#b8b0a0'] : night ? ['#3c6c48', '#2c5038'] : ['#a8e070', '#78c050'];
  const pad = cave ? ['#a08068', '#806450'] : indoor ? ['#f0e8d8', '#c8c0b0'] : night ? ['#5c8c60', '#3c6444'] : ['#d0f0a0', '#90c860'];
  let g = ctx.createLinearGradient(0, 0, 0, 56);
  g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 160, 56);
  g = ctx.createLinearGradient(0, 56, 0, 96);
  g.addColorStop(0, ground[0]); g.addColorStop(1, ground[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 56, 160, 40);
  const plate = (cx, cy, rx, ry) => {
    ctx.fillStyle = pad[1]; ctx.beginPath(); ctx.ellipse(cx, cy + 2, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pad[0]; ctx.beginPath(); ctx.ellipse(cx, cy, rx - 2, ry - 1.5, 0, 0, Math.PI * 2); ctx.fill();
  };
  plate(124, 52, 34, 8);
  plate(38, 92, 42, 9);
}

class BattleScene {
  constructor(view) {
    this.view = view;
    this.queue = [];
    this.disp = {}; // 'side-slot' → { mon, hp, max, show, dx, dy, flash, status, alpha }
    this.intro = 60;
    this.busy = false;
    this.promptShown = null;
    this.ended = false;
    this.anim = null;
    this.weather = view.weather;
    this.trainerShow = view.kind === 'trainer' ? 1 : 0;
    this.meShow = 1;
    this.shake = 0;
    this.applyView(view, true);
    this.loop();
  }
  key(side, slot) { return `${side}-${slot}`; }
  /** 화면 위/아래: 내 편은 아래 */
  isMine(side) { return side === this.view.mySide; }
  applyView(view, initial = false) {
    this.view = view;
    view.sides.forEach((s, si) => s.slots.forEach((sl, i) => {
      const k = this.key(si, i);
      const d = this.disp[k] || (this.disp[k] = { show: false, dx: 0, dy: 0, alpha: 1 });
      if (initial) return;
      if (sl.mon && d.mon && d.mon.uid === sl.mon.uid) { d.mon = sl.mon; d.status = sl.mon.status; d.max = sl.mon.maxhp; if (!d.animHp) d.hp = sl.mon.hp; }
    }));
  }
  feed(events, view) {
    for (const e of events) this.queue.push(e);
    this.queue.push({ t: '__view', view });
  }
  async next() { while (!this.queue.length) await G.frame(); return this.queue.shift(); }

  async loop() {
    // 등장 연출
    G.sfx('select');
    for (let i = 0; i < 3; i++) { this.flashAll = true; await G.wait(5); this.flashAll = false; await G.wait(5); }
    this.intro = 0;
    for (;;) {
      const e = await this.next();
      try { await this.handle(e); } catch (err) { console.error(err); }
      if (this.closed) return;
    }
  }

  slotName(side, slot) {
    const d = this.disp[this.key(side, slot)];
    if (!d || !d.mon) return '';
    return d.mon.name;
  }

  async handle(e) {
    const d = e.side !== undefined ? this.disp[this.key(e.side, e.slot)] : null;
    switch (e.t) {
      case 'text': await G.say(e.s, { auto: G.settings.manualText ? 0 : 55 }); break;
      case 'trainertext': await G.say(e.s); break;
      case 'switch': {
        const dd = this.disp[this.key(e.side, e.slot)];
        dd.mon = e.mon; dd.hp = e.mon.hp; dd.max = e.mon.maxhp; dd.status = e.mon.status; dd.show = true; dd.alpha = 1; dd.dy = 0; dd.sub = false; dd.enterT = performance.now();
        if (this.isMine(e.side)) this.meShow = 0; else this.trainerShow = 0;
        dd.dx = this.isMine(e.side) ? -60 : 60;
        G.sfx('ball');
        for (let i = 0; i < 12; i++) { dd.dx *= 0.7; await G.wait(1); }
        dd.dx = 0;
        break;
      }
      case 'withdraw': if (d) { for (let i = 0; i < 8; i++) { d.alpha = 1 - i / 8; await G.wait(1); } d.show = false; d.alpha = 1; } break;
      case 'move': {
        const src = this.disp[this.key(e.side, e.slot)];
        if (src) { src.dx = this.isMine(e.side) ? 6 : -6; await G.wait(4); src.dx = 0; }
        if (e.target && e.power > 0) {
          const t = this.disp[this.key(e.target[0], e.target[1])];
          this.effect = { type: e.type, t: 0, target: e.target };
          await G.wait(14);
          this.effect = null;
          if (t) { G.sfx('hit'); for (let i = 0; i < 6; i++) { t.flash = i % 2 === 0; await G.wait(3); } t.flash = false; }
        } else if (e.target) {
          this.effect = { type: e.type, t: 0, target: e.target, status: true };
          await G.wait(16);
          this.effect = null;
        }
        break;
      }
      case 'hp': if (d) {
        const from = d.hp ?? e.hp, to = e.hp;
        d.max = e.max;
        d.animHp = true;
        const n = Math.min(40, Math.max(8, Math.abs(from - to)));
        for (let i = 1; i <= n; i++) { d.hp = Math.round(from + (to - from) * (i / n)); await G.wait(1); }
        d.hp = to; d.animHp = false;
        if (d.mon) d.mon.hp = to;
      } break;
      case 'status': if (d) d.status = e.status; break;
      case 'faint': if (d) { G.sfx('bump'); for (let i = 0; i < 12; i++) { d.dy = i * 5; await G.wait(1); } d.show = false; d.dy = 0; } break;
      case 'sub': if (d) d.sub = e.on; break;
      case 'transform': if (d && d.mon) d.mon = { ...d.mon, species: e.species }; break;
      case 'weather': this.weather = e.kind; break;
      case 'catch': {
        const t = this.disp[this.key(e.side, e.slot)];
        this.ball = { x: 30, y: 90, phase: 'throw', t: 0 };
        for (let i = 0; i <= 20; i++) { this.ball.x = 30 + (110 - 30) * i / 20; this.ball.y = 90 - Math.sin(Math.PI * i / 20) * 60 - 30 * i / 20; await G.wait(1); }
        if (t) t.show = false;
        G.sfx('ball');
        await G.wait(20);
        for (let s = 0; s < e.shakes; s++) { this.ball.shake = 1; await G.wait(8); this.ball.shake = -1; await G.wait(8); this.ball.shake = 0; await G.wait(16); }
        if (!e.ok) { if (t) t.show = true; this.ball = null; }
        else { G.sfx('level'); await G.wait(20); }
        break;
      }
      case 'level': G.sfx('level'); if (e.side !== null && e.side !== undefined) { const dd = this.disp[this.key(e.side, e.slot)]; if (dd && dd.mon) { dd.mon.level = e.level; dd.max = e.max; dd.hp = e.hp; } } break;
      case 'party': break;
      case 'end': this.over = true; break;
      case '__view': {
        this.applyView(e.view);
        this.ball = this.ball && this.ball.keep ? this.ball : (this.over ? this.ball : null);
        if (e.view.prompt && (!this.promptShown || this.promptShown !== e.view.prompt.key + ':' + e.view.turn + ':' + e.view.prompt.kind)) {
          this.promptShown = e.view.prompt.key + ':' + e.view.turn + ':' + e.view.prompt.kind;
          await this.doPrompt(e.view.prompt);
        }
        break;
      }
      case '__end': await this.finish(e.msg); break;
      default: break;
    }
  }

  async doPrompt(pr) {
    this.waiting = false;
    if (pr.kind === 'replace') {
      const i = await G.partyScreen({ mode: 'replace', party: pr.party, choices: pr.choices, battle: true });
      G.net.send({ t: 'act', key: pr.key, action: { party: i } });
      this.waiting = true;
      return;
    }
    for (;;) {
      const a = await this.chooseAction(pr);
      if (!a) continue;
      G.net.send({ t: 'act', key: pr.key, action: a });
      this.waiting = true;
      return;
    }
  }

  async chooseAction(pr) {
    const name = pr.mon.name;
    this.menuText = [G.josa(name, '은/는'), '무엇을', '할까?'];
    const pick = await G.choose(['싸운다', '포켓몬', '가방', this.view.kind === 'pvp' ? '항복' : '도망'], { x: 64, y: 96, w: 96, h: 48, cols: 2, lh: 16, noCancel: true, start: this.lastMain || 0 });
    this.lastMain = pick;
    this.menuText = null;
    if (pick === 0) {
      if (pr.struggle) return { type: 'move', i: 0 };
      const mi = await this.chooseMove(pr);
      if (mi < 0) return null;
      let target = pr.targets[0] ? pr.targets[0].key : null;
      if (pr.targets.length > 1) {
        const ti = await G.choose(pr.targets.map((t) => t.name), { x: 0, y: 96, w: 160, rows: 2 });
        if (ti < 0) return null;
        target = pr.targets[ti].key;
      }
      return { type: 'move', i: pr.moves[mi].i, target };
    }
    if (pick === 1) {
      const i = await G.partyScreen({ mode: 'battle', party: G.me.party, active: pr.active, canSwitch: pr.canSwitch, battle: true });
      if (i < 0) return null;
      if (!pr.canSwitch) { await G.say('교체할 수 없다!'); return null; }
      if (pr.active.includes(i)) { await G.say(`${G.josa(G.me.party[i].name, '은/는')} 이미 나와 있다!`); return null; }
      if (G.me.party[i].hp <= 0) { await G.say('싸울 기력이 없다!'); return null; }
      if (G.me.party[i].egg) { await G.say('알은 싸울 수 없다!'); return null; }
      return { type: 'switch', party: i };
    }
    if (pick === 2) {
      if (!pr.canItem) { await G.say('여기서는 도구를 쓸 수 없다!'); return null; }
      const res = await G.bagScreen({ mode: 'battle' });
      if (!res) return null;
      return { type: 'item', item: res.item, target: res.uid };
    }
    if (pick === 3) {
      if (this.view.kind === 'pvp') { if (await G.yesno('정말 항복하겠습니까?')) return { type: 'run' }; return null; }
      if (!pr.canRun) { await G.say('안 돼! 트레이너와의 승부에서 도망칠 수 없다!'); return null; }
      return { type: 'run' };
    }
    return null;
  }

  chooseMove(pr) {
    return new Promise((resolve) => {
      const scr = {
        i: this.lastMove && this.lastMove < pr.moves.length ? this.lastMove : 0,
        update: () => {
          const n = pr.moves.length;
          if (G.tap('up')) { scr.i = (scr.i - 1 + n) % n; G.sfx('move'); }
          if (G.tap('down')) { scr.i = (scr.i + 1) % n; G.sfx('move'); }
          if (G.input.pressed.a) {
            const m = pr.moves[scr.i];
            if (!m.ok) { G.pop(scr); G.say(m.pp <= 0 ? '기술의 남은 포인트가 없다!' : '그 기술은 쓸 수 없다!').then(() => resolve(-1)); return; }
            G.sfx('select'); this.lastMove = scr.i; G.pop(scr); resolve(scr.i);
          } else if (G.input.pressed.b) { G.pop(scr); resolve(-1); }
        },
        draw: (ctx) => {
          G.box(ctx, 0, 44, 72, 40);
          const m = pr.moves[scr.i];
          G.text(ctx, '타입/', 7, 49);
          G.text(ctx, G.typeName(m.type), 15, 60);
          G.text(ctx, `${m.pp}/${m.max}`, 65, 70, G.BLACK, 'right');
          G.box(ctx, 24, 84, 136, 60);
          pr.moves.forEach((mv, k) => {
            G.text(ctx, mv.name, 38, 90 + k * 12, mv.ok ? G.BLACK : '#888');
            if (k === scr.i) G.cursor(ctx, 30, 91 + k * 12);
          });
          for (let k = pr.moves.length; k < 4; k++) G.text(ctx, '-', 38, 90 + k * 12);
        },
      };
      G.push(scr);
    });
  }

  async finish(msg) {
    for (const p of msg.text || []) await G.say(p);
    for (const it of msg.post || []) await G.postItem(it);
    await G.fadeOut();
    this.closed = true;
    G.battle = null;
    await G.fadeIn();
    G.runDeferred();
  }

  // ───────── 그리기 ─────────
  draw(ctx) {
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, 0, 160, 144);
    if (G.useHG()) drawHgBackground(ctx);
    if (this.flashAll) { ctx.fillStyle = '#101010'; ctx.fillRect(0, 0, 160, 144); return; }
    const v = this.view;
    const mine = v.mySide, foe = 1 - v.mySide;
    const foeSlots = v.sides[foe].slots, mySlots = v.sides[mine].slots;
    const dbl = foeSlots.length > 1 || mySlots.length > 1;
    // 트레이너 그림 (시작할 때)
    if (this.trainerShow && v.trainer && v.trainer.pic) {
      const c = G.picCanvas(v.trainer.pic);
      if (c) ctx.drawImage(c, 96, 0);
    }
    // 상대 포켓몬
    foeSlots.forEach((sl, i) => {
      const d = this.disp[this.key(foe, i)];
      if (!d || !d.show || !d.mon) return;
      const x = dbl ? (i === 0 ? 50 : 102) : 96;
      this.drawMon(ctx, d, x + d.dx, 0 + d.dy, false);
    });
    // 내 포켓몬
    if (this.meShow && !mySlots.some((sl, i) => this.disp[this.key(mine, i)] && this.disp[this.key(mine, i)].show)) {
      const c = G.playerBack(G.me ? G.me.look : 0);
      if (c) ctx.drawImage(c, 8, 48);
    }
    mySlots.forEach((sl, i) => {
      const d = this.disp[this.key(mine, i)];
      if (!d || !d.show || !d.mon) return;
      const x = dbl ? (i === 0 ? 0 : 42) : 8;
      this.drawMon(ctx, d, x + d.dx, 48 + d.dy, true);
    });
    // 기술 효과
    if (this.effect) this.drawEffect(ctx);
    // 볼
    if (this.ball) { const b = this.ball; G.drawBall(ctx, Math.round(b.x + (b.shake || 0) * 2), Math.round(b.y)); }
    // 체력 상자
    if (!this.intro) {
      if (dbl) {
        foeSlots.forEach((sl, i) => { const d = this.disp[this.key(foe, i)]; if (d && d.show && d.mon) this.foeBoxSmall(ctx, d, 0, i * 22); });
        mySlots.forEach((sl, i) => { const d = this.disp[this.key(mine, i)]; if (d && d.show && d.mon) this.myBoxSmall(ctx, d, 88, 46 + i * 25); });
      } else {
        const fd = this.disp[this.key(foe, 0)];
        if (fd && fd.show && fd.mon) this.foeBox(ctx, fd);
        const md = this.disp[this.key(mine, 0)];
        if (md && md.show && md.mon) this.myBox(ctx, md);
      }
    }
    // 날씨
    if (this.weather) {
      ctx.fillStyle = this.weather === 'RAIN' ? 'rgba(80,120,248,0.5)' : this.weather === 'SUN' ? 'rgba(248,200,80,0.18)' : 'rgba(200,160,80,0.35)';
      if (this.weather === 'RAIN') for (let i = 0; i < 24; i++) { const t = (performance.now() / 6 + i * 37) % 96; ctx.fillRect((i * 53) % 160, t, 1, 4); }
      else ctx.fillRect(0, 0, 160, 96);
    }
    // 아래 글상자 자리
    G.box(ctx, 0, 96, 160, 48);
    if (this.menuText) { G.box(ctx, 0, 96, 160, 48); this.menuText.forEach((l, k) => G.text(ctx, l, 8, 101 + k * 13)); }
    else if (this.waiting && !this.queue.length && !G.uiBusy()) G.text(ctx, this.view.kind === 'pvp' || (this.view.sides[mine].slots.some((s) => s.ctrl !== G.me.id)) ? '상대를 기다리는 중…' : '…', 8, 103);
  }

  drawMon(ctx, d, x, y, back) {
    const s = G.W.species[d.mon.species];
    if (!s) return;
    if (d.sub) { ctx.fillStyle = '#c8a048'; ctx.fillRect(x + 14, y + 20, 22, 24); ctx.fillStyle = '#101010'; ctx.fillRect(x + 18, y + 26, 3, 3); ctx.fillRect(x + 28, y + 26, 3, 3); return; }
    if (d.flash) return;
    // 하트골드 그림 (80×80, 화면 크기에 맞춰 선명하게 줄임)
    const hg = G.useHG() && G.hgImg(`mon/${d.mon.species}.png`);
    if (hg) {
      const k = Math.max(1, Math.round(0.75 * G.R)) / G.R;
      const sz = 80 * k;
      const anim = !back && d.enterT !== undefined && performance.now() - d.enterT < 900 && Math.floor((performance.now() - d.enterT) / 220) % 2;
      ctx.globalAlpha = d.alpha ?? 1;
      ctx.save();
      ctx.beginPath(); ctx.rect(back ? x - 12 : x - 14, back ? y - 8 : 0, back ? 84 : 86, back ? 56 : 62); ctx.clip();
      ctx.drawImage(hg, back ? 160 : anim ? 80 : 0, d.mon.shiny ? 80 : 0, 80, 80, Math.round(x + (back ? 22 : 28) - sz / 2), Math.round(back ? y + 48 - sz * 0.88 : 60 - sz), sz, sz);
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }
    const c = G.picCanvas(back ? s.back : s.front);
    if (!c) return;
    ctx.globalAlpha = d.alpha ?? 1;
    const ox = back ? 0 : Math.floor((56 - c.width) / 2), oy = back ? 0 : 56 - c.height;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, back ? y : 0, back ? 56 : 64, back ? 48 : 56); ctx.clip();
    ctx.drawImage(c, Math.round(x + ox), Math.round(y + oy));
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawEffect(ctx) {
    const e = this.effect;
    e.t++;
    const foe = !this.isMine(e.target[0]);
    const v = this.view;
    const dbl = v.sides[0].slots.length > 1 || v.sides[1].slots.length > 1;
    let cx = foe ? (dbl ? (e.target[1] === 0 ? 78 : 130) : 124) : (dbl ? (e.target[1] === 0 ? 24 : 66) : 32);
    let cy = foe ? 30 : 72;
    ctx.fillStyle = TYPE_COLOR[e.type] || '#888';
    for (let i = 0; i < 6; i++) {
      const a = (e.t * 0.3 + i * Math.PI / 3);
      const r = e.status ? 18 - e.t : 4 + e.t * 1.2;
      ctx.fillRect(Math.round(cx + Math.cos(a) * r) - 2, Math.round(cy + Math.sin(a) * r) - 2, 4, 4);
    }
  }

  hpBar(ctx, x, y, w, hp, max) {
    ctx.fillStyle = G.BLACK;
    G.text(ctx, 'HP:', x - 18, y - 4);
    ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = '#f8f8f8'; ctx.fillRect(x, y, w, 3);
    const k = max ? Math.max(0, hp) / max : 0;
    ctx.fillStyle = k > 0.5 ? '#00b800' : k > 0.2 ? '#f8b800' : '#f80000';
    ctx.fillRect(x, y, Math.ceil(w * k), 3);
  }
  statusTag(ctx, st, x, y) {
    if (!st) return false;
    const label = { PSN: '독', TOX: '독', BRN: '화상', PAR: '마비', SLP: '잠듦', FRZ: '얼음' }[st];
    G.text(ctx, label, x, y);
    return true;
  }
  genderMark(m) { return m.gender === 'M' ? '♂' : m.gender === 'F' ? '♀' : ''; }

  /** 하트골드풍 체력 상자 판 */
  hgPanel(ctx, x, y, w, h) {
    if (!G.useHG() || !ctx.roundRect) return false;
    ctx.fillStyle = '#404850'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#fcfcf4'); g.addColorStop(1, '#e0e4d8');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x + 1, y + 1, w - 2, h - 2, 4); ctx.fill();
    return true;
  }
  foeBox(ctx, d) {
    const m = d.mon;
    const hg = this.hgPanel(ctx, 3, 1, 84, 31);
    G.text(ctx, m.name + this.genderMark(m), 8, 2);
    if (!this.statusTag(ctx, d.status, 48, 11)) G.text(ctx, `:L${m.level}`, 48, 11);
    this.hpBar(ctx, 30, 24, 48, d.hp, d.max);
    if (!hg) { ctx.fillStyle = G.BLACK; ctx.fillRect(8, 29, 1, 3); ctx.fillRect(8, 31, 76, 1); }
  }
  myBox(ctx, d) {
    const m = d.mon;
    const hg = this.hgPanel(ctx, 76, 48, 82, 47);
    G.text(ctx, m.name + this.genderMark(m), 80, 50);
    if (!this.statusTag(ctx, d.status, 120, 59)) G.text(ctx, `:L${m.level}`, 120, 59);
    this.hpBar(ctx, 104, 72, 48, d.hp, d.max);
    G.text(ctx, `${String(Math.max(0, d.hp)).padStart(3, ' ')}/${String(d.max).padStart(3, ' ')}`, 152, 77, G.BLACK, 'right');
    // 경험치 막대
    const full = G.me && G.me.party.find((p) => p.uid === m.uid);
    if (full && full.expNext > full.expBase) {
      const k = Math.min(1, (full.exp - full.expBase) / (full.expNext - full.expBase));
      ctx.fillStyle = G.BLACK; ctx.fillRect(87, 90, 66, 1);
      ctx.fillStyle = '#4890f8'; ctx.fillRect(153 - Math.round(64 * k), 91, Math.round(64 * k), 2);
    }
    if (!hg) { ctx.fillStyle = G.BLACK; ctx.fillRect(152, 82, 1, 8); }
  }
  foeBoxSmall(ctx, d, x, y) {
    const m = d.mon;
    ctx.fillStyle = 'rgba(248,248,248,0.85)'; ctx.fillRect(x, y, 56, 22);
    G.text(ctx, m.name, x + 2, y + 1);
    G.text(ctx, d.status ? { PSN: '독', TOX: '독', BRN: '화상', PAR: '마비', SLP: '잠듦', FRZ: '얼음' }[d.status] : `L${m.level}`, x + 54, y + 9, G.BLACK, 'right');
    this.miniBar(ctx, x + 2, y + 19, 40, d.hp, d.max);
  }
  myBoxSmall(ctx, d, x, y) {
    const m = d.mon;
    ctx.fillStyle = 'rgba(248,248,248,0.85)'; ctx.fillRect(x, y, 72, 25);
    G.text(ctx, m.name, x + 2, y);
    G.text(ctx, d.status ? { PSN: '독', TOX: '독', BRN: '화상', PAR: '마비', SLP: '잠듦', FRZ: '얼음' }[d.status] : `L${m.level}`, x + 70, y, G.BLACK, 'right');
    this.miniBar(ctx, x + 2, y + 12, 36, d.hp, d.max);
    G.text(ctx, `${Math.max(0, d.hp)}/${d.max}`, x + 70, y + 12, G.BLACK, 'right');
    if (m.owner && G.me && m.owner !== G.me.name) { ctx.fillStyle = '#4870d8'; ctx.fillRect(x, y, 2, 25); }
  }
  miniBar(ctx, x, y, w, hp, max) {
    ctx.fillStyle = G.BLACK; ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = '#f8f8f8'; ctx.fillRect(x, y, w, 2);
    const k = max ? Math.max(0, hp) / max : 0;
    ctx.fillStyle = k > 0.5 ? '#00b800' : k > 0.2 ? '#f8b800' : '#f80000';
    ctx.fillRect(x, y, Math.ceil(w * k), 2);
  }
}
G.BattleScene = BattleScene;

/** 서버에서 배틀 소식이 오면 */
G.onBattle = function onBattle(msg) {
  G.waitingBattle = 0;
  if (!G.battle || G.battle.closed) {
    if (msg.view.over && !msg.events.length) return;
    G.closeAllUI();
    G.battle = new BattleScene(msg.view);
    G.sfx('select');
  }
  G.battle.feed(msg.events, msg.view);
};
G.onBattleEnd = function onBattleEnd(msg) {
  if (G.battle) G.battle.queue.push({ t: '__end', msg });
};

/** 배틀 뒤: 기술 배우기 · 진화 */
G.postItem = async function postItem(it) {
  if (it.kind === 'learn') {
    const name = it.name, mv = it.moveName;
    await G.say([[`${G.josa(name, '은/는')} 새로`, `${G.josa(mv, '을/를')} 배우고 싶다…`], [`그러나 ${G.josa(name, '은/는')} 기술을`, '4개 알고 있다!']]);
    for (;;) {
      if (await G.yesno(`다른 기술을 잊게 해서 ${G.josa(mv, '을/를')} 배우게 하겠습니까?`)) {
        await G.say('어느 기술을 잊게 하겠습니까?');
        const i = await G.choose(it.moves, { x: 40, y: 32, w: 120, rows: 4 });
        if (i < 0) continue;
        await G.say([['1, 2, … 짠!'], [`${G.josa(name, '은/는')} ${G.josa(it.moves[i], '을/를')}`, '깨끗이 잊었다!'], ['그리고…'], [`${G.josa(name, '은/는')} 새로`, `${G.josa(mv, '을/를')} 배웠다!`]]);
        G.net.send({ t: 'learn', uid: it.uid, move: it.move, slot: i });
        return;
      }
      if (await G.yesno(`${G.josa(mv, '을/를')} 배우는 것을 포기하겠습니까?`)) {
        await G.say(`${G.josa(name, '은/는')} ${G.josa(mv, '을/를')} 배우지 않았다!`);
        G.net.send({ t: 'learn', uid: it.uid, move: it.move, slot: -1 });
        return;
      }
    }
  }
  if (it.kind === 'evolve') {
    const ok = await G.evolutionScene(it.from, it.into, it.name, it.intoName);
    G.net.send({ t: 'evolve', uid: it.uid, accept: ok });
  }
};

/** 진화 연출 (B 로 멈추기) */
G.evolutionScene = function evolutionScene(from, into, name, intoName) {
  return new Promise((resolve) => {
    let t = 0, stopped = false, phase = 'intro';
    const scr = {
      update() {
        if (phase === 'anim') {
          t++;
          if (G.input.pressed.b) { stopped = true; phase = 'done'; G.say(`어라? ${G.josa(name, '의')} 변화가 멈췄다!`).then(() => { G.pop(scr); resolve(false); }); }
          if (t > 240 && !stopped) { phase = 'done'; G.sfx('level'); G.say([['축하합니다!'], [`${G.josa(name, '은/는')}`, `${G.josa(intoName, '으로/로')} 진화했다!`]]).then(() => { G.pop(scr); resolve(true); }); }
        }
      },
      draw(ctx) {
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(0, 0, 160, 144);
        const show = phase === 'done' && !stopped ? into : phase === 'anim' ? (Math.floor(t / Math.max(2, 16 - t / 18)) % 2 ? into : from) : from;
        const c = G.picCanvas(G.W.species[show].front);
        if (c) ctx.drawImage(c, 52 + (56 - c.width) / 2, 24 + (56 - c.height));
        G.box(ctx, 0, 96, 160, 48);
      },
    };
    G.push(scr);
    G.say(`어라…!? ${G.josa(name, '의')} 상태가…!`).then(() => { phase = 'anim'; });
  });
};
})();
