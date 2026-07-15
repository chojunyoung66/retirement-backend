# retirement-backend

은퇴 재무 시뮬레이션 백엔드 API 서버입니다. 국민연금, 건강보험, 퇴직금, 실업급여 등 노후 대비에 필요한 금융 계산 기능을 제공합니다.

## 기술 스택

| 분류 | 기술 |
|------|------|
| Runtime | Node.js + TypeScript |
| Framework | Express.js 5 |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (jsonwebtoken) |
| Validation | Zod |
| Testing | Jest + Supertest |

## 프로젝트 구조

```
src/
├── application/
│   ├── contracts/       # 서비스 인터페이스
│   ├── domain/          # 엔티티 정의
│   └── services/        # 비즈니스 로직 + 테스트
├── inbound/
│   ├── controllers/     # 라우트 핸들러
│   ├── middlewares/     # 인증·에러 처리
│   ├── routers/         # 라우트 정의
│   └── schemas/         # Zod 유효성 검사
├── outbound/
│   └── repos/           # Prisma 레포지토리
└── shared/
    ├── contracts/       # 유틸 인터페이스
    ├── exceptions/      # 커스텀 예외 클래스
    └── utils/           # JWT·bcrypt 유틸
```

## API 엔드포인트

### 인증 (공개)
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/auth/signup` | 회원가입 |
| POST | `/api/auth/signin` | 로그인 |

### 사용자 (인증 필요)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/users/me` | 프로필 조회 |
| PATCH | `/api/users/me` | 프로필·비밀번호 수정 |

### 은퇴 목표 (인증 필요)
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/retirement-goals` | 목표 생성 |
| GET | `/api/retirement-goals/me` | 내 목표 조회 |
| PATCH | `/api/retirement-goals/me` | 목표 수정 |

### 시뮬레이션 (인증 필요)
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/simulations/national-pension` | 국민연금 계산 |
| GET | `/api/simulations/national-pension/latest` | 최근 결과 조회 |
| POST | `/api/simulations/health-insurance` | 건강보험료 계산 |
| GET | `/api/simulations/health-insurance/latest` | 최근 결과 조회 |
| POST | `/api/simulations/severance-pay` | 퇴직금 계산 |
| GET | `/api/simulations/severance-pay/latest` | 최근 결과 조회 |
| POST | `/api/simulations/unemployment-benefit` | 실업급여 계산 |
| GET | `/api/simulations/unemployment-benefit/latest` | 최근 결과 조회 |
| POST | `/api/simulations/isa` | ISA 시뮬레이션 |
| GET | `/api/simulations/isa/latest` | 최근 결과 조회 |
| POST | `/api/simulations/irp` | IRP 시뮬레이션 |
| GET | `/api/simulations/irp/latest` | 최근 결과 조회 |

### 연금 포트폴리오 (인증 필요)
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/pension-portfolios` | 포트폴리오 생성 |
| GET | `/api/pension-portfolios` | 목록 조회 |
| GET | `/api/pension-portfolios/:id` | 상세 조회 |
| PATCH | `/api/pension-portfolios/:id` | 수정 |
| DELETE | `/api/pension-portfolios/:id` | 삭제 |

### 헬스체크 (공개)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 서버 상태 확인 |

## 시작하기

### 사전 요구사항
- Node.js 18+
- PostgreSQL

### 환경 변수

`.env` 파일을 생성하고 아래 값을 설정합니다.

```env
DATABASE_URL=postgresql://user:password@localhost:5432/retirement
JWT_SECRET=your_jwt_secret
PORT=3000
```

### 설치 및 실행

```bash
# 의존성 설치
npm install

# DB 마이그레이션
npx prisma migrate deploy

# 개발 서버 (핫 리로드)
npm run dev

# 프로덕션 빌드 및 실행
npm run build
npm start
```

### 스크립트

```bash
npm run dev      # 개발 서버 (tsx watch)
npm run build    # TypeScript 컴파일
npm start        # 프로덕션 실행
npm run test     # 테스트 실행
npm run type     # 타입 검사
npm run lint     # ESLint 검사
npm run format   # Prettier 포맷팅
```

## 아키텍처

클린 아키텍처 기반으로 계층을 분리합니다.

```
Controller → Service → Repository
```

- **의존성 주입**: 팩토리 함수 방식으로 모든 의존성을 `bootstrap.ts`에서 조립
- **예외 처리**: `BusinessException`(도메인 오류)·`TechnicException`(기술 오류) 구분
- **인증**: JWT 미들웨어로 보호된 라우트 일괄 처리
- **테스트**: TDD 방식, 서비스 코드와 테스트 파일 동일 위치 배치
