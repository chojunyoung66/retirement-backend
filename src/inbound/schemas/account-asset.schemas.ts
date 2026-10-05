import { z } from "zod";
import {
  ACCOUNT_ASSET_TYPES,
  IRP_SOURCES,
} from "../../application/contracts/account-asset-repo.contract.js";

// Int4 컬럼에 저장하므로 PostgreSQL 상한 아래로 제한
export const MAX_ACCOUNT_AMOUNT = 2_000_000_000;

const wonAmount = (label: string) =>
  z
    .number({ error: `${label}은(는) 숫자여야 합니다` })
    .int(`${label}은(는) 원 단위 정수여야 합니다`)
    .nonnegative(`${label}은(는) 0 이상이어야 합니다`)
    .max(MAX_ACCOUNT_AMOUNT, `${label}이(가) 너무 큽니다`);

// 빈 문자열은 null로 저장, 생략(undefined)은 그대로 둬서 부분 수정 시 기존 값을 유지
const optionalText = (label: string) =>
  z
    .string()
    .trim()
    .max(50, `${label}은(는) 50자 이하여야 합니다`)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null));

const accountTypeSchema = z.enum(ACCOUNT_ASSET_TYPES, {
  error: `계좌 유형은 ${ACCOUNT_ASSET_TYPES.join(", ")} 중 하나여야 합니다`,
});
const irpSourceSchema = z.enum(IRP_SOURCES, {
  error: `IRP 재원은 ${IRP_SOURCES.join(", ")} 중 하나여야 합니다`,
});
const legacySchema = z.boolean({ error: "구계좌 여부는 true/false여야 합니다" });
const ymSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "ISA 만기월은 YYYY-MM 형식이어야 합니다");

export const accountAssetCreateSchema = z
  .object({
    accountType: accountTypeSchema,
    accountName: optionalText("계좌 별칭"),
    institution: optionalText("금융사"),
    balance: wonAmount("잔액"),
    principalTaxCredited: wonAmount("세액공제 원금").default(0),
    principalNonDeductible: wonAmount("비공제 원금").default(0),
    investmentGain: wonAmount("운용수익").default(0),
    deferredRetirementIncome: wonAmount("이연퇴직소득").default(0),
    irpSource: irpSourceSchema.nullable().default(null),
    pensionSavingsLegacy: legacySchema.nullable().default(null),
    isaMaturityYm: ymSchema.nullable().default(null),
  })
  .transform((data) => ({
    ...data,
    accountName: data.accountName ?? null,
    institution: data.institution ?? null,
  }));

export type AccountAssetCreateInput = z.infer<typeof accountAssetCreateSchema>;

/** 첫 계좌 저장 시 함께 보내는 상세 저장 동의 — 계좌 데이터와 분리해 읽는다 */
export const detailDataConsentSchema = z.object({
  detailDataConsent: z.boolean().optional(),
});

// 부분 수정: 보낸 항목만 반영하고, 유형별 허용 항목·합계 검증은 서비스에서 병합 후 수행
export const accountAssetUpdateSchema = z
  .object({
    accountType: accountTypeSchema.optional(),
    accountName: optionalText("계좌 별칭"),
    institution: optionalText("금융사"),
    balance: wonAmount("잔액").optional(),
    principalTaxCredited: wonAmount("세액공제 원금").optional(),
    principalNonDeductible: wonAmount("비공제 원금").optional(),
    investmentGain: wonAmount("운용수익").optional(),
    deferredRetirementIncome: wonAmount("이연퇴직소득").optional(),
    irpSource: irpSourceSchema.nullable().optional(),
    pensionSavingsLegacy: legacySchema.nullable().optional(),
    isaMaturityYm: ymSchema.nullable().optional(),
  })
  .transform((data) =>
    Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    ) as Partial<AccountAssetCreateInput>,
  )
  .refine((data) => Object.keys(data).length > 0, {
    message: "업데이트할 필드가 없습니다",
  });

export type AccountAssetUpdateInput = z.infer<typeof accountAssetUpdateSchema>;
