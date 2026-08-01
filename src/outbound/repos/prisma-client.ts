import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

let prismaInstance: PrismaClient | undefined;

export const getPrismaClient = (): PrismaClient => {
  if (prismaInstance) {
    return prismaInstance;
  }

  if (globalForPrisma.prisma) {
    prismaInstance = globalForPrisma.prisma;
    return prismaInstance;
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Render External DB는 SSL 필수 — Pool에 미설정 시 signin 등 DB 호출이 500으로 실패
  const isLocal = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");
  prismaInstance = new PrismaClient({
    adapter: new PrismaPg(
      new Pool({
        connectionString: dbUrl,
        ssl: isLocal ? false : { rejectUnauthorized: false },
      }),
    ),
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "stdout", level: "query" },
            { emit: "stdout", level: "error" },
            { emit: "stdout", level: "warn" },
          ]
        : [{ emit: "stdout", level: "error" }],
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaInstance;
  }

  return prismaInstance;
};

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrismaClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
