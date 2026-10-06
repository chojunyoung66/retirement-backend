import { createTossPaymentGateway } from "./toss-payment.gateway.js";
import { PaymentGatewayError } from "../../application/contracts/payment-gateway.contract.js";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("TossPaymentGateway", () => {
  it("승인 API를 시크릿 키 Basic 인증으로 호출하고 결과를 변환한다", async () => {
    const fetchMock = jest.fn(async () =>
      jsonResponse(200, {
        paymentKey: "pk_1",
        orderId: "rpt_1",
        status: "DONE",
        totalAmount: 9900,
        method: "간편결제",
        approvedAt: "2026-10-06T10:00:00+09:00",
        receipt: { url: "https://receipt" },
      }),
    );
    const gateway = createTossPaymentGateway("test_sk_abc", fetchMock as unknown as typeof fetch);
    const result = await gateway.confirm({ paymentKey: "pk_1", orderId: "rpt_1", amount: 9900 });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.tosspayments.com/v1/payments/confirm");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("test_sk_abc:").toString("base64")}`,
    );
    expect(JSON.parse(init.body as string)).toEqual({ paymentKey: "pk_1", orderId: "rpt_1", amount: 9900 });
    expect(result).toEqual({
      paymentKey: "pk_1",
      orderId: "rpt_1",
      status: "DONE",
      totalAmount: 9900,
      method: "간편결제",
      approvedAt: new Date("2026-10-06T01:00:00.000Z"),
      receiptUrl: "https://receipt",
    });
  });

  it("오류 응답은 결제사 코드를 담은 PaymentGatewayError로 던진다", async () => {
    const fetchMock = jest.fn(async () => jsonResponse(400, { code: "INVALID_CARD", message: "카드 오류" }));
    const gateway = createTossPaymentGateway("test_sk", fetchMock as unknown as typeof fetch);
    const error = await gateway.confirm({ paymentKey: "pk", orderId: "rpt_1", amount: 1 }).catch((e) => e);
    expect(error).toBeInstanceOf(PaymentGatewayError);
    expect(error).toMatchObject({ code: "INVALID_CARD", message: "카드 오류" });
  });

  it("네트워크 오류는 502 기술 예외로 바꾼다", async () => {
    const fetchMock = jest.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const gateway = createTossPaymentGateway("test_sk", fetchMock as unknown as typeof fetch);
    await expect(gateway.getPayment("pk")).rejects.toMatchObject({
      code: "PAYMENT_GATEWAY_UNAVAILABLE",
      statusCode: 502,
    });
  });

  it("취소는 멱등 키를 붙여 호출하고 마지막 취소 시각을 돌려준다", async () => {
    const fetchMock = jest.fn(async () =>
      jsonResponse(200, { cancels: [{ canceledAt: "2026-10-07T00:00:00Z" }] }),
    );
    const gateway = createTossPaymentGateway("test_sk", fetchMock as unknown as typeof fetch);
    const result = await gateway.cancel("pk/1", "고객 요청");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.tosspayments.com/v1/payments/pk%2F1/cancel");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("cancel-pk/1");
    expect(result.canceledAt).toEqual(new Date("2026-10-07T00:00:00Z"));
  });
});
