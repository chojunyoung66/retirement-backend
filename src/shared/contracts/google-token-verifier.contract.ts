export interface GoogleIdentity {
  googleSub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  profileImage: string | null;
}

export interface IGoogleTokenVerifier {
  verifyIdToken(idToken: string): Promise<GoogleIdentity>;
}
