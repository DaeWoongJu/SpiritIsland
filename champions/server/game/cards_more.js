'use strict';
/*
 * 히어로 챔피언스 — 추가 카드 (기본·측면·영웅 전용 확장) + 모듈 조우 세트
 * 원작처럼 덱을 40장으로 꾸릴 수 있을 만큼 카드 풀을 늘립니다. 효과는 이 게임 규칙에 맞게 새로 만든 것입니다.
 */

function make(fx, C) {
  const two = (n) => async (g, pid, ctx) => { await g.damage(pid, n, { attack: true }, ctx); await g.damage(pid, n, { attack: true }, ctx); };
  const block = (n) => async (g, pid, ctx) => { if (ctx.attack) ctx.attack.reduce += n; };
  const stunHit = (n) => async (g, pid, ctx) => { const t = await g.damage(pid, n, { attack: true }, ctx); if (t) g.applyStatus(t, 'stunned'); };
  // 카드 모양별 도우미
  const atk = (id, aspect, name, cost, res, n, icon, extra = {}) => C({ id, name, type: 'event', aspect, cost, res, form: 'hero', attack: true, icon, text: `공격. 적 하나에게 피해 ${n}.`, effect: fx.dmg(n), ...extra });
  const evt = (id, aspect, name, cost, res, icon, text, effect, extra = {}) => C({ id, name, type: 'event', aspect, cost, res, icon, text, effect, ...extra });
  const dfn = (id, aspect, name, cost, res, icon, text, effect) => C({ id, name, type: 'event', aspect, cost, res, defense: true, icon, text: `방어 이벤트: ${text}`, effect });
  const ally = (id, aspect, name, cost, res, icon, a, text = '', effect) => C({ id, name, type: 'ally', aspect, cost, res, icon, text: `아군.${text ? ' ' + text : ''}`, ally: { cons: 1, ...a }, effect });
  const upg = (id, aspect, name, cost, res, icon, text, o) => C({ id, name, type: 'upgrade', aspect, cost, res, icon, text: `강화: ${text}`, ...o });
  const sup = (id, aspect, name, cost, res, icon, text, action) => C({ id, name, type: 'support', aspect, cost, res, icon, text: `지원. ${text}`, action });

  const cards = [
    // ───── 기본 (누구나) ─────
    C({ id: 'determination', name: '영웅의 결의', type: 'resource', aspect: 'basic', cost: 0, res: 'wild', resN: 2, icon: '⭐', text: '자원 카드: 비용을 낼 때 버리면 ★(만능) 2개.' }),
    ally('nick', 'basic', '국장 닉 퓨어리', 4, 'mental', '🕶', { thw: 2, atk: 2, hp: 3 }, '들어올 때 카드 2장을 뽑습니다.', fx.draw(2)),
    ally('maria', 'basic', '부국장 마리아 힐스', 2, 'mental', '👩‍✈️', { thw: 2, atk: 1, hp: 2 }),
    ally('coulson', 'basic', '요원 필 쿨슨', 3, 'energy', '🕴', { thw: 1, atk: 1, hp: 3 }, '들어올 때 위협 1 제거.', fx.thw(1)),
    sup('helicarrier', 'basic', '쉴드 헬리캐리어', 3, 'energy', '🛳', '행동(소진): 다음 카드 비용을 낼 때 자원 +1.', { name: '공중 지원', exhaust: true, effect: async (g, pid) => g.bonus(pid, 1) }),
    evt('emergency', 'basic', '비상 연락', 0, 'wild', '📟', '카드 1장을 뽑습니다.', fx.draw(1)),
    evt('bandage', 'basic', '붕대 감기', 0, 'mental', '🩹', '내 영웅 체력 2 회복.', fx.heal(2)),
    ally('tac_team', 'basic', '쉴드 전술팀', 3, 'physical', '🪖', { thw: 1, atk: 2, hp: 3 }),

    // ───── 분노 (공격) ─────
    atk('agg_haymaker', 'aggression', '강펀치', 2, 'physical', 2, '🥊', { text: '공격. 적 하나에게 피해 2, 기절시킵니다.', effect: stunHit(2) }),
    upg('agg_relentless', 'aggression', '끈질긴 투혼', 3, 'physical', '🔥', '공격력 +1, 최대 체력 +2.', { mods: { atk: 1, hp: 2 } }),
    atk('agg_flurry', 'aggression', '연속 타격', 2, 'energy', 2, '💫', { text: '공격. 적 둘에게 각각 피해 2.', effect: two(2) }),
    atk('agg_clobber', 'aggression', '내려찍기', 3, 'physical', 5, '🔨', { text: '공격. 적 하나에게 피해 5, 모든 미니언에게 피해 1.', effect: async (g, pid, ctx) => { await g.damage(pid, 5, { attack: true }, ctx); g.damageAllMinions(1, pid); } }),
    evt('agg_battle_cry', 'aggression', '전투 함성', 1, 'wild', '📢', '내 아군을 모두 준비시키고, 악당에게 피해 1.', async (g, pid) => { g.readyAllies(pid); g.damageVillain(1, pid); }),
    ally('agg_jessie', 'aggression', '해결사 루크 케이쥐', 4, 'physical', '💪', { thw: 1, atk: 3, hp: 5 }),
    upg('agg_gauntlet', 'aggression', '전투 건틀릿', 1, 'physical', '🧤', '(사용 3번) 행동: 적 하나에게 피해 1.', { action: { name: '건틀릿 타격', uses: 3, effect: fx.dmg(1, { attack: false }) } }),
    sup('agg_bar', 'aggression', '이름 없는 술집', 1, 'mental', '🍺', '행동(소진): 다음 카드 비용을 낼 때 자원 +1.', { name: '용병 고용', exhaust: true, effect: async (g, pid) => g.bonus(pid, 1) }),
    atk('agg_jab', 'aggression', '잽', 0, 'physical', 2, '👊'),
    dfn('agg_counterpunch', 'aggression', '카운터 펀치', 1, 'physical', '↩', '이번 공격의 피해 -1, 공격한 적에게 피해 3.', async (g, pid, ctx) => { if (ctx.attack) { ctx.attack.reduce += 1; g.dealTo(ctx.attack.attacker, 3, pid); } }),

    // ───── 정의 (저지) ─────
    evt('jus_interrogate', 'justice', '심문', 1, 'mental', '💡', '적 하나를 혼란시키고, 카드 1장 뽑기.', async (g, pid) => { await g.statusEnemy(pid, 'confused'); g.draw(pid, 1); }),
    evt('jus_patrol', 'justice', '순찰', 0, 'energy', '🚓', '아무 계략에서 위협 2 제거.', fx.thw(2)),
    upg('jus_intuition', 'justice', '영웅의 직감', 2, 'mental', '🧭', '저지력 +1, 최대 체력 +1.', { mods: { thw: 1, hp: 1 } }),
    ally('jus_daredevil', 'justice', '맹인 변호사 데어데블', 3, 'physical', '😈', { thw: 2, atk: 2, hp: 3 }),
    ally('jus_jessica', 'justice', '사립 탐정 제시카 존', 3, 'mental', '🕵️‍♀️', { thw: 2, atk: 1, hp: 4 }),
    sup('jus_surveillance', 'justice', '도시 감시망', 3, 'mental', '📹', '행동(소진): 모든 계략에서 위협 1씩 제거.', { name: '감시', exhaust: true, effect: async (g, pid) => g.thwartEach(pid, 1) }),
    evt('jus_served', 'justice', '정의 실현', 2, 'mental', '⚖', '위협 3 제거, 내 영웅 체력 1 회복.', async (g, pid) => { await g.thwart(pid, 3); g.heal(pid, 1); }),
    evt('jus_turnabout', 'justice', '형세 역전', 1, 'energy', '🔄', '부가 계략 하나에서 위협 3 제거.', fx.thw(3, { sideOnly: true })),
    evt('jus_citizen_arrest', 'justice', '현행범 체포', 1, 'physical', '🚨', '위협 1 제거, 적 하나를 기절시킵니다.', async (g, pid) => { await g.thwart(pid, 1); await g.statusEnemy(pid, 'stunned'); }),
    upg('jus_badge', 'justice', '경찰 배지', 1, 'energy', '🔰', '(사용 3번) 행동: 위협 1 제거.', { action: { name: '수사권', uses: 3, effect: fx.thw(1) } }),

    // ───── 지휘 (아군) ─────
    sup('lead_mansion', 'leadership', '어벤저스 맨션', 3, 'mental', '🏛', '행동(소진): 카드 1장을 뽑습니다.', { name: '작전 회의', exhaust: true, effect: fx.draw(1) }),
    ally('lead_falcon', 'leadership', '하늘의 팰컨', 3, 'energy', '🦅', { thw: 1, atk: 2, hp: 3 }, '들어올 때 적 하나에게 피해 1.', fx.dmg(1, { attack: false })),
    ally('lead_wasp', 'leadership', '와스프', 3, 'energy', '🐝', { thw: 2, atk: 2, hp: 2 }),
    ally('lead_vision', 'leadership', '인조인간 비젼', 4, 'mental', '💎', { thw: 2, atk: 2, hp: 5 }),
    ally('lead_mockingbird', 'leadership', '모킹버드', 3, 'physical', '🐦', { thw: 2, atk: 1, hp: 2 }, '들어올 때 적 하나를 기절시킵니다.', async (g, pid) => g.statusEnemy(pid, 'stunned')),
    upg('lead_inspire', 'leadership', '사기 진작', 2, 'energy', '🎖', '내 아군의 공격력 +1.', { mods: { allyAtk: 1 } }),
    evt('lead_squad', 'leadership', '분대 편성', 2, 'mental', '🧑‍🤝‍🧑', '내 아군을 모두 준비시키고, 카드 1장 뽑기.', async (g, pid) => { g.readyAllies(pid); g.draw(pid, 1); }),
    evt('lead_rescue', 'leadership', '동료 구출', 0, 'wild', '🆘', '버린 더미의 아군 1장을 손으로 가져옵니다.', async (g, pid) => g.returnAlly(pid)),
    evt('lead_combined', 'leadership', '합동 공격', 1, 'physical', '🤜', '악당에게 피해 (내 아군 수 + 1).', async (g, pid) => g.damageVillain(g.allies(pid).length + 1, pid)),
    sup('lead_quinjet', 'leadership', '어벤저스 퀸젯', 3, 'energy', '✈', '행동(소진): 내 아군 하나를 준비시킵니다.', { name: '긴급 출격', exhaust: true, effect: async (g, pid) => g.readyAlly(pid) }),

    // ───── 수호 (방어) ─────
    upg('pro_calm', 'protection', '침착함', 2, 'mental', '🧘', '방어력 +1, 최대 체력 +1.', { mods: { def: 1, hp: 1 } }),
    dfn('pro_brace', 'protection', '버티기', 0, 'physical', '🦵', '이번 공격의 피해 -2.', block(2)),
    evt('pro_shield_wall', 'protection', '방패의 벽', 2, 'physical', '🧱', '내 영웅과 아무 영웅 하나에게 강인함을 줍니다.', async (g, pid) => { g.toughSelf(pid); await g.toughAny(pid); }),
    evt('pro_regen', 'protection', '집중 치료', 2, 'mental', '💊', '내 영웅 체력 5 회복.', fx.heal(5)),
    ally('pro_medic', 'protection', '야전 의무병', 2, 'mental', '🧑‍⚕️', { thw: 1, atk: 0, hp: 3 }, '들어올 때 아무 영웅 체력 2 회복.', async (g, pid) => g.healAny(pid, 2)),
    ally('pro_guardian', 'protection', '수호자 콜로서스', 4, 'physical', '🗿', { thw: 1, atk: 2, hp: 6 }),
    sup('pro_bulwark', 'protection', '방호 시설', 2, 'physical', '🏯', '행동(소진): 내 영웅이 강인함을 얻습니다.', { name: '방호', exhaust: true, effect: async (g, pid) => g.toughSelf(pid) }),
    dfn('pro_deflect', 'protection', '튕겨내기', 2, 'energy', '🪞', '이번 공격의 피해 -3, 카드 1장 뽑기.', async (g, pid, ctx) => { if (ctx.attack) ctx.attack.reduce += 3; g.draw(pid, 1); }),
    upg('pro_armor', 'protection', '전투 갑옷', 3, 'physical', '🥋', '방어력 +1, 최대 체력 +3.', { mods: { def: 1, hp: 3 } }),
    evt('pro_endure', 'protection', '인내', 1, 'physical', '⛰', '내 영웅 체력 2 회복, 강인함을 얻습니다.', async (g, pid) => { g.heal(pid, 2); g.toughSelf(pid); }),

    // ───── 영웅 전용 추가 (영웅마다 3장) ─────
    // 스파이디맨
    evt('sp_web_trap', 'spark', '거미줄 덫', 1, 'mental', '🕸', '적 하나를 기절시키고, 위협 1 제거.', async (g, pid) => { await g.statusEnemy(pid, 'stunned'); await g.thwart(pid, 1); }),
    sup('sp_aunt', 'spark', '메이 숙모', 1, 'mental', '👵', '행동(소진): 내 영웅 체력 2 회복.', { name: '따뜻한 밥', exhaust: true, need: 'selfHeal', effect: fx.heal(2) }),
    dfn('sp_backflip', 'spark', '백플립', 0, 'energy', '🤸', '이번 공격의 피해 -2.', block(2)),
    // 아이언 마크
    ally('ir_pepper', 'gear', '비서 페퍼 팟츠', 2, 'mental', '👩‍💼', { thw: 2, atk: 0, hp: 2 }, '들어올 때 다음 카드 비용 자원 +1.', async (g, pid) => g.bonus(pid, 1)),
    upg('ir_arc', 'gear', '아크 리액터', 2, 'energy', '💠', '공격력 +1, 최대 체력 +2.', { mods: { atk: 1, hp: 2 } }),
    evt('ir_missiles', 'gear', '미사일 일제 사격', 3, 'energy', '🚀', '모든 미니언에게 피해 2, 악당에게 피해 2.', async (g, pid) => { g.damageAllMinions(2, pid); g.damageVillain(2, pid); }, { form: 'hero' }),
    // 쉬-헐커
    evt('sh_objection', 'titan', '이의 있음!', 1, 'mental', '☝', '위협 2 제거, 적 하나를 혼란시킵니다.', async (g, pid) => { await g.thwart(pid, 2); await g.statusEnemy(pid, 'confused'); }),
    atk('sh_clothesline', 'titan', '클로스라인', 2, 'physical', 2, '💪', { text: '공격. 적 둘에게 각각 피해 2.', effect: two(2) }),
    ally('sh_bailiff', 'titan', '법정 경위 토니', 2, 'physical', '👮', { thw: 1, atk: 1, hp: 3 }),
    // 캡틴 마벨
    upg('cm_binary', 'star', '바이너리 모드', 3, 'energy', '☀', '공격력 +1, 저지력 +1.', { mods: { atk: 1, thw: 1 } }),
    evt('cm_burst', 'star', '광자 폭발', 2, 'energy', '💥', '모든 미니언에게 피해 2, 악당에게 피해 1.', async (g, pid) => { g.damageAllMinions(2, pid); g.damageVillain(1, pid); }, { form: 'hero' }),
    ally('cm_monica', 'star', '파일럿 모니카 람보', 3, 'energy', '🌈', { thw: 2, atk: 2, hp: 3 }),
    // 블랙 위도
    evt('bw_grapple', 'fox', '그래플링 훅', 0, 'physical', '🪝', '내 영웅을 준비시킵니다.', async (g, pid) => g.readyHero(pid), { form: 'hero' }),
    evt('bw_disguise', 'fox', '변장 잠입', 1, 'mental', '🎭', '아무 계략에서 위협 3 제거.', fx.thw(3)),
    ally('bw_yelena', 'fox', '자매 요원 옐레나', 3, 'physical', '🗡', { thw: 1, atk: 2, hp: 3 }),
    // 닥터 스트레인저
    upg('ds_eye', 'rune', '아가모토의 눈', 3, 'mental', '👁', '행동(소진): 위협 2 제거.', { action: { name: '시간 되감기', exhaust: true, effect: fx.thw(2) } }),
    dfn('ds_seraphim', 'rune', '세라핌의 방패', 1, 'mental', '🔰', '이번 공격의 피해 -4.', block(4)),
    evt('ds_astral', 'rune', '아스트랄 투사', 1, 'mental', '👻', '카드 2장을 뽑습니다.', fx.draw(2)),
    // 캡틴 아메리코
    evt('cap_salute', 'cap', '대원들, 집합!', 0, 'energy', '🫡', '내 아군을 모두 준비시킵니다.', async (g, pid) => g.readyAllies(pid)),
    ally('cap_peggy', 'cap', '요원 페기 카터스', 2, 'mental', '💄', { thw: 2, atk: 1, hp: 2 }),
    atk('cap_charge', 'cap', '돌격 앞으로', 2, 'physical', 4, '🏃'),
    // 토어
    ally('thor_warriors', 'thor', '워리어 쓰리', 4, 'physical', '⚔', { thw: 1, atk: 3, hp: 4 }),
    atk('thor_wrath', 'thor', '천둥신의 분노', 3, 'energy', 6, '⛈'),
    upg('thor_belt', 'thor', '힘의 벨트', 2, 'physical', '🎗', '공격력 +1, 최대 체력 +2.', { mods: { atk: 1, hp: 2 } }),
    // 블랙 펜서
    ally('bp_okoye', 'panther', '도라 밀라제 오코예', 3, 'physical', '🛡', { thw: 1, atk: 3, hp: 3 }),
    evt('bp_ancestral', 'panther', '조상의 지혜', 1, 'mental', '🌌', '카드 2장을 뽑습니다.', fx.draw(2)),
    atk('bp_pounce', 'panther', '덮치기', 1, 'physical', 2, '🐆', { text: '공격. 적 하나에게 피해 2, 기절시킵니다.', effect: stunHit(2) }),
    // 헐커
    atk('hulk_slam', 'hulk', '감마 슬램', 2, 'physical', 5, '🌋'),
    evt('hulk_regen', 'hulk', '감마 재생', 1, 'energy', '💚', '내 영웅 체력 4 회복.', fx.heal(4)),
    evt('hulk_rampage', 'hulk', '날뛰기', 3, 'physical', '💢', '모든 미니언에게 피해 3.', async (g, pid) => g.damageAllMinions(3, pid), { form: 'hero' }),
    // 울브린
    atk('wol_snikt', 'wolverine', '스닉트!', 0, 'physical', 2, '✂'),
    evt('wol_scent', 'wolverine', '냄새 추적', 1, 'mental', '👃', '위협 2 제거, 카드 1장 뽑기.', async (g, pid) => { await g.thwart(pid, 2); g.draw(pid, 1); }),
    ally('wol_jubilee', 'wolverine', '불꽃놀이 쥬빌리', 2, 'energy', '🎇', { thw: 1, atk: 2, hp: 2 }),
    // 데드폴
    atk('dp_maximum', 'deadpool', '맥시멈 에포트', 3, 'physical', 6, '💯'),
    evt('dp_unicorn', 'deadpool', '유니콘 인형', 0, 'wild', '🦄', '내 영웅 체력 2 회복.', fx.heal(2)),
    ally('dp_cable', 'deadpool', '시간 여행자 케이블', 4, 'energy', '🔫', { thw: 2, atk: 3, hp: 4 }),
    // 스칼릿 위치
    dfn('sw_hexwall', 'witch', '헥스 장벽', 1, 'energy', '🔴', '이번 공격의 피해 -3.', block(3)),
    ally('sw_agatha', 'witch', '마녀 아가사 하크네스', 2, 'mental', '🧙‍♀️', { thw: 2, atk: 1, hp: 2 }),
    evt('sw_nullify', 'witch', '무력화 주문', 2, 'mental', '🚫', '적 하나를 기절시키고 혼란시킵니다.', async (g, pid) => { const t = await g.statusEnemy(pid, 'stunned'); if (t) g.applyStatus(t, 'confused'); }),
    // 미즈 마벨
    atk('mm_embiggen', 'msmarvel', '거대화 펀치', 2, 'physical', 5, '🦶'),
    ally('mm_nakia', 'msmarvel', '단짝 나키아', 2, 'mental', '🧕', { thw: 2, atk: 0, hp: 2 }),
    evt('mm_jersey', 'msmarvel', '저지시티 순찰', 1, 'energy', '🌆', '아무 계략에서 위협 3 제거.', fx.thw(3)),
    // 호크아이즈
    atk('hk_boomerang', 'hawkeye', '부메랑 화살', 1, 'physical', 1, '🪃', { text: '공격. 적 둘에게 각각 피해 1.', effect: two(1) }),
    ally('hk_kate', 'hawkeye', '후배 케이트 비샵', 3, 'physical', '🎯', { thw: 1, atk: 2, hp: 3 }),
    evt('hk_trick', 'hawkeye', '트릭 샷', 1, 'mental', '🎪', '위협 2 제거, 적 하나에게 피해 1.', async (g, pid) => { await g.thwart(pid, 2); await g.damage(pid, 1, {}); }),
    // 스파이더 워먼
    evt('swm_charm', 'spiderwoman', '매혹', 2, 'mental', '💞', '적 하나를 혼란시키고 기절시킵니다.', async (g, pid) => { const t = await g.statusEnemy(pid, 'confused'); if (t) g.applyStatus(t, 'stunned'); }),
    atk('swm_kick', 'spiderwoman', '비행 킥', 2, 'physical', 4, '🦵'),
    evt('swm_double', 'spiderwoman', '이중 첩보', 1, 'mental', '🕴', '아무 계략에서 위협 3 제거.', fx.thw(3)),
    // 로킷 라쿤
    evt('rk_trap', 'rocket', '덫 설치', 1, 'mental', '🪤', '적 하나를 기절시키고, 다음 카드 비용 자원 +1.', async (g, pid) => { await g.statusEnemy(pid, 'stunned'); g.bonus(pid, 1); }),
    upg('rk_ammo', 'rocket', '탄약 상자', 1, 'energy', '📦', '(사용 3번) 행동: 적 하나에게 피해 1.', { action: { name: '난사', uses: 3, effect: fx.dmg(1, { attack: false }) } }),
    atk('rk_notraccoon', 'rocket', '"너구리 아니라고!"', 1, 'physical', 3, '😾'),
    // 그룻
    evt('gr_iamgroot', 'groot', '나는 그룻이다', 0, 'mental', '🌱', '카드 1장 뽑기, 강인함을 얻습니다.', async (g, pid) => { g.draw(pid, 1); g.toughSelf(pid); }),
    evt('gr_roots', 'groot', '뿌리 휘감기', 1, 'physical', '🌿', '적 하나를 기절시키고, 위협 1 제거.', async (g, pid) => { await g.statusEnemy(pid, 'stunned'); await g.thwart(pid, 1); }),
    evt('gr_regrow', 'groot', '다시 자라기', 1, 'energy', '🌳', '내 영웅 체력 5 회복.', fx.heal(5)),
  ];
  return cards;
}

// ───────────── 모듈 조우 세트 (악당 덱에 하나 더 섞는 세트) ─────────────
function modularCards(E) {
  return [
    // 폭탄 소동
    E({ id: 'md_bomber', name: '폭탄 테러범', type: 'minion', set: 'mod_bomb', sch: 2, atk: 1, hp: 3, icon: '🧨', text: '미니언.' }),
    E({ id: 'md_bridge', name: '다리 폭파 계획', type: 'side', set: 'mod_bomb', threat: 3, perPlayer: false, accel: 1, icon: '🌉', text: '부가 계략. 가속: 악당 단계마다 주 계략 위협 +1.' }),
    E({ id: 'md_blast', name: '대폭발', type: 'treachery', set: 'mod_bomb', icon: '💥', text: '모든 영웅이 피해 1을 받습니다.', reveal: async (g) => g.damageAllHeroes(1, '대폭발') }),
    // 악당 연합 (마스터스 오브 이블)
    E({ id: 'md_melt', name: '멜트', type: 'minion', set: 'mod_masters', sch: 1, atk: 2, hp: 4, icon: '🫠', text: '미니언 (악당 연합).' }),
    E({ id: 'md_shark', name: '타이거 샥', type: 'minion', set: 'mod_masters', sch: 1, atk: 3, hp: 4, icon: '🦈', text: '미니언 (악당 연합).' }),
    E({ id: 'md_alliance', name: '악당들의 결탁', type: 'treachery', set: 'mod_masters', icon: '🤝', text: '멜트가 당신과 교전합니다 (없으면 위협 +2).', reveal: async (g, pid) => { const before = g.P(pid).engaged.length; g.summon(pid, 'md_melt'); if (g.P(pid).engaged.length === before) g.addThreat(2, '악당들의 결탁'); } }),
    // 총공세 (언더 어택)
    E({ id: 'md_trooper', name: '돌격대원', type: 'minion', set: 'mod_attack', sch: 0, atk: 2, hp: 3, icon: '🪖', text: '미니언.' }),
    E({ id: 'md_assault', name: '총공세', type: 'treachery', set: 'mod_attack', icon: '⚠', text: '악당이 당신에게 활성화합니다.', reveal: async (g, pid) => g.villainActivate(pid, '총공세') }),
    E({ id: 'md_siege', name: '포위 작전', type: 'side', set: 'mod_attack', threat: 2, perPlayer: true, hazard: 1, icon: '🏰', text: '부가 계략. 위험: 악당 단계마다 조우 카드 +1장.' }),
    // 히드로 군단
    E({ id: 'md_hydra', name: '히드로 돌격병', type: 'minion', set: 'mod_hydra', sch: 1, atk: 1, hp: 3, icon: '🐍', text: '미니언.' }),
    E({ id: 'md_hydra_bomber', name: '히드로 폭격기', type: 'minion', set: 'mod_hydra', sch: 1, atk: 2, hp: 2, icon: '🛩', text: '미니언. 들어올 때 모든 영웅이 피해 1.', onEnter: (g) => g.damageAllHeroes(1, '히드로 폭격기') }),
    E({ id: 'md_hydra_base', name: '히드로 비밀 기지', type: 'side', set: 'mod_hydra', threat: 3, perPlayer: false, hazard: 1, icon: '🏭', text: '부가 계략. 위험: 악당 단계마다 조우 카드 +1장.' }),
    // 둠봇 군단
    E({ id: 'md_doombot', name: '둠봇', type: 'minion', set: 'mod_doom', sch: 1, atk: 2, hp: 4, guard: true, icon: '🤖', text: '미니언. 경비.' }),
    E({ id: 'md_doom_armor', name: '라트베리아 강화복', type: 'attachment', set: 'mod_doom', mods: { atk: 1 }, tough: true, icon: '🛡', text: '부착: 악당 공격력 +1, 악당이 강인함을 얻습니다.' }),
    E({ id: 'md_doom_order', name: '둠의 명령', type: 'treachery', set: 'mod_doom', icon: '📜', text: '영웅 모습이면 내 영웅이 소진됩니다. 일상 모습이면 위협 +2.', reveal: async (g, pid) => { if (g.form(pid) === 'hero') g.exhaustHero(pid); else g.addThreat(2, '둠의 명령'); } }),
  ];
}

const MODULAR_SETS = [
  { id: 'mod_bomb', name: '폭탄 소동', icon: '🧨', desc: '폭탄 테러범과 다리 폭파 계획. 계략이 빨라져요.', cards: { md_bomber: 2, md_bridge: 1, md_blast: 1 } },
  { id: 'mod_masters', name: '악당 연합', icon: '🦹', desc: '멜트·타이거 샥 같은 강한 미니언이 몰려와요.', cards: { md_melt: 1, md_shark: 1, md_alliance: 2 } },
  { id: 'mod_attack', name: '총공세', icon: '⚠', desc: '악당이 더 자주 공격해요. 방어를 준비하세요.', cards: { md_trooper: 2, md_assault: 1, md_siege: 1 } },
  { id: 'mod_hydra', name: '히드로 군단', icon: '🐍', desc: '히드로 병력과 비밀 기지가 조우 카드를 늘려요.', cards: { md_hydra: 2, md_hydra_bomber: 1, md_hydra_base: 1 } },
  { id: 'mod_doom', name: '둠봇 군단', icon: '🤖', desc: '단단한 둠봇과 라트베리아 강화복.', cards: { md_doombot: 2, md_doom_armor: 1, md_doom_order: 1 } },
];

module.exports = { make, modularCards, MODULAR_SETS };
