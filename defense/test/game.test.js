'use strict';
// 요괴 퇴마 디펜스 — 규칙 엔진 테스트 (node --test)
const test = require('node:test');
const assert = require('node:assert');
const D = require('../server/game/data');
const M = require('../server/game/maps');
const { Game } = require('../server/game/game');

const roster = (n = 2, bot = false) => [{ id: 'a', name: 'A', leader: 'sword', bot }, { id: 'b', name: 'B', leader: 'merchant', bot }].slice(0, n);

test('맵이 충분히 많고, 모든 길이 이어져 있다', () => {
  assert.ok(M.MAPS.length >= 50, `맵 수 ${M.MAPS.length}`);
  const ids = new Set();
  for (const m of [...M.MAPS, ...Array.from({ length: 100 }, (_, i) => M.randomMap(i * 7 + 1))]) {
    if (m.id !== 'random') { assert.ok(!ids.has(m.id), '중복 id ' + m.id); ids.add(m.id); }
    assert.ok(m.paths.length >= 1, m.id);
    for (const p of m.paths) {
      assert.ok(p.pts.length >= 3, m.id);
      for (let i = 1; i < p.pts.length; i++) {
        const [x1, y1] = p.pts[i - 1], [x2, y2] = p.pts[i];
        assert.ok(x1 === x2 || y1 === y2, `${m.id}: 대각선 길`);
      }
    }
    // 길 옆에 유닛을 세울 자리가 충분
    const g = new Game(roster(), { mapId: m.id === 'random' ? 'random' : m.id, seed: m.seed });
    assert.ok(g.spots.filter((s) => s.d === 1).length >= 30, `${m.id}: 길 옆 자리 부족`);
  }
});

test('소환 · 합성 · 판매 · 강화', () => {
  const g = new Game(roster(1), { mapId: 'h-ring', seed: 1 });
  const p = g.players[0];
  p.gold = 10000;
  for (let i = 0; i < 6; i++) assert.ok(g.command('a', { t: 'summon' }).ok);
  assert.strictEqual(g.units.length, 6);
  // 같은 유닛 3개를 강제로 만들어 합성
  for (const u of g.units.slice(0, 3)) u.type = 'novice';
  const before = g.units.length;
  const r = g.command('a', { t: 'merge', unit: g.units[0].id });
  assert.ok(r && r.ok);
  assert.strictEqual(g.units.length, before - 2);
  assert.strictEqual(D.UNIT_MAP[g.units.find((u) => u.id === r.ok).type].tier, 2);
  // 판매
  const gold = p.gold;
  g.command('a', { t: 'sell', unit: g.units[0].id });
  assert.ok(p.gold > gold);
  // 강화
  g.command('a', { t: 'upgrade', cat: 'blade' });
  assert.strictEqual(p.upg.blade, 1);
  // 길 위에는 못 세움
  const [px, py] = g.map.pathTiles.find(([x, y]) => x >= 0 && y >= 0);
  assert.strictEqual(typeof g.command('a', { t: 'summon', tile: [px, py] }), 'string');
  // 남의 유닛은 못 건드림
  assert.strictEqual(g.command('b', { t: 'sell', unit: g.units[0].id }), null);
});

test('전설 2개 → 신화', () => {
  const g = new Game(roster(1), { mapId: 'h-ring', seed: 2 });
  g.players[0].gold = 1000;
  g.command('a', { t: 'summon' }); g.command('a', { t: 'summon' });
  for (const u of g.units) u.type = 'sun';
  const r = g.command('a', { t: 'merge', unit: g.units[0].id });
  assert.strictEqual(D.UNIT_MAP[g.units.find((u) => u.id === r.ok).type].tier, 5);
});

test('필살기와 축복', () => {
  const g = new Game(roster(2), { mapId: 'h-snake', seed: 3 });
  g.players[0].skillCd = 0; g.players[1].skillCd = 0;
  for (let i = 0; i < 200; i++) g.tick();
  const e = g.enemies[0];
  assert.ok(e, '요괴가 나와야 함');
  assert.strictEqual(g.command('a', { t: 'skill', x: e.x, y: e.y }), null);
  assert.ok(e.dead || e.hp < e.maxHp);
  const gold = g.players[1].gold;
  g.command('b', { t: 'skill' });
  assert.ok(g.players[1].gold > gold);
  g.offerBlessing(g.players[0]);
  const choice = g.players[0].choice[0];
  g.command('a', { t: 'bless', id: choice });
  assert.deepStrictEqual(g.players[0].bless, [choice]);
});

test('아무것도 안 하면 진다 (외길·순환)', () => {
  for (const mapId of ['h-snake', 'h-ring']) {
    const g = new Game(roster(2), { mapId, seed: 4 });
    while (!g.result && g.time < 2000) g.tick();
    assert.ok(g.result && !g.result.win, mapId);
  }
});

test('AI 둘이서 쉬움 난이도는 끝까지 깬다', () => {
  for (const mapId of ['h-ring', 'g1', 'random']) {
    const g = new Game(roster(2, true), { mapId, difficulty: 'easy', seed: 5 });
    while (!g.result && g.time < 3000) { g.tick(); g.fx.length = 0; g.msgs.length = 0; }
    assert.ok(g.result && g.result.win, `${mapId}: ${g.result && g.result.reason} (웨이브 ${g.wave})`);
  }
});

test('화면용 상태는 JSON으로 보낼 수 있다', () => {
  const g = new Game(roster(2, true), { mapId: 'g5', seed: 6 });
  for (let i = 0; i < 600; i++) g.tick();
  const v = JSON.parse(JSON.stringify(g.view()));
  assert.ok(Array.isArray(v.units) && Array.isArray(v.enemies));
  assert.ok(JSON.stringify(g.staticView()).length < 20000);
});
