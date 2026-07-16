import type {
  ISimulationRepo,
  SimulationResultData,
} from "../contracts/simulation-repo.contract.js";
import { BusinessException } from "../../shared/exceptions/business.exception.js";

export interface SimulationResult extends SimulationResultData {
  id: number;
  createdAt: Date;
}

export const createSimulationService = (simulationRepo: ISimulationRepo) => ({
  async createHealthInsurance(
    userId: number,
    inputData: Record<string, unknown>,
    outputData: Record<string, unknown>,
  ): Promise<SimulationResult> {
    // 건강보험 시뮬레이션 저장: 타입별 구분으로 데이터 정합성 보장
    const created = await simulationRepo.create(
      userId,
      "HEALTH_INSURANCE",
      inputData,
      outputData,
    );

    return created as SimulationResult;
  },

  async getLatestHealthInsurance(userId: number): Promise<SimulationResult> {
    // 최신 건강보험 시뮬레이션 조회: 타입 필터로 건강보험만 검색
    const latest = await simulationRepo.findLatestByUserId(
      userId,
      "HEALTH_INSURANCE",
    );
    if (!latest) {
      throw new BusinessException(
        "HEALTH_INSURANCE_SIMULATION_NOT_FOUND",
        "건강보험 시뮬레이션을 찾을 수 없습니다",
        404,
      );
    }

    return latest as SimulationResult;
  },

  async createIsa(
    userId: number,
    inputData: Record<string, unknown>,
    outputData: Record<string, unknown>,
  ): Promise<SimulationResult> {
    // ISA 시뮬레이션 저장: 타입별 구분으로 데이터 정합성 보장
    const created = await simulationRepo.create(
      userId,
      "ISA",
      inputData,
      outputData,
    );

    return created as SimulationResult;
  },

  async getLatestIsa(userId: number): Promise<SimulationResult> {
    // 최신 ISA 시뮬레이션 조회: 타입 필터로 ISA만 검색
    const latest = await simulationRepo.findLatestByUserId(userId, "ISA");
    if (!latest) {
      throw new BusinessException(
        "ISA_SIMULATION_NOT_FOUND",
        "ISA 시뮬레이션을 찾을 수 없습니다",
        404,
      );
    }

    return latest as SimulationResult;
  },

  async createNationalPension(
    userId: number,
    inputData: Record<string, unknown>,
    outputData: Record<string, unknown>,
  ): Promise<SimulationResult> {
    // 국민연금 시뮬레이션 저장: 타입별 구분으로 데이터 정합성 보장
    const created = await simulationRepo.create(
      userId,
      "NATIONAL_PENSION",
      inputData,
      outputData,
    );

    return created as SimulationResult;
  },

  async getLatestNationalPension(userId: number): Promise<SimulationResult> {
    // 최신 국민연금 시뮬레이션 조회: 타입 필터로 국민연금만 검색
    const latest = await simulationRepo.findLatestByUserId(
      userId,
      "NATIONAL_PENSION",
    );
    if (!latest) {
      throw new BusinessException(
        "NATIONAL_PENSION_SIMULATION_NOT_FOUND",
        "국민연금 시뮬레이션을 찾을 수 없습니다",
        404,
      );
    }

    return latest as SimulationResult;
  },

  async createIrp(
    userId: number,
    inputData: Record<string, unknown>,
    outputData: Record<string, unknown>,
  ): Promise<SimulationResult> {
    // IRP 시뮬레이션 저장: 타입별 구분으로 데이터 정합성 보장
    const created = await simulationRepo.create(
      userId,
      "IRP",
      inputData,
      outputData,
    );

    return created as SimulationResult;
  },

  async getLatestIrp(userId: number): Promise<SimulationResult> {
    // 최신 IRP 시뮬레이션 조회: 타입 필터로 IRP만 검색
    const latest = await simulationRepo.findLatestByUserId(userId, "IRP");
    if (!latest) {
      throw new BusinessException(
        "IRP_SIMULATION_NOT_FOUND",
        "IRP 시뮬레이션을 찾을 수 없습니다",
        404,
      );
    }

    return latest as SimulationResult;
  },

  async createSeverancePay(
    userId: number,
    inputData: Record<string, unknown>,
    outputData: Record<string, unknown>,
  ): Promise<SimulationResult> {
    // 퇴직금 시뮬레이션 저장: 타입별 구분으로 데이터 정합성 보장
    const created = await simulationRepo.create(
      userId,
      "SEVERANCE_PAY",
      inputData,
      outputData,
    );

    return created as SimulationResult;
  },

  async getLatestSeverancePay(userId: number): Promise<SimulationResult> {
    // 최신 퇴직금 시뮬레이션 조회: 타입 필터로 퇴직금만 검색
    const latest = await simulationRepo.findLatestByUserId(
      userId,
      "SEVERANCE_PAY",
    );
    if (!latest) {
      throw new BusinessException(
        "SEVERANCE_PAY_SIMULATION_NOT_FOUND",
        "퇴직금 시뮬레이션을 찾을 수 없습니다",
        404,
      );
    }

    return latest as SimulationResult;
  },

  async updateSimulation(
    id: number,
    data: { status: string },
  ): Promise<SimulationResult> {
    // 존재 여부 확인
    const existing = await simulationRepo.findById(id);
    if (!existing) {
      throw new BusinessException(
        "SIMULATION_NOT_FOUND",
        "시뮬레이션을 찾을 수 없습니다",
        404,
      );
    }

    // 허용된 status 값 검증
    const allowedStatuses = ["draft", "confirmed"];
    if (!allowedStatuses.includes(data.status)) {
      throw new BusinessException(
        "INVALID_STATUS",
        `status는 ${allowedStatuses.join(", ")} 중 하나여야 합니다`,
        400,
      );
    }

    const updated = await simulationRepo.update(id, data);
    return updated as SimulationResult;
  },

  async getSimulationById(
    id: number,
    userId: number,
  ): Promise<SimulationResult> {
    // ID로 시뮬레이션 단건 조회
    const simulation = await simulationRepo.findById(id);
    if (!simulation) {
      throw new BusinessException(
        "SIMULATION_NOT_FOUND",
        "시뮬레이션을 찾을 수 없습니다",
        404,
      );
    }
    // 요청자 소유권 검증
    if (simulation.userId !== userId) {
      throw new BusinessException(
        "SIMULATION_FORBIDDEN",
        "접근 권한이 없습니다",
        403,
      );
    }
    return simulation as SimulationResult;
  },

  async deleteSimulation(id: number, userId: number): Promise<void> {
    // 존재 여부 확인
    const existing = await simulationRepo.findById(id);
    if (!existing) {
      throw new BusinessException(
        "SIMULATION_NOT_FOUND",
        "시뮬레이션을 찾을 수 없습니다",
        404,
      );
    }
    // 요청자 소유권 검증
    if (existing.userId !== userId) {
      throw new BusinessException(
        "SIMULATION_FORBIDDEN",
        "접근 권한이 없습니다",
        403,
      );
    }
    await simulationRepo.delete(id);
  },

  async createUnemploymentBenefit(
    userId: number,
    inputData: Record<string, unknown>,
    outputData: Record<string, unknown>,
  ): Promise<SimulationResult> {
    // 실업급여 시뮬레이션 저장: 타입별 구분으로 데이터 정합성 보장
    const created = await simulationRepo.create(
      userId,
      "UNEMPLOYMENT_BENEFIT",
      inputData,
      outputData,
    );

    return created as SimulationResult;
  },

  async getLatestUnemploymentBenefit(
    userId: number,
  ): Promise<SimulationResult> {
    // 최신 실업급여 시뮬레이션 조회: 타입 필터로 실업급여만 검색
    const latest = await simulationRepo.findLatestByUserId(
      userId,
      "UNEMPLOYMENT_BENEFIT",
    );
    if (!latest) {
      throw new BusinessException(
        "UNEMPLOYMENT_BENEFIT_SIMULATION_NOT_FOUND",
        "실업급여 시뮬레이션을 찾을 수 없습니다",
        404,
      );
    }

    return latest as SimulationResult;
  },
});

export type SimulationServiceType = ReturnType<typeof createSimulationService>;
