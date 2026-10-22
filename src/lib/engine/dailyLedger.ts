import { BankAccount, BankTransaction } from "@/types/accounting";
export interface DailyLedgerRow {
  date: string; previousBalance: number; totalDeposit: number; totalWithdraw: number;
  closingBalance: number; bankStatementBalance?: number; isReconciled: boolean;
  hasNegativeBalance: boolean; transactionsCount: number;
}
export interface MonthlyReconciliationSummary {
  yearMonth: string; initialMonthBalance: number; totalMonthRevenue: number; totalMonthExpense: number;
  finalClosingBalance: number; isMonthAllReconciled: boolean; negativeDaysCount: number;
  unreconciledDaysCount: number; dailyRows: DailyLedgerRow[];
}
// initialBalance is the opening balance of the requested month. All accounts are
// needed for aggregate reconciliation; a single account's last balance cannot represent the facility.
export function calculateMonthlyDailyLedger(year: number, month: number, account: BankAccount | null,
  transactions: BankTransaction[], initialBalance: number, accounts: BankAccount[] = []): MonthlyReconciliationSummary {
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
  const scoped = transactions.filter(t => (!account || t.account_id === account.id) && t.transaction_date.startsWith(yearMonth))
    .sort((a,b) => `${a.transaction_date} ${a.transaction_time || ""}`.localeCompare(`${b.transaction_date} ${b.transaction_time || ""}`));
  const balances = new Map<string, number>();
  if (account) balances.set(account.id, initialBalance);
  else accounts.forEach(a => {
    const prior = transactions.filter(t => t.account_id === a.id && t.transaction_date < `${yearMonth}-01`);
    balances.set(a.id, a.initial_balance + prior.reduce((s,t) => s + t.deposit_amount - t.withdraw_amount, 0));
  });
  let running = initialBalance;
  const dailyRows: DailyLedgerRow[] = [];
  for (let day=1; day<=new Date(year,month,0).getDate(); day++) {
    const date = `${yearMonth}-${String(day).padStart(2,"0")}`;
    const list = scoped.filter(t => t.transaction_date === date);
    const totalDeposit = list.reduce((s,t)=>s+t.deposit_amount,0);
    const totalWithdraw = list.reduce((s,t)=>s+t.withdraw_amount,0);
    const previousBalance = running;
    running += totalDeposit-totalWithdraw;
    list.forEach(t => balances.set(t.account_id,t.balance_after));
    const bankStatementBalance = balances.size ? Array.from(balances.values()).reduce((s,b)=>s+b,0) : undefined;
    dailyRows.push({date,previousBalance,totalDeposit,totalWithdraw,closingBalance:running,bankStatementBalance,
      isReconciled: bankStatementBalance !== undefined && running === bankStatementBalance,
      hasNegativeBalance: running < 0 || Array.from(balances.values()).some(b=>b<0),transactionsCount:list.length});
  }
  return {yearMonth,initialMonthBalance:initialBalance,totalMonthRevenue:dailyRows.reduce((s,r)=>s+r.totalDeposit,0),
    totalMonthExpense:dailyRows.reduce((s,r)=>s+r.totalWithdraw,0),finalClosingBalance:running,
    isMonthAllReconciled:dailyRows.every(r=>r.isReconciled),negativeDaysCount:dailyRows.filter(r=>r.hasNegativeBalance).length,
    unreconciledDaysCount:dailyRows.filter(r=>!r.isReconciled).length,dailyRows};
}
