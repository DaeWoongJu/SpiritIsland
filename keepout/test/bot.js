'use strict';
const { botAnswer } = require('../server/game/game');
/** 모든 플레이어를 봇으로 자동 진행 */
function attachBots(game) {
  let busy = false;
  const tick = () => {
    if (busy || game.result) return;
    busy = true;
    setImmediate(() => {
      busy = false;
      for (const pid of game.order) {
        const pr = game.currentPrompt(pid);
        if (!pr) continue;
        const err = game.answer(pid, pr.id, botAnswer(game, pid, pr));
        if (err) throw new Error(`봇 응답 오류: ${err} (${pr.kind})`);
      }
      tick();
    });
  };
  game.on('update', tick);
}
module.exports = { attachBots };
