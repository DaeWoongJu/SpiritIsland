'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Game } = require('../server/game/game');
const D = require('../server/game/data');
const { attachBots } = require('./bot');

const mk = (n, seed = 1) => new Game(Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, bot: true })), { seed });

test('데이터: 카드 id 중복 없음, 모든 카드에 효과/이동 아이콘', () => {
  const ids = [...D.ITEMS, ...D.ARTIFACTS].map((c) => c.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const c of [...D.ITEMS, ...D.ARTIFACTS]) { assert.ok(c.effect, c.id); assert.ok(D.TRAVEL.includes(c.travel), c.id); assert.ok(c.cost >= 1 && c.cost <= 4, c.id); }
});

test('준비: 시작 덱 6장, 손패 5장, 카드 줄 (유물 1 + 물건 5)', () => {
  const g = mk(2);
  g.setup();
  for (const pid of g.order) assert.strictEqual(g.P(pid).deck.length, 6);
  assert.strictEqual(g.row.filter(Boolean).length, 6);
  assert.strictEqual(g.def(g.row[0]).kind, 'artifact');
  assert.ok(g.row.slice(1).every((u) => g.def(u).kind === 'item'));
});

test('이동 비용 계산: 지프는 도보를, 비행기는 무엇이든, 동전 2 = 비행기', () => {
  const g = mk(1);
  g.setup();
  const p = g.P('p0');
  const card = (id) => g.newCard(id);
  const boot = card('fear'); const car = card('exploration'); const ship = card('funding'); const plane = card('binoculars');
  p.res.coin = 0;
  assert.ok(g.travelPlan('p0', { boot: 1 }, [car]));
  assert.ok(!g.travelPlan('p0', { car: 1 }, [boot]));
  assert.ok(g.travelPlan('p0', { ship: 1 }, [plane]));
  assert.ok(!g.travelPlan('p0', { plane: 1, ship: 1 }, [ship]));
  p.res.coin = 2;
  assert.deepStrictEqual(g.travelPlan('p0', { plane: 1, ship: 1 }, [ship]), { coins: 2 });
  assert.ok(g.travelPlan('p0', { car: 2 }, [car, plane]));
});

test('점수: 연구·우상·수호자·카드·두려움', () => {
  const g = mk(1);
  g.setup();
  const p = g.P('p0');
  p.glass = 3; p.note = 2; p.idols = ['i1']; p.idolSlots = ['i2']; p.guardians = [{ id: 'g1', used: false }];
  const s = g.score('p0');
  assert.strictEqual(s.research, D.GLASS_VP[3] + D.NOTE_VP[2]);
  assert.strictEqual(s.idols, D.IDOL_VP + D.IDOL_PLACED_VP);
  assert.strictEqual(s.guardians, 5);
  assert.strictEqual(s.fear, -2);
});

for (const [n, random] of [[1, false], [2, false], [3, true], [4, false], [4, true]]) {
  test(`봇 ${n}명 ${random ? '무작위' : 'AI'} 게임이 끝까지 진행`, async () => {
    for (const seed of [1, 7, 42]) {
      const g = mk(n, seed);
      attachBots(g, { random });
      const done = g.run();
      await Promise.race([done, new Promise((_, rej) => setTimeout(() => rej(new Error('시간 초과')), 20000))]);
      assert.ok(g.result, '결과 있음');
      assert.strictEqual(g.result.scores.length, n);
      assert.strictEqual(g.round, 6);
      for (const pid of g.order) { const r = g.P(pid).res; for (const k of D.RES) assert.ok(r[k] >= 0, `${k} 음수`); }
    }
  });
}

const mkExp = (n, seed = 1, settings = { leaders: true, expansion: true, track: 'snake' }, leaders = []) =>
  new Game(Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, bot: true, leader: leaders[i] })), { seed, settings });

test('확장: 탐험대장 전용 카드가 두려움 1장을 대신함, 고른 대장이 배정됨', () => {
  const g = mkExp(3, 1, { leaders: true }, ['captain', 'captain', 'mystic']);
  g.setup();
  const leaders = g.order.map((pid) => g.P(pid).leader);
  assert.strictEqual(leaders[0], 'captain');
  assert.notStrictEqual(leaders[1], 'captain', '같은 대장은 한 명만');
  assert.strictEqual(leaders[2], 'mystic');
  for (const pid of g.order) {
    const ids = g.P(pid).deck.map((u) => g.cards[u]);
    assert.strictEqual(ids.filter((x) => x === 'fear').length, 1);
    assert.strictEqual(ids.length, 6);
  }
});

test('확장: 대장 능력 (리나 탐사 할인, 비비안 물건 할인, 볼트 지프=비행기)', () => {
  const g = mkExp(3, 2, { leaders: true }, ['explorer', 'baroness', 'mechanic']);
  g.setup();
  const s1 = Object.values(g.sites).find((s) => s.level === 1);
  assert.strictEqual(g.discoverCost('p0', s1), 2);
  assert.strictEqual(g.discoverCost('p1', s1), 3);
  const item = g.row.find((u) => u && g.def(u).kind === 'item');
  assert.strictEqual(g.cardCost(item, 0, 'p1'), Math.max(0, g.def(item).cost - 1));
  const car = g.newCard('exploration');
  g.P('p2').res.coin = 0;
  assert.ok(g.travelPlan('p2', { plane: 1 }, [car]), '볼트: 지프 카드로 비행기 비용');
  g.P('p1').res.coin = 0;
  assert.ok(!g.travelPlan('p1', { plane: 1 }, [car]), '다른 대장은 불가');
});

test('확장: 뱀 신전 트랙은 비용과 점수가 다름', () => {
  const g = mkExp(1, 1, { track: 'snake' });
  g.setup();
  assert.deepStrictEqual(g.researchCost(7, {}), { gem: 2, arrow: 1 });
  g.P('p0').glass = 7;
  assert.strictEqual(g.score('p0').research, 20);
});

for (const n of [1, 2, 4]) {
  test(`확장 전부 켜고 봇 ${n}명 게임이 끝까지 진행`, async () => {
    for (const seed of [3, 9]) {
      const g = mkExp(n, seed);
      attachBots(g, { random: seed === 9 });
      await Promise.race([g.run(), new Promise((_, rej) => setTimeout(() => rej(new Error('시간 초과')), 20000))]);
      assert.ok(g.result);
      for (const pid of g.order) { const r = g.P(pid).res; for (const k of D.RES) assert.ok(r[k] >= 0, `${k} 음수`); }
    }
  });
}
