'use strict';
/* 킵 더 히어로즈 아웃 — 그림 (직접 그린 SVG: 몬스터 말, 용사 말, 방 장식, 토큰) */

const Art = (() => {
  const eyes = (y = 15, dx = 4.5, r = 2.6) => `<circle cx="${16 - dx}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${16 + dx}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${16 - dx + 0.6}" cy="${y + 0.5}" r="${r * 0.5}" fill="#111"/><circle cx="${16 + dx + 0.6}" cy="${y + 0.5}" r="${r * 0.5}" fill="#111"/>`;
  const stroke = 'stroke="#1a1020" stroke-width="1.6" stroke-linejoin="round"';
  // 몬스터 말 (32×32)
  const MONSTER = {
    rats: (c) => `<path d="M8 13 Q6 5 10 6 Q12 7 12 11 M24 13 Q26 5 22 6 Q20 7 20 11" fill="${c}" ${stroke}/><path d="M26 26 Q31 28 30 22" fill="none" stroke="#e8a8a8" stroke-width="1.6"/><ellipse cx="16" cy="19" rx="10" ry="10" fill="${c}" ${stroke}/>${eyes(16, 4, 2.2)}<ellipse cx="16" cy="22" rx="2" ry="1.4" fill="#e88888"/><path d="M12 24 l-4 1 M12 23 l-4 -1 M20 24 l4 1 M20 23 l4 -1" stroke="#1a1020" stroke-width="0.8"/>`,
    slimes: (c) => `<path d="M5 28 Q4 18 9 12 Q14 4 16 3 Q18 4 23 12 Q28 18 27 28 Q16 31 5 28 Z" fill="${c}" ${stroke}/><ellipse cx="11" cy="11" rx="2" ry="3" fill="#fff" opacity=".55"/>${eyes(18, 4.5, 2.8)}<path d="M12 24 Q16 26 20 24" fill="none" stroke="#1a1020" stroke-width="1.4" stroke-linecap="round"/>`,
    gnolls: (c) => `<path d="M7 12 L5 3 L12 8 M25 12 L27 3 L20 8" fill="${c}" ${stroke}/><path d="M5 18 Q5 8 16 8 Q27 8 27 18 Q27 30 16 30 Q5 30 5 18 Z" fill="${c}" ${stroke}/><path d="M11 21 Q16 30 21 21 Z" fill="#e8d0a8" ${stroke}/>${eyes(15, 5, 2.4)}<circle cx="16" cy="21" r="1.6" fill="#1a1020"/><path d="M9 9 l2 3 M13 7 l1 3 M19 7 l-1 3" stroke="#5a3a1a" stroke-width="1"/>`,
    skeletons: (c) => `<path d="M6 15 Q6 4 16 4 Q26 4 26 15 Q26 20 22 22 L22 28 L10 28 L10 22 Q6 20 6 15 Z" fill="${c}" ${stroke}/><circle cx="11.5" cy="15" r="3.4" fill="#1a1020"/><circle cx="20.5" cy="15" r="3.4" fill="#1a1020"/><circle cx="12" cy="15.4" r="1" fill="#ff5a3a"/><circle cx="21" cy="15.4" r="1" fill="#ff5a3a"/><path d="M15 20 l1 -2 l1 2 Z" fill="#1a1020"/><path d="M12 24 v4 M15 24 v4 M18 24 v4 M21 24 v4" stroke="#1a1020" stroke-width="1.2"/>`,
    lizards: (c) => `<path d="M16 3 L19 7 L22 4 L23 9 L27 8 L25 13" fill="#e8c83a" ${stroke}/><path d="M4 20 Q4 8 16 9 Q28 10 28 20 Q28 30 16 30 Q4 30 4 20 Z" fill="${c}" ${stroke}/><circle cx="10" cy="15" r="3" fill="#f0e040" ${stroke}/><circle cx="22" cy="15" r="3" fill="#f0e040" ${stroke}/><path d="M10 13.5 v3 M22 13.5 v3" stroke="#1a1020" stroke-width="1.4"/><path d="M9 23 Q16 27 23 23" fill="none" stroke="#1a1020" stroke-width="1.4"/><circle cx="13" cy="20" r=".8" fill="#1a1020"/><circle cx="19" cy="20" r=".8" fill="#1a1020"/>`,
    imps: (c) => `<path d="M7 11 Q4 3 9 2 Q9 7 12 9 M25 11 Q28 3 23 2 Q23 7 20 9" fill="#3a1a1a" ${stroke}/><path d="M2 18 Q5 12 9 16 M30 18 Q27 12 23 16" fill="#9a2a2a" ${stroke}/><ellipse cx="16" cy="19" rx="9" ry="10" fill="${c}" ${stroke}/>${eyes(16, 4, 2.4)}<path d="M11 23 Q16 27 21 23 L19 23 L18 25 L17 23 L15 23 L14 25 L13 23 Z" fill="#fff" ${stroke}/><path d="M25 26 Q30 29 29 24 l2 -1" fill="none" stroke="#1a1020" stroke-width="1.4"/>`,
    ghosts: (c) => `<path d="M5 30 L5 15 Q5 3 16 3 Q27 3 27 15 L27 30 L23 27 L19.5 30 L16 27 L12.5 30 L9 27 Z" fill="${c}" ${stroke} opacity=".92"/><ellipse cx="11.5" cy="14" rx="2.4" ry="3.4" fill="#1a1020"/><ellipse cx="20.5" cy="14" rx="2.4" ry="3.4" fill="#1a1020"/><ellipse cx="16" cy="21" rx="2.6" ry="3.2" fill="#1a1020"/>`,
    witches: (c) => `<path d="M16 1 L24 13 L28 14 L4 14 L8 13 Z" fill="#2a1a3a" ${stroke}/><path d="M9 12 L23 12" stroke="#c8a83a" stroke-width="2"/><path d="M7 15 Q7 29 16 29 Q25 29 25 15 Z" fill="#9ad87a" ${stroke}/><path d="M7 15 Q4 24 6 30 M25 15 Q28 24 26 30" fill="none" stroke="${c}" stroke-width="3"/>${eyes(19, 4, 2.2)}<path d="M15 21 l2 4 l-3 0 Z" fill="#7ab85a" ${stroke}/><path d="M12 26 Q16 28 20 26" fill="none" stroke="#1a1020" stroke-width="1.2"/>`,
    emberlings: (c) => `<path d="M16 2 Q19 8 23 7 Q22 11 26 13 Q30 22 24 28 Q16 33 8 28 Q2 22 6 13 Q10 11 9 7 Q13 8 16 2 Z" fill="${c}" ${stroke}/><path d="M16 12 Q19 16 21 15 Q23 22 16 26 Q9 22 11 15 Q13 16 16 12 Z" fill="#ffd84a"/>${eyes(19, 4, 2.2)}<path d="M13 24 Q16 26 19 24" fill="none" stroke="#1a1020" stroke-width="1.3" stroke-linecap="round"/>`,
    dragon: (c) => `<path d="M2 14 Q4 4 10 9 L8 14 Z M30 14 Q28 4 22 9 L24 14 Z" fill="#7a2a1a" ${stroke}/><path d="M9 8 L7 1 L13 6 M23 8 L25 1 L19 6" fill="#e8d0a0" ${stroke}/><path d="M5 18 Q5 7 16 7 Q27 7 27 18 L27 22 Q27 30 16 30 Q5 30 5 22 Z" fill="${c}" ${stroke}/><path d="M9 22 Q16 30 23 22 Q16 26 9 22 Z" fill="#f0c890" ${stroke}/><circle cx="11" cy="15" r="2.8" fill="#f8e040" ${stroke}/><circle cx="21" cy="15" r="2.8" fill="#f8e040" ${stroke}/><path d="M11 13 v4 M21 13 v4" stroke="#1a1020" stroke-width="1.3"/><circle cx="13" cy="21" r="1" fill="#1a1020"/><circle cx="19" cy="21" r="1" fill="#1a1020"/>`,
  };
  function monster(clan, color, size = 34, extra = '') {
    const f = MONSTER[clan] || MONSTER.slimes;
    return `<svg class="mp" viewBox="0 0 32 32" width="${size}" height="${size}" ${extra}><ellipse cx="16" cy="30.5" rx="11" ry="2" fill="#000" opacity=".35"/>${f(color)}</svg>`;
  }

  // 용사 말 (32×32): 둥근 머리 + 몸통 + 직업 표시
  const HERO_TOP = {
    warrior: (c) => `<path d="M9 9 Q9 2 16 2 Q23 2 23 9 L23 11 L9 11 Z" fill="#b8b8c8" ${stroke}/><path d="M16 2 v9" stroke="#7a7a8a" stroke-width="1.2"/><path d="M8 7 L4 3 L9 5 M24 7 L28 3 L23 5" fill="#e8e0c8" ${stroke}/>`,
    knight: (c) => `<path d="M8 11 Q8 1 16 1 Q24 1 24 11 Z" fill="#d8c060" ${stroke}/><path d="M11 7 h10" stroke="#1a1020" stroke-width="1.6"/><path d="M16 1 Q20 -2 22 2" fill="none" stroke="#d83a3a" stroke-width="2.4"/>`,
    archer: (c) => `<path d="M8 10 Q10 1 16 1 Q22 1 24 10 Q16 6 8 10 Z" fill="${c}" ${stroke}/><path d="M23 3 l5 -2 l-2 4" fill="#e8e0c8" ${stroke}/>`,
    ranger: (c) => `<path d="M7 11 Q9 0 16 0 Q23 0 25 11 Q16 6 7 11 Z" fill="${c}" ${stroke}/><path d="M24 2 l5 -2 l-2 4" fill="#e8e0c8" ${stroke}/>`,
    rogue: (c) => `<path d="M7 12 Q8 1 16 1 Q24 1 25 12 Q20 8 16 8 Q12 8 7 12 Z" fill="#3a2a4a" ${stroke}/><path d="M10 12 h12 v3 h-12 Z" fill="${c}" ${stroke}/>`,
    assassin: (c) => `<path d="M6 13 Q8 0 16 0 Q24 0 26 13 Q20 8 16 8 Q12 8 6 13 Z" fill="#1a1020" ${stroke}/><path d="M10 12 h12 v3 h-12 Z" fill="${c}" ${stroke}/>`,
    mage: (c) => `<path d="M16 -2 L24 11 L8 11 Z" fill="${c}" ${stroke}/><circle cx="16" cy="4" r="1.6" fill="#f8e060"/>`,
    archmage: (c) => `<path d="M16 -3 L25 11 L7 11 Z" fill="${c}" ${stroke}/><path d="M12 6 l1.2 1.2 M20 6 l-1.2 1.2 M16 2 v2" stroke="#f8e060" stroke-width="1.4"/>`,
  };
  function hero(type, color, size = 34, exhausted = false) {
    const top = (HERO_TOP[type] || HERO_TOP.warrior)(color);
    return `<svg class="hp ${exhausted ? 'ex' : ''}" viewBox="0 -3 32 36" width="${size}" height="${size}"><ellipse cx="16" cy="31.5" rx="10" ry="2" fill="#000" opacity=".35"/>
      <path d="M7 31 Q7 18 16 18 Q25 18 25 31 Z" fill="${color}" ${stroke}/><path d="M11 22 h10" stroke="#fff" stroke-width="1" opacity=".5"/>
      <circle cx="16" cy="13" r="6.5" fill="#f4d0a8" ${stroke}/>${top}<circle cx="13.6" cy="13.6" r="1" fill="#1a1020"/><circle cx="18.4" cy="13.6" r="1" fill="#1a1020"/><path d="M14 16.5 Q16 17.6 18 16.5" fill="none" stroke="#1a1020" stroke-width=".9"/></svg>`;
  }

  // 토큰
  const chest = (s = 22) => `<svg viewBox="0 0 24 20" width="${s}" height="${s * 0.83}"><rect x="2" y="7" width="20" height="11" rx="1.5" fill="#b8742a" ${stroke}/><path d="M2 9 Q2 2 12 2 Q22 2 22 9 Z" fill="#d8943a" ${stroke}/><rect x="2" y="8" width="20" height="2.4" fill="#e8c840" ${stroke}/><rect x="10" y="9" width="4" height="5" rx="1" fill="#f8e060" ${stroke}/></svg>`;
  const item = (s = 18) => `<svg viewBox="0 0 20 20" width="${s}" height="${s}"><path d="M14 2 L18 2 L18 6 L8 16 L4 12 Z" fill="#c8d0e0" ${stroke}/><path d="M3 13 L7 17 M2 18 L5 15" stroke="#7a4a1a" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  const potion = (s = 18) => `<svg viewBox="0 0 20 20" width="${s}" height="${s}"><path d="M8 2 h4 v4 Q17 8 16 13 Q15 19 10 19 Q5 19 4 13 Q3 8 8 6 Z" fill="#c84ad8" ${stroke}/><path d="M5 12 Q10 10 15 12 Q15 18 10 18 Q5 18 5 12 Z" fill="#e87af0"/><rect x="7.5" y="1" width="5" height="2.4" rx="1" fill="#8a5a2a" ${stroke}/></svg>`;
  const bone = (s = 18) => `<svg viewBox="0 0 20 12" width="${s}" height="${s * 0.6}"><path d="M4 3 Q2 0 1 3 Q0 6 3 6 Q0 7 2 9 Q4 11 5 8 L15 8 Q16 11 18 9 Q20 7 17 6 Q20 6 19 3 Q18 0 16 3 L5 3 Z" fill="#f0e8d0" ${stroke}/></svg>`;
  const trap = (s = 20) => `<svg viewBox="0 0 22 16" width="${s}" height="${s * 0.73}"><ellipse cx="11" cy="12" rx="10" ry="3.4" fill="#5a5a6a" ${stroke}/><path d="M3 12 L5 4 L7 12 M8 12 L10 2 L12 12 M13 12 L15 3 L17 12 M16 12 L18 5 L19 12" fill="#d8dce8" ${stroke}/></svg>`;

  // 방 장식 (큰 그림, 바닥에 희미하게)
  const ROOM_DECO = {
    entrance: `<path d="M20 90 L20 40 Q50 8 80 40 L80 90" fill="#0a0612" stroke="#7a6a9a" stroke-width="5"/><path d="M30 90 L30 46 Q50 22 70 46 L70 90" fill="#2a1a4a" opacity=".8"/><circle cx="50" cy="60" r="14" fill="#8a5ae8" opacity=".55"/>`,
    treasure: `<g transform="translate(18 34) scale(2.7)">${''}</g><rect x="22" y="52" width="56" height="30" rx="4" fill="#9a5a1a" stroke="#3a2010" stroke-width="3"/><path d="M22 58 Q22 36 50 36 Q78 36 78 58 Z" fill="#c8843a" stroke="#3a2010" stroke-width="3"/><rect x="44" y="54" width="12" height="12" rx="2" fill="#f0d040" stroke="#3a2010" stroke-width="2"/><circle cx="30" cy="86" r="5" fill="#f0c840"/><circle cx="70" cy="86" r="5" fill="#f0c840"/>`,
    vault: `<path d="M14 84 Q20 50 50 46 Q80 50 86 84 Z" fill="#e8b830" stroke="#7a5a10" stroke-width="3"/><circle cx="34" cy="70" r="6" fill="#f8d850" stroke="#7a5a10" stroke-width="2"/><circle cx="56" cy="62" r="6" fill="#f8d850" stroke="#7a5a10" stroke-width="2"/><circle cx="66" cy="74" r="6" fill="#f8d850" stroke="#7a5a10" stroke-width="2"/><path d="M40 40 L50 20 L60 40 Z" fill="#5ad8e8" stroke="#1a5a7a" stroke-width="2"/><path d="M28 30 l4 -10 l4 10 M64 30 l4 -10 l4 10" fill="#e84a8a" stroke="#7a1a3a" stroke-width="2"/>`,
    forge: `<path d="M24 70 L76 70 L70 60 L30 60 Z" fill="#5a5a6a" stroke="#1a1020" stroke-width="3"/><path d="M34 70 L38 86 L62 86 L66 70" fill="#3a3a4a" stroke="#1a1020" stroke-width="3"/><path d="M66 30 L80 44 L62 60 L50 48 Z" fill="#8a6a4a" stroke="#1a1020" stroke-width="3"/><circle cx="30" cy="40" r="10" fill="#ff7a2a" opacity=".7"/><circle cx="30" cy="40" r="5" fill="#ffd84a"/>`,
    lab: `<path d="M38 20 h24 v18 Q80 48 76 68 Q72 88 50 88 Q28 88 24 68 Q20 48 38 38 Z" fill="#5a2a7a" stroke="#1a1020" stroke-width="3"/><path d="M27 62 Q50 54 73 62 Q72 86 50 86 Q28 86 27 62 Z" fill="#c84ad8"/><circle cx="44" cy="70" r="4" fill="#f0a8f8"/><circle cx="56" cy="64" r="3" fill="#f0a8f8"/><circle cx="54" cy="12" r="4" fill="#c84ad8" opacity=".6"/>`,
    trapshop: `<ellipse cx="50" cy="76" rx="36" ry="10" fill="#4a4a5a" stroke="#1a1020" stroke-width="3"/><path d="M20 76 L26 40 L32 76 M36 76 L44 30 L50 76 M54 76 L60 34 L66 76 M68 76 L74 44 L80 76" fill="#c8ccd8" stroke="#1a1020" stroke-width="3"/>`,
    lair: `<ellipse cx="50" cy="74" rx="36" ry="14" fill="#6a4a2a" stroke="#1a1020" stroke-width="3"/><ellipse cx="50" cy="70" rx="28" ry="9" fill="#8a6a3a"/><ellipse cx="38" cy="62" rx="8" ry="11" fill="#e8e0c8" stroke="#1a1020" stroke-width="2.4"/><ellipse cx="56" cy="58" rx="9" ry="12" fill="#c8e8a8" stroke="#1a1020" stroke-width="2.4"/><ellipse cx="66" cy="66" rx="6" ry="8" fill="#e8c0c0" stroke="#1a1020" stroke-width="2"/>`,
    altar: `<rect x="22" y="56" width="56" height="28" rx="3" fill="#4a3a5a" stroke="#1a1020" stroke-width="3"/><rect x="16" y="50" width="68" height="10" rx="2" fill="#6a5a7a" stroke="#1a1020" stroke-width="3"/><path d="M36 50 L36 36 M64 50 L64 36" stroke="#e8d8a8" stroke-width="5"/><circle cx="36" cy="32" r="5" fill="#ff8a2a" opacity=".85"/><circle cx="64" cy="32" r="5" fill="#ff8a2a" opacity=".85"/><path d="M42 72 L50 62 L58 72 L50 80 Z" fill="#c84ad8" stroke="#1a1020" stroke-width="2"/>`,
    crypt: `<path d="M18 86 L22 46 Q34 38 46 46 L50 86 Z" fill="#5a5a6a" stroke="#1a1020" stroke-width="3"/><path d="M54 86 L58 50 Q70 42 82 50 L82 86 Z" fill="#4a4a5a" stroke="#1a1020" stroke-width="3"/><path d="M34 54 v20 M27 62 h14 M68 58 v18 M62 65 h12" stroke="#1a1020" stroke-width="3"/>`,
  };
  const roomDeco = (type) => `<svg class="deco" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">${ROOM_DECO[type] || ''}</svg>`;

  return { monster, hero, chest, item, potion, bone, trap, roomDeco };
})();
window.Art = Art;
