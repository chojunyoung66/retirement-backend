import {
  createWithdrawalScenarioService,
  DEFAULT_YEARS_OF_SERVICE,
  MAX_SCENARIO_SETS,
} from "./withdrawal-scenario.service.js";
import type {
  AccountAssetRecord,
  IAccountAssetRepo,
} from "../contracts/account-asset-repo.contract.js";
import type { DiagnosisRecord, IDiagnosisRepo } from "../contracts/diagnosis-repo.contract.js";
import type { ISimulationRepo, SimulationType } from "../contracts/simulation-repo.contract.js";
import type {
  IWithdrawalScenarioRepo,
  WithdrawalScenarioSetRecord,
} from "../contracts/withdrawal-scenario-repo.contract.js";
import type { EngineInput } from "./withdrawal/types.js";

const diagnosis: DiagnosisRecord = {
  id: 1,
  userId: 1,
  householdType: "individual",
  householdSize: 1,
  birthYear: 1968,
  retirementYear: 2027,
  retirementMonth: null,
  spouseBirthYear: null,
  spouseRetirementYear: null,
  nationalPension: 0,
  retirementPension: 0,
  personalPension: 0,
  housingPension: 0,
  monthlyExpense: 2_500_000,
  healthInsurance: 200_000,
  privateInsurance: 100_000,
  updatedAt: new Date(),
};

const asset = (overrides: Partial<AccountAssetRecord>): AccountAssetRecord => ({
  id: 1,
  userId: 1,
  accountType: "CASH",
  accountName: null,
  institution: null,
  balance: 50_000_000,
  principalTaxCredited: 0,
  principalNonDeductible: 0,
  investmentGain: 0,
  deferredRetirementIncome: 0,
  irpSource: null,
  pensionSavingsLegacy: null,
  isaMaturityYm: null,
  verifiedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const setup = (simulations: Partial<Record<SimulationType, Record<string, unknown>>> = {}) => {
  const accountAssetRepo = {
    findByUserId: jest.fn().mockResolvedValue([
      asset({ id: 1, accountType: "DC", balance: 200_000_000 }),
      asset({ id: 2, accountType: "CASH", balance: 30_000_000, accountName: "비상금" }),
    ]),
  } as unknown as { [K in keyof IAccountAssetRepo]: jest.Mock };
  const diagnosisRepo = {
    findByUserId: jest.fn().mockResolvedValue(diagnosis),
  } as unknown as { [K in keyof IDiagnosisRepo]: jest.Mock };
  const simulationRepo = {
    findLatestByUserId: jest.fn(async (_userId: number, type: SimulationType) => {
      const data = simulations[type];
      return data
        ? { id: 1, userId: 1, type, version: 1, status: "draft", createdAt: new Date(), ...data }
        : null;
    }),
  } as unknown as { [K in keyof ISimulationRepo]: jest.Mock };
  let saved: WithdrawalScenarioSetRecord | null = null;
  const scenarioRepo = {
    create: jest.fn(async (userId: number, data: Omit<WithdrawalScenarioSetRecord, "id" | "userId" | "selectedType" | "createdAt">) => {
      saved = { id: 10, userId, selectedType: null, createdAt: new Date(), ...data };
      return saved;
    }),
    findLatestByUserId: jest.fn(),
    findById: jest.fn(async () => saved),
    updateSelection: jest.fn(async (_id: number, selectedType: string) => ({ ...saved!, selectedType })),
    pruneByUserId: jest.fn(),
    deleteByUserId: jest.fn(async () => 3),
  } as unknown as { [K in keyof IWithdrawalScenarioRepo]: jest.Mock };

  const service = createWithdrawalScenarioService(
    {
      accountAssetRepo: accountAssetRepo as unknown as IAccountAssetRepo,
      diagnosisRepo: diagnosisRepo as unknown as IDiagnosisRepo,
      simulationRepo: simulationRepo as unknown as ISimulationRepo,
      scenarioRepo: scenarioRepo as unknown as IWithdrawalScenarioRepo,
    },
    () => new Date("2026-10-05T00:00:00+09:00"),
  );
  const savedInput = (): EngineInput => scenarioRepo.create.mock.calls[0][1].input;
  return { service, accountAssetRepo, diagnosisRepo, scenarioRepo, savedInput };
};

describe("WithdrawalScenarioService.generate", () => {
  it("진단이 없으면 DIAGNOSIS_REQUIRED", async () => {
    const { service, diagnosisRepo } = setup();
    diagnosisRepo.findByUserId.mockResolvedValueOnce(null);
    await expect(service.generate(1, {})).rejects.toMatchObject({
      code: "DIAGNOSIS_REQUIRED",
      statusCode: 400,
    });
  });

  it("계좌가 없으면 ACCOUNT_ASSETS_REQUIRED", async () => {
    const { service, accountAssetRepo } = setup();
    accountAssetRepo.findByUserId.mockResolvedValueOnce([]);
    await expect(service.generate(1, {})).rejects.toMatchObject({
      code: "ACCOUNT_ASSETS_REQUIRED",
      statusCode: 400,
    });
  });

  it("요청 본문의 가정값을 우선 사용한다", async () => {
    const { service, savedInput, scenarioRepo } = setup({
      NATIONAL_PENSION: { outputData: { estimatedMonthlyPension: 900_000, pensionStartAge: 64 } },
    });
    const view = await service.generate(1, {
      nationalPension: { monthlyAmount: 1_000_000, startAge: 65 },
      unemployment: { monthlyAmount: 1_800_000, months: 6 },
      yearsOfService: 22,
      propertyValue: 200_000_000,
    });
    const input = savedInput();
    expect(input.startYm).toBe("2027-01");
    expect(input.monthlyExpense).toBe(2_800_000);
    expect(input.nationalPension).toEqual({ monthlyAmount: 1_000_000, startAge: 65, source: "request" });
    expect(input.unemployment).toEqual({
      startYm: "2027-01",
      monthlyAmount: 1_800_000,
      months: 6,
      source: "request",
    });
    expect(input.yearsOfService).toEqual({ value: 22, source: "request" });
    expect(input.propertyValue).toBe(200_000_000);
    expect(input.accounts.map((a) => a.label)).toEqual(["퇴직연금 DC", "비상금"]);
    expect(scenarioRepo.pruneByUserId).toHaveBeenCalledWith(1, MAX_SCENARIO_SETS);
    expect(view.result.scenarios).toHaveLength(4);
    expect(view.result.scenarios[0]).not.toHaveProperty("monthly");
  });

  it("본문이 없으면 최근 시뮬레이션, 그마저 없으면 기본값을 쓴다", async () => {
    const { service, savedInput } = setup({
      NATIONAL_PENSION: { outputData: { estimatedMonthlyPension: 900_000, pensionStartAge: 64 } },
      UNEMPLOYMENT_BENEFIT: { outputData: { monthlyBenefit: 1_900_000, benefitDays: 240 } },
    });
    await service.generate(1, {});
    const input = savedInput();
    expect(input.nationalPension).toEqual({ monthlyAmount: 900_000, startAge: 64, source: "simulation" });
    expect(input.unemployment).toMatchObject({ months: 8, monthlyAmount: 1_900_000, source: "simulation" });
    expect(input.yearsOfService).toEqual({ value: DEFAULT_YEARS_OF_SERVICE, source: "default" });
    expect(input.propertyValue).toBeNull();
  });

  it("실업급여를 null로 보내면 시뮬레이션이 있어도 제외한다", async () => {
    const { service, savedInput } = setup({
      UNEMPLOYMENT_BENEFIT: { outputData: { monthlyBenefit: 1_900_000, benefitDays: 240 } },
    });
    await service.generate(1, { unemployment: null });
    expect(savedInput().unemployment).toBeNull();
    expect(savedInput().nationalPension.source).toBe("none");
  });

  it("퇴직 연도가 지났으면 이번 달부터 계산한다", async () => {
    const { service, diagnosisRepo, savedInput } = setup();
    diagnosisRepo.findByUserId.mockResolvedValueOnce({ ...diagnosis, retirementYear: 2025 });
    await service.generate(1, {});
    expect(savedInput().startYm).toBe("2026-10");
  });

  it("퇴직월이 있으면 그달부터 계산하고 진단 건강보험료를 대체 대상으로 넘긴다", async () => {
    const { service, diagnosisRepo, savedInput } = setup();
    diagnosisRepo.findByUserId.mockResolvedValueOnce({ ...diagnosis, retirementMonth: 11 });
    await service.generate(1, {});
    expect(savedInput().startYm).toBe("2027-11");
    expect(savedInput().healthInsuranceInExpense).toBe(200_000);
  });

  it("배우자 국민연금과 실업급여 시작월을 요청에서 받는다", async () => {
    const { service, diagnosisRepo, savedInput } = setup();
    diagnosisRepo.findByUserId.mockResolvedValueOnce({
      ...diagnosis,
      householdType: "couple",
      spouseBirthYear: 1970,
      spouseRetirementYear: 2030,
    });
    await service.generate(1, {
      spouseNationalPension: { monthlyAmount: 700_000, startAge: 65 },
      unemployment: { monthlyAmount: 1_800_000, months: 6 },
      unemploymentStartYm: "2027-03",
    });
    const input = savedInput();
    expect(input.spouseBirthYear).toBe(1970);
    expect(input.spouseNationalPension).toEqual({
      monthlyAmount: 700_000,
      startAge: 65,
      source: "request",
    });
    expect(input.unemployment?.startYm).toBe("2027-03");
  });

  it("실업급여 시작월이 계산 시작월보다 이르면 시작월로 맞춘다", async () => {
    const { service, savedInput } = setup();
    await service.generate(1, {
      unemployment: { monthlyAmount: 1_800_000, months: 6 },
      unemploymentStartYm: "2026-01",
    });
    expect(savedInput().unemployment?.startYm).toBe("2027-01");
  });
});

describe("WithdrawalScenarioService.getPlan·select", () => {
  it("소유한 세트의 시나리오 실행안을 돌려준다", async () => {
    const { service } = setup();
    await service.generate(1, {});
    const plan = await service.getPlan(10, 1, "D");
    expect(plan.scenario.type).toBe("D");
    expect(plan.scenario.monthly.ym.length).toBeGreaterThan(0);
    expect(plan.scenario.monthly.net).toHaveLength(plan.scenario.monthly.ym.length);
    expect(["A", "B", "C", "D"]).toContain(plan.recommendedType);
  });

  it("다른 사용자의 세트는 403", async () => {
    const { service } = setup();
    await service.generate(1, {});
    await expect(service.getPlan(10, 2, "A")).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.select(10, 2, "A")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("없는 세트는 404", async () => {
    const { service, scenarioRepo } = setup();
    scenarioRepo.findById.mockResolvedValueOnce(null);
    await expect(service.getPlan(99, 1, "A")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("선택 유형을 저장한다", async () => {
    const { service, scenarioRepo } = setup();
    await service.generate(1, {});
    await expect(service.select(10, 1, "B")).resolves.toEqual({ id: 10, selectedType: "B" });
    expect(scenarioRepo.updateSelection).toHaveBeenCalledWith(10, "B");
  });

  it("본인 세트를 모두 지우고 삭제 건수를 돌려준다", async () => {
    const { service, scenarioRepo } = setup();
    await expect(service.deleteAll(1)).resolves.toBe(3);
    expect(scenarioRepo.deleteByUserId).toHaveBeenCalledWith(1);
  });
});
