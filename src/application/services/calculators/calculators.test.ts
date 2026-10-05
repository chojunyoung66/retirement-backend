import { RULE_SET_VERSION } from "../../rules/rule-set.js";
import {
  calculateNationalPension,
  getPensionStartAge,
} from "./national-pension.calculator.js";
import { calculateSeverancePay } from "./severance-pay.calculator.js";
import { calculateHealthInsurance } from "./health-insurance.calculator.js";
import {
  calculateUnemploymentBenefit,
  getBenefitDays,
} from "./unemployment-benefit.calculator.js";
import { calculateIrp, calculateIsa } from "./savings-account.calculator.js";

const A_VALUE_2026 = 3_193_511;

describe("calculateNationalPension", () => {
  it("A값 소득으로 40년 가입하면 소득대체율 43% 월액을 반환한다", () => {
    const result = calculateNationalPension({
      monthlyIncome: A_VALUE_2026,
      contributionYears: 40,
      birthYear: 1970,
    });
    expect(result.eligible).toBe(true);
    expect(result.estimatedMonthlyPension).toBe(1_373_210);
    expect(result.ruleVersion).toBe(RULE_SET_VERSION);
  });

  it("A값 소득으로 10년 가입하면 40년 대비 1/4 월액을 반환한다", () => {
    const result = calculateNationalPension({
      monthlyIncome: A_VALUE_2026,
      contributionYears: 10,
      birthYear: 1970,
    });
    expect(result.estimatedMonthlyPension).toBe(343_302);
  });

  it("월 400만원·25년 가입은 약 97만원으로 산정한다", () => {
    const result = calculateNationalPension({
      monthlyIncome: 4_000_000,
      contributionYears: 25,
      birthYear: 1966,
    });
    expect(result.estimatedMonthlyPension).toBe(966_628);
    expect(result.pensionStartAge).toBe(64);
  });

  it("기준소득월액 상한을 넘는 소득은 상한으로 제한한다", () => {
    const capped = calculateNationalPension({
      monthlyIncome: 10_000_000,
      contributionYears: 30,
      birthYear: 1970,
    });
    const atCap = calculateNationalPension({
      monthlyIncome: 6_590_000,
      contributionYears: 30,
      birthYear: 1970,
    });
    expect(capped.appliedIncome).toBe(6_590_000);
    expect(capped.estimatedMonthlyPension).toBe(atCap.estimatedMonthlyPension);
  });

  it("가입기간 10년 미만이면 수급 불가로 안내한다", () => {
    const result = calculateNationalPension({
      monthlyIncome: 3_000_000,
      contributionYears: 9,
      birthYear: 1970,
    });
    expect(result.eligible).toBe(false);
    expect(result.estimatedMonthlyPension).toBe(0);
    expect(result.notice).toContain("반환일시금");
  });

  it("출생연도별 수급개시연령을 반환한다", () => {
    expect(getPensionStartAge(1952)).toBe(60);
    expect(getPensionStartAge(1960)).toBe(62);
    expect(getPensionStartAge(1964)).toBe(63);
    expect(getPensionStartAge(1969)).toBe(65);
  });
});

describe("calculateSeverancePay", () => {
  it("월 450만원·20년 근속의 퇴직소득세를 현행 산식으로 계산한다", () => {
    const result = calculateSeverancePay({
      averageMonthlyWage: 4_500_000,
      yearsOfService: 20,
    });
    expect(result.severancePay).toBe(90_000_000);
    expect(result.serviceDeduction).toBe(40_000_000);
    expect(result.convertedPay).toBe(30_000_000);
    expect(result.convertedPayDeduction).toBe(21_200_000);
    expect(result.taxBase).toBe(8_800_000);
    expect(result.incomeTax).toBe(880_000);
    expect(result.localIncomeTax).toBe(88_000);
    expect(result.afterTaxAmount).toBe(89_032_000);
  });

  it("1년 미만 끝수는 근속연수를 올림해 공제한다", () => {
    const result = calculateSeverancePay({
      averageMonthlyWage: 3_000_000,
      yearsOfService: 4.5,
    });
    expect(result.severancePay).toBe(13_500_000);
    expect(result.taxYears).toBe(5);
    expect(result.serviceDeduction).toBe(5_000_000);
    expect(result.incomeTax).toBe(124_000);
    expect(result.localIncomeTax).toBe(12_400);
  });

  it("공제액이 퇴직금보다 크면 세금은 0이다", () => {
    const result = calculateSeverancePay({
      averageMonthlyWage: 1_000_000,
      yearsOfService: 1,
    });
    expect(result.totalTax).toBe(0);
    expect(result.afterTaxAmount).toBe(1_000_000);
  });
});

describe("calculateHealthInsurance", () => {
  const zero = {
    pensionIncome: 0,
    laborIncome: 0,
    businessIncome: 0,
    interestDividendIncome: 0,
    otherIncome: 0,
    propertyValue: 0,
    carValue: 0,
  };

  it("연금 2,400만원·재산 3억 세대의 2026년 보험료를 계산한다", () => {
    const result = calculateHealthInsurance({
      ...zero,
      pensionIncome: 24_000_000,
      propertyValue: 300_000_000,
    });
    expect(result.recognizedMonthlyIncome).toBe(1_000_000);
    expect(result.incomePremium).toBe(71_900);
    expect(result.propertyPremium).toBe(204_732);
    expect(result.estimatedMonthlyPremium).toBe(312_981);
    expect(result.canBeDependent).toBe(false);
    expect(result.dependentStatus).toBe("UNLIKELY");
  });

  it("소득·재산이 없으면 최저보험료와 장기요양보험료만 부과한다", () => {
    const result = calculateHealthInsurance(zero);
    expect(result.incomePremium).toBe(20_160);
    expect(result.estimatedMonthlyPremium).toBe(22_809);
    expect(result.canBeDependent).toBe(true);
  });

  it("금융소득 1천만원 이하는 제외하고, 재산 5.4억~9억은 연소득 1천만원 이하일 때만 피부양자 가능", () => {
    const result = calculateHealthInsurance({
      ...zero,
      pensionIncome: 8_000_000,
      interestDividendIncome: 5_000_000,
      propertyValue: 600_000_000,
    });
    expect(result.recognizedAnnualIncome).toBe(4_000_000);
    expect(result.propertyPremium).toBe(516_483);
    expect(result.estimatedMonthlyPremium).toBe(611_465);
    expect(result.canBeDependent).toBe(true);
  });

  it("금융소득이 1천만원을 넘으면 전액을 소득에 반영한다", () => {
    const result = calculateHealthInsurance({
      ...zero,
      interestDividendIncome: 12_000_000,
    });
    expect(result.recognizedAnnualIncome).toBe(12_000_000);
    expect(result.estimatedMonthlyPremium).toBe(81_348);
  });

  it("재산 9억 초과면 피부양자 불가로 추정한다", () => {
    const result = calculateHealthInsurance({
      ...zero,
      propertyValue: 950_000_000,
    });
    expect(result.canBeDependent).toBe(false);
  });
});

describe("calculateUnemploymentBenefit", () => {
  it("고임금자는 2026년 상한 68,100원을 적용한다", () => {
    const result = calculateUnemploymentBenefit({
      averageMonthlyWage: 6_000_000,
      insuranceYears: 12,
      age: 58,
    });
    expect(result.dailyBenefit).toBe(68_100);
    expect(result.benefitDays).toBe(270);
    expect(result.monthlyBenefit).toBe(2_043_000);
    expect(result.totalBenefit).toBe(18_387_000);
  });

  it("저임금자는 2026년 하한 66,048원을 적용한다", () => {
    const result = calculateUnemploymentBenefit({
      averageMonthlyWage: 2_000_000,
      insuranceYears: 2,
      age: 45,
    });
    expect(result.dailyBenefit).toBe(66_048);
    expect(result.totalBenefit).toBe(66_048 * 150);
  });

  it("상·하한 사이 임금은 평균임금의 60%를 지급한다", () => {
    const result = calculateUnemploymentBenefit({
      averageMonthlyWage: 3_400_000,
      insuranceYears: 0.5,
      age: 50,
    });
    expect(result.dailyBenefit).toBe(68_000);
    expect(result.benefitDays).toBe(120);
  });

  it("연령·가입기간별 소정급여일수를 반환한다", () => {
    expect(getBenefitDays(50, 3)).toBe(210);
    expect(getBenefitDays(49, 10)).toBe(240);
  });
});

describe("calculateIsa / calculateIrp", () => {
  it("ISA 예상수익과 절세액을 일반형 기준으로 계산한다", () => {
    const result = calculateIsa({
      annualContribution: 12_000_000,
      expectedReturnRate: 5,
      investmentYears: 5,
    });
    expect(result.totalContribution).toBe(60_000_000);
    expect(result.expectedProfit).toBeGreaterThan(7_990_000);
    expect(result.expectedProfit).toBeLessThan(8_020_000);
    expect(result.estimatedTaxSaving).toBe(
      Math.round(
        2_000_000 * 0.154 + (result.expectedProfit - 2_000_000) * 0.055,
      ),
    );
  });

  it("IRP 세액공제는 900만원 한도와 소득구간별 공제율을 적용한다", () => {
    const low = calculateIrp({
      annualContribution: 9_000_000,
      expectedReturnRate: 4,
      investmentYears: 10,
      annualIncome: 50_000_000,
    });
    const high = calculateIrp({
      annualContribution: 12_000_000,
      expectedReturnRate: 4,
      investmentYears: 10,
      annualIncome: 80_000_000,
    });
    expect(low.annualTaxCredit).toBe(1_485_000);
    expect(high.annualTaxCredit).toBe(1_188_000);
    expect(high.totalTaxCredit).toBe(11_880_000);
  });

  it("안내 문구의 만원 금액은 천 단위 구분자로 표시한다", () => {
    const isa = calculateIsa({
      annualContribution: 12_000_000,
      expectedReturnRate: 5,
      investmentYears: 5,
    });
    const irp = calculateIrp({
      annualContribution: 12_000_000,
      expectedReturnRate: 4,
      investmentYears: 10,
      annualIncome: 80_000_000,
    });
    expect(isa.notice).toContain("투자원금 6,000만원");
    expect(irp.notice).toContain("연 소득 8,000만원");
    expect(irp.notice).toContain("투자원금 12,000만원");
  });
});
