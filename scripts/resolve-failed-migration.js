import { execSync } from "node:child_process";
import pg from "pg";

const MIGRATION_NAME = "20260729075647_split_pension_fields";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[resolve] DATABASE_URL is not set — skip (migrate deploy will fail if needed)");
  process.exit(0);
}

// Render Postgres는 SSL 필요
const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

async function columnExists(columnName) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'Diagnosis'
       AND column_name = $1
     LIMIT 1`,
    [columnName],
  );
  return rows.length > 0;
}

try {
  // 실패 레코드가 있을 때만 복구 — 매 배포마다 성공 레코드를 지우지 않음
  const failed = await pool.query(
    `SELECT migration_name, finished_at, rolled_back_at, logs
     FROM "_prisma_migrations"
     WHERE migration_name = $1
       AND finished_at IS NULL`,
    [MIGRATION_NAME],
  );

  if ((failed.rowCount ?? 0) === 0) {
    console.log(`[resolve] no failed record for ${MIGRATION_NAME} — skip`);
    process.exit(0);
  }

  console.log(`[resolve] found failed record for ${MIGRATION_NAME} — recovering`);

  const deleted = await pool.query(
    `DELETE FROM "_prisma_migrations" WHERE migration_name = $1 AND finished_at IS NULL`,
    [MIGRATION_NAME],
  );
  console.log(
    `[resolve] deleted ${deleted.rowCount ?? 0} failed migration record(s)`,
  );

  const hasNational = await columnExists("nationalPension");
  const hasRetirement = await columnExists("retirementPension");
  const hasPersonal = await columnExists("personalPension");
  const hasMonthlyIncome = await columnExists("monthlyIncome");

  console.log(
    `[resolve] columns national=${hasNational} retirement=${hasRetirement} personal=${hasPersonal} monthlyIncome=${hasMonthlyIncome}`,
  );

  // 스키마가 이미 목표 상태면 SQL 재실행 없이 applied 처리
  if (hasNational && hasRetirement && hasPersonal && !hasMonthlyIncome) {
    console.log(
      `[resolve] schema already matches — marking ${MIGRATION_NAME} as applied`,
    );
    execSync(`npx prisma migrate resolve --applied "${MIGRATION_NAME}"`, {
      stdio: "inherit",
      env: process.env,
    });
  } else {
    console.log(
      `[resolve] schema incomplete — migrate deploy will re-apply ${MIGRATION_NAME}`,
    );
  }
} catch (error) {
  console.error(
    "[resolve] failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
} finally {
  await pool.end();
}
