// 正算分頁與紀錄；需在 common.js 之後載入

let lastForward = null;

buildInputRow('fwd-top', 'fwd-top', '手動輸入檔次<span class="row-hint">直接填五圍檔位</span>', [0,0,0,0,0]);
buildInputRow('fwd-drop', 'fwd-drop', '掉檔<span class="row-hint">0~4</span>', [0,0,0,0,0]);
buildStrategyRow('fwd-strat', 'fwd');
buildInputRow('fwd-alloc', 'fwd-alloc', '升級配點分配<span class="row-hint" id="fwd-alloc-hint"></span>', [0,0,0,0,0]);
buildInputRow('fwd-rand', 'fwd-rand', '已知隨機檔<span class="row-hint">留空＝平均值 2×倍率</span>', ['','','','','']);

function readForwardState() {
  const mode = getMode('fwd');
  const petName = document.getElementById('fwd-pet').value.trim();
  return {
    mode, petName,
    tops: getTops(mode, petName, readFive('fwd-top', 0)),
    drops: readFive('fwd-drop', 0),
    alloc: readFive('fwd-alloc', 0),
    mult: num(document.getElementById('fwd-mult').value, 0.2),
    lv: num(document.getElementById('fwd-lv').value, 145),
    rand: readFiveRaw('fwd-rand').map(v => v === '' ? null : parseFloat(v))
  };
}

function renderForward() {
  const st = readForwardState();
  const { mode, petName, tops, drops, lv } = st;
  showPetWarn('fwd', mode, petName);

  let r = computeForward(st);

  // 回滾：所有判定跑完之後，把配不進去的點從輸入格退掉，後面畫面一律用退過的值
  const rolled = r.eff.map(v => Math.max(0, v));
  if (rolled.some((v, i) => v !== st.alloc[i])) {
    rolled.forEach((v, i) => { document.getElementById(`fwd-alloc-${i}`).value = v; });
    st.alloc = rolled;
    r = computeForward(st);
  }
  const alloc = st.alloc;

  // 回滾之後填的值就是吃得進去的值，剩餘為正＝還沒配完（含被退回來的），為負＝五項合計超過總點數
  const P = Math.max(0, lv - 1);
  const rest = P - alloc.reduce((a, b) => a + b, 0);
  const over = -rest;
  setAllocLock('fwd', autoAlloc.fwd && rest === 0);

  const hint = document.getElementById('fwd-alloc-hint');
  hint.textContent = over > 0 ? `可配 ${P} 點・超出 ${over} 點`
                   : rest > 0 ? `可配 ${P} 點・剩餘 ${rest} 點`
                              : `可配 ${P} 點・已配完`;
  hint.classList.toggle('neg', over > 0 || rest > 0);

  const cells = vals => vals.map(v => `<td>${v}</td>`).join('');

  document.getElementById('fwd-result').innerHTML =
    `<tr class="emph"><td class="row-label">精確BP</td>${cells(r.finalBP.map(v => v.toFixed(2)))}</tr>`;

  const detailRows = [
    ['頂檔', tops],
    ['固定檔', r.fixed],
    ['成長', r.growth],
    ['隨機檔BP', r.rnd.map(v => v.toFixed(2))],
    ['自然BP', r.nat.map(v => v.toFixed(2))],
    ['可加上限', r.cap],
    ['有效配點', r.eff],
    ['可重配點', r.leftover.map((v, i) => `<span class="${v > 0 ? 'neg' : ''}">${v}</span>`)],
    ['面板BP', r.panelBP]
  ];
  document.getElementById('fwd-detail').innerHTML = detailRows.map(([name, vals]) =>
    `<tr><td class="row-label">${name}</td>${cells(vals)}</tr>`
  ).join('');

  const statsEl = document.getElementById('fwd-stats');
  statsEl.innerHTML = Object.entries(r.stats).map(([name, v]) =>
    `<div class="stat-box"><div class="label">${name}</div><div class="value">${v}</div></div>`
  ).join('');

  lastForward = {
    pet: mode === 'manual' ? `（手動 ${tops.join('/')}）` : (petName || '—'),
    dan: drops.join(''),
    lv: lv,
    alloc: alloc.slice(),
    rand: st.rand.slice(),
    stats: r.stats,
    bp: r.finalBP
  };
}

// ---------- 紀錄 ----------
const REC_KEY = 'moli-calc-records-v1';
const STAT_ORDER = ['生命', '魔力', '攻擊', '防禦', '敏捷', '精神', '回復'];
let records = [];

function allocHint(alloc) {
  if (!alloc) return '';
  return LABELS.map((l, i) => alloc[i] > 0 ? `${l}${alloc[i]}` : null).filter(Boolean).join('／');
}

// 沒填的項目用「–」，代表那一項套平均值
function randHint(rand) {
  if (!rand || rand.every(v => v === null)) return '';
  return '隨機檔 ' + rand.map(v => v === null ? '–' : +v.toFixed(2)).join('/');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(REC_KEY);
    records = raw ? (JSON.parse(raw) || []) : [];
  } catch (e) {
    records = [];
  }
}

function saveRecords() {
  try { localStorage.setItem(REC_KEY, JSON.stringify(records)); } catch (e) { /* 無法保存時仍可用當次 session */ }
}

function renderRecords() {
  const tbody = document.querySelector('#rec-table tbody');
  const note = document.getElementById('rec-note');
  if (!records.length) {
    tbody.innerHTML = '<tr><td class="empty" colspan="16">尚無紀錄。調好參數後按「加入紀錄」，把這組結果留下來比較。</td></tr>';
    note.textContent = '';
    return;
  }
  tbody.innerHTML = records.map((rec, i) => `<tr>
    <td><button type="button" class="rec-del" data-idx="${i}" title="刪除這筆" aria-label="刪除這筆紀錄">✕</button></td>
    <td>${escapeHtml(rec.pet)}${rec.alloc ? `<span class="row-hint">${allocHint(rec.alloc)}</span>` : ''}</td>
    <td>${escapeHtml(rec.dan)}${randHint(rec.rand) ? `<span class="row-hint">${randHint(rec.rand)}</span>` : ''}</td>
    <td>${rec.lv}</td>
    ${STAT_ORDER.map(k => `<td>${rec.stats[k]}</td>`).join('')}
    ${rec.bp.map(v => `<td>${Number(v).toFixed(2)}</td>`).join('')}
  </tr>`).join('');
  note.textContent = `共 ${records.length} 筆・存在這台電腦的瀏覽器，換裝置或清除瀏覽資料就會消失。`;
}

document.querySelector('#rec-table tbody').addEventListener('click', (e) => {
  const btn = e.target.closest('.rec-del');
  if (!btn) return;
  const idx = Number(btn.dataset.idx);
  if (Number.isNaN(idx)) return;
  records.splice(idx, 1);
  saveRecords();
  renderRecords();
});

function recordsToTsv() {
  const head = ['寵物', '檔次', 'Lv'].concat(STAT_ORDER).concat(LABELS);
  const rows = records.map(rec =>
    [rec.pet, rec.dan, rec.lv]
      .concat(STAT_ORDER.map(k => rec.stats[k]))
      .concat(rec.bp.map(v => Number(v).toFixed(2)))
  );
  return [head].concat(rows).map(r => r.join('\t')).join('\n');
}

function flash(btn, text, ms) {
  const old = btn.textContent;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = old; }, ms || 1600);
}

document.getElementById('rec-add').addEventListener('click', () => {
  if (!lastForward) return;
  records.push(JSON.parse(JSON.stringify(lastForward)));
  saveRecords();
  renderRecords();
});

document.getElementById('rec-copy').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  if (!records.length) { flash(btn, '沒有紀錄'); return; }
  const tsv = recordsToTsv();
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = tsv;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    document.body.removeChild(ta);
    flash(btn, ok ? '已複製' : '複製失敗');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(tsv).then(() => flash(btn, '已複製')).catch(fallback);
  } else {
    fallback();
  }
});

let clearArmed = false;
let clearTimer = null;
document.getElementById('rec-clear').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  if (!records.length) { flash(btn, '沒有紀錄'); return; }
  if (!clearArmed) {
    clearArmed = true;
    btn.textContent = '再按一次確認';
    clearTimer = setTimeout(() => { clearArmed = false; btn.textContent = '清空紀錄'; }, 4000);
    return;
  }
  clearTimeout(clearTimer);
  clearArmed = false;
  btn.textContent = '清空紀錄';
  records = [];
  saveRecords();
  renderRecords();
});

// ---------- 事件綁定 ----------

// 手動改過就脫離自動模式，不再自動鎖回唯讀；要回自動值就重點一次策略
LABELS.forEach((_, i) => document.getElementById(`fwd-alloc-${i}`).addEventListener('input', () => { autoAlloc.fwd = false; }));
document.querySelectorAll('#panel-forward input').forEach(el => el.addEventListener('input', renderForward));
document.querySelectorAll('#panel-forward select').forEach(el => el.addEventListener('change', renderForward));
document.querySelectorAll('input[name="fwd-mode"]').forEach(el => el.addEventListener('change', () => { applyMode('fwd'); renderForward(); }));
// 用 click 不用 change：手動改過之後再點一次同一個策略要能重填
document.querySelectorAll('input[name="fwd-strat"]').forEach(el => el.addEventListener('click', () => { refillAlloc('fwd', num(document.getElementById('fwd-lv').value, 145) - 1); renderForward(); }));
document.getElementById('fwd-lv').addEventListener('input', () => { if (getStrategy('fwd') !== 'mix') { refillAlloc('fwd', num(document.getElementById('fwd-lv').value, 145) - 1); renderForward(); } });

applyMode('fwd');
renderForward();
loadRecords();
renderRecords();
