'use strict';
/*
 * 킵 더 히어로즈 아웃 — 게임 데이터
 * 원작의 규칙 구조(몬스터 9종족, 카드 아이콘 행동, 손패 5장, 매 차례 뒤 용사 침입, 소진·고무,
 * 아이템 제작→전리품 카드, 2웨이브, 대보물을 빼앗기면 패배)를 따르고, 세부 수치와 카드는 이 프로젝트에서 직접 만든 것입니다.
 */

// 아이콘: A 공격 · M 이동 · P 방 작동 · S 소환 · T 함정
const ICONS = {
  A: { name: '공격', icon: '⚔', help: '같은 방의 용사 하나를 공격해요 (내 몬스터의 공격력만큼 피해).' },
  M: { name: '이동', icon: '👢', help: '내 몬스터 하나를 옆 방으로 1칸 옮겨요. 방에 아이템이 있으면 들고 갈 수 있어요.' },
  P: { name: '방 작동', icon: '✋', help: '내 몬스터가 있는 방의 능력을 써요 (대장간: 무기 제작, 제단: 전리품 교환 등).' },
  S: { name: '소환', icon: '🥚', help: '쉬고 있는 몬스터 하나를 둥지나 내 몬스터가 있는 방에 불러와요.' },
  T: { name: '함정', icon: '🪤', help: '내 몬스터가 있는 방이나 옆 방에 함정을 놓아요. 용사가 들어오면 피해 1.' },
};

// ───────────── 던전 (4×3 방) ─────────────
const ROOMS = [
  { id: 'gate_w', name: '서쪽 입구', type: 'entrance', x: 0, y: 0 },
  { id: 'hall', name: '보물 창고', type: 'treasure', x: 1, y: 0, chests: 1 },
  { id: 'forge', name: '대장간', type: 'forge', x: 2, y: 0 },
  { id: 'gate_e', name: '동쪽 입구', type: 'entrance', x: 3, y: 0 },
  { id: 'trapshop', name: '함정 공방', type: 'trapshop', x: 0, y: 1 },
  { id: 'lair', name: '몬스터 둥지', type: 'lair', x: 1, y: 1 },
  { id: 'lab', name: '물약 연구실', type: 'lab', x: 2, y: 1 },
  { id: 'gold', name: '금화 보관실', type: 'treasure', x: 3, y: 1, chests: 1 },
  { id: 'altar', name: '어둠의 제단', type: 'altar', x: 0, y: 2 },
  { id: 'gem', name: '보석 방', type: 'treasure', x: 1, y: 2, chests: 1 },
  { id: 'vault', name: '대보물 금고', type: 'vault', x: 2, y: 2, chests: 3 },
  { id: 'crypt', name: '납골당', type: 'crypt', x: 3, y: 2 },
];
const ROOM_MAP = Object.fromEntries(ROOMS.map((r) => [r.id, r]));
for (const r of ROOMS) r.adj = ROOMS.filter((o) => Math.abs(o.x - r.x) + Math.abs(o.y - r.y) === 1).map((o) => o.id);

// 방 능력 (✋ 방 작동)
const ROOM_ACTIONS = {
  entrance: { name: '입구 함정', text: '이 입구에 함정을 하나 놓아요.' },
  treasure: { name: '보물 지키기', text: '이 방에 함정을 하나 놓아요.' },
  vault: { name: '금고 수호', text: '이 방에 함정을 하나 놓아요.' },
  forge: { name: '무기 제작', text: '이 방에 무기(아이템) 하나를 만들어요 (최대 2개). 제단으로 옮겨 전리품 카드로 바꿔요.' },
  lab: { name: '물약 제조', text: '이 방에 물약(아이템) 하나를 만들어요 (최대 2개). 제단으로 옮겨 전리품 카드로 바꿔요.' },
  trapshop: { name: '함정 설치', text: '이 방이나 옆 방에 함정을 2개 놓아요.' },
  lair: { name: '새끼 부화', text: '쉬고 있는 내 몬스터 하나를 이 방에 소환해요.' },
  altar: { name: '전리품 교환', text: '이 방의 아이템 하나를 바쳐 전리품 카드 하나를 골라 내 버림 더미에 넣어요.' },
  crypt: { name: '뼈 되살리기', text: '이 방의 뼈 하나를 써서 (다른 방의 뼈는 몬스터가 이동하며 들고 와요) 쉬고 있는 내 몬스터 하나를 여기 소환해요. 뼈가 없으면 같은 방 내 몬스터 체력을 모두 회복해요.' },
};

// ───────────── 몬스터 종족 ─────────────
const c = (name, icons, text = '') => ({ name, icons, text });
const CLANS = [
  { id: 'rats', name: '쥐인간', icon: '🐀', color: '#9a8468', count: 9, hp: 1, atk: 1, level: '쉬움',
    ability: '번식·떼 공격: 🥚 소환할 때 2마리를 함께 불러오고, 공격 피해는 같은 방의 쥐인간 수만큼 (최대 3).', desc: '숫자로 밀어붙이는 쥐 떼. 아무리 쓰러져도 금방 다시 늘어나요.',
    deck: [c('우글우글', ['S', 'M']), c('떼 지어 물기', ['A', 'S']), c('하수구 질주', ['M', 'M']), c('쥐구멍 기습', ['A', 'M']), c('둥지 짓기', ['S', 'P']),
      c('이빨 갈기', ['A', 'A']), c('잡동사니 줍기', ['M', 'P']), c('찍찍 신호', ['S', 'M']), c('물어뜯기', ['A']), c('굴 파기', ['P', 'M'])] },
  { id: 'slimes', name: '슬라임', icon: '🟢', color: '#5cc84a', count: 8, hp: 2, atk: 1, level: '쉬움',
    ability: '끈적끈적·분열: 슬라임이 있는 방의 용사는 움직이지 못해요. 슬라임이 쓰러지면 그 자리에 작은 슬라임(체력 1)이 생겨요. 공격 피해는 같은 방 슬라임 수만큼 (최대 2).', desc: '느리지만 용사의 발을 묶는 끈적한 젤리. 길목을 막는 데 최고예요.',
    deck: [c('분열', ['S', 'S']), c('스며들기', ['M', 'M']), c('녹이기', ['A', 'M']), c('끈적 덮치기', ['A', 'S']), c('흘러가기', ['M', 'P']),
      c('젤리 벽', ['T', 'M']), c('산성 침', ['A']), c('출렁출렁', ['S', 'M']), c('웅덩이', ['T', 'P']), c('흡수', ['A', 'P'])] },
  { id: 'gnolls', name: '놀', icon: '🐺', color: '#c8843a', count: 7, hp: 2, atk: 1, level: '보통',
    ability: '용병단: 용사를 쓰러뜨리면 금화 1개. 내 차례에 금화 2개로 놀 1마리를 고용(소환)할 수 있어요.', desc: '돈만 주면 뭐든 하는 하이에나 용병. 싸울수록 부자가 돼요.',
    deck: [c('창 찌르기', ['A', 'A']), c('사냥 돌격', ['A', 'M']), c('킬킬 웃음', ['M', 'S']), c('약탈 분배', ['P', 'A']), c('무리 사냥', ['A', 'M']),
      c('발 빠른 추적', ['M', 'M']), c('용병 계약', ['S', 'P']), c('도끼 투척', ['A']), c('야영지', ['P', 'M']), c('으르렁', ['A', 'S'])] },
  { id: 'skeletons', name: '해골', icon: '💀', color: '#e8e2d0', count: 6, hp: 1, atk: 1, level: '보통',
    ability: '뼈 폭발: 해골이 쓰러지면 그 방의 용사 하나에게 피해 1을 줘요.', desc: '약하지만 쓰러질 때도 폭발하는 해골 병사. 떼로 몰면 무서워요.',
    deck: [c('뼈 칼날', ['A', 'M']), c('달그락 행진', ['M', 'M']), c('무덤에서', ['S', 'P']), c('해골 방패진', ['A', 'S']), c('뼈 조립', ['S', 'M']),
      c('저주받은 검', ['A', 'A']), c('묘지 순찰', ['M', 'P']), c('뼈 함정', ['T', 'A']), c('부활', ['S']), c('돌격 나팔', ['A', 'M'])] },
  { id: 'lizards', name: '리자드맨', icon: '🦎', color: '#3a9a7a', count: 5, hp: 2, atk: 1, level: '보통',
    ability: '독 비늘: 리자드맨에게 공격받은 용사는 바로 소진돼요 (이번에 행동하지 못해요).', desc: '독을 품은 늪지 전사. 한 대 한 대가 아프고 용사를 마비시켜요.',
    deck: [c('독 창', ['A', 'M']), c('늪 잠행', ['M', 'M']), c('꼬리치기', ['A']), c('알 부화', ['S', 'P']), c('매복', ['T', 'M']),
      c('비늘 갑옷', ['A', 'P']), c('사냥 신호', ['S', 'A']), c('독 다트', ['A', 'A']), c('늪지 기도', ['P', 'M']), c('기습', ['M', 'A'])] },
  { id: 'imps', name: '임프', icon: '😈', color: '#d84a4a', count: 4, hp: 1, atk: 2, level: '보통',
    ability: '장난꾸러기: 👢 하나로 2칸까지 움직이고, ✋ 방을 작동할 때마다 그 방에 함정도 하나 놓아요.', desc: '함정을 깔고 날아다니는 꼬마 악마. 던전 곳곳을 바쁘게 누벼요.',
    deck: [c('날갯짓', ['M', 'M']), c('함정 깔기', ['T', 'T']), c('불꽃 장난', ['A', 'T']), c('작은 소환', ['S', 'M']), c('공방 일꾼', ['P', 'P']),
      c('꼬리 찌르기', ['A', 'M']), c('지옥 불씨', ['A', 'P']), c('장난질', ['T', 'M']), c('악마 계약', ['S', 'P']), c('날카로운 웃음', ['A'])] },
  { id: 'ghosts', name: '폴터가이스트', icon: '👻', color: '#a8b8f0', count: 3, hp: 2, atk: 1, level: '어려움',
    ability: '벽 통과·겁주기: 👢 하나로 아무 방에나 갈 수 있어요. ⚔ 공격 대신 용사를 옆 방으로 쫓아낼 수도 있어요.', desc: '벽을 통과하는 장난 유령. 용사를 겁주어 보물에서 떼어 놓아요.',
    deck: [c('벽 통과', ['M', 'P']), c('으스스', ['A', 'M']), c('유령 소환', ['S', 'M']), c('물건 날리기', ['A', 'A']), c('사라지기', ['M', 'M']),
      c('저주의 속삭임', ['A', 'P']), c('출몰', ['M', 'T']), c('차가운 손길', ['A']), c('유령의 집', ['P', 'S']), c('비명', ['A', 'M'])] },
  { id: 'witches', name: '마녀', icon: '🧙‍♀️', color: '#8a4ac8', count: 2, hp: 2, atk: 2, level: '어려움',
    ability: '마녀의 솥: ✋ 어느 방에서든 물약을 만들 수 있고, 그때 같은 방 몬스터들의 체력을 모두 회복해요. 공격받은 용사는 저주로 소진돼요.', desc: '물약을 끓이는 두 자매 마녀. 몬스터를 치료하고 전리품을 빨리 모아요.',
    deck: [c('솥 젓기', ['P', 'P']), c('저주', ['A', 'P']), c('빗자루 비행', ['M', 'M']), c('사역마', ['S', 'M']), c('독약 투척', ['A', 'M']),
      c('주문 연구', ['P', 'M']), c('개구리 변신', ['A', 'A']), c('마법진', ['T', 'P']), c('자매 소환', ['S', 'P']), c('불길한 노래', ['A'])] },
  { id: 'dragon', name: '드래곤', icon: '🐉', color: '#d8542a', count: 1, hp: 4, atk: 2, level: '어려움',
    ability: '불의 숨결: 공격할 때 옆 방의 용사도 노릴 수 있어요. ✋ 방을 작동하면 체력 1 회복.', desc: '단 한 마리지만 금고를 지키는 거대한 용. 크게 다쳐도 금방 회복해요.',
    deck: [c('불의 숨결', ['A', 'P']), c('날개 펴기', ['M', 'M']), c('꼬리 휘두르기', ['A', 'M']), c('보물 위의 낮잠', ['P', 'P']), c('포효', ['A', 'P']),
      c('비늘 단단히', ['P', 'M']), c('화염 폭풍', ['A', 'M']), c('알 지키기', ['S', 'P']), c('잿더미', ['T', 'A']), c('하늘 높이', ['M', 'A'])] },
  // 확장: 플레잉 위드 파이어
  { id: 'emberlings', name: '불씨족', icon: '🔥', color: '#ff8a2a', count: 6, hp: 1, atk: 1, level: '보통', pack: 'fire',
    ability: '불장난: 🪤 함정 대신 불을 붙여요. ✋ 방을 작동하면 그 방에도 불이 붙어요. 불씨족은 불에 다치지 않아요.', desc: '던전을 활활 태우고 싶어 안달 난 꼬마 불꽃들. 불은 용사를 태우지만 아이템과 몬스터도 태워요!',
    deck: [c('불씨 튀기기', ['T', 'M']), c('활활', ['T', 'A']), c('불꽃 춤', ['M', 'M']), c('작은 불씨', ['S', 'T']), c('불쏘시개', ['P', 'M']),
      c('화염 박치기', ['A', 'A']), c('잿더미에서', ['S', 'P']), c('연기 피우기', ['M', 'T']), c('불꽃 손가락', ['A']), c('모닥불', ['P', 'S'])] },
];
const CLAN_MAP = Object.fromEntries(CLANS.map((x) => [x.id, x]));

// ───────────── 전리품 카드 (제단에서 아이템과 교환) ─────────────
const LOOT = [
  { id: 'axe', name: '무쇠 도끼', icons: ['A', 'A', 'A'], text: '' },
  { id: 'horn', name: '돌격 나팔', icons: ['M', 'M', 'A', 'A'], text: '' },
  { id: 'ritual', name: '소환 의식', icons: ['S', 'S', 'S'], text: '' },
  { id: 'blueprint', name: '함정 설계도', icons: ['T', 'T', 'T'], text: '' },
  { id: 'cloak', name: '그림자 망토', icons: ['M', 'M', 'M', 'P'], text: '' },
  { id: 'drum', name: '전쟁 북', icons: ['A', 'A', 'S'], text: '' },
  { id: 'bomb', name: '화염 폭탄', icons: [], special: 'bomb', text: '내 몬스터가 있는 방 하나를 골라, 그 방의 모든 용사에게 피해 2.' },
  { id: 'fog', name: '잠의 안개', icons: ['M'], special: 'fog', text: '방 하나의 모든 용사를 소진시켜요. 그리고 👢 이동 1.' },
  { id: 'potion', name: '회복의 큰 물약', icons: ['M'], special: 'heal', text: '내 모든 몬스터의 체력을 가득 채우고, 👢 이동 1.' },
  { id: 'lock', name: '마법 자물쇠', icons: [], special: 'lock', text: '금고에 빼앗긴 보물 상자 하나를 되돌려 놓아요 (최대 3개).' },
  { id: 'crown', name: '마왕의 왕관', icons: ['A', 'S', 'M', 'P'], text: '' },
  { id: 'spikes', name: '가시 바닥', icons: ['T', 'T', 'A'], text: '' },
];
const LOOT_DECK = ['axe', 'axe', 'horn', 'horn', 'ritual', 'ritual', 'blueprint', 'cloak', 'cloak', 'drum', 'drum', 'bomb', 'bomb', 'fog', 'fog', 'potion', 'lock', 'crown', 'spikes', 'spikes'];
const LOOT_MAP = Object.fromEntries(LOOT.map((x) => [x.id, x]));

// ───────────── 용사 ─────────────
const HEROES = {
  warrior: { name: '전사', icon: '🗡', color: '#d84040', hp: 3, atk: 2, move: 1, text: '튼튼하고 세게 때려요 (피해 2).' },
  archer: { name: '궁수', icon: '🏹', color: '#3aa84a', hp: 2, atk: 1, move: 1, ranged: true, text: '같은 방에 몬스터가 없으면 옆 방 몬스터를 쏴요.' },
  rogue: { name: '도적', icon: '🗝', color: '#8a5ad8', hp: 2, atk: 1, move: 2, greedy: true, text: '2칸씩 움직이고, 몬스터가 있어도 보물부터 훔쳐요.' },
  mage: { name: '마법사', icon: '🔮', color: '#3a7ad8', hp: 2, atk: 1, move: 1, aoe: true, inspire: true, text: '방의 모든 몬스터에게 피해 1. 소진되지 않고, 같은 방 용사를 다시 일으켜요.' },
  knight: { name: '기사', icon: '🛡', color: '#c8a040', hp: 4, atk: 2, move: 1, elite: true, text: '정예. 아주 튼튼해요 (체력 4).' },
  assassin: { name: '암살자', icon: '🗡', color: '#5a2a8a', hp: 3, atk: 2, move: 2, greedy: true, elite: true, text: '정예 도적. 2칸씩 움직이며 보물을 노려요.' },
  archmage: { name: '대마법사', icon: '✨', color: '#2a5ad8', hp: 3, atk: 2, move: 1, aoe: true, inspire: true, elite: true, text: '정예 마법사. 방의 모든 몬스터에게 피해 2.' },
  ranger: { name: '레인저', icon: '🏹', color: '#2a8a3a', hp: 3, atk: 2, move: 1, ranged: true, elite: true, text: '정예 궁수. 옆 방까지 피해 2.' },
  paladin: { name: '성기사', icon: '⚜', color: '#e8e0a0', hp: 5, atk: 2, move: 1, elite: true, text: '3웨이브 전설 용사. 아주 튼튼해요 (체력 5).' },
  king: { name: '용사왕 레온하르트', icon: '👑', color: '#f8c830', hp: 12, atk: 3, move: 1, aoe: true, inspire: true, boss: true, text: '보스! 방의 모든 몬스터에게 피해 3, 소진되지 않고 동료를 일으켜요. 쓰러뜨려야 승리!' },
};
const BOSS = { type: 'king', gate: 'gate_w' };
const WAVES = [
  { name: '1웨이브 — 풋내기 용사들', cards: { warrior: 4, archer: 3, rogue: 3, mage: 2 } },
  { name: '2웨이브 — 정예 원정대', cards: { warrior: 3, archer: 2, rogue: 2, mage: 1, knight: 2, assassin: 2, archmage: 1, ranger: 1 } },
  { name: '3웨이브 — 전설의 용사단', cards: { knight: 2, assassin: 2, archmage: 2, ranger: 2, paladin: 2, warrior: 2 } },
];
// 확장 (대기실에서 켜고 끔)
const EXPANSIONS = [
  { id: 'fire', name: '🔥 플레잉 위드 파이어', desc: '불씨족(몬스터) 추가 + 불: 용사 단계 전에 방의 불마다 용사에게 피해 1 (용사가 없으면 아이템을 태우고, 그것도 없으면 몬스터에게 피해 1). 태우고 나면 불이 꺼져요.' },
  { id: 'boss', name: '👑 보스 전투', desc: '마지막 웨이브가 끝나면 보스 「용사왕 레온하르트」(체력 12)가 쳐들어와요. 보스까지 쓰러뜨려야 승리!' },
  { id: 'wave3', name: '⚔ 3웨이브', desc: '전설의 용사단(성기사 등)이 나오는 세 번째 웨이브를 추가해요.' },
];

const DIFFICULTIES = [
  { id: 'practice', name: '연습 (아주 쉬움)', desc: '용사가 1명씩, 1웨이브만. 규칙 익히기용.', perTurn: 1, waves: 1, size: 0.7 },
  { id: 'easy', name: '쉬움', desc: '차례마다 용사 1명씩 침입, 2웨이브.', perTurn: 1, waves: 2, size: 1 },
  { id: 'normal', name: '보통', desc: '차례마다 용사 2명씩 침입 (원작 기본).', perTurn: 2, waves: 2, size: 1 },
  { id: 'hard', name: '어려움', desc: '차례마다 용사 2명씩, 용사 체력 +1.', perTurn: 2, waves: 2, size: 1, hpBonus: 1 },
];

const HAND = 5;

module.exports = { EXPANSIONS, BOSS, ICONS, ROOMS, ROOM_MAP, ROOM_ACTIONS, CLANS, CLAN_MAP, LOOT, LOOT_MAP, LOOT_DECK, HEROES, WAVES, DIFFICULTIES, HAND };
