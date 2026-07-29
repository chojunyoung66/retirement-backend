export interface IUserRepo {
  // password는 Google 전용 사용자의 경우 null
  findByEmail(email: string): Promise<{ id: number; email: string; password: string | null; name: string } | null>;
  findById(id: number): Promise<{ id: number; email: string; name: string } | null>;
  create(email: string, hashedPassword: string, name: string): Promise<{ id: number; email: string; name: string }>;
  update(id: number, data: { name?: string; password?: string }): Promise<{ id: number; email: string; name: string }>;
}
