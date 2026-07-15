export interface IJwtUtil {
  sign(payload: Record<string, unknown>, expiresIn?: string): string;
  verify(token: string): Record<string, unknown>;
  decode(token: string): Record<string, unknown> | null;
}
