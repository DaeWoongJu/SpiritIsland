'use strict';
// 언락! 시나리오 모음 — 박스별 파일을 모아 카드 번호를 붙인다
const { build } = require('../build');

const FILES = ['escape', 'mystery', 'secret', 'exotic', 'heroic', 'epic', 'mythic', 'timeless', 'legendary', 'games', 'extraordinary', 'supernatural', 'risky', 'enchanted', 'starwars', 'short2', 'kids'];
const SPECS = [];
const ids = new Set();
for (const f of FILES) {
  for (const s of require('./' + f)) {
    if (ids.has(s.id)) throw new Error(`시나리오 id 중복: ${s.id}`);
    ids.add(s.id);
    // 키즈(6세~)는 숨은 번호를 눌러서 찾는다
    SPECS.push(s.box.startsWith('키즈') ? { ...s, cards: s.cards.map((c) => (c.spots ? { ...c, spots: c.spots.map((sp) => ({ ...sp, click: true })) } : c)) } : s);
  }
}
// 박스 순서는 원작 출시 순서대로
const BOX_ORDER = ['입문', '이스케이프 어드벤처', '미스터리 어드벤처', '시크릿 어드벤처', '엑조틱 어드벤처', '히로익 어드벤처', '타임리스 어드벤처', '에픽 어드벤처', '미식 어드벤처', '스타워즈', '레전더리 어드벤처', '게임 어드벤처', '엑스트라오디너리 어드벤처', '슈퍼내추럴 어드벤처', '리스키 어드벤처', '인챈티드 어드벤처', '쇼트 어드벤처'];
const rank = (b) => { const i = BOX_ORDER.indexOf(b); return i < 0 ? 100 + (b.startsWith('키즈') ? 0 : 1) : i; };
SPECS.sort((a, b) => rank(a.box) - rank(b.box));
const LIST = SPECS.map(build);
const MAP = Object.fromEntries(LIST.map((s) => [s.id, s]));
const BOXES = [...new Set(LIST.map((s) => s.box))];

/** 화면에 보낼 목록 (정답 없이) */
const CATALOG = LIST.map((s) => ({ id: s.id, box: s.box, title: s.title, orig: s.orig, diff: s.diff, intro: s.intro, theme: s.theme || '', cards: s.cards.length, limit: s.limit || 60 }));

module.exports = { LIST, MAP, BOXES, CATALOG, get: (id) => MAP[id] };
