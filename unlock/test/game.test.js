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
      (c.spots || []).forEach((s, i) => { if (s.reveal && !g.spotsFound.has(`${k}#${i}`) && g.has(k)) { assert.strictEqual(g.answer('p0', g.seq, s.hidden ? { a: 'take', num: String(s.num) } : { a: 'spot', card: k, i }), null); did = true; } });
      if (g.result) return;
      if (c.type === 'code' && !g.solved.has(k)) { assert.strictEqual(g.answer('p0', g.seq, { a: 'code', card: k, code: c.code }), null); did = true; }
      if (c.type === 'machine' && !g.solved.has(k) && g.has(k)) { assert.strictEqual(g.answer('p0', g.seq, { a: 'machine', card: k, seq: c.solution }), null); did = true; }
      if (g.result) return;
    }
    for (const c of sc.cards) {
      if (c.from && c.type !== 'trap' && !g.has(c.key) && !g.gone.has(c.key) && c.from.every((x) => g.has(x))) {
        const [x, y] = c.from;
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
    const v = (k) => (sc.byKey[k].plus != null ? sc.byKey[k].plus : sc.byKey[k].num);
    for (const c of sc.cards) if (c.from) assert.strictEqual(c.num, v(c.from[0]) + v(c.from[1]), `${sc.id} ${c.key}`);
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

/** 카드의 i번째 살펴보기 지점: 숨은 번호면 번호 입력, 아니면 누르기 */
const look = (g, card, i, pid = 'p0') => { const sp = g.sc.byKey[card].spots[i]; return g.answer(pid, g.seq, sp.hidden ? { a: 'take', num: String(sp.num) } : { a: 'spot', card, i }); };

test('원작 규칙: 틀린 코드·장치는 벌점, 합한 번호가 덱에 없으면 벌점 없음, 있으면 벌점, 함정 조합도 벌점', () => {
  const g = mk('tutorial');
  g.run();
  look(g, 'room', 0);
  g.answer('p0', g.seq, { a: 'combine', x: 'chest', y: 'key' });
  assert.ok(g.has('safe'));
  g.answer('p0', g.seq, { a: 'code', card: 'safe', code: '1234' });
  assert.strictEqual(g.penalties, 1);
  assert.ok(g.elapsed() >= 3 * 60000);
  g.answer('p0', g.seq, { a: 'code', card: 'safe', code: '0915' });
  g.answer('p0', g.seq, { a: 'machine', card: 'panel', seq: ['🔵'] });
  assert.strictEqual(g.penalties, 2);
  // 합한 번호
  const f = mk('formula');
  f.run();
  look(f, 'corridor', 0);
  const sum = f.sc.byKey.guarddoor.num + f.sc.byKey.bolt.num;
  assert.strictEqual(f.sc.byKey.guardroom.num, sum);
  const t = mk('goorse');
  t.run();
  look(t, 'beach', 0); look(t, 'cliff', 0);
  t.answer('p0', t.seq, { a: 'combine', x: 'vines', y: 'machete' });
  const before = t.penalties;
  // 퓨즈는 아직 없으니 다른 잘못된 조합: 상자 + 마체테 → 그 합의 카드가 있으면 벌점, 없으면 무사
  const wrongSum = t.sc.byKey.crate.num + t.sc.byKey.machete.num;
  t.answer('p0', t.seq, { a: 'combine', x: 'crate', y: 'machete' });
  assert.strictEqual(t.penalties, before + (t.sc.byNum[String(wrongSum)] ? 1 : 0));
  // 함정
  look(t, 'beach', 0);
});

test('숨은 번호: 찾은 번호는 가져오고, 아직 안 보이는 번호를 뒤집으려 하면 벌점', () => {
  const g = mk('formula');
  g.run();
  const bolt = g.sc.byKey.bolt.num;
  assert.strictEqual(g.answer('p0', g.seq, { a: 'take', num: String(bolt) }), null);
  assert.ok(g.has('bolt'));
  const vial = g.sc.byKey.vial.num; // 실험실 안에 숨은 번호 — 아직 실험실에 못 들어감
  g.answer('p0', g.seq, { a: 'take', num: String(vial) });
  assert.ok(!g.has('vial'));
  assert.strictEqual(g.penalties, 1);
  assert.ok(g.answer('p0', g.seq, { a: 'take', num: '999' }), '없는 번호는 오류 메시지만');
  assert.strictEqual(g.penalties, 1);
});

test('보정 숫자(+N): 다른 색 번호에 더해서 합친다', () => {
  const g = mk('squeek');
  g.run();
  const sc = g.sc;
  assert.strictEqual(sc.byKey.remoteOn.num, sc.byKey.remoteP.num + 7);
  g.inPlay.push('remoteP', 'caught');
  assert.strictEqual(g.answer('p0', g.seq, { a: 'combine', x: 'caught', y: 'remoteP' }), null);
  assert.ok(g.has('remoteOn'));
  assert.strictEqual(g.penalties, 0);
});

test('힌트는 순서대로 보이고 별점에 반영, 숨은 번호는 한 번만', () => {
  const g = mk('tutorial');
  g.run();
  assert.strictEqual(g.answer('p0', g.seq, { a: 'hint', card: 'room' }), null);
  assert.strictEqual(g.answer('p0', g.seq, { a: 'hint', card: 'room' }), null);
  assert.ok(g.answer('p0', g.seq, { a: 'hint', card: 'room' }), '힌트가 더 없음');
  assert.strictEqual(g.view().cards.find((c) => c.key === 'room').hintsSeen.length, 2);
  look(g, 'room', 0);
  look(g, 'room', 0);
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
  const a = mk('formula', 2);
  savegame.record(a);
  a.run();
  a.answer('p0', a.seq, { a: 'take', num: String(a.sc.byKey.bolt.num) });
  a.answer('p1', a.seq, { a: 'code', card: 'secdoor', code: '1234' });
  a.answer('p1', a.seq, { a: 'combine', x: 'locker', y: 'bolt' });
  a.answer('p1', a.seq, { a: 'code', card: 'secdoor', code: '1124' });
  a.answer('p0', a.seq, { a: 'hint', card: 'whiteboard' });
  const b = mk('formula', 2);
  savegame.record(b);
  b.run();
  const r = await savegame.replay(b, JSON.parse(JSON.stringify(a.history)));
  assert.ok(r.ok);
  const strip = (v) => ({ ...v, elapsed: 0, startAt: 0 });
  assert.deepStrictEqual(strip(b.view()), strip(a.view()));
  assert.strictEqual(b.penalties, 1);
});
