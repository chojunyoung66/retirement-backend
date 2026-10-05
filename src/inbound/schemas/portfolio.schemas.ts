import { z } from "zod";

// 프론트 PortfolioScreen 계좌 유형 선택지와 동일하게 유지
export const PORTFOLIO_ACCOUNT_TYPES = ["IRP", "ISA", "연금저축", "일반계좌"] as const;
export const MAX_PORTFOLIO_ITEMS = 50;
const ALLOCATION_SUM_TOLERANCE = 0.01;

export const portfolioItemSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "종목 코드는 필수입니다")
    .max(20, "종목 코드는 20자 이하여야 합니다"),
  name: z
    .string()
    .trim()
    .min(1, "종목명은 필수입니다")
    .max(100, "종목명은 100자 이하여야 합니다"),
  allocation: z.number().positive("배분율은 양수여야 합니다").max(100, "배분율은 100% 이하여야 합니다"),
});

export type PortfolioItemData = z.infer<typeof portfolioItemSchema>;

// 항목 수 제한과 비중 합계 100% 검증
const portfolioItemsSchema = z
  .array(portfolioItemSchema)
  .min(1, "최소 1개의 포트폴리오 항목이 필요합니다")
  .max(MAX_PORTFOLIO_ITEMS, `포트폴리오 항목은 ${MAX_PORTFOLIO_ITEMS}개 이하여야 합니다`)
  .refine(
    (items) =>
      Math.abs(items.reduce((sum, item) => sum + item.allocation, 0) - 100) <=
      ALLOCATION_SUM_TOLERANCE,
    { message: "배분율 합계는 100%여야 합니다" },
  );

const portfolioNameSchema = z
  .string()
  .trim()
  .min(1, "포트폴리오명은 필수입니다")
  .max(100, "포트폴리오명은 100자 이하여야 합니다");

const accountTypeSchema = z.enum(PORTFOLIO_ACCOUNT_TYPES, {
  error: `계좌 유형은 ${PORTFOLIO_ACCOUNT_TYPES.join(", ")} 중 하나여야 합니다`,
});

export const portfolioDataSchema = z.object({
  accountType: accountTypeSchema,
  name: portfolioNameSchema,
  items: portfolioItemsSchema,
});

export type PortfolioData = z.infer<typeof portfolioDataSchema>;

export const portfolioUpdateSchema = z
  .object({
    accountType: accountTypeSchema.optional(),
    name: portfolioNameSchema.optional(),
    items: portfolioItemsSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "업데이트할 필드가 없습니다",
  });

export type PortfolioUpdate = z.infer<typeof portfolioUpdateSchema>;
