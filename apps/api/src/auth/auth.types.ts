export interface JwtPayload {
  sub: string; // user id
  builderProfileId: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}
