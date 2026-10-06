'use strict';
// 언락! 확장 패치 5 — 쇼트 어드벤처를 원작 분량에 가깝게
// add: 새 카드, set: 기존 카드의 값 바꾸기 (배열은 통째로 바뀜)

module.exports = [
  // ───── 옛날 옛적 비밀 레시피 ─────
  {
    id: 'recipes',
    set: {
      kitchen: { spots: [{ label: '사과 바구니', emoji: '🧺', x: 22, y: 66, text: '사과를 세어 보니 6개.' }, { label: '향신료 선반', x: 74, y: 30, reveal: 'cinnamon' }, { label: '창가 우유병', x: 50, y: 20, reveal: 'milk' }] },
      recipe: { shows: ['dough', 'cellar'] },
      bake: { result: 'pie' },
      out: { from: ['stove', 'wood'], discard: ['stove', 'wood'] },
    },
    add: [
      { key: 'cellar', type: 'place', title: '지하 저장고', art: '🪵🐈🧀', text: '치즈와 장작 더미. 장작 위에서 뚱뚱한 고양이가 쿨쿨 자고 있다.', shows: ['cat'] },
      { key: 'cat', type: 'red', title: '장작 위의 고양이', art: '🐈💤', text: '꿈쩍도 하지 않는다.' },
      { key: 'milk', type: 'blue', title: '우유 한 접시', art: '🥛', text: '' },
      { key: 'catmoved', type: 'item', from: ['cat', 'milk'], discard: ['cat', 'milk'], title: '비켜 준 고양이', art: '🐈🥛', text: '고양이가 우유를 핥으러 내려왔다.', spots: [{ label: '장작 더미', x: 50, y: 60, reveal: 'wood' }] },
      { key: 'pie', type: 'item', title: '굽기 전 파이', art: '🥧', shows: ['stove'], text: '완벽하게 준비했다! 그런데 오븐이 아니라 할머니는 장작 화덕에 구웠다고 레시피 끝에 적혀 있다.' },
      { key: 'stove', type: 'red', title: '차가운 장작 화덕', art: '🔥', text: '불씨 하나 없다.' },
      { key: 'wood', type: 'blue', title: '마른 장작', art: '🪵', text: '' },
    ],
  },
  // ───── 미라의 각성 ─────
  {
    id: 'mummy',
    set: {
      lit: { shows: ['anubis'], text: '횃불에 바닥의 함정 타일이 보인다! 무사히 지나자 아누비스 석상이 길을 막는다.' },
    },
    add: [
      { key: 'anubis', type: 'place', title: '심판의 방', art: '🐺⚖️🪶', text: '자칼 머리의 아누비스 석상이 저울을 들고 있다. 받침의 글: “깃털보다 가벼운 심장만이 지나리라.”', shows: ['scale'], spots: [{ label: '벽의 매 조각', x: 76, y: 30, reveal: 'feather' }] },
      { key: 'scale', type: 'red', title: '아누비스의 저울', art: '⚖️', text: '한쪽 접시가 비었다.' },
      { key: 'feather', type: 'blue', title: '마아트의 깃털', art: '🪶', text: '' },
      { key: 'weighed', type: 'item', from: ['scale', 'feather'], discard: ['scale', 'feather'], shows: ['tomb'], title: '심판 통과', art: '⚖️✨', text: '저울이 수평을 이루자 석상이 옆으로 미끄러진다. 묘실이다!' },
      { key: 'trap2', type: 'trap', from: ['scale', 'torch'], title: '저울이 불타다', text: '횃불을 저울에 올리자 석상의 눈이 붉게 빛나며 모래가 쏟아졌다!', penalty: 1 },
    ],
  },
  // ───── 천사의 비행 ─────
  {
    id: 'angelflight',
    set: {
      bell: { result: 'stairs' },
      signal: { result: 'canal' },
      out: { from: ['gondola', 'oar'], discard: ['gondola', 'oar'], text: '곤돌라가 미로 같은 운하로 미끄러져 들어간다. 추격자는 따돌렸다. 손에는 천사가 건넨 비밀 문서 — 임무 완수!' },
    },
    add: [
      { key: 'stairs', type: 'place', title: '종탑 계단', art: '🪜🍷💂', text: '좁은 나선 계단 중간, 경비원이 길을 막고 투덜댄다. “카니발에 나만 일하고… 술 한 잔이면 소원이 없겠네.”', shows: ['guard'], spots: [{ label: '계단참 바구니', x: 24, y: 70, reveal: 'wine' }] },
      { key: 'guard', type: 'red', title: '투덜이 경비원', art: '💂', text: '' },
      { key: 'wine', type: 'blue', title: '포도주 병', art: '🍷', text: '' },
      { key: 'asleep', type: 'item', from: ['guard', 'wine'], discard: ['guard', 'wine'], shows: ['tower'], title: '곯아떨어진 경비원', art: '💂💤', text: '포도주를 들이켠 경비원이 코를 골기 시작했다. 꼭대기로!' },
      { key: 'canal', type: 'place', title: '운하 선착장', art: '🛶🌉🕵️', text: '문서를 받았다! 그런데 검은 가면의 적 첩보원이 쫓아온다. 선착장의 곤돌라엔 노가 없다.', shows: ['gondola'], spots: [{ label: '다리 밑 기둥', x: 76, y: 60, reveal: 'oar' }] },
      { key: 'gondola', type: 'red', title: '빈 곤돌라', art: '🛶', text: '' },
      { key: 'oar', type: 'blue', title: '곤돌라 노', art: '🚣', text: '' },
      { key: 'trap1', type: 'trap', from: ['gondola', 'wine'], title: '퐁당!', text: '포도주 병으로 노를 저으려다 병을 물에 빠뜨렸다. 추격자가 가까워진다!', penalty: 1 },
    ],
  },
  // ───── 카브라칸을 쫓아서 ─────
  {
    id: 'cabrakan',
    set: {
      ritual: { result: 'quake' },
      out: { from: ['giant', 'bird'], discard: ['giant', 'bird'] },
    },
    add: [
      { key: 'quake', type: 'place', title: '갈라진 땅', art: '🌋⚡🕳️', text: '의식이 거인을 약하게 했지만 카브라칸이 몸부림치며 땅을 갈랐다! 건너편 동굴로 거인이 숨어든다.', shows: ['chasm', 'twins'], spots: [{ label: '거대한 나무', x: 78, y: 30, reveal: 'liana' }] },
      { key: 'twins', type: 'item', title: '쌍둥이 영웅의 벽화', art: '👬🐦', text: '신화 속 쌍둥이 영웅 우나푸와 스발란케는 흙을 바른 구운 새를 먹여 카브라칸을 잠재웠다.' },
      { key: 'chasm', type: 'red', title: '깊은 균열', art: '🕳️', text: '' },
      { key: 'liana', type: 'blue', title: '튼튼한 덩굴', art: '🌿', text: '' },
      { key: 'crossed', type: 'place', from: ['chasm', 'liana'], discard: ['chasm', 'liana'], shows: ['giant'], title: '거인의 동굴', art: '🗿🔥🍖', text: '덩굴을 타고 건넜다. 동굴 안에서 거인이 배고프다며 으르렁댄다. 모닥불 위에 새가 구워지고 있다.', spots: [{ label: '모닥불', x: 30, y: 72, reveal: 'bird' }] },
      { key: 'giant', type: 'red', title: '굶주린 카브라칸', art: '🗿😠', text: '“배고프다아아!”' },
      { key: 'bird', type: 'blue', title: '흙 바른 구운 새', art: '🍗', text: '' },
    ],
  },
  // ───── 버밍엄 살인 사건 ─────
  {
    id: 'birmingham',
    set: {
      pub: { spots: [{ label: '당구대', x: 74, y: 70, reveal: 'officekey' }, { label: '바 카운터 아래', x: 24, y: 60, reveal: 'barkey' }] },
      letter: { shows: ['alibis', 'backroom'] },
      accuse: { from: ['backroom', 'barkey'], discard: ['backroom', 'barkey'], text: '뒷방에서 찢긴 장부 페이지와 빨간 립스틱이 묻은 손수건이 나왔다. 이제 보스에게 보고할 시간. “범인은 누구지?”' },
    },
    add: [
      { key: 'backroom', type: 'red', title: '바 뒷방 문', art: '🚪🍸', text: '바텐더들만 쓰는 방.' },
      { key: 'barkey', type: 'blue', title: '바 열쇠', art: '🗝️', text: '' },
    ],
  },
  // ───── 슈뢰딩거의 고양이 ─────
  {
    id: 'schrodinger',
    set: {
      lab: { spots: [{ label: '계수기', emoji: '📟', x: 22, y: 60, text: '계수기 숫자가 깜빡인다: 1-0-1-1' }, { label: '서랍', x: 76, y: 70, reveal: 'shield' }, { label: '칠판 지우개 통', x: 50, y: 24, reveal: 'anchor' }] },
      portal: { result: 'void' },
      multiverse: { from: ['drift', 'anchor'], discard: ['drift', 'anchor'] },
      opened: { result: 'decay' },
      out: { from: ['vial', 'pliers'], discard: ['vial', 'pliers'] },
    },
    add: [
      { key: 'void', type: 'place', title: '양자 공허', art: '🌌🌀🫥', text: '문 너머는 텅 빈 공허! 몸이 둥실 떠서 아무 데로도 갈 수 없다.', shows: ['drift'] },
      { key: 'drift', type: 'red', title: '표류', art: '🫥', text: '붙잡을 것이 필요하다.' },
      { key: 'anchor', type: 'blue', title: '양자 닻', art: '⚓', text: '실험실에서 챙겨 온 작은 닻 모양 장치.' },
      { key: 'decay', type: 'place', title: '확정된 우주', art: '📦☢️⏱️', text: '고양이가 하나로 정해졌다 — 살아 있다! 그런데 상자 속 독약 병의 타이머가 째깍거린다. 병을 묶은 철사를 끊어야 한다.', shows: ['vial'], spots: [{ label: '상자 옆 공구', x: 76, y: 70, reveal: 'pliers' }] },
      { key: 'vial', type: 'red', title: '독약 병 장치', art: '🧪⏱️', text: '00:59…' },
      { key: 'pliers', type: 'blue', title: '절연 펜치', art: '🔧', text: '' },
      { key: 'trap1', type: 'trap', from: ['vial', 'anchor'], title: '양자 요동', text: '닻을 독약 병에 대자 병이 두 개로 겹쳐 보였다! 어지럽다.', penalty: 1 },
    ],
  },
  // ───── 문어의 비밀 ─────
  {
    id: 'octopus',
    set: {
      trail: { result: 'lobby', title: '수조실 문', text: '빨판 자국이 문 밑으로 사라졌다. 숫자 1자리 자물쇠. 문에 문어 낙서.' },
    },
    add: [
      { key: 'lobby', type: 'place', title: '관람객 홀', art: '🐠🧒🕳️', text: '관람객들이 웅성거린다. 빨판 자국이 벽의 환풍구로 사라졌다! 사육사가 땀을 흘린다.', shows: ['vent', 'keeper'], spots: [{ label: '청소 카트', x: 24, y: 70, reveal: 'screwdriver' }] },
      { key: 'keeper', type: 'item', title: '사육사', art: '🧑‍🔬', text: '“오토는 꽃게라면 사족을 못 써요. 환풍구는 직원실로 이어지고요.”' },
      { key: 'vent', type: 'red', title: '환풍구 덮개', art: '🔩', text: '나사 네 개.' },
      { key: 'screwdriver', type: 'blue', title: '드라이버', art: '🪛', text: '' },
      { key: 'ventopen', type: 'item', from: ['vent', 'screwdriver'], discard: ['vent', 'screwdriver'], shows: ['staff'], title: '환풍구 따라가기', art: '🕳️🐙', text: '덮개를 열자 끈적한 자국이 직원실 쪽으로 이어진다.' },
    ],
  },
  // ───── 두아란의 던전 ─────
  {
    id: 'dooarann',
    set: {
      maze: { result: 'guardroom' },
    },
    add: [
      { key: 'guardroom', type: 'place', title: '트롤 경비실', art: '🧌🍄🚪', text: '출구 앞에서 트롤 경비병이 졸고 있다. 구석에 잠버섯이 자란다. 출구 문 위에 해골 셋과 박쥐 둘이 조각되어 있다.', shows: ['troll'], spots: [{ label: '구석 버섯', x: 24, y: 76, reveal: 'mushroom' }] },
      { key: 'troll', type: 'red', title: '꾸벅꾸벅 트롤', art: '🧌', text: '반쯤 졸고 있다.' },
      { key: 'mushroom', type: 'blue', title: '잠버섯', art: '🍄', text: '' },
      { key: 'sneak', type: 'item', from: ['troll', 'mushroom'], discard: ['troll', 'mushroom'], shows: ['exitdoor'], title: '깊은 잠', art: '🧌💤', text: '버섯 냄새에 트롤이 쿨쿨 잠들었다. 이제 출구 문을 열자.' },
      { key: 'exitdoor', type: 'code', title: '던전 출구', art: '🚪', text: '숫자 2자리 — “해골, 그리고 박쥐.”', code: '32', result: 'out', hint: ['문 위 조각을 세어 보세요.', '해골 3, 박쥐 2 → 32'] },
    ],
  },
  // ───── 물보라의 노래 ─────
  {
    id: 'seaspray',
    set: {
      den: { shows: ['cave'] },
      lighthouse: { result: 'top' },
      out: { from: ['lamp', 'oilflask'], discard: ['lamp', 'oilflask'] },
    },
    add: [
      { key: 'cave', type: 'place', title: '바다 동굴', art: '🌊🕳️🛶', text: '절벽과 등대 사이의 동굴. 밀물이 차오른다. 작은 나룻배가 묶여 있다.', shows: ['boat'], spots: [{ label: '조개 무더기', x: 74, y: 70, reveal: 'paddle' }] },
      { key: 'boat', type: 'red', title: '작은 나룻배', art: '🛶', text: '노가 없다.' },
      { key: 'paddle', type: 'blue', title: '나무 주걱 노', art: '🥄', text: '' },
      { key: 'crossed', type: 'item', from: ['boat', 'paddle'], discard: ['boat', 'paddle'], shows: ['lighthouse'], title: '동굴 건너기', art: '🛶➡️🗼', text: '물보라를 헤치고 등대 아래에 닿았다.' },
      { key: 'top', type: 'place', title: '등대 꼭대기', art: '🗼🌙💡', text: '마린이 기다린다. 그런데 등불이 꺼져 테오가 길을 찾지 못한다! 등잔에 기름이 없다.', shows: ['lamp'], spots: [{ label: '선반 위 플라스크', x: 24, y: 40, reveal: 'oilflask' }] },
      { key: 'lamp', type: 'red', title: '꺼진 등잔', art: '🪔', text: '' },
      { key: 'oilflask', type: 'blue', title: '고래 기름 플라스크', art: '🫙', text: '' },
    ],
  },
  // ───── 셜록 홈즈의 머릿속 ─────
  {
    id: 'sherlockmind',
    set: {
      memory: { result: 'hall2' },
      out: { text: '“그래, 서리의 정원사였어!” 홈즈가 눈을 번쩍 뜬다. 모리어티의 그림자가 기억의 궁전에서 사라진다.' },
    },
    add: [
      { key: 'hall2', type: 'place', title: '기억의 복도', art: '🕯️🎭🖼️', text: '서랍 속 사건 파일을 펼치자 복도가 어두워진다. 모리어티의 그림자가 기억을 지우려 한다! 벽에 왓슨의 사진 액자.', shows: ['moriarty', 'casefile'], spots: [{ label: '사진 액자', x: 76, y: 30, reveal: 'watson' }] },
      { key: 'casefile', type: 'item', title: '사건 파일', art: '🗂️', text: '현장 단서: 붉은 진흙(서리 지방), 왼손잡이의 칼자국. 용의자 — 정원사(서리, 왼손잡이) · 은행원(런던, 오른손잡이) · 의사(스코틀랜드, 왼손잡이).' },
      { key: 'moriarty', type: 'red', title: '모리어티의 그림자', art: '🎩🌑', text: '“홈즈, 넌 아무것도 기억하지 못할 거다.”' },
      { key: 'watson', type: 'blue', title: '왓슨의 목소리', art: '🧔🎖️', text: '“홈즈! 정신 차리게!”' },
      { key: 'deduce', type: 'machine', from: ['moriarty', 'watson'], discard: ['moriarty', 'watson'], title: '추리의 순간', art: '💡', text: '왓슨의 목소리에 그림자가 물러났다. 홈즈: “범인은…”', buttons: ['정원사', '은행원', '의사'], solution: ['정원사'], result: 'out', hint: ['서리 지방 + 왼손잡이를 모두 만족하는 사람.', '정원사'] },
    ],
  },
];
