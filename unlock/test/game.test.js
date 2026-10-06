'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Game } = require('../server/game/game');
const S = require('../server/game/scenarios');
const { solve } = require('../server/game/build');
const savegame = require('../../shared/savegame');

const mk = (scenario, n = 1) => new Game(Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i })), { settings: { scenario } });

/** 알려진 정답대로 실제 엔진에서 끝까지 풀기 */
function playThrough(g) {
  const sc = g.sc;
  for (let guard = 0; guard < 300 && !g.result; guard++) {
    let did = false;
    for (const k of g.inPlay.slice()) {
      const c = sc.byKey[k];
      (c.spots || []).forEach((s, i) => { if (s.reveal && !g.spotsFound.has(`${k}#${i}`) && g.has(k)) { g.answer('p0', g.seq, { a: 'spot', card: k, i }); did = true; } });
      if (g.result) return;
      if (c.type === 'code' && !g.solved.has(k)) { assert.strictEqual(g.answer('p0', g.seq, { a: 'code', card: k, code: c.code }), null); did = true; }
      if (c.type === 'machine' && !g.solved.has(k) && g.has(k)) { assert.strictEqual(g.answer('p0', g.seq, { a: 'machine', card: k, seq: c.solution }), null); did = true; }
      if (g.result) return;
    }
    for (const c of sc.cards) {
      if (c.from && c.type !== 'trap' && !g.has(c.key) && !g.gone.has(c.key) && c.from.every((x) => g.has(x))) {
        const [x, y] = sc.byKey[c.from[0]].type === 'red' ? c.from : [c.from[1], c.from[0]];
        g.answer('p0', g.seq, { a: 'combine', x, y }); did = true;
        if (g.result) return;
      }
    }
    if (!did) return;
  }
}

test('시나리오: 모든 박스·쇼트·키즈 합쳐 60개 이상, 번호가 겹치지 않고 빨강+파랑 합이 결과 번호', () => {
  assert.ok(S.LIST.length >= 60, `${S.LIST.length}개`);
  for (const sc of S.LIST) {
    const nums = sc.cards.map((c) => String(c.num));
    assert.strictEqual(new Set(nums).size, nums.length, sc.id);
    for (const c of sc.cards) if (c.from) assert.strictEqual(c.num, sc.byKey[c.from[0]].num + sc.byKey[c.from[1]].num, `${sc.id} ${c.key}`);
    for (const c of sc.cards) if (c.type === 'machine') for (const b of c.solution) assert.ok(c.buttons.includes(b), `${sc.id} ${c.key} ${b}`);
    for (const c of sc.cards) if (c.type === 'code') assert.match(String(c.code), /^\d+$/, `${sc.id} ${c.key}`);
  }
});

test('시나리오: 정답을 따라가면 모두 탈출할 수 있고, 쓸모없는 카드가 없음', () => {
  for (const sc of S.LIST) {
    const r = solve(sc);
    assert.ok(r.ok, `${sc.id} 막힘: ${JSON.stringify(r.inPlay)}`);
    assert.deepStrictEqual(r.unused, [], `${sc.id} 안 쓰이는 카드`);
  }
});

test('엔진: 모든 시나리오를 실제로 끝까지 풀면 벌점 없이 탈출', async () => {
  for (const sc of S.LIST) {
    const g = mk(sc.id);
    g.run();
    playThrough(g);
    assert.ok(g.result && g.result.win, `${sc.id} 탈출 실패 (카드: ${g.inPlay.join(',')})`);
    assert.strictEqual(g.penalties, 0, sc.id);
  }
});

test('틀린 조합 · 틀린 코드 · 틀린 장치는 벌점 3분, 함정 조합도 벌점', () => {
  const g = mk('tutorial');
  g.run();
  g.answer('p0', g.seq, { a: 'spot', card: 'room', i: 0 });
  // 상자 + 열쇠 말고 다른 조합이 없으니, 코드부터 틀려 보기
  g.answer('p0', g.seq, { a: 'combine', x: 'chest', y: 'key' });
  assert.ok(g.has('safe'));
  g.answer('p0', g.seq, { a: 'code', card: 'safe', code: '1234' });
  assert.strictEqual(g.penalties, 1);
  assert.ok(g.elapsed() >= 3 * 60000);
  g.answer('p0', g.seq, { a: 'code', card: 'safe', code: '0915' });
  g.answer('p0', g.seq, { a: 'machine', card: 'panel', seq: ['🔵'] });
  assert.strictEqual(g.penalties, 2);
  const t = mk('goorse');
  t.run();
  t.answer('p0', t.seq, { a: 'spot', card: 'beach', i: 0 });
  t.answer('p0', t.seq, { a: 'combine', x: 'vines', y: 'machete' });
  t.answer('p0', t.seq, { a: 'spot', card: 'jungle', i: 0 });
  t.answer('p0', t.seq, { a: 'combine', x: 'fuse', y: 'machete' });
  assert.strictEqual(t.penalties, 1, '함정');
  assert.ok(t.has('fuse'), '함정은 카드를 없애지 않음');
});

test('힌트는 순서대로 보이고 별점에 반영, 숨은 번호는 한 번만', () => {
  const g = mk('tutorial');
  g.run();
  assert.strictEqual(g.answer('p0', g.seq, { a: 'hint', card: 'room' }), null);
  assert.strictEqual(g.answer('p0', g.seq, { a: 'hint', card: 'room' }), null);
  assert.ok(g.answer('p0', g.seq, { a: 'hint', card: 'room' }), '힌트가 더 없음');
  assert.strictEqual(g.view().cards.find((c) => c.key === 'room').hintsSeen.length, 2);
  g.answer('p0', g.seq, { a: 'spot', card: 'room', i: 0 });
  g.answer('p0', g.seq, { a: 'spot', card: 'room', i: 0 });
  assert.strictEqual(g.inPlay.filter((k) => k === 'key').length, 1);
});

test('화면 상태에는 정답(코드·장치 순서·조합 재료)이 없음', () => {
  for (const sc of S.LIST.slice(0, 20)) {
    const g = mk(sc.id);
    g.run();
    const v = JSON.stringify(g.view());
    for (const c of sc.cards) if (c.type === 'code' && g.has(c.key)) assert.ok(!v.includes(`"code":"${c.code}"`), sc.id);
    assert.ok(!v.includes('"solution"') && !v.includes('"from"'), sc.id);
  }
});

test('저장/이어하기: 행동 기록을 다시 넣으면 같은 상태', async () => {
  const a = mk('househill', 2);
  savegame.record(a);
  a.run();
  a.answer('p0', a.seq, { a: 'spot', card: 'foyer', i: 0 });
  a.answer('p1', a.seq, { a: 'code', card: 'parlor', code: '1234' });
  a.answer('p1', a.seq, { a: 'code', card: 'parlor', code: '1851' });
  a.answer('p0', a.seq, { a: 'hint', card: 'diary' });
  const b = mk('househill', 2);
  savegame.record(b);
  b.run();
  const r = await savegame.replay(b, JSON.parse(JSON.stringify(a.history)));
  assert.ok(r.ok);
  const strip = (v) => ({ ...v, elapsed: 0, startAt: 0 });
  assert.deepStrictEqual(strip(b.view()), strip(a.view()));
  assert.strictEqual(b.penalties, 1);
});
