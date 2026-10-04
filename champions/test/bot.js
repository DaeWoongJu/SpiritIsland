'use strict';
const { botAnswer } = require('../server/game/game');

/** 모든 플레이어를 봇으로 자동 진행. random=true면 무작위로 고름 */
function attachBots(game, { random = false } = {}) {
  let busy = false;
  let answers = 0;
  const tick = () => {
    if (busy || game.result) return;
    busy = true;
    setImmediate(() => {
      busy = false;
      for (const pid of game.order) {
        const pr = game.currentPrompt(pid);
        if (!pr) continue;
        let v;
        if (random && pr.type === 'option') {
          const ok = pr.options.filter((o) => !o.disabled && (pr.kind !== 'turn' || o.value !== 'end' || game.botRand() < 0.3));
          v = (ok.length ? ok : pr.options.filter((o) => !o.disabled))[Math.floor(game.botRand() * (ok.length || 1))].value;
        } else v = botAnswer(game, pid, pr);
        const err = game.answer(pid, pr.id, v);
        if (err) throw new Error(`봇 응답 오류: ${err} (${pr.kind} ${JSON.stringify(v)})`);
        answers++;
      }
      tick();
    });
  };
  game.on('update', tick);
  return { count: () => answers };
}
module.exports = { attachBots };
