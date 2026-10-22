# 📋 [요양 w4c 노트] 프로젝트 전체 작업 내역 및 개발 완료 보고서

> **작성일자**: 2026-10-22  
> **시스템명**: 요양 w4c 노트 (Care W4C Note)  
> **핵심 슬로건**: *"다중 통장 기반 장기요양기관 세입·세출 관리 및 월별 W4C 일자별 잔액 통제 시스템"*

---

## 1. 프로젝트 추진 배경 및 보강 목표

기존의 비즈니스 기획안(`carehome_accounting_program_specification.md`)은 "무엇을(What)" 해야 하는지는 훌륭했으나, 실제 개발자나 AI 코딩 도구가 프로그램을 구축하기 위한 "어떻게(How)"에 대한 구체적 설계(DB DDL, UI 레이아웃, 회계 예외 엣지 케이스)가 누락되어 있었습니다.

이를 보완하기 위해 제미나이가 권고한 **3대 핵심 제안(DB 스키마, UI 명세, 예외/서식 규칙)**을 완벽히 설계·문서화하고, 이를 바탕으로 **실제 브라우저에서 동작하는 풀스택 웹 애플리케이션(Next.js 14 + TypeScript)**까지 100% 빌드 완료했습니다.

---

## 2. 지금까지 작업한 전체 산출물 및 문서 내역

### 📁 A. 설계 및 기획 보강 문서군 (Docs)

| 번호 | 파일 경로 | 주요 내용 및 실무 해결 사항 |
| :---: | :--- | :--- |
| **1** | [database/schema.sql](file:///c:/Users/onnuri2st/Desktop/야간가산%20자동화/요양%20w4c%20노트/database/schema.sql) | **Supabase / PostgreSQL DDL 전문**<br>• 1원 단위 정밀도(`NUMERIC(15,2)`) 보장<br>• **복합 분할 매칭 테이블** (`voucher_transaction_matches`) 구축: 1영수증 대 다중통장 결제 대응<br>• **통장 간 내부 자금 대체 전표** (`INTERNAL_TRANSFER`): 세입/세출 왜곡 차단<br>• **W4C 일자별 일계표 수지일치 스냅샷** (`daily_account_balances`) |
| **2** | [database/README.md](file:///c:/Users/onnuri2st/Desktop/야간가산%20자동화/요양%20w4c%20노트/database/README.md) | **DB 아키텍처 가이드**<br>• 11개 테이블 관계도 및 3대 핵심 뷰(`v_daily_cash_flow`, `v_budget_execution_status`, `v_w4c_export_vouchers`) 설명 |
| **3** | [docs/ui_wireframes_and_specs.md](file:///c:/Users/onnuri2st/Desktop/야간가산%20자동화/요양%20w4c%20노트/docs/ui_wireframes_and_specs.md) | **핵심 화면 3종 UI 와이어프레임 & 조작 흐름**<br>• 화면 1: 통장-영수증 5:5 스마트 매칭 화면 (AI 자동추천 + 1초 퀵적요)<br>• 화면 2: 월별 수지 일계표 & 일자별 잔액 대사 화면 (수지일치 대조)<br>• 화면 3: 예산 편성 및 인건비 비율(61.4%) 실시간 모니터링 화면 |
| **4** | [docs/accounting_edge_cases_and_w4c_rules.md](file:///c:/Users/onnuri2st/Desktop/야간가산%20자동화/요양%20w4c%20노트/docs/accounting_edge_cases_and_w4c_rules.md) | **회계 실무 엣지 케이스 5종 & W4C 엑셀 규격**<br>• 다중 통장 내부대체 규칙, 1:N 분할 결제 규칙<br>• 특정 일자 마이너스(-) 잔액 통제 규칙, 4대보험 복합 분개 규칙<br>• 보건복지부 희망이음 업로드 표준 컬럼(A~L열) 명세 |

---

### 💻 B. 실제 구현된 프로그램 코드베이스 (Codebase)

| 구분 | 파일 경로 | 역할 및 상세 설명 |
| :--- | :--- | :--- |
| **타입 모델** | [src/types/accounting.ts](file:///c:/Users/onnuri2st/Desktop/야간가산%20자동화/요양%20w4c%20노트/src/types/accounting.ts) | DB 스키마 1:1 매핑 TypeScript 인터페이스 정의 |
| **표준 코드** | [src/lib/constants/w4cCodes.ts](file:///c:/Users/onnuri2st/Desktop/야간가산%20자동화/요양%20w4c%20노트/src/lib/constants/w4cCodes.ts) | 사회복지시설 재무회계규칙 표준 관-항-목 (사무비, 인건비, 급식비 등) |
| **은행 파서 엔진** | [src/lib/engine/bankParser.ts](file:///c:/Users/onnuri2st/Desktop/야간가산%20자동화/요양%20w4c%20노트/src/lib/engine/bankParser.ts) | 국민/농협/신한 등 다중 은행 통장 엑셀 컬럼 자동 감지 및 중복 방지 해시 생성 |
| **스마트 매칭 엔진** | [src/lib/engine/matchingEngine.ts](file:///c:/Users/onnuri2st/Desktop/야간가산%20자동화/요양%20w4c%20노트/src/lib/engine/matchingEngine.ts) | **영수증-통장 자동 매칭 알고리즘** (금액/일자/상호명 점수제)<br>• W4C 감사용 표준 적요 조합기<br>• **영수증 없는 통장 건을 위한 1초 퀵적요 프리셋** |
| **일계표 대사 엔진** | [src/lib/engine/dailyLedger.ts](file:///c:/Users/onnuri2st/Desktop/야간가산%20자동화/요양%20w4c%20노트/src/lib/engine/dailyLedger.ts) | 1일~말일 일자별 `전일이월 + 입금 - 출금 = 당일마감잔액` 및 통장 원장 수지일치 계산 |
| **W4C 엑셀 내보내기**| [src/lib/engine/w4cExporter.ts](file:///c:/Users/onnuri2st/Desktop/야간가산%20자동화/요양%20w4c%20노트/src/lib/engine/w4cExporter.ts) | 확정 전표를 희망이음 업로드 규격 `.xlsx` 파일로 변환 다운로드 |
| **테스트 데이터** | [src/lib/mockData.ts](file:///c:/Users/onnuri2st/Desktop/야간가산%20자동화/요양%20w4c%20노트/src/lib/mockData.ts) | 온누리요양원 가상 통장 3개(운영비, 식자재, 후원금), 거래내역, 영수증, 예산 데이터 |
| **메인 UI 화면** | [src/app/page.tsx](file:///c:/Users/onnuri2st/Desktop/야간가산%20자동화/요양%20w4c%20노트/src/app/page.tsx) | 4대 탭 일체형 대시보드 (매칭 / 일계표 / 예산게이지 / W4C내보내기) |
| **네비게이션** | [src/components/Navbar.tsx](file:///c:/Users/onnuri2st/Desktop/야간가산%20자동화/요양%20w4c%20노트/src/components/Navbar.tsx) | 상단 시설 헤더 및 미매칭 건수 실시간 뱃지 |
| **설정 파일** | `package.json`, `tailwind.config.ts`, `tsconfig.json`, `.gitignore` | Next.js 14 + Tailwind CSS 빌드 환경 및 Git 설정 |

---

## 3. 프로그램 실행 방법 (사무실 로컬)

```bash
# 개발 서버 구동
npm run dev
```

- 웹 브라우저에서 **`http://localhost:3000`** 접속
- 프로덕션 빌드 검증: `npm run build` 통과 완료 (`✓ Generating static pages (4/4)`)

---

## 4. 사무실 ↔ 집 원격 작업 (GitHub 연동 완벽 가이드)

사무실 컴퓨터에서 작업한 파일을 **GitHub에 올려두면 집 컴퓨터에서도 그대로 다운받아 작업할 수 있습니다.**

### ⚠️ 필수 주의 사항
- 프로젝트 용량의 99%를 차지하는 `node_modules`(패키지 폴더)와 `.next`(빌드 폴더)는 Git에 올리면 안 됩니다.
- 방금 이를 방지하는 **[.gitignore](file:///c:/Users/onnuri2st/Desktop/야간가산%20자동화/요양%20w4c%20노트/.gitignore)** 파일을 생성해 두었으므로 안전하게 코드만 가볍게 올라갑니다.

---

### [단계 1] 사무실 컴퓨터에서 최초 1회 GitHub에 올리기

1. **[GitHub.com](https://github.com)**에 로그인하여 새 저장소(New repository)를 만듭니다. (예: `care-w4c-note`, 비공개(Private) 권장)
2. 사무실 터미널(VS Code / PowerShell)에서 아래 명령어를 순서대로 입력합니다:

```bash
# 1. git 초기화
git init

# 2. 작업한 모든 코드 추가 (.gitignore에 의해 node_modules는 자동 제외됨)
git add .

# 3. 첫 번째 커밋 생성
git commit -m "feat: 요양 w4c 노트 초기 버전 완성 (기획 보강 및 4대 탭 대시보드)"

# 4. 기본 브랜치 이름을 main으로 설정
git branch -M main

# 5. 본인의 GitHub 저장소 주소 연결 (GitHub에서 복사한 주소 입력)
git remote add origin https://github.com/사용자아이디/care-w4c-note.git

# 6. GitHub로 업로드 (푸시)
git push -u origin main
```

---

### [단계 2] 집 컴퓨터에서 처음 프로젝트 가져와서 실행하기

1. 집 컴퓨터에서 코드를 두고 싶은 폴더로 이동 후 터미널을 엽니다.
2. 아래 명령어로 GitHub에서 코드를 통째로 받아옵니다:

```bash
# 1. 코드 다운로드 (클론)
git clone https://github.com/사용자아이디/care-w4c-note.git

# 2. 프로젝트 폴더로 이동
cd care-w4c-note

# 3. 필요한 패키지 자동 설치 (1~2분 소요)
npm install

# 4. 프로그램 실행!
npm run dev
```

---

### [단계 3] 일상적인 작업 시 주고받는 방법 (퇴근/출근 시 2줄)

- **집에서 작업 후 퇴근/종료할 때 (집 ➔ GitHub):**
  ```bash
  git add .
  git commit -m "집에서 추가 작업 내용"
  git push
  ```
- **사무실 출근 후 최신 코드 받을 때 (GitHub ➔ 사무실):**
  ```bash
  git pull
  ```
