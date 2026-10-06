'use strict';
// 언락! 시나리오 모음 — 박스별 파일을 모아 카드 번호를 붙인다
const { build } = require('../build');

const FILES = ['box1', 'box2', 'box3', 'box4', 'short', 'kids'];
const SPECS = [];
for (const f of FILES) SPECS.push(...require('./' + f));
const LIST = SPECS.map(build);
const MAP = Object.fromEntries(LIST.map((s) => [s.id, s]));
const BOXES = [...new Set(LIST.map((s) => s.box))];

/** 화면에 보낼 목록 (정답 없이) */
const CATALOG = LIST.map((s) => ({ id: s.id, box: s.box, title: s.title, orig: s.orig, diff: s.diff, intro: s.intro, theme: s.theme || '', cards: s.cards.length }));

module.exports = { LIST, MAP, BOXES, CATALOG, get: (id) => MAP[id] };
