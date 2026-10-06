'use strict';
/* 반지의 제왕: 원정대의 운명 — 게임 방법 (그림 설명) */

const Guide = (() => {
  const pic = (svg, label) => `<div class="g-pic">${svg}<span>${label}</span></div>`;
  const badge = (id) => { const c = app.D && app.D.CHAR[id]; return c ? Art.charBadge(c, 42) : ''; };
  const tok = (svg) => `<svg width="34" height="34" viewBox="-12 -12 24 24">${svg}</svg>`;
  const SLIDES = [
    { title: '💍 원정대의 운명', body: () => `
      <p>사우론의 어둠이 가운데땅을 덮어 옵니다. 여러분은 <b>원정대</b>가 되어 힘을 합쳐요. (1~5인 협력)</p>
      <div class="g-pics">${pic(badge('frodo'), '프로도와 샘')}${pic(badge('gandalf'), '간달프')}${pic(badge('aragorn'), '아라곤')}${pic(badge('legolas'), '레골라스')}${pic(badge('gimli'), '김리')}</div>
      <p><b>승리</b>: 공개된 <b>목표</b>를 정해진 수만큼 이룬 뒤, <b>프로도와 샘</b>이 <b>운명의 산</b>에서 💍 카드를 모아 반지를 파괴하면 승리!</p>
      <p><b>패배</b>: <b>희망</b>이 0이 되거나, <b>원정대 덱</b>이 떨어지면 패배.</p>
      <p class="g-tip">💡 한 사람이 인물 2명을 맡아요. 첫 번째가 <b>주 인물</b>(행동 4번), 두 번째가 <b>보조 인물</b>(행동 1번).</p>` },
    { title: '🗺 내 차례: 행동 4번 + 보조 1번', body: () => `
      <ul>
        <li>🚶 <b>이동</b>: 길로 이어진 옆 지역으로.</li>
        <li>🃏 <b>카드 이동</b>: 장소 카드를 버리고 그 장소로 바로 (모르도르 제외).</li>
        <li>⚔ <b>공격</b>: 있는 곳의 오크 1마리 물리치기 (그곳에 군대가 있으면 +1).</li>
        <li>🛡 <b>군대 소집</b>: 있는 곳과 같은 지역 카드 1장을 버리고 군대 1부대 (최대 3).</li>
        <li>🏰 <b>요새 점령</b>: 오크가 없는 적 요새에서 같은 지역 카드 3장을 버리면 점령!</li>
        <li>🤝 <b>카드 주고받기</b>: 다른 사람의 인물과 같은 곳에 있으면.</li>
        <li>🧝 <b>프로도 움직이기</b>: 누구든 주 인물의 행동으로 프로도와 샘을 움직일 수 있어요.</li>
      </ul>
      <p class="g-tip">💡 이벤트 카드(보라색)는 행동을 쓰지 않고 언제든 쓸 수 있어요. 차례가 끝나면 카드 2장을 받아요 (손패 최대 7장).</p>` },
    { title: '🌑 어둠의 세력', body: () => `
      <div class="g-pics">${pic(tok(Art.orc(0, 0)), '오크')}${pic(tok(Art.army(0, 0)), '군대')}${pic(tok(Art.nazgul(0, 2)), '나즈굴')}</div>
      <p>차례가 끝날 때마다 <b>어둠 카드</b>를 위협 수만큼 뽑아요.</p>
      <ul>
        <li>📍 <b>장소 카드</b>: 그곳에 오크 1마리. <b>군대</b>가 있으면 군대 1부대가 대신 막아요.</li>
        <li>🔥 <b>돌파</b>: 오크가 3마리인 곳에 또 오면 넘쳐서 <b>희망 -1</b>, 옆 지역들에 오크가 퍼져요.</li>
        <li>🐎 <b>나즈굴의 사냥</b>: 가까운 나즈굴 3기가 프로도를 쫓아와요.</li>
        <li>👁 <b>사우론의 눈</b>: 프로도가 발각되었거나 모르도르에 있으면 수색!</li>
        <li>🌑 <b>어둠의 파도</b>(원정대 덱 속): 위협이 오르고, 한 곳에 오크 3마리, 버린 어둠 카드가 다시 위로!</li>
      </ul>` },
    { title: '🍃 숨기와 수색', body: () => `
      <p>프로도는 처음에 <b>숨어 있어요</b>. 오크 2마리 이상인 곳에 들어가거나, 사우론의 눈·수색에 걸리면 <b>발각</b>돼요.</p>
      <p>🎲 <b>수색 주사위</b> (숨어 있으면 1개, 발각되면 2개, 나즈굴이 여럿이면 더): <b>💀 절망</b> = 희망 -1, <b>👁 발각</b> = 발각 (이미 발각이면 희망 -1).</p>
      <ul>
        <li>👣 <b>은신 이동</b>: 👣 카드 1장을 버리면 프로도가 숨은 채 2칸까지 이동.</li>
        <li>🍃 <b>다시 숨기</b>: 안식처(깊은골·로슬로리엔·회색항구)에서, 또는 아라곤·갈라드리엘·파라미르와 같은 곳에서.</li>
        <li>⚡ 간달프와 에오윈은 나즈굴을 미나스 모르굴로 쫓아낼 수 있어요.</li>
      </ul>
      <p class="g-tip">💡 안식처에는 나즈굴과 오크가 들어오지 못해요!</p>` },
    { title: '🏆 목표와 운명의 산', body: () => `
      <p>게임마다 24개 목표 중 <b>5개</b>가 공개돼요 (아이센가드 함락, 헬름협곡 사수, 로한의 소집, 샤이어 수복…). 조건을 채우면 바로 달성, 희망 +1!</p>
      <p>필요한 수만큼 목표를 이루고 나면, 프로도를 <b>운명의 산</b>으로 데려가 <b>원정대 손패에서 💍 카드</b>(보통 5장)를 버리면 반지 파괴 — 승리!</p>
      <p class="g-tip">💡 💍 카드는 아껴 두세요. 프로도는 모르도르 문턱(이실리엔·죽음의 늪)에서 기다리다가 목표가 거의 끝나면 들어가는 게 안전해요.</p>` },
    { title: '🧝 인물마다 다른 능력', body: () => `
      <ul style="font-size:.9em">${(app.catalog ? app.catalog.characters : []).map((c) => `<li>${c.icon} <b>${c.name}</b> — ${c.ability}</li>`).join('')}</ul>
      <p class="g-tip">💡 처음이라면 <b>간달프 + 아라곤</b> 조합과 <b>쉬움</b> 난이도를 추천해요.</p>` },
  ];
  let idx = 0;
  function render() {
    const s = SLIDES[idx];
    const box = document.querySelector('#guide .modal-inner');
    box.innerHTML = `<h2>${s.title}</h2><div class="g-slide">${s.body()}</div>
      <div class="g-dots">${SLIDES.map((_, i) => `<i class="${i === idx ? 'on' : ''}"></i>`).join('')}</div>
      <div class="actions"><button class="small" id="g-prev" ${idx ? '' : 'disabled'}>◀ 이전</button><span style="flex:1"></span><button class="small" id="g-close">닫기</button><button class="primary" id="g-next">${idx < SLIDES.length - 1 ? '다음 ▶' : '시작하기!'}</button></div>`;
    document.getElementById('g-prev').onclick = () => { idx--; render(); };
    document.getElementById('g-next').onclick = () => { if (idx < SLIDES.length - 1) { idx++; render(); } else close(); };
    document.getElementById('g-close').onclick = close;
  }
  function open(i = 0) { idx = i; render(); document.getElementById('guide').classList.remove('hidden'); try { localStorage.setItem('lotr-guided', '1'); } catch { /* 무시 */ } }
  function close() { document.getElementById('guide').classList.add('hidden'); }
  function isOpen() { return !document.getElementById('guide').classList.contains('hidden'); }
  return { open, close, isOpen };
})();
window.Guide = Guide;
