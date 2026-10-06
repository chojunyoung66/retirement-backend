export interface PaymentApproval {
  paymentKey: string;
  orderId: string;
  /** 결제사 상태 — 승인 완료는 DONE */
  status: string;
  totalAmount: number;
  method: string | null;
  approvedAt: Date | null;
  receiptUrl: string | null;
}

/** 결제사가 거절한 요청 — code는 결제사 오류 코드 그대로 */
export class PaymentGatewayError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "PaymentGatewayError";
  }
}

export interface IPaymentGateway {
  confirm(input: { paymentKey: string; orderId: string; amount: number }): Promise<PaymentApproval>;
  getPayment(paymentKey: string): Promise<PaymentApproval>;
  cancel(paymentKey: string, reason: string): Promise<{ canceledAt: Date }>;
}
