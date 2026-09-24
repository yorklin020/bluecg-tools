// 推算（算隨機檔）分頁；需在 common.js 之後載入

buildInputRow('rev-top', 'rev-top', '手動輸入檔次<span class="row-hint">直接填五圍檔位</span>', [0,0,0,0,0]);
buildInputRow('rev-drop', 'rev-drop', '掉檔<span class="row-hint">0~4</span>', [0,0,0,0,0]);
buildInputRow('rev-alloc', 'rev-alloc', '配點', [0,0,0,0,0]);
buildInputRow('rev-measured', 'rev-measured', '論壇寵物實際BP<span class="row-hint">含小數</span>', ['','','','','' ], '0.01');

function readReverseState() {
  const mode = getMode('rev');
  const petName = document.getElementById('rev-pet').value.trim();
  return {
    mode, petName,
    tops: getTops(mode, petName, readFive('rev-top', 0)),
    drops: readFive('rev-drop', 0),
    alloc: readFive('rev-alloc', 0),
    mult: num(document.getElementById('rev-mult').value, 0.2),
    lv: num(document.getElementById('rev-lv').value, 145),
    measured: readFive('rev-measured', 0)
  };
}

function renderReverse() {
  const st = readReverseState();
  const { mode, petName, tops } = st;
  showPetWarn('rev', mode, petName);

  const r = computeReverse(st);

  const banner = document.getElementById('rev-banner');
  const sumTxt = `五項反推隨機檔合計：${r.sum.toFixed(2)}（應接近 10）`;
  if (r.hasNegative) {
    banner.className = 'banner warn';
    banner.textContent = sumTxt + '・出現負值，掉檔或配點可能有誤，請換一組重試';
  } else if (Math.abs(r.sum - 10) > 1) {
    banner.className = 'banner warn';
    banner.textContent = sumTxt + '・偏離 10 較多，建議重新檢查輸入';
  } else {
    banner.className = 'banner ok';
    banner.textContent = sumTxt;
  }

  const cells = vals => vals.map(v => `<td>${v}</td>`).join('');

  document.getElementById('rev-result').innerHTML =
    `<tr class="emph"><td class="row-label">反推隨機檔</td>${
      cells(r.inferred.map((v, i) => `<span class="${v < -0.001 ? 'neg' : ''}">${v.toFixed(2)}</span>`))
    }</tr>`;

  const detailRows = [
    ['頂檔', tops],
    ['固定檔', r.fixed],
    ['成長', r.growth],
    ['預測BP（不含隨機）', r.predicted.map(v => v.toFixed(2))],
    ['殘差', r.residual.map((v, i) => `<span class="${v < 0 ? 'neg' : ''}">${v.toFixed(2)}</span>`)]
  ];
  document.getElementById('rev-detail').innerHTML = detailRows.map(([name, vals]) =>
    `<tr><td class="row-label">${name}</td>${cells(vals)}</tr>`
  ).join('');
}

// 反推出的隨機檔填進正算的「已知隨機檔」，正算就會算回實測BP
function carryReverseToForward() {
  const st = readReverseState();
  const r = computeReverse(st);
  document.querySelector(`input[name="fwd-mode"][value="${st.mode}"]`).checked = true;
  document.getElementById('fwd-pet').value = document.getElementById('rev-pet').value;
  document.getElementById('fwd-mult').value = document.getElementById('rev-mult').value;
  document.getElementById('fwd-lv').value = document.getElementById('rev-lv').value;
  LABELS.forEach((_, i) => {
    document.getElementById(`fwd-top-${i}`).value = document.getElementById(`rev-top-${i}`).value;
    document.getElementById(`fwd-drop-${i}`).value = st.drops[i];
    document.getElementById(`fwd-alloc-${i}`).value = st.alloc[i];
    document.getElementById(`fwd-rand-${i}`).value = +r.inferred[i].toFixed(4);
  });
  document.querySelector('input[name="fwd-strat"][value="mix"]').checked = true;
  autoAlloc.fwd = false;
  applyMode('fwd');
  document.querySelector('[data-tab=forward]').click();
  renderForward();
}

document.getElementById('rev-to-fwd').addEventListener('click', carryReverseToForward);
document.querySelectorAll('input[name="rev-mode"]').forEach(el => el.addEventListener('change', () => { applyMode('rev'); renderReverse(); }));
document.querySelectorAll('#panel-reverse input').forEach(el => el.addEventListener('input', renderReverse));
document.querySelectorAll('#panel-reverse select').forEach(el => el.addEventListener('change', renderReverse));

applyMode('rev');
renderReverse();
