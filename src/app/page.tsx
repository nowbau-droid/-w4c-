"use client";
import { useEffect,useState,useRef,FormEvent } from "react";
import { Landmark,ArrowLeftRight,CalendarDays,ChartNoAxesCombined,FileSpreadsheet,Settings2,Upload,Download,Plus,Search,Check,ReceiptText,X,ShieldCheck,Wallet,ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import { Voucher,Receipt,BankAccount } from "@/types/accounting";
import { DEFAULT_W4C_CODES as CODES } from "@/lib/constants/w4cCodes";
import { QUICK_PRESETS,findBestMatchesForReceipt,generateStandardDescription } from "@/lib/engine/matchingEngine";
import { parseBankExcelRows } from "@/lib/engine/bankParser";
import { calculateMonthlyDailyLedger } from "@/lib/engine/dailyLedger";
import { exportVouchersToW4CExcel } from "@/lib/engine/w4cExporter";
import { Workspace,blankWorkspace,demoWorkspace,budgetRows,assertWorkspace } from "@/lib/workspace";
const KEY="care-w4c-workspace-v1", money=(n:number)=>n.toLocaleString("ko-KR"),uid=()=>crypto.randomUUID();
const nav=[{id:"matching",name:"통장·영수증 매칭",icon:ArrowLeftRight},{id:"ledger",name:"월별 수지 일계표",icon:CalendarDays},{id:"budget",name:"예산 및 집행 관리",icon:ChartNoAxesCombined},{id:"export",name:"W4C 내보내기",icon:FileSpreadsheet},{id:"settings",name:"통장 및 데이터 관리",icon:Settings2}];
export default function App(){
 const [data,setData]=useState<Workspace>(blankWorkspace),[ready,setReady]=useState(false),[storageError,setStorageError]=useState("");
 const [tab,setTab]=useState("matching"),[month,setMonth]=useState("2026-10"),[account,setAccount]=useState("ALL"),[status,setStatus]=useState("pending"),[search,setSearch]=useState("");
 const [selected,setSelected]=useState<string[]>([]),[receiptId,setReceiptId]=useState(""),[modal,setModal]=useState(""),[preset,setPreset]=useState(""),[message,setMessage]=useState(""),[image,setImage]=useState(""),[day,setDay]=useState("");
 const bankFile=useRef<HTMLInputElement>(null),backupFile=useRef<HTMLInputElement>(null);
 useEffect(()=>{try{const raw=localStorage.getItem(KEY);if(raw){const s=JSON.parse(raw);assertWorkspace(s);setData(s);}else setData(demoWorkspace());}catch{setStorageError("저장 데이터를 읽지 못했습니다. 백업을 복원하세요. 기존 저장소는 보존합니다.");}setReady(true);},[]);
 useEffect(()=>{if(!ready||storageError)return;try{localStorage.setItem(KEY,JSON.stringify(data));}catch{setStorageError("저장 공간이 부족합니다. 현재 작업을 JSON 백업으로 내려받으세요.");}},[data,ready,storageError]);
 useEffect(()=>{if(!modal)return;const handler=(e:KeyboardEvent)=>{if(e.key==="Escape")setModal("");};document.addEventListener("keydown",handler);return()=>document.removeEventListener("keydown",handler);},[modal]);
 const active=data.transactions.filter(t=>selected.includes(t.id)&&t.match_status==="UNMATCHED"),receipt=data.receipts.find(r=>r.id===receiptId),amount=active.reduce((s,t)=>s+t.withdraw_amount+t.deposit_amount,0);
 const scoped=data.transactions.filter(t=>t.transaction_date.startsWith(month)&&(account==="ALL"||t.account_id===account)),pending=scoped.filter(t=>t.match_status==="UNMATCHED");
 const filtered=scoped.filter(t=>(status==="all"||(status==="pending"?t.match_status==="UNMATCHED":t.match_status!=="UNMATCHED"))&&t.description.includes(search)).sort((a,b)=>`${b.transaction_date} ${b.transaction_time}`.localeCompare(`${a.transaction_date} ${a.transaction_time}`));
 const receipts=data.receipts.filter(r=>r.receipt_date?.startsWith(month)&&!data.vouchers.some(v=>v.status==="CONFIRMED"&&v.receipt_id===r.id)),budgets=budgetRows(data);
 const vouchers=data.vouchers.filter(v=>v.status==="CONFIRMED"&&v.voucher_date.startsWith(month)&&(account==="ALL"||v.account_id===account));
 const initial=data.accounts.filter(a=>account==="ALL"||a.id===account).reduce((s,a)=>s+a.initial_balance+data.transactions.filter(t=>t.account_id===a.id&&t.transaction_date<`${month}-01`).reduce((s,t)=>s+t.deposit_amount-t.withdraw_amount,0),0);
 const ledger=calculateMonthlyDailyLedger(Number(month.slice(0,4)),Number(month.slice(5)),data.accounts.find(a=>a.id===account)||null,data.transactions,initial,data.accounts);
 const close=()=>{setModal("");setPreset("");setImage("");};
 const field=(text:string,node:React.ReactNode)=><label className="field"><span>{text}</span>{node}</label>;
 const codes=(dir="EXPENDITURE")=>CODES.filter(c=>c.direction===dir).map(c=><option key={c.id} value={c.id}>{c.full_name}</option>);
 function openVoucher(){if(!active.length){setMessage("먼저 미처리 거래를 선택하세요.");return;}setModal("voucher");}
 function save(e:FormEvent<HTMLFormElement>){e.preventDefault();try{
 const f=new FormData(e.currentTarget),get=(k:string)=>String(f.get(k)||"").trim(),n=Number(f.get("amount"));
 if(modal==="voucher"){
  const code=CODES.find(c=>c.id===get("code")),direction=active[0]?.deposit_amount?"REVENUE":"EXPENDITURE";
  if(!active.length||!code||!get("vendor")||!get("description"))throw Error("거래·과목·거래처·적요를 확인하세요.");
  if(active.some(t=>(t.deposit_amount?"REVENUE":"EXPENDITURE")!==direction)||code.direction!==direction)throw Error("같은 수입/지출 구분만 함께 결의할 수 있습니다.");
  if(receipt&&(direction!=="EXPENDITURE"||receipt.total_amount!==amount))throw Error("영수증 합계와 출금 합계가 정확히 일치해야 합니다.");
  if(active.some(t=>t.balance_after<0))throw Error("잔액이 음수인 거래입니다. 통장 원장을 확인하세요.");
  const b=budgets.find(b=>b.account_code_id===code.id);if(b&&direction==="EXPENDITURE"&&amount>b.remaining_budget)throw Error("잔여 예산을 초과했습니다.");
  const now=new Date().toISOString();const created:Voucher[]=active.map((t,i)=>({id:uid(),facility_id:"local",voucher_no:`${t.transaction_date.replaceAll("-","")}-${direction==="REVENUE"?"REV":"EXP"}-${String(data.vouchers.length+i+1).padStart(4,"0")}`,voucher_date:t.transaction_date,voucher_type:direction,account_id:t.account_id,account:data.accounts.find(a=>a.id===t.account_id),account_code_id:code.id,account_code:code,total_amount:t.withdraw_amount+t.deposit_amount,supply_amount:t.withdraw_amount+t.deposit_amount,vat_amount:0,standard_description:get("description"),vendor_name:get("vendor"),evidence_type:receipt?.payment_method||"통장거래(증빙미첨부)",status:"CONFIRMED",is_w4c_exported:false,receipt_id:receipt?.id,transaction_id:t.id,created_at:now,updated_at:now}));
  setData(s=>({...s,vouchers:[...s.vouchers,...created],transactions:s.transactions.map(t=>active.some(a=>a.id===t.id)?{...t,match_status:"FULLY_MATCHED",matched_amount:t.deposit_amount+t.withdraw_amount,unmatched_balance:0}:t)}));setSelected([]);setReceiptId("");
 }else if(modal==="receipt"){
  if(!Number.isSafeInteger(n)||n<=0)throw Error("금액은 1원 이상의 정수여야 합니다.");
  const r:Receipt={id:uid(),facility_id:"local",image_url:image,receipt_date:get("date"),vendor_name:get("vendor"),total_amount:n,payment_method:get("evidence"),suggested_account_code_id:get("code"),items:[{name:get("items"),total:n}],ocr_status:"PENDING",created_at:new Date().toISOString()};setData(s=>({...s,receipts:[...s.receipts,r]}));
 }else if(modal==="account"){
  if(!Number.isSafeInteger(n)||n<0)throw Error("기초잔액은 0원 이상의 정수여야 합니다.");
  const a:BankAccount={id:uid(),facility_id:"local",account_name:get("name"),bank_name:get("bank"),account_number:get("number"),account_usage:"OTHER",initial_balance:n,current_balance:n,color_hex:"#157f70",is_active:true,display_order:data.accounts.length};setData(s=>({...s,accounts:[...s.accounts,a]}));setAccount(a.id);
 }else if(modal==="budget"){
  const code=CODES.find(c=>c.id===get("code"))!,old=budgets.find(b=>b.account_code_id===code.id);if(!Number.isSafeInteger(n)||n<0||n<(old?.executed_amount||0))throw Error("예산은 집행액 이상의 정수로 입력하세요.");
  const transferred=old?.transferred_amount||0;setData(s=>({...s,budgets:[...s.budgets.filter(b=>b.account_code_id!==code.id),{id:old?.id||uid(),budget_plan_id:"local",account_code_id:code.id,account_code:code,allocated_amount:n-transferred,transferred_amount:transferred,current_budget:n,executed_amount:0,remaining_budget:n,execution_rate_percent:0}]}));
 }else if(modal==="transfer"){
  const from=budgets.find(b=>b.id===get("from")),to=budgets.find(b=>b.id===get("to"));
  if(!from||!to||from.id===to.id||from.account_code.gwan_code!==to.account_code.gwan_code||from.account_code.hang_code!==to.account_code.hang_code)throw Error("동일 관·항 안에서 서로 다른 목을 선택하세요.");
  if(!Number.isSafeInteger(n)||n<=0||n>from.remaining_budget)throw Error("전용 금액이 잔여 예산을 초과했거나 올바르지 않습니다.");
  setData(s=>({...s,budgets:s.budgets.map(b=>{const d=b.id===from.id?-n:b.id===to.id?n:0;return {...b,transferred_amount:b.transferred_amount+d,current_budget:b.current_budget+d};}),transfers:[...s.transfers,{id:uid(),date:get("date"),from:from.account_code.full_name,to:to.account_code.full_name,amount:n,reason:get("reason")}]}));
 }else if(modal==="internal"){
  const out=data.transactions.find(t=>t.id===get("out")),inc=data.transactions.find(t=>t.id===get("in"));
  if(!out||!inc||out.account_id===inc.account_id||out.withdraw_amount!==inc.deposit_amount||out.match_status!=="UNMATCHED"||inc.match_status!=="UNMATCHED")throw Error("서로 다른 통장의 동일 금액 출금·입금 거래를 선택하세요.");
  setData(s=>({...s,transactions:s.transactions.map(t=>[out.id,inc.id].includes(t.id)?{...t,match_status:"INTERNAL_TRANSFER",matched_amount:t.withdraw_amount+t.deposit_amount,unmatched_balance:0}:t)}));setSelected([]);
 }close();setMessage("저장했습니다.");}catch(err){setMessage((err as Error).message);}}
 async function upload(file?:File){if(!file)return;try{if(account==="ALL")throw Error("상단에서 업로드할 통장을 선택하세요.");const book=XLSX.read(await file.arrayBuffer(),{type:"array"}),a=data.accounts.find(a=>a.id===account)!;const parsed=parseBankExcelRows(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{defval:""}),a.id,a.account_name),hashes=new Set(data.transactions.map(t=>t.transaction_hash));const fresh=parsed.filter(t=>{if(hashes.has(t.transaction_hash))return false;hashes.add(t.transaction_hash);return true;});if(!parsed.length)throw Error("불러올 거래가 없습니다.");setData(s=>({...s,transactions:[...s.transactions,...fresh]}));if(fresh[0])setMonth(fresh[0].transaction_date.slice(0,7));setMessage(`${fresh.length}건 등록 · 중복 ${parsed.length-fresh.length}건 제외`);}catch(err){setMessage((err as Error).message);}finally{if(bankFile.current)bankFile.current.value="";}}
 function backup(){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"})),a=document.createElement("a");a.href=url;a.download=`요양w4c_백업_${month}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function restore(file?:File){if(!file)return;try{const parsed=JSON.parse(await file.text());assertWorkspace(parsed);if(!confirm("현재 장부를 백업 내용으로 교체할까요?"))return;setData(parsed);setStorageError("");setSelected([]);setReceiptId("");setAccount("ALL");setMessage("복원했습니다.");}catch(err){setMessage((err as Error).message);}finally{if(backupFile.current)backupFile.current.value="";}}
 function cancel(v:Voucher){if(!confirm("이 결의서를 취소할까요?"))return;setData(s=>({...s,vouchers:s.vouchers.map(x=>x.id===v.id?{...x,status:"CANCELLED"}:x),transactions:s.transactions.map(t=>t.id===v.transaction_id?{...t,match_status:"UNMATCHED",matched_amount:0,unmatched_balance:t.deposit_amount+t.withdraw_amount}:t)}));}
 const title=nav.find(n=>n.id===tab)!.name;
