// 算檔公式與寵物資料查表，不碰畫面；需在 pet-db.js 之後載入

// PET_DB 由 pet-db.js 提供（Tab 分隔純文字），此處解析回原本的陣列格式
const PET_DB = (typeof PET_DB_RAW === "string" ? PET_DB_RAW : "")
  .trim().split("\n").map(s => s.trim()).filter(Boolean)
  .map(line => { const c = line.split("\t"); return [c[0], +c[1], +c[2], +c[3], +c[4], +c[5]]; });
if (!PET_DB.length) console.error("pet-db.js 未載入或為空：請確認 pet-db.js 與本 HTML 放在同一資料夾");
const COEFF = {"生命": [8, 2, 3, 3, 1, 20], "魔力": [1, 2, 2, 2, 10, 20], "攻擊": [0.2, 2.7, 0.3, 0.3, 0.2, 20], "防禦": [0.2, 0.3, 3, 0.3, 0.2, 20], "敏捷": [0.1, 0.2, 0.2, 2, 0.1, 20], "精神": [-0.3, -0.1, 0.2, -0.1, 0.8, 100], "回復": [0.8, -0.1, -0.1, 0.2, -0.3, 100]};
const REM_ADJ = [0, 0.003, 0.001, -0.001, -0.003];

// 建立寵物名稱查表（重複名稱取第一筆，行為對齊 Excel MATCH）
const PET_MAP = new Map();
for (const p of PET_DB) {
  if (!PET_MAP.has(p[0])) PET_MAP.set(p[0], p.slice(1));
}

// 對應說明文件 §3：成長值公式（每級BP）
function growthPerLevel(fixedStat) {
  if (fixedStat === 0) return 0;
  const raw = fixedStat * 0.042 - 0.005 + REM_ADJ[((fixedStat % 5) + 5) % 5];
  return Math.round(raw * 1000) / 1000;
}

// 對應說明文件 §6、xlsm 正算!B14:F14 / 推算!用不到
// 注意：目前 .xlsm 公式只判斷「留空」，見上方「已知限制」區塊的說明
function randomBP(known, mult) {
  if (known === null || known === undefined || known === '') return 2 * mult;
  return known * mult;
}

// 依「選擇寵物 / 手動輸入檔次」模式決定頂檔來源
function getTops(mode, petName, manualTop) {
  if (mode === 'manual') return manualTop;
  if (petName && PET_MAP.has(petName)) return PET_MAP.get(petName);
  return [0, 0, 0, 0, 0];
}

// 對應說明文件 §4、§5：精確BP代入係數表後無條件捨去
function statsFromBP(bp) {
  const stats = {};
  for (const name in COEFF) {
    const [c1, c2, c3, c4, c5, base] = COEFF[name];
    const coeffs = [c1, c2, c3, c4, c5];
    let v = base;
    for (let i = 0; i < 5; i++) v += coeffs[i] * bp[i];
    stats[name] = Math.floor(v);
  }
  return stats;
}

// 對應說明文件 §8.1：由自然BP與可配點數 P 算爆點上限、有效配點、最終BP、七維
function allocateAndStats(nat, alloc, P) {
  const sumNat = nat.reduce((a, b) => a + b, 0);
  const cap = nat.map(n => Math.min(P, Math.max(0, Math.floor((sumNat - 2 * n + P) / 2))));
  const eff = alloc.map((a, i) => Math.min(a, cap[i]));
  const leftover = alloc.map((a, i) => a - eff[i]);
  const finalBP = nat.map((n, i) => n + eff[i]);
  return { cap, eff, leftover, finalBP, stats: statsFromBP(finalBP) };
}

// 對應說明文件 §1、§8、§14.1：正算
function computeForward(state) {
  const { tops, drops, mult, lv, alloc, rand } = state;
  const fixed = [], growth = [], rnd = [], nat = [];
  for (let i = 0; i < 5; i++) {
    const f = tops[i] - drops[i];
    const g = growthPerLevel(f);
    const r = randomBP(rand[i], mult);
    fixed.push(f); growth.push(g); rnd.push(r);
    nat.push(f * mult + g * (lv - 1) + r);
  }
  const res = allocateAndStats(nat, alloc, lv - 1);
  const panelBP = fixed.map((f, i) => Math.round(f * mult + growth[i] * (lv - 1) + res.eff[i]));
  return { fixed, growth, rnd, nat, panelBP, ...res };
}

// 非1級：以現在的BP為底往上推，倍率、隨機檔、起始等級前的配點都已包含在現在的BP裡
// 起始等級填1、現在的BP填1等BP時，結果與正算相同
function computeNonlv1(state) {
  const { tops, drops, now, startLv, lv, alloc } = state;
  const span = lv - startLv;
  const fixed = [], growth = [], nat = [];
  for (let i = 0; i < 5; i++) {
    const f = tops[i] - drops[i];
    const g = growthPerLevel(f);
    fixed.push(f); growth.push(g);
    nat.push(now[i] + g * span);
  }
  return { fixed, growth, nat, ...allocateAndStats(nat, alloc, span) };
}

// 非1級往回推：computeNonlv1 的反向，已配點照實扣，不套爆點上限
function computeInitial(state) {
  const { tops, drops, now, startLv, lv, alloc } = state;
  const span = lv - startLv;
  const fixed = [], growth = [], grown = [], initBP = [];
  for (let i = 0; i < 5; i++) {
    const f = tops[i] - drops[i];
    const g = growthPerLevel(f);
    fixed.push(f); growth.push(g); grown.push(g * span);
    initBP.push(now[i] - g * span - alloc[i]);
  }
  return { fixed, growth, grown, initBP, stats: statsFromBP(initBP) };
}

// 對應說明文件 §7、§14.2：推算（算隨機檔）
function computeReverse(state) {
  const { tops, drops, mult, lv, alloc, measured } = state;
  const fixed = [], growth = [], predicted = [], residual = [], inferred = [];
  for (let i = 0; i < 5; i++) {
    const f = tops[i] - drops[i];
    const g = growthPerLevel(f);
    const pred = f * mult + g * (lv - 1) + alloc[i];
    const res = measured[i] - pred;
    fixed.push(f); growth.push(g); predicted.push(pred); residual.push(res);
    inferred.push(res / mult);
  }
  const sum = inferred.reduce((a, b) => a + b, 0);
  const hasNegative = inferred.some(v => v < -0.001);
  return { fixed, growth, predicted, residual, inferred, sum, hasNegative };
}
