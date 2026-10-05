# 고도화 기능 설계 · 흐름 정의서

> 갱신: 2026-10-05 · PRD v1.1 고도화 반영  
> **정본:** `retirement-frontend/docs/feature-design-flow.md`  
> 보안 감사 상세 표는 레포 외부(Drive 등) 보관

이 파일은 BE 작업 시 찾기 쉬운 포인터다. 흐름·도메인·다음 미션(지표·로그) 계측점은 FE 정본 §3~§8을 본다.

## BE 라이브 경계 (요약)

| 항목 | 내용 |
|------|------|
| 기동 | `src/index.ts` → `bootstrap.ts` (`app.ts`/`server.ts` 레거시 차단) |
| 도메인 | auth · users · diagnoses · simulations · pension-portfolios · account-assets · withdrawal-scenarios · reports · tax-health-check · health |
| Rate (15분) | auth 40 · api 300 · health 120 · 무거운 API 20 (`generate`, `reports/:id/pdf`, `tax-health-check`) |
| 세션 | HttpOnly `retirement_token` · idle 30m · absolute 12h |
| 보안 유지 | CORS fail-closed · 소유권 · signup `REGISTRATION_UNAVAILABLE` |
| Deferred | JWT denylist · 비밀번호 복잡도 |

## 다음 미션에서 BE가 먼저 닿는 지점

1. request 로그: method·path·status·latency·requestId (PII 제외)  
2. auth 결과 코드 집계 (열거 유발 세분화 금지)  
3. `*_FORBIDDEN` / rate-limit 초과 모니터링  
4. diagnosis sanitize(연금 0)와 로그 필드 정합 · 부부 spouse/householdSize 필드 보존

상세 funnel·제약: FE 정본 **§8**.

## Diagnosis 배우자 필드 (2026-08)

- `householdSize` (default 1), `spouseBirthYear?`, `spouseRetirementYear?`
- 연금 실금액은 계속 0 sanitize. 배우자 금액은 서버 미저장.
- `retirementMonth?` (1~12) — 시나리오 계산 시작월. 없으면 1월로 본다.

## 인출 시나리오·리포트·세금·건보 (2026-10)

| 영역 | 위치 | 요점 |
|------|------|------|
| 엔진 | `application/services/withdrawal/engine.ts` | 월 단위 A~D · 연초 피부양자 판정 → 탈락 연도 지역보험료를 지출에 반영 · `recommendScenario` |
| 피부양자 | `withdrawal/dependent.ts` | 3단계 + 사유 코드 (`DependentReason`) |
| ISA 전환 | `withdrawal/isa-transfer.ts` | 추가 공제대상 `min(10%, 300만원)` · 퇴직 후 효과 제한 판정 |
| 체크 | `services/tax-health-check.service.ts` | 무저장 · 추정 보험료 vs 실제 고지액 |
| 동의·삭제 | `User.detailDataConsentAt` · `DELETE /api/withdrawal-scenarios` | 첫 계좌 저장 시 동의 필수 · 세트 삭제해도 리포트 유지 |
| 기준일 | `rules/rule-basis.ts` | 시뮬레이션 `outputData`에 `basisDate`·`ruleVersion` |