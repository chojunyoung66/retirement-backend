import { z } from "zod";
import { PAYMENT_STATUSES } from "../../application/contracts/payment-repo.contract.js";
import { REVIEW_STATUSES } from "../../application/contracts/review-request-repo.contract.js";

const idSchema = z
  .number({ error: "ID는 숫자여야 합니다" })
  .int("ID는 정수여야 합니다")
  .positive("ID는 1 이상이어야 합니다")
  .max(2_147_483_647, "유효한 ID가 아닙니다");

export const createReviewRequestSchema = z.object({
  reportId: idSchema,
  question: z
    .string({ error: "검토받고 싶은 내용을 입력해주세요" })
    .trim()
    .min(5, "검토받고 싶은 내용을 5자 이상 입력해주세요")
    .max(1000, "검토 요청은 1000자 이하로 입력해주세요"),
  consent: z.literal(true, { error: "리포트 열람 동의가 필요합니다" }),
});

export const setExecutionItemSchema = z.object({
  done: z.boolean({ error: "완료 여부는 true 또는 false여야 합니다" }),
});

export const executionItemKeySchema = z.string().regex(/^[a-z0-9-]{1,40}$/);

export const adminUpdateReviewSchema = z
  .object({
    status: z.enum(REVIEW_STATUSES as [string, ...string[]]).optional(),
    answer: z.string().max(5000, "답변은 5000자 이하로 입력해주세요").nullable().optional(),
    operatorNote: z.string().max(2000, "메모는 2000자 이하로 입력해주세요").nullable().optional(),
  })
  .refine(
    (body) => body.status !== undefined || body.answer !== undefined || body.operatorNote !== undefined,
    "변경할 항목이 없습니다",
  );

export const adminRefundSchema = z.object({
  reason: z
    .string({ error: "환불 사유를 입력해주세요" })
    .trim()
    .min(2, "환불 사유를 입력해주세요")
    .max(200, "환불 사유는 200자 이하로 입력해주세요"),
});

const limitSchema = z.coerce.number().int().min(1).max(200).default(100);

export const adminReviewListQuerySchema = z.object({
  status: z.enum(REVIEW_STATUSES as [string, ...string[]]).optional(),
  limit: limitSchema,
});

export const adminPaymentListQuerySchema = z.object({
  status: z.enum(PAYMENT_STATUSES as [string, ...string[]]).optional(),
  limit: limitSchema,
});
