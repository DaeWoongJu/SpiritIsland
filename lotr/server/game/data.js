'use strict';
// 반지의 제왕: 원정대의 운명 — 데이터 (가운데땅 지도, 인물, 카드, 목표)

// ───────────── 지역 ─────────────
const REGIONS = {
  eriador: { name: '에리아도르', color: '#5c9a4a' },
  rhovanion: { name: '로바니온', color: '#9a6ab8' },
  rohan: { name: '로한', color: '#d8b030' },
  gondor: { name: '곤도르', color: '#4a84c8' },
  mordor: { name: '모르도르', color: '#c84038' },
};

// type: haven(안식처 — 오크가 오지 않음), stronghold(적의 요새 — 점령 가능), mountain, forest, city, plain
// ring: 💍 반지 문양 카드, stealth: 👣 은신 문양 카드
const LOCATIONS = [
  { id: 'greyhavens', name: '회색항구', region: 'eriador', type: 'haven', x: 70, y: 200, ring: false, stealth: true },
  { id: 'hobbiton', name: '호빗골', region: 'eriador', type: 'city', x: 165, y: 205, ring: true, stealth: true },
  { id: 'bree', name: '브리', region: 'eriador', type: 'city', x: 255, y: 180, ring: false, stealth: true },
  { id: 'weathertop', name: '바람마루', region: 'eriador', type: 'mountain', x: 340, y: 165, ring: true, stealth: false },
  { id: 'rivendell', name: '깊은골', region: 'eriador', type: 'haven', x: 430, y: 150, ring: true, stealth: false },
  { id: 'dunland', name: '던랜드', region: 'eriador', type: 'plain', x: 255, y: 330, ring: false, stealth: true },
  { id: 'caradhras', name: '카라드라스', region: 'rhovanion', type: 'mountain', x: 455, y: 240, ring: false, stealth: false },
  { id: 'moria', name: '모리아', region: 'rhovanion', type: 'mountain', x: 430, y: 315, ring: true, stealth: true },
  { id: 'lorien', name: '로슬로리엔', region: 'rhovanion', type: 'haven', x: 525, y: 315, ring: true, stealth: false },
  { id: 'mirkwood', name: '어둠숲', region: 'rhovanion', type: 'forest', x: 625, y: 155, ring: false, stealth: true },
  { id: 'dale', name: '너른골', region: 'rhovanion', type: 'city', x: 735, y: 80, ring: false, stealth: false },
  { id: 'dolguldur', name: '돌 굴두르', region: 'rhovanion', type: 'stronghold', x: 615, y: 265, ring: true, stealth: false },
  { id: 'emynmuil', name: '에민 무일', region: 'rhovanion', type: 'mountain', x: 670, y: 345, ring: false, stealth: true },
  { id: 'deadmarshes', name: '죽음의 늪', region: 'rhovanion', type: 'plain', x: 735, y: 330, ring: true, stealth: true },
  { id: 'isenfords', name: '아이센 여울', region: 'rohan', type: 'plain', x: 320, y: 425, ring: false, stealth: false },
  { id: 'isengard', name: '아이센가드', region: 'rohan', type: 'stronghold', x: 385, y: 375, ring: true, stealth: false },
  { id: 'fangorn', name: '팡고른', region: 'rohan', type: 'forest', x: 485, y: 400, ring: false, stealth: true },
  { id: 'helm', name: '헬름협곡', region: 'rohan', type: 'mountain', x: 360, y: 485, ring: false, stealth: false },
  { id: 'edoras', name: '에도라스', region: 'rohan', type: 'city', x: 460, y: 480, ring: true, stealth: false },
  { id: 'amonhen', name: '아몬 헨', region: 'gondor', type: 'mountain', x: 595, y: 395, ring: true, stealth: false },
  { id: 'minastirith', name: '미나스 티리스', region: 'gondor', type: 'city', x: 620, y: 535, ring: true, stealth: false },
  { id: 'osgiliath', name: '오스길리아스', region: 'gondor', type: 'city', x: 690, y: 515, ring: false, stealth: true },
  { id: 'ithilien', name: '이실리엔', region: 'gondor', type: 'forest', x: 730, y: 440, ring: false, stealth: true },
  { id: 'dolamroth', name: '돌 암로스', region: 'gondor', type: 'city', x: 430, y: 625, ring: false, stealth: false },
  { id: 'pelargir', name: '펠라르기르', region: 'gondor', type: 'city', x: 610, y: 630, ring: true, stealth: false },
  { id: 'blackgate', name: '검은 문', region: 'mordor', type: 'stronghold', x: 800, y: 345, ring: false, stealth: false },
  { id: 'minasmorgul', name: '미나스 모르굴', region: 'mordor', type: 'stronghold', x: 780, y: 545, ring: true, stealth: false },
  { id: 'cirithungol', name: '키리스 웅골', region: 'mordor', type: 'mountain', x: 840, y: 490, ring: false, stealth: true },
  { id: 'gorgoroth', name: '고르고로스', region: 'mordor', type: 'plain', x: 875, y: 400, ring: true, stealth: true },
  { id: 'mountdoom', name: '운명의 산', region: 'mordor', type: 'mountain', x: 905, y: 480, ring: true, stealth: false },
  { id: 'baraddur', name: '바랏두르', region: 'mordor', type: 'plain', x: 950, y: 370, ring: false, stealth: false },
];

const EDGES = [
  ['greyhavens', 'hobbiton'], ['hobbiton', 'bree'], ['bree', 'weathertop'], ['weathertop', 'rivendell'],
  ['bree', 'dunland'], ['hobbiton', 'dunland'], ['dunland', 'isenfords'], ['dunland', 'moria'],
  ['rivendell', 'caradhras'], ['rivendell', 'mirkwood'], ['caradhras', 'moria'], ['moria', 'lorien'],
  ['lorien', 'dolguldur'], ['lorien', 'fangorn'], ['lorien', 'amonhen'],
  ['mirkwood', 'dolguldur'], ['mirkwood', 'dale'], ['dale', 'dolguldur'], ['dolguldur', 'emynmuil'],
  ['amonhen', 'emynmuil'], ['amonhen', 'fangorn'], ['emynmuil', 'deadmarshes'], ['deadmarshes', 'blackgate'], ['deadmarshes', 'ithilien'],
  ['isenfords', 'isengard'], ['isenfords', 'helm'], ['isengard', 'fangorn'], ['fangorn', 'edoras'], ['helm', 'edoras'],
  ['edoras', 'minastirith'], ['edoras', 'dolamroth'], ['minastirith', 'osgiliath'], ['minastirith', 'pelargir'], ['pelargir', 'dolamroth'],
  ['osgiliath', 'ithilien'], ['osgiliath', 'minasmorgul'], ['ithilien', 'minasmorgul'], ['ithilien', 'blackgate'], ['amonhen', 'minastirith'],
  ['blackgate', 'gorgoroth'], ['minasmorgul', 'cirithungol'], ['cirithungol', 'gorgoroth'], ['cirithungol', 'mountdoom'],
  ['gorgoroth', 'mountdoom'], ['gorgoroth', 'baraddur'], ['mountdoom', 'baraddur'],
];

const LOC_MAP = Object.fromEntries(LOCATIONS.map((l) => [l.id, { ...l, adj: [] }]));
for (const [a, b] of EDGES) { LOC_MAP[a].adj.push(b); LOC_MAP[b].adj.push(a); }
for (const l of LOCATIONS) l.adj = LOC_MAP[l.id].adj;

// ───────────── 인물 ─────────────
// 프로도와 샘은 언제나 함께 — 원정대 모두가 행동을 써서 움직임
const CHARACTERS = [
  { id: 'frodo', icon: '💍', name: '프로도와 샘', short: '프로도', color: '#e8c060', start: 'hobbiton', ringbearer: true,
    ability: '반지 운반자. 누구든 행동을 써서 움직일 수 있어요. 👣 은신 카드를 버리면 2칸까지 숨어서 이동. 운명의 산에서 반지를 파괴할 수 있는 유일한 인물.' },
  { id: 'gandalf', icon: '🧙', name: '회색의 간달프', short: '간달프', color: '#c8c8d0', start: 'hobbiton',
    ability: '공격하면 그곳의 오크를 모두 물리쳐요. 나즈굴을 쫓아낼 수 있어요.' },
  { id: 'aragorn', icon: '👑', name: '아라곤', short: '아라곤', color: '#4a8a5a', start: 'bree',
    ability: '공격 +1. 차례마다 한 번, 카드 없이 군대를 소집할 수 있어요. 프로도를 숨겨 줄 수 있어요.' },
  { id: 'legolas', icon: '🏹', name: '레골라스', short: '레골라스', color: '#8ac848', start: 'mirkwood',
    ability: '옆 지역의 오크도 활로 공격할 수 있어요. 숲에서 공격 +1.' },
  { id: 'gimli', icon: '🪓', name: '김리', short: '김리', color: '#b86a3a', start: 'dale',
    ability: '산·요새에서 공격 +1. 요새를 점령할 때 카드가 1장 덜 들어요.' },
  { id: 'boromir', icon: '📯', name: '보로미르', short: '보로미르', color: '#a83838', start: 'minastirith',
    ability: '보로미르가 있는 곳에는 오크가 늘어나지 않아요 (곤도르의 뿔나팔).' },
  { id: 'galadriel', icon: '✨', name: '갈라드리엘', short: '갈라드리엘', color: '#e8e8ff', start: 'lorien',
    ability: '행동: 갈라드리엘의 거울 — 어둠 카드 위 3장을 보고 1장을 맨 아래로. 프로도를 숨겨 줄 수 있어요.' },
  { id: 'faramir', icon: '🛡', name: '파라미르', short: '파라미르', color: '#3a6ab8', start: 'ithilien',
    ability: '곤도르 안에서는 한 번에 2칸 이동. 프로도를 숨겨 줄 수 있어요.' },
  { id: 'eowyn', icon: '⚔', name: '에오윈', short: '에오윈', color: '#f0d890', start: 'edoras',
    ability: '나즈굴을 쫓아낼 수 있어요 (“나는 남자가 아니다!”). 로한에서 공격 +1.' },
  { id: 'theoden', icon: '🐎', name: '세오덴', short: '세오덴', color: '#c89a30', start: 'edoras',
    ability: '로한에서 군대를 소집하면 2부대가 모여요.' },
  { id: 'elrond', icon: '📖', name: '엘론드', short: '엘론드', color: '#6a5ab8', start: 'rivendell',
    ability: '안식처에서 카드 1장을 버리면 희망 +1 (차례마다 한 번).' },
  { id: 'merrypippin', icon: '🍎', name: '메리와 피핀', short: '메리·피핀', color: '#d88a4a', start: 'hobbiton',
    ability: '어디에 있든 다른 인물과 카드를 주고받을 수 있어요.' },
  { id: 'treebeard', icon: '🌳', name: '나무수염', short: '나무수염', color: '#6a5a2a', start: 'fangorn',
    ability: '숲에서 공격하면 오크 3마리를 물리쳐요 (엔트의 분노).' },
];
const CHAR_MAP = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
const PLAYABLE = CHARACTERS.filter((c) => !c.ringbearer);

// ───────────── 이벤트 카드 (14) ─────────────
const EVENTS = [
  { id: 'eagles', name: '독수리의 비행', text: '인물 하나(프로도 포함)를 모르도르가 아닌 아무 곳으로 옮겨요.' },
  { id: 'lembas', name: '렘바스 빵', text: '이번 차례에 행동 2번을 더 해요.' },
  { id: 'palantir', name: '팔란티르', text: '어둠 카드 위 5장을 보고 1장을 게임에서 없애요.' },
  { id: 'entwrath', name: '엔트의 분노', text: '팡고른·아이센가드·아이센 여울의 오크를 모두 물리쳐요.' },
  { id: 'beacons', name: '곤도르의 봉화', text: '미나스 티리스와 에도라스에 군대 1부대씩, 그리고 곤도르·로한의 한 곳에 1부대.' },
  { id: 'mithril', name: '미스릴 갑옷', text: '프로도가 숨고, 희망 +1.' },
  { id: 'elbereth', name: '엘베레스 길소니엘!', text: '한 지역의 나즈굴을 모두 미나스 모르굴로 쫓아내요.' },
  { id: 'tom', name: '톰 봄바딜', text: '에리아도르 한 곳의 오크를 모두 물리쳐요. 프로도가 에리아도르에 있으면 숨어요.' },
  { id: 'gandalfwhite', name: '백색의 간달프', text: '희망 +2.' },
  { id: 'rohirrim', name: '로한의 기병대', text: '로한 또는 곤도르의 한 곳에 군대 2부대.' },
  { id: 'dead', name: '망자의 군대', text: '펠라르기르·돌 암로스와 곤도르 한 곳의 오크를 모두 물리쳐요.' },
  { id: 'phial', name: '갈라드리엘의 별빛 유리병', text: '프로도가 숨고, 2칸까지 이동해요.' },
  { id: 'gollum', name: '스메아골의 안내', text: '프로도가 숨은 채로 3칸까지 이동해요.' },
  { id: 'quiet', name: '고요한 밤', text: '다음 어둠 단계를 건너뛰어요.' },
];
const EVENT_MAP = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

// ───────────── 목표 (24) ─────────────
const sumBy = (g, ids, f) => ids.reduce((s, id) => s + f(g.locs[id]), 0);
const inRegion = (r) => LOCATIONS.filter((l) => l.region === r).map((l) => l.id);
const noOrcs = (g, ids) => ids.every((id) => g.locs[id].orcs === 0);
const charsAt = (g, id) => g.pawns.filter((p) => p.loc === id).length;

// need: 'capture' | 'clear' | 'army' | 'chars' | 'nazgul' | 'hunt' — AI가 무엇을 해야 하는지
const OBJECTIVES = [
  { id: 'isengard', name: '아이센가드 함락', text: '아이센가드를 점령한다.', focus: ['isengard'], need: 'capture', check: (g) => g.locs.isengard.captured },
  { id: 'dolguldur', name: '돌 굴두르 정화', text: '돌 굴두르를 점령한다.', focus: ['dolguldur'], need: 'capture', check: (g) => g.locs.dolguldur.captured },
  { id: 'morgul', name: '미나스 모르굴 공략', text: '미나스 모르굴을 점령한다.', focus: ['minasmorgul'], need: 'capture', check: (g) => g.locs.minasmorgul.captured },
  { id: 'blackgate', name: '검은 문 돌파', text: '검은 문을 점령한다.', focus: ['blackgate'], need: 'capture', check: (g) => g.locs.blackgate.captured },
  { id: 'helm', name: '헬름협곡 사수', text: '헬름협곡에 군대 2부대 이상, 오크 없음.', focus: ['helm'], need: 'army', army: 2, check: (g) => g.locs.helm.armies >= 2 && g.locs.helm.orcs === 0 },
  { id: 'pelennor', name: '펠렌노르 평원의 승리', text: '미나스 티리스·오스길리아스에 오크가 없고, 두 곳의 군대 합계 3부대 이상.', focus: ['minastirith', 'osgiliath'], need: 'army', army: 2, check: (g) => noOrcs(g, ['minastirith', 'osgiliath']) && sumBy(g, ['minastirith', 'osgiliath'], (l) => l.armies) >= 3 },
  { id: 'musterrohan', name: '로한의 소집', text: '로한의 3곳 이상에 군대.', focus: ['edoras', 'helm', 'fangorn', 'isenfords'], need: 'army', army: 1, check: (g) => inRegion('rohan').filter((id) => g.locs[id].armies > 0).length >= 3 },
  { id: 'reunion', name: '원정대의 재결합', text: '한 지역에 인물 3명 이상 (프로도 포함).', focus: ['rivendell'], need: 'chars', check: (g) => LOCATIONS.some((l) => charsAt(g, l.id) >= 3) },
  { id: 'mirkwood', name: '어둠숲 정화', text: '어둠숲·너른골·돌 굴두르에 오크가 없다.', focus: ['mirkwood', 'dale', 'dolguldur'], need: 'clear', check: (g) => noOrcs(g, ['mirkwood', 'dale', 'dolguldur']) },
  { id: 'shire', name: '샤이어 수복', text: '에리아도르 전체에 오크가 없다.', focus: inRegion('eriador'), need: 'clear', check: (g) => noOrcs(g, inRegion('eriador')) },
  { id: 'gondorfree', name: '곤도르 해방', text: '곤도르 전체에 오크가 없다.', focus: inRegion('gondor'), need: 'clear', check: (g) => noOrcs(g, inRegion('gondor')) },
  { id: 'moria', name: '모리아 광산 통과', text: '모리아에 오크가 없고 인물이 있다.', focus: ['moria'], need: 'clear', check: (g) => g.locs.moria.orcs === 0 && g.pawns.some((p) => p.loc === 'moria' && p.id !== 'frodo') },
  { id: 'dale', name: '너른골 수호', text: '너른골에 군대 2부대 이상.', focus: ['dale'], need: 'army', army: 2, check: (g) => g.locs.dale.armies >= 2 },
  { id: 'weathertop', name: '바람마루 탈환', text: '바람마루에 오크가 없고 군대가 있다.', focus: ['weathertop'], need: 'army', army: 1, check: (g) => g.locs.weathertop.orcs === 0 && g.locs.weathertop.armies > 0 },
  { id: 'osgiliath', name: '오스길리아스 탈환', text: '오스길리아스에 군대 2부대 이상.', focus: ['osgiliath'], need: 'army', army: 2, check: (g) => g.locs.osgiliath.armies >= 2 },
  { id: 'lastdebate', name: '최후의 결전', text: '검은 문에 인물 2명 이상.', focus: ['blackgate'], need: 'chars', check: (g) => g.pawns.filter((p) => p.loc === 'blackgate' && p.id !== 'frodo').length >= 2 },
  { id: 'nazgul', name: '나즈굴 격퇴', text: '나즈굴을 모두 3번 쫓아낸다.', need: 'nazgul', check: (g) => g.stats.nazgulRepelled >= 3 },
  { id: 'orchunt', name: '오크 사냥', text: '오크를 모두 20마리 물리친다.', need: 'hunt', check: (g) => g.stats.orcsSlain >= 20 },
  { id: 'dolamroth', name: '돌 암로스의 기사들', text: '돌 암로스와 펠라르기르에 군대.', focus: ['dolamroth', 'pelargir'], need: 'army', army: 1, check: (g) => g.locs.dolamroth.armies > 0 && g.locs.pelargir.armies > 0 },
  { id: 'edoras', name: '황금궁 메두셀드', text: '에도라스에 오크가 없고, 군대와 인물이 있다.', focus: ['edoras'], need: 'army', army: 1, check: (g) => g.locs.edoras.orcs === 0 && g.locs.edoras.armies > 0 && g.pawns.some((p) => p.loc === 'edoras' && p.id !== 'frodo') },
  { id: 'fangorn', name: '팡고른 숲의 각성', text: '팡고른과 아이센가드에 오크가 없다.', focus: ['fangorn', 'isengard'], need: 'clear', check: (g) => noOrcs(g, ['fangorn', 'isengard']) },
  { id: 'beacons', name: '봉화가 타오른다', text: '곤도르의 3곳 이상에 군대.', focus: ['minastirith', 'osgiliath', 'pelargir', 'dolamroth'], need: 'army', army: 1, check: (g) => inRegion('gondor').filter((id) => g.locs[id].armies > 0).length >= 3 },
  { id: 'elves', name: '엘프의 동맹', text: '깊은골과 로슬로리엔에 군대 2부대씩.', focus: ['rivendell', 'lorien'], need: 'army', army: 2, check: (g) => g.locs.rivendell.armies >= 2 && g.locs.lorien.armies >= 2 },
  { id: 'bree', name: '브리의 평화', text: '호빗골·브리·바람마루에 오크가 없고, 브리에 군대.', focus: ['bree', 'hobbiton', 'weathertop'], need: 'army', army: 1, check: (g) => noOrcs(g, ['hobbiton', 'bree', 'weathertop']) && g.locs.bree.armies > 0 },
];
const OBJ_MAP = Object.fromEntries(OBJECTIVES.map((o) => [o.id, o]));

// ───────────── 어둠 카드 ─────────────
// 장소 카드(안식처 제외) + 나즈굴 사냥 + 사우론의 눈 + 사루만의 배신
const SHADOW_SPECIAL = [
  ...Array.from({ length: 6 }, () => ({ kind: 'nazgul', name: '나즈굴의 사냥', text: '프로도에게 가장 가까운 나즈굴 3기가 그를 향해 움직여요 (발각되면 2칸).' })),
  ...Array.from({ length: 3 }, () => ({ kind: 'eye', name: '사우론의 눈', text: '프로도가 모르도르에 있거나 발각되었으면 수색! 아니면 오크와 함께 있을 때 발각.' })),
  ...Array.from({ length: 2 }, () => ({ kind: 'saruman', name: '사루만의 배신', text: '아이센가드와 아이센 여울에 오크 1마리씩.' })),
];

// 수색 주사위: 💀 절망(희망 -1), 👁 발각(이미 발각이면 희망 -1), 빈칸
const SEARCH_DIE = ['skull', 'eye', 'eye', 'blank', 'blank', 'blank'];

const THREAT_TRACK = [2, 2, 2, 3, 3, 4, 4];
const MAX_ORCS = 3;
const MAX_ARMIES = 3;
const HAND_LIMIT = 7;
const ACTIONS = 4;

const DIFFICULTIES = [
  { id: 'easy', name: '쉬움', hope: 10, surges: 4, objNeed: 2, ring: 4, threat: 0, desc: '희망 10 · 어둠의 파도 4장 · 목표 2개 · 💍 4장' },
  { id: 'normal', name: '보통', hope: 8, surges: 5, objNeed: 3, ring: 5, threat: 0, mordor: true, desc: '희망 8 · 어둠의 파도 5장 · 목표 3개 · 💍 5장 · 모르도르에서 매 차례 수색' },
  { id: 'hard', name: '어려움', hope: 6, surges: 6, objNeed: 3, ring: 5, threat: 1, mordor: true, desc: '희망 6 · 어둠의 파도 6장 · 목표 3개 · 💍 5장 · 위협 높게 시작 · 모르도르에서 매 차례 수색' },
  { id: 'legend', name: '전설', hope: 5, surges: 6, objNeed: 4, ring: 5, threat: 1, mordor: true, desc: '희망 5 · 어둠의 파도 6장 · 목표 4개 · 💍 5장 · 모르도르에서 매 차례 수색' },
];

const NAZGUL_START = ['minasmorgul', 'minasmorgul', 'minasmorgul', 'minasmorgul', 'dolguldur', 'dolguldur', 'dolguldur', 'baraddur', 'baraddur'];
const FACEUP_OBJECTIVES = 5;

module.exports = {
  REGIONS, LOCATIONS, LOC_MAP, EDGES, CHARACTERS, CHAR_MAP, PLAYABLE, EVENTS, EVENT_MAP, OBJECTIVES, OBJ_MAP,
  SHADOW_SPECIAL, SEARCH_DIE, THREAT_TRACK, MAX_ORCS, MAX_ARMIES, HAND_LIMIT, ACTIONS, DIFFICULTIES, NAZGUL_START, FACEUP_OBJECTIVES,
};
