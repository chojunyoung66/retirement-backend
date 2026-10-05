export interface DiagnosisData {
  householdType: string;
  householdSize: number;
  birthYear: number;
  retirementYear: number;
  /** 1~12, 미입력이면 null(계산 시 1월로 본다) */
  retirementMonth: number | null;
  spouseBirthYear: number | null;
  spouseRetirementYear: number | null;
  nationalPension: number;
  retirementPension: number;
  personalPension: number;
  housingPension: number;
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
