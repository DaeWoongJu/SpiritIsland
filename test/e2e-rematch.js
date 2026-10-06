'use strict';
// E2E: 게임이 끝난 뒤 '바로 다시 하기' → 대기실을 거치지 않고 같은 구성으로 새 판 (세 게임 공용)
// 사용법: TEST_HOOKS=1 로 서버 실행 후 `node test/e2e-rematch.js <URL> <si|arnak|champions|keepout>`
const { chromium } = require('playwright');
const BASE = process.argv[2];
const KIND = process.argv[3] || 'si';
const C = {
  si: { guided: 'si-guided', game: '#screen-game', room: '#screen-room', rematch: '#btn-rematch', result: '#modal:not(.hidden) .result' },
  arnak: { guided: 'arnak-guided', game: '#game', room: '#room', rematch: '#res-rematch', result: '#result:not(.hidden)' },
  champions: { guided: 'champ-guided', game: '#game', room: '#room', rematch: '#res-rematch', result: '#result:not(.hidden)' },
  keepout: { guided: 'keepout-guided', game: '#game', room: '#room', rematch: '#res-rematch', result: '#result:not(.hidden)' },
}[KIND];

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const mk = async (name) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    await page.addInitScript((k) => { localStorage.setItem(k, '1'); localStorage.setItem('si-3d', '0'); }, C.guided);
    await page.route('**/*', (r) => (r.request().url().startsWith(BASE) || r.request().url().startsWith('ws') ? r.continue() : r.abort()));
    await page.goto(BASE);
    await page.fill('#in-name', name);
    return page;
  };
  const a = await mk('호스트');
  const b = await mk('친구');
  await a.click('#btn-create');
  await a.waitForSelector(`${C.room}:not(.hidden)`);
  const code = (await a.textContent('#room-code')).trim();
  await b.fill('#in-code', code);
  await b.click('#btn-join');
  await b.waitForSelector(`${C.room}:not(.hidden)`);
  if (KIND === 'si') {
    await a.click('.spirit-card[data-spirit="river"] [data-pick]');
    await b.click('.spirit-card[data-spirit="earth"] [data-pick]');
    await a.waitForFunction(() => app.room.players.every((p) => p.spiritIds.length));
  }
  await a.click('#btn-start');
  await a.waitForSelector(`${C.game}:not(.hidden)`);
  await b.waitForSelector(`${C.game}:not(.hidden)`);
  const before = await a.evaluate(() => app.gameNo);
  // 게임 끝내기 (테스트 훅)
  await a.evaluate(() => send({ t: 'debugEnd' }));
  await a.waitForSelector(C.result);
  await b.waitForSelector(C.result);
  await a.click(C.rematch);
  // 대기실로 가지 않고 새 판이 시작되어야 함
  for (const p of [a, b]) {
    await p.waitForFunction((n) => app.gameNo === n + 1 && app.state && !app.state.result, before);
    if (await p.locator(`${C.room}:not(.hidden)`).count()) throw new Error('대기실로 나갔습니다');
    if (await p.locator(C.result).count()) throw new Error('결과 창이 남아 있습니다');
  }
  // 두 번째 판도 끝나면 결과 창이 다시 떠야 함 (닫힘 상태가 남지 않음)
  await a.evaluate(() => send({ t: 'debugEnd' }));
  await a.waitForSelector(C.result);
  await b.waitForSelector(C.result);
  if (errors.length) { console.error('페이지 오류:', errors); process.exit(1); }
  console.log(KIND, '바로 다시 하기 E2E OK (게임 번호', before, '→', before + 1, ')');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
