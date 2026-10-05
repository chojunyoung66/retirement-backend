import { z } from "zod";
import { scenarioTypeSchema } from "./withdrawal-scenario.schemas.js";

export const createReportSchema = z.object({
  scenarioSetId: z
    .number({ error: "시나리오 세트 ID는 숫자여야 합니다" })
    .int("시나리오 세트 ID는 정수여야 합니다")
    .positive("시나리오 세트 ID는 1 이상이어야 합니다")
    .max(2_147_483_647, "유효한 시나리오 세트 ID가 아닙니다"),
  scenarioType: scenarioTypeSchema,
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
