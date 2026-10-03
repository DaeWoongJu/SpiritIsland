'use strict';
/* 정령섬 온라인 — SVG 아이콘 스프라이트 (원소, 조각, 지형). 문서에 한 번 삽입하고 <use href="#id">로 사용한다. */

const ELEMENT_STYLE = {
  sun: { bg: '#e9a91c', fg: '#fff4c2' },
  moon: { bg: '#3f4c96', fg: '#e6eaff' },
  fire: { bg: '#c8401c', fg: '#ffd27a' },
  air: { bg: '#8aa6bb', fg: '#ffffff' },
  water: { bg: '#2470c2', fg: '#cfe8ff' },
  earth: { bg: '#6e5d47', fg: '#e3d6bb' },
  plant: { bg: '#358a3b', fg: '#d2f5b8' },
  animal: { bg: '#a8402c', fg: '#ffe0d0' },
};

const SPRITE = `
<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
  <defs>
    <radialGradient id="el-shine" cx="35%" cy="30%" r="75%">
      <stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- 원소 -->
  <symbol id="el-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="${ELEMENT_STYLE.sun.bg}"/>
    <g stroke="${ELEMENT_STYLE.sun.fg}" stroke-width="1.6" stroke-linecap="round"><path d="M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5M6 6l1.8 1.8M16.2 16.2 18 18M6 18l1.8-1.8M16.2 7.8 18 6"/></g>
    <circle cx="12" cy="12" r="4.4" fill="${ELEMENT_STYLE.sun.fg}"/><circle cx="12" cy="12" r="11" fill="url(#el-shine)"/></symbol>
  <symbol id="el-moon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="${ELEMENT_STYLE.moon.bg}"/>
    <path d="M14.8 4.6a7.6 7.6 0 1 0 0 14.8 6.2 6.2 0 1 1 0-14.8z" fill="${ELEMENT_STYLE.moon.fg}"/><circle cx="12" cy="12" r="11" fill="url(#el-shine)"/></symbol>
  <symbol id="el-fire" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="${ELEMENT_STYLE.fire.bg}"/>
    <path d="M12 3.8c.9 3 4.6 4.6 4.6 9.2a4.6 4.6 0 0 1-9.2 0c0-2.2 1.1-3.6 2.3-4.6-.1 1.7.7 2.8 1.6 2.9C10.6 9 10.8 6.3 12 3.8z" fill="${ELEMENT_STYLE.fire.fg}"/>
    <path d="M12 12.2c.4 1.2 1.9 1.8 1.9 3.4a1.9 1.9 0 0 1-3.8 0c0-1.2.9-2 1.9-3.4z" fill="#fff6dc"/><circle cx="12" cy="12" r="11" fill="url(#el-shine)"/></symbol>
  <symbol id="el-air" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="${ELEMENT_STYLE.air.bg}"/>
    <g fill="none" stroke="${ELEMENT_STYLE.air.fg}" stroke-width="1.8" stroke-linecap="round"><path d="M4.5 9.5h9.5a2.6 2.6 0 1 0-2.6-2.6"/><path d="M4.5 13h12.5a2.6 2.6 0 1 1-2.6 2.6"/><path d="M6.5 16.5h4"/></g>
    <circle cx="12" cy="12" r="11" fill="url(#el-shine)"/></symbol>
  <symbol id="el-water" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="${ELEMENT_STYLE.water.bg}"/>
    <path d="M12 4.2c3.2 4.2 5.4 6.9 5.4 9.6a5.4 5.4 0 0 1-10.8 0c0-2.7 2.2-5.4 5.4-9.6z" fill="${ELEMENT_STYLE.water.fg}"/>
    <path d="M9.6 14a2.6 2.6 0 0 0 2.4 2.6" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round"/><circle cx="12" cy="12" r="11" fill="url(#el-shine)"/></symbol>
  <symbol id="el-earth" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="${ELEMENT_STYLE.earth.bg}"/>
    <path d="M4.5 17.5 9 9.2l2.6 4.2 3-5.6 4.9 9.7z" fill="${ELEMENT_STYLE.earth.fg}"/><path d="M9 9.2l1.2 2.1-1.9.9z" fill="#fff" opacity=".8"/>
    <circle cx="12" cy="12" r="11" fill="url(#el-shine)"/></symbol>
  <symbol id="el-plant" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="${ELEMENT_STYLE.plant.bg}"/>
    <path d="M6 18.2C6 10.2 10.8 6 18.2 5.8c0 7.4-4.4 12.4-12.2 12.4z" fill="${ELEMENT_STYLE.plant.fg}"/>
    <path d="M6.6 17.6 15.4 8.8" stroke="${ELEMENT_STYLE.plant.bg}" stroke-width="1.3" stroke-linecap="round"/><circle cx="12" cy="12" r="11" fill="url(#el-shine)"/></symbol>
  <symbol id="el-animal" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="${ELEMENT_STYLE.animal.bg}"/>
    <g fill="${ELEMENT_STYLE.animal.fg}"><ellipse cx="12" cy="15.2" rx="3.9" ry="3.3"/><circle cx="7.4" cy="10.6" r="1.8"/><circle cx="10.2" cy="7.6" r="1.8"/><circle cx="13.8" cy="7.6" r="1.8"/><circle cx="16.6" cy="10.6" r="1.8"/></g>
    <circle cx="12" cy="12" r="11" fill="url(#el-shine)"/></symbol>

  <!-- 조각 (currentColor) -->
  <symbol id="pc-explorer" viewBox="0 0 24 24"><g fill="currentColor"><circle cx="11" cy="5" r="2.6"/>
    <path d="M8.3 21l1.6-6.4-1.7-1.2 1.2-4.6h4.4l1.8 4.6-1.6 1.2 1 6.4h-2.3l-.9-5.4h-.5l-1 5.4z"/></g>
    <path d="M16.6 7.5 18 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></symbol>
  <symbol id="pc-town" viewBox="0 0 24 24"><path fill="currentColor" d="M3 12.2 12 4.5l9 7.7h-2.3V20h-4.9v-5.2h-3.6V20H5.3v-7.8z"/><rect x="15.6" y="5.4" width="2" height="4" fill="currentColor"/></symbol>
  <symbol id="pc-city" viewBox="0 0 24 24"><path fill="currentColor" d="M2.5 21V9.5h2V7.5h1.6v2h1.6v-2h1.6v2H10V5h1V3.2h2V5h1v4.5h.7v-2h1.6v2h1.6v-2h1.6v2h2V21h-7.6v-4.2a2 2 0 0 0-4 0V21z"/></symbol>
  <symbol id="pc-dahan" viewBox="0 0 24 24"><g fill="currentColor"><circle cx="12" cy="5.6" r="2.7"/><path d="M7 21.2 9 10.4h6l2 10.8h-3.2l-1.3-6.2h-1l-1.3 6.2z"/>
    <path d="M9 10.4 5.6 15l1.1.9L10 12zM15 10.4l3.4 4.6-1.1.9L14 12z"/></g><path d="M13.2 3.3 15.6.9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></symbol>
  <symbol id="pc-blight" viewBox="0 0 24 24"><path fill="currentColor" d="M12 1.5l1.9 5.7 5.3-3-2.6 5.4 5.9 1.9-5.9 1.9 2.6 5.4-5.3-3L12 22.5l-1.9-5.7-5.3 3 2.6-5.4-5.9-1.9 5.9-1.9-2.6-5.4 5.3 3z"/>
    <circle cx="12" cy="12" r="3.3" fill="#000" opacity=".55"/></symbol>
  <symbol id="pc-shield" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.5 19.5 5.6v5.6c0 5.1-3.2 8.7-7.5 10.3-4.3-1.6-7.5-5.2-7.5-10.3V5.6z"/><path d="M12 5.2v13.5c2.8-1.4 4.8-4 4.8-7.5V7.3z" fill="#fff" opacity=".25"/></symbol>
  <symbol id="pc-skip" viewBox="0 0 24 24"><path fill="currentColor" d="M6.5 2.5h11v2.2c0 3.4-3.3 5.3-3.3 7.3s3.3 3.9 3.3 7.3v2.2h-11v-2.2c0-3.4 3.3-5.3 3.3-7.3S6.5 8.1 6.5 4.7z"/></symbol>
  <symbol id="pc-fear" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C7 2 4 5.6 4 10c0 3 1.6 4.6 2.6 5.4V19l2.4-1 1 2 2-1.4 2 1.4 1-2 2.4 1v-3.6C18.4 14.6 20 13 20 10c0-4.4-3-8-8-8zm-3.2 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm6.4 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></symbol>
  <symbol id="pc-energy" viewBox="0 0 24 24"><path fill="currentColor" d="M13.5 2 5 13.5h6l-1.5 8.5L18 10.5h-6z"/></symbol>
  <symbol id="pc-card" viewBox="0 0 24 24"><rect x="5" y="3" width="12" height="16" rx="2" fill="currentColor" opacity=".55"/><rect x="8" y="5" width="12" height="16" rx="2" fill="currentColor"/></symbol>
  <symbol id="pc-presence" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="currentColor"/><circle cx="9.5" cy="9" r="3" fill="#fff" opacity=".55"/></symbol>

  <!-- 지형 -->
  <symbol id="tr-M" viewBox="0 0 24 24"><path fill="currentColor" d="M1.5 20 9 6.5l3.6 6.3 2.6-4.3L22.5 20z"/><path d="M9 6.5 7 10.2l2-.6 1.6 1.3z" fill="#fff" opacity=".7"/></symbol>
  <symbol id="tr-J" viewBox="0 0 24 24"><g fill="currentColor"><circle cx="8" cy="10" r="5"/><circle cx="15.5" cy="8.5" r="5.5"/><rect x="7.2" y="13" width="1.8" height="8"/><rect x="14.6" y="12" width="1.8" height="9"/></g></symbol>
  <symbol id="tr-S" viewBox="0 0 24 24"><path fill="currentColor" d="M1 19c3-5 7-7 11-5.5 3-3.5 7.5-3.5 11 0V21H1z"/><circle cx="18" cy="5.5" r="2.6" fill="currentColor"/></symbol>
  <symbol id="tr-W" viewBox="0 0 24 24"><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"><path d="M2 17c2-1.4 3.4-1.4 5 0s3.4 1.4 5 0 3.4-1.4 5 0 3.4 1.4 5 0"/><path d="M8 14V5M11 14V7M14 14V4"/></g><g fill="currentColor"><ellipse cx="8" cy="5" rx="1.2" ry="2.2"/><ellipse cx="14" cy="4" rx="1.2" ry="2.2"/></g></symbol>

  <!-- 로고 -->
  <symbol id="logo" viewBox="0 0 64 64">
    <defs>
      <radialGradient id="lg-sea" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#2d8bb3"/><stop offset="1" stop-color="#0d2c4a"/></radialGradient>
      <linearGradient id="lg-land" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fbf5a"/><stop offset="1" stop-color="#2c6b33"/></linearGradient>
      <linearGradient id="lg-glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a3"/><stop offset="1" stop-color="#f2a93b"/></linearGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#lg-sea)"/><circle cx="32" cy="32" r="30" fill="none" stroke="#d9b45a" stroke-width="2.5"/>
    <path d="M10 44c5-3 9-4 13-11 3-5 5-10 9-10s6 5 9 10c4 7 8 8 13 11-6 5-14 8-22 8s-16-3-22-8z" fill="url(#lg-land)"/>
    <path d="M26 33c2-4 3-7 6-7s4 3 6 7l-6-2z" fill="#8b7a62"/>
    <path d="M32 6c1.5 6 7 9 7 15a7 7 0 0 1-14 0c0-3 1.6-5.2 3.4-6.6-.2 2.6 1 4.2 2.4 4.4C30 15 30.4 10 32 6z" fill="url(#lg-glow)"/>
    <path d="M14 47c4-1 6 1 9 0M41 47c4-1 6 1 9 0" stroke="#bfe6ff" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".8"/>
  </symbol>
</svg>`;

document.body.insertAdjacentHTML('afterbegin', SPRITE);

/** HTML 안에서 쓰는 원소 아이콘 */
function elIcon(e, size = 16) {
  return `<svg class="ico el" width="${size}" height="${size}" aria-label="${e}"><use href="#el-${e}"/></svg>`;
}
/** HTML 안에서 쓰는 조각/기타 아이콘 */
function pcIcon(name, size = 16, color = 'currentColor') {
  return `<svg class="ico" width="${size}" height="${size}" style="color:${color}" aria-hidden="true"><use href="#pc-${name}"/></svg>`;
}
function trIcon(t, size = 14, color = 'currentColor') {
  return `<svg class="ico" width="${size}" height="${size}" style="color:${color}" aria-hidden="true"><use href="#tr-${t}"/></svg>`;
}
