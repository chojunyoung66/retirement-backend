// 운영자 권한 부여·회수: npm run grant-operator -- <email> [--revoke]
import "dotenv/config";
import { prisma } from "../src/outbound/repos/prisma-client.js";

const args = process.argv.slice(2);
const revoke = args.includes("--revoke");
const email = args.find((arg) => !arg.startsWith("--"))?.trim().toLowerCase();

if (!email) {
  console.error("사용법: npm run grant-operator -- <email> [--revoke]");
  process.exit(1);
}

const role = revoke ? "USER" : "OPERATOR";
const { count } = await prisma.user.updateMany({ where: { email }, data: { role } });
if (count === 0) {
  console.error(`가입한 사용자를 찾을 수 없습니다: ${email}`);
  process.exitCode = 1;
} else {
  console.log(`${email} → ${role}`);
}
await prisma.$disconnect();
