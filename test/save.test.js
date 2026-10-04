'use strict';
// 저장/이어하기: 같은 시드 + 응답 기록을 다시 넣으면 똑같은 상태가 되는지
const test = require('node:test');
const assert = require('node:assert');
const savegame = require('../shared/savegame');
const { randomAnswer } = require('./bot');
const SI = require('../server/game/game');
const AR = require('../arnak/server/game/game');
const CH = require('../champions/server/game/game');

const tick = () => new Promise((r) => setImmediate(r));
const settle = async () => { for (let i = 0; i < 20; i++) await tick(); };

/** 봇으로 응답 limit번까지만 진행하고 멈춤 */
async function playUntil(game, pids, answerFn, limit) {
  savegame.record(game);
  game.run();
  for (let n = 0; n < limit && !game.result;) {
    let did = false;
    for (const pid of pids) {
      const pr = game.currentPrompt(pid);
      if (!pr) continue;
      const err = game.answer(pid, pr.id, answerFn(game, pid, pr));
      assert.strictEqual(err, null, err);
      n++; did = true;
      break;
    }
    await tick();
    if (!did) await settle();
  }
  await settle();
}

async function check(label, make, pids, answerFn, limits) {
  for (const limit of limits) {
    const a = make();
    await playUntil(a, pids, answerFn, limit);
    assert.ok(!a.result || !a.result.reason.startsWith('서버 오류'), label);
    const b = make(a.seed);
    savegame.record(b);
    b.run();
    const r = await savegame.replay(b, JSON.parse(JSON.stringify(a.history)));
    await settle();
    assert.ok(r.ok, `${label} 재현 실패 at ${r.at}`);
    assert.strictEqual(b.history.length, a.history.length);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(b.view(pids[0]))), JSON.parse(JSON.stringify(a.view(pids[0]))), `${label} limit ${limit}`);
  }
}

function lcg(seed) { let r = seed; return () => { r = (r * 16807) % 2147483647; return r / 2147483647; }; }

test('정령섬: 저장 후 다시 진행하면 같은 상태', async () => {
  const rand = lcg(12345);
  const make = (seed) => new SI.Game([{ id: 'a-0', name: 'A', spiritId: 'river' }, { id: 'b-0', name: 'B', spiritId: 'lightning' }], { seed, settings: { difficulty: { preset: 'normal' } } });
  await check('SI', make, ['a-0', 'b-0'], (g, pid, pr) => randomAnswer(pr, rand), [5, 40, 120]);
});

test('아르낙: 저장 후 다시 진행하면 같은 상태', async () => {
  const make = (seed) => new AR.Game([{ id: 'p0', name: 'P0', bot: true }, { id: 'p1', name: 'P1', bot: true }], { seed });
  await check('Arnak', make, ['p0', 'p1'], (g, pid, pr) => AR.botAnswer(g, pid, pr), [10, 80, 200]);
});

test('챔피언스: 저장 후 다시 진행하면 같은 상태', async () => {
  const make = (seed) => new CH.Game([{ id: 'p0', name: 'P0', bot: true, hero: 'spark', aspect: 'aggression' }, { id: 'p1', name: 'P1', bot: true, hero: 'titan', aspect: 'protection' }], { seed });
  await check('Champions', make, ['p0', 'p1'], (g, pid, pr) => CH.botAnswer(g, pid, pr), [10, 60, 150]);
});
