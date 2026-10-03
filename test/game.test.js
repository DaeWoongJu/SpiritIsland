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

test('모든 정령 조합 시뮬레이션 (12종)', async () => {
  const ids = SPIRITS.map((s) => s.id);
  for (let i = 0; i < ids.length; i++) {
    for (let seed = 1; seed <= 6; seed++) {
      const combo = [ids[i], ids[(i + seed) % ids.length]];
      const g = mkGame(combo, seed * 31 + i);
      let r = seed * 104729 + i;
      const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
      attachBots(g, rand);
      const result = await g.run();
      assert.ok(!result.reason.startsWith('서버 오류'), `${combo.join('+')} seed ${seed}: ${result.reason}`);
    }
  }
});

test('특수 규칙: 만연한 초록은 황폐 대신 존재를 희생', () => {
  const g = mkGame(['green']);
  g.setup(); g.phase = 'invader';
  const land = g.presenceLands('p0')[0];
  const before = g.lands[land].blight;
  g.addBlight(land);
  assert.strictEqual(g.lands[land].blight, before);
  assert.strictEqual(g.islandPresence('p0'), 1);
});

test('특수 규칙: 들불의 심장 존재는 황폐로 파괴되지 않음', () => {
  const g = mkGame(['wildfire']);
  g.setup(); g.phase = 'invader';
  const land = g.presenceLands('p0')[0];
  g.lands[land].blight = 0;
  g.addBlight(land);
  assert.strictEqual(g.presenceCount('p0', land), 3);
});

test('특수 규칙: 금지된 야생의 수호자 성지에는 탐험하지 않음', () => {
  const g = mkGame(['keeper']);
  g.setup(); g.phase = 'invader';
  const land = g.sacredLands('p0')[0];
  const l = g.lands[land];
  const before = l.explorers;
  g.doExplore({ terrains: [l.terrain] });
  assert.strictEqual(l.explorers, before);
});

test('특수 규칙: 꿈과 악몽의 피해는 공포로 바뀜', () => {
  const g = mkGame(['bringer']);
  g.setup(); g.phase = 'fast';
  const land = 'A5';
  g.lands[land].explorers = 2;
  const ctx = g.makeCtx('p0', { name: 't' }, land, null);
  const fearBefore = g.fear.generated;
  ctx.damage(3);
  assert.strictEqual(g.lands[land].explorers, 2);
  assert.strictEqual(g.fear.generated, fearBefore + 2);
});

test('특수 규칙: 화산 존재가 파괴되면 분출 피해', () => {
  const g = mkGame(['volcano']);
  g.setup(); g.phase = 'invader';
  const land = g.presenceLands('p0')[0];
  g.lands[land].explorers = 3;
  g.destroyPresence('p0', land, 1, '테스트');
  assert.strictEqual(g.lands[land].explorers, 1);
});

test('설정: 무작위 보드 + 추가 보드 + 세로 해안선 배치', () => {
  const g = new Game([{ id: 'a', name: 'A', spiritId: 'river' }, { id: 'b', name: 'B', spiritId: 'earth' }],
    { seed: 3, settings: { expansions: ['base', 'je'], map: { boards: 'random', extraBoard: true, layout: 'coast' } } });
  assert.strictEqual(g.boardLetters.length, 3);
  assert.strictEqual(g.mapSize.width, 300);
  assert.strictEqual(g.mapSize.height, 780);
});

test('설정: 6명(정령 6개)이면 보드 6개, 자동으로 세로 배치', async () => {
  const ids = ['river', 'earth', 'lightning', 'shadows', 'stone', 'thunder'];
  const g = new Game(ids.map((s, i) => ({ id: 'p' + i, name: 'P' + i, spiritId: s })), { seed: 5 });
  assert.strictEqual(g.boardLetters.length, 6);
  attachBots(g);
  const r = await g.run();
  assert.ok(!r.reason.startsWith('서버 오류'), r.reason);
});

test('난이도: 적대 세력 레벨 효과 적용', () => {
  const g = new Game([{ id: 'a', name: 'A', spiritId: 'river' }], { seed: 1, settings: { difficulty: { preset: 'hard', adversary: 'prussia', level: 6 } } });
  assert.strictEqual(g.fear.poolSize, 5);
  assert.ok(g.invader.deck.every((c) => c.stage !== 1), '1단계 카드 모두 제거');
  assert.strictEqual(g.fear.total, 10);
  g.setup();
  assert.ok(g.lands.A3.towns.length >= 1, '빠른 시작: 3번 지역 마을');
});

test('난이도: 모든 적대 세력 6레벨로 게임이 끝까지 진행', async () => {
  const { ADVERSARIES } = require('../server/game/adversaries');
  for (const adv of ADVERSARIES) {
    const g = new Game([{ id: 'a', name: 'A', spiritId: 'earth' }, { id: 'b', name: 'B', spiritId: 'lure' }], { seed: 7, settings: { difficulty: { preset: 'expert', adversary: adv.id, level: 6 } } });
    attachBots(g);
    const r = await g.run();
    assert.ok(!r.reason.startsWith('서버 오류'), `${adv.id}: ${r.reason}`);
  }
});
