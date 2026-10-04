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
    { title: '💰 자원 5가지 — 어디서 얻고 어디에 쓰나요?', body: () => `
      <table class="g-table g-res-tbl">
        <tr><th>자원</th><th>주로 얻는 곳</th><th>쓰는 곳</th></tr>
        <tr><td>${R('coin')} <b>동전</b></td><td>탐사 자금 카드, 버려진 교역소, 우상</td><td><b>물건 카드</b> 구매 · 이동 비용의 <b>비행기 1개 = 동전 2개</b></td></tr>
        <tr><td>${R('compass')} <b>나침반</b></td><td>현지 조사 카드, 강가 나루터, 물건 카드</td><td><b>탐사</b>(1단계 3개, 2단계 6개) · <b>유물 카드</b> 구매</td></tr>
        <tr><td>${R('tablet')} <b>석판</b></td><td>야영지 샘터, 유적, 유물</td><td><b>연구</b> 비용 · 일부 수호자 제압 · 신전 타일</td></tr>
        <tr><td>${R('arrow')} <b>화살촉</b></td><td>사냥꾼의 오두막, 1·2단계 유적</td><td><b>수호자 제압</b>에 가장 많이 필요 · 연구 비용</td></tr>
        <tr><td>${R('gem')} <b>보석</b></td><td>2단계 유적, 강한 유물, 우상</td><td>연구 트랙 <b>윗줄</b>(4·6·7줄) · 수호자 · 11점 신전 타일</td></tr>
      </table>
      <p class="g-tip">💡 동전·나침반은 "카드를 사서 덱을 강하게" 만드는 자원, 석판·화살촉·보석은 "점수로 바꾸는" 자원이라고 생각하면 쉬워요.</p>` },
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
    { title: '🃏 내 덱은 어떻게 돌아가나요? (덱빌딩)', body: () => `
      <ol>
        <li>모두 <b>6장</b>으로 시작해요: 탐사 자금 2 (동전), 현지 조사 2 (나침반), <b>두려움 2</b> (효과 없음, -1점).</li>
        <li>라운드가 시작되면 덱에서 손패를 <b>5장</b>까지 뽑아요. 남은 손패는 다음 라운드로 이어져요.</li>
        <li>쓴 카드와 이동 비용으로 버린 카드는 <b>"이번 라운드에 쓴 카드"</b>에 모였다가, 라운드가 끝나면 <b>버림 더미</b>로 가요.</li>
        <li>덱이 떨어지면 버림 더미를 <b>섞어서</b> 새 덱을 만들어요. 그래서 좋은 카드를 살수록 덱이 점점 강해져요!</li>
        <li>산 <b>물건</b>은 <b>덱 맨 아래</b>로 들어가요 (곧바로 손에 오지 않아요). 산 <b>유물</b>은 그 자리에서 공짜로 한 번 쓸 수 있어요.</li>
        <li><b>추방</b> 효과로 쓸모없는 카드(특히 두려움)를 덱에서 영원히 없애면, 좋은 카드를 더 자주 뽑아요.</li>
      </ol>
      <p class="g-tip">💡 화면 아래 <b>📚 내 카드 전체 보기</b>를 누르면 지금 덱과 버림 더미에 무슨 카드가 있는지 볼 수 있어요.</p>` },
    { title: '🗓 첫 라운드 따라 해 보기', body: () => `
      <p>처음이라면 이렇게 해 보세요. (손패: 탐사 자금 ×2, 현지 조사 ×2, 두려움 ×1 이라고 가정)</p>
      <ol>
        <li><b>발굴</b> → <b>야영지 샘터</b>(도보 1) 선택 → 이동 비용으로 <b>두려움</b> 카드를 버림 → 석판 1 획득.<br><span class="hint">두려움은 효과가 없으니 이동 비용으로 버리는 게 가장 좋아요.</span></li>
        <li><b>카드 사용</b> → <b>현지 조사</b> → 나침반 +1.</li>
        <li><b>발굴</b> → <b>강가 나루터</b>(배 1) → 이동 비용으로 <b>탐사 자금</b>(배 아이콘)을 버림 → 나침반 +2.</li>
        <li><b>카드 사용</b> → 나머지 카드로 동전·나침반을 모아요.</li>
        <li><b>카드 구매</b>: 동전이 있으면 싼 물건(정글도, 밧줄 등), 나침반이 충분하면 유물.</li>
        <li><b>연구</b>: 석판이 있으면 돋보기를 1줄로 올려 보상(동전+나침반)을 받아요.</li>
        <li>더 할 게 없으면 <b>패스</b>.</li>
      </ol>
      <p class="g-tip">💡 2라운드부터는 모은 나침반 3개 + 지프 2개로 <b>1단계 유적 탐사</b>에 도전해 보세요. 우상 3점을 얻어요!</p>` },
    { title: '💡 이기는 전략 팁', body: () => `
      <ul>
        <li><b>연구 트랙이 가장 큰 점수원</b>이에요. 돋보기를 신전까지 올리면 그것만으로 16점 + 도착 보너스!</li>
        <li><b>수호자는 꼭 제압</b>하세요. 5점 + 혜택에, 두려움 카드도 피할 수 있어요. 화살촉을 미리 모아 두면 좋아요.</li>
        <li>탐사할 때는 <b>제압 비용을 낼 수 있을지</b> 먼저 생각하세요. 못 잡으면 라운드 끝에 두려움 카드를 받아요.</li>
        <li><b>초반에는 동전·나침반 카드</b>를 사서 덱을 키우고, <b>후반에는 석판·화살촉·보석</b>으로 점수를 내세요.</li>
        <li>유물은 <b>사자마자 공짜로 한 번</b> 쓸 수 있어서 사실상 두 번 쓰는 셈이에요. 후반에 유물이 많이 나와요.</li>
        <li><b>조수</b>는 라운드마다 공짜 자원을 줘요. 연구 2줄(조수 고용)은 빨리 가는 게 좋아요.</li>
        <li><b>우상 놓기</b>는 3점을 1점으로 바꾸는 대신 자원을 줘요. 꼭 필요한 순간(보석 1개만 모자랄 때 등)에만 쓰세요.</li>
        <li>다른 사람이 먼저 차지한 유적에는 그 라운드에 들어갈 수 없어요. 좋은 유적은 <b>먼저 가는 사람이 임자</b>!</li>
      </ul>` },
    { title: '❓ 자주 묻는 질문', body: () => `
      <dl class="g-faq">
        <dt>카드를 냈는데 효과가 없었어요.</dt><dd>이동 비용으로 버린 카드는 효과를 쓰지 않아요. 효과를 쓰려면 "카드 사용" 행동으로 내야 해요.</dd>
        <dt>⚡ 표시는 뭔가요?</dt><dd>자유 행동이에요. 주요 행동과 상관없이 내 차례에 언제든 쓸 수 있어요.</dd>
        <dt>발굴 버튼이 회색이에요.</dt><dd>고고학자 2명을 다 보냈거나, 빈 유적의 이동 비용을 낼 카드(또는 동전)가 없어서예요. 버튼에 마우스를 올리면 이유가 나와요.</dd>
        <dt>고고학자는 언제 돌아오나요?</dt><dd>라운드가 끝나면 모두 캠프로 돌아와요. 다음 라운드에 다시 2명을 쓸 수 있어요.</dd>
        <dt>수첩이 안 올라가요.</dt><dd>수첩은 돋보기보다 높이 갈 수 없어요. 돋보기를 먼저 올리세요.</dd>
        <dt>두려움 카드는 어떻게 없애요?</dt><dd>"추방" 효과가 있는 카드(연구 지원금, 제례용 북, 뼈 피리 등)나 경비병 조수, 악어 왕 수호자의 혜택을 쓰세요.</dd>
        <dt>게임은 언제 끝나요?</dt><dd>5라운드가 끝나면 바로 점수를 계산해요.</dd>
      </dl>` },
    { title: '📦 확장 — 탐험대장 · 뱀 신전 · 새 카드', body: () => `
      <p>대기실의 <b>⚙ 게임 설정</b>에서 방장이 켤 수 있어요. (원작 확장 「탐험대장들」과 판 뒷면의 구조를 따라 만든 자체 제작 내용)</p>
      <ul>
        <li><b>👑 탐험대장</b>: 6명 중 한 명을 골라요. 대장마다 <b>고유 능력</b>이 있고, 두려움 카드 1장 대신 <b>대장 전용 카드</b>로 시작해요.
          <div class="g-leaders">${(app.catalog ? app.catalog.leaders : []).map((l) => `<div>${l.icon} <b>${esc(l.name)}</b> <span class="hint">${esc(l.title)}</span><br><span class="hint">${esc(l.desc)}</span></div>`).join('')}</div></li>
        <li><b>🐍 뱀 신전 연구 트랙</b>: 판 뒷면. 연구 비용(특히 보석)이 비싸지만, 돋보기를 신전까지 올리면 20점! 익숙해진 뒤에 도전하세요.</li>
        <li><b>📦 새 카드·수호자·조수·유적</b>: 무전기, 모터보트, 화물 비행기, 재규어 가면 등 새 카드와 수호자 4종, 조수 3명, 유적 4곳이 섞여요.</li>
      </ul>` },
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
      <div class="g-toc">${SLIDES.map((sl, i) => `<button class="g-chip ${i === idx ? 'on' : ''}" data-gi="${i}">${i + 1}. ${sl.title.replace(/^\S+\s/, '').split(' — ')[0].split(' (')[0]}</button>`).join('')}</div>
      <div class="actions"><button class="small" data-g="prev" ${idx ? '' : 'disabled'}>◀ 이전</button><button class="primary" data-g="next">${idx === SLIDES.length - 1 ? '시작하기!' : '다음 ▶'}</button></div>`;
  }
  function open(i = 0) { idx = i; render(); $('#guide').classList.remove('hidden'); }

  /** 한 장짜리 빠른 참고표 */
  function reference() {
    const c = { ...app.catalog, research: trackData().rows, glassVP: trackData().glassVP, noteVP: trackData().noteVP };
    const rows = c.research.slice(1).map((r) => `<tr><td>${r.row === 7 ? '🏛 신전' : `${r.row}줄`}</td><td>${resHTML(r.cost, 15)}</td><td>${!r.reward ? '' : r.reward.kind === 'gain' ? resHTML(r.reward.res, 15) : r.reward.kind === 'assistant' ? '👤 조수 고용' : r.reward.kind === 'upgrade' ? '⭐ 조수 강화' : '도착 보너스 6/4/2/1점'}</td><td>${c.glassVP[r.row]} / ${c.noteVP[r.row]}</td></tr>`).join('');
    $('#guide .modal-inner').innerHTML = `<div class="g-head"><h2>📋 빠른 참고표</h2><button class="small" data-g="close">닫기 ✕</button></div>
      <div class="ref-grid">
        <div class="ref-box"><h3>⏳ 내 차례</h3><ol><li>주요 행동 <b>1개</b>: 발굴 · 탐사 · 수호자 제압 · 카드 구매 · 카드 사용 · 연구 · 신전 타일</li><li>⚡ 자유 행동은 몇 번이든: ⚡카드, 우상 놓기(라운드 1번), 조수, 수호자 혜택</li><li>할 게 없으면 <b>패스</b> (그 라운드 끝)</li></ol></div>
        <div class="ref-box"><h3>🚙 이동 비용</h3><p>${T('boot')} 도보 ← ${T('car')} 지프 · ${T('plane')} 비행기로도 가능<br>${T('car')} 지프 ← ${T('plane')} 비행기로도 가능<br>${T('ship')} 배 ← ${T('plane')} 비행기로도 가능<br>${T('plane')} 비행기 = 동전 2개로 대신 가능</p></div>
        <div class="ref-box"><h3>🏛 유적</h3><p>기본: 이동 비용만<br>1단계 탐사: 나침반 3 + ${T('car')}${T('car')}<br>2단계 탐사: 나침반 6 + ${T('plane')}${T('ship')}<br>탐사 → 우상(3점) + 수호자 등장<br>라운드 끝에 수호자 곁 고고학자 → 두려움 -1점</p></div>
        <div class="ref-box"><h3>🔁 라운드 끝</h3><p>고고학자 복귀 · 쓴 카드 → 버림 더미<br>손패 5장까지 보충 · 조수 다시 사용 가능<br>달 지팡이 이동 → 유물 칸 +1 · 선 플레이어 교대</p></div>
        <div class="ref-box wide"><h3>🔍 연구 트랙 <span class="hint">(줄 · 비용 · 보상 · 점수 돋보기/수첩)</span></h3><table class="g-table">${rows}</table></div>
        <div class="ref-box"><h3>🏆 점수</h3><p>연구 트랙 + 신전(도착 보너스·타일 2/6/11점)<br>우상 3점 (판에 놓으면 1점)<br>수호자 5점 · 카드 ★ · 두려움 -1</p></div>
      </div>`;
    $('#guide').classList.remove('hidden');
  }
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
  return { open, close, reference, isOpen: () => !$('#guide').classList.contains('hidden') };
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

/** 금색 상자 버튼에 마우스를 올렸을 때의 자세한 설명 */
function optionDesc(o, p, st, me) {
  const v = String(o.value);
  const D = {
    dig: '<b>⛏ 발굴</b><br>고고학자 1명을 <b>비어 있는 유적</b>에 보내요.<br>① 지도에서 유적 고르기 → ② 손패에서 카드를 버려 <b>이동 비용</b>(유적 오른쪽 위 아이콘) 내기 → ③ 유적에 그려진 자원 얻기<br><span class="hint">고고학자는 라운드마다 2명뿐이에요. 이동 비용으로 버린 카드는 효과를 쓰지 않아요.</span>',
    discover: '<b>🧭 새 유적 탐사</b><br>아직 아무도 가 보지 않은 유적을 열어요.<br>비용: <b>나침반</b>(1단계 3개 / 2단계 6개) + 이동 비용<br>얻는 것: <b>우상</b>(즉시 보너스 + 게임 끝 3점) + 그 유적의 자원<br>⚠ 그 자리에 <b>수호자</b>가 나타나요. 이번 라운드 안에 제압하지 못하면 두려움 카드(-1점)를 받아요.',
    overcome: '<b>⚔ 수호자 제압</b><br>내 고고학자가 있는 유적의 수호자를 물리쳐요.<br>비용: 수호자 칸에 적힌 자원<br>얻는 것: <b>5점</b> + <b>혜택</b> 1번 (원할 때 자유 행동으로 사용)<br><span class="hint">제압하면 라운드 끝에 두려움 카드를 받지 않아요.</span>',
    buy: '<b>🛒 카드 구매</b><br>아래 카드 줄에서 1장을 사요.<br>• <b>물건</b>(파란 카드): 동전으로 구매 → 덱 맨 아래로<br>• <b>유물</b>(주황 카드): 나침반으로 구매 → 지금 바로 <b>공짜로 1번</b> 사용 가능<br><span class="hint">카드에 적힌 ★은 게임 끝 점수예요.</span>',
    research: '<b>🔍 연구</b><br>연구 트랙에서 <b>돋보기</b> 또는 <b>수첩</b>을 한 줄 올려요.<br>비용: 그 줄에 적힌 석판·화살촉·보석<br>얻는 것: 처음 도착하는 줄의 보상(자원·조수 등) + 게임 끝 점수<br><span class="hint">수첩은 돋보기보다 높이 갈 수 없어요. 돋보기가 신전에 가면 큰 점수!</span>',
    temple: '<b>🏛 신전 타일 구매</b><br>돋보기가 신전에 도착하면 살 수 있어요.<br>11점 (석판+화살촉+보석) · 6점 (화살촉 2+석판) · 2점 (석판 2)',
    pass: '<b>이번 라운드 패스</b><br>이번 라운드에서 더 이상 차례를 받지 않아요. 모든 사람이 패스하면 라운드가 끝나요.<br><span class="hint">아직 할 수 있는 행동이 있다면 패스하기 전에 해 두세요!</span>',
    end: '<b>턴 끝내기</b><br>주요 행동을 했으니 다음 사람에게 차례를 넘겨요.',
    leader: (() => { const l = me.leader && app.catalog.leaders.find((x) => x.id === me.leader); return l ? `<b>${l.icon} ${esc(l.name)}의 능력</b> (자유 행동, 라운드마다 1번)<br>${esc(l.desc)}` : ''; })(),
    idol: `<b>🗿 우상 놓기</b> (자유 행동, 라운드마다 1번)<br>우상 1개를 판에 놓고 동전 2 / 나침반 2 / 석판 1 / 화살촉 1 / 카드 2장 중 하나를 얻어요.<br>대신 그 우상의 점수가 <b>3점 → 1점</b>이 돼요.`,
    cancel: '방금 고른 행동을 취소하고 행동 고르기로 돌아가요. (아직 아무 비용도 내지 않았어요)',
  };
  if (D[v]) return D[v];
  if (v.startsWith('play:') && o.card) {
    const cd = (me.hand || []).find((x) => x.uid === o.card);
    const c = cd && app.catalog.cards[cd.id];
    if (!c) return '';
    return `<b>${c.free ? '⚡' : '🃏'} ${esc(c.name)} 사용</b>${c.free ? ' (자유 행동 — 주요 행동이 아니에요)' : ' (주요 행동)'}<br>${esc(c.text.replace(/^⚡ /, ''))}${cardAdvice(c)}`;
  }
  if (v.startsWith('assist:')) {
    const a = app.catalog.assistants[v.slice(7)];
    const mine = (me.assistants || []).find((x) => x.id === v.slice(7));
    return `<b>👤 ${esc(a.name)}</b> (자유 행동, 라운드마다 1번)<br>${resHTML(mine && mine.up ? a.up : a.base, 15)} ${(mine && mine.up ? a.up : a.base).exile ? '카드 1장 추방' : ''}<br><span class="hint">라운드가 끝나면 다시 쓸 수 있어요.</span>`;
  }
  if (v.startsWith('boon:')) {
    const g = (me.guardians || [])[Number(v.slice(5))];
    const gd = g && app.catalog.guardians[g.id];
    if (!gd) return '';
    const b = gd.boon;
    return `<b>🛡 ${esc(gd.name)}의 혜택</b> (자유 행동, 한 번만)<br>${b.kind === 'gain' ? resHTML(b.res, 15) : b.kind === 'draw' ? `카드 ${b.n}장 뽑기` : b.kind === 'research' ? '연구 1칸 무료로 올리기' : '카드 1장 추방'}`;
  }
  if (o.site) return '';
  return '';
}

/** 카드별 사용 팁 */
function cardAdvice(c) {
  const t = c.text;
  const tips = [];
  if (t.includes('추방')) tips.push('두려움 카드를 추방하면 -1점이 사라지고 덱이 좋아져요.');
  if (t.includes('발굴')) tips.push('남은 고고학자가 있어야 쓸 수 있어요. 이동 비용을 아낄 수 있어요.');
  if (t.includes('연구')) tips.push('연구 비용이 줄어들어요. 남은 비용은 내야 해요.');
  if (t.includes('싸게 삽니다')) tips.push('이 카드를 쓰면 바로 카드 구매까지 해요.');
  if (t.includes('수호자')) tips.push('내 고고학자가 수호자 곁에 있어야 해요.');
  if (t.includes('교환') || t.includes('내고')) tips.push('필요한 자원이 있어야 교환할 수 있어요.');
  if (c.kind === 'fear') tips.push('효과는 없지만 이동 비용(도보)으로 버릴 수 있어요.');
  return tips.length ? `<div class="tip-advice">💡 ${tips.join('<br>💡 ')}</div>` : '';
}
