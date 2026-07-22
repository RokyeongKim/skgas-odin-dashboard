# SK Gas Odin 옵셔널리티 대시보드

> ⚠️ 현재 Dummy 데이터 기반. 실데이터 교체 방법은 §데이터 갱신 참조.

## 대시보드 기능

- **Panel A** — 8종 Index 시계열 ($/mmbtu 환산, 이벤트 플래그 수직선, 기간 필터)
- **Panel B** — Spread 시계열 (JKM-FEI 등 4쌍, ±1σ 밴드, 현재 백분위)
- **Panel C** — 상대가 시계열 (CV=FEI/Brent, NV=MB/Brent, FEI/MOPJ, JKM vs FEI(M-2))
- **Panel D** — 이벤트별 Native 가격 표 (개전~현재 컬럼, 변화율 색상)
- **Panel E** — 옵셔널리티 추천 카드 (소싱/Unwind/관찰, 예상수익·리스크)

## 로컬 실행

```bash
# 프로젝트 폴더에서 Python HTTP 서버 실행
cd skgas-odin-dashboard
python -m http.server 8080
# http://localhost:8080 접속
```

> ES6 modules는 file:// 프로토콜에서 동작하지 않으므로 HTTP 서버 필수.

## 데이터 갱신 (실데이터 교체)

### timeseries.json 형식

```json
[
  {
    "date": "2023-07-03",
    "native": {
      "Brent": 75.12, "FEI": 562.0, "CP": 535.0, "MOPJ": 698.0,
      "MB": 94.5, "JKM": 12.8, "TTF": 10.5, "HH": 2.72
    },
    "mmbtu":  { "Brent": 9.16, "FEI": 11.75, "CP": 11.18, "MOPJ": 14.59, "MB": 10.77, "JKM": 12.8, "TTF": 10.5, "HH": 2.72 },
    "derived": { "CV": 0.876, "NV": 0.528, "FEI_MOPJ": 0.805, "JKM_FEI_M2": null }
  }
]
```

`mmbtu`와 `derived` 필드는 `js/data.js`가 런타임 자동 계산. **`native` 필드만 채우면 됩니다.**

### prices_native.json 형식

```json
{
  "current":       { "date": "2026-07-23", "Brent": 88.5, "FEI": 610.0, ... },
  "war_start":     { "date": "2026-02-28", "Brent": 75.0, "FEI": 562.0, ... },
  "ceasefire1":    { "date": "2026-04-08", ... },
  "mou_news":      { "date": "2026-06-12", ... },
  "mou_signed":    { "date": "2026-06-17", ... },
  "mou_end":       { "date": "2026-07-08", ... },
  "strait_close":  { "date": "2026-07-11", ... },
  "strait_open":   { "date": "2026-07-15", ... },
  "iran_escalate": { "date": "2026-07-18", ... }
}
```

### 갱신 커맨드 (실데이터 준비 후)

```bash
# data/*.json 갱신 후
git add data/timeseries.json data/prices_native.json
git commit -m "data: update Odin prices YYYYMMDD"
git push origin main
# GitHub Pages 자동 재배포 (약 1-2분)
```

## 변환계수 (KB 정본)

| 항목 | 값 |
|---|---|
| LPG 1ton → mmbtu | 47.84 |
| LPG 1ton → Brent bbl | 8.2 |
| LNG 1ton → mmbtu | 51.876 |
| MB ¢/gal → $/ton | × 5.208 |
| CV = | FEI ÷ (Brent × 8.2) |
| NV = | (MB × 0.42) ÷ Brent |

## 파일 구조

```
skgas-odin-dashboard/
├── index.html          # 단일 페이지 대시보드
├── css/dashboard.css   # 다크 트레이딩 테마
├── js/
│   ├── config.js       # KB 변환계수 + 이벤트 플래그
│   ├── data.js         # JSON 로더 + 파생값 계산
│   ├── panelA.js       # Index 시계열 차트
│   ├── panelB.js       # Spread 차트
│   ├── panelC.js       # 상대가 차트
│   ├── panelD.js       # Native 가격 표
│   ├── panelE.js       # 옵셔널리티 엔진
│   └── app.js          # 앱 초기화
├── data/
│   ├── timeseries.json     # 8종 Index 시계열 (교체 대상)
│   ├── prices_native.json  # 이벤트별 가격 스냅샷 (교체 대상)
│   └── events.json         # 지정학 이벤트 플래그
├── scripts/
│   └── generate_dummy.py   # Dummy 데이터 생성기
└── knowledge/
    ├── optionality.md      # SK Gas 옵셔널리티 개념
    └── paper_scheme.md     # KB 변환계수 정본
```
