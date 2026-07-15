import { Router, Request, Response, NextFunction } from "express";
import type { SimulationServiceType } from "../../application/services/simulation.service.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import {
  healthInsuranceSimulationSchema,
  isaSimulationSchema,
  nationalPensionSimulationSchema,
  irpSimulationSchema,
  severancePaySimulationSchema,
  unemploymentBenefitSimulationSchema,
} from "../schemas/simulation.schemas.js";

export const createSimulationController = (simulationService: SimulationServiceType) => {
  const router = Router();

  // POST /api/simulations/health-insurance
  router.post("/health-insurance", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      // 요청 검증
      const validation = healthInsuranceSimulationSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.issues.map((issue) => issue.message).join(", ");
        throw new BusinessException("INVALID_REQUEST", message || "요청 데이터가 유효하지 않습니다", 400);
      }

      const { pensionIncome, laborIncome, businessIncome, interestDividendIncome, otherIncome, propertyValue, carValue } = validation.data;

      // 2024년 기준 지역가입자 건강보험료 산정

      // 소득인정액 계산 (연간): 소득 유형별 인정률 적용
      const recognizedAnnualIncome =
        pensionIncome * 0.5 +                                      // 공적연금: 50%
        laborIncome * 0.5 +                                        // 근로소득: 50%
        businessIncome * 1.0 +                                     // 사업소득: 100%
        Math.max(0, interestDividendIncome - 10_000_000) * 1.0 +  // 이자·배당: 1,000만원 초과분 100%
        otherIncome * 0.2;                                         // 기타소득: 필요경비 80% 공제 후 20%

      const recognizedMonthlyIncome = recognizedAnnualIncome / 12;

      // 소득보험료: 연 소득인정액 336만원 초과 시 보험료율 7.09% 적용
      const PREMIUM_RATE = 0.0709;
      const MIN_HEALTH_PREMIUM = 19_780; // 2024년 최저보험료
      const incomePremium = recognizedAnnualIncome > 3_360_000
        ? recognizedMonthlyIncome * PREMIUM_RATE
        : 0;

      // 재산보험료: 재산 과표에서 5,000만원 기본공제 후 점수제 (점수당 208.4원)
      const SCORE_UNIT = 208.4;
      const propertyAfterDeduction = Math.max(0, propertyValue - 50_000_000);
      // 구간당 450만원 = 22점 (2024년 기준 등급표 근사)
      const propertyScore = Math.floor(propertyAfterDeduction / 4_500_000) * 22;
      const propertyPremium = propertyScore * SCORE_UNIT;

      // 차량보험료: 4,000만원 이상 차량만 부과 (점수제)
      const carScore =
        carValue >= 100_000_000 ? 60 :
        carValue >= 60_000_000 ? 30 :
        carValue >= 40_000_000 ? 10 : 0;
      const carPremium = carScore * SCORE_UNIT;

      // 건강보험료 합산 (최저보험료 적용)
      const healthPremium = Math.max(MIN_HEALTH_PREMIUM, incomePremium + propertyPremium + carPremium);
      // 장기요양보험료: 건강보험료의 12.95%
      const ltciPremium = healthPremium * 0.1295;
      const estimatedMonthlyPremium = Math.round(healthPremium + ltciPremium);

      // 피부양자 가능 여부 판단 (2022년 9월 이후 기준)
      const totalAnnualIncome = pensionIncome + laborIncome + businessIncome + interestDividendIncome + otherIncome;
      const incomeCondition = totalAnnualIncome <= 20_000_000 && (businessIncome === 0 || totalAnnualIncome <= 5_000_000);
      const propertyCondition = propertyValue <= 540_000_000 && (propertyValue <= 360_000_000 || totalAnnualIncome <= 10_000_000);
      const canBeDependent = incomeCondition && propertyCondition;

      const dependentNotice = canBeDependent
        ? "피부양자 조건 충족 — 직장가입자 가족에 등록 시 보험료 없음."
        : "피부양자 조건 미충족 — 지역가입자로 보험료 납부 대상.";
      const notice = `소득인정액 월 ${Math.round(recognizedMonthlyIncome / 10000)}만원 기준 지역가입자 예상 보험료입니다. ${dependentNotice}`;

      const inputData = { pensionIncome, laborIncome, businessIncome, interestDividendIncome, otherIncome, propertyValue, carValue };
      const outputData = {
        recognizedAnnualIncome: Math.round(recognizedAnnualIncome),
        recognizedMonthlyIncome: Math.round(recognizedMonthlyIncome),
        incomePremium: Math.round(incomePremium),
        propertyPremium: Math.round(propertyPremium),
        carPremium: Math.round(carPremium),
        canBeDependent,
        estimatedMonthlyPremium,
        notice,
      };

      const result = await simulationService.createHealthInsurance(userId, inputData, outputData);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/simulations/health-insurance/latest
  router.get("/health-insurance/latest", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      const latest = await simulationService.getLatestHealthInsurance(userId);

      res.status(200).json({
        success: true,
        data: latest,
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/simulations/isa
  router.post("/isa", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      // 요청 검증
      const validation = isaSimulationSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.issues.map((issue) => issue.message).join(", ");
        throw new BusinessException("INVALID_REQUEST", message || "요청 데이터가 유효하지 않습니다", 400);
      }

      const { annualContribution, expectedReturnRate, investmentYears } = validation.data;

      // ISA 복리 수익 계산
      const monthlyRate = expectedReturnRate / 100 / 12;
      const months = investmentYears * 12;
      const monthlyContribution = annualContribution / 12;
      const totalBalance = monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
      const totalContribution = annualContribution * investmentYears;
      const expectedProfit = Math.max(0, Math.round(totalBalance - totalContribution));

      // ISA 절세 효과: 일반형 200만원 비과세, 초과분 9.9% 분리과세 (일반 15.4% 대비)
      const taxFreeLimit = 2000000;
      const estimatedTaxSaving = Math.round(
        Math.min(expectedProfit, taxFreeLimit) * 0.154 +
        Math.max(0, expectedProfit - taxFreeLimit) * (0.154 - 0.099)
      );
      const notice = `투자원금 ${((totalContribution) / 10000).toFixed(0)}만원, 일반형 ISA 기준 (비과세 한도 200만원). 수익률은 과거 성과를 보장하지 않습니다.`;

      const inputData = { annualContribution, expectedReturnRate, investmentYears };
      const outputData = { expectedProfit, estimatedTaxSaving, notice };

      const result = await simulationService.createIsa(userId, inputData, outputData);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/simulations/isa/latest
  router.get("/isa/latest", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      const latest = await simulationService.getLatestIsa(userId);

      res.status(200).json({
        success: true,
        data: latest,
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/simulations/national-pension
  router.post("/national-pension", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      // 요청 검증
      const validation = nationalPensionSimulationSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.issues.map((issue) => issue.message).join(", ");
        throw new BusinessException("INVALID_REQUEST", message || "요청 데이터가 유효하지 않습니다", 400);
      }

      const { monthlyIncome, contributionYears, birthYear } = validation.data;

      // 2025년 기준 A값 (전체 가입자 평균 소득월액)
      const A_VALUE = 2989237;
      const B = monthlyIncome;
      const contributionMonths = contributionYears * 12;
      const baseMonths = Math.min(contributionMonths, 480);
      const excessMonths = Math.max(0, contributionMonths - 240);

      // 국민연금 기본연금액 공식
      const estimatedMonthlyPension = Math.round(
        1.2 * ((A_VALUE + B) / 2) * (baseMonths / 480) * (1 + (0.05 * excessMonths) / 12)
      );

      // 노령연금 수급 개시 연령 (국민연금법 제61조 기준)
      const pensionStartAge =
        birthYear >= 1969 ? 65
        : birthYear >= 1965 ? 64
        : birthYear >= 1961 ? 63
        : birthYear >= 1957 ? 62
        : birthYear >= 1953 ? 61
        : 60;

      const notice = `${contributionYears}년 가입 기준 예상 월 수령액입니다. 실제 수령액은 국민연금공단 조회를 통해 확인하세요.`;

      const inputData = { monthlyIncome, contributionYears, birthYear };
      const outputData = { estimatedMonthlyPension, pensionStartAge, notice };

      const result = await simulationService.createNationalPension(userId, inputData, outputData);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/simulations/national-pension/latest
  router.get("/national-pension/latest", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      const latest = await simulationService.getLatestNationalPension(userId);

      res.status(200).json({
        success: true,
        data: latest,
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/simulations/irp
  router.post("/irp", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      // 요청 검증
      const validation = irpSimulationSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.issues.map((issue) => issue.message).join(", ");
        throw new BusinessException("INVALID_REQUEST", message || "요청 데이터가 유효하지 않습니다", 400);
      }

      const { annualContribution, expectedReturnRate, investmentYears, annualIncome } = validation.data;

      // 월복리 계산: 기대적립금
      const monthlyRate = expectedReturnRate / 100 / 12;
      const months = investmentYears * 12;
      const monthlyContribution = annualContribution / 12;
      const expectedBalance = Math.round(
        monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
      );

      // 세액공제 계산: 연 소득에 따라 세액공제율 결정
      const maxDeductibleContribution = Math.min(annualContribution, 9000000);
      const taxCreditRate = annualIncome <= 55000000 ? 0.165 : 0.132;
      const annualTaxCredit = Math.round(maxDeductibleContribution * taxCreditRate);
      const totalTaxCredit = annualTaxCredit * investmentYears;

      const notice = `연 소득 ${(annualIncome / 10000).toFixed(0)}만원 기준 세액공제율 ${(taxCreditRate * 100).toFixed(1)}% 적용. 투자원금 ${((annualContribution * investmentYears) / 10000).toFixed(0)}만원 대비 예상 적립금입니다.`;

      const inputData = { annualContribution, expectedReturnRate, investmentYears, annualIncome };
      const outputData = { expectedBalance, annualTaxCredit, totalTaxCredit, notice };

      const result = await simulationService.createIrp(userId, inputData, outputData);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/simulations/irp/latest
  router.get("/irp/latest", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      const latest = await simulationService.getLatestIrp(userId);

      res.status(200).json({
        success: true,
        data: latest,
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/simulations/severance-pay
  router.post("/severance-pay", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      // 요청 검증
      const validation = severancePaySimulationSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.issues.map((issue) => issue.message).join(", ");
        throw new BusinessException("INVALID_REQUEST", message || "요청 데이터가 유효하지 않습니다", 400);
      }

      const { averageMonthlyWage, yearsOfService } = validation.data;

      // 법정 퇴직금: 평균월임금 × 근속연수
      const severancePay = Math.round(averageMonthlyWage * yearsOfService);

      // 근속연수공제 계산
      const yrs = Math.floor(yearsOfService);
      let serviceDeduction: number;
      if (yrs <= 5) serviceDeduction = 300000 * yrs;
      else if (yrs <= 10) serviceDeduction = 1500000 + 500000 * (yrs - 5);
      else if (yrs <= 20) serviceDeduction = 4000000 + 800000 * (yrs - 10);
      else serviceDeduction = 12000000 + 1200000 * (yrs - 20);

      // 과세표준 및 환산급여 계산
      const taxableBase = Math.max(0, severancePay - serviceDeduction);
      const annualizedIncome = (taxableBase / yearsOfService) * 12;
      const deductedIncome = annualizedIncome * 0.6;

      // 종합소득세율 적용 (구간별)
      let taxRate: number;
      if (deductedIncome <= 14000000) taxRate = 0.06;
      else if (deductedIncome <= 50000000) taxRate = 0.15;
      else if (deductedIncome <= 88000000) taxRate = 0.24;
      else taxRate = 0.35;

      const incomeTax = Math.round(((deductedIncome * taxRate) / 12) * yearsOfService);
      const afterTaxAmount = severancePay - incomeTax;

      const notice = `근속 ${yearsOfService}년 기준 법정 퇴직금 예상액입니다. 실제 세금은 세무사 상담을 권장합니다.`;

      const inputData = { averageMonthlyWage, yearsOfService };
      const outputData = { severancePay, incomeTax, afterTaxAmount, notice };

      const result = await simulationService.createSeverancePay(userId, inputData, outputData);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/simulations/severance-pay/latest
  router.get("/severance-pay/latest", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);
      }

      const latest = await simulationService.getLatestSeverancePay(userId);

      res.status(200).json({
        success: true,
        data: latest,
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/simulations/unemployment-benefit
  router.post("/unemployment-benefit", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (!userId) throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);

      const validation = unemploymentBenefitSimulationSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.issues.map((i) => i.message).join(", ");
        throw new BusinessException("INVALID_REQUEST", message || "요청 데이터가 유효하지 않습니다", 400);
      }

      const { averageMonthlyWage, insuranceYears, age } = validation.data;

      // 소정급여일수 산정 (2024년 기준, 50세 이상/미만 이원화)
      const getBenefitDays = (age: number, years: number): number => {
        if (age >= 50) {
          if (years < 1) return 120;
          if (years < 3) return 180;
          if (years < 5) return 210;
          if (years < 10) return 240;
          return 270;
        } else {
          if (years < 1) return 120;
          if (years < 3) return 150;
          if (years < 5) return 180;
          if (years < 10) return 210;
          return 240;
        }
      };

      const benefitDays = getBenefitDays(age, insuranceYears);

      // 1일 구직급여액: 직전 평균임금 × 60%, 상한 66,000원 / 하한 63,104원 (2024년)
      const dailyWage = averageMonthlyWage / 30;
      const MAX_DAILY = 66_000;
      const MIN_DAILY = 63_104; // 최저임금 9,860원 × 80% × 8시간
      const dailyBenefit = Math.round(Math.min(MAX_DAILY, Math.max(MIN_DAILY, dailyWage * 0.6)));

      const totalBenefit = dailyBenefit * benefitDays;
      const monthlyBenefit = Math.round(dailyBenefit * 30);
      const months = Math.round(benefitDays / 30);

      const notice = `고용보험 ${insuranceYears}년 가입, ${age}세 기준 ${benefitDays}일(약 ${months}개월) 수급 가능합니다. 실제 수급일수는 고용센터 확인 바랍니다.`;

      const inputData = { averageMonthlyWage, insuranceYears, age };
      const outputData = { benefitDays, dailyBenefit, monthlyBenefit, totalBenefit, notice };

      const result = await simulationService.createUnemploymentBenefit(userId, inputData, outputData);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/simulations/unemployment-benefit/latest
  router.get("/unemployment-benefit/latest", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (!userId) throw new BusinessException("UNAUTHORIZED", "인증이 필요합니다", 401);

      const latest = await simulationService.getLatestUnemploymentBenefit(userId);
      res.status(200).json({ success: true, data: latest });
    } catch (error) {
      next(error);
    }
  });

  return { router };
};

export type SimulationControllerType = ReturnType<typeof createSimulationController>;
