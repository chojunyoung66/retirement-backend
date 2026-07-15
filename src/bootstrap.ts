import cors from "cors";
import express from "express";

// Repos
import { createUserRepo } from "./outbound/repos/user.repo.js";
import { createRetirementGoalRepo } from "./outbound/repos/retirement-goal.repo.js";
import { createSimulationRepo } from "./outbound/repos/simulation.repo.js";
import { createPortfolioRepo } from "./outbound/repos/portfolio.repo.js";

// Services
import { createAuthService } from "./application/services/auth.service.js";
import { createUserService } from "./application/services/user.service.js";
import { createRetirementGoalService } from "./application/services/retirement-goal.service.js";
import { createSimulationService } from "./application/services/simulation.service.js";
import { createPortfolioService } from "./application/services/portfolio.service.js";

// Controllers
import { createAuthController } from "./inbound/controllers/auth.controller.js";
import { createUserController } from "./inbound/controllers/user.controller.js";
import { createRetirementGoalController } from "./inbound/controllers/retirement-goal.controller.js";
import { createSimulationController } from "./inbound/controllers/simulation.controller.js";
import { createPortfolioController } from "./inbound/controllers/portfolio.controller.js";

// Middlewares
import { createAuthMiddleware } from "./inbound/middlewares/auth.middleware.js";
import { errorMiddleware } from "./inbound/middlewares/error.middleware.js";

// Utils
import { createJwtUtil } from "./shared/utils/jwt.util.js";
import { createBcryptUtil } from "./shared/utils/bcrypt.util.js";

// Router
import { healthRouter } from "./inbound/routers/health.router.js";

export const createApp = () => {
  const app = express();

  // Middleware setup
  app.use(cors());
  app.use(express.json());

  // Utils 생성
  const jwtSecret = process.env.JWT_SECRET || "your_jwt_secret_key";
  const jwtUtil = createJwtUtil(jwtSecret);
  const hashUtil = createBcryptUtil();

  // Repos 생성
  const userRepo = createUserRepo();
  const retirementGoalRepo = createRetirementGoalRepo();
  const simulationRepo = createSimulationRepo();
  const portfolioRepo = createPortfolioRepo();

  // Services 생성
  const authService = createAuthService(userRepo, hashUtil, jwtUtil);
  const userService = createUserService(userRepo);
  const retirementGoalService = createRetirementGoalService(retirementGoalRepo);
  const simulationService = createSimulationService(simulationRepo);
  const portfolioService = createPortfolioService(portfolioRepo);

  // Controllers 생성
  const authController = createAuthController(authService);
  const userController = createUserController(userService);
  const retirementGoalController = createRetirementGoalController(retirementGoalService);
  const simulationController = createSimulationController(simulationService);
  const portfolioController = createPortfolioController(portfolioService);

  // Auth middleware 생성
  const authMiddleware = createAuthMiddleware(jwtUtil);

  // Public routes (인증 불필요)
  app.use("/health", healthRouter);
  app.use("/api/auth", authController.router);

  // Protected routes (인증 필요)
  app.use("/api/users", authMiddleware, userController.router);
  app.use("/api/retirement-goals", authMiddleware, retirementGoalController.router);
  app.use("/api/simulations", authMiddleware, simulationController.router);
  app.use("/api/pension-portfolios", authMiddleware, portfolioController.router);

  // Error middleware (마지막)
  app.use(errorMiddleware);

  return app;
};
