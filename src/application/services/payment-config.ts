export interface PaymentConfig {
  /** false면 리포트를 무료로 만든다 — 중요 오류 수정 전에는 유료로 열지 않는다 */
  enabled: boolean;
  /** 리포트 1건 가격(원) */
  price: number;
}

export const DEFAULT_REPORT_PRICE = 9_900;
const MIN_PRICE = 100;
const MAX_PRICE = 1_000_000;

export const parsePaymentConfig = (env: NodeJS.ProcessEnv): PaymentConfig => {
  const enabled = env.REPORT_PAYMENT_ENABLED?.trim().toLowerCase() === "true";
  const raw = env.REPORT_PRICE?.trim();
  const price = raw ? Number(raw) : DEFAULT_REPORT_PRICE;
  if (!Number.isSafeInteger(price) || price < MIN_PRICE || price > MAX_PRICE) {
    throw new Error(`REPORT_PRICE는 ${MIN_PRICE}~${MAX_PRICE} 사이의 정수여야 합니다.`);
  }
  return { enabled, price };
};
