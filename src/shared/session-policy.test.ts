import {
  IDLE_TIMEOUT_MS,
  ABSOLUTE_TIMEOUT_MS,
  createAuthTokenPayload,
  resolveSessionStartedAtMs,
  remainingAbsoluteMs,
  nextIdleTtlMs,
} from "./session-policy.js";

describe("session-policy", () => {
  it("해피패스: 로그인 직후 nextIdleTtlMs는 유휴 30분", () => {
    const started = 1_700_000_000_000;
    expect(nextIdleTtlMs(started, started)).toBe(IDLE_TIMEOUT_MS);
  });

  it("절대 만료 임박 시 TTL은 잔여 시간으로 줄어든다", () => {
    const started = 1_700_000_000_000;
    const now = started + ABSOLUTE_TIMEOUT_MS - 5 * 60 * 1000;
    expect(nextIdleTtlMs(started, now)).toBe(5 * 60 * 1000);
  });

  it("절대 만료 이후 remainingAbsoluteMs는 0 이하", () => {
    const started = 1_700_000_000_000;
    const now = started + ABSOLUTE_TIMEOUT_MS + 1;
    expect(remainingAbsoluteMs(started, now)).toBeLessThanOrEqual(0);
  });

  it("createAuthTokenPayload에 sessionStartedAt이 포함된다", () => {
    const payload = createAuthTokenPayload(1, "a@b.com", 123);
    expect(payload).toEqual({
      userId: 1,
      email: "a@b.com",
      sessionStartedAt: 123,
    });
  });

  it("resolveSessionStartedAtMs는 sessionStartedAt을 우선한다", () => {
    expect(
      resolveSessionStartedAtMs({
        sessionStartedAt: 1000,
        iat: 999,
      }),
    ).toBe(1000);
  });
});
