'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Game } = require('../server/game/game');
const D = require('../server/game/data');
const { attachBots } = require('./bot');
const savegame = require('../../shared/savegame');

const mk = (chars, settings = {}, seed = 1) => new Game(chars.map((c, i) => ({ id: 'p' + i, name: 'P' + i, bot: true, chars: c })), { seed, settings });
const tick = () => new Promise((r) => setImmediate(r));

test('데이터: 지도 31곳이 모두 이어져 있고, 인물 13명·이벤트 14장·목표 24개', () => {
  assert.strictEqual(D.LOCATIONS.length, 31);
  for (const l of D.LOCATIONS) for (const a of l.adj) assert.ok(D.LOC_MAP[a].adj.includes(l.id), `${l.id}-${a}`);
  const seen = new Set(['hobbiton']); const q = ['hobbiton'];
  while (q.length) for (const a of D.LOC_MAP[q.shift()].adj) if (!seen.has(a)) { seen.add(a); q.push(a); }
  assert.strictEqual(seen.size, D.LOCATIONS.length, '모든 곳에 갈 수 있어야 함');
  assert.strictEqual(D.CHARACTERS.length, 13);
  assert.strictEqual(D.EVENTS.length, 14);
  assert.strictEqual(D.OBJECTIVES.length, 24);
  for (const c of D.CHARACTERS) assert.ok(D.LOC_MAP[c.start], c.id);
  for (const o of D.OBJECTIVES) for (const f of o.focus || []) assert.ok(D.LOC_MAP[f], `${o.id} ${f}`);
});

test('준비: 인물 2명씩, 프로도는 호빗골에 숨어서, 목표 5개 공개, 어둠의 파도가 덱에 고르게', () => {
  const g = mk([['gandalf', 'aragorn'], []], { difficulty: 'normal' });
  g.setup();
  assert.deepStrictEqual(g.players[0].chars, ['gandalf', 'aragorn']);
  assert.strictEqual(g.players[1].chars.length, 2);
  assert.ok(!g.players[1].chars.includes('gandalf'));
  assert.strictEqual(g.frodo().loc, 'hobbiton');
  assert.ok(g.hidden);
  assert.strictEqual(g.objectives.length, 5);
  assert.strictEqual(g.playerDeck.filter((c) => c.kind === 'surge').length, 5);
  assert.strictEqual(g.P('p0').hand.length, 4);
  assert.strictEqual(g.hope, 8);
});

test('오크: 군대가 막고, 3마리가 넘치면 돌파 (희망 -1, 옆으로 번짐), 안식처엔 안 옴', () => {
  const g = mk([['gimli', 'elrond']]);
  g.setup();
  g.locs.bree.orcs = 0; g.locs.bree.armies = 1;
  g.addOrcs('bree', 1);
  assert.strictEqual(g.locs.bree.armies, 0);
  assert.strictEqual(g.locs.bree.orcs, 0);
  g.locs.weathertop.orcs = 3;
  for (const a of D.LOC_MAP.weathertop.adj) { g.locs[a].orcs = 0; g.locs[a].armies = 0; }
  const hope = g.hope;
  g.addOrcs('weathertop', 1);
  assert.strictEqual(g.hope, hope - 1);
  assert.strictEqual(g.locs.bree.orcs, 1);
  assert.strictEqual(g.locs.rivendell.orcs, 0, '안식처');
});

test('보로미르가 있는 곳엔 오크가 오지 않고, 점령한 요새에도 오지 않음', () => {
  const g = mk([['boromir', 'gimli']]);
  g.setup();
  const mt = g.locs.minastirith.orcs;
  g.addOrcs('minastirith', 2);
  assert.strictEqual(g.locs.minastirith.orcs, mt);
  g.locs.isengard.captured = true; g.locs.isengard.orcs = 0;
  g.addOrcs('isengard', 1);
  assert.strictEqual(g.locs.isengard.orcs, 0);
});

test('공격: 간달프는 모두, 나무수염은 숲에서 3, 군대가 있으면 +1', async () => {
  const g = mk([['gandalf', 'treebeard']]);
  g.setup();
  const st = { main: 4, sub: 1 };
  g.pawn('gandalf').loc = 'bree'; g.locs.bree.orcs = 3;
  await g.doAction('p0', st, 'atk:gandalf:bree');
  assert.strictEqual(g.locs.bree.orcs, 0);
  g.pawn('treebeard').loc = 'fangorn'; g.locs.fangorn.orcs = 3;
  await g.doAction('p0', st, 'atk:treebeard:fangorn');
  assert.strictEqual(g.locs.fangorn.orcs, 0);
  assert.strictEqual(st.main, 3, '주 인물 행동 1');
  assert.strictEqual(st.sub, 0, '보조 인물 행동 1');
});

test('요새 점령: 오크가 없어야 하고, 같은 지역 카드 3장 (김리는 2장)', async () => {
  const g = mk([['gimli', 'elrond']]);
  g.setup();
  g.pawn('gimli').loc = 'isengard';
  g.locs.isengard.orcs = 0;
  g.P('p0').hand = ['helm', 'edoras', 'fangorn'].map((loc, i) => ({ uid: 'x' + i, kind: 'loc', loc }));
  const st = { main: 4, sub: 1 };
  const o = g.turnOptions('p0', st).find((x) => x.value === 'cap:gimli');
  assert.ok(o && !o.disabled);
  const p = g.doAction('p0', st, 'cap:gimli');
  for (let i = 0; i < 5; i++) { await tick(); const pr = g.currentPrompt('p0'); if (pr) g.answer('p0', pr.id, pr.options[0].value); }
  await p;
  assert.ok(g.locs.isengard.captured);
  assert.strictEqual(g.P('p0').hand.length, 1, '김리는 2장만');
});

test('프로도: 오크 2마리 이상인 곳에 들어가면 발각, 나즈굴이 있으면 수색, 안식처에서 숨기', async () => {
  const g = mk([['aragorn', 'gimli']]);
  g.setup();
  g.locs.bree.orcs = 2;
  g.moveFrodo('bree');
  assert.strictEqual(g.hidden, false);
  g.frodo().loc = 'rivendell';
  const st = { main: 4, sub: 1 };
  assert.ok(g.turnOptions('p0', st).some((o) => o.value === 'hide'));
  await g.doAction('p0', st, 'hide');
  assert.ok(g.hidden);
  g.nazgul[0].loc = 'weathertop';
  const hope = g.hope;
  let rolled = false;
  g.on('update', () => {});
  const ev0 = g.events.length;
  g.locs.weathertop.orcs = 0;
  g.moveFrodo('weathertop');
  rolled = g.events.slice(ev0).some((e) => e.kind === 'search');
  assert.ok(rolled, '나즈굴과 마주치면 수색');
  assert.ok(g.hope <= hope);
});

test('나즈굴의 사냥: 프로도에게 다가오되 안식처엔 못 들어감', () => {
  const g = mk([['aragorn', 'gimli']]);
  g.setup();
  g.frodo().loc = 'rivendell';
  g.nazgul.forEach((n) => { n.loc = 'weathertop'; });
  g.nazgulHunt();
  assert.ok(g.nazgul.every((n) => n.loc !== 'rivendell'));
});

test('반지 파괴: 운명의 산 + 목표 수 + 💍 카드 (모두의 손패에서)', async () => {
  const g = mk([['aragorn', 'gimli'], ['legolas', 'eowyn']], { difficulty: 'normal' });
  g.setup();
  g.frodo().loc = 'mountdoom';
  const rings = D.LOCATIONS.filter((l) => l.ring).map((l) => l.id);
  g.P('p0').hand = rings.slice(0, 3).map((loc, i) => ({ uid: 'a' + i, kind: 'loc', loc }));
  g.P('p1').hand = rings.slice(3, 5).map((loc, i) => ({ uid: 'b' + i, kind: 'loc', loc }));
  const st = { main: 4, sub: 1 };
  let o = g.turnOptions('p0', st).find((x) => x.value === 'destroy');
  assert.ok(o.disabled, '목표가 모자라면 못 함');
  g.objectives.slice(0, 3).forEach((x) => { x.done = true; });
  o = g.turnOptions('p0', st).find((x) => x.value === 'destroy');
  assert.ok(!o.disabled);
  await assert.rejects(g.doAction('p0', st, 'destroy'));
  assert.strictEqual(g.result.win, true);
});

test('목표는 조건을 채우면 달성되고 희망 +1', () => {
  const g = mk([['aragorn', 'gimli']]);
  g.setup();
  g.objectives = [{ id: 'helm', done: false }];
  g.hope = 5;
  g.locs.helm.orcs = 0; g.locs.helm.armies = 2;
  g.checkObjectives();
  assert.ok(g.objectives[0].done);
  assert.strictEqual(g.hope, 6);
});

test('어둠의 파도: 위협이 오르고 한 곳에 오크 3마리', () => {
  const g = mk([['aragorn', 'gimli']]);
  g.setup();
  const t = g.threatIdx;
  const before = Object.values(g.locs).reduce((s, l) => s + l.orcs, 0);
  g.surge();
  assert.strictEqual(g.threatIdx, t + 1);
  assert.ok(Object.values(g.locs).reduce((s, l) => s + l.orcs, 0) > before || g.hope < 8);
  assert.strictEqual(g.shadowDiscard.length, 0, '버린 어둠 카드가 다시 덱 위로');
});

for (const diff of D.DIFFICULTIES.map((d) => d.id)) {
  test(`봇 게임 끝까지 진행: ${diff} (1~5인, 모든 인물)`, async () => {
    for (let k = 0; k < 10; k++) {
      const n = 1 + (k % 5);
      const g = mk(Array.from({ length: n }, () => []), { difficulty: diff }, 300 + k);
      attachBots(g);
      const r = await Promise.race([g.run(), new Promise((_, rej) => setTimeout(() => rej(new Error('시간 초과')), 20000))]);
      assert.ok(r && !String(r.reason).startsWith('서버 오류'), `${diff} ${n}인: ${r && r.reason}`);
    }
  });
}

test('봇이 이길 수도 있음 (보통, 30판 중 몇 판)', async () => {
  let wins = 0;
  for (let s = 0; s < 30; s++) {
    const g = mk([[], []], { difficulty: 'normal' }, 900 + s);
    attachBots(g);
    const r = await g.run();
    if (r.win) wins++;
  }
  assert.ok(wins >= 3 && wins <= 27, `승리 ${wins}/30`);
});

test('저장/이어하기: 같은 시드 + 응답 기록이면 같은 상태', async () => {
  const { botAnswer } = require('../server/game/game');
  for (const limit of [10, 60, 150]) {
    const a = mk([['gandalf', 'merrypippin'], ['galadriel', 'theoden']], { difficulty: 'normal' }, 77);
    savegame.record(a);
    a.run();
    for (let n = 0; n < limit && !a.result;) {
      let did = false;
      for (const pid of a.order) { const pr = a.currentPrompt(pid); if (!pr) continue; a.answer(pid, pr.id, botAnswer(a, pid, pr)); n++; did = true; break; }
      await tick();
      if (!did) for (let i = 0; i < 5; i++) await tick();
    }
    for (let i = 0; i < 20; i++) await tick();
    const b = mk([['gandalf', 'merrypippin'], ['galadriel', 'theoden']], { difficulty: 'normal' }, a.seed);
    savegame.record(b);
    b.run();
    const r = await savegame.replay(b, JSON.parse(JSON.stringify(a.history)));
    for (let i = 0; i < 20; i++) await tick();
    assert.ok(r.ok, `재현 실패 at ${r.at}`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(b.view('p0'))), JSON.parse(JSON.stringify(a.view('p0'))));
  }
});
