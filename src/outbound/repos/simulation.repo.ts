import type { ISimulationRepo, SimulationType, SimulationResultData } from "../../application/contracts/simulation-repo.contract.js";
import { prisma } from "./prisma-client.js";
import { SimulationType as PrismaSimulationType } from "@prisma/client";

export const createSimulationRepo = (): ISimulationRepo => ({
  async findLatestByUserId(userId: number, type: SimulationType) {
    // 최신 시뮬레이션 결과 조회 (타입별)
    const latest = await prisma.simulationResult.findFirst({
      where: { userId, type: type as PrismaSimulationType },
      orderBy: { createdAt: "desc" },
    });

    return latest
      ? {
          id: latest.id,
          userId: latest.userId,
          type: latest.type as SimulationType,
          version: latest.version,
          status: latest.status,
          inputData: latest.inputData as Record<string, unknown>,
          outputData: latest.outputData as Record<string, unknown>,
          createdAt: latest.createdAt,
        }
      : null;
  },

  async findByUserId(userId: number, type: SimulationType, limit?: number) {
    // 사용자의 시뮬레이션 결과 조회 (타입별, 최신순)
    const results = await prisma.simulationResult.findMany({
      where: { userId, type: type as PrismaSimulationType },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return results.map((r) => ({
      id: r.id,
      userId: r.userId,
      type: r.type as SimulationType,
      version: r.version,
      status: r.status,
      inputData: r.inputData as Record<string, unknown>,
      outputData: r.outputData as Record<string, unknown>,
      createdAt: r.createdAt,
    }));
  },

  async findById(id: number) {
    // 시뮬레이션 단건 조회
    const result = await prisma.simulationResult.findUnique({ where: { id } });
    if (!result) return null;
    return {
      id: result.id,
      userId: result.userId,
      type: result.type as SimulationType,
      version: result.version,
      status: result.status,
      inputData: result.inputData as Record<string, unknown>,
      outputData: result.outputData as Record<string, unknown>,
      createdAt: result.createdAt,
    };
  },

  async create(userId: number, type: SimulationType, inputData: Record<string, unknown>, outputData: Record<string, unknown>) {
    // 시뮬레이션 결과 생성
    const result = await prisma.simulationResult.create({
      data: {
        userId,
        type: type as PrismaSimulationType,
        inputData: inputData as object,
        outputData: outputData as object,
      },
    });

    return {
      id: result.id,
      userId: result.userId,
      type: result.type as SimulationType,
      version: result.version,
      status: result.status,
      inputData: result.inputData as Record<string, unknown>,
      outputData: result.outputData as Record<string, unknown>,
      createdAt: result.createdAt,
    };
  },

  async update(id: number, data: Partial<Omit<SimulationResultData, "userId">>) {
    // 시뮬레이션 결과 업데이트
    const result = await prisma.simulationResult.update({
      where: { id },
      data: {
        ...data,
        ...(data.inputData !== undefined && { inputData: data.inputData as object }),
        ...(data.outputData !== undefined && { outputData: data.outputData as object }),
      },
    });

    return {
      id: result.id,
      userId: result.userId,
      type: result.type as SimulationType,
      version: result.version,
      status: result.status,
      inputData: result.inputData as Record<string, unknown>,
      outputData: result.outputData as Record<string, unknown>,
    };
  },
});

export type SimulationRepoType = ReturnType<typeof createSimulationRepo>;
