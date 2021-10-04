import { totp } from "otplib";
import config from "../config";

async function generate(): Promise<string> {
  return await totp.generate(config.TOTP_SECRET);
}

export { generate };
