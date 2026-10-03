'use strict';
/* 정령섬 온라인 — 정령 초상화 (오리지널 SVG 일러스트, 정령 테마에 맞춰 절차적으로 그림)
   공식 일러스트는 저작권 때문에 포함하지 않는다. custom-art 폴더에 그림을 넣으면 그 그림을 대신 쓴다. */

const SpiritArt = (() => {
  const W = 320;
  const H = 180;
  const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  // ───── 그림 요소 ─────
  const M = {
    glow: (P, cx, cy, r, c, o = 0.8) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" opacity="${o}" filter="url(#${P}b)"/>`,
    stars: (P, R, n = 40, c = '#fff') => Array.from({ length: n }, () => `<circle cx="${(R() * W).toFixed(1)}" cy="${(R() * H * 0.7).toFixed(1)}" r="${(R() * 1.3 + 0.3).toFixed(2)}" fill="${c}" opacity="${(R() * 0.7 + 0.3).toFixed(2)}"/>`).join(''),
    moon: (P, cx, cy, r, c = '#f3f0ff') => `${M.glow(P, cx, cy, r * 1.8, c, 0.35)}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/><circle cx="${cx + r * 0.45}" cy="${cy - r * 0.2}" r="${r * 0.9}" fill="url(#${P}sky)"/>`,
    sun: (P, cx, cy, r, c = '#ffd86b') => `${M.glow(P, cx, cy, r * 2.4, c, 0.5)}<g stroke="${c}" stroke-width="3" opacity=".8">${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<line x1="${cx + Math.cos(a) * r * 1.25}" y1="${cy + Math.sin(a) * r * 1.25}" x2="${cx + Math.cos(a) * r * 1.8}" y2="${cy + Math.sin(a) * r * 1.8}"/>`; }).join('')}</g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.6}" fill="#fff6d6" opacity=".7"/>`,
    mountains: (P, R, y, c, n = 5, h = 70) => { let d = `M0 ${H}L0 ${y}`; for (let i = 0; i <= n; i++) { const x = (i / n) * W; d += `L${x - W / n / 2} ${y - R() * h - 15}L${x} ${y - R() * 15}`; } return `<path d="${d}L${W} ${y}L${W} ${H}Z" fill="${c}"/>`; },
    snowpeak: (P, cx, base, w, h, c = '#7b828a') => `<path d="M${cx - w} ${base}L${cx} ${base - h}L${cx + w} ${base}Z" fill="${c}"/><path d="M${cx - w * 0.28} ${base - h * 0.72}L${cx} ${base - h}L${cx + w * 0.28} ${base - h * 0.72}L${cx + w * 0.1} ${base - h * 0.66}L${cx - w * 0.08} ${base - h * 0.75}Z" fill="#f4f7fa"/>`,
    volcano: (P, cx, base, c = '#4a2a20') => `${M.glow(P, cx, base - 95, 40, '#ff6a2a', 0.7)}<path d="M${cx - 120} ${base}L${cx - 22} ${base - 90}L${cx + 22} ${base - 90}L${cx + 120} ${base}Z" fill="${c}"/><path d="M${cx - 22} ${base - 90}Q${cx - 10} ${base - 60} ${cx - 18} ${base - 30}L${cx - 8} ${base - 35}Q${cx} ${base - 65} ${cx + 22} ${base - 90}Z" fill="#ff7a2a"/><path d="M${cx - 12} ${base - 92}Q${cx - 30} ${base - 130} ${cx - 8} ${base - 160}Q${cx + 10} ${base - 125} ${cx + 30} ${base - 150}Q${cx + 22} ${base - 115} ${cx + 12} ${base - 92}Z" fill="#5a5050" opacity=".7"/>`,
    ground: (P, y, c) => `<path d="M0 ${y}Q${W * 0.25} ${y - 10} ${W * 0.5} ${y}T${W} ${y}L${W} ${H}L0 ${H}Z" fill="${c}"/>`,
    waves: (P, y, c, n = 3, amp = 6, o = 0.9) => Array.from({ length: n }, (_, i) => { const yy = y + i * 14; let d = `M0 ${yy}`; for (let x = 0; x <= W; x += 40) d += `Q${x + 10} ${yy - amp} ${x + 20} ${yy}T${x + 40} ${yy}`; return `<path d="${d}L${W} ${H}L0 ${H}Z" fill="${c}" opacity="${o - i * 0.15}"/>`; }).join(''),
    rain: (P, R, c = '#bfe3ff', n = 60) => `<g stroke="${c}" stroke-width="1.3" opacity=".55">${Array.from({ length: n }, () => { const x = R() * W; const y = R() * H; return `<line x1="${x}" y1="${y}" x2="${x - 5}" y2="${y + 14}"/>`; }).join('')}</g>`,
    bolt: (P, x, y, s, c = '#fff3a0') => `${M.glow(P, x, y + 40 * s, 40 * s, c, 0.55)}<path d="M${x} ${y}L${x - 18 * s} ${y + 50 * s}L${x - 2 * s} ${y + 50 * s}L${x - 14 * s} ${y + 100 * s}L${x + 22 * s} ${y + 38 * s}L${x + 5 * s} ${y + 38 * s}L${x + 16 * s} ${y}Z" fill="${c}"/>`,
    flame: (P, cx, cy, s, c = '#ff7a2a', c2 = '#ffd27a') => `${M.glow(P, cx, cy - 20 * s, 34 * s, c, 0.6)}<path d="M${cx} ${cy - 60 * s}C${cx + 10 * s} ${cy - 35 * s} ${cx + 32 * s} ${cy - 25 * s} ${cx + 28 * s} ${cy}A${28 * s} ${28 * s} 0 0 1 ${cx - 28 * s} ${cy}C${cx - 30 * s} ${cy - 20 * s} ${cx - 12 * s} ${cy - 30 * s} ${cx} ${cy - 60 * s}Z" fill="${c}"/><path d="M${cx} ${cy - 30 * s}C${cx + 6 * s} ${cy - 18 * s} ${cx + 14 * s} ${cy - 12 * s} ${cx + 12 * s} ${cy}A${12 * s} ${12 * s} 0 0 1 ${cx - 12 * s} ${cy}C${cx - 12 * s} ${cy - 10 * s} ${cx - 4 * s} ${cy - 18 * s} ${cx} ${cy - 30 * s}Z" fill="${c2}"/>`,
    pines: (P, R, y, n, c) => Array.from({ length: n }, () => { const x = R() * W; const h = 30 + R() * 40; return `<path d="M${x} ${y - h}L${x - h * 0.3} ${y}L${x + h * 0.3} ${y}Z" fill="${c}"/>`; }).join(''),
    canopy: (P, R, y, n, c, c2) => Array.from({ length: n }, () => { const x = R() * W; const r = 16 + R() * 18; return `<rect x="${x - 2}" y="${y - r}" width="4" height="${r}" fill="#3a2a18"/><circle cx="${x}" cy="${y - r}" r="${r}" fill="${R() < 0.5 ? c : c2}"/>`; }).join(''),
    vines: (P, R, c, n = 6) => `<g stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".9">${Array.from({ length: n }, () => { const x = R() * W; return `<path d="M${x} ${H}C${x + 30} ${H - 60} ${x - 30} ${H - 100} ${x + 10 * (R() - 0.5)} ${H - 150 - R() * 30}"/>`; }).join('')}</g><g fill="${c}">${Array.from({ length: n * 4 }, () => `<ellipse cx="${R() * W}" cy="${H - R() * 150}" rx="7" ry="4" transform="rotate(${R() * 180})"/>`).join('')}</g>`,
    eye: (P, cx, cy, s, c = '#ffd86b') => `${M.glow(P, cx, cy, 22 * s, c, 0.5)}<path d="M${cx - 30 * s} ${cy}Q${cx} ${cy - 20 * s} ${cx + 30 * s} ${cy}Q${cx} ${cy + 20 * s} ${cx - 30 * s} ${cy}Z" fill="${c}"/><circle cx="${cx}" cy="${cy}" r="${9 * s}" fill="#120a04"/><ellipse cx="${cx}" cy="${cy}" rx="${2.5 * s}" ry="${8 * s}" fill="${c}" opacity=".7"/>`,
    swirl: (P, cx, cy, r, c = '#e8f4ff', o = 0.7) => `<g fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round" opacity="${o}">${[1, 0.72, 0.46].map((k, i) => `<path d="M${cx + r * k} ${cy}A${r * k} ${r * k * 0.7} 0 1 0 ${cx} ${cy + r * k * 0.7 * (i % 2 ? -1 : 1)}"/>`).join('')}</g>`,
    serpent: (P, c = '#4d7a2a', y = 130) => `<path d="M-10 ${y}C40 ${y - 50} 80 ${y + 40} 130 ${y - 10}S220 ${y - 60} 260 ${y - 10}S300 ${y + 10} 330 ${y - 20}" stroke="${c}" stroke-width="22" fill="none" stroke-linecap="round"/><path d="M-10 ${y}C40 ${y - 50} 80 ${y + 40} 130 ${y - 10}S220 ${y - 60} 260 ${y - 10}S300 ${y + 10} 330 ${y - 20}" stroke="#c9e08a" stroke-width="3" fill="none" stroke-dasharray="4 10" opacity=".7"/><circle cx="300" cy="${y - 14}" r="3" fill="#ffd84a"/>`,
    fangs: (P, cx, cy, s, c = '#f3ead6') => `<g fill="${c}">${[-1, 1].map((d) => `<path d="M${cx + d * 18 * s} ${cy}L${cx + d * 10 * s} ${cy + 34 * s}L${cx + d * 4 * s} ${cy}Z"/>`).join('')}</g>${M.eye(P, cx - 40 * s, cy - 24 * s, 0.6 * s, '#ffb02e')}${M.eye(P, cx + 40 * s, cy - 24 * s, 0.6 * s, '#ffb02e')}`,
    birds: (P, R, n, c = '#1d1a14') => `<g stroke="${c}" stroke-width="2.4" fill="none" stroke-linecap="round">${Array.from({ length: n }, () => { const x = R() * W; const y = 20 + R() * 100; const s = 4 + R() * 7; return `<path d="M${x - s} ${y}Q${x - s / 2} ${y - s * 0.7} ${x} ${y}Q${x + s / 2} ${y - s * 0.7} ${x + s} ${y}"/>`; }).join('')}</g>`,
    figures: (P, xs, y, c = '#1a120a') => xs.map((x) => `<g fill="${c}"><circle cx="${x}" cy="${y - 34}" r="6"/><path d="M${x - 8} ${y}L${x - 5} ${y - 26}L${x + 5} ${y - 26}L${x + 8} ${y}Z"/><rect x="${x + 9}" y="${y - 48}" width="2" height="48"/><path d="M${x + 7} ${y - 48}L${x + 10} ${y - 56}L${x + 13} ${y - 48}Z"/></g>`).join(''),
    mask: (P, cx, cy, s, c = '#f2c94c') => `${M.glow(P, cx, cy, 40 * s, c, 0.4)}<ellipse cx="${cx}" cy="${cy}" rx="${42 * s}" ry="${50 * s}" fill="${c}"/><path d="M${cx - 26 * s} ${cy - 12 * s}q8 -10 16 0" stroke="#2a1a04" stroke-width="${4 * s}" fill="none"/><path d="M${cx + 10 * s} ${cy - 12 * s}q8 -10 16 0" stroke="#2a1a04" stroke-width="${4 * s}" fill="none"/><path d="M${cx - 28 * s} ${cy + 12 * s}Q${cx} ${cy + 42 * s} ${cx + 28 * s} ${cy + 12 * s}Q${cx} ${cy + 26 * s} ${cx - 28 * s} ${cy + 12 * s}Z" fill="#2a1a04"/>`,
    spiral: (P, cx, cy, c = '#d8ccff') => { let d = `M${cx} ${cy}`; for (let a = 0; a < Math.PI * 7; a += 0.3) { const r = 3 + a * 6; d += `L${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r * 0.7}`; } return `<path d="${d}" stroke="${c}" stroke-width="2.5" fill="none" opacity=".75"/>`; },
    constellation: (P, R, c = '#dfe8ff') => { const pts = Array.from({ length: 8 }, () => [40 + R() * 240, 20 + R() * 100]); return `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" stroke="${c}" stroke-width="1" fill="none" opacity=".5"/>${pts.map(([x, y]) => `${M.glow(P, x, y, 6, c, 0.6)}<circle cx="${x}" cy="${y}" r="2.4" fill="#fff"/>`).join('')}`; },
    cracks: (P, R, c = '#ff9a5a', n = 5) => `<g stroke="${c}" stroke-width="2.2" fill="none" opacity=".9">${Array.from({ length: n }, () => { let x = R() * W; let y = H; let d = `M${x} ${y}`; for (let i = 0; i < 5; i++) { x += (R() - 0.5) * 40; y -= 12 + R() * 14; d += `L${x} ${y}`; } return `<path d="${d}"/>`; }).join('')}</g>`,
    shards: (P, R, c = '#e9d8ff') => Array.from({ length: 9 }, () => { const x = R() * W; const y = R() * H; const s = 8 + R() * 18; return `<path d="M${x} ${y - s}L${x + s * 0.6} ${y}L${x} ${y + s}L${x - s * 0.5} ${y}Z" fill="${c}" opacity="${0.3 + R() * 0.5}"/>`; }).join(''),
    skull: (P, cx, cy, s, c = '#e8d9c0') => `<circle cx="${cx}" cy="${cy}" r="${22 * s}" fill="${c}"/><rect x="${cx - 12 * s}" y="${cy + 12 * s}" width="${24 * s}" height="${14 * s}" rx="${3 * s}" fill="${c}"/><circle cx="${cx - 8 * s}" cy="${cy}" r="${6 * s}" fill="#3a0a0a"/><circle cx="${cx + 8 * s}" cy="${cy}" r="${6 * s}" fill="#3a0a0a"/>`,
    hourglass: (P, cx, cy, s, c = '#e6d3ff') => `<path d="M${cx - 22 * s} ${cy - 40 * s}H${cx + 22 * s}L${cx + 4 * s} ${cy}L${cx + 22 * s} ${cy + 40 * s}H${cx - 22 * s}L${cx - 4 * s} ${cy}Z" fill="none" stroke="${c}" stroke-width="${4 * s}"/><path d="M${cx - 14 * s} ${cy + 34 * s}H${cx + 14 * s}L${cx} ${cy + 14 * s}Z" fill="${c}"/>`,
    roots: (P, R, c = '#4a3420', n = 7) => `<g stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round">${Array.from({ length: n }, () => { const x = 120 + R() * 80; return `<path d="M${x} ${H - 40}C${x + (R() - 0.5) * 80} ${H - 20} ${x + (R() - 0.5) * 160} ${H} ${x + (R() - 0.5) * 220} ${H + 10}"/>`; }).join('')}</g>`,
    bigtree: (P, cx, base, c = '#2e6b30') => `<path d="M${cx - 14} ${base}L${cx - 8} ${base - 90}L${cx + 8} ${base - 90}L${cx + 14} ${base}Z" fill="#4a3420"/><circle cx="${cx}" cy="${base - 110}" r="48" fill="${c}"/><circle cx="${cx - 38}" cy="${base - 88}" r="30" fill="${c}"/><circle cx="${cx + 38}" cy="${base - 90}" r="32" fill="${c}"/><circle cx="${cx - 12}" cy="${base - 128}" r="22" fill="#4a9a4a" opacity=".6"/>`,
    mist: (P, R, c = '#e8f0f8', n = 8) => Array.from({ length: n }, () => `<ellipse cx="${R() * W}" cy="${40 + R() * 120}" rx="${60 + R() * 70}" ry="${12 + R() * 14}" fill="${c}" opacity="${0.15 + R() * 0.25}" filter="url(#${P}b)"/>`).join(''),
    tentacles: (P, R, c = '#1e4f80') => Array.from({ length: 4 }, (_, i) => { const x = 40 + i * 80 + R() * 20; return `<path d="M${x} ${H + 5}C${x - 20} ${H - 50} ${x + 30} ${H - 80} ${x + 5} ${H - 120}C${x - 5} ${H - 130} ${x - 14} ${H - 115} ${x - 6} ${H - 100}C${x + 8} ${H - 80} ${x - 30} ${H - 50} ${x - 14} ${H + 5}Z" fill="${c}"/>`; }).join(''),
    teeth: (P, y, c = '#efe6d0') => `<path d="M0 ${y}${Array.from({ length: 10 }, (_, i) => `L${i * 32 + 16} ${y - 26}L${i * 32 + 32} ${y}`).join('')}L${W} ${H}L0 ${H}Z" fill="#2a120c"/><g fill="${c}">${Array.from({ length: 10 }, (_, i) => `<path d="M${i * 32 + 4} ${y}L${i * 32 + 16} ${y - 22}L${i * 32 + 28} ${y}Z"/>`).join('')}</g>`,
    bubbles: (P, R, c = '#8a7a52', n = 14) => Array.from({ length: n }, () => `<circle cx="${R() * W}" cy="${110 + R() * 70}" r="${2 + R() * 7}" fill="none" stroke="${c}" stroke-width="1.6" opacity=".7"/>`).join(''),
    dunes: (P, y, c, c2) => `<path d="M0 ${y}C80 ${y - 30} 140 ${y - 30} 200 ${y}S300 ${y - 20} ${W} ${y - 10}L${W} ${H}L0 ${H}Z" fill="${c}"/><path d="M0 ${y + 25}C70 ${y + 5} 160 ${y + 5} 230 ${y + 25}S300 ${y + 20} ${W} ${y + 15}L${W} ${H}L0 ${H}Z" fill="${c2}"/>`,
    haze: (P, c = '#ffd9a0') => `<g stroke="${c}" stroke-width="2" fill="none" opacity=".45">${[60, 80, 100].map((y) => `<path d="M0 ${y}${Array.from({ length: 8 }, (_, i) => `Q${i * 40 + 20} ${y - 6} ${i * 40 + 40} ${y}`).join('')}"/>`).join('')}</g>`,
    arcs: (P, cx, cy, c = '#d8c8ff') => `<g stroke="${c}" fill="none" stroke-width="3" stroke-linecap="round">${[20, 38, 56, 74].map((r, i) => `<path d="M${cx + r * 0.7} ${cy - r * 0.7}A${r} ${r} 0 0 1 ${cx + r * 0.7} ${cy + r * 0.7}" opacity="${0.9 - i * 0.18}"/><path d="M${cx - r * 0.7} ${cy - r * 0.7}A${r} ${r} 0 0 0 ${cx - r * 0.7} ${cy + r * 0.7}" opacity="${0.9 - i * 0.18}"/>`).join('')}</g>`,
    drop: (P, cx, cy, s, c = '#c0303a') => `${M.glow(P, cx, cy, 30 * s, c, 0.5)}<path d="M${cx} ${cy - 40 * s}C${cx + 10 * s} ${cy - 20 * s} ${cx + 26 * s} ${cy - 2 * s} ${cx + 26 * s} ${cy + 12 * s}A${26 * s} ${26 * s} 0 0 1 ${cx - 26 * s} ${cy + 12 * s}C${cx - 26 * s} ${cy - 2 * s} ${cx - 10 * s} ${cy - 20 * s} ${cx} ${cy - 40 * s}Z" fill="${c}"/>`,
    hut: (P, cx, base, c = '#3a2414') => `<rect x="${cx - 26}" y="${base - 30}" width="52" height="30" fill="${c}"/><path d="M${cx - 36} ${base - 28}L${cx} ${base - 62}L${cx + 36} ${base - 28}Z" fill="#5a3a1e"/><rect x="${cx - 8}" y="${base - 20}" width="16" height="20" fill="#ffb347"/>`,
    boulders: (P, R, y, c = '#7d7a74') => Array.from({ length: 6 }, (_, i) => { const x = 20 + i * 55 + R() * 20; const r = 18 + R() * 24; return `<ellipse cx="${x}" cy="${y}" rx="${r * 1.2}" ry="${r}" fill="${c}"/><ellipse cx="${x - r * 0.3}" cy="${y - r * 0.4}" rx="${r * 0.4}" ry="${r * 0.2}" fill="#fff" opacity=".18"/>`; }).join(''),
    path: (P, c = '#c9b98a') => `<path d="M120 ${H}C140 140 190 130 170 100S150 70 165 55" stroke="${c}" stroke-width="10" fill="none" stroke-linecap="round" opacity=".7" stroke-dasharray="2 14"/>`,
    footprints: (P, R, c = '#c9b98a') => Array.from({ length: 7 }, (_, i) => `<ellipse cx="${60 + i * 34}" cy="${150 - i * 10 + (i % 2) * 8}" rx="5" ry="8" fill="${c}" opacity=".6"/>`).join(''),
    beasteyes: (P, R, n, c = '#ff6a2a') => Array.from({ length: n }, () => { const x = 20 + R() * 280; const y = 50 + R() * 90; return `${M.glow(P, x, y, 7, c, 0.7)}<ellipse cx="${x - 5}" cy="${y}" rx="3" ry="2" fill="${c}"/><ellipse cx="${x + 5}" cy="${y}" rx="3" ry="2" fill="${c}"/>`; }).join(''),
  };

  // ───── 생물 / 정령 캐릭터 ─────
  const f1 = (n) => n.toFixed(1);
  // 입체 표현: 도형마다 빛(왼쪽 위) → 그림자(오른쪽 아래) 그라데이션 + 어두운 윤곽선
  let DEFS = null;
  let PFX = 'x';
  const shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) * amt : v * amt))));
    return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
  };
  const grad = (c) => {
    if (!DEFS || !/^#[0-9a-f]{6}$/i.test(c)) return c;
    const id = `${PFX}g${c.slice(1)}`;
    if (!DEFS[id]) DEFS[id] = `<radialGradient id="${id}" cx="32%" cy="25%" r="85%"><stop offset="0" stop-color="${shade(c, 0.55)}"/><stop offset=".45" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, -0.55)}"/></radialGradient>`;
    return `url(#${id})`;
  };
  const F = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? `fill="${grad(c)}" stroke="${shade(c, -0.65)}" stroke-width="1.6" stroke-linejoin="round"` : `fill="${c}"`);
  const irisGrad = (c) => {
    if (!DEFS || !/^#[0-9a-f]{6}$/i.test(c)) return c;
    const id = `${PFX}i${c.slice(1)}`;
    if (!DEFS[id]) DEFS[id] = `<radialGradient id="${id}" cx="50%" cy="65%" r="60%"><stop offset="0" stop-color="${shade(c, 0.6)}"/><stop offset=".6" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, -0.6)}"/></radialGradient>`;
    return `url(#${id})`;
  };
  const C = {
    eyes: (P, x1, y1, x2, y2, r, c, mood = 'normal') => {
      const one = (x, y, side) => {
        const rx = r * 1.55; const ry = r * 1.3;
        const lid = mood === 'angry' ? `<path d="M${f1(x - rx * 1.2)} ${f1(y - ry * (side < 0 ? 1.5 : 0.6))}L${f1(x + rx * 1.2)} ${f1(y - ry * (side < 0 ? 0.6 : 1.5))}" stroke="#2a1006" stroke-width="${f1(Math.max(1.4, r * 0.55))}" stroke-linecap="round"/>` : '';
        const cut = mood === 'angry' ? `<path d="M${f1(x - rx * 1.3)} ${f1(y - ry * 2)}L${f1(x + rx * 1.3)} ${f1(y - ry * 2)}L${f1(x + rx * 1.3)} ${f1(y - ry * (side < 0 ? 0.5 : 1.3))}L${f1(x - rx * 1.3)} ${f1(y - ry * (side < 0 ? 1.3 : 0.5))}Z" fill="#000" opacity="0"/>` : '';
        return `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="#fffaf0" stroke="#1a0e06" stroke-width="${f1(Math.max(0.6, r * 0.18))}"/>
          <circle cx="${f1(x + side * r * 0.1)}" cy="${f1(y + r * 0.1)}" r="${f1(r * 0.95)}" fill="${irisGrad(c)}"/>
          <circle cx="${f1(x + side * r * 0.1)}" cy="${f1(y + r * 0.12)}" r="${f1(r * 0.45)}" fill="#0a0604"/>
          <circle cx="${f1(x - r * 0.3)}" cy="${f1(y - r * 0.3)}" r="${f1(r * 0.3)}" fill="#fff"/>
          <circle cx="${f1(x + r * 0.35)}" cy="${f1(y + r * 0.4)}" r="${f1(r * 0.14)}" fill="#fff" opacity=".8"/>${cut}${lid}`;
      };
      const same = x1 === x2 && y1 === y2;
      return `${M.glow(P, (x1 + x2) / 2, (y1 + y2) / 2, r * 4, c, 0.35)}${one(x1, y1, same ? 1 : -1)}${same ? '' : one(x2, y2, 1)}`;
    },
    aura: (P, cx, cy, r, c) => M.glow(P, cx, cy, r, c, 0.35),

    /** 날개를 펼친 새: 깃털을 여러 겹 부채꼴로 겹쳐 그린다. style 'feather' | 'jag'(번개) | 'flame'(불사조) */
    bird: (P, { cx, cy, span = 230, c, edge, eye = '#fff7b0', style = 'feather', tail = true }) => {
      const sc = span / 240;
      const feather = (x, y, ang, len, w, col) => {
        const a = (ang * Math.PI) / 180;
        const ex = x + Math.cos(a) * len; const ey = y + Math.sin(a) * len;
        const nx = -Math.sin(a) * w; const ny = Math.cos(a) * w;
        const tip = style === 'jag' ? `L${f1(ex + nx * 0.6)} ${f1(ey + ny * 0.6)}L${f1(ex)} ${f1(ey)}` : `Q${f1(ex + nx * 0.4 + Math.cos(a) * 6)} ${f1(ey + ny * 0.4 + Math.sin(a) * 6)} ${f1(ex)} ${f1(ey)}`;
        return `<path d="M${f1(x)} ${f1(y)}Q${f1(x + Math.cos(a) * len * 0.5 + nx)} ${f1(y + Math.sin(a) * len * 0.5 + ny)} ${f1(ex + nx * 0.3)} ${f1(ey + ny * 0.3)}${tip}Q${f1(x + Math.cos(a) * len * 0.5 - nx * 0.6)} ${f1(y + Math.sin(a) * len * 0.5 - ny * 0.6)} ${f1(x)} ${f1(y)}Z" ${F(col)}/>
          <path d="M${f1(x)} ${f1(y)}L${f1(ex - Math.cos(a) * 6)} ${f1(ey - Math.sin(a) * 6)}" stroke="${shade(col, -0.5)}" stroke-width=".9" opacity=".7"/>`;
      };
      const warm = style === 'flame';
      const cDark = warm ? '#a8201a' : shade(c, -0.35);
      const cMid = c;
      const cLight = warm ? '#ffb43a' : shade(c, 0.3);
      const wing = () => {
        // 어깨 → 손목(위로 들린 날개) 뼈대를 따라 깃털을 부채꼴로: 안쪽은 아래로, 바깥쪽은 위로 뻗는다
        const sx = cx - 8 * sc; const sy = cy - 4 * sc; const wx = cx - 58 * sc; const wy = cy - 52 * sc;
        let out = '';
        const tips = [];
        const row = (n, ang0, ang1, len0, len1, w, col, keep) => {
          for (let i = n - 1; i >= 0; i--) {
            const t = i / (n - 1);
            const x = sx + (wx - sx) * t; const y = sy + (wy - sy) * t;
            const ang = ang0 + (ang1 - ang0) * t; const len = (len0 + (len1 - len0) * t) * sc;
            if (keep) tips.push([x + Math.cos((ang * Math.PI) / 180) * len * 0.92, y + Math.sin((ang * Math.PI) / 180) * len * 0.92]);
            out += feather(x, y, ang, len, w * sc, col);
          }
        };
        const body = () => `<path d="M${f1(sx)} ${f1(sy)}L${f1(wx)} ${f1(wy)}${tips.map(([x, y]) => `L${f1(x)} ${f1(y)}`).join('')}Z" ${F(shade(cDark, -0.15))}/>`;
        const saved = out;
        row(11, 140, 228, 46, 96, 10, cDark, true);
        const back = out.slice(saved.length);
        out = body() + back;
        row(9, 150, 220, 34, 64, 9, cMid, false);
        row(7, 165, 210, 20, 36, 8, cLight, false);
        return out;
      };
      const one = wing();
      const tailSvg = tail ? [-2, -1, 0, 1, 2].map((k) => feather(cx, cy + 26 * sc, 90 + k * 13, (62 - Math.abs(k) * 6) * sc, 9 * sc, k % 2 ? cDark : cLight)).join('') + feather(cx, cy + 26 * sc, 90, 70 * sc, 10 * sc, cMid) : '';
      const sparks = warm ? Array.from({ length: 10 }, (_, i) => `<circle cx="${f1(cx - 110 + i * 24)}" cy="${f1(cy - 60 + ((i * 37) % 50))}" r="1.6" fill="#ffd27a" opacity=".8"/>`).join('') : style === 'jag' ? `<path d="M${cx - 100 * sc} ${cy - 40 * sc}l12 14 -8 2 14 16M${cx + 100 * sc} ${cy - 40 * sc}l-12 14 8 2 -14 16" stroke="${edge}" stroke-width="2" fill="none"/>` : '';
      return `${C.aura(P, cx, cy, span * 0.38, edge)}${sparks}
        <g>${one}</g><g transform="translate(${2 * cx} 0) scale(-1 1)">${one}</g>
        ${tailSvg}
        <path d="M${cx} ${cy - 18 * sc}C${cx + 18 * sc} ${cy - 10 * sc} ${cx + 16 * sc} ${cy + 22 * sc} ${cx} ${cy + 36 * sc}C${cx - 16 * sc} ${cy + 22 * sc} ${cx - 18 * sc} ${cy - 10 * sc} ${cx} ${cy - 18 * sc}Z" ${F(cMid)}/>
        <ellipse cx="${cx}" cy="${cy + 8 * sc}" rx="${8 * sc}" ry="${18 * sc}" fill="${cLight}" opacity=".55"/>
        <path d="M${cx - 2} ${cy - 32 * sc}C${cx - 14 * sc} ${cy - 54 * sc} ${cx - 4} ${cy - 62 * sc} ${cx - 2} ${cy - 66 * sc}C${cx + 2} ${cy - 52 * sc} ${cx + 10 * sc} ${cy - 60 * sc} ${cx + 12 * sc} ${cy - 64 * sc}C${cx + 14 * sc} ${cy - 48 * sc} ${cx + 8 * sc} ${cy - 38 * sc} ${cx + 4} ${cy - 30 * sc}Z" ${F(cLight)}/>
        <circle cx="${cx}" cy="${cy - 26 * sc}" r="${13 * sc}" ${F(cMid)}/>
        <path d="M${cx + 6 * sc} ${cy - 26 * sc}Q${cx + 22 * sc} ${cy - 26 * sc} ${cx + 20 * sc} ${cy - 14 * sc}Q${cx + 14 * sc} ${cy - 18 * sc} ${cx + 6 * sc} ${cy - 18 * sc}Z" fill="#f2b130" stroke="#6a3a08" stroke-width="1"/>
        ${C.eyes(P, cx + 2 * sc, cy - 29 * sc, cx + 2 * sc, cy - 29 * sc, 3.2 * sc, eye, style === 'feather' ? 'normal' : 'angry')}`;
    },

    /** 옆모습 네발짐승 (오른쪽을 봄) */
    beast: (P, { cx, base, len = 130, h = 80, c, edge, eye = '#ffd86b', head = 'fox', tail = 'bushy', antlers = false, horns = false, tailColor = null, marks = null, cute = false }) => {
      const bx = cx - len * 0.1; const by = base - h * 0.55; const rx = len * 0.38; const ry = h * 0.26;
      const legW = Math.max(6, len * 0.06);
      const legs = [-0.72, -0.42, 0.42, 0.72].map((k, i) => {
        const x = bx + rx * k; const back = i < 2; const knee = by + (base - by) * 0.5;
        const kx = x + (back ? -legW * 0.6 : legW * 0.3);
        return `<path d="M${f1(x - legW * 0.9)} ${f1(by - 4)}Q${f1(kx - legW * 0.7)} ${f1(knee)} ${f1(x - legW * 0.45)} ${f1(base - 3)}L${f1(x + legW * 0.75)} ${f1(base - 3)}Q${f1(kx + legW * 0.4)} ${f1(knee)} ${f1(x + legW * 0.9)} ${f1(by - 4)}Z" ${F(i % 2 ? c : shade(c, -0.2))}/><ellipse cx="${f1(x + legW * 0.2)}" cy="${f1(base - 2)}" rx="${f1(legW * 0.75)}" ry="${f1(legW * 0.35)}" ${F(shade(c, -0.3))}/>`;
      }).join('');
      const hx = bx + rx * 0.95; const hy = by - ry * 0.9;
      let headSvg = '';
      const neck = `<path d="M${f1(bx + rx * 0.5)} ${f1(by - ry * 0.5)}L${f1(hx - 6)} ${f1(hy - 4)}L${f1(hx + 10)} ${f1(hy + 8)}L${f1(bx + rx * 0.9)} ${f1(by + ry * 0.3)}Z" ${F(c)}/>`;
      if (head === 'fox' || head === 'wolf' || head === 'cat') {
        const snout = head === 'cat' ? 14 : 24;
        headSvg = `<path d="M${f1(hx - 12)} ${f1(hy)}Q${f1(hx)} ${f1(hy - 16)} ${f1(hx + 12)} ${f1(hy - 6)}L${f1(hx + 12 + snout)} ${f1(hy + 4)}L${f1(hx + 8)} ${f1(hy + 14)}Q${f1(hx - 8)} ${f1(hy + 14)} ${f1(hx - 12)} ${f1(hy)}Z" ${F(c)}/>
          <path d="M${f1(hx - 8)} ${f1(hy - 6)}L${f1(hx - 6)} ${f1(hy - (head === 'cat' ? 20 : 26))}L${f1(hx + 4)} ${f1(hy - 10)}Z" ${F(c)}/><path d="M${f1(hx + 2)} ${f1(hy - 9)}L${f1(hx + 8)} ${f1(hy - (head === 'cat' ? 22 : 28))}L${f1(hx + 14)} ${f1(hy - 7)}Z" ${F(c)}/>
          ${C.eyes(P, hx + 6, hy - 1, hx + 6, hy - 1, 2.6, eye)}`;
      } else if (head === 'stag') {
        headSvg = `<path d="M${f1(hx - 10)} ${f1(hy)}Q${f1(hx)} ${f1(hy - 12)} ${f1(hx + 10)} ${f1(hy - 4)}L${f1(hx + 26)} ${f1(hy + 10)}L${f1(hx + 18)} ${f1(hy + 16)}Q${f1(hx - 6)} ${f1(hy + 14)} ${f1(hx - 10)} ${f1(hy)}Z" ${F(c)}/>${C.eyes(P, hx + 6, hy, hx + 6, hy, 2.4, eye)}`;
      } else if (head === 'boar' || head === 'bear') {
        headSvg = `<path d="M${f1(hx - 16)} ${f1(hy - 6)}Q${f1(hx)} ${f1(hy - 24)} ${f1(hx + 18)} ${f1(hy - 6)}L${f1(hx + 30)} ${f1(hy + 8)}L${f1(hx + 24)} ${f1(hy + 22)}Q${f1(hx)} ${f1(hy + 26)} ${f1(hx - 16)} ${f1(hy + 10)}Z" ${F(c)}/>
          ${head === 'bear' ? `<circle cx="${f1(hx - 6)}" cy="${f1(hy - 16)}" r="7" ${F(c)}/>` : `<path d="M${f1(hx + 20)} ${f1(hy + 14)}Q${f1(hx + 34)} ${f1(hy + 10)} ${f1(hx + 30)} ${f1(hy - 4)}" stroke="#f3ead6" stroke-width="3.5" fill="none" stroke-linecap="round"/>`}
          ${C.eyes(P, hx + 8, hy - 2, hx + 8, hy - 2, 3, eye)}`;
      } else if (head === 'elephant') {
        headSvg = `<circle cx="${f1(hx + 4)}" cy="${f1(hy + 2)}" r="22" ${F(c)}/><path d="M${f1(hx + 18)} ${f1(hy + 8)}Q${f1(hx + 34)} ${f1(hy + 30)} ${f1(hx + 26)} ${f1(base - 6)}" stroke="${c}" stroke-width="10" fill="none" stroke-linecap="round"/>
          <ellipse cx="${f1(hx - 8)}" cy="${f1(hy + 4)}" rx="14" ry="20" fill="${edge}" opacity=".35"/><path d="M${f1(hx + 14)} ${f1(hy + 16)}Q${f1(hx + 30)} ${f1(hy + 22)} ${f1(hx + 36)} ${f1(hy + 12)}" stroke="#f3ead6" stroke-width="3" fill="none"/>${C.eyes(P, hx + 10, hy - 4, hx + 10, hy - 4, 2.4, eye)}`;
      }
      let ant = '';
      if (antlers) {
        const branch = (s) => `<path d="M${f1(hx + s * 2)} ${f1(hy - 8)}L${f1(hx + s * 10)} ${f1(hy - 40)}M${f1(hx + s * 6)} ${f1(hy - 24)}L${f1(hx + s * 20)} ${f1(hy - 34)}M${f1(hx + s * 9)} ${f1(hy - 34)}L${f1(hx + s * 2)} ${f1(hy - 50)}M${f1(hx + s * 10)} ${f1(hy - 40)}L${f1(hx + s * 24)} ${f1(hy - 52)}" stroke="${antlers}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`;
        ant = branch(1) + branch(-0.6);
      }
      if (horns) ant += `<path d="M${f1(hx - 8)} ${f1(hy - 14)}Q${f1(hx - 24)} ${f1(hy - 30)} ${f1(hx - 8)} ${f1(hy - 40)}" stroke="${horns}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
      const tx = bx - rx * 0.95; const ty = by - ry * 0.3;
      const tc = tailColor || c;
      let tailSvg = '';
      if (tail === 'bushy') tailSvg = `<path d="M${f1(tx + 6)} ${f1(ty)}Q${f1(tx - 40)} ${f1(ty - 10)} ${f1(tx - 46)} ${f1(ty - 40)}Q${f1(tx - 20)} ${f1(ty - 26)} ${f1(tx + 8)} ${f1(ty + 10)}Z" ${F(tc)}/>`;
      else if (tail === 'flame') tailSvg = `<path d="M${f1(tx + 6)} ${f1(ty)}C${f1(tx - 30)} ${f1(ty + 4)} ${f1(tx - 50)} ${f1(ty - 30)} ${f1(tx - 40)} ${f1(ty - 64)}C${f1(tx - 34)} ${f1(ty - 40)} ${f1(tx - 20)} ${f1(ty - 44)} ${f1(tx - 18)} ${f1(ty - 58)}C${f1(tx - 4)} ${f1(ty - 36)} ${f1(tx + 6)} ${f1(ty - 20)} ${f1(tx + 8)} ${f1(ty + 8)}Z" ${F(tc)}/>${M.glow(P, tx - 26, ty - 30, 24, tc, 0.5)}`;
      else if (tail === 'thin') tailSvg = `<path d="M${f1(tx + 6)} ${f1(ty)}Q${f1(tx - 30)} ${f1(ty + 4)} ${f1(tx - 34)} ${f1(ty - 26)}" stroke="${tc}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      else if (tail === 'long') tailSvg = `<path d="M${f1(tx + 6)} ${f1(ty)}Q${f1(tx - 50)} ${f1(ty + 30)} ${f1(tx - 70)} ${f1(base - 4)}" stroke="${tc}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
      const markSvg = marks ? `<g fill="${marks}" opacity=".8">${[-0.4, 0, 0.4].map((k) => `<path d="M${f1(bx + rx * k - 4)} ${f1(by - ry * 0.8)}q4 10 0 18q8 -9 0 -18z"/>`).join('')}</g>` : '';
      if (cute) {
        // 정면을 보는 큰 머리 (귀여운 캐릭터 비율)
        const r = h * 0.32; const X = hx + 6; const Y = hy - r * 0.35;
        const inner = edge;
        const ear = (sd) => `<path d="M${f1(X + sd * r * 0.25)} ${f1(Y - r * 0.6)}L${f1(X + sd * r * 0.95)} ${f1(Y - r * 1.75)}L${f1(X + sd * r * 1.05)} ${f1(Y - r * 0.35)}Z" ${F(c)}/><path d="M${f1(X + sd * r * 0.45)} ${f1(Y - r * 0.65)}L${f1(X + sd * r * 0.9)} ${f1(Y - r * 1.45)}L${f1(X + sd * r * 0.95)} ${f1(Y - r * 0.55)}Z" fill="${inner}" opacity=".75"/>`;
        const ruff = Array.from({ length: 6 }, (_, i) => { const x = X - r * 0.8 + i * r * 0.32; const rot = (i - 2.5) * 14; return `<ellipse cx="${f1(x)}" cy="${f1(Y + r * 1.02 + (i % 2) * r * 0.12)}" rx="${f1(r * 0.2)}" ry="${f1(r * 0.42)}" transform="rotate(${rot} ${f1(x)} ${f1(Y + r * 0.8)})" ${F(shade(inner, -0.15))}/>`; }).join('');
        headSvg = `${ruff}${ear(-1)}${ear(1)}
          <path d="M${f1(X - r)} ${f1(Y)}C${f1(X - r)} ${f1(Y - r * 1.1)} ${f1(X + r)} ${f1(Y - r * 1.1)} ${f1(X + r)} ${f1(Y)}C${f1(X + r * 1.15)} ${f1(Y + r * 0.6)} ${f1(X + r * 0.5)} ${f1(Y + r * 0.95)} ${f1(X)} ${f1(Y + r * 0.95)}C${f1(X - r * 0.5)} ${f1(Y + r * 0.95)} ${f1(X - r * 1.15)} ${f1(Y + r * 0.6)} ${f1(X - r)} ${f1(Y)}Z" ${F(c)}/>
          <path d="M${f1(X - r * 0.2)} ${f1(Y - r * 0.75)}q${f1(r * 0.2)} ${f1(r * 0.25)} ${f1(r * 0.4)} 0" stroke="${inner}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
          ${C.eyes(P, X - r * 0.42, Y + r * 0.05, X + r * 0.42, Y + r * 0.05, r * 0.2, eye)}
          <ellipse cx="${f1(X - r * 0.72)}" cy="${f1(Y + r * 0.42)}" rx="${f1(r * 0.14)}" ry="${f1(r * 0.08)}" fill="${inner}" opacity=".7"/><ellipse cx="${f1(X + r * 0.72)}" cy="${f1(Y + r * 0.42)}" rx="${f1(r * 0.14)}" ry="${f1(r * 0.08)}" fill="${inner}" opacity=".7"/>
          <path d="M${f1(X - r * 0.1)} ${f1(Y + r * 0.42)}L${f1(X + r * 0.1)} ${f1(Y + r * 0.42)}L${f1(X)} ${f1(Y + r * 0.54)}Z" fill="#2a0a14"/>
          <path d="M${f1(X - r * 0.18)} ${f1(Y + r * 0.62)}q${f1(r * 0.18)} ${f1(r * 0.14)} ${f1(r * 0.18)} 0q0 ${f1(r * 0.14)} ${f1(r * 0.18)} 0" stroke="#2a0a14" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
      }
      return `${C.aura(P, bx, by, len * 0.55, edge)}${tailSvg}${legs}<ellipse cx="${f1(bx)}" cy="${f1(by)}" rx="${f1(rx)}" ry="${f1(ry)}" ${F(c)}/>${markSvg}<path d="M${f1(bx - rx * 0.8)} ${f1(by - ry * 0.6)}Q${f1(bx)} ${f1(by - ry * 1.2)} ${f1(bx + rx * 0.7)} ${f1(by - ry * 0.7)}" stroke="${edge}" stroke-width="2" fill="none" opacity=".7"/>${neck}${ant}${headSvg}`;
    },

    /** 정령 인간형: lower 'robe' | 'tornado' | 'roots' | 'mist', arms 'up'|'out'|'down', item 'spear'|'lantern'|'flame'|'staff'|null, crown */
    spirit: (P, { cx, base = 178, h = 140, c, edge, eye = '#fff', lower = 'robe', arms = 'out', item = null, crown = null, itemColor = '#ffd86b', bulky = false, marks = null }) => {
      const top = base - h; const headR = h * (bulky ? 0.11 : 0.085); const hy = top + headR; const sh = hy + headR + h * 0.05;
      const w = h * (bulky ? 0.32 : 0.2);
      let body;
      if (lower === 'tornado') body = `<path d="M${f1(cx - w)} ${f1(sh)}Q${f1(cx)} ${f1(sh - 8)} ${f1(cx + w)} ${f1(sh)}L${f1(cx + w * 0.7)} ${f1(sh + h * 0.3)}Q${f1(cx + w * 1.4)} ${f1(sh + h * 0.45)} ${f1(cx + 4)} ${f1(base)}Q${f1(cx - w * 1.5)} ${f1(sh + h * 0.5)} ${f1(cx - w * 0.7)} ${f1(sh + h * 0.3)}Z" ${F(c)}/>${M.swirl(P, cx, base - 30, 34, edge, 0.6)}`;
      else if (lower === 'roots') body = `<path d="M${f1(cx - w)} ${f1(sh)}L${f1(cx + w)} ${f1(sh)}L${f1(cx + w * 0.8)} ${f1(base - 20)}L${f1(cx + w * 1.8)} ${f1(base)}L${f1(cx + w * 0.3)} ${f1(base - 10)}L${f1(cx)} ${f1(base + 2)}L${f1(cx - w * 0.3)} ${f1(base - 10)}L${f1(cx - w * 1.8)} ${f1(base)}L${f1(cx - w * 0.8)} ${f1(base - 20)}Z" ${F(c)}/>`;
      else if (lower === 'mist') body = `<path d="M${f1(cx - w)} ${f1(sh)}Q${f1(cx)} ${f1(sh - 8)} ${f1(cx + w)} ${f1(sh)}Q${f1(cx + w * 1.6)} ${f1(sh + h * 0.4)} ${f1(cx + w * 0.9)} ${f1(base - 26)}Q${f1(cx + w * 0.4)} ${f1(base - 6)} ${f1(cx)} ${f1(base - 30)}Q${f1(cx - w * 0.4)} ${f1(base - 4)} ${f1(cx - w * 0.9)} ${f1(base - 24)}Q${f1(cx - w * 1.6)} ${f1(sh + h * 0.4)} ${f1(cx - w)} ${f1(sh)}Z" ${F(c)} opacity=".9"/>`;
      else body = `<path d="M${f1(cx - w)} ${f1(sh)}Q${f1(cx)} ${f1(sh - 8)} ${f1(cx + w)} ${f1(sh)}L${f1(cx + w * 1.5)} ${f1(base)}Q${f1(cx + w * 0.75)} ${f1(base - 8)} ${f1(cx)} ${f1(base)}Q${f1(cx - w * 0.75)} ${f1(base - 8)} ${f1(cx - w * 1.5)} ${f1(base)}Z" ${F(c)}/>`;
      const armW = bulky ? 12 : 7;
      const handL = arms === 'up' ? [cx - w * 2.2, sh - h * 0.3] : arms === 'down' ? [cx - w * 1.4, sh + h * 0.38] : [cx - w * 2.4, sh + h * 0.1];
      const handR = arms === 'up' ? [cx + w * 2.2, sh - h * 0.3] : arms === 'down' ? [cx + w * 1.4, sh + h * 0.38] : [cx + w * 2.4, sh + h * 0.1];
      const arm = (hand, s) => `<path d="M${f1(cx + s * w * 0.8)} ${f1(sh + 4)}Q${f1((cx + hand[0]) / 2 + s * 6)} ${f1(sh + 12)} ${f1(hand[0])} ${f1(hand[1])}" stroke="${c}" stroke-width="${armW}" fill="none" stroke-linecap="round"/>`;
      let itemSvg = '';
      const [ix, iy] = handR;
      if (item === 'spear') itemSvg = `<path d="M${f1(ix)} ${f1(iy - 60)}L${f1(ix)} ${f1(iy + 70)}" stroke="#3a2a18" stroke-width="3"/><path d="M${f1(ix - 5)} ${f1(iy - 58)}L${f1(ix)} ${f1(iy - 76)}L${f1(ix + 5)} ${f1(iy - 58)}Z" fill="${itemColor}"/>${M.glow(P, ix, iy - 66, 12, itemColor, 0.7)}`;
      else if (item === 'staff') itemSvg = `<path d="M${f1(ix)} ${f1(iy - 50)}L${f1(ix)} ${f1(base)}" stroke="#4a3420" stroke-width="4"/>${M.glow(P, ix, iy - 54, 14, itemColor, 0.8)}<circle cx="${f1(ix)}" cy="${f1(iy - 54)}" r="5" fill="${itemColor}"/>`;
      else if (item === 'lantern') itemSvg = `<path d="M${f1(ix)} ${f1(iy)}L${f1(ix)} ${f1(iy + 14)}" stroke="#3a2a18" stroke-width="2"/>${M.glow(P, ix, iy + 22, 20, itemColor, 0.8)}<rect x="${f1(ix - 6)}" y="${f1(iy + 14)}" width="12" height="16" rx="3" fill="${itemColor}"/>`;
      else if (item === 'flame') itemSvg = M.flame(P, ix, iy - 2, 0.5, itemColor, '#fff3c0');
      let crownSvg = '';
      if (crown === 'antlers') crownSvg = `<path d="M${f1(cx - 4)} ${f1(top + 4)}L${f1(cx - 16)} ${f1(top - 22)}M${f1(cx - 10)} ${f1(top - 10)}L${f1(cx - 24)} ${f1(top - 12)}M${f1(cx + 4)} ${f1(top + 4)}L${f1(cx + 16)} ${f1(top - 22)}M${f1(cx + 10)} ${f1(top - 10)}L${f1(cx + 24)} ${f1(top - 12)}" stroke="${edge}" stroke-width="3" stroke-linecap="round"/>`;
      else if (crown === 'flame') crownSvg = M.flame(P, cx, top + 6, 0.55, itemColor, '#fff3c0');
      else if (crown === 'leaves') crownSvg = `<g fill="${edge}">${[-2, -1, 0, 1, 2].map((k) => `<ellipse cx="${f1(cx + k * 9)}" cy="${f1(top - 2 - (2 - Math.abs(k)) * 4)}" rx="5" ry="11" transform="rotate(${k * 22} ${f1(cx + k * 9)} ${f1(top + 4)})"/>`).join('')}</g>`;
      else if (crown === 'stars') crownSvg = [-1, 0, 1].map((k) => `${M.glow(P, cx + k * 14, top - 8 - (k === 0 ? 6 : 0), 6, '#fff', 0.8)}<path d="M${f1(cx + k * 14)} ${f1(top - 16 - (k === 0 ? 6 : 0))}l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#fff"/>`).join('');
      else if (crown === 'horns') crownSvg = `<path d="M${f1(cx - 8)} ${f1(top + 6)}Q${f1(cx - 26)} ${f1(top - 4)} ${f1(cx - 20)} ${f1(top - 22)}M${f1(cx + 8)} ${f1(top + 6)}Q${f1(cx + 26)} ${f1(top - 4)} ${f1(cx + 20)} ${f1(top - 22)}" stroke="${edge}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      else if (crown === 'halo') crownSvg = `<ellipse cx="${cx}" cy="${f1(top - 4)}" rx="${f1(headR * 1.6)}" ry="${f1(headR * 0.45)}" fill="none" stroke="${edge}" stroke-width="2.5"/>`;
      const markSvg = marks ? `<g stroke="${marks}" stroke-width="2" fill="none" opacity=".8"><path d="M${f1(cx - w * 0.5)} ${f1(sh + 14)}q${f1(w * 0.5)} 12 ${f1(w)} 0"/><path d="M${f1(cx)} ${f1(sh + 20)}v${f1(h * 0.3)}"/><path d="M${f1(cx - w * 0.6)} ${f1(sh + h * 0.3)}q${f1(w * 0.6)} -10 ${f1(w * 1.2)} 0"/></g>` : '';
      return `${C.aura(P, cx, base - h * 0.5, h * 0.6, edge)}${arm(handL, -1)}${arm(handR, 1)}${body}${markSvg}<circle cx="${cx}" cy="${f1(hy)}" r="${f1(headR)}" ${F(c)}/>${crownSvg}${C.eyes(P, cx - headR * 0.4, hy, cx + headR * 0.4, hy, Math.max(1.6, headR * 0.17), eye)}${itemSvg}`;
    },

    /** 물결치는 뱀/용. pts: 몸통이 지나는 점들, 머리는 마지막 점 */
    serpent: (P, { pts, width = 22, c, edge, eye = '#ffe66b', fins = false, teeth = false }) => {
      let d = `M${pts[0][0]} ${pts[0][1]}`;
      for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1]; const [x, y] = pts[i]; d += `Q${f1(x0 + (x - x0) * 0.5)} ${f1(y0 - 22 * (i % 2 ? 1 : -1))} ${x} ${y}`; }
      const [hx, hy] = pts[pts.length - 1];
      const [px] = pts[pts.length - 2];
      const dir = hx >= px ? 1 : -1;
      const head = `<path d="M${hx - dir * 8} ${hy - width * 0.7}Q${hx + dir * width * 1.4} ${hy - width * 0.8} ${hx + dir * width * 1.9} ${hy}Q${hx + dir * width * 1.2} ${hy + width * 0.8} ${hx - dir * 8} ${hy + width * 0.6}Z" ${F(c)}/>`;
      const jaw = teeth ? `<g fill="#f3ead6">${[0, 1, 2].map((k) => `<path d="M${f1(hx + dir * (8 + k * 9))} ${f1(hy + 2)}l${dir * 3} 8 ${dir * 3} -8z"/>`).join('')}</g>` : '';
      const finSvg = fins ? pts.slice(1, -1).map(([x, y]) => `<path d="M${x - 8} ${y - width * 0.4}L${x} ${y - width * 1.3}L${x + 8} ${y - width * 0.4}Z" fill="${edge}" opacity=".85"/>`).join('') : '';
      return `${C.aura(P, hx, hy, 60, edge)}<path d="${d}" stroke="${c}" stroke-width="${width}" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${edge}" stroke-width="2" fill="none" stroke-dasharray="3 9" opacity=".7"/>${finSvg}${head}${jaw}${C.eyes(P, hx + dir * width * 0.6, hy - width * 0.3, hx + dir * width * 0.6, hy - width * 0.3, 2.6, eye)}`;
    },

    fireSpirit: (P, { cx, cy, s = 1 }) => {
      const base = '#ff8a1e'; const top = '#d8321a';
      if (DEFS) DEFS[`${PFX}fire`] = `<linearGradient id="${PFX}fire" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffe066"/><stop offset=".45" stop-color="${base}"/><stop offset="1" stop-color="${top}"/></linearGradient>`;
      const k = (v) => Math.round(v * s * 10) / 10;
      const flame = `M${cx} ${cy + k(62)}C${cx - k(58)} ${cy + k(62)} ${cx - k(70)} ${cy + k(20)} ${cx - k(64)} ${cy - k(10)}C${cx - k(78)} ${cy - k(24)} ${cx - k(70)} ${cy - k(46)} ${cx - k(56)} ${cy - k(58)}C${cx - k(56)} ${cy - k(40)} ${cx - k(46)} ${cy - k(34)} ${cx - k(40)} ${cy - k(36)}C${cx - k(46)} ${cy - k(62)} ${cx - k(30)} ${cy - k(84)} ${cx - k(14)} ${cy - k(92)}C${cx - k(18)} ${cy - k(70)} ${cx - k(8)} ${cy - k(62)} ${cx} ${cy - k(64)}C${cx + k(4)} ${cy - k(96)} ${cx + k(30)} ${cy - k(112)} ${cx + k(44)} ${cy - k(118)}C${cx + k(30)} ${cy - k(96)} ${cx + k(36)} ${cy - k(78)} ${cx + k(46)} ${cy - k(70)}C${cx + k(52)} ${cy - k(84)} ${cx + k(64)} ${cy - k(84)} ${cx + k(70)} ${cy - k(92)}C${cx + k(66)} ${cy - k(66)} ${cx + k(76)} ${cy - k(40)} ${cx + k(68)} ${cy - k(14)}C${cx + k(76)} ${cy + k(20)} ${cx + k(56)} ${cy + k(62)} ${cx} ${cy + k(62)}Z`;
      return `${M.glow(P, cx, cy, 90 * s, '#ff7a1e', 0.55)}<path d="${flame}" fill="url(#${PFX}fire)" stroke="#8a1a08" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M${cx - k(30)} ${cy - k(30)}q${k(10)} ${k(-16)} ${k(22)} ${k(-6)}M${cx + k(10)} ${cy - k(34)}q${k(14)} ${k(-12)} ${k(24)} ${k(2)}" stroke="#c83a12" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <ellipse cx="${cx}" cy="${cy + k(26)}" rx="${k(46)}" ry="${k(34)}" fill="#ffe680" opacity=".55"/>
        ${C.eyes(P, cx - 20 * s, cy + 12 * s, cx + 20 * s, cy + 12 * s, 6 * s, '#3fa8b8', 'angry')}
        <path d="M${cx - k(8)} ${cy + k(40)}q${k(8)} ${k(-5)} ${k(16)} 0" stroke="#7a2a0a" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    },
    octopus: (P, { cx, cy, c, edge, eye }) => `${C.aura(P, cx, cy, 80, edge)}${[-3, -2, -1, 0, 1, 2, 3].map((k) => `<path d="M${cx + k * 9} ${cy + 20}Q${cx + k * 34} ${cy + 50} ${cx + k * 30 + (k % 2 ? 20 : -20)} ${cy + 90}" stroke="${c}" stroke-width="${12 - Math.abs(k)}" fill="none" stroke-linecap="round"/>`).join('')}<ellipse cx="${cx}" cy="${cy - 10}" rx="42" ry="46" ${F(c)}/><g fill="${edge}" opacity=".5">${[0, 1, 2, 3].map((k) => `<circle cx="${cx - 20 + k * 13}" cy="${cy - 34 + (k % 2) * 8}" r="3"/>`).join('')}</g>${C.eyes(P, cx - 16, cy + 6, cx + 16, cy + 6, 5, eye)}`,
    moth: (P, { cx, cy, c, edge, eye }) => `${C.aura(P, cx, cy, 90, edge)}${[1, -1].map((s) => `<path d="M${cx} ${cy}C${cx + s * 40} ${cy - 80} ${cx + s * 120} ${cy - 70} ${cx + s * 110} ${cy - 10}C${cx + s * 100} ${cy + 20} ${cx + s * 40} ${cy + 10} ${cx} ${cy}Z" ${F(c)}/><path d="M${cx} ${cy + 4}C${cx + s * 30} ${cy + 20} ${cx + s * 80} ${cy + 30} ${cx + s * 60} ${cy + 60}C${cx + s * 30} ${cy + 70} ${cx + s * 10} ${cy + 30} ${cx} ${cy + 4}Z" ${F(c)}/>${C.eyes(P, cx + s * 70, cy - 30, cx + s * 70, cy - 30, 9, eye)}<circle cx="${cx + s * 70}" cy="${cy - 30}" r="18" fill="none" stroke="${edge}" stroke-width="2" opacity=".7"/>`).join('')}<ellipse cx="${cx}" cy="${cy + 10}" rx="7" ry="34" ${F(c)}/><path d="M${cx - 3} ${cy - 20}Q${cx - 20} ${cy - 50} ${cx - 26} ${cy - 46}M${cx + 3} ${cy - 20}Q${cx + 20} ${cy - 50} ${cx + 26} ${cy - 46}" stroke="${edge}" stroke-width="2" fill="none"/>`,
    tortoise: (P, { cx, base, c, edge, eye }) => `${C.aura(P, cx, base - 40, 90, edge)}${[-50, -20, 20, 50].map((x) => `<rect x="${cx + x - 9}" y="${base - 30}" width="18" height="30" rx="8" ${F(c)}/>`).join('')}<path d="M${cx - 80} ${base - 26}Q${cx} ${base - 130} ${cx + 80} ${base - 26}Z" ${F(c)}/><g stroke="${edge}" stroke-width="2.5" fill="none" opacity=".75"><path d="M${cx - 40} ${base - 30}L${cx - 30} ${base - 70}L${cx + 30} ${base - 70}L${cx + 40} ${base - 30}"/><path d="M${cx - 30} ${base - 70}L${cx} ${base - 92}L${cx + 30} ${base - 70}"/></g><path d="M${cx + 70} ${base - 30}Q${cx + 100} ${base - 50} ${cx + 110} ${base - 40}Q${cx + 112} ${base - 22} ${cx + 82} ${base - 18}Z" ${F(c)}/>${C.eyes(P, cx + 100, base - 38, cx + 100, base - 38, 2.6, eye)}${M.glow(P, cx, base - 120, 20, edge, 0.4)}`,
    whale: (P, { cx, cy, c, edge, eye }) => `${C.aura(P, cx, cy, 100, edge)}<path d="M${cx - 120} ${cy - 10}Q${cx - 140} ${cy - 40} ${cx - 150} ${cy - 30}Q${cx - 140} ${cy - 10} ${cx - 150} ${cy + 10}Q${cx - 135} ${cy + 6} ${cx - 120} ${cy}Q${cx - 40} ${cy + 46} ${cx + 60} ${cy + 30}Q${cx + 110} ${cy + 20} ${cx + 110} ${cy - 6}Q${cx + 90} ${cy - 50} ${cx} ${cy - 44}Q${cx - 70} ${cy - 40} ${cx - 120} ${cy - 10}Z" ${F(c)}/><path d="M${cx - 20} ${cy + 30}Q${cx} ${cy + 64} ${cx + 20} ${cy + 34}" ${F(c)}/><g stroke="${edge}" stroke-width="1.6" opacity=".6">${[0, 1, 2, 3].map((k) => `<path d="M${cx + 30 + k * 12} ${cy + 22}q4 -8 2 -16" fill="none"/>`).join('')}</g>${C.eyes(P, cx + 70, cy - 6, cx + 70, cy - 6, 3, eye)}`,
    frog: (P, { cx, base, c, edge, eye }) => `${C.aura(P, cx, base - 40, 90, edge)}<ellipse cx="${cx}" cy="${base - 34}" rx="70" ry="38" ${F(c)}/><ellipse cx="${cx - 60}" cy="${base - 10}" rx="30" ry="12" ${F(c)}/><ellipse cx="${cx + 60}" cy="${base - 10}" rx="30" ry="12" ${F(c)}/><circle cx="${cx - 32}" cy="${base - 72}" r="18" ${F(c)}/><circle cx="${cx + 32}" cy="${base - 72}" r="18" ${F(c)}/>${C.eyes(P, cx - 32, base - 74, cx + 32, base - 74, 8, eye)}<path d="M${cx - 44} ${base - 40}Q${cx} ${base - 20} ${cx + 44} ${base - 40}" stroke="${edge}" stroke-width="3" fill="none"/><g fill="${edge}" opacity=".5">${[0, 1, 2, 3, 4].map((k) => `<circle cx="${cx - 40 + k * 20}" cy="${base - 52 + (k % 2) * 10}" r="4"/>`).join('')}</g>`,
    owl: (P, { cx, cy, c, edge, eye }) => `${C.aura(P, cx, cy, 90, edge)}<path d="M${cx - 50} ${cy - 40}L${cx - 40} ${cy - 70}L${cx - 20} ${cy - 50}Q${cx} ${cy - 56} ${cx + 20} ${cy - 50}L${cx + 40} ${cy - 70}L${cx + 50} ${cy - 40}Q${cx + 66} ${cy + 30} ${cx} ${cy + 70}Q${cx - 66} ${cy + 30} ${cx - 50} ${cy - 40}Z" ${F(c)}/><circle cx="${cx - 22}" cy="${cy - 22}" r="20" fill="${edge}" opacity=".35"/><circle cx="${cx + 22}" cy="${cy - 22}" r="20" fill="${edge}" opacity=".35"/>${C.eyes(P, cx - 22, cy - 22, cx + 22, cy - 22, 9, eye)}<path d="M${cx - 5} ${cy - 6}L${cx} ${cy + 6}L${cx + 5} ${cy - 6}Z" fill="${edge}"/><g stroke="${edge}" stroke-width="1.8" fill="none" opacity=".55">${[0, 1, 2].map((k) => `<path d="M${cx - 24 + k * 6} ${cy + 20 + k * 10}q${24 - k * 6} 8 ${48 - k * 12} 0"/>`).join('')}</g>`,
    heron: (P, { cx, base, c, edge, eye }) => `${C.aura(P, cx, base - 70, 80, edge)}<path d="M${cx - 4} ${base - 60}L${cx - 10} ${base}M${cx + 6} ${base - 60}L${cx + 10} ${base}" stroke="${c}" stroke-width="3"/><path d="M${cx - 40} ${base - 80}Q${cx} ${base - 110} ${cx + 30} ${base - 86}Q${cx + 20} ${base - 56} ${cx - 10} ${base - 58}Q${cx - 34} ${base - 60} ${cx - 40} ${base - 80}Z" ${F(c)}/><path d="M${cx + 24} ${base - 88}Q${cx + 46} ${base - 120} ${cx + 30} ${base - 140}Q${cx + 26} ${base - 148} ${cx + 36} ${base - 150}" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M${cx + 38} ${base - 152}L${cx + 66} ${base - 146}L${cx + 38} ${base - 144}Z" fill="${edge}"/>${C.eyes(P, cx + 37, base - 151, cx + 37, base - 151, 2, eye)}`,
    swarm: (P, R, { cx, cy, c }) => { const birds = []; for (let i = 0; i < 260; i++) { const a = R() * Math.PI * 2; const r = R(); const x = cx + Math.cos(a) * r * 140 * (Math.abs(Math.sin(a)) < 0.35 ? 1 : 0.4); const y = cy + Math.sin(a) * r * 55 - Math.abs(Math.cos(a)) * r * 38; const s = 2 + R() * 3; birds.push(`<path d="M${f1(x - s)} ${f1(y)}q${f1(s / 2)} ${f1(-s * 0.7)} ${f1(s)} 0q${f1(s / 2)} ${f1(-s * 0.7)} ${f1(s)} 0" stroke="${c}" stroke-width="1.6" fill="none"/>`); } return birds.join(''); },
    worm: (P, { cx, base, c, edge }) => `${C.aura(P, cx, base - 70, 90, edge)}<path d="M${cx - 30} ${base}Q${cx - 40} ${base - 90} ${cx + 10} ${base - 120}L${cx + 46} ${base - 100}Q${cx + 30} ${base - 50} ${cx + 30} ${base}Z" ${F(c)}/>${[0, 1, 2, 3].map((k) => `<path d="M${cx - 34 + k * 3} ${base - 20 - k * 25}q30 -6 60 4" stroke="${edge}" stroke-width="2" fill="none" opacity=".5"/>`).join('')}<ellipse cx="${cx + 28}" cy="${base - 112}" rx="26" ry="16" fill="#2a0a06" transform="rotate(30 ${cx + 28} ${base - 112})"/><g fill="#f3ead6">${Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * Math.PI * 2; const x = cx + 28 + Math.cos(a) * 22; const y = base - 112 + Math.sin(a) * 13; return `<path d="M${f1(x)} ${f1(y)}L${f1(x - Math.cos(a) * 9)} ${f1(y - Math.sin(a) * 6)}L${f1(x + 3)} ${f1(y + 2)}Z"/>`; }).join('')}</g>`,
    treant: (P, { cx, base, c, edge, eye }) => `${C.aura(P, cx, base - 80, 100, edge)}<path d="M${cx - 30} ${base}L${cx - 22} ${base - 100}L${cx + 22} ${base - 100}L${cx + 30} ${base}Z" fill="#4a3420"/><path d="M${cx - 22} ${base - 80}Q${cx - 60} ${base - 90} ${cx - 76} ${base - 120}M${cx + 22} ${base - 84}Q${cx + 60} ${base - 96} ${cx + 80} ${base - 126}" stroke="#4a3420" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="${cx}" cy="${base - 130}" r="44" ${F(c)}/><circle cx="${cx - 70}" cy="${base - 128}" r="22" ${F(c)}/><circle cx="${cx + 74}" cy="${base - 134}" r="24" ${F(c)}/><circle cx="${cx - 26}" cy="${base - 150}" r="22" fill="${edge}" opacity=".35"/>${C.eyes(P, cx - 10, base - 72, cx + 10, base - 72, 3.2, eye)}<path d="M${cx - 8} ${base - 56}Q${cx} ${base - 50} ${cx + 8} ${base - 56}" stroke="#1a0e06" stroke-width="2.5" fill="none"/>${M.roots(P, rng(7), '#3a2818', 6)}`,
    ghost: (P, { cx, cy, c, edge, eye, mouth = false }) => `${C.aura(P, cx, cy, 90, edge)}<path d="M${cx - 50} ${cy + 70}Q${cx - 56} ${cy - 10} ${cx - 34} ${cy - 50}Q${cx} ${cy - 84} ${cx + 34} ${cy - 50}Q${cx + 56} ${cy - 10} ${cx + 50} ${cy + 70}Q${cx + 34} ${cy + 50} ${cx + 22} ${cy + 74}Q${cx + 6} ${cy + 50} ${cx - 6} ${cy + 74}Q${cx - 22} ${cy + 50} ${cx - 34} ${cy + 74}Z" ${F(c)}/><path d="M${cx - 48} ${cy}Q${cx - 90} ${cy - 10} ${cx - 104} ${cy - 40}M${cx + 48} ${cy}Q${cx + 90} ${cy - 10} ${cx + 104} ${cy - 40}" stroke="${c}" stroke-width="12" fill="none" stroke-linecap="round"/>${C.eyes(P, cx - 16, cy - 26, cx + 16, cy - 26, 5, eye)}${mouth ? `<ellipse cx="${cx}" cy="${cy}" rx="10" ry="16" fill="#0a0612"/>` : ''}`,
  };

  // ───── 정령별 구성 [하늘 위, 하늘 아래], 배경, 캐릭터 ─────
  const ART = {
    lightning: [['#141833', '#4a3a7a'], (P, R) => M.stars(P, R, 25) + M.mountains(P, R, 165, '#1e1a30', 6, 40) + M.bolt(P, 50, 30, 0.5, '#e8dcff') + M.bolt(P, 280, 20, 0.45, '#e8dcff'),
      (P) => C.bird(P, { cx: 160, cy: 100, span: 200, c: '#3a3460', edge: '#fff3a0', eye: '#fff7b0', style: 'jag' })],
    river: [['#ffcf7a', '#6fb7d8'], (P) => M.sun(P, 270, 35, 16) + M.ground(P, 125, '#4f8a4a') + M.waves(P, 135, '#3d8fc0', 3, 6),
      (P) => C.serpent(P, { pts: [[20, 150], [80, 120], [140, 140], [200, 100], [250, 80]], width: 20, c: '#2f86c0', edge: '#cfefff', eye: '#fff6c0', fins: true })],
    earth: [['#5a4a3a', '#a8865a'], (P, R) => M.snowpeak(P, 60, 160, 70, 70, '#5a4a3a') + M.snowpeak(P, 270, 160, 70, 80, '#5f4c3a') + M.ground(P, 165, '#3e5a2e'),
      (P) => C.beast(P, { cx: 165, base: 172, len: 150, h: 130, c: '#6e5a46', edge: '#8fd06a', eye: '#b8ff7a', head: 'bear', tail: 'none', marks: '#5a9a3a' })],
    shadows: [['#0e0a1a', '#3a1a4a'], (P, R) => M.stars(P, R, 15, '#d8b8ff') + M.moon(P, 270, 35, 14, '#e8d8ff') + M.mist(P, R, '#6a3a8a', 5),
      (P) => C.beast(P, { cx: 175, base: 168, len: 140, h: 85, c: '#2a1438', edge: '#c88aff', eye: '#e8a0ff', head: 'fox', tail: 'flame', tailColor: '#9b51e0', cute: true })],
    thunder: [['#3a2410', '#c86a2a'], (P) => M.sun(P, 260, 40, 14, '#ffb04a') + M.ground(P, 150, '#4a2a14') + M.figures(P, [40, 70, 250, 280], 172),
      (P) => C.spirit(P, { cx: 160, base: 172, h: 150, c: '#5a3418', edge: '#ffd27a', eye: '#fff3b0', arms: 'up', item: 'spear', crown: 'horns', itemColor: '#ffe7a0', marks: '#ffb04a' })],
    ocean: [['#0a2a48', '#2a6aa0'], (P, R) => M.stars(P, R, 12) + M.moon(P, 50, 35, 12),
      (P) => C.octopus(P, { cx: 160, cy: 80, c: '#1b4f80', edge: '#7fd0ff', eye: '#fff3a0' }) + M.waves(P, 130, '#1e5f96', 3, 8, 0.85)],
    bringer: [['#10081e', '#4a2a6a'], (P, R) => M.stars(P, R, 50, '#f0d8ff') + M.mist(P, R, '#c86bd8', 5),
      (P) => C.moth(P, { cx: 160, cy: 95, c: '#4a2a6a', edge: '#f0b8ff', eye: '#ffd8ff' })],
    green: [['#9ad86a', '#2e7a35'], (P, R) => M.sun(P, 270, 30, 14, '#fff3a0') + M.canopy(P, R, 180, 8, '#3f9a46', '#2e7a35'),
      (P, R) => C.spirit(P, { cx: 160, base: 178, h: 150, c: '#2f7a30', edge: '#b8ff8a', eye: '#f3ffb0', arms: 'out', crown: 'leaves', lower: 'roots', marks: '#8ae06a' }) + M.vines(P, R, '#5fc35a', 4)],
    keeper: [['#0e2a1a', '#2e6a40'], (P, R) => M.pines(P, R, 180, 14, '#0f3a1e') + M.glow(P, 160, 60, 50, '#c8ffb0', 0.2),
      (P) => C.beast(P, { cx: 150, base: 172, len: 160, h: 110, c: '#2a4a2a', edge: '#c8ffb0', eye: '#e8ffb0', head: 'stag', tail: 'none', antlers: '#7aa86a' })],
    wildfire: [['#2a0a04', '#c8401c'], (P, R) => M.ground(P, 160, '#1a0a04') + M.flame(P, 40, 176, 0.6) + M.flame(P, 285, 176, 0.7) + M.stars(P, R, 20, '#ffb070'),
      (P) => C.fireSpirit(P, { cx: 160, cy: 108, s: 0.8 })],
    stone: [['#4a4f56', '#9aa0a6'], (P, R) => M.snowpeak(P, 60, 150, 70, 70, '#6c6a66') + M.ground(P, 160, '#5a5854'),
      (P) => C.tortoise(P, { cx: 150, base: 172, c: '#6e6a64', edge: '#d8f0ff', eye: '#cfeaff' })],
    volcano: [['#1a0806', '#7a2a14'], (P, R) => M.stars(P, R, 15, '#ffb070') + M.volcano(P, 270, 190, '#3a1a10') + M.cracks(P, R, '#ff7a2a', 3),
      (P) => C.spirit(P, { cx: 140, base: 178, h: 150, c: '#3a1a10', edge: '#ff7a2a', eye: '#ffd27a', arms: 'out', bulky: true, crown: 'flame', itemColor: '#ff7a2a', marks: '#ff7a2a' })],
    fangs: [['#0e1a0a', '#2a4a1a'], (P, R) => M.canopy(P, R, 180, 8, '#1f3a14', '#2a4a1a') + M.beasteyes(P, R, 2),
      (P) => C.beast(P, { cx: 165, base: 170, len: 170, h: 90, c: '#2a2010', edge: '#ffb02e', eye: '#ffb02e', head: 'cat', tail: 'long', marks: '#8a6a2a' })],
    serpent: [['#14200e', '#4a6a2a'], (P) => M.ground(P, 150, '#2a3a1a'),
      (P) => C.serpent(P, { pts: [[10, 160], [70, 130], [130, 155], [190, 115], [240, 90]], width: 26, c: '#4d7a2a', edge: '#d8f08a', eye: '#ffd84a' })],
    downpour: [['#2a3a4a', '#6a8aa0'], (P, R) => M.rain(P, R, '#d8ecff', 80) + M.waves(P, 150, '#3a6a8a', 2, 4),
      (P) => C.whale(P, { cx: 170, cy: 70, c: '#4a6a88', edge: '#d8ecff', eye: '#fff' })],
    finder: [['#2a2418', '#8a7a52'], (P, R) => M.stars(P, R, 30, '#fff3c8') + M.constellation(P, R, '#fff3c8') + M.ground(P, 160, '#4a3e28') + M.footprints(P, R),
      (P) => C.beast(P, { cx: 160, base: 168, len: 130, h: 80, c: '#6a5030', edge: '#fff3c8', eye: '#fff3c8', head: 'fox', tail: 'bushy', tailColor: '#c8a050', cute: true }) + M.glow(P, 85, 95, 16, '#fff3c8', 0.8)],
    trickster: [['#3a2a08', '#c8962a'], (P, R) => M.birds(P, R, 5, '#3a2a08') + M.ground(P, 160, '#5a4010') + M.flame(P, 40, 172, 0.5),
      (P) => C.beast(P, { cx: 160, base: 168, len: 140, h: 85, c: '#8a5a20', edge: '#ffd86b', eye: '#ffe66b', head: 'wolf', tail: 'bushy', tailColor: '#5a3a10', cute: true })],
    lure: [['#0a1a10', '#1f4a2a'], (P, R) => M.pines(P, R, 180, 16, '#0a2414') + M.beasteyes(P, R, 2, '#c8ffb0'),
      (P) => C.spirit(P, { cx: 160, base: 176, h: 140, c: '#16301e', edge: '#c8ffb0', eye: '#c8ffb0', arms: 'out', item: 'lantern', crown: 'antlers', lower: 'mist', itemColor: '#c8ffb0' })],
    manyminds: [['#c8a06a', '#5a8ab0'], (P) => M.ground(P, 165, '#6a5a3a'),
      (P, R) => M.glow(P, 160, 80, 70, '#fff3c8', 0.3) + C.swarm(P, R, { cx: 160, cy: 80, c: '#2a1e10' }) + C.eyes(P, 150, 62, 170, 62, 2.5, '#fff3c8')],
    memory: [['#1e1838', '#5a4a8a'], (P, R) => M.stars(P, R, 30) + M.spiral(P, 70, 60) + M.ground(P, 165, '#3a3458'),
      (P) => C.beast(P, { cx: 160, base: 172, len: 170, h: 120, c: '#4a4270', edge: '#d8ccff', eye: '#e8dcff', head: 'elephant', tail: 'thin', marks: '#b8a8ff' })],
    mist: [['#8a9aaa', '#d0dbe6'], (P, R) => M.pines(P, R, 180, 10, '#6a7a88') + M.mist(P, R, '#ffffff', 8),
      (P, R) => C.beast(P, { cx: 160, base: 168, len: 150, h: 90, c: '#5a6e86', edge: '#ffffff', eye: '#e8f4ff', head: 'wolf', tail: 'bushy', tailColor: '#7a8ea4' }) + M.mist(P, R, '#ffffff', 5)],
    starlight: [['#05081a', '#1a2a5a'], (P, R) => M.stars(P, R, 70) + M.shards(P, R, '#cfd8ff'),
      (P, R) => C.spirit(P, { cx: 160, base: 176, h: 150, c: '#2a3a7a', edge: '#cfd8ff', eye: '#ffffff', arms: 'up', crown: 'stars', lower: 'mist' }) + M.constellation(P, R)],
    fractured: [['#1a1028', '#6a4a8a'], (P, R) => M.stars(P, R, 25) + M.shards(P, R) + M.sun(P, 50, 40, 12, '#ffe0a0') + M.moon(P, 275, 40, 13),
      (P) => C.spirit(P, { cx: 160, base: 176, h: 150, c: '#3a2a5a', edge: '#e6d3ff', eye: '#fff', arms: 'out', crown: 'halo', marks: '#e6d3ff' }) + M.hourglass(P, 160, 120, 0.4)],
    vengeance: [['#1a0408', '#6a1428'], (P, R) => M.ground(P, 160, '#2a0a10') + M.mist(P, R, '#6a2a3a', 5) + M.flame(P, 50, 176, 0.5, '#c81e3f') + M.flame(P, 270, 176, 0.6, '#c81e3f'),
      (P) => C.bird(P, { cx: 160, cy: 100, span: 200, c: '#2a1018', edge: '#ff5a5a', eye: '#ff8a5a', style: 'jag' })],
    teeth: [['#2a1408', '#7a3b2e'], (P, R) => M.dunes(P, 150, '#7a4a2a', '#5a301a') + M.cracks(P, R, '#3a1a10', 3),
      (P) => C.worm(P, { cx: 140, base: 180, c: '#5a2a1a', edge: '#ff9a5a' })],
    eyes: [['#0a1a0a', '#2a4a1a'], (P, R) => M.canopy(P, R, 180, 10, '#1a3a12', '#2a5a1e') + M.beasteyes(P, R, 3, '#c8ff6a'),
      (P) => C.owl(P, { cx: 160, cy: 85, c: '#2a3a1a', edge: '#c8ff6a', eye: '#e8ff8a' })],
    mud: [['#3a3220', '#7a6a42'], (P, R) => M.ground(P, 140, '#4a3e26') + M.bubbles(P, R, '#a89a6a', 14) + M.vines(P, R, '#3a5a2a', 3),
      (P) => C.frog(P, { cx: 160, base: 170, c: '#5a5030', edge: '#c8b870', eye: '#ffd84a' })],
    heat: [['#c8642a', '#ffd89a'], (P) => M.sun(P, 270, 35, 18, '#fff3c0') + M.haze(P) + M.dunes(P, 150, '#d9a24a', '#c8862a'),
      (P) => C.beast(P, { cx: 160, base: 170, len: 170, h: 60, c: '#a8461a', edge: '#ffd27a', eye: '#fff3a0', head: 'cat', tail: 'long', marks: '#ffb04a' })],
    whirlwind: [['#ffd86b', '#7ab8e8'], (P) => M.sun(P, 270, 35, 14, '#fff6c0') + M.ground(P, 170, '#c8a86a'),
      (P) => C.spirit(P, { cx: 160, base: 172, h: 150, c: '#e8f0f8', edge: '#ffe7a0', eye: '#5a8ab0', arms: 'up', lower: 'tornado', crown: 'halo' })],
    darkness: [['#05040a', '#1e1430'], (P, R) => M.stars(P, R, 10, '#8a7aaa') + M.mist(P, R, '#2a1e44', 6) + M.beasteyes(P, R, 3, '#b8a0ff'),
      (P) => C.ghost(P, { cx: 160, cy: 90, c: '#140c24', edge: '#8a6aff', eye: '#d8c8ff' })],
    earthquakes: [['#3a2a1a', '#a0784e'], (P, R) => M.snowpeak(P, 50, 160, 60, 60, '#6a543a') + M.snowpeak(P, 280, 160, 60, 70, '#5a4630') + M.ground(P, 160, '#4a3a26') + M.cracks(P, R, '#ffb060', 5),
      (P) => C.spirit(P, { cx: 160, base: 170, h: 145, c: '#6a4a2a', edge: '#ffb060', eye: '#fff3c0', arms: 'up', bulky: true, crown: 'horns', marks: '#ffb060' })],
    behemoth: [['#1a0a04', '#5a2410'], (P) => M.ground(P, 165, '#2a1408') + M.flame(P, 40, 178, 0.5),
      (P) => C.beast(P, { cx: 150, base: 172, len: 200, h: 120, c: '#3a1a0c', edge: '#ff7a2a', eye: '#ff7a2a', head: 'boar', tail: 'thin', horns: '#c8a080', marks: '#ff7a2a' })],
    hearth: [['#2a1a10', '#8a5a2a'], (P, R) => M.stars(P, R, 15, '#ffd8a0') + M.ground(P, 155, '#3a2614') + M.hut(P, 60, 165) + M.hut(P, 265, 165),
      (P) => C.spirit(P, { cx: 160, base: 174, h: 140, c: '#8a4a1e', edge: '#ffc870', eye: '#fff3c0', arms: 'out', item: 'flame', crown: 'halo', itemColor: '#ff9a3a' })],
    gaze: [['#ff9a2a', '#ffe08a'], (P) => M.sun(P, 160, 45, 26, '#fff3b0') + M.dunes(P, 155, '#d99a3a', '#c8862a'),
      (P) => C.bird(P, { cx: 160, cy: 100, span: 200, c: '#e2601e', edge: '#ffe08a', eye: '#ffd84a', style: 'flame' })],
    roots: [['#1a3a1a', '#4a8a3a'], (P, R) => M.canopy(P, R, 180, 4, '#2a5a24', '#1e4a1a'),
      (P) => C.treant(P, { cx: 160, base: 176, c: '#2f6b2f', edge: '#a8e08a', eye: '#e8ff8a' })],
    voice: [['#1a1030', '#5a3a8a'], (P, R) => M.stars(P, R, 20) + M.mist(P, R, '#9370db', 5) + M.arcs(P, 160, 70, '#d8c8ff'),
      (P) => C.ghost(P, { cx: 160, cy: 92, c: '#5a3a8a', edge: '#e8d8ff', eye: '#fff', mouth: true })],
    wounded: [['#1a0a10', '#4a1a2a'], (P) => M.waves(P, 140, '#6a1a2a', 3, 5) + M.drop(P, 270, 50, 0.5),
      (P) => C.heron(P, { cx: 140, base: 168, c: '#d8c8c8', edge: '#ff6a7a', eye: '#ff6a7a' })],
  };

  function svg(id, cls = '') {
    const art = ART[id];
    if (!art) return '';
    const P = 'sa' + id.replace(/[^a-z0-9]/gi, '');
    const R = rng(hash(id));
    const [top, bot] = art[0];
    DEFS = {};
    PFX = P;
    const bg = art[1](P, R);
    const fg = art[2](P, R);
    const defs = Object.values(DEFS).join('');
    DEFS = null;
    return `<svg class="spirit-art ${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>${defs}
        <filter id="${P}ds" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="3" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".55"/></filter>
        <radialGradient id="${P}gs" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
        <linearGradient id="${P}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient>
        <filter id="${P}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
        <radialGradient id="${P}v" cx="50%" cy="45%" r="70%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#${P}sky)"/>
      <g opacity=".8">${bg}</g>
      <ellipse cx="160" cy="172" rx="110" ry="12" fill="url(#${P}gs)"/>
      <g filter="url(#${P}ds)">${fg}</g>
      <rect width="${W}" height="${H}" fill="url(#${P}v)"/>
    </svg>`;
  }

  /** 정령 그림 HTML: custom-art 폴더에 그림이 있으면 그 그림, 없으면 오리지널 일러스트 */
  function html(id, cls = '') {
    const custom = typeof app !== 'undefined' && app.catalog && app.catalog.customArt && app.catalog.customArt[id];
    if (custom) return `<img class="spirit-art ${cls}" src="${custom}" alt="" loading="lazy">`;
    return svg(id, cls);
  }

  return { svg, html, ids: Object.keys(ART) };
})();
