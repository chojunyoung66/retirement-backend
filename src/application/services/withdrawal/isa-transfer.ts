import { IRP_RULES, ISA_RULES } from "../../rules/rule-set.js";
import type { EngineAccount, IsaStrategy } from "./types.js";

const T = ISA_RULES.pensionTransfer;

/** 만기 ISA를 연금계좌로 전환할 때의 추가 세액공제 효과를 계산한다 */
export const isaTransferOf = (balance: number) => {
  // 전환액의 10%, 최대 300만원까지 세액공제 대상 납입액에 더해진다
  const extraCreditBase = Math.min(Math.max(0, balance) * T.creditBaseRate, T.maxExtraCreditBase);
  return {
    extraCreditBase: Math.round(extraCreditBase),
    excessOverCap: Math.max(0, Math.round(balance - T.fullEffectTransferAmount)),
    maxTaxCreditEstimate: Math.round(extraCreditBase * IRP_RULES.highIncomeCreditRate),
  };
};

export const isaStrategyOf = (accounts: EngineAccount[], startYm: string): IsaStrategy[] =>
  accounts
    .filter((a) => a.accountType === "ISA")
    .map((a) => {
      const transfer = isaTransferOf(a.balance);
      // 만기가 퇴직(계산 시작) 이후면 근로소득 결정세액이 없어 공제 효과가 제한된다
      const effectLimitedAfterRetirement = a.isaMaturityYm === null || a.isaMaturityYm >= startYm;
      const notes: string[] = [];

      // 판정별 안내 문구
      if (a.isaMaturityYm) {
        notes.push(`만기 ${a.isaMaturityYm} 후 ${T.deadlineDays}일 이내에 연금계좌 전환 여부를 정해야 합니다.`);
      } else {
        notes.push("만기월이 입력되지 않아 퇴직 이후 만기로 보수적으로 판단했습니다.");
      }
      if (transfer.excessOverCap > 0) {
        notes.push("3천만원을 넘는 전환분은 추가 세액공제 효과가 늘지 않습니다.");
      }
      if (effectLimitedAfterRetirement) {
        notes.push(
          "퇴직 후에는 결정세액이 없으면 세액공제 효과가 제한되므로, 배당·이자 절세와 유동성 완충 목적을 우선합니다.",
        );
      }
      notes.push("총급여 5,500만원 이하이면 공제율 16.5%가 적용돼 효과가 더 커질 수 있습니다.");

      return {
        accountId: a.id,
        label: a.label,
        balance: a.balance,
        maturityYm: a.isaMaturityYm,
        ...transfer,
        effectLimitedAfterRetirement,
        notes,
      };
    });
