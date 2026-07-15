import type { ISimulationRepo, SimulationResultData } from "../contracts/simulation-repo.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

export interface SimulationResult extends SimulationResultData {
  id: number;
  createdAt: Date;
}

export const createSimulationService = (simulationRepo: ISimulationRepo) => ({
  async createHealthInsurance(
    userId: number,
    inputData: Record<string, unknown>,
    outputData: Record<string, unknown>
  ): Promise<SimulationResult> {
    // 건강보험 시뮬레이션 저장: 타입별 구분으로 데이터 정합성 보장
    const created = await simulationRepo.create(userId, "HEALTH_INSURANCE", inputData, outputData);

    return created as SimulationResult;
  },

  async getLatestHealthInsurance(userId: number): Promise<SimulationResult> {
    // 최신 건강보험 시뮬레이션 조회: 타입 필터로 건강보험만 검색
    const latest = await simulationRepo.findLatestByUserId(userId, "HEALTH_INSURANCE");
    if (!latest) {
      throw new BusinessException(
        "HEALTH_INSURANCE_SIMULATION_NOT_FOUND",
        "건강보험 시뮬레이션을 찾을 수 없습니다",
        404
      );
    }

    return latest as SimulationResult;
  },

  async createIsa(
    userId: number,
    inputData: Record<string, unknown>,
    outputData: Record<string, unknown>
  ): Promise<SimulationResult> {
    // ISA 시뮬레이션 저장: 타입별 구분으로 데이터 정합성 보장
    const created = await simulationRepo.create(userId, "ISA", inputData, outputData);

    return created as SimulationResult;
  },

  async getLatestIsa(userId: number): Promise<SimulationResult> {
    // 최신 ISA 시뮬레이션 조회: 타입 필터로 ISA만 검색
    const latest = await simulationRepo.findLatestByUserId(userId, "ISA");
    if (!latest) {
      throw new BusinessException(
        "ISA_SIMULATION_NOT_FOUND",
        "ISA 시뮬레이션을 찾을 수 없습니다",
        404
      );
    }

    return latest as SimulationResult;
  },

  async createNationalPension(
    userId: number,
    inputData: Record<string, unknown>,
    outputData: Record<string, unknown>
  ): Promise<SimulationResult> {
    // 국민연금 시뮬레이션 저장: 타입별 구분으로 데이터 정합성 보장
    const created = await simulationRepo.create(userId, "NATIONAL_PENSION", inputData, outputData);

    return created as SimulationResult;
  },

  async getLatestNationalPension(userId: number): Promise<SimulationResult> {
    // 최신 국민연금 시뮬레이션 조회: 타입 필터로 국민연금만 검색
    const latest = await simulationRepo.findLatestByUserId(userId, "NATIONAL_PENSION");
    if (!latest) {
      throw new BusinessException(
        "NATIONAL_PENSION_SIMULATION_NOT_FOUND",
        "국민연금 시뮬레이션을 찾을 수 없습니다",
        404
      );
    }

    return latest as SimulationResult;
  },

  async createIrp(
    userId: number,
    inputData: Record<string, unknown>,
    outputData: Record<string, unknown>
  ): Promise<SimulationResult> {
    // IRP 시뮬레이션 저장: 타입별 구분으로 데이터 정합성 보장
    const created = await simulationRepo.create(userId, "IRP", inputData, outputData);

    return created as SimulationResult;
  },

  async getLatestIrp(userId: number): Promise<SimulationResult> {
    // 최신 IRP 시뮬레이션 조회: 타입 필터로 IRP만 검색
    const latest = await simulationRepo.findLatestByUserId(userId, "IRP");
    if (!latest) {
      throw new BusinessException(
        "IRP_SIMULATION_NOT_FOUND",
        "IRP 시뮬레이션을 찾을 수 없습니다",
        404
      );
    }

    return latest as SimulationResult;
  },

  async createSeverancePay(
    userId: number,
    inputData: Record<string, unknown>,
    outputData: Record<string, unknown>
  ): Promise<SimulationResult> {
    // 퇴직금 시뮬레이션 저장: 타입별 구분으로 데이터 정합성 보장
    const created = await simulationRepo.create(userId, "SEVERANCE_PAY", inputData, outputData);

    return created as SimulationResult;
  },

  async getLatestSeverancePay(userId: number): Promise<SimulationResult> {
    // 최신 퇴직금 시뮬레이션 조회: 타입 필터로 퇴직금만 검색
    const latest = await simulationRepo.findLatestByUserId(userId, "SEVERANCE_PAY");
    if (!latest) {
      throw new BusinessException(
        "SEVERANCE_PAY_SIMULATION_NOT_FOUND",
        "퇴직금 시뮬레이션을 찾을 수 없습니다",
        404
      );
    }

    return latest as SimulationResult;
  },

  async createUnemploymentBenefit(
    userId: number,
    inputData: Record<string, unknown>,
    outputData: Record<string, unknown>
  ): Promise<SimulationResult> {
    // 실업급여 시뮬레이션 저장: 타입별 구분으로 데이터 정합성 보장
    const created = await simulationRepo.create(userId, "UNEMPLOYMENT_BENEFIT", inputData, outputData);

    return created as SimulationResult;
  },

  async getLatestUnemploymentBenefit(userId: number): Promise<SimulationResult> {
    // 최신 실업급여 시뮬레이션 조회: 타입 필터로 실업급여만 검색
    const latest = await simulationRepo.findLatestByUserId(userId, "UNEMPLOYMENT_BENEFIT");
    if (!latest) {
      throw new BusinessException(
        "UNEMPLOYMENT_BENEFIT_SIMULATION_NOT_FOUND",
        "실업급여 시뮬레이션을 찾을 수 없습니다",
        404
      );
    }

    return latest as SimulationResult;
  },
});

export type SimulationServiceType = ReturnType<typeof createSimulationService>;
