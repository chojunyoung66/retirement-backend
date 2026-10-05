import { Router, Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";
import type { SimulationServiceType } from "../../application/services/simulation.service.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import {
  healthInsuranceSimulationSchema,
  isaSimulationSchema,
  nationalPensionSimulationSchema,
  irpSimulationSchema,
  severancePaySimulationSchema,
  unemploymentBenefitSimulationSchema,
  housingPensionSimulationSchema,
  simulationUpdateSchema,
} from "../schemas/simulation.schemas.js";
import { parseIdParam } from "../utils/parse-id.js";
import { calculateHousingPension } from "../../application/services/housing-pension.service.js";
import { calculateHealthInsurance } from "../../application/services/calculators/health-insurance.calculator.js";
import { calculateNationalPension } from "../../application/services/calculators/national-pension.calculator.js";
import { calculateSeverancePay } from "../../application/services/calculators/severance-pay.calculator.js";
import { calculateUnemploymentBenefit } from "../../application/services/calculators/unemployment-benefit.calculator.js";
import {
  calculateIrp,
  calculateIsa,
} from "../../application/services/calculators/savings-account.calculator.js";
import { withRuleBasis, type RuleBasis } from "../../application/rules/rule-basis.js";
import {
  HEALTH_INSURANCE_RULES,
  IRP_RULES,
  ISA_RULES,
  NATIONAL_PENSION_RULES,
  SEVERANCE_TAX_RULES,
  UNEMPLOYMENT_RULES,
} from "../../application/rules/rule-set.js";

type Json = Record<string, unknown>;

const requireUserId = (req: Request): number => {
  // 인증 미들웨어가 주입한 사용자 ID 확인
  const userId = req.userId;
  if (!userId) {
    throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
  }
  return userId;
};

const parseBody = <T>(schema: ZodType<T>, body: unknown): T => {
  // Zod 검증 실패 메시지를 400 응답으로 변환
  const validation = schema.safeParse(body);
  if (!validation.success) {
    const message = validation.error.issues
      .map((issue) => issue.message)
      .join(", ");
    throw new BusinessException(
      "INVALID_REQUEST",
      message || "요청 데이터가 유효하지 않습니다",
      400,
    );
  }
  return validation.data;
};

const parseSimulationId = (req: Request): number =>
  parseIdParam(req, "유효한 시뮬레이션 ID가 아닙니다");

export const createSimulationController = (
  simulationService: SimulationServiceType,
) => {
  const router = Router();

  // 검증 → 계산 → 저장 흐름을 공통화한 POST 라우트 등록
  const registerCreate = <T extends object>(
    path: string,
    schema: ZodType<T>,
    calculate: (input: T) => object,
    save: (userId: number, input: Json, output: Json) => Promise<unknown>,
    basis?: RuleBasis,
  ) => {
    router.post(path, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = requireUserId(req);
        const input = parseBody(schema, req.body);
        const calculated = calculate(input);
        const output = basis ? withRuleBasis(basis, calculated) : calculated;
        const result = await save(userId, input as Json, output as Json);
        res.status(201).json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    });
  };

  // 최신 결과 조회 GET 라우트 등록
  const registerLatest = (
    path: string,
    getLatest: (userId: number) => Promise<unknown>,
  ) => {
    router.get(path, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = requireUserId(req);
        const latest = await getLatest(userId);
        res.status(200).json({ success: true, data: latest });
      } catch (error) {
        next(error);
      }
    });
  };

  registerCreate(
    "/health-insurance",
    healthInsuranceSimulationSchema,
    calculateHealthInsurance,
    (u, i, o) => simulationService.createHealthInsurance(u, i, o),
    { domain: "건강보험", meta: HEALTH_INSURANCE_RULES.meta },
  );
  registerLatest("/health-insurance/latest", (u) =>
    simulationService.getLatestHealthInsurance(u),
  );

  registerCreate(
    "/isa",
    isaSimulationSchema,
    calculateIsa,
    (u, i, o) => simulationService.createIsa(u, i, o),
    { domain: "ISA", meta: ISA_RULES.meta },
  );
  registerLatest("/isa/latest", (u) => simulationService.getLatestIsa(u));

  registerCreate(
    "/national-pension",
    nationalPensionSimulationSchema,
    calculateNationalPension,
    (u, i, o) => simulationService.createNationalPension(u, i, o),
    { domain: "국민연금", meta: NATIONAL_PENSION_RULES.meta },
  );
  registerLatest("/national-pension/latest", (u) =>
    simulationService.getLatestNationalPension(u),
  );

  registerCreate(
    "/irp",
    irpSimulationSchema,
    calculateIrp,
    (u, i, o) => simulationService.createIrp(u, i, o),
    { domain: "연금계좌 세액공제", meta: IRP_RULES.meta },
  );
  registerLatest("/irp/latest", (u) => simulationService.getLatestIrp(u));

  registerCreate(
    "/severance-pay",
    severancePaySimulationSchema,
    calculateSeverancePay,
    (u, i, o) => simulationService.createSeverancePay(u, i, o),
    { domain: "퇴직소득세", meta: SEVERANCE_TAX_RULES.meta },
  );
  registerLatest("/severance-pay/latest", (u) =>
    simulationService.getLatestSeverancePay(u),
  );

  registerCreate(
    "/unemployment-benefit",
    unemploymentBenefitSimulationSchema,
    calculateUnemploymentBenefit,
    (u, i, o) => simulationService.createUnemploymentBenefit(u, i, o),
    { domain: "실업급여", meta: UNEMPLOYMENT_RULES.meta },
  );
  registerLatest("/unemployment-benefit/latest", (u) =>
    simulationService.getLatestUnemploymentBenefit(u),
  );

  // HF 표 기반 산식 (eligible:false도 저장)
  registerCreate(
    "/housing-pension",
    housingPensionSimulationSchema,
    calculateHousingPension,
    (u, i, o) => simulationService.createHousingPension(u, i, o),
  );
  registerLatest("/housing-pension/latest", (u) =>
    simulationService.getLatestHousingPension(u),
  );

  // GET /api/simulations/:id
  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const simulationId = parseSimulationId(req);
      const simulation = await simulationService.getSimulationById(
        simulationId,
        userId,
      );
      res.status(200).json({ success: true, data: simulation });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/simulations/:id
  router.delete(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = requireUserId(req);
        const simulationId = parseSimulationId(req);
        await simulationService.deleteSimulation(simulationId, userId);
        res.status(200).json({ success: true });
      } catch (error) {
        next(error);
      }
    },
  );

  // PATCH /api/simulations/:id
  router.patch(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = requireUserId(req);
        const simulationId = parseSimulationId(req);
        const data = parseBody(simulationUpdateSchema, req.body);
        const updated = await simulationService.updateSimulation(
          simulationId,
          userId,
          data,
        );
        res.status(200).json({ success: true, data: updated });
      } catch (error) {
        next(error);
      }
    },
  );

  return { router };
};

export type SimulationControllerType = ReturnType<
  typeof createSimulationController
>;
