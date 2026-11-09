# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Purpose

SK Gas Odin 지표 시계열 대시보드. Odin 데이터를 기반으로 LNG/LPG/유가 옵셔널리티 플레이를 추천하는 GitHub Pages 정적 웹앱.

접속 URL: `https://RokyeongKim.github.io/skgas-odin-dashboard/`

## Key Commands

```bash
# 로컬 서버 (빌드 불필요 — 순수 HTML/JS/CSS)
npx serve .          # 또는 python -m http.server 8080

# Odin 일별 가격표(TSV) → timeseries.json + prices_native.json (현재 정본 경로)
python3 scripts/parse_odin_tsv.py data/raw/odin_daily_2026-01-01_2026-11-05.tsv

# (구) Excel → timeseries.json 변환
XLSX_PATH="C:/Users/rice2/AppData/Roaming/npm/node_modules/xlsx" node scripts/parse_excel.js

# Notion 1월 Odin 파싱 (MCP fetch 결과 파일이 있을 때)
node scripts/parse_notion.js [tool-result-file-path]

# 데이터 갱신 후 배포
git add data/ && git commit -m "data: update Odin YYYY-MM-DD" && git push
```

## Architecture

### 데이터 흐름
```
Odin (사내 시스템)
  ├─ 일별 가격표 TSV → data/raw/odin_daily_*.tsv → scripts/parse_odin_tsv.py   ← 현재 정본
  ├─ Notion MCP → scripts/parse_notion.js → raw/notion/                        (구)
  └─ Excel 파일  → scripts/parse_excel.js → raw/files/                          (구)
                              ↓
                   data/timeseries.json   (220 records, 2026-01-02~11-05 일별 spot)
                   data/events.json       (34개 플래그, §5-1A)
                   data/prices_native.json (이벤트 시점별 스냅샷)
                              ↓
                   index.html + js/*.js   (ECharts CDN, no build)
```

### timeseries.json 스키마
```json
{
  "date": "2026-07-23",
  "baseMonth": "2026-07",
  "source": "file|notion",
  "tier": 1,
  "native":  { "Brent": 98.29, "WTI": 91.26, "CP": 720, "CP_C4": 780, "FEI": 993, "FEI_C4": 1083, "C2": 30.4375,
               "MB": 110.9375, "MB_nC4": 177.75, "MB_iC4": 181.25,
               "MB_nonTET_C3": 107.6875, "MB_nonTET_nC4": 183.75, "MB_nonTET_iC4": 181.5,
               "ARA_C3": 789.5, "ARA_C4": 858, "FRT_BALTIC": 261.4, "FRT_RIM": 131.4,
               "MOPJ": 896.25, "FO380": 629.27, "JKM": 29.476, "TTF": null, "HH": null },
  "mmbtu":   { "Brent": 11.987, "FEI": 20.757, ... , "FRT_BALTIC": null },
  "derived": { "CV": 1.232, "NV": 0.474, "FEI_MOPJ": 1.1079, "JKM_FEI_M2": null, "MB_FEI": -415.2, "FEI_CP": 273,
               "JKM_FEI_ODIN": null, "CP_Brent": 0.8933, "FEI_C4_C3": 90, "MB_TET_PREM": 3.25 }
}
```
- native 키 의미: `FEI`/`CP` = C3(프로판), `MB` = Mont Belvieu **TET** 프로판(기존 대시보드의 MB와 동일 계열),
  `MB_nonTET_*` = non-TET(LST) 인웰, `C2` = Purity Ethane(¢/gal), `FO380` = MOPS 380cst 고유황 연료유($/MT),
  `FRT_BALTIC` = Baltic VLGC 운임($/MT, 라스타누라→치바), `FRT_RIM` = RIM 운임.
- `TTF`/`HH` 는 일별 가격표에 없음 → 2026-07-23 이전 구(Notion/Excel) 월 단위 참조값만 유지, 이후 null.
- 모든 값은 **관측일 spot/근월 assessment** (CP 는 발표일부터 익월 CP 로 전환됨 = 원 파일 그대로).
- `JKM_FEI_M2`는 data.js에서 43 영업일 lag로 자동 계산됨 (저장하지 않음).
- Tier 1 = Odin 실측 / Tier 2 = 공개 참조 (옵셔널리티 판정에 사용 불가).

### JS 파일 역할
| 파일 | 역할 |
|---|---|
| `js/config.js` | KB 정본 환산계수, INDEX_META, SPREAD_PAIRS, RELATIVE_PAIRS |
| `js/data.js`   | JSON fetch, JKM_FEI_M2 lag 계산, 백분위·z-score, filterByDays |
| `js/app.js`    | 초기화·이벤트 핸들러·패널 오케스트레이션 |
| `js/panelA.js` | ECharts 시계열 (Tier1 수직선 실선, Tier2 점선, band markArea) |
| `js/panelA2.js`| 지표별 Native 단위 Range·이상치 (기준구간 μ±1σ 밴드, ±2σ 선, P5/P95, 일간 스파이크 ◆, 전 지표 요약표) |
| `js/panelB.js` | Spread 시계열 + 평균±1σ 밴드 + 백분위 |
| `js/panelC.js` | 상대가 시계열 (Buy/Sell 탭 분리, CV/NV/FEI_MOPJ/JKM_FEI_M2) |
| `js/panelD.js` | Native 단위 가격 표 (이벤트 컬럼 × Index 행) |
| `js/panelE.js` | 옵셔널리티 엔진 (CV/NV/FEI_MOPJ/JKM 자동 판정 카드) |
| `js/panelF.js` | Factor Library 테이블 (34개 플래그, archetype별 반응 패턴) |

### KB 정본 환산계수 (`js/config.js` CONVERSION 객체)
- LPG 1 ton = 47.84 mmbtu = 8.2 bbl (Brent equiv)
- LNG 1 ton = 51.876 mmbtu / 1 cargo ≈ 3.5M mmbtu = 73,000 ton
- MB ¢/gal × 5.208 = $/ton / × 0.1089 = $/mmbtu
- CV = FEI ÷ (Brent × 8.2) → 소싱 적정 ≈ 90% 미만
- NV = (MB × 0.42) ÷ Brent → 목표 ~88%

## Data Source Rules

- **가격 정본은 Odin뿐**. 웹 검색·공개 데이터는 Tier 2 참조 레이어로만 사용.
- **결측은 결측으로 둔다** — 보간·캐리포워드 금지.
- Notion 1·2·4월 데이터는 `parse_notion.js`, Excel 파일은 `parse_excel.js`로 파싱.
- 소스 충돌 시 **파일 > Notion** 우선 (§3-1D). 2026-11 일별 가격표 반영 시 2026-01~07 구 데이터는 전부 파일값으로 대체됨
  (차이 분석: `knowledge/data_reconciliation_2026-11.md`).

## Events Schema (`data/events.json`)
```json
{
  "id": "war_start",
  "date": "2026-02-28",
  "end_date": null,
  "label": "개전 (미·이스라엘 대이란 공습)",
  "archetype": "공급차단형",
  "channels": ["brent", "lpg", "lng"],
  "tier": 1,
  "color": "#ff0000",
  "type": "war",
  "is_band": false,
  "note": "..."
}
```
- `is_band: true`이면 `end_date`까지 음영 구간으로 표시.
- archetype 4종: 수요파괴형 / 공급차단형 / 유통재배치형 / 정책마감형

## GitHub Pages (Private)
- repo: `RokyeongKim/skgas-odin-dashboard` (private)
- Pages source: `master` 브랜치 루트
- 설정: Settings → Pages → Source: Deploy from branch → master / (root)
