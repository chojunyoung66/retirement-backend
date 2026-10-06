import { z } from "zod";
import { createReportSchema } from "./report.schemas.js";

export const orderIdSchema = z
  .string({ error: "주문 ID가 필요합니다" })
  .regex(/^[A-Za-z0-9_-]{6,64}$/, "유효한 주문 ID가 아닙니다");

export const createReportOrderSchema = createReportSchema.pick({
  scenarioSetId: true,
  scenarioType: true,
});

export const confirmPaymentSchema = z.object({
  paymentKey: z
    .string({ error: "결제 키가 필요합니다" })
    .min(1, "결제 키가 필요합니다")
    .max(200, "유효한 결제 키가 아닙니다"),
  orderId: orderIdSchema,
  amount: z
    .number({ error: "결제 금액은 숫자여야 합니다" })
    .int("결제 금액은 정수여야 합니다")
    .positive("결제 금액은 0보다 커야 합니다"),
});

export const failPaymentSchema = z.object({
  orderId: orderIdSchema,
  code: z
    .string()
    .max(100)
    .regex(/^[A-Za-z0-9_]*$/, "유효한 오류 코드가 아닙니다")
    .default("USER_CANCEL"),
});
