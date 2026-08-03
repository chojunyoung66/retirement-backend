import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Repos
import { createUserRepo } from "./outbound/repos/user.repo.js";
import { createSimulationRepo } from "./outbound/repos/simulation.repo.js";
import { createPortfolioRepo } from "./outbound/repos/portfolio.repo.js";
import { createDiagnosisRepo } from "./outbound/repos/diagnosis.repo.js";

// Services
import { createAuthService } from "./application/services/auth.service.js";
import { createUserService } from "./application/services/user.service.js";
import { createSimulationService } from "./application/services/simulation.service.js";
import { createPortfolioService } from "./application/services/portfolio.service.js";
import { createDiagnosisService } from "./application/services/diagnosis.service.js";

// Controllers
import { createAuthController } from "./inbound/controllers/auth.controller.js";
import { createUserController } from "./inbound/controllers/user.controller.js";
import { createSimulationController } from "./inbound/controllers/simulation.controller.js";
import { createPortfolioController } from "./inbound/controllers/portfolio.controller.js";
import { createDiagnosisController } from "./inbound/controllers/diagnosis.controller.js";

// Middlewares
import { createAuthMiddleware } from "./inbound/middlewares/auth.middleware.js";
import { errorMiddleware } from "./inbound/middlewares/error.middleware.js";

// Utils
import { createJwtUtil } from "./shared/utils/jwt.util.js";
import { createBcryptUtil } from "./shared/utils/bcrypt.util.js";
import { createGoogleTokenVerifier } from "./shared/utils/google-token-verifier.js";

// Router
import { healthRouter } from "./inbound/routers/health.router.js";

// 인증 엔드포인트는 브루트포스·크리덴셜 스터핑 방지를 위해 더 엄격한 요청 한도 적용
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요",
    },
  },
});

// 전체 API에 대한 기본 요청 한도 (남용·DoS성 트래픽 완화)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요",
    },
  },
});

// 헬스체크 스캔·남용 완화 (API보다 여유)
const healthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

export const createApp = () => {
  const app = express();

  // Render 등 리버스 프록시 뒤에서도 클라이언트 IP 기준으로 rate limit이 동작하도록 설정
  app.set("trust proxy", 1);

  // 기본 HTTP 보안 헤더
  app.use(helmet());

  // Middleware setup — credentials CORS (Vercel↔Render 쿠키)
  const frontendOrigin = process.env.FRONTEND_ORIGIN;
  // production에서 미설정 시 Origin 반사 CORS 방지
  if (process.env.NODE_ENV === "production" && !frontendOrigin) {
    throw new Error("FRONTEND_ORIGIN 환경변수가 설정되지 않았습니다.");
  }
  app.use(
    cors({
      origin: frontendOrigin || true,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  // JSON body 상한 — 기본값보다 명시적으로 제한
  app.use(express.json({ limit: "64kb" }));
  app.use("/api", apiLimiter);

  // Utils 생성
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT_SECRET 환경변수가 설정되지 않았습니다.");
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    throw new Error("GOOGLE_CLIENT_ID 환경변수가 설정되지 않았습니다.");
  }
  const jwtUtil = createJwtUtil(jwtSecret);
  const hashUtil = createBcryptUtil();
  const googleTokenVerifier = createGoogleTokenVerifier(googleClientId);

  // Repos 생성
  const userRepo = createUserRepo();
  const simulationRepo = createSimulationRepo();
  const portfolioRepo = createPortfolioRepo();
  const diagnosisRepo = createDiagnosisRepo();

  // Services 생성
  const authService = createAuthService(
    userRepo,
    hashUtil,
    jwtUtil,
    googleTokenVerifier,
  );
  const userService = createUserService(userRepo, hashUtil);
  const simulationService = createSimulationService(simulationRepo);
  const portfolioService = createPortfolioService(portfolioRepo);
  const diagnosisService = createDiagnosisService(diagnosisRepo);

  // Auth middleware 생성
  const authMiddleware = createAuthMiddleware(jwtUtil);

  // Controllers 생성
  const authController = createAuthController(authService, authMiddleware);
  const userController = createUserController(userService);
  const simulationController = createSimulationController(simulationService);
  const portfolioController = createPortfolioController(portfolioService);
  const diagnosisController = createDiagnosisController(diagnosisService);

  // Public routes (인증 불필요)
  app.use("/health", healthLimiter, healthRouter);
  app.use("/api/auth", authLimiter, authController.router);

  // Protected routes (인증 필요)
  app.use("/api/users", authMiddleware, userController.router);
  app.use("/api/simulations", authMiddleware, simulationController.router);
  app.use("/api/pension-portfolios", authMiddleware, portfolioController.router);
  app.use("/api/diagnoses", authMiddleware, diagnosisController.router);

  // Error middleware (마지막)
  app.use(errorMiddleware);

  return app;
};
