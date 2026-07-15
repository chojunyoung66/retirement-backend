import { z } from "zod";

export const signupDataSchema = z.object({
  email: z.string().email("유효한 이메일 형식이어야 합니다"),
  password: z.string().min(8, "비밀번호는 최소 8자 이상이어야 합니다"),
  name: z.string().min(1, "이름은 필수입니다").max(50, "이름은 50자 이하여야 합니다"),
});

export type SignupData = z.infer<typeof signupDataSchema>;

export const signinDataSchema = z.object({
  email: z.string().email("유효한 이메일 형식이어야 합니다"),
  password: z.string().min(1, "비밀번호는 필수입니다"),
});

export type SigninData = z.infer<typeof signinDataSchema>;
