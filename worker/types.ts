export interface Env {
  DB: D1Database;
  ATTACHMENTS_BUCKET?: R2Bucket;
  JWT_SECRET: string;
  DEFAULT_TIMEZONE: string;
  ASSETS?: Fetcher;
}

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
  exp: number;
}

