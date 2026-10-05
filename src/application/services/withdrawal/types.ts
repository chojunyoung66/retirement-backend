export type ScenarioType = "A" | "B" | "C" | "D";
export const SCENARIO_TYPES: readonly ScenarioType[] = ["A", "B", "C", "D"];

export type AccountKind =
  | "DC"
  | "PENSION_SAVINGS"
  | "IRP"
  | "ISA"
  | "BROKERAGE"
  | "CASH";

export type IrpSourceKind = "PERSONAL" | "SEVERANCE" | "MIXED" | "UNKNOWN";

export interface EngineAccount {
  id: number;
  accountType: AccountKind;
  label: string;
  balance: number;
  principalTaxCredited: number;
  principalNonDeductible: number;
  investmentGain: number;
  deferredRetirementIncome: number;
  irpSource: IrpSourceKind | null;
  pensionSavingsLegacy: boolean | null;
  isaMaturityYm: string | null;
}

export type ValueSource = "request" | "simulation" | "default" | "none";

export interface EngineInput {
  /** 계산 시작월 YYYY-MM */
  startYm: string;
  birthYear: number;
  householdType: string;
  /** 시작 시점 월 지출(생활비 + 건강보험료 + 민영보험료) */
  monthlyExpense: number;
  /** monthlyExpense에 포함된 현재 건강보험료 — 피부양자 추정 결과로 대체한다 */
  healthInsuranceInExpense?: number;
  nationalPension: {
    monthlyAmount: number;
    startAge: number;
    source: ValueSource;
  };
  spouseBirthYear?: number | null;
  spouseNationalPension?: {
    monthlyAmount: number;
    startAge: number;
    source: ValueSource;
  } | null;
  unemployment: {
    startYm: string;
    months: number;
    monthlyAmount: number;
    source: ValueSource;
  } | null;
  yearsOfService: { value: number; source: ValueSource };
  /** 피부양자 재산 요건 판단용, 미입력이면 null */
  propertyValue: number | null;
  accounts: EngineAccount[];
  assumptions?: Partial<EngineAssumptions>;
}

export interface EngineAssumptions {
  inflationRate: number;
  pensionGrowthRate: number;
  returnRate: number;
  /** 현금·주식계좌의 과세 금융소득(이자·배당) 수익률 가정 */
  financialYieldRate: number;
  endAge: number;
}

export type ActionType = "LUMP_SUM" | "ANNUITY" | "AS_NEEDED" | "HOLD" | "INCOME";

export type DependentStatus = "LIKELY" | "CAUTION" | "CHECK_NEEDED";

export type DependentReason =
  | "PROPERTY_UNKNOWN"
  | "INCOME_OVER"
  | "INCOME_NEAR"
  | "BUSINESS_INCOME_OVER"
  | "FINANCIAL_INCOME_OVER"
  | "FINANCIAL_INCOME_NEAR"
  | "PROPERTY_MID"
  | "PROPERTY_OVER"
  | "SPOUSE_INCOME_OVER"
  | "SPOUSE_INCOME_NEAR";

export interface PlanItem {
  accountId: number | null;
  accountType: AccountKind | "UNEMPLOYMENT";
  label: string;
  priority: number;
  actionType: ActionType;
  startYm: string | null;
  endYm: string | null;
  /** 실행 기간 평균 월액(일시금은 1회 금액) */
  monthlyGross: number;
  monthlyNet: number;
  totalGross: number;
  totalTax: number;
  method: string;
  taxNote: string;
  healthInsuranceNote: string;
  cautions: string[];
}

export interface YearRow {
  year: number;
  age: number;
  /** 건강보험료 포함 연 지출 */
  expense: number;
  nationalPension: number;
  spouseNationalPension: number;
  unemployment: number;
  /** 연 건강보험료(피부양자 추정 가능 연도는 0) */
  healthPremium: number;
  grossWithdrawal: number;
  tax: number;
  netWithdrawal: number;
  shortfall: number;
  endingBalance: number;
  financialIncome: number;
  dependentStatus: DependentStatus;
  dependentReasons: DependentReason[];
}

export interface MonthlySeries {
  ym: string[];
  gross: number[];
  tax: number[];
  net: number[];
  shortfall: number[];
  balance: number[];
}

export interface ScenarioSummary {
  grossWithdrawal: number;
  totalTax: number;
  netWithdrawal: number;
  depletionAge: number | null;
  shortfallMonths: number;
  firstShortfallYm: string | null;
  dependentLikelyYears: number;
  endingBalance: number;
}

export interface ScenarioResult {
  type: ScenarioType;
  title: string;
  goal: string;
  recommended: boolean;
  priorityOrder: string[];
  summary: ScenarioSummary;
  planItems: PlanItem[];
  yearly: YearRow[];
  monthly: MonthlySeries;
  notes: string[];
}

export interface AccountCheck {
  accountId: number;
  accountType: AccountKind;
  label: string;
  /** 연금저축·IRP만 판정, 그 외는 NOT_APPLICABLE */
  nonDeductibleStatus: "CONFIRMED" | "CHECK_NEEDED" | "NOT_APPLICABLE";
  unknownAmount: number;
}

export interface IsaStrategy {
  accountId: number;
  label: string;
  balance: number;
  maturityYm: string | null;
  /** 만기 후 연금계좌 전환 시 추가 세액공제 대상 납입액: min(전환액×10%, 300만원) */
  extraCreditBase: number;
  /** 추가 공제 효과가 없는 3천만원 초과분 */
  excessOverCap: number;
  /** 총급여 5,500만원 초과 공제율(13.2%) 기준 최대 세액공제 추정 */
  maxTaxCreditEstimate: number;
  /** 만기가 계산 시작월(퇴직) 이후라 결정세액이 없으면 효과가 제한되는지 */
  effectLimitedAfterRetirement: boolean;
  notes: string[];
}

export interface BasisDate {
  domain: string;
  effectiveDate: string;
  source: string;
}

export interface ScenarioSetResult {
  ruleVersion: string;
  basisDates: BasisDate[];
  startYm: string;
  endYm: string;
  assumptions: EngineAssumptions;
  recommendedType: ScenarioType;
  recommendationNote: string;
  inputSummary: {
    accountsCount: number;
    totalBalance: number;
    nationalPensionSource: ValueSource;
    unemploymentSource: ValueSource;
    yearsOfServiceSource: ValueSource;
    spouseNationalPensionSource: ValueSource;
    propertyProvided: boolean;
  };
  accountChecks: AccountCheck[];
  isaStrategy: IsaStrategy[];
  scenarios: ScenarioResult[];
  disclaimers: string[];
}
