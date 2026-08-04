# 고도화 기능 설계 · 흐름 정의서

> 갱신: 2026-08-04 · **현 미션 마감 핸드오프**  
> **정본:** `retirement-frontend/docs/feature-design-flow.md`  
> 보안 감사 상세 표는 레포 외부(Drive 등) 보관

이 파일은 BE 작업 시 찾기 쉬운 포인터다. 흐름·도메인·다음 미션(지표·로그) 계측점은 FE 정본 §3~§8을 본다.

## BE 라이브 경계 (요약)

| 항목 | 내용 |
|------|------|
| 기동 | `src/index.ts` → `bootstrap.ts` (`app.ts`/`server.ts` 레거시 차단) |
| 도메인 | auth · users · diagnoses · simulations · pension-portfolios · health |
| 세션 | HttpOnly `retirement_token` · idle 30m · absolute 12h |
| 보안 유지 | CORS fail-closed · 소유권 · signup `REGISTRATION_UNAVAILABLE` |
| Deferred | JWT denylist · 비밀번호 복잡도 |

## 다음 미션에서 BE가 먼저 닿는 지점

1. request 로그: method·path·status·latency·requestId (PII 제외)  
2. auth 결과 코드 집계 (열거 유발 세분화 금지)  
3. `*_FORBIDDEN` / rate-limit 초과 모니터링  
4. diagnosis sanitize(연금 0)와 로그 필드 정합  

상세 funnel·제약: FE 정본 **§8**.
