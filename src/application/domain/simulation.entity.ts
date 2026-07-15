import { BusinessException } from "../../shared/exceptions/business.exception.js";

export type SimulationType =
  | "HEALTH_INSURANCE"
  | "ISA"
  | "NATIONAL_PENSION"
  | "IRP"
  | "SEVERANCE_PAY";

export interface SimulationResultData {
  userId: number;
  type: SimulationType;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
}

export interface SimulationProfile extends SimulationResultData {
  id: number;
  createdAt: Date;
}

export const createSimulationEntity = (
  id: number,
  userId: number,
  type: SimulationType,
  inputData: Record<string, unknown>,
  outputData: Record<string, unknown>,
  createdAt: Date,
) => {
  // 시뮬레이션 유효성 검증
  validateSimulation(userId, type, inputData, outputData);

  return {
    // 시뮬레이션 ID 반환
    getId: () => id,

    // 사용자 ID 반환
    getUserId: () => userId,

    // 시뮬레이션 타입 반환
    getType: () => type,

    // 입력 데이터 반환
    getInputData: (): Record<string, unknown> => ({ ...inputData }),

    // 출력 데이터 반환
    getOutputData: (): Record<string, unknown> => ({ ...outputData }),

    // 생성 일시 반환
    getCreatedAt: () => new Date(createdAt),

    // 프로필 반환
    getProfile: (): SimulationProfile => ({
      id,
      userId,
      type,
      inputData: { ...inputData },
      outputData: { ...outputData },
      createdAt: new Date(createdAt),
    }),

    // 시뮬레이션이 건강보험인지 확인
    isHealthInsurance: (): boolean => type === "HEALTH_INSURANCE",

    // 시뮬레이션이 ISA인지 확인
    isIsa: (): boolean => type === "ISA",

    // 시뮬레이션이 국민연금인지 확인
    isNationalPension: (): boolean => type === "NATIONAL_PENSION",

    // 시뮬레이션이 IRP인지 확인
    isIrp: (): boolean => type === "IRP",

    // 시뮬레이션이 퇴직금인지 확인
    isSeverancePay: (): boolean => type === "SEVERANCE_PAY",

    // 입력 데이터에서 특정 필드 조회
    getInputValue: (key: string): unknown => inputData[key],

    // 출력 데이터에서 특정 필드 조회
    getOutputValue: (key: string): unknown => outputData[key],
  };
};

// 시뮬레이션 유효성 검증
const validateSimulation = (
  userId: number,
  type: SimulationType,
  inputData: Record<string, unknown>,
  outputData: Record<string, unknown>,
) => {
  // 사용자 ID 검증
  if (userId <= 0) {
    throw new BusinessException(
      "INVALID_USER_ID",
      "유효하지 않은 사용자 ID입니다",
      400,
    );
  }

  // 시뮬레이션 타입 검증
  const validTypes: SimulationType[] = [
    "HEALTH_INSURANCE",
    "ISA",
    "NATIONAL_PENSION",
    "IRP",
    "SEVERANCE_PAY",
  ];
  if (!validTypes.includes(type)) {
    throw new BusinessException(
      "INVALID_SIMULATION_TYPE",
      "유효하지 않은 시뮬레이션 타입입니다",
      400,
    );
  }

  // 입력 데이터 검증
  if (
    !inputData ||
    typeof inputData !== "object" ||
    Object.keys(inputData).length === 0
  ) {
    throw new BusinessException(
      "INVALID_INPUT_DATA",
      "입력 데이터는 필수입니다",
      400,
    );
  }

  // 출력 데이터 검증
  if (
    !outputData ||
    typeof outputData !== "object" ||
    Object.keys(outputData).length === 0
  ) {
    throw new BusinessException(
      "INVALID_OUTPUT_DATA",
      "출력 데이터는 필수입니다",
      400,
    );
  }
};

export type SimulationEntityType = ReturnType<typeof createSimulationEntity>;
