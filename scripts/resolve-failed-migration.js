import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const count = await prisma.$executeRawUnsafe(
    "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '20260729075647_split_pension_fields'"
  );
  console.log(`[resolve] deleted ${count} failed migration record(s)`);
} catch (e) {
  console.log("[resolve] skip:", e.message);
} finally {
  await prisma.$disconnect();
}
