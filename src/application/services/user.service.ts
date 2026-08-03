import type { IUserRepo } from "../contracts/user-repo.contract.js";
import type { IHashUtil } from "../../shared/contracts/hash-util.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  hasPassword: boolean;
}

export const WITHDRAWAL_PHRASE = "탈퇴합니다";

export type DeleteAccountInput = {
  password?: string;
  emailConfirm?: string;
  phrase?: string;
};

export const createUserService = (
  userRepo: IUserRepo,
  hashUtil: IHashUtil,
) => ({
  async getProfile(userId: number): Promise<UserProfile> {
    // 탈퇴 UI 분기용 hasPassword 포함
    const user = await userRepo.findAuthById(userId);
    if (!user) {
      throw new BusinessException(
        "USER_NOT_FOUND",
        "사용자를 찾을 수 없습니다",
        404,
      );
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      hasPassword: Boolean(user.password),
    };
  },

  async updateProfile(
    userId: number,
    data: { name?: string; password?: string; currentPassword?: string },
  ): Promise<UserProfile> {
    // 부분 업데이트: name/password 중 최소 1개 필수
    if (!data.name && !data.password) {
      throw new BusinessException(
        "INVALID_UPDATE",
        "업데이트할 필드가 없습니다",
        400,
      );
    }

    const updateData: { name?: string; password?: string } = {};
    if (data.name) updateData.name = data.name;

    if (data.password) {
      // 비밀번호 변경 시 계정 상태 확인
      const user = await userRepo.findAuthById(userId);
      if (!user) {
        throw new BusinessException(
          "USER_NOT_FOUND",
          "사용자를 찾을 수 없습니다",
          404,
        );
      }

      // Google-only: 비밀번호가 없으면 이 API로 신규 설정 불가
      if (!user.password) {
        throw new BusinessException(
          "PASSWORD_NOT_SET",
          "Google 계정은 이 API로 비밀번호를 설정할 수 없습니다",
          400,
        );
      }

      // 현재 비밀번호 재확인
      const ok = await hashUtil.compare(
        data.currentPassword ?? "",
        user.password,
      );
      if (!ok) {
        throw new BusinessException(
          "INVALID_CREDENTIALS",
          "현재 비밀번호가 올바르지 않습니다",
          401,
        );
      }

      // 평문 저장 방지 — bcrypt 해시 후 보관
      updateData.password = await hashUtil.hash(data.password);
    }

    const updatedUser = await userRepo.update(userId, updateData);

    // 방금 비밀번호를 설정했으면 true, 아니면 기존 계정 상태 조회
    let hasPassword = Boolean(data.password);
    if (!hasPassword) {
      const auth = await userRepo.findAuthById(userId);
      hasPassword = Boolean(auth?.password);
    }

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      hasPassword,
    };
  },

  async deleteAccount(
    userId: number,
    input: DeleteAccountInput,
  ): Promise<void> {
    // 재인증용 레코드 조회 (password 포함)
    const user = await userRepo.findAuthById(userId);
    if (!user) {
      throw new BusinessException(
        "USER_NOT_FOUND",
        "사용자를 찾을 수 없습니다",
        404,
      );
    }

    if (user.password) {
      // 비밀번호 계정: 현재 비밀번호 확인
      const ok = await hashUtil.compare(input.password ?? "", user.password);
      if (!ok) {
        throw new BusinessException(
          "INVALID_CREDENTIALS",
          "이메일 또는 비밀번호가 올바르지 않습니다",
          401,
        );
      }
    } else {
      // Google-only: 이메일 재입력 + 확인 문구
      if (
        input.emailConfirm !== user.email ||
        input.phrase !== WITHDRAWAL_PHRASE
      ) {
        throw new BusinessException(
          "INVALID_REQUEST",
          "탈퇴 확인 정보가 올바르지 않습니다",
          400,
        );
      }
    }

    // Cascade hard delete
    await userRepo.deleteById(userId);
  },
});

export type UserServiceType = ReturnType<typeof createUserService>;
