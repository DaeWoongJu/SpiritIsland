'use strict';
// 권능 카드 정의 (고유 / 소형 / 대형).
// target.kind: 'land' | 'spirit'
//   land: from = 'presence' | 'sacred', range = 숫자, filter = 'any' | 'dahan' | 'invaders' | 'noinvaders'
//         | 'blight' | 'noblight' | 'coastal' | 'inland' | 지형 조합('J/W' 등)
//   spirit: filter = 'any' | 'other' | 'self'
// effect(ctx): 실제 효과. ctx 헬퍼는 game.js 의 makeCtx 참고.
// 원작 카드의 효과를 바탕으로 하되, 온라인 구현을 위해 일부 단순화되어 있다.

const L = (from, range, filter = 'any') => ({ kind: 'land', from, range, filter });
const S = (filter = 'any') => ({ kind: 'spirit', filter });

const INV = ['explorer', 'town', 'city'];
const ET = ['explorer', 'town'];

const POWERS = [
  // ───────────── 번개의 신속한 일격 ─────────────
  {
    id: 'harbingers', name: '번개의 전령', en: 'Harbingers of the Lightning', cost: 0, speed: 'slow', kind: 'unique',
    elements: ['fire', 'air'], target: L('presence', 1),
    text: '다한을 최대 2개 밀어냅니다. 마을/도시가 있는 지역으로 다한을 밀어냈다면 공포 1.',
    async effect(ctx) {
      const moved = await ctx.push(['dahan'], 2);
      if (moved.some((m) => ctx.game.townCityCount(m.to) > 0)) ctx.fear(1);
    },
  },
  {
    id: 'lightnings_boon', name: '번개의 은총', en: "Lightning's Boon", cost: 1, speed: 'fast', kind: 'unique',
    elements: ['fire', 'air'], target: S('any'),
    text: '대상 정령은 이번 턴에 느린 권능을 최대 2개까지 빠른 권능처럼 사용할 수 있습니다.',
    async effect(ctx) {
      ctx.target.fastAllowance += 2;
      ctx.log(`${ctx.targetName}: 느린 권능 2개를 빠르게 사용할 수 있습니다.`);
    },
  },
  {
    id: 'raging_storm', name: '몰아치는 폭풍', en: 'Raging Storm', cost: 3, speed: 'slow', kind: 'unique',
    elements: ['fire', 'air', 'water'], target: L('presence', 1),
    text: '모든 침략자에게 각각 피해 1.',
    async effect(ctx) { ctx.damageEach(1, INV); },
  },
  {
    id: 'shatter_homesteads', name: '정착지 파괴', en: 'Shatter Homesteads', cost: 2, speed: 'slow', kind: 'unique',
    elements: ['fire', 'air'], target: L('sacred', 2),
    text: '공포 1. 마을 1개를 파괴합니다.',
    async effect(ctx) { ctx.fear(1); await ctx.destroy(['town'], 1); },
  },

  // ───────────── 햇살 속에 굽이치는 강 ─────────────
  {
    id: 'boon_of_vigor', name: '활력의 은총', en: 'Boon of Vigor', cost: 0, speed: 'fast', kind: 'unique',
    elements: ['sun', 'water', 'plant'], target: S('any'),
    text: '자신이 대상이면 에너지 1을 얻습니다. 다른 정령이 대상이면, 그 정령이 이번 턴에 낸 권능 카드 1장당 에너지 1을 얻습니다.',
    async effect(ctx) {
      const n = ctx.targetPid === ctx.pid ? 1 : ctx.target.played.length;
      ctx.gainEnergy(n, ctx.targetPid);
    },
  },
  {
    id: 'flash_floods', name: '돌발 홍수', en: 'Flash Floods', cost: 2, speed: 'fast', kind: 'unique',
    elements: ['sun', 'water'], target: L('presence', 1),
    text: '피해 1. 대상 지역이 해안이면 피해 +1.',
    async effect(ctx) { ctx.damage(ctx.land.coastal ? 2 : 1); },
  },
  {
    id: 'rivers_bounty', name: '강의 풍요', en: "River's Bounty", cost: 0, speed: 'slow', kind: 'unique',
    elements: ['sun', 'water', 'animal'], target: L('presence', 0),
    text: '다한을 최대 2개 모읍니다. 이제 다한이 2개 이상이면, 다한 1개를 추가하고 에너지 1을 얻습니다.',
    async effect(ctx) {
      await ctx.gather(['dahan'], 2);
      if (ctx.count('dahan') >= 2) { ctx.add('dahan', 1); ctx.gainEnergy(1); }
    },
  },
  {
    id: 'wash_away', name: '씻어내기', en: 'Wash Away', cost: 1, speed: 'slow', kind: 'unique',
    elements: ['water', 'earth'], target: L('presence', 1),
    text: '탐험가/마을을 최대 3개 밀어냅니다.',
    async effect(ctx) { await ctx.push(ET, 3); },
  },

  // ───────────── 대지의 활력 ─────────────
  {
    id: 'guard_healing_land', name: '치유되는 땅의 수호', en: 'Guard the Healing Land', cost: 3, speed: 'slow', kind: 'unique',
    elements: ['water', 'earth', 'plant'], target: L('presence', 1),
    text: '황폐 1개를 제거합니다. 방어 4.',
    async effect(ctx) { ctx.removeBlight(); ctx.defend(4); },
  },
  {
    id: 'perfect_stillness', name: '완벽한 정적의 해', en: 'A Year of Perfect Stillness', cost: 3, speed: 'fast', kind: 'unique',
    elements: ['sun', 'earth'], target: L('presence', 1),
    text: '이번 턴에 대상 지역의 침략자는 모든 행동을 건너뜁니다.',
    async effect(ctx) { ctx.skipActions(); },
  },
  {
    id: 'rituals_destruction', name: '파괴의 의식', en: 'Rituals of Destruction', cost: 3, speed: 'slow', kind: 'unique',
    elements: ['sun', 'moon', 'fire', 'earth', 'plant'], target: L('sacred', 1, 'dahan'),
    text: '피해 2. 대상 지역에 다한이 3개 이상이면 피해 +3, 공포 2.',
    async effect(ctx) {
      if (ctx.count('dahan') >= 3) { ctx.fear(2); ctx.damage(5); } else ctx.damage(2);
    },
  },
  {
    id: 'draw_fruitful_earth', name: '풍요로운 대지의 이끌림', en: 'Draw of the Fruitful Earth', cost: 1, speed: 'slow', kind: 'unique',
    elements: ['earth', 'plant', 'animal'], target: L('presence', 1),
    text: '탐험가를 최대 2개 모읍니다. 다한을 최대 2개 모읍니다.',
    async effect(ctx) { await ctx.gather(['explorer'], 2); await ctx.gather(['dahan'], 2); },
  },

  // ───────────── 불꽃처럼 일렁이는 그림자 ─────────────
  {
    id: 'mantle_of_dread', name: '공포의 망토', en: 'Mantle of Dread', cost: 1, speed: 'slow', kind: 'unique',
    elements: ['moon', 'fire', 'air'], target: S('any'),
    text: '공포 2. 대상 정령은 자신의 존재가 있는 한 지역에서 탐험가 1개와 마을 1개를 밀어낼 수 있습니다.',
    async effect(ctx) {
      ctx.fear(2);
      const g = ctx.game;
      const opts = g.presenceLands(ctx.targetPid).filter((id) => g.count(id, 'explorer') + g.count(id, 'town') > 0);
      if (!opts.length) return;
      const land = await g.askLand(ctx.targetPid, '공포의 망토: 탐험가/마을을 밀어낼 지역 선택', opts, true);
      if (!land) return;
      await g.push(ctx.targetPid, land, ['explorer'], 1, { upTo: true });
      await g.push(ctx.targetPid, land, ['town'], 1, { upTo: true });
    },
  },
  {
    id: 'favors_called_due', name: '빚 독촉', en: 'Favors Called Due', cost: 1, speed: 'slow', kind: 'unique',
    elements: ['moon', 'air', 'animal'], target: L('presence', 1),
    text: '다한을 최대 4개 모읍니다. 침략자가 있고 다한 수가 침략자보다 많으면 공포 3.',
    async effect(ctx) {
      await ctx.gather(['dahan'], 4);
      const inv = ctx.invaderCount();
      if (inv > 0 && ctx.count('dahan') > inv) ctx.fear(3);
    },
  },
  {
    id: 'crops_wither', name: '시드는 작물', en: 'Crops Wither and Fade', cost: 1, speed: 'slow', kind: 'unique',
    elements: ['moon', 'fire', 'plant'], target: L('presence', 1),
    text: '공포 2. 마을 1개를 탐험가 1개로, 또는 도시 1개를 마을 1개로 교체합니다.',
    async effect(ctx) {
      ctx.fear(2);
      const opts = [];
      if (ctx.count('town')) opts.push({ value: 'town', label: '마을 → 탐험가' });
      if (ctx.count('city')) opts.push({ value: 'city', label: '도시 → 마을' });
      if (!opts.length) return;
      const pick = opts.length === 1 ? opts[0].value : await ctx.choose('시드는 작물: 교체할 대상', opts);
      if (pick === 'town') ctx.replace('town', 'explorer'); else ctx.replace('city', 'town');
    },
  },
  {
    id: 'concealing_shadows', name: '은폐의 그림자', en: 'Concealing Shadows', cost: 0, speed: 'fast', kind: 'unique',
    elements: ['moon', 'air'], target: L('presence', 0),
    text: '공포 1. 이번 턴에 다한은 약탈하는 침략자로부터 피해를 받지 않습니다.',
    async effect(ctx) { ctx.fear(1); ctx.land.flags.dahanProtected = true; },
  },

  // ───────────── 천둥의 대변자 ─────────────
  {
    id: 'manifestation_glory', name: '권능과 영광의 현현', en: 'Manifestation of Power and Glory', cost: 3, speed: 'slow', kind: 'unique',
    elements: ['sun', 'fire', 'air'], target: L('presence', 0, 'dahan'),
    text: '공포 2. 각 다한이 당신의 존재 수만큼 피해를 줍니다.',
    async effect(ctx) { ctx.fear(2); ctx.damage(ctx.count('dahan') * ctx.game.presenceCount(ctx.pid, ctx.landId)); },
  },
  {
    id: 'sudden_ambush', name: '기습', en: 'Sudden Ambush', cost: 1, speed: 'fast', kind: 'unique',
    elements: ['fire', 'air', 'animal'], target: L('presence', 1),
    text: '다한을 최대 1개 모읍니다. 각 다한은 탐험가 1개를 파괴합니다.',
    async effect(ctx) { await ctx.gather(['dahan'], 1); if (ctx.count('dahan')) ctx.destroy(['explorer'], ctx.count('dahan')); },
  },
  {
    id: 'words_of_warning', name: '경고의 말', en: 'Words of Warning', cost: 1, speed: 'fast', kind: 'unique',
    elements: ['air', 'sun', 'animal'], target: L('presence', 1, 'dahan'),
    text: '방어 3. 이번 턴 약탈 때 이 지역의 다한은 피해를 받기 전에 먼저 반격합니다.',
    async effect(ctx) { ctx.defend(3); ctx.land.flags.dahanAmbush = true; ctx.log(`${ctx.landId}: 다한이 먼저 반격합니다`); },
  },
  {
    id: 'voice_of_thunder', name: '천둥의 목소리', en: 'Voice of Thunder', cost: 0, speed: 'slow', kind: 'unique',
    elements: ['sun', 'air'], target: L('presence', 1),
    text: '다한을 최대 4개 밀어냅니다. 또는 침략자가 있으면 공포 2.',
    async effect(ctx) {
      const opts = [{ value: 'push', label: '다한 최대 4개 밀어내기' }];
      if (ctx.invaderCount()) opts.push({ value: 'fear', label: '공포 2' });
      const c = opts.length === 1 ? 'push' : await ctx.choose('천둥의 목소리', opts);
      if (c === 'fear') ctx.fear(2); else await ctx.push(['dahan'], 4);
    },
  },

  // ───────────── 바다의 굶주린 손아귀 ─────────────
  {
    id: 'call_of_deeps', name: '심연의 부름', en: 'Call of the Deeps', cost: 0, speed: 'fast', kind: 'unique',
    elements: ['moon', 'air', 'water'], target: L('presence', 0, 'coastal'),
    text: '탐험가를 1개 모읍니다. (달 2: 대신 최대 2개)',
    async effect(ctx) { await ctx.gather(['explorer'], ctx.has({ moon: 2 }) ? 2 : 1); },
  },
  {
    id: 'grasping_tide', name: '움켜쥐는 조수', en: 'Grasping Tide', cost: 1, speed: 'fast', kind: 'unique',
    elements: ['moon', 'water'], target: L('presence', 1, 'coastal'),
    text: '공포 2. 방어 4.',
    async effect(ctx) { ctx.fear(2); ctx.defend(4); },
  },
  {
    id: 'swallow_land', name: '땅의 주민을 삼키다', en: 'Swallow the Land-Dwellers', cost: 0, speed: 'slow', kind: 'unique',
    elements: ['water', 'earth'], target: L('presence', 0, 'coastal'),
    text: '탐험가 1개, 마을 1개, 다한 1개를 바다로 끌어들여 파괴합니다.',
    async effect(ctx) { ctx.destroy(['explorer'], 1); ctx.destroy(['town'], 1); ctx.destroyDahan(1); },
  },
  {
    id: 'tidal_boon', name: '조수의 은총', en: 'Tidal Boon', cost: 1, speed: 'slow', kind: 'unique',
    elements: ['moon', 'water', 'earth'], target: S('any'),
    text: '대상 정령은 에너지 2를 얻고, 자신의 존재가 있는 해안 지역 하나에서 마을 1개를 밀어낼 수 있습니다.',
    async effect(ctx) {
      const g = ctx.game;
      ctx.gainEnergy(2, ctx.targetPid);
      const opts = g.presenceLands(ctx.targetPid).filter((id) => g.lands[id].coastal && g.count(id, 'town'));
      const land = await g.askLand(ctx.targetPid, '조수의 은총: 마을을 밀어낼 해안 지역 (취소 가능)', opts, true);
      if (land) await g.push(ctx.targetPid, land, ['town'], 1, { upTo: true });
    },
  },

  // ───────────── 꿈과 악몽을 부르는 자 ─────────────
  {
    id: 'dreams_of_dahan', name: '다한의 꿈', en: 'Dreams of the Dahan', cost: 0, speed: 'fast', kind: 'unique',
    elements: ['moon', 'air'], target: L('presence', 2),
    text: '다한을 최대 2개 모읍니다. 대상 지역에 마을/도시가 있으면 다한 1개당 공포 1 (최대 3).',
    async effect(ctx) {
      await ctx.gather(['dahan'], 2);
      if (ctx.game.townCityCount(ctx.landId) && ctx.count('dahan')) ctx.fear(Math.min(3, ctx.count('dahan')));
    },
  },
  {
    id: 'predatory_nightmares', name: '포식하는 악몽', en: 'Predatory Nightmares', cost: 2, speed: 'slow', kind: 'unique',
    elements: ['moon', 'fire', 'earth', 'animal'], target: L('presence', 2, 'invaders'),
    text: '피해 2. 다한을 최대 2개 밀어냅니다.',
    async effect(ctx) { ctx.damage(2); await ctx.push(['dahan'], 2); },
  },
  {
    id: 'call_midnight', name: '한밤의 꿈을 부르다', en: "Call on Midnight's Dream", cost: 0, speed: 'fast', kind: 'unique',
    elements: ['moon', 'animal'], target: L('presence', 0),
    text: '대상 지역에 다한이 있으면 소형 권능 1장을 얻습니다. 없으면 공포 2.',
    async effect(ctx) { if (ctx.count('dahan')) await ctx.game.gainPowerCard(ctx.pid, 'minor'); else ctx.fear(2); },
  },
  {
    id: 'dread_apparitions', name: '공포스러운 환영', en: 'Dread Apparitions', cost: 2, speed: 'fast', kind: 'unique',
    elements: ['moon', 'air'], target: L('presence', 1, 'invaders'),
    text: '공포 2. 방어 2.',
    async effect(ctx) { ctx.fear(2); ctx.defend(2); },
  },

  // ───────────── 만연한 초록 ─────────────
  {
    id: 'fields_choked', name: '덩굴에 뒤덮인 들판', en: 'Fields Choked with Growth', cost: 0, speed: 'slow', kind: 'unique',
    elements: ['sun', 'water', 'plant'], target: L('presence', 1),
    text: '마을 1개를 밀어냅니다. 또는 다한을 최대 3개 밀어냅니다.',
    async effect(ctx) {
      const opts = [];
      if (ctx.count('town')) opts.push({ value: 't', label: '마을 1개 밀어내기' });
      if (ctx.count('dahan')) opts.push({ value: 'd', label: '다한 최대 3개 밀어내기' });
      if (!opts.length) return;
      const c = opts.length === 1 ? opts[0].value : await ctx.choose('덩굴에 뒤덮인 들판', opts);
      if (c === 't') await ctx.push(['town'], 1, false); else await ctx.push(['dahan'], 3);
    },
  },
  {
    id: 'gift_proliferation', name: '번성의 선물', en: 'Gift of Proliferation', cost: 1, speed: 'fast', kind: 'unique',
    elements: ['moon', 'plant'], target: S('any'),
    text: '대상 정령은 자신의 존재에서 사거리 1 이내에 존재 1개를 추가합니다.',
    async effect(ctx) {
      const g = ctx.game;
      const opts = g.landsWithinRange(g.presenceLands(ctx.targetPid), 1);
      const land = await g.askLand(ctx.targetPid, '번성의 선물: 존재를 추가할 지역', opts, false, {}, { kind: 'presenceLand' });
      if (land) await g.placePresence(ctx.targetPid, land);
    },
  },
  {
    id: 'stem_the_flow', name: '물길을 막다', en: 'Stem the Flow of Fresh Water', cost: 0, speed: 'slow', kind: 'unique',
    elements: ['water', 'plant'], target: L('sacred', 1),
    text: '마을/도시 1개에 피해 1. 대상 지역이 산/사막이면 대신 모든 마을/도시에 각각 피해 1.',
    async effect(ctx) {
      if (ctx.terrainIs('M', 'S')) ctx.damageEach(1, ['town', 'city']);
      else ctx.damage(1, ['town', 'city']);
    },
  },
  {
    id: 'night_overgrowth', name: '하룻밤의 덩굴', en: 'Overgrow in a Night', cost: 2, speed: 'fast', kind: 'unique',
    elements: ['moon', 'plant'], target: L('presence', 1),
    text: '대상 지역에 존재 1개를 추가합니다. 침략자가 있으면 공포 1.',
    async effect(ctx) { await ctx.addPresence(); if (ctx.invaderCount()) ctx.fear(1); },
  },

  // ───────────── 들불의 심장 ─────────────
  {
    id: 'flash_fires', name: '번지는 불길', en: 'Flash-Fires', cost: 2, speed: 'fast', kind: 'unique',
    elements: ['fire', 'air'], target: L('presence', 1),
    text: '공포 1. 피해 2.',
    async effect(ctx) { ctx.fear(1); ctx.damage(2); },
  },
  {
    id: 'asphyxiating_smoke', name: '숨막히는 연기', en: 'Asphyxiating Smoke', cost: 2, speed: 'slow', kind: 'unique',
    elements: ['fire', 'air', 'plant'], target: L('presence', 1),
    text: '공포 1. 마을 1개를 파괴합니다. 다한을 1개 밀어냅니다.',
    async effect(ctx) { ctx.fear(1); ctx.destroy(['town'], 1); await ctx.push(['dahan'], 1, false); },
  },
  {
    id: 'threatening_flames', name: '위협하는 불꽃', en: 'Threatening Flames', cost: 0, speed: 'slow', kind: 'unique',
    elements: ['fire', 'plant'], target: L('presence', 0, 'invaders'),
    text: '공포 2. 탐험가 1개와 마을 1개를 밀어냅니다.',
    async effect(ctx) { ctx.fear(2); await ctx.push(['explorer'], 1, false); await ctx.push(['town'], 1, false); },
  },
  {
    id: 'flames_fury', name: '불꽃의 분노', en: "Flames' Fury", cost: 0, speed: 'fast', kind: 'unique',
    elements: ['sun', 'fire', 'plant'], target: S('any'),
    text: '대상 정령은 에너지 1과 이번 턴 동안 불 원소 1개를 얻습니다.',
    async effect(ctx) { ctx.gainEnergy(1, ctx.targetPid); ctx.target.bonusElements.fire = (ctx.target.bonusElements.fire || 0) + 1; },
  },

  // ───────────── 금지된 야생의 수호자 ─────────────
  {
    id: 'regrow_roots', name: '뿌리에서 다시 자라다', en: 'Regrow from Roots', cost: 1, speed: 'slow', kind: 'unique',
    elements: ['water', 'earth', 'plant'], target: L('presence', 1, 'blight'),
    text: '황폐 1개를 제거합니다. 대상 지역이 정글이면 방어 2.',
    async effect(ctx) { ctx.removeBlight(); if (ctx.terrainIs('J')) ctx.defend(2); },
  },
  {
    id: 'sacrosanct_wilderness', name: '신성불가침의 야생', en: 'Sacrosanct Wilderness', cost: 2, speed: 'fast', kind: 'unique',
    elements: ['sun', 'earth', 'plant'], target: L('presence', 1),
    text: '피해 2. 당신의 성지이면 피해 +2.',
    async effect(ctx) { ctx.damage(ctx.game.isSacred(ctx.pid, ctx.landId) ? 4 : 2); },
  },
  {
    id: 'boon_growing_power', name: '자라나는 힘의 은총', en: 'Boon of Growing Power', cost: 1, speed: 'slow', kind: 'unique',
    elements: ['sun', 'moon', 'plant'], target: S('any'),
    text: '대상 정령은 소형 권능 1장을 얻습니다. 다른 정령이 대상이면 에너지 1도 얻습니다.',
    async effect(ctx) { await ctx.game.gainPowerCard(ctx.targetPid, 'minor'); if (ctx.targetPid !== ctx.pid) ctx.gainEnergy(1, ctx.targetPid); },
  },
  {
    id: 'towering_wrath', name: '치솟는 분노', en: 'Towering Wrath', cost: 3, speed: 'slow', kind: 'unique',
    elements: ['sun', 'fire', 'plant'], target: L('sacred', 1),
    text: '공포 2. 당신의 존재 1개당 피해 2 (최대 8).',
    async effect(ctx) { ctx.fear(2); ctx.damage(Math.min(8, 2 * Math.max(1, ctx.game.presenceCount(ctx.pid, ctx.landId)))); },
  },

  // ───────────── 굴하지 않는 바위 ─────────────
  {
    id: 'jagged_shards', name: '솟구치는 바위 파편', en: 'Jagged Shards Push from the Earth', cost: 1, speed: 'fast', kind: 'unique',
    elements: ['fire', 'earth'], target: L('presence', 1),
    text: '피해 1 (산이면 +1). 탐험가 1개를 밀어냅니다.',
    async effect(ctx) { ctx.damage(ctx.terrainIs('M') ? 2 : 1); await ctx.push(['explorer'], 1, false); },
  },
  {
    id: 'stubborn_solidity', name: '완고한 견고함', en: 'Stubborn Solidity', cost: 1, speed: 'fast', kind: 'unique',
    elements: ['sun', 'earth', 'animal'], target: L('presence', 1, 'dahan'),
    text: '다한 1개당 방어 1. 이번 턴 다한은 약탈 피해를 받지 않습니다.',
    async effect(ctx) { ctx.defend(ctx.count('dahan')); ctx.land.flags.dahanProtected = true; },
  },
  {
    id: 'plows_shatter', name: '바위에 부서지는 쟁기', en: 'Plows Shatter on Rocky Ground', cost: 2, speed: 'slow', kind: 'unique',
    elements: ['earth', 'animal'], target: L('presence', 1),
    text: '공포 1. 각 마을/도시에 피해 1.',
    async effect(ctx) { ctx.fear(1); ctx.damageEach(1, ['town', 'city']); },
  },
  {
    id: 'scarred_stony_land', name: '흉터진 돌투성이 땅', en: 'Scarred and Stony Land', cost: 2, speed: 'slow', kind: 'unique',
    elements: ['moon', 'earth'], target: L('presence', 1),
    text: '피해 2. 대상 지역이 산/사막이면 피해 +1.',
    async effect(ctx) { ctx.damage(ctx.terrainIs('M', 'S') ? 3 : 2); },
  },

  // ───────────── 높이 솟은 화산 ─────────────
  {
    id: 'exaltation_molten', name: '용암의 찬미', en: 'Exaltation of Molten Stone', cost: 1, speed: 'fast', kind: 'unique',
    elements: ['moon', 'fire', 'earth'], target: S('any'),
    text: '대상 정령은 에너지 1과 이번 턴 동안 불·대지 원소를 1개씩 얻습니다.',
    async effect(ctx) {
      const b = ctx.target.bonusElements;
      ctx.gainEnergy(1, ctx.targetPid);
      b.fire = (b.fire || 0) + 1; b.earth = (b.earth || 0) + 1;
    },
  },
  {
    id: 'lava_flows', name: '용암류', en: 'Lava Flows', cost: 1, speed: 'slow', kind: 'unique',
    elements: ['fire', 'earth'], target: L('presence', 1),
    text: '피해 2. 대상 지역이 산이 아니면 황폐 1개를 추가합니다.',
    async effect(ctx) { ctx.damage(2); if (!ctx.terrainIs('M')) ctx.addBlight(); },
  },
  {
    id: 'pyroclastic_bombardment', name: '화산탄 폭격', en: 'Pyroclastic Bombardment', cost: 3, speed: 'slow', kind: 'unique',
    elements: ['fire', 'air', 'earth'], target: L('sacred', 2),
    text: '공포 1. 각 마을/도시에 피해 1. 탐험가 1개를 파괴합니다.',
    async effect(ctx) { ctx.fear(1); ctx.damageEach(1, ['town', 'city']); ctx.destroy(['explorer'], 1); },
  },
  {
    id: 'rain_of_ash', name: '잿빛 비', en: 'Rain of Ash', cost: 2, speed: 'slow', kind: 'unique',
    elements: ['fire', 'air', 'plant'], target: L('presence', 1),
    text: '침략자가 있으면 공포 2. 탐험가를 최대 2개 밀어냅니다.',
    async effect(ctx) { if (ctx.invaderCount()) ctx.fear(2); await ctx.push(['explorer'], 2); },
  },

  // ───────────── 소형 권능 ─────────────
  {
    id: 'call_dahan_ways', name: '다한의 길로 부르기', en: 'Call of the Dahan Ways', cost: 1, speed: 'slow', kind: 'minor',
    elements: ['moon', 'water', 'animal'], target: L('presence', 1, 'dahan'),
    text: '탐험가 1개를 다한 1개로 교체합니다. (달 2: 대신 마을 1개를 다한 1개로 교체할 수 있습니다.)',
    async effect(ctx) {
      if (ctx.has({ moon: 2 }) && ctx.count('town')) {
        const c = ctx.count('explorer') ? await ctx.choose('무엇을 교체할까요?', [{ value: 'town', label: '마을 → 다한' }, { value: 'explorer', label: '탐험가 → 다한' }]) : 'town';
        ctx.replace(c, 'dahan');
      } else ctx.replace('explorer', 'dahan');
    },
  },
  {
    id: 'devouring_ants', name: '집어삼키는 개미떼', en: 'Devouring Ants', cost: 1, speed: 'slow', kind: 'minor',
    elements: ['fire', 'earth', 'animal'], target: L('sacred', 1),
    text: '공포 1. 탐험가 1개를 파괴합니다. 대상 지역이 정글/사막이 아니면 다한 1개를 파괴합니다.',
    async effect(ctx) {
      ctx.fear(1); await ctx.destroy(['explorer'], 1);
      if (!ctx.terrainIs('J', 'S')) ctx.destroyDahan(1);
    },
  },
  {
    id: 'drought', name: '가뭄', en: 'Drought', cost: 1, speed: 'slow', kind: 'minor',
    elements: ['sun', 'fire', 'earth'], target: L('presence', 1),
    text: '마을 3개를 파괴합니다. 각 마을/도시에 피해 1. 황폐 1개를 추가합니다.',
    async effect(ctx) {
      await ctx.destroy(['town'], 3);
      ctx.damageEach(1, ['town', 'city']);
      ctx.addBlight();
    },
  },
  {
    id: 'elemental_boon', name: '원소의 은총', en: 'Elemental Boon', cost: 1, speed: 'fast', kind: 'minor',
    elements: [], target: S('any'),
    text: '대상 정령은 이번 턴 동안 서로 다른 원소 3개를 얻습니다(선택).',
    async effect(ctx) {
      const g = ctx.game;
      const chosen = [];
      for (let i = 0; i < 3; i++) {
        const opts = Object.keys(g.constructor.ELEMENT_NAMES).filter((e) => !chosen.includes(e))
          .map((e) => ({ value: e, label: g.constructor.ELEMENT_NAMES[e] }));
        chosen.push(await g.askOption(ctx.targetPid, `원소의 은총: 얻을 원소 선택 (${i + 1}/3)`, opts));
      }
      for (const e of chosen) ctx.target.bonusElements[e] = (ctx.target.bonusElements[e] || 0) + 1;
      ctx.log(`${ctx.targetName}: 원소 ${chosen.map((e) => g.constructor.ELEMENT_NAMES[e]).join(', ')} 획득`);
    },
  },
  {
    id: 'encompassing_ward', name: '감싸는 수호', en: 'Encompassing Ward', cost: 1, speed: 'fast', kind: 'minor',
    elements: ['sun', 'water', 'earth'], target: S('any'),
    text: '대상 정령의 존재가 있는 모든 지역에 방어 2.',
    async effect(ctx) { for (const id of ctx.game.presenceLands(ctx.targetPid)) ctx.game.lands[id].defend += 2; ctx.log('존재가 있는 모든 지역에 방어 2'); },
  },
  {
    id: 'enticing_splendor', name: '매혹적인 광채', en: 'Enticing Splendor', cost: 0, speed: 'fast', kind: 'minor',
    elements: ['sun', 'air', 'plant'], target: L('presence', 0, 'noblight'),
    text: '탐험가/마을 1개를 모읍니다. 다한을 최대 2개 모읍니다.',
    async effect(ctx) { await ctx.gather(ET, 1); await ctx.gather(['dahan'], 2); },
  },
  {
    id: 'gift_living_energy', name: '살아있는 에너지의 선물', en: 'Gift of Living Energy', cost: 0, speed: 'fast', kind: 'minor',
    elements: ['sun', 'fire', 'plant'], target: S('any'),
    text: '대상 정령은 에너지 1을 얻습니다. 다른 정령이 대상이면 에너지 1을 추가로 얻습니다.',
    async effect(ctx) { ctx.gainEnergy(ctx.targetPid === ctx.pid ? 1 : 2, ctx.targetPid); },
  },
  {
    id: 'gift_of_power', name: '권능의 선물', en: 'Gift of Power', cost: 0, speed: 'slow', kind: 'minor',
    elements: ['moon', 'water', 'earth', 'plant'], target: S('any'),
    text: '대상 정령은 소형 권능 1장을 얻습니다.',
    async effect(ctx) { await ctx.game.gainPowerCard(ctx.targetPid, 'minor'); },
  },
  {
    id: 'lure_of_unknown', name: '미지의 유혹', en: 'Lure of the Unknown', cost: 0, speed: 'fast', kind: 'minor',
    elements: ['moon', 'fire', 'air', 'plant'], target: L('presence', 2, 'noinvaders'),
    text: '탐험가/마을 1개를 모읍니다.',
    async effect(ctx) { await ctx.gather(ET, 1); },
  },
  {
    id: 'natures_resilience', name: '자연의 회복력', en: "Nature's Resilience", cost: 1, speed: 'fast', kind: 'minor',
    elements: ['earth', 'plant', 'animal'], target: L('presence', 1),
    text: '방어 6. (물 2: 대신 황폐 1개를 제거할 수 있습니다.)',
    async effect(ctx) {
      if (ctx.has({ water: 2 }) && ctx.count('blight')) {
        const c = await ctx.choose('자연의 회복력', [{ value: 'def', label: '방어 6' }, { value: 'blight', label: '황폐 1개 제거' }]);
        if (c === 'blight') { ctx.removeBlight(); return; }
      }
      ctx.defend(6);
    },
  },
  {
    id: 'pull_beneath', name: '굶주린 대지 아래로', en: 'Pull Beneath the Hungry Earth', cost: 1, speed: 'slow', kind: 'minor',
    elements: ['moon', 'water', 'earth'], target: L('presence', 1),
    text: '대상 지역에 당신의 존재가 있으면 공포 1, 피해 1. 대상 지역이 사막/습지이면 피해 1.',
    async effect(ctx) {
      let d = 0;
      if (ctx.hasPresence()) { ctx.fear(1); d++; }
      if (ctx.terrainIs('S', 'W')) d++;
      if (d) ctx.damage(d);
    },
  },
  {
    id: 'purifying_flame', name: '정화의 불꽃', en: 'Purifying Flame', cost: 1, speed: 'slow', kind: 'minor',
    elements: ['sun', 'fire', 'air', 'plant'], target: L('sacred', 1),
    text: '황폐 1개당 피해 1. 대상 지역이 산/사막이면 대신 황폐 1개를 제거할 수 있습니다.',
    async effect(ctx) {
      if (ctx.terrainIs('M', 'S') && ctx.count('blight')) {
        const c = await ctx.choose('정화의 불꽃', [{ value: 'dmg', label: `피해 ${ctx.count('blight')}` }, { value: 'blight', label: '황폐 1개 제거' }]);
        if (c === 'blight') { ctx.removeBlight(); return; }
      }
      if (ctx.count('blight')) ctx.damage(ctx.count('blight'));
    },
  },
  {
    id: 'quicken_struggles', name: '대지의 투쟁 가속', en: "Quicken the Earth's Struggles", cost: 1, speed: 'fast', kind: 'minor',
    elements: ['moon', 'fire', 'earth', 'animal'], target: L('presence', 0),
    text: '각 마을/도시에 피해 1. 방어 10.',
    async effect(ctx) { ctx.damageEach(1, ['town', 'city']); ctx.defend(10); },
  },
  {
    id: 'rain_of_blood', name: '피의 비', en: 'Rain of Blood', cost: 0, speed: 'slow', kind: 'minor',
    elements: ['air', 'water', 'animal'], target: L('sacred', 1, 'invaders'),
    text: '공포 1. 대상 지역에 마을/도시가 2개 이상이면 공포 +1.',
    async effect(ctx) { ctx.fear(ctx.game.townCityCount(ctx.landId) >= 2 ? 2 : 1); },
  },
  {
    id: 'rouse_trees', name: '나무와 바위를 깨우다', en: 'Rouse the Trees and Stones', cost: 1, speed: 'slow', kind: 'minor',
    elements: ['fire', 'earth', 'plant'], target: L('presence', 1, 'noblight'),
    text: '피해 2. 탐험가 1개를 밀어냅니다.',
    async effect(ctx) { ctx.damage(2); await ctx.push(['explorer'], 1); },
  },
  {
    id: 'steam_vents', name: '증기 분출구', en: 'Steam Vents', cost: 1, speed: 'fast', kind: 'minor',
    elements: ['fire', 'air', 'water', 'earth'], target: L('presence', 1),
    text: '탐험가 1개를 파괴합니다. (대지 3: 대신 마을 1개를 파괴할 수 있습니다.)',
    async effect(ctx) {
      if (ctx.has({ earth: 3 }) && ctx.count('town')) await ctx.destroy(['town', 'explorer'], 1);
      else await ctx.destroy(['explorer'], 1);
    },
  },
  {
    id: 'uncanny_melting', name: '기묘한 융해', en: 'Uncanny Melting', cost: 1, speed: 'slow', kind: 'minor',
    elements: ['sun', 'moon', 'water'], target: L('sacred', 1),
    text: '침략자가 있으면 공포 1. 대상 지역이 사막/습지이면 황폐 1개를 제거합니다.',
    async effect(ctx) {
      if (ctx.invaderCount()) ctx.fear(1);
      if (ctx.terrainIs('S', 'W')) ctx.removeBlight();
    },
  },
  {
    id: 'veil_nights_hunt', name: '밤사냥의 장막', en: "Veil the Night's Hunt", cost: 1, speed: 'fast', kind: 'minor',
    elements: ['moon', 'air', 'animal'], target: L('presence', 2, 'dahan'),
    text: '각 다한이 서로 다른 침략자에게 피해 1을 줍니다. 또는 다한을 최대 3개 밀어냅니다.',
    async effect(ctx) {
      const c = await ctx.choose('밤사냥의 장막', [{ value: 'hunt', label: '다한 사냥 (침략자 각각 피해 1)' }, { value: 'push', label: '다한 최대 3개 밀어내기' }]);
      if (c === 'push') { await ctx.push(['dahan'], 3); return; }
      ctx.game.damageDifferent(ctx.landId, ctx.count('dahan'), 1);
    },
  },
  {
    id: 'visions_fiery_doom', name: '불타는 파멸의 환영', en: 'Visions of Fiery Doom', cost: 1, speed: 'fast', kind: 'minor',
    elements: ['moon', 'fire'], target: L('presence', 1),
    text: '공포 1. 탐험가/마을 1개를 밀어냅니다. (불 2: 공포 +1)',
    async effect(ctx) { ctx.fear(ctx.has({ fire: 2 }) ? 2 : 1); await ctx.push(ET, 1); },
  },
  {
    id: 'delusions_danger', name: '위험의 망상', en: 'Delusions of Danger', cost: 1, speed: 'fast', kind: 'minor',
    elements: ['sun', 'moon', 'air'], target: L('presence', 1),
    text: '탐험가 1개를 밀어냅니다. 또는 공포 2.',
    async effect(ctx) {
      const c = ctx.count('explorer') ? await ctx.choose('위험의 망상', [{ value: 'push', label: '탐험가 1개 밀어내기' }, { value: 'fear', label: '공포 2' }]) : 'fear';
      if (c === 'push') await ctx.push(['explorer'], 1, false); else ctx.fear(2);
    },
  },
  {
    id: 'land_haunts_embers', name: '유령과 잿불의 땅', en: 'Land of Haunts and Embers', cost: 0, speed: 'fast', kind: 'minor',
    elements: ['moon', 'fire', 'air'], target: L('presence', 2),
    text: '공포 2. 대상 지역에 황폐가 있으면 공포 +2. 탐험가/마을을 최대 2개 밀어냅니다. 황폐 1개를 추가합니다.',
    async effect(ctx) {
      ctx.fear(ctx.count('blight') ? 4 : 2);
      await ctx.push(ET, 2);
      ctx.addBlight();
    },
  },
  {
    id: 'savage_mawbeasts', name: '사나운 아가리 짐승', en: 'Savage Mawbeasts', cost: 0, speed: 'slow', kind: 'minor',
    elements: ['fire', 'animal'], target: L('sacred', 1),
    text: '대상 지역이 정글/습지이면 공포 1, 탐험가 1개를 파괴합니다. (짐승 3: 탐험가 1개를 추가로 파괴합니다.)',
    async effect(ctx) {
      if (!ctx.terrainIs('J', 'W')) { ctx.log('정글/습지가 아니어서 효과 없음'); return; }
      ctx.fear(1);
      await ctx.destroy(['explorer'], ctx.has({ animal: 3 }) ? 2 : 1);
    },
  },
  {
    id: 'song_of_sanctity', name: '성스러움의 노래', en: 'Song of Sanctity', cost: 1, speed: 'slow', kind: 'minor',
    elements: ['sun', 'water', 'plant'], target: L('presence', 1, 'M/J'),
    text: '탐험가가 1~2개 있으면 모든 탐험가를 밀어냅니다. 그렇지 않으면 황폐 1개를 제거합니다.',
    async effect(ctx) {
      const e = ctx.count('explorer');
      if (e >= 1 && e <= 2) await ctx.push(['explorer'], e, false); else ctx.removeBlight();
    },
  },
  {
    id: 'terrifying_nightmares', name: '끔찍한 악몽', en: 'Terrifying Nightmares', cost: 2, speed: 'fast', kind: 'minor',
    elements: ['moon'], target: L('presence', 1),
    text: '공포 2. 탐험가/마을을 최대 4개 밀어냅니다.',
    async effect(ctx) { ctx.fear(2); await ctx.push(ET, 4); },
  },
  {
    id: 'shadows_burning_forest', name: '불타는 숲의 그림자', en: 'Shadows of the Burning Forest', cost: 0, speed: 'slow', kind: 'minor',
    elements: ['moon', 'fire', 'plant'], target: L('presence', 0, 'invaders'),
    text: '공포 2. 대상 지역이 산/정글이면 탐험가 1개와 마을 1개를 밀어냅니다.',
    async effect(ctx) {
      ctx.fear(2);
      if (ctx.terrainIs('M', 'J')) { await ctx.push(['explorer'], 1, false); await ctx.push(['town'], 1, false); }
    },
  },
  {
    id: 'gnawing_rootbiters', name: '뿌리를 갉는 것들', en: 'Gnawing Rootbiters', cost: 0, speed: 'slow', kind: 'minor',
    elements: ['earth', 'animal'], target: L('presence', 1),
    text: '탐험가/마을을 최대 2개 밀어냅니다.',
    async effect(ctx) { await ctx.push(ET, 2); },
  },
  {
    id: 'animated_wrackroot', name: '살아난 썩은뿌리', en: 'Animated Wrackroot', cost: 0, speed: 'slow', kind: 'minor',
    elements: ['moon', 'fire', 'plant'], target: L('presence', 0),
    text: '탐험가 1개를 파괴합니다. 또는 공포 3과 함께 황폐 1개를 추가합니다.',
    async effect(ctx) {
      const c = await ctx.choose('살아난 썩은뿌리', [{ value: 'd', label: '탐험가 1개 파괴' }, { value: 'f', label: '공포 3 + 황폐 1개 추가' }]);
      if (c === 'd') await ctx.destroy(['explorer'], 1); else { ctx.fear(3); ctx.addBlight(); }
    },
  },

  // ───────────── 대형 권능 ─────────────
  {
    id: 'pillar_living_flame', name: '살아있는 불기둥', en: 'Pillar of Living Flame', cost: 5, speed: 'slow', kind: 'major',
    elements: ['fire'], target: L('sacred', 2),
    text: '공포 3. 피해 5. 대상 지역이 정글/습지이면 황폐 1개를 추가합니다.',
    threshold: { el: { fire: 4 }, text: '불 4: 공포 +2, 피해 +5.' },
    async effect(ctx) {
      const t = ctx.threshold();
      ctx.fear(t ? 5 : 3); ctx.damage(t ? 10 : 5);
      if (ctx.terrainIs('J', 'W')) ctx.addBlight();
    },
  },
  {
    id: 'tsunami', name: '해일', en: 'Tsunami', cost: 6, speed: 'slow', kind: 'major',
    elements: ['water', 'earth'], target: L('sacred', 2, 'coastal'),
    text: '공포 2. 피해 8. 다한 2개를 파괴합니다.',
    threshold: { el: { water: 3, earth: 2 }, text: '물 3 대지 2: 같은 보드의 다른 해안 지역마다 공포 1, 피해 4, 다한 1개 파괴.' },
    async effect(ctx) {
      const g = ctx.game;
      ctx.fear(2); ctx.damage(8); ctx.destroyDahan(2);
      if (ctx.threshold()) {
        for (const l of Object.values(g.lands)) {
          if (l.board === ctx.land.board && l.coastal && l.id !== ctx.landId) {
            g.addFear(1); g.damageInvaders(l.id, 4); g.destroyDahan(l.id, 1);
          }
        }
      }
    },
  },
  {
    id: 'jungle_hungers', name: '굶주린 정글', en: 'The Jungle Hungers', cost: 3, speed: 'slow', kind: 'major',
    elements: ['moon', 'plant'], target: L('presence', 1, 'J'),
    text: '모든 탐험가와 마을을 파괴합니다. 모든 다한을 파괴합니다.',
    threshold: { el: { moon: 2, plant: 3 }, text: '달 2 식물 3: 도시 1개를 파괴하고, 다한은 파괴하지 않습니다.' },
    async effect(ctx) {
      const t = ctx.threshold();
      ctx.destroyAll(['explorer', 'town']);
      if (t) await ctx.destroy(['city'], 1); else ctx.destroyDahan(99);
    },
  },
  {
    id: 'cleansing_floods', name: '정화의 홍수', en: 'Cleansing Floods', cost: 5, speed: 'slow', kind: 'major',
    elements: ['sun', 'water'], target: L('sacred', 1),
    text: '피해 4. 황폐 1개를 제거합니다.',
    threshold: { el: { water: 4 }, text: '물 4: 피해 +10.' },
    async effect(ctx) { ctx.damage(ctx.threshold() ? 14 : 4); ctx.removeBlight(); },
  },
  {
    id: 'accelerated_rot', name: '가속된 부패', en: 'Accelerated Rot', cost: 4, speed: 'slow', kind: 'major',
    elements: ['sun', 'water', 'plant'], target: L('presence', 2, 'J/W'),
    text: '공포 2. 피해 4.',
    threshold: { el: { sun: 3, water: 2, plant: 3 }, text: '태양 3 물 2 식물 3: 피해 +5, 황폐 1개 제거.' },
    async effect(ctx) {
      const t = ctx.threshold();
      ctx.fear(2); ctx.damage(t ? 9 : 4);
      if (t) ctx.removeBlight();
    },
  },
  {
    id: 'paralyzing_fright', name: '얼어붙는 공포', en: 'Paralyzing Fright', cost: 4, speed: 'fast', kind: 'major',
    elements: ['air', 'earth'], target: L('presence', 1),
    text: '공포 4. 이번 턴에 대상 지역의 침략자는 모든 행동을 건너뜁니다.',
    threshold: { el: { air: 2, earth: 3 }, text: '공기 2 대지 3: 공포 +4.' },
    async effect(ctx) { ctx.fear(ctx.threshold() ? 8 : 4); ctx.skipActions(); },
  },
  {
    id: 'vigor_breaking_dawn', name: '새벽의 활력', en: 'Vigor of the Breaking Dawn', cost: 3, speed: 'fast', kind: 'major',
    elements: ['sun', 'animal'], target: L('presence', 2, 'dahan'),
    text: '다한 1개당 피해 2.',
    threshold: { el: { sun: 3, animal: 2 }, text: '태양 3 짐승 2: 인접 지역의 다한을 최대 2개 모은 뒤 피해를 줍니다.' },
    async effect(ctx) {
      if (ctx.threshold()) await ctx.gather(['dahan'], 2);
      ctx.damage(2 * ctx.count('dahan'));
    },
  },
  {
    id: 'indomitable_claim', name: '불굴의 영유권', en: 'Indomitable Claim', cost: 4, speed: 'fast', kind: 'major',
    elements: ['sun', 'earth'], target: L('presence', 1),
    text: '대상 지역에 존재 1개를 추가합니다. 이번 턴에 대상 지역의 침략자는 모든 행동을 건너뜁니다.',
    threshold: { el: { sun: 2, earth: 3 }, text: '태양 2 대지 3: 침략자가 있으면 공포 3.' },
    async effect(ctx) {
      await ctx.addPresence();
      ctx.skipActions();
      if (ctx.threshold() && ctx.invaderCount()) ctx.fear(3);
    },
  },
  {
    id: 'powerstorm', name: '권능의 폭풍', en: 'Powerstorm', cost: 3, speed: 'fast', kind: 'major',
    elements: ['sun', 'fire', 'air'], target: S('any'),
    text: '대상 정령은 에너지 3을 얻습니다.',
    threshold: { el: { sun: 2, fire: 2, air: 3 }, text: '태양 2 불 2 공기 3: 대상 정령은 이번 턴에 비용 3 이하인 권능 카드 1장을 반복 사용할 수 있습니다.' },
    async effect(ctx) {
      ctx.gainEnergy(3, ctx.targetPid);
      if (ctx.threshold()) { ctx.target.repeats.push({ maxCost: 3 }); ctx.log(`${ctx.targetName}: 비용 3 이하 카드 1장 반복 가능`); }
    },
  },
  {
    id: 'overgrow_in_a_night', name: '하룻밤의 무성함', en: 'Overgrow in a Night', cost: 3, speed: 'fast', kind: 'major',
    elements: ['moon', 'plant'], target: L('presence', 1),
    text: '대상 지역에 존재 1개를 추가합니다.',
    threshold: { el: { moon: 1, plant: 3 }, text: '달 1 식물 3: 마을/도시가 있으면 공포 3.' },
    async effect(ctx) {
      await ctx.addPresence();
      if (ctx.threshold() && ctx.game.townCityCount(ctx.landId)) ctx.fear(3);
    },
  },
];

POWERS.push(...require('./powers_ext').POWERS_EXT);

const POWER_MAP = Object.fromEntries(POWERS.map((p) => [p.id, p]));

module.exports = { POWERS, POWER_MAP };
