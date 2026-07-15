import jwt from "jsonwebtoken";
import type { IJwtUtil } from "../contracts/jwt-util.contract.js";

export const createJwtUtil = (secret: string): IJwtUtil => ({
  sign(payload: Record<string, unknown>, expiresIn?: string): string {
    // 페이로드를 비밀키로 서명하여 토큰 생성
    return jwt.sign(payload, secret, { expiresIn: (expiresIn ?? "7d") as jwt.SignOptions["expiresIn"] });
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
