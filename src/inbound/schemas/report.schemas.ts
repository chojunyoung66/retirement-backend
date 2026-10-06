import { z } from "zod";
import { scenarioTypeSchema } from "./withdrawal-scenario.schemas.js";

export const createReportSchema = z.object({
  scenarioSetId: z
    .number({ error: "시나리오 세트 ID는 숫자여야 합니다" })
    .int("시나리오 세트 ID는 정수여야 합니다")
    .positive("시나리오 세트 ID는 1 이상이어야 합니다")
    .max(2_147_483_647, "유효한 시나리오 세트 ID가 아닙니다"),
  scenarioType: scenarioTypeSchema,
  orderId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{6,64}$/, "유효한 주문 ID가 아닙니다")
    .optional(),
});

export const renameReportSchema = z.object({
  title: z
    .string({ error: "리포트 이름은 문자열이어야 합니다" })
    .max(40, "리포트 이름은 40자 이하로 입력해주세요")
    .nullable(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
