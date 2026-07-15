# API 테스트 결과

- **테스트 일시:** 2026-07-15
- **서버:** https://retirement-backend-1.onrender.com

## 인증 API

| 엔드포인트 | 결과 |
|-----------|------|
| `POST /api/auth/signup` | 정상 |
| `POST /api/auth/signin` | 정상 |

## 유저 API

| 엔드포인트 | 결과 |
|-----------|------|
| `GET /api/users/me` | 정상 |
| `PATCH /api/users/me` | 정상 |

## 은퇴 목표 API

| 엔드포인트 | 결과 |
|-----------|------|
| `POST /api/retirement-goals` | 정상 |
| `GET /api/retirement-goals/me` | 정상 |
| `PATCH /api/retirement-goals/me` | 정상 |

## 포트폴리오 API

| 엔드포인트 | 결과 |
|-----------|------|
| `POST /api/pension-portfolios` | 정상 |
| `GET /api/pension-portfolios` | 정상 |
| `GET /api/pension-portfolios/:id` | 정상 |
| `PATCH /api/pension-portfolios/:id` | 정상 |
| `DELETE /api/pension-portfolios/:id` | 정상 |

## 시뮬레이션 API

| 엔드포인트 | 결과 |
|-----------|------|
| `POST /api/simulations/health-insurance` | 정상 |
| `GET /api/simulations/health-insurance/latest` | 정상 |
| `POST /api/simulations/isa` | 정상 |
| `GET /api/simulations/isa/latest` | 정상 |
| `POST /api/simulations/national-pension` | 정상 |
| `GET /api/simulations/national-pension/latest` | 정상 |
| `POST /api/simulations/irp` | 정상 |
| `GET /api/simulations/irp/latest` | 정상 |
| `POST /api/simulations/severance-pay` | 정상 |
| `GET /api/simulations/severance-pay/latest` | 정상 |
| `POST /api/simulations/unemployment-benefit` | 정상 |
| `GET /api/simulations/unemployment-benefit/latest` | 정상 |
