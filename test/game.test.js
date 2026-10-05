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

test('약탈 미리보기: 계산 결과가 실제 약탈과 같음', async () => {
  const g = mkGame(['shadows']);
  g.setup();
  g.phase = 'invader';
  const l = g.lands.A7;
  l.explorers = 1; l.towns = [2]; l.cities = []; l.dahan = [2, 2]; l.blight = 0; l.presence = {}; l.defend = 0;
  const pv = g.ravagePreview(l);
  assert.deepStrictEqual([pv.raw, pv.defend, pv.dmg, pv.blight, pv.dahanLost, pv.dahanLeft, pv.counter], [3, 0, 3, 1, 1, 1, 2]);
  assert.strictEqual(pv.killed.town, 1);
  l.defend = 3;
  const pv2 = g.ravagePreview(l);
  assert.deepStrictEqual([pv2.dmg, pv2.blight, pv2.dahanLost, pv2.counter], [0, 0, 0, 4]);
  assert.deepStrictEqual(pv2.killed, { explorer: 1, town: 1, city: 0 });
  l.defend = 0;
  await g.doRavage(l);
  assert.strictEqual(g.invaderStep.kind, 'ravageLand');
  const r = g.invaderStep.report;
  assert.deepStrictEqual([r.raw, r.dmg, r.blight, r.dahanLost, r.counter, r.killed.town], [3, 3, 1, 1, 2, 1]);
  assert.strictEqual(l.towns.length, 0);
  assert.strictEqual(l.explorers, 1);
});

test('침략자 단계: 직접 넘기기면 모두 다음을 눌러야 진행', async () => {
  const g = new Game([{ id: 'p0', name: 'A', spiritId: 'earth' }, { id: 'p1', name: 'B', spiritId: 'river' }], { seed: 3, stepManual: true });
  g.setup();
  let done = false;
  const pr = g.step('build', null, [], '테스트').then(() => { done = true; });
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(done, false);
  g.ackStep('p0', g.invaderStep.no);
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(done, false, '한 명만 눌렀을 때는 대기');
  g.ackStep('p1', g.invaderStep.no - 1); // 지난 단계 번호는 무시
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(done, false);
  g.ackStep('p1', g.invaderStep.no);
  await pr;
  assert.strictEqual(done, true);
});

test('쉬운 난이도: 연습·체험 설정 값', () => {
  const g = new Game([{ id: 'a', name: 'A', spiritId: 'river' }], { seed: 1, settings: { difficulty: { preset: 'learn' } } });
  assert.strictEqual(g.fear.poolSize, 2);
  assert.strictEqual(g.invader.deck.filter((c) => c.stage === 1).length, 5, '1단계 카드 +2');
  g.setup();
  assert.ok(g.energyPerTurn('a') >= 2, '턴당 에너지 +1');
  // 황폐가 번지지 않음
  const id = Object.keys(g.lands).find((k) => !Object.values(g.lands[k].presence).some(Boolean));
  g.lands[id].blight = 1;
  const before = Object.values(g.lands).reduce((a, x) => a + x.blight, 0);
  g.addBlight(id);
  assert.strictEqual(Object.values(g.lands).reduce((a, x) => a + x.blight, 0), before + 1);
});

test('쉬운 난이도: 체험 모드는 지지 않음 (봇 게임 여러 판)', async () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const g = new Game([{ id: 'a', name: 'A', spiritId: 'earth' }, { id: 'b', name: 'B', spiritId: 'lightning' }], { seed, settings: { difficulty: { preset: 'sandbox' } } });
    attachBots(g);
    const r = await g.run();
    assert.ok(r.win, `seed ${seed}: ${r.reason}`);
  }
});

test('쉬운 난이도: 연습 모드 봇 게임이 끝까지 진행', async () => {
  for (const seed of [1, 2, 3]) {
    const g = new Game([{ id: 'a', name: 'A', spiritId: 'river' }], { seed, settings: { difficulty: { preset: 'learn' } } });
    attachBots(g);
    const r = await g.run();
    assert.ok(!r.reason.startsWith('서버 오류'), r.reason);
  }
});

test('번개의 은총: 이미 빠른 권능 단계를 끝낸 정령에게 써도 바로 느린 권능을 빠르게 쓸 수 있음', async () => {
  const g = mkGame(['lightning', 'river'], 3);
  g.setup();
  const L = g.spirits.p0;
  const R = g.spirits.p1;
  L.played = [{ id: 'lightnings_boon', used: false }];
  R.played = [{ id: 'wash_away', used: false }]; // 느린 카드
  const tick = () => new Promise((r) => setImmediate(r));
  const phase = g.powerPhase('fast');
  await tick();
  // 강의 정령은 쓸 빠른 권능이 없어 바로 끝남
  assert.strictEqual(g.currentPrompt('p1'), null);
  let pr = g.currentPrompt('p0');
  assert.strictEqual(g.answer('p0', pr.id, pr.options.find((o) => o.card === 'lightnings_boon').value), null);
  await tick();
  pr = g.currentPrompt('p0'); // 대상 정령 고르기
  assert.strictEqual(g.answer('p0', pr.id, 'p1'), null);
  await tick();
  // 강의 정령에게 느린 카드를 빠르게 쓰는 선택지가 바로 열림
  const rp = g.currentPrompt('p1');
  assert.ok(rp && rp.options.some((o) => o.card === 'wash_away' && /빠르게/.test(o.label)), JSON.stringify(rp));
  g.answer('p1', rp.id, 'done');
  await tick();
  pr = g.currentPrompt('p0');
  if (pr) g.answer('p0', pr.id, 'done');
  await phase;
  assert.strictEqual(R.fastAllowance, 2);
});

test('번개의 은총: 권능 선택 창을 띄워 둔 정령에게도 선택지가 바로 갱신됨', async () => {
  const g = mkGame(['lightning', 'river'], 4);
  g.setup();
  g.spirits.p0.played = [{ id: 'lightnings_boon', used: false }];
  g.spirits.p1.played = [{ id: 'wash_away', used: false }, { id: 'flash_floods', used: false }]; // 느림 + 빠름
  const tick = () => new Promise((r) => setImmediate(r));
  const phase = g.powerPhase('fast');
  await tick();
  const before = g.currentPrompt('p1');
  assert.ok(!before.options.some((o) => o.card === 'wash_away'));
  let pr = g.currentPrompt('p0');
  g.answer('p0', pr.id, pr.options.find((o) => o.card === 'lightnings_boon').value);
  await tick();
  pr = g.currentPrompt('p0');
  g.answer('p0', pr.id, 'p1');
  await tick();
  const after = g.currentPrompt('p1');
  assert.ok(after.options.some((o) => o.card === 'wash_away'), JSON.stringify(after));
  g.answer('p1', after.id, 'done');
  await tick();
  pr = g.currentPrompt('p0');
  if (pr) g.answer('p0', pr.id, 'done');
  await phase;
});

test('힘의 선물(반복): 이미 권능 단계를 끝낸 다른 정령도 바로 카드를 한 번 더 쓸 수 있음', async () => {
  const g = mkGame(['earth', 'river'], 5);
  g.setup();
  const E = g.spirits.p0;
  const R = g.spirits.p1;
  E.played = [];
  E.bonusElements = { sun: 1, earth: 2, plant: 2 }; // 힘의 선물 1단계 (비용 1 이하 반복)
  R.played = [{ id: 'boon_of_vigor', used: true }]; // 이미 쓴 빠른 카드 (비용 0)
  const tick = () => new Promise((r) => setImmediate(r));
  const phase = g.powerPhase('fast');
  await tick();
  assert.strictEqual(g.currentPrompt('p1'), null);
  let pr = g.currentPrompt('p0');
  g.answer('p0', pr.id, 'innate:gift_of_strength');
  await tick();
  pr = g.currentPrompt('p0');
  g.answer('p0', pr.id, 'p1');
  await tick();
  const rp = g.currentPrompt('p1');
  assert.ok(rp && rp.options.some((o) => o.value === 'repeat:0'), JSON.stringify(rp));
  g.answer('p1', rp.id, 'repeat:0');
  for (let i = 0; i < 10; i++) {
    await tick();
    for (const q of ['p1', 'p0']) {
      const p = g.currentPrompt(q);
      if (!p) continue;
      if (p.kind === 'power') g.answer(q, p.id, 'done');
      else if (p.type === 'option') g.answer(q, p.id, p.options[0].value);
      else if (p.type === 'land') g.answer(q, p.id, p.options[0]);
    }
  }
  await phase;
  assert.strictEqual(R.repeats.length, 0, '반복 1회 사용됨');
});

test('반복: 비용 한도가 여러 개면 낮은 한도부터 사용', async () => {
  const g = mkGame(['river'], 6);
  g.setup();
  const R = g.spirits.p0;
  R.played = [{ id: 'boon_of_vigor', used: true }];
  R.repeats = [{ maxCost: 6 }, { maxCost: 1 }];
  const tick = () => new Promise((r) => setImmediate(r));
  const phase = g.powerPhase('fast');
  await tick();
  let pr = g.currentPrompt('p0');
  g.answer('p0', pr.id, 'repeat:0');
  for (let i = 0; i < 10; i++) {
    await tick();
    const p = g.currentPrompt('p0');
    if (!p) continue;
    if (p.kind === 'power') { g.answer('p0', p.id, 'done'); continue; }
    if (p.type === 'option') g.answer('p0', p.id, p.options[0].value);
    else if (p.type === 'land') g.answer('p0', p.id, p.options[0]);
  }
  await phase;
  assert.deepStrictEqual(R.repeats, [{ maxCost: 6 }]);
});

test('공포 카드: 두 정령이 같은 지역을 고르고 먼저 고른 쪽이 다 제거해도 게임이 멈추지 않음', async () => {
  const g = mkGame(['earth', 'lightning'], 9);
  g.setup();
  // 다한이 있는 지역 하나에만 탐험가 2개, 나머지 지역은 침략자 없음
  const target = Object.values(g.lands).find((l) => l.dahan.length > 0);
  for (const l of Object.values(g.lands)) { l.explorers = 0; l.towns = []; l.cities = []; }
  target.explorers = 2;
  Object.values(g.lands).find((l) => !l.dahan.length && l.id !== target.id).cities = [3]; // 섬이 비어 승리하지 않도록
  const tick = () => new Promise((r) => setImmediate(r));
  const done = g.eachPlayerRemovesTwoOrTown((l) => l.dahan.length > 0, '다한이 있는');
  await tick();
  const p0 = g.currentPrompt('p0'); const p1 = g.currentPrompt('p1');
  assert.deepStrictEqual(p0.options, [target.id]);
  assert.deepStrictEqual(p1.options, [target.id]);
  g.answer('p0', p0.id, target.id); // 먼저 고른 정령이 탐험가 2개 제거
  await tick();
  g.answer('p1', p1.id, target.id); // 같은 지역 → 이미 없음
  await tick();
  assert.strictEqual(g.currentPrompt('p1'), null, '버튼 없는 선택 창이 남으면 안 됨');
  await done;
  assert.strictEqual(target.explorers, 0);
  assert.ok(g.logLines.some((l) => /이미 없습니다/.test(l.msg)));
});
