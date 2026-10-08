# API 설계 — 리포트·결제·검토·100일 실행·운영자

리포트 고도화(유료화, 엑셀, PDF 보강, 관리, 컨시어지)에서 추가·변경한 엔드포인트의 계약입니다.
나머지 API 목록은 [README](../README.md#api-엔드포인트)를 봅니다.

공통 응답: `{ success: true, data }` / `{ success: false, error: { code, message } }`.
모두 쿠키 인증이 필요합니다. 날짜는 ISO 8601 문자열입니다.

## 리포트 `/api/reports`

| Method | Path | 요청 | 응답 `data` |
|--------|------|------|------|
| POST | `/` | `{ scenarioSetId, scenarioType: "A"~"D", orderId? }` | 리포트 (201) |
| GET | `/` | — | `ReportSummary[]` 최신순 |
| GET | `/:id` | — | `Report` (`ReportSummary` + `content`) |
| PATCH | `/:id` | `{ title: string(≤40) \| null }` | `ReportSummary` |
| DELETE | `/:id` | — | `null` |
| GET | `/:id/pdf` | — | `application/pdf` (heavy limit) |
| GET | `/:id/xlsx` | — | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (heavy limit) |

`ReportSummary`: `id, scenarioSetId|null, scenarioType, ruleVersion, generatedAt, title|null,
firstDownloadedAt|null, updatedAt, isOutdated`.

- 생성 제한: 결제가 꺼져 있으면 사용자당 50건(`REPORT_LIMIT` 409). 결제가 켜져 있으면 주문 1건당 1건이며
  보관 제한을 적용하지 않습니다.
- `isOutdated` = `ruleVersion ≠ RULE_SET_VERSION` 또는 생성 후 180일 경과.
- 파일 다운로드(PDF·엑셀) 성공 시 `firstDownloadedAt`이 비어 있으면 기록합니다.
- `content.scenario.monthly`는 v1.1 이후 리포트에만 있습니다(PDF·엑셀은 없으면 월별 섹션 생략).

### 계좌 총액·연금수령한도·지방소득세 (시나리오 세트·리포트 공통)

`PlanItem`에 다음 필드가 추가됐습니다. 이전 세트·리포트에는 없으므로 클라이언트는 optional로 받습니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `localIncomeTax` | number | `totalTax` 중 지방소득세 |
| `startBalance` | number \| null | 계산 시작 시점 계좌 총액. 실업급여·잉여 적립 항목은 `null` |
| `annuityLimit` | `AnnuityLimit` \| null | 연금계좌(DC·IRP·연금저축)만. 일시금으로 받은 계좌·비연금 계좌는 `null` |

`AnnuityLimit`: `baseYear, legacy, years: [{ year, receiptYear, openingBalance, limit, planned }], exceededYears`.

- 한도 = 연초 평가액 ÷ (11 − 연금수령연차) × 120%(소득세법 시행령 제40조의2). `years`는 10년차 또는 잔액 소진까지만 담습니다.
- 가입일을 모르므로 max(만 55세가 되는 해, 계산 시작 해)를 1년차로 봅니다(구계좌 연금저축은 6년차). 실제보다 연차를 같거나 작게 잡아 한도를 보수적으로 계산합니다.
- `planned`는 그해 연금수령 방식으로 꺼낸 세전 합계입니다. 한도를 넘는 해(`exceededYears`)는 운영 메모로 경고만 하고, 세금은 연금수령 세율 그대로 둡니다.

`YearRow.localIncomeTax`, `ScenarioSummary.localIncomeTax`도 추가됐습니다. 엔진의 모든 세율이 지방소득세(국세의 10%)를 포함하므로 지방소득세 = 세금 ÷ 11입니다. 값이 없는 이전 데이터는 화면·PDF·엑셀이 같은 식으로 계산해 보여 줍니다.

## 결제 `/api/payments`

| Method | Path | 요청 | 응답 `data` |
|--------|------|------|------|
| GET | `/config` | — | `{ enabled, price }` |
| POST | `/report-orders` | `{ scenarioSetId, scenarioType }` | `{ orderId, amount, orderName }` |
| POST | `/confirm` | `{ paymentKey, orderId, amount }` | `{ orderId, status, scenarioType, method\|null, reportId\|null }` |
| POST | `/fail` | `{ orderId, code }` | `null` |

흐름: 주문 생성(READY) → 프론트가 토스 결제창(`method: CARD`, `customerKey: ANONYMOUS`) →
`/payments/success?paymentKey&orderId&amount` → `confirm` → 토스 `POST /v1/payments/confirm`
(Basic 시크릿 키) → PAID 저장 → 리포트 생성과 주문 사용 처리(한 트랜잭션) → `reportId`.

- `orderId`: `rpt_` + 32자 hex. 요청 검증은 `^[A-Za-z0-9_-]{6,64}$`.
- `confirm`은 멱등: PAID이고 같은 결제키면 리포트를 (다시) 만들거나 기존 `reportId`를 돌려줍니다.
  리포트를 지운 뒤면 `reportId: null`.
- 주문 생성 전에 리포트 생성 가능 여부(시나리오 소유·존재)를 먼저 확인합니다.

## 검토 요청 `/api/review-requests`

| Method | Path | 요청 | 응답 `data` |
|--------|------|------|------|
| POST | `/` | `{ reportId, question(5~1000), consent: true }` | `ReviewRequest` (201) |
| GET | `/` | — | `ReviewRequest[]` |
| DELETE | `/:id` | — | `ReviewRequest` (status `CANCELED`) |

`ReviewRequest`: `id, reportId, question, consentAt, status, answer|null, answeredAt|null, createdAt, updatedAt`
(운영자 메모 `operatorNote`는 사용자 응답에서 뺍니다).
상태: `REQUESTED → IN_REVIEW → ANSWERED → CLOSED`, 사용자 취소는 `CANCELED`(처리 중일 때만).

## 100일 실행

| Method | Path | 요청 | 응답 `data` |
|--------|------|------|------|
| POST | `/api/reports/:id/execution-plan` | — | `ExecutionPlan` (새로 만들면 201, 있으면 200) |
| GET | `/api/reports/:id/execution-plan` | — | `ExecutionPlan` 또는 `EXECUTION_PLAN_NOT_FOUND` 404 |
| PATCH | `/api/execution-plans/:id/items/:key` | `{ done: boolean }` | `ExecutionPlan` |

`ExecutionPlan`: `id, reportId, startDate, items: [{ key, label, dueDay(1~100), doneAt|null }],
progress: { done, total, currentDay(1~100) }`. 항목 키는 `^[a-z0-9-]{1,40}$`.

## 운영자 `/api/admin` (인증 + `role = OPERATOR`)

| Method | Path | 요청 | 응답 `data` |
|--------|------|------|------|
| GET | `/review-requests` | `?status&limit(1~200, 기본 100)` | 요청 + `userEmail, reportTitle, scenarioType, reportGeneratedAt` |
| GET | `/review-requests/:id` | — | `{ request(+userEmail, operatorNote), report(스냅샷), executionPlan\|null }` |
| PATCH | `/review-requests/:id` | `{ status?, answer?, operatorNote? }` (하나 이상) | 요청 |
| GET | `/payments` | `?status&limit` | 결제(결제키 제외) + `userEmail, reportDownloadedAt` |
| POST | `/payments/:id/refund` | `{ reason(2~200) }` | 결제 (status `REFUNDED`) |

- 상태를 주지 않고 답변을 넣으면 `ANSWERED`와 `answeredAt`을 기록합니다.
- 취소된 요청은 다른 상태로 바꿀 수 없습니다(`REVIEW_CANCELED`).
- 환불은 토스 `POST /v1/payments/{paymentKey}/cancel`(`Idempotency-Key: cancel-{paymentKey}`) 전액 취소입니다.

## 오류 코드

| 코드 | HTTP | 상황 |
|------|------|------|
| `REPORT_LIMIT` | 409 | 무료 모드에서 리포트 50건 초과 |
| `PAYMENT_REQUIRED` | 402 | 결제 모드인데 `orderId` 없음, 결제 미완료 또는 이미 사용한 주문 |
| `PAYMENT_DISABLED` | 400 | 결제가 꺼진 상태에서 주문 생성 |
| `PAYMENT_NOT_FOUND` / `PAYMENT_FORBIDDEN` | 404 / 403 | 주문 없음 / 남의 주문 |
| `PAYMENT_ORDER_MISMATCH` | 400 | 주문한 시나리오와 다른 리포트 생성 요청 |
| `PAYMENT_AMOUNT_MISMATCH` | 400 | 승인 요청 금액 ≠ 주문 금액 (주문 FAILED) |
| `PAYMENT_CONFLICT` | 409 | 이미 다른 결제키로 PAID된 주문 |
| `PAYMENT_NOT_PAYABLE` | 409 | READY가 아닌 주문 승인 |
| `PAYMENT_REJECTED` | 400 | 토스가 승인 거절 (주문 FAILED) |
| `PAYMENT_APPROVAL_MISMATCH` | 502 | 토스 승인 결과가 주문과 다름 (자동 취소) |
| `PAYMENT_GATEWAY_UNAVAILABLE` | 502 | 토스 연결 실패·시간 초과(15초) |
| `PAYMENT_NOT_REFUNDABLE` / `PAYMENT_REFUND_REJECTED` | 409 / 400 | PAID가 아님 / 토스가 취소 거절 |
| `REVIEW_CONSENT_REQUIRED` | 400 | 열람 동의 없음 |
| `REVIEW_ALREADY_REQUESTED` | 409 | 같은 리포트에 처리 중 요청이 있음 |
| `REVIEW_LIMIT` | 409 | 처리 중 요청 3건 초과 |
| `REVIEW_NOT_CANCELABLE` | 409 | 답변·종료·취소된 요청 취소 |
| `REVIEW_CANCELED` | 409 | 운영자가 취소된 요청 상태 변경 |
| `EXECUTION_PLAN_NOT_FOUND` | 404 | 아직 시작하지 않음 |
| `EXECUTION_ITEM_NOT_FOUND` | 404 | 없는 항목 키 |
| `OPERATOR_ONLY` | 403 | 운영자 API에 일반 사용자 접근 |

## 환경 변수

| 이름 | 기본값 | 설명 |
|------|------|------|
| `REPORT_PAYMENT_ENABLED` | `false` | `"true"`일 때만 결제 필요 |
| `REPORT_PRICE` | `9900` | 리포트 가격(원), 100~1,000,000 밖이면 기동 실패 |
| `TOSS_SECRET_KEY` | — | 결제를 켜면 필수(없으면 기동 실패). 서버 전용 |
| `VITE_TOSS_CLIENT_KEY` (FE) | — | 토스 클라이언트 키. 없으면 결제창을 열지 않음 |
