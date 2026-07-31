export interface DiagnosisData {
  householdType: string;
  birthYear: number;
  retirementYear: number;
  nationalPension: number;
  retirementPension: number;
  personalPension: number;
  monthlyExpense: number;
  healthInsurance: number;
  privateInsurance: number;
}

export interface DiagnosisRecord extends DiagnosisData {
  id: number;
  userId: number;
  updatedAt: Date;
}

export interface IDiagnosisRepo {
  findByUserId(userId: number): Promise<DiagnosisRecord | null>;
  upsert(userId: number, data: DiagnosisData): Promise<DiagnosisRecord>;
  deleteByUserId(userId: number): Promise<void>;
}
