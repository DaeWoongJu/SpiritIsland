'use strict';
// 언락! 확장 패치 1 — 시크릿 · 엑조틱 · 히로익 어드벤처를 원작 분량에 가깝게
// add: 새 카드, set: 기존 카드의 값 바꾸기 (배열은 통째로 바뀜)

module.exports = [
  // ───── 노사이드 스토리 ─────
  {
    id: 'nosidestory',
    set: {
      den: { shows: ['clocks', 'cat', 'bookcase', 'phone'], spots: [{ label: '부엌 찬장', x: 84, y: 64, reveal: 'tuna' }, { label: '책장 위 칸', x: 62, y: 20, reveal: 'leverbook' }, { label: '냉장고 문', x: 46, y: 78, reveal: 'magnet' }] },
      lab: { title: '비밀 통로', art: '🚪🤖⚡', text: '책장이 돌아가자 비밀 통로! 교수의 경비 로봇 “노봇”이 붉은 눈을 번뜩이며 길을 막는다. 몸통이 온통 쇠붙이다.', shows: ['robot'] },
      controls: { from: ['machineOn', 'crystal'], discard: ['crystal'], text: '크리스털을 끼우자 기계가 웅웅 울린다. “과거 → 현재 → 미래 순서로 누르면 원래 자리로 돌아갑니다.” 교수가 계단을 뛰어 내려온다!' },
    },
    add: [
      { key: 'phone', type: 'item', title: '자동 응답기', art: '📞', text: '“삐— 교수님, 조수 이고르입니다. 노봇이 자석에 약하니 조심하세요! 그리고 시간 기계 동력 크리스털은 실험실 화분에 숨겨 뒀어요.”' },
      { key: 'magnet', type: 'blue', title: '냉장고 자석', art: '🧲', text: '엄청나게 강한 자석이다. 이런 걸 왜 냉장고에…' },
      { key: 'robot', type: 'red', title: '경비 로봇 노봇', art: '🤖', text: '“삐빅! 침입자 발견! 침입자 발견!”' },
      { key: 'labin', type: 'place', from: ['robot', 'magnet'], discard: ['robot', 'magnet'], shows: ['cover', 'notes'], title: '비밀 실험실', art: '⏳🧪🪴', text: '자석에 들러붙은 노봇이 버둥거리다 멈췄다! 실험실 유리 덮개 속에서 시간 기계가 웅웅거린다.', spots: [{ label: '실험실 화분', x: 80, y: 70, reveal: 'crystal' }] },
      { key: 'notes', type: 'item', title: '교수의 메모', art: '📝', text: '“시간 기계 작동법: ① T-KEY 핀을 꽂는다 ② 동력 크리스털을 끼운다 ③ 시간 버튼.”' },
      { key: 'machineOn', type: 'red', from: ['machine', 'pin'], discard: ['pin'], title: '핀이 꽂힌 시간 기계', art: '⏳📍', text: '계기판에 불이 들어왔다. “동력 부족 — 크리스털을 넣으세요.”' },
      { key: 'crystal', type: 'blue', title: '동력 크리스털', art: '💎', text: '' },
      { key: 'trap2', type: 'trap', from: ['cat', 'magnet'], title: '고양이 비행', text: '자석에 고양이 목걸이가 철컥! 고양이가 날뛰며 온 방을 헤집었다.', penalty: 1 },
      { key: 'trap3', type: 'trap', from: ['robot', 'leverbook'], title: '레이저 경고!', text: '책으로 노봇을 때리자 경고 레이저가 발사됐다. 바닥에 납작 엎드렸다.', penalty: 1 },
    ],
  },
  // ───── 툼스톤 익스프레스 ─────
  {
    id: 'tombstone',
    set: {
      car: { shows: ['suspects', 'door', 'dining'] },
      mail: { shows: ['emptysafe', 'mailbag', 'dynamite', 'telegraph', 'morsecard'] },
      accuse: { hint: ['금고 다이얼의 빨간 비단 실, 자루 속 장갑과 서명 L, 금괴의 장미 향수.', '가수 릴리'] },
    },
    add: [
      { key: 'dining', type: 'place', title: '식당칸', art: '🍽️🃏⌚👜', text: '도박사 빌이 혼자 카드를 돌리고, 목사의 회중시계가 식탁에 놓여 있다. 가수 릴리의 핸드백이 의자에 걸려 있다.', shows: ['bill', 'watch', 'handbag'], spots: [{ label: '식탁 꽃병', x: 74, y: 30, reveal: 'claspkey' }] },
      { key: 'bill', type: 'item', title: '도박사 빌', art: '🃏', text: '“난 밤새 여기서 카드만 쳤소. 증인? 이 에이스 넉 장이 증인이지.” 오른손으로 능숙하게 패를 돌린다.' },
      { key: 'watch', type: 'item', title: '목사의 회중시계', art: '⌚', text: '시계는 4시 37분 — 늘 7분 빠르게 맞춰 둔다고 했다. 목사는 기도실에서 혼자 있었다고 한다.' },
      { key: 'handbag', type: 'red', title: '릴리의 핸드백', art: '👜', text: '작은 걸쇠 자물쇠.' },
      { key: 'claspkey', type: 'blue', title: '작은 걸쇠 열쇠', art: '🗝️', text: '' },
      { key: 'perfume', type: 'item', from: ['handbag', 'claspkey'], discard: ['handbag', 'claspkey'], title: '핸드백 속', art: '🌹🧴', text: '장미 향수병, 그리고 툼스톤 호텔 예약증 — “L. 로즈 외 2인, 금고실 있는 방”.' },
      { key: 'morsecard', type: 'item', title: '모스 부호표', art: '📇', text: '“S = ··· (짧게 셋), O = --- (길게 셋). 위급할 땐 SOS!”' },
      { key: 'telegraph', type: 'machine', title: '우편칸 전신기', art: '📟', text: '툼스톤 보안관 사무소로 신호를 보내자.', buttons: ['· 짧게', '- 길게'], solution: ['· 짧게', '· 짧게', '· 짧게', '- 길게', '- 길게', '- 길게', '· 짧게', '· 짧게', '· 짧게'], result: 'sheriff', hint: ['모스 부호표: SOS.', '··· --- ···'] },
      { key: 'sheriff', type: 'item', title: '툼스톤 보안관의 답신', art: '📩', text: '“열차를 세우고 범인을 붙잡아 두시오. 금괴에서 향수 냄새가 나면 그 향수의 주인이 범인이오.”' },
      { key: 'trap3', type: 'trap', from: ['handbag', 'knife'], title: '비명!', text: '칼로 핸드백을 찢으려다 릴리가 비명을 질렀다. 승객들이 몰려와 해명하느라 진땀을 뺐다.', penalty: 1 },
    ],
  },
  // ───── 오즈의 모험가들 ─────
  {
    id: 'oz',
    set: {
      road: { shows: ['scarecrow', 'sign', 'shoes', 'glinda'] },
      lionFree: { shows: ['chasm'], text: '“밝으니까 하나도 안 무서워! 세 번째 숫자는 내 다리 수 4. 네 번째는… 우리 일행이 모두 몇 명인지 세어 봐!” (허수아비, 양철 나무꾼, 사자, 그리고 당신) 숲 끝에 깊은 골짜기가 가로막고 있다.' },
      castle: { text: '날개 원숭이들이 서쪽 성 안뜰에 내려 주었다. 마녀는 탑 꼭대기에 있다. 탑 문은 모래시계 자물쇠. 안뜰에 물 양동이가 놓여 있다.', shows: ['towerdoor'], spots: [{ label: '우물가', x: 30, y: 78, reveal: 'bucket' }, { label: '모래시계', emoji: '⏳', x: 72, y: 30, text: '모래시계 받침에 숫자 1 · 3 · 2 — “큰 것부터 흘러내린다.”' }] },
    },
    add: [
      { key: 'glinda', type: 'item', title: '착한 마녀 글린다', art: '🧚', text: '“노란 길을 따라가렴. 서쪽 마녀는 물을 무척 싫어한단다. 그리고 그 구두를 절대 벗지 마.” 이마에 입맞춤 자국을 남기고 사라졌다.' },
      { key: 'chasm', type: 'place', title: '칼리다의 골짜기', art: '🏞️🐻🪵', text: '깊은 골짜기 건너편에서 곰 몸에 호랑이 머리를 한 칼리다가 으르렁댄다. 건널 다리가 없다.', shows: ['gap'], spots: [{ label: '쓰러진 나무', x: 24, y: 70, reveal: 'log' }] },
      { key: 'gap', type: 'red', title: '깊은 골짜기', art: '🕳️', text: '' },
      { key: 'log', type: 'blue', title: '양철 나무꾼이 벤 통나무', art: '🪵', text: '' },
      { key: 'bridged', type: 'item', from: ['gap', 'log'], discard: ['gap', 'log'], shows: ['poppy'], title: '통나무 다리', art: '🪵🌉', text: '통나무를 걸쳐 건넜다! 쫓아오던 칼리다는 통나무와 함께 골짜기로 떨어졌다.' },
      { key: 'towerdoor', type: 'code', title: '탑 문 모래시계 자물쇠', art: '⏳', text: '숫자 3자리.', code: '321', result: 'tower', hint: ['모래시계 받침: 1·3·2를 큰 것부터.', '3 · 2 · 1 → 321'] },
      { key: 'tower', type: 'place', title: '마녀의 탑', art: '🧙‍♀️🔮🧹', text: '초록 피부의 마녀가 수정 구슬 앞에서 깔깔 웃는다. “빗자루는 절대 못 준다!”', shows: ['witch'] },
      { key: 'trap3', type: 'trap', from: ['gap', 'oil'], title: '미끄러질 뻔!', text: '골짜기 가장자리에 기름을 부었다가 미끄러질 뻔했다.', penalty: 1 },
    ],
  },
  // ───── 부기맨들의 밤 ─────
  {
    id: 'boogeymen',
    set: {
      dream: { shows: ['closetman', 'bedman'] },
      bye1: { shows: ['half1'], text: '빛을 비추자 “으악, 눈부셔!” 하고 달아났다. 열쇠 반쪽을 떨어뜨렸다. 남긴 쪽지: “자장가 첫 소절 — 도 도 솔 솔”' },
      bye2: { shows: ['half2'], text: '간질간질! 깔깔 웃다가 굴러서 달아났다. 열쇠 반쪽을 떨어뜨렸다. 남긴 쪽지: “자장가 둘째 소절 — 라 라 솔”' },
      drawings: { text: '그림 1: 별 3개 · 그림 2: 달 1개 · 그림 3: 구름 8개. 그림 4: 입이 큰 괴물을 종이로 접는 방법 — “위를 접고, 아래를 접고, 왼쪽, 오른쪽!” 삐뚤빼뚤한 글씨: “무서울 땐 그림 순서대로 세면 돼!”' },
    },
    add: [
      { key: 'half1', type: 'red', title: '꿈 열쇠 반쪽 (해)', art: '🔑☀️', text: '' },
      { key: 'half2', type: 'blue', title: '꿈 열쇠 반쪽 (달)', art: '🔑🌙', text: '' },
      { key: 'lair', type: 'place', from: ['half1', 'half2'], discard: ['half1', 'half2'], shows: ['king', 'mouth'], title: '부기맨 대장의 소굴', art: '👹🎪🌀', text: '두 반쪽을 맞추자 꿈 열쇠가 되었다! 소굴 문이 열리고, 거대한 부기맨 대장이 입을 쩍 벌린다. 오르골은 그 입 속에!' },
      { key: 'king', type: 'item', title: '부기맨 대장', art: '👹', text: '“크하하! 내 입을 닫을 수 있으면 오르골을 가져가 보시지!” 입이 종이처럼 접힐 것 같다…' },
      { key: 'mouth', type: 'machine', title: '대장의 입 접기', art: '📄👄', text: '거대한 입을 접어 닫자!', buttons: ['⬆️ 위', '⬇️ 아래', '⬅️ 왼쪽', '➡️ 오른쪽'], solution: ['⬆️ 위', '⬇️ 아래', '⬅️ 왼쪽', '➡️ 오른쪽'], result: 'musicbox', hint: ['윌리엄의 그림 4.', '위 → 아래 → 왼쪽 → 오른쪽'] },
      { key: 'trap3', type: 'trap', from: ['half1', 'feather'], title: '열쇠가 간지러워?', text: '열쇠를 깃털로 문질렀더니 열쇠가 웃음을 터뜨리며 굴러갔다. 찾느라 시간이 흘렀다.', penalty: 1 },
    ],
  },
  // ───── 세헤라자드의 마지막 이야기 ─────
  {
    id: 'scheherazade',
    set: {
      bazaar: { shows: ['merchant', 'lamp'], spots: [{ label: '비단 가게', x: 22, y: 62, reveal: 'cloth' }, { label: '하늘', emoji: '🌙', x: 80, y: 18, text: '초승달 아래 궁전 첨탑이 보인다. 바람이 동쪽에서 분다.' }, { label: '우물가', x: 52, y: 80, reveal: 'purse' }] },
      merchant: { type: 'red', text: '“이 양탄자는 날 수 있지. 금화 한 주머니면 팔겠소. 하지만 바람의 주문을 모르면 소용없소 — 주문은 요정만 알걸?”' },
      tower: { shows: ['vizier'], text: '감옥 탑 꼭대기. 사악한 대신 자파르가 세헤라자드를 지키고 있다!' },
      roof: { spots: [{ label: '물항아리', x: 26, y: 72, reveal: 'key' }, { label: '약초 바구니', x: 76, y: 68, reveal: 'powder' }] },
      ring: { shows: ['hall'] },
    },
    add: [
      { key: 'purse', type: 'blue', title: '금화 주머니', art: '💰', text: '우물가에 누가 떨어뜨렸다.' },
      { key: 'deal', type: 'item', from: ['merchant', 'purse'], discard: ['merchant', 'purse'], shows: ['carpet'], title: '양탄자를 샀다', art: '🧶✨', text: '상인이 양탄자를 펼쳐 준다. “주문을 잊지 마시오!”' },
      { key: 'vizier', type: 'red', title: '대신 자파르', art: '🧔‍♂️', text: '“누구도 이 여인을 구할 수 없다!” 졸린 눈으로 하품을 한다.' },
      { key: 'powder', type: 'blue', title: '양귀비 가루', art: '🌺', text: '한 줌이면 코끼리도 잠든다는 약초 가루.' },
      { key: 'sleep', type: 'item', from: ['vizier', 'powder'], discard: ['vizier', 'powder'], shows: ['jewelbox'], title: '잠든 자파르', art: '😴', text: '가루를 훅 불자 자파르가 쿨쿨! 세헤라자드: “결말이 생각나지 않아요… 어머니의 보석함 속 반지에 순서가 새겨져 있었는데.”' },
      { key: 'hall', type: 'place', title: '술탄의 알현실', art: '👑🕌🗡️', text: '술탄이 칼을 뽑아 들고 기다린다. “마지막 이야기의 결말을 들려 다오. 아니면…!” 세헤라자드가 당신의 손을 꼭 잡는다.', shows: ['ending'] },
      { key: 'trap3', type: 'trap', from: ['vizier', 'key'], title: '들켰다!', text: '열쇠를 흔들며 자파르에게 다가가자 그가 소리쳐 경비병을 불렀다. 숨느라 시간이 흘렀다.', penalty: 1 },
      { key: 'trap4', type: 'trap', from: ['merchant', 'cloth'], title: '흥정 실패', text: '비단 천으로 값을 치르려 하자 상인이 콧방귀를 뀌었다.', penalty: 1 },
    ],
  },
  // ───── 탐험대: 챌린저 ─────
  {
    id: 'challenger',
    set: {
      map: { shows: ['nest', 'ford'], text: '표시된 곳: 프테라노돈 둥지, 강 여울 너머 티라노 늪, 원주민 동굴(늪 너머). 어디부터 가도 좋다.' },
      camp: { spots: [{ label: '식량 상자', x: 76, y: 72, reveal: 'meat' }, { label: '깨진 거울', x: 24, y: 40, reveal: 'mirror' }] },
      cavelock: { result: 'cavein' },
      roxton: { from: ['apes', 'mirror'], discard: ['apes', 'mirror'], text: '거울 조각으로 햇빛을 비추자 원숭이 인간들이 엎드려 절한다! 록스턴 경을 구했다. “고맙소! 소총 탄약은 떨어졌지만 원주민의 횃불은 챙겼지.”' },
    },
    add: [
      { key: 'ford', type: 'place', title: '강 여울', art: '🌊🪨🐊', text: '물살 센 강. 바위 사이에 악어가 숨어 있다. 건너편이 늪이다.', shows: ['river'], spots: [{ label: '물가 덤불', x: 70, y: 70, reveal: 'pole' }] },
      { key: 'river', type: 'red', title: '거센 강물', art: '🌊', text: '' },
      { key: 'pole', type: 'blue', title: '긴 장대', art: '🎋', text: '' },
      { key: 'crossed', type: 'item', from: ['river', 'pole'], discard: ['river', 'pole'], shows: ['swamp'], title: '장대높이뛰기', art: '🎋💨', text: '장대로 바위를 짚으며 건넜다! 악어가 허탕을 쳤다.' },
      { key: 'cavein', type: 'place', title: '원숭이 인간의 마을', art: '🐒🔥🛖', text: '돌문 안은 원숭이 인간들의 마을! 록스턴 경이 나무 우리에 갇혀 있다. 원숭이 인간들이 창을 겨눈다. 그들은 태양을 숭배하는 것 같다.', shows: ['apes'] },
      { key: 'apes', type: 'red', title: '원숭이 인간들', art: '🐒🔱', text: '' },
      { key: 'mirror', type: 'blue', title: '깨진 거울 조각', art: '🪞', text: '면도용 거울이 깨진 조각.' },
      { key: 'trap3', type: 'trap', from: ['apes', 'meat'], title: '고기 쟁탈전', text: '고기를 던지자 원숭이 인간들이 서로 싸우다 창이 날아왔다!', penalty: 1 },
      { key: 'trap4', type: 'trap', from: ['river', 'rope'], title: '휩쓸릴 뻔', text: '밧줄을 던져 봤지만 물살에 휩쓸려 떠내려갈 뻔했다.', penalty: 1 },
    ],
  },
  // ───── 인서트 코인 ─────
  {
    id: 'insertcoin',
    set: {
      stage1: { start: false, from: ['cabinet', 'quarter'], discard: ['cabinet', 'quarter'] },
      blast: { shows: ['racer'], text: '파워 업! 외계인 편대가 모두 터졌다. 화면이 바뀌며 경주로가 펼쳐진다.' },
    },
    add: [
      { key: 'arcade', type: 'place', start: true, title: '동네 오락실', art: '🕹️👾🪙💡', text: '문 닫기 직전의 오락실. 구석에 먼지 쌓인 이상한 게임기 「NEVER ENDING QUEST」. 화면에 “INSERT COIN”이 깜빡인다. 주머니엔 동전이 없다.', shows: ['cabinet'], spots: [{ label: '동전 교환기 아래', x: 74, y: 80, reveal: 'quarter' }, { label: '랭킹 화면', emoji: '🏆', x: 30, y: 26, text: '1위 ???: 999999 — 아무도 깬 적 없는 게임이다.' }] },
      { key: 'cabinet', type: 'red', title: '수상한 게임기', art: '🕹️', text: '“INSERT COIN”' },
      { key: 'quarter', type: 'blue', title: '떨어진 동전', art: '🪙', text: '' },
      { key: 'racer', type: 'place', title: '스테이지 4: 터보 레이싱', art: '🏎️🏁💨', text: '레이싱 카에 앉았다! 결승선까지 따라잡아야 다음 스테이지로. 라이벌 차가 저만치 앞서 있다.', shows: ['car'], spots: [{ label: '피트 스톱', x: 22, y: 70, reveal: 'nitro' }] },
      { key: 'car', type: 'red', title: '레이싱 카', art: '🏎️', text: '속도가 부족하다.' },
      { key: 'nitro', type: 'blue', title: '니트로 부스터', art: '🔥', text: '' },
      { key: 'finish', type: 'item', from: ['car', 'nitro'], discard: ['car', 'nitro'], shows: ['blocks'], title: '역전 우승!', art: '🏁🏆', text: '부스터를 켜고 결승선 직전 역전! 화면이 바뀌며 블록이 쏟아진다.' },
      { key: 'trap2', type: 'trap', from: ['car', 'coin'], title: '엔진 고장', text: '코인을 연료 주입구에 넣었다가 엔진이 멈췄다. 재시작!', penalty: 1 },
    ],
  },
  // ───── 셜록 홈즈: 주홍색 연구 ─────
  {
    id: 'scarlet',
    set: {
      house: { shows: ['wall', 'ring', 'body', 'rance'] },
      reply: { text: '“J.H. = 제퍼슨 호프. 약혼녀 루시 페리어는 드레버에게 강제로 결혼당한 뒤 숨졌다. 호프는 지금 런던에서 마부로 일한다.”' },
      deduce: { shows: ['irregulars'], text: '“드레버를 태운 마차의 마부가 범인일세. 장화 발자국, 마차 바퀴 자국, 반지, 그리고 복수(RACHE). 베이커가 소년단을 시켜 마부를 찾게!”' },
      bakerst: { spots: [{ label: '테리어 바구니', x: 76, y: 70, reveal: 'dog' }, { label: '벽난로 위 동전 그릇', x: 30, y: 30, reveal: 'shilling' }] },
    },
    add: [
      { key: 'rance', type: 'item', title: '랜스 순경의 증언', art: '👮', text: '“새벽 2시쯤 문 앞에 술 취한 남자가 있었습죠. 키가 크고 얼굴이 붉고, 큰 장화를 신었더군요. 손에 반지를 쥐고 있었던 것 같은데…”' },
      { key: 'irregulars', type: 'red', title: '베이커가 소년단', art: '👦👦👦', text: '“일당을 주시면 런던 마부란 마부는 다 찾아 드리죠!”' },
      { key: 'shilling', type: 'blue', title: '실링 동전', art: '🪙', text: '' },
      { key: 'cabinfo', type: 'item', from: ['irregulars', 'shilling'], discard: ['irregulars', 'shilling'], shows: ['cabrank'], title: '소년단의 보고', art: '📜', text: '“찾았어요! 키 크고 얼굴 붉은 마부, 이름은 호프! 마차 번호는 약혼한 해의 끝 두 자리를 늘 단다고 자랑했대요.”' },
      { key: 'trap2', type: 'trap', from: ['irregulars', 'lens'], title: '놀림감', text: '돋보기로 소년들을 들여다보자 “탐정 흉내!” 하며 놀려 대고 흩어졌다. 다시 모으느라 시간이 걸렸다.', penalty: 1 },
    ],
  },
  // ───── 하얀 토끼를 쫓아서 ─────
  {
    id: 'whiterabbit',
    set: {
      mushroom: { shows: ['pool'], text: '“한쪽은 커지고 한쪽은 작아지지.” 버섯을 너무 많이 먹어 거인이 되었다가… 울음이 터져 눈물 웅덩이가!' },
      croquet: { spots: [{ label: '장미 덤불', x: 80, y: 60, reveal: 'hedgehog' }, { label: '나무 위 웃음', emoji: '😺', x: 30, y: 24, text: '체셔 고양이: “여왕은 하트를 제일 좋아해. 다음은 다이아, 그다음 스페이드, 클로버는 질색이지.”' }] },
    },
    add: [
      { key: 'pool', type: 'place', title: '눈물 웅덩이', art: '💧🦤🐭', text: '웅덩이에 동물들이 흠뻑 젖었다. 도도새: “코커스 경주를 하면 몸이 마르지! 원을 그리며 세 바퀴 달리고, 멈춰!”', shows: ['caucus'] },
      { key: 'caucus', type: 'machine', title: '코커스 경주', art: '🏃🦤', text: '도도새의 구호에 맞춰!', buttons: ['🏃 달리기', '✋ 멈춤', '💤 쉬기'], solution: ['🏃 달리기', '🏃 달리기', '🏃 달리기', '✋ 멈춤'], result: 'duchess', hint: ['도도새의 말: 세 바퀴 달리고 멈춤.', '달리기 ×3 → 멈춤'] },
      { key: 'duchess', type: 'place', title: '공작 부인의 부엌', art: '🌶️👶🍲', text: '후추가 가득한 부엌! 모두 재채기를 한다. 공작 부인이 안고 있던 아기를 휙 던진다 — 아기가 꿀꿀거린다?!', shows: ['baby'], spots: [{ label: '요람', x: 76, y: 70, reveal: 'lullaby' }] },
      { key: 'baby', type: 'red', title: '꿀꿀대는 아기', art: '👶🐷', text: '울음을 그치지 않는다.' },
      { key: 'lullaby', type: 'blue', title: '자장가 악보', art: '🎼', text: '' },
      { key: 'piglet', type: 'item', from: ['baby', 'lullaby'], discard: ['baby', 'lullaby'], shows: ['party'], title: '아기 돼지', art: '🐷💤', text: '자장가에 아기가 잠들더니 귀여운 돼지로 변해 숲으로 총총! 그 뒤를 따라가니 웃음소리가 들린다.' },
      { key: 'trap3', type: 'trap', from: ['baby', 'spoon'], title: '후추 폭탄', text: '숟가락으로 아기를 달래려다 후추 통을 엎었다! 에취!', penalty: 1 },
    ],
  },
];
