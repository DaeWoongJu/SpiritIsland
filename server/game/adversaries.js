'use strict';
// 난이도: 기본 프리셋 + 적대 세력(Adversary). 원작 규칙을 온라인용으로 단순화했다.
// 각 레벨의 효과는 누적된다. 효과 키는 game.js 의 applyDifficulty 에서 해석한다.

const PRESETS = [
  { id: 'intro', name: '입문', desc: '처음 해보는 분께. 공포가 빨리 차고, 황폐 여유가 많고, 시작 에너지 +2.', mods: { fearPerPlayer: 3, blightPerPlayer: 2, startEnergy: 2 } },
  { id: 'easy', name: '쉬움', desc: '공포가 조금 빨리 차고 황폐 여유가 많습니다. 시작 에너지 +1.', mods: { fearPerPlayer: 3, blightPerPlayer: 1, startEnergy: 1 } },
  { id: 'normal', name: '보통', desc: '원작 기본 규칙.', mods: {} },
  { id: 'hard', name: '어려움', desc: '공포 카드를 얻으려면 공포가 더 필요하고, 황폐 여유가 적습니다.', mods: { fearPerPlayer: 5, blightPerPlayer: -1 } },
  { id: 'expert', name: '매우 어려움', desc: '어려움 + 침략자 1단계 카드 1장 제거(더 빨리 강해짐).', mods: { fearPerPlayer: 5, blightPerPlayer: -1, removeStage1: 1 } },
];

const ADVERSARIES = [
  {
    id: 'prussia', exp: 'base', name: '브란덴부르크-프로이센', en: 'Brandenburg-Prussia', base: 1,
    levels: [
      { name: '빠른 시작', text: '각 보드 3번 지역에 마을 1개를 추가로 놓고 시작합니다.', fx: { setupPieces: [{ num: 3, type: 'town' }] } },
      { name: '식민지 급증', text: '침략자 1단계 카드 1장을 제거합니다.', fx: { removeStage1: 1 } },
      { name: '효율적인 개척', text: '공포 카드가 1장 더 필요합니다.', fx: { extraFear: 1 } },
      { name: '공격적인 일정', text: '1단계 카드 1장과 2단계 카드 1장을 더 제거합니다.', fx: { removeStage1: 1, removeStage2: 1 } },
      { name: '무자비한 확장', text: '2단계 카드 1장을 더 제거합니다.', fx: { removeStage2: 1 } },
      { name: '전격 점령', text: '1단계 카드를 모두 제거합니다.', fx: { removeStage1: 9 } },
    ],
  },
  {
    id: 'england', exp: 'base', name: '잉글랜드', en: 'England', base: 1,
    levels: [
      { name: '계약 노동자', text: '침략자가 없어도, 마을/도시 2개 이상과 인접한 해당 지형에는 건설합니다.', fx: { buildAdjacent: true } },
      { name: '죄수 유배지', text: '각 보드 1번 지역에 마을, 2번 지역에 도시를 추가로 놓고 시작합니다.', fx: { setupPieces: [{ num: 1, type: 'town' }, { num: 2, type: 'city' }] } },
      { name: '높은 이민', text: '해안 지역은 건설을 두 번 합니다.', fx: { buildTwice: 'coastal' } },
      { name: '대규모 이주', text: '공포 카드가 1장 더 필요합니다.', fx: { extraFear: 1 } },
      { name: '지방 자치', text: '황폐 카드의 황폐가 플레이어당 1개 적습니다.', fx: { blightPerPlayer: -1 } },
      { name: '넘쳐나는 이민', text: '모든 지역이 건설을 두 번 합니다.', fx: { buildTwice: 'all' } },
    ],
  },
  {
    id: 'sweden', exp: 'base', name: '스웨덴', en: 'Sweden', base: 1,
    levels: [
      { name: '대규모 채굴', text: '약탈 피해가 6 이상이면 황폐 1개를 추가로 놓습니다.', fx: { heavyMining: true } },
      { name: '인구 밀집', text: '각 보드 4번 지역에 마을 1개를 추가로 놓고 시작합니다.', fx: { setupPieces: [{ num: 4, type: 'town' }] } },
      { name: '정교한 강철', text: '마을이 약탈할 때 피해 3을 줍니다.', fx: { townDamage: 3 } },
      { name: '채굴 열풍', text: '공포 카드가 1장 더 필요합니다.', fx: { extraFear: 1 } },
      { name: '광산 호황', text: '도시가 약탈할 때 피해 4를 줍니다.', fx: { cityDamage: 4 } },
      { name: '왕실 후원', text: '각 보드 6번 지역에 도시 1개를 추가로 놓고 시작합니다.', fx: { setupPieces: [{ num: 6, type: 'city' }] } },
    ],
  },
  {
    id: 'france', exp: 'bc', name: '프랑스 (식민지 농장)', en: 'France (Plantation Colony)', base: 2,
    levels: [
      { name: '무역 거점', text: '각 보드 3번 지역에 마을 1개를 추가로 놓고 시작합니다.', fx: { setupPieces: [{ num: 3, type: 'town' }] } },
      { name: '해안 정착', text: '해안 지역을 탐험할 때 탐험가가 1개 더 옵니다.', fx: { coastalExploreExtra: true } },
      { name: '조급한 정착민', text: '침략자 1단계 카드 1장을 제거합니다.', fx: { removeStage1: 1 } },
      { name: '국왕의 칙령', text: '황폐 카드의 황폐가 플레이어당 1개 적습니다.', fx: { blightPerPlayer: -1 } },
      { name: '끈질긴 개척', text: '공포 카드가 1장 더 필요합니다.', fx: { extraFear: 1 } },
      { name: '노예 농장', text: '마을이 약탈할 때 피해 3을 줍니다.', fx: { townDamage: 3 } },
    ],
  },
  {
    id: 'russia', exp: 'je', name: '러시아', en: 'Russia', base: 1,
    levels: [
      { name: '사냥꾼', text: '약탈 때 다한이 받는 피해 +1.', fx: { ravageDahanBonus: 1 } },
      { name: '원정대', text: '각 보드 5번 지역에 탐험가 2개를 추가로 놓고 시작합니다.', fx: { setupPieces: [{ num: 5, type: 'explorer', count: 2 }] } },
      { name: '모피 무역', text: '해안 지역을 탐험할 때 탐험가가 1개 더 옵니다.', fx: { coastalExploreExtra: true } },
      { name: '혹독한 땅', text: '공포 카드가 1장 더 필요합니다.', fx: { extraFear: 1 } },
      { name: '서두르는 진출', text: '침략자 1단계 카드 1장을 제거합니다.', fx: { removeStage1: 1 } },
      { name: '무장한 사냥꾼', text: '탐험가가 약탈할 때 피해 2를 줍니다.', fx: { explorerDamage: 2 } },
    ],
  },
  {
    id: 'habsburg', exp: 'je', name: '합스부르크 왕가', en: 'Habsburg Monarchy', base: 2,
    levels: [
      { name: '이주 정착', text: '각 보드 1번 지역에 마을 1개를 추가로 놓고 시작합니다.', fx: { setupPieces: [{ num: 1, type: 'town' }] } },
      { name: '목축 확장', text: '침략자가 없어도, 마을/도시 2개 이상과 인접한 해당 지형에는 건설합니다.', fx: { buildAdjacent: true } },
      { name: '단단한 성벽', text: '도시가 약탈할 때 피해 4를 줍니다.', fx: { cityDamage: 4 } },
      { name: '제국의 의지', text: '공포 카드가 1장 더 필요합니다.', fx: { extraFear: 1 } },
      { name: '국경 요새', text: '각 보드 7번 지역에 도시 1개를 추가로 놓고 시작합니다.', fx: { setupPieces: [{ num: 7, type: 'city' }] } },
      { name: '총력 개척', text: '2단계 카드 1장을 제거합니다.', fx: { removeStage2: 1 } },
    ],
  },
  {
    id: 'scotland', exp: 'ff', name: '스코틀랜드', en: 'Scotland', base: 1,
    levels: [
      { name: '무역 항구', text: '각 보드 2번 지역에 도시 1개를 추가로 놓고 시작합니다.', fx: { setupPieces: [{ num: 2, type: 'city' }] } },
      { name: '해안 개척', text: '해안 지역을 탐험할 때 탐험가가 1개 더 옵니다.', fx: { coastalExploreExtra: true } },
      { name: '부두 건설', text: '해안 지역은 건설을 두 번 합니다.', fx: { buildTwice: 'coastal' } },
      { name: '씨족의 자존심', text: '공포 카드가 1장 더 필요합니다.', fx: { extraFear: 1 } },
      { name: '척박한 땅', text: '황폐 카드의 황폐가 플레이어당 1개 적습니다.', fx: { blightPerPlayer: -1 } },
      { name: '하일랜드 정복', text: '마을이 약탈할 때 피해 3을 줍니다.', fx: { townDamage: 3 } },
    ],
  },
];

/** 프리셋 + 적대 세력 레벨 효과를 합친 설정 */
function difficultyConfig(diff = {}) {
  const cfg = { fearPerPlayer: 4, blightPerPlayer: 0, startEnergy: 0, removeStage1: 0, removeStage2: 0, extraFear: 0, setupPieces: [], townDamage: 2, cityDamage: 3, explorerDamage: 1 };
  const preset = PRESETS.find((p) => p.id === (diff.preset || 'normal')) || PRESETS[2];
  const apply = (fx) => {
    for (const [k, v] of Object.entries(fx)) {
      if (k === 'setupPieces') cfg.setupPieces.push(...v);
      else if (['blightPerPlayer', 'startEnergy', 'removeStage1', 'removeStage2', 'extraFear', 'ravageDahanBonus'].includes(k)) cfg[k] = (cfg[k] || 0) + v;
      else if (k === 'buildTwice') cfg.buildTwice = cfg.buildTwice === 'all' || v === 'all' ? 'all' : v;
      else cfg[k] = v;
    }
  };
  apply(preset.mods);
  const adv = ADVERSARIES.find((a) => a.id === diff.adversary);
  const level = adv ? Math.max(0, Math.min(6, Number(diff.level) || 0)) : 0;
  if (adv) for (let i = 0; i < level; i++) apply(adv.levels[i].fx);
  cfg.label = `${preset.name}${adv ? ` · ${adv.name} ${level}레벨` : ''}`;
  return cfg;
}

module.exports = { PRESETS, ADVERSARIES, difficultyConfig };
