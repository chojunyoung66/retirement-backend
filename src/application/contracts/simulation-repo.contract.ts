export type SimulationType =
  | "HEALTH_INSURANCE"
  | "ISA"
  | "NATIONAL_PENSION"
  | "IRP"
  | "SEVERANCE_PAY"
  | "UNEMPLOYMENT_BENEFIT";

export interface SimulationResultData {
  userId: number;
  type: SimulationType;
  version: number;
  status: string;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
}

export interface ISimulationRepo {
  findLatestByUserId(userId: number, type: SimulationType): Promise<(SimulationResultData & { id: number; createdAt: Date }) | null>;
  findByUserId(userId: number, type: SimulationType, limit?: number): Promise<(SimulationResultData & { id: number; createdAt: Date })[]>;
  findById(id: number): Promise<(SimulationResultData & { id: number; createdAt: Date }) | null>;
  create(userId: number, type: SimulationType, inputData: Record<string, unknown>, outputData: Record<string, unknown>): Promise<SimulationResultData & { id: number }>;
  update(id: number, data: Partial<Omit<SimulationResultData, "userId">>): Promise<SimulationResultData & { id: number }>;
}
