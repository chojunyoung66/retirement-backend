import { z } from "zod";
import { WITHDRAWAL_PHRASE } from "../../application/services/user.service.js";

/** 비밀번호 계정 또는 Google-only 탈퇴 확인 */
export const deleteAccountDataSchema = z
  .object({
    password: z.string().min(1).optional(),
    emailConfirm: z.string().email().optional(),
    phrase: z.string().optional(),
  })
  .refine(
    (data) =>
      Boolean(data.password) ||
      (Boolean(data.emailConfirm) && data.phrase === WITHDRAWAL_PHRASE),
    {
      message:
        "비밀번호 또는 이메일·탈퇴 확인 문구(탈퇴합니다)가 필요합니다",
    },
  );

export type DeleteAccountData = z.infer<typeof deleteAccountDataSchema>;
