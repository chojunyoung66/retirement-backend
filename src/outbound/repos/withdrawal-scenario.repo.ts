import type { WithdrawalScenarioSet } from "@prisma/client";
import type {
  IWithdrawalScenarioRepo,
  WithdrawalScenarioSetRecord,
} from "../../application/contracts/withdrawal-scenario-repo.contract.js";
import type {
  EngineInput,
  ScenarioSetResult,
  ScenarioType,
} from "../../application/services/withdrawal/types.js";
import { prisma } from "./prisma-client.js";

const toRecord = (set: WithdrawalScenarioSet): WithdrawalScenarioSetRecord => ({
  id: set.id,
  userId: set.userId,
  ruleVersion: set.ruleVersion,
  input: set.input as unknown as EngineInput,
  result: set.result as unknown as ScenarioSetResult,
  selectedType: set.selectedType as ScenarioType | null,
  createdAt: set.createdAt,
});

export const createWithdrawalScenarioRepo = (): IWithdrawalScenarioRepo => ({
  async create(userId, data) {
    const set = await prisma.withdrawalScenarioSet.create({
      data: {
        userId,
        ruleVersion: data.ruleVersion,
        input: data.input as object,
        result: data.result as object,
      },
    });
    return toRecord(set);
  },

  async findLatestByUserId(userId) {
    const set = await prisma.withdrawalScenarioSet.findFirst({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return set ? toRecord(set) : null;
  },

  async findById(id) {
    const set = await prisma.withdrawalScenarioSet.findUnique({ where: { id } });
    return set ? toRecord(set) : null;
  },

  async updateSelection(id, selectedType) {
    const set = await prisma.withdrawalScenarioSet.update({
      where: { id },
      data: { selectedType },
    });
    return toRecord(set);
  },

  async pruneByUserId(userId, keep) {
    const stale = await prisma.withdrawalScenarioSet.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: keep,
      select: { id: true },
    });
    if (stale.length === 0) return;
    await prisma.withdrawalScenarioSet.deleteMany({
      where: { id: { in: stale.map((s) => s.id) } },
    });
  },

  async deleteByUserId(userId) {
    const { count } = await prisma.withdrawalScenarioSet.deleteMany({ where: { userId } });
    return count;
  },
});

export type WithdrawalScenarioRepoType = ReturnType<typeof createWithdrawalScenarioRepo>;
