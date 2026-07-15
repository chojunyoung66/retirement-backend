import { z } from "zod";

// 이메일 정규식: 영문·숫자·허용 특수문자(. _ % + -)만 허용, 국제 도메인·한글 주소 차단
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const emailSchema = z
  .string()
  .email("유효한 이메일 형식이어야 합니다")
  .refine((val) => emailRegex.test(val), "이메일은 영문, 숫자, 허용된 특수문자(._%+-)만 사용할 수 있습니다");

export const signupDataSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "비밀번호는 최소 8자 이상이어야 합니다"),
  name: z.string().min(1, "이름은 필수입니다").max(50, "이름은 50자 이하여야 합니다"),
});

export type SignupData = z.infer<typeof signupDataSchema>;

export const signinDataSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "비밀번호는 필수입니다"),
});

export type SigninData = z.infer<typeof signinDataSchema>;
