import type {
  DiagnosisData,
  IDiagnosisRepo,
} from "../../application/contracts/diagnosis-repo.contract.js";
import { prisma } from "./prisma-client.js";

function toRecord(diagnosis: {
  id: number;
  userId: number;
  householdType: string;
  householdSize: number;
  birthYear: number;
  retirementYear: number;
  spouseBirthYear: number | null;
  spouseRetirementYear: number | null;
  nationalPension: number;
  retirementPension: number;
  personalPension: number;
  housingPension: number;
  monthlyExpense: number;
  healthInsurance: number;
  privateInsurance: number;
  updatedAt: Date;
}) {
  return {
    id: diagnosis.id,
    userId: diagnosis.userId,
    householdType: diagnosis.householdType,
    householdSize: diagnosis.householdSize,
    birthYear: diagnosis.birthYear,
    retirementYear: diagnosis.retirementYear,
    spouseBirthYear: diagnosis.spouseBirthYear,
    spouseRetirementYear: diagnosis.spouseRetirementYear,
    nationalPension: diagnosis.nationalPension,
    retirementPension: diagnosis.retirementPension,
    personalPension: diagnosis.personalPension,
    housingPension: diagnosis.housingPension,
    monthlyExpense: diagnosis.monthlyExpense,
    healthInsurance: diagnosis.healthInsurance,
    privateInsurance: diagnosis.privateInsurance,
    updatedAt: diagnosis.updatedAt,
  };
}

export const createDiagnosisRepo = (): IDiagnosisRepo => ({
  async findByUserId(userId: number) {
    // 사용자별 최신(유일) 진단 결과 조회
    const diagnosis = await prisma.diagnosis.findUnique({
      where: { userId },
    });

    return diagnosis ? toRecord(diagnosis) : null;
  },

  async upsert(userId: number, data: DiagnosisData) {
    // userId당 1건 — 없으면 생성, 있으면 덮어쓰기
    const diagnosis = await prisma.diagnosis.upsert({
      where: { userId },
      create: { userId, ...data },
      update: { ...data },
    });

    return toRecord(diagnosis);
  },

  async deleteByUserId(userId: number): Promise<void> {
    // 사용자 진단 결과 삭제
    await prisma.diagnosis.delete({ where: { userId } });
  },
});

export type DiagnosisRepoType = ReturnType<typeof createDiagnosisRepo>;
