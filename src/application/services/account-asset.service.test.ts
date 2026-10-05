import {
  assertValidAccountAsset,
  createAccountAssetService,
  MAX_ACCOUNT_ASSETS,
} from "./account-asset.service.js";
import type {
  AccountAssetData,
  AccountAssetRecord,
  IAccountAssetRepo,
} from "../contracts/account-asset-repo.contract.js";

const data = (overrides: Partial<AccountAssetData> = {}): AccountAssetData => ({
  accountType: "PENSION_SAVINGS",
  accountName: null,
  institution: null,
  balance: 10_000_000,
  principalTaxCredited: 6_000_000,
  principalNonDeductible: 2_000_000,
  investmentGain: 1_000_000,
  deferredRetirementIncome: 0,
  irpSource: null,
  pensionSavingsLegacy: null,
  isaMaturityYm: null,
  ...overrides,
});

const record = (overrides: Partial<AccountAssetRecord> = {}): AccountAssetRecord => ({
  ...data(),
  id: 1,
  userId: 1,
  verifiedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockRepo = (): { [K in keyof IAccountAssetRepo]: jest.Mock } => ({
  findByUserId: jest.fn(),
  findById: jest.fn(),
  countByUserId: jest.fn().mockResolvedValue(0),
  create: jest.fn().mockImplementation(async (userId, d) => record({ ...d, userId })),
  update: jest.fn().mockImplementation(async (id, d) => record({ ...d, id })),
  delete: jest.fn(),
  deleteByUserId: jest.fn(),
  findDetailDataConsentAt: jest.fn().mockResolvedValue(new Date("2026-10-01")),
  recordDetailDataConsent: jest.fn(),
});

describe("assertValidAccountAsset", () => {
  it("유형에 맞는 과세구분 합계가 잔액 이하면 통과", () => {
    expect(() => assertValidAccountAsset(data())).not.toThrow();
  });

  it("과세구분 합계가 잔액을 넘으면 400", () => {
    expect(() => assertValidAccountAsset(data({ investmentGain: 5_000_000 }))).toThrow(
      expect.objectContaining({ code: "ACCOUNT_ASSET_BUCKET_EXCEEDS_BALANCE", statusCode: 400 }),
    );
  });

  it.each([
    data({ accountType: "CASH" }),
    data({ accountType: "DC", principalTaxCredited: 0, principalNonDeductible: 0, investmentGain: 1 }),
    data({ accountType: "PENSION_SAVINGS", irpSource: "PERSONAL" }),
    data({
      accountType: "ISA",
      principalTaxCredited: 0,
      principalNonDeductible: 0,
      pensionSavingsLegacy: true,
    }),
  ])("유형에 맞지 않는 항목은 400 (%#)", (input) => {
    expect(() => assertValidAccountAsset(input)).toThrow(
      expect.objectContaining({ code: "ACCOUNT_ASSET_FIELD_NOT_ALLOWED" }),
    );
  });
});

describe("AccountAssetService", () => {
  it(`계좌가 ${MAX_ACCOUNT_ASSETS}개면 추가할 수 없다`, async () => {
    const repo = mockRepo();
    repo.countByUserId.mockResolvedValueOnce(MAX_ACCOUNT_ASSETS);
    const service = createAccountAssetService(repo);
    await expect(service.create(1, data())).rejects.toMatchObject({
      code: "ACCOUNT_ASSET_LIMIT",
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("수정은 기존 값과 병합한 뒤 검증한다", async () => {
    const repo = mockRepo();
    repo.findById.mockResolvedValueOnce(record());
    const service = createAccountAssetService(repo);

    await expect(service.update(1, 1, { balance: 5_000_000 })).rejects.toMatchObject({
      code: "ACCOUNT_ASSET_BUCKET_EXCEEDS_BALANCE",
    });

    repo.findById.mockResolvedValueOnce(record());
    await service.update(1, 1, { balance: 20_000_000 });
    expect(repo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ balance: 20_000_000, principalTaxCredited: 6_000_000 }),
    );
  });

  it("동의 기록 없이 첫 계좌를 저장하면 CONSENT_REQUIRED 400", async () => {
    const repo = mockRepo();
    repo.findDetailDataConsentAt.mockResolvedValueOnce(null);
    const service = createAccountAssetService(repo);
    await expect(service.create(1, data())).rejects.toMatchObject({
      code: "CONSENT_REQUIRED",
      statusCode: 400,
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("첫 계좌 저장 시 동의하면 동의 시각을 기록하고 저장한다", async () => {
    const repo = mockRepo();
    repo.findDetailDataConsentAt.mockResolvedValueOnce(null);
    const service = createAccountAssetService(repo);
    await service.create(1, data(), { detailDataConsent: true });
    expect(repo.recordDetailDataConsent).toHaveBeenCalledWith(1, expect.any(Date));
    expect(repo.create).toHaveBeenCalled();
  });

  it("이미 계좌가 있는 기존 사용자는 동의 없이도 추가할 수 있다", async () => {
    const repo = mockRepo();
    repo.countByUserId.mockResolvedValueOnce(2);
    repo.findDetailDataConsentAt.mockResolvedValueOnce(null);
    const service = createAccountAssetService(repo);
    await service.create(1, data());
    expect(repo.create).toHaveBeenCalled();
    expect(repo.recordDetailDataConsent).not.toHaveBeenCalled();
  });

  it("다른 사용자의 계좌는 403, 없으면 404", async () => {
    const repo = mockRepo();
    const service = createAccountAssetService(repo);
    repo.findById.mockResolvedValueOnce(record({ userId: 2 }));
    await expect(service.delete(1, 1)).rejects.toMatchObject({ statusCode: 403 });
    repo.findById.mockResolvedValueOnce(null);
    await expect(service.delete(1, 1)).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
