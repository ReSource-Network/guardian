import { createPublicKey } from "crypto";
import { jwtVerify } from "jose/jwt/verify";

import config from "../config";
import { log } from "../services/logger";

export async function verify({ token }): Promise<Decoded | null> {
  const key = createPublicKey({
    key: Buffer.from(config.JWT, "base64"),
    format: "der",
    type: "spki",
  });

  let decoded: Decoded | null;

  try {
    const {
      payload: { id, exp, secret },
    } = await jwtVerify(token, key);

    if (!exp) return null;

    if (secret && secret === config.ADMIN_SECRET)
      return (decoded = { id: <string>id, admin: <string>secret, exp });

    decoded = { exp, id: <string>id };
  } catch (e) {
    decoded = null;

    log.debug("Error verifying jwt: ");
    log.error(e);
  }

  return decoded;
}

export interface Decoded {
  id?: string;
  exp?: number;
  admin?: string;
}
