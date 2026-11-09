// js/panelA2.js — Panel A-2: 지표별 Native 단위 가격 Range · 이상치(z-score) 기준
//  - 선택 지표의 시계열 + 기준구간 평균, ±1σ 밴드(정상범위), ±2σ 선(이례 기준), P5/P95
//  - 일간 변동률이 기준구간 일간변동 σ의 2배를 넘는 날은 ◆ 스파이크 마커로 표시
//  - 하단 표: 전 지표 Range 요약 (행 클릭 → 차트 지표 전환)

import { NATIVE_META } from './config.js';
import { percentileRank } from './data.js';
import { getBaselines, baselineRecords as _baselineRecords, statsFor as _statsFor, STATUS_LABEL, STATUS_COLOR } from './stats.js';
import { descText, descHtml } from './glossary.js';

let chart = null;
let curKey = 'FEI';
let curBase = 'all';
let _records = [];      // 현재 기간 필터 적용 레코드 (차트 표시 구간)
let tableEl = null, selEl = null, baseEl = null, summaryEl = null;

export function initPanelA2({ chartDom, select, baseline, table, summary }) {
  chart = echarts.init(chartDom, 'dark');
  selEl = select; baseEl = baseline; tableEl = table; summaryEl = summary;

  // 지표 선택 (그룹별 optgroup)
  const groups = {};
  Object.entries(NATIVE_META).forEach(([k, m]) => { (groups[m.group] ||= []).push([k, m]); });
  Object.entries(groups).forEach(([g, items]) => {
    const og = document.createElement('optgroup'); og.label = g;
    items.forEach(([k, m]) => {
      const o = document.createElement('option'); o.value = k; o.textContent = `${m.label} (${m.unit})`; o.title = descText(k);
      if (k === curKey) o.selected = true;
      og.appendChild(o);
    });
    selEl.appendChild(og);
  });
  selEl.addEventListener('change', e => { curKey = e.target.value; renderChart(); highlightRow(); });

  getBaselines().forEach(b => {
    const o = document.createElement('option'); o.value = b.id; o.textContent = b.label;
    if (b.id === curBase) o.selected = true;
    baseEl.appendChild(o);
  });
  baseEl.addEventListener('change', e => { curBase = e.target.value; renderChart(); renderTable(); });
}

function baselineRecords() { return _baselineRecords(curBase); }

/** 지표 하나의 통계 묶음 (현재 기준구간) */
export function statsFor(key) { return _statsFor(key, curBase); }


export function renderPanelA2(records) {
  _records = records || [];
  renderChart();
  renderTable();
}

function fmt(v, d) { return (v === null || v === undefined) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }

function renderChart() {
  if (!chart || !_records.length) return;
  const meta = NATIVE_META[curKey];
  const st = statsFor(curKey);
  const dates = _records.map(r => r.date);
  const vals  = _records.map(r => r.native[curKey] ?? null);
  const d = meta.digits;

  // 스파이크: 일간 변동률 |Δ%| > 2σ(일간, 기준구간)
  const spikes = [];
  if (st?.daily) {
    const thr = 2 * st.daily.std;
    let prev = null;
    _records.forEach(r => {
      const v = r.native[curKey];
      if (v === null || v === undefined) { prev = null; return; }
      if (prev !== null && prev !== 0) {
        const chg = (v - prev) / prev * 100;
        if (Math.abs(chg) > thr) spikes.push({ value: [r.date, v], chg });
      }
      prev = v;
    });
  }

  const baseLabel = getBaselines().find(b => b.id === curBase)?.label || '';
  const markLine = st ? {
    symbol: 'none', silent: true,
    data: [
      { yAxis: st.mean,             name: '평균',  lineStyle: { color: '#e6edf3', type: 'solid',  width: 1 },  label: { formatter: `μ ${fmt(st.mean, d)}`, color: '#e6edf3', fontSize: 10, position: 'insideEndTop' } },
      { yAxis: st.mean + 2 * st.std, name: '+2σ', lineStyle: { color: '#f85149', type: 'dashed', width: 1 },  label: { formatter: `+2σ ${fmt(st.mean + 2 * st.std, d)}`, color: '#f85149', fontSize: 10, position: 'insideEndTop' } },
      { yAxis: st.mean - 2 * st.std, name: '−2σ', lineStyle: { color: '#58a6ff', type: 'dashed', width: 1 },  label: { formatter: `−2σ ${fmt(st.mean - 2 * st.std, d)}`, color: '#58a6ff', fontSize: 10, position: 'insideEndBottom' } },
      { yAxis: st.p95, name: 'P95', lineStyle: { color: '#f85149', type: 'dotted', width: 1, opacity: 0.6 }, label: { formatter: `P95 ${fmt(st.p95, d)}`, color: '#f8514999', fontSize: 9, position: 'insideStartTop' } },
      { yAxis: st.p5,  name: 'P5',  lineStyle: { color: '#58a6ff', type: 'dotted', width: 1, opacity: 0.6 }, label: { formatter: `P5 ${fmt(st.p5, d)}`,  color: '#58a6ff99', fontSize: 9, position: 'insideStartBottom' } },
    ],
  } : undefined;
  const markArea = st ? {
    silent: true,
    data: [[{ yAxis: st.mean - st.std, itemStyle: { color: `${meta.color}1f` }, label: { show: true, position: 'insideTopLeft', formatter: `정상범위 μ±1σ  (${fmt(st.mean - st.std, d)} ~ ${fmt(st.mean + st.std, d)})`, color: meta.color, fontSize: 10 } }, { yAxis: st.mean + st.std }]],
  } : undefined;

  chart.setOption({
    backgroundColor: 'transparent',
    title: {
      text: `${meta.label}  ·  단위 ${meta.unit}  ·  기준구간: ${baseLabel}`,
      left: 10, top: 4, textStyle: { color: '#8b949e', fontSize: 11, fontWeight: 400 },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', lineStyle: { color: '#444' } },
      formatter: params => {
        const p = params.find(x => x.seriesType === 'line');
        if (!p || p.data === null || p.data === undefined) return '';
        const v = Number(p.data);
        const z = st ? (v - st.mean) / st.std : null;
        const sp = spikes.find(s => s.value[0] === p.axisValue);
        let html = `<div style="font-size:11px"><b>${p.axisValue}</b><br/>`;
        html += `<span style="color:${meta.color}">●</span> ${meta.label}: <b>${fmt(v, d)} ${meta.unit}</b>`;
        if (z !== null) {
          const c = Math.abs(z) >= 2 ? '#f85149' : Math.abs(z) >= 1 ? '#d29922' : '#3fb950';
          html += `<br/>z-score: <b style="color:${c}">${z >= 0 ? '+' : ''}${z.toFixed(2)}σ</b> (기준 μ ${fmt(st.mean, d)} / σ ${fmt(st.std, d)})`;
          html += `<br/>기준구간 백분위: ${percentileRank(baselineRecords().map(r => r.native[curKey]), v)}%`;
        }
        if (sp) html += `<br/><span style="color:#f0a500">◆ 일간 스파이크 ${sp.chg >= 0 ? '+' : ''}${sp.chg.toFixed(1)}%</span>`;
        return html + '</div>';
      },
    },
    legend: { show: false },
    grid: { left: 70, right: 30, top: 36, bottom: 50 },
    xAxis: {
      type: 'category', data: dates, boundaryGap: false,
      axisLabel: { color: '#8b949e', fontSize: 10 },
      axisLine: { lineStyle: { color: '#30363d' } }, splitLine: { show: false },
    },
    yAxis: {
      type: 'value', scale: true,
      axisLabel: { color: '#8b949e', fontSize: 10, formatter: v => Number(v).toLocaleString('en-US') },
      splitLine: { lineStyle: { color: '#1e2430', type: 'dashed' } },
    },
    series: [
      {
        name: meta.label, type: 'line', data: vals, showSymbol: false, connectNulls: false,
        lineStyle: { width: 1.8, color: meta.color }, itemStyle: { color: meta.color },
        markLine, markArea, z: 3,
      },
      {
        name: '스파이크', type: 'scatter', data: spikes.map(s => s.value),
        symbol: 'diamond', symbolSize: 9, itemStyle: { color: '#f0a500', borderColor: '#000', borderWidth: 0.5 }, z: 5,
        tooltip: { show: false },
      },
    ],
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', bottom: 2, height: 20, borderColor: '#30363d', fillerColor: 'rgba(0,212,255,0.1)', handleStyle: { color: '#00d4ff' } },
    ],
  }, true);

  // 요약 문장 (+ 지표 설명)
  if (summaryEl && st && st.current) {
    const c = STATUS_COLOR[st.status];
    const desc = descHtml(curKey, { compact: true });
    const dcTxt = st.daily ? `일간 변동 σ ${st.daily.std.toFixed(2)}% → 하루 ±${(2 * st.daily.std).toFixed(1)}% 이상 움직이면 이례적 (기준구간 내 ${spikesCount(st)}회)` : '';
    summaryEl.innerHTML =
      `<b style="color:${meta.color}">${meta.label}</b> 현재 <b>${fmt(st.current.value, d)} ${meta.unit}</b> (${st.current.date}) · ` +
      `z = <b style="color:${c}">${st.z >= 0 ? '+' : ''}${st.z.toFixed(2)}σ</b> <span class="status-badge" style="background:${c}22;color:${c}">${STATUS_LABEL[st.status]}</span> · ` +
      `기준구간 평균 ${fmt(st.mean, d)}, 정상범위(μ±1σ) ${fmt(st.mean - st.std, d)}~${fmt(st.mean + st.std, d)}, ` +
      `이례 기준(μ±2σ) <span style="color:#58a6ff">${fmt(st.mean - 2 * st.std, d)}</span> 미만 / <span style="color:#f85149">${fmt(st.mean + 2 * st.std, d)}</span> 초과 · ` +
      `P5~P95 ${fmt(st.p5, d)}~${fmt(st.p95, d)} · 최소~최대 ${fmt(st.min, d)}~${fmt(st.max, d)}<br/>` +
      `<span style="color:#8b949e">${dcTxt}</span>` +
      (desc ? `<div class="a2-desc">${desc}</div>` : '');
  }
}

function spikesCount(st) {
  if (!st.daily) return 0;
  const thr = 2 * st.daily.std;
  return st.daily.pct.filter(p => Math.abs(p) > thr).length;
}

function renderTable() {
  if (!tableEl) return;
  const rows = Object.keys(NATIVE_META).map(k => ({ meta: NATIVE_META[k], st: statsFor(k) }));
  let html = `<table class="price-table range-table"><thead><tr>
    <th>지표</th><th>단위</th><th>현재 (기준일)</th><th>z-score</th><th>상태</th>
    <th>평균 μ</th><th>σ</th><th>정상범위<br><small>μ±1σ</small></th><th>이례 기준<br><small>μ±2σ 밖</small></th>
    <th>P5 ~ P95</th><th>최소 ~ 최대</th><th>일간변동 σ</th><th>일간 이례<br><small>|Δ|&gt;2σ</small></th><th>n</th></tr></thead><tbody>`;
  rows.forEach(({ meta, st }) => {
    const key = st?.key || '';
    const d = meta.digits;
    const sel = key === curKey ? ' selected' : '';
    if (!st) { html += `<tr class="range-row${sel}" data-key="${key}"><td style="color:${meta.color}">${meta.label}</td><td>${meta.unit}</td><td colspan="12" class="val-neutral">데이터 부족</td></tr>`; return; }
    const c = STATUS_COLOR[st.status] || '#8b949e';
    const dc = st.daily;
    html += `<tr class="range-row${sel}" data-key="${key}">
      <td style="color:${meta.color};font-weight:600" data-tip-key="${key}">${meta.label} <span class="tip-mark">ⓘ</span></td>
      <td class="val-neutral">${meta.unit}</td>
      <td><b>${fmt(st.current?.value, d)}</b><br><small class="val-neutral">${st.current?.date || ''}</small></td>
      <td style="color:${c};font-weight:600">${st.z >= 0 ? '+' : ''}${st.z.toFixed(2)}σ<br><small class="val-neutral">${st.pct}%ile</small></td>
      <td><span class="status-badge" style="background:${c}22;color:${c}">${STATUS_LABEL[st.status]}</span></td>
      <td>${fmt(st.mean, d)}</td>
      <td>${fmt(st.std, d)}</td>
      <td>${fmt(st.mean - st.std, d)} ~ ${fmt(st.mean + st.std, d)}</td>
      <td><span style="color:#58a6ff">&lt; ${fmt(st.mean - 2 * st.std, d)}</span><br><span style="color:#f85149">&gt; ${fmt(st.mean + 2 * st.std, d)}</span></td>
      <td>${fmt(st.p5, d)} ~ ${fmt(st.p95, d)}</td>
      <td>${fmt(st.min, d)} ~ ${fmt(st.max, d)}</td>
      <td>${dc ? dc.std.toFixed(2) + '%' : '—'}</td>
      <td>${dc ? '±' + (2 * dc.std).toFixed(1) + '%<br><small class="val-neutral">' + spikesCount(st) + '회</small>' : '—'}</td>
      <td class="val-neutral">${st.n}</td></tr>`;
  });
  html += '</tbody></table>';
  tableEl.innerHTML = html;
  tableEl.querySelectorAll('.range-row').forEach(tr => tr.addEventListener('click', () => {
    curKey = tr.dataset.key; selEl.value = curKey; renderChart(); highlightRow();
    chart?.getDom()?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }));
}

function highlightRow() {
  tableEl?.querySelectorAll('.range-row').forEach(tr => tr.classList.toggle('selected', tr.dataset.key === curKey));
}

export function resizePanelA2() { chart?.resize(); }
