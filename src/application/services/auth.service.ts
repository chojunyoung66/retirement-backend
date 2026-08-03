import type { IUserRepo } from "../contracts/user-repo.contract.js";
import type { IHashUtil } from "../../shared/contracts/hash-util.contract.js";
import type { IJwtUtil } from "../../shared/contracts/jwt-util.contract.js";
import type { IGoogleTokenVerifier } from "../../shared/contracts/google-token-verifier.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import { createAuthTokenPayload } from "../../shared/session-policy.js";

export interface AuthResult {
  id: number;
  email: string;
  name: string;
  token: string;
}

export const createAuthService = (
  userRepo: IUserRepo,
  hashUtil: IHashUtil,
  jwtUtil: IJwtUtil,
  googleTokenVerifier: IGoogleTokenVerifier,
) => ({
  async signup(
    email: string,
    password: string,
    name: string,
  ): Promise<AuthResult> {
    // 기존 사용자 중복 확인
    const existingUser = await userRepo.findByEmail(email);
    if (existingUser) {
      // Google-only 계정 — 이메일 가입 대신 Google 로그인 안내
      if (!existingUser.password && existingUser.googleSub) {
        throw new BusinessException(
          "GOOGLE_ONLY_ACCOUNT",
          "이 이메일은 Google로 가입된 계정입니다. Google 로그인으로 이용해 주세요",
          409,
        );
      }

      throw new BusinessException(
        "DUPLICATE_EMAIL",
        "이미 존재하는 이메일입니다",
        409,
      );
    }

    // 비밀번호 해싱
    const hashedPassword = await hashUtil.hash(password);

    // 사용자 생성
    const user = await userRepo.create(email, hashedPassword, name);

    // JWT 토큰 발급 (유휴 30분, sessionStartedAt으로 절대 12시간 추적)
    const token = jwtUtil.sign(
      createAuthTokenPayload(user.id, user.email),
    );

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
      throw new BusinessException(
        "INVALID_CREDENTIALS",
        "이메일 또는 비밀번호가 올바르지 않습니다",
        401,
      );
    }

    // JWT 토큰 발급 (유휴 30분, sessionStartedAt으로 절대 12시간 추적)
    const token = jwtUtil.sign(
      createAuthTokenPayload(user.id, user.email),
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      token,
    };
  },

  async googleSignIn(idToken: string): Promise<AuthResult> {
    // Google ID Token 검증 (서명·aud·iss·exp)
    const identity = await googleTokenVerifier.verifyIdToken(idToken);

    // googleSub로 기존 사용자 조회
    const byGoogle = await userRepo.findByGoogleSub(identity.googleSub);
    if (byGoogle) {
      const token = jwtUtil.sign(
        createAuthTokenPayload(byGoogle.id, byGoogle.email),
      );
      return {
        id: byGoogle.id,
        email: byGoogle.email,
        name: byGoogle.name,
        token,
      };
    }

    // 동일 이메일의 기존 계정 처리
    const byEmail = await userRepo.findByEmail(identity.email);
    if (byEmail && identity.emailVerified) {
      // 이미 이 계정에 동일 Google이 연결돼 있으면 바로 로그인 (재확인 불필요)
      if (byEmail.googleSub === identity.googleSub) {
        const token = jwtUtil.sign(
          createAuthTokenPayload(byEmail.id, byEmail.email),
        );
        return {
          id: byEmail.id,
          email: byEmail.email,
          name: byEmail.name,
          token,
        };
      }

      // 다른 Google이 이미 연결됨
      if (byEmail.googleSub) {
        throw new BusinessException(
          "GOOGLE_ACCOUNT_IN_USE",
          "이미 다른 Google 계정이 연결되어 있습니다",
          409,
        );
      }

      // googleSub 미연결 — 최초 1회만 비밀번호 재인증 필요
      throw new BusinessException(
        "ACCOUNT_LINK_REQUIRED",
        "이미 가입된 이메일입니다. 비밀번호 확인 후 Google 계정을 연결해 주세요",
        409,
      );
    }

    // 미검증 이메일인데 이미 계정이 있으면 연결·신규 생성 모두 불가
    if (byEmail && !identity.emailVerified) {
      throw new BusinessException(
        "ACCESS_DENIED",
        "이메일 미검증 계정은 연결할 수 없습니다",
        403,
      );
    }

    // 신규 Google 사용자 생성 (name 없으면 이메일 로컬파트)
    const name =
      identity.name?.trim() || identity.email.split("@")[0] || "user";
    const created = await userRepo.createGoogleUser({
      email: identity.email,
      googleSub: identity.googleSub,
      name,
      profileImage: identity.profileImage,
    });

    const token = jwtUtil.sign(
      createAuthTokenPayload(created.id, created.email),
    );
    return {
      id: created.id,
      email: created.email,
      name: created.name,
      token,
    };
  },

  async linkGoogleAccount(
    idToken: string,
    password: string,
  ): Promise<AuthResult> {
    // Google ID Token 검증
    const identity = await googleTokenVerifier.verifyIdToken(idToken);

    // 검증된 이메일만 기존 계정에 연결 허용
    if (!identity.emailVerified) {
      throw new BusinessException(
        "ACCESS_DENIED",
        "이메일 미검증 계정은 연결할 수 없습니다",
        403,
      );
    }

    const user = await userRepo.findByEmail(identity.email);
    const hashedPassword = user?.password || "";
    const isPasswordValid = await hashUtil.compare(password, hashedPassword);

    if (!user || !isPasswordValid) {
      throw new BusinessException(
        "INVALID_CREDENTIALS",
        "이메일 또는 비밀번호가 올바르지 않습니다",
        401,
      );
    }

    // 이미 이 계정에 동일 googleSub가 있으면 바로 로그인
    if (user.googleSub === identity.googleSub) {
      const token = jwtUtil.sign(
        createAuthTokenPayload(user.id, user.email),
      );
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        token,
      };
    }

    // 다른 계정에 이미 연결된 Google이면 충돌
    if (user.googleSub && user.googleSub !== identity.googleSub) {
      throw new BusinessException(
        "GOOGLE_ACCOUNT_IN_USE",
        "이미 다른 Google 계정이 연결되어 있습니다",
        409,
      );
    }

    const byGoogle = await userRepo.findByGoogleSub(identity.googleSub);
    if (byGoogle && byGoogle.id !== user.id) {
      throw new BusinessException(
        "GOOGLE_ACCOUNT_IN_USE",
        "이 Google 계정은 다른 사용자에게 이미 연결되어 있습니다",
        409,
      );
    }

    // 비밀번호 확인 후 googleSub 연결
    await userRepo.update(user.id, {
      googleSub: identity.googleSub,
      profileImage: identity.profileImage,
    });

    const token = jwtUtil.sign(
      createAuthTokenPayload(user.id, user.email),
    );
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      token,
    };
  },

  async getMe(userId: number) {
    // 인증된 사용자 프로필 조회
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new BusinessException(
        "USER_NOT_FOUND",
        "사용자를 찾을 수 없습니다",
        404,
      );
    }
    return user;
  },
});

export type AuthServiceType = ReturnType<typeof createAuthService>;
