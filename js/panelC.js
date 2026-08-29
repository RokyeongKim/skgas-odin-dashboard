// js/panelC.js — Panel C: 상대가 시계열 (CV, NV, FEI/MOPJ, JKM vs FEI(M-2))
// 개별 index 토글 + 지표별 소싱/판매 기준선 (사용자 가이드 기반)

import { RELATIVE_PAIRS, EVENTS } from './config.js';

let chart = null;
let _currentTab = 'buy';
let _lastRecords = [];
// 각 pair id의 visible 상태 (기본 전체 on)
const visibleSet = new Set(RELATIVE_PAIRS.map(p => p.id));

export function initPanelC(dom) {
  chart = echarts.init(dom, 'dark');
}

export function renderPanelC(records, tab) {
  _currentTab = tab || _currentTab;
  _lastRecords = records || _lastRecords;
  if (!chart || !_lastRecords.length) return;

  const dates = _lastRecords.map(r => r.date);
  const pairsInTab = RELATIVE_PAIRS.filter(p => p.group === _currentTab);
  const visiblePairs = pairsInTab.filter(p => visibleSet.has(p.id));

  // Event 수직선 (기존과 동일)
  const eventMarkLineData = EVENTS.map(ev => ([
    { xAxis: ev.date, lineStyle: { color: ev.color, type: 'dashed', width: 1 }, label: { show: false } },
    { xAxis: ev.date },
  ]));

  const series = pairsInTab.map((p, idx) => {
    const vals = _lastRecords.map(r => r.derived[p.id] ?? null);
    const isVisible = visibleSet.has(p.id);

    const s = {
      name: p.label,
      type: 'line',
      data: vals,
      showSymbol: false,
      lineStyle: {
        width: isVisible ? 2 : 0,
        color: p.color,
        opacity: isVisible ? 1 : 0,
      },
      itemStyle: { color: p.color },
    };

    // 이벤트 markLine은 첫 시리즈에만 부착
    const markLines = idx === 0 ? [...eventMarkLineData] : [];

    // 지표별 기준선: 해당 지표가 visible일 때만 표시
    if (isVisible && p.thresholds && p.thresholds.length) {
      p.thresholds.forEach(t => {
        markLines.push([
          {
            yAxis: t.value,
            lineStyle: { color: t.color, type: t.style || 'dashed', width: 1.5 },
            label: {
              show: true,
              position: 'insideEndTop',
              formatter: t.label,
              color: t.color,
              fontSize: 10,
              fontWeight: 600,
            },
          },
          { yAxis: t.value },
        ]);
      });
    }

    if (markLines.length) {
      s.markLine = { symbol: 'none', data: markLines, silent: true };
    }
    return s;
  });

  // 안내 문구: visible한 pair들의 note 표시
  const noteEl = document.getElementById('panel-C-note');
  if (noteEl) {
    const notes = visiblePairs
      .filter(p => p.note)
      .map(p => `<b style="color:${p.color}">● ${p.label}</b> ${p.note}`)
      .join(' &nbsp;|&nbsp; ');
    noteEl.innerHTML = notes || '&nbsp;';
    noteEl.style.display = notes ? '' : 'none';
  }

  const isBuy = _currentTab === 'buy';
  chart.setOption({
    backgroundColor: 'transparent',
    legend: { show: false },
    tooltip: {
      trigger: 'axis',
      formatter(params) {
        let html = `<div style="font-size:11px"><b>${params[0]?.axisValue}</b>`;
        params.forEach(p => {
          if (p.data !== null && p.data !== undefined && visibleSet.has(pairsInTab[p.seriesIndex]?.id)) {
            const val = isBuy ? `${(p.data * 100).toFixed(1)}%` : `$${Number(p.data).toFixed(2)}`;
            html += `<br/><span style="color:${p.color}">●</span> ${p.seriesName}: <b>${val}</b>`;
          }
        });
        return html + '</div>';
      },
    },
    grid: { left: 65, right: 30, top: 30, bottom: 55 },
    xAxis: {
      type: 'category', data: dates, boundaryGap: false,
      axisLabel: { color: '#8b949e', fontSize: 10 },
      axisLine: { lineStyle: { color: '#30363d' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      ...computeYAxisRange(visiblePairs, _lastRecords, isBuy),
      axisLabel: {
        color: '#8b949e', fontSize: 10,
        formatter: isBuy ? v => `${(v * 100).toFixed(0)}%` : v => `$${v.toFixed(2)}`,
      },
      splitLine: { lineStyle: { color: '#1e2430', type: 'dashed' } },
    },
    series,
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      {
        type: 'slider',
        bottom: 2,
        height: 18,
        borderColor: '#30363d',
        fillerColor: 'rgba(0,212,255,0.1)',
        handleStyle: { color: '#00d4ff' },
      },
    ],
  }, true);
}

/**
 * 표시 중인 pair들의 실제 값 + 기준선을 감싸는 최소 y축 범위 계산.
 * 하나만 보일 때는 그 범위에 딱 맞춰서 등락을 크게 보이게 함.
 * - Buy 탭(비율): 5%p padding, 5% 단위로 rounding
 * - Sell 탭($): 10% padding, 소수점 유지
 */
function computeYAxisRange(visiblePairs, records, isBuy) {
  if (!visiblePairs.length || !records.length) return {};

  const allVals = [];
  visiblePairs.forEach(p => {
    records.forEach(r => {
      const v = r.derived[p.id];
      if (v !== null && v !== undefined && isFinite(v)) allVals.push(v);
    });
    // 기준선도 범위에 포함시켜서 잘리지 않게
    (p.thresholds || []).forEach(t => allVals.push(t.value));
  });

  if (!allVals.length) return {};

  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const span = rawMax - rawMin;

  if (isBuy) {
    // 비율: 5%p padding, 0.05 단위로 내림/올림
    const pad = Math.max(0.03, span * 0.15);
    const min = Math.floor((rawMin - pad) * 20) / 20; // 0.05 단위
    const max = Math.ceil((rawMax + pad) * 20) / 20;
    return { min, max };
  } else {
    // $: 10% padding
    const pad = Math.max(0.2, span * 0.15);
    const min = Math.floor((rawMin - pad) * 10) / 10;
    const max = Math.ceil((rawMax + pad) * 10) / 10;
    return { min, max };
  }
}

/** 특정 상대가 pair의 표시 여부 토글 */
export function togglePair(pairId, visible) {
  if (visible) visibleSet.add(pairId);
  else visibleSet.delete(pairId);
  renderPanelC(_lastRecords, _currentTab);
}

/** 현재 탭에서 visible한 pair id들 */
export function getVisiblePairs() {
  return RELATIVE_PAIRS.filter(p => p.group === _currentTab && visibleSet.has(p.id)).map(p => p.id);
}

export function resizePanelC() { chart?.resize(); }
