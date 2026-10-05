import {
  HEALTH_INSURANCE_RULES,
  ISA_RULES,
  NATIONAL_PENSION_RULES,
  PENSION_INCOME_TAX_RULES,
  RULE_SET_VERSION,
  SEVERANCE_TAX_RULES,
  UNEMPLOYMENT_RULES,
} from "../../rules/rule-set.js";
import { calculateHealthInsurance } from "../calculators/health-insurance.calculator.js";
import { assessDependent, type DependentAssessment } from "./dependent.js";
import { isaStrategyOf } from "./isa-transfer.js";
import {
  ACCOUNT_LABEL,
  HEALTH_NOTES,
  STRATEGIES,
  type AnnuityDef,
  type DrawStep,
  type StrategyDef,
} from "./strategies.js";
import {
  annuityMinAge,
  deferredRatioOf,
  interestTaxRate,
  isaGainTaxRate,
  isaTaxFreeLimit,
  nonAnnuityRate,
  overThresholdExtraTax,
  privatePensionRateOf,
  retirementTaxRateOf,
} from "./tax.js";
import {
  ageAtIndex,
  indexOfAge,
  indexToYm,
  monthlyRate,
  yearOfIndex,
  ymToIndex,
} from "./timeline.js";
import {
  SCENARIO_TYPES,
  type AccountCheck,
  type AccountKind,
  type EngineAccount,
  type EngineAssumptions,
  type EngineInput,
  type MonthlySeries,
  type PlanItem,
  type ScenarioResult,
  type ScenarioSetResult,
  type ScenarioType,
  type YearRow,
} from "./types.js";

export const DEFAULT_ASSUMPTIONS: EngineAssumptions = {
  inflationRate: 0.02,
  pensionGrowthRate: 0.02,
  returnRate: 0.02,
  financialYieldRate: 0.02,
  endAge: 90,
};

const PENSION_KINDS: ReadonlySet<AccountKind> = new Set([
  "DC",
  "PENSION_SAVINGS",
  "IRP",
]);

type DrawMode = "lump" | "annuity";

interface PoolStats {
  firstIndex: number | null;
  lastIndex: number | null;
  gross: number;
  tax: number;
  net: number;
  activeMonths: Set<number>;
  annuity: boolean;
  asNeeded: boolean;
  earlyNonAnnuity: boolean;
  lumpGross: number;
  lumpTax: number;
}

interface Pool {
  account: EngineAccount | null;
  kind: AccountKind;
  label: string;
  taxFree: number;
  deferred: number;
  pensionTaxable: number;
  isaGain: number;
  isaGainWithdrawn: number;
  firstAnnuityIndex: number | null;
  /** A안 일시금 처리 후 세후 현금으로 바뀐 계좌 */
  converted: boolean;
  stats: PoolStats;
}

interface TakeResult {
  gross: number;
  tax: number;
  net: number;
  annuityTaxableGross: number;
  annuityTaxableTax: number;
}

const emptyStats = (): PoolStats => ({
  firstIndex: null,
  lastIndex: null,
  gross: 0,
  tax: 0,
  net: 0,
  activeMonths: new Set(),
  annuity: false,
  asNeeded: false,
  earlyNonAnnuity: false,
  lumpGross: 0,
  lumpTax: 0,
});

const balanceOf = (pool: Pool): number =>
  pool.taxFree + pool.deferred + pool.pensionTaxable + pool.isaGain;

const knownBucketsOf = (a: EngineAccount): number =>
  a.principalTaxCredited +
  a.principalNonDeductible +
  a.investmentGain +
  a.deferredRetirementIncome;

const isSeveranceOnlyIrp = (a: EngineAccount): boolean =>
  a.accountType === "IRP" && a.irpSource === "SEVERANCE" && a.deferredRetirementIncome === 0;

/** 비공제 원금 여부를 확인해야 하는 계좌인지(퇴직금만 이전된 IRP는 전액 이연퇴직소득) */
const needsNonDeductibleCheck = (a: EngineAccount): boolean =>
  (a.accountType === "PENSION_SAVINGS" || a.accountType === "IRP") && !isSeveranceOnlyIrp(a);

const unknownAmountOf = (a: EngineAccount): number =>
  needsNonDeductibleCheck(a) ? Math.max(0, a.balance - knownBucketsOf(a)) : 0;

const initPool = (account: EngineAccount): Pool => {
  const base = {
    account,
    kind: account.accountType,
    label: account.label,
    taxFree: 0,
    deferred: 0,
    pensionTaxable: 0,
    isaGain: 0,
    isaGainWithdrawn: 0,
    firstAnnuityIndex: null,
    converted: false,
    stats: emptyStats(),
  };
  const balance = Math.max(0, account.balance);
  switch (account.accountType) {
    case "DC":
      // DC는 원금·수익 구분 없이 전액 이연퇴직소득 재원으로 본다
      return { ...base, deferred: balance };
    case "PENSION_SAVINGS": {
      const taxFree = Math.min(account.principalNonDeductible, balance);
      return { ...base, taxFree, pensionTaxable: balance - taxFree };
    }
    case "IRP": {
      const taxFree = Math.min(account.principalNonDeductible, balance);
      const severanceOnly = isSeveranceOnlyIrp(account);
      const deferred = Math.min(
        balance - taxFree,
        severanceOnly ? balance - taxFree : account.deferredRetirementIncome,
      );
      return {
        ...base,
        taxFree,
        deferred,
        pensionTaxable: balance - taxFree - deferred,
      };
    }
    case "ISA": {
      const isaGain = Math.min(account.investmentGain, balance);
      return { ...base, taxFree: balance - isaGain, isaGain };
    }
    default:
      return { ...base, taxFree: balance };
  }
};

const syntheticCashPool = (): Pool => ({
  account: null,
  kind: "CASH",
  label: "현금성 자산(잉여 적립)",
  taxFree: 0,
  deferred: 0,
  pensionTaxable: 0,
  isaGain: 0,
  isaGainWithdrawn: 0,
  firstAnnuityIndex: null,
  converted: false,
  stats: emptyStats(),
});

interface TakeContext {
  index: number;
  age: number;
  mode: DrawMode;
  retirementRate: number;
}

/**
 * 계좌에서 꺼낸다. 인출 순서는 과세제외(비공제 원금) → 이연퇴직소득 → 세액공제분·운용수익 → ISA 수익.
 * want.net이면 세후 금액을 맞추고, want.gross면 세전 금액만큼 꺼낸다.
 */
const takeFromPool = (
  pool: Pool,
  want: { net?: number; gross?: number },
  ctx: TakeContext,
  onlyTaxFree = false,
): TakeResult => {
  const result: TakeResult = {
    gross: 0,
    tax: 0,
    net: 0,
    annuityTaxableGross: 0,
    annuityTaxableTax: 0,
  };
  let remainingNet = want.net ?? Infinity;
  let remainingGross = want.gross ?? Infinity;

  const receiptYear = (): number => {
    if (pool.firstAnnuityIndex === null) pool.firstAnnuityIndex = ctx.index;
    return Math.floor((ctx.index - pool.firstAnnuityIndex) / 12) + 1;
  };

  type Part = "taxFree" | "deferred" | "pensionTaxable" | "isaGainFree" | "isaGainTaxed";
  const parts: Part[] = onlyTaxFree
    ? ["taxFree"]
    : ["taxFree", "deferred", "pensionTaxable", "isaGainFree", "isaGainTaxed"];

  for (const part of parts) {
    if (remainingNet <= 0.5 || remainingGross <= 0.5) break;
    let available = 0;
    let rate = 0;
    if (part === "taxFree") {
      available = pool.taxFree;
    } else if (part === "deferred") {
      available = pool.deferred;
      if (available > 0) {
        rate =
          ctx.mode === "annuity"
            ? ctx.retirementRate * deferredRatioOf(receiptYear())
            : ctx.retirementRate;
      }
    } else if (part === "pensionTaxable") {
      available = pool.pensionTaxable;
      rate =
        ctx.mode === "annuity" && ctx.age >= annuityMinAge
          ? privatePensionRateOf(ctx.age)
          : nonAnnuityRate;
      if (available > 0 && ctx.mode === "annuity") receiptYear();
    } else if (part === "isaGainFree") {
      available = Math.min(
        pool.isaGain,
        Math.max(0, isaTaxFreeLimit - pool.isaGainWithdrawn),
      );
    } else {
      available = pool.isaGain;
      rate = isaGainTaxRate;
    }
    if (available <= 0) continue;

    const netPerWon = 1 - rate;
    const grossByNet = remainingNet / netPerWon;
    const take = Math.min(available, grossByNet, remainingGross);
    const tax = take * rate;

    if (part === "taxFree") pool.taxFree -= take;
    else if (part === "deferred") pool.deferred -= take;
    else if (part === "pensionTaxable") pool.pensionTaxable -= take;
    else {
      pool.isaGain -= take;
      pool.isaGainWithdrawn += take;
    }

    result.gross += take;
    result.tax += tax;
    result.net += take - tax;
    remainingNet -= take - tax;
    remainingGross -= take;
    if (part === "pensionTaxable" && ctx.mode === "annuity" && ctx.age >= annuityMinAge) {
      result.annuityTaxableGross += take;
      result.annuityTaxableTax += tax;
    }
  }

  if (result.gross > 0) {
    const s = pool.stats;
    s.firstIndex ??= ctx.index;
    s.lastIndex = ctx.index;
    s.gross += result.gross;
    s.tax += result.tax;
    s.net += result.net;
    s.activeMonths.add(ctx.index);
  }
  return result;
};

const annuityPayment = (balance: number, rate: number, months: number): number => {
  if (months <= 1) return balance;
  if (rate === 0) return balance / months;
  return (balance * rate) / (1 - Math.pow(1 + rate, -months));
};

/** 운용수익을 더하고, 이자소득세로 원천징수된 금액을 돌려준다 */
const growPool = (pool: Pool, rate: number): number => {
  const growth = balanceOf(pool) * rate;
  if (growth <= 0) return 0;
  if (pool.converted || pool.kind === "CASH") {
    const tax = growth * interestTaxRate;
    pool.taxFree += growth - tax;
    return tax;
  }
  if (pool.kind === "BROKERAGE") {
    // 국내 상장주식 매매차익 비과세 가정
    pool.taxFree += growth;
  } else if (pool.kind === "ISA") {
    pool.isaGain += growth;
  } else {
    // 연금계좌의 운용수익은 세액공제분과 같은 연금소득세 대상
    pool.pensionTaxable += growth;
  }
  return 0;
};

const isCashLike = (pool: Pool): boolean =>
  pool.converted || pool.kind === "CASH" || pool.kind === "BROKERAGE";

interface AnnuitySchedule {
  def: AnnuityDef;
  startIndex: number;
  endIndexExclusive: number;
}

const scheduleOf = (
  def: AnnuityDef,
  startIdx: number,
  endIdx: number,
  input: EngineInput,
): AnnuitySchedule => {
  let startIndex = startIdx;
  if (def.start.type === "age") {
    startIndex = Math.max(startIdx, indexOfAge(input.birthYear, def.start.age));
  } else if (def.start.type === "nationalPension") {
    startIndex = Math.max(
      startIdx,
      indexOfAge(input.birthYear, input.nationalPension.startAge),
    );
  }
  // 연금수령은 55세 이후만 가능
  startIndex = Math.max(startIndex, indexOfAge(input.birthYear, annuityMinAge));
  const endIndexExclusive =
    def.months === "untilEnd"
      ? endIdx + 1
      : Math.min(endIdx + 1, startIndex + def.months);
  return { def, startIndex, endIndexExclusive };
};

const poolsForStep = (pools: Pool[], step: DrawStep): Pool[] =>
  step === "NON_DEDUCTIBLE"
    ? pools.filter(
        (p) => !p.converted && (p.kind === "PENSION_SAVINGS" || p.kind === "IRP"),
      )
    : step === "CASH"
      ? // 일시금으로 받은 연금계좌 금액은 현금처럼 먼저 쓴다
        [...pools.filter((p) => p.kind === "CASH"), ...pools.filter((p) => p.converted)]
      : pools.filter((p) => !p.converted && p.kind === step);

const round = (value: number): number => Math.round(value);

const simulateScenario = (
  strategy: StrategyDef,
  input: EngineInput,
  assumptions: EngineAssumptions,
): ScenarioResult => {
  const startIdx = ymToIndex(input.startYm);
  const endIdx = Math.max(
    startIdx + 11,
    indexOfAge(input.birthYear, assumptions.endAge) + 11,
  );
  const mRate = monthlyRate(assumptions.returnRate);

  const pools = input.accounts.map(initPool);
  let cashPool = pools.find((p) => p.kind === "CASH" && p.account !== null);
  if (!cashPool) {
    cashPool = syntheticCashPool();
    pools.push(cashPool);
  }

  const retirementSource =
    pools
      .filter((p) => p.kind === "DC" || p.kind === "IRP")
      .reduce((sum, p) => sum + p.deferred, 0);
  const retirementRate = retirementTaxRateOf(
    retirementSource,
    input.yearsOfService.value,
  );

  const schedules = strategy.annuities.map((def) =>
    scheduleOf(def, startIdx, endIdx, input),
  );

  const unemployment = input.unemployment;
  const ubStart = unemployment ? ymToIndex(unemployment.startYm) : 0;
  const ubEnd = unemployment ? ubStart + unemployment.months : 0;

  const spousePension = input.spouseNationalPension ?? null;
  const spouseBirthYear = input.spouseBirthYear ?? input.birthYear;
  const healthIn = Math.min(input.healthInsuranceInExpense ?? 0, input.monthlyExpense);
  let assessment: DependentAssessment | null = null;
  let healthMonthly = 0;
  let financialIncomeYear = 0;

  const monthly: MonthlySeries = {
    ym: [],
    gross: [],
    tax: [],
    net: [],
    shortfall: [],
    balance: [],
  };
  const yearly = new Map<number, YearRow>();
  let unemploymentTotal = 0;
  let unemploymentFirst: number | null = null;
  let unemploymentLast: number | null = null;
  const thresholdYears: number[] = [];

  let annualTaxableAnnuity = 0;
  let annualTaxableAnnuityTax = 0;

  for (let idx = startIdx; idx <= endIdx; idx++) {
    const age = ageAtIndex(input.birthYear, idx);
    const year = yearOfIndex(idx);
    const interestTax =
      idx > startIdx ? pools.reduce((sum, p) => sum + growPool(p, mRate), 0) : 0;

    const yearsElapsed = Math.floor((idx - startIdx) / 12);
    const inflation = Math.pow(1 + assumptions.inflationRate, yearsElapsed);
    const pensionGrowth = Math.pow(1 + assumptions.pensionGrowthRate, yearsElapsed);
    const nationalPension =
      age >= input.nationalPension.startAge && input.nationalPension.monthlyAmount > 0
        ? input.nationalPension.monthlyAmount * pensionGrowth
        : 0;
    const spouseAge = yearOfIndex(idx) - spouseBirthYear;
    const spouseNationalPension =
      spousePension && spouseAge >= spousePension.startAge && spousePension.monthlyAmount > 0
        ? spousePension.monthlyAmount * pensionGrowth
        : 0;
    const ub =
      unemployment && idx >= ubStart && idx < ubEnd ? unemployment.monthlyAmount : 0;
    if (ub > 0) {
      unemploymentTotal += ub;
      unemploymentFirst ??= idx;
      unemploymentLast = idx;
    }

    // 현금성 자산 이자소득세는 세금으로 집계(세전 = 세후 + 세금 유지)
    let monthGross = interestTax;
    let monthTax = interestTax;
    let monthNet = 0;
    let monthShortfall = 0;

    const record = (r: TakeResult): void => {
      monthGross += r.gross;
      monthTax += r.tax;
      annualTaxableAnnuity += r.annuityTaxableGross;
      annualTaxableAnnuityTax += r.annuityTaxableTax;
    };

    // A안: 시작월에 연금계좌를 일시금으로 현금화(세후 금액은 같은 계좌에 현금으로 남김)
    if (idx === startIdx) {
      for (const pool of pools.filter((p) => strategy.lumpSumAtStart.includes(p.kind))) {
        const balance = balanceOf(pool);
        if (balance <= 0) continue;
        const r = takeFromPool(pool, { gross: balance }, {
          index: idx,
          age,
          mode: "lump",
          retirementRate,
        });
        record(r);
        pool.stats.lumpGross = r.gross;
        pool.stats.lumpTax = r.tax;
        pool.taxFree += r.net;
        pool.converted = true;
        // 일시금 전환분은 생활비 인출이 아니므로 세금만 남기고 인출 집계에서 뺀다
        monthGross -= r.net;
        pool.stats.gross -= r.gross;
        pool.stats.net -= r.net;
        pool.stats.tax -= r.tax;
        pool.stats.activeMonths.delete(idx);
        if (pool.stats.gross <= 0) {
          pool.stats.firstIndex = null;
          pool.stats.lastIndex = null;
        }
      }
    }

    // 연초(또는 시작월): 그해 공적연금·금융소득으로 피부양자를 추정하고 건강보험료를 정한다
    if (assessment === null || idx % 12 === 0) {
      const cashLikeNow = pools.filter(isCashLike).reduce((sum, p) => sum + balanceOf(p), 0);
      financialIncomeYear = cashLikeNow * assumptions.financialYieldRate;
      const npAnnual = nationalPension * 12;
      const spouseNpAnnual = spouseNationalPension * 12;
      assessment = assessDependent({
        publicPensionAnnual: npAnnual,
        financialIncomeAnnual: financialIncomeYear,
        propertyValue: input.propertyValue,
        spousePublicPensionAnnual: spousePension ? spouseNpAnnual : null,
      });
      if (assessment.status === "CHECK_NEEDED") {
        // 재산 미입력: 진단에 입력한 현재 보험료를 물가만큼 올려 유지
        healthMonthly = healthIn * inflation;
      } else if (assessment.fails) {
        healthMonthly = calculateHealthInsurance({
          pensionIncome: npAnnual + spouseNpAnnual,
          laborIncome: 0,
          businessIncome: 0,
          interestDividendIncome: financialIncomeYear,
          otherIncome: 0,
          propertyValue: input.propertyValue ?? 0,
          carValue: 0,
        }).estimatedMonthlyPremium;
      } else {
        healthMonthly = 0;
      }
    }
    const expense = (input.monthlyExpense - healthIn) * inflation + healthMonthly;

    // 예정 연금수령
    let annuityNet = 0;
    for (const schedule of schedules) {
      if (idx < schedule.startIndex || idx >= schedule.endIndexExclusive) continue;
      const remaining = schedule.endIndexExclusive - idx;
      for (const pool of pools.filter(
        (p) => !p.converted && schedule.def.kinds.includes(p.kind),
      )) {
        const balance = balanceOf(pool);
        if (balance <= 0.5) continue;
        const payment = annuityPayment(balance, mRate, remaining);
        const r = takeFromPool(pool, { gross: payment }, {
          index: idx,
          age,
          mode: "annuity",
          retirementRate,
        });
        pool.stats.annuity = true;
        record(r);
        annuityNet += r.net;
      }
    }

    const drawForNeed = (needNet: number): { net: number; remaining: number } => {
      let remaining = needNet;
      let net = 0;
      for (const step of strategy.drawOrder) {
        for (const pool of poolsForStep(pools, step)) {
          if (remaining <= 0.5) break;
          if (balanceOf(pool) <= 0.5) continue;
          const pension = PENSION_KINDS.has(pool.kind) && !pool.converted;
          const mode: DrawMode = pension && age >= annuityMinAge ? "annuity" : "lump";
          const r = takeFromPool(
            pool,
            { net: remaining },
            { index: idx, age, mode, retirementRate },
            step === "NON_DEDUCTIBLE",
          );
          if (r.gross <= 0) continue;
          pool.stats.asNeeded = true;
          if (pension && mode === "lump" && r.tax > 0) pool.stats.earlyNonAnnuity = true;
          record(r);
          net += r.net;
          remaining -= r.net;
        }
        if (remaining <= 0.5) break;
      }
      return { net, remaining: Math.max(0, remaining) };
    };

    const living = expense - nationalPension - spouseNationalPension - ub;
    // 생활비를 넘는 연금수령액은 현금으로 적립되므로 생활비 인출에서 뺀다
    const annuityUsed = Math.max(0, Math.min(annuityNet, living));
    monthGross -= annuityNet - annuityUsed;
    monthNet += annuityUsed;
    const need = living - annuityNet;
    if (need > 0) {
      const drawn = drawForNeed(need);
      monthNet += drawn.net;
      monthShortfall += drawn.remaining;
    } else {
      cashPool.taxFree += -need;
    }

    // 연말: 사적연금 연 1,500만원 초과분 보수 과세
    const yearEnd = idx % 12 === 11 || idx === endIdx;
    if (yearEnd) {
      const extra = overThresholdExtraTax(annualTaxableAnnuity, annualTaxableAnnuityTax);
      if (extra > 0) {
        thresholdYears.push(year);
        const paid = drawForNeed(extra);
        // 추가 세금은 생활비가 아니라 세금으로 집계
        monthTax += extra;
        monthGross += extra - paid.net;
        monthShortfall += paid.remaining;
      }
      annualTaxableAnnuity = 0;
      annualTaxableAnnuityTax = 0;
    }

    const totalBalance = pools.reduce((sum, p) => sum + balanceOf(p), 0);

    monthly.ym.push(indexToYm(idx));
    monthly.gross.push(round(monthGross));
    monthly.tax.push(round(monthTax));
    monthly.net.push(round(monthNet));
    monthly.shortfall.push(round(monthShortfall));
    monthly.balance.push(round(totalBalance));

    const row: YearRow = yearly.get(year) ?? {
      year,
      age,
      expense: 0,
      nationalPension: 0,
      spouseNationalPension: 0,
      unemployment: 0,
      healthPremium: 0,
      grossWithdrawal: 0,
      tax: 0,
      netWithdrawal: 0,
      shortfall: 0,
      endingBalance: 0,
      financialIncome: financialIncomeYear,
      dependentStatus: assessment.status,
      dependentReasons: assessment.reasons,
    };
    row.expense += expense;
    row.nationalPension += nationalPension;
    row.spouseNationalPension += spouseNationalPension;
    row.unemployment += ub;
    row.healthPremium += healthMonthly;
    row.grossWithdrawal += monthGross;
    row.tax += monthTax;
    row.netWithdrawal += monthNet;
    row.shortfall += monthShortfall;
    row.endingBalance = totalBalance;
    yearly.set(year, row);
  }

  const yearRows: YearRow[] = [...yearly.values()].map((row) => ({
    ...row,
    expense: round(row.expense),
    nationalPension: round(row.nationalPension),
    spouseNationalPension: round(row.spouseNationalPension),
    unemployment: round(row.unemployment),
    healthPremium: round(row.healthPremium),
    grossWithdrawal: round(row.grossWithdrawal),
    tax: round(row.tax),
    netWithdrawal: round(row.netWithdrawal),
    shortfall: round(row.shortfall),
    endingBalance: round(row.endingBalance),
    financialIncome: round(row.financialIncome),
  }));

  const firstShortfallIdx = monthly.shortfall.findIndex((v) => v > 0);
  const totalTax = yearRows.reduce((s, r) => s + r.tax, 0);
  const netWithdrawal = yearRows.reduce((s, r) => s + r.netWithdrawal, 0);
  const summary = {
    grossWithdrawal: netWithdrawal + totalTax,
    totalTax,
    netWithdrawal,
    depletionAge:
      firstShortfallIdx >= 0
        ? ageAtIndex(input.birthYear, startIdx + firstShortfallIdx)
        : null,
    shortfallMonths: monthly.shortfall.filter((v) => v > 0).length,
    firstShortfallYm: firstShortfallIdx >= 0 ? monthly.ym[firstShortfallIdx]! : null,
    dependentLikelyYears: yearRows.filter((r) => r.dependentStatus === "LIKELY").length,
    endingBalance: monthly.balance[monthly.balance.length - 1] ?? 0,
  };

  const planItems = buildPlanItems({
    strategy,
    pools,
    input,
    thresholdYears,
    unemployment: unemployment
      ? {
          total: unemploymentTotal,
          firstIndex: unemploymentFirst,
          lastIndex: unemploymentLast,
          monthly: unemployment.monthlyAmount,
        }
      : null,
  });

  const notes: string[] = [];
  if (strategy.type === "D") {
    notes.push(
      `국민연금 개시(만 ${input.nationalPension.startAge}세) 이후 피부양자 요건을 다시 판정하세요. 피부양자 조건을 영구히 보장하는 전략이 아닙니다.`,
    );
    // 국민연금 개시 전에도 요건을 넘으면 D안의 피부양자 효과가 제한된다
    const preNpFails = yearRows.some(
      (r) =>
        r.age < input.nationalPension.startAge &&
        r.dependentStatus !== "CHECK_NEEDED" &&
        r.healthPremium > 0,
    );
    if (preNpFails) {
      notes.push(
        "국민연금 개시 전에도 재산·금융소득·배우자 소득 기준으로 피부양자 유지가 어려운 연도가 있어 D안의 건강보험료 절감 효과가 제한됩니다.",
      );
    }
  }
  const premiumYears = yearRows.filter((r) => r.healthPremium > 0 && r.dependentStatus !== "CHECK_NEEDED");
  if (premiumYears.length > 0) {
    notes.push(
      `피부양자 요건을 넘는 ${premiumYears.length}개 연도는 지역가입자 건강보험료를 추정해 지출에 더했습니다.`,
    );
  }
  if (thresholdYears.length > 0) {
    notes.push(
      `사적연금 과세대상 수령액이 연 1,500만원을 넘는 해(${thresholdYears.join(", ")})는 16.5% 분리과세로 보수 계산했습니다.`,
    );
  }
  if (summary.depletionAge !== null) {
    notes.push(`만 ${summary.depletionAge}세부터 생활비가 부족합니다.`);
  }

  return {
    type: strategy.type,
    title: strategy.title,
    goal: strategy.goal,
    recommended: false,
    priorityOrder: strategy.priorityOrder,
    summary,
    planItems,
    yearly: yearRows,
    monthly,
    notes,
  };
};

interface PlanBuildArgs {
  strategy: StrategyDef;
  pools: Pool[];
  input: EngineInput;
  thresholdYears: number[];
  unemployment: {
    total: number;
    firstIndex: number | null;
    lastIndex: number | null;
    monthly: number;
  } | null;
}

const ymOrNull = (index: number | null): string | null =>
  index === null ? null : indexToYm(index);

const buildPlanItems = ({
  strategy,
  pools,
  input,
  thresholdYears,
  unemployment,
}: PlanBuildArgs): PlanItem[] => {
  const priorityOf = (key: PlanItem["accountType"]): number =>
    strategy.itemPriority.indexOf(key) + 1;

  const items: PlanItem[] = [];

  if (unemployment && unemployment.total > 0) {
    items.push({
      accountId: null,
      accountType: "UNEMPLOYMENT",
      label: ACCOUNT_LABEL.UNEMPLOYMENT,
      priority: priorityOf("UNEMPLOYMENT"),
      actionType: "INCOME",
      startYm: ymOrNull(unemployment.firstIndex),
      endYm: ymOrNull(unemployment.lastIndex),
      monthlyGross: round(unemployment.monthly),
      monthlyNet: round(unemployment.monthly),
      totalGross: round(unemployment.total),
      totalTax: 0,
      method: strategy.texts.UNEMPLOYMENT.method,
      taxNote: strategy.texts.UNEMPLOYMENT.taxNote,
      healthInsuranceNote: HEALTH_NOTES.UNEMPLOYMENT,
      cautions: [],
    });
  }

  for (const pool of pools) {
    const s = pool.stats;
    const isSynthetic = pool.account === null;
    if (isSynthetic && s.gross <= 0) continue;

    const text = strategy.texts[pool.kind];
    const cautions: string[] = [];
    const account = pool.account;

    if (account && (pool.kind === "PENSION_SAVINGS" || pool.kind === "IRP")) {
      if (unknownAmountOf(account) > 0) {
        cautions.push(
          "비공제 원금 확인 필요 — 확인 전에는 세액공제분으로 보아 보수적으로 계산했습니다.",
        );
      }
      if (thresholdYears.length > 0 && s.annuity) {
        cautions.push("연 사적연금 1,500만원 초과 연도는 16.5% 분리과세로 계산했습니다.");
      }
    }
    if (account?.pensionSavingsLegacy) {
      cautions.push("구계좌는 비공제 원금 여부를 금융사에서 확인하세요.");
    }
    if (
      account &&
      pool.kind === "IRP" &&
      (account.irpSource === null || account.irpSource === "UNKNOWN") &&
      account.deferredRetirementIncome === 0
    ) {
      cautions.push("퇴직급여 이전분과 개인납입분이 구분되지 않아 개인납입분으로 계산했습니다.");
    }
    if (pool.kind === "DC" && input.yearsOfService.source === "default") {
      cautions.push(
        `근속연수 기본값(${input.yearsOfService.value}년)으로 퇴직소득세를 추정했습니다. 퇴직금 시뮬레이션이나 원천징수영수증으로 확인하세요.`,
      );
    }
    if (s.earlyNonAnnuity) {
      cautions.push("55세 전 인출은 연금외수령으로 과세됩니다(기타소득세 16.5% 또는 퇴직소득세).");
    }
    if (s.annuity) {
      cautions.push("연금수령한도(평가액÷(11−연차)×120%)를 넘는 금액은 연금외수령으로 과세될 수 있습니다.");
    }
    if (account?.isaMaturityYm) {
      cautions.push(`ISA 만기 ${account.isaMaturityYm} — 만기 후 60일 이내 전환 여부를 정하세요.`);
    }

    const lump = s.lumpGross > 0;
    const actionType: PlanItem["actionType"] = lump
      ? "LUMP_SUM"
      : s.annuity
        ? "ANNUITY"
        : s.asNeeded
          ? "AS_NEEDED"
          : "HOLD";
    if (actionType === "HOLD") cautions.push("계산 기간에 인출하지 않고 잔액을 유지합니다.");
    if (lump) cautions.push("일시금 세후 금액은 현금으로 보유하며 생활비로 사용합니다.");

    const months = Math.max(1, s.activeMonths.size);
    items.push({
      accountId: account?.id ?? null,
      accountType: pool.kind,
      label: pool.label,
      priority: priorityOf(pool.kind),
      actionType,
      startYm: lump ? input.startYm : ymOrNull(s.firstIndex),
      endYm: lump ? input.startYm : ymOrNull(s.lastIndex),
      monthlyGross: lump ? round(s.lumpGross) : round(s.gross / months),
      monthlyNet: lump ? round(s.lumpGross - s.lumpTax) : round(s.net / months),
      totalGross: round(lump ? s.lumpGross : s.gross),
      totalTax: round(lump ? s.lumpTax : s.tax),
      method: isSynthetic ? "연금·소득이 생활비보다 많은 달의 잉여를 적립해 사용" : text.method,
      taxNote: text.taxNote,
      healthInsuranceNote: HEALTH_NOTES[pool.kind],
      cautions,
    });
  }

  return items.sort((a, b) => a.priority - b.priority);
};

const accountChecksOf = (accounts: EngineAccount[]): AccountCheck[] =>
  accounts.map((a) => {
    const unknownAmount = unknownAmountOf(a);
    return {
      accountId: a.id,
      accountType: a.accountType,
      label: a.label,
      nonDeductibleStatus: needsNonDeductibleCheck(a)
        ? unknownAmount > 0
          ? "CHECK_NEEDED"
          : "CONFIRMED"
        : "NOT_APPLICABLE",
      unknownAmount,
    };
  });

// 동점이면 PRD 기본안인 D부터 우선한다
const RECOMMEND_PREFERENCE: readonly ScenarioType[] = ["D", "C", "B", "A"];
// 자산 소진 시점이 이 개월 수 이내로 차이 나면 같은 수준으로 본다
const DEPLETION_TOLERANCE_MONTHS = 12;

const manwon = (won: number): string => `${Math.round(won / 10_000).toLocaleString("ko-KR")}만원`;

/**
 * 추천안: 자산 소진이 가장 늦은 안들 중 피부양자 추정 가능 연수가 길고, 추정 세금이 적은 안.
 */
export const recommendScenario = (
  scenarios: ScenarioResult[],
): { type: ScenarioType; reason: string } => {
  // 소진 시점 비교(소진 없음은 가장 늦은 것으로 본다)
  const depletionIdx = (s: ScenarioResult): number =>
    s.summary.firstShortfallYm ? ymToIndex(s.summary.firstShortfallYm) : Infinity;
  const latest = Math.max(...scenarios.map(depletionIdx));
  const candidates = scenarios.filter((s) =>
    latest === Infinity
      ? depletionIdx(s) === Infinity
      : depletionIdx(s) >= latest - DEPLETION_TOLERANCE_MONTHS,
  );

  // 피부양자 연수 → 세금 → 기본 선호 순서로 정렬
  const [best] = [...candidates].sort(
    (a, b) =>
      b.summary.dependentLikelyYears - a.summary.dependentLikelyYears ||
      a.summary.totalTax - b.summary.totalTax ||
      RECOMMEND_PREFERENCE.indexOf(a.type) - RECOMMEND_PREFERENCE.indexOf(b.type),
  );
  const chosen = best ?? scenarios[0]!;

  const depletionText =
    latest === Infinity ? "계산 기간 내 자산이 소진되지 않는 안" : "자산 소진이 가장 늦은 안";
  const dependentText =
    chosen.summary.dependentLikelyYears > 0
      ? `피부양자 추정 가능 ${chosen.summary.dependentLikelyYears}년`
      : "피부양자 추정 가능 기간 없음";
  return {
    type: chosen.type,
    reason: `${depletionText} 중 ${dependentText}, 추정 세금 ${manwon(chosen.summary.totalTax)}으로 가장 유리합니다`,
  };
};

export const generateScenarioSet = (input: EngineInput): ScenarioSetResult => {
  const assumptions: EngineAssumptions = { ...DEFAULT_ASSUMPTIONS, ...input.assumptions };
  const simulated = SCENARIO_TYPES.map((type) =>
    simulateScenario(STRATEGIES[type], input, assumptions),
  );
  const recommendation = recommendScenario(simulated);
  const scenarios = simulated.map((s) => ({ ...s, recommended: s.type === recommendation.type }));
  const recommendedTitle = scenarios.find((s) => s.recommended)?.title ?? recommendation.type;
  const startIdx = ymToIndex(input.startYm);
  const endIdx = Math.max(
    startIdx + 11,
    indexOfAge(input.birthYear, assumptions.endAge) + 11,
  );

  return {
    ruleVersion: RULE_SET_VERSION,
    basisDates: [
      { domain: "국민연금", ...NATIONAL_PENSION_RULES.meta },
      { domain: "퇴직소득세", ...SEVERANCE_TAX_RULES.meta },
      { domain: "연금소득세", ...PENSION_INCOME_TAX_RULES.meta },
      { domain: "ISA", ...ISA_RULES.meta },
      { domain: "건강보험", ...HEALTH_INSURANCE_RULES.meta },
      { domain: "실업급여", ...UNEMPLOYMENT_RULES.meta },
    ],
    startYm: input.startYm,
    endYm: indexToYm(endIdx),
    assumptions,
    recommendedType: recommendation.type,
    recommendationNote: `${recommendedTitle}을 추천합니다. ${recommendation.reason}. 국민연금 개시(만 ${input.nationalPension.startAge}세) 이후 피부양자 요건과 인출 계획을 다시 판정하세요.`,
    inputSummary: {
      accountsCount: input.accounts.length,
      totalBalance: input.accounts.reduce((s, a) => s + a.balance, 0),
      nationalPensionSource: input.nationalPension.source,
      unemploymentSource: input.unemployment?.source ?? "none",
      yearsOfServiceSource: input.yearsOfService.source,
      spouseNationalPensionSource: input.spouseNationalPension?.source ?? "none",
      propertyProvided: input.propertyValue !== null,
    },
    accountChecks: accountChecksOf(input.accounts),
    isaStrategy: isaStrategyOf(input.accounts, input.startYm),
    scenarios,
    disclaimers: [
      "세무·투자 자문이 아닌 추정치입니다. 실제 세액과 건강보험료는 금융사·국세청·건강보험공단에서 확인하세요.",
      "생월을 반영하지 않아 나이는 연 단위로 계산합니다.",
      `물가 ${assumptions.inflationRate * 100}%, 연금 상승 ${assumptions.pensionGrowthRate * 100}%, 운용수익 ${assumptions.returnRate * 100}% 가정입니다.`,
      "피부양자 요건을 넘는 연도는 지역가입자 건강보험료(장기요양 포함)를 추정해 지출에 더하고, 추정 가능 연도는 0원으로 봅니다. 재산을 입력하지 않으면 진단에 입력한 보험료를 유지합니다.",
      "현금·일시금 수령분의 이자에는 15.4% 이자소득세를, 주식계좌는 국내 상장주식 매매차익 비과세를 가정했습니다.",
    ],
  };
};
