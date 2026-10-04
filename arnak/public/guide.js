'use strict';
/* 아르낙 온라인 — 게임 방법 안내(슬라이드) + 지금 할 일 도움말 */

const Guide = (() => {
  const R = (k, n = '') => `<span class="g-res">${n !== '' ? `<b>${n}</b>` : ''}${ico(RES_ICON[k], 20)}</span>`;
  const T = (k) => ico(TRAVEL_ICON[k], 22);
  const SLIDES = [
    { title: '🗿 아르낙에 오신 것을 환영해요', body: () => `
      <p>지도에도 없는 섬 <b>아르낙</b>에서 고대 문명의 유적이 발견되었습니다. 여러분은 경쟁하는 탐험대의 대장이에요.</p>
      <div class="g-box"><b>목표</b>: <b>5라운드</b>가 끝났을 때 <b>점수(★)</b>가 가장 높은 사람이 승리!</div>
      <p>점수를 얻는 방법</p>
      <ul>
        <li>🔍 <b>연구 트랙</b>을 높이 올라가기 (가장 큰 점수원)</li>
        <li>⚔ <b>수호자</b>를 제압하기 (하나에 5점)</li>
        <li>🗿 <b>우상</b> 모으기 (하나에 3점)</li>
        <li>🃏 점수가 적힌 <b>카드</b> 사기</li>
        <li>🏛 <b>신전 타일</b> 사기 (연구 트랙 꼭대기)</li>
      </ul>
      <p class="g-tip">💡 처음이라면 "혼자 하기 — AI 1명"으로 한 판 해 보세요. 화면 위 금색 상자와 💡 도움말이 할 일을 알려 줘요.</p>` },
    { title: '⏳ 한 라운드의 흐름', body: () => `
      <ol>
        <li>라운드가 시작되면 손패를 <b>5장</b>까지 채웁니다.</li>
        <li>차례가 오면 <b>주요 행동 1개</b>를 합니다. 자유 행동(⚡)은 원할 때 몇 번이든 할 수 있어요.</li>
        <li>더 할 게 없으면 <b>패스</b>. 그 라운드에서는 더 이상 차례가 오지 않아요.</li>
        <li>모두 패스하면 라운드 끝:
          <ul><li>고고학자 2명이 캠프로 돌아옵니다</li>
          <li><b>수호자가 남아 있는 유적</b>에 있던 고고학자는 <b>두려움 카드</b>(-1점)를 받아요</li>
          <li>쓴 카드는 버림 더미로 → 덱이 떨어지면 섞어서 다시 사용</li>
          <li>달 지팡이가 오른쪽으로 한 칸 → 유물 칸이 늘어나요</li></ul></li>
      </ol>
      <p class="g-tip">💡 고고학자는 2명뿐이에요. 한 라운드에 발굴·탐사는 최대 2번! 나머지 차례에는 카드 사기, 카드 쓰기, 연구를 하세요.</p>` },
    { title: '🎯 주요 행동 (차례마다 하나)', body: () => `
      <div class="g-grid">
        <div><b>⛏ 발굴</b><br>고고학자 1명을 유적에 보내고 <b>이동 비용</b>을 낸 뒤 그 유적의 자원을 얻어요.</div>
        <div><b>🧭 탐사</b><br>나침반 ${R('compass')}을 내고 새 유적을 열어요. <b>우상</b>과 유적 자원을 얻지만 <b>수호자</b>가 나타나요!</div>
        <div><b>⚔ 수호자 제압</b><br>내 고고학자가 있는 곳의 수호자 비용을 내면 <b>5점</b> + 혜택 1번.</div>
        <div><b>🛒 카드 구매</b><br>물건은 동전 ${R('coin')}, 유물은 나침반 ${R('compass')}으로 사요.</div>
        <div><b>🃏 카드 사용</b><br>손패의 카드 1장을 써서 효과를 얻어요. (⚡ 카드는 자유 행동)</div>
        <div><b>🔍 연구</b><br>석판 ${R('tablet')}·화살촉 ${R('arrow')}·보석 ${R('gem')}을 내고 연구 트랙을 한 줄 올라가요.</div>
      </div>
      <p><b>자유 행동(⚡)</b>: ⚡ 카드 쓰기, 🗿 우상 놓기(라운드마다 1번), 👤 조수 부르기, 🛡 수호자 혜택 쓰기</p>` },
    { title: '🚙 이동 비용 — 카드를 버려서 냅니다', body: () => `
      <p>모든 카드 왼쪽 위에는 <b>이동 아이콘</b>이 있어요. 발굴·탐사할 때 손패에서 카드를 버려 그 아이콘으로 비용을 냅니다. (그 카드의 효과는 쓰지 못해요)</p>
      <div class="g-travel">
        <div>${T('boot')} <b>도보</b><br><span class="hint">도보·지프·비행기로 낼 수 있음</span></div>
        <div>${T('car')} <b>지프</b><br><span class="hint">지프·비행기로 낼 수 있음</span></div>
        <div>${T('ship')} <b>배</b><br><span class="hint">배·비행기로 낼 수 있음</span></div>
        <div>${T('plane')} <b>비행기</b><br><span class="hint">무엇이든 낼 수 있음 · 동전 2개로 대신 가능</span></div>
      </div>
      <p class="g-tip">💡 두려움 카드는 효과는 없지만 ${T('boot')} 도보 아이콘으로 이동 비용을 낼 수 있어요. 쓸모없는 카드는 이동 비용으로 버리세요!</p>` },
    { title: '🏛 유적 · 우상 · 수호자', body: () => `
      <ul>
        <li><b>기본 유적</b>(아래 줄 5곳): 처음부터 열려 있어요. 이동 비용만 내면 발굴할 수 있어요.</li>
        <li><b>1단계 유적</b>(가운데 줄): 나침반 3 + 지프 2로 <b>탐사</b>. <b>2단계 유적</b>(위 줄): 나침반 6 + 비행기 1 + 배 1.</li>
        <li>탐사하면 그 자리의 <b>우상</b>(${ico('ic-idol', 20)})을 얻어요: 즉시 보너스 + 게임 끝 <b>3점</b>.</li>
        <li>그리고 <b>수호자</b>(${ico('ic-guardian', 20)})가 나타나요. 이번 라운드가 끝나기 전에 <b>제압</b>하지 못하면 그곳 고고학자는 두려움 카드를 받아요.</li>
        <li>수호자를 제압하면 <b>5점</b>과 <b>혜택</b>(한 번 쓰는 자원·연구 등)을 얻어요.</li>
        <li>한 유적에는 고고학자 1명만 들어갈 수 있어요. 탐사한 유적은 다음부터 누구나 발굴할 수 있어요.</li>
      </ul>
      <p><b>우상 놓기</b>(자유 행동, 라운드마다 1번): 우상을 판에 놓고 동전 2 / 나침반 2 / 석판 1 / 화살촉 1 / 카드 2장 중 하나를 얻어요. 대신 그 우상은 3점 → 1점.</p>` },
    { title: '🛒 카드 줄과 달 지팡이', body: () => `
      <ul>
        <li><b>물건</b>(파란 카드): 동전으로 사요. 산 물건은 <b>덱 맨 아래</b>로 들어가 나중에 손패로 와요.</li>
        <li><b>유물</b>(주황 카드): 나침반으로 사요. 사자마자 <b>공짜로 한 번 쓸 수 있어요</b>! 강하고 점수도 높아요.</li>
        <li>🌙 <b>달 지팡이</b> 왼쪽이 유물, 오른쪽이 물건 칸이에요. 라운드마다 지팡이가 한 칸씩 오른쪽으로 → 갈수록 유물이 많아져요.</li>
        <li>카드에 적힌 ★ 숫자는 게임 끝 점수예요.</li>
        <li>추방 효과로 <b>두려움 카드를 덱에서 없앨 수 있어요</b>.</li>
      </ul>` },
    { title: '🔍 연구 트랙 — 신전을 향해', body: () => `
      <p>오른쪽 연구 트랙에는 말이 둘 있어요: <b>🔍 돋보기</b>와 <b>📓 수첩</b>. 연구 행동마다 하나를 한 줄 올립니다.</p>
      <ul>
        <li>각 줄 옆의 <b>비용</b>(석판·화살촉·보석)을 내야 해요.</li>
        <li>처음 도착하면 <b>보상</b>: 자원, <b>조수</b>(라운드마다 1번 쓰는 동료), 조수 업그레이드 등</li>
        <li><b>수첩은 돋보기보다 높이 갈 수 없어요.</b></li>
        <li>게임 끝에 두 말의 높이만큼 점수 (돋보기가 더 큰 점수).</li>
        <li>돋보기가 <b>신전</b>에 도착하면 도착 순서대로 보너스 점수(6/4/2/1), 그 뒤로는 <b>신전 타일</b>을 사서 큰 점수를 얻어요.</li>
      </ul>
      <p class="g-tip">💡 석판·화살촉·보석은 연구와 수호자 제압에 필요해요. 발굴과 카드로 꾸준히 모으세요.</p>` },
    { title: '🏆 점수 계산', body: () => `
      <table class="g-table">
        <tr><td>🔍 연구 트랙</td><td>돋보기 줄 점수 + 수첩 줄 점수</td></tr>
        <tr><td>🏛 신전</td><td>도착 보너스 + 신전 타일 (2 / 6 / 11점)</td></tr>
        <tr><td>🗿 우상</td><td>안 쓴 우상 3점, 판에 놓은 우상 1점</td></tr>
        <tr><td>⚔ 수호자</td><td>제압한 수호자 하나에 5점</td></tr>
        <tr><td>🃏 카드</td><td>가진 카드의 ★ 합계</td></tr>
        <tr><td>😱 두려움</td><td>두려움 카드 한 장에 -1점</td></tr>
      </table>
      <p>게임 중에도 오른쪽 플레이어 목록에서 지금 점수를 볼 수 있어요.</p>
      <p class="g-tip">⚠ 이 게임은 원작 「아르낙의 잊혀진 유적」의 규칙 구조를 따라 만든 팬 제작 온라인 버전이에요. 카드·유적·수호자의 이름과 효과, 그림은 이 프로젝트에서 새로 만든 것입니다.</p>` },
  ];
  let idx = 0;
  function render() {
    const s = SLIDES[idx];
    $('#guide .modal-inner').innerHTML = `<div class="g-head"><h2>${s.title}</h2><span class="hint">${idx + 1} / ${SLIDES.length}</span><button class="small" data-g="close">닫기 ✕</button></div>
      <div class="g-body">${s.body()}</div>
      <div class="g-dots">${SLIDES.map((_, i) => `<i class="${i === idx ? 'on' : ''}" data-gi="${i}"></i>`).join('')}</div>
      <div class="actions"><button class="small" data-g="prev" ${idx ? '' : 'disabled'}>◀ 이전</button><button class="primary" data-g="next">${idx === SLIDES.length - 1 ? '시작하기!' : '다음 ▶'}</button></div>`;
  }
  function open(i = 0) { idx = i; render(); $('#guide').classList.remove('hidden'); }
  function close() { $('#guide').classList.add('hidden'); try { localStorage.setItem('arnak-guided', '1'); } catch { /* 무시 */ } }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#guide')) return;
    if (e.target.id === 'guide') { close(); return; }
    const g = e.target.closest('[data-g]');
    const gi = e.target.closest('[data-gi]');
    if (gi) { idx = Number(gi.dataset.gi); render(); return; }
    if (!g) return;
    if (g.dataset.g === 'close') close();
    else if (g.dataset.g === 'prev') { idx = Math.max(0, idx - 1); render(); } else if (g.dataset.g === 'next') { if (idx === SLIDES.length - 1) close(); else { idx++; render(); } }
  });
  return { open, close, isOpen: () => !$('#guide').classList.contains('hidden') };
})();

/** 지금 해야 할 일을 쉬운 말로 */
function promptHint(p, st, me) {
  if (!p) {
    if (st.result) return '게임이 끝났어요! 점수표를 확인하세요.';
    const cur = st.current && st.players.find((x) => x.id === st.current);
    return cur ? `<b>${esc(cur.name)}</b>의 차례예요. 기다리는 동안 지도와 카드 줄을 살펴보세요. 다른 사람이 뭘 하는지는 오른쪽 기록에 나와요.` : '잠시 기다려 주세요…';
  }
  if (p.kind === 'turn') {
    if (!p.main) return '주요 행동을 했어요. ⚡ 자유 행동이 남아 있으면 쓰고, 다 했으면 <b>턴 끝내기</b>를 누르세요.';
    const tips = [];
    if (me.arch > 0) tips.push(`고고학자 <b>${me.arch}명</b>이 남아 있어요. <b>발굴</b>로 자원을 모으거나, 나침반이 충분하면 <b>탐사</b>로 새 유적과 우상을 얻으세요.`);
    else tips.push('고고학자를 모두 보냈어요. <b>카드 사용</b>, <b>카드 구매</b>, <b>연구</b>를 하거나 <b>패스</b>하세요.');
    const g = st.sites.find((s) => s.guardian && s.occupants.includes(app.you));
    if (g) tips.push(`⚠ 내 고고학자가 있는 [${esc(g.name)}]에 수호자가 있어요! 이번 라운드에 <b>제압</b>하지 않으면 두려움 카드를 받아요.`);
    if (p.options.some((o) => o.value === 'research' && !o.disabled)) tips.push('🔍 연구를 할 수 있어요 — 가장 큰 점수원이에요.');
    tips.push('카드는 손패에서 바로 눌러 쓸 수도 있어요.');
    return tips.join(' ');
  }
  if (p.kind === 'site') return '지도에서 <b>빛나는 유적</b>을 클릭하거나 위의 버튼을 누르세요. 유적 아래쪽에 얻는 자원, 위쪽에 이동 비용이 나와 있어요.';
  if (p.kind === 'row') return '카드 줄에서 <b>빛나는 카드</b>를 클릭하세요. 물건은 덱 맨 아래로, 유물은 지금 바로 공짜로 쓸 수 있어요.';
  if (p.kind === 'research') return '🔍 돋보기를 올리면 점수가 크고, 📓 수첩은 돋보기를 따라가며 보상을 한 번 더 받아요.';
  if (p.kind === 'travel') return '버릴 카드를 고르세요. 추천 조합이 미리 선택되어 있어요. 버린 카드는 효과를 쓰지 못하니, 효과가 약한 카드(두려움·시작 카드)를 버리는 게 좋아요.';
  if (p.kind === 'exile') return '추방한 카드는 게임에서 사라져요. <b>두려움 카드</b>를 추방하면 -1점이 없어지고 덱도 좋아져요.';
  return '위 금색 상자에서 하나를 고르세요.';
}
