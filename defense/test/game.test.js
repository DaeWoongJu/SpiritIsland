'use strict';
// 요괴 퇴마 디펜스 — 규칙 엔진 테스트 (node --test)
const test = require('node:test');
const assert = require('node:assert');
const D = require('../server/game/data');
const M = require('../server/game/maps');
const { Game } = require('../server/game/game');

const roster = (n = 2, bot = false) => [{ id: 'a', name: 'A', leader: 'sword', bot }, { id: 'b', name: 'B', leader: 'merchant', bot }].slice(0, n);

test('맵이 충분히 많고, 모든 길이 이어져 있다', () => {
  assert.ok(M.MAPS.length >= 50, `맵 수 ${M.MAPS.length}`);
  const ids = new Set();
  for (const m of [...M.MAPS, ...Array.from({ length: 100 }, (_, i) => M.randomMap(i * 7 + 1))]) {
    if (m.id !== 'random') { assert.ok(!ids.has(m.id), '중복 id ' + m.id); ids.add(m.id); }
    assert.strictEqual(m.paths.length, 1, `${m.id}: 입구는 하나 (한쪽에서만 나옴)`);
    for (const p of m.paths) {
      assert.ok(p.pts.length >= 3, m.id);
      for (let i = 1; i < p.pts.length; i++) {
        const [x1, y1] = p.pts[i - 1], [x2, y2] = p.pts[i];
        assert.ok(x1 === x2 || y1 === y2, `${m.id}: 대각선 길`);
      }
    }
    // 길 옆에 유닛을 세울 자리가 충분
    const g = new Game(roster(), { mapId: m.id === 'random' ? 'random' : m.id, seed: m.seed });
    assert.ok(g.F.m0.spots.filter((s) => s.d === 1).length >= 30, `${m.id}: 길 옆 자리 부족`);
  }
});

test('소환 · 합성 · 판매 · 강화', () => {
  const g = new Game(roster(1), { mapId: 'h-ring', seed: 1 });
  const p = g.players[0];
  p.gold = 10000;
  for (let i = 0; i < 6; i++) assert.ok(g.command('a', { t: 'summon' }).ok);
  assert.strictEqual(g.units.length, 6);
  // 같은 유닛 3개를 강제로 만들어 합성
  for (const u of g.units.slice(0, 3)) u.type = 'novice';
  const before = g.units.length;
  const r = g.command('a', { t: 'merge', unit: g.units[0].id });
  assert.ok(r && r.ok);
  assert.strictEqual(g.units.length, before - 2);
  assert.strictEqual(D.UNIT_MAP[g.units.find((u) => u.id === r.ok).type].tier, 2);
  // 판매
  const gold = p.gold;
  g.command('a', { t: 'sell', unit: g.units[0].id });
  assert.ok(p.gold > gold);
  // 강화
  g.command('a', { t: 'upgrade', cat: 'blade' });
  assert.strictEqual(p.upg.blade, 1);
  // 소환은 항상 소환진(3×3)에 나옴
  const r2 = g.command('a', { t: 'summon', tile: [0, 0] });
  const nu = g.units.find((u) => u.id === r2.ok);
  assert.ok(g.F.m0.zone.has(nu.x + ',' + nu.y), '소환진에 나와야 함');
  // 여러 개 한꺼번에 옮기기 · 같은 유닛 모으기 · 소환진 비우기
  const ids = g.units.slice(0, 3).map((u) => u.id);
  const s0 = g.autoSpot(0);
  g.command('a', { t: 'moveMany', units: ids, tile: [s0.x, s0.y] });
  for (const id of ids) { const u = g.units.find((x) => x.id === id); assert.ok(Math.max(Math.abs(u.x - s0.x), Math.abs(u.y - s0.y)) <= 2, '목표 근처로'); }
  for (const u of g.units) u.type = 'hunter';
  g.units[0].x = 0; g.units[0].y = 0;
  g.command('a', { t: 'gather', unit: g.units[1].id });
  assert.ok(Math.max(Math.abs(g.units[0].x - g.units[1].x), Math.abs(g.units[0].y - g.units[1].y)) <= 2, '같은 유닛이 모임');
  g.command('a', { t: 'clearZone' });
  assert.ok(!g.units.some((u) => g.F.m0.zone.has(u.x + ',' + u.y)), '소환진이 비워짐');
  // 남의 유닛은 못 건드림
  assert.strictEqual(g.command('b', { t: 'sell', unit: g.units[0].id }), null);
});

test('같은 유닛은 한 칸에 겹쳐 쌓임', () => {
  const g = new Game(roster(1), { mapId: 'g1', seed: 21 });
  const p = g.players[0];
  p.gold = 1e5;
  const a = g.command('a', { t: 'summon' });
  const ua = g.units.find((u) => u.id === a.ok);
  // 같은 종류를 하나 더 주면 그 무리에 합류
  const ub = g.giveUnit(p, 1, false, null, ua.type);
  assert.deepStrictEqual([ub.x, ub.y], [ua.x, ua.y]);
  // 다른 종류는 그 칸에 못 섬
  const other = D.UNITS.find((t) => t.tier === 1 && t.id !== ua.type).id;
  const uc = g.giveUnit(p, 1, false, null, other);
  assert.notDeepStrictEqual([uc.x, uc.y], [ua.x, ua.y]);
  assert.strictEqual(typeof g.command('a', { t: 'move', unit: uc.id, tile: [ua.x, ua.y] }), 'string');
  // 무리째 옮기기 (길 옆으로)
  g.command('a', { t: 'autoPlace', units: [ua.id, ub.id] });
  assert.deepStrictEqual([ua.x, ua.y], [ub.x, ub.y]);
  assert.ok(!g.F.m0.zone.has(ua.x + ',' + ua.y));
});

test('전설 2개 → 신화', () => {
  const g = new Game(roster(1), { mapId: 'h-ring', seed: 2 });
  g.players[0].gold = 1000;
  g.command('a', { t: 'summon' }); g.command('a', { t: 'summon' });
  for (const u of g.units) u.type = 'sun';
  const r = g.command('a', { t: 'merge', unit: g.units[0].id });
  assert.strictEqual(D.UNIT_MAP[g.units.find((u) => u.id === r.ok).type].tier, 5);
});

test('필살기와 축복', () => {
  const g = new Game(roster(2), { mapId: 'h-snake', seed: 3 });
  g.players[0].skillCd = 0; g.players[1].skillCd = 0;
  for (let i = 0; i < 200; i++) g.tick();
  const e = g.enemies[0];
  assert.ok(e, '요괴가 나와야 함');
  assert.strictEqual(g.command('a', { t: 'skill', x: e.x, y: e.y }), null);
  assert.ok(e.dead || e.hp < e.maxHp);
  const gold = g.players[1].gold;
  g.command('b', { t: 'skill' });
  assert.ok(g.players[1].gold > gold);
  g.offerBlessing(g.players[0]);
  const choice = g.players[0].choice[0];
  g.command('a', { t: 'bless', id: choice });
  assert.deepStrictEqual(g.players[0].bless, [choice]);
});

test('아무것도 안 하면 진다 (외길·순환)', () => {
  for (const mapId of ['h-snake', 'h-ring']) {
    const g = new Game(roster(2), { mapId, seed: 4 });
    while (!g.result && g.time < 2000) g.tick();
    assert.ok(g.result && !g.result.win, mapId);
  }
});

test('AI 둘이서 쉬움 난이도는 끝까지 깬다', () => {
  for (const mapId of ['h-ring', 'g1', 'random']) {
    const g = new Game(roster(2, true), { mapId, difficulty: 'easy', seed: 5 });
    while (!g.result && g.time < 3000) { g.tick(); g.fx.length = 0; g.msgs.length = 0; }
    assert.ok(g.result && g.result.win, `${mapId}: ${g.result && g.result.reason} (웨이브 ${g.wave})`);
  }
});

test('미션을 달성하면 영웅을 데려오고, 영웅은 처치로 레벨업', () => {
  const g = new Game(roster(1), { mapId: 'h-snake', seed: 9 });
  const p = g.players[0];
  p.kills = 200;
  g.checkMissions();
  assert.strictEqual(p.tickets, 1);
  assert.strictEqual(p.heroChoice.length, 3);
  const id = p.heroChoice[0];
  const r = g.command('a', { t: 'hero', id });
  assert.ok(r && r.ok);
  assert.strictEqual(p.tickets, 0);
  const hero = g.units.find((u) => u.id === r.ok);
  assert.strictEqual(hero.type, id);
  assert.strictEqual(typeof g.command('a', { t: 'sell', unit: hero.id }), 'string');
  assert.strictEqual(typeof g.command('a', { t: 'merge', unit: hero.id }), 'string');
  const d1 = g.unitStats(hero).dmg;
  hero.kills = 600;
  assert.ok(g.unitStats(hero).dmg > d1 * 2);
  // 같은 미션은 한 번만
  g.checkMissions();
  assert.strictEqual(p.tickets, 0);
  // 소환으로는 영웅이 안 나옴
  p.gold = 1e6;
  for (let i = 0; i < 30; i++) g.command('a', { t: 'summon', premium: true });
  assert.strictEqual(g.units.filter((u) => D.UNIT_MAP[u.type].hero).length, 1);
});

test('요괴는 한쪽 입구에서만 나온다', () => {
  const g = new Game(roster(2), { mapId: 'g1', seed: 10 });
  for (let i = 0; i < 300; i++) g.tick();
  assert.ok(g.enemies.length > 0);
  assert.ok(g.enemies.every((e) => e.path === 0));
});

test('조합법 · 히든 조합 (재료 아이템 필요)', () => {
  const g = new Game(roster(1), { mapId: 'h-ring', seed: 11 });
  const p = g.players[0];
  p.gold = 1e5;
  for (let i = 0; i < 3; i++) g.command('a', { t: 'summon' });
  ['novice', 'novice', 'talisman'].forEach((t, i) => { g.units[i].type = t; });
  assert.ok(g.craftable(p).includes('r_wave'));
  const r = g.command('a', { t: 'craft', recipe: 'r_wave' });
  assert.ok(r && r.ok);
  assert.strictEqual(g.units.find((u) => u.id === r.ok).type, 'wave');
  assert.strictEqual(g.units.length, 1);
  // 히든: 그림자 + 화염 + 붉은 달 조각
  g.command('a', { t: 'summon' });
  g.units[0].type = 'shadow'; g.units[1].type = 'flame';
  assert.strictEqual(typeof g.command('a', { t: 'craft', recipe: 'h_crimson' }), 'string', '재료 아이템이 없으면 안 됨');
  p.items.moonshard = 1;
  const h = g.command('a', { t: 'craft', recipe: 'h_crimson' });
  assert.strictEqual(g.units.find((u) => u.id === h.ok).type, 'x_crimson');
  assert.strictEqual(p.items.moonshard, 0);
  assert.deepStrictEqual(g.discovered, ['h_crimson']);
});

test('각자 전장 · 보스 스토리 · 스토리 이벤트', () => {
  const g = new Game(roster(2), { mapId: 'h-snake', seed: 12 });
  assert.deepStrictEqual(g.fields.map((f) => f.id), ['m0', 'm1', 'room', 'ev']);
  for (let i = 0; i < 300; i++) g.tick();
  assert.ok(g.enemies.some((e) => e.field === 'm0') && g.enemies.some((e) => e.field === 'm1'), '두 전장에 요괴가 각각 나옴');
  const p = g.players[0];
  p.gold = 1e5;
  for (let i = 0; i < 4; i++) g.command('a', { t: 'summon' });
  assert.ok(g.units.every((u) => u.field === 'm0'));
  // 남의 전장에는 못 둠 (옮기기)
  const s1 = g.autoSpot(1, 'm1');
  assert.strictEqual(typeof g.command('a', { t: 'move', unit: g.units[0].id, tile: [s1.x, s1.y], field: 'm1' }), 'string');
  // 스토리: 웨이브가 모자라면 잠김
  assert.strictEqual(typeof g.command('a', { t: 'story', id: 's1' }), 'string');
  g.wave = 4;
  assert.strictEqual(g.command('a', { t: 'story', id: 's1' }), null);
  assert.ok(g.enemies.some((e) => e.field === 'room' && e.storyBoss === 's1'));
  // 보스방은 둘이 함께: 동료도 시작 중복 불가, 유닛은 둘 다 보낼 수 있음
  assert.strictEqual(typeof g.command('b', { t: 'story', id: 's1' }), 'string');
  g.command('a', { t: 'dispatch', field: 'room', n: 3 });
  assert.strictEqual(g.units.filter((u) => u.field === 'room').length, 1, '보스방에는 한 사람당 한 명');
  // 다른 유닛을 보내면 교대
  const first = g.units.find((u) => u.field === 'room');
  const other = g.units.find((u) => u.owner === 0 && u.field === 'm0');
  g.command('a', { t: 'send', unit: other.id, field: 'room' });
  assert.strictEqual(first.field, 'm0');
  assert.strictEqual(other.field, 'room');
  g.players[1].gold = 1e5;
  g.command('b', { t: 'summon' });
  g.command('b', { t: 'dispatch', field: 'room', n: 1 });
  assert.strictEqual(g.units.filter((u) => u.field === 'room').length, 2);
  // 보스는 고정
  const bx = g.enemies.find((e) => e.storyBoss).x;
  for (let i = 0; i < 40; i++) g.tick();
  assert.strictEqual(g.enemies.find((e) => e.storyBoss).x, bx);
  assert.deepStrictEqual(new Set(g.units.filter((u) => u.field === 'room').map((u) => u.owner)), new Set([0, 1]));
  const boss = g.enemies.find((e) => e.storyBoss);
  g.hurt(boss, boss.hp + 1, g.units.find((u) => u.field === 'room'), { pierce: true });
  assert.deepStrictEqual(g.story.cleared, ['s1']);
  assert.ok(g.players.every((x) => x.items.moonshard === 1), '보상은 둘 다');
  assert.ok(g.units.every((u) => u.field[0] === 'm'), '끝나면 유닛이 돌아옴');
  // 이벤트: 12웨이브에 열림
  g.nextPlan = g.planWave(12);
  g.startWave();
  assert.ok(g.event);
  assert.strictEqual(g.command('a', { t: 'dispatch', field: 'ev', n: 1 }), null);
  const eb = g.enemies.find((e) => e.eventBoss);
  g.hurt(eb, eb.hp + 1, null, { by: 0, pierce: true });
  assert.strictEqual(g.event, null);
  assert.ok(g.players.every((x) => x.items.star === 1));
});

test('화면용 상태는 JSON으로 보낼 수 있다', () => {
  const g = new Game(roster(2, true), { mapId: 'g5', seed: 6 });
  for (let i = 0; i < 600; i++) g.tick();
  const v = JSON.parse(JSON.stringify(g.view()));
  assert.ok(Array.isArray(v.units) && Array.isArray(v.enemies));
  assert.ok(JSON.stringify(g.staticView()).length < 20000);
});
