// js/app.js — 앱 초기화 + 이벤트 핸들러

import { loadAll, filterByDays, getEvents } from './data.js';
import { INDEX_META, RELATIVE_PAIRS } from './config.js';
import { initPanelA, renderPanelA, resizePanelA, toggleIndex } from './panelA.js';
import { initPanelB, renderPanelB, resizePanelB, loadForwardData, getForwardMonths } from './panelB.js';
import { initPanelC, renderPanelC, resizePanelC, togglePair } from './panelC.js';
import { renderPanelD } from './panelD.js';
import { renderPanelE } from './panelE.js';
import { renderPanelF } from './panelF.js';

let currentDays = 365;
let currentMonth = '2026-12';
let currentRelTab = 'buy';

const INDEX_GROUPS = [
  { name: 'LPG',  keys: ['MB', 'CP', 'FEI'],    color: '#f0a500' },
  { name: 'LNG',  keys: ['JKM', 'TTF', 'HH'],   color: '#4ade80' },
  { name: '유가', keys: ['Brent', 'MOPJ'],        color: '#ff6b6b' },
];
const toggleBtnMap = {};

async function init() {
  const [{ timeseries, pricesNative }] = await Promise.all([
    loadAll(),
    loadForwardData(),
  ]);

  // Data date display
  const latest = timeseries[timeseries.length - 1];
  document.getElementById('data-date').textContent =
    `기준일: ${latest.date} | 총 ${timeseries.length}개 관측일`;

  // Init ECharts panels
  initPanelA(document.getElementById('chart-A'));
  initPanelB(document.getElementById('chart-B'));
  initPanelC(document.getElementById('chart-C'));

  // Build group toggle buttons
  const groupsEl = document.getElementById('group-toggles');
  INDEX_GROUPS.forEach(grp => {
    const btn = document.createElement('button');
    btn.className = 'btn-group';
    btn.textContent = grp.name;
    btn.style.borderColor = grp.color;
    btn.style.color = grp.color;
    btn.addEventListener('click', () => {
      const allOn = grp.keys.every(k => !toggleBtnMap[k]?.classList.contains('off'));
      grp.keys.forEach(k => {
        const ib = toggleBtnMap[k];
        if (!ib) return;
        if (allOn) { ib.classList.add('off');    toggleIndex(k, false); }
        else       { ib.classList.remove('off'); toggleIndex(k, true);  }
      });
      syncAllGroupBtns();
    });
    groupsEl.appendChild(btn);
  });

  // Build individual toggle buttons (ordered by group, with separators)
  const togglesEl = document.getElementById('index-toggles');
  INDEX_GROUPS.forEach((grp, gi) => {
    if (gi > 0) {
      const sep = document.createElement('span');
      sep.className = 'toggle-sep';
      sep.textContent = '|';
      togglesEl.appendChild(sep);
    }
    grp.keys.forEach(key => {
      const meta = INDEX_META[key];
      if (!meta) return;
      const btn = document.createElement('button');
      btn.className = 'toggle-btn';
      btn.textContent = meta.label;
      btn.style.borderColor = meta.color;
      btn.style.color = meta.color;
      btn.dataset.key = key;
      toggleBtnMap[key] = btn;
      btn.addEventListener('click', () => {
        btn.classList.toggle('off');
        toggleIndex(key, !btn.classList.contains('off'));
        syncAllGroupBtns();
      });
      togglesEl.appendChild(btn);
    });
  });

  // Initial group button state sync
  syncAllGroupBtns();

  // Populate spread-select with forward contract months
  const spreadSel = document.getElementById('spread-select');
  getForwardMonths().forEach(month => {
    const opt = document.createElement('option');
    opt.value = month;
    opt.textContent = month;
    if (month === currentMonth) opt.selected = true;
    spreadSel.appendChild(opt);
  });

  // Initial render
  renderAll(timeseries, pricesNative);

  // Period filter buttons
  document.querySelectorAll('.btn-period').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.btn-period.active')?.classList.remove('active');
      btn.classList.add('active');
      currentDays = Number(btn.dataset.days);
      renderCharts();
    });
  });

  // Spread selector → change contract month
  spreadSel.addEventListener('change', e => {
    currentMonth = e.target.value;
    renderPanelB(currentMonth);
  });

  // Relative price tabs — 탭 전환 시 토글 버튼도 재구성
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.tab-btn.active')?.classList.remove('active');
      btn.classList.add('active');
      currentRelTab = btn.dataset.tab;
      buildRelToggles(currentRelTab);
      renderPanelC(filterByDays(currentDays), currentRelTab);
    });
  });

  // 초기 상대가 토글 구성
  buildRelToggles(currentRelTab);

  // Resize handler
  window.addEventListener('resize', () => {
    resizePanelA(); resizePanelB(); resizePanelC();
  });
}

/** Panel C: 현재 탭에 맞는 상대가 pair 토글 버튼 재구성 */
function buildRelToggles(tab) {
  const el = document.getElementById('rel-toggles');
  if (!el) return;
  el.innerHTML = '';
  const pairs = RELATIVE_PAIRS.filter(p => p.group === tab);
  pairs.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'toggle-btn';
    btn.textContent = p.label;
    btn.style.borderColor = p.color;
    btn.style.color = p.color;
    btn.dataset.pair = p.id;
    btn.addEventListener('click', () => {
      btn.classList.toggle('off');
      togglePair(p.id, !btn.classList.contains('off'));
    });
    el.appendChild(btn);
  });
}

function syncAllGroupBtns() {
  document.querySelectorAll('.btn-group').forEach(btn => {
    const grp = INDEX_GROUPS.find(g => g.name === btn.textContent);
    if (!grp) return;
    const allOn = grp.keys.every(k => !toggleBtnMap[k]?.classList.contains('off'));
    btn.classList.toggle('off', !allOn);
  });
}

function renderCharts() {
  const records = filterByDays(currentDays);
  renderPanelA(records);
  renderPanelB(currentMonth);
  renderPanelC(records, currentRelTab);
}

function renderAll(timeseries, pricesNative) {
  renderCharts();
  renderPanelD(pricesNative, document.getElementById('table-D'));
  renderPanelE(document.getElementById('optionality-cards'));
  renderPanelF(getEvents(), document.getElementById('panel-F-content'));
}

init().catch(err => {
  console.error('Dashboard init failed:', err);
  document.body.innerHTML = `<div style="color:red;padding:40px">로딩 실패: ${err.message}</div>`;
});
