-- RetirementGoal은 이후(또는 타임스탬프 정렬상 선행) drop 마이그레이션으로 제거됨.
-- 빈 DB 재적용 시 테이블이 없으면 no-op.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'RetirementGoal'
  ) THEN
    ALTER TABLE "RetirementGoal"
      ADD COLUMN IF NOT EXISTS "personalPension" INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;
