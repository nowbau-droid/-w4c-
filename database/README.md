# 🗄️ 요양 w4c 노트 - 데이터베이스 스키마 가이드 (PostgreSQL / Supabase)

본 문서는 `database/schema.sql`에 정의된 데이터베이스 구조와 실무 회계 규칙을 설명합니다.

---

## 1. 테이블 구성도 및 역할

| 번호 | 테이블명 | 용도 및 설명 | 주요 특징 |
| :--- | :--- | :--- | :--- |
| **1** | `facility_settings` | 장기요양기관 기본 정보 및 법정 기준치 | W4C 시설코드, 법정 인건비 비율(61.4%) 관리 |
| **2** | `w4c_account_codes` | 사회복지시설 표준 관-항-목 마스터 | `01-01-01` 체계, 세입/세출 구분, 인건비 과목 여부(`is_labor_cost`) |
| **3** | `accounts` | 다중 통장 계좌 마스터 | 운영비, 식자재, 후원금, 보조금, 퇴직적립 등 용도별 관리 |
| **4** | `budget_plans` | 회계연도 본예산 및 추경 차수 | 본예산(0차), 1차 추경, 2차 추경 이력 관리 |
| **5** | `budget_items` | 관항목별 예산 편성액 및 현액 | 편성액 + 전용증감액 = 최종 예산현액, 실집행액 추적 |
| **6** | `budget_transfers` | 동일 항 내 목간 예산 전용 내역 | 지자체 보고용 예산전용조서 자동화 기초 데이터 |
| **7** | `bank_transactions` | 은행 통장 거래 원장 (엑셀 파싱 원천) | 중복 방지 해시(`transaction_hash`), 매칭 진행 상태 관리 |
| **8** | `receipts` | 증빙 및 영수증 (OCR 추출 데이터) | Vision AI 파싱 결과(상호, 일자, 품목JSON, 금액, 추천과목) |
| **9** | `vouchers` | W4C 회계 결의서 전표 마스터 | 세입/세출/내부대체 구분, 표준 적요 규칙, W4C 전송 여부 |
| **10** | `voucher_transaction_matches` | 결의서 - 통장거래 - 영수증 N:M 매핑 | **[핵심] 1 영수증 분할 결제(다중 통장) 및 복합 분개 완벽 대응** |
| **11** | `daily_account_balances` | 일자별 통장 마감 잔액 스냅샷 | **[핵심] W4C 일자별 일계표 수지일치(장부잔액 = 통장잔액) 실시간 검증** |

---

## 2. 실무 엣지 케이스 해결을 위한 특수 설계

### ① 1:N / N:1 분할 매칭 (`voucher_transaction_matches`)
- **실무 상황**: 식자재마트에서 영수증 350,000원이 발행되었는데, 200,000원은 운영비 체크카드 출금, 150,000원은 식자재 통장 송금인 경우.
- **해결**: 하나의 결의서(또는 영수증)가 여러 개의 `bank_transactions` 레코드와 금액 단위로 쪼개져 결합될 수 있도록 중계 매핑 테이블 구축.
- **자동 트리거**: 매칭이 등록/수정/삭제될 때마다 `bank_transactions`의 `match_status`가 `UNMATCHED` ➔ `PARTIALLY_MATCHED` ➔ `FULLY_MATCHED`로 자동 전환.

### ② 내부 자금 대체 전표 (`vouchers.voucher_type = 'INTERNAL_TRANSFER'`)
- 운영비 통장에서 식자재 통장으로 500만원을 이체할 때 세출/세입으로 잡히면 결산 총액이 뻥튀기됨.
- `target_account_id`를 지정하여 양쪽 통장의 잔액 변동만 일으키고 세입·세출 결산 집계에서는 자동 제외되도록 설계.

### ③ 1원 단위 수지일치 (`daily_account_balances.is_reconciled`)
- 전일이월 + 입금 - 출금 = 당일 마감잔액(`closing_balance`).
- 은행 통장 원장의 최종 잔액(`bank_statement_balance`)과 일치하는지 계산 필드로 실시간 검증.

---

## 3. 유용한 분석 뷰(View) 3종
1. `v_daily_cash_flow`: 시설 전체 통장을 아우르는 일자별 자금 흐름 요약 일계표
2. `v_budget_execution_status`: 관-항-목별 예산현액 대비 실집행액, 잔여액, 집행률(%) 실시간 계산
3. `v_w4c_export_vouchers`: W4C(희망이음) 엑셀 일괄 업로드용 평탄화(Flat) 데이터셋
