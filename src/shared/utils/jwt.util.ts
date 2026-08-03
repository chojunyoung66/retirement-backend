import jwt from "jsonwebtoken";
import type { IJwtUtil } from "../contracts/jwt-util.contract.js";
import { IDLE_EXPIRES_IN } from "../session-policy.js";

export const createJwtUtil = (secret: string): IJwtUtil => ({
  sign(payload: Record<string, unknown>, expiresIn?: string): string {
    // 기본 유휴 30분 — 미들웨어에서 슬라이딩 갱신
    return jwt.sign(payload, secret, {
      expiresIn: (expiresIn ?? IDLE_EXPIRES_IN) as jwt.SignOptions["expiresIn"],
    });
  },

  verify(token: string): Record<string, unknown> {
    // 토큰 서명 검증 및 페이로드 추출
    return jwt.verify(token, secret) as Record<string, unknown>;
  },

  decode(token: string): Record<string, unknown> | null {
    // 서명 검증 없이 토큰 디코딩
    const decoded = jwt.decode(token);
    return decoded as Record<string, unknown> | null;
  },
});
