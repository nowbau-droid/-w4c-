import React from "react";
import { Landmark, FileSpreadsheet, ShieldCheck, PieChart, Sparkles } from "lucide-react";

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  unmatchedCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange, unmatchedCount }) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* 로고 & 시설명 */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-200">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg text-slate-800 tracking-tight">요양 w4c 노트</span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                  2026 회계연도
                </span>
              </div>
              <p className="text-xs text-slate-500">온누리요양원 (다중 통장 & W4C 일자별 잔액 통제)</p>
            </div>
          </div>

          {/* 메인 탭 네비게이션 */}
          <nav className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => onTabChange("reconciliation")}
              className={`flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                currentTab === "reconciliation"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>통장·영수증 매칭</span>
              {unmatchedCount > 0 && (
                <span className="ml-1.5 px-2 py-0.2 text-xs rounded-full bg-amber-500 text-white font-bold">
                  {unmatchedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onTabChange("dailyLedger")}
              className={`flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                currentTab === "dailyLedger"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>월별 일계표 & 대사</span>
            </button>

            <button
              onClick={() => onTabChange("budget")}
              className={`flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                currentTab === "budget"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <PieChart className="w-4 h-4 text-indigo-600" />
              <span>예산 & 인건비율(61.4%)</span>
            </button>

            <button
              onClick={() => onTabChange("w4cExport")}
              className={`flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                currentTab === "w4cExport"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-700" />
              <span>W4C 엑셀 내보내기</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
