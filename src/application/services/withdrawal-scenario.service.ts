import type {
  AccountAssetRecord,
  IAccountAssetRepo,
} from "../contracts/account-asset-repo.contract.js";
import type { IDiagnosisRepo } from "../contracts/diagnosis-repo.contract.js";
import type { ISimulationRepo } from "../contracts/simulation-repo.contract.js";
import type {
  IWithdrawalScenarioRepo,
  WithdrawalScenarioSetRecord,
} from "../contracts/withdrawal-scenario-repo.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import { getPensionStartAge } from "./calculators/national-pension.calculator.js";
import { generateScenarioSet } from "./withdrawal/engine.js";
import { ACCOUNT_LABEL } from "./withdrawal/strategies.js";
import { currentYm, ymToIndex } from "./withdrawal/timeline.js";
import type {
  EngineAccount,
  EngineAssumptions,
  EngineInput,
  ScenarioResult,
  ScenarioSetResult,
  ScenarioType,
} from "./withdrawal/types.js";

export const MAX_SCENARIO_SETS = 5;
export const DEFAULT_YEARS_OF_SERVICE = 20;

export interface GenerateScenarioRequest {
  nationalPension?: { monthlyAmount: number; startAge: number };
  /** 배우자 국민연금 — 서버는 연금 금액을 저장하지 않으므로 요청으로만 받는다 */
  spouseNationalPension?: { monthlyAmount: number; startAge: number } | null;
  /** null이면 실업급여 없음, 생략하면 최근 실업급여 시뮬레이션 사용 */
  unemployment?: { monthlyAmount: number; months: number } | null;
  /** 실업급여 시작월(YYYY-MM), 생략하면 계산 시작월 */
  unemploymentStartYm?: string;
  yearsOfService?: number;
  propertyValue?: number | null;
  assumptions?: Partial<Omit<EngineAssumptions, "endAge">>;
}

/** 비교 화면용: 월별 배열은 실행안 조회에서만 내려준다 */
export interface ScenarioSetView {
  id: number;
  ruleVersion: string;
  selectedType: ScenarioType | null;
  createdAt: Date;
  result: Omit<ScenarioSetResult, "scenarios"> & {
    scenarios: Omit<ScenarioResult, "monthly">[];
  };
}

export interface ScenarioPlanView {
  setId: number;
  ruleVersion: string;
  selectedType: ScenarioType | null;
  createdAt: Date;
  basisDates: ScenarioSetResult["basisDates"];
  startYm: string;
  endYm: string;
  recommendedType: ScenarioType;
  accountChecks: ScenarioSetResult["accountChecks"];
  disclaimers: string[];
  scenario: ScenarioResult;
}

const numberOf = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const toEngineAccount = (asset: AccountAssetRecord): EngineAccount => ({
  id: asset.id,
  accountType: asset.accountType,
  label: asset.accountName?.trim() || ACCOUNT_LABEL[asset.accountType],
  balance: asset.balance,
  principalTaxCredited: asset.principalTaxCredited,
  principalNonDeductible: asset.principalNonDeductible,
  investmentGain: asset.investmentGain,
  deferredRetirementIncome: asset.deferredRetirementIncome,
  irpSource: asset.irpSource,
  pensionSavingsLegacy: asset.pensionSavingsLegacy,
  isaMaturityYm: asset.isaMaturityYm,
});

const toView = (record: WithdrawalScenarioSetRecord): ScenarioSetView => ({
  id: record.id,
  ruleVersion: record.ruleVersion,
  selectedType: record.selectedType,
  createdAt: record.createdAt,
  result: {
    ...record.result,
    scenarios: record.result.scenarios.map(({ monthly: _monthly, ...rest }) => rest),
  },
});

export const createWithdrawalScenarioService = (
  deps: {
    accountAssetRepo: IAccountAssetRepo;
    diagnosisRepo: IDiagnosisRepo;
    simulationRepo: ISimulationRepo;
    scenarioRepo: IWithdrawalScenarioRepo;
  },
  now: () => Date = () => new Date(),
) => {
  const { accountAssetRepo, diagnosisRepo, simulationRepo, scenarioRepo } = deps;

  const assertOwned = (
    record: WithdrawalScenarioSetRecord | null,
    userId: number,
  ): WithdrawalScenarioSetRecord => {
    if (!record) {
      throw new BusinessException(
        "SCENARIO_SET_NOT_FOUND",
        "인출 시나리오를 찾을 수 없습니다",
        404,
      );
    }
    if (record.userId !== userId) {
      throw new BusinessException("SCENARIO_SET_FORBIDDEN", "접근 권한이 없습니다", 403);
    }
    return record;
  };

  const resolveNationalPension = async (
    userId: number,
    birthYear: number,
    request: GenerateScenarioRequest["nationalPension"],
  ): Promise<EngineInput["nationalPension"]> => {
    if (request) return { ...request, source: "request" };
    const latest = await simulationRepo.findLatestByUserId(userId, "NATIONAL_PENSION");
    const monthlyAmount = numberOf(latest?.outputData.estimatedMonthlyPension);
    const startAge = numberOf(latest?.outputData.pensionStartAge);
    if (monthlyAmount !== null && startAge !== null) {
      return { monthlyAmount, startAge, source: "simulation" };
    }
    return { monthlyAmount: 0, startAge: getPensionStartAge(birthYear), source: "none" };
  };

  const resolveUnemployment = async (
    userId: number,
    startYm: string,
    request: GenerateScenarioRequest["unemployment"],
  ): Promise<EngineInput["unemployment"]> => {
    if (request === null) return null;
    if (request) {
      return request.months > 0 && request.monthlyAmount > 0
        ? { startYm, ...request, source: "request" }
        : null;
    }
    const latest = await simulationRepo.findLatestByUserId(userId, "UNEMPLOYMENT_BENEFIT");
    const monthlyAmount = numberOf(latest?.outputData.monthlyBenefit);
    const benefitDays = numberOf(latest?.outputData.benefitDays);
    if (monthlyAmount === null || benefitDays === null || benefitDays <= 0) return null;
    return {
      startYm,
      months: Math.max(1, Math.round(benefitDays / 30)),
      monthlyAmount,
      source: "simulation",
    };
  };

  const resolveYearsOfService = async (
    userId: number,
    request: number | undefined,
  ): Promise<EngineInput["yearsOfService"]> => {
    if (request !== undefined) return { value: request, source: "request" };
    const latest = await simulationRepo.findLatestByUserId(userId, "SEVERANCE_PAY");
    const value = numberOf(latest?.inputData.yearsOfService);
    if (value !== null && value > 0) return { value, source: "simulation" };
    return { value: DEFAULT_YEARS_OF_SERVICE, source: "default" };
  };

  return {
    async generate(userId: number, request: GenerateScenarioRequest): Promise<ScenarioSetView> {
      const diagnosis = await diagnosisRepo.findByUserId(userId);
      if (!diagnosis) {
        throw new BusinessException(
          "DIAGNOSIS_REQUIRED",
          "노후 진단을 먼저 완료해주세요",
          400,
        );
      }
      const assets = await accountAssetRepo.findByUserId(userId);
      if (assets.length === 0) {
        throw new BusinessException(
          "ACCOUNT_ASSETS_REQUIRED",
          "계좌 자산을 1개 이상 입력해주세요",
          400,
        );
      }

      const today = now();
      // 퇴직월(미입력 시 1월)이 아직 오지 않았으면 그달부터, 지났으면 이번 달부터 계산
      const retirementYm = `${diagnosis.retirementYear}-${String(diagnosis.retirementMonth ?? 1).padStart(2, "0")}`;
      const thisYm = currentYm(today);
      const startYm = ymToIndex(retirementYm) > ymToIndex(thisYm) ? retirementYm : thisYm;
      // 실업급여는 계산 시작월 이후에만 받을 수 있다
      const unemploymentStartYm =
        request.unemploymentStartYm && ymToIndex(request.unemploymentStartYm) > ymToIndex(startYm)
          ? request.unemploymentStartYm
          : startYm;
      const spouse = request.spouseNationalPension;

      const input: EngineInput = {
        startYm,
        birthYear: diagnosis.birthYear,
        householdType: diagnosis.householdType,
        monthlyExpense:
          diagnosis.monthlyExpense + diagnosis.healthInsurance + diagnosis.privateInsurance,
        healthInsuranceInExpense: diagnosis.healthInsurance,
        nationalPension: await resolveNationalPension(
          userId,
          diagnosis.birthYear,
          request.nationalPension,
        ),
        spouseBirthYear: diagnosis.spouseBirthYear,
        spouseNationalPension:
          spouse && spouse.monthlyAmount > 0 ? { ...spouse, source: "request" } : null,
        unemployment: await resolveUnemployment(userId, unemploymentStartYm, request.unemployment),
        yearsOfService: await resolveYearsOfService(userId, request.yearsOfService),
        propertyValue: request.propertyValue ?? null,
        accounts: assets.map(toEngineAccount),
        ...(request.assumptions && { assumptions: request.assumptions }),
      };

      const result = generateScenarioSet(input);
      const saved = await scenarioRepo.create(userId, {
        ruleVersion: result.ruleVersion,
        input,
        result,
      });
      await scenarioRepo.pruneByUserId(userId, MAX_SCENARIO_SETS);
      return toView(saved);
    },

    async getLatest(userId: number): Promise<ScenarioSetView | null> {
      const latest = await scenarioRepo.findLatestByUserId(userId);
      return latest ? toView(latest) : null;
    },

    async getPlan(id: number, userId: number, type: ScenarioType): Promise<ScenarioPlanView> {
      const record = assertOwned(await scenarioRepo.findById(id), userId);
      const scenario = record.result.scenarios.find((s) => s.type === type);
      if (!scenario) {
        throw new BusinessException(
          "SCENARIO_NOT_FOUND",
          "해당 시나리오를 찾을 수 없습니다",
          404,
        );
      }
      const { result } = record;
      return {
        setId: record.id,
        ruleVersion: record.ruleVersion,
        selectedType: record.selectedType,
        createdAt: record.createdAt,
        basisDates: result.basisDates,
        startYm: result.startYm,
        endYm: result.endYm,
        recommendedType: result.recommendedType,
        accountChecks: result.accountChecks,
        disclaimers: result.disclaimers,
        scenario,
      };
    },

    async select(
      id: number,
      userId: number,
      selectedType: ScenarioType,
    ): Promise<{ id: number; selectedType: ScenarioType }> {
      assertOwned(await scenarioRepo.findById(id), userId);
      const updated = await scenarioRepo.updateSelection(id, selectedType);
      return { id: updated.id, selectedType };
    },

    // 원자료 삭제: 세트 input에 남은 계좌 잔액까지 지운다
    async deleteAll(userId: number): Promise<number> {
      return scenarioRepo.deleteByUserId(userId);
    },
  };
};

export type WithdrawalScenarioServiceType = ReturnType<typeof createWithdrawalScenarioService>;
