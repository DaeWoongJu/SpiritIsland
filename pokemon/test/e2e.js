'use strict';
// 포켓몬 골드 온라인 E2E: 브라우저 2개가 같은 세계에 들어와 서로 보고, 동행(협동 배틀), 대결, 교환까지 해 본다 (playwright 필요)
// 사용법: 서버를 켠 뒤 `node pokemon/test/e2e.js http://localhost:3600`
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:3600';
const SHOTS = process.env.SHOTS || '';
const tag = Date.now() % 10000;

function assert(ok, msg) { if (!ok) throw new Error('실패: ' + msg); console.log('  ✔ ' + msg); }

async function join(browser, name, look) {
  const page = await browser.newPage({ viewport: { width: 640, height: 600 } });
  page.on('pageerror', (e) => console.log(`[${name} 오류]`, e.message));
  await page.goto(BASE);
  await page.waitForSelector('#login-form:not(.hidden)', { timeout: 30000 });
  await page.fill('#name', name);
  await page.click(`.look[data-look="${look}"]`);
  await page.click('#start');
  await page.waitForFunction(() => window.G && G.me && G.ow.map, null, { timeout: 15000 });
  await page.evaluate(() => { G.closeAllUI(); G.ow.locked = 0; });
  return page;
}

/** 열린 창이 있으면 A(z)를 눌러 넘기기 — 배틀 메뉴도 첫 번째(싸운다 → 첫 기술)를 고른다 */
async function pressThrough(page, until, max = 400) {
  for (let i = 0; i < max; i++) {
    if (await page.evaluate(until)) return true;
    const busy = await page.evaluate(() => G.ui.length > 0);
    if (busy) await page.keyboard.press('z');
    await page.waitForTimeout(busy ? 60 : 120);
  }
  return false;
}

async function shot(page, name) { if (SHOTS) await page.locator('#screen').screenshot({ path: `${SHOTS}/${name}.png` }); }

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  try {
    console.log('1) 두 사람 접속');
    const a = await join(browser, `골드${tag}`, 0);
    const b = await join(browser, `실버${tag}`, 1);
    // 둘 다 공박사님께 포켓몬 받기
    for (const [p, sp] of [[a, 155], [b, 158]]) {
      await p.evaluate((sp) => { const idx = G.W.maps.ELMS_LAB.objects.findIndex((o) => o.gift && o.gift.species === sp); G.net.send({ t: 'gift', map: 'ELMS_LAB', idx }); }, sp);
      await p.waitForFunction(() => G.me.party.length === 1);
      await pressThrough(p, () => G.ui.length === 0);
    }
    assert(true, '두 사람 모두 첫 포켓몬을 받음');
    // 같은 맵(29번도로)으로
    await a.evaluate(() => { G.enterMap('ROUTE_29', 50, 10, 'left'); G.net.sendMove(false); });
    await b.evaluate(() => { G.enterMap('ROUTE_29', 49, 10, 'right'); G.net.sendMove(false); });
    await a.waitForFunction(() => [...G.ow.others.values()].some((o) => o.map === 'ROUTE_29'), null, { timeout: 5000 });
    assert(true, '서로 같은 맵에서 보임');
    await shot(a, 'e1-meet');

    console.log('2) 함께 다니기 → 협동 배틀');
    const bId = await b.evaluate(() => G.myId);
    await a.evaluate((id) => G.net.send({ t: 'ask', to: id, kind: 'team' }), bId);
    await b.waitForFunction(() => G.incoming.length > 0 || G.askBusy, null, { timeout: 5000 });
    await pressThrough(b, () => G.me.team);
    await pressThrough(a, () => G.me.team);
    assert(await a.evaluate(() => !!G.me.team), '동행 성립');
    await a.evaluate(() => G.net.send({ t: 'encounter', kind: 'grass' }));
    await a.waitForFunction(() => G.battle, null, { timeout: 5000 });
    await b.waitForFunction(() => G.battle, null, { timeout: 5000 });
    const slots = await a.evaluate(() => [G.battle.view.sides[0].slots.length, G.battle.view.sides[1].slots.length]);
    assert(slots[0] === 2 && slots[1] === 2, `협동 더블 배틀 (우리 ${slots[0]}마리 vs 야생 ${slots[1]}마리)`);
    await a.waitForTimeout(1500);
    await shot(a, 'e2-coop');
    await Promise.all([pressThrough(a, () => !G.battle, 1500), pressThrough(b, () => !G.battle, 1500)]);
    assert(await a.evaluate(() => !G.battle) && await b.evaluate(() => !G.battle), '협동 배틀이 끝나고 둘 다 필드로 돌아옴');

    console.log('3) 대결 (싱글 배틀)');
    for (const p of [a, b]) await p.evaluate(() => G.net.send({ t: 'heal' }));
    await a.evaluate((id) => G.net.send({ t: 'ask', to: id, kind: 'battle1' }), bId);
    await b.waitForFunction(() => G.incoming.length > 0 || G.askBusy, null, { timeout: 5000 });
    await pressThrough(b, () => G.battle);
    await a.waitForFunction(() => G.battle, null, { timeout: 5000 });
    assert(await a.evaluate(() => G.battle.view.kind === 'pvp'), '대결 시작');
    await a.waitForTimeout(1500);
    await shot(b, 'e3-pvp');
    await Promise.all([pressThrough(a, () => !G.battle, 2500), pressThrough(b, () => !G.battle, 2500)]);
    assert(await a.evaluate(() => !G.battle) && await b.evaluate(() => !G.battle), '대결이 끝남');
    assert(await a.evaluate(() => G.me.party[0].hp > 0), '대결 뒤 포켓몬 상태는 원래대로 (대결은 기록에 남지 않음)');

    console.log('4) 교환');
    const before = await a.evaluate(() => G.me.party[0].species);
    await a.evaluate((id) => G.net.send({ t: 'ask', to: id, kind: 'trade' }), bId);
    await b.waitForFunction(() => G.incoming.length > 0 || G.askBusy, null, { timeout: 5000 });
    await pressThrough(b, () => G.tradeState);
    await a.waitForFunction(() => G.tradeState, null, { timeout: 5000 });
    for (const p of [a, b]) await p.evaluate(() => G.net.send({ t: 'tradeOffer', uid: G.me.party[0].uid }));
    await a.waitForFunction(() => G.tradeState && G.tradeState.theirOffer && G.tradeState.myOffer);
    await shot(a, 'e4-trade');
    for (const p of [a, b]) await p.evaluate(() => G.net.send({ t: 'tradeOk' }));
    await a.waitForFunction((sp) => G.me.party[0].species !== sp, before, { timeout: 5000 });
    assert(await a.evaluate(() => G.me.party[0].species === 158), '교환 완료 (브케인 ↔ 리아코)');
    await pressThrough(a, () => G.ui.length === 0);
    console.log('\n모두 통과!');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
