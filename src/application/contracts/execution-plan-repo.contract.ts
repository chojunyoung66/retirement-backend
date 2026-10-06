export interface ExecutionItem {
  key: string;
  label: string;
  dueDay: number;
  /** 완료 시각 ISO 문자열, 미완료면 null */
  doneAt: string | null;
}

export interface ExecutionPlanRecord {
  id: number;
  userId: number;
  reportId: number;
  startDate: Date;
  items: ExecutionItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IExecutionPlanRepo {
  create(data: {
    userId: number;
    reportId: number;
    startDate: Date;
    items: ExecutionItem[];
  }): Promise<ExecutionPlanRecord>;
  findById(id: number): Promise<ExecutionPlanRecord | null>;
  findByReportId(reportId: number): Promise<ExecutionPlanRecord | null>;
  updateItems(id: number, items: ExecutionItem[]): Promise<ExecutionPlanRecord>;
}
