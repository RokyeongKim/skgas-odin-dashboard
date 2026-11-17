// js/panelA.js — Panel A: Index 시계열 ($/mmbtu 환산) + 이벤트 플래그(클릭 → Panel F 연동)

import { INDEX_META } from './config.js';
import { getEvents } from './data.js';
import { openEventInPanelF } from './panelF.js';
import { descHtml } from './glossary.js';

let chart = null;
let visibleSet = new Set(Object.entries(INDEX_META).filter(([, m]) => m.defaultOn !== false).map(([k]) => k));
let _events = [];
let _evDate = {};   // event.id → 차트상 표시 거래일
let _handlerBound = false;
let _flagMode = 'auto';   // 'auto' | '1' | '2' | '3'

/** 플래그 상세도. auto: 1Y 이상 → Lv1(주요), 6M → Lv2(+중간), 3M·1M → Lv3(+세부·⚡급변일) */
export function setFlagMode(mode) { _flagMode = mode; }
export function getFlagThreshold(days) {
  if (_flagMode !== 'auto') return Number(_flagMode);
  return days >= 365 ? 1 : days >= 180 ? 2 : 3;
}
const lvlOf = ev => ev.level || (ev.tier === 1 ? 1 : 2);

/** Odin 데이터에서 급변일(⚡) 자동 감지 — 뉴스 플래그가 ±1 거래일 안에 없는 날만. Lv3 에서만 표시 */
const SPIKE_RULES = [['Brent', 4], ['FEI', 4], ['MB', 4], ['JKM', 7], ['FRT_BALTIC', 6]];
const SPIKE_SHORT = { Brent: 'Brent', FEI: 'FEI', MB: 'MB', JKM: 'JKM', FRT_BALTIC: '운임' };
function detectSpikes(records, pinnedDates) {
  const pinnedIdx = new Set();
  records.forEach((r, i) => { if (pinnedDates.has(r.date)) { pinnedIdx.add(i - 1); pinnedIdx.add(i); pinnedIdx.add(i + 1); } });
  const out = [];
  for (let i = 1; i < records.length; i++) {
    if (pinnedIdx.has(i)) continue;
    const parts = [];
    SPIKE_RULES.forEach(([k, th]) => {
      const a = records[i - 1].native[k], b = records[i].native[k];
      if (a && b) { const ch = (b / a - 1) * 100; if (Math.abs(ch) >= th) parts.push(`${SPIKE_SHORT[k]} ${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%`); }
    });
    if (!parts.length) continue;
    out.push({ id: `spike_${records[i].date}`, date: records[i].date, label: `⚡ ${parts.join(' · ')}`, color: '#e6edf3', tier: 'data', flag: true, level: 3,
      archetype: '급변일(데이터 감지)', note: `Odin 일별 가격 기준 전일 대비 급변. 연결된 뉴스 플래그 없음 — 원인 미확인. (${parts.join(', ')})` });
  }
  return out;
}

export function initPanelA(dom) {
  chart = echarts.init(dom, 'dark');
}

export function renderPanelA(records, days = 365) {
  if (!chart || !records.length) return;

  const thr = getFlagThreshold(days);
  _events = (getEvents() || []).filter(ev => lvlOf(ev) <= thr);
  if (thr >= 3) {
    const pinned = new Set(_events.filter(ev => !ev.is_band && (ev.tier === 1 || ev.flag === true)).map(ev => ev.date));
    _events = _events.concat(detectSpikes(records, pinned));
  }
  const dates  = records.map(r => r.date);
  const dateSet = new Set(dates);
  // 이벤트 날짜가 주말·휴일이면 가장 가까운 거래일(같거나 이후, 없으면 직전)에 붙인다
  const nearestDate = d => {
    if (dateSet.has(d)) return d;
    if (d < dates[0] || d > dates[dates.length - 1]) return null;
    const after = dates.find(x => x > d);
    return after || dates[dates.length - 1];
  };
  _evDate = {};
  _events.forEach(ev => { _evDate[ev.id] = nearestDate(ev.date); });

  const series = Object.entries(INDEX_META).map(([key, meta]) => ({
    name: meta.label,
    type: 'line',
    data: records.map(r => r.mmbtu[key] ?? null),
    showSymbol: false,
    lineStyle: { width: 1.5, color: meta.color },
    itemStyle: { color: meta.color },
  }));

  // 이벤트 vertical lines (Tier1=진하게, Tier2=옅게)
  const markLineData = _events
    .filter(ev => !ev.is_band && _evDate[ev.id])
    .map(ev => {
      const isTier2 = ev.tier !== 1;
      return [
        {
          xAxis: _evDate[ev.id],
          name: ev.id,
          lineStyle: {
            color: isTier2 ? '#555' : ev.color,
            type: isTier2 ? 'dotted' : 'dashed',
            width: isTier2 ? 1 : 1.5,
          },
          label: { show: false },
        },
        { xAxis: _evDate[ev.id], name: ev.id },
      ];
    });

  // 클릭 가능한 flag markPoint (상단 고정) — Tier1 전부 + flag:true 로 표시 지정한 Tier2(과거 JKM 급등 배경 등)
  const tier1Events = _events.filter(ev => !ev.is_band && _evDate[ev.id] && (ev.tier === 1 || ev.flag === true));
  const dense = tier1Events.length > 14;   // 핀이 많으면 3단 stagger + 짧은 라벨
  const flagPoints = tier1Events.map((ev, i) => ({
    coord: [_evDate[ev.id], 'max'],
    name: ev.id,
    value: ev.label,
    symbol: ev.tier === 'data' ? 'diamond' : 'pin',
    symbolSize: ev.tier === 'data' ? [12, 12] : ev.tier === 1 ? [26, 32] : lvlOf(ev) >= 2 ? [18, 23] : [20, 26],
    symbolOffset: [0, ev.tier === 'data' ? -78 : dense ? [-6, -30, -54][i % 3] : i % 2 === 0 ? -6 : -30], // 라벨 겹침 완화용 세로 stagger (빽빽하면 3단, 급변일은 최상단)
    itemStyle: { color: ev.color, borderColor: ev.tier === 1 ? '#fff' : '#8b949e', borderWidth: 1, opacity: ev.tier === 1 ? 1 : 0.85 },
    label: {
      show: true,
      position: 'top',
      distance: 4,
      formatter: () => { const n = dense ? 12 : 18; return ev.label.length > n ? ev.label.slice(0, n) + '…' : ev.label; },
      color: ev.color,
      fontSize: ev.tier === 'data' ? 8.5 : 9.5,
      fontWeight: 600,
      backgroundColor: 'rgba(13,17,23,0.85)',
      padding: [2, 4],
      borderRadius: 3,
    },
    tooltip: {
      formatter: () => `<div style="max-width:340px;font-size:11px;white-space:normal">
        <b style="color:${ev.color}">${ev.label}</b><br/>
        <span style="color:#8b949e">${ev.date}${ev.tier === 2 ? ' · Tier 2 (공개 참조)' : ev.tier === 'data' ? ' · Odin 데이터 감지' : ''} · Lv${lvlOf(ev)}</span><br/>
        <span style="color:#c9d1d9">${ev.note || ''}</span><br/>
        ${ev.tier === 'data' ? '' : '<span style="color:#00d4ff;font-size:10px">▶ 클릭 → Panel F 상세보기</span>'}
      </div>`,
    },
  }));

  if (series.length > 0) {
    series[0].markLine = { symbol: 'none', data: markLineData, silent: true };
    series[0].markPoint = {
      data: flagPoints,
      silent: false,
      z: 100,
    };
  }

  // Band events as markArea
  const bandAreas = _events
    .filter(ev => ev.is_band && ev.end_date)
    .map(ev => ([
      { xAxis: ev.date,     itemStyle: { color: `${ev.color}18` }, label: { show: true, position: 'insideTopLeft', formatter: ev.label.slice(0, 10), color: ev.color, fontSize: 8 } },
      { xAxis: ev.end_date },
    ]));

  if (bandAreas.length > 0 && series.length > 0) {
    series[0].markArea = { silent: true, data: bandAreas };
  }

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', lineStyle: { color: '#444' } },
      confine: true,
      extraCssText: 'max-width:420px;white-space:normal;',
      formatter: params => {
        const date = params[0]?.axisValue;
        let html = `<div style="font-size:11px;line-height:1.5">`;
        // 마우스 위치(픽셀) 기준 핀 폭 안에 드는 이벤트를 모두 표시 — 축이 빽빽해도 핀 위에서 설명이 뜨도록
        const px = chart.convertToPixel({ xAxisIndex: 0 }, date);
        const dayEvents = _events
          .filter(ev => _evDate[ev.id])
          .map(ev => ({ ev, dist: Math.abs(chart.convertToPixel({ xAxisIndex: 0 }, _evDate[ev.id]) - px) }))
          .filter(x => x.dist <= 14)
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 4)
          .map(x => x.ev);
        if (dayEvents.length) {
          dayEvents.forEach(ev => {
            html += `<div style="margin-bottom:6px;padding:6px 8px;border-left:3px solid ${ev.color};background:rgba(255,255,255,0.04);border-radius:3px">
              <div style="font-weight:700;color:${ev.color};font-size:12px">📍 ${ev.label}</div>
              <div style="color:#8b949e;font-size:10px">${ev.date}${ev.date !== date ? ` (표시일 ${_evDate[ev.id]})` : ''} · ${ev.archetype || ''}${ev.tier === 2 ? ' · Tier 2 (공개 참조)' : ev.tier === 'data' ? '' : ' · Tier 1 (Odin)'} · Lv${lvlOf(ev)}</div>
              ${ev.note ? `<div style="color:#c9d1d9;margin-top:3px">${ev.note}</div>` : ''}
            </div>`;
          });
        }
        html += `<b>${date}</b>`;
        params.forEach(p => {
          if (p.seriesType === 'line' && p.data !== null && p.data !== undefined) {
            html += `<br/><span style="color:${p.color}">●</span> ${p.seriesName}: <b>$${Number(p.data).toFixed(2)}</b>`;
          }
        });
        return html + '</div>';
      },
    },
    legend: {
      top: 5,
      textStyle: { color: '#8b949e', fontSize: 11 },
      tooltip: {
        show: true,
        formatter: params => {
          const key = Object.keys(INDEX_META).find(k => INDEX_META[k].label === params.name);
          return key ? descHtml(key) : params.name;
        },
      },
      selected: Object.fromEntries(Object.entries(INDEX_META).map(([k, m]) => [m.label, visibleSet.has(k)])),
    },
    grid: { left: 55, right: 20, top: dense ? 110 : 80, bottom: 50 },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
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
    series,
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      {
        type: 'slider',
        bottom: 2,
        height: 20,
        borderColor: '#30363d',
        fillerColor: 'rgba(0,212,255,0.1)',
        handleStyle: { color: '#00d4ff' },
      },
    ],
  }, true);

  // 플래그 클릭 → Panel F 연동 (한 번만 바인딩)
  if (!_handlerBound) {
    chart.on('click', params => {
      if (params.componentType === 'markPoint' && params.name && !String(params.name).startsWith('spike_')) {
        openEventInPanelF(params.name);
      }
    });
    _handlerBound = true;
  }
}

export function toggleIndex(key, visible) {
  if (visible) visibleSet.add(key); else visibleSet.delete(key);
  if (!chart) return;
  const meta = INDEX_META[key];
  chart.dispatchAction({ type: visible ? 'legendSelect' : 'legendUnSelect', name: meta.label });
}

export function resizePanelA() { chart?.resize(); }
