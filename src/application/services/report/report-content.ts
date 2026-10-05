import type {
  AccountCheck,
  ActionType,
  BasisDate,
  EngineAssumptions,
  PlanItem,
  ScenarioResult,
  ScenarioSetResult,
  ScenarioSummary,
  ScenarioType,
} from "../withdrawal/types.js";

export const REPORT_TITLE = "은퇴현금 실행계획 리포트";
export const MAX_NEXT_ACTIONS = 3;

export const ACTION_LABEL: Record<ActionType, string> = {
  LUMP_SUM: "일시금",
  ANNUITY: "연금수령",
  AS_NEEDED: "필요할 때 인출",
  HOLD: "보유",
  INCOME: "수입",
};

export interface ReportNextAction {
  label: string;
  actionType: ActionType;
  startYm: string | null;
  method: string;
  monthlyNet: number;
}

export interface ReportComparisonRow {
  type: ScenarioType;
  title: string;
  recommended: boolean;
  summary: ScenarioSummary;
}

/** 생성 시점에 고정하는 리포트 본문 — 이름·이메일 같은 식별정보는 넣지 않는다 */
export interface ReportContent {
  title: string;
  generatedAt: string;
  ruleVersion: string;
  basisDates: BasisDate[];
  startYm: string;
  endYm: string;
  assumptions: EngineAssumptions;
  recommendedType: ScenarioType;
  recommendationNote: string;
  inputSummary: ScenarioSetResult["inputSummary"];
  nextActions: ReportNextAction[];
  comparison: ReportComparisonRow[];
  scenario: Omit<ScenarioResult, "monthly">;
  accountChecks: AccountCheck[];
  disclaimers: string[];
}

/** 시작월이 빠른 실행 항목부터, 같은 달이면 우선순위 순으로 최대 3개 */
export const pickNextActions = (
  planItems: PlanItem[],
  fallbackYm: string,
  limit = MAX_NEXT_ACTIONS,
): ReportNextAction[] =>
  planItems
    .filter((item) => item.actionType !== "HOLD")
    .map((item) => ({ item, ym: item.startYm ?? fallbackYm }))
    .sort((a, b) => a.ym.localeCompare(b.ym) || a.item.priority - b.item.priority)
    .slice(0, limit)
    .map(({ item }) => ({
      label: item.label,
      actionType: item.actionType,
      startYm: item.startYm,
      method: item.method,
      monthlyNet: item.monthlyNet,
    }));

const withoutMonthly = ({ monthly: _monthly, ...rest }: ScenarioResult) => rest;

export const buildReportContent = (
  result: ScenarioSetResult,
  type: ScenarioType,
  generatedAt: Date,
): ReportContent | null => {
  const selected = result.scenarios.find((s) => s.type === type);
  if (!selected) return null;
  const scenario = withoutMonthly(selected);
  return {
    title: REPORT_TITLE,
    generatedAt: generatedAt.toISOString(),
    ruleVersion: result.ruleVersion,
    basisDates: result.basisDates,
    startYm: result.startYm,
    endYm: result.endYm,
    assumptions: result.assumptions,
    recommendedType: result.recommendedType,
    recommendationNote: result.recommendationNote,
    inputSummary: result.inputSummary,
    nextActions: pickNextActions(scenario.planItems, result.startYm),
    comparison: result.scenarios.map((s) => ({
      type: s.type,
      title: s.title,
      recommended: s.recommended,
      summary: s.summary,
    })),
    scenario,
    accountChecks: result.accountChecks,
    disclaimers: result.disclaimers,
  };
};
