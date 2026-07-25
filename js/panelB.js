// js/panelB.js — Panel B: JKM-FEI Spread (기준월별 원월 시계열)
// forward_spreads.json의 계약월별 JKM-FEI spread를 관측일 시계열로 표시

let chart = null;
let forwardData = null;

export function initPanelB(dom) {
  chart = echarts.init(dom, 'dark');
}

export async function loadForwardData() {
  const resp = await fetch('./data/forward_spreads.json');
  forwardData = await resp.json();
  return forwardData;
}

export function getForwardMonths() {
  return forwardData ? Object.keys(forwardData).sort() : [];
}

export function renderPanelB(monthKey) {
  if (!chart || !forwardData) return;
  const entry = forwardData[monthKey];
  if (!entry) return;

  const { series, stats } = entry;
  const dates = series.map(p => p.date);
  const vals  = series.map(p => (p.jkmFei !== undefined ? p.jkmFei : null));
  const { mean, std } = stats;
  const upper = +(mean + std).toFixed(3);
  const lower = +(mean - std).toFixed(3);

  // Badge: 현재값 + z-score + percentile
  const curVal = vals[vals.length - 1];
  const zScore = std > 0 ? (curVal - mean) / std : null;
  const sorted = [...vals].filter(v => v !== null).sort((a, b) => a - b);
  const pct = curVal !== null && sorted.length > 0
    ? Math.round(sorted.filter(v => v <= curVal).length / sorted.length * 100)
    : null;

  const badge = document.getElementById('spread-pct');
  if (badge && zScore !== null && pct !== null) {
    const zSign = zScore >= 0 ? '+' : '';
    badge.textContent = `현재 $${curVal.toFixed(3)} (${zSign}${zScore.toFixed(2)}σ, ${pct}%ile)`;
  }

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      formatter(params) {
        const sp = params.find(p => p.seriesName === 'JKM-FEI');
        if (!sp || sp.data === null) return `<b>${params[0]?.axisValue}</b>: —`;
        const v = sp.data;
        const z = std > 0 ? ((v - mean) / std).toFixed(2) : '—';
        const zSign = Number(z) >= 0 ? '+' : '';
        return `<div style="font-size:11px">
          <b>${sp.axisValue}</b><br/>
          <span style="color:#00d4ff">●</span> JKM−FEI: <b>$${v.toFixed(3)}</b><br/>
          z-score: ${zSign}${z}σ
        </div>`;
      },
    },
    legend: { show: false },
    grid: { left: 60, right: 20, top: 30, bottom: 40 },
    xAxis: {
      type: 'category', data: dates, boundaryGap: false,
      axisLabel: { color: '#8b949e', fontSize: 10 },
      axisLine: { lineStyle: { color: '#30363d' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: '$/mmbtu',
      nameTextStyle: { color: '#8b949e', fontSize: 10 },
      axisLabel: { color: '#8b949e', fontSize: 10, formatter: v => `$${v.toFixed(1)}` },
      splitLine: { lineStyle: { color: '#1e2430', type: 'dashed' } },
    },
    series: [
      {
        name: 'JKM-FEI',
        type: 'line',
        data: vals,
        showSymbol: false,
        lineStyle: { color: '#00d4ff', width: 2 },
        itemStyle: { color: '#00d4ff' },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            {
              yAxis: mean,
              lineStyle: { color: '#8b949e', type: 'dashed', width: 1 },
              label: {
                formatter: `평균 $${mean.toFixed(2)}`,
                color: '#8b949e', fontSize: 9, position: 'insideEndTop',
              },
            },
            {
              yAxis: 0,
              lineStyle: { color: 'rgba(255,255,255,0.18)', type: 'solid', width: 1 },
              label: { formatter: '$0', color: '#555', fontSize: 9, position: 'insideEndTop' },
            },
          ],
        },
        markArea: {
          silent: true,
          data: [[
            {
              yAxis: lower,
              itemStyle: { color: 'rgba(0,212,255,0.07)' },
              label: {
                show: true, position: 'insideTopLeft',
                formatter: `±1σ  ($${lower.toFixed(2)} ~ $${upper.toFixed(2)})`,
                color: '#8b949e', fontSize: 8,
              },
            },
            { yAxis: upper },
          ]],
        },
      },
    ],
  }, true);
}

export function resizePanelB() { chart?.resize(); }
