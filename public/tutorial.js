'use strict';
/* 정령섬 온라인 — 실전 튜토리얼 코치: 화면의 해당 부분을 빛나게 짚으면서 첫 두 턴을 한 단계씩 안내한다 */

/** 카드를 사람이 읽기 쉬운 문장으로 설명 */
function explainCard(c) {
  if (!c) return '';
  const speed = c.speed === 'fast' ? '<b class="ex-fast">빠른 권능</b>이라 침략자가 움직이기 <b>전에</b> 발동' : '<b class="ex-slow">느린 권능</b>이라 침략자가 움직인 <b>뒤에</b> 발동';
  let target;
  const t = c.target;
  if (t.kind === 'spirit') target = '정령 하나(나 또는 친구)를 골라';
  else {
    const from = t.from === 'sacred' ? '내 <b>성지</b>(존재 2개 이상인 지역)' : '내 <b>존재</b>가 있는 지역';
    const dist = t.range === 0 ? '그 지역 자체' : `<b>${t.range}칸</b> 이내`;
    const f = FILTER_NAME[t.filter] || `${t.filter.split('/').map((x) => app.catalog.terrains[x]).join('/')} 지역`;
    target = `${from}에서 ${dist}의 ${f} 하나를 골라`;
  }
  return `에너지 <b>${c.cost}</b>을 내고 낸 카드 → ${speed} → ${target}: <i>${esc(c.text)}</i>`;
}

const Tutorial = (() => {
  let idx = 0;
  let shown = false;
  let off = false;
  let lastSpot = null;
  const names = (ids) => (ids && ids.length ? ids.join(', ') : '없음');
  const card = (st, which) => (st.invader[which] ? st.invader[which].name : '없음');
  const has = (ctx, id) => ctx.st.spirits[app.you] && ctx.st.spirits[app.you].hand.includes(id);

  const STEPS = [
    { type: 'info', title: '튜토리얼에 오신 걸 환영해요!',
      text: () => '당신은 <b>대지의 활력</b> 정령입니다. 바다 건너온 <b>침략자</b>들이 섬을 개척하며 땅을 망가뜨리고 있어요. 권능을 써서 침략자를 막고 몰아내는 것이 목표입니다.<br>먼저 화면을 하나씩 살펴볼게요. <b>다음</b>을 누르세요.' },
    { type: 'info', spot: '.map-wrap', title: '① 섬 지도',
      text: () => '이것이 섬입니다. 지역마다 <b>지형</b>(산·정글·사막·습지)이 있어요.<br>• 탐험가·마을·도시 = <b>침략자</b> (적)<br>• 다한 = 섬의 원주민 (<b>우리 편</b>, 침략자에게 반격)<br>• 빛나는 구슬 = 당신의 <b>존재</b>. 권능은 존재가 있는 곳 근처에만 쓸 수 있어요.<br>지역에 마우스를 올리면 무엇이 있는지 자세히 나옵니다.' },
    { type: 'info', spot: '.inv-track', title: '② 침략자는 언제, 어디로 오나요?',
      text: (ctx) => `위쪽 <b>침략자 진행표</b>를 보세요. 침략자 카드에는 <b>지형</b>이 적혀 있고, 매 턴 <b>오른쪽으로 한 칸씩</b> 이동합니다.<br>
        <b>🧭 탐험</b>(새 카드: 그 지형의 해안·마을 근처에 탐험가 도착) → <b>🏠 건설</b>(그 지형의 침략자가 마을을 지음) → <b>⚔ 약탈</b>(그 지형의 침략자가 땅을 공격)<br>
        지금 <b>건설</b> 칸에 <b>[${card(ctx.st, 'build')}]</b>, 약탈 칸에 <b>[${card(ctx.st, 'ravage')}]</b>가 있어요. 즉 이번 턴에는 <b>${card(ctx.st, 'build')}</b> 지형에 마을이 지어지고, 이 카드는 <b>다음 턴 약탈</b>로 이동합니다.` },
    { type: 'info', spot: '.map-wrap', title: '③ 지도의 예보 표시',
      text: (ctx) => `지도에 이번 턴 침략자가 행동할 곳이 표시돼요.<br>
        <span class="fc-chip build">🏠 건설 예정</span> ${names(ctx.st.forecast.build)} &nbsp; <span class="fc-chip ravage">⚔ 약탈 예정</span> ${names(ctx.st.forecast.ravage)}<br>
        침략자들은 <b>권능 단계가 끝난 뒤</b>에 움직입니다. 그 전에 권능으로 그 지역의 침략자를 없애거나, 밀어내거나, 행동을 막을 수 있어요!` },
    { type: 'info', spot: '#side-content', title: '④ 내 정령 정보',
      text: () => '오른쪽은 당신 정령의 정보입니다.<br>• <b>보유 에너지</b>: 카드를 낼 때 쓰는 돈<br>• <b>턴당 에너지 / 카드 사용 수</b>: 매 턴 받는 에너지와 낼 수 있는 카드 장수<br>• <b>존재 트랙</b>: 존재를 섬에 놓을수록 이 값들이 커져요<br>• <b>특수 규칙</b>: 대지의 활력은 성지(존재 2개 이상)에 방어 3<br>📜 <b>정령 판 보기</b>를 누르면 자세한 설명을 볼 수 있어요.' },
    { type: 'action', spot: '#prompt', title: '⑤ 직접 해 봐요: 성장',
      when: (ctx) => ctx.kind === 'growth',
      text: () => '한 턴은 <b>성장 → 카드 내기 → 빠른 권능 → 침략자 → 느린 권능</b> 순서예요.<br>먼저 <b>성장</b>: 위 금색 상자에서 세 번째 <b>"존재 추가(사거리 1) + 에너지 +2"</b>를 눌러 보세요. 섬에 퍼지면서 에너지도 얻습니다.' },
    { type: 'action', spot: '.map-wrap', title: '⑥ 존재 놓기',
      when: (ctx) => ctx.kind === 'presenceLand',
      text: () => '지도에서 <b>빛나는 지역</b>이 존재를 놓을 수 있는 곳이에요 (지금 존재에서 1칸 이내).<br>침략자가 있는 곳 근처에 두면 권능이 닿기 쉬워요. 빛나는 지역 하나를 <b>클릭</b>하세요.' },
    { type: 'action', spot: '#prompt', title: '⑦ 존재를 어디서 꺼낼까?',
      when: (ctx) => ctx.kind === 'presenceSource',
      text: () => '존재는 오른쪽 <b>존재 트랙</b>에서 꺼냅니다.<br>• <b>에너지 트랙</b>에서 꺼내면 → 매 턴 받는 에너지 증가<br>• <b>카드 트랙</b>에서 꺼내면 → 매 턴 낼 수 있는 카드 수 증가<br>어느 쪽이든 좋아요. 하나를 고르세요.' },
    { type: 'action', spot: '#modal .modal-inner', title: '⑧ 권능 카드 내기',
      when: (ctx) => ctx.kind === 'play',
      text: (ctx) => `손에 있는 <b>권능 카드</b>를 에너지로 냅니다. <b>카드 읽는 법</b>:<br>• 왼쪽 위 <b>숫자</b> = 필요한 에너지 (지금 에너지 ${ctx.p.budget}, 최대 ${ctx.p.max}장)<br>• <b class="ex-fast">빠름</b> = 침략자보다 먼저 / <b class="ex-slow">느림</b> = 침략자 다음에 발동<br>• 아래 글 = 효과, 그 위 줄 = 어디에 쓸 수 있는지(사거리)<br>
        ${has(ctx, 'perfect_stillness') ? `이번 턴 <b>${card(ctx.st, 'build')}</b> 지역에 마을이 지어지니, <b>"완벽한 정적의 해"</b>(빠름: 그 지역 침략자의 모든 행동을 막음)를 눌러 고르고 <b>"1장 사용하기"</b>를 눌러 보세요.` : '카드를 눌러 고르고 아래 사용하기 버튼을 누르세요.'}` },
    { type: 'action', spot: '#prompt', title: '⑨ 빠른 권능 사용',
      when: (ctx) => ctx.kind === 'power' && ctx.phase === 'fast' && ctx.p.options.some((o) => o.card),
      text: () => '<b>빠른 권능 단계</b>입니다. 침략자가 움직이기 전이에요!<br>위 금색 상자에서 방금 낸 <b>카드 이름 버튼</b>을 눌러 사용하세요.' },
    { type: 'action', spot: '.map-wrap', title: '⑩ 대상 지역 고르기',
      when: (ctx) => ctx.kind === 'target',
      text: (ctx) => `<b>빛나는 지역</b> = 이 카드가 닿는 곳(사거리 안)입니다.<br>${ctx.st.forecast.build.length ? `<span class="fc-chip build">🏠 건설 예정</span>인 <b>${names(ctx.st.forecast.build.filter((id) => ctx.p.options.includes(id)))}</b> 중 하나를 클릭하면, 그곳 침략자는 이번 턴 아무것도 못 해요!` : '침략자가 있는 지역을 클릭하세요.'}` },
    { type: 'action', spot: '#prompt', title: '⑪ 빠른 권능 끝내기',
      when: (ctx) => ctx.kind === 'power' && ctx.phase === 'fast' && !ctx.p.options.some((o) => o.card),
      text: () => '더 쓸 빠른 권능이 없으면 <b>"빠른 권능 단계 종료"</b>를 누르세요. 그러면 침략자가 움직입니다.' },
    { type: 'action', spot: '.map-wrap', title: '⑫ 침략자 단계를 지켜보세요',
      when: (ctx) => ctx.phase === 'invader',
      text: () => '이제 침략자 차례예요. 할 일은 없으니 <b>화면 가운데 안내</b>를 따라 지켜보세요.<br>① 공포 카드(모은 경우) → ② <b>약탈</b> → ③ <b>건설</b> → ④ <b>탐험</b>(새 카드) → ⑤ 카드가 한 칸씩 이동<br>권능으로 막은 지역에서는 아무 일도 일어나지 않아요.' },
    { type: 'action', spot: '#prompt', title: '⑬ 느린 권능',
      when: (ctx) => ctx.kind === 'power' && ctx.phase === 'slow',
      text: () => '<b>느린 권능 단계</b>: 침략자가 움직인 뒤에 쓰는 권능입니다. 느린 카드를 냈다면 지금 쓰고, 없으면 <b>"느린 권능 단계 종료"</b>를 누르세요.<br>그다음 <b>시간 흐름</b>: 사용한 카드는 버림 더미로 가고 다음 턴이 시작돼요.' },
    { type: 'action', spot: '.inv-track', title: '⑭ 2턴: 이번엔 약탈이 와요!',
      when: (ctx) => ctx.turn >= 2 && ctx.kind === 'growth',
      text: (ctx) => `진행표를 보세요. 지난 턴의 건설 카드 <b>[${card(ctx.st, 'ravage')}]</b>가 <b>⚔ 약탈</b> 칸으로 이동했어요.<br>
        <span class="fc-chip ravage">⚔ 약탈 예정</span> <b>${names(ctx.st.forecast.ravage)}</b> — 이 지역의 침략자가 이번 턴 땅을 공격합니다. 피해가 2 이상이면 <b>황폐</b>가 생겨요!<br>
        막는 방법: 피해로 침략자 없애기(파괴의 의식), 방어 올리기(치유되는 땅의 수호), 밀어내기·모으기(풍요로운 대지의 이끌림).<br>
        손패가 비었다면 이번 성장에서 <b>"카드 모두 회수"</b>를 고르세요.` },
    { type: 'info', title: '🎉 기본은 다 배웠어요!',
      when: (ctx) => ctx.turn >= 2,
      text: () => '이제 자유롭게 해 보세요. 기억할 것:<br>1. 매 턴 <b>진행표</b>와 지도의 <b>⚔ 약탈 예정</b>을 확인<br>2. <b>빠른 권능</b>으로 약탈 전에 막기<br>3. 존재를 늘려 에너지와 카드 수 키우기<br>4. 마을·도시를 파괴하면 <b>공포</b>가 쌓여 승리가 가까워져요<br>막히면 금색 상자 아래 💡 도움말과 위쪽 📖 게임 방법을 보세요.' },
  ];

  function ctxOf(st, p) {
    return { st, p: p || {}, kind: p ? p.kind || p.type : null, phase: st.phase, turn: st.turn };
  }

  function setSpot(sel) {
    if (lastSpot) for (const el of document.querySelectorAll('.tut-spot')) el.classList.remove('tut-spot');
    lastSpot = sel;
    if (!sel) return;
    const el = document.querySelector(sel);
    if (el) el.classList.add('tut-spot');
  }

  function render(step, ctx) {
    const box = $('#coach');
    if (!step) { box.classList.add('hidden'); setSpot(null); return; }
    box.classList.remove('hidden');
    box.innerHTML = `<div class="coach-h"><span>🎓 튜토리얼 코치</span><span class="hint">${idx + 1} / ${STEPS.length}</span><button class="small" id="coach-off">코치 닫기</button></div>
      <h4>${step.title}</h4><div class="coach-t">${step.text(ctx)}</div>
      ${step.type === 'info' ? `<div class="coach-a"><button class="primary small" id="coach-next">${idx === STEPS.length - 1 ? '끝내기' : '다음 ▶'}</button></div>` : '<div class="coach-a hint">👆 안내대로 해 보세요. 하면 자동으로 다음으로 넘어가요.</div>'}`;
    $('#coach-off').onclick = () => { off = true; render(null); };
    const nx = $('#coach-next');
    if (nx) nx.onclick = () => { idx++; shown = false; update(app.state, app.prompt); };
    setSpot(step.spot);
  }

  function update(st, p) {
    if (!st || !st.tutorial || off || st.result) { if ($('#coach')) render(null); return; }
    const ctx = ctxOf(st, p);
    for (let guard = 0; guard < STEPS.length; guard++) {
      const step = STEPS[idx];
      if (!step) { render(null); return; }
      const ok = !step.when || step.when(ctx);
      if (step.type === 'action') {
        if (shown && !ok) { idx++; shown = false; continue; }
        if (!ok) {
          // 이미 지나간 단계라면(다음 단계 조건이 맞으면) 건너뛴다
          const j = STEPS.findIndex((x, k) => k > idx && k <= idx + 4 && x.when && x.when(ctx));
          if (j > 0) { idx = j; shown = false; continue; }
          render(null);
          return;
        }
        shown = true;
        render(step, ctx);
        return;
      }
      if (!ok) { render(null); return; }
      render(step, ctx);
      return;
    }
  }

  return { update, reset: () => { idx = 0; shown = false; off = false; } };
})();
