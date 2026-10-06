'use strict';
// 언락! E2E: 브라우저 2명이 같은 방에서 함께 풀기 → 저장하고 그만두기 → 이어하기 → 탈출 → 같은 시나리오 다시
// 사용법: node unlock/test/e2e.js http://localhost:3500
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:3500';
const SHOTS = process.env.SHOTS || '';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const mk = async () => {
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (d) => d.accept());
    await page.route('**/*', (r) => (r.request().url().startsWith(BASE) || r.request().url().startsWith('ws') ? r.continue() : r.abort()));
    await page.addInitScript(() => localStorage.setItem('unlock-guided', '1'));
    await page.goto(BASE);
    return page;
  };
  const a = await mk();
  const b = await mk();
  await a.fill('#in-name', '방장');
  await a.click('#btn-create');
  await a.waitForSelector('#room:not(.hidden)');
  const code = (await a.textContent('#room-code')).trim();
  await b.fill('#in-name', '친구');
  await b.fill('#in-code', code);
  await b.click('#btn-join');
  await b.waitForSelector('#room:not(.hidden)');
  // 박스 탭과 시나리오 고르기
  const boxes = await a.$$eval('.box-tab', (els) => els.length);
  if (boxes < 15) throw new Error('박스 탭이 너무 적음: ' + boxes);
  await a.click('.box-tab:has-text("입문")');
  await a.click('.scen[data-scen="tutorial"]');
  await a.waitForFunction(() => app.room.settings.scenario === 'tutorial');
  if (SHOTS) await a.screenshot({ path: `${SHOTS}/unlock-room.png` });
  await a.click('#btn-start');
  await a.waitForSelector('.ucard');
  await b.waitForSelector('.ucard');
  const byTitle = (p, t) => p.click(`.ucard:has(.c-title:text-is("${t}"))`);
  // 친구가 숨은 번호를 찾고, 방장이 합치기
  await b.click('.spot[data-spot="0"]');
  await a.waitForSelector('.ucard:has(.c-title:text-is("작은 열쇠"))');
  await byTitle(a, '잠긴 나무 상자'); await byTitle(a, '작은 열쇠');
  await a.click('#btn-combine');
  await b.waitForSelector('.ucard:has(.c-title:text-is("벽 금고"))');
  // 틀린 코드 → 벌점
  await byTitle(b, '벽 금고');
  for (const k of '1111') await b.keyboard.press(k);
  await b.keyboard.press('Enter');
  await a.waitForFunction(() => app.state.penalties === 1);
  // 저장하고 그만두기 → 이어하기
  await a.click('#btn-quit');
  await a.waitForSelector('#room:not(.hidden)');
  await b.waitForSelector('#room:not(.hidden)');
  await a.click('#btn-start');
  await a.waitForFunction(() => app.state && app.state.penalties === 1 && app.state.cards.some((c) => c.title === '벽 금고'));
  const t = await a.evaluate(() => app.state.elapsed);
  if (t < 3 * 60000) throw new Error('이어하기 후 벌점 시간이 사라짐');
  await b.waitForSelector('.ucard:has(.c-title:text-is("벽 금고"))');
  await byTitle(b, '벽 금고');
  for (const k of '0915') await b.keyboard.press(k);
  await b.keyboard.press('Enter');
  await a.waitForSelector('.ucard:has(.c-title:text-is("문 패널"))');
  await byTitle(a, '문 패널');
  for (const s of ['🔴', '🟡', '🟢', '🔵']) await a.click(`.mach-btns button:text-is("${s}")`);
  if (SHOTS) await a.screenshot({ path: `${SHOTS}/unlock-game.png` });
  await a.click('#btn-mgo');
  await a.waitForSelector('#result:not(.hidden)');
  await b.waitForSelector('#result:not(.hidden)');
  if (SHOTS) await a.screenshot({ path: `${SHOTS}/unlock-result.png` });
  const stars = await a.evaluate(() => app.state.result.stars);
  await a.click('#res-rematch');
  await a.waitForFunction(() => app.state && !app.state.result && app.state.penalties === 0);
  console.log('별점', stars);
  if (errors.length) { console.error('페이지 오류:', errors); process.exit(1); }
  console.log('언락! E2E OK');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
