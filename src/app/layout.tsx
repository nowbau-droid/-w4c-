import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "요양 w4c 노트 - 다중 통장 기반 장기요양기관 회계 & 잔액 통제",
  description: "다중 통장 원장 기반 일자별 수지일치 및 W4C 전표 일괄 생성 시스템",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
