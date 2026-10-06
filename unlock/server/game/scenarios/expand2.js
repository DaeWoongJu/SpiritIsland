'use strict';
// 언락! 확장 패치 2 — 에픽 · 미식 · 타임리스 · 레전더리 어드벤처를 원작 분량에 가깝게

module.exports = [
  // ───── 일곱 번째 상영 ─────
  {
    id: 'werewolf',
    set: {
      manor: { shows: ['notes', 'garden', 'doctor'], spots: [{ label: '은 쟁반', x: 26, y: 70, reveal: 'key' }, { label: '창밖 달', emoji: '🌕', x: 80, y: 20, text: '시계탑이 11번 울렸다.' }, { label: '부엌 소금 단지', x: 56, y: 82, reveal: 'salt' }] },
      potion: { result: 'antidote' },
      out: { from: ['doctor', 'antidote'] },
    },
    add: [
      { key: 'doctor', type: 'red', title: '변해 가는 의사', art: '🧑‍⚕️🐺', text: '손등에 털이 돋고 이빨이 길어진다. “어서… 해독제를…!”' },
      { key: 'garden', type: 'place', title: '안개 낀 정원', art: '🌫️👻🌿', text: '온실로 가는 길을 하얀 유령이 가로막는다. 영화 줄거리 속 “저택을 떠도는 유령”이다! 유령은 소금을 무서워한다는 대사가 있었다.', shows: ['ghost'] },
      { key: 'ghost', type: 'red', title: '하얀 유령', art: '👻', text: '“이 온실엔 아무도 못 들어가…”' },
      { key: 'salt', type: 'blue', title: '소금 단지', art: '🧂', text: '' },
      { key: 'greenhouse', type: 'item', from: ['ghost', 'salt'], discard: ['ghost', 'salt'], shows: ['cabinet'], title: '온실', art: '🌿🗄️', text: '소금을 뿌리자 유령이 사라졌다. 온실 안 약장에 투구꽃과 은가루가 보인다.' },
      { key: 'antidote', type: 'blue', title: '해독제', art: '🧪✨', text: '' },
      { key: 'trap2', type: 'trap', from: ['doctor', 'salt'], title: '으르렁!', text: '의사에게 소금을 뿌리자 화가 나서 이를 드러냈다! 간신히 피했다.', penalty: 1 },
    ],
  },
  // ───── 용의 일곱 시험 ─────
  {
    id: 'dragon7',
    set: {
      scroll: { text: '“일곱 시험: 문, 붓, 차, 저울, 수수께끼, 잉어, 용의 불. 첫 시험의 답은 켜진 등의 숫자를 큰 순서대로. 용의 길은 홀수만 밟는다.”' },
      court: { shows: ['paper', 'kettle', 'scale', 'bow'], spots: [{ label: '차 상자', x: 50, y: 74, reveal: 'leaves' }, { label: '화살통', x: 84, y: 40, reveal: 'arrow' }] },
      pond: { text: '여섯째 시험. 잉어들이 용문을 향해 뛰어오를 순서를 기다린다. 연못가 비석: “가장 붉은 것이 먼저, 가장 흰 것이 마지막.” 나머지 글자는 지워졌다.' },
      koi: { result: 'stones', hint: ['비석, 그리고 활쏘기 과녁의 글.', '🔴 → 🟡 → ⚫ → ⚪'] },
    },
    add: [
      { key: 'bow', type: 'red', title: '사원의 활', art: '🏹', text: '“화살이 과녁에 닿으면 숨은 지혜가 드러난다.”' },
      { key: 'arrow', type: 'blue', title: '깃털 화살', art: '➶', text: '' },
      { key: 'bullseye', type: 'item', from: ['bow', 'arrow'], discard: ['bow', 'arrow'], title: '과녁 한가운데', art: '🎯', text: '화살이 꽂히자 과녁 중앙이 열리며 쪽지가: “금빛 잉어는 검은 잉어보다 먼저 뛰어오른다.”' },
      { key: 'stones', type: 'place', title: '안개 속 징검다리', art: '🪨🌫️🐉', text: '용의 동굴로 가는 징검다리. 돌마다 숫자 1~6이 새겨져 있다. 잘못 밟으면 연못에 빠진다!', shows: ['stonepath'] },
      { key: 'stonepath', type: 'machine', title: '징검다리 건너기', art: '🪨', text: '밟을 돌을 순서대로.', buttons: ['1', '2', '3', '4', '5', '6'], solution: ['1', '3', '5'], result: 'cave', hint: ['사부의 두루마리: 용의 길은 홀수만.', '1 → 3 → 5'] },
      { key: 'trap3', type: 'trap', from: ['bow', 'leaves'], title: '찻잎 화살?', text: '찻잎을 시위에 걸었다가 사방에 흩날렸다. 제자들이 키득거린다.', penalty: 1 },
    ],
  },
  // ───── 미션 #07 ─────
  {
    id: 'mission07',
    set: {
      briefing: { text: '“목표: 골든 로터스 3층 보스 집무실 금고 속 마이크로필름. 서류 가방 비밀번호는 너의 요원 번호 앞에 0을 두 개. 호텔 바텐더가 접선책이다 — 접선 암호는 ‘달은 용을 삼킨다’.”' },
      gadgets: { shows: ['mirror', 'barman'] },
      floor2: { from: ['lift', 'chip'], discard: ['lift', 'chip'], text: 'VIP 칩을 넣자 엘리베이터가 2층으로! 3층 계단 앞에 레이저 경보 장치. 벽에 보스의 초상화.' },
      chip: { plus: 5, plusColor: 'blue', text: '용 문양 VIP 칩. 뒷면에 파란 +5 — 엘리베이터 층 버튼에 더하는 VIP 코드다.' },
      cutter: { result: 'harbor' },
      out: { from: ['boat', 'boatkey'] },
    },
    add: [
      { key: 'barman', type: 'item', title: '호텔 바텐더', art: '🍸', text: '“손님, 오늘 밤 하늘이 이상하군요…” 접선 암호를 기다리는 눈치다.', shows: ['password'] },
      { key: 'password', type: 'machine', title: '접선 암호', art: '🗣️', text: '단어를 골라 암호를 말하자.', buttons: ['☀️ 해는', '🌙 달은', '🐉 용을', '🌊 바다를', '본다', '삼킨다'], solution: ['🌙 달은', '🐉 용을', '삼킨다'], result: 'invite', hint: ['작전 지령서에 접선 암호가 있어요.', '달은 → 용을 → 삼킨다'] },
      { key: 'guardDown', type: 'item', from: ['guard', 'pen'], discard: ['guard', 'pen'], shows: ['lift'], title: '잠든 경비원', art: '💤', text: '수면가스에 경비원이 쓰러졌다. 뒤에 VIP 전용 엘리베이터 — “VIP 코드를 더하시오”.' },
      { key: 'lift', type: 'red', title: 'VIP 엘리베이터 패널', art: '🛗', text: '' },
      { key: 'harbor', type: 'place', title: '항구 부두', art: '⚓🌃🚤', text: '유리를 잘라 항구로 뛰어내렸다! 흑룡의 부하들이 쫓아온다. 부두에 쾌속정 한 척.', shows: ['boat'], spots: [{ label: '밧줄 감개', x: 26, y: 74, reveal: 'boatkey' }] },
      { key: 'boat', type: 'red', title: '쾌속정', art: '🚤', text: '시동 키가 없다.' },
      { key: 'boatkey', type: 'blue', title: '쾌속정 키', art: '🔑', text: '' },
      { key: 'trap3', type: 'trap', from: ['lift', 'pen'], title: '가스가 새어 나왔다', text: '만년필을 엘리베이터 버튼에 대자 수면가스가 새어 나왔다! 휘청거렸다.', penalty: 1 },
      { key: 'trap4', type: 'trap', from: ['boat', 'battery'], title: '안 맞아', text: '시계 배터리로는 쾌속정 시동이 걸리지 않는다.', penalty: 1 },
    ],
  },
  // ───── 하데스의 손아귀에서 ─────
  {
    id: 'hades',
    set: {
      hermes: { shows: ['styx', 'temple'], text: '날개 달린 신발의 헤르메스가 내려왔다. “저승 입구까지는 데려다주지. 뱃사공에게 줄 은화는 아테나 신전에서 구하렴.”' },
      styx: { spots: [] },
      lyre: { result: 'asphodel' },
    },
    add: [
      { key: 'temple', type: 'place', title: '아테나 신전', art: '🏛️🦉🫒', text: '지혜의 여신 아테나의 신전. 부엉이 석상이 회전대 위에 서 있다. 받침의 글: “지혜는 동쪽에서 떠올라 남쪽에서 빛나고 서쪽으로 진다.”', shows: ['owl'] },
      { key: 'owl', type: 'machine', title: '부엉이 석상', art: '🦉', text: '석상을 돌릴 방향을 순서대로.', buttons: ['동', '서', '남', '북'], solution: ['동', '남', '서'], result: 'obol', hint: ['받침의 글: 동 → 남 → 서.', '동 → 남 → 서'] },
      { key: 'asphodel', type: 'place', title: '아스포델 들판', art: '🌾🌊👻', text: '잠든 케르베로스를 지나니 창백한 들판. 망각의 강 레테가 흐른다. 그 물을 마시면 모든 걸 잊는다. 강가 바위에 은잔이 놓여 있다.', shows: ['lethe'], spots: [{ label: '강가 바위', x: 70, y: 70, reveal: 'cup' }] },
      { key: 'lethe', type: 'red', title: '레테의 강', art: '🌊', text: '건너려면 기억을 지켜야 한다.' },
      { key: 'cup', type: 'blue', title: '므네모시네의 은잔', art: '🏆', text: '기억의 여신의 잔. “이 잔으로 떠 마시면 기억이 맑아진다.”' },
      { key: 'remember', type: 'item', from: ['lethe', 'cup'], discard: ['lethe', 'cup'], shows: ['throne'], title: '맑아진 기억', art: '✨🧠', text: '은잔으로 물을 떠 마시자 오히려 정신이 또렷해졌다! 강 건너 하데스의 옥좌가 보인다.' },
      { key: 'trap2', type: 'trap', from: ['lethe', 'obol'], title: '은화를 잃었다', text: '은화를 강물에 던졌더니… 무엇을 하려 했는지 잊어버렸다. 한참 멍하니 서 있었다.', penalty: 1 },
    ],
  },
  // ───── 노사이드 교수의 애니멀-오-매틱 ─────
  {
    id: 'animalomatic',
    set: {
      reverse: { result: 'powerless' },
      keeper: { text: '사육사: “살았다! 기계 설명서예요 — 코드 입력 뒤 레버: 빨강 → 파랑 → 빨강. 전원이 나가면 파충류관 배전반을 파랑 → 초록 → 빨강 순서로 올리세요. 마지막으로 교수가 도망 못 가게 우리 문을 닫아야 해요!”' },
    },
    add: [
      { key: 'powerless', type: 'item', title: '정전!', art: '🔌❌', shows: ['reptile'], text: '코드는 맞았는데 기계가 꺼졌다! 노사이드가 파충류관 배전반을 내려 버렸다. “크크, 이제 어쩔 테냐!”' },
      { key: 'reptile', type: 'place', title: '파충류관', art: '🐊🦎🐍', text: '배전반 바로 앞에 (꼬리가 기린 목처럼 긴) 악어가 버티고 있다.', shows: ['croc'], spots: [{ label: '먹이 양동이', x: 76, y: 72, reveal: 'fish' }] },
      { key: 'croc', type: 'red', title: '목 긴 악어', art: '🐊', text: '배가 고파 보인다.' },
      { key: 'fish', type: 'blue', title: '생선 양동이', art: '🐟', text: '' },
      { key: 'breaker', type: 'machine', from: ['croc', 'fish'], discard: ['croc', 'fish'], title: '배전반', art: '⚡', text: '악어가 생선을 먹는 사이 배전반에 닿았다. 스위치 셋.', buttons: ['🔴 빨강', '🟢 초록', '🔵 파랑'], solution: ['🔵 파랑', '🟢 초록', '🔴 빨강'], result: 'lever', hint: ['사육사의 설명서.', '파랑 → 초록 → 빨강'] },
      { key: 'trap2', type: 'trap', from: ['croc', 'banana'], title: '악어는 채식 안 해', text: '바나나를 내밀자 악어가 콧방귀를 뀌며 꼬리로 후려쳤다!', penalty: 1 },
    ],
  },
  // ───── 80분간의 세계 일주 ─────
  {
    id: 'eighty',
    set: {
      bombay: { shows: ['elephant'], text: '대륙 횡단 철도가 숲 한가운데서 끊겼다! 철로 끝에 코끼리 한 마리. 코끼리를 타고 숲을 지나야 다음 역이다.', spots: [{ label: '과일 상인', x: 22, y: 66, reveal: 'sugar' }] },
      ny: { spots: [{ label: '구명보트', x: 74, y: 60, reveal: 'axe' }, { label: '선장실 전신기', x: 30, y: 30, reveal: 'telegram' }] },
      liverpool: { shows: ['fix'], text: '갑판을 태워 리버풀에 닿았다! 그 순간 형사 픽스가 수갑을 채운다. “은행 강도, 필리어스 포그! 체포한다!”' },
    },
    add: [
      { key: 'elephant', type: 'red', title: '고집 센 코끼리', art: '🐘', text: '움직이려 하지 않는다.' },
      { key: 'sugar', type: 'blue', title: '사탕수수', art: '🎋', text: '' },
      { key: 'jungle', type: 'place', from: ['elephant', 'sugar'], discard: ['elephant', 'sugar'], shows: ['pyre'], title: '인도 정글', art: '🌴🔥👰', text: '코끼리를 타고 숲을 지나는데, 사원 앞에서 젊은 여인 아우다가 화형대에 묶여 있다! 사제들이 의식을 준비 중이다.', spots: [{ label: '사원 옷걸이', x: 76, y: 40, reveal: 'disguise' }] },
      { key: 'pyre', type: 'red', title: '화형대', art: '🔥', text: '사제들이 지키고 있다.' },
      { key: 'disguise', type: 'blue', title: '사제의 옷', art: '🥻', text: '' },
      { key: 'aouda', type: 'item', from: ['pyre', 'disguise'], discard: ['pyre', 'disguise'], shows: ['train'], title: '아우다 구출', art: '👰✨', text: '사제로 변장한 파스파르투가 아우다를 구했다! 아우다: “고마워요. 다음 역 신호기는 당신 하인의 메모대로 지도의 핀 색깔 순서예요.”' },
      { key: 'fix', type: 'red', title: '형사 픽스', art: '🕵️', text: '“변명은 경찰서에서 하시오!”' },
      { key: 'telegram', type: 'blue', title: '런던 경찰청 전보', art: '📨', text: '“진범 체포 완료 — 포그 씨는 무관함.”' },
      { key: 'freed', type: 'item', from: ['fix', 'telegram'], discard: ['fix', 'telegram'], shows: ['bigben'], title: '누명을 벗다', art: '🗝️', text: '전보를 본 픽스가 얼굴이 빨개져 수갑을 풀었다. 런던행 특급열차를 타고 클럽으로! 그런데… 날짜 변경선을 넘으며 하루를 벌었다는 걸 깨달았다. 빅벤 시계를 맞추자.' },
      { key: 'trap3', type: 'trap', from: ['elephant', 'axe'], title: '성난 코끼리', text: '도끼를 휘두르자 코끼리가 코로 당신을 덤불에 던져 버렸다.', penalty: 1 },
      { key: 'trap4', type: 'trap', from: ['fix', 'ticket'], title: '뇌물?!', text: '형사에게 표를 내밀자 뇌물로 몰려 더 화를 냈다.', penalty: 1 },
    ],
  },
  // ───── 노사이드 쇼 ─────
  {
    id: 'nosideshow',
    set: {
      ringmaster: { text: '“사자 우리 열쇠가 없어졌어! 노사이드가 사자 우리에 뭔가 숨겼을지도 몰라. 피날레 조명은 빨강 → 노랑 → 파랑 순서로 켜야 하는데, 그것까지 망가뜨렸을까 봐 걱정이야!”' },
      gear: { result: 'arena' },
    },
    add: [
      { key: 'arena', type: 'place', title: '대포 쇼 무대', art: '💥🎯🤡', text: '두 번째 장치를 멈추자 쪽지가 또! “마지막 선물은 인간 대포에! — N.” 대포 포신 속에서 째깍 소리가 난다.', shows: ['cannon'], spots: [{ label: '광대 자동차', x: 70, y: 72, reveal: 'plug' }] },
      { key: 'cannon', type: 'red', title: '인간 대포', art: '💣', text: '도화선에 이미 불이 붙어 있다!' },
      { key: 'plug', type: 'blue', title: '거대한 코르크 마개', art: '🍾', text: '' },
      { key: 'safeCannon', type: 'item', from: ['cannon', 'plug'], discard: ['cannon', 'plug'], shows: ['finale'], title: '퐁!', art: '🎉', text: '마개로 포신을 막자 “퐁!” 색종이만 튀어나왔다. 이제 피날레 조명만 켜면 공연 시작!' },
      { key: 'finale', type: 'machine', title: '피날레 조명판', art: '💡', text: '색 스위치 셋.', buttons: ['🔵', '🔴', '🟡'], solution: ['🔴', '🟡', '🔵'], result: 'out', hint: ['단장이 순서를 말했어요.', '빨강 → 노랑 → 파랑'] },
      { key: 'trap2', type: 'trap', from: ['cannon', 'steak'], title: '사자가 따라왔다', text: '대포에 고기를 넣자 사자가 냄새를 맡고 무대까지 쫓아왔다!', penalty: 1 },
    ],
  },
  // ───── 아르센 뤼팽 ─────
  {
    id: 'lupin',
    set: {
      museum: { spots: [{ label: '경비원 의자', x: 24, y: 70, reveal: 'uv' }, { label: '창문', emoji: '🪟', x: 78, y: 24, text: '창밖으로 센 강과 노트르담 성당의 두 탑이 보인다.' }, { label: '기자 카메라 가방', x: 52, y: 80, reveal: 'press' }] },
      box: { result: 'ticket' },
    },
    remove: ['out'],
    add: [
      { key: 'ticket', type: 'item', title: '상자 속 기차표', art: '🎫', shows: ['station'], text: '“에트르타행 야간열차” 그런데 생라자르 역에서 가니마르 경감이 당신을 뤼팽으로 오해하고 막아선다!' },
      { key: 'station', type: 'place', title: '생라자르 역', art: '🚉🚂👮', text: '증기 기관차가 출발을 기다린다. 가니마르 경감: “변장한 뤼팽이로군! 꼼짝 마!”', shows: ['ganimard'] },
      { key: 'ganimard', type: 'red', title: '가니마르 경감', art: '👮‍♂️', text: '' },
      { key: 'press', type: 'blue', title: '기자 출입증', art: '🪪', text: '“르 피가로 — 특파원”' },
      { key: 'cleared', type: 'item', from: ['ganimard', 'press'], discard: ['ganimard', 'press'], shows: ['etretat'], title: '기자 행세', art: '📰', text: '“아, 기자 양반이었군!” 경감이 길을 비켜 주었다. 열차는 노르망디 해안으로!' },
      { key: 'lair', type: 'place', from: ['ironDoor', 'shellkey'], discard: ['ironDoor', 'shellkey'], shows: ['cipher', 'lsafe'], title: '뤼팽의 은신처', art: '🎩🗝️🖼️', text: '바늘바위 속 은신처! 훔친 명화들 사이에 금고. 벽에 뤼팽의 서명이 크게 걸려 있다.' },
      { key: 'cipher', type: 'item', title: '뤼팽의 수수께끼', art: '📜', text: '“금고는 내 이름의 첫 글자와 끝 글자. 알파벳 순번으로 (A=1).” — ARSÈNE LUPIN' },
      { key: 'lsafe', type: 'code', title: '은신처 금고', art: '🔐', text: '숫자 4자리.', code: '0114', result: 'out', hint: ['ARSÈNE LUPIN 의 첫 글자 A, 끝 글자 N.', 'A=01, N=14 → 0114'] },
      { key: 'out', type: 'item', end: true, title: '흰 다이아몬드', art: '💎🎩', text: '금고 속에 진짜 흰 다이아몬드와 쪽지: “축하하오. 이번엔 당신이 이겼소. 다음엔 내가 이기겠지. — A.L.”' },
      { key: 'trap2', type: 'trap', from: ['ganimard', 'uv'], title: '수상한 장비', text: '자외선 등을 내밀자 경감이 “뤼팽의 도구다!”라며 더 의심했다.', penalty: 1 },
    ],
  },
  // ───── 시간의 틈에 갇히다 ─────
  {
    id: 'timewarp',
    set: {
      lab: { shows: ['board', 'console'], spots: [{ label: '공구함', x: 22, y: 72, reveal: 'magnet' }, { label: '고양이 밥그릇', x: 70, y: 80, reveal: 'core' }] },
      lens: { shows: ['egypt'], text: '황제가 검투사에게서 렌즈를 빼앗아 상으로 주었다! 기계에 끼우자 다음 시대로 휙 — 그런데 중세가 아니라 고대 이집트?!' },
      future: { shows: ['android'], text: '텅 빈 우주 정거장. 안내 로봇이 녹슬어 멈춰 있다. 정비 선반에 이것저것 놓여 있다.', spots: [{ label: '정비 선반', x: 72, y: 66, reveal: 'oilcan' }] },
    },
    add: [
      { key: 'console', type: 'red', title: '꺼진 시간 제어판', art: '🖥️', text: '동력 코어 칸이 비었다. 교수: “코어를 고양이가 갖고 놀다 어디 뒀더라…”' },
      { key: 'core', type: 'blue', title: '시간 동력 코어', art: '🔋', text: '' },
      { key: 'consoleOn', type: 'item', from: ['console', 'core'], discard: ['console', 'core'], shows: ['timemachine'], title: '제어판 가동', art: '🖥️✨', text: '제어판이 켜지고 시대 버튼에 불이 들어왔다!' },
      { key: 'egypt', type: 'place', title: '고대 이집트', art: '🔺🐫🦁', text: '거대한 스핑크스가 길을 막는다. “내 수수께끼를 풀어라 — 오벨리스크 셋의 높이를 더하라.” 오벨리스크: 10미터, 7미터, 4미터.', shows: ['sphinx'] },
      { key: 'sphinx', type: 'code', title: '스핑크스의 수수께끼', art: '🦁', text: '숫자 2자리.', code: '21', result: 'scarab', hint: ['오벨리스크 높이를 더하세요.', '10 + 7 + 4 = 21'] },
      { key: 'scarab', type: 'item', title: '시간의 풍뎅이', art: '🪲', shows: ['castle'], text: '스핑크스가 길을 열자 풍뎅이가 시간 문을 열어 준다. 이번엔 진짜 중세!' },
      { key: 'android', type: 'red', title: '녹슨 안내 로봇', art: '🤖', text: '“끼익… 좌… 표…” 관절이 굳었다.' },
      { key: 'oilcan', type: 'blue', title: '미래형 윤활유', art: '🛢️', text: '' },
      { key: 'androidOk', type: 'item', from: ['android', 'oilcan'], discard: ['android', 'oilcan'], shows: ['final'], title: '살아난 로봇', art: '🤖✨', text: '“감사합니다! 원래 시대로 돌아가려면 좌표를 입력하세요 — 지금 연도의 앞 두 자리(20) 뒤에, 콜로세움 검투사 방패의 숫자를 아라비아 숫자로.”' },
      { key: 'trap3', type: 'trap', from: ['android', 'magnet'], title: '찌지직!', text: '자석을 로봇에 대자 회로가 엉켜 이상한 춤을 추기 시작했다!', penalty: 1 },
    ],
  },
  // ───── 액션 스토리 ─────
  {
    id: 'actionstory',
    set: {
      gps: { shows: ['bike', 'elevator'] },
      roof: { shows: ['case', 'radio'], spots: [{ label: '환풍구', x: 30, y: 72, reveal: 'note' }, { label: '헬기 착륙장 바닥', x: 76, y: 60, reveal: 'keycard' }] },
      chase: { result: 'helipad' },
      out: { from: ['stella', 'cuffs'] },
    },
    add: [
      { key: 'radio', type: 'item', title: '무전기', art: '📻', text: '본부: “스텔라의 헬기는 구역을 돌다 항구 헬리패드에 내릴 거다. 수갑 챙겨!”' },
      { key: 'elevator', type: 'red', title: '옥상 엘리베이터', art: '🛗', text: '관계자 카드키가 필요하다.' },
      { key: 'keycard', type: 'blue', title: '스텔라가 떨어뜨린 카드키', art: '💳', text: '' },
      { key: 'down', type: 'item', from: ['elevator', 'keycard'], discard: ['elevator', 'keycard'], shows: ['garage'], title: '지하로!', art: '🛗⬇️', text: '엘리베이터가 지하 주차장까지 쏜살같이 내려간다.' },
      { key: 'helipad', type: 'place', title: '항구 헬리패드', art: '🚁⚓🌅', text: '스텔라의 헬기가 막 착륙했다! 그녀가 보석 가방을 들고 뛴다.', shows: ['stella'], spots: [{ label: '경찰 오토바이 짐칸', x: 24, y: 72, reveal: 'cuffs' }] },
      { key: 'stella', type: 'red', title: '도둑 스텔라', art: '🦹‍♀️💎', text: '“날 잡을 수 있을 것 같아?”' },
      { key: 'cuffs', type: 'blue', title: '수갑', art: '🔗', text: '' },
      { key: 'trap1', type: 'trap', from: ['stella', 'keycard'], title: '함정 카드!', text: '카드키를 내밀자 스텔라가 웃으며 연막탄을 터뜨렸다. 콜록!', penalty: 1 },
    ],
  },
  // ───── 로빈 후드 ─────
  {
    id: 'robinhood',
    set: {
      forest: { shows: ['john', 'castle', 'abbey'], spots: [{ label: '과녁', emoji: '🎯', x: 80, y: 44, text: '과녁에 화살 3개: 정중앙 2개, 바깥 1개.' }, { label: '사냥꾼 바구니', x: 20, y: 66, reveal: 'pie' }] },
      robe: { from: ['tuck', 'pie'], discard: ['tuck', 'pie'], text: '배부른 턱 수도사가 여벌 수도사 옷을 빌려주었다. “하느님의 가호를!”' },
      dungeon: { shows: ['jailer'] },
      room: { spots: [{ label: '연회 식탁', x: 28, y: 62, reveal: 'meat' }, { label: '술 창고', x: 76, y: 70, reveal: 'ale' }] },
    },
    add: [
      { key: 'abbey', type: 'place', title: '숲속 수도원', art: '⛪🍺🧔', text: '턱 수도사가 배를 움켜쥐고 있다. “배가 고파 아무것도 못 하겠네!”', shows: ['tuck'] },
      { key: 'tuck', type: 'red', title: '배고픈 턱 수도사', art: '🧔‍♂️', text: '' },
      { key: 'pie', type: 'blue', title: '고기 파이', art: '🥧', text: '' },
      { key: 'jailer', type: 'red', title: '감옥 간수', art: '💂', text: '열쇠를 허리에 차고 졸고 있다. 술을 좋아한다는 소문.' },
      { key: 'ale', type: 'blue', title: '맥주 통', art: '🍺', text: '' },
      { key: 'drunk', type: 'item', from: ['jailer', 'ale'], discard: ['jailer', 'ale'], shows: ['cell'], title: '곯아떨어진 간수', art: '😵‍💫', text: '맥주를 들이켠 간수가 코를 골며 쓰러졌다. 쇠창살 너머 로빈이 웃는다. “왔구나! 신호를 주면 창살을 같이 들어 올리자.”' },
      { key: 'trap2', type: 'trap', from: ['jailer', 'meat'], title: '고기 냄새', text: '닭다리 냄새에 사냥개가 깨서 짖어 댔다! 숨느라 진땀을 뺐다.', penalty: 1 },
      { key: 'trap3', type: 'trap', from: ['tuck', 'ale'], title: '수도사가 취했다', text: '턱 수도사에게 술을 줬더니 노래를 부르다 잠들어 버렸다. 깨우느라 한참 걸렸다.', penalty: 1 },
    ],
  },
  // ───── 불탄 천사들 사건 ─────
  {
    id: 'burntangels',
    set: {
      church: { shows: ['angels', 'prayer', 'lestrade'] },
      warden: { shows: ['lodging'], text: '“첫 화재는 3월 1일, 둘째는 4월 3일이었습니다. 오르간 연주자 그레이브스 씨가 그날마다 늦게까지 남아 있었지요. 그분 하숙집은 성당 뒤편이에요.”' },
      out: { from: ['graves', 'whistle'] },
    },
    add: [
      { key: 'lestrade', type: 'item', title: '레스트레이드 경감', art: '👮', text: '“홈즈, 이번엔 우리가 먼저 범인을 잡을 거요!” 그는 엉뚱하게 성당지기를 의심하고 있다.' },
      { key: 'lodging', type: 'place', title: '그레이브스의 하숙방', art: '🛏️🗄️🎼', text: '악보가 어지럽게 쌓여 있다. 잠긴 책상 서랍.', shows: ['desk'], spots: [{ label: '악보 더미', x: 74, y: 40, reveal: 'hairpin' }] },
      { key: 'desk', type: 'red', title: '잠긴 책상 서랍', art: '🗄️', text: '' },
      { key: 'hairpin', type: 'blue', title: '머리핀', art: '📌', text: '홈즈: “자물쇠 따기엔 이만한 게 없지.”' },
      { key: 'gravesnote', type: 'item', from: ['desk', 'hairpin'], discard: ['desk', 'hairpin'], title: '서랍 속 메모', art: '📝', text: '“성당 지하에 화물 보관. 천사상이 길을 비추면 안 된다. 신부가 눈치챘다 — 묘지에.” 그레이브스의 필체다.' },
      { key: 'ledger', type: 'item', from: ['organ', 'organkey'], discard: ['organ', 'organkey'], shows: ['docks'], title: '밀수 장부', art: '📒', text: '오르간 속 장부: “템스강 7번 부두, 오늘 밤 자정 출항.” 레스트레이드: “당장 부두로!”' },
      { key: 'docks', type: 'place', title: '템스강 부두', art: '⚓🌫️🚤', text: '안개 낀 부두. 그레이브스가 화물선에 오르려 한다! 경찰을 부를 방법이 필요하다.', shows: ['graves'], spots: [{ label: '경찰 초소', x: 24, y: 70, reveal: 'whistle' }] },
      { key: 'graves', type: 'red', title: '도망치는 그레이브스', art: '🏃‍♂️', text: '' },
      { key: 'whistle', type: 'blue', title: '경찰 호루라기', art: '📯', text: '' },
      { key: 'trap2', type: 'trap', from: ['desk', 'ash'], title: '재투성이', text: '재를 서랍 틈에 뿌려 봤지만 손만 새까매졌다.', penalty: 1 },
      { key: 'trap3', type: 'trap', from: ['graves', 'hairpin'], title: '놓쳤다!', text: '머리핀을 들고 달려들었다가 그레이브스에게 밀쳐졌다!', penalty: 1 },
    ],
  },
];
