# 🏥 요양 w4c 노트 (Care W4C Note)
> **다중 통장 기반 장기요양기관 세입·세출 관리 및 월별 W4C 일자별 잔액 통제 시스템**

---

## 🌟 프로그램 핵심 기능

1. **통장-영수증 5:5 스마트 매칭 (Reconciliation)**
   - 다중 통장(운영비, 식자재, 후원금) 미매칭 출금 내역을 자동 수집
   - Gemini Vision OCR 영수증 데이터와 금액/일자 기반 자동 하이라이트 매칭 (99% 일치 추천)
   - 영수증이 없을 때도 1초 만에 전표화하는 **⚡ 퀵적요 프리셋 버튼** 지원 (식자재, 소모품, 공과금 등)
   - 1 영수증 : 다중 통장 출금 분할 매칭 완벽 대응

2. **월별 수지 일계표 & 잔액 대사 (Daily Ledger & Bank Balance Tracker)**
   - 1일부터 말일까지 매일 `[전일이월 + 입금 - 출금 = 당일마감잔액]` 자동 계산
   - 실제 은행 통장의 마감 잔액과 1원 단위 수지일치(`is_reconciled`) 실시간 대사
   - 일자별 마이너스(-) 잔액 사전 감지 및 경고 팝업

3. **법정 예산 및 인건비 비율(61.4%) 실시간 모니터링**
   - 노인복지법상 법정 인건비 지출비율(61.4%) 실시간 프로그레스 바
   - 관-항-목별 편성예산액 대비 실집행액, 집행잔액, 집행률(%) 자동 산출
   - 동일 항 내 목간 예산전용 및 전용조서 관리

4. **W4C(희망이음) 호환 엑셀 일괄 내보내기**
   - 확정된 회계 전표를 W4C 시스템 업로드 규격(A~L열 표준 서식)으로 원클릭 `.xlsx` 다운로드

---

## 🚀 빠른 시작 가이드 (Quick Start)

### 1. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속하여 바로 화면을 조작해 볼 수 있습니다.

---

## 📂 프로젝트 구조

```
├── database/
│   ├── schema.sql                     # PostgreSQL / Supabase DDL 전문
│   └── README.md                      # DB 테이블 관계 및 설계 설명서
├── docs/
│   ├── ui_wireframes_and_specs.md     # 핵심 화면 3종 UI 명세 & 와이어프레임
│   └── accounting_edge_cases_and_w4c_rules.md # 회계 예외(분할/대체) 및 W4C 서식 규격
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # 글로벌 레이아웃
│   │   ├── page.tsx                   # 메인 탭 뷰 대시보드 (매칭 / 일계표 / 예산 / W4C내보내기)
│   │   └── globals.css                # Tailwind 스타일
│   ├── components/
│   │   └── Navbar.tsx                 # 상단 시설 네비게이션 헤더
│   ├── lib/
│   │   ├── constants/
│   │   │   └── w4cCodes.ts            # 보건복지부 표준 관-항-목 계정과목 마스터
│   │   ├── engine/
│   │   │   ├── bankParser.ts          # 다중 은행 엑셀/CSV 파서
│   │   │   ├── matchingEngine.ts      # 스마트 매칭 점수 산출 & W4C 표준 적요 자동 조합기
│   │   │   ├── dailyLedger.ts         # 월별 일자별 일계표 & 통장 잔액 대사 엔진
│   │   │   └── w4cExporter.ts         # W4C 표준 엑셀 워크북 생성기
│   │   └── mockData.ts                # 실전 테스트용 다중 통장, 영수증, 예산 데이터
│   └── types/
│       └── accounting.ts              # 데이터베이스 매핑 TypeScript 모델
```
