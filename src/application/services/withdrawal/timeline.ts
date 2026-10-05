const YM_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const isYm = (value: string): boolean => YM_PATTERN.test(value);

/** YYYY-MM → 0년 1월 기준 누적 월 인덱스 */
export const ymToIndex = (ym: string): number => {
  const match = YM_PATTERN.exec(ym);
  if (!match) throw new Error(`invalid ym: ${ym}`);
  return Number(match[1]) * 12 + (Number(match[2]) - 1);
};

export const indexToYm = (index: number): string => {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
};

export const addMonths = (ym: string, months: number): string =>
  indexToYm(ymToIndex(ym) + months);

export const yearOfIndex = (index: number): number => Math.floor(index / 12);

/** 해당 월의 나이 — 생월을 모르므로 연 단위(그해 1월부터 한 살 증가)로 본다 */
export const ageAtIndex = (birthYear: number, index: number): number =>
  yearOfIndex(index) - birthYear;

/** 특정 나이가 되는 첫 달(그해 1월) 인덱스 */
export const indexOfAge = (birthYear: number, age: number): number =>
  (birthYear + age) * 12;

export const currentYm = (now: Date): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

/** 연 수익률 → 월 복리 수익률 */
export const monthlyRate = (annualRate: number): number =>
  Math.pow(1 + annualRate, 1 / 12) - 1;
