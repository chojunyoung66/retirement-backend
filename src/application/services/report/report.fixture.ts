import { generateScenarioSet } from "../withdrawal/engine.js";
import type { EngineAccount, ScenarioSetResult } from "../withdrawal/types.js";

const account = (
  id: number,
  accountType: EngineAccount["accountType"],
  balance: number,
  extra: Partial<EngineAccount> = {},
): EngineAccount => ({
  id,
  accountType,
  label: `계좌${id}`,
  balance,
  principalTaxCredited: 0,
  principalNonDeductible: 0,
  investmentGain: 0,
  deferredRetirementIncome: 0,
  irpSource: null,
  pensionSavingsLegacy: null,
  isaMaturityYm: null,
  ...extra,
});

/** 엔진 골든 페르소나와 같은 입력(IRP 1,000만원 미확인)으로 만든 시나리오 세트 */
export const sampleScenarioSet = (): ScenarioSetResult =>
  generateScenarioSet({
    startYm: "2026-11",
    birthYear: 1968,
    householdType: "individual",
    monthlyExpense: 3_000_000,
    nationalPension: { monthlyAmount: 1_200_000, startAge: 64, source: "request" },
    unemployment: { startYm: "2026-11", months: 9, monthlyAmount: 1_980_000, source: "request" },
    yearsOfService: { value: 25, source: "request" },
    propertyValue: 400_000_000,
    accounts: [
      account(1, "DC", 300_000_000),
      account(2, "PENSION_SAVINGS", 100_000_000, {
        principalTaxCredited: 60_000_000,
        principalNonDeductible: 20_000_000,
        investmentGain: 20_000_000,
      }),
      account(3, "IRP", 50_000_000, {
        principalTaxCredited: 30_000_000,
        investmentGain: 10_000_000,
        irpSource: "PERSONAL",
      }),
      account(4, "ISA", 30_000_000, { investmentGain: 5_000_000, isaMaturityYm: "2027-03" }),
      account(5, "BROKERAGE", 100_000_000),
      account(6, "CASH", 20_000_000),
    ],
  });
