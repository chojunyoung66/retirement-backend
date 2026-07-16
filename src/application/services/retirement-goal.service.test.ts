import type { IRetirementGoalRepo, RetirementGoalData } from "../contracts/retirement-goal-repo.contract.js";
import { createRetirementGoalService } from "./retirement-goal.service.js";

describe("RetirementGoalService", () => {
  let retirementGoalService: ReturnType<typeof createRetirementGoalService>;
  let mockRetirementGoalRepo: Partial<IRetirementGoalRepo>;

  beforeEach(() => {
    // 의존성 Mock 설정
    mockRetirementGoalRepo = {
      findByUserId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteByUserId: jest.fn(),
    };

    retirementGoalService = createRetirementGoalService(
      mockRetirementGoalRepo as IRetirementGoalRepo
    );
  });

  describe("create", () => {
    it("해피패스: 사용자의 정년 목표를 생성", async () => {
      // given
      const userId = 1;
      const goalData: RetirementGoalData = {
        birthYear: 1980,
        retirementYear: 2045,
        monthlyLivingExpense: 3000000,
        nationalPension: 1500000,
        retirementAsset: 500000000,
      };

      (mockRetirementGoalRepo.create as jest.Mock).mockResolvedValueOnce({
        id: 1,
        ...goalData,
      });

      // when
      const result = await retirementGoalService.create(userId, goalData);

      // then
      expect(mockRetirementGoalRepo.create).toHaveBeenCalledWith(userId, goalData);
      expect(result).toEqual({
        id: 1,
        ...goalData,
      });
    });
  });

  describe("getByUserId", () => {
    it("해피패스: 사용자의 정년 목표를 조회", async () => {
      // given
      const userId = 1;
      const expectedGoal = {
        id: 1,
        birthYear: 1980,
        retirementYear: 2045,
        monthlyLivingExpense: 3000000,
        nationalPension: 1500000,
        retirementAsset: 500000000,
      };

      (mockRetirementGoalRepo.findByUserId as jest.Mock).mockResolvedValueOnce(expectedGoal);

      // when
      const result = await retirementGoalService.getByUserId(userId);

      // then
      expect(mockRetirementGoalRepo.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedGoal);
    });

    it("정년 목표가 없는 사용자를 조회하면 RETIREMENT_GOAL_NOT_FOUND 예외 발생", async () => {
      // given
      const userId = 9999;

      (mockRetirementGoalRepo.findByUserId as jest.Mock).mockResolvedValueOnce(null);

      // when & then
      await expect(retirementGoalService.getByUserId(userId)).rejects.toMatchObject({
        code: "RETIREMENT_GOAL_NOT_FOUND",
        statusCode: 404,
      });

      expect(mockRetirementGoalRepo.findByUserId).toHaveBeenCalledWith(userId);
    });
  });

  describe("update", () => {
    it("해피패스: 정년 목표를 업데이트 (월생활비)", async () => {
      // given
      const userId = 1;
      const updateData = { monthlyLivingExpense: 4000000 };
      const existingGoal = {
        id: 1,
        birthYear: 1980,
        retirementYear: 2045,
        monthlyLivingExpense: 3000000,
        nationalPension: 1500000,
        retirementAsset: 500000000,
      };
      const updatedGoal = {
        id: 1,
        birthYear: 1980,
        retirementYear: 2045,
        monthlyLivingExpense: 4000000,
        nationalPension: 1500000,
        retirementAsset: 500000000,
      };

      (mockRetirementGoalRepo.findByUserId as jest.Mock).mockResolvedValueOnce(existingGoal);
      (mockRetirementGoalRepo.update as jest.Mock).mockResolvedValueOnce(updatedGoal);

      // when
      const result = await retirementGoalService.update(userId, updateData);

      // then
      expect(mockRetirementGoalRepo.findByUserId).toHaveBeenCalledWith(userId);
      expect(mockRetirementGoalRepo.update).toHaveBeenCalledWith(userId, updateData);
      expect(result).toEqual(updatedGoal);
    });

    it("해피패스: 정년 목표를 업데이트 (정년연도)", async () => {
      // given
      const userId = 1;
      const updateData = { retirementYear: 2050 };
      const existingGoal = {
        id: 1,
        birthYear: 1980,
        retirementYear: 2045,
        monthlyLivingExpense: 3000000,
        nationalPension: 1500000,
        retirementAsset: 500000000,
      };
      const updatedGoal = {
        id: 1,
        birthYear: 1980,
        retirementYear: 2050,
        monthlyLivingExpense: 3000000,
        nationalPension: 1500000,
        retirementAsset: 500000000,
      };

      (mockRetirementGoalRepo.findByUserId as jest.Mock).mockResolvedValueOnce(existingGoal);
      (mockRetirementGoalRepo.update as jest.Mock).mockResolvedValueOnce(updatedGoal);

      // when
      const result = await retirementGoalService.update(userId, updateData);

      // then
      expect(mockRetirementGoalRepo.findByUserId).toHaveBeenCalledWith(userId);
      expect(mockRetirementGoalRepo.update).toHaveBeenCalledWith(userId, updateData);
      expect(result).toEqual(updatedGoal);
    });

    it("해피패스: 정년 목표를 업데이트 (복수 필드)", async () => {
      // given
      const userId = 1;
      const updateData = {
        monthlyLivingExpense: 3500000,
        retirementAsset: 600000000,
      };
      const existingGoal = {
        id: 1,
        birthYear: 1980,
        retirementYear: 2045,
        monthlyLivingExpense: 3000000,
        nationalPension: 1500000,
        retirementAsset: 500000000,
      };
      const updatedGoal = {
        id: 1,
        birthYear: 1980,
        retirementYear: 2045,
        monthlyLivingExpense: 3500000,
        nationalPension: 1500000,
        retirementAsset: 600000000,
      };

      (mockRetirementGoalRepo.findByUserId as jest.Mock).mockResolvedValueOnce(existingGoal);
      (mockRetirementGoalRepo.update as jest.Mock).mockResolvedValueOnce(updatedGoal);

      // when
      const result = await retirementGoalService.update(userId, updateData);

      // then
      expect(mockRetirementGoalRepo.findByUserId).toHaveBeenCalledWith(userId);
      expect(mockRetirementGoalRepo.update).toHaveBeenCalledWith(userId, updateData);
      expect(result).toEqual(updatedGoal);
    });

    it("존재하지 않는 정년 목표를 업데이트 시 RETIREMENT_GOAL_NOT_FOUND 예외 발생", async () => {
      // given
      const userId = 9999;
      const updateData = { monthlyLivingExpense: 4000000 };

      (mockRetirementGoalRepo.findByUserId as jest.Mock).mockResolvedValueOnce(null);

      // when & then
      await expect(
        retirementGoalService.update(userId, updateData)
      ).rejects.toMatchObject({
        code: "RETIREMENT_GOAL_NOT_FOUND",
        statusCode: 404,
      });

      // 존재하지 않으면 update가 호출되지 않아야 함
      expect(mockRetirementGoalRepo.update).not.toHaveBeenCalled();
    });

    it("업데이트할 필드가 없을 때({}) INVALID_UPDATE 예외 발생", async () => {

      // given
      const userId = 1;
      const emptyData = {};

      // when & then
      await expect(retirementGoalService.update(userId, emptyData)).rejects.toMatchObject({
        code: "INVALID_UPDATE",
        statusCode: 400,
      });

      // repo 호출이 없어야 함 (사전 검증에서 실패)
      expect(mockRetirementGoalRepo.findByUserId).not.toHaveBeenCalled();
      expect(mockRetirementGoalRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("해피패스: 사용자의 정년 목표를 삭제", async () => {
      // given
      const userId = 1;
      const existingGoal = {
        id: 1,
        birthYear: 1980,
        retirementYear: 2045,
        monthlyLivingExpense: 3000000,
        nationalPension: 1500000,
        retirementAsset: 500000000,
      };

      (mockRetirementGoalRepo.findByUserId as jest.Mock).mockResolvedValueOnce(existingGoal);
      (mockRetirementGoalRepo.deleteByUserId as jest.Mock).mockResolvedValueOnce(undefined);

      // when
      await retirementGoalService.delete(userId);

      // then
      expect(mockRetirementGoalRepo.findByUserId).toHaveBeenCalledWith(userId);
      expect(mockRetirementGoalRepo.deleteByUserId).toHaveBeenCalledWith(userId);
    });

    it("존재하지 않는 정년 목표를 삭제 시 RETIREMENT_GOAL_NOT_FOUND 예외 발생", async () => {
      // given
      const userId = 9999;

      (mockRetirementGoalRepo.findByUserId as jest.Mock).mockResolvedValueOnce(null);

      // when & then
      await expect(retirementGoalService.delete(userId)).rejects.toMatchObject({
        code: "RETIREMENT_GOAL_NOT_FOUND",
        statusCode: 404,
      });

      expect(mockRetirementGoalRepo.findByUserId).toHaveBeenCalledWith(userId);
      // 존재하지 않으면 실제 삭제가 호출되지 않아야 함
      expect(mockRetirementGoalRepo.deleteByUserId).not.toHaveBeenCalled();
    });
  });

  describe("경계값/이상 데이터", () => {
    // TODO: 서비스 레이어는 현재 birthYear/retirementYear의 논리적 관계를 검증하지 않음.
    //       retirementYear < birthYear 같은 비논리적 데이터도 그대로 저장/업데이트됨.
    //       추후 정책 확정 후 domain-level validation을 추가할 것.
    it("retirementYear가 birthYear보다 이전이어도 서비스는 그대로 생성 허용 (현재 동작 문서화)", async () => {
      // given
      const userId = 1;
      const invalidGoalData: RetirementGoalData = {
        birthYear: 2000,
        retirementYear: 1990, // birthYear 이전
        monthlyLivingExpense: 3000000,
        nationalPension: 1500000,
        retirementAsset: 500000000,
      };

      (mockRetirementGoalRepo.create as jest.Mock).mockResolvedValueOnce({
        id: 1,
        ...invalidGoalData,
      });

      // when
      const result = await retirementGoalService.create(userId, invalidGoalData);

      // then: 서비스가 현재 이 케이스를 막지 않음 (검증 로직 부재)
      expect(mockRetirementGoalRepo.create).toHaveBeenCalledWith(userId, invalidGoalData);
      expect(result).toEqual({ id: 1, ...invalidGoalData });
    });
  });
});
