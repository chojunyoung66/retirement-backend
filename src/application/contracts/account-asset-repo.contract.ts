export const ACCOUNT_ASSET_TYPES = [
  "DC",
  "PENSION_SAVINGS",
  "IRP",
  "ISA",
  "BROKERAGE",
  "CASH",
] as const;
export type AccountAssetType = (typeof ACCOUNT_ASSET_TYPES)[number];

export const IRP_SOURCES = ["PERSONAL", "SEVERANCE", "MIXED", "UNKNOWN"] as const;
export type IrpSource = (typeof IRP_SOURCES)[number];

export interface AccountAssetData {
  accountType: AccountAssetType;
  accountName: string | null;
  institution: string | null;
  balance: number;
  principalTaxCredited: number;
  principalNonDeductible: number;
  investmentGain: number;
  deferredRetirementIncome: number;
  irpSource: IrpSource | null;
  pensionSavingsLegacy: boolean | null;
  isaMaturityYm: string | null;
}

export interface AccountAssetRecord extends AccountAssetData {
  id: number;
  userId: number;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAccountAssetRepo {
  findByUserId(userId: number): Promise<AccountAssetRecord[]>;
  findById(id: number): Promise<AccountAssetRecord | null>;
  countByUserId(userId: number): Promise<number>;
  create(userId: number, data: AccountAssetData): Promise<AccountAssetRecord>;
  update(id: number, data: AccountAssetData): Promise<AccountAssetRecord>;
  delete(id: number): Promise<void>;
  deleteByUserId(userId: number): Promise<number>;
}
