import * as XLSX from "xlsx";
import { Voucher } from "@/types/accounting";
export function validateExport(vouchers: Voucher[]): string[] {
  return vouchers.filter(v=>v.status === "CONFIRMED" && v.voucher_type !== "INTERNAL_TRANSFER").flatMap(v=> {
    const errors: string[] = [];
    if (!v.account_code || v.account_code.direction !== v.voucher_type || ![v.account_code.gwan_code,v.account_code.hang_code,v.account_code.mok_code].every(c=>/^\d{2}$/.test(c))) errors.push(`${v.voucher_no}: 계정과목 확인 필요`);
    if (!Number.isSafeInteger(v.total_amount) || v.total_amount<=0) errors.push(`${v.voucher_no}: 금액 확인 필요`);
    if (!v.standard_description.trim() || !v.vendor_name?.trim() || !v.evidence_type.trim() || !v.account?.account_number || !v.account?.bank_name) errors.push(`${v.voucher_no}: 적요·거래처·증빙·계좌 확인 필요`);
    return errors;
  });
}
export function buildW4CWorkbook(vouchers: Voucher[]) {
  const errors = validateExport(vouchers);
  if (errors.length) throw new Error(errors.join("\n"));
  const valid = vouchers.filter(v=>v.status === "CONFIRMED" && v.voucher_type !== "INTERNAL_TRANSFER");
  if (!valid.length) throw new Error("내보낼 확정 전표가 없습니다.");
  const workbook = XLSX.utils.book_new();
  for (const direction of ["EXPENDITURE","REVENUE"] as const) {
    const list = valid.filter(v=>v.voucher_type===direction);
    if (!list.length) continue;
    const header = ["결의일자","결의번호","관코드","항코드","목코드","과목명(목명)","결의금액","적요","거래처명","증빙구분",direction==="REVENUE"?"입금계좌번호":"출금계좌번호",direction==="REVENUE"?"입금은행명":"출금은행명"];
    const rows = list.sort((a,b)=>a.voucher_date.localeCompare(b.voucher_date)).map(v=>[v.voucher_date,v.voucher_no,v.account_code!.gwan_code,v.account_code!.hang_code,v.account_code!.mok_code,v.account_code!.mok_name,v.total_amount,v.standard_description,v.vendor_name,v.evidence_type,v.account!.account_number,v.account!.bank_name]);
    const sheet = XLSX.utils.aoa_to_sheet([header,...rows]);
    sheet["!cols"] = [12,24,8,8,8,24,16,60,24,24,24,16].map(wch=>({wch}));
    XLSX.utils.book_append_sheet(workbook,sheet,direction==="REVENUE"?"세입결의서":"세출결의서");
  }
  return workbook;
}
export function exportVouchersToW4CExcel(vouchers: Voucher[], filename="W4C_회계전표_검토용.xlsx") {
  XLSX.writeFile(buildW4CWorkbook(vouchers),filename);
}
