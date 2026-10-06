'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Game } = require('../server/game/game');
const D = require('../server/game/data');
const { attachBots } = require('./bot');
const savegame = require('../../shared/savegame');

const mk = (clans, settings = {}, seed = 1) => new Game(clans.map((c, i) => ({ id: 'p' + i, name: 'P' + i, bot: true, clan: c })), { seed, settings });
const tick = () => new Promise((r) => setImmediate(r));

test('데이터: 방 12개 연결, 종족마다 덱 10장, 아이콘·전리품 유효', () => {
  assert.strictEqual(D.ROOMS.length, 12);
  for (const r of D.ROOMS) for (const a of r.adj) assert.ok(D.ROOM_MAP[a].adj.includes(r.id));
  for (const c of D.CLANS) {
    assert.strictEqual(c.deck.length, 10, c.id);
    for (const card of c.deck) for (const k of card.icons) assert.ok(D.ICONS[k], `${c.id} ${k}`);
  }
  for (const id of D.LOOT_DECK) assert.ok(D.LOOT_MAP[id], id);
  for (const w of D.WAVES) for (const t of Object.keys(w.cards)) assert.ok(D.HEROES[t], t);
});

test('준비: 손패 5장, 둥지에 몬스터 2마리, 금고 상자 3개', () => {
  const g = mk(['rats', 'dragon']);
  g.setup();
  assert.strictEqual(g.P('p0').hand.length, 5);
  assert.strictEqual(g.myMonsters('p0').length, 2);
  assert.strictEqual(g.myMonsters('p1').length, 1);
  assert.ok(g.myMonsters('p0').every((m) => m.room === 'lair'));
  assert.strictEqual(g.rooms.vault.chests, 3);
});

test('용사: 몬스터가 있으면 공격, 없으면 보물을 훔치고, 행동하면 소진', () => {
  const g = mk(['skeletons']);
  g.setup();
  g.heroes.push({ hid: 'h1', type: 'warrior', room: 'hall', hp: 3, maxHp: 3, atk: 2, exhausted: false });
  g.heroAct(g.heroes[0]);
  assert.strictEqual(g.rooms.hall.chests, 0, '보물 창고 상자를 훔침');
  assert.strictEqual(g.heroes[0].exhausted, true);
  // 같은 방 몬스터 공격
  const m = g.placeMonster('p0', 'gem', true);
  g.heroes.push({ hid: 'h2', type: 'warrior', room: 'gem', hp: 3, maxHp: 3, atk: 2, exhausted: false });
  g.heroAct(g.heroes[1]);
  assert.ok(!g.monsters.includes(m), '해골이 쓰러짐');
  assert.strictEqual(g.rooms.gem.chests, 1, '공격했으니 훔치지 않음');
});

test('도적은 몬스터가 있어도 보물부터 훔치고, 새 용사가 오면 소진된 용사가 일어남 (고무)', () => {
  const g = mk(['skeletons']);
  g.setup();
  g.placeMonster('p0', 'gold', true);
  g.heroes.push({ hid: 'h1', type: 'rogue', room: 'gold', hp: 2, maxHp: 2, atk: 1, exhausted: false });
  g.heroAct(g.heroes[0]);
  assert.strictEqual(g.rooms.gold.chests, 0);
  g.heroes.push({ hid: 'h9', type: 'warrior', room: 'gate_w', hp: 3, maxHp: 3, atk: 2, exhausted: true });
  g.spawnHero({ type: 'archer', gate: 'gate_w' });
  assert.strictEqual(g.heroes.find((h) => h.hid === 'h9').exhausted, false);
});

test('쥐인간 떼 공격 피해 = 같은 방 쥐 수, 슬라임은 쓰러지면 분열', async () => {
  const g = mk(['rats', 'slimes']);
  g.setup();
  const h = { hid: 'hx', type: 'knight', room: 'lair', hp: 9, maxHp: 9, atk: 2, exhausted: false };
  g.heroes.push(h);
  const p = g.iconAttack('p0');
  for (let i = 0; i < 5; i++) { await tick(); const pr = g.currentPrompt('p0'); if (pr) g.answer('p0', pr.id, pr.options[0].value); }
  await p;
  assert.strictEqual(h.hp, 7, '쥐 2마리 → 피해 2');
  const s = g.myMonsters('p1')[0];
  const before = g.myMonsters('p1').length;
  g.damageMonster(s, 5, '테스트');
  assert.strictEqual(g.myMonsters('p1').length, before, '쓰러진 자리에 작은 슬라임');
  assert.ok(g.myMonsters('p1').some((m) => m.small && m.hp === 1));
});

test('금고 상자를 모두 빼앗기면 패배', async () => {
  const g = mk(['skeletons'], { difficulty: 'normal' });
  g.setup();
  g.rooms.vault.chests = 1;
  for (const m of g.monsters.slice()) g.monsters = [];
  g.heroes.push({ hid: 'h1', type: 'rogue', room: 'vault', hp: 2, maxHp: 2, atk: 1, exhausted: false });
  g.heroDeck = [];
  await assert.rejects(g.heroPhase('p0'));
  assert.strictEqual(g.result.win, false);
});

test('확장 — 불: 용사가 있으면 피해, 없으면 아이템을 태우고 꺼짐; 불씨족은 불에 안 다침', () => {
  const g = mk(['emberlings', 'skeletons'], { fire: true });
  g.setup();
  g.rooms.forge.fire = 1;
  const h = { hid: 'h1', type: 'warrior', room: 'forge', hp: 3, maxHp: 3, atk: 2, exhausted: false };
  g.heroes.push(h);
  g.burnFires();
  assert.strictEqual(h.hp, 2);
  assert.strictEqual(g.rooms.forge.fire, 0);
  g.rooms.lab.fire = 1; g.rooms.lab.items = 1;
  g.burnFires();
  assert.strictEqual(g.rooms.lab.items, 0);
  g.rooms.lair.fire = 2;
  const embers = g.myMonsters('p0').length;
  g.burnFires();
  assert.strictEqual(g.myMonsters('p0').length, embers, '불씨족은 무사');
});

test('확장 — 보스: 마지막 웨이브가 끝나면 용사왕이 나타남', async () => {
  const g = mk(['skeletons'], { difficulty: 'practice', boss: true });
  g.setup();
  g.heroDeck.length = 0;
  g.monsters = [];
  await g.heroPhase('p0').catch(() => {});
  assert.ok(g.bossSpawned);
  assert.ok(g.heroes.some((h) => h.type === 'king' && h.hp >= 12));
});

for (const diff of D.DIFFICULTIES.map((d) => d.id)) {
  test(`봇 게임 끝까지 진행: ${diff} (모든 종족, 1~4인, 확장 포함)`, async () => {
    for (let k = 0; k < D.CLANS.length; k++) {
      const n = 1 + (k % 4);
      const clans = Array.from({ length: n }, (_, i) => D.CLANS[(k + i * 2) % D.CLANS.length].id);
      const g = mk(clans, { difficulty: diff, fire: true, boss: k % 2 === 0, wave3: k % 3 === 0 }, 40 + k);
      attachBots(g);
      const r = await Promise.race([g.run(), new Promise((_, rej) => setTimeout(() => rej(new Error('시간 초과')), 20000))]);
      assert.ok(r && !String(r.reason).startsWith('서버 오류'), `${diff} ${clans}: ${r && r.reason}`);
    }
  });
}

test('저장/이어하기: 같은 시드 + 응답 기록이면 같은 상태', async () => {
  const { botAnswer } = require('../server/game/game');
  for (const limit of [10, 60, 150]) {
    const a = mk(['gnolls', 'imps'], { difficulty: 'normal', fire: true }, 77);
    savegame.record(a);
    a.run();
    for (let n = 0; n < limit && !a.result;) {
      let did = false;
      for (const pid of a.order) { const pr = a.currentPrompt(pid); if (!pr) continue; a.answer(pid, pr.id, botAnswer(a, pid, pr)); n++; did = true; break; }
      await tick();
      if (!did) for (let i = 0; i < 5; i++) await tick();
    }
    for (let i = 0; i < 20; i++) await tick();
    const b = mk(['gnolls', 'imps'], { difficulty: 'normal', fire: true }, a.seed);
    savegame.record(b);
    b.run();
    const r = await savegame.replay(b, JSON.parse(JSON.stringify(a.history)));
    for (let i = 0; i < 20; i++) await tick();
    assert.ok(r.ok, `재현 실패 at ${r.at}`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(b.view('p0'))), JSON.parse(JSON.stringify(a.view('p0'))));
  }
});
