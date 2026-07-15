import type { IUserRepo } from "../contracts/user-repo.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

export interface UserProfile {
  id: number;
  email: string;
  name: string;
}

export const createUserService = (userRepo: IUserRepo) => ({
  async getProfile(userId: number): Promise<UserProfile> {
    // 사용자 존재 검증: 삭제된/없는 사용자 접근 방지
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new BusinessException("USER_NOT_FOUND", "사용자를 찾을 수 없습니다", 404);
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  },

  async updateProfile(
    userId: number,
    data: { name?: string; password?: string }
  ): Promise<UserProfile> {
    // 부분 업데이트: name/password 중 최소 1개 필수
    if (!data.name && !data.password) {
      throw new BusinessException("INVALID_UPDATE", "업데이트할 필드가 없습니다", 400);
    }

    // 사용자 정보 업데이트
    const updatedUser = await userRepo.update(userId, data);

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
    };
  },
});

export type UserServiceType = ReturnType<typeof createUserService>;
