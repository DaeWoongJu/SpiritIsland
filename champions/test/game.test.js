'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Game } = require('../server/game/game');
const D = require('../server/game/data');
const { attachBots } = require('./bot');

const mk = (heroes, settings = {}, seed = 1) => new Game(heroes.map((h, i) => ({ id: 'p' + i, name: 'P' + i, bot: true, hero: h[0], aspect: h[1] })), { seed, settings });

test('데이터: 모든 영웅·측면 조합으로 덱 30장, 카드 id 유효', () => {
  for (const h of D.HEROES) for (const a of Object.keys(D.ASPECTS)) {
    const deck = D.buildDeck(h.id, a);
    assert.strictEqual(deck.length, 30, `${h.id}/${a}`);
    for (const id of deck) assert.ok(D.CARD_MAP[id], id);
  }
  for (const v of D.VILLAINS) for (const id of Object.keys(v.encounter)) assert.ok(D.ENC_MAP[id], `${v.id}: ${id}`);
});

test('준비: 일상 모습으로 시작, 손패 = 일상 손패 수, 악당 체력은 플레이어 수 비례', () => {
  const g = mk([['spark', 'justice'], ['titan', 'protection']], { villain: 'brute', difficulty: 'standard' });
  g.setup();
  for (const pid of g.order) { assert.strictEqual(g.form(pid), 'alter'); assert.strictEqual(g.P(pid).hand.length, g.hero(pid).alter.hand); }
  assert.strictEqual(g.villain.hp, 12 * 2);
  assert.strictEqual(g.scheme.threshold, 16);
});

test('자원: 자원 카드는 2개, 비용 지불 가능 여부', () => {
  const g = mk([['gear', 'leadership']]);
  g.setup();
  const p = g.P('p0');
  const card = (id) => { const u = g.newId('c'); g.cards[u] = id; return u; };
  p.hand = [card('energy_cell'), card('assault')];
  assert.strictEqual(g.resourceSum(p.hand), 3);
  assert.ok(g.canPay('p0', 2, p.hand[1]));
  assert.ok(!g.canPay('p0', 3, p.hand[1]));
  p.bonusRes = 1;
  assert.ok(g.canPay('p0', 3, p.hand[1]));
});

test('전투: 강인함은 피해 1번을 막고, 경비 미니언이 있으면 악당을 공격할 수 없음, 반격', () => {
  const g = mk([['titan', 'aggression']], { villain: 'brute' });
  g.setup();
  g.villain.tough = true;
  g.dealTo('villain', 5, 'p0');
  assert.strictEqual(g.villain.hp, 12);
  g.makeMinion('p0', 'guard');
  assert.ok(!g.damageTargets('p0', { attack: true }).some((o) => o.value === 'villain'));
  assert.ok(g.damageTargets('p0', {}).some((o) => o.value === 'villain'), '공격이 아닌 피해는 가능');
  const beast = g.makeMinion('p0', 'sonic_beast');
  const hp = g.P('p0').hp;
  g.dealTo(beast, 1, 'p0', { attack: true, attacker: { kind: 'hero', pid: 'p0' } });
  assert.strictEqual(g.P('p0').hp, hp - 1, '반격 1');
});

test('악당 단계 전환과 승리, 위협 한계 패배', async () => {
  const g = mk([['spark', 'justice']], { villain: 'brute', difficulty: 'standard' });
  g.setup();
  g.dealTo('villain', 99, 'p0');
  assert.strictEqual(g.villainStage().stage, 'II');
  assert.ok(g.villain.tough, 'II단계 시작: 강인함');
  assert.throws(() => { g.villain.tough = false; g.dealTo('villain', 999, 'p0'); });
  assert.ok(g.result && g.result.win);
  const g2 = mk([['spark', 'justice']], { villain: 'brute' });
  g2.setup();
  assert.throws(() => g2.addThreat(99, 'test'));
  assert.ok(g2.result && !g2.result.win);
});

test('부가 계략 위기: 주 계략 위협 제거 불가', () => {
  const g = mk([['fox', 'justice']], { villain: 'brute' });
  g.setup();
  g.scheme.threat = 3;
  g.sides.push({ sid: 's1', cardId: 'collapse', name: '건물 붕괴 위기', threat: 3, crisis: true, hazard: 0, accel: 0 });
  const t = g.thwartTargets({});
  assert.ok(!t.some((o) => o.value === 'main'));
  assert.ok(t.some((o) => o.value === 's1'));
});

for (const vill of D.VILLAINS.map((v) => v.id)) {
  test(`봇 게임 끝까지 진행: ${vill} (1·2·4인, 모든 난이도)`, async () => {
    const heroes = D.HEROES.map((h) => h.id);
    const asps = Object.keys(D.ASPECTS);
    let k = 0;
    for (const diff of D.DIFFICULTIES.map((d) => d.id)) for (const n of [1, 2, 4]) {
      const g = mk(Array.from({ length: n }, (_, i) => [heroes[(k * 2 + i * 5) % heroes.length], asps[(k + i) % 4]]), { villain: vill, difficulty: diff }, 10 + k++);
      attachBots(g, { random: k % 3 === 0 });
      const r = await Promise.race([g.run(), new Promise((_, rej) => setTimeout(() => rej(new Error('시간 초과')), 20000))]);
      assert.ok(r && !String(r.reason).startsWith('서버 오류'), `${vill}/${diff}/${n}: ${r && r.reason}`);
    }
  });
}

test('모든 영웅(확장 포함)이 각 측면으로 봇 게임을 끝까지 진행', async () => {
  const asps = Object.keys(D.ASPECTS);
  let k = 0;
  for (const h of D.HEROES) for (const a of asps) {
    const g = mk([[h.id, a]], { villain: D.VILLAINS[k % D.VILLAINS.length].id, difficulty: 'standard' }, 500 + k++);
    attachBots(g, { random: k % 2 === 0 });
    const r = await Promise.race([g.run(), new Promise((_, rej) => setTimeout(() => rej(new Error('시간 초과')), 20000))]);
    assert.ok(r && !String(r.reason).startsWith('서버 오류'), `${h.id}/${a}: ${r && r.reason}`);
  }
});

test('확장 악당: 단계 시작 시 모든 영웅에게 미니언 교전 (summonAll)', async () => {
  const g = mk([['cap', 'justice'], ['thor', 'aggression']], { villain: 'redskull', difficulty: 'standard' });
  g.setup();
  const before = g.allMinions().length;
  g.villain.hp = 0;
  g.villainDefeated();
  assert.strictEqual(g.villainStage().stage, 'II');
  assert.strictEqual(g.allMinions().filter((m) => m.cardId === 'rs_soldier').length - before >= 2, true);
});
