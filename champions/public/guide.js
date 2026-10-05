'use strict';
/* 히어로 챔피언스 — 게임 방법 안내 + 지금 할 일 도움말 */

const Guide = (() => {
  const SLIDES = [
    { title: '🦸 히어로 챔피언스에 오신 걸 환영해요', body: () => `
      <p>여러분은 도시를 지키는 <b>영웅</b>이에요. 친구들과 <b>힘을 합쳐</b>(협력) 악당 한 명을 상대합니다. 모두 함께 이기고 함께 져요.</p>
      <div class="g-box"><b>🎉 승리</b>: 악당의 체력을 0으로 만들어 마지막 단계까지 쓰러뜨리기<br><b>💀 패배</b>: 악당의 <b>주 계략</b> 위협이 한계에 닿거나, 모든 영웅이 쓰러지면</div>
      <p>그래서 두 가지를 동시에 해야 해요: 악당을 <b>공격</b>하면서, 악당의 계략(위협)을 <b>저지</b>하기!</p>
      <p class="g-tip">💡 처음이라면 대기실에서 악당 <b>클로우</b> + 난이도 <b>연습</b>으로 한 판 해 보세요.</p>` },
    { title: '🔄 영웅 모습과 일상 모습', body: () => `
      <p>영웅 카드는 앞뒤가 있어요. 내 차례에 <b>라운드마다 1번</b> 모습을 바꿀 수 있어요.</p>
      <div class="g-grid">
        <div><b>🦸 영웅 모습</b><br>👊 <b>공격</b>(악당·미니언에게 피해), 🛑 <b>저지</b>(위협 제거), 🛡 <b>방어</b>(공격받을 때)<br>⚠ 악당 단계에 악당이 나를 <b>공격</b>해요.</div>
        <div><b>🏠 일상 모습</b><br>❤ <b>회복</b>(체력 되찾기), 손패를 더 많이 채워요.<br>⚠ 악당 단계에 악당이 내 대신 <b>계략</b>을 꾸며 위협이 쌓여요.</div>
      </div>
      <p>체력이 낮으면 일상 모습으로 쉬고, 다시 변신해서 싸우는 흐름이 핵심이에요. 모든 영웅은 <b>일상 모습으로 시작</b>해요.</p>
      <p>영웅·일상 모습마다 <b>✨ 능력</b>이 하나씩 있어요 (라운드마다 1번).</p>` },
    { title: '🎯 내 차례에 할 수 있는 것 (원하는 만큼, 순서 자유)', body: () => `
      <ul>
        <li>🃏 <b>카드 쓰기</b>: 손패의 카드를 비용을 내고 써요.</li>
        <li>👊 <b>공격</b> / 🛑 <b>저지</b> (영웅 모습) 또는 ❤ <b>회복</b> (일상 모습): 쓰면 영웅이 <b>소진</b>돼요 (라운드에 1번).</li>
        <li>✨ <b>능력</b>: 지금 모습의 능력 (라운드마다 1번)</li>
        <li>🔄 <b>모습 바꾸기</b> (라운드마다 1번)</li>
        <li>🧍 <b>아군</b>으로 공격·저지: 아군이 소진되고 <b>결과 피해 1</b>을 받아요.</li>
        <li>⚙ <b>강화·지원 카드의 능력</b></li>
      </ul>
      <p>다 했으면 <b>차례 끝내기</b>. 모든 영웅의 차례가 끝나면 <b>악당 단계</b>가 와요.</p>
      <p class="g-tip">💡 소진: 이미 행동했다는 뜻이에요. 라운드가 끝나면 모두 다시 준비돼요. 악당이 공격할 때 소진되지 않은 영웅만 <b>방어</b>할 수 있어요!</p>` },
    { title: '💳 카드와 비용 내기', body: () => `
      <p>카드 왼쪽 위 숫자가 <b>비용</b>이에요. 비용은 <b>손패의 다른 카드를 버려서</b> 내요. 카드 아래쪽 아이콘 개수만큼 자원이 돼요.</p>
      <div class="g-res"><span>⚡ 에너지</span><span>🧠 정신</span><span>💪 물리</span><span>★ 만능</span></div>
      <ul>
        <li><b>자원 카드</b>(에너지 셀·천재의 영감·초인적 근력)는 쓸 수 없지만, 버리면 자원 <b>2개</b>!</li>
        <li>어떤 카드는 특정 자원으로 내면 더 강해져요 (예: 광자 빔은 ⚡로 내면 피해 +2).</li>
      </ul>
      <div class="g-grid">
        <div><b>🧍 아군</b>: 앞에 놓여 공격·저지, 공격을 대신 막기 (최대 3명)</div>
        <div><b>⚡ 이벤트</b>: 한 번 쓰고 버려요. <b>방어 이벤트</b>는 공격받을 때만!</div>
        <div><b>🔧 강화</b>: 영웅에게 붙어 계속 효과 (공격력 +1 등)</div>
        <div><b>🏢 지원</b>: 앞에 놓고 능력을 써요 (보통 소진)</div>
      </div>
      <p class="g-tip">💡 어떤 카드를 버리고 어떤 카드를 쓸지 고르는 게 이 게임의 가장 재미있는 고민이에요!</p>` },
    { title: '😈 악당 단계 — 이렇게 진행돼요', body: () => `
      <ol>
        <li><b>위협 쌓기</b>: 주 계략에 위협이 쌓여요 (플레이어 수 × 가속 + 부가 계략 가속).</li>
        <li><b>악당 활성화</b> (영웅마다 차례로):
          <ul><li>영웅 모습이면 → 악당이 <b>공격</b> (공격력 + 부스트)</li>
          <li>일상 모습이면 → 악당이 <b>계략</b> (계략력 + 부스트만큼 위협 추가)</li></ul></li>
        <li><b>미니언 활성화</b>: 나와 교전 중인 미니언도 똑같이 공격하거나 계략을 꾸며요.</li>
        <li><b>조우 카드</b>: 영웅마다 1장씩 공개 (미니언·배신·부가 계략·부착).</li>
      </ol>
      <p><b>🎴 부스트</b>: 악당이 공격·계략할 때 조우 덱 맨 위 카드를 뒤집어 그 카드의 부스트 숫자만큼 더해요. 그래서 공격력이 매번 조금씩 달라요.</p>
      <p><b>🛡 공격을 받을 때</b>: 영웅이 방어(방어력만큼 덜 받음, 영웅 소진) / 아군이 대신 맞기 / 방어 이벤트 쓰기 / 그냥 맞기 중에서 골라요.</p>` },
    { title: '🎴 조우 카드와 키워드', body: () => `
      <div class="g-grid">
        <div><b>👾 미니언</b>: 악당의 부하. 나와 교전하며 매 악당 단계마다 공격/계략. 쓰러뜨리면 사라져요.</div>
        <div><b>⚠ 배신</b>: 공개되자마자 효과가 일어나고 버려져요.</div>
        <div><b>📌 부가 계략</b>: 위협을 제거해서 막아야 해요. 위협이 0이 되면 사라져요.</div>
        <div><b>🔩 부착</b>: 악당에게 붙어 악당을 강하게 해요.</div>
      </div>
      <table class="g-table">
        <tr><td>💂 경비</td><td>이 미니언과 교전 중이면 악당을 <b>공격</b>할 수 없어요 (먼저 처치!)</td></tr>
        <tr><td>↪ 반격 X</td><td>이 적을 공격하면 공격한 쪽이 피해 X</td></tr>
        <tr><td>⛔ 위기</td><td>이 부가 계략이 있는 동안 주 계략에서 위협을 제거할 수 없어요</td></tr>
        <tr><td>⏩ 가속</td><td>악당 단계마다 주 계략 위협 +1</td></tr>
        <tr><td>☢ 위험</td><td>악당 단계마다 조우 카드 +1장</td></tr>
        <tr><td>🌊 쇄도</td><td>공개되면 조우 카드를 1장 더 공개</td></tr>
      </table>` },
    { title: '💫 상태 이상', body: () => `
      <table class="g-table">
        <tr><td><span class="st st-stun">기절</span></td><td>다음 <b>공격</b>이 무효가 돼요 (그리고 기절이 풀려요). 악당·미니언을 기절시키면 다음 공격을 한 번 막는 셈!</td></tr>
        <tr><td><span class="st st-conf">혼란</span></td><td>다음 <b>계략</b>(영웅이면 기본 저지)이 무효가 돼요.</td></tr>
        <tr><td><span class="st st-tough">강인함</span></td><td>다음 <b>피해</b> 1번을 통째로 막아요.</td></tr>
      </table>
      <p>악당이 단계를 넘어가면 악당의 상태 이상은 사라져요.</p>
      <p><b>덱이 떨어지면</b>: 버린 카드를 섞어 새 덱을 만들지만, 벌칙으로 다음 악당 단계에 조우 카드를 1장 더 받아요.</p>` },
    { title: '🎴 영웅 · 측면 · 악당 고르기', body: () => `
      <p>덱은 <b>영웅 전용 카드(9종) + 측면 카드(20종) + 기본 카드</b> 40장으로 원작처럼 자동으로 만들어져요. 악당 덱에는 대기실에서 고른 <b>모듈 조우 세트</b>가 하나 더 섞여요.</p>
      <div class="g-grid">${Object.values((app.catalog || {}).aspects || {}).map((a) => `<div><b style="color:${a.color}">${a.name}</b> (${a.en})<br><span class="hint">${a.desc}</span></div>`).join('')}</div>
      <p>영웅: ${((app.catalog || {}).heroes || []).map((h) => `${h.icon} ${h.name}`).join(' · ')}</p>
      <p>악당: ${((app.catalog || {}).villains || []).map((v) => `${v.icon} ${v.name} (${v.level})`).join(' · ')}</p>
      <p class="g-tip">💡 처음이라면 <b>쉬-헐커 + 수호</b>(튼튼함)나 <b>블랙 위도 + 정의</b>(저지 잘함)를 추천해요.</p>` },
    { title: '💡 이기는 팁', body: () => `
      <ul>
        <li><b>위협 관리가 먼저!</b> 주 계략 위협이 반을 넘으면 저지에 집중하세요. 패배는 대부분 계략 때문이에요.</li>
        <li><b>체력이 낮으면 일상 모습</b>으로 회복. 일상 모습이면 악당이 공격하지 않아요 (대신 계략을 꾸며요).</li>
        <li><b>경비 미니언</b>은 바로 처치하세요. 안 그러면 악당을 공격할 수 없어요.</li>
        <li>아군은 <b>공격을 대신 막는 방패</b>로도 좋아요.</li>
        <li>악당 단계 전에 <b>영웅을 소진하지 않고 남겨 두면</b> 방어할 수 있어요.</li>
        <li><b>부가 계략</b> 중 위기(⛔)는 우선 처리! 주 계략을 저지할 수 없게 만들어요.</li>
        <li>여럿이 할 때는 한 명은 공격, 한 명은 저지처럼 역할을 나누면 좋아요.</li>
      </ul>
      <p class="g-tip">⚠ 이 게임은 「마블 챔피언스 카드게임」의 규칙 구조를 따라 만든 팬 제작 버전이에요. 영웅·악당·카드의 이름과 효과, 그림은 이 프로젝트에서 새로 만든 것입니다.</p>` },
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
  function close() { $('#guide').classList.add('hidden'); try { localStorage.setItem('champ-guided', '1'); } catch { /* 무시 */ } }
  function reference() {
    $('#guide .modal-inner').innerHTML = `<div class="g-head"><h2>📋 빠른 참고표</h2><button class="small" data-g="close">닫기 ✕</button></div>
      <div class="ref-grid">
        <div class="ref-box"><h3>🔁 한 라운드</h3><ol><li><b>영웅 단계</b>: 선 플레이어부터 한 명씩 차례</li><li><b>악당 단계</b>: 위협 쌓기 → 악당·미니언 활성화 → 조우 카드</li><li><b>라운드 끝</b>: 손패 채우기, 모두 준비, 선 플레이어 교대</li></ol></div>
        <div class="ref-box"><h3>🎯 내 차례 (원하는 만큼)</h3><p>카드 쓰기 · 공격/저지(영웅) · 회복(일상) · 능력(라운드 1번) · 모습 바꾸기(라운드 1번) · 아군 행동 · 강화·지원 능력</p></div>
        <div class="ref-box"><h3>😈 악당 활성화</h3><p>영웅 모습 → <b>공격</b> (공격력 + 부스트)<br>일상 모습 → <b>계략</b> (계략력 + 부스트 = 위협)<br>공격받으면: 방어 / 아군 막기 / 방어 이벤트 / 맞기</p></div>
        <div class="ref-box"><h3>💳 비용</h3><p>다른 카드를 버려서 냄 · 아이콘 1개 = 자원 1<br>자원 카드 = 자원 2<br>⚡ 에너지 · 🧠 정신 · 💪 물리 · ★ 만능</p></div>
        <div class="ref-box"><h3>💫 상태</h3><p><span class="st st-stun">기절</span> 다음 공격 무효<br><span class="st st-conf">혼란</span> 다음 계략 무효<br><span class="st st-tough">강인함</span> 다음 피해 무효</p></div>
        <div class="ref-box"><h3>🏷 키워드</h3><p>경비: 먼저 처치해야 악당 공격 가능 · 반격 X · 위기: 주 계략 저지 불가 · 가속: 위협 +1 · 위험: 조우 카드 +1 · 쇄도: 1장 더</p></div>
        <div class="ref-box"><h3>🏁 승패</h3><p>🎉 악당 마지막 단계 체력 0<br>💀 주 계략 위협 = 한계, 또는 모든 영웅 쓰러짐</p></div>
      </div>`;
    $('#guide').classList.remove('hidden');
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#guide')) return;
    if (e.target.id === 'guide') { close(); return; }
    const gi = e.target.closest('[data-gi]');
    if (gi) { idx = Number(gi.dataset.gi); render(); return; }
    const g = e.target.closest('[data-g]');
    if (!g) return;
    if (g.dataset.g === 'close') close();
    else if (g.dataset.g === 'prev') { idx = Math.max(0, idx - 1); render(); } else if (g.dataset.g === 'next') { if (idx === SLIDES.length - 1) close(); else { idx++; render(); } }
  });
  return { open, close, reference, isOpen: () => !$('#guide').classList.contains('hidden') };
})();

/** 지금 해야 할 일 */
function promptHint(p, st) {
  const meP = st.ps[app.you];
  if (!p) {
    if (st.result) return '게임이 끝났어요!';
    if (st.phase === 'villain') return '악당 단계예요. 악당과 미니언이 움직이고 조우 카드가 공개돼요. 공격받으면 어떻게 막을지 물어볼게요.';
    const cur = st.players.find((x) => x.id === st.current);
    return cur ? `<b>${esc(cur.name)}</b>의 차례예요. 기다리는 동안 악당과 계략 상황을 살펴보세요.` : '잠시 기다려 주세요…';
  }
  const ratio = st.scheme.threat / st.scheme.threshold;
  if (p.kind === 'turn') {
    const tips = [];
    if (meP.form === 'alter') tips.push(meP.flipped ? '이번 라운드는 일상 모습이에요. <b>회복</b>하고 카드를 쓰세요.' : `지금은 <b>일상 모습</b>이에요. ${meP.hp <= meP.maxHp / 2 ? '체력이 낮으니 <b>회복</b>한 뒤' : ''} <b>🦸 변신</b>하면 공격·저지를 할 수 있어요.`);
    else tips.push(meP.exhausted ? '영웅이 소진됐어요. 카드·아군·능력을 쓰고 차례를 끝내세요.' : '<b>👊 공격</b>이나 <b>🛑 저지</b>를 할 수 있어요. 악당 단계에 방어하려면 영웅을 소진하지 않고 남겨 둘 수도 있어요.');
    if (ratio >= 0.6) tips.push(`⚠ 주 계략 위협이 <b>${st.scheme.threat}/${st.scheme.threshold}</b>! 저지가 급해요.`);
    if (st.sides.some((s) => s.crisis)) tips.push('⛔ 위기 계략이 있어 주 계략을 저지할 수 없어요. 부가 계략부터!');
    if (meP.engaged.some((m) => m.guard)) tips.push('💂 경비 미니언이 있어 악당을 공격할 수 없어요.');
    if (meP.form === 'hero' && meP.hp <= 4) tips.push('❤ 체력이 낮아요. 일상 모습으로 돌아가 회복하는 것도 방법이에요.');
    return tips.join(' ');
  }
  if (p.kind === 'defend') return `공격받고 있어요! <b>영웅이 방어</b>하면 방어력만큼 덜 받고, <b>아군</b>은 대신 맞아 줘요. 손패에 <b>방어 이벤트</b>가 있으면 먼저 쓸 수 있어요.`;
  if (p.kind === 'target') return '피해를 줄 적을 고르세요. 판에서 <b>빛나는</b> 악당이나 미니언을 클릭해도 돼요.';
  if (p.kind === 'scheme') return '위협을 제거할 계략을 고르세요. 위험한 계략(위기·가속·위험)을 먼저 막는 게 좋아요.';
  if (p.kind === 'hero') return '영웅을 고르세요. 영웅 카드를 클릭해도 돼요.';
  if (p.kind === 'pay') return '비용을 낼 카드를 고르세요.';
  return '위 상자에서 하나를 고르세요.';
}

/** 버튼 설명 */
function optionDesc(o, p, st) {
  const meP = st.ps[app.you];
  const v = String(o.value);
  const h = meP && app.catalog.heroes.find((x) => x.id === meP.heroId);
  const D = {
    attack: '<b>👊 기본 공격</b><br>악당이나 미니언 하나에게 내 공격력만큼 피해를 줘요. 영웅이 <b>소진</b>돼요 (악당 단계에 방어할 수 없게 돼요).',
    thwart: '<b>🛑 기본 저지</b><br>계략 하나에서 내 저지력만큼 위협을 제거해요. 영웅이 <b>소진</b>돼요.',
    recover: '<b>❤ 회복</b><br>내 회복력만큼 체력을 되찾아요. 소진돼요.',
    flip: meP && meP.form === 'hero' ? '<b>🔄 일상 모습으로</b><br>회복할 수 있고 손패를 더 많이 채워요. 대신 악당 단계에 악당이 <b>계략</b>을 꾸며요 (공격은 안 받아요).' : '<b>🦸 변신</b><br>영웅 모습이 되어 공격·저지·방어를 할 수 있어요. 대신 악당 단계에 악당에게 <b>공격</b>받아요.',
    ability: h ? (meP.form === 'hero' ? `<b>✨ ${esc(h.hero.ability.name)}</b> (라운드마다 1번)<br>${esc(h.hero.ability.text)}` : `<b>✨ ${esc(h.alter.ability.name)}</b> (라운드마다 1번)<br>${esc(h.alter.ability.text)}`) : '',
    end: '<b>차례 끝내기</b><br>다음 영웅에게 차례를 넘겨요. 모두 끝나면 악당 단계!',
    hero: '<b>🛡 영웅이 방어</b><br>내 방어력만큼 피해를 줄여요. 영웅이 소진돼요.',
    none: '<b>그냥 맞기</b><br>피해를 모두 받아요. 영웅을 소진하지 않아요.',
  };
  if (D[v] !== undefined) return D[v];
  if (v.startsWith('allyatk:') || v.startsWith('allythw:')) return `<b>🧍 아군 ${v.startsWith('allyatk') ? '공격' : '저지'}</b><br>아군이 소진되고, 결과 피해 1을 받아요 (체력이 다 떨어지면 버려져요).`;
  if (v.startsWith('ally:')) return '<b>🧍 아군이 대신 막기</b><br>아군이 공격의 피해를 대신 받아요 (영웅은 피해 없음). 아군이 소진돼요.';
  if ((v.startsWith('play:') || v.startsWith('event:') || v.startsWith('use:')) && o.card) {
    const all = [...(meP.hand || []), ...meP.play];
    const cd = all.find((x) => x.uid === o.card);
    const c = cd && app.catalog.cards[cd.id];
    if (!c) return '';
    if (v.startsWith('use:')) return `<b>⚙ ${esc(c.name)}</b><br>${esc(c.text)}`;
    return `<b>🃏 ${esc(c.name)}</b> (비용 ${c.cost}, 다른 카드를 버려서 냄)<br>${esc(c.text)}`;
  }
  return '';
}
