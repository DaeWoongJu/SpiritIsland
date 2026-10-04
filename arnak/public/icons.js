'use strict';
/* 아르낙 온라인 — SVG 아이콘 모음 (자원, 이동 수단, 말 등). 페이지에 한 번 심어 두고 <use>로 재사용 */

(() => {
  const S = (id, body, vb = '0 0 24 24') => `<symbol id="${id}" viewBox="${vb}">${body}</symbol>`;
  const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>
    <radialGradient id="g-coin" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff2b0"/><stop offset=".45" stop-color="#f0c040"/><stop offset="1" stop-color="#9a6a10"/></radialGradient>
    <radialGradient id="g-gem" cx="35%" cy="25%" r="80%"><stop offset="0" stop-color="#ffd0e0"/><stop offset=".4" stop-color="#e2335a"/><stop offset="1" stop-color="#6a0a22"/></radialGradient>
    <linearGradient id="g-stone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8d0bc"/><stop offset="1" stop-color="#7a7262"/></linearGradient>
    <linearGradient id="g-arrow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ad6e6"/><stop offset="1" stop-color="#2a6a80"/></linearGradient>
    <radialGradient id="g-compass" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#fff8e8"/><stop offset=".6" stop-color="#e8dcc0"/><stop offset="1" stop-color="#8a7448"/></radialGradient>
    <linearGradient id="g-idol" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a0"/><stop offset=".5" stop-color="#e0a820"/><stop offset="1" stop-color="#8a5a08"/></linearGradient>
  </defs>
  ${S('res-coin', '<circle cx="12" cy="12" r="10" fill="url(#g-coin)" stroke="#6a4808" stroke-width="1.2"/><circle cx="12" cy="12" r="6.8" fill="none" stroke="#8a6010" stroke-width="1" opacity=".7"/><path d="M12 7.5l1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4z" fill="#8a6010" opacity=".8"/>')}
  ${S('res-compass', '<circle cx="12" cy="12" r="10" fill="url(#g-compass)" stroke="#5a4420" stroke-width="1.4"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#8a7448" stroke-width=".8"/><path d="M12 4.5l2.2 7.5-2.2 7.5-2.2-7.5z" fill="#c8402a"/><path d="M12 12l2.2 0-2.2 7.5-2.2-7.5z" fill="#3a4a5a"/><circle cx="12" cy="12" r="1.3" fill="#3a2a10"/>')}
  ${S('res-tablet', '<path d="M5 3.5h12.5l1.8 2v15h-14.3z" fill="url(#g-stone)" stroke="#4a4436" stroke-width="1.2"/><path d="M8 8h8M8 11h6.5M8 14h7.5M8 17h5" stroke="#5a5242" stroke-width="1.3" stroke-linecap="round"/>')}
  ${S('res-arrow', '<path d="M12 2.5l6 11-6 8-6-8z" fill="url(#g-arrow)" stroke="#183a48" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 2.5v19M6 13.5l6-2 6 2" stroke="#d8f4ff" stroke-width=".8" opacity=".6" fill="none"/>')}
  ${S('res-gem', '<path d="M6 4h12l4 5.5-10 12-10-12z" fill="url(#g-gem)" stroke="#4a0618" stroke-width="1.2" stroke-linejoin="round"/><path d="M2 9.5h20M6 4l3 5.5 3 12M18 4l-3 5.5-3 12M9 9.5l3-5.5 3 5.5" stroke="#ffd0dc" stroke-width=".7" fill="none" opacity=".7"/>')}
  ${S('tr-boot', '<circle cx="12" cy="12" r="11" fill="#6a4a2a"/><path d="M8 5h5v7l4.5 2.2c1.2.6 1.6 1.6 1.6 2.8v1H6v-3l2-2z" fill="#f2e2c0"/><path d="M6 18h13" stroke="#3a2410" stroke-width="1.4"/>')}
  ${S('tr-car', '<circle cx="12" cy="12" r="11" fill="#4a6a3a"/><path d="M4.5 15v-3.5l2-3.5h7l2.5 3.5h3v3.5z" fill="#f2e2c0"/><path d="M7.5 9.2h5l1.5 2.3h-7.6z" fill="#4a6a3a"/><circle cx="8" cy="15.5" r="2" fill="#2a2a20" stroke="#f2e2c0" stroke-width="1"/><circle cx="16.5" cy="15.5" r="2" fill="#2a2a20" stroke="#f2e2c0" stroke-width="1"/>')}
  ${S('tr-ship', '<circle cx="12" cy="12" r="11" fill="#2a5a8a"/><path d="M11.5 4v9h-6z" fill="#f2e2c0"/><path d="M12.5 5.5l5 7.5h-5z" fill="#e8d8b0"/><path d="M4 14.5h16l-2.5 4h-11z" fill="#f2e2c0"/>')}
  ${S('tr-plane', '<circle cx="12" cy="12" r="11" fill="#7a3a6a"/><path d="M12 3.5c.9 0 1.3 1 1.3 2.3v4l6.2 3.6v1.8l-6.2-1.9v3.6l1.8 1.4v1.4L12 19l-3.1.7v-1.4l1.8-1.4v-3.6l-6.2 1.9v-1.8l6.2-3.6v-4c0-1.3.4-2.3 1.3-2.3z" fill="#f2e2c0"/>')}
  ${S('ic-vp', '<path d="M12 2.5l2.7 6 6.5.6-4.9 4.4 1.4 6.4L12 16.6 6.3 19.9l1.4-6.4-4.9-4.4 6.5-.6z" fill="#f4d060" stroke="#7a5a10" stroke-width="1.2" stroke-linejoin="round"/>')}
  ${S('ic-fear', '<circle cx="12" cy="12" r="11" fill="#3a1a4a"/><path d="M12 5c-3.6 0-6 2.6-6 5.6 0 2 1.1 3.3 2.2 4v2.6h7.6v-2.6c1.1-.7 2.2-2 2.2-4 0-3-2.4-5.6-6-5.6z" fill="#e8dcf0"/><circle cx="9.6" cy="11" r="1.6" fill="#3a1a4a"/><circle cx="14.4" cy="11" r="1.6" fill="#3a1a4a"/><path d="M10 16.5v1.2M12 16.5v1.2M14 16.5v1.2" stroke="#3a1a4a" stroke-width=".9"/>')}
  ${S('ic-idol', '<path d="M8 3h8l1.5 3-1.5 2v3l2 2-1 8H7l-1-8 2-2V8L6.5 6z" fill="url(#g-idol)" stroke="#6a4006" stroke-width="1.1" stroke-linejoin="round"/><circle cx="10" cy="7" r="1" fill="#6a4006"/><circle cx="14" cy="7" r="1" fill="#6a4006"/><path d="M10 10h4M9.5 15h5" stroke="#6a4006" stroke-width="1"/>')}
  ${S('ic-arch', '<circle cx="12" cy="6" r="3.6" fill="currentColor" stroke="#000a" stroke-width="1"/><path d="M5.5 21c0-5 1.5-9.5 6.5-9.5s6.5 4.5 6.5 9.5z" fill="currentColor" stroke="#000a" stroke-width="1"/><path d="M7.5 5.2h9l-1-1.8h-7z" fill="#5a3a1a"/>')}
  ${S('ic-guardian', '<path d="M12 2.5l8 3v6.5c0 5-3.6 8.4-8 9.8-4.4-1.4-8-4.8-8-9.8V5.5z" fill="#7a2a1a" stroke="#f0c070" stroke-width="1.2"/><path d="M8 10l2.2 1.4M16 10l-2.2 1.4M9 15.5c1.8 1.2 4.2 1.2 6 0" stroke="#f0c070" stroke-width="1.4" fill="none" stroke-linecap="round"/>')}
  ${S('ic-card', '<rect x="5" y="3" width="14" height="18" rx="2" fill="#f0e2c0" stroke="#5a4420" stroke-width="1.2"/><path d="M8 8h8M8 11.5h8M8 15h5" stroke="#8a7448" stroke-width="1.2"/>')}
  ${S('ic-exile', '<circle cx="12" cy="12" r="11" fill="#5a1a1a"/><path d="M7 7l10 10M17 7L7 17" stroke="#ffd0c0" stroke-width="2.4" stroke-linecap="round"/>')}
  ${S('ic-glass', '<circle cx="10" cy="10" r="6" fill="#bfe6f0" fill-opacity=".5" stroke="#d8b050" stroke-width="2.4"/><path d="M14.5 14.5l6 6" stroke="#6a4a20" stroke-width="3.2" stroke-linecap="round"/>')}
  ${S('ic-note', '<rect x="5" y="3" width="13" height="18" rx="1.5" fill="#8a3a2a" stroke="#3a1a10" stroke-width="1"/><rect x="7" y="5" width="9" height="14" rx="1" fill="#f0e2c0"/><path d="M9 9h5M9 12h5M9 15h3" stroke="#8a7448" stroke-width="1"/>')}
  ${S('ic-temple', '<path d="M3 20h18M5 20V10h14v10M4 10l8-6 8 6" fill="#c8b080" stroke="#4a3a1a" stroke-width="1.3" stroke-linejoin="round"/><path d="M8 12v6M12 12v6M16 12v6" stroke="#4a3a1a" stroke-width="1.6"/>')}
  ${S('ic-moon', '<path d="M15 3a9 9 0 1 0 6 15.5A7.5 7.5 0 0 1 15 3z" fill="#e8e0ff" stroke="#6a60a0" stroke-width="1"/>')}
  ${S('ic-assist', '<circle cx="12" cy="8" r="4" fill="#e0c8a0" stroke="#5a4020" stroke-width="1.1"/><path d="M4.5 21c.5-4.6 3.4-7.5 7.5-7.5s7 2.9 7.5 7.5z" fill="#4a7a8a" stroke="#1a3a44" stroke-width="1.1"/><path d="M8 6.2c1-2.6 7-2.6 8 0" stroke="#5a3a10" stroke-width="1.6" fill="none"/>')}
  </svg>`;
  document.addEventListener('DOMContentLoaded', () => document.body.insertAdjacentHTML('afterbegin', sprite));
})();

const RES_ICON = { coin: 'res-coin', compass: 'res-compass', tablet: 'res-tablet', arrow: 'res-arrow', gem: 'res-gem', draw: 'ic-card', exile: 'ic-exile', fear: 'ic-fear' };
const TRAVEL_ICON = { boot: 'tr-boot', car: 'tr-car', ship: 'tr-ship', plane: 'tr-plane' };

function ico(name, size = 18, cls = '', style = '') {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" style="${style}" aria-hidden="true"><use href="#${name}"/></svg>`;
}
/** {coin:2, tablet:1} → 아이콘 + 숫자 */
function resHTML(r, size = 16) {
  if (!r) return '';
  return Object.entries(r).filter(([, n]) => n).map(([k, n]) => `<span class="rs" title="${(window.app && app.catalog && app.catalog.resNames[k]) || k}">${n > 1 || k === 'draw' ? `<b>${n}</b>` : ''}${ico(RES_ICON[k] || 'ic-card', size)}</span>`).join('<span class="rs-plus">+</span>');
}
function travelHTML(t, size = 16) {
  if (!t) return '';
  const out = [];
  for (const [k, n] of Object.entries(t)) for (let i = 0; i < n; i++) out.push(ico(TRAVEL_ICON[k], size));
  return out.join('') || '<span class="hint">없음</span>';
}
