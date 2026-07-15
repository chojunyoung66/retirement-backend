import { z } from "zod";

export const portfolioItemSchema = z.object({
  symbol: z.string().min(1, "종목 코드는 필수입니다"),
  name: z.string().min(1, "종목명은 필수입니다"),
  allocation: z.number().positive("배분율은 양수여야 합니다").max(100, "배분율은 100% 이하여야 합니다"),
});

export type PortfolioItemData = z.infer<typeof portfolioItemSchema>;

export const portfolioDataSchema = z.object({
  accountType: z.string().min(1, "계정 유형은 필수입니다"),
  name: z.string().min(1, "포트폴리오명은 필수입니다").max(100, "포트폴리오명은 100자 이하여야 합니다"),
  items: z.array(portfolioItemSchema).min(1, "최소 1개의 포트폴리오 항목이 필요합니다"),
});

export type PortfolioData = z.infer<typeof portfolioDataSchema>;

export const portfolioUpdateSchema = z
  .object({
    name: z.string().min(1, "포트폴리오명은 필수입니다").max(100, "포트폴리오명은 100자 이하여야 합니다").optional(),
    items: z.array(portfolioItemSchema).min(1, "최소 1개의 포트폴리오 항목이 필요합니다").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "업데이트할 필드가 없습니다",
  });

export type PortfolioUpdate = z.infer<typeof portfolioUpdateSchema>;
