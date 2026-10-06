'use strict';
// 언락! 키즈 — 어린이용 짧은 모험 (탐정 이야기 · 지난날 이야기 · 전설 이야기)

const kid = (id, box, title, orig, theme, intro, cards) => ({ id, box, title, orig, diff: 0, theme, intro, cards });

module.exports = [
  // ───────────── 키즈: 탐정 이야기 ─────────────
  kid('kid-castle', '키즈: 탐정 이야기', '맥 언락의 성', "Mac Unlock's Castle", '#6a8a4a', '스코틀랜드의 맥 언락 성에서 가보인 은 백파이프가 사라졌어요! 꼬마 탐정 출동!', [
    { key: 'hall', type: 'place', start: true, title: '성의 큰 방', art: '🏰🛡️🐕🎶', text: '갑옷, 벽난로, 졸고 있는 강아지. 강아지 목줄에 무언가 반짝여요.',
      shows: ['dog'], spots: [{ label: '갑옷 투구 속', emoji: '🪖', x: 25, y: 40, reveal: 'bone' }] },
    { key: 'dog', type: 'red', title: '졸린 강아지', art: '🐕', text: '목줄에 작은 열쇠가 달렸어요. 뭔가 맛있는 걸 주면 일어날 거예요.' },
    { key: 'bone', type: 'blue', title: '뼈다귀 과자', art: '🦴' , text: '' },
    { key: 'tower', type: 'code', from: ['dog', 'bone'], discard: ['dog', 'bone'], title: '탑 문', art: '🚪', text: '강아지가 열쇠를 주었는데, 탑 문은 숫자 자물쇠예요! 문에 그림: 🐕 다리는 몇 개?', code: '4', result: 'out', hint: ['강아지 다리를 세어 봐요.', '4'] },
    { key: 'out', type: 'item', end: true, title: '백파이프를 찾았다!', art: '🎶🏴', text: '탑 꼭대기에서 까치가 백파이프를 둥지로 가져가 있었어요. 삐리리~' },
  ]),
  kid('kid-feather', '키즈: 탐정 이야기', '깃털 공과 수수께끼', 'Feather Balls & Mysteries', '#d8a83a', '배드민턴 대회 날, 셔틀콕이 몽땅 사라졌어요. 누가 가져갔을까요?', [
    { key: 'gym', type: 'place', start: true, title: '체육관', art: '🏸🏟️🐦🧺', text: '빈 셔틀콕 통, 창문이 열려 있고 창틀에 깃털이 몇 개 있어요.',
      shows: ['window'], spots: [{ label: '창틀', emoji: '🪶', x: 70, y: 30, text: '깃털 색: 하양, 하양, 파랑.' }, { label: '체육 창고', emoji: '🚪', x: 25, y: 65, reveal: 'ladder' }] },
    { key: 'window', type: 'red', title: '높은 창문', art: '🪟', text: '너무 높아요!' },
    { key: 'ladder', type: 'blue', title: '사다리', art: '🪜', text: '' },
    { key: 'nest', type: 'machine', from: ['window', 'ladder'], discard: ['window', 'ladder'], title: '지붕 위 새 둥지', art: '🪺', text: '둥지에 색깔 단추가 있어요. 창틀 깃털 색 순서대로 눌러요!', buttons: ['⚪', '🔵', '🔴'], solution: ['⚪', '⚪', '🔵'], result: 'out', hint: ['창틀 깃털 색을 봐요.', '⚪ ⚪ 🔵'] },
    { key: 'out', type: 'item', end: true, title: '셔틀콕을 찾았다!', art: '🏸🐦', text: '새들이 셔틀콕으로 둥지를 꾸몄었네요. 새 둥지 재료를 선물하고 셔틀콕을 돌려받았어요.' },
  ]),
  kid('kid-park', '키즈: 탐정 이야기', '공원 대소동', 'Fuss at the Park', '#4ab858', '공원 분수대가 멈추고 회전목마도 고장! 공원 관리인을 도와 고쳐 봐요.', [
    { key: 'park', type: 'place', start: true, title: '동네 공원', art: '⛲🎠🌳🦆', text: '멈춘 분수대, 오리 연못, 관리인 오두막.',
      shows: ['fountain'], spots: [{ label: '오리 연못', emoji: '🦆', x: 70, y: 65, text: '오리가 3마리, 아기 오리가 5마리 있어요.' }] },
    { key: 'fountain', type: 'code', title: '분수대 스위치', art: '⛲', text: '스위치 상자에 “오리 가족 수를 모두 더해요” 라고 쓰여 있어요.', code: '8', result: 'out', hint: ['오리 3마리 + 아기 오리 5마리.', '8'] },
    { key: 'out', type: 'item', end: true, title: '분수가 솟아요!', art: '⛲🌈', text: '분수가 다시 솟고 무지개가 떴어요. 오리들도 신났어요!' },
  ]),

  // ───────────── 키즈: 지난날 이야기 ─────────────
  kid('kid-hatshepsut', '키즈: 지난날 이야기', '이집트 여왕 하트셉수트의 비밀', 'The Mysteries of Hatshepsut, Queen of Egypt', '#d8b83a', '고대 이집트! 여왕의 신전에 숨겨진 보물 지도를 찾아요.', [
    { key: 'temple', type: 'place', start: true, title: '여왕의 신전', art: '🏛️🐫🔺☀️', text: '기둥에 그림: 🐱 고양이 2마리, 🐍 뱀 1마리, 🦅 새 3마리.',
      shows: ['door'], spots: [{ label: '모래 더미', emoji: '🏜️', x: 30, y: 70, reveal: 'scarab' }] },
    { key: 'door', type: 'red', title: '돌문', art: '🚪', text: '가운데 풍뎅이 모양 구멍.' },
    { key: 'scarab', type: 'blue', title: '돌 풍뎅이', art: '🪲', text: '' },
    { key: 'chest', type: 'code', from: ['door', 'scarab'], discard: ['door', 'scarab'], title: '여왕의 보물함', art: '📦', text: '“기둥 그림 동물 수를 고양이, 뱀, 새 순서로.”', code: '213', result: 'out', hint: ['기둥의 그림을 세어요.', '2 · 1 · 3 → 213'] },
    { key: 'out', type: 'item', end: true, title: '보물 지도!', art: '🗺️👑', text: '보물함 속에서 여왕의 보물 지도가 나왔어요. 다음 모험이 기다려요!' },
  ]),
  kid('kid-prehistory', '키즈: 지난날 이야기', '선사 시대 산책', 'Strolls Through Prehistory', '#8a6a3a', '석기 시대 마을! 불을 피워 추운 밤을 이겨 내요.', [
    { key: 'cave', type: 'place', start: true, title: '동굴 마을', art: '🪨🦣🔥🌙', text: '추워요! 모닥불을 피워야 해요. 동굴 벽화에 매머드와 사냥꾼.',
      shows: ['firepit'], spots: [{ label: '나뭇가지 더미', emoji: '🪵', x: 25, y: 70, reveal: 'flint' }, { label: '동굴 벽화', emoji: '🖼️', x: 70, y: 35, text: '벽화 순서: 🪵 나무 → 🪨 돌 → 🔥 불' }] },
    { key: 'firepit', type: 'red', title: '빈 모닥불 자리', art: '⭕', text: '' },
    { key: 'flint', type: 'blue', title: '부싯돌', art: '🪨', text: '' },
    { key: 'fire', type: 'machine', from: ['firepit', 'flint'], discard: ['firepit', 'flint'], title: '불 피우기', art: '🔥', text: '벽화 순서대로 해 봐요!', buttons: ['🔥', '🪨', '🪵'], solution: ['🪵', '🪨', '🔥'], result: 'out', hint: ['동굴 벽화를 봐요.', '🪵 → 🪨 → 🔥'] },
    { key: 'out', type: 'item', end: true, title: '따뜻한 밤', art: '🔥😊', text: '모닥불이 활활! 마을 사람들이 모여 노래를 불러요.' },
  ]),
  kid('kid-goldencity', '키즈: 지난날 이야기', '골든 시티에 어서 와', 'Welcome to Golden City', '#c8883a', '서부 개척 시대 마을 골든 시티! 은행 금고가 잠겨 마을 축제를 못 해요.', [
    { key: 'town', type: 'place', start: true, title: '골든 시티 거리', art: '🤠🐴🏦🌵', text: '보안관 사무실, 은행, 말 3마리가 묶인 기둥.',
      shows: ['bank'], spots: [{ label: '보안관 책상', emoji: '⭐', x: 25, y: 60, text: '보안관 메모: “금고 번호는 말의 수와 선인장 수!” 선인장은 2그루.' }] },
    { key: 'bank', type: 'code', title: '은행 금고', art: '🏦', text: '숫자 2자리.', code: '32', result: 'out', hint: ['말은 3마리, 선인장은 2그루.', '32'] },
    { key: 'out', type: 'item', end: true, title: '축제 시작!', art: '🎉🤠', text: '금고에서 축제 상금을 꺼냈어요. 이히~ 마을 축제가 시작돼요!' },
  ]),

  // ───────────── 키즈: 전설 이야기 ─────────────
  kid('kid-africa', '키즈: 전설 이야기', '아프리카의 심장에서', 'In the Heartland of Africa', '#d8883a', '사바나의 동물들이 물웅덩이를 찾고 있어요. 길을 알려 줘요!', [
    { key: 'savanna', type: 'place', start: true, title: '사바나', art: '🦁🦒🐘🌅', text: '바오바브나무 아래 동물들이 모였어요. 나무에 화살표가 새겨져 있어요.',
      shows: ['path'], spots: [{ label: '바오바브나무', emoji: '🌳', x: 50, y: 40, text: '화살표: ⬆️ ➡️ ⬆️' }] },
    { key: 'path', type: 'machine', title: '물웅덩이로 가는 길', art: '🧭', text: '방향을 골라 동물들을 이끌어요.', buttons: ['⬆️', '⬇️', '⬅️', '➡️'], solution: ['⬆️', '➡️', '⬆️'], result: 'out', hint: ['바오바브나무의 화살표.', '⬆️ ➡️ ⬆️'] },
    { key: 'out', type: 'item', end: true, title: '물웅덩이 도착!', art: '💧🦓', text: '동물들이 시원한 물을 마시며 고마워해요.' },
  ]),
  kid('kid-chichen', '키즈: 전설 이야기', '치첸이트사의 비밀', 'The Mysteries of Chichén Itzá', '#3a9a6a', '마야의 피라미드 꼭대기에 깃털 뱀 신의 선물이 있대요!', [
    { key: 'pyramid', type: 'place', start: true, title: '피라미드 아래', art: '🔺🐍🌿☀️', text: '계단 옆에 깃털 뱀 조각. 꼭대기 문은 잠겨 있어요.',
      shows: ['top'], spots: [{ label: '뱀 조각', emoji: '🐍', x: 30, y: 60, text: '뱀 몸통에 깃털이 1, 5, 9개씩 세 무리.' }] },
    { key: 'top', type: 'code', title: '꼭대기 문', art: '🚪', text: '“깃털 뱀의 깃털 무리를 순서대로.” 숫자 3자리.', code: '159', result: 'out', hint: ['뱀 조각의 깃털 수.', '1 · 5 · 9 → 159'] },
    { key: 'out', type: 'item', end: true, title: '신의 선물', art: '🌽✨', text: '꼭대기 방에는 황금 옥수수가! 마을에 풍년이 들 거예요.' },
  ]),
  kid('kid-olympus', '키즈: 전설 이야기', '올림포스로의 여행', 'Voyage to Olympus', '#5a8ae8', '그리스 신들의 산 올림포스! 제우스의 번개를 찾아 돌려줘요.', [
    { key: 'mountain', type: 'place', start: true, title: '올림포스 산기슭', art: '⛰️⚡🏛️☁️', text: '구름 계단 앞 문지기 페가수스. 날개에 깃털이 하나 빠졌어요.',
      shows: ['pegasus'], spots: [{ label: '올리브 나무', emoji: '🫒', x: 25, y: 60, reveal: 'feather' }] },
    { key: 'pegasus', type: 'red', title: '날개 다친 페가수스', art: '🐴', text: '깃털을 찾아 주면 태워 준대요.' },
    { key: 'feather', type: 'blue', title: '하얀 깃털', art: '🪶', text: '' },
    { key: 'clouds', type: 'machine', from: ['pegasus', 'feather'], discard: ['pegasus', 'feather'], title: '구름 위 신전', art: '☁️🏛️', text: '제우스: “번개는 내 의자 밑에! 의자를 열려면 해-구름-번개 순서로!”', buttons: ['⚡', '☁️', '☀️'], solution: ['☀️', '☁️', '⚡'], result: 'out', hint: ['제우스가 알려 줘요.', '☀️ → ☁️ → ⚡'] },
    { key: 'out', type: 'item', end: true, title: '번개를 되찾다', art: '⚡👑', text: '제우스가 번개를 높이 들자 하늘에 멋진 불꽃이 터져요. “고맙다, 꼬마 영웅!”' },
  ]),
];
