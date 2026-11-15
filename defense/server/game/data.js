'use strict';
// 요괴 퇴마 디펜스 — 데이터 (유닛·요괴·대장·축복·난이도). 모든 캐릭터는 이 게임을 위해 새로 만든 것입니다.

/** 등급 */
const TIERS = [
  { id: 1, name: 'Lv1', color: '#c8c8d0' },
  { id: 2, name: 'Lv2', color: '#58c858' },
  { id: 3, name: 'Lv3', color: '#4a98f0' },
  { id: 4, name: 'H', color: '#e8b820' }, // 족보로만 (Lv1~Lv3 재료)
  { id: 5, name: 'LVX', color: '#e86818' }, // 족보로만 (Lv3 여럿 필요)
  { id: 6, name: '영웅', color: '#48f0d8' }, // 미션으로만 얻는 고유 유닛
  { id: 7, name: 'LVZ', color: '#ff3a4a' }, // 히든 족보 (스토리 재료 필요)
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
  { id: 'wave', tier: 2, name: '물의 호흡 검사', icon: '🌊', cat: 'blade', dmg: 34, cd: 0.8, range: 1.6, splash: 1.0, desc: '휘두르면 주변이 함께 베입니다' },
  { id: 'wind', tier: 2, name: '바람 궁수', icon: '🍃', cat: 'bow', dmg: 15, cd: 0.38, range: 3.8, desc: '아주 빠르게 연사' },
  { id: 'frost', tier: 2, name: '얼음 무녀', icon: '❄️', cat: 'magic', dmg: 20, cd: 1.0, range: 3.0, slow: { pct: 0.45, dur: 2 }, desc: '강하게 얼려 느리게 만듭니다' },
  { id: 'spark', tier: 2, name: '뇌전 술사', icon: '⚡', cat: 'magic', dmg: 24, cd: 1.1, range: 3.0, chain: 3, desc: '번개가 3번 튕깁니다' },
  { id: 'monk', tier: 2, name: '철퇴 승병', icon: '🔨', cat: 'blade', dmg: 38, cd: 1.1, range: 1.5, shred: 2, desc: '갑옷을 부숩니다 (방어 -2, 최대 5번)' },
  // ── 에픽 ──
  { id: 'flame', tier: 3, name: '불꽃의 호흡 검객', icon: '🔥', cat: 'blade', dmg: 95, cd: 0.9, range: 1.7, splash: 1.2, burn: { dps: 30, dur: 3 }, desc: '불꽃 베기 + 화상' },
  { id: 'spear', tier: 3, name: '번개의 호흡 창술사', icon: '🌩️', cat: 'blade', dmg: 75, cd: 0.7, range: 2.0, chain: 4, desc: '창끝의 번개가 4번 튕깁니다' },
  { id: 'moon', tier: 3, name: '달빛 궁사', icon: '🌙', cat: 'bow', dmg: 60, cd: 0.6, range: 4.6, crit: { chance: 0.25, mult: 3 }, desc: '25% 확률로 3배 치명타' },
  { id: 'petal', tier: 3, name: '꽃잎 무녀', icon: '🌸', cat: 'magic', dmg: 45, cd: 1.0, range: 3.2, slow: { pct: 0.3, dur: 1.5 }, aura: { as: 0.25, r: 2.5 }, desc: '주변 아군 공격 속도 +25%' },
  { id: 'shadow', tier: 3, name: '안개의 호흡 닌자', icon: '🥷', cat: 'blade', dmg: 85, cd: 0.5, range: 1.6, execute: 0.12, desc: '체력 12% 이하 요괴를 즉사 (보스 제외)' },
  // ── 전설 ──
  { id: 'sun', tier: 4, name: '해의 호흡 검성', icon: '☀️', cat: 'blade', dmg: 340, cd: 0.8, range: 1.9, splash: 1.5, burn: { dps: 90, dur: 3 }, desc: '태양처럼 넓게 불태웁니다' },
  { id: 'storm', tier: 4, name: '폭풍 대궁', icon: '🌪️', cat: 'bow', dmg: 150, cd: 0.32, range: 5.0, multi: 3, desc: '한 번에 3마리 동시 사격' },
  { id: 'queen', tier: 4, name: '서리 여왕', icon: '🧊', cat: 'magic', dmg: 210, cd: 1.2, range: 3.6, splash: 1.5, slow: { pct: 0.55, dur: 2 }, stun: { chance: 0.1, dur: 1 }, desc: '넓게 얼리고 가끔 꽁꽁 묶습니다' },
  { id: 'thunder', tier: 4, name: '뇌신', icon: '⛈️', cat: 'magic', dmg: 260, cd: 1.0, range: 3.6, chain: 6, desc: '번개가 6번 튕깁니다' },
  { id: 'blossom', tier: 4, name: '꽃의 호흡 검희', icon: '🌺', cat: 'blade', dmg: 230, cd: 0.6, range: 1.9, splash: 1.3, slow: { pct: 0.4, dur: 1.5 }, desc: '꽃잎처럼 흩날리는 베기, 맞으면 느려집니다', look: { robe: '#f8e8f0', haori: '#f878a8', hair: '#3a1020', fx: '#ff98c8' } },
  { id: 'serpent', tier: 4, name: '뱀의 호흡 검사', icon: '🐍', cat: 'blade', dmg: 260, cd: 0.55, range: 2.0, multi: 2, crit: { chance: 0.25, mult: 2.5 }, desc: '휘어지는 검으로 둘을 동시에, 치명타', look: { robe: '#202838', haori: '#a8d0a8', hair: '#101818', fx: '#b8ffb0' } },
  { id: 'beast', tier: 4, name: '짐승의 호흡 쌍검', icon: '🐗', cat: 'blade', dmg: 170, cd: 0.3, range: 1.7, chain: 2, desc: '거친 쌍검 연타, 옆으로 튑니다', look: { robe: '#3a2a18', haori: '#8a6a48', hair: '#1a1410', fx: '#ffd0a0' } },
  { id: 'dusk', tier: 4, name: '노을의 호흡 궁수', icon: '🌇', cat: 'bow', dmg: 240, cd: 0.55, range: 4.8, multi: 2, burn: { dps: 80, dur: 3 }, desc: '불붙은 화살을 둘에게', look: { robe: '#401818', haori: '#f88838', hair: '#f8d0a0', fx: '#ffa040' } },
  // ── 신화 ──
  { id: 'emperor', tier: 5, name: '일월의 호흡 검제', icon: '🗡️', cat: 'blade', dmg: 1150, cd: 0.6, range: 2.2, splash: 1.6, pierceArmor: true, desc: '해와 달의 검. 방어를 무시하는 광역 베기' },
  { id: 'fox', tier: 5, name: '구미호 무녀', icon: '🦊', cat: 'magic', dmg: 720, cd: 0.8, range: 4.0, chain: 5, burn: { dps: 200, dur: 3 }, aura: { dmg: 0.2, r: 3 }, desc: '여우불 연쇄 + 주변 아군 피해 +20%' },
  { id: 'bird', tier: 5, name: '천둥새', icon: '🦅', cat: 'bow', dmg: 620, cd: 0.26, range: 5.6, multi: 4, desc: '하늘의 왕. 4마리 동시 사격' },
  { id: 'sunlord', tier: 5, name: '일출의 호흡 검사', icon: '🌄', cat: 'blade', dmg: 1300, cd: 0.75, range: 2.0, splash: 2.0, burn: { dps: 260, dur: 3 }, desc: '떠오르는 해처럼 넓게 태우는 검', look: { robe: '#601818', haori: '#f8a020', hair: '#2a0808', fx: '#ffb030' } },
  { id: 'frostlord', tier: 5, name: '서리의 호흡 무녀', icon: '🌨️', cat: 'magic', dmg: 760, cd: 0.9, range: 4.0, chain: 4, slow: { pct: 0.6, dur: 2 }, stun: { chance: 0.15, dur: 1 }, desc: '얼음 연쇄로 묶어 버립니다', look: { robe: '#e0f0ff', haori: '#4898e8', hair: '#f0f8ff', fx: '#b0e8ff' } },
  { id: 'galestorm', tier: 5, name: '질풍의 호흡 대검', icon: '💨', cat: 'blade', dmg: 900, cd: 0.6, range: 2.3, multi: 3, splash: 1.0, desc: '바람을 가르는 대검, 셋을 동시에', look: { robe: '#1a3a2a', haori: '#d8f8e8', hair: '#a8b8b0', fx: '#c8fff0' } },
];

/**
 * 영웅 — 소환·합성으로는 안 나오고 미션을 달성해 받은 「영웅 영입권」으로만 데려옴.
 * 처치할수록 레벨이 올라 강해짐 (최대 10). 사람마다 같은 영웅은 한 명씩.
 */
const HEROES = [
  { id: 'h_flame', tier: 6, hero: true, name: '불꽃의 호흡 염호', icon: '🔥', cat: 'blade', dmg: 500, cd: 0.9, range: 1.9, splash: 1.5, burn: { dps: 160, dur: 3 }, desc: '불꽃 검무로 넓게 베고 태웁니다', look: { robe: '#d83818', haori: '#f8c030', hair: '#f8a020', fx: '#ff7a2a' } },
  { id: 'h_water', tier: 6, hero: true, name: '물의 호흡 수련', icon: '🌊', cat: 'blade', dmg: 270, cd: 0.5, range: 1.9, multi: 3, slow: { pct: 0.4, dur: 2 }, desc: '흐르는 물처럼 셋을 동시에 베고 느리게', look: { robe: '#183870', haori: '#3898e8', hair: '#101828', fx: '#58c8ff' } },
  { id: 'h_thunder', tier: 6, hero: true, name: '번개의 호흡 뇌진', icon: '⚡', cat: 'blade', dmg: 340, cd: 0.32, range: 2.2, chain: 3, desc: '눈에 보이지 않는 속도의 번개 일섬', look: { robe: '#e8c020', haori: '#f8e870', hair: '#f8d830', fx: '#fff070' } },
  { id: 'h_wind', tier: 6, hero: true, name: '바람의 호흡 풍운', icon: '🌪️', cat: 'blade', dmg: 320, cd: 0.6, range: 2.4, splash: 1.3, multi: 2, desc: '회오리 베기로 둘을 한꺼번에', look: { robe: '#20683a', haori: '#e8f0e8', hair: '#c8c8c8', fx: '#a8f8b8' } },
  { id: 'h_moth', tier: 6, hero: true, name: '나비의 호흡 접화', icon: '🦋', cat: 'magic', dmg: 180, cd: 0.5, range: 3.6, poison: { dps: 420, dur: 4 }, execute: 0.1, desc: '맹독 나비. 약해진 요괴는 즉사 (보스 제외)', look: { robe: '#5a2878', haori: '#e8a8f8', hair: '#281838', fx: '#d878ff' } },
  { id: 'h_stone', tier: 6, hero: true, name: '바위의 호흡 암철', icon: '🪨', cat: 'blade', dmg: 1040, cd: 1.4, range: 1.8, splash: 1.6, stun: { chance: 0.25, dur: 1 }, shred: 3, desc: '철퇴로 땅을 내려쳐 기절·방어 파괴', look: { robe: '#584838', haori: '#a89878', hair: '#201810', fx: '#d8b888' } },
  { id: 'h_sound', tier: 6, hero: true, name: '소리의 호흡 향', icon: '🎵', cat: 'magic', dmg: 380, cd: 1.0, range: 3.0, splash: 1.8, aura: { as: 0.3, r: 3 }, desc: '폭음의 검. 주변 아군 공격 속도 +30%', look: { robe: '#383848', haori: '#f87898', hair: '#e8e8f8', fx: '#ff98c8' } },
  { id: 'h_moon', tier: 6, hero: true, name: '달의 호흡 월하', icon: '🌙', cat: 'bow', dmg: 660, cd: 0.8, range: 6.0, crit: { chance: 0.35, mult: 3 }, multi: 2, desc: '초승달 화살. 35% 확률로 3배 치명타', look: { robe: '#28204a', haori: '#9888e8', hair: '#d8d8f8', fx: '#c8b8ff' } },
];
UNITS.push(...HEROES);

/** 히든 유닛 — 히든 조합으로만 만듦 (조합법은 처음엔 ??? 로 가려져 있음) */
const HIDDEN_UNITS = [
  { id: 'x_allstar', tier: 7, hidden: true, name: '전집중 수련생 다온', icon: '🎒', cat: 'blade', dmg: 170, cd: 0.45, range: 2.6, multi: 2, slow: { pct: 0.2, dur: 1 }, desc: '다섯 수련생의 기술을 모두 익힌 신동', look: { robe: '#384868', haori: '#f8f0d8', hair: '#3a2010', fx: '#ffe8a0' } },
  { id: 'x_crimson', tier: 7, hidden: true, name: '핏빛 달의 호흡 홍야', icon: '🩸', cat: 'blade', dmg: 1500, cd: 0.55, range: 2.2, splash: 1.6, execute: 0.15, burn: { dps: 300, dur: 3 }, desc: '붉은 달빛을 머금은 귀검. 약해진 요괴 즉사', look: { robe: '#401018', haori: '#e82838', hair: '#f8f0f0', fx: '#ff3050' } },
  { id: 'x_spider', tier: 7, hidden: true, name: '거미실 인형사 사요', icon: '🕸️', cat: 'magic', dmg: 600, cd: 0.7, range: 3.8, multi: 4, slow: { pct: 0.6, dur: 2 }, stun: { chance: 0.15, dur: 1 }, desc: '실로 넷을 묶어 꼼짝 못 하게', look: { robe: '#f0f0f8', haori: '#8878b8', hair: '#f8f8ff', fx: '#e0d8ff' } },
  { id: 'x_snow', tier: 7, hidden: true, name: '눈꽃의 호흡 은설', icon: '❄️', cat: 'blade', dmg: 1400, cd: 0.6, range: 2.2, splash: 1.8, slow: { pct: 0.6, dur: 2 }, stun: { chance: 0.2, dur: 1 }, desc: '눈꽃 검무로 넓게 얼립니다', look: { robe: '#e8f4ff', haori: '#88c8f8', hair: '#f8fcff', fx: '#c8f0ff' } },
  { id: 'x_inferno', tier: 7, hidden: true, name: '업화의 호흡 염제', icon: '☄️', cat: 'blade', dmg: 2200, cd: 0.8, range: 2.2, splash: 2.2, burn: { dps: 600, dur: 3 }, desc: '꺼지지 않는 불꽃으로 모든 것을 태웁니다', look: { robe: '#601008', haori: '#ff6a10', hair: '#ffd040', fx: '#ff8020' } },
  { id: 'x_abyss', tier: 7, hidden: true, name: '심연의 낚시꾼 해무', icon: '🎣', cat: 'bow', dmg: 1200, cd: 0.4, range: 6.0, multi: 3, shred: 3, desc: '심연에서 건져 올린 작살. 셋을 꿰뚫고 방어 파괴', look: { robe: '#0a2840', haori: '#28a8a8', hair: '#103040', fx: '#40f0e0' } },
  { id: 'x_shadowlord', tier: 7, hidden: true, name: '그림자의 호흡 무영', icon: '🌑', cat: 'blade', dmg: 1800, cd: 0.35, range: 2.2, chain: 3, execute: 0.2, pierceArmor: true, desc: '보이지 않는 검. 방어 무시 연쇄 베기', look: { robe: '#0a0a10', haori: '#302848', hair: '#000000', fx: '#a070ff' } },
  { id: 'x_dawn', tier: 7, hidden: true, name: '새벽의 호흡 효명', icon: '🌅', cat: 'magic', dmg: 4000, cd: 0.7, range: 5.0, chain: 6, burn: { dps: 1000, dur: 3 }, aura: { as: 0.3, dmg: 0.3, r: 3.5 }, pierceArmor: true, desc: '긴 밤을 끝내는 새벽빛. 주변 아군 공속·피해 +30%', look: { robe: '#f8f0e0', haori: '#ffb040', hair: '#fff8e0', fx: '#ffe070' } },
];
UNITS.push(...HIDDEN_UNITS);

/** 스토리 보스·이벤트에서 얻는 히든 조합 재료 */
const ITEMS = {
  moonshard: { name: '붉은 달 조각', icon: '🔴' },
  silk: { name: '거미 실타래', icon: '🧶' },
  ice: { name: '만년설 결정', icon: '💠' },
  ember: { name: '꺼지지 않는 불씨', icon: '🕯️' },
  pearl: { name: '심연의 진주', icon: '🦪' },
  shade: { name: '그림자 조각', icon: '🖤' },
  star: { name: '별의 파편', icon: '🌠' },
};

/**
 * 조합법 — 재료(내 유닛·재료 아이템)를 모으면 정해진 유닛이 나옴.
 * hidden: 처음엔 ??? 로 가려져 있고 누군가 만들면 공개 (hint만 보임)
 */
/**
 * 족보 — Lv1~Lv3 유닛(과 스토리 재료)을 개수만큼 모으면 정해진 유닛이 나옴.
 * H·LVX·LVZ 는 족보로만 만들 수 있음. hidden: 처음엔 ??? (힌트만)
 */
const RECIPES = [
  { id: 'r_wave', out: 'wave', need: ['novice', 'novice', 'talisman'] },
  { id: 'r_wind', out: 'wind', need: ['hunter', 'hunter', 'needle'] },
  { id: 'r_frost', out: 'frost', need: ['talisman', 'talisman', 'hunter'] },
  { id: 'r_spark', out: 'spark', need: ['powder', 'talisman', 'needle'] },
  { id: 'r_monk', out: 'monk', need: ['novice', 'powder', 'powder'] },
  { id: 'r_flame', out: 'flame', need: ['wave', 'monk', 'powder'] },
  { id: 'r_spear', out: 'spear', need: ['spark', 'monk', 'novice'] },
  { id: 'r_moon', out: 'moon', need: ['wind', 'wind', 'hunter'] },
  { id: 'r_petal', out: 'petal', need: ['frost', 'wind', 'talisman'] },
  { id: 'r_shadow', out: 'shadow', need: ['wave', 'needle', 'needle'] },
  { id: 'r_sun', out: 'sun', need: ['wave', 'wave', 'novice', 'novice', 'powder', 'powder'] },
  { id: 'r_storm', out: 'storm', need: ['wind', 'wind', 'hunter', 'hunter', 'needle', 'needle'] },
  { id: 'r_queen', out: 'queen', need: ['frost', 'frost', 'talisman', 'talisman', 'hunter', 'hunter'] },
  { id: 'r_thunder', out: 'thunder', need: ['spear', 'spark', 'powder', 'powder'] },
  { id: 'r_blossom', out: 'blossom', need: ['petal', 'frost', 'talisman', 'talisman'] },
  { id: 'r_serpent', out: 'serpent', need: ['shadow', 'wave', 'needle', 'needle'] },
  { id: 'r_beast', out: 'beast', need: ['flame', 'monk', 'novice', 'novice'] },
  { id: 'r_dusk', out: 'dusk', need: ['moon', 'wind', 'hunter', 'hunter'] },
  { id: 'r_emperor', out: 'emperor', need: ['flame', 'flame', 'shadow', 'wave', 'wave', 'novice', 'novice'] },
  { id: 'r_fox', out: 'fox', need: ['petal', 'petal', 'flame', 'frost', 'frost', 'talisman', 'talisman'] },
  { id: 'r_bird', out: 'bird', need: ['moon', 'moon', 'spear', 'wind', 'wind', 'hunter', 'hunter'] },
  { id: 'r_sunlord', out: 'sunlord', need: ['flame', 'flame', 'spear', 'monk', 'monk', 'powder', 'powder'] },
  { id: 'r_frostlord', out: 'frostlord', need: ['petal', 'spear', 'spear', 'spark', 'spark', 'needle', 'needle'] },
  { id: 'r_galestorm', out: 'galestorm', need: ['moon', 'shadow', 'shadow', 'wind', 'wind', 'novice', 'novice'] },
  { id: 'h_allstar', out: 'x_allstar', hidden: true, need: ['novice', 'hunter', 'talisman', 'powder', 'needle'], hint: '다섯 갈래 수련의 길이 하나로 모이면…' },
  { id: 'h_crimson', out: 'x_crimson', hidden: true, need: ['shadow', 'shadow', 'flame', 'wave', 'wave', '#moonshard'], hint: '그림자와 불꽃, 그리고 붉은 달의 밤 (보스 스토리 1장)' },
  { id: 'h_spider', out: 'x_spider', hidden: true, need: ['petal', 'petal', 'frost', 'frost', 'needle', 'needle', '#silk'], hint: '꽃잎과 독침을 거미줄로 엮으면… (2장)' },
  { id: 'h_snow', out: 'x_snow', hidden: true, need: ['petal', 'moon', 'moon', 'frost', 'frost', '#ice'], hint: '꽃과 달빛이 만년설을 만나면 (3장)' },
  { id: 'h_inferno', out: 'x_inferno', hidden: true, need: ['flame', 'flame', 'flame', 'monk', 'monk', 'powder', 'powder', '#ember'], hint: '세 불꽃에 꺼지지 않는 불씨를 더하면 (4장)' },
  { id: 'h_abyss', out: 'x_abyss', hidden: true, need: ['moon', 'moon', 'shadow', 'wave', 'wave', '#pearl'], hint: '달과 그림자가 심연에 닿으면 (5장)' },
  { id: 'h_shadowlord', out: 'x_shadowlord', hidden: true, need: ['shadow', 'shadow', 'shadow', 'spear', 'wave', 'wave', '#shade'], hint: '그림자 셋과 그림자의 조각 (6장)' },
  { id: 'h_dawn', out: 'x_dawn', hidden: true, need: ['flame', 'flame', 'moon', 'moon', 'petal', 'wind', 'wind', 'novice', 'novice', '#star'], hint: '해·달·꽃이 모이고 하늘의 별 조각이 떨어지면 (스토리 이벤트)' },
];
const RECIPE_MAP = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

/** 보스 스토리 — 각자 자기 보스방에서 도전 (이전 장을 깨야 다음 장) */
const STORY = [
  { id: 's1', ch: 1, wave: 4, title: '붉은 달의 밤', boss: '도깨비 장군 적귀', icon: '👹', model: 'b_ogre', hp: 390, armor: 3, item: 'moonshard', gold: 100,
    intro: '붉은 달이 뜬 밤, 마을 어귀 대숲에서 북소리가 울린다. "인간 따위가 내 길을 막느냐!" 도깨비 장군 적귀가 철퇴를 치켜든다.',
    outro: '적귀가 쓰러지며 손에 쥐고 있던 붉은 달 조각을 떨어뜨렸다. 조각은 아직도 희미하게 빛난다…' },
  { id: 's2', ch: 2, wave: 9, title: '안개 속 거미굴', boss: '거미 여왕 사라', icon: '🕷️', model: 'spider', hp: 600, armor: 5, item: 'silk', gold: 150,
    intro: '실종된 나무꾼들을 찾아 들어간 안개 숲. 사방에 하얀 실이 늘어져 있다. "어서 오렴… 내 인형이 되어 주겠니?"',
    outro: '거미 여왕이 사라진 자리에 질긴 은빛 실타래가 남았다. 나무꾼들은 무사히 마을로 돌아갔다.' },
  { id: 's3', ch: 3, wave: 14, title: '얼어붙은 사당', boss: '설녀 빙화', icon: '🧊', model: 'wisp', hp: 250, armor: 6, item: 'ice', gold: 200,
    intro: '한여름에 눈이 내리는 산사. 종소리 대신 차가운 웃음소리가 들린다. "이 겨울을 끝내고 싶다면 나를 녹여 보아라."',
    outro: '빙화가 녹아내리자 산사에 봄바람이 불었다. 제단 위에 녹지 않는 만년설 결정 하나가 남았다.' },
  { id: 's4', ch: 4, wave: 19, title: '불타는 다리', boss: '화염 귀신 염라귀', icon: '🔥', model: 'b_king', hp: 180, armor: 8, item: 'ember', gold: 250,
    intro: '강 건너 마을로 가는 유일한 다리가 불길에 휩싸였다. 불꽃 속에서 거대한 그림자가 걸어 나온다. "재가 되어라!"',
    outro: '불길이 잦아든 다리 위, 꺼지지 않는 작은 불씨가 반짝인다. 따뜻하지만 결코 꺼지지 않는다.' },
  { id: 's5', ch: 5, wave: 24, title: '심연의 늪', boss: '늪의 주인 흑린', icon: '🐉', model: 'b_serpent', hp: 90, armor: 10, item: 'pearl', gold: 325,
    intro: '검은 늪의 수면이 갈라지며 비늘 덮인 거대한 몸이 솟아오른다. "천 년을 잠들어 있었다. 너희가 나를 깨웠구나."',
    outro: '흑린이 늪 깊이 가라앉고, 물 위로 어둡게 빛나는 심연의 진주가 떠올랐다.' },
  { id: 's6', ch: 6, wave: 29, title: '그림자 무사', boss: '상현의 그림자 무사', icon: '🥷', model: 'armor', hp: 85, armor: 12, item: 'shade', gold: 400,
    intro: '달 없는 밤, 발소리 없이 다가오는 검사가 있다. "요괴왕님의 명이다. 퇴마사의 목을 거두러 왔다."',
    outro: '그림자 무사가 무릎을 꿇고 사라진다. "요괴왕의 성은… 새벽이 오기 전에…" 검은 조각 하나가 남았다.' },
];
const STORY_TIME = 90; // 보스방 제한 시간(초)
const STORY_COOLDOWN = 20; // 실패 뒤 다시 도전까지(초)

/** 스토리 이벤트 — 일정 웨이브에 열리는 공동 전장. 둘이 유닛을 보내 함께 잡음 */
const EVENTS = [
  { wave: 12, boss: '요괴 대장군 철귀', icon: '👺', model: 'mini', hp: 120, armor: 8,
    intro: '요괴들의 진군을 이끄는 대장군 철귀가 나타났다! 각자의 전장을 지키면서, 정예를 이벤트 전장으로 보내 함께 쓰러뜨리자!' },
  { wave: 24, boss: '하늘을 가르는 천둥지네', icon: '🐛', model: 'b_centi', hp: 150, armor: 12,
    intro: '하늘이 갈라지며 천둥을 두른 거대 지네가 내려온다. 둘의 힘을 모아야 한다!' },
  { wave: 36, boss: '요괴왕의 분신 흑염영', icon: '😈', model: 'b_king', hp: 180, armor: 16,
    intro: '요괴왕이 자신의 분신을 보냈다. 이 분신을 쓰러뜨리면 요괴왕의 힘이 약해진다!' },
];
const EVENT_TIME = 100;
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
  { id: 'boss', name: '보스 사냥꾼', icon: '👹', desc: '내 전장에서 보스 2마리 처치', stat: 'bosses', goal: 2 },
  { id: 'legend', name: 'H 등급', icon: '🌟', desc: 'H 등급 유닛 만들기 (족보)', stat: 'bestTier', goal: 4 },
  { id: 'upg', name: '수련', icon: '⚒️', desc: '강화 합계 15단계', stat: 'upgSum', goal: 15 },
  { id: 'toad', name: '보물 사냥', icon: '🐸', desc: '내 전장에서 보물 두꺼비 잡기', stat: 'toads', goal: 1 },
  { id: 'kill2', name: '백전노장', icon: '⚔️', desc: '요괴 700마리 처치', stat: 'kills', goal: 700 },
  { id: 'wave', name: '버텨라', icon: '🏯', desc: '25웨이브 도달 (함께)', stat: 'wave', goal: 25, team: true },
  { id: 'myth', name: 'LVX 등급', icon: '🌈', desc: 'LVX 등급 유닛 만들기 (족보)', stat: 'bestTier', goal: 5 },
];
const UNIT_MAP = Object.fromEntries(UNITS.map((u) => [u.id, u]));
const BY_TIER = {};
for (const u of UNITS) if (!u.hero && !u.hidden) (BY_TIER[u.tier] ||= []).push(u.id);

/** 같은 유닛 몇 개로 합성하는지 (등급별) */
/** 같은 유닛 3개 랜덤 합성은 Lv1→Lv2, Lv2→Lv3 까지만 (H 부터는 족보로) */
const MERGE_NEED = { 1: 3, 2: 3 };

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
  { wave: 40, id: 'b_king', name: '요괴왕 흑염', icon: '😈', speed: 0.55, armor: 16, hpMul: 8, ability: 'all', desc: '마지막 보스. 분노·소환·회복을 모두 씁니다' },
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
  { id: 'gold', name: '복주머니', icon: '👛', desc: '즉시 골드 +150' },
  { id: 'blade', name: '날 선 검', icon: '⚔️', desc: '검술 피해 +20%' },
  { id: 'bow', name: '매의 눈', icon: '🦅', desc: '궁술 피해 +20%' },
  { id: 'magic', name: '깊은 주문', icon: '🔮', desc: '술법 피해 +20%' },
  { id: 'speed', name: '바쁜 손', icon: '✋', desc: '모든 유닛 공격 속도 +12%' },
  { id: 'cheap', name: '단골 할인', icon: '🏷️', desc: '소환 비용 -15%' },
  { id: 'luck', name: '네잎 클로버', icon: '🍀', desc: '높은 등급 소환 확률 증가' },
  { id: 'free', name: '공짜 소환', icon: '🎁', desc: '희귀 이상 유닛 2개 즉시 소환' },
  { id: 'income', name: '꾸준한 장사', icon: '📈', desc: '웨이브마다 골드 +25' },
  { id: 'crit', name: '급소 찌르기', icon: '🎯', desc: '모든 공격 10% 확률 2배 피해' },
  { id: 'range', name: '망루', icon: '🗼', desc: '모든 유닛 사거리 +0.4' },
  { id: 'cool', name: '명상', icon: '🧘', desc: '필살기 재사용 시간 -30%' },
];
const BLESS_MAP = Object.fromEntries(BLESSINGS.map((b) => [b.id, b]));

const DIFFICULTIES = [
  // gold: 받는 돈 배율 · upg: 강화 비용 배율
  { id: 'easy', name: '쉬움', hp: 0.75, limit: 90, lives: 30, gold: 1.2, upg: 0.85 },
  { id: 'normal', name: '보통', hp: 1.2, limit: 75, lives: 20, gold: 1.0, upg: 1.0 },
  { id: 'hard', name: '어려움', hp: 1.42, limit: 65, lives: 15, gold: 0.85, upg: 1.15 },
  { id: 'hell', name: '지옥', hp: 1.9, limit: 55, lives: 10, gold: 0.75, upg: 1.3 },
];

const ECON = {
  startGold: 200, // 소환 4번
  summonCost: 50,
  premiumCost: 180, // 고급 소환: 희귀 이상 보장
  sellRate: [0, 15, 40, 100, 250, 600, 0, 0],
  // 수입은 소환 비용(50)에 맞춰 조금씩: 초반 라운드당 약 2번, 후반 3~4번
  waveBonus: (w) => 35 + Math.round(w * 1.5),
  upgradeCost: (lv) => 45 + lv * 30,
  upgradeStep: 0.12, // 강화 1단계마다 피해 +12%
  maxUpgrade: 30,
  maxUnits: 9999, // 사실상 제한 없음 (같은 유닛은 한 칸에 겹쳐 쌓임)
};

/** 일반 소환 확률 [일반, 희귀, 에픽, 전설] */
const SUMMON_ODDS = [0.86, 0.12, 0.02];
const PREMIUM_ODDS = [0, 0.8, 0.2];

const WAVES = 40;
const WAVE_TIME = 28; // 웨이브 간격(초)
const BOSS_TIME = 100; // 순환 맵에서 보스를 잡아야 하는 시간(초)

module.exports = {
  TIERS, UNITS, UNIT_MAP, BY_TIER, MERGE_NEED, CATS, ENEMIES, ENEMY_POOL, BOSSES, MINIBOSS, MODIFIERS,
  HIDDEN_UNITS, ITEMS, RECIPES, RECIPE_MAP, STORY, STORY_TIME, STORY_COOLDOWN, EVENTS, EVENT_TIME,
  HEROES, HERO_MAX_LV, heroLevel, HERO_LV_DMG, MISSIONS,
  LEADERS, LEADER_MAP, BLESSINGS, BLESS_MAP, DIFFICULTIES, ECON, SUMMON_ODDS, PREMIUM_ODDS, WAVES, WAVE_TIME, BOSS_TIME,
};
