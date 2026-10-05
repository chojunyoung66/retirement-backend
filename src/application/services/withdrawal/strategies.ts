import type { AccountKind, ScenarioType } from "./types.js";

/** 부족분을 채울 때의 인출 순서. NON_DEDUCTIBLE은 연금저축·IRP의 비공제 원금만 꺼낸다 */
export type DrawStep = AccountKind | "NON_DEDUCTIBLE";

export type AnnuityStart =
  | { type: "start" }
  | { type: "age"; age: number }
  | { type: "nationalPension" };

export interface AnnuityDef {
  kinds: AccountKind[];
  start: AnnuityStart;
  /** 수령 개월 수. untilEnd는 계산 종료월까지 */
  months: number | "untilEnd";
}

export type PlanTextKey = AccountKind | "UNEMPLOYMENT";

export interface PlanText {
  method: string;
  taxNote: string;
}

export interface StrategyDef {
  type: ScenarioType;
  title: string;
  goal: string;
  lumpSumAtStart: AccountKind[];
  annuities: AnnuityDef[];
  drawOrder: DrawStep[];
  priorityOrder: string[];
  /** 실행안 표의 우선순위(작을수록 먼저) */
  itemPriority: PlanTextKey[];
  texts: Record<PlanTextKey, PlanText>;
}

export const HEALTH_NOTES: Record<PlanTextKey, string> = {
  DC: "퇴직연금 수령액은 현행 기준상 피부양자 소득에 포함되지 않습니다(제도 변경 시 재판정).",
  PENSION_SAVINGS:
    "사적연금 수령액은 현행 기준상 피부양자 소득에 포함되지 않습니다(제도 변경 시 재판정).",
  IRP: "사적연금 수령액은 현행 기준상 피부양자 소득에 포함되지 않습니다(제도 변경 시 재판정).",
  ISA: "ISA의 비과세·분리과세 소득은 건강보험 소득에서 제외됩니다.",
  BROKERAGE:
    "이자·배당이 연 1,000만원을 넘으면 전액 소득으로 반영되어 피부양자 판정에 영향을 줍니다.",
  CASH: "예금 이자가 연 1,000만원을 넘으면 전액 소득으로 반영되어 피부양자 판정에 영향을 줍니다.",
  UNEMPLOYMENT:
    "실업급여는 비과세 소득으로 건강보험 소득에 포함되지 않습니다. 임의계속가입 여부는 별도로 확인하세요.",
};

export const ACCOUNT_LABEL: Record<PlanTextKey, string> = {
  DC: "퇴직연금 DC",
  PENSION_SAVINGS: "연금저축",
  IRP: "개인IRP",
  ISA: "ISA",
  BROKERAGE: "주식계좌",
  CASH: "현금성 자산",
  UNEMPLOYMENT: "실업급여",
};

const ISA_TRANSFER_NOTE =
  "만기 후 60일 이내 연금계좌로 전환하면 전환액의 10%(최대 300만원)가 세액공제 대상에 추가됩니다. 3천만원을 넘는 전환분은 추가 공제 효과가 늘지 않으며, 퇴직 후 결정세액이 없으면 효과가 제한됩니다.";

const UNEMPLOYMENT_TEXT: PlanText = {
  method: "수급 기간 동안 생활비 최우선 재원",
  taxNote: "비과세 소득",
};

const BASE_ITEM_PRIORITY: PlanTextKey[] = [
  "UNEMPLOYMENT",
  "CASH",
  "DC",
  "PENSION_SAVINGS",
  "IRP",
  "ISA",
  "BROKERAGE",
];

export const STRATEGIES: Record<ScenarioType, StrategyDef> = {
  A: {
    type: "A",
    title: "A안 · 모두 일시금 인출",
    goal: "퇴직 직후 연금계좌를 모두 현금화했을 때의 비교 기준선",
    lumpSumAtStart: ["DC", "PENSION_SAVINGS", "IRP"],
    annuities: [],
    drawOrder: ["CASH", "ISA", "BROKERAGE"],
    priorityOrder: ["퇴직연금 DC·연금저축·IRP 일시금", "현금성 자산", "ISA", "주식계좌"],
    itemPriority: BASE_ITEM_PRIORITY,
    texts: {
      DC: {
        method: "퇴직 직후 전액 일시금 수령",
        taxNote: "퇴직소득세(지방소득세 포함)를 추정해 세후 현금화합니다.",
      },
      PENSION_SAVINGS: {
        method: "퇴직 직후 전액 해지(연금외수령)",
        taxNote:
          "세액공제 원금·운용수익은 기타소득세 16.5%, 비공제 원금은 과세제외입니다.",
      },
      IRP: {
        method: "퇴직 직후 전액 인출",
        taxNote:
          "개인납입분은 기타소득세 16.5%, 퇴직급여 이전분은 퇴직소득세, 비공제 원금은 과세제외입니다.",
      },
      ISA: {
        method: "필요 시 해지 후 현금화",
        taxNote: `비과세 한도(200만원) 초과 수익은 9.9% 분리과세입니다. ${ISA_TRANSFER_NOTE}`,
      },
      BROKERAGE: {
        method: "필요 시 현금화",
        taxNote: "배당·이자는 금융소득, 해외주식 양도차익은 별도 과세됩니다.",
      },
      CASH: {
        method: "일시금 수령액을 적립해 생활비로 사용",
        taxNote: "원금 인출은 과세되지 않습니다. 이자는 금융소득입니다.",
      },
      UNEMPLOYMENT: UNEMPLOYMENT_TEXT,
    },
  },
  B: {
    type: "B",
    title: "B안 · 10년 연금수령",
    goal: "퇴직연금과 연금계좌를 10년에 나눠 받아 일시금보다 세금을 줄이는 안",
    lumpSumAtStart: [],
    annuities: [
      { kinds: ["DC"], start: { type: "start" }, months: 120 },
      { kinds: ["PENSION_SAVINGS", "IRP"], start: { type: "age", age: 55 }, months: 120 },
    ],
    drawOrder: ["CASH", "ISA", "BROKERAGE", "PENSION_SAVINGS", "IRP", "DC"],
    priorityOrder: ["퇴직연금 DC 10년 수령", "연금저축·IRP 10년 수령", "현금성 자산", "ISA", "주식계좌"],
    itemPriority: BASE_ITEM_PRIORITY,
    texts: {
      DC: {
        method: "퇴직 후 10년 균등 연금수령",
        taxNote: "이연퇴직소득세의 70%(수령 10년 이하)로 일시금보다 세금이 줄어듭니다.",
      },
      PENSION_SAVINGS: {
        method: "55세 이후 10년 균등 수령",
        taxNote:
          "세액공제 원금·운용수익은 연금소득세(70세 미만 5.5%), 연 1,500만원 초과 시 종합과세 또는 16.5% 분리과세입니다.",
      },
      IRP: {
        method: "55세 이후 10년 균등 수령",
        taxNote:
          "세액공제 원금·운용수익은 연금소득세, 퇴직급여 이전분은 이연퇴직소득으로 별도 과세됩니다.",
      },
      ISA: {
        method: "만기 시 생활비로 쓰거나 일부 연금계좌 전환",
        taxNote: ISA_TRANSFER_NOTE,
      },
      BROKERAGE: {
        method: "부족한 달에 원금 회수 중심으로 인출",
        taxNote: "배당·이자·해외주식 양도차익을 관리합니다.",
      },
      CASH: {
        method: "연금수령액이 부족한 달에 먼저 사용",
        taxNote: "원금 인출은 과세되지 않습니다.",
      },
      UNEMPLOYMENT: UNEMPLOYMENT_TEXT,
    },
  },
  C: {
    type: "C",
    title: "C안 · 20년 이상 장기수령",
    goal: "퇴직연금을 20년 넘게 나눠 받고 연금계좌는 70세 이후 저율 구간에서 쓰는 절세 기본축",
    lumpSumAtStart: [],
    annuities: [
      { kinds: ["DC"], start: { type: "start" }, months: "untilEnd" },
      { kinds: ["PENSION_SAVINGS", "IRP"], start: { type: "age", age: 70 }, months: 180 },
    ],
    drawOrder: ["CASH", "BROKERAGE", "ISA", "PENSION_SAVINGS", "IRP", "DC"],
    priorityOrder: ["퇴직연금 DC 장기수령", "현금성 자산", "주식계좌", "ISA", "연금저축·IRP(70세 이후)"],
    itemPriority: BASE_ITEM_PRIORITY,
    texts: {
      DC: {
        method: "IRP 이전 후 20년 이상 장기 연금수령",
        taxNote:
          "이연퇴직소득세의 70%(10년 이하), 60%(11~20년차), 50%(21년차 이후)로 세부담이 줄어듭니다.",
      },
      PENSION_SAVINGS: {
        method: "70세 전 최소, 70세 이후 점진 인출",
        taxNote: "연금소득세 70세 이상 4.4%, 80세 이상 3.3% 저율 구간을 활용합니다.",
      },
      IRP: {
        method: "70세 전후 필요한 만큼 인출",
        taxNote: "세액공제 원금·운용수익을 구분하고, 비공제 원금이 있으면 우선 인출 후보입니다.",
      },
      ISA: {
        method: "고배당·이자성 자산을 보유하는 절세 계좌로 유지",
        taxNote: `비과세·분리과세를 활용합니다. ${ISA_TRANSFER_NOTE}`,
      },
      BROKERAGE: {
        method: "국민연금 전후 생활비 완충 재원",
        taxNote: "원금 회수 중심으로 인출합니다.",
      },
      CASH: {
        method: "연금수령액이 부족한 달에 먼저 사용",
        taxNote: "원금 인출은 과세되지 않습니다.",
      },
      UNEMPLOYMENT: UNEMPLOYMENT_TEXT,
    },
  },
  D: {
    type: "D",
    title: "D안 · 피부양자 우선 절세형",
    goal: "국민연금 개시 전까지 연금계좌 인출을 늦춰 피부양자 가능 기간과 세금을 함께 관리하는 안",
    lumpSumAtStart: [],
    annuities: [
      { kinds: ["DC"], start: { type: "nationalPension" }, months: "untilEnd" },
      { kinds: ["PENSION_SAVINGS", "IRP"], start: { type: "age", age: 70 }, months: 180 },
    ],
    drawOrder: ["CASH", "BROKERAGE", "ISA", "NON_DEDUCTIBLE", "DC", "PENSION_SAVINGS", "IRP"],
    priorityOrder: ["실업급여", "주식계좌", "ISA", "퇴직연금 DC(국민연금 개시 후)", "연금저축·IRP(70세 이후)"],
    itemPriority: ["UNEMPLOYMENT", "CASH", "BROKERAGE", "ISA", "DC", "PENSION_SAVINGS", "IRP"],
    texts: {
      DC: {
        method: "국민연금 개시 후 소액·장기 수령",
        taxNote: "이연퇴직소득 연금수령세율(퇴직소득세의 70~50%)을 적용합니다.",
      },
      PENSION_SAVINGS: {
        method: "70세 이후 저율 구간에서 확대",
        taxNote: "70세 이후 연금소득세 4.4% 구간을 활용합니다. 비공제 원금 확인분은 예외적으로 먼저 씁니다.",
      },
      IRP: {
        method: "70세 이후 또는 필요 시 원천별 분리 인출",
        taxNote: "퇴직급여 이전분과 개인납입분을 구분합니다. 원천이 확인되지 않으면 보수적으로 계산합니다.",
      },
      ISA: {
        method: "배당·이자성 자산 절세 계좌 겸 완충 재원",
        taxNote: `세액공제보다 유동성 목적을 우선합니다. ${ISA_TRANSFER_NOTE}`,
      },
      BROKERAGE: {
        method: "원금 회수 중심으로 생활비 충당",
        taxNote: "금융소득 노출을 최소화합니다.",
      },
      CASH: {
        method: "실업급여 다음의 생활비 재원",
        taxNote: "원금 인출은 과세되지 않습니다.",
      },
      UNEMPLOYMENT: UNEMPLOYMENT_TEXT,
    },
  },
};
