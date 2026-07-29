import pg from "pg";

const MIGRATION_NAME = "20260729075647_split_pension_fields";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[resolve] DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });

try {
  // 실패한 마이그레이션 레코드 제거 후 migrate deploy가 재적용하도록 함
  const result = await pool.query(
    `DELETE FROM "_prisma_migrations" WHERE migration_name = $1`,
    [MIGRATION_NAME],
  );
  console.log(
    `[resolve] deleted ${result.rowCount ?? 0} failed migration record(s) for ${MIGRATION_NAME}`,
  );
} catch (error) {
  console.error("[resolve] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await pool.end();
}
