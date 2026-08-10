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
│   ├── domain/        # 엔티티
│   └── services/      # 비즈니스 로직 + *.test.ts
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
- Node.js 18+
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
| `npm run test` | Jest |
| `npm run type` | 타입 검사 |
| `npm run lint` / `format` | ESLint / Prettier |

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
- **세션:** idle 30분 슬라이딩 · absolute 12시간
- **Rate limit (15분):** auth 20 · api 300 · health 120
- **CORS:** production에서 `FRONTEND_ORIGIN` fail-closed · credentials 필수
- **소유권:** Simulation · Portfolio · Diagnosis `/me` 스코프
- **테스트:** TDD · 서비스와 동일 디렉터리 `*.test.ts`
