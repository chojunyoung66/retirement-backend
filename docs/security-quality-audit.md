# 최종 서비스 품질 · 보안 안정성 검토

> 갱신: 2026-08-04 · FE/BE 공통  
> **정본:** `retirement-frontend/docs/security-quality-audit.md`  
> 이 파일은 백엔드 작업 시 찾기 쉽도록 둔 요약·포인터입니다.

## 현재 상태

| Fixed | Open | Deferred |
|------:|-----:|---------:|
| 13 | 1 | 2 |

Critical(IDOR 등)은 해소. 가입 열거(High) Fixed. 다음 미션 우선순위는 FE 정본 **§5** 참고.

## Open / Deferred (BE 관련)

| Status | Severity | Finding | 위치 |
|--------|----------|---------|------|
| Fixed | High | 가입 이메일 열거 → `REGISTRATION_UNAVAILABLE` | `src/application/services/auth.service.ts` |
| Deferred | Medium | JWT 서버 폐기(denylist) | `auth.middleware` · session-policy |
| Deferred | Medium | 비밀번호 복잡도 | `inbound/schemas/auth.schemas.ts` |

## 이 저장소 관련 머지

| PR | 내용 |
|----|------|
| #19 | 포트폴리오·시뮬 IDOR, CORS fail-closed |
| #20 | production 쿠키 전용, password max 72 |
| #21 | 탈퇴/프로필 재인증 실패 → 400 |
| #22 | 레거시 app/server 차단, /health limit, json 64kb, diagnosis Zod |

## 다음 미션에서 BE가 담당할 가능성 큰 항목

1. 비밀번호 복잡도 정책 반영
2. JWT denylist / 세션 저장소 설계

상세 표·FE 이슈·검증 체크리스트는 FE 정본 문서를 본다.
