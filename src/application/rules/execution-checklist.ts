import { ACTION_LABEL, type ReportContent } from "../services/report/report-content.js";

export const EXECUTION_PLAN_DAYS = 100;

export interface ExecutionItemTemplate {
  key: string;
  label: string;
  /** 시작일로부터 며칠째까지 할 일인지 (1~100) */
  dueDay: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const clampDay = (day: number) => Math.min(EXECUTION_PLAN_DAYS - 10, Math.max(3, day));

/** 실행 항목 시작월 1일까지 남은 날 — 100일 밖이거나 이미 지났으면 30일째로 둔다 */
const dueDayForYm = (ym: string | null, startDate: Date): number => {
  if (!ym) return 30;
  const [year, month] = ym.split("-").map(Number);
  const days = Math.round((Date.UTC(year!, month! - 1, 1) - startDate.getTime()) / DAY_MS);
  if (days < 0 || days > EXECUTION_PLAN_DAYS) return 30;
  return clampDay(days);
};

/**
 * 리포트의 실행 항목에 표준 점검 항목을 더해 100일 체크리스트를 만든다.
 * 금액은 넣지 않는다 — 운영자에게 보여도 원자료가 드러나지 않게 한다
 */
export const buildExecutionChecklist = (
  content: ReportContent,
  startDate: Date,
): ExecutionItemTemplate[] => {
  const items: ExecutionItemTemplate[] = [
    {
      key: "health-premium-check",
      label: "건강보험공단에서 퇴직 후 예상 보험료와 임의계속가입 여부 확인",
      dueDay: 7,
    },
    {
      key: "pension-tax-basis-check",
      label: "금융사에서 연금계좌 과세구분(비공제 원금) 조회 결과 받기",
      dueDay: 14,
    },
    {
      key: "national-pension-check",
      label: "국민연금공단에서 예상 수령액과 수령 시작 시기 확인",
      dueDay: 21,
    },
  ];

  const accountTypes = new Set(content.scenario.planItems.map((item) => item.accountType));
  if (accountTypes.has("UNEMPLOYMENT")) {
    items.push({
      key: "unemployment-apply",
      label: "고용센터에 실업급여 수급자격 신청 (퇴직 다음 날부터 12개월 안)",
      dueDay: 10,
    });
  }
  if (accountTypes.has("DC")) {
    items.push({
      key: "dc-to-irp",
      label: "DC 적립금을 IRP로 옮기고 수령 방식 정하기",
      dueDay: 30,
    });
  }
  if ((content.isaStrategy ?? []).length > 0) {
    items.push({
      key: "isa-transfer-plan",
      label: "ISA 만기 후 연금계좌 전환 일정 확인",
      dueDay: 45,
    });
  }

  content.nextActions.forEach((action, index) => {
    items.push({
      key: `next-action-${index + 1}`,
      label: `${action.label} ${ACTION_LABEL[action.actionType]} 준비 · ${action.method}`,
      dueDay: dueDayForYm(action.startYm ?? content.startYm, startDate),
    });
  });

  items.push(
    { key: "review-30", label: "30일 점검: 첫 달 실제 지출과 계획 비교", dueDay: 30 },
    { key: "review-60", label: "60일 점검: 인출 계좌와 원천징수 세금 확인", dueDay: 60 },
    {
      key: "review-100",
      label: "100일 점검: 바뀐 잔액으로 다시 계산해 계획 갱신",
      dueDay: EXECUTION_PLAN_DAYS,
    },
  );

  return items.sort((a, b) => a.dueDay - b.dueDay);
};
