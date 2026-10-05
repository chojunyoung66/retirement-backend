import { withRuleBasis } from "./rule-basis.js";
import { HEALTH_INSURANCE_RULES, RULE_SET_VERSION } from "./rule-set.js";

describe("withRuleBasis", () => {
  it("계산 결과를 유지한 채 기준일과 제도버전을 붙인다", () => {
    const output = withRuleBasis(
      { domain: "건강보험", meta: HEALTH_INSURANCE_RULES.meta },
      { estimatedMonthlyPremium: 100 },
    );
    expect(output).toEqual({
      estimatedMonthlyPremium: 100,
      basisDate: { domain: "건강보험", ...HEALTH_INSURANCE_RULES.meta },
      ruleVersion: RULE_SET_VERSION,
    });
  });
});
