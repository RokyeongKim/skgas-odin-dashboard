// js/app.js — 앱 초기화 + 이벤트 핸들러

import { loadAll, filterByDays, getEvents } from './data.js';
import { INDEX_META, RELATIVE_PAIRS } from './config.js';
import { initPanelA, renderPanelA, resizePanelA, toggleIndex, setFlagMode, getFlagThreshold } from './panelA.js';
import { initPanelA2, renderPanelA2, resizePanelA2 } from './panelA2.js';
import { initPanelBrief, renderPanelBrief } from './panelBrief.js';
import { initPanelB, renderPanelB, resizePanelB, loadForwardData, getForwardMonths } from './panelB.js';
import { initPanelC, renderPanelC, resizePanelC, togglePair } from './panelC.js';
import { renderPanelD } from './panelD.js';
import { renderPanelE } from './panelE.js';
import { renderPanelF } from './panelF.js';
import { initTooltips } from './glossary.js';
import { renderLearnTab, resizeLearn, setCorrHorizon } from './panelLearn.js';

let currentDays = 365;
let currentMonth = '2026-12';
let currentRelTab = 'buy';

const INDEX_GROUPS = [
  { name: 'LPG 아시아',  keys: ['FEI', 'FEI_C4', 'CP', 'CP_C4'],                                   color: '#00d4ff' },
  { name: 'LPG 미주·유럽', keys: ['MB', 'MB_nonTET_C3', 'MB_nC4', 'MB_iC4', 'C2', 'ARA_C3', 'ARA_C4'], color: '#f0a500' },
  { name: 'LNG',        keys: ['JKM', 'TTF', 'HH'],                                               color: '#4ade80' },
  { name: '유가·제품',   keys: ['Brent', 'WTI', 'MOPJ', 'FO380'],                                   color: '#ff6b6b' },
];
const toggleBtnMap = {};

async function init() {
  initTooltips();
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
  initPanelA2({
    chartDom: document.getElementById('chart-A2'),
    select:   document.getElementById('a2-index-select'),
    baseline: document.getElementById('a2-baseline-select'),
    table:    document.getElementById('table-A2'),
    summary:  document.getElementById('a2-summary'),
  });
  initPanelBrief({
    content: document.getElementById('brief-content'),
    select:  document.getElementById('a1-baseline-select'),
  });
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
      btn.dataset.tipKey = key;
      toggleBtnMap[key] = btn;
      if (meta.defaultOn === false) { btn.classList.add('off'); toggleIndex(key, false); }
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

  // Panel A 플래그 상세도 셀렉터
  const flagSel = document.getElementById('flag-level-select');
  if (flagSel) flagSel.addEventListener('change', e => { setFlagMode(e.target.value); renderPanelA(filterByDays(currentDays), currentDays); updateFlagHint(); });

  // 메인 탭 (1. 실시간 Index / 2. Index 이해)
  const HINTS = { 'tab-live': '실시간 지표 · 해석 · Range · 스프레드 · 옵셔널리티', 'tab-learn': '변동성 · 상관관계 · 상대가 이력 · 대체재 · 왜 JKM 인가 (기간 필터 무관)' };
  document.querySelectorAll('.main-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.main-tab.active')?.classList.remove('active');
      btn.classList.add('active');
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === btn.dataset.pane));
      const hint = document.getElementById('main-tabs-hint'); if (hint) hint.textContent = HINTS[btn.dataset.pane] || '';
      document.querySelector('.period-filters')?.classList.toggle('dimmed', btn.dataset.pane === 'tab-learn');
      if (btn.dataset.pane === 'tab-learn') { renderLearnTab(); }
      else { resizePanelA(); resizePanelA2(); resizePanelB(); resizePanelC(); }
      window.scrollTo({ top: 0 });
    });
  });
  // G-2 상관 수익률 기간 토글
  document.querySelectorAll('[data-horizon]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-horizon]').forEach(b => b.classList.toggle('active', b === btn));
      setCorrHorizon(Number(btn.dataset.horizon));
    });
  });

  // Resize handler
  window.addEventListener('resize', () => {
    if (document.getElementById('tab-learn')?.classList.contains('active')) resizeLearn();
    else { resizePanelA(); resizePanelA2(); resizePanelB(); resizePanelC(); }
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

const FLAG_LV_DESC = { 1: 'Lv1 주요 전환점만', 2: 'Lv1+2 중간 뉴스 포함', 3: 'Lv1+2+3 전부 + ⚡데이터 감지 급변일' };
function updateFlagHint() {
  const h = document.getElementById('flag-level-hint'); if (!h) return;
  const thr = getFlagThreshold(currentDays);
  h.textContent = `현재 ${FLAG_LV_DESC[thr]} (${document.querySelector('.btn-period.active')?.textContent || ''} 보기)`;
}

function renderCharts() {
  const records = filterByDays(currentDays);
  renderPanelA(records, currentDays);
  updateFlagHint();
  renderPanelA2(records);
  renderPanelB(currentMonth);
  renderPanelC(records, currentRelTab);
}

function renderAll(timeseries, pricesNative) {
  renderCharts();
  renderPanelBrief();
  renderPanelD(pricesNative, document.getElementById('table-D'));
  renderPanelE(document.getElementById('optionality-cards'));
  renderPanelF(getEvents(), document.getElementById('panel-F-content'));
}

init().catch(err => {
  console.error('Dashboard init failed:', err);
  document.body.innerHTML = `<div style="color:red;padding:40px">로딩 실패: ${err.message}</div>`;
});
