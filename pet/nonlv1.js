// 非1級寵計算分頁（往上推／往回推）；需在 common.js 之後載入

buildInputRow('nl1-drop', 'nl1-drop', '掉檔<span class="row-hint">0~4</span>', [0,0,0,0,0]);
buildInputRow('nl1-now', 'nl1-now', '現在的BP<span class="row-hint">起始等級時的BP，含小數</span>', ['','','','',''], '0.01');
buildStrategyRow('nl1-strat', 'nl1');
buildInputRow('nl1-alloc', 'nl1-alloc', '配點<span class="row-hint" id="nl1-alloc-hint"></span>', [0,0,0,0,0]);
buildInputRow('ini-drop', 'ini-drop', '掉檔<span class="row-hint">0~4</span>', [0,0,0,0,0]);
buildInputRow('ini-now', 'ini-now', '現在的BP<span class="row-hint">現在等級時的BP，含小數</span>', ['','','','',''], '0.01');
buildStrategyRow('ini-strat', 'ini');
buildInputRow('ini-alloc', 'ini-alloc', '已配點<span class="row-hint" id="ini-alloc-hint"></span>', [0,0,0,0,0]);

// ---------- 非1級寵計算 ----------
function readNonlv1State() {
  const petName = document.getElementById('nl1-pet').value.trim();
  return {
    petName,
    tops: getTops('pet', petName, [0, 0, 0, 0, 0]),
    drops: readFive('nl1-drop', 0),
    now: readFive('nl1-now', NaN),
    alloc: readFive('nl1-alloc', 0),
    startLv: num(document.getElementById('nl1-start').value, 1),
    lv: num(document.getElementById('nl1-lv').value, 145)
  };
}

function refillAllocNl1() {
  const { lv, startLv } = readNonlv1State();
  refillAlloc('nl1', lv - startLv);
}

function renderNonlv1() {
  const st = readNonlv1State();
  const { petName, tops, lv, startLv } = st;
  document.getElementById('nl1-pet-warn').textContent =
    (petName && !PET_MAP.has(petName)) ? '查無此寵物' : '';

  const P = Math.max(0, lv - startLv);
  const hint = document.getElementById('nl1-alloc-hint');
  const banner = document.getElementById('nl1-banner');
  const msg = !PET_MAP.has(petName) ? '先選寵物（每級成長要看檔次）'
            : st.now.some(Number.isNaN) ? '填入五項現在的BP才會計算'
            : lv < startLv ? '目標等級不能低於起始等級' : '';
  banner.hidden = !msg;
  banner.textContent = msg;
  if (msg) {
    hint.textContent = `可配 ${P} 點`;
    hint.classList.remove('neg');
    ['nl1-result', 'nl1-detail', 'nl1-stats'].forEach(id => { document.getElementById(id).innerHTML = ''; });
    return;
  }

  let r = computeNonlv1(st);

  // 回滾邏輯跟正算一致：配不進去的點從輸入格退掉
  const rolled = r.eff.map(v => Math.max(0, v));
  if (rolled.some((v, i) => v !== st.alloc[i])) {
    rolled.forEach((v, i) => { document.getElementById(`nl1-alloc-${i}`).value = v; });
    st.alloc = rolled;
    r = computeNonlv1(st);
  }
  const alloc = st.alloc;

  const rest = P - alloc.reduce((a, b) => a + b, 0);
  const over = -rest;
  setAllocLock('nl1', autoAlloc.nl1 && rest === 0);

  hint.textContent = over > 0 ? `可配 ${P} 點・超出 ${over} 點`
                   : rest > 0 ? `可配 ${P} 點・剩餘 ${rest} 點`
                              : `可配 ${P} 點・已配完`;
  hint.classList.toggle('neg', over > 0 || rest > 0);

  const cells = vals => vals.map(v => `<td>${v}</td>`).join('');

  document.getElementById('nl1-result').innerHTML =
    `<tr class="emph"><td class="row-label">精確BP</td>${cells(r.finalBP.map(v => v.toFixed(2)))}</tr>`;

  const detailRows = [
    ['頂檔', tops],
    ['固定檔', r.fixed],
    ['成長', r.growth],
    ['現在的BP', st.now.map(v => v.toFixed(2))],
    ['自然BP', r.nat.map(v => v.toFixed(2))],
    ['可加上限', r.cap],
    ['有效配點', r.eff],
    ['可重配點', r.leftover.map((v, i) => `<span class="${v > 0 ? 'neg' : ''}">${v}</span>`)]
  ];
  document.getElementById('nl1-detail').innerHTML = detailRows.map(([name, vals]) =>
    `<tr><td class="row-label">${name}</td>${cells(vals)}</tr>`
  ).join('');

  const statsEl = document.getElementById('nl1-stats');
  statsEl.innerHTML = Object.entries(r.stats).map(([name, v]) =>
    `<div class="stat-box"><div class="label">${name}</div><div class="value">${v}</div></div>`
  ).join('');
}

// ---------- 非1級往回推 ----------
function readInitialState() {
  const petName = document.getElementById('ini-pet').value.trim();
  return {
    petName,
    tops: getTops('pet', petName, [0, 0, 0, 0, 0]),
    drops: readFive('ini-drop', 0),
    now: readFive('ini-now', NaN),
    alloc: readFive('ini-alloc', 0),
    startLv: num(document.getElementById('ini-start').value, 1),
    lv: num(document.getElementById('ini-lv').value, 145)
  };
}

function refillAllocIni() {
  const { lv, startLv } = readInitialState();
  refillAlloc('ini', lv - startLv);
}

function renderInitial() {
  const st = readInitialState();
  const { petName, tops, lv, startLv, alloc } = st;
  document.getElementById('ini-pet-warn').textContent =
    (petName && !PET_MAP.has(petName)) ? '查無此寵物' : '';

  const P = Math.max(0, lv - startLv);
  const rest = P - alloc.reduce((a, b) => a + b, 0);
  setAllocLock('ini', autoAlloc.ini && rest === 0);
  const hint = document.getElementById('ini-alloc-hint');
  hint.textContent = rest < 0 ? `共 ${P} 點・超出 ${-rest} 點`
                   : rest > 0 ? `共 ${P} 點・還有 ${rest} 點沒配`
                              : `共 ${P} 點・已配完`;
  hint.classList.toggle('neg', rest < 0);

  const banner = document.getElementById('ini-banner');
  const block = !PET_MAP.has(petName) ? '先選寵物（每級成長要看檔次）'
              : st.now.some(Number.isNaN) ? '填入五項現在的BP才會計算'
              : lv < startLv ? '現在等級不能低於起始等級'
              : rest < 0 ? `已配點合計超過 ${P} 點（現在−起始）`
              : '';
  if (block) {
    banner.hidden = false;
    banner.textContent = block;
    ['ini-result', 'ini-detail', 'ini-stats'].forEach(id => { document.getElementById(id).innerHTML = ''; });
    return;
  }

  const r = computeInitial(st);
  const hasNeg = r.initBP.some(v => v < 0);
  banner.hidden = !hasNeg;
  banner.textContent = hasNeg ? '有項目算出負值，掉檔或已配點可能填錯' : '';

  const cells = vals => vals.map(v => `<td>${v}</td>`).join('');
  const neg = v => `<span class="${v < 0 ? 'neg' : ''}">${v.toFixed(2)}</span>`;

  document.getElementById('ini-result').innerHTML =
    `<tr class="emph"><td class="row-label">起始BP</td>${cells(r.initBP.map(neg))}</tr>`;

  const detailRows = [
    ['頂檔', tops],
    ['固定檔', r.fixed],
    ['成長', r.growth],
    ['現在的BP', st.now.map(v => v.toFixed(2))],
    [`扣成長（×${lv - startLv}級）`, r.grown.map(v => v.toFixed(2))],
    ['扣已配點', alloc]
  ];
  document.getElementById('ini-detail').innerHTML = detailRows.map(([name, vals]) =>
    `<tr><td class="row-label">${name}</td>${cells(vals)}</tr>`
  ).join('');

  document.getElementById('ini-stats').innerHTML = Object.entries(r.stats).map(([name, v]) =>
    `<div class="stat-box"><div class="label">${name}</div><div class="value">${v}</div></div>`
  ).join('');
}

LABELS.forEach((_, i) => document.getElementById(`nl1-alloc-${i}`).addEventListener('input', () => { autoAlloc.nl1 = false; }));
document.querySelectorAll('#nl1-view-up input').forEach(el => el.addEventListener('input', renderNonlv1));
document.querySelectorAll('input[name="nl1-strat"]').forEach(el => el.addEventListener('click', () => { refillAllocNl1(); renderNonlv1(); }));
['nl1-lv', 'nl1-start'].forEach(id => document.getElementById(id).addEventListener('input', () => { if (getStrategy('nl1') !== 'mix') { refillAllocNl1(); renderNonlv1(); } }));

LABELS.forEach((_, i) => document.getElementById(`ini-alloc-${i}`).addEventListener('input', () => { autoAlloc.ini = false; }));
document.querySelectorAll('#nl1-view-down input').forEach(el => el.addEventListener('input', renderInitial));
document.querySelectorAll('input[name="ini-strat"]').forEach(el => el.addEventListener('click', () => { refillAllocIni(); renderInitial(); }));
['ini-lv', 'ini-start'].forEach(id => document.getElementById(id).addEventListener('input', () => { if (getStrategy('ini') !== 'mix') { refillAllocIni(); renderInitial(); } }));
document.querySelectorAll('input[name="nl1-dir"]').forEach(el => el.addEventListener('change', () => {
  const down = el.value === 'down';
  document.getElementById('nl1-view-up').hidden = down;
  document.getElementById('nl1-view-down').hidden = !down;
}));

renderNonlv1();
renderInitial();
