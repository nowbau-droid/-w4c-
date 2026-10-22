/**
 * [요양 w4c 노트] 회계 및 데이터베이스 핵심 TypeScript 타입 정의
 * database/schema.sql 과 100% 매핑되는 모델
 */

// 1. 시설 기본 정보
export interface FacilitySettings {
  id: string;
  facility_name: string;
  facility_code?: string;
  business_number?: string;
  representative_name?: string;
  target_labor_ratio: number; // 기본 61.4%
  fiscal_year_start_month: number;
  created_at: string;
  updated_at: string;
}

// 2. 관-항-목 계정과목
export type AccountDirectionType = 'REVENUE' | 'EXPENDITURE'; // 세입 / 세출

export interface W4CAccountCode {
  id: string;
  direction: AccountDirectionType;
  gwan_code: string;
  gwan_name: string;
  hang_code: string;
  hang_name: string;
  mok_code: string;
  mok_name: string;
  code_display: string; // "01-01-01"
  full_name: string;    // "사무비 > 인건비 > 기본급"
  is_labor_cost: boolean; // 인건비 지출비율 산정 포함 여부
  description?: string;
  is_active: boolean;
}

// 3. 다중 통장 계좌
export type AccountUsageType = 
  | 'OPERATING'   // 운영비 통장
  | 'FOOD'        // 식자재 통장
  | 'DONATION'    // 후원금 통장
  | 'SUBSIDY'     // 보조금 통장
  | 'RETIREMENT'  // 퇴직적립 통장
  | 'DEPOSIT'     // 정기예금/보증금
  | 'OTHER';

export interface BankAccount {
  id: string;
  facility_id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  account_usage: AccountUsageType;
  initial_balance: number;
  current_balance: number;
  color_hex: string;
  is_active: boolean;
  display_order: number;
}

// 4. 통장 거래 원장 (은행 엑셀 파싱 데이터)
export type TransactionMatchStatus = 
  | 'UNMATCHED'           // 미매칭
  | 'PARTIALLY_MATCHED'   // 분할 매칭 진행 중 (잔여액 있음)
  | 'FULLY_MATCHED'       // 매칭 완료
  | 'INTERNAL_TRANSFER'   // 통장 간 내부 대체
  | 'IGNORED';            // 제외

export interface BankTransaction {
  id: string;
  account_id: string;
  account_name?: string;  // 조인용
  transaction_date: string; // YYYY-MM-DD
  transaction_time?: string;
  deposit_amount: number;
  withdraw_amount: number;
  description: string;
  counterparty?: string;
  balance_after: number;
  transaction_hash: string;
  match_status: TransactionMatchStatus;
  matched_amount: number;
  unmatched_balance: number;
  created_at: string;
}

// 5. 영수증 및 증빙 (Gemini OCR 결과)
export type OcrStatusType = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ReceiptItem {
  name: string;
  qty?: number;
  price?: number;
  total: number;
}

export interface Receipt {
  id: string;
  facility_id: string;
  image_url: string;
  receipt_date?: string; // YYYY-MM-DD
  vendor_name?: string;
  vendor_registration_number?: string;
  total_amount?: number;
  supply_amount?: number;
  vat_amount?: number;
  payment_method?: string; // 카드, 현금, 간이
  card_approval_number?: string;
  suggested_account_code_id?: string;
  suggested_description?: string;
  items?: ReceiptItem[];
  ocr_status: OcrStatusType;
  created_at: string;
}

// 6. 회계 결의서 전표 (W4C 결의서)
export type VoucherType = 'REVENUE' | 'EXPENDITURE' | 'INTERNAL_TRANSFER';
export type VoucherStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export interface Voucher {
  id: string;
  facility_id: string;
  voucher_no: string;     // 예: 20261022-EXP-001
  voucher_date: string;   // YYYY-MM-DD
  voucher_type: VoucherType;
  account_code_id?: string;
  account_code?: W4CAccountCode; // 조인용
  budget_item_id?: string;
  
  account_id: string;         // 출금(지출) or 입금(수입) 통장
  account?: BankAccount;      // 조인용
  target_account_id?: string; // 내부 대체 시 상대 통장
  
  total_amount: number;
  supply_amount: number;
  vat_amount: number;
  
  standard_description: string; // 표준 적요
  vendor_name?: string;
  evidence_type: string;        // 신용카드, 세금계산서 등
  
  status: VoucherStatus;
  is_w4c_exported: boolean;
  w4c_exported_at?: string;
  
  // 영수증 연결 여부
  receipt_id?: string;
  transaction_id?: string;
  
  created_at: string;
  updated_at: string;
}

// 7. 결의서 - 통장거래 - 영수증 분할 매칭 매핑
export interface VoucherTransactionMatch {
  id: string;
  voucher_id: string;
  bank_transaction_id: string;
  receipt_id?: string;
  matched_amount: number;
  match_notes?: string;
  created_at: string;
}

// 8. 일자별 통장 마감 잔액 스냅샷 (W4C 일계표 대사)
export interface DailyAccountBalance {
  id: string;
  account_id: string;
  balance_date: string; // YYYY-MM-DD
  previous_balance: number;
  daily_deposit: number;
  daily_withdraw: number;
  closing_balance: number;
  bank_statement_balance?: number;
  is_reconciled: boolean;
  updated_at: string;
}

// 9. 예산 편성 및 현액
export interface BudgetItem {
  id: string;
  budget_plan_id: string;
  account_code_id: string;
  account_code: W4CAccountCode;
  allocated_amount: number;     // 편성액
  transferred_amount: number;   // 전용증감액
  current_budget: number;       // 예산현액
  executed_amount: number;      // 실집행액
  remaining_budget: number;     // 잔여예산
  execution_rate_percent: number; // 집행률(%)
}
