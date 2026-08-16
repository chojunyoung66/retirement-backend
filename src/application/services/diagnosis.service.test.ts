import type {
  DiagnosisData,
  IDiagnosisRepo,
} from "../contracts/diagnosis-repo.contract.js";
import { createDiagnosisService } from "./diagnosis.service.js";

describe("DiagnosisService", () => {
  let diagnosisService: ReturnType<typeof createDiagnosisService>;
  let mockDiagnosisRepo: Partial<IDiagnosisRepo>;

  const diagnosisData: DiagnosisData = {
    householdType: "individual",
    householdSize: 1,
    birthYear: 1980,
    retirementYear: 2045,
    spouseBirthYear: null,
    spouseRetirementYear: null,
    nationalPension: 900000,
    retirementPension: 500000,
    personalPension: 300000,
    housingPension: 800000,
    monthlyExpense: 2500000,
    healthInsurance: 150000,
    privateInsurance: 200000,
  };

  beforeEach(() => {
    // 의존성 Mock 설정
    mockDiagnosisRepo = {
      findByUserId: jest.fn(),
      upsert: jest.fn(),
      deleteByUserId: jest.fn(),
    };

    diagnosisService = createDiagnosisService(
      mockDiagnosisRepo as IDiagnosisRepo,
    );
  });

  describe("getLatest", () => {
    it("해피패스: 저장된 최신 진단 결과를 반환", async () => {
      // given
      const userId = 1;
      const expected = {
        id: 1,
        userId,
        ...diagnosisData,
        updatedAt: new Date("2026-07-29T00:00:00.000Z"),
      };
      (mockDiagnosisRepo.findByUserId as jest.Mock).mockResolvedValueOnce(
        expected,
      );

      // when
      const result = await diagnosisService.getLatest(userId);

      // then
      expect(mockDiagnosisRepo.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expected);
    });

    it("해피패스: 진단 결과가 없으면 null 반환", async () => {
      // given
      const userId = 1;
      (mockDiagnosisRepo.findByUserId as jest.Mock).mockResolvedValueOnce(null);

      // when
      const result = await diagnosisService.getLatest(userId);

      // then
      expect(mockDiagnosisRepo.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toBeNull();
    });
  });

  describe("saveLatest", () => {
    it("해피패스: 최신 진단 결과를 저장(upsert)", async () => {
      // given
      const userId = 1;
      const saved = {
        id: 1,
        userId,
        ...diagnosisData,
        updatedAt: new Date("2026-07-29T00:00:00.000Z"),
      };
      (mockDiagnosisRepo.upsert as jest.Mock).mockResolvedValueOnce(saved);

      // when
      const result = await diagnosisService.saveLatest(userId, diagnosisData);

      // then — 예상은퇴 소득은 0으로만 저장
      expect(mockDiagnosisRepo.upsert).toHaveBeenCalledWith(userId, {
        ...diagnosisData,
        nationalPension: 0,
        retirementPension: 0,
        personalPension: 0,
        housingPension: 0,
      });
      expect(result).toEqual(saved);
    });

    it("해피패스: 부부 진단 시 배우자 연도·가구원 수를 보존", async () => {
      // given
      const userId = 2;
      const coupleData: DiagnosisData = {
        ...diagnosisData,
        householdType: "couple",
        householdSize: 2,
        spouseBirthYear: 1982,
        spouseRetirementYear: 2047,
      };
      const saved = {
        id: 2,
        userId,
        ...coupleData,
        nationalPension: 0,
        retirementPension: 0,
        personalPension: 0,
        housingPension: 0,
        updatedAt: new Date("2026-08-12T00:00:00.000Z"),
      };
      (mockDiagnosisRepo.upsert as jest.Mock).mockResolvedValueOnce(saved);

      // when
      const result = await diagnosisService.saveLatest(userId, coupleData);

      // then — 연금은 0, 배우자 연도는 유지
      expect(mockDiagnosisRepo.upsert).toHaveBeenCalledWith(userId, {
        ...coupleData,
        nationalPension: 0,
        retirementPension: 0,
        personalPension: 0,
        housingPension: 0,
      });
      expect(result.spouseBirthYear).toBe(1982);
      expect(result.householdSize).toBe(2);
    });
  });

  describe("deleteLatest", () => {
    it("해피패스: 최신 진단 결과를 삭제", async () => {
      // given
      const userId = 1;
      const existing = {
        id: 1,
        userId,
        ...diagnosisData,
        updatedAt: new Date("2026-07-29T00:00:00.000Z"),
      };
      (mockDiagnosisRepo.findByUserId as jest.Mock).mockResolvedValueOnce(
        existing,
      );
      (mockDiagnosisRepo.deleteByUserId as jest.Mock).mockResolvedValueOnce(
        undefined,
      );

      // when
      await diagnosisService.deleteLatest(userId);

      // then
      expect(mockDiagnosisRepo.findByUserId).toHaveBeenCalledWith(userId);
      expect(mockDiagnosisRepo.deleteByUserId).toHaveBeenCalledWith(userId);
    });

    it("진단 결과가 없으면 DIAGNOSIS_NOT_FOUND 예외 발생", async () => {
      // given
      const userId = 9999;
      (mockDiagnosisRepo.findByUserId as jest.Mock).mockResolvedValueOnce(null);

      // when & then
      await expect(diagnosisService.deleteLatest(userId)).rejects.toMatchObject(
        {
          code: "DIAGNOSIS_NOT_FOUND",
          statusCode: 404,
        },
      );
      expect(mockDiagnosisRepo.deleteByUserId).not.toHaveBeenCalled();
    });
  });
});
