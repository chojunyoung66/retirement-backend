import bcrypt from "bcrypt";
import type { IHashUtil } from "../contracts/hash-util.contract.js";

const SALT_ROUNDS = 10;

export const createBcryptUtil = (): IHashUtil => ({
  async hash(plainText: string): Promise<string> {
    // bcrypt로 평문을 해시처리
    return bcrypt.hash(plainText, SALT_ROUNDS);
  },

  async compare(plainText: string, hashedText: string): Promise<boolean> {
    // 평문과 해시값을 비교
    return bcrypt.compare(plainText, hashedText);
  },
});
