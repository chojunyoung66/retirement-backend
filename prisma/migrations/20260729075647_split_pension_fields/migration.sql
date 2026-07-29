-- Step 1: nullable로 컬럼 추가 (이미 있으면 건너뜀)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Diagnosis' AND column_name = 'nationalPension'
  ) THEN
    ALTER TABLE "Diagnosis" ADD COLUMN "nationalPension" INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Diagnosis' AND column_name = 'retirementPension'
  ) THEN
    ALTER TABLE "Diagnosis" ADD COLUMN "retirementPension" INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Diagnosis' AND column_name = 'personalPension'
  ) THEN
    ALTER TABLE "Diagnosis" ADD COLUMN "personalPension" INTEGER;
  END IF;
END $$;

-- Step 2: monthlyIncome이 남아 있을 때만 이관 (이미 DROP된 재실행 대비)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Diagnosis' AND column_name = 'monthlyIncome'
  ) THEN
    UPDATE "Diagnosis"
    SET
      "nationalPension" = COALESCE("monthlyIncome", 0),
      "retirementPension" = COALESCE("retirementPension", 0),
      "personalPension" = COALESCE("personalPension", 0)
    WHERE "nationalPension" IS NULL;
  ELSE
    -- monthlyIncome 없음: null만 0으로 채움
    UPDATE "Diagnosis"
    SET
      "nationalPension" = COALESCE("nationalPension", 0),
      "retirementPension" = COALESCE("retirementPension", 0),
      "personalPension" = COALESCE("personalPension", 0)
    WHERE "nationalPension" IS NULL
       OR "retirementPension" IS NULL
       OR "personalPension" IS NULL;
  END IF;
END $$;

-- Step 3: NOT NULL 제약 (이미 NOT NULL이면 무해)
ALTER TABLE "Diagnosis" ALTER COLUMN "nationalPension" SET NOT NULL;
ALTER TABLE "Diagnosis" ALTER COLUMN "retirementPension" SET NOT NULL;
ALTER TABLE "Diagnosis" ALTER COLUMN "personalPension" SET NOT NULL;

-- Step 4: 기존 컬럼 제거 (이미 없으면 건너뜀)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Diagnosis' AND column_name = 'monthlyIncome'
  ) THEN
    ALTER TABLE "Diagnosis" DROP COLUMN "monthlyIncome";
  END IF;
END $$;
