import { BusinessException } from "../../shared/exceptions/business.exception.js";

export interface UserProfile {
  id: number;
  email: string;
  name: string;
}

export const createUserEntity = (
  id: number,
  email: string,
  initialHashedPassword: string,
  initialName: string,
) => {
  // 사용자 상태 관리
  let name = initialName;
  let hashedPassword = initialHashedPassword;

  return {
    // 사용자 ID 반환
    getId: () => id,

    // 사용자 이메일 반환
    getEmail: () => email,

    // 사용자 이름 반환
    getName: () => name,

    // 해시된 비밀번호 반환
    getHashedPassword: () => hashedPassword,

    // 사용자 프로필 반환
    getProfile: (): UserProfile => ({
      id,
      email,
      name,
    }),

    // 이메일 형식 유효성 검증
    validateEmail: (emailToValidate: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailToValidate)) {
        throw new BusinessException(
          "INVALID_EMAIL",
          "유효하지 않은 이메일 형식입니다",
          400,
        );
      }
    },

    // 비밀번호 길이 유효성 검증
    validatePassword: (passwordToValidate: string) => {
      if (!passwordToValidate || passwordToValidate.length < 8) {
        throw new BusinessException(
          "INVALID_PASSWORD",
          "비밀번호는 8자 이상이어야 합니다",
          400,
        );
      }
    },

    // 사용자 프로필 업데이트
    updateProfile: (data: { name?: string; hashedPassword?: string }) => {
      if (data.name) {
        name = data.name;
      }
      if (data.hashedPassword) {
        hashedPassword = data.hashedPassword;
      }
    },
  };
};

export type UserEntityType = ReturnType<typeof createUserEntity>;
