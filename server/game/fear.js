'use strict';
// 공포 카드. 각 카드는 공포 단계(1~3)별 효과를 가진다.
// effect(game)는 침략자 단계에 해결된다.

const ET = ['explorer', 'town'];
const inland = (l) => !l.coastal;
const coastal = (l) => l.coastal;

const FEAR_CARDS = [
  {
    id: 'scapegoats', name: '희생양',
    levels: [
      { text: '각 마을은 같은 지역의 탐험가 1개를 파괴합니다.', async effect(g) { g.forEachLand((l) => g.removePieces(l.id, 'explorer', l.towns.length)); } },
      { text: '각 마을은 탐험가 1개를, 각 도시는 탐험가 2개를 파괴합니다.', async effect(g) { g.forEachLand((l) => g.removePieces(l.id, 'explorer', l.towns.length + 2 * l.cities.length)); } },
      {
        text: '마을/도시가 있는 지역의 모든 탐험가를 파괴합니다. 각 도시는 같은 지역의 마을 1개를 파괴합니다.',
        async effect(g) {
          g.forEachLand((l) => {
            if (l.towns.length + l.cities.length) g.removePieces(l.id, 'explorer', l.explorers);
            g.removePieces(l.id, 'town', l.cities.length);
          });
        },
      },
    ],
  },
  {
    id: 'retreat', name: '후퇴!',
    levels: [
      { text: '각 플레이어는 내륙 지역 하나에서 탐험가를 최대 2개 밀어낼 수 있습니다.', async effect(g) { await g.eachPlayerPushes(['explorer'], 2, inland, '내륙'); } },
      { text: '각 플레이어는 내륙 지역 하나에서 탐험가를 최대 3개 밀어낼 수 있습니다.', async effect(g) { await g.eachPlayerPushes(['explorer'], 3, inland, '내륙'); } },
      { text: '각 플레이어는 내륙 지역 하나에서 탐험가/마을을 원하는 만큼 밀어낼 수 있습니다.', async effect(g) { await g.eachPlayerPushes(ET, 99, inland, '내륙'); } },
    ],
  },
  {
    id: 'wary_interior', name: '내륙에 대한 경계',
    levels: [
      { text: '각 플레이어는 내륙 지역 하나에서 탐험가 1개를 제거합니다.', async effect(g) { await g.eachPlayerRemoves(['explorer'], 1, inland, '내륙'); } },
      { text: '각 플레이어는 내륙 지역 하나에서 탐험가/마을 1개를 제거합니다.', async effect(g) { await g.eachPlayerRemoves(ET, 1, inland, '내륙'); } },
      { text: '각 플레이어는 아무 지역에서 탐험가/마을 1개를 제거합니다.', async effect(g) { await g.eachPlayerRemoves(ET, 1, () => true, '아무'); } },
    ],
  },
  {
    id: 'emigration', name: '이주 가속',
    levels: [
      { text: '각 플레이어는 해안 지역 하나에서 탐험가 1개를 제거합니다.', async effect(g) { await g.eachPlayerRemoves(['explorer'], 1, coastal, '해안'); } },
      { text: '각 플레이어는 해안 지역 하나에서 탐험가/마을 1개를 제거합니다.', async effect(g) { await g.eachPlayerRemoves(ET, 1, coastal, '해안'); } },
      { text: '각 플레이어는 아무 지역에서 탐험가/마을 1개를 제거합니다.', async effect(g) { await g.eachPlayerRemoves(ET, 1, () => true, '아무'); } },
    ],
  },
  {
    id: 'avoid_dahan', name: '다한 회피',
    levels: [
      { text: '이번 턴, 침략자는 다한이 2개 이상인 지역을 탐험하지 않습니다.', async effect(g) { g.addTurnRule('noExplore', (l) => l.dahan.length >= 2, '다한 2+ 지역 탐험 안 함'); } },
      { text: '이번 턴, 침략자는 다한 수가 마을/도시보다 많은 지역에 건설하지 않습니다.', async effect(g) { g.addTurnRule('noBuild', (l) => l.dahan.length > l.towns.length + l.cities.length, '다한 > 마을/도시인 지역 건설 안 함'); } },
      { text: '이번 턴, 침략자는 다한이 있는 지역에 건설하지 않습니다.', async effect(g) { g.addTurnRule('noBuild', (l) => l.dahan.length > 0, '다한이 있는 지역 건설 안 함'); } },
    ],
  },
  {
    id: 'overseas_trade', name: '해외 무역이 더 안전해 보인다',
    levels: [
      { text: '모든 해안 지역에 방어 3.', async effect(g) { g.forEachLand((l) => { if (l.coastal) l.defend += 3; }); } },
      { text: '모든 해안 지역에 방어 6. 이번 턴, 해안 지역에 도시를 건설하지 않습니다.', async effect(g) { g.forEachLand((l) => { if (l.coastal) l.defend += 6; }); g.addTurnRule('noBuildCity', coastal, '해안 지역 도시 건설 안 함'); } },
      { text: '모든 해안 지역에 방어 9. 이번 턴, 해안 지역에 건설하지 않습니다.', async effect(g) { g.forEachLand((l) => { if (l.coastal) l.defend += 9; }); g.addTurnRule('noBuild', coastal, '해안 지역 건설 안 함'); } },
    ],
  },
  {
    id: 'dahan_on_guard', name: '경계하는 다한',
    levels: [
      { text: '각 지역에 다한 1개당 방어 1.', async effect(g) { g.forEachLand((l) => { l.defend += l.dahan.length; }); } },
      { text: '각 지역에 다한 1개당 방어 2.', async effect(g) { g.forEachLand((l) => { l.defend += 2 * l.dahan.length; }); } },
      { text: '각 지역에 다한 1개당 방어 3.', async effect(g) { g.forEachLand((l) => { l.defend += 3 * l.dahan.length; }); } },
    ],
  },
  {
    id: 'isolation', name: '고립',
    levels: [
      { text: '각 플레이어는 침략자가 1개뿐인 지역에서 탐험가/마을 1개를 제거합니다.', async effect(g) { await g.eachPlayerRemoves(ET, 1, (l) => g.invaderCount(l.id) === 1, '침략자 1개뿐인'); } },
      { text: '각 플레이어는 침략자가 2개 이하인 지역에서 탐험가/마을 1개를 제거합니다.', async effect(g) { await g.eachPlayerRemoves(ET, 1, (l) => g.invaderCount(l.id) <= 2, '침략자 2개 이하'); } },
      { text: '각 플레이어는 침략자가 3개 이하인 지역에서 침략자 1개를 제거합니다.', async effect(g) { await g.eachPlayerRemoves(['explorer', 'town', 'city'], 1, (l) => g.invaderCount(l.id) <= 3, '침략자 3개 이하'); } },
    ],
  },
  {
    id: 'tall_tales', name: '야만에 관한 무서운 소문',
    levels: [
      { text: '각 플레이어는 다한이 있는 지역 하나에서 탐험가 1개를 제거합니다.', async effect(g) { await g.eachPlayerRemoves(['explorer'], 1, (l) => l.dahan.length > 0, '다한이 있는'); } },
      { text: '각 플레이어는 다한이 있는 지역 하나에서 탐험가 2개 또는 마을 1개를 제거합니다.', async effect(g) { await g.eachPlayerRemovesTwoOrTown((l) => l.dahan.length > 0, '다한이 있는'); } },
      {
        text: '다한이 있는 각 지역에서 탐험가 2개 또는 마을 1개를 제거합니다. 그 후 다한이 2개 이상인 각 지역에서 도시 1개를 제거합니다.',
        async effect(g) {
          g.forEachLand((l) => {
            if (!l.dahan.length) return;
            if (l.towns.length && l.explorers < 2) g.removePieces(l.id, 'town', 1); else g.removePieces(l.id, 'explorer', 2);
          });
          g.forEachLand((l) => { if (l.dahan.length >= 2) g.removePieces(l.id, 'city', 1); });
        },
      },
    ],
  },
  {
    id: 'fear_unseen', name: '보이지 않는 것에 대한 두려움',
    levels: [
      { text: '각 플레이어는 자신의 성지가 있는 지역 하나에서 탐험가/마을 1개를 제거합니다.', async effect(g) { await g.eachPlayerRemoves(ET, 1, (l, pid) => g.isSacred(pid, l.id), '자신의 성지가 있는'); } },
      { text: '각 플레이어는 자신의 존재가 있는 지역 하나에서 탐험가/마을 1개를 제거합니다.', async effect(g) { await g.eachPlayerRemoves(ET, 1, (l, pid) => g.presenceCount(pid, l.id) > 0, '자신의 존재가 있는'); } },
      { text: '각 플레이어는 자신의 존재가 있는 지역 하나에서 침략자 1개를 제거합니다.', async effect(g) { await g.eachPlayerRemoves(['explorer', 'town', 'city'], 1, (l, pid) => g.presenceCount(pid, l.id) > 0, '자신의 존재가 있는'); } },
    ],
  },
  {
    id: 'belief_takes_root', name: '뿌리내린 믿음',
    levels: [
      { text: '존재가 있는 모든 지역에 방어 2.', async effect(g) { g.forEachLand((l) => { if (g.anyPresence(l.id)) l.defend += 2; }); } },
      {
        text: '존재가 있는 모든 지역에 방어 2. 각 정령은 침략자가 있는 자신의 성지 1개당 에너지 1을 얻습니다.',
        async effect(g) {
          g.forEachLand((l) => { if (g.anyPresence(l.id)) l.defend += 2; });
          for (const pid of g.playerIds) {
            const n = g.sacredLands(pid).filter((id) => g.invaderCount(id) > 0).length;
            if (n) g.gainEnergy(pid, n);
          }
        },
      },
      {
        text: '각 플레이어는 자신의 존재가 있는 지역 하나를 골라 탐험가 1개와 마을 1개를 제거합니다.',
        async effect(g) {
          await Promise.all(g.playerIds.map(async (pid) => {
            const opts = g.presenceLands(pid).filter((id) => g.count(id, 'explorer') + g.count(id, 'town') > 0);
            if (!opts.length) return;
            const land = await g.askLand(pid, '뿌리내린 믿음: 탐험가 1, 마을 1을 제거할 지역', opts, false);
            g.removePieces(land, 'explorer', 1); g.removePieces(land, 'town', 1);
          }));
        },
      },
    ],
  },
  {
    id: 'trade_suffers', name: '무역 침체',
    levels: [
      { text: '이번 턴, 침략자는 도시가 있는 지역에 건설하지 않습니다.', async effect(g) { g.addTurnRule('noBuild', (l) => l.cities.length > 0, '도시가 있는 지역 건설 안 함'); } },
      { text: '각 플레이어는 해안 지역 하나에서 마을 1개를 탐험가 1개로 교체할 수 있습니다.', async effect(g) { await g.eachPlayerReplaces(coastal, ['town'], '해안'); } },
      { text: '각 플레이어는 해안 지역 하나에서 도시 1개를 마을로, 또는 마을 1개를 탐험가로 교체할 수 있습니다.', async effect(g) { await g.eachPlayerReplaces(coastal, ['city', 'town'], '해안'); } },
    ],
  },
];

module.exports = { FEAR_CARDS };
