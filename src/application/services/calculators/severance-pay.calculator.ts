import {
  SEVERANCE_TAX_RULES as R,
  RULE_SET_VERSION,
} from "../../rules/rule-set.js";

export interface SeverancePayInput {
  averageMonthlyWage: number;
  yearsOfService: number;
}

export interface SeverancePayOutput {
  severancePay: number;
  taxYears: number;
  serviceDeduction: number;
  convertedPay: number;
  convertedPayDeduction: number;
  taxBase: number;
  incomeTax: number;
  localIncomeTax: number;
  totalTax: number;
  afterTaxAmount: number;
  notice: string;
  ruleVersion: string;
}

const serviceDeductionOf = (years: number): number => {
  // 근속연수 구간별 공제액 산정
  const row = R.serviceDeduction.find((r) => years <= r.upToYears)!;
  return row.base + row.perYear * (years - row.fromYears);
};

const convertedPayDeductionOf = (convertedPay: number): number => {
  // 환산급여 구간별 공제액 산정
  const row = R.convertedPayDeduction.find((r) => convertedPay <= r.upTo)!;
  return row.base + (convertedPay - row.from) * row.rate;
};

const basicTaxOf = (taxBase: number): number => {
  // 기본세율 누진공제 방식 적용
  if (taxBase <= 0) return 0;
  const row = R.basicTaxBrackets.find((r) => taxBase <= r.upTo)!;
  return taxBase * row.rate - row.progressiveDeduction;
};

export const calculateSeverancePay = (
  input: SeverancePayInput,
): SeverancePayOutput => {
  const { averageMonthlyWage, yearsOfService } = input;

  // 법정 퇴직금: 평균월임금 × 근속연수
  const severancePay = Math.round(averageMonthlyWage * yearsOfService);

  // 세법상 근속연수는 1년 미만 끝수를 1년으로 올림
  const taxYears = Math.max(1, Math.ceil(yearsOfService));
  const serviceDeduction = serviceDeductionOf(taxYears);

  // 환산급여 → 환산급여공제 → 과세표준
  const convertedPay =
    (Math.max(0, severancePay - serviceDeduction) * 12) / taxYears;
  const convertedPayDeduction = Math.min(
    convertedPay,
    convertedPayDeductionOf(convertedPay),
  );
  const taxBase = Math.max(0, convertedPay - convertedPayDeduction);

  // 환산산출세액을 근속연수로 되돌려 퇴직소득세 산정
  const incomeTax = Math.round((basicTaxOf(taxBase) * taxYears) / 12);
  const localIncomeTax = Math.round(incomeTax * R.localIncomeTaxRate);
  const totalTax = incomeTax + localIncomeTax;

  return {
    severancePay,
    taxYears,
    serviceDeduction: Math.round(serviceDeduction),
    convertedPay: Math.round(convertedPay),
    convertedPayDeduction: Math.round(convertedPayDeduction),
    taxBase: Math.round(taxBase),
    incomeTax,
    localIncomeTax,
    totalTax,
    afterTaxAmount: severancePay - totalTax,
    notice: `근속 ${yearsOfService}년 기준 법정 퇴직금과 퇴직소득세(지방소득세 포함) 추정치입니다. 실제 세액은 원천징수영수증 또는 세무 전문가를 통해 확인하세요.`,
    ruleVersion: RULE_SET_VERSION,
  };
};
