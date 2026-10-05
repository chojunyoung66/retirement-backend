-- 레거시 시뮬레이션 테이블을 SimulationResult로 통합한 뒤 더 이상 쓰지 않는다.
-- 운영 행 수를 확인하기 전까지 데이터를 보존하기 위해 DROP 대신 이름만 바꾼다.
-- User FK(ON DELETE CASCADE)는 유지되어 회원 탈퇴 시 잔여 행도 함께 삭제된다.
-- 행 수 확인 후 최종 삭제: DROP TABLE "_archived_HealthInsuranceSimulation", "_archived_IsaSimulation";

ALTER TABLE IF EXISTS "HealthInsuranceSimulation" RENAME TO "_archived_HealthInsuranceSimulation";
ALTER TABLE IF EXISTS "IsaSimulation" RENAME TO "_archived_IsaSimulation";
