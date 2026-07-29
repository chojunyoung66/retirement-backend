-- Step 1: nullable로 컬럼 추가 (이미 있으면 건너뜀)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Diagnosis' AND column_name = 'nationalPension'
  ) THEN
    ALTER TABLE "Diagnosis" ADD COLUMN "nationalPension" INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Diagnosis' AND column_name = 'retirementPension'
  ) THEN
    ALTER TABLE "Diagnosis" ADD COLUMN "retirementPension" INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Diagnosis' AND column_name = 'personalPension'
  ) THEN
    ALTER TABLE "Diagnosis" ADD COLUMN "personalPension" INTEGER;
  END IF;
END $$;

-- Step 2: 기존 monthlyIncome 데이터 이관 (null인 행만)
UPDATE "Diagnosis"
SET
  "nationalPension" = COALESCE("monthlyIncome", 0),
  "retirementPension" = 0,
  "personalPension" = 0
WHERE "nationalPension" IS NULL;

-- Step 3: NOT NULL 제약 추가
ALTER TABLE "Diagnosis" ALTER COLUMN "nationalPension" SET NOT NULL;
ALTER TABLE "Diagnosis" ALTER COLUMN "retirementPension" SET NOT NULL;
ALTER TABLE "Diagnosis" ALTER COLUMN "personalPension" SET NOT NULL;

-- Step 4: 기존 컬럼 제거 (이미 없으면 건너뜀)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Diagnosis' AND column_name = 'monthlyIncome'
  ) THEN
    ALTER TABLE "Diagnosis" DROP COLUMN "monthlyIncome";
  END IF;
END $$;
