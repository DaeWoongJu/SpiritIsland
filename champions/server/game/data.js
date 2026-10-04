'use strict';
/*
 * 히어로 챔피언스 — 게임 데이터
 * 규칙 구조(영웅/일상 모습, 자원 지불, 악당 단계, 계략과 위협, 조우 덱, 부스트, 측면(아스펙트))는
 * 「마블 챔피언스 카드게임」을 따르고, 영웅·악당·카드의 이름과 효과는 이 프로젝트에서 직접 만든 것입니다.
 */

const RES = ['energy', 'mental', 'physical', 'wild'];
const RES_NAMES = { energy: '에너지', mental: '정신', physical: '물리', wild: '만능' };
const RES_ICON = { energy: '⚡', mental: '🧠', physical: '💪', wild: '★' };
const ASPECTS = {
  aggression: { id: 'aggression', name: '분노', en: '공격', color: '#d8423a', desc: '강력한 공격 카드로 악당과 미니언을 빠르게 쓰러뜨려요.' },
  justice: { id: 'justice', name: '정의', en: '저지', color: '#e8b830', desc: '위협을 없애는 데 특화. 악당의 계략을 막아요.' },
  leadership: { id: 'leadership', name: '지휘', en: '아군', color: '#3a7ad8', desc: '여러 아군을 불러 함께 싸워요.' },
  protection: { id: 'protection', name: '수호', en: '방어', color: '#3aa85a', desc: '방어·회복으로 오래 버티며 동료를 지켜요.' },
};

// ── 효과 조각 ──
const fx = {
  dmg: (n, o = {}) => async (g, pid, ctx) => g.damage(pid, n, { attack: true, ...o }, ctx),
  thw: (n, o = {}) => async (g, pid) => g.thwart(pid, n, o),
  heal: (n) => async (g, pid) => g.heal(pid, n),
  draw: (n) => async (g, pid) => g.draw(pid, n),
};

// ───────────── 영웅 ─────────────
// 영웅 면: 저지(thw)·공격(atk)·방어(def)·체력(hp)·손패 수 / 일상 면: 회복(rec)·손패 수. 능력은 라운드마다 1번.
const HEROES = [
  { id: 'spark', name: '스파크 러너', icon: '⚡', color: '#f0c020', archetype: '번개처럼 빠른 질주자', hp: 10,
    hero: { thw: 2, atk: 2, def: 1, hand: 5, ability: { name: '번개 연타', text: '적 하나에게 피해 1.', effect: fx.dmg(1, { attack: false }) } },
    alter: { name: '한별', job: '대학생', rec: 3, hand: 6, ability: { name: '벼락치기', text: '카드 1장을 뽑습니다.', effect: fx.draw(1) } },
    lore: '실험실 사고로 번개의 힘을 얻은 대학생. 누구보다 빨리 달려가 시민을 구해요.' },
  { id: 'gear', name: '기어 나이트', icon: '🤖', color: '#c8503a', archetype: '강철 수트를 만든 발명가', hp: 9,
    hero: { thw: 1, atk: 1, def: 2, hand: 4, ability: { name: '분석 스캔', text: '아무 계략에서 위협 1 제거.', effect: fx.thw(1) } },
    alter: { name: '도윤 박사', job: '공학자', rec: 4, hand: 6, ability: { name: '설계 시간', text: '다음 카드 비용을 낼 때 자원 +1.', effect: async (g, pid) => g.bonus(pid, 1) } },
    lore: '스스로 만든 강철 수트로 싸우는 천재 공학자. 업그레이드를 붙일수록 강해져요.' },
  { id: 'titan', name: '마운틴 퀸', icon: '⛰', color: '#3aa86a', archetype: '산을 들어 올리는 괴력', hp: 14,
    hero: { thw: 1, atk: 3, def: 2, hand: 4, ability: { name: '땅울림', text: '미니언 하나에게 피해 1.', effect: fx.dmg(1, { attack: false, minionOnly: true }) } },
    alter: { name: '서윤', job: '변호사', rec: 3, hand: 5, ability: { name: '법정 변론', text: '아무 계략에서 위협 1 제거.', effect: fx.thw(1) } },
    lore: '평소엔 차분한 변호사, 변신하면 산처럼 거대하고 단단한 영웅.' },
  { id: 'star', name: '스타 블레이즈', icon: '🌟', color: '#e87830', archetype: '우주 에너지를 다루는 비행사', hp: 12,
    hero: { thw: 1, atk: 2, def: 1, hand: 5, ability: { name: '광자 흡수', text: '체력 1 회복, 카드 1장 뽑기.', effect: async (g, pid) => { g.heal(pid, 1); g.draw(pid, 1); } } },
    alter: { name: '은하', job: '공군 조종사', rec: 4, hand: 6, ability: { name: '비행 훈련', text: '카드 1장을 뽑습니다.', effect: fx.draw(1) } },
    lore: '우주 사고로 별의 에너지를 품게 된 조종사. 에너지(⚡) 자원으로 내면 더 강해지는 카드가 많아요.' },
  { id: 'fox', name: '섀도 폭스', icon: '🦊', color: '#7a4ad8', archetype: '그림자 속 닌자 탐정', hp: 11,
    hero: { thw: 2, atk: 2, def: 2, hand: 5, ability: { name: '그림자 은신', text: '강인함을 얻습니다 (다음 피해 1번 무효).', effect: async (g, pid) => g.toughSelf(pid) } },
    alter: { name: '여울', job: '신문 기자', rec: 2, hand: 6, ability: { name: '특종 취재', text: '아무 계략에서 위협 1 제거.', effect: fx.thw(1) } },
    lore: '낮에는 기자, 밤에는 그림자 속을 누비는 닌자. 기절·혼란으로 적을 무력하게 만들어요.' },
  { id: 'rune', name: '룬 위저드', icon: '🔮', color: '#3a8ad8', archetype: '고대 룬을 다루는 마법사', hp: 10,
    hero: { thw: 2, atk: 1, def: 1, hand: 5, ability: { name: '보호 결계', text: '아무 영웅에게 강인함을 줍니다.', effect: async (g, pid) => g.toughAny(pid) } },
    alter: { name: '현우', job: '고서점 주인', rec: 3, hand: 6, ability: { name: '고서 연구', text: '카드 1장을 뽑습니다.', effect: fx.draw(1) } },
    lore: '오래된 책에서 룬 마법을 깨친 서점 주인. 동료를 지키는 주문이 특기예요.' },
];

// ───────────── 플레이어 카드 ─────────────
// type: ally(아군) · event(이벤트) · upgrade(강화) · support(지원) · resource(자원)
// res: 이 카드를 버려 낼 때 주는 자원 종류, resN: 개수(자원 카드는 2)
const C = (o) => ({ resN: 1, ...o });
const PLAYER_CARDS = [
  // ── 기본 (누구나) ──
  C({ id: 'energy_cell', name: '에너지 셀', type: 'resource', aspect: 'basic', cost: 0, res: 'energy', resN: 2, text: '자원 카드: 비용을 낼 때 버리면 ⚡ 2개.' }),
  C({ id: 'genius', name: '천재의 영감', type: 'resource', aspect: 'basic', cost: 0, res: 'mental', resN: 2, text: '자원 카드: 비용을 낼 때 버리면 🧠 2개.' }),
  C({ id: 'strength', name: '초인적 근력', type: 'resource', aspect: 'basic', cost: 0, res: 'physical', resN: 2, text: '자원 카드: 비용을 낼 때 버리면 💪 2개.' }),
  C({ id: 'briefing', name: '작전 회의', type: 'event', aspect: 'basic', cost: 1, res: 'mental', text: '카드 2장을 뽑습니다.', effect: fx.draw(2) }),
  C({ id: 'citizen', name: '용감한 시민', type: 'ally', aspect: 'basic', cost: 2, res: 'physical', text: '아군.', ally: { thw: 1, atk: 1, hp: 2, cons: 1 } }),
  C({ id: 'first_aid', name: '응급 키트', type: 'event', aspect: 'basic', cost: 1, res: 'wild', text: '아무 영웅의 체력 3 회복.', effect: async (g, pid) => g.healAny(pid, 3) }),

  // ── 스파크 러너 전용 ──
  C({ id: 'flash_strike', name: '전광석화', type: 'event', aspect: 'spark', cost: 1, res: 'energy', form: 'hero', attack: true, text: '공격. 적 하나에게 피해 3.', effect: fx.dmg(3) }),
  C({ id: 'chain_lightning', name: '연쇄 번개', type: 'event', aspect: 'spark', cost: 2, res: 'energy', form: 'hero', attack: true, text: '공격. 적 둘에게 각각 피해 2.', effect: async (g, pid, ctx) => { await g.damage(pid, 2, { attack: true }, ctx); await g.damage(pid, 2, { attack: true }, ctx); } }),
  C({ id: 'charge_gloves', name: '충전 장갑', type: 'upgrade', aspect: 'spark', cost: 2, res: 'physical', text: '강화: 공격력 +1.', mods: { atk: 1 } }),
  C({ id: 'static_wall', name: '정전기 방벽', type: 'event', aspect: 'spark', cost: 1, res: 'energy', defense: true, text: '방어 이벤트: 이번 공격의 피해 -3.', effect: async (g, pid, ctx) => { if (ctx.attack) ctx.attack.reduce += 3; } }),
  C({ id: 'roommate', name: '룸메이트 지호', type: 'ally', aspect: 'spark', cost: 2, res: 'mental', text: '아군. 들어올 때 카드 1장을 뽑습니다.', ally: { thw: 1, atk: 1, hp: 2, cons: 1 }, effect: fx.draw(1) }),
  C({ id: 'lab_gear', name: '연구실 장비', type: 'support', aspect: 'spark', cost: 1, res: 'mental', text: '지원. 행동(소진): 카드 1장을 뽑습니다.', action: { name: '연구', exhaust: true, effect: fx.draw(1) } }),

  // ── 기어 나이트 전용 ──
  C({ id: 'rocket_boots', name: '로켓 부츠', type: 'upgrade', aspect: 'gear', cost: 1, res: 'energy', text: '강화: 저지력 +1.', mods: { thw: 1 } }),
  C({ id: 'repulsor', name: '리펄서 건틀릿', type: 'upgrade', aspect: 'gear', cost: 3, res: 'energy', text: '강화. 행동(소진, 영웅 모습): 적 하나에게 피해 3 (공격).', action: { name: '리펄서 발사', exhaust: true, form: 'hero', effect: fx.dmg(3) } }),
  C({ id: 'armor_plate', name: '강화 장갑판', type: 'upgrade', aspect: 'gear', cost: 2, res: 'physical', text: '강화: 방어력 +1, 최대 체력 +3.', mods: { def: 1, hp: 3 } }),
  C({ id: 'drone_buddy', name: '자율 드론', type: 'ally', aspect: 'gear', cost: 2, res: 'energy', text: '아군.', ally: { thw: 1, atk: 1, hp: 2, cons: 1 } }),
  C({ id: 'overload', name: '과부하 폭발', type: 'event', aspect: 'gear', cost: 2, res: 'energy', form: 'hero', attack: true, text: '공격. 적 하나에게 피해 4.', effect: fx.dmg(4) }),
  C({ id: 'workshop', name: '작업실', type: 'support', aspect: 'gear', cost: 1, res: 'mental', text: '지원. 행동(소진): 다음 카드 비용을 낼 때 자원 +1.', action: { name: '부품 조달', exhaust: true, effect: async (g, pid) => g.bonus(pid, 1) } }),

  // ── 마운틴 퀸 전용 ──
  C({ id: 'quake_smash', name: '지진 강타', type: 'event', aspect: 'titan', cost: 2, res: 'physical', form: 'hero', attack: true, text: '공격. 적 하나에게 피해 5.', effect: fx.dmg(5) }),
  C({ id: 'bare_block', name: '맨손 방어', type: 'event', aspect: 'titan', cost: 1, res: 'physical', defense: true, text: '방어 이벤트: 이번 공격의 피해 -4.', effect: async (g, pid, ctx) => { if (ctx.attack) ctx.attack.reduce += 4; } }),
  C({ id: 'stone_skin', name: '바위 피부', type: 'upgrade', aspect: 'titan', cost: 2, res: 'physical', text: '강화: 최대 체력 +4.', mods: { hp: 4 } }),
  C({ id: 'law_partner', name: '로펌 동료 민재', type: 'ally', aspect: 'titan', cost: 2, res: 'mental', text: '아군 (저지 특기).', ally: { thw: 2, atk: 0, hp: 2, cons: 1 } }),
  C({ id: 'rage_burst', name: '분노 폭발', type: 'event', aspect: 'titan', cost: 1, res: 'physical', form: 'hero', attack: true, text: '공격. 적 하나에게 피해 3.', effect: fx.dmg(3) }),
  C({ id: 'gym', name: '체육관', type: 'support', aspect: 'titan', cost: 1, res: 'physical', text: '지원. 행동(소진): 내 영웅 체력 2 회복.', action: { name: '훈련', exhaust: true, effect: fx.heal(2) } }),

  // ── 스타 블레이즈 전용 ──
  C({ id: 'photon_beam', name: '광자 빔', type: 'event', aspect: 'star', cost: 1, res: 'energy', form: 'hero', attack: true, text: '공격. 적 하나에게 피해 2. ⚡로 냈다면 피해 +2.', effect: async (g, pid, ctx) => g.damage(pid, 2 + (ctx.paid && ctx.paid.energy ? 2 : 0), { attack: true }, ctx) }),
  C({ id: 'cosmic_flight', name: '우주 비행', type: 'event', aspect: 'star', cost: 0, res: 'energy', form: 'hero', text: '내 영웅을 준비시킵니다 (소진 해제).', effect: async (g, pid) => g.readyHero(pid) }),
  C({ id: 'absorb', name: '에너지 흡수', type: 'event', aspect: 'star', cost: 1, res: 'energy', text: '내 영웅 체력 3 회복. ⚡로 냈다면 카드 1장 뽑기.', effect: async (g, pid, ctx) => { g.heal(pid, 3); if (ctx.paid && ctx.paid.energy) g.draw(pid, 1); } }),
  C({ id: 'star_armor', name: '별빛 갑주', type: 'upgrade', aspect: 'star', cost: 3, res: 'energy', text: '강화: 공격력 +1, 방어력 +1.', mods: { atk: 1, def: 1 } }),
  C({ id: 'wingmate', name: '편대장 하윤', type: 'ally', aspect: 'star', cost: 3, res: 'physical', text: '아군 (공격 특기).', ally: { thw: 1, atk: 2, hp: 3, cons: 1 } }),
  C({ id: 'orbital', name: '궤도 정거장', type: 'support', aspect: 'star', cost: 2, res: 'mental', text: '지원. 행동(소진): 적 하나에게 피해 1.', action: { name: '궤도 포격', exhaust: true, effect: fx.dmg(1, { attack: false }) } }),

  // ── 섀도 폭스 전용 ──
  C({ id: 'shadow_strike', name: '그림자 일격', type: 'event', aspect: 'fox', cost: 1, res: 'physical', form: 'hero', attack: true, text: '공격. 적 하나에게 피해 2, 그 적을 기절시킵니다.', effect: async (g, pid, ctx) => { const t = await g.damage(pid, 2, { attack: true }, ctx); if (t) g.applyStatus(t, 'stunned'); } }),
  C({ id: 'smoke_bomb', name: '연막탄', type: 'event', aspect: 'fox', cost: 1, res: 'mental', text: '적 하나를 혼란시키고, 위협 1 제거.', effect: async (g, pid) => { await g.statusEnemy(pid, 'confused'); await g.thwart(pid, 1); } }),
  C({ id: 'shuriken', name: '표창 주머니', type: 'upgrade', aspect: 'fox', cost: 1, res: 'physical', text: '강화 (사용 3번). 행동: 적 하나에게 피해 1.', action: { name: '표창 던지기', uses: 3, effect: fx.dmg(1, { attack: false }) } }),
  C({ id: 'informant', name: '정보원 강철', type: 'ally', aspect: 'fox', cost: 2, res: 'mental', text: '아군 (저지 특기).', ally: { thw: 2, atk: 1, hp: 2, cons: 1 } }),
  C({ id: 'infiltrate', name: '은밀한 침투', type: 'event', aspect: 'fox', cost: 2, res: 'mental', text: '아무 계략에서 위협 4 제거.', effect: fx.thw(4) }),
  C({ id: 'dojo', name: '닌자 도장', type: 'support', aspect: 'fox', cost: 1, res: 'physical', text: '지원. 행동(소진): 강인함을 얻습니다.', action: { name: '명상', exhaust: true, effect: async (g, pid) => g.toughSelf(pid) } }),

  // ── 룬 위저드 전용 ──
  C({ id: 'seal_rune', name: '봉인의 룬', type: 'event', aspect: 'rune', cost: 2, res: 'mental', text: '적 하나를 기절시키고 혼란시킵니다.', effect: async (g, pid) => { const t = await g.statusEnemy(pid, 'stunned'); if (t) g.applyStatus(t, 'confused'); } }),
  C({ id: 'fire_spell', name: '화염 주문', type: 'event', aspect: 'rune', cost: 2, res: 'energy', form: 'hero', attack: true, text: '공격. 적 둘에게 각각 피해 2.', effect: async (g, pid, ctx) => { await g.damage(pid, 2, { attack: true }, ctx); await g.damage(pid, 2, { attack: true }, ctx); } }),
  C({ id: 'portal', name: '차원의 문', type: 'event', aspect: 'rune', cost: 1, res: 'mental', text: '아무 계략에서 위협 3 제거.', effect: fx.thw(3) }),
  C({ id: 'mystic_cloak', name: '마법 망토', type: 'upgrade', aspect: 'rune', cost: 2, res: 'mental', text: '강화: 방어력 +1, 저지력 +1.', mods: { def: 1, thw: 1 } }),
  C({ id: 'apprentice', name: '견습생 소라', type: 'ally', aspect: 'rune', cost: 2, res: 'mental', text: '아군. 들어올 때 카드 1장을 뽑습니다.', ally: { thw: 1, atk: 1, hp: 2, cons: 1 }, effect: fx.draw(1) }),
  C({ id: 'sanctum', name: '성소', type: 'support', aspect: 'rune', cost: 1, res: 'energy', text: '지원. 행동(소진): 아무 영웅의 체력 1 회복.', action: { name: '치유의 빛', exhaust: true, effect: async (g, pid) => g.healAny(pid, 1) } }),

  // ── 분노 (공격) ──
  C({ id: 'assault', name: '맹공', type: 'event', aspect: 'aggression', cost: 1, res: 'physical', form: 'hero', attack: true, text: '공격. 적 하나에게 피해 3.', effect: fx.dmg(3) }),
  C({ id: 'brutal', name: '무자비한 일격', type: 'event', aspect: 'aggression', cost: 2, res: 'physical', form: 'hero', attack: true, text: '공격. 적 하나에게 피해 4.', effect: fx.dmg(4) }),
  C({ id: 'berserk', name: '광폭화', type: 'upgrade', aspect: 'aggression', cost: 2, res: 'energy', text: '강화: 공격력 +1.', mods: { atk: 1 } }),
  C({ id: 'merc', name: '전투광 용병 칼', type: 'ally', aspect: 'aggression', cost: 3, res: 'physical', text: '아군 (공격 특기).', ally: { thw: 0, atk: 3, hp: 3, cons: 1 } }),
  C({ id: 'charge', name: '돌진', type: 'event', aspect: 'aggression', cost: 3, res: 'physical', form: 'hero', attack: true, text: '공격. 적 하나에게 피해 6.', effect: fx.dmg(6) }),
  C({ id: 'sweep', name: '휩쓸기', type: 'event', aspect: 'aggression', cost: 2, res: 'energy', form: 'hero', text: '모든 미니언에게 피해 1, 악당에게 피해 1.', effect: async (g, pid) => { g.damageAllMinions(1, pid); g.damageVillain(1, pid); } }),
  C({ id: 'fighting_spirit', name: '투지', type: 'event', aspect: 'aggression', cost: 0, res: 'wild', form: 'hero', text: '내 영웅을 준비시킵니다.', effect: async (g, pid) => g.readyHero(pid) }),
  C({ id: 'training_ground', name: '훈련장', type: 'support', aspect: 'aggression', cost: 2, res: 'physical', text: '지원. 행동(소진): 적 하나에게 피해 1.', action: { name: '사격 훈련', exhaust: true, effect: fx.dmg(1, { attack: false }) } }),
  C({ id: 'brawler', name: '격투가 레나', type: 'ally', aspect: 'aggression', cost: 2, res: 'energy', text: '아군.', ally: { thw: 1, atk: 2, hp: 2, cons: 1 } }),
  C({ id: 'finisher', name: '필살기', type: 'event', aspect: 'aggression', cost: 2, res: 'energy', form: 'hero', attack: true, text: '공격. 미니언 하나를 처치합니다.', effect: async (g, pid, ctx) => g.damage(pid, 99, { attack: true, minionOnly: true }, ctx) }),

  // ── 정의 (저지) ──
  C({ id: 'investigate', name: '수사', type: 'event', aspect: 'justice', cost: 1, res: 'mental', text: '아무 계략에서 위협 3 제거.', effect: fx.thw(3) }),
  C({ id: 'arrest', name: '체포', type: 'event', aspect: 'justice', cost: 2, res: 'mental', text: '위협 2 제거, 적 하나를 혼란시킵니다.', effect: async (g, pid) => { await g.thwart(pid, 2); await g.statusEnemy(pid, 'confused'); } }),
  C({ id: 'sense_justice', name: '정의감', type: 'upgrade', aspect: 'justice', cost: 2, res: 'energy', text: '강화: 저지력 +1.', mods: { thw: 1 } }),
  C({ id: 'detective', name: '형사 마루', type: 'ally', aspect: 'justice', cost: 2, res: 'mental', text: '아군 (저지 특기).', ally: { thw: 2, atk: 1, hp: 2, cons: 1 } }),
  C({ id: 'stakeout', name: '잠복 수사', type: 'event', aspect: 'justice', cost: 2, res: 'mental', text: '아무 계략에서 위협 5 제거.', effect: fx.thw(5) }),
  C({ id: 'rally_citizens', name: '시민의 함성', type: 'event', aspect: 'justice', cost: 1, res: 'energy', text: '모든 계략에서 위협 1씩 제거.', effect: async (g, pid) => g.thwartEach(pid, 1) }),
  C({ id: 'evidence', name: '증거 보관소', type: 'support', aspect: 'justice', cost: 1, res: 'mental', text: '지원. 행동(소진): 위협 1 제거.', action: { name: '증거 분석', exhaust: true, effect: fx.thw(1) } }),
  C({ id: 'lawyers', name: '정의의 변호인단', type: 'ally', aspect: 'justice', cost: 3, res: 'mental', text: '아군 (저지 특기).', ally: { thw: 3, atk: 0, hp: 3, cons: 1 } }),
  C({ id: 'smoking_gun', name: '결정적 증거', type: 'event', aspect: 'justice', cost: 3, res: 'wild', text: '주 계략에서 위협 6 제거.', effect: fx.thw(6, { mainOnly: true }) }),
  C({ id: 'vigilance', name: '경계 태세', type: 'event', aspect: 'justice', cost: 0, res: 'energy', text: '위협 1 제거, 카드 1장 뽑기.', effect: async (g, pid) => { await g.thwart(pid, 1); g.draw(pid, 1); } }),

  // ── 지휘 (아군) ──
  C({ id: 'rally', name: '집결 신호', type: 'event', aspect: 'leadership', cost: 1, res: 'energy', text: '내 아군을 모두 준비시킵니다.', effect: async (g, pid) => g.readyAllies(pid) }),
  C({ id: 'teamwork', name: '팀워크', type: 'event', aspect: 'leadership', cost: 1, res: 'mental', text: '카드 2장을 뽑습니다.', effect: fx.draw(2) }),
  C({ id: 'veteran', name: '베테랑 요원 진', type: 'ally', aspect: 'leadership', cost: 3, res: 'physical', text: '아군.', ally: { thw: 2, atk: 2, hp: 3, cons: 1 } }),
  C({ id: 'rookie', name: '신참 히어로 빈', type: 'ally', aspect: 'leadership', cost: 1, res: 'energy', text: '아군.', ally: { thw: 1, atk: 1, hp: 1, cons: 1 } }),
  C({ id: 'command', name: '작전 지휘', type: 'upgrade', aspect: 'leadership', cost: 2, res: 'mental', text: '강화: 내 아군의 공격력·저지력 +1.', mods: { allyAtk: 1, allyThw: 1 } }),
  C({ id: 'rescue_team', name: '구조대', type: 'ally', aspect: 'leadership', cost: 2, res: 'mental', text: '아군. 들어올 때 내 영웅 체력 1 회복.', ally: { thw: 1, atk: 1, hp: 3, cons: 1 }, effect: fx.heal(1) }),
  C({ id: 'hq_link', name: '본부 통신망', type: 'support', aspect: 'leadership', cost: 2, res: 'mental', text: '지원. 행동(소진): 내 아군 하나를 준비시킵니다.', action: { name: '지원 요청', exhaust: true, effect: async (g, pid) => g.readyAlly(pid) } }),
  C({ id: 'return_hero', name: '영웅의 귀환', type: 'event', aspect: 'leadership', cost: 1, res: 'wild', text: '버린 더미의 아군 1장을 손으로 가져옵니다.', effect: async (g, pid) => g.returnAlly(pid) }),
  C({ id: 'all_out', name: '총공격', type: 'event', aspect: 'leadership', cost: 2, res: 'physical', text: '내 아군 하나당 악당에게 피해 1.', effect: async (g, pid) => g.damageVillain(g.allies(pid).length, pid) }),
  C({ id: 'commander', name: '지휘관 레아', type: 'ally', aspect: 'leadership', cost: 4, res: 'energy', text: '아군 (강함).', ally: { thw: 2, atk: 3, hp: 4, cons: 1 } }),

  // ── 수호 (방어) ──
  C({ id: 'shield_block', name: '방패 막기', type: 'event', aspect: 'protection', cost: 1, res: 'physical', defense: true, text: '방어 이벤트: 이번 공격의 피해 -3.', effect: async (g, pid, ctx) => { if (ctx.attack) ctx.attack.reduce += 3; } }),
  C({ id: 'counter', name: '받아치기', type: 'event', aspect: 'protection', cost: 1, res: 'energy', defense: true, text: '방어 이벤트: 이번 공격의 피해 -2, 공격한 적에게 피해 2.', effect: async (g, pid, ctx) => { if (ctx.attack) { ctx.attack.reduce += 2; g.dealTo(ctx.attack.attacker, 2, pid); } } }),
  C({ id: 'iron_will', name: '강철 의지', type: 'upgrade', aspect: 'protection', cost: 2, res: 'physical', text: '강화: 방어력 +1.', mods: { def: 1 } }),
  C({ id: 'barrier', name: '보호막', type: 'event', aspect: 'protection', cost: 1, res: 'energy', text: '아무 영웅에게 강인함을 줍니다.', effect: async (g, pid) => g.toughAny(pid) }),
  C({ id: 'medic', name: '응급 처치', type: 'event', aspect: 'protection', cost: 1, res: 'mental', text: '아무 영웅의 체력 4 회복.', effect: async (g, pid) => g.healAny(pid, 4) }),
  C({ id: 'bear', name: '든든한 동료 곰', type: 'ally', aspect: 'protection', cost: 3, res: 'physical', text: '아군 (튼튼함).', ally: { thw: 1, atk: 1, hp: 5, cons: 1 } }),
  C({ id: 'vest', name: '방탄 조끼', type: 'upgrade', aspect: 'protection', cost: 2, res: 'physical', text: '강화: 최대 체력 +3.', mods: { hp: 3 } }),
  C({ id: 'infirmary', name: '의료실', type: 'support', aspect: 'protection', cost: 2, res: 'mental', text: '지원. 행동(소진): 아무 영웅의 체력 2 회복.', action: { name: '치료', exhaust: true, effect: async (g, pid) => g.healAny(pid, 2) } }),
  C({ id: 'full_guard', name: '철벽 방어', type: 'event', aspect: 'protection', cost: 2, res: 'physical', defense: true, text: '방어 이벤트: 이번 공격의 피해를 모두 막습니다.', effect: async (g, pid, ctx) => { if (ctx.attack) ctx.attack.reduce += 99; } }),
  C({ id: 'reflex', name: '반사 신경', type: 'event', aspect: 'protection', cost: 0, res: 'energy', defense: true, text: '방어 이벤트: 이번 공격의 피해 -1, 카드 1장 뽑기.', effect: async (g, pid, ctx) => { if (ctx.attack) ctx.attack.reduce += 1; g.draw(pid, 1); } }),
];
const CARD_MAP = Object.fromEntries(PLAYER_CARDS.map((c) => [c.id, c]));

/** 영웅 + 측면으로 덱 30장 자동 구성 */
function buildDeck(heroId, aspect) {
  const sig = PLAYER_CARDS.filter((c) => c.aspect === heroId);
  const asp = PLAYER_CARDS.filter((c) => c.aspect === aspect);
  const deck = [];
  // 전용 6종: 공격·이벤트는 2장씩, 나머지 1장 (총 10장 내외)
  for (const c of sig) { deck.push(c.id); if (c.type === 'event' || c.type === 'ally') deck.push(c.id); }
  // 측면 10종 + 자주 쓰는 이벤트 한 장씩 더
  for (const c of asp) deck.push(c.id);
  for (const c of asp.filter((x) => x.type === 'event').slice(0, 4)) deck.push(c.id);
  // 기본: 자원 카드 + 기본 카드
  deck.push('energy_cell', 'genius', 'strength', 'briefing', 'citizen', 'first_aid');
  // 30장이 안 되면 전용 카드를 한 장씩 더 (중복이 적은 것부터)
  for (let i = 0; deck.length < 30 && i < sig.length * 2; i++) { const c = sig[i % sig.length]; if (deck.filter((x) => x === c.id).length < 2) deck.push(c.id); }
  while (deck.length > 30) deck.pop();
  return deck;
}

// ───────────── 조우 카드 (악당 쪽) ─────────────
// type: minion(미니언) · treachery(배신) · side(부가 계략) · attachment(부착)
// boost: 악당이 공격·계략할 때 이 카드를 부스트로 뒤집으면 더하는 수
const E = (o) => ({ boost: 1, ...o });
const ENCOUNTER = [
  // ── 공통 (표준 세트) ──
  E({ id: 'thug', name: '거리의 깡패', type: 'minion', sch: 1, atk: 1, hp: 3, text: '미니언.', boost: 1 }),
  E({ id: 'guard', name: '무장 경비병', type: 'minion', sch: 0, atk: 2, hp: 4, guard: true, text: '미니언. 경비: 이 미니언과 교전 중이면 악당을 공격할 수 없어요.', boost: 1 }),
  E({ id: 'hacker', name: '해커 요원', type: 'minion', sch: 2, atk: 0, hp: 2, text: '미니언. 들어올 때 주 계략 위협 +1.', boost: 1, onEnter: (g) => g.addThreat(1, '해커 요원') }),
  E({ id: 'ambush', name: '기습', type: 'treachery', boost: 1, text: '악당이 당신에게 활성화합니다 (영웅이면 공격, 일상이면 계략).', reveal: async (g, pid) => g.villainActivate(pid, '기습') }),
  E({ id: 'dark_plot', name: '어둠의 음모', type: 'treachery', boost: 1, text: '주 계략에 위협 +1(플레이어당). 일상 모습이면 +1 더.', reveal: async (g, pid) => g.addThreat(g.nPlayers() + (g.form(pid) === 'alter' ? 1 : 0), '어둠의 음모') }),
  E({ id: 'reinforce', name: '증원 요청', type: 'treachery', boost: 0, surge: true, text: '거리의 깡패 1명이 당신과 교전합니다 (없으면 효과 없음). 쇄도: 조우 카드 1장 더.', reveal: async (g, pid) => g.summon(pid, 'thug') }),
  E({ id: 'hostages', name: '인질 사태', type: 'side', threat: 2, perPlayer: true, hazard: 1, boost: 1, text: '부가 계략. 위험: 악당 단계마다 조우 카드 +1장.' }),
  E({ id: 'bomb', name: '시한폭탄 설치', type: 'side', threat: 3, perPlayer: false, accel: 1, boost: 1, text: '부가 계략. 가속: 악당 단계마다 주 계략 위협 +1.' }),
  E({ id: 'gear_up', name: '강화 장비', type: 'attachment', boost: 1, mods: { atk: 1 }, text: '부착: 악당 공격력 +1.' }),
  E({ id: 'exhaust_trick', name: '함정', type: 'treachery', boost: 1, text: '영웅 모습이면 내 영웅이 소진됩니다. 일상 모습이면 카드 1장을 버립니다.', reveal: async (g, pid) => { if (g.form(pid) === 'hero') g.exhaustHero(pid); else g.discardRandom(pid, 1); } }),

  // ── 강철 들소 브루트 ──
  E({ id: 'brute_goon', name: '들소단 부하', type: 'minion', set: 'brute', sch: 1, atk: 2, hp: 3, text: '미니언.', boost: 1 }),
  E({ id: 'brute_charge', name: '들소 돌격', type: 'treachery', set: 'brute', boost: 1, text: '영웅 모습이면 브루트가 공격력 +1로 당신을 공격합니다. 일상이면 위협 +2.', reveal: async (g, pid) => { if (g.form(pid) === 'hero') await g.villainAttack(pid, { bonus: 1, label: '들소 돌격' }); else g.addThreat(2, '들소 돌격'); } }),
  E({ id: 'brute_armor', name: '철갑 뿔', type: 'attachment', set: 'brute', boost: 1, mods: { atk: 1 }, tough: true, text: '부착: 악당 공격력 +1, 악당이 강인함을 얻습니다.' }),
  E({ id: 'collapse', name: '건물 붕괴 위기', type: 'side', set: 'brute', threat: 3, perPlayer: false, crisis: true, boost: 1, text: '부가 계략. 위기: 이 계략이 있는 동안 주 계략에서 위협을 제거할 수 없어요.' }),
  E({ id: 'stampede', name: '무자비한 질주', type: 'treachery', set: 'brute', boost: 1, text: '모든 영웅이 피해 1을 받습니다.', reveal: async (g) => g.damageAllHeroes(1, '무자비한 질주') }),

  // ── 음파 마왕 소닉스 ──
  E({ id: 'sonic_beast', name: '음파 괴수', type: 'minion', set: 'sonix', sch: 1, atk: 2, hp: 4, retaliate: 1, text: '미니언. 반격 1: 이 미니언을 공격하면 공격자가 피해 1.', boost: 1 }),
  E({ id: 'noise_soldier', name: '소음 병사', type: 'minion', set: 'sonix', sch: 1, atk: 1, hp: 2, text: '미니언.', boost: 1 }),
  E({ id: 'eardrum', name: '고막 파열', type: 'treachery', set: 'sonix', boost: 1, text: '내 영웅이 기절합니다 (다음 기본 공격 무효). 이미 기절이면 피해 2.', reveal: async (g, pid) => g.statusHero(pid, 'stunned', 2) }),
  E({ id: 'sonic_storm', name: '음파 폭풍', type: 'treachery', set: 'sonix', boost: 1, text: '모든 플레이어가 손패에서 무작위로 1장씩 버립니다.', reveal: async (g) => { for (const p of g.alive()) g.discardRandom(p, 1); } }),
  E({ id: 'amplifier', name: '증폭 장치', type: 'side', set: 'sonix', threat: 2, perPlayer: true, accel: 1, boost: 1, text: '부가 계략. 가속: 악당 단계마다 주 계략 위협 +1.' }),
  E({ id: 'resonance', name: '공명 갑옷', type: 'attachment', set: 'sonix', boost: 1, mods: { sch: 1 }, text: '부착: 악당 계략력 +1.' }),

  // ── 기계 군주 오메가 ──
  E({ id: 'drone', name: '전투 드론', type: 'minion', set: 'omega', sch: 1, atk: 1, hp: 1, text: '미니언.', boost: 1 }),
  E({ id: 'war_bot', name: '강화 로봇', type: 'minion', set: 'omega', sch: 1, atk: 3, hp: 5, guard: true, text: '미니언. 경비.', boost: 1 }),
  E({ id: 'drone_factory', name: '드론 공장', type: 'side', set: 'omega', threat: 3, perPlayer: false, hazard: 1, boost: 1, text: '부가 계략. 위험: 악당 단계마다 조우 카드 +1장.' }),
  E({ id: 'produce', name: '드론 생산', type: 'treachery', set: 'omega', boost: 1, text: '모든 플레이어에게 전투 드론 1대가 교전합니다.', reveal: async (g) => { for (const p of g.alive()) g.summon(p, 'drone', true); } }),
  E({ id: 'hack', name: '시스템 해킹', type: 'treachery', set: 'omega', boost: 1, text: '내 강화·지원 카드 1장을 버립니다 (없으면 위협 +2).', reveal: async (g, pid) => { if (!(await g.discardOwnTech(pid))) g.addThreat(2, '시스템 해킹'); } }),
  E({ id: 'nano', name: '나노 재생', type: 'attachment', set: 'omega', boost: 1, mods: {}, regen: 2, text: '부착: 악당 단계마다 악당 체력 2 회복.' }),
];
const ENC_MAP = Object.fromEntries(ENCOUNTER.map((e) => [e.id, e]));

// ───────────── 악당 ─────────────
// 단계마다: 계략력(sch)·공격력(atk)·체력(플레이어당 hp)
const VILLAINS = [
  { id: 'sonix', name: '음파 마왕 소닉스', icon: '🎵', color: '#8a3ac8', level: '쉬움 (처음 추천)', desc: '소리로 영웅을 괴롭히는 악당. 공격이 약해서 규칙을 배우기 좋지만 계략은 빨라요.',
    stages: [
      { stage: 'I', sch: 2, atk: 1, hp: 11, text: '' },
      { stage: 'II', sch: 2, atk: 2, hp: 13, text: '단계 시작: 주 계략 위협 +1(플레이어당).', threat: true },
      { stage: 'III', sch: 3, atk: 3, hp: 15, text: '단계 시작: 주 계략 위협 +1(플레이어당).', threat: true },
    ],
    scheme: { name: '음파 증폭기 설치', threshold: 8, accel: 1, start: 1, text: '도시 전체를 마비시킬 증폭기를 짓고 있어요.' },
    encounter: { thug: 1, guard: 1, ambush: 2, dark_plot: 2, reinforce: 1, bomb: 1, exhaust_trick: 1, sonic_beast: 2, noise_soldier: 2, eardrum: 2, sonic_storm: 1, amplifier: 1, resonance: 1 } },
  { id: 'brute', name: '강철 들소 브루트', icon: '🦬', color: '#a85a2a', level: '보통', desc: '힘으로 밀어붙이는 악당. 공격이 세서 방어와 체력 관리가 중요해요.',
    stages: [
      { stage: 'I', sch: 1, atk: 1, hp: 12, text: '' },
      { stage: 'II', sch: 1, atk: 2, hp: 14, text: '단계 시작: 강인함을 얻습니다.', tough: true },
      { stage: 'III', sch: 2, atk: 3, hp: 15, text: '단계 시작: 강인함을 얻습니다.', tough: true },
    ],
    scheme: { name: '도심 파괴 작전', threshold: 8, accel: 1, start: 0, text: '브루트가 도시를 부수고 있어요. 위협이 한계에 닿으면 패배!' },
    encounter: { thug: 2, guard: 1, ambush: 2, dark_plot: 1, reinforce: 1, hostages: 1, gear_up: 1, exhaust_trick: 1, brute_goon: 2, brute_charge: 2, brute_armor: 1, collapse: 1, stampede: 1 } },
  { id: 'omega', name: '기계 군주 오메가', icon: '🤖', color: '#3a8a9a', level: '어려움', desc: '끝없이 드론을 만드는 인공지능. 미니언이 쏟아져요.',
    stages: [
      { stage: 'I', sch: 1, atk: 2, hp: 13, text: '' },
      { stage: 'II', sch: 2, atk: 2, hp: 15, text: '단계 시작: 모든 플레이어에게 전투 드론이 교전합니다.', drones: true },
      { stage: 'III', sch: 2, atk: 3, hp: 18, text: '단계 시작: 모든 플레이어에게 전투 드론이 교전합니다.', drones: true },
    ],
    scheme: { name: '기계 군단 확산', threshold: 9, accel: 1, start: 0, text: '전 세계 기계를 장악하려 해요.' },
    encounter: { guard: 1, ambush: 2, dark_plot: 1, hostages: 1, gear_up: 1, exhaust_trick: 1, drone: 4, war_bot: 1, drone_factory: 1, produce: 2, hack: 2, nano: 1 } },
];

// 난이도: 단계 구성과 계략 여유
const DIFFICULTIES = [
  { id: 'practice', name: '연습 (아주 쉬움)', desc: '악당 1단계만 쓰러뜨리면 승리. 악당 체력 80%, 위협 한계 1.5배, 부스트 없음. 규칙을 익히기 좋아요.', stages: [0], thresholdMul: 1.5, hpMul: 0.8, noBoost: true },
  { id: 'easy', name: '입문 (쉬움)', desc: '악당 1→2단계. 악당 체력 80%, 위협 한계 1.3배.', stages: [0, 1], thresholdMul: 1.3, hpMul: 0.8 },
  { id: 'standard', name: '표준', desc: '원작 기본: 악당 1→2단계.', stages: [0, 1], thresholdMul: 1 },
  { id: 'expert', name: '전문가', desc: '악당 2→3단계, 악당 단계마다 위협 +1 추가.', stages: [1, 2], thresholdMul: 1, extraAccel: 1 },
];

const ALLY_LIMIT = 3;

module.exports = { RES, RES_NAMES, RES_ICON, ASPECTS, HEROES, PLAYER_CARDS, CARD_MAP, buildDeck, ENCOUNTER, ENC_MAP, VILLAINS, DIFFICULTIES, ALLY_LIMIT };
