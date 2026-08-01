import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";

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

export const createApp = () => {
  const app = express();

  // Middleware setup — credentials CORS (Vercel↔Render 쿠키)
  const frontendOrigin = process.env.FRONTEND_ORIGIN;
  app.use(
    cors({
      origin: frontendOrigin || true,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json());

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
  const userService = createUserService(userRepo);
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
  app.use("/health", healthRouter);
  app.use("/api/auth", authController.router);

  // Protected routes (인증 필요)
  app.use("/api/users", authMiddleware, userController.router);
  app.use("/api/simulations", authMiddleware, simulationController.router);
  app.use("/api/pension-portfolios", authMiddleware, portfolioController.router);
  app.use("/api/diagnoses", authMiddleware, diagnosisController.router);

  // Error middleware (마지막)
  app.use(errorMiddleware);

  return app;
};
