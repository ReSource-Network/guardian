import dotenv from "dotenv";
dotenv.config();

export function isProd() {
  return process.env.NODE_ENV === "production";
}

export function fetchConfig() {
  return {
    NODE_ENV: process.env.NODE_ENV!,
    PORT: parseInt(process.env.PORT!) || 4000,
    POSTGRES: process.env.POSTGRES!,
    TOTP_SECRET: process.env.TOTP_SECRET!,
    GUARDIAN_WALLET_PK: process.env.GUARDIAN_PK!,
    BLOCKCHAIN_NETWORK: process.env.BLOCKCHAIN_NETWORK!,
    SENTRY_DSN: process.env.SENTRY_DSN!,
    CUSTOMERIO_SITE_ID: process.env.CUSTOMERIO_SITE_ID!,
    CUSTOMERIO_API_KEY: process.env.CUSTOMERIO_API_KEY!,
    CUSTOMERIO_APP_API_KEY: process.env.CUSTOMERIO_APP_API_KEY!,
    JWT_PUBLIC: process.env.JWT!,
    ADMIN_SECRET: process.env.ADMIN_SECRET!,
  };
}

export default fetchConfig();
