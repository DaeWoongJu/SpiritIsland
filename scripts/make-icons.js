'use strict';
// public/icons/icon.svg 로부터 PNG(192/512)와 Windows용 icon.ico 를 생성한다. (playwright 필요)
// 사용법: node scripts/make-icons.js            (정령섬: public/icons)
//         node scripts/make-icons.js arnak      (아르낙: arnak/public/icon.svg → icon.ico)
//         node scripts/make-icons.js champions  (히어로 챔피언스)
//         node scripts/make-icons.js keepout    (킵 더 히어로즈 아웃)
//         node scripts/make-icons.js lotr       (반지의 제왕: 원정대의 운명)
//         node scripts/make-icons.js unlock     (언락!)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SUB = ['arnak', 'champions', 'keepout', 'lotr', 'unlock'].includes(process.argv[2]) ? process.argv[2] : null;
const dir = SUB ? path.join(__dirname, '..', SUB, 'public') : path.join(__dirname, '..', 'public', 'icons');
const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const page = await browser.newPage();
  const render = async (size) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  };
  for (const s of [192, 512]) fs.writeFileSync(path.join(dir, `icon-${s}.png`), await render(s));
  // ICO: PNG 이미지를 그대로 담는 형식 (Windows Vista+ 지원)
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngs = [];
  for (const s of sizes) pngs.push(await render(s));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  const entries = [];
  let offset = 6 + 16 * sizes.length;
  sizes.forEach((s, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(s >= 256 ? 0 : s, 0); e.writeUInt8(s >= 256 ? 0 : s, 1);
    e.writeUInt8(0, 2); e.writeUInt8(0, 3); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    entries.push(e);
  });
  fs.writeFileSync(path.join(dir, 'icon.ico'), Buffer.concat([header, ...entries, ...pngs]));
  await browser.close();
  console.log('아이콘 생성 완료:', fs.readdirSync(dir).join(', '));
})();
