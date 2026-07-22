# SK Gas Paper Scheme & 변환계수 정본 (KB 기준)

## LPG 변환계수
| 항목 | 값 | 비고 |
|---|---|---|
| 1 ton → mmbtu | 47.84 | LPG 열량 |
| 1 ton → Brent bbl | 8.2 | 유가 환산 기준 |
| MB(cpg) → $/ton | × 5.208 | MB ¢/gallon → $/ton |
| MB(cpg) → $/bbl | ÷ 12.38 | MB → barrel |
| MB(cpg) → $/mmbtu | × 5.208 ÷ 47.84 | ≈ × 0.1089 |

## LNG 변환계수
| 항목 | 값 |
|---|---|
| 1 ton → mmbtu | 51.876 |
| 1 Cargo → mmbtu | ~3.5M (±100k) |
| 1 Cargo → ton | ~73,000 ton |

## 핵심 상대가 공식
CV  = FEI ÷ (Brent × 8.2)          # 산업체 소싱 적정성 판단
NV  = (MB × 0.42) ÷ Brent          # MB/Brent Net Value (MB×0.42 = $/bbl)
JKM sensitivity = $1/mmbtu → ₩15억

## Hedge Ratio
산업체: 판가 = Brent × 3.75 + ₩189  (Brent $1 변동 → 판가 $3.75/ton 변동)
FEI/MOPJ: 97% (MOPJ 대비 FEI 97% 선에서 소싱)
JKM/HH: KOGAS 포트폴리오 비중에 따라 (Brent 55%, HH 10%, JKM 35%)

## 8종 Index 단위
| Index | 주요 단위 | $/mmbtu 환산 |
|---|---|---|
| MB  | ¢/gallon | MB×5.208÷47.84 |
| FEI | $/ton    | FEI÷47.84 |
| CP  | $/ton    | CP÷47.84 |
| MOPJ| $/ton    | MOPJ÷47.84 (납사 기준, LPG 환산) |
| Brent| $/bbl   | Brent÷8.2 (LPG 기준) |
| JKM | $/mmbtu  | - |
| TTF | $/mmbtu  | (€/MWh × 환율 ÷ 29.307로 변환) |
| HH  | $/mmbtu  | - |
