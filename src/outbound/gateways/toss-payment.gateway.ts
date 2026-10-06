import {
  PaymentGatewayError,
  type IPaymentGateway,
  type PaymentApproval,
} from "../../application/contracts/payment-gateway.contract.js";
import { TechnicalException } from "../../shared/exceptions/technical.exception.js";

const TOSS_PAYMENTS_API = "https://api.tosspayments.com/v1/payments";
const TIMEOUT_MS = 15_000;

interface TossPayment {
  paymentKey?: string;
  orderId?: string;
  status?: string;
  totalAmount?: number;
  method?: string | null;
  approvedAt?: string | null;
  receipt?: { url?: string | null } | null;
  cancels?: { canceledAt?: string | null }[] | null;
}

const toApproval = (payment: TossPayment): PaymentApproval => ({
  paymentKey: payment.paymentKey ?? "",
  orderId: payment.orderId ?? "",
  status: payment.status ?? "UNKNOWN",
  totalAmount: Number(payment.totalAmount ?? 0),
  method: payment.method ?? null,
  approvedAt: payment.approvedAt ? new Date(payment.approvedAt) : null,
  receiptUrl: payment.receipt?.url ?? null,
});

/** 토스페이먼츠 결제 API — 시크릿 키는 Basic 인증의 사용자명으로만 쓴다 */
export const createTossPaymentGateway = (
  secretKey: string,
  fetchImpl: typeof fetch = fetch,
): IPaymentGateway => {
  const authorization = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;

  const call = async (
    path: string,
    init: { body?: unknown; idempotencyKey?: string } = {},
  ): Promise<TossPayment> => {
    let response: Response;
    try {
      response = await fetchImpl(`${TOSS_PAYMENTS_API}${path}`, {
        method: init.body === undefined ? "GET" : "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new TechnicalException(
        "PAYMENT_GATEWAY_UNAVAILABLE",
        "결제사 응답이 없습니다. 잠시 후 다시 시도해주세요",
        502,
        error as Error,
      );
    }
    const json = (await response.json().catch(() => ({}))) as TossPayment & {
      code?: string;
      message?: string;
    };
    if (!response.ok) {
      throw new PaymentGatewayError(
        json.code ?? `HTTP_${response.status}`,
        json.message ?? "결제를 처리하지 못했습니다",
      );
    }
    return json;
  };

  return {
    async confirm({ paymentKey, orderId, amount }) {
      return toApproval(await call("/confirm", { body: { paymentKey, orderId, amount } }));
    },

    async getPayment(paymentKey) {
      return toApproval(await call(`/${encodeURIComponent(paymentKey)}`));
    },

    async cancel(paymentKey, reason) {
      const payment = await call(`/${encodeURIComponent(paymentKey)}/cancel`, {
        body: { cancelReason: reason },
        idempotencyKey: `cancel-${paymentKey}`,
      });
      const cancels = payment.cancels ?? [];
      const canceledAt = cancels[cancels.length - 1]?.canceledAt;
      return { canceledAt: canceledAt ? new Date(canceledAt) : new Date() };
    },
  };
};
