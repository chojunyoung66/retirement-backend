-- AlterEnum (idempotent: 재배포·부분 적용에도 안전)
ALTER TYPE "SimulationType" ADD VALUE IF NOT EXISTS 'HOUSING_PENSION';
