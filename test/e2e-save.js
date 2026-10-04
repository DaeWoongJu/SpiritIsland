'use strict';
// E2E: 게임 도중 저장하고 그만두기 → (서버 재시작) → 첫 화면에서 이어하기
// 사용법: SAVE_DIR=<임시폴더> 로 서버 실행 후 `node test/e2e-save.js [URL] [restart]`
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:3000';
const PHASE = process.argv[3] || 'save'; // save | resume
const SHOTS = process.env.SHOTS || '';

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.addInitScript(() => { localStorage.setItem('si-guided', '1'); localStorage.setItem('si-3d', '0'); });
  await page.route((u) => !u.href.startsWith(URL), (r) => r.abort());
  await page.goto(URL);
  await page.waitForSelector('#conn-status.ok');
  await page.fill('#in-name', '저장러');
  if (PHASE === 'save') {
    await page.click('#btn-create');
    await page.waitForSelector('.spirit-card [data-pick]');
    await page.click('.spirit-card[data-spirit="river"] [data-pick]');
    await page.waitForSelector('.spirit-card.mine');
    await page.click('#btn-start');
    await page.waitForSelector('#screen-game:not(.hidden)');
    // 몇 번 선택해서 진행
    let n = 0;
    const deadline = Date.now() + 40000;
    while (Date.now() < deadline && n < 12) {
      const modal = page.locator('#modal:not(.hidden) #btn-confirm-cards');
      if (await modal.count()) {
        const c = page.locator('#modal .card.selectable:not(.selected)');
        if (await c.count()) await c.first().click({ timeout: 2000 }).catch(() => {});
        if (await modal.isEnabled().catch(() => false)) { await modal.click({ timeout: 2000 }).catch(() => {}); n++; continue; }
      }
      const ack = page.locator('#inv-banner:not(.hidden) [data-ack]:not([disabled])');
      if (await ack.count()) { await ack.first().click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(80); continue; }
      const btn = page.locator('#prompt button[data-land], #prompt button[data-i]:not([disabled])');
      if (await btn.count()) { await btn.first().click({ timeout: 2000 }).catch(() => {}); n++; await page.waitForTimeout(100); continue; }
      await page.waitForTimeout(150);
    }
    const before = await page.evaluate(() => ({ turn: app.state.turn, log: app.state.log.length, energy: Object.values(app.state.spirits)[0].energy }));
    await page.click('#btn-quit');
    await page.waitForSelector('#screen-room:not(.hidden) .resume-box');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/save-room.png` });
    console.log('저장 직전', JSON.stringify(before), '선택', n);
  } else {
    await page.waitForSelector('#saves-box:not(.hidden) [data-resume]');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/save-home.png` });
    await page.click('#saves-box [data-resume]');
    await page.waitForSelector('#screen-room:not(.hidden) .slot-card.mine');
    await page.click('#btn-start');
    await page.waitForSelector('#screen-game:not(.hidden)');
    await page.waitForFunction(() => app.state && app.state.log.some((l) => l.msg.includes('저장된 게임을 불러왔습니다')));
    await page.waitForFunction(() => Object.values(app.prompts || {}).some(Boolean) || (app.state.invaderStep && app.state.invaderStep.manual), null, { timeout: 15000 });
    const after = await page.evaluate(() => ({ turn: app.state.turn, energy: Object.values(app.state.spirits)[0].energy, prompt: !!app.prompt }));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/save-resumed.png` });
    console.log('이어하기 후', JSON.stringify(after));
  }
  if (errors.length) { console.error('페이지 오류:', errors); process.exit(1); }
  console.log('E2E 저장', PHASE, 'OK');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
