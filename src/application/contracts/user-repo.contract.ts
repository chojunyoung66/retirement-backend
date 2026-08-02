export interface UserAuthRecord {
  id: number;
  email: string;
  password: string | null;
  name: string;
  googleSub: string | null;
  profileImage: string | null;
}

export interface IUserRepo {
  // password는 Google 전용 사용자의 경우 null
  findByEmail(email: string): Promise<UserAuthRecord | null>;
  findByGoogleSub(googleSub: string): Promise<UserAuthRecord | null>;
  findById(
    id: number,
  ): Promise<{
    id: number;
    email: string;
    name: string;
    profileImage: string | null;
  } | null>;
  /** 탈퇴 재인증용 — password 포함 */
  findAuthById(id: number): Promise<UserAuthRecord | null>;
  create(
    email: string,
    hashedPassword: string,
    name: string,
  ): Promise<{ id: number; email: string; name: string }>;
  createGoogleUser(data: {
    email: string;
    googleSub: string;
    name: string;
    profileImage: string | null;
  }): Promise<UserAuthRecord>;
  update(
    id: number,
    data: {
      name?: string;
      password?: string;
      googleSub?: string;
      profileImage?: string | null;
    },
  ): Promise<{ id: number; email: string; name: string }>;
  deleteById(id: number): Promise<void>;
}
