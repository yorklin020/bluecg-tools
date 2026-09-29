// 七圍反推掉檔分頁；需在 common.js 之後載入

const STAT_NAMES = Object.keys(COEFF);

buildInputRow('sta-top', 'sta-top', '手動輸入檔次<span class="row-hint">直接填五圍檔位</span>', [0,0,0,0,0]);
buildInputRow('sta-alloc', 'sta-alloc', '配點<span class="row-hint" id="sta-alloc-hint"></span>', [0,0,0,0,0]);
document.getElementById('sta-stats').innerHTML = STAT_NAMES.map((n, s) =>
  `<div class="field"><label for="sta-stat-${s}">${n}</label><input type="number" id="sta-stat-${s}"></div>`
).join('');

function readStatsState() {
  const mode = getMode('sta');
  const petName = document.getElementById('sta-pet').value.trim();
  return {
    mode, petName,
    tops: getTops(mode, petName, readFive('sta-top', 0)),
    alloc: readFive('sta-alloc', 0),
    mult: num(document.getElementById('sta-mult').value, 0.2),
    lv: num(document.getElementById('sta-lv').value, 1),
    stats: STAT_NAMES.map((_, s) => num(document.getElementById(`sta-stat-${s}`).value, NaN))
  };
}

// 輸入一變動就清掉舊結果，並更新配點提示
function resetStats() {
  const st = readStatsState();
  showPetWarn('sta', st.mode, st.petName);
  const P = Math.max(0, st.lv - 1);
  const rest = P - st.alloc.reduce((a, b) => a + b, 0);
  const hint = document.getElementById('sta-alloc-hint');
  hint.textContent = rest < 0 ? `共 ${P} 點・超出 ${-rest} 點`
                   : rest > 0 ? `共 ${P} 點・還有 ${rest} 點沒配`
                              : `共 ${P} 點・已配完`;
  hint.classList.toggle('neg', rest < 0);

  const banner = document.getElementById('sta-banner');
  banner.className = 'banner';
  banner.textContent = '填好後按「開始反推」';
  ['sta-dist', 'sta-list'].forEach(id => { document.getElementById(id).innerHTML = ''; });
  document.getElementById('sta-total').textContent = '';
}

function runStats() {
  const st = readStatsState();
  const banner = document.getElementById('sta-banner');
  const block = (st.mode === 'pet' && !PET_MAP.has(st.petName)) ? '先選寵物（要用頂檔算）'
              : st.stats.some(Number.isNaN) ? '七項素質都要填'
              : st.lv < 1 ? '等級至少 1' : '';
  if (block) {
    banner.className = 'banner warn';
    banner.textContent = block;
    return;
  }
  banner.className = 'banner';
  banner.textContent = '計算中…';
  setTimeout(() => renderStats(st, computeDropSearch(st)), 20);
}

function renderStats(st, r) {
  const banner = document.getElementById('sta-banner');
  const best = r.results.filter(x => x.err === r.minErr);
  if (!best.length) {
    banner.className = 'banner warn';
    banner.textContent = '沒有可用的掉檔組合，檢查頂檔';
    return;
  }
  banner.className = r.minErr === 0 ? 'banner ok' : 'banner warn';
  banner.textContent = r.minErr === 0
    ? `七圍完全吻合的掉檔組合共 ${best.length} 種`
    : `沒有完全吻合的組合，最接近的差 ${r.minErr} 點（${best.length} 種）・檢查寵物、倍率、等級、配點`;

  const cells = vals => vals.map(v => `<td>${v}</td>`).join('');
  const pct = n => n ? `${Math.round(n / best.length * 100)}%` : '–';
  document.getElementById('sta-dist').innerHTML = [0, 1, 2, 3, 4].map(d =>
    `<tr><td class="row-label">掉 ${d} 檔</td>${cells(LABELS.map((_, i) => pct(best.filter(x => x.drops[i] === d).length)))}</tr>`
  ).join('');

  const totals = new Map();
  best.forEach(x => totals.set(x.total, (totals.get(x.total) || 0) + 1));
  document.getElementById('sta-total').textContent = '總掉檔：' +
    [...totals.entries()].sort((a, b) => a[0] - b[0]).map(([t, n]) => `${t} 檔 ${pct(n)}`).join('、');

  document.getElementById('sta-list').innerHTML = r.results.slice(0, 30).map(x =>
    `<tr><td>${x.err}</td>${cells(x.drops)}<td>${x.total}</td><td>${x.rand.join('/')}</td></tr>`
  ).join('');
}

document.querySelectorAll('input[name="sta-mode"]').forEach(el => el.addEventListener('change', () => applyMode('sta')));
document.querySelectorAll('#panel-stats input, #panel-stats select').forEach(el => el.addEventListener('input', resetStats));
document.getElementById('sta-run').addEventListener('click', runStats);

applyMode('sta');
resetStats();
