# retirement-backend

은퇴 재무 시뮬레이션 API 서버입니다.
인증·진단 저장·시뮬레이션(국민연금·건강보험·퇴직금·실업급여·ISA·IRP·주택연금)·연금 포트폴리오를 제공합니다.

- **배포:** https://retirement-backend-ph7y.onrender.com
- **프론트:** https://retirement-frontend-y2dn.vercel.app
- **흐름 정의서:** [`docs/feature-design-flow.md`](docs/feature-design-flow.md) (정본은 FE 레포 동명 문서)

## 기술 스택

| 분류 | 기술 |
|------|------|
| Runtime | Node.js + TypeScript |
| Framework | Express.js 5 |
| Database | PostgreSQL + Prisma 7 |
| Auth | JWT · HttpOnly 쿠키 · Google ID Token |
| Security | helmet · CORS credentials · rate-limit · Zod |
| Testing | Jest + Supertest |
| Deploy | Render (`render.yaml`) |

## 프로젝트 구조

클린 아키텍처. 의존성은 `src/bootstrap.ts`에서 조립합니다.

```
src/
├── application/
│   ├── contracts/     # 서비스 인터페이스
│   ├── rules/         # 연도별 제도 수치(rule-set.ts) · 시행일·출처
│   └── services/      # 비즈니스 로직 + *.test.ts
│       └── calculators/  # 시뮬레이션 산식 순수 함수 + 정답값 테스트
├── inbound/
│   ├── controllers/   # 라우트 핸들러
│   ├── middlewares/   # 인증·에러
│   ├── routers/       # health
│   └── schemas/       # Zod
├── outbound/repos/    # Prisma 구현
└── shared/
    ├── contracts/ · exceptions/ · utils/ · session-policy.ts
```

의존성 흐름: `Controller → Service → Repository`

## API 엔드포인트

베이스 경로 `/api` (헬스체크만 예외).

### 인증
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/auth/signup` | 공개 | 이메일 가입 |
| POST | `/api/auth/signin` | 공개 | 이메일 로그인 |
| POST | `/api/auth/google` | 공개 | Google ID 토큰 로그인 |
| POST | `/api/auth/google/link` | 공개 | 기존 계정 Google 연동 (비밀번호 재인증) |
| POST | `/api/auth/logout` | 공개 | 쿠키 제거 |
| GET | `/api/auth/me` | 필요 | 세션 프로필 |

성공 시 HttpOnly 쿠키 `retirement_token` (`Path=/api`, SameSite=Lax) 발급.
프로덕션에서는 Bearer 헤더를 무시하고 쿠키만 신뢰합니다.

### 사용자
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/users/me` | 프로필 |
| PATCH | `/api/users/me` | 프로필·비밀번호 수정 |
| DELETE | `/api/users/me` | 탈퇴 (재인증 · hard delete + cascade) |

### 진단 (유저당 1건)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/diagnoses/me/latest` | 최신 진단 |
| PUT | `/api/diagnoses/me/latest` | upsert (은퇴 수입 금액은 서버에서 0 sanitize) |
| DELETE | `/api/diagnoses/me/latest` | 삭제 |

> 별도 retirement-goals API는 없습니다. 진단이 목표·현금흐름 입력을 담당합니다.

### 시뮬레이션
| Method | Path | 설명 |
|--------|------|------|
| POST/GET | `/api/simulations/{type}` · `.../latest` | type: `national-pension`, `health-insurance`, `severance-pay`, `unemployment-benefit`, `isa`, `irp`, `housing-pension` |
| GET/PATCH/DELETE | `/api/simulations/:id` | 조회 · 상태(`draft`\|`confirmed`) · 삭제 |

- 모든 산출값(`outputData`)에 `ruleVersion`(예: `KR-2026.07`)이 포함됩니다.
- 제도 수치(국민연금 A값·건강보험료율·실업급여 상하한·퇴직소득세 공제표 등)는
  `src/application/rules/rule-set.ts` 한 곳에서 관리합니다. 연도가 바뀌면 이 파일과
  `calculators.test.ts` 정답값을 함께 갱신하고 `RULE_SET_VERSION`을 올립니다.
- 국민연금 가입 10년 미만은 `eligible: false`와 반환일시금 안내를 반환합니다.

### 연금 포트폴리오
| Method | Path | 설명 |
|--------|------|------|
| POST/GET | `/api/pension-portfolios` | 생성 · 목록 |
| GET/PATCH/DELETE | `/api/pension-portfolios/:id` | 상세 · 수정 · 삭제 |

### 헬스체크
| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 서버 상태 (FE 콜드스타트 워밍용) |

## 시작하기

### 사전 요구사항
- Node.js 22.12+ (`package.json` engines · Prisma 7 요구사항)
- PostgreSQL

### 환경 변수

`.env.example` 참고:

```env
DATABASE_URL="postgresql://USER@localhost:5432/DB_NAME?schema=public"
JWT_SECRET=""          # crypto.randomBytes(64).toString('hex')
PORT=3000
NODE_ENV=development
GOOGLE_CLIENT_ID=""    # FE VITE_GOOGLE_CLIENT_ID와 동일
FRONTEND_ORIGIN="http://localhost:5173"  # production 필수 · credentials CORS
```

### 설치 및 실행

```bash
npm install
npx prisma migrate deploy
npm run dev          # tsx watch
npm run build && npm start
```

### 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 |
| `npm run build` | TypeScript 컴파일 |
| `npm start` | migrate deploy + 프로덕션 실행 |
| `npm run test` | Jest (Windows에서도 동작하도록 `jest.js` 직접 실행) |
| `npm run type` | 타입 검사 |
| `npm run lint` / `format` | ESLint / Prettier |
| `npm run migrate:resolve-legacy` | 수동 복구 전용 — 아래 "배포·마이그레이션" 참고 |

## 배포·마이그레이션

- **CI:** `.github/workflows/ci.yml` — `npm ci` → prisma validate → lint → type → test → build
- **Render:** `render.yaml` — `npm ci --include=dev && npm run build`, 시작 시 `prisma migrate deploy`,
  헬스체크 `/health`
- **레거시 테이블:** `HealthInsuranceSimulation`·`IsaSimulation`은 `SimulationResult`로 통합되어
  스키마에서 제거했습니다. 마이그레이션 `20261004_archive_legacy_simulation_tables`는 데이터 보존을 위해
  `_archived_*`로 **이름만 변경**합니다. 운영 행 수 확인 후 별도 마이그레이션으로 DROP 하세요.
  (`prisma migrate dev` 실행 시 이 두 테이블 삭제 마이그레이션이 제안될 수 있습니다.)
- **실패 마이그레이션 복구:** `scripts/resolve-failed-migration.js`는 과거
  `20260729075647_split_pension_fields` 실패 기록 전용 수동 도구입니다. 시작 명령에서는 제거했으며,
  `migrate deploy`가 P3009로 멈출 때만 실행합니다. SSL 인증서 검증이 기본이며, 꼭 필요할 때만
  `PGSSL_REJECT_UNAUTHORIZED=false`로 끕니다.

## 요청/응답

```json
{ "success": true, "data": { } }
{ "success": false, "error": { "code": "ERROR_CODE", "message": "설명" } }
```

쿠키 세션이 기본입니다. 로컬·레거시 호환을 위해 개발 환경에서만 Bearer도 동작할 수 있습니다.

```http
Cookie: retirement_token=eyJ...
```

## 아키텍처 · 보안 요약

- **DI:** `bootstrap.ts`에서 utils → repos → services → controllers 조립 (`index.ts` 기동)
- **예외:** `BusinessException` / `TechnicalException`
- **에러 매핑:** 잘못된 JSON 400(`INVALID_JSON`) · 본문 64kb 초과 413(`PAYLOAD_TOO_LARGE`) ·
  Prisma P2025 404(`NOT_FOUND`). Prisma 에러는 원문(쿼리 값) 대신 이름·코드만 로그에 남깁니다.
- **입력 검증:** 진단 금액은 원 단위 정수, 개인 가구의 배우자 필드는 무시(null 저장) ·
  ISA 연 납입 2천만원 상한 · 실업급여 가입 0.5년 이상 · 포트폴리오 비중 합 100%,
  계좌 유형 `IRP`/`ISA`/`연금저축`/`일반계좌`, 항목 최대 50개
- **세션:** idle 30분 슬라이딩 · absolute 12시간
- **Rate limit (15분):** auth 20 · api 300 · health 120
- **CORS:** production에서 `FRONTEND_ORIGIN` fail-closed · credentials 필수
- **소유권:** Simulation · Portfolio · Diagnosis `/me` 스코프
- **테스트:** TDD · 서비스와 동일 디렉터리 `*.test.ts`
