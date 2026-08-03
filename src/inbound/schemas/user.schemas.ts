import { z } from "zod";
import { WITHDRAWAL_PHRASE } from "../../application/services/user.service.js";

/** 프로필 부분 업데이트 — 비밀번호 변경 시 현재 비밀번호 필수 */
export const updateProfileDataSchema = z
  .object({
    name: z
      .string()
      .min(1, "이름은 필수입니다")
      .max(50, "이름은 50자 이하여야 합니다")
      .optional(),
    password: z
      .string()
      .min(8, "비밀번호는 최소 8자 이상이어야 합니다")
      .optional(),
    currentPassword: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.name) || Boolean(data.password), {
    message: "변경할 필드가 없습니다",
  })
  .refine((data) => !data.password || Boolean(data.currentPassword), {
    message: "비밀번호 변경 시 현재 비밀번호가 필요합니다",
  });

export type UpdateProfileData = z.infer<typeof updateProfileDataSchema>;

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
