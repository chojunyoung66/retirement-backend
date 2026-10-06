import { DEFAULT_REPORT_PRICE, parsePaymentConfig } from "./payment-config.js";

describe("parsePaymentConfig", () => {
  it("기본값은 결제 꺼짐·9,900원", () => {
    expect(parsePaymentConfig({})).toEqual({ enabled: false, price: DEFAULT_REPORT_PRICE });
    expect(DEFAULT_REPORT_PRICE).toBe(9900);
  });

  it("true일 때만 켜고 가격을 읽는다", () => {
    expect(parsePaymentConfig({ REPORT_PAYMENT_ENABLED: "TRUE", REPORT_PRICE: "14900" })).toEqual({
      enabled: true,
      price: 14900,
    });
    expect(parsePaymentConfig({ REPORT_PAYMENT_ENABLED: "1" }).enabled).toBe(false);
  });

  it.each(["0", "99.5", "abc", "-100", "2000000"])("잘못된 가격(%s)이면 서버를 띄우지 않는다", (price) => {
    expect(() => parsePaymentConfig({ REPORT_PRICE: price })).toThrow("REPORT_PRICE");
  });
});
