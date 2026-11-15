'use strict';
// 요괴 퇴마 디펜스 — 데이터 (유닛·요괴·대장·축복·난이도). 모든 캐릭터는 이 게임을 위해 새로 만든 것입니다.

/** 등급 */
const TIERS = [
  { id: 1, name: '일반', color: '#b8b8c8' },
  { id: 2, name: '희귀', color: '#58a8f8' },
  { id: 3, name: '에픽', color: '#b878f8' },
  { id: 4, name: '전설', color: '#f8a838' },
  { id: 5, name: '신화', color: '#f85878' },
  { id: 6, name: '영웅', color: '#48f0d8' }, // 미션으로만 얻는 고유 유닛
];

/**
 * 유닛
 * cat: blade(근접, 날아다니는 적 공격 불가) / bow(원거리) / magic(술법)
 * dmg: 한 번 공격 피해, cd: 공격 간격(초), range: 사거리(칸)
 * 특수: splash(광역 반경), slow{pct,dur}, poison{dps,dur}, burn{dps,dur}, chain(튕김 수), shred(방어 깎기),
 *       crit{chance,mult}, execute(체력 비율), multi(동시 공격 수), aura{as,dmg,r}, stun{chance,dur}, pierceArmor
 */
const UNITS = [
  // ── 일반 ──
  { id: 'novice', tier: 1, name: '견습 검사', icon: '⚔️', cat: 'blade', dmg: 11, cd: 0.8, range: 1.5, desc: '가까운 요괴를 베는 기본 검사' },
  { id: 'hunter', tier: 1, name: '산골 사냥꾼', icon: '🏹', cat: 'bow', dmg: 8, cd: 0.9, range: 3.5, desc: '멀리서 화살을 쏩니다' },
  { id: 'talisman', tier: 1, name: '부적사', icon: '📜', cat: 'magic', dmg: 5, cd: 1.0, range: 2.8, slow: { pct: 0.3, dur: 1.5 }, desc: '부적을 붙여 느리게 만듭니다' },
  { id: 'powder', tier: 1, name: '화약공', icon: '💣', cat: 'magic', dmg: 8, cd: 1.5, range: 2.8, splash: 0.9, desc: '작은 폭발로 여럿을 공격' },
  { id: 'needle', tier: 1, name: '독침꾼', icon: '🧪', cat: 'bow', dmg: 3, cd: 1.0, range: 3.0, poison: { dps: 7, dur: 3 }, desc: '독으로 계속 피해를 줍니다' },
  // ── 희귀 ──
  { id: 'wave', tier: 2, name: '물결 검사', icon: '🌊', cat: 'blade', dmg: 34, cd: 0.8, range: 1.6, splash: 1.0, desc: '휘두르면 주변이 함께 베입니다' },
  { id: 'wind', tier: 2, name: '바람 궁수', icon: '🍃', cat: 'bow', dmg: 15, cd: 0.38, range: 3.8, desc: '아주 빠르게 연사' },
  { id: 'frost', tier: 2, name: '얼음 무녀', icon: '❄️', cat: 'magic', dmg: 20, cd: 1.0, range: 3.0, slow: { pct: 0.45, dur: 2 }, desc: '강하게 얼려 느리게 만듭니다' },
  { id: 'spark', tier: 2, name: '뇌전 술사', icon: '⚡', cat: 'magic', dmg: 24, cd: 1.1, range: 3.0, chain: 3, desc: '번개가 3번 튕깁니다' },
  { id: 'monk', tier: 2, name: '철퇴 승병', icon: '🔨', cat: 'blade', dmg: 38, cd: 1.1, range: 1.5, shred: 2, desc: '갑옷을 부숩니다 (방어 -2, 최대 5번)' },
  // ── 에픽 ──
  { id: 'flame', tier: 3, name: '화염 검객', icon: '🔥', cat: 'blade', dmg: 95, cd: 0.9, range: 1.7, splash: 1.2, burn: { dps: 30, dur: 3 }, desc: '불꽃 베기 + 화상' },
  { id: 'spear', tier: 3, name: '천둥 창술사', icon: '🌩️', cat: 'blade', dmg: 75, cd: 0.7, range: 2.0, chain: 4, desc: '창끝의 번개가 4번 튕깁니다' },
  { id: 'moon', tier: 3, name: '달빛 궁사', icon: '🌙', cat: 'bow', dmg: 60, cd: 0.6, range: 4.6, crit: { chance: 0.25, mult: 3 }, desc: '25% 확률로 3배 치명타' },
  { id: 'petal', tier: 3, name: '꽃잎 무녀', icon: '🌸', cat: 'magic', dmg: 45, cd: 1.0, range: 3.2, slow: { pct: 0.3, dur: 1.5 }, aura: { as: 0.25, r: 2.5 }, desc: '주변 아군 공격 속도 +25%' },
  { id: 'shadow', tier: 3, name: '그림자 닌자', icon: '🥷', cat: 'blade', dmg: 85, cd: 0.5, range: 1.6, execute: 0.12, desc: '체력 12% 이하 요괴를 즉사 (보스 제외)' },
  // ── 전설 ──
  { id: 'sun', tier: 4, name: '태양 검성', icon: '☀️', cat: 'blade', dmg: 340, cd: 0.8, range: 1.9, splash: 1.5, burn: { dps: 90, dur: 3 }, desc: '태양처럼 넓게 불태웁니다' },
  { id: 'storm', tier: 4, name: '폭풍 대궁', icon: '🌪️', cat: 'bow', dmg: 150, cd: 0.32, range: 5.0, multi: 3, desc: '한 번에 3마리 동시 사격' },
  { id: 'queen', tier: 4, name: '서리 여왕', icon: '🧊', cat: 'magic', dmg: 210, cd: 1.2, range: 3.6, splash: 1.5, slow: { pct: 0.55, dur: 2 }, stun: { chance: 0.1, dur: 1 }, desc: '넓게 얼리고 가끔 꽁꽁 묶습니다' },
  { id: 'thunder', tier: 4, name: '뇌신', icon: '⛈️', cat: 'magic', dmg: 260, cd: 1.0, range: 3.6, chain: 6, desc: '번개가 6번 튕깁니다' },
  // ── 신화 ──
  { id: 'emperor', tier: 5, name: '일월 검제', icon: '🗡️', cat: 'blade', dmg: 1150, cd: 0.6, range: 2.2, splash: 1.6, pierceArmor: true, desc: '해와 달의 검. 방어를 무시하는 광역 베기' },
  { id: 'fox', tier: 5, name: '구미호 무녀', icon: '🦊', cat: 'magic', dmg: 720, cd: 0.8, range: 4.0, chain: 5, burn: { dps: 200, dur: 3 }, aura: { dmg: 0.2, r: 3 }, desc: '여우불 연쇄 + 주변 아군 피해 +20%' },
  { id: 'bird', tier: 5, name: '천둥새', icon: '🦅', cat: 'bow', dmg: 620, cd: 0.26, range: 5.6, multi: 4, desc: '하늘의 왕. 4마리 동시 사격' },
];

/**
 * 영웅 — 소환·합성으로는 안 나오고 미션을 달성해 받은 「영웅 영입권」으로만 데려옴.
 * 처치할수록 레벨이 올라 강해짐 (최대 10). 사람마다 같은 영웅은 한 명씩.
 */
const HEROES = [
  { id: 'h_flame', tier: 6, hero: true, name: '불꽃의 검사 염호', icon: '🔥', cat: 'blade', dmg: 500, cd: 0.9, range: 1.9, splash: 1.5, burn: { dps: 160, dur: 3 }, desc: '불꽃 검무로 넓게 베고 태웁니다', look: { robe: '#d83818', haori: '#f8c030', hair: '#f8a020', fx: '#ff7a2a' } },
  { id: 'h_water', tier: 6, hero: true, name: '물결의 검사 수련', icon: '🌊', cat: 'blade', dmg: 270, cd: 0.5, range: 1.9, multi: 3, slow: { pct: 0.4, dur: 2 }, desc: '흐르는 물처럼 셋을 동시에 베고 느리게', look: { robe: '#183870', haori: '#3898e8', hair: '#101828', fx: '#58c8ff' } },
  { id: 'h_thunder', tier: 6, hero: true, name: '번개의 검사 뇌진', icon: '⚡', cat: 'blade', dmg: 340, cd: 0.32, range: 2.2, chain: 3, desc: '눈에 보이지 않는 속도의 번개 일섬', look: { robe: '#e8c020', haori: '#f8e870', hair: '#f8d830', fx: '#fff070' } },
  { id: 'h_wind', tier: 6, hero: true, name: '바람의 검사 풍운', icon: '🌪️', cat: 'blade', dmg: 320, cd: 0.6, range: 2.4, splash: 1.3, multi: 2, desc: '회오리 베기로 둘을 한꺼번에', look: { robe: '#20683a', haori: '#e8f0e8', hair: '#c8c8c8', fx: '#a8f8b8' } },
  { id: 'h_moth', tier: 6, hero: true, name: '독나비 술사 접화', icon: '🦋', cat: 'magic', dmg: 180, cd: 0.5, range: 3.6, poison: { dps: 420, dur: 4 }, execute: 0.1, desc: '맹독 나비. 약해진 요괴는 즉사 (보스 제외)', look: { robe: '#5a2878', haori: '#e8a8f8', hair: '#281838', fx: '#d878ff' } },
  { id: 'h_stone', tier: 6, hero: true, name: '바위의 승려 암철', icon: '🪨', cat: 'blade', dmg: 1040, cd: 1.4, range: 1.8, splash: 1.6, stun: { chance: 0.25, dur: 1 }, shred: 3, desc: '철퇴로 땅을 내려쳐 기절·방어 파괴', look: { robe: '#584838', haori: '#a89878', hair: '#201810', fx: '#d8b888' } },
  { id: 'h_sound', tier: 6, hero: true, name: '음률의 검사 향', icon: '🎵', cat: 'magic', dmg: 380, cd: 1.0, range: 3.0, splash: 1.8, aura: { as: 0.3, r: 3 }, desc: '폭음의 검. 주변 아군 공격 속도 +30%', look: { robe: '#383848', haori: '#f87898', hair: '#e8e8f8', fx: '#ff98c8' } },
  { id: 'h_moon', tier: 6, hero: true, name: '달그림자 궁수 월하', icon: '🌙', cat: 'bow', dmg: 660, cd: 0.8, range: 6.0, crit: { chance: 0.35, mult: 3 }, multi: 2, desc: '초승달 화살. 35% 확률로 3배 치명타', look: { robe: '#28204a', haori: '#9888e8', hair: '#d8d8f8', fx: '#c8b8ff' } },
];
UNITS.push(...HEROES);
const HERO_MAX_LV = 10;
/** 영웅 레벨 (처치 수로 성장) */
const heroLevel = (kills) => Math.min(HERO_MAX_LV, 1 + Math.floor(Math.sqrt(kills / 6)));
const HERO_LV_DMG = 0.12; // 레벨당 피해 +15%

/**
 * 미션 — 달성하면 「영웅 영입권」 1장. team: 둘 중 누가 해도 둘 다 달성
 * stat: 확인할 값 (game.js missionValue)
 */
const MISSIONS = [
  { id: 'kill1', name: '첫 사냥', icon: '🗡️', desc: '요괴 200마리 처치', stat: 'kills', goal: 200 },
  { id: 'boss', name: '보스 사냥꾼', icon: '👹', desc: '보스 2마리 처치 (함께)', stat: 'bosses', goal: 2, team: true },
  { id: 'legend', name: '전설의 시작', icon: '🌟', desc: '전설 등급 유닛 만들기', stat: 'bestTier', goal: 4 },
  { id: 'upg', name: '수련', icon: '⚒️', desc: '강화 합계 15단계', stat: 'upgSum', goal: 15 },
  { id: 'toad', name: '보물 사냥', icon: '🐸', desc: '보물 두꺼비 잡기 (함께)', stat: 'toads', goal: 1, team: true },
  { id: 'kill2', name: '백전노장', icon: '⚔️', desc: '요괴 700마리 처치', stat: 'kills', goal: 700 },
  { id: 'wave', name: '버텨라', icon: '🏯', desc: '25웨이브 도달 (함께)', stat: 'wave', goal: 25, team: true },
  { id: 'myth', name: '신화 탄생', icon: '🌈', desc: '신화 등급 유닛 만들기', stat: 'bestTier', goal: 5 },
];
const UNIT_MAP = Object.fromEntries(UNITS.map((u) => [u.id, u]));
const BY_TIER = {};
for (const u of UNITS) if (!u.hero) (BY_TIER[u.tier] ||= []).push(u.id);

/** 같은 유닛 몇 개로 합성하는지 (등급별) */
const MERGE_NEED = { 1: 3, 2: 3, 3: 3, 4: 2 };

const CATS = {
  blade: { name: '검술', icon: '⚔️', color: '#f87858' },
  bow: { name: '궁술', icon: '🏹', color: '#78d858' },
  magic: { name: '술법', icon: '🔮', color: '#78a8f8' },
};

/** 요괴 종류. speed: 칸/초, armor: 방어, hpMul: 체력 배수 */
const ENEMIES = {
  imp: { name: '졸개 도깨비', icon: '👹', speed: 1.1, armor: 0, hpMul: 1, gold: 1 },
  wisp: { name: '도깨비불', icon: '👻', speed: 1.9, armor: 0, hpMul: 0.6, gold: 1 },
  armor: { name: '갑옷 망령', icon: '💀', speed: 0.85, armor: 6, hpMul: 1.15, gold: 1 },
  slime: { name: '분열 점액', icon: '🟢', speed: 1.0, armor: 1, hpMul: 0.9, split: 2, gold: 1 },
  troll: { name: '재생 산귀', icon: '👺', speed: 0.9, armor: 2, hpMul: 1.4, regen: 0.03, gold: 2 },
  crow: { name: '까마귀 요괴', icon: '🐦‍⬛', speed: 1.4, armor: 1, hpMul: 0.8, flying: true, gold: 1 },
  spider: { name: '거미 요괴', icon: '🕷️', speed: 1.25, armor: 3, hpMul: 1.0, gold: 1 },
  snake: { name: '이무기 새끼', icon: '🐍', speed: 1.0, armor: 4, hpMul: 1.3, gold: 2 },
  chest: { name: '보물 두꺼비', icon: '🐸', speed: 1.6, armor: 2, hpMul: 3, gold: 0, treasure: true },
};
/** 웨이브 번호에 따라 나올 수 있는 요괴 */
const ENEMY_POOL = [
  { from: 1, id: 'imp' }, { from: 3, id: 'wisp' }, { from: 6, id: 'armor' }, { from: 8, id: 'slime' },
  { from: 12, id: 'crow' }, { from: 14, id: 'spider' }, { from: 17, id: 'troll' }, { from: 22, id: 'snake' },
];

/** 보스 (10·20·30·40 웨이브) + 중간 보스 (5단위) */
const BOSSES = [
  { wave: 10, id: 'b_ogre', name: '도깨비 대장', icon: '👹', speed: 0.7, armor: 4, hpMul: 26, ability: 'rage', desc: '체력이 절반 이하면 빨라집니다' },
  { wave: 20, id: 'b_centi', name: '거대 지네', icon: '🐛', speed: 0.65, armor: 8, hpMul: 24, ability: 'brood', desc: '주기적으로 새끼를 낳습니다' },
  { wave: 30, id: 'b_serpent', name: '구렁이 여왕', icon: '🐉', speed: 0.6, armor: 12, hpMul: 22, ability: 'heal', desc: '주기적으로 체력을 회복합니다' },
  { wave: 40, id: 'b_king', name: '요괴왕 흑염', icon: '😈', speed: 0.55, armor: 16, hpMul: 22, ability: 'all', desc: '마지막 보스. 분노·소환·회복을 모두 씁니다' },
];
const MINIBOSS = { name: '요괴 우두머리', icon: '👿', speed: 0.8, armor: 3, hpMul: 18 };

/** 웨이브 변이 (무작위) */
const MODIFIERS = [
  { id: 'fast', name: '질풍', icon: '💨', desc: '이동 속도 +35%' },
  { id: 'tough', name: '거구', icon: '💪', desc: '체력 +40%' },
  { id: 'regen', name: '재생', icon: '💚', desc: '초당 체력 2% 회복' },
  { id: 'iron', name: '강철', icon: '🛡️', desc: '방어 +5' },
  { id: 'swarm', name: '떼거리', icon: '🐜', desc: '수 1.6배, 체력 -35%' },
  { id: 'ghost', name: '유령', icon: '🌫️', desc: '20% 확률로 공격을 피함' },
];

/** 대장 (플레이어가 하나씩 고름) — 고유 능력 + 필살기 */
const LEADERS = [
  { id: 'sword', name: '검의 대장 무진', icon: '🗡️', color: '#f87858', passive: '검술 유닛 피해 +15%', skill: { name: '천검참', desc: '지정한 곳 큰 반경에 웨이브 비례 피해', cd: 45, target: true } },
  { id: 'archer', name: '사냥꾼 대장 하늘', icon: '🏹', color: '#78d858', passive: '궁술 유닛 사거리 +0.6, 피해 +10%', skill: { name: '화살비', desc: '지정한 곳에 5초 동안 화살비', cd: 50, target: true } },
  { id: 'priest', name: '무녀장 설화', icon: '⛩️', color: '#c898f8', passive: '소환 비용 -10%, 술법 피해 +10%', skill: { name: '봉인 결계', desc: '모든 요괴를 6초 동안 70% 느리게', cd: 60, target: false } },
  { id: 'merchant', name: '거상 금돌', icon: '💰', color: '#f8d058', passive: '웨이브 보너스 +50%, 판매가 +20%', skill: { name: '황금비', desc: '즉시 골드 + 10초 동안 처치 골드 3배', cd: 70, target: false } },
  { id: 'smith', name: '대장장이 철산', icon: '⚒️', color: '#a8b8c8', passive: '강화 비용 -25%', skill: { name: '불꽃 담금질', desc: '내 모든 유닛 8초 동안 공격 속도 +60%', cd: 55, target: false } },
  { id: 'gambler', name: '노름꾼 운수', icon: '🎲', color: '#58d8c8', passive: '소환 시 높은 등급이 나올 확률 2배', skill: { name: '운명의 주사위', desc: '무작위 유닛 하나를 한 등급 위로 (신화 제외)', cd: 80, target: false } },
];
const LEADER_MAP = Object.fromEntries(LEADERS.map((l) => [l.id, l]));

/** 보스를 잡을 때마다 고르는 축복 (각자 3개 중 1개) */
const BLESSINGS = [
  { id: 'gold', name: '복주머니', icon: '👛', desc: '즉시 골드 +300' },
  { id: 'blade', name: '날 선 검', icon: '⚔️', desc: '검술 피해 +20%' },
  { id: 'bow', name: '매의 눈', icon: '🦅', desc: '궁술 피해 +20%' },
  { id: 'magic', name: '깊은 주문', icon: '🔮', desc: '술법 피해 +20%' },
  { id: 'speed', name: '바쁜 손', icon: '✋', desc: '모든 유닛 공격 속도 +12%' },
  { id: 'cheap', name: '단골 할인', icon: '🏷️', desc: '소환 비용 -15%' },
  { id: 'luck', name: '네잎 클로버', icon: '🍀', desc: '높은 등급 소환 확률 증가' },
  { id: 'free', name: '공짜 소환', icon: '🎁', desc: '희귀 이상 유닛 2개 즉시 소환' },
  { id: 'income', name: '꾸준한 장사', icon: '📈', desc: '웨이브마다 골드 +40' },
  { id: 'crit', name: '급소 찌르기', icon: '🎯', desc: '모든 공격 10% 확률 2배 피해' },
  { id: 'range', name: '망루', icon: '🗼', desc: '모든 유닛 사거리 +0.4' },
  { id: 'cool', name: '명상', icon: '🧘', desc: '필살기 재사용 시간 -30%' },
];
const BLESS_MAP = Object.fromEntries(BLESSINGS.map((b) => [b.id, b]));

const DIFFICULTIES = [
  { id: 'easy', name: '쉬움', hp: 0.75, limit: 90, lives: 30, gold: 1.2 },
  { id: 'normal', name: '보통', hp: 1.2, limit: 75, lives: 20, gold: 1.0 },
  { id: 'hard', name: '어려움', hp: 1.9, limit: 65, lives: 15, gold: 0.95 },
  { id: 'hell', name: '지옥', hp: 2.8, limit: 55, lives: 10, gold: 0.9 },
];

const ECON = {
  startGold: 220,
  summonCost: 50,
  premiumCost: 180, // 고급 소환: 희귀 이상 보장
  sellRate: [0, 25, 70, 200, 520, 1200, 0],
  waveBonus: (w) => 50 + w * 6,
  upgradeCost: (lv) => 60 + lv * 45,
  upgradeStep: 0.12, // 강화 1단계마다 피해 +12%
  maxUpgrade: 30,
  maxUnits: 40,
};

/** 일반 소환 확률 [일반, 희귀, 에픽, 전설] */
const SUMMON_ODDS = [0.86, 0.12, 0.018, 0.002];
const PREMIUM_ODDS = [0, 0.82, 0.16, 0.02];

const WAVES = 40;
const WAVE_TIME = 28; // 웨이브 간격(초)
const BOSS_TIME = 100; // 순환 맵에서 보스를 잡아야 하는 시간(초)

module.exports = {
  TIERS, UNITS, UNIT_MAP, BY_TIER, MERGE_NEED, CATS, ENEMIES, ENEMY_POOL, BOSSES, MINIBOSS, MODIFIERS,
  HEROES, HERO_MAX_LV, heroLevel, HERO_LV_DMG, MISSIONS,
  LEADERS, LEADER_MAP, BLESSINGS, BLESS_MAP, DIFFICULTIES, ECON, SUMMON_ODDS, PREMIUM_ODDS, WAVES, WAVE_TIME, BOSS_TIME,
};
