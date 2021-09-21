import dotenv from "dotenv";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
dotenv.config();

export function isProd() {
  return process.env.NODE_ENV === "production";
}

const getPKFromMnemonic = (): string => {
  const filePath = `./../mnemonic.txt`;
  const mnemonic = fs
    .readFileSync(path.join(__dirname, filePath))
    .toString()
    .trim();
  return ethers.Wallet.fromMnemonic(mnemonic).privateKey;
};

export function fetchConfig() {
  return {
    NODE_ENV: process.env.NODE_ENV!,
    PORT: parseInt(process.env.PORT!) || 4000,
    POSTGRES: process.env.POSTGRES!,
    JWT_SECRET: process.env.JWT_SECRET!,
    TOTP_SECRET: process.env.TOTP_SECRET!,
    GUARDIAN_WALLET_PK: getPKFromMnemonic(),
    BLOCKCHAIN_NETWORK: process.env.BLOCKCHAIN_NETWORK!,
    SENTRY_DSN: process.env.SENTRY_DSN!,
    CUSTOMERIO_SITE_ID: process.env.CUSTOMERIO_SITE_ID!,
    CUSTOMERIO_API_KEY: process.env.CUSTOMERIO_API_KEY!,
    CUSTOMERIO_APP_API_KEY: process.env.CUSTOMERIO_APP_API_KEY!,
    JWT: process.env.JWT!,
  };
}

export default fetchConfig();
