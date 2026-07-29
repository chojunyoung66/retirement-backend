import type { IUserRepo } from "../../application/contracts/user-repo.contract.js";
import { prisma } from "./prisma-client.js";

const toAuthRecord = (user: {
  id: number;
  email: string;
  password: string | null;
  name: string;
  googleSub: string | null;
  profileImage: string | null;
}) => ({
  id: user.id,
  email: user.email,
  password: user.password,
  name: user.name,
  googleSub: user.googleSub,
  profileImage: user.profileImage,
});

export const createUserRepo = (): IUserRepo => ({
  async findByEmail(email: string) {
    // 이메일로 사용자 조회 (비밀번호·googleSub 포함)
    const user = await prisma.user.findUnique({ where: { email } });
    return user ? toAuthRecord(user) : null;
  },

  async findByGoogleSub(googleSub: string) {
    // Google sub로 사용자 조회
    const user = await prisma.user.findUnique({ where: { googleSub } });
    return user ? toAuthRecord(user) : null;
  },

  async findById(id: number) {
    // ID로 사용자 조회 (비밀번호 제외)
    const user = await prisma.user.findUnique({ where: { id } });
    return user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
          profileImage: user.profileImage,
        }
      : null;
  },

  async create(email: string, hashedPassword: string, name: string) {
    // 이메일·비밀번호 사용자 생성
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name },
    });
    return { id: user.id, email: user.email, name: user.name };
  },

  async createGoogleUser(data) {
    // Google 전용 사용자 생성 (password null)
    const user = await prisma.user.create({
      data: {
        email: data.email,
        googleSub: data.googleSub,
        name: data.name,
        profileImage: data.profileImage,
        password: null,
      },
    });
    return toAuthRecord(user);
  },

  async update(id: number, data) {
    // 사용자 정보 업데이트 (googleSub 연결 포함)
    const user = await prisma.user.update({
      where: { id },
      data,
    });
    return { id: user.id, email: user.email, name: user.name };
  },
});

export type UserRepoType = ReturnType<typeof createUserRepo>;
