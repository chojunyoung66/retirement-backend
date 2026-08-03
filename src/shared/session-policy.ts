/** 금융 인접 MVP: 유휴 30분 + 절대 12시간 (KISA 저위험·NIST L2 idle 상한 참고) */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
export const IDLE_EXPIRES_IN = "30m";

export type AuthTokenPayload = {
  userId: number;
  email: string;
  sessionStartedAt: number;
};

/** 로그인·연동 시 JWT 페이로드 생성 */
export function createAuthTokenPayload(
  userId: number,
  email: string,
  nowMs: number = Date.now(),
): AuthTokenPayload {
  return { userId, email, sessionStartedAt: nowMs };
}

/** 절대 만료 기산 — sessionStartedAt 우선, 없으면 iat(초) */
export function resolveSessionStartedAtMs(
  payload: Record<string, unknown>,
): number {
  if (typeof payload.sessionStartedAt === "number") {
    return payload.sessionStartedAt;
  }
  if (typeof payload.iat === "number") {
    return payload.iat * 1000;
  }
  return Date.now();
}

/** 절대 만료까지 남은 ms (이미 만료면 0 이하) */
export function remainingAbsoluteMs(
  sessionStartedAtMs: number,
  nowMs: number = Date.now(),
): number {
  return sessionStartedAtMs + ABSOLUTE_TIMEOUT_MS - nowMs;
}

/** 다음 슬라이딩 TTL — 유휴 한도와 절대 잔여 중 짧은 쪽 */
export function nextIdleTtlMs(
  sessionStartedAtMs: number,
  nowMs: number = Date.now(),
): number {
  const remaining = remainingAbsoluteMs(sessionStartedAtMs, nowMs);
  return Math.min(IDLE_TIMEOUT_MS, Math.max(0, remaining));
}
