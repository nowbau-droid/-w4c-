import { BankTransaction, Receipt, W4CAccountCode } from "@/types/accounting";

/**
 * [요양 w4c 노트] 스마트 통장-영수증 매칭 및 적요 추천 엔진
 */

export interface MatchScoreResult {
  transaction: BankTransaction;
  receipt: Receipt;
  score: number; // 0 ~ 100 점
  matchType: "PERFECT" | "HIGH" | "MEDIUM" | "NONE";
  reasons: string[];
}

export interface QuickPreset {
  id: string;
  label: string;
  categoryCodeId: string;
  descriptionTemplate: (counterpartyOrDesc: string) => string;
}

/**
 * 자주 쓰는 퀵 적요 프리셋 목록 (영수증 미첨부 시 1초 결의용)
 */
export const QUICK_PRESETS: QuickPreset[] = [
  {
    id: "preset-food",
    label: "🥬 식자재 재료 구입",
    categoryCodeId: "exp-01-03-05", // 급식비(식자재비)
    descriptionTemplate: (name) => `[${name || "식자재마트"}] 어르신 급식용 식재료(주·부식) 구입`,
  },
  {
    id: "preset-snack",
    label: "🍎 어르신 간식/다과",
    categoryCodeId: "exp-01-03-05",
    descriptionTemplate: (name) => `[${name || "마트"}] 입소 어르신 일상 다과 및 간식 구입`,
  },
  {
    id: "preset-consumable",
    label: "🧻 소모품/생필품 구입",
    categoryCodeId: "exp-01-03-01", // 수용비 및 수수료
    descriptionTemplate: (name) => `[${name || "다이소"}] 시설 위생관리용 소모품 및 생필품 구입`,
  },
  {
    id: "preset-repair",
    label: "🔧 시설 수리/유지보수",
    categoryCodeId: "exp-01-03-07", // 시설유지비
    descriptionTemplate: (name) => `[${name || "수리업체"}] 원내 시설물 긴급 보수 및 유지관리`,
  },
  {
    id: "preset-utility",
    label: "💡 공과금 자동이체",
    categoryCodeId: "exp-01-03-02", // 공공요금 및 제세공과금
    descriptionTemplate: (name) => `[${name || "한국전력"}] 시설 정기 공공요금 납부`,
  },
  {
    id: "preset-fuel",
    label: "⛽ 송영차량 유류비",
    categoryCodeId: "exp-01-03-04", // 차량비
    descriptionTemplate: (name) => `[${name || "주유소"}] 기관 송영차량 주유 및 유류대 결제`,
  },
];

/**
 * 두 날짜 사이의 일수 차이 계산
 */
function getDaysDiff(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 단일 영수증에 대해 다중 통장 미매칭 출금 내역 중 최적 후보 탐색 및 채점
 */
export function findBestMatchesForReceipt(
  receipt: Receipt,
  transactions: BankTransaction[]
): MatchScoreResult[] {
  if (!receipt.total_amount || !receipt.receipt_date) return [];

  const candidates: MatchScoreResult[] = [];

  for (const tx of transactions) {
    // 입금 내역이거나 이미 매칭 완료된 건은 제외
    if (tx.withdraw_amount <= 0 || !["UNMATCHED", "PARTIALLY_MATCHED"].includes(tx.match_status)) continue;

    let score = 0;
    const reasons: string[] = [];

    // 1. 금액 일치 검사 (가장 중요: 60점 만점)
    if (tx.withdraw_amount === receipt.total_amount) {
      score += 60;
      reasons.push("금액 100% 일치");
    } else if (Math.abs(tx.withdraw_amount - receipt.total_amount) < 1000) {
      score += 30;
      reasons.push("금액 1,000원 이내 근접");
    }

    // 2. 일자 검사 (최대 30점)
    const daysDiff = getDaysDiff(receipt.receipt_date, tx.transaction_date);
    if (daysDiff === 0) {
      score += 30;
      reasons.push("결제일 당일 출금");
    } else if (daysDiff <= 2) {
      score += 20;
      reasons.push(`결제일 ±${daysDiff}일 이내 출금`);
    } else if (daysDiff <= 5) {
      score += 10;
      reasons.push(`결제일 ±${daysDiff}일 시차`);
    }

    // 3. 상호명 / 통장 적요 텍스트 유사도 검사 (최대 10점)
    if (receipt.vendor_name && tx.description) {
      const vendorClean = receipt.vendor_name.replace(/\s+/g, "").toLowerCase();
      const descClean = tx.description.replace(/\s+/g, "").toLowerCase();
      if (descClean.includes(vendorClean) || vendorClean.includes(descClean)) {
        score += 10;
        reasons.push("상호명 및 통장적요 일치");
      }
    }

    let matchType: MatchScoreResult["matchType"] = "NONE";
    if (score >= 90) matchType = "PERFECT";
    else if (score >= 70) matchType = "HIGH";
    else if (score >= 50) matchType = "MEDIUM";

    if (score >= 50) {
      candidates.push({
        transaction: tx,
        receipt,
        score,
        matchType,
        reasons,
      });
    }
  }

  // 높은 점수순 정렬
  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * W4C 감사 기준 표준 적요 자동 조합기
 * 규칙: [상호명] 대표 품목 요약 (용도/목적)
 */
export function generateStandardDescription(
  vendorName?: string,
  items?: { name: string }[],
  defaultPurpose = "어르신 일상 케어용 물품 구입"
): string {
  const vendor = vendorName ? vendorName.trim() : "거래처";
  
  if (items && items.length > 0) {
    const itemNames = items.slice(0, 2).map((i) => i.name).join(", ");
    const extraCount = items.length > 2 ? ` 외 ${items.length - 2}건` : "";
    return `[${vendor}] ${itemNames}${extraCount} 구입`;
  }

  return `[${vendor}] ${defaultPurpose}`;
}
