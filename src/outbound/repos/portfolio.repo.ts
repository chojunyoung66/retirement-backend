import type { IPortfolioRepo, PortfolioItemData, PortfolioData } from "../../application/contracts/portfolio-repo.contract.js";
import { prisma } from "./prisma-client.js";

export const createPortfolioRepo = (): IPortfolioRepo => ({
  async findByUserId(userId: number) {
    // 사용자의 모든 포트폴리오 조회 (항목 포함)
    const portfolios = await prisma.pensionPortfolio.findMany({
      where: { userId },
      include: { items: true },
    });

    return portfolios.map((p) => ({
      id: p.id,
      userId: p.userId,
      accountType: p.accountType,
      name: p.name,
      items: p.items.map((i) => ({
        symbol: i.symbol,
        name: i.name,
        allocation: i.allocation,
      })),
    }));
  },

  async findById(id: number) {
    // 포트폴리오 단건 조회 (항목 포함)
    const portfolio = await prisma.pensionPortfolio.findUnique({
      where: { id },
      include: { items: true },
    });

    return portfolio
      ? {
          id: portfolio.id,
          userId: portfolio.userId,
          accountType: portfolio.accountType,
          name: portfolio.name,
          items: portfolio.items.map((i) => ({
            symbol: i.symbol,
            name: i.name,
            allocation: i.allocation,
          })),
        }
      : null;
  },

  async create(userId: number, accountType: string, name: string, items: PortfolioItemData[]) {
    // 포트폴리오 생성 (항목 함께 생성)
    const portfolio = await prisma.pensionPortfolio.create({
      data: {
        userId,
        accountType,
        name,
        items: {
          createMany: {
            data: items,
          },
        },
      },
      include: { items: true },
    });

    return {
      id: portfolio.id,
      userId: portfolio.userId,
      accountType: portfolio.accountType,
      name: portfolio.name,
      items: portfolio.items.map((i) => ({
        symbol: i.symbol,
        name: i.name,
        allocation: i.allocation,
      })),
    };
  },

  async update(id: number, data: Partial<PortfolioData>) {
    // 포트폴리오 업데이트 (항목 재생성)
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.accountType !== undefined) {
      updateData.accountType = data.accountType;
    }

    // 항목 업데이트: 기존 항목 삭제 후 새로 생성
    if (data.items !== undefined) {
      updateData.items = {
        deleteMany: {},
        createMany: {
          data: data.items,
        },
      };
    }

    const portfolio = await prisma.pensionPortfolio.update({
      where: { id },
      data: updateData,
      include: { items: true },
    });

    return {
      id: portfolio.id,
      userId: portfolio.userId,
      accountType: portfolio.accountType,
      name: portfolio.name,
      items: portfolio.items.map((i) => ({
        symbol: i.symbol,
        name: i.name,
        allocation: i.allocation,
      })),
    };
  },

  async delete(id: number) {
    // 포트폴리오 삭제 (항목은 cascade로 자동 삭제)
    await prisma.pensionPortfolio.delete({
      where: { id },
    });

    return true;
  },
});

export type PortfolioRepoType = ReturnType<typeof createPortfolioRepo>;
