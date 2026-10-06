'use strict';
// 반지의 제왕 E2E: 브라우저 2명 + AI 1명이 한 게임을 끝까지 진행 (playwright 필요)
// 사용법: node lotr/test/e2e.js http://localhost:3400
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:3400';
const SHOTS = process.env.SHOTS || '';

async function step(page) {
  return page.evaluate(() => {
    if (!window.app || !app.state || app.state.result) return 'idle';
    const pr = app.prompt;
    if (!pr) return 'wait';
    const ok = pr.options.filter((o) => !o.disabled);
    let v;
    if (pr.kind === 'turn') {
      const good = ok.find((o) => ['destroy', 'capture', 'attack', 'muster'].includes(o.group) || o.value === 'destroy');
      const act = ok.filter((o) => o.value !== 'end' && o.group !== 'trade');
      v = good && Math.random() < 0.7 ? good.value : act.length && Math.random() < 0.8 ? act[Math.floor(Math.random() * act.length)].value : 'end';
    } else v = ok[Math.floor(Math.random() * ok.length)].value;
    answer(v);
    return 'answered';
  });
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const mk = async () => {
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (r) => (r.request().url().startsWith(BASE) || r.request().url().startsWith('ws') ? r.continue() : r.abort()));
    await page.addInitScript(() => localStorage.setItem('lotr-guided', '1'));
    await page.goto(BASE);
    return page;
  };
  const a = await mk();
  const b = await mk();
  await a.fill('#in-name', '프로도팬');
  await a.click('#btn-create');
  await a.waitForSelector('#room:not(.hidden)');
  const code = (await a.textContent('#room-code')).trim();
  await b.fill('#in-name', '샘팬');
  await b.fill('#in-code', code);
  await b.click('#btn-join');
  await b.waitForSelector('#room:not(.hidden)');
  await a.click('.char-opt[data-char="gandalf"]');
  await a.click('.char-opt[data-char="aragorn"]');
  await b.click('.char-opt[data-char="legolas"]');
  await a.waitForTimeout(200);
  // 같은 인물은 두 사람이 못 고름
  await b.click('.char-opt[data-char="gandalf"]');
  await a.click('#btn-add-bot');
  await a.waitForTimeout(300);
  const chars = await a.evaluate(() => app.room.players.map((p) => p.chars.join('+')));
  if (chars[0] !== 'gandalf+aragorn' || chars[1] !== 'legolas') throw new Error('인물 선택 오류: ' + chars);
  await a.click('#btn-start');
  await a.waitForSelector('#game:not(.hidden)');
  await a.waitForSelector('.actor-tab');
  // 지도 클릭으로 간달프 이동 → 프로도 탭으로 바꿔 이동
  const before = await a.evaluate(() => app.state.pawns.find((p) => p.id === 'gandalf').loc);
  await a.click('.loc.can[data-loc="bree"] .hit', { force: true });
  await a.waitForFunction((b0) => app.state.pawns.find((p) => p.id === 'gandalf').loc !== b0, before);
  await a.click('.actor-tab[data-actor="frodo"]');
  await a.waitForSelector('.loc.can[data-loc="greyhavens"]');
  await a.click('.loc.can[data-loc="greyhavens"] .hit', { force: true });
  await a.waitForFunction(() => app.state.pawns.find((p) => p.id === 'frodo').loc === 'greyhavens');
  if (SHOTS) await a.screenshot({ path: `${SHOTS}/lotr-turn.png` });
  let n = 0;
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    const done = await a.evaluate(() => !!(app.state && app.state.result));
    if (done) break;
    for (const p of [a, b]) if ((await step(p)) === 'answered') n++;
    await a.waitForTimeout(30);
  }
  const res = await a.evaluate(() => app.state.result && `${app.state.result.win ? '승리' : '패배'} — ${app.state.result.reason}`);
  await a.waitForSelector('#result:not(.hidden)', { timeout: 5000 });
  if (SHOTS) await a.screenshot({ path: `${SHOTS}/lotr-result.png` });
  console.log('응답', n, '결과:', res);
  if (errors.length) { console.error('페이지 오류:', errors); process.exit(1); }
  if (!res) { console.error('게임이 끝나지 않았습니다'); process.exit(1); }
  console.log('반지의 제왕 E2E OK');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
