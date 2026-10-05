import { Request, Response, NextFunction } from "express";
import { BusinessException } from "../../shared/exceptions/business.exception.js";
import { TechnicalException } from "../../shared/exceptions/technical.exception.js";

interface MappedError {
  status: number;
  code: string;
  message: string;
}

// body-parser가 붙이는 type 필드 (express.json)
const getBodyParserType = (err: unknown): string | undefined => {
  if (!err || typeof err !== "object") return undefined;
  const type = (err as { type?: unknown }).type;
  return typeof type === "string" ? type : undefined;
};

// Prisma 알려진 요청 에러의 code (P2025 등)
const getPrismaCode = (err: unknown): string | undefined => {
  if (!err || typeof err !== "object") return undefined;
  const { code, clientVersion } = err as { code?: unknown; clientVersion?: unknown };
  if (typeof code !== "string" || !/^P\d{4}$/.test(code)) return undefined;
  return typeof clientVersion === "string" ? code : undefined;
};

/** 프레임워크·ORM 에러를 클라이언트 응답으로 변환 (매핑 대상이 아니면 null) */
export const mapKnownError = (err: unknown): MappedError | null => {
  // 잘못된 JSON·본문 초과
  const parserType = getBodyParserType(err);
  if (parserType === "entity.parse.failed") {
    return { status: 400, code: "INVALID_JSON", message: "요청 본문이 올바른 JSON이 아닙니다" };
  }
  if (parserType === "entity.too.large") {
    return { status: 413, code: "PAYLOAD_TOO_LARGE", message: "요청 본문이 너무 큽니다" };
  }

  const prismaCode = getPrismaCode(err);
  // 대상 레코드 없음
  if (prismaCode === "P2025") {
    return { status: 404, code: "NOT_FOUND", message: "요청한 데이터를 찾을 수 없습니다" };
  }
  // 컬럼 범위를 넘는 값 (Int4 초과 등)
  if (prismaCode === "P2020") {
    return { status: 400, code: "INVALID_REQUEST", message: "요청 값이 허용 범위를 벗어났습니다" };
  }
  return null;
};

/** 로그용 요약 — Prisma 원문(쿼리 값·금액)이 남지 않도록 이름·코드·스택만 기록 */
export const summarizeError = (err: unknown): Record<string, unknown> => {
  if (!(err instanceof Error)) return { name: typeof err };
  const prismaCode = getPrismaCode(err);
  if (prismaCode || err.name.startsWith("PrismaClient")) {
    return { name: err.name, ...(prismaCode ? { code: prismaCode } : {}) };
  }
  return { name: err.name, message: err.message, stack: err.stack };
};

export const errorMiddleware = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof BusinessException || err instanceof TechnicalException) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  const mapped = mapKnownError(err);
  if (mapped) {
    return res.status(mapped.status).json({
      success: false,
      error: { code: mapped.code, message: mapped.message },
    });
  }

  // 예상하지 못한 에러: 500 Internal Server Error
  console.error("Unexpected error:", summarizeError(err));

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "서버 내부 오류가 발생했습니다",
    },
  });
};
