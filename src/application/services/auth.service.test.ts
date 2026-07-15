import type { IUserRepo } from "../contracts/user-repo.contract.js";
import type { IHashUtil } from "../../shared/contracts/hash-util.contract.js";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";
import { createAuthService } from "./auth.service.js";

describe("AuthService", () => {
  let authService: ReturnType<typeof createAuthService>;
  let mockUserRepo: Partial<IUserRepo>;
  let mockHashUtil: Partial<IHashUtil>;
  let mockJwtUtil: Partial<IJwtUtil>;

  beforeEach(() => {
    // 의존성 Mock 설정
    mockUserRepo = {
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    };

    mockHashUtil = {
      hash: jest.fn().mockResolvedValue("hashed_password_123"),
      compare: jest.fn(),
    };

    mockJwtUtil = {
      sign: jest.fn().mockReturnValue("jwt_token_abc"),
    };

    authService = createAuthService(
      mockUserRepo as IUserRepo,
      mockHashUtil as IHashUtil,
      mockJwtUtil as IJwtUtil
    );
  });

  describe("signup", () => {
    it("해피패스: 이메일과 비밀번호로 신규 사용자를 생성하고 JWT 토큰을 반환", async () => {
      // given
      const email = "test@example.com";
      const password = "password123";
      const name = "테스트유저";
      const userId = 1;

      (mockUserRepo.findByEmail as jest.Mock).mockResolvedValueOnce(null);
      (mockUserRepo.create as jest.Mock).mockResolvedValueOnce({
        id: userId,
        email,
        name,
      });

      // when
      const result = await authService.signup(email, password, name);

      // then
      expect(mockHashUtil.hash).toHaveBeenCalledWith(password);
      expect(mockUserRepo.create).toHaveBeenCalledWith(
        email,
        "hashed_password_123",
        name
      );
      expect(mockJwtUtil.sign).toHaveBeenCalledWith({ userId, email });
      expect(result).toEqual({
        id: userId,
        email,
        name,
        token: "jwt_token_abc",
      });
    });

    it("이미 존재하는 이메일로 가입 시도 시 DUPLICATE_EMAIL 예외 발생", async () => {
      // given
      const email = "existing@example.com";
      const password = "password123";
      const name = "새로운유저";

      (mockUserRepo.findByEmail as jest.Mock).mockResolvedValueOnce({
        id: 1,
        email,
        password: "hashed_existing",
        name: "기존유저",
      });

      // when & then
      await expect(authService.signup(email, password, name)).rejects.toMatchObject({
        code: "DUPLICATE_EMAIL",
        statusCode: 409,
      });

      // 중복 검사 후 create가 호출되지 않아야 함
      expect(mockUserRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("signin", () => {
    it("해피패스: 올바른 이메일과 비밀번호로 JWT 토큰을 발급", async () => {
      // given
      const email = "test@example.com";
      const password = "password123";
      const userId = 1;
      const hashedPassword = "hashed_password_123";

      (mockUserRepo.findByEmail as jest.Mock).mockResolvedValueOnce({
        id: userId,
        email,
        password: hashedPassword,
        name: "테스트유저",
      });

      (mockHashUtil.compare as jest.Mock).mockResolvedValueOnce(true);

      // when
      const result = await authService.signin(email, password);

      // then
      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith(email);
      expect(mockHashUtil.compare).toHaveBeenCalledWith(
        password,
        hashedPassword
      );
      expect(mockJwtUtil.sign).toHaveBeenCalledWith({ userId, email });
      expect(result).toEqual({
        id: userId,
        email,
        name: "테스트유저",
        token: "jwt_token_abc",
      });
    });

    it("존재하지 않는 이메일로 로그인 시 INVALID_CREDENTIALS 예외 발생", async () => {
      // given
      const email = "nonexistent@example.com";
      const password = "password123";

      (mockUserRepo.findByEmail as jest.Mock).mockResolvedValueOnce(null);
      (mockHashUtil.compare as jest.Mock).mockResolvedValueOnce(false);

      // when & then
      await expect(authService.signin(email, password)).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
        statusCode: 401,
      });

      // 타이밍 공격 방지: 사용자 없어도 해시 계산이 수행되어야 함
      expect(mockHashUtil.compare).toHaveBeenCalled();
    });

    it("잘못된 비밀번호로 로그인 시 INVALID_CREDENTIALS 예외 발생", async () => {
      // given
      const email = "test@example.com";
      const password = "wrongpassword";
      const hashedPassword = "hashed_correct_password";

      (mockUserRepo.findByEmail as jest.Mock).mockResolvedValueOnce({
        id: 1,
        email,
        password: hashedPassword,
        name: "테스트유저",
      });

      (mockHashUtil.compare as jest.Mock).mockResolvedValueOnce(false);

      // when & then
      await expect(authService.signin(email, password)).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
        statusCode: 401,
      });

      // JWT 토큰이 발급되지 않아야 함
      expect(mockJwtUtil.sign).not.toHaveBeenCalled();
    });
  });
});
