'use strict';
// 정령 정의. 성장 옵션, 존재 트랙, 특수 규칙, 고유 권능 카드, 내재 권능.
// 성장 행동: reclaimAll(모두 회수), gainCard(권능 카드 획득), energy(n), presence(range)

const SPIRITS = [
  {
    id: 'lightning',
    name: '번개의 신속한 일격',
    en: "Lightning's Swift Strike",
    color: '#f2c94c',
    complexity: '낮음',
    summary: '빠른 공격으로 마을과 도시를 부숩니다. 공기 원소로 느린 권능을 빠르게 사용합니다.',
    growth: [
      { actions: [{ type: 'reclaimAll' }, { type: 'gainCard' }, { type: 'energy', n: 1 }] },
      { actions: [{ type: 'presence', range: 1 }, { type: 'presence', range: 1 }] },
      { actions: [{ type: 'presence', range: 1 }, { type: 'energy', n: 3 }] },
    ],
    energyTrack: [1, 1, 2, 2, 3, 4, 4, 5],
    cardTrack: [2, 3, 4, 5, 6],
    special: { name: '번개의 신속함', text: '공기 원소 1개당, 이번 턴에 느린 권능 1개를 빠른 권능처럼 사용할 수 있습니다.' },
    setup: [{ terrain: 'S', count: 2 }],
    setupText: '자기 보드에서 번호가 가장 큰 사막에 존재 2개',
    uniques: ['harbingers', 'lightnings_boon', 'raging_storm', 'shatter_homesteads'],
    innates: [
      {
        id: 'thundering_destruction', name: '천둥의 파괴', speed: 'slow', target: { kind: 'land', from: 'sacred', range: 1, filter: 'any' },
        levels: [
          { el: { fire: 3, air: 2 }, text: '마을/도시 1개를 파괴합니다.' },
          { el: { fire: 4, air: 3 }, text: '마을/도시 1개를 추가로 파괴합니다.' },
          { el: { fire: 5, air: 4, water: 1 }, text: '마을/도시 1개를 추가로 파괴합니다.' },
          { el: { fire: 5, air: 5, water: 2 }, text: '마을/도시 1개를 추가로 파괴합니다.' },
        ],
        async effect(ctx, n) { await ctx.destroy(['city', 'town'], n); },
      },
    ],
  },
  {
    id: 'river',
    name: '햇살 속에 굽이치는 강',
    en: 'River Surges in Sunlight',
    color: '#56ccf2',
    complexity: '낮음',
    summary: '침략자를 밀어내고 넓게 퍼집니다. 습지의 존재는 성지로 취급됩니다.',
    growth: [
      { actions: [{ type: 'reclaimAll' }, { type: 'gainCard' }, { type: 'energy', n: 1 }] },
      { actions: [{ type: 'presence', range: 1 }, { type: 'presence', range: 1 }] },
      { actions: [{ type: 'gainCard' }, { type: 'presence', range: 2 }] },
    ],
    energyTrack: [1, 2, 2, 3, 4, 4, 5],
    cardTrack: [1, 2, 2, 3, 3, 4, 5],
    special: { name: '강의 영역', text: '습지에 있는 당신의 존재는 성지(신성한 장소)로 취급됩니다.' },
    setup: [{ terrain: 'W', count: 1 }],
    setupText: '자기 보드에서 번호가 가장 큰 습지에 존재 1개',
    uniques: ['boon_of_vigor', 'flash_floods', 'rivers_bounty', 'wash_away'],
    innates: [
      {
        id: 'massive_flooding', name: '대홍수', speed: 'slow', target: { kind: 'land', from: 'sacred', range: 1, filter: 'invaders' },
        levels: [
          { el: { sun: 1, water: 2 }, text: '탐험가/마을 1개를 밀어냅니다.' },
          { el: { sun: 2, water: 3 }, text: '대신, 피해 2 후 탐험가/마을을 최대 3개 밀어냅니다.' },
          { el: { sun: 3, water: 4, earth: 1 }, text: '대신, 모든 침략자에게 각각 피해 2.' },
        ],
        async effect(ctx, n) {
          if (n >= 3) ctx.damageEach(2, ['explorer', 'town', 'city']);
          else if (n === 2) { ctx.damage(2); await ctx.push(['explorer', 'town'], 3); } else await ctx.push(['explorer', 'town'], 1, false);
        },
      },
    ],
  },
  {
    id: 'earth',
    name: '대지의 활력',
    en: 'Vital Strength of the Earth',
    color: '#9b6a3c',
    complexity: '낮음',
    summary: '단단한 방어로 땅을 지킵니다. 성지에는 언제나 방어 3이 적용됩니다.',
    growth: [
      { actions: [{ type: 'reclaimAll' }, { type: 'presence', range: 2 }] },
      { actions: [{ type: 'gainCard' }, { type: 'presence', range: 0 }] },
      { actions: [{ type: 'presence', range: 1 }, { type: 'energy', n: 2 }] },
    ],
    energyTrack: [2, 3, 4, 6, 7, 8],
    cardTrack: [1, 1, 2, 2, 3, 4],
    special: { name: '대지의 생명력', text: '당신의 성지가 있는 모든 지역에 방어 3.' },
    setup: [{ terrain: 'M', count: 2 }, { terrain: 'J', count: 1 }],
    setupText: '자기 보드에서 번호가 가장 큰 산에 존재 2개, 가장 큰 정글에 존재 1개',
    uniques: ['guard_healing_land', 'perfect_stillness', 'rituals_destruction', 'draw_fruitful_earth'],
    innates: [
      {
        id: 'gift_of_strength', name: '힘의 선물', speed: 'fast', target: { kind: 'spirit', filter: 'any' },
        levels: [
          { el: { sun: 1, earth: 2, plant: 2 }, text: '대상 정령은 이번 턴에 비용 1 이하 권능 카드 1장을 한 번 더 사용할 수 있습니다.' },
          { el: { sun: 2, earth: 3, plant: 2 }, text: '대신 비용 3 이하.' },
          { el: { sun: 2, earth: 4, plant: 3 }, text: '대신 비용 6 이하.' },
        ],
        async effect(ctx, n) {
          const maxCost = [1, 3, 6][n - 1];
          ctx.target.repeats.push({ maxCost });
          ctx.log(`${ctx.targetName}: 비용 ${maxCost} 이하 카드 1장 반복 사용 가능`);
        },
      },
    ],
  },
  {
    id: 'shadows',
    name: '불꽃처럼 일렁이는 그림자',
    en: 'Shadows Flicker Like Flame',
    color: '#9b51e0',
    complexity: '낮음',
    summary: '공포로 침략자를 몰아냅니다. 에너지 1을 내면 다한이 있는 어느 지역이든 대상으로 삼을 수 있습니다.',
    growth: [
      { actions: [{ type: 'reclaimAll' }, { type: 'gainCard' }] },
      { actions: [{ type: 'gainCard' }, { type: 'presence', range: 1 }] },
      { actions: [{ type: 'presence', range: 3 }, { type: 'energy', n: 3 }] },
    ],
    energyTrack: [0, 1, 3, 4, 5, 6],
    cardTrack: [1, 2, 3, 3, 4, 5],
    special: { name: '다한의 그림자', text: '권능을 사용할 때 에너지 1을 지불하면, 사거리와 상관없이 다한이 있는 지역을 대상으로 삼을 수 있습니다.' },
    setup: [{ terrain: 'J', count: 1 }, { num: 5, count: 1 }],
    setupText: '자기 보드에서 번호가 가장 큰 정글에 존재 1개, 5번 지역에 존재 1개',
    uniques: ['mantle_of_dread', 'favors_called_due', 'crops_wither', 'concealing_shadows'],
    innates: [
      {
        id: 'darkness_swallows', name: '방심한 자를 삼키는 어둠', speed: 'fast', target: { kind: 'land', from: 'presence', range: 1, filter: 'any' },
        levels: [
          { el: { moon: 2, fire: 1 }, text: '탐험가 1개를 모읍니다.' },
          { el: { moon: 3, fire: 2 }, text: '탐험가를 최대 2개 파괴합니다. 파괴한 탐험가 1개당 공포 1.' },
          { el: { moon: 4, fire: 3, air: 2 }, text: '피해 3. 이 피해로 파괴된 침략자 1개당 공포 1.' },
        ],
        async effect(ctx, n) {
          await ctx.gather(['explorer'], 1, false);
          if (n >= 2) { const k = ctx.destroy(['explorer'], 2); if (k) ctx.fear(k); }
          if (n >= 3) { const r = ctx.damage(3); if (r.count) ctx.fear(r.count); }
        },
      },
    ],
  },
];

const SPIRIT_MAP = Object.fromEntries(SPIRITS.map((s) => [s.id, s]));

module.exports = { SPIRITS, SPIRIT_MAP };
