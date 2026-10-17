'use strict';
// 스토리 미션: 골드 줄거리를 따라 차례로 진행. 함께 다니는 친구와 진행을 나눈다.
// 목표 종류
//  flag: 이벤트가 켜짐 · badge: 배지 · beat: 트레이너들을 이김(n명 이상) · item: 도구를 가짐
//  visit: 맵에 들어감 · npc: 미션에서 나타난 사람과 승부 · caught: 잡은 포켓몬 수
// 이야기 자체(사람이 나타나고 사라지는 것, 길이 열리는 것)는 원작 스크립트가 그대로 진행하고,
// 미션은 원작 이벤트를 보고 진행 상황을 알려 주며 덤으로 보상을 준다.
//  fought: 그 트레이너와 싸움 (이기든 지든)


const STORY = [
  {
    id: 'starter', title: '첫 번째 포켓몬',
    intro: [['엄마: {PLAYER}, 일어났니?'], ['옆집 공박사님이 너를 찾으셨단다.', '연구소에 가 보렴!']],
    goals: [{ type: 'flag', flag: 'EVENT_GOT_A_POKEMON_FROM_ELM', text: '공박사 연구소에서 포켓몬 받기' }],
    outro: [['공박사: 그 포켓몬을 잘 부탁한다!']],
    reward: { items: { POTION: 2 } },
  },
  {
    id: 'mrpokemon', title: '포켓몬 할아버지의 심부름',
    intro: [['공박사: 사실 부탁이 하나 있단다.'], ['30번도로 끝에 사는', '포켓몬 할아버지가 뭔가 대단한 걸', '발견했다는구나.'], ['무궁시티를 지나 북쪽으로 가서', '대신 받아 와 주겠니?']],
    goals: [
      { type: 'flag', flag: 'EVENT_GOT_MYSTERY_EGG_FROM_MR_POKEMON', text: '30번도로 끝 포켓몬 할아버지 댁에서 물건 받기' },
      { type: 'flag', flag: 'EVENT_GAVE_MYSTERY_EGG_TO_ELM', text: '연두마을 공박사에게 이상한알 전해 주기' },
    ],
    reward: { items: { POTION: 3 } },
    outro: [['공박사의 조수가 몬스터볼을 줄 거야.', '야생 포켓몬을 잡아 도감을 채워 보자!']],
  },
  {
    id: 'rival1', title: '수상한 빨간 머리',
    intro: [['연구소 창밖에서 빨간 머리 소년이', '안을 들여다보고 있었다…'], ['공박사: 연구소에서 포켓몬이 하나', '도둑맞았어! 범인은 빨간 머리라던데…'], ['무궁시티에서 그 녀석을 찾아 보자!']],
    goals: [{ type: 'fought', keys: ['RIVAL1:RIVAL1_1_CHIKORITA', 'RIVAL1:RIVAL1_1_CYNDAQUIL', 'RIVAL1:RIVAL1_1_TOTODILE'], text: '무궁시티에서 빨간 머리 소년과 승부' }],
    reward: { items: { POTION: 3 } },
    outro: [['빨간 머리 소년은 어디론가 가 버렸다…'], ['공박사: 다음은 도라지시티 체육관이다!', '체육관 관장을 이기면 배지를 준단다.']],
  },
  {
    id: 'sprout', title: '모다피의탑 수행',
    intro: [['도라지시티의 모다피의탑에서는', '스님들이 포켓몬과 함께 수행한다.'], ['꼭대기의 장로님을 이기면', '좋은 것을 주신다던데…']],
    goals: [{ type: 'flag', flag: 'EVENT_BEAT_SAGE_LI', text: '모다피의탑 꼭대기 장로 이기기' }],
    reward: { items: { SUPER_POTION: 2 } },
    outro: [['장로: 너와 포켓몬의 마음이', '하나가 되어 있구나.']],
  },
  {
    id: 'falkner', title: '첫 번째 배지',
    intro: [['도라지시티 체육관 관장 비상은', '비행 포켓몬의 달인이다.'], ['바위·전기·얼음 타입 기술이', '잘 통할 거야!']],
    goals: [{ type: 'badge', badge: 'ZEPHYRBADGE', text: '도라지 체육관 관장 비상 이기기 (윙배지)' }],
    reward: { money: 1000, items: { POKE_BALL: 5 } },
    outro: [['공박사(전화): 벌써 배지를 받았다고?', '대단하구나!'], ['남쪽 연결동굴을 지나면', '고동마을이 나온단다.']],
  },
  {
    id: 'slowpoke', title: '야돈의우물 사건',
    intro: [['고동마을에서 야돈이 사라지고 있다!'], ['누리 할아버지: 로켓단 놈들이', '야돈의 꼬리를 잘라 팔고 있다!'], ['야돈의우물 안의 로켓단을', '혼내 주자!']],
    goals: [{ type: 'flag', flag: 'EVENT_CLEARED_SLOWPOKE_WELL', text: '야돈의우물의 로켓단 물리치기' }],
    reward: { items: { GREAT_BALL: 5 }, money: 1000 },
    outro: [['로켓단: 젠장! 철수다!'], ['로켓단은 고동마을에서 도망쳤다!'], ['누리 할아버지: 고맙다! 이제 마음 놓고', '체육관에 도전하거라.']],
  },
  {
    id: 'bugsy', title: '벌레 박사',
    intro: [['고동마을 체육관 관장 호일은', '벌레 포켓몬 박사다.'], ['불꽃·비행 타입이 유리해!']],
    goals: [{ type: 'badge', badge: 'HIVEBADGE', text: '고동 체육관 관장 호일 이기기 (인섹트배지)' }],
    reward: { money: 1500 },
    outro: [['인섹트배지와 함께 비전머신(풀베기)을', '받았다! 너도밤나무숲의 가는 나무를', '벨 수 있다.']],
  },
  {
    id: 'whitney', title: '금빛시티의 꼭두',
    intro: [['너도밤나무숲을 지나면', '조토 제일의 대도시 금빛시티!'], ['체육관 관장 꼭두의 밀탱크는', '엄청 강하다는 소문이다…']],
    goals: [{ type: 'badge', badge: 'PLAINBADGE', text: '금빛 체육관 관장 꼭두 이기기 (레귤러배지)' }],
    reward: { money: 2000, items: { SUPER_POTION: 3 } },
    outro: [['꼭두: 흑흑… 너무해…', '…그래도 배지는 줄게!'], ['북쪽 36번도로에 이상한 나무가', '길을 막고 있다던데…']],
  },
  {
    id: 'sudowoodo', title: '움직이는 나무',
    intro: [['36번도로를 이상한 나무가 막고 있다!'], ['건드리면 꿈틀거린다고…', '혹시 포켓몬 아닐까?']],
    goals: [{ type: 'flag', flag: 'EVENT_FOUGHT_SUDOWOODO', text: '36번도로의 이상한 나무와 싸우기 (물뿌리개가 필요해!)' }],
    reward: { items: { ULTRA_BALL: 2 } },
    outro: [['나무의 정체는 꼬지모였다!'], ['길이 열렸다. 북쪽은 인주시티다.']],
  },
  {
    id: 'burned', title: '불탄탑의 라이벌',
    intro: [['인주시티의 불탄탑에는', '전설의 포켓몬이 잠들어 있다고 한다.'], ['어? 저 빨간 머리는…!']],
    goals: [{ type: 'fought', keys: ['RIVAL1:RIVAL1_3_CHIKORITA', 'RIVAL1:RIVAL1_3_CYNDAQUIL', 'RIVAL1:RIVAL1_3_TOTODILE'], text: '불탄탑에서 라이벌과 승부' }],
    reward: { items: { HYPER_POTION: 2 } },
    outro: [['라이벌은 사라졌다…'], ['인주시티 체육관 관장 유빈은', '고스트 포켓몬 사용자다!']],
  },
  {
    id: 'morty', title: '천리안의 유빈',
    intro: [['인주시티 체육관에는', '보이지 않는 바닥이 있다.'], ['고스트에게는 노말·격투 기술이', '통하지 않는다!']],
    goals: [{ type: 'badge', badge: 'FOGBADGE', text: '인주 체육관 관장 유빈 이기기 (팬텀배지)' }],
    reward: { money: 2500 },
    outro: [['팬텀배지와 함께 비전머신(파도타기)을', '받았다! 이제 물 위를 건널 수 있다.'], ['서쪽 담청시티로 가 보자.']],
  },
  {
    id: 'chuck', title: '바다 건너 진청시티',
    intro: [['담청시티 관장 규리는', '등대의 아픈 포켓몬 곁을 지키고 있다…'], ['바다 건너 진청시티의 약국에', '좋은 약이 있다고 한다.'], ['파도타기로 바다를 건너자!']],
    goals: [{ type: 'badge', badge: 'STORMBADGE', text: '진청 체육관 관장 사도 이기기 (쇼크배지)' }],
    reward: { money: 3000, items: { HYPER_POTION: 2 } },
    outro: [['쇼크배지와 함께 비전머신(공중날기)을', '받았다! 가 본 마을로 날아갈 수 있다.'], ['약을 가지고 담청시티로 돌아가자.']],
  },
  {
    id: 'jasmine', title: '강철의 규리',
    intro: [['약 덕분에 등대의 전룡이 건강해졌다!'], ['규리: 고마워요…', '이제 체육관에서 기다릴게요.']],
    goals: [{ type: 'badge', badge: 'MINERALBADGE', text: '담청 체육관 관장 규리 이기기 (스틸배지)' }],
    reward: { money: 3000 },
    outro: [['동쪽 분노의호수에서', '빨간 갸라도스를 봤다는 소문이…']],
  },
  {
    id: 'gyarados', title: '분노의호수',
    intro: [['분노의호수에서 갸라도스들이', '날뛰고 있다!'], ['그중에 빨간 갸라도스가 있다는데…']],
    goals: [{ type: 'flag', flag: 'EVENT_LAKE_OF_RAGE_RED_GYARADOS', text: '분노의호수의 빨간 갸라도스와 싸우기' }],
    reward: { items: { ULTRA_BALL: 3 } },
    outro: [['빨간비늘을 주웠다!'], ['목호: 갸라도스들이 억지로 진화당했어.', '황토마을에서 이상한 전파가 나오고 있다.'], ['같이 로켓단 아지트를 쳐부수자!']],
  },
  {
    id: 'rocketbase', title: '로켓단 아지트',
    intro: [['황토마을 기념품 가게 지하가', '로켓단의 아지트였다!'], ['목호: 계단을 찾았어. 들어가자!']],
    goals: [{ type: 'flag', flag: 'EVENT_CLEARED_ROCKET_HIDEOUT', text: '로켓단 아지트의 전파 장치 멈추기' }],
    reward: { money: 5000, items: { FULL_HEAL: 3 } },
    outro: [['목호: 해냈구나! 전파 장치를 멈췄다.'], ['로켓단은 아지트를 버리고 도망쳤다!'], ['황토마을 체육관 관장 류옹에게', '도전할 수 있게 되었다.']],
  },
  {
    id: 'pryce', title: '겨울의 류옹',
    intro: [['류옹은 얼음 포켓몬을 다루는', '노련한 트레이너다.'], ['불꽃·격투·바위·강철 기술이 좋다!']],
    goals: [{ type: 'badge', badge: 'GLACIERBADGE', text: '황토 체육관 관장 류옹 이기기 (아이스배지)' }],
    reward: { money: 4000 },
    outro: [['라디오: 여기는… 로켓단이다!', '라디오탑은 우리가 점거했다!'], ['금빛시티가 위험하다!']],
  },
  {
    id: 'radio', title: '라디오탑 점거',
    intro: [['로켓단이 금빛시티 라디오탑을', '점거했다!'], ['라디오탑에 올라가', '로켓단을 쫓아내자!']],
    goals: [{ type: 'flag', flag: 'EVENT_CLEARED_RADIO_TOWER', text: '라디오탑을 로켓단에게서 되찾기' }],
    reward: { money: 6000, items: { MAX_POTION: 2 } },
    outro: [['로켓단 간부: 비주기 님…', '로켓단은… 해산이다…'], ['라디오탑을 되찾았다!'], ['국장: 고맙다! 이건 감사의 표시다.']],
  },
  {
    id: 'clair', title: '드래곤 사용자 이향',
    intro: [['얼음샛길을 지나 검은먹시티로!'], ['관장 이향은 드래곤 포켓몬의', '사용자다. 얼음 기술이 약점!']],
    goals: [{ type: 'badge', badge: 'RISINGBADGE', text: '검은먹 체육관 관장 이향 이기기 (라이징배지)' }],
    reward: { money: 6000, items: { ULTRA_BALL: 5 } },
    outro: [['배지 8개를 모았다!'], ['공박사: 이제 포켓몬리그다!', '27번도로를 지나 챔피언로드로 가렴.']],
  },
  {
    id: 'victory', title: '챔피언로드',
    intro: [['챔피언로드 끝에서', '그 녀석이 기다리고 있다…']],
    goals: [{ type: 'fought', keys: ['RIVAL1:RIVAL1_5_CHIKORITA', 'RIVAL1:RIVAL1_5_CYNDAQUIL', 'RIVAL1:RIVAL1_5_TOTODILE'], text: '챔피언로드에서 라이벌과 승부' }],
    reward: { items: { MAX_REVIVE: 1, FULL_RESTORE: 2 } },
    outro: [['석영고원이 눈앞이다!']],
  },
  {
    id: 'league', title: '포켓몬리그',
    intro: [['사천왕 일목·독수·시바·카렌,', '그리고 챔피언 목호!'], ['모두 이기면 포켓몬 마스터다!']],
    goals: [{ type: 'flag', flag: 'EVENT_BEAT_ELITE_FOUR', text: '사천왕과 챔피언 목호 이기기' }],
    reward: { money: 20000, items: { MASTER_BALL: 1 } },
    outro: [['목호: 축하한다, 새로운 챔피언!'], ['너와 포켓몬의 이름은', '명예의 전당에 영원히 남을 것이다!'], ['…그리고 바다 건너 관동 지방에는', '더 많은 모험이 기다리고 있다!']],
  },
  {
    id: 'kanto', title: '관동 지방의 관장들',
    intro: [['관동 지방 체육관 8곳을 모두 돌자!'], ['22번도로를 지나면 상록시티다.']],
    goals: [{ type: 'count', what: 'badges', n: 16, text: '배지 16개 모으기' }],
    reward: { money: 30000 },
    outro: [['은빛산 꼭대기에', '전설의 트레이너가 있다는 소문이…']],
  },
  {
    id: 'red', title: '전설의 트레이너',
    intro: [['은빛산 가장 깊은 곳…'], ['말없이 서 있는 트레이너가 있다.']],
    goals: [{ type: 'beat', keys: ['RED:RED1'], text: '은빛산의 레드 이기기' }],
    reward: { money: 50000 },
    outro: [['레드: ……!'], ['…… ……'], ['진정한 챔피언이 되었다!', '모든 스토리를 깼다. 축하합니다!']],
  },
];

// 함께 하는 미션 (언제든 진행)
const COOP = [
  { id: 'coop_team', title: '단짝', text: '친구와 함께 다니기(동행) 시작하기', what: 'teams', n: 1, reward: { items: { POTION: 5 } } },
  { id: 'coop_win3', title: '협동 배틀 입문', text: '협동 배틀에서 3번 이기기', what: 'coopWins', n: 3, reward: { items: { GREAT_BALL: 5 } } },
  { id: 'coop_win15', title: '최강 콤비', text: '협동 배틀에서 15번 이기기', what: 'coopWins', n: 15, reward: { items: { ULTRA_BALL: 5, RARE_CANDY: 1 } } },
  { id: 'coop_trade', title: '첫 교환', text: '친구와 포켓몬 교환하기', what: 'trades', n: 1, reward: { items: { RARE_CANDY: 1 } } },
  { id: 'coop_pvp', title: '라이벌 의식', text: '친구와 대결 3번 하기', what: 'pvps', n: 3, reward: { items: { PROTEIN: 1 } } },
  { id: 'coop_dex30', title: '도감 채우기', text: '포켓몬 30종 잡기', what: 'caught', n: 30, reward: { items: { ULTRA_BALL: 5 } } },
  { id: 'coop_dex100', title: '도감 박사', text: '포켓몬 100종 잡기', what: 'caught', n: 100, reward: { items: { MASTER_BALL: 1 } } },
];

// 예전 저장(미션이 이야기를 대신하던 때)을 원작 이벤트 상태로 옮기기
const STARTER_NAME = { 152: 'CHIKORITA', 155: 'CYNDAQUIL', 158: 'TOTODILE' };
function migrateStory(d) {
  // 2: 공박사 전화(조수가 도라지 포켓몬센터에 옴)를 받지 못한 채 윙배지를 받은 저장
  if (d.sv === 1) {
    d.sv = 2;
    if (d.badges.includes('ZEPHYRBADGE') && !d.flags.EVENT_GOT_TOGEPI_EGG_FROM_ELMS_AIDE) { delete d.flags.EVENT_ELMS_AIDE_IN_VIOLET_POKEMON_CENTER; d.flags.EVENT_ELMS_AIDE_IN_LAB = true; }
    return;
  }
  if (d.sv >= 2) return;
  d.sv = 1;
  d.scenes = d.scenes || {};
  const f = d.flags;
  const on = (...l) => { for (const e of l) f[e] = true; };
  const off = (...l) => { for (const e of l) delete f[e]; };
  const ms = d.mission || { cur: 0 };
  const cur = ms.cur || 0;
  const starter = d.starter || [...d.party, ...d.box].map((m) => m.species).find((x) => STARTER_NAME[x]);
  if (!d.party.length && !d.box.length) return; // 아직 포켓몬이 없으면 처음부터 원작대로
  // 엄마에게 포켓기어 받기, 공박사에게 포켓몬 받기
  on('ENGINE_POKEGEAR', 'ENGINE_PHONE_CARD', 'EVENT_PLAYERS_HOUSE_MOM_1', 'EVENT_GOT_A_POKEMON_FROM_ELM', 'EVENT_RIVAL_CHERRYGROVE_CITY');
  off('EVENT_PLAYERS_HOUSE_MOM_2');
  if (STARTER_NAME[starter]) on(`EVENT_GOT_${STARTER_NAME[starter]}_FROM_ELM`, `EVENT_${STARTER_NAME[starter]}_POKEBALL_IN_ELMS_LAB`);
  Object.assign(d.scenes, { PLAYERS_HOUSE_1F: 1, PLAYERS_HOUSE_2F: 1, NEW_BARK_TOWN: 1, ELMS_LAB: 2 });
  if (cur >= 2) {
    // 포켓몬 할아버지 심부름 끝
    on('EVENT_GOT_MYSTERY_EGG_FROM_MR_POKEMON', 'ENGINE_POKEDEX', 'EVENT_GAVE_MYSTERY_EGG_TO_ELM', 'EVENT_RIVAL_NEW_BARK_TOWN', 'EVENT_ROUTE_30_BATTLE',
      'EVENT_CHIKORITA_POKEBALL_IN_ELMS_LAB', 'EVENT_CYNDAQUIL_POKEBALL_IN_ELMS_LAB', 'EVENT_TOTODILE_POKEBALL_IN_ELMS_LAB', 'EVENT_COP_IN_ELMS_LAB', 'EVENT_LEARNED_TO_CATCH_POKEMON');
    off('EVENT_ROUTE_30_YOUNGSTER_JOEY');
    if (d.bag.MYSTERY_EGG) delete d.bag.MYSTERY_EGG;
    Object.assign(d.scenes, { MR_POKEMONS_HOUSE: 1, ROUTE_29: 0, CHERRYGROVE_CITY: cur >= 3 ? 0 : 1 });
    if ([...d.party, ...d.box].some((m) => m.species === 175 || m.species === 176)) on('EVENT_GOT_TOGEPI_EGG_FROM_ELMS_AIDE', 'EVENT_ELMS_AIDE_IN_VIOLET_POKEMON_CENTER');
  }
  if (cur >= 4) { on('EVENT_GOT_HM05_FLASH', 'EVENT_BEAT_SAGE_LI', 'EVENT_RIVAL_SPROUT_TOWER'); d.scenes.SPROUT_TOWER_3F = 1; }
  if (cur >= 5) on('EVENT_BEAT_FALKNER');
  if (cur >= 6) on('EVENT_CLEARED_SLOWPOKE_WELL', 'EVENT_SLOWPOKE_WELL_ROCKETS', 'EVENT_SLOWPOKE_WELL_SLOWPOKES', 'EVENT_AZALEA_TOWN_SLOWPOKETAIL_ROCKET');
  if (cur >= 7) on('EVENT_BEAT_BUGSY');
  if (cur >= 8) on('EVENT_BEAT_WHITNEY', 'EVENT_GOT_SQUIRTBOTTLE');
  if (cur >= 9) on('EVENT_FOUGHT_SUDOWOODO', 'EVENT_ROUTE_36_SUDOWOODO');
  if (cur >= 10) on('EVENT_RIVAL_BURNED_TOWER');
  if (cur >= 11) on('EVENT_BEAT_MORTY');
  if (cur >= 14) on('EVENT_LAKE_OF_RAGE_RED_GYARADOS');
  if (cur >= 15) on('EVENT_CLEARED_ROCKET_HIDEOUT');
  if (cur >= 17) on('EVENT_CLEARED_RADIO_TOWER');
  if (cur >= 20) on('EVENT_BEAT_ELITE_FOUR');
}

module.exports = { STORY, COOP, migrateStory };
