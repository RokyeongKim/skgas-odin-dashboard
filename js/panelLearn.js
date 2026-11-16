// js/panelLearn.js — "2. Index 이해" 탭
//  G-1 변동성 비교(단위 착시 제거: 로그수익률 기준)  G-2 상관관계 히트맵  G-3 상대가(스프레드·비율) 이력
//  G-4 대체재 지도(관계 설명 + 실제 동조 여부 수치)  G-5 왜 JKM 이 가장 크게 움직이나 (이벤트 반응 실측)
//  모든 수치는 data/timeseries.json 에서 로드 시점에 계산한다. 설명문의 숫자 부분은 계산값을 끼워 넣는다.

import { NATIVE_META, CONVERSION } from './config.js';
import { getTimeseries, getEvents } from './data.js';
import { descHtml } from './glossary.js';

const KEYS = ['Brent', 'WTI', 'FEI', 'FEI_C4', 'CP', 'MB', 'MB_nC4', 'C2', 'ARA_C3', 'MOPJ', 'FO380', 'JKM', 'FRT_BALTIC', 'FRT_RIM'];
const SHORT = { Brent: 'Brent', WTI: 'WTI', FEI: 'FEI C3', FEI_C4: 'FEI C4', CP: 'CP', MB: 'MB C3', MB_nC4: 'MB nC4', C2: '에탄(C2)', ARA_C3: 'ARA C3',
  MOPJ: 'MOPJ', FO380: 'F/O 380', JKM: 'JKM', FRT_BALTIC: 'Baltic 운임', FRT_RIM: 'RIM 운임' };
const sh = k => SHORT[k] || k;
const colorOf = k => NATIVE_META[k]?.color || '#8b949e';

let charts = {};
let rendered = false;
let horizon = 1;       // 상관 계산 수익률 기간(영업일)
let relKey = 'CV';

// ───────────────────────── 계산 유틸 ─────────────────────────
function clean(key) {
  return (getTimeseries() || []).filter(r => r.native[key] !== null && r.native[key] !== undefined && r.native[key] > 0)
    .map(r => ({ date: r.date, v: r.native[key] }));
}
function logRet(key, h = 1) {
  const s = clean(key), out = {};
  for (let i = h; i < s.length; i++) out[s[i].date] = Math.log(s[i].v / s[i - h].v);
  return out;
}
function mean(a) { return a.reduce((x, y) => x + y, 0) / a.length; }
function sd(a) { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); }
function corrOf(ra, rb) {
  const ds = Object.keys(ra).filter(d => d in rb);
  if (ds.length < 30) return null;
  const a = ds.map(d => ra[d]), b = ds.map(d => rb[d]);
  const ma = mean(a), mb = mean(b);
  const cov = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0) / (ds.length - 1);
  return cov / (sd(a) * sd(b));
}
function monthEnd(key) {
  const me = {}; clean(key).forEach(x => { me[x.date.slice(0, 7)] = x.v; }); return me;
}
function monthlyRet(key) {
  const me = monthEnd(key), ms = Object.keys(me).sort(), out = {};
  for (let i = 1; i < ms.length; i++) out[ms[i]] = Math.log(me[ms[i]] / me[ms[i - 1]]);
  return out;
}
function volRow(key) {
  const s = clean(key); if (s.length < 30) return null;
  const r = Object.values(logRet(key, 1));
  const vals = s.map(x => x.v);
  return { key, dailySd: sd(r) * 100, annual: sd(r) * Math.sqrt(252) * 100, ratio: Math.max(...vals) / Math.min(...vals),
    cv: sd(vals) / mean(vals), big: r.filter(x => Math.abs(x) > 0.1).length, n: s.length };
}
const fmt = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v)) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const sgn = v => (v >= 0 ? '+' : '');
const corrWord = c => c === null ? '—' : Math.abs(c) >= 0.6 ? '높음' : Math.abs(c) >= 0.3 ? '중간' : '낮음';
const corrColor = c => c === null ? '#8b949e' : Math.abs(c) >= 0.6 ? '#f85149' : Math.abs(c) >= 0.3 ? '#d29922' : '#3fb950';

// 상대가 정의 (값 함수, 단위, 기준선, 설명)
const RELS = [
  { id: 'CV', label: 'CV = FEI ÷ (Brent×8.2)', unit: '%', scale: 100, fn: r => r.derived?.CV, color: '#00d4ff',
    lines: [{ v: 90, label: '소싱 적정 <90%', c: '#3fb950' }, { v: 95, label: 'Unwind ≥95%', c: '#f85149' }],
    desc: '산업체 판가가 Brent 연동이므로 FEI/Brent 가 낮을수록 LPG 소싱이 유리. LPG 1톤 = 8.2 bbl 환산.' },
  { id: 'NV', label: 'NV = MB×0.42 ÷ Brent', unit: '%', scale: 100, fn: r => r.derived?.NV, color: '#4ade80',
    lines: [{ v: 38.5, label: '경쟁력 조달선 38.5%', c: '#3fb950' }],
    desc: '미국 프로판의 원유 대비 가격. 미국 LPG 가 원유보다 싸게 거래될수록(낮을수록) 미국산 조달 경쟁력.' },
  { id: 'FEI_MOPJ', label: 'FEI ÷ MOPJ (LPG/납사)', unit: '%', scale: 100, fn: r => r.derived?.FEI_MOPJ, color: '#f0a500',
    lines: [{ v: 85, label: '소싱 85%', c: '#3fb950' }, { v: 90, label: '판매 90%', c: '#f85149' }],
    desc: '석화 크래커의 원료 대체 기준. 85% 아래면 LPG 투입이 유리해 LPG 수요가 늘고, 90% 위면 납사로 회귀. 이 메커니즘이 FEI 의 상단을 묶는다.' },
  { id: 'FEI_CP', label: 'FEI − CP (현물−계약 프리미엄)', unit: '$/t', scale: 1, fn: r => r.derived?.FEI_CP, color: '#f472b6',
    lines: [{ v: 0, label: '0', c: '#8b949e' }],
    desc: '아시아 현물이 중동 월간 계약가보다 얼마나 비싼가. 양(+)이 크면 현물 조달 불리·계약물량 가치 상승. 통상 운임+터미널비 수준(+30~80)에서 형성.' },
  { id: 'FEI_ARA', label: 'FEI − ARA (아시아 프리미엄)', unit: '$/t', scale: 1, fn: r => (r.native.FEI != null && r.native.ARA_C3 != null) ? r.native.FEI - r.native.ARA_C3 : null, color: '#2dd4bf',
    lines: [{ v: 0, label: '0', c: '#8b949e' }],
    desc: '같은 미국산 카고가 유럽 대신 아시아로 오게 만드는 유인. 미국→아시아 운임이 유럽행보다 비싸므로 평시에도 +50~100 이 정상. 급등하면 아시아 공급 부족.' },
  { id: 'MB_TET_PREM', label: 'MB TET − non-TET', unit: '¢/gal', scale: 1, fn: r => r.derived?.MB_TET_PREM, color: '#b45309',
    lines: [{ v: 0, label: '0', c: '#8b949e' }],
    desc: '미국 내 수출터미널 연계 저장소(TET)의 프리미엄. 커지면 수출 병목(터미널 풀가동), 0 근처면 수출 여유.' },
  { id: 'JKM_FEI', label: 'JKM − FEI(M−2) ($/mmbtu)', unit: '$/mmbtu', scale: 1, fn: r => r.derived?.JKM_FEI_M2, color: '#c77dff',
    lines: [{ v: 0, label: '0 (등가)', c: '#8b949e' }],
    desc: '열량 환산 LNG−LPG 가격차. 양이면 LNG 가 비싸 LPG 대체 유리. 2022·2026 처럼 가스 쇼크 때 크게 벌어진다.' },
  { id: 'BRENT_WTI', label: 'Brent − WTI', unit: '$/bbl', scale: 1, fn: r => (r.native.Brent != null && r.native.WTI != null) ? r.native.Brent - r.native.WTI : null, color: '#fb923c',
    lines: [{ v: 0, label: '0', c: '#8b949e' }],
    desc: '미국 원유 수출 유인. 벌어질수록 미국 원유·NGL 수출 증가 → MB 약세·FEI 공급 증가 경로.' },
  { id: 'FEI_C4_C3', label: 'FEI C4 − C3 (부탄 프리미엄)', unit: '$/t', scale: 1, fn: r => r.derived?.FEI_C4_C3, color: '#0ea5e9',
    lines: [{ v: 0, label: '0', c: '#8b949e' }],
    desc: '부탄이 프로판보다 비싼 정도. 겨울·석화 부탄 수요기에 양, 여름에 음으로 가는 계절성.' },
];
function relSeries(rel) {
  return (getTimeseries() || []).map(r => { const v = rel.fn(r); return { date: r.date, v: (v === null || v === undefined) ? null : v * rel.scale }; });
}
function pctl(sorted, q) { const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos); return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo); }
function relStats(rel) {
  const s = relSeries(rel).filter(x => x.v !== null);
  if (s.length < 30) return null;
  const vals = s.map(x => x.v), sorted = [...vals].sort((a, b) => a - b);
  const cur = s[s.length - 1];
  return { n: s.length, mean: mean(vals), sd: sd(vals), p5: pctl(sorted, .05), p50: pctl(sorted, .5), p95: pctl(sorted, .95), min: sorted[0], max: sorted[sorted.length - 1],
    cur, pct: Math.round(vals.filter(v => v <= cur.v).length / vals.length * 100), z: (cur.v - mean(vals)) / sd(vals) };
}

// 이벤트 후 N 영업일 내 최대 반응 (상승 이벤트는 max, 수요파괴형은 min)
function eventReaction(ev, keys, days = 15, pre = 10) {
  const ts = getTimeseries() || [];
  let i0 = ts.findIndex(r => r.date >= ev.date); if (i0 < 0) return null;
  const win = ts.slice(Math.max(0, i0 - pre) + 1, i0 + days + 1);
  const out = {};
  keys.forEach(k => {
    // 기준값: 기준일 값이 결측이면 최대 5영업일 더 거슬러 올라가 첫 유효값 사용 (보간 아님)
    let b = null; const bi = Math.max(0, i0 - pre);
    for (let j = bi; j >= Math.max(0, bi - 5) && b === null; j--) { const v = ts[j].native[k]; if (v !== null && v !== undefined && v > 0) b = v; }
    if (b === null) { out[k] = null; return; }
    const vals = win.map(r => r.native[k]).filter(v => v !== null && v !== undefined);
    if (!vals.length) { out[k] = null; return; }
    const ext = ev.archetype === '수요파괴형' ? Math.min(...vals) : Math.max(...vals);
    out[k] = (ext / b - 1) * 100;
  });
  return out;
}

// ───────────────────────── 렌더 ─────────────────────────
export function renderLearnTab(force = false) {
  if (rendered && !force) { Object.values(charts).forEach(c => c.resize()); return; }
  rendered = true;
  renderVol(); renderCorr(); renderRel(); renderSubs(); renderWhyJKM();
}
export function resizeLearn() { Object.values(charts).forEach(c => c.resize()); }

function mk(id) { const el = document.getElementById(id); if (!el) return null; if (charts[id]) charts[id].dispose(); charts[id] = echarts.init(el, 'dark'); return charts[id]; }

// G-1 변동성
function renderVol() {
  const rows = KEYS.map(volRow).filter(Boolean).sort((a, b) => b.annual - a.annual);
  const c = mk('chart-G1'); if (!c) return;
  c.setOption({
    backgroundColor: 'transparent', grid: { left: 110, right: 70, top: 20, bottom: 44 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rows.find(x => sh(x.key) === ps[0].name); return `<b>${ps[0].name}</b><br/>연율 변동성 ${fmt(r.annual)}%<br/>일간 σ ${fmt(r.dailySd, 2)}%<br/>8년 최고/최저 ${fmt(r.ratio)}x<br/>하루 ±10% 초과 ${r.big}일`; } },
    xAxis: { type: 'value', name: '연율 변동성 % (일간 로그수익률 σ × √252)', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: '#8b949e', fontSize: 11 }, axisLabel: { color: '#8b949e' }, splitLine: { lineStyle: { color: '#1e2430', type: 'dashed' } } },
    yAxis: { type: 'category', data: rows.map(r => sh(r.key)).reverse(), axisLabel: { color: '#c9d1d9', fontSize: 11 } },
    series: [{ type: 'bar', data: rows.map(r => ({ value: Math.round(r.annual), itemStyle: { color: colorOf(r.key) } })).reverse(), barWidth: 14,
      label: { show: true, position: 'right', color: '#c9d1d9', fontSize: 10, formatter: p => `${p.value}%` } }],
  });
  const t = document.getElementById('table-G1'); if (!t) return;
  t.innerHTML = `<table class="price-table range-table"><thead><tr><th>지표</th><th>일간 σ</th><th>연율 변동성</th><th>최고/최저 배수</th><th>변동계수 σ/μ</th><th>하루 ±10% 초과</th><th>n</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td style="color:${colorOf(r.key)};font-weight:600" data-tip-key="${r.key}">${sh(r.key)} <span class="tip-mark">ⓘ</span></td><td>${fmt(r.dailySd, 2)}%</td><td><b>${fmt(r.annual, 0)}%</b></td><td>${fmt(r.ratio)}x</td><td>${fmt(r.cv, 2)}</td><td>${r.big}일</td><td class="val-neutral">${r.n}</td></tr>`).join('') + '</tbody></table>';
  const top = rows[0], fei = rows.find(r => r.key === 'FEI'), brent = rows.find(r => r.key === 'Brent'), cp = rows.find(r => r.key === 'CP');
  const s = document.getElementById('summary-G1');
  if (s) s.innerHTML = `단위 착시를 없애기 위해 <b>가격 수준이 아니라 로그수익률(%)의 표준편차</b>로 비교했습니다. 그래도 ${sh(top.key)} 의 연율 변동성은 ${fmt(top.annual, 0)}% 로 FEI(${fmt(fei.annual, 0)}%)·Brent(${fmt(brent.annual, 0)}%)의 ${fmt(top.annual / fei.annual, 1)}배입니다. 하루에 ±10% 넘게 움직인 날도 JKM ${top.big}일 vs FEI ${fei.big}일. CP 는 월 1회 발표 가격이라 일간 변동은 0 이고 월말에만 점프합니다(${cp.big}일).`;
}

// G-2 상관관계
function renderCorr() {
  const rets = {}; KEYS.forEach(k => { rets[k] = logRet(k, horizon); });
  const keys = KEYS.filter(k => Object.keys(rets[k]).length > 50);
  const M = keys.map(a => keys.map(b => a === b ? 1 : corrOf(rets[a], rets[b])));
  const c = mk('chart-G2'); if (!c) return;
  const data = []; keys.forEach((a, i) => keys.forEach((b, j) => data.push([j, i, M[i][j] === null ? null : +M[i][j].toFixed(2)])));
  c.setOption({
    backgroundColor: 'transparent', grid: { left: 90, right: 20, top: 10, bottom: 80 },
    tooltip: { formatter: p => `<b>${sh(keys[p.value[1]])} × ${sh(keys[p.value[0]])}</b><br/>상관 ${p.value[2]} (${corrWord(p.value[2])})` },
    xAxis: { type: 'category', data: keys.map(sh), axisLabel: { color: '#c9d1d9', rotate: 45, fontSize: 10 }, splitArea: { show: true } },
    yAxis: { type: 'category', data: keys.map(sh), inverse: true, axisLabel: { color: '#c9d1d9', fontSize: 10 }, splitArea: { show: true } },
    visualMap: { min: -0.2, max: 1, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, textStyle: { color: '#8b949e' },
      inRange: { color: ['#1f3b73', '#0d1117', '#7a2e1f', '#f85149'] } },
    series: [{ type: 'heatmap', data, label: { show: true, fontSize: 9, color: '#e6edf3', formatter: p => p.value[2] === null ? '' : p.value[2].toFixed(2) }, emphasis: { itemStyle: { borderColor: '#fff', borderWidth: 1 } } }],
  });
  // 연계 쌍 해설
  const pairs = [
    ['FEI', 'MB', '미국산 LPG 가 아시아 공급의 한 축 → 차익거래로 연결'],
    ['FEI', 'CP', '같은 아시아 LPG 이지만 CP 는 월 1회 계약가 → 일간 상관은 구조적으로 낮고 월간으로 보면 높음'],
    ['FEI', 'ARA_C3', '대서양 vs 아시아, 같은 미국 카고를 두고 경쟁'],
    ['FEI', 'MOPJ', '석화 원료 대체재(LPG↔납사)'],
    ['FEI', 'Brent', '산업체 판가 기준(Brent)과 원가(FEI)'],
    ['FEI', 'JKM', '같은 "아시아 가스계 연료" 로 분류되지만 수급 구조가 다름'],
    ['MB', 'C2', '미국 NGL 패밀리(에탄·프로판) — 크래커 원료 대체'],
    ['Brent', 'MOPJ', '납사는 정제 제품 → 유가에 직결'],
    ['Brent', 'FO380', '연료유도 정제 제품'],
    ['FRT_BALTIC', 'FEI', '운임과 아시아 현물 — 둘 다 중동→극동 공급 리스크를 반영'],
    ['JKM', 'Brent', 'LNG 장기계약은 유가연동이지만 spot JKM 은 별개'],
  ];
  const t = document.getElementById('table-G2'); if (!t) return;
  const ci = (a, b) => { const i = keys.indexOf(a), j = keys.indexOf(b); return (i < 0 || j < 0) ? null : M[i][j]; };
  const mc = corrOf(monthlyRet('FEI'), monthlyRet('CP'));   // 월말 기준 월간 변화율 상관
  t.innerHTML = `<table class="price-table range-table"><thead><tr><th>연계 쌍</th><th>상관계수</th><th>판정</th><th style="text-align:left">왜 연결되는가</th></tr></thead><tbody>` +
    pairs.map(([a, b, why]) => { const r = ci(a, b); const extra = (a === 'FEI' && b === 'CP') ? ` <small class="val-neutral">(월간 ${fmt(mc, 2)})</small>` : ''; return `<tr><td style="font-weight:600"><span style="color:${colorOf(a)}">${sh(a)}</span> × <span style="color:${colorOf(b)}">${sh(b)}</span></td><td style="color:${corrColor(r)};font-weight:700">${r === null ? '—' : r.toFixed(2)}${extra}</td><td><span class="status-badge" style="background:${corrColor(r)}22;color:${corrColor(r)}">${corrWord(r)}</span></td><td class="val-neutral" style="white-space:normal;text-align:left">${why}</td></tr>`; }).join('') + '</tbody></table>';
  const s = document.getElementById('summary-G2');
  const fm = ci('FEI', 'MB'), fj = ci('FEI', 'JKM'), fb = ci('FEI', 'Brent'), fmo = ci('FEI', 'MOPJ'), fc = ci('FEI', 'CP');
  if (s) s.innerHTML = `${horizon === 1 ? '일간' : horizon + '영업일'} 수익률 기준. 상관 0.6 이상이면 "같이 움직인다", 0.3 미만이면 "따로 논다"로 읽으면 됩니다. 결과를 한 줄로 요약하면 <b>석유 계열(Brent·MOPJ·F/O)끼리 높고, LPG 계열(FEI·MB·ARA)끼리 ${horizon === 1 ? '중간' : '높고'}, JKM 은 어느 것과도 낮습니다.</b> FEI×MB ${fmt(fm, 2)}, FEI×MOPJ ${fmt(fmo, 2)}, FEI×Brent ${fmt(fb, 2)} 인데 FEI×JKM 은 ${fmt(fj, 2)} 에 그칩니다. ${horizon === 1 ? '하루 단위에서는 지연·노이즈 때문에 상관이 낮게 나오므로 20영업일로 바꿔 보면 진짜 연결 강도가 드러납니다.' : '일간보다 전반적으로 높아진 것은 지표 간 반응에 며칠~몇 주의 시차가 있기 때문입니다.'} CP 는 월 1회 발표라 어떤 기간으로 봐도 일간 상관이 낮게(${fmt(fc, 2)}) 나오지만, <b>월말 기준 월간 변화율로 비교하면 FEI×CP ${fmt(mc, 2)}</b> 로 월 단위에서는 뚜렷이 연동됩니다(CP 가 그 달의 FEI 를 따라 정해지기 때문).`;
}

// G-3 상대가
function renderRel() {
  const sel = document.getElementById('rel-select');
  if (sel && !sel.options.length) {
    RELS.forEach(r => { const o = document.createElement('option'); o.value = r.id; o.textContent = r.label; sel.appendChild(o); });
    sel.addEventListener('change', e => { relKey = e.target.value; drawRel(); });
  }
  drawRel();
  const t = document.getElementById('table-G3'); if (!t) return;
  t.innerHTML = `<table class="price-table range-table"><thead><tr><th>상대가</th><th>현재</th><th>백분위</th><th>평균</th><th>P5 ~ P95</th><th>최소 ~ 최대</th><th style="text-align:left">해석</th></tr></thead><tbody>` +
    RELS.map(r => { const st = relStats(r); if (!st) return ''; const d = r.unit === '%' ? 1 : (r.unit === '¢/gal' ? 2 : 0);
      const zc = Math.abs(st.z) >= 2 ? '#f85149' : Math.abs(st.z) >= 1 ? '#d29922' : '#3fb950';
      return `<tr class="rel-row" data-id="${r.id}" style="cursor:pointer"><td style="color:${r.color};font-weight:600">${r.label}</td><td><b>${fmt(st.cur.v, d)} ${r.unit}</b></td><td style="color:${zc};font-weight:600">P${st.pct}</td><td>${fmt(st.mean, d)}</td><td>${fmt(st.p5, d)} ~ ${fmt(st.p95, d)}</td><td>${fmt(st.min, d)} ~ ${fmt(st.max, d)}</td><td class="val-neutral" style="white-space:normal;max-width:360px;text-align:left">${r.desc}</td></tr>`; }).join('') + '</tbody></table>';
  t.querySelectorAll('.rel-row').forEach(tr => tr.addEventListener('click', () => { relKey = tr.dataset.id; if (sel) sel.value = relKey; drawRel(); document.getElementById('chart-G3')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }));
}
function drawRel() {
  const rel = RELS.find(r => r.id === relKey) || RELS[0];
  const s = relSeries(rel), st = relStats(rel);
  const c = mk('chart-G3'); if (!c || !st) return;
  const d = rel.unit === '%' ? 1 : (rel.unit === '¢/gal' ? 2 : 0);
  const evs = (getEvents() || []).filter(e => e.tier === 1 || e.flag);
  c.setOption({
    backgroundColor: 'transparent',
    title: { text: `${rel.label} · 단위 ${rel.unit} · 전체기간 평균 ${fmt(st.mean, d)}, P5~P95 ${fmt(st.p5, d)}~${fmt(st.p95, d)}, 현재 ${fmt(st.cur.v, d)} (P${st.pct})`, left: 10, top: 4, textStyle: { color: '#8b949e', fontSize: 11, fontWeight: 400 } },
    tooltip: { trigger: 'axis', formatter: ps => { const p = ps.find(x => x.seriesType === 'line'); return p && p.data !== null ? `<b>${p.axisValue}</b><br/>${rel.label}: <b>${fmt(p.data, d)} ${rel.unit}</b>` : ''; } },
    grid: { left: 70, right: 30, top: 36, bottom: 50 },
    xAxis: { type: 'category', data: s.map(x => x.date), boundaryGap: false, axisLabel: { color: '#8b949e', fontSize: 10 }, axisLine: { lineStyle: { color: '#30363d' } } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: '#8b949e', fontSize: 10 }, splitLine: { lineStyle: { color: '#1e2430', type: 'dashed' } } },
    series: [{ type: 'line', data: s.map(x => x.v), showSymbol: false, lineStyle: { width: 1.5, color: rel.color }, itemStyle: { color: rel.color },
      markArea: { silent: true, data: [[{ yAxis: st.mean - st.sd, itemStyle: { color: `${rel.color}1a` }, label: { show: true, position: 'insideTopLeft', formatter: 'μ±1σ', color: rel.color, fontSize: 10 } }, { yAxis: st.mean + st.sd }]] },
      markLine: { symbol: 'none', silent: true, data: [
        { yAxis: st.mean, lineStyle: { color: '#e6edf3', width: 1 }, label: { formatter: `μ ${fmt(st.mean, d)}`, color: '#e6edf3', fontSize: 10 } },
        ...rel.lines.map(l => ({ yAxis: l.v, lineStyle: { color: l.c, type: 'dashed' }, label: { formatter: l.label, color: l.c, fontSize: 10, position: 'insideStartTop' } })),
        ...evs.filter(e => s.some(x => x.date === e.date)).map(e => ({ xAxis: e.date, lineStyle: { color: e.color, type: 'dotted', opacity: 0.5 }, label: { show: false } })),
      ] } }],
    dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 2, height: 18, borderColor: '#30363d', fillerColor: 'rgba(0,212,255,0.1)', handleStyle: { color: '#00d4ff' } }],
  }, true);
}

// G-4 대체재 지도
function renderSubs() {
  const r1 = {}; KEYS.forEach(k => { r1[k] = logRet(k, 1); });
  const r20 = {}; KEYS.forEach(k => { r20[k] = logRet(k, 20); });
  const lvl = (a, b) => { const sa = clean(a), sb = clean(b); const mb = Object.fromEntries(sb.map(x => [x.date, x.v])); const ds = sa.filter(x => x.date in mb); return corrOf(Object.fromEntries(ds.map(x => [x.date, x.v])), Object.fromEntries(ds.map(x => [x.date, mb[x.date]]))); };
  const card = (title, a, b, relation, exists, mech, verdict) => {
    const c1 = corrOf(r1[a], r1[b]), c20 = corrOf(r20[a], r20[b]), cl = lvl(a, b);
    return `<div class="brief-card" style="border-top-color:${colorOf(a)}">
      <div class="brief-card-title"><span style="color:${colorOf(a)}">${sh(a)}</span> ↔ <span style="color:${colorOf(b)}">${sh(b)}</span> · ${title}</div>
      <div class="sub-meta">대체 관계: <b>${relation}</b> · 대체재 존재: <b>${exists}</b></div>
      <div class="sub-corr">동조 여부(상관) — 일간 <b style="color:${corrColor(c1)}">${fmt(c1, 2)}</b> · 20영업일 <b style="color:${corrColor(c20)}">${fmt(c20, 2)}</b> · 가격수준 <b style="color:${corrColor(cl)}">${fmt(cl, 2)}</b></div>
      <div class="sub-text">${mech}</div>
      <div class="sub-verdict">→ ${verdict(c1, c20, cl)}</div>
    </div>`;
  };
  const el = document.getElementById('cards-G4'); if (!el) return;
  el.innerHTML = `<div class="brief-grid">` +
    card('석화 원료', 'FEI', 'MOPJ', '직접 대체재 (크래커 원료)', '있음', 'NCC 는 납사 대신 LPG 를 10~15% 까지 투입 가능. FEI/MOPJ 가 85% 아래면 LPG 수요가 늘어 FEI 를 밀어 올리고, 90% 위면 납사로 돌아가 FEI 상단을 막는다. 이 "교체 밸브" 때문에 FEI 는 MOPJ 와 같이 움직이되 MOPJ 보다 크게 벗어나지 못한다.',
      (c1, c20) => `가격은 ${corrWord(c20)} 상관으로 같이 움직이고(20영업일 ${fmt(c20, 2)}), 비율은 평시 85~100% 안에 갇혀 있다. 대체재가 있어서 FEI 변동이 제한된다.`) +
    card('열량 경쟁(발전·도시가스·산업 연료)', 'JKM', 'FEI', '부분 대체재 (설비 전환 필요)', '제한적', 'LNG 와 LPG 는 열량 기준으로 경쟁하지만 보일러·발전설비를 바꿔야 해서 단기 교체가 거의 없다. 그래서 JKM 이 급등해도 LPG 로 수요가 즉시 옮겨가지 않고, FEI 는 따라 오르지 않는다. JKM−FEI(M−2) 스프레드가 2022·2026 에 크게 벌어진 이유.',
      (c1, c20) => `상관 ${fmt(c20, 2)} 로 낮다. 같은 "가스" 로 묶이지만 가격 결정 시장이 다르며, 대체는 분기~연 단위 설비투자 뒤에나 일어난다.`) +
    card('지역 차익거래', 'FEI', 'MB', '같은 상품, 다른 지역 (운임으로 연결)', '있음 (미국산 공급)', 'FEI ≈ MB×5.208 + 미국→아시아 운임 + 터미널비. 아시아가 비싸지면 미국 수출이 늘어 격차가 닫힌다. 운임이 뛰거나 파나마 운하가 막히면 연결이 느슨해져 FEI 만 오른다(2026).',
      (c1, c20) => `20영업일 상관 ${fmt(c20, 2)} 로 LPG 계열 중 가장 높다. 미국산이 아시아 현물의 "스윙 공급" 이라는 뜻이고, 이것이 FEI 가 JKM 처럼 폭주하지 못하게 막는 두 번째 밸브다.`) +
    card('계약가 vs 현물', 'FEI', 'CP', '같은 상품, 다른 가격 결정 방식', '해당 없음(둘 다 보유)', 'CP 는 아람코가 월 1회 정하는 FOB 계약가, FEI 는 매일 평가되는 CFR 현물가. 일간 상관은 구조적으로 0 에 가깝고 월간으로 보면 CP 가 FEI 를 한 달 늦게 따라간다. 장기계약 물량(CP 연동)과 현물 조달(FEI) 의 비중이 조달 원가를 가른다.',
      (c1, c20) => `일간 ${fmt(c1, 2)}·20영업일 ${fmt(c20, 2)} 로 낮아 보이지만 월말 기준 월간 변화율 상관은 ${fmt(corrOf(monthlyRet('FEI'), monthlyRet('CP')), 2)}. "FEI−CP" 스프레드가 양으로 커질수록 계약 물량의 가치가 올라간다.`) +
    card('NGL 패밀리(크래커 원료)', 'C2', 'MB', '대체재 (미국 에탄 크래커 vs 프로판)', '있음', '미국 크래커는 에탄 전용이 많아 직접 교체는 제한적이지만, 유연 크래커가 프로판·에탄을 오간다. 둘 다 셰일 가스 부산물이라 공급 측 공통 요인이 크다.',
      (c1, c20) => `상관 ${fmt(c20, 2)}. 공급원이 같아 중간 수준으로 같이 움직이되, 에탄은 수출 설비 제약으로 독자 사이클(2019 폭락, 2022 폭등)을 탄다.`) +
    card('정제 제품 사슬', 'Brent', 'MOPJ', '원료→제품 (대체 아님, 종속)', '—', '납사는 원유를 정제해 나오므로 유가를 거의 그대로 따른다. 납사 크랙(MOPJ−Brent×8.2)이 석화 마진의 지표.',
      (c1, c20) => `상관 ${fmt(c20, 2)} 로 가장 높은 쌍. 유가가 오르면 납사가 오르고, 그러면 FEI/MOPJ 가 내려가 LPG 투입이 유리해지는 2차 경로가 생긴다.`) +
    card('공급 리스크 공유', 'FRT_BALTIC', 'FEI', '대체 아님 — 같은 리스크(중동→극동 항로)에 노출', '—', '운임은 선복 수급으로 정해지지만 호르무즈·홍해 차질은 운임과 아시아 현물을 동시에 밀어 올린다. CFR 가격(FEI) = FOB(CP) + 운임이므로 운임 급등은 FEI−CP 확대로 바로 전이된다.',
      (c1, c20) => `평시 상관은 ${fmt(c20, 2)} 로 낮지만 위기 때만 같이 뛴다. 2026 년 둘 다 역사적 극단인 것이 그 증거.`) +
    `</div>`;
  const s = document.getElementById('summary-G4');
  if (s) s.innerHTML = `대체재가 <b>있고 교체가 빠른</b> 지표(FEI↔MOPJ, FEI↔MB)는 가격이 서로를 붙들어 변동이 제한됩니다. 대체재가 <b>없거나 교체가 느린</b> 지표(JKM, 운임)는 수급 충격이 그대로 가격이 됩니다. 아래 카드의 상관계수는 전부 데이터에서 계산한 값입니다.`;
}

// G-5 왜 JKM
function renderWhyJKM() {
  const keys = ['JKM', 'FEI', 'MB', 'CP', 'Brent', 'FRT_BALTIC'];
  const evs = (getEvents() || []).filter(e => (e.tier === 1 || e.flag) && (e.channels || []).some(ch => ['lng', 'lpg', 'brent'].includes(ch)))
    .filter(e => !['hormuz_close_1', 'hormuz_reopen_1', 'strait_open', 'talks_fail', 'mou_news', 'mou_signed', 'mou_end', 'iran_escalate', 'houthi_ban', 'hormuz_close_2', 'qatar_damage', 'iran_mou_stop', 'maduro_arrest'].includes(e.id));
  const rows = evs.map(e => ({ e, r: eventReaction(e, keys) })).filter(x => x.r);
  const t = document.getElementById('table-G5'); if (!t) return;
  const cell = v => { if (v === null) return '<td class="val-neutral">—</td>'; const r = Math.round(v); return `<td style="color:${Math.abs(v) >= 50 ? '#f85149' : Math.abs(v) >= 20 ? '#d29922' : Math.abs(r) === 0 ? '#8b949e' : '#c9d1d9'};font-weight:${Math.abs(v) >= 50 ? 700 : 400}">${r === 0 ? '0' : sgn(r) + r}%</td>`; };
  t.innerHTML = `<table class="price-table range-table"><thead><tr><th style="text-align:left">이벤트</th><th>유형</th>${keys.map(k => `<th>${sh(k)}</th>`).join('')}</tr></thead><tbody>` +
    rows.map(({ e, r }) => `<tr><td style="white-space:normal;max-width:300px;text-align:left"><b style="color:${e.color}">${e.label}</b><br><small class="val-neutral">${e.date}</small></td><td class="val-neutral">${e.archetype || ''}</td>${keys.map(k => cell(r[k])).join('')}</tr>`).join('') + '</tbody></table>';
  // 요약 수치
  const avg = k => { const v = rows.map(x => x.r[k]).filter(x => x !== null && x > 0); return v.length ? mean(v) : null; };
  const s = document.getElementById('summary-G5');
  if (s) s.innerHTML = `<b>이벤트 10영업일 전 가격 → 이벤트 후 15영업일 내 극값</b>의 변화율(수요파괴형은 최대 하락률). 이벤트 날짜가 고점 당일인 경우가 많아 직전 2주를 기준으로 잡았습니다. 평균적으로 JKM ${sgn(avg('JKM'))}${fmt(avg('JKM'), 0)}%, FEI ${sgn(avg('FEI'))}${fmt(avg('FEI'), 0)}%, Brent ${sgn(avg('Brent'))}${fmt(avg('Brent'), 0)}%. FEI 가 JKM 만큼 뛴 경우는 <b>중동 LPG 공급 자체가 막힌 때</b>(2019 아브카이크, 2026 호르무즈)뿐이고, 유럽 가스·한파·LNG 설비 사고에는 FEI 가 거의 반응하지 않습니다.`;
}

// 상관 기간 토글
export function setCorrHorizon(h) { horizon = h; renderCorr(); }
