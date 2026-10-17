'use strict';
// 포켓몬 골드 온라인: 변환 자료 + 배틀 엔진 테스트
// 원본 자료(pokemon/cache/world.json)가 없으면 (서버를 한 번도 안 켰으면) 건너뛴다.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WORLD = path.join(__dirname, '..', 'cache', 'world.json');
const has = fs.existsSync(WORLD);
const skip = has ? false : '원본 자료가 없음 (서버를 한 번 켜면 생김)';
const W = has ? JSON.parse(fs.readFileSync(WORLD, 'utf8')) : null;
const dex = require('../server/dex');
const { Battle } = require('../server/battle');
if (W) dex.init(W);

const party = (n, lv = 30) => Array.from({ length: n }, () => {
  const m = dex.makeMon(1 + dex.randInt(251), lv);
  const all = Object.keys(W.moves);
  m.moves = Array.from({ length: 4 }, () => { const id = all[dex.randInt(all.length)]; return { id, pp: W.moves[id].pp, max: W.moves[id].pp }; });
  return m;
});
const bag = (items) => ({ has: (i) => (items[i] || 0) > 0, use: (i) => { items[i]--; } });

/** 남은 선택을 아무거나 고르며 끝까지 진행 */
function runToEnd(b, maxTurns = 400) {
  for (let n = 0; !b.result && n < maxTurns; n++) {
    for (const [k, p] of [...b.prompts]) {
      if (!b.prompts.has(k)) continue;
      if (p.kind === 'replace') b.answer(p.ctrl, k, { party: p.choices[0] });
      else {
        const ok = p.moves.filter((m) => m.ok);
        b.answer(p.ctrl, k, { type: 'move', i: ok.length ? ok[dex.randInt(ok.length)].i : 0, target: p.targets[0] && p.targets[0].key });
      }
    }
  }
}

test('조토 맵: 연두마을·연결·문이 원본대로', { skip }, () => {
  assert.ok(Object.keys(W.maps).length > 350);
  const nb = W.maps.NEW_BARK_TOWN;
  assert.deepStrictEqual([nb.w, nb.h], [10, 9]);
  assert.strictEqual(nb.conn.west.map, 'ROUTE_29');
  const opp = { north: 'south', south: 'north', west: 'east', east: 'west' };
  for (const m of Object.values(W.maps)) {
    assert.ok(m.blocks && m.blocks.length === m.w * m.h, `${m.id} 블록`);
    for (const [d, c] of Object.entries(m.conn)) {
      const back = W.maps[c.map].conn[opp[d]];
      assert.ok(back && back.map === m.id && back.off === -c.off, `${m.id} ${d} 연결이 양쪽에서 맞음`);
    }
    for (const w of m.warps) if (w.idx > 0 && W.maps[w.to]) assert.ok(W.maps[w.to].warps[w.idx - 1], `${m.id} → ${w.to} 문 도착점`);
  }
});

test('포켓몬 251종 · 기술 251개 · 체육관 관장', { skip }, () => {
  assert.strictEqual(Object.keys(W.species).length, 251);
  assert.strictEqual(Object.keys(W.moves).length, 251);
  assert.deepStrictEqual(W.species[155].types, ['FIRE']);
  assert.strictEqual(W.trainers['FALKNER:FALKNER1'].party.length, 2);
  const leaders = Object.values(W.maps).flatMap((m) => m.objects.filter((o) => o.leader).map((o) => o.trainer));
  for (const t of ['FALKNER:FALKNER1', 'BUGSY:BUGSY1', 'WHITNEY:WHITNEY1', 'MORTY:MORTY1', 'CHUCK:CHUCK1', 'JASMINE:JASMINE1', 'PRYCE:PRYCE1', 'CLAIR:CLAIR1']) assert.ok(leaders.includes(t), t);
  assert.ok(W.wild.grass.ROUTE_29.day.length === 7);
});

test('2세대 능력치 공식', { skip }, () => {
  const m = dex.makeMon(155, 5, { dvs: { atk: 15, def: 15, spd: 15, spc: 15 } });
  // HP = floor((39+15)*2*5/100) + 5 + 10 = 20
  assert.strictEqual(m.stats[0], 20);
  assert.strictEqual(m.shiny, false);
  const s = dex.makeMon(130, 30, { dvs: { atk: 14, def: 10, spd: 10, spc: 10 } });
  assert.strictEqual(s.shiny, true);
  assert.strictEqual(dex.typeEff('WATER', ['FIRE']), 2);
  assert.strictEqual(dex.typeEff('ELECTRIC', ['GROUND']), 0);
  assert.strictEqual(dex.typeEff('NORMAL', ['GHOST']), 0);
  assert.strictEqual(dex.typeEff('GRASS', ['FIRE', 'FLYING']), 0.25);
});

test('경험치로 레벨 업하고 기술을 배운다', { skip }, () => {
  const m = dex.makeMon(155, 5);
  const before = m.moves.length;
  const r = dex.gainExp(m, dex.expForLevel('MEDIUM_SLOW', 12) - m.exp);
  assert.strictEqual(m.level, 12);
  assert.ok(r.levels.includes(6));
  assert.ok(r.learn.length >= 1 || m.moves.length > before);
});

test('야생 배틀: 마스터볼은 반드시 잡힌다', { skip }, () => {
  const me = dex.makeMon(155, 50);
  const items = { MASTER_BALL: 1 };
  const b = new Battle({ kind: 'wild', sides: [{ name: 'A', ctrls: [{ id: 'a', human: true, name: '골드', party: [me], bag: bag(items) }] }, { name: '야생', ctrls: [{ id: 'w', ai: 'wild', name: '', party: [dex.makeMon(249, 70)] }] }] });
  b.on('update', () => {});
  b.start();
  b.answer('a', '0-0', { type: 'item', item: 'MASTER_BALL' });
  assert.strictEqual(b.result.reason, 'caught');
  assert.strictEqual(b.result.caught.species, 249);
  assert.strictEqual(items.MASTER_BALL, 0);
});

test('트레이너 배틀에서는 도망칠 수 없고, 이기면 상금', { skip }, () => {
  const me = dex.makeMon(160, 60);
  const b = new Battle({ kind: 'trainer', trainer: { title: '반바지 꼬마', name: '민수', reward: 4 }, sides: [{ name: 'A', ctrls: [{ id: 'a', human: true, name: '골드', party: [me] }] }, { name: 'T', ctrls: [{ id: 't', ai: 'trainer', name: '민수', party: [dex.makeMon(19, 3)] }] }] });
  b.on('update', () => {});
  b.start();
  assert.ok(!b.prompts.get('0-0').canRun);
  runToEnd(b);
  assert.strictEqual(b.result.winner, 0);
  assert.strictEqual(b.moneyWon, 4 * 3);
});

test('무작위 배틀 수백 판: 1:1, 협동 2:2, 대결 2:2 모두 오류 없이 끝남', { skip }, () => {
  for (let g = 0; g < 240; g++) {
    const kind = ['wild', 'trainer', 'pvp'][g % 3];
    const dbl = g % 2 === 0;
    const sides = kind === 'pvp'
      ? [{ name: 'A', ctrls: [{ id: 'a', human: true, name: '골드', party: party(3), slots: dbl ? 2 : 1 }] }, { name: 'B', ctrls: [{ id: 'b', human: true, name: '실버', party: party(3), slots: dbl ? 2 : 1 }] }]
      : [{ name: 'A', ctrls: dbl ? [{ id: 'a', human: true, name: '골드', party: party(2) }, { id: 'b', human: true, name: '실버', party: party(2) }] : [{ id: 'a', human: true, name: '골드', party: party(3) }] },
        { name: 'B', ctrls: [{ id: 'ai', ai: kind === 'wild' ? 'wild' : 'trainer', name: 'T', party: party(kind === 'wild' ? (dbl ? 2 : 1) : 3), slots: dbl ? 2 : 1 }] }];
    const b = new Battle({ kind, sides, trainer: { title: '반바지 꼬마', name: '민수', reward: 10 } });
    b.on('update', () => {});
    b.start();
    runToEnd(b);
    assert.ok(b.result, `${kind} ${dbl ? '2:2' : '1:1'} 배틀이 끝남`);
  }
});
