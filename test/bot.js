'use strict';
// 테스트용 무작위 봇: 대기 중인 선택에 무작위로 응답한다.
const { POWER_MAP } = require('../server/game/powers');

function randomAnswer(prompt, rand = Math.random) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  if (prompt.type === 'option') {
    const nonStop = prompt.options.filter((o) => !['done', '__stop', '__cancel'].includes(o.value));
    if (nonStop.length && rand() < 0.85) return pick(nonStop).value;
    return pick(prompt.options).value;
  }
  if (prompt.type === 'land') {
    if (prompt.cancel && rand() < 0.1) return null;
    return pick(prompt.options);
  }
  if (prompt.type === 'cards') {
    const cards = [...prompt.cards].sort(() => rand() - 0.5);
    const out = [];
    let cost = 0;
    for (const c of cards) {
      if (out.length >= prompt.max) break;
      const cc = POWER_MAP[c].cost;
      if (prompt.budget != null && cost + cc > prompt.budget) continue;
      out.push(c);
      cost += cc;
    }
    while (out.length < prompt.min) out.push(cards.find((c) => !out.includes(c)));
    return out;
  }
  throw new Error('unknown prompt ' + prompt.type);
}

/** 모든 플레이어를 봇으로 돌려 게임을 끝까지 진행 */
function attachBots(game, rand = Math.random) {
  const tick = () => {
    for (const pid of game.playerIds) {
      const p = game.currentPrompt(pid);
      if (p) {
        const err = game.answer(pid, p.id, randomAnswer(p, rand));
        if (err) throw new Error('봇 응답 거부: ' + err + ' / ' + JSON.stringify(p));
        return;
      }
    }
  };
  game.on('update', tick);
}

module.exports = { randomAnswer, attachBots };
