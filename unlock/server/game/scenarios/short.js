'use strict';
// 언락! 시나리오 — 쇼트 어드벤처 (짧은 모험 10편)

const B = '쇼트 어드벤처';
module.exports = [
  {
    id: 'seaspray', box: B, title: '물보라의 노래', orig: 'The Song of the Sea Spray', diff: 1, theme: '#2a8ab8',
    intro: '등대지기가 사라진 밤, 폭풍 속에서 배 한 척이 암초로 다가온다. 등대 불을 켜라!',
    cards: [
      { key: 'lighthouse', type: 'place', start: true, title: '등대 1층', art: '🗼🌊⛈️⚓', text: '나선 계단 위 등불실 문이 잠겨 있다. 등대지기의 낡은 일지.',
        shows: ['log', 'lamproom'], spots: [{ label: '밧줄 더미', emoji: '🪢', x: 25, y: 70, text: '밧줄에 매듭 셋: 하나, 둘, 네 번 감긴 매듭.' }] },
      { key: 'log', type: 'item', title: '등대지기 일지', art: '📓', text: '“등불실 문은 밧줄 매듭의 감긴 횟수 순서대로.”' },
      { key: 'lamproom', type: 'code', title: '등불실 문', art: '🚪', text: '숫자 3자리.', code: '124', result: 'lamp', hint: ['1층 밧줄 더미를 살펴보세요.', '1 · 2 · 4 → 124'] },
      { key: 'lamp', type: 'machine', title: '등대 램프', art: '💡', text: '스위치 셋. 램프 받침에: “기름 → 심지 → 렌즈 회전”', buttons: ['🔄 렌즈', '🛢️ 기름', '🔥 심지'], solution: ['🛢️ 기름', '🔥 심지', '🔄 렌즈'], result: 'out', hint: ['램프 받침의 글.', '기름 → 심지 → 렌즈'] },
      { key: 'out', type: 'item', end: true, title: '불빛이 바다를 비추다', art: '🗼✨🚢', text: '등대의 빛이 폭풍을 가르자 배가 방향을 틀어 무사히 항구로 들어온다.' },
    ],
  },
  {
    id: 'sherlockmind', box: B, title: '셜록 홈즈의 머릿속', orig: 'Inside the Mind of Sherlock Holmes', diff: 2, theme: '#5a3a2a',
    intro: '홈즈가 “기억의 궁전” 속에서 길을 잃었다. 그의 머릿속 방들을 지나 결정적 단서를 되찾게 돕자.',
    cards: [
      { key: 'palace', type: 'place', start: true, title: '기억의 궁전 현관', art: '🏛️🧠🎻🔍', text: '방문 세 개: 바이올린의 방, 화학의 방, 사건의 방. 사건의 방만 잠겨 있다.',
        shows: ['casedoor'], spots: [{ label: '바이올린의 방', emoji: '🎻', x: 20, y: 50, reveal: 'bow' }, { label: '화학의 방', emoji: '⚗️', x: 50, y: 50, text: '시험관 넷: 2, 2, 1, B 라벨 — “베이커가 221B”' }] },
      { key: 'casedoor', type: 'red', title: '사건의 방 문', art: '🚪🎼', text: '문에 오선지가 그려져 있다. 연주해야 열릴 듯.' },
      { key: 'bow', type: 'blue', title: '바이올린 활', art: '🎻', text: '' },
      { key: 'caseroom', type: 'place', from: ['casedoor', 'bow'], discard: ['casedoor', 'bow'], shows: ['memory'], title: '사건의 방', art: '🗂️🕯️', text: '홈즈의 목소리: “결정적 단서는… 내가 사는 곳의 번지수가 열쇠였지.”' },
      { key: 'memory', type: 'code', title: '기억의 서랍', art: '🗄️', text: '숫자 3자리.', code: '221', result: 'out', hint: ['화학의 방 시험관 라벨.', '221(B) → 221'] },
      { key: 'out', type: 'item', end: true, title: '기억이 돌아오다', art: '🎩💡', text: '“그래, 범인은 그 사람이었어!” 홈즈가 눈을 번쩍 뜬다.' },
    ],
  },
  {
    id: 'birmingham', box: B, title: '버밍엄 살인 사건', orig: 'The Birmingham Murder', diff: 2, theme: '#4a4a5a',
    intro: '1890년 버밍엄의 공장주가 서재에서 쓰러진 채 발견됐다. 세 용의자 중 범인을 가려내자.',
    cards: [
      { key: 'study', type: 'place', start: true, title: '공장주의 서재', art: '📚🕰️🥃🧥', text: '멈춘 회중시계(9:40), 반쯤 비운 위스키 잔, 벽난로의 타다 남은 편지.',
        shows: ['suspects', 'letter'], spots: [{ label: '벽난로 집게', emoji: '🔥', x: 25, y: 65, reveal: 'tongs' }] },
      { key: 'suspects', type: 'item', title: '세 용의자', art: '👥', text: '집사(9시에 퇴근), 동업자(9시 30분~10시 서재 방문 기록), 조카(10시 반 도착). 범행 시각은 시계가 멈춘 때.' },
      { key: 'letter', type: 'red', title: '타다 남은 편지', art: '✉️🔥', text: '불 속에서 꺼내야 한다.' },
      { key: 'tongs', type: 'blue', title: '벽난로 집게', art: '🥢', text: '' },
      { key: 'read', type: 'machine', from: ['letter', 'tongs'], discard: ['letter', 'tongs'], title: '경찰에 제출할 고발장', art: '📋', text: '편지: “동업자가 회사 돈을 빼돌렸다.” 고발장에 용의자를 고르세요.', buttons: ['집사', '동업자', '조카'], solution: ['동업자'], result: 'out',
        hint: ['범행 시각 9:40에 서재에 있던 사람은?', '동업자'] },
      { key: 'out', type: 'item', end: true, title: '범인 체포', art: '🚔', text: '동업자는 장부를 들킨 뒤 범행을 자백했다.' },
    ],
  },
  {
    id: 'schrodinger', box: B, title: '슈뢰딩거의 고양이', orig: "Schrödinger's Cat", diff: 3, theme: '#3a6a5a',
    intro: '물리학자의 실험실 상자 안에 고양이가 있다 — 살아 있을까, 아닐까? 상자를 열기 전에 장치를 해제해 고양이를 확실히 구하자.',
    cards: [
      { key: 'lab', type: 'place', start: true, title: '양자 실험실', art: '📦🐈⚛️🧪', text: '봉인된 상자, 방사능 계수기, 칠판 가득한 수식.',
        shows: ['board', 'box'], spots: [{ label: '계수기', emoji: '📟', x: 25, y: 60, text: '계수기 숫자가 0과 1 사이를 깜빡인다: 1-0-1-1' }, { label: '서랍', emoji: '🗃️', x: 75, y: 70, reveal: 'shield' }] },
      { key: 'board', type: 'item', title: '칠판', art: '🧮', text: '“이진수 1011 = ?” 아래에 “장치 해제 코드는 계수기가 보여 주는 이진수를 십진수로.”' },
      { key: 'box', type: 'red', title: '봉인된 상자', art: '📦', text: '열면 독약병이 깨질지도 모른다. 납 차폐막이 필요하다.' },
      { key: 'shield', type: 'blue', title: '납 차폐막', art: '🛡️', text: '' },
      { key: 'safe', type: 'code', from: ['box', 'shield'], discard: ['shield'], title: '상자의 독약 장치', art: '☠️⚙️', text: '차폐막을 대고 상자 옆면을 열었다. 독약 장치에 숫자 2자리.', code: '11', result: 'out', hint: ['1011(2) = 8 + 0 + 2 + 1.', '11'] },
      { key: 'out', type: 'item', end: true, title: '야옹!', art: '🐈😺', text: '장치가 멈추고 상자를 열자 고양이가 하품을 한다. 확실히 살아 있다!' },
    ],
  },
  {
    id: 'octopus', box: B, title: '문어의 비밀', orig: 'The Secrets of the Octopus', diff: 1, theme: '#c85a8a',
    intro: '수족관의 천재 문어가 탈출했다! 문어가 남긴 흔적을 따라가 보자.',
    cards: [
      { key: 'tank', type: 'place', start: true, title: '빈 수조', art: '🐙🐠🫧🪣', text: '수조 뚜껑이 열려 있고, 바닥에 젖은 빨판 자국이 문 쪽으로 이어진다.',
        shows: ['trail'], spots: [{ label: '수조 속 조개', emoji: '🐚', x: 30, y: 70, text: '조개 껍데기에 다리 수가 그려져 있다: 8' }] },
      { key: 'trail', type: 'code', title: '직원실 문', art: '🚪', text: '빨판 자국이 문 밑으로 사라졌다. 숫자 1자리 자물쇠. 문에 문어 낙서.', code: '8', result: 'out', hint: ['문어 다리는 몇 개?', '8'] },
      { key: 'out', type: 'item', end: true, title: '찾았다!', art: '🐙🍪', text: '문어는 직원실 과자 통 안에서 쿠키를 먹고 있었다.' },
    ],
  },
  {
    id: 'cabrakan', box: B, title: '카브라칸을 쫓아서', orig: 'In Pursuit of Cabrakan', diff: 2, theme: '#8a6a3a',
    intro: '마야 신화의 지진 거인 카브라칸이 깨어나 정글을 흔든다. 고대 신전의 의식으로 그를 다시 잠재우자.',
    cards: [
      { key: 'jungle', type: 'place', start: true, title: '정글 신전 앞', art: '🛕🌿🐍🌋', text: '땅이 흔들린다! 신전 계단에 네 개의 그림 문자: 재규어, 독수리, 뱀, 옥수수.',
        shows: ['glyphs', 'altar'], spots: [{ label: '덩굴 아래', emoji: '🌿', x: 25, y: 65, reveal: 'jade' }] },
      { key: 'glyphs', type: 'item', title: '계단의 그림 문자', art: '🐆🦅🐍🌽', text: '계단 아래부터: 옥수수, 뱀, 재규어, 독수리. “땅에서 하늘로 오르라.”' },
      { key: 'altar', type: 'red', title: '빈 제단', art: '🪨', text: '옥 구슬 모양 홈이 있다.' },
      { key: 'jade', type: 'blue', title: '옥 구슬', art: '🟢', text: '' },
      { key: 'ritual', type: 'machine', from: ['altar', 'jade'], discard: ['altar', 'jade'], title: '의식의 돌판', art: '🗿', text: '그림 문자 버튼.', buttons: ['🦅', '🐆', '🌽', '🐍'], solution: ['🌽', '🐍', '🐆', '🦅'], result: 'out', hint: ['계단 아래부터 위로.', '🌽 → 🐍 → 🐆 → 🦅'] },
      { key: 'out', type: 'item', end: true, title: '거인이 잠들다', art: '🌋💤', text: '땅의 울림이 멎는다. 카브라칸은 다시 깊은 잠에 빠졌다.' },
    ],
  },
  {
    id: 'dooarann', box: B, title: '두아란의 던전', orig: "Doo-Arann's Dungeon", diff: 1, theme: '#6a5a3a',
    intro: '사악한 마법사 두아란의 던전에 갇혔다. 횃불 하나에 의지해 탈출구를 찾자.',
    cards: [
      { key: 'cell', type: 'place', start: true, title: '지하 감옥', art: '⛓️🕯️💀🚪', text: '쇠창살 문, 벽의 횃불, 해골 하나. 해골이 무언가를 꽉 쥐고 있다.',
        shows: ['door'], spots: [{ label: '해골의 손', emoji: '💀', x: 40, y: 65, reveal: 'key' }, { label: '벽의 낙서', emoji: '✍️', x: 75, y: 30, text: '이전 죄수의 낙서: “출구는 왼쪽, 왼쪽, 오른쪽.”' }] },
      { key: 'door', type: 'red', title: '쇠창살 문', art: '🚪', text: '' },
      { key: 'key', type: 'blue', title: '녹슨 열쇠', art: '🗝️', text: '' },
      { key: 'maze', type: 'machine', from: ['door', 'key'], discard: ['door', 'key'], title: '갈림길 미로', art: '🧭', text: '문을 나서자 갈림길이 계속된다.', buttons: ['⬅️ 왼쪽', '➡️ 오른쪽'], solution: ['⬅️ 왼쪽', '⬅️ 왼쪽', '➡️ 오른쪽'], result: 'out', hint: ['벽의 낙서.', '왼쪽 → 왼쪽 → 오른쪽'] },
      { key: 'out', type: 'item', end: true, title: '바깥 공기!', art: '🌄', text: '마지막 계단을 오르자 별빛이 쏟아진다. 두아란의 분노한 외침이 멀어진다.' },
    ],
  },
  {
    id: 'angelflight', box: B, title: '천사의 비행', orig: 'The Flight of the Angel', diff: 3, theme: '#a8b8e8',
    intro: '도시의 랜드마크 “비행하는 천사” 동상이 하룻밤 새 사라졌다! 남은 단서로 도둑의 은신처를 찾자.',
    cards: [
      { key: 'plaza', type: 'place', start: true, title: '빈 동상 받침', art: '🏛️🌃🚁🪽', text: '받침대에 헬기 바퀴 자국과 깃털 하나. 광장 시계탑, CCTV 카메라.',
        shows: ['feather', 'cctv'], spots: [{ label: '광장 벤치', emoji: '🪑', x: 25, y: 70, reveal: 'usb' }, { label: '시계탑', emoji: '🕰️', x: 75, y: 25, text: '시계탑 숫자판 일부가 빠져 있다: 3과 7이 없다.' }] },
      { key: 'feather', type: 'item', title: '금속 깃털', art: '🪶', text: '동상의 깃털이다. 뒤에 작은 글씨: “Hangar 3-7”' },
      { key: 'cctv', type: 'red', title: 'CCTV 카메라', art: '📹', text: '녹화 장치 포트가 열려 있다.' },
      { key: 'usb', type: 'blue', title: '분실된 USB', art: '💾', text: '' },
      { key: 'video', type: 'item', from: ['cctv', 'usb'], discard: ['cctv', 'usb'], shows: ['hangar'], title: 'CCTV 영상', art: '🎞️', text: '새벽 4시, 헬기가 동상을 매달고 공항 쪽으로 날아갔다. 헬기 옆면에 “격납고 번호는 깃털에”.' },
      { key: 'hangar', type: 'code', title: '공항 격납고 지구', art: '🛫', text: '격납고 번호 2자리를 입력하세요.', code: '37', result: 'inside', hint: ['깃털 뒷면.', 'Hangar 3-7 → 37'] },
      { key: 'inside', type: 'machine', title: '격납고 셔터', art: '🚪', text: '셔터 제어: “잠금 해제 → 올리기 → 조명”.', buttons: ['💡 조명', '⬆️ 올리기', '🔓 잠금 해제'], solution: ['🔓 잠금 해제', '⬆️ 올리기', '💡 조명'], result: 'out', hint: ['셔터 제어판의 순서.', '잠금 해제 → 올리기 → 조명'] },
      { key: 'out', type: 'item', end: true, title: '천사를 되찾다', art: '🪽✨', text: '격납고 안에서 천사 동상과 도둑들을 발견했다. 경찰 사이렌이 울려 퍼진다.' },
    ],
  },
  {
    id: 'mummy', box: B, title: '미라의 각성', orig: 'The Awakening of the Mummy', diff: 2, theme: '#c8a85a',
    intro: '피라미드 탐사 중 석관이 열리고 미라가 깨어났다! 미라가 완전히 깨어나기 전에 봉인 의식을 치르자.',
    cards: [
      { key: 'tomb', type: 'place', start: true, title: '파라오의 묘실', art: '⚱️🧟🔺🐍', text: '석관에서 붕대 감긴 손이 꿈틀댄다. 벽에 상형 문자, 카노푸스 단지 넷.',
        shows: ['jars', 'wall'], spots: [{ label: '석관 아래', emoji: '⚰️', x: 30, y: 70, reveal: 'scarab' }] },
      { key: 'wall', type: 'item', title: '벽의 상형 문자', art: '𓂀', text: '“단지의 신들을 동-서-남-북 순으로 깨우면 봉인이 열린다: 동쪽 매(🦅), 서쪽 자칼(🐺), 남쪽 원숭이(🐒), 북쪽 사람(🧑).”' },
      { key: 'jars', type: 'machine', title: '카노푸스 단지', art: '🏺🏺🏺🏺', text: '단지 뚜껑의 동물 머리를 차례로 돌리자.', buttons: ['🧑', '🐒', '🐺', '🦅'], solution: ['🦅', '🐺', '🐒', '🧑'], result: 'seal', hint: ['벽의 상형 문자.', '🦅 → 🐺 → 🐒 → 🧑'] },
      { key: 'seal', type: 'red', title: '열린 봉인 구멍', art: '🕳️', text: '풍뎅이 모양 홈.' },
      { key: 'scarab', type: 'blue', title: '황금 풍뎅이', art: '🪲', text: '' },
      { key: 'out', type: 'item', from: ['seal', 'scarab'], end: true, title: '다시 잠든 미라', art: '🧟💤', text: '풍뎅이를 끼우자 미라가 스르르 석관으로 돌아눕는다. 묘실에 다시 정적이 흐른다.' },
    ],
  },
  {
    id: 'recipes', box: B, title: '옛날 옛적 비밀 레시피', orig: 'Secret Recipes of Yore', diff: 1, theme: '#d88a4a',
    intro: '할머니의 전설적인 사과 파이 레시피가 오래된 부엌 어딘가에 숨겨져 있다. 찾아서 파이를 구워 보자!',
    cards: [
      { key: 'kitchen', type: 'place', start: true, title: '할머니의 부엌', art: '🥧🍎🧺🕰️', text: '사과 바구니, 밀가루 통, 잠긴 레시피 상자. 벽에 오븐 온도표.',
        shows: ['recipebox'], spots: [{ label: '사과 바구니', emoji: '🧺', x: 25, y: 65, text: '사과 개수를 세어 보니 6개.' }, { label: '오븐', emoji: '🔥', x: 75, y: 60, text: '오븐 다이얼에 연필 자국: 180' }] },
      { key: 'recipebox', type: 'code', title: '레시피 상자', art: '📦', text: '상자 뚜껑: “파이에 넣는 사과 수와 굽는 온도.” 숫자 4자리.', code: '6180', result: 'out', hint: ['사과 바구니와 오븐.', '6 · 180 → 6180'] },
      { key: 'out', type: 'item', end: true, title: '전설의 사과 파이', art: '🥧😋', text: '레시피대로 구운 파이 냄새가 온 집 안에 퍼진다. 할머니 맛 그대로!' },
    ],
  },
];
