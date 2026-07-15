import type { IUserRepo } from "../contracts/user-repo.contract.js";
import type { IHashUtil } from "../../shared/contracts/hash-util.contract.js";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

export interface AuthResult {
  id: number;
  email: string;
  name: string;
  token: string;
}

export const createAuthService = (
  userRepo: IUserRepo,
  hashUtil: IHashUtil,
  jwtUtil: IJwtUtil
) => ({
  async signup(
    email: string,
    password: string,
    name: string
  ): Promise<AuthResult> {
    // 기존 사용자 중복 확인
    const existingUser = await userRepo.findByEmail(email);
    if (existingUser) {
      throw new BusinessException("DUPLICATE_EMAIL", "이미 존재하는 이메일입니다", 409);
    }

    // 비밀번호 해싱
    const hashedPassword = await hashUtil.hash(password);

    // 사용자 생성
    const user = await userRepo.create(email, hashedPassword, name);

    // JWT 토큰 발급
    const token = jwtUtil.sign({ userId: user.id, email: user.email });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      token,
    };
  },

  async signin(email: string, password: string): Promise<AuthResult> {
    // 사용자 조회
    const user = await userRepo.findByEmail(email);

    // 비밀번호 검증 (타이밍 공격 방지: 사용자 없어도 해시 계산 수행)
    const hashedPassword = user?.password || "";
    const isPasswordValid = await hashUtil.compare(password, hashedPassword);

    if (!user || !isPasswordValid) {
      throw new BusinessException("INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다", 401);
    }

    // JWT 토큰 발급
    const token = jwtUtil.sign({ userId: user.id, email: user.email });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      token,
    };
  },
});

export type AuthServiceType = ReturnType<typeof createAuthService>;
