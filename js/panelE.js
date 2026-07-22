// js/panelE.js — Panel E: 옵셔널리티 엔진 + 추천 카드 생성

import { CONVERSION } from './config.js';
import { latestDerived, latestNative, currentPercentile1Y } from './data.js';

/** Optionality engine: derive recommendations from current market data */
export function computeRecommendations() {
  const cv    = latestDerived('CV');
  const nv    = latestDerived('NV');
  const feiMopj = latestDerived('FEI_MOPJ');
  const jkmFei  = latestDerived('JKM_FEI_M2');
  const brent   = latestNative('Brent');
  const fei     = latestNative('FEI');
  const jkm     = latestNative('JKM');

  const cvPct   = currentPercentile1Y('CV');
  const fmPct   = currentPercentile1Y('FEI_MOPJ');

  const recommendations = [];

  // ---- 1. 산업체 FEI/Brent (CV) ----
  if (cv !== null) {
    const sourcingTarget  = CONVERSION.CV_SOURCING_TARGET;
    const unwindThreshold = sourcingTarget + CONVERSION.CV_UNWIND_PREMIUM;

    if (cv < sourcingTarget) {
      const spread = (brent * CONVERSION.LPG_TON_TO_BBL / CONVERSION.LPG_TON_TO_MMBTU) - (fei / CONVERSION.LPG_TON_TO_MMBTU);
      recommendations.push({
        type: 'source',
        title: '산업체 FEI/Brent — 소싱 기회',
        metrics: {
          'CV 현재': `${(cv * 100).toFixed(1)}%`,
          '소싱 목표': `<${(sourcingTarget * 100).toFixed(0)}%`,
          '1Y 백분위': cvPct !== null ? `${cvPct}%tile` : '—',
          'Net Spread': spread > 0 ? `+$${spread.toFixed(2)}/mmbtu` : `$${spread.toFixed(2)}/mmbtu`,
        },
        reason: `CV ${(cv * 100).toFixed(1)}% < 90% 소싱 적정 구간. Brent ${brent?.toFixed(1)}$/bbl 대비 FEI ${fei?.toFixed(0)}$/ton. 지정학 전쟁 프리미엄이 Brent를 끌어올려 CV를 누르는지 분리 확인 필요.`,
        profit: spread > 0 ? `수익 방향: FEI Buy Hedge` : null,
        risk: '전쟁 프리미엄 되돌림 시 CV 상승 위험',
      });
    } else if (cv >= unwindThreshold) {
      const optGain = (cv - sourcingTarget) * brent * CONVERSION.LPG_TON_TO_BBL;
      recommendations.push({
        type: 'unwind',
        title: '산업체 FEI/Brent — Unwind 후보',
        metrics: {
          'CV 현재': `${(cv * 100).toFixed(1)}%`,
          'Unwind 트리거': `≥${(unwindThreshold * 100).toFixed(0)}%`,
          '1Y 백분위': cvPct !== null ? `${cvPct}%tile` : '—',
          '예상 차익': `+$${optGain.toFixed(0)}/ton`,
        },
        reason: `CV ${(cv * 100).toFixed(1)}% ≥ ${(unwindThreshold * 100).toFixed(0)}% Unwind 구간. 공급옵션 마진 대비 Unwind 이익 비교 후 결정. Backwardation 확인 후 원월물 R/O 우선 검토.`,
        profit: `예상 차익: $${optGain.toFixed(0)}/ton × 물량`,
        risk: 'Unwind 후 CV 추가 상승 시 기회이익 상실 / 재소싱 시점 미확보 위험',
      });
    } else {
      recommendations.push({
        type: 'watch',
        title: '산업체 FEI/Brent — 관찰',
        metrics: {
          'CV 현재': `${(cv * 100).toFixed(1)}%`,
          '소싱 목표': '<90%',
          '1Y 백분위': cvPct !== null ? `${cvPct}%tile` : '—',
          '상태': '소싱/Unwind 기준 미충족',
        },
        reason: `CV ${(cv * 100).toFixed(1)}% — 소싱 기준 90% 이하, Unwind 기준 95% 이상 모두 미달. 시황 모니터링 유지.`,
        profit: null,
        risk: null,
      });
    }
  }

  // ---- 2. 석화 FEI/MOPJ ----
  if (feiMopj !== null) {
    const fmTarget = CONVERSION.FEIS_MOPJ_RATIO;
    const fmUnwind = fmTarget + 0.05;

    if (feiMopj < fmTarget) {
      recommendations.push({
        type: 'source',
        title: '석화 FEI/MOPJ — 소싱 기회',
        metrics: {
          'FEI/MOPJ': `${(feiMopj * 100).toFixed(1)}%`,
          '목표': `<${(fmTarget * 100).toFixed(0)}%`,
          '1Y 백분위': fmPct !== null ? `${fmPct}%tile` : '—',
          '상태': 'FEI < MOPJ×97% → 소싱 유리',
        },
        reason: `납사(MOPJ) 대비 LPG(FEI) 가격경쟁력 우위. 석화 납사대체 Term 계약 소싱 검토.`,
        profit: 'FEI Buy / MOPJ Sell 동시 Fix',
        risk: 'MOPJ 급락 시 상대가 역전 위험',
      });
    } else if (feiMopj >= fmUnwind) {
      recommendations.push({
        type: 'unwind',
        title: '석화 FEI/MOPJ — Unwind 후보',
        metrics: {
          'FEI/MOPJ': `${(feiMopj * 100).toFixed(1)}%`,
          'Unwind 기준': `≥${(fmUnwind * 100).toFixed(0)}%`,
          '1Y 백분위': fmPct !== null ? `${fmPct}%tile` : '—',
          '상태': 'FEI > MOPJ×102% → Unwind 구간',
        },
        reason: `납사 대비 LPG 상대가격 고점 구간. 기존 FEI Buy 포지션 Unwind 후 차익 실현 검토.`,
        profit: 'Unwind 이익 = (현재 FEI/MOPJ − 소싱가) × 물량',
        risk: '재소싱 시 FEI/MOPJ 추가 상승 위험',
      });
    }
  }

  // ---- 3. JKM Sell 계열 ----
  if (jkmFei !== null && jkm !== null) {
    const jkmSpreadHighThreshold = 3.0;
    if (jkmFei >= jkmSpreadHighThreshold) {
      recommendations.push({
        type: 'unwind',
        title: 'JKM Sell Paper — Unwind (고spread)',
        metrics: {
          'JKM': `$${jkm.toFixed(2)}/mmbtu`,
          'JKM−FEI(M-2)': `+$${jkmFei.toFixed(2)}/mmbtu`,
          'MtM 민감도': 'JKM $1 = ₩15억',
          '기준 Net Spread': `$3.7(9월) / $3.1(10월)`,
        },
        reason: `JKM-FEI(M-2) Spread $${jkmFei.toFixed(2)}/mmbtu ≥ $3.0 — Unwind 구간 진입. 동절기 강세 전 Sell hedge 일부 Unwind, 실물 판가 상승분 취득. Target 8월초 전 실행 권고. 선반영 손익(-59억) 및 누적 한도(-150억) 확인 필요.`,
        profit: `Spread × 물량 기준 예상 수익 (JKM $1 상승 시 +₩15억)`,
        risk: 'Unwind 후 JKM 추가 급등 시 기회이익 상실 / 재진입 Target +$3 미도달 위험',
      });
    } else {
      recommendations.push({
        type: 'watch',
        title: 'JKM Sell Paper — 관찰',
        metrics: {
          'JKM': `$${jkm.toFixed(2)}/mmbtu`,
          'JKM−FEI(M-2)': jkmFei !== null ? `$${jkmFei.toFixed(2)}/mmbtu` : '—',
          'Unwind 기준': '≥ $3.0/mmbtu',
          '상태': 'Spread 미충족, 모니터링',
        },
        reason: `JKM-FEI(M-2) Spread $${jkmFei.toFixed(2)}/mmbtu < $3.0 Unwind 기준 미충족. 재격화 지속 시 동절기 $15+ 전망에 따른 추가 상승 모니터링.`,
        profit: null,
        risk: null,
      });
    }
  }

  return recommendations;
}

/** Render recommendation cards to DOM */
export function renderPanelE(container) {
  const recs = computeRecommendations();
  if (!recs.length) {
    container.innerHTML = '<div class="loading">데이터 분석 중...</div>';
    return;
  }

  container.innerHTML = recs.map(rec => `
    <div class="opt-card ${rec.type}">
      <div class="opt-card-type">${rec.type === 'source' ? '▼ 소싱 기회' : rec.type === 'unwind' ? '▲ UNWIND 후보' : '◎ 관찰'}</div>
      <div class="opt-card-title">${rec.title}</div>
      <div class="opt-card-metrics">
        ${Object.entries(rec.metrics).map(([k, v]) => `
          <div>
            <div class="opt-metric-label">${k}</div>
            <div class="opt-metric-value">${v}</div>
          </div>
        `).join('')}
      </div>
      <div class="opt-card-reason">
        ${rec.reason}
        ${rec.profit ? `<br><br><span class="opt-profit">💰 ${rec.profit}</span>` : ''}
        ${rec.risk   ? `<br><span class="opt-risk">⚠ ${rec.risk}</span>` : ''}
      </div>
    </div>
  `).join('');
}
