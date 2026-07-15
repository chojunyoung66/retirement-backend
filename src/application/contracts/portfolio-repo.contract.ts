export interface PortfolioItemData {
  symbol: string;
  name: string;
  allocation: number;
}

export interface PortfolioData {
  userId: number;
  accountType: string;
  name: string;
  items: PortfolioItemData[];
}

export interface IPortfolioRepo {
  findByUserId(userId: number): Promise<(PortfolioData & { id: number })[]>;
  findById(id: number): Promise<(PortfolioData & { id: number }) | null>;
  create(userId: number, accountType: string, name: string, items: PortfolioItemData[]): Promise<PortfolioData & { id: number }>;
  update(id: number, data: Partial<PortfolioData>): Promise<PortfolioData & { id: number }>;
  delete(id: number): Promise<boolean>;
}
