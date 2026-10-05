'use strict';
/*
 * 히어로 챔피언스 — 확장(DLC) 데이터
 * 원작 「마블 챔피언스」의 히어로 팩·대형 확장·시나리오 팩에서 영웅과 악당을 골라,
 * 누군지 알아볼 수 있는 이름으로 옮겼습니다. 카드 효과는 이 게임의 규칙에 맞게 새로 만든 것입니다.
 */

const PACKS = {
  core: { name: '기본 세트', order: 0 },
  heroes: { name: '히어로 팩', order: 1 },
  redskull: { name: '레드 스칼의 부활', order: 2 },
  galaxy: { name: '은하 최고 현상수배범', order: 3 },
  titan: { name: '매드 타이탄의 그림자', order: 4 },
  mutant: { name: '뮤턴트 제네시스', order: 5 },
  apocalypse: { name: '에이지 오브 아포칼립서', order: 6 },
  scenario: { name: '시나리오 팩', order: 7 },
};

// 영웅 정의 도우미
const H = (o) => o;

function heroes(fx) {
  return [
    // ── 히어로 팩 ──
    H({ id: 'cap', pack: 'heroes', name: '캡틴 아메리코', icon: '🛡', color: '#3a6ad8', archetype: '방패를 든 슈퍼 솔저', hp: 11,
      hero: { thw: 2, atk: 2, def: 3, hand: 5, ability: { name: '방패 투척', text: '적 하나에게 피해 1.', effect: fx.dmg(1, { attack: false }) } },
      alter: { name: '스티브 로저', job: '퇴역 군인', rec: 3, hand: 5, ability: { name: '작전 계획', text: '카드 1장을 뽑습니다.', effect: fx.draw(1) } },
      lore: '슈퍼 솔저 혈청으로 다시 태어난 2차 대전의 영웅. 방어가 단단하고 동료를 이끄는 데 능해요.' }),
    H({ id: 'thor', pack: 'heroes', name: '토어', icon: '🔨', color: '#5a8ad8', archetype: '천둥의 신', hp: 13,
      hero: { thw: 1, atk: 3, def: 1, hand: 5, ability: { name: '천둥 부르기', text: '모든 미니언에게 피해 1.', effect: async (g, pid) => g.damageAllMinions(1, pid) } },
      alter: { name: '도날드 블레익', job: '의사', rec: 3, hand: 6, ability: { name: '왕진', text: '내 영웅 체력 2 회복.', effect: fx.heal(2) } },
      lore: '아스가르드의 왕자. 망치 묠니르로 번개를 부르며 미니언 무리를 한꺼번에 쓸어 버려요.' }),
    H({ id: 'panther', pack: 'heroes', name: '블랙 펜서', icon: '🐾', color: '#4a3a7a', archetype: '와칸다의 왕이자 수호자', hp: 11,
      hero: { thw: 2, atk: 2, def: 2, hand: 5, ability: { name: '키네틱 에너지', text: '다음 카드 비용을 낼 때 자원 +1.', effect: async (g, pid) => g.bonus(pid, 1) } },
      alter: { name: '티찰루', job: '와칸다 국왕', rec: 3, hand: 6, ability: { name: '국정 회의', text: '아무 계략에서 위협 1 제거.', effect: fx.thw(1) } },
      lore: '비브라늄 슈트를 입은 와칸다의 왕. 맞은 충격을 에너지로 모아 되돌려줘요.' }),
    H({ id: 'hulk', pack: 'heroes', name: '헐커', icon: '💚', color: '#3a9a3a', archetype: '분노할수록 강해지는 초록 괴물', hp: 18,
      hero: { thw: 0, atk: 3, def: 1, hand: 4, ability: { name: '헐커 스매시', text: '적 하나에게 피해 2.', effect: fx.dmg(2, { attack: false }) } },
      alter: { name: '브루스 배노', job: '감마선 과학자', rec: 4, hand: 6, ability: { name: '연구', text: '카드 1장을 뽑습니다.', effect: fx.draw(1) } },
      lore: '감마선 사고로 화가 나면 초록 괴물이 되는 과학자. 저지는 못하지만 체력과 공격력이 압도적이에요.' }),
    H({ id: 'wolverine', pack: 'heroes', name: '울브린', icon: '🐺', color: '#d8b020', archetype: '아다만티움 발톱의 뮤턴트', hp: 12,
      hero: { thw: 1, atk: 3, def: 1, hand: 5, ability: { name: '힐링 팩터', text: '내 영웅 체력 2 회복.', effect: fx.heal(2) } },
      alter: { name: '로건', job: '떠돌이', rec: 4, hand: 5, ability: { name: '한잔', text: '카드 1장을 뽑습니다.', effect: fx.draw(1) } },
      lore: '뼈에 아다만티움을 입힌 불사의 뮤턴트. 다쳐도 금방 회복하며 계속 덤벼들어요.' }),
    H({ id: 'deadpool', pack: 'heroes', name: '데드폴', icon: '🗡', color: '#c82a2a', archetype: '수다쟁이 불사신 용병', hp: 12,
      hero: { thw: 1, atk: 2, def: 1, hand: 5, ability: { name: '제4의 벽 깨기', text: '카드 1장을 뽑습니다.', effect: fx.draw(1) } },
      alter: { name: '웨이드 윌스', job: '용병', rec: 3, hand: 6, ability: { name: '치미창가 먹기', text: '내 영웅 체력 2 회복.', effect: fx.heal(2) } },
      lore: '입이 쉬지 않는 불사신 용병. 자기가 게임 속 캐릭터라는 걸 알고 있어요.' }),
    H({ id: 'witch', pack: 'heroes', name: '스칼릿 위치', icon: '🔴', color: '#c83a5a', archetype: '현실을 비트는 카오스 마법사', hp: 10,
      hero: { thw: 2, atk: 1, def: 1, hand: 5, ability: { name: '헥스 볼트', text: '적 하나를 혼란시킵니다.', effect: async (g, pid) => g.statusEnemy(pid, 'confused') } },
      alter: { name: '완다 막시모바', job: '어벤저스 멤버', rec: 3, hand: 6, ability: { name: '명상', text: '아무 계략에서 위협 1 제거.', effect: fx.thw(1) } },
      lore: '확률과 현실을 바꾸는 카오스 마법의 주인. 적을 혼란시키고 계략을 지워 버려요.' }),
    H({ id: 'msmarvel', pack: 'heroes', name: '미즈 마벨', icon: '✊', color: '#2a7ad8', archetype: '몸을 늘리는 십대 영웅', hp: 10,
      hero: { thw: 2, atk: 2, def: 1, hand: 5, ability: { name: '임비그 펀치', text: '적 하나에게 피해 1.', effect: fx.dmg(1, { attack: false }) } },
      alter: { name: '카멀라 칸', job: '고등학생 · 팬픽 작가', rec: 3, hand: 6, ability: { name: '팬픽 쓰기', text: '카드 1장을 뽑습니다.', effect: fx.draw(1) } },
      lore: '어벤저스의 열혈 팬이던 고등학생이 몸을 자유롭게 늘리는 능력을 얻었어요.' }),
    // ── 레드 스칼의 부활 ──
    H({ id: 'hawkeye', pack: 'redskull', name: '호크아이즈', icon: '🏹', color: '#7a3ac8', archetype: '백발백중 명궁', hp: 10,
      hero: { thw: 2, atk: 2, def: 1, hand: 5, ability: { name: '트릭 애로', text: '적 하나에게 피해 1.', effect: fx.dmg(1, { attack: false }) } },
      alter: { name: '클린트 바톤', job: '서커스 출신 요원', rec: 3, hand: 6, ability: { name: '화살 손질', text: '다음 카드 비용을 낼 때 자원 +1.', effect: async (g, pid) => g.bonus(pid, 1) } },
      lore: '초능력은 없지만 온갖 특수 화살로 무장한 최고의 궁수.' }),
    H({ id: 'spiderwoman', pack: 'redskull', name: '스파이더 워먼', icon: '🕷', color: '#c83a3a', archetype: '독 에너지를 쏘는 이중 첩보원', hp: 11,
      hero: { thw: 2, atk: 2, def: 1, hand: 5, ability: { name: '비넘 블래스트', text: '적 하나를 기절시킵니다.', effect: async (g, pid) => g.statusEnemy(pid, 'stunned') } },
      alter: { name: '제시카 드루', job: '사립 탐정', rec: 3, hand: 6, ability: { name: '탐문', text: '아무 계략에서 위협 1 제거.', effect: fx.thw(1) } },
      lore: '거미의 힘과 생체 전기 독을 가진 탐정. 적을 기절시키는 데 능해요.' }),
    // ── 은하 최고 현상수배범 ──
    H({ id: 'rocket', pack: 'galaxy', name: '로킷 라쿤', icon: '🦝', color: '#a86a3a', archetype: '총을 사랑하는 천재 너구리', hp: 9,
      hero: { thw: 1, atk: 2, def: 1, hand: 5, ability: { name: '큰 총', text: '적 하나에게 피해 2.', effect: fx.dmg(2, { attack: false }) } },
      alter: { name: '89P13', job: '실험체 출신 정비사', rec: 3, hand: 6, ability: { name: '부품 줍기', text: '다음 카드 비용을 낼 때 자원 +1.', effect: async (g, pid) => g.bonus(pid, 1) } },
      lore: '개조 실험으로 천재가 된 너구리. 무기를 만들고 쏘는 걸 제일 좋아해요.' }),
    H({ id: 'groot', pack: 'galaxy', name: '그룻', icon: '🌳', color: '#6a8a3a', archetype: '"나는 그룻이다"', hp: 15,
      hero: { thw: 1, atk: 2, def: 2, hand: 4, ability: { name: '나무 방패', text: '아무 영웅에게 강인함을 줍니다.', effect: async (g, pid) => g.toughAny(pid) } },
      alter: { name: '작은 묘목', job: '화분 속 새싹', rec: 4, hand: 5, ability: { name: '광합성', text: '내 영웅 체력 2 회복.', effect: fx.heal(2) } },
      lore: '말은 한마디뿐이지만 누구보다 든든한 나무 거인. 동료를 몸으로 지켜요.' }),
  ];
}

function cards(fx, C) {
  const two = (n) => async (g, pid, ctx) => { await g.damage(pid, n, { attack: true }, ctx); await g.damage(pid, n, { attack: true }, ctx); };
  const block = (n) => async (g, pid, ctx) => { if (ctx.attack) ctx.attack.reduce += n; };
  const stunHit = (n) => async (g, pid, ctx) => { const t = await g.damage(pid, n, { attack: true }, ctx); if (t) g.applyStatus(t, 'stunned'); };
  return [
    // ── 캡틴 아메리코 ──
    C({ id: 'cap_throw', name: '방패 되튕기기', type: 'event', aspect: 'cap', cost: 2, res: 'physical', form: 'hero', attack: true, icon: '🛡', text: '공격. 적 둘에게 각각 피해 2.', effect: two(2) }),
    C({ id: 'cap_shield', name: '비브라늄 방패', type: 'upgrade', aspect: 'cap', cost: 2, res: 'physical', icon: '🔵', text: '강화: 방어력 +1, 최대 체력 +2.', mods: { def: 1, hp: 2 } }),
    C({ id: 'cap_block', name: '방패 막기 자세', type: 'event', aspect: 'cap', cost: 1, res: 'physical', defense: true, icon: '🧱', text: '방어 이벤트: 피해 -3, 카드 1장 뽑기.', effect: async (g, pid, ctx) => { if (ctx.attack) ctx.attack.reduce += 3; g.draw(pid, 1); } }),
    C({ id: 'cap_assemble', name: '어벤저스 어셈블!', type: 'event', aspect: 'cap', cost: 1, res: 'energy', icon: '📣', text: '내 영웅과 아군을 모두 준비시킵니다.', effect: async (g, pid) => { g.readyHero(pid); g.readyAllies(pid); } }),
    C({ id: 'cap_bucky', name: '버키 반스', type: 'ally', aspect: 'cap', cost: 3, res: 'physical', icon: '🦾', text: '아군 (공격 특기).', ally: { thw: 1, atk: 2, hp: 3, cons: 1 } }),
    C({ id: 'cap_freedom', name: '자유를 위하여', type: 'event', aspect: 'cap', cost: 1, res: 'mental', icon: '🗽', text: '위협 2 제거, 카드 1장 뽑기.', effect: async (g, pid) => { await g.thwart(pid, 2); g.draw(pid, 1); } }),
    // ── 토어 ──
    C({ id: 'thor_strike', name: '묠니르 강타', type: 'event', aspect: 'thor', cost: 2, res: 'energy', form: 'hero', attack: true, icon: '🔨', text: '공격. 적 하나에게 피해 5.', effect: fx.dmg(5) }),
    C({ id: 'thor_storm', name: '천둥 폭풍', type: 'event', aspect: 'thor', cost: 2, res: 'energy', form: 'hero', icon: '🌩', text: '모든 미니언에게 피해 2, 악당에게 피해 1.', effect: async (g, pid) => { g.damageAllMinions(2, pid); g.damageVillain(1, pid); } }),
    C({ id: 'thor_hammer', name: '묠니르', type: 'upgrade', aspect: 'thor', cost: 3, res: 'energy', icon: '⚒', text: '강화: 공격력 +1. 행동(소진): 적 하나에게 피해 2.', mods: { atk: 1 }, action: { name: '망치 던지기', exhaust: true, form: 'hero', effect: fx.dmg(2, { attack: false }) } }),
    C({ id: 'thor_sif', name: '레이디 시브', type: 'ally', aspect: 'thor', cost: 3, res: 'physical', icon: '⚔', text: '아군 (공격 특기).', ally: { thw: 1, atk: 3, hp: 3, cons: 1 } }),
    C({ id: 'thor_bifrost', name: '비프로스트', type: 'event', aspect: 'thor', cost: 0, res: 'energy', form: 'hero', icon: '🌈', text: '내 영웅을 준비시킵니다.', effect: async (g, pid) => g.readyHero(pid) }),
    C({ id: 'thor_asgard', name: '아스가르드', type: 'support', aspect: 'thor', cost: 2, res: 'mental', icon: '🏰', text: '지원. 행동(소진): 내 영웅 체력 2 회복.', action: { name: '연회', exhaust: true, need: 'selfHeal', effect: fx.heal(2) } }),
    // ── 블랙 펜서 ──
    C({ id: 'bp_claws', name: '비브라늄 발톱', type: 'event', aspect: 'panther', cost: 1, res: 'physical', form: 'hero', attack: true, icon: '🐾', text: '공격. 적 하나에게 피해 3.', effect: fx.dmg(3) }),
    C({ id: 'bp_kinetic', name: '키네틱 폭발', type: 'event', aspect: 'panther', cost: 2, res: 'energy', form: 'hero', attack: true, icon: '💥', text: '공격. 적 하나에게 피해 3, 모든 미니언에게 피해 1.', effect: async (g, pid, ctx) => { await g.damage(pid, 3, { attack: true }, ctx); g.damageAllMinions(1, pid); } }),
    C({ id: 'bp_suit', name: '판서 해비타트 슈트', type: 'upgrade', aspect: 'panther', cost: 2, res: 'energy', icon: '🖤', text: '강화: 방어력 +1, 최대 체력 +3.', mods: { def: 1, hp: 3 } }),
    C({ id: 'bp_herb', name: '하트 셰이프 허브', type: 'event', aspect: 'panther', cost: 1, res: 'mental', icon: '🌿', text: '내 영웅 체력 4 회복.', effect: fx.heal(4) }),
    C({ id: 'bp_shuri', name: '천재 공주 슈리', type: 'ally', aspect: 'panther', cost: 2, res: 'mental', icon: '👩‍🔬', text: '아군. 들어올 때 카드 1장을 뽑습니다.', ally: { thw: 1, atk: 1, hp: 2, cons: 1 }, effect: fx.draw(1) }),
    C({ id: 'bp_lab', name: '와칸다 연구소', type: 'support', aspect: 'panther', cost: 1, res: 'mental', icon: '🔬', text: '지원. 행동(소진): 다음 카드 비용을 낼 때 자원 +1.', action: { name: '비브라늄 연구', exhaust: true, effect: async (g, pid) => g.bonus(pid, 1) } }),
    // ── 헐커 ──
    C({ id: 'hulk_smash', name: '헐커 스매시!', type: 'event', aspect: 'hulk', cost: 3, res: 'physical', form: 'hero', attack: true, icon: '👊', text: '공격. 적 하나에게 피해 7.', effect: fx.dmg(7) }),
    C({ id: 'hulk_clap', name: '천둥 박수', type: 'event', aspect: 'hulk', cost: 2, res: 'physical', form: 'hero', icon: '👏', text: '모든 미니언에게 피해 2, 악당에게 피해 2.', effect: async (g, pid) => { g.damageAllMinions(2, pid); g.damageVillain(2, pid); } }),
    C({ id: 'hulk_rage', name: '끓어오르는 분노', type: 'upgrade', aspect: 'hulk', cost: 2, res: 'physical', icon: '😡', text: '강화: 공격력 +1, 최대 체력 +2.', mods: { atk: 1, hp: 2 } }),
    C({ id: 'hulk_leap', name: '대도약', type: 'event', aspect: 'hulk', cost: 0, res: 'physical', form: 'hero', icon: '🦘', text: '내 영웅을 준비시킵니다.', effect: async (g, pid) => g.readyHero(pid) }),
    C({ id: 'hulk_rick', name: '친구 릭 존', type: 'ally', aspect: 'hulk', cost: 2, res: 'mental', icon: '🧑', text: '아군 (저지 특기).', ally: { thw: 2, atk: 0, hp: 2, cons: 1 } }),
    C({ id: 'hulk_lab', name: '감마 연구소', type: 'support', aspect: 'hulk', cost: 1, res: 'energy', icon: '☢', text: '지원. 행동(소진): 내 영웅 체력 2 회복.', action: { name: '감마 치료', exhaust: true, need: 'selfHeal', effect: fx.heal(2) } }),
    // ── 울브린 ──
    C({ id: 'wol_claws', name: '아다만티움 발톱', type: 'upgrade', aspect: 'wolverine', cost: 2, res: 'physical', icon: '🗡', text: '강화: 공격력 +1.', mods: { atk: 1 } }),
    C({ id: 'wol_berserk', name: '버서커 분노', type: 'event', aspect: 'wolverine', cost: 2, res: 'physical', form: 'hero', attack: true, icon: '😤', text: '공격. 적 둘에게 각각 피해 2.', effect: two(2) }),
    C({ id: 'wol_slash', name: '할퀴기', type: 'event', aspect: 'wolverine', cost: 1, res: 'physical', form: 'hero', attack: true, icon: '🐺', text: '공격. 적 하나에게 피해 3.', effect: fx.dmg(3) }),
    C({ id: 'wol_heal', name: '재생', type: 'event', aspect: 'wolverine', cost: 0, res: 'energy', icon: '💉', text: '내 영웅 체력 3 회복.', effect: fx.heal(3) }),
    C({ id: 'wol_kitty', name: '키티 프라이', type: 'ally', aspect: 'wolverine', cost: 2, res: 'mental', icon: '👻', text: '아군 (저지 특기).', ally: { thw: 2, atk: 1, hp: 2, cons: 1 } }),
    C({ id: 'wol_mansion', name: '엑스 맨션', type: 'support', aspect: 'wolverine', cost: 1, res: 'mental', icon: '🏫', text: '지원. 행동(소진): 카드 1장을 뽑습니다.', action: { name: '작전실', exhaust: true, effect: fx.draw(1) } }),
    // ── 데드폴 ──
    C({ id: 'dp_katana', name: '쌍 카타나', type: 'event', aspect: 'deadpool', cost: 1, res: 'physical', form: 'hero', attack: true, icon: '⚔', text: '공격. 적 하나에게 피해 3.', effect: fx.dmg(3) }),
    C({ id: 'dp_guns', name: '쌍권총 난사', type: 'event', aspect: 'deadpool', cost: 2, res: 'energy', form: 'hero', attack: true, icon: '🔫', text: '공격. 적 둘에게 각각 피해 2.', effect: two(2) }),
    C({ id: 'dp_chimi', name: '치미창가', type: 'event', aspect: 'deadpool', cost: 1, res: 'wild', icon: '🌯', text: '내 영웅 체력 3 회복, 카드 1장 뽑기.', effect: async (g, pid) => { g.heal(pid, 3); g.draw(pid, 1); } }),
    C({ id: 'dp_pouch', name: '탄띠 주머니', type: 'upgrade', aspect: 'deadpool', cost: 1, res: 'physical', icon: '💣', text: '강화 (사용 3번). 행동: 적 하나에게 피해 1.', action: { name: '수류탄', uses: 3, effect: fx.dmg(1, { attack: false }) } }),
    C({ id: 'dp_al', name: '룸메이트 블라인드 앨', type: 'ally', aspect: 'deadpool', cost: 2, res: 'mental', icon: '👵', text: '아군. 들어올 때 카드 1장을 뽑습니다.', ally: { thw: 1, atk: 1, hp: 2, cons: 1 }, effect: fx.draw(1) }),
    C({ id: 'dp_wall', name: '작가님 살려줘요', type: 'event', aspect: 'deadpool', cost: 1, res: 'energy', defense: true, icon: '📖', text: '방어 이벤트: 이번 공격의 피해 -3.', effect: block(3) }),
    // ── 스칼릿 위치 ──
    C({ id: 'sw_hex', name: '헥스 폭발', type: 'event', aspect: 'witch', cost: 2, res: 'energy', form: 'hero', attack: true, icon: '🔴', text: '공격. 적 하나에게 피해 3, 그 적을 혼란시킵니다.', effect: async (g, pid, ctx) => { const t = await g.damage(pid, 3, { attack: true }, ctx); if (t) g.applyStatus(t, 'confused'); } }),
    C({ id: 'sw_reality', name: '현실 왜곡', type: 'event', aspect: 'witch', cost: 2, res: 'mental', icon: '🌀', text: '아무 계략에서 위협 4 제거.', effect: fx.thw(4) }),
    C({ id: 'sw_chaos', name: '카오스 마법', type: 'event', aspect: 'witch', cost: 2, res: 'energy', icon: '✨', text: '모든 계략에서 위협 1씩 제거, 모든 미니언에게 피해 1.', effect: async (g, pid) => { g.thwartEach(pid, 1); g.damageAllMinions(1, pid); } }),
    C({ id: 'sw_tiara', name: '진홍 티아라', type: 'upgrade', aspect: 'witch', cost: 2, res: 'mental', icon: '👑', text: '강화: 저지력 +1, 방어력 +1.', mods: { thw: 1, def: 1 } }),
    C({ id: 'sw_qs', name: '쌍둥이 퀵실바', type: 'ally', aspect: 'witch', cost: 3, res: 'energy', icon: '💨', text: '아군 (빠름).', ally: { thw: 2, atk: 2, hp: 2, cons: 1 } }),
    C({ id: 'sw_mount', name: '원더고어 산', type: 'support', aspect: 'witch', cost: 1, res: 'mental', icon: '⛰', text: '지원. 행동(소진): 위협 1 제거.', action: { name: '카오스 명상', exhaust: true, effect: fx.thw(1) } }),
    // ── 미즈 마벨 ──
    C({ id: 'mm_punch', name: '임비그 펀치', type: 'event', aspect: 'msmarvel', cost: 1, res: 'physical', form: 'hero', attack: true, icon: '✊', text: '공격. 적 하나에게 피해 3.', effect: fx.dmg(3) }),
    C({ id: 'mm_stretch', name: '쭉 늘어나기', type: 'event', aspect: 'msmarvel', cost: 1, res: 'mental', icon: '🤸', text: '위협 2 제거, 적 하나에게 피해 1.', effect: async (g, pid) => { await g.thwart(pid, 2); await g.damage(pid, 1, {}); } }),
    C({ id: 'mm_body', name: '고무 같은 몸', type: 'upgrade', aspect: 'msmarvel', cost: 2, res: 'physical', icon: '🧬', text: '강화: 저지력 +1, 최대 체력 +2.', mods: { thw: 1, hp: 2 } }),
    C({ id: 'mm_fanfic', name: '어벤저스 팬픽', type: 'event', aspect: 'msmarvel', cost: 0, res: 'mental', icon: '📝', text: '카드 2장을 뽑습니다.', effect: fx.draw(2) }),
    C({ id: 'mm_bruno', name: '친구 브루노', type: 'ally', aspect: 'msmarvel', cost: 2, res: 'mental', icon: '🧑‍🔧', text: '아군. 들어올 때 다음 카드 비용 자원 +1.', ally: { thw: 1, atk: 1, hp: 2, cons: 1 }, effect: async (g, pid) => g.bonus(pid, 1) }),
    C({ id: 'mm_shop', name: '동네 편의점', type: 'support', aspect: 'msmarvel', cost: 1, res: 'energy', icon: '🏪', text: '지원. 행동(소진): 내 영웅 체력 1 회복, 카드 1장 뽑기.', action: { name: '간식 타임', exhaust: true, effect: async (g, pid) => { g.heal(pid, 1); g.draw(pid, 1); } } }),
    // ── 호크아이즈 ──
    C({ id: 'hk_explosive', name: '폭발 화살', type: 'event', aspect: 'hawkeye', cost: 2, res: 'energy', form: 'hero', attack: true, icon: '🎆', text: '공격. 적 하나에게 피해 3, 모든 미니언에게 피해 1.', effect: async (g, pid, ctx) => { await g.damage(pid, 3, { attack: true }, ctx); g.damageAllMinions(1, pid); } }),
    C({ id: 'hk_net', name: '그물 화살', type: 'event', aspect: 'hawkeye', cost: 1, res: 'physical', form: 'hero', attack: true, icon: '🕸', text: '공격. 적 하나에게 피해 1, 기절시킵니다.', effect: stunHit(1) }),
    C({ id: 'hk_quiver', name: '특수 화살통', type: 'upgrade', aspect: 'hawkeye', cost: 2, res: 'physical', icon: '🏹', text: '강화 (사용 4번). 행동: 적 하나에게 피해 1.', action: { name: '화살 쏘기', uses: 4, effect: fx.dmg(1, { attack: false }) } }),
    C({ id: 'hk_precise', name: '정밀 사격', type: 'event', aspect: 'hawkeye', cost: 2, res: 'physical', form: 'hero', attack: true, icon: '🎯', text: '공격. 적 하나에게 피해 4.', effect: fx.dmg(4) }),
    C({ id: 'hk_lucky', name: '피자견 럭키', type: 'ally', aspect: 'hawkeye', cost: 1, res: 'mental', icon: '🐕', text: '아군.', ally: { thw: 1, atk: 1, hp: 1, cons: 1 } }),
    C({ id: 'hk_range', name: '사격장', type: 'support', aspect: 'hawkeye', cost: 1, res: 'physical', icon: '🎯', text: '지원. 행동(소진): 다음 카드 비용을 낼 때 자원 +1.', action: { name: '연습', exhaust: true, effect: async (g, pid) => g.bonus(pid, 1) } }),
    // ── 스파이더 워먼 ──
    C({ id: 'swm_blast', name: '비넘 쇼크', type: 'event', aspect: 'spiderwoman', cost: 1, res: 'energy', form: 'hero', attack: true, icon: '⚡', text: '공격. 적 하나에게 피해 2, 기절시킵니다.', effect: stunHit(2) }),
    C({ id: 'swm_phero', name: '페로몬', type: 'event', aspect: 'spiderwoman', cost: 1, res: 'mental', icon: '💗', text: '적 하나를 혼란시키고, 위협 2 제거.', effect: async (g, pid) => { await g.statusEnemy(pid, 'confused'); await g.thwart(pid, 2); } }),
    C({ id: 'swm_glide', name: '활공', type: 'event', aspect: 'spiderwoman', cost: 0, res: 'physical', form: 'hero', icon: '🪂', text: '내 영웅을 준비시킵니다.', effect: async (g, pid) => g.readyHero(pid) }),
    C({ id: 'swm_suit', name: '첩보 슈트', type: 'upgrade', aspect: 'spiderwoman', cost: 2, res: 'physical', icon: '🦺', text: '강화: 공격력 +1, 저지력 +1.', mods: { atk: 1, thw: 1 } }),
    C({ id: 'swm_ally', name: '탐정 동료 루크', type: 'ally', aspect: 'spiderwoman', cost: 3, res: 'physical', icon: '🕵', text: '아군 (튼튼함).', ally: { thw: 1, atk: 2, hp: 4, cons: 1 } }),
    C({ id: 'swm_office', name: '탐정 사무소', type: 'support', aspect: 'spiderwoman', cost: 1, res: 'mental', icon: '🗄', text: '지원. 행동(소진): 위협 1 제거.', action: { name: '사건 조사', exhaust: true, effect: fx.thw(1) } }),
    // ── 로킷 라쿤 ──
    C({ id: 'rk_bigger', name: '더 큰 총', type: 'event', aspect: 'rocket', cost: 2, res: 'energy', form: 'hero', attack: true, icon: '🔫', text: '공격. 적 하나에게 피해 5.', effect: fx.dmg(5) }),
    C({ id: 'rk_bomb', name: '시한 폭탄', type: 'event', aspect: 'rocket', cost: 2, res: 'energy', form: 'hero', icon: '💣', text: '모든 미니언에게 피해 2.', effect: async (g, pid) => g.damageAllMinions(2, pid) }),
    C({ id: 'rk_cannon', name: '조립식 캐논', type: 'upgrade', aspect: 'rocket', cost: 2, res: 'energy', icon: '🛠', text: '강화. 행동(소진, 영웅 모습): 적 하나에게 피해 2.', action: { name: '캐논 발사', exhaust: true, form: 'hero', effect: fx.dmg(2) } }),
    C({ id: 'rk_scrap', name: '고철 뒤지기', type: 'event', aspect: 'rocket', cost: 0, res: 'mental', icon: '🔩', text: '카드 1장 뽑기, 다음 카드 비용 자원 +1.', effect: async (g, pid) => { g.draw(pid, 1); g.bonus(pid, 1); } }),
    C({ id: 'rk_groot', name: '베이비 그룻', type: 'ally', aspect: 'rocket', cost: 2, res: 'physical', icon: '🌱', text: '아군.', ally: { thw: 1, atk: 2, hp: 2, cons: 1 } }),
    C({ id: 'rk_ship', name: '밀라노 호', type: 'support', aspect: 'rocket', cost: 2, res: 'energy', icon: '🚀', text: '지원. 행동(소진): 적 하나에게 피해 1.', action: { name: '함포 지원', exhaust: true, effect: fx.dmg(1, { attack: false }) } }),
    // ── 그룻 ──
    C({ id: 'gr_branch', name: '가지 휘두르기', type: 'event', aspect: 'groot', cost: 1, res: 'physical', form: 'hero', attack: true, icon: '🌿', text: '공격. 적 하나에게 피해 3.', effect: fx.dmg(3) }),
    C({ id: 'gr_wall', name: '나무 장벽', type: 'event', aspect: 'groot', cost: 1, res: 'physical', defense: true, icon: '🌲', text: '방어 이벤트: 이번 공격의 피해 -4.', effect: block(4) }),
    C({ id: 'gr_bark', name: '단단한 껍질', type: 'upgrade', aspect: 'groot', cost: 2, res: 'physical', icon: '🪵', text: '강화: 방어력 +1, 최대 체력 +3.', mods: { def: 1, hp: 3 } }),
    C({ id: 'gr_spores', name: '빛나는 포자', type: 'event', aspect: 'groot', cost: 1, res: 'mental', icon: '✨', text: '아무 영웅의 체력 4 회복.', effect: async (g, pid) => g.healAny(pid, 4) }),
    C({ id: 'gr_rocket', name: '단짝 로킷', type: 'ally', aspect: 'groot', cost: 3, res: 'energy', icon: '🦝', text: '아군 (공격 특기).', ally: { thw: 1, atk: 3, hp: 2, cons: 1 } }),
    C({ id: 'gr_grove', name: '숲의 쉼터', type: 'support', aspect: 'groot', cost: 1, res: 'mental', icon: '🏡', text: '지원. 행동(소진): 아무 영웅에게 강인함.', action: { name: '뿌리 감싸기', exhaust: true, effect: async (g, pid) => g.toughAny(pid) } }),
  ];
}

function encounter(E) {
  return [
    // ── 레드 스칼 (레드 스칼의 부활) ──
    E({ id: 'rs_soldier', name: '히드로 졸병', type: 'minion', set: 'redskull', sch: 1, atk: 1, hp: 3, icon: '💀', text: '미니언.' }),
    E({ id: 'rs_crossbones', name: '크로스본', type: 'minion', set: 'redskull', sch: 1, atk: 2, hp: 5, guard: true, icon: '☠', text: '미니언. 경비.' }),
    E({ id: 'rs_cube', name: '코즈믹 큐브', type: 'attachment', set: 'redskull', mods: { atk: 1, sch: 1 }, icon: '🟦', text: '부착: 악당 공격력 +1, 계략력 +1.' }),
    E({ id: 'rs_plan', name: '세계 정복 계획', type: 'side', set: 'redskull', threat: 3, perPlayer: false, accel: 1, icon: '🗺', text: '부가 계략. 가속: 악당 단계마다 주 계략 위협 +1.' }),
    E({ id: 'rs_hail', name: '히드로 만세!', type: 'treachery', set: 'redskull', icon: '✋', text: '히드로 졸병 1명이 당신과 교전하고, 주 계략에 위협 +1.', reveal: async (g, pid) => { g.summon(pid, 'rs_soldier', true); g.addThreat(1, '히드로 만세!'); } }),
    // ── 그린 고블 (시나리오 팩) ──
    E({ id: 'gg_goon', name: '고블린 부하', type: 'minion', set: 'goblin', sch: 1, atk: 1, hp: 2, icon: '👺', text: '미니언.' }),
    E({ id: 'gg_bomb', name: '호박 폭탄', type: 'treachery', set: 'goblin', icon: '🎃', text: '모든 영웅이 피해 1을 받습니다.', reveal: async (g) => g.damageAllHeroes(1, '호박 폭탄') }),
    E({ id: 'gg_glider', name: '고블린 글라이더', type: 'attachment', set: 'goblin', mods: { atk: 1 }, icon: '🛩', text: '부착: 악당 공격력 +1.' }),
    E({ id: 'gg_lab', name: '오즈코프 실험실', type: 'side', set: 'goblin', threat: 3, perPlayer: false, hazard: 1, icon: '🧪', text: '부가 계략. 위험: 악당 단계마다 조우 카드 +1장.' }),
    E({ id: 'gg_madness', name: '광기의 웃음', type: 'treachery', set: 'goblin', icon: '🤪', text: '내 영웅이 혼란됩니다 (이미 혼란이면 피해 2).', reveal: async (g, pid) => g.statusHero(pid, 'confused', 2) }),
    // ── 사노스 (매드 타이탄의 그림자) ──
    E({ id: 'th_outrider', name: '아웃라이더', type: 'minion', set: 'thanos', sch: 0, atk: 2, hp: 2, icon: '👹', text: '미니언.' }),
    E({ id: 'th_maw', name: '에보니 마우', type: 'minion', set: 'thanos', sch: 3, atk: 1, hp: 5, icon: '🧠', text: '미니언 (블랙 오더). 들어올 때 주 계략 위협 +1.', onEnter: (g) => g.addThreat(1, '에보니 마우') }),
    E({ id: 'th_corvus', name: '코버스 글레이브', type: 'minion', set: 'thanos', sch: 1, atk: 2, hp: 5, guard: true, icon: '🔱', text: '미니언 (블랙 오더). 경비.' }),
    E({ id: 'th_gauntlet', name: '인피니티 건틀릿', type: 'attachment', set: 'thanos', mods: { atk: 1, sch: 1 }, icon: '🧤', text: '부착: 악당 공격력 +1, 계략력 +1.' }),
    E({ id: 'th_snap', name: '핑거 스냅', type: 'treachery', set: 'thanos', icon: '🫰', text: '모든 영웅이 피해 2를 받습니다.', reveal: async (g) => g.damageAllHeroes(2, '핑거 스냅') }),
    E({ id: 'th_ship', name: '생추어리 II', type: 'side', set: 'thanos', threat: 4, perPlayer: false, crisis: true, icon: '🛸', text: '부가 계략. 위기: 이 계략이 있는 동안 주 계략에서 위협을 제거할 수 없어요.' }),
    // ── 로낭 (은하 최고 현상수배범) ──
    E({ id: 'rn_kree', name: '크리 병사', type: 'minion', set: 'ronan', sch: 1, atk: 2, hp: 3, icon: '👽', text: '미니언.' }),
    E({ id: 'rn_merc', name: '사카아란 용병', type: 'minion', set: 'ronan', sch: 0, atk: 2, hp: 4, retaliate: 1, icon: '🪖', text: '미니언. 반격 1.' }),
    E({ id: 'rn_hammer', name: '유니버설 웨폰', type: 'attachment', set: 'ronan', mods: { atk: 1 }, tough: true, icon: '🔨', text: '부착: 악당 공격력 +1, 악당이 강인함을 얻습니다.' }),
    E({ id: 'rn_fleet', name: '크리 함대 집결', type: 'side', set: 'ronan', threat: 2, perPlayer: true, accel: 1, icon: '🚀', text: '부가 계략. 가속: 악당 단계마다 주 계략 위협 +1.' }),
    E({ id: 'rn_judgment', name: '고발자의 심판', type: 'treachery', set: 'ronan', icon: '⚖', text: '영웅 모습이면 로낭이 공격력 +1로 공격합니다. 일상이면 위협 +2.', reveal: async (g, pid) => { if (g.form(pid) === 'hero') await g.villainAttack(pid, { bonus: 1, label: '고발자의 심판' }); else g.addThreat(2, '고발자의 심판'); } }),
    // ── 마그네토 (뮤턴트 제네시스) ──
    E({ id: 'mg_acolyte', name: '애컬라이트', type: 'minion', set: 'magneto', sch: 1, atk: 2, hp: 3, icon: '🧑‍🎤', text: '미니언.' }),
    E({ id: 'mg_storm', name: '쇳조각 폭풍', type: 'treachery', set: 'magneto', icon: '🌪', text: '모든 영웅이 피해 1을 받고, 주 계략에 위협 +1.', reveal: async (g) => { g.damageAllHeroes(1, '쇳조각 폭풍'); g.addThreat(1, '쇳조각 폭풍'); } }),
    E({ id: 'mg_field', name: '자기장 방벽', type: 'attachment', set: 'magneto', mods: {}, tough: true, regen: 1, icon: '🧲', text: '부착: 악당이 강인함을 얻고, 악당 단계마다 체력 1 회복.' }),
    E({ id: 'mg_asteroid', name: '아스테로이드 M', type: 'side', set: 'magneto', threat: 3, perPlayer: false, accel: 1, icon: '☄', text: '부가 계략. 가속: 악당 단계마다 주 계략 위협 +1.' }),
    E({ id: 'mg_bend', name: '금속 조종', type: 'treachery', set: 'magneto', icon: '🔩', text: '내 강화·지원 카드 1장을 버립니다 (없으면 위협 +2).', reveal: async (g, pid) => { if (!(await g.discardOwnTech(pid))) g.addThreat(2, '금속 조종'); } }),
    // ── 아포칼립서 (에이지 오브 아포칼립서) ──
    E({ id: 'ap_war', name: '전쟁의 기사', type: 'minion', set: 'apocalypse', sch: 1, atk: 3, hp: 5, guard: true, icon: '⚔', text: '미니언 (4기사). 경비.' }),
    E({ id: 'ap_famine', name: '기근의 기사', type: 'minion', set: 'apocalypse', sch: 2, atk: 1, hp: 4, icon: '🥀', text: '미니언 (4기사). 들어올 때 주 계략 위협 +1.', onEnter: (g) => g.addThreat(1, '기근의 기사') }),
    E({ id: 'ap_tech', name: '셀레스티얼 기술', type: 'attachment', set: 'apocalypse', mods: { atk: 1 }, regen: 2, icon: '🏺', text: '부착: 악당 공격력 +1, 악당 단계마다 체력 2 회복.' }),
    E({ id: 'ap_fittest', name: '적자생존', type: 'treachery', set: 'apocalypse', icon: '🦴', text: '모든 영웅이 피해 1을 받습니다. 일상 모습이면 카드 1장도 버립니다.', reveal: async (g) => { g.damageAllHeroes(1, '적자생존'); for (const p of g.alive()) if (g.form(p) === 'alter') g.discardRandom(p, 1); } }),
    E({ id: 'ap_culling', name: '대숙청', type: 'side', set: 'apocalypse', threat: 2, perPlayer: true, hazard: 1, icon: '🔥', text: '부가 계략. 위험: 악당 단계마다 조우 카드 +1장.' }),
  ];
}

const VILLAINS = [
  { id: 'redskull', pack: 'redskull', name: '레드 스칼', icon: '💀', color: '#b82020', level: '어려움', desc: '코즈믹 큐브를 노리는 히드로의 수장. 졸병과 크로스본을 앞세워 세계 정복을 꾀해요.',
    stages: [
      { stage: 'I', sch: 1, atk: 1, hp: 12, text: '' },
      { stage: 'II', sch: 2, atk: 2, hp: 14, text: '단계 시작: 모든 플레이어에게 히드로 졸병이 교전합니다.', summonAll: 'rs_soldier' },
      { stage: 'III', sch: 2, atk: 3, hp: 16, text: '단계 시작: 주 계략 위협 +1(플레이어당).', threat: true },
    ],
    scheme: { name: '히드로의 세계 지배', threshold: 11, accel: 1, start: 0, text: '히드로가 세계 곳곳을 장악하고 있어요.' },
    encounter: { thug: 2, ambush: 2, dark_plot: 1, exhaust_trick: 1, gear_up: 1, rs_soldier: 2, rs_crossbones: 1, rs_cube: 1, rs_plan: 1, rs_hail: 1 } },
  { id: 'goblin', pack: 'scenario', name: '그린 고블', icon: '🎃', color: '#3a9a3a', level: '보통', desc: '글라이더를 탄 광기의 악당. 호박 폭탄으로 모두를 조금씩 다치게 해요.',
    stages: [
      { stage: 'I', sch: 2, atk: 2, hp: 13, text: '' },
      { stage: 'II', sch: 2, atk: 2, hp: 15, text: '단계 시작: 강인함을 얻습니다.', tough: true },
      { stage: 'III', sch: 3, atk: 3, hp: 16, text: '단계 시작: 강인함을 얻습니다.', tough: true },
    ],
    scheme: { name: '오즈코프 장악', threshold: 7, accel: 1, start: 0, text: '고블이 회사를 빼앗아 위험한 실험을 하려 해요.' },
    encounter: { thug: 1, guard: 1, ambush: 2, dark_plot: 1, reinforce: 1, exhaust_trick: 1, gg_goon: 3, gg_bomb: 2, gg_glider: 1, gg_lab: 1, gg_madness: 2 } },
  { id: 'ronan', pack: 'galaxy', name: '로낭', icon: '🔨', color: '#2a5a7a', level: '보통', desc: '유니버설 웨폰을 든 크리족 고발자. 공격 한 방이 아파요.',
    stages: [
      { stage: 'I', sch: 1, atk: 1, hp: 11, text: '' },
      { stage: 'II', sch: 1, atk: 2, hp: 13, text: '단계 시작: 강인함을 얻습니다.', tough: true },
      { stage: 'III', sch: 2, atk: 3, hp: 16, text: '단계 시작: 모든 플레이어에게 크리 병사가 교전합니다.', summonAll: 'rn_kree' },
    ],
    scheme: { name: '크리의 심판', threshold: 9, accel: 1, start: 0, text: '로낭이 행성 하나를 통째로 심판하려 해요.' },
    encounter: { thug: 1, ambush: 2, dark_plot: 1, hostages: 1, exhaust_trick: 1, rn_kree: 3, rn_merc: 1, rn_hammer: 1, rn_fleet: 1, rn_judgment: 2 } },
  { id: 'magneto', pack: 'mutant', name: '마그네토', icon: '🧲', color: '#8a2a8a', level: '어려움', desc: '자기력을 다루는 뮤턴트의 지도자. 강화 카드를 빼앗고 몸을 지켜요.',
    stages: [
      { stage: 'I', sch: 2, atk: 2, hp: 13, text: '' },
      { stage: 'II', sch: 2, atk: 2, hp: 15, text: '단계 시작: 강인함을 얻습니다.', tough: true },
      { stage: 'III', sch: 3, atk: 3, hp: 17, text: '단계 시작: 강인함을 얻고 주 계략 위협 +1(플레이어당).', tough: true, threat: true },
    ],
    scheme: { name: '뮤턴트의 나라', threshold: 9, accel: 1, start: 1, text: '마그네토가 인류를 굴복시키려 해요.' },
    encounter: { guard: 1, ambush: 2, dark_plot: 1, hostages: 1, exhaust_trick: 1, mg_acolyte: 3, mg_storm: 2, mg_field: 1, mg_asteroid: 1, mg_bend: 2 } },
  { id: 'thanos', pack: 'titan', name: '사노스', icon: '🟣', color: '#6a3a9a', level: '아주 어려움', desc: '인피니티 건틀릿을 노리는 매드 타이탄. 블랙 오더와 핑거 스냅이 무시무시해요.',
    stages: [
      { stage: 'I', sch: 1, atk: 2, hp: 13, text: '' },
      { stage: 'II', sch: 2, atk: 2, hp: 15, text: '단계 시작: 모든 플레이어에게 아웃라이더가 교전합니다.', summonAll: 'th_outrider' },
      { stage: 'III', sch: 2, atk: 3, hp: 18, text: '단계 시작: 강인함을 얻고 주 계략 위협 +1(플레이어당).', tough: true, threat: true },
    ],
    scheme: { name: '인피니티 스톤 수집', threshold: 11, accel: 1, start: 0, text: '스톤이 모두 모이면 우주의 절반이 사라져요.' },
    encounter: { thug: 1, ambush: 2, dark_plot: 1, exhaust_trick: 1, th_outrider: 2, th_maw: 1, th_corvus: 1, th_gauntlet: 1, th_snap: 1, th_ship: 1 } },
  { id: 'apocalypse', pack: 'apocalypse', name: '아포칼립서', icon: '🏺', color: '#4a4a8a', level: '아주 어려움', desc: '최초의 뮤턴트. 4기사를 거느리고 약한 자를 몰아내려 해요.',
    stages: [
      { stage: 'I', sch: 1, atk: 2, hp: 13, text: '' },
      { stage: 'II', sch: 2, atk: 2, hp: 15, text: '단계 시작: 강인함을 얻습니다.', tough: true },
      { stage: 'III', sch: 2, atk: 3, hp: 18, text: '단계 시작: 모든 플레이어에게 기근의 기사가 교전합니다.', summonAll: 'ap_famine' },
    ],
    scheme: { name: '적자생존의 시대', threshold: 11, accel: 1, start: 0, text: '아포칼립서가 강한 자만 살아남는 세상을 만들려 해요.' },
    encounter: { guard: 1, ambush: 2, dark_plot: 1, exhaust_trick: 1, ap_war: 1, ap_famine: 2, thug: 1, ap_tech: 1, ap_fittest: 2, ap_culling: 1, hostages: 1 } },
];

module.exports = { PACKS, heroes, cards, encounter, VILLAINS };
