# Retirement Backend 구조 설계

## 1. 목적 및 배경

이 문서는 `retirement-backend`를 `codeit-business-backend`의 검증된 아키텍처를 참고하여 구축하기 위한 설계안이다. 기존 `api-plan.md`의 REST API 스펙을 구현하되, `6day-mission-todo-plan`의 tRPC+Drizzle 기술스택은 실제 설치 의존성(Express 5, Prisma)과 불일치하므로 참고하지 않는다.

## 2. 아키텍처 개요

4계층 레이어드 아키텍처 + 팩토리 패턴 DI를 채택한다.

- **application**: 순수 비즈니스 로직 (프레임워크 독립적)
  - `contracts/`: 모든 의존성을 `I*Contract` 인터페이스로 정의
  - `domain/`: 계산 로직 (건강보험료, ISA 시뮬레이션 공식)
  - `services/`: 핵심 유스케이스 구현 (TDD 기반)

- **inbound**: HTTP 진입점 (Express)
  - `controllers/`: 라우팅, 요청 응답 처리
  - `middlewares/`: 인증, 에러 처리
  - `schemas/`: zod 요청 검증

- **outbound**: 데이터 지속성 (Prisma)
  - `repos/`: DB 접근 로직

- **shared**: 횡단 관심사
  - `contracts/`: 유틸 인터페이스
  - `exceptions/`: 비즈니스/기술 예외
  - `utils/`: JWT, bcrypt 유틸

## 3. 디렉토리 구조

```
src/
  application/
    contracts/
      user-repo.contract.ts
      retirement-goal-repo.contract.ts
      simulation-repo.contract.ts
      portfolio-repo.contract.ts
      hash-util.contract.ts
      jwt-util.contract.ts
    domain/
      health-insurance.ts
      isa-simulation.ts
    services/
      auth.service.ts
      user.service.ts
      retirement-goal.service.ts
      health-insurance.service.ts
      isa-simulation.service.ts
      pension-portfolio.service.ts
      (+ 각 .test.ts)
  bootstrap.ts
  index.ts
  inbound/
    controllers/
      auth.controller.ts
      user.controller.ts
      retirement-goal.controller.ts
      health-insurance.controller.ts
      isa-simulation.controller.ts
      pension-portfolio.controller.ts
    middlewares/
      auth.middleware.ts
      error.middleware.ts
    schemas/
      auth.schemas.ts
      retirement-goal.schemas.ts
      simulation.schemas.ts
      portfolio.schemas.ts
  outbound/
    repos/
      prismaClient.ts
      user.repo.ts
      retirement-goal.repo.ts
      simulation.repo.ts
      portfolio.repo.ts
  shared/
    contracts/
      hash-util.contract.ts
      jwt-util.contract.ts
    exceptions/
      business.exception.ts
      technical.exception.ts
    utils/
      bcrypt.util.ts
      jwt.util.ts
    express.d.ts
prisma/
  schema.prisma
  migrations/
```

## 4. Prisma 스키마 초안

```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  retirementGoal    RetirementGoal?
  healthSimulations HealthInsuranceSimulation[]
  isaSimulations    IsaSimulation[]
  portfolios        PensionPortfolio[]
}

model RetirementGoal {
  id                    Int    @id @default(autoincrement())
  userId                Int    @unique
  birthYear             Int
  retirementYear        Int
  monthlyLivingExpense  Int
  nationalPension       Int
  retirementAsset       Int
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  user                  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model HealthInsuranceSimulation {
  id                      Int    @id @default(autoincrement())
  userId                  Int
  monthlyIncome           Int
  propertyValue           Int
  carValue                Int
  estimatedMonthlyPremium Float
  notice                  String?
  createdAt               DateTime @default(now())
  user                    User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model IsaSimulation {
  id                 Int    @id @default(autoincrement())
  userId             Int
  annualContribution Int
  expectedReturnRate Float
  investmentYears    Int
  expectedProfit     Float
  estimatedTaxSaving Float
  notice             String?
  createdAt          DateTime @default(now())
  user               User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model PensionPortfolio {
  id          Int    @id @default(autoincrement())
  userId      Int
  accountType String
  name        String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  items       PensionPortfolioItem[]
  user        User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model PensionPortfolioItem {
  id          Int     @id @default(autoincrement())
  portfolioId Int
  symbol      String
  name        String
  allocation  Float
  createdAt   DateTime @default(now())
  portfolio   PensionPortfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
}
```

## 5. API ↔ 레이어 매핑

| API | Controller | Service | Repo | Schema |
|-----|----------|---------|------|--------|
| POST /api/auth/signup | auth | auth | user | auth.schemas |
| POST /api/auth/signin | auth | auth | user | auth.schemas |
| GET /api/users/me | user | user | user | - |
| POST /api/retirement-goals | retirement-goal | retirement-goal | retirement-goal | retirement-goal.schemas |
| GET /api/retirement-goals/me | retirement-goal | retirement-goal | retirement-goal | - |
| PATCH /api/retirement-goals/me | retirement-goal | retirement-goal | retirement-goal | retirement-goal.schemas |
| POST /api/simulations/health-insurance | health-insurance | health-insurance | simulation | simulation.schemas |
| GET /api/simulations/health-insurance/latest | health-insurance | health-insurance | simulation | - |
| POST /api/simulations/isa | isa-simulation | isa-simulation | simulation | simulation.schemas |
| GET /api/simulations/isa/latest | isa-simulation | isa-simulation | simulation | - |
| POST /api/pension-portfolios | pension-portfolio | pension-portfolio | portfolio | portfolio.schemas |
| GET /api/pension-portfolios | pension-portfolio | pension-portfolio | portfolio | - |
| GET /api/pension-portfolios/:id | pension-portfolio | pension-portfolio | portfolio | - |
| PATCH /api/pension-portfolios/:id | pension-portfolio | pension-portfolio | portfolio | portfolio.schemas |
| DELETE /api/pension-portfolios/:id | pension-portfolio | pension-portfolio | portfolio | - |

## 6. 네이밍 컨벤션

- **Contract**: `*-repo.contract.ts` (e.g. `user-repo.contract.ts`), interface 이름은 `I*Repo`
- **Service**: `*.service.ts`, `*.service.test.ts` (e.g. `auth.service.ts`)
  - export: `createXxxService(deps) => ({ method1, method2 })`
  - export: `type XxxServiceType = ReturnType<typeof createXxxService>`
- **Controller**: `*.controller.ts` (e.g. `auth.controller.ts`)
  - export: `createXxxController(services, middleware?) => ({ router })`
- **Repo**: `*.repo.ts` (e.g. `user.repo.ts`)
  - export: `createXxxRepo(): IXxxRepo`
- **Schema**: `*.schemas.ts` (e.g. `auth.schemas.ts`)
  - naming: `xxxDataSchema` (zod), 한글 검증 메시지
- **응답 형식**: 성공 `{success:true, data:{...}}`, 실패 `{success:false, error:{code,message}}`

## 7. 주의사항 및 정리 권고

- ✅ 루트 `settings.json` 제거 완료
- `server/` 폴더 (의존성 오타 `rxpress`) 제거 검토 필요
- `docs/api-plan.md` 중복 제거 권고
- `docs/6day-mission-todo-plan`은 Prisma+Express 기준으로 갱신 권고

## 8. 구현 순서

1. 설정 파일 (tsconfig.json, jest.config.ts 등 codeit-business-backend에서 복사)
2. Prisma 스키마 작성 및 마이그레이션
3. shared/ (예외, 유틸, 계약 인터페이스)
4. auth/user (TDD: 해피패스 → 리뷰 → 엣지케이스)
5. retirement-goal, 시뮬레이션, 포트폴리오 순차 구현
6. bootstrap.ts, index.ts 최종 통합
