'use strict';
(() => {
// 입력 · 글상자 · 메뉴 (게임보이 화면 위에 그리는 창들)
const G = window.G;

// ───────── 입력 ─────────
const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  KeyZ: 'a', Space: 'a', Enter: 'start', KeyX: 'b', Backspace: 'b', Escape: 'b', ShiftLeft: 'select', ShiftRight: 'select', KeyJ: 'a', KeyK: 'b',
};
G.input = { held: {}, pressed: {}, repeat: {} };
G.keyName = { a: 'Z', b: 'X', start: 'Enter', select: 'Shift' };
G.typing = () => { const el = document.activeElement; return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'); };
window.addEventListener('keydown', (e) => {
  if (G.typing()) return;
  const k = KEYMAP[e.code];
  if (!k) return;
  e.preventDefault();
  if (!G.input.held[k]) { G.input.pressed[k] = true; G.input.repeat[k] = performance.now() + 280; }
  G.input.held[k] = true;
});
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) G.input.held[k] = false; });
window.addEventListener('blur', () => { G.input.held = {}; });
G.press = (k) => { if (!G.input.held[k]) { G.input.pressed[k] = true; G.input.repeat[k] = performance.now() + 280; } G.input.held[k] = true; };
G.release = (k) => { G.input.held[k] = false; };
/** 메뉴용: 처음 눌렀을 때 + 오래 누르면 반복 */
G.tap = (k) => {
  if (G.input.pressed[k]) return true;
  if (G.input.held[k] && performance.now() >= (G.input.repeat[k] || 0)) { G.input.repeat[k] = performance.now() + 70; return true; }
  return false;
};
G.endFrameInput = () => { G.input.pressed = {}; };

// ───────── 글자 ─────────
G.FONT = '10px Galmuri9, "Galmuri9", monospace';
G.LINE = 16;
G.BLACK = '#101010';
G.WHITE = '#f8f8f8';
G.text = function text(ctx, s, x, y, color = G.BLACK, align = 'left') {
  ctx.font = G.FONT;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.textAlign = align;
  ctx.fillText(s, Math.round(x), Math.round(y));
  ctx.textAlign = 'left';
};
G.measure = function measure(ctx, s) { ctx.font = G.FONT; return ctx.measureText(s).width; };
G.fill = (s) => String(s).replace(/\{PLAYER\}/g, G.me ? G.me.name : '나').replace(/\{RIVAL\}/g, '라이벌');

/** 줄바꿈 (폭 안에 들어가게) */
G.wrap = function wrap(ctx, s, maxW) {
  const out = [];
  for (const raw of String(s).split('\n')) {
    let line = '';
    const words = raw.split(/(\s+)/);
    for (const w of words) {
      const tryLine = line + w;
      if (G.measure(ctx, tryLine) <= maxW) { line = tryLine; continue; }
      if (line.trim()) out.push(line.trim());
      line = w.trimStart();
      while (G.measure(ctx, line) > maxW) {
        let i = line.length;
        while (i > 1 && G.measure(ctx, line.slice(0, i)) > maxW) i--;
        out.push(line.slice(0, i)); line = line.slice(i);
      }
    }
    if (line.trim() || !out.length) out.push(line.trim());
  }
  return out;
};

// ───────── 창 테두리 (게임보이 글상자 모양) ─────────
G.box = function box(ctx, x, y, w, h) {
  ctx.fillStyle = G.WHITE; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = G.BLACK;
  ctx.fillRect(x + 1, y + 1, w - 2, 2); ctx.fillRect(x + 1, y + h - 3, w - 2, 2);
  ctx.fillRect(x + 1, y + 1, 2, h - 2); ctx.fillRect(x + w - 3, y + 1, 2, h - 2);
  ctx.fillRect(x + 4, y + 4, w - 8, 1); ctx.fillRect(x + 4, y + h - 5, w - 8, 1);
  ctx.fillRect(x + 4, y + 4, 1, h - 8); ctx.fillRect(x + w - 5, y + 4, 1, h - 8);
  ctx.fillStyle = G.WHITE;
  ctx.fillRect(x + 1, y + 1, 1, 1); ctx.fillRect(x + w - 2, y + 1, 1, 1); ctx.fillRect(x + 1, y + h - 2, 1, 1); ctx.fillRect(x + w - 2, y + h - 2, 1, 1);
};
G.cursor = function cursor(ctx, x, y, hollow = false) {
  ctx.fillStyle = G.BLACK;
  for (let i = 0; i < 4; i++) {
    if (hollow && i > 0 && i < 3) { ctx.fillRect(x + i, y + 1 + i, 1, 1); ctx.fillRect(x + i, y + 7 - i, 1, 1); ctx.fillRect(x, y + 1, 1, 7); continue; }
    ctx.fillRect(x + i, y + 1 + i, 1, 7 - i * 2);
  }
};
G.downArrow = function downArrow(ctx, x, y) {
  if (Math.floor(performance.now() / 300) % 2) return;
  ctx.fillStyle = G.BLACK;
  for (let i = 0; i < 4; i++) ctx.fillRect(x + i, y + i, 7 - i * 2, 1);
};

// ───────── 창 쌓기 ─────────
G.ui = [];
G.push = (scr) => { G.ui.push(scr); return scr; };
G.pop = (scr) => { const i = G.ui.lastIndexOf(scr); if (i >= 0) G.ui.splice(i, 1); };
G.top = () => G.ui[G.ui.length - 1];
G.uiBusy = () => G.ui.length > 0;

/** 글상자: paragraphs = [[줄, 줄], [줄]] 또는 문자열 */
G.say = function say(text, opts = {}) {
  return new Promise((resolve) => {
    let paras = Array.isArray(text) ? text : [[text]];
    paras = paras.map((p) => (Array.isArray(p) ? p : [p]));
    const scr = new TextBox(paras, opts, () => { G.pop(scr); resolve(); });
    G.push(scr);
  });
};

class TextBox {
  constructor(paras, opts, done) {
    this.opts = opts;
    this.done = done;
    this.pages = null;
    this.paras = paras;
    this.page = 0; this.chars = 0;
    this.auto = opts.auto || 0; // 자동으로 넘기기 (프레임)
    this.timer = 0;
  }
  layout(ctx) {
    const lines = [];
    for (const p of this.paras) {
      const ls = [];
      for (const l of p) ls.push(...G.wrap(ctx, G.fill(l), 142));
      for (let i = 0; i < ls.length; i += 2) lines.push(ls.slice(i, i + 2));
    }
    this.pages = lines.length ? lines : [['']];
  }
  update() {
    if (!this.pages) return;
    const cur = this.pages[this.page];
    const total = cur.join('').length;
    if (this.chars < total) {
      this.chars += G.input.held.a || G.input.held.b || G.settings.fastText ? 4 : 2;
      if (G.input.pressed.a || G.input.pressed.b) this.chars = total;
      return;
    }
    this.timer++;
    const last = this.page === this.pages.length - 1;
    if (this.opts.noWait && last) return;
    if ((this.auto && this.timer >= this.auto) || G.input.pressed.a || G.input.pressed.b) {
      if (!last) { this.page++; this.chars = 0; this.timer = 0; G.sfx('text'); } else this.done();
    }
  }
  draw(ctx) {
    if (!this.pages) this.layout(ctx);
    G.box(ctx, 0, 96, 160, 48);
    const cur = this.pages[this.page];
    let left = Math.floor(this.chars);
    cur.forEach((l, i) => {
      const s = l.slice(0, Math.max(0, left));
      left -= l.length;
      G.text(ctx, s, 8, 103 + i * G.LINE);
    });
    if (this.chars >= cur.join('').length && !this.opts.noWait && !this.auto) G.downArrow(ctx, 144, 134);
  }
}
G.TextBox = TextBox;

/** 메뉴 고르기 → 번호 (B 는 -1) */
G.choose = function choose(items, opts = {}) {
  return new Promise((resolve) => {
    const scr = new Menu(items, opts, (i) => { if (!opts.keepOpen) G.pop(scr); resolve(i); });
    G.push(scr);
  });
};

class Menu {
  constructor(items, opts, done) {
    this.items = items.map((it) => (typeof it === 'string' ? { label: it } : it));
    this.opts = opts;
    this.done = done;
    this.i = Math.max(0, Math.min(this.items.length - 1, opts.start || 0));
    this.scroll = 0;
    this.rows = opts.rows || Math.min(this.items.length, 7);
  }
  update() {
    const n = this.items.length;
    const cols = this.opts.cols || 1;
    if (cols > 1) {
      if (G.tap('up') && this.i - cols >= 0) { this.i -= cols; G.sfx('move'); }
      if (G.tap('down') && this.i + cols < n) { this.i += cols; G.sfx('move'); }
      if (G.tap('left') && this.i % cols > 0) { this.i--; G.sfx('move'); }
      if (G.tap('right') && this.i % cols < cols - 1 && this.i + 1 < n) { this.i++; G.sfx('move'); }
    } else {
      if (G.tap('up')) { this.i = (this.i - 1 + n) % n; G.sfx('move'); }
      if (G.tap('down')) { this.i = (this.i + 1) % n; G.sfx('move'); }
    }
    if (this.opts.onMove) this.opts.onMove(this.i);
    if (G.input.pressed.a) { const it = this.items[this.i]; if (it && !it.disabled) { G.sfx && G.sfx('select'); this.done(this.i); } }
    else if (G.input.pressed.b && !this.opts.noCancel) this.done(-1);
    if (this.i < this.scroll) this.scroll = this.i;
    if (this.i >= this.scroll + this.rows) this.scroll = this.i - this.rows + 1;
  }
  draw(ctx) {
    const lh = this.opts.lh || G.LINE;
    if (this.opts.cols > 1) {
      const { x, y, w, h, cols } = { x: 0, y: 96, w: 160, h: 48, ...this.opts };
      G.box(ctx, x, y, w, h);
      const cw = (w - 12) / cols;
      this.items.forEach((it, k) => {
        const cx = x + 6 + (k % cols) * cw, cy = y + 8 + Math.floor(k / cols) * lh;
        G.text(ctx, it.label, cx + 9, cy, it.disabled ? '#888' : G.BLACK);
        if (k === this.i) G.cursor(ctx, cx + 1, cy + 1);
      });
      return;
    }
    let w = this.opts.w;
    if (!w) { w = 0; for (const it of this.items) w = Math.max(w, G.measure(ctx, it.label) + (it.right ? G.measure(ctx, it.right) + 8 : 0)); w = Math.ceil(w) + 22; }
    const h = this.rows * lh + 14;
    let x = this.opts.x ?? 160 - w, y = this.opts.y ?? 0;
    if (this.opts.anchor === 'bottom') y = 144 - h - (this.opts.bottom || 0);
    G.box(ctx, x, y, w, h);
    for (let r = 0; r < this.rows; r++) {
      const k = this.scroll + r;
      const it = this.items[k];
      if (!it) break;
      const yy = y + 7 + r * lh;
      G.text(ctx, it.label, x + 14, yy, it.disabled ? '#888' : G.BLACK);
      if (it.right) G.text(ctx, it.right, x + w - 8, yy, G.BLACK, 'right');
      if (k === this.i) G.cursor(ctx, x + 6, yy + 1);
    }
    if (this.scroll > 0) { ctx.fillStyle = G.BLACK; ctx.fillRect(x + w - 10, y + 5, 3, 1); }
    if (this.scroll + this.rows < this.items.length) G.downArrow(ctx, x + w - 12, y + h - 8);
    if (this.opts.extra) this.opts.extra(ctx, this.i, { x, y, w, h });
  }
}
G.Menu = Menu;

G.yesno = async function yesno(question, opts = {}) {
  let tb = null;
  if (question) {
    // 질문은 글상자에 띄운 채로 둔다
    tb = new TextBox(Array.isArray(question) ? question : [[question]], { noWait: true }, () => {});
    G.push(tb);
    while (tb.pages === null || tb.page < tb.pages.length - 1 || tb.chars < tb.pages[tb.page].join('').length) await G.frame();
  }
  const i = await G.choose([opts.yes || '예', opts.no || '아니오'], { x: 160 - 56, y: 50, w: 56 });
  if (tb) G.pop(tb);
  return i === 0;
};

/** 다음 화면 갱신까지 기다리기 */
G.frameWaiters = [];
G.frame = () => new Promise((r) => G.frameWaiters.push(r));
G.wait = (frames) => new Promise((r) => { let n = frames; const tick = () => { if (--n <= 0) r(); else G.frameWaiters.push(tick); }; G.frameWaiters.push(tick); });

/** 숫자 고르기 (개수) */
G.chooseQty = function chooseQty(max, opts = {}) {
  return new Promise((resolve) => {
    const scr = {
      n: 1,
      update() {
        if (G.tap('up')) this.n = this.n >= max ? 1 : this.n + 1;
        if (G.tap('down')) this.n = this.n <= 1 ? max : this.n - 1;
        if (G.tap('right')) this.n = Math.min(max, this.n + 10);
        if (G.tap('left')) this.n = Math.max(1, this.n - 10);
        if (G.input.pressed.a) { G.pop(scr); resolve(this.n); }
        else if (G.input.pressed.b) { G.pop(scr); resolve(0); }
      },
      draw(ctx) {
        G.box(ctx, 88, 72, 72, 24);
        G.text(ctx, `×${String(this.n).padStart(2, '0')}`, 96, 79);
        if (opts.price) G.text(ctx, `${opts.price * this.n}원`, 154, 79, G.BLACK, 'right');
      },
    };
    G.push(scr);
  });
};

/** 잠깐 뜨는 알림 (화면 위쪽) */
G.toasts = [];
G.toast = (s) => { G.toasts.push({ s, t: 240 }); };
G.drawToasts = function drawToasts(ctx) {
  let y = 2;
  for (const t of G.toasts) {
    const lines = G.wrap(ctx, t.s, 148);
    const h = lines.length * 12 + 6;
    ctx.globalAlpha = Math.min(1, t.t / 30);
    ctx.fillStyle = 'rgba(16,16,16,0.85)'; ctx.fillRect(2, y, 156, h);
    lines.forEach((l, i) => G.text(ctx, l, 6, y + 3 + i * 12, G.WHITE));
    ctx.globalAlpha = 1;
    y += h + 2;
    t.t--;
  }
  G.toasts = G.toasts.filter((t) => t.t > 0);
};

// ───────── 소리 (간단한 효과음) ─────────
let actx = null;
G.settings = (() => { try { return JSON.parse(localStorage.getItem('pkgold-settings') || '{}'); } catch { return {}; } })();
G.saveSettings = () => { try { localStorage.setItem('pkgold-settings', JSON.stringify(G.settings)); } catch { /* 저장 안 됨 */ } };
G.sfx = function sfx(kind) {
  if (G.settings.mute) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'square';
    const t = actx.currentTime;
    const f = { move: [880, 0.03], select: [1320, 0.05], text: [660, 0.02], hit: [180, 0.12], bump: [120, 0.06], heal: [990, 0.3], ball: [520, 0.15], level: [1046, 0.25] }[kind] || [440, 0.05];
    o.frequency.setValueAtTime(f[0], t);
    if (kind === 'hit') o.frequency.exponentialRampToValueAtTime(60, t + f[1]);
    if (kind === 'heal' || kind === 'level') { o.frequency.setValueAtTime(f[0], t); o.frequency.setValueAtTime(f[0] * 1.25, t + 0.1); o.frequency.setValueAtTime(f[0] * 1.5, t + 0.2); }
    g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.0001, t + f[1]);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + f[1] + 0.02);
  } catch { /* 소리 없음 */ }
};
})();
