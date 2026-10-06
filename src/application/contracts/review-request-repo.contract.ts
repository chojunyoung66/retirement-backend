import type { ScenarioType } from "../services/withdrawal/types.js";

export type ReviewStatus = "REQUESTED" | "IN_REVIEW" | "ANSWERED" | "CLOSED" | "CANCELED";
export const REVIEW_STATUSES: readonly ReviewStatus[] = [
  "REQUESTED",
  "IN_REVIEW",
  "ANSWERED",
  "CLOSED",
  "CANCELED",
];
/** 운영자가 아직 처리 중인 상태 */
export const ACTIVE_REVIEW_STATUSES: readonly ReviewStatus[] = ["REQUESTED", "IN_REVIEW"];

export interface ReviewRequestRecord {
  id: number;
  userId: number;
  reportId: number;
  question: string;
  consentAt: Date;
  status: ReviewStatus;
  answer: string | null;
  answeredAt: Date | null;
  operatorNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 운영자 목록용 — 리포트 본문 없이 식별에 필요한 최소 정보만 */
export interface ReviewRequestAdminSummary extends ReviewRequestRecord {
  userEmail: string;
  reportTitle: string | null;
  scenarioType: ScenarioType;
  reportGeneratedAt: Date;
}

export interface IReviewRequestRepo {
  create(data: {
    userId: number;
    reportId: number;
    question: string;
    consentAt: Date;
  }): Promise<ReviewRequestRecord>;
  findById(id: number): Promise<ReviewRequestRecord | null>;
  findByUserId(userId: number): Promise<ReviewRequestRecord[]>;
  findActiveByReportId(reportId: number): Promise<ReviewRequestRecord | null>;
  countActiveByUserId(userId: number): Promise<number>;
  update(
    id: number,
    data: Partial<Pick<ReviewRequestRecord, "status" | "answer" | "answeredAt" | "operatorNote">>,
  ): Promise<ReviewRequestRecord>;
  listForAdmin(filter: { status?: ReviewStatus; limit: number }): Promise<ReviewRequestAdminSummary[]>;
}
