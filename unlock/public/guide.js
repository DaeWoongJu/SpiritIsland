'use strict';
/* 언락! — 게임 방법 */

const Guide = (() => {
  const mini = (type, num, title, art) => `<div class="ucard t-${type}"><div class="c-head"><span class="c-num">${num}</span><span class="c-title">${title}</span></div><div class="c-art">${art}</div></div>`;
  const SLIDES = [
    { title: '🔓 언락! 방탈출', body: () => `
      <p>카드로 즐기는 <b>방탈출 게임</b>이에요. 모두 함께(1~6인) 같은 카드를 보며 <b>60분 안에</b> 수수께끼를 풀고 탈출하세요!</p>
      <p>카드에는 <b>번호</b>(장소는 알파벳)가 있어요. 카드에 보이는 번호의 카드는 자동으로 나오고, 숨은 번호는 직접 찾아야 해요.</p>
      <div class="g-cards">${mini('place', 'A', '장소', '🏚️')}${mini('red', 12, '빨강 물건', '🧰')}${mini('blue', 25, '파랑 물건', '🗝️')}${mini('code', 41, '노랑 코드', '🔐')}${mini('machine', 8, '초록 장치', '⚙️')}</div>
      <p class="g-tip">💡 처음이라면 대기실의 <b>「입문 — 첫 번째 방」</b>부터 해 보세요!</p>` },
    { title: '🔍 장소 살펴보기', body: () => `
      <p><b>회색 장소 카드</b>의 그림에는 <b>점선 동그라미</b>가 있어요. 눌러서 살펴보면 숨은 번호를 찾거나 단서를 얻어요.</p>
      <p>찾은 내용은 오른쪽 <b>기록</b>에 남으니, 지나간 단서도 다시 볼 수 있어요.</p>` },
    { title: '🧩 빨강 + 파랑 = 합치기', body: () => `
      <div class="g-cards">${mini('red', 12, '잠긴 상자', '🧰')}<span style="font-size:2em;align-self:center">+</span>${mini('blue', 25, '작은 열쇠', '🗝️')}<span style="font-size:2em;align-self:center">=</span>${mini('item', 37, '열린 상자', '📜')}</div>
      <p><b class="red">빨간</b> 카드와 <b class="blue">파란</b> 카드를 하나씩 골라 <b>합치기</b>를 누르면, 두 번호를 더한 카드가 나와요.</p>
      <p>말이 안 되는 조합이면 <b>벌점</b> — 시간이 <b>3분</b> 줄어요! 신중하게.</p>` },
    { title: '🔢 코드와 ⚙ 장치', body: () => `
      <p><b class="yellow">노란 카드</b>는 자물쇠예요. 카드를 고르고 숫자 코드를 입력하세요. (키보드 숫자도 돼요)</p>
      <p><b class="green">초록 카드</b>는 장치예요. 버튼을 올바른 순서로 누른 뒤 <b>작동!</b></p>
      <p>정답의 단서는 다른 카드의 글·그림 속에 있어요. 틀리면 벌점 3분.</p>` },
    { title: '💡 힌트와 별점', body: () => `
      <p>막히면 카드를 고르고 <b>💡 힌트</b>를 누르세요. 첫 힌트는 살짝, 두 번째는 거의 정답이에요.</p>
      <p>탈출하면 걸린 시간과 힌트 수로 <b>별점(⭐ 1~5)</b>을 받아요. 60분이 지나도 계속 풀 수 있어요.</p>
      <p>다 쓴 카드는 <b>🗑 버리기</b>로 치울 수 있고, 저장하고 그만둔 뒤 나중에 이어서 할 수 있어요.</p>
      <p class="g-tip">💡 모든 언락! 박스의 시나리오 제목과 분위기를 따온 <b>오리지널 수수께끼</b>예요. 원작의 정답과는 달라요.</p>` },
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
  function open(i = 0) { idx = i; render(); document.getElementById('guide').classList.remove('hidden'); try { localStorage.setItem('unlock-guided', '1'); } catch { /* 무시 */ } }
  function close() { document.getElementById('guide').classList.add('hidden'); }
  function isOpen() { return !document.getElementById('guide').classList.contains('hidden'); }
  return { open, close, isOpen };
})();
window.Guide = Guide;
