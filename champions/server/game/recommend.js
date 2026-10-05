'use strict';
/*
 * 히어로 챔피언스 — 영웅별 추천 측면과 추천 덱
 * 추천 측면: 원작 기본 덱(프리컨)과 커뮤니티에서 가장 많이 추천하는 측면을 따릅니다.
 * 추천 덱: 영웅의 약점을 메우는 카드(저지가 약하면 저지 카드, 체력이 낮으면 방어·회복 등)를 점수로 골라 구성합니다.
 */

// [추천 측면, 이유]
const REC = {
  spark: ['justice', '저지력이 약한 편이라 정의로 계략을 막아요 (원작 기본 덱·커뮤니티 추천)'],
  gear: ['aggression', '업그레이드를 쌓아 화력을 폭발시켜요 (원작 기본 덱)'],
  titan: ['aggression', '높은 공격력을 살려 악당을 빠르게 쓰러뜨려요 (원작 기본 덱)'],
  star: ['leadership', '아군과 함께 싸우는 지휘가 잘 맞아요 (원작 기본 덱·커뮤니티 추천)'],
  fox: ['justice', '기절·혼란과 저지로 판을 통제해요 (원작 기본 덱)'],
  rune: ['protection', '동료를 지키는 주문과 수호의 궁합이 좋아요 (원작 기본 덱)'],
  cap: ['leadership', '어벤저스 리더답게 아군을 이끌어요 (원작 기본 덱)'],
  thor: ['aggression', '미니언을 쓸어버리는 공격형 (원작 기본 덱)'],
  panther: ['protection', '방어로 버티며 반격해요 (원작 기본 덱·커뮤니티 추천)'],
  hulk: ['aggression', '압도적인 체력과 공격력으로 밀어붙여요 (원작 기본 덱)'],
  wolverine: ['aggression', '회복력을 믿고 끝없이 공격해요 (원작 기본 덱)'],
  deadpool: ['aggression', '거칠게 몰아치는 공격형 (원작은 전용 측면 "풀")'],
  witch: ['justice', '혼란과 저지로 계략을 지워요 (원작 기본 덱)'],
  msmarvel: ['protection', '버티면서 카드를 많이 쓰는 형 (원작 기본 덱)'],
  hawkeye: ['leadership', '화살과 아군으로 넓게 싸워요 (원작 기본 덱)'],
  spiderwoman: ['aggression', '기절 공격과 화력 (원작 기본 덱은 분노+정의)'],
  rocket: ['aggression', '무기를 모아 큰 피해 (원작 기본 덱)'],
  groot: ['protection', '튼튼한 몸으로 동료를 지켜요 (원작 기본 덱)'],
  antman: ['leadership', '작은 동료들과 함께 (원작 기본 덱)'],
  wasp: ['aggression', '빠른 연속 공격 (원작 기본 덱)'],
  quicksilver: ['protection', '여러 번 행동하며 버텨요 (원작 기본 덱)'],
  starlord: ['leadership', '가디언즈 동료와 함께 (원작 기본 덱)'],
  gamora: ['aggression', '최강의 암살자답게 공격 (원작 기본 덱)'],
  drax: ['protection', '맷집으로 버티는 탱커 (원작 기본 덱)'],
  venom: ['justice', '공생체로 저지까지 (원작 기본 덱)'],
  nebula: ['justice', '장비와 저지로 이득을 챙겨요 (원작 기본 덱)'],
  warmachine: ['leadership', '화력과 아군 지원 (원작 기본 덱)'],
  valkyrie: ['aggression', '전사의 돌격 (원작 기본 덱)'],
  vision: ['protection', '밀도 조절로 버티기 (원작 기본 덱)'],
  nova: ['aggression', '빠른 돌격 (원작 기본 덱)'],
  ironheart: ['leadership', '수트 업그레이드와 아군 (원작 기본 덱)'],
  spiderham: ['justice', '엉뚱한 저지 (원작 기본 덱)'],
  spdr: ['protection', '로봇 장갑으로 버티기 (원작 기본 덱)'],
  silk: ['protection', '거미줄로 버티며 저지 (원작 기본 덱)'],
  ghostspider: ['protection', '빠르게 버티며 공격 (원작 기본 덱)'],
  miles: ['justice', '투명화와 저지 (원작 기본 덱)'],
  spectrum: ['leadership', '빛의 형태로 아군 지원 (원작 기본 덱)'],
  warlock: ['justice', '모든 측면을 쓰는 영웅 — 저지 보완 추천'],
  colossus: ['protection', '강철 몸 탱커 (원작 기본 덱)'],
  shadowcat: ['aggression', '위상 기습 공격 (원작 기본 덱)'],
  cyclops: ['leadership', '엑스맨 리더 (원작 기본 덱)'],
  phoenix: ['justice', '텔레파시 저지 (원작 기본 덱)'],
  storm: ['leadership', '날씨와 동료 지원 (원작 기본 덱)'],
  gambit: ['justice', '카드로 저지와 피해 (원작 기본 덱)'],
  rogue: ['protection', '흡수하며 버티기 (원작 기본 덱)'],
  psylocke: ['justice', '정신 공격과 저지 (원작 기본 덱)'],
  angel: ['protection', '하늘에서 버티기 (원작 기본 덱)'],
  x23: ['aggression', '발톱 난도질 (원작 기본 덱)'],
  iceman: ['aggression', '얼음 폭풍 공격 (원작 기본 덱)'],
  jubilee: ['justice', '폭죽으로 저지 (원작 기본 덱)'],
  nightcrawler: ['protection', '순간이동 회피 (원작 기본 덱)'],
  cable: ['leadership', '미래 장비와 아군 (원작 기본 덱)'],
  domino: ['justice', '행운의 저지 (원작 기본 덱)'],
  bishop: ['leadership', '에너지 흡수와 지원 (원작 기본 덱)'],
  magik: ['aggression', '소울소드 공격 (원작 기본 덱)'],
  mariahill: ['leadership', '쉴드 요원 지휘 (원작 기본 덱)'],
  nickfury: ['justice', '비밀 작전과 저지 (원작 기본 덱)'],
  hulkling: ['aggression', '변신 괴력 공격'],
  tigra: ['aggression', '날렵한 발톱 공격'],
  daredevil: ['justice', '레이더 감각으로 저지'],
  echo: ['aggression', '따라 하는 무술 공격'],
  wonderman: ['leadership', '튼튼한 몸과 아군 지원'],
  hercules: ['aggression', '신의 괴력 공격'],
  magneto_h: ['aggression', '자기력 공격'],
  shuri: ['justice', '발명품으로 저지·지원'],
  falcon: ['leadership', '하늘을 나는 동료들을 이끌어요 (원작 기본 덱: 지휘)'],
  jessica: ['justice', '사건 추적과 저지'],
  lukecage: ['protection', '강철 피부 탱커'],
  elektra: ['aggression', '닌자 암살 공격'],
  ironfist: ['aggression', '철권 공격'],
};

/** 카드가 하는 일 (설명 글로 판단) */
function roles(c) {
  const t = c.text || '';
  return {
    thw: /위협/.test(t) || (c.ally && c.ally.thw >= 2) || (c.mods && c.mods.thw),
    dmg: !!c.attack || /피해 \d/.test(t) && !/피해 -/.test(t) || (c.ally && c.ally.atk >= 2) || (c.mods && c.mods.atk),
    def: !!c.defense || /강인함|회복|방어력|최대 체력/.test(t),
    ally: c.type === 'ally',
    draw: /뽑/.test(t),
    econ: /자원 \+|준비/.test(t),
  };
}

/** 영웅에 맞춰 카드 점수 매기기 */
function scoreCard(c, h) {
  const r = roles(c);
  const thwWeak = h.hero.thw <= 1, atkWeak = h.hero.atk <= 1, fragile = h.hp <= 10;
  let s = 3;
  if (r.thw) s += thwWeak ? 4 : 2;
  if (r.dmg) s += atkWeak ? 4 : 2;
  if (r.def) s += fragile ? 3 : 1;
  if (r.draw) s += 2;
  if (r.econ) s += 1;
  if (r.ally) s += h.style === 'leader' ? 4 : 1;
  if (c.type === 'upgrade' || c.type === 'support') s += 1; // 계속 남는 카드
  if (h.style === 'tank' && r.def) s += 2;
  if ((h.style === 'blaster' || h.style === 'fighter') && r.dmg) s += 1;
  if (h.style === 'tactician' && r.thw) s += 1;
  s -= Math.max(0, (c.cost || 0) - 2) * 1.5; // 비싼 카드는 조금 덜
  return s;
}

function make(D) {
  const { PLAYER_CARDS, HEROES, DECK_SIZE } = D;
  const RES = ['energy_cell', 'genius', 'strength', 'determination'];
  /** 추천 덱: 영웅 전용 카드 + 기본 자원 + 점수 높은 측면·기본 카드 (같은 카드 최대 3장) */
  function recommendDeck(heroId, aspect) {
    const h = HEROES.find((x) => x.id === heroId) || HEROES[0];
    const asp = aspect || (REC[heroId] || ['justice'])[0];
    const deck = [];
    for (const c of PLAYER_CARDS.filter((x) => x.aspect === heroId)) { deck.push(c.id); if (c.type === 'event' || c.type === 'ally') deck.push(c.id); }
    deck.push(...RES);
    const pool = PLAYER_CARDS.filter((c) => (c.aspect === asp || c.aspect === 'basic') && c.type !== 'resource')
      .map((c) => ({ c, s: scoreCard(c, h) + (c.aspect === asp ? 1 : 0) }))
      .sort((a, b) => b.s - a.s || a.c.id.localeCompare(b.c.id));
    // 핵심 카드 몇 종을 고르고 → 가장 좋은 카드부터 2장째, 3장째를 넣어 40장을 채움 (원작 덱처럼 핵심 카드를 여러 장)
    const slots = DECK_SIZE - deck.length;
    const core = pool.slice(0, Math.max(1, Math.ceil(slots * 0.6)));
    for (const { c } of core) deck.push(c.id);
    for (let copy = 2; copy <= 3 && deck.length < DECK_SIZE; copy++) {
      for (const { c } of core) { if (deck.length >= DECK_SIZE) break; deck.push(c.id); }
    }
    while (deck.length < DECK_SIZE) deck.push('determination');
    return deck.slice(0, DECK_SIZE);
  }
  return { recommendDeck, REC };
}

module.exports = { REC, make, scoreCard, roles };
