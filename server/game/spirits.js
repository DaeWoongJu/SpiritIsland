'use strict';
// 정령 정의. 성장 옵션, 존재 트랙, 특수 규칙, 고유 권능 카드, 내재 권능.
// 성장 행동: reclaimAll(모두 회수), gainCard(권능 카드 획득), energy(n), presence(range)

const SPIRITS = [
  {
    id: 'lightning',
    exp: 'base',
    name: '번개의 신속한 일격',
    en: "Lightning's Swift Strike",
    color: '#f2c94c',
    complexity: '낮음',
    summary: '빠른 공격으로 마을과 도시를 부숩니다. 공기 원소로 느린 권능을 빠르게 사용합니다.',
    tip: '마을과 도시를 빠르게 파괴하는 공격수입니다. 공기 원소가 있는 카드를 내면 느린 권능도 침략자보다 먼저 쓸 수 있어요.',
    airFast: true,
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
    exp: 'base',
    name: '햇살 속에 굽이치는 강',
    en: 'River Surges in Sunlight',
    color: '#56ccf2',
    complexity: '낮음',
    summary: '침략자를 밀어내고 넓게 퍼집니다. 습지의 존재는 성지로 취급됩니다.',
    tip: '침략자를 밀어내 약탈을 막는 역할입니다. 습지에 존재를 두면 바로 성지가 되어 강한 권능을 쓸 수 있어요.',
    sacredTerrain: 'W',
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
    exp: 'base',
    name: '대지의 활력',
    en: 'Vital Strength of the Earth',
    color: '#9b6a3c',
    complexity: '낮음',
    summary: '단단한 방어로 땅을 지킵니다. 성지에는 언제나 방어 3이 적용됩니다.',
    tip: '성지가 있는 땅은 방어 3이 적용되어 잘 무너지지 않습니다. 초보자에게 가장 쉬운 정령입니다.',
    sacredDefend: 3,
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
    exp: 'base',
    name: '불꽃처럼 일렁이는 그림자',
    en: 'Shadows Flicker Like Flame',
    color: '#9b51e0',
    complexity: '낮음',
    summary: '공포로 침략자를 몰아냅니다. 에너지 1을 내면 다한이 있는 어느 지역이든 대상으로 삼을 수 있습니다.',
    tip: '공포를 많이 만들어 승리를 앞당깁니다. 에너지 1을 내면 멀리 있는 다한 지역도 노릴 수 있어요.',
    dahanReach: true,
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
  {
    id: 'thunder',
    exp: 'base',
    name: '천둥의 대변자',
    en: 'Thunderspeaker',
    color: '#e2853a',
    complexity: '보통',
    summary: '섬의 원주민 다한과 함께 싸웁니다. 다한이 많은 곳에서 강력합니다.',
    tip: '다한(원주민)이 많은 지역 근처에 존재를 두고, 다한을 모아 침략자를 함께 공격하세요.',
    counterBonus: 1,
    growth: [
      { actions: [{ type: 'reclaimAll' }, { type: 'gainCard' }] },
      { actions: [{ type: 'presence', range: 2 }, { type: 'presence', range: 1 }] },
      { actions: [{ type: 'presence', range: 1 }, { type: 'energy', n: 4 }] },
    ],
    energyTrack: [1, 2, 2, 3, 4, 4, 5],
    cardTrack: [1, 2, 2, 3, 3, 4],
    special: { name: '다한의 맹우', text: '당신의 존재가 있는 지역의 다한은 반격할 때 1개당 피해 1을 더 줍니다.' },
    setup: [{ mostDahan: 2 }],
    setupText: '자기 보드에서 다한이 가장 많은 두 지역에 존재 1개씩',
    uniques: ['manifestation_glory', 'sudden_ambush', 'words_of_warning', 'voice_of_thunder'],
    innates: [
      {
        id: 'lead_assault', name: '맹렬한 돌격 지휘', speed: 'fast', target: { kind: 'land', from: 'presence', range: 1, filter: 'dahan' },
        levels: [
          { el: { sun: 2, fire: 1 }, text: '다한 2개당 마을 1개를 파괴합니다.' },
          { el: { sun: 4, fire: 3 }, text: '다한 3개당 도시 1개를 추가로 파괴합니다.' },
        ],
        async effect(ctx, n) {
          const d = ctx.count('dahan');
          if (Math.floor(d / 2)) ctx.destroy(['town'], Math.floor(d / 2));
          if (n >= 2 && Math.floor(d / 3)) ctx.destroy(['city'], Math.floor(d / 3));
        },
      },
      {
        id: 'gather_warriors', name: '전사 소집', speed: 'slow', target: { kind: 'land', from: 'presence', range: 1, filter: 'any' },
        levels: [
          { el: { animal: 1 }, text: '다한을 최대 1개 모읍니다.' },
          { el: { air: 2, animal: 2 }, text: '대신 다한을 최대 3개 모읍니다.' },
        ],
        async effect(ctx, n) { await ctx.gather(['dahan'], n >= 2 ? 3 : 1); },
      },
    ],
  },
  {
    id: 'ocean',
    exp: 'base',
    name: '바다의 굶주린 손아귀',
    en: "Ocean's Hungry Grasp",
    color: '#2d6fb8',
    complexity: '보통',
    summary: '해안을 지배하는 바다. 해안에서 침략자를 바다 속으로 끌어들입니다.',
    tip: '존재는 해안 지역에만 둘 수 있습니다. 침략자가 처음 상륙하는 해안을 지키는 역할입니다.',
    bonusWhere: 'coastal',
    growth: [
      { actions: [{ type: 'reclaimAll' }, { type: 'energy', n: 2 }] },
      { actions: [{ type: 'presence', range: 1 }, { type: 'presence', range: 1 }] },
      { actions: [{ type: 'gainCard' }, { type: 'presence', range: 2 }] },
    ],
    energyTrack: [0, 1, 2, 3, 4, 5, 6],
    cardTrack: [1, 2, 2, 3, 4, 5],
    special: { name: '해안의 지배자', text: '존재는 해안 지역에만 추가할 수 있습니다. 해안 지역에서 당신의 권능이 주는 피해는 +1 됩니다(권능마다 한 번).' },
    coastalOnly: true,
    setup: [{ num: 2, count: 1 }, { num: 3, count: 1 }],
    setupText: '자기 보드의 2번, 3번 지역(해안)에 존재 1개씩',
    uniques: ['call_of_deeps', 'grasping_tide', 'swallow_land', 'tidal_boon'],
    innates: [
      {
        id: 'ocean_breaks_shore', name: '해안을 부수는 바다', speed: 'slow', target: { kind: 'land', from: 'presence', range: 0, filter: 'coastal' },
        levels: [
          { el: { water: 2, earth: 1 }, text: '마을 1개를 파괴합니다.' },
          { el: { water: 3, earth: 2 }, text: '대신 마을/도시 2개를 파괴합니다.' },
          { el: { water: 4, earth: 3 }, text: '대신 마을/도시 4개를 파괴합니다.' },
        ],
        async effect(ctx, n) { if (n === 1) ctx.destroy(['town'], 1); else ctx.destroy(['city', 'town'], n === 2 ? 2 : 4); },
      },
      {
        id: 'pound_ships', name: '배를 산산조각 내다', speed: 'fast', target: { kind: 'land', from: 'presence', range: 1, filter: 'coastal' },
        levels: [
          { el: { moon: 1, air: 1, water: 2 }, text: '공포 1.' },
          { el: { moon: 2, air: 1, water: 3 }, text: '공포 +1.' },
          { el: { moon: 3, air: 2, water: 4 }, text: '공포 +2.' },
        ],
        async effect(ctx, n) { ctx.fear([1, 2, 4][n - 1]); },
      },
    ],
  },
  {
    id: 'bringer',
    exp: 'base',
    name: '꿈과 악몽을 부르는 자',
    en: 'Bringer of Dreams and Nightmares',
    color: '#c86bd8',
    complexity: '높음',
    summary: '악몽으로 침략자를 겁줍니다. 직접 죽이지 않고, 모든 피해가 공포로 바뀝니다.',
    tip: '당신의 권능은 침략자를 죽이지 못하지만 공포를 많이 만듭니다. 공포 카드를 빨리 모아 승리 조건을 쉽게 만드는 역할입니다.',
    growth: [
      { actions: [{ type: 'reclaimAll' }, { type: 'gainCard' }] },
      { actions: [{ type: 'gainCard' }, { type: 'presence', range: 1 }] },
      { actions: [{ type: 'presence', range: 3 }, { type: 'energy', n: 2 }] },
    ],
    energyTrack: [2, 3, 3, 4, 4, 5],
    cardTrack: [2, 2, 3, 3, 4, 5],
    special: { name: '꿈의 세계', text: '당신의 권능이 주는 피해와 파괴는 침략자를 죽이지 않고 공포가 됩니다. (피해 1 = 공포 1, 탐험가/마을/도시 파괴 = 공포 1/2/3)' },
    dreamer: true,
    setup: [{ terrain: 'S', count: 2 }],
    setupText: '자기 보드에서 번호가 가장 큰 사막에 존재 2개',
    uniques: ['dreams_of_dahan', 'predatory_nightmares', 'call_midnight', 'dread_apparitions'],
    innates: [
      {
        id: 'night_terrors', name: '밤의 공포', speed: 'fast', target: { kind: 'land', from: 'presence', range: 0, filter: 'invaders' },
        levels: [
          { el: { moon: 1, air: 1 }, text: '공포 1.' },
          { el: { moon: 2, air: 1, animal: 1 }, text: '공포 +1.' },
          { el: { moon: 3, air: 2, animal: 1 }, text: '공포 +1.' },
        ],
        async effect(ctx, n) { ctx.fear(n); },
      },
    ],
  },
  {
    id: 'green',
    exp: 'base',
    name: '만연한 초록',
    en: 'A Spread of Rampant Green',
    color: '#4caf50',
    complexity: '보통',
    summary: '섬 전체로 빠르게 퍼지는 식물. 황폐를 대신 받아내 땅을 지킵니다.',
    tip: '존재를 넓게 퍼뜨리세요. 존재가 있는 곳에 황폐가 생기려 하면 존재 1개가 대신 희생해 땅을 지킵니다.',
    growth: [
      { actions: [{ type: 'reclaimAll' }, { type: 'presence', range: 1 }] },
      { actions: [{ type: 'gainCard' }, { type: 'presence', range: 1 }] },
      { actions: [{ type: 'presence', range: 2 }, { type: 'energy', n: 3 }] },
    ],
    energyTrack: [0, 1, 2, 2, 3, 4, 4, 5],
    cardTrack: [1, 1, 2, 2, 3, 3, 4],
    special: { name: '땅을 뒤덮는 초록', text: '당신의 존재가 있는 지역에 황폐가 추가되려 하면, 대신 그 지역의 당신 존재 1개를 파괴합니다(섬에 존재가 2개 이상일 때).' },
    blightShield: true,
    setup: [{ terrain: 'W', count: 1 }, { terrain: 'J', count: 1 }],
    setupText: '자기 보드에서 번호가 가장 큰 습지와 정글에 존재 1개씩',
    uniques: ['fields_choked', 'gift_proliferation', 'stem_the_flow', 'night_overgrowth'],
    innates: [
      {
        id: 'creepers_tear', name: '석벽을 찢는 덩굴', speed: 'slow', target: { kind: 'land', from: 'presence', range: 0, filter: 'any' },
        levels: [
          { el: { moon: 1, plant: 2 }, text: '마을/도시에 피해 1.' },
          { el: { moon: 2, plant: 3 }, text: '피해 +1.' },
          { el: { moon: 3, plant: 4 }, text: '피해 +2.' },
        ],
        async effect(ctx, n) { ctx.damage([1, 2, 4][n - 1], ['town', 'city']); },
      },
      {
        id: 'all_enveloping', name: '모든 것을 감싸는 초록', speed: 'fast', target: { kind: 'land', from: 'sacred', range: 1, filter: 'any' },
        levels: [
          { el: { water: 1, plant: 3 }, text: '방어 2.' },
          { el: { water: 2, plant: 4 }, text: '대신 방어 4.' },
          { el: { sun: 1, water: 3, plant: 5 }, text: '추가로 황폐 1개를 제거합니다.' },
        ],
        async effect(ctx, n) { ctx.defend(n >= 2 ? 4 : 2); if (n >= 3) ctx.removeBlight(); },
      },
    ],
  },
  {
    id: 'wildfire',
    exp: 'ff',
    name: '들불의 심장',
    en: 'Heart of the Wildfire',
    color: '#e5492d',
    complexity: '높음',
    summary: '모든 것을 태우는 불. 황폐에 강하지만 쓰는 권능이 섬을 상하게 할 수 있습니다.',
    tip: '황폐가 있는 땅에서 더 강합니다. 존재가 황폐로 파괴되지 않으니 위험한 곳에 과감히 들어가세요.',
    bonusWhere: 'blight',
    growth: [
      { actions: [{ type: 'reclaimAll' }, { type: 'gainCard' }, { type: 'energy', n: 1 }] },
      { actions: [{ type: 'presence', range: 2 }, { type: 'energy', n: 1 }] },
      { actions: [{ type: 'gainCard' }, { type: 'presence', range: 1 }] },
    ],
    energyTrack: [0, 1, 2, 2, 3, 4, 5],
    cardTrack: [1, 2, 3, 4, 5],
    special: { name: '타오르는 존재', text: '황폐가 추가되어도 당신의 존재는 파괴되지 않습니다. 황폐가 있는 지역에서 당신의 권능이 주는 피해는 +1 됩니다(권능마다 한 번).' },
    blightImmune: true,
    setup: [{ terrain: 'S', count: 3, blight: 1 }],
    setupText: '자기 보드에서 번호가 가장 큰 사막에 존재 3개와 황폐 1개',
    uniques: ['flash_fires', 'asphyxiating_smoke', 'threatening_flames', 'flames_fury'],
    innates: [
      {
        id: 'firestorm', name: '화염 폭풍', speed: 'slow', target: { kind: 'land', from: 'sacred', range: 1, filter: 'any' },
        levels: [
          { el: { fire: 2 }, text: '불 원소 2개당 피해 1.' },
          { el: { fire: 4, plant: 1 }, text: '마을 1개를 파괴합니다.' },
          { el: { fire: 6, plant: 2 }, text: '모든 침략자에게 각각 피해 1.' },
        ],
        async effect(ctx, n) {
          const fire = ctx.game.elements(ctx.pid).fire || 0;
          ctx.damage(Math.floor(fire / 2));
          if (n >= 2) ctx.destroy(['town'], 1);
          if (n >= 3) ctx.damageEach(1, ['explorer', 'town', 'city']);
        },
      },
    ],
  },
  {
    id: 'keeper',
    exp: 'bc',
    name: '금지된 야생의 수호자',
    en: 'Keeper of the Forbidden Wilds',
    color: '#2e7d4f',
    complexity: '보통',
    summary: '아무도 들어올 수 없는 신성한 숲. 성지에는 침략자가 탐험하지 못합니다.',
    tip: '성지(존재 2개 이상)를 만들어 침략자의 탐험을 막으세요. 강력하지만 비싼 권능을 씁니다.',
    growth: [
      { actions: [{ type: 'reclaimAll' }, { type: 'energy', n: 1 }] },
      { actions: [{ type: 'gainCard' }, { type: 'presence', range: 1 }] },
      { actions: [{ type: 'presence', range: 3 }, { type: 'energy', n: 2 }] },
    ],
    energyTrack: [2, 3, 4, 4, 5, 6, 7],
    cardTrack: [1, 2, 2, 3, 4, 5],
    special: { name: '금지된 땅', text: '침략자는 당신의 성지가 있는 지역으로 탐험하지 않습니다.' },
    forbidExplore: true,
    setup: [{ terrain: 'J', count: 2 }],
    setupText: '자기 보드에서 번호가 가장 큰 정글에 존재 2개 (성지)',
    uniques: ['regrow_roots', 'sacrosanct_wilderness', 'boon_growing_power', 'towering_wrath'],
    innates: [
      {
        id: 'punish_trespass', name: '침입자에게 벌을', speed: 'fast', target: { kind: 'land', from: 'sacred', range: 1, filter: 'invaders' },
        levels: [
          { el: { sun: 2, fire: 1, plant: 2 }, text: '피해 2.' },
          { el: { sun: 2, fire: 2, plant: 3 }, text: '피해 +2.' },
          { el: { sun: 3, fire: 3, plant: 4 }, text: '피해 +2.' },
        ],
        async effect(ctx, n) { ctx.damage(2 * n); },
      },
    ],
  },
  {
    id: 'stone',
    exp: 'je',
    name: '굴하지 않는 바위',
    en: "Stone's Unyielding Defiance",
    color: '#8d8a84',
    complexity: '낮음',
    summary: '움직이지 않는 단단한 바위. 존재가 쌓인 곳은 거의 무너지지 않습니다.',
    tip: '존재를 한 곳에 여러 개 쌓을수록 그 땅의 방어가 올라갑니다. 중요한 지역을 버티는 탱커 역할입니다.',
    growth: [
      { actions: [{ type: 'reclaimAll' }, { type: 'gainCard' }] },
      { actions: [{ type: 'presence', range: 0 }, { type: 'energy', n: 2 }] },
      { actions: [{ type: 'gainCard' }, { type: 'presence', range: 2 }] },
    ],
    energyTrack: [2, 2, 3, 4, 4, 5],
    cardTrack: [1, 2, 2, 3, 3, 4],
    special: { name: '꿋꿋한 바위', text: '당신의 존재가 있는 지역은 존재 1개당 방어 1을 얻습니다.' },
    presenceDefend: 1,
    setup: [{ terrain: 'M', count: 2 }, { terrain: 'S', count: 1 }],
    setupText: '자기 보드에서 번호가 가장 큰 산에 존재 2개, 가장 큰 사막에 존재 1개',
    uniques: ['jagged_shards', 'stubborn_solidity', 'plows_shatter', 'scarred_stony_land'],
    innates: [
      {
        id: 'unyielding_defiance', name: '굴하지 않는 저항', speed: 'fast', target: { kind: 'land', from: 'presence', range: 1, filter: 'any' },
        levels: [
          { el: { earth: 2 }, text: '방어 3.' },
          { el: { earth: 3, animal: 1 }, text: '대신 방어 6, 피해 1.' },
          { el: { earth: 5, animal: 2 }, text: '대신 방어 9, 피해 3.' },
        ],
        async effect(ctx, n) { ctx.defend(3 * n); if (n >= 2) ctx.damage(n === 2 ? 1 : 3); },
      },
    ],
  },
  {
    id: 'volcano',
    exp: 'je',
    name: '높이 솟은 화산',
    en: 'Volcano Looming High',
    color: '#b23a1f',
    complexity: '보통',
    summary: '섬의 화산. 존재가 파괴되면 폭발해 주변 침략자를 휩쓸어 버립니다.',
    tip: '존재를 한 곳에 쌓아 두면 황폐 등으로 파괴될 때 분출해 침략자에게 큰 피해를 줍니다.',
    growth: [
      { actions: [{ type: 'reclaimAll' }, { type: 'gainCard' }] },
      { actions: [{ type: 'presence', range: 1 }, { type: 'energy', n: 3 }] },
      { actions: [{ type: 'presence', range: 0 }, { type: 'presence', range: 1 }] },
    ],
    energyTrack: [1, 2, 3, 4, 5, 6],
    cardTrack: [1, 2, 2, 3, 3, 4],
    special: { name: '분출', text: '당신의 존재가 파괴될 때마다, 그 지역의 침략자에게 존재 1개당 피해 2를 줍니다.' },
    erupts: true,
    setup: [{ terrain: 'M', count: 2 }],
    setupText: '자기 보드에서 번호가 가장 큰 산에 존재 2개',
    uniques: ['exaltation_molten', 'lava_flows', 'pyroclastic_bombardment', 'rain_of_ash'],
    innates: [
      {
        id: 'explosive_eruption', name: '폭발적 분화', speed: 'slow', target: { kind: 'land', from: 'sacred', range: 0, filter: 'any' },
        levels: [
          { el: { fire: 2, earth: 2 }, text: '피해 2.' },
          { el: { fire: 3, earth: 3 }, text: '피해 +2, 공포 1.' },
          { el: { fire: 4, earth: 4, air: 1 }, text: '피해 +2, 공포 +1.' },
        ],
        async effect(ctx, n) { ctx.damage(2 * n); if (n >= 2) ctx.fear(n - 1); },
      },
    ],
  },

];

const { SPIRITS_EXT, EXPANSIONS } = require('./spirits_ext');
SPIRITS.push(...SPIRITS_EXT);

const SPIRIT_MAP = Object.fromEntries(SPIRITS.map((s) => [s.id, s]));

module.exports = { SPIRITS, SPIRIT_MAP, EXPANSIONS };
