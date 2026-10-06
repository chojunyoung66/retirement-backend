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
import { createAccountAssetRepo } from "./outbound/repos/account-asset.repo.js";
import { createWithdrawalScenarioRepo } from "./outbound/repos/withdrawal-scenario.repo.js";
import { createReportRepo } from "./outbound/repos/report.repo.js";
import { createPaymentRepo } from "./outbound/repos/payment.repo.js";
import { createReviewRequestRepo } from "./outbound/repos/review-request.repo.js";
import { createExecutionPlanRepo } from "./outbound/repos/execution-plan.repo.js";
import { createTossPaymentGateway } from "./outbound/gateways/toss-payment.gateway.js";

// Services
import { createAuthService } from "./application/services/auth.service.js";
import { createUserService } from "./application/services/user.service.js";
import { createSimulationService } from "./application/services/simulation.service.js";
import { createPortfolioService } from "./application/services/portfolio.service.js";
import { createDiagnosisService } from "./application/services/diagnosis.service.js";
import { createAccountAssetService } from "./application/services/account-asset.service.js";
import { createWithdrawalScenarioService } from "./application/services/withdrawal-scenario.service.js";
import { createReportService } from "./application/services/report.service.js";
import { createPdfRenderer } from "./application/services/report/pdf-renderer.js";
import { createTaxHealthCheckService } from "./application/services/tax-health-check.service.js";
import { createXlsxRenderer } from "./application/services/report/report-workbook.js";
import { parsePaymentConfig } from "./application/services/payment-config.js";
import { createPaymentService } from "./application/services/payment.service.js";
import { createReviewRequestService } from "./application/services/review-request.service.js";
import { createExecutionPlanService } from "./application/services/execution-plan.service.js";
import type { IPaymentGateway } from "./application/contracts/payment-gateway.contract.js";
import { BusinessException } from "./shared/exceptions/business.exception.js";

// Controllers
import { createAuthController } from "./inbound/controllers/auth.controller.js";
import { createUserController } from "./inbound/controllers/user.controller.js";
import { createSimulationController } from "./inbound/controllers/simulation.controller.js";
import { createPortfolioController } from "./inbound/controllers/portfolio.controller.js";
import { createDiagnosisController } from "./inbound/controllers/diagnosis.controller.js";
import { createAccountAssetController } from "./inbound/controllers/account-asset.controller.js";
import { createWithdrawalScenarioController } from "./inbound/controllers/withdrawal-scenario.controller.js";
import { createReportController } from "./inbound/controllers/report.controller.js";
import { createTaxHealthCheckController } from "./inbound/controllers/tax-health-check.controller.js";
import { createPaymentController } from "./inbound/controllers/payment.controller.js";
import { createReviewRequestController } from "./inbound/controllers/review-request.controller.js";
import { createExecutionPlanController } from "./inbound/controllers/execution-plan.controller.js";
import { createAdminController } from "./inbound/controllers/admin.controller.js";

// Middlewares
import { createAuthMiddleware } from "./inbound/middlewares/auth.middleware.js";
import { createRequireOperator } from "./inbound/middlewares/require-operator.js";
import { errorMiddleware } from "./inbound/middlewares/error.middleware.js";

// Utils
import { createJwtUtil } from "./shared/utils/jwt.util.js";
import { createBcryptUtil } from "./shared/utils/bcrypt.util.js";
import { createGoogleTokenVerifier } from "./shared/utils/google-token-verifier.js";

// Router
import { healthRouter } from "./inbound/routers/health.router.js";

// 인증 엔드포인트는 브루트포스·크리덴셜 스터핑 방지를 위해 더 엄격한 요청 한도 적용
// GET /me·POST /logout은 세션 확인용이라 제외 (로컬 HMR/Strict Mode에 쉽게 소진됨)
const isDev = process.env.NODE_ENV !== "production";
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 300 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const path = req.path;
    if (req.method === "GET" && (path === "/me" || path.endsWith("/auth/me"))) {
      return true;
    }
    if (
      req.method === "POST" &&
      (path === "/logout" || path.endsWith("/auth/logout"))
    ) {
      return true;
    }
    return false;
  },
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
  limit: isDev ? 2000 : 300,
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

// 계산·PDF 렌더링이 무거운 엔드포인트는 IP당 더 엄격하게 제한
const heavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 500 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "계산 요청이 너무 많습니다. 잠시 후 다시 시도해주세요",
    },
  },
});

/** 결제가 꺼져 있을 때 — 키 없이도 서버가 뜨도록 호출 시점에만 거절한다 */
const disabledPaymentGateway: IPaymentGateway = {
  confirm: async () => {
    throw new BusinessException("PAYMENT_DISABLED", "결제가 설정되지 않았습니다", 400);
  },
  getPayment: async () => {
    throw new BusinessException("PAYMENT_DISABLED", "결제가 설정되지 않았습니다", 400);
  },
  cancel: async () => {
    throw new BusinessException("PAYMENT_DISABLED", "결제가 설정되지 않았습니다", 400);
  },
};

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
  const paymentConfig = parsePaymentConfig(process.env);
  const tossSecretKey = process.env.TOSS_SECRET_KEY?.trim();
  if (paymentConfig.enabled && !tossSecretKey) {
    throw new Error("REPORT_PAYMENT_ENABLED=true이면 TOSS_SECRET_KEY가 필요합니다.");
  }
  const paymentGateway = tossSecretKey
    ? createTossPaymentGateway(tossSecretKey)
    : disabledPaymentGateway;

  // Repos 생성
  const userRepo = createUserRepo();
  const simulationRepo = createSimulationRepo();
  const portfolioRepo = createPortfolioRepo();
  const diagnosisRepo = createDiagnosisRepo();
  const accountAssetRepo = createAccountAssetRepo();
  const scenarioRepo = createWithdrawalScenarioRepo();
  const reportRepo = createReportRepo();
  const paymentRepo = createPaymentRepo();
  const reviewRepo = createReviewRequestRepo();
  const executionPlanRepo = createExecutionPlanRepo();

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
  const accountAssetService = createAccountAssetService(accountAssetRepo);
  const withdrawalScenarioService = createWithdrawalScenarioService({
    accountAssetRepo,
    diagnosisRepo,
    simulationRepo,
    scenarioRepo,
  });
  const reportService = createReportService({
    reportRepo,
    scenarioRepo,
    paymentRepo,
    renderPdf: createPdfRenderer(),
    renderXlsx: createXlsxRenderer(),
    paymentConfig,
  });
  const paymentService = createPaymentService({
    paymentRepo,
    gateway: paymentGateway,
    reportService,
    config: paymentConfig,
  });
  const reviewService = createReviewRequestService({
    reviewRepo,
    reportRepo,
    executionPlanRepo,
    findUserEmail: async (userId) => (await userRepo.findById(userId))?.email ?? null,
  });
  const executionPlanService = createExecutionPlanService({ executionPlanRepo, reportRepo });
  const taxHealthCheckService = createTaxHealthCheckService();

  // Auth middleware 생성
  const authMiddleware = createAuthMiddleware(
    jwtUtil,
    async (userId) => (await userRepo.findById(userId)) !== null,
  );
  const requireOperator = createRequireOperator(
    async (userId) => (await userRepo.findById(userId))?.role ?? null,
  );

  // Controllers 생성
  const authController = createAuthController(authService, authMiddleware);
  const userController = createUserController(userService);
  const simulationController = createSimulationController(simulationService);
  const portfolioController = createPortfolioController(portfolioService);
  const diagnosisController = createDiagnosisController(diagnosisService);
  const accountAssetController = createAccountAssetController(accountAssetService);
  const withdrawalScenarioController = createWithdrawalScenarioController(
    withdrawalScenarioService,
  );
  const reportController = createReportController(reportService);
  const taxHealthCheckController = createTaxHealthCheckController(taxHealthCheckService);
  const paymentController = createPaymentController(paymentService);
  const reviewRequestController = createReviewRequestController(reviewService);
  const executionPlanController = createExecutionPlanController(executionPlanService);
  const adminController = createAdminController({ reviewService, paymentService });

  // Public routes (인증 불필요)
  app.use("/health", healthLimiter, healthRouter);
  app.use("/api/auth", authLimiter, authController.router);

  // Protected routes (인증 필요)
  app.use("/api/users", authMiddleware, userController.router);
  app.use("/api/simulations", authMiddleware, simulationController.router);
  app.use("/api/pension-portfolios", authMiddleware, portfolioController.router);
  app.use("/api/diagnoses", authMiddleware, diagnosisController.router);
  app.use("/api/account-assets", authMiddleware, accountAssetController.router);
  // 무거운 계산 경로는 별도 한도를 먼저 적용
  app.post("/api/withdrawal-scenarios/generate", heavyLimiter);
  app.get("/api/reports/:id/pdf", heavyLimiter);
  app.get("/api/reports/:id/xlsx", heavyLimiter);
  app.post("/api/payments/confirm", heavyLimiter);
  app.use(
    "/api/withdrawal-scenarios",
    authMiddleware,
    withdrawalScenarioController.router,
  );
  app.use("/api/reports", authMiddleware, executionPlanController.reportRouter);
  app.use("/api/reports", authMiddleware, reportController.router);
  app.use("/api/execution-plans", authMiddleware, executionPlanController.router);
  app.use("/api/payments", authMiddleware, paymentController.router);
  app.use("/api/review-requests", authMiddleware, reviewRequestController.router);
  app.use("/api/admin", authMiddleware, requireOperator, adminController.router);
  app.use(
    "/api/tax-health-check",
    heavyLimiter,
    authMiddleware,
    taxHealthCheckController.router,
  );

  // 매칭되지 않은 API 경로는 HTML 대신 JSON 404
  app.use("/api", (_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "요청한 API를 찾을 수 없습니다" },
    });
  });

  // Error middleware (마지막)
  app.use(errorMiddleware);

  return app;
};
