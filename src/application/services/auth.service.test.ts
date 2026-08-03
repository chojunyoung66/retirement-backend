import type { IUserRepo } from "../contracts/user-repo.contract.js";
import type { IHashUtil } from "../../shared/contracts/hash-util.contract.js";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";
import type { IGoogleTokenVerifier } from "../../shared/contracts/google-token-verifier.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import { createAuthService } from "./auth.service.js";

describe("AuthService", () => {
  let authService: ReturnType<typeof createAuthService>;
  let mockUserRepo: Partial<IUserRepo>;
  let mockHashUtil: Partial<IHashUtil>;
  let mockJwtUtil: Partial<IJwtUtil>;
  let mockGoogleVerifier: Partial<IGoogleTokenVerifier>;

  beforeEach(() => {
    // 의존성 Mock 설정
    mockUserRepo = {
      findByEmail: jest.fn().mockResolvedValue(null),
      findByGoogleSub: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      createGoogleUser: jest.fn(),
      update: jest.fn(),
    };

    mockHashUtil = {
      hash: jest.fn().mockResolvedValue("hashed_password_123"),
      compare: jest.fn(),
    };

    mockJwtUtil = {
      sign: jest.fn().mockReturnValue("jwt_token_abc"),
    };

    mockGoogleVerifier = {
      verifyIdToken: jest.fn(),
    };

    authService = createAuthService(
      mockUserRepo as IUserRepo,
      mockHashUtil as IHashUtil,
      mockJwtUtil as IJwtUtil,
      mockGoogleVerifier as IGoogleTokenVerifier,
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
        name,
      );
      expect(mockJwtUtil.sign).toHaveBeenCalledWith(
        expect.objectContaining({ userId, email, sessionStartedAt: expect.any(Number) }),
      );
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
        googleSub: null,
        profileImage: null,
      });

      // when & then
      await expect(
        authService.signup(email, password, name),
      ).rejects.toMatchObject({
        code: "DUPLICATE_EMAIL",
        statusCode: 409,
      });

      // 중복 검사 후 create가 호출되지 않아야 함
      expect(mockUserRepo.create).not.toHaveBeenCalled();
    });

    it("Google-only 이메일이면 GOOGLE_ONLY_ACCOUNT로 안내", async () => {
      (mockUserRepo.findByEmail as jest.Mock).mockResolvedValueOnce({
        id: 2,
        email: "google@example.com",
        password: null,
        name: "구글유저",
        googleSub: "sub-xyz",
        profileImage: null,
      });

      await expect(
        authService.signup("google@example.com", "password123", "새이름"),
      ).rejects.toMatchObject({
        code: "GOOGLE_ONLY_ACCOUNT",
        statusCode: 409,
      });
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
        googleSub: null,
        profileImage: null,
      });

      (mockHashUtil.compare as jest.Mock).mockResolvedValueOnce(true);

      // when
      const result = await authService.signin(email, password);

      // then
      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith(email);
      expect(mockHashUtil.compare).toHaveBeenCalledWith(
        password,
        hashedPassword,
      );
      expect(mockJwtUtil.sign).toHaveBeenCalledWith(
        expect.objectContaining({ userId, email, sessionStartedAt: expect.any(Number) }),
      );
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
        googleSub: null,
        profileImage: null,
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

  describe("googleSignIn", () => {
    const idToken = "google_id_token";
    const identity = {
      googleSub: "google-sub-123",
      email: "user@gmail.com",
      emailVerified: true,
      name: "구글유저",
      profileImage: "https://example.com/photo.jpg",
    };

    it("해피패스: googleSub로 기존 사용자를 찾아 JWT 발급", async () => {
      // given
      (mockGoogleVerifier.verifyIdToken as jest.Mock).mockResolvedValueOnce(
        identity,
      );
      (mockUserRepo.findByGoogleSub as jest.Mock).mockResolvedValueOnce({
        id: 10,
        email: identity.email,
        password: null,
        name: identity.name,
        googleSub: identity.googleSub,
        profileImage: identity.profileImage,
      });

      // when
      const result = await authService.googleSignIn(idToken);

      // then
      expect(mockGoogleVerifier.verifyIdToken).toHaveBeenCalledWith(idToken);
      expect(mockUserRepo.findByGoogleSub).toHaveBeenCalledWith(
        identity.googleSub,
      );
      expect(mockUserRepo.createGoogleUser).not.toHaveBeenCalled();
      expect(mockJwtUtil.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 10,
          email: identity.email,
          sessionStartedAt: expect.any(Number),
        }),
      );
      expect(result).toEqual({
        id: 10,
        email: identity.email,
        name: identity.name,
        token: "jwt_token_abc",
      });
    });

    it("해피패스: 신규 Google 사용자를 생성하고 JWT 발급", async () => {
      // given
      (mockGoogleVerifier.verifyIdToken as jest.Mock).mockResolvedValueOnce(
        identity,
      );
      (mockUserRepo.findByGoogleSub as jest.Mock).mockResolvedValueOnce(null);
      (mockUserRepo.findByEmail as jest.Mock).mockResolvedValueOnce(null);
      (mockUserRepo.createGoogleUser as jest.Mock).mockResolvedValueOnce({
        id: 20,
        email: identity.email,
        password: null,
        name: identity.name,
        googleSub: identity.googleSub,
        profileImage: identity.profileImage,
      });

      // when
      const result = await authService.googleSignIn(idToken);

      // then
      expect(mockUserRepo.createGoogleUser).toHaveBeenCalledWith({
        email: identity.email,
        googleSub: identity.googleSub,
        name: identity.name,
        profileImage: identity.profileImage,
      });
      expect(result).toEqual({
        id: 20,
        email: identity.email,
        name: identity.name,
        token: "jwt_token_abc",
      });
    });

    it("동일 이메일의 기존 계정이 있으면 자동 연결하지 않고 ACCOUNT_LINK_REQUIRED", async () => {
      // given
      (mockGoogleVerifier.verifyIdToken as jest.Mock).mockResolvedValueOnce(
        identity,
      );
      (mockUserRepo.findByGoogleSub as jest.Mock).mockResolvedValueOnce(null);
      (mockUserRepo.findByEmail as jest.Mock).mockResolvedValueOnce({
        id: 5,
        email: identity.email,
        password: "hashed",
        name: "기존유저",
        googleSub: null,
        profileImage: null,
      });

      // when & then
      await expect(authService.googleSignIn(idToken)).rejects.toMatchObject({
        code: "ACCOUNT_LINK_REQUIRED",
        statusCode: 409,
      });
      expect(mockUserRepo.update).not.toHaveBeenCalled();
      expect(mockUserRepo.createGoogleUser).not.toHaveBeenCalled();
    });

    it("이메일에 동일 googleSub가 이미 있으면 비밀번호 없이 로그인", async () => {
      (mockGoogleVerifier.verifyIdToken as jest.Mock).mockResolvedValueOnce(
        identity,
      );
      (mockUserRepo.findByGoogleSub as jest.Mock).mockResolvedValueOnce(null);
      (mockUserRepo.findByEmail as jest.Mock).mockResolvedValueOnce({
        id: 5,
        email: identity.email,
        password: "hashed",
        name: "기존유저",
        googleSub: identity.googleSub,
        profileImage: null,
      });

      const result = await authService.googleSignIn(idToken);

      expect(result).toMatchObject({
        id: 5,
        email: identity.email,
        name: "기존유저",
      });
      expect(mockUserRepo.update).not.toHaveBeenCalled();
      expect(mockJwtUtil.sign).toHaveBeenCalled();
    });

    it("유효하지 않은 Google 토큰이면 INVALID_GOOGLE_TOKEN 예외 발생", async () => {
      // given
      (mockGoogleVerifier.verifyIdToken as jest.Mock).mockRejectedValueOnce(
        new BusinessException(
          "INVALID_GOOGLE_TOKEN",
          "유효하지 않은 Google 토큰입니다",
          401,
        ),
      );

      // when & then
      await expect(authService.googleSignIn(idToken)).rejects.toMatchObject({
        code: "INVALID_GOOGLE_TOKEN",
        statusCode: 401,
      });
      expect(mockUserRepo.findByGoogleSub).not.toHaveBeenCalled();
      expect(mockUserRepo.createGoogleUser).not.toHaveBeenCalled();
    });

    it("미검증 이메일에 기존 계정이 있으면 ACCESS_DENIED 예외 발생", async () => {
      // given
      (mockGoogleVerifier.verifyIdToken as jest.Mock).mockResolvedValueOnce({
        ...identity,
        emailVerified: false,
      });
      (mockUserRepo.findByGoogleSub as jest.Mock).mockResolvedValueOnce(null);
      (mockUserRepo.findByEmail as jest.Mock).mockResolvedValueOnce({
        id: 5,
        email: identity.email,
        password: "hashed",
        name: "기존유저",
        googleSub: null,
        profileImage: null,
      });

      // when & then
      await expect(authService.googleSignIn(idToken)).rejects.toMatchObject({
        code: "ACCESS_DENIED",
        statusCode: 403,
      });
      expect(mockUserRepo.update).not.toHaveBeenCalled();
      expect(mockUserRepo.createGoogleUser).not.toHaveBeenCalled();
    });
  });

  describe("linkGoogleAccount", () => {
    const idToken = "google_id_token";
    const password = "password12";
    const identity = {
      googleSub: "google-sub-123",
      email: "user@gmail.com",
      emailVerified: true,
      name: "구글유저",
      profileImage: "https://example.com/photo.jpg",
    };

    it("해피패스: 비밀번호 확인 후 googleSub를 연결하고 JWT 발급", async () => {
      (mockGoogleVerifier.verifyIdToken as jest.Mock).mockResolvedValueOnce(
        identity,
      );
      (mockUserRepo.findByEmail as jest.Mock).mockResolvedValueOnce({
        id: 5,
        email: identity.email,
        password: "hashed",
        name: "기존유저",
        googleSub: null,
        profileImage: null,
      });
      (mockHashUtil.compare as jest.Mock).mockResolvedValueOnce(true);
      (mockUserRepo.findByGoogleSub as jest.Mock).mockResolvedValueOnce(null);
      (mockUserRepo.update as jest.Mock).mockResolvedValueOnce({
        id: 5,
        email: identity.email,
        name: "기존유저",
      });

      const result = await authService.linkGoogleAccount(idToken, password);

      expect(mockHashUtil.compare).toHaveBeenCalledWith(password, "hashed");
      expect(mockUserRepo.update).toHaveBeenCalledWith(5, {
        googleSub: identity.googleSub,
        profileImage: identity.profileImage,
      });
      expect(result).toEqual({
        id: 5,
        email: identity.email,
        name: "기존유저",
        token: "jwt_token_abc",
      });
    });

    it("비밀번호가 틀리면 INVALID_CREDENTIALS", async () => {
      (mockGoogleVerifier.verifyIdToken as jest.Mock).mockResolvedValueOnce(
        identity,
      );
      (mockUserRepo.findByEmail as jest.Mock).mockResolvedValueOnce({
        id: 5,
        email: identity.email,
        password: "hashed",
        name: "기존유저",
        googleSub: null,
        profileImage: null,
      });
      (mockHashUtil.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        authService.linkGoogleAccount(idToken, password),
      ).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
        statusCode: 401,
      });
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });

    it("미검증 Google 이메일이면 ACCESS_DENIED", async () => {
      (mockGoogleVerifier.verifyIdToken as jest.Mock).mockResolvedValueOnce({
        ...identity,
        emailVerified: false,
      });

      await expect(
        authService.linkGoogleAccount(idToken, password),
      ).rejects.toMatchObject({
        code: "ACCESS_DENIED",
        statusCode: 403,
      });
    });

    it("googleSub가 다른 계정에 이미 있으면 GOOGLE_ACCOUNT_IN_USE", async () => {
      (mockGoogleVerifier.verifyIdToken as jest.Mock).mockResolvedValueOnce(
        identity,
      );
      (mockUserRepo.findByEmail as jest.Mock).mockResolvedValueOnce({
        id: 5,
        email: identity.email,
        password: "hashed",
        name: "기존유저",
        googleSub: null,
        profileImage: null,
      });
      (mockHashUtil.compare as jest.Mock).mockResolvedValueOnce(true);
      (mockUserRepo.findByGoogleSub as jest.Mock).mockResolvedValueOnce({
        id: 99,
        email: "other@gmail.com",
        name: "다른유저",
      });

      await expect(
        authService.linkGoogleAccount(idToken, password),
      ).rejects.toMatchObject({
        code: "GOOGLE_ACCOUNT_IN_USE",
        statusCode: 409,
      });
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });
  });
});
