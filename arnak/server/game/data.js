'use strict';
/*
 * 아르낙 온라인 — 게임 데이터
 * 규칙 구조(라운드·발굴·탐사·수호자·연구 트랙·우상·조수)는 원작을 따르고,
 * 카드·유적·수호자의 이름과 효과는 이 프로젝트에서 직접 만든 것입니다.
 */

const RES = ['coin', 'compass', 'tablet', 'arrow', 'gem'];
const RES_NAMES = { coin: '동전', compass: '나침반', tablet: '석판', arrow: '화살촉', gem: '보석', draw: '카드', fear: '두려움' };
const TRAVEL = ['boot', 'car', 'ship', 'plane'];
const TRAVEL_NAMES = { boot: '도보', car: '지프', ship: '배', plane: '비행기' };

const resText = (r) => Object.entries(r).filter(([, n]) => n).map(([k, n]) => `${RES_NAMES[k]} ${n}`).join(' + ');
const gain = (r) => async (g, pid) => g.gain(pid, r);

// ───────────── 시작 카드 / 두려움 ─────────────
const START = [
  { id: 'funding', kind: 'start', name: '탐사 자금', travel: 'ship', vp: 0, text: '동전 1을 얻습니다.', effect: gain({ coin: 1 }) },
  { id: 'exploration', kind: 'start', name: '현지 조사', travel: 'car', vp: 0, text: '나침반 1을 얻습니다.', effect: gain({ compass: 1 }) },
];
const FEAR = { id: 'fear', kind: 'fear', name: '두려움', travel: 'boot', vp: -1, text: '효과 없음. 게임 끝에 -1점. (이동 비용으로는 쓸 수 있어요)', effect: null };

// ───────────── 물건 (동전으로 구매, 덱 맨 아래로) ─────────────
const ITEMS = [
  { id: 'machete', name: '정글도', cost: 1, vp: 0, travel: 'boot', text: '나침반 2를 얻습니다.', effect: gain({ compass: 2 }) },
  { id: 'canteen', name: '물통', cost: 1, vp: 0, travel: 'boot', free: true, text: '⚡ 동전 1을 얻습니다.', effect: gain({ coin: 1 }) },
  { id: 'rope', name: '밧줄', cost: 1, vp: 1, travel: 'car', text: '동전 1과 나침반 1을 얻습니다.', effect: gain({ coin: 1, compass: 1 }) },
  { id: 'lantern', name: '등불', cost: 2, vp: 0, travel: 'boot', text: '카드 2장을 뽑습니다.', effect: async (g, pid) => g.drawCards(pid, 2) },
  { id: 'brush', name: '발굴 솔', cost: 2, vp: 1, travel: 'car', text: '석판 1을 얻습니다.', effect: gain({ tablet: 1 }) },
  { id: 'trowel', name: '모종삽', cost: 2, vp: 0, travel: 'ship', text: '석판 1과 동전 1을 얻습니다.', effect: gain({ tablet: 1, coin: 1 }) },
  { id: 'binoculars', name: '쌍안경', cost: 2, vp: 1, travel: 'plane', text: '나침반 2를 얻습니다.', effect: gain({ compass: 2 }) },
  { id: 'journal', name: '탐험 일지', cost: 2, vp: 1, travel: 'boot', text: '카드 1장을 뽑고 동전 1을 얻습니다.', effect: async (g, pid) => { g.gain(pid, { coin: 1 }); g.drawCards(pid, 1); } },
  { id: 'pith_helmet', name: '탐험모', cost: 2, vp: 1, travel: 'car', free: true, text: '⚡ 나침반 1을 얻습니다.', effect: gain({ compass: 1 }) },
  { id: 'bow', name: '사냥 활', cost: 3, vp: 1, travel: 'boot', text: '화살촉 1을 얻습니다.', effect: gain({ arrow: 1 }) },
  { id: 'pickaxe', name: '곡괭이', cost: 3, vp: 1, travel: 'car', text: '석판 1과 나침반 1을 얻습니다.', effect: gain({ tablet: 1, compass: 1 }) },
  { id: 'jeep', can: (g, pid) => g.P(pid).arch > 0 && g.digTargets(pid, { free: true, maxLevel: 1 }).length > 0, name: '낡은 지프', cost: 3, vp: 1, travel: 'car', text: '이동 비용 없이 기본 유적이나 발견한 1단계 유적에 발굴합니다.', effect: async (g, pid) => g.doDig(pid, { free: true, maxLevel: 1 }) },
  { id: 'seaplane', can: (g, pid) => g.P(pid).arch > 0 && g.digTargets(pid, { free: true, maxLevel: 2 }).length > 0, name: '수상 비행기', cost: 4, vp: 2, travel: 'plane', text: '이동 비용 없이 아무 발견한 유적에 발굴합니다.', effect: async (g, pid) => g.doDig(pid, { free: true, maxLevel: 2 }) },
  { id: 'camera', name: '사진기', cost: 3, vp: 2, travel: 'ship', text: '동전 2를 얻습니다.', effect: gain({ coin: 2 }) },
  { id: 'compass_item', name: '황동 나침반', cost: 3, vp: 1, travel: 'ship', text: '나침반 3을 얻습니다.', effect: gain({ compass: 3 }) },
  { id: 'trade_goods', name: '교역품', cost: 3, vp: 1, travel: 'ship', text: '동전 2를 내고 보석 1을 얻을 수 있습니다.', effect: async (g, pid) => g.convert(pid, { coin: 2 }, { gem: 1 }) },
  { id: 'climbing_gear', can: (g, pid) => g.researchTokens(pid, { discount: { tablet: 1 } }).length > 0, name: '등반 장비', cost: 3, vp: 1, travel: 'boot', text: '연구 1칸 진행 (비용 중 석판 1개 면제).', effect: async (g, pid) => g.doResearch(pid, { discount: { tablet: 1 } }) },
  { id: 'old_map', name: '오래된 지도', cost: 3, vp: 2, travel: 'car', text: '나침반 2와 화살촉 1 중 하나를 고릅니다.', effect: async (g, pid) => g.chooseGain(pid, [{ compass: 2 }, { arrow: 1 }]) },
  { id: 'pack_mule', name: '짐 나귀', cost: 2, vp: 0, travel: 'boot', free: true, text: '⚡ 카드 1장을 뽑습니다.', effect: async (g, pid) => g.drawCards(pid, 1) },
  { id: 'cargo_ship', name: '화물선', cost: 4, vp: 2, travel: 'ship', text: '동전 3을 얻습니다.', effect: gain({ coin: 3 }) },
  { id: 'chisel', name: '정', cost: 4, vp: 2, travel: 'car', text: '석판 2를 얻습니다.', effect: gain({ tablet: 2 }) },
  { id: 'revolver', name: '리볼버', cost: 4, vp: 1, travel: 'plane', text: '화살촉 1과 동전 1을 얻습니다.', effect: gain({ arrow: 1, coin: 1 }) },
  { id: 'monocle', name: '감정용 외알 안경', cost: 4, vp: 2, travel: 'boot', text: '카드 1장을 추방하고, 추방했다면 보석 1을 얻습니다.', effect: async (g, pid) => { if (await g.exileCard(pid)) g.gain(pid, { gem: 1 }); } },
  { id: 'grant', name: '연구 지원금', cost: 1, vp: 0, travel: 'ship', text: '카드 1장을 추방할 수 있습니다 (두려움 카드를 없애기 좋아요).', effect: async (g, pid) => { await g.exileCard(pid); } },
  { id: 'telegram', name: '전보', cost: 2, vp: 0, travel: 'plane', free: true, text: '⚡ 동전 1을 얻습니다.', effect: gain({ coin: 1 }) },
  { id: 'hot_air', can: (g, pid) => g.buyTargets(pid, { kinds: ['item'], discount: 2 }).length > 0, name: '열기구', cost: 3, vp: 1, travel: 'plane', text: '물건 카드를 동전 2 싸게 삽니다.', effect: async (g, pid) => g.doBuy(pid, { kinds: ['item'], discount: 2 }) },
  { id: 'museum_letter', can: (g, pid) => g.buyTargets(pid, { kinds: ['artifact'], discount: 2 }).length > 0, name: '박물관의 편지', cost: 4, vp: 3, travel: 'boot', text: '유물 카드를 나침반 2 싸게 삽니다.', effect: async (g, pid) => g.doBuy(pid, { kinds: ['artifact'], discount: 2 }) },
  { id: 'expedition_tent', name: '탐사 천막', cost: 3, vp: 2, travel: 'car', text: '동전 1, 나침반 1, 석판 1 중 둘을 얻습니다.', effect: async (g, pid) => { await g.chooseGain(pid, [{ coin: 1 }, { compass: 1 }, { tablet: 1 }]); await g.chooseGain(pid, [{ coin: 1 }, { compass: 1 }, { tablet: 1 }]); } },
].map((c) => ({ kind: 'item', ...c }));

// ───────────── 유물 (나침반으로 구매, 사자마자 공짜로 1번 사용 가능) ─────────────
const ARTIFACTS = [
  { id: 'jade_mask', name: '비취 가면', cost: 1, vp: 1, travel: 'boot', text: '석판 1을 얻습니다.', effect: gain({ tablet: 1 }) },
  { id: 'obsidian_knife', name: '흑요석 칼', cost: 2, vp: 1, travel: 'boot', text: '화살촉 1을 얻습니다.', effect: gain({ arrow: 1 }) },
  { id: 'star_chart', name: '별자리 판', cost: 2, vp: 1, travel: 'ship', text: '나침반 3을 얻습니다.', effect: gain({ compass: 3 }) },
  { id: 'sun_disc', name: '태양 원반', cost: 2, vp: 2, travel: 'car', text: '동전 2와 석판 1 중 하나를 고릅니다.', effect: async (g, pid) => g.chooseGain(pid, [{ coin: 2 }, { tablet: 1 }]) },
  { id: 'ancient_scroll', name: '고대 두루마리', cost: 2, vp: 1, travel: 'boot', text: '카드 2장을 뽑습니다.', effect: async (g, pid) => g.drawCards(pid, 2) },
  { id: 'feather_crown', name: '깃털 왕관', cost: 3, vp: 2, travel: 'plane', text: '보석 1을 얻습니다.', effect: gain({ gem: 1 }) },
  { id: 'idol_eye', name: '우상의 눈', cost: 3, vp: 2, travel: 'ship', text: '화살촉 1과 석판 1을 얻습니다.', effect: gain({ arrow: 1, tablet: 1 }) },
  { id: 'serpent_staff', can: (g, pid) => g.researchTokens(pid, { discount: { arrow: 1 } }).length > 0, name: '뱀 지팡이', cost: 3, vp: 1, travel: 'car', text: '연구 1칸 진행 (비용 중 화살촉 1개 면제).', effect: async (g, pid) => g.doResearch(pid, { discount: { arrow: 1 } }) },
  { id: 'stone_key', can: (g, pid) => g.P(pid).arch > 0 && g.digTargets(pid, { free: true, maxLevel: 2 }).length > 0, name: '돌 열쇠', cost: 3, vp: 2, travel: 'boot', text: '이동 비용 없이 아무 발견한 유적에 발굴합니다.', effect: async (g, pid) => g.doDig(pid, { free: true, maxLevel: 2 }) },
  { id: 'ritual_drum', name: '제례용 북', cost: 3, vp: 1, travel: 'ship', text: '카드 1장을 추방하고 동전 2를 얻습니다.', effect: async (g, pid) => { await g.exileCard(pid); g.gain(pid, { coin: 2 }); } },
  { id: 'warrior_totem', name: '전사의 토템', cost: 3, vp: 2, travel: 'car', text: '화살촉 2를 내고 보석 1과 나침반 2를 얻을 수 있습니다.', effect: async (g, pid) => g.convert(pid, { arrow: 2 }, { gem: 1, compass: 2 }) },
  { id: 'moon_pendant', name: '달의 목걸이', cost: 4, vp: 3, travel: 'plane', text: '보석 1과 동전 1을 얻습니다.', effect: gain({ gem: 1, coin: 1 }) },
  { id: 'golden_jaguar', name: '황금 재규어', cost: 4, vp: 3, travel: 'boot', text: '화살촉 2를 얻습니다.', effect: gain({ arrow: 2 }) },
  { id: 'temple_map', can: (g, pid) => g.researchTokens(pid, { free: true }).length > 0, name: '신전 지도', cost: 4, vp: 2, travel: 'plane', text: '연구 1칸 진행 (비용 없음).', effect: async (g, pid) => g.doResearch(pid, { free: true }) },
  { id: 'guardian_horn', can: (g, pid) => g.overcomeTargets(pid, 2).length > 0, name: '수호자의 뿔피리', cost: 4, vp: 2, travel: 'ship', text: '수호자 하나를 제압합니다 (비용 중 아무 자원 2개 면제).', effect: async (g, pid) => g.doOvercome(pid, { discount: 2 }) },
  { id: 'crystal_skull', name: '수정 해골', cost: 4, vp: 3, travel: 'car', text: '석판 1, 화살촉 1, 보석 1 중 하나를 얻습니다.', effect: async (g, pid) => g.chooseGain(pid, [{ tablet: 1 }, { arrow: 1 }, { gem: 1 }]) },
  { id: 'clay_tablet', name: '점토판 묶음', cost: 1, vp: 0, travel: 'boot', text: '석판 1과 동전 1을 얻습니다.', effect: gain({ tablet: 1, coin: 1 }) },
  { id: 'bone_flute', name: '뼈 피리', cost: 2, vp: 1, travel: 'ship', text: '카드 1장을 추방할 수 있습니다. 그리고 나침반 2를 얻습니다.', effect: async (g, pid) => { await g.exileCard(pid); g.gain(pid, { compass: 2 }); } },
  { id: 'sky_lens', name: '하늘의 렌즈', cost: 3, vp: 2, travel: 'plane', text: '석판 2를 얻습니다.', effect: gain({ tablet: 2 }) },
  { id: 'spirit_mask', can: (g, pid) => g.researchTokens(pid, { discount: { gem: 1 } }).length > 0, name: '정령 가면', cost: 4, vp: 3, travel: 'car', text: '연구 1칸 진행 (비용 중 보석 1개 면제).', effect: async (g, pid) => g.doResearch(pid, { discount: { gem: 1 } }) },
].map((c) => ({ kind: 'artifact', ...c }));

// ───────────── 유적 ─────────────
// 기본 유적: 처음부터 열려 있음. 1·2단계 위치: 탐사해서 유적 타일을 공개.
const BASIC_SITES = [
  { id: 'b1', name: '야영지 샘터', level: 0, travel: { boot: 1 }, reward: { tablet: 1 } },
  { id: 'b2', name: '버려진 교역소', level: 0, travel: { boot: 1 }, reward: { coin: 2 } },
  { id: 'b3', name: '강가 나루터', level: 0, travel: { ship: 1 }, reward: { compass: 2 } },
  { id: 'b4', name: '사냥꾼의 오두막', level: 0, travel: { ship: 1 }, reward: { arrow: 1 } },
  { id: 'b5', name: '무너진 감시탑', level: 0, travel: { car: 1 }, reward: { compass: 1, coin: 1 } },
];
const LOCATIONS = [
  { id: 'l1a', level: 1, travel: { car: 2 }, compass: 3 },
  { id: 'l1b', level: 1, travel: { car: 2 }, compass: 3 },
  { id: 'l1c', level: 1, travel: { car: 2 }, compass: 3 },
  { id: 'l1d', level: 1, travel: { car: 2 }, compass: 3 },
  { id: 'l2a', level: 2, travel: { plane: 1, ship: 1 }, compass: 6 },
  { id: 'l2b', level: 2, travel: { plane: 1, ship: 1 }, compass: 6 },
  { id: 'l2c', level: 2, travel: { plane: 1, ship: 1 }, compass: 6 },
  { id: 'l2d', level: 2, travel: { plane: 1, ship: 1 }, compass: 6 },
];
const SITE_TILES_1 = [
  { id: 's1_1', name: '덩굴에 덮인 석상', reward: { tablet: 2 } },
  { id: 's1_2', name: '부서진 제단', reward: { arrow: 1, coin: 1 } },
  { id: 's1_3', name: '안개 낀 계단', reward: { compass: 2, coin: 1 } },
  { id: 's1_4', name: '벽화의 방', reward: { draw: 2 } },
  { id: 's1_5', name: '박쥐 동굴', reward: { arrow: 1, tablet: 1 } },
  { id: 's1_6', name: '가라앉은 정원', reward: { tablet: 1, compass: 2 } },
  { id: 's1_7', name: '황금 연못', reward: { coin: 3 } },
  { id: 's1_8', name: '사냥의 신전', reward: { arrow: 1, draw: 1 } },
];
const SITE_TILES_2 = [
  { id: 's2_1', name: '왕의 무덤', reward: { gem: 1, arrow: 1 } },
  { id: 's2_2', name: '별을 보는 탑', reward: { gem: 1, tablet: 1, coin: 1 } },
  { id: 's2_3', name: '무기고 유적', reward: { arrow: 2, tablet: 1 } },
  { id: 's2_4', name: '예언자의 방', reward: { gem: 1, draw: 2 } },
  { id: 's2_5', name: '대도서관', reward: { tablet: 2, arrow: 1 } },
  { id: 's2_6', name: '태양의 문', reward: { gem: 1, compass: 3 } },
];

// 우상: 탐사할 때 얻음. 즉시 보너스 + 게임 끝 3점 (판에 놓아 쓰면 1점)
const IDOLS = [
  { id: 'i1', reward: { gem: 1 } }, { id: 'i2', reward: { arrow: 1, coin: 1 } }, { id: 'i3', reward: { tablet: 1, compass: 1 } },
  { id: 'i4', reward: { coin: 2, compass: 1 } }, { id: 'i5', reward: { draw: 2 } }, { id: 'i6', reward: { arrow: 1, tablet: 1 } },
  { id: 'i7', reward: { compass: 3 } }, { id: 'i8', reward: { coin: 3 } }, { id: 'i9', reward: { tablet: 2 } }, { id: 'i10', reward: { gem: 1 } },
];
const IDOL_SLOT_CHOICES = [{ coin: 2 }, { compass: 2 }, { tablet: 1 }, { arrow: 1 }, { draw: 2 }];
const IDOL_VP = 3;
const IDOL_PLACED_VP = 1;

// 수호자: 탐사한 유적에 나타남. 제압하면 5점 + 혜택 1번
const GUARDIANS = [
  { id: 'g1', name: '돌비늘 거북', cost: { tablet: 2, compass: 1 }, boon: { kind: 'gain', res: { coin: 3 } } },
  { id: 'g2', name: '밀림의 큰 뱀', cost: { arrow: 2 }, boon: { kind: 'gain', res: { compass: 3 } } },
  { id: 'g3', name: '황금 눈의 재규어', cost: { arrow: 1, gem: 1 }, boon: { kind: 'gain', res: { gem: 1 } } },
  { id: 'g4', name: '고대의 박쥐 떼', cost: { arrow: 1, compass: 2 }, boon: { kind: 'draw', n: 2 } },
  { id: 'g5', name: '사원의 석상 거인', cost: { tablet: 2, arrow: 1 }, boon: { kind: 'research' } },
  { id: 'g6', name: '깃털 달린 뱀신', cost: { gem: 1, tablet: 1 }, boon: { kind: 'gain', res: { arrow: 2 } } },
  { id: 'g7', name: '늪지의 악어 왕', cost: { arrow: 2, coin: 1 }, boon: { kind: 'exile' } },
  { id: 'g8', name: '그림자 원숭이', cost: { compass: 3, coin: 1 }, boon: { kind: 'gain', res: { tablet: 2 } } },
  { id: 'g9', name: '천둥새', cost: { gem: 1, arrow: 1 }, boon: { kind: 'research' } },
  { id: 'g10', name: '거미 여왕', cost: { tablet: 1, arrow: 1, coin: 1 }, boon: { kind: 'gain', res: { coin: 2, compass: 2 } } },
  { id: 'g11', name: '흑요석 골렘', cost: { tablet: 3 }, boon: { kind: 'gain', res: { arrow: 1, gem: 1 } } },
  { id: 'g12', name: '바람의 정령', cost: { compass: 2, gem: 1 }, boon: { kind: 'draw', n: 3 } },
];
const GUARDIAN_VP = 5;

// ───────────── 연구 트랙 ─────────────
// row 0 = 출발, 7 = 신전. cost = 이 줄로 올라올 때 내는 비용, reward = 처음 도착한 말이 받는 보상.
const RESEARCH = [
  { row: 0, cost: {}, reward: null },
  { row: 1, cost: { tablet: 1 }, reward: { kind: 'gain', res: { coin: 1, compass: 1 } } },
  { row: 2, cost: { arrow: 1 }, reward: { kind: 'assistant' } },
  { row: 3, cost: { tablet: 1, arrow: 1 }, reward: { kind: 'gain', res: { compass: 2, coin: 1 } } },
  { row: 4, cost: { gem: 1 }, reward: { kind: 'upgrade' } },
  { row: 5, cost: { tablet: 2, arrow: 1 }, reward: { kind: 'assistant' } },
  { row: 6, cost: { arrow: 1, gem: 1 }, reward: { kind: 'gain', res: { tablet: 1, gem: 1 } } },
  { row: 7, cost: { tablet: 1, arrow: 1, gem: 1 }, reward: { kind: 'temple' } },
];
const GLASS_VP = [0, 1, 2, 4, 6, 9, 12, 16];
const NOTE_VP = [0, 0, 1, 2, 3, 5, 7, 10];
const TEMPLE_TILES = [
  { id: 't11', vp: 11, cost: { tablet: 1, arrow: 1, gem: 1 }, count: 6 },
  { id: 't6', vp: 6, cost: { arrow: 2, tablet: 1 }, count: 6 },
  { id: 't2', vp: 2, cost: { tablet: 2 }, count: 12 },
];
const TEMPLE_ARRIVAL_VP = [6, 4, 2, 1];

// 조수: 라운드마다 1번 쓰는 능력. 업그레이드하면 강해짐.
const ASSISTANTS = [
  { id: 'a1', name: '측량사 미라', base: { compass: 1 }, up: { compass: 2 } },
  { id: 'a2', name: '상인 바스코', base: { coin: 1 }, up: { coin: 2 } },
  { id: 'a3', name: '학자 엘레나', base: { tablet: 1 }, up: { tablet: 1, coin: 1 } },
  { id: 'a4', name: '사냥꾼 오그웨', base: { compass: 1, coin: 1 }, up: { arrow: 1 } },
  { id: 'a5', name: '서기 하룬', base: { draw: 1 }, up: { draw: 2 } },
  { id: 'a6', name: '보석상 리아', base: { coin: 1 }, up: { gem: 1 } },
  { id: 'a7', name: '경비병 토마스', base: { exile: 1 }, up: { exile: 1, coin: 1 } },
  { id: 'a8', name: '길잡이 누리', base: { compass: 2 }, up: { compass: 2, tablet: 1 } },
];

// 시작 자원 (차례 순서대로 뒤 플레이어가 조금 더 받음)
const START_RES = [
  { coin: 1, compass: 1 },
  { coin: 2, compass: 1 },
  { coin: 1, compass: 2 },
  { coin: 2, compass: 2 },
];
const ROUNDS = 5;
const HAND_SIZE = 5;
const ARCHAEOLOGISTS = 2;
const ROW_SIZE = 6;

const ALL_CARDS = [...START, FEAR, ...ITEMS, ...ARTIFACTS];
const CARD_MAP = Object.fromEntries(ALL_CARDS.map((c) => [c.id, c]));

module.exports = {
  RES, RES_NAMES, TRAVEL, TRAVEL_NAMES, resText,
  START, FEAR, ITEMS, ARTIFACTS, CARD_MAP,
  BASIC_SITES, LOCATIONS, SITE_TILES_1, SITE_TILES_2, IDOLS, IDOL_SLOT_CHOICES, IDOL_VP, IDOL_PLACED_VP,
  GUARDIANS, GUARDIAN_VP, RESEARCH, GLASS_VP, NOTE_VP, TEMPLE_TILES, TEMPLE_ARRIVAL_VP, ASSISTANTS,
  START_RES, ROUNDS, HAND_SIZE, ARCHAEOLOGISTS, ROW_SIZE,
};
