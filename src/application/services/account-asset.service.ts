import type {
  AccountAssetData,
  AccountAssetRecord,
  AccountAssetType,
  IAccountAssetRepo,
} from "../contracts/account-asset-repo.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

export const MAX_ACCOUNT_ASSETS = 20;

type BucketField =
  | "principalTaxCredited"
  | "principalNonDeductible"
  | "investmentGain"
  | "deferredRetirementIncome";
type OptionField = "irpSource" | "pensionSavingsLegacy" | "isaMaturityYm";

const BUCKET_FIELDS: readonly BucketField[] = [
  "principalTaxCredited",
  "principalNonDeductible",
  "investmentGain",
  "deferredRetirementIncome",
];
const OPTION_FIELDS: readonly OptionField[] = [
  "irpSource",
  "pensionSavingsLegacy",
  "isaMaturityYm",
];

/** 계좌 유형별로 입력할 수 있는 과세구분·보조 항목 */
export const ACCOUNT_FIELD_RULES: Record<
  AccountAssetType,
  { buckets: readonly BucketField[]; options: readonly OptionField[] }
> = {
  DC: { buckets: ["deferredRetirementIncome"], options: [] },
  PENSION_SAVINGS: {
    buckets: ["principalTaxCredited", "principalNonDeductible", "investmentGain"],
    options: ["pensionSavingsLegacy"],
  },
  IRP: {
    buckets: [
      "principalTaxCredited",
      "principalNonDeductible",
      "investmentGain",
      "deferredRetirementIncome",
    ],
    options: ["irpSource"],
  },
  ISA: { buckets: ["investmentGain"], options: ["isaMaturityYm"] },
  BROKERAGE: { buckets: [], options: [] },
  CASH: { buckets: [], options: [] },
};

/** 유형에 맞지 않는 항목이나 잔액을 넘는 과세구분 합계를 거부한다 */
export const assertValidAccountAsset = (data: AccountAssetData): void => {
  const rule = ACCOUNT_FIELD_RULES[data.accountType];
  const invalidBucket = BUCKET_FIELDS.some(
    (field) => !rule.buckets.includes(field) && data[field] !== 0,
  );
  const invalidOption = OPTION_FIELDS.some(
    (field) => !rule.options.includes(field) && data[field] !== null,
  );
  if (invalidBucket || invalidOption) {
    throw new BusinessException(
      "ACCOUNT_ASSET_FIELD_NOT_ALLOWED",
      "선택한 계좌 유형에서 입력할 수 없는 항목이 있습니다",
      400,
    );
  }
  const bucketSum = BUCKET_FIELDS.reduce((sum, field) => sum + data[field], 0);
  if (bucketSum > data.balance) {
    throw new BusinessException(
      "ACCOUNT_ASSET_BUCKET_EXCEEDS_BALANCE",
      "과세구분 금액의 합계가 잔액보다 클 수 없습니다",
      400,
    );
  }
};

export const createAccountAssetService = (accountAssetRepo: IAccountAssetRepo) => {
  const assertOwned = (
    asset: AccountAssetRecord | null,
    userId: number,
  ): AccountAssetRecord => {
    if (!asset) {
      throw new BusinessException("ACCOUNT_ASSET_NOT_FOUND", "계좌를 찾을 수 없습니다", 404);
    }
    if (asset.userId !== userId) {
      throw new BusinessException("ACCOUNT_ASSET_FORBIDDEN", "접근 권한이 없습니다", 403);
    }
    return asset;
  };

  return {
    async list(userId: number): Promise<AccountAssetRecord[]> {
      return accountAssetRepo.findByUserId(userId);
    },

    async create(
      userId: number,
      data: AccountAssetData,
      options: { detailDataConsent?: boolean } = {},
    ): Promise<AccountAssetRecord> {
      assertValidAccountAsset(data);
      const count = await accountAssetRepo.countByUserId(userId);
      if (count >= MAX_ACCOUNT_ASSETS) {
        throw new BusinessException(
          "ACCOUNT_ASSET_LIMIT",
          `계좌는 최대 ${MAX_ACCOUNT_ASSETS}개까지 등록할 수 있습니다`,
          400,
        );
      }
      // 첫 계좌 저장 전에는 상세 저장 동의가 필요 (기존 계좌 보유자는 그대로 허용)
      if (count === 0) {
        const consentAt = await accountAssetRepo.findDetailDataConsentAt(userId);
        if (!consentAt && !options.detailDataConsent) {
          throw new BusinessException(
            "CONSENT_REQUIRED",
            "계좌 잔액·과세구분 저장에 동의해 주세요",
            400,
          );
        }
        if (!consentAt) await accountAssetRepo.recordDetailDataConsent(userId, new Date());
      }
      return accountAssetRepo.create(userId, data);
    },

    async update(
      id: number,
      userId: number,
      patch: Partial<AccountAssetData>,
    ): Promise<AccountAssetRecord> {
      if (Object.keys(patch).length === 0) {
        throw new BusinessException("INVALID_UPDATE", "업데이트할 필드가 없습니다", 400);
      }
      const existing = assertOwned(await accountAssetRepo.findById(id), userId);
      const merged: AccountAssetData = {
        accountType: existing.accountType,
        accountName: existing.accountName,
        institution: existing.institution,
        balance: existing.balance,
        principalTaxCredited: existing.principalTaxCredited,
        principalNonDeductible: existing.principalNonDeductible,
        investmentGain: existing.investmentGain,
        deferredRetirementIncome: existing.deferredRetirementIncome,
        irpSource: existing.irpSource,
        pensionSavingsLegacy: existing.pensionSavingsLegacy,
        isaMaturityYm: existing.isaMaturityYm,
        ...patch,
      };
      assertValidAccountAsset(merged);
      return accountAssetRepo.update(id, merged);
    },

    async delete(id: number, userId: number): Promise<void> {
      assertOwned(await accountAssetRepo.findById(id), userId);
      await accountAssetRepo.delete(id);
    },

    async deleteAll(userId: number): Promise<number> {
      return accountAssetRepo.deleteByUserId(userId);
    },
  };
};

export type AccountAssetServiceType = ReturnType<typeof createAccountAssetService>;
