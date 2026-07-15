import type { IUserRepo } from "../../application/contracts/user-repo.contract.js";
import { prisma } from "./prisma-client.js";

export const createUserRepo = (): IUserRepo => ({
  async findByEmail(email: string) {
    // 이메일로 사용자 조회 (비밀번호 포함)
    const user = await prisma.user.findUnique({
      where: { email },
    });

    return user
      ? {
          id: user.id,
          email: user.email,
          password: user.password,
          name: user.name,
        }
      : null;
  },

  async findById(id: number) {
    // ID로 사용자 조회 (비밀번호 제외)
    const user = await prisma.user.findUnique({
      where: { id },
    });

    return user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      : null;
  },

  async create(email: string, hashedPassword: string, name: string) {
    // 새로운 사용자 생성
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  },

  async update(id: number, data: { name?: string; password?: string }) {
    // 사용자 정보 업데이트
    const user = await prisma.user.update({
      where: { id },
      data,
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  },
});

export type UserRepoType = ReturnType<typeof createUserRepo>;
