import type { AccountAsset } from "@prisma/client";
import type {
  AccountAssetData,
  AccountAssetRecord,
  IAccountAssetRepo,
} from "../../application/contracts/account-asset-repo.contract.js";
import { prisma } from "./prisma-client.js";

const toRecord = (asset: AccountAsset): AccountAssetRecord => ({
  id: asset.id,
  userId: asset.userId,
  accountType: asset.accountType,
  accountName: asset.accountName,
  institution: asset.institution,
  balance: asset.balance,
  principalTaxCredited: asset.principalTaxCredited,
  principalNonDeductible: asset.principalNonDeductible,
  investmentGain: asset.investmentGain,
  deferredRetirementIncome: asset.deferredRetirementIncome,
  irpSource: asset.irpSource,
  pensionSavingsLegacy: asset.pensionSavingsLegacy,
  isaMaturityYm: asset.isaMaturityYm,
  verifiedAt: asset.verifiedAt,
  createdAt: asset.createdAt,
  updatedAt: asset.updatedAt,
});

export const createAccountAssetRepo = (): IAccountAssetRepo => ({
  async findByUserId(userId: number) {
    // 입력 순서대로 계좌 목록 조회
    const assets = await prisma.accountAsset.findMany({
      where: { userId },
      orderBy: { id: "asc" },
    });
    return assets.map(toRecord);
  },

  async findById(id: number) {
    const asset = await prisma.accountAsset.findUnique({ where: { id } });
    return asset ? toRecord(asset) : null;
  },

  async countByUserId(userId: number) {
    return prisma.accountAsset.count({ where: { userId } });
  },

  async create(userId: number, data: AccountAssetData) {
    const asset = await prisma.accountAsset.create({ data: { userId, ...data } });
    return toRecord(asset);
  },

  async update(id: number, data: AccountAssetData) {
    const asset = await prisma.accountAsset.update({ where: { id }, data });
    return toRecord(asset);
  },

  async delete(id: number) {
    await prisma.accountAsset.delete({ where: { id } });
  },

  async deleteByUserId(userId: number) {
    const { count } = await prisma.accountAsset.deleteMany({ where: { userId } });
    return count;
  },

  async findDetailDataConsentAt(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { detailDataConsentAt: true },
    });
    return user?.detailDataConsentAt ?? null;
  },

  async recordDetailDataConsent(userId: number, at: Date) {
    await prisma.user.update({ where: { id: userId }, data: { detailDataConsentAt: at } });
  },
});

export type AccountAssetRepoType = ReturnType<typeof createAccountAssetRepo>;
