import { BankTransaction } from "@/types/accounting";

/**
 * 은행 엑셀 행을 표준 BankTransaction 객체로 변환하는 정규화 엔진
 */

export interface RawBankRow {
  [key: string]: any;
}

// 지원 은행 표준 컬럼 별칭 매핑
const COLUMN_ALIASES = {
  date: ["거래일자", "거래일", "거래일시", "일자", "거래날짜", "Date"],
  time: ["거래시간", "시간", "Time"],
  withdraw: ["출금액", "지급액", "보내신금액", "출금", "Withdraw"],
  deposit: ["입금액", "맡기신금액", "받으신금액", "입금", "Deposit"],
  description: ["적요", "통장기재내용", "내용", "거래내용", "기재문구", "적요란", "Description"],
  counterparty: ["거래처", "송금인/수취인", "보낸분/받는분", "상대계좌예금주명", "의뢰인/수취인"],
  balance: ["거래후잔액", "잔액", "거래후 잔액", "남은금액", "Balance"],
};

/**
 * 단순 해시 생성기 (브라우저/서버 공용: 중복 업로드 방지용)
 */
export function generateTransactionHash(
  accountId: string,
  date: string,
  withdraw: number,
  deposit: number,
  balance: number,
  desc: string
): string {
  const raw = `${accountId}_${date}_W${withdraw}_D${deposit}_B${balance}_${desc.trim()}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // 32bit 정수 변환
  }
  return `tx_${Math.abs(hash).toString(36)}_${raw.length}`;
}

/**
 * 문자열에서 숫자(금액)만 안전하게 추출 (쉼표, 원, 공백 제거)
 */
export function parseAmount(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * 날짜 문자열을 YYYY-MM-DD 표준 형식으로 정규화
 * 지원 형식: 2026-10-22, 2026.10.22, 2026/10/22, 20261022 등
 */
export function normalizeDate(val: any): string {
  if (!val) throw new Error("거래일자가 없습니다.");
  if (typeof val === "number" && val > 20000 && val < 100000) {
    return new Date(Date.UTC(1899, 11, 30) + val * 86400000).toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  const parts = str.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  const digits = parts ? parts[1] + parts[2].padStart(2, "0") + parts[3].padStart(2, "0") : str.replace(/[^0-9]/g, "");
  
  if (digits.length >= 8) {
    const y = digits.slice(0, 4);
    const m = digits.slice(4, 6);
    const d = digits.slice(6, 8);
    const result = `${y}-${m}-${d}`;
    const parsed = new Date(result);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === result) return result;
  }
  throw new Error(`거래일자 형식을 확인하세요: ${str}`);
}

/**
 * 은행 엑셀 파싱 메인 함수
 */
export function parseBankExcelRows(
  rows: RawBankRow[],
  accountId: string,
  accountName?: string
): BankTransaction[] {
  if (!rows || rows.length === 0) return [];

  const firstRow = rows[0];
  const keys = Object.keys(firstRow);

  // 헤더 매핑 찾기
  const findKey = (aliases: string[]) => keys.find((k) => aliases.some((a) => k.includes(a)));

  const dateKey = findKey(COLUMN_ALIASES.date) || "거래일자";
  const timeKey = findKey(COLUMN_ALIASES.time);
  const withdrawKey = findKey(COLUMN_ALIASES.withdraw) || "출금액";
  const depositKey = findKey(COLUMN_ALIASES.deposit) || "입금액";
  const descKey = findKey(COLUMN_ALIASES.description) || "적요";
  const counterKey = findKey(COLUMN_ALIASES.counterparty);
  const balanceKey = findKey(COLUMN_ALIASES.balance) || "잔액";
  if (!findKey(COLUMN_ALIASES.date) || !findKey(COLUMN_ALIASES.balance) || (!findKey(COLUMN_ALIASES.withdraw) && !findKey(COLUMN_ALIASES.deposit))) {
    throw new Error("필수 열이 없습니다. 거래일자, 출금액/입금액, 잔액 열을 확인하세요.");
  }

  const transactions: BankTransaction[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r[dateKey] && !r[withdrawKey] && !r[depositKey]) continue;
    const dateStr = normalizeDate(r[dateKey]);
    const withdraw = parseAmount(r[withdrawKey]);
    const deposit = parseAmount(r[depositKey]);
    const balance = parseAmount(r[balanceKey]);
    if (r[balanceKey] === undefined || r[balanceKey] === "" || ![withdraw, deposit, balance].every(Number.isSafeInteger) || withdraw < 0 || deposit < 0 || (withdraw > 0 && deposit > 0)) {
      throw new Error(`${i + 2}행: 정수 금액, 입출금 구분 및 잔액을 확인하세요.`);
    }
    const desc = String(r[descKey] || "").trim();
    const counterparty = counterKey ? String(r[counterKey] || "").trim() : undefined;
    const timeStr = timeKey ? String(r[timeKey] || "").trim() : undefined;

    // 입금도 출금도 없는 무효 행 제외
    if (withdraw === 0 && deposit === 0) continue;

    const txHash = generateTransactionHash(accountId, dateStr + (timeStr || ""), withdraw, deposit, balance, desc);

    transactions.push({
      id: `tx_${Date.now()}_${i}`,
      account_id: accountId,
      account_name: accountName,
      transaction_date: dateStr,
      transaction_time: timeStr,
      withdraw_amount: withdraw,
      deposit_amount: deposit,
      description: desc || "통장 미기재",
      counterparty,
      balance_after: balance,
      transaction_hash: txHash,
      match_status: "UNMATCHED",
      matched_amount: 0,
      unmatched_balance: Math.max(withdraw, deposit),
      created_at: new Date().toISOString(),
    });
  }

  // 날짜 오름차순(과거 -> 최신) 정렬
  return transactions.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
}
