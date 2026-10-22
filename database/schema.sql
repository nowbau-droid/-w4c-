-- ==============================================================================
-- [요양 w4c 노트] 데이터베이스 스키마 (PostgreSQL / Supabase DDL)
-- 
-- 주요 특징:
-- 1. 1원 단위 정밀도 보장: 금액 컬럼 NUMERIC(15, 2) 적용
-- 2. 다중 통장 원장 기반 일자별 잔액 통제 (W4C 일자별 일계표 수지일치)
-- 3. 1:N, N:1 및 복합 분할 매칭 지원 (voucher_transaction_matches)
-- 4. 사회복지법인 및 사회복지시설 재무·회계규칙 관-항-목 표준화
-- 5. 내부 자금 대체(통장 간 전입/전출) 전표 구분 및 세출 왜곡 방지
-- ==============================================================================

-- UUID 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. 시설 기본 정보 및 회계 설정 (facility_settings)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS facility_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_name VARCHAR(100) NOT NULL,                 -- 시설명 (예: 온누리요양원)
    facility_code VARCHAR(50),                          -- W4C(희망이음) 시설코드
    business_number VARCHAR(20),                        -- 사업자등록번호 / 고유번호
    representative_name VARCHAR(50),                    -- 대표자/원장명
    target_labor_ratio NUMERIC(5, 2) DEFAULT 61.40,     -- 법정 인건비 권장/의무 비율(%) (노인요양시설 61.4%)
    fiscal_year_start_month INT DEFAULT 1,              -- 회계연도 시작월 (기본 1월)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 2. 관-항-목 마스터 (w4c_account_codes)
-- 사회복지시설 재무회계규칙(노인복지시설 세입·세출 예산과목)
-- ==============================================================================
CREATE TYPE account_direction_type AS ENUM ('REVENUE', 'EXPENDITURE'); -- 세입 / 세출

CREATE TABLE IF NOT EXISTS w4c_account_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    direction account_direction_type NOT NULL,          -- 세입(REVENUE) / 세출(EXPENDITURE)
    gwan_code VARCHAR(10) NOT NULL,                     -- 관 코드 (예: 01)
    gwan_name VARCHAR(50) NOT NULL,                     -- 관 명 (예: 사무비)
    hang_code VARCHAR(10) NOT NULL,                     -- 항 코드 (예: 01)
    hang_name VARCHAR(50) NOT NULL,                     -- 항 명 (예: 인건비)
    mok_code VARCHAR(10) NOT NULL,                      -- 목 코드 (예: 01)
    mok_name VARCHAR(50) NOT NULL,                      -- 목 명 (예: 기본급)
    code_display VARCHAR(30) GENERATED ALWAYS AS (gwan_code || '-' || hang_code || '-' || mok_code) STORED, -- 01-01-01
    full_name VARCHAR(150) GENERATED ALWAYS AS (gwan_name || ' > ' || hang_name || ' > ' || mok_name) STORED,
    is_labor_cost BOOLEAN DEFAULT FALSE,                -- 인건비 지출비율 산정 포함 여부
    description TEXT,                                   -- 비고 및 과목 해설
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_w4c_account_codes UNIQUE (direction, gwan_code, hang_code, mok_code)
);

CREATE INDEX idx_w4c_codes_direction ON w4c_account_codes(direction);
CREATE INDEX idx_w4c_codes_display ON w4c_account_codes(code_display);

-- ==============================================================================
-- 3. 다중 통장 계좌 마스터 (accounts)
-- ==============================================================================
CREATE TYPE account_usage_type AS ENUM (
    'OPERATING',         -- 운영비 통장 (주거래)
    'FOOD',              -- 식자재비 전용 통장
    'DONATION',          -- 후원금 통장
    'SUBSIDY',           -- 지자체 보조금 통장
    'RETIREMENT',        -- 퇴직적립금 통장
    'DEPOSIT',           -- 보증금/정기예금
    'OTHER'              -- 기타 통장
);

CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID REFERENCES facility_settings(id) ON DELETE CASCADE,
    bank_name VARCHAR(50) NOT NULL,                     -- 은행명 (예: 국민은행, 신한은행)
    account_number VARCHAR(50) NOT NULL,                -- 계좌번호 (하이픈 포함 가능)
    account_name VARCHAR(100) NOT NULL,                 -- 통장 별칭 (예: 운영비 주거래, 식자재통장)
    account_usage account_usage_type NOT NULL DEFAULT 'OPERATING',
    initial_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,  -- 회계연도 시작 기초 잔액
    current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,  -- 현재 실시간 잔액
    color_hex VARCHAR(10) DEFAULT '#3B82F6',            -- UI 구분용 뱃지 색상
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_account_number UNIQUE (account_number)
);

-- ==============================================================================
-- 4. 본예산 및 추경 마스터 & 세부 항목 (budget_plans, budget_items)
-- ==============================================================================
CREATE TYPE budget_status AS ENUM ('DRAFT', 'CONFIRMED', 'ARCHIVED');

CREATE TABLE IF NOT EXISTS budget_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID REFERENCES facility_settings(id) ON DELETE CASCADE,
    fiscal_year INT NOT NULL,                           -- 회계연도 (예: 2026)
    round_no INT NOT NULL DEFAULT 0,                    -- 예산 차수 (0: 본예산, 1: 1차추경, 2: 2차추경 ...)
    title VARCHAR(100) NOT NULL,                        -- 예: 2026년도 본예산, 2026년도 제1회 추가경정예산
    status budget_status NOT NULL DEFAULT 'DRAFT',
    confirmed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_fiscal_year_round UNIQUE (fiscal_year, round_no)
);

CREATE TABLE IF NOT EXISTS budget_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    budget_plan_id UUID NOT NULL REFERENCES budget_plans(id) ON DELETE CASCADE,
    account_code_id UUID NOT NULL REFERENCES w4c_account_codes(id),
    allocated_amount NUMERIC(15, 2) NOT NULL DEFAULT 0, -- 편성 예산액
    transferred_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,-- 목간 전용 증감액 (+ 또는 -)
    current_budget NUMERIC(15, 2) GENERATED ALWAYS AS (allocated_amount + transferred_amount) STORED, -- 최종 예산현액
    executed_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,  -- 실집행 누계액
    calculation_basis TEXT,                             -- 산출 내역 (예: 2,500,000원 * 5명 * 12개월)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_budget_item_code UNIQUE (budget_plan_id, account_code_id)
);

CREATE INDEX idx_budget_items_plan ON budget_items(budget_plan_id);

-- ==============================================================================
-- 5. 예산 목간 전용 이력 관리 (budget_transfers)
-- 사회복지시설 회계규칙: 동일 '항' 내에서만 전용 가능
-- ==============================================================================
CREATE TABLE IF NOT EXISTS budget_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fiscal_year INT NOT NULL,
    transfer_date DATE NOT NULL,
    from_budget_item_id UUID NOT NULL REFERENCES budget_items(id), -- 감액 과목
    to_budget_item_id UUID NOT NULL REFERENCES budget_items(id),   -- 증액 과목
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,                                          -- 전용 사유
    approval_status VARCHAR(20) DEFAULT 'APPROVED',
    document_url TEXT,                                             -- 전용결의 품의서 스캔 파일 URL
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. 통장 거래 원장 (bank_transactions)
-- 은행 엑셀/CSV 파싱 원천 데이터
-- ==============================================================================
CREATE TYPE transaction_match_status AS ENUM (
    'UNMATCHED',            -- 미매칭 (대기)
    'PARTIALLY_MATCHED',    -- 일부 매칭 (분할 결제 중 잔여금액 있음)
    'FULLY_MATCHED',        -- 매칭 완료
    'INTERNAL_TRANSFER',    -- 내부 통장 대체 (운영비 ➔ 식자재 등)
    'IGNORED'               -- 대상 제외 (이자/단순오류 수기제외 등)
);

CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,                     -- 거래일자 (YYYY-MM-DD)
    transaction_time TIME,                              -- 거래시간 (HH:MM:SS, 있을 경우)
    deposit_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,   -- 입금액
    withdraw_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,  -- 출금액
    description TEXT NOT NULL,                          -- 통장 인쇄 적요 (통장표시문구)
    counterparty VARCHAR(100),                          -- 송금인/수취인명
    balance_after NUMERIC(15, 2) NOT NULL,              -- 거래 후 통장 잔액
    transaction_hash VARCHAR(64) NOT NULL,              -- 중복 업로드 방지용 해시 (SHA256(account_id, date, withdraw, deposit, balance, desc))
    match_status transaction_match_status NOT NULL DEFAULT 'UNMATCHED',
    matched_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,   -- 현재까지 결의서와 매칭된 누적 금액
    unmatched_balance NUMERIC(15, 2) GENERATED ALWAYS AS (GREATEST(deposit_amount, withdraw_amount) - matched_amount) STORED, -- 미매칭 잔여액
    raw_payload JSONB,                                  -- 원본 엑셀 행 데이터 저장
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_transaction_hash UNIQUE (account_id, transaction_hash)
);

CREATE INDEX idx_bank_tx_account_date ON bank_transactions(account_id, transaction_date);
CREATE INDEX idx_bank_tx_status ON bank_transactions(match_status);

-- ==============================================================================
-- 7. 증빙 및 영수증 (receipts)
-- 모바일/웹 업로드 및 Gemini OCR 추출 데이터
-- ==============================================================================
CREATE TYPE ocr_status_type AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID REFERENCES facility_settings(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,                            -- 저장소(Supabase Storage/S3) 이미지 경로
    receipt_date DATE,                                  -- 영수증 발급 일자
    vendor_name VARCHAR(100),                           -- 가맹점/상호명 (예: 홈플러스, 쿠팡)
    vendor_registration_number VARCHAR(30),             -- 사업자번호
    total_amount NUMERIC(15, 2),                        -- 총 결제금액
    supply_amount NUMERIC(15, 2),                       -- 공급가액
    vat_amount NUMERIC(15, 2),                          -- 부가세
    payment_method VARCHAR(50),                         -- 결제수단 (카드, 현금영수증, 간이)
    card_approval_number VARCHAR(50),                   -- 카드 승인번호
    suggested_account_code_id UUID REFERENCES w4c_account_codes(id), -- AI 추천 계정과목
    items_json JSONB,                                   -- 품목 상세 리스트 ([{name, qty, price, total}])
    ocr_raw_text TEXT,                                  -- 원본 OCR 텍스트
    ocr_status ocr_status_type NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_receipts_date ON receipts(receipt_date);
CREATE INDEX idx_receipts_vendor ON receipts(vendor_name);

-- ==============================================================================
-- 8. 세입·세출 결의서 및 내부대체 전표 (vouchers)
-- W4C 전표와 1:1로 매핑되는 최종 회계 전표
-- ==============================================================================
CREATE TYPE voucher_type_enum AS ENUM (
    'REVENUE',              -- 세입결의서
    'EXPENDITURE',          -- 세출결의서
    'INTERNAL_TRANSFER'     -- 내부 자금 대체 (비용/수입 불산입)
);

CREATE TYPE voucher_status_enum AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID REFERENCES facility_settings(id) ON DELETE CASCADE,
    voucher_no VARCHAR(50) NOT NULL,                    -- 전표번호 (예: 20261022-EXP-001)
    voucher_date DATE NOT NULL,                         -- 결의 일자
    voucher_type voucher_type_enum NOT NULL,            -- 전표 구분
    account_code_id UUID REFERENCES w4c_account_codes(id), -- 관-항-목 (내부대체시 NULL 허용)
    budget_item_id UUID REFERENCES budget_items(id),    -- 연결된 예산 항목 (세출/세입 집행 반영)
    
    -- 자금 이동 통장 정보
    account_id UUID NOT NULL REFERENCES accounts(id),   -- 원인 통장 (세출시 출금통장, 세입시 입금통장)
    target_account_id UUID REFERENCES accounts(id),     -- 내부대체 시 상대 통장 (입금 통장)
    
    total_amount NUMERIC(15, 2) NOT NULL CHECK (total_amount > 0), -- 전표 총액
    supply_amount NUMERIC(15, 2) DEFAULT 0,
    vat_amount NUMERIC(15, 2) DEFAULT 0,
    
    standard_description VARCHAR(200) NOT NULL,         -- 표준 적요: [거래처] 품목/용도 (예: [식자재마트] 10월 2주차 어르신 식재료 구입)
    vendor_name VARCHAR(100),                           -- 거래처명
    evidence_type VARCHAR(30) DEFAULT '신용카드',         -- 증빙구분 (세금계산서, 계산서, 카드전표, 현금영수증, 간이)
    
    status voucher_status_enum NOT NULL DEFAULT 'CONFIRMED',
    is_w4c_exported BOOLEAN NOT NULL DEFAULT FALSE,     -- W4C 엑셀 내보내기 완료 여부
    w4c_exported_at TIMESTAMPTZ,
    
    created_by VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_voucher_no UNIQUE (facility_id, voucher_no)
);

CREATE INDEX idx_vouchers_date ON vouchers(voucher_date);
CREATE INDEX idx_vouchers_account ON vouchers(account_id);
CREATE INDEX idx_vouchers_type ON vouchers(voucher_type);

-- ==============================================================================
-- 9. 결의서 - 통장거래 - 영수증 다대다(N:M) 분할 매칭 테이블 (voucher_transaction_matches)
-- 실무 핵심 해결: 1 영수증 : N 통장출금, 1 통장출금 : N 영수증 분할 매칭 지원
-- ==============================================================================
CREATE TABLE IF NOT EXISTS voucher_transaction_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_id UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    bank_transaction_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
    receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL, -- 영수증 없이 통장 출금만 있는 경우(이자 등) NULL 허용
    matched_amount NUMERIC(15, 2) NOT NULL CHECK (matched_amount > 0), -- 이 결합에 배정된 분할 금액
    match_notes VARCHAR(200),                           -- 분할 사유 (예: 영수증 35만 중 20만 운영비 결제분)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_voucher_tx_receipt UNIQUE (voucher_id, bank_transaction_id, receipt_id)
);

CREATE INDEX idx_match_voucher ON voucher_transaction_matches(voucher_id);
CREATE INDEX idx_match_tx ON voucher_transaction_matches(bank_transaction_id);
CREATE INDEX idx_match_receipt ON voucher_transaction_matches(receipt_id);

-- ==============================================================================
-- 10. 일자별 통장 마감 잔액 스냅샷 (daily_account_balances)
-- W4C 일자별 일계표 수지일치 검증의 핵심 테이블
-- ==============================================================================
CREATE TABLE IF NOT EXISTS daily_account_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    balance_date DATE NOT NULL,                         -- 일자
    previous_balance NUMERIC(15, 2) NOT NULL,           -- 전일 이월 잔액
    daily_deposit NUMERIC(15, 2) NOT NULL DEFAULT 0,    -- 당일 입금 합계
    daily_withdraw NUMERIC(15, 2) NOT NULL DEFAULT 0,   -- 당일 출금 합계
    closing_balance NUMERIC(15, 2) NOT NULL,            -- 당일 마감 잔액 (전일 + 입금 - 출금)
    bank_statement_balance NUMERIC(15, 2),              -- 실제 은행 통장 원장의 해당일 최종 잔액
    is_reconciled BOOLEAN GENERATED ALWAYS AS (closing_balance = bank_statement_balance) STORED, -- 1원 단위 일치 여부
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_daily_account_date UNIQUE (account_id, balance_date)
);

CREATE INDEX idx_daily_balances_date ON daily_account_balances(balance_date);

-- ==============================================================================
-- 11. 핵심 뷰 (Views)
-- ==============================================================================

-- [View 1] 일자별 통합 수지 일계표 뷰 (시설 전체 및 계좌별 수지 종합)
CREATE OR REPLACE VIEW v_daily_cash_flow AS
SELECT 
    d.balance_date,
    COUNT(DISTINCT d.account_id) AS total_accounts_count,
    SUM(d.previous_balance) AS total_previous_balance,
    SUM(d.daily_deposit) AS total_daily_deposit,
    SUM(d.daily_withdraw) AS total_daily_withdraw,
    SUM(d.closing_balance) AS total_closing_balance,
    BOOL_AND(COALESCE(d.is_reconciled, false)) AS is_all_accounts_reconciled
FROM daily_account_balances d
GROUP BY d.balance_date
ORDER BY d.balance_date DESC;

-- [View 2] 예산 대비 실시간 집행 현황 뷰 (Budget Control View)
CREATE OR REPLACE VIEW v_budget_execution_status AS
SELECT 
    bp.fiscal_year,
    bp.round_no,
    bp.title AS budget_title,
    ac.direction,
    ac.gwan_name,
    ac.hang_name,
    ac.mok_name,
    ac.code_display,
    ac.is_labor_cost,
    bi.allocated_amount,
    bi.transferred_amount,
    bi.current_budget,
    COALESCE(SUM(v.total_amount), 0) AS actual_executed_amount,
    (bi.current_budget - COALESCE(SUM(v.total_amount), 0)) AS remaining_budget,
    CASE 
        WHEN bi.current_budget > 0 THEN 
            ROUND((COALESCE(SUM(v.total_amount), 0) / bi.current_budget) * 100, 2)
        ELSE 0 
    END AS execution_rate_percent
FROM budget_items bi
JOIN budget_plans bp ON bi.budget_plan_id = bp.id
JOIN w4c_account_codes ac ON bi.account_code_id = ac.id
LEFT JOIN vouchers v ON v.budget_item_id = bi.id AND v.status = 'CONFIRMED'
GROUP BY bp.fiscal_year, bp.round_no, bp.title, ac.direction, ac.gwan_name, ac.hang_name, ac.mok_name, ac.code_display, ac.is_labor_cost, bi.allocated_amount, bi.transferred_amount, bi.current_budget;

-- [View 3] W4C 엑셀 내보내기용 전표 플랫 뷰
CREATE OR REPLACE VIEW v_w4c_export_vouchers AS
SELECT 
    v.id AS voucher_id,
    v.voucher_date,
    v.voucher_no,
    CASE v.voucher_type
        WHEN 'REVENUE' THEN '세입'
        WHEN 'EXPENDITURE' THEN '세출'
        WHEN 'INTERNAL_TRANSFER' THEN '내부대체'
    END AS voucher_type_label,
    ac.code_display AS account_code,
    ac.gwan_name,
    ac.hang_name,
    ac.mok_name,
    v.total_amount,
    v.supply_amount,
    v.vat_amount,
    v.vendor_name,
    v.standard_description,
    v.evidence_type,
    a.bank_name,
    a.account_name,
    a.account_number,
    v.is_w4c_exported
FROM vouchers v
LEFT JOIN w4c_account_codes ac ON v.account_code_id = ac.id
JOIN accounts a ON v.account_id = a.id
WHERE v.status = 'CONFIRMED'
ORDER BY v.voucher_date ASC, v.voucher_no ASC;

-- ==============================================================================
-- 12. 통장 거래 매칭 상태 자동 업데이트 함수 & 트리거
-- ==============================================================================
CREATE OR REPLACE FUNCTION fn_update_transaction_match_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_total_tx_amount NUMERIC(15, 2);
    v_matched_sum NUMERIC(15, 2);
    v_target_tx_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_target_tx_id := OLD.bank_transaction_id;
    ELSE
        v_target_tx_id := NEW.bank_transaction_id;
    END IF;

    -- 해당 거래의 총 금액(입금 또는 출금)
    SELECT GREATEST(deposit_amount, withdraw_amount)
    INTO v_total_tx_amount
    FROM bank_transactions
    WHERE id = v_target_tx_id;

    -- 현재까지 매칭된 총액 계산
    SELECT COALESCE(SUM(matched_amount), 0)
    INTO v_matched_sum
    FROM voucher_transaction_matches
    WHERE bank_transaction_id = v_target_tx_id;

    -- 상태 갱신
    UPDATE bank_transactions
    SET 
        matched_amount = v_matched_sum,
        match_status = CASE 
            WHEN v_matched_sum = 0 THEN 'UNMATCHED'::transaction_match_status
            WHEN v_matched_sum < v_total_tx_amount THEN 'PARTIALLY_MATCHED'::transaction_match_status
            WHEN v_matched_sum >= v_total_tx_amount THEN 'FULLY_MATCHED'::transaction_match_status
        END
    WHERE id = v_target_tx_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_after_voucher_match_change
AFTER INSERT OR UPDATE OR DELETE ON voucher_transaction_matches
FOR EACH ROW EXECUTE FUNCTION fn_update_transaction_match_progress();
