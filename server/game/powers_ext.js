'use strict';
// 확장판 정령들의 고유 권능 카드. (원작을 바탕으로 온라인용으로 단순화)
const L = (from, range, filter = 'any') => ({ kind: 'land', from, range, filter });
const S = (filter = 'any') => ({ kind: 'spirit', filter });
const ET = ['explorer', 'town'];
const INV = ['explorer', 'town', 'city'];
const TC = ['town', 'city'];

const c = (id, name, en, cost, speed, elements, target, text, effect) => ({ id, name, en, cost, speed, kind: 'unique', elements, target, text, effect });
// 자주 쓰는 효과 조각
const boon = (n, els) => async (ctx) => {
  ctx.gainEnergy(n, ctx.targetPid);
  for (const e of els) ctx.target.bonusElements[e] = (ctx.target.bonusElements[e] || 0) + 1;
  if (els.length) ctx.log(`${ctx.targetName}: 원소 ${els.map((e) => ctx.game.constructor.ELEMENT_NAMES[e]).join('·')} 획득`);
};
const boonText = (n, names) => `대상 정령은 에너지 ${n}${names ? `과 이번 턴 동안 ${names} 원소를 1개씩` : ''} 얻습니다.`;

const POWERS_EXT = [
  // 잎사귀 뒤의 날카로운 송곳니
  c('prey_on_builders', '건설자를 사냥하다', 'Prey on the Builders', 1, 'fast', ['moon', 'fire', 'animal'], L('presence', 1), '피해 1. 이번 턴 이 지역에서 침략자는 건설하지 않습니다.',
    async (ctx) => { ctx.damage(1); ctx.land.flags.skipBuild = true; ctx.log(`${ctx.landId}: 이번 턴 건설하지 않음`); }),
  c('teeth_gleam', '어둠 속에 번뜩이는 이빨', 'Teeth Gleam from Darkness', 0, 'fast', ['moon', 'plant', 'animal'], L('presence', 1, 'invaders'), '공포 1. 대상 지역이 정글이면 공포 +1.',
    async (ctx) => { ctx.fear(ctx.terrainIs('J') ? 2 : 1); }),
  c('terrifying_chase', '공포의 추격', 'Terrifying Chase', 1, 'slow', ['sun', 'animal'], L('presence', 0), '공포 1. 탐험가/마을을 최대 2개 밀어냅니다.',
    async (ctx) => { ctx.fear(1); await ctx.push(ET, 2); }),
  c('too_near_jungle', '정글에 너무 가까이', 'Too Near the Jungle', 0, 'slow', ['plant', 'animal'], L('presence', 1, 'J/W'), '공포 1. 탐험가 1개를 파괴합니다.',
    async (ctx) => { ctx.fear(1); ctx.destroy(['explorer'], 1); }),

  // 섬 아래 잠든 뱀
  c('absorb_essence', '정수 흡수', 'Absorb Essence', 2, 'slow', ['moon', 'fire', 'water', 'earth'], S('any'), boonText(3, '대지'), boon(3, ['earth'])),
  c('gift_flowing_power', '흐르는 힘의 선물', 'Gift of Flowing Power', 1, 'fast', ['fire', 'water'], S('any'), boonText(1, '물·불'), boon(1, ['water', 'fire'])),
  c('primordial_deeps', '태초의 심연의 선물', 'Gift of the Primordial Deeps', 1, 'fast', ['moon', 'earth'], S('any'), '대상 정령은 소형 권능 1장을 얻습니다.',
    async (ctx) => { await ctx.game.gainPowerCard(ctx.targetPid, 'minor'); }),
  c('elemental_aegis', '원소의 방패', 'Elemental Aegis', 1, 'fast', ['fire', 'water', 'earth'], S('any'), '대상 정령의 존재가 있는 모든 지역에 방어 2.',
    async (ctx) => { for (const id of ctx.game.presenceLands(ctx.targetPid)) ctx.game.lands[id].defend += 2; ctx.log('존재가 있는 모든 지역에 방어 2'); }),

  // 세상을 적시는 폭우
  c('stinging_rain', '따가운 비', 'Dark Skies Loose a Stinging Rain', 1, 'fast', ['moon', 'air', 'water'], L('presence', 1), '피해 1. 공포 1.',
    async (ctx) => { ctx.fear(1); ctx.damage(1); }),
  c('foundations_sink', '진흙에 가라앉는 토대', 'Foundations Sink into Mud', 1, 'slow', ['water', 'earth'], L('presence', 1), '마을/도시에 피해 2. 대상 지역이 습지이면 피해 +1.',
    async (ctx) => { ctx.damage(ctx.terrainIs('W') ? 3 : 2, TC); }),
  c('gift_abundance', '풍요의 선물', 'Gift of Abundance', 0, 'fast', ['water', 'plant'], S('any'), boonText(1, '물·식물'), boon(1, ['water', 'plant'])),
  c('unbearable_deluge', '견딜 수 없는 폭우', 'Unbearable Deluge', 3, 'slow', ['air', 'water', 'earth'], L('presence', 1), '공포 2. 방어 2. 탐험가/마을을 최대 3개 밀어냅니다.',
    async (ctx) => { ctx.fear(2); ctx.defend(2); await ctx.push(ET, 3); }),

  // 보이지 않는 길을 찾는 자
  c('aid_spirit_speakers', '정령과 말하는 자들의 도움', 'Aid from the Spirit-Speakers', 1, 'fast', ['sun', 'air'], S('any'), boonText(2, '공기'), boon(2, ['air'])),
  c('paths_tied', '자연에 묶인 길', 'Paths Tied by Nature', 0, 'fast', ['air', 'earth', 'plant'], L('presence', 1), '탐험가를 최대 2개 밀어냅니다. 또는 다한을 최대 2개 모읍니다.',
    async (ctx) => {
      const v = await ctx.choose('자연에 묶인 길', [{ value: 'p', label: '탐험가 최대 2개 밀어내기' }, { value: 'g', label: '다한 최대 2개 모으기' }]);
      if (v === 'p') await ctx.push(['explorer'], 2); else await ctx.gather(['dahan'], 2);
    }),
  c('circuitous_journey', '굽이굽이 먼 여정', 'A Circuitous and Wending Journey', 1, 'slow', ['moon', 'air'], L('presence', 2), '공포 1. 탐험가/마을을 최대 2개 밀어냅니다.',
    async (ctx) => { ctx.fear(1); await ctx.push(ET, 2); }),
  c('trails_reconnect', '다시 이어지는 옛길', 'Ancient Trails Reconnect', 1, 'fast', ['sun', 'moon', 'air'], L('presence', 1), '대상 지역에 존재 1개를 추가합니다.',
    async (ctx) => { await ctx.addPresence(); }),

  // 씨익 웃는 사기꾼
  c('impersonate_authority', '관리 사칭', 'Impersonate Authority', 1, 'slow', ['moon', 'air', 'animal'], L('presence', 1, 'invaders'), '공포 1. 마을 1개를 밀어냅니다.',
    async (ctx) => { ctx.fear(1); await ctx.push(['town'], 1, false); }),
  c('inciting_whispers', '부추기는 속삭임', 'Inciting Whispers', 1, 'fast', ['sun', 'moon', 'air'], L('presence', 1, 'invaders'), '공포 2.',
    async (ctx) => { ctx.fear(2); }),
  c('overenthusiastic_arson', '지나친 방화', 'Overenthusiastic Arson', 1, 'fast', ['fire', 'air'], L('presence', 1), '마을 1개를 파괴합니다. 황폐 1개를 추가합니다. (불 2: 황폐를 추가하지 않습니다)',
    async (ctx) => { ctx.destroy(['town'], 1); if (!ctx.has({ fire: 2 })) ctx.addBlight(); }),
  c('unexpected_tigers', '뜻밖의 호랑이', 'Unexpected Tigers', 0, 'slow', ['moon', 'animal'], L('presence', 1, 'invaders'), '공포 1. 탐험가 1개를 파괴합니다.',
    async (ctx) => { ctx.fear(1); ctx.destroy(['explorer'], 1); }),

  // 깊은 황야의 유혹
  c('gift_untamed_wild', '길들지 않은 야생의 선물', 'Gift of the Untamed Wild', 0, 'slow', ['moon', 'fire', 'air', 'plant'], S('any'), boonText(1, '식물·짐승'), boon(1, ['plant', 'animal'])),
  c('perils_deepest', '섬 깊은 곳의 위험', 'Perils of the Deepest Island', 1, 'slow', ['moon', 'plant', 'animal'], L('presence', 1, 'inland'), '피해 2. 대상 지역이 정글이면 공포 1.',
    async (ctx) => { if (ctx.terrainIs('J')) ctx.fear(1); ctx.damage(2); }),
  c('beckon_inward', '안으로 부르는 손짓', 'Softly Beckon Ever Inward', 2, 'slow', ['moon', 'air'], L('presence', 0, 'inland'), '탐험가를 최대 3개 모읍니다.',
    async (ctx) => { await ctx.gather(['explorer'], 3); }),
  c('swallowed_wilderness', '황야에 삼켜지다', 'Swallowed by the Wilderness', 1, 'fast', ['fire', 'air', 'plant', 'animal'], L('presence', 0), '공포 1. 탐험가 2개를 파괴합니다.',
    async (ctx) => { ctx.fear(1); ctx.destroy(['explorer'], 2); }),

  // 하나처럼 움직이는 무리
  c('swarming_bedevilment', '무리의 괴롭힘', 'Boon of Swarming Bedevilment', 0, 'fast', ['air', 'water', 'animal'], S('any'), '대상 정령의 존재가 있는 모든 지역에 방어 1.',
    async (ctx) => { for (const id of ctx.game.presenceLands(ctx.targetPid)) ctx.game.lands[id].defend += 1; ctx.log('존재가 있는 모든 지역에 방어 1'); }),
  c('ever_multiplying', '끝없이 불어나는 무리', 'Ever-Multiplying Swarm', 1, 'fast', ['fire', 'plant', 'animal'], L('presence', 1), '대상 지역에 존재 1개를 추가합니다.',
    async (ctx) => { await ctx.addPresence(); }),
  c('feathered_wings', '깃털 날개로 길을 안내', 'Guide the Way on Feathered Wings', 1, 'fast', ['sun', 'air', 'animal'], L('presence', 1), '다한을 최대 2개 모읍니다. 방어 1.',
    async (ctx) => { await ctx.gather(['dahan'], 2); ctx.defend(1); }),
  c('pursue_stings', '쪼고 쏘는 추격', 'Pursue with Scratches, Pecks, and Stings', 1, 'slow', ['sun', 'fire', 'air', 'animal'], L('presence', 1), '공포 1. 피해 1. 탐험가/마을 1개를 밀어냅니다.',
    async (ctx) => { ctx.fear(1); ctx.damage(1); await ctx.push(ET, 1); }),

  // 변화하는 시대의 기억
  c('boon_ancient_memories', '오래된 기억의 은총', 'Boon of Ancient Memories', 1, 'slow', ['moon', 'water', 'earth'], S('any'), '대상 정령은 소형 권능 1장을 얻습니다.',
    async (ctx) => { await ctx.game.gainPowerCard(ctx.targetPid, 'minor'); }),
  c('elemental_teachings', '원소의 가르침', 'Elemental Teachings', 1, 'fast', ['sun', 'moon', 'earth'], S('any'), '대상 정령은 이번 턴 동안 태양·달·대지 원소를 1개씩 얻습니다.', boon(0, ['sun', 'moon', 'earth'])),
  c('share_survival', '생존의 비밀 전수', 'Share Secrets of Survival', 0, 'fast', ['sun', 'air', 'earth'], L('presence', 1), '방어 3. 이번 턴 다한은 약탈 피해를 받지 않습니다.',
    async (ctx) => { ctx.defend(3); ctx.land.flags.dahanProtected = true; }),
  c('study_fears', '침략자의 두려움 연구', "Study the Invaders' Fears", 0, 'slow', ['moon', 'air', 'animal'], L('presence', 0, 'invaders'), '공포 2. 탐험가 1개를 밀어냅니다.',
    async (ctx) => { ctx.fear(2); await ctx.push(['explorer'], 1, false); }),

  // 고요한 안개의 장막
  c('dissolving_vapors', '녹아드는 수증기', 'Dissolving Vapors', 1, 'slow', ['moon', 'air', 'water'], L('presence', 1), '공포 1. 탐험가 1개를 파괴합니다. 마을/도시에 피해 1.',
    async (ctx) => { ctx.fear(1); ctx.destroy(['explorer'], 1); ctx.damage(1, TC); }),
  c('fog_closes_in', '짙어지는 안개', 'The Fog Closes In', 0, 'slow', ['moon', 'air', 'water'], L('presence', 1), '공포 1. 방어 2.',
    async (ctx) => { ctx.fear(1); ctx.defend(2); }),
  c('silent_forms', '소리 없이 스치는 형체', 'Flowing and Silent Forms Dart By', 0, 'fast', ['moon', 'air', 'water'], L('presence', 1), '탐험가/다한을 최대 2개 밀어냅니다.',
    async (ctx) => { await ctx.push(['explorer', 'dahan'], 2); }),
  c('unnerving_pall', '불안한 장막', 'Unnerving Pall', 1, 'fast', ['moon', 'air', 'animal'], L('presence', 1, 'invaders'), '공포 2. 이번 턴 다한은 약탈 피해를 받지 않습니다.',
    async (ctx) => { ctx.fear(2); ctx.land.flags.dahanProtected = true; }),

  // 형태를 찾는 별빛
  c('boon_reimagining', '재상상의 은총', 'Boon of Reimagining', 1, 'fast', ['moon', 'air'], S('any'), boonText(2, '달'), boon(2, ['moon'])),
  c('gather_starlight', '흩어진 별빛 모으기', 'Gather the Scattered Light of Stars', 0, 'slow', ['moon', 'air', 'water'], S('self'), '소형 권능 1장을 얻습니다.',
    async (ctx) => { await ctx.game.gainPowerCard(ctx.pid, 'minor'); }),
  c('peace_nighttime', '밤하늘의 평화', 'Peace of the Nighttime Sky', 1, 'fast', ['moon', 'water'], L('presence', 1), '이번 턴 이 지역에서 침략자는 약탈하지 않습니다.',
    async (ctx) => { ctx.land.flags.skipRavage = true; ctx.log(`${ctx.landId}: 이번 턴 약탈하지 않음`); }),
  c('shape_self', '스스로를 다시 빚다', 'Shape the Self Anew', 0, 'fast', ['moon', 'earth'], L('presence', 1), '대상 지역에 존재 1개를 추가합니다.',
    async (ctx) => { await ctx.addPresence(); }),

  // 하늘을 가르는 조각난 나날
  c('absolute_stasis', '완전한 정지', 'Absolute Stasis', 2, 'fast', ['sun', 'air', 'earth'], L('presence', 1), '이번 턴 대상 지역의 침략자는 모든 행동을 건너뜁니다.',
    async (ctx) => { ctx.skipActions(); }),
  c('blur_arc_years', '흐려진 세월', 'Blur the Arc of Years', 1, 'slow', ['sun', 'moon', 'air'], L('presence', 1), '공포 1. 마을 1개를 탐험가 1개로 교체합니다.',
    async (ctx) => { ctx.fear(1); ctx.replace('town', 'explorer'); }),
  c('pour_time_sideways', '옆으로 흐르는 시간', 'Pour Time Sideways', 1, 'fast', ['moon', 'air', 'water'], S('any'), '대상 정령은 이번 턴에 비용 2 이하 권능 카드 1장을 한 번 더 사용할 수 있습니다.',
    async (ctx) => { ctx.target.repeats.push({ maxCost: 2 }); ctx.log(`${ctx.targetName}: 비용 2 이하 카드 1장 반복 사용 가능`); }),
  c('past_returns', '되돌아오는 과거', 'The Past Returns Again', 0, 'slow', ['sun', 'moon'], L('presence', 1), '황폐가 있으면 황폐 1개를 제거합니다. 없으면 공포 1.',
    async (ctx) => { if (ctx.count('blight')) ctx.removeBlight(); else ctx.fear(1); }),

  // 불타는 역병 같은 복수
  c('fiery_vengeance', '불꽃 같은 복수', 'Fiery Vengeance', 0, 'fast', ['sun', 'fire'], L('presence', 1), '피해 1.',
    async (ctx) => { ctx.damage(1); }),
  c('fetid_breath', '악취 나는 숨결', 'Fetid Breath Spreads Infection', 1, 'slow', ['fire', 'water', 'animal'], L('presence', 1), '공포 1. 각 탐험가에게 피해 1.',
    async (ctx) => { ctx.fear(1); ctx.damageEach(1, ['explorer']); }),
  c('plaguebearers', '역병을 옮기는 자', 'Plaguebearers', 1, 'slow', ['fire', 'water', 'animal'], L('presence', 2, 'invaders'), '공포 2. 마을/도시에 피해 1.',
    async (ctx) => { ctx.fear(2); ctx.damage(1, TC); }),
  c('strike_fevers', '갑작스러운 열병', 'Strike Low with Sudden Fevers', 1, 'fast', ['fire', 'air', 'earth', 'animal'], L('presence', 1), '공포 1. 마을/도시에 피해 2.',
    async (ctx) => { ctx.fear(1); ctx.damage(2, TC); }),

  // 발밑에 도사린 이빨
  c('gift_furious_might', '맹렬한 힘의 선물', 'Gift of Furious Might', 1, 'fast', ['fire', 'animal'], S('any'), boonText(1, '불·짐승'), boon(1, ['fire', 'animal'])),
  c('hungry_sinkhole', '굶주린 싱크홀', 'Hungry Sinkhole', 1, 'slow', ['earth', 'animal'], L('presence', 1), '피해 2.',
    async (ctx) => { ctx.damage(2); }),
  c('swallow_whole', '통째로 삼키다', 'Swallow Them Whole', 2, 'slow', ['fire', 'earth', 'animal'], L('presence', 0), '마을 1개와 탐험가 1개를 파괴합니다.',
    async (ctx) => { ctx.destroy(['town'], 1); ctx.destroy(['explorer'], 1); }),
  c('rumbling_earth', '우르릉거리는 땅', 'Rumbling Earth', 0, 'fast', ['earth', 'animal'], L('presence', 1), '공포 1. 탐험가 1개를 밀어냅니다.',
    async (ctx) => { ctx.fear(1); await ctx.push(['explorer'], 1, false); }),

  // 나무에서 지켜보는 눈
  c('boon_of_watching', '지켜봄의 은총', 'Boon of Watching', 0, 'fast', ['moon', 'plant'], S('any'), boonText(1, '달·식물'), boon(1, ['moon', 'plant'])),
  c('mysterious_abductions', '의문의 실종', 'Mysterious Abductions', 1, 'slow', ['moon', 'air', 'plant'], L('presence', 1), '공포 1. 탐험가 1개를 파괴합니다.',
    async (ctx) => { ctx.fear(1); ctx.destroy(['explorer'], 1); }),
  c('shadowed_path', '그늘진 오솔길', 'Shadowed Path', 1, 'fast', ['moon', 'plant', 'animal'], L('presence', 1), '공포 1. 탐험가를 최대 2개 밀어냅니다.',
    async (ctx) => { ctx.fear(1); await ctx.push(['explorer'], 2); }),
  c('watchful_ambush', '숨어서 기다리는 매복', 'Watchful Ambush', 1, 'fast', ['sun', 'plant', 'animal'], L('presence', 1), '다한을 최대 1개 모읍니다. 다한 1개당 탐험가 1개를 파괴합니다.',
    async (ctx) => { await ctx.gather(['dahan'], 1); if (ctx.count('dahan')) ctx.destroy(['explorer'], ctx.count('dahan')); }),

  // 끝없는 늪의 진흙
  c('gift_of_swamp', '늪의 선물', 'Gift of the Swamp', 1, 'fast', ['water', 'earth'], S('any'), boonText(1, '물·대지'), boon(1, ['water', 'earth'])),
  c('sucking_ooze', '빨아들이는 진창', 'Sucking Ooze', 1, 'slow', ['water', 'earth', 'plant'], L('presence', 1), '탐험가/마을에 피해 2.',
    async (ctx) => { ctx.damage(2, ET); }),
  c('mire', '수렁', 'Mire', 0, 'fast', ['moon', 'water', 'earth'], L('presence', 1), '공포 1. 이번 턴 이 지역에서 침략자는 건설하지 않습니다.',
    async (ctx) => { ctx.fear(1); ctx.land.flags.skipBuild = true; ctx.log(`${ctx.landId}: 이번 턴 건설하지 않음`); }),
  c('swallowed_by_mud', '진흙에 삼켜지다', 'Swallowed by the Mud', 2, 'slow', ['water', 'earth', 'animal'], L('presence', 0), '마을 1개와 탐험가 2개를 파괴합니다.',
    async (ctx) => { ctx.destroy(['town'], 1); ctx.destroy(['explorer'], 2); }),

  // 돌과 모래의 끓는 열기
  c('harden_heat', '열기로 굳히다', 'Harden in the Heat', 1, 'fast', ['sun', 'earth'], L('presence', 1), '방어 2. 피해 1.',
    async (ctx) => { ctx.defend(2); ctx.damage(1); }),
  c('blistering_heat', '살을 태우는 열기', 'Blistering Heat', 1, 'slow', ['sun', 'fire', 'earth'], L('presence', 1), '피해 2.',
    async (ctx) => { ctx.damage(2); }),
  c('shimmering_mirage', '일렁이는 신기루', 'Shimmering Mirage', 0, 'fast', ['sun', 'air'], L('presence', 1), '공포 1. 탐험가 1개를 밀어냅니다.',
    async (ctx) => { ctx.fear(1); await ctx.push(['explorer'], 1, false); }),
  c('scorching_convection', '타오르는 대류', 'Scorching Convection', 2, 'slow', ['sun', 'fire', 'air'], L('presence', 1), '공포 1. 각 마을/도시에 피해 1.',
    async (ctx) => { ctx.fear(1); ctx.damageEach(1, TC); }),

  // 햇빛 회오리
  c('gift_of_winds', '바람의 선물', 'Gift of Winds', 0, 'fast', ['sun', 'air'], S('any'), boonText(1, '태양·공기'), boon(1, ['sun', 'air'])),
  c('sweep_away', '휩쓸어 가다', 'Sweep Away', 1, 'slow', ['air', 'water'], L('presence', 1), '탐험가를 최대 3개 밀어냅니다.',
    async (ctx) => { await ctx.push(['explorer'], 3); }),
  c('dazzling_light', '눈부신 빛', 'Dazzling Light', 1, 'fast', ['sun', 'air'], L('presence', 1, 'invaders'), '공포 2.',
    async (ctx) => { ctx.fear(2); }),
  c('whirling_debris', '소용돌이치는 잔해', 'Whirling Debris', 2, 'slow', ['sun', 'air', 'earth'], L('presence', 1), '피해 2. 탐험가 1개를 밀어냅니다.',
    async (ctx) => { ctx.damage(2); await ctx.push(['explorer'], 1, false); }),

  // 등골을 타고 내리는 어둠의 숨결
  c('terror_in_dark', '어둠 속의 공포', 'Terror in the Dark', 1, 'fast', ['moon', 'air'], L('presence', 1, 'invaders'), '공포 2.',
    async (ctx) => { ctx.fear(2); }),
  c('snatched_away', '낚아채이다', 'Snatched Away', 1, 'slow', ['moon', 'air', 'animal'], L('presence', 1), '탐험가 1개를 파괴합니다. 마을 1개를 밀어냅니다.',
    async (ctx) => { ctx.destroy(['explorer'], 1); await ctx.push(['town'], 1, false); }),
  c('creeping_dread', '스며드는 두려움', 'Creeping Dread', 0, 'fast', ['moon', 'animal'], L('presence', 1, 'invaders'), '공포 1. 방어 1.',
    async (ctx) => { ctx.fear(1); ctx.defend(1); }),
  c('swallowing_night', '삼키는 밤', 'Swallowing Night', 2, 'slow', ['moon', 'fire', 'air'], L('presence', 0), '공포 2. 피해 2.',
    async (ctx) => { ctx.fear(2); ctx.damage(2); }),

  // 지진을 춤추는 자
  c('quake_steps', '흔들리는 발걸음', 'Quaking Steps', 1, 'fast', ['fire', 'earth'], L('presence', 1), '피해 1. 각 마을에 피해 1.',
    async (ctx) => { ctx.damage(1); ctx.damageEach(1, ['town']); }),
  c('tremors', '미진', 'Tremors', 0, 'slow', ['earth', 'animal'], L('presence', 1), '공포 1. 탐험가 1개를 밀어냅니다.',
    async (ctx) => { ctx.fear(1); await ctx.push(['explorer'], 1, false); }),
  c('rift', '갈라지는 대지', 'Rift', 2, 'slow', ['fire', 'earth'], L('presence', 1), '피해 3.',
    async (ctx) => { ctx.damage(3); }),
  c('dance_shakes', '땅을 흔드는 춤', 'The Dance Shakes the Land', 1, 'fast', ['sun', 'fire', 'earth'], S('any'), boonText(1, '대지·불'), boon(1, ['earth', 'fire'])),

  // 잿불 눈의 거수
  c('crushing_stride', '짓밟는 걸음', 'Crushing Stride', 2, 'slow', ['fire', 'earth', 'animal'], L('presence', 1), '피해 3.',
    async (ctx) => { ctx.damage(3); }),
  c('behemoth_roar', '거수의 포효', "Behemoth's Roar", 1, 'fast', ['fire', 'air', 'animal'], L('presence', 1), '공포 2. 탐험가 1개를 밀어냅니다.',
    async (ctx) => { ctx.fear(2); await ctx.push(['explorer'], 1, false); }),
  c('ember_gaze', '잿불의 눈빛', 'Ember Gaze', 1, 'fast', ['sun', 'fire'], L('presence', 1), '마을/도시에 피해 2.',
    async (ctx) => { ctx.damage(2, TC); }),
  c('trample', '짓뭉개기', 'Trample', 0, 'slow', ['earth', 'animal'], L('presence', 0), '탐험가 2개를 파괴합니다. 다한 1개를 파괴합니다.',
    async (ctx) => { ctx.destroy(['explorer'], 2); ctx.destroyDahan(1); }),

  // 화롯가의 파수꾼
  c('warm_welcome', '따뜻한 환대', 'Warm Welcome', 0, 'fast', ['sun', 'fire', 'animal'], L('presence', 1), '다한을 최대 2개 모읍니다. 방어 2.',
    async (ctx) => { await ctx.gather(['dahan'], 2); ctx.defend(2); }),
  c('fortify_homes', '집을 굳건히', 'Fortify the Homes', 1, 'fast', ['sun', 'earth', 'animal'], L('presence', 1, 'dahan'), '다한 1개당 방어 1, 추가로 방어 2.',
    async (ctx) => { ctx.defend(ctx.count('dahan') + 2); }),
  c('call_to_vigil', '파수의 부름', 'Call to Vigil', 1, 'slow', ['sun', 'fire', 'plant'], L('presence', 1), '다한이 있으면 다한 1개를 추가합니다. 없으면 공포 1.',
    async (ctx) => { if (ctx.count('dahan')) ctx.add('dahan', 1); else ctx.fear(1); }),
  c('flames_of_hearth', '화롯불의 불꽃', 'Flames of the Hearth', 1, 'slow', ['fire', 'animal'], L('presence', 1, 'dahan'), '다한 1개당 피해 1.',
    async (ctx) => { ctx.damage(ctx.count('dahan')); }),

  // 끈질긴 태양의 시선
  c('blinding_glare', '눈을 멀게 하는 섬광', 'Blinding Glare', 1, 'fast', ['sun', 'air'], L('presence', 1), '공포 1. 이번 턴 이 지역에서 침략자는 약탈하지 않습니다.',
    async (ctx) => { ctx.fear(1); ctx.land.flags.skipRavage = true; ctx.log(`${ctx.landId}: 이번 턴 약탈하지 않음`); }),
  c('withering_heat', '시들게 하는 열기', 'Withering Heat', 2, 'slow', ['sun', 'fire'], L('presence', 1), '공포 1. 피해 2.',
    async (ctx) => { ctx.fear(1); ctx.damage(2); }),
  c('unrelenting_light', '끊임없는 빛', 'Unrelenting Light', 0, 'fast', ['sun'], L('presence', 1, 'invaders'), '공포 1. 도시가 있으면 공포 +1.',
    async (ctx) => { ctx.fear(ctx.count('city') ? 2 : 1); }),
  c('focused_beam', '집중된 광선', 'Focused Beam', 3, 'slow', ['sun', 'fire', 'air'], L('presence', 2), '피해 4.',
    async (ctx) => { ctx.damage(4); }),

  // 치솟는 정글의 뿌리
  c('entwining_roots', '휘감는 뿌리', 'Entwining Roots', 1, 'fast', ['earth', 'plant'], L('presence', 1), '방어 3. 탐험가 1개를 밀어냅니다.',
    async (ctx) => { ctx.defend(3); await ctx.push(['explorer'], 1, false); }),
  c('grow_tall', '높이 자라다', 'Grow Tall', 1, 'fast', ['sun', 'plant'], L('presence', 1), '대상 지역에 존재 1개를 추가합니다.',
    async (ctx) => { await ctx.addPresence(); }),
  c('reclaim_ground', '땅을 되찾다', 'Reclaim the Ground', 1, 'slow', ['water', 'earth', 'plant'], L('presence', 1, 'blight'), '황폐 1개를 제거합니다.',
    async (ctx) => { ctx.removeBlight(); }),
  c('roots_crack_stone', '돌을 쪼개는 뿌리', 'Roots Crack the Stone', 2, 'slow', ['earth', 'plant'], L('presence', 1), '공포 1. 각 마을/도시에 피해 1.',
    async (ctx) => { ctx.fear(1); ctx.damageEach(1, TC); }),

  // 방황하는 목소리의 광란
  c('echoing_cry', '메아리치는 울음', 'Echoing Cry', 1, 'fast', ['moon', 'air'], L('presence', 2, 'invaders'), '공포 2.',
    async (ctx) => { ctx.fear(2); }),
  c('maddening_whispers', '미치게 하는 속삭임', 'Maddening Whispers', 1, 'slow', ['moon', 'air', 'animal'], L('presence', 1), '공포 1. 탐험가/마을 1개를 밀어냅니다.',
    async (ctx) => { ctx.fear(1); await ctx.push(ET, 1); }),
  c('delirium', '섬망', 'Delirium', 0, 'fast', ['moon', 'air'], L('presence', 1, 'invaders'), '이번 턴 이 지역에서 침략자는 건설하지 않습니다.',
    async (ctx) => { ctx.land.flags.skipBuild = true; ctx.log(`${ctx.landId}: 이번 턴 건설하지 않음`); }),
  c('keening_wail', '날카로운 통곡', 'Keening Wail', 2, 'slow', ['moon', 'fire', 'air'], L('presence', 1, 'invaders'), '공포 3.',
    async (ctx) => { ctx.fear(3); }),

  // 피 흘리는 상처 입은 물
  c('bleeding_currents', '피 흘리는 물살', 'Bleeding Currents', 1, 'fast', ['water', 'animal'], L('presence', 1), '피해 1.',
    async (ctx) => { ctx.damage(1); }),
  c('cleansing_tears', '정화의 눈물', 'Cleansing Tears', 1, 'slow', ['sun', 'water', 'plant'], L('presence', 1, 'blight'), '황폐 1개를 제거합니다. 방어 2.',
    async (ctx) => { ctx.removeBlight(); ctx.defend(2); }),
  c('vengeful_tide', '복수의 물결', 'Vengeful Tide', 2, 'slow', ['fire', 'water', 'animal'], L('presence', 1), '공포 1. 피해 2.',
    async (ctx) => { ctx.fear(1); ctx.damage(2); }),
  c('waters_remember', '물은 기억한다', 'The Waters Remember', 0, 'fast', ['moon', 'water'], S('any'), boonText(1, '물·짐승'), boon(1, ['water', 'animal'])),
];

module.exports = { POWERS_EXT, INV };
