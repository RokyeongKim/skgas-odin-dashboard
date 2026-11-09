// js/panelBrief.js — Panel A-1: 지금 시장 읽기 (다년도 통계 기반 규칙형 자동 해석)
//  - 기준구간 통계로 지표별 z-score·백분위·역대 극값 대비 위치를 계산해 한국어 해석문을 생성
//  - 국면(Regime) 분류: 어떤 지표군이 분포 밖으로 벗어났는지의 패턴으로 판별
//  - 과거 극단기(코로나 저점 / '22 전쟁 고점 / '26 전쟁 고점)와 현재값 비교표
//  ※ 규칙 기반 문장 생성이며 원인 해석(이벤트)은 Panel F 의 플래그를 참조

import { NATIVE_META, CONVERSION, REGIMES } from './config.js';
import { getTimeseries } from './data.js';
import { getBaselines, baselineRecords, statsFor, seriesPosition, regimeExtreme, fmtNum, digitsOf, STATUS_LABEL, STATUS_COLOR } from './stats.js';

let curBase = 'all';
let contentEl = null, selEl = null;

const CORE_KEYS = ['Brent', 'FEI', 'CP', 'MB', 'C2', 'ARA_C3', 'MOPJ', 'FO380', 'JKM', 'FRT_BALTIC'];
const TABLE_KEYS = ['Brent', 'WTI', 'FEI', 'FEI_C4', 'CP', 'MB', 'MB_nC4', 'C2', 'ARA_C3', 'MOPJ', 'FO380', 'JKM', 'FRT_BALTIC'];

export function initPanelBrief({ content, select }) {
  contentEl = content; selEl = select;
  getBaselines().forEach(b => {
    const o = document.createElement('option'); o.value = b.id; o.textContent = b.label;
    if (b.id === curBase) o.selected = true;
    selEl.appendChild(o);
  });
  selEl.addEventListener('change', e => { curBase = e.target.value; renderPanelBrief(); });
}

// ── 유틸 ────────────────────────────────────────────────────────────────────
const sgn = v => (v >= 0 ? '+' : '');
const z1 = z => `${sgn(z)}${z.toFixed(1)}σ`;
const pctTxt = v => `${sgn(v)}${v.toFixed(1)}%`;
const col = s => STATUS_COLOR[s] || '#8b949e';
function badge(status) { return `<span class="status-badge" style="background:${col(status)}22;color:${col(status)}">${STATUS_LABEL[status]}</span>`; }
function em(txt, c = '#e6edf3') { return `<b style="color:${c}">${txt}</b>`; }

/** 분포 내 위치 설명: 상단/하단, 평시/주의/이례/극단 */
function posWord(z) {
  const a = Math.abs(z);
  const side = z >= 0 ? '상단' : '하단';
  if (a < 1) return '평시 범위';
  if (a < 2) return `주의 (${side})`;
  if (a < 3) return `이례적 (${side})`;
  return `극단 (${side}, 분포 밖)`;
}

/** 지표 한 줄 */
function keyLine(key, st, { withExtreme = true } = {}) {
  if (!st || !st.current) return `${NATIVE_META[key].label}: 데이터 없음`;
  const m = NATIVE_META[key], d = m.digits;
  let s = `${em(m.label, m.color)} ${em(fmtNum(st.current.value, d))} ${m.unit} — 기준구간 백분위 P${st.pct}, z ${em(z1(st.z), col(st.status))} ${badge(st.status)}`;
  if (st.change60 !== null && st.change60 !== undefined) s += `, 최근 60영업일 ${pctTxt(st.change60)}`;
  if (withExtreme && st.maxRec && st.minRec) {
    if (st.z >= 1.5) {
      const ratio = st.current.value / st.maxRec.value * 100;
      s += ratio >= 100
        ? `. ${em('기준구간 최고치 경신', '#f85149')} (종전 ${fmtNum(st.maxRec.value, d)}, ${st.maxRec.date})`
        : `. 기준구간 최고 ${fmtNum(st.maxRec.value, d)}(${st.maxRec.date}) 대비 ${ratio.toFixed(0)}%`;
    } else if (st.z <= -1.5) {
      s += `. 기준구간 최저 ${fmtNum(st.minRec.value, d)}(${st.minRec.date}) 대비 ${(st.current.value / st.minRec.value * 100).toFixed(0)}%`;
    }
  }
  return s + '.';
}

/** 파생 시계열(스프레드·비율)의 위치 */
function derivedPos(fn) {
  const recs = baselineRecords(curBase);
  const vals = recs.map(fn), dates = recs.map(r => r.date);
  return seriesPosition(vals, dates);
}
function spreadLine(label, unit, pos, d, hiTxt, loTxt) {
  if (!pos) return '';
  let s = `${em(label)} ${fmtNum(pos.current.value, d)} ${unit} (기준구간 P${pos.pct}, z ${z1(pos.z)})`;
  if (pos.pct >= 90) s += ` → ${em(hiTxt, '#f85149')}`;
  else if (pos.pct <= 10) s += ` → ${em(loTxt, '#58a6ff')}`;
  else s += ' → 통상 범위';
  return s + '.';
}

// ── 국면(Regime) 분류 ────────────────────────────────────────────────────────
function classifyRegime(S) {
  const z = k => S[k]?.z ?? 0;
  const core = CORE_KEYS.map(k => S[k]?.z).filter(v => v !== null && v !== undefined);
  const meanZ = core.reduce((a, b) => a + b, 0) / Math.max(1, core.length);
  const ext = CORE_KEYS.filter(k => Math.abs(S[k]?.z ?? 0) >= 2);
  if (meanZ <= -1 && z('Brent') <= -1 && z('JKM') <= -1)
    return { name: '수요 위축형 (2020년 코로나형)', color: '#58a6ff',
      why: '유가·LNG·LPG가 동반해 분포 하단으로 밀린 패턴. 가격 수준보다 수요 회복 신호(운임·스프레드 반등)를 먼저 봐야 하는 국면.' };
  if (z('Brent') >= 2 && z('JKM') >= 2 && z('FEI') >= 2)
    return { name: '에너지 전반 급등형 (2022년 우크라이나형)', color: '#f85149',
      why: '유가·가스·LPG가 모두 분포 상단 밖. 특정 품목의 수급보다 거시·지정학 프리미엄이 전 에너지에 얹힌 국면.' };
  if ((z('FEI') >= 2 || z('FRT_BALTIC') >= 2) && z('Brent') < 2)
    return { name: '공급·물류 병목형 (아시아 LPG 현물·운임 주도)', color: '#f0a500',
      why: '유가는 분포 안인데 아시아 LPG 현물과 운임만 분포 밖. 해상 물류·항로 차질이 가격을 끌고 가는 국면으로, 유가 되돌림만으로는 해소되지 않음.' };
  if (ext.length === 0 && Math.abs(meanZ) < 1)
    return { name: '평시', color: '#3fb950', why: '모든 핵심 지표가 기준구간 ±2σ 안. 상대가(CV·NV·FEI/MOPJ) 기준으로 평상시 옵셔널리티 판단 적용.' };
  return { name: '혼조 (지표군별 방향 상이)', color: '#d29922',
    why: `일부 지표만 분포 밖(${ext.map(k => NATIVE_META[k].label).join(', ') || '없음'}). 지표군별 해석을 개별 확인.` };
}

// ── 메인 렌더 ────────────────────────────────────────────────────────────────
export function renderPanelBrief() {
  if (!contentEl) return;
  const all = getTimeseries() || [];
  if (!all.length) return;
  const base = baselineRecords(curBase);
  const baseLabel = getBaselines().find(b => b.id === curBase)?.label || '';
  const years = new Set(base.map(r => r.date.slice(0, 4))).size;
  const last = all[all.length - 1];

  const S = {};
  Object.keys(NATIVE_META).forEach(k => { S[k] = statsFor(k, curBase); });
  const withZ = Object.values(S).filter(s => s && s.z !== null);
  const ext = withZ.filter(s => s.status === 'extreme'), watch = withZ.filter(s => s.status === 'watch'), norm = withZ.filter(s => s.status === 'normal');
  const top = [...withZ].sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 3);
  const regime = classifyRegime(S);

  // 파생 지표 위치
  const feiCp   = derivedPos(r => r.derived?.FEI_CP ?? null);
  const feiAra  = derivedPos(r => (r.native.FEI !== null && r.native.ARA_C3 !== null && r.native.FEI !== undefined && r.native.ARA_C3 !== undefined) ? r.native.FEI - r.native.ARA_C3 : null);
  const tetPrem = derivedPos(r => r.derived?.MB_TET_PREM ?? null);
  const cv      = derivedPos(r => r.derived?.CV ?? null);
  const nv      = derivedPos(r => r.derived?.NV ?? null);
  const feiMopj = derivedPos(r => r.derived?.FEI_MOPJ ?? null);
  const jkmFei  = derivedPos(r => r.derived?.JKM_FEI_M2 ?? null);
  const c4c3    = derivedPos(r => r.derived?.FEI_C4_C3 ?? null);
  const brentWti= derivedPos(r => (r.native.Brent !== null && r.native.WTI !== null && r.native.Brent !== undefined && r.native.WTI !== undefined) ? r.native.Brent - r.native.WTI : null);

  // ── 1. 헤드라인 ──
  const topTxt = top.map(s => `${NATIVE_META[s.key].label} ${z1(s.z)}`).join(', ');
  const normTxt = norm.slice(0, 6).map(s => NATIVE_META[s.key].label).join(', ');
  let html = `<div class="brief-head">
    <div class="brief-meta">기준일 ${em(last.date)} · 통계 기준구간 ${em(baseLabel)} (${years}개년, ${base.length.toLocaleString()} 관측일) · 전체 데이터 ${all[0].date} ~ ${last.date}</div>
    <div class="brief-regime" style="border-color:${regime.color}"><span class="brief-regime-tag" style="background:${regime.color}">현재 국면</span> <b style="color:${regime.color}">${regime.name}</b><div class="brief-regime-why">${regime.why}</div></div>
    <p>${withZ.length}개 지표 중 ${em(ext.length + '개 이례적', '#f85149')}(|z|≥2), ${em(watch.length + '개 주의', '#d29922')}, ${em(norm.length + '개 평시 범위', '#3fb950')}.
      가장 크게 벗어난 지표는 ${em(topTxt)}${normTxt ? `, 반대로 ${normTxt}${norm.length > 6 ? ' 등' : ''}은 평시 범위 안입니다` : ''}.</p>
  </div>`;

  // ── 2. 지표군별 해석 ──
  const groups = [];
  groups.push({ title: '유가 (Brent · WTI)', color: '#ff6b6b', lines: [
    keyLine('Brent', S.Brent), keyLine('WTI', S.WTI, { withExtreme: false }),
    spreadLine('Brent−WTI', '$/bbl', brentWti, 2, '미국 원유·NGL 수출 유인 극대 → MB 약세 압력', '미국 내 타이트 → MB 강세 요인'),
  ]});
  const cvTxt = cv ? (cv.current.value < CONVERSION.CV_SOURCING_TARGET ? em(`CV ${(cv.current.value * 100).toFixed(1)}% → 소싱 적정(90% 미만)`, '#3fb950')
    : cv.current.value >= CONVERSION.CV_SOURCING_TARGET + CONVERSION.CV_UNWIND_PREMIUM ? em(`CV ${(cv.current.value * 100).toFixed(1)}% → Unwind 검토 구간(95% 이상)`, '#f85149')
    : em(`CV ${(cv.current.value * 100).toFixed(1)}% → 관찰 구간`, '#d29922')) : '';
  groups.push({ title: '아시아 LPG 현물 (FEI · CP)', color: '#00d4ff', lines: [
    keyLine('FEI', S.FEI), keyLine('CP', S.CP),
    spreadLine('FEI−CP', '$/ton', feiCp, 0, '중동 계약가 대비 현물 프리미엄이 역대 상위 → 현물 조달 불리, 계약물량 가치 상승', '현물이 계약가 아래 → 현물 조달 유리'),
    spreadLine('FEI C4−C3', '$/ton', c4c3, 0, '부탄 프리미엄 상위 → 석화·블렌딩 부탄 수요 강세', '부탄 할인 → 부탄 수요 약세'),
    cvTxt ? `${cvTxt} (기준구간 CV 백분위 P${cv.pct}).` : '',
  ]});
  const nvTxt = nv ? (nv.current.value <= 0.385 ? em(`NV ${(nv.current.value * 100).toFixed(1)}% → 경쟁력 있는 조달(38.5% 이하)`, '#3fb950') : em(`NV ${(nv.current.value * 100).toFixed(1)}% → 조달 경쟁력 낮음(38.5% 초과)`, '#d29922')) : '';
  groups.push({ title: '미주 LPG (Mont Belvieu)', color: '#f0a500', lines: [
    keyLine('MB', S.MB), keyLine('MB_nC4', S.MB_nC4, { withExtreme: false }), keyLine('C2', S.C2, { withExtreme: false }),
    spreadLine('TET−non-TET 프리미엄', '¢/gal', tetPrem, 2, '수출터미널·저장 병목 신호(수출 호조)', '수출 유인 약화'),
    nvTxt ? `${nvTxt} (기준구간 NV 백분위 P${nv.pct}).` : '',
  ]});
  groups.push({ title: '유럽 LPG (ARA)', color: '#2dd4bf', lines: [
    keyLine('ARA_C3', S.ARA_C3),
    spreadLine('FEI−ARA (아시아 프리미엄)', '$/ton', feiAra, 0, '아시아 프리미엄 극대 → 대서양 화물이 아시아로 유입될 유인', '유럽 우위 → 아시아 공급 조임 가능'),
  ]});
  const fmTxt = feiMopj ? (feiMopj.current.value < 0.85 ? em(`FEI/MOPJ ${(feiMopj.current.value * 100).toFixed(1)}% → 석화 LPG 대체투입 유리(소싱)`, '#3fb950')
    : feiMopj.current.value > 0.90 ? em(`FEI/MOPJ ${(feiMopj.current.value * 100).toFixed(1)}% → LPG가 납사보다 비쌈(판매·Tolerance 활용)`, '#f85149')
    : em(`FEI/MOPJ ${(feiMopj.current.value * 100).toFixed(1)}% → 중립(85~90%)`, '#d29922')) : '';
  groups.push({ title: '석화 원료 (MOPJ 납사)', color: '#c77dff', lines: [
    keyLine('MOPJ', S.MOPJ), fmTxt ? `${fmTxt} (기준구간 백분위 P${feiMopj.pct}).` : '',
  ]});
  groups.push({ title: 'LNG (JKM)', color: '#4ade80', lines: [
    keyLine('JKM', S.JKM),
    jkmFei ? `${em('JKM − FEI(M−2)')} ${fmtNum(jkmFei.current.value, 2)} $/mmbtu (P${jkmFei.pct}) → ${jkmFei.current.value > 0 ? 'LNG가 LPG보다 비쌈 → LPG 대체 유리' : 'LNG가 LPG보다 쌈 → LPG 대체 불리'}.` : '',
  ]});
  groups.push({ title: '연료유 · 운임', color: '#60a5fa', lines: [
    keyLine('FO380', S.FO380), keyLine('FRT_BALTIC', S.FRT_BALTIC), keyLine('FRT_RIM', S.FRT_RIM, { withExtreme: false }),
  ]});

  html += `<div class="brief-grid">` + groups.map(g => `
    <div class="brief-card" style="border-top-color:${g.color}">
      <div class="brief-card-title" style="color:${g.color}">${g.title}</div>
      <ul>${g.lines.filter(Boolean).map(l => `<li>${l}</li>`).join('')}</ul>
    </div>`).join('') + `</div>`;

  // ── 3. 과거 극단기 비교표 ──
  const regimes = REGIMES.filter(g => all.some(r => r.date >= g.from && r.date <= g.to));
  html += `<div class="brief-table-wrap"><div class="brief-sub">과거 극단기 vs 현재 (각 국면 구간 내 ${REGIMES.some(g=>g.kind==='trough') ? '저점/고점' : '고점'} · 전체기간 최고·최저)</div>
    <table class="price-table range-table"><thead><tr><th>지표</th><th>현재 (${last.date})</th>${regimes.map(g => `<th>${g.short}</th>`).join('')}<th>전체 최고</th><th>전체 최저</th><th>현재/전체최고</th></tr></thead><tbody>`;
  TABLE_KEYS.forEach(k => {
    const m = NATIVE_META[k], d = m.digits;
    const all_st = statsFor(k, 'all');
    const cur = all_st?.current;
    const cells = regimes.map(g => {
      const e = regimeExtreme(k, g);
      return `<td>${e ? `${fmtNum(e.value, d)}<br><small class="val-neutral">${e.date}</small>` : '—'}</td>`;
    }).join('');
    const ratio = (cur && all_st?.maxRec) ? cur.value / all_st.maxRec.value * 100 : null;
    const rc = ratio === null ? '#8b949e' : ratio >= 100 ? '#f85149' : ratio >= 85 ? '#d29922' : '#8b949e';
    html += `<tr><td style="color:${m.color};font-weight:600" data-tip-key="${k}">${m.label} <span class="tip-mark">ⓘ</span><br><small class="val-neutral">${m.unit}</small></td>
      <td><b>${fmtNum(cur?.value, d)}</b></td>${cells}
      <td>${all_st?.maxRec ? `${fmtNum(all_st.maxRec.value, d)}<br><small class="val-neutral">${all_st.maxRec.date}</small>` : '—'}</td>
      <td>${all_st?.minRec ? `${fmtNum(all_st.minRec.value, d)}<br><small class="val-neutral">${all_st.minRec.date}</small>` : '—'}</td>
      <td style="color:${rc};font-weight:600">${ratio === null ? '—' : ratio.toFixed(0) + '%'}${ratio !== null && ratio >= 100 ? ' ★' : ''}</td></tr>`;
  });
  html += `</tbody></table></div>`;

  // ── 4. 읽는 법 ──
  html += `<details class="brief-guide"><summary>이 해석을 읽는 법</summary>
    <ul>
      <li><b>z-score</b> = (현재값 − 기준구간 평균) ÷ 표준편차. |z| &lt; 1 평시 범위(약 68%), 1~2 주의, ≥ 2 이례적(정규분포 가정 시 상·하위 각 2.3%). 가격 분포는 정규분포가 아니므로 <b>백분위(P)</b>와 함께 봅니다.</li>
      <li><b>기준구간 선택이 결론을 바꿉니다.</b> 2026년만 기준으로 보면 유가·아시아 LPG는 "정상"이지만, 2019년부터의 전체 분포로 보면 다른 그림이 됩니다. 평시 잣대는 "개전 전", 위기 간 비교는 "2022년"·"코로나"를 선택하세요.</li>
      <li><b>국면 분류</b>는 어떤 지표군이 분포 밖으로 나갔는지의 조합으로 판별합니다: 전 에너지 동반 급등(2022년형) / 아시아 LPG 현물·운임만 급등(물류 병목형) / 전 지표 하단(2020년형).</li>
      <li>원인(이벤트)은 자동 판별하지 않습니다. 상단 Panel A 플래그와 Panel F 라이브러리로 확인하세요.</li>
    </ul></details>`;

  contentEl.innerHTML = html;
}
