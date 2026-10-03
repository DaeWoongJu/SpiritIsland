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

  // ───── 정령별 구성 ─────
  // [하늘 위 색, 하늘 아래 색], 그림 함수
  const ART = {
    lightning: [['#1a1f3a', '#5a4a8a'], (P, R) => M.stars(P, R, 25) + M.mountains(P, R, 150, '#262238', 6, 50) + M.bolt(P, 170, 10, 1.4) + M.bolt(P, 70, 40, 0.7, '#e8dcff') + M.swirl(P, 250, 60, 40, '#e8dcff', 0.4)],
    river: [['#ffcf7a', '#6fb7d8'], (P) => M.sun(P, 240, 50, 22) + M.ground(P, 110, '#4f8a4a') + M.waves(P, 120, '#3d8fc0', 4, 7) + M.glow(P, 160, 130, 60, '#fff2c0', 0.25)],
    earth: [['#5a4a3a', '#a8865a'], (P, R) => M.snowpeak(P, 160, 160, 110, 120, '#6e5a46') + M.snowpeak(P, 60, 170, 70, 70, '#5a4a3a') + M.snowpeak(P, 260, 170, 80, 85, '#5f4c3a') + M.ground(P, 155, '#3e5a2e') + M.canopy(P, R, 170, 6, '#3f7a35', '#2e6a2a')],
    shadows: [['#0e0a1a', '#3a1a4a'], (P, R) => M.stars(P, R, 15, '#d8b8ff') + M.moon(P, 250, 45, 20, '#e8d8ff') + M.flame(P, 150, 165, 1.6, '#9b51e0', '#e8a0ff') + M.mist(P, R, '#6a3a8a', 6)],
    thunder: [['#3a2410', '#c86a2a'], (P, R) => M.sun(P, 230, 55, 18, '#ffb04a') + M.ground(P, 140, '#4a2a14') + M.figures(P, [60, 100, 140, 180, 220, 260], 168) + M.bolt(P, 160, 0, 0.6, '#ffe7a0')],
    ocean: [['#0a2a48', '#2a6aa0'], (P, R) => M.stars(P, R, 12) + M.moon(P, 60, 40, 14) + M.waves(P, 95, '#1e5f96', 5, 9) + M.tentacles(P, R, '#0f3a66')],
    bringer: [['#10081e', '#4a2a6a'], (P, R) => M.stars(P, R, 45, '#f0d8ff') + M.moon(P, 160, 70, 34, '#f0e0ff') + M.mist(P, R, '#c86bd8', 7) + M.eye(P, 70, 120, 0.8, '#e080ff') + M.eye(P, 250, 110, 0.6, '#e080ff')],
    green: [['#9ad86a', '#2e7a35'], (P, R) => M.sun(P, 260, 35, 16, '#fff3a0') + M.canopy(P, R, 175, 10, '#3f9a46', '#2e7a35') + M.vines(P, R, '#5fc35a', 8)],
    keeper: [['#0e2a1a', '#2e6a40'], (P, R) => M.pines(P, R, 180, 14, '#0f3a1e') + M.bigtree(P, 160, 180, '#1f5a2e') + M.beasteyes(P, R, 3, '#ffd86b')],
    wildfire: [['#2a0a04', '#c8401c'], (P, R) => M.ground(P, 150, '#1a0a04') + M.flame(P, 160, 165, 2.2) + M.flame(P, 70, 170, 1.1) + M.flame(P, 255, 172, 1.2) + M.stars(P, R, 25, '#ffb070')],
    stone: [['#4a4f56', '#9aa0a6'], (P, R) => M.snowpeak(P, 160, 150, 140, 110, '#6c6a66') + M.boulders(P, R, 160, '#5a5854') + M.glow(P, 160, 80, 30, '#fff', 0.12)],
    volcano: [['#1a0806', '#7a2a14'], (P, R) => M.stars(P, R, 15, '#ffb070') + M.volcano(P, 160, 180) + M.cracks(P, R, '#ff7a2a', 4)],
    fangs: [['#0e1a0a', '#2a4a1a'], (P, R) => M.canopy(P, R, 180, 9, '#1f3a14', '#2a4a1a') + M.fangs(P, 160, 90, 1.2) + M.beasteyes(P, R, 3)],
    serpent: [['#14200e', '#4a6a2a'], (P, R) => M.ground(P, 120, '#2a3a1a') + M.serpent(P, '#5d8a2a', 130) + M.glow(P, 300, 116, 14, '#ffd84a', 0.5)],
    downpour: [['#2a3a4a', '#6a8aa0'], (P, R) => M.rain(P, R, '#d8ecff', 90) + M.waves(P, 140, '#3a6a8a', 3, 4) + M.mist(P, R, '#dfe8f0', 5)],
    finder: [['#2a2418', '#8a7a52'], (P, R) => M.stars(P, R, 30, '#fff3c8') + M.constellation(P, R, '#fff3c8') + M.ground(P, 140, '#4a3e28') + M.path(P) + M.footprints(P, R)],
    trickster: [['#3a2a08', '#c8962a'], (P, R) => M.mask(P, 160, 85, 1) + M.birds(P, R, 5, '#3a2a08') + M.flame(P, 50, 170, 0.6) + M.flame(P, 280, 168, 0.5)],
    lure: [['#0a1a10', '#1f4a2a'], (P, R) => M.pines(P, R, 180, 18, '#0a2414') + M.path(P, '#bfe3a0') + M.glow(P, 165, 55, 26, '#c8ffb0', 0.6) + M.beasteyes(P, R, 2, '#c8ffb0')],
    manyminds: [['#c8a06a', '#5a8ab0'], (P, R) => M.birds(P, R, 40, '#2a1e10') + M.ground(P, 155, '#6a5a3a')],
    memory: [['#1e1838', '#5a4a8a'], (P, R) => M.stars(P, R, 30) + M.spiral(P, 160, 85) + M.boulders(P, R, 175, '#3a3458')],
    mist: [['#8a9aaa', '#d0dbe6'], (P, R) => M.pines(P, R, 180, 12, '#6a7a88') + M.mist(P, R, '#ffffff', 12)],
    starlight: [['#05081a', '#1a2a5a'], (P, R) => M.stars(P, R, 70) + M.constellation(P, R) + M.glow(P, 160, 90, 40, '#9fb4ff', 0.5) + M.shards(P, R, '#cfd8ff')],
    fractured: [['#1a1028', '#6a4a8a'], (P, R) => M.stars(P, R, 25) + M.sun(P, 100, 70, 22, '#ffe0a0') + M.moon(P, 220, 70, 24) + M.shards(P, R) + M.hourglass(P, 160, 120, 0.7)],
    vengeance: [['#1a0408', '#6a1428'], (P, R) => M.ground(P, 150, '#2a0a10') + M.flame(P, 160, 120, 1.4, '#c81e3f', '#ff8a5a') + M.skull(P, 160, 145, 0.8) + M.mist(P, R, '#6a2a3a', 6)],
    teeth: [['#2a1408', '#7a3b2e'], (P, R) => M.teeth(P, 130) + M.glow(P, 160, 150, 40, '#ff6a2a', 0.3) + M.cracks(P, R, '#3a1a10', 3)],
    eyes: [['#0a1a0a', '#2a4a1a'], (P, R) => M.canopy(P, R, 180, 12, '#1a3a12', '#2a5a1e') + M.eye(P, 90, 70, 0.8, '#c8ff6a') + M.eye(P, 220, 60, 0.6, '#c8ff6a') + M.eye(P, 160, 120, 0.5, '#c8ff6a')],
    mud: [['#3a3220', '#7a6a42'], (P, R) => M.ground(P, 110, '#4a3e26') + M.bubbles(P, R, '#a89a6a', 18) + M.mist(P, R, '#a8a080', 5) + M.vines(P, R, '#3a5a2a', 3)],
    heat: [['#c8642a', '#ffd89a'], (P, R) => M.sun(P, 160, 50, 26, '#fff3c0') + M.haze(P) + M.dunes(P, 140, '#d9a24a', '#c8862a') + M.snowpeak(P, 60, 150, 50, 50, '#a86a3a')],
    whirlwind: [['#ffd86b', '#7ab8e8'], (P, R) => M.sun(P, 260, 40, 18, '#fff6c0') + M.swirl(P, 140, 95, 70, '#ffffff', 0.85) + M.swirl(P, 140, 95, 40, '#ffe7a0', 0.6) + M.ground(P, 165, '#c8a86a')],
    darkness: [['#05040a', '#1e1430'], (P, R) => M.stars(P, R, 10, '#8a7aaa') + M.mist(P, R, '#2a1e44', 8) + M.eye(P, 120, 90, 0.7, '#b8a0ff') + M.eye(P, 200, 90, 0.7, '#b8a0ff')],
    earthquakes: [['#3a2a1a', '#a0784e'], (P, R) => M.snowpeak(P, 90, 150, 80, 80, '#6a543a') + M.snowpeak(P, 230, 150, 90, 95, '#5a4630') + M.ground(P, 145, '#4a3a26') + M.cracks(P, R, '#ffb060', 6) + M.figures(P, [160], 150, '#2a1a0a')],
    behemoth: [['#1a0a04', '#5a2410'], (P, R) => M.ground(P, 150, '#2a1408') + `<path d="M40 150C60 70 120 40 160 40S260 70 280 150Z" fill="#3a1a0c"/>` + M.eye(P, 125, 85, 0.7, '#ff7a2a') + M.eye(P, 195, 85, 0.7, '#ff7a2a') + M.flame(P, 160, 175, 0.6)],
    hearth: [['#2a1a10', '#8a5a2a'], (P, R) => M.stars(P, R, 15, '#ffd8a0') + M.ground(P, 150, '#3a2614') + M.hut(P, 110, 158) + M.hut(P, 215, 160) + M.flame(P, 163, 165, 0.9) + M.figures(P, [70, 260], 165)],
    gaze: [['#ff9a2a', '#ffe08a'], (P, R) => M.sun(P, 160, 70, 34, '#fff3b0') + M.eye(P, 160, 70, 0.9, '#c86a00') + M.dunes(P, 150, '#d99a3a', '#c8862a')],
    roots: [['#1a3a1a', '#4a8a3a'], (P, R) => M.bigtree(P, 160, 150, '#2f6b2f') + M.roots(P, R) + M.canopy(P, R, 180, 5, '#2a5a24', '#1e4a1a')],
    voice: [['#1a1030', '#5a3a8a'], (P, R) => M.stars(P, R, 20) + M.arcs(P, 160, 85) + M.mist(P, R, '#9370db', 6)],
    wounded: [['#1a0a10', '#4a1a2a'], (P, R) => M.waves(P, 120, '#6a1a2a', 4, 6) + M.drop(P, 160, 70, 1.1) + M.glow(P, 160, 140, 50, '#ff5a6a', 0.2)],
  };

  function svg(id, cls = '') {
    const art = ART[id];
    if (!art) return '';
    const P = 'sa' + id.replace(/[^a-z0-9]/gi, '');
    const R = rng(hash(id));
    const [top, bot] = art[0];
    return `<svg class="spirit-art ${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="${P}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient>
        <filter id="${P}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
        <radialGradient id="${P}v" cx="50%" cy="45%" r="70%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#${P}sky)"/>
      ${art[1](P, R)}
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
