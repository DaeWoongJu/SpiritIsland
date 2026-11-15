'use strict';
/* 요괴 퇴마 디펜스 — 간단한 효과음 (WebAudio로 즉석에서 만듦, 파일 없음) */
const Sound = (() => {
  let ctx = null;
  let on = true;
  try { on = localStorage.getItem('defense-sound') !== 'off'; } catch { /* 무시 */ }
  let vol = 0.25;
  const last = {};
  function ac() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } } if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  function tone(freq, dur, type = 'sine', v = 1, slide = 0, delay = 0) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, v = 1, hp = 800) {
    const c = ac(); if (!c) return;
    const b = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = hp; s.buffer = b; g.gain.value = vol * v;
    s.connect(f).connect(g).connect(c.destination); s.start();
  }
  const SFX = {
    click: () => tone(660, 0.06, 'triangle', 0.5),
    summon: () => { tone(520, 0.1, 'triangle', 0.6, 300); },
    rare: () => { tone(660, 0.12, 'triangle', 0.7, 200); tone(990, 0.15, 'triangle', 0.5, 0, 0.08); },
    legend: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.7, 0, i * 0.08)); },
    myth: () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.35, 0, i * 0.07)); },
    merge: () => { tone(400, 0.18, 'square', 0.35, 500); },
    sell: () => { tone(880, 0.08, 'square', 0.3); tone(1320, 0.1, 'square', 0.25, 0, 0.06); },
    upgrade: () => { tone(300, 0.08, 'square', 0.35); tone(600, 0.12, 'square', 0.3, 0, 0.06); },
    wave: () => { tone(220, 0.35, 'sawtooth', 0.35, -60); },
    boss: () => { tone(110, 0.8, 'sawtooth', 0.6, -50); tone(116, 0.8, 'sawtooth', 0.5, -50); },
    leak: () => { tone(200, 0.25, 'square', 0.5, -120); },
    skill: () => { noise(0.4, 0.6, 400); tone(180, 0.4, 'sawtooth', 0.5, 400); },
    error: () => tone(160, 0.15, 'square', 0.4),
    win: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.7, 0, i * 0.14)); },
    lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.45, 'triangle', 0.6, 0, i * 0.22)); },
    hit: () => noise(0.05, 0.12, 2000),
    bless: () => { [784, 988, 1175].forEach((f, i) => tone(f, 0.3, 'sine', 0.6, 0, i * 0.1)); },
    ping: () => { tone(1200, 0.12, 'sine', 0.5); tone(1500, 0.12, 'sine', 0.4, 0, 0.1); },
  };
  return {
    play(name) {
      if (!on || !SFX[name]) return;
      const now = performance.now();
      if (last[name] && now - last[name] < 60) return;
      last[name] = now;
      try { SFX[name](); } catch { /* 무시 */ }
    },
    get on() { return on; },
    toggle() { on = !on; try { localStorage.setItem('defense-sound', on ? 'on' : 'off'); } catch { /* 무시 */ } if (on) this.play('click'); return on; },
  };
})();
