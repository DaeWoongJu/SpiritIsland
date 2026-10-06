'use strict';
/* 반지의 제왕: 원정대의 운명 — 직접 그린 가운데땅 지도 (SVG) */

const Art = (() => {
  const W = 1000; const H = 700;
  // 간단한 결정적 난수 (지도 장식이 매번 같은 모양이 되도록)
  let s0 = 7;
  const rnd = () => { s0 = (s0 * 16807) % 2147483647; return (s0 - 1) / 2147483646; };

  const peak = (x, y, sz = 14, snow = false) => `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
    <path d="M${-sz} ${sz * 0.6} L0 ${-sz * 0.8} L${sz} ${sz * 0.6} Z" fill="#a08a64" stroke="#5a4428" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M0 ${-sz * 0.8} L${sz * 0.35} ${sz * 0.6} L${sz} ${sz * 0.6} Z" fill="#7a6644" opacity=".7"/>
    ${snow ? `<path d="M${-sz * 0.33} ${-sz * 0.25} L0 ${-sz * 0.8} L${sz * 0.33} ${-sz * 0.25} L${sz * 0.1} ${-sz * 0.35} L0 ${-sz * 0.15} L${-sz * 0.12} ${-sz * 0.35} Z" fill="#f4f0e4"/>` : ''}</g>`;
  const darkPeak = (x, y, sz = 13) => `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
    <path d="M${-sz} ${sz * 0.6} L${-sz * 0.2} ${-sz * 0.9} L${sz * 0.1} ${-sz * 0.5} L${sz} ${sz * 0.6} Z" fill="#4a3434" stroke="#1a0e0e" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M${-sz * 0.2} ${-sz * 0.9} L${sz * 0.2} ${sz * 0.6} L${sz} ${sz * 0.6} L${sz * 0.1} ${-sz * 0.5} Z" fill="#2a1a1a" opacity=".8"/></g>`;
  const tree = (x, y, sz = 9, col = '#4a6a2a', dark = '#2a4018') => `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
    <rect x="-1.2" y="${sz * 0.4}" width="2.4" height="${sz * 0.6}" fill="#5a3a1a"/>
    <circle cx="0" cy="0" r="${sz * 0.62}" fill="${col}" stroke="${dark}" stroke-width="1.2"/>
    <circle cx="${-sz * 0.25}" cy="${-sz * 0.2}" r="${sz * 0.22}" fill="#fff" opacity=".18"/></g>`;
  const along = (pts, n, fn) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) * (pts.length - 1);
      const k = Math.min(pts.length - 2, Math.floor(t));
      const f = t - k;
      const x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f + (rnd() - 0.5) * 10;
      const y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f + (rnd() - 0.5) * 8;
      out.push(fn(x, y, i));
    }
    return out.join('');
  };
  const forest = (cx, cy, rx, ry, n, col, dark) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2; const r = Math.sqrt(rnd());
      out.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
    }
    out.sort((a, b) => a[1] - b[1]);
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx + 8}" ry="${ry + 8}" fill="${col}" opacity=".22"/>` + out.map(([x, y]) => tree(x, y, 8 + rnd() * 4, col, dark)).join('');
  };

  /** 정적인 바탕 지도 (한 번만 그림) */
  function baseMap(D) {
    s0 = 7;
    const regionLabel = (x, y, t, c, r = 0) => `<text x="${x}" y="${y}" transform="rotate(${r} ${x} ${y})" class="m-region" fill="${c}">${t}</text>`;
    const roads = D.EDGES.map(([a, b]) => {
      const A = D.LOC[a]; const B = D.LOC[b];
      const mx = (A.x + B.x) / 2 + (A.y - B.y) * 0.08; const my = (A.y + B.y) / 2 + (B.x - A.x) * 0.08;
      return `<path d="M${A.x} ${A.y} Q${mx.toFixed(1)} ${my.toFixed(1)} ${B.x} ${B.y}" class="m-road"/>`;
    }).join('');
    return `<svg class="map-base" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="parch" cx="0.5" cy="0.45" r="0.75"><stop offset="0" stop-color="#f3e2b8"/><stop offset=".7" stop-color="#e2c890"/><stop offset="1" stop-color="#b8945a"/></radialGradient>
        <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .25  0 0 0 0 .1  0 0 0 .18 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
        <radialGradient id="doomglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff9a30" stop-opacity=".85"/><stop offset="1" stop-color="#ff3010" stop-opacity="0"/></radialGradient>
        <radialGradient id="mordorTint" cx=".55" cy=".5" r=".6"><stop offset="0" stop-color="#5a1a10" stop-opacity=".55"/><stop offset="1" stop-color="#3a1008" stop-opacity=".25"/></radialGradient>
        <pattern id="waves" width="40" height="18" patternUnits="userSpaceOnUse"><path d="M2 10 Q8 4 14 10 T26 10" fill="none" stroke="#5a7a84" stroke-width="1.2" opacity=".5"/></pattern>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#parch)"/>
      <rect width="${W}" height="${H}" fill="#000" filter="url(#rough)" opacity=".9"/>
      <!-- 바다 (벨레가에르, 벨팔라스 만) -->
      <path d="M0 0 L46 0 Q60 60 40 120 Q20 180 52 230 Q30 300 70 360 Q120 430 170 470 Q220 520 260 560 Q330 600 380 650 Q470 660 520 700 L0 700 Z" fill="#9ab8bc" stroke="#5a7a84" stroke-width="2"/>
      <path d="M0 0 L46 0 Q60 60 40 120 Q20 180 52 230 Q30 300 70 360 Q120 430 170 470 Q220 520 260 560 Q330 600 380 650 Q470 660 520 700 L0 700 Z" fill="url(#waves)"/>
      <text x="40" y="520" class="m-sea" transform="rotate(-62 40 520)">벨레가에르 — 큰 바다</text>
      <text x="300" y="672" class="m-sea">벨팔라스 만</text>
      <!-- 모르도르 -->
      <path d="M770 300 Q880 290 1000 300 L1000 700 L790 700 Q770 620 790 560 Q760 470 770 300 Z" fill="url(#mordorTint)"/>
      <!-- 강 -->
      <path d="M640 20 Q615 90 600 150 Q585 230 572 290 Q590 340 612 372 Q640 410 652 440 Q690 490 690 520 Q680 570 655 600 Q630 625 615 642 Q600 670 588 700" class="m-river"/>
      <text x="575" y="235" class="m-rivername" transform="rotate(-78 575 235)">안두인 대하</text>
      <path d="M392 352 Q370 400 330 430 Q290 470 270 520 Q250 545 232 552" class="m-river thin"/>
      <path d="M690 520 Q720 480 760 470" class="m-river thin" opacity=".4"/>
      <path d="M150 210 Q120 240 90 260 Q70 268 58 265" class="m-river thin"/>
      <!-- 숲 -->
      ${forest(655, 165, 62, 105, 70, '#3a5a2a', '#1a3010')}
      ${forest(490, 405, 34, 26, 16, '#4a6a2a', '#2a4018')}
      ${forest(525, 318, 26, 20, 11, '#c8b030', '#7a6a10')}
      ${forest(735, 445, 22, 32, 11, '#5a7a3a', '#2a4a18')}
      ${forest(205, 230, 22, 12, 6, '#4a6a2a', '#2a4018')}
      <!-- 안개산맥 -->
      ${along([[480, 30], [470, 110], [470, 190], [462, 260], [450, 320], [418, 360]], 22, (x, y, i) => peak(x, y, 13 + rnd() * 5, i < 15))}
      <!-- 회색산맥 -->
      ${along([[480, 40], [580, 30], [690, 35]], 9, (x, y) => peak(x, y, 10 + rnd() * 3, true))}
      <!-- 백색산맥 -->
      ${along([[325, 520], [410, 545], [500, 548], [580, 540]], 16, (x, y) => peak(x, y, 12 + rnd() * 4, true))}
      <!-- 에민 무일 -->
      ${along([[648, 360], [690, 370]], 4, (x, y) => peak(x, y, 8))}
      <!-- 에펠 두아스(그림자 산맥), 에레드 리수이(재의 산맥) -->
      ${along([[780, 360], [772, 430], [790, 500], [800, 580], [860, 600], [960, 595]], 20, (x, y) => darkPeak(x, y, 12 + rnd() * 4))}
      ${along([[810, 318], [880, 308], [990, 312]], 11, (x, y) => darkPeak(x, y, 12 + rnd() * 4))}
      <!-- 운명의 산 -->
      <circle cx="905" cy="470" r="46" fill="url(#doomglow)"/>
      <path d="M875 492 L897 452 L913 452 L935 492 Z" fill="#3a2020" stroke="#1a0808" stroke-width="2"/>
      <path d="M897 452 Q905 440 913 452" fill="#ff7a20"/>
      <path d="M903 452 Q900 470 893 488" stroke="#ff6a10" stroke-width="2" fill="none"/>
      <!-- 바랏두르와 눈 -->
      <path d="M972 392 L976 344 L980 334 L984 344 L988 392 Z" fill="#1a1010" stroke="#000" stroke-width="1.5"/>
      <ellipse cx="980" cy="330" rx="9" ry="4.5" fill="#ff8a20" class="m-eye"/><ellipse cx="980" cy="330" rx="1.6" ry="4" fill="#000"/>
      ${regionLabel(190, 290, '에 리 아 도 르', '#3a5a2a', -8)}
      ${regionLabel(790, 240, '로 바 니 온', '#5a3a7a', 0)}
      ${regionLabel(420, 445, '로 한', '#8a6a10', 0)}
      ${regionLabel(560, 600, '곤 도 르', '#2a4a7a', -4)}
      ${regionLabel(880, 655, '모 르 도 르', '#7a1a10', 0)}
      <!-- 길 -->
      ${roads}
      <!-- 나침반 -->
      <g transform="translate(80,62) scale(.8)" opacity=".7"><circle r="26" fill="none" stroke="#5a4428" stroke-width="1.5"/><path d="M0 -30 L6 0 L0 30 L-6 0 Z" fill="#5a4428"/><path d="M-30 0 L0 5 L30 0 L0 -5 Z" fill="#8a7454"/><text y="-34" text-anchor="middle" class="m-compass">N</text></g>
      <rect x="4" y="4" width="${W - 8}" height="${H - 8}" fill="none" stroke="#6a4a20" stroke-width="5" rx="6"/>
      <rect x="11" y="11" width="${W - 22}" height="${H - 22}" fill="none" stroke="#a07a40" stroke-width="1.5" rx="4"/>
    </svg>`;
  }

  const TYPE_GLYPH = { haven: '✦', stronghold: '♜', mountain: '▲', forest: '♣', city: '♖', plain: '•' };

  function orc(x, y) {
    return `<g transform="translate(${x},${y})" class="orc"><circle r="6.5" fill="#3a4a1a" stroke="#120" stroke-width="1.4"/>
      <path d="M-6 -2 L-9 -6 L-4 -4 Z M6 -2 L9 -6 L4 -4 Z" fill="#3a4a1a" stroke="#120" stroke-width="1"/>
      <circle cx="-2.3" cy="-1" r="1.4" fill="#ff3a10"/><circle cx="2.3" cy="-1" r="1.4" fill="#ff3a10"/><path d="M-3 3 L3 3" stroke="#e8e0c0" stroke-width="1.2"/></g>`;
  }
  function army(x, y) {
    return `<g transform="translate(${x},${y})" class="army"><path d="M-6 -7 L6 -7 L6 0 Q6 6 0 8 Q-6 6 -6 0 Z" fill="#3a6ab8" stroke="#0a1a3a" stroke-width="1.4"/>
      <path d="M0 -5 L0 5 M-3.5 -1 L3.5 -1" stroke="#f0e8c8" stroke-width="1.5"/></g>`;
  }
  function nazgul(x, y) {
    return `<g transform="translate(${x},${y})" class="nazgul"><path d="M0 -10 Q7 -8 7 0 L9 10 L-9 10 L-7 0 Q-7 -8 0 -10 Z" fill="#141018" stroke="#000" stroke-width="1.2"/>
      <path d="M-4 -4 Q0 -7 4 -4 L3 1 L-3 1 Z" fill="#000"/><circle cx="-1.5" cy="-2" r=".9" fill="#c8e0ff"/><circle cx="1.5" cy="-2" r=".9" fill="#c8e0ff"/></g>`;
  }
  function pawn(x, y, c, color, opts = {}) {
    const ring = c.ringbearer;
    return `<g transform="translate(${x},${y})" class="pawn ${ring ? 'ringbearer' : ''} ${opts.hidden ? 'hiddenF' : ''} ${opts.sel ? 'sel' : ''} ${opts.mine ? 'mine' : ''}" data-pawn="${c.id}">
      ${ring ? '<circle r="14" fill="none" stroke="#ffd860" stroke-width="2" class="ring-glow"/>' : ''}
      <circle r="11" fill="${c.color}" stroke="${color || '#1a1008'}" stroke-width="3"/>
      <text y="4.5" text-anchor="middle" font-size="12">${c.icon}</text></g>`;
  }

  /** 움직이는 것들 (오크·군대·나즈굴·인물) */
  function overlay(D, st, opts) {
    const out = [];
    const can = opts.can || {};
    for (const l of D.LOCATIONS) {
      const s = st.locs[l.id] || {};
      const reg = D.REGIONS[l.region];
      const cls = ['loc', `t-${l.type}`, can[l.id] ? 'can' : '', s.captured ? 'captured' : '', opts.focus && opts.focus.has(l.id) ? 'focus' : ''].join(' ');
      out.push(`<g class="${cls}" data-loc="${l.id}" transform="translate(${l.x},${l.y})">
        <circle r="24" class="hit" fill="transparent"/>
        ${can[l.id] ? '<circle r="21" class="can-ring"/>' : ''}
        <circle r="15" fill="${reg.color}" stroke="${l.type === 'haven' ? '#fff8d0' : '#2a1a08'}" stroke-width="${l.type === 'haven' ? 3.5 : 2.5}"/>
        <circle r="11" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1"/>
        <text y="5" text-anchor="middle" class="glyph">${TYPE_GLYPH[l.type]}</text>
        ${s.captured ? '<text x="10" y="-10" font-size="13">🚩</text>' : ''}
        <text y="31" text-anchor="middle" class="m-label">${l.name}</text>
      </g>`);
    }
    // 토큰
    for (const l of D.LOCATIONS) {
      const s = st.locs[l.id] || {};
      for (let i = 0; i < s.orcs; i++) out.push(orc(l.x - 22 - i * 7, l.y - 14 + i * 7));
      for (let i = 0; i < s.armies; i++) out.push(army(l.x + 22 + i * 4, l.y - 12 + i * 8));
      const nz = st.nazgul.filter((n) => n.loc === l.id);
      nz.forEach((n, i) => out.push(nazgul(l.x - 8 + i * 9 - (nz.length - 1) * 2, l.y - 30 - (i % 2) * 4)));
    }
    // 인물
    const byLoc = {};
    for (const p of st.pawns) (byLoc[p.loc] ||= []).push(p);
    for (const [loc, list] of Object.entries(byLoc)) {
      const l = D.LOC[loc];
      list.forEach((p, i) => {
        const c = D.CHAR[p.id];
        const row = Math.floor(i / 4); const k = i % 4; const n = Math.min(4, list.length - row * 4);
        out.push(pawn(l.x + (k - (n - 1) / 2) * 21, l.y + 48 + row * 21, c, opts.pawnColor(p.id), { hidden: p.id === 'frodo' && st.hidden, sel: opts.sel === p.id, mine: opts.mine && opts.mine.includes(p.id) }));
      });
    }
    return `<svg class="map-over" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${out.join('')}</svg>`;
  }

  function charBadge(c, size = 34, color = '#1a1008') {
    return `<svg width="${size}" height="${size}" viewBox="-15 -15 30 30" class="badge"><circle r="13" fill="${c.color}" stroke="${color}" stroke-width="2.5"/><text y="5" text-anchor="middle" font-size="14">${c.icon}</text></svg>`;
  }

  return { baseMap, overlay, charBadge, orc, army, nazgul, W, H };
})();
window.Art = Art;
