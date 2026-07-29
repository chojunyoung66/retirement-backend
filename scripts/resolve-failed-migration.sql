UPDATE "_prisma_migrations"
SET "rolled_back_at" = NOW()
WHERE "migration_name" = '20260729075647_split_pension_fields'
  AND "finished_at" IS NULL
  AND "rolled_back_at" IS NULL;
