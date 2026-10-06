'use strict';
/* 킵 더 히어로즈 아웃 — 사운드 (정령섬 온라인과 같은 합성 엔진) (Web Audio API로 실시간 합성: 배경음악 + 효과음, 음원 파일 없음) */

const Sound = (() => {
  const SETTINGS_KEY = 'unlock-sound';
  const settings = { musicOn: true, sfxOn: true, music: 0.45, sfx: 0.7, shuffle: true };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch { /* 무시 */ }

  let ctx = null;
  let master; let musicBus; let sfxBus; let reverb; let reverbSend; let delay;
  let mood = 'calm';
  let pendingMood = 'calm';
  let scheduler = null;
  let nextBeatTime = 0;
  let beat = 0;
  let ocean = null;
  const lastPlayed = {};

  const save = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* 무시 */ } };
  const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

  // ───── 초기화 (첫 사용자 입력 후) ─────
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    // 믹스 버스 → 컴프레서 → 메이크업 게인 → 리미터 → 출력
    master = ctx.createDynamicsCompressor();
    master.threshold.value = -18; master.ratio.value = 3; master.attack.value = 0.01; master.release.value = 0.25;
    const makeup = ctx.createGain(); makeup.gain.value = 2.6;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.1;
    master.connect(makeup); makeup.connect(limiter); limiter.connect(ctx.destination);
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus.connect(master); sfxBus.connect(master);
    reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(3.2, 2.6);
    reverbSend = ctx.createGain(); reverbSend.gain.value = 0.9;
    reverbSend.connect(reverb); reverb.connect(master);
    delay = ctx.createDelay(1.5); delay.delayTime.value = 60 / 72 * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2400;
    delay.connect(dlp); dlp.connect(fb); fb.connect(delay); dlp.connect(reverbSend);
    const dOut = ctx.createGain(); dOut.gain.value = 0.5; dlp.connect(dOut); dOut.connect(musicBus);
    applyVolumes();
    if (settings.musicOn) startMusic();
  }

  function makeImpulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
    }
    return buf;
  }

  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    return s;
  }

  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    musicBus.gain.setTargetAtTime(settings.musicOn ? settings.music * 1.8 : 0, t, 0.3);
    sfxBus.gain.setTargetAtTime(settings.sfxOn ? settings.sfx : 0, t, 0.05);
  }

  // ───── 공통 음원 ─────
  function env(g, t, a, peak, d, sustain = 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
  }

  function tone({ freq, type = 'sine', t = ctx.currentTime, a = 0.005, d = 0.3, peak = 0.3, out = sfxBus, wet = 0.2, slideTo = null, detune = 0, filter = null }) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + a + d);
    const g = ctx.createGain();
    env(g, t, a, peak, d);
    let node = o;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = filter.type || 'lowpass'; f.frequency.value = filter.freq; f.Q.value = filter.q || 0.7; o.connect(f); node = f; }
    node.connect(g); g.connect(out);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(reverbSend); }
    o.start(t); o.stop(t + a + d + 0.05);
    return o;
  }

  function noiseHit({ t = ctx.currentTime, a = 0.002, d = 0.1, peak = 0.3, type = 'bandpass', freq = 2000, q = 1, sweepTo = null, out = sfxBus, wet = 0.1 }) {
    const s = noise();
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + a + d);
    const g = ctx.createGain(); env(g, t, a, peak, d);
    s.connect(f); f.connect(g); g.connect(out);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(reverbSend); }
    s.start(t, Math.random()); s.stop(t + a + d + 0.05);
  }

  function bell(freq, t, peak = 0.18, d = 1.6, out = sfxBus, wet = 0.35) {
    tone({ freq, t, a: 0.003, d, peak, out, wet });
    tone({ freq: freq * 2.76, t, a: 0.002, d: d * 0.35, peak: peak * 0.35, out, wet });
    tone({ freq: freq * 5.4, t, a: 0.001, d: d * 0.15, peak: peak * 0.15, out, wet });
  }

  function drum(t, peak = 0.7, out = sfxBus, low = 48) {
    tone({ freq: 140, slideTo: low, t, a: 0.003, d: 0.45, peak, out, wet: 0.25 });
    noiseHit({ t, d: 0.12, peak: peak * 0.35, type: 'lowpass', freq: 900, out, wet: 0.2 });
  }

  // ───── 효과음 ─────
  const SFX = {
    click() { tone({ freq: 1250, t: ctx.currentTime, d: 0.04, peak: 0.05, wet: 0 }); },
    select() { noiseHit({ d: 0.07, peak: 0.12, freq: 3200, q: 0.8, wet: 0.05 }); tone({ freq: 880, d: 0.06, peak: 0.05, wet: 0 }); },
    cardPlay() {
      const t = ctx.currentTime;
      noiseHit({ t, a: 0.04, d: 0.28, peak: 0.16, freq: 500, sweepTo: 4000, q: 1.2, wet: 0.2 });
      [74, 79, 81].forEach((m, i) => bell(mtof(m + 12), t + 0.12 + i * 0.06, 0.06, 0.8));
    },
    turn() { const t = ctx.currentTime; bell(mtof(81), t, 0.12, 1.4); bell(mtof(88), t + 0.14, 0.1, 1.6); },
    land() { tone({ freq: 320, slideTo: 140, d: 0.12, peak: 0.22, wet: 0.08 }); noiseHit({ d: 0.03, peak: 0.08, freq: 1500, wet: 0 }); },
    explore() { const t = ctx.currentTime; for (let i = 0; i < 3; i++) noiseHit({ t: t + i * 0.16, d: 0.05, peak: 0.12, type: 'lowpass', freq: 700, wet: 0.05 }); },
    build() {
      const t = ctx.currentTime;
      for (let i = 0; i < 2; i++) {
        tone({ freq: 210, type: 'square', t: t + i * 0.14, d: 0.05, peak: 0.08, filter: { freq: 1200 }, wet: 0.1 });
        noiseHit({ t: t + i * 0.14, d: 0.04, peak: 0.12, freq: 2500, wet: 0.08 });
      }
    },
    ravage() {
      const t = ctx.currentTime;
      drum(t, 0.45); drum(t + 0.22, 0.3);
      tone({ freq: 70, type: 'sawtooth', t, a: 0.05, d: 0.9, peak: 0.12, filter: { freq: 300 }, wet: 0.3 });
    },
    blight() {
      const t = ctx.currentTime;
      tone({ freq: 220, slideTo: 98, type: 'sawtooth', t, a: 0.05, d: 1.0, peak: 0.16, filter: { freq: 700 }, wet: 0.4 });
      tone({ freq: 233, slideTo: 104, type: 'sawtooth', t, a: 0.05, d: 1.0, peak: 0.13, filter: { freq: 700 }, wet: 0.4 });
    },
    destroy() {
      const t = ctx.currentTime;
      noiseHit({ t, a: 0.002, d: 0.55, peak: 0.2, type: 'lowpass', freq: 2500, sweepTo: 300, wet: 0.25 });
      tone({ freq: 110, slideTo: 40, t, d: 0.35, peak: 0.22, wet: 0.2 });
    },
    fear() {
      const t = ctx.currentTime;
      [88, 91, 95].forEach((m, i) => {
        const o = tone({ freq: mtof(m), t: t + i * 0.05, a: 0.08, d: 0.7, peak: 0.035, wet: 0.6 });
        o.detune.setValueAtTime(0, t); o.detune.linearRampToValueAtTime(-60, t + 0.8);
      });
    },
    fearCard() {
      const t = ctx.currentTime;
      [1, 2.4, 3.9, 5.3, 6.8].forEach((r, i) => tone({ freq: 98 * r, t, a: 0.004, d: 3.2 - i * 0.4, peak: 0.16 / (i + 1), wet: 0.5 }));
    },
    presence() { const t = ctx.currentTime; [74, 77, 79, 81, 84].forEach((m, i) => bell(mtof(m + 12), t + i * 0.055, 0.06, 0.7)); },
    phase() {
      const t = ctx.currentTime;
      [50, 57].forEach((m) => tone({ freq: mtof(m), type: 'sawtooth', t, a: 0.15, d: 0.9, peak: 0.06, filter: { freq: 900 }, wet: 0.5 }));
    },
    victory() {
      const t = ctx.currentTime;
      [62, 66, 69, 74, 78, 81].forEach((m, i) => bell(mtof(m + 12), t + i * 0.13, 0.12, 2.2));
      [50, 57, 62, 66].forEach((m) => tone({ freq: mtof(m), type: 'sawtooth', t: t + 0.6, a: 0.4, d: 2.8, peak: 0.05, filter: { freq: 1400 }, wet: 0.6 }));
    },
    defeat() {
      const t = ctx.currentTime;
      [62, 60, 58, 57].forEach((m, i) => tone({ freq: mtof(m), type: 'triangle', t: t + i * 0.45, a: 0.05, d: 1.0, peak: 0.2, wet: 0.5 }));
      drum(t + 1.8, 0.7, sfxBus, 38);
    },
    chat() { tone({ freq: 660, slideTo: 990, d: 0.08, peak: 0.08, wet: 0.1 }); },
    error() { tone({ freq: 160, type: 'square', d: 0.18, peak: 0.06, filter: { freq: 600 }, wet: 0 }); },
  };

  function play(name) {
    if (!ctx || !settings.sfxOn || !SFX[name]) return;
    const now = performance.now();
    if (lastPlayed[name] && now - lastPlayed[name] < 90) return;
    lastPlayed[name] = now;
    try { SFX[name](); } catch (e) { console.warn(e); }
  }

  // ───── 배경음악 (생성형, 여러 곡 무작위 재생) ─────
  // 곡마다 템포·음계·악기·리듬·배경 소리가 다르고, 몇 분마다 다른 곡으로 자연스럽게 넘어간다.
  const TRACKS = [
    { id: 'tick', name: '⏱ 째깍째깍 수수께끼', bpm: 104, lead: 'pluck', leadProb: 0.26, drums: 'shaker', amb: 'none', pad: 'soft',
      chords: [[45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [43, 50, 55, 59, 62], [40, 47, 52, 56, 59]], scale: [57, 59, 60, 62, 64, 67, 69, 72] },
    { id: 'mystery', name: '🕵 수상한 방', bpm: 76, lead: 'flute', leadProb: 0.2, drums: 'gong', amb: 'none', pad: 'drone',
      chords: [[38, 45, 50, 53, 57], [41, 48, 53, 56, 60], [36, 43, 48, 51, 55], [37, 44, 49, 52, 56]], scale: [50, 52, 53, 55, 57, 58, 61, 62] },
    { id: 'lab', name: '🧪 비밀 연구소', bpm: 118, lead: 'marimba', leadProb: 0.32, drums: 'shaker', amb: 'none', pad: 'soft', arp: true,
      chords: [[48, 55, 60, 63, 67], [44, 51, 56, 60, 63], [46, 53, 58, 62, 65], [43, 50, 55, 58, 62]], scale: [60, 62, 63, 65, 67, 68, 70, 72] },
    { id: 'chase', name: '🏃 시간이 없다!', bpm: 136, lead: 'brass', leadProb: 0.3, drums: 'march', amb: 'none', pad: 'warm',
      chords: [[45, 52, 57, 60, 64], [43, 50, 55, 59, 62], [41, 48, 53, 57, 60], [40, 47, 52, 56, 59]], scale: [57, 59, 60, 62, 64, 65, 67, 69] },
    { id: 'night', name: '🌙 한밤의 탐험', bpm: 84, lead: 'pluck', leadProb: 0.24, drums: 'none', amb: 'crickets', pad: 'warm',
      chords: [[50, 57, 62, 65, 69], [46, 53, 58, 62, 65], [48, 55, 60, 64, 67], [45, 52, 57, 60, 64]], scale: [62, 64, 65, 67, 69, 72, 74] },
  ];
  const BARS_PER_TRACK = 40; // 약 2~4분마다 곡 교체
  let track = TRACKS[Math.floor(Math.random() * TRACKS.length)];
  let trackBars = 0;
  let melodyIdx = 4;
  let onTrackChange = null;

  function pickNextTrack() {
    const others = TRACKS.filter((t) => t.id !== track.id);
    return others[Math.floor(Math.random() * others.length)];
  }

  function startMusic() {
    if (!ctx || scheduler) return;
    nextBeatTime = ctx.currentTime + 0.2;
    beat = 0;
    trackBars = 0;
    scheduler = setInterval(schedule, 100);
    setWaves(track.amb === 'water');
    if (onTrackChange) onTrackChange(track);
  }

  function stopMusic() {
    clearInterval(scheduler); scheduler = null;
    setWaves(false);
  }

  function nextTrack() {
    track = pickNextTrack();
    trackBars = 0;
    melodyIdx = 4;
    beat = 0;
    if (ctx) { setWaves(track.amb === 'water'); delay.delayTime.setTargetAtTime(60 / track.bpm * 0.75, ctx.currentTime, 0.1); }
    if (onTrackChange) onTrackChange(track);
  }

  function setWaves(on) {
    if (!ctx) return;
    if (on && !ocean) {
      const src = noise();
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
      const g = ctx.createGain(); g.gain.value = 0.0;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.18;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.025;
      const fl = ctx.createGain(); fl.gain.value = 300;
      lfo.connect(lfoGain); lfoGain.connect(g.gain); lfo.connect(fl); fl.connect(f.frequency);
      src.connect(f); f.connect(g); g.connect(musicBus);
      g.gain.setTargetAtTime(0.04, ctx.currentTime, 2);
      src.start(); lfo.start();
      ocean = { src, lfo, g };
    } else if (!on && ocean) {
      const o = ocean; ocean = null;
      o.g.gain.setTargetAtTime(0, ctx.currentTime, 1);
      setTimeout(() => { try { o.src.stop(); o.lfo.stop(); } catch { /* 무시 */ } }, 4000);
    }
  }

  // ── 화음 깔개 ──
  function pad(notes, t, dur, kind) {
    const conf = { soft: ['triangle', 1400, 0.022], warm: ['sawtooth', 900, 0.014], drone: ['sawtooth', 700, 0.016] }[kind] || ['triangle', 1400, 0.02];
    const voices = kind === 'drone' ? [notes[1], notes[2]] : notes.slice(1);
    for (const n of voices) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator(); o.type = conf[0]; o.frequency.value = mtof(n); o.detune.value = det;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(conf[1] * 0.7, t); f.Q.value = 0.4;
        f.frequency.linearRampToValueAtTime(conf[1], t + dur / 2);
        f.frequency.linearRampToValueAtTime(conf[1] * 0.7, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(conf[2], t + 1.6);
        g.gain.setValueAtTime(conf[2], t + dur - 0.5);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 2.0);
        o.connect(f); f.connect(g); g.connect(musicBus);
        const w = ctx.createGain(); w.gain.value = 0.7; g.connect(w); w.connect(reverbSend);
        o.start(t); o.stop(t + dur + 2.2);
      }
    }
    tone({ freq: mtof(notes[0] - 12), type: 'sine', t, a: 0.5, d: dur, peak: kind === 'drone' ? 0.12 : 0.08, out: musicBus, wet: 0.2 });
  }

  // ── 악기 ──
  function voiceOut(g, dly = 0.3, wet = 0.4) {
    g.connect(musicBus);
    const s = ctx.createGain(); s.gain.value = dly; g.connect(s); s.connect(delay);
    const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(reverbSend);
  }
  function pluck(midi, t, vel = 1) {
    const f = mtof(midi);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const mod = ctx.createOscillator(); mod.frequency.value = f * 3.5;
    const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 1.2, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.25);
    mod.connect(mg); mg.connect(o.frequency);
    const g = ctx.createGain(); env(g, t, 0.004, 0.07 * vel, 1.4);
    o.connect(g); voiceOut(g, 0.35, 0.4);
    o.start(t); mod.start(t); o.stop(t + 1.6); mod.stop(t + 1.6);
  }
  function marimba(midi, t, vel = 1) {
    const f = mtof(midi);
    for (const [mult, amp, dec] of [[1, 0.08, 0.7], [4, 0.025, 0.15], [10, 0.008, 0.05]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mult;
      const g = ctx.createGain(); env(g, t, 0.002, amp * vel, dec);
      o.connect(g); voiceOut(g, 0.25, 0.3);
      o.start(t); o.stop(t + dec + 0.2);
    }
  }
  function kalimba(midi, t, vel = 1) {
    const f = mtof(midi);
    for (const [mult, amp, dec] of [[1, 0.07, 1.6], [5.4, 0.012, 0.3]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mult;
      const g = ctx.createGain(); env(g, t, 0.003, amp * vel, dec);
      o.connect(g); voiceOut(g, 0.4, 0.5);
      o.start(t); o.stop(t + dec + 0.2);
    }
  }
  function flute(midi, t, vel = 1, dur = 1.4) {
    const f = mtof(midi);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
    const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + 0.5);
    vib.connect(vg); vg.connect(o.frequency);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06 * vel, t + 0.18);
    g.gain.setValueAtTime(0.06 * vel, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); voiceOut(g, 0.3, 0.6);
    noiseHit({ t, a: 0.05, d: 0.25, peak: 0.012 * vel, type: 'bandpass', freq: f * 2, q: 2, out: musicBus, wet: 0.3 });
    o.start(t); vib.start(t); o.stop(t + dur + 0.1); vib.stop(t + dur + 0.1);
  }
  function brass(midi, t, vel = 1, dur = 0.5) {
    const f = mtof(midi);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1;
    lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(2200, t + 0.06); lp.frequency.linearRampToValueAtTime(1100, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045 * vel, t + 0.05);
    g.gain.setValueAtTime(0.04 * vel, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.15);
    lp.connect(g); voiceOut(g, 0.2, 0.35);
    for (const det of [-8, 8]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.2);
    }
  }
  const LEADS = { pluck, marimba, kalimba, flute, brass };

  // ── 배경 소리 ──
  function bird(t) {
    const base = 2200 + Math.random() * 1800;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const tt = t + i * (0.09 + Math.random() * 0.05);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(base, tt); o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), tt + 0.06);
      const g = ctx.createGain(); env(g, tt, 0.005, 0.012, 0.08);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; o.connect(g); g.connect(pan); pan.connect(musicBus); } else { o.connect(g); g.connect(musicBus); }
      const w = ctx.createGain(); w.gain.value = 0.5; g.connect(w); w.connect(reverbSend);
      o.start(tt); o.stop(tt + 0.15);
    }
  }
  function cricket(t) {
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.06;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 4400 + Math.random() * 300;
      const g = ctx.createGain(); env(g, tt, 0.003, 0.006, 0.035);
      o.connect(g); g.connect(musicBus);
      o.start(tt); o.stop(tt + 0.06);
    }
  }

  function schedule() {
    if (!ctx) return;
    while (nextBeatTime < ctx.currentTime + 0.4) {
      const m = track;
      const spb = 60 / m.bpm;
      const t = nextBeatTime;
      const barBeat = beat % 8;
      if (barBeat === 0) {
        if (trackBars >= BARS_PER_TRACK && settings.shuffle !== false) nextTrack();
        const mm = track;
        const chord = mm.chords[Math.floor(beat / 8) % mm.chords.length];
        pad(chord, t, (60 / mm.bpm) * 8, mm.pad);
        if (mm.drums === 'gong' && Math.floor(beat / 8) % 2 === 0) bell(mtof(chord[0] + 12), t, 0.06, 4.5, musicBus, 0.6);
        trackBars += 2;
      }
      // 멜로디: 음계 위를 한두 칸씩 걸어 다니며 (가끔 쉼표)
      const lead = LEADS[m.lead] || pluck;
      const steps = m.lead === 'flute' ? [0] : [0, 0.5];
      for (const half of steps) {
        if (barBeat === 7 && half) continue; // 마디 끝 숨 고르기
        if (Math.random() < m.leadProb) {
          melodyIdx = Math.max(0, Math.min(m.scale.length - 1, melodyIdx + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
          const n = m.scale[melodyIdx];
          if (m.lead === 'flute') flute(n, t, 0.8 + Math.random() * 0.3, spb * (1.5 + Math.random()));
          else if (m.lead === 'brass') brass(n, t + half * spb, 0.8 + Math.random() * 0.3, spb * 0.45);
          else lead(n, t + half * spb + Math.random() * 0.015, 0.6 + Math.random() * 0.5);
        }
      }
      // 아르페지오 (모닥불)
      if (m.arp) {
        const chord = m.chords[Math.floor(beat / 8) % m.chords.length];
        const note = chord[1 + (beat % 4)] + 12;
        kalimba(note, t + spb * 0.5, 0.35);
      }
      // 리듬
      if (m.drums === 'shaker' || m.drums === 'tribal') {
        noiseHit({ t: t + spb / 2, d: 0.05, peak: 0.02, type: 'highpass', freq: 7000, out: musicBus, wet: 0.05 });
        noiseHit({ t, d: 0.03, peak: 0.012, type: 'highpass', freq: 8000, out: musicBus, wet: 0.05 });
      }
      if (m.drums === 'tribal') {
        if (barBeat === 0 || barBeat === 3 || barBeat === 5) drum(t, barBeat === 0 ? 0.3 : 0.2, musicBus, 46);
        if (barBeat === 2 || barBeat === 6) drum(t + spb / 2, 0.14, musicBus, 70);
        if (barBeat === 7) { drum(t, 0.12, musicBus, 80); drum(t + spb / 2, 0.14, musicBus, 64); }
      }
      if (m.drums === 'march') {
        if (barBeat % 2 === 0) drum(t, 0.26, musicBus, 44);
        if (barBeat % 2 === 1) noiseHit({ t, d: 0.12, peak: 0.07, type: 'bandpass', freq: 1800, q: 0.8, out: musicBus, wet: 0.15 });
        if (barBeat === 7) { noiseHit({ t: t + spb / 2, d: 0.08, peak: 0.05, type: 'bandpass', freq: 2000, out: musicBus, wet: 0.1 }); drum(t + spb * 0.75, 0.16, musicBus, 60); }
      }
      // 배경 소리
      if (m.amb === 'birds' && Math.random() < 0.07) bird(t + Math.random() * spb);
      if (m.amb === 'crickets' && Math.random() < 0.35) cricket(t + Math.random() * spb);
      nextBeatTime += spb;
      beat++;
    }
  }

  function setMood(m) { pendingMood = m; }

  // ───── 설정 ─────
  function set(key, value) {
    settings[key] = value;
    save();
    if (!ctx) return;
    if (key === 'musicOn') { if (value) startMusic(); else stopMusic(); }
    applyVolumes();
  }

  // 브라우저 정책상 첫 클릭/키 입력 이후에만 소리를 낼 수 있다
  const unlock = () => { init(); if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); };
  for (const ev of ['pointerdown', 'mousedown', 'click', 'touchend', 'keydown']) window.addEventListener(ev, unlock, { capture: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); });

  /** 테스트용: 소리 켜기 버튼에서 호출 */
  function test() { init(); if (ctx) ctx.resume().then(() => play('victory')).catch(() => {}); }

  return {
    play, setMood, set, settings, init, test, nextTrack, tracks: TRACKS,
    get track() { return track; }, set onTrack(fn) { onTrackChange = fn; },
    get started() { return !!ctx; }, get state() { return ctx ? ctx.state : 'none'; },
  };
})();
