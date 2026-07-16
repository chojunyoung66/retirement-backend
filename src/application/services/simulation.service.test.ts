import type { ISimulationRepo } from "../contracts/simulation-repo.contract.js";
import { createSimulationService } from "./simulation.service.js";

describe("SimulationService", () => {
  let simulationService: ReturnType<typeof createSimulationService>;
  let mockSimulationRepo: Partial<ISimulationRepo>;

  beforeEach(() => {
    // 의존성 Mock 설정
    mockSimulationRepo = {
      findLatestByUserId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    simulationService = createSimulationService(
      mockSimulationRepo as ISimulationRepo,
    );
  });

  describe("createHealthInsurance", () => {
    it("해피패스: 건강보험 시뮬레이션을 저장", async () => {
      // given
      const userId = 1;
      const inputData = {
        pensionIncome: 24000000,
        laborIncome: 0,
        businessIncome: 0,
        interestDividendIncome: 5000000,
        otherIncome: 0,
        propertyValue: 300000000,
        carValue: 20000000,
      };
      const outputData = {
        recognizedAnnualIncome: 12000000,
        recognizedMonthlyIncome: 1000000,
        incomePremium: 70900,
        propertyPremium: 125040,
        carPremium: 0,
        canBeDependent: true,
        estimatedMonthlyPremium: 222921,
        notice:
          "소득인정액 월 100만원 기준 지역가입자 예상 보험료입니다. 피부양자 조건 충족.",
      };

      (mockSimulationRepo.create as jest.Mock).mockResolvedValueOnce({
        id: 1,
        userId,
        type: "HEALTH_INSURANCE",
        version: 1,
        status: "draft",
        inputData,
        outputData,
      });

      // when
      const result = await simulationService.createHealthInsurance(
        userId,
        inputData,
        outputData,
      );

      // then
      expect(mockSimulationRepo.create).toHaveBeenCalledWith(
        userId,
        "HEALTH_INSURANCE",
        inputData,
        outputData,
      );
      expect(result).toEqual({
        id: 1,
        userId,
        type: "HEALTH_INSURANCE",
        version: 1,
        status: "draft",
        inputData,
        outputData,
      });
    });
  });

  describe("getLatestHealthInsurance", () => {
    it("해피패스: 최신 건강보험 시뮬레이션을 조회", async () => {
      // given
      const userId = 1;
      const expectedResult = {
        id: 1,
        userId,
        type: "HEALTH_INSURANCE" as const,
        version: 1,
        status: "draft",
        inputData: {
          pensionIncome: 24000000,
          laborIncome: 0,
          businessIncome: 0,
          interestDividendIncome: 5000000,
          otherIncome: 0,
          propertyValue: 300000000,
          carValue: 20000000,
        },
        outputData: {
          recognizedMonthlyIncome: 1000000,
          canBeDependent: true,
          estimatedMonthlyPremium: 222921,
          notice: "소득인정액 월 100만원 기준 지역가입자 예상 보험료입니다.",
        },
        createdAt: new Date("2026-07-14"),
      };

      (
        mockSimulationRepo.findLatestByUserId as jest.Mock
      ).mockResolvedValueOnce(expectedResult);

      // when
      const result = await simulationService.getLatestHealthInsurance(userId);

      // then
      expect(mockSimulationRepo.findLatestByUserId).toHaveBeenCalledWith(
        userId,
        "HEALTH_INSURANCE",
      );
      expect(result).toEqual(expectedResult);
    });

    it("건강보험 시뮬레이션이 없을 때 HEALTH_INSURANCE_SIMULATION_NOT_FOUND 예외 발생", async () => {
      // given
      const userId = 1;

      (
        mockSimulationRepo.findLatestByUserId as jest.Mock
      ).mockResolvedValueOnce(null);

      // when & then
      await expect(
        simulationService.getLatestHealthInsurance(userId),
      ).rejects.toMatchObject({
        code: "HEALTH_INSURANCE_SIMULATION_NOT_FOUND",
        statusCode: 404,
      });

      expect(mockSimulationRepo.findLatestByUserId).toHaveBeenCalledWith(
        userId,
        "HEALTH_INSURANCE",
      );
    });
  });

  describe("createIsa", () => {
    it("해피패스: ISA 시뮬레이션을 저장", async () => {
      // given
      const userId = 1;
      const inputData = {
        annualContribution: 10000000,
        expectedReturnRate: 5.5,
        investmentYears: 10,
      };
      const outputData = {
        expectedProfit: 6052000000,
        estimatedTaxSaving: 1210400,
        notice: "ISA 한도 내",
      };

      (mockSimulationRepo.create as jest.Mock).mockResolvedValueOnce({
        id: 2,
        userId,
        type: "ISA",
        version: 1,
        status: "draft",
        inputData,
        outputData,
      });

      // when
      const result = await simulationService.createIsa(
        userId,
        inputData,
        outputData,
      );

      // then
      expect(mockSimulationRepo.create).toHaveBeenCalledWith(
        userId,
        "ISA",
        inputData,
        outputData,
      );
      expect(result).toEqual({
        id: 2,
        userId,
        type: "ISA",
        version: 1,
        status: "draft",
        inputData,
        outputData,
      });
    });
  });

  describe("getLatestIsa", () => {
    it("해피패스: 최신 ISA 시뮬레이션을 조회", async () => {
      // given
      const userId = 1;
      const expectedResult = {
        id: 2,
        userId,
        type: "ISA" as const,
        version: 1,
        status: "draft",
        inputData: {
          annualContribution: 10000000,
          expectedReturnRate: 5.5,
          investmentYears: 10,
        },
        outputData: {
          expectedProfit: 6052000000,
          estimatedTaxSaving: 1210400,
          notice: "ISA 한도 내",
        },
        createdAt: new Date("2026-07-13"),
      };

      (
        mockSimulationRepo.findLatestByUserId as jest.Mock
      ).mockResolvedValueOnce(expectedResult);

      // when
      const result = await simulationService.getLatestIsa(userId);

      // then
      expect(mockSimulationRepo.findLatestByUserId).toHaveBeenCalledWith(
        userId,
        "ISA",
      );
      expect(result).toEqual(expectedResult);
    });

    it("ISA 시뮬레이션이 없을 때 ISA_SIMULATION_NOT_FOUND 예외 발생", async () => {
      // given
      const userId = 1;

      (
        mockSimulationRepo.findLatestByUserId as jest.Mock
      ).mockResolvedValueOnce(null);

      // when & then
      await expect(
        simulationService.getLatestIsa(userId),
      ).rejects.toMatchObject({
        code: "ISA_SIMULATION_NOT_FOUND",
        statusCode: 404,
      });

      expect(mockSimulationRepo.findLatestByUserId).toHaveBeenCalledWith(
        userId,
        "ISA",
      );
    });
  });

  describe("createNationalPension", () => {
    it("해피패스: 국민연금 시뮬레이션을 저장", async () => {
      // given
      const userId = 1;
      const inputData = {
        monthlyIncome: 4000000,
        contributionYears: 25,
        birthYear: 1970,
      };
      const outputData = {
        estimatedMonthlyPension: 3276205,
        pensionStartAge: 65,
        notice: "25년 가입 기준 예상 월 수령액입니다.",
      };

      (mockSimulationRepo.create as jest.Mock).mockResolvedValueOnce({
        id: 3,
        userId,
        type: "NATIONAL_PENSION",
        version: 1,
        status: "draft",
        inputData,
        outputData,
      });

      // when
      const result = await simulationService.createNationalPension(
        userId,
        inputData,
        outputData,
      );

      // then
      expect(mockSimulationRepo.create).toHaveBeenCalledWith(
        userId,
        "NATIONAL_PENSION",
        inputData,
        outputData,
      );
      expect(result).toEqual({
        id: 3,
        userId,
        type: "NATIONAL_PENSION",
        version: 1,
        status: "draft",
        inputData,
        outputData,
      });
    });
  });

  describe("getLatestNationalPension", () => {
    it("해피패스: 최신 국민연금 시뮬레이션을 조회", async () => {
      // given
      const userId = 1;
      const expectedResult = {
        id: 3,
        userId,
        type: "NATIONAL_PENSION" as const,
        version: 1,
        status: "draft",
        inputData: {
          monthlyIncome: 4000000,
          contributionYears: 25,
          birthYear: 1970,
        },
        outputData: {
          estimatedMonthlyPension: 3276205,
          pensionStartAge: 65,
          notice: "25년 가입 기준",
        },
        createdAt: new Date("2026-07-14"),
      };

      (
        mockSimulationRepo.findLatestByUserId as jest.Mock
      ).mockResolvedValueOnce(expectedResult);

      // when
      const result = await simulationService.getLatestNationalPension(userId);

      // then
      expect(mockSimulationRepo.findLatestByUserId).toHaveBeenCalledWith(
        userId,
        "NATIONAL_PENSION",
      );
      expect(result).toEqual(expectedResult);
    });

    it("국민연금 시뮬레이션이 없을 때 NATIONAL_PENSION_SIMULATION_NOT_FOUND 예외 발생", async () => {
      // given
      const userId = 1;

      (
        mockSimulationRepo.findLatestByUserId as jest.Mock
      ).mockResolvedValueOnce(null);

      // when & then
      await expect(
        simulationService.getLatestNationalPension(userId),
      ).rejects.toMatchObject({
        code: "NATIONAL_PENSION_SIMULATION_NOT_FOUND",
        statusCode: 404,
      });

      expect(mockSimulationRepo.findLatestByUserId).toHaveBeenCalledWith(
        userId,
        "NATIONAL_PENSION",
      );
    });
  });

  describe("createIrp", () => {
    it("해피패스: IRP 시뮬레이션을 저장", async () => {
      // given
      const userId = 1;
      const inputData = {
        annualContribution: 7000000,
        expectedReturnRate: 5,
        investmentYears: 20,
        annualIncome: 60000000,
      };
      const outputData = {
        expectedBalance: 239769640,
        annualTaxCredit: 924000,
        totalTaxCredit: 18480000,
        notice: "연 소득 6000만원 기준 세액공제율 13.2% 적용.",
      };

      (mockSimulationRepo.create as jest.Mock).mockResolvedValueOnce({
        id: 4,
        userId,
        type: "IRP",
        version: 1,
        status: "draft",
        inputData,
        outputData,
      });

      // when
      const result = await simulationService.createIrp(
        userId,
        inputData,
        outputData,
      );

      // then
      expect(mockSimulationRepo.create).toHaveBeenCalledWith(
        userId,
        "IRP",
        inputData,
        outputData,
      );
      expect(result).toEqual({
        id: 4,
        userId,
        type: "IRP",
        version: 1,
        status: "draft",
        inputData,
        outputData,
      });
    });
  });

  describe("getLatestIrp", () => {
    it("해피패스: 최신 IRP 시뮬레이션을 조회", async () => {
      // given
      const userId = 1;
      const expectedResult = {
        id: 4,
        userId,
        type: "IRP" as const,
        version: 1,
        status: "draft",
        inputData: {
          annualContribution: 7000000,
          expectedReturnRate: 5,
          investmentYears: 20,
          annualIncome: 60000000,
        },
        outputData: {
          expectedBalance: 239769640,
          annualTaxCredit: 924000,
          totalTaxCredit: 18480000,
          notice: "...",
        },
        createdAt: new Date("2026-07-14"),
      };

      (
        mockSimulationRepo.findLatestByUserId as jest.Mock
      ).mockResolvedValueOnce(expectedResult);

      // when
      const result = await simulationService.getLatestIrp(userId);

      // then
      expect(mockSimulationRepo.findLatestByUserId).toHaveBeenCalledWith(
        userId,
        "IRP",
      );
      expect(result).toEqual(expectedResult);
    });

    it("IRP 시뮬레이션이 없을 때 IRP_SIMULATION_NOT_FOUND 예외 발생", async () => {
      // given
      const userId = 1;

      (
        mockSimulationRepo.findLatestByUserId as jest.Mock
      ).mockResolvedValueOnce(null);

      // when & then
      await expect(
        simulationService.getLatestIrp(userId),
      ).rejects.toMatchObject({
        code: "IRP_SIMULATION_NOT_FOUND",
        statusCode: 404,
      });

      expect(mockSimulationRepo.findLatestByUserId).toHaveBeenCalledWith(
        userId,
        "IRP",
      );
    });
  });

  describe("createSeverancePay", () => {
    it("해피패스: 퇴직금 시뮬레이션을 저장", async () => {
      // given
      const userId = 1;
      const inputData = {
        averageMonthlyWage: 4500000,
        yearsOfService: 20,
      };
      const outputData = {
        severancePay: 90000000,
        incomeTax: 7020000,
        afterTaxAmount: 82980000,
        notice: "근속 20년 기준 법정 퇴직금 예상액입니다.",
      };

      (mockSimulationRepo.create as jest.Mock).mockResolvedValueOnce({
        id: 5,
        userId,
        type: "SEVERANCE_PAY",
        version: 1,
        status: "draft",
        inputData,
        outputData,
      });

      // when
      const result = await simulationService.createSeverancePay(
        userId,
        inputData,
        outputData,
      );

      // then
      expect(mockSimulationRepo.create).toHaveBeenCalledWith(
        userId,
        "SEVERANCE_PAY",
        inputData,
        outputData,
      );
      expect(result).toEqual({
        id: 5,
        userId,
        type: "SEVERANCE_PAY",
        version: 1,
        status: "draft",
        inputData,
        outputData,
      });
    });
  });

  describe("getLatestSeverancePay", () => {
    it("해피패스: 최신 퇴직금 시뮬레이션을 조회", async () => {
      // given
      const userId = 1;
      const expectedResult = {
        id: 5,
        userId,
        type: "SEVERANCE_PAY" as const,
        version: 1,
        status: "draft",
        inputData: { averageMonthlyWage: 4500000, yearsOfService: 20 },
        outputData: {
          severancePay: 90000000,
          incomeTax: 7020000,
          afterTaxAmount: 82980000,
          notice: "...",
        },
        createdAt: new Date("2026-07-14"),
      };

      (
        mockSimulationRepo.findLatestByUserId as jest.Mock
      ).mockResolvedValueOnce(expectedResult);

      // when
      const result = await simulationService.getLatestSeverancePay(userId);

      // then
      expect(mockSimulationRepo.findLatestByUserId).toHaveBeenCalledWith(
        userId,
        "SEVERANCE_PAY",
      );
      expect(result).toEqual(expectedResult);
    });

    it("퇴직금 시뮬레이션이 없을 때 SEVERANCE_PAY_SIMULATION_NOT_FOUND 예외 발생", async () => {
      // given
      const userId = 1;

      (
        mockSimulationRepo.findLatestByUserId as jest.Mock
      ).mockResolvedValueOnce(null);

      // when & then
      await expect(
        simulationService.getLatestSeverancePay(userId),
      ).rejects.toMatchObject({
        code: "SEVERANCE_PAY_SIMULATION_NOT_FOUND",
        statusCode: 404,
      });

      expect(mockSimulationRepo.findLatestByUserId).toHaveBeenCalledWith(
        userId,
        "SEVERANCE_PAY",
      );
    });
  });

  describe("createUnemploymentBenefit", () => {
    it("해피패스: 실업급여 시뮬레이션을 저장", async () => {
      // given
      const userId = 1;
      const inputData = {
        averageMonthlyWage: 4000000,
        insuranceYears: 15,
        age: 60,
      };
      const outputData = {
        benefitDays: 270,
        dailyBenefit: 66000,
        totalBenefit: 17820000,
        monthlyBenefit: 1980000,
        notice:
          "고용보험 15년 가입, 60세 기준 270일(약 9개월) 수급 가능합니다.",
      };

      (mockSimulationRepo.create as jest.Mock).mockResolvedValueOnce({
        id: 6,
        userId,
        type: "UNEMPLOYMENT_BENEFIT",
        version: 1,
        status: "draft",
        inputData,
        outputData,
      });

      // when
      const result = await simulationService.createUnemploymentBenefit(
        userId,
        inputData,
        outputData,
      );

      // then
      expect(mockSimulationRepo.create).toHaveBeenCalledWith(
        userId,
        "UNEMPLOYMENT_BENEFIT",
        inputData,
        outputData,
      );
      expect(result).toEqual({
        id: 6,
        userId,
        type: "UNEMPLOYMENT_BENEFIT",
        version: 1,
        status: "draft",
        inputData,
        outputData,
      });
    });
  });

  describe("updateSimulation", () => {
    it("존재하지 않는 시뮬레이션 ID로 수정 시 SIMULATION_NOT_FOUND 예외 발생", async () => {
      // given
      const id = 999;

      (mockSimulationRepo.findById as jest.Mock).mockResolvedValueOnce(null);

      // when & then
      await expect(
        simulationService.updateSimulation(id, { status: "confirmed" }),
      ).rejects.toMatchObject({
        code: "SIMULATION_NOT_FOUND",
        statusCode: 404,
      });

      expect(mockSimulationRepo.findById).toHaveBeenCalledWith(id);
      expect(mockSimulationRepo.update).not.toHaveBeenCalled();
    });

    it("허용되지 않는 status 값으로 수정 시 INVALID_STATUS 예외 발생", async () => {
      // given
      const id = 1;
      const existing = {
        id,
        userId: 1,
        type: "ISA" as const,
        version: 1,
        status: "draft",
        inputData: {},
        outputData: {},
        createdAt: new Date(),
      };

      (mockSimulationRepo.findById as jest.Mock).mockResolvedValueOnce(
        existing,
      );

      // when & then
      await expect(
        simulationService.updateSimulation(id, { status: "잘못된값" }),
      ).rejects.toMatchObject({
        code: "INVALID_STATUS",
        statusCode: 400,
      });

      expect(mockSimulationRepo.update).not.toHaveBeenCalled();
    });

    it("해피패스: 시뮬레이션 status를 수정", async () => {
      // given
      const id = 1;
      const data = { status: "confirmed" };
      const existing = {
        id,
        userId: 1,
        type: "ISA" as const,
        version: 1,
        status: "draft",
        inputData: {
          annualContribution: 10000000,
          expectedReturnRate: 5,
          investmentYears: 10,
        },
        outputData: {
          expectedProfit: 29401900,
          estimatedTaxSaving: 1815104,
          notice: "...",
        },
        createdAt: new Date(),
      };
      const updatedResult = { ...existing, status: "confirmed" };

      (mockSimulationRepo.findById as jest.Mock).mockResolvedValueOnce(
        existing,
      );
      (mockSimulationRepo.update as jest.Mock).mockResolvedValueOnce(
        updatedResult,
      );

      // when
      const result = await simulationService.updateSimulation(id, data);

      // then
      expect(mockSimulationRepo.update).toHaveBeenCalledWith(id, data);
      expect(result).toEqual(updatedResult);
    });
  });

  describe("getLatestUnemploymentBenefit", () => {
    it("해피패스: 최신 실업급여 시뮬레이션을 조회", async () => {
      // given
      const userId = 1;
      const expectedResult = {
        id: 6,
        userId,
        type: "UNEMPLOYMENT_BENEFIT" as const,
        version: 1,
        status: "draft",
        inputData: { averageMonthlyWage: 4000000, insuranceYears: 15, age: 60 },
        outputData: {
          benefitDays: 270,
          dailyBenefit: 66000,
          totalBenefit: 17820000,
          notice: "...",
        },
        createdAt: new Date("2026-07-14"),
      };

      (
        mockSimulationRepo.findLatestByUserId as jest.Mock
      ).mockResolvedValueOnce(expectedResult);

      // when
      const result =
        await simulationService.getLatestUnemploymentBenefit(userId);

      // then
      expect(mockSimulationRepo.findLatestByUserId).toHaveBeenCalledWith(
        userId,
        "UNEMPLOYMENT_BENEFIT",
      );
      expect(result).toEqual(expectedResult);
    });

    it("실업급여 시뮬레이션이 없을 때 UNEMPLOYMENT_BENEFIT_SIMULATION_NOT_FOUND 예외 발생", async () => {
      // given
      const userId = 1;

      (
        mockSimulationRepo.findLatestByUserId as jest.Mock
      ).mockResolvedValueOnce(null);

      // when & then
      await expect(
        simulationService.getLatestUnemploymentBenefit(userId),
      ).rejects.toMatchObject({
        code: "UNEMPLOYMENT_BENEFIT_SIMULATION_NOT_FOUND",
        statusCode: 404,
      });

      expect(mockSimulationRepo.findLatestByUserId).toHaveBeenCalledWith(
        userId,
        "UNEMPLOYMENT_BENEFIT",
      );
    });
  });

  describe("getSimulationById", () => {
    it("해피패스: ID로 시뮬레이션을 조회", async () => {
      // given
      const id = 1;
      const userId = 1;
      const expectedResult = {
        id,
        userId,
        type: "ISA" as const,
        version: 1,
        status: "draft",
        inputData: { annualContribution: 10000000 },
        outputData: { expectedProfit: 29401900 },
        createdAt: new Date("2026-07-14"),
      };

      (mockSimulationRepo.findById as jest.Mock).mockResolvedValueOnce(
        expectedResult,
      );

      // when
      const result = await simulationService.getSimulationById(id, userId);

      // then
      expect(mockSimulationRepo.findById).toHaveBeenCalledWith(id);
      expect(result).toEqual(expectedResult);
    });

    it("다른 유저의 시뮬레이션 조회 시 FORBIDDEN 예외 발생", async () => {
      // given
      const id = 1;
      const requestingUserId = 2;
      const existing = {
        id,
        userId: 1,
        type: "ISA" as const,
        version: 1,
        status: "draft",
        inputData: {},
        outputData: {},
        createdAt: new Date(),
      };

      (mockSimulationRepo.findById as jest.Mock).mockResolvedValueOnce(
        existing,
      );

      // when & then
      await expect(
        simulationService.getSimulationById(id, requestingUserId),
      ).rejects.toMatchObject({
        code: "SIMULATION_FORBIDDEN",
        statusCode: 403,
      });
    });
  });

  describe("deleteSimulation", () => {
    it("해피패스: 시뮬레이션을 삭제", async () => {
      // given
      const id = 1;
      const userId = 1;
      const existing = {
        id,
        userId,
        type: "ISA" as const,
        version: 1,
        status: "draft",
        inputData: {},
        outputData: {},
        createdAt: new Date(),
      };

      (mockSimulationRepo.findById as jest.Mock).mockResolvedValueOnce(
        existing,
      );
      (mockSimulationRepo.delete as jest.Mock).mockResolvedValueOnce(undefined);

      // when
      await simulationService.deleteSimulation(id, userId);

      // then
      expect(mockSimulationRepo.findById).toHaveBeenCalledWith(id);
      expect(mockSimulationRepo.delete).toHaveBeenCalledWith(id);
    });

    it("다른 유저의 시뮬레이션 삭제 시도 시 FORBIDDEN 예외 발생", async () => {
      // given
      const id = 1;
      const requestingUserId = 2;
      const existing = {
        id,
        userId: 1,
        type: "ISA" as const,
        version: 1,
        status: "draft",
        inputData: {},
        outputData: {},
        createdAt: new Date(),
      };

      (mockSimulationRepo.findById as jest.Mock).mockResolvedValueOnce(
        existing,
      );

      // when & then
      await expect(
        simulationService.deleteSimulation(id, requestingUserId),
      ).rejects.toMatchObject({
        code: "SIMULATION_FORBIDDEN",
        statusCode: 403,
      });

      expect(mockSimulationRepo.delete).not.toHaveBeenCalled();
    });
  });
});
