import type {
  EngineInput,
  ScenarioSetResult,
  ScenarioType,
} from "../services/withdrawal/types.js";

export interface WithdrawalScenarioSetRecord {
  id: number;
  userId: number;
  ruleVersion: string;
  input: EngineInput;
  result: ScenarioSetResult;
  selectedType: ScenarioType | null;
  createdAt: Date;
}

export interface IWithdrawalScenarioRepo {
  create(
    userId: number,
    data: { ruleVersion: string; input: EngineInput; result: ScenarioSetResult },
  ): Promise<WithdrawalScenarioSetRecord>;
  findLatestByUserId(userId: number): Promise<WithdrawalScenarioSetRecord | null>;
  findById(id: number): Promise<WithdrawalScenarioSetRecord | null>;
  updateSelection(id: number, selectedType: ScenarioType): Promise<WithdrawalScenarioSetRecord>;
  /** 최신 keep건만 남기고 이전 세트를 지운다 */
  pruneByUserId(userId: number, keep: number): Promise<void>;
  /** 본인 세트 전체 삭제 — 리포트는 SetNull로 남는다 */
  deleteByUserId(userId: number): Promise<number>;
}
