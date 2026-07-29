import { OAuth2Client } from "google-auth-library";
import type {
  GoogleIdentity,
  IGoogleTokenVerifier,
} from "../contracts/google-token-verifier.contract.js";
import { BusinessException } from "../exceptions/business.exception.js";

export const createGoogleTokenVerifier = (
  clientId: string,
): IGoogleTokenVerifier => {
  const client = new OAuth2Client(clientId);

  return {
    async verifyIdToken(idToken: string): Promise<GoogleIdentity> {
      try {
        // Google이 서명·aud·iss·exp를 검증
        const ticket = await client.verifyIdToken({
          idToken,
          audience: clientId,
        });
        const payload = ticket.getPayload();

        if (!payload?.sub || !payload.email) {
          throw new BusinessException(
            "INVALID_GOOGLE_TOKEN",
            "유효하지 않은 Google 토큰입니다",
            401,
          );
        }

        return {
          googleSub: payload.sub,
          email: payload.email,
          emailVerified: payload.email_verified === true,
          name: payload.name ?? "",
          profileImage: payload.picture ?? null,
        };
      } catch (error) {
        if (error instanceof BusinessException) throw error;
        throw new BusinessException(
          "INVALID_GOOGLE_TOKEN",
          "유효하지 않은 Google 토큰입니다",
          401,
        );
      }
    },
  };
};
