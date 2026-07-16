# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 명령어

| 명령 | 용도 |
|------|------|
| `npm run dev` | 개발 서버 실행 (핫리로드) |
| `npm run build` | TypeScript 빌드 (`dist/` 출력) |
| `npm run type` | 타입 체크만 실행 |
| `npm run test` | 전체 테스트 실행 |
| `npm run test -- <패턴>` | 특정 테스트 실행 (예: `npm run test -- auth.service`) |
| `npm run lint` | ESLint 검사 |
| `npm run format` | Prettier 포맷 |

## 아키텍처

Clean Architecture(Hexagonal)를 따르며, 모든 의존성은 `src/bootstrap.ts`에서 조립한다.

```
inbound/      HTTP 진입점 — controllers, middlewares, schemas, routers
application/  순수 비즈니스 로직 — services(+테스트), contracts, domain
outbound/     데이터베이스 — repos (Prisma 구현체)
shared/       공통 유틸리티 — utils, contracts(인터페이스), exceptions
```

**의존성 흐름:** `Controllers → Services → Repos`

**DI 조립 순서 (`bootstrap.ts`):** utils → repos → services → controllers → middlewares → 라우터 마운트

### 주요 설계 규칙

- 모든 의존성 주입 대상(레포지토리, 유틸)은 반드시 `contracts/` 디렉토리에 인터페이스가 존재해야 한다. 없으면 작업 중단 후 알림.
- 커스텀 예외: `BusinessException`(도메인 오류), `TechnicalException`(인프라 오류) — `shared/exceptions/` 참조.
- Zod 스키마로 HTTP 요청 유효성 검사 (`inbound/schemas/`).

### 데이터베이스

- PostgreSQL + Prisma ORM, 스키마: `prisma/schema.prisma`
- 마이그레이션: `npx prisma migrate deploy`
- 필수 환경변수: `DATABASE_URL`, `JWT_SECRET`, `PORT`

### 테스트 패턴

- 테스트 파일은 소스 파일과 동일 디렉토리에 위치 (`*.test.ts`)
- 서비스 테스트: 모든 의존성을 jest mock으로 주입
- ESM 지원: `node --experimental-vm-modules` + ts-jest

## 문서 작성 가이드

- 한글로 작성해야 합니다.
- 문서는 반드시 200줄 이하로 완성합니다.

## 코드 작성 가이드

- 함수를 작성할 때, 함수 내부에 논리 단위로 주석을 작성해주세요.
- 주석은 핵심만 담아서 짧고 간결하게 한 문장으로 써야합니다.

## 서비스 코드 작성 가이드

`application/services` 코드를 작성할 때 다음의 세부 사항을 고려하세요.

- TDD 원칙에 따라 해피패스 테스트를 먼저 작성하고, 테스트를 실패시킨 후, 해피패스를 통과하는 서비스 코드를 작성하세요.
- 위 작업이 완료되면 개발자에게 검토를 요청하세요.
- 해피패스 합의 후 엣지 케이스 작업 시: 가장 크리티컬한 케이스 최대 2개를 먼저 제안하고 개발자와 의논 후 작성하세요.
- 작업 종료 후 반드시 `npm run type`을 실행하세요.

## 추가 주의사항

- 로직 구현 후 `npm run test`로 테스트를 검증하세요.
- 새로 작성한 테스트가 실패하면 직접 수정하세요. 기존 테스트가 실패하면 작업을 중단하고 원인을 분석해서 알려주세요.
