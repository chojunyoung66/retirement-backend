import type {
  DiagnosisData,
  DiagnosisRecord,
  IDiagnosisRepo,
} from "../contracts/diagnosis-repo.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

export const createDiagnosisService = (diagnosisRepo: IDiagnosisRepo) => ({
  async getLatest(userId: number): Promise<DiagnosisRecord | null> {
    // 없으면 null — 404가 아닌 빈 상태로 프론트에 전달
    return diagnosisRepo.findByUserId(userId);
  },

  async saveLatest(
    userId: number,
    data: DiagnosisData,
  ): Promise<DiagnosisRecord> {
    // MVP: 예상은퇴 소득(연금) 실값은 서버에 저장하지 않음 — 0으로만 보관
    const sanitized: DiagnosisData = {
      ...data,
      nationalPension: 0,
      retirementPension: 0,
      personalPension: 0,
      housingPension: 0,
    };
    return diagnosisRepo.upsert(userId, sanitized);
  },

  async deleteLatest(userId: number): Promise<void> {
    // 삭제 전 존재 여부 확인
    const existing = await diagnosisRepo.findByUserId(userId);
    if (!existing) {
      throw new BusinessException(
        "DIAGNOSIS_NOT_FOUND",
        "진단 결과를 찾을 수 없습니다",
        404,
      );
    }

    await diagnosisRepo.deleteByUserId(userId);
  },
});

export type DiagnosisServiceType = ReturnType<typeof createDiagnosisService>;
