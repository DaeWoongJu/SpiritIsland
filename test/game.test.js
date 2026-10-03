'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Game } = require('../server/game/game');
const { buildIsland } = require('../server/game/boards');
const { SPIRITS } = require('../server/game/spirits');
const { POWER_MAP } = require('../server/game/powers');
const { attachBots } = require('./bot');

function mkGame(spiritIds, seed = 1) {
  return new Game(spiritIds.map((s, i) => ({ id: 'p' + i, name: 'P' + i, spiritId: s })), { seed });
}

test('섬 보드: 각 보드에 해안 지역 3개, 인접은 대칭', () => {
  for (const n of [1, 2, 3, 4]) {
    const { lands } = buildIsland(n);
    assert.strictEqual(Object.keys(lands).length, 8 * n);
    for (const l of Object.values(lands)) {
      for (const a of l.adj) assert.ok(lands[a].adj.includes(l.id), `${l.id}-${a}`);
    }
    const coastalPerBoard = Object.values(lands).filter((l) => l.coastal).length / n;
    assert.strictEqual(coastalPerBoard, 3);
  }
});

test('모든 정령의 고유 카드가 정의되어 있음', () => {
  for (const s of SPIRITS) for (const id of s.uniques) assert.ok(POWER_MAP[id], id);
});

test('초기 배치: 정령 존재와 첫 탐험', () => {
  const g = mkGame(['lightning', 'river']);
  g.setup();
  assert.strictEqual(g.islandPresence('p0'), 2);
  assert.strictEqual(g.islandPresence('p1'), 1);
  assert.ok(g.invader.build, '첫 탐험 카드가 건설 칸으로');
  assert.strictEqual(g.invader.deck.length, 11);
});

test('피해 배분: 도시를 우선 파괴하고 공포 발생', () => {
  const g = mkGame(['earth']);
  g.setup();
  g.phase = 'fast';
  const land = 'A5';
  g.lands[land].explorers = 2;
  g.lands[land].cities = [3];
  const before = g.fear.generated;
  const r = g.damageInvaders(land, 3);
  assert.strictEqual(r.destroyed.city, 1);
  assert.strictEqual(g.lands[land].explorers, 2);
  assert.strictEqual(g.fear.generated, before + 2);
});

test('약탈: 황폐 추가, 다한 피해 및 반격', () => {
  const g = mkGame(['shadows']);
  g.setup();
  g.phase = 'invader';
  const l = g.lands.A7; // 사막, 다한 2
  l.explorers = 0; l.towns = [2]; l.cities = []; l.dahan = [2, 2]; l.blight = 0; l.presence = {};
  g.doRavage(l);
  assert.strictEqual(l.blight, 1);
  assert.strictEqual(l.dahan.length, 1, '다한 1개 파괴');
  assert.strictEqual(l.towns.length, 0, '남은 다한이 마을 파괴');
});

test('황폐 확산: 이미 황폐가 있으면 인접 지역으로 번짐', () => {
  const g = mkGame(['river']);
  g.setup();
  const pool = g.blight.pool;
  g.lands.A4.blight = 1;
  g.addBlight('A4');
  assert.strictEqual(g.lands.A4.blight, 2);
  const spread = g.lands.A4.adj.reduce((s, a) => s + g.lands[a].blight, 0);
  assert.ok(spread >= 1);
  assert.strictEqual(g.blight.pool, pool - 2);
});

test('공포: 공포 풀이 차면 공포 카드 획득', () => {
  const g = mkGame(['river', 'earth']);
  g.setup();
  g.phase = 'fast';
  g.addFear(8);
  assert.strictEqual(g.fear.earnedTotal, 1);
  assert.strictEqual(g.fear.generated, 0);
});

test('승리 조건: 공포 단계 1에서 침략자가 모두 사라지면 승리', () => {
  const g = mkGame(['lightning']);
  g.setup();
  g.phase = 'fast';
  for (const l of Object.values(g.lands)) { l.explorers = 0; l.towns = []; l.cities = l.id === 'A2' ? [3] : []; }
  assert.throws(() => g.destroyPiece('A2', 'city'));
  assert.ok(g.result && g.result.win);
});

test('응답 검증: 잘못된 선택 거부', async () => {
  const g = mkGame(['river']);
  const p = g.askOption('p0', 'q', [{ value: 'a', label: 'A' }]);
  const cur = g.currentPrompt('p0');
  assert.ok(g.answer('p0', cur.id, 'zzz'));
  assert.strictEqual(g.answer('p0', cur.id, 'a'), null);
  assert.strictEqual(await p, 'a');
});

for (const combo of [['lightning'], ['river', 'earth'], ['shadows', 'lightning'], ['earth', 'river', 'shadows'], ['lightning', 'river', 'earth', 'shadows']]) {
  test(`무작위 봇 전체 게임 시뮬레이션: ${combo.join('+')}`, async () => {
    for (let seed = 1; seed <= 15; seed++) {
      const g = mkGame(combo, seed);
      let r = seed * 7919;
      const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
      attachBots(g, rand);
      const result = await g.run();
      assert.ok(result, '결과가 있어야 함');
      assert.ok(!result.reason.startsWith('서버 오류'), `seed ${seed}: ${result.reason}`);
    }
  });
}
