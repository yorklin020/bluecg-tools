// 各分頁共用：輸入列、配點策略、主題、分頁切換；需在 calc.js 之後載入

const LABELS = ['體', '力', '強', '速', '魔'];

function num(v, fallback) {
  if (v === '' || v === null || v === undefined) return fallback;
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

function buildInputRow(containerId, prefix, label, defaults, step) {
  const el = document.getElementById(containerId);
  const cells = LABELS.map((l, i) =>
    `<td><input type="number" ${step ? `step="${step}"` : ''} id="${prefix}-${i}" value="${defaults[i]}"></td>`
  ).join('');
  el.innerHTML = `<td class="row-label">${label}</td>${cells}`;
}

// 配點策略列：label 格放「混點」，後面五格對齊 體力強速魔
function buildStrategyRow(rowId, prefix) {
  const cells = LABELS.map((l, i) =>
    `<td class="strat"><input type="radio" name="${prefix}-strat" value="${i}" aria-label="全配${l}"></td>`
  ).join('');
  document.getElementById(rowId).innerHTML =
    `<td class="row-label"><label class="strat-mix"><input type="radio" name="${prefix}-strat" value="mix" checked>混點</label></td>${cells}`;
}

// datalist 選項（一次塞完，2500+ 筆）
const petOptionsHtml = Array.from(PET_MAP.keys()).map(n => `<option value="${n}">`).join('');
document.getElementById('pet-list-fwd').innerHTML = petOptionsHtml;
document.getElementById('pet-list-rev').innerHTML = petOptionsHtml;
document.getElementById('pet-list-nl1').innerHTML = petOptionsHtml;
document.getElementById('pet-list-ini').innerHTML = petOptionsHtml;

// ---------- 輸入模式（選擇寵物 / 手動輸入檔次）----------
function getMode(prefix) {
  const el = document.querySelector(`input[name="${prefix}-mode"]:checked`);
  return el ? el.value : 'pet';
}

function applyMode(prefix) {
  const mode = getMode(prefix);
  document.getElementById(`${prefix}-pet-field`).hidden = (mode !== 'pet');
  document.getElementById(`${prefix}-top`).hidden = (mode !== 'manual');
}

function showPetWarn(prefix, mode, petName) {
  const el = document.getElementById(`${prefix}-pet-warn`);
  el.textContent = (mode === 'pet' && petName && !PET_MAP.has(petName))
    ? '查無此寵物，請改用手動輸入檔次' : '';
}

function readFive(prefix, fallback) {
  return LABELS.map((_, i) => num(document.getElementById(`${prefix}-${i}`).value, fallback));
}
function readFiveRaw(prefix) {
  return LABELS.map((_, i) => {
    const v = document.getElementById(`${prefix}-${i}`).value;
    return v === '' ? '' : v;
  });
}

// ---------- 配點策略 ----------
const autoAlloc = { fwd: false, nl1: false, ini: false };   // 值是策略自動填的、還沒被手動改過

function getStrategy(prefix) {
  const el = document.querySelector(`input[name="${prefix}-strat"]:checked`);
  return el ? el.value : 'mix';
}

function setAllocLock(prefix, locked) {
  LABELS.forEach((_, i) => { document.getElementById(`${prefix}-alloc-${i}`).readOnly = locked; });
}

// 先照總點數配滿，爆掉的部分交給 render 函式最後回滾
function refillAlloc(prefix, P) {
  const s = getStrategy(prefix);
  autoAlloc[prefix] = (s !== 'mix');
  if (!autoAlloc[prefix]) return;
  P = Math.max(0, P);
  LABELS.forEach((_, i) => { document.getElementById(`${prefix}-alloc-${i}`).value = (i === +s) ? P : 0; });
}

// ---------- 主題切換 ----------
const THEME_KEY = 'moli-calc-theme';

function applyTheme(t) {
  document.documentElement.setAttribute('data-app-theme', t);
  const btn = document.getElementById('theme-toggle');
  btn.textContent = (t === 'dark') ? '切換明亮' : '切換暗色';
  btn.setAttribute('aria-label', btn.textContent + '主題');
}

let theme = 'light';
try { theme = localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { theme = 'light'; }

document.getElementById('theme-toggle').addEventListener('click', () => {
  theme = (theme === 'dark') ? 'light' : 'dark';
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* 無法保存時仍可切換 */ }
  applyTheme(theme);
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
  });
});

applyTheme(theme);
