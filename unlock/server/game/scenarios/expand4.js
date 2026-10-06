'use strict';
// 언락! 확장 패치 4 — 인챈티드 어드벤처 · 스타워즈를 원작 분량에 가깝게
// add: 새 카드, set: 기존 카드의 값 바꾸기 (배열은 통째로 바뀜)

module.exports = [
  // ───── 킬레아의 분노 ─────
  {
    id: 'kilea',
    set: {
      village: { spots: [{ label: '야자수 꼭대기', x: 80, y: 24, reveal: 'flower' }] },
      elder: { shows: ['reef', 'drum'], text: '“제물은 분화구 제단에 꽃 → 진주 → 노래 순서로 바쳐야 한다. 진주는 산호초의 큰조개가 품고 있고, 노래의 북장단은 토템에 새겨져 있지. 그런데 우리 북이 찢어졌구나…”' },
      pearl: { from: ['clam', 'knife'], discard: ['clam', 'knife'], text: '조개껍데기를 벌리자 영롱한 진주가 굴러 나왔다.' },
      crater: { shows: ['tiki'], text: '판자를 놓고 건넜다! 분화구 가장자리에 불의 신전. 거대한 티키 석상이 문을 지킨다.' },
    },
    add: [
      { key: 'reef', type: 'place', title: '산호초 해변', art: '🪸🐢🐚', text: '맑은 물속에 거대한 큰조개가 입을 꽉 다물고 있다. 바다거북이 느긋하게 헤엄친다.', shows: ['clam'], spots: [{ label: '모래 속 반짝임', x: 30, y: 74, reveal: 'knife' }, { label: '바나나 나무', x: 80, y: 30, reveal: 'leaf' }] },
      { key: 'clam', type: 'red', title: '거대한 큰조개', art: '🦪', text: '입을 꽉 다물었다.' },
      { key: 'knife', type: 'blue', title: '조개껍데기 칼', art: '🔪', text: '' },
      { key: 'drum', type: 'red', title: '찢어진 북', art: '🥁', text: '북 가죽에 구멍이 났다.' },
      { key: 'leaf', type: 'blue', title: '질긴 바나나 잎', art: '🍃', text: '' },
      { key: 'drumOk', type: 'item', from: ['drum', 'leaf'], discard: ['drum', 'leaf'], shows: ['path'], title: '고친 북', art: '🥁✨', text: '바나나 잎을 팽팽하게 덮자 둥! 맑은 소리가 난다. 이제 화산으로!' },
      { key: 'tiki', type: 'code', title: '티키 석상 문', art: '🗿', text: '석상 입에 새겨진 글: “노래를 아는 자 — 둥의 수, 그리고 탁의 수.” 숫자 2자리.', code: '31', result: 'altar', hint: ['마을 토템의 북 그림을 세어 보세요.', '둥 3번, 탁 1번 → 31'] },
      { key: 'altar', type: 'place', title: '불의 신전', art: '🔥🗿🌋', text: '문이 열리자 용암 연못 위에 킬레아의 제단. 신의 눈이 붉게 타오른다!', shows: ['offering'] },
      { key: 'trap1', type: 'trap', from: ['clam', 'leaf'], title: '조개가 꽉!', text: '잎으로 조개를 간질이자 조개가 손가락을 꽉 물었다! 아야야.', penalty: 1 },
    ],
  },
  // ───── 놀이공원 대소동 ─────
  {
    id: 'amusement',
    set: {
      plaza: { shows: ['mission', 'coaster', 'booth', 'horse'], spots: [{ label: '간식 수레', x: 24, y: 66, reveal: 'carrot' }, { label: '대관람차', emoji: '🎡', x: 76, y: 32, text: '칸 번호가 거꾸로 지나간다: 8, 6, 4, 2…' }] },
      shot: { shows: ['maze'], text: '만점! 상품으로 받은 곰인형 배에 숫자 “7”이 수놓여 있다. 대관람차로 가는 길은 거울 미로를 통과해야 한다.' },
    },
    add: [
      { key: 'horse', type: 'red', title: '뛰쳐나온 회전목마 말', art: '🎠', text: '마법에 걸린 나무 말이 광장을 뛰어다닌다. 안장 주머니에 무언가 반짝인다.' },
      { key: 'carrot', type: 'blue', title: '당근 스틱', art: '🥕', text: '' },
      { key: 'calm', type: 'item', from: ['horse', 'carrot'], discard: ['horse', 'carrot'], title: '얌전해진 말', art: '🎠💤', text: '당근을 먹은 나무 말이 히힝 하고 얌전해졌다.', spots: [{ label: '안장 주머니', x: 50, y: 50, reveal: 'token' }] },
      { key: 'maze', type: 'place', title: '거울 미로', art: '🪞🤡🎈', text: '수십 개의 내가 비친다! 출구 앞을 장난꾸러기 광대가 막고 있다.', shows: ['clown'], spots: [{ label: '거울 뒤 풍선 다발', x: 74, y: 30, reveal: 'balloon' }] },
      { key: 'clown', type: 'red', title: '장난꾸러기 광대', art: '🤡', text: '“빠~밤! 풍선 하나 주면 비켜 주지!”' },
      { key: 'balloon', type: 'blue', title: '풍선', art: '🎈', text: '' },
      { key: 'exit', type: 'item', from: ['clown', 'balloon'], discard: ['clown', 'balloon'], shows: ['wheel'], title: '미로 탈출', art: '🎈🤡', text: '광대가 풍선을 받고 춤을 추며 비켜났다. 저 앞에 대관람차 관리 상자!' },
      { key: 'trap2', type: 'trap', from: ['clown', 'cork'], title: '펑!', text: '코르크로 광대 코를 찔렀더니 코가 터지며 물이 뿜어져 나왔다. 흠뻑 젖었다.', penalty: 1 },
    ],
  },
  // ───── 카멜롯의 저주 ─────
  {
    id: 'camelot',
    set: {
      knights: { shows: ['forest'], text: '물약 연기에 기사들이 깨어났다! 퍼시벌: “호수의 여인은 아발론 호수에 계시오. 하지만 가는 길에 브로셀리앙드 숲의 녹색 기사가 버티고 있소. 그는 겨울에도 푸른 호랑가시나무를 보면 길을 비켜 주지.”' },
      lady: { shows: ['sword', 'scroll'] },
    },
    remove: ['out'],
    add: [
      { key: 'forest', type: 'place', title: '브로셀리앙드 숲', art: '🌲🧝🌫️', text: '안개 낀 마법의 숲. 거대한 녹색 기사가 도끼를 짚고 길을 막는다.', shows: ['greenknight'], spots: [{ label: '눈 덮인 덤불', x: 24, y: 72, reveal: 'holly' }] },
      { key: 'greenknight', type: 'red', title: '녹색 기사', art: '🟢🛡️🪓', text: '“이 길을 지나려는 자, 겨울의 증표를 보여라.”' },
      { key: 'holly', type: 'blue', title: '호랑가시나무 가지', art: '🌿🔴', text: '' },
      { key: 'passage', type: 'item', from: ['greenknight', 'holly'], discard: ['greenknight', 'holly'], shows: ['lake'], title: '열린 숲길', art: '🌲➡️', text: '녹색 기사가 고개를 숙이고 비켜섰다. 숲 너머로 안개 낀 호수가 보인다.' },
      { key: 'scroll', type: 'item', title: '여인의 두루마리', art: '📜', text: '“모르가나의 수정 구슬을 깨는 주문: 물 · 불 · 바람 · 땅 — 이것을 거꾸로 외워라.”' },
      { key: 'excalibur', type: 'item', from: ['sword', 'scabbard'], discard: ['sword', 'scabbard'], shows: ['morganaTower'], title: '엑스칼리버', art: '⚔️✨', text: '칼이 칼집에 꽂히자 빛이 솟구친다. 그 빛이 북쪽 모르가나의 탑을 가리킨다. 저주의 근원은 아직 남아 있다!' },
      { key: 'morganaTower', type: 'place', title: '모르가나의 탑', art: '🗼🔮🌑', text: '모르가나가 수정 구슬을 쥐고 웃는다. “칼이 있어도 이 구슬이 있는 한 저주는 영원하다!” 창가에 멀린의 부엉이가 날아와 앉는다.', shows: ['morgana'], spots: [{ label: '창가', x: 80, y: 30, reveal: 'owl' }] },
      { key: 'morgana', type: 'red', title: '마녀 모르가나', art: '🧙‍♀️🔮', text: '“무릎 꿇어라, 펜드래건!”' },
      { key: 'owl', type: 'blue', title: '멀린의 부엉이', art: '🦉', text: '' },
      { key: 'orbspell', type: 'machine', from: ['morgana', 'owl'], discard: ['owl'], title: '빼앗은 수정 구슬', art: '🦉🔮', text: '부엉이가 날아들어 구슬을 낚아챘다! 구슬이 손에 떨어졌다 — 지금 주문을!', buttons: ['🌊 물', '🔥 불', '🌬️ 바람', '🪨 땅'], solution: ['🪨 땅', '🌬️ 바람', '🔥 불', '🌊 물'], result: 'out', hint: ['호수의 여인의 두루마리 — 거꾸로.', '땅 → 바람 → 불 → 물'] },
      { key: 'out', type: 'item', end: true, title: '카멜롯의 영광', art: '⚔️👑', text: '수정 구슬이 산산이 부서지며 모르가나가 연기로 사라진다. 저주가 풀리고 펜드래건 왕국에 다시 꽃이 핀다!' },
      { key: 'trap1', type: 'trap', from: ['greenknight', 'scabbard'], title: '도전으로 오해!', text: '칼집을 내밀자 녹색 기사가 결투 신청으로 알고 도끼를 휘둘렀다! 겨우 피했다.', penalty: 1 },
    ],
  },
  // ───── 예상치 못한 지연 ─────
  {
    id: 'sw-delay',
    set: {
      hold: { spots: [{ label: '공구 서랍', x: 76, y: 70, reveal: 'panel' }, { label: '밀수품 상자', x: 24, y: 60, reveal: 'armor' }] },
      hangar: { shows: ['patrol'], text: '거대한 격납고. 순찰 스톰트루퍼가 서성인다. 정비실 문은 제국 코드 키패드. 벽의 근무표에 “정비실 비밀번호 = 오늘 근무 교대조 번호의 숫자”.' },
      fixed: { result: 'tractor', text: '코일 장착! 하이퍼드라이브를 재가동하자.' },
      out: { from: ['beamctrl', 'r2'], discard: ['beamctrl', 'r2'] },
    },
    add: [
      { key: 'armor', type: 'blue', title: '훔친 스톰트루퍼 갑옷', art: '🪖', text: '밀수품 중에 이런 게 있었다니.' },
      { key: 'patrol', type: 'red', title: '순찰 스톰트루퍼', art: '🪖', text: '“거기, 신분을 밝혀라!”' },
      { key: 'disguised', type: 'item', from: ['patrol', 'armor'], discard: ['patrol', 'armor'], shows: ['maint'], title: '완벽한 변장', art: '🪖😎', text: '“아, 동료였군. 수고해.” 순찰병이 지나갔다. 정비실 키패드로!' },
      { key: 'tractor', type: 'place', title: '견인 광선에 잡혔다!', art: '🛸🔦⛓️', text: '드라이브는 살아났지만 견인 광선이 배를 붙잡고 있다! 격납고 벽의 견인 광선 제어반은 드로이드 접속 포트로만 조작된다.', shows: ['beamctrl'], spots: [{ label: '우주선 해치', x: 70, y: 70, reveal: 'r2' }] },
      { key: 'beamctrl', type: 'red', title: '견인 광선 제어반', art: '🎛️', text: '“드로이드 접속 필요.”' },
      { key: 'r2', type: 'blue', title: '아스트로멕 드로이드', art: '🤖', text: '“삐-빅 뿌웁!”' },
      { key: 'trap2', type: 'trap', from: ['patrol', 'coil'], title: '수상한 화물', text: '순찰병에게 코일을 보여 주자 의심의 눈초리! 둘러대느라 시간이 흘렀다.', penalty: 1 },
    ],
  },
  // ───── 호스 탈출 ─────
  {
    id: 'sw-hoth',
    set: {
      base: { shows: ['shield'] },
      shieldon: { shows: ['trench'], text: '포격이 방어막에 막힌다! 하지만 보행 병기가 발생기를 노리고 참호로 다가온다.' },
    },
    add: [
      { key: 'trench', type: 'place', title: '눈 덮인 참호', art: '🌨️🦿🛩️', text: '거대한 4족 보행 병기 AT-AT가 다가온다! 정비 중인 스노스피더 한 대. 후미 작살 발사기가 비었다.', shows: ['speeder', 'officer'], spots: [{ label: '탄약 상자', x: 24, y: 70, reveal: 'harpoon' }] },
      { key: 'officer', type: 'item', title: '참호 지휘관', art: '🎖️', text: '“블래스터는 장갑에 안 먹혀! 견인 케이블로 다리를 묶어 넘어뜨려라!”' },
      { key: 'speeder', type: 'red', title: '스노스피더', art: '🛩️', text: '' },
      { key: 'harpoon', type: 'blue', title: '작살과 견인 케이블', art: '🪝', text: '' },
      { key: 'atatDown', type: 'item', from: ['speeder', 'harpoon'], discard: ['speeder', 'harpoon'], shows: ['hangardoor'], title: 'AT-AT 쓰러뜨리기', art: '🦿💥', text: '케이블로 다리를 감고 한 바퀴, 두 바퀴… 쿠웅! 보행 병기가 쓰러졌다. 격납고로 달려라!' },
      { key: 'trap2', type: 'trap', from: ['speeder', 'heater'], title: '엔진 과열', text: '히터를 스피더 엔진에 붙였더니 경고등이 깜빡였다! 식히느라 시간이 흘렀다.', penalty: 1 },
    ],
  },
  // ───── 제다의 비밀 임무 ─────
  {
    id: 'sw-jedha',
    set: {
      market: { shows: ['monk', 'gangster'], spots: [{ label: '과일 가게', x: 22, y: 66, reveal: 'robe' }, { label: '물 장수 수레', x: 50, y: 78, reveal: 'credits' }, { label: '패거리', emoji: '🪖', x: 76, y: 44, text: '패거리 둘이 투덜거린다: “사원 수로 문 번호가 기도문 줄 수랑 글자 수래.”' }] },
      crash: { text: '연기 나는 셔틀 잔해. 꼬리 날개에 등록 번호 “ST-0321”. 화물 상자가 모래에 반쯤 묻혀 있다. 기절한 제국 조종사. 멀리서 소우 게레라 패거리의 스피더 소리!' },
    },
    remove: ['out'],
    add: [
      { key: 'gangster', type: 'red', title: '검문 중인 패거리', art: '🪖🔫', text: '“여긴 소우 게레라 구역이다. 통행료를 내라.”' },
      { key: 'credits', type: 'blue', title: '크레딧 칩', art: '💰', text: '' },
      { key: 'bribed', type: 'item', from: ['gangster', 'credits'], discard: ['gangster', 'credits'], shows: ['temple'], title: '통행료', art: '💰🤝', text: '“좋아, 지나가.” 패거리가 비켜서자 사원 입구가 보인다.' },
      { key: 'kyber', type: 'item', from: ['crate', 'glove'], discard: ['crate', 'glove'], shows: ['ridge'], title: '카이버 크리스털 회수', art: '💎', text: '상자를 열자 크리스털이 푸르게 빛난다! 그런데 통신이 먹통이다 — 패거리가 근처 바위산에 전파 방해기를 세웠다.' },
      { key: 'ridge', type: 'place', title: '바위산 능선', art: '⛰️📡🔥', text: '능선 꼭대기에 패거리의 전파 방해기가 윙윙거린다. 셔틀 잔해에서 튕겨 나온 화물이 흩어져 있다.', shows: ['jammer'], spots: [{ label: '흩어진 화물', x: 26, y: 72, reveal: 'detonator' }] },
      { key: 'jammer', type: 'red', title: '전파 방해기', art: '📡', text: '' },
      { key: 'detonator', type: 'blue', title: '열 폭탄', art: '💣', text: '' },
      { key: 'signal', type: 'item', from: ['jammer', 'detonator'], discard: ['jammer', 'detonator'], shows: ['callcode'], title: '통신 복구', art: '📡💥', text: '쾅! 방해기가 날아갔다. 통신기에 제국 함대 채널이 잡힌다. “호출 코드는 추락한 셔틀 번호를 거꾸로.”' },
      { key: 'callcode', type: 'code', title: '제국 셔틀 호출', art: '📞', text: '숫자 4자리.', code: '1230', result: 'out', hint: ['추락 지점에서 본 셔틀 꼬리 번호.', 'ST-0321 → 1230'] },
      { key: 'out', type: 'item', end: true, title: '임무 완수', art: '💎🛸', text: '패거리가 들이닥치기 직전, 제국 셔틀이 내려와 당신과 카이버 크리스털을 싣고 떠난다.' },
      { key: 'trap2', type: 'trap', from: ['gangster', 'robe'], title: '순례자 흉내?', text: '패거리에게 순례자 망토를 내밀자 “놀리냐?” 하며 총을 겨눴다. 간신히 빠져나왔다.', penalty: 1 },
    ],
  },
];
