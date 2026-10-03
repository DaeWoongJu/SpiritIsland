'use strict';
/* 정령섬 온라인 — 규칙 설명 영상: 장면마다 움직이는 그림 + 한국어 음성 내레이션(브라우저 음성 합성) + 자막 */

const RuleVideo = (() => {
  const TC = { M: '#9aa0a7', J: '#3f9a46', S: '#e2c681', W: '#5aaba3' };
  const TN = { M: '산', J: '정글', S: '사막', W: '습지' };
  const TOK = {
    explorer: ['#f1e7cc', '#47381f'], town: ['#dcae62', '#3a270b'], city: ['#c3c6cd', '#262a31'],
    dahan: ['#7e5130', '#f4dcb6'], blight: ['#2a1014', '#e8604f'],
  };

  // ───── 그림 조각 ─────
  const A = (cls, delay = 0, inner = '', extra = '') => {
    const m = /style="([^"]*)"/.exec(extra); // style 속성이 두 번 붙지 않도록 합침
    const st = `animation-delay:${delay}s;${m ? m[1] : ''}`;
    return `<g class="va ${cls}" style="${st}" ${m ? extra.replace(m[0], '') : extra}>${inner}</g>`;
  };
  const at = (x, y, inner) => `<g transform="translate(${x} ${y})">${inner}</g>`;
  const tok = (x, y, kind, cls = 'v-pop', delay = 0, r = 22) => {
    const [bg, fg] = TOK[kind];
    return at(x, y, A(cls, delay, `<circle r="${r}" fill="${bg}" stroke="#0008" stroke-width="2.5"/><use href="#pc-${kind}" x="${-r * 0.65}" y="${-r * 0.65}" width="${r * 1.3}" height="${r * 1.3}" style="color:${fg}"/>`));
  };
  const orb = (x, y, cls = 'v-pop', delay = 0, color = '#9b6a3c', r = 18) => at(x, y, A(cls, delay, `<circle r="${r + 10}" fill="${color}" opacity=".25"/><circle r="${r}" fill="${color}" stroke="#fff8" stroke-width="2"/><circle cx="${-r * 0.3}" cy="${-r * 0.35}" r="${r * 0.3}" fill="#fff" opacity=".6"/>`));
  const text = (x, y, s, size = 26, cls = 'v-fade', delay = 0, fill = '#f3e6c4', anchor = 'middle', weight = 700) => A(cls, delay, `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}" style="paint-order:stroke;stroke:#000a;stroke-width:4px">${s}</text>`);
  const land = (pts, t, label, cls = 'v-fade', delay = 0, extra = '') => A(cls, delay, `<polygon points="${pts}" fill="${TC[t]}" stroke="#16120a" stroke-width="3" ${extra}/><text x="${centroid(pts)[0]}" y="${centroid(pts)[1] - 46}" text-anchor="middle" font-size="18" font-weight="800" fill="#1a1408">${label}</text>`);
  const centroid = (pts) => { const p = pts.split(' ').map((q) => q.split(',').map(Number)); return [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length]; };
  const invCard = (x, y, t, cls = 'v-pop', delay = 0, extra = '') => at(x, y, A(cls, delay, `<rect x="-55" y="-75" width="110" height="150" rx="12" fill="${t ? TC[t] : 'url(#vback)'}" stroke="#1a1408" stroke-width="3"/>${t ? `<use href="#tr-${t}" x="-30" y="-50" width="60" height="60" style="color:#1a1408"/><text y="45" text-anchor="middle" font-size="24" font-weight="800" fill="#1a1408">${TN[t]}</text>` : '<text y="12" text-anchor="middle" font-size="44" font-weight="800" fill="#d8c8ff">?</text>'}`, extra));
  const slot = (x, y, label, color) => at(x, y, `<rect x="-75" y="-105" width="150" height="210" rx="14" fill="#0b1110" stroke="${color}" stroke-width="3" stroke-dasharray="8 5"/><text y="135" text-anchor="middle" font-size="24" font-weight="800" fill="${color}">${label}</text>`);
  const arrow = (x1, y1, x2, y2, cls = 'v-fade', delay = 0, color = '#d9b45a') => A(cls, delay, `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="5" marker-end="url(#varrow)"/>`);
  const box = (x, y, w, h, title, sub, color, cls = 'v-pop', delay = 0) => at(x, y, A(cls, delay, `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="14" fill="#0b1110" stroke="${color}" stroke-width="3"/><text y="${sub ? -6 : 8}" text-anchor="middle" font-size="22" font-weight="800" fill="#fff">${title}</text>${sub ? `<text y="22" text-anchor="middle" font-size="15" fill="#c9c3b1">${sub}</text>` : ''}`));
  const dmg = (x, y, s, delay = 0, color = '#ff6a5a') => at(x, y, A('v-float', delay, `<text text-anchor="middle" font-size="30" font-weight="900" fill="${color}" style="paint-order:stroke;stroke:#000;stroke-width:5px">${s}</text>`));
  const burst = (x, y, delay = 0, color = '#ffb43a') => at(x, y, A('v-burst', delay, `<circle r="40" fill="${color}" opacity=".7"/><circle r="24" fill="#fff6d0"/>`));
  const check = (x, y, ok, delay = 0) => at(x, y, A('v-pop', delay, ok ? '<circle r="18" fill="#3f8f5c"/><path d="M-8 0l6 7 11-13" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>' : '<circle r="18" fill="#a8402c"/><path d="M-7 -7l14 14M7 -7l-14 14" stroke="#fff" stroke-width="5" stroke-linecap="round"/>'));
  const sea = () => `<rect width="960" height="540" fill="url(#vsea)"/>`;
  const sky = (c1 = '#16302a', c2 = '#0a100f') => `<rect width="960" height="540" fill="url(#vsky)"/><defs><linearGradient id="vsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>`;
  const ship = (x, y, delay) => at(x, y, A('v-sail', delay, '<path d="M-40 0h80l-14 20h-52z" fill="#5a3a1e"/><path d="M0 -60v58" stroke="#3a2414" stroke-width="4"/><path d="M2 -58l34 30h-34z" fill="#f3ead6"/><path d="M-2 -50l-26 24h26z" fill="#e8dcc0"/>'));
  const pcard = (x, y, cls = 'v-pop', delay = 0, scale = 1, extra = '') => at(x, y, A(cls, delay, `<g transform="scale(${scale})"><rect x="-110" y="-150" width="220" height="300" rx="16" fill="#f1e5c6" stroke="#3f8f5c" stroke-width="6"/>
    <rect x="-104" y="-144" width="208" height="52" rx="10" fill="#c8562a"/><circle cx="-80" cy="-118" r="20" fill="#e2b54b" stroke="#6a4a10" stroke-width="2"/><text x="-80" y="-109" text-anchor="middle" font-size="24" font-weight="900" fill="#2a1d04">1</text>
    <text x="4" y="-110" text-anchor="middle" font-size="22" font-weight="800" fill="#fff">돌발 홍수</text><rect x="58" y="-128" width="40" height="22" rx="6" fill="#0004"/><text x="78" y="-112" text-anchor="middle" font-size="14" font-weight="800" fill="#fff">빠름</text>
    <use href="#el-sun" x="-96" y="-82" width="30" height="30"/><use href="#el-water" x="-62" y="-82" width="30" height="30"/>
    <line x1="-96" y1="-40" x2="96" y2="-40" stroke="#a8905d"/><text x="0" y="-18" text-anchor="middle" font-size="14" fill="#6a5a3a">존재에서 사거리 1 · 아무 지역</text><line x1="-96" y1="-6" x2="96" y2="-6" stroke="#a8905d"/>
    <text x="0" y="30" text-anchor="middle" font-size="19" fill="#2a2316">피해 1.</text><text x="0" y="58" text-anchor="middle" font-size="19" fill="#2a2316">해안 지역이면 피해 +1.</text></g>`, extra));
  const callout = (x1, y1, x2, y2, label, delay, color = '#ffe08a') => `${A('v-fade', delay, `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="3"/><circle cx="${x1}" cy="${y1}" r="6" fill="${color}"/>`)}${text(x2 + (x2 > x1 ? 10 : -10), y2 + 8, label, 22, 'v-fade', delay, color, x2 > x1 ? 'start' : 'end')}`;

  // 작은 섬 (탐험/건설/약탈 장면용): A=해안 사막, B=내륙 사막(멀리), C=내륙 사막(마을 옆), D=해안 정글(마을)
  const mini = { A: '120,120 380,90 400,280 140,320', B: '520,60 840,90 860,250 560,240', C: '400,280 560,240 860,250 840,480 420,480', D: '140,320 400,280 420,480 110,480' };
  const miniIsland = (labels = true, cls = 'v-fade') => `${sea()}<rect x="0" y="0" width="95" height="540" fill="#1d5f86" opacity=".6"/><text x="48" y="280" text-anchor="middle" font-size="22" fill="#bfe6ff" transform="rotate(-90 48 280)">바다</text>
    ${land(mini.A, 'S', labels ? 'A 사막 · 해안' : '', cls)}${land(mini.B, 'S', labels ? 'B 사막 · 내륙' : '', cls)}${land(mini.C, 'S', labels ? 'C 사막 · 마을 옆' : '', cls)}${land(mini.D, 'J', labels ? 'D 정글 · 해안' : '', cls)}`;

  // ───── 장면 ─────
  const SCENES = [
    { title: '정령섬은 어떤 게임?', beats: [
      { say: '정령섬은 섬의 정령이 되어, 바다 건너온 침략자들을 몰아내는 협력 게임입니다.',
        draw: () => `${sea()}<ellipse cx="560" cy="300" rx="330" ry="190" fill="#3f8a3a" stroke="#d9c27a" stroke-width="10"/><ellipse cx="600" cy="260" rx="120" ry="70" fill="#8f949b"/>${orb(480, 300, 'v-pop', 0.3, '#56ccf2')}${orb(640, 340, 'v-pop', 0.6, '#f2c94c')}${orb(560, 220, 'v-pop', 0.9, '#9b51e0')}${text(480, 90, '당신은 섬의 정령입니다', 40, 'v-fade', 0.2)}` },
      { say: '침략자는 배를 타고 와서 탐험가로 섬에 들어오고, 마을과 도시를 지으며 땅을 망가뜨립니다.',
        draw: () => `${sea()}<ellipse cx="600" cy="300" rx="330" ry="190" fill="#3f8a3a" stroke="#d9c27a" stroke-width="10"/>${ship(160, 200, 0)}${ship(120, 360, 0.4)}${tok(320, 230, 'explorer', 'v-drop', 1.2)}${tok(340, 330, 'explorer', 'v-drop', 1.5)}${tok(470, 280, 'town', 'v-pop', 2.2)}${tok(560, 330, 'city', 'v-pop', 2.8)}` },
      { say: '탐험가, 마을, 도시가 침략자입니다. 원주민 다한은 우리 편이고, 황폐는 침략자가 망가뜨린 땅입니다.',
        draw: () => `${sky()}${tok(160, 200, 'explorer', 'v-pop', 0, 40)}${arrow(215, 200, 285, 200, 'v-fade', 0.4)}${tok(340, 200, 'town', 'v-pop', 0.5, 40)}${arrow(395, 200, 465, 200, 'v-fade', 0.9)}${tok(520, 200, 'city', 'v-pop', 1, 40)}
          ${text(340, 290, '침략자: 탐험가 → 마을 → 도시 (점점 커져요)', 26, 'v-fade', 1.2)}${tok(260, 410, 'dahan', 'v-pop', 1.8, 40)}${text(260, 490, '다한 = 우리 편', 26, 'v-fade', 2)}${tok(640, 410, 'blight', 'v-pop', 2.4, 40)}${text(640, 490, '황폐 = 망가진 땅', 26, 'v-fade', 2.6)}` },
      { say: '침략자를 겁주고 몰아내면 승리, 섬이 황폐로 뒤덮이면 패배입니다. 모두 함께 이기고 함께 집니다.',
        draw: () => `${sky()}${box(300, 270, 320, 160, '🎉 승리', '침략자를 몰아내기', '#3f8f5c', 'v-pop', 0.2)}${box(660, 270, 320, 160, '💀 패배', '섬이 황폐로 뒤덮임', '#a8402c', 'v-pop', 0.8)}${text(480, 450, '경쟁이 아니라 협력! 모두 같은 편입니다', 30, 'v-fade', 1.4)}` },
    ] },
    { title: '한 턴의 흐름', beats: [
      { say: '한 턴은 다섯 단계로 진행됩니다. 성장, 카드 내기, 빠른 권능, 침략자, 그리고 느린 권능입니다.',
        draw: () => `${sky()}${[['1. 성장', '정령 키우기', '#c99a3c'], ['2. 카드 내기', '에너지로 구매', '#c99a3c'], ['3. 빠른 권능', '침략자보다 먼저', '#c8562a'], ['4. 침략자', '하나씩 보여 줌', '#b8352a'], ['5. 느린 권능', '침략자 다음', '#2f63a6']].map(([a, b, c], i) => box(110 + i * 185, 250, 170, 120, a, b, c, 'v-pop', i * 0.5) + (i < 4 ? arrow(195 + i * 185, 250, 210 + i * 185, 250, 'v-fade', i * 0.5 + 0.3) : '')).join('')}` },
      { say: '빠른 권능은 침략자가 움직이기 전에, 느린 권능은 침략자가 움직인 뒤에 발동합니다. 그래서 약탈을 막으려면 빠른 권능이 중요해요.',
        draw: () => `${sky()}${box(240, 230, 220, 120, '⚡ 빠른 권능', '', '#c8562a', 'v-pop', 0)}${box(480, 230, 220, 120, '👹 침략자', '약탈·건설·탐험', '#b8352a', 'v-pop', 0.4)}${box(720, 230, 220, 120, '🐢 느린 권능', '', '#2f63a6', 'v-pop', 0.8)}${arrow(350, 230, 368, 230, 'v-fade', 0.3)}${arrow(590, 230, 608, 230, 'v-fade', 0.7)}
          ${text(240, 350, '막을 수 있어요!', 26, 'v-pop', 1.3, '#ffb48a')}${text(720, 350, '이미 지나간 뒤', 26, 'v-pop', 1.6, '#9ec3ff')}` },
      { say: '정령들은 모두 동시에 자기 할 일을 하고, 침략자 단계는 자동으로 진행됩니다.',
        draw: () => `${sky()}${orb(330, 250, 'v-pop', 0, '#56ccf2', 40)}${orb(480, 250, 'v-pop', 0.3, '#f2c94c', 40)}${orb(630, 250, 'v-pop', 0.6, '#9b51e0', 40)}${text(480, 380, '모두 동시에 진행!', 34, 'v-fade', 1)}` },
    ] },
    { title: '침략자는 언제 오나요? — 진행표', beats: [
      { say: '침략자는 침략자 카드에 적힌 지형에서만 움직입니다. 카드는 진행표의 탐험, 건설, 약탈 칸을 차례로 지나갑니다.',
        draw: () => `${sky()}${slot(300, 250, '🧭 탐험', '#cfe3f0')}${slot(500, 250, '🏠 건설', '#ffb547')}${slot(700, 250, '⚔ 약탈', '#ff6a5a')}${invCard(120, 250, null, 'v-pop', 0.3)}${text(120, 385, '침략자 덱', 22, 'v-fade', 0.3)}${arrow(390, 250, 405, 250)}${arrow(590, 250, 605, 250)}${text(480, 70, '카드는 매 턴 → 방향으로 한 칸씩 이동해요', 30, 'v-fade', 0.8)}` },
      { say: '1턴. 덱에서 새 카드가 뒤집혀 탐험 칸에 놓입니다. 이번 카드는 사막입니다. 사막 지역에 탐험가가 옵니다.',
        draw: () => `${sky()}${slot(300, 250, '🧭 탐험', '#cfe3f0')}${slot(500, 250, '🏠 건설', '#ffb547')}${slot(700, 250, '⚔ 약탈', '#ff6a5a')}${invCard(120, 250, null)}${invCard(300, 250, 'S', 'v-fly', 0.4, 'style="--dx:-180px;--dy:0px"')}${text(480, 70, '1턴', 44, 'v-pop', 0)}` },
      { say: '2턴. 사막 카드는 건설 칸으로 한 칸 이동하고, 새 카드 정글이 탐험 칸에 들어옵니다. 이제 사막에는 마을이 지어집니다.',
        draw: () => `${sky()}${slot(300, 250, '🧭 탐험', '#cfe3f0')}${slot(500, 250, '🏠 건설', '#ffb547')}${slot(700, 250, '⚔ 약탈', '#ff6a5a')}${invCard(120, 250, null)}${invCard(500, 250, 'S', 'v-fly', 0.3, 'style="--dx:-200px;--dy:0px"')}${invCard(300, 250, 'J', 'v-fly', 1.2, 'style="--dx:-180px;--dy:0px"')}${text(480, 70, '2턴', 44, 'v-pop', 0)}` },
      { say: '3턴. 사막 카드는 약탈 칸으로 이동합니다. 같은 지형이 탐험 다음 턴에는 건설, 그다음 턴에는 약탈을 당하는 거예요.',
        draw: () => `${sky()}${slot(300, 250, '🧭 탐험', '#cfe3f0')}${slot(500, 250, '🏠 건설', '#ffb547')}${slot(700, 250, '⚔ 약탈', '#ff6a5a')}${invCard(120, 250, null)}${invCard(700, 250, 'S', 'v-fly', 0.3, 'style="--dx:-200px;--dy:0px"')}${invCard(500, 250, 'J', 'v-fly', 0.9, 'style="--dx:-200px;--dy:0px"')}${invCard(300, 250, 'M', 'v-fly', 1.5, 'style="--dx:-180px;--dy:0px"')}${text(480, 70, '3턴', 44, 'v-pop', 0)}${A('v-blink', 2.2, '<rect x="620" y="140" width="160" height="220" rx="16" fill="none" stroke="#ff3b30" stroke-width="6"/>')}` },
      { say: '그래서 진행표를 보면 다음에 어디가 위험한지 미리 알 수 있습니다. 게임 화면 위쪽의 진행표와, 지도의 빨간 약탈 예정 표시를 꼭 확인하세요.',
        draw: () => `${sky()}${box(480, 200, 640, 120, '👀 진행표 = 미래 예보', '건설 칸의 지형 → 다음 턴 약탈 당함', '#d9b45a', 'v-pop', 0)}${A('v-pop', 0.8, '<rect x="300" y="320" width="160" height="40" rx="20" fill="#ff6a5a"/><text x="380" y="347" text-anchor="middle" font-size="20" font-weight="800" fill="#1a0a04">⚔ 약탈 예정</text><rect x="500" y="320" width="160" height="40" rx="20" fill="#ffb547"/><text x="580" y="347" text-anchor="middle" font-size="20" font-weight="800" fill="#1a0a04">🏠 건설 예정</text>')}${text(480, 430, '지도에 이렇게 표시돼요', 26, 'v-fade', 1.2)}` },
    ] },
    { title: '탐험 — 침략자는 어디로 오나요?', beats: [
      { say: '탐험 카드가 사막이면 사막 지역에 탐험가가 옵니다. 하지만 모든 사막에 오는 것은 아닙니다.',
        draw: () => `${miniIsland()}${tok(240, 410, 'town', 'v-pop', 0.2)}${invCard(880, 400, 'S', 'v-pop', 0.5)}${text(880, 300, '탐험!', 30, 'v-fade', 0.5)}` },
      { say: '바다와 닿은 해안 지역, 또는 마을이나 도시가 있거나 그 바로 옆인 지역에만 탐험가가 도착합니다. 섬 깊숙한 곳은 안전해요.',
        draw: () => `${miniIsland(true, '')}${tok(240, 410, 'town', '')}${invCard(880, 400, 'S', '')}
          ${tok(260, 210, 'explorer', 'v-drop', 0.3)}${check(320, 160, true, 0.5)}${text(260, 290, '해안이라서', 20, 'v-fade', 0.7, '#fff')}
          ${tok(640, 360, 'explorer', 'v-drop', 1.3)}${check(700, 310, true, 1.5)}${text(640, 440, '마을 옆이라서', 20, 'v-fade', 1.7, '#fff')}
          ${check(690, 160, false, 2.4)}${text(690, 210, '깊은 내륙 = 안전', 20, 'v-fade', 2.6, '#fff')}` },
    ] },
    { title: '건설 — 마을이 생겨요', beats: [
      { say: '다음 턴, 사막 카드가 건설 칸에 오면 침략자가 있는 사막 지역에 마을을 짓습니다. 침략자가 없는 지역에는 짓지 않아요.',
        draw: () => `${miniIsland()}${tok(240, 410, 'town', '')}${tok(230, 210, 'explorer', '')}${tok(620, 360, 'explorer', '')}${tok(290, 210, 'town', 'v-pop', 0.8)}${tok(680, 360, 'town', 'v-pop', 1.3)}${text(480, 40, '🏠 건설: 사막', 30, 'v-fade', 0)}${check(690, 160, false, 1.8)}` },
      { say: '이미 마을이 도시보다 많은 곳에는 도시를 짓습니다. 마을과 도시가 커질수록 약탈 피해도 커집니다.',
        draw: () => `${sky()}${tok(300, 250, 'town', 'v-pop', 0, 40)}${text(400, 260, '+', 50, 'v-fade', 0.4)}${tok(500, 250, 'city', 'v-pop', 0.8, 40)}${text(480, 380, '마을이 도시보다 많으면 → 도시 건설', 28, 'v-fade', 1.2)}` },
    ] },
    { title: '약탈 — 가장 위험한 순간', beats: [
      { say: '약탈 칸에 온 지형에서는 침략자가 땅을 공격합니다. 탐험가는 1, 마을은 2, 도시는 3의 피해를 줍니다.',
        draw: () => `${sky()}<polygon points="250,120 710,100 740,420 220,440" fill="${TC.S}" stroke="#16120a" stroke-width="4"/>${tok(380, 260, 'explorer', 'v-pop', 0, 34)}${tok(480, 260, 'town', 'v-pop', 0.2, 34)}${tok(600, 300, 'dahan', 'v-pop', 0.4, 34)}
          ${dmg(380, 205, '1', 1)}${dmg(480, 205, '2', 1.5)}${text(480, 480, '피해 합계 = 1 + 2 = 3', 32, 'v-pop', 2.2, '#ffb4a8')}` },
      { say: '피해가 2 이상이면 그 땅에 황폐가 생기고, 다한도 피해를 입습니다. 황폐가 너무 많아지면 패배해요.',
        draw: () => `${sky()}<polygon points="250,120 710,100 740,420 220,440" fill="${TC.S}" stroke="#16120a" stroke-width="4"/>${tok(380, 260, 'explorer', '', 0, 34)}${tok(480, 260, 'town', '', 0, 34)}${tok(600, 300, 'dahan', 'v-shake', 0.8, 34)}${tok(300, 360, 'blight', 'v-burn', 0.3, 38)}${dmg(600, 245, '-3', 0.8)}${text(480, 490, '황폐 발생! 다한도 다침', 30, 'v-fade', 1.3, '#ff8a7a')}` },
      { say: '살아남은 다한은 한 명당 피해 2로 반격합니다. 다한이 많은 곳은 침략자에게도 위험해요.',
        draw: () => `${sky()}<polygon points="250,120 710,100 740,420 220,440" fill="${TC.S}" stroke="#16120a" stroke-width="4"/>${tok(480, 260, 'town', '', 0, 34)}${tok(600, 300, 'dahan', '', 0, 34)}${tok(660, 240, 'dahan', 'v-pop', 0.2, 34)}${tok(300, 360, 'blight', '', 0, 38)}${arrow(560, 285, 520, 270, 'v-fade', 0.7, '#ff8a3a')}${tok(380, 260, 'explorer', 'v-die', 1.2, 34)}${burst(380, 260, 1.2)}${text(480, 490, '다한의 반격: 다한 1명당 피해 2', 30, 'v-fade', 1.5, '#ffd27a')}` },
      { say: '그러니 약탈 전에, 빠른 권능으로 침략자를 없애거나, 밀어내거나, 방어를 올려서 막으세요!',
        draw: () => `${sky()}${box(220, 260, 230, 130, '💥 피해', '침략자 파괴', '#c8562a', 'v-pop', 0)}${box(480, 260, 230, 130, '↗ 밀어내기', '옆 지역으로 쫓아냄', '#3f7fa8', 'v-pop', 0.5)}${box(740, 260, 230, 130, '🛡 방어', '약탈 피해 감소', '#3f8f5c', 'v-pop', 1)}${text(480, 430, '약탈 전에 = 빠른 권능으로!', 32, 'v-fade', 1.5, '#ffb48a')}` },
    ] },
    { title: '전투 계산 — 공격력과 체력', beats: [
      { say: '모든 조각에는 체력과 공격력이 있습니다. 탐험가는 체력 1에 공격력 1, 마을은 체력 2에 공격력 2, 도시는 체력 3에 공격력 3입니다.',
        draw: () => `${sky()}${text(480, 70, '체력 = 이만큼 맞으면 쓰러짐 · 공격력 = 약탈 때 주는 피해', 26, 'v-fade', 0)}
          ${tok(220, 230, 'explorer', 'v-pop', 0.3, 46)}${text(220, 320, '탐험가', 28, 'v-fade', 0.4)}${text(220, 365, '체력1 · 공격1', 32, 'v-pop', 0.6, '#ffe08a')}
          ${tok(480, 230, 'town', 'v-pop', 1.2, 46)}${text(480, 320, '마을', 28, 'v-fade', 1.3)}${text(480, 365, '체력2 · 공격2', 32, 'v-pop', 1.5, '#ffe08a')}
          ${tok(740, 230, 'city', 'v-pop', 2.1, 46)}${text(740, 320, '도시', 28, 'v-fade', 2.2)}${text(740, 365, '체력3 · 공격3', 32, 'v-pop', 2.4, '#ffe08a')}
          ${text(480, 470, '마을 파괴 = 공포 +1 · 도시 파괴 = 공포 +2', 24, 'v-fade', 3, '#d6b6ff')}` },
      { say: '원주민 다한은 우리 편입니다. 다한 한 명은 체력 2이고, 반격할 때 공격력 2입니다.',
        draw: () => `${sky()}${tok(360, 250, 'dahan', 'v-pop', 0.2, 60)}${text(360, 370, '다한 (우리 편)', 30, 'v-fade', 0.4)}${text(360, 420, '체력2 · 반격2', 34, 'v-pop', 0.7, '#ffe08a')}
          ${box(680, 250, 340, 170, '다한은 스스로 공격하지 않아요', '약탈을 당했을 때만 반격합니다', '#8a6a3a', 'v-pop', 1.3)}` },
      { say: '예를 들어 볼게요. 이 땅에 탐험가 1명과 마을 1개, 다한 2명이 있습니다. 약탈이 일어나면 침략자 공격력을 모두 더합니다. 1 더하기 2, 피해 3입니다.',
        draw: () => `${sky()}<polygon points="200,110 760,90 790,400 170,420" fill="${TC.S}" stroke="#16120a" stroke-width="4"/>${tok(330, 230, 'explorer', 'v-pop', 0.1, 36)}${tok(450, 230, 'town', 'v-pop', 0.3, 36)}${tok(600, 280, 'dahan', 'v-pop', 0.5, 36)}${tok(680, 230, 'dahan', 'v-pop', 0.6, 36)}
          ${dmg(330, 175, '공격 1', 1.2, '#ffb4a8')}${dmg(450, 175, '공격 2', 1.8, '#ffb4a8')}${text(480, 480, '공격력 합계: 1 + 2 = 3', 36, 'v-pop', 2.6, '#ff9a8a')}` },
      { say: '방어가 없다면 땅에 피해 3. 2 이상이므로 황폐가 생깁니다. 그리고 다한도 같은 피해 3을 받습니다. 다한은 체력 2라서, 한 명은 쓰러지고 한 명은 살아남아요.',
        draw: () => `${sky()}<polygon points="200,110 760,90 790,400 170,420" fill="${TC.S}" stroke="#16120a" stroke-width="4"/>${tok(330, 230, 'explorer', '', 0, 36)}${tok(450, 230, 'town', '', 0, 36)}${tok(260, 340, 'blight', 'v-burn', 0.3, 40)}${text(260, 400, '피해 3 ≥ 2 → 황폐', 22, 'v-fade', 0.6, '#ff8a7a')}
          ${tok(600, 280, 'dahan', 'v-die', 1.6, 36)}${tok(680, 230, 'dahan', 'v-shake', 1.6, 36)}${dmg(600, 225, '−2 쓰러짐', 1.6)}${dmg(680, 175, '−1 생존', 2)}
          ${text(480, 480, '피해 3 → 다한(❤2) 1명 쓰러짐, 1명은 ❤1 남음', 28, 'v-fade', 2.6, '#ffd0c0')}` },
      { say: '살아남은 다한은 한 명당 2씩 반격합니다. 반격 피해 2로 체력 2인 마을이 무너집니다. 마을을 부쉈으니 공포도 1 얻어요.',
        draw: () => `${sky()}<polygon points="200,110 760,90 790,400 170,420" fill="${TC.S}" stroke="#16120a" stroke-width="4"/>${tok(330, 230, 'explorer', '', 0, 36)}${tok(260, 340, 'blight', '', 0, 40)}${tok(680, 230, 'dahan', '', 0, 36)}
          ${arrow(640, 230, 500, 230, 'v-fade', 0.4, '#ffd27a')}${dmg(570, 205, '반격 2', 0.6, '#ffd27a')}${tok(450, 230, 'town', 'v-die', 1.2, 36)}${burst(450, 230, 1.2)}
          ${text(480, 470, '반격: 다한 1명 × 2 = 2 → 마을(❤2) 파괴! 공포 +1', 28, 'v-pop', 1.8, '#ffe08a')}` },
      { say: '만약 약탈 전에 방어 3을 걸었다면? 피해는 3 빼기 3, 0이 됩니다. 황폐도 없고 다한도 무사해서, 두 명이 함께 4만큼 반격해 마을과 탐험가를 모두 쓰러뜨립니다!',
        draw: () => `${sky()}<polygon points="200,110 760,90 790,400 170,420" fill="${TC.S}" stroke="#3f8f5c" stroke-width="8"/>${A('v-pop', 0.2, '<g transform="translate(240 170)"><circle r="34" fill="#3f8f5c"/><text y="11" text-anchor="middle" font-size="30" font-weight="900" fill="#fff">🛡3</text></g>')}
          ${tok(600, 280, 'dahan', '', 0, 36)}${tok(680, 230, 'dahan', '', 0, 36)}${text(480, 70, '공격 3 − 방어 3 = 피해 0', 34, 'v-pop', 0.6, '#9fe0b0')}
          ${tok(330, 230, 'explorer', 'v-die', 2, 36)}${tok(450, 230, 'town', 'v-die', 2, 36)}${burst(330, 230, 2)}${burst(450, 230, 2)}${dmg(640, 190, '반격 2 + 2 = 4', 1.4, '#ffd27a')}
          ${text(480, 480, '황폐 없음 · 다한 무사 · 침략자 전멸!', 32, 'v-pop', 2.6, '#9fe0b0')}` },
      { say: '게임 중에는 지도에서 약탈 예정 지역에 마우스를 올리면 이 계산을 미리 보여 주고, 약탈할 때도 지역마다 계산 과정을 보여 줍니다.',
        draw: () => `${sky()}${box(480, 200, 620, 200, '⚔ 약탈 피해 3 → 황폐!', '지도 위 표시 · 마우스를 올리면 자세한 계산', '#ff6a5a', 'v-pop', 0.2)}${text(480, 400, '아래 범례의 [⚔ 전투 계산법] 버튼으로 언제든 다시 보기', 26, 'v-fade', 1, '#ffe08a')}` },
    ] },
    { title: '성장과 존재', beats: [
      { say: '매 턴 처음에 성장 옵션을 하나 고릅니다. 존재 추가, 카드 회수, 새 카드, 에너지 획득을 정령마다 다르게 조합한 옵션이 있어요.',
        draw: () => `${sky()}${box(220, 260, 230, 150, '1', '카드 회수 + 새 카드', '#3b4a46', 'v-pop', 0)}${box(480, 260, 230, 150, '2', '존재 추가 ×2', '#d9b45a', 'v-pop', 0.4)}${box(740, 260, 230, 150, '3', '존재 추가 + 에너지', '#3b4a46', 'v-pop', 0.8)}${text(480, 440, '셋 중 하나를 골라요', 30, 'v-fade', 1.2)}` },
      { say: '존재를 섬에 놓으면 트랙에서 꺼낸 자리의 숫자가 드러나, 매 턴 받는 에너지나 낼 수 있는 카드 수가 늘어납니다.',
        draw: () => `${sky()}${text(160, 168, '에너지', 24, '', 0, '#f3d98b', 'end')}${[1, 2, 3, 4].map((v, i) => at(220 + i * 80, 160, `<circle r="30" fill="#0b1110" stroke="#d9b45a" stroke-width="3"/><text y="10" text-anchor="middle" font-size="28" font-weight="800" fill="#f3d98b">${v}</text>`)).join('')}
          ${orb(380, 160, '', 0, '#9b6a3c', 24)}${orb(460, 160, '', 0, '#9b6a3c', 24)}${orb(540, 160, '', 0, '#9b6a3c', 24)}
          ${orb(380, 160, 'v-fly-out', 0.6, '#9b6a3c', 24)}<polygon points="560,280 860,260 880,470 540,480" fill="${TC.J}" stroke="#16120a" stroke-width="4"/>${orb(700, 380, 'v-drop', 1.4, '#9b6a3c', 24)}${text(480, 520, '구슬이 빠진 자리 숫자 = 이제 턴당 에너지 3!', 28, 'v-fade', 2, '#f3d98b')}` },
      { say: '존재는 권능을 쓸 수 있는 기준점입니다. 같은 지역에 존재가 두 개 이상이면 성지가 되어, 더 강한 권능을 쓸 수 있습니다.',
        draw: () => `${sky()}<polygon points="300,150 660,130 690,420 270,430" fill="${TC.M}" stroke="#16120a" stroke-width="4"/>${orb(440, 290, 'v-pop', 0)}${orb(520, 290, 'v-pop', 0.6)}${A('v-pop', 1.2, '<circle cx="480" cy="290" r="90" fill="none" stroke="#ffd86b" stroke-width="5" stroke-dasharray="10 6"/>')}${text(480, 470, '존재 2개 = 성지', 32, 'v-fade', 1.4, '#ffd86b')}` },
    ] },
    { title: '권능 카드 사용법', beats: [
      { say: '권능 카드 읽는 법입니다. 왼쪽 위 숫자는 필요한 에너지, 빠름과 느림은 발동 시점, 가운데 줄은 쓸 수 있는 거리, 아래는 효과입니다.',
        draw: () => `${sky()}${pcard(480, 280, 'v-pop', 0, 1.2)}${callout(388, 138, 220, 90, '필요한 에너지', 0.8)}${callout(574, 145, 660, 60, '빠름 = 침략자보다 먼저', 1.6)}${callout(370, 190, 200, 230, '원소', 2.4)}${callout(560, 252, 680, 250, '쓸 수 있는 곳 (사거리)', 3.2)}${callout(560, 330, 690, 400, '효과', 4)}` },
      { say: '카드 내기 단계에서 에너지를 내고 카드를 고릅니다. 한 턴에 낼 수 있는 장수는 카드 수 트랙의 숫자만큼입니다.',
        draw: () => `${sky()}${pcard(300, 280, 'v-pop', 0, 0.9)}${A('v-pop', 0.6, '<circle cx="560" cy="200" r="34" fill="#e2b54b" stroke="#6a4a10" stroke-width="3"/><text x="560" y="212" text-anchor="middle" font-size="32" font-weight="900" fill="#2a1d04">⚡1</text>')}${arrow(520, 220, 420, 250, 'v-fade', 1)}${text(640, 330, '에너지 1을 내면', 28, 'v-fade', 1.2, '#f3d98b', 'start')}${text(640, 370, '이 카드를 낼 수 있어요', 28, 'v-fade', 1.4, '#f3d98b', 'start')}` },
      { say: '권능 단계에서 낸 카드를 누르고, 빛나는 지역 중 대상을 고르면 효과가 일어납니다. 사거리 1은 내 존재가 있는 지역과 그 바로 옆 지역이에요.',
        draw: () => `${miniIsland(false, '')}${A('v-blink', 0.3, `<polygon points="${mini.A}" fill="#fff3b0" opacity=".35"/><polygon points="${mini.D}" fill="#fff3b0" opacity=".35"/><polygon points="${mini.C}" fill="#fff3b0" opacity=".35"/>`)}${orb(260, 420, '')}${tok(230, 200, 'explorer', '')}${tok(300, 200, 'town', '')}
          ${text(260, 500, '내 존재', 22, '', 0, '#fff')}${text(700, 140, '빛나는 곳 = 사거리 1 안', 24, 'v-fade', 0.6, '#fff3b0')}${pcard(260, 210, 'v-fly', 1.4, 0.35, 'style="--dx:500px;--dy:250px"')}${burst(265, 200, 2.4)}${tok(230, 200, 'explorer', 'v-die', 2.4)}${dmg(265, 150, '피해 2!', 2.5)}` },
      { say: '마을이나 도시를 파괴하면 공포가 쌓입니다. 사용한 카드는 버림 더미로 가고, 성장의 카드 모두 회수로 다시 손에 가져옵니다.',
        draw: () => `${sky()}${tok(300, 230, 'town', 'v-die', 0.3, 40)}${burst(300, 230, 0.3)}${A('v-pop', 0.9, '<g transform="translate(560 230)"><circle r="40" fill="#8e4fd0"/><use href="#pc-fear" x="-26" y="-26" width="52" height="52" style="color:#fff"/></g>')}${text(560, 310, '공포 +1', 30, 'v-fade', 1.1, '#d6b6ff')}${text(480, 430, '사용한 카드 → 버림 더미 → "카드 모두 회수"로 되찾기', 26, 'v-fade', 1.8)}` },
      { say: '카드의 원소 아이콘이 모이면, 정령의 내재 권능이 자동으로 켜지고 강해집니다. 어떤 원소가 필요한지는 정령 판에 나와 있어요.',
        draw: () => `${sky()}${['sun', 'water', 'water'].map((e, i) => A('v-pop', i * 0.4, `<use href="#el-${e}" x="${250 + i * 90}" y="200" width="70" height="70"/>`)).join('')}${arrow(530, 235, 600, 235, 'v-fade', 1.4)}${box(720, 235, 220, 110, '✨ 내재 권능', '조건 달성!', '#d9b45a', 'v-pop', 1.8)}${text(480, 400, '태양 1 + 물 2 → "대홍수" 발동', 28, 'v-fade', 2.2)}` },
    ] },
    { title: '승리와 패배', beats: [
      { say: '공포가 쌓이면 공포 카드를 얻고, 공포 단계가 오를수록 승리 조건이 쉬워집니다.',
        draw: () => `${sky()}${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => A('v-pop', i * 0.2, `<rect x="${230 + i * 62}" y="200" width="44" height="44" rx="6" transform="rotate(45 ${252 + i * 62} 222)" fill="#8e4fd0" stroke="#c9a2ff" stroke-width="2"/>`)).join('')}${arrow(480, 280, 480, 330, 'v-fade', 1.8)}${box(480, 400, 300, 100, '공포 카드 획득!', '공포 단계 상승', '#c9a2ff', 'v-pop', 2.1)}` },
      { say: '공포 1단계에서는 침략자 전멸, 2단계에서는 마을과 도시 전멸, 3단계에서는 도시만 모두 없애면 승리합니다.',
        draw: () => `${sky()}${box(200, 270, 250, 150, '1단계', '침략자 0', '#3f8f5c', 'v-pop', 0)}${box(480, 270, 250, 150, '2단계', '마을·도시 0', '#3f8f5c', 'v-pop', 0.5)}${box(760, 270, 250, 150, '3단계', '도시 0', '#3f8f5c', 'v-pop', 1)}${text(480, 440, '공포를 모을수록 쉬워져요!', 30, 'v-fade', 1.5, '#9be8b4')}` },
      { say: '황폐 카드의 황폐가 다 떨어지거나, 정령의 존재가 모두 사라지거나, 침략자 덱이 바닥나면 패배합니다.',
        draw: () => `${sky()}${box(200, 270, 250, 150, '☠ 황폐 고갈', '', '#a8402c', 'v-pop', 0)}${box(480, 270, 250, 150, '존재 전멸', '', '#a8402c', 'v-pop', 0.5)}${box(760, 270, 250, 150, '덱 소진', '시간 초과', '#a8402c', 'v-pop', 1)}` },
      { say: '이제 튜토리얼 게임에서 직접 해 보세요. 코치가 한 단계씩 도와드립니다!',
        draw: () => `${sky()}<svg x="400" y="110" width="160" height="160" viewBox="0 0 64 64"><use href="#logo"/></svg>${text(480, 340, '준비 완료!', 44, 'v-pop', 0.4, '#f3d98b')}${text(480, 400, '아래 "튜토리얼 시작"을 눌러 직접 해 보세요', 26, 'v-fade', 0.9)}` },
    ] },
  ];

  // ───── 플레이어 ─────
  const flat = SCENES.flatMap((sc, si) => sc.beats.map((b, bi) => ({ ...b, scene: sc.title, si, bi })));
  let pos = 0;
  let playing = false;
  let voiceOn = true;
  let timer = null;
  let voice = null;

  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const vs = speechSynthesis.getVoices();
    return vs.find((v) => /^ko/i.test(v.lang)) || null;
  }

  function stopSpeech() {
    clearTimeout(timer);
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  function next() { if (pos < flat.length - 1) { pos++; show(); } else { playing = false; renderControls(); } }

  function speakOrWait(textStr) {
    stopSpeech();
    const fallback = Math.max(3500, textStr.length * 95);
    if (!playing) return;
    voice = voice || pickVoice();
    if (voiceOn && voice) {
      const u = new SpeechSynthesisUtterance(textStr);
      u.voice = voice; u.lang = voice.lang; u.rate = 1.02; u.pitch = 1.0;
      let done = false;
      const end = () => { if (done) return; done = true; if (playing) timer = setTimeout(next, 900); };
      u.onend = end; u.onerror = end;
      speechSynthesis.speak(u);
      timer = setTimeout(end, fallback + 6000); // 음성이 끝나지 않는 경우 대비
    } else {
      timer = setTimeout(next, fallback);
    }
  }

  function show() {
    const b = flat[pos];
    const root = $('#video .video-player');
    root.querySelector('.vp-scene').textContent = `${b.si + 1}. ${b.scene}`;
    root.querySelector('.vp-stage').innerHTML = `<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id="vsea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f6a92"/><stop offset="1" stop-color="#0b2740"/></linearGradient>
      <pattern id="vback" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#3a2a50"/><rect width="6" height="12" fill="#2a1e3a"/></pattern>
      <marker id="varrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#d9b45a"/></marker></defs>
      ${b.draw()}</svg>`;
    root.querySelector('.vp-sub').textContent = b.say;
    renderControls();
    if (playing) speakOrWait(b.say);
  }

  function renderControls() {
    const root = $('#video .video-player');
    root.querySelector('.vp-progress').innerHTML = flat.map((b, i) => `<i class="${i < pos ? 'done' : i === pos ? 'now' : ''} ${b.bi === 0 ? 'first' : ''}" data-i="${i}" title="${b.scene}"></i>`).join('');
    for (const el of root.querySelectorAll('.vp-progress i')) el.onclick = () => { pos = Number(el.dataset.i); show(); };
    root.querySelector('[data-v="play"]').textContent = playing ? '⏸ 일시정지' : (pos >= flat.length - 1 ? '↺ 처음부터' : '▶ 재생');
    root.querySelector('[data-v="voice"]').textContent = voiceOn ? '🔊 음성 켜짐' : '🔇 음성 꺼짐';
    root.querySelector('.vp-chapters').innerHTML = SCENES.map((sc, i) => `<button class="small ${flat[pos].si === i ? 'on' : ''}" data-ch="${i}">${i + 1}. ${sc.title}</button>`).join('');
    for (const el of root.querySelectorAll('[data-ch]')) el.onclick = () => { pos = flat.findIndex((b) => b.si === Number(el.dataset.ch)); show(); };
  }

  function open() {
    const root = $('#video .video-player');
    root.innerHTML = `<div class="vp-top"><span class="vp-title">🎬 정령섬 규칙 설명</span><span class="vp-scene"></span><span style="flex:1"></span><button class="small" data-v="close">닫기 ✕</button></div>
      <div class="vp-stage"></div>
      <div class="vp-sub"></div>
      <div class="vp-progress"></div>
      <div class="vp-ctrl"><button class="small" data-v="prev">⏮ 이전</button><button class="primary" data-v="play">▶ 재생</button><button class="small" data-v="next">다음 ⏭</button><button class="small" data-v="voice"></button><span style="flex:1"></span><button class="small tut-btn" data-v="tutorial">🎓 튜토리얼 시작</button></div>
      <div class="vp-chapters"></div>
      <div class="hint vp-note">음성은 브라우저의 한국어 음성으로 읽어 줍니다. 음성이 없으면 자막만 나오며 자동으로 넘어갑니다.</div>`;
    root.onclick = (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      const v = b.dataset.v;
      if (v === 'close') close();
      else if (v === 'prev') { pos = Math.max(0, pos - 1); show(); }
      else if (v === 'next') { pos = Math.min(flat.length - 1, pos + 1); show(); }
      else if (v === 'play') {
        if (playing) { playing = false; stopSpeech(); renderControls(); } else { if (pos >= flat.length - 1) pos = 0; playing = true; show(); }
      } else if (v === 'voice') { voiceOn = !voiceOn; if (!voiceOn) stopSpeech(); if (playing) speakOrWait(flat[pos].say); renderControls(); }
      else if (v === 'tutorial') { close(); const btn = $('#btn-tutorial'); if (btn && !app.room) btn.click(); }
    };
    $('#video').classList.remove('hidden');
    pos = 0;
    playing = true;
    if ('speechSynthesis' in window) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); }; }
    show();
  }

  function close() { playing = false; stopSpeech(); $('#video').classList.add('hidden'); }

  return { open, close, isOpen: () => !$('#video').classList.contains('hidden'), scenes: SCENES.length, beats: flat.length };
})();
