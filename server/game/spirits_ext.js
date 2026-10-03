'use strict';
// 확장판(DLC) 정령. exp: bc=가지와 발톱, ff=깃털과 불꽃(프로모 1·2), je=들쭉날쭉한 대지, hz=정령섬의 지평선, ni=자연의 화신
// 특수 규칙은 game.js 가 지원하는 정령 특성(trait)으로 표현한다.

const R = { type: 'reclaimAll' };
const G = { type: 'gainCard' };
const E = (n) => ({ type: 'energy', n });
const P = (range) => ({ type: 'presence', range });
const grow = (...opts) => opts.map((actions) => ({ actions }));

const GROWTH = {
  A: grow([R, G], [G, P(1)], [P(2), E(2)]),
  B: grow([R, G, E(1)], [P(1), P(1)], [P(1), E(3)]),
  C: grow([R, P(1)], [G, P(1)], [P(2), E(3)]),
  D: grow([R, E(2)], [P(1), P(2)], [G, P(1), E(1)]),
};
const TRACK = {
  A: { energyTrack: [1, 2, 2, 3, 4, 5], cardTrack: [1, 2, 2, 3, 3, 4] },
  B: { energyTrack: [0, 1, 2, 3, 4, 5, 6], cardTrack: [2, 2, 3, 3, 4, 5] },
  C: { energyTrack: [2, 3, 3, 4, 5, 6], cardTrack: [1, 1, 2, 2, 3, 4] },
  D: { energyTrack: [1, 1, 2, 3, 3, 4, 5], cardTrack: [1, 2, 3, 3, 4, 5] },
};
const lvl = (el, text) => ({ el, text });
const LAND = (from, range, filter = 'any') => ({ kind: 'land', from, range, filter });

function spirit(o) {
  return { growth: GROWTH[o.g], ...TRACK[o.t], ...o };
}

const SPIRITS_EXT = [
  // ───────── 가지와 발톱 ─────────
  spirit({
    id: 'fangs', exp: 'bc', name: '잎사귀 뒤의 날카로운 송곳니', en: 'Sharp Fangs Behind the Leaves', color: '#a0522d', complexity: '보통',
    summary: '정글에 숨은 맹수들. 정글에서 침략자를 사냥합니다.', tip: '정글 근처에 자리 잡고, 정글의 침략자를 집중적으로 노리세요.',
    g: 'A', t: 'A', bonusWhere: 'J', special: { name: '정글의 사냥꾼', text: '정글에서 당신의 권능이 주는 피해는 +1 됩니다(권능마다 한 번).' },
    setup: [{ terrain: 'J', count: 2 }], setupText: '번호가 가장 큰 정글에 존재 2개',
    uniques: ['prey_on_builders', 'teeth_gleam', 'terrifying_chase', 'too_near_jungle'],
    innates: [{
      id: 'ranging_hunt', name: '사냥터를 누비다', speed: 'fast', target: LAND('presence', 1, 'invaders'),
      levels: [lvl({ animal: 2 }, '피해 1.'), lvl({ animal: 3, plant: 1 }, '피해 +2.'), lvl({ animal: 4, plant: 2 }, '피해 +2, 공포 1.')],
      async effect(ctx, n) { ctx.damage([1, 3, 5][n - 1]); if (n >= 3) ctx.fear(1); },
    }],
  }),

  // ───────── 깃털과 불꽃 (프로모 1·2) ─────────
  spirit({
    id: 'serpent', exp: 'ff', name: '섬 아래 잠든 뱀', en: 'Serpent Slumbering Beneath the Island', color: '#6b8e23', complexity: '높음',
    summary: '섬 깊은 곳에서 잠든 거대한 뱀. 성지가 늘수록 깨어나 강해집니다.', tip: '초반에는 약하지만 성지를 늘릴수록 매 턴 에너지가 늘어납니다. 존재를 쌓아 성지를 만드세요.',
    g: 'C', t: 'B', energyPerSacred: true, special: { name: '깊은 잠', text: '당신의 성지 1개당 매 턴 에너지 +1 (최대 3).' },
    setup: [{ terrain: 'W', count: 1 }, { terrain: 'M', count: 1 }], setupText: '번호가 가장 큰 습지와 산에 존재 1개씩',
    uniques: ['absorb_essence', 'gift_flowing_power', 'primordial_deeps', 'elemental_aegis'],
    innates: [{
      id: 'serpent_wakes', name: '뱀이 깨어나다', speed: 'slow', target: LAND('presence', 1),
      levels: [lvl({ earth: 2, fire: 1 }, '피해 2.'), lvl({ earth: 4, fire: 2, water: 2 }, '피해 +3, 공포 1.'), lvl({ earth: 6, fire: 3, water: 3 }, '모든 침략자에게 각각 피해 2.')],
      async effect(ctx, n) { if (n >= 3) ctx.damageEach(2, ['explorer', 'town', 'city']); else { ctx.damage(n === 2 ? 5 : 2); if (n === 2) ctx.fear(1); } },
    }],
  }),
  spirit({
    id: 'downpour', exp: 'ff', name: '세상을 적시는 폭우', en: 'Downpour Drenches the World', color: '#4a90c2', complexity: '보통',
    summary: '섬을 흠뻑 적시는 비. 습지가 성지가 되고, 습지에서 강합니다.', tip: '습지에 존재를 두면 바로 성지가 됩니다. 습지 주변에서 싸우세요.',
    g: 'D', t: 'A', sacredTerrain: 'W', bonusWhere: 'W', special: { name: '젖은 땅', text: '습지의 존재는 성지로 취급되고, 습지에서 권능 피해 +1 (권능마다 한 번).' },
    setup: [{ terrain: 'W', count: 1 }, { num: 5, count: 1 }], setupText: '번호가 가장 큰 습지와 5번 지역에 존재 1개씩',
    uniques: ['stinging_rain', 'foundations_sink', 'gift_abundance', 'unbearable_deluge'],
    innates: [{
      id: 'pour_down', name: '쏟아지는 비', speed: 'slow', target: LAND('presence', 1),
      levels: [lvl({ water: 2 }, '탐험가/마을 1개를 밀어냅니다.'), lvl({ water: 4, air: 1 }, '피해 2.'), lvl({ water: 6, air: 2 }, '피해 +2, 황폐 1개 제거.')],
      async effect(ctx, n) { await ctx.push(['explorer', 'town'], 1, false); if (n >= 2) ctx.damage(n >= 3 ? 4 : 2); if (n >= 3) ctx.removeBlight(); },
    }],
  }),
  spirit({
    id: 'finder', exp: 'ff', name: '보이지 않는 길을 찾는 자', en: 'Finder of Paths Unseen', color: '#b8a77a', complexity: '높음',
    summary: '숨은 길을 아는 정령. 모든 권능이 더 멀리 닿습니다.', tip: '사거리가 길어서 섬 어디든 도울 수 있습니다. 친구가 위험한 곳을 지원하세요.',
    g: 'D', t: 'D', rangeBonus: 1, special: { name: '숨은 길', text: '당신의 모든 권능은 사거리 +1.' },
    setup: [{ num: 5, count: 1 }, { terrain: 'S', count: 1 }], setupText: '5번 지역과 번호가 가장 큰 사막에 존재 1개씩',
    uniques: ['aid_spirit_speakers', 'paths_tied', 'circuitous_journey', 'trails_reconnect'],
    innates: [{
      id: 'travel_paths', name: '길을 따라 이끌다', speed: 'fast', target: LAND('presence', 2),
      levels: [lvl({ air: 2, moon: 1 }, '탐험가 1개를 밀어냅니다.'), lvl({ air: 3, moon: 2 }, '공포 2.'), lvl({ air: 4, moon: 3, water: 1 }, '마을 1개를 밀어내고 공포 +1.')],
      async effect(ctx, n) { await ctx.push(['explorer'], 1, false); if (n >= 2) ctx.fear(n >= 3 ? 3 : 2); if (n >= 3) await ctx.push(['town'], 1, false); },
    }],
  }),

  // ───────── 들쭉날쭉한 대지 ─────────
  spirit({
    id: 'trickster', exp: 'je', name: '씨익 웃는 사기꾼', en: 'Grinning Trickster Stirs Up Trouble', color: '#e6b422', complexity: '보통',
    summary: '혼란을 일으키는 장난꾼. 예측할 수 없는 효과로 침략자를 골탕 먹입니다.', tip: '침략자가 약탈하면 오히려 공포가 쌓입니다. 내재 권능은 무작위 효과라 재미있어요.',
    g: 'B', t: 'A', ravageFear: true, special: { name: '소동', text: '당신의 존재가 있는 지역이 약탈당할 때마다 공포 1 (턴당 최대 2).' },
    setup: [{ terrain: 'S', count: 1 }, { terrain: 'J', count: 1 }], setupText: '번호가 가장 큰 사막과 정글에 존재 1개씩',
    uniques: ['impersonate_authority', 'inciting_whispers', 'overenthusiastic_arson', 'unexpected_tigers'],
    innates: [{
      id: 'lets_see', name: '어디 한번 볼까?', speed: 'fast', target: LAND('presence', 1, 'invaders'),
      levels: [lvl({ moon: 1, fire: 1, air: 1 }, '무작위 효과 1개 (피해 2 / 공포 2 / 탐험가·마을 2개 밀어내기).'), lvl({ moon: 2, fire: 2, air: 2 }, '무작위 효과 1개 더.')],
      async effect(ctx, n) {
        for (let i = 0; i < n; i++) {
          const r = Math.floor(ctx.game.rand() * 3);
          ctx.log(`어디 한번 볼까? → ${['피해 2', '공포 2', '밀어내기'][r]}`);
          if (r === 0) ctx.damage(2); else if (r === 1) ctx.fear(2); else await ctx.push(['explorer', 'town'], 2);
        }
      },
    }],
  }),
  spirit({
    id: 'lure', exp: 'je', name: '깊은 황야의 유혹', en: 'Lure of the Deep Wilderness', color: '#3b6b3b', complexity: '보통',
    summary: '섬 깊은 곳으로 침략자를 꾀어내 사라지게 합니다.', tip: '존재는 내륙에만 둘 수 있습니다. 성지에 들어온 탐험가는 사라지니, 탐험가를 끌어들이세요.',
    g: 'C', t: 'A', inlandOnly: true, explorerBane: true, special: { name: '깊은 황야', text: '존재는 내륙 지역에만 추가할 수 있습니다. 당신의 성지에 도착한 탐험가는 사라집니다.' },
    setup: [{ num: 8, count: 2 }], setupText: '8번 지역(내륙)에 존재 2개',
    uniques: ['gift_untamed_wild', 'perils_deepest', 'beckon_inward', 'swallowed_wilderness'],
    innates: [{
      id: 'never_heard', name: '다시는 소식이 없었다', speed: 'fast', target: LAND('presence', 0, 'invaders'),
      levels: [lvl({ plant: 1, air: 1 }, '탐험가 1개를 파괴합니다.'), lvl({ plant: 3, air: 2, animal: 1 }, '탐험가 2개 추가 파괴, 공포 1.'), lvl({ plant: 4, air: 3, animal: 2 }, '마을 1개 파괴.')],
      async effect(ctx, n) { ctx.destroy(['explorer'], n >= 2 ? 3 : 1); if (n >= 2) ctx.fear(1); if (n >= 3) ctx.destroy(['town'], 1); },
    }],
  }),
  spirit({
    id: 'manyminds', exp: 'je', name: '하나처럼 움직이는 무리', en: 'Many Minds Move as One', color: '#d9a066', complexity: '보통',
    summary: '수많은 새와 짐승의 무리. 성지 주변의 침략자를 끊임없이 괴롭힙니다.', tip: '성지를 여러 곳에 만들고, 그곳에 침략자가 있으면 매 턴 공포가 쌓입니다.',
    g: 'A', t: 'D', fearPerSacred: true, special: { name: '무리의 경계', text: '침략자 단계마다, 침략자가 있는 당신의 성지 1개당 공포 1 (최대 2).' },
    setup: [{ terrain: 'S', count: 2 }], setupText: '번호가 가장 큰 사막에 존재 2개',
    uniques: ['swarming_bedevilment', 'ever_multiplying', 'feathered_wings', 'pursue_stings'],
    innates: [{
      id: 'swarm_flies', name: '무리가 날아오르다', speed: 'fast', target: LAND('presence', 1),
      levels: [lvl({ air: 2, animal: 2 }, '공포 1, 탐험가 1개 밀어내기.'), lvl({ air: 3, animal: 3 }, '피해 2.'), lvl({ air: 4, animal: 4 }, '공포 +2.')],
      async effect(ctx, n) { ctx.fear(n >= 3 ? 3 : 1); await ctx.push(['explorer'], 1, false); if (n >= 2) ctx.damage(2); },
    }],
  }),
  spirit({
    id: 'memory', exp: 'je', name: '변화하는 시대의 기억', en: 'Shifting Memory of Ages', color: '#8e7cc3', complexity: '높음',
    summary: '섬의 오랜 기억. 많은 지식으로 더 좋은 권능을 고릅니다.', tip: '권능 카드를 얻을 때 6장 중에서 고를 수 있습니다. 카드를 자주 얻어 상황에 맞게 쓰세요.',
    g: 'A', t: 'C', cardDraw: 6, special: { name: '고대의 기억', text: '권능 카드를 얻을 때 4장 대신 6장 중에서 1장을 고릅니다.' },
    setup: [{ terrain: 'M', count: 1 }, { num: 5, count: 1 }], setupText: '번호가 가장 큰 산과 5번 지역에 존재 1개씩',
    uniques: ['boon_ancient_memories', 'elemental_teachings', 'share_survival', 'study_fears'],
    innates: [{
      id: 'learn_invaders', name: '침략자를 배우다', speed: 'slow', target: LAND('presence', 1, 'invaders'),
      levels: [lvl({ moon: 2, earth: 1 }, '공포 1.'), lvl({ moon: 3, earth: 2 }, '공포 +1, 방어 3.'), lvl({ moon: 4, earth: 3, air: 1 }, '마을 1개 파괴.')],
      async effect(ctx, n) { ctx.fear(n >= 2 ? 2 : 1); if (n >= 2) ctx.defend(3); if (n >= 3) ctx.destroy(['town'], 1); },
    }],
  }),
  spirit({
    id: 'mist', exp: 'je', name: '고요한 안개의 장막', en: 'Shroud of Silent Mist', color: '#b0c4de', complexity: '보통',
    summary: '섬을 감싸는 짙은 안개. 성지에서는 침략자가 아무것도 지을 수 없습니다.', tip: '성지를 만들어 침략자의 건설을 막으세요. 특히 마을이 많은 지역 근처가 좋아요.',
    g: 'D', t: 'A', noBuildSacred: true, special: { name: '짙은 안개', text: '침략자는 당신의 성지가 있는 지역에 건설하지 못합니다.' },
    setup: [{ terrain: 'W', count: 2 }], setupText: '번호가 가장 큰 습지에 존재 2개',
    uniques: ['dissolving_vapors', 'fog_closes_in', 'silent_forms', 'unnerving_pall'],
    innates: [{
      id: 'suffocating_shroud', name: '숨막히는 장막', speed: 'slow', target: LAND('presence', 0, 'invaders'),
      levels: [lvl({ water: 2, air: 1 }, '탐험가 1개를 파괴합니다.'), lvl({ water: 3, air: 2, moon: 1 }, '마을/도시에 피해 2.'), lvl({ water: 4, air: 3, moon: 2 }, '마을/도시에 피해 +3, 공포 2.')],
      async effect(ctx, n) { ctx.destroy(['explorer'], 1); if (n >= 2) ctx.damage(n >= 3 ? 5 : 2, ['town', 'city']); if (n >= 3) ctx.fear(2); },
    }],
  }),
  spirit({
    id: 'starlight', exp: 'je', name: '형태를 찾는 별빛', en: 'Starlight Seeks Its Form', color: '#9fb4ff', complexity: '높음',
    summary: '아직 모습이 정해지지 않은 별빛. 매 턴 카드를 더 많이 낼 수 있습니다.', tip: '매 턴 카드를 1장 더 낼 수 있으니 권능 카드를 많이 모아 두세요.',
    g: 'A', t: 'B', extraCard: 1, special: { name: '무한한 가능성', text: '매 턴 권능 카드를 1장 더 낼 수 있습니다.' },
    setup: [{ num: 5, count: 1 }, { terrain: 'M', count: 1 }], setupText: '5번 지역과 번호가 가장 큰 산에 존재 1개씩',
    uniques: ['boon_reimagining', 'gather_starlight', 'peace_nighttime', 'shape_self'],
    innates: [{
      id: 'light_of_stars', name: '별의 빛', speed: 'slow', target: LAND('presence', 1),
      levels: [lvl({ moon: 2 }, '공포 1.'), lvl({ moon: 3, air: 2 }, '피해 2.'), lvl({ moon: 4, air: 3, water: 1 }, '피해 +2, 공포 +1.')],
      async effect(ctx, n) { ctx.fear(n >= 3 ? 2 : 1); if (n >= 2) ctx.damage(n >= 3 ? 4 : 2); },
    }],
  }),
  spirit({
    id: 'fractured', exp: 'je', name: '하늘을 가르는 조각난 나날', en: 'Fractured Days Split the Sky', color: '#c0a0d0', complexity: '높음',
    summary: '시간을 조각내는 정령. 시간을 멈추거나 되돌립니다.', tip: '매 턴 에너지를 1 더 받습니다. 시간 정지 카드로 위험한 약탈을 통째로 막으세요.',
    g: 'D', t: 'D', energyBonus: 1, special: { name: '흩어진 시간', text: '매 턴 에너지를 1 더 얻습니다.' },
    setup: [{ terrain: 'J', count: 1 }, { terrain: 'S', count: 1 }], setupText: '번호가 가장 큰 정글과 사막에 존재 1개씩',
    uniques: ['absolute_stasis', 'blur_arc_years', 'pour_time_sideways', 'past_returns'],
    innates: [{
      id: 'shatter_moments', name: '순간을 산산이', speed: 'fast', target: LAND('presence', 1),
      levels: [lvl({ moon: 2, air: 1 }, '방어 2.'), lvl({ moon: 3, air: 2 }, '이번 턴 이 지역에서 건설하지 않습니다.'), lvl({ moon: 4, air: 3, sun: 1 }, '대신 모든 행동을 건너뜁니다.')],
      async effect(ctx, n) { ctx.defend(2); if (n === 2) { ctx.land.flags.skipBuild = true; ctx.log(`${ctx.landId}: 이번 턴 건설하지 않음`); } if (n >= 3) ctx.skipActions(); },
    }],
  }),
  spirit({
    id: 'vengeance', exp: 'je', name: '불타는 역병 같은 복수', en: 'Vengeance as a Burning Plague', color: '#8b1e3f', complexity: '보통',
    summary: '땅을 망친 자에게 내리는 역병. 황폐가 생길수록 분노합니다.', tip: '황폐가 있는 땅에서 더 강하고, 존재가 있는 곳에 황폐가 생기면 공포가 생깁니다.',
    g: 'B', t: 'D', bonusWhere: 'blight', blightFear: true, special: { name: '땅의 복수', text: '당신의 존재가 있는 지역에 황폐가 추가되면 공포 1. 황폐 지역에서 권능 피해 +1 (권능마다 한 번).' },
    setup: [{ terrain: 'M', count: 1 }, { terrain: 'W', count: 1 }], setupText: '번호가 가장 큰 산과 습지에 존재 1개씩',
    uniques: ['fiery_vengeance', 'fetid_breath', 'plaguebearers', 'strike_fevers'],
    innates: [{
      id: 'wreak_vengeance', name: '복수를 내리다', speed: 'slow', target: LAND('sacred', 1, 'invaders'),
      levels: [lvl({ fire: 2, animal: 1 }, '황폐 1개당 공포 1 (최소 1, 최대 3).'), lvl({ fire: 3, animal: 2 }, '황폐 1개당 피해 1 (최소 1).'), lvl({ fire: 4, animal: 3, water: 1 }, '모든 침략자에게 각각 피해 1.')],
      async effect(ctx, n) { const b = Math.max(1, ctx.count('blight')); ctx.fear(Math.min(3, b)); if (n >= 2) ctx.damage(b); if (n >= 3) ctx.damageEach(1, ['explorer', 'town', 'city']); },
    }],
  }),

  // ───────── 정령섬의 지평선 ─────────
  spirit({
    id: 'teeth', exp: 'hz', name: '발밑에 도사린 이빨', en: 'Devouring Teeth Lurk Underfoot', color: '#7a3b2e', complexity: '낮음',
    summary: '땅속에서 입을 벌린 굶주린 대지. 모든 권능이 한 번 더 깨뭅니다.', tip: '모든 권능 피해가 +1 됩니다. 단순하게 침략자를 공격하면 돼요.',
    g: 'A', t: 'A', bonusWhere: 'any', special: { name: '굶주린 땅', text: '당신의 권능이 주는 피해는 +1 됩니다(권능마다 한 번).' },
    setup: [{ terrain: 'S', count: 2 }], setupText: '번호가 가장 큰 사막에 존재 2개',
    uniques: ['gift_furious_might', 'hungry_sinkhole', 'swallow_whole', 'rumbling_earth'],
    innates: [{
      id: 'devour', name: '집어삼키기', speed: 'slow', target: LAND('presence', 0, 'invaders'),
      levels: [lvl({ earth: 1, animal: 2 }, '피해 1.'), lvl({ earth: 2, animal: 3 }, '피해 +2.'), lvl({ earth: 3, animal: 4 }, '피해 +2, 공포 1.')],
      async effect(ctx, n) { ctx.damage([1, 3, 5][n - 1]); if (n >= 3) ctx.fear(1); },
    }],
  }),
  spirit({
    id: 'eyes', exp: 'hz', name: '나무에서 지켜보는 눈', en: 'Eyes Watch from the Trees', color: '#5d8a3a', complexity: '낮음',
    summary: '숲속에서 침략자를 지켜보는 눈들. 성지에 들어온 탐험가는 사라집니다.', tip: '정글에 성지를 만들어 탐험가가 들어오지 못하게 하세요.',
    g: 'C', t: 'A', explorerBane: true, special: { name: '숲의 감시', text: '당신의 성지에 도착한 탐험가는 사라집니다.' },
    setup: [{ terrain: 'J', count: 2 }], setupText: '번호가 가장 큰 정글에 존재 2개',
    uniques: ['boon_of_watching', 'mysterious_abductions', 'shadowed_path', 'watchful_ambush'],
    innates: [{
      id: 'unseen_eyes', name: '보이지 않는 시선', speed: 'fast', target: LAND('presence', 1, 'invaders'),
      levels: [lvl({ moon: 1, plant: 1 }, '공포 1.'), lvl({ moon: 2, plant: 2 }, '탐험가 1개를 파괴합니다.'), lvl({ moon: 3, plant: 3 }, '공포 +2.')],
      async effect(ctx, n) { ctx.fear(n >= 3 ? 3 : 1); if (n >= 2) ctx.destroy(['explorer'], 1); },
    }],
  }),
  spirit({
    id: 'mud', exp: 'hz', name: '끝없는 늪의 진흙', en: 'Fathomless Mud of the Swamp', color: '#6b5a3e', complexity: '낮음',
    summary: '무엇이든 빨아들이는 늪. 성지의 침략자는 진흙에 발이 묶입니다.', tip: '습지는 바로 성지가 되고, 성지는 방어 2를 받습니다. 습지를 지키세요.',
    g: 'D', t: 'C', sacredTerrain: 'W', sacredDefend: 2, special: { name: '빠지는 진흙', text: '습지의 존재는 성지로 취급되고, 당신의 성지에는 방어 2.' },
    setup: [{ terrain: 'W', count: 1 }, { num: 5, count: 1 }], setupText: '번호가 가장 큰 습지와 5번 지역에 존재 1개씩',
    uniques: ['gift_of_swamp', 'sucking_ooze', 'mire', 'swallowed_by_mud'],
    innates: [{
      id: 'quagmire', name: '헤어날 수 없는 수렁', speed: 'slow', target: LAND('presence', 1, 'invaders'),
      levels: [lvl({ water: 2, earth: 1 }, '탐험가 1개를 파괴합니다.'), lvl({ water: 3, earth: 2 }, '마을/도시에 피해 2.'), lvl({ water: 4, earth: 3, plant: 1 }, '모든 침략자에게 각각 피해 1.')],
      async effect(ctx, n) { ctx.destroy(['explorer'], 1); if (n >= 2) ctx.damage(2, ['town', 'city']); if (n >= 3) ctx.damageEach(1, ['explorer', 'town', 'city']); },
    }],
  }),
  spirit({
    id: 'heat', exp: 'hz', name: '돌과 모래의 끓는 열기', en: 'Rising Heat of Stone and Sand', color: '#d97b29', complexity: '낮음',
    summary: '바위와 모래에서 피어오르는 열기. 산과 사막에서 강합니다.', tip: '산과 사막 근처에 자리 잡고 그곳의 침략자를 태우세요.',
    g: 'B', t: 'A', bonusWhere: 'M/S', special: { name: '타오르는 대지', text: '산·사막에서 당신의 권능이 주는 피해는 +1 됩니다(권능마다 한 번).' },
    setup: [{ terrain: 'S', count: 1 }, { terrain: 'M', count: 1 }], setupText: '번호가 가장 큰 사막과 산에 존재 1개씩',
    uniques: ['harden_heat', 'blistering_heat', 'shimmering_mirage', 'scorching_convection'],
    innates: [{
      id: 'rising_heat', name: '피어오르는 열기', speed: 'slow', target: LAND('presence', 1, 'invaders'),
      levels: [lvl({ fire: 2, earth: 1 }, '피해 1.'), lvl({ fire: 3, earth: 2 }, '피해 +2.'), lvl({ fire: 4, earth: 3, air: 1 }, '피해 +2, 공포 1.')],
      async effect(ctx, n) { ctx.damage([1, 3, 5][n - 1]); if (n >= 3) ctx.fear(1); },
    }],
  }),
  spirit({
    id: 'whirlwind', exp: 'hz', name: '햇빛 회오리', en: 'Sun-Bright Whirlwind', color: '#f4d03f', complexity: '낮음',
    summary: '햇빛을 머금은 회오리바람. 빠르게 움직이며 침략자를 날려 버립니다.', tip: '공기 원소 카드를 내면 느린 권능도 침략자보다 먼저 쓸 수 있습니다.',
    g: 'B', t: 'D', airFast: true, special: { name: '회오리의 속도', text: '공기 원소 1개당, 이번 턴에 느린 권능 1개를 빠른 권능처럼 사용할 수 있습니다.' },
    setup: [{ num: 5, count: 2 }], setupText: '5번 지역에 존재 2개',
    uniques: ['gift_of_winds', 'sweep_away', 'dazzling_light', 'whirling_debris'],
    innates: [{
      id: 'scour_land', name: '땅을 쓸어버리다', speed: 'fast', target: LAND('presence', 1),
      levels: [lvl({ sun: 1, air: 2 }, '탐험가 1개를 밀어냅니다.'), lvl({ sun: 2, air: 3 }, '피해 2.'), lvl({ sun: 3, air: 4 }, '피해 +2, 마을 1개 밀어내기.')],
      async effect(ctx, n) { await ctx.push(['explorer'], 1, false); if (n >= 2) ctx.damage(n >= 3 ? 4 : 2); if (n >= 3) await ctx.push(['town'], 1, false); },
    }],
  }),

  // ───────── 자연의 화신 ─────────
  spirit({
    id: 'darkness', exp: 'ni', name: '등골을 타고 내리는 어둠의 숨결', en: 'Breath of Darkness Down Your Spine', color: '#3d2b56', complexity: '보통',
    summary: '어둠 속에서 다가오는 공포. 성지의 침략자를 매 턴 떨게 합니다.', tip: '침략자가 있는 곳에 성지를 만들면 매 턴 공포가 쌓입니다.',
    g: 'A', t: 'D', fearPerSacred: true, special: { name: '공포의 숨결', text: '침략자 단계마다, 침략자가 있는 당신의 성지 1개당 공포 1 (최대 2).' },
    setup: [{ terrain: 'J', count: 1 }, { terrain: 'M', count: 1 }], setupText: '번호가 가장 큰 정글과 산에 존재 1개씩',
    uniques: ['terror_in_dark', 'snatched_away', 'creeping_dread', 'swallowing_night'],
    innates: [{
      id: 'darkness_spreads', name: '퍼지는 어둠', speed: 'slow', target: LAND('presence', 1, 'invaders'),
      levels: [lvl({ moon: 2, air: 1 }, '공포 1.'), lvl({ moon: 3, air: 2, animal: 1 }, '공포 +1, 탐험가 1개 파괴.'), lvl({ moon: 4, air: 3, animal: 2 }, '공포 +2.')],
      async effect(ctx, n) { ctx.fear([1, 2, 4][n - 1]); if (n >= 2) ctx.destroy(['explorer'], 1); },
    }],
  }),
  spirit({
    id: 'earthquakes', exp: 'ni', name: '지진을 춤추는 자', en: 'Dances Up Earthquakes', color: '#a0784e', complexity: '높음',
    summary: '춤으로 땅을 뒤흔드는 정령. 산에서 일으키는 지진이 마을과 도시를 무너뜨립니다.', tip: '산 근처에서 마을·도시를 노리세요. 내재 권능으로 여러 건물을 한꺼번에 흔듭니다.',
    g: 'C', t: 'C', bonusWhere: 'M', special: { name: '대지의 춤', text: '산에서 당신의 권능이 주는 피해는 +1 됩니다(권능마다 한 번).' },
    setup: [{ terrain: 'M', count: 2 }], setupText: '번호가 가장 큰 산에 존재 2개',
    uniques: ['quake_steps', 'tremors', 'rift', 'dance_shakes'],
    innates: [{
      id: 'grand_quake', name: '대지진', speed: 'slow', target: LAND('presence', 1),
      levels: [lvl({ earth: 2, fire: 1 }, '각 마을에 피해 1.'), lvl({ earth: 3, fire: 2, air: 1 }, '각 도시에 피해 1, 공포 1.'), lvl({ earth: 4, fire: 3, air: 2 }, '모든 침략자에게 각각 피해 1.')],
      async effect(ctx, n) { ctx.damageEach(1, ['town']); if (n >= 2) { ctx.damageEach(1, ['city']); ctx.fear(1); } if (n >= 3) ctx.damageEach(1, ['explorer', 'town', 'city']); },
    }],
  }),
  spirit({
    id: 'behemoth', exp: 'ni', name: '잿불 눈의 거수', en: 'Ember-Eyed Behemoth', color: '#c1440e', complexity: '보통',
    summary: '불꽃 눈을 가진 거대한 짐승. 다한과 함께 침략자를 짓밟습니다.', tip: '다한이 있는 곳에서 권능이 강해지고 다한의 반격도 세집니다.',
    g: 'A', t: 'A', bonusWhere: 'dahan', counterBonus: 1, special: { name: '거수의 분노', text: '다한이 있는 지역에서 권능 피해 +1 (권능마다 한 번). 당신의 존재가 있는 지역의 다한은 반격 피해 +1.' },
    setup: [{ terrain: 'J', count: 1 }, { num: 5, count: 1 }], setupText: '번호가 가장 큰 정글과 5번 지역에 존재 1개씩',
    uniques: ['crushing_stride', 'behemoth_roar', 'ember_gaze', 'trample'],
    innates: [{
      id: 'behemoth_rampage', name: '거수의 난동', speed: 'slow', target: LAND('presence', 0, 'invaders'),
      levels: [lvl({ fire: 2, earth: 2 }, '피해 2.'), lvl({ fire: 3, earth: 3, animal: 1 }, '피해 +3.'), lvl({ fire: 4, earth: 4, animal: 2 }, '피해 +3, 공포 2.')],
      async effect(ctx, n) { ctx.damage([2, 5, 8][n - 1]); if (n >= 3) ctx.fear(2); },
    }],
  }),
  spirit({
    id: 'hearth', exp: 'ni', name: '화롯가의 파수꾼', en: 'Hearth-Vigil', color: '#e8a33d', complexity: '낮음',
    summary: '다한의 집을 지키는 수호령. 다한을 보호하고 함께 싸웁니다.', tip: '다한이 많은 마을 곁에 머무르세요. 그곳의 다한은 다치지 않고 더 세게 반격합니다.',
    g: 'D', t: 'A', dahanShield: true, counterBonus: 1, special: { name: '화롯불의 보호', text: '당신의 존재가 있는 지역의 다한은 약탈 피해를 받지 않고, 반격 피해 +1.' },
    setup: [{ mostDahan: 2 }], setupText: '다한이 가장 많은 두 지역에 존재 1개씩',
    uniques: ['warm_welcome', 'fortify_homes', 'call_to_vigil', 'flames_of_hearth'],
    innates: [{
      id: 'hearth_guard', name: '화롯가 수호', speed: 'fast', target: LAND('presence', 1, 'dahan'),
      levels: [lvl({ sun: 1, fire: 1, animal: 1 }, '방어 2.'), lvl({ sun: 2, fire: 2, animal: 2 }, '다한 1개를 추가합니다.'), lvl({ sun: 3, fire: 3, animal: 3 }, '다한 1개당 피해 1.')],
      async effect(ctx, n) { ctx.defend(2); if (n >= 2) ctx.add('dahan', 1); if (n >= 3) ctx.damage(ctx.count('dahan')); },
    }],
  }),
  spirit({
    id: 'gaze', exp: 'ni', name: '끈질긴 태양의 시선', en: 'Relentless Gaze of the Sun', color: '#ffb000', complexity: '보통',
    summary: '섬 전체를 내려다보는 태양. 멀리서도 강력한 빛을 내리꽂습니다.', tip: '사거리가 길어 멀리 있는 침략자도 공격할 수 있습니다. 비싼 강력한 카드가 많아요.',
    g: 'B', t: 'C', rangeBonus: 1, special: { name: '멀리 보는 태양', text: '당신의 모든 권능은 사거리 +1.' },
    setup: [{ terrain: 'S', count: 2 }], setupText: '번호가 가장 큰 사막에 존재 2개',
    uniques: ['blinding_glare', 'withering_heat', 'unrelenting_light', 'focused_beam'],
    innates: [{
      id: 'gaze_judgment', name: '심판의 시선', speed: 'slow', target: LAND('presence', 2, 'invaders'),
      levels: [lvl({ sun: 2, fire: 1 }, '피해 1.'), lvl({ sun: 3, fire: 2 }, '피해 +1, 공포 1.'), lvl({ sun: 5, fire: 3 }, '피해 +3.')],
      async effect(ctx, n) { ctx.damage([1, 2, 5][n - 1]); if (n >= 2) ctx.fear(1); },
    }],
  }),
  spirit({
    id: 'roots', exp: 'ni', name: '치솟는 정글의 뿌리', en: 'Towering Roots of the Jungle', color: '#2f6b2f', complexity: '보통',
    summary: '하늘까지 솟은 거대한 나무. 뿌리로 땅을 붙잡아 지키고 치유합니다.', tip: '존재를 쌓은 곳은 방어가 오르고, 성지의 황폐는 매 턴 치유됩니다.',
    g: 'C', t: 'C', presenceDefend: 1, blightHeal: true, special: { name: '뿌리의 보호', text: '존재 1개당 그 지역 방어 1. 매 턴 끝에 황폐가 있는 당신의 성지 1곳의 황폐를 1개 치유합니다.' },
    setup: [{ terrain: 'J', count: 2 }], setupText: '번호가 가장 큰 정글에 존재 2개',
    uniques: ['entwining_roots', 'grow_tall', 'reclaim_ground', 'roots_crack_stone'],
    innates: [{
      id: 'towering_canopy', name: '치솟는 수관', speed: 'slow', target: LAND('presence', 1),
      levels: [lvl({ plant: 2, earth: 1 }, '방어 2.'), lvl({ plant: 3, earth: 2 }, '피해 2.'), lvl({ plant: 4, earth: 3, water: 1 }, '황폐 1개 제거, 피해 +1.')],
      async effect(ctx, n) { ctx.defend(2); if (n >= 2) ctx.damage(n >= 3 ? 3 : 2); if (n >= 3) ctx.removeBlight(); },
    }],
  }),
  spirit({
    id: 'voice', exp: 'ni', name: '방황하는 목소리의 광란', en: 'Wandering Voice Keens Delirium', color: '#9370db', complexity: '보통',
    summary: '섬을 떠도는 미친 듯한 목소리. 침략자를 광기로 몰아넣습니다.', tip: '공포를 많이 만드는 정령입니다. 존재가 있는 곳이 약탈당하면 공포가 쌓여요.',
    g: 'B', t: 'D', ravageFear: true, special: { name: '광란의 외침', text: '당신의 존재가 있는 지역이 약탈당할 때마다 공포 1 (턴당 최대 2).' },
    setup: [{ terrain: 'W', count: 1 }, { terrain: 'S', count: 1 }], setupText: '번호가 가장 큰 습지와 사막에 존재 1개씩',
    uniques: ['echoing_cry', 'maddening_whispers', 'delirium', 'keening_wail'],
    innates: [{
      id: 'wail_madness', name: '광기의 울부짖음', speed: 'fast', target: LAND('presence', 1, 'invaders'),
      levels: [lvl({ moon: 1, air: 2 }, '공포 1.'), lvl({ moon: 2, air: 3, animal: 1 }, '공포 +1, 탐험가 1개 밀어내기.'), lvl({ moon: 3, air: 4, animal: 2 }, '공포 +2.')],
      async effect(ctx, n) { ctx.fear([1, 2, 4][n - 1]); if (n >= 2) await ctx.push(['explorer'], 1, false); },
    }],
  }),
  spirit({
    id: 'wounded', exp: 'ni', name: '피 흘리는 상처 입은 물', en: 'Wounded Waters Bleeding', color: '#8b2f3c', complexity: '높음',
    summary: '상처 입은 섬의 물. 황폐를 치유하면서 황폐를 만든 자에게 복수합니다.', tip: '성지의 황폐를 매 턴 치유합니다. 황폐가 있는 땅에서 권능이 더 강해요.',
    g: 'D', t: 'B', blightHeal: true, bonusWhere: 'blight', special: { name: '치유의 물', text: '매 턴 끝에 황폐가 있는 당신의 성지 1곳의 황폐를 1개 치유합니다. 황폐 지역에서 권능 피해 +1 (권능마다 한 번).' },
    setup: [{ terrain: 'W', count: 2 }], setupText: '번호가 가장 큰 습지에 존재 2개',
    uniques: ['bleeding_currents', 'cleansing_tears', 'vengeful_tide', 'waters_remember'],
    innates: [{
      id: 'blood_waters', name: '핏빛 물결', speed: 'slow', target: LAND('sacred', 1, 'invaders'),
      levels: [lvl({ water: 2, animal: 1 }, '황폐 1개당 피해 1 (최소 1).'), lvl({ water: 3, animal: 2 }, '공포 2.'), lvl({ water: 4, animal: 3, fire: 1 }, '모든 침략자에게 각각 피해 1.')],
      async effect(ctx, n) { ctx.damage(Math.max(1, ctx.count('blight'))); if (n >= 2) ctx.fear(2); if (n >= 3) ctx.damageEach(1, ['explorer', 'town', 'city']); },
    }],
  }),
];

const EXPANSIONS = [
  { id: 'base', name: '기본판', en: 'Spirit Island', required: true },
  { id: 'bc', name: '가지와 발톱', en: 'Branch & Claw' },
  { id: 'ff', name: '깃털과 불꽃 (프로모 1·2)', en: 'Feather & Flame' },
  { id: 'je', name: '들쭉날쭉한 대지', en: 'Jagged Earth' },
  { id: 'hz', name: '정령섬의 지평선', en: 'Horizons of Spirit Island' },
  { id: 'ni', name: '자연의 화신', en: 'Nature Incarnate' },
];

module.exports = { SPIRITS_EXT, EXPANSIONS };
