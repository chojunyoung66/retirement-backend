import { RULE_SET_VERSION, type RuleMeta } from "./rule-set.js";

export interface RuleBasis {
  domain: string;
  meta: RuleMeta;
}

/** 계산 결과에 기준일·제도버전을 붙인다 — 저장된 결과를 다시 볼 때도 어떤 규칙으로 계산했는지 보인다 */
export const withRuleBasis = <T extends object>(basis: RuleBasis, output: T) => ({
  ...output,
  basisDate: { domain: basis.domain, ...basis.meta },
  ruleVersion: RULE_SET_VERSION,
});
