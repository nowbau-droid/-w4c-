import { BankAccount, BankTransaction, BudgetItem, Receipt, Voucher } from "@/types/accounting";
import { MOCK_ACCOUNTS, MOCK_TRANSACTIONS, MOCK_RECEIPTS, MOCK_BUDGET_ITEMS } from "@/lib/mockData";
export interface TransferRecord { id:string; date:string; from:string; to:string; amount:number; reason:string }
export interface Workspace { version:1; demo:boolean; accounts:BankAccount[]; transactions:BankTransaction[]; receipts:Receipt[]; vouchers:Voucher[]; budgets:BudgetItem[]; transfers:TransferRecord[]; }
export const blankWorkspace = ():Workspace => ({version:1,demo:false,accounts:[],transactions:[],receipts:[],vouchers:[],budgets:[],transfers:[]});
export function demoWorkspace():Workspace {
  const accounts = MOCK_ACCOUNTS.map(a=>({...a}));
  const transactions:BankTransaction[] = MOCK_TRANSACTIONS.map(t=>({...t}));
  transactions.push({...transactions[4],id:"tx-transfer-in",account_id:"acc-food",account_name:"식자재비 전용 통장",withdraw_amount:0,deposit_amount:3000000,description:"운영비통장에서 내부대체",transaction_hash:"demo-transfer-in"});
  accounts.forEach(a=>{
    let balance=a.initial_balance;
    transactions.filter(t=>t.account_id===a.id).sort((a,b)=>`${a.transaction_date} ${a.transaction_time}`.localeCompare(`${b.transaction_date} ${b.transaction_time}`)).forEach(t=>{ balance+=t.deposit_amount-t.withdraw_amount;t.balance_after=balance; });
    a.current_balance=balance;
  });
  return {version:1,demo:true,accounts,transactions,receipts:MOCK_RECEIPTS.map(r=>({...r,image_url:""})),vouchers:[],budgets:MOCK_BUDGET_ITEMS.map(b=>({...b,transferred_amount:0,current_budget:b.allocated_amount,executed_amount:0,remaining_budget:b.allocated_amount,execution_rate_percent:0})),transfers:[]};
}
export function budgetRows(state:Workspace) {
  return state.budgets.map(b=>{
    const executed_amount = state.vouchers.filter(v=>v.status==="CONFIRMED" && v.voucher_type==="EXPENDITURE" && v.account_code_id===b.account_code_id).reduce((s,v)=>s+v.total_amount,0);
    return {...b,executed_amount,remaining_budget:b.current_budget-executed_amount,execution_rate_percent:b.current_budget?executed_amount/b.current_budget*100:0};
  });
}
export function assertWorkspace(value:unknown): asserts value is Workspace {
  const s=value as Workspace;
  if (!s || s.version!==1 || ![s.accounts,s.transactions,s.receipts,s.vouchers,s.budgets,s.transfers].every(Array.isArray)) throw new Error("지원하지 않는 백업 파일입니다.");
  if (!s.accounts.every(a=>typeof a.id==="string" && typeof a.account_name==="string" && typeof a.account_number==="string" && Number.isSafeInteger(a.initial_balance)) ||
    !s.transactions.every(t=>typeof t.id==="string" && s.accounts.some(a=>a.id===t.account_id) && /^\d{4}-\d{2}-\d{2}$/.test(t.transaction_date) && [t.deposit_amount,t.withdraw_amount,t.balance_after].every(Number.isSafeInteger)) ||
    !s.vouchers.every(v=>typeof v.id==="string" && typeof v.standard_description==="string" && typeof v.voucher_date==="string" && Number.isSafeInteger(v.total_amount)) ||
    !s.receipts.every(r=>typeof r.id==="string") || !s.budgets.every(b=>b.account_code && Number.isSafeInteger(b.current_budget))) throw new Error("백업 데이터 구조 또는 금액이 올바르지 않습니다.");
}
